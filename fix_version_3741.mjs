/* v37.41 Presse-Sans-RSS — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.40 Sources-Presse-Reglables";`, `const CURRENT_VERSION = "37.41 Presse-Sans-RSS";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.40 Sources-Presse-Reglables", date: "2026-10-09", changes: [`,
`                    const CHANGELOG = [
        { version: "37.41 Presse-Sans-RSS", date: "2026-10-09", changes: [
            "LA PLUPART DES SITES MARRAKCHIS N'ONT PAS DE RSS OUVERT (constat sur Kech24, Marrakech Alaan) — la revue de presse ne dépend plus d'eux, et n'échoue plus en silence.",
            "UNE REQUÊTE GOOGLE ACTUALITÉS STRICTE PAR MÉDIA LOCAL — site:kech24.com (\\"واحة سيدي ابراهيم\\" OR \\"Ouahat Sidi Brahim\\"), et de même pour chaque média local, avec les lieux du bien dans les deux langues. Jusqu'ici un seul OR regroupait les quatre sites : les petits médias y étaient noyés.",
            "LA PAGE DE RÉSULTATS DU SITE, LUE QUAND IL N'Y A PAS DE RSS — la recherche du site (/?s=… pour WordPress) est lue en RSS si le site en sert un, sinon en HTML : titres, liens, dates, chapôs des résultats. Menus, barres latérales « les plus lus », publicités, catégories et pagination sont écartés. Une page qui n'est pas une page de résultats (accueil par redirection) ne fournit que les titres qui nomment le lieu.",
            "UN BILAN PAR MÉDIA LOCAL — sur la carte : ce que Google a trouvé sur son site, ce que sa propre recherche a donné (RSS lu, page web lue, ou fermée / injoignable avec la cause), et le nombre d'articles retenus. Les médias restés muets sont nommés à l'agent, qui doit les cibler un par un. Le bouton 🧪 de la fenêtre Sources lit aussi la page de résultats d'un site sans RSS.",
            "PREUVE — « La presse marrakchie lue avant la réponse » passe à 58 contrôles (Kech24 sans RSS avec sa page de résultats, Marrakech Alaan renvoyé sur son accueil, Al Marrakchia en RSS, Marrakech 7 muet), « Revue de presse locale » à 51, « Médias réglables depuis l'écran » à 37 (🧪 sur un site sans RSS, via un proxy local). Rejouées sur la v37.40 : 21 échecs. Seize défauts réintroduits exprès : tous attrapés.",
        ] },
        { version: "37.40 Sources-Presse-Reglables", date: "2026-10-09", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.41 Presse-Sans-RSS');
