/* v37.154 Adapter au potentiel sans découvert — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.153 L'épargne variable se voit au Budget";`, `const CURRENT_VERSION = "37.154 Adapter au potentiel sans découvert";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.153 L'épargne variable se voit au Budget", date: "2026-11-27", changes: [`,
`                    const CHANGELOG = [
        { version: "37.154 Adapter au potentiel sans découvert", date: "2026-11-27", changes: [
            "⚖️ « OUI, CHANGE » — « Adapter au potentiel » avait mis 22 210 en décembre sur « Alimentation Dépenses Annuelles & Projets », versés depuis ASSAFA qui finissait à −12 217 : le potentiel est un budget THÉORIQUE (entrées − sorties du mois) et ce qu'un mois n'utilisait pas s'accumulait sur le dernier, sans jamais regarder le solde du compte d'où part l'argent.",
            "LA GARDE — l'adaptation lit maintenant le Relevé : au premier cycle où le compte SOURCE passe sous zéro, elle retire le manque au mois versé le plus proche (jamais sous 0), et recommence. Si le compte est sous zéro même sans cette épargne, rien n'est versé et c'est dit. Même garde pour le CFO et « Recalibrer l'année ».",
            "L'APERÇU — le bouton ⚖️ n'applique plus d'un coup : une fenêtre montre mois par mois l'actuel et le proposé, ce qui est réduit (« au lieu de 7 090 : Compte Courant resterait ≥ 0 »), le point bas du compte source avant / après, les virements intégrés ; « ✓ Valider » applique, « Annuler » ne touche à rien (le calcul est fait à blanc et l'état remis tel quel).",
            "PREUVE — test_adapter_sans_decouvert.mjs (vrai navigateur, 12 contrôles) : Courant 15 000, potentiel théorique ≈ 18 000 / mois : novembre réduit de 7 090 à 2 880, point bas −116 → +4 ; aperçu à blanc ; Annuler ; le bouton ouvre l'aperçu ; Valider applique tel que montré, Relevé jamais sous zéro ; appel direct identique ; Courant à 1 000 : rien versé, « même sans cette épargne ». test_epargne_potentiel.mjs inchangé et vert.",
        ] },
        { version: "37.153 L'épargne variable se voit au Budget", date: "2026-11-27", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.154');
