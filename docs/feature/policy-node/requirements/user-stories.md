# Policy Node — User Stories

All stories trace to JTBD job stories in `docs/ux/policy-node/jtbd-job-stories.md`.

---

## US-1: Create Policy Record [Job 1]

**As** an org admin,
**I want to** create a policy record with title, rules, selector, and flags,
**So that** I have a persistent, structured governance definition in SurrealDB.

**Acceptance Criteria:** See AC-1 in acceptance-criteria.md

**Size:** S — Single table definition + migration script

---

## US-2: Policy Lifecycle Management [Job 1]

**As** an org admin,
**I want to** transition a policy through draft → active → deprecated,
**So that** I can safely introduce, activate, and retire governance rules.

**Acceptance Criteria:** See AC-2

**Size:** S — Status transitions + audit events

---

## US-3: Graph Relations (governing + protects) [Job 1]

**As** an org admin,
**I want to** link policies to identities and workspaces via graph edges,
**So that** the authorizer can discover applicable policies by traversing the graph.

**Acceptance Criteria:** See AC-3

**Size:** S — Two RELATION tables + RELATE operations

---

## US-4: Policy Gate Graph Traversal [Job 2]

**As** the authorizer system,
**I want to** load all active policies for the requesting identity and workspace,
**So that** I can evaluate all applicable rules before the LLM tier runs.

**Acceptance Criteria:** See AC-4

**Size:** M — Replace `checkPolicyGate()` with graph query + rule loading

---

## US-5: Rule Evaluation Engine [Job 2]

**As** the authorizer system,
**I want to** evaluate merged rules by priority, short-circuiting on deny,
**So that** high-priority deny rules override lower-priority allow rules.

**Acceptance Criteria:** See AC-5

**Size:** M — Priority-sorted rule evaluation with deny short-circuit

---

## US-6: Human Veto Gate (policy-driven) [Job 2, Job 3]

**As** the authorizer system,
**I want to** force a veto window when any applicable policy has `human_veto_required = true`,
**So that** certain policy-scoped actions always require human approval regardless of risk score.

**Acceptance Criteria:** See AC-6

**Size:** S — Check flag in evaluation, override routing

---

## US-7: Policy Evaluation Trace [Job 3, Job 4]

**As** a reviewer or auditor,
**I want to** see which policy rules were evaluated, matched, and applied for each intent,
**So that** I can make informed veto decisions and verify compliance.

**Acceptance Criteria:** See AC-7

**Size:** M — Trace structure + persistence on intent + schema extension

---

## US-8: Audit Event Extensions [Job 4]

**As** an auditor,
**I want to** query audit events by policy ID and version,
**So that** I can reconstruct which governance rules were active for any past decision.

**Acceptance Criteria:** See AC-8

**Size:** S — Extend audit_event ASSERT + include policy refs in payload

---

## US-9: Backward Compatibility (Empty Policy Set) [Job 2]

**As** the system,
**I want** an empty policy set to pass the gate (no policies = no constraints),
**So that** existing workspaces without policies continue to function unchanged.

**Acceptance Criteria:** See AC-9

**Size:** XS — Default pass-through behavior

---

## US-10: Policy Version Immutability [Job 1, Job 4]

**As** an auditor,
**I want** policy versions to be immutable once created,
**So that** past audit references remain valid and no one can retroactively alter governance rules.

**Acceptance Criteria:** See AC-10

**Size:** S — Versioning strategy + superseded status

---

## Story Map

```
         Job 1 (Define)           Job 2 (Enforce)         Job 3 (Review)    Job 4 (Audit)
         ─────────────           ────────────────         ──────────────    ─────────────
Phase 1  US-1 (Schema)           US-4 (Traversal)
         US-2 (Lifecycle)        US-5 (Rule Engine)
         US-3 (Relations)        US-6 (Veto Gate)
         US-10 (Immutability)    US-9 (Compat)

Phase 2                                                   US-7 (Trace)      US-8 (Audit)
```
