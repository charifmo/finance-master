/* v37.142 Les sources proposées — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.141 Des prix de terrains, rien d'autre";`, `const CURRENT_VERSION = "37.142 Les sources proposées";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.141 Des prix de terrains, rien d'autre", date: "2026-11-13", changes: [`,
`                    const CHANGELOG = [
        { version: "37.142 Les sources proposées", date: "2026-11-13", changes: [
            "🧭 « SOURCES PROPOSÉES » dans l'Intelligence Marché — la collecte repère les sites et les pages qui reviennent pour un bien, les normalise et les note ; VOUS décidez : Accepter, Ignorer, Surveiller une fois (48 h), Voir les exemples, Modifier avant acceptation. Rien ne s'active d'office : une source acceptée entre dans la collecte au cycle suivant. Filtres : toutes, presse, officielles, annonces, réseaux sociaux, forums, score élevé, nouvelles.",
            "🔎 Normalisation sûre par la Public Suffix List : mobile.telquel.ma et fr.le360.ma regroupés avec leur domaine, sport.le360.ma gardé comme sous-domaine, notle360.ma jamais confondu avec le360.ma (imitation : jamais proposée), une page Facebook = une source, paramètres de suivi retirés (l'adresse d'origine est gardée), adresses à jeton ou session exclues, moteurs et raccourcisseurs ignorés.",
            "🧮 Un score sans IA, ses raisons affichées : +30 nomme un lieu du bien, +20 requête locale, +20 plusieurs requêtes, +15 plusieurs jours, +15 officielle, +10 plusieurs articles pertinents ; −20 réseau social seulement, −20 sans date, −30 hors zone, −50 déjà ignorée. Proposée à partir de 2 résultats distincts (1 pour une source officielle) ; 10 nouvelles par jour et par bien, 50 visibles. Un réseau social reste « signal public indexé, non vérifié », jamais officiel.",
            "➕ Ajout manuel amélioré (adresse, nom, type, langue, bien, fréquence, note, confiance) : normalisé, doublon signalé, jamais écrasé. La liste des médias (📰 Sources) reste là, inchangée. Chaque décision est historisée. Commande serveur : « php cfo_veille_collecte.php propositions ».",
            "⏱️ Tests plus rapides : deux attentes inutiles de 30 s supprimées (Journal, Interface de bureau) ; un changement qui ne touche que la veille ne rejoue plus que les suites de la veille (« bash run_tests.sh veille »).",
            "PREUVE — test_veille_decouvertes.php (109, SQLite et PostgreSQL, hors ligne) ; test_veille_presse.mjs (120) : la section à l'écran avec le vrai serveur, ajout manuel, doublon, exemples, acceptation puis interrogation au cycle suivant.",
        ] },
        { version: "37.141 Des prix de terrains, rien d'autre", date: "2026-11-13", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.142');
