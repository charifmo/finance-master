/* v37.42 Presse-Sans-Flux — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.41 Presse-Sans-RSS";`, `const CURRENT_VERSION = "37.42 Presse-Sans-Flux";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.41 Presse-Sans-RSS", date: "2026-10-09", changes: [`,
`                    const CHANGELOG = [
        { version: "37.42 Presse-Sans-Flux", date: "2026-10-09", changes: [
            "« L'EXTENSION CURL DE PHP EST REQUISE » NE BLOQUE PLUS RIEN — le PHP du VPS n'a pas php-curl : la revue de presse et le 🧪 des sources s'arrêtaient net. curl devient facultatif : avec lui, les journaux sont interrogés en parallèle ; sans lui, un par un (flux PHP), dans un budget de 20 s — mêmes articles, plus lentement, et la carte affiche « mode lent : curl absent du serveur ». Ce qui n'a pas pu être interrogé faute de temps est dit, jamais compté comme injoignable.",
            "LA COMMANDE EXACTE, À L'ÉCRAN ET DANS install.sh — la fenêtre Sources dit ce qui manque au PHP du serveur et la commande à copier (sudo apt-get install -y php8.3-curl … && sudo systemctl restart php8.3-fpm). « sudo bash install.sh php » installe ce qui manque (curl, xml, mbstring, pgsql) et redémarre php-fpm, sans toucher à la base ni à n8n. Le mot de passe PostgreSQL n'est plus écrit dans install.sh : il est lu dans db_config.php.",
            "PLUS AUCUN FLUX RSS DE JOURNAL — Kech24, Al Marrakchia, Marrakech Alaan n'en ont pas d'ouvert. Chaque média local est cherché par quatre portes : Google Actualités restreint à son site (site:kech24.com \\"lieu\\" — le RSS lu là est la liste de résultats de Google, pas celui du journal), Bing Actualités restreint à son site (le lien de l'article extrait de l'enrobage de Bing), sa page de recherche et sa PAGE D'ACCUEIL, lues en HTML (titres et liens ; un titre de une n'est gardé que s'il nomme le lieu). Un ancien réglage « &feed=rss2 » est retiré : c'est la page qui est demandée.",
            "LECTURE HTML PLUS ROBUSTE — le titre d'un article WordPress, rangé dans l'en-tête de l'<article>, était jeté avec les menus : il est lu. Une page d'accueil lit ses <article> et ses blocs de une ; un thème maison sans <article> ni titres est lu par ses liens d'article (identifiant, date, .html). Sans php-xml, une lecture de secours prend le relais. Le bilan par média détaille chaque porte (Google, page de recherche, Bing, page d'accueil) et chaque échec en clair (HTTP 403 : protection anti-robots, délai, redirections…).",
            "PREUVE — nouvelle suite « Presse sans flux ni curl » : 69 contrôles, sur un vrai serveur local (curl et flux PHP rendent les mêmes réponses, budget tenu, proxy lu comme curl le lit, PHP sans curl / sans SimpleXML / sans allow_url_fopen diagnostiqué, install.sh php joué). « La presse marrakchie lue avant la réponse » : 78 (aucun site simulé n'a de RSS ; le même serveur sans curl ni SimpleXML rend les mêmes articles), « Revue de presse locale » : 71, « Médias réglables » : 47 et 41. Rejouées sur la v37.41 : 26 échecs en bout en bout, dont « L'extension curl de PHP est requise », et les trois suites unitaires s'arrêtent. Trente-cinq défauts réintroduits exprès : tous attrapés.",
        ] },
        { version: "37.41 Presse-Sans-RSS", date: "2026-10-09", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.42 Presse-Sans-Flux');
