/**
 * fix_consolidate_v2420c.mjs
 * Consolidation finale v24.20 :
 *   - Op A : Ajoute computed journalHybridePourReleve (JS)
 *   - Op B : Inline Relevé : table hybride → journalHybridePourReleve
 *   - Op C : Inline Relevé : supprime table classique
 *   - Op D : Version bump → "24.20 Journal-Hybride-Universel"
 *   - Op E : Changelog
 */

import { readFileSync, writeFileSync } from 'fs';

const FILE = 'C:/Users/HP/finance/index.html';
let html = readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');

let opCount = 0;

function check(label, needle) {
    if (!html.includes(needle)) {
        console.error(`\n❌ ANCHOR NOT FOUND: ${label}`);
        console.error(`   Preview: ${JSON.stringify(needle.slice(0, 180))}`);
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

// ── Op A : Computed journalHybridePourReleve ──────────────────────────────────
replace(
    'OpA - journalHybridePourReleve computed (JS)',
    `return { entries, soldeAtterrissage: soldeProj };
                    });

                    const getMonthlyVariableValue`,
    `return { entries, soldeAtterrissage: soldeProj };
                    });

                    // v24.20 Journal Hybride Universel : items individuels pour tout cycle (actuel ou passé)
                    const journalHybridePourReleve = computed(() => {
                        calculationTick.value;
                        if (!releveActiveCycle.value) return journalHybride.value;

                        const [mStr, aStr] = releveActiveCycle.value.split('-');
                        const mois = Number(mStr), an = Number(aStr);
                        const dAnnee = donneesAnnuelles.value[an];
                        const jdp = Number((soldesInitiaux.value || {}).jourDePaie) || 27;
                        if (!dAnnee) return { entries: [], soldeAtterrissage: 0 };

                        // Solde d'ouverture : dernier soldeApres avant ce mois dans bilanJournal
                        const moisNoms = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
                        const j = bilanJournal.value;
                        const courantCpt = (comptes.value || []).find(c => c.type === 'courant' || c.type === 'liquide');
                        const courantKey = courantCpt ? 'cpt_' + courantCpt.id : Object.keys(j)[0];
                        let soldeInit = 0;
                        if (courantKey && j[courantKey]) {
                            for (const e of j[courantKey]) {
                                if (e.type === 'initial') { soldeInit = e.soldeApres; continue; }
                                if (!e.mois || e.mois === '—') continue;
                                const ep = e.mois.split(' ');
                                const eAn = Number(ep[1] || 0);
                                const eMois = moisNoms.indexOf(ep[0]);
                                if (eAn > an || (eAn === an && eMois >= mois)) break;
                                soldeInit = e.soldeApres;
                            }
                        }

                        const allItems = [];

                        Object.values(dAnnee.revenus || {}).forEach(r => {
                            const due = Number(r.base || 0); if (!due) return;
                            const paid = isItemPaid(r, due);
                            const amt = paid ? (getPaidAmount(r, due) || due) : due;
                            allItems.push({ libelle: r.label || 'Revenu', montant: amt, type: 'credit', jourPrevu: Number(r.jourPrevu || jdp), etat: paid ? 'realise' : 'prevu' });
                        });

                        Object.values(dAnnee.chargesFixes || {}).forEach(f => {
                            const due = Number(f.valeur || 0); if (!due) return;
                            const paid = isItemPaid(f, due);
                            const amt = paid ? (getPaidAmount(f, due) || due) : due;
                            allItems.push({ libelle: f.label || 'Charge fixe', montant: amt, type: 'debit', jourPrevu: Number(f.jourPrevu || 10), etat: paid ? 'realise' : 'prevu' });
                        });

                        Object.values(dAnnee.chargesVariables || {}).forEach(cv => {
                            if ((cv.details || []).length > 0) {
                                cv.details.forEach(d => {
                                    const due = Number(d.montant || 0); if (!due) return;
                                    const paid = isItemPaid(d, due);
                                    const amt = paid ? (getPaidAmount(d, due) || due) : due;
                                    allItems.push({ libelle: (cv.label ? cv.label + ' · ' : '') + (d.label || d.nom || ''), montant: amt, type: 'debit', jourPrevu: 15, etat: paid ? 'realise' : 'prevu' });
                                });
                            } else {
                                const due = Number(cv.valeur || 0); if (!due) return;
                                const paid = isItemPaid(cv, due);
                                const amt = paid ? (getPaidAmount(cv, due) || due) : due;
                                allItems.push({ libelle: cv.label || 'Variable', montant: amt, type: 'debit', jourPrevu: 15, etat: paid ? 'realise' : 'prevu' });
                            }
                        });

                        getDepensesMois(mois, an).forEach(dep => {
                            const due = Number(dep.montant || 0); if (!due) return;
                            const paid = isItemPaid(dep, due);
                            const amt = paid ? (getPaidAmount(dep, due) || due) : due;
                            allItems.push({ libelle: dep.nom || dep.label || 'Dépense', montant: amt, type: 'debit', jourPrevu: 20, etat: paid ? 'realise' : 'prevu' });
                        });

                        allItems.sort((a, b) => a.jourPrevu - b.jourPrevu);

                        const entries = [];
                        entries.push({ type: 'initial', libelle: 'Solde Initial du Cycle', montant: soldeInit, soldeApres: soldeInit, jourPrevu: jdp, etat: 'realise' });
                        let soldeCourant = soldeInit;
                        allItems.forEach(item => {
                            soldeCourant = Math.round((soldeCourant + (item.type === 'credit' ? item.montant : -item.montant)) * 100) / 100;
                            entries.push({ ...item, soldeApres: soldeCourant });
                        });

                        return { entries, soldeAtterrissage: soldeCourant };
                    });

                    const getMonthlyVariableValue`
);

// ── Op B : Inline table hybride → journalHybridePourReleve ───────────────────
replace(
    'OpB - Inline: table hybride v-if + source → journalHybridePourReleve',
    `                                <!-- Journal Hybride : cycle actuel (pas de filtre cycle passé) -->
                                <table v-if="!releveActiveCycle" class="w-full min-w-[400px] text-sm border-collapse">
                                    <thead class="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-400 w-10">J.</th>
                                            <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Libellé</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-green-600 w-24">Entrant</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-red-500 w-24">Sortant</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-gray-500 w-24">Solde</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <template v-for="(e, i) in journalHybride.entries" :key="i">
                                            <tr v-if="e.type === 'separator'" class="bg-cyan-50 border-y-2 border-cyan-400">
                                                <td colspan="5" class="py-1.5 px-3 text-center">
                                                    <span class="text-[10px] font-black uppercase tracking-widest text-cyan-700">⏰ AUJOURD'HUI</span>
                                                    <span class="text-[10px] font-bold text-cyan-500 ml-2">Solde réel : {{ formatMAD(tresoActuelleCourante) }}</span>
                                                </td>
                                            </tr>
                                            <tr v-else-if="e.type === 'initial'" class="bg-blue-50 border-b-2 border-blue-300">
                                                <td class="p-2 text-[10px] font-bold text-blue-400">J.{{ e.jourPrevu }}</td>
                                                <td colspan="3" class="p-2 text-xs font-black text-blue-700 uppercase tracking-wider">{{ e.libelle }}</td>
                                                <td class="p-2 text-right font-black text-xs tabular-nums text-blue-700">{{ formatMAD(e.soldeApres) }}</td>
                                            </tr>
                                            <tr v-else :class="['border-b transition-all', e.etat === 'prevu' ? 'opacity-50 border-dashed border-gray-200 bg-white' : (e.type === 'credit' ? 'border-gray-100 bg-green-50/30 hover:bg-green-50/60' : 'border-gray-100 bg-white hover:bg-gray-50')]">
                                                <td class="p-2 text-[10px] text-gray-400 font-bold whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '' }}</td>
                                                <td class="p-2 text-xs text-gray-700"><span v-if="e.etat === 'prevu'" class="inline-block text-[8px] font-black bg-amber-100 text-amber-600 px-1 rounded mr-1">⏳</span>{{ e.libelle }}</td>
                                                <td class="p-2 text-right font-bold text-green-600 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : '' }}</td>
                                                <td class="p-2 text-right font-bold text-red-500 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                                <td class="p-2 text-right font-black text-xs tabular-nums" :class="e.soldeApres < 0 ? 'text-red-600' : 'text-gray-800'">{{ formatMAD(e.soldeApres) }}</td>
                                            </tr>
                                        </template>
                                    </tbody>
                                    <tfoot>
                                        <tr class="bg-indigo-50 border-t-2 border-indigo-400 sticky bottom-0">
                                            <td colspan="4" class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-indigo-700">🏁 Atterrissage projeté au 26</td>
                                            <td class="p-2 text-right font-black text-sm tabular-nums" :class="journalHybride.soldeAtterrissage < 0 ? 'text-red-600' : 'text-indigo-700'">{{ formatMAD(journalHybride.soldeAtterrissage) }}</td>
                                        </tr>
                                    </tfoot>
                                </table>`,
    `                                <!-- Journal Hybride Universel v24.20 : cycle actuel OU passé -->
                                <table v-if="journalHybridePourReleve.entries.length > 0" class="w-full min-w-[400px] text-sm border-collapse">
                                    <thead class="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-400 w-10">J.</th>
                                            <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Libellé</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-green-600 w-24">Entrant</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-red-500 w-24">Sortant</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-gray-500 w-24">Solde</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <template v-for="(e, i) in journalHybridePourReleve.entries" :key="i">
                                            <tr v-if="e.type === 'separator'" class="bg-cyan-50 border-y-2 border-cyan-400">
                                                <td colspan="5" class="py-1.5 px-3 text-center">
                                                    <span class="text-[10px] font-black uppercase tracking-widest text-cyan-700">⏰ AUJOURD'HUI</span>
                                                    <span class="text-[10px] font-bold text-cyan-500 ml-2">Solde réel : {{ formatMAD(tresoActuelleCourante) }}</span>
                                                </td>
                                            </tr>
                                            <tr v-else-if="e.type === 'initial'" class="bg-blue-50 border-b-2 border-blue-300">
                                                <td class="p-2 text-[10px] font-bold text-blue-400">J.{{ e.jourPrevu }}</td>
                                                <td colspan="3" class="p-2 text-xs font-black text-blue-700 uppercase tracking-wider">{{ e.libelle }}</td>
                                                <td class="p-2 text-right font-black text-xs tabular-nums text-blue-700">{{ formatMAD(e.soldeApres) }}</td>
                                            </tr>
                                            <tr v-else :class="['border-b transition-all', e.etat === 'prevu' ? 'opacity-50 border-dashed border-gray-200 bg-white' : (e.type === 'credit' ? 'border-gray-100 bg-green-50/30 hover:bg-green-50/60' : 'border-gray-100 bg-white hover:bg-gray-50')]">
                                                <td class="p-2 text-[10px] text-gray-400 font-bold whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '' }}</td>
                                                <td class="p-2 text-xs text-gray-700"><span v-if="e.etat === 'prevu'" class="inline-block text-[8px] font-black bg-amber-100 text-amber-600 px-1 rounded mr-1">⏳</span>{{ e.libelle }}</td>
                                                <td class="p-2 text-right font-bold text-green-600 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : '' }}</td>
                                                <td class="p-2 text-right font-bold text-red-500 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                                <td class="p-2 text-right font-black text-xs tabular-nums" :class="e.soldeApres < 0 ? 'text-red-600' : 'text-gray-800'">{{ formatMAD(e.soldeApres) }}</td>
                                            </tr>
                                        </template>
                                    </tbody>
                                    <tfoot>
                                        <tr class="bg-indigo-50 border-t-2 border-indigo-400 sticky bottom-0">
                                            <td colspan="4" class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-indigo-700">{{ releveActiveCycle ? '🏁 Solde de clôture' : '🏁 Atterrissage projeté au 26' }}</td>
                                            <td class="p-2 text-right font-black text-sm tabular-nums" :class="journalHybridePourReleve.soldeAtterrissage < 0 ? 'text-red-600' : 'text-indigo-700'">{{ formatMAD(journalHybridePourReleve.soldeAtterrissage) }}</td>
                                        </tr>
                                    </tfoot>
                                </table>`
);

// ── Op C : Inline — supprimer table classique ─────────────────────────────────
replace(
    'OpC - Inline: supprimer table classique',
    `                                <!-- Journal Classique : cycle passé sélectionné -->
                                <table v-else-if="releveCompte.length > 0" class="w-full min-w-[500px] text-sm border-collapse">
                                    <thead class="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500 w-20">Période</th>
                                            <th v-if="releveShowCompte" class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Compte</th>
                                            <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Libellé</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-green-600 w-24">Entrant</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-red-500 w-24">Sortant</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-gray-500 w-24">Solde</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="(e, i) in releveCompteGrouped" :key="i"
                                            :class="[e.type === 'initial' ? 'border-b-2 border-blue-300 bg-blue-50' : (e._gMois % 2 === 0 ? 'border-b border-gray-100 hover:bg-white bg-white' : 'border-b border-indigo-100 bg-indigo-50/60 hover:bg-indigo-100/60'), e._isNewMonth && e.type !== 'initial' ? 'border-t-2 border-indigo-300' : '']">
                                            <td class="p-2 font-bold text-gray-600 whitespace-nowrap text-xs">{{ e.mois }}</td>
                                            <td v-if="releveShowCompte" class="p-2 text-xs font-bold whitespace-nowrap" :class="e._compteKey && e._compteKey.startsWith('ep_') ? 'text-purple-600' : 'text-blue-600'">{{ e._compteLabel }}</td>
                                            <td class="p-2 text-xs" :class="e.type === 'initial' ? 'font-black text-blue-700 uppercase tracking-wider' : 'text-gray-700'">{{ e.libelle }}</td>
                                            <td class="p-2 text-right font-bold text-green-600 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : (e.type === 'initial' && e.montant ? formatMAD(e.montant) : '') }}</td>
                                            <td class="p-2 text-right font-bold text-red-500 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                            <td class="p-2 text-right font-black text-xs tabular-nums" :class="e.type === 'initial' ? 'text-blue-700' : (e.soldeApres < 0 ? 'text-red-600' : 'text-gray-800')">{{ formatMAD(e.soldeApres) }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                                <p v-else class="text-center text-gray-400 py-12 font-bold text-sm">Aucun mouvement enregistré.</p>`,
    `                                <p v-else class="text-center text-gray-400 py-12 font-bold text-sm">Aucun mouvement enregistré.</p>`
);

// ── Op D : Version bump ───────────────────────────────────────────────────────
replace(
    'OpD - Version bump',
    `const CURRENT_VERSION = "24.10 Retro-KPI";`,
    `const CURRENT_VERSION = "24.20 Journal-Hybride-Universel";`
);

// ── Op E : Changelog ──────────────────────────────────────────────────────────
replace(
    'OpE - Changelog entry',
    `const CHANGELOG = [
        { version: "24.10 Retro-KPI"`,
    `const CHANGELOG = [
        { version: "24.20 Journal-Hybride-Universel", date: "2026-05-30", changes: [
            "journalHybridePourReleve : items individuels pour tout cycle (actuel ou passe)",
            "Suppression ligne agregee Charges variables (Prorata Pilotage)",
            "Inline + Modal : une seule table hybride, plus de bascule classic/hybride",
            "Footer conditionnel : Solde de cloture (cycle passe) / Atterrissage projete (cycle actuel)"
        ] },
        { version: "24.10 Retro-KPI"`
);

// ── Écriture ──────────────────────────────────────────────────────────────────
writeFileSync(FILE, html.replace(/\n/g, '\r\n'), 'utf8');
console.log(`\n🎉 v24.20 consolidé — ${opCount} ops appliquées !`);
