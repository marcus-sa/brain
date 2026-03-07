import type { FormEvent, ReactNode } from "react";

type WorkspaceGuardProps = {
  isReady: boolean;
  isBootstrapping: boolean;
  isCreatingWorkspace: boolean;
  canCreateWorkspace: boolean;
  createWorkspaceName: string;
  createWorkspaceDescription: string;
  createWorkspaceRepoPath: string;
  errorMessage?: string;
  setCreateWorkspaceName: (name: string) => void;
  setCreateWorkspaceDescription: (description: string) => void;
  setCreateWorkspaceRepoPath: (path: string) => void;
  onCreateWorkspace: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
};

export function WorkspaceGuard({
  isReady,
  isBootstrapping,
  isCreatingWorkspace,
  canCreateWorkspace,
  createWorkspaceName,
  createWorkspaceDescription,
  createWorkspaceRepoPath,
  errorMessage,
  setCreateWorkspaceName,
  setCreateWorkspaceDescription,
  setCreateWorkspaceRepoPath,
  onCreateWorkspace,
  children,
}: WorkspaceGuardProps) {
  if (isBootstrapping) {
    return (
      <section className="workspace-setup">
        <p>Loading workspace...</p>
      </section>
    );
  }

  if (!isReady) {
    return (
      <section className="workspace-setup">
        <h2>Create Workspace</h2>
        <p>Name your workspace to get started. Onboarding continues in chat.</p>
        <form onSubmit={onCreateWorkspace} className="workspace-form">
          <label>
            Workspace name
            <input
              value={createWorkspaceName}
              onChange={(event) => setCreateWorkspaceName(event.target.value)}
              placeholder="Acme Labs"
              required
            />
          </label>
          <label>
            Description <span className="optional-label">(optional)</span>
            <textarea
              value={createWorkspaceDescription}
              onChange={(event) => setCreateWorkspaceDescription(event.target.value)}
              placeholder="What does this company or workspace do?"
              rows={3}
            />
          </label>
          <label>
            Repository path <span className="optional-label">(optional)</span>
            <input
              value={createWorkspaceRepoPath}
              onChange={(event) => setCreateWorkspaceRepoPath(event.target.value)}
              placeholder="/Users/you/projects/your-repo"
            />
          </label>
          <button type="submit" disabled={!canCreateWorkspace || isCreatingWorkspace}>
            {isCreatingWorkspace ? "Creating..." : "Create Workspace"}
          </button>
        </form>
        {errorMessage ? <p className="error-message">{errorMessage}</p> : undefined}
      </section>
    );
  }

  return <>{children}</>;
}
