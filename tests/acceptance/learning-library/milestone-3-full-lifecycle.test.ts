/**
 * Milestone 3: Full Learning Lifecycle
 *
 * Traces: US-LL-03 (edit/deactivate), US-LL-04 (create with targeting)
 *
 * End-to-end lifecycle tests that combine creation with agent targeting,
 * editing, and deactivation into complete user journeys.
 *
 * What is NOT tested here (already covered elsewhere):
 *   - Basic create/approve/dismiss (agent-learnings/milestone-4)
 *   - Basic deactivate (agent-learnings/milestone-4)
 *   - Single filter operations (agent-learnings/milestone-4)
 *
 * What IS tested here:
 *   - Create with specific target_agents -> verify agent filter visibility
 *   - Create with empty target_agents -> verify universal visibility
 *   - Full lifecycle: create -> edit -> deactivate -> verify invisible
 *   - Deactivated learnings no longer appear in agent-filtered views
 *   - Multiple learnings lifecycle in same workspace
 *
 * Driving ports:
 *   POST   /api/workspaces/:workspaceId/learnings                     (create)
 *   PUT    /api/workspaces/:workspaceId/learnings/:learningId         (edit -- NEW)
 *   POST   /api/workspaces/:workspaceId/learnings/:learningId/actions (deactivate)
 *   GET    /api/workspaces/:workspaceId/learnings                     (list + verify)
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

const getRuntime = setupLearningSuite("learning_library_m3_lifecycle");

describe("Milestone 3: Full Learning Lifecycle", () => {
  // ---------------------------------------------------------------------------
  // US-LL-04: Create with agent targeting -> filter visibility
  // ---------------------------------------------------------------------------

  it("learning created for specific agents appears only in their filtered views", async () => {
    const { baseUrl, surreal } = getRuntime();
    const user = await createTestUser(baseUrl, `target-create-${crypto.randomUUID()}`);
    const { workspaceId } = await createTestWorkspace(surreal, "target-create");

    // When: user creates a learning targeted to coding_agent and mcp
    const response = await createLearningViaHttp(baseUrl, user, workspaceId, {
      text: "Use feature branches for all development work.",
      learning_type: "instruction",
      priority: "medium",
      target_agents: ["coding_agent", "mcp"],
    });
    expect(response.status).toBe(201);

    // Then: the learning appears when filtering by coding_agent
    const codingRes = await listLearningsViaHttp(baseUrl, user, workspaceId, {
      agent: "coding_agent",
    });
    const codingBody = (await codingRes.json()) as { learnings: Array<{ text: string }> };
    expect(codingBody.learnings.some(
      (l) => l.text === "Use feature branches for all development work.",
    )).toBe(true);

    // And: the learning appears when filtering by mcp
    const mcpRes = await listLearningsViaHttp(baseUrl, user, workspaceId, {
      agent: "mcp",
    });
    const mcpBody = (await mcpRes.json()) as { learnings: Array<{ text: string }> };
    expect(mcpBody.learnings.some(
      (l) => l.text === "Use feature branches for all development work.",
    )).toBe(true);

    // And: the learning does NOT appear when filtering by chat_agent
    const chatRes = await listLearningsViaHttp(baseUrl, user, workspaceId, {
      agent: "chat_agent",
    });
    const chatBody = (await chatRes.json()) as { learnings: Array<{ text: string }> };
    expect(chatBody.learnings.some(
      (l) => l.text === "Use feature branches for all development work.",
    )).toBe(false);
  }, 120_000);

  it("learning created with empty target agents appears for every agent filter", async () => {
    const { baseUrl, surreal } = getRuntime();
    const user = await createTestUser(baseUrl, `universal-create-${crypto.randomUUID()}`);
    const { workspaceId } = await createTestWorkspace(surreal, "universal-create");

    // When: user creates a learning with no agent targeting
    const response = await createLearningViaHttp(baseUrl, user, workspaceId, {
      text: "Always include task IDs in commit messages.",
      learning_type: "instruction",
      priority: "high",
      target_agents: [],
    });
    expect(response.status).toBe(201);

    // Then: the learning appears for all agent filters
    const agents = ["coding_agent", "mcp", "chat_agent", "pm_agent", "observer_agent"];
    for (const agent of agents) {
      const res = await listLearningsViaHttp(baseUrl, user, workspaceId, { agent });
      const body = (await res.json()) as { learnings: Array<{ text: string }> };
      expect(
        body.learnings.some((l) => l.text === "Always include task IDs in commit messages."),
      ).toBe(true);
    }
  }, 120_000);

  // ---------------------------------------------------------------------------
  // Full lifecycle: create -> deactivate -> verify removal from active views
  // ---------------------------------------------------------------------------

  it("deactivated learning disappears from active filtered views", async () => {
    const { baseUrl, surreal } = getRuntime();
    const user = await createTestUser(baseUrl, `lifecycle-deact-${crypto.randomUUID()}`);
    const { workspaceId } = await createTestWorkspace(surreal, "lifecycle-deact");

    // Given: user creates an active learning for coding agents
    const createRes = await createLearningViaHttp(baseUrl, user, workspaceId, {
      text: "Run linter before every commit.",
      learning_type: "instruction",
      priority: "medium",
      target_agents: ["coding_agent"],
    });
    const { learningId } = (await createRes.json()) as { learningId: string };

    // And: the learning is visible in the active + coding_agent view
    const beforeRes = await listLearningsViaHttp(baseUrl, user, workspaceId, {
      status: "active",
      agent: "coding_agent",
    });
    const beforeBody = (await beforeRes.json()) as { learnings: Array<{ text: string }> };
    expect(beforeBody.learnings.some((l) => l.text === "Run linter before every commit.")).toBe(true);

    // When: user deactivates the learning
    const deactRes = await performLearningAction(
      baseUrl, user, workspaceId, learningId,
      { action: "deactivate" },
    );
    expect(deactRes.status).toBe(200);

    // Then: the learning no longer appears in active views
    const afterRes = await listLearningsViaHttp(baseUrl, user, workspaceId, {
      status: "active",
      agent: "coding_agent",
    });
    const afterBody = (await afterRes.json()) as { learnings: Array<{ text: string }> };
    expect(afterBody.learnings.some((l) => l.text === "Run linter before every commit.")).toBe(false);

    // And: the learning still appears in the deactivated tab
    const deactListRes = await listLearningsViaHttp(baseUrl, user, workspaceId, {
      status: "deactivated",
    });
    const deactBody = (await deactListRes.json()) as { learnings: Array<{ text: string }> };
    expect(deactBody.learnings.some((l) => l.text === "Run linter before every commit.")).toBe(true);
  }, 120_000);

  // ---------------------------------------------------------------------------
  // Full lifecycle: create -> edit -> deactivate (requires PUT endpoint)
  // ---------------------------------------------------------------------------

  it("full lifecycle: create learning, refine via edit, then retire via deactivation", async () => {
    const { baseUrl, surreal } = getRuntime();
    const user = await createTestUser(baseUrl, `full-lifecycle-${crypto.randomUUID()}`);
    const { workspaceId } = await createTestWorkspace(surreal, "full-lifecycle");

    // Step 1: user creates a learning
    const createRes = await createLearningViaHttp(baseUrl, user, workspaceId, {
      text: "Use spaces for indentation.",
      learning_type: "instruction",
      priority: "medium",
      target_agents: [],
    });
    expect(createRes.status).toBe(201);
    const { learningId } = (await createRes.json()) as { learningId: string };

    // Step 2: user refines the text via edit
    const editRes = await fetchRaw(
      `${baseUrl}/api/workspaces/${workspaceId}/learnings/${learningId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...user.headers },
        body: JSON.stringify({
          text: "Use 2-space indentation for TypeScript, 4-space for Python.",
          priority: "high",
          target_agents: ["coding_agent", "mcp"],
        }),
      },
    );
    expect(editRes.status).toBe(200);

    // Verify edit took effect
    const edited = await getLearningById(surreal, learningId);
    expect(edited!.text).toBe("Use 2-space indentation for TypeScript, 4-space for Python.");
    expect(edited!.priority).toBe("high");
    expect(edited!.target_agents).toEqual(["coding_agent", "mcp"]);

    // Step 3: user retires the learning
    const deactRes = await performLearningAction(
      baseUrl, user, workspaceId, learningId,
      { action: "deactivate" },
    );
    expect(deactRes.status).toBe(200);

    // Verify the learning is retired
    const retired = await getLearningById(surreal, learningId);
    expect(retired!.status).toBe("deactivated");
    expect(retired!.deactivated_at).toBeTruthy();

    // And: it no longer appears in active views
    const activeRes = await listLearningsViaHttp(baseUrl, user, workspaceId, { status: "active" });
    const activeBody = (await activeRes.json()) as { learnings: Array<{ text: string }> };
    expect(activeBody.learnings.some((l) => l.text.includes("indentation"))).toBe(false);
  }, 120_000);

  // ---------------------------------------------------------------------------
  // Multiple learnings lifecycle in same workspace
  // ---------------------------------------------------------------------------

  it("managing multiple learnings independently in the same workspace", async () => {
    const { baseUrl, surreal } = getRuntime();
    const user = await createTestUser(baseUrl, `multi-lifecycle-${crypto.randomUUID()}`);
    const { workspaceId } = await createTestWorkspace(surreal, "multi-lifecycle");

    // Given: user creates three learnings
    const res1 = await createLearningViaHttp(baseUrl, user, workspaceId, {
      text: "Learning Alpha.", learning_type: "constraint", priority: "high", target_agents: [],
    });
    const res2 = await createLearningViaHttp(baseUrl, user, workspaceId, {
      text: "Learning Beta.", learning_type: "instruction", priority: "medium", target_agents: ["coding_agent"],
    });
    const res3 = await createLearningViaHttp(baseUrl, user, workspaceId, {
      text: "Learning Gamma.", learning_type: "precedent", priority: "low", target_agents: ["pm_agent"],
    });
    const id1 = ((await res1.json()) as { learningId: string }).learningId;
    const id2 = ((await res2.json()) as { learningId: string }).learningId;
    const id3 = ((await res3.json()) as { learningId: string }).learningId;

    // When: user deactivates Learning Beta
    await performLearningAction(baseUrl, user, workspaceId, id2, { action: "deactivate" });

    // Then: only Alpha and Gamma remain active
    const activeRes = await listLearningsViaHttp(baseUrl, user, workspaceId, { status: "active" });
    const activeBody = (await activeRes.json()) as { learnings: Array<{ text: string }> };
    expect(activeBody.learnings.length).toBe(2);
    const activeTexts = activeBody.learnings.map((l) => l.text);
    expect(activeTexts).toContain("Learning Alpha.");
    expect(activeTexts).toContain("Learning Gamma.");
    expect(activeTexts).not.toContain("Learning Beta.");

    // And: deactivated tab shows exactly one
    const deactRes = await listLearningsViaHttp(baseUrl, user, workspaceId, { status: "deactivated" });
    const deactBody = (await deactRes.json()) as { learnings: Array<{ text: string }> };
    expect(deactBody.learnings.length).toBe(1);
    expect(deactBody.learnings[0].text).toBe("Learning Beta.");
  }, 120_000);

  // ---------------------------------------------------------------------------
  // Error path: deactivating an already-deactivated learning is rejected
  // ---------------------------------------------------------------------------

  it("deactivating an already-deactivated learning is rejected", async () => {
    const { baseUrl, surreal } = getRuntime();
    const user = await createTestUser(baseUrl, `double-deact-${crypto.randomUUID()}`);
    const { workspaceId } = await createTestWorkspace(surreal, "double-deact");

    // Given: a deactivated learning
    const { learningId } = await createTestLearning(surreal, workspaceId, {
      text: "Already retired.", learning_type: "instruction", status: "deactivated",
    });

    // When: user attempts to deactivate again
    const response = await performLearningAction(
      baseUrl, user, workspaceId, learningId,
      { action: "deactivate" },
    );

    // Then: the action is rejected (invalid state transition)
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
  }, 120_000);

  // ---------------------------------------------------------------------------
  // Error path: deactivating a dismissed learning is rejected
  // ---------------------------------------------------------------------------

  it("deactivating a dismissed learning is rejected", async () => {
    const { baseUrl, surreal } = getRuntime();
    const user = await createTestUser(baseUrl, `deact-dismissed-${crypto.randomUUID()}`);
    const { workspaceId } = await createTestWorkspace(surreal, "deact-dismissed");

    // Given: a dismissed learning
    const { learningId } = await createTestLearning(surreal, workspaceId, {
      text: "Was dismissed.", learning_type: "instruction", status: "dismissed",
    });

    // When: user attempts to deactivate it
    const response = await performLearningAction(
      baseUrl, user, workspaceId, learningId,
      { action: "deactivate" },
    );

    // Then: the action is rejected (dismiss and deactivate are different terminal states)
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
  }, 120_000);
});
