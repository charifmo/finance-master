/**
 * v35.4 — HARMONISATION DES PARAMÈTRES CONTRACTUELS DU STUDIO GUÉLIZ
 * ═══════════════════════════════════════════════════════════════════════════
 * Le modèle de l'onglet (studioCalc) est :
 *     prixTotal   = prixM2 x surface
 *     restePromot = prixTotal - avance
 *     CAPITAL     = restePromoteur + taxCouvertCredit + surplusCredit
 *     traite      = annuite(CAPITAL, taux/12, duree x 12) + assuranceMensuelle
 * Vérifié au dirham près contre la capture fournie : 1 092 000 / 592 000 /
 * 767 000 / 5 416 / 105 240. Le capital n'est donc PAS un champ libre : il est
 * déduit. Toute valeur cible doit être atteinte par les entrées.
 *
 * RÉCONCILIATION DES 4 CHIFFRES CONTRACTUELS
 *   1 092 000 = 26 000 x 42                                   -> surface 40 -> 42
 *     765 560 = 592 000 + 43 560 + 130 000                    -> taxes crédit 45 000 -> 43 560
 *       5 445 = annuite(765 560; 5,218 %; 20 ans) + 300       -> taux 4,7 -> 5,218 ; assur 480 -> 300
 *     346 680 = 500 000 - 130 000 - 23 320                    -> nouveau champ restitutionPromoteur
 *
 * POURQUOI "Avance payée" RESTE À 500 000 ET NON 346 680
 *   346 680 est un EFFORT NET, pas le versement au promoteur. La chaîne se
 *   recoupe exactement avec les mots du client : 500 000 versés - 130 000 de
 *   reliquat crédit = 370 000 "décaissés", - 23 320 de chèque de restitution
 *   = 346 680 "net". Saisir 346 680 dans le champ "Avance payée" porterait le
 *   reste promoteur à 745 320 et le CAPITAL à 920 320 DH — soit l'inverse de
 *   la demande. Le montant validé est donc affiché comme ligne DÉRIVÉE
 *   ("Apport Personnel Net"), au bon endroit et sans casser le calcul.
 * ═══════════════════════════════════════════════════════════════════════════
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

/* ── 1. Valeurs par défaut ────────────────────────────────────────────────── */
sub(
`                    const getDefaultProjetStudio = () => ({ prixM2: 26000, surface: 40, avance: 500000, taux: 4.5, duree: 20, taxSyndic: 70240, taxCouvertCredit: 45000, surplusCredit: 85000, assuranceMensuelle: 380, travaux: 80000, epargneDispo: 53000, compteSourceCash: 'courant' });`,
[`                    // v35.4 : valeurs contractuelles Studio Guéliz (Bank Assafa, Mourabaha).`,
 `                    //   surface 42 m2 x 26 000 = 1 092 000 ; capital 592 000 + 43 560 + 130 000`,
 `                    //   = 765 560 ; traite 5 145 + 300 d'assurance = 5 445 DH/mois sur 20 ans.`,
 `                    //   taux 5,218 % = taux IMPLICITE du contrat, voir le commentaire de studioCalc.`,
 `                    const getDefaultProjetStudio = () => ({ prixM2: 26000, surface: 42, avance: 500000, taux: 5.218, duree: 20, taxSyndic: 70240, taxCouvertCredit: 43560, surplusCredit: 130000, assuranceMensuelle: 300, travaux: 80000, epargneDispo: 53000, compteSourceCash: 'courant', restitutionPromoteur: 23320 });`,
].join('\n'));

/* ── 2. studioCalc : apport personnel net dérivé ──────────────────────────── */
sub(
`                        return { prixTotal: prixHT, restePromoteur: resteP, capitalEmprunte: cap, mensualite: mens, totalMensuel: mens + assur, coutTotalCredit: (mens*n)-cap, cashRequis: cashReq, cashRestant: (Number(p.epargneDispo)||0)+s-cashReq, surplus: s };`,
[`                        // v35.4 : apportNet = ce qui sort RÉELLEMENT de la poche.`,
 `                        //   L'avance versée au promoteur n'est pas l'effort personnel : le reliquat`,
 `                        //   débloqué par la banque revient en trésorerie, et le promoteur restitue`,
 `                        //   un chèque. 500 000 - 130 000 - 23 320 = 346 680 DH.`,
 `                        const apportNet = (Number(p.avance)||0) - s - (Number(p.restitutionPromoteur)||0);`,
 `                        return { prixTotal: prixHT, restePromoteur: resteP, capitalEmprunte: cap, mensualite: mens, totalMensuel: mens + assur, coutTotalCredit: (mens*n)-cap, cashRequis: cashReq, cashRestant: (Number(p.epargneDispo)||0)+s-cashReq, surplus: s, apportNet };`,
].join('\n'));

/* ── 3. Template : prix total, restitution, apport net ────────────────────── */
sub(
`                                    <div class="flex justify-between font-black pt-4 border-t text-gray-800"><span class="uppercase">Reste Promoteur</span><span class="text-lg">{{ formatMAD(studioCalc.restePromoteur) }}</span></div>`,
[`                                    <div class="flex justify-between items-center"><span class="text-sm font-bold text-gray-600">Restitution promoteur</span><div class="flex items-center gap-2"><input type="number" v-model.number="projetStudio.restitutionPromoteur" @input="handleDataChange" class="w-28 text-right p-2 border rounded-lg font-bold bg-gray-50 outline-none"/><span class="text-xs text-gray-400">DH</span></div></div>`,
 `                                    <div class="flex justify-between pt-4 border-t text-gray-500"><span class="uppercase tracking-widest text-[10px] font-black pt-1">Prix Total Bien</span><span class="text-sm font-bold tabular-nums whitespace-nowrap">{{ formatMAD(studioCalc.prixTotal) }}</span></div>`,
 `                                    <div class="flex justify-between font-black text-gray-800"><span class="uppercase">Reste Promoteur</span><span class="text-lg tabular-nums whitespace-nowrap">{{ formatMAD(studioCalc.restePromoteur) }}</span></div>`,
 `                                    <!-- v35.4 : effort personnel net — dérivé, jamais saisi (voir fix_studio_contrat_v3540.mjs) -->`,
 `                                    <div class="flex justify-between items-baseline pt-3 border-t"><span class="uppercase font-black text-indigo-700 text-sm">Apport Personnel Net</span><span class="text-lg font-black text-indigo-700 tabular-nums whitespace-nowrap">{{ formatMAD(studioCalc.apportNet) }}</span></div>`,
 `                                    <p class="text-[10px] text-gray-400 italic leading-snug">Avance {{ formatMAD(projetStudio.avance) }} − reliquat crédit {{ formatMAD(projetStudio.surplusCredit) }} = {{ formatMAD((projetStudio.avance||0) - (projetStudio.surplusCredit||0)) }} décaissés, moins la restitution {{ formatMAD(projetStudio.restitutionPromoteur) }}.</p>`,
].join('\n'));

/* ── 4. Migration one-shot des exercices déjà enregistrés ─────────────────── */
sub(
`                    const migrateCategoriesV22 = () => {`,
[`                    // ═══════════════════════════════════════════════════════════════════`,
 `                    // v35.4 — ALIGNEMENT DES EXERCICES DÉJÀ ENREGISTRÉS`,
 `                    //   Changer getDefaultProjetStudio() ne suffit PAS : projetStudio est`,
 `                    //   stocké par année dans donneesAnnuelles, et executerImportFusion fait`,
 `                    //   safeMerge(defauts, donneesSauvegardees) — la valeur enregistrée gagne`,
 `                    //   toujours. Sans cette migration, l'écran continuerait d'afficher`,
 `                    //   767 000 DH et 5 416 DH/mois malgré les nouveaux défauts.`,
 `                    //`,
 `                    //   ONE-SHOT, PAS UN FORÇAGE PERMANENT : le drapeau _studioContratV354`,
 `                    //   est persisté dans soldesInitiaux. Réécrire ces champs à chaque`,
 `                    //   chargement rendrait le formulaire non éditable — on corrige une fois,`,
 `                    //   puis l'utilisateur en reprend la main.`,
 `                    // ═══════════════════════════════════════════════════════════════════`,
 `                    const CONTRAT_STUDIO_V354 = { prixM2: 26000, surface: 42, avance: 500000, taxCouvertCredit: 43560, surplusCredit: 130000, taux: 5.218, duree: 20, assuranceMensuelle: 300, restitutionPromoteur: 23320 };`,
 `                    const migrateStudioContratV354 = () => {`,
 `                        try {`,
 `                            const si = soldesInitiaux.value;`,
 `                            if (!si || typeof si !== 'object' || si._studioContratV354) return;`,
 `                            let n = 0;`,
 `                            Object.values(donneesAnnuelles.value || {}).forEach(d => {`,
 `                                if (!d || typeof d !== 'object') return;`,
 `                                if (!d.projetStudio || typeof d.projetStudio !== 'object') d.projetStudio = getDefaultProjetStudio();`,
 `                                Object.assign(d.projetStudio, CONTRAT_STUDIO_V354);`,
 `                                n++;`,
 `                            });`,
 `                            si._studioContratV354 = true;`,
 `                            if (n) addLog('✅ v35.4 : Studio aligné sur le contrat Bank Assafa (' + n + ' exercice(s)) — 765 560 DH empruntés, 5 445 DH/mois.', 'success');`,
 `                        } catch (e) { addLog('v35.4 : harmonisation Studio ignorée (' + e.message + ')', 'warn'); }`,
 `                    };`,
 ``,
 `                    const migrateCategoriesV22 = () => {`,
].join('\n'));

sub(
`                            migrateCategoriesV22();
                            forceUpdateCalculations();`,
`                            migrateCategoriesV22();
                            migrateStudioContratV354(); // v35.4 : paramètres contractuels du Studio
                            forceUpdateCalculations();`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v35.4 — Studio aligné sur le contrat (capital 765 560, traite 5 445)');
