import { useState } from "react";
import { Outlet, createRootRoute, createRoute, createRouter, useNavigate } from "@tanstack/react-router";
import { WorkspaceGuard } from "./components/layout/WorkspaceGuard";
import { WorkspaceSidebar } from "./components/layout/WorkspaceSidebar";
import { SearchOverlay } from "./components/search/SearchOverlay";
import { useWorkspace } from "./hooks/use-workspace";
import { useWorkspaceState } from "./stores/workspace-state";
import { ChatPage } from "./routes/chat-page";
import { GraphPage } from "./routes/graph-page";
import { HomePage } from "./routes/home-page";

function AppShell() {
  const workspace = useWorkspace();
  const sidebar = useWorkspaceState((s) => s.sidebar);
  const sidebarHandlers = useWorkspaceState((s) => s.sidebarHandlers);
  const workspaceName = useWorkspaceState((s) => s.workspaceName);
  const onboardingState = useWorkspaceState((s) => s.onboardingState);
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);

  function handleNewConversation() {
    if (sidebarHandlers) {
      sidebarHandlers.onNewConversation();
    }
    void navigate({ to: "/chat" });
  }

  function handleSelectConversation(conversationId: string) {
    if (sidebarHandlers) {
      sidebarHandlers.onSelectConversation(conversationId);
    }
    void navigate({ to: "/chat/$conversationId", params: { conversationId } });
  }

  return (
    <WorkspaceGuard
      isReady={workspace.isReady}
      isBootstrapping={workspace.isBootstrapping}
      isCreatingWorkspace={workspace.isCreatingWorkspace}
      canCreateWorkspace={workspace.canCreateWorkspace}
      createWorkspaceName={workspace.createWorkspaceName}
      createOwnerName={workspace.createOwnerName}
      errorMessage={workspace.errorMessage}
      setCreateWorkspaceName={workspace.setCreateWorkspaceName}
      setCreateOwnerName={workspace.setCreateOwnerName}
      onCreateWorkspace={workspace.onCreateWorkspace}
    >
      <div className="app-shell">
        <WorkspaceSidebar
          sidebar={sidebar}
          activeConversationId={sidebarHandlers?.activeConversationId}
          isLoading={sidebarHandlers?.isLoading ?? false}
          onNewConversation={handleNewConversation}
          onSelectConversation={handleSelectConversation}
        />
        <div className="app-main">
          <div className="content-header">
            <span className="content-header-title">{workspaceName}</span>
            {onboardingState === "active" ? (
              <span className="onboarding-badge">Setting up</span>
            ) : onboardingState === "summary_pending" ? (
              <span className="onboarding-badge">Review setup</span>
            ) : undefined}
            <button
              type="button"
              className="search-trigger"
              onClick={() => setSearchOpen(true)}
            >
              Search...
            </button>
          </div>
          <div className="app-content">
            <Outlet />
          </div>
        </div>
      </div>
      {searchOpen ? <SearchOverlay onClose={() => setSearchOpen(false)} /> : undefined}
    </WorkspaceGuard>
  );
}

const rootRoute = createRootRoute({
  component: AppShell,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

type ChatSearch = { message?: string };

const validateChatSearch = (search: Record<string, unknown>): ChatSearch => ({
  ...(typeof search.message === "string" ? { message: search.message } : {}),
});

const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/chat",
  component: ChatPage,
  validateSearch: validateChatSearch,
});

const chatConversationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/chat/$conversationId",
  component: ChatPage,
  validateSearch: validateChatSearch,
});

const graphRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/graph",
  component: GraphPage,
});

const routeTree = rootRoute.addChildren([homeRoute, chatRoute, chatConversationRoute, graphRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
