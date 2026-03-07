Feature: Agent Delegation Across Three Surfaces
  As an engineering lead using Brain
  I want to assign a task from the graph popup, get notified in the feed, and review in a dedicated view
  So that I can delegate coding work and stay informed without switching mental contexts

  Background:
    Given a workspace with an active project
    And a task "Implement input validation" with status "ready"

  # US-0.4, US-0.5, US-1.2, US-2.1, US-2.2
  @walking_skeleton
  Scenario: Assign from popup, monitor in feed, accept in review view
    # Surface 1: Task Popup -- Delegation trigger
    When I open the task popup for "Implement input validation"
    Then the popup shows an "Assign to Agent" button

    When I assign the task to an agent
    Then the popup shows a status badge "Agent working"
    And the popup shows a file change counter starting at 0

    # Surface 2: Governance Feed -- Attention routing
    When the agent completes its work
    Then the governance feed shows a review-ready item for "Implement input validation"
    And the feed item offers "Review" and "Abort" actions

    # Surface 3: Agent Review View -- Deep review
    When I open the review from the feed item
    Then I see the task title "Implement input validation"
    And I see the files the agent changed
    And I see "Accept" and "Reject" options

    When I accept the agent's work
    Then the review view shows a success confirmation
    And the task status is "done"

  # US-2.3
  @walking_skeleton @skip
  Scenario: Reject agent work with feedback and see agent resume
    Given a task "Fix login bug" assigned to an agent
    And the agent has completed its work

    When I open the review view for "Fix login bug"
    And I reject the work with feedback "Please add input validation for email field"
    Then the review view shows the agent is working again
    And the task popup badge for "Fix login bug" shows "Agent working"

  # US-1.2
  @walking_skeleton @skip
  Scenario: Agent error surfaces as blocking feed item
    Given a task "Refactor auth module" assigned to an agent

    When the agent encounters an error "Out of memory during compilation"
    Then the governance feed shows a blocking item for "Refactor auth module"
    And the blocking item reason includes "Out of memory during compilation"
    And the blocking item offers "Retry" and "Discuss" actions
