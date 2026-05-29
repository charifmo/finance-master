/**
 * fix_modal_releve_v2420b.mjs
 * Ops 4-6 manquantes de v24.20 (modal Relevé)
 * À exécuter après fix_journal_hybride_releve_v2420.mjs (Ops 1-3 déjà appliquées)
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

// ── Op 4 : Modal — table hybride → journalHybridePourReleve ──────────────────
replace(
    'Op4 - Modal hybrid table source',
    `                <!-- Tableau : Mode Transactions — v24.0 Journal Hybride -->
                <div v-if="!releveModeEvolution" class="flex-1 overflow-auto">
                    <!-- Journal Hybride : cycle actuel -->
                    <table v-if="!releveActiveCycle" class="w-full min-w-[400px] text-sm border-collapse">
                        <thead class="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-400 w-10">J.</th>
                                <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Libellé</th>
                                <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-green-600 w-28">Entrant</th>
                                <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-red-500 w-28">Sortant</th>
                                <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-gray-500 w-28">Solde</th>
                            </tr>
                        </thead>
                        <tbody>
                            <template v-for="(e, i) in journalHybride.entries" :key="i">
                                <tr v-if="e.type === 'separator'" class="bg-cyan-50 border-y-2 border-cyan-400">
                                    <td colspan="5" class="py-2 px-4 text-center">
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
                            <tr class="bg-indigo-50 border-t-2 border-indigo-400">
                                <td colspan="4" class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-indigo-700">🏁 Atterrissage projeté au 26</td>
                                <td class="p-2 text-right font-black text-sm tabular-nums" :class="journalHybride.soldeAtterrissage < 0 ? 'text-red-600' : 'text-indigo-700'">{{ formatMAD(journalHybride.soldeAtterrissage) }}</td>
                            </tr>
                        </tfoot>
                    </table>`,
    `                <!-- Tableau : Mode Transactions — v24.20 Journal Hybride Universel -->
                <div v-if="!releveModeEvolution" class="flex-1 overflow-auto">
                    <!-- Journal Hybride Universel : cycle actuel OU cycle passé -->
                    <table v-if="journalHybridePourReleve.entries.length > 0" class="w-full min-w-[400px] text-sm border-collapse">
                        <thead class="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-400 w-10">J.</th>
                                <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Libellé</th>
                                <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-green-600 w-28">Entrant</th>
                                <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-red-500 w-28">Sortant</th>
                                <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-gray-500 w-28">Solde</th>
                            </tr>
                        </thead>
                        <tbody>
                            <template v-for="(e, i) in journalHybridePourReleve.entries" :key="i">
                                <tr v-if="e.type === 'separator'" class="bg-cyan-50 border-y-2 border-cyan-400">
                                    <td colspan="5" class="py-2 px-4 text-center">
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
                            <tr class="bg-indigo-50 border-t-2 border-indigo-400">
                                <td colspan="4" class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-indigo-700">{{ releveActiveCycle ? '🏁 Solde de clôture' : '🏁 Atterrissage projeté au 26' }}</td>
                                <td class="p-2 text-right font-black text-sm tabular-nums" :class="journalHybridePourReleve.soldeAtterrissage < 0 ? 'text-red-600' : 'text-indigo-700'">{{ formatMAD(journalHybridePourReleve.soldeAtterrissage) }}</td>
                            </tr>
                        </tfoot>
                    </table>`
);

// ── Op 5 : Modal — supprimer table classique ──────────────────────────────────
replace(
    'Op5 - Modal: supprimer table classique',
    `                    <!-- Journal Classique : cycle passé sélectionné -->
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
                    <p v-else class="text-center text-gray-400 py-8 font-bold">Aucun mouvement enregistré.</p>`,
    `                    <p v-else class="text-center text-gray-400 py-8 font-bold">Aucun mouvement enregistré.</p>`
);

// ── Op 6 : Compteur de lignes inline (ligne 728) ──────────────────────────────
replace(
    'Op6 - Compteur lignes inline',
    `<span class="ml-auto text-[9px] font-bold text-gray-400 uppercase tracking-widest">{{ releveCompte.length }} ligne{{ releveCompte.length > 1 ? 's' : '' }}</span>`,
    `<span class="ml-auto text-[9px] font-bold text-gray-400 uppercase tracking-widest">{{ journalHybridePourReleve.entries.filter(e => e.type !== 'initial').length }} lignes</span>`
);

// ── Écriture ──────────────────────────────────────────────────────────────────
writeFileSync(FILE, html.replace(/\n/g, '\r\n'), 'utf8');
console.log(`\n🎉 v24.20b — ${opCount} opérations modal appliquées !`);
