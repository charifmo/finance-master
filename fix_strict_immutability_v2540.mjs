/**
 * fix_strict_immutability_v2540.mjs
 * v25.40 Strict-Immutability
 *
 * RÈGLE D'OR : seule la saisie manuelle directe modifie compte.solde.
 *
 * Op 1 : toggleItemPaid — suppression du side-effect qui mutait compteCible.solde.
 *         Cocher/décocher ne change QUE item.paye / item.montantPaye.
 * Op 2 : Version bump → "25.40 Strict-Immutability"
 * Op 3 : Changelog
 *
 * Audit CHANTIER 2 : les CRUD de flux ne mutent pas .solde (vérifié). Les seules
 * autres écritures sur compte.solde sont : (a) saisie manuelle (inputs v-model),
 * (b) migration patchV151 (soldeInitial→solde, une fois), (c) sandbox "appliquer
 * scénario" (action explicite confirmée par l'utilisateur). Toutes légitimes.
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

// ── Op 1 : toggleItemPaid — retrait du side-effect sur compte.solde ───────────
const OLD_TOGGLE = `                    const toggleItemPaid = (item, dueAmount) => {
                        // v22.80 Pilotage-Ledger : synchronise compte.solde au pointage
                        const wasAlreadyPaid = isItemPaid(item, dueAmount);
                        if (wasAlreadyPaid) {
                            item.paye = false;
                            item.montantPaye = 0;
                        } else {
                            item.paye = true;
                            item.montantPaye = dueAmount;
                        }
                        // Déterminer si c'est un revenu (les revenus ont un champ 'base')
                        const isRevenu = 'base' in item;
                        const compteKey = isRevenu
                            ? (item.destinationCompte || 'courant')
                            : (item.sourceCompte || 'courant');
                        // Résoudre le compte cible dans comptes.value
                        let compteCible = null;
                        if (compteKey === 'courant') {
                            // v23.15 : inclure type 'liquide' comme compte courant principal
                            compteCible = (comptes.value || []).find(c => c.type === 'courant' || c.type === 'liquide');
                        } else if (compteKey.startsWith('cpt_')) {
                            const cptId = compteKey.slice(4);
                            compteCible = (comptes.value || []).find(c => String(c.id) === String(cptId));
                        } else if (compteKey.startsWith('ep_')) {
                            // Compte épargne — pas de mutation directe sur solde ici
                            compteCible = null;
                        }
                        if (compteCible) {
                            // signe : +1 pour revenu, -1 pour charge
                            const signe = isRevenu ? 1 : -1;
                            // delta : si on coche → ±montant ; si on décoche → ∓montant
                            const delta = wasAlreadyPaid ? -signe * dueAmount : signe * dueAmount;
                            compteCible.solde = Math.round(((Number(compteCible.solde) || 0) + delta) * 100) / 100;
                        }
                        handleDataChange();
                    };`;

const NEW_TOGGLE = `                    const toggleItemPaid = (item, dueAmount) => {
                        // v25.40 Strict-Immutability : cocher/décocher ne change QUE l'état de l'item.
                        // Le solde réel des comptes n'est JAMAIS muté ici — seule la saisie manuelle
                        // (formulaire de mise à jour des soldes) modifie compte.solde. Le moteur de
                        // projection ignore simplement l'élément coché pour le futur.
                        const wasAlreadyPaid = isItemPaid(item, dueAmount);
                        if (wasAlreadyPaid) {
                            item.paye = false;
                            item.montantPaye = 0;
                        } else {
                            item.paye = true;
                            item.montantPaye = dueAmount;
                        }
                        handleDataChange();
                    };`;

replace('Op1 - toggleItemPaid : retrait mutation compte.solde', OLD_TOGGLE, NEW_TOGGLE);

// ── Op 2 : Version bump ───────────────────────────────────────────────────────
replace(
    'Op2 - Version bump',
    `const CURRENT_VERSION = "25.30 Future-Restored";`,
    `const CURRENT_VERSION = "25.40 Strict-Immutability";`
);

// ── Op 3 : Changelog ──────────────────────────────────────────────────────────
replace(
    'Op3 - Changelog entry v25.40',
    `const CHANGELOG = [`,
    `const CHANGELOG = [
        { version: "25.40 Strict-Immutability", date: "2026-05-30", changes: [
            "RÈGLE D'OR : le solde réel d'un compte n'est modifiable QUE par saisie manuelle directe (formulaire des soldes)",
            "toggleItemPaid (checklist Pilotage) ne mute plus compte.solde — cocher/décocher ne change que item.paye / montantPaye ; la ligne ⏰ AUJOURD'HUI reste figée sur le solde bancaire réel",
            "Le moteur de projection retire automatiquement l'élément coché du futur et recalcule l'atterrissage, sans toucher la base"
        ] },`
);

// ── Écriture ──────────────────────────────────────────────────────────────────
writeFileSync(FILE, html.replace(/\n/g, '\r\n'), 'utf8');
console.log(`\n🎉 v25.40 Strict-Immutability — ${opCount} opérations appliquées !`);
