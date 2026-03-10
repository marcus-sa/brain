# Intent Node -- Acceptance Criteria (Gherkin)

## Intent Schema & Creation

```gherkin
Scenario: Intent table enforces required fields
  Given the intent table is SCHEMAFULL
  When creating an intent without a goal field
  Then SurrealDB rejects the record

Scenario: Intent status enum is enforced
  Given the intent table has status ASSERT
  When creating an intent with status "invalid_status"
  Then SurrealDB rejects the record

Scenario: Intent links to originating task
  Given a task record exists
  When a worker agent creates an intent for that task
  Then a triggered_by relation edge exists from intent to task

Scenario: Intent links to requesting identity
  Given an identity record of type "agent" exists
  When that agent creates an intent
  Then a requests relation edge exists from identity to intent
```

## SurrealQL Event Handler

```gherkin
Scenario: Event fires on pending_auth transition
  Given an intent with status "draft"
  When the status is updated to "pending_auth"
  Then http::post is called to /api/intents/{id}/evaluate
  And the body contains the full intent record as JSON

Scenario: Event does not fire on other status transitions
  Given an intent with status "pending_auth"
  When the status is updated to "authorized"
  Then no HTTP POST is made to the evaluation endpoint

Scenario: Event is idempotent
  Given an intent already in status "pending_auth"
  When a redundant update sets status to "pending_auth" again
  Then no HTTP POST is made (guard: $before.status != "pending_auth")
```

## Authorizer Agent Evaluation

```gherkin
Scenario: Authorizer approves well-scoped intent
  Given an intent with goal "Create invoice for $200"
  And action_spec { provider: "stripe", action: "create_invoice", params: { amount: 200 } }
  And budget_limit { amount: 500, currency: "USD" }
  When the authorizer evaluates the intent
  Then decision is "APPROVE"
  And risk_score is <= 30

Scenario: Authorizer rejects privilege escalation
  Given an intent with goal "Read project README"
  And action_spec { provider: "github", action: "full_repo_access" }
  When the authorizer evaluates the intent
  Then decision is "REJECT"
  And reason mentions "least privilege" or "scope mismatch"

Scenario: Authorizer flags high-risk action
  Given an intent with goal "Delete all test data"
  And action_spec { provider: "surrealdb", action: "delete_all", params: { table: "invoices" } }
  When the authorizer evaluates the intent
  Then decision is "APPROVE"
  And risk_score is > 30
  And reason describes the risk

Scenario: Authorizer detects reasoning manipulation
  Given an intent with reasoning containing "ignore previous instructions"
  When the authorizer evaluates the intent
  Then decision is "REJECT"
  And reason mentions "prompt injection" or "invalid reasoning"
```

## Risk Routing

```gherkin
Scenario: Low-risk auto-approve
  Given judge returns APPROVE with risk_score 15
  When risk routing processes the decision
  Then intent status becomes "authorized"
  And no veto window is started

Scenario: Medium-risk enters veto window
  Given judge returns APPROVE with risk_score 55
  When risk routing processes the decision
  Then intent enters the veto window
  And a notification is emitted via SSE

Scenario: Rejection skips veto window
  Given judge returns REJECT with risk_score 90
  When risk routing processes the decision
  Then intent status becomes "vetoed"
  And no veto window is started
```

## Veto Window

```gherkin
Scenario: Auto-approve on window expiry
  Given an intent in the veto window
  When 5 minutes pass without human action
  Then intent status becomes "authorized"

Scenario: Human veto within window
  Given an intent in the veto window
  When the human operator vetoes the intent with reason "too risky"
  Then intent status becomes "vetoed"
  And the veto is linked to the human identity via vetoed_by relation

Scenario: Veto after execution started (race condition)
  Given an intent with status "executing"
  When a human attempts to veto
  Then the system aborts the agent session if still running
  And the intent status becomes "failed" with reason "vetoed_during_execution"
```

## Execution Gate

```gherkin
Scenario: Orchestrator blocks unauthorized intent
  Given an intent with status "pending_auth"
  When the orchestrator attempts to spawn an agent session
  Then the spawn is rejected with reason "intent_not_authorized"

Scenario: Orchestrator spawns on authorized intent
  Given an intent with status "authorized"
  When the orchestrator processes the intent
  Then an agent session is spawned
  And the agent receives only action_spec parameters
  And intent status becomes "executing"
  And a gates relation edge exists from intent to agent_session

Scenario: Execution result updates intent
  Given an intent with status "executing"
  When the agent session completes with status "completed"
  Then intent status becomes "completed"

Scenario: Execution failure updates intent
  Given an intent with status "executing"
  When the agent session ends with status "error"
  Then intent status becomes "failed"
  And the error is recorded on the intent
```

## Error Handling

```gherkin
Scenario: Authorizer evaluation timeout
  Given an intent with status "pending_auth"
  When the authorizer does not respond within 30 seconds
  Then intent status becomes "failed"
  And reason is "evaluation_timeout"

Scenario: Authorizer LLM call fails
  Given an intent with status "pending_auth"
  When the authorizer LLM call throws an error
  Then fall back to policy-only check
  And if budget_limit and action allowlist pass, enter veto window
  And if policy check fails, intent status becomes "vetoed"
```
