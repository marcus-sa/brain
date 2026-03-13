# ADR-001: Dialog Component Strategy -- Extraction vs Duplication

## Status
Accepted

## Context

The GovernanceFeed currently handles learning approve/dismiss actions inline via `FeedItem` buttons that call `executeEntityAction()`. The Learning Library needs the same approve/dismiss flows PLUS edit, deactivate, and create -- all requiring dialogs with forms.

The feed currently has NO dialog components. Its approve/dismiss actions are fire-and-forget button clicks routed through `feed-action-routing.ts` -> `executeEntityAction()`. There is nothing to extract.

## Decision

Create all dialog components fresh in `components/learning/`. The feed's action buttons will continue to use their existing fire-and-forget pattern. If the feed later needs dialogs (e.g., dismiss reason), it can import from `components/learning/`.

## Alternatives Considered

### Alternative 1: Extract shared dialog primitives into `components/shared/`
- **What**: Create a generic `ConfirmationDialog`, `FormDialog` base and compose learning-specific dialogs from them.
- **Expected Impact**: Reusable across feed and library.
- **Why Insufficient**: No existing dialog pattern exists to extract FROM. The feed uses direct API calls without confirmation. Building a generic system for one consumer (library) is premature abstraction. YAGNI.

### Alternative 2: Add dialogs to feed components, import in library
- **What**: Build approve/dismiss dialogs in `components/feed/`, import into library.
- **Expected Impact**: Feed gets enhanced UX.
- **Why Insufficient**: Feed dialogs would need different context (feed item shape vs learning shape). Coupling library to feed component internals inverts the dependency direction. Feed is simpler -- it should depend on library, not vice versa.

## Consequences

- **Positive**: Library is self-contained. No coupling to feed internals. Dialogs are purpose-built for learning shapes.
- **Positive**: If feed needs dialogs later, it imports from `learning/` -- dependency flows from simpler to richer component.
- **Negative**: If approve/dismiss logic is identical, there's minor duplication of the API call pattern. Acceptable given the calls are one-liners.
