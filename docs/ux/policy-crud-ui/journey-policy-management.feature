Feature: Policy CRUD UI -- Policy Management
  As an org admin, reviewer, or auditor
  I want to create, manage, review, and audit governance policies through a web UI
  So that agent behavior is governed by structured rules I can manage without developer help

  # --- Job 1: Define Governance Rules via UI ---

  Scenario: List policies in a workspace
    Given Reiko Tanaka is an org admin of workspace "acme-corp"
    And the workspace has 3 active policies and 2 draft policies
    When she navigates to the policies page
    Then she sees a table with 5 rows
    And each row displays title, status, version number, created_by name, and last updated time
    And the status filter tabs show "Active (3)" and "Draft (2)"

  Scenario: Empty state for workspace with no policies
    Given workspace "new-startup" has no policies
    When Reiko Tanaka navigates to the policies page
    Then she sees an empty state explaining what policies are
    And a prominent "Create your first policy" button

  Scenario: Filter policies by status
    Given Reiko is on the policies page with 3 active and 2 draft policies
    When she clicks the "Draft" status tab
    Then the table shows only 2 rows with status "draft"
    And the "Draft (2)" tab is highlighted as active

  Scenario: Create a policy with a spending deny rule
    Given Reiko is on the "Create Policy" form in workspace "acme-corp"
    When she enters title "Finance Controls"
    And enters description "Limits agent spending over $500"
    And adds a rule with:
      | field                | operator | value | effect | priority |
      | budget_limit.amount  | gt       | 500   | deny   | 100      |
    And checks "Require human veto window"
    And clicks "Save as Draft"
    Then a policy "Finance Controls" is created with status "draft" and version 1
    And she is redirected to the policy detail page
    And a success notification confirms "Policy created as draft"

  Scenario: Create a policy with an allow-list rule
    Given Reiko is on the "Create Policy" form
    When she adds a rule with:
      | field               | operator | value                           | effect | priority |
      | action_spec.action  | in       | read_file, search, list_tasks   | allow  | 50       |
    And clicks "Save as Draft"
    Then the rule is saved with the value parsed as an array of 3 strings

  Scenario: Create a policy with multiple rules
    Given Reiko is on the "Create Policy" form
    When she adds 2 rules:
      | field                | operator | value | effect | priority |
      | budget_limit.amount  | gt       | 500   | deny   | 100      |
      | action_spec.action   | in       | read_file, search | allow | 50 |
    And clicks "Save as Draft"
    Then the policy is created with 2 rules ordered by priority

  Scenario: Validation rejects empty title
    Given Reiko is on the "Create Policy" form
    When she leaves the title field empty
    And clicks "Save as Draft"
    Then an inline error appears on the title field: "Title is required"
    And the form is not submitted

  Scenario: Validation rejects unknown field path
    Given Reiko is building a rule in the rule builder
    When she enters field path "budgetlimit.amoun"
    And moves focus to the next field
    Then an inline validation error appears: "Unknown field. Did you mean 'budget_limit.amount'?"
    And the "Save as Draft" button is disabled

  Scenario: Validation rejects operator-value type mismatch
    Given Reiko is building a rule with operator "gt" (greater than)
    When she enters value "not-a-number"
    Then an inline error appears: "Operator 'gt' requires a numeric value"

  Scenario: Rule preview shows human-readable rendering
    Given Reiko has built a rule with field "budget_limit.amount", operator "gt", value "500", effect "deny"
    Then the rule preview displays: "Deny when budget_limit.amount > 500"

  Scenario: Policy creation requires at least one rule
    Given Reiko is on the "Create Policy" form with no rules added
    When she clicks "Save as Draft"
    Then an error message appears: "At least one rule is required"

  # --- Job 1 continued: Policy Detail View ---

  Scenario: View active policy detail with rules and edges
    Given "Finance Controls" is an active policy at version 3 in workspace "acme-corp"
    And it has 2 rules and human_veto_required is true
    When Reiko clicks on "Finance Controls" in the policy list
    Then she sees title "Finance Controls", status "active", version "v3"
    And the rules section shows 2 rules with human-readable predicate text
    And the options section shows "Human veto required: Yes"
    And the graph edges section shows governing and protects relationships
    And action buttons show "Deprecate" and "Create New Version"

  Scenario: Draft policy detail shows "Activate" button
    Given "API Rate Policy" is a draft policy in workspace "acme-corp"
    When Reiko views the policy detail
    Then action buttons show "Activate" and "Edit"
    And "Deprecate" and "Create New Version" are not shown

  # --- Job 2: Manage Policy Lifecycle ---

  Scenario: Activate a draft policy with confirmation
    Given "API Rate Policy" is a draft policy with 1 rule in workspace "acme-corp"
    When Reiko clicks "Activate" on the policy detail page
    Then a confirmation dialog appears explaining:
      | impact                                                        |
      | Status changes to "active"                                    |
      | Governing edge created (Reiko Tanaka -> policy)               |
      | Protects edge created (policy -> workspace acme-corp)         |
      | Agents evaluated against these rules on next intent           |
    And when she clicks "Activate Policy"
    Then the policy status changes to "active"
    And the detail page refreshes showing status "active"
    And a success notification confirms "Policy activated"

  Scenario: Cannot activate a policy with no rules
    Given "Empty Policy" is a draft policy with 0 rules
    When Reiko clicks "Activate"
    Then an error message appears: "Cannot activate a policy with no rules"
    And the policy remains in "draft" status

  Scenario: Deprecate an active policy with confirmation
    Given "Legacy Spending" is an active policy at version 4 in workspace "acme-corp"
    When Reiko clicks "Deprecate" on the policy detail page
    Then a confirmation dialog warns:
      | impact                                                        |
      | Status changes to "deprecated"                                |
      | Governing edges removed                                       |
      | Protects edges removed                                        |
      | Agents will no longer be evaluated against this policy        |
    And when she clicks "Deprecate Policy"
    Then the policy status changes to "deprecated"
    And the detail page shows status "deprecated" with no action buttons

  Scenario: Create new version of an active policy
    Given "Finance Controls" is active at version 3 with 2 rules
    When Reiko clicks "Create New Version"
    Then a form opens pre-populated with the current title, description, selector, and rules
    And she can modify the rules
    When she changes the budget_limit.amount threshold from 500 to 1000
    And clicks "Save as New Version"
    Then a new policy is created at version 4 with status "draft"
    And the previous version 3 remains active until the new version is activated
    And the new version's "supersedes" field references the previous version

  Scenario: Activating a new version supersedes the old
    Given "Finance Controls" v4 is a draft and v3 is active
    When Reiko activates v4
    Then v4 becomes "active" with governing and protects edges
    And v3 transitions to "superseded"
    And v3's governing and protects edges are removed

  # --- Job 2: Authorization ---

  Scenario: Agent identity cannot create policies (403)
    Given "architect-agent" is an agent identity in workspace "acme-corp"
    When the agent sends POST /api/workspaces/acme-corp/policies
    Then the response is 403 Forbidden
    And the body contains "Agent identities cannot modify policies"

  Scenario: Agent identity can read policies (200)
    Given "architect-agent" is an agent identity in workspace "acme-corp"
    When the agent sends GET /api/workspaces/acme-corp/policies
    Then the response is 200
    And the body contains the policy list

  # --- Job 3: Understand Intent Evaluation ---

  Scenario: Reviewer sees collapsed policy trace summary
    Given an intent "Purchase DataDog license for $800" is pending_veto
    And it was evaluated against 2 policies with 1 rule match
    When Marcus Oliveira opens the intent review screen
    Then the policy evaluation section shows "2 policies evaluated, 1 rule matched"
    And the section is collapsed by default

  Scenario: Reviewer expands policy trace for detail
    Given Marcus is viewing the collapsed policy trace on an intent review
    When he clicks to expand the policy evaluation section
    Then he sees each policy with its title and version
    And for each policy, each rule is listed with:
      | field               | value                      |
      | Rule ID             | max_spend                  |
      | Condition           | budget_limit.amount gt 500 |
      | Matched             | YES (800 > 500)            |
      | Effect              | DENY                       |
      | Priority            | 100                        |

  Scenario: Reviewer navigates from trace to source policy
    Given Marcus is viewing the expanded policy trace
    And "Finance Controls (v3)" is shown as the matching policy
    When he clicks "View Policy" next to "Finance Controls"
    Then he is navigated to the policy detail page for "Finance Controls"

  Scenario: Policy trace shows human-veto reason
    Given the matching policy has human_veto_required = true
    When Marcus views the policy trace
    Then a note appears: "Human veto required by: Finance Controls"

  # --- Job 4: Verify Policy Compliance ---

  Scenario: View policy version history timeline
    Given "Finance Controls" has 3 versions: v1 (superseded), v2 (superseded), v3 (active)
    When Ayumi Sato views the policy detail page
    Then the version history section shows a timeline:
      | version | status     | date        |
      | v3      | active     | Mar 14 2026 |
      | v2      | superseded | Mar 10 2026 |
      | v1      | superseded | Mar 01 2026 |
    And each adjacent pair has a "View Diff" action

  Scenario: View diff between adjacent versions
    Given "Finance Controls" v2 had 1 rule and v3 has 2 rules
    When Ayumi clicks "View Diff" between v2 and v3
    Then the diff shows:
      | change type | item                | detail                                     |
      | unchanged   | Rule #1 (max_spend) |                                            |
      | added       | Rule #2 (allow_reads) | action_spec.action in [read_file, search, list_tasks] |
    And options changes are shown (or "unchanged" if none)

  @property
  Scenario: Policy versions are immutable after activation
    Given a policy was activated and later superseded
    Then no API endpoint allows modifying the superseded version's rules
    And PATCH requests to non-draft policies return 409 Conflict

  @property
  Scenario: All lifecycle transitions produce audit events
    Given any policy lifecycle transition (create, activate, deprecate, supersede)
    Then an audit_event is recorded with event_type, actor, workspace, policy_id, and policy_version
    And the audit event timestamp reflects the time of transition
