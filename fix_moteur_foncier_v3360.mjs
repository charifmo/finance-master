/**
 * v33.60 — Moteur foncier : requalification, TNB, TPI marocaine
 * ---------------------------------------------------------------------------
 *  1. Zonage actuel / cible + prix au m² espéré après requalification.
 *  2. Les trois scénarios ne sont plus saisis : ils découlent du prix cible,
 *     avec un écart ajustable (±15 % par défaut).
 *  3. TNB = surface × % taxable × tarif/m² × années de retard × quote-part.
 *     Elle ne frappe que la part urbaine équipée, d'où le % de surface taxable.
 *  4. TPI = max(20 % de la plus-value nette ; 3 % du prix de cession).
 *     La cotisation minimale de 3 % s'applique même à perte — c'est le sens
 *     du Math.max, et c'est ce qui fait que vendre à perte coûte quand même.
 *  5. Semsar calculé sur le prix de cession et déduit du net vendeur.
 *
 *  Les champs manuels arrieres_tnb / provision_tpi survivent en OVERRIDE :
 *  laissés à 0 le moteur calcule, renseignés ils prennent le pas.
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
   1. SCHÉMA
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                        prix_vente_pessimiste: 0, prix_vente_median: 0, prix_vente_optimiste: 0,`,
`                        prix_vente_pessimiste: 0, prix_vente_median: 0, prix_vente_optimiste: 0,
                        // v33.60 — requalification et fiscalité foncière
                        zonage_actuel: '', zonage_cible: '', prix_m2_cible: 0, ecart_scenario_pct: 15,
                        pct_surface_taxable: 0, tarif_tnb_m2: 0, annees_tnb: 0,`);

sub(
`                            commission_semsar_pct: Number(f.commission_semsar_pct) || 0,`,
`                            zonage_actuel: String(f.zonage_actuel || ''),
                            zonage_cible: String(f.zonage_cible || ''),
                            prix_m2_cible: Number(f.prix_m2_cible) || 0,
                            ecart_scenario_pct: Number(f.ecart_scenario_pct) || 0,
                            pct_surface_taxable: Number(f.pct_surface_taxable) || 0,
                            tarif_tnb_m2: Number(f.tarif_tnb_m2) || 0,
                            annees_tnb: Number(f.annees_tnb) || 0,
                            commission_semsar_pct: Number(f.commission_semsar_pct) || 0,`);

/* ══════════════════════════════════════════════════════════════════════════
   2. MOTEUR — TNB, TPI, scénarios dérivés
   ══════════════════════════════════════════════════════════════════════════ */
const DEBUT = `                    const terrainScenarios = (asset) => {`;
const FIN = `                    // ── v33.40 : MOIS ÉCOULÉS DEPUIS LE DÉBLOCAGE ──────────────────────`;
const i0 = s.indexOf(DEBUT);
const i1 = s.indexOf(FIN, i0);
if (i0 < 0 || i1 < 0) throw new Error('bloc terrainScenarios introuvable');

const MOTEUR = String.raw`                    const ZONAGES = ['Agricole', 'RB (Réserve Boisée)', 'Ra', 'SHL2 (Logistique/Showroom)', 'SA2 (Villas)', 'Immeuble', 'Autre'];

                    // ── TNB : taxe sur les terrains non bâtis ──────────────────────────
                    //   Ne frappe que la fraction urbaine équipée du terrain, d'où le
                    //   pourcentage de surface taxable (un terrain moitié RB moitié SHL2
                    //   n'est taxé que sur sa moitié SHL2).
                    const tnbCalculee = (asset) => {
                        const a = asset || {};
                        const qp = quotePartPct(a) / 100;
                        return Math.round(N(a.surface_totale) * (N(a.pct_surface_taxable) / 100)
                                        * N(a.tarif_tnb_m2) * N(a.annees_tnb) * qp);
                    };

                    // ── Prix d'acquisition revalorisé ──────────────────────────────────
                    //   Simplification assumée de l'abattement légal : on indexe le prix
                    //   d'origine au taux de revalorisation de l'actif sur la durée de
                    //   détention, ce qui joue le rôle du coefficient de réévaluation.
                    const anneesDetention = (asset) => {
                        const a = asset || {};
                        const an = Math.round(N(a.annee_acquisition));
                        if (!an) return 0;
                        const si = soldesInitiaux.value || {};
                        const courante = Number(si.anneeActuelle) || new Date().getFullYear();
                        return Math.max(0, courante - an);
                    };
                    const prixAcquisitionRevalorise = (asset) => {
                        const a = asset || {};
                        const base = N(a.prix_acquisition) || N(a.value);
                        return Math.round(base * Math.pow(1 + N(a.taux_revalorisation) / 100, anneesDetention(a)));
                    };

                    // ── TPI : règle marocaine du plus élevé des deux ───────────────────
                    //   20 % de la plus-value nette OU 3 % du prix de cession
                    //   (cotisation minimale, due même en cas de moins-value).
                    const tpiCalculee = (prixCession, prixRevalorise) => {
                        const plusValue = N(prixCession) - N(prixRevalorise);
                        const surPlusValue = plusValue * 0.20;
                        const cotisationMinimale = N(prixCession) * 0.03;
                        const retenu = Math.max(surPlusValue, cotisationMinimale);
                        return {
                            plusValue: Math.round(plusValue),
                            surPlusValue: Math.round(surPlusValue),
                            cotisationMinimale: Math.round(cotisationMinimale),
                            montant: Math.round(Math.max(0, retenu)),
                            regle: surPlusValue >= cotisationMinimale ? '20 % de la plus-value' : '3 % du prix (minimum)',
                        };
                    };

                    // ── Trois scénarios de vente, entièrement calculés ─────────────────
                    //   Médian = prix m² cible × surface × quote-part
                    //   Pessimiste / Optimiste = médian ∓ écart ajustable
                    const terrainScenarios = (asset) => {
                        const a = asset || {};
                        const qp = quotePartPct(a) / 100;
                        const surface = N(a.surface_totale);
                        // prix cible si renseigné, sinon on retombe sur la valorisation actuelle
                        const prixM2 = N(a.prix_m2_cible) || N(a.prix_m2);
                        const ecart = N(a.ecart_scenario_pct) / 100;
                        const semsarPct = N(a.commission_semsar_pct) / 100;
                        const revalorise = prixAcquisitionRevalorise(a);
                        // overrides manuels : 0 = le moteur calcule
                        const tnbAuto = tnbCalculee(a);
                        const tnb = N(a.arrieres_tnb) > 0 ? N(a.arrieres_tnb) : tnbAuto;
                        const tpiManuelle = N(a.provision_tpi);
                        const r0 = (v) => Math.round(v);

                        const build = (cle, label, coef) => {
                            const prixM2Scenario = prixM2 * coef;
                            const prixGlobal = prixM2Scenario * surface;
                            const maPart = prixGlobal * qp;
                            const semsar = maPart * semsarPct;
                            const tpiDetail = tpiCalculee(maPart, revalorise);
                            const tpi = tpiManuelle > 0 ? tpiManuelle : tpiDetail.montant;
                            const net = maPart - semsar - tnb - tpi;
                            return {
                                cle, label,
                                prixM2: r0(prixM2Scenario),
                                prixGlobal: r0(prixGlobal),
                                maPart: r0(maPart),
                                semsar: r0(semsar), tnb: r0(tnb), tpi: r0(tpi),
                                tpiDetail, tpiManuelle: tpiManuelle > 0,
                                revalorise,
                                net: r0(net),
                                ecart: r0(net - (N(a.valeur_actuelle) || N(a.prix_acquisition))),
                            };
                        };
                        return [
                            build('pessimiste', 'Pessimiste', 1 - ecart),
                            build('median', 'Médian', 1),
                            build('optimiste', 'Optimiste', 1 + ecart),
                        ];
                    };

`;
s = s.slice(0, i0) + MOTEUR + s.slice(i1);

sub(
`                        estTerrainNu, quotePartPct, terrainScenarios,`,
`                        estTerrainNu, quotePartPct, terrainScenarios, ZONAGES,
                        tnbCalculee, tpiCalculee, anneesDetention, prixAcquisitionRevalorise,`);

/* ══════════════════════════════════════════════════════════════════════════
   3. MODALE — computed dérivés
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                    const masterAssetScenarios = computed(() => terrainScenarios(masterAssetForm.value));`,
`                    const masterAssetScenarios = computed(() => terrainScenarios(masterAssetForm.value));
                    const masterAssetTNB = computed(() => tnbCalculee(masterAssetForm.value));
                    const masterAssetRevalorise = computed(() => prixAcquisitionRevalorise(masterAssetForm.value));
                    const masterAssetDetention = computed(() => anneesDetention(masterAssetForm.value));`);

sub(
`                        masterAssetScenarios, masterAssetOngletsDispos, syncPrixM2, syncValeurGlobale,`,
`                        masterAssetScenarios, masterAssetOngletsDispos, syncPrixM2, syncValeurGlobale,
                        masterAssetTNB, masterAssetRevalorise, masterAssetDetention,`);

// La commission Semsar suit désormais le prix cible
sub(
`                        () => [masterAssetForm.value.prix_vente_median, masterAssetForm.value.commission_semsar_pct,
                               masterAssetForm.value.surface_totale, masterAssetForm.value.scenarios_par_m2,
                               masterAssetForm.value.quotePart].join('|'),`,
`                        () => [masterAssetForm.value.prix_m2_cible, masterAssetForm.value.commission_semsar_pct,
                               masterAssetForm.value.surface_totale, masterAssetForm.value.ecart_scenario_pct,
                               masterAssetForm.value.quotePart].join('|'),`);

/* ══════════════════════════════════════════════════════════════════════════
   4. TEMPLATE — zonage dans Origine & Valorisation
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                                <div class="bg-violet-50 border-2 border-violet-200 rounded-lg px-3 py-2 flex flex-col justify-center">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-violet-500">Ma quote-part · {{ masterAssetForm.quotePart }}</p>
                                    <p class="text-lg font-black text-violet-800 tabular-nums">{{ formatMAD(masterAssetMaPart) }}</p>
                                    <p class="text-[9px] text-violet-400 font-bold">Reportée en valeur actuelle du patrimoine</p>
                                </div>
                            </div>
                        </div>`,
`                                <div class="bg-violet-50 border-2 border-violet-200 rounded-lg px-3 py-2 flex flex-col justify-center">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-violet-500">Ma quote-part · {{ masterAssetForm.quotePart }}</p>
                                    <p class="text-lg font-black text-violet-800 tabular-nums">{{ formatMAD(masterAssetMaPart) }}</p>
                                    <p class="text-[9px] text-violet-400 font-bold">Reportée en valeur actuelle du patrimoine</p>
                                </div>
                            </div>

                            <!-- v33.60 : requalification / zonage -->
                            <div class="pt-3 border-t border-dashed border-amber-200">
                                <p class="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-2">🗺️ Requalification</p>
                                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                        <label class="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1.5">Zonage actuel</label>
                                        <select v-model="masterAssetForm.zonage_actuel" class="w-full bg-white border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-amber-500">
                                            <option value="">—</option>
                                            <option v-for="z in ZONAGES" :key="'za'+z" :value="z">{{ z }}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class="text-[10px] font-black uppercase tracking-widest text-emerald-600 block mb-1.5">Zonage cible</label>
                                        <select v-model="masterAssetForm.zonage_cible" class="w-full bg-emerald-50 border-2 border-emerald-200 rounded-lg px-3 py-2 text-sm font-bold text-emerald-800 outline-none focus:border-emerald-500">
                                            <option value="">—</option>
                                            <option v-for="z in ZONAGES" :key="'zc'+z" :value="z">{{ z }}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class="text-[10px] font-black uppercase tracking-widest text-emerald-600 block mb-1.5">Prix m² cible (DH)</label>
                                        <input v-model.number="masterAssetForm.prix_m2_cible" type="number" min="0" step="100"
                                               class="w-full bg-emerald-50 border-2 border-emerald-300 rounded-lg px-3 py-2 text-sm font-black text-emerald-800 outline-none focus:border-emerald-500 text-right"/>
                                        <p v-if="masterAssetForm.prix_m2 && masterAssetForm.prix_m2_cible" class="text-[9px] font-bold mt-0.5"
                                           :class="masterAssetForm.prix_m2_cible >= masterAssetForm.prix_m2 ? 'text-emerald-600' : 'text-rose-600'">
                                            {{ masterAssetForm.prix_m2_cible >= masterAssetForm.prix_m2 ? '▲' : '▼' }}
                                            {{ Math.round((masterAssetForm.prix_m2_cible / masterAssetForm.prix_m2 - 1) * 100) }} % vs prix actuel
                                        </p>
                                    </div>
                                </div>
                                <p v-if="masterAssetForm.zonage_actuel && masterAssetForm.zonage_cible" class="text-[10px] font-bold text-amber-600 mt-2">
                                    {{ masterAssetForm.zonage_actuel }} → {{ masterAssetForm.zonage_cible }}
                                    <span v-if="masterAssetForm.annee_acquisition" class="text-gray-400"> · détenu depuis {{ masterAssetDetention }} ans</span>
                                </p>
                            </div>
                        </div>`);

/* ══════════════════════════════════════════════════════════════════════════
   5. TEMPLATE — onglet Scénarios entièrement calculé
   ══════════════════════════════════════════════════════════════════════════ */
const OLD_SC_START = `                        <!-- ── v33.50 : SCÉNARIOS DE VENTE (terrain nu) ── -->
                        <div v-show="masterAssetTab === 'scenarios' && masterAssetEstTerrain" class="space-y-3">`;
const OLD_SC_END = `                        <!-- ── v33.50 : FISCALITÉ & FRAIS DE SORTIE (terrain nu) ── -->`;
const j0 = s.indexOf(OLD_SC_START);
const j1 = s.indexOf(OLD_SC_END, j0);
if (j0 < 0 || j1 < 0) throw new Error('bloc scénarios introuvable');

const NEW_SC = `                        <!-- ── v33.60 : SCÉNARIOS DE VENTE — entièrement calculés ── -->
                        <div v-show="masterAssetTab === 'scenarios' && masterAssetEstTerrain" class="space-y-3">
                            <div class="flex flex-wrap items-end gap-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
                                <div>
                                    <p class="text-[9px] font-black uppercase tracking-widest text-gray-400">Base de calcul</p>
                                    <p class="text-xs font-bold text-gray-700">{{ formatMAD(masterAssetForm.prix_m2_cible || masterAssetForm.prix_m2) }}/m² × {{ masterAssetForm.surface_totale }} m² × {{ masterAssetQuotePct }} %</p>
                                </div>
                                <div class="flex-1 min-w-[180px]">
                                    <label class="text-[9px] font-black uppercase tracking-widest text-gray-400 flex justify-between">
                                        <span>Écart pessimiste / optimiste</span><span class="text-gray-700">± {{ masterAssetForm.ecart_scenario_pct }} %</span>
                                    </label>
                                    <input type="range" v-model.number="masterAssetForm.ecart_scenario_pct" min="0" max="50" step="5" class="w-full accent-amber-600"/>
                                </div>
                                <div class="text-right">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-gray-400">Prix d'acquisition revalorisé</p>
                                    <p class="text-xs font-black text-gray-700 tabular-nums">{{ formatMAD(masterAssetRevalorise) }}</p>
                                    <p class="text-[9px] text-gray-400 font-bold">{{ masterAssetForm.taux_revalorisation }} %/an sur {{ masterAssetDetention }} ans</p>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div v-for="sc in masterAssetScenarios" :key="sc.cle"
                                     :class="['rounded-xl border-2 overflow-hidden', sc.cle === 'median' ? 'border-blue-300' : sc.cle === 'optimiste' ? 'border-emerald-200' : 'border-rose-200']">
                                    <div :class="['px-3 py-1.5 text-white font-black uppercase tracking-widest text-[10px] flex justify-between', sc.cle === 'median' ? 'bg-blue-600' : sc.cle === 'optimiste' ? 'bg-emerald-600' : 'bg-rose-600']">
                                        <span>{{ sc.label }}</span><span>{{ formatMAD(sc.prixM2) }}/m²</span>
                                    </div>
                                    <div class="p-3 space-y-1.5 bg-white">
                                        <div class="flex justify-between text-[10px]"><span class="font-bold text-gray-400">Terrain entier</span><span class="font-bold tabular-nums text-gray-500">{{ formatMAD(sc.prixGlobal) }}</span></div>
                                        <div class="flex justify-between text-xs pb-1.5 border-b border-gray-100"><span class="font-black text-gray-700">Ma quote-part</span><span class="font-black tabular-nums text-gray-800">{{ formatMAD(sc.maPart) }}</span></div>
                                        <div class="flex justify-between text-[10px]"><span class="font-bold text-gray-500">− Semsar {{ masterAssetForm.commission_semsar_pct }} %</span><span class="font-black tabular-nums text-rose-600">{{ formatMAD(sc.semsar) }}</span></div>
                                        <div class="flex justify-between text-[10px]"><span class="font-bold text-gray-500">− TNB</span><span class="font-black tabular-nums text-rose-600">{{ formatMAD(sc.tnb) }}</span></div>
                                        <div class="flex justify-between text-[10px]">
                                            <span class="font-bold text-gray-500">− TPI <span v-if="sc.tpiManuelle" class="text-[8px] text-gray-400">(manuel)</span></span>
                                            <span class="font-black tabular-nums text-rose-600">{{ formatMAD(sc.tpi) }}</span>
                                        </div>
                                        <p v-if="!sc.tpiManuelle" class="text-[9px] font-bold text-gray-400 leading-tight">
                                            {{ sc.tpiDetail.regle }} · plus-value {{ formatMAD(sc.tpiDetail.plusValue) }}<br/>
                                            20 % → {{ formatMAD(sc.tpiDetail.surPlusValue) }} vs 3 % → {{ formatMAD(sc.tpiDetail.cotisationMinimale) }}
                                        </p>
                                        <div class="flex justify-between text-sm pt-1.5 border-t-2 border-gray-200"><span class="font-black uppercase tracking-widest text-gray-600">Net vendeur</span><span :class="['font-black tabular-nums', sc.net >= 0 ? 'text-emerald-700' : 'text-red-600']">{{ formatMAD(sc.net) }}</span></div>
                                        <div class="flex justify-between text-[9px]"><span class="font-bold text-gray-400">vs valeur inscrite</span><span :class="['font-black tabular-nums', sc.ecart >= 0 ? 'text-emerald-600' : 'text-rose-600']">{{ sc.ecart >= 0 ? '+' : '' }}{{ formatMAD(sc.ecart) }}</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>

`;
s = s.slice(0, j0) + NEW_SC + s.slice(j1);

/* ══════════════════════════════════════════════════════════════════════════
   6. TEMPLATE — onglet Fiscalité foncière : paramètres TNB + TPI
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                        <div v-show="masterAssetTab === 'fiscalite' && masterAssetEstTerrain" class="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                                <label class="text-[10px] font-black uppercase tracking-widest text-orange-600 block mb-1.5">Arriérés TNB (DH)</label>`,
`                        <div v-show="masterAssetTab === 'fiscalite' && masterAssetEstTerrain" class="space-y-4">
                            <!-- v33.60 : paramètres de la TNB -->
                            <div>
                                <p class="text-[10px] font-black uppercase tracking-widest text-orange-700 mb-2">🏛️ TNB — Taxe sur les Terrains Non Bâtis</p>
                                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div>
                                        <label class="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1.5">Surface taxable (%)</label>
                                        <input v-model.number="masterAssetForm.pct_surface_taxable" type="number" min="0" max="100" step="5"
                                               class="w-full bg-white border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-black text-gray-800 outline-none focus:border-orange-500 text-right"/>
                                        <p class="text-[9px] text-gray-400 font-bold mt-0.5">Agricole et RB exonérés</p>
                                    </div>
                                    <div>
                                        <label class="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1.5">Tarif (DH/m²/an)</label>
                                        <input v-model.number="masterAssetForm.tarif_tnb_m2" type="number" min="0" max="100" step="0.5"
                                               class="w-full bg-white border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-black text-gray-800 outline-none focus:border-orange-500 text-right"/>
                                        <p class="text-[9px] text-gray-400 font-bold mt-0.5">Barème usuel : 2 à 12 DH</p>
                                    </div>
                                    <div>
                                        <label class="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1.5">Années de retard</label>
                                        <input v-model.number="masterAssetForm.annees_tnb" type="number" min="0" max="30" step="1"
                                               class="w-full bg-white border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-black text-gray-800 outline-none focus:border-orange-500 text-right"/>
                                    </div>
                                    <div class="bg-orange-50 border-2 border-orange-200 rounded-lg px-3 py-2 flex flex-col justify-center">
                                        <p class="text-[9px] font-black uppercase tracking-widest text-orange-500">TNB calculée</p>
                                        <p class="text-base font-black text-orange-800 tabular-nums">{{ formatMAD(masterAssetTNB) }}</p>
                                        <p class="text-[9px] text-orange-400 font-bold">quote-part {{ masterAssetQuotePct }} % incluse</p>
                                    </div>
                                </div>
                            </div>

                            <!-- TPI : règle des 20 % vs 3 % -->
                            <div class="p-3 rounded-xl bg-slate-900 text-white">
                                <p class="text-[10px] font-black uppercase tracking-widest opacity-70 mb-2">🧾 TPI — règle du plus élevé</p>
                                <template v-for="sc in [masterAssetScenarios[1] || {}]" :key="'tpi'">
                                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                                        <div><p class="text-[9px] uppercase tracking-widest opacity-50">Prix revalorisé</p><p class="text-sm font-black tabular-nums">{{ formatMAD(masterAssetRevalorise) }}</p></div>
                                        <div><p class="text-[9px] uppercase tracking-widest opacity-50">Plus-value (médian)</p><p class="text-sm font-black tabular-nums">{{ formatMAD((sc.tpiDetail || {}).plusValue || 0) }}</p></div>
                                        <div><p class="text-[9px] uppercase tracking-widest opacity-50">20 % plus-value</p><p class="text-sm font-black tabular-nums">{{ formatMAD((sc.tpiDetail || {}).surPlusValue || 0) }}</p></div>
                                        <div><p class="text-[9px] uppercase tracking-widest opacity-50">3 % du prix</p><p class="text-sm font-black tabular-nums">{{ formatMAD((sc.tpiDetail || {}).cotisationMinimale || 0) }}</p></div>
                                    </div>
                                    <p class="text-[11px] font-bold mt-2 text-amber-300">→ retenu : {{ (sc.tpiDetail || {}).regle }} · {{ formatMAD((sc.tpiDetail || {}).montant || 0) }}</p>
                                </template>
                            </div>

                            <!-- Overrides manuels + Semsar -->
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                                <label class="text-[10px] font-black uppercase tracking-widest text-orange-600 block mb-1.5">Arriérés TNB (0 = auto)</label>`);

sub(
`                                <input v-model.number="masterAssetForm.arrieres_tnb" type="number" min="0" step="1000"
                                       class="w-full bg-orange-50 border-2 border-orange-200 rounded-lg px-3 py-2 text-sm font-black text-orange-800 outline-none focus:border-orange-500 text-right"/>
                                <p class="text-[9px] text-orange-400 font-bold mt-0.5">Taxe sur les terrains non bâtis</p>
                            </div>
                            <div>
                                <label class="text-[10px] font-black uppercase tracking-widest text-orange-600 block mb-1.5">Provision TPI (DH)</label>
                                <input v-model.number="masterAssetForm.provision_tpi" type="number" min="0" step="1000"
                                       class="w-full bg-orange-50 border-2 border-orange-200 rounded-lg px-3 py-2 text-sm font-black text-orange-800 outline-none focus:border-orange-500 text-right"/>
                                <p class="text-[9px] text-orange-400 font-bold mt-0.5">Impôt sur la plus-value</p>
                            </div>`,
`                                <input v-model.number="masterAssetForm.arrieres_tnb" type="number" min="0" step="1000"
                                       class="w-full bg-orange-50 border-2 border-orange-200 rounded-lg px-3 py-2 text-sm font-black text-orange-800 outline-none focus:border-orange-500 text-right"/>
                                <p class="text-[9px] text-orange-400 font-bold mt-0.5">Écrase le calcul automatique</p>
                            </div>
                            <div>
                                <label class="text-[10px] font-black uppercase tracking-widest text-orange-600 block mb-1.5">Provision TPI (0 = auto)</label>
                                <input v-model.number="masterAssetForm.provision_tpi" type="number" min="0" step="1000"
                                       class="w-full bg-orange-50 border-2 border-orange-200 rounded-lg px-3 py-2 text-sm font-black text-orange-800 outline-none focus:border-orange-500 text-right"/>
                                <p class="text-[9px] text-orange-400 font-bold mt-0.5">Écrase la règle 20 % / 3 %</p>
                            </div>`);

sub(
`                                <p class="text-[9px] text-gray-400 font-bold mt-0.5">Sur le scénario médian</p>
                            </div>
                        </div>`,
`                                <p class="text-[9px] text-gray-400 font-bold mt-0.5">Sur le scénario médian</p>
                            </div>
                            </div>
                        </div>`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v33.60 moteur foncier appliqué');
