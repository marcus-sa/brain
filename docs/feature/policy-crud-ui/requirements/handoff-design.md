# Policy CRUD UI -- DESIGN Wave Handoff Package

**Feature**: policy-crud-ui (GitHub Issue #130)
**Source Wave**: DISCUSS
**Target Wave**: DESIGN (solution-architect)
**Date**: 2026-03-14
**Status**: All 8 stories pass DoR. Ready for handoff.

---

## Handoff Summary

This package contains everything the solution-architect needs to design the implementation for the Policy CRUD UI feature. The feature adds HTTP API endpoints and a web management UI for the existing policy infrastructure (SurrealDB schema, evaluation pipeline, graph relations).

## Artifact Index

### JTBD Analysis (docs/ux/policy-crud-ui/)
| File | Description |
|------|-------------|
| `jtbd-job-stories.md` | 4 job stories with dimensions and 8-step job maps |
| `jtbd-four-forces.md` | Four Forces analysis per job with switch assessments |
| `jtbd-opportunity-scores.md` | Opportunity scoring with ranked outcome statements |
| `personas.md` | 3 personas (Reiko/Admin, Marcus/Reviewer, Ayumi/Auditor) with job step tables |

### Journey Design (docs/ux/policy-crud-ui/)
| File | Description |
|------|-------------|
| `journey-policy-management-visual.md` | ASCII journey map with mockups, emotional arc, error paths |
| `journey-policy-management.yaml` | Structured journey schema with shared artifacts and integration checkpoints |
| `journey-policy-management.feature` | 30 Gherkin scenarios covering all 4 jobs |
| `shared-artifacts-registry.md` | All tracked artifacts with sources, consumers, and consistency checks |

### Requirements (docs/feature/policy-crud-ui/requirements/)
| File | Description |
|------|-------------|
| `requirements.md` | Functional/non-functional requirements, business rules, risk assessment, dependencies |
| `US-PCUI-01-policy-list-view.md` | Policy list table with status filters and empty state |
| `US-PCUI-02-create-policy.md` | Policy creation form with structured rule builder |
| `US-PCUI-03-policy-detail-view.md` | Policy detail with rules, edges, version history |
| `US-PCUI-04-activate-deprecate-policy.md` | Lifecycle transitions with confirmation dialogs |
| `US-PCUI-05-create-new-version.md` | Version creation with pre-population and supersede |
| `US-PCUI-06-policy-trace-in-review.md` | Policy trace rendering in intent review screen |
| `US-PCUI-07-version-history-and-diff.md` | Version timeline and structured diff view |
| `US-PCUI-08-agent-authorization.md` | Identity type enforcement on mutation endpoints |
| `dor-validation.md` | DoR validation for all 8 stories (all PASSED) |

## Implementation Priority

```
Phase 1 (Must Have -- ~5-7 days):
  US-PCUI-08  Agent Authorization           (0.5-1d)  -- gate before any endpoints
  US-PCUI-01  Policy List View              (1-2d)    -- navigation entry point
  US-PCUI-02  Create Policy + Rule Builder  (1-2d)    -- core creation flow
  US-PCUI-04  Activate/Deprecate            (1d)      -- lifecycle management
  US-PCUI-03  Policy Detail View            (1-2d)    -- central hub page

Phase 2 (Must Have -- ~2-3 days):
  US-PCUI-05  Create New Version            (1-2d)    -- versioning
  US-PCUI-06  Policy Trace in Review        (1-2d)    -- reviewer experience

Phase 3 (Should Have -- ~1-2 days):
  US-PCUI-07  Version History + Diff        (1-2d)    -- audit/compliance
```

## Key Design Decisions for Solution Architect

### 1. API Endpoints (6 endpoints)
```
GET    /api/workspaces/:wsId/policies              -- list (with ?status= filter)
POST   /api/workspaces/:wsId/policies              -- create (draft)
GET    /api/workspaces/:wsId/policies/:pId          -- detail (with edges + versions)
PATCH  /api/workspaces/:wsId/policies/:pId/activate -- draft -> active
PATCH  /api/workspaces/:wsId/policies/:pId/deprecate -- active -> deprecated
POST   /api/workspaces/:wsId/policies/:pId/versions -- create new version (draft)
```

### 2. Existing Code to Reuse
- `createPolicy()`, `activatePolicy()`, `deprecatePolicy()` from `policy-queries.ts`
- `createPolicyAuditEvent()` for lifecycle event logging
- `PolicyRecord`, `PolicyRule`, `PolicyTraceEntry` types from `policy/types.ts`
- Learning Library UI patterns (StatusTabs, LearningList, CreateDialog, etc.)
- DiffViewer from review page for version comparison
- EntityDetailPanel layout patterns for policy detail page

### 3. Existing Code to Modify
- `activatePolicy()` needs enhancement: check for supersedes, handle old version transition atomically
- Consent endpoint needs enhancement: resolve and return policy titles/versions alongside trace
- `WorkspaceSidebar.tsx`: add "Policies" navigation item
- `router.tsx`: add policy routes

### 4. New Code Required
- Policy route handlers (6 endpoints)
- Policy list page component
- Policy detail page component
- Policy create/edit form component
- Rule builder component
- Policy trace section component (for intent review)
- Version diff component
- Hooks: use-policies, use-policy-detail, use-policy-actions

### 5. High-Risk Integration Points
- **PolicyTraceEntry schema**: written by authorizer, read by review UI -- must stay in sync
- **Known fields for rule builder**: derived from IntentEvaluationContext -- must stay in sync with predicate evaluator
- **Supersedes chain atomicity**: activating a new version must atomically supersede the old one in a single transaction

### 6. Constraints from AGENTS.md
- Functional paradigm (pure functions, composition)
- No null (use optional properties)
- RecordId objects in server code (raw UUIDs at API boundary)
- SCHEMAFULL tables (no schema changes needed -- policy table already exists)
- Fail fast on contract violations
- --no-verify -s for commits

## Open Questions (Red Cards)

None -- all questions resolved during discovery. The existing backend infrastructure (schema, types, query functions) provides clear answers for the design phase.

## Prior Art Reference

The original policy-node JTBD and journey analysis lives at `docs/ux/policy-node/`. This feature builds on that foundation, adding the human-facing API and UI surface for phases already mapped (DEFINE, REVIEW, EVOLVE, AUDIT).
