# US-PCUI-07: Policy Version History and Diff

## Problem
Ayumi Sato is a compliance auditor who needs to demonstrate that agent actions were governed by the correct policies during Q1 2026. She finds it impossible to see when policy versions were active or what changed between them because there is no version history UI -- she must query SurrealDB directly and manually compare JSON records.

## Who
- Compliance Auditor | Web browser, monthly audit cycles | Wants to browse and compare policy versions for compliance reporting
- Org Admin | Web browser, after versioning | Wants to verify what changed between the version she just created and the previous one

## Solution
A version history timeline in the policy detail view with a diff viewer for comparing adjacent versions.

## Job Story Trace
- Job 4: Verify Policy Compliance Over Time (Job Steps: Browse, Confirm, Execute)

## Domain Examples
### 1: Happy Path -- Ayumi views version timeline
Ayumi opens "Finance Controls" detail page. The version history section shows: v3 (active, Mar 14 2026), v2 (superseded, Mar 10 2026), v1 (superseded, Mar 01 2026). Each adjacent pair has a "View Diff" link. She can see that v3 has been active for 4 days.

### 2: Diff between adjacent versions
Ayumi clicks "View Diff" between v2 and v3. The diff shows: Rule #1 (max_spend): unchanged. Rule #2 (allow_reads): ADDED with full condition details. Options: unchanged. Selector: no changes.

### 3: Single version -- No diff available
Ayumi views a policy at version 1 with no supersedes chain. The version history shows only v1. No "View Diff" is available since there is no prior version to compare against.

## UAT Scenarios (BDD)

### Scenario: View version history timeline
Given "Finance Controls" has versions v1 (superseded, Mar 01), v2 (superseded, Mar 10), v3 (active, Mar 14)
When Ayumi Sato views the policy detail page
Then the version history shows 3 entries in reverse chronological order
And each entry displays version number, status, and creation date
And "View Diff" links appear between v2-v3 and v1-v2

### Scenario: View diff showing added rule
Given "Finance Controls" v2 has 1 rule and v3 has 2 rules
When Ayumi clicks "View Diff" between v2 and v3
Then the diff shows Rule #1 as "unchanged"
And Rule #2 as "ADDED" with the full condition details
And unchanged options are labeled "unchanged"

### Scenario: View diff showing changed rule value
Given v1 has rule "budget_limit.amount gt 1000" and v2 has "budget_limit.amount gt 500"
When Ayumi clicks "View Diff" between v1 and v2
Then the diff shows Rule #1 value changed from "1000" to "500"

### Scenario: View diff showing removed rule
Given v2 has 3 rules and v3 has 2 rules (one removed)
When Ayumi views the diff
Then the removed rule is shown with "REMOVED" label

### Scenario: Single version has no diff
Given "New Policy" is at version 1 with no prior versions
When Ayumi views the policy detail
Then the version history shows only v1
And no "View Diff" link is available

## Acceptance Criteria
- [ ] Version history section shows all versions in supersedes chain
- [ ] Each version displays: version number, status, creation date
- [ ] "View Diff" available between each adjacent version pair
- [ ] Diff identifies added, removed, changed, and unchanged rules
- [ ] Diff shows changes in options (human_veto_required, max_ttl) and selector
- [ ] Single-version policies show history with no diff link
- [ ] Version history loads within 1 second

## Technical Notes
- Supersedes chain traversal: follow policy.supersedes references recursively until no more
- Diff computation: compare rules by ID (matched = same id, check condition/effect/priority changes; unmatched old = removed; unmatched new = added)
- Diff can be computed client-side from two PolicyRecord objects (no server-side diff endpoint needed)
- Follows existing DiffViewer.tsx patterns from the review page
- Could reuse diff-parser.ts concepts for structured data comparison
- 1-2 days effort
