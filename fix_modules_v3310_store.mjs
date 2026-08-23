/**
 * v33.10 — Store des modules restants
 *   BUG 3 : Projet Studio — exploitation (12 mois, scénarios, comparateur, seuil)
 *   BUG 4 : wealthGoals — schéma complet + projection + indépendance financière
 *   BUG 5 : arbitrage Rembourser vs Placer — Mourabaha, Ibra'a, DH constants,
 *           économie d'impôt perdue
 *   + Tableau de bord Indépendance Financière
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
   BUG 4 — wealthGoals : schéma complet + migration du format legacy
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                    const wealthGoals = ref([
                        { name: 'Voyage Paris/Amsterdam', target: 40000, current: 15000 },
                        { name: 'Etudes Jlilou', target: 200000, current: 45000 }
                    ]);`,
String.raw`                    // ── v33.10 : objectifs patrimoniaux (schéma complet) ───────────────
                    //   legacy { name, target, current } → { libelle, montant_cible, … }
                    const migrateGoalV19 = (g) => {
                        const o = g || {};
                        const cible = Number(o.montant_cible != null ? o.montant_cible : o.target) || 0;
                        const actuel = Number(o.montant_actuel != null ? o.montant_actuel : o.current) || 0;
                        return {
                            id: o.id || ('wg_' + Math.random().toString(36).slice(2, 9)),
                            libelle: o.libelle || o.name || 'Objectif',
                            type: o.type || 'libre',           // fonds_urgence | apport | independance_financiere | libre
                            montant_cible: cible,
                            date_cible: o.date_cible || '',    // 'AAAA-MM'
                            montant_actuel: actuel,
                            versement_mensuel: Number(o.versement_mensuel) || 0,
                            comptesLies: Array.isArray(o.comptesLies) ? o.comptesLies : [],
                            // rétrocompatibilité export : on garde les clés historiques
                            name: o.libelle || o.name || 'Objectif',
                            target: cible,
                            current: actuel,
                        };
                    };
                    const migrateGoalsV19 = (arr) => (Array.isArray(arr) ? arr : []).map(migrateGoalV19);

                    const wealthGoals = ref(migrateGoalsV19([
                        { name: 'Voyage Paris/Amsterdam', target: 40000, current: 15000, versement_mensuel: 1500 },
                        { name: 'Etudes Jlilou', target: 200000, current: 45000, versement_mensuel: 2000 }
                    ]));`);

/* ══════════════════════════════════════════════════════════════════════════
   Bloc de calcul : objectifs, indépendance financière, arbitrage, studio
   Inséré après studioCalc.
   ══════════════════════════════════════════════════════════════════════════ */
const BLOC = String.raw`
                    // ═══════════════════════════════════════════════════════════════════
                    // v33.10 — OBJECTIFS PATRIMONIAUX
                    //   progression, date d'atteinte au rythme actuel, écart vs cible,
                    //   versement nécessaire pour tenir la date cible.
                    // ═══════════════════════════════════════════════════════════════════
                    const _moisEntre = (dateStr) => {
                        if (!dateStr) return null;
                        const p = String(dateStr).split('-').map(Number);
                        if (!p[0]) return null;
                        const now = new Date();
                        return (p[0] - now.getFullYear()) * 12 + ((p[1] || 12) - (now.getMonth() + 1));
                    };
                    const _labelDateDansNMois = (n) => {
                        if (n === null || !Number.isFinite(n) || n < 0) return '—';
                        const d = new Date();
                        d.setMonth(d.getMonth() + Math.ceil(n));
                        const mn = ['Janv','Févr','Mars','Avr','Mai','Juin','Juil','Août','Sept','Oct','Nov','Déc'];
                        return mn[d.getMonth()] + ' ' + d.getFullYear();
                    };

                    const wealthGoalsCalc = computed(() => {
                        calculationTick.value;
                        return (wealthGoals.value || []).map(gRaw => {
                            const g = migrateGoalV19(gRaw);
                            // Un objectif peut être adossé à des comptes réels
                            let actuel = N(g.montant_actuel);
                            if (g.comptesLies.length) {
                                actuel = (comptes.value || [])
                                    .filter(c => g.comptesLies.includes('cpt_' + c.id))
                                    .reduce((s, c) => s + N(c.solde), 0);
                            }
                            const cible = N(g.montant_cible);
                            const reste = Math.max(0, cible - actuel);
                            const vers = N(g.versement_mensuel);
                            const progression = cible > 0 ? Math.min(100, (actuel / cible) * 100) : 0;
                            const moisNecessaires = vers > 0 ? reste / vers : null;
                            const moisJusquaCible = _moisEntre(g.date_cible);
                            const versementRequis = (moisJusquaCible && moisJusquaCible > 0) ? reste / moisJusquaCible : null;
                            return {
                                ...g, montant_actuel: actuel, reste,
                                progression: Math.round(progression * 10) / 10,
                                moisNecessaires,
                                dateProjetee: _labelDateDansNMois(moisNecessaires),
                                moisJusquaCible,
                                // écart : positif = en retard de N mois sur la date cible
                                ecartMois: (moisNecessaires !== null && moisJusquaCible !== null)
                                    ? Math.round(moisNecessaires - moisJusquaCible) : null,
                                versementRequis: versementRequis !== null ? Math.round(versementRequis) : null,
                                atteint: reste <= 0,
                            };
                        });
                    });

                    const addWealthGoal = () => {
                        wealthGoals.value.push(migrateGoalV19({ libelle: 'Nouvel objectif', type: 'libre', montant_cible: 10000, montant_actuel: 0, versement_mensuel: 0 }));
                        handleDataChange();
                    };
                    // Synchronise les alias legacy (name/target/current) à chaque édition
                    const syncGoalLegacy = (g) => { g.name = g.libelle; g.target = N(g.montant_cible); g.current = N(g.montant_actuel); handleDataChange(); };

                    // ═══════════════════════════════════════════════════════════════════
                    // v33.10 — INDÉPENDANCE FINANCIÈRE
                    //   couverture = revenus passifs nets / dépenses hors crédits
                    // ═══════════════════════════════════════════════════════════════════
                    const depensesHorsCreditsMensuel = computed(() => {
                        calculationTick.value;
                        const d = donneesAnnuelles.value[anneeAffichage.value] || {};
                        const fixesHorsCredit = Object.entries(d.chargesFixes || {})
                            .filter(([k]) => !k.startsWith('credit'))
                            .reduce((s, [, f]) => s + N(f.valeur), 0);
                        const variables = Object.values(d.chargesVariables || {})
                            .reduce((s, c) => s + (c.periode === 'semaine' ? N(c.valeur) * 4.3 : N(c.valeur)), 0);
                        return Math.round((fixesHorsCredit + variables) * 100) / 100;
                    });
                    const mensualitesCreditsMensuel = computed(() => {
                        calculationTick.value;
                        const d = donneesAnnuelles.value[anneeAffichage.value] || {};
                        return Object.entries(d.chargesFixes || {})
                            .filter(([k]) => k.startsWith('credit'))
                            .reduce((s, [, f]) => s + N(f.valeur), 0);
                    });
                    const salaireMensuel = computed(() => {
                        calculationTick.value;
                        const d = donneesAnnuelles.value[anneeAffichage.value] || {};
                        return Object.values(d.revenus || {}).reduce((s, r) => s + N(r.base), 0);
                    });

                    // Scénario paramétrable de revenus passifs
                    const _passifsScenario = (opts) => (masterAssets.value || [])
                        .filter(a => a.isProductive)
                        .reduce((s, a) => {
                            const src = opts && opts.sansCredit
                                ? Object.assign({}, a, { montant_credit: 0, mensualite: 0, assurance_mensuelle: 0 })
                                : a;
                            return s + assetEconomics(src, 0, opts || {}).cashflowNet;
                        }, 0) / 12;

                    const independanceFinanciere = computed(() => {
                        calculationTick.value;
                        const dep = depensesHorsCreditsMensuel.value;
                        const mens = mensualitesCreditsMensuel.value;
                        const base = revenusPassifsNetsMensuel.value;
                        const tx = (r, d) => d > 0 ? Math.round((r / d) * 1000) / 10 : 0;
                        const scen = {
                            aujourdhui:        { label: 'Aujourd\'hui',                    revenus: base,                                   depenses: dep + mens },
                            horsCredits:       { label: 'Dépenses hors crédits',           revenus: base,                                   depenses: dep },
                            creditsRembourses: { label: 'Après remboursement des crédits', revenus: _passifsScenario({ sansCredit: true }),  depenses: dep },
                            avecSalaire:       { label: 'Avec salaire',                    revenus: base + salaireMensuel.value,            depenses: dep + mens },
                            stress:            { label: 'Stress : −20 % loyers, 6 mois de vacance', revenus: _passifsScenario({ loyerFactor: 0.8, occFactor: 0.5 }), depenses: dep + mens },
                        };
                        Object.values(scen).forEach(x => {
                            x.revenus = Math.round(x.revenus);
                            x.depenses = Math.round(x.depenses);
                            x.taux = tx(x.revenus, x.depenses);
                            x.manque = Math.max(0, Math.round(x.depenses - x.revenus));
                        });
                        return {
                            revenusPassifs: Math.round(base),
                            depensesHorsCredits: Math.round(dep),
                            mensualites: Math.round(mens),
                            tauxCouverture: tx(base, dep),
                            manque: Math.max(0, Math.round(dep - base)),
                            detailParActif: assetsEconomics.value
                                .filter(e => (masterAssets.value.find(a => a.id === e.id) || {}).isProductive)
                                .map(e => ({ id: e.id, name: e.name, mensuel: Math.round(e.cashflowNetMensuel), annuel: Math.round(e.cashflowNet) }))
                                .sort((a, b) => b.mensuel - a.mensuel),
                            scenarios: Object.values(scen),
                        };
                    });

                    // ═══════════════════════════════════════════════════════════════════
                    // v33.10 — ARBITRAGE : REMBOURSER vs PLACER (Mourabaha + Ibra'a)
                    // ═══════════════════════════════════════════════════════════════════
                    const arbitrageMode = ref('classique');       // 'classique' | 'mourabaha'
                    const arbitrageAssetId = ref('');             // crédit ciblé (optionnel)
                    const arbitrageIbraa = ref(70);               // % de remise sur marge non échue
                    const arbitrageMoisEcoules = ref(60);
                    const arbitrageTauxMarginal = ref(37);        // pour l'économie d'impôt perdue
                    const arbitrageDeductible = ref(false);       // les intérêts sont-ils déductibles ?
                    const arbitrageInflationOn = ref(true);

                    const arbitrageResult = computed(() => {
                        const cash = N(arbitrageCash.value);
                        const n = Math.max(1, N(arbitrageYears.value));
                        const rInv = N(arbitrageInvestRate.value) / 100;
                        const rDette = N(arbitrageDebtRate.value) / 100;
                        const infl = arbitrageInflationOn.value ? N((parametres.value || {}).hypotheseInflation) / 100 : 0;
                        const deflateur = Math.pow(1 + infl, n);

                        // ── Option A : PLACER ──
                        const gainPlacement = cash * (Math.pow(1 + rInv, n) - 1);

                        // ── Option B : REMBOURSER ──
                        let capitalLibere = cash, margeEvitee = 0, margePayee = 0, detailIbraa = null;
                        if (arbitrageMode.value === 'mourabaha') {
                            const asset = (masterAssets.value || []).find(a => a.id === arbitrageAssetId.value);
                            const ref_ = asset
                                ? Object.assign({}, asset, { type_credit: 'mourabaha', taux_ibraa: N(arbitrageIbraa.value) })
                                : { montant_credit: 300000, duree_mois: 240, taux_credit: N(arbitrageDebtRate.value),
                                    type_credit: 'mourabaha', mode_marge: 'lineaire', taux_ibraa: N(arbitrageIbraa.value) };
                            const sa = soldeAnticipe(ref_, N(arbitrageMoisEcoules.value));
                            detailIbraa = sa;
                            // marge non échue rapportée à 1 DH de capital restant
                            const m = sa.capitalRestant > 0 ? sa.margeNonEchue / sa.capitalRestant : 0;
                            const coutParDH = 1 + m * (1 - N(arbitrageIbraa.value) / 100);
                            capitalLibere = coutParDH > 0 ? Math.min(sa.capitalRestant, cash / coutParDH) : 0;
                            margeEvitee = capitalLibere * m;                                   // marge totale attachée
                            margePayee = margeEvitee * (1 - N(arbitrageIbraa.value) / 100);    // part encore due
                        }
                        const gainRemboursement = arbitrageMode.value === 'mourabaha'
                            ? (margeEvitee - margePayee)                       // gain sec = marge remise (Ibra'a)
                            : cash * (Math.pow(1 + rDette, n) - 1);            // intérêts composés évités

                        // ── Économie d'impôt perdue : rembourser supprime la déduction ──
                        const impotPerdu = arbitrageDeductible.value
                            ? gainRemboursement * (N(arbitrageTauxMarginal.value) / 100)
                            : 0;
                        const gainRemboursementNet = gainRemboursement - impotPerdu;

                        const ecart = gainPlacement - gainRemboursementNet;
                        const r0 = (v) => Math.round(v);
                        return {
                            mode: arbitrageMode.value,
                            cash, annees: n,
                            gainPlacement: r0(gainPlacement),
                            gainRemboursement: r0(gainRemboursement),
                            impotPerdu: r0(impotPerdu),
                            gainRemboursementNet: r0(gainRemboursementNet),
                            capitalLibere: r0(capitalLibere),
                            margeEvitee: r0(margeEvitee), margePayee: r0(margePayee),
                            detailIbraa,
                            ecart: r0(ecart),
                            gagnant: ecart > 0 ? 'placer' : (ecart < 0 ? 'rembourser' : 'neutre'),
                            // ── DH constants (actualisés de l'inflation) ──
                            deflateur: Math.round(deflateur * 1000) / 1000,
                            constants: {
                                gainPlacement: r0(gainPlacement / deflateur),
                                gainRemboursementNet: r0(gainRemboursementNet / deflateur),
                                ecart: r0(ecart / deflateur),
                            },
                        };
                    });

                    // ═══════════════════════════════════════════════════════════════════
                    // v33.10 — PROJET STUDIO : MODULE EXPLOITATION
                    // ═══════════════════════════════════════════════════════════════════
                    const _explDefaults = () => ({
                        adrBase: 550, occBase: 65,
                        saisonAdr: [0.85, 0.85, 0.95, 1, 1.05, 1.15, 1.35, 1.4, 1.05, 0.95, 0.85, 1],
                        saisonOcc: [0.8, 0.8, 0.9, 1, 1.05, 1.1, 1.25, 1.3, 1.05, 0.95, 0.8, 1],
                        rampUpOn: true, rampUp: [45, 60, 75, 85, 95, 100],
                        fraisPlateformePct: 3, fraisCohostPct: 19.4, maintenancePct: 5,
                        syndic: 300, internet: 250, electricite_eau: 600, consommables: 200, assurance_pno: 100,
                        loyerLongueDuree: 4500, chargesLongueDuree: 400,
                        scenarios: { pess: { adr: 450, occ: 50 }, central: { adr: 550, occ: 65 }, opti: { adr: 650, occ: 78 } },
                    });
                    const studioExpl = ref(_explDefaults());
                    const studioExplTab = ref('mensuel');

                    // Cœur : 12 lignes mois par mois
                    const _studioMois = (adrBase, occBase, avecRampUp) => {
                        const e = studioExpl.value;
                        const sc = studioCalc.value;
                        const chargesFixesMois = N(e.syndic) + N(e.internet) + N(e.electricite_eau) + N(e.consommables) + N(e.assurance_pno);
                        const pctVar = (N(e.fraisPlateformePct) + N(e.fraisCohostPct) + N(e.maintenancePct)) / 100;
                        const creditMois = N(sc.totalMensuel);
                        const mn = ['Janv','Févr','Mars','Avr','Mai','Juin','Juil','Août','Sept','Oct','Nov','Déc'];
                        let cumul = 0;
                        return mn.map((nom, i) => {
                            const adr = N(adrBase) * N(e.saisonAdr[i], 1);
                            let occ = (N(occBase) / 100) * N(e.saisonOcc[i], 1);
                            if (avecRampUp && e.rampUpOn) occ = occ * (N(e.rampUp[i], 100) / 100);
                            occ = Math.max(0, Math.min(1, occ));
                            const nuits = 30.4 * occ;
                            const ca = adr * nuits;
                            const cv = ca * pctVar;
                            const rex = ca - cv - chargesFixesMois;
                            const cf = rex - creditMois;
                            cumul += cf;
                            return {
                                mois: nom, adr: Math.round(adr), occ: Math.round(occ * 1000) / 10,
                                nuits: Math.round(nuits * 10) / 10,
                                ca: Math.round(ca), chargesVar: Math.round(cv), chargesFixes: Math.round(chargesFixesMois),
                                rex: Math.round(rex), credit: Math.round(creditMois),
                                cashflow: Math.round(cf), cumul: Math.round(cumul),
                            };
                        });
                    };

                    const studioExploitationMois = computed(() => _studioMois(studioExpl.value.adrBase, studioExpl.value.occBase, true));
                    const studioExploitationTotaux = computed(() => {
                        const rows = studioExploitationMois.value;
                        const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
                        return { ca: sum('ca'), chargesVar: sum('chargesVar'), chargesFixes: sum('chargesFixes'),
                                 rex: sum('rex'), credit: sum('credit'), cashflow: sum('cashflow'),
                                 nuits: Math.round(sum('nuits')) };
                    });

                    const studioScenarios = computed(() => {
                        const sc = studioExpl.value.scenarios || {};
                        const build = (cle, label, couleur) => {
                            const p = sc[cle] || { adr: 0, occ: 0 };
                            const rows = _studioMois(p.adr, p.occ, false);
                            const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
                            return { cle, label, couleur, adr: N(p.adr), occ: N(p.occ),
                                     ca: sum('ca'), rex: sum('rex'), cashflow: sum('cashflow'),
                                     cashflowMensuel: Math.round(sum('cashflow') / 12) };
                        };
                        return [
                            build('pess', 'Pessimiste', 'rose'),
                            build('central', 'Central', 'blue'),
                            build('opti', 'Optimiste', 'emerald'),
                        ];
                    });

                    // Comparateur courte durée vs longue durée
                    const studioComparateur = computed(() => {
                        const e = studioExpl.value;
                        const sc = studioCalc.value;
                        const creditAn = N(sc.totalMensuel) * 12;
                        const courte = studioScenarios.value.find(x => x.cle === 'central') || { ca: 0, rex: 0, cashflow: 0 };
                        const caLongue = N(e.loyerLongueDuree) * 12;
                        const rexLongue = caLongue - N(e.chargesLongueDuree) * 12 - caLongue * (N(e.maintenancePct) / 100);
                        return [
                            { mode: '🏨 Courte durée (Airbnb)', ca: courte.ca, rex: courte.rex,
                              cashflow: courte.cashflow, cashflowMensuel: Math.round(courte.cashflow / 12),
                              effort: 'Élevé — ménage, check-in, annonces', volatilite: 'Forte (saisonnalité ±40 %)' },
                            { mode: '🔑 Longue durée', ca: Math.round(caLongue), rex: Math.round(rexLongue),
                              cashflow: Math.round(rexLongue - creditAn), cashflowMensuel: Math.round((rexLongue - creditAn) / 12),
                              effort: 'Faible — un bail par an', volatilite: 'Faible (loyer fixe)' },
                        ];
                    });

                    // Seuil d'équilibre : CA nécessaire pour couvrir crédit + charges fixes
                    const studioSeuilEquilibre = computed(() => {
                        const e = studioExpl.value;
                        const sc = studioCalc.value;
                        const chargesFixesMois = N(e.syndic) + N(e.internet) + N(e.electricite_eau) + N(e.consommables) + N(e.assurance_pno);
                        const pctVar = (N(e.fraisPlateformePct) + N(e.fraisCohostPct) + N(e.maintenancePct)) / 100;
                        const denom = 1 - pctVar;
                        const caMois = denom > 0 ? (N(sc.totalMensuel) + chargesFixesMois) / denom : 0;
                        const adr = N(e.adrBase) || 1;
                        const nuits = caMois / adr;
                        return {
                            caMensuel: Math.round(caMois), caAnnuel: Math.round(caMois * 12),
                            nuits: Math.round(nuits * 10) / 10, adr: Math.round(adr),
                            occupation: Math.round((nuits / 30.4) * 1000) / 10,
                            chargesFixesMois: Math.round(chargesFixesMois),
                            creditMois: Math.round(N(sc.totalMensuel)),
                            pctVar: Math.round(pctVar * 1000) / 10,
                        };
                    });
`;

sub(
`                    // v20.96 : mensualités chronologiques — exceptions appliquées pour moisActuel
                    const totalCreditsMensuels = computed(() => {`,
BLOC + `
                    // v20.96 : mensualités chronologiques — exceptions appliquées pour moisActuel
                    const totalCreditsMensuels = computed(() => {`);

/* ── Hydratation import : objectifs + studioExpl ──────────────────────────── */
sub(
`                            if (Array.isArray(data.wealthGoals)) wealthGoals.value = data.wealthGoals;`,
`                            if (Array.isArray(data.wealthGoals)) wealthGoals.value = migrateGoalsV19(data.wealthGoals);
                            // v33.10 : paramètres d'exploitation du Projet Studio
                            if (data.studioExpl && typeof data.studioExpl === 'object') studioExpl.value = safeMerge(_explDefaults(), data.studioExpl);`);

sub(
`wealthGoals: wealthGoals.value, masterAssets: masterAssets.value });`,
`wealthGoals: wealthGoals.value, masterAssets: masterAssets.value, studioExpl: studioExpl.value });`);

/* ── Exports ──────────────────────────────────────────────────────────────── */
sub(
`                        // v33.00 : moteur de simulation patrimoniale`,
`                        // v33.10 : objectifs, indépendance financière, arbitrage, studio
                        migrateGoalV19, migrateGoalsV19, wealthGoalsCalc, addWealthGoal, syncGoalLegacy,
                        depensesHorsCreditsMensuel, mensualitesCreditsMensuel, salaireMensuel, independanceFinanciere,
                        arbitrageMode, arbitrageAssetId, arbitrageIbraa, arbitrageMoisEcoules,
                        arbitrageTauxMarginal, arbitrageDeductible, arbitrageInflationOn, arbitrageResult,
                        studioExpl, studioExplTab, studioExploitationMois, studioExploitationTotaux,
                        studioScenarios, studioComparateur, studioSeuilEquilibre,
                        // v33.00 : moteur de simulation patrimoniale`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v33.10 store appliqué');
