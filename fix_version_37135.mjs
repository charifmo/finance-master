/* v37.135 Les sources connues ne sont plus « proposées » — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.134 La veille qui travaille seule";`, `const CURRENT_VERSION = "37.135 Les sources connues, reconnues";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.134 La veille qui travaille seule", date: "2026-11-12", changes: [`,
`                    const CHANGELOG = [
        { version: "37.135 Les sources connues, reconnues", date: "2026-11-12", changes: [
            "🧭 Première collecte réelle sur le VPS : 81 requêtes enregistrées pour Terrain Nord, 754 articles accumulés en une recherche. Les « domaines proposés » comptaient pourtant des variantes de sources que vous avez déjà (sport.le360.ma, mobile.telquel.ma, mobile.ledesk.ma). Un domaine est maintenant « connu » s'il est une source réglée OU l'une de ses variantes (sous-domaine) — « notle360.ma » reste un vrai nouveau domaine. Le ménage des variantes déjà proposées se fait tout seul au prochain passage.",
            "PREUVE — test_veille_collecte (17 contrôles, SQLite et PostgreSQL 16) : sport.le360.ma, mobile.telquel.ma, www.ledesk.ma connus ; notle360.ma et actu-kech-exemple.ma non ; le ménage retire sport.le360.ma et garde les vrais nouveaux ; un article de sport.le360.ma rangé ensuite ne le fait plus proposer.",
        ] },
        { version: "37.134 La veille qui travaille seule", date: "2026-11-12", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.135');
