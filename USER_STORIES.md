# User Stories — Chat Deep-Linking (#86)

## US-1: Persist active conversation in URL

**As a** user chatting in Brain,
**I want** the URL to reflect which conversation I'm viewing,
**So that** refreshing the page doesn't lose my place.

### Acceptance Criteria

- [ ] Navigating to `/chat` shows a new/empty conversation
- [ ] Sending the first message in a new conversation updates the URL to `/chat/<conversationId>` (without adding a back-button entry)
- [ ] Clicking a conversation in the sidebar updates the URL to `/chat/<conversationId>`
- [ ] Refreshing the browser on `/chat/<conversationId>` reloads that conversation with all messages

## US-2: Browser history navigation between conversations

**As a** user switching between conversations,
**I want** the browser back/forward buttons to navigate between them,
**So that** I can return to a previous conversation without the sidebar.

### Acceptance Criteria

- [ ] Selecting conversation A, then conversation B, then pressing Back returns to conversation A
- [ ] Pressing Forward after Back returns to conversation B
- [ ] Starting a new conversation (`/chat`) and pressing Back returns to the previous conversation

## US-3: Deep-link to a specific message

**As a** user viewing an entity in the graph,
**I want** "Jump to message" to take me to the exact message in its conversation,
**So that** I can see the original context where an entity was extracted.

### Acceptance Criteria

- [ ] "Jump to message" in the entity detail provenance section navigates to `/chat/<conversationId>?message=<messageId>`
- [ ] The target message scrolls into view and receives a highlight animation
- [ ] Visiting `/chat/<conversationId>?message=<messageId>` directly (e.g. from a bookmark) loads the conversation and scrolls to the message
- [ ] If the message ID doesn't exist in the conversation, the conversation loads normally (no error)

## US-4: Branching preserves URL

**As a** user branching from a message,
**I want** the URL to update to the new branch conversation,
**So that** refreshing keeps me on the branch.

### Acceptance Criteria

- [ ] Clicking "Branch from here" on an assistant message creates the branch and updates URL to `/chat/<branchId>`
- [ ] Refreshing on the branch URL reloads the branch with inherited + own messages

## US-5: Invalid conversation URL

**As a** user who visits an invalid or stale conversation URL,
**I want** to be redirected gracefully,
**So that** I'm not stuck on a broken page.

### Acceptance Criteria

- [ ] Visiting `/chat/<nonexistent-id>` redirects to `/chat` with an error message displayed
- [ ] The error message is visible but non-blocking (can still start a new conversation)

## US-6: New conversation resets URL

**As a** user clicking "New conversation",
**I want** the URL to return to `/chat`,
**So that** the URL accurately reflects that no conversation is selected.

### Acceptance Criteria

- [ ] Clicking "New conversation" in the sidebar navigates to `/chat`
- [ ] Messages are cleared, input is ready for a fresh conversation

## US-7: Discuss entity resets chat state on route transitions

**As a** user pressing "Discuss" on an entity,
**I want** to always land on a fresh `/chat` with that entity context,
**So that** the discussion starts cleanly without leftover conversation state.

### Acceptance Criteria

- [ ] Pressing "Discuss" on an entity while on `/chat/<id>` navigates to `/chat`, clears the previous conversation messages, and shows the entity card at the top
- [ ] Navigating from `/chat` (with a discuss entity) to an existing `/chat/<id>` via the sidebar clears the discuss entity card — the existing conversation loads without stale discuss context
- [ ] Pressing "Discuss" on an entity while on `/chat` (no active conversation) shows the entity card and keeps the chat ready for a new message

## US-8: Chat agent treats user domain as business content, not Brain internals

**As a** user describing my business domain in Brain,
**I want** the chat agent to capture my concepts as graph entities,
**So that** it never confuses my domain model with Brain's own architecture — even when terms overlap.

### Acceptance Criteria

- [ ] Describing a hierarchy (e.g. "I want entities: Initiative -> Project -> Feature -> Task") triggers the PM agent to plan work items — the agent does not explain Brain's data model
- [ ] Using terms like "entities", "graph", "features", or "tasks" in a business context creates entities in the graph rather than prompting clarification about Brain internals
- [ ] The agent only explains Brain's architecture when explicitly asked (e.g. "How does Brain work?" or "What entity types does Brain support?")
