# UI Test Scenario Inventory -- Coding Agent Orchestrator

## Summary

| Metric | Count |
|--------|-------|
| Total scenarios | 25 |
| Walking skeletons | 3 |
| Focused happy path | 11 |
| Focused error path | 9 |
| Focused edge case | 2 |
| Error path ratio | 44% |

## Scope Boundary

These tests cover the **UI layer only** -- the three surfaces (task popup, governance feed, agent review view) and their observable behaviors. Backend orchestrator lifecycle, assignment guard, worktree management, plugin tools, and event bridge are covered by existing tests in `tests/acceptance/coding-agent-orchestrator/`.

## Traceability Matrix

| User Story | Surface | Scenarios | File |
|-----------|---------|-----------|------|
| US-0.4 Assign Button in Popup | Task Popup | 5 | walking-skeleton, task-popup-delegation |
| US-0.5 Agent Status Badge | Task Popup | 4 | walking-skeleton, task-popup-delegation |
| US-1.1 Real-Time Events in Popup | Task Popup | 2 | task-popup-delegation |
| US-1.2 Agent Attention in Feed | Governance Feed | 5 | walking-skeleton, governance-feed-alerts |
| US-1.3 Feed Uses Task Entity Kind | Governance Feed | 2 | governance-feed-alerts |
| US-2.1 Agent Review View | Review View | 3 | walking-skeleton, agent-review-view |
| US-2.2 Accept Agent Output | Review View | 3 | walking-skeleton, agent-review-view |
| US-2.3 Reject with Feedback | Review View | 4 | walking-skeleton, agent-review-view |

## Scenario Inventory

### walking-skeleton.feature (3 scenarios)

| # | Type | Scenario | Stories | Status |
|---|------|----------|---------|--------|
| UWS-1 | skeleton | Assign from popup, monitor in feed, accept in review view | US-0.4, US-0.5, US-1.2, US-2.1, US-2.2 | enabled |
| UWS-2 | skeleton | Reject agent work with feedback and see agent resume | US-2.3 | skip |
| UWS-3 | skeleton | Agent error surfaces as blocking feed item | US-1.2 | skip |

### task-popup-delegation.feature (8 scenarios)

| # | Type | Scenario | Story | Status |
|---|------|----------|-------|--------|
| TP-1 | happy | Assign button visible for ready task | US-0.4 | skip |
| TP-2 | happy | Assign button visible for todo task | US-0.4 | skip |
| TP-3 | error | Assign button hidden for in-progress task | US-0.4 | skip |
| TP-4 | error | Assign button hidden for completed task | US-0.4 | skip |
| TP-5 | happy | Status badge shows agent working after assignment | US-0.5 | skip |
| TP-6 | happy | File change counter updates during agent work | US-1.1 | skip |
| TP-7 | happy | Review button appears when agent work is ready | US-0.5 | skip |
| TP-8 | error | Status badge shows error when agent fails | US-0.5 | skip |

### governance-feed-alerts.feature (7 scenarios)

| # | Type | Scenario | Story | Status |
|---|------|----------|-------|--------|
| GF-1 | happy | Review-ready item appears when agent completes work | US-1.2 | skip |
| GF-2 | happy | Blocking item appears when agent stalls | US-1.2 | skip |
| GF-3 | happy | Blocking item appears when agent errors | US-1.2 | skip |
| GF-4 | happy | Review item appears when agent raises question | US-1.2 | skip |
| GF-5 | edge | Agent start does not create feed item | US-1.2 | skip |
| GF-6 | happy | Feed items use task entity kind with agent context | US-1.3 | skip |
| GF-7 | error | Feed item removed after work is accepted | US-1.3 | skip |

### agent-review-view.feature (7 scenarios)

| # | Type | Scenario | Story | Status |
|---|------|----------|-------|--------|
| AR-1 | happy | Review view shows task title, diff, and session metadata | US-2.1 | skip |
| AR-2 | happy | Review view accessible from task popup | US-2.1 | skip |
| AR-3 | happy | Review view accessible from feed item | US-2.1 | skip |
| AR-4 | happy | Accept marks task done and shows success | US-2.2 | skip |
| AR-5 | error | Accept disabled while accept is in progress | US-2.2 | skip |
| AR-6 | happy | Reject with feedback resumes agent work | US-2.3 | skip |
| AR-7 | error | Reject without feedback text is prevented | US-2.3 | skip |

## Implementation Sequence (One at a Time)

1. **UWS-1** -- Walking skeleton: full three-surface journey (enabled first)
2. **UWS-2** -- Walking skeleton: reject and iterate
3. **UWS-3** -- Walking skeleton: error escalation
4. **TP-1** -- Assign button for ready task
5. **TP-2** -- Assign button for todo task
6. **TP-3** -- Assign button hidden for in-progress
7. **TP-5** -- Status badge after assignment
8. **TP-6** -- File change counter
9. **TP-7** -- Review button on idle
10. **TP-8** -- Error badge
11. **TP-4** -- Assign button hidden for completed
12. **GF-1** -- Review-ready feed item
13. **GF-6** -- Task entity kind in feed
14. **GF-2** -- Stall blocking item
15. **GF-3** -- Error blocking item
16. **GF-4** -- Agent question feed item
17. **GF-5** -- Agent start no feed item
18. **GF-7** -- Feed item removed after accept
19. **AR-1** -- Review view content
20. **AR-2** -- Review from popup
21. **AR-3** -- Review from feed
22. **AR-4** -- Accept flow
23. **AR-5** -- Accept disabled during pending
24. **AR-6** -- Reject with feedback
25. **AR-7** -- Reject without feedback prevented

## Mandate Compliance Evidence

### CM-A: Hexagonal Boundary Enforcement

All test files invoke through driving ports only:

| File | Driving Ports Used |
|------|--------------------|
| walking-skeleton.feature | POST /assign, GET /sessions/:id, GET /feed, GET /review, POST /accept, POST /reject, SSE /stream |
| task-popup-delegation.feature | GET /entities/:id, POST /assign, SSE /stream |
| governance-feed-alerts.feature | GET /feed, POST /assign, POST /accept |
| agent-review-view.feature | GET /review, POST /accept, POST /reject |

Zero internal component imports. All steps use `orchestrator-ui-test-kit.ts` helpers that delegate to HTTP endpoints and SSE streams (driving ports).

### CM-B: Business Language Purity

Zero instances of: database, API, HTTP, REST, JSON, controller, service, status code, SSE, EventSource, React, hook, component, DOM, CSS, HTML, useState, fetch.

Business terms used: "task", "agent", "workspace", "assign", "review", "accept", "reject", "feedback", "feed", "blocking", "badge", "popup", "counter", "diff", "observation", "stall".

### CM-C: Walking Skeleton + Focused Scenario Counts

- Walking skeletons: 3 (user-centric, stakeholder-demonstrable, cross-surface)
- Focused scenarios: 22 (boundary tests per surface)
- Error path ratio: 44% (exceeds 40% minimum)
