/* v37.143 Les publications, pas les pages — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.142 Les sources proposées";`, `const CURRENT_VERSION = "37.143 Les publications, pas les pages";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.142 Les sources proposées", date: "2026-11-13", changes: [`,
`                    const CHANGELOG = [
        { version: "37.143 Les publications, pas les pages", date: "2026-11-13", changes: [
            "💬 « RÉSULTAT FAIBLE, PAS DE RÉSEAUX SOCIAUX » — la collecte avait bien trouvé les publications Facebook de la commune (la vidéo du président sur les projets, le bilan 2023/2024, le post du 13 nov.), mais les 5 places des signaux étaient prises par la page elle-même, sa page « à propos », ses « mentions » et des profils, tous sans date. Désormais : seules les PUBLICATIONS (posts, vidéos, photos légendées, fils de forum) sont des signaux ; les pages sont des sources (« Sources proposées ») ; ce qui parle de projets, de routes, d'aménagement passe devant ; 8 signaux au plus.",
            "🧠 L'analyse a maintenant une rubrique « Ce qui se dit localement (signaux non vérifiés) » — 2 puces au plus, chacune avec son lien et « non vérifié », jamais mêlées aux faits ; « aucun signal utile » sinon.",
            "PREUVE — test_veille_presse.php (128) : rejoué sur les vrais résultats Facebook du VPS (13 nov.) — 3 publications gardées, la vidéo sur les projets en tête, aucune page ni profil.",
        ] },
        { version: "37.142 Les sources proposées", date: "2026-11-13", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.143');
