# Policy Node -- Technology Stack

## Stack Summary

No new technology introduced. The policy node uses the existing stack exclusively.

| Component | Technology | Version | License | Rationale |
|-----------|-----------|---------|---------|-----------|
| Runtime | Bun | latest | MIT | Existing runtime |
| Language | TypeScript | 5.x | Apache 2.0 | Existing language, algebraic types for predicates |
| Database | SurrealDB | 3.0 | BSL 1.1 | Existing graph DB; native graph traversal for policy edges |
| DB SDK | surrealdb (JS) | 2.x | Apache 2.0 | Existing SDK; RecordId for type-safe queries |
| Schema Validation | Zod | 3.x | MIT | Existing; validates predicate structure at boundaries |
| LLM SDK | Vercel AI SDK | latest | Apache 2.0 | Existing; Tier 2 evaluator unchanged |
| Auth | jose (DPoP) | latest | MIT | Existing; policy CRUD routes use DPoP auth |

## Technology Decisions

### No New Dependencies

The policy node is a domain module, not an infrastructure change. All capabilities needed (graph traversal, structured predicates, audit events, typed results) are served by the existing stack.

### SurrealDB Graph Traversal for Policy Loading

SurrealDB's native graph traversal (`->governing->policy`, `<-protects<-policy`) eliminates the need for join tables or application-level graph resolution. The `identity->governing->policy->protects->workspace` path provides the exact query pattern FR-3 requires.

Alternative considered: flat `policy_workspace` and `policy_identity` junction tables with `SELECT ... WHERE workspace = $ws`. Rejected because it duplicates what SurrealDB graph edges provide natively and loses the ability to traverse multi-hop relationships.

### Structured JSON Predicates (No Expression Engine)

Rule conditions use plain TypeScript type narrowing with a fixed operator set (`eq`, `neq`, `lt`, `lte`, `gt`, `gte`, `in`, `not_in`, `exists`). No expression parser library needed.

Alternatives considered:
- **jsonata** (MIT): Full JSONPath expression engine. Over-powered for fixed-operator predicates; adds attack surface via arbitrary expressions.
- **json-rules-engine** (ISC): Rule engine with facts and conditions. Heavier abstraction than needed; the predicate evaluator is ~50 lines of pure TypeScript.

Both rejected: the operator set is small, fixed, and known at compile time. A library adds dependency risk without proportional benefit.

### Zod for Predicate Validation

Predicate structure (`field`, `operator`, `value`) is validated with Zod at the API boundary (when policies are created). This catches malformed predicates before they reach the evaluator. Zod is already used throughout the codebase for schema validation.
