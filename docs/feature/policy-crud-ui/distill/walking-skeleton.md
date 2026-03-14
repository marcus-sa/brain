# Policy CRUD UI -- Walking Skeletons

## What Makes These Walking Skeletons

Each skeleton traces a thin vertical slice delivering observable user value end-to-end. They answer: "Can a user accomplish this goal and see the result?"

All 5 skeletons pass the litmus test:
1. Title describes a user goal, not a technical flow
2. Given/When describe user actions, not system state
3. Then describe what the user observes, not internal side effects
4. A non-technical stakeholder would confirm "yes, that is what users need"

## Skeleton 1: Admin Lists Workspace Policies (Milestone 1, Scenario 1.7)

**User goal**: An organization admin sees all governance policies in their workspace to understand current governance posture.

```
Given a workspace with draft and active policies
When admin requests the policy list
Then both policies are returned with title, status, version, and rule count
```

**E2E path**: Browser -> GET /policies -> policy-route -> listWorkspacePolicies query -> SurrealDB -> JSON response

**Why first**: The list view is the entry point for all policy management. Without it, no other capability is reachable.

## Skeleton 2: Admin Creates a Draft Policy (Milestone 2, Scenario 2.1)

**User goal**: An admin creates a new governance policy to control agent behavior, starting as a draft for review before activation.

```
Given an admin in a workspace
When admin creates a policy with a deploy-blocking rule
Then the policy is created as a draft at version 1
And the policy detail shows the rule and its configuration
```

**E2E path**: Browser -> POST /policies -> identity guard -> validation -> createPolicy query -> SurrealDB -> 201

**Why second**: Creating policies is the fundamental write operation. All lifecycle and version scenarios depend on policy creation working.

## Skeleton 3: Admin Activates a Draft Policy (Milestone 3, Scenario 3.1)

**User goal**: An admin activates a reviewed policy so it governs agent behavior going forward.

```
Given a draft policy with rules
When admin activates the policy
Then the policy status is active
And governance edges are created linking the policy to the workspace
```

**E2E path**: Browser -> PATCH /activate -> identity guard -> precondition check -> activatePolicy (transaction: status + edges) -> SurrealDB -> 200

**Why third**: Activation is the transition from "configured" to "governing." Without it, policies exist but have no effect on agent authorization.

## Skeleton 4: Admin Views Full Policy Details (Milestone 4, Scenario 4.1)

**User goal**: An admin inspects a policy's complete configuration, governance relationships, and version history to understand its scope and lineage.

```
Given a policy with description, selector, rules, and settings
When admin requests the policy detail
Then the full record is returned including rules, selector, and metadata
And edges show which identities and workspaces are governed
And version history shows the policy's lineage
```

**E2E path**: Browser -> GET /policies/:id -> getPolicyById + getPolicyEdges + getVersionChain -> SurrealDB -> JSON

**Why fourth**: The detail view is where admins make activation, deprecation, and versioning decisions. It must be complete before lifecycle actions are useful.

## Skeleton 5: Admin Creates a New Version from Active Policy (Milestone 5, Scenario 5.1)

**User goal**: An admin evolves an active policy by creating a new draft version that inherits the current configuration, without disrupting the active policy.

```
Given an active policy at version 1 with rules and settings
When admin creates a new version
Then a new draft at version 2 is created
And all rules, selector, and settings are copied from version 1
And the new version references version 1 as its predecessor
```

**E2E path**: Browser -> POST /versions -> identity guard -> precondition check (active) -> read source policy -> createPolicy (version + 1, supersedes) -> SurrealDB -> 201

**Why fifth**: Versioning enables policy evolution without downtime. The "create draft from active, review, then activate to supersede" workflow is the core governance iteration loop.

## First Skeleton to Implement

**Skeleton 1 (Admin Lists Workspace Policies)** is the starting signal for implementation. It is the simplest user journey and the entry point for all other capabilities. When this test passes, the software crafter has proven:

- Route handler factory is wired
- SurrealDB query layer connects
- Session authentication works for the policy endpoints
- JSON serialization round-trips correctly

Every subsequent skeleton builds on this foundation.
