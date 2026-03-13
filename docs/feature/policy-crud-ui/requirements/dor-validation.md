# Policy CRUD UI -- Definition of Ready Validation

## US-PCUI-01: Policy List View

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "Reiko finds it impossible to know which policies are active/draft/deprecated because there is no UI" |
| User/persona identified | PASS | Reiko Tanaka, org admin, weekly governance check-in |
| 3+ domain examples | PASS | Happy path (6 policies), empty state, filter by draft |
| UAT scenarios (3-7) | PASS | 5 scenarios covering list, empty state, filter, name resolution, performance |
| AC derived from UAT | PASS | 6 criteria derived from scenarios |
| Right-sized | PASS | 1-2 days, 5 scenarios |
| Technical notes | PASS | Endpoint, join strategy, UI pattern reference, sidebar addition |
| Dependencies tracked | PASS | All dependencies exist (policy table, workspace sidebar, React router) |

**DoR Status**: PASSED

---

## US-PCUI-02: Create Policy with Rule Builder

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "Reiko finds it impossible to create a spending limit policy because there is no HTTP endpoint or UI" |
| User/persona identified | PASS | Reiko Tanaka, org admin, building governance rules |
| 3+ domain examples | PASS | Happy path (spending limit), validation error, multiple rules, empty form |
| UAT scenarios (3-7) | PASS | 7 scenarios covering creation, validation (field, type, title, rules), preview, allow-list |
| AC derived from UAT | PASS | 9 criteria derived from scenarios |
| Right-sized | PASS | 1-2 days, 7 scenarios |
| Technical notes | PASS | Endpoint, createPolicy() reuse, known fields, operator mapping, UI pattern |
| Dependencies tracked | PASS | createPolicy() exists, IntentEvaluationContext type exists |

**DoR Status**: PASSED

---

## US-PCUI-03: Policy Detail View

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "Reiko finds it impossible to see the full policy with its rules, edges, and version history" |
| User/persona identified | PASS | Reiko (admin), Marcus (reviewer), Ayumi (auditor) -- multi-persona |
| 3+ domain examples | PASS | Active policy detail, draft actions, deprecated read-only |
| UAT scenarios (3-7) | PASS | 5 scenarios covering active, draft, deprecated, performance, navigation |
| AC derived from UAT | PASS | 7 criteria derived from scenarios |
| Right-sized | PASS | 1-2 days, 5 scenarios |
| Technical notes | PASS | Endpoint, supersedes chain traversal, edge resolution, UI pattern |
| Dependencies tracked | PASS | PolicyRecord type exists, graph edges exist |

**DoR Status**: PASSED

---

## US-PCUI-04: Activate and Deprecate Policy

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "Reiko finds it impossible to activate a draft policy through the UI" |
| User/persona identified | PASS | Reiko Tanaka, org admin, managing lifecycle |
| 3+ domain examples | PASS | Activate happy path, deprecate happy path, no-rules error, invalid transition |
| UAT scenarios (3-7) | PASS | 6 scenarios covering activate, no-rules, deprecate, invalid status, audit, cancel |
| AC derived from UAT | PASS | 7 criteria derived from scenarios |
| Right-sized | PASS | 1 day, 6 scenarios |
| Technical notes | PASS | Endpoints, reuse existing functions, pre-condition checks, dialog patterns |
| Dependencies tracked | PASS | activatePolicy(), deprecatePolicy() exist |

**DoR Status**: PASSED

---

## US-PCUI-05: Create New Policy Version

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "Reiko finds it impossible to create a new version because there is no versioning endpoint" |
| User/persona identified | PASS | Reiko Tanaka, org admin, evolving rules |
| 3+ domain examples | PASS | Create v4 from v3, activate supersedes old, concurrent conflict |
| UAT scenarios (3-7) | PASS | 5 scenarios covering pre-populated form, save, supersede, active-only check, auto-increment |
| AC derived from UAT | PASS | 7 criteria derived from scenarios |
| Right-sized | PASS | 1-2 days, 5 scenarios |
| Technical notes | PASS | Endpoint, createPolicy() reuse, atomic supersede, activation modification |
| Dependencies tracked | PASS | createPolicy(), supersedes field in schema |

**DoR Status**: PASSED

---

## US-PCUI-06: Policy Trace in Intent Review

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "Marcus finds it frustrating that the consent screen shows only risk_score and reason but not which policy rules flagged the intent" |
| User/persona identified | PASS | Marcus Oliveira, reviewer, daily triage on 13" laptop |
| 3+ domain examples | PASS | Flagged by policy, LLM-only flagging, navigate to source policy |
| UAT scenarios (3-7) | PASS | 6 scenarios covering collapsed, expanded, navigation, veto reason, LLM-only, rendering |
| AC derived from UAT | PASS | 8 criteria derived from scenarios |
| Right-sized | PASS | 1-2 days, 6 scenarios |
| Technical notes | PASS | Reads existing data, consent endpoint enhancement, progressive disclosure, UI pattern |
| Dependencies tracked | PASS | intent.evaluation.policy_trace already persisted by authorizer |

**DoR Status**: PASSED

---

## US-PCUI-07: Policy Version History and Diff

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "Ayumi finds it impossible to see when policy versions were active or what changed between them" |
| User/persona identified | PASS | Ayumi Sato, auditor, monthly cycles; Reiko, admin, after versioning |
| 3+ domain examples | PASS | Version timeline, diff with added rule, single version |
| UAT scenarios (3-7) | PASS | 5 scenarios covering timeline, added rule, changed value, removed rule, single version |
| AC derived from UAT | PASS | 7 criteria derived from scenarios |
| Right-sized | PASS | 1-2 days, 5 scenarios |
| Technical notes | PASS | Supersedes traversal, client-side diff, DiffViewer patterns |
| Dependencies tracked | PASS | supersedes field exists, DiffViewer.tsx exists |

**DoR Status**: PASSED

---

## US-PCUI-08: Agent Authorization

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "Without this gate, a compromised agent could modify its own governance rules" |
| User/persona identified | PASS | Agent identity (blocked), Human identity (allowed) |
| 3+ domain examples | PASS | Human creates (OK), agent reads (OK), agent creates (403), agent activates (403) |
| UAT scenarios (3-7) | PASS | 6 scenarios covering human create, agent list, agent create/activate/deprecate (403), non-member (401) |
| AC derived from UAT | PASS | 6 criteria derived from scenarios |
| Right-sized | PASS | 0.5-1 day, 6 scenarios |
| Technical notes | PASS | identity.type check, session/DPoP context, acceptance test patterns |
| Dependencies tracked | PASS | identity.type field exists, Better Auth session middleware exists |

**DoR Status**: PASSED

---

## Summary

| Story | DoR | Scenarios | Est. Days | Priority |
|-------|-----|-----------|-----------|----------|
| US-PCUI-01 | PASSED | 5 | 1-2 | Must Have |
| US-PCUI-02 | PASSED | 7 | 1-2 | Must Have |
| US-PCUI-03 | PASSED | 5 | 1-2 | Must Have |
| US-PCUI-04 | PASSED | 6 | 1 | Must Have |
| US-PCUI-05 | PASSED | 5 | 1-2 | Must Have |
| US-PCUI-06 | PASSED | 6 | 1-2 | Should Have |
| US-PCUI-07 | PASSED | 5 | 1-2 | Should Have |
| US-PCUI-08 | PASSED | 6 | 0.5-1 | Must Have |

**Total**: 8 stories, 45 scenarios, 7.5-13 estimated days

All 8 stories pass the Definition of Ready. Ready for DESIGN wave handoff.
