import { describe, expect, test } from "bun:test";
import {
  buildAgentOptions,
  type AgentSpawnConfig,
} from "../../../app/src/server/orchestrator/agent-options";

// ---------------------------------------------------------------------------
// Acceptance: buildAgentOptions produces valid SDK options from AgentSpawnConfig
// ---------------------------------------------------------------------------

describe("buildAgentOptions", () => {
  const defaultConfig: AgentSpawnConfig = {
    prompt: "Implement the login feature",
    workDir: "/tmp/worktree/task-123",
    workspaceId: "ws-abc-123",
    brainBaseUrl: "http://localhost:3000",
  };

  test("produces options with prompt, cwd, and maxTurns", () => {
    const options = buildAgentOptions(defaultConfig);

    expect(options.prompt).toBe("Implement the login feature");
    expect(options.options.cwd).toBe("/tmp/worktree/task-123");
    expect(options.options.maxTurns).toBe(200);
  });

  // -------------------------------------------------------------------------
  // Unit: Brain MCP server configured as stdio transport
  // -------------------------------------------------------------------------

  test("configures brain MCP server as stdio transport", () => {
    const options = buildAgentOptions(defaultConfig);

    const brain = options.options.mcpServers?.brain;
    expect(brain).toBeDefined();
    expect(brain!.type).toBe("stdio");
    expect(brain!.command).toBe("brain");
    expect(brain!.args).toEqual(["mcp"]);
  });

  test("passes workspace ID and base URL as MCP env vars", () => {
    const options = buildAgentOptions({
      ...defaultConfig,
      brainBaseUrl: "https://brain.example.com",
      workspaceId: "workspace-456",
    });

    const env = options.options.mcpServers?.brain?.env;
    expect(env).toBeDefined();
    expect(env!.BRAIN_SERVER_URL).toBe("https://brain.example.com");
    expect(env!.BRAIN_WORKSPACE_ID).toBe("workspace-456");
  });

  // -------------------------------------------------------------------------
  // Unit: Allowed tools for autonomous agent
  // -------------------------------------------------------------------------

  test("includes standard file and search tools in allowedTools", () => {
    const options = buildAgentOptions(defaultConfig);

    expect(options.options.allowedTools).toEqual([
      "Read",
      "Edit",
      "Write",
      "Bash",
      "Glob",
      "Grep",
    ]);
  });

  // -------------------------------------------------------------------------
  // Unit: CLAUDE.md preset loading via systemPrompt and settingSources
  // -------------------------------------------------------------------------

  test("sets systemPrompt to claude_code preset for CLAUDE.md loading", () => {
    const options = buildAgentOptions(defaultConfig);

    expect(options.options.systemPrompt).toEqual({
      type: "preset",
      preset: "claude_code",
    });
  });

  test("includes settingSources with project for CLAUDE.md discovery", () => {
    const options = buildAgentOptions(defaultConfig);

    expect(options.options.settingSources).toEqual(["project"]);
  });
});
