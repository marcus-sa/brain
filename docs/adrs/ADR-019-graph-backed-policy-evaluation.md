# ADR-019: Graph-Backed Policy Evaluation

## Status

Proposed

## Context

The intent authorization pipeline (ADR-011, ADR-013) uses a two-tier evaluation: policy gate (Tier 1, deterministic) followed by LLM evaluation (Tier 2, non-deterministic). Currently, the policy gate operates on an in-memory `WorkspacePolicy` stub that is always passed as an empty object (`policy: {}`), making Tier 1 a no-op.

Requirements from the DISCUSS wave (Jobs 1+2, opportunity scores 17+19) call for persistent, graph-backed governance rules that are evaluated at intent time. Policies must be SCHEMAFULL records in SurrealDB with structured predicate rules, connected to identities and workspaces via graph edges, with full audit trail and version immutability.

### Quality attribute priorities (from DISCUSS)
1. **Auditability**: every policy decision traceable with immutable versions
2. **Maintainability**: pure predicate evaluator, typed predicates, functional composition
3. **Time-to-market**: replace stub with real implementation, minimal new infrastructure
4. **Testability**: pure core functions, isolated effect boundaries

### Constraints
- Single developer, TypeScript/Bun, SurrealDB 3.0
- Functional paradigm (pure core / effect shell)
- No backward compatibility with existing data needed
- No policy CRUD API endpoints this phase

## Decision

Replace the in-memory `WorkspacePolicy` stub with a persistent `policy` table in SurrealDB, connected to identities and workspaces via `governing` and `protects` graph edges. The policy gate traverses the graph at intent evaluation time, evaluating structured JSON predicates deterministically.

### Architecture

**New module**: `app/src/server/policy/` with four files:
- `types.ts` -- algebraic data types (pure, zero external imports)
- `predicate-evaluator.ts` -- pure function: dot-path resolution + operator matching
- `policy-queries.ts` -- SurrealDB adapter (effect boundary)
- `policy-gate.ts` -- composition pipeline: load -> merge -> evaluate -> trace -> result

**Modified module**: `app/src/server/intent/` -- `authorizer.ts` calls the new policy gate instead of the inline stub; `risk-router.ts` accepts `human_veto_required` flag.

### Predicate format (structured, not eval)

Rules use structured JSON predicates with a fixed operator set (`eq`, `neq`, `lt`, `lte`, `gt`, `gte`, `in`, `not_in`, `exists`). No expression parsing, no `eval()`, no dynamic code execution. Example:
```json
{ "field": "budget_limit.amount", "operator": "lte", "value": 500 }
```

### Evaluation algorithm

1. Load active policies via graph traversal (identity + workspace edges)
2. Deduplicate by policy ID
3. Merge all rules, sort by priority DESC
4. Evaluate each rule's predicates against intent context
5. First matching deny rule -> REJECT (short-circuit)
6. If any policy has `human_veto_required = true` -> flag for veto_window
7. All rules pass -> continue to LLM tier
8. Build policy_trace array and persist on `intent.evaluation`

### Backward compatibility

Empty policy set (no active policies for identity+workspace) = gate passes. This preserves current behavior where Tier 1 is a no-op.

### Version immutability

Policy updates create new version records (version N+1). The original record transitions to `superseded` status. The `supersedes` field links the version chain. Audit references to old versions remain valid.

## Alternatives Considered

### Alternative 1: Extend `authority_scope` with conditional rules

Add predicate conditions to the existing `authority_scope` table so that permission checks include budget/action rules.

- **What**: Add `condition` field to `authority_scope`, evaluate at MCP tool execution time
- **Expected impact**: ~40% of governance requirement (static per-agent-type rules, no per-workspace customization)
- **Why insufficient**: `authority_scope` is per-agent-type (code_agent, architect, etc.), not per-workspace or per-identity. Cannot express "workspace acme has a $500 budget cap" or "agent-1 requires human review for deploy actions." Different abstraction level -- authority_scope controls what agent types *can* do; policies control what *should* be done in specific contexts.

### Alternative 2: Expression parser library (jsonata / json-rules-engine)

Use a general-purpose expression engine for rule conditions instead of structured predicates.

- **What**: Install jsonata (MIT) or json-rules-engine (ISC) for rule evaluation
- **Expected impact**: ~100% of predicate evaluation requirement, plus future extensibility
- **Why insufficient**: The operator set is small (9 operators), fixed, and known at compile time. A library adds dependency risk, increases attack surface (arbitrary expressions), and the predicate evaluator is ~50 lines of pure TypeScript. Complexity is not justified for the current requirement. Can introduce a library later if the operator set grows beyond what's manageable inline.

### Alternative 3: SurrealDB stored function for policy evaluation

Move the entire policy evaluation logic into a SurrealDB `DEFINE FUNCTION` that runs server-side.

- **What**: `fn::evaluate_policy_gate($identity, $workspace, $intent_context)` in SurrealQL
- **Expected impact**: ~80% of requirement (fewer network roundtrips, atomic evaluation)
- **Why insufficient**: SurrealQL has limited control flow for complex predicate evaluation (dot-path resolution, operator dispatch, short-circuit on deny). Testing is harder (no unit tests for SurrealQL functions). Debugging is opaque. The pure TypeScript evaluator is easier to test, maintain, and debug. Graph traversal stays in SurrealDB (where it's efficient); predicate evaluation stays in TypeScript (where it's testable).

## Consequences

### Positive

- **Deterministic governance**: structured predicates provide a verifiable, auditable safety floor before LLM evaluation
- **Graph-native**: policy-identity-workspace relationships use SurrealDB's native graph edges, no join tables
- **Pure core**: predicate evaluator is a pure function with no dependencies, trivially testable
- **Audit trail**: every policy state transition and every intent evaluation produces traceable records
- **Backward compatible**: existing intent pipeline works unchanged when no policies exist
- **No new infrastructure**: module addition within existing monolith, no new services or dependencies

### Negative

- **Schema surface increase**: new `policy` table, two relation tables, extended `audit_event` ASSERT, new `intent.evaluation` fields
- **Migration required**: versioned `.surql` migration needed; existing `audit_event` records are unaffected but the ASSERT is widened
- **Two policy evaluation paths**: the old `checkBudgetCap`/`checkActionAllowlist` logic is removed in favor of the general predicate system. Any tests depending on the old types will need updating.
- **FLEXIBLE condition field**: `rules[*].condition` is `object FLEXIBLE` in SurrealDB because predicate shapes vary. Validation happens at the application layer, not the schema layer.

### Quality Attribute Impact

| Attribute | Impact | Direction |
|-----------|--------|-----------|
| Auditability | Policy trace on every evaluation, immutable versions, lifecycle audit events | Positive |
| Testability | Pure predicate evaluator, isolated DB adapter, composition pipeline | Positive |
| Maintainability | New module follows established patterns (pure core / effect shell) | Positive |
| Performance | Graph traversal adds ~5-20ms per evaluation; indexed on status + edges | Slightly negative (acceptable) |
| Security | Structured predicates eliminate eval() risk; agent read-only | Positive |
