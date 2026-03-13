# US-PCUI-04: Activate and Deprecate Policy

## Problem
Reiko Tanaka is an org admin who has a draft policy ready to enforce. She finds it impossible to activate it through the UI because the activatePolicy() and deprecatePolicy() functions have no HTTP endpoints -- she must ask a developer to run them server-side.

## Who
- Org Admin | Web browser, managing policy lifecycle | Wants to transition policies between states with confidence

## Solution
Activate and deprecate endpoints with confirmation dialogs showing the impact of each transition.

## Job Story Trace
- Job 2: Manage Policy Lifecycle (Job Steps: Confirm, Execute, Monitor)

## Domain Examples
### 1: Happy Path -- Activate a draft policy
Reiko views "API Rate Policy" (draft, v1, 1 rule). She clicks "Activate". A confirmation dialog appears: "You are about to activate 'API Rate Policy'. This will create governing and protects edges. Agents will be evaluated against these rules." She clicks "Activate Policy". The policy status changes to "active". The detail page refreshes. A toast confirms "Policy activated".

### 2: Happy Path -- Deprecate an active policy
Reiko views "Legacy Spending" (active, v4). She clicks "Deprecate". The dialog warns: "Agents will no longer be evaluated against this policy. Governing and protects edges will be removed." She clicks "Deprecate Policy". Status changes to "deprecated".

### 3: Error -- Activate policy with no rules
Reiko tries to activate "Empty Policy" (draft, 0 rules). The "Activate" button is disabled or clicking it shows: "Cannot activate a policy with no rules."

### 4: Error -- Deprecate a non-active policy
A request to deprecate a draft policy returns 409: "Only active policies can be deprecated."

## UAT Scenarios (BDD)

### Scenario: Activate a draft policy with confirmation
Given "API Rate Policy" is a draft policy with 1 rule in workspace "acme-corp"
When Reiko clicks "Activate" on the policy detail page
Then a confirmation dialog shows the activation impact
And when she clicks "Activate Policy"
Then the policy status changes to "active"
And governing and protects graph edges are created
And a success notification confirms "Policy activated"

### Scenario: Cannot activate a policy with no rules
Given "Empty Policy" is a draft policy with 0 rules
When Reiko attempts to activate it
Then an error indicates "Cannot activate a policy with no rules"
And the policy remains in "draft" status

### Scenario: Deprecate an active policy with confirmation
Given "Legacy Spending" is an active policy at version 4
When Reiko clicks "Deprecate" on the policy detail page
Then a confirmation dialog warns about edge removal
And when she clicks "Deprecate Policy"
Then the policy status changes to "deprecated"
And governing and protects edges are removed

### Scenario: Cannot deprecate a non-active policy
Given a policy is in "draft" status
When a PATCH request is sent to the deprecate endpoint
Then the response is 409 with message "Only active policies can be deprecated"

### Scenario: Activation records audit event
Given "API Rate Policy" is activated by Reiko Tanaka
Then an audit_event with event_type "policy_activated" is recorded
And the event references the policy ID, version, actor, and workspace

### Scenario: Cancel activation returns to detail unchanged
Given the activation confirmation dialog is open
When Reiko clicks "Cancel"
Then the dialog closes
And the policy remains in "draft" status

## Acceptance Criteria
- [ ] PATCH /activate transitions draft -> active and creates governing + protects edges
- [ ] PATCH /deprecate transitions active -> deprecated and removes governing + protects edges
- [ ] Confirmation dialogs show specific impact before execution
- [ ] Policies with 0 rules cannot be activated
- [ ] Only valid status transitions are permitted (409 for invalid)
- [ ] Audit events recorded for each lifecycle transition
- [ ] Agent identities receive 403 on mutation endpoints

## Technical Notes
- PATCH /api/workspaces/:workspaceId/policies/:policyId/activate
- PATCH /api/workspaces/:workspaceId/policies/:policyId/deprecate
- Reuse existing activatePolicy() and deprecatePolicy() from policy-queries.ts
- Add pre-condition checks (rule count, current status) before calling mutation functions
- Confirmation dialog follows existing patterns (ApproveDialog, DeactivateDialog in learnings)
- 1 day effort
