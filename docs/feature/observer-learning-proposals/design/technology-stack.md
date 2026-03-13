# Observer Learning Proposals — Technology Stack

## No New Dependencies

This feature uses the existing technology stack exclusively.

| Concern | Technology | Already In Use |
|---------|-----------|----------------|
| LLM structured output | `ai` SDK `generateObject` | Yes — `observer/llm-reasoning.ts`, `observer/llm-synthesis.ts` |
| Schema validation | `zod` | Yes — `observer/schemas.ts` |
| Vector similarity | SurrealDB HNSW + `vector::similarity::cosine` | Yes — `learning/loader.ts`, `learning/detector.ts` |
| Learning persistence | `learning/detector.ts:suggestLearning()` | Yes — exists but uncalled |
| Embedding generation | Existing embedding service | Yes — `learning/learning-route.ts` |
| HTTP route | `Bun.serve` | Yes — no new routes needed (extends existing graph scan) |

## Why No New Infrastructure

- **No message queue**: Graph scan is pull-based (scheduled or on-demand HTTP trigger). Observation clustering is a query, not a stream.
- **No new tables**: `learning` table already has `source: "agent"`, `suggested_by`, `pattern_confidence`, `learning_type`. `learning_evidence` relation already supports `observation` as OUT type.
- **No new indexes**: Observation embeddings already have HNSW index. Learning embeddings already have HNSW index.
- **No new LLM models**: Uses the existing observer model (`deps.observerModel`).
