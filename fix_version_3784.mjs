/* v37.84 Revenu négatif — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.83 CFO branché";`, `const CURRENT_VERSION = "37.84 Revenu négatif";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.83 CFO branché", date: "2026-10-29", changes: [`,
`                    const CHANGELOG = [
        { version: "37.84 Revenu négatif", date: "2026-10-30", changes: [
            "💸 UN REVENU NÉGATIF EST UNE SORTIE, ET ON LA VOIT — « Pourquoi je ne vois pas le négatif du Studio sur les premiers mois ? » Le Studio rapporte 8 000 DH par mois, avec une règle d'exception de M1 à M6 à − 1 615 : ces mois-là, il COÛTE 1 615. Mais partout où l'appli lisait les revenus, un revenu négatif était écarté comme « flux inactif » : il disparaissait du Relevé de comptes (donc de la trajectoire et de la Météo), du Surplus détaillé et de la Respiration du budget. Les 1 615 DH par mois n'étaient comptés nulle part : le Courant paraissait plus riche qu'il ne l'est.",
            "✅ DÉSORMAIS — un revenu négatif ce mois-là est une sortie du même compte : une ligne « 💸 Studio (revenu négatif) » dans le Relevé, à sa date ; compté dans les sorties du Surplus détaillé ; dans les charges fixes de la Respiration (« Studio (net) ») et du Bilan. Zéro reste « suspendu » (rien ne se passe) ; seul le négatif coûte.",
            "PREUVE — nouvelle suite « Un revenu négatif est une sortie » : Relevé janvier 2027 (sortie de 1 615) et juillet (entrée de 8 000), Respiration (charge nette 1 615, ressources 20 000), Bilan (marge 18 385 puis 28 000), Surplus détaillé (18 385 puis 28 000). Rejouée sur la v37.83 : en échec ; défauts réintroduits exprès : attrapés.",
        ] },
        { version: "37.83 CFO branché", date: "2026-10-29", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.84');
