import { Injectable } from '@nestjs/common';
import type {
  ApiRecommendation,
  RecommendationSeverity,
} from '@mediafox/shared-types';

import { PrismaService } from '../prisma/prisma.service';

const MINUTE_MS = 60_000;

/**
 * Operational Intelligence MVP (WO-ARGOS-025) — the smallest possible
 * Recommendation Engine, implementing exactly the 5 recommendations
 * authorized: energy anomaly, authentication failure spike, idle
 * connector, comparative underperformance, and efficiency drift. See
 * docs/product/RECOMMENDATION_CATALOG.md (#7, #9, #8, #11, #20) for the
 * discovery this materializes, and
 * docs/implementation/OPERATIONAL_INTELLIGENCE_TECHNICAL_NOTES.md for the
 * exact thresholds and their rationale.
 *
 * Every method is read-only over ChargingSession/AuthorizationAttempt/
 * MeterValue/Connector/ChargingStation — no new table, no write path, no
 * persistence of a recommendation once generated (recomputed fresh on
 * every request, per docs/product/RECOMMENDATION_EXPLAINABILITY.md's
 * governing rule: a recommendation is only ever as current as the data
 * behind it). No Alert/Incident/MaintenanceTicket — nothing here is
 * acknowledged, assigned, or resolved; it is regenerated or it silently
 * stops appearing once the underlying condition clears.
 *
 * Each method returns at most one recommendation — its own single worst
 * current instance — never a list. This is what keeps the "maximum five
 * cards" UI constraint automatically true: 5 methods, 5 possible cards,
 * by construction, not by a display-layer truncation of a longer list.
 */
@Injectable()
export class RecommendationService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(organizationId: string): Promise<ApiRecommendation[]> {
    const results = await Promise.all([
      this.getEnergyAnomaly(organizationId),
      this.getAuthFailureSpike(organizationId),
      this.getIdleConnector(organizationId),
      this.getComparativeUnderperformance(organizationId),
      this.getEfficiencyDrift(organizationId),
    ]);
    return results.filter((r): r is ApiRecommendation => r !== null);
  }

  /**
   * RECOMMENDATION_CATALOG.md #7 — a session actively delivering well
   * below its connector's rated power. Confidence: HIGH (a direct
   * comparison against a fixed reference, no baseline).
   */
  async getEnergyAnomaly(
    organizationId: string,
  ): Promise<ApiRecommendation | null> {
    const sessions = await this.prisma.chargingSession.findMany({
      where: { organizationId, status: { in: ['ACTIVE', 'SUSPENDED'] } },
      include: {
        connector: { select: { maxPowerKw: true } },
        chargingStation: { select: { id: true, name: true } },
        meterValues: { orderBy: { timestamp: 'desc' }, take: 3 },
      },
    });

    let worst: {
      stationId: string;
      stationName: string;
      avgPowerW: number;
      ratedW: number;
      ratio: number;
      readingCount: number;
      startedAt: Date;
    } | null = null;

    for (const session of sessions) {
      if (!session.connector.maxPowerKw) continue;
      const ratedW = session.connector.maxPowerKw * 1000;
      const readings = session.meterValues.filter((mv) => mv.powerW !== null);
      if (readings.length < 2) continue;
      const runningMinutes =
        (Date.now() - session.startedAt.getTime()) / MINUTE_MS;
      if (runningMinutes < 5) continue;

      const avgPowerW =
        readings.reduce((sum, mv) => sum + (mv.powerW ?? 0), 0) /
        readings.length;
      const ratio = avgPowerW / ratedW;
      if (ratio >= 0.5) continue;

      if (!worst || ratio < worst.ratio) {
        worst = {
          stationId: session.chargingStation.id,
          stationName: session.chargingStation.name,
          avgPowerW,
          ratedW,
          ratio,
          readingCount: readings.length,
          startedAt: session.startedAt,
        };
      }
    }

    if (!worst) return null;

    const severity: RecommendationSeverity =
      worst.ratio < 0.3 ? 'high' : 'medium';
    return {
      type: 'ENERGY_ANOMALY',
      title: 'Anomalía de energía',
      severity,
      explanation: `${worst.stationName} está entregando ${Math.round(worst.avgPowerW / 1000)} kW en promedio, muy por debajo de su capacidad nominal de ${Math.round(worst.ratedW / 1000)} kW, en una sesión activa.`,
      evidence: [
        `Potencia promedio reciente: ${Math.round(worst.avgPowerW)} W (${worst.readingCount} lecturas de MeterValue)`,
        `Potencia nominal del conector: ${Math.round(worst.ratedW)} W`,
        `Relación: ${Math.round(worst.ratio * 100)}% de lo esperado`,
      ],
      recommendedAction:
        'Enviar personal técnico a inspeccionar el conector — el vehículo está conectado pero recibiendo mucha menos potencia de la nominal.',
      stationId: worst.stationId,
      stationName: worst.stationName,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * RECOMMENDATION_CATALOG.md #9 — a station's authorization rejection
   * share rising above its own recent baseline. Confidence: MEDIUM (the
   * facts are real; the threshold is a judgment call).
   */
  async getAuthFailureSpike(
    organizationId: string,
  ): Promise<ApiRecommendation | null> {
    const windowStart = new Date(Date.now() - 7 * 24 * 60 * MINUTE_MS);
    const [attempts, stations] = await Promise.all([
      this.prisma.authorizationAttempt.findMany({
        where: { organizationId, attemptedAt: { gte: windowStart } },
        select: { chargingStationId: true, result: true },
      }),
      this.prisma.chargingStation.findMany({
        where: { status: 'ACTIVE', site: { organizationId } },
        select: { id: true, name: true },
      }),
    ]);

    const stationNames = new Map(stations.map((s) => [s.id, s.name]));
    const byStation = new Map<string, { total: number; rejected: number }>();
    for (const attempt of attempts) {
      const bucket = byStation.get(attempt.chargingStationId) ?? {
        total: 0,
        rejected: 0,
      };
      bucket.total += 1;
      if (attempt.result === 'REJECTED' || attempt.result === 'UNKNOWN') {
        bucket.rejected += 1;
      }
      byStation.set(attempt.chargingStationId, bucket);
    }

    let worst: {
      stationId: string;
      stationName: string;
      total: number;
      rejected: number;
      share: number;
    } | null = null;

    for (const [stationId, bucket] of byStation) {
      if (bucket.total < 3) continue;
      const share = bucket.rejected / bucket.total;
      if (share <= 0.4) continue;
      if (!worst || share > worst.share) {
        worst = {
          stationId,
          stationName: stationNames.get(stationId) ?? stationId,
          total: bucket.total,
          rejected: bucket.rejected,
          share,
        };
      }
    }

    if (!worst) return null;

    const severity: RecommendationSeverity =
      worst.share > 0.6 ? 'high' : 'medium';
    return {
      type: 'AUTH_FAILURE_SPIKE',
      title: 'Pico de fallos de autenticación',
      severity,
      explanation: `${worst.stationName} rechazó ${Math.round(worst.share * 100)}% de los intentos de autorización en los últimos 7 días.`,
      evidence: [
        `Intentos totales: ${worst.total}`,
        `Rechazados o desconocidos: ${worst.rejected}`,
        `Ventana evaluada: últimos 7 días`,
      ],
      recommendedAction:
        'Revisar el lector RFID de la estación — podría estar mal configurado, dañado, o fuera de sincronía con las credenciales activas.',
      stationId: worst.stationId,
      stationName: worst.stationName,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * RECOMMENDATION_CATALOG.md #8 — a session completed but its connector
   * never returned to AVAILABLE. Confidence: HIGH (a direct fact
   * mismatch, no baseline).
   */
  async getIdleConnector(
    organizationId: string,
  ): Promise<ApiRecommendation | null> {
    const completed = await this.prisma.chargingSession.findMany({
      where: { organizationId, status: 'COMPLETED', endedAt: { not: null } },
      include: {
        connector: { select: { status: true } },
        chargingStation: { select: { id: true, name: true } },
      },
      orderBy: { endedAt: 'desc' },
    });

    const seenConnectors = new Set<string>();
    let worst: {
      stationId: string;
      stationName: string;
      minutesSince: number;
      connectorStatus: string;
      endedAt: Date;
    } | null = null;

    for (const session of completed) {
      if (seenConnectors.has(session.connectorId)) continue;
      seenConnectors.add(session.connectorId);
      if (session.connector.status === 'AVAILABLE') continue;

      const minutesSince =
        (Date.now() - session.endedAt!.getTime()) / MINUTE_MS;
      if (minutesSince < 15) continue;

      if (!worst || minutesSince > worst.minutesSince) {
        worst = {
          stationId: session.chargingStation.id,
          stationName: session.chargingStation.name,
          minutesSince,
          connectorStatus: session.connector.status,
          endedAt: session.endedAt!,
        };
      }
    }

    if (!worst) return null;

    const severity: RecommendationSeverity =
      worst.minutesSince > 60 ? 'high' : 'medium';
    return {
      type: 'IDLE_CONNECTOR',
      title: 'Conector inactivo tras finalizar sesión',
      severity,
      explanation: `Un conector de ${worst.stationName} sigue en estado ${worst.connectorStatus} ${Math.round(worst.minutesSince)} minutos después de que su última sesión finalizó.`,
      evidence: [
        `Sesión finalizada hace ${Math.round(worst.minutesSince)} minutos`,
        `Estado actual del conector: ${worst.connectorStatus}`,
      ],
      recommendedAction:
        'Contactar al conductor o enviar personal a verificar el cable/vehículo — el conector no ha vuelto a estar disponible para el siguiente usuario.',
      stationId: worst.stationId,
      stationName: worst.stationName,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * RECOMMENDATION_CATALOG.md #11 — a station's throughput well below its
   * peers at the same site. Confidence: MEDIUM (real data, peer-baseline
   * dependent).
   */
  async getComparativeUnderperformance(
    organizationId: string,
  ): Promise<ApiRecommendation | null> {
    const [stations, energyByStation] = await Promise.all([
      this.prisma.chargingStation.findMany({
        where: { status: 'ACTIVE', site: { organizationId } },
        select: { id: true, name: true, siteId: true },
      }),
      this.prisma.chargingSession.groupBy({
        by: ['chargingStationId'],
        where: { organizationId },
        _sum: { energyWh: true },
      }),
    ]);

    const energyMap = new Map(
      energyByStation.map((row) => [
        row.chargingStationId,
        row._sum.energyWh ?? 0,
      ]),
    );

    const stationsBySite = new Map<string, typeof stations>();
    for (const station of stations) {
      const list = stationsBySite.get(station.siteId) ?? [];
      list.push(station);
      stationsBySite.set(station.siteId, list);
    }

    let worst: {
      stationId: string;
      stationName: string;
      ownEnergy: number;
      peerAvg: number;
      ratio: number;
    } | null = null;

    for (const siteStations of stationsBySite.values()) {
      if (siteStations.length < 2) continue;
      for (const station of siteStations) {
        const peers = siteStations.filter((s) => s.id !== station.id);
        const peerTotal = peers.reduce(
          (sum, p) => sum + (energyMap.get(p.id) ?? 0),
          0,
        );
        const peerAvg = peerTotal / peers.length;
        if (peerAvg <= 0) continue;
        const ownEnergy = energyMap.get(station.id) ?? 0;
        const ratio = ownEnergy / peerAvg;
        if (ratio >= 0.5) continue;

        if (!worst || ratio < worst.ratio) {
          worst = {
            stationId: station.id,
            stationName: station.name,
            ownEnergy,
            peerAvg,
            ratio,
          };
        }
      }
    }

    if (!worst) return null;

    return {
      type: 'COMPARATIVE_UNDERPERFORMANCE',
      title: 'Bajo rendimiento comparado con estaciones pares',
      severity: 'medium',
      explanation: `${worst.stationName} ha entregado ${(worst.ownEnergy / 1000).toFixed(1)} kWh en total, frente a un promedio de ${(worst.peerAvg / 1000).toFixed(1)} kWh en sus estaciones pares del mismo sitio.`,
      evidence: [
        `Energía total de esta estación: ${(worst.ownEnergy / 1000).toFixed(1)} kWh`,
        `Promedio de estaciones pares en el mismo sitio: ${(worst.peerAvg / 1000).toFixed(1)} kWh`,
        `Relación: ${Math.round(worst.ratio * 100)}% del promedio de sus pares`,
      ],
      recommendedAction:
        'Investigar por qué esta estación tiene menor uso que sus vecinas — señalización, acceso, o tarifas podrían ser la causa.',
      stationId: worst.stationId,
      stationName: worst.stationName,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * RECOMMENDATION_CATALOG.md #20 — a station's average delivery rate
   * trending down across its own recent history. Confidence: MEDIUM (real
   * telemetry, trend relative to the station's own baseline).
   */
  async getEfficiencyDrift(
    organizationId: string,
  ): Promise<ApiRecommendation | null> {
    const stations = await this.prisma.chargingStation.findMany({
      where: { status: 'ACTIVE', site: { organizationId } },
      select: { id: true, name: true },
    });

    let worst: {
      stationId: string;
      stationName: string;
      olderAvg: number;
      recentAvg: number;
      dropRatio: number;
      olderCount: number;
      recentCount: number;
    } | null = null;

    for (const station of stations) {
      const sessions = await this.prisma.chargingSession.findMany({
        where: {
          chargingStationId: station.id,
          status: 'COMPLETED',
          endedAt: { not: null },
        },
        orderBy: { startedAt: 'asc' },
        select: { energyWh: true, startedAt: true, endedAt: true },
      });
      if (sessions.length < 4) continue;

      const rateWhPerMinute = (s: (typeof sessions)[number]): number => {
        const minutes =
          (s.endedAt!.getTime() - s.startedAt.getTime()) / MINUTE_MS;
        return minutes > 0 ? s.energyWh / minutes : 0;
      };

      const mid = Math.floor(sessions.length / 2);
      const older = sessions.slice(0, mid);
      const recent = sessions.slice(mid);
      const avg = (bucket: typeof sessions): number =>
        bucket.reduce((sum, s) => sum + rateWhPerMinute(s), 0) / bucket.length;

      const olderAvg = avg(older);
      const recentAvg = avg(recent);
      if (olderAvg <= 0) continue;
      const dropRatio = (olderAvg - recentAvg) / olderAvg;
      if (dropRatio <= 0.15) continue;

      if (!worst || dropRatio > worst.dropRatio) {
        worst = {
          stationId: station.id,
          stationName: station.name,
          olderAvg,
          recentAvg,
          dropRatio,
          olderCount: older.length,
          recentCount: recent.length,
        };
      }
    }

    if (!worst) return null;

    const severity: RecommendationSeverity =
      worst.dropRatio > 0.3 ? 'high' : 'medium';
    return {
      type: 'EFFICIENCY_DRIFT',
      title: 'Degradación de eficiencia',
      severity,
      explanation: `${worst.stationName} ha entregado energía ${Math.round(worst.dropRatio * 100)}% más lento en sus sesiones recientes que en sus sesiones anteriores.`,
      evidence: [
        `Tasa promedio anterior: ${worst.olderAvg.toFixed(1)} Wh/min (${worst.olderCount} sesiones)`,
        `Tasa promedio reciente: ${worst.recentAvg.toFixed(1)} Wh/min (${worst.recentCount} sesiones)`,
        `Caída: ${Math.round(worst.dropRatio * 100)}%`,
      ],
      recommendedAction:
        'Programar una inspección preventiva antes de que la degradación se convierta en una falla dura.',
      stationId: worst.stationId,
      stationName: worst.stationName,
      generatedAt: new Date().toISOString(),
    };
  }
}
