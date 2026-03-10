# Policy Node -- Walking Skeleton

## Skeleton Paths

### Skeleton 1: Policy Deny Blocks Intent Before LLM Tier

**Traces:** US-4 (Graph Traversal), US-5 (Rule Evaluation), US-7 (Policy Trace)

```
Human admin creates policy with deny rule for "deploy" actions
  -> Policy activated with governing + protects graph edges
  -> Agent submits intent with action_spec.action = "deploy"
  -> Policy gate loads active policies via graph traversal
  -> Deny rule matches at priority 100 -> short-circuit REJECT
  -> Intent marked as vetoed with policy_only = true
  -> Policy trace recorded: [{ rule_id: "no_deploy", matched: true, effect: "deny" }]
  -> LLM tier is never called
```

**What it proves:**
- Policy schema works (SCHEMAFULL table with rules, selector, status)
- Graph edges (governing, protects) connect identity/workspace to policies
- Graph traversal loads active policies at evaluation time
- Deny rules short-circuit the pipeline deterministically
- Policy trace is persisted on the intent evaluation

### Skeleton 2: Empty Policy Set Preserves Backward Compatibility

**Traces:** US-9 (Backward Compatibility)

```
Workspace has NO active policies
  -> Agent submits intent
  -> Policy gate loads policies -> empty set
  -> Empty set = pass (no deny = no constraint)
  -> Intent proceeds to LLM tier evaluation
  -> LLM evaluates and approves
  -> policy_only = false, policy_trace = []
```

**What it proves:**
- Existing workspaces without policies continue to function unchanged
- Empty policy set does not block or alter the evaluation pipeline
- Policy trace is empty (not missing) for backward compatibility

## Implementation Order

1. **Schema first** -- `policy` table + `governing`/`protects` relation tables (migration 0024)
2. **Test kit** -- `policy-test-kit.ts` helpers for creating/activating/loading policies
3. **Walking skeleton tests** -- Both paths passing with simulated policy gate
4. **Predicate evaluator** -- Pure function (unit-testable, no DB)
5. **Policy gate pipeline** -- Composition: load -> merge -> evaluate -> trace -> result
6. **Wire into authorizer** -- Replace `checkPolicyGate()` with real policy gate call

## Driving Ports

| Port | Type | Walking Skeleton Coverage |
|------|------|--------------------------|
| Direct DB (policy CRUD) | Adapter | Skeleton 1: create + activate |
| Graph traversal query | Adapter | Skeleton 1: load active policies |
| Intent evaluation pipeline | Orchestrator | Both skeletons: policy gate + status update |
| Policy trace persistence | Adapter | Skeleton 1: trace on intent.evaluation |

## @skip Tags for Incremental Implementation

All milestone tests start with `@skip` (Bun: `it.skip`) and are unskipped one-at-a-time as the implementation progresses:

```
walking-skeleton.test.ts          -- Unskip first (proves end-to-end wiring)
milestone-1-schema-and-lifecycle   -- Unskip after schema migration
milestone-2-policy-gate-evaluation -- Unskip after policy-gate.ts pipeline
milestone-3-audit-and-authorization -- Unskip after audit + authorization model
```
