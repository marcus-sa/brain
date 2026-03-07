/**
 * Stall Detection: Timeout and Auto-Abort for Unresponsive Agents
 *
 * Traces: US-1.2 (detect stalled agent)
 *
 * Validates that agents which stop responding or exceed configured limits
 * are automatically detected, aborted, and their tasks returned to an
 * assignable state with appropriate observations logged.
 *
 * Driving ports: POST /api/orchestrator/:ws/assign (triggers stall monitoring)
 *                GET  /api/orchestrator/:ws/sessions/:id (status reflects stall)
 */
import { describe, expect, it } from "bun:test";
import {
  setupOrchestratorSuite,
  createTestUser,
  createTestWorkspace,
  createReadyTask,
  assignTaskToAgent,
  getSessionStatus,
  getTaskStatus,
  getAgentSessionsForTask,
} from "./orchestrator-test-kit";

const getRuntime = setupOrchestratorSuite("stall_detection");

describe("Stall Detection: Agent timeout handling", () => {
  // -------------------------------------------------------------------------
  // Happy Path: Stalled agent is detected and aborted
  // US-1.2
  // -------------------------------------------------------------------------
  it.skip("agent session is aborted when no activity is detected within timeout", async () => {
    const { baseUrl, surreal } = getRuntime();

    // Given a task assigned to an agent that has stopped responding
    const user = await createTestUser(baseUrl, "stall-timeout");
    const workspace = await createTestWorkspace(baseUrl, user);
    const task = await createReadyTask(surreal, workspace.workspaceId, {
      title: "Optimize image compression",
    });
    const assignment = await assignTaskToAgent(
      baseUrl,
      user,
      workspace.workspaceId,
      task.taskId,
    );

    // When the configured timeout period elapses without agent activity
    // (In tests with mocked OpenCode, the mock simulates a stall by not emitting events.
    //  The stall detection timer fires based on ORCHESTRATOR_STALL_TIMEOUT_MS env var.)

    // Then the agent session is automatically aborted
    // Note: This test requires the server to be configured with a short stall timeout
    // for testing purposes (e.g. ORCHESTRATOR_STALL_TIMEOUT_MS=5000)
    // The actual assertion needs to wait for the timeout + detection cycle
    await Bun.sleep(10_000);

    const status = await getSessionStatus(
      baseUrl,
      user,
      workspace.workspaceId,
      assignment.agentSessionId,
    );
    expect(["aborted", "error"]).toContain(status.orchestratorStatus);

    // And the task is returned to a state where it can be reassigned
    const taskStatus = await getTaskStatus(surreal, task.taskId);
    expect(["ready", "blocked"]).toContain(taskStatus);
  }, 30_000);

  // -------------------------------------------------------------------------
  // Happy Path: Observation created on stall detection
  // US-1.2
  // -------------------------------------------------------------------------
  it.skip("an observation is created explaining why the agent was stopped", async () => {
    const { baseUrl, surreal } = getRuntime();

    // Given a task whose agent was automatically stopped due to inactivity
    const user = await createTestUser(baseUrl, "stall-obs");
    const workspace = await createTestWorkspace(baseUrl, user);
    const task = await createReadyTask(surreal, workspace.workspaceId, {
      title: "Migrate authentication system",
    });
    const assignment = await assignTaskToAgent(
      baseUrl,
      user,
      workspace.workspaceId,
      task.taskId,
    );

    // When the stall is detected and the agent is stopped
    await Bun.sleep(10_000);

    // Then an observation is created with a warning about the stall
    const sessions = await getAgentSessionsForTask(surreal, task.taskId);
    const stalledSession = sessions.find(
      (s) => s.id.id === assignment.agentSessionId,
    );
    expect(stalledSession).toBeDefined();

    // Verify an observation was created (query observations linked to this session)
    const observations = (await surreal.query(
      `SELECT id, text, severity FROM observation
       WHERE source_agent = "code_agent"
       ORDER BY created_at DESC LIMIT 5;`,
    )) as Array<Array<{ id: unknown; text: string; severity: string }>>;

    const stallObservation = observations[0]?.find(
      (o) => o.severity === "warning" && o.text.toLowerCase().includes("stall"),
    );
    expect(stallObservation).toBeDefined();
  }, 30_000);

  // -------------------------------------------------------------------------
  // Edge Case: Active agent is not falsely detected as stalled
  // -------------------------------------------------------------------------
  it.skip("actively working agent is not interrupted by stall detection", async () => {
    const { baseUrl, surreal } = getRuntime();

    // Given a task with an agent that is actively producing events
    const user = await createTestUser(baseUrl, "stall-active");
    const workspace = await createTestWorkspace(baseUrl, user);
    const task = await createReadyTask(surreal, workspace.workspaceId, {
      title: "Build real-time chat feature",
    });
    const assignment = await assignTaskToAgent(
      baseUrl,
      user,
      workspace.workspaceId,
      task.taskId,
    );

    // When the agent continues to produce activity within the timeout window
    // (Mocked OpenCode sends periodic heartbeat events)

    // Then the agent session remains active and is not interrupted
    const status = await getSessionStatus(
      baseUrl,
      user,
      workspace.workspaceId,
      assignment.agentSessionId,
    );
    expect(["spawning", "active", "idle"]).toContain(status.orchestratorStatus);
  }, 30_000);
});

describe("Stall Detection: Step count limit", () => {
  // -------------------------------------------------------------------------
  // Error Path: Agent exceeds maximum step count
  // US-1.2
  // -------------------------------------------------------------------------
  it.skip("agent session is aborted when maximum step count is exceeded", async () => {
    const { baseUrl, surreal } = getRuntime();

    // Given a task assigned to an agent that has exceeded the step limit
    // (The mock OpenCode can be configured to simulate rapid tool calls
    //  exceeding ORCHESTRATOR_MAX_STEPS)
    const user = await createTestUser(baseUrl, "stall-maxsteps");
    const workspace = await createTestWorkspace(baseUrl, user);
    const task = await createReadyTask(surreal, workspace.workspaceId, {
      title: "Refactor entire codebase",
    });
    const assignment = await assignTaskToAgent(
      baseUrl,
      user,
      workspace.workspaceId,
      task.taskId,
    );

    // When the agent exceeds the configured maximum number of steps
    await Bun.sleep(10_000);

    // Then the session is stopped to prevent runaway execution
    const status = await getSessionStatus(
      baseUrl,
      user,
      workspace.workspaceId,
      assignment.agentSessionId,
    );
    expect(["aborted", "error"]).toContain(status.orchestratorStatus);

    // And the task status reflects that work was interrupted
    const taskStatus = await getTaskStatus(surreal, task.taskId);
    expect(["ready", "blocked"]).toContain(taskStatus);
  }, 30_000);

  // -------------------------------------------------------------------------
  // Edge Case: Agent at step limit minus one continues working
  // @property -- universal invariant: step count is never negative
  // -------------------------------------------------------------------------
  it.skip("agent within step limit continues working without interruption", async () => {
    const { baseUrl, surreal } = getRuntime();

    // Given a task with an agent approaching but not exceeding the step limit
    const user = await createTestUser(baseUrl, "stall-belowlimit");
    const workspace = await createTestWorkspace(baseUrl, user);
    const task = await createReadyTask(surreal, workspace.workspaceId, {
      title: "Add form validation helpers",
    });
    const assignment = await assignTaskToAgent(
      baseUrl,
      user,
      workspace.workspaceId,
      task.taskId,
    );

    // When the agent has used steps below the maximum
    // Then the agent continues working normally
    const status = await getSessionStatus(
      baseUrl,
      user,
      workspace.workspaceId,
      assignment.agentSessionId,
    );
    expect(["spawning", "active", "idle"]).toContain(status.orchestratorStatus);
  }, 30_000);
});
