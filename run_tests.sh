#!/bin/sh
# v36.0 — Toutes les garanties du moteur CFO, en une commande.
#   À jouer avant tout push touchant cfo_intent_engine.php ou le workflow n8n.
#
# v37.7 — LE LANCEUR MENTAIT. Chaque suite était tuyautée dans `tail -2` : sous
#   `set -e`, c'est le code de sortie de `tail` qui compte, jamais celui de la
#   suite. Une suite en échec affichait donc sa ligne « ❌ » puis le lanceur
#   concluait « ✅ Toutes les suites passent » et rendait 0. Vérifié : la suite
#   de rafraîchissement sabotée sortait bien en 1, et le pipeline rendait 0.
#   On capture désormais la sortie, on teste le code de la SUITE, et on ne
#   résume qu'après.
set -e
cd "$(dirname "$0")"

suite() {
    desc=$1; shift
    echo "▸ $desc"
    if sortie=$("$@" 2>&1); then
        printf '%s\n' "$sortie" | tail -2
    else
        code=$?
        printf '%s\n' "$sortie" | tail -25
        echo "❌ ÉCHEC ($code) : $desc"
        exit 1
    fi
}

echo "▸ Syntaxe PHP"
for f in cfo_intent_engine.php cfo_integrity.php pending_commit.php tools_schema.php save_data.php get_ai_memory.php repair_finance_data.php; do
    [ -f "$f" ] && php -l "$f" > /dev/null && echo "  ✅ $f"
done

suite "Schéma n8n ↔ contrat d'arguments"                        php tools_schema.php --check
suite "Parité différentielle JS/PHP"                            sh -c 'cd test_cfo_engine_parity && node run_js.mjs > /dev/null && php run_php.php > /dev/null && python3 compare.py'
suite "Matrice de robustesse du catalogue"                      php test_cfo_engine_parity/test_robustesse.php
suite "Discipline de résolution (comptes / objectifs / actifs)" php test_cfo_engine_parity/test_resolution.php
suite "Cohérence des schémas d'objectif"                        php test_cfo_engine_parity/test_schema_goals.php
suite "Intégrité des données écrites"                           php test_cfo_engine_parity/test_integrite.php
suite "Tri du bruit (Supervision IA)"                           php test_cfo_engine_parity/test_supervision.php
suite "Lecture des réponses du CFO"                             node test_cfo_engine_parity/test_reponse_cfo.mjs
suite "Conversion des dates cibles"                             php test_cfo_engine_parity/test_dates.php
suite "Retour d'écriture (écran ↔ serveur)"                     node test_cfo_engine_parity/test_rafraichissement.mjs
suite "Projection patrimoniale (identité de caisse)"            node test_cfo_engine_parity/test_projection.mjs

echo "✅ Toutes les suites passent."
