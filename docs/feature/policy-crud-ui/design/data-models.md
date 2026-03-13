# Policy CRUD UI -- Data Models

## API Wire Formats

### GET /api/workspaces/:wsId/policies

**Query parameters:**
- `status?`: string -- filter by policy status

**Response 200:**
```typescript
{
  policies: Array<{
    id: string              // raw UUID (no table prefix)
    title: string
    status: PolicyStatus    // "draft" | "testing" | "active" | "deprecated" | "superseded"
    version: number
    rules_count: number     // computed from rules.length
    human_veto_required: boolean
    created_at: string      // ISO 8601
    updated_at?: string     // ISO 8601
  }>
}
```

### GET /api/workspaces/:wsId/policies/:id

**Response 200:**
```typescript
{
  policy: {
    id: string
    title: string
    description?: string
    version: number
    status: PolicyStatus
    selector: {
      workspace?: string
      agent_role?: string
      resource?: string
    }
    rules: Array<{
      id: string
      condition: RuleCondition    // single predicate or predicate array (AND)
      effect: "allow" | "deny"
      priority: number
    }>
    human_veto_required: boolean
    max_ttl?: string
    supersedes?: string           // raw policy ID
    created_at: string
    updated_at?: string
  }
  edges: {
    governing: Array<{
      identity_id: string
      created_at: string
    }>
    protects: Array<{
      workspace_id: string
      created_at: string
    }>
  }
  version_chain: Array<{
    id: string
    version: number
    status: PolicyStatus
    created_at: string
  }>
}
```

### POST /api/workspaces/:wsId/policies

**Request body:**
```typescript
{
  title: string               // required, non-empty
  description?: string
  selector?: {
    workspace?: string
    agent_role?: string
    resource?: string
  }
  rules: Array<{              // required, >=1 item
    id: string                // client-generated rule ID
    condition: RuleCondition
    effect: "allow" | "deny"
    priority: number
  }>
  human_veto_required?: boolean   // defaults false
  max_ttl?: string
}
```

**Response 201:**
```typescript
{
  policy_id: string
}
```

**Error 400:**
```typescript
{ error: "title is required" }
{ error: "at least one rule is required" }
```

**Error 403:**
```typescript
{ error: "agents cannot modify policies" }
```

### PATCH /api/workspaces/:wsId/policies/:id/activate

**No request body required.**

**Response 200:**
```typescript
{ status: "active" }
```

**Error 409:**
```typescript
{ error: "policy must be in draft or testing status to activate" }
{ error: "policy must have at least one rule to activate" }
```

### PATCH /api/workspaces/:wsId/policies/:id/deprecate

**No request body required.**

**Response 200:**
```typescript
{ status: "deprecated" }
```

**Error 409:**
```typescript
{ error: "only active policies can be deprecated" }
```

### PATCH /api/workspaces/:wsId/policies/:id/testing

**No request body required.**

**Response 200:**
```typescript
{ status: "testing" }
```

**Error 409:**
```typescript
{ error: "only draft policies can move to testing" }
```

### POST /api/workspaces/:wsId/policies/:id/versions

**No request body required** (copies from source policy).

**Response 201:**
```typescript
{
  policy_id: string     // new version's ID
  version: number       // incremented version number
}
```

**Error 409:**
```typescript
{ error: "only active policies can be versioned" }
```

### GET /api/workspaces/:wsId/policies/:id/versions

**Response 200:**
```typescript
{
  versions: Array<{
    id: string
    version: number
    status: PolicyStatus
    title: string
    rules_count: number
    created_at: string
  }>
}
```

## Policy Trace Rendering Model

The policy trace data already exists on intent evaluation records. No new API endpoint needed -- the consent page already fetches intent data.

```typescript
// Already persisted on intent.evaluation.policy_trace[]
type PolicyTraceEntry = {
  policy_id: string        // raw policy ID
  policy_version: number
  rule_id: string
  effect: "allow" | "deny"
  matched: boolean
  priority: number
}

// UI rendering model (computed client-side)
type PolicyTraceSummary = {
  total_rules: number
  matched_rules: number
  deny_matched: boolean
  entries: PolicyTraceEntry[]
}
```

## Version Diff Model

Computed client-side by comparing two PolicyDetail records.

```typescript
type FieldDiff = {
  field: string                      // e.g., "title", "rules", "selector.agent_role"
  type: "added" | "removed" | "changed" | "unchanged"
  old_value?: unknown
  new_value?: unknown
}

type VersionDiff = {
  from_version: number
  to_version: number
  changes: FieldDiff[]
}
```

**Diff targets** (fields compared):
- title, description, selector (deep compare), rules (array diff by rule.id), human_veto_required, max_ttl

**Rules array diff strategy:**
- Match by rule.id
- New rule.id = added
- Missing rule.id = removed
- Same rule.id with different condition/effect/priority = changed

## Status Transition Map

```typescript
const VALID_TRANSITIONS: Record<PolicyStatus, PolicyStatus[]> = {
  draft:      ["testing", "active"],
  testing:    ["active"],
  active:     ["deprecated", "superseded"],
  deprecated: [],
  superseded: [],
}
```

## Predicate Autocomplete Fields

Static list derived from IntentEvaluationContext type:

```typescript
const EVALUATION_CONTEXT_FIELDS = [
  "goal",
  "reasoning",
  "priority",
  "requester_type",
  "requester_role",
  "action_spec.provider",
  "action_spec.action",
  "action_spec.params",
  "budget_limit.amount",
  "budget_limit.currency",
  "authorization_details",
] as const;
```

Operators from RulePredicate type:
```typescript
const PREDICATE_OPERATORS = [
  "eq", "neq", "lt", "lte", "gt", "gte", "in", "not_in", "exists"
] as const;
```
