/* v37.39 Veille-Presse-Locale — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.38 Memoire-Garantie";`, `const CURRENT_VERSION = "37.39 Veille-Presse-Locale";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.38 Memoire-Garantie", date: "2026-10-09", changes: [`,
`                    const CHANGELOG = [
        { version: "37.39 Veille-Presse-Locale", date: "2026-10-09", changes: [
            "« ACTUALISER » LIT LA PRESSE MARRAKCHIE AVANT DE RÉPONDRE — jusqu'ici, la recherche passait par l'outil web_search du CFO : une requête Tavily « basic », généraliste, qui ne rendait qu'un résumé tout fait, sans date ni source. Désormais le serveur (cfo_veille_presse.php) interroge d'abord Google Actualités restreint à la presse locale (Al Marrakchia, Marrakech Alaan, Kech24, Marrakech 7) puis nationale (Le Desk, Médias24, Le360, Hespress, Le Matin, L'Economiste…), ainsi que la recherche des sites marrakchis. La liste des médias est dans veille_sources.json : en ajouter un, c'est ajouter une ligne.",
            "EN FRANÇAIS ET EN ARABE — les lieux du bien sont tirés de son nom et de sa fiche mémorisée (Ouahat Sidi Brahim / واحة سيدي ابراهيم, le douar, la commune), avec les sujets qui font sa valeur (SDAU, plan d'aménagement, RN9, LGV, Grand Stade, contournement…), traduits pour la presse arabophone. Les articles sont triés pour CE bien : lieu nommé d'abord, presse locale, fraîcheur ; hors zone, trop vieux et doublons écartés.",
            "UNE RÉPONSE CIBLÉE — l'agent reçoit les articles numérotés, complète par des recherches FR/AR qui nomment la presse locale, et répond dans un format imposé : verdict pour le bien, ce qui bouge autour de la parcelle (daté, sourcé, impact ↑/↓/=), comparables du même zonage seulement, actions concrètes, sources. 250 mots au plus ; généralités et faits sans source interdits.",
            "TRANSPARENCE — la carte montre les articles lus avant la réponse (cliquables, numérotés comme les renvois [n]) et les sources injoignables. Une revue de presse en panne n'empêche pas la recherche : elle est dite. Le navigateur n'envoie que des mots : les adresses des médias ne sont lues que dans le fichier du serveur.",
            "PREUVE — deux suites nouvelles : « Revue de presse locale » (34 contrôles) et « La presse marrakchie lue avant la réponse » (43 contrôles : vrai PHP, presse simulée FR/AR, sites lents ou sans RSS, navigateur). Rejouées sur la v37.38 : ni presse, ni format (31 échecs sur 34 atteints). Seize défauts réintroduits exprès : tous attrapés.",
        ] },
        { version: "37.38 Memoire-Garantie", date: "2026-10-09", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.39 Veille-Presse-Locale');
