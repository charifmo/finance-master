/* v37.38 Memoire-Garantie — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.37 Surplus-Courant-Reel";`, `const CURRENT_VERSION = "37.38 Memoire-Garantie";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.37 Surplus-Courant-Reel", date: "2026-10-09", changes: [`,
`                    const CHANGELOG = [
        { version: "37.38 Memoire-Garantie", date: "2026-10-09", changes: [
            "LE CFO AFFIRMAIT DES ÉCRITURES QU'IL N'AVAIT PAS FAITES — « Mémorise ces deux actifs » : un seul appel memory_writer (Actif Nord), puis « j'ai mémorisé les deux ». L'Actif Est / Al Ouidane n'a jamais atteint la base. La garantie ne dépend plus du modèle qui a oublié : le GARDE-MÉMOIRE (cfo_memoire_garde.php) relit chaque échange, découpe la demande en entités, cherche chacune dans la mémoire, écrit celles qui manquent par le même webhook que memory_writer, puis les RELIT en base.",
            "UN APPEL PAR ENTITÉ, EXIGÉ — toute demande de mémorisation part avec une consigne explicite : un appel memory_writer par actif, règle ou préférence, et « mémorisé » seulement pour les appels réussis. La consigne n'apparaît ni dans votre bulle, ni dans la Supervision IA.",
            "LE REÇU — chaque demande de mémorisation est suivie d'un « 🔒 Reçu de mémorisation » : entité par entité, ce que la BASE contient (en mémoire, rattrapée, en échec, effacée par vous). Exactement une fois (registre et verrou atomique), jamais de résurrection d'une règle effacée dans la Supervision IA, échec d'écriture repris automatiquement, demandes Telegram rattrapées à l'ouverture et au retour sur l'onglet. Première passe sur 30 jours : l'Actif Est oublié est rattrapé au premier chargement.",
            "LA RECHERCHE ÉCLAIR CONNAÎT LE BIEN — « Actualiser » lit d'abord la fiche mémorisée de l'actif (Terrain Nord → 7 hectares · SHL2 · RN9 · indivision), la cite telle quelle avec la fiche de l'application, et exige 2 à 3 requêtes expertes qui combinent ces variables — les requêtes génériques (« prix villa ») sont interdites, les requêtes utilisées listées. Sans fiche, l'agent doit consulter sa mémoire avant le web. La carte montre la fiche injectée et ses variables.",
            "SANS RÉIMPORT n8n — tout passe par l'application et le serveur : un git pull suffit. PREUVE — deux suites nouvelles : « Garde-mémoire » (57 contrôles) et « Mémorisation garantie · Recherche Éclair ciblée » (53 contrôles, PostgreSQL réel, php -S, navigateur). Rejouées sur la v37.37, elles retrouvent le bug : Actif Nord en base, Actif Est absent, aucun reçu, question générique (30 échecs). Dix-huit défauts réintroduits exprès : tous attrapés.",
        ] },
        { version: "37.37 Surplus-Courant-Reel", date: "2026-10-09", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.38 Memoire-Garantie');
