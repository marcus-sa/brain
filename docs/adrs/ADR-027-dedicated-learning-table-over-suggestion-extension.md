# ADR-027: Dedicated Learning Table over Suggestion Table Extension

## Status
Proposed

## Context
Agent learnings need persistence in SurrealDB. Two approaches: extend the existing `suggestion` table with learning-specific fields, or create a dedicated `learning` table.

Learnings and suggestions share some surface similarities (agent-proposed, human-approved), but differ fundamentally in lifecycle, schema, and consumption pattern.

## Decision
Create a dedicated `learning` SCHEMAFULL table with its own relation tables (`learning_evidence`, `supersedes`).

## Alternatives Considered

### Extend suggestion table with discriminated union
- **What**: Add `entity_subtype` field ("suggestion" | "learning"), add learning-specific fields as optional, filter by subtype in queries.
- **Why rejected**: Learnings have 5 statuses (active/pending_approval/dismissed/superseded/deactivated) incompatible with suggestion's 5 statuses (pending/accepted/dismissed/deferred/converted). Learning-specific fields (`target_agents`, `learning_type`, `priority`, `activated_at`, `deactivated_at`) would bloat the suggestion table. JIT loading queries would need subtype filtering on every read. The `supersedes` relation (learning -> learning) has no suggestion equivalent. Schema complexity compounds -- SCHEMAFULL mode requires explicit field definitions for every optional learning field on the suggestion table.

### Shared base table with inheritance
- **What**: Abstract `knowledge_item` table with `learning` and `suggestion` as specializations.
- **Why rejected**: SurrealDB does not support table inheritance. Would require SCHEMALESS mode (violates project constraint) or manual polymorphism with discriminator fields (same problems as option 1).

## Consequences
- **Positive**: Clean separation of concerns. Independent schema evolution. Simple queries without subtype filtering. JIT loading queries are efficient (no dead fields). Follows existing codebase pattern (observation, suggestion, intent are all separate tables).
- **Negative**: Some code pattern duplication between `learning/queries.ts` and `suggestion/queries.ts` (workspace scope validation, status transition, embedding write). Acceptable -- the patterns are small and the domain semantics differ enough to justify separation.
