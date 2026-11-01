/* v37.93 Épargne progressive — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.92 Nettoyage avant calcul";`, `const CURRENT_VERSION = "37.93 Épargne progressive";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.92 Nettoyage avant calcul", date: "2026-11-02", changes: [`,
`                    const CHANGELOG = [
        { version: "37.93 Épargne progressive", date: "2026-11-02", changes: [
            "🧱 « POURQUOI UN GROS MONTANT VERS URGENCE À LA FIN DE L'ANNÉE ? POURQUOI NE PAS CONSTRUIRE PETIT À PETIT ? » — les 40 000 + 20 000 DH de décembre vers Compte urgence étaient un « écrêtage » du CFO : l'argent laissé dormir toute l'année, vidé d'un coup en décembre ; la réserve de la v37.91 arrêtait même l'épargne mensuelle dès août pour les payer.",
            "✅ DÉSORMAIS — « adapter l'épargne au potentiel » ABSORBE les virements ponctuels vers le MÊME compte que la ligne adaptée, sur les mois adaptés : ils sont retirés, et la ligne prend chaque mois ce que le mois dégage. Sur vos chiffres (simulé) : Epargne urgence 2 630 à 4 150 DH de janvier à juin, 12 250 à 12 750 de juillet à novembre, 9 750 en décembre (la réserve des 3 000 vers Long Terme). Les virements vers d'autres comptes gardent leur réserve ; « retirer l'adaptation » remet les virements absorbés ; le fil du CFO dit combien ont été absorbés.",
            "PREUVE — la suite « L'épargne s'adapte au potentiel » : 100 000 vers le même compte en décembre → absorbés, 18 380 × 6 puis 28 000 × 6, et remis au retrait ; vers un autre compte → réserve gardée. Rejouée sur la v37.92 : en échec.",
        ] },
        { version: "37.92 Nettoyage avant calcul", date: "2026-11-02", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.93');
