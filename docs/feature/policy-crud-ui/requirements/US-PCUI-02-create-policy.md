# US-PCUI-02: Create Policy with Rule Builder

## Problem
Reiko Tanaka is an org admin who needs to create a spending limit policy for her workspace. She finds it impossible to do so because there is no HTTP endpoint or UI for policy creation -- only acceptance test helpers (createPolicy()) that require direct server access.

## Who
- Org Admin | Web browser, building governance rules | Wants to create structured policies without developer assistance

## Solution
A policy creation form with a structured rule builder that validates predicates in real time and shows human-readable previews.

## Job Story Trace
- Job 1: Define Governance Rules via UI (Job Steps: Prepare, Confirm, Execute, Monitor)

## Domain Examples
### 1: Happy Path -- Reiko creates a spending limit policy
Reiko clicks "+ New Policy" on the policies page. She enters title "Finance Controls", description "Limits agent spending over $500". She adds a rule: field "budget_limit.amount", operator "gt", value "500", effect "deny", priority "100". The preview shows "Deny when budget_limit.amount > 500". She checks "Require human veto window" and clicks "Save as Draft". The policy is created with status "draft", version 1, and she's redirected to its detail page.

### 2: Validation Error -- Unknown field path
Reiko types "budgetlimit.amoun" in the field input. When she tabs away, an inline error appears: "Unknown field. Did you mean 'budget_limit.amount'?" The "Save as Draft" button is disabled until she corrects it.

### 3: Multiple Rules -- Allow-list plus deny rule
Reiko adds two rules: (1) deny when budget_limit.amount > 500 at priority 100, and (2) allow when action_spec.action is in ["read_file", "search", "list_tasks"] at priority 50. Both show previews. She saves. The policy has 2 rules.

### 4: Edge Case -- Empty form submission
Reiko clicks "Save as Draft" without entering a title or adding rules. Inline errors appear on the title field ("Title is required") and the rules section ("At least one rule is required").

## UAT Scenarios (BDD)

### Scenario: Create a spending limit policy
Given Reiko is on the "Create Policy" form in workspace "acme-corp"
When she enters title "Finance Controls" and description "Limits agent spending over $500"
And adds a rule with field "budget_limit.amount", operator "gt", value "500", effect "deny", priority "100"
And checks "Require human veto window"
And clicks "Save as Draft"
Then a policy is created with status "draft", version 1, and title "Finance Controls"
And she is redirected to the policy detail page
And a success notification confirms the creation

### Scenario: Rule builder validates unknown field path
Given Reiko is building a rule in the policy form
When she enters "budgetlimit.amoun" in the field input
And moves focus to the next field
Then an inline error appears: "Unknown field. Did you mean 'budget_limit.amount'?"
And the "Save as Draft" button is disabled

### Scenario: Rule builder validates operator-value type mismatch
Given Reiko selects operator "gt" (greater than)
When she enters value "not-a-number"
Then an inline error appears: "Operator 'gt' requires a numeric value"

### Scenario: Rule preview renders human-readable text
Given Reiko has configured a rule with field "budget_limit.amount", operator "gt", value "500", effect "deny"
Then the rule preview displays "Deny when budget_limit.amount > 500"

### Scenario: Form rejects submission without title
Given Reiko has added 1 valid rule but left the title empty
When she clicks "Save as Draft"
Then inline error "Title is required" appears on the title field
And the form is not submitted

### Scenario: Form rejects submission without rules
Given Reiko has entered a title but added no rules
When she clicks "Save as Draft"
Then an error message appears: "At least one rule is required"

### Scenario: Create policy with allow-list rule using "in" operator
Given Reiko adds a rule with field "action_spec.action", operator "in", value "read_file, search, list_tasks", effect "allow"
And clicks "Save as Draft"
Then the rule is saved with value parsed as array ["read_file", "search", "list_tasks"]

## Acceptance Criteria
- [ ] Form captures title (required), description, selector, rules[], human_veto_required, max_ttl
- [ ] Rule builder offers field autocomplete from IntentEvaluationContext known fields
- [ ] Operator dropdown adapts to field type (numeric vs string)
- [ ] Inline validation on blur for field path, operator-value type match, and required fields
- [ ] Human-readable rule preview updates in real time
- [ ] Server validates predicate structure and returns 400 with specific error for invalid input
- [ ] Policy always created as "draft" with version 1
- [ ] Redirect to detail view on successful creation
- [ ] Agent identities receive 403 when calling POST endpoint

## Technical Notes
- POST /api/workspaces/:workspaceId/policies endpoint
- Reuse existing createPolicy() from policy-queries.ts
- Known fields derived from IntentEvaluationContext type -- maintain as constant array
- Operator-to-value-type mapping: {gt, gte, lt, lte} -> number; {eq, neq} -> string|number|boolean; {in, not_in} -> string[]; {exists} -> boolean
- Form follows existing patterns from CreateDialog in learnings (modal form with validation)
- 1-2 days effort
