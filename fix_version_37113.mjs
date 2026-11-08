/* v37.113 Le voyage d'abord — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.112 Le compte suit le voyage";`, `const CURRENT_VERSION = "37.113 Le voyage d'abord";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.112 Le compte suit le voyage", date: "2026-11-08", changes: [`,
`                    const CHANGELOG = [
        { version: "37.113 Le voyage d'abord", date: "2026-11-08", changes: [
            "✈️ CASE « DÉPENSE DU VOYAGE » COCHÉE : LE COMPTE DU VOYAGE PASSE AVANT TOUT — cocher puis taper « diesel » (payé d'habitude par le courant) affichait le courant, même si l'enregistrement allait bien sur le compte du voyage. Le formulaire montre désormais le compte du voyage ; décocher rend le compte habituel.",
            "🏦 L'ordre du compte proposé, partout le même : 1. choisi à la main ; 2. en voyage, case cochée : « payé par » ; 3. celui de votre dernière saisie du même libellé ; 4. celui de la catégorie (appris, sinon celui de sa ligne) ; 5. le compte par défaut. Rangée ensuite par l'IA du CFO, une saisie sans compte choisi prend celui de sa catégorie.",
        ] },
        { version: "37.112 Le compte suit le voyage", date: "2026-11-08", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.113');
