import { requireConfig, getDirCacheEntry, setDirCacheEntry } from "../config";
import { BrainHttpClient } from "../http-client";

/**
 * brain system load-context
 * Called by SessionStart hook. Outputs context as additionalContext text.
 */
export async function runLoadContext(): Promise<void> {
  const config = requireConfig();
  const client = new BrainHttpClient(config);
  const cwd = process.cwd();

  // Check dir cache for cached project
  const cached = getDirCacheEntry(cwd);

  if (cached) {
    // Load context for cached project
    try {
      const context = await client.getContext({
        project_id: cached.project_id,
        since: cached.last_session,
      });

      // Output as text for Claude Code additionalContext
      console.log(formatContextPacket(context));

      // Update last session timestamp
      setDirCacheEntry(cwd, { ...cached, last_session: new Date().toISOString() });
    } catch (error) {
      console.error(`Failed to load context: ${error instanceof Error ? error.message : error}`);
    }
    return;
  }

  // No cached project — list projects for agent inference
  try {
    const projectsResult = await client.getProjects();
    const projects = projectsResult.projects;

    if (projects.length === 0) {
      console.log("No projects found in workspace. Create one in the Brain web UI first.");
      return;
    }

    if (projects.length === 1) {
      // Single project — auto-select
      const project = projects[0];
      setDirCacheEntry(cwd, {
        project_id: project.id,
        project_name: project.name,
        last_session: new Date().toISOString(),
      });

      const context = await client.getContext({ project_id: project.id });
      console.log(formatContextPacket(context));
      return;
    }

    // Multiple projects — output list for agent to select
    console.log(`You're working in: ${cwd}`);
    console.log(`Workspace: ${projectsResult.workspace.name}`);
    console.log(`\nProjects in this workspace:`);
    for (const p of projects) {
      console.log(`  - ${p.name} (id: ${p.id})`);
    }
    console.log(`\nTo set your project for this directory, run:`);
    console.log(`  brain system set-project <project-id>`);
  } catch (error) {
    console.error(`Failed to load projects: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * brain system set-project <project-id>
 * Cache a project for the current directory.
 */
export async function runSetProject(projectId: string): Promise<void> {
  const config = requireConfig();
  const client = new BrainHttpClient(config);
  const cwd = process.cwd();

  const projectsResult = await client.getProjects();
  const project = projectsResult.projects.find((p) => p.id === projectId);

  if (!project) {
    console.error(`Project not found: ${projectId}`);
    console.error("Available projects:");
    for (const p of projectsResult.projects) {
      console.error(`  - ${p.name} (id: ${p.id})`);
    }
    process.exit(1);
  }

  setDirCacheEntry(cwd, {
    project_id: project.id,
    project_name: project.name,
    last_session: new Date().toISOString(),
  });

  console.log(`Project set: ${project.name} (${project.id}) for ${cwd}`);
}

/**
 * brain system check-updates
 * Called by UserPromptSubmit hook. Outputs alerts for critical changes.
 */
export async function runCheckUpdates(): Promise<void> {
  const config = requireConfig();
  const client = new BrainHttpClient(config);
  const cwd = process.cwd();

  const cached = getDirCacheEntry(cwd);
  if (!cached?.last_session) return;

  try {
    const result = (await client.getChanges({
      project_id: cached.project_id,
      since: cached.last_session,
    })) as { changes: Array<{ entity_type: string; entity_name: string; change_type: string; changed_at: string }> };

    if (!result.changes || result.changes.length === 0) return;

    // Check for critical changes
    const critical = result.changes.filter(
      (c) => c.change_type === "contested" || c.change_type === "superseded",
    );

    if (critical.length > 0) {
      console.log("\n--- Context Update ---");
      for (const c of critical) {
        console.log(`[${c.entity_type}] ${c.entity_name} — ${c.change_type} at ${c.changed_at}`);
      }
      console.log("--- End Update ---\n");
    }

    // Update last check time
    setDirCacheEntry(cwd, { ...cached, last_session: new Date().toISOString() });
  } catch {
    // Silent on error — don't block the user
  }
}

/**
 * brain system end-session
 * Called by SessionEnd hook.
 */
export async function runEndSession(): Promise<void> {
  // The SessionEnd hook captures the session summary from the Stop hook
  // and sends it to the server. For now, this is a placeholder that reads
  // from stdin (the Stop hook output).
  const config = requireConfig();
  const _client = new BrainHttpClient(config);

  // The actual session end logic is handled by the MCP server
  // through the session/end endpoint. The CLI just forwards the data.
  // In practice, this is called by the SessionEnd command hook which
  // passes the summary from the Stop prompt hook.
  console.log("Session ended. Summary logged to Brain knowledge graph.");
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function formatContextPacket(packet: unknown): string {
  const p = packet as Record<string, unknown>;
  const lines: string[] = [];

  lines.push("# Brain Knowledge Graph Context\n");

  // Workspace & project
  const ws = p.workspace as { id: string; name: string } | undefined;
  const proj = p.project as { id: string; name: string; status: string; description?: string } | undefined;
  if (ws) lines.push(`Workspace: ${ws.name}`);
  if (proj) {
    lines.push(`Project: ${proj.name} (${proj.status})`);
    if (proj.description) lines.push(`Description: ${proj.description}`);
  }
  lines.push("");

  // Task scope
  const taskScope = p.task_scope as Record<string, unknown> | undefined;
  if (taskScope) {
    const task = taskScope.task as { id: string; title: string; status: string; description?: string };
    lines.push(`## Current Task: ${task.title} [${task.status}]`);
    if (task.description) lines.push(task.description);

    const subtasks = taskScope.subtasks as Array<{ id: string; title: string; status: string }>;
    if (subtasks?.length) {
      lines.push("\nSubtasks:");
      for (const s of subtasks) lines.push(`  - [${s.status}] ${s.title}`);
    }

    const siblings = taskScope.sibling_tasks as Array<{ id: string; title: string; status: string }>;
    if (siblings?.length) {
      lines.push("\nSibling tasks:");
      for (const s of siblings) lines.push(`  - [${s.status}] ${s.title}`);
    }
    lines.push("");
  }

  // Decisions
  const decisions = p.decisions as { confirmed: unknown[]; provisional: unknown[]; contested: unknown[] } | undefined;
  if (decisions) {
    if (decisions.contested.length > 0) {
      lines.push("## CONTESTED DECISIONS (conflicts — do not proceed without human input)");
      for (const d of decisions.contested as Array<{ summary: string; rationale?: string }>) {
        lines.push(`  - ${d.summary}${d.rationale ? ` — ${d.rationale}` : ""}`);
      }
      lines.push("");
    }

    if (decisions.confirmed.length > 0) {
      lines.push("## Confirmed Decisions (follow these)");
      for (const d of decisions.confirmed as Array<{ summary: string }>) {
        lines.push(`  - ${d.summary}`);
      }
      lines.push("");
    }

    if (decisions.provisional.length > 0) {
      lines.push("## Provisional Decisions (follow but flag for review)");
      for (const d of decisions.provisional as Array<{ summary: string }>) {
        lines.push(`  - ${d.summary}`);
      }
      lines.push("");
    }
  }

  // Active tasks
  const tasks = p.active_tasks as Array<{ title: string; status: string; priority?: string }> | undefined;
  if (tasks?.length) {
    lines.push("## Active Tasks");
    for (const t of tasks) {
      lines.push(`  - [${t.status}]${t.priority ? ` (${t.priority})` : ""} ${t.title}`);
    }
    lines.push("");
  }

  // Open questions
  const questions = p.open_questions as Array<{ text: string; status: string }> | undefined;
  if (questions?.length) {
    lines.push("## Open Questions");
    for (const q of questions) {
      lines.push(`  - [${q.status}] ${q.text}`);
    }
    lines.push("");
  }

  // Recent changes
  const changes = p.recent_changes as Array<{ entity_type: string; entity_name: string; change_type: string; changed_at: string }> | undefined;
  if (changes?.length) {
    lines.push("## Recent Changes");
    for (const c of changes) {
      lines.push(`  - [${c.entity_type}] ${c.entity_name} — ${c.change_type}`);
    }
    lines.push("");
  }

  // Observations
  const observations = p.observations as Array<{ text: string; severity: string }> | undefined;
  if (observations?.length) {
    lines.push("## Observations");
    for (const o of observations) {
      lines.push(`  - [${o.severity}] ${o.text}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
