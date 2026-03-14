# Policy CRUD UI -- Journey: Policy Management (Visual)

> Covers the human-facing surface for DEFINE, EVOLVE, REVIEW, and AUDIT phases.
> The ENFORCE phase is automated (authorizer pipeline) and unchanged by this feature.

---

## Journey Overview

```
                          POLICY MANAGEMENT JOURNEY
  ============================================================================

  [LIST]          [CREATE]         [ACTIVATE]       [REVIEW]        [AUDIT]
  Browse &        Build rules      Go live          See policy      Version
  filter          via form         with edges       trace on        history &
  policies                                          flagged         compliance
                                                    intents
    |                |                |                |               |
    v                v                v                v               v

  Curious         Focused          Confident        Informed        Assured
  "What do        "I'm building    "This is         "I know why     "Every
   we have?"       something        ready to          this was       decision
                   precise"         enforce"          flagged"       is traced"

  ============================================================================
```

---

## Step 1: Policy List View

**Actor**: Reiko Tanaka (Org Admin)
**Trigger**: Navigates to /workspace/:id/policies from sidebar
**Emotion**: Curious -> Oriented

```
+--------------------------------------------------------------------------+
|  BRAIN  |  Chat  |  Graph  |  Feed  |  Learnings  | *Policies* | Search  |
+--------------------------------------------------------------------------+
|                                                                          |
|  Policies                                            [ + New Policy ]    |
|                                                                          |
|  Status: [ All ] [ Active (3) ] [ Draft (2) ] [ Deprecated (1) ]        |
|                                                                          |
|  +--------------------------------------------------------------------+  |
|  |  Title              | Status    | Version | Created By  | Updated  |  |
|  +---------------------+-----------+---------+-------------+----------+  |
|  |  Finance Controls   | active    | v3      | Reiko T.    | 2h ago   |  |
|  |  Code Deploy Limits | active    | v1      | Reiko T.    | 3d ago   |  |
|  |  Data Access Rules  | active    | v2      | Marcus O.   | 1w ago   |  |
|  |  API Rate Policy    | draft     | v1      | Reiko T.    | 5m ago   |  |
|  |  Experiment Budget  | draft     | v1      | Ayumi S.    | 1d ago   |  |
|  |  Legacy Spending    | deprecated| v4      | Reiko T.    | 2w ago   |  |
|  +--------------------------------------------------------------------+  |
|                                                                          |
|  Showing 6 policies                                                      |
+--------------------------------------------------------------------------+
```

**Empty State** (first visit, no policies):
```
+--------------------------------------------------------------------------+
|  Policies                                            [ + New Policy ]    |
|                                                                          |
|           +--------------------------------------------+                 |
|           |                                            |                 |
|           |    No policies yet                         |                 |
|           |                                            |                 |
|           |    Policies are governance rules that      |                 |
|           |    control what agents can do in your      |                 |
|           |    workspace. Each policy contains         |                 |
|           |    structured rules with allow/deny        |                 |
|           |    effects evaluated before every          |                 |
|           |    agent action.                           |                 |
|           |                                            |                 |
|           |    [ Create your first policy ]            |                 |
|           +--------------------------------------------+                 |
+--------------------------------------------------------------------------+
```

---

## Step 2: Create Policy Form

**Actor**: Reiko Tanaka (Org Admin)
**Trigger**: Clicks "+ New Policy" button
**Emotion**: Focused -> Deliberate

```
+--------------------------------------------------------------------------+
|  Create Policy                                              [ Cancel ]   |
+--------------------------------------------------------------------------+
|                                                                          |
|  Title *                                                                 |
|  [ Finance Controls                                          ]           |
|                                                                          |
|  Description                                                             |
|  [ Limits agent spending and requires human approval for     ]           |
|  [ purchases over $500.                                      ]           |
|                                                                          |
|  --- Scope (Selector) ------------------------------------------         |
|                                                                          |
|  Agent Role       [ Any agent        v ]                                 |
|  Resource         [ Any resource     v ]                                 |
|                                                                          |
|  --- Rules --------------------------------------------------            |
|                                                                          |
|  Rule 1                                          [ Remove ]              |
|  +----------------------------------------------------------------+      |
|  |  Condition:                                                    |      |
|  |    Field:    [ budget_limit.amount    ]                        |      |
|  |    Operator: [ greater than (gt)    v ]                        |      |
|  |    Value:    [ 500                    ]                        |      |
|  |                                                                |      |
|  |  Effect:   ( ) Allow   (*) Deny                                |      |
|  |  Priority: [ 100          ]                                    |      |
|  |                                                                |      |
|  |  Preview: "Deny when budget_limit.amount > 500"               |      |
|  +----------------------------------------------------------------+      |
|                                                                          |
|  [ + Add Rule ]                                                          |
|                                                                          |
|  --- Options ------------------------------------------------            |
|                                                                          |
|  [x] Require human veto window for matching intents                      |
|  Max token TTL:  [ 1h              ]  (optional)                         |
|                                                                          |
|  +------------------------------------------------------------------+    |
|  |                   [ Save as Draft ]                               |    |
|  +------------------------------------------------------------------+    |
+--------------------------------------------------------------------------+
```

**Validation Error State** (inline, on blur):
```
|  Field:    [ budget_limit.amoun  ]                            |
|            ! Unknown field. Did you mean "budget_limit.amount"?|
```

---

## Step 3: Policy Detail View

**Actor**: Reiko / Marcus / Ayumi (all personas)
**Trigger**: Clicks a policy row in the list
**Emotion**: Informed -> Confident

```
+--------------------------------------------------------------------------+
|  < Back to Policies                                                      |
+--------------------------------------------------------------------------+
|                                                                          |
|  Finance Controls                                   Status: active       |
|  Version 3 | Created by Reiko Tanaka | Updated 2 hours ago              |
|                                                                          |
|  Limits agent spending and requires human approval for purchases         |
|  over $500.                                                              |
|                                                                          |
|  +------------------------------------------------------------------+    |
|  |  Actions:  [ Deprecate ]  [ Create New Version ]                 |    |
|  +------------------------------------------------------------------+    |
|                                                                          |
|  --- Scope -------------------------------------------------------       |
|  Agent Role: Any   |   Resource: Any                                     |
|                                                                          |
|  --- Rules (2) ---------------------------------------------------       |
|                                                                          |
|  #1  DENY when budget_limit.amount > 500              Priority: 100     |
|      Condition: budget_limit.amount gt 500                               |
|                                                                          |
|  #2  ALLOW when action_spec.action in                 Priority: 50      |
|      ["read_file", "search", "list_tasks"]                               |
|      Condition: action_spec.action in [read_file, search, list_tasks]    |
|                                                                          |
|  --- Options -----------------------------------------------------       |
|  Human veto required: Yes                                                |
|  Max token TTL: 1 hour                                                   |
|                                                                          |
|  --- Graph Edges -------------------------------------------------       |
|  Governing: identity:reiko-tanaka -> policy:finance-001                  |
|  Protects:  policy:finance-001 -> workspace:acme-corp                    |
|                                                                          |
|  --- Version History ---------------------------------------------       |
|                                                                          |
|   v3 (active)    Mar 14 2026   Added rule #2 (allow read actions)        |
|   |                                                     [ View Diff ]    |
|   v2 (superseded) Mar 10 2026   Changed budget cap from 1000 to 500     |
|   |                                                     [ View Diff ]    |
|   v1 (superseded) Mar 01 2026   Initial version                         |
|                                                                          |
+--------------------------------------------------------------------------+
```

---

## Step 4: Activate Policy (Confirmation Dialog)

**Actor**: Reiko Tanaka (Org Admin)
**Trigger**: Clicks "Activate" on a draft policy
**Emotion**: Cautious -> Confident

```
+----------------------------------------------------+
|  Activate Policy                              [ X ] |
+----------------------------------------------------+
|                                                     |
|  You are about to activate:                         |
|                                                     |
|    "API Rate Policy" (v1, draft)                    |
|                                                     |
|  This will:                                         |
|    * Set status to "active"                         |
|    * Create governing edge (you -> policy)          |
|    * Create protects edge (policy -> workspace)     |
|    * Agents will be evaluated against these rules   |
|      on their next intent submission                |
|                                                     |
|  Active policies in this workspace: 3               |
|  No conflicting rules detected.                     |
|                                                     |
|           [ Cancel ]    [ Activate Policy ]          |
+----------------------------------------------------+
```

---

## Step 5: Policy Trace in Intent Review

**Actor**: Marcus Oliveira (Reviewer)
**Trigger**: Opens a flagged intent in the veto queue
**Emotion**: Uncertain -> Informed -> Decisive

```
+--------------------------------------------------------------------------+
|  Intent Review: pending_veto                              Expires: 45m   |
+--------------------------------------------------------------------------+
|                                                                          |
|  Goal: Purchase monitoring license for DataDog                           |
|  Reasoning: Team needs APM tool for production observability             |
|  Agent: architect-agent                                                  |
|  Budget: $800.00 USD                                                     |
|                                                                          |
|  --- Risk Assessment ---                                                 |
|  Risk Score: 65 | LLM Reason: "High budget request, exceeds typical"    |
|                                                                          |
|  --- Policy Evaluation (v) --------------------------------- [expand]    |
|                                                                          |
|  2 policies evaluated, 1 rule matched                                    |
|                                                                          |
|  +----------------------------------------------------------------+      |
|  | Policy: Finance Controls (v3)              [View Policy ->]    |      |
|  |   Rule #1: budget_limit.amount gt 500      Effect: DENY       |      |
|  |   Matched: YES (800 > 500)                 Priority: 100      |      |
|  |                                                                |      |
|  |   Rule #2: action_spec.action in [...]     Effect: ALLOW      |      |
|  |   Matched: NO                              Priority: 50       |      |
|  +----------------------------------------------------------------+      |
|  | Policy: Code Deploy Limits (v1)            [View Policy ->]    |      |
|  |   Rule #1: action_spec.provider eq github  Effect: DENY       |      |
|  |   Matched: NO                              Priority: 100      |      |
|  +----------------------------------------------------------------+      |
|                                                                          |
|  Human veto required by: Finance Controls                                |
|                                                                          |
|  +------------------------------------------------------------------+    |
|  |  Reason (optional): [                                      ]     |    |
|  |                                                                  |    |
|  |         [ Veto (Reject) ]              [ Approve ]               |    |
|  +------------------------------------------------------------------+    |
+--------------------------------------------------------------------------+
```

---

## Step 6: Version Diff View

**Actor**: Ayumi Sato (Auditor) / Reiko Tanaka (Org Admin)
**Trigger**: Clicks "View Diff" in version history
**Emotion**: Analytical -> Assured

```
+--------------------------------------------------------------------------+
|  Finance Controls: v2 -> v3                                              |
+--------------------------------------------------------------------------+
|                                                                          |
|  Changes between version 2 (Mar 10) and version 3 (Mar 14):             |
|                                                                          |
|  Rules:                                                                  |
|    Rule #1 (max_spend): unchanged                                        |
|  + Rule #2 (allow_reads): ADDED                                         |
|  +   Condition: action_spec.action in [read_file, search, list_tasks]   |
|  +   Effect: allow                                                       |
|  +   Priority: 50                                                        |
|                                                                          |
|  Options:                                                                |
|    human_veto_required: unchanged (true)                                 |
|    max_ttl: unchanged (1h)                                               |
|                                                                          |
|  Selector:                                                               |
|    No changes                                                            |
|                                                                          |
|                                            [ Close ]                     |
+--------------------------------------------------------------------------+
```

---

## Emotional Arc

```
Confidence
    ^
    |                                              +-- 5. Policy trace
    |                                    +-- 4.    |  (informed -> decisive)
    |                         +-- 3.     | Activate|
    |              +-- 2.     | Detail   | (confident)           +-- 6. Diff
    |    +-- 1.    | Create   | (informed)                       | (assured)
    |    | List    | (focused)|                                  |
    |    | (curious)          |                                  |
    +----+----+----+----+-----+----+-----+----+-----+----+------+--------->
         LIST     CREATE    DETAIL    ACTIVATE   REVIEW     AUDIT

    Curious -> Focused -> Informed -> Confident -> Informed -> Assured
```

The arc builds confidence progressively:
- **List**: Orientation -- "what policies exist?" (curious)
- **Create**: Construction -- building structured rules with validation (focused, deliberate)
- **Detail**: Comprehension -- seeing the full policy with its edges and history (informed)
- **Activate**: Commitment -- going live with confirmation (confident)
- **Review**: Evaluation -- seeing policy trace on flagged intents (informed, decisive)
- **Audit**: Verification -- version timeline and diffs (analytical, assured)

---

## Error Paths

| Step | Error | User Sees | Recovery |
|------|-------|-----------|----------|
| 2 (Create) | Invalid field path in predicate | Inline validation: "Unknown field. Known fields: budget_limit.amount, action_spec.provider, ..." | User corrects the field path |
| 2 (Create) | Operator/value type mismatch | Inline validation: "Operator 'gt' requires a numeric value" | User changes value or operator |
| 4 (Activate) | Conflicting deny rule in another active policy | Warning in dialog: "Policy 'X' has a conflicting deny rule on the same field" | User reviews conflict, proceeds or cancels |
| 4 (Activate) | Policy has no rules | Error: "Cannot activate a policy with no rules" | User adds at least one rule |
| 5 (Review) | Policy referenced in trace was since deprecated | Note: "Policy was deprecated on Mar 12 -- this trace reflects rules active at evaluation time" | Informational only |
| 6 (Diff) | Supersedes chain broken (gap in active period) | Warning: "No active version between Mar 5 and Mar 10" | Auditor notes gap in report |
