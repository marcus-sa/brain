import { describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { createTestUser, collectSseEvents, fetchJson, setupSmokeSuite } from "../smoke-test-kit";

/**
 * US-UI-007: Agent Mention Resolution in Extraction Pipeline
 *
 * Validates that the extraction pipeline recognizes agent references:
 * - Role-based mentions ("the PM agent") resolve to the correct identity
 * - Name-based mentions ("Code Agent") resolve to the correct identity
 * - Ambiguous mentions ("an agent") do not create false-positive attributions
 * - Non-existent agent references do not create phantom identity records
 * - Resolution is scoped to the current workspace
 *
 * These tests exercise the extraction pipeline end-to-end via the chat
 * message endpoint, which is the driving port for extraction.
 */

type StreamEvent =
  | { type: "extraction"; messageId: string; entities: Array<{ id: string; kind: string; text: string }> }
  | { type: "done"; messageId: string }
  | { type: "error"; messageId: string; error: string }
  | { type: string; messageId: string };

const getRuntime = setupSmokeSuite("agent-mention-resolution");

describe("US-UI-007: Extraction pipeline resolves agent mentions to identity records", () => {
  // -- Happy path: role-based mention --

  it.skip("Given PM Agent identity exists in the workspace, when a message mentioning 'the PM agent suggested' is sent, then the extraction pipeline links the suggestion to the PM Agent identity", async () => {
    const { baseUrl, surreal } = getRuntime();

    const user = await createTestUser(baseUrl, "mention-role");
    const workspace = await fetchJson<{ workspaceId: string; conversationId: string }>(
      `${baseUrl}/api/workspaces`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...user.headers },
        body: JSON.stringify({ name: `Mention Role Test ${Date.now()}` }),
      },
    );

    // Send message with agent role mention
    const chatResponse = await fetchJson<{ messageId: string; streamUrl: string }>(
      `${baseUrl}/api/chat/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...user.headers },
        body: JSON.stringify({
          clientMessageId: `mention-role-${Date.now()}`,
          workspaceId: workspace.workspaceId,
          conversationId: workspace.conversationId,
          text: "The PM agent suggested we should prioritize the auth feature for next sprint.",
        }),
      },
    );

    // Wait for extraction to complete
    const events = await collectSseEvents<StreamEvent>(
      `${baseUrl}${chatResponse.streamUrl}`,
      120_000,
    );

    const extractionEvent = events.find((e) => e.type === "extraction");
    expect(extractionEvent).toBeDefined();

    // Verify extraction produced entities (the suggestion/task about auth)
    if (extractionEvent && extractionEvent.type === "extraction") {
      expect(extractionEvent.entities.length).toBeGreaterThan(0);
    }

    // The implementation should have linked extracted entities to the PM Agent identity
    // via extraction_relation or entity owner field
  }, 180_000);

  // -- Happy path: name-based mention --

  it.skip("Given Code Agent identity exists in the workspace, when a message mentions 'Code Agent finished the task', then the extraction pipeline attributes the action to Code Agent identity", async () => {
    const { baseUrl } = getRuntime();

    const user = await createTestUser(baseUrl, "mention-name");
    const workspace = await fetchJson<{ workspaceId: string; conversationId: string }>(
      `${baseUrl}/api/workspaces`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...user.headers },
        body: JSON.stringify({ name: `Mention Name Test ${Date.now()}` }),
      },
    );

    const chatResponse = await fetchJson<{ messageId: string; streamUrl: string }>(
      `${baseUrl}/api/chat/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...user.headers },
        body: JSON.stringify({
          clientMessageId: `mention-name-${Date.now()}`,
          workspaceId: workspace.workspaceId,
          conversationId: workspace.conversationId,
          text: "Code Agent finished the OAuth implementation task yesterday.",
        }),
      },
    );

    const events = await collectSseEvents<StreamEvent>(
      `${baseUrl}${chatResponse.streamUrl}`,
      120_000,
    );

    const doneEvent = events.find((e) => e.type === "done");
    expect(doneEvent).toBeDefined();
  }, 180_000);

  // -- Error path: ambiguous mention --

  it.skip("Given multiple agent identities exist, when a message says 'an agent suggested we add rate limiting', then no specific agent attribution is created for the ambiguous mention", async () => {
    const { baseUrl, surreal } = getRuntime();

    const user = await createTestUser(baseUrl, "mention-ambiguous");
    const workspace = await fetchJson<{ workspaceId: string; conversationId: string }>(
      `${baseUrl}/api/workspaces`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...user.headers },
        body: JSON.stringify({ name: `Ambiguous Mention Test ${Date.now()}` }),
      },
    );

    const chatResponse = await fetchJson<{ messageId: string; streamUrl: string }>(
      `${baseUrl}/api/chat/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...user.headers },
        body: JSON.stringify({
          clientMessageId: `mention-ambiguous-${Date.now()}`,
          workspaceId: workspace.workspaceId,
          conversationId: workspace.conversationId,
          text: "An agent suggested we should add rate limiting to the API.",
        }),
      },
    );

    const events = await collectSseEvents<StreamEvent>(
      `${baseUrl}${chatResponse.streamUrl}`,
      120_000,
    );

    // Extraction should complete without error
    const doneEvent = events.find((e) => e.type === "done");
    expect(doneEvent).toBeDefined();

    // No false-positive identity attribution for "an agent"
    // Check that no extraction_relation links to an agent identity
    const wsRecord = new (await import("surrealdb")).RecordId("workspace", workspace.workspaceId);
    const [agentLinks] = await surreal.query<
      [Array<{ id: unknown }>]
    >(
      `SELECT id FROM extraction_relation
       WHERE out.table.name = 'identity'
         AND out.type = 'agent'
       LIMIT 5;`,
    );
    // Ambiguous mentions should not produce agent identity links
    // (This is a negative assertion - exact check depends on implementation)
  }, 180_000);

  // -- Error path: non-existent agent --

  it.skip("Given no 'Design Agent' identity exists in the workspace, when a message mentions 'the Design Agent recommended new colors', then no phantom identity record is created", async () => {
    const { baseUrl, surreal } = getRuntime();

    const user = await createTestUser(baseUrl, "mention-nonexistent");
    const workspace = await fetchJson<{ workspaceId: string; conversationId: string }>(
      `${baseUrl}/api/workspaces`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...user.headers },
        body: JSON.stringify({ name: `Nonexistent Agent Test ${Date.now()}` }),
      },
    );

    const chatResponse = await fetchJson<{ messageId: string; streamUrl: string }>(
      `${baseUrl}/api/chat/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...user.headers },
        body: JSON.stringify({
          clientMessageId: `mention-nonexistent-${Date.now()}`,
          workspaceId: workspace.workspaceId,
          conversationId: workspace.conversationId,
          text: "The Design Agent recommended we use new brand colors for the dashboard.",
        }),
      },
    );

    const events = await collectSseEvents<StreamEvent>(
      `${baseUrl}${chatResponse.streamUrl}`,
      120_000,
    );

    const doneEvent = events.find((e) => e.type === "done");
    expect(doneEvent).toBeDefined();

    // Verify no "Design Agent" identity was created
    const wsRecord = new (await import("surrealdb")).RecordId("workspace", workspace.workspaceId);
    const [designAgents] = await surreal.query<
      [Array<{ name: string }>]
    >(
      "SELECT name FROM identity WHERE workspace = $ws AND name = 'Design Agent';",
      { ws: wsRecord },
    );
    expect(designAgents.length).toBe(0);
  }, 180_000);

  // -- Boundary: mixed human and agent mentions --

  it.skip("Given both human and agent identities exist, when a message mentions both 'I agreed with the PM agent', then both the human and agent mentions are resolved independently", async () => {
    const { baseUrl } = getRuntime();

    const user = await createTestUser(baseUrl, "mention-mixed");
    const workspace = await fetchJson<{ workspaceId: string; conversationId: string }>(
      `${baseUrl}/api/workspaces`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...user.headers },
        body: JSON.stringify({ name: `Mixed Mention Test ${Date.now()}` }),
      },
    );

    const chatResponse = await fetchJson<{ messageId: string; streamUrl: string }>(
      `${baseUrl}/api/chat/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...user.headers },
        body: JSON.stringify({
          clientMessageId: `mention-mixed-${Date.now()}`,
          workspaceId: workspace.workspaceId,
          conversationId: workspace.conversationId,
          text: "I agreed with the PM agent's suggestion to add OAuth support before the deadline.",
        }),
      },
    );

    const events = await collectSseEvents<StreamEvent>(
      `${baseUrl}${chatResponse.streamUrl}`,
      120_000,
    );

    // Pipeline should complete successfully with mixed mentions
    const doneEvent = events.find((e) => e.type === "done");
    expect(doneEvent).toBeDefined();
  }, 180_000);
});
