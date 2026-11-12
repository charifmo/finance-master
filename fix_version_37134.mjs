/* v37.134 La veille qui travaille seule — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.133 Le Réalisé écrit dans le journal";`, `const CURRENT_VERSION = "37.134 La veille qui travaille seule";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.133 Le Réalisé écrit dans le journal", date: "2026-11-12", changes: [`,
`                    const CHANGELOG = [
        { version: "37.134 La veille qui travaille seule", date: "2026-11-12", changes: [
            "🗂️ « À CHAQUE FOIS JE DOIS AJOUTER DES SITES ET DES MOTS-CLÉS À L'INFINI » (plan revu avec Fable) — LA COLLECTE CONTINUE : chaque Recherche Éclair enregistre ses requêtes (lieux × sujets, grands projets, presse locale et nationale, pages de recherche des journaux…) pour le bien ; un cron les rejoue CHAQUE JOUR, par petits lots, sans la limite de 20 s. Google Actualités ne rend qu'une centaine de résultats mélangés : rejoué jour après jour, le corpus du bien s'accumule (un article raté un jour est attrapé le lendemain). À la Recherche Éclair suivante, ce corpus rejoint les candidats et passe le tri par l'IA, comme avant. L'écran dit « 🗂️ collecte continue : N articles accumulés par M requêtes (dernière collecte …) ».",
            "🔎 Option Brave Search (API officielle) : avec une clé dans db_config.php (« brave_api_key »), chaque requête « moteur » est aussi posée à Brave, dans un plafond d'appels par mois (« brave_max_appels_mois », 1 000 par défaut ; réservé avant l'appel, le reste attend le mois suivant). Sans clé : rien ne change.",
            "🧭 Les domaines inconnus qui reviennent dans les résultats sont PROPOSÉS (commande « etat ») — jamais lus d'office. Une source qui répond 403 / 429 est mise en pause 24 h : pas de proxy, pas de rotation d'IP, pas de contournement de captcha (Facebook et Instagram restent hors d'atteinte sans accès officiel).",
            "Sur le VPS : cron toutes les 10 minutes — « flock -n /tmp/fm-veille.lock php /var/www/finance/cfo_veille_collecte.php » ; « php cfo_veille_collecte.php etat » pour voir l'état. Tables veille_* créées toutes seules dans la base PostgreSQL de l'appli.",
            "PREUVE — nouvelle suite test_veille_collecte (14 contrôles, SQLite ; les mêmes 14 passés sur PostgreSQL 16) : 48 requêtes enregistrées + 31 jumelles Brave sans « when: », planifiées une fois par jour, un lot (article du Le360 daté du 10 nov. rangé ; 429 → pause 24 h ; page vide), le corpus revient à la revue suivante et passe la sélection, un autre bien n'en hérite pas, domaine inconnu proposé, Brave plafonné à 2 appels (le reste en attente), date Brave (page_age) sans date inventée.",
        ] },
        { version: "37.133 Le Réalisé écrit dans le journal", date: "2026-11-12", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.134');
