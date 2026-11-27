/* v37.155 Ce que l'appli pose, affiché chaque mois — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.154 Adapter au potentiel sans découvert";`, `const CURRENT_VERSION = "37.155 Ce que l'appli pose, affiché chaque mois";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.154 Adapter au potentiel sans découvert", date: "2026-11-27", changes: [`,
`                    const CHANGELOG = [
        { version: "37.155 Ce que l'appli pose, affiché chaque mois", date: "2026-11-27", changes: [
            "🤖 « L'APPLI NE DOIT PAS ÊTRE MUETTE : SI RECALIBRER FAIT QUELQUE CHOSE, ELLE DOIT AFFICHER EN PERMANENCE SES TRANSACTIONS, SUR CHAQUE MOIS » — jusqu'ici, « Recalibrer » et ses étapes ne laissaient qu'une ligne dans le journal d'activité et un résumé en haut du Calendrier ; un doublon retiré disparaissait sans trace, une épargne réadaptée ne se voyait qu'en ouvrant ses exceptions.",
            "DÉSORMAIS, DANS LE CALENDRIER — l'en-tête de chaque mois concerné, même fermé : « 🤖 N posé(s) par l'appli » ; le mois ouvert : « 🤖 Posé par l'appli ce mois », une ligne par opération et qui l'a faite (« Recalibrer 2026, le 27/11/2026 ») : 🔄 virement posé pour alimenter le Courant · 🗑️ ancien virement retiré (remplacé) · ⚖️ montant d'une épargne fixé par l'adaptation (et réduit pour garder le compte source ≥ 0) · 📥 virement intégré à une épargne · 🧹 doublon retiré (désormais gardé). Les virements posés par l'appli portent « 🤖 auto ». AU RELEVÉ — « · 🤖 posé par l'appli » sur ces virements, « · ⚖️ adapté par l'appli » sur l'épargne d'un mois adapté. « Annuler le recalibrage » efface aussi ce qu'il avait dit.",
            "PREUVE — test_operations_auto.mjs (vrai navigateur) : avant, aucun mois ne parle ; après « Recalibrer 2026 » : doublon de décembre dit dans décembre, chaque virement posé dans SON mois, chaque mois d'épargne adaptée, l'auteur et la date ; en-têtes des mois fermés, détail, badges ; Relevé ; Annuler.",
        ] },
        { version: "37.154 Adapter au potentiel sans découvert", date: "2026-11-27", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.155');
