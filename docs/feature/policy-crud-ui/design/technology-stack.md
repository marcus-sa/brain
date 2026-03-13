# Policy CRUD UI -- Technology Stack

## Principle: No New Dependencies

This feature is entirely additive within the existing stack. Zero new packages, libraries, or services required.

## Stack Reuse

| Layer | Technology | License | Existing? | Rationale |
|-------|-----------|---------|-----------|-----------|
| Runtime | Bun | MIT | Yes | Server runtime, already in use |
| HTTP | Bun.serve routes | MIT | Yes | Route registration pattern established |
| Database | SurrealDB | BSL 1.1 | Yes | Schema, indexes, relations already defined |
| DB SDK | surrealdb (JS SDK v2) | Apache 2.0 | Yes | RecordId, query patterns established |
| Frontend framework | React | MIT | Yes | Component architecture established |
| Routing | TanStack Router | MIT | Yes | Route tree, auth layout established |
| Auth | Better Auth | MIT | Yes | Session middleware in use |
| Styling | CSS (vanilla) | N/A | Yes | styles.css with BEM-like conventions |

## Patterns Reused (Not Technologies)

| Pattern | Reference Implementation | Reuse For |
|---------|-------------------------|-----------|
| Route handler factory | `learning-route.ts` | `policy-route.ts` |
| CRUD page + dialogs | `learnings-page.tsx` | `policies-page.tsx` |
| StatusTabs + filters | `StatusTabs.tsx`, `LearningFilters.tsx` | Policy status tabs + filters |
| Data fetching hooks | `use-learnings.ts` | `use-policies.ts` |
| Action hooks | `use-learning-actions.ts` | `use-policy-actions.ts` |
| Workspace scoping | `resolveWorkspaceRecord()` | All policy endpoints |
| JSON response helpers | `http/response.ts` | Policy API responses |
| Audit events | `createPolicyAuditEvent()` | Already exists, reuse directly |

## Why No New Dependencies

| Capability | Could Use | Why Not Needed |
|---|---|---|
| Form validation | Zod, Yup | Simple validation in pure functions, rules shape is well-defined |
| Diff computation | diff, json-diff | Structured diff of known fields -- trivial to compute without library |
| Table component | TanStack Table | Learning Library uses plain HTML tables -- maintain consistency |
| Rule builder UI | Form builder libraries | Custom component -- domain-specific, no generic library fits |
| Field autocomplete | Downshift, Combobox | Static field list, native datalist or simple filtered dropdown suffices |
