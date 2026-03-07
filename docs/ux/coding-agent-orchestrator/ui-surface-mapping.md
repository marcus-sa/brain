# UI Surface Mapping: Hybrid Agent Delegation Pattern

**Decision:** Agent delegation uses three UI surfaces, each handling a distinct concern.

## Surface 1: Task Popup (EntityDetailPanel)

**Role:** Delegation trigger + status at-a-glance

**What it shows by agent state:**

| Agent State | Panel Shows |
|-------------|-------------|
| No session | "Assign to Agent" button (visible for tasks with status `ready` or `todo`) |
| `spawning` | Spinner + "Starting agent..." |
| `active` | Status badge "Agent working" + files changed count + elapsed time |
| `idle` | Status badge "Review ready" + "Review" button (opens Review View) |
| `completed` | Status badge "Agent done" + merge summary |
| `error` | Status badge "Agent error" + error message + "Retry" button |
| `aborted` | Status badge "Aborted" + reason |

**What it does NOT show:**
- Full diff
- Agent logs/reasoning
- Rejection feedback form

**Interaction:**
- Clicking "Assign to Agent" calls `POST /api/orchestrator/:ws/assign`
- Clicking "Review" navigates to the Review View
- Status badge updates in real-time via SSE `agent_status` events
- File count updates via SSE `agent_file_change` events

---

## Surface 2: Governance Feed (GovernanceFeed)

**Role:** Human-attention-needed notifications only

**What appears in the feed:**

| Event | Feed Tier | Reason Text | Actions |
|-------|-----------|-------------|---------|
| Agent idle (review ready) | `review` | "Agent completed work on '{task.title}' -- review ready" | Review, Abort |
| Agent stalled | `blocking` | "Agent stalled on '{task.title}' ({stallDurationSeconds}s inactive)" | Abort, Discuss |
| Agent error | `blocking` | "Agent failed on '{task.title}': {error_message}" | Retry, Discuss |
| Agent raised question | `review` | "Agent question on '{task.title}': {observation.text}" | Discuss |

**What does NOT appear:**
- Agent started (operational, not governance)
- Agent file changes (too noisy)
- Agent completed + accepted (already resolved)

**Entity kind:** Feed items use `entityKind: "task"` (not a new `agent_session` kind). The task itself is the governance entity; the agent session is an implementation detail. Feed items link to the task, and the task popup shows the agent status.

---

## Surface 3: Agent Review View (new component)

**Role:** Full review experience for accepting/rejecting agent work

**Entry points:**
- "Review" button in task popup (Surface 1)
- "Review" action in feed item (Surface 2)
- Direct URL: `/workspace/:ws/review/:sessionId`

**What it shows:**
```
+------------------------------------------------------------------+
| Review: Fix login bug                              [Accept] [Reject] |
+------------------------------------------------------------------+
| Agent Summary                                                      |
|   "Added input validation to login form, updated tests..."        |
+------------------------------------------------------------------+
| Files Changed (3 files, +47 -12)                                  |
|   [+] src/auth/login.ts          (+32 -8)                        |
|   [+] tests/auth/login.test.ts   (+15 -0)                        |
|   [~] src/auth/types.ts          (+0 -4)                          |
|                                                                    |
|   [Expandable unified diff per file]                              |
+------------------------------------------------------------------+
| Agent Activity                                                     |
|   - Read project context via MCP                                  |
|   - Modified src/auth/login.ts                                    |
|   - Created tests/auth/login.test.ts                              |
|   - Ran tests (passed)                                            |
+------------------------------------------------------------------+
| Session Info                                                       |
|   Branch: agent/fix-login-bug                                     |
|   Duration: 3m 12s                                                |
|   Decisions: 0 | Questions: 0 | Observations: 1                  |
+------------------------------------------------------------------+
```

**Accept flow:**
1. User clicks "Accept"
2. `POST /api/orchestrator/:ws/sessions/:sessionId/accept`
3. Platform merges branch, removes worktree, marks task `done`
4. Review view shows success state, navigates back to graph

**Reject flow:**
1. User clicks "Reject"
2. Feedback textarea appears
3. User enters feedback, clicks "Send"
4. `POST /api/orchestrator/:ws/sessions/:sessionId/reject` with feedback body
5. Agent resumes in same worktree
6. Review view transitions to monitoring state (agent working again)

---

## SSE Event Routing

| SSE Event | Surface 1 (Task Popup) | Surface 2 (Feed) | Surface 3 (Review View) |
|-----------|----------------------|------------------|------------------------|
| `agent_status` -> active | Update badge | -- | Show "Agent working..." |
| `agent_status` -> idle | Update badge + show "Review" | Add review item | Enable Accept/Reject |
| `agent_status` -> completed | Update badge | Remove item | Show success |
| `agent_status` -> error | Update badge + show error | Add blocking item | Show error |
| `agent_file_change` | Increment counter | -- | Update file list |
| `agent_token` | -- | -- | Append to activity log |
| `agent_stall_warning` | Show warning icon | Add blocking item | Show stall warning |

---

## Design Rationale

**Why not everything in the task popup?**
The review flow (reading diffs, writing rejection feedback) is a heavy interaction. The EntityDetailPanel is a lightweight inspector -- forcing a full code review into it would require either a full-screen takeover (breaking its role) or cramming too much into a side panel.

**Why not agent_session as a new feed entity kind?**
The feed is governance-scoped: "things that need human decision." The task is the governance entity. Whether it was done by a human or an agent doesn't change what needs attention. Surfacing the task with agent-specific reasons keeps the feed clean and avoids a proliferation of entity kinds.

**Why a separate Review View?**
Code review is a distinct cognitive mode. The user needs screen real estate for diffs, needs to read agent reasoning alongside code, and needs to compose feedback. This deserves a dedicated view, not a panel or modal. The review endpoint (`GET .../review`) already returns the data shape for this view.
