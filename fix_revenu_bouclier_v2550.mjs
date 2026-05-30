/**
 * fix_revenu_bouclier_v2550.mjs
 * v25.50 Revenu-Bouclier
 *
 * BUG : les revenus du Pilotage affichent leur valeur BRUTE (rev.base) sans appliquer
 *       les règles d'exception (moisDebut/moisFin → nouvelleValeur). Ex : Appartement
 *       suspendu à 0 jusqu'au mois 7 apparaît quand même à 2 750 DH en "prévu".
 *       Les charges fixes appliquent déjà getDueFixe — les revenus n'avaient pas d'équivalent.
 *
 * Op 1 : Ajout getDueRevenu(item, aNum) — mirroir de getDueFixe pour le champ 'base'
 * Op 2 : tresoActuelleMois + tresoEntrees → valeur effective (getDueRevenu)
 * Op 3 : revenusBudgetairesTries → masque les revenus suspendus (valeur effective <= 0)
 * Op 4 : Templates (desktop + mobile) → getDueRevenu au lieu de rev.base brut
 * Op 5 : Version bump + Changelog
 */

import { readFileSync, writeFileSync } from 'fs';

const FILE = 'C:/Users/HP/finance/index.html';
let html = readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');

let opCount = 0;

function check(label, needle) {
    if (!html.includes(needle)) {
        console.error(`\n❌ ANCHOR NOT FOUND: ${label}`);
        console.error(`   Preview: ${JSON.stringify(needle.slice(0, 200))}`);
        process.exit(1);
    }
}

function replace(label, from, to) {
    check(label, from);
    const before = html;
    html = html.split(from).join(to);
    if (html === before) {
        console.error(`\n❌ NO CHANGE: ${label}`);
        process.exit(1);
    }
    opCount++;
    console.log(`✅ Op ${opCount} — ${label}`);
}

// ── Op 1 : getDueRevenu — applique les exceptions au champ 'base' ─────────────
replace(
    'Op1 - getDueRevenu helper',
    `                    const getDueFixe = (item, aNum) => {
                        let due = Number(item.valeur || 0);
                        const mNum = Number((soldesInitiaux.value || {}).moisActuel || 4);
                        (item.exceptions || []).forEach(e => {
                            if (mNum >= e.moisDebut && mNum <= e.moisFin) due = Number(e.nouvelleValeur || 0);
                        });
                        return due;
                    };`,
    `                    const getDueFixe = (item, aNum) => {
                        let due = Number(item.valeur || 0);
                        const mNum = Number((soldesInitiaux.value || {}).moisActuel || 4);
                        (item.exceptions || []).forEach(e => {
                            if (mNum >= e.moisDebut && mNum <= e.moisFin) due = Number(e.nouvelleValeur || 0);
                        });
                        return due;
                    };

                    // v25.50 : équivalent de getDueFixe pour les revenus (champ 'base')
                    // applique les règles d'exception → un revenu suspendu vaut 0 ce mois-là
                    const getDueRevenu = (item, aNum) => {
                        let due = Number(item.base || 0);
                        const mNum = Number((soldesInitiaux.value || {}).moisActuel || 4);
                        (item.exceptions || []).forEach(e => {
                            if (mNum >= e.moisDebut && mNum <= e.moisFin) due = Number(e.nouvelleValeur || 0);
                        });
                        return due;
                    };`
);

// ── Op 2 : tresoActuelleMois + tresoEntrees → valeur effective ────────────────
replace(
    'Op2 - treso revenus use getDueRevenu (2 computeds)',
    `                            const base = Number(rev.base || 0);
                            if (isItemPaid(rev, base)) entrees += base;`,
    `                            const base = getDueRevenu(rev, an);
                            if (isItemPaid(rev, base)) entrees += base;`
);

// ── Op 3 : revenusBudgetairesTries → masque les revenus suspendus (<= 0) ──────
replace(
    'Op3 - revenusBudgetairesTries filtre valeur effective > 0',
    `                        return Object.values(d.revenus || {}).slice().sort((a, b) =>
                            (a.jourPrevu || 99) - (b.jourPrevu || 99));`,
    `                        return Object.values(d.revenus || {})
                            .filter(r => getDueRevenu(r, mb.an) > 0)
                            .slice().sort((a, b) => (a.jourPrevu || 99) - (b.jourPrevu || 99));`
);

// ── Op 4 : Templates → getDueRevenu au lieu de rev.base brut ──────────────────
// (les occurrences JS ont déjà été remplacées en Op2 ; il ne reste que le template)
replace(
    'Op4 - Templates revenus use getDueRevenu (desktop + mobile)',
    `Number(rev.base || 0)`,
    `getDueRevenu(rev, moisBudgetaire.an)`
);

// ── Op 5 : Version bump + Changelog ───────────────────────────────────────────
replace(
    'Op5a - Version bump',
    `const CURRENT_VERSION = "25.40 Strict-Immutability";`,
    `const CURRENT_VERSION = "25.50 Revenu-Bouclier";`
);
replace(
    'Op5b - Changelog entry v25.50',
    `const CHANGELOG = [`,
    `const CHANGELOG = [
        { version: "25.50 Revenu-Bouclier", date: "2026-05-30", changes: [
            "Bouclier temporel étendu aux REVENUS : getDueRevenu applique les règles d'exception (moisDebut/moisFin → nouvelleValeur) comme getDueFixe le fait pour les charges",
            "Pilotage : un revenu suspendu à 0 ce mois-là (ex: Appartement avec règle 0 jusqu'au mois 7) n'apparaît plus dans les Entrées d'argent",
            "Totaux d'entrées (tresoEntrees, tresoActuelleMois) calculés sur la valeur effective du mois, pas la valeur brute"
        ] },`
);

// ── Écriture ──────────────────────────────────────────────────────────────────
writeFileSync(FILE, html.replace(/\n/g, '\r\n'), 'utf8');
console.log(`\n🎉 v25.50 Revenu-Bouclier — ${opCount} opérations appliquées !`);
