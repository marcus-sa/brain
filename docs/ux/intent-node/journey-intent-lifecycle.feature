Feature: Intent Node Lifecycle
  As a Business OS operator
  I want agent actions to go through an intent authorization flow
  So that consequential actions are governed without bottlenecking routine work

  Background:
    Given a workspace with an identity of type "agent" named "worker-1"
    And an identity of type "agent" named "judge" with agent_type "observer"
    And an identity of type "human" named "operator"
    And a veto window duration of 5 minutes

  # --- Job 1: Scoped Authorization (Worker Agent) ---

  Scenario: Worker agent creates an intent for a consequential action
    Given worker-1 has a task requiring a Stripe API call
    When worker-1 creates an intent with:
      | field        | value                                          |
      | goal         | Create invoice for client onboarding           |
      | action_spec  | { provider: "stripe", action: "create_invoice" }|
      | budget_limit | { amount: 500, currency: "USD" }               |
      | reasoning    | Client onboarding requires initial invoice     |
    Then an intent record is created with status "draft"
    And the intent has a trace_id linking to the originating task

  Scenario: Worker agent submits intent for authorization
    Given an intent exists with status "draft"
    When the worker agent updates the intent status to "pending_auth"
    Then the intent status becomes "pending_auth"
    And a SurrealQL event fires triggering the evaluation endpoint

  # --- Job 3: Intent Drift Detection (Authorizer Agent) ---

  Scenario: Authorizer agent approves a well-scoped low-risk intent
    Given an intent with status "pending_auth"
    And the action_spec requests "create_invoice" with budget_limit 500 USD
    When the authorizer agent evaluates the intent
    Then the authorizer returns decision "APPROVE" with risk_score 15
    And the intent is auto-approved without entering the veto window
    And the intent status becomes "authorized"

  Scenario: Authorizer agent flags a high-risk intent for human review
    Given an intent with status "pending_auth"
    And the action_spec requests "delete_all_invoices" with no budget_limit
    When the authorizer agent evaluates the intent
    Then the authorizer returns decision "APPROVE" with risk_score 75
    And the intent enters the veto window
    And a notification is emitted to the human feed

  Scenario: Authorizer agent rejects intent drift
    Given an intent with status "pending_auth"
    And the goal is "Read the project README"
    And the action_spec requests "github:full_repo_access"
    When the authorizer agent evaluates the intent
    Then the authorizer returns decision "REJECT"
    And the reason includes "principle of least privilege"
    And the intent status becomes "vetoed"

  # --- Job 2: Passive Oversight (Human Operator) ---

  Scenario: Human receives notification for high-risk intent
    Given an intent has entered the veto window with risk_score 75
    When the human feed is checked
    Then the feed contains the intent with:
      | field      | value                              |
      | goal       | Delete all invoices                |
      | risk_score | 75                                 |
      | reason     | Destructive action, high privilege |
    And a countdown shows remaining veto time

  Scenario: Human vetoes a dangerous intent
    Given an intent is in the veto window
    When the human operator vetoes the intent
    Then the intent status becomes "vetoed"
    And the worker agent receives the veto reason
    And no agent session is spawned

  Scenario: Intent auto-approves after veto window expires
    Given an intent is in the veto window with risk_score 45
    When 5 minutes pass without a human veto
    Then the intent status becomes "authorized"
    And execution proceeds automatically

  # --- SurrealQL Event Handler ---

  Scenario: SurrealQL event triggers authorizer evaluation via HTTP
    Given the intent table has an event handler defined
    When an intent's status changes to "pending_auth"
    Then the system makes an HTTP POST to "/api/intents/{id}/evaluate"
    And the POST body contains the full intent record
    And the authorizer agent is invoked to evaluate the intent

  # --- Execution Gate ---

  Scenario: Authorized intent spawns a scoped agent session
    Given an intent with status "authorized"
    And the action_spec specifies provider "stripe" and action "create_invoice"
    When the orchestrator processes the authorized intent
    Then an agent session is spawned
    And the agent receives only the parameters from action_spec
    And the intent status becomes "executing"

  Scenario: Execution completes successfully
    Given an intent with status "executing"
    When the agent session completes successfully
    Then the intent status becomes "completed"
    And the execution result is linked to the intent via the graph

  Scenario: Execution fails
    Given an intent with status "executing"
    When the agent session fails
    Then the intent status becomes "failed"
    And the failure reason is recorded on the intent

  # --- Error Paths ---

  Scenario: Authorizer agent times out during evaluation
    Given an intent with status "pending_auth"
    When the authorizer agent does not respond within 30 seconds
    Then the intent status becomes "failed"
    And the reason is "evaluation_timeout"
    And the human operator is notified

  Scenario: Budget violation caught at policy level
    Given an intent with budget_limit 100 USD
    And the action_spec implies a cost of 500 USD
    When policy validation runs before authorizer evaluation
    Then the intent is immediately rejected
    And the intent status becomes "vetoed"
    And the reason is "budget_limit_exceeded"

  # --- Job 4: Auditable Action History ---

  Scenario: Full intent chain is traceable in the graph
    Given an intent that has completed execution
    When querying the intent graph
    Then the chain shows: task -> intent -> authorizer_decision -> authorization -> agent_session -> result
    And each node has timestamps and actor identity
