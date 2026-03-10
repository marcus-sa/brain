# Policy Node — Gherkin Scenarios

Feature: Policy Node Governance
  As an org admin, authorizer, reviewer, or auditor
  I want graph-backed policies that deterministically govern agent intents
  So that governance is architectural, auditable, and updateable without code deploys

  # ─── Job 1: Define Governance Rules ───

  Scenario: Create a policy in draft status
    Given an org admin in workspace "acme"
    When they create a policy with:
      | field                  | value                                    |
      | title                  | Finance Small Spend                      |
      | description            | Auto-approve spend under $500            |
      | selector.resource      | banking_api                              |
      | rules[0].id            | max_spend_limit                          |
      | rules[0].condition     | intent.budget_limit.amount <= 500        |
      | rules[0].effect        | allow                                    |
      | rules[0].priority      | 1                                        |
      | human_veto_required    | false                                    |
    Then a policy record is created with status "draft"
    And the policy has version "1"

  Scenario: Activate a draft policy and create graph edges
    Given a draft policy "finance-small-spend" in workspace "acme"
    And identity "agent:code-agent-1" exists in workspace "acme"
    When the org admin activates the policy
    Then the policy status becomes "active"
    And a "governing" edge exists from "agent:code-agent-1" to the policy
    And a "protects" edge exists from the policy to workspace "acme"
    And an audit_event "policy_activated" is recorded

  Scenario: Reject policy activation when rules conflict
    Given an active policy "deny-all-banking" with a deny rule for "banking_api"
    And a draft policy "allow-small-banking" with an allow rule for "banking_api"
    When the org admin activates "allow-small-banking"
    Then an observation is created with severity "conflict"
    And the observation describes the contradicting rules

  # ─── Job 2: Enforce Rules at Intent Time ───

  Scenario: Policy gate denies intent that violates a deny rule
    Given an active policy with rule:
      | id            | condition                     | effect | priority |
      | block_deploy  | intent.action_spec.action = "deploy" | deny   | 100      |
    And the policy protects workspace "acme"
    When agent "code-agent-1" submits an intent with action "deploy"
    Then the intent is rejected with reason containing "block_deploy"
    And the evaluation has policy_only = true
    And an audit_event "intent_evaluated" is recorded with the policy reference

  Scenario: Policy gate allows intent that matches an allow rule
    Given an active policy with rule:
      | id              | condition                              | effect | priority |
      | small_spend_ok  | intent.budget_limit.amount <= 500      | allow  | 1        |
    And the policy protects workspace "acme"
    When agent "code-agent-1" submits an intent with budget_limit 200 USD
    Then the policy gate passes
    And the intent proceeds to LLM evaluation

  Scenario: Policy with human_veto_required forces veto window
    Given an active policy with human_veto_required = true
    And the policy protects workspace "acme"
    When agent "code-agent-1" submits any intent in workspace "acme"
    Then the intent enters "pending_veto" status regardless of risk_score
    And the evaluation trace includes the policy that requires human approval

  Scenario: No policies found — falls through to existing behavior
    Given no active policies for workspace "acme" or identity "code-agent-1"
    When agent "code-agent-1" submits an intent
    Then the policy gate passes (empty policy set = pass)
    And the intent proceeds to LLM evaluation as before

  Scenario: Multiple policies evaluated in priority order
    Given two active policies for workspace "acme":
      | policy            | rule_id     | effect | priority |
      | global-deny       | block_rm_rf | deny   | 100      |
      | team-allow-read   | allow_read  | allow  | 10       |
    When agent "code-agent-1" submits an intent with action "rm_rf"
    Then the deny rule at priority 100 is evaluated first
    And the intent is rejected before the allow rule is checked

  # ─── Job 3: Review Policy-Flagged Intents ───

  Scenario: Reviewer sees policy trace on flagged intent
    Given an intent in "pending_veto" status
    And the evaluation trace includes:
      | policy_id          | rule_id         | effect | matched |
      | finance-small-spend| max_spend_limit | allow  | false   |
    When the reviewer views the intent
    Then they see which policy rules were evaluated
    And they see which rules passed and which failed
    And they see the policy title and version

  Scenario: Reviewer approves intent with policy context in audit
    Given a pending_veto intent flagged by policy "high-risk-ops"
    When the reviewer approves the intent
    Then an audit_event "consent_approved" is recorded
    And the audit_event payload includes the policy reference

  # ─── Job 4: Verify Policy Compliance ───

  Scenario: Auditor queries intents evaluated under a specific policy version
    Given policy "finance-small-spend" version "2" was active from March 1-10
    And 5 intents were evaluated during that period
    When the auditor queries compliance for "finance-small-spend" version "2"
    Then they receive all 5 intent evaluation records
    And each record includes the policy version reference

  Scenario: Auditor views policy change history
    Given policy "finance-small-spend" has versions "1", "2", "3"
    When the auditor queries the policy history
    Then they see each version with:
      | field       | present |
      | version     | yes     |
      | rules       | yes     |
      | created_at  | yes     |
      | created_by  | yes     |
      | status      | yes     |

  # ─── Policy Lifecycle ───

  Scenario: Deprecate a policy removes graph edges
    Given an active policy "old-finance" with governing and protects edges
    When the org admin deprecates "old-finance"
    Then the policy status becomes "deprecated"
    And all "governing" edges to "old-finance" are removed
    And all "protects" edges from "old-finance" are removed
    And an audit_event "policy_deprecated" is recorded

  Scenario: Update policy creates new immutable version
    Given an active policy "finance-small-spend" at version "1"
    When the org admin updates the rules
    Then a new version "2" is created with status "active"
    And version "1" becomes immutable (status "superseded")
    And existing audit references to version "1" are preserved
