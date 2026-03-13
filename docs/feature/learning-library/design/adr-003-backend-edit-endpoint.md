# ADR-003: Backend Edit Endpoint -- PUT vs PATCH vs Action Extension

## Status
Accepted

## Context

US-LL-03 requires editing text, priority, and target_agents on active learnings. The existing backend has:
- `updateLearningText()` -- updates text + updated_at (used during approve-with-edit)
- `updateLearningStatus()` -- state transitions only
- No endpoint for editing priority or target_agents on active learnings

Need a way to expose field editing for active learnings.

## Decision

Add `PUT /api/workspaces/:workspaceId/learnings/:learningId` endpoint. Accepts partial body with fields to update: `{ text?, priority?, target_agents? }`. Only allowed when learning status is `active`. Reuses and extends the existing `updateLearningText` query pattern.

## Alternatives Considered

### Alternative 1: Extend POST actions endpoint with "edit" action
- **What**: Add `{ action: "edit", text: "...", priority: "...", target_agents: [...] }` to the existing actions endpoint.
- **Expected Impact**: No new route, reuses existing action dispatch.
- **Why Insufficient**: The actions endpoint is for state transitions (approve/dismiss/deactivate). Editing fields is not a state transition -- it's a resource update. Mixing these semantics makes the action body polymorphic and harder to validate. REST convention: PUT/PATCH for updates, POST actions for state machines.

### Alternative 2: PATCH with JSON Patch format
- **What**: Standard JSON Patch (`[{ op: "replace", path: "/text", value: "..." }]`).
- **Expected Impact**: Standards-compliant partial update.
- **Why Insufficient**: Over-engineered for 3 fields. No existing endpoint uses JSON Patch. Adds parsing complexity. Simple `{ text?, priority?, target_agents? }` body is sufficient and consistent with the create endpoint shape.

## Consequences

- **Positive**: Clean REST semantics. PUT for resource updates, POST /actions for transitions.
- **Positive**: Reuses existing `updateLearningText` query. Extends with `updateLearningFields` for priority/target_agents.
- **Negative**: One new route to register. Minimal cost.
- **Implementation note**: If text changes, re-generate embedding vector (existing pattern from create). Priority/agent changes do not affect embedding.
