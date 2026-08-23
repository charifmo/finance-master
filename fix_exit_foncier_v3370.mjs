/**
 * v33.70 — L'Exit Simulator branché sur le moteur fiscal foncier
 * ---------------------------------------------------------------------------
 * Le panneau violet appliquait un forfait « frais_revente_pct » (3 %) sur les
 * terrains nus, en ignorant le moteur TPI / TNB / Semsar de la modale. Sur un
 * foncier, ce forfait n'a aucun sens : la TNB s'accumule chaque année et la
 * TPI obéit à la règle du plus élevé entre 20 % de la plus-value et 3 % du
 * prix de cession.
 *
 * Deux subtilités traitées :
 *  - la TNB PROJETÉE grossit avec l'horizon : annees_tnb + N ;
 *  - le prix d'acquisition revalorisé est lui aussi pris à l'année N
 *    (détention + N), sans quoi la plus-value taxable enflerait artificiellement
 *    avec le temps alors que le coefficient de réévaluation suit l'année de
 *    cession.
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
   1. exitSim — frais de sortie conditionnels
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                        // D — net vendeur
                        const fraisRevente = valeurRevente * (N(a.frais_revente_pct) / 100);
                        const netPoche = valeurRevente - fraisRevente - crd;`,
String.raw`                        // D — net vendeur
                        //   v33.70 : sur un terrain nu, le forfait « frais de revente »
                        //   cède la place aux frais réels — Semsar + TNB projetée + TPI.
                        const terrain = estTerrainNu(a);
                        let fraisRevente, semsar = 0, tnbProjetee = 0, tpi = 0, tpiDetail = null, revaloriseN = 0;
                        if (terrain) {
                            const qp = quotePartPct(a) / 100;
                            semsar = valeurRevente * (N(a.commission_semsar_pct) / 100);
                            // La TNB s'accumule : les années de retard grandissent avec l'horizon
                            tnbProjetee = N(a.arrieres_tnb) > 0
                                ? N(a.arrieres_tnb)
                                : N(a.surface_totale) * (N(a.pct_surface_taxable) / 100)
                                  * N(a.tarif_tnb_m2) * (N(a.annees_tnb) + An) * qp;
                            // Prix d'acquisition revalorisé À L'ANNÉE DE CESSION (détention + N)
                            const baseAcq = N(a.prix_acquisition) || N(a.value);
                            revaloriseN = baseAcq * Math.pow(1 + N(a.taux_revalorisation) / 100, anneesDetention(a) + An);
                            tpiDetail = tpiCalculee(valeurRevente, revaloriseN);
                            tpi = N(a.provision_tpi) > 0 ? N(a.provision_tpi) : tpiDetail.montant;
                            fraisRevente = semsar + tnbProjetee + tpi;
                        } else {
                            fraisRevente = valeurRevente * (N(a.frais_revente_pct) / 100);
                        }
                        const netPoche = valeurRevente - fraisRevente - crd;`);

sub(
`                        return {
                            annee: An,
                            valeurRevente: r0(valeurRevente),
                            plusValueLatente: r0(valeurRevente - base),
                            fraisRevente: r0(fraisRevente),`,
`                        return {
                            annee: An,
                            estTerrain: terrain,
                            valeurRevente: r0(valeurRevente),
                            plusValueLatente: r0(valeurRevente - base),
                            fraisRevente: r0(fraisRevente),
                            semsar: r0(semsar), tnb: r0(tnbProjetee), tpi: r0(tpi),
                            tpiDetail, revaloriseN: r0(revaloriseN),
                            tnbManuelle: N(a.arrieres_tnb) > 0, tpiManuelle: N(a.provision_tpi) > 0,`);

/* ══════════════════════════════════════════════════════════════════════════
   2. TEMPLATE — bloc A détaillé pour le foncier
   ══════════════════════════════════════════════════════════════════════════ */
const OLD = `\${p}                <p class="text-[9px] font-bold text-teal-500">+{{ formatMAD(sim.plusValueLatente) }} de revalorisation · −{{ formatMAD(sim.fraisRevente) }} de frais</p>`;
const NEW = `\${p}                <p v-if="!sim.estTerrain" class="text-[9px] font-bold text-teal-500">+{{ formatMAD(sim.plusValueLatente) }} de revalorisation · −{{ formatMAD(sim.fraisRevente) }} de frais</p>
\${p}                <p v-else class="text-[9px] font-bold text-teal-500 leading-tight">
\${p}                    +{{ formatMAD(sim.plusValueLatente) }} de revalorisation ({{ asset.taux_revalorisation }} %/an)<br/>
\${p}                    − {{ formatMAD(sim.semsar) }} Semsar
\${p}                    · − {{ formatMAD(sim.tnb) }} TNB<span v-if="!sim.tnbManuelle"> ({{ (asset.annees_tnb || 0) + sim.annee }} ans)</span>
\${p}                    · − {{ formatMAD(sim.tpi) }} TPI<span v-if="sim.tpiDetail && !sim.tpiManuelle"> ({{ sim.tpiDetail.regle }})</span><br/>
\${p}                    <span class="text-teal-400">soit {{ formatMAD(sim.fraisRevente) }} de frais réels</span>
\${p}                </p>`;

// Le panneau est généré deux fois (carte productive + ligne dépliable) : on
// remplace le rendu final dans le HTML, pas le gabarit du script de patch.
const OLD_HTML = `<p class="text-[9px] font-bold text-teal-500">+{{ formatMAD(sim.plusValueLatente) }} de revalorisation · −{{ formatMAD(sim.fraisRevente) }} de frais</p>`;
const c = s.split(OLD_HTML).length - 1;
if (c !== 2) throw new Error('bloc A attendu 2 fois, trouvé ' + c);
s = s.split(OLD_HTML).join(
`<p v-if="!sim.estTerrain" class="text-[9px] font-bold text-teal-500">+{{ formatMAD(sim.plusValueLatente) }} de revalorisation · −{{ formatMAD(sim.fraisRevente) }} de frais</p>
                                        <p v-else class="text-[9px] font-bold text-teal-500 leading-tight">
                                            +{{ formatMAD(sim.plusValueLatente) }} de revalorisation ({{ asset.taux_revalorisation }} %/an)<br/>
                                            − {{ formatMAD(sim.semsar) }} Semsar · − {{ formatMAD(sim.tnb) }} TNB<span v-if="!sim.tnbManuelle"> ({{ (asset.annees_tnb || 0) + sim.annee }} ans)</span> · − {{ formatMAD(sim.tpi) }} TPI<span v-if="sim.tpiDetail && !sim.tpiManuelle"> ({{ sim.tpiDetail.regle }})</span><br/>
                                            <span class="text-teal-400">soit {{ formatMAD(sim.fraisRevente) }} de frais réels</span>
                                        </p>`);

/* Le libellé B n'a pas de sens sans crédit : on le masque pour un terrain sans dette */
const OLD_B = `<p class="text-[9px] font-black uppercase tracking-widest text-rose-600">B · {{ sim.estMourabaha ? 'Solde de rachat' : 'Capital restant dû' }}</p>`;
const cb = s.split(OLD_B).length - 1;
if (cb !== 2) throw new Error('libellé B attendu 2 fois, trouvé ' + cb);
s = s.split(OLD_B).join(`<p class="text-[9px] font-black uppercase tracking-widest text-rose-600">B · {{ sim.estMourabaha ? 'Solde de rachat' : 'Capital restant dû' }}</p>`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v33.70 exit simulator foncier appliqué');
