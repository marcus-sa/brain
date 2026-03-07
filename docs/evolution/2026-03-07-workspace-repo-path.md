# Evolution: Workspace Repository Path

**Date:** 2026-03-07
**Feature:** workspace-repo-path
**Branch:** marcus-sa/coding-agent-orch
**Commits:** 0c17e23, 3682fa8, 8533174, f8ae64d, 2ed2973

## Problem Statement

The coding agent orchestrator hardcoded `repoRoot` to `process.cwd()` at server startup, forcing every workspace to operate against the same repository. Multi-workspace setups pointing at different repos were impossible, and there was no UI for specifying which repo a workspace targets.

## Solution Summary

Added a per-workspace `repo_path` field that is resolved at task assignment time instead of at server startup. The field is optional on workspace creation (allowing users to set it later), validated against `git rev-parse` to confirm a real git repository, and enforced by the assignment guard before any agent session can start.

No new components were introduced -- the feature threads through 6 existing layers: schema, shared contracts, workspace routes, orchestrator (guard + lifecycle + wiring), and client UI.

## Steps Completed

| Step | Name | Commit | Status |
|------|------|--------|--------|
| 01-01 | Schema migration + shared contracts | 0c17e23 | Done |
| 01-02 | Repo path validation + update endpoint | 3682fa8 | Done |
| 01-03 | Workspace creation with optional repo_path | (covered by 01-02) | Done (no new code needed) |
| 01-04 | Assignment guard + orchestrator wiring | f8ae64d | Done |
| 01-05 | UI: repo path input + missing-path banner | 8533174 | Done |
| refactor | RPP L1-L4 refactoring pass | 2ed2973 | Done |

## Files Changed

### Schema

- `schema/migrations/0016_workspace_repo_path.surql` -- `DEFINE FIELD OVERWRITE repo_path ON workspace TYPE option<string>`
- `schema/surreal-schema.surql` -- updated canonical schema

### Shared Contracts

- `app/src/shared/contracts.ts` -- added `repoPath?: string` to `CreateWorkspaceRequest` and `WorkspaceBootstrapResponse`

### Server: Workspace

- `app/src/server/workspace/validate-repo-path.ts` -- new `validateRepoPath()` function (shells out to `git rev-parse`)
- `app/src/server/workspace/workspace-routes.ts` -- `POST /api/workspaces/:ws/repo-path` endpoint; repo_path persistence on create
- `app/src/server/http/parsing.ts` -- parse repoPath from workspace creation request

### Server: Orchestrator

- `app/src/server/orchestrator/assignment-guard.ts` -- `REPO_PATH_REQUIRED` check before task assignment
- `app/src/server/orchestrator/session-lifecycle.ts` -- reads `repo_path` from workspace record at session start
- `app/src/server/orchestrator/routes.ts` -- wiring changes for per-workspace resolution
- `app/src/server/orchestrator/types.ts` -- removed static `repoRoot` from `OrchestratorWiringDeps`
- `app/src/server/runtime/start-server.ts` -- removed static repoRoot injection

### Client UI

- `app/src/client/components/layout/WorkspaceGuard.tsx` -- repo path text input on creation form
- `app/src/client/components/graph/AgentStatusSection.tsx` -- missing-path banner with action
- `app/src/client/hooks/use-workspace.ts` -- pass repoPath in create request
- `app/src/client/router.tsx` -- routing support
- `app/src/client/stores/workspace-state.ts` -- workspace state includes repoPath

## Key Decisions

1. **Optional on creation, required at assignment** -- Users can create a workspace without a repo path and set it later, but the assignment guard enforces it before any agent session starts. This supports exploratory workspace creation without blocking on repo selection.

2. **Validate via `git rev-parse`** -- Path validation shells out to `git -C <path> rev-parse --git-dir` rather than checking for `.git` directory existence. This correctly handles bare repos and worktrees.

3. **Per-workspace resolution at assignment time** -- `repo_path` is read from the workspace record during task assignment, not cached at server startup. This means path changes take effect immediately without server restart.

4. **Step 01-03 folded into 01-02** -- Workspace creation with optional repo_path was fully satisfied by the parsing/validation/persistence work in step 01-02, requiring no additional code.

## Test Coverage

### Acceptance Tests

- `tests/acceptance/coding-agent-orchestrator/repo-path.test.ts` -- 8 scenarios covering assignment guard (block without path, allow after set), workspace creation (persist, reject invalid, allow without), and update (reject non-git, reject nonexistent, accept valid)

### Unit Tests

- `tests/unit/coding-agent-orchestrator/validate-repo-path.test.ts` -- `validateRepoPath()` pure function
- `tests/unit/coding-agent-orchestrator/assignment-guard.test.ts` -- `REPO_PATH_REQUIRED` guard check
- `tests/unit/coding-agent-orchestrator/session-lifecycle.test.ts` -- per-workspace repo_path resolution

## Execution Stats

- **Total steps:** 5 (1 phase)
- **Executed:** 4 steps + 1 refactoring pass (step 01-03 was a no-op)
- **Duration:** ~32 minutes (14:43 to 15:15 UTC)
- **Roadmap reviewer:** nw-software-crafter-reviewer (approved 2026-03-07T14:50:00Z)
