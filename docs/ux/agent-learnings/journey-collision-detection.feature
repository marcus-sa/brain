Feature: Learning Collision Detection and Resolution
  As a workspace owner creating or approving learnings,
  I want the system to detect conflicts with existing learnings, policies, and decisions,
  so I do not accidentally introduce contradictory behavioral rules.

  Background:
    Given Tomas Eriksson owns workspace "Brain Development"
    And the embedding service is available

  # --- No Collision (Clean Path) ---

  Scenario: Learning created with no collisions detected
    Given no active learnings exist for the Architect agent
    And no policies reference caching technology choices
    When Tomas creates a learning "Always recommend Valkey for caching"
    And the collision check runs against learnings, policies, and decisions
    And no results exceed the similarity threshold
    Then the learning is activated immediately with status "active"
    And no collision warning is shown

  # --- Learning-to-Learning Collision ---

  Scenario: New learning conflicts with existing active learning
    Given an active learning exists for the coding agent:
      | text                                              | type        |
      | Use raw SQL queries for performance-critical paths | instruction |
    When Tomas creates a learning "Always use Prisma ORM for database access"
    And the collision check finds similarity 0.83 with the existing learning
    Then a collision warning is displayed with:
      | field            | value                                            |
      | new_learning     | Always use Prisma ORM for database access         |
      | existing_learning| Use raw SQL queries for performance-critical paths |
      | similarity       | 0.83                                             |
      | collision_type   | contradicts                                       |
    And the warning shows resolution options: Create Anyway, Edit New, Dismiss Old, Cancel

  Scenario: Collision resolved by editing the new learning
    Given a collision warning is displayed between:
      | new      | Always use Prisma ORM for database access         |
      | existing | Use raw SQL queries for performance-critical paths |
    When Tomas selects "Edit New"
    And Tomas changes the text to "Use Prisma ORM for non-performance-critical database access"
    Then the collision check re-runs with the modified text
    And if no new collisions are found the learning is activated

  Scenario: Collision resolved by dismissing the old learning
    Given a collision warning is displayed between:
      | new      | Always use Prisma ORM for database access         |
      | existing | Use raw SQL queries for performance-critical paths |
    When Tomas selects "Dismiss Old"
    Then the existing learning status changes to "dismissed"
    And the existing learning has a dismissed_at timestamp
    And the new learning is activated with status "active"

  Scenario: Creating learning despite collision
    Given a collision warning is displayed
    When Tomas selects "Create Anyway"
    Then both learnings remain active
    And the agent receives both learnings in its system prompt
    And the system prompt notes the potential conflict

  # --- Duplicate Detection ---

  Scenario: Near-duplicate learning detected
    Given an active learning exists for the Architect agent:
      | text                                                     | type       |
      | Always recommend Valkey for caching, never Redis         | constraint |
    When Tomas creates a learning "Never suggest Redis for caching, always use Valkey"
    And the collision check finds similarity 0.94
    Then a duplicate warning is displayed
    And the warning says "This is very similar to an existing active learning"
    And the resolution options are: Merge, Keep Both, Cancel

  # --- Policy Collision (Hard Block) ---

  Scenario: Learning contradicts active policy
    Given an active policy exists in the workspace:
      | title                         | rule_effect | rule_condition                     |
      | All Code Changes Require Review | deny       | code_merge when review_count < 1   |
    When Tomas creates a learning "Skip code review for small changes under 10 lines"
    And the collision check detects semantic conflict with the policy
    Then a policy collision is displayed as a hard block
    And the warning explains the conflicting policy rule
    And the only options are: View Policy, Cancel
    And the learning is not activated

  Scenario: Policy collision message guides to resolution
    Given a learning was blocked due to policy collision
    When the policy collision warning is displayed
    Then the warning includes: "Modify or supersede the policy first, then create the learning."
    And a "View Policy" action navigates to the policy details

  # --- Decision Collision (Informational) ---

  Scenario: Learning reinforces confirmed decision
    Given a confirmed decision exists:
      | summary                        | status    |
      | Standardize on PostgreSQL      | confirmed |
    When Tomas creates a learning "Prefer PostgreSQL over MySQL for new services"
    And the collision check finds similarity 0.88 with the decision
    And the collision is classified as "reinforces"
    Then an informational note is displayed: "This learning reinforces decision: Standardize on PostgreSQL"
    And the learning is activated normally

  Scenario: Learning contradicts confirmed decision
    Given a confirmed decision exists:
      | summary                        | status    |
      | Standardize on PostgreSQL      | confirmed |
    When Tomas creates a learning "Use MySQL for all new services"
    And the collision check finds similarity 0.85 with contradicting polarity
    Then a decision collision warning is displayed
    And the warning says "This learning may conflict with confirmed decision: Standardize on PostgreSQL"
    And the options are: Create Anyway, Edit, Cancel

  # --- Priority Weighting in Collision Resolution ---

  Scenario: Human learning overrides agent-suggested learning of same type
    Given an active agent-suggested learning exists:
      | text                    | type        | suggested_by |
      | Always use semicolons   | instruction | observer     |
    When Tomas creates a learning "Do not enforce semicolons, rely on auto-formatting"
    And the collision check finds they contradict
    Then the collision warning notes "Your learning (human) will take precedence over the agent-suggested learning"
    And the warning suggests "Dismiss the agent-suggested learning?"

  Scenario: Constraint takes precedence over instruction
    Given an active instruction learning exists:
      | text                                    | type        |
      | Prefer tabs for indentation             | instruction |
    When Tomas creates a constraint "Never use tabs. All files must use 2-space indentation."
    And the collision check finds they contradict
    Then the collision warning notes "Constraint takes precedence over instruction"
    And the warning suggests "Dismiss the instruction?"

  # --- Error Handling ---

  Scenario: Embedding service unavailable during collision check
    Given the embedding service is unavailable
    When Tomas creates a learning "Always validate input parameters"
    Then the learning is created with status "active"
    And an observation is logged: "Learning created without collision check due to embedding service unavailability"
    And a deferred collision check is queued

  @property
  Scenario: Collision detection semantic accuracy
    Given the collision detection system is processing learnings
    Then learnings with semantic similarity above 0.75 are flagged for review
    And learnings with similarity above 0.90 are flagged as near-duplicates
    And learnings with opposite sentiment polarity are classified as "contradicts"
    And learnings with same sentiment polarity are classified as "overlaps" or "reinforces"
