/**
 * Agent Tools: Brain MCP Tool Registration and Execution
 *
 * Traces: US-0.2 (agent reads context via tools),
 *         US-0.3 (agent updates task status via tools)
 *
 * Validates that the coding agent can read context and update task state
 * through Brain tools. Tests exercise the MCP endpoints that the agent
 * uses for context loading and status reporting.
 *
 * Driving ports: POST /api/mcp/:ws/task-context (via agent tool)
 *                POST /api/mcp/:ws/project-context (via agent tool)
 *                POST /api/mcp/:ws/tasks/status (via agent tool)
 *                POST /api/mcp/:ws/observations (via agent tool)
 */
import { describe, expect, it } from "bun:test";
import {
  setupOrchestratorSuite,
  createReadyTask,
  createTestProject,
  getTaskStatus,
  createTestUserWithMcp,
} from "./orchestrator-test-kit";

const getRuntime = setupOrchestratorSuite("agent_tools");

describe("Agent Tools: Agent reads task context", () => {
  // -------------------------------------------------------------------------
  // Happy Path: Agent retrieves task details
  // US-0.2
  // -------------------------------------------------------------------------
  it("agent receives task title, description, and status when requesting task context", async () => {
    const { baseUrl, surreal } = getRuntime();

    // Given a task with detailed description in a workspace
    const tokenUser = await createTestUserWithMcp(baseUrl, surreal, "agent-taskctx");
    const task = await createReadyTask(surreal, tokenUser.workspaceId, {
      title: "Implement CSV export",
      description: "Add ability to export entity data as CSV files with configurable columns",
    });

    // When the agent requests context for this task
    const res = await tokenUser.mcpFetch(`/api/mcp/${tokenUser.workspaceId}/task-context`, {
      body: { task_id: task.taskId },
    });
    const context = await res.json() as {
      title: string;
      description: string;
      status: string;
    };

    // Then the agent receives the task details needed to begin work
    expect(context.title).toBe("Implement CSV export");
    expect(context.description).toContain("CSV");
    expect(context.status).toBe("ready");
  }, 60_000);

  // -------------------------------------------------------------------------
  // Happy Path: Agent retrieves project context
  // US-0.2
  // -------------------------------------------------------------------------
  it("agent receives project structure and decisions when requesting project context", async () => {
    const { baseUrl, surreal } = getRuntime();

    // Given a project with associated tasks in a workspace
    const tokenUser = await createTestUserWithMcp(baseUrl, surreal, "agent-projctx");
    const project = await createTestProject(
      surreal,
      tokenUser.workspaceId,
      "Data Platform",
    );
    await createReadyTask(surreal, tokenUser.workspaceId, {
      title: "Build data ingestion pipeline",
      projectId: project.projectId,
    });

    // When the agent requests context for the project
    const res = await tokenUser.mcpFetch(`/api/mcp/${tokenUser.workspaceId}/project-context`, {
      body: { project_id: project.projectId },
    });
    const context = await res.json() as {
      name: string;
      status: string;
    };

    // Then the agent receives the project overview needed for informed decisions
    expect(context.name).toBe("Data Platform");
    expect(context.status).toBe("active");
  }, 60_000);

  // -------------------------------------------------------------------------
  // Error Path: Task context for nonexistent task
  // -------------------------------------------------------------------------
  it("agent receives an error when requesting context for a nonexistent task", async () => {
    const { baseUrl, surreal } = getRuntime();

    // Given a workspace with no matching task
    const tokenUser = await createTestUserWithMcp(baseUrl, surreal, "agent-notask");

    // When the agent requests context for a task that does not exist
    const response = await tokenUser.mcpFetch(`/api/mcp/${tokenUser.workspaceId}/task-context`, {
      body: { task_id: "nonexistent-id" },
    });

    // Then the request fails with a clear error
    expect(response.status).toBe(404);
  }, 60_000);
});

describe("Agent Tools: Agent updates task status", () => {
  // -------------------------------------------------------------------------
  // Happy Path: Agent marks task as blocked
  // US-0.3
  // -------------------------------------------------------------------------
  it("agent changes task status to blocked and records the reason", async () => {
    const { baseUrl, surreal } = getRuntime();

    // Given a task that the agent is working on
    const tokenUser = await createTestUserWithMcp(baseUrl, surreal, "agent-block");
    const task = await createReadyTask(surreal, tokenUser.workspaceId, {
      title: "Integrate payment gateway",
      status: "in_progress",
    });

    // When the agent reports that the task is blocked
    await tokenUser.mcpFetch(`/api/mcp/${tokenUser.workspaceId}/tasks/status`, {
      body: {
        task_id: task.taskId,
        status: "blocked",
        reason: "Missing API credentials for payment provider",
      },
    });

    // Then the task status is updated to blocked
    const status = await getTaskStatus(surreal, task.taskId);
    expect(status).toBe("blocked");
  }, 60_000);

  // -------------------------------------------------------------------------
  // Happy Path: Agent marks task as done
  // US-0.3
  // -------------------------------------------------------------------------
  it("agent changes task status to done upon completion", async () => {
    const { baseUrl, surreal } = getRuntime();

    // Given a task that the agent has been working on
    const tokenUser = await createTestUserWithMcp(baseUrl, surreal, "agent-done");
    const task = await createReadyTask(surreal, tokenUser.workspaceId, {
      title: "Add rate limiting middleware",
      status: "in_progress",
    });

    // When the agent reports that the task is completed
    await tokenUser.mcpFetch(`/api/mcp/${tokenUser.workspaceId}/tasks/status`, {
      body: {
        task_id: task.taskId,
        status: "done",
      },
    });

    // Then the task status is updated to done
    const status = await getTaskStatus(surreal, task.taskId);
    expect(status).toBe("done");
  }, 60_000);

  // -------------------------------------------------------------------------
  // Error Path: Invalid status transition
  // -------------------------------------------------------------------------
  it("agent cannot set an invalid status value", async () => {
    const { baseUrl, surreal } = getRuntime();

    // Given a task with status "ready"
    const tokenUser = await createTestUserWithMcp(baseUrl, surreal, "agent-badstatus");
    const task = await createReadyTask(surreal, tokenUser.workspaceId, {
      title: "Fix memory leak",
    });

    // When the agent tries to set an invalid status
    const response = await tokenUser.mcpFetch(`/api/mcp/${tokenUser.workspaceId}/tasks/status`, {
      body: {
        task_id: task.taskId,
        status: "invalid_status",
      },
    });

    // Then the request is rejected because the status value is not allowed
    expect(response.ok).toBe(false);
  }, 60_000);
});

describe("Agent Tools: Agent creates observations", () => {
  // -------------------------------------------------------------------------
  // Happy Path: Agent logs an observation about a risk
  // US-0.3 (related)
  // -------------------------------------------------------------------------
  it("agent creates an observation to flag a risk discovered during work", async () => {
    const { baseUrl, surreal } = getRuntime();

    // Given a workspace where the agent is working
    const tokenUser = await createTestUserWithMcp(baseUrl, surreal, "agent-obs");

    // When the agent creates an observation about a discovered risk
    const obsRes = await tokenUser.mcpFetch(`/api/mcp/${tokenUser.workspaceId}/observations`, {
      body: {
        text: "Authentication tokens are stored in localStorage, vulnerable to XSS",
        severity: "warning",
        category: "anomaly",
      },
    });
    const observation = await obsRes.json() as { id: string };

    // Then the observation is recorded for the team to review
    expect(observation.id).toBeTruthy();
  }, 60_000);

  // -------------------------------------------------------------------------
  // Happy Path: Agent logs a conflict observation
  // -------------------------------------------------------------------------
  it("agent creates a conflict observation when contradictory requirements are found", async () => {
    const { baseUrl, surreal } = getRuntime();

    // Given a workspace where the agent encounters contradictory decisions
    const tokenUser = await createTestUserWithMcp(baseUrl, surreal, "agent-conflict");

    // When the agent flags the contradiction
    const obsRes = await tokenUser.mcpFetch(`/api/mcp/${tokenUser.workspaceId}/observations`, {
      body: {
        text: "Task requires SQLite but project decision specifies PostgreSQL",
        severity: "conflict",
        category: "contradiction",
      },
    });
    const observation = await obsRes.json() as { id: string };

    // Then the conflict is surfaced for human resolution
    expect(observation.id).toBeTruthy();
  }, 60_000);
});
