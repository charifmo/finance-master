/**
 * v33.93 — Trois correctifs de logique sur l'Exit Simulator foncier
 * ---------------------------------------------------------------------------
 *  1. TAUX DE REVALORISATION — le moteur lit bien actif.taux_revalorisation
 *     (vérifié : 3 % sur un terrain de test produit 1,03^N). Si le panneau
 *     affiche 1 %/an, c'est la valeur STOCKÉE qui vaut 1. Le taux devient donc
 *     éditable directement dans l'en-tête du panneau : on voit et on corrige
 *     sur place, sans passer par la modale.
 *
 *  2. TNB — fin de la rétroactivité aveugle. L'ancienne formule multipliait le
 *     tarif par (annees_tnb + N), ce qui faisait grossir le passé en même temps
 *     que l'horizon. Désormais :
 *         TNB(N) = passif actuel + TNB annuelle × N
 *     Le passif actuel est le montant saisi (arrieres_tnb) ou, à défaut,
 *     l'estimation issue de annees_tnb. Seule la partie « à venir » suit N.
 *
 *  3. BLOC D — un actif non productif (terrain nu, jouissance) n'a pas de
 *     « performance » à juger : encaisser du cash n'est pas une perte. Le
 *     verdict rouge/vert disparaît au profit d'un bandeau neutre
 *     « Cash net vendeur après impôts ». Le bloc C est relibellé « Capital
 *     immobilisé » : sur un héritage, l'apport n'est pas un effort de trésorerie.
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
   1 + 2. MOTEUR — TNB non rétroactive, décomposition exposée
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                            semsar = valeurRevente * (N(a.commission_semsar_pct) / 100);
                            // La TNB s'accumule : les années de retard grandissent avec l'horizon
                            tnbProjetee = N(a.arrieres_tnb) > 0
                                ? N(a.arrieres_tnb)
                                : N(a.surface_totale) * (N(a.pct_surface_taxable) / 100)
                                  * N(a.tarif_tnb_m2) * (N(a.annees_tnb) + An) * qp;`,
`                            semsar = valeurRevente * (N(a.commission_semsar_pct) / 100);
                            // v33.93 : TNB = passif ACTUEL + taxe générée pendant la simulation.
                            //   Le passif actuel ne dépend pas de l'horizon : un terrain agricole
                            //   n'a pas payé de TNB depuis son acquisition. Seule la part « à
                            //   venir » suit N.
                            tnbAnnuelle = N(a.surface_totale) * (N(a.pct_surface_taxable) / 100)
                                          * N(a.tarif_tnb_m2) * qp;
                            tnbPassif = N(a.arrieres_tnb) > 0 ? N(a.arrieres_tnb) : tnbAnnuelle * N(a.annees_tnb);
                            tnbProjetee = tnbPassif + tnbAnnuelle * An;`);

sub(
`                        let fraisRevente, semsar = 0, tnbProjetee = 0, tpi = 0, tpiDetail = null, revaloriseN = 0;`,
`                        let fraisRevente, semsar = 0, tnbProjetee = 0, tpi = 0, tpiDetail = null, revaloriseN = 0;
                        let tnbAnnuelle = 0, tnbPassif = 0;`);

sub(
`                            semsar: r0(semsar), tnb: r0(tnbProjetee), tpi: r0(tpi),`,
`                            semsar: r0(semsar), tnb: r0(tnbProjetee), tpi: r0(tpi),
                            tnbAnnuelle: r0(tnbAnnuelle), tnbPassif: r0(tnbPassif),`);

/* ══════════════════════════════════════════════════════════════════════════
   3. PANNEAU — taux éditable, TNB détaillée, bloc D neutre
   ══════════════════════════════════════════════════════════════════════════ */
// En-tête : le taux devient un champ
sub(
`                                                    <p class="text-[10px] opacity-80">Revalo {{ asset.taux_revalorisation }} %/an · {{ sim.estTerrain ? 'frais réels : Semsar + TNB + TPI' : 'frais de sortie ' + asset.frais_revente_pct + ' %' }}</p>`,
`                                                    <p class="text-[10px] opacity-80 flex items-center gap-1.5">
                                                        <span>Revalo</span>
                                                        <input type="number" v-model.number="asset.taux_revalorisation" @change="handleDataChange" min="-20" max="30" step="0.5"
                                                               class="w-14 bg-white/20 border border-white/30 rounded px-1 py-0.5 text-[11px] font-black text-white text-right outline-none focus:bg-white/30"/>
                                                        <span>%/an · {{ sim.estTerrain ? 'frais réels : Semsar + TNB + TPI' : 'frais de sortie ' + asset.frais_revente_pct + ' %' }}</span>
                                                    </p>`);

// Détail TNB dans le bloc A
sub(
`                                                                − {{ formatMAD(sim.semsar) }} Semsar · − {{ formatMAD(sim.tnb) }} TNB<span v-if="!sim.tnbManuelle"> ({{ (asset.annees_tnb || 0) + sim.annee }} ans)</span> · − {{ formatMAD(sim.tpi) }} TPI<span v-if="sim.tpiDetail && !sim.tpiManuelle"> ({{ sim.tpiDetail.regle }})</span><br/>`,
`                                                                − {{ formatMAD(sim.semsar) }} Semsar
                                                                · − {{ formatMAD(sim.tnb) }} TNB<span v-if="sim.tnbAnnuelle"> ({{ formatMAD(sim.tnbPassif) }} de passif + {{ formatMAD(sim.tnbAnnuelle) }}/an × {{ sim.annee }})</span>
                                                                · − {{ formatMAD(sim.tpi) }} TPI<span v-if="sim.tpiDetail && !sim.tpiManuelle"> ({{ sim.tpiDetail.regle }})</span><br/>`);

// Bloc C : libellé adapté aux actifs non productifs
sub(
`                                                            <p class="text-[9px] font-black uppercase tracking-widest text-indigo-600">C · Cash sorti (effort)</p>`,
`                                                            <p class="text-[9px] font-black uppercase tracking-widest text-indigo-600">C · {{ asset.isProductive ? 'Cash sorti (effort)' : 'Capital immobilisé' }}</p>`);

// Bloc D : verdict seulement pour les actifs productifs
sub(
`                                                    <div :class="['p-4 rounded-2xl text-white', sim.gagnant ? 'bg-gradient-to-r from-emerald-600 to-teal-700' : 'bg-gradient-to-r from-rose-600 to-red-700']">
                                                        <p class="text-[10px] font-black uppercase tracking-widest opacity-75">D · Net dans la poche</p>
                                                        <p class="text-3xl font-black tabular-nums leading-tight">{{ formatMAD(sim.netPoche) }}</p>
                                                        <p class="text-[11px] font-bold opacity-90 mt-1">
                                                            {{ sim.gagnant ? '✅ Supérieur au cash sorti' : '⚠️ Inférieur au cash sorti' }}
                                                            de <span class="font-black">{{ formatMAD(Math.abs(sim.gain)) }}</span>
                                                        </p>
                                                    </div>`,
`                                                    <div :class="['p-4 rounded-2xl text-white', !asset.isProductive ? 'bg-gradient-to-r from-emerald-600 to-teal-700' : (sim.gagnant ? 'bg-gradient-to-r from-emerald-600 to-teal-700' : 'bg-gradient-to-r from-rose-600 to-red-700')]">
                                                        <p class="text-[10px] font-black uppercase tracking-widest opacity-75">D · {{ asset.isProductive ? 'Net dans la poche' : 'Cash net vendeur après impôts' }}</p>
                                                        <p class="text-3xl font-black tabular-nums leading-tight">{{ formatMAD(sim.netPoche) }}</p>
                                                        <!-- Le verdict n'a de sens que sur un actif d'investissement : encaisser
                                                             le prix d'un héritage n'est ni un gain ni une perte de gestion. -->
                                                        <p v-if="asset.isProductive" class="text-[11px] font-bold opacity-90 mt-1">
                                                            {{ sim.gagnant ? '✅ Supérieur au cash sorti' : '⚠️ Inférieur au cash sorti' }}
                                                            de <span class="font-black">{{ formatMAD(Math.abs(sim.gain)) }}</span>
                                                        </p>
                                                        <p v-else class="text-[11px] font-bold opacity-90 mt-1">
                                                            Encaissé à la vente en année {{ sim.annee }}, après {{ formatMAD(sim.fraisRevente) }} de frais<span v-if="sim.crd"> et remboursement de {{ formatMAD(sim.crd) }}</span>.
                                                        </p>
                                                    </div>`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v33.93 appliquée');
