/* v37.112 Le compte suit le voyage — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.111 La veille élargie";`, `const CURRENT_VERSION = "37.112 Le compte suit le voyage";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.111 La veille élargie", date: "2026-11-08", changes: [`,
`                    const CHANGELOG = [
        { version: "37.112 Le compte suit le voyage", date: "2026-11-08", changes: [
            "🏦 LE COMPTE SUIT LA CATÉGORIE POSÉE PAR L'IA — une saisie que les règles ne connaissaient pas partait sur le compte courant ; quand l'IA du CFO la rangeait ensuite dans « Voyage Marrakech », le compte restait le courant. Désormais il passe à celui de la ligne, sauf si vous l'aviez choisi vous-même (ou si l'opération vient de la banque).",
            "✈️ « PAYÉ PAR » — à côté de la destination du voyage (Pilotage), le compte qui paie le voyage : la ligne « Voyage … » le prend, il est retenu pour le prochain voyage, et les saisies du voyage déjà faites le rejoignent.",
            "🧳 À la saisie, cocher « Dépense du voyage » affiche tout de suite le compte du voyage ; décocher remet le compte habituel.",
            "🔧 Réparé tout seul au chargement : vos saisies déjà rangées par l'IA ou par la case voyage, restées sur le courant alors que leur ligne a un autre compte, passent sur le bon compte. Un compte choisi à la main (à la saisie ou corrigé au journal) n'est jamais déplacé.",
        ] },
        { version: "37.111 La veille élargie", date: "2026-11-08", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.112');
