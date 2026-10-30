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

# v37.8 — Les deux suites « navigateur » (un seul atterrissage, simulateur)
#   ont besoin de dépendances locales NON versionnées. Sans elles, elles
#   s'ignorent proprement au lieu d'échouer :
#       npm install --no-save vue@3 playwright-core chart.js tailwindcss@3
#   Chromium est fourni par l'environnement (/opt/pw-browsers/chromium) ;
#   sinon, pointer CHROMIUM=/chemin/vers/chrome.

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
for f in cfo_intent_engine.php cfo_integrity.php cfo_rag_ids.php pending_commit.php tools_schema.php save_data.php get_ai_memory.php repair_finance_data.php cfo_memoire_lib.php cfo_memoire_garde.php cfo_veille_lib.php cfo_veille_presse.php cfo_veille_serveur.php cfo_veille_sources.php; do
    [ -f "$f" ] && php -l "$f" > /dev/null && echo "  ✅ $f"
done

suite "Schéma n8n ↔ contrat d'arguments"                        php tools_schema.php --check
suite "Parité différentielle JS/PHP"                            sh -c 'cd test_cfo_engine_parity && node run_js.mjs > /dev/null && php run_php.php > /dev/null && python3 compare.py'
suite "Matrice de robustesse du catalogue"                      php test_cfo_engine_parity/test_robustesse.php
suite "Discipline de résolution (comptes / objectifs / actifs)" php test_cfo_engine_parity/test_resolution.php
suite "Cohérence des schémas d'objectif"                        php test_cfo_engine_parity/test_schema_goals.php
suite "Intégrité des données écrites"                           php test_cfo_engine_parity/test_integrite.php
suite "Tri du bruit (Supervision IA)"                           php test_cfo_engine_parity/test_supervision.php
suite "Suppression d'une règle RAG (identifiants)"              php test_cfo_engine_parity/test_suppression_rag.php
suite "Lecture des réponses du CFO"                             node test_cfo_engine_parity/test_reponse_cfo.mjs
suite "Conversion des dates cibles"                             php test_cfo_engine_parity/test_dates.php
suite "Retour d'écriture (écran ↔ serveur)"                     node test_cfo_engine_parity/test_rafraichissement.mjs
suite "Projection patrimoniale (identité de caisse)"            node test_cfo_engine_parity/test_projection.mjs
suite "Objectifs adossés & clés de compte (PHP)"                php test_cfo_engine_parity/test_objectif_lie.php
suite "Un seul atterrissage (bandeau = Relevé = IA = projection)" node test_cfo_engine_parity/test_une_seule_verite.mjs
suite "Simulateur dans le navigateur (UI + Chart.js)"           node test_cfo_engine_parity/test_sandbox_ui.mjs
suite "Chat CFO dans le navigateur (ergonomie)"                 node test_cfo_engine_parity/test_chat_ui.mjs
suite "Pilotage Réalisé (suivi par cycle)"                      node test_cfo_engine_parity/test_cycle_realise.mjs
suite "Mois budgétaire vs mois civil (exceptions)"              node test_cfo_engine_parity/test_mois_budgetaire.mjs
suite "Relevé : rangement et ordre par cycle de paie"           node test_cfo_engine_parity/test_releve_cycle.mjs
suite "Créances : encaissées dans le solde, en attente au journal" node test_cfo_engine_parity/test_creances_encaissees.mjs
suite "Cockpit du Pilotage (KPIs, file, bulles)"                node test_cfo_engine_parity/test_cockpit_pilotage.mjs
suite "Météo financière & respiration du Prévisionnel"          node test_cfo_engine_parity/test_meteo.mjs
suite "Logistique bancaire (routage, radar, focus)"             node test_cfo_engine_parity/test_logistique.mjs
suite "Deux PC, un seul état (vrai save_data.php)"               node test_cfo_engine_parity/test_deux_pc.mjs
suite "Reste à dépenser du cycle (vrac, rythme, rôles)"         node test_cfo_engine_parity/test_reste_a_depenser.mjs
suite "Rayons X & routage bancaire évident"                    node test_cfo_engine_parity/test_rayons_x.mjs
suite "Semaines du cycle = ses jours ÷ 7 (plus × 4,3, plus de jeudi)" node test_cfo_engine_parity/test_semaines_cycle.mjs
suite "Semaines du cycle = ses jours ÷ 7 — serveur (PHP)"        php test_cfo_engine_parity/test_semaines_cycle.php
suite "Un rythme par ligne de détail (/sem, /15j, /cycle)"     node test_cfo_engine_parity/test_rythmes.mjs
suite "Un rythme par ligne — serveur (PHP)"                    php test_cfo_engine_parity/test_rythmes.php
suite "Semaine écoulée sans saisie = son prévu"               node test_cfo_engine_parity/test_prevu_par_defaut.mjs
suite "L'interface se souvient · le découvert d'abord"          node test_cfo_engine_parity/test_memoire_alerte.mjs
suite "La Météo montre où finit chaque compte"                 node test_cfo_engine_parity/test_atterrissage_comptes.mjs
suite "Un flux pointé n'est plus projeté · tiroirs"         node test_cfo_engine_parity/test_pointage_tiroirs.mjs
suite "Les virements internes bougent les soldes"             node test_cfo_engine_parity/test_virements_internes.mjs
suite "L'épargne du mois, même déjà versée"                  node test_cfo_engine_parity/test_epargne_du_mois.mjs
suite "Le virement vers le compte des charges sort du surplus" node test_cfo_engine_parity/test_surplus_virements.mjs
suite "Le virement sort du net du Courant — serveur (PHP)"    php test_cfo_engine_parity/test_surplus_virements.php
suite "Garde-mémoire : demandes, entités, recouvrement"        php test_cfo_engine_parity/test_garde_memoire.php
suite "Mémorisation garantie · Recherche Éclair ciblée"       node test_cfo_engine_parity/test_garde_memoire.mjs
suite "Revue de presse locale : requêtes, flux, tri"          php test_cfo_engine_parity/test_veille_presse.php
suite "Presse sans flux ni curl : pages, secours, réseau"   php test_cfo_engine_parity/test_veille_sans_flux.php
suite "La presse marrakchie lue avant la réponse"             node test_cfo_engine_parity/test_veille_presse.mjs
suite "Médias de la veille : saisie, contrôles, superposition" php test_cfo_engine_parity/test_veille_sources.php
suite "Médias réglables depuis l'écran (vraie base)"         node test_cfo_engine_parity/test_veille_sources.mjs
suite "Interface de bureau : lisibilité, menus, synthèse"     node test_cfo_engine_parity/test_gui_desktop.mjs
suite "Contrôle anti-hameçonnage (install.sh securite)"      php test_cfo_engine_parity/test_install_securite.php
suite "Bilan métier & barre latérale (pied toujours visible)" node test_cfo_engine_parity/test_bilan_metier.mjs
suite "Charges variables : une déduction par semaine au Relevé" node test_cfo_engine_parity/test_variables_semaine.mjs
suite "Surplus : périmètre de fonctionnement (brut, épargne, net)" node test_cfo_engine_parity/test_surplus_fonctionnement.mjs
suite "Semaine saisie en partie : tapé = compté, vide = prévu" node test_cfo_engine_parity/test_semaine_partielle.mjs
suite "Catégorisation : règles hors-ligne, IA, doute à vous" node test_cfo_engine_parity/test_categorisation.mjs
suite "Un compte par ligne · budget sans mode édition"         node test_cfo_engine_parity/test_compte_par_ligne.mjs
suite "Clôturer une case · semaine, 15 j, cycle"               node test_cfo_engine_parity/test_cloture.mjs
suite "Catégorisation automatique : règles → IA → par défaut"   node test_cfo_engine_parity/test_categorisation_auto.mjs
suite "Banque : calibrage RIB, lecture locale, réconciliation"  node test_cfo_engine_parity/test_banque.mjs
suite "Banque : vraies captures, téléphone d'abord"  node test_cfo_engine_parity/test_banque_reel.mjs
suite "Banque : calibrer une fois, le bon solde toujours"  node test_cfo_engine_parity/test_calibrage_rib.mjs
suite "Tickets : cumulés sur leur ligne (Marjane)"  node test_cfo_engine_parity/test_ligne_cumul.mjs
suite "Journal : chercher, ranger par catégorie, corriger, retenir"  node test_cfo_engine_parity/test_journal.mjs
suite "Leçons : l'IA lit le cycle, vous gardez"                 node test_cfo_engine_parity/test_lecons_ia.mjs
suite "Telegram : chaque réponse arrive, et seulement chez vous"  node test_cfo_engine_parity/test_telegram.mjs
suite "Banque : chaque montant sur sa ligne (imports décalés réparés)"  node test_cfo_engine_parity/test_banque_rangees.mjs
suite "Apprentissage : une correction, retenue (catégories, noms, choix d'import)"  node test_cfo_engine_parity/test_apprentissage.mjs
suite "Saisie : simple et juste (montant lu, bonne date, bonne année, annuler)"  node test_cfo_engine_parity/test_saisie.mjs
suite "Boutons flottants : 🧠 📑 ➕ sur une rangée"  node test_cfo_engine_parity/test_boutons.mjs
suite "En-tête : le patrimoine projeté en haut à droite (détail des comptes)"  node test_cfo_engine_parity/test_entete.mjs
suite "Revenu arrivé ailleurs : pourquoi ce découvert, le virement déjà fait"  node test_cfo_engine_parity/test_revenu_ailleurs.mjs
suite "Semaines coupées par la paie : chaque morceau dans son cycle"  node test_cfo_engine_parity/test_semaines_coupees.mjs
suite "Sur tout le cycle, séances à la quinzaine, frise du cycle"      node test_cfo_engine_parity/test_frise_cycle.mjs
suite "Le CFO lit le moteur (comptes, exceptions, virement vers le Courant), Annuler 50 pas"  node test_cfo_engine_parity/test_cfo_lit_le_moteur.mjs
suite "En-têtes de compte ignorés à l’import, corrections approuvées (schéma 23)"  node test_cfo_engine_parity/test_corrections_approuvees.mjs
suite "Le workflow n8n du CFO : une coquille, contexte et consignes servis par le VPS"  node test_cfo_engine_parity/test_cfo_coquille.mjs
suite "Une épargne va toujours sur un vrai compte (appli)"  node test_cfo_engine_parity/test_epargne_rattachee.mjs
suite "Une épargne va toujours sur un vrai compte (moteur du CFO)"  php test_cfo_engine_parity/test_epargne_compte.php
suite "Attijari « Mes comptes » : le compte reconnu (n°, solde, empreinte)"  node test_cfo_engine_parity/test_attijari_mes_comptes.mjs
suite "Un virement à faire se programme, il ne change pas les soldes (moteur du CFO)"  php test_cfo_engine_parity/test_virement_programme.php
suite "Attente du CFO : chronomètre et vraies étapes (zéro token), virement vers le Courant"  node test_cfo_engine_parity/test_attente_cfo.mjs
suite "Jour exact : chocs et virements du Calendrier Pluriannuel, cycle suivant après la paie"  node test_cfo_engine_parity/test_jour_exact.mjs
suite "Vos comptes : aujourd’hui, au plus bas, fin de cycle ; virements à prévoir ; version à jour"  node test_cfo_engine_parity/test_comptes_cycle.mjs
suite "Dictionnaire et variantes : Carrefour sûr, vos corrections apprises, frise visible"  node test_cfo_engine_parity/test_dictionnaire_variantes.mjs
suite "Le cycle se lit comme le Relevé : dates, pourquoi du point bas, dépassements, zoom"  node test_cfo_engine_parity/test_cycle_lisible.mjs
suite "Le journal règle sa ligne du Pilotage (factures, fixes, épargne)"  node test_cfo_engine_parity/test_journal_regle.mjs
suite "Des dates, partout : plus aucun « j.N » ni « J−N »"  node test_cfo_engine_parity/test_dates_partout.mjs
suite "Le même jour : les entrées d’abord, la grande case dit où elle regarde et quel virement avancer"  node test_cfo_engine_parity/test_meme_jour.mjs
suite "Les deux graphiques du Bilan : par compte, par type de charges"  node test_cfo_engine_parity/test_graphiques_bilan.mjs
suite "Le CFO se branche tout seul : l’adresse du webhook déduite du serveur"  node test_cfo_engine_parity/test_webhook_defaut.mjs
suite "Un revenu négatif est une sortie : Relevé, Surplus, Respiration, Bilan"  node test_cfo_engine_parity/test_revenu_negatif.mjs

echo "✅ Toutes les suites passent."
