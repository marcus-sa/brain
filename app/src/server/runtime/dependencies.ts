import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { Surreal } from "surrealdb";
import type { ServerConfig } from "./config";

export async function createRuntimeDependencies(config: ServerConfig): Promise<{
  surreal: Surreal;
  chatAgentModel: any;
  extractionModel: any;
  pmAgentModel: any;
  embeddingModel: any;
}> {
  const surreal = new Surreal();
  await surreal.connect(config.surrealUrl);
  await surreal.signin({ username: config.surrealUsername, password: config.surrealPassword });
  await surreal.use({ namespace: config.surrealNamespace, database: config.surrealDatabase });

  const openrouter = createOpenRouter({ apiKey: config.openRouterApiKey });
  const chatAgentModel = openrouter(config.chatAgentModelId, {
    plugins: [{ id: "response-healing" }],
    ...(config.openRouterReasoning ? { extraBody: { reasoning: config.openRouterReasoning } } : {}),
  });
  const extractionModel = openrouter(config.extractionModelId, {
    plugins: [{ id: "response-healing" }],
    ...(config.openRouterReasoning ? { extraBody: { reasoning: config.openRouterReasoning } } : {}),
  });
  const pmAgentModel = openrouter(config.pmAgentModelId, {
    plugins: [{ id: "response-healing" }],
    ...(config.openRouterReasoning ? { extraBody: { reasoning: config.openRouterReasoning } } : {}),
  });
  const embeddingModel = openrouter.textEmbeddingModel(config.embeddingModelId);

  return {
    surreal,
    chatAgentModel,
    extractionModel,
    pmAgentModel,
    embeddingModel,
  };
}
