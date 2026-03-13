-- Add embedding field and HNSW index to policy table for collision detection
-- Required by agent learnings collision detection (learning-vs-policy similarity)

DEFINE FIELD OVERWRITE embedding ON policy TYPE option<array<float>>;
DEFINE INDEX OVERWRITE idx_policy_embedding ON policy FIELDS embedding HNSW DIMENSION 1536 DIST COSINE;
