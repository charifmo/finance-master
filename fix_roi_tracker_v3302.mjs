/**
 * v33.02 — ROI Tracker branché sur le moteur d'exploitation
 *   Le rendement affiché n'est plus revenue/value (brut, périmé) mais le
 *   rendement NET (REX / valeur) issu de assetEconomics, avec le cash-flow
 *   net après impôt et le vrai ROE (cash-on-cash sur l'apport).
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

/* ── Ligne « Revenus » → CA / REX / cash-flow net ─────────────────────────── */
sub(
`                                            <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                                Revenus : <span class="text-emerald-700 font-black">{{ formatMAD(asset.revenue) }}/an</span>
                                                <span class="text-gray-400"> · {{ formatMAD(Math.round(asset.revenue / 12)) }}/mois</span>
                                            </p>`,
`                                            <!-- v33.02 : chaîne CA → REX → cash-flow net (moteur assetEconomics) -->
                                            <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                                CA : <span class="text-gray-800 font-black">{{ formatMAD((assetEcoById[asset.id] || {}).ca || 0) }}/an</span>
                                            </p>
                                            <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                                REX : <span class="text-emerald-700 font-black">{{ formatMAD((assetEcoById[asset.id] || {}).rex || 0) }}/an</span>
                                            </p>
                                            <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                                Cash-flow net :
                                                <span :class="[((assetEcoById[asset.id] || {}).cashflowNet || 0) >= 0 ? 'text-emerald-700' : 'text-red-600', 'font-black']">{{ formatMAD((assetEcoById[asset.id] || {}).cashflowNet || 0) }}/an</span>
                                                <span class="text-gray-400"> · {{ formatMAD(Math.round((assetEcoById[asset.id] || {}).cashflowNetMensuel || 0)) }}/mois</span>
                                            </p>`);

/* ── Détail exploitation + fiscalité sous la carte ────────────────────────── */
sub(
`                                        <p v-if="asset.montant_credit > 0" class="text-[10px] font-bold mt-1.5 flex flex-wrap items-center gap-2">
                                            <span class="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md text-indigo-700">💼 Apport : <span class="font-black">{{ formatMAD(asset.apport_personnel) }}</span></span>
                                            <span class="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md text-rose-700">🏛️ Banque : <span class="font-black">{{ formatMAD(asset.montant_credit) }}</span></span>
                                            <span class="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md text-emerald-700">📊 ROE : <span class="font-black">{{ asset.apport_personnel > 0 ? (asset.revenue / asset.apport_personnel * 100).toFixed(1) : '—' }}%</span></span>
                                        </p>`,
`                                        <p v-if="asset.montant_credit > 0" class="text-[10px] font-bold mt-1.5 flex flex-wrap items-center gap-2">
                                            <span class="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md text-indigo-700">💼 Apport : <span class="font-black">{{ formatMAD(asset.apport_personnel) }}</span></span>
                                            <span class="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md text-rose-700">🏛️ Banque : <span class="font-black">{{ formatMAD(asset.montant_credit) }}</span></span>
                                            <span class="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md text-slate-700">Service dette : <span class="font-black">{{ formatMAD((assetEcoById[asset.id] || {}).serviceDette || 0) }}/an</span></span>
                                            <span class="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md text-emerald-700">📊 ROE : <span class="font-black">{{ asset.apport_personnel > 0 ? ((assetEcoById[asset.id] || {}).roe || 0).toFixed(1) : '—' }}%</span></span>
                                        </p>
                                        <!-- v33.02 : exploitation & fiscalité -->
                                        <p class="text-[10px] font-bold mt-1.5 flex flex-wrap items-center gap-2">
                                            <span class="inline-flex items-center gap-1 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md text-sky-700">
                                                {{ asset.mode_exploitation === 'courte_duree' ? '🏨 Courte durée' : asset.mode_exploitation === 'longue_duree' ? '🔑 Longue durée' : asset.mode_exploitation === 'commercial' ? '🏪 Commercial' : '⏸️ Non exploité' }}
                                            </span>
                                            <span v-if="asset.mode_exploitation === 'courte_duree'" class="inline-flex items-center gap-1 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md text-sky-700">
                                                {{ formatMAD(asset.adr) }}/nuit · {{ asset.taux_occupation }}% occ. · {{ (assetEcoById[asset.id] || {}).nuitsAn || 0 }} nuits/an
                                            </span>
                                            <span v-if="((assetEcoById[asset.id] || {}).impot || 0) > 0" class="inline-flex items-center gap-1 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-md text-orange-700">
                                                🧾 Impôt : <span class="font-black">{{ formatMAD((assetEcoById[asset.id] || {}).impot) }}</span>
                                                <span class="text-orange-400">({{ asset.regime_fiscal }})</span>
                                            </span>
                                            <span v-if="((assetEcoById[asset.id] || {}).seuilCA || 0) > 0" class="inline-flex items-center gap-1 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-md text-gray-600">
                                                ⚖️ Seuil : <span class="font-black">{{ formatMAD((assetEcoById[asset.id] || {}).seuilCA) }}/an</span>
                                            </span>
                                        </p>`);

/* ── Badge de rendement : NET au lieu de brut ─────────────────────────────── */
sub(
`                                        <span :class="['text-sm font-black px-3 py-1.5 rounded-xl border',
                                            (asset.revenue / asset.value * 100) >= 7 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                            (asset.revenue / asset.value * 100) >= 4 ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                            'bg-amber-100 text-amber-700 border-amber-200']">
                                            {{ (asset.revenue / asset.value * 100).toFixed(2) }}% / an
                                        </span>`,
`                                        <div class="text-right">
                                            <span :class="['block text-sm font-black px-3 py-1.5 rounded-xl border',
                                                ((assetEcoById[asset.id] || {}).rendementNet || 0) >= 7 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                ((assetEcoById[asset.id] || {}).rendementNet || 0) >= 4 ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                                'bg-amber-100 text-amber-700 border-amber-200']"
                                                  :title="'Rendement NET = REX / valeur actuelle'">
                                                {{ ((assetEcoById[asset.id] || {}).rendementNet || 0).toFixed(2) }}% net
                                            </span>
                                            <span class="block text-[9px] font-bold uppercase tracking-widest text-gray-400 mt-1">brut {{ ((assetEcoById[asset.id] || {}).rendementBrut || 0).toFixed(2) }}%</span>
                                        </div>`);

/* ── Synthèse globale : REX + cash-flow net ───────────────────────────────── */
sub(
`                                <div class="grid grid-cols-3 gap-4 text-center mb-4">
                                    <div>
                                        <p class="text-[9px] uppercase tracking-widest opacity-60 mb-1">Capital Total</p>
                                        <p class="text-base lg:text-lg font-black">{{ formatMAD(roiAssets.reduce((s, a) => s + a.value, 0)) }}</p>
                                    </div>
                                    <div>
                                        <p class="text-[9px] uppercase tracking-widest opacity-60 mb-1">Revenus Annuels</p>
                                        <p class="text-base lg:text-lg font-black text-emerald-300">{{ formatMAD(roiAssets.reduce((s, a) => s + a.revenue, 0)) }}</p>
                                    </div>
                                    <div>
                                        <p class="text-[9px] uppercase tracking-widest opacity-60 mb-1">Rendement Moyen Pondéré</p>
                                        <p class="text-base lg:text-lg font-black text-yellow-300">
                                            {{ roiAssets.reduce((s, a) => s + a.value, 0) > 0
                                                ? (roiAssets.reduce((s, a) => s + a.revenue, 0) / roiAssets.reduce((s, a) => s + a.value, 0) * 100).toFixed(2)
                                                : '0.00' }}%
                                        </p>
                                    </div>
                                </div>
                                <div class="pt-3 border-t border-white/20 text-center">
                                    <p class="text-[11px] opacity-70">Revenus passifs mensuels :
                                        <span class="font-black text-yellow-200 text-sm"> {{ formatMAD(Math.round(roiAssets.reduce((s, a) => s + a.revenue, 0) / 12)) }}/mois</span>
                                    </p>
                                </div>`,
`                                <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center mb-4">
                                    <div>
                                        <p class="text-[9px] uppercase tracking-widest opacity-60 mb-1">Valeur Actuelle</p>
                                        <p class="text-base lg:text-lg font-black">{{ formatMAD(globalValeurProductifs) }}</p>
                                    </div>
                                    <div>
                                        <p class="text-[9px] uppercase tracking-widest opacity-60 mb-1">CA Annuel</p>
                                        <p class="text-base lg:text-lg font-black">{{ formatMAD(assetsEconomics.reduce((s, e) => s + e.ca, 0)) }}</p>
                                    </div>
                                    <div>
                                        <p class="text-[9px] uppercase tracking-widest opacity-60 mb-1">REX Annuel</p>
                                        <p class="text-base lg:text-lg font-black text-emerald-300">{{ formatMAD(assetsEconomics.reduce((s, e) => s + e.rex, 0)) }}</p>
                                    </div>
                                    <div>
                                        <p class="text-[9px] uppercase tracking-widest opacity-60 mb-1">Rendement Net Pondéré</p>
                                        <p class="text-base lg:text-lg font-black text-yellow-300">
                                            {{ globalValeurProductifs > 0
                                                ? (assetsEconomics.reduce((s, e) => s + e.rex, 0) / globalValeurProductifs * 100).toFixed(2)
                                                : '0.00' }}%
                                        </p>
                                    </div>
                                </div>
                                <div class="pt-3 border-t border-white/20 text-center">
                                    <p class="text-[11px] opacity-70">Revenus passifs NETS (après crédit et impôt) :
                                        <span :class="['font-black text-sm', revenusPassifsNetsMensuel >= 0 ? 'text-yellow-200' : 'text-red-300']"> {{ formatMAD(Math.round(revenusPassifsNetsMensuel)) }}/mois</span>
                                        <span class="opacity-60"> · {{ formatMAD(Math.round(revenusPassifsNetsAnnuel)) }}/an</span>
                                    </p>
                                </div>`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v33.02 ROI Tracker appliqué');
