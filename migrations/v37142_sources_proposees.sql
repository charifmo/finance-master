-- ============================================================================
--  v37.142 — LES SOURCES PROPOSÉES (PostgreSQL 16) — migration IDEMPOTENTE
-- ----------------------------------------------------------------------------
--  Appliquée automatiquement par vd_schema() (cfo_veille_decouvertes_lib.php) au
--  premier passage du cron ou de la Recherche Éclair : ce fichier la documente et
--  permet de l'appliquer à la main :
--      sudo -u postgres psql -d <base> -f migrations/v37142_sources_proposees.sql
--  Rejouable sans effet (IF NOT EXISTS). Aucune table existante n'est modifiée.
--  Retour arrière : DROP TABLE veille_sources_decouvertes, veille_sources_occurrences,
--                   veille_sources_historique, veille_decouvertes_etat;
--  (les articles collectés, veille_articles, ne sont pas touchés)
-- ============================================================================

-- Une ligne par source normalisée (clé unique) : statut, type, score expliqué, compteurs, configuration
CREATE TABLE IF NOT EXISTS veille_sources_decouvertes (
    id BIGSERIAL PRIMARY KEY,
    normalized_key TEXT NOT NULL UNIQUE,              -- ex. le360.ma, sport.le360.ma, facebook.com/communeouahatsidibrahim
    original_url TEXT NOT NULL,                       -- l'adresse d'origine du 1er exemple, telle quelle
    url_google TEXT,                                  -- le lien Google Actualités quand l'adresse du journal n'y figure pas
    normalized_domain TEXT NOT NULL,                  -- hôte sans variante (www., m., mobile., amp., fr., ar.…)
    registrable_domain TEXT NOT NULL,                 -- domaine enregistrable (Public Suffix List)
    subdomain TEXT NOT NULL DEFAULT '',               -- sous-domaine tel que vu
    chemin TEXT NOT NULL DEFAULT '',                  -- page d'un réseau social / chaîne vidéo
    plateforme TEXT,                                  -- facebook, instagram, youtube…
    normalization_reason TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'inconnu',
    langue TEXT NOT NULL DEFAULT 'fr',
    statut TEXT NOT NULL DEFAULT 'candidate',
    origine TEXT NOT NULL DEFAULT 'decouverte',       -- decouverte | manuel
    exclusion TEXT,                                   -- raison d'exclusion (imitation, paramètre sensible, déjà suivie…) ou NULL
    score INTEGER NOT NULL DEFAULT 0,
    raisons TEXT NOT NULL DEFAULT '[]',               -- JSON [[points, texte]…]
    occurrences INTEGER NOT NULL DEFAULT 0,
    occurrences_pertinentes INTEGER NOT NULL DEFAULT 0,
    requetes_distinctes INTEGER NOT NULL DEFAULT 0,
    jours_distincts INTEGER NOT NULL DEFAULT 0,
    biens TEXT NOT NULL DEFAULT '[]',                 -- JSON [clé de bien…]
    bien_principal TEXT,
    premier BIGINT NOT NULL,                          -- epoch (s)
    dernier BIGINT NOT NULL,
    pertinence_moyenne REAL NOT NULL DEFAULT 0,
    exemples TEXT NOT NULL DEFAULT '[]',              -- JSON, 3 meilleurs exemples
    config TEXT NOT NULL DEFAULT '{}',                -- JSON : nom, fréquence, mode, requêtes, biens, confiance, note…
    propose_le BIGINT, decide_le BIGINT, expire_le BIGINT, maj BIGINT NOT NULL,
    CHECK (statut IN ('candidate','proposed','accepted','rejected','one_time','paused','expired')),
    CHECK (type IN ('presse','officielle','annonces','reseau','forum','video','inconnu'))
);
CREATE INDEX IF NOT EXISTS veille_sd_statut ON veille_sources_decouvertes (statut, score);
CREATE INDEX IF NOT EXISTS veille_sd_bien ON veille_sources_decouvertes (bien_principal, statut);
CREATE INDEX IF NOT EXISTS veille_sd_registrable ON veille_sources_decouvertes (registrable_domain);

-- Chaque apparition d'une source (article × requête × bien), adresse d'origine conservée
CREATE TABLE IF NOT EXISTS veille_sources_occurrences (
    id BIGSERIAL PRIMARY KEY,
    normalized_key TEXT NOT NULL, article_url TEXT NOT NULL, original_url TEXT NOT NULL, url_google TEXT,
    bien TEXT NOT NULL, requete_id BIGINT NOT NULL, requete_q TEXT, requete_locale INTEGER NOT NULL DEFAULT 0,
    jour TEXT NOT NULL, titre TEXT NOT NULL, extrait TEXT, ts BIGINT, langue TEXT, portee TEXT,
    pertinent INTEGER NOT NULL DEFAULT 0, vu_le BIGINT NOT NULL,
    UNIQUE (normalized_key, article_url, bien, requete_id)
);
CREATE INDEX IF NOT EXISTS veille_so_cle ON veille_sources_occurrences (normalized_key);
CREATE INDEX IF NOT EXISTS veille_so_bien ON veille_sources_occurrences (bien, normalized_key);

-- L'historique des décisions : ancien statut, nouveau, date, origine (systeme | utilisateur | manuel), raison
CREATE TABLE IF NOT EXISTS veille_sources_historique (
    id BIGSERIAL PRIMARY KEY,
    normalized_key TEXT NOT NULL, ancien TEXT, nouveau TEXT NOT NULL, ts BIGINT NOT NULL,
    origine TEXT NOT NULL, raison TEXT NOT NULL DEFAULT '', bien TEXT
);
CREATE INDEX IF NOT EXISTS veille_sh_cle ON veille_sources_historique (normalized_key, ts);
CREATE INDEX IF NOT EXISTS veille_sh_jour ON veille_sources_historique (nouveau, origine, ts);

-- Le point de reprise de l'agrégation (dernier passage)
CREATE TABLE IF NOT EXISTS veille_decouvertes_etat (cle TEXT PRIMARY KEY, valeur BIGINT NOT NULL);
