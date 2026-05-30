/**
 * fix_master_cycle_sync_v2580.mjs
 * v25.80 Master-Cycle-Sync  (demande utilisateur intitulée "v25.60" ;
 *   numérotée 25.80 car 25.60/25.70 existent déjà — séquence monotone)
 *
 * CHANTIER 1 : getDueFixe + getDueRevenu utilisent le mois du CYCLE (moisBudgetaire.mois)
 *   et non le mois civil courant (soldesInitiaux.moisActuel).
 *   Le 30 Mai → cycle Juin → mNum = 6, pas 5.
 *
 * CHANTIER 2 : Tri chronologique cycle-aware dans le journal et le Pilotage.
 *   Cycle 27→26 : les jours 27,28,29,30,31 viennent AVANT les jours 1,2…26.
 *
 * CHANTIER 3 : Sélecteur Relevé en DEUX listes larges (Mois / Année).
 *   Remplace la liste combinée peu mobile-friendly.
 *
 * CHANTIER 4 : Nettoyage visuel du journal — suppression opacity-50 et badge ⏳
 *   pour les entrées futures (etat === 'prevu').
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

// ═══════════════════════════════════════════════════════════════════════════════
// CHANTIER 1 : Bug racine — mois du cycle, pas mois civil
// ═══════════════════════════════════════════════════════════════════════════════

// Op 1 : getDueFixe — moisBudgetaire.mois au lieu de soldesInitiaux.moisActuel
replace(
    'Op1 - getDueFixe : utilise moisBudgetaire.mois (mois du cycle)',
    `                    const getDueFixe = (item, aNum) => {
                        let due = Number(item.valeur || 0);
                        const mNum = Number((soldesInitiaux.value || {}).moisActuel || 4);`,
    `                    const getDueFixe = (item, aNum) => {
                        let due = Number(item.valeur || 0);
                        // v25.80 Master-Cycle-Sync : évaluation par rapport au mois du CYCLE, pas le mois civil
                        const mNum = Number(moisBudgetaire?.value?.mois || (soldesInitiaux.value || {}).moisActuel || 4);`
);

// Op 2 : getDueRevenu — idem
replace(
    'Op2 - getDueRevenu : utilise moisBudgetaire.mois (mois du cycle)',
    `                    // v25.50 : équivalent de getDueFixe pour les revenus (champ 'base')
                    // applique les règles d'exception → un revenu suspendu vaut 0 ce mois-là
                    const getDueRevenu = (item, aNum) => {
                        let due = Number(item.base || 0);
                        const mNum = Number((soldesInitiaux.value || {}).moisActuel || 4);`,
    `                    // v25.50 : équivalent de getDueFixe pour les revenus (champ 'base')
                    // applique les règles d'exception → un revenu suspendu vaut 0 ce mois-là
                    const getDueRevenu = (item, aNum) => {
                        let due = Number(item.base || 0);
                        // v25.80 Master-Cycle-Sync : évaluation par rapport au mois du CYCLE, pas le mois civil
                        const mNum = Number(moisBudgetaire?.value?.mois || (soldesInitiaux.value || {}).moisActuel || 4);`
);

// ═══════════════════════════════════════════════════════════════════════════════
// CHANTIER 2 : Tri chronologique cycle-aware
// ═══════════════════════════════════════════════════════════════════════════════

// Op 3 : journalHybridePourReleve — sort cycle-aware (27,28…31 avant 1…26)
replace(
    'Op3 - journalHybridePourReleve : tri cycle-aware',
    `                        dispLegs.sort((x, y) => (x.jourPrevu || 0) - (y.jourPrevu || 0));`,
    `                        // v25.80 Master-Cycle-Sync : tri cyclique — jours ≥ jdp (27…31) avant jours 1…26
                        const _cSort = (j) => (j || 0) >= jdp ? (j || 0) - jdp : (j || 0) + (32 - jdp);
                        dispLegs.sort((x, y) => _cSort(x.jourPrevu) - _cSort(y.jourPrevu));`
);

// Op 4 : journalHybride (Pilotage) — sort cycle-aware
replace(
    'Op4 - journalHybride Pilotage : tri cycle-aware',
    `                        paidItems.sort((a, b) => a.jourPrevu - b.jourPrevu);
                        unpaidItems.sort((a, b) => a.jourPrevu - b.jourPrevu);`,
    `                        // v25.80 Master-Cycle-Sync : tri cyclique
                        const _pSort = (j) => (j || 0) >= jdp ? (j || 0) - jdp : (j || 0) + (32 - jdp);
                        paidItems.sort((a, b) => _pSort(a.jourPrevu) - _pSort(b.jourPrevu));
                        unpaidItems.sort((a, b) => _pSort(a.jourPrevu) - _pSort(b.jourPrevu));`
);

// ═══════════════════════════════════════════════════════════════════════════════
// CHANTIER 3 : Deux sélecteurs larges Mois / Année — + computeds dérivés
// ═══════════════════════════════════════════════════════════════════════════════

// Op 5 : ajout des computeds releveSelectedMois / releveSelectedAn
replace(
    'Op5 - ajout computeds releveSelectedMois / releveSelectedAn',
    `                    const releveActiveCycle = ref(null); // v23.20 : "6-2026" = Cycle Juin 2026, null = tout`,
    `                    const releveActiveCycle = ref(null); // v23.20 : "6-2026" = Cycle Juin 2026, null = tout

                    // v25.80 Master-Cycle-Sync : mois et année dérivés du cycle sélectionné (pour les deux sélecteurs)
                    const releveSelectedMois = computed(() => {
                        if (!releveActiveCycle.value) return moisBudgetaire.value.mois;
                        const p = String(releveActiveCycle.value).split('-').map(Number);
                        return (p[0] >= 1 && p[0] <= 12) ? p[0] : moisBudgetaire.value.mois;
                    });
                    const releveSelectedAn = computed(() => {
                        if (!releveActiveCycle.value) return moisBudgetaire.value.an;
                        const p = String(releveActiveCycle.value).split('-').map(Number);
                        return (p[1] > 2000) ? p[1] : moisBudgetaire.value.an;
                    });`
);

// Op 6 : inline Relevé — remplace le sélecteur combiné par deux sélecteurs larges
replace(
    'Op6 - inline Relevé : deux sélecteurs Mois / Année',
    `                                        <div class="flex items-center gap-1.5 ml-auto">
                                            <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Cycle</label>
                                            <select :value="releveActiveCycle || (moisBudgetaire.mois + '-' + moisBudgetaire.an)"
                                                @change="releveActiveCycle = $event.target.value || null; releveAnneesFiltres = []; releveMoisFiltres = []"
                                                class="text-xs font-bold bg-white border border-gray-200 rounded-lg px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer">
                                                <option v-for="cy in releveCyclesFuturs" :key="cy.key" :value="cy.key">{{ cy.nom }}</option>
                                            </select>
                                        </div>`,
    `                                        <!-- v25.80 Master-Cycle-Sync : deux sélecteurs larges Mois + Année -->
                                        <div class="flex items-center gap-2 ml-auto">
                                            <select :value="releveSelectedMois"
                                                @change="releveActiveCycle = $event.target.value + '-' + releveSelectedAn; releveAnneesFiltres = []; releveMoisFiltres = []"
                                                class="text-sm font-bold bg-white border-2 border-indigo-200 rounded-xl px-3 py-2 text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer shadow-sm">
                                                <option v-for="n in 12" :key="n" :value="n">{{ ['','Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'][n] }}</option>
                                            </select>
                                            <select :value="releveSelectedAn"
                                                @change="releveActiveCycle = releveSelectedMois + '-' + $event.target.value; releveAnneesFiltres = []; releveMoisFiltres = []"
                                                class="text-sm font-bold bg-white border-2 border-indigo-200 rounded-xl px-3 py-2 text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer shadow-sm">
                                                <option :value="moisBudgetaire.an">{{ moisBudgetaire.an }}</option>
                                                <option :value="moisBudgetaire.an + 1">{{ moisBudgetaire.an + 1 }}</option>
                                            </select>
                                        </div>`
);

// Op 7 : modal Relevé — remplace le sélecteur combiné par deux sélecteurs larges
replace(
    'Op7 - modal Relevé : deux sélecteurs Mois / Année',
    `                            <!-- v25.30 Future-Restored : titre projection + sélecteur cycle (courant + futurs) -->
                            <span class="text-[11px] font-black text-indigo-600 uppercase tracking-wide">📅 Jusqu'au {{ releveProjectionLabel }}</span>
                            <select :value="releveActiveCycle || (moisBudgetaire.mois + '-' + moisBudgetaire.an)"
                                @change="releveActiveCycle = $event.target.value || null; releveAnneesFiltres = []; releveMoisFiltres = []"
                                class="text-xs font-bold bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                                <option v-for="cy in releveCyclesFuturs" :key="cy.key" :value="cy.key">{{ cy.nom }}</option>
                            </select>`,
    `                            <!-- v25.80 Master-Cycle-Sync : deux sélecteurs larges Mois + Année (remplace liste combinée) -->
                            <select :value="releveSelectedMois"
                                @change="releveActiveCycle = $event.target.value + '-' + releveSelectedAn; releveAnneesFiltres = []; releveMoisFiltres = []"
                                class="text-base font-bold bg-white border-2 border-indigo-200 rounded-xl px-4 py-2 text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer shadow-sm min-w-[7rem]">
                                <option v-for="n in 12" :key="n" :value="n">{{ ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'][n] }}</option>
                            </select>
                            <select :value="releveSelectedAn"
                                @change="releveActiveCycle = releveSelectedMois + '-' + $event.target.value; releveAnneesFiltres = []; releveMoisFiltres = []"
                                class="text-base font-bold bg-white border-2 border-indigo-200 rounded-xl px-4 py-2 text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer shadow-sm">
                                <option :value="moisBudgetaire.an">{{ moisBudgetaire.an }}</option>
                                <option :value="moisBudgetaire.an + 1">{{ moisBudgetaire.an + 1 }}</option>
                            </select>`
);

// ═══════════════════════════════════════════════════════════════════════════════
// CHANTIER 4 : Nettoyage visuel du journal — suppression opacity-50 + ⏳
// ═══════════════════════════════════════════════════════════════════════════════

// Op 8 : inline Relevé — suppression opacity-50 / border-dashed / badge ⏳
replace(
    'Op8 - inline Relevé : suppression opacity-50 et badge ⏳',
    `                                            <tr v-else :class="['border-b transition-all', e.etat === 'prevu' ? 'opacity-50 border-dashed border-gray-200 bg-white' : (e.type === 'credit' ? 'border-gray-100 bg-green-50/30 hover:bg-green-50/60' : 'border-gray-100 bg-white hover:bg-gray-50')]">
                                                <td class="p-2 text-[10px] text-gray-400 font-bold whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '' }}</td>
                                                <td class="p-2 text-xs text-gray-700"><span v-if="e.etat === 'prevu'" class="inline-block text-[8px] font-black bg-amber-100 text-amber-600 px-1 rounded mr-1">⏳</span>{{ e.libelle }}</td>`,
    `                                            <!-- v25.80 Master-Cycle-Sync : lignes futures traitées comme les autres (simulation sérieuse) -->
                                            <tr v-else :class="['border-b transition-all', e.type === 'credit' ? 'border-gray-100 bg-green-50/30 hover:bg-green-50/60' : 'border-gray-100 bg-white hover:bg-gray-50']">
                                                <td class="p-2 text-[10px] text-gray-600 font-bold whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '' }}</td>
                                                <td class="p-2 text-xs text-gray-700">{{ e.libelle }}</td>`
);

// Op 9 : modal Relevé — suppression opacity-50 / border-dashed / badge ⏳
replace(
    'Op9 - modal Relevé : suppression opacity-50 et badge ⏳',
    `                                <tr v-else :class="['border-b transition-all', e.etat === 'prevu' ? 'opacity-50 border-dashed border-gray-200 bg-white' : (e.type === 'credit' ? 'border-gray-100 bg-green-50/30 hover:bg-green-50/60' : 'border-gray-100 bg-white hover:bg-gray-50')]">
                                    <td class="p-2 text-[10px] text-gray-400 font-bold whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '' }}</td>
                                    <td class="p-2 text-xs text-gray-700"><span v-if="e.etat === 'prevu'" class="inline-block text-[8px] font-black bg-amber-100 text-amber-600 px-1 rounded mr-1">⏳</span>{{ e.libelle }}</td>`,
    `                                <!-- v25.80 Master-Cycle-Sync : lignes futures traitées comme les autres (simulation sérieuse) -->
                                <tr v-else :class="['border-b transition-all', e.type === 'credit' ? 'border-gray-100 bg-green-50/30 hover:bg-green-50/60' : 'border-gray-100 bg-white hover:bg-gray-50']">
                                    <td class="p-2 text-[10px] text-gray-600 font-bold whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '' }}</td>
                                    <td class="p-2 text-xs text-gray-700">{{ e.libelle }}</td>`
);

// Op 10 : exposer les deux computeds dans le return de setup()
replace(
    'Op10 - exposer releveSelectedMois / releveSelectedAn',
    `                        journalHybridePourReleve, releveProjectionLabel, releveCyclesFuturs,`,
    `                        journalHybridePourReleve, releveProjectionLabel, releveCyclesFuturs, releveSelectedMois, releveSelectedAn,`
);

// ═══════════════════════════════════════════════════════════════════════════════
// Version + Changelog
// ═══════════════════════════════════════════════════════════════════════════════

replace(
    'Op11 - Version bump',
    `const CURRENT_VERSION = "25.70 Pilotage-Align";`,
    `const CURRENT_VERSION = "25.80 Master-Cycle-Sync";`
);

replace(
    'Op12 - Changelog entry v25.80',
    `const CHANGELOG = [`,
    `const CHANGELOG = [
        { version: "25.80 Master-Cycle-Sync", date: "2026-05-30", changes: [
            "BUG RACINE corrigé : getDueFixe + getDueRevenu évaluent les règles d'exception par rapport au MOIS DU CYCLE (moisBudgetaire.mois = 6 pour Juin) et non plus le mois civil (5 pour Mai)",
            "Tri chronologique cycle-aware dans le Relevé et le Pilotage : jours 27→31 classés AVANT jours 1→26 (respect du cycle 27→26)",
            "Relevé : deux sélecteurs larges et séparés Mois / Année remplacent la liste combinée — plus mobile-friendly",
            "Relevé : suppression de opacity-50, border-dashed et du badge ⏳ sur les entrées futures — affichage clair et uniforme",
            "Note de version : demande intitulée V25.60 — numérotée 25.80 (25.60/25.70 déjà publiées)"
        ] },`
);

// ── Écriture ──────────────────────────────────────────────────────────────────
writeFileSync(FILE, html.replace(/\n/g, '\r\n'), 'utf8');
console.log(`\n🎉 v25.80 Master-Cycle-Sync — ${opCount} opérations appliquées !`);
