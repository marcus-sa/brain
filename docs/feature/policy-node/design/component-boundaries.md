# Policy Node -- Component Boundaries

## Module Structure

```
app/src/server/
  policy/                        # NEW module
    types.ts                     # Algebraic data types (pure, no imports from other modules)
    predicate-evaluator.ts       # Pure function: predicate evaluation against intent context
    policy-queries.ts            # SurrealDB adapter: graph traversal, lifecycle mutations
    policy-gate.ts               # Composition pipeline: load -> merge -> evaluate -> trace
  intent/                        # MODIFIED (existing)
    authorizer.ts                # Replace WorkspacePolicy stub with policy-gate call
    intent-routes.ts             # Pass identity+workspace to evaluateIntent
    types.ts                     # Add PolicyTraceEntry, extend EvaluationResult
    risk-router.ts               # Accept human_veto_required flag
  oauth/                         # MODIFIED (existing)
    audit.ts                     # Add policy-related AuditEventType values
```

## Dependency Graph

```
intent-routes.ts
  -> authorizer.ts
       -> policy/policy-gate.ts (NEW dependency)
            -> policy/policy-queries.ts (effect boundary: SurrealDB)
            -> policy/predicate-evaluator.ts (pure core)
            -> policy/types.ts (pure types)
       -> authorizer's LLM evaluator (unchanged)
  -> risk-router.ts (extended signature)
  -> oauth/audit.ts (extended types)
```

### Dependency Rules

1. `policy/types.ts` has zero imports from other modules -- pure algebraic types
2. `policy/predicate-evaluator.ts` imports only from `policy/types.ts` -- pure function, no DB, no effects
3. `policy/policy-queries.ts` imports from `policy/types.ts` + `surrealdb` SDK -- effect boundary
4. `policy/policy-gate.ts` composes the above three -- orchestration, still a pure pipeline returning a result value
5. `intent/authorizer.ts` calls `policy/policy-gate.ts` instead of inline `checkPolicyGate()` -- the old `WorkspacePolicy` type is removed
6. No circular dependencies: `policy/` never imports from `intent/`

## Component Responsibilities

### `policy/types.ts` -- Pure Domain Types

- `RulePredicate`: field + operator + value
- `RuleCondition`: single predicate or AND-array
- `PolicyRule`: id + condition + effect (allow|deny) + priority
- `PolicySelector`: workspace + agent_role + resource (all optional)
- `PolicyRecord`: full policy record shape (matches SurrealDB schema)
- `PolicyStatus`: discriminated union of lifecycle states
- `PolicyGateInput`: identity + workspace + intent context for gate evaluation
- `PolicyGateResult`: passed/failed + policy_trace + human_veto_required flag
- `PolicyTraceEntry`: policy_id + policy_version + rule_id + effect + matched + priority

### `policy/predicate-evaluator.ts` -- Pure Predicate Engine

- Receives: intent context object + single `RulePredicate`
- Resolves dot-path field references against intent context
- Applies operator (eq, neq, lt, lte, gt, gte, in, not_in, exists)
- Returns: boolean (matched or not)
- Missing fields return `false` (non-matching, fail-safe)
- No side effects, no DB access, no exceptions thrown

### `policy/policy-queries.ts` -- Effect Boundary (SurrealDB Adapter)

- `loadActivePolicies(surreal, identityId, workspaceId)` -- graph traversal query
- `createPolicy(surreal, params)` -- CREATE with validation
- `transitionPolicyStatus(surreal, policyId, newStatus)` -- lifecycle state machine
- `supersedePolicyVersion(surreal, oldPolicyId, newVersion)` -- atomic: create new + supersede old + move edges
- `removeEdgesOnDeprecation(surreal, policyId)` -- remove governing + protects edges
- `createPolicyAuditEvent(surreal, eventType, actor, workspace, policyId, version)` -- audit trail

### `policy/policy-gate.ts` -- Composition Pipeline

Orchestrates the evaluation pipeline as a composition of pure transformations:

```
loadActivePolicies(surreal, identity, workspace)    -- effect: DB read
  |> deduplicatePolicies                            -- pure: remove duplicates by ID
  |> collectAndSortRules                            -- pure: merge rules, sort by priority DESC
  |> evaluateRulesAgainstContext(intentContext)      -- pure: predicate evaluation per rule
  |> buildPolicyTrace                               -- pure: construct trace entries
  |> buildGateResult                                -- pure: first deny = reject, check veto flag
```

The pipeline returns a `PolicyGateResult` value. The single effect boundary is the initial `loadActivePolicies` call.

### `intent/authorizer.ts` -- Modified Integration Point

- Remove `WorkspacePolicy` type (replaced by `PolicyRecord[]`)
- Remove `checkPolicyGate()`, `checkBudgetCap()`, `checkActionAllowlist()` (replaced by `policy-gate.ts` pipeline)
- `EvaluateIntentInput` signature changes:

```
-- BEFORE --
type EvaluateIntentInput = {
  intent: { goal, reasoning, action_spec, budget_limit?, requester? }
  policy: WorkspacePolicy                   // always passed as {}
  llmEvaluator: LlmEvaluator
  timeoutMs?: number
}

-- AFTER --
type EvaluateIntentInput = {
  intent: { goal, reasoning, action_spec, budget_limit?, requester? }
  surreal: Surreal                          // DB connection for policy loading
  identityId: RecordId<"identity", string>  // requesting identity for governing edges
  workspaceId: RecordId<"workspace", string> // target workspace for protects edges
  requesterType: string                     // identity.type (human|agent)
  requesterRole?: string                    // identity.role (code_agent|architect|...)
  llmEvaluator: LlmEvaluator
  timeoutMs?: number
}
```

- `evaluateIntent()` implementation changes:
  1. Build `IntentEvaluationContext` from intent fields + requesterType/requesterRole
  2. Call `evaluatePolicyGate(surreal, identityId, workspaceId, intentContext)` from `policy/policy-gate.ts`
  3. If gate returns `{ passed: false }` -> return REJECT with policy_trace (skip LLM)
  4. If gate returns `{ passed: true }` -> continue to LLM tier, carry `human_veto_required` flag and `policy_trace`
  5. Return `EvaluationOutput` with `policy_trace` and `human_veto_required` attached

- `EvaluationOutput` extends with policy fields:

```
type EvaluationOutput = EvaluationResult & {
  policy_only: boolean
  policy_trace: PolicyTraceEntry[]       // NEW: always present (empty array if no policies)
  human_veto_required: boolean           // NEW: true if any policy forces veto
}
```

### `intent/intent-routes.ts` -- Call Site Change

The `handleEvaluate()` handler (SurrealQL EVENT callback) changes from:

```
// BEFORE (intent-routes.ts line ~84)
const result = await evaluateIntent({
  intent: { goal, reasoning, action_spec, budget_limit },
  policy: {},                              // always empty
  llmEvaluator,
})

// AFTER
const result = await evaluateIntent({
  intent: { goal, reasoning, action_spec, budget_limit },
  surreal: deps.surreal,
  identityId: intentRecord.requester,      // RecordId from intent record
  workspaceId: intentRecord.workspace,     // RecordId from intent record
  requesterType: identity.type,            // loaded from identity record
  requesterRole: identity.role,            // loaded from identity record
  llmEvaluator,
})
```

Note: `handleEvaluate()` already loads the intent record (which has `requester` and `workspace` RecordIds). It needs an additional query to load `identity.type` and `identity.role` from the requester identity.

### `intent/risk-router.ts` -- Extended Signature

- `routeByRisk()` accepts additional `human_veto_required: boolean` parameter
- When `human_veto_required = true` AND evaluation decision is APPROVE, force `veto_window` route regardless of risk_score

### Observation Creation for Missing Fields (AC-11)

When the predicate evaluator encounters a rule referencing a field that does not exist in the intent context:

1. `predicate-evaluator.ts` returns `false` (non-matching, fail-safe) -- this is the pure behavior
2. `policy-gate.ts` collects missing-field warnings during evaluation as `{ rule_id, field_path, policy_id }` tuples
3. `policy-gate.ts` returns these as `warnings: Array<{ rule_id: string, field: string, policy_id: string }>` on the `PolicyGateResult`
4. `intent-routes.ts` (the effect boundary) creates warning observations via the existing `createObservation()` graph query after receiving the gate result
5. This keeps the predicate evaluator and gate pipeline pure -- observation creation is an effect handled at the route handler level

### Concurrency: Version Conflict Resolution (NFR-5)

Policy updates create new immutable versions. The `supersedePolicyVersion()` query uses optimistic locking:

```sql
BEGIN TRANSACTION;
  -- Only supersede if current version matches expected
  LET $current = SELECT * FROM $policy WHERE status = 'active' AND version = $expected_version;
  -- If no match, another update already superseded this version
  IF array::len($current) = 0 {
    THROW "Policy version conflict: expected version " + <string>$expected_version + " but policy was already superseded";
  };
  -- Create new version
  CREATE policy CONTENT {
    title: $title, version: $expected_version + 1, status: 'active',
    supersedes: $policy, ...
  };
  -- Supersede old version
  UPDATE $policy SET status = 'superseded', updated_at = time::now();
  -- Move edges from old to new version
  -- (governing and protects edges re-pointed to new policy record)
COMMIT TRANSACTION;
```

On conflict (THROW), the caller retries by re-reading the latest version. Since each version is immutable, no data is lost -- the second admin's changes apply to the latest committed version.

## Interface Contracts

### Policy Gate Input/Output

```
Input:
  surreal: Surreal              -- DB connection (effect boundary)
  identityId: RecordId           -- requesting agent/human identity
  workspaceId: RecordId          -- target workspace
  intentContext: object          -- flattened intent fields for predicate evaluation

Output (PolicyGateResult):
  | { passed: true, policy_trace: PolicyTraceEntry[], human_veto_required: boolean }
  | { passed: false, reason: string, policy_trace: PolicyTraceEntry[], deny_rule_id: string }
```

### Predicate Evaluator Input/Output

```
Input:
  context: Record<string, unknown>   -- flattened intent evaluation context
  predicate: RulePredicate           -- { field, operator, value }

Output: boolean                      -- true if predicate matches
```

## Graph Query Patterns

### Load Active Policies (FR-3)

```sql
-- Identity-linked policies
LET $identity_policies = SELECT ->governing->policy.* AS policies
  FROM $identity;

-- Workspace-linked policies
LET $workspace_policies = SELECT <-protects<-policy.* AS policies
  FROM $workspace;

-- Filter active only (application layer dedupes by ID)
```

### Atomic Activation + Edge Creation (NFR-2)

```sql
BEGIN TRANSACTION;
  UPDATE $policy SET status = 'active', updated_at = time::now();
  RELATE $creator->governing->$policy SET created_at = time::now();
  RELATE $policy->protects->$workspace SET created_at = time::now();
COMMIT TRANSACTION;
```

### Deprecation with Edge Removal (FR-5)

```sql
BEGIN TRANSACTION;
  UPDATE $policy SET status = 'deprecated', updated_at = time::now();
  DELETE governing WHERE out = $policy;
  DELETE protects WHERE in = $policy;
COMMIT TRANSACTION;
```
