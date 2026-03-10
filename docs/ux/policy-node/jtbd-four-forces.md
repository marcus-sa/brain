# Policy Node — Jobs-to-be-Done: Four Forces Analysis

## Job 1: Define Governance Rules (Org Admin)

```
                    PUSH (frustration)                    PULL (desired future)
              ┌──────────────────────────┐          ┌──────────────────────────┐
              │ Policy is hard-coded in  │          │ Update one node in       │
              │ authorizer.ts as an      │          │ SurrealDB and all agents │
              │ in-memory WorkspacePolicy│          │ instantly obey the new   │
              │ type. Changing rules     │          │ rule. No code deploy.    │
              │ requires a code deploy.  │          │                          │
              │ No record of what rules  │          │ Versioned policy history │
              │ were active when.        │          │ for audit trail.         │
              └──────────────────────────┘          └──────────────────────────┘

                    ANXIETY (concerns)                    HABIT (current behavior)
              ┌──────────────────────────┐          ┌──────────────────────────┐
              │ "Will a misconfigured    │          │ Currently: edit TS code, │
              │ policy accidentally lock │          │ redeploy server, hope    │
              │ out all agents?"         │          │ the budget_cap and       │
              │                          │          │ allowed_actions fields   │
              │ "Is the rule language    │          │ are correct.             │
              │ expressive enough for    │          │                          │
              │ real business SOPs?"     │          │ No UI, no versioning,    │
              └──────────────────────────┘          │ no audit trail.          │
                                                    └──────────────────────────┘
```

**Key insight:** The push is strong — the current `WorkspacePolicy` type in `authorizer.ts` is an in-memory stub (`{ budget_cap?, allowed_actions? }`). It's never loaded from the database. The intent submission handler passes `policy: {}` (empty object) for inline evaluation. There is no persistent policy layer.

---

## Job 2: Enforce Rules at Intent Time (Authorizer Agent)

```
                    PUSH (frustration)                    PULL (desired future)
              ┌──────────────────────────┐          ┌──────────────────────────┐
              │ checkPolicyGate() only   │          │ Traverse identity →      │
              │ checks budget_cap and    │          │ governing → policy →     │
              │ allowed_actions. No deny │          │ protects → workspace     │
              │ rules, no selector-based │          │ path. Evaluate all       │
              │ scoping, no priority     │          │ matching rules by        │
              │ ordering, no per-agent   │          │ priority. Deterministic  │
              │ or per-resource rules.   │          │ allow/deny before LLM.   │
              └──────────────────────────┘          └──────────────────────────┘

                    ANXIETY (concerns)                    HABIT (current behavior)
              ┌──────────────────────────┐          ┌──────────────────────────┐
              │ "Will graph traversal    │          │ Two flat checks in       │
              │ add latency to every     │          │ checkPolicyGate():       │
              │ intent evaluation?"      │          │   1. budget > cap?       │
              │                          │          │   2. action in list?     │
              │ "What if policies        │          │                          │
              │ contradict each other?"  │          │ Both return {passed:true}│
              └──────────────────────────┘          │ when policy is empty.    │
                                                    └──────────────────────────┘
```

**Key insight:** The current policy gate is a 2-check stub that always passes when no policy is provided. The entire `WorkspacePolicy` parameter in `evaluateIntent()` is `{}` in production. The policy node replaces this stub with a real graph-backed rules engine.

---

## Job 3: Review Policy-Flagged Intents (Human Reviewer)

```
                    PUSH (frustration)                    PULL (desired future)
              ┌──────────────────────────┐          ┌──────────────────────────┐
              │ Veto window shows the    │          │ See "Policy #finance-001 │
              │ LLM's risk_score and     │          │ rule 'max_spend_limit'   │
              │ reason, but not which    │          │ flagged: budget 800 >    │
              │ policy rules matched.    │          │ cap 500. Requires human  │
              │ Human must re-evaluate   │          │ approval per policy."    │
              │ from scratch.            │          │                          │
              └──────────────────────────┘          └──────────────────────────┘

                    ANXIETY (concerns)                    HABIT (current behavior)
              ┌──────────────────────────┐          ┌──────────────────────────┐
              │ "Too many false          │          │ Reviewer sees: risk_score│
              │ positives from overly    │          │ = 65, reason = "high     │
              │ broad policies will      │          │ budget request". No      │
              │ cause alert fatigue."    │          │ policy reference. Must   │
              └──────────────────────────┘          │ decide based on gut.     │
                                                    └──────────────────────────┘
```

---

## Job 4: Verify Policy Compliance (Auditor)

```
                    PUSH (frustration)                    PULL (desired future)
              ┌──────────────────────────┐          ┌──────────────────────────┐
              │ audit_event table logs   │          │ Each audit_event links   │
              │ "intent_evaluated" but   │          │ to the policy version    │
              │ doesn't reference which  │          │ that was active. Query:  │
              │ policy was in effect.    │          │ "show me all intents     │
              │ Can't answer: "was this  │          │ evaluated under policy   │
              │ approved under v1 or v2  │          │ finance-001 v2026.03"    │
              │ of the spend policy?"    │          │                          │
              └──────────────────────────┘          └──────────────────────────┘

                    ANXIETY (concerns)                    HABIT (current behavior)
              ┌──────────────────────────┐          ┌──────────────────────────┐
              │ "What if policy versions │          │ audit_event.payload is   │
              │ aren't immutable? Can    │          │ a flexible object. No    │
              │ someone edit a past      │          │ structured policy ref.   │
              │ policy to cover up a     │          │ No version tracking.     │
              │ bad approval?"           │          │                          │
              └──────────────────────────┘          └──────────────────────────┘
```

---

## Summary of Forces

| Job | Strongest Force | Implication |
|-----|----------------|-------------|
| 1 — Define Rules | **Push**: No persistent policy storage | Build the `policy` table and CRUD first |
| 2 — Enforce Rules | **Push**: Policy gate is a 2-check stub | Replace `checkPolicyGate()` with graph traversal |
| 3 — Review Flagged | **Pull**: Policy-aware evaluation trace | Include policy refs in evaluation result |
| 4 — Verify Compliance | **Push**: audit_events lack policy context | Link audit_events to policy versions |
