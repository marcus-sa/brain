import { describe, expect, it } from "bun:test";
import { RecordId } from "surrealdb";
import { buildChatContext, buildSystemPrompt } from "../../app/src/server/chat/context";

describe("chat context", () => {
  it("returns an empty-safe context shape", async () => {
    const context = await buildChatContext({
      surreal: {} as any,
      conversationRecord: new RecordId("conversation", "c-empty"),
      workspaceRecord: new RecordId("workspace", "w-empty"),
      loaders: {
        listConversationEntities: async () => [],
        listWorkspaceProjectSummaries: async () => [],
        listWorkspaceRecentDecisions: async () => [],
        listWorkspaceOpenQuestions: async () => [],
      },
    });

    expect(context).toEqual({
      conversationEntities: [],
      workspaceSummary: {
        projects: [],
        recentDecisions: [],
        openQuestions: [],
      },
    });

    const systemPrompt = buildSystemPrompt(context);
    expect(systemPrompt.includes("- none")).toBe(true);
  });

  it("returns populated conversation entities and workspace summaries", async () => {
    const context = await buildChatContext({
      surreal: {} as any,
      conversationRecord: new RecordId("conversation", "c-populated"),
      workspaceRecord: new RecordId("workspace", "w-populated"),
      loaders: {
        listConversationEntities: async () => [
          {
            id: "d-1",
            kind: "decision",
            name: "Use token bucket for rate limiting",
            confidence: 0.94,
            sourceMessageId: "m-1",
          },
        ],
        listWorkspaceProjectSummaries: async () => [
          {
            id: "p-1",
            name: "Brain",
            activeTaskCount: 7,
          },
        ],
        listWorkspaceRecentDecisions: async () => [
          {
            id: "d-1",
            name: "Use token bucket for rate limiting",
            status: "provisional",
            project: "Brain",
          },
        ],
        listWorkspaceOpenQuestions: async () => [
          {
            id: "q-1",
            name: "How should retries be tuned?",
            project: "Brain",
          },
        ],
      },
    });

    expect(context.conversationEntities).toHaveLength(1);
    expect(context.workspaceSummary.projects[0]?.activeTaskCount).toBe(7);
    expect(context.workspaceSummary.recentDecisions[0]?.status).toBe("provisional");
    expect(context.workspaceSummary.openQuestions[0]?.name).toContain("retries");

    const systemPrompt = buildSystemPrompt(context);
    expect(systemPrompt.includes("Use token bucket for rate limiting")).toBe(true);
    expect(systemPrompt.includes("Projects:")).toBe(true);
  });
});
