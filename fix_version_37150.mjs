/* v37.150 Une charge fixe selon X mois — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.149 Les centimes en exposant mieux lus";`, `const CURRENT_VERSION = "37.150 Une charge fixe selon X mois";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.149 Les centimes en exposant mieux lus", date: "2026-11-17", changes: [`,
`                    const CHANGELOG = [
        { version: "37.150 Une charge fixe selon X mois", date: "2026-11-26", changes: [
            "🔁 « JE VEUX UNE OPTION DANS LES CHARGES FIXES QUI SE FONT SELON X MOIS — LE SYNDIC, DES FOIS C'EST CHAQUE TRIMESTRE » — chaque charge fixe du Budget a maintenant « 🔁 Paiement : Chaque mois / Tous les 2 mois / Chaque trimestre / Tous les 4 mois / Chaque semestre / Une fois par an », et le mois du 1ᵉʳ paiement. Le montant est celui d'UN paiement (900 le trimestre) : dû en entier les mois de paiement, rien les autres. La ligne dit ses mois (« payé en mars · juin · sept. · déc. — soit ≈ 300 DH / mois lissé »). Le rythme vaut aussi pour les années suivantes de la même ligne.",
            "PARTOUT LE MÊME CALCUL — le Pilotage (la ligne n'apparaît que les mois de paiement), le Réalisé, le Relevé et le patrimoine projeté, la projection « bilan » (qui recopiait encore sa propre règle des exceptions : elle passe désormais par l'évaluateur commun), le journal du cycle et la clôture rétro (qui lisaient le montant brut), le moteur du CFO côté serveur. Les totaux « par mois » (total des charges fixes, audit, dépenses hors crédits) prennent l'équivalent lissé : 900 le trimestre = 300 / mois. Le surplus moyen, lui, se lisse tout seul (moyenne des mois).",
            "PREUVE — test_periodicite.mjs (vrai navigateur, 16 contrôles) : Syndic 300 chaque mois → « Chaque trimestre » et « Décembre » choisis À L'ÉCRAN, 900 : rien à traiter en novembre, projection fin 2026 −300 (un paiement de 900 au lieu de 2 × 300) ; dès février : 900 en novembre ; dès janvier : +600 ; une fois par an 3 600 en novembre ; retour à « Chaque mois » : tout revient au dirham. test_periodicite.php (serveur) : net −600 les mois de paiement, +300 les autres, même coût sur l'année, même reliquat.",
        ] },
        { version: "37.149 Les centimes en exposant mieux lus", date: "2026-11-17", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.150');
