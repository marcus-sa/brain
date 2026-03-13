/**
 * Walking Skeleton: Learning Library E2E
 *
 * Traces: US-LL-01 (browse & filter), US-LL-03 (edit/deactivate), US-LL-04 (create with targeting)
 *
 * Minimal viable path through the learning library feature:
 *   Create workspace -> seed learnings with varied types/statuses/agents ->
 *   list all -> filter by status -> filter by agent -> edit active learning ->
 *   deactivate -> verify count decremented
 *
 * This skeleton proves a user can manage their learning library end-to-end:
 * browsing, filtering, editing, and retiring learnings.
 *
 * Driving ports:
 *   POST   /api/workspaces/:workspaceId/learnings                     (create)
 *   GET    /api/workspaces/:workspaceId/learnings                     (list + filter)
 *   PUT    /api/workspaces/:workspaceId/learnings/:learningId         (edit -- NEW)
 *   POST   /api/workspaces/:workspaceId/learnings/:learningId/actions (deactivate)
 *   SurrealDB direct queries                                         (verification)
 */
import { describe, expect, it } from "bun:test";
import {
  setupLearningSuite,
  createTestWorkspace,
  createTestLearning,
  createLearningViaHttp,
  listLearningsViaHttp,
  performLearningAction,
  getLearningById,
} from "../agent-learnings/learning-test-kit";
import { createTestUser, fetchRaw } from "../acceptance-test-kit";

const getRuntime = setupLearningSuite("learning_library_skeleton");

describe("Walking Skeleton: User manages learning library end-to-end", () => {
  it("user creates, browses, filters, edits, and deactivates learnings", async () => {
    const { baseUrl, surreal } = getRuntime();

    // Given: an authenticated user with a workspace
    const user = await createTestUser(baseUrl, `skeleton-${crypto.randomUUID()}`);
    const { workspaceId } = await createTestWorkspace(surreal, "skeleton");

    // Given: the user creates three learnings with different types, agents, and statuses

    // Learning 1: active constraint for MCP agents
    const createRes1 = await createLearningViaHttp(baseUrl, user, workspaceId, {
      text: "Never use null for domain data values.",
      learning_type: "constraint",
      priority: "high",
      target_agents: ["mcp"],
    });
    expect(createRes1.status).toBe(201);
    const { learningId: learningId1 } = (await createRes1.json()) as { learningId: string };

    // Learning 2: active instruction for all agents (empty target_agents)
    const createRes2 = await createLearningViaHttp(baseUrl, user, workspaceId, {
      text: "Use structured logging with severity levels.",
      learning_type: "instruction",
      priority: "medium",
      target_agents: [],
    });
    expect(createRes2.status).toBe(201);
    const { learningId: learningId2 } = (await createRes2.json()) as { learningId: string };

    // Learning 3: pending precedent from agent (seeded directly for status control)
    await createTestLearning(surreal, workspaceId, {
      text: "Batch database writes for performance.",
      learning_type: "precedent",
      status: "pending_approval",
      source: "agent",
      suggested_by: "observer_agent",
      target_agents: ["pm_agent"],
    });

    // When: user lists all learnings (no filters)
    const allRes = await listLearningsViaHttp(baseUrl, user, workspaceId);
    expect(allRes.status).toBe(200);
    const allBody = (await allRes.json()) as { learnings: Array<{ status: string }> };

    // Then: all three learnings are visible
    expect(allBody.learnings.length).toBe(3);

    // When: user filters by status "active"
    const activeRes = await listLearningsViaHttp(baseUrl, user, workspaceId, { status: "active" });
    expect(activeRes.status).toBe(200);
    const activeBody = (await activeRes.json()) as { learnings: Array<{ status: string }> };

    // Then: only the two active learnings appear
    expect(activeBody.learnings.length).toBe(2);
    expect(activeBody.learnings.every((l) => l.status === "active")).toBe(true);

    // When: user filters by agent "mcp"
    const agentRes = await listLearningsViaHttp(baseUrl, user, workspaceId, { agent: "mcp" });
    expect(agentRes.status).toBe(200);
    const agentBody = (await agentRes.json()) as { learnings: Array<{ text: string }> };

    // Then: learnings targeted to mcp OR all agents appear
    // Learning 1 (mcp) and Learning 2 (all agents) should match
    const agentTexts = agentBody.learnings.map((l) => l.text);
    expect(agentTexts).toContain("Never use null for domain data values.");
    expect(agentTexts).toContain("Use structured logging with severity levels.");

    // When: user edits the text of active learning 1
    const editRes = await fetchRaw(
      `${baseUrl}/api/workspaces/${workspaceId}/learnings/${learningId1}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...user.headers },
        body: JSON.stringify({
          text: "Never use null for domain data values. Use undefined via optional properties instead.",
        }),
      },
    );
    expect(editRes.status).toBe(200);

    // Then: the learning text is updated
    const edited = await getLearningById(surreal, learningId1);
    expect(edited!.text).toBe(
      "Never use null for domain data values. Use undefined via optional properties instead.",
    );

    // When: user deactivates learning 2
    const deactivateRes = await performLearningAction(
      baseUrl,
      user,
      workspaceId,
      learningId2,
      { action: "deactivate" },
    );

    // Then: the deactivation succeeds
    expect(deactivateRes.status).toBe(200);

    // And: the learning is now deactivated
    const deactivated = await getLearningById(surreal, learningId2);
    expect(deactivated!.status).toBe("deactivated");

    // And: listing active learnings shows one fewer
    const afterRes = await listLearningsViaHttp(baseUrl, user, workspaceId, { status: "active" });
    expect(afterRes.status).toBe(200);
    const afterBody = (await afterRes.json()) as { learnings: Array<{ status: string }> };
    expect(afterBody.learnings.length).toBe(1);
  }, 120_000);
});
