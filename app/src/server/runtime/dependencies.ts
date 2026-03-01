import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { Surreal } from "surrealdb";
import type { ServerConfig } from "./config";

export async function createRuntimeDependencies(config: ServerConfig): Promise<{
  surreal: Surreal;
  assistantModel: any;
  extractionModel: any;
  pmModel: any;
  embeddingModel: any;
}> {
  const surreal = new Surreal();
  await surreal.connect(config.surrealUrl);
  await surreal.signin({ username: config.surrealUsername, password: config.surrealPassword });
  await surreal.use({ namespace: config.surrealNamespace, database: config.surrealDatabase });

  const openrouter = createOpenRouter({ apiKey: config.openRouterApiKey });
  const assistantModel = openrouter(config.assistantModelId, {
    plugins: [{ id: "response-healing" }],
    ...(config.openRouterReasoning ? { extraBody: { reasoning: config.openRouterReasoning } } : {}),
  });
  const extractionModel = openrouter(config.extractionModelId, {
    plugins: [{ id: "response-healing" }],
    ...(config.openRouterReasoning ? { extraBody: { reasoning: config.openRouterReasoning } } : {}),
  });
  const pmModel = openrouter(config.pmModelId, {
    plugins: [{ id: "response-healing" }],
    ...(config.openRouterReasoning ? { extraBody: { reasoning: config.openRouterReasoning } } : {}),
  });
  const embeddingModel = openrouter.textEmbeddingModel(config.embeddingModelId);

  return {
    surreal,
    assistantModel,
    extractionModel,
    pmModel,
    embeddingModel,
  };
}
