/**
 * v34.00 — Le surplus moyen n'inclut plus le mois en cours
 * ---------------------------------------------------------------------------
 * Le mois en cours est calculé en mode « remaining » : les charges déjà tombées
 * en sont retirées mais le salaire à venir aussi, si bien qu'il affiche un
 * déficit d'atterrissage. L'inclure dans une MOYENNE PRÉVISIONNELLE mélange un
 * solde de fin de mois avec des potentiels mensuels pleins, et plombe le KPI.
 *
 * Nouvelle base de moyenne :
 *   année en cours  → mois strictement futurs [moisActuel + 1 … 12]
 *   autre année     → les 12 mois (rien n'est « en cours »)
 *   filet de sécurité : en décembre il ne reste aucun mois futur, on retombe
 *   alors sur le mois en cours plutôt que d'afficher 0.
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
   1. BASE DE MOYENNE COMMUNE
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                    const surplusMensuelBase = computed(() => {
                        // v27.50 : moyenne sur surplusMensuel (flux net mensuel, non cumulatif)
                        const arr = surplusParMois.value.filter(r => !r.isPast);
                        if (!arr.length) return 0;
                        return arr.reduce((s, r) => s + r.surplusMensuel, 0) / arr.length;
                    });
                    const surplusStats = computed(() => {
                        // v27.50 : moyNet basé sur surplusMensuel (flux mensuel) — net est cumulatif
                        const arr = surplusParMois.value.filter(r => !r.isPast);
                        if (!arr.length) return { moyBrut: 0, moyEpargne: 0, moyNet: 0 };
                        const n = arr.length;
                        return {
                            moyBrut:    arr.reduce((s, r) => s + r.brut, 0) / n,
                            moyEpargne: arr.reduce((s, r) => s + r.epargne, 0) / n,
                            moyNet:     arr.reduce((s, r) => s + r.surplusMensuel, 0) / n,
                        };
                    });`,
String.raw`                    // ── v34.00 : assiette de la moyenne prévisionnelle ─────────────────
                    //   Le mois en cours est un ATTERRISSAGE (charges déjà payées retirées,
                    //   salaire à venir compté) : le moyenner avec des mois théoriques pleins
                    //   n'a pas de sens et creuse artificiellement le KPI.
                    const surplusMoisMoyennes = computed(() => {
                        const arr = surplusParMois.value || [];
                        const futurs = arr.filter(r => !r.isPast && !r.isCurrent);
                        if (futurs.length) return futurs;
                        // décembre : plus aucun mois futur → on retombe sur le mois en cours
                        const restants = arr.filter(r => !r.isPast);
                        return restants.length ? restants : arr;
                    });
                    // Vrai si la moyenne exclut effectivement le mois courant (pour le libellé)
                    const surplusMoyenneHorsMoisCourant = computed(() =>
                        (surplusParMois.value || []).some(r => r.isCurrent) &&
                        !surplusMoisMoyennes.value.some(r => r.isCurrent));

                    const surplusMensuelBase = computed(() => {
                        const arr = surplusMoisMoyennes.value;
                        if (!arr.length) return 0;
                        return arr.reduce((s, r) => s + r.surplusMensuel, 0) / arr.length;
                    });
                    const surplusStats = computed(() => {
                        const arr = surplusMoisMoyennes.value;
                        if (!arr.length) return { moyBrut: 0, moyEpargne: 0, moyNet: 0, nbMois: 0 };
                        const n = arr.length;
                        return {
                            moyBrut:    arr.reduce((s, r) => s + r.brut, 0) / n,
                            moyEpargne: arr.reduce((s, r) => s + r.epargne, 0) / n,
                            moyNet:     arr.reduce((s, r) => s + r.surplusMensuel, 0) / n,
                            nbMois: n,
                        };
                    });`);

sub(
`                        surplusMensuelBase, surplusParMois, surplusStats, showSurplusTooltip,`,
`                        surplusMensuelBase, surplusParMois, surplusStats, showSurplusTooltip,
                        surplusMoisMoyennes, surplusMoyenneHorsMoisCourant,`);

/* ══════════════════════════════════════════════════════════════════════════
   2. LIBELLÉS — desktop puis mobile
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                                    <span class="text-[8px] font-black uppercase text-gray-400">Moy.</span>`,
`                                    <span class="text-[8px] font-black uppercase text-gray-400" :title="surplusMoyenneHorsMoisCourant ? 'Moyenne sur les ' + surplusStats.nbMois + ' mois strictement futurs — le mois en cours est un atterrissage, pas un potentiel mensuel.' : null">
                                        Moy.<span v-if="surplusMoyenneHorsMoisCourant" class="normal-case tracking-normal"> (hors mois en cours)</span>
                                    </span>`);

sub(
`                                <span class="text-[7px] font-black uppercase text-gray-400">Moy.</span>`,
`                                <span class="text-[7px] font-black uppercase text-gray-400">Moy.<span v-if="surplusMoyenneHorsMoisCourant" class="normal-case"> (futur)</span></span>`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v34.00 appliquée');
