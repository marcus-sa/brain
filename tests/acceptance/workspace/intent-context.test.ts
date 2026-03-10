import { describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { RecordId, type Surreal } from "surrealdb";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createEmbeddingVector } from "../../../app/src/server/graph/embeddings";
import { createTestUserWithMcp, setupAcceptanceSuite, type TestUserWithMcp } from "../acceptance-test-kit";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const getRuntime = setupAcceptanceSuite("intent-context");

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });
const embeddingModel = openrouter.textEmbeddingModel(process.env.OPENROUTER_EMBEDDING_MODEL!);
const embeddingDimension = Number(process.env.EMBEDDING_DIMENSION!);

async function embedText(text: string): Promise<number[] | undefined> {
  return createEmbeddingVector(embeddingModel, text, embeddingDimension);
}

type IntentContextResponse = {
  level: "task" | "project" | "workspace";
  data: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// DPoP-authenticated workspace setup (uses createTestUserWithMcp)
// ---------------------------------------------------------------------------

type AuthedWorkspace = {
  workspaceId: string;
  workspaceRecord: RecordId<"workspace", string>;
  mcpFetch: TestUserWithMcp["mcpFetch"];
};

async function createWorkspaceWithOAuth(
  baseUrl: string,
  surreal: Surreal,
  name?: string,
): Promise<AuthedWorkspace> {
  const workspaceId = randomUUID();
  const workspaceRecord = new RecordId("workspace", workspaceId);
  await surreal.query(
    `CREATE $ws CONTENT {
      name: $name,
      status: "active",
      onboarding_complete: true,
      onboarding_turn_count: 0,
      onboarding_summary_pending: false,
      onboarding_started_at: time::now(),
      created_at: time::now()
    };`,
    { ws: workspaceRecord, name: name ?? `Intent Smoke ${Date.now()}` },
  );

  // Get DPoP-capable user for MCP access
  const mcpUser = await createTestUserWithMcp(baseUrl, surreal, `intent-ctx-${Date.now()}-${Math.floor(Math.random() * 10000)}`);

  return { workspaceId, workspaceRecord, mcpFetch: mcpUser.mcpFetch };
}

async function seedProject(
  surreal: Surreal,
  workspaceRecord: RecordId<"workspace", string>,
  name: string,
): Promise<RecordId<"project", string>> {
  const projectRecord = new RecordId("project", randomUUID());
  await surreal.create(projectRecord).content({
    name,
    status: "active",
    workspace: workspaceRecord,
    created_at: new Date(),
    updated_at: new Date(),
  });
  await surreal
    .relate(workspaceRecord, new RecordId("has_project", randomUUID()), projectRecord, {
      added_at: new Date(),
    })
    .output("after");
  return projectRecord;
}

async function seedTask(
  surreal: Surreal,
  workspaceRecord: RecordId<"workspace", string>,
  projectRecord: RecordId<"project", string>,
  title: string,
  embedding?: number[],
): Promise<RecordId<"task", string>> {
  const taskRecord = new RecordId("task", randomUUID());
  await surreal.create(taskRecord).content({
    title,
    status: "open",
    priority: "medium",
    workspace: workspaceRecord,
    created_at: new Date(),
    updated_at: new Date(),
    ...(embedding ? { embedding } : {}),
  });
  await surreal
    .relate(taskRecord, new RecordId("belongs_to", randomUUID()), projectRecord, {
      added_at: new Date(),
    })
    .output("after");
  return taskRecord;
}

async function seedDecision(
  surreal: Surreal,
  workspaceRecord: RecordId<"workspace", string>,
  projectRecord: RecordId<"project", string>,
  summary: string,
  status: string,
  embedding?: number[],
): Promise<RecordId<"decision", string>> {
  const decisionRecord = new RecordId("decision", randomUUID());
  await surreal.create(decisionRecord).content({
    summary,
    status,
    workspace: workspaceRecord,
    created_at: new Date(),
    updated_at: new Date(),
    ...(embedding ? { embedding } : {}),
  });
  await surreal
    .relate(decisionRecord, new RecordId("belongs_to", randomUUID()), projectRecord, {
      added_at: new Date(),
    })
    .output("after");
  return decisionRecord;
}

async function postContext(
  mcpFetch: TestUserWithMcp["mcpFetch"],
  workspaceId: string,
  body: { intent: string; cwd?: string; paths?: string[] },
): Promise<IntentContextResponse> {
  const res = await mcpFetch(`/api/mcp/${workspaceId}/context`, { body });
  if (!res.ok) throw new Error(`postContext failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<IntentContextResponse>;
}

// ---------------------------------------------------------------------------
// Tests — realistic coding agent scenarios
// ---------------------------------------------------------------------------

describe("intent-context integration", () => {
  it("agent assigned a task via brain map gets task scope with siblings", async () => {
    const { baseUrl, surreal } = getRuntime();
    const ws = await createWorkspaceWithOAuth(baseUrl, surreal);
    const project = await seedProject(surreal, ws.workspaceRecord, "Payments Platform");
    const targetTask = await seedTask(surreal, ws.workspaceRecord, project, "Add payment processing");
    await seedTask(surreal, ws.workspaceRecord, project, "Implement refund flow");
    await seedDecision(surreal, ws.workspaceRecord, project, "Use Stripe for payments", "confirmed");
    const taskId = targetTask.id as string;

    // Agent says what brain map told it
    const result = await postContext(ws.mcpFetch, ws.workspaceId, {
      intent: `I'm implementing task:${taskId} - adding payment processing`,
    });

    expect(result.level).toBe("task");
    const data = result.data as any;
    expect(data.task_scope).toBeDefined();
    expect(data.task_scope.task.title).toBe("Add payment processing");
  }, 60_000);

  it("agent in single-project workspace gets project context with populated tasks and decisions", async () => {
    const { baseUrl, surreal } = getRuntime();
    const ws = await createWorkspaceWithOAuth(baseUrl, surreal);
    const project = await seedProject(surreal, ws.workspaceRecord, "Brain Platform");
    await seedTask(surreal, ws.workspaceRecord, project, "Build API rate limiting");
    await seedTask(surreal, ws.workspaceRecord, project, "Add error handling middleware");
    await seedDecision(surreal, ws.workspaceRecord, project, "Use token bucket for rate limiting", "confirmed");

    // Agent describes work naturally — no task ID, no project ID
    const result = await postContext(ws.mcpFetch, ws.workspaceId, {
      intent: "I need to add error handling to the API endpoints",
    });

    expect(result.level).toBe("project");
    const data = result.data as any;
    expect(data.project.name).toBe("Brain Platform");
    expect(data.active_tasks.length).toBe(2);
    expect(data.decisions.confirmed.length).toBe(1);
    expect(data.decisions.confirmed[0].summary).toBe("Use token bucket for rate limiting");
  }, 60_000);

  it("agent references project:id and sees its tasks and decisions", async () => {
    const { baseUrl, surreal } = getRuntime();
    const ws = await createWorkspaceWithOAuth(baseUrl, surreal);
    const project = await seedProject(surreal, ws.workspaceRecord, "Mobile App");
    await seedTask(surreal, ws.workspaceRecord, project, "Fix push notification bug");
    await seedDecision(surreal, ws.workspaceRecord, project, "Use FCM over APNs", "provisional");
    const projectId = project.id as string;

    const result = await postContext(ws.mcpFetch, ws.workspaceId, {
      intent: `I need the architecture context for project:${projectId}`,
    });

    expect(result.level).toBe("project");
    const data = result.data as any;
    expect(data.project.name).toBe("Mobile App");
    expect(data.active_tasks.length).toBe(1);
    expect(data.active_tasks[0].title).toBe("Fix push notification bug");
    expect(data.decisions.provisional.length).toBe(1);
  }, 60_000);

  it("multi-project workspace with cwd resolves to matching project", async () => {
    const { baseUrl, surreal } = getRuntime();
    const ws = await createWorkspaceWithOAuth(baseUrl, surreal);
    const backend = await seedProject(surreal, ws.workspaceRecord, "Backend API");
    const mobile = await seedProject(surreal, ws.workspaceRecord, "Mobile App");
    await seedTask(surreal, ws.workspaceRecord, backend, "Add GraphQL resolvers");
    await seedTask(surreal, ws.workspaceRecord, mobile, "Fix login screen crash");

    // Agent working in mobile-app directory
    const result = await postContext(ws.mcpFetch, ws.workspaceId, {
      intent: "Adding unit tests for the login module",
      cwd: "/Users/dev/mobile-app/src/auth",
    });

    expect(result.level).toBe("project");
    const data = result.data as any;
    expect(data.project.name).toBe("Mobile App");
    expect(data.active_tasks.some((t: any) => t.title === "Fix login screen crash")).toBe(true);
  }, 60_000);

  it("natural intent in multi-project workspace resolves via embedding similarity", async () => {
    const { baseUrl, surreal } = getRuntime();
    const ws = await createWorkspaceWithOAuth(baseUrl, surreal);
    const billing = await seedProject(surreal, ws.workspaceRecord, "Billing Service");
    const docs = await seedProject(surreal, ws.workspaceRecord, "Documentation Site");

    // Seed a realistic graph — tasks, decisions, questions with real embeddings
    const [invoiceEmb, webhookEmb, docsEmb, decisionEmb] = await Promise.all([
      embedText("Implement Stripe invoice generation for recurring subscriptions"),
      embedText("Handle Stripe payment webhook events and update order status"),
      embedText("Write getting started guide and API reference docs"),
      embedText("Use Stripe Billing API instead of custom invoice logic"),
    ]);

    await seedTask(surreal, ws.workspaceRecord, billing, "Implement Stripe invoice generation for recurring subscriptions", invoiceEmb);
    await seedTask(surreal, ws.workspaceRecord, billing, "Handle Stripe payment webhook events and update order status", webhookEmb);
    await seedTask(surreal, ws.workspaceRecord, docs, "Write getting started guide and API reference docs", docsEmb);
    await seedDecision(surreal, ws.workspaceRecord, billing, "Use Stripe Billing API instead of custom invoice logic", "confirmed", decisionEmb);

    // Agent describes billing work — no task ID, no project ID, no cwd
    const result = await postContext(ws.mcpFetch, ws.workspaceId, {
      intent: "I'm working on the payment invoice flow and need to handle Stripe webhooks",
    });

    // Should resolve via vector similarity — either task-level (direct match) or project-level
    expect(["task", "project"]).toContain(result.level);
    const data = result.data as any;
    if (result.level === "task") {
      expect(data.task_scope.task.title).toContain("Stripe");
    } else {
      expect(data.project.name).toBe("Billing Service");
      expect(data.active_tasks.length).toBe(2);
      expect(data.decisions.confirmed.length).toBe(1);
      expect(data.decisions.confirmed[0].summary).toContain("Stripe Billing API");
    }
  }, 90_000);

  it("vector search resolves to task-level context when intent closely matches a task", async () => {
    const { baseUrl, surreal } = getRuntime();
    const ws = await createWorkspaceWithOAuth(baseUrl, surreal);
    const project = await seedProject(surreal, ws.workspaceRecord, "Platform");
    const anotherProject = await seedProject(surreal, ws.workspaceRecord, "Admin Dashboard");

    const taskEmb = await embedText("Add Redis caching layer for user session tokens");
    await seedTask(surreal, ws.workspaceRecord, project, "Add Redis caching layer for user session tokens", taskEmb);

    const otherEmb = await embedText("Build admin user management page");
    await seedTask(surreal, ws.workspaceRecord, anotherProject, "Build admin user management page", otherEmb);

    // Agent intent closely matches the Redis task
    const result = await postContext(ws.mcpFetch, ws.workspaceId, {
      intent: "Implementing Redis-based session caching for auth tokens",
    });

    // Should resolve to task-level (direct task match) or project-level (via task→project)
    expect(["task", "project"]).toContain(result.level);
    const data = result.data as any;
    if (result.level === "task") {
      expect(data.task_scope.task.title).toContain("Redis");
    } else {
      expect(data.project.name).toBe("Platform");
    }
  }, 90_000);

  it("ambiguous intent in multi-project workspace falls back to workspace overview", async () => {
    const { baseUrl, surreal } = getRuntime();
    const ws = await createWorkspaceWithOAuth(baseUrl, surreal);
    await seedProject(surreal, ws.workspaceRecord, "Backend API");
    await seedProject(surreal, ws.workspaceRecord, "Mobile App");

    // Agent asks something generic — no task ID, no project match, no cwd
    const result = await postContext(ws.mcpFetch, ws.workspaceId, {
      intent: "What should I work on next?",
    });

    expect(result.level).toBe("workspace");
    const data = result.data as any;
    expect(data.projects.length).toBe(2);
    const names = data.projects.map((p: any) => p.name).sort();
    expect(names).toEqual(["Backend API", "Mobile App"]);
  }, 60_000);

  it("nonexistent task:id falls through gracefully", async () => {
    const { baseUrl, surreal } = getRuntime();
    const ws = await createWorkspaceWithOAuth(baseUrl, surreal);
    await seedProject(surreal, ws.workspaceRecord, "Solo Project");

    // Agent has a stale task ID — should still get useful context (single project fallback)
    const result = await postContext(ws.mcpFetch, ws.workspaceId, {
      intent: "Continuing work on task:deleted-task-00000",
    });

    // Falls through explicit ref → single-project shortcut
    expect(result.level).toBe("project");
    const data = result.data as any;
    expect(data.project.name).toBe("Solo Project");
  }, 60_000);
});
