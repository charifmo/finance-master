/**
 * v33.40 — Vieillissement dynamique de la dette
 * ---------------------------------------------------------------------------
 *  1. Nouveau champ date_debut_credit ("YYYY-MM") — la date de déblocage.
 *  2. moisEcoulesCredit(actif) : (anneeActuelle − anneeDebut) × 12
 *                              + (moisActuel − moisDebut), borné à [0, durée].
 *     L'horloge de référence est celle de l'application (soldesInitiaux),
 *     pas Date.now() — la projection reste alignée sur le cycle budgétaire.
 *  3. creditParams consomme cette valeur : l'échéancier vieillit tout seul,
 *     sans ouvrir la fiche ni retoucher quoi que ce soit.
 *  4. UI : input type="month" + « Mois déjà payés » en lecture seule avec
 *     badge « calculé » dès que la date est remplie ; sinon saisie manuelle.
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
   1. SCHÉMA + PERSISTANCE
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                        marge_totale: 0, mode_marge: 'lineaire', taux_ibraa: 0, mois_deja_payes: 0,`,
`                        marge_totale: 0, mode_marge: 'lineaire', taux_ibraa: 0, mois_deja_payes: 0,
                        date_debut_credit: '',   // v33.40 : "YYYY-MM" — fait vieillir la dette`);

sub(
`                            mois_deja_payes: Number(f.mois_deja_payes) || 0,`,
`                            mois_deja_payes: Number(f.mois_deja_payes) || 0,
                            date_debut_credit: String(f.date_debut_credit || ''),`);

/* ══════════════════════════════════════════════════════════════════════════
   2. MOTEUR — mois écoulés dérivés de la date de déblocage
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                    // ── v33.30 : PARAMÈTRES DE CRÉDIT DÉDUITS ──────────────────────────`,
String.raw`                    // ── v33.40 : MOIS ÉCOULÉS DEPUIS LE DÉBLOCAGE ──────────────────────
                    //   Référence = l'horloge de l'application (soldesInitiaux), pas
                    //   Date.now() : tout le moteur raisonne sur le cycle budgétaire
                    //   courant, la dette doit vieillir au même rythme.
                    //   Renvoie null si aucune date exploitable → repli sur la saisie.
                    const moisEcoulesCredit = (asset) => {
                        const a = asset || {};
                        const d = String(a.date_debut_credit || '').trim();
                        const m = d.match(/^(\d{4})-(\d{1,2})$/);
                        if (!m) return null;
                        const anneeDebut = Number(m[1]), moisDebut = Number(m[2]);
                        if (!anneeDebut || !moisDebut) return null;
                        const si = soldesInitiaux.value || {};
                        const anneeActuelle = Number(si.anneeActuelle) || new Date().getFullYear();
                        const moisActuel = Number(si.moisActuel) || (new Date().getMonth() + 1);
                        const ecoules = (anneeActuelle - anneeDebut) * 12 + (moisActuel - moisDebut);
                        const duree = Math.round(N(a.duree_mois));
                        // borné : ni négatif (crédit pas encore débloqué), ni au-delà du terme
                        return Math.max(0, duree > 0 ? Math.min(ecoules, duree) : ecoules);
                    };
                    // Valeur effectivement utilisée par le moteur : date si présente, sinon saisie
                    const moisPayesEffectifs = (asset) => {
                        const auto = moisEcoulesCredit(asset);
                        return auto !== null ? auto : Math.max(0, Math.round(N((asset || {}).mois_deja_payes)));
                    };

                    // ── v33.30 : PARAMÈTRES DE CRÉDIT DÉDUITS ──────────────────────────`);

sub(
`                            offset: pilotageCapitalInitial ? Math.max(0, Math.round(N(a.mois_deja_payes))) : 0,
                            pilotageCapitalInitial,`,
`                            offset: pilotageCapitalInitial ? moisPayesEffectifs(a) : 0,
                            pilotageCapitalInitial,
                            moisEcoules: moisPayesEffectifs(a),
                            dateePilotee: moisEcoulesCredit(a) !== null,`);

/* ══════════════════════════════════════════════════════════════════════════
   3. MODALE — computed + watcher
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                    const masterAssetPiloteParCapital = computed(() => N(masterAssetForm.value.capital_initial) > 0);`,
String.raw`                    const masterAssetPiloteParCapital = computed(() => N(masterAssetForm.value.capital_initial) > 0);
                    // v33.40 : mois écoulés dérivés de la date de déblocage
                    const masterAssetMoisAuto = computed(() => moisEcoulesCredit(masterAssetForm.value));
                    const masterAssetDatePilotee = computed(() => masterAssetMoisAuto.value !== null);

                    // La valeur calculée est recopiée dans le formulaire pour être persistée,
                    // afin que le reste de l'app (qui lit mois_deja_payes) reste cohérent.
                    watch(
                        () => masterAssetForm.value.date_debut_credit + '|' + masterAssetForm.value.duree_mois
                              + '|' + (soldesInitiaux.value || {}).moisActuel + '|' + (soldesInitiaux.value || {}).anneeActuelle,
                        () => {
                            const auto = masterAssetMoisAuto.value;
                            if (auto === null) return;
                            if (Number(masterAssetForm.value.mois_deja_payes) !== auto) {
                                masterAssetForm.value.mois_deja_payes = auto;
                            }
                        },
                        { immediate: true }
                    );`);

sub(
`                        masterAssetCredit, masterAssetCRD, masterAssetPiloteParCapital,
                        creditParams, creditRestantCalcule,`,
`                        masterAssetCredit, masterAssetCRD, masterAssetPiloteParCapital,
                        masterAssetMoisAuto, masterAssetDatePilotee,
                        creditParams, creditRestantCalcule, moisEcoulesCredit, moisPayesEffectifs,`);

/* ══════════════════════════════════════════════════════════════════════════
   4. TEMPLATE — champ date + mois payés en lecture seule
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                            <div>
                                <label class="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1.5">Mois déjà payés</label>
                                <input v-model.number="masterAssetForm.mois_deja_payes" type="number" min="0" max="360" step="1" class="w-full bg-slate-50 border-2 border-slate-200 rounded-lg px-3 py-2 text-sm font-black text-slate-800 outline-none focus:border-slate-500 text-right"/>
                            </div>`,
`                            <div>
                                <label class="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1.5">📆 Date d'initiation du crédit</label>
                                <input v-model="masterAssetForm.date_debut_credit" type="month"
                                       class="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-3 py-2 text-sm font-black text-slate-800 outline-none focus:border-slate-500 text-right"/>
                                <p class="text-[9px] font-bold mt-0.5" :class="masterAssetDatePilotee ? 'text-emerald-600' : 'text-gray-400'">
                                    {{ masterAssetDatePilotee
                                        ? '✅ La dette vieillit toute seule au fil des cycles'
                                        : 'Vide : les mois payés restent saisis à la main' }}
                                </p>
                            </div>
                            <div>
                                <label class="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1.5 flex items-center justify-between">
                                    <span>Mois déjà payés</span>
                                    <span v-if="masterAssetDatePilotee" class="text-[8px] bg-slate-700 text-white px-1.5 py-0.5 rounded normal-case tracking-normal">calculé</span>
                                </label>
                                <input v-model.number="masterAssetForm.mois_deja_payes" type="number" min="0" max="360" step="1"
                                       :readonly="masterAssetDatePilotee"
                                       :class="masterAssetDatePilotee
                                           ? 'w-full bg-gray-100 border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-black text-gray-600 outline-none cursor-not-allowed text-right'
                                           : 'w-full bg-slate-50 border-2 border-slate-200 rounded-lg px-3 py-2 text-sm font-black text-slate-800 outline-none focus:border-slate-500 text-right'"/>
                                <p v-if="masterAssetDatePilotee" class="text-[9px] text-slate-400 font-bold mt-0.5">
                                    Au cycle {{ nomDuMois(soldesInitiaux.moisActuel) }} {{ soldesInitiaux.anneeActuelle }}
                                    · reste {{ Math.max(0, (masterAssetForm.duree_mois || 0) - masterAssetMoisAuto) }} mois
                                </p>
                            </div>`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v33.40 vieillissement de la dette appliqué');
