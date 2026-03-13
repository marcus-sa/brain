# ADR-005: Supersede Atomicity on Version Activation

## Status
Accepted

## Context
When a new policy version is activated, the old version must be superseded atomically:
1. New version status -> "active"
2. Old version status -> "superseded"
3. Old version's governing/protects edges removed
4. New version's governing/protects edges created
5. Audit events for both transitions

If any step fails independently, the system could have two active versions of the same policy or an active version with no edges.

## Decision
Use a **single SurrealDB transaction** that performs all five operations atomically. This extends the existing `activatePolicy()` pattern (which already uses `BEGIN TRANSACTION`).

The new `supersedePolicyOnActivation()` query function wraps all operations:
```
BEGIN TRANSACTION;
  UPDATE new_policy SET status = 'active', updated_at = time::now();
  RELATE creator->governing->new_policy SET created_at = time::now();
  RELATE new_policy->protects->workspace SET created_at = time::now();
  UPDATE old_policy SET status = 'superseded', updated_at = time::now();
  DELETE governing WHERE out = old_policy;
  DELETE protects WHERE in = old_policy;
COMMIT TRANSACTION;
```

## Alternatives Considered

### Alternative 1: Two Separate Calls (Activate New + Deprecate Old)
- **What**: Call existing `activatePolicy()` then existing `deprecatePolicy()` sequentially
- **Expected Impact**: Reuse existing functions directly
- **Why Insufficient**: Not atomic. If the second call fails, two versions are simultaneously active with governing/protects edges. Recovery logic would be complex. The window between calls (even if small) violates the "exactly one active version" invariant.

### Alternative 2: Application-Level Lock
- **What**: Use a mutex or advisory lock before performing the two operations
- **Expected Impact**: Prevents concurrent activation conflicts
- **Why Insufficient**: Over-engineered for a single-server deployment. SurrealDB transactions already provide ACID guarantees. Application locks don't survive process crashes.

## Consequences
- **Positive**: ACID guarantee -- all-or-nothing transition
- **Positive**: Single network round-trip to DB
- **Positive**: Follows existing transaction pattern in codebase
- **Negative**: Cannot reuse existing `activatePolicy()` and `deprecatePolicy()` functions directly (need new composite function)
- **Mitigation**: New function is additive, existing functions remain for non-versioned use cases
