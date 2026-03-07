# UI Walking Skeleton -- Coding Agent Orchestrator

## Purpose

The UI walking skeleton proves that a user can accomplish the core agent delegation journey across all three surfaces: assign from the task popup, monitor via the governance feed, and review/accept in the review view.

This is the minimal E2E path through the UI layer. It touches all three surfaces as a consequence of the user journey, not as a design goal. Backend orchestrator lifecycle is already covered by existing walking skeletons in `tests/acceptance/coding-agent-orchestrator/`.

## Skeleton Scenarios

### Skeleton 1: Assign from Popup, Monitor in Feed, Accept in Review View

**User goal**: "I want to assign a task from the graph, get notified when it is done, and accept the result in one flow."

```
Given a task is visible in the graph with status "ready"
When I open the task popup
Then I see an "Assign to Agent" button

When I assign the task to an agent
Then the popup shows a status badge "Agent working"
And the popup shows a file change counter

When the agent completes its work
Then the governance feed shows a review-ready item for the task
And the task popup shows a "Review" button

When I open the review view from the feed
Then I see the task title and files changed
And I see accept and reject options

When I accept the agent's work
Then the review view shows a success confirmation
And the task status changes to "done"
```

**Stakeholder demo**: Yes -- shows the complete three-surface journey from delegation through acceptance.

**File**: `tests/acceptance/orchestrator-ui/walking-skeleton.feature`

### Skeleton 2: Assign and Reject with Feedback

**User goal**: "I want to review agent work and send it back for changes, then see the agent resume."

```
Given a task with completed agent work ready for review
When I open the review view
And I reject the work with feedback "Please add input validation"
Then the review view shows the agent is working again
And the task popup status badge updates to "Agent working"
```

**Stakeholder demo**: Yes -- shows the feedback loop that makes agent delegation iterative.

**File**: `tests/acceptance/orchestrator-ui/walking-skeleton.feature`

### Skeleton 3: Agent Error Appears as Blocking Feed Item

**User goal**: "When something goes wrong with the agent, I want to know immediately via the feed without monitoring the popup."

```
Given a task is assigned to an agent
When the agent encounters an error
Then the governance feed shows a blocking item for the task
And the blocking item explains what went wrong
```

**Stakeholder demo**: Yes -- shows the error escalation path that prevents silent failures.

**File**: `tests/acceptance/orchestrator-ui/walking-skeleton.feature`

## Litmus Test Results

| Criterion | Skeleton 1 | Skeleton 2 | Skeleton 3 |
|-----------|-----------|-----------|-----------|
| Title describes user goal? | Yes: assign, monitor, accept across surfaces | Yes: reject and iterate | Yes: error visibility |
| Given/When use user actions? | Yes: open popup, assign, open review, accept | Yes: open review, reject with feedback | Yes: (agent error is system event, user observes via feed) |
| Then use user observations? | Yes: badge, feed item, review content, success | Yes: agent working again, badge update | Yes: blocking feed item, error explanation |
| Stakeholder confirms value? | Yes | Yes | Yes |

## What is NOT in the UI Skeleton

- SSE connection internals (tested indirectly via observable badge/counter updates)
- Feed polling mechanics (tested indirectly via feed item appearance)
- Diff rendering details (deferred to focused agent-review-view scenarios)
- Entity detail API response shape (backend concern, already tested)
- Agent session database records (backend concern, already tested)

## Relationship to Backend Walking Skeletons

The backend walking skeletons (`tests/acceptance/coding-agent-orchestrator/walking-skeleton.test.ts`) verify the API-level assign-monitor-accept flow. The UI walking skeletons verify that the same flow is accessible and observable through the three UI surfaces. There is intentional overlap at the accept/reject API boundary -- this is the seam where UI tests invoke the same driving ports as backend tests, but assert UI-observable outcomes.
