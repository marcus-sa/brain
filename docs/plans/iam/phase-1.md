# IAM Phase 1: MVP — Ship Now

**Goal:** Basic identity that doesn't block anything else. API key for dogfooding, OAuth-ready architecture.

**Status:** Done.

## What's Done

- [x] Person table evolved with auth fields (`contact_email`, `email_verified`, `image`, `updated_at`)
- [x] better-auth integrated with custom SurrealDB v2 adapter
- [x] GitHub OAuth provider configured (sign-in redirect, account linking)
- [x] Session, account, verification tables created
- [x] Account linking works (existing person + new OAuth provider)
- [x] 17 integration tests passing
- [x] Identity resolution — exact provider match + case-insensitive email match (`app/src/server/iam/identity.ts`)
- [x] Authority scopes — `authority_scope` table with 5 agent types × 9 actions, workspace-specific overrides (`schema/migrations/0011_authority_scope.surql`)
- [x] Authority enforcement in chat tools — `requireAuthorizedContext` wrapper on all 10 write tools (`app/src/server/iam/authority.ts`)
- [x] Authority enforcement in MCP routes — `checkAuthority` + `checkAuthorityOrError` on 7 write handlers, `X-Agent-Type` header support
- [x] Web chat session auth — `humanPresent: true` bypasses authority (human IS the authority), session-resolved `personRecord`
- [x] PM agent actor propagation — `pm_agent` maps to `management` agent type
- [x] Extraction pipeline name resolution — composite resolver chains name match → email fallback (`resolveWorkspacePerson`)
- [x] 11 smoke tests passing (`tests/smoke/authority.test.ts`)

## Implementation Details

### Identity Resolution (exact match only)

Implemented in `app/src/server/iam/identity.ts` as app-layer queries (not SurrealDB stored functions, due to known SDK parameter binding limitations):

1. **Exact provider match** — `resolveIdentity()`: queries `person.identities` array for matching provider + id, scoped to workspace via `member_of` edge
2. **Email match (cross-provider)** — `resolveByEmail()`: case-insensitive `contact_email` match, scoped to workspace via `member_of` edge
3. **Composite resolver** — `resolveWorkspacePerson()` in `app/src/server/extraction/person.ts`: chains exact name match → email fallback (if input contains `@`)

No fuzzy matching in Phase 1. Unresolved names stored as string attributes on entities.

### MCP Auth (API key — dogfooding only)

API key maps to workspace + agent type. `X-Agent-Type` header (default `"code_agent"`) controls authority scoping. Authorization enforced via `checkAuthority` before each write handler. Swapping to OAuth later means changing token validation, not rewriting authorization.

### Authority Scopes (seeded defaults)

Seeded in `schema/migrations/0011_authority_scope.surql` as 45 rows (5 agent types × 9 actions). Workspace-specific overrides supported via nullable `workspace` field (enables Phase 2 config UI without schema changes).

| Action | Code Agent | Architect | Management | Design Partner | Observer |
|--------|-----------|-----------|------------|----------------|----------|
| create_decision | provisional | provisional | provisional | provisional | blocked |
| confirm_decision | blocked | blocked | blocked | blocked | blocked |
| create_task | auto | auto | auto | provisional | blocked |
| complete_task | auto | blocked | auto | blocked | blocked |
| create_observation | auto | auto | auto | auto | auto |
| acknowledge_observation | auto | auto | auto | auto | blocked |
| resolve_observation | blocked | auto | auto | blocked | blocked |
| create_question | auto | auto | auto | auto | auto |
| create_suggestion | auto | auto | auto | auto | blocked |

Permission levels: **auto** (done, shown in feed), **provisional** (done as draft, needs review), **propose** (proposed, needs approval), **blocked** (cannot do).

### Authority Enforcement

- **Chat tools**: `requireAuthorizedContext(options, action, deps)` wraps `requireToolContext`, bypasses for `humanPresent === true`, maps actor to agent type, throws `AuthorityError` for blocked/propose
- **MCP routes**: `checkAuthority()` + `checkAuthorityOrError()` returns 403 for blocked/propose
- **Fail-safe**: no matching authority_scope row → `"blocked"`

### Web Chat Authentication

Web chat requests set `humanPresent: true` on tool context — authority checks return `"auto"` (human at screen IS the authority). Session cookie resolved via `better-auth` to `personRecord` for attribution.

### Platform-Managed Agent Auth

`AgentType` union: `"code_agent" | "architect" | "management" | "design_partner" | "observer"`. Actor-to-agent mapping: `pm_agent → management`, `analytics_agent → observer`, default `code_agent`.

### GitHub OAuth Connection Flow

```
1. Human clicks "Connect GitHub" in workspace settings
2. OAuth redirect → GitHub authorizes → callback with user ID + email + username
3. System checks:
   a. GitHub email matches existing Person? → auto-link (better-auth handles this)
   b. No match? → link to currently logged-in Person
4. Account record created with provider_id: "github", account_id: GitHub user ID
5. OAuth tokens stored for API access
```

## What This Unblocks

- Git commit attribution (post-commit hook → resolve author email → link to Person)
- MCP tool authorization (coding agent can't confirm decisions)
- Cross-source queries ("show me Marcus's commits and decisions this week")
- Phase 2: authority config UI (workspace-specific overrides already supported in schema)
- Phase 2: OAuth 2.1 for MCP (swap token validation, authorization logic unchanged)
