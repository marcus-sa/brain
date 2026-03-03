import { RecordId, Surreal } from "surrealdb";

export type ChatToolExecutionContext = {
  actor: "chat_agent" | "mcp" | "orchestrator" | "pm_agent";
  workspaceRecord: RecordId<"workspace", string>;
  conversationRecord: RecordId<"conversation", string>;
  currentMessageRecord: RecordId<"message", string>;
  latestUserText: string;
  workspaceOwnerRecord?: RecordId<"person", string>;
};

export type ChatToolDeps = {
  surreal: Surreal;
  embeddingModel: any;
  embeddingDimension: number;
  extractionModelId: string;
  extractionModel: any;
  extractionStoreThreshold: number;
};

export type OrchestratorToolDeps = ChatToolDeps & {
  pmModel: any;
};
