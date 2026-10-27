/* v37.64 Pourquoi — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.63 Projection";`, `const CURRENT_VERSION = "37.64 Pourquoi";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.63 Projection", date: "2026-10-26", changes: [`,
`                    const CHANGELOG = [
        { version: "37.64 Pourquoi", date: "2026-10-27", changes: [
            "❓ POURQUOI CE DÉCOUVERT ? — « J'attends des entrées appartement et magasin sur le courant, pourquoi ce n'est pas OK ? » Les loyers ÉTAIENT comptés ; rien à l'écran ne permettait de le voir. Sous le bloc rouge, « Pourquoi ? » donne le calcul du compte, celui du moteur du Relevé : « 6 300 aujourd'hui + 9 000 d'entrées − 22 900 de sorties = − 7 600 DH », puis les entrées attendues avec leur date (Loyer magasin + 5 000 le 3 nov., Loyer appartement + 4 000 le 5 nov.) et les sorties de la plus grosse à la plus petite (les semaines de charges variables en une seule ligne).",
            "💡 UN REVENU ARRIVÉ SUR UN AUTRE COMPTE — le vrai trou : le salaire et la bonification étaient arrivés sur ASSAFA alors que le plan les attend sur le Courant, et le plan gardait le virement Courant → ASSAFA qui devait les y envoyer. Le Courant payait un trajet que l'argent avait déjà fait. Le relevé importé le sait : une entrée venue de l'extérieur (pas la moitié d'un virement entre vos comptes : même montant, sens opposé, à un jour près) dont le montant colle à un revenu du cycle (± 5 %, à 7 jours de sa date — ou pointée sur lui) sur un autre compte que sa destination. La Météo le dit (« Salaire et Bonification — 32 298 DH reçus le 27 oct. — sont arrivés sur Assafa, pas sur Courant ») et nomme le virement prévu, avec « Retirer ce virement de novembre » (après confirmation) : le découvert disparaît s'il n'avait que cette cause.",
            "Chaque entrée sert un revenu, chaque revenu une entrée, les plus proches d'abord : une entrée arrivée sur le BON compte prend son revenu et ne fait pas d'alerte. Le bloc rouge « Découvert projeté » et son calcul ne bougent pas d'un octet (empreintes v37.32).",
            "PREUVE — nouvelle suite « Revenu arrivé ailleurs » : 24 contrôles (jour de paie 27 oct., données fictives). Rejouée sur la v37.63 : 16 en échec. Six défauts réintroduits exprès (virement entre vos comptes pris pour un revenu, tolérance à 10 %, entrée pointée ignorée, retrait sans confirmation, semaines non regroupées, les plus lointaines d'abord) : tous attrapés.",
        ] },
        { version: "37.63 Projection", date: "2026-10-26", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.64 Pourquoi');
