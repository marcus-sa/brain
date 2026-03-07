/**
 * Unit tests for MCP plugin lifecycle hooks.
 *
 * Tests the session start/end behaviors through the query layer:
 * - Session end for nonexistent session throws
 * - Duplicate session end is idempotent (does not overwrite summary)
 * - Session end for wrong workspace throws
 */
import { describe, expect, it } from "bun:test";
import { RecordId } from "surrealdb";
import { endAgentSession } from "../../app/src/server/mcp/mcp-queries";

// ---------------------------------------------------------------------------
// Surreal stub factory
// ---------------------------------------------------------------------------

type SessionRow = {
  workspace: RecordId<"workspace", string>;
  ended_at?: Date;
  summary?: string;
};

function createSurrealStub(sessionData?: SessionRow) {
  const updates: Array<{ record: unknown; data: unknown }> = [];

  const stub = {
    select(_record: unknown) {
      return Promise.resolve(sessionData);
    },
    update(record: unknown) {
      return {
        merge(data: unknown) {
          updates.push({ record, data });
          return Promise.resolve({ id: record, ...(data as object) });
        },
      };
    },
    relate() {
      return {
        output() {
          return Promise.resolve({});
        },
      };
    },
  };

  return { stub: stub as any, updates };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("endAgentSession", () => {
  const workspaceRecord = new RecordId("workspace", "ws-1");

  it("throws when session does not exist", async () => {
    const { stub } = createSurrealStub(undefined);

    await expect(
      endAgentSession({
        surreal: stub,
        workspaceRecord,
        sessionId: "nonexistent-session",
        summary: "Some work",
      }),
    ).rejects.toThrow("session not found");
  });

  it("throws when session is in a different workspace", async () => {
    const { stub } = createSurrealStub({
      workspace: new RecordId("workspace", "other-ws"),
    });

    await expect(
      endAgentSession({
        surreal: stub,
        workspaceRecord,
        sessionId: "session-1",
        summary: "Some work",
      }),
    ).rejects.toThrow("session is outside the current workspace scope");
  });

  it("returns ended:true and records summary on first end", async () => {
    const { stub, updates } = createSurrealStub({
      workspace: workspaceRecord,
    });

    const result = await endAgentSession({
      surreal: stub,
      workspaceRecord,
      sessionId: "session-1",
      summary: "Implemented user auth",
      filesChanged: [{ path: "src/auth.ts", change_type: "created" }],
    });

    expect(result.ended).toBe(true);
    expect(result.session_id).toBe("session-1");
    // Should have written the summary
    expect(updates.length).toBeGreaterThan(0);
    const mergeData = updates[0].data as Record<string, unknown>;
    expect(mergeData.summary).toBe("Implemented user auth");
  });

  it("returns ended:true without overwriting summary on duplicate end", async () => {
    const { stub, updates } = createSurrealStub({
      workspace: workspaceRecord,
      ended_at: new Date("2026-03-07T08:00:00Z"),
      summary: "First end summary",
    });

    const result = await endAgentSession({
      surreal: stub,
      workspaceRecord,
      sessionId: "session-1",
      summary: "Duplicate end summary",
    });

    expect(result.ended).toBe(true);
    expect(result.session_id).toBe("session-1");
    // Should NOT have written any updates (idempotent)
    expect(updates).toHaveLength(0);
  });
});
