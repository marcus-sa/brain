# Policy CRUD UI -- Jobs-to-be-Done: Job Stories

> Builds on the prior policy-node JTBD analysis (docs/ux/policy-node/jtbd-job-stories.md).
> The policy-node feature delivered the **backend infrastructure** (schema, evaluation pipeline, graph relations).
> This feature delivers the **human-facing surface** -- API endpoints + management UI for the DEFINE, REVIEW, EVOLVE, and AUDIT phases.

---

## Job 1: Define Governance Rules via UI (Org Admin)

**When** I need to create a new policy to control what agents can do in my workspace,
**I want to** compose structured rules through a guided form that validates my predicates as I build them,
**So I can** deploy governance rules without writing raw JSON or asking a developer to edit code.

### Job Dimensions

| Dimension | Description |
|-----------|-------------|
| **Functional** | Create a policy with title, description, selector scope, structured rule predicates ({field, operator, value}), effect (allow/deny), priority, human_veto_required flag, and max_ttl -- all through a web form that validates inputs before submission |
| **Emotional** | Feel empowered and in control -- "I can set the rules myself without needing engineering help" |
| **Social** | Be seen as a competent governance lead -- "Our policies are structured, not ad-hoc" |

### 8-Step Job Map

| Job Step | Goal | Desired Outcome |
|----------|------|-----------------|
| Define | Determine which agent behaviors to govern | Minimize time to identify which actions need constraints |
| Locate | Find existing policies to avoid duplication | Minimize likelihood of creating conflicting or redundant policies |
| Prepare | Open the policy editor with the right selector scope | Minimize steps to reach a valid starting state |
| Confirm | Review the assembled rules before saving | Minimize likelihood of deploying a misconfigured rule |
| Execute | Save the policy in draft status | Minimize time from decision to persisted policy |
| Monitor | Verify the policy appears in the list with correct status | Minimize uncertainty about whether the save succeeded |
| Modify | Edit a draft policy before activation | Minimize friction to iterate on rules before they take effect |
| Conclude | Activate the policy when confident | Minimize anxiety about the activation being irreversible |

---

## Job 2: Manage Policy Lifecycle (Org Admin)

**When** a policy needs to evolve because business rules changed or an agent hit an unintended deny,
**I want to** create a new version of an existing policy that supersedes the old one while preserving version history,
**So I can** adapt governance rules without losing the audit trail of what was active when.

### Job Dimensions

| Dimension | Description |
|-----------|-------------|
| **Functional** | Activate draft policies (creating governing/protects edges), deprecate stale policies (removing edges), create new versions that supersede current active ones -- with confirmation dialogs for each irreversible transition |
| **Emotional** | Feel safe making changes -- "I can evolve rules without breaking what's already working" |
| **Social** | Demonstrate governance maturity -- "We version our policies and can show the history" |

### 8-Step Job Map

| Job Step | Goal | Desired Outcome |
|----------|------|-----------------|
| Define | Determine that a policy change is needed | Minimize time to identify which policy needs updating |
| Locate | Find the current active version of the policy | Minimize likelihood of editing the wrong version |
| Prepare | Open the version creation form pre-populated with current rules | Minimize manual re-entry of unchanged rules |
| Confirm | Compare old vs new version side by side | Minimize likelihood of unintended rule changes |
| Execute | Save new version and deprecate the old | Minimize time for the transition to take effect |
| Monitor | Verify the new version is active and old is superseded | Minimize uncertainty about which version agents see |
| Modify | Roll back by re-activating the old version if needed | Minimize time to recover from a bad policy update |
| Conclude | Verify agents are evaluated under the correct version | Minimize likelihood of policy version confusion |

---

## Job 3: Understand Intent Evaluation Against Policies (Reviewer)

**When** an intent arrives in my veto queue and I need to decide whether to approve or reject it,
**I want to** see exactly which policy rules were evaluated, which matched, and what effect each had,
**So I can** make an informed approve/veto decision in seconds instead of re-evaluating from scratch.

### Job Dimensions

| Dimension | Description |
|-----------|-------------|
| **Functional** | View the policy evaluation trace alongside the intent details -- see policy title, rule ID, condition that matched, effect (allow/deny), and priority. Click through to the source policy for full context |
| **Emotional** | Feel informed rather than guessing -- "I know exactly why this intent needs my attention" |
| **Social** | Demonstrate due diligence to stakeholders -- "I reviewed against our stated governance policies" |

### 8-Step Job Map

| Job Step | Goal | Desired Outcome |
|----------|------|-----------------|
| Define | Understand what the intent is requesting | Minimize time to grasp the intent's goal and risk |
| Locate | Find the policy trace in the evaluation details | Minimize likelihood of missing the policy context |
| Prepare | Expand the trace to see individual rule evaluations | Minimize steps to reach the full evaluation detail |
| Confirm | Verify the flagging rule is correct (not a false positive) | Minimize likelihood of approving a genuinely risky intent |
| Execute | Click approve or veto with optional reason | Minimize time from decision to recorded action |
| Monitor | See confirmation that the decision was recorded | Minimize uncertainty about whether the action took effect |
| Modify | Navigate to the source policy if the rule seems wrong | Minimize time to identify and fix a misconfigured policy |
| Conclude | Return to the pending queue to handle next intent | Minimize context-switch cost between reviews |

---

## Job 4: Verify Policy Compliance Over Time (Auditor)

**When** I need to demonstrate that agent actions were governed by the correct policies during a given period,
**I want to** view the version history of each policy with diffs between versions and query which intents were evaluated under which policy version,
**So I can** produce a compliance report showing governance was active and correctly applied.

### Job Dimensions

| Dimension | Description |
|-----------|-------------|
| **Functional** | View policy version timeline with creation dates, status transitions, and rule diffs between adjacent versions. Filter policy list by status (active, deprecated, superseded). See which intents reference each policy version in their evaluation trace |
| **Emotional** | Feel assured the audit trail is complete -- "Every decision is traceable to a specific policy version" |
| **Social** | Satisfy external compliance requirements -- "Here's the structured governance record" |

### 8-Step Job Map

| Job Step | Goal | Desired Outcome |
|----------|------|-----------------|
| Define | Determine the compliance scope (time period, workspace, policy) | Minimize time to scope the audit |
| Locate | Find the relevant policy and its version history | Minimize likelihood of examining the wrong policy lineage |
| Prepare | Open the version history timeline for the target policy | Minimize steps to reach the audit-relevant view |
| Confirm | Verify each version was active during the expected period | Minimize likelihood of compliance gaps (periods with no active version) |
| Execute | Compare versions to identify what changed | Minimize time to understand the diff between adjacent versions |
| Monitor | Cross-reference intent traces against the active version | Minimize likelihood of intents evaluated under a wrong version |
| Modify | Flag discrepancies as observations in the graph | Minimize time to record audit findings |
| Conclude | Export or summarize the compliance findings | Minimize effort to produce the audit deliverable |

---

## JTBD-to-Story Bridge

| Job | Primary User Stories |
|-----|---------------------|
| Job 1 (Define Rules via UI) | US-PCUI-01 (Policy list view), US-PCUI-02 (Create policy form), US-PCUI-03 (Rule builder) |
| Job 2 (Manage Lifecycle) | US-PCUI-04 (Activate policy), US-PCUI-05 (Deprecate policy), US-PCUI-06 (Create new version) |
| Job 3 (Understand Evaluation) | US-PCUI-07 (Policy trace in intent review) |
| Job 4 (Verify Compliance) | US-PCUI-08 (Policy version history), US-PCUI-09 (Policy detail view) |
