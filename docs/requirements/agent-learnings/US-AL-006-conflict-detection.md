# US-AL-006: Learning Collision Detection

## Problem
Tomas Eriksson has been adding learnings across his workspace for a month. He just told the Architect agent "Never use any key-value store for caching" -- forgetting that two weeks ago he created a learning "Always recommend Valkey for caching." Without collision detection, both learnings would be active simultaneously, giving the Architect contradictory instructions. Worse, a learning could silently contradict an active policy, undermining the governance system. Tomas needs the system to catch these contradictions before they cause unpredictable agent behavior.

## Who
- Workspace owner | Creating or approving learnings | Needs assurance that new rules do not contradict existing rules, policies, or decisions

## Job Story Trace
- **Job 4**: Learning Governance and Curation
- **When** I am about to create a new learning that might contradict an existing learning, policy, or decision, **I want to** be warned before activation, **so I can** maintain a coherent behavioral ruleset.
- **Outcome #3** (17.0): Minimize the likelihood of activating a learning that contradicts an existing policy
- **Outcome #6** (16.0): Minimize the likelihood of activating a learning that contradicts another active learning

## Solution
Before activating any learning, the system computes its embedding and queries the graph for semantically similar active learnings, active policies, and confirmed decisions. Conflicts are displayed with severity levels: Red (policy collision, hard block), Yellow (learning collision, warning with resolution options), Blue (decision collision, informational). Priority weighting rules determine precedence: policy > learning, human > agent, constraint > instruction > precedent.

## Domain Examples

### 1: Learning-to-Learning Collision (Happy Path)
Tomas creates "Always use Prisma ORM for database access" for the coding agent. The system detects similarity 0.83 with existing active learning "Use raw SQL queries for performance-critical paths." A yellow warning shows both learnings, their types (both instruction), and similarity score. Tomas edits the new learning to "Use Prisma ORM for non-performance-critical database access" and both coexist without conflict.

### 2: Policy Collision -- Hard Block (Error Path)
Tomas creates "Skip code review for small changes under 10 lines." The system detects this contradicts active policy "All Code Changes Require Review" (rule: deny code_merge when review_count < 1). A red warning blocks activation: "This learning conflicts with an active policy. Modify or supersede the policy first." Tomas cannot override the policy collision.

### 3: Decision Reinforcement (Informational)
Tomas creates "Prefer PostgreSQL over MySQL for new services." The system finds similarity 0.88 with confirmed decision "Standardize on PostgreSQL" and classifies it as "reinforces." A blue informational note says "This learning reinforces decision: Standardize on PostgreSQL." The learning activates normally.

### 4: Near-Duplicate Detection
Tomas creates "Never suggest Redis for caching, always use Valkey." The system finds similarity 0.94 with existing active learning "Always recommend Valkey for caching, never Redis." A duplicate warning is displayed with options: Merge, Keep Both, Cancel.

## UAT Scenarios (BDD)

### Scenario: No collision -- clean activation
Given no active learnings, policies, or decisions relate to caching for the Architect agent
When Tomas creates a learning "Always recommend Valkey for caching"
And the collision check runs against all three layers
And no results exceed similarity thresholds
Then the learning is activated with status "active"
And no collision warning is shown

### Scenario: Learning-to-learning collision warning
Given an active learning exists for the coding agent:
  | text                                              | type        |
  | Use raw SQL queries for performance-critical paths | instruction |
When Tomas creates "Always use Prisma ORM for database access" for the coding agent
And the collision check finds similarity 0.83 with the existing learning
Then a collision warning is displayed showing both learnings
And the collision type is "contradicts"
And resolution options are: Create Anyway, Edit New, Dismiss Old, Cancel

### Scenario: Collision resolved by editing the new learning
Given a collision warning is displayed between:
  | new      | Always use Prisma ORM for database access         |
  | existing | Use raw SQL queries for performance-critical paths |
When Tomas selects "Edit New"
And Tomas changes the text to "Use Prisma ORM for non-performance-critical database access"
Then the collision check re-runs with the modified text
And if no new collisions are found the learning is activated

### Scenario: Collision resolved by dismissing the old learning
Given a collision warning is displayed between:
  | new      | Always use Prisma ORM for database access         |
  | existing | Use raw SQL queries for performance-critical paths |
When Tomas selects "Dismiss Old"
Then the existing learning status changes to "dismissed"
And the existing learning has a dismissed_at timestamp
And the new learning is activated with status "active"

### Scenario: Policy collision hard block
Given an active policy exists in the workspace:
  | title                           | rule_effect | rule_condition                     |
  | All Code Changes Require Review | deny        | code_merge when review_count < 1   |
When Tomas creates a learning "Skip code review for small changes under 10 lines"
And the collision check detects semantic conflict with the policy
Then a policy collision is displayed as a hard block
And the only actions are: View Policy, Cancel
And the learning is not activated

### Scenario: Near-duplicate learning detected
Given an active learning exists for the Architect agent:
  | text                                                     | type       |
  | Always recommend Valkey for caching, never Redis         | constraint |
When Tomas creates a learning "Never suggest Redis for caching, always use Valkey"
And the collision check finds similarity 0.94
Then a duplicate warning is displayed
And the warning says "This is very similar to an existing active learning"
And resolution options include: Merge, Keep Both, Cancel

### Scenario: Learning reinforces confirmed decision
Given a confirmed decision exists:
  | summary                        | status    |
  | Standardize on PostgreSQL      | confirmed |
When Tomas creates a learning "Prefer PostgreSQL over MySQL for new services"
And the collision check finds similarity 0.88 with the decision
And the collision is classified as "reinforces"
Then an informational note is displayed: "This learning reinforces decision: Standardize on PostgreSQL"
And the learning is activated normally

### Scenario: Learning contradicts confirmed decision
Given a confirmed decision exists:
  | summary                        | status    |
  | Standardize on PostgreSQL      | confirmed |
When Tomas creates a learning "Use MySQL for all new services"
And the collision check finds similarity 0.85 with contradicting polarity
Then a decision collision warning is displayed
And the warning says "This learning may conflict with confirmed decision: Standardize on PostgreSQL"
And the options are: Create Anyway, Edit, Cancel

### Scenario: Human learning overrides agent-suggested learning of same type
Given an active agent-suggested learning exists:
  | text                    | type        | suggested_by |
  | Always use semicolons   | instruction | observer     |
When Tomas creates a learning "Do not enforce semicolons, rely on auto-formatting"
And the collision check finds they contradict
Then the collision warning notes "Your learning (human) will take precedence over the agent-suggested learning"
And the warning suggests "Dismiss the agent-suggested learning?"

### Scenario: Constraint takes precedence over instruction
Given an active instruction learning exists:
  | text                                    | type        |
  | Prefer tabs for indentation             | instruction |
When Tomas creates a constraint "Never use tabs. All files must use 2-space indentation."
And the collision check finds they contradict
Then the collision warning notes "Constraint takes precedence over instruction"
And the warning suggests "Dismiss the instruction?"

### Scenario: Embedding service unavailable during collision check
Given the embedding service is unavailable
When Tomas creates a learning "Always validate input parameters"
Then the learning is created with status "active" (fail-open for human-created)
And an observation is logged: "Learning created without collision check due to embedding service unavailability"
And a deferred collision check is queued

## Acceptance Criteria
- [ ] Collision check runs before any learning activation (human-created or agent-approved)
- [ ] Three-layer query: active learnings (same target_agent, similarity > 0.75), active policies (same workspace), confirmed/provisional decisions (similarity > 0.80)
- [ ] Collision types classified: contradicts, duplicates (> 0.90), overlaps, reinforces
- [ ] Policy collision is a hard block -- learning cannot be activated
- [ ] Learning collision is a warning with resolution options: Create Anyway, Edit New, Dismiss Old, Cancel
- [ ] Decision collision is informational (reinforcing) or warning (contradicting)
- [ ] Near-duplicate detection (> 0.90) offers Merge, Keep Both, Cancel
- [ ] Priority weighting: policy > learning, human > agent, constraint > instruction > precedent
- [ ] Embedding service unavailability: fail-open for human-created with observation + deferred check
- [ ] Collision check re-runs after editing (not just on initial creation)

## Priority Weighting Rules

1. **Policy > Learning** (always) — Policies are deterministic governance. Learnings cannot override them.
2. **Human-created > Agent-suggested** — If a human learning contradicts an agent-suggested learning, the human learning takes precedence.
3. **Constraint > Instruction > Precedent** — Within the same source (both human or both agent), type determines priority.
4. **Newer > Older** (same type, same source) — When two learnings of the same type and source conflict, the most recently created one takes precedence.

## Technical Notes
- Collision queries must use the KNN + WHERE workaround (two-step: KNN subquery, then filter by workspace/target_agent)
- Similarity thresholds: > 0.75 for learnings (flag), > 0.80 for decisions, > 0.90 for near-duplicate
- Policy comparison is semantic, not structural (policy rules are typed differently from learning text)
- Intent analysis (same vs opposing) requires LLM call -- compare two learning texts to classify as "complementary," "contradictory," or "unrelated"
- Retrospective scan can run as part of Observer's existing graph scan loop
- Keep conflict threshold configurable (default 0.75 for conflicts, 0.85 for duplicates)

## Dependencies
- Depends on: US-AL-005 (Learning Schema) -- embeddings must exist for comparison
- Depends on: Embedding pipeline (existing)
- Depends on: Policy table (existing schema)
- Optional enhancement for: US-AL-001 (validates at human creation), US-AL-002 (validates at agent suggestion approval), US-AL-004 (surfaces in feed)
