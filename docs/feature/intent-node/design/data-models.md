# Intent Node: Data Models

## SurrealDB Schema

### intent table

```sql
DEFINE TABLE intent SCHEMAFULL;

-- Core fields
DEFINE FIELD goal ON intent TYPE string;
DEFINE FIELD reasoning ON intent TYPE string;
DEFINE FIELD status ON intent TYPE string
  ASSERT $value IN ["draft", "pending_auth", "pending_veto", "authorized", "executing", "completed", "vetoed", "failed"];
DEFINE FIELD priority ON intent TYPE int
  ASSERT $value >= 0 AND $value <= 100;

-- Action specification (what the agent wants to do)
DEFINE FIELD action_spec ON intent TYPE object;
DEFINE FIELD action_spec.provider ON intent TYPE string;
DEFINE FIELD action_spec.action ON intent TYPE string;
DEFINE FIELD action_spec.params ON intent TYPE option<object>;

-- Budget constraint
DEFINE FIELD budget_limit ON intent TYPE option<object>;
DEFINE FIELD budget_limit.amount ON intent TYPE float;
DEFINE FIELD budget_limit.currency ON intent TYPE string;

-- Evaluation result (populated by authorizer)
DEFINE FIELD evaluation ON intent TYPE option<object>;
DEFINE FIELD evaluation.decision ON intent TYPE string ASSERT $value IN ["APPROVE", "REJECT"];
DEFINE FIELD evaluation.risk_score ON intent TYPE int ASSERT $value >= 0 AND $value <= 100;
DEFINE FIELD evaluation.reason ON intent TYPE string;
DEFINE FIELD evaluation.evaluated_at ON intent TYPE datetime;
DEFINE FIELD evaluation.policy_only ON intent TYPE bool;

-- Veto window
DEFINE FIELD veto_expires_at ON intent TYPE option<datetime>;
DEFINE FIELD veto_reason ON intent TYPE option<string>;

-- Error tracking
DEFINE FIELD error_reason ON intent TYPE option<string>;

-- Traceability
DEFINE FIELD trace_id ON intent TYPE string;
DEFINE FIELD requester ON intent TYPE record<identity>;
DEFINE FIELD workspace ON intent TYPE record<workspace>;
DEFINE FIELD created_at ON intent TYPE datetime;
DEFINE FIELD updated_at ON intent TYPE option<datetime>;
DEFINE FIELD expiry ON intent TYPE option<datetime>;

-- Indexes
DEFINE INDEX intent_workspace_status ON intent FIELDS workspace, status;
DEFINE INDEX intent_created_at ON intent FIELDS created_at;
DEFINE INDEX intent_trace_id ON intent FIELDS trace_id;
DEFINE INDEX intent_veto_expires ON intent FIELDS veto_expires_at;
```

### Relations

```sql
-- Intent triggered by a task (intent originates from task assignment)
DEFINE TABLE triggered_by TYPE RELATION IN intent OUT task SCHEMAFULL;
DEFINE FIELD created_at ON triggered_by TYPE datetime;

-- Intent gates an agent session (authorized intent enables session)
DEFINE TABLE gates TYPE RELATION IN intent OUT agent_session SCHEMAFULL;
DEFINE FIELD created_at ON gates TYPE datetime;

-- Human vetoed an intent
DEFINE TABLE vetoed_by TYPE RELATION IN identity OUT intent SCHEMAFULL;
DEFINE FIELD reason ON vetoed_by TYPE string;
DEFINE FIELD vetoed_at ON vetoed_by TYPE datetime;
```

### SurrealQL EVENT

```sql
-- Fire on transition TO pending_auth (not on every update)
DEFINE EVENT intent_pending_auth ON intent
  WHEN $before.status != "pending_auth" AND $after.status = "pending_auth"
  THEN {
    http::post(
      "http://127.0.0.1:{PORT}/api/intents/" + <string> meta::id($after.id) + "/evaluate",
      $after,
      { "Content-Type": "application/json" }
    );
  };
```

Note: The `{PORT}` placeholder is replaced with the actual server port in the migration. The event uses `$before.status != "pending_auth"` as an idempotent guard to prevent double-firing.

### Authority Scope Extensions

```sql
-- New actions for intent lifecycle
CREATE authority_scope CONTENT { agent_type: "code_agent", action: "create_intent", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "code_agent", action: "submit_intent", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "architect", action: "create_intent", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "architect", action: "submit_intent", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "management", action: "create_intent", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "management", action: "submit_intent", permission: "auto", created_at: time::now() };
```

Human identity types get implicit `veto_intent` permission (checked at route level via identity.type = 'human').

## TypeScript Types

### Intent Domain Types (types.ts)

```
IntentStatus = "draft" | "pending_auth" | "pending_veto" | "authorized"
             | "executing" | "completed" | "vetoed" | "failed"

ActionSpec = { provider: string, action: string, params?: Record<string, unknown> }

BudgetLimit = { amount: number, currency: string }

EvaluationResult = { decision: "APPROVE" | "REJECT", risk_score: number, reason: string }

RoutingDecision =
  | { route: "auto_approve" }
  | { route: "veto_window", expires_at: Date }
  | { route: "reject", reason: string }

IntentRecord = {
  id: RecordId<"intent", string>
  goal: string
  reasoning: string
  status: IntentStatus
  priority: number
  action_spec: ActionSpec
  budget_limit?: BudgetLimit
  evaluation?: EvaluationResult & { evaluated_at: Date, policy_only: boolean }
  veto_expires_at?: Date
  veto_reason?: string
  error_reason?: string
  trace_id: string
  requester: RecordId<"identity", string>
  workspace: RecordId<"workspace", string>
  created_at: Date
  updated_at?: Date
  expiry?: Date
}
```

### Status Transition Map

```
draft          -> pending_auth
pending_auth   -> pending_veto | authorized | vetoed | failed
pending_veto   -> authorized | vetoed
authorized     -> executing
executing      -> completed | failed
```

Invalid transitions return an error value (not exception).

## Graph Traversal Patterns

### Audit trail query (task -> outcome)
```sql
SELECT
  id, goal, status, evaluation,
  <-triggered_by<-task AS originating_task,
  ->gates->agent_session AS spawned_session,
  <-vetoed_by<-identity AS vetoed_by_identity
FROM intent
WHERE workspace = $workspace
ORDER BY created_at DESC;
```

### Pending intents for governance feed
```sql
SELECT id, goal, status, evaluation, veto_expires_at, created_at, priority,
  action_spec.provider AS provider,
  action_spec.action AS action_name
FROM intent
WHERE workspace = $workspace
AND status IN ["pending_veto"]
ORDER BY priority DESC, created_at ASC;
```

## Feed Integration

Intent items map to `GovernanceFeedItem`:

| Intent State | Feed Tier | Actions |
|-------------|-----------|---------|
| pending_veto (risk > 30) | blocking | veto, discuss |
| vetoed | awareness | discuss |
| failed (evaluation_timeout) | review | discuss |

The `GovernanceFeedAction` type is extended with `"veto"` action. The `EntityKind` type in contracts.ts is extended with `"intent"`.
