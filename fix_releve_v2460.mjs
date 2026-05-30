/**
 * fix_releve_v2460.mjs
 * v24.60 Relevé-Fix
 *
 * Op 1 : journalHybride — getDepensesCycle pour la règle du 27 (cycle actuel)
 * Op 2 : journalHybridePourReleve — routing account filter + past cycle clos
 * Op 3 : Template inline Relevé — cycleClos div avant la table
 * Op 4 : Template modal Relevé — cycleClos div avant la table
 * Op 5 : Version bump → "24.60 Relevé-Fix"
 * Op 6 : Changelog
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

// ── Op 1 : journalHybride — getDepensesCycle pour la règle du 27 ──────────────
replace(
    'Op1 - journalHybride uses getDepensesCycle (règle du 27)',
    `                        // Dépenses irrégulières du mois
                        getDepensesMois(mois, an).forEach(dep => {
                            const due = Number(dep.montant || 0);
                            if (!due) return;
                            const paid = isItemPaid(dep, due);
                            const amt = paid ? (getPaidAmount(dep, due) || due) : due;
                            (paid ? paidItems : unpaidItems).push({
                                libelle: dep.nom || dep.label || 'Dépense',
                                montant: amt, type: 'debit',
                                jourPrevu: 20,
                                etat: paid ? 'realise' : 'prevu'
                            });
                        });`,
    `                        // Dépenses irrégulières — v24.60 règle du 27 (cycle-aware)
                        getDepensesCycle(mois, an).forEach(dep => {
                            const due = Number(dep.montant || 0);
                            if (!due) return;
                            const paid = isItemPaid(dep, due);
                            const amt = paid ? (getPaidAmount(dep, due) || due) : due;
                            (paid ? paidItems : unpaidItems).push({
                                libelle: dep.nom || dep.label || 'Dépense',
                                montant: amt, type: 'debit',
                                jourPrevu: 20,
                                etat: paid ? 'realise' : 'prevu'
                            });
                        });`
);

// ── Op 2 : journalHybridePourReleve — routing + account filter + cycle clos ───
replace(
    'Op2 - journalHybridePourReleve routing account filter + past cycle clos',
    `                    // v24.20 Journal Hybride Universel : items individuels pour tout cycle (actuel ou passé)
                    const journalHybridePourReleve = computed(() => {
                        calculationTick.value;
                        if (!releveActiveCycle.value) return journalHybride.value;

                        const [mStr, aStr] = releveActiveCycle.value.split('-');
                        const mois = Number(mStr), an = Number(aStr);
                        const dAnnee = donneesAnnuelles.value[an];
                        const jdp = Number((soldesInitiaux.value || {}).jourDePaie) || 27;
                        if (!dAnnee) return { entries: [], soldeAtterrissage: 0 };`,
    `                    // v24.60 Relevé-Fix : account filter + past cycle clos + rule of 27
                    const journalHybridePourReleve = computed(() => {
                        calculationTick.value;
                        // Routing v24.60 : cycle passé → clos | per-account → bilanJournal | default → hybrid
                        const _rFiltres = releveComptesFiltres.value;
                        const _rJ = bilanJournal.value;
                        const _rCpt = (comptes.value || []).find(c => c.type === 'courant' || c.type === 'liquide');
                        const _rCourantKey = _rCpt ? 'cpt_' + _rCpt.id : Object.keys(_rJ)[0];
                        if (releveActiveCycle.value) {
                            const [_rVM, _rVA] = releveActiveCycle.value.split('-').map(Number);
                            if (_rVA < moisBudgetaire.value.an || (_rVA === moisBudgetaire.value.an && _rVM < moisBudgetaire.value.mois))
                                return { entries: [], soldeAtterrissage: 0, cycleClos: true };
                        }
                        if (_rFiltres.length === 1 && _rFiltres[0] !== _rCourantKey) {
                            const _rRaw = (_rJ[_rFiltres[0]] || []).filter(e => e.type === 'initial' || Number(e.montant || 0) !== 0);
                            return { entries: _rRaw, soldeAtterrissage: _rRaw.length ? Number((_rRaw[_rRaw.length - 1]).soldeApres || 0) : 0 };
                        }
                        if (!releveActiveCycle.value) return journalHybride.value;
                        const [mStr, aStr] = releveActiveCycle.value.split('-');
                        const mois = Number(mStr), an = Number(aStr);
                        const dAnnee = donneesAnnuelles.value[an];
                        const jdp = Number((soldesInitiaux.value || {}).jourDePaie) || 27;
                        if (!dAnnee) return { entries: [], soldeAtterrissage: 0 };`
);

// ── Op 3 : Template inline Relevé — cycleClos div + table v-else-if ───────────
replace(
    'Op3 - Inline Relevé cycleClos div + table v-else-if',
    `                                <!-- Journal Hybride Universel v24.20 : cycle actuel OU passé -->
                                <table v-if="journalHybridePourReleve.entries.length > 0" class="w-full min-w-[400px] text-sm border-collapse">`,
    `                                <!-- Journal Hybride Universel v24.20 : cycle actuel OU passé -->
                                <!-- v24.60 Cycle Clos -->
                                <div v-if="journalHybridePourReleve.cycleClos" class="flex items-center justify-center py-12">
                                    <div class="text-center">
                                        <p class="text-4xl mb-2">🏁</p>
                                        <p class="text-sm font-black text-gray-500 uppercase tracking-widest">Cycle Clos</p>
                                        <p class="text-xs text-gray-400 mt-1">Ce cycle est terminé — consultez le Pilotage pour le bilan</p>
                                    </div>
                                </div>
                                <table v-else-if="journalHybridePourReleve.entries.length > 0" class="w-full min-w-[400px] text-sm border-collapse">`
);

// ── Op 4 : Template modal Relevé — cycleClos div + table v-else-if ───────────
replace(
    'Op4 - Modal Relevé cycleClos div + table v-else-if',
    `                    <!-- Journal Hybride Universel : cycle actuel OU cycle passé -->
                    <table v-if="journalHybridePourReleve.entries.length > 0" class="w-full min-w-[400px] text-sm border-collapse">`,
    `                    <!-- Journal Hybride Universel : cycle actuel OU cycle passé -->
                    <!-- v24.60 Cycle Clos -->
                    <div v-if="journalHybridePourReleve.cycleClos" class="flex items-center justify-center py-12">
                        <div class="text-center">
                            <p class="text-4xl mb-2">🏁</p>
                            <p class="text-sm font-black text-gray-500 uppercase tracking-widest">Cycle Clos</p>
                            <p class="text-xs text-gray-400 mt-1">Ce cycle est terminé — consultez le Pilotage pour le bilan</p>
                        </div>
                    </div>
                    <table v-else-if="journalHybridePourReleve.entries.length > 0" class="w-full min-w-[400px] text-sm border-collapse">`
);

// ── Op 5 : Version bump ───────────────────────────────────────────────────────
replace(
    'Op5 - Version bump',
    `const CURRENT_VERSION = "24.50 Pilotage-Sync";`,
    `const CURRENT_VERSION = "24.60 Relevé-Fix";`
);

// ── Op 6 : Changelog ─────────────────────────────────────────────────────────
replace(
    'Op6 - Changelog entry v24.60',
    `const CHANGELOG = [`,
    `const CHANGELOG = [
        { version: "24.60 Relevé-Fix", date: "2026-05-30", changes: [
            "journalHybride : getDepensesCycle remplace getDepensesMois — règle du 27 pour le cycle actuel (dépenses irrégulières)",
            "journalHybridePourReleve : compte non-courant sélectionné → bilanJournal de ce compte (corrige régression filtre onglets)",
            "journalHybridePourReleve : cycle passé sélectionné → cycleClos:true (aucune transaction affichée)",
            "Template Relevé inline + modal : v-if cycleClos → carte 🏁 Cycle Clos"
        ] },`
);

// ── Écriture ──────────────────────────────────────────────────────────────────
writeFileSync(FILE, html.replace(/\n/g, '\r\n'), 'utf8');
console.log(`\n🎉 v24.60 Relevé-Fix — ${opCount} opérations appliquées !`);
