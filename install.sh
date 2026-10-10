#!/usr/bin/env bash
# ==============================================================================
#  Finance Master v13.0 - Installation du Super-Agent CFO Unifie (Contabo)
# ------------------------------------------------------------------------------
#  Ce script met en place tout ce qui est necessaire cote VPS :
#    0. Extensions PHP (curl, xml, mbstring, pgsql) - v37.42
#    1. Permissions correctes sur /var/www/finance
#    2. Preparation de la base PostgreSQL (chat_history + finance_vectors)
#    3. Relance / creation du container Docker n8n avec les variables requises
#    4. Affichage des etapes manuelles minimales (2 : Import + URL Webhook)
#
#  Ce script est idempotent : vous pouvez le relancer autant de fois que
#  necessaire. Aucune valeur n'est demandee interactivement. Le mot de passe
#  PostgreSQL vient de l'environnement ou de db_config.php (v37.42).
#
#  Usage :  sudo bash install.sh        (tout)
#           sudo bash install.sh php    (extensions PHP seulement)
#           sudo bash install.sh securite  (controle anti-hameconnage, lecture seule)
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
# v37.42 : le mot de passe n'est plus ecrit dans ce fichier suivi par git. Il est lu
# dans l'environnement (sudo PG_PASS='...' bash install.sh) ou, a defaut, dans
# db_config.php (non versionne) au moment de preparer la base.
PG_PASS="${PG_PASS:-}"

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
# 0. Extensions PHP de l'application (v37.42)
#    curl     : la revue de presse interroge les journaux EN PARALLELE
#               (sans curl elle marche quand meme, une source apres l'autre)
#    xml      : DOM + SimpleXML - lecture des pages des journaux et des
#               resultats Google / Bing Actualites
#    mbstring : textes arabes et accents
#    pgsql    : vos reglages (medias de la veille, garde-memoire) en base
#  Seul :  sudo bash install.sh php   (ne touche ni a la base, ni a n8n)
# -----------------------------------------------------------------------------
install_php_extensions() {
  if ! command -v php >/dev/null 2>&1; then
    warn "php introuvable sur l'hote : extensions non verifiees."
    return 0
  fi
  local v modules
  v="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
  modules="$(php -m 2>/dev/null | tr '[:upper:]' '[:lower:]')"
  a_module() { grep -qx "$1" <<<"${modules}"; }
  local manquants=()
  a_module curl || manquants+=("php${v}-curl")
  { a_module dom && a_module simplexml; } || manquants+=("php${v}-xml")
  a_module mbstring || manquants+=("php${v}-mbstring")
  a_module pdo_pgsql || manquants+=("php${v}-pgsql")
  if (( ${#manquants[@]} == 0 )); then
    ok "Extensions PHP ${v} presentes (curl, xml, mbstring, pgsql)."
    return 0
  fi
  log "Installation des extensions PHP ${v} : ${manquants[*]}..."
  if ! command -v apt-get >/dev/null 2>&1; then
    warn "apt-get absent : installe ${manquants[*]} avec le gestionnaire de paquets du systeme."
    return 0
  fi
  DEBIAN_FRONTEND=noninteractive apt-get update -qq || warn "apt-get update a echoue : on tente l'installation quand meme."
  if ! DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${manquants[@]}"; then
    warn "Installation impossible. A la main : sudo apt-get install -y ${manquants[*]} && sudo systemctl restart php${v}-fpm"
    return 0
  fi
  if command -v systemctl >/dev/null 2>&1 && systemctl cat "php${v}-fpm" >/dev/null 2>&1; then
    systemctl restart "php${v}-fpm" && ok "php${v}-fpm redemarre."
  fi
  modules="$(php -m 2>/dev/null | tr '[:upper:]' '[:lower:]')"
  if a_module curl; then ok "curl actif : la revue de presse interroge les journaux en parallele."
  else warn "curl toujours absent : la revue de presse reste en mode lent."; fi
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

  if [[ -z "${PG_PASS}" && -f "${FINANCE_DIR}/db_config.php" ]] && command -v php >/dev/null 2>&1; then
    PG_PASS="$(php -r '$c = @include $argv[1]; echo is_array($c) ? (string)($c["password"] ?? "") : "";' "${FINANCE_DIR}/db_config.php" 2>/dev/null || true)"
  fi
  if [[ -z "${PG_PASS}" ]]; then
    warn "Mot de passe PostgreSQL introuvable (ni PG_PASS, ni db_config.php) : etape PostgreSQL sautee."
    return 0
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
# Contrôle anti-hameçonnage (v37.44) — LECTURE SEULE, ne modifie rien.
#  Chrome signale n8n.beau.ink comme site d'hameçonnage. Avant de demander un
#  réexamen à Google, on s'assure que n8n ne sert pas une VRAIE page piégée :
#  workflows actifs exposant un webhook, un formulaire n8n ou une page HTML.
#  Seul :  sudo bash install.sh securite
# -----------------------------------------------------------------------------
WEBHOOKS_CONNUS="finance-cfo-web finance-memory-ingest"
verifier_securite() {
  if ! command -v docker >/dev/null 2>&1 || ! docker ps --format '{{.Names}}' | grep -qx "${N8N_CONTAINER}"; then
    warn "Conteneur ${N8N_CONTAINER} introuvable : controle n8n impossible."
    return 0
  fi
  log "Version de n8n : $(docker exec "${N8N_CONTAINER}" n8n --version 2>/dev/null | tail -1 || echo inconnue) (a tenir a jour : docker pull ${N8N_IMAGE})"
  local dans="/tmp/fm_workflows_$$.json" ici
  ici="$(mktemp)"
  if ! docker exec "${N8N_CONTAINER}" n8n export:workflow --all --output="${dans}" >/dev/null 2>&1 \
     || ! docker exec "${N8N_CONTAINER}" cat "${dans}" > "${ici}" 2>/dev/null; then
    docker exec "${N8N_CONTAINER}" rm -f "${dans}" >/dev/null 2>&1 || true
    rm -f "${ici}"
    warn "Export des workflows impossible (n8n export:workflow) : controle non fait."
    return 0
  fi
  docker exec "${N8N_CONTAINER}" rm -f "${dans}" >/dev/null 2>&1 || true
  WEBHOOKS_CONNUS="${WEBHOOKS_CONNUS}" php -- "${ici}" <<'PHP'
<?php
$wf = json_decode((string)file_get_contents($argv[1]), true);
if (!is_array($wf)) { echo "[!] Export illisible.\n"; exit(0); }
if (isset($wf['nodes'])) $wf = [$wf];
$connus = preg_split('/\s+/', trim((string)getenv('WEBHOOKS_CONNUS')));
$alertes = 0; $actifs = 0;
foreach ($wf as $w) {
    if (empty($w['active'])) continue;
    $actifs++;
    $exp = [];
    foreach ($w['nodes'] ?? [] as $n) {
        $t = (string)($n['type'] ?? ''); $p = $n['parameters'] ?? [];
        if ($t === 'n8n-nodes-base.webhook') {
            $chemin = trim((string)($p['path'] ?? ''), '/'); $meth = strtoupper((string)($p['httpMethod'] ?? 'GET'));
            $exp[] = ['quoi' => "webhook $meth /webhook/$chemin", 'suspect' => !in_array($chemin, $connus, true) || $meth === 'GET'];
        } elseif ($t === 'n8n-nodes-base.formTrigger' || $t === 'n8n-nodes-base.form') {
            $exp[] = ['quoi' => 'formulaire n8n PUBLIC (page HTML)', 'suspect' => true];
        } elseif ($t === 'n8n-nodes-base.respondToWebhook') {
            $corps = json_encode($p);
            $html = stripos($corps, 'text/html') !== false || stripos($corps, '<html') !== false || stripos($corps, '<form') !== false;
            if ($html || ($p['respondWith'] ?? '') === 'text') $exp[] = ['quoi' => 'reponse ' . ($html ? 'HTML' : 'texte') . ' a un webhook', 'suspect' => $html];
        }
    }
    if (!$exp) continue;
    $suspect = (bool)array_filter($exp, fn($e) => $e['suspect']);
    if ($suspect) $alertes++;
    printf("%s %s\n", $suspect ? '[A VERIFIER]' : '[ok]        ', (string)($w['name'] ?? '(sans nom)'));
    foreach ($exp as $e) printf("               - %s%s\n", $e['quoi'], $e['suspect'] ? '  <==' : '');
}
echo "\n$actifs workflow(s) actif(s).\n";
echo $alertes
    ? "[!] $alertes workflow(s) a verifier : ouvrez-les dans n8n. Un workflow que vous n'avez pas cree => desactivez-le, changez vos mots de passe n8n, mettez n8n a jour.\n"
    : "[OK] Aucun webhook inconnu, aucun formulaire public, aucune page HTML servie : le signalement est tres probablement un faux positif. Demandez le reexamen (voir SAFE_BROWSING.md).\n";
PHP
  rm -f "${ici}"
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
main() {
  require_root
  if [[ "${1:-}" == "php" ]]; then
    install_php_extensions
    return 0
  fi
  if [[ "${1:-}" == "securite" ]]; then
    verifier_securite
    return 0
  fi
  install_php_extensions
  fix_permissions
  prepare_postgres
  setup_n8n
  print_summary
}

main "$@"
