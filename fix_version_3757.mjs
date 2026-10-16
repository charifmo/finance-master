/* v37.57 Journal — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.56 Tickets-Cumules";`, `const CURRENT_VERSION = "37.57 Journal";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.56 Tickets-Cumules", date: "2026-10-15", changes: [`,
`                    const CHANGELOG = [
        { version: "37.57 Journal", date: "2026-10-16", changes: [
            "📋 LE JOURNAL, OUTIL DE TRAVAIL — trois vues : 🗓️ PAR DATE (le cycle de paie en cours ouvert, les cycles précédents en ARCHIVES repliées, jour par jour avec leur total) ; 🗂️ PAR CATÉGORIE (chaque famille et ses lignes : total, nombre, moyenne, dernier achat, libellés fréquents, ▲▼ l'écart au cycle précédent) ; 💡 LEÇONS (ce que vous avez retenu, par catégorie).",
            "🔎 CHERCHER ET FILTRER — un libellé, une catégorie, une note ou un montant ; la période (ce cycle, le précédent, 3 cycles, tout) ; la catégorie (une famille prend ses lignes), le compte, la source, « ⚠️ à vérifier ». Le résumé suit : nombre, total, moyenne. Vue et période retenues sur l'appareil.",
            "✏️ UN CLIC OUVRE L'OPÉRATION — libellé, montant, date, catégorie, compte se corrigent sur place ; « 💡 ce que je retiens » s'y attache, « 📌 c'est une leçon » ; « 🔎 toutes les mêmes », « ↻ ressaisir aujourd'hui », « 🗑 supprimer » (confirmé). Une ligne de banque sans date apparaît en tête, « à dater ». Plus de tableau à faire défiler au téléphone.",
            "🗄️ STOCKAGE — inchangé : les opérations restent dans le document unique (Postgres finance_state, repli fichier), celui que lit et écrit aussi l'agent n8n ; « note » et « lecon » sont deux champs de plus sur l'opération, l'archive est une vue par cycle. Aucune table, aucune migration, rien à changer dans n8n.",
            "🏦 BANQUE — « 7) GOOGLE*… » (le jour « 07 » lu « 7) » sur une capture Attijarinet PC) prend sa date.",
            "PREUVE — nouvelle suite « Journal » : 32 contrôles, dont le téléphone à 390 px. Rejouée sur la v37.56 : 11 en échec. Quinze défauts réintroduits exprès : tous attrapés.",
        ] },
        { version: "37.56 Tickets-Cumules", date: "2026-10-15", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.57 Journal');
