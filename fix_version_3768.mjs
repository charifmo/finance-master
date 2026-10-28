/* v37.68 Ménage — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.67 CFO lucide";`, `const CURRENT_VERSION = "37.68 Ménage";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.67 CFO lucide", date: "2026-10-27", changes: [`,
`                    const CHANGELOG = [
        { version: "37.68 Ménage", date: "2026-10-28", changes: [
            "🧾 UN EN-TÊTE DE COMPTE N'EST PAS UNE OPÉRATION — à l'import d'une capture bancaire, l'intitulé du compte suivi de son solde (« Compte chèque 5 … »), que l'OCR retrouve au milieu de la liste quand l'écran défile, était lu comme une opération : c'était arrivé cinq fois, dont une « dépense » de plusieurs milliers de DH classée Frais bancaire qui mangeait le reste à dépenser du cycle. Une ligne dont le libellé commence par « Compte chèque » ou « Compte courant » n'est plus jamais une opération ; le solde de l'en-tête, lui, est toujours lu.",
            "🧹 CORRECTIONS APPROUVÉES, APPLIQUÉES UNE FOIS AU CHARGEMENT (schéma 23) — l'opération importée par erreur que vous avez désignée est retirée (repérée par une empreinte : ni son montant ni son libellé ne figurent dans le code) et sa ligne du registre bancaire passe « ignorée », pour ne pas revenir au prochain import ; les années suivantes, qui envoyaient le salaire et la bonification sur le Compte Courant, les envoient sur le compte où ils arrivent vraiment, et l'« épargne » qui renvoyait du Courant vers ce compte (le trajet inverse) est retirée. Le journal technique dit ce qui a été corrigé.",
            "PREUVE — nouvelle suite « En-têtes de compte, corrections approuvées » : 12 contrôles (décor fictif). Rejouée sur la v37.67 : 7 en échec. Huit défauts réintroduits exprès (en-tête gardé, registre non ignoré, correction rejouée, épargne inverse gardée, toutes les épargnes retirées, Courant désigné par son identifiant non reconnu, schéma non relevé, empreinte sans le montant) : tous attrapés. Vérifié sur les vraies données : la fausse opération retirée (le reste à dépenser du cycle revient au réel), salaire et bonification 2027-2030 sur le compte du salaire, le virement inverse retiré, plus d'alerte pour le CFO.",
        ] },
        { version: "37.67 CFO lucide", date: "2026-10-27", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.68 Ménage');
