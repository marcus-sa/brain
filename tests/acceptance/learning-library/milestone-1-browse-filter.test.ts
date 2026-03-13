/**
 * Milestone 1: Browse and Filter Learnings
 *
 * Traces: US-LL-01 (browse & filter learning library)
 *
 * Validates filter combinations, status counts, and empty result handling
 * that go beyond the single-filter tests in agent-learnings/milestone-4.
 *
 * What is NOT tested here (already covered in agent-learnings/milestone-4):
 *   - Single status filter
 *   - Single type filter
 *   - Basic list endpoint shape
 *
 * What IS tested here:
 *   - Multiple simultaneous filter parameters (status + type + agent)
 *   - Agent filter with empty target_agents (visible to all)
 *   - Agent filter with specific target_agents
 *   - Empty results with valid but non-matching filters
 *   - Status counts across filter combinations
 *   - Filter by agent across statuses
 *
 * Driving ports:
 *   GET  /api/workspaces/:workspaceId/learnings  (list + filters)
 *   SurrealDB direct queries                     (seed data)
 */
import { describe, expect, it } from "bun:test";
import {
  setupLearningSuite,
  createTestWorkspace,
  createTestLearning,
  listLearningsViaHttp,
} from "../agent-learnings/learning-test-kit";
import { createTestUser } from "../acceptance-test-kit";

const getRuntime = setupLearningSuite("learning_library_m1_browse");

describe("Milestone 1: Browse and Filter", () => {
  // ---------------------------------------------------------------------------
  // Filter combination: status + type
  // ---------------------------------------------------------------------------

  it("filtering by status and type simultaneously returns only matching learnings", async () => {
    const { baseUrl, surreal } = getRuntime();
    const user = await createTestUser(baseUrl, `filter-combo-${crypto.randomUUID()}`);
    const { workspaceId } = await createTestWorkspace(surreal, "filter-combo");

    // Given: a workspace with learnings of varied statuses and types
    await createTestLearning(surreal, workspaceId, {
      text: "Active constraint A.",
      learning_type: "constraint",
      status: "active",
    });
    await createTestLearning(surreal, workspaceId, {
      text: "Active instruction B.",
      learning_type: "instruction",
      status: "active",
    });
    await createTestLearning(surreal, workspaceId, {
      text: "Pending constraint C.",
      learning_type: "constraint",
      status: "pending_approval",
      source: "agent",
    });
    await createTestLearning(surreal, workspaceId, {
      text: "Deactivated instruction D.",
      learning_type: "instruction",
      status: "deactivated",
    });

    // When: user filters by status=active AND type=constraint
    const response = await listLearningsViaHttp(baseUrl, user, workspaceId, {
      status: "active",
      type: "constraint",
    });

    // Then: only the active constraint learning is returned
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      learnings: Array<{ text: string; status: string; learning_type: string }>;
    };
    expect(body.learnings.length).toBe(1);
    expect(body.learnings[0].text).toBe("Active constraint A.");
    expect(body.learnings[0].status).toBe("active");
    expect(body.learnings[0].learning_type).toBe("constraint");
  }, 120_000);

  // ---------------------------------------------------------------------------
  // Filter combination: status + agent
  // ---------------------------------------------------------------------------

  it("filtering by status and agent returns learnings targeted to that agent or all agents", async () => {
    const { baseUrl, surreal } = getRuntime();
    const user = await createTestUser(baseUrl, `filter-status-agent-${crypto.randomUUID()}`);
    const { workspaceId } = await createTestWorkspace(surreal, "filter-status-agent");

    // Given: learnings with different agent targets
    await createTestLearning(surreal, workspaceId, {
      text: "For coding agents only.",
      learning_type: "instruction",
      status: "active",
      target_agents: ["coding_agent"],
    });
    await createTestLearning(surreal, workspaceId, {
      text: "For all agents.",
      learning_type: "instruction",
      status: "active",
      target_agents: [],
    });
    await createTestLearning(surreal, workspaceId, {
      text: "For PM agent only.",
      learning_type: "constraint",
      status: "active",
      target_agents: ["pm_agent"],
    });
    await createTestLearning(surreal, workspaceId, {
      text: "Pending for coding agent.",
      learning_type: "instruction",
      status: "pending_approval",
      source: "agent",
      target_agents: ["coding_agent"],
    });

    // When: user filters by status=active AND agent=coding_agent
    const response = await listLearningsViaHttp(baseUrl, user, workspaceId, {
      status: "active",
      agent: "coding_agent",
    });

    // Then: the coding-agent-targeted and all-agents learnings appear, but not PM-only or pending
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      learnings: Array<{ text: string }>;
    };
    const texts = body.learnings.map((l) => l.text);
    expect(texts).toContain("For coding agents only.");
    expect(texts).toContain("For all agents.");
    expect(texts).not.toContain("For PM agent only.");
    expect(texts).not.toContain("Pending for coding agent.");
  }, 120_000);

  // ---------------------------------------------------------------------------
  // Triple filter: status + type + agent
  // ---------------------------------------------------------------------------

  it("filtering by status, type, and agent simultaneously narrows results correctly", async () => {
    const { baseUrl, surreal } = getRuntime();
    const user = await createTestUser(baseUrl, `triple-filter-${crypto.randomUUID()}`);
    const { workspaceId } = await createTestWorkspace(surreal, "triple-filter");

    // Given: a varied set of learnings
    await createTestLearning(surreal, workspaceId, {
      text: "Active constraint for coding.",
      learning_type: "constraint",
      status: "active",
      target_agents: ["coding_agent"],
    });
    await createTestLearning(surreal, workspaceId, {
      text: "Active instruction for coding.",
      learning_type: "instruction",
      status: "active",
      target_agents: ["coding_agent"],
    });
    await createTestLearning(surreal, workspaceId, {
      text: "Active constraint for PM.",
      learning_type: "constraint",
      status: "active",
      target_agents: ["pm_agent"],
    });
    await createTestLearning(surreal, workspaceId, {
      text: "Active constraint for all.",
      learning_type: "constraint",
      status: "active",
      target_agents: [],
    });

    // When: user filters by status=active, type=constraint, agent=coding_agent
    const response = await listLearningsViaHttp(baseUrl, user, workspaceId, {
      status: "active",
      type: "constraint",
      agent: "coding_agent",
    });

    // Then: only constraints visible to coding_agent (targeted + all-agents) appear
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      learnings: Array<{ text: string }>;
    };
    const texts = body.learnings.map((l) => l.text);
    expect(texts).toContain("Active constraint for coding.");
    expect(texts).toContain("Active constraint for all.");
    expect(texts).not.toContain("Active instruction for coding.");
    expect(texts).not.toContain("Active constraint for PM.");
  }, 120_000);

  // ---------------------------------------------------------------------------
  // Empty results with valid filters
  // ---------------------------------------------------------------------------

  it("valid filter that matches no learnings returns an empty list", async () => {
    const { baseUrl, surreal } = getRuntime();
    const user = await createTestUser(baseUrl, `empty-filter-${crypto.randomUUID()}`);
    const { workspaceId } = await createTestWorkspace(surreal, "empty-filter");

    // Given: a workspace with only active instructions
    await createTestLearning(surreal, workspaceId, {
      text: "Some instruction.",
      learning_type: "instruction",
      status: "active",
    });

    // When: user filters by type=precedent (none exist)
    const response = await listLearningsViaHttp(baseUrl, user, workspaceId, {
      type: "precedent",
    });

    // Then: an empty learnings list is returned (not an error)
    expect(response.status).toBe(200);
    const body = (await response.json()) as { learnings: Array<unknown> };
    expect(body.learnings).toEqual([]);
  }, 120_000);

  it("filtering by a non-matching agent returns an empty list", async () => {
    const { baseUrl, surreal } = getRuntime();
    const user = await createTestUser(baseUrl, `empty-agent-${crypto.randomUUID()}`);
    const { workspaceId } = await createTestWorkspace(surreal, "empty-agent");

    // Given: a workspace with learnings targeted only to coding_agent
    await createTestLearning(surreal, workspaceId, {
      text: "Only for coders.",
      learning_type: "instruction",
      status: "active",
      target_agents: ["coding_agent"],
    });

    // When: user filters by agent=observer_agent
    const response = await listLearningsViaHttp(baseUrl, user, workspaceId, {
      agent: "observer_agent",
    });

    // Then: no learnings match (the learning is not targeted to observer_agent)
    expect(response.status).toBe(200);
    const body = (await response.json()) as { learnings: Array<unknown> };
    expect(body.learnings).toEqual([]);
  }, 120_000);

  // ---------------------------------------------------------------------------
  // Status tab counts
  // ---------------------------------------------------------------------------

  it("separate status queries give correct counts for each tab", async () => {
    const { baseUrl, surreal } = getRuntime();
    const user = await createTestUser(baseUrl, `status-counts-${crypto.randomUUID()}`);
    const { workspaceId } = await createTestWorkspace(surreal, "status-counts");

    // Given: a workspace with known distribution of statuses
    await createTestLearning(surreal, workspaceId, {
      text: "Active one.", learning_type: "instruction", status: "active",
    });
    await createTestLearning(surreal, workspaceId, {
      text: "Active two.", learning_type: "constraint", status: "active",
    });
    await createTestLearning(surreal, workspaceId, {
      text: "Active three.", learning_type: "precedent", status: "active",
    });
    await createTestLearning(surreal, workspaceId, {
      text: "Pending one.", learning_type: "instruction", status: "pending_approval", source: "agent",
    });
    await createTestLearning(surreal, workspaceId, {
      text: "Dismissed one.", learning_type: "instruction", status: "dismissed",
    });
    await createTestLearning(surreal, workspaceId, {
      text: "Deactivated one.", learning_type: "instruction", status: "deactivated",
    });

    // When: user queries each status tab
    const [activeRes, pendingRes, dismissedRes, deactivatedRes] = await Promise.all([
      listLearningsViaHttp(baseUrl, user, workspaceId, { status: "active" }),
      listLearningsViaHttp(baseUrl, user, workspaceId, { status: "pending_approval" }),
      listLearningsViaHttp(baseUrl, user, workspaceId, { status: "dismissed" }),
      listLearningsViaHttp(baseUrl, user, workspaceId, { status: "deactivated" }),
    ]);

    // Then: each status tab shows the correct count
    const activeBody = (await activeRes.json()) as { learnings: Array<unknown> };
    const pendingBody = (await pendingRes.json()) as { learnings: Array<unknown> };
    const dismissedBody = (await dismissedRes.json()) as { learnings: Array<unknown> };
    const deactivatedBody = (await deactivatedRes.json()) as { learnings: Array<unknown> };

    expect(activeBody.learnings.length).toBe(3);
    expect(pendingBody.learnings.length).toBe(1);
    expect(dismissedBody.learnings.length).toBe(1);
    expect(deactivatedBody.learnings.length).toBe(1);
  }, 120_000);

  // ---------------------------------------------------------------------------
  // Agent visibility: empty target_agents means visible to all
  // ---------------------------------------------------------------------------

  it("learning with empty target agents appears for any agent filter", async () => {
    const { baseUrl, surreal } = getRuntime();
    const user = await createTestUser(baseUrl, `all-agents-${crypto.randomUUID()}`);
    const { workspaceId } = await createTestWorkspace(surreal, "all-agents");

    // Given: a learning with empty target_agents (visible to all)
    await createTestLearning(surreal, workspaceId, {
      text: "Universal rule for everyone.",
      learning_type: "constraint",
      status: "active",
      target_agents: [],
    });

    // When: user filters by different agent types
    const [codingRes, pmRes, chatRes] = await Promise.all([
      listLearningsViaHttp(baseUrl, user, workspaceId, { agent: "coding_agent" }),
      listLearningsViaHttp(baseUrl, user, workspaceId, { agent: "pm_agent" }),
      listLearningsViaHttp(baseUrl, user, workspaceId, { agent: "chat_agent" }),
    ]);

    // Then: the universal learning appears for every agent filter
    for (const res of [codingRes, pmRes, chatRes]) {
      expect(res.status).toBe(200);
      const body = (await res.json()) as { learnings: Array<{ text: string }> };
      expect(body.learnings.length).toBe(1);
      expect(body.learnings[0].text).toBe("Universal rule for everyone.");
    }
  }, 120_000);

  // ---------------------------------------------------------------------------
  // Error path: empty workspace has no learnings
  // ---------------------------------------------------------------------------

  it("listing learnings for a workspace with no learnings returns an empty list", async () => {
    const { baseUrl, surreal } = getRuntime();
    const user = await createTestUser(baseUrl, `empty-ws-${crypto.randomUUID()}`);
    const { workspaceId } = await createTestWorkspace(surreal, "empty-ws");

    // When: user lists learnings in a workspace with none
    const response = await listLearningsViaHttp(baseUrl, user, workspaceId);

    // Then: an empty list is returned, not an error
    expect(response.status).toBe(200);
    const body = (await response.json()) as { learnings: Array<unknown> };
    expect(body.learnings).toEqual([]);
  }, 120_000);
});
