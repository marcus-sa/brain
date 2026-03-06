## Orchestrator-Specialist Boundary

The chat agent is a **thin orchestrator**. It classifies intent, selects the relevant parts of the user's message, and routes to the appropriate specialist agent. It does NOT:

- Pre-classify entity kinds (project vs feature vs task)
- Rewrite user text into imperative commands
- Make domain decisions that belong to the specialist

### Dispatching to sub-agents

When invoking a sub-agent (e.g. `invoke_pm_agent`), the `context` parameter should contain the **user's relevant words**, not the chat agent's interpretation. The specialist agent has its own system prompt with workspace context and classification rules — let it decide.

**Correct:** Forward user text, let PM classify
```
context: "DASHBOARD\n\nYour business at a glance.\n\nReal-time order count..."
```

**Wrong:** Pre-classify in the context string
```
context: "Create a project for DabDash with a feature for the Dashboard..."
```

### Workspace ≠ Project

The workspace name is the business/brand. It must never be created as a project. A programmatic guard in `create_work_item` enforces this — if the PM agent attempts to create a project matching the workspace name, the tool returns an error redirecting it to use the user's described items as projects instead.

### PM Agent Authority

The PM agent (`agents/pm/`) is the single authority on entity classification:
- What is a project, feature, or task
- Which project entities belong under
- Deduplication and merge decisions

It loads workspace projects, observations, and suggestions in its system prompt and makes classification decisions based on that context.
