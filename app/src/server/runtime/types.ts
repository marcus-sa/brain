import type { Surreal } from "surrealdb";
import type { ServerConfig } from "./config";
import type { SseRegistry } from "../streaming/sse-registry";

export type ServerDependencies = {
  config: ServerConfig;
  surreal: Surreal;
  assistantModel: any;
  extractionModel: any;
  pmModel: any;
  embeddingModel: any;
  sse: SseRegistry;
};
