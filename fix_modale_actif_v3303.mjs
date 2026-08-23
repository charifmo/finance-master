/**
 * v33.03 — Modale Actif : schéma v19 complet (acquisition / financement /
 *          exploitation / fiscalité) en 4 onglets, + persistance des champs.
 *
 * CRITIQUE : saveMasterAsset() ne recopiait que les champs legacy — tout champ
 * v19 saisi était silencieusement perdu à l'enregistrement. Corrigé ici.
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
   1. STORE — formulaire v19, onglet actif, persistance complète
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                    const _emptyMasterAssetForm = () => ({ name: '', type: 'Commercial', isProductive: true, value: 0, revenue: 0, taux_credit: 0, annees_total: 0, annees_restantes: 0, val_pessimiste: 0, val_optimiste: 0, quotePart: '100%', apport_personnel: 0, montant_credit: 0, valeur_actuelle: 0 });`,
`                    // v33.03 : le formulaire porte le schéma v19 complet
                    const masterAssetTab = ref('acquisition');
                    const _emptyMasterAssetForm = () => migrateAssetV19({ name: '', type: 'Commercial', isProductive: true, value: 0, revenue: 0, taux_credit: 0, annees_total: 0, annees_restantes: 0, val_pessimiste: 0, val_optimiste: 0, quotePart: '100%', apport_personnel: 0, montant_credit: 0, valeur_actuelle: 0 });`);

sub(
`                    const openMasterAssetModal = () => {
                        editingMasterAssetId.value = null;
                        masterAssetForm.value = _emptyMasterAssetForm();
                        showMasterAssetModal.value = true;
                    };`,
`                    const openMasterAssetModal = () => {
                        editingMasterAssetId.value = null;
                        masterAssetTab.value = 'acquisition';
                        masterAssetForm.value = _emptyMasterAssetForm();
                        showMasterAssetModal.value = true;
                    };`);

sub(
`                        editingMasterAssetId.value = id;`,
`                        editingMasterAssetId.value = id;
                        masterAssetTab.value = 'acquisition';`);

sub(
`                        masterAssetForm.value = {
                            ...asset,
                            apport_personnel: isLegacy ? (Number(asset.value) || 0) : apport,
                            montant_credit:   isLegacy ? 0 : credit,
                            valeur_actuelle:  Number(asset.valeur_actuelle) || Number(asset.value) || 0,
                        };`,
`                        masterAssetForm.value = migrateAssetV19({
                            ...asset,
                            apport_personnel: isLegacy ? (Number(asset.value) || 0) : apport,
                            montant_credit:   isLegacy ? 0 : credit,
                            valeur_actuelle:  Number(asset.valeur_actuelle) || Number(asset.value) || 0,
                        });`);

// Persistance : conserver TOUS les champs v19
sub(
`                        const cleaned = {
                            id: editingMasterAssetId.value || ('ma_' + Date.now()),
                            name: String(f.name).trim(),`,
`                        // v33.03 : on part du formulaire complet (schéma v19) puis on
                        // normalise — plus aucun champ n'est perdu à l'enregistrement.
                        const cleaned = {
                            ...migrateAssetV19(f),
                            id: editingMasterAssetId.value || ('ma_' + Date.now()),
                            name: String(f.name).trim(),`);

sub(
`                            valeur_actuelle: Number(f.valeur_actuelle) || 0,
                        };
                        if (editingMasterAssetId.value !== null) {`,
`                            valeur_actuelle: Number(f.valeur_actuelle) || 0,
                            // ── ACQUISITION ──
                            prix_acquisition: Number(f.prix_acquisition) || 0,
                            frais_acquisition: Number(f.frais_acquisition) || 0,
                            travaux: Number(f.travaux) || 0,
                            taux_revalorisation: Number(f.taux_revalorisation) || 0,
                            // ── FINANCEMENT ──
                            type_credit: String(f.type_credit || 'classique'),
                            duree_mois: Number(f.duree_mois) || 0,
                            mensualite: Number(f.mensualite) || 0,
                            assurance_mensuelle: Number(f.assurance_mensuelle) || 0,
                            marge_totale: Number(f.marge_totale) || 0,
                            mode_marge: String(f.mode_marge || 'lineaire'),
                            taux_ibraa: Number(f.taux_ibraa) || 0,
                            mois_deja_payes: Number(f.mois_deja_payes) || 0,
                            // ── EXPLOITATION ──
                            mode_exploitation: String(f.mode_exploitation || 'aucun'),
                            loyer_mensuel: Number(f.loyer_mensuel) || 0,
                            adr: Number(f.adr) || 0,
                            taux_occupation: Number(f.taux_occupation) || 0,
                            frais_plateforme_pct: Number(f.frais_plateforme_pct) || 0,
                            frais_cohost_pct: Number(f.frais_cohost_pct) || 0,
                            maintenance_pct: Number(f.maintenance_pct) || 0,
                            syndic: Number(f.syndic) || 0,
                            internet: Number(f.internet) || 0,
                            electricite_eau: Number(f.electricite_eau) || 0,
                            consommables: Number(f.consommables) || 0,
                            assurance_pno: Number(f.assurance_pno) || 0,
                            // ── FISCALITÉ ──
                            regime_fiscal: String(f.regime_fiscal || 'exonere'),
                            taux_marginal: Number(f.taux_marginal) || 0,
                            abattement_pct: Number(f.abattement_pct) || 0,
                            taux_liberatoire: Number(f.taux_liberatoire) || 0,
                            amortissement_bati_pct: Number(f.amortissement_bati_pct) || 0,
                            amortissement_mobilier_pct: Number(f.amortissement_mobilier_pct) || 0,
                            part_bati_pct: Number(f.part_bati_pct) || 0,
                            _v: 19,
                        };
                        if (editingMasterAssetId.value !== null) {`);

// Aperçu live dans la modale
sub(
`                    // ─────────────────────────────────────────────────────
                    // ── v20.00 : SANDBOX / PROJECTIONS ────────────────────`,
`                    // v33.03 : aperçu live de l'économie de l'actif en cours d'édition
                    const masterAssetPreview = computed(() => assetEconomics(masterAssetForm.value, 0));
                    const masterAssetMensualiteAuto = computed(() =>
                        Math.round(mensualiteClassique(masterAssetForm.value.montant_credit, masterAssetForm.value.taux_credit, masterAssetForm.value.duree_mois) * 100) / 100);

                    // ─────────────────────────────────────────────────────
                    // ── v20.00 : SANDBOX / PROJECTIONS ────────────────────`);

sub(
`                        showMasterAssetModal, editingMasterAssetId, masterAssetForm,`,
`                        showMasterAssetModal, editingMasterAssetId, masterAssetForm,
                        masterAssetTab, masterAssetPreview, masterAssetMensualiteAuto,`);

/* ══════════════════════════════════════════════════════════════════════════
   2. MODALE — 4 onglets
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`            <div class="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden">
                <div :class="['px-5 py-4 border-b border-gray-100 flex items-center justify-between', masterAssetForm.isProductive ? 'bg-gradient-to-r from-violet-50 to-purple-50' : 'bg-gradient-to-r from-amber-50 to-orange-50']">`,
`            <div class="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-3xl overflow-hidden">
                <div :class="['px-5 py-4 border-b border-gray-100 flex items-center justify-between', masterAssetForm.isProductive ? 'bg-gradient-to-r from-violet-50 to-purple-50' : 'bg-gradient-to-r from-amber-50 to-orange-50']">`);

// Onglets + sections v19, insérés à la place du bloc crédit legacy
sub(
`                    <!-- Crédit (productifs seulement) -->
                    <div v-if="masterAssetForm.isProductive" class="grid grid-cols-3 gap-3">
                        <div>
                            <label class="text-[10px] font-black uppercase tracking-widest text-amber-600 block mb-1.5">Taux crédit (%)</label>
                            <input v-model.number="masterAssetForm.taux_credit" type="number" min="0" max="30" step="0.1"
                                   class="w-full bg-amber-50 border-2 border-amber-200 rounded-lg px-3 py-2 text-sm font-black text-amber-800 outline-none focus:border-amber-500 text-right"/>
                        </div>
                        <div>
                            <label class="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1.5">Durée (ans)</label>
                            <input v-model.number="masterAssetForm.annees_total" type="number" min="0" max="30" step="1"
                                   class="w-full bg-slate-50 border-2 border-slate-200 rounded-lg px-3 py-2 text-sm font-black text-slate-800 outline-none focus:border-slate-500 text-right"/>
                        </div>
                        <div>
                            <label class="text-[10px] font-black uppercase tracking-widest text-violet-600 block mb-1.5">Restantes</label>
                            <input v-model.number="masterAssetForm.annees_restantes" type="number" min="0" max="30" step="1"
                                   class="w-full bg-violet-50 border-2 border-violet-200 rounded-lg px-3 py-2 text-sm font-black text-violet-800 outline-none focus:border-violet-500 text-right"/>
                        </div>
                    </div>
                </div>`,
`                    <!-- Crédit (productifs seulement) -->
                    <div v-if="masterAssetForm.isProductive" class="grid grid-cols-3 gap-3">
                        <div>
                            <label class="text-[10px] font-black uppercase tracking-widest text-amber-600 block mb-1.5">Taux crédit (%)</label>
                            <input v-model.number="masterAssetForm.taux_credit" type="number" min="0" max="30" step="0.1"
                                   class="w-full bg-amber-50 border-2 border-amber-200 rounded-lg px-3 py-2 text-sm font-black text-amber-800 outline-none focus:border-amber-500 text-right"/>
                        </div>
                        <div>
                            <label class="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1.5">Durée (ans)</label>
                            <input v-model.number="masterAssetForm.annees_total" type="number" min="0" max="30" step="1"
                                   class="w-full bg-slate-50 border-2 border-slate-200 rounded-lg px-3 py-2 text-sm font-black text-slate-800 outline-none focus:border-slate-500 text-right"/>
                        </div>
                        <div>
                            <label class="text-[10px] font-black uppercase tracking-widest text-violet-600 block mb-1.5">Restantes</label>
                            <input v-model.number="masterAssetForm.annees_restantes" type="number" min="0" max="30" step="1"
                                   class="w-full bg-violet-50 border-2 border-violet-200 rounded-lg px-3 py-2 text-sm font-black text-violet-800 outline-none focus:border-violet-500 text-right"/>
                        </div>
                    </div>

                    <!-- ═══ v33.03 : SCHÉMA v19 — onglets détaillés ═══ -->
                    <div class="pt-3 border-t-2 border-dashed border-gray-200">
                        <div class="flex flex-wrap gap-1 mb-4 bg-gray-100 p-1 rounded-xl">
                            <button v-for="t in [['acquisition','🏗️ Acquisition'],['financement','🏦 Financement'],['exploitation','🔑 Exploitation'],['fiscalite','🧾 Fiscalité']]" :key="t[0]"
                                    @click="masterAssetTab = t[0]"
                                    :class="['flex-1 min-w-[110px] px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors', masterAssetTab === t[0] ? 'bg-white text-violet-700 shadow' : 'text-gray-500 hover:text-gray-800']">
                                {{ t[1] }}
                            </button>
                        </div>

                        <!-- ── ACQUISITION ── -->
                        <div v-show="masterAssetTab === 'acquisition'" class="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div>
                                <label class="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1.5">Prix d'acquisition</label>
                                <input v-model.number="masterAssetForm.prix_acquisition" type="number" min="0" step="10000" class="w-full bg-white border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-black text-gray-800 outline-none focus:border-violet-500 text-right"/>
                            </div>
                            <div>
                                <label class="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1.5">Frais (notaire, ench.)</label>
                                <input v-model.number="masterAssetForm.frais_acquisition" type="number" min="0" step="1000" class="w-full bg-white border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-black text-gray-800 outline-none focus:border-violet-500 text-right"/>
                            </div>
                            <div>
                                <label class="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1.5">Travaux + ameublement</label>
                                <input v-model.number="masterAssetForm.travaux" type="number" min="0" step="1000" class="w-full bg-white border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-black text-gray-800 outline-none focus:border-violet-500 text-right"/>
                            </div>
                            <div>
                                <label class="text-[10px] font-black uppercase tracking-widest text-emerald-600 block mb-1.5">Revalorisation (%/an)</label>
                                <input v-model.number="masterAssetForm.taux_revalorisation" type="number" min="-20" max="30" step="0.5" class="w-full bg-emerald-50 border-2 border-emerald-200 rounded-lg px-3 py-2 text-sm font-black text-emerald-800 outline-none focus:border-emerald-500 text-right"/>
                            </div>
                            <div class="col-span-2 flex items-end">
                                <div class="w-full bg-violet-50 border-2 border-violet-200 rounded-lg px-3 py-2">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-violet-500">Coût total de revient</p>
                                    <p class="text-base font-black text-violet-800 tabular-nums">{{ formatMAD(masterAssetPreview.coutTotalRevient) }}</p>
                                </div>
                            </div>
                        </div>

                        <!-- ── FINANCEMENT ── -->
                        <div v-show="masterAssetTab === 'financement'" class="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div>
                                <label class="text-[10px] font-black uppercase tracking-widest text-rose-600 block mb-1.5">Type de crédit</label>
                                <select v-model="masterAssetForm.type_credit" class="w-full bg-rose-50 border-2 border-rose-200 rounded-lg px-3 py-2 text-sm font-black text-rose-800 outline-none focus:border-rose-500">
                                    <option value="classique">Classique (amortissable)</option>
                                    <option value="mourabaha">Mourabaha (participatif)</option>
                                </select>
                            </div>
                            <div>
                                <label class="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1.5">Durée (mois)</label>
                                <input v-model.number="masterAssetForm.duree_mois" type="number" min="0" max="360" step="12" class="w-full bg-slate-50 border-2 border-slate-200 rounded-lg px-3 py-2 text-sm font-black text-slate-800 outline-none focus:border-slate-500 text-right"/>
                            </div>
                            <div>
                                <label class="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1.5">Mois déjà payés</label>
                                <input v-model.number="masterAssetForm.mois_deja_payes" type="number" min="0" max="360" step="1" class="w-full bg-slate-50 border-2 border-slate-200 rounded-lg px-3 py-2 text-sm font-black text-slate-800 outline-none focus:border-slate-500 text-right"/>
                            </div>
                            <div>
                                <label class="text-[10px] font-black uppercase tracking-widest text-amber-600 block mb-1.5">Mensualité (0 = auto)</label>
                                <input v-model.number="masterAssetForm.mensualite" type="number" min="0" step="50" :placeholder="masterAssetMensualiteAuto" class="w-full bg-amber-50 border-2 border-amber-200 rounded-lg px-3 py-2 text-sm font-black text-amber-800 outline-none focus:border-amber-500 text-right"/>
                                <p class="text-[9px] text-amber-500 font-bold mt-0.5">auto : {{ formatMAD(masterAssetMensualiteAuto) }}</p>
                            </div>
                            <div>
                                <label class="text-[10px] font-black uppercase tracking-widest text-amber-600 block mb-1.5">Assurance / mois</label>
                                <input v-model.number="masterAssetForm.assurance_mensuelle" type="number" min="0" step="10" class="w-full bg-amber-50 border-2 border-amber-200 rounded-lg px-3 py-2 text-sm font-black text-amber-800 outline-none focus:border-amber-500 text-right"/>
                            </div>
                            <template v-if="masterAssetForm.type_credit === 'mourabaha'">
                                <div>
                                    <label class="text-[10px] font-black uppercase tracking-widest text-teal-600 block mb-1.5">Marge totale (0 = auto)</label>
                                    <input v-model.number="masterAssetForm.marge_totale" type="number" min="0" step="1000" class="w-full bg-teal-50 border-2 border-teal-200 rounded-lg px-3 py-2 text-sm font-black text-teal-800 outline-none focus:border-teal-500 text-right"/>
                                </div>
                                <div>
                                    <label class="text-[10px] font-black uppercase tracking-widest text-teal-600 block mb-1.5">Répartition marge</label>
                                    <select v-model="masterAssetForm.mode_marge" class="w-full bg-teal-50 border-2 border-teal-200 rounded-lg px-3 py-2 text-sm font-black text-teal-800 outline-none focus:border-teal-500">
                                        <option value="lineaire">Linéaire</option>
                                        <option value="actuarielle">Actuarielle</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="text-[10px] font-black uppercase tracking-widest text-teal-600 block mb-1.5">Taux d'Ibra'a (%)</label>
                                    <input v-model.number="masterAssetForm.taux_ibraa" type="number" min="0" max="100" step="5" class="w-full bg-teal-50 border-2 border-teal-200 rounded-lg px-3 py-2 text-sm font-black text-teal-800 outline-none focus:border-teal-500 text-right"/>
                                </div>
                            </template>
                            <div class="col-span-2 md:col-span-3 grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                                <div class="bg-gray-50 rounded-lg px-2 py-1.5"><p class="text-[9px] font-black uppercase text-gray-400">Service dette / an</p><p class="text-sm font-black text-gray-800 tabular-nums">{{ formatMAD(masterAssetPreview.serviceDette) }}</p></div>
                                <div class="bg-gray-50 rounded-lg px-2 py-1.5"><p class="text-[9px] font-black uppercase text-gray-400">Capital an 1</p><p class="text-sm font-black text-emerald-700 tabular-nums">{{ formatMAD(masterAssetPreview.capitalRembourse) }}</p></div>
                                <div class="bg-gray-50 rounded-lg px-2 py-1.5"><p class="text-[9px] font-black uppercase text-gray-400">Intérêts/marge an 1</p><p class="text-sm font-black text-rose-700 tabular-nums">{{ formatMAD(masterAssetPreview.interetsOuMarge) }}</p></div>
                            </div>
                        </div>

                        <!-- ── EXPLOITATION ── -->
                        <div v-show="masterAssetTab === 'exploitation'" class="space-y-3">
                            <div>
                                <label class="text-[10px] font-black uppercase tracking-widest text-sky-600 block mb-1.5">Mode d'exploitation</label>
                                <select v-model="masterAssetForm.mode_exploitation" class="w-full bg-sky-50 border-2 border-sky-200 rounded-lg px-3 py-2 text-sm font-black text-sky-800 outline-none focus:border-sky-500">
                                    <option value="aucun">Aucun (pas d'exploitation)</option>
                                    <option value="longue_duree">Location longue durée</option>
                                    <option value="courte_duree">Location courte durée (Airbnb)</option>
                                    <option value="commercial">Bail commercial</option>
                                </select>
                            </div>
                            <div v-if="masterAssetForm.mode_exploitation === 'longue_duree' || masterAssetForm.mode_exploitation === 'commercial'">
                                <label class="text-[10px] font-black uppercase tracking-widest text-sky-600 block mb-1.5">Loyer mensuel (DH)</label>
                                <input v-model.number="masterAssetForm.loyer_mensuel" type="number" min="0" step="500" class="w-full bg-sky-50 border-2 border-sky-200 rounded-lg px-3 py-2 text-sm font-black text-sky-800 outline-none focus:border-sky-500 text-right"/>
                            </div>
                            <div v-if="masterAssetForm.mode_exploitation === 'courte_duree'" class="grid grid-cols-2 md:grid-cols-5 gap-3">
                                <div>
                                    <label class="text-[10px] font-black uppercase tracking-widest text-sky-600 block mb-1.5">ADR (DH/nuit)</label>
                                    <input v-model.number="masterAssetForm.adr" type="number" min="0" step="50" class="w-full bg-sky-50 border-2 border-sky-200 rounded-lg px-3 py-2 text-sm font-black text-sky-800 outline-none focus:border-sky-500 text-right"/>
                                </div>
                                <div>
                                    <label class="text-[10px] font-black uppercase tracking-widest text-sky-600 block mb-1.5">Occupation (%)</label>
                                    <input v-model.number="masterAssetForm.taux_occupation" type="number" min="0" max="100" step="5" class="w-full bg-sky-50 border-2 border-sky-200 rounded-lg px-3 py-2 text-sm font-black text-sky-800 outline-none focus:border-sky-500 text-right"/>
                                </div>
                                <div>
                                    <label class="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1.5">Plateforme (%)</label>
                                    <input v-model.number="masterAssetForm.frais_plateforme_pct" type="number" min="0" max="50" step="0.1" class="w-full bg-white border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-black text-gray-800 outline-none focus:border-gray-400 text-right"/>
                                </div>
                                <div>
                                    <label class="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1.5">Co-host (%)</label>
                                    <input v-model.number="masterAssetForm.frais_cohost_pct" type="number" min="0" max="50" step="0.1" class="w-full bg-white border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-black text-gray-800 outline-none focus:border-gray-400 text-right"/>
                                </div>
                                <div>
                                    <label class="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1.5">Maintenance (%)</label>
                                    <input v-model.number="masterAssetForm.maintenance_pct" type="number" min="0" max="50" step="0.5" class="w-full bg-white border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-black text-gray-800 outline-none focus:border-gray-400 text-right"/>
                                </div>
                            </div>
                            <div v-if="masterAssetForm.mode_exploitation !== 'aucun'">
                                <p class="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Charges fixes mensuelles</p>
                                <div class="grid grid-cols-2 md:grid-cols-5 gap-2">
                                    <div><label class="text-[9px] font-bold uppercase text-gray-400 block mb-1">Syndic</label><input v-model.number="masterAssetForm.syndic" type="number" min="0" step="50" class="w-full bg-white border-2 border-gray-200 rounded-lg px-2 py-1.5 text-xs font-black text-gray-800 outline-none text-right"/></div>
                                    <div><label class="text-[9px] font-bold uppercase text-gray-400 block mb-1">Internet</label><input v-model.number="masterAssetForm.internet" type="number" min="0" step="50" class="w-full bg-white border-2 border-gray-200 rounded-lg px-2 py-1.5 text-xs font-black text-gray-800 outline-none text-right"/></div>
                                    <div><label class="text-[9px] font-bold uppercase text-gray-400 block mb-1">Élec / Eau</label><input v-model.number="masterAssetForm.electricite_eau" type="number" min="0" step="50" class="w-full bg-white border-2 border-gray-200 rounded-lg px-2 py-1.5 text-xs font-black text-gray-800 outline-none text-right"/></div>
                                    <div><label class="text-[9px] font-bold uppercase text-gray-400 block mb-1">Consommables</label><input v-model.number="masterAssetForm.consommables" type="number" min="0" step="50" class="w-full bg-white border-2 border-gray-200 rounded-lg px-2 py-1.5 text-xs font-black text-gray-800 outline-none text-right"/></div>
                                    <div><label class="text-[9px] font-bold uppercase text-gray-400 block mb-1">Assurance PNO</label><input v-model.number="masterAssetForm.assurance_pno" type="number" min="0" step="25" class="w-full bg-white border-2 border-gray-200 rounded-lg px-2 py-1.5 text-xs font-black text-gray-800 outline-none text-right"/></div>
                                </div>
                            </div>
                        </div>

                        <!-- ── FISCALITÉ ── -->
                        <div v-show="masterAssetTab === 'fiscalite'" class="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div class="col-span-2 md:col-span-3">
                                <label class="text-[10px] font-black uppercase tracking-widest text-orange-600 block mb-1.5">Régime fiscal</label>
                                <select v-model="masterAssetForm.regime_fiscal" class="w-full bg-orange-50 border-2 border-orange-200 rounded-lg px-3 py-2 text-sm font-black text-orange-800 outline-none focus:border-orange-500">
                                    <option value="exonere">Exonéré</option>
                                    <option value="foncier_bareme">Revenus fonciers — barème (avec abattement)</option>
                                    <option value="foncier_liberatoire">Revenus fonciers — taux libératoire</option>
                                    <option value="professionnel">Régime professionnel (résultat réel)</option>
                                </select>
                            </div>
                            <div v-if="masterAssetForm.regime_fiscal === 'foncier_bareme' || masterAssetForm.regime_fiscal === 'professionnel'">
                                <label class="text-[10px] font-black uppercase tracking-widest text-orange-600 block mb-1.5">Taux marginal (%)</label>
                                <input v-model.number="masterAssetForm.taux_marginal" type="number" min="0" max="60" step="1" class="w-full bg-orange-50 border-2 border-orange-200 rounded-lg px-3 py-2 text-sm font-black text-orange-800 outline-none text-right"/>
                            </div>
                            <div v-if="masterAssetForm.regime_fiscal === 'foncier_bareme'">
                                <label class="text-[10px] font-black uppercase tracking-widest text-orange-600 block mb-1.5">Abattement (%)</label>
                                <input v-model.number="masterAssetForm.abattement_pct" type="number" min="0" max="100" step="5" class="w-full bg-orange-50 border-2 border-orange-200 rounded-lg px-3 py-2 text-sm font-black text-orange-800 outline-none text-right"/>
                            </div>
                            <div v-if="masterAssetForm.regime_fiscal === 'foncier_liberatoire'">
                                <label class="text-[10px] font-black uppercase tracking-widest text-orange-600 block mb-1.5">Taux libératoire (%)</label>
                                <input v-model.number="masterAssetForm.taux_liberatoire" type="number" min="0" max="60" step="1" class="w-full bg-orange-50 border-2 border-orange-200 rounded-lg px-3 py-2 text-sm font-black text-orange-800 outline-none text-right"/>
                            </div>
                            <template v-if="masterAssetForm.regime_fiscal === 'professionnel'">
                                <div><label class="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1.5">Amort. bâti (%/an)</label><input v-model.number="masterAssetForm.amortissement_bati_pct" type="number" min="0" max="20" step="0.5" class="w-full bg-white border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-black text-gray-800 outline-none text-right"/></div>
                                <div><label class="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1.5">Amort. mobilier (%/an)</label><input v-model.number="masterAssetForm.amortissement_mobilier_pct" type="number" min="0" max="50" step="1" class="w-full bg-white border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-black text-gray-800 outline-none text-right"/></div>
                                <div><label class="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1.5">Part bâti (%)</label><input v-model.number="masterAssetForm.part_bati_pct" type="number" min="0" max="100" step="5" class="w-full bg-white border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-black text-gray-800 outline-none text-right"/></div>
                            </template>
                        </div>

                        <!-- ── APERÇU LIVE ── -->
                        <div v-if="masterAssetForm.isProductive" class="mt-4 p-3 rounded-xl bg-slate-900 text-white grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div><p class="text-[9px] uppercase tracking-widest opacity-50">CA annuel</p><p class="text-sm font-black tabular-nums">{{ formatMAD(masterAssetPreview.ca) }}</p></div>
                            <div><p class="text-[9px] uppercase tracking-widest opacity-50">REX</p><p class="text-sm font-black tabular-nums text-emerald-300">{{ formatMAD(masterAssetPreview.rex) }}</p></div>
                            <div><p class="text-[9px] uppercase tracking-widest opacity-50">Cash-flow net</p><p :class="['text-sm font-black tabular-nums', masterAssetPreview.cashflowNet >= 0 ? 'text-yellow-300' : 'text-red-400']">{{ formatMAD(masterAssetPreview.cashflowNet) }}</p></div>
                            <div><p class="text-[9px] uppercase tracking-widest opacity-50">Rdt net · ROE</p><p class="text-sm font-black tabular-nums text-sky-300">{{ masterAssetPreview.rendementNet.toFixed(1) }}% · {{ masterAssetPreview.roe.toFixed(1) }}%</p></div>
                        </div>
                    </div>
                </div>`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v33.03 modale actif appliquée');
