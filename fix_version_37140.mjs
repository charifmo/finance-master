/* v37.140 La calibration foncière (étape 1) — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.139 L'article du jour";`, `const CURRENT_VERSION = "37.140 La calibration foncière";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.139 L'article du jour", date: "2026-11-12", changes: [`,
`                    const CHANGELOG = [
        { version: "37.140 La calibration foncière", date: "2026-11-13", changes: [
            "📐 INTELLIGENCE MARCHÉ DEVIENT UN OUTIL DE CALIBRATION (étape 1) — la décision d'abord, les articles ensuite (ils deviennent les preuves). En tête : la valeur retenue, son STATUT (« hypothèse utilisateur — non validée par comparables » tant que vous n'avez rien validé), le niveau de confiance, le nombre de comparables valides (dont fiables), la date de calibration et la dernière évolution importante. Moins de 3 comparables : « Projection non calibrée : données insuffisantes. La valeur de … DH/m² reste une hypothèse conservée, non une estimation calculée. »",
            "🏷️ PRIX OBSERVÉS : un tableau (source, localisation, surface, prix, DH/m², zonage, comparabilité, date) qui sépare transactions réelles, estimations d'agence, références administratives, annonces (toujours « prix demandé ») et signaux de marché ; les annonces de la veille s'y ajoutent, « 📌 Garder » les conserve pour ce bien ; « ➕ Ajouter un prix observé » pour ce que vous savez (notaire, agence, référence). Un nuage surface / prix au m² (échelle log) avec votre terrain et la zone de comparabilité (surface ÷4 à ×4).",
            "📏 RÈGLES, calculées par l'application (le CFO explique, il ne calcule pas) : moins de 3 comparables réellement proches → aucune estimation ; annonces seulement → fourchette INDICATIVE, jamais une valeur de marché ; zonage différent → à part, jamais mélangé ; « Valider cette calibration » date et fige ce que vous avez vu, sans jamais changer la valeur retenue toute seule. Le CFO reçoit ce statut et ne peut plus écrire « solidement ancrée » d'une hypothèse non validée ; un projet annoncé est un impact potentiel, un budget multi-villes n'est pas attribué à Marrakech.",
            "🕓 « NOUVEAU : 2025-02-05 — visite de chantier… » : un article ancien qu'on vient seulement de découvrir est maintenant « ancien, découvert récemment », jamais « nouvel événement ».",
            "PREUVE — test_veille_presse.mjs (110) : bandeau non calibré, phrase exacte, tableau et nuage, statut transmis au CFO avec l'interdit ; annonce gardée, saisie sans prix refusée, 2 saisies → 3 comparables dont 2 fiables, confiance « moyen », fourchette 250–450 (médiane 300) non indicative, référence agricole à part ; validation sans changement de valeur ; « ancien, découvert récemment » à l'écran et dans la question. test_veille_presse.php (124) : statut ancien_decouvert.",
        ] },
        { version: "37.139 L'article du jour", date: "2026-11-12", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.140');
