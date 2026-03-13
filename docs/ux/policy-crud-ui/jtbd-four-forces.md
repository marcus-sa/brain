# Policy CRUD UI -- Jobs-to-be-Done: Four Forces Analysis

> Builds on the prior policy-node Four Forces (docs/ux/policy-node/jtbd-four-forces.md).
> Context shift: the backend policy infrastructure now **exists** (schema, evaluation pipeline, graph relations).
> The push/pull/anxiety/habit forces now center on the **lack of UI/API surface** for managing that infrastructure.

---

## Job 1: Define Governance Rules via UI (Org Admin)

```
                    PUSH (frustration)                    PULL (desired future)
              +----------------------------+          +----------------------------+
              | Policy creation requires   |          | Guided web form with       |
              | raw SurrealDB queries or   |          | selector picker, rule      |
              | test-kit helper functions.  |          | builder, validation, and   |
              | No HTTP API exists for     |          | immediate feedback.        |
              | creating policies. Only    |          |                            |
              | acceptance tests can       |          | Create, review, and        |
              | create them today.         |          | activate policies without  |
              |                            |          | touching code or database  |
              | Org admin cannot self-     |          | console.                   |
              | serve governance changes.  |          |                            |
              +----------------------------+          +----------------------------+

                    ANXIETY (concerns)                    HABIT (current behavior)
              +----------------------------+          +----------------------------+
              | "The rule predicate        |          | Currently: developers      |
              | format ({field, operator,  |          | create policies through    |
              | value}) is complex. Will   |          | acceptance test helpers    |
              | I build invalid rules      |          | (createPolicy from test    |
              | that silently fail?"       |          | kit) or raw SurrealDB      |
              |                            |          | queries in Surrealist.     |
              | "What if I accidentally    |          |                            |
              | activate a policy that     |          | No non-developer can       |
              | blocks all agent actions?" |          | create or manage policies. |
              +----------------------------+          +----------------------------+
```

**Assessment**:
- Switch likelihood: **High** -- push is very strong (zero self-service capability today)
- Key blocker: Anxiety about rule complexity -- the predicate format is powerful but intimidating
- Key enabler: Push from complete inability to manage policies without developer help
- Design implication: Rule builder must validate predicates in real time and show human-readable previews of what each rule means ("When budget exceeds $500, deny")

---

## Job 2: Manage Policy Lifecycle (Org Admin)

```
                    PUSH (frustration)                    PULL (desired future)
              +----------------------------+          +----------------------------+
              | activatePolicy() and       |          | One-click activate with    |
              | deprecatePolicy() exist    |          | confirmation dialog.       |
              | as internal functions but  |          | Version creation pre-      |
              | have no HTTP endpoints.    |          | populates from current     |
              |                            |          | active version. Side-by-   |
              | Lifecycle transitions      |          | side diff before commit.   |
              | require direct DB access   |          |                            |
              | or test helper invocation. |          | Version timeline shows     |
              |                            |          | full history with status   |
              | No version diff or         |          | transitions and dates.     |
              | comparison capability.     |          |                            |
              +----------------------------+          +----------------------------+

                    ANXIETY (concerns)                    HABIT (current behavior)
              +----------------------------+          +----------------------------+
              | "What if I activate a      |          | Currently: call            |
              | policy that conflicts      |          | activatePolicy(surreal,    |
              | with another active one?"  |          | id, creatorId, wsId)       |
              |                            |          | from test code or REPL.    |
              | "What if deprecation       |          |                            |
              | removes edges that other   |          | Version "management" is    |
              | policies depend on?"       |          | creating a new policy      |
              |                            |          | record manually and hoping |
              | "Can I undo an             |          | the old one gets cleaned   |
              | activation?"               |          | up.                        |
              +----------------------------+          +----------------------------+
```

**Assessment**:
- Switch likelihood: **High** -- existing lifecycle functions are server-only with no HTTP surface
- Key blocker: Anxiety about conflicting policies and irreversible transitions
- Key enabler: Push from zero visibility into what's active vs deprecated
- Design implication: Activation must show pre-flight check (conflict detection). Deprecation must confirm edge removal. Version creation must show diff.

---

## Job 3: Understand Intent Evaluation Against Policies (Reviewer)

```
                    PUSH (frustration)                    PULL (desired future)
              +----------------------------+          +----------------------------+
              | Veto/consent screen shows  |          | Expandable policy trace    |
              | risk_score and LLM reason  |          | section in intent review:  |
              | but NOT the policy trace.  |          | "Policy 'finance-001'      |
              | PolicyTraceEntry[] is      |          | rule 'max_spend' matched:  |
              | recorded on the intent     |          | budget 800 > cap 500.      |
              | record but never surfaced  |          | Effect: deny. Requires     |
              | to the UI.                 |          | human approval."           |
              |                            |          |                            |
              | Reviewer must guess why    |          | Click policy title to      |
              | the intent was flagged.    |          | navigate to policy detail. |
              +----------------------------+          +----------------------------+

                    ANXIETY (concerns)                    HABIT (current behavior)
              +----------------------------+          +----------------------------+
              | "Will the policy trace     |          | Reviewer sees:             |
              | information overload make  |          | - goal                     |
              | the review screen too      |          | - risk_score               |
              | complex?"                  |          | - LLM reason               |
              |                            |          | - action_spec              |
              | "What if I don't           |          |                            |
              | understand the predicate   |          | Decides based on gut feel  |
              | syntax?"                   |          | and risk score alone.      |
              +----------------------------+          +----------------------------+
```

**Assessment**:
- Switch likelihood: **High** -- the data already exists (policy_trace on intent.evaluation), it just needs rendering
- Key blocker: Anxiety about complexity in the review screen
- Key enabler: Push from making uninformed veto decisions
- Design implication: Policy trace should use progressive disclosure -- collapsed summary by default ("2 rules evaluated, 1 matched: deny"), expandable for full detail. Human-readable predicate rendering, not raw JSON.

---

## Job 4: Verify Policy Compliance Over Time (Auditor)

```
                    PUSH (frustration)                    PULL (desired future)
              +----------------------------+          +----------------------------+
              | audit_event table records  |          | Policy detail page shows   |
              | policy_activated and       |          | version timeline with      |
              | policy_deprecated events   |          | creation date, activation  |
              | but there is no UI to      |          | date, deprecation date.    |
              | browse policy history.     |          |                            |
              |                            |          | Diff view between adjacent |
              | No way to see which        |          | versions shows exactly     |
              | version was active during  |          | what rules changed.        |
              | a specific time period.    |          |                            |
              |                            |          | Cross-reference: "Show     |
              | No version diff            |          | intents evaluated under    |
              | capability at all.         |          | this policy version."      |
              +----------------------------+          +----------------------------+

                    ANXIETY (concerns)                    HABIT (current behavior)
              +----------------------------+          +----------------------------+
              | "Are policy versions       |          | Currently: query           |
              | truly immutable? Can       |          | SurrealDB directly with    |
              | someone edit a past        |          | raw SurrealQL to find      |
              | version?"                  |          | audit events and manually  |
              |                            |          | join with policy records.  |
              | "What if the supersedes    |          |                            |
              | chain is broken -- gaps    |          | No structured compliance   |
              | where no version was       |          | view exists.              |
              | active?"                   |          |                            |
              +----------------------------+          +----------------------------+
```

**Assessment**:
- Switch likelihood: **Medium-High** -- less urgent than Jobs 1-3 but critical for governance credibility
- Key blocker: Anxiety about immutability guarantees
- Key enabler: Push from zero visibility into version history
- Design implication: Version timeline must clearly show active periods (from/to dates). Supersedes chain must be visible. Immutability must be enforced at the API level (no PATCH on non-draft policies).

---

## Summary of Forces

| Job | Strongest Force | Implication |
|-----|----------------|-------------|
| 1 -- Define Rules via UI | **Push**: Zero self-service; only devs can create policies | Build the API + form UI first |
| 2 -- Manage Lifecycle | **Push**: Lifecycle functions exist but have no HTTP surface | Expose activate/deprecate/version endpoints |
| 3 -- Understand Evaluation | **Pull**: Policy trace data exists but is never shown | Render trace in intent review UI |
| 4 -- Verify Compliance | **Push**: No UI for version history or diffs | Build policy detail + version timeline |
