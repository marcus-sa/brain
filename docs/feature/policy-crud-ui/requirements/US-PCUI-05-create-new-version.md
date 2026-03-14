# US-PCUI-05: Create New Policy Version

## Problem
Reiko Tanaka is an org admin who needs to update the spending limit in "Finance Controls" from $500 to $1000. She finds it impossible to create a new version because there is no versioning endpoint -- she must create an entirely new policy manually and hope the old one gets cleaned up.

## Who
- Org Admin | Web browser, evolving governance rules | Wants to iterate on policies while preserving version history

## Solution
A version creation endpoint and UI that pre-populates from the current active version, allowing rule modifications before saving as a new draft.

## Job Story Trace
- Job 2: Manage Policy Lifecycle (Job Steps: Prepare, Confirm, Execute, Monitor)

## Domain Examples
### 1: Happy Path -- Create v4 from active v3
Reiko views "Finance Controls" (active, v3, 2 rules). She clicks "Create New Version". A form opens pre-populated with the current title, description, selector, and rules. She changes the budget_limit.amount threshold from 500 to 1000 in rule #1. She clicks "Save as New Version". A new policy is created at version 4 with status "draft". The v3 policy remains active until v4 is activated.

### 2: Activate new version supersedes old
Reiko activates "Finance Controls" v4. The v4 status becomes "active" with new governing/protects edges. The v3 status automatically transitions to "superseded" and its edges are removed.

### 3: Edge Case -- Concurrent version creation
Two admins try to create a new version of the same policy simultaneously. The first succeeds. The second gets a conflict: "A newer version (v4) already exists as draft."

## UAT Scenarios (BDD)

### Scenario: Create new version pre-populated from current
Given "Finance Controls" is active at version 3 with 2 rules
When Reiko clicks "Create New Version"
Then a form opens with title, description, selector, and rules copied from v3
And the version field shows "v4 (new)"
And the rules are editable

### Scenario: Save modified version as draft
Given Reiko has the new version form open for "Finance Controls"
When she changes rule #1 value from "500" to "1000"
And clicks "Save as New Version"
Then a new policy is created at version 4 with status "draft"
And the new policy's supersedes field references the v3 policy
And v3 remains "active" until v4 is activated

### Scenario: Activating new version supersedes the old
Given "Finance Controls" v4 is "draft" and v3 is "active"
When Reiko activates v4
Then v4 becomes "active" with governing and protects edges
And v3 transitions to "superseded"
And v3's governing and protects edges are removed

### Scenario: Only active policies can be versioned
Given "API Rate Policy" is a "draft" policy
When a POST request is sent to the versions endpoint
Then the response is 409 with message "Only active policies can be versioned"

### Scenario: Version number auto-increments
Given "Finance Controls" is at version 3
When a new version is created
Then the new version number is 4

## Acceptance Criteria
- [ ] POST /api/workspaces/:workspaceId/policies/:policyId/versions creates new version
- [ ] New version copies title, description, selector, rules, human_veto_required, max_ttl from source
- [ ] Version number auto-increments from source version
- [ ] New version created as "draft" with supersedes reference to source
- [ ] Only active policies can be versioned (409 otherwise)
- [ ] Activating new version atomically supersedes old version (removes old edges)
- [ ] Form pre-populates from source version allowing modification

## Technical Notes
- POST /api/workspaces/:workspaceId/policies/:policyId/versions endpoint
- Internally calls createPolicy() with modified params + supersedes reference
- Activation of a versioned policy must atomically: activate new, supersede old, swap edges
- Modify activatePolicy() to check for supersedes and handle the old version transition
- 1-2 days effort
