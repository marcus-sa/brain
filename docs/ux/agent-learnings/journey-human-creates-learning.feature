Feature: Human Creates a Learning
  As a workspace owner who has corrected agent behavior repeatedly,
  I want to save a persistent behavioral rule,
  so agents remember my corrections across sessions.

  Background:
    Given Tomas Eriksson is the workspace owner of "Brain Development"
    And the workspace has 5 active learnings

  # --- Step 1: Correction Trigger ---

  Scenario: Chat agent detects repeated correction and offers learning creation
    Given Tomas has corrected the coding agent about "null vs undefined" 3 times in the past 7 days
    When Tomas types "Don't use null. Use undefined via optional properties. I've told you this before."
    Then the chat agent acknowledges the correction and applies it
    And an inline card appears offering "Save as Learning?"
    And the card includes a brief explanation: "I noticed you've corrected this pattern before"
    And the card shows two actions: "Save as Learning" and "Not now"

  Scenario: No learning suggestion for first-time correction
    Given Tomas has not previously corrected "null vs undefined" usage
    When Tomas types "Don't use null here, use an optional property"
    Then the chat agent acknowledges and applies the correction
    And no "Save as Learning" card appears

  # --- Step 2: Learning Editor ---

  Scenario: Learning editor pre-fills from correction text
    Given Tomas clicked "Save as Learning" on a correction about null usage
    When the learning editor opens
    Then the rule text field is pre-filled with text derived from the correction
    And the type selector shows three options: Constraint, Instruction, Precedent
    And the agent scope shows checkboxes for all agent types
    And code_agent and chat_agent are checked by default
    And workspace-wide scope is selected

  Scenario: Tomas selects project-specific scope
    Given the learning editor is open
    When Tomas changes scope from "Entire workspace" to "Specific project"
    Then a project selector dropdown appears
    And Tomas can select "Brain v1" from the workspace projects
    And the learning will only apply to sessions in that project context

  # --- Step 3: Save and Confirm ---

  Scenario: Human-created learning saved with active status
    Given Tomas has filled in the learning editor with:
      | field         | value                                              |
      | text          | Never use null for domain data values. Represent absence with omitted optional fields. |
      | type          | constraint                                         |
      | target_agents | code_agent, chat_agent                             |
      | scope         | workspace                                          |
    When Tomas clicks "Save Learning"
    Then a learning record is created in SurrealDB with status "active"
    And source is "human"
    And created_by references Tomas Eriksson's identity record
    And a confirmation card appears in chat showing the saved learning
    And the confirmation shows "Status: Active" with no approval required

  Scenario: Learning saved with embedding for conflict detection
    Given Tomas saves a learning with text "Never use null for domain data values"
    When the learning record is created
    Then an embedding vector is generated from the learning text
    And stored in the learning record's embedding field
    And the embedding is used for duplicate and conflict detection

  # --- Step 4: Verification ---

  Scenario: Learning injected in next coding agent session
    Given Tomas created an active learning "Never use null for domain data values" targeting code_agent
    When a new code_agent session starts in Tomas's workspace
    Then the system prompt includes the learning under "Workspace Learnings > Constraints"
    And the agent uses optional properties instead of null when applicable

  # --- Error Paths ---

  Scenario: Duplicate learning detected on save
    Given an active learning exists with text "Never persist null for domain data values"
    When Tomas saves a new learning "Do not use null in domain data"
    Then the system detects semantic similarity above 0.85
    And shows the existing learning side-by-side
    And offers three options: "Update existing", "Save as separate", "Cancel"

  Scenario: Conflicting learning detected on save
    Given an active learning exists with text "Never use null for domain data values"
    When Tomas saves a new learning "Always use null for optional API response fields"
    Then the system detects a potential semantic contradiction
    And shows both learnings with conflict explanation
    And offers: "Supersede existing", "Save both (different scopes)", "Cancel"

  Scenario: Superseding an existing learning
    Given an active learning "Use snake_case for DB fields" exists with id learning:abc123
    And Tomas is creating a learning "Use camelCase for all SurrealDB field names"
    When Tomas chooses "Supersede existing" on the conflict dialog
    Then learning:abc123 status changes to "superseded"
    And learning:abc123 gains a superseded_by reference to the new learning
    And the new learning is created with status "active"
    And the supersession chain is preserved in history
