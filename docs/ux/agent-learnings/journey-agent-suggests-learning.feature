Feature: Agent Suggests a Learning
  As an autonomous system that detects behavioral patterns,
  I want to suggest persistent learnings based on repeated corrections,
  so workspace knowledge improves without requiring human initiative.

  Background:
    Given workspace "Brain Development" is owned by Tomas Eriksson
    And the Observer agent has access to the knowledge graph

  # --- Step 1: Pattern Detection ---

  Scenario: Observer detects repeated correction pattern above threshold
    Given agent_session:a1b2c3 contains correction "don't use null, use undefined" on March 5
    And agent_session:d4e5f6 contains correction "we never use null in domain data" on March 8
    And agent_session:g7h8i9 contains correction "null is a contract violation" on March 11
    When the Observer agent runs pattern detection
    Then a correction cluster is identified for topic "null vs undefined"
    And the cluster has 3 occurrences with confidence 0.89
    And the target agent is identified as code_agent

  Scenario: Observer skips pattern below suggestion threshold
    Given only 2 corrections about "RecordId string format" exist in the past 14 days
    When the Observer agent runs pattern detection
    Then no learning suggestion is created for this pattern
    And an observation is logged with text "Emerging pattern: RecordId corrections (2 occurrences). Monitoring."
    And severity is "info"

  Scenario: Observer skips pattern already covered by active learning
    Given an active learning "Never use null for domain data values" exists
    And 3 corrections about null usage exist in the graph
    When the Observer checks for existing learning coverage
    Then no new suggestion is created
    And an observation is logged "Correction pattern matches existing active learning. Agent may not be applying it."

  # --- Step 2: Suggestion Creation ---

  Scenario: Learning suggestion created with pending_approval status
    Given the Observer detected a correction pattern about "null vs undefined" with confidence 0.89
    And no existing active learning covers this pattern
    When the Observer creates a learning suggestion
    Then a learning record is created with:
      | field           | value                                                     |
      | text            | Never use null for domain data values. Represent absence with omitted optional fields. |
      | status          | pending_approval                                          |
      | source          | agent                                                     |
      | suggested_by    | observer                                                  |
      | target_agents   | code_agent                                                |
      | confidence      | 0.89                                                      |
      | learning_type   | constraint                                                |
    And evidence_refs link to agent_session:a1b2c3, agent_session:d4e5f6, agent_session:g7h8i9
    And an embedding vector is generated from the suggestion text

  Scenario: Cross-agent coaching suggestion
    Given the PM agent detected that coding agents create tasks without linking to features
    When the PM agent creates a learning suggestion
    Then a learning record is created with suggested_by "pm_agent"
    And target_agents includes "code_agent"
    And the suggestion text is "When creating tasks, always link to parent feature via belongs_to relation"
    And status is "pending_approval"

  # --- Step 3: Governance Feed Display ---

  Scenario: Pending learning appears as yellow-tier feed card
    Given a learning suggestion exists with status "pending_approval"
    And suggested_by is "observer" with confidence 0.89
    When Tomas opens the governance feed
    Then a yellow-tier card appears for the learning suggestion
    And the card shows the suggested rule text
    And the card shows "Suggested by: Observer | Confidence: 89%"
    And the card shows "For: code_agent"
    And the card shows evidence from 3 sessions with correction quotes
    And three action buttons are visible: "Approve", "Edit & Approve", "Dismiss"

  Scenario: Feed filterable by learnings
    Given 3 pending learning suggestions and 5 pending suggestions exist
    When Tomas filters the governance feed to "Learnings"
    Then only the 3 learning suggestion cards are shown

  Scenario: Evidence drill-down on feed card
    Given a pending learning suggestion has 3 evidence_refs
    When Tomas expands the evidence section on the feed card
    Then each evidence ref shows the session date
    And the correction quote from that session
    And a link to the session record

  # --- Step 4: Human Review Decision ---

  Scenario: Tomas approves suggestion as-is
    Given a pending learning suggestion "Never use null for domain data values" is displayed
    When Tomas clicks "Approve"
    Then the learning status changes from "pending_approval" to "active"
    And approved_by references Tomas Eriksson's identity record
    And approved_at is set to the current timestamp
    And a confirmation message appears "Learning approved and activated"
    And the card is removed from the pending feed

  Scenario: Tomas edits and approves suggestion
    Given a pending learning suggestion is displayed
    When Tomas clicks "Edit & Approve"
    Then the learning editor opens with the suggested text pre-filled
    And Tomas can modify the text to add "Do NOT sanitize/coerce it at consumers."
    And Tomas can change target_agents to include chat_agent
    When Tomas clicks "Save & Activate"
    Then the learning is saved with the edited text and status "active"
    And the original suggestion text is preserved in the edit history

  Scenario: Tomas dismisses low-quality suggestion
    Given a pending learning suggestion "Prefer shorter task titles under 60 characters" is displayed
    And the suggestion has confidence 0.62
    When Tomas clicks "Dismiss"
    Then an optional reason input appears
    When Tomas enters "too subjective, not a universal rule" and confirms
    Then the learning status changes to "dismissed"
    And dismissed_reason stores "too subjective, not a universal rule"
    And dismissed_by references Tomas Eriksson's identity record
    And the card is removed from the governance feed

  Scenario: Batch review summary
    Given Tomas has reviewed 3 pending learning suggestions
    And approved 2 and dismissed 1
    When the last review action completes
    Then a summary message appears showing "Approved: 2, Dismissed: 1"
    And the total active learning count is updated
