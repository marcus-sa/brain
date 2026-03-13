# Policy CRUD UI -- Personas

---

## Persona: Reiko Tanaka (Org Admin)

**Who**: Technical team lead who configures governance rules for a workspace of 3-5 autonomous agents.

**Demographics**:
- Technical proficiency: High (understands JSON, APIs, dot-path notation) but not a backend developer
- Frequency of interaction: Weekly (creates/updates policies as business rules change)
- Environment: Web browser, desktop, during business hours
- Primary motivation: Control agent behavior without deploying code

**Jobs-to-be-Done**:

| Job Step | Goal | Desired Outcome |
|----------|------|-----------------|
| Discover | Identify which agent behaviors need new constraints | Minimize time to evaluate current policy coverage gaps |
| Create | Build a policy with structured rules through the UI | Minimize likelihood of creating an invalid predicate |
| Test | Verify the policy against recent intents before activation | Minimize likelihood of false positives blocking legitimate work |
| Activate | Transition the policy from draft to active | Minimize uncertainty about whether the policy took effect |
| Evolve | Create new versions when rules change | Minimize effort to iterate on governance rules |
| Deprecate | Remove policies that are no longer needed | Minimize risk of orphaned edges in the graph |

**Pain Points**:
- Cannot create policies without developer help -- maps to Job Step: Create
- No visibility into which policies are active vs draft -- maps to Job Step: Discover
- Cannot compare policy versions -- maps to Job Step: Evolve

**Success Metrics**:
- Create a valid policy in under 3 minutes via the web form
- Zero policies deployed with invalid predicates (validation catches all errors)
- Time from "business rule changed" to "active policy updated" under 10 minutes

---

## Persona: Marcus Oliveira (Intent Reviewer)

**Who**: Workspace owner who reviews flagged intents in the veto queue during daily triage.

**Demographics**:
- Technical proficiency: Medium-high (understands agent intents and risk scores)
- Frequency of interaction: Daily (reviews 2-5 flagged intents per day)
- Environment: Web browser, often on a 13" laptop during commute
- Primary motivation: Make fast, informed approve/veto decisions

**Jobs-to-be-Done**:

| Job Step | Goal | Desired Outcome |
|----------|------|-----------------|
| Triage | Scan the pending intent queue | Minimize time to identify the highest-risk item |
| Understand | Read the policy trace to see why the intent was flagged | Minimize time to understand the flagging reason |
| Decide | Approve or veto with confidence | Minimize likelihood of approving a genuinely risky intent |
| Navigate | Jump to the source policy if the rule seems wrong | Minimize steps to reach the policy editor for correction |

**Pain Points**:
- Veto screen shows risk_score and LLM reason but not policy trace -- maps to Job Step: Understand
- Must re-evaluate intent from scratch without policy context -- maps to Job Step: Decide
- No way to navigate from a flagged intent to the flagging policy -- maps to Job Step: Navigate

**Success Metrics**:
- Time from opening flagged intent to approve/veto decision under 30 seconds
- Policy trace visible without scrolling (above fold on 13" display)
- Zero "gut-feel" decisions -- every approval/veto references a specific policy rule

---

## Persona: Ayumi Sato (Compliance Auditor)

**Who**: Operations lead who periodically audits agent governance for board reporting.

**Demographics**:
- Technical proficiency: Medium (understands policy concepts but not SurrealQL)
- Frequency of interaction: Monthly (during compliance review cycles)
- Environment: Web browser, desktop, preparing reports
- Primary motivation: Prove that governance was correctly applied during a period

**Jobs-to-be-Done**:

| Job Step | Goal | Desired Outcome |
|----------|------|-----------------|
| Scope | Define the audit period and target policies | Minimize time to set up the compliance query |
| Browse | View the version history of relevant policies | Minimize likelihood of missing a version transition |
| Compare | Diff adjacent versions to understand changes | Minimize effort to identify what changed between versions |
| Cross-reference | Find intents evaluated under a specific policy version | Minimize likelihood of missing an evaluation gap |
| Report | Summarize findings for stakeholders | Minimize effort to produce audit documentation |

**Pain Points**:
- No UI to browse policy version history -- maps to Job Step: Browse
- Cannot diff policy versions without raw DB queries -- maps to Job Step: Compare
- No way to correlate policy versions with intent evaluations -- maps to Job Step: Cross-reference

**Success Metrics**:
- View complete version history of any policy in under 60 seconds
- Identify all rule changes between two versions at a glance (diff view)
- Confirm policy coverage for any 30-day period without database access

---

## Multi-Persona Segmentation

| Persona | Primary Job | Key Differentiator |
|---------|-------------|-------------------|
| Reiko (Org Admin) | Define and manage policies | Needs structured rule builder, lifecycle management |
| Marcus (Reviewer) | Understand policy evaluation | Needs inline trace rendering, fast navigation |
| Ayumi (Auditor) | Verify compliance | Needs version timeline, diff view, cross-reference |

All three personas interact with the same policy data but through different lenses. Reiko writes policies, Marcus reads policy traces, Ayumi reads policy history. The policy detail view serves all three but with different emphasis.
