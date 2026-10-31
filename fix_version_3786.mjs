/* v37.86 Solde à un chiffre — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.85 Épargne au potentiel";`, `const CURRENT_VERSION = "37.86 Solde Attijari";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.85 Épargne au potentiel", date: "2026-10-30", changes: [`,
`                    const CHANGELOG = [
        { version: "37.86 Solde Attijari", date: "2026-10-31", changes: [
            "🏦 LE SOLDE DU COMPTE CHÈQUE NE SE METTAIT PAS À JOUR — « La mise à jour, c'est le solde du compte qui n'est pas mis à jour. » Sur votre capture, Attijari affiche « 5 107,⁸ DH » : UN seul chiffre en exposant (le zéro final est tu). L'appli exigeait deux chiffres après la virgule : le compte chèque n'était pas lu, seul le total « Mes comptes » (5 212,11) l'était — et ce total n'est jamais pris à la place du compte chèque. Résultat : aucun solde à appliquer, le Courant restait à l'ancien montant.",
            "✅ DÉSORMAIS — un solde de l'en-tête à un seul chiffre après la virgule vaut ce chiffre suivi d'un zéro (« 5 107,8 DH », ou coupé en deux lignes « 5 107, » / « 8 DH ») ; la relecture des centimes en exposant accepte aussi un seul chiffre. Les opérations gardent leurs deux chiffres (−31,85 reste −31,85).",
            "PREUVE — nouvelle suite « Solde Attijari à un seul chiffre » : quatre mises en forme du même solde, total conservé, opérations intactes. Rejouée sur la v37.85 : en échec.",
        ] },
        { version: "37.85 Épargne au potentiel", date: "2026-10-30", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.86');
