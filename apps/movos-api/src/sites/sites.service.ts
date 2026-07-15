import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Site } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { slugify } from './slugify';
import type { CreateSiteDto } from './dto/create-site.dto';
import type { UpdateSiteDto } from './dto/update-site.dto';

@Injectable()
export class SitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Lists non-archived sites for an organization. Tenant scope is enforced by
   * the caller (OrgContextGuard) AND re-applied here via organizationId.
   */
  async list(organizationId: string): Promise<Site[]> {
    return this.prisma.site.findMany({
      where: { organizationId, status: { not: 'ARCHIVED' } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Loads a single site, verifying it belongs to the organization. Sites in
   * other organizations are indistinguishable from non-existent ones.
   */
  async getById(organizationId: string, siteId: string): Promise<Site> {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, organizationId },
    });
    if (!site) {
      throw new NotFoundException('Sitio no encontrado');
    }
    return site;
  }

  async create(
    organizationId: string,
    createdByUserId: string,
    dto: CreateSiteDto,
  ): Promise<Site> {
    const slug = await this.uniqueSlug(organizationId, dto.name);

    let site: Site;
    try {
      site = await this.prisma.site.create({
        data: {
          organizationId,
          createdByUserId,
          name: dto.name,
          slug,
          city: dto.city,
          address: dto.address,
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          status: dto.status ?? 'DRAFT',
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Ya existe un sitio con ese nombre');
      }
      throw error;
    }

    await this.audit.record({
      action: 'SITE_CREATED',
      organizationId,
      actorUserId: createdByUserId,
      subjectType: 'Site',
      subjectId: site.id,
      metadata: { name: site.name, slug: site.slug },
    });

    return site;
  }

  async update(
    organizationId: string,
    actorUserId: string,
    siteId: string,
    dto: UpdateSiteDto,
  ): Promise<Site> {
    const existing = await this.getById(organizationId, siteId);

    const data: Prisma.SiteUpdateInput = {};
    if (dto.name !== undefined && dto.name !== existing.name) {
      data.name = dto.name;
      data.slug = await this.uniqueSlug(organizationId, dto.name, siteId);
    }
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.latitude !== undefined) data.latitude = dto.latitude;
    if (dto.longitude !== undefined) data.longitude = dto.longitude;
    if (dto.status !== undefined) data.status = dto.status;

    const site = await this.prisma.site.update({
      where: { id: existing.id },
      data,
    });

    await this.audit.record({
      action: 'SITE_UPDATED',
      organizationId,
      actorUserId,
      subjectType: 'Site',
      subjectId: site.id,
    });

    return site;
  }

  async archive(
    organizationId: string,
    actorUserId: string,
    siteId: string,
  ): Promise<Site> {
    const existing = await this.getById(organizationId, siteId);

    const site = await this.prisma.site.update({
      where: { id: existing.id },
      data: { status: 'ARCHIVED' },
    });

    await this.audit.record({
      action: 'SITE_ARCHIVED',
      organizationId,
      actorUserId,
      subjectType: 'Site',
      subjectId: site.id,
    });

    return site;
  }

  /**
   * Produces a slug unique within the organization, appending -2, -3, ...
   * when needed. Excludes the current site (on update).
   */
  private async uniqueSlug(
    organizationId: string,
    name: string,
    excludeSiteId?: string,
  ): Promise<string> {
    const base = slugify(name) || 'sitio';
    let candidate = base;
    let counter = 2;

    // Loop until an unused slug is found. Bounded in practice by site count.
    for (;;) {
      const clash = await this.prisma.site.findFirst({
        where: {
          organizationId,
          slug: candidate,
          ...(excludeSiteId ? { id: { not: excludeSiteId } } : {}),
        },
        select: { id: true },
      });
      if (!clash) {
        return candidate;
      }
      candidate = `${base}-${counter}`;
      counter += 1;
    }
  }
}
