-- Santé Master : la mémoire vectorielle du Médecin-Chef IA (RAG médical / nutritionnel), SÉPARÉE de finance_vectors.
-- Même forme que la table créée par le nœud « PGVector Store » de n8n (LangChain) : n8n peut aussi la créer seul
-- au premier enregistrement, avec le nom de table « sante_vectors ».
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS sante_vectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text TEXT,
    metadata JSONB,
    embedding VECTOR
);
