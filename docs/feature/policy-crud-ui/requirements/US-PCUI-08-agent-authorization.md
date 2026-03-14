# US-PCUI-08: Agent Authorization for Policy Endpoints

## Problem
The policy API endpoints must enforce that only human identities can mutate policies (create, activate, deprecate, version), while agent identities can read them. Without this gate, a compromised or misconfigured agent could modify its own governance rules -- defeating the purpose of the policy system.

## Who
- Agent Identity | MCP / API client | Should be able to read policies but not modify them
- Human Identity | Web browser | Should have full CRUD access to policies in their workspace

## Solution
Identity type check at the route handler level: read endpoints (GET) allow all authenticated identities, mutation endpoints (POST, PATCH) reject agent identities with 403.

## Job Story Trace
- Job 2: Manage Policy Lifecycle (Authorization requirement FR-8)

## Domain Examples
### 1: Happy Path -- Human creates a policy
Reiko Tanaka (human identity, member_of workspace "acme-corp") sends POST /api/workspaces/acme-corp/policies with valid policy data. The request succeeds with 201.

### 2: Agent reads policies (allowed)
architect-agent (agent identity, member_of workspace "acme-corp") sends GET /api/workspaces/acme-corp/policies. The request succeeds with 200 and returns the policy list.

### 3: Agent attempts mutation (denied)
architect-agent sends POST /api/workspaces/acme-corp/policies. The request is rejected with 403: "Agent identities cannot modify policies."

### 4: Agent attempts activation (denied)
code-agent sends PATCH /api/workspaces/acme-corp/policies/finance-001/activate. The request is rejected with 403.

## UAT Scenarios (BDD)

### Scenario: Human identity can create a policy
Given Reiko Tanaka is a human identity and member_of workspace "acme-corp"
When she sends POST /api/workspaces/acme-corp/policies with valid policy data
Then the response is 201
And a policy is created in draft status

### Scenario: Agent identity can list policies
Given "architect-agent" is an agent identity and member_of workspace "acme-corp"
When the agent sends GET /api/workspaces/acme-corp/policies
Then the response is 200
And the body contains the policy list

### Scenario: Agent identity cannot create policies
Given "architect-agent" is an agent identity
When the agent sends POST /api/workspaces/acme-corp/policies
Then the response is 403
And the body contains "Agent identities cannot modify policies"

### Scenario: Agent identity cannot activate policies
Given "code-agent" is an agent identity
When the agent sends PATCH /api/workspaces/acme-corp/policies/finance-001/activate
Then the response is 403

### Scenario: Agent identity cannot deprecate policies
Given "architect-agent" is an agent identity
When the agent sends PATCH /api/workspaces/acme-corp/policies/finance-001/deprecate
Then the response is 403

### Scenario: Non-member identity cannot access policies
Given "external-user" is a human identity NOT member_of workspace "acme-corp"
When they send GET /api/workspaces/acme-corp/policies
Then the response is 401 or 403

## Acceptance Criteria
- [ ] GET endpoints (list, detail) return 200 for both human and agent identities
- [ ] POST endpoints (create, version) return 403 for agent identities
- [ ] PATCH endpoints (activate, deprecate) return 403 for agent identities
- [ ] 403 response includes descriptive error message
- [ ] Authorization check happens at route handler level (before business logic)
- [ ] Non-member identities cannot access any policy endpoint for a workspace

## Technical Notes
- Check identity.type from the session/DPoP context
- For web UI requests: Better Auth session provides identity type
- For MCP requests: DPoP token contains identity, middleware resolves type
- Follow existing authorization patterns from intent-routes.ts
- Acceptance tests using createTestUserWithMcp() for agent identity scenarios
- 0.5-1 day effort
