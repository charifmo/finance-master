/**
 * v33.11 — UI : bouton « ajouter objectif », tableau de bord Indépendance
 *          Financière, arbitrage Mourabaha, Projet Studio > Exploitation.
 *
 * (La carte d'objectif elle-même est réécrite par build_ui.mjs / v33.11a.)
 */
import fs from 'node:fs';

const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => {
    const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) :\n${from.slice(0, 200)}`);
    s = s.split(from).join(to);
};

/* ══════════════════════════════════════════════════════════════════════════
   1. Bouton d'ajout + TABLEAU DE BORD INDÉPENDANCE FINANCIÈRE
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                            <button @click="wealthGoals.push({ name: 'Nouvel objectif', target: 10000, current: 0 }); handleDataChange()" class="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase tracking-widest shadow-sm transition-colors">
                                <span class="text-lg leading-none">＋</span> Ajouter un objectif
                            </button>`,
`                            <button @click="addWealthGoal()" class="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase tracking-widest shadow-sm transition-colors">
                                <span class="text-lg leading-none">＋</span> Ajouter un objectif
                            </button>

                            <!-- ═══ v33.11 : TABLEAU DE BORD INDÉPENDANCE FINANCIÈRE ═══ -->
                            <div class="mt-4 rounded-2xl overflow-hidden border-2 border-emerald-200">
                                <div class="px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
                                    <div>
                                        <p class="font-black uppercase tracking-widest text-xs">🏝️ Indépendance Financière</p>
                                        <p class="text-[10px] opacity-70">Revenus passifs nets vs dépenses hors crédits</p>
                                    </div>
                                    <div class="text-right">
                                        <p class="text-2xl font-black tabular-nums">{{ independanceFinanciere.tauxCouverture }}%</p>
                                        <p class="text-[9px] uppercase tracking-widest opacity-70">couverture</p>
                                    </div>
                                </div>
                                <div class="p-4 bg-white space-y-4">
                                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                                            <p class="text-[9px] font-black uppercase tracking-widest text-emerald-600">Revenus passifs nets</p>
                                            <p class="text-lg font-black text-emerald-800 tabular-nums">{{ formatMAD(independanceFinanciere.revenusPassifs) }}<span class="text-[10px] font-bold">/mois</span></p>
                                        </div>
                                        <div class="p-3 rounded-xl bg-rose-50 border border-rose-200">
                                            <p class="text-[9px] font-black uppercase tracking-widest text-rose-600">Dépenses hors crédits</p>
                                            <p class="text-lg font-black text-rose-800 tabular-nums">{{ formatMAD(independanceFinanciere.depensesHorsCredits) }}<span class="text-[10px] font-bold">/mois</span></p>
                                        </div>
                                        <div class="p-3 rounded-xl bg-slate-50 border border-slate-200">
                                            <p class="text-[9px] font-black uppercase tracking-widest text-slate-500">Mensualités de crédit</p>
                                            <p class="text-lg font-black text-slate-800 tabular-nums">{{ formatMAD(independanceFinanciere.mensualites) }}<span class="text-[10px] font-bold">/mois</span></p>
                                        </div>
                                    </div>

                                    <div>
                                        <p class="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Détail par actif — cash-flow net après impôt</p>
                                        <div v-if="independanceFinanciere.detailParActif.length" class="space-y-1">
                                            <div v-for="d in independanceFinanciere.detailParActif" :key="d.id" class="flex items-center justify-between px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-100">
                                                <span class="text-xs font-bold text-gray-700 truncate">{{ d.name }}</span>
                                                <span :class="['text-xs font-black tabular-nums shrink-0', d.mensuel >= 0 ? 'text-emerald-700' : 'text-red-600']">{{ formatMAD(d.mensuel) }}/mois <span class="text-gray-400 font-bold">· {{ formatMAD(d.annuel) }}/an</span></span>
                                            </div>
                                        </div>
                                        <p v-else class="text-xs text-gray-400 italic">Aucun actif productif.</p>
                                    </div>

                                    <div>
                                        <p class="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Scénarios</p>
                                        <div class="overflow-x-auto rounded-xl border border-gray-200">
                                            <table class="w-full text-xs min-w-[520px]">
                                                <thead class="bg-gray-50">
                                                    <tr>
                                                        <th class="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-gray-500">Scénario</th>
                                                        <th class="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-gray-500">Revenus</th>
                                                        <th class="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-gray-500">Dépenses</th>
                                                        <th class="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-gray-500">Couverture</th>
                                                        <th class="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-gray-500">Manque</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr v-for="sc in independanceFinanciere.scenarios" :key="sc.label" class="border-t border-gray-100">
                                                        <td class="px-3 py-2 font-bold text-gray-700">{{ sc.label }}</td>
                                                        <td class="px-3 py-2 text-right font-black tabular-nums text-emerald-700">{{ formatMAD(sc.revenus) }}</td>
                                                        <td class="px-3 py-2 text-right font-black tabular-nums text-rose-700">{{ formatMAD(sc.depenses) }}</td>
                                                        <td :class="['px-3 py-2 text-right font-black tabular-nums', sc.taux >= 100 ? 'text-emerald-700' : sc.taux >= 50 ? 'text-amber-600' : 'text-red-600']">{{ sc.taux }}%</td>
                                                        <td class="px-3 py-2 text-right font-bold tabular-nums text-gray-500">{{ sc.manque ? formatMAD(sc.manque) : '—' }}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>`);

/* ══════════════════════════════════════════════════════════════════════════
   2. ARBITRAGE MOURABAHA — panneau ajouté sous le simulateur existant
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                                <p class="text-[10px] opacity-70 mt-1">Écart net : Placement {{ arbitrageInvestRate }}% vs Crédit {{ arbitrageDebtRate }}`,
`                                <p class="text-[10px] opacity-70 mt-1">Écart net : Placement {{ arbitrageInvestRate }}% vs Crédit {{ arbitrageDebtRate }}`);

const PANNEAU_ARBITRAGE = `
                        <!-- ═══ v33.11 : ARBITRAGE AVANCÉ — Mourabaha, Ibra'a, DH constants ═══ -->
                        <div class="mt-5 rounded-2xl border-2 border-teal-200 overflow-hidden">
                            <div class="px-5 py-3 bg-gradient-to-r from-teal-600 to-cyan-700 text-white flex items-center justify-between flex-wrap gap-2">
                                <div>
                                    <p class="font-black uppercase tracking-widest text-xs">⚖️ Arbitrage avancé — Rembourser vs Placer</p>
                                    <p class="text-[10px] opacity-70">Crédit classique ou Mourabaha, avec Ibra'a, inflation et fiscalité</p>
                                </div>
                                <div class="inline-flex rounded-xl bg-white/15 p-1">
                                    <button @click="arbitrageMode = 'classique'" :class="['px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors', arbitrageMode === 'classique' ? 'bg-white text-teal-700' : 'text-white/70 hover:text-white']">Classique</button>
                                    <button @click="arbitrageMode = 'mourabaha'" :class="['px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors', arbitrageMode === 'mourabaha' ? 'bg-white text-teal-700' : 'text-white/70 hover:text-white']">Mourabaha</button>
                                </div>
                            </div>
                            <div class="p-4 bg-white space-y-4">
                                <!-- Paramètres spécifiques -->
                                <div v-if="arbitrageMode === 'mourabaha'" class="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-teal-50 rounded-xl border border-teal-200">
                                    <div>
                                        <label class="text-[10px] font-black uppercase tracking-widest text-teal-700 block mb-1.5">Crédit ciblé</label>
                                        <select v-model="arbitrageAssetId" class="w-full bg-white border-2 border-teal-200 rounded-lg px-3 py-2 text-xs font-bold text-teal-800 outline-none">
                                            <option value="">— Exemple type (300 000 / 240 mois) —</option>
                                            <option v-for="a in masterAssets.filter(x => x.montant_credit > 0)" :key="a.id" :value="a.id">{{ a.name }} — {{ formatMAD(a.montant_credit) }}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class="text-[10px] font-black uppercase tracking-widest text-teal-700 block mb-1.5">Mois déjà écoulés</label>
                                        <input type="number" v-model.number="arbitrageMoisEcoules" min="0" max="360" step="6" class="w-full bg-white border-2 border-teal-200 rounded-lg px-3 py-2 text-xs font-black text-teal-800 outline-none text-right"/>
                                    </div>
                                    <div>
                                        <label class="text-[10px] font-black uppercase tracking-widest text-teal-700 block mb-1.5 flex items-center justify-between">
                                            <span>Taux d'Ibra'a</span><span class="text-teal-900 font-black">{{ arbitrageIbraa }} %</span>
                                        </label>
                                        <input type="range" v-model.number="arbitrageIbraa" min="0" max="100" step="5" class="w-full accent-teal-600"/>
                                        <p class="text-[9px] text-teal-500 font-bold">Pratique courante au Maroc : 60–80 %</p>
                                    </div>
                                </div>

                                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <label class="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer p-2 rounded-lg border border-gray-200">
                                        <input type="checkbox" v-model="arbitrageDeductible" class="accent-orange-600"/>
                                        Intérêts / marge déductibles
                                    </label>
                                    <div v-if="arbitrageDeductible">
                                        <label class="text-[10px] font-black uppercase tracking-widest text-orange-600 block mb-1">Taux marginal (%)</label>
                                        <input type="number" v-model.number="arbitrageTauxMarginal" min="0" max="60" step="1" class="w-full bg-orange-50 border-2 border-orange-200 rounded-lg px-3 py-1.5 text-xs font-black text-orange-800 outline-none text-right"/>
                                    </div>
                                    <label class="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer p-2 rounded-lg border border-gray-200">
                                        <input type="checkbox" v-model="arbitrageInflationOn" class="accent-amber-600"/>
                                        Afficher aussi en DH constants
                                    </label>
                                </div>

                                <!-- Détail du solde anticipé (Mourabaha) -->
                                <div v-if="arbitrageMode === 'mourabaha' && arbitrageResult.detailIbraa" class="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    <div class="p-2 rounded-lg bg-gray-50 border border-gray-200"><p class="text-[9px] font-black uppercase text-gray-400">Capital restant</p><p class="text-sm font-black text-gray-800 tabular-nums">{{ formatMAD(arbitrageResult.detailIbraa.capitalRestant) }}</p></div>
                                    <div class="p-2 rounded-lg bg-gray-50 border border-gray-200"><p class="text-[9px] font-black uppercase text-gray-400">Marge non échue</p><p class="text-sm font-black text-rose-700 tabular-nums">{{ formatMAD(arbitrageResult.detailIbraa.margeNonEchue) }}</p></div>
                                    <div class="p-2 rounded-lg bg-gray-50 border border-gray-200"><p class="text-[9px] font-black uppercase text-gray-400">Ibra'a accordée</p><p class="text-sm font-black text-emerald-700 tabular-nums">−{{ formatMAD(arbitrageResult.detailIbraa.ibraa) }}</p></div>
                                    <div class="p-2 rounded-lg bg-teal-50 border border-teal-200"><p class="text-[9px] font-black uppercase text-teal-500">Solde anticipé</p><p class="text-sm font-black text-teal-800 tabular-nums">{{ formatMAD(arbitrageResult.detailIbraa.solde) }}</p></div>
                                </div>

                                <!-- Résultat -->
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div class="p-3 rounded-xl bg-rose-50 border-2 border-rose-200">
                                        <p class="text-[10px] font-black uppercase tracking-widest text-rose-600 mb-1">🏦 Rembourser</p>
                                        <p class="text-xl font-black text-rose-800 tabular-nums">+{{ formatMAD(arbitrageResult.gainRemboursementNet) }}</p>
                                        <div class="mt-1.5 space-y-0.5 text-[10px] font-bold text-rose-500">
                                            <p v-if="arbitrageMode === 'mourabaha'">Capital libéré : <span class="font-black">{{ formatMAD(arbitrageResult.capitalLibere) }}</span></p>
                                            <p v-if="arbitrageMode === 'mourabaha'">Marge évitée : {{ formatMAD(arbitrageResult.margeEvitee) }} − marge payée {{ formatMAD(arbitrageResult.margePayee) }}</p>
                                            <p v-else>Intérêts composés évités sur {{ arbitrageYears }} ans</p>
                                            <p v-if="arbitrageResult.impotPerdu > 0" class="text-orange-600">− économie d'impôt perdue : {{ formatMAD(arbitrageResult.impotPerdu) }}</p>
                                        </div>
                                    </div>
                                    <div class="p-3 rounded-xl bg-emerald-50 border-2 border-emerald-200">
                                        <p class="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">📈 Placer</p>
                                        <p class="text-xl font-black text-emerald-800 tabular-nums">+{{ formatMAD(arbitrageResult.gainPlacement) }}</p>
                                        <p class="mt-1.5 text-[10px] font-bold text-emerald-500">{{ formatMAD(arbitrageResult.cash) }} à {{ arbitrageInvestRate }} % sur {{ arbitrageYears }} ans</p>
                                    </div>
                                </div>

                                <div :class="['p-3 rounded-xl text-white', arbitrageResult.gagnant === 'placer' ? 'bg-gradient-to-r from-emerald-600 to-teal-700' : arbitrageResult.gagnant === 'rembourser' ? 'bg-gradient-to-r from-rose-600 to-red-700' : 'bg-gray-600']">
                                    <p class="text-[10px] font-black uppercase tracking-widest opacity-70">Verdict</p>
                                    <p class="text-base font-black">
                                        {{ arbitrageResult.gagnant === 'placer' ? '📈 Placer est plus rentable' : arbitrageResult.gagnant === 'rembourser' ? '🏦 Rembourser est plus rentable' : '⚖️ Équivalent' }}
                                        <span class="tabular-nums"> · écart {{ formatMAD(Math.abs(arbitrageResult.ecart)) }}</span>
                                    </p>
                                    <p v-if="arbitrageInflationOn" class="text-[11px] opacity-80 mt-1">
                                        En DH constants (déflateur {{ arbitrageResult.deflateur }}) :
                                        placer {{ formatMAD(arbitrageResult.constants.gainPlacement) }} vs rembourser {{ formatMAD(arbitrageResult.constants.gainRemboursementNet) }} — écart {{ formatMAD(Math.abs(arbitrageResult.constants.ecart)) }}
                                    </p>
                                </div>
                            </div>
                        </div>
`;

// Insertion : juste avant la fermeture du bloc du simulateur d'arbitrage desktop
sub(
`                                <p class="text-[10px] opacity-70 mt-1">Écart net : Placement {{ arbitrageInvestRate }}% vs Crédit {{ arbitrageDebtRate }}% sur {{ arbitrageYears }} ans</p>
                            </div>`,
`                                <p class="text-[10px] opacity-70 mt-1">Écart net : Placement {{ arbitrageInvestRate }}% vs Crédit {{ arbitrageDebtRate }}% sur {{ arbitrageYears }} ans</p>
                            </div>` + PANNEAU_ARBITRAGE);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v33.11 UI (objectifs + IF + arbitrage) appliquée');
