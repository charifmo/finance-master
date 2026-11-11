/* v37.131 Le cycle en deux parts — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.130 Les quinzaines dans la frise";`, `const CURRENT_VERSION = "37.131 Le cycle en deux parts";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.130 Les quinzaines dans la frise", date: "2026-11-11", changes: [`,
`                    const CHANGELOG = [
        { version: "37.131 Le cycle en deux parts", date: "2026-11-11", changes: [
            "➗ « TOUT LE CYCLE DOIT ÊTRE DIVISÉ SUR 2 ET JE RENTRE CHAQUE PARTIE » — un poste « / 15 j » couvre ≈ 2,2 séances par cycle (Psy 452 → enveloppe 999) : chaque partie vaut maintenant l'ENVELOPPE ÷ 2 (≈ 500), plus le prix d'une séance (452) — taper 500 dans la 1ʳᵉ partie n'est plus un faux dépassement. La coupure tombe au milieu des semaines (27 oct. → 8 nov. | 9 → 26 nov.) au lieu de 20 jours puis 11. Météo et frise.",
            "✍️ « C'EST QUOI CE RACCOURCI ? ÇA DOIT SE FAIRE ICI » — l'aperçu d'une case de la frise ne renvoie plus vers la Météo : le montant tapé d'un morceau se corrige sur place ; l'aperçu d'un poste « / 15 j » montre « le cycle en 2 parties », chacune sa part, sa case de saisie et son ✓.",
            "📱 « L'AFFICHAGE DU RELEVÉ EN PORTABLE N'EST PAS OK » — au téléphone, le Relevé de comptes s'ouvre en plein écran ; l'en-tête tient en trois lignes (titre ; mois et années sur une ligne qui défile ; comptes sur une ligne qui défile) ; chaque mouvement est une carte (date · compte, montant +/− en couleur, libellé en entier, solde après). L'ordinateur garde le tableau.",
            "PREUVE — test_rythmes (part = enveloppe ÷ 2, 31 et 30 jours), test_frise_cycle (13 j | 18 j, 400 / 443, ✓ à 443), test_frise_apercu (D2 : la 1ʳᵉ partie tapée dans l'aperçu ; E2 : un morceau corrigé dans l'aperçu ; R : Relevé à 390 px plein écran, en-tête ≤ 180 px, cartes, aucun débordement ; tableau à l'ordinateur).",
        ] },
        { version: "37.130 Les quinzaines dans la frise", date: "2026-11-11", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.131');
