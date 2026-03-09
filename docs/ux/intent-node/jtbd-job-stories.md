# Intent Node -- Jobs-to-be-Done: Job Stories

## Job 1: Scoped Authorization (Worker Agent)

> **When** I identify an action requiring external resources or elevated authority (API calls, spending, repo writes),
> **I want to** declare my intent with full reasoning and a precise action spec,
> **So I can** receive exactly the permissions I need -- no more, no less -- and proceed without waiting for manual approval on routine work.

### Job Dimensions

| Dimension | Description |
|-----------|-------------|
| **Functional** | Submit a structured intent with action_spec, budget_limit, and reasoning; receive a scoped authorization token back |
| **Emotional** | Confidence that I won't be blocked unnecessarily; trust that the system treats me fairly based on my track record |
| **Social** | Perceived as a reliable, well-governed agent that humans can trust to self-regulate |

---

## Job 2: Passive Oversight (Human Operator)

> **When** an agent proposes a consequential action (spending, external API calls, destructive operations),
> **I want to** receive a passive notification with a time-bound veto window,
> **So I can** maintain control over high-stakes actions without becoming a bottleneck on every routine operation.

### Job Dimensions

| Dimension | Description |
|-----------|-------------|
| **Functional** | See intent summary + risk score in a feed; veto within window if needed; auto-approve on expiry |
| **Emotional** | Peace of mind that nothing dangerous happens without my awareness; no anxiety about "what are the agents doing" |
| **Social** | Perceived as a responsible operator who maintains governance without micromanaging |

---

## Job 3: Intent Drift Detection (Authorizer Agent)

> **When** an intent arrives for authorization,
> **I want to** evaluate it against least-privilege principles, budget constraints, and reasoning quality,
> **So I can** catch intent drift (agents requesting more power than needed) and prevent privilege escalation.

### Job Dimensions

| Dimension | Description |
|-----------|-------------|
| **Functional** | Receive intent payload; evaluate action_spec vs goal alignment; check budget constraints; output decision + risk_score + reason |
| **Emotional** | Certainty that the evaluation is thorough and defensible; no false negatives that could cause harm |
| **Social** | Trusted as the impartial arbiter -- agents and humans both accept its judgments |

---

## Job 4: Auditable Action History (Organization)

> **When** I need to understand what agents did and why,
> **I want to** trace any action back through the intent graph to its originating goal, authorization decision, and execution result,
> **So I can** maintain full accountability and debug authorization failures post-hoc.

### Job Dimensions

| Dimension | Description |
|-----------|-------------|
| **Functional** | Query intent graph by time range, agent, status, risk score; see full chain: goal -> intent -> authorization -> execution -> result |
| **Emotional** | Confidence in the system's transparency; no "black box" anxiety |
| **Social** | Demonstrable governance to stakeholders, auditors, or future team members |

---

## Traceability Matrix

| Job | Primary Actor | Feeds Stories |
|-----|---------------|--------------|
| J1: Scoped Authorization | Worker Agent | US-1, US-2 |
| J2: Passive Oversight | Human Operator | US-3, US-4 |
| J3: Intent Drift Detection | Authorizer Agent | US-5, US-6 |
| J4: Auditable Action History | Organization | US-7 |
