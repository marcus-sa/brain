import { beforeAll, describe, expect, it } from "bun:test";
import { RecordId } from "surrealdb";
import { createTestUserWithMcp, setupAcceptanceSuite, type TestUserWithMcp } from "../acceptance-test-kit";

const getRuntime = setupAcceptanceSuite("oauth-mcp-auth");

describe("OAuth MCP Auth", () => {
  let workspaceId: string;
  let mcpUser: TestUserWithMcp;

  beforeAll(async () => {
    const { baseUrl, surreal } = getRuntime();

    // Create workspace with all required SCHEMAFULL fields
    workspaceId = crypto.randomUUID();
    const wsRecord = new RecordId("workspace", workspaceId);
    await surreal.query(
      `CREATE $ws CONTENT {
        name: "OAuth Test Workspace",
        status: "active",
        onboarding_complete: true,
        onboarding_turn_count: 0,
        onboarding_summary_pending: false,
        onboarding_started_at: time::now(),
        created_at: time::now()
      };`,
      { ws: wsRecord },
    );

    // Create project linked to workspace
    const projRecord = new RecordId("project", crypto.randomUUID());
    await surreal.query(
      `CREATE $proj CONTENT {
        name: "Test Project",
        status: "active",
        workspace: $ws,
        created_at: time::now()
      };`,
      { proj: projRecord, ws: wsRecord },
    );
    await surreal.query(
      `RELATE $ws->has_project->$proj SET added_at = time::now();`,
      { ws: wsRecord, proj: projRecord },
    );

    // Get DPoP-capable user for MCP access
    mcpUser = await createTestUserWithMcp(baseUrl, surreal, `oauth-mcp-${Date.now()}`);
  }, 30_000);

  it("MCP route with valid DPoP token returns data", async () => {
    const res = await mcpUser.mcpFetch(`/api/mcp/${workspaceId}/workspace-context`, { body: {} });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("projects");
  });

  it("MCP route without token returns 401", async () => {
    const { baseUrl } = getRuntime();
    const res = await fetch(`${baseUrl}/api/mcp/${workspaceId}/workspace-context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it("MCP route with invalid token returns 401", async () => {
    const { baseUrl } = getRuntime();
    const res = await fetch(`${baseUrl}/api/mcp/${workspaceId}/workspace-context`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "DPoP invalid-jwt-token",
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it("MCP route with Bearer token (no DPoP) returns 401 dpop_required", async () => {
    const { baseUrl } = getRuntime();
    const res = await fetch(`${baseUrl}/api/mcp/${workspaceId}/workspace-context`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mcpUser.accessToken}`,
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it(".well-known/oauth-protected-resource returns metadata", async () => {
    const { baseUrl } = getRuntime();
    const res = await fetch(`${baseUrl}/.well-known/oauth-protected-resource`);
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data).toHaveProperty("resource");
  });
});

