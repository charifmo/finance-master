/**
 * v34.11 — Correctif : le "Total" du badge Poids était NETTÉ, pas brut
 * ---------------------------------------------------------------------------
 * DIAGNOSTIC (confirmé en lisant statsFluxAnnee, pas supposé)
 *   netAnnuel = chocsSorties - chocsEntrees. chocsEntrees agrège les lignes de
 *   depensesIrregulieres à montant NÉGATIF ("Injection Banque" dans l'UI —
 *   remboursement, avance, entrée exceptionnelle). netAnnuel est donc un IMPACT
 *   NET sur l'année, pas la somme des chocs. C'était la bonne métrique pour le
 *   %/mois (impactSurplus, montantImpact) — mais la v34.10 l'a aussi affichée
 *   sous l'étiquette "Total", ce qui la fait paraître fausse dès qu'une seule
 *   injection compense une partie des dépenses (exactement le cas signalé :
 *   Top 3 seul = 46 500 DH, "Total" affiché = 11 300 DH).
 *
 * CORRECTIF — un total BRUT séparé, qui ne remplace rien
 *   Nouveau champ statsFluxAnnee.totalChocsAnnuel = somme des valeurs absolues
 *   de TOUTES les lignes de depensesIrregulieres de l'année affichée, dépenses
 *   ET injections confondues (formule fournie par le client, Math.abs pour
 *   couvrir les deux conventions de signe). Non filtré par le toggle "inclure
 *   long terme" : le panneau "Flux Exceptionnels" auquel on se compare ne
 *   filtre pas non plus (getDepensesMois / totalMoisAffichage).
 *   montantImpact et impactSurplus (le %/mois) restent calculés sur netAnnuel,
 *   inchangés — ce sont des mesures d'impact réel sur le surplus, pas des
 *   sommes de lignes, et le brief ne demande pas de les toucher.
 *
 * Badge : "⚠️ 942 DH/m · Total Chocs 46 500 DH (95%)"
 * ══════════════════════════════════════════════════════════════════════════
 */
import fs from 'node:fs';

const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => {
    const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) :\n${from.slice(0, 220)}`);
    s = s.split(from).join(to);
};

/* ── 1. État vide : nouveau champ par défaut ────────────────────────────── */
sub(
`                        if (!d) return { totalEntrees: 0, totalSorties: 0, netAnnuel: 0, surplusMensuelMoyen: 0, impactSurplus: 0, montantImpact: 0, top3Chocs: [] };`,
`                        if (!d) return { totalEntrees: 0, totalSorties: 0, netAnnuel: 0, totalChocsAnnuel: 0, surplusMensuelMoyen: 0, impactSurplus: 0, montantImpact: 0, top3Chocs: [] };`);

/* ── 2. Calcul du total brut, juste après le calcul netté existant ─────── */
sub(
`                        const netAnnuel = chocsSorties - chocsEntrees;`,
`                        const netAnnuel = chocsSorties - chocsEntrees;
                        // v34.11 : total BRUT (poids réel) — somme des valeurs absolues de
                        //   TOUTES les lignes de l'année, dépenses ET injections confondues.
                        //   Non filtré par _inclureLT : le panneau "Flux Exceptionnels" auquel
                        //   ce total doit correspondre au dirham près ne filtre pas non plus.
                        const totalChocsAnnuel = (Array.isArray(d.depensesIrregulieres) ? d.depensesIrregulieres : [])
                            .filter(c => Number(c.annee) === Number(anneeAffichage.value))
                            .reduce((sum, c) => sum + Math.abs(Number(c.montant) || 0), 0);`);

/* ── 3. Exposition dans le retour de la computed ────────────────────────── */
sub(
`                        return { totalEntrees, totalSorties, netAnnuel, surplusMensuelMoyen, impactSurplus, montantImpact, top3Chocs };`,
`                        return { totalEntrees, totalSorties, netAnnuel, totalChocsAnnuel, surplusMensuelMoyen, impactSurplus, montantImpact, top3Chocs };`);

/* ── 4. Badge : "Total" (netté) → "Total Chocs" (brut) ──────────────────── */
sub(
`                            <span v-if="statsFluxAnnee.impactSurplus > 0" :class="['text-[11px] font-black tabular-nums', statsFluxAnnee.impactSurplus > 50 ? 'text-rose-400' : 'text-orange-300']">⚠️ {{ formatMAD(statsFluxAnnee.montantImpact) }}/m · Total {{ formatMAD(statsFluxAnnee.netAnnuel) }} ({{ statsFluxAnnee.impactSurplus.toFixed(0) }}%)</span>`,
`                            <span v-if="statsFluxAnnee.impactSurplus > 0" :class="['text-[11px] font-black tabular-nums', statsFluxAnnee.impactSurplus > 50 ? 'text-rose-400' : 'text-orange-300']">⚠️ {{ formatMAD(statsFluxAnnee.montantImpact) }}/m · Total Chocs {{ formatMAD(statsFluxAnnee.totalChocsAnnuel) }} ({{ statsFluxAnnee.impactSurplus.toFixed(0) }}%)</span>`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v34.11 — totalChocsAnnuel (brut) ajouté, badge Poids corrigé');
