-- Santé Master : l'état de l'appli (une ligne, JSONB). Créé automatiquement au premier appel.
CREATE TABLE IF NOT EXISTS sante_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT sante_state_singleton CHECK (id = 1)
);
