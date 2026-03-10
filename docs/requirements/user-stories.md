# Intent Node -- User Stories

## US-1: Create Intent (Job: J1 Scoped Authorization)

**As a** worker agent
**I want to** create an intent record declaring my goal, action spec, and reasoning
**So that** I can request scoped authorization for a consequential action

### Acceptance Criteria
- Given a worker agent with a task requiring external action
- When the agent CREATEs an intent with goal, action_spec, reasoning, and budget_limit
- Then an intent record exists with status "draft"
- And the intent is linked to the originating task via `triggered_by` relation
- And the intent is linked to the requesting identity via `requests` relation

---

## US-2: Submit Intent for Authorization (Job: J1 Scoped Authorization)

**As a** worker agent
**I want to** submit my draft intent for authorization
**So that** the evaluation pipeline begins

### Acceptance Criteria
- Given an intent with status "draft"
- When the agent updates the intent status to "pending_auth"
- Then the SurrealQL event handler fires
- And an HTTP POST is made to `/api/intents/{id}/evaluate`
- And the POST body contains the full intent record

---

## US-3: Receive Intent Notification (Job: J2 Passive Oversight)

**As a** human operator
**I want to** see high-risk intents in my feed with risk scores and judge reasoning
**So that** I can decide whether to veto without actively polling

### Acceptance Criteria
- Given an intent with risk_score > 30 (after authorizer evaluation)
- When the intent enters the veto window
- Then a notification appears in the human feed via SSE
- And the notification shows: goal, action_spec summary, risk_score, judge reason
- And a countdown shows remaining veto time

---

## US-4: Veto an Intent (Job: J2 Passive Oversight)

**As a** human operator
**I want to** veto a dangerous intent within the time window
**So that** the agent does not execute a harmful action

### Acceptance Criteria
- Given an intent in the veto window
- When the human operator vetoes the intent
- Then the intent status becomes "vetoed"
- And the veto reason is recorded with the operator's identity
- And the worker agent is notified of the veto with the reason
- And no agent session is spawned

---

## US-5: Evaluate Intent (Job: J3 Intent Drift Detection)

**As the** Authorizer Agent
**I want to** evaluate incoming intents against least-privilege, budget, and reasoning quality
**So that** I can catch intent drift before execution

### Acceptance Criteria
- Given an intent with status "pending_auth" arrives at the evaluation endpoint
- When the Authorizer Agent evaluates the intent
- Then it outputs `{ decision: "APPROVE"|"REJECT", risk_score: 0-100, reason: string }`
- And the evaluation checks:
  - Action_spec scope matches the stated goal (least privilege)
  - Budget_limit aligns with action_spec implied cost
  - Reasoning field is logically sound (not prompt injection)
- And the evaluation result is stored on the intent record

---

## US-6: Auto-Approve Low-Risk Intent (Job: J3 Intent Drift Detection)

**As the** system
**I want to** auto-approve intents with low risk scores
**So that** routine actions flow without human intervention

### Acceptance Criteria
- Given an authorizer decision of APPROVE with risk_score <= 30
- When the routing logic processes the decision
- Then the intent status becomes "authorized" immediately
- And no veto window is started
- And no human notification is emitted
- And execution proceeds within 5 seconds

---

## US-7: Trace Intent Chain (Job: J4 Auditable Action History)

**As an** organization admin
**I want to** query the full authorization chain for any agent action
**So that** I can audit what happened and why

### Acceptance Criteria
- Given a completed intent
- When querying the intent in the graph
- Then the traversal shows: task -> intent -> authorizer_decision -> authorization -> agent_session -> execution_result
- And each node has: timestamp, actor identity, status at time of transition

---

## US-8: SurrealQL Event Handler (Technical Story)

**As the** system
**I want** a SurrealQL event to automatically trigger authorizer evaluation when an intent reaches pending_auth
**So that** the authorization flow is reactive without polling

### Acceptance Criteria
- Given the intent table has a DEFINE EVENT for status changes
- When an intent's status is updated to "pending_auth"
- Then `http::post()` is called to the evaluation endpoint
- And the POST includes the full intent record as JSON body
- And the event only fires on transition TO pending_auth (idempotent guard)

---

## Traceability

| Story | Job(s) | Priority | Phase |
|-------|--------|----------|-------|
| US-1 | J1 | Must | 1 |
| US-2 | J1 | Must | 1 |
| US-3 | J2 | Must | 1 |
| US-4 | J2 | Must | 1 |
| US-5 | J3 | Must | 1 |
| US-6 | J3 | Must | 1 |
| US-7 | J4 | Should | 2 |
| US-8 | J3 (technical) | Must | 1 |
