/* v37.139 L'article du jour — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.138 Trois circuits et les nouveautés";`, `const CURRENT_VERSION = "37.139 L'article du jour";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.138 Trois circuits et les nouveautés", date: "2026-11-12", changes: [`,
`                    const CHANGELOG = [
        { version: "37.139 L'article du jour", date: "2026-11-12", changes: [
            "🔎 « TOUT ÇA ET IL N'A PAS TROUVÉ CET ARTICLE ! » (Marrakech Alaan, 12 nov. 2026 : « المصادقة على مشاريع طرقية مهيكلة بمحيط الملعب الكبير لمراكش خلال دورة استثنائية لجماعة واحة سيدي إبراهيم ») — trois trous bouchés : (1) L'ORTHOGRAPHE : toutes les recherches en arabe écrivaient « ابراهيم » (sans hamza), l'article « إبراهيم » ; une recherche de site ou une phrase exacte ne confond pas les deux. Chaque lieu arabe est maintenant cherché dans ses deux orthographes (Google, Bing, et la page de recherche de chaque journal local), sans pousser dehors un autre lieu ; (2) LA FRAÎCHEUR : la collecte ne relisait chaque source qu'une fois par jour ; les pages des journaux locaux (leur recherche, leur accueil) sont maintenant relues toutes les 3 heures — un article du jour entre dans le corpus le jour même ; les moteurs restent une fois par jour ; (3) LES DERNIÈRES NOUVELLES : sur la page d'accueil d'un journal, le bandeau défilant et les blocs « dernières nouvelles » étaient ignorés — c'est souvent là que paraît l'article du jour : ils sont lus.",
            "PREUVE — test_veille_presse.php (123) : orthographes dans les deux sens, page de recherche de Marrakech Alaan dans les deux orthographes, 2ᵉ lieu arabe conservé, l'article du bandeau de l'accueil lu et gardé par le tri (« إبراهيم » reconnaît « ابراهيم ») ; test_veille_collecte (22, SQLite et PostgreSQL 16) : à 10 h toutes les requêtes, à 11 h rien, à 13 h 30 seulement les pages des journaux.",
        ] },
        { version: "37.138 Trois circuits et les nouveautés", date: "2026-11-12", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.139');
