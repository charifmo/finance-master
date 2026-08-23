/**
 * v33.30 — Crédit restant et marge calculés, plus saisis
 * ---------------------------------------------------------------------------
 *  1. Nouveau champ capital_initial : la base absolue de l'échéancier.
 *  2. creditParams(actif) déduit ce qui manque — marge Mourabaha à partir du
 *     capital initial, mensualité à partir du taux, ET taux implicite à partir
 *     de la mensualité (indispensable pour un prêt classique dont on ne connaît
 *     que capital + mensualité + durée).
 *  3. creditRestantCalcule(actif) fait tourner l'échéancier jusqu'à
 *     mois_deja_payes et renvoie le solde exact.
 *  4. Le champ « Crédit restant » passe en lecture seule et se remplit tout seul
 *     dès que capital_initial est renseigné.
 *
 *  SÉMANTIQUE (corrige une incohérence de fond) :
 *    capital_initial > 0 → échéancier depuis capital_initial, décalé de
 *                          mois_deja_payes. montant_credit devient un résultat.
 *    capital_initial = 0 → comportement legacy : montant_credit est le solde
 *                          d'aujourd'hui, aucun décalage n'est appliqué.
 *    Auparavant le solde restant servait de capital de départ PUIS était décalé
 *    de mois_deja_payes : les mensualités passées étaient comptées deux fois.
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
`                        apport_personnel: 0, montant_credit: 0, type_credit: 'classique',`,
`                        apport_personnel: 0, capital_initial: 0, montant_credit: 0, type_credit: 'classique',`);

sub(
`                            type_credit: String(f.type_credit || 'classique'),`,
`                            capital_initial: Number(f.capital_initial) || 0,
                            type_credit: String(f.type_credit || 'classique'),`);

/* ══════════════════════════════════════════════════════════════════════════
   2. creditParams — déduction de tout ce qui manque
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                    // ── Tableau d'amortissement mensuel complet ────────────────────────`,
String.raw`                    // ── v33.30 : PARAMÈTRES DE CRÉDIT DÉDUITS ──────────────────────────
                    //   Le moteur complète tout seul ce que l'utilisateur n'a pas saisi.
                    //   capInit  : capital_initial si présent, sinon montant_credit (legacy)
                    //   marge    : Mourabaha → mensualite × durée − capital initial
                    //   mens     : déduite du taux, ou de (capital + marge) / durée
                    //   taux     : déduit de la mensualité par bissection quand il manque
                    //              (cas d'un prêt classique connu par sa seule échéance)
                    const creditParams = (asset) => {
                        const a = asset || {};
                        const pilotageCapitalInitial = N(a.capital_initial) > 0;
                        const capInit = pilotageCapitalInitial ? N(a.capital_initial) : N(a.montant_credit);
                        const n = Math.round(N(a.duree_mois));
                        const estMourabaha = String(a.type_credit || 'classique') === 'mourabaha';
                        let mens = N(a.mensualite);
                        let taux = N(a.taux_credit);
                        let marge = N(a.marge_totale);

                        if (estMourabaha) {
                            // Marge « auto » : elle se déduit de l'échéance et du capital INITIAL.
                            if (marge <= 0) {
                                if (mens > 0 && n > 0 && capInit > 0) marge = mens * n - capInit;
                                else if (taux > 0 && capInit > 0 && n > 0) marge = mensualiteClassique(capInit, taux, n) * n - capInit;
                            }
                            if (marge < 0) marge = 0;
                            if (mens <= 0 && n > 0) mens = (capInit + marge) / n;
                        } else if (mens <= 0) {
                            mens = mensualiteClassique(capInit, taux, n);
                        }
                        // Taux implicite : dernier recours, mais c'est LE cas courant d'un
                        // prêt en cours dont on ne connaît que capital, échéance et durée.
                        if (taux <= 0 && mens > 0 && capInit > 0 && n > 0 && mens * n > capInit) {
                            taux = tauxImplicite(capInit, mens, n) * 12 * 100;
                        }
                        return {
                            capInit, n, estMourabaha,
                            mens: Math.round(mens * 100) / 100,
                            taux: Math.round(taux * 10000) / 10000,
                            marge: Math.round(marge * 100) / 100,
                            // décalage : n'a de sens que si l'échéancier part du capital initial
                            offset: pilotageCapitalInitial ? Math.max(0, Math.round(N(a.mois_deja_payes))) : 0,
                            pilotageCapitalInitial,
                        };
                    };

                    // ── Tableau d'amortissement mensuel complet ────────────────────────`);

/* ══════════════════════════════════════════════════════════════════════════
   3. tableauAmortissement branché sur creditParams
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                        const a = asset || {};
                        const C = N(a.montant_credit);
                        const n = Math.round(N(a.duree_mois));
                        if (C <= 0 || n <= 0) return [];
                        const estMourabaha = String(a.type_credit || 'classique') === 'mourabaha';
                        const rows = [];
                        let solde = C;

                        if (!estMourabaha) {
                            const i = N(a.taux_credit) / 100 / 12;
                            const M = N(a.mensualite) > 0 ? N(a.mensualite) : mensualiteClassique(C, a.taux_credit, n);`,
`                        const a = asset || {};
                        const p = creditParams(a);
                        const C = p.capInit, n = p.n, estMourabaha = p.estMourabaha;
                        if (C <= 0 || n <= 0) return [];
                        const rows = [];
                        let solde = C;

                        if (!estMourabaha) {
                            const i = p.taux / 100 / 12;
                            const M = p.mens > 0 ? p.mens : mensualiteClassique(C, p.taux, n);`);

sub(
`                        // Mourabaha
                        let MT = N(a.marge_totale);
                        if (MT <= 0 && N(a.taux_credit) > 0) MT = mensualiteClassique(C, a.taux_credit, n) * n - C;
                        const ech = (C + MT) / n;`,
`                        // Mourabaha — marge et échéance issues de creditParams
                        const MT = p.marge;
                        const ech = p.mens > 0 ? p.mens : (C + MT) / n;`);

/* ══════════════════════════════════════════════════════════════════════════
   4. offset piloté par creditParams
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                        const offset = Math.max(0, Math.round(N(a.mois_deja_payes)));
                        const debut = offset + Math.max(0, Math.round(N(anneeIndex))) * 12;`,
`                        const offset = creditParams(a).offset;
                        const debut = offset + Math.max(0, Math.round(N(anneeIndex))) * 12;`);

/* ══════════════════════════════════════════════════════════════════════════
   5. creditRestantCalcule — le CRD généré
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                    // ── Solde de remboursement anticipé (Mourabaha avec Ibra'a) ────────`,
String.raw`                    // ── v33.30 : CRÉDIT RESTANT DÛ CALCULÉ ─────────────────────────────
                    //   Fait tourner l'échéancier jusqu'au mois « mois_deja_payes »
                    //   et renvoie le solde exact. Aucune saisie manuelle.
                    const creditRestantCalcule = (asset) => {
                        const a = asset || {};
                        const p = creditParams(a);
                        if (!p.pilotageCapitalInitial) return N(a.montant_credit);
                        if (p.capInit <= 0 || p.n <= 0) return 0;
                        const tab = tableauAmortissement(a);
                        if (!tab.length) return p.capInit;
                        const k = Math.min(tab.length, p.offset);
                        const solde = k <= 0 ? p.capInit : tab[k - 1].soldeApres;
                        return Math.round(Math.max(0, solde) * 100) / 100;
                    };

                    // ── Solde de remboursement anticipé (Mourabaha avec Ibra'a) ────────`);

// Le solde anticipé doit partir du même capital de référence
sub(
`                        const k = Math.max(0, Math.min(tab.length, Math.round(N(apresMois))));
                        const capitalRestant = k === 0 ? N(a.montant_credit) : tab[k - 1].soldeApres;`,
`                        const k = Math.max(0, Math.min(tab.length, Math.round(N(apresMois))));
                        const capitalRestant = k === 0 ? creditParams(a).capInit : tab[k - 1].soldeApres;`);

/* ══════════════════════════════════════════════════════════════════════════
   6. MODALE — champ + watcher + affichages dérivés
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                    const masterAssetMensualiteAuto = computed(() =>
                        Math.round(mensualiteClassique(masterAssetForm.value.montant_credit, masterAssetForm.value.taux_credit, masterAssetForm.value.duree_mois) * 100) / 100);`,
String.raw`                    const masterAssetCredit = computed(() => creditParams(masterAssetForm.value));
                    const masterAssetMensualiteAuto = computed(() => masterAssetCredit.value.mens);
                    const masterAssetCRD = computed(() => creditRestantCalcule(masterAssetForm.value));
                    const masterAssetPiloteParCapital = computed(() => N(masterAssetForm.value.capital_initial) > 0);

                    // v33.30 : dès que le capital initial pilote le crédit, le champ
                    // « Crédit restant » devient un résultat — on l'écrit dans le
                    // formulaire pour qu'il soit persisté tel quel à l'enregistrement.
                    watch(
                        () => [masterAssetForm.value.capital_initial, masterAssetForm.value.duree_mois,
                               masterAssetForm.value.mois_deja_payes, masterAssetForm.value.mensualite,
                               masterAssetForm.value.taux_credit, masterAssetForm.value.type_credit,
                               masterAssetForm.value.marge_totale, masterAssetForm.value.mode_marge].join('|'),
                        () => {
                            if (!masterAssetPiloteParCapital.value) return;
                            const crd = masterAssetCRD.value;
                            if (Math.abs(N(masterAssetForm.value.montant_credit) - crd) > 0.01) {
                                masterAssetForm.value.montant_credit = crd;
                            }
                        }
                    );`);

sub(
`                        masterAssetTab, masterAssetPreview, masterAssetMensualiteAuto,`,
`                        masterAssetTab, masterAssetPreview, masterAssetMensualiteAuto,
                        masterAssetCredit, masterAssetCRD, masterAssetPiloteParCapital,
                        creditParams, creditRestantCalcule,`);

/* ══════════════════════════════════════════════════════════════════════════
   7. UI — champ Capital initial + Crédit restant en lecture seule
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                        <div>
                            <label class="text-[10px] font-black uppercase tracking-widest text-rose-600 block mb-1.5">Montant crédit (DH)</label>
                            <input v-model.number="masterAssetForm.montant_credit" type="number" min="0" step="5000"
                                   @input="calculerCapital"
                                   class="w-full bg-rose-50 border-2 border-rose-200 rounded-lg px-3 py-2 text-sm font-black text-rose-800 outline-none focus:border-rose-500 text-right"/>
                        </div>
                    </div>`,
`                        <div>
                            <label class="text-[10px] font-black uppercase tracking-widest text-rose-600 block mb-1.5 flex items-center justify-between">
                                <span>Crédit restant (DH)</span>
                                <span v-if="masterAssetPiloteParCapital" class="text-[8px] bg-rose-600 text-white px-1.5 py-0.5 rounded normal-case tracking-normal">calculé</span>
                            </label>
                            <input v-model.number="masterAssetForm.montant_credit" type="number" min="0" step="5000"
                                   @input="calculerCapital"
                                   :readonly="masterAssetPiloteParCapital"
                                   :class="masterAssetPiloteParCapital
                                       ? 'w-full bg-gray-100 border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-black text-gray-600 outline-none cursor-not-allowed text-right'
                                       : 'w-full bg-rose-50 border-2 border-rose-200 rounded-lg px-3 py-2 text-sm font-black text-rose-800 outline-none focus:border-rose-500 text-right'"/>
                            <p v-if="masterAssetPiloteParCapital" class="text-[9px] text-rose-400 font-bold mt-0.5">Déduit du capital initial après {{ masterAssetForm.mois_deja_payes || 0 }} mois</p>
                        </div>
                    </div>`);

sub(
`                            <div>
                                <label class="text-[10px] font-black uppercase tracking-widest text-rose-600 block mb-1.5">Type de crédit</label>`,
`                            <div class="col-span-2 md:col-span-3">
                                <label class="text-[10px] font-black uppercase tracking-widest text-rose-600 block mb-1.5">💰 Capital initial emprunté (DH)</label>
                                <input v-model.number="masterAssetForm.capital_initial" type="number" min="0" step="10000"
                                       placeholder="Renseigne-le et le crédit restant se calcule tout seul"
                                       class="w-full bg-rose-50 border-2 border-rose-300 rounded-lg px-3 py-2 text-sm font-black text-rose-800 outline-none focus:border-rose-500 text-right"/>
                                <p class="text-[9px] font-bold mt-0.5" :class="masterAssetPiloteParCapital ? 'text-emerald-600' : 'text-gray-400'">
                                    {{ masterAssetPiloteParCapital
                                        ? '✅ Base de l’échéancier — le crédit restant, la marge et le taux en découlent'
                                        : 'Vide : le moteur retombe sur le crédit restant saisi à la main' }}
                                </p>
                            </div>
                            <div>
                                <label class="text-[10px] font-black uppercase tracking-widest text-rose-600 block mb-1.5">Type de crédit</label>`);

sub(
`                                <label class="text-[10px] font-black uppercase tracking-widest text-teal-600 block mb-1.5">Marge totale (0 = auto)</label>
                                    <input v-model.number="masterAssetForm.marge_totale" type="number" min="0" step="1000" class="w-full bg-teal-50 border-2 border-teal-200 rounded-lg px-3 py-2 text-sm font-black text-teal-800 outline-none focus:border-teal-500 text-right"/>`,
`                                <label class="text-[10px] font-black uppercase tracking-widest text-teal-600 block mb-1.5">Marge totale (0 = auto)</label>
                                    <input v-model.number="masterAssetForm.marge_totale" type="number" min="0" step="1000" class="w-full bg-teal-50 border-2 border-teal-200 rounded-lg px-3 py-2 text-sm font-black text-teal-800 outline-none focus:border-teal-500 text-right"/>
                                    <p class="text-[9px] text-teal-500 font-bold mt-0.5">auto : {{ formatMAD(masterAssetCredit.marge) }}</p>`);

// Bandeau de synthèse enrichi
sub(
`                            <div class="col-span-2 md:col-span-3 grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                                <div class="bg-gray-50 rounded-lg px-2 py-1.5"><p class="text-[9px] font-black uppercase text-gray-400">Service dette / an</p><p class="text-sm font-black text-gray-800 tabular-nums">{{ formatMAD(masterAssetPreview.serviceDette) }}</p></div>`,
`                            <div class="col-span-2 md:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                                <div class="bg-rose-50 rounded-lg px-2 py-1.5 border border-rose-200"><p class="text-[9px] font-black uppercase text-rose-400">Crédit restant calculé</p><p class="text-sm font-black text-rose-800 tabular-nums">{{ formatMAD(masterAssetCRD) }}</p></div>
                                <div class="bg-gray-50 rounded-lg px-2 py-1.5"><p class="text-[9px] font-black uppercase text-gray-400">Taux effectif</p><p class="text-sm font-black text-gray-800 tabular-nums">{{ masterAssetCredit.taux.toFixed(2) }} %</p></div>
                                <div class="bg-gray-50 rounded-lg px-2 py-1.5"><p class="text-[9px] font-black uppercase text-gray-400">Marge / intérêts totaux</p><p class="text-sm font-black text-gray-800 tabular-nums">{{ formatMAD(masterAssetCredit.estMourabaha ? masterAssetCredit.marge : masterAssetCredit.mens * masterAssetCredit.n - masterAssetCredit.capInit) }}</p></div>
                                <div class="bg-gray-50 rounded-lg px-2 py-1.5"><p class="text-[9px] font-black uppercase text-gray-400">Service dette / an</p><p class="text-sm font-black text-gray-800 tabular-nums">{{ formatMAD(masterAssetPreview.serviceDette) }}</p></div>`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v33.30 crédit dynamique appliqué');
