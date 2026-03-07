import { describe, expect, test } from "bun:test";
import {
  buildOpencodeConfig,
  type ConfigInput,
  type OpencodeConfig,
} from "../../../app/src/server/orchestrator/config-builder";

// ---------------------------------------------------------------------------
// Acceptance: buildOpencodeConfig produces a valid config object
// ---------------------------------------------------------------------------

describe("buildOpencodeConfig", () => {
  const defaultInput: ConfigInput = {
    brainBaseUrl: "http://localhost:3000",
    workspaceId: "ws-abc-123",
    authToken: "jwt-token-xyz",
  };

  test("produces config with MCP server, model, and permissions", () => {
    const config = buildOpencodeConfig(defaultInput);

    // MCP server entry exists with correct URL and auth header
    expect(config.mcpServers).toBeDefined();
    expect(config.mcpServers.brain).toBeDefined();
    expect(config.mcpServers.brain.url).toBe(
      "http://localhost:3000/api/mcp/ws-abc-123"
    );
    expect(config.mcpServers.brain.headers).toEqual({
      Authorization: "Bearer jwt-token-xyz",
    });

    // Model defaults present
    expect(config.model.provider).toBe("anthropic");
    expect(config.model.model).toBe("claude-sonnet-4-20250514");

    // Permissions for unattended operation
    expect(config.permissions.autoApprove).toEqual([
      "read",
      "write",
      "edit",
      "bash",
    ]);
  });

  // -------------------------------------------------------------------------
  // Unit: MCP URL construction
  // -------------------------------------------------------------------------

  test("constructs MCP URL from base URL and workspace ID", () => {
    const config = buildOpencodeConfig({
      ...defaultInput,
      brainBaseUrl: "https://brain.example.com",
      workspaceId: "workspace-456",
    });

    expect(config.mcpServers.brain.url).toBe(
      "https://brain.example.com/api/mcp/workspace-456"
    );
  });

  test("strips trailing slash from base URL", () => {
    const config = buildOpencodeConfig({
      ...defaultInput,
      brainBaseUrl: "http://localhost:3000/",
    });

    expect(config.mcpServers.brain.url).toBe(
      "http://localhost:3000/api/mcp/ws-abc-123"
    );
  });

  // -------------------------------------------------------------------------
  // Unit: auth token in headers
  // -------------------------------------------------------------------------

  test("includes Bearer auth token in MCP server headers", () => {
    const config = buildOpencodeConfig({
      ...defaultInput,
      authToken: "my-secret-token",
    });

    expect(config.mcpServers.brain.headers.Authorization).toBe(
      "Bearer my-secret-token"
    );
  });

  // -------------------------------------------------------------------------
  // Unit: custom model overrides
  // -------------------------------------------------------------------------

  test("uses custom model provider when specified", () => {
    const config = buildOpencodeConfig({
      ...defaultInput,
      modelProvider: "openrouter",
      modelName: "gpt-4o",
    });

    expect(config.model.provider).toBe("openrouter");
    expect(config.model.model).toBe("gpt-4o");
  });

  test("uses default model when provider and name omitted", () => {
    const config = buildOpencodeConfig(defaultInput);

    expect(config.model.provider).toBe("anthropic");
    expect(config.model.model).toBe("claude-sonnet-4-20250514");
  });

  // -------------------------------------------------------------------------
  // Unit: permissions for unattended operation
  // -------------------------------------------------------------------------

  test("includes all required auto-approve permissions", () => {
    const config = buildOpencodeConfig(defaultInput);

    expect(config.permissions.autoApprove).toContain("read");
    expect(config.permissions.autoApprove).toContain("write");
    expect(config.permissions.autoApprove).toContain("edit");
    expect(config.permissions.autoApprove).toContain("bash");
  });
});
