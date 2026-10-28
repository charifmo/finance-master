/* v37.71 Attijari — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.70 Un compte";`, `const CURRENT_VERSION = "37.71 Attijari";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.70 Un compte", date: "2026-10-28", changes: [`,
`                    const CHANGELOG = [
        { version: "37.71 Attijari", date: "2026-10-28", changes: [
            "🏦 LA CAPTURE ATTIJARI « MES COMPTES » RECONNUE — « Pourquoi il ne reconnaît pas le compte Attijari ? » Sur cet écran, la liste des opérations n'a d'autre titre que son mois (« Octobre 2026 ») : faute de titre reconnu, l'en-tête était coupé au total « Mes comptes », et le n° du compte et le solde du compte chèque, lus juste en dessous, tombaient dans la liste — « sans RIB visible, à quel compte l'associer ? ». Un mois seul sur sa ligne marque désormais le début de la liste : le n° est lu, la capture est rattachée toute seule à son compte.",
            "LE SOLDE SUIVI LU — quand le compte suit le total « Mes comptes » et que l'OCR le lit collé (« 987600DH »), la troisième lecture (seuil local) est lancée aussi : le solde suivi est proposé à l'application, pas seulement celui du compte chèque.",
            "UNE EMPREINTE PLUS TOLÉRANTE — une empreinte mémorisée (« pad compte cheque », un « pad » lu sur l'icône) reconnaît le même intitulé de la même banque à un mot parasite près ; une empreinte vide ne reconnaît jamais rien.",
            "💸 LE CFO NE DÉPLACE PLUS DE SOLDES POUR UN VIREMENT À PRÉVOIR — ses consignes réservent les transferts entre comptes (ajustement des deux soldes) aux virements que vous dites déjà faits à la banque. Un virement conseillé ou à programmer ne touche jamais aux soldes ; en cas de doute, il demande si le virement est fait.",
            "PREUVE — nouvelle suite « Attijari « Mes comptes » » : 12 contrôles (écran OCR fictif, n° et montants inventés). Rejouée sur la v37.70 : 6 en échec. Défauts réintroduits exprès (mois non reconnu comme titre, empreinte stricte, tolérance sans limite) : attrapés. Les quatre suites bancaires existantes passent sans changement. Vérifié sur votre capture réelle : compte reconnu par son n°, solde « Mes comptes » proposé.",
        ] },
        { version: "37.70 Un compte", date: "2026-10-28", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.71 Attijari');
