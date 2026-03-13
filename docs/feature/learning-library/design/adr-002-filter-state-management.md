# ADR-002: Filter State Management -- Hook-Local vs URL vs Zustand

## Status
Accepted

## Context

The learning library has three filter dimensions: status (tab), type (dropdown), agent (dropdown). State must drive API calls and survive tab switches within the page. The codebase has three existing patterns: Zustand stores, hook-local useState, and TanStack Router search params.

## Decision

Hook-local state within `useLearnings`. Filters live as `useState` inside the hook, exposed via `setFilters()`. No URL sync, no Zustand store.

## Alternatives Considered

### Alternative 1: TanStack Router search params (`/learnings?status=active&type=constraint`)
- **What**: Encode filters in URL, validate with `validateSearch`, read in component.
- **Expected Impact**: Shareable/bookmarkable filter state.
- **Why Insufficient**: No existing page uses search param filters (search overlay is a modal, not URL-driven). Adds complexity for a single-user app where bookmark sharing is not a use case. Can be added later without architecture change.

### Alternative 2: Zustand store (`learning-state.ts`)
- **What**: Global store for filter state + learning data.
- **Expected Impact**: State persists across route navigations.
- **Why Insufficient**: Existing data-fetching hooks (`useGovernanceFeed`, `useEntitySearch`) use hook-local state, not stores. Stores are for cross-component shared state (workspace ID, selected entity). Learning filters are page-scoped. Adding a store breaks the established pattern.

## Consequences

- **Positive**: Follows existing hook patterns exactly. No new state management concepts.
- **Positive**: Filters reset on page navigation (expected UX -- returning to library starts fresh).
- **Negative**: Filters lost if user navigates away and back. Acceptable for solo user with small dataset.
- **Migration path**: If URL sync needed later, lift filter state to route search params without changing component interfaces.
