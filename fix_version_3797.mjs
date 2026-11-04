/* v37.97 Recalibrer l'année — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.96 Sauvegarde hors VPS";`, `const CURRENT_VERSION = "37.97 Recalibrer l'année";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.96 Sauvegarde hors VPS", date: "2026-11-03", changes: [`,
`                    const CHANGELOG = [
        { version: "37.97 Recalibrer l'année", date: "2026-11-03", changes: [
            "🎯 RECALIBRER L'ANNÉE EN UN GESTE — un seul bouton (Flux exceptionnels) fait, dans l'ordre : retire les virements en double, recale sur le potentiel l'épargne qui l'est déjà, puis alimente le Courant au juste besoin. Les montants d'épargne fixes ne sont jamais touchés. Un tableau avant / après : point bas du Courant, comptes sous zéro, épargne programmée face à ce que l'année permet, virements, alertes. « ↩️ Annuler » ramène virements et épargne d'avant — les opérations importées entre-temps ne bougent pas.",
            "📸 PROPOSÉ D'OFFICE — après un import de captures qui change vos soldes ou ajoute des opérations : « Recalibrer l'année maintenant » dans l'écran de fin d'import.",
            "🛡️ GARDE-FOUS VISIBLES — compte qui passe sous zéro (quel mois, combien), épargne programmée plus grande que ce que l'année permet, virement en double (retiré d'un toucher), aller-retour le même jour entre deux comptes.",
            "🧮 CFO — il peut demander « recalibrer l'année » à l'appli (app_action task=recalibrer_annee) et lit les garde-fous de l'année : l'appli calcule, il ne refait pas les montants.",
        ] },
        { version: "37.96 Sauvegarde hors VPS", date: "2026-11-03", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.97');
