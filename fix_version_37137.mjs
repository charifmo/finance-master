/* v37.137 Brave pour les réseaux sociaux — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.136 Une revue qui trie mieux";`, `const CURRENT_VERSION = "37.137 Brave pour les réseaux sociaux";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.136 Une revue qui trie mieux", date: "2026-11-12", changes: [`,
`                    const CHANGELOG = [
        { version: "37.137 Brave pour les réseaux sociaux", date: "2026-11-12", changes: [
            "📱 « LES RÉSULTATS DES RÉSEAUX SOCIAUX NE SONT PAS LÀ » — DuckDuckGo bloque l'adresse du serveur (« page de consentement ou de blocage »), Bing (web) ne rend rien : les réseaux sociaux, forums et annonces restaient à 0. Avec votre clé Brave Search (API officielle, installée par install_veille.sh), la Recherche Éclair interroge maintenant BRAVE à la place de DuckDuckGo pour ces trois familles (pages et groupes publics Facebook, Instagram, YouTube ; Yabiladi, Bladi ; Avito, Mubawab…). Chaque appel compte dans le plafond du mois, réservé AVANT l'appel ; plafond atteint : DuckDuckGo comme avant, et la raison est dite. La clé est lue au moment de l'appel : jamais renvoyée au navigateur, jamais enregistrée dans la base. Le cron rejoue aussi ces requêtes Brave, dans le même plafond.",
            "🐞 Le plafond Brave n'était pas respecté avec SQLite (« appels + '3' <= '4' » toujours vrai : un calcul comparé à un texte) — nombres liés en entiers ; PostgreSQL n'était pas touché.",
            "🗂️ « etat » dit maintenant « dernier_passage_cron » et « taches_traitees » : la preuve que la collecte tourne sans ouvrir l'appli.",
            "PREUVE — test_veille_presse.mjs (94) : le vrai point d'entrée, une fausse API Brave locale — réseaux sociaux, forums, annonces par Brave (aucune requête DuckDuckGo), le post Facebook et l'annonce Avito dans les candidats, la clé en en-tête et nulle part ailleurs (ni réponse, ni base), plafond atteint → DuckDuckGo et raison dite ; test_veille_collecte (19, SQLite et PostgreSQL 16) : plafond 5 (3 oui, 3 non, 2 oui, 1 non), requête web Brave non planifiée sans clé, rejouée dans le plafond avec clé.",
        ] },
        { version: "37.136 Une revue qui trie mieux", date: "2026-11-12", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.137');
