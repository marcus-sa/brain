# Policy Node -- Data Models

## SurrealDB Schema

### Policy Table

```sql
DEFINE TABLE policy SCHEMAFULL;
DEFINE FIELD title ON policy TYPE string;
DEFINE FIELD description ON policy TYPE option<string>;
DEFINE FIELD version ON policy TYPE int ASSERT $value > 0;
DEFINE FIELD status ON policy TYPE string
  ASSERT $value IN ['active', 'draft', 'deprecated', 'testing', 'superseded'];
DEFINE FIELD selector ON policy TYPE object;
DEFINE FIELD selector.workspace ON policy TYPE option<string>;
DEFINE FIELD selector.agent_role ON policy TYPE option<string>;
DEFINE FIELD selector.resource ON policy TYPE option<string>;
DEFINE FIELD rules ON policy TYPE array<object>;
DEFINE FIELD rules[*].id ON policy TYPE string;
DEFINE FIELD rules[*].condition ON policy TYPE object FLEXIBLE;
DEFINE FIELD rules[*].effect ON policy TYPE string ASSERT $value IN ['allow', 'deny'];
DEFINE FIELD rules[*].priority ON policy TYPE int;
DEFINE FIELD human_veto_required ON policy TYPE bool DEFAULT false;
DEFINE FIELD max_ttl ON policy TYPE option<string>;
DEFINE FIELD created_by ON policy TYPE record<identity>;
DEFINE FIELD workspace ON policy TYPE record<workspace>;
DEFINE FIELD supersedes ON policy TYPE option<record<policy>>;
DEFINE FIELD created_at ON policy TYPE datetime;
DEFINE FIELD updated_at ON policy TYPE option<datetime>;
DEFINE INDEX policy_status ON policy FIELDS status;
DEFINE INDEX policy_workspace ON policy FIELDS workspace;
DEFINE INDEX policy_workspace_status ON policy FIELDS workspace, status;
```

**Design decisions:**

- `rules[*].condition` is `object FLEXIBLE` because conditions are structured JSON predicates with variable shapes (single predicate vs AND-array). Validation occurs at the application layer via Zod before persistence.
- `selector` fields are all optional -- a policy with empty selector applies globally within its linked workspace.
- `version` is an integer counter, not a semver string. Immutable versions means each version is a separate record; `supersedes` links the chain.
- `workspace` is a direct field (not only via `protects` edge) for efficient querying without graph traversal when listing policies for admin views.

### Graph Relations

```sql
-- Identity governs policy (identity created/owns the policy)
DEFINE TABLE governing TYPE RELATION IN identity OUT policy SCHEMAFULL;
DEFINE FIELD created_at ON governing TYPE datetime;
DEFINE INDEX governing_out ON governing FIELDS out;

-- Policy protects workspace (policy applies to this workspace)
DEFINE TABLE protects TYPE RELATION IN policy OUT workspace SCHEMAFULL;
DEFINE FIELD created_at ON protects TYPE datetime;
DEFINE INDEX protects_in ON protects FIELDS in;
```

### Intent Evaluation Extension

```sql
-- Add policy_trace to intent.evaluation
DEFINE FIELD evaluation.policy_trace ON intent TYPE option<array<object>>;
DEFINE FIELD evaluation.policy_trace[*].policy_id ON intent TYPE string;
DEFINE FIELD evaluation.policy_trace[*].policy_version ON intent TYPE int;
DEFINE FIELD evaluation.policy_trace[*].rule_id ON intent TYPE string;
DEFINE FIELD evaluation.policy_trace[*].effect ON intent TYPE string
  ASSERT $value IN ['allow', 'deny'];
DEFINE FIELD evaluation.policy_trace[*].matched ON intent TYPE bool;
DEFINE FIELD evaluation.policy_trace[*].priority ON intent TYPE int;

-- Add human_veto_required flag to evaluation result
DEFINE FIELD evaluation.human_veto_required ON intent TYPE option<bool>;
```

### Audit Event Extension

```sql
-- Extend audit_event event_type ASSERT to include policy events
DEFINE FIELD OVERWRITE event_type ON audit_event TYPE string
  ASSERT $value IN [
    "intent_submitted", "intent_evaluated", "intent_routed",
    "consent_approved", "consent_constrained", "consent_vetoed",
    "token_issued", "token_rejected",
    "dpop_verified", "dpop_rejected",
    "security_alert",
    "policy_created", "policy_activated", "policy_updated", "policy_deprecated"
  ];
```

## TypeScript Domain Types

### Core Algebraic Types

```
RulePredicate
  field: string                                    -- dot-path into intent context
  operator: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "in" | "not_in" | "exists"
  value: string | number | boolean | string[]      -- comparison target

RuleCondition = RulePredicate | RulePredicate[]    -- single or AND-array

PolicyRule
  id: string
  condition: RuleCondition
  effect: "allow" | "deny"
  priority: number

PolicySelector
  workspace?: string
  agent_role?: string
  resource?: string

PolicyStatus = "draft" | "testing" | "active" | "deprecated" | "superseded"

PolicyRecord
  id: RecordId<"policy", string>
  title: string
  description?: string
  version: number
  status: PolicyStatus
  selector: PolicySelector
  rules: PolicyRule[]
  human_veto_required: boolean
  max_ttl?: string
  created_by: RecordId<"identity", string>
  workspace: RecordId<"workspace", string>
  supersedes?: RecordId<"policy", string>
  created_at: Date
  updated_at?: Date
```

### Evaluation Types

```
PolicyTraceEntry
  policy_id: string              -- raw ID (not RecordId -- serialized for persistence)
  policy_version: number
  rule_id: string
  effect: "allow" | "deny"
  matched: boolean
  priority: number

PolicyGateWarning
  rule_id: string
  field: string                -- dot-path that was missing from intent context
  policy_id: string

PolicyGateResult
  | { passed: true, policy_trace: PolicyTraceEntry[], human_veto_required: boolean, warnings: PolicyGateWarning[] }
  | { passed: false, reason: string, policy_trace: PolicyTraceEntry[], deny_rule_id: string, warnings: PolicyGateWarning[] }

IntentEvaluationContext           -- flattened intent fields for predicate evaluation
  goal: string
  reasoning: string
  priority: number
  action_spec: { provider: string, action: string, params?: Record<string, unknown> }
  budget_limit?: { amount: number, currency: string }
  authorization_details?: Array<{ type: string, action: string, resource: string, constraints?: Record<string, unknown> }>
  requester_type: string
  requester_role?: string
```

### Policy Lifecycle State Machine

```
draft -> testing -> active -> deprecated    (forward-only)
                    active -> superseded    (new version created)
```

No back-transitions permitted. Each transition produces an `audit_event`.

## Graph Topology

```
identity --|governing|--> policy --|protects|--> workspace
                            |
                            |-- supersedes --> policy (previous version)
                            |
                            |-- created_by --> identity

intent.evaluation.policy_trace[] references policy IDs (not edges)
```

### Example Graph State

```
identity:admin-1 --governing--> policy:budget-cap-v2 --protects--> workspace:acme
                                     |
                                     -- supersedes --> policy:budget-cap-v1 (status: superseded)

identity:agent-1 submits intent:i1
  -> policy gate loads: policy:budget-cap-v2 (via workspace:acme <-protects)
  -> evaluates rules against intent context
  -> intent:i1.evaluation.policy_trace = [{ policy_id: "budget-cap-v2", ... }]
```
