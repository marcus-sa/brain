Feature: Runtime Learning Injection
  As a system that manages agent prompts,
  I want to inject relevant workspace learnings into agent system prompts,
  so agents operate with accumulated behavioral wisdom while keeping prompts efficient.

  Background:
    Given workspace "Brain Development" owned by Tomas Eriksson
    And the workspace has the following active learnings:
      | text                                          | type        | source | target_agents        | priority |
      | Never use null for domain data values          | constraint  | human  | code_agent, chat_agent | medium  |
      | KNN + WHERE two-step pattern                   | constraint  | agent  | code_agent            | medium  |
      | Always use --no-verify when committing         | instruction | human  | code_agent            | medium  |
      | Billing uses integer cents not float dollars   | precedent   | human  | code_agent            | low    |

  # --- Learning Query ---

  Scenario: Active learnings queried for code_agent session
    When a new code_agent session starts in "Brain Development"
    Then the system queries learnings WHERE workspace matches AND "code_agent" IN target_agents AND status = "active"
    And returns 4 learning records

  Scenario: Active learnings queried for chat_agent session
    When a new chat_agent session starts in "Brain Development"
    Then the system queries learnings targeting chat_agent
    And returns 1 learning record ("Never use null")

  Scenario: No learnings for agent type
    Given all active learnings target only code_agent
    When a pm_agent session starts
    Then the learning query returns zero records
    And no "Workspace Learnings" section is added to the prompt

  # --- Priority Sort ---

  Scenario: Human-created learnings sorted before agent-suggested
    Given 3 human-created and 1 agent-suggested learnings are active for code_agent
    When the system sorts learnings for injection
    Then the order is:
      | position | text                                  | source |
      | 1        | Never use null for domain data values | human  |
      | 2        | Always use --no-verify when committing | human  |
      | 3        | Billing uses integer cents            | human  |
      | 4        | KNN + WHERE two-step pattern          | agent  |

  # --- Token Budget ---

  Scenario: All learnings fit within token budget
    Given 4 active learnings for code_agent totaling approximately 300 tokens
    And the learning section token budget is 500
    When the system applies token budget
    Then all 4 learnings are included
    And no learnings are excluded

  Scenario: Token budget exceeded -- lowest priority agent-suggested learnings dropped
    Given 12 active learnings for code_agent totaling 900 tokens
    And the learning section token budget is 500 tokens
    And 8 are human-created (500 tokens) and 4 are agent-suggested (400 tokens)
    When the system applies token budget
    Then all 8 human-created learnings are included
    And agent-suggested learnings are included by priority until budget reached
    And excluded learnings are logged in the session record

  Scenario: Human-created learnings alone exceed budget
    Given 20 human-created learnings totaling 1200 tokens for code_agent
    And the learning section token budget is 500 tokens
    When the system applies token budget
    Then all 20 human-created learnings are included (budget override for human rules)
    And zero agent-suggested learnings are included
    And an observation is created: "Learning token budget exceeded by human rules. Consider consolidating."

  # --- Prompt Injection ---

  Scenario: Learnings formatted as prompt section for chat agent
    Given 1 active learning for chat_agent
    When buildSystemPrompt() is called for the chat agent
    Then the system prompt includes a "Workspace Learnings" section
    And the section starts with "These rules were established by your workspace. Follow them in all interactions."
    And learnings are grouped under type headings: Constraints, Instructions, Precedents
    And the constraint "Never use null for domain data values" appears under Constraints

  Scenario: Learnings formatted for MCP context packet
    Given 4 active learnings for code_agent
    When the MCP context builder prepares the context packet
    Then the packet includes an "Active Learnings" section
    And each learning is prefixed with its type tag: [constraint], [instruction], [precedent]

  Scenario: No learnings section for empty workspace
    Given workspace "New Project" has zero active learnings
    When any agent session starts in "New Project"
    Then no "Workspace Learnings" section appears in the system prompt
    And no empty section header is rendered

  # --- Conflict Resolution at Injection ---

  Scenario: Contradictory learnings resolved by source priority
    Given an active human-created learning "Never use null"
    And an active agent-suggested learning "Return null from API when not found"
    When the system detects these are semantically contradictory
    Then both learnings are included in the prompt
    And a note is added: "Note: conflict detected between learnings. Human-created rule takes priority."
    And an observation is logged about the conflict for governance review

  # --- Properties ---

  @property
  Scenario: Learning injection latency
    Given a workspace with up to 50 active learnings
    When the learning query, sort, budget, and format pipeline runs
    Then the total injection pipeline completes within 100ms
    And does not add perceptible delay to agent session startup

  @property
  Scenario: Learning injection determinism
    Given the same set of active learnings and the same agent type
    When the injection pipeline runs multiple times
    Then the same learnings are selected in the same order every time
    And the formatted prompt section is identical across runs
