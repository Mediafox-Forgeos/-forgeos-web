# Work Order V1 — Field Hardening Design

**Work order:** WO-ARGOS-049, Phase 1 (architecture / product design)
**Status:** DESIGN ONLY. No schema, API, frontend, or production change was made to produce this document. Every claim about current behavior below was verified against the actual repository (`apps/movos-api`, `apps/movos-web`, `apps/movos-api/prisma/schema.prisma`) — nothing is inferred.
**Target:** `WORK_ORDER_V1_FIELD_READY` — five tightly scoped improvements (field evidence, scheduled visit, visit location, resolution summary, operational timeline) closing the gaps `PILOT-WO-01/02/03` actually surfaced. Not a Field Service Management platform.

---

## 1. Current-state audit

Verified directly against the repository at the current `main` baseline.

### WorkOrder model (`apps/movos-api/prisma/schema.prisma:1030`)

```
model WorkOrder {
  id, title, description
  status WorkOrderStatus @default(OPEN)      // OPEN/ASSIGNED/IN_PROGRESS/RESOLVED/CANCELLED
  priority WorkOrderPriority                 // LOW/MEDIUM/HIGH/CRITICAL
  source WorkOrderSource                     // CONNECTIVITY_LOSS/RECOMMENDATION/MANUAL
  organizationId, stationId
  assignedMemberId, assignedAt, startedAt, resolvedAt
  notes String?                              // current-value resolution/comment text
  createdAt, updatedAt
}
```

The schema's own comment at line 1025 already documents this as "a deliberately smaller field set... no connectorId, incidentId, dueAt, slaMinutes, or evidence in this version. Every omitted field is a real, separately-scoped future capability, not a forgotten one." This work order closes exactly the field-evidence and scheduling gaps that comment named in advance — not a surprise finding.

No `scheduledAt`, no location override, no attachment relation exists today.

### WorkOrderEvent model (line 1069) — append-only log

```
model WorkOrderEvent {
  id, workOrderId, type WorkOrderEventType, actorId, payload Json?, createdAt
}
```

`WorkOrderEventType`: `CREATED, ASSIGNED, STARTED, COMMENTED, RESOLVED, CANCELLED, ARRIVAL_CONFIRMED, DIAGNOSIS_RECORDED, INTERVENTION_RECORDED, VALIDATION_RECORDED`. Deliberately loose `Json?` payload per event type (a comment's text, a checklist finding) rather than a fixed column per type — the schema comment at line 1063 calls this "the history log `Action` never got," reused as-is here. This is the same pattern an attachment reference will extend, not replace.

### Site model (line 242) — already rich

`name, slug, city, address, latitude?, longitude?, status`, plus a **second, richer layer**: `formattedAddress, addressLine1/2, state, postalCode, countryCode, googlePlaceId, locationSource, locationValidationStatus, locationValidatedAt`. This was built for Google Places-backed site creation (`docs/pilot/REAL_PILOT_INPUT_REQUIRMENTS.md` and the location components confirm this is live, not aspirational — Centro Comercial Calima's own address was captured this way).

### ChargingStation model (line 284)

`name, code?, manufacturer?, model?, serialNumber?, protocol?, status, commissionedAt?`, plus OCPP identity fields, plus `siteId` (its only link to location — **no address/lat/lng fields of its own**, by design). A station's location is always its site's location.

### User / technician relationship

`MemberRole.TECHNICIAN` (added WO-ARGOS-037). `WorkOrder.assignedMemberId` points directly at a `User.id`. Technician access is **not** role-gated on `WorkOrderController` — it's structurally separate: `MyWorkController` has no `@Roles()` at all; every query it runs additionally filters on `assignedMemberId = self`, so isolation is structural (a query shape), not a conditional that could drift.

### WorkOrder API routes (`work-order.controller.ts`, `my-work.controller.ts`)

Operator-facing (`WorkOrderController`, `@Roles(OWNER, ADMIN, OPERATOR, SUPPORT, ANALYST, VIEWER)` — technician explicitly excluded): `GET/POST /work-orders`, `GET /work-orders/:id`, `GET /work-orders/:id/events`, `PATCH /work-orders/:id` (state-machine transition), `GET /work-orders/assignable-technicians`.

Technician-facing (`MyWorkController`, self-scoped, no role check): `GET/PATCH /my-work`, `GET /my-work/:id`, `GET /my-work/:id/events`, `POST /my-work/:id/checklist-events`.

### WorkOrder creation UI (`apps/movos-web/app/(app)/work-orders/page.tsx:157`)

A flat, four-field inline form: title, description, priority (`<select>`), station (`<select>`, populated from `useAllStations()`). `POST /work-orders` with `{ title, description, priority, source: 'MANUAL', stationId }`. No scheduling field exists.

### WorkOrder detail UI / `/my-work/[id]` (`apps/movos-web/app/(app)/my-work/[id]/page.tsx`)

Already structured around exactly the sections this design extends: "Qué pasó" (description), "Dónde" (station status only — no address rendered today), "Ejecución" (start/resolve), a **`ChecklistCard`** (arrival/diagnosis/intervention/validation), "Notas" (the resolution/comment text), and a shared `WorkOrderEventTimeline`. Critically, **the checklist UI already names this exact gap in its own copy**, verbatim, at line 374: _"Opcional — evidencia de cada etapa. La evidencia fotográfica no está disponible todavía: MOVOS no tiene almacenamiento de archivos."_ — a self-documented gap, not a discovery.

### Checklist implementation (`my-work.service.ts`)

`recordChecklistEvent()` only blocks on a terminal `WorkOrder` (`RESOLVED`/`CANCELLED`) — never requires `IN_PROGRESS`. This is why `START_BEFORE_CHECKLIST`/`CHECKLIST_BEFORE_START` both occurred across the pilot without being a bug (`docs/operations/WORK_ORDER_CHECKLISTS.md`'s deliberate design). Diagnosis/validation events additionally capture a **server-computed** `stationSnapshot` (`connectivityStatus`, `connectorStatuses`) — never client-supplied — rendered honestly alongside the technician's own text, never merged into it.

### Resolution implementation (`work-order.service.ts:191`, `applyTransition`)

`resolve` transition requires a non-empty `comment` (`BadRequestException` otherwise — this is the _only_ existing validation). On resolve, the same string is written to **both** `WorkOrder.notes` (current value, overwritable) and the `RESOLVED` `WorkOrderEvent.payload.comment` (immutable history) in the same transaction. **This is exactly the field the pilot's "OK" pattern lived in** — no new field or schema change is needed to hold a better resolution summary, only a UI relabel, stronger validation, and prominent display.

### Event timeline (`work-order-event-timeline.tsx`)

One canonical `WORK_ORDER_EVENT_LABEL` map and rendering, shared by both operator and technician views (built in WO-ARGOS-038 specifically to kill a prior label-drift bug). Renders `payload.comment ?? payload.finding ?? payload.description ?? payload.outcomeNote` generically — this same generic-field lookup is where an attachment thumbnail/count would naturally render per event, without a parallel rendering path.

### File/storage capability

**None exists.** Grepped the entire repository (`apps/movos-api/src`, `apps/movos-web/src`, all `package.json`s) for `multer`, `@aws-sdk`, `cloudflare`, `r2`, `blob`, `attachment`, `@vercel/blob`, `supabase` — zero matches beyond the frontend's own explicit "not available yet" copy already quoted above. This is genuinely greenfield.

### Deployment architecture

Frontend: Vercel (`movos-web`, project already linked, Vercel CLI already authenticated as `alipise-5463`). Backend: Railway (`movos-api`, Docker build, `apps/movos-api/Dockerfile` at repo root context). Database: managed Postgres on Railway (`postgres-volume`, persistent). No CI/CD auto-deploy — manual `railway redeploy`/`vercel --prod` only (confirmed directly during WO-ARGOS-048's recovery).

### Environment-variable strategy (`env.validation.ts`)

Joi schema, fail-fast on startup if any required var is missing/malformed. Existing precedent for an external-service key: `MOVOS_GOOGLE_MAPS_SERVER_API_KEY` (optional, defaults to empty) — establishes the naming convention (`MOVOS_<PROVIDER>_...`) a new storage-provider key should follow.

### Authentication/authorization boundaries

`JwtAuthGuard` (validates the signed access token, re-checks `User.status === 'ACTIVE'` against the database on every request — not just trusting the token) → `OrgContextGuard` (resolves and **re-validates** the active `Membership` server-side from `X-Organization-Id`/token `orgId`, never trusts a client-supplied org id alone) → `RolesGuard` (declarative `@Roles()`, operator-facing routes only). Multi-tenant isolation is enforced at the guard layer, consistently, on every route that has it — the correct layer for any new attachment route to plug into unchanged.

---

## 2. Pilot findings being addressed

From `PILOT-WO-01/02/03` (`PRODUCT_SIMULATION_PILOT`, human-reported + system-derived evidence, per `docs/pilot/OPERATIONAL_PILOT_V1.md`'s Phase A/B/C model):

| Finding                                                                               | Source                                           | Addressed by                                                         |
| ------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------- |
| Photo/video evidence explicitly desired                                               | Human-reported                                   | §3 Field evidence                                                    |
| Visit date/time explicitly desired                                                    | Human-reported                                   | §7 Scheduled visit                                                   |
| Visit location explicitly desired                                                     | Human-reported                                   | §8 Location                                                          |
| Resolution evidence can become overly generic ("OK" ×2/3)                             | System-derived (`PILOT_WO_01/02/03_EVIDENCE.md`) | §9 Resolution summary                                                |
| Richer incident context ↔ richer technician evidence (n=3, correlational)             | System-derived (`PILOT_WO_03_EVIDENCE.md` §6)    | Motivates §9 without over-fitting a 3-sample trend into a rigid form |
| Workflow perceived easy/intuitive; no WhatsApp needed for the digital workflow itself | Human-reported                                   | Constrains every design below to stay additive, not a redesign       |
| Canonical timestamps already exist, underused in presentation                         | System-derived                                   | §10 Operational timeline                                             |

---

## 3. Proposed domain model

One new table, one new enum, three new nullable columns on `WorkOrder`. Nothing existing is renamed, removed, or made non-nullable.

```prisma
enum AttachmentKind {
  IMAGE
  VIDEO
}

model WorkOrderAttachment {
  id               String          @id @default(cuid())
  workOrderId      String
  eventId          String?         // null = WorkOrder-level; set = tied to one checklist/resolution stage
  uploadedById     String

  kind             AttachmentKind
  mimeType         String
  originalFilename String?
  fileSizeBytes    Int

  storageProvider  String          // e.g. "VERCEL_BLOB" — never assume a single provider forever
  storagePath      String          // opaque storage key/pathname, never a guessable/public path
  storageUrl       String?         // present only if the provider issues a stable, access-controlled URL

  createdAt        DateTime        @default(now())

  workOrder  WorkOrder       @relation(fields: [workOrderId], references: [id])
  event      WorkOrderEvent? @relation(fields: [eventId], references: [id])
  uploadedBy User            @relation(fields: [uploadedById], references: [id])

  @@index([workOrderId])
  @@index([eventId])
}
```

`WorkOrder` gains three nullable columns:

```prisma
scheduledAt DateTime?   // §7
// no location override column — see §8 for why
```

Note: only `scheduledAt` is new on `WorkOrder` itself. Resolution (§9) and timeline (§10) require **zero** schema change — they reuse `notes`/`RESOLVED` event payload and existing timestamps respectively.

**Attach-to-WorkOrder vs. attach-to-stage (§3 of the mission):** both, via `eventId` being nullable. A technician can attach evidence generally (`eventId: null`) or to the specific checklist/resolution event it documents (`eventId: <that event's id>`). This directly matches how the checklist already works — text is entered per-stage; a photo naturally belongs to the same stage when the technician is already looking at that stage's form.

---

## 4. Attachment architecture

**Upload flow (client-direct-to-storage, not proxied through Railway):**

1. Technician selects/captures a file in `/my-work/[id]`.
2. Frontend calls a new, authenticated `POST /my-work/:id/attachments/upload-url` (self-scoped, same guard stack as the rest of `MyWorkController`) with `{ mimeType, fileSizeBytes, originalFilename?, eventId? }`.
3. Backend validates MIME/size (§5), verifies the technician owns this `WorkOrder` (existing `getOwnWorkOrder()` check, reused as-is), and returns a short-lived signed upload URL/token from the storage provider — the binary **never passes through `movos-api`**.
4. Browser uploads directly to storage using that signed URL.
5. Frontend calls `POST /my-work/:id/attachments` with `{ storagePath, eventId?, mimeType, fileSizeBytes, originalFilename? }` to persist the `WorkOrderAttachment` row (backend re-verifies the path was actually issued by step 3, not client-invented).

This keeps Railway's request size and bandwidth out of the video-upload path entirely — the single most important reason to avoid proxying binaries through `movos-api` on a small Railway Hobby-plan instance.

**Reads:** `GET /my-work/:id/attachments` and the equivalent operator-facing `GET /work-orders/:id/attachments` return metadata plus a freshly-issued short-lived **signed read URL** per attachment (never a permanently public URL) — computed at request time, not stored, so a revoked/expired signed URL never leaks from a stale cached response.

---

## 5. Storage recommendation and comparison

| Option           | Stack fit                                                                                                                              | Cost at MVP scale                                                                               | Mobile upload                                                                                          | Private access                                            | Complexity                                                                                            | Verdict                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Vercel Blob**  | Extends the **existing** Vercel project (`movos-web`) — no new vendor relationship, only a new resource inside one already established | Pay-as-you-go, negligible at pilot volume                                                       | First-class client-side direct upload SDK, built for exactly this (avoids serverless body-size limits) | Public or private buckets; private access via signed URLs | Lowest — one new env var, one SDK                                                                     | **Recommended**                                                                  |
| Cloudflare R2    | S3-compatible, but a brand-new vendor account/API tokens                                                                               | Cheapest at real scale (no egress fees)                                                         | Requires hand-rolling a presigned-URL flow (S3 SDK)                                                    | Yes, via presigned URLs                                   | Higher — new account, new IAM-equivalent setup                                                        | Reasonable **future** option if storage volume grows large; not justified for V1 |
| AWS S3 (direct)  | Mature, well-understood, but a brand-new vendor account and IAM policy design                                                          | Cheap, but real operational overhead to set up correctly (bucket policy, CORS, lifecycle rules) | Requires the same hand-rolled presigned flow as R2                                                     | Yes                                                       | Highest of the realistic options                                                                      | Not justified — no existing AWS relationship to extend                           |
| Supabase Storage | Would introduce an entire new backing platform alongside the already-established Railway/Postgres stack                                | Free tier plausible at pilot scale                                                              | Has a client SDK                                                                                       | Yes, via RLS-backed policies                              | Medium, but duplicates infrastructure MOVOS already has (a second "backend platform" for one feature) | Rejected — vendor sprawl without a corresponding benefit                         |

**Recommendation: Vercel Blob.** It is the only option that extends infrastructure MOVOS already operates rather than introducing a new one, its client-upload pattern is purpose-built for the mobile-technician-uploads-a-photo scenario, and its private/signed-URL support satisfies §5's security requirements without custom presigning code.

**`HUMAN_INFRASTRUCTURE_INPUT_REQUIRED`:** creating the actual Blob store resource inside the Vercel dashboard/CLI and provisioning the resulting `BLOB_READ_WRITE_TOKEN` (as `movos-api`'s new env var, following the `MOVOS_`-prefixed convention: `MOVOS_BLOB_READ_WRITE_TOKEN`) is an account-level action on ARGOS's existing Vercel project. Nothing was created for this design pass.

---

## 6. Authorization/security model

Every design point below reuses an **existing, already-verified** boundary — none of it weakens or bypasses the guard stack described in §1.

- **Upload scoped to owned WorkOrders:** the new `/my-work/:id/attachments/*` routes sit inside `MyWorkController`, so they inherit `JwtAuthGuard` + `OrgContextGuard` and must call the existing `getOwnWorkOrder(organizationId, technicianUserId, id)` check before issuing any upload URL — a technician cannot get a signed URL for a colleague's `WorkOrder`, structurally, the same way `recordChecklistEvent` already can't.
- **Operator read within their organization:** `GET /work-orders/:id/attachments` sits in `WorkOrderController`, inheriting the existing `@Roles(OPERATOR_FACING_ROLES)` + `OrgContextGuard` — the same tenant check that already scopes every other read there.
- **Cross-organization access impossible:** every attachment row is reached only via its parent `WorkOrder`, which is always queried `WHERE id = :id AND organizationId = :orgId` first (the existing pattern in both controllers) — an attachment can never be fetched by its own id alone, cross-tenant.
- **Arbitrary file access prevented:** `storagePath` is a server-generated opaque key (e.g. `workorders/{workOrderId}/{cuid}`), never derived from user input, never guessable; reads only ever go through the signed-URL issuance endpoint above, never a static/public path.
- **MIME/type validated:** allow-list at upload-URL request time — `image/jpeg, image/png, image/webp, image/heic, video/mp4, video/quicktime` (the realistic set a phone camera actually produces); anything else rejected with `400` before a signed URL is even issued.
- **Size constrained:** a fixed maximum per file (proposed: 25 MB image / 200 MB video — Vercel Blob's own limits are comfortably above this; the real constraint is keeping a pilot-scale Blob store's cost and a technician's mobile data usage sane, not a platform limit) enforced server-side before URL issuance, not merely client-side.
- **Filenames cannot create unsafe paths:** `originalFilename` is stored as inert display metadata only — it is **never** used to construct `storagePath` (which is always a server-generated `cuid`-based key), so there is no path-traversal surface regardless of what a client sends as a filename.
- **Secrets never exposed:** `MOVOS_BLOB_READ_WRITE_TOKEN` stays server-side only, in `movos-api`'s environment, exactly like `JWT_ACCESS_SECRET`/`DATABASE_URL` today — the frontend only ever receives short-lived, scoped signed URLs, never the token itself.
- **No accidental public enumerability:** the store defaults to private; every read is a freshly-issued signed URL from an authorized request, not a stable public link — so there is no bucket listing or predictable-URL enumeration surface.
- **Rate limiting:** `@nestjs/throttler` is already a dependency (used elsewhere in the API) — the new upload-URL-issuance route is a natural, low-cost place to apply it, preventing signed-URL-minting abuse.

---

## 7. Scheduled-visit model

**Schema:** one nullable column, `WorkOrder.scheduledAt DateTime?`. No new table — this is deliberately "one scheduled field visit for one WorkOrder," not a calendar system, matching the mission's explicit boundary.

**Timezone strategy:** stored as an absolute UTC instant, consistent with every other timestamp already on this model (`createdAt`, `assignedAt`, `startedAt`, `resolvedAt` are all implicit-UTC `DateTime` today — no precedent is broken). For display, V1 renders in a single fixed application timezone (`America/Bogota`, matching the pilot's real users) rather than building a per-site timezone system. **Named simplification, not an oversight:** `Site` has no timezone field today; if MOVOS ever operates outside Colombia, `scheduledAt` display will need a real per-site timezone — out of scope here because no current site needs it.

**API contract:** `CreateWorkOrderDto` gains one optional field, `scheduledAt?: string` (ISO 8601), validated with `class-validator`'s `@IsOptional() @IsISO8601()` — same validation style already used elsewhere in this codebase. A small, dedicated `PATCH /work-orders/:id/schedule` (operator-only, `{ scheduledAt: string | null }`) handles rescheduling **without** touching `WorkOrderService.transition()`'s state-machine validation — rescheduling isn't a status transition and shouldn't be forced through that machine's `assertValidTransition` rules.

**Creation/edit behavior:** optional at creation (the form already has room — one more input next to the existing priority/station selects). Editable any time before `RESOLVED`/`CANCELLED` via the dedicated endpoint above.

**Operator UI:** one optional datetime input added to `CreateWorkOrderForm` (`work-orders/page.tsx`); shown read-only (with an "edit" affordance) on `/work-orders/[id]`.

**Technician UI:** shown as a read-only fact on `/my-work/[id]`'s existing "Qué pasó"/"Dónde" cards — a technician doesn't reschedule their own visit in V1 (that's an operator dispatch decision, matching who currently does the assigning).

**Event/timeline implications:** none required. `scheduledAt` is a plan, not an event — it does not need its own `WorkOrderEvent` row; §10's timeline reads it directly off the `WorkOrder` record alongside the real events.

---

## 8. Location strategy

**Finding, stated plainly per the mission's request to report this separately: current `Site` data is already sufficient. No `Site` hardening is required for this work order.** `Site` already carries `formattedAddress`/`address`+`city`+`state`+`postalCode`+`countryCode` and `latitude`/`longitude`, populated via Google Places for at least the pilot's real site (Centro Comercial Calima). `ChargingStation` correctly has no location fields of its own — it inherits location through `siteId`, and that inheritance chain (`Organization → Site → ChargingStation → WorkOrder`) is already exactly what §8 asks to inspect.

**Design: pure derivation, zero new columns.** `toApiWorkOrder`'s presenter is extended to also resolve (via the already-joined `station.site` relation — `WorkOrder.station` is already included in every existing query) a small `visitLocation` block:

```
visitLocation: {
  siteName: string,
  stationName: string,
  formattedAddress: string | null,   // Site.formattedAddress ?? Site.address
  latitude: number | null,
  longitude: number | null,
}
```

The technician sees exactly the presentation the mission sketched — site name, address if available, station name — with **zero duplicated storage**: it is computed at read time from the existing `Site`/`ChargingStation` rows, never written anywhere new.

**Override field: explicitly not built.** Every real `WorkOrder` in this system is definitionally about one `ChargingStation`, which is definitionally at one `Site` — there is no scenario in the repository's current domain model (nor in any pilot `WorkOrder` so far) where a `WorkOrder`'s real-world visit location differs from its station's site. Building a nullable override column now would be exactly the kind of redundant field the mission explicitly warned against adding without justification. If a genuine need surfaces later (e.g., a `WorkOrder` type that isn't station-scoped at all), it's a new, separately-scoped decision — not a speculative column added today.

---

## 9. Resolution-summary strategy

**No schema change.** This maps directly onto the existing `resolve` transition's `comment` — already written to both `WorkOrder.notes` and the immutable `RESOLVED` event's `payload.comment`. The pilot's "OK" pattern is a UI/validation gap, not a missing field.

**Changes:**

1. **Relabel**, both in the resolve-input UI (`/my-work/[id]`'s `resolving` block) and wherever it's displayed afterward: field label → `Resumen de resolución`; helper text → `Describe brevemente qué se encontró, qué se hizo y el resultado final.` — verbatim, as ARGOS specified.
2. **Stays free text.** No structured sub-fields (separate "cause"/"action"/"outcome" inputs) — the mission explicitly warns against a bureaucratic form, and the helper text alone is enough steering without forcing structure onto a technician who may reasonably write one flowing sentence.
3. **Minimum sensible validation:** currently only "non-empty" (both client button-disable and server `BadRequestException`) — which is exactly how "OK" passed twice. Proposed: a soft minimum length (**~20 characters**, chosen to reliably reject "OK"/"listo"/"ok" while not blocking a genuinely short-but-real sentence), enforced identically client-side (inline hint, not a blocking error until submission) and server-side (in the `resolve`-transition validation, mirroring the existing empty-check). Not a word-count or rich-text requirement — deliberately the smallest change that closes the observed gap.
4. **Stays required.** Already required today (`resolve` throws without a comment) — no behavior change, just a stronger bar for what counts as "provided."
5. **Visually prominent when resolved:** currently folded into a generic "Notas" card indistinguishable from an ordinary mid-task comment. Proposed: once `status === 'RESOLVED'`, render it in its own labeled "Resumen de resolución" section (both `/work-orders/[id]` and `/my-work/[id]`), visually distinct from the "Notas" comment history — so a resolved `WorkOrder`'s closing explanation is the first thing an operator sees, not something to hunt for in a comment thread.

---

## 10. Operational-timeline strategy

**No new persisted duration field — everything here is computed at presentation time**, per the mission's own instruction to avoid storing what can be reliably derived.

Source mapping, all already-canonical:

| Displayed row  | Source                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| `PROGRAMADA`   | `WorkOrder.scheduledAt` (§7, if set)                                                                   |
| `LLEGADA`      | The `ARRIVAL_CONFIRMED` `WorkOrderEvent.createdAt` (already captured today)                            |
| `INICIO`       | `WorkOrder.startedAt` (already captured today)                                                         |
| `FINALIZACIÓN` | `WorkOrder.resolvedAt` (already captured today)                                                        |
| `DURACIÓN`     | Computed: `resolvedAt - startedAt` at render/presenter time, formatted (`Xh Ym` / `Xm`) — never stored |

**Implementation shape:** a small, pure presentation component/util (e.g. `workOrderTimelineSummary(workOrder, events)`), consuming data the pages already fetch — **no new API call**. This sits naturally next to the existing `WorkOrderEventTimeline` (which keeps rendering the full, canonical, immutable event log unchanged) as a compact summary above it, not a replacement for it. Canonical event history is fully preserved; this is a second, derived _view_ of data that already exists, exactly as instructed.

---

## 11. Migration / backward compatibility

- `WorkOrderAttachment` is an additive table — no effect on existing rows.
- `WorkOrder.scheduledAt` is added `NULL`-able with no default requiring backfill — all 3 existing pilot `WorkOrder`s (`PILOT-WO-01/02/03`) simply read `scheduledAt: null`, which the UI renders as "no scheduled visit," a true statement (none of them had one).
- `AttachmentKind` is a new enum — no existing enum is touched.
- **No existing column is renamed, retyped, or dropped.** `notes` and every `WorkOrderEvent.payload` shape are untouched — §9's UI relabel is presentation-only.
- **No existing event history is rewritten.** The three pilot `WorkOrder`s' 9/8/8 events remain exactly as persisted; nothing about this design reprocesses or migrates historical event payloads.
- **No production `WorkOrder` is deleted or recreated** by any part of this design — every proposed migration is `ADD COLUMN .. NULL` / `CREATE TABLE` only.

---

## 12. Test strategy

Before implementation is considered complete:

- **Schema/migration tests:** migration applies cleanly against a copy of production-shaped data (mirroring the same pre-flight grep-for-`DROP`/`TRUNCATE` discipline already used for every prior production migration in this engagement); confirms all 3 existing `WorkOrder`s remain fully readable with `scheduledAt: null` and zero attachments after migration.
- **API tests:**
  - `POST /my-work/:id/attachments/upload-url` — happy path issues a scoped signed URL; rejects invalid MIME (`400`); rejects oversized declared `fileSizeBytes` (`400`); rejects a `WorkOrder` not assigned to the caller (`404`, matching `getOwnWorkOrder`'s existing behavior).
  - `POST /my-work/:id/attachments` — rejects a `storagePath` that wasn't actually issued to this caller/`WorkOrder`.
  - Cross-tenant: a technician/operator from Organization B cannot read or mint an upload URL for Organization A's `WorkOrder` (extends the existing `technician-isolation.e2e-spec.ts` pattern from WO-ARGOS-037).
  - `scheduledAt` accepted on create, rejected if malformed ISO 8601; `PATCH /work-orders/:id/schedule` operator-only (technician `403`, matching every other operator-only route).
  - `resolve` transition: rejects a `comment` under the new minimum length with the same `BadRequestException` shape as the existing empty-check; existing "resolve requires a comment" test continues to pass unchanged.
  - Timeline: duration computation is correct across a resolved `WorkOrder` fixture, and `null` (not a garbage value) when `startedAt`/`resolvedAt` isn't yet set.
- **Regression (must not change):** existing `WorkOrderController`/`MyWorkController` unit and e2e suites (WO-ARGOS-037's 19 unit + 11 e2e security tests are the direct precedent) continue to pass unmodified — this is additive work, not a rewrite of the transition state machine or the tenant guards.

**Post-implementation:** per instruction, **one** controlled end-to-end regression `WorkOrder` (not another five-`WorkOrder` pilot) — created, scheduled, assigned, started, checklist recorded with at least one attachment, resolved with a real summary, timeline reviewed — run once, then cleaned up the same FK-safe way every prior controlled test in this engagement has been.

---

## 13. Phased implementation plan

| Phase                                           | Scope                                                                                                                    | Files/components likely affected                                                                                    | Schema/API impact                                                                | Risk                                                                      | Dependencies                                         | Human infra input                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| **A — Schema & storage setup**                  | `WorkOrderAttachment`/`AttachmentKind`, `WorkOrder.scheduledAt` migration; Blob store provisioning                       | `prisma/schema.prisma`, new migration; `env.validation.ts`                                                          | Additive schema only                                                             | Low                                                                       | None                                                 | **Yes** — Vercel Blob store + `MOVOS_BLOB_READ_WRITE_TOKEN` |
| **B — Backend API + authorization**             | Upload-URL issuance, attachment persistence/read endpoints, `PATCH /work-orders/:id/schedule`, resolve-length validation | `work-orders/` module (both controllers/services, new DTOs), presenters                                             | New routes, extended `CreateWorkOrderDto`, extended `applyTransition` validation | Medium (new auth-sensitive routes)                                        | Phase A                                              | No                                                          |
| **C — Operator scheduling/location UX**         | Scheduled-visit input + display, derived `visitLocation` display, attachment viewing                                     | `work-orders/page.tsx`, `work-orders/[id]/page.tsx`                                                                 | None (consumes Phase B)                                                          | Low                                                                       | Phase B                                              | No                                                          |
| **D — Technician mobile evidence UX**           | Camera/gallery/video attach controls in `ChecklistCard` and resolution flow, upload progress/preview                     | `my-work/[id]/page.tsx`                                                                                             | None (consumes Phase B)                                                          | Medium (mobile browser capability variance)                               | Phase B                                              | No                                                          |
| **E — Resolution/timeline UX**                  | "Resumen de resolución" relabel + prominence, timeline summary component                                                 | `my-work/[id]/page.tsx`, `work-orders/[id]/page.tsx`, `work-order-event-timeline.tsx` (or a new adjacent component) | None                                                                             | Low                                                                       | Phase B (validation), can start in parallel with C/D | No                                                          |
| **F — Regression + migration + controlled E2E** | Full regression suite run, production migration, the one controlled E2E `WorkOrder`                                      | N/A (validation phase)                                                                                              | Applies Phase A's migration to production                                        | Low (additive migration, established safe-deploy pattern from WO-040/043) | A–E complete                                         | No                                                          |

Sequence rationale: A unblocks everything (schema must exist before any API or UI can reference it); B is the single authorization-sensitive phase and is built and tested once, then C/D/E consume it in parallel since they don't depend on each other; F is the same "verify in production, one controlled test, clean up" discipline already proven three times in this engagement (WO-040, WO-043, and implicitly every pilot `WorkOrder` capture).

---

## 14. Acceptance criteria — `WORK_ORDER_V1_FIELD_READY`

A real field technician, using only MOVOS, can:

1. Receive a `WorkOrder` and see where they must go (derived site/station location, §8) and when they're expected (`scheduledAt`, if set, §7).
2. Start the job.
3. Capture diagnosis, attach at least one photo or video to that diagnosis (§3/§4).
4. Record intervention, optionally with its own evidence.
5. Validate the outcome, optionally with its own evidence.
6. Write a resolution summary that clears the new minimum-content bar (§9) — not "OK."
7. Resolve, leaving an event timeline that is unchanged in kind (still append-only, still canonical) but now optionally richer with attachments and a schedule.

And an operator, from MOVOS alone — no WhatsApp needed to reconstruct it — can determine:

- **WHO** — assignee, from the existing `assignedMemberName`.
- **WHAT** — diagnosis/intervention/validation/resolution text, unchanged mechanism, now with attached evidence.
- **WHERE** — derived `visitLocation` (§8).
- **WHEN** — `scheduledAt` (if set) plus the existing real timestamps, presented as a timeline summary (§10).
- **WHAT EVIDENCE** — attachment thumbnails/links per stage (§3/§4).
- **WHAT RESULT** — the prominent "Resumen de resolución" (§9), not a generic comment.

`WORK_ORDER_V1_FIELD_READY` is met when all of the above hold for the one controlled E2E `WorkOrder` (§12) **and** the full regression suite (existing + new tests from §12) passes.

---

## 15. Risks

- **Vercel Blob store provisioning is a human, account-level action** — Phase A cannot complete without it; flagged explicitly, not assumed.
- **Mobile browser camera/gallery capability varies** (iOS Safari vs. Android Chrome differ in `<input type="file" capture>` behavior) — Phase D needs real-device testing on both, not just desktop browser emulation.
- **A soft minimum-length resolution validation could still be gamed** ("asdfasdfasdfasdfasdf" clears 20 characters) — this closes the _specific_ observed gap (bare "OK") without pretending to guarantee genuine quality; a determined technician can still write a low-content note. Named honestly, not oversold as a complete fix.
- **Orphaned Blob uploads** are possible if a client uploads a file (step 4 of §4) but never calls the persistence endpoint (step 5) — a minor storage-cost housekeeping item, not a security concern (the orphaned file is unreferenced and unreachable without its signed URL); worth a future periodic sweep, not solved in this design.
- **Fixed-timezone display (`America/Bogota`)** is a real simplification that will need revisiting if MOVOS operates outside Colombia — named in §7, not hidden.
- **Rescheduling via a dedicated endpoint, separate from the transition state machine**, is a deliberate simplification that keeps `assertValidTransition` untouched — if a future requirement ties scheduling to status transitions more tightly, this endpoint boundary would need revisiting.

---

## 16. Explicit out-of-scope

Per the mission's own list, unchanged: route optimization, technician GPS tracking, live technician location, complex dispatch, recurring visits, technician calendar management, an SLA engine, inventory/spare parts, invoicing, customer signatures, a customer portal, push-notification architecture, driver-facing communication, OCPP implementation, AI diagnosis, automatic WorkOrder creation beyond what already exists (Rule 1/recommendations), advanced analytics, monitoring implementation, and any broader MOVOS redesign. Nothing in this design creates a dependency on any of these.

---

## 17. Human infrastructure inputs required

- **Vercel Blob store** — create the store resource in the existing `movos-web` Vercel project and provision `MOVOS_BLOB_READ_WRITE_TOKEN` as a `movos-api` environment variable on Railway. This is the only external resource this design requires; everything else (schema, API, UI) is code-only against infrastructure MOVOS already operates.

---

## Verdict

**`DESIGN_READY_FOR_ARGOS_REVIEW`**
