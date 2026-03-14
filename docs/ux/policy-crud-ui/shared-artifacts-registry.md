# Policy CRUD UI -- Shared Artifacts Registry

Every `${variable}` in the journey has a single documented source.

## Artifacts

| Artifact | Type | Source Step | Consumers | Persistence | Integration Risk |
|----------|------|------------|-----------|-------------|-----------------|
| `${workspaceId}` | `string` (UUID) | URL path / workspace context | All API endpoints, all UI routes, sidebar | URL parameter | LOW |
| `${policyId}` | `string` (UUID) | `POST /api/workspaces/:wsId/policies` response | Detail view, activate, deprecate, version, diff, audit events | SurrealDB `policy` table `id` field | MEDIUM |
| `${policy}` | `PolicyRecord` | `GET /api/workspaces/:wsId/policies/:policyId` response | Detail header, rules section, options, edges, version history, action buttons | SurrealDB `policy` table | MEDIUM |
| `${policies[]}` | `PolicyRecord[]` | `GET /api/workspaces/:wsId/policies` response | List table, status filter counts, empty state check | SurrealDB query result | LOW |
| `${policyTrace[]}` | `PolicyTraceEntry[]` | `intent.evaluation.policy_trace` (persisted by authorizer) | Intent review policy trace section, "View Policy" links | `intent.evaluation.policy_trace` field | **HIGH** |
| `${versions[]}` | `PolicyRecord[]` | `GET /api/workspaces/:wsId/policies/:policyId` (includes supersedes chain) | Version timeline, diff view, compliance audit | SurrealDB `policy.supersedes` chain | MEDIUM |
| `${knownFields}` | `string[]` | `IntentEvaluationContext` type definition | Rule builder field autocomplete, validation | Compile-time constant | **HIGH** |
| `${statusCounts}` | `Record<PolicyStatus, number>` | Computed from `${policies[]}` | Status filter tabs | Transient (computed) | LOW |
| `${auditEvents[]}` | `AuditEvent[]` | `createPolicyAuditEvent()` (existing) | Compliance audit view (future) | SurrealDB `audit_event` table | LOW |

## Type Definitions

```typescript
// From app/src/server/policy/types.ts (already exists)
type PolicyRecord = {
  id: RecordId<"policy">;
  title: string;
  description?: string;
  version: number;
  status: PolicyStatus; // "draft" | "testing" | "active" | "deprecated" | "superseded"
  selector: PolicySelector;
  rules: PolicyRule[];
  human_veto_required: boolean;
  max_ttl?: string;
  created_by: RecordId<"identity">;
  workspace: RecordId<"workspace">;
  supersedes?: RecordId<"policy">;
  created_at: Date;
  updated_at?: Date;
};

// From app/src/server/policy/types.ts (already exists)
type PolicyTraceEntry = {
  policy_id: string;
  policy_version: number;
  rule_id: string;
  effect: "allow" | "deny";
  matched: boolean;
  priority: number;
};

// New: API response shapes for UI consumption
type PolicyListItem = {
  id: string;                // raw UUID (not RecordId -- API boundary)
  title: string;
  status: PolicyStatus;
  version: number;
  created_by_name: string;   // resolved from identity
  updated_at?: string;       // ISO 8601
  created_at: string;        // ISO 8601
};

type PolicyDetailResponse = {
  id: string;
  title: string;
  description?: string;
  version: number;
  status: PolicyStatus;
  selector: PolicySelector;
  rules: PolicyRule[];
  human_veto_required: boolean;
  max_ttl?: string;
  created_by: { id: string; name: string };
  created_at: string;
  updated_at?: string;
  edges: {
    governing: Array<{ identity_id: string; identity_name: string }>;
    protects: Array<{ workspace_id: string; workspace_name: string }>;
  };
  version_history: Array<{
    version: number;
    status: PolicyStatus;
    created_at: string;
    summary?: string;
  }>;
};
```

## Known Fields (IntentEvaluationContext)

The rule builder must offer exactly these fields for predicate building. This list is derived from `IntentEvaluationContext` in `app/src/server/policy/types.ts`:

| Field Path | Type | Description |
|------------|------|-------------|
| `goal` | string | Intent goal text |
| `reasoning` | string | Intent reasoning |
| `priority` | number | Intent priority level |
| `action_spec.provider` | string | Action provider (e.g., "github", "slack") |
| `action_spec.action` | string | Action name (e.g., "create_pr", "send_message") |
| `budget_limit.amount` | number | Budget amount |
| `budget_limit.currency` | string | Currency code |
| `requester_type` | string | Identity type ("human", "agent", "system") |
| `requester_role` | string | Agent role (e.g., "architect", "code_agent") |

## Data Flow

```
CREATE FLOW:
  Form inputs -> POST /api/.../policies -> createPolicy() -> SurrealDB
      |                                         |
      v                                         v
  ${policyId} returned              policy record persisted
      |
      v
  Redirect to detail view (GET /api/.../policies/${policyId})

ACTIVATION FLOW:
  Detail view "Activate" button -> PATCH /api/.../policies/${policyId}/activate
      |                                         |
      v                                         v
  Confirmation dialog              activatePolicy() -> governing + protects edges
      |                                         |
      v                                         v
  Detail refresh                   createPolicyAuditEvent()

VERSION FLOW:
  Detail view "Create New Version" -> POST /api/.../policies/${policyId}/versions
      |                                         |
      v                                         v
  Pre-populated form               New policy record with supersedes -> ${policyId}
      |
      v
  Save -> new ${policyId} (draft)

REVIEW FLOW:
  Authorizer pipeline -> intent.evaluation.policy_trace (already persisted)
      |
      v
  Intent review screen -> reads ${policyTrace[]} from intent record
      |
      v
  "View Policy" link -> navigates to GET /api/.../policies/${traceEntry.policy_id}

AUDIT FLOW:
  Policy detail -> version_history (supersedes chain traversal)
      |
      v
  "View Diff" -> compare ${versions[n]} vs ${versions[n+1]}
```

## Consistency Validation Checks

| Check | What | How |
|-------|------|-----|
| PolicyRecord shape | API responses match TypeScript types | Acceptance test: create policy, GET detail, assert all fields present |
| PolicyTraceEntry schema | Authorizer output matches UI expectations | Acceptance test: evaluate intent, fetch consent, assert policy_trace structure |
| Known fields sync | Rule builder fields match IntentEvaluationContext | Unit test: extract field paths from IntentEvaluationContext type, assert rule builder offers same set |
| Status transitions | Only valid transitions allowed | Acceptance test: attempt draft->active (OK), active->draft (rejected), active->deprecated (OK) |
| Version chain | Supersedes references form valid chain | Acceptance test: create v1, version to v2, verify v2.supersedes == v1.id |
| Authorization | Agent identities get 403 on mutations | Acceptance test: agent mcpFetch to POST/PATCH returns 403, GET returns 200 |
