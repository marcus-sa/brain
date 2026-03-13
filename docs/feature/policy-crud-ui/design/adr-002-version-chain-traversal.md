# ADR-002: Version Chain Traversal Strategy

## Status
Accepted

## Context
Policies form a version chain via the `supersedes` field (each new version points to the previous). The UI needs to display a full version history timeline. The chain is bounded (practical maximum ~20 versions for a single policy lineage).

## Decision
Use **iterative SurrealQL queries** to traverse the `supersedes` chain in both directions, bounded by a reasonable limit.

Forward traversal (find newer versions):
```
SELECT id, version, status, created_at FROM policy WHERE supersedes = $currentPolicy
```

Backward traversal (find older versions):
```
Follow supersedes field iteratively until no more supersedes found
```

Combine results into a sorted array ordered by version number.

## Alternatives Considered

### Alternative 1: SurrealDB Recursive Graph Traversal
- **What**: Use SurrealDB's `->supersedes->` graph arrow syntax with recursion
- **Expected Impact**: Single query for full chain
- **Why Insufficient**: `supersedes` is a record link field (not a relation table), so graph arrow syntax doesn't apply. Would need to restructure supersedes as a relation table, requiring a schema migration for an existing field.

### Alternative 2: Denormalized Version List
- **What**: Store a `version_chain: array<record<policy>>` on each policy, updated on every version creation
- **Expected Impact**: O(1) lookup of full chain
- **Why Insufficient**: Introduces write amplification (every version creation updates all policies in the chain). Chain is bounded and small -- iterative traversal is fast enough. Adds mutation complexity for negligible performance gain.

## Consequences
- **Positive**: No schema changes needed, uses existing `supersedes` field
- **Positive**: Bounded iteration (practical max ~20 versions) keeps latency under 100ms
- **Positive**: Simple to implement and test
- **Negative**: Multiple sequential queries (one per version in chain) -- acceptable given small chain length
- **Negative**: Forward traversal requires index on `supersedes` field (add if performance is an issue, but 100-policy workspaces won't need it)
