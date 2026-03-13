# ADR-001: Authorization Guard Pattern for Policy Mutations

## Status
Accepted

## Context
Policy mutations (create, activate, deprecate, version) must be restricted to human identities. Agent and system identities get read-only access. The identity type is stored on the `identity` table as `type: 'human' | 'agent' | 'system'`.

Two enforcement patterns exist in the codebase:
1. Per-route inline check (e.g., intent routes check conditions inline)
2. Middleware/guard function (e.g., Better Auth session middleware)

## Decision
Use a **pure guard function** called at the top of each mutation handler, not middleware.

The guard function takes the identity type string and returns a boolean. The route handler calls the guard and returns 403 if it fails. The guard is a pure function with no side effects.

## Alternatives Considered

### Alternative 1: Dedicated HTTP Middleware
- **What**: Add middleware layer that intercepts all POST/PATCH to /policies/* and checks identity type
- **Expected Impact**: Same enforcement, centralized
- **Why Insufficient**: Bun.serve route registration doesn't support per-path middleware chains. Would require wrapping all handlers in a higher-order function, adding indirection without benefit. Existing patterns (learning routes, intent routes) use inline checks.

### Alternative 2: SurrealDB PERMISSIONS
- **What**: Define PERMISSIONS on the policy table to enforce read-only for agent identities
- **Expected Impact**: Database-level enforcement
- **Why Insufficient**: App uses root credentials for all DB operations (no per-user Surreal sessions). PERMISSIONS would require session-scoped auth, which is not the current architecture. Would also prevent legitimate server-side policy operations (e.g., observer reading policies).

## Consequences
- **Positive**: Pure function, trivially testable, follows existing codebase patterns, no infrastructure changes
- **Positive**: Guard function is reusable for future features needing human-only enforcement
- **Negative**: Must remember to call guard in each mutation handler (not centralized)
- **Mitigation**: Route handler factory pattern groups all handlers -- guard call is visible in one file
