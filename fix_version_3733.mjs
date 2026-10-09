/* v37.33 Atterrissage-Comptes — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.32 Memoire-Et-Alerte";`, `const CURRENT_VERSION = "37.33 Atterrissage-Comptes";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.32 Memoire-Et-Alerte", date: "2026-10-08", changes: [`,
`                    const CHANGELOG = [
        { version: "37.33 Atterrissage-Comptes", date: "2026-10-09", changes: [
            "PLUS DE BOÎTE NOIRE — la Météo ne nommait un compte que s'il finissait le cycle dans le rouge : le compte principal (Assafa, + 649 DH) n'apparaissait nulle part, il fallait le demander à l'agent IA. Sous le verdict, une liste compacte « 🏁 Fin de cycle » donne désormais, EN PERMANENCE, l'atterrissage de chaque compte opérationnel : monogramme, nom court, montant en gras aligné à droite — vert si ≥ 0, rouge si < 0.",
            "QUELS COMPTES — le courant, et tout compte d'où de l'argent SORT ce cycle (il paie quelque chose). Un livret qui ne fait que recevoir, une poche d'épargne virtuelle, un compte d'investissement n'y figurent pas — sauf s'il finit dans le rouge : la liste ne contredit jamais le bloc « Découvert projeté ». Ordre fixe (le courant, puis l'ordre de vos comptes) : chaque compte reste à sa place d'un jour à l'autre.",
            "UNE SEULE VÉRITÉ — les montants sont ceux du moteur du Relevé, les mêmes que le bloc rouge et que « Comptes du cycle » : aucun second calcul. La pastille « 🏁 Atterrissage le … » (le courant seul) disparaît, remplacée par la liste ; « Respiration du budget » reste (bureau).",
            "ZÉRO RÉGRESSION — le bloc rouge « Découvert projeté » (compte, montant, virement de sauvetage) n'est pas touché : son gabarit et son calcul sont vérifiés identiques à v37.32, octet pour octet.",
            "PREUVE — suite nouvelle « La Météo montre où finit chaque compte » (25 contrôles, montants calculés à la main) : le cas rapporté (Courant − 2 905, Assafa + 649), ciel sans découvert, Assafa dans le rouge (l'ordre ne bouge pas), compte non liquide dans le rouge, atterrissage pile à 0, un livret qui se met à payer, un courant immobile, téléphone (ordre vertical, aucun débordement), couleurs réellement rendues. Douze défauts réintroduits exprès : tous attrapés.",
        ] },
        { version: "37.32 Memoire-Et-Alerte", date: "2026-10-08", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.33 Atterrissage-Comptes');
