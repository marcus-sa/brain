# Policy Node — Definition of Ready Checklist

## DoR Items

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | **User stories defined** | PASS | `user-stories.md` — 10 stories, each traced to a JTBD job |
| 2 | **Acceptance criteria testable** | PASS | `acceptance-criteria.md` — AC-1 through AC-12, all in Given/When/Then format. Rule conditions use structured JSON predicates (not ambiguous strings). |
| 3 | **JTBD analysis complete** | PASS | `jtbd-job-stories.md` — 4 jobs with functional/emotional/social dimensions |
| 4 | **Four Forces mapped** | PASS | `jtbd-four-forces.md` — Push/Pull/Anxiety/Habit for each job |
| 5 | **Journey mapped with emotional arcs** | PASS | `journey-policy-lifecycle-visual.md` — 5 phases, 12 steps, emotional arc diagram |
| 6 | **Shared artifacts documented** | PASS | `shared-artifacts-registry.md` — 6 artifacts with source/consumer/type/persistence + IntentEvaluationContext type documenting all fields available to rule conditions |
| 7 | **Dependencies identified** | PASS | See Dependencies below |
| 8 | **Size estimated** | PASS | See Story sizes in `user-stories.md` (XS to M, no L/XL) |

## Peer Review Resolution

| Issue (from nw-product-owner-reviewer) | Severity | Resolution |
|----------------------------------------|----------|------------|
| Intent object fields not documented | CRITICAL | **FIXED** — Added FR-1b (intent fields table) + IntentEvaluationContext type in shared-artifacts-registry |
| Rule condition format undefined | CRITICAL | **FIXED** — Added FR-1a (structured JSON predicates with RulePredicate type, examples, evaluator spec) |
| Missing authorization model for policy CRUD | HIGH | **FIXED** — Added FR-8 (human-only CRUD, agent read-only) + AC-12 |
| Concurrent modification handling | HIGH | **FIXED** — Added NFR-5 (optimistic concurrency via immutable versions, last-write-wins) |
| Scalability bounds not defined | HIGH | **FIXED** — Added NFR-4 (100 policies/workspace, 10k total, <100ms at scale) |
| Policy trace denormalization unclear | MEDIUM | **FIXED** — AC-7 now specifies: IDs only in trace, policy titles via join at display time |
| Rule condition error handling missing | MEDIUM | **FIXED** — Added AC-11 (missing field → non-matching, malformed condition → validation error) |

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| `intent` table (0021_intent_node.surql) | EXISTS | Policy extends the existing evaluation pipeline |
| `audit_event` table (0022_oauth_rar_dpop.surql) | EXISTS | Policy lifecycle events extend the existing ASSERT |
| `identity` table (0017 hub-spoke) | EXISTS | `governing` edges connect identity → policy |
| `workspace` table | EXISTS | `protects` edges connect policy → workspace |
| `evaluateIntent()` in `authorizer.ts` | EXISTS | Policy gate replaces the `checkPolicyGate()` stub |
| `authority_scope` seeds (0021) | EXISTS | Policy node is orthogonal to authority_scope (different concern) |

## Risks

| Risk | Mitigation |
|------|------------|
| Graph traversal latency on large policy sets | Index on `policy.status`; NFR-4 bounds at 100/workspace; benchmark |
| Rule predicate expressiveness | Start with 9 operators (eq/neq/lt/lte/gt/gte/in/not_in/exists); defer complex expressions |
| Policy conflict at activation time | Out of scope for Phase 1; document as future US |
| Concurrent policy updates | NFR-5: immutable versions, last-write-wins with version sequencing |

## Handoff Readiness

- **Next wave**: DESIGN (nw-solution-architect)
- **Deliverables ready**: JTBD artifacts, journey artifacts, requirements (FR-1 through FR-8, NFR-1 through NFR-5), acceptance criteria (AC-1 through AC-12), this DoR checklist
- **Key decision resolved**: Rule condition format is structured JSON predicates (`{ field, operator, value }`) evaluated by safe TypeScript function without `eval()`. See FR-1a.
- **Remaining design decisions**: SurrealDB schema for storing JSON predicates (object vs flexible object), policy loading query optimization (single query vs two-step)
