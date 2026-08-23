/**
 * v33.90 — Table unique du patrimoine, arbitrage supprimé, Exit inline restauré
 * ---------------------------------------------------------------------------
 *  1. Le simulateur d'arbitrage disparaît (desktop + mobile), refs comprises.
 *  2. Les deux listes (ROI Tracker productifs / Stress Test foncier) fusionnent
 *     en une seule « Synthèse du Patrimoine », avec une puce de nature par ligne.
 *  3. L'Exit Simulator revient en accordéon SOUS la ligne cliquée, et non plus
 *     dans une modale. Il consomme le moteur fiscal foncier de la v33.70.
 */
import fs from 'node:fs';

const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => {
    const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) :\n${from.slice(0, 160)}`);
    s = s.split(from).join(to);
};
const coupe = (debut, fin, label) => {
    const i0 = s.indexOf(debut);
    if (i0 < 0) throw new Error('début introuvable : ' + label);
    const i1 = s.indexOf(fin, i0);
    if (i1 < 0) throw new Error('fin introuvable : ' + label);
    const bloc = s.slice(i0, i1);
    s = s.slice(0, i0) + s.slice(i1);
    return bloc;
};

/* ══════════════════════════════════════════════════════════════════════════
   1. SUPPRESSION DE L'ARBITRAGE (mobile puis desktop)
   ══════════════════════════════════════════════════════════════════════════ */
coupe(`                    <!-- Arbitrage mobile -->`,
      `                    <!-- Stress Test Foncier mobile -->`, 'arbitrage mobile');

coupe(`                    <!-- ── Section 3 : Simulateur Arbitrage ── -->`,
      `                    <!-- ── Section 4 : Stress Test Foncier & Indivision ── -->`, 'arbitrage desktop');

/* ══════════════════════════════════════════════════════════════════════════
   2. FUSION DES DEUX LISTES EN UNE TABLE UNIQUE
   ══════════════════════════════════════════════════════════════════════════ */
// On retire les deux sections d'origine…
coupe(`                    <!-- ── Section 2 : ROI Tracker ── -->`,
      `                    <!-- ── Section 4 : Stress Test Foncier & Indivision ── -->`, 'section ROI');

const finStress = `                    <div data-cfo-collapse="wealth-sandbox"`;
coupe(`                    <!-- ── Section 4 : Stress Test Foncier & Indivision ── -->`,
      finStress, 'section Stress');

// ── Panneau Exit réutilisé en accordéon (colspan sur la table unique) ──
const PANNEAU_EXIT = `                                            <div class="rounded-2xl border-2 border-fuchsia-200 overflow-hidden">
                                                <template v-for="sim in [exitSim(asset, exitYears[asset.id] || 1)]" :key="'ex'+asset.id">
                                                <div class="px-4 py-2.5 bg-gradient-to-r from-fuchsia-600 to-purple-700 text-white flex items-center justify-between flex-wrap gap-2">
                                                    <p class="font-black uppercase tracking-widest text-[11px]">🔮 Scénario de revente — {{ asset.name }} · année {{ sim.annee }}</p>
                                                    <p class="text-[10px] opacity-80">Revalo {{ asset.taux_revalorisation }} %/an · {{ sim.estTerrain ? 'frais réels : Semsar + TNB + TPI' : 'frais de sortie ' + asset.frais_revente_pct + ' %' }}</p>
                                                </div>
                                                <div class="p-4 bg-white space-y-4">
                                                    <div>
                                                        <div class="flex items-center justify-between mb-1.5">
                                                            <label class="text-[10px] font-black uppercase tracking-widest text-fuchsia-700">Année de revente</label>
                                                            <span class="text-sm font-black text-fuchsia-800 tabular-nums">Année {{ sim.annee }} / {{ exitMaxAnnees(asset) }}</span>
                                                        </div>
                                                        <input type="range" min="1" :max="exitMaxAnnees(asset)" step="1"
                                                               :value="exitYears[asset.id] || 1"
                                                               @input="setExitYear(asset.id, $event.target.value)"
                                                               class="w-full accent-fuchsia-600 cursor-pointer"/>
                                                        <div class="flex justify-between text-[9px] font-bold text-gray-400 mt-0.5"><span>1 an</span><span>{{ exitMaxAnnees(asset) }} ans</span></div>
                                                    </div>
                                                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                        <div class="p-3 rounded-xl bg-teal-50 border border-teal-200">
                                                            <p class="text-[9px] font-black uppercase tracking-widest text-teal-600">A · Valeur de revente</p>
                                                            <p class="text-lg font-black text-teal-800 tabular-nums">{{ formatMAD(sim.valeurRevente) }}</p>
                                                            <p v-if="!sim.estTerrain" class="text-[9px] font-bold text-teal-500">+{{ formatMAD(sim.plusValueLatente) }} de revalorisation · −{{ formatMAD(sim.fraisRevente) }} de frais</p>
                                                            <p v-else class="text-[9px] font-bold text-teal-500 leading-tight">
                                                                +{{ formatMAD(sim.plusValueLatente) }} de revalorisation ({{ asset.taux_revalorisation }} %/an)<br/>
                                                                − {{ formatMAD(sim.semsar) }} Semsar · − {{ formatMAD(sim.tnb) }} TNB<span v-if="!sim.tnbManuelle"> ({{ (asset.annees_tnb || 0) + sim.annee }} ans)</span> · − {{ formatMAD(sim.tpi) }} TPI<span v-if="sim.tpiDetail && !sim.tpiManuelle"> ({{ sim.tpiDetail.regle }})</span><br/>
                                                                <span class="text-teal-400">soit {{ formatMAD(sim.fraisRevente) }} de frais réels</span>
                                                            </p>
                                                        </div>
                                                        <div class="p-3 rounded-xl bg-rose-50 border border-rose-200">
                                                            <p class="text-[9px] font-black uppercase tracking-widest text-rose-600">B · {{ sim.estMourabaha ? 'Solde de rachat' : 'Capital restant dû' }}</p>
                                                            <p class="text-lg font-black text-rose-800 tabular-nums">{{ formatMAD(sim.crd) }}</p>
                                                            <p v-if="sim.detailIbraa" class="text-[9px] font-bold text-rose-500">capital {{ formatMAD(sim.detailIbraa.capitalRestant) }} + marge non échue {{ formatMAD(sim.detailIbraa.margeNonEchue) }} − Ibra'a {{ formatMAD(sim.detailIbraa.ibraa) }}</p>
                                                            <p v-else-if="!sim.crd" class="text-[9px] font-bold text-rose-400">Aucun crédit en cours</p>
                                                        </div>
                                                        <div class="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                                                            <p class="text-[9px] font-black uppercase tracking-widest text-indigo-600">C · Cash sorti (effort)</p>
                                                            <p class="text-lg font-black text-indigo-800 tabular-nums">{{ formatMAD(sim.cashSorti) }}</p>
                                                            <p class="text-[9px] font-bold text-indigo-500">Apport {{ formatMAD(asset.apport_personnel) }}<span v-if="sim.fraisInit"> + frais &amp; travaux {{ formatMAD(sim.fraisInit) }}</span><span v-if="sim.moisEcheances"> + {{ sim.moisEcheances }} échéances</span></p>
                                                            <p v-if="sim.moisDejaPayes" class="text-[9px] font-bold text-indigo-400">dont {{ sim.moisDejaPayes }} déjà versées ({{ formatMAD(sim.dejaVerse) }})</p>
                                                        </div>
                                                    </div>
                                                    <div :class="['p-4 rounded-2xl text-white', sim.gagnant ? 'bg-gradient-to-r from-emerald-600 to-teal-700' : 'bg-gradient-to-r from-rose-600 to-red-700']">
                                                        <p class="text-[10px] font-black uppercase tracking-widest opacity-75">D · Net dans la poche</p>
                                                        <p class="text-3xl font-black tabular-nums leading-tight">{{ formatMAD(sim.netPoche) }}</p>
                                                        <p class="text-[11px] font-bold opacity-90 mt-1">
                                                            {{ sim.gagnant ? '✅ Supérieur au cash sorti' : '⚠️ Inférieur au cash sorti' }}
                                                            de <span class="font-black">{{ formatMAD(Math.abs(sim.gain)) }}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                </template>
                                            </div>`;

const TABLE = `                    <!-- ══ v33.90 : SYNTHÈSE DU PATRIMOINE — table unique ══ -->
                    <div data-cfo-collapse="wealth-master" class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
                        <div class="px-6 py-4 bg-gradient-to-r from-slate-50 to-violet-50 border-b border-gray-100 flex items-center justify-between cfo-collapse-header">
                            <div>
                                <h3 class="font-black uppercase tracking-widest text-gray-800 text-sm">🏛️ Synthèse du Patrimoine</h3>
                                <p class="text-[10px] text-gray-500 mt-0.5 uppercase tracking-widest">Actifs productifs et de jouissance réunis</p>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="text-xs font-bold text-violet-600 bg-violet-100 px-3 py-1 rounded-full border border-violet-200">{{ masterAssets.length }} actif{{ masterAssets.length > 1 ? 's' : '' }}</span>
                                <span class="cfo-chevron text-gray-400 text-xs">▼</span>
                            </div>
                        </div>
                        <div class="p-6 cfo-collapsible-body">
                            <div class="overflow-x-auto rounded-xl border border-gray-200">
                                <table class="w-full text-sm min-w-[900px]">
                                    <thead class="bg-slate-800 text-white">
                                        <tr>
                                            <th class="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest">Actif</th>
                                            <th class="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest">Quote-part</th>
                                            <th class="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">Valeur actuelle</th>
                                            <th class="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">Crédit restant</th>
                                            <th class="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">Apport</th>
                                            <th class="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">Net</th>
                                            <th class="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">Cash-flow / mois</th>
                                            <th class="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">Rdt net</th>
                                            <th class="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <template v-for="asset in masterAssets" :key="asset.id">
                                        <tr :class="['border-b border-gray-100 transition-colors', asset.is_included_in_net_worth === false ? 'bg-gray-100/70 opacity-60' : 'hover:bg-gray-50']">
                                            <td class="px-4 py-3">
                                                <p class="text-sm font-black text-gray-800 flex items-center gap-2">
                                                    <button @click="asset.is_included_in_net_worth = asset.is_included_in_net_worth === false; handleDataChange()"
                                                            :title="asset.is_included_in_net_worth === false ? 'Exclu du patrimoine net — cliquer pour inclure' : 'Compté dans le patrimoine net — cliquer pour exclure'"
                                                            class="text-base leading-none shrink-0">{{ asset.is_included_in_net_worth === false ? '🙈' : '👁️' }}</button>
                                                    <span :class="asset.is_included_in_net_worth === false ? 'text-gray-400 line-through' : ''">{{ asset.name }}</span>
                                                </p>
                                                <p class="text-[10px] font-bold uppercase tracking-widest mt-0.5 flex items-center gap-2 flex-wrap">
                                                    <span :class="['px-1.5 py-0.5 rounded-full border', asset.isProductive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200']">
                                                        {{ asset.isProductive ? '🟢 Productif' : '🟠 Jouissance / Foncier' }}
                                                    </span>
                                                    <span class="text-gray-400">{{ asset.type }}</span>
                                                    <span v-if="asset.is_included_in_net_worth === false" class="bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded normal-case">hors patrimoine net</span>
                                                </p>
                                            </td>
                                            <td class="px-4 py-3 text-center whitespace-nowrap">
                                                <span :class="['text-xs font-black px-2 py-1 rounded-lg border', asset.quotePart === '100%' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200']">{{ asset.quotePart }}</span>
                                            </td>
                                            <td class="px-4 py-3 text-right text-blue-700 font-black bg-blue-50/40 whitespace-nowrap">{{ formatMAD(asset.valeur_actuelle || asset.value) }}</td>
                                            <td class="px-4 py-3 text-right text-rose-700 font-black bg-rose-50/40 whitespace-nowrap">{{ formatMAD(asset.montant_credit || 0) }}</td>
                                            <td class="px-4 py-3 text-right text-indigo-700 font-black bg-indigo-50/40 whitespace-nowrap">{{ formatMAD(asset.apport_personnel || 0) }}</td>
                                            <td class="px-4 py-3 text-right text-emerald-700 font-black bg-emerald-50/40 whitespace-nowrap">{{ formatMAD((Number(asset.valeur_actuelle || asset.value) || 0) - (Number(asset.montant_credit) || 0)) }}</td>
                                            <td class="px-4 py-3 text-right whitespace-nowrap">
                                                <span v-if="asset.isProductive" :class="['font-black', ((assetEcoById[asset.id] || {}).cashflowNetMensuel || 0) >= 0 ? 'text-emerald-700' : 'text-red-600']">{{ formatMAD(Math.round((assetEcoById[asset.id] || {}).cashflowNetMensuel || 0)) }}</span>
                                                <span v-else class="text-gray-300">—</span>
                                            </td>
                                            <td class="px-4 py-3 text-right whitespace-nowrap">
                                                <span v-if="asset.isProductive" class="font-black text-violet-700">{{ ((assetEcoById[asset.id] || {}).rendementNet || 0).toFixed(2) }} %</span>
                                                <span v-else class="text-gray-300">—</span>
                                            </td>
                                            <td class="px-4 py-3 text-center whitespace-nowrap">
                                                <div class="flex items-center justify-center gap-1.5">
                                                    <button @click="toggleExit(asset.id, asset)" :class="['p-1.5 rounded-lg transition-colors', exitOpen[asset.id] ? 'bg-fuchsia-100 text-fuchsia-700' : 'hover:bg-fuchsia-100 text-fuchsia-600']" title="Simuler une revente">🔮</button>
                                                    <button @click="editMasterAsset(asset.id)" class="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors" title="Éditer">✏️</button>
                                                    <button @click="deleteMasterAsset(asset.id)" class="p-1.5 rounded-lg hover:bg-red-100 text-red-600 transition-colors" title="Supprimer">🗑️</button>
                                                </div>
                                            </td>
                                        </tr>
                                        <!-- v33.90 : Exit Simulator en accordéon sous la ligne -->
                                        <tr v-if="exitOpen[asset.id]" class="bg-fuchsia-50/30">
                                            <td colspan="9" class="px-4 pb-4 pt-0">
${PANNEAU_EXIT}
                                            </td>
                                        </tr>
                                        </template>
                                    </tbody>
                                    <tfoot>
                                        <tr class="bg-gradient-to-r from-slate-800 to-violet-900 text-white">
                                            <td class="px-4 py-3 font-black text-sm uppercase tracking-widest" colspan="2">📊 Totaux retenus</td>
                                            <td class="px-4 py-3 text-right font-black text-base text-blue-300 whitespace-nowrap">{{ formatMAD(globalValeurTotale) }}</td>
                                            <td class="px-4 py-3 text-right font-black text-base text-rose-300 whitespace-nowrap">{{ formatMAD(globalDetteTotale) }}</td>
                                            <td class="px-4 py-3 text-right font-black text-base text-indigo-300 whitespace-nowrap">{{ formatMAD(assetsInclus.reduce((s, a) => s + (Number(a.apport_personnel) || 0), 0)) }}</td>
                                            <td class="px-4 py-3 text-right font-black text-base text-emerald-300 whitespace-nowrap">{{ formatMAD(globalPatrimoineNet) }}</td>
                                            <td class="px-4 py-3 text-right font-black text-base text-yellow-300 whitespace-nowrap">{{ formatMAD(Math.round(revenusPassifsNetsMensuel)) }}</td>
                                            <td class="px-4 py-3 text-right font-black text-base text-yellow-200 whitespace-nowrap">{{ globalValeurProductifs > 0 ? (assetsEconomics.filter(e => (masterAssets.find(a => a.id === e.id) || {}).isProductive && (masterAssets.find(a => a.id === e.id) || {}).is_included_in_net_worth !== false).reduce((s, e) => s + e.rex, 0) / globalValeurProductifs * 100).toFixed(2) : '0.00' }} %</td>
                                            <td class="px-4 py-3"></td>
                                        </tr>
                                        <tr v-if="assetsExclus.length" class="bg-gray-100">
                                            <td colspan="9" class="px-4 py-2 text-[11px] font-bold text-gray-500">
                                                🙈 {{ assetsExclus.length }} actif{{ assetsExclus.length > 1 ? 's' : '' }} hors patrimoine net
                                                — {{ formatMAD(valeurExclue) }} non comptabilisés :
                                                <span class="text-gray-600">{{ assetsExclus.map(a => a.name).join(' · ') }}</span>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            <div class="flex flex-col sm:flex-row gap-3 mt-4">
                                <button @click="openMasterAssetModal" class="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-black text-xs uppercase tracking-widest shadow-md shadow-violet-900/20 transition-colors">
                                    ＋ Nouvel Actif
                                </button>
                            </div>

                            <!-- Synthèse chiffrée -->
                            <div class="mt-4 bg-gradient-to-r from-violet-600 to-purple-700 rounded-2xl p-5 text-white shadow-lg shadow-purple-900/20">
                                <p class="text-[10px] font-black uppercase tracking-widest opacity-70 mb-4">🏛️ Patrimoine retenu</p>
                                <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                                    <div>
                                        <p class="text-[9px] uppercase tracking-widest opacity-60 mb-1">Valeur des actifs</p>
                                        <p class="text-base lg:text-lg font-black">{{ formatMAD(globalValeurTotale) }}</p>
                                    </div>
                                    <div>
                                        <p class="text-[9px] uppercase tracking-widest opacity-60 mb-1">Dette totale</p>
                                        <p class="text-base lg:text-lg font-black text-rose-300">{{ formatMAD(globalDetteTotale) }}</p>
                                    </div>
                                    <div>
                                        <p class="text-[9px] uppercase tracking-widest opacity-60 mb-1">Patrimoine net</p>
                                        <p class="text-base lg:text-lg font-black text-emerald-300">{{ formatMAD(globalPatrimoineNet) }}</p>
                                    </div>
                                    <div>
                                        <p class="text-[9px] uppercase tracking-widest opacity-60 mb-1">Revenus passifs nets</p>
                                        <p :class="['text-base lg:text-lg font-black', revenusPassifsNetsMensuel >= 0 ? 'text-yellow-300' : 'text-red-300']">{{ formatMAD(Math.round(revenusPassifsNetsMensuel)) }}<span class="text-[10px]">/mois</span></p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

`;

sub(finStress, TABLE + finStress);

/* ══════════════════════════════════════════════════════════════════════════
   3. L'icône 🔮 redevient un accordéon : on retire l'ouverture par modale
   ══════════════════════════════════════════════════════════════════════════ */
// L'onglet « Revente » de la modale n'a plus lieu d'être
sub(
`                        : [['acquisition','🏗️ Acquisition'],['financement','🏦 Financement'],['exploitation','🔑 Exploitation'],['fiscalite','🧾 Fiscalité'],['revente','🔮 Revente']]);`,
`                        : [['acquisition','🏗️ Acquisition'],['financement','🏦 Financement'],['exploitation','🔑 Exploitation'],['fiscalite','🧾 Fiscalité']]);`);

sub(
`                                : ['acquisition', 'financement', 'exploitation', 'fiscalite', 'revente']);`,
`                                : ['acquisition', 'financement', 'exploitation', 'fiscalite']);`);

coupe(`                        <!-- ── v33.80 : SIMULATEUR DE REVENTE (dans la modale) ── -->`,
      `                        <!-- ── v33.60 : SCÉNARIOS DE VENTE — entièrement calculés ── -->`, 'panneau modale');

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v33.90 appliquée');
