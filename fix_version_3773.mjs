/* v37.73 Attente CFO — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.72 Virements";`, `const CURRENT_VERSION = "37.73 Attente CFO";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.72 Virements", date: "2026-10-28", changes: [`,
`                    const CHANGELOG = [
        { version: "37.73 Attente CFO", date: "2026-10-28", changes: [
            "⏱️ UN CHRONOMÈTRE AU LIEU DE « LE CFO ANALYSE… » — « Un timer est mieux, et une animation dynamique. » Pendant que le CFO travaille : le temps écoulé au dixième de seconde, une barre qui court, une phrase qui suit ce qu'il fait (il lit vos chiffres, il pèse les options, il rédige…) et la liste des étapes déjà franchies, chacune avec son instant. Sur le bureau comme sur le téléphone.",
            "🧭 SES VRAIES ÉTAPES, SANS UN TOKEN — « Aussi tracker les étapes si ce n'est pas consommateur de tokens. » Le CFO passe déjà par votre serveur aux moments qui comptent ; chaque passage y laisse maintenant une ligne : vos chiffres transmis (et l'exercice), la simulation (prête, refusée, ou une précision demandée), votre OUI relu pour écriture, une annulation. L'appli relit ces lignes pendant l'attente. Le modèle n'en voit rien : aucun token de plus. À faire une fois sur le VPS : git pull puis install.sh cfo (le nœud n8n transmet l'identifiant de conversation).",
            "🔄 LE VIREMENT VERS LE COMPTE COURANT S'AFFICHAIT SANS DESTINATION — le virement programmé par le CFO vers le Courant était bien compté dans les soldes, mais la case « vers » restait vide : le moteur écrivait le Courant sous son numéro de compte, l'écran ne le connaît que sous « Courant ». Le moteur écrit désormais « Courant », et les virements déjà enregistrés sont remis d'aplomb au chargement.",
            "PREUVE — nouvelle suite « Attente du CFO » : étapes notées par le VPS (contexte, simulation, OUI relu, annulation), relues dans l'ordre avec leur âge, filtrées par conversation ; chronomètre et étapes affichés dans l'appli pendant une vraie attente, puis retirés à la réponse ; virement vers le Courant affiché « Courant » (moteur et chargement). Rejouée sur la v37.72 : en échec ; défauts réintroduits exprès : attrapés.",
        ] },
        { version: "37.72 Virements", date: "2026-10-28", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.73 Attente CFO');
