/* v37.40 Sources-Presse-Reglables — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.39 Veille-Presse-Locale";`, `const CURRENT_VERSION = "37.40 Sources-Presse-Reglables";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.39 Veille-Presse-Locale", date: "2026-10-09", changes: [`,
`                    const CHANGELOG = [
        { version: "37.40 Sources-Presse-Reglables", date: "2026-10-09", changes: [
            "LES JOURNAUX DE LA VEILLE SE GÈRENT DEPUIS L'ÉCRAN — fenêtre « 📰 Sources de la revue de presse », ouverte depuis la Supervision IA (« 📰 Sources presse ») ou depuis chaque carte Intelligence marché (« 📰 Sources »). Ajouter un média (nom, site — une adresse copiée suffit —, presse locale ou nationale, arabe ou français, recherche RSS WordPress en une case), le modifier, le mettre en pause, le retirer, le rétablir, revenir à la liste d'origine. Chaque action est enregistrée aussitôt.",
            "TESTER UN MÉDIA — 🧪 interroge le média tout de suite : nombre d'articles trouvés par Google Actualités sur son site, le dernier titre et sa date, et le résultat de son flux RSS. On sait avant le prochain « Actualiser » si la source répond.",
            "VOS RÉGLAGES NE BLOQUENT JAMAIS LE git pull — ils sont enregistrés dans PostgreSQL (table cfo_veille_sources), pas dans veille_sources.json, qui reste la liste d'origine. Un média livré plus tard par une mise à jour apparaît, marqué « nouvelle » ; un média que vous avez retiré le reste. Sans base joignable, la liste d'origine s'applique et la fenêtre le dit.",
            "CONTRÔLES — un vrai site (ni adresse IP, ni localhost, ni identifiants), un flux RSS situé SUR le site du média et marquant {q} : le serveur ne va chercher que chez les médias que vous avez déclarés. Une saisie refusée dit pourquoi, et rien n'est écrit.",
            "PREUVE — deux suites nouvelles : « Médias de la veille » (45 contrôles) et « Médias réglables depuis l'écran » (33 contrôles : vraie base PostgreSQL, vrai PHP, clics dans la fenêtre, puis la revue de presse qui suit vos réglages). Rejouées sur la v37.39 : la fonction n'existe pas. Dix-sept défauts réintroduits exprès : tous attrapés.",
        ] },
        { version: "37.39 Veille-Presse-Locale", date: "2026-10-09", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.40 Sources-Presse-Reglables');
