# Brain Knowledge Graph Integration

This project is connected to the Brain knowledge graph via MCP tools. The graph contains decisions, constraints, tasks, questions, and observations from all agents and humans working on this workspace.

## How Context Works

- **SessionStart** automatically loads your project context (decisions, tasks, constraints, recent changes)
- **UserPromptSubmit** checks for graph updates and alerts you to critical changes (e.g., a decision you depend on was superseded)
- **Stop** catches unlogged decisions before the session ends
- **SessionEnd** logs a session summary to the graph

## MCP Tools Available

### Read (use freely)
- `get_project_context` — Refresh full project context (decisions, tasks, constraints, questions)
- `get_active_decisions` — Decisions grouped by status (confirmed/provisional/contested)
- `get_task_dependencies` — Dependency tree for a task (depends on, depended by, subtasks)
- `get_architecture_constraints` — Hard and soft constraints from decisions and observations
- `get_recent_changes` — What changed since your last session
- `get_entity_detail` — Full detail for any entity (entity ID format: `table:id`)

### Reason (use when making choices)
- `resolve_decision` — Check if the graph already answers your question. **Always try this before creating a new decision.**
- `check_constraints` — Verify a proposed action doesn't conflict with existing decisions. **Use before adding dependencies or changing approaches.**

### Write (use to keep the graph current)
- `create_provisional_decision` — Record an implementation choice you made. Status is "provisional" — only humans confirm.
- `ask_question` — When genuinely uncertain, ask rather than guess. Creates a question for human review.
- `update_task_status` — Track progress. Triggers automatic subtask rollup on parent tasks.
- `create_subtask` — Break tasks into smaller pieces. Includes semantic dedup (returns existing if similar).
- `log_implementation_note` — Append notes about what was implemented and how.

## Decision Governance

- **Your decisions are always `provisional` or `inferred`** — only humans confirm.
- This means you can move fast without blocking, while humans retain authority.
- Provisional decisions surface in the feed as DecisionReview cards for human approval.

## Best Practices

1. **Check before deciding.** Call `resolve_decision` first — the answer may already exist from another agent or human.
2. **Ask, don't guess.** If you're uncertain, `ask_question` is better than `create_provisional_decision`. A question says "I need input." A decision says "I picked this, review it."
3. **Log as you go.** Don't batch decisions for the end. Log each significant choice when you make it.
4. **Decompose tasks.** Use `create_subtask` to break work into pieces, then update status as each completes.
5. **Check constraints.** Before adding a dependency or changing an approach, call `check_constraints`.
