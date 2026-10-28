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
#           sudo bash install.sh cfo       (v37.69 : workflow CFO -> coquille, une fois)
#           sudo bash install.sh cfo-retour (remet le workflow CFO d'avant)
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
  # v37.69 : ces droits ne doivent pas passer pour des modifications locales aux yeux de git
  #   (sinon le git pull suivant refuse : « Your local changes would be overwritten »)
  if [[ -d "${FINANCE_DIR}/.git" ]]; then git -C "${FINANCE_DIR}" config core.fileMode false 2>/dev/null || true; fi

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
# v37.69 — Le workflow « Super-Agent CFO » devient une coquille
#   sudo bash install.sh cfo         : met a jour le workflow DANS n8n (une fois)
#   sudo bash install.sh cfo-retour  : remet la version d'avant (derniere sauvegarde)
# Ne change que deux noeuds (Build Agent Input, AI Agent) : identifiants et autres
# noeuds intacts. Ensuite, le contexte et les consignes du CFO viennent du VPS
# (cfo_contexte.php + cfo_system_prompt.md) : un git pull suffit pour les faire evoluer.
# -----------------------------------------------------------------------------
CFO_SAUVEGARDES="/var/backups/finance"

n8n_cmd() { docker exec "${N8N_CONTAINER}" n8n "$@"; }

n8n_exporter_tout() {   # $1 = fichier de sortie sur l'hote
  local dans="/tmp/fm_export_$$.json"
  n8n_cmd export:workflow --all --output="${dans}" >/dev/null 2>&1 || return 1
  docker exec "${N8N_CONTAINER}" cat "${dans}" > "$1" 2>/dev/null || return 1
  docker exec "${N8N_CONTAINER}" rm -f "${dans}" >/dev/null 2>&1 || true
}

n8n_importer_et_publier() {   # $1 = fichier workflow (un seul) sur l'hote, $2 = id
  # n8n tourne sous un autre utilisateur que root dans son conteneur : le fichier doit
  # lui etre lisible (mktemp le cree en 600, et docker cp garde ces droits).
  chmod 644 "$1"
  docker exec -u root "${N8N_CONTAINER}" rm -f /tmp/fm_cfo.json >/dev/null 2>&1 || true
  docker cp "$1" "${N8N_CONTAINER}:/tmp/fm_cfo.json" >/dev/null || return 1
  docker exec -u root "${N8N_CONTAINER}" chmod 644 /tmp/fm_cfo.json >/dev/null 2>&1 || true
  n8n_cmd import:workflow --input=/tmp/fm_cfo.json || return 1
  docker exec -u root "${N8N_CONTAINER}" rm -f /tmp/fm_cfo.json >/dev/null 2>&1 || true
  if [[ -n "$2" ]]; then
    # (aide lue d'abord dans une variable : avec pipefail, « | grep -q » coupe n8n et fausse le test)
    local aide; aide="$(n8n_cmd --help 2>&1 || true)"
    if grep -q 'publish:workflow' <<<"${aide}"; then
      n8n_cmd publish:workflow --id="$2" || warn "publish:workflow a echoue : publiez le workflow dans l'interface n8n."
    else
      n8n_cmd update:workflow --id="$2" --active=true || warn "activation a echoue : activez le workflow dans l'interface n8n."
    fi
  fi
  log "Redemarrage de n8n (prise en compte du workflow)..."
  docker restart "${N8N_CONTAINER}" >/dev/null
  local i
  for i in $(seq 1 60); do
    curl -fsS "http://127.0.0.1:${N8N_PORT}/healthz" >/dev/null 2>&1 && return 0
    sleep 2
  done
  warn "n8n ne repond pas encore sur /healthz : verifiez dans quelques instants."
}

installer_cfo() {
  if ! command -v docker >/dev/null 2>&1 || ! docker ps --format '{{.Names}}' | grep -qx "${N8N_CONTAINER}"; then
    die "Conteneur ${N8N_CONTAINER} introuvable."
  fi
  command -v php >/dev/null 2>&1 || die "php introuvable sur l'hote."
  local ici patch resume id
  local dir; dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  [[ -f "${dir}/n8n/maj_workflow_cfo.php" ]] || die "n8n/maj_workflow_cfo.php absent : faites d'abord git pull."
  ici="$(mktemp)"; patch="$(mktemp)"
  n8n_exporter_tout "${ici}" || die "Export des workflows impossible (n8n export:workflow)."
  mkdir -p "${CFO_SAUVEGARDES}"
  cp "${ici}" "${CFO_SAUVEGARDES}/n8n_workflows_$(date +%Y%m%d_%H%M%S).json"
  ok "Sauvegarde des workflows : ${CFO_SAUVEGARDES}/"
  # La liste des identifiants (noms et types seulement : le contenu reste chiffre) — pour
  # rebrancher les noeuds Telegram sur le bot du CFO s'ils pointent sur un autre bot.
  local creds; creds="$(mktemp)"
  local dansc="/tmp/fm_creds_$$.json"
  if n8n_cmd export:credentials --all --output="${dansc}" >/dev/null 2>&1; then
    docker exec "${N8N_CONTAINER}" cat "${dansc}" > "${creds}" 2>/dev/null || true
    docker exec -u root "${N8N_CONTAINER}" rm -f "${dansc}" >/dev/null 2>&1 || true
  fi
  resume="$(php "${dir}/n8n/maj_workflow_cfo.php" "${ici}" "${patch}" "${creds}")" || { rm -f "${creds}"; die "Mise a jour du workflow impossible (voir message ci-dessus)."; }
  rm -f "${creds}"
  log "Workflow : ${resume}"
  if grep -q '"deja_a_jour":true' <<<"${resume}"; then
    ok "Le workflow du CFO est deja a jour. Rien a faire."
  else
    id="$(php -r '$r=json_decode($argv[1],true); echo $r["id"] ?? "";' "${resume}")"
    n8n_importer_et_publier "${patch}" "${id}" || die "Import dans n8n impossible."
    local verif; verif="$(mktemp)"
    if n8n_exporter_tout "${verif}" && grep -q 'BUILD AGENT INPUT v3' "${verif}"; then
      ok "Workflow du CFO mis a jour dans n8n (contexte et consignes servis par le VPS)."
    else
      warn "Mise a jour non retrouvee dans l'export : ouvrez le workflow dans n8n pour verifier."
    fi
    rm -f "${verif}"
  fi
  if curl -fsS -o /dev/null "http://127.0.0.1/finance/cfo_contexte.php" 2>/dev/null || [[ -f "${FINANCE_DIR}/cfo_contexte.php" ]]; then
    ok "cfo_contexte.php present sur le VPS."
  else
    warn "cfo_contexte.php absent de ${FINANCE_DIR} : le CFO utilisera sa copie de secours."
  fi
  rm -f "${ici}" "${patch}"
}

retour_cfo() {
  local der; der="$(ls -1t "${CFO_SAUVEGARDES}"/n8n_workflows_*.json 2>/dev/null | head -1 || true)"
  [[ -n "${der}" ]] || die "Aucune sauvegarde dans ${CFO_SAUVEGARDES}."
  local un id; un="$(mktemp)"
  id="$(php -r '
    $l = json_decode(file_get_contents($argv[1]), true); if (isset($l["nodes"])) $l = [$l];
    foreach ($l as $w) { $n = array_column($w["nodes"] ?? [], "name");
      if (in_array("Build Agent Input", $n, true) && in_array("AI Agent", $n, true) && !empty($w["active"])) {
        file_put_contents($argv[2], json_encode($w, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)); echo $w["id"] ?? ""; exit(0); } }
    exit(1);' "${der}" "${un}")" || die "Workflow du CFO introuvable dans ${der}."
  n8n_importer_et_publier "${un}" "${id}" || die "Import impossible."
  ok "Workflow du CFO remis comme dans ${der}."
  rm -f "${un}"
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
  if [[ "${1:-}" == "cfo" ]]; then
    installer_cfo
    return 0
  fi
  if [[ "${1:-}" == "cfo-retour" ]]; then
    retour_cfo
    return 0
  fi
  install_php_extensions
  fix_permissions
  prepare_postgres
  setup_n8n
  print_summary
}

main "$@"
