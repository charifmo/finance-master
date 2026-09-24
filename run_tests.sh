#!/bin/sh
# v36.0 — Toutes les garanties du moteur CFO, en une commande.
#   À jouer avant tout push touchant cfo_intent_engine.php ou le workflow n8n.
set -e
cd "$(dirname "$0")"
echo "▸ Syntaxe PHP"
for f in cfo_intent_engine.php cfo_integrity.php pending_commit.php tools_schema.php save_data.php get_ai_memory.php repair_finance_data.php; do
    [ -f "$f" ] && php -l "$f" > /dev/null && echo "  ✅ $f"
done
echo "▸ Schéma n8n ↔ contrat d'arguments"
php tools_schema.php --check
echo "▸ Parité différentielle JS/PHP"
cd test_cfo_engine_parity
node run_js.mjs > /dev/null && php run_php.php > /dev/null && python3 compare.py | tail -2
echo "▸ Matrice de robustesse du catalogue"
php test_robustesse.php | tail -2
echo "▸ Discipline de résolution (comptes / objectifs / actifs / épargne)"
php test_resolution.php | tail -2
echo "▸ Cohérence des schémas d'objectif"
php test_schema_goals.php | tail -2
echo "▸ Intégrité des données écrites"
php test_integrite.php | tail -2
echo "▸ Tri du bruit (Supervision IA)"
php test_supervision.php | tail -2
echo "▸ Lecture des réponses du CFO"
node test_reponse_cfo.mjs | tail -2
echo "▸ Conversion des dates cibles"
php test_dates.php | tail -2
echo "✅ Toutes les suites passent."
