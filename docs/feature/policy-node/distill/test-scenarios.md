# Policy Node -- Test Scenarios

## Test Suite Overview

| File | Traces | Scenarios | Focus |
|------|--------|-----------|-------|
| `walking-skeleton.test.ts` | US-4, US-5, US-7, US-9 | 2 | E2E: deny blocks intent; empty set passes |
| `milestone-1-schema-and-lifecycle.test.ts` | US-1, US-2, US-3, US-10 | 8 | Schema enforcement, lifecycle, graph edges, versioning |
| `milestone-2-policy-gate-evaluation.test.ts` | US-4, US-5, US-6, US-9 | 7 | Graph traversal, rule engine, veto override, backward compat |
| `milestone-3-audit-and-authorization.test.ts` | US-7, US-8, AC-11, AC-12 | 7 | Trace, audit events, error handling, authorization model |
| **Total** | | **24** | |

## User Story Coverage Matrix

| Story | AC | Tests | File |
|-------|----|-------|------|
| US-1: Create Policy Record | AC-1 | 3 | milestone-1 |
| US-2: Policy Lifecycle | AC-2 | 2 | milestone-1 |
| US-3: Graph Relations | AC-3 | 2 | milestone-1 |
| US-4: Policy Gate Traversal | AC-4 | 2 | milestone-2 |
| US-5: Rule Evaluation Engine | AC-5 | 3 | milestone-2 |
| US-6: Human Veto Gate | AC-6 | 1 | milestone-2 |
| US-7: Policy Evaluation Trace | AC-7 | 2 | milestone-3 |
| US-8: Audit Event Extensions | AC-8 | 1 | milestone-3 |
| US-9: Backward Compatibility | AC-9 | 2 | skeleton + milestone-2 |
| US-10: Version Immutability | AC-10 | 1 | milestone-1 |
| AC-11: Missing Field Handling | AC-11 | 1 | milestone-3 |
| AC-12: Authorization Model | AC-12 | 2 | milestone-3 |
| FR-1a: AND-Joined Conditions | - | 1 | milestone-3 |

## Scenario Details

### Walking Skeleton

1. **Deny policy blocks deploy intent** (US-4, US-5, US-7)
   - Given: Active deny policy targeting `action_spec.action == "deploy"`
   - When: Agent submits deploy intent
   - Then: Rejected by policy gate (policy_only=true), trace recorded

2. **Empty policy set passes through** (US-9)
   - Given: No active policies in workspace
   - When: Agent submits intent
   - Then: Passes to LLM tier, policy_trace empty

### Milestone 1: Schema & Lifecycle

3. **Creates policy with all required fields** (US-1, AC-1)
4. **Rejects invalid rule effect** (US-1, AC-1)
5. **Rejects invalid status** (US-1, AC-1)
6. **Activates draft policy with graph edges** (US-2, AC-2)
7. **Deprecation removes graph edges** (US-2, AC-2)
8. **Governing edge has created_at** (US-3, AC-3)
9. **Protects edge has created_at** (US-3, AC-3)
10. **New version supersedes old** (US-10, AC-10)

### Milestone 2: Policy Gate Evaluation

11. **Loads policies from identity + workspace edges** (US-4, AC-4)
12. **Excludes deprecated policies** (US-4, AC-4)
13. **Deny at priority 100 short-circuits** (US-5, AC-5)
14. **Allow rules pass when no deny** (US-5, AC-5)
15. **No match = pass** (US-5, AC-5)
16. **human_veto_required forces veto window** (US-6, AC-6)
17. **Empty policy set = pass** (US-9, AC-9)

### Milestone 3: Audit & Authorization

18. **Trace contains entries for all rules** (US-7, AC-7)
19. **Trace contains IDs only, no denormalized titles** (US-7, AC-7)
20. **Lifecycle events produce audit_event records** (US-8, AC-8)
21. **Missing field returns false, evaluation continues** (AC-11)
22. **Human identity can create policies** (AC-12)
23. **Agent identity type stored for enforcement** (AC-12)
24. **AND-joined conditions match only when all true** (FR-1a)

## Test Infrastructure

### Policy Test Kit (`policy-test-kit.ts`)

Extends `intent-test-kit.ts` with policy-specific helpers:

| Helper | Purpose |
|--------|---------|
| `createPolicy()` | Given-step: creates policy record in DB |
| `activatePolicy()` | Atomic: status + governing + protects edges |
| `deprecatePolicy()` | Atomic: status + remove all edges |
| `getPolicyRecord()` | Query full policy record |
| `loadActivePoliciesForIdentity()` | Graph traversal (production mirror) |
| `simulatePolicyGateResult()` | Sets evaluation + trace on intent |
| `createPolicyAuditEvent()` | Records audit event for policy lifecycle |
| `getAuditEventsForPolicy()` | Queries audit events by policy ID |
| `createPolicyVersion()` | Creates new version, supersedes old |

### Test Isolation

Each test file boots an isolated SurrealDB namespace/database via `setupOrchestratorSuite()`. No cross-test contamination.

## Handoff to DELIVER Wave

The nw-software-crafter should implement in this order:

1. **Schema migration** (`0024_policy_node.surql`) -- enables milestone-1 tests
2. **Types** (`policy/types.ts`) -- pure algebraic types
3. **Predicate evaluator** (`policy/predicate-evaluator.ts`) -- pure function, unit-testable
4. **Policy queries** (`policy/policy-queries.ts`) -- SurrealDB adapter
5. **Policy gate pipeline** (`policy/policy-gate.ts`) -- composition pipeline
6. **Authorizer integration** -- replace `checkPolicyGate()` with real gate
7. **Risk router extension** -- accept `human_veto_required` flag
8. **Audit extensions** -- add policy event types to `audit_event`

Each step should make progressively more acceptance tests pass.
