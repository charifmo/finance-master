/* v37.91 Épargne avec réserve — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.90 Connexion CFO";`, `const CURRENT_VERSION = "37.91 Épargne avec réserve";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.90 Connexion CFO", date: "2026-11-02", changes: [`,
`                    const CHANGELOG = [
        { version: "37.91 Épargne avec réserve", date: "2026-11-02", changes: [
            "⚖️ « C'EST QUOI CE MASSACRE ! » — après « adapter l'épargne au potentiel », Compte Principale ASSAFA finissait 2027 à − 44 919 et Compte urgence à 146 085. Chaque mois, l'épargne prenait TOUT le potentiel du mois ; or en décembre partent d'un coup 63 000 DH (40 000 + 20 000 vers urgence, 3 000 vers Long Terme), qui se paient avec ce qui s'est ACCUMULÉ dans l'année. Plus rien ne s'accumulait : le Bilan affichait « − 4 182 DH par mois » (c'était − 50 243 en décembre, divisés par 12).",
            "✅ DÉSORMAIS — l'adaptation lit l'année entière : un mois qui ne se suffit pas (gros virement ponctuel, dépense lourde) se prépare dans les mois d'avant. À la fin de chaque mois, on garde en réserve ce qu'il faudra pour les mois déficitaires qui suivent ; l'épargne du mois prend le reste, et le cumul de l'année ne passe jamais sous zéro. Sur vos chiffres (simulé) : Epargne urgence 2 630 à 4 150 de janvier à juin, 12 000 en juillet, puis 0 (décembre la remplit d'un coup) ; ASSAFA finit à + 6 531, le Courant à + 4 830, net moyen + 6 DH par mois.",
            "PREUVE — la suite « L'épargne s'adapte au potentiel » gagne un cas : 100 000 virés en décembre → 18 380 × 6, 28 000, 28 000, 12 000 puis 0, cumul jamais sous zéro. Rejouée sur la v37.90 : en échec.",
        ] },
        { version: "37.90 Connexion CFO", date: "2026-11-02", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.91');
