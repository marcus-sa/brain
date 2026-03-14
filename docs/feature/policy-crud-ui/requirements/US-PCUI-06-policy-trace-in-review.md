# US-PCUI-06: Policy Trace in Intent Review

## Problem
Marcus Oliveira is an intent reviewer who sees 3-5 flagged intents daily in his veto queue. He finds it frustrating that the consent screen shows only the LLM's risk_score and reason but not which policy rules flagged the intent -- he must guess why it needs his attention and re-evaluate from scratch.

## Who
- Intent Reviewer | Web browser, daily triage, often on 13" laptop | Wants to understand the policy basis for a flagged intent in seconds

## Solution
An expandable policy trace section in the intent review screen showing which policies were evaluated, which rules matched, and their effects -- with human-readable predicate rendering and navigation links to source policies.

## Job Story Trace
- Job 3: Understand Intent Evaluation Against Policies (Job Steps: Locate, Prepare, Confirm, Execute, Modify)

## Domain Examples
### 1: Happy Path -- Reviewer sees why intent was flagged
Marcus opens a flagged intent: "Purchase DataDog license for $800". The policy evaluation section shows "2 policies evaluated, 1 rule matched". He expands it. "Finance Controls v3" rule #1 matched: budget_limit.amount 800 > 500, effect: deny, priority: 100. Rule #2 did not match. "Code Deploy Limits v1" rule #1 did not match (action not github). A note says "Human veto required by: Finance Controls". Marcus clicks "Approve" with confidence.

### 2: No policy match -- Intent flagged by LLM only
Marcus opens a flagged intent with risk_score 72. The policy section shows "1 policy evaluated, 0 rules matched". The intent was flagged by the LLM tier, not by policy. Marcus focuses on the LLM reasoning instead.

### 3: Navigation -- Reviewer navigates to flagging policy
Marcus sees "Finance Controls v3" flagged the intent. He clicks "View Policy" and is taken to the Finance Controls detail page to review whether the rule threshold should be adjusted.

## UAT Scenarios (BDD)

### Scenario: Reviewer sees collapsed policy trace summary
Given an intent to "Purchase DataDog license for $800" is pending_veto
And it was evaluated against 2 policies with 1 rule match
When Marcus Oliveira opens the intent review screen
Then the policy evaluation section shows "2 policies evaluated, 1 rule matched"
And the section is collapsed by default

### Scenario: Reviewer expands policy trace for full detail
Given Marcus is viewing the collapsed policy trace
When he clicks to expand the policy evaluation section
Then he sees "Finance Controls (v3)" with rule #1: matched (800 > 500), effect: deny, priority: 100
And "Finance Controls (v3)" rule #2: not matched
And "Code Deploy Limits (v1)" rule #1: not matched
And a "View Policy" link next to each policy title

### Scenario: Reviewer navigates from trace to source policy
Given Marcus is viewing the expanded policy trace
When he clicks "View Policy" next to "Finance Controls"
Then he is navigated to the policy detail page for "Finance Controls"

### Scenario: Human-veto reason displayed
Given "Finance Controls" has human_veto_required = true
And this policy matched the intent
When Marcus views the policy trace
Then a note appears: "Human veto required by: Finance Controls"

### Scenario: Intent flagged by LLM only (no policy match)
Given an intent was evaluated against 1 policy with 0 rule matches
And the intent was flagged by the LLM tier (risk_score 72)
When Marcus opens the intent review screen
Then the policy section shows "1 policy evaluated, 0 rules matched"
And the policy trace contains no matched rules

### Scenario: Policy trace renders predicates in human-readable form
Given a policy trace entry has condition field "budget_limit.amount", operator "gt", value "500"
When the trace is rendered
Then the condition displays as "budget_limit.amount > 500" (not raw JSON)

## Acceptance Criteria
- [ ] Policy trace section appears in intent review/consent screen
- [ ] Collapsed summary shows count of policies evaluated and rules matched
- [ ] Expanded view shows each policy with title, version, and per-rule detail
- [ ] Rule detail includes: rule ID, condition (human-readable), matched status with actual vs threshold, effect, priority
- [ ] "View Policy" link navigates to policy detail page
- [ ] Note when human_veto_required was the flagging reason
- [ ] Graceful display when 0 rules matched (LLM-only flagging)
- [ ] Predicates rendered in human-readable format, not raw JSON

## Technical Notes
- Reads intent.evaluation.policy_trace from existing intent record
- Enhance consent endpoint to include policy titles/versions (currently only returns risk_score and reason)
- Resolve policy titles by batch-loading policy records referenced in trace
- Uses progressive disclosure (collapsed/expanded) to avoid overwhelming the review screen
- Follows existing intent review patterns in consent-page.tsx
- 1-2 days effort
