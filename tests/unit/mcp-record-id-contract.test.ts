import { describe, expect, it } from "bun:test";
import { RecordId } from "surrealdb";
import { parseRecordIdString } from "../../app/src/server/graph/queries";
import { requireRawId, toRawId } from "../../app/src/server/mcp/id-format";

describe("MCP RecordId wire contract", () => {
  it("round-trips fixed-table raw ids", () => {
    const rawId = "session-123";
    const sessionRecord = new RecordId("agent_session", requireRawId(rawId, "session_id"));
    expect(toRawId(sessionRecord)).toBe(rawId);
  });

  it("parses polymorphic table:id references", () => {
    const record = parseRecordIdString("task:task-456", ["project", "feature", "task", "decision", "question"] as const);
    expect(record.table.name).toBe("task");
    expect(record.id as string).toBe("task-456");
  });

  it("rejects prefixed ids in fixed-table fields", () => {
    expect(() => requireRawId("agent_session:session-123", "session_id")).toThrow(
      "session_id must be a raw id without table prefix",
    );
  });
});
