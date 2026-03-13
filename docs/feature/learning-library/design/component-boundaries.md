# Learning Library -- Component Boundaries

## Directory Structure

```
app/src/client/
  routes/
    learnings-page.tsx              # NEW -- page component
  hooks/
    use-learnings.ts                # NEW -- data fetching + filter state
    use-learning-actions.ts         # NEW -- mutations (approve/dismiss/edit/deactivate/create)
    use-pending-learning-count.ts   # NEW -- sidebar badge count (lightweight poll)
  components/
    learning/
      LearningList.tsx              # NEW -- card list container
      LearningCard.tsx              # NEW -- expandable card with status-aware actions
      LearningFilters.tsx           # NEW -- type + agent filter dropdowns
      StatusTabs.tsx                # NEW -- tab bar with counts
      ApproveDialog.tsx             # NEW -- approve with text edit + collision display
      DismissDialog.tsx             # NEW -- dismiss with required reason
      EditDialog.tsx                # NEW -- edit text/type/priority/agents
      DeactivateDialog.tsx          # NEW -- confirmation dialog
      CreateDialog.tsx              # NEW -- full creation form + collision feedback
      AgentChips.tsx                # NEW -- render target agent badges
    layout/
      WorkspaceSidebar.tsx          # MODIFY -- add Learnings nav link + badge

app/src/shared/
  contracts.ts                      # MODIFY -- add KNOWN_LEARNING_TARGET_AGENTS, LearningListItem

app/src/server/
  learning/
    learning-route.ts               # MODIFY -- add handleUpdate (PUT endpoint)
    queries.ts                      # MODIFY -- add updateLearningFields function
  runtime/
    start-server.ts                 # MODIFY -- register PUT route
```

## Component Responsibilities

### Page Layer

**LearningsPage** (`routes/learnings-page.tsx`)
- Composes `useLearnings` and `useLearningActions` hooks
- Renders page header with "New" button
- Renders `StatusTabs`, `LearningFilters`, `LearningList`
- Manages dialog open/close state: `{ dialog?: { type, learning? } }`
- Renders the active dialog component conditionally
- Passes `refresh` callback from `useLearnings` to action handlers

### Hook Layer

**useLearnings** (`hooks/use-learnings.ts`)
- Pattern: `useGovernanceFeed` (useState + useEffect + fetch)
- State: `learnings`, `isLoading`, `error`, `filters` (status, type, agent), `counts`
- On mount + filter change: `GET /api/workspaces/:wsId/learnings?status=X&type=Y&agent=Z`
- Counts: fetched once on mount with no status filter, then derived. OR separate fetch per status. Decision: single unfiltered fetch for counts on mount, filtered fetch for display. Counts update on `refresh()`.
- Exposes: `{ learnings, counts, isLoading, error, filters, setFilters, refresh }`

**useLearningActions** (`hooks/use-learning-actions.ts`)
- Pattern: stateless functions that return promises
- Each function: validate params -> fetch to API -> return result
- Functions: `approve(id, newText?)`, `dismiss(id, reason)`, `edit(id, fields)`, `deactivate(id)`, `create(fields)`
- Tracks: `isSubmitting` state for loading indicators
- Does NOT call refresh -- caller does (page component chains: action -> refresh)

**usePendingLearningCount** (`hooks/use-pending-learning-count.ts`)
- Pattern: `useGovernanceFeed` polling pattern (60s interval)
- Calls `GET /api/workspaces/:wsId/learnings?status=pending_approval`
- Returns: `{ count: number, isLoading: boolean }`
- Used by `WorkspaceSidebar` for badge display

### Component Layer

**StatusTabs** (`components/learning/StatusTabs.tsx`)
- Props: `{ activeStatus, counts: Record<LearningStatus, number>, onStatusChange }`
- Renders: tab buttons for Active / Pending / Dismissed / Deactivated
- Each tab shows count badge
- Pending tab shows count in accent color when > 0

**LearningFilters** (`components/learning/LearningFilters.tsx`)
- Props: `{ type, agent, onTypeChange, onAgentChange }`
- Renders: two `<select>` dropdowns
- Type options: "All types" + LEARNING_TYPES from contracts
- Agent options: "All agents" + KNOWN_LEARNING_TARGET_AGENTS from contracts
- Pattern: follows `SearchFilters` component (chip/button style or dropdown)

**LearningList** (`components/learning/LearningList.tsx`)
- Props: `{ learnings, isLoading, onAction }`
- Renders: list of `LearningCard` components
- Empty state: different messages per tab (empty active vs empty pending vs zero learnings)
- Loading state: skeleton or loading text (follow feed pattern)

**LearningCard** (`components/learning/LearningCard.tsx`)
- Props: `{ learning: LearningListItem, isExpanded, onToggle, onAction }`
- Collapsed: text preview, type badge (`EntityBadge` reuse), priority badge, agent chips, source
- Expanded: full text, created date, metadata, action buttons
- Action buttons vary by status:
  - `active`: Edit, Deactivate
  - `pending_approval`: Approve, Dismiss (+ suggested_by + confidence display)
  - `dismissed`: view-only (shows dismiss reason + date)
  - `deactivated`: view-only (shows deactivation date)

**AgentChips** (`components/learning/AgentChips.tsx`)
- Props: `{ agents: string[] }`
- Empty array: renders "All agents" chip
- Non-empty: renders individual agent name chips with display labels from `KNOWN_LEARNING_TARGET_AGENTS`

### Dialog Layer

**ApproveDialog** (`components/learning/ApproveDialog.tsx`)
- Props: `{ learning, onConfirm, onCancel, isSubmitting }`
- Form: editable text field (pre-populated), collision warnings (fetched inline or displayed from previous check)
- Confirm button: "Approve as Active"
- Calls: `onConfirm(learningId, editedText?)`

**DismissDialog** (`components/learning/DismissDialog.tsx`)
- Props: `{ learning, onConfirm, onCancel, isSubmitting }`
- Form: required reason textarea
- Confirm button: disabled until reason non-empty
- Calls: `onConfirm(learningId, reason)`

**EditDialog** (`components/learning/EditDialog.tsx`)
- Props: `{ learning, onConfirm, onCancel, isSubmitting }`
- Form: text, type selector, priority selector, target agents checkboxes
- All fields pre-populated from learning
- Confirm button: "Save Changes"
- Calls: `onConfirm(learningId, { text?, priority?, target_agents? })`

**DeactivateDialog** (`components/learning/DeactivateDialog.tsx`)
- Props: `{ learning, onConfirm, onCancel, isSubmitting }`
- Confirmation text showing which agents are affected
- Confirm button: "Deactivate"
- Calls: `onConfirm(learningId)`

**CreateDialog** (`components/learning/CreateDialog.tsx`)
- Props: `{ onConfirm, onCancel, isSubmitting }`
- Form: text, type selector (required), priority (default medium), agent targeting (all/specific)
- Two-phase: submit -> collision check -> show warnings -> confirm or go back
- Calls: `onConfirm({ text, learning_type, priority, target_agents })`

## Shared Component Reuse

| Existing Component | Reused In | How |
|-------------------|-----------|-----|
| `EntityBadge` | `LearningCard` | Type badge display (pass `"learning"` as kind) |
| `CategoryBadge` | `LearningCard` | Learning type badge (constraint/instruction/precedent) |
| `useWorkspaceState` | All hooks | Workspace ID access |

## API Contract (Wire Types)

### GET /learnings Response (existing)
```
{ learnings: Array<{
    id, text, learning_type, status, source, priority,
    target_agents, suggested_by?, pattern_confidence?,
    created_at, approved_at?, dismissed_at?, dismissed_reason?, deactivated_at?
}> }
```

### PUT /learnings/:id Request (new)
```
{ text?: string, priority?: string, target_agents?: string[] }
```

### PUT /learnings/:id Response (new)
```
{ status: "updated" }
```

### POST /learnings Request (existing)
```
{ text, learning_type, priority?, target_agents? }
```

### POST /learnings/:id/actions Request (existing)
```
{ action: "approve"|"dismiss"|"deactivate", reason?, new_text? }
```

## Shared Contracts Addition

Add to `app/src/shared/contracts.ts`:

```
KNOWN_LEARNING_TARGET_AGENTS constant:
  { value: "chat_agent", label: "Chat Agent" }
  { value: "pm_agent", label: "PM Agent" }
  { value: "observer_agent", label: "Observer Agent" }
  { value: "mcp", label: "Coding Agents (MCP)" }
```

This is a display-layer constant, not an exhaustive runtime validation. New agent types added to the system should be added here.
