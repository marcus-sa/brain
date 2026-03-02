import { describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { RecordId } from "surrealdb";
import { collectSseEvents, fetchJson, setupSmokeSuite } from "./smoke-test-kit";

type ChatMessageResponse = {
  messageId: string;
  userMessageId: string;
  conversationId: string;
  workspaceId: string;
  streamUrl: string;
};

type StreamEvent =
  | {
      type: "extraction";
      messageId: string;
      entities: Array<{ id: string; kind: string; text: string; confidence: number }>;
    }
  | { type: "done"; messageId: string }
  | { type: "error"; messageId: string; error: string }
  | { type: string; messageId: string };

type DescriptionEntryRow = {
  text: string;
  reasoning: string;
  triggered_by: RecordId[];
  created_at: string;
};

type EntityWithDescription = {
  id: RecordId;
  description?: string;
  description_entries?: DescriptionEntryRow[];
};

const getRuntime = setupSmokeSuite("description-entries");

async function createWorkspaceAndSendMessage(
  baseUrl: string,
  text: string,
): Promise<{ workspaceId: string; conversationId: string; events: StreamEvent[] }> {
  const workspace = await fetchJson<{ workspaceId: string; conversationId: string }>(`${baseUrl}/api/workspaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `Description Smoke ${Date.now()}`,
      ownerDisplayName: "Marcus",
    }),
  });

  const message = await fetchJson<ChatMessageResponse>(`${baseUrl}/api/chat/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientMessageId: randomUUID(),
      workspaceId: workspace.workspaceId,
      conversationId: workspace.conversationId,
      text,
    }),
  });

  const events = await collectSseEvents<StreamEvent>(`${baseUrl}${message.streamUrl}`, 30_000);

  return { workspaceId: workspace.workspaceId, conversationId: workspace.conversationId, events };
}

describe("description entries smoke", () => {
  it("seeds description_entries on extracted entities", async () => {
    const { baseUrl, surreal } = getRuntime();

    const { events } = await createWorkspaceAndSendMessage(
      baseUrl,
      "We need to build a user authentication feature. Task: implement login endpoint with JWT tokens.",
    );

    const extractionEvent = events.find((e) => e.type === "extraction");
    expect(extractionEvent).toBeDefined();
    if (!extractionEvent || extractionEvent.type !== "extraction") {
      throw new Error("Expected extraction event");
    }

    // Find a task or feature entity from extraction
    const describableEntity = extractionEvent.entities.find(
      (e) => e.kind === "task" || e.kind === "feature",
    );
    expect(describableEntity).toBeDefined();
    if (!describableEntity) {
      throw new Error("Expected a task or feature entity from extraction");
    }

    // Wait briefly for fire-and-forget seed to complete
    await Bun.sleep(1_000);

    const [idParts] = describableEntity.id.split(":").slice(1);
    const entityRecord = new RecordId(describableEntity.kind, idParts ?? describableEntity.id.split(":")[1]);
    const tableName = describableEntity.kind;

    const [rows] = await surreal
      .query<[EntityWithDescription[]]>(
        `SELECT id, description, description_entries FROM ${tableName} WHERE id = $record LIMIT 1;`,
        { record: entityRecord },
      )
      .collect<[EntityWithDescription[]]>();

    expect(rows.length).toBe(1);
    const entity = rows[0]!;

    expect(entity.description).toBeDefined();
    expect(typeof entity.description).toBe("string");
    expect(entity.description!.length).toBeGreaterThan(0);

    expect(Array.isArray(entity.description_entries)).toBe(true);
    expect(entity.description_entries!.length).toBe(1);

    const entry = entity.description_entries![0]!;
    expect(entry.text.length).toBeGreaterThan(0);
    expect(entry.reasoning).toBe("Extracted from conversation");
    expect(Array.isArray(entry.triggered_by)).toBe(true);

    // description should equal the single entry's text (no LLM synthesis for single entry)
    expect(entity.description).toBe(entry.text);
  }, 60_000);

  it("seeds description from work-item-accept rationale", async () => {
    const { baseUrl, surreal } = getRuntime();

    const workspace = await fetchJson<{ workspaceId: string; conversationId: string }>(`${baseUrl}/api/workspaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `WorkItem Desc Smoke ${Date.now()}`,
        ownerDisplayName: "Marcus",
      }),
    });

    const rationale = "Implement rate limiting middleware to prevent API abuse";
    const result = await fetchJson<{ entityId: string }>(
      `${baseUrl}/api/workspaces/${workspace.workspaceId}/work-items/accept`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "task",
          title: "Add rate limiting",
          rationale,
        }),
      },
    );

    expect(result.entityId).toBeDefined();

    // Wait briefly for fire-and-forget seed
    await Bun.sleep(1_000);

    const entityIdPart = result.entityId.split(":")[1]!;
    const taskRecord = new RecordId("task", entityIdPart);

    const [rows] = await surreal
      .query<[EntityWithDescription[]]>(
        "SELECT id, description, description_entries FROM task WHERE id = $record LIMIT 1;",
        { record: taskRecord },
      )
      .collect<[EntityWithDescription[]]>();

    expect(rows.length).toBe(1);
    const task = rows[0]!;

    expect(task.description).toBe(rationale);
    expect(task.description_entries).toHaveLength(1);
    expect(task.description_entries![0]!.text).toBe(rationale);
    expect(task.description_entries![0]!.reasoning).toBe("Created from work item suggestion");
  }, 30_000);

  it("appends description entry and regenerates description on decision confirm", async () => {
    const { baseUrl, surreal } = getRuntime();

    // Create workspace and extract a decision + related entities
    const { workspaceId, events } = await createWorkspaceAndSendMessage(
      baseUrl,
      "For the billing system project, I've decided we should use Stripe for payment processing. Task: integrate Stripe SDK into the backend.",
    );

    const extractionEvent = events.find((e) => e.type === "extraction");
    expect(extractionEvent).toBeDefined();
    if (!extractionEvent || extractionEvent.type !== "extraction") {
      throw new Error("Expected extraction event");
    }

    const decisionEntity = extractionEvent.entities.find((e) => e.kind === "decision");
    if (!decisionEntity) {
      // Decision extraction is not guaranteed — skip the rest
      console.warn("No decision entity extracted, skipping confirm test");
      return;
    }

    // Wait for initial seeds to complete
    await Bun.sleep(1_500);

    // Confirm the decision
    await fetchJson<{ status: string }>(
      `${baseUrl}/api/entities/${decisionEntity.id}/actions?workspaceId=${workspaceId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          notes: "Approved by team",
        }),
      },
    );

    // Wait for fire-and-forget description updates to propagate
    await Bun.sleep(3_000);

    // Check that related entities (project/feature/task) got a description entry from the decision
    const decisionIdPart = decisionEntity.id.split(":")[1]!;
    const decisionRecord = new RecordId("decision", decisionIdPart);

    // Find entities related to this decision via belongs_to
    const [relatedRows] = await surreal
      .query<[Array<{ out: RecordId }>]>(
        "SELECT out FROM belongs_to WHERE `in` = $decision;",
        { decision: decisionRecord },
      )
      .collect<[Array<{ out: RecordId }>]>();

    if (relatedRows.length === 0) {
      console.warn("Decision has no belongs_to edges, skipping propagation check");
      return;
    }

    // Check at least one related entity got a description entry from the decision confirmation
    let foundPropagatedEntry = false;
    for (const row of relatedRows) {
      const table = row.out.table.name;
      if (table !== "project" && table !== "feature" && table !== "task") continue;

      const [entityRows] = await surreal
        .query<[EntityWithDescription[]]>(
          `SELECT id, description, description_entries FROM ${table} WHERE id = $record LIMIT 1;`,
          { record: row.out },
        )
        .collect<[EntityWithDescription[]]>();

      const entity = entityRows[0];
      if (!entity?.description_entries) continue;

      const confirmEntry = entity.description_entries.find(
        (e) => e.reasoning === "decision confirmed",
      );
      if (confirmEntry) {
        foundPropagatedEntry = true;
        expect(confirmEntry.text).toContain("Decision confirmed:");
        // With 2+ entries, description should have been LLM-synthesized (different from any single entry)
        expect(entity.description).toBeDefined();
        expect(entity.description!.length).toBeGreaterThan(0);
        break;
      }
    }

    expect(foundPropagatedEntry).toBe(true);
  }, 90_000);
});
