# ADR-004: Rule Builder Field Autocomplete Strategy

## Status
Accepted

## Context
The rule builder needs a field input where admins specify dot-paths for policy predicates (e.g., `action_spec.provider`, `budget_limit.amount`). The predicate evaluator (`resolveDotPath()`) accepts **any** arbitrary dot-path and dynamically traverses the intent context object at evaluation time. There is no restriction on which fields a policy can reference — if a field doesn't exist on a particular intent, the predicate returns `false` and a warning is emitted.

The question is how to provide **autocomplete suggestions** in the rule builder UI to help admins discover available fields. This is a UX convenience feature, not a validation gate.

## Decision
Use a **static suggestion list** defined as a constant in `shared/contracts.ts`, derived from the well-known fields in `IntentEvaluationContext`.

The list includes common dot-path field names (e.g., `budget_limit.amount`, `action_spec.action`, `requester_role`) to help admins discover what's available. The field input is **free-text** — admins can type any dot-path, including paths into `action_spec.params.*` or other dynamic intent data that isn't in the suggestion list.

**Key distinction**: the suggestion list is for **discoverability**, not **restriction**. Unknown field paths are explicitly valid. The predicate evaluator handles them gracefully (returns `false` if the path doesn't resolve, emits a `PolicyGateWarning`).

## Alternatives Considered

### Alternative 1: Dynamic Field Discovery from Schema
- **What**: Query SurrealDB `INFO FOR TABLE intent` to discover field paths at runtime
- **Expected Impact**: Always in sync with schema
- **Why Insufficient**: The predicate evaluator operates on the TypeScript `IntentEvaluationContext` object, not on the SurrealDB schema. The intent table stores the full intent record; the evaluation context is a subset constructed in code. Schema introspection would return wrong/extra fields. Also, `action_spec.params` is an open `Record<string, unknown>` — its fields can't be discovered from schema.

### Alternative 2: Runtime Type Reflection
- **What**: Use TypeScript reflection or code generation to extract field paths from the IntentEvaluationContext type
- **Expected Impact**: Guaranteed type-safe suggestion list
- **Why Insufficient**: TypeScript types are erased at runtime. Would need a build step with ts-morph or similar, adding toolchain complexity for a list of ~12 well-known fields that changes rarely. Still wouldn't cover dynamic paths into `action_spec.params`.

### Alternative 3: Restrict Fields to Suggestion List Only
- **What**: Reject field paths not in the known list during policy creation
- **Expected Impact**: Prevents typos, guarantees all predicates reference known fields
- **Why Rejected**: Overly restrictive. Intent `action_spec.params` is an open object — agents can submit intents with arbitrary parameters (e.g., `action_spec.params.payment_amount`, `action_spec.params.target_environment`). Policies must be able to govern these dynamic fields. Restriction would force schema changes every time a new intent parameter appears.

## Consequences
- **Positive**: Simple, no build tooling, no runtime overhead
- **Positive**: Shared between client (autocomplete suggestions) and server (optional soft validation/warnings)
- **Positive**: Admins can create policies over arbitrary intent fields, including dynamic `action_spec.params.*` paths
- **Negative**: Suggestion list must be manually updated when IntentEvaluationContext adds new well-known fields
- **Mitigation**: Both the type and the constant live in the same codebase — changes to one are immediately visible alongside the other
- **UX note**: The rule builder should show a subtle hint when a non-suggested field path is entered (e.g., "Custom field — will match if present on the intent") rather than an error
