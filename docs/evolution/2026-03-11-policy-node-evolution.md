# Policy Node: Graph-Based Governance for Intent Authorization

**Date**: 2026-03-11
**Feature**: policy-node
**Wave**: DELIVER (complete)

## Summary

Implemented persistent policy records in SurrealDB connected to identities and workspaces via graph edges (`governing`, `protects`). The authorizer traverses the policy graph at intent evaluation time, applying structured predicate rules deterministically before the LLM evaluation tier runs.

## Architecture

```
Intent Evaluation Pipeline:
  evaluateIntent()
    → evaluatePolicyGate(surreal, identity, workspace, context)
        → loadActivePolicies()          [effect: DB graph traversal]
        → deduplicatePolicies()         [pure]
        → collectAndSortRules()         [pure: priority DESC]
        → evaluateRulesAgainstContext()  [pure: predicate engine]
        → buildGateResult()             [pure: first deny = reject]
    → LLM evaluator (if policy passes)
    → routeByRisk(result, { humanVetoRequired })
```

**Key design decisions:**
- Single effect boundary (DB read) followed by pure functional pipeline
- Deny short-circuit: first matching deny rule stops evaluation
- `human_veto_required` flag on any active policy forces veto_window route
- 9 comparison operators with dot-path resolution for nested context fields
- Empty policy set = auto-pass (backward compatible)

## Files Created

| File | Purpose |
|------|---------|
| `schema/migrations/0024_policy_node.surql` | SurrealDB schema: policy table, governing/protects relations |
| `schema/migrations/0025_policy_condition_union_type.surql` | Fix condition field to accept object or array |
| `app/src/server/policy/types.ts` | Algebraic types: PolicyRecord, PolicyGateResult, etc. |
| `app/src/server/policy/predicate-evaluator.ts` | Pure predicate engine with 9 operators |
| `app/src/server/policy/policy-queries.ts` | SurrealDB graph adapter for policy CRUD |
| `app/src/server/policy/policy-gate.ts` | Functional composition pipeline |

## Files Modified

| File | Change |
|------|--------|
| `schema/surreal-schema.surql` | Added policy table, relations, intent extensions |
| `app/src/server/intent/authorizer.ts` | Replaced stubs with real policy gate integration |
| `app/src/server/intent/intent-routes.ts` | Pass surreal/identity/workspace to evaluateIntent |
| `app/src/server/intent/risk-router.ts` | Added humanVetoRequired option |
| `app/src/server/intent/types.ts` | Extended IntentRecord with policy_trace |
| `app/src/server/oauth/audit.ts` | Added policy audit event types |

## Test Coverage

- **24 acceptance tests** across 4 suites (walking skeleton, milestone 1-3)
- **38 unit tests** (predicate-evaluator: 24, policy-gate: 14)
- **68 intent unit tests** (authorizer: 7, risk-router: 12, existing)
- **Total: 130 tests, all passing**

## Execution Log

5 TDD steps completed:
1. `01-01`: Schema migration and type definitions
2. `01-02`: Predicate evaluator with unit tests
3. `02-01`: SurrealDB query adapter
4. `02-02`: Policy gate functional pipeline
5. `03-01`: Authorizer integration, risk router, audit

## Review Findings Addressed

- D4: Null check in resolveDotPath now throws on contract violation
- D7: Cached Date.now() in routeByRisk for deterministic veto expiry
- D8: LLM failure reason includes error message for observability
