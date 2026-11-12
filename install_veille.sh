#!/usr/bin/env bash
# =============================================================================
#  install_veille.sh — installe la COLLECTE CONTINUE de la veille (v37.134)
# -----------------------------------------------------------------------------
#  sudo bash install_veille.sh                 installe (ou met à jour) la tâche planifiée
#  sudo bash install_veille.sh --brave CLE     idem + active Brave Search avec cette clé
#  sudo bash install_veille.sh --max 1000      plafond d'appels Brave par mois (1000 par défaut)
#  sudo bash install_veille.sh --desinstaller  retire la tâche planifiée
#
#  Sans éditeur, sans question : détecte l'utilisateur du PHP du site, écrit
#  la tâche (toutes les 10 min, jamais deux à la fois), vérifie l'accès à la
#  base, lance un premier passage et affiche l'état. Rejouable sans risque.
# =============================================================================
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$DIR/cfo_veille_collecte.php"
ENVF="/etc/fm-veille.env"
LOG="/var/log/fm-veille.log"
MARQUE="# fm-veille (install_veille.sh)"
BRAVE=""; MAX=""; DESINSTALLER=0

while [ $# -gt 0 ]; do
  case "$1" in
    --brave) BRAVE="${2:-}"; shift 2 ;;
    --max) MAX="${2:-}"; shift 2 ;;
    --desinstaller) DESINSTALLER=1; shift ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "✖ option inconnue : $1 (voir --help)"; exit 2 ;;
  esac
done

[ "$(id -u)" -eq 0 ] || { echo "✖ à lancer avec sudo : sudo bash $0"; exit 1; }
[ -f "$SCRIPT" ] || { echo "✖ $SCRIPT introuvable (faire d'abord : git pull)"; exit 1; }
PHP="$(command -v php || true)"
[ -n "$PHP" ] || { echo "✖ php introuvable"; exit 1; }

# L'utilisateur qui fait tourner le PHP du site (php-fpm), sinon www-data
U="$(ps -eo user:32,comm | awk '$2 ~ /php-fpm|php[0-9.]*-fpm/ && $1 != "root" {print $1; exit}')"
[ -n "$U" ] || U="www-data"
id "$U" >/dev/null 2>&1 || { echo "✖ utilisateur $U introuvable"; exit 1; }
echo "▸ utilisateur du PHP : $U"

retirer() { (crontab -u "$U" -l 2>/dev/null || true) | grep -v -F "$MARQUE" | grep -v 'cfo_veille_collecte.php' || true; }

if [ "$DESINSTALLER" -eq 1 ]; then
  retirer | crontab -u "$U" -
  echo "✔ tâche planifiée retirée (les articles déjà collectés restent dans la base)"
  exit 0
fi

# Brave Search (optionnel) : la clé dans un fichier lisible par $U seul, jamais dans git
if [ -n "$BRAVE" ] || [ -n "$MAX" ]; then
  touch "$ENVF"; chown root:"$U" "$ENVF"; chmod 640 "$ENVF"
  if [ -n "$BRAVE" ]; then
    grep -v '^BRAVE_API_KEY=' "$ENVF" > "$ENVF.tmp" || true
    printf 'BRAVE_API_KEY=%q\n' "$BRAVE" >> "$ENVF.tmp"; cat "$ENVF.tmp" > "$ENVF"; rm -f "$ENVF.tmp"
    echo "✔ clé Brave enregistrée dans $ENVF (lisible par root et $U seulement)"
  fi
  if [ -n "$MAX" ]; then
    case "$MAX" in (*[!0-9]*|'') echo "✖ --max attend un nombre"; exit 2 ;; esac
    grep -v '^BRAVE_MAX_APPELS_MOIS=' "$ENVF" > "$ENVF.tmp" || true
    echo "BRAVE_MAX_APPELS_MOIS=$MAX" >> "$ENVF.tmp"; cat "$ENVF.tmp" > "$ENVF"; rm -f "$ENVF.tmp"
    echo "✔ plafond Brave : $MAX appels / mois"
  fi
fi

# Le journal
touch "$LOG"; chown "$U" "$LOG"; chmod 640 "$LOG"

# La tâche planifiée : toutes les 10 minutes, jamais deux à la fois
LIGNE="*/10 * * * * [ -r $ENVF ] && set -a && . $ENVF && set +a; flock -n /tmp/fm-veille.lock $PHP $SCRIPT >> $LOG 2>&1 $MARQUE"
{ retirer; echo "$LIGNE"; } | crontab -u "$U" -
echo "✔ tâche planifiée installée pour $U (toutes les 10 minutes)"

# Vérifications : base joignable, premier passage, état
lancer() { sudo -u "$U" bash -c "[ -r $ENVF ] && set -a && . $ENVF && set +a; $PHP $SCRIPT $*"; }
echo "▸ premier passage…"
if ! lancer >> "$LOG" 2>&1; then
  echo "✖ le premier passage a échoué — fin du journal :"; tail -n 5 "$LOG"; exit 1
fi
tail -n 1 "$LOG"
echo "▸ état :"
lancer etat
echo
echo "✔ terminé. Suivre la collecte :  tail -f $LOG"
echo "  Rien ne se collecte tant qu'aucune Recherche Éclair n'a été lancée sur un bien (c'est elle qui enregistre ses requêtes)."
