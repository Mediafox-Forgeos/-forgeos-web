# Architecture Documentation

This directory contains long-form architecture documents that describe the design, structure, and rationale behind MediaFOX Forge systems. These documents go deeper than ADRs — they explain the full design, not just the decision point.

---

## Documents

| Document | Description |
| --- | --- |
| [MONOREPO.md](./MONOREPO.md) | pnpm monorepo structure, package boundaries, dependency direction rules, and Vercel deployment configuration |

---

## Planned Documents

| Document | Description |
| --- | --- |
| Backend Architecture | Supabase schema design, Row Level Security strategy, and API layer overview |
| Multi-Tenancy Model | Tenant isolation boundaries, RLS policies, and operator provisioning model |
| ARGOS Architecture | AI orchestration design: context injection, tool permissions, conversation persistence, and streaming model |
| EV Platform Architecture | OCPP integration layer, charging session lifecycle, and billing architecture |
| Authentication & Authorization | Session model, route protection strategy, and permission hierarchy |

---

## Relationship to ADRs

Architecture documents in this directory explain the *how* and *why* in depth. Formal decision records live in [`docs/adr/`](../adr/). When a document here represents a significant decision, it should have a corresponding ADR.

*Owner: VULCAN | Reviewed by: SENTINEL*
