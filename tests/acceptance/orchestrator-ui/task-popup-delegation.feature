Feature: Task Popup Agent Delegation
  As a user viewing a task in the graph
  I want to see agent controls and status in the task popup
  So that I can delegate work and track progress without leaving the graph view

  Background:
    Given a workspace with an active project

  # --- Assign Button Visibility ---

  # US-0.4
  @skip
  Scenario: Assign button visible for ready task
    Given a task "Build API endpoint" with status "ready"
    When I open the task popup for "Build API endpoint"
    Then the popup shows an "Assign to Agent" button

  # US-0.4
  @skip
  Scenario: Assign button visible for todo task
    Given a task "Write unit tests" with status "todo"
    When I open the task popup for "Write unit tests"
    Then the popup shows an "Assign to Agent" button

  # US-0.4
  @skip
  Scenario: Assign button hidden for task already in progress
    Given a task "Deploy service" with status "in_progress"
    When I open the task popup for "Deploy service"
    Then the popup does not show an "Assign to Agent" button

  # US-0.4
  @skip
  Scenario: Assign button hidden for completed task
    Given a task "Setup CI pipeline" with status "done"
    When I open the task popup for "Setup CI pipeline"
    Then the popup does not show an "Assign to Agent" button

  # --- Agent Status Badge ---

  # US-0.5
  @skip
  Scenario: Status badge shows agent working after assignment
    Given a task "Build API endpoint" with status "ready"
    When I open the task popup for "Build API endpoint"
    And I assign the task to an agent
    Then the popup shows a status badge "Agent working"
    And the popup shows elapsed time since assignment started

  # US-1.1
  @skip
  Scenario: File change counter updates during agent work
    Given a task "Build API endpoint" assigned to an agent
    And the agent has changed 0 files so far
    When the agent modifies a file
    Then the file change counter in the popup shows 1
    When the agent creates another file
    Then the file change counter in the popup shows 2

  # US-0.5
  @skip
  Scenario: Review button appears when agent work is ready for review
    Given a task "Build API endpoint" assigned to an agent
    When the agent completes its work
    Then the popup shows a status badge "Review ready"
    And the popup shows a "Review" button
    When I click the "Review" button
    Then the review view opens for the agent session

  # US-0.5
  @skip
  Scenario: Status badge shows error when agent fails
    Given a task "Build API endpoint" assigned to an agent
    When the agent encounters an error "Compilation failed"
    Then the popup shows a status badge "Agent error"
    And the popup shows the error message "Compilation failed"
