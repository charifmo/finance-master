/* v37.111 La veille élargie — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.108 Le voyage à la saisie";`, `const CURRENT_VERSION = "37.111 La veille élargie";`);
sub('ÉTAPE PRESSE', `Al Marrakchia, Marrakech Alaan, Kech24, Le Desk, Médias24, Hespress… en français et en arabe`,
    `Al Marrakchia, Kech24, Le Desk, Hespress… puis Facebook, forums et annonces, en français et en arabe`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.108 Le voyage à la saisie", date: "2026-11-07", changes: [`,
`                    const CHANGELOG = [
        { version: "37.111 La veille élargie", date: "2026-11-08", changes: [
            "📱 AU-DELÀ DE LA PRESSE — la Recherche Éclair lit aussi les réseaux sociaux (pages et groupes publics Facebook, Instagram, YouTube), les forums (Yabiladi, Bladi.net, Reddit) et les annonces immobilières (Avito, Mubawab, Sarouty, Yakeey, Agenz, Marocannonces), cherchés par Bing (web) et DuckDuckGo restreints à ces sites, avec les lieux du bien en arabe et en français.",
            "👥 UNE PAGE OU UN GROUPE PRÉCIS — « 📰 Sources » → ajouter, portée « Réseau social » : collez l'adresse d'un groupe ou d'une page (facebook.com/groups/…) ; seul ce qu'il publie publiquement est cherché. Plusieurs pages Facebook peuvent cohabiter.",
            "🗞️ 14 JOURNAUX NATIONAUX DE PLUS — Assabah, Al Akhbar, Febrayer, Barlamane, Goud, Chouf TV, Alayam 24, SNRTnews, Rue20, Menara, MAP Express, Le Site info, Aujourd'hui le Maroc, L'Opinion. La presse nationale part par paquets de 10 sites, les journaux arabophones avec le lieu en arabe.",
            "⚖️ L'IA est prévenue : un post ou un forum est un témoignage à recouper, une annonce un prix DEMANDÉ (pas une vente). Le détail de la carte dit, famille par famille, ce qui a été lu.",
        ] },
        { version: "37.108 Le voyage à la saisie", date: "2026-11-07", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.111');
