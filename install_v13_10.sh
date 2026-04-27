#!/usr/bin/env bash
# ============================================================
# install_v13_10.sh — Déploiement différentiel v13.10
# Ajoute : CFO Memory Writer + sous-workflow cfo_memory_ingest
#
# Usage : bash install_v13_10.sh [--dry-run]
#         bash install_v13_10.sh --rollback <backup_file>
#
# Variables d'environnement requises :
#   export N8N_API_KEY="<ta clé API n8n>"
#   export MAIN_WORKFLOW_ID="<ID workflow super_agent_cfo>"
#   export N8N_BASE_URL="https://n8n.beau.ink"  # valeur par défaut
# ============================================================
set -euo pipefail

N8N_BASE_URL="${N8N_BASE_URL:-https://n8n.beau.ink}"
N8N_API_KEY="${N8N_API_KEY:-}"
MAIN_WORKFLOW_ID="${MAIN_WORKFLOW_ID:-}"
PG_HOST="${PG_HOST:-127.0.0.1}"
PG_PORT="${PG_PORT:-5432}"
PG_DB="${PG_DB:-charif_finance_db}"
PG_USER="${PG_USER:-admin}"
PG_PASS="${PG_PASS:-20002000}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRY_RUN=false
ROLLBACK_FILE=""

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "${GREEN}OK  $*${NC}"; }
warn() { echo -e "${YELLOW}!!  $*${NC}"; }
err()  { echo -e "${RED}ERR $*${NC}"; exit 1; }
info() { echo -e "${BLUE}${BOLD}... $*${NC}"; }
step() { echo -e "\n${BOLD}=== $* ===${NC}"; }

# -- Parse args -------------------------------------------------------
for arg in "$@"; do [[ "$arg" == "--dry-run" ]] && DRY_RUN=true; done
ARG_ARRAY=("$@")
for i in "${!ARG_ARRAY[@]}"; do
  if [[ "${ARG_ARRAY[$i]}" == "--rollback" ]]; then
    ROLLBACK_FILE="${ARG_ARRAY[$((i+1))]:-}"
    break
  fi
done

# -- Rollback mode ----------------------------------------------------
if [[ -n "$ROLLBACK_FILE" ]]; then
  step "MODE ROLLBACK"
  [[ -f "$ROLLBACK_FILE" ]] || err "Fichier rollback introuvable : $ROLLBACK_FILE"
  [[ -z "$N8N_API_KEY" || -z "$MAIN_WORKFLOW_ID" ]] && err "N8N_API_KEY et MAIN_WORKFLOW_ID requis"
  info "Restauration de $ROLLBACK_FILE vers le workflow $MAIN_WORKFLOW_ID ..."
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -H "Content-Type: application/json" \
    -d @"$ROLLBACK_FILE" \
    "$N8N_BASE_URL/api/v1/workflows/$MAIN_WORKFLOW_ID" 2>/dev/null)
  [[ "$CODE" == "200" ]] && ok "Rollback effectué (HTTP $CODE)" || err "Rollback échoué (HTTP $CODE)"
  exit 0
fi

$DRY_RUN && warn "DRY-RUN : aucune modification ne sera appliquée"

# -- Pré-requis -------------------------------------------------------
step "Vérifications préalables"

[[ -z "$N8N_API_KEY" ]]      && err "N8N_API_KEY non défini. export N8N_API_KEY=..."
[[ -z "$MAIN_WORKFLOW_ID" ]] && err "MAIN_WORKFLOW_ID non défini. Voir MOP_v13_10.md"

AGENT_JSON="$SCRIPT_DIR/super_agent_cfo.json"
INGEST_JSON="$SCRIPT_DIR/cfo_memory_ingest.json"
[[ -f "$AGENT_JSON" ]]  || err "Fichier manquant : $AGENT_JSON"
[[ -f "$INGEST_JSON" ]] || err "Fichier manquant : $INGEST_JSON"

python3 -c "import json; json.load(open('$AGENT_JSON'))"  2>/dev/null || err "JSON malformé : super_agent_cfo.json"
python3 -c "import json; json.load(open('$INGEST_JSON'))" 2>/dev/null || err "JSON malformé : cfo_memory_ingest.json"
ok "JSON valides"

python3 -c "
import json
d = json.load(open('$AGENT_JSON'))
ids = [n['id'] for n in d['nodes']]
assert 'node-tool-memory' in ids
assert 'Tool: Memory Writer' in d['connections']
" || err "super_agent_cfo.json manque le patch v13.10. Lancer : python patch_v13_10.py"
ok "Patch v13.10 présent dans super_agent_cfo.json"

CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$N8N_BASE_URL/api/v1/workflows?limit=1" 2>/dev/null || echo "000")
[[ "$CODE" == "200" ]] || err "n8n API inaccessible (HTTP $CODE)"
ok "n8n API accessible"

# -- Étape 0 : Dimension finance_vectors ------------------------------
step "Étape 0/4 : Vérification schema finance_vectors"

if command -v psql >/dev/null 2>&1; then
  export PGPASSWORD="$PG_PASS"
  DIM=$(psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -tAc \
    "SELECT atttypmod FROM pg_attribute pa
     JOIN pg_class pc ON pc.oid = pa.attrelid
     WHERE pc.relname='finance_vectors' AND pa.attname='embedding' LIMIT 1;" 2>/dev/null || echo "")
  unset PGPASSWORD
  if [[ -z "$DIM" ]]; then
    warn "Table finance_vectors absente — sera créée au premier insert"
  elif [[ "$DIM" == "769" || "$DIM" == "768" ]]; then
    ok "finance_vectors.embedding = vector(768) — compatible gemini-embedding-001"
  elif [[ "$DIM" == "1537" || "$DIM" == "1536" ]]; then
    warn "Dimension 1536 détectée (OpenAI). Vecteurs existants incompatibles avec gemini-embedding-001."
    warn "Si tu veux repartir proprement : TRUNCATE finance_vectors; (perte des anciens vecteurs)"
  else
    warn "Dimension inconnue ($DIM) — vérifier après déploiement"
  fi
else
  warn "psql absent — vérification dimension skippée"
fi

# -- Étape 1 : Sauvegarde ---------------------------------------------
step "Étape 1/4 : Sauvegarde workflow principal (rollback)"

BACKUP="$SCRIPT_DIR/backup_super_agent_$(date +%Y%m%d_%H%M%S).json"

if ! $DRY_RUN; then
  curl -s \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    "$N8N_BASE_URL/api/v1/workflows/$MAIN_WORKFLOW_ID" \
    -o "$BACKUP"
  [[ -s "$BACKUP" ]] || err "Sauvegarde vide — MAIN_WORKFLOW_ID ($MAIN_WORKFLOW_ID) incorrect ?"
  ok "Sauvegarde : $BACKUP"
  info "Rollback disponible : bash install_v13_10.sh --rollback $BACKUP"
else
  BACKUP="[dry-run]"
  ok "DRY-RUN : sauvegarde skippée"
fi

# -- Étape 2 : Import sous-workflow -----------------------------------
step "Étape 2/4 : Import sous-workflow CFO Memory Ingest"

INGEST_WF_ID=""
if ! $DRY_RUN; then
  RESP=$(curl -s -w "\n%{http_code}" -X POST \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -H "Content-Type: application/json" \
    -d @"$INGEST_JSON" \
    "$N8N_BASE_URL/api/v1/workflows" 2>/dev/null)
  CODE=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | head -n -1)

  if [[ "$CODE" == "200" || "$CODE" == "201" ]]; then
    INGEST_WF_ID=$(echo "$BODY" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id','?'))" 2>/dev/null || echo "?")
    ok "Sous-workflow importé (ID : $INGEST_WF_ID)"
    ACT=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
      -H "X-N8N-API-KEY: $N8N_API_KEY" \
      "$N8N_BASE_URL/api/v1/workflows/$INGEST_WF_ID/activate" 2>/dev/null || echo "000")
    [[ "$ACT" == "200" ]] && ok "Sous-workflow activé" || warn "Activer manuellement dans n8n UI (HTTP $ACT)"
  else
    err "Import échoué (HTTP $CODE). Body : $BODY"
  fi
else
  ok "DRY-RUN : import skippé"
fi

# -- Étape 3 : Mise à jour workflow principal -------------------------
step "Étape 3/4 : Mise à jour Super-Agent CFO"

if ! $DRY_RUN; then
  RESP=$(curl -s -w "\n%{http_code}" -X PUT \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -H "Content-Type: application/json" \
    -d @"$AGENT_JSON" \
    "$N8N_BASE_URL/api/v1/workflows/$MAIN_WORKFLOW_ID" 2>/dev/null)
  CODE=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | head -n -1)
  if [[ "$CODE" == "200" ]]; then
    ok "Super-Agent CFO mis à jour (v13.10)"
  else
    err "Mise à jour échouée (HTTP $CODE).\nBody: $BODY\nRollback: bash install_v13_10.sh --rollback $BACKUP"
  fi
else
  ok "DRY-RUN : mise à jour skippée"
fi

# -- Étape 4 : Test smoke ---------------------------------------------
step "Étape 4/4 : Test smoke webhook ingestion"
sleep 3

if ! $DRY_RUN; then
  RESP=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{"texte":"TEST_v13_10_install — ignorer cette entree","categorie":"general","session_id":"smoke_test"}' \
    --max-time 30 \
    "$N8N_BASE_URL/webhook/finance-memory-ingest" 2>/dev/null)
  CODE=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | head -n -1)
  if [[ "$CODE" == "200" ]]; then
    STATUS=$(echo "$BODY" | python3 -c "import json,sys; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null || echo "?")
    [[ "$STATUS" == "ok" ]] && ok "Webhook ingestion OK (status=ok)" \
      || warn "HTTP 200 mais status=$STATUS — vérifier le sous-workflow"
  else
    warn "Webhook a répondu HTTP $CODE — vérifier le sous-workflow dans n8n UI"
  fi
else
  ok "DRY-RUN : smoke test skippé"
fi

# -- Résumé -----------------------------------------------------------
echo ""
echo -e "${GREEN}${BOLD}======================================================${NC}"
echo -e "${GREEN}${BOLD}  Déploiement v13.10 terminé avec succès${NC}"
echo -e "${GREEN}${BOLD}======================================================${NC}"
echo ""
echo -e "${BOLD}Rollback si nécessaire :${NC}"
echo "  bash install_v13_10.sh --rollback $BACKUP"
echo ""
echo -e "${BOLD}Tests manuels (voir MOP_v13_10.md §5) :${NC}"
echo "  1. n8n UI : CFO Memory Ingest — webhook actif"
echo "  2. n8n UI : Super-Agent CFO — noeud Memory Writer présent"
echo "  3. Chat : 'Retiens que je préfère les Airbnb'"
echo "  4. Chat : 'Qu est-ce que tu sais sur mes préférences ?'"
$DRY_RUN && echo "" && warn "DRY-RUN terminé — aucune modification effectuée"
