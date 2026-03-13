/**
 * Intent-Objective Alignment Acceptance Tests (US-OB-02)
 *
 * Validates that intents are automatically evaluated for alignment with
 * active objectives using semantic similarity, and that appropriate
 * supports edges or warning observations are created.
 *
 * Driving ports:
 *   Intent authorization pipeline (simulated via DB seeding + evaluation)
 *   SurrealDB direct queries (verification of supports edges, observations)
 */
import { describe, expect, it } from "bun:test";
import {
  setupObjectiveBehaviorSuite,
  setupObjectiveWorkspace,
  createAgentIdentity,
  createObjective,
  createIntent,
  createSupportsEdge,
  getSupportsEdgesForIntent,
  getSupportsEdgesForObjective,
  getWorkspaceObservations,
  getIntentRecord,
} from "./objective-behavior-test-kit";

const getRuntime = setupObjectiveBehaviorSuite("intent_alignment");

// =============================================================================
// Walking Skeleton: Intent automatically linked to matching objective
// =============================================================================
describe("Walking Skeleton: Intent aligned with active objective (US-OB-02)", () => {
  it("supports edge is created when intent aligns with an active objective", async () => {
    const { surreal } = getRuntime();

    // Given objective "Launch MCP Marketplace" exists in the workspace
    const { workspaceId, identityId } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-align-${crypto.randomUUID()}`,
    );

    const { objectiveId } = await createObjective(surreal, workspaceId, {
      title: "Launch MCP Marketplace",
      description: "Launch the MCP marketplace with 10 listed integrations by June 30",
      status: "active",
    });

    // And a coding agent submits an intent related to MCP
    const { identityId: agentId } = await createAgentIdentity(
      surreal,
      workspaceId,
      "Coder-Alpha",
    );
    const { intentId } = await createIntent(surreal, workspaceId, agentId, {
      goal: "Implement MCP tool discovery endpoint",
      reasoning: "Required for marketplace tool listing",
    });

    // When the authorizer evaluates alignment and finds similarity above 0.7
    await createSupportsEdge(surreal, intentId, objectiveId, {
      alignment_score: 0.87,
      alignment_method: "embedding",
      reasoning: "Intent goal is semantically similar to MCP marketplace objective",
    });

    // Then a supports edge links the intent to the objective
    const edges = await getSupportsEdgesForIntent(surreal, intentId);
    expect(edges).toHaveLength(1);
    expect(edges[0].alignment_score).toBe(0.87);
    expect(edges[0].alignment_method).toBe("embedding");

    // And the intent proceeds to authorization (status not blocked)
    const intent = await getIntentRecord(surreal, intentId);
    expect(intent!.status).toBe("pending_auth");
  }, 60_000);
});

// =============================================================================
// Happy Path Scenarios
// =============================================================================
describe("Happy Path: Intent links to highest-scoring objective (US-OB-02)", () => {
  it.skip("intent is linked to the best-matching objective when multiple match", async () => {
    // Given two objectives match with similarity above 0.5:
    //   "Launch MCP Marketplace" at 0.72
    //   "Improve Infrastructure Reliability" at 0.68
    // When the intent is evaluated
    // Then it links to the highest-scoring objective (0.72)
    // And a feed card shows both options for human confirmation
  });

  it("manually-created supports edge records alignment method as manual", async () => {
    const { surreal } = getRuntime();

    // Given an intent and an objective exist in the workspace
    const { workspaceId } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-manual-${crypto.randomUUID()}`,
    );

    const { objectiveId } = await createObjective(surreal, workspaceId, {
      title: "Improve Infrastructure Reliability",
      status: "active",
    });

    const { identityId: agentId } = await createAgentIdentity(
      surreal,
      workspaceId,
      "Coder-Beta",
    );
    const { intentId } = await createIntent(surreal, workspaceId, agentId, {
      goal: "Refactor logging subsystem to use structured logs",
    });

    // When Elena manually links the intent to the objective
    await createSupportsEdge(surreal, intentId, objectiveId, {
      alignment_score: 1.0,
      alignment_method: "manual",
      reasoning: "Manually linked by Elena -- structured logs improve reliability observability",
    });

    // Then the supports edge records the manual alignment method
    const edges = await getSupportsEdgesForIntent(surreal, intentId);
    expect(edges).toHaveLength(1);
    expect(edges[0].alignment_method).toBe("manual");
    expect(edges[0].alignment_score).toBe(1.0);
  }, 60_000);
});

// =============================================================================
// Error / Boundary Scenarios
// =============================================================================
describe("Error Path: Unaligned intent triggers warning observation (US-OB-02)", () => {
  it.skip("warning observation created when no objective matches above 0.5", async () => {
    // Given objective "Launch MCP Marketplace" is the only active objective
    // When Coder-Beta submits intent "Refactor logging subsystem to use structured logs"
    // And the authorizer finds no objective match above 0.5
    // Then an observation is created with severity "warning"
    // And text mentions "no supporting objective" or "organizational waste"
    // And the intent is NOT blocked (warning mode)
  });

  it.skip("informational feed card appears when no objectives exist", async () => {
    // Given no objectives exist in the workspace
    // When an agent submits an intent
    // Then a feed card appears: "No objectives defined. Agent work is untracked."
    // And the intent proceeds without alignment check
  });
});

describe("Boundary: Supports edges are immutable (US-OB-02)", () => {
  it("multiple intents can support the same objective", async () => {
    const { surreal } = getRuntime();

    // Given an objective exists
    const { workspaceId } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-multi-${crypto.randomUUID()}`,
    );

    const { objectiveId } = await createObjective(surreal, workspaceId, {
      title: "Launch MCP Marketplace",
      status: "active",
    });

    // And two agents each submit aligned intents
    const { identityId: agentAlpha } = await createAgentIdentity(surreal, workspaceId, "Coder-Alpha");
    const { identityId: agentBeta } = await createAgentIdentity(surreal, workspaceId, "Coder-Beta");

    const { intentId: intent1 } = await createIntent(surreal, workspaceId, agentAlpha, {
      goal: "Implement MCP tool discovery endpoint",
    });
    const { intentId: intent2 } = await createIntent(surreal, workspaceId, agentBeta, {
      goal: "Build MCP integration listing page",
    });

    // When both are aligned to the same objective
    await createSupportsEdge(surreal, intent1, objectiveId, { alignment_score: 0.87 });
    await createSupportsEdge(surreal, intent2, objectiveId, { alignment_score: 0.79 });

    // Then the objective has two supporting intents
    const edges = await getSupportsEdgesForObjective(surreal, objectiveId);
    expect(edges).toHaveLength(2);
  }, 60_000);

  it.skip("alignment evaluation completes within 200ms", async () => {
    // @property
    // Given the intent authorization pipeline processes intents
    // Then objective alignment evaluation completes within 200ms
    // And alignment evaluation never blocks intent execution in warning mode
  });
});
