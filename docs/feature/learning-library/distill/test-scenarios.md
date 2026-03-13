# Learning Library -- Test Scenarios

## Test Strategy

### Scope Boundary

This test suite (`tests/acceptance/learning-library/`) covers the **Learning Library UI feature** -- the user-facing page for browsing, filtering, editing, and managing learnings. It focuses on NEW behavior introduced by this feature:

- **Filter combinations** (status + type + agent simultaneously)
- **PUT /learnings/:id** endpoint (edit text, priority, target_agents on active learnings)
- **Full lifecycle** journeys (create -> edit -> deactivate)
- **Agent targeting** at creation time and its effect on filtered views

### What is Already Tested (in `tests/acceptance/agent-learnings/`)

| Capability | Covered In |
|---|---|
| Schema, CRUD, status transitions | milestone-1 |
| JIT loader, token budgeting | milestone-2 |
| Prompt injection | milestone-3 |
| HTTP create, single-param list, approve, dismiss, deactivate, feed | milestone-4 |
| Pattern detection | milestone-5 |
| Collision detection | milestone-6 |
| Basic E2E (create -> persist -> load) | walking-skeleton |

This suite does NOT duplicate any of the above.

## Milestone Breakdown

### Walking Skeleton (`walking-skeleton.test.ts`)

Single test exercising the minimum viable learning library path:

1. Create workspace
2. Create 3 learnings (different types, statuses, agents)
3. List all -- verify count
4. Filter by status -- verify subset
5. Filter by agent -- verify subset
6. (BLOCKED) Edit text on active learning -- verify updated
7. Deactivate active learning -- verify status change
8. List active -- verify count decremented

**Status**: Partially runnable. Edit step blocked on PUT endpoint.

### Milestone 1: Browse & Filter (`milestone-1-browse-filter.test.ts`)

| # | Scenario | Type | Status |
|---|---|---|---|
| 1 | Filter by status + type simultaneously | Happy | Runnable |
| 2 | Filter by status + agent | Happy | Runnable |
| 3 | Triple filter: status + type + agent | Happy | Runnable |
| 4 | Valid filter matching nothing returns empty list | Edge | Runnable |
| 5 | Non-matching agent filter returns empty list | Edge | Runnable |
| 6 | Status tab counts across all statuses | Happy | Runnable |
| 7 | Empty target_agents visible to all agent filters | Happy | Runnable |
| 8 | Empty workspace returns empty list | Edge | Runnable |

**Error ratio**: 3/8 (37.5%) -- edge/error scenarios

### Milestone 2: Edit Active Learnings (`milestone-2-edit-learning.test.ts`)

| # | Scenario | Type | Status |
|---|---|---|---|
| 1 | Edit text of active learning | Happy | BLOCKED (PUT) |
| 2 | Edit priority of active learning | Happy | BLOCKED (PUT) |
| 3 | Edit target_agents narrows visibility | Happy | BLOCKED (PUT) |
| 4 | Edit multiple fields at once | Happy | BLOCKED (PUT) |
| 5 | Edit pending learning rejected | Error | BLOCKED (PUT) |
| 6 | Edit deactivated learning rejected | Error | BLOCKED (PUT) |
| 7 | Edit dismissed learning rejected | Error | BLOCKED (PUT) |
| 8 | Edit with empty text rejected | Error | BLOCKED (PUT) |
| 9 | Edit with whitespace-only text rejected | Error | BLOCKED (PUT) |
| 10 | Edit non-existent learning returns not found | Error | BLOCKED (PUT) |
| 11 | Edit with no fields is no-op or rejected gracefully | Edge | BLOCKED (PUT) |
| 12 | Text edit regenerates embedding | Edge | BLOCKED (PUT) |

**Error ratio**: 6/12 (50%)

### Milestone 3: Full Lifecycle (`milestone-3-full-lifecycle.test.ts`)

| # | Scenario | Type | Status |
|---|---|---|---|
| 1 | Targeted learning visible only to specified agents | Happy | Runnable |
| 2 | Universal learning (empty agents) visible to all | Happy | Runnable |
| 3 | Deactivated learning disappears from active views | Happy | Runnable |
| 4 | Full lifecycle: create -> edit -> deactivate | Happy | BLOCKED (PUT) |
| 5 | Multiple learnings managed independently | Happy | Runnable |
| 6 | Double deactivation rejected | Error | Runnable |
| 7 | Deactivating dismissed learning rejected | Error | Runnable |

**Error ratio**: 2/7 (29%)

## Aggregate Metrics

| Metric | Value |
|---|---|
| Total scenarios | 29 (including walking skeleton) |
| Runnable now | 17 |
| Blocked on PUT endpoint | 12 |
| Happy path scenarios | 15 |
| Error/edge scenarios | 14 |
| **Error ratio** | **48%** (exceeds 40% target) |
| Walking skeletons | 1 |

## Traceability Matrix

| User Story | Test File | Scenario #s |
|---|---|---|
| US-LL-01 (Browse & Filter) | milestone-1-browse-filter | 1-8 |
| US-LL-01 (Browse & Filter) | walking-skeleton | steps 3-5 |
| US-LL-02 (Inline Pending Actions) | -- | Already covered in agent-learnings/milestone-4 |
| US-LL-03 (Edit/Deactivate) | milestone-2-edit-learning | 1-12 |
| US-LL-03 (Edit/Deactivate) | milestone-3-full-lifecycle | 3-4, 6-7 |
| US-LL-03 (Edit/Deactivate) | walking-skeleton | steps 6-8 |
| US-LL-04 (Create with Targeting) | milestone-3-full-lifecycle | 1-2, 5 |
| US-LL-04 (Create with Targeting) | walking-skeleton | step 2 |

## Driving Ports

All tests invoke through HTTP endpoints (driving ports) only:

| Port | Method | Tests |
|---|---|---|
| `/api/workspaces/:id/learnings` | POST | Create scenarios |
| `/api/workspaces/:id/learnings` | GET | All browse/filter/count scenarios |
| `/api/workspaces/:id/learnings/:id` | PUT | All edit scenarios (BLOCKED) |
| `/api/workspaces/:id/learnings/:id/actions` | POST | Deactivate scenarios |

SurrealDB direct queries are used only for seed data (Given steps) and outcome verification (Then steps), never as the system under test.

## Implementation Sequence

1. Run milestone-1 and milestone-3 (runnable tests) to validate existing behavior
2. Implement PUT `/api/workspaces/:id/learnings/:id` endpoint
3. Unskip milestone-2 tests one at a time, implementing each
4. Unskip lifecycle test in milestone-3
5. Uncomment walking skeleton edit step
