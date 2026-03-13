# ADR-003: Version Diff Computation Location

## Status
Accepted

## Context
Policy version history requires showing a structured diff between two versions. The diff compares known fields (title, description, selector, rules, human_veto_required, max_ttl) with special handling for the rules array (match by rule.id).

## Decision
Compute diffs **client-side** in the browser. Both version records are already loaded for display. The diff is a pure transformation of two known-shape objects.

## Alternatives Considered

### Alternative 1: Server-Side Diff Endpoint
- **What**: `GET /policies/:id/diff?from=v1&to=v2` returns pre-computed diff
- **Expected Impact**: Consistent diff logic, reduces client complexity
- **Why Insufficient**: Adds a new endpoint for a pure computation that doesn't need DB access beyond fetching two records (which the client already has). Increases server surface area for no architectural benefit. The diff shape is entirely determined by the PolicyRecord type, which the client already knows.

### Alternative 2: Third-Party Diff Library
- **What**: Use `json-diff` or `deep-diff` npm package
- **Expected Impact**: Generic deep diff with minimal code
- **Why Insufficient**: Over-generic -- would diff internal fields (id, created_at, workspace) that should be excluded. Policy-specific diff logic (rules array matching by rule.id, selector deep compare) is domain-specific and simple enough to write directly. Avoids adding a dependency for ~50 lines of pure logic.

## Consequences
- **Positive**: Zero new server endpoints, zero new dependencies
- **Positive**: Diff is a pure function, trivially testable
- **Positive**: Instant -- no network round-trip for diff computation
- **Negative**: Diff logic lives in client code (but it's a shared pure function, could be moved to shared/ if needed later)
