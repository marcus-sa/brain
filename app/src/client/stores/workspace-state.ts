import { create } from "zustand";

type WorkspaceStateStore = {
  workspaceId: string | undefined;
  setWorkspaceId: (workspaceId: string | undefined) => void;
};

export const useWorkspaceState = create<WorkspaceStateStore>((set) => ({
  workspaceId: undefined,
  setWorkspaceId: (workspaceId) => set({ workspaceId }),
}));
