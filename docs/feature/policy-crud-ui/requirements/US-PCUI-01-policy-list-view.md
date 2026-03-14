# US-PCUI-01: Policy List View

## Problem
Reiko Tanaka is an org admin who manages governance for a workspace with 5 autonomous agents. She finds it impossible to know which policies are active, draft, or deprecated because there is no UI to browse policies -- she must ask a developer to run a SurrealDB query.

## Who
- Org Admin | Web browser, weekly check-in | Wants to understand workspace governance posture at a glance

## Solution
A policy list page accessible from the workspace sidebar showing all policies in a filterable table with status tabs.

## Job Story Trace
- Job 1: Define Governance Rules via UI (Job Steps: Define, Locate)

## Domain Examples
### 1: Happy Path -- Reiko browses active policies
Reiko Tanaka navigates to /workspace/acme-corp/policies. She sees a table with 6 rows: "Finance Controls" (active, v3), "Code Deploy Limits" (active, v1), "Data Access Rules" (active, v2), "API Rate Policy" (draft, v1), "Experiment Budget" (draft, v1), "Legacy Spending" (deprecated, v4). She clicks the "Active (3)" tab to filter to just the active policies.

### 2: Empty State -- New workspace with no policies
Reiko opens the policies page for "new-startup" workspace. Instead of an empty table, she sees an illustration with the text "No policies yet. Policies are governance rules that control what agents can do in your workspace." and a "Create your first policy" button.

### 3: Filtering -- Draft policies only
Reiko clicks the "Draft (2)" tab. The table narrows to show only "API Rate Policy" and "Experiment Budget". The tab is highlighted, and the count badge confirms 2 items.

## UAT Scenarios (BDD)

### Scenario: Org admin views policy list with mixed statuses
Given Reiko Tanaka is authenticated in workspace "acme-corp"
And the workspace has 3 active, 2 draft, and 1 deprecated policy
When she navigates to the policies page
Then she sees a table with 6 rows showing title, status, version, created_by, and updated_at
And the status filter tabs show "All (6)", "Active (3)", "Draft (2)", "Deprecated (1)"

### Scenario: Empty state for workspace with no policies
Given workspace "new-startup" has no policies
When Reiko navigates to the policies page
Then she sees an empty state with an explanation of what policies are
And a "Create your first policy" call to action button

### Scenario: Filter policies by status tab
Given Reiko is on the policies page with 6 policies
When she clicks the "Draft" tab
Then only 2 draft policies are displayed
And the "Draft (2)" tab is visually highlighted

### Scenario: Policy list shows created_by name (not raw ID)
Given a policy was created by identity "Reiko Tanaka" (id: identity:reiko-001)
When the policy list loads
Then the "Created By" column shows "Reiko Tanaka" (not the raw identity ID)

### Scenario: Policy list loads within performance budget
Given workspace "acme-corp" has 50 policies across all statuses
When Reiko navigates to the policies page
Then the table renders within 500ms

## Acceptance Criteria
- [ ] Policy list table shows title, status, version, created_by name, and updated_at for each policy
- [ ] Status filter tabs show counts and filter the table when clicked
- [ ] Empty state renders with explanation and CTA when no policies exist
- [ ] Created_by displays resolved identity name, not raw RecordId
- [ ] List loads within 500ms for up to 100 policies
- [ ] All interactive elements keyboard-accessible with visible focus indicators

## Technical Notes
- GET /api/workspaces/:workspaceId/policies endpoint with optional `?status=` filter
- Resolve identity names via join or batch lookup (avoid N+1 queries)
- Follow Learning Library list UI patterns (StatusTabs, LearningList -> PolicyList)
- Add "Policies" item to WorkspaceSidebar.tsx navigation
- Wire up client route in router.tsx
