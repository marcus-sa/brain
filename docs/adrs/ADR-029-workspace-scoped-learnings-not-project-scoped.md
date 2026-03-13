# ADR-029: Workspace-Scoped Learnings, Not Project-Scoped

## Status
Proposed

## Context
Learnings could be scoped to a project (like tasks and decisions via `belongs_to` edges) or to a workspace. The question is which scope best matches learning semantics and consumption patterns.

## Decision
Learnings are workspace-scoped. No `belongs_to` edge to project/feature. Filtered by `workspace` field only.

## Alternatives Considered

### Project-scoped learnings with `belongs_to` edges
- **What**: Each learning belongs to a project. JIT loading filters by project context.
- **Why rejected**: Most learnings are cross-cutting behavioral rules ("never use null", "use RecordId objects", "fail fast on invalid state"). Project scoping would require duplicating the same learning across projects or adding complex "global + project" scope logic. The `target_agents` array already provides sufficient scoping granularity.

### Dual scope (workspace + optional project)
- **What**: Optional `project` field. When present, learning only injected for that project's context.
- **Why rejected**: Adds query complexity to JIT loading (union of workspace-global and project-specific). User stories show no demand for project-scoped learnings in the initial release. Can be added later via optional `project` field without schema migration (DEFINE FIELD OVERWRITE).

## Consequences
- **Positive**: Simple JIT loading query (one workspace filter). No edge table management. Matches typical learning patterns (behavioral rules transcend project boundaries).
- **Negative**: Cannot scope a learning to a single project. Mitigated by `target_agents` filtering (most project-specific knowledge is better captured as decisions, not learnings).
