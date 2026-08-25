/**
 * v33.95 — Smart Mourabaha : la marge se déduit, elle ne se saisit plus
 * ---------------------------------------------------------------------------
 * Une marge saisie à la main qui ne colle pas exactement à l'échéancier fausse
 * la répartition capital/marge, donc le capital restant dû, donc l'Ibra'a. La
 * seule donnée fiable d'un contrat Mourabaha est le triplet
 * (montant net financé, durée, mensualité) : tout le reste en découle.
 *
 *  1. « Capital initial emprunté » devient « Montant net financé (prix d'achat
 *     pur) » avec la consigne de ne pas y inclure le bénéfice de la banque.
 *  2. marge_totale passe en lecture seule et vaut STRICTEMENT
 *     mensualité × durée − montant net financé, recalculée en continu.
 *  3. La mensualité devient obligatoire en Mourabaha : le mode « 0 = auto »
 *     n'a plus de sens puisque c'est elle qui porte la marge.
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

/* ══════════════════════════════════════════════════════════════════════════
   1. MOTEUR — la marge est toujours déduite du contrat
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                        if (estMourabaha) {
                            // Marge « auto » : elle se déduit de l'échéance et du capital INITIAL.
                            if (marge <= 0) {
                                if (mens > 0 && n > 0 && capInit > 0) marge = mens * n - capInit;
                                else if (taux > 0 && capInit > 0 && n > 0) marge = mensualiteClassique(capInit, taux, n) * n - capInit;
                            }
                            if (marge < 0) marge = 0;
                            if (mens <= 0 && n > 0) mens = (capInit + marge) / n;
                        } else if (mens <= 0) {`,
`                        if (estMourabaha) {
                            // v33.95 : la marge n'est plus une saisie mais un RÉSULTAT du contrat.
                            //   marge = mensualité × durée − montant net financé
                            //   Une marge stockée qui ne colle pas à l'échéancier fausserait la
                            //   répartition capital/marge, donc le capital restant dû, donc l'Ibra'a.
                            if (mens > 0 && n > 0 && capInit > 0) {
                                marge = mens * n - capInit;
                            } else if (marge <= 0 && taux > 0 && capInit > 0 && n > 0) {
                                // repli : aucun échéancier connu, on part du taux affiché
                                marge = mensualiteClassique(capInit, taux, n) * n - capInit;
                            }
                            if (marge < 0) marge = 0;
                            if (mens <= 0 && n > 0) mens = (capInit + marge) / n;
                        } else if (mens <= 0) {`);

/* ══════════════════════════════════════════════════════════════════════════
   2. MODALE — la marge calculée est recopiée dans le formulaire
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                    // v33.40 : mois écoulés dérivés de la date de déblocage
                    const masterAssetMoisAuto = computed(() => moisEcoulesCredit(masterAssetForm.value));`,
`                    // v33.95 : en Mourabaha, la marge affichée EST la marge calculée
                    const masterAssetMargeAuto = computed(() => masterAssetCredit.value.marge);
                    const masterAssetMourabaha = computed(() => String(masterAssetForm.value.type_credit) === 'mourabaha');
                    const masterAssetMensualiteManquante = computed(() =>
                        masterAssetMourabaha.value && !(N(masterAssetForm.value.mensualite) > 0));
                    watch(
                        () => [masterAssetForm.value.type_credit, masterAssetForm.value.capital_initial,
                               masterAssetForm.value.duree_mois, masterAssetForm.value.mensualite].join('|'),
                        () => {
                            if (!masterAssetMourabaha.value) return;
                            const m = masterAssetMargeAuto.value;
                            if (Number(masterAssetForm.value.marge_totale) !== m) masterAssetForm.value.marge_totale = m;
                        },
                        { immediate: true }
                    );

                    // v33.40 : mois écoulés dérivés de la date de déblocage
                    const masterAssetMoisAuto = computed(() => moisEcoulesCredit(masterAssetForm.value));`);

sub(
`                        masterAssetMoisAuto, masterAssetDatePilotee,`,
`                        masterAssetMoisAuto, masterAssetDatePilotee,
                        masterAssetMargeAuto, masterAssetMourabaha, masterAssetMensualiteManquante,`);

/* ══════════════════════════════════════════════════════════════════════════
   3. TEMPLATE — libellés, verrouillage, mensualité obligatoire
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                                <label class="text-[10px] font-black uppercase tracking-widest text-rose-600 block mb-1.5">💰 Capital initial emprunté (DH)</label>
                                <input v-model.number="masterAssetForm.capital_initial" type="number" min="0" step="10000"
                                       placeholder="Renseigne-le et le crédit restant se calcule tout seul"
                                       class="w-full bg-rose-50 border-2 border-rose-300 rounded-lg px-3 py-2 text-sm font-black text-rose-800 outline-none focus:border-rose-500 text-right"/>
                                <p class="text-[9px] font-bold mt-0.5" :class="masterAssetPiloteParCapital ? 'text-emerald-600' : 'text-gray-400'">
                                    {{ masterAssetPiloteParCapital
                                        ? '✅ Base de l’échéancier — le crédit restant, la marge et le taux en découlent'
                                        : 'Vide : le moteur retombe sur le crédit restant saisi à la main' }}
                                </p>`,
`                                <label class="text-[10px] font-black uppercase tracking-widest text-rose-600 block mb-1.5">
                                    💰 {{ masterAssetMourabaha ? 'Montant net financé (prix d’achat pur)' : 'Capital initial emprunté' }} (DH)
                                </label>
                                <input v-model.number="masterAssetForm.capital_initial" type="number" min="0" step="10000"
                                       :placeholder="masterAssetMourabaha ? 'Le prix payé au vendeur, hors bénéfice de la banque' : 'Renseigne-le et le crédit restant se calcule tout seul'"
                                       class="w-full bg-rose-50 border-2 border-rose-300 rounded-lg px-3 py-2 text-sm font-black text-rose-800 outline-none focus:border-rose-500 text-right"/>
                                <p v-if="masterAssetMourabaha" class="text-[9px] font-bold text-amber-600 mt-0.5">
                                    ⚠️ Ne pas inclure le bénéfice de la banque : c’est le prix d’acquisition pur. La marge en est déduite.
                                </p>
                                <p v-else class="text-[9px] font-bold mt-0.5" :class="masterAssetPiloteParCapital ? 'text-emerald-600' : 'text-gray-400'">
                                    {{ masterAssetPiloteParCapital
                                        ? '✅ Base de l’échéancier — le crédit restant, la marge et le taux en découlent'
                                        : 'Vide : le moteur retombe sur le crédit restant saisi à la main' }}
                                </p>`);

// Mensualité : obligatoire en Mourabaha
sub(
`                                <label class="text-[10px] font-black uppercase tracking-widest text-amber-600 block mb-1.5">Mensualité (0 = auto)</label>
                                <input v-model.number="masterAssetForm.mensualite" type="number" min="0" step="50" :placeholder="masterAssetMensualiteAuto" class="w-full bg-amber-50 border-2 border-amber-200 rounded-lg px-3 py-2 text-sm font-black text-amber-800 outline-none focus:border-amber-500 text-right"/>
                                <p class="text-[9px] text-amber-500 font-bold mt-0.5">auto : {{ formatMAD(masterAssetMensualiteAuto) }}</p>`,
`                                <label class="text-[10px] font-black uppercase tracking-widest text-amber-600 block mb-1.5">
                                    Mensualité {{ masterAssetMourabaha ? '(obligatoire)' : '(0 = auto)' }}
                                </label>
                                <input v-model.number="masterAssetForm.mensualite" type="number" min="0" step="50"
                                       :placeholder="masterAssetMourabaha ? 'Échéance du contrat' : masterAssetMensualiteAuto"
                                       :class="masterAssetMensualiteManquante
                                           ? 'w-full bg-red-50 border-2 border-red-400 rounded-lg px-3 py-2 text-sm font-black text-red-800 outline-none text-right'
                                           : 'w-full bg-amber-50 border-2 border-amber-200 rounded-lg px-3 py-2 text-sm font-black text-amber-800 outline-none focus:border-amber-500 text-right'"/>
                                <p v-if="masterAssetMensualiteManquante" class="text-[9px] text-red-600 font-bold mt-0.5">Requise : c’est elle qui détermine la marge et l’Ibra’a.</p>
                                <p v-else-if="!masterAssetMourabaha" class="text-[9px] text-amber-500 font-bold mt-0.5">auto : {{ formatMAD(masterAssetMensualiteAuto) }}</p>
                                <p v-else class="text-[9px] text-emerald-600 font-bold mt-0.5">Échéance du contrat · pilote tout le calcul</p>`);

// Marge : lecture seule, valeur calculée
sub(
`                                    <label class="text-[10px] font-black uppercase tracking-widest text-teal-600 block mb-1.5">Marge totale (0 = auto)</label>
                                    <input v-model.number="masterAssetForm.marge_totale" type="number" min="0" step="1000" class="w-full bg-teal-50 border-2 border-teal-200 rounded-lg px-3 py-2 text-sm font-black text-teal-800 outline-none focus:border-teal-500 text-right"/>
                                    <p class="text-[9px] text-teal-500 font-bold mt-0.5">auto : {{ formatMAD(masterAssetCredit.marge) }}</p>`,
`                                    <label class="text-[10px] font-black uppercase tracking-widest text-teal-600 block mb-1.5 flex items-center justify-between">
                                        <span>Marge totale banque</span>
                                        <span class="text-[8px] bg-teal-600 text-white px-1.5 py-0.5 rounded normal-case tracking-normal">calculée</span>
                                    </label>
                                    <input :value="masterAssetMargeAuto" type="number" readonly
                                           class="w-full bg-gray-100 border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-black text-gray-600 outline-none cursor-not-allowed text-right"/>
                                    <p class="text-[9px] text-teal-500 font-bold mt-0.5">
                                        {{ formatMAD(masterAssetCredit.mens) }} × {{ masterAssetCredit.n }} mois − {{ formatMAD(masterAssetCredit.capInit) }}
                                    </p>`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v33.95 appliquée');
