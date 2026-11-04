/* v37.102 Santé enregistre — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.101 Un seul système";`, `const CURRENT_VERSION = "37.102 Santé enregistre";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.101 Un seul système", date: "2026-11-04", changes: [`,
`                    const CHANGELOG = [
        { version: "37.102 Santé enregistre", date: "2026-11-04", changes: [
            "🩺 « NON ENREGISTRÉ » CORRIGÉ (Santé 1.3) — le dossier sante/ est créé par « git pull », souvent par root : PHP n'y avait pas le droit d'écrire, et Santé affichait « non enregistré » sans dire pourquoi. Désormais, si sante/ n'est pas inscriptible, Santé enregistre dans pending/ (que PHP peut toujours écrire) ; la lecture prend le fichier le plus récent des deux, rien n'est perdu.",
            "⚠️ L'ERREUR EST DITE — si le serveur refuse, la page écrit la raison (le dossier concerné, l'erreur de la base) et propose « ↻ Réessayer » ; vos données restent dans la page tant qu'elle est ouverte.",
            "💾 La sauvegarde nocturne (Telegram) suit le même fichier : les données de Santé y sont incluses.",
        ] },
        { version: "37.101 Un seul système", date: "2026-11-04", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.102');
