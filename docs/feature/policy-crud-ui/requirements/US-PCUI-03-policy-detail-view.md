# US-PCUI-03: Policy Detail View

## Problem
Reiko Tanaka is an org admin who just created a draft policy and wants to review it before activation. She finds it impossible to see the full policy with its rules, edges, and version history because there is no detail view -- only the raw SurrealDB record visible through Surrealist.

## Who
- Org Admin | Web browser, reviewing a specific policy | Wants to see everything about a policy in one place
- Reviewer | Web browser, navigating from policy trace | Wants to understand the policy that flagged an intent
- Auditor | Web browser, investigating compliance | Wants to see version history and edges

## Solution
A policy detail page showing all PolicyRecord fields, human-readable rules, graph edges, version history timeline, and context-appropriate action buttons.

## Job Story Trace
- Job 1: Define Governance Rules via UI (Job Steps: Confirm, Monitor)
- Job 3: Understand Intent Evaluation (Job Step: Modify -- navigate to source policy)
- Job 4: Verify Policy Compliance (Job Steps: Browse, Confirm)

## Domain Examples
### 1: Happy Path -- Active policy with full detail
Reiko clicks "Finance Controls" in the policy list. She sees: title "Finance Controls", status "active", version "v3", created by "Reiko Tanaka", last updated "2 hours ago". The rules section shows 2 rules with human-readable rendering. The graph edges show governing (Reiko -> policy) and protects (policy -> acme-corp). The version history shows v1, v2 (superseded), v3 (active). Action buttons: "Deprecate" and "Create New Version".

### 2: Draft policy -- Different action buttons
Reiko views "API Rate Policy" (draft, v1). Action buttons show "Activate" and "Edit". "Deprecate" and "Create New Version" are not shown because only active policies can be deprecated or versioned.

### 3: Deprecated policy -- Read-only view
Reiko views "Legacy Spending" (deprecated, v4). No action buttons are shown. The status badge shows "deprecated" in a muted color. The version history still shows the full chain.

## UAT Scenarios (BDD)

### Scenario: View active policy with rules, edges, and version history
Given "Finance Controls" is active at version 3 with 2 rules in workspace "acme-corp"
And human_veto_required is true and max_ttl is "1h"
When Reiko clicks on "Finance Controls" in the policy list
Then she sees title, description, status "active", version "v3"
And the rules section shows 2 rules with human-readable predicate text
And options show "Human veto required: Yes" and "Max TTL: 1 hour"
And the graph edges section shows governing and protects relationships
And the version history shows v1, v2, v3 with statuses and dates
And action buttons show "Deprecate" and "Create New Version"

### Scenario: Draft policy shows activate button
Given "API Rate Policy" is a draft policy
When Reiko views the policy detail
Then action buttons show "Activate" and "Edit"
And "Deprecate" and "Create New Version" are not available

### Scenario: Deprecated policy is read-only
Given "Legacy Spending" is deprecated at version 4
When Reiko views the policy detail
Then no action buttons are shown
And the status badge shows "deprecated"
And version history is still visible

### Scenario: Detail loads within performance budget
Given "Finance Controls" has 3 versions in its supersedes chain
When the detail page loads
Then all content renders within 1 second

### Scenario: Back navigation returns to list
Given Reiko is viewing the "Finance Controls" detail page
When she clicks the "Back to Policies" link
Then she is returned to the policy list page with her previous filter preserved

## Acceptance Criteria
- [ ] Detail page shows all PolicyRecord fields (title, description, status, version, selector, rules, human_veto_required, max_ttl, created_by, timestamps)
- [ ] Rules rendered in human-readable format (not raw JSON)
- [ ] Graph edges (governing, protects) displayed with resolved names
- [ ] Version history shows supersedes chain with statuses and dates
- [ ] Action buttons conditional on policy status (draft: activate/edit; active: deprecate/new version; deprecated/superseded: none)
- [ ] "Back to Policies" navigation preserves list filter state
- [ ] Detail loads within 1 second including version chain traversal

## Technical Notes
- GET /api/workspaces/:workspaceId/policies/:policyId endpoint
- Resolve supersedes chain via recursive query or iterative traversal
- Resolve governing/protects edges via graph traversal queries
- Resolve identity names for created_by and governing edges
- Follow EntityDetailPanel.tsx patterns for layout
- 1-2 days effort
