# M001-A — Domain Map v0.1

**Mission:** M001-A — Domain Research (in progress, owned by ARGOS)
**Generated:** 2026-07-24 · **Repository HEAD:** `main` @ `bfea8db` · **Baseline:** [MOVOS Product Atlas v1.0](../product/MOVOS_PRODUCT_ATLAS_v1.0.md)

Current-state domain map, based only on evidence recovered in the [Ubiquitous Language](./M001-A_UBIQUITOUS_LANGUAGE_v0.1.md) document. No candidate elements are introduced in this v0.1 — this baseline recovers what exists; it does not yet propose.

## Core entity relationships

```mermaid
erDiagram
    ORGANIZATION ||--o{ MEMBERSHIP : has
    ORGANIZATION ||--o{ SITE : owns
    ORGANIZATION ||--o{ AUDITEVENT : scopes
    USER ||--o{ MEMBERSHIP : holds
    USER ||--o{ REFRESHSESSION : authenticates
    USER ||--o{ SITE : creates
    SITE ||--o{ STATION : "would contain"
    STATION ||--o{ CHARGER : "would contain"
    CHARGER ||--o{ CONNECTOR : "would contain"
    CONNECTOR ||--o| CHARGINGSESSION : "would host"
    CHARGINGSESSION }o--|| TARIFF : "would apply"

    ORGANIZATION {
        string id
        string name
        string slug
        enum status
    }
    SITE {
        string id
        string name
        string slug
        float latitude
        float longitude
        enum status
    }
    STATION {
        string note "no model — fixture-only"
    }
    CHARGER {
        string note "no model — fixture-only"
    }
    CONNECTOR {
        string note "no model — fixture-only"
    }
    CHARGINGSESSION {
        string note "no model — fixture-only, do not confuse with implemented RefreshSession"
    }
    TARIFF {
        string note "no model — fixture-only"
    }
```

_Mermaid's ER notation doesn't natively encode "implemented vs. fixture-only," so status is carried in each entity's `note` field above — `ORGANIZATION`, `SITE`, `MEMBERSHIP` (not pictured for space, see below), `USER`, `REFRESHSESSION`, and `AUDITEVENT` have no note because they are fully implemented; everything from `STATION` down is annotated as not yet modeled._

## Implementation-status view

```mermaid
flowchart TD
    subgraph Implemented["✅ IMPLEMENTED — real schema, tested, in production"]
        Org[Organization]
        Mem[Membership]
        Usr[User]
        RS[RefreshSession]
        Site[Site]
        Loc["Location fields on Site"]
        Aud[AuditEvent]
    end

    subgraph Fixture["🟡 FIXTURE-ONLY — TypeScript type + mock data, no backend"]
        Stn[Station]
        Chg[Charger]
        Con[Connector]
        CS[ChargingSession]
        Tar[Tariff]
        Alt[Alert]
    end

    subgraph Documented["⚪ DOCUMENTED — named, zero artifact"]
        OCPP[OCPP transport]
        Bill[Billing]
        Notif[Notifications]
    end

    subgraph Unclear["❓ UNCLEAR BOUNDARY — evidence insufficient, scope not confirmed"]
        Zone[Zone]
        Asset[Asset]
        Veh[Vehicle / Driver / Fleet]
        DTwin[Digital Twin]
    end

    Org --> Mem
    Mem --> Usr
    Usr --> RS
    Org --> Site
    Site --> Loc
    Org --> Aud

    Site -.->|planned| Stn
    Stn -.->|planned| Chg
    Chg -.->|planned| Con
    Con -.->|planned| CS
    CS -.->|planned| Tar
    Chg -.->|planned, depends on telemetry| Alt

    Chg -.->|would replace mock data source| OCPP
    Tar -.->|depends on maturing| Bill
    Alt -.->|depends on| Notif

    Site -.->|possible sub-area, unconfirmed| Zone
    Chg -.->|possible generalization, unconfirmed| Asset

    classDef implemented fill:#e6f4ea,stroke:#33724f,color:#173023
    classDef fixture fill:#fbf3e3,stroke:#a5791f,color:#4a3a12
    classDef documented fill:#eef1ee,stroke:#8d9089,color:#3a3c39
    classDef unclear fill:#f7e9e6,stroke:#a93f32,color:#4a201a

    class Org,Mem,Usr,RS,Site,Loc,Aud implemented
    class Stn,Chg,Con,CS,Tar,Alt fixture
    class OCPP,Bill,Notif documented
    class Zone,Asset,Veh,DTwin unclear
```

## Reading this map

- **Implemented boundary:** everything inside `Organization → Membership/Site → AuditEvent` is real, tested, in production. This is the only region of the domain with an enforced multi-tenant boundary today (`OrgContextGuard` re-validates every request against this exact subgraph).
- **Fixture boundary:** Station through Alert form a single connected chain, entirely fixture-only, but — critically — **already internally consistent** in the frontend types (a mock Charger references a real `stationId`, a mock Connector references a real `chargerId`, etc.). This is why the [MVP Gap Analysis](../product/MOVOS_MVP_GAP_ANALYSIS_v1.0.md) treats formalizing this chain as reproducing an existing design, not inventing one.
- **Documented-only nodes** (OCPP, Billing, Notifications) have no shape yet at all — not even a fixture. They are placed downstream of the fixture chain because every mention of them in product docs assumes the fixture chain is real first.
- **Unclear-boundary nodes** (Zone, Asset, Vehicle/Driver/Fleet, Digital Twin) are drawn with dotted, unconfirmed edges because the repository contains no evidence establishing whether they connect to this domain at all. They are shown for completeness of the recovery mission, not because their placement is asserted as correct — each has a corresponding entry in [Open Decisions](./M001-A_OPEN_DECISIONS_v0.1.md).

## What this map deliberately omits

ForgeOS's own domain (Workspace, ARGOS, Missions-as-tracked-in-commits) is not pictured — recovered evidence shows zero dependency edges between it and MOVOS's domain (see [Ubiquitous Language — ARGOS](./M001-A_UBIQUITOUS_LANGUAGE_v0.1.md#argos)). Drawing them on the same diagram would imply a relationship that doesn't exist in code.
