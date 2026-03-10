# Intent Node -- Shared Artifacts Registry

Every `${variable}` referenced in the journey YAML has a single documented source.

| Artifact | Type | Source | Producer | Consumer(s) | Persistence |
|----------|------|--------|----------|-------------|-------------|
| `${task_context}` | TaskRecord | SurrealDB `task` table | Orchestrator assignment | Worker Agent | DB record |
| `${action_spec}` | Object | Worker Agent reasoning | Worker Agent | Authorizer Agent, Orchestrator | Intent record field |
| `${intent_id}` | RecordId | SurrealDB CREATE | System | All actors | DB record |
| `${intent_record}` | IntentRecord | SurrealDB `intent` table | Worker Agent | Authorizer Agent, Human Feed, Orchestrator | DB record |
| `${authorizer_decision}` | Object | Authorizer Agent LLM call | Authorizer Agent | System (routing), Human Feed, Intent audit | Stored on intent or linked record |
| `${authorization_path}` | Enum | Risk routing logic | System | System (branching) | Transient |
| `${feed_item}` | SSE Event | Event Bridge | System | Human Operator (UI) | SSE stream + optional DB log |
| `${veto_window_duration}` | Duration | Workspace config | Admin/default | System (timer) | Workspace record field |
| `${veto_decision}` | Enum | Human action or timeout | Human Operator / System | System (authorization) | Intent audit trail |
| `${authorized_intent}` | IntentRecord | SurrealDB UPDATE | System | Orchestrator | DB record |
| `${agent_session_id}` | RecordId | SurrealDB CREATE | Orchestrator | Worker Agent, Audit | DB record |
| `${execution_result}` | Object | Agent session completion | Worker Agent | Intent record, Audit trail | DB record |
| `${authority_scope_rules}` | Array | SurrealDB `authority_scope` table | Admin (seed data) | Authorizer Agent (policy check) | DB records |

## Graph Relations

| Relation | Type | From | To | Purpose |
|----------|------|------|----|---------|
| `requests` | Edge | identity (worker) | intent | Who requested this intent |
| `evaluates` | Edge | identity (authorizer) | intent | Who evaluated this intent |
| `gates` | Edge | intent | agent_session | Intent authorizes this session |
| `triggered_by` | Edge | intent | task | What task triggered this intent |
| `vetoed_by` | Edge | identity (human) | intent | Who vetoed (if applicable) |
