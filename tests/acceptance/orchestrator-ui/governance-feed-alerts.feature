Feature: Governance Feed Agent Alerts
  As a user who assigned work to an agent
  I want to be alerted in the feed only when the agent needs my attention
  So that I am not distracted by operational noise

  Background:
    Given a workspace with an active project

  # --- Attention-Needed Items ---

  # US-1.2
  @skip
  Scenario: Review-ready item appears when agent completes work
    Given a task "Fix login bug" assigned to an agent
    When the agent completes its work on "Fix login bug"
    Then the governance feed shows a review-tier item
    And the feed item reason is "Agent completed work on 'Fix login bug' -- review ready"
    And the feed item offers "Review" and "Abort" actions

  # US-1.2
  @skip
  Scenario: Blocking item appears when agent stalls
    Given a task "Refactor database layer" assigned to an agent
    When the agent stalls with no activity for the configured timeout
    Then the governance feed shows a blocking-tier item
    And the feed item reason includes "Agent stalled on 'Refactor database layer'"
    And the feed item offers "Abort" and "Discuss" actions

  # US-1.2
  @skip
  Scenario: Blocking item appears when agent errors
    Given a task "Migrate schema" assigned to an agent
    When the agent fails with error "Permission denied: cannot write to protected branch"
    Then the governance feed shows a blocking-tier item
    And the feed item reason includes "Permission denied: cannot write to protected branch"

  # US-1.2
  @skip
  Scenario: Review item appears when agent raises a question
    Given a task "Implement search" assigned to an agent
    When the agent creates an observation asking "Should search results include archived items?"
    Then the governance feed shows a review-tier item
    And the feed item includes the observation text "Should search results include archived items?"

  # US-1.2
  @skip
  Scenario: Agent start does not create a feed item
    Given a task "Build notification system" with status "ready"
    When I assign the task to an agent
    Then the governance feed does not show any new items for "Build notification system"

  # --- Task Entity Kind ---

  # US-1.3
  @skip
  Scenario: Feed items use task entity kind with agent context
    Given a task "Fix login bug" assigned to an agent
    When the agent completes its work on "Fix login bug"
    Then the feed item entity kind is "task"
    And the feed item entity name is "Fix login bug"
    And the feed item reason text includes agent-specific context

  # US-1.3
  @skip
  Scenario: Feed item removed after work is accepted
    Given a task "Fix login bug" with a review-ready feed item
    When I accept the agent's work on "Fix login bug"
    Then the governance feed no longer shows an item for "Fix login bug"
