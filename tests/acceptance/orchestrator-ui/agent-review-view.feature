Feature: Agent Review View
  As a user whose task was completed by an agent
  I want a dedicated review view showing diff, reasoning, and metadata
  So that I can make an informed accept or reject decision with full context

  Background:
    Given a workspace with an active project

  # --- Review Content ---

  # US-2.1
  @skip
  Scenario: Review view shows task title, diff, and session metadata
    Given a task "Add user profile page" completed by an agent
    And the agent changed 3 files with 47 additions and 12 deletions
    When I open the review view for "Add user profile page"
    Then I see the task title "Add user profile page"
    And I see 3 files changed with a summary of additions and deletions
    And I see the agent session duration
    And I see counts for decisions, questions, and observations

  # US-2.1
  @skip
  Scenario: Review view accessible from task popup
    Given a task "Add user profile page" with agent work ready for review
    When I open the task popup for "Add user profile page"
    And I click the "Review" button in the popup
    Then the review view opens for the agent session on "Add user profile page"

  # US-2.1
  @skip
  Scenario: Review view accessible from feed item
    Given a task "Add user profile page" with a review-ready feed item
    When I click the "Review" action on the feed item for "Add user profile page"
    Then the review view opens for the agent session on "Add user profile page"

  # --- Accept Flow ---

  # US-2.2
  @skip
  Scenario: Accept marks task done and shows success
    Given a task "Add user profile page" with agent work ready for review
    When I open the review view for "Add user profile page"
    And I accept the agent's work
    Then the review view shows a success confirmation
    And the task status for "Add user profile page" is "done"
    And the agent session is marked as completed

  # US-2.2
  @skip
  Scenario: Accept button disabled while acceptance is in progress
    Given a task "Add user profile page" with agent work ready for review
    When I open the review view for "Add user profile page"
    And I click "Accept"
    Then the "Accept" button is disabled until the operation completes

  # --- Reject Flow ---

  # US-2.3
  @skip
  Scenario: Reject with feedback resumes agent work
    Given a task "Add user profile page" with agent work ready for review
    When I open the review view for "Add user profile page"
    And I click "Reject"
    Then a feedback form appears

    When I enter feedback "Please add loading states for async operations"
    And I submit the feedback
    Then the review view transitions to show the agent is working again
    And the task status for "Add user profile page" is "in_progress"

  # US-2.3
  @skip
  Scenario: Reject without feedback text is prevented
    Given a task "Add user profile page" with agent work ready for review
    When I open the review view for "Add user profile page"
    And I click "Reject"
    Then the submit button is disabled until feedback text is entered
