#!/usr/bin/env bash
# ==============================================================================
#  Finance Master v13.0 - Installation du Super-Agent CFO Unifie (Contabo)
# ------------------------------------------------------------------------------
#  Ce script met en place tout ce qui est necessaire cote VPS :
#    1. Permissions correctes sur /var/www/finance
#    2. Preparation de la base PostgreSQL (chat_history + finance_vectors)
#    3. Relance / creation du container Docker n8n avec les variables requises
#    4. Affichage des etapes manuelles minimales (2 : Import + URL Webhook)
#
#  Ce script est idempotent : vous pouvez le relancer autant de fois que
#  necessaire. Aucune valeur n'est demandee interactivement, tout est en dur
#  (credentials pre-existants sur votre n8n), strict respect du brief.
#
#  Usage :  sudo bash install.sh
# ==============================================================================
set -euo pipefail

# -----------------------------------------------------------------------------
# CONFIGURATION (deja existante sur ton infra - valeurs fournies par le brief)
# -----------------------------------------------------------------------------
FINANCE_DIR="/var/www/finance"
WEB_USER="www-data"
WEB_GROUP="www-data"

PG_HOST="127.0.0.1"
PG_PORT="5432"
PG_DB="charif_finance_db"
PG_USER="admin"
PG_PASS="20002000"

N8N_CONTAINER="n8n"
N8N_PORT="5678"
N8N_DATA_VOLUME="n8n_data"
N8N_IMAGE="n8nio/n8n:latest"

# Webhook path expose par le workflow
WEBHOOK_PATH="finance-cfo-web"

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
log()  { printf "\033[1;34m[*]\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m[OK]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[!]\033[0m %s\n" "$*"; }
die()  { printf "\033[1;31m[X]\033[0m %s\n" "$*" >&2; exit 1; }

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "Ce script doit etre lance en root (sudo bash install.sh)."
  fi
}

# -----------------------------------------------------------------------------
# 1. Permissions /var/www/finance
# -----------------------------------------------------------------------------
fix_permissions() {
  log "Correction des permissions sur ${FINANCE_DIR}..."
  if [[ ! -d "${FINANCE_DIR}" ]]; then
    die "${FINANCE_DIR} introuvable. Deploie d'abord les fichiers (git pull) avant de relancer."
  fi
  chown -R "${WEB_USER}:${WEB_GROUP}" "${FINANCE_DIR}"
  chmod -R 775 "${FINANCE_DIR}"

  # finance_data.json doit etre writable par PHP
  if [[ -f "${FINANCE_DIR}/finance_data.json" ]]; then
    chmod 664 "${FINANCE_DIR}/finance_data.json"
  fi
  # dossier backups pour save_data.php
  mkdir -p "${FINANCE_DIR}/backups"
  chown "${WEB_USER}:${WEB_GROUP}" "${FINANCE_DIR}/backups"
  chmod 775 "${FINANCE_DIR}/backups"

  # dossier pending pour pending_commit.php (v13.5 stateful tools cache)
  mkdir -p "${FINANCE_DIR}/pending"
  chown "${WEB_USER}:${WEB_GROUP}" "${FINANCE_DIR}/pending"
  chmod 775 "${FINANCE_DIR}/pending"

  ok "Permissions OK (${WEB_USER}:${WEB_GROUP}, 775 + pending/)."
}

# -----------------------------------------------------------------------------
# 2. Base PostgreSQL : tables chat_history + finance_vectors
# -----------------------------------------------------------------------------
prepare_postgres() {
  log "Preparation PostgreSQL (${PG_DB})..."
  if ! command -v psql >/dev/null 2>&1; then
    warn "psql introuvable sur l'hote. On tente via docker si un container pg est expose."
  fi

  export PGPASSWORD="${PG_PASS}"
  PSQL="psql -h ${PG_HOST} -p ${PG_PORT} -U ${PG_USER} -d ${PG_DB} -v ON_ERROR_STOP=1"

  # Extension vector (pgvector) - requise pour finance_vectors
  ${PSQL} -c "CREATE EXTENSION IF NOT EXISTS vector;" \
    || warn "Extension 'vector' non creee. Installe pgvector sur ton PG si l'outil RAG ne demarre pas."

  # Table memoire conversationnelle du LangChain Agent
  ${PSQL} <<'SQL'
CREATE TABLE IF NOT EXISTS chat_history (
  id         BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  message    JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_history_session ON chat_history (session_id, created_at);
SQL

  # Table vector store pour le RAG (dimension 1536 compatible OpenAI/Deepseek embed)
  ${PSQL} <<'SQL'
CREATE TABLE IF NOT EXISTS finance_vectors (
  id        BIGSERIAL PRIMARY KEY,
  content   TEXT NOT NULL,
  metadata  JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(1536)
);
CREATE INDEX IF NOT EXISTS idx_finance_vectors_meta ON finance_vectors USING GIN (metadata);
SQL

  unset PGPASSWORD
  ok "Tables chat_history + finance_vectors pretes."
}

# -----------------------------------------------------------------------------
# 3. Docker n8n : relance avec webhook public + variables correctes
# -----------------------------------------------------------------------------
setup_n8n() {
  log "Configuration du container Docker ${N8N_CONTAINER}..."
  if ! command -v docker >/dev/null 2>&1; then
    die "Docker n'est pas installe. Installe Docker puis relance le script."
  fi

  # On respecte l'existant : si le container tourne deja, on NE le detruit pas.
  # On s'assure juste qu'il est up, qu'il a le bon WEBHOOK_URL, et on le restart.
  if docker ps -a --format '{{.Names}}' | grep -qx "${N8N_CONTAINER}"; then
    log "Container ${N8N_CONTAINER} existant : verification et redemarrage..."
    # Propage le WEBHOOK_URL si absent
    PUBLIC_URL="$(docker exec "${N8N_CONTAINER}" printenv WEBHOOK_URL 2>/dev/null || true)"
    if [[ -z "${PUBLIC_URL}" ]]; then
      warn "WEBHOOK_URL absent du container. Le workflow repondra quand meme en mode 'Respond to Webhook'."
      warn "Si tu veux les webhooks publics, recree le container avec -e WEBHOOK_URL=https://n8n.tondomaine.com/"
    fi
    docker restart "${N8N_CONTAINER}" >/dev/null
    ok "${N8N_CONTAINER} redemarre."
  else
    log "Container ${N8N_CONTAINER} absent : creation..."
    docker volume create "${N8N_DATA_VOLUME}" >/dev/null 2>&1 || true
    docker run -d \
      --name "${N8N_CONTAINER}" \
      --restart unless-stopped \
      -p "${N8N_PORT}:5678" \
      -v "${N8N_DATA_VOLUME}:/home/node/.n8n" \
      -e N8N_HOST="0.0.0.0" \
      -e N8N_PORT="5678" \
      -e N8N_PROTOCOL="https" \
      -e GENERIC_TIMEZONE="Africa/Casablanca" \
      -e TZ="Africa/Casablanca" \
      -e N8N_METRICS="true" \
      "${N8N_IMAGE}" >/dev/null
    ok "${N8N_CONTAINER} demarre sur le port ${N8N_PORT}."
  fi

  # Verifie que le container peut joindre Postgres sur 127.0.0.1
  if docker exec "${N8N_CONTAINER}" sh -c "command -v nc >/dev/null 2>&1 && nc -z host.docker.internal ${PG_PORT}" 2>/dev/null; then
    ok "n8n -> Postgres (host.docker.internal:${PG_PORT}) OK."
  else
    warn "n8n ne voit pas Postgres via host.docker.internal. Si tes credentials n8n pointent sur 127.0.0.1, adapte-les a 'host.docker.internal' dans l'UI."
  fi
}

# -----------------------------------------------------------------------------
# 4. Resume final
# -----------------------------------------------------------------------------
print_summary() {
  cat <<EOF

============================================================
  Finance Master v13.0 - Installation terminee
============================================================

Il reste exactement 2 actions manuelles a faire dans n8n :

  1) Importer le workflow
     - Ouvre n8n : http://<ton-ip>:${N8N_PORT}/
     - Menu Workflows -> Import from File
     - Choisis : ${FINANCE_DIR}/super_agent_cfo.json
     - Active-le (toggle "Active" en haut a droite)

  2) Copier l'URL du Webhook dans l'app
     - Ouvre le node "Webhook CFO Web" dans le workflow
     - Copie l'URL PROD (ex: https://n8n.tondomaine.com/webhook/${WEBHOOK_PATH})
     - Dans Finance Master -> onglet "CFO Agent" (Desktop ou Mobile)
     - Colle l'URL dans le champ (elle sera memorisee en localStorage)

Tous les credentials sont deja references par ID dans le JSON :
  - Telegram    : fn59pzxSFtgQkLhN
  - PostgreSQL  : 7cQfM9fXdo0Pso5h
  - Deepseek    : 7QibYEfnaV5yDVxk

Test rapide (depuis ton poste) :
  curl -X POST https://n8n.tondomaine.com/webhook/${WEBHOOK_PATH} \\
       -H "Content-Type: application/json" \\
       -d '{"session_id":"test_1","question":"Diagnostic","source":"web","finance_data":{}}'

Securite :
  - L'outil Committer n'ecrit dans save_data.php QUE si l'utilisateur a
    explicitement dit "OUI" (triple-garde dans le JSON).
  - Toutes les simulations passent par Budget Engine en mode simulate=true
    avant d'etre proposees a la validation.

Bon pilotage.
============================================================
EOF
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
main() {
  require_root
  fix_permissions
  prepare_postgres
  setup_n8n
  print_summary
}

main "$@"
