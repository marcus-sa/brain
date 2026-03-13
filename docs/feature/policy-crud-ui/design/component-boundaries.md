# Policy CRUD UI -- Component Boundaries

## Server Components

### policy-route.ts (NEW)
- **Responsibility**: Route handler factory for all policy CRUD endpoints
- **Pattern**: Follows `learning-route.ts` factory pattern exactly
- **Endpoints**:
  - `GET /api/workspaces/:wsId/policies` -- list with status filter
  - `GET /api/workspaces/:wsId/policies/:id` -- detail with edges and version chain
  - `POST /api/workspaces/:wsId/policies` -- create draft policy
  - `PATCH /api/workspaces/:wsId/policies/:id/activate` -- activate policy
  - `PATCH /api/workspaces/:wsId/policies/:id/deprecate` -- deprecate policy
  - `PATCH /api/workspaces/:wsId/policies/:id/testing` -- move to testing
  - `POST /api/workspaces/:wsId/policies/:id/versions` -- create new version
  - `GET /api/workspaces/:wsId/policies/:id/versions` -- version history
- **Dependencies**: policy-queries.ts, identity guard, workspace-scope.ts, http/response.ts

### policy-queries.ts (EXTEND)
- **Existing functions** (no changes): createPolicy, activatePolicy, deprecatePolicy, loadActivePolicies, createPolicyAuditEvent
- **New functions**:
  - `listWorkspacePolicies(surreal, workspaceRecord, statusFilter?)` -- SELECT with optional status filter, ordered by updated_at DESC
  - `getPolicyById(surreal, policyId)` -- single record by ID
  - `getPolicyEdges(surreal, policyId)` -- governing + protects edges
  - `getVersionChain(surreal, policyId)` -- traverse supersedes chain (both directions)
  - `createPolicyVersion(surreal, params)` -- copy fields, increment version, set supersedes
  - `supersedePolicyOnActivation(surreal, oldPolicyId, newPolicyId, creatorId, workspaceId)` -- atomic: activate new + supersede old + create edges

### Identity Guard (NEW, pure function)
- **Responsibility**: Check if requesting identity is human type
- **Location**: Within policy-route.ts or extracted to shared utility
- **Input**: identity record (from session/auth middleware)
- **Output**: boolean (can mutate)
- **Rule**: identity.type === "human" -> allowed; "agent" | "system" -> 403

### Policy Validation (NEW, pure functions)
- **Responsibility**: Validate request bodies and preconditions
- **Functions**:
  - Validate create body (title required, rules array)
  - Validate status transition (current status -> target status)
  - Validate activation preconditions (>=1 rule, draft|testing)
  - Validate version preconditions (active status)
- **No side effects**: Pure functions returning validation result

## Client Components

### Pages

#### PoliciesPage (NEW)
- **Route**: `/policies`
- **Pattern**: Follows LearningsPage structure
- **Composition**: StatusTabs + PolicyFilters + PolicyTable + CreatePolicyDialog + lifecycle dialogs
- **Data**: usePolicies() hook for list + filters
- **Actions**: create, activate, deprecate, navigate to detail

#### PolicyDetailPage (NEW)
- **Route**: `/policies/$policyId`
- **Composition**: PolicyHeader + RulesList + PolicyEdges + VersionHistory
- **Data**: usePolicy(id) hook for detail, usePolicyVersions(id) for version chain
- **Actions**: activate, deprecate, create version, navigate to version

### Presentational Components

#### PolicyTable (NEW)
- **Responsibility**: Sortable table of policies
- **Columns**: Title, Status, Version, Rules count, Created, Updated
- **Interactions**: Row click -> detail, status badge colors

#### PolicyStatusTabs (NEW)
- **Responsibility**: Status filter tabs with counts
- **Tabs**: All, Draft, Testing, Active, Deprecated, Superseded
- **Pattern**: Reuse StatusTabs pattern from learning library

#### RuleBuilder (NEW)
- **Responsibility**: Add/edit/remove rules in policy create/version forms
- **Sub-components**:
  - PredicateRow: field autocomplete + operator dropdown + value input
  - RuleCard: condition (single/AND group) + effect (allow/deny) + priority
  - HumanReadablePreview: renders predicate as readable sentence
- **Field autocomplete source**: Static list from IntentEvaluationContext type fields
  - Top-level: goal, reasoning, priority, requester_type, requester_role
  - Nested: action_spec.provider, action_spec.action, budget_limit.amount, etc.
- **Operator list**: Derived from RulePredicate.operator type

#### PolicyTraceView (NEW)
- **Responsibility**: Render policy_trace[] from intent evaluation
- **Location**: Embedded in consent-page.tsx
- **States**:
  - Collapsed: summary line ("3 rules evaluated, 1 deny matched")
  - Expanded: table with rule_id, effect, matched (boolean), priority, policy link
- **Interactions**: Click row -> navigate to /policies/:policyId

#### VersionTimeline (NEW)
- **Responsibility**: Render version chain as timeline
- **Data**: Array of { version, status, created_at, policyId }
- **Interactions**: Click version -> navigate or trigger diff view

#### VersionDiffView (NEW)
- **Responsibility**: Structured diff between two policy versions
- **Computed client-side**: Compare two PolicyRecord objects
- **Diff targets**: title, description, selector, rules[], human_veto_required, max_ttl
- **Rendering**: Side-by-side or inline diff with added/removed/changed indicators

### Hooks

#### usePolicies()
- Fetches GET /api/workspaces/:wsId/policies with optional status filter
- Returns: { policies, isLoading, error, filters, setFilters, refresh }

#### usePolicy(id)
- Fetches GET /api/workspaces/:wsId/policies/:id
- Returns: { policy, edges, isLoading, error, refresh }

#### usePolicyVersions(id)
- Fetches GET /api/workspaces/:wsId/policies/:id/versions
- Returns: { versions, isLoading, error }

#### usePolicyActions()
- Mutation functions: create, activate, deprecate, createVersion
- Returns: { create, activate, deprecate, createVersion, isSubmitting }

## Shared Types (shared/contracts.ts additions)

### API Response Types
- PolicyListItem: { id, title, status, version, rules_count, created_at, updated_at }
- PolicyDetail: full record + edges + version chain
- PolicyCreateBody: { title, description?, selector?, rules, human_veto_required?, max_ttl? }
- PolicyEdge: { type: "governing" | "protects", target_id, target_table, created_at }

### Constants
- POLICY_STATUSES: readonly array of valid statuses
- POLICY_STATUS_TRANSITIONS: map of valid transitions
- PREDICATE_OPERATORS: readonly array of operator values
- EVALUATION_CONTEXT_FIELDS: readonly array of autocomplete field paths

## File Inventory (estimated production files)

| Layer | New Files | Extended Files |
|-------|-----------|----------------|
| Server | policy-route.ts | policy-queries.ts, start-server.ts |
| Shared | -- | contracts.ts |
| Client | policies-page.tsx, policy-detail-page.tsx | router.tsx, WorkspaceSidebar.tsx, consent-page.tsx |
| Client components | PolicyTable, PolicyStatusTabs, RuleBuilder, PolicyTraceView, VersionTimeline, VersionDiffView | -- |
| Client hooks | use-policies.ts, use-policy.ts, use-policy-versions.ts, use-policy-actions.ts | -- |
| CSS | -- | styles.css |

**Estimated production files**: ~14 new + ~5 extended = ~19 touched files
