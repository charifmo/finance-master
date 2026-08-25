/**
 * v33.96 — Colonne « Crédit restant » au format banque participative
 * ---------------------------------------------------------------------------
 * Une banque Mourabaha annonce au client sa dette CONTRACTUELLE : capital
 * restant + marge non échue. Le tableau n'affichait que le capital pur, d'où
 * l'écart avec le relevé Bank Assafa.
 *
 *  1. Colonne CRÉDIT RESTANT : sur une Mourabaha, le chiffre en gras devient
 *     capital restant + marge non échue, avec « dont X DH de marge » en dessous.
 *     L'Ibra'a n'est PAS déduite ici : c'est une remise commerciale accordée au
 *     moment d'un remboursement anticipé, pas une réduction de la dette due.
 *     Elle reste affichée dans le simulateur de revente, à sa place.
 *
 *  2. Colonne NET inchangée : valeur actuelle − capital restant PUR. Imputer la
 *     marge non échue au bilan amputerait le patrimoine d'un coup d'une charge
 *     qui court sur toute la durée du contrat. Par construction,
 *     total affiché − marge affichée = capital déduit du NET.
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
   1. MOTEUR — dette telle que la banque l'annonce
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                    // ── v33.30 : CRÉDIT RESTANT DÛ CALCULÉ ─────────────────────────────`,
String.raw`                    // ── v33.96 : DETTE AU SENS DE LA BANQUE ────────────────────────────
                    //   Classique  → capital restant dû
                    //   Mourabaha  → capital restant + marge non échue (le chiffre du relevé)
                    //   Le capital retenu est montant_credit, celui-là même que la colonne NET
                    //   déduit : total − marge = capital, l'affichage reste cohérent au dirham.
                    const detteBancaire = (asset) => {
                        const a = asset || {};
                        const capital = N(a.montant_credit);
                        const r2 = (v) => Math.round(v * 100) / 100;
                        if (capital <= 0) return { capital: 0, marge: 0, total: 0, estMourabaha: false };
                        if (String(a.type_credit) !== 'mourabaha' || N(a.duree_mois) <= 0) {
                            return { capital: r2(capital), marge: 0, total: r2(capital), estMourabaha: false };
                        }
                        const sa = soldeAnticipe(a, moisPayesEffectifs(a));
                        const marge = Math.max(0, N(sa.margeNonEchue));
                        return { capital: r2(capital), marge: r2(marge), total: r2(capital + marge), estMourabaha: true };
                    };

                    // ── v33.30 : CRÉDIT RESTANT DÛ CALCULÉ ─────────────────────────────`);

// Agrégat pour le pied de tableau (actifs retenus uniquement)
sub(
`                    const globalPatrimoineNet      = computed(() => globalValeurTotale.value - globalDetteTotale.value);`,
`                    const globalPatrimoineNet      = computed(() => globalValeurTotale.value - globalDetteTotale.value);
                    // v33.96 : dette telle qu'annoncée par les banques (marge non échue incluse)
                    const globalDetteBancaire = computed(() => {
                        const d = assetsInclus.value.map(detteBancaire);
                        return {
                            capital: Math.round(d.reduce((s, x) => s + x.capital, 0)),
                            marge:   Math.round(d.reduce((s, x) => s + x.marge, 0)),
                            total:   Math.round(d.reduce((s, x) => s + x.total, 0)),
                        };
                    });`);

sub(
`                        creditParams, creditRestantCalcule, moisEcoulesCredit, moisPayesEffectifs,`,
`                        creditParams, creditRestantCalcule, moisEcoulesCredit, moisPayesEffectifs,
                        detteBancaire, globalDetteBancaire,`);

/* ══════════════════════════════════════════════════════════════════════════
   2. TABLE — cellule Crédit restant
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                                            <td class="px-3 py-3 text-right text-rose-700 font-black bg-rose-50/40 whitespace-nowrap">{{ formatMAD(asset.montant_credit || 0) }}</td>`,
`                                            <td class="px-3 py-3 text-right bg-rose-50/40 whitespace-nowrap">
                                                <template v-for="d in [detteBancaire(asset)]" :key="'d'+asset.id">
                                                    <span class="text-rose-700 font-black">{{ formatMAD(d.total) }}</span>
                                                    <span v-if="d.estMourabaha && d.marge > 0" class="block text-[9px] font-bold text-gray-400 mt-0.5">dont {{ formatMAD(d.marge) }} de marge</span>
                                                </template>
                                            </td>`);

/* ══════════════════════════════════════════════════════════════════════════
   3. PIED DE TABLEAU — même logique
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                                            <td class="px-4 py-3 text-right font-black text-base text-rose-300 whitespace-nowrap">{{ formatMAD(globalDetteTotale) }}</td>`,
`                                            <td class="px-4 py-3 text-right whitespace-nowrap">
                                                <span class="font-black text-base text-rose-300">{{ formatMAD(globalDetteBancaire.total) }}</span>
                                                <span v-if="globalDetteBancaire.marge > 0" class="block text-[9px] font-bold text-white/50 mt-0.5">dont {{ formatMAD(globalDetteBancaire.marge) }} de marge</span>
                                            </td>`);

/* ── Rappel de méthode sous la synthèse chiffrée ─────────────────────────── */
sub(
`                                    <div>
                                        <p class="text-[9px] uppercase tracking-widest opacity-60 mb-1">Dette totale</p>
                                        <p class="text-base lg:text-lg font-black text-rose-300">{{ formatMAD(globalDetteTotale) }}</p>
                                    </div>`,
`                                    <div>
                                        <p class="text-[9px] uppercase tracking-widest opacity-60 mb-1">Dette totale</p>
                                        <p class="text-base lg:text-lg font-black text-rose-300">{{ formatMAD(globalDetteTotale) }}</p>
                                        <p v-if="globalDetteBancaire.marge > 0" class="text-[9px] opacity-60">capital pur · {{ formatMAD(globalDetteBancaire.total) }} au sens banque</p>
                                    </div>`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v33.96 appliquée');
