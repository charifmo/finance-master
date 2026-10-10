/* v37.43 Creances-Encaissees — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.42 Presse-Sans-Flux";`, `const CURRENT_VERSION = "37.43 Creances-Encaissees";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.42 Presse-Sans-Flux", date: "2026-10-09", changes: [`,
`                    const CHANGELOG = [
        { version: "37.43 Creances-Encaissees", date: "2026-10-10", changes: [
            "UNE CRÉANCE COCHÉE ✓ EST ENCAISSÉE — le journal faisait l'inverse : les remboursements cochés (Wafa Assurance, Inwi…) revenaient en rentrées À VENIR, alors que l'argent était déjà sur le compte, donc déjà dans le solde d'aujourd'hui (le Pédiatre à 514 DH et le Généraliste à 213 DH, comptés deux fois). Une créance encaissée n'est plus jamais projetée : ni dans le journal, ni dans l'atterrissage, ni dans le patrimoine projeté.",
            "ON N'ATTEND QUE LES CRÉANCES EN ATTENTE ○ — elles n'apparaissaient nulle part. Elles sont maintenant inscrites au journal, créditées à leur compte de dépôt à la date de remboursement prévue, dans le cycle de paie de cette date. Passée cette date sans encaissement, une créance reste attendue : « Créance en retard (attendue le JJ/MM/AAAA) », portée à aujourd'hui. Sans date : attendue dans le cycle en cours.",
            "L'ÉCRAN DIT LA MÊME CHOSE — ✓ « 💰 Encaissé : déjà compté dans le solde, il ne figure plus dans le journal à venir » ; ○ « ⏳ En attente : attendu le …, inscrit dans le journal prévisionnel » ou « ⏰ En retard ». Le résumé : « À recouvrer » (les en-attente, inscrits au journal) et « ✅ Encaissé » (déjà dans le solde). Cocher une créance quand le remboursement arrive la retire du journal ; la décocher l'y remet.",
            "PREUVE — nouvelle suite « Créances : encaissées dans le solde, en attente au journal » : 20 contrôles dans un vrai navigateur (deux créances encaissées, quatre en attente dont une en retard et une sans date ; journal sur cinq cycles, atterrissage, bilan, soldes projetés, écran, case à cocher). « Relevé : rangement par cycle » mise à jour (une créance en retard reste attendue). Rejouées sur la v37.42 : 21 échecs. Onze défauts réintroduits exprès : tous attrapés.",
        ] },
        { version: "37.42 Presse-Sans-Flux", date: "2026-10-09", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.43 Creances-Encaissees');
