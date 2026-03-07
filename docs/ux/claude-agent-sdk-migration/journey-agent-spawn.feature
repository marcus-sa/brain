Feature: Orchestrator spawns Claude Agent via Agent SDK
  As the Brain orchestrator
  I want to spawn coding agents using the Claude Agent SDK
  So I get full lifecycle hooks, typed events, and MCP integration without managing external processes

  Background:
    Given a workspace with a task in "ready" status
    And the task has a valid repo path
    And no agent session is currently active for this task

  # --- J1: Core Agent Spawn ---

  Scenario: Successful agent session creation
    When the orchestrator creates a session for the task
    Then a git worktree is created for the task
    And the Agent SDK query is invoked with the worktree as cwd
    And the Brain MCP server is configured as a stdio server
    And the session status transitions to "spawning"
    And the first SDK message transitions status to "active"

  Scenario: Agent SDK query receives system prompt with task context
    When the orchestrator creates a session for the task
    Then the query prompt includes the task ID
    And the prompt instructs the agent to start the brain-start-task workflow

  Scenario: Agent session produces typed event stream
    When the agent session is active
    Then SDK messages are transformed to Brain StreamEvents
    And StreamEvents are emitted to the SSE registry
    And the browser receives token and status events

  Scenario: Agent session completes successfully
    When the SDK query yields a result message with subtype "success"
    Then the session status transitions to "idle"
    And the stall detector is stopped

  Scenario: Agent session hits max turns
    When the SDK query yields a result with subtype "error_max_turns"
    Then the session status transitions to "idle"
    And the session is available for review

  Scenario: Agent session abort
    When the user aborts an active session
    Then the abort controller signal is triggered
    And the SDK query iteration stops
    And the worktree is cleaned up
    And the task returns to "ready" status

  Scenario: Spawn failure rolls back cleanly
    When the Agent SDK query throws during initialization
    Then the worktree is removed
    And the agent_session record is deleted
    And an error result is returned

  # --- J3: Lifecycle Hooks ---

  Scenario: SessionStart hook loads brain context
    When the agent session starts
    Then the SessionStart hook calls brain system load-context
    And the response is injected as additional context

  Scenario: PreToolUse hook intercepts subagent dispatch
    When the agent invokes a tool
    Then the PreToolUse hook receives tool_name and tool_input
    And if the tool dispatches a subagent, brain context is injected

  Scenario: UserPromptSubmit hook checks for updates
    When a follow-up prompt is sent to the agent
    Then the UserPromptSubmit hook calls brain system check-updates
    And workspace-level graph updates are surfaced

  Scenario: Stop hook catches unlogged decisions
    When the agent reaches a stop point
    Then the Stop hook prompts the agent to review unlogged items
    And decisions, observations, and task updates are logged to the graph

  Scenario: PreCompact hook preserves brain state
    When the agent's context window triggers compaction
    Then the PreCompact hook loads current brain context
    And the context is included in the compaction summary

  Scenario: SessionEnd hook logs session summary
    When the agent session ends
    Then the SessionEnd hook calls brain system end-session
    And the session summary is persisted to the knowledge graph

  # --- J1: MCP Integration ---

  Scenario: Brain MCP server provides all tools
    When the agent session is active
    Then the Brain MCP server is available via stdio transport
    And all 20+ Brain tools are accessible to the agent
    And no duplicate tool definitions exist in hooks or config

  Scenario: MCP server failure does not crash the agent
    When the Brain MCP server process exits unexpectedly
    Then the agent continues running with degraded functionality
    And the error is logged as a session event
