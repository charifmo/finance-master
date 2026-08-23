/**
 * v33.00 — Moteur de simulation patrimoniale (Phase A + B)
 * ---------------------------------------------------------------------------
 *  A. Schéma v19 des masterAssets + migration 18→19 (sans perte de données)
 *  B. Moteur financier : amortissement (classique + Mourabaha), économie
 *     d'exploitation par actif (CA → REX → impôt → cash-flow net), surplus
 *     budgétaire auto, puis réécriture complète de sandboxProjection.
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
   A. SCHÉMA v19 + MOTEUR FINANCIER
      Inséré juste avant la section SANDBOX.
   ══════════════════════════════════════════════════════════════════════════ */
const MOTEUR = String.raw`
                    // ═══════════════════════════════════════════════════════════════════
                    // v33.00 — SCHÉMA MASTER ASSET v19 + MOTEUR FINANCIER
                    //   Tout est pur et déterministe : aucune mutation du store.
                    // ═══════════════════════════════════════════════════════════════════
                    const N = (v, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };

                    // ── Valeurs par défaut du schéma v19 ───────────────────────────────
                    const _assetDefaultsV19 = () => ({
                        // ACQUISITION
                        prix_acquisition: 0, frais_acquisition: 0, travaux: 0, valeur_actuelle: 0,
                        taux_revalorisation: 3,
                        // FINANCEMENT
                        apport_personnel: 0, montant_credit: 0, type_credit: 'classique',
                        taux_credit: 0, duree_mois: 0, mensualite: 0, assurance_mensuelle: 0,
                        marge_totale: 0, mode_marge: 'lineaire', taux_ibraa: 0, mois_deja_payes: 0,
                        // EXPLOITATION
                        mode_exploitation: 'aucun', loyer_mensuel: 0,
                        adr: 0, taux_occupation: 0,
                        frais_plateforme_pct: 3, frais_cohost_pct: 19.4, maintenance_pct: 5,
                        syndic: 0, internet: 0, electricite_eau: 0, consommables: 0, assurance_pno: 0,
                        // FISCALITÉ
                        regime_fiscal: 'exonere', taux_marginal: 37, abattement_pct: 40,
                        taux_liberatoire: 20, amortissement_bati_pct: 4,
                        amortissement_mobilier_pct: 20, part_bati_pct: 75,
                    });

                    // ── Migration d'UN actif vers v19 (idempotente, sans perte) ────────
                    //   Les champs legacy (value, revenue, annees_total, annees_restantes)
                    //   sont conservés ET convertis vers les nouveaux champs.
                    const migrateAssetV19 = (raw) => {
                        const a = Object.assign({}, _assetDefaultsV19(), raw || {});
                        const legacyValue = N(raw && raw.value);
                        // Acquisition : prix d'acquisition hérite de l'ancien "value" (capital investi)
                        if (!N(a.prix_acquisition) && legacyValue) a.prix_acquisition = legacyValue;
                        if (!N(a.valeur_actuelle)) a.valeur_actuelle = legacyValue || N(a.prix_acquisition);
                        if (!N(a.taux_revalorisation) && Number(raw && raw._v) !== 19) a.taux_revalorisation = 3;
                        // Financement : durée en mois dérivée des années legacy
                        if (!N(a.duree_mois) && N(raw && raw.annees_total)) a.duree_mois = N(raw.annees_total) * 12;
                        if (!N(a.mois_deja_payes) && N(raw && raw.annees_total)) {
                            a.mois_deja_payes = Math.max(0, (N(raw.annees_total) - N(raw.annees_restantes)) * 12);
                        }
                        // v33.11 : déductions réservées aux actifs jamais passés en v19
                        const dejaV19 = Number(raw && raw._v) === 19;
                        // Exploitation : l'ancien "revenue" (annuel brut) devient un loyer mensuel
                        const legacyRevenue = N(raw && raw.revenue);
                        if (!dejaV19 && a.mode_exploitation === 'aucun' && legacyRevenue > 0) {
                            a.mode_exploitation = (String(a.type || '').toLowerCase().indexOf('commerc') >= 0) ? 'commercial' : 'longue_duree';
                            if (!N(a.loyer_mensuel)) a.loyer_mensuel = Math.round((legacyRevenue / 12) * 100) / 100;
                        }
                        // Fiscalité : par défaut foncier au barème pour un actif productif loué
                        if (!dejaV19 && a.regime_fiscal === 'exonere' && a.isProductive && a.mode_exploitation !== 'aucun') {
                            a.regime_fiscal = 'foncier_bareme';
                        }
                        // Cohérence apport / crédit / valeur
                        if (!N(a.apport_personnel) && !N(a.montant_credit) && legacyValue) a.apport_personnel = legacyValue;
                        a._v = 19;
                        return a;
                    };
                    const migrateAssetsV19 = (arr) => (Array.isArray(arr) ? arr : []).map(migrateAssetV19);

                    // Coût de revient : prix + frais + travaux (dérivé, jamais stocké)
                    const coutTotalRevient = (a) => N(a.prix_acquisition) + N(a.frais_acquisition) + N(a.travaux);

                    // ── Mensualité d'un crédit classique ───────────────────────────────
                    const mensualiteClassique = (capital, tauxAnnuelPct, dureeMois) => {
                        const C = N(capital), n = N(dureeMois), i = N(tauxAnnuelPct) / 100 / 12;
                        if (C <= 0 || n <= 0) return 0;
                        if (i === 0) return C / n;
                        return (C * i) / (1 - Math.pow(1 + i, -n));
                    };

                    // ── Taux implicite d'un échéancier (bissection) ────────────────────
                    //   Sert à répartir la marge Mourabaha de façon ACTUARIELLE :
                    //   on cherche i tel que C = ech × (1 - (1+i)^-n) / i
                    const tauxImplicite = (capital, echeance, dureeMois) => {
                        const C = N(capital), e = N(echeance), n = N(dureeMois);
                        if (C <= 0 || e <= 0 || n <= 0 || e * n <= C) return 0;
                        let lo = 0, hi = 1; // 0 % à 100 %/mois
                        for (let k = 0; k < 80; k++) {
                            const mid = (lo + hi) / 2;
                            const pv = mid === 0 ? e * n : e * (1 - Math.pow(1 + mid, -n)) / mid;
                            if (pv > C) lo = mid; else hi = mid;
                        }
                        return (lo + hi) / 2;
                    };

                    // ── Tableau d'amortissement mensuel complet ────────────────────────
                    //   Classique  : annuité constante, intérêt = solde × i
                    //   Mourabaha  : échéance = (capital + marge) / n
                    //       mode 'lineaire'    → marge répartie à parts égales
                    //       mode 'actuarielle' → marge = solde × taux implicite
                    //   Retourne [{ mois, echeance, capital, interet, soldeApres }]
                    const tableauAmortissement = (asset) => {
                        const a = asset || {};
                        const C = N(a.montant_credit);
                        const n = Math.round(N(a.duree_mois));
                        if (C <= 0 || n <= 0) return [];
                        const estMourabaha = String(a.type_credit || 'classique') === 'mourabaha';
                        const rows = [];
                        let solde = C;

                        if (!estMourabaha) {
                            const i = N(a.taux_credit) / 100 / 12;
                            const M = N(a.mensualite) > 0 ? N(a.mensualite) : mensualiteClassique(C, a.taux_credit, n);
                            for (let m = 1; m <= n && solde > 0.005; m++) {
                                const interet = solde * i;
                                let capital = M - interet;
                                if (capital > solde) capital = solde;
                                solde -= capital;
                                rows.push({ mois: m, echeance: capital + interet, capital, interet, soldeApres: solde });
                            }
                            return rows;
                        }

                        // Mourabaha
                        let MT = N(a.marge_totale);
                        if (MT <= 0 && N(a.taux_credit) > 0) MT = mensualiteClassique(C, a.taux_credit, n) * n - C;
                        const ech = (C + MT) / n;
                        const mode = String(a.mode_marge || 'lineaire');
                        if (mode === 'actuarielle') {
                            const i = tauxImplicite(C, ech, n);
                            for (let m = 1; m <= n && solde > 0.005; m++) {
                                const interet = solde * i;
                                let capital = ech - interet;
                                if (capital > solde) capital = solde;
                                solde -= capital;
                                rows.push({ mois: m, echeance: ech, capital, interet, soldeApres: solde });
                            }
                        } else {
                            const capM = C / n, margeM = MT / n;
                            for (let m = 1; m <= n; m++) {
                                solde = Math.max(0, solde - capM);
                                rows.push({ mois: m, echeance: ech, capital: capM, interet: margeM, soldeApres: solde });
                            }
                        }
                        return rows;
                    };

                    // ── Amortissement d'UNE année de projection ────────────────────────
                    //   anneeIndex 0 = première année projetée (à partir de mois_deja_payes)
                    //   → { capitalRembourse, interetsOuMarge, capitalRestant, echeances }
                    const amortissementAnnuel = (asset, anneeIndex) => {
                        const a = asset || {};
                        const tab = tableauAmortissement(a);
                        const vide = { capitalRembourse: 0, interetsOuMarge: 0, capitalRestant: N(a.montant_credit), echeances: 0 };
                        if (!tab.length) return vide;
                        const offset = Math.max(0, Math.round(N(a.mois_deja_payes)));
                        const debut = offset + Math.max(0, Math.round(N(anneeIndex))) * 12;
                        const fin = debut + 12;
                        const tranche = tab.filter(r => r.mois > debut && r.mois <= fin);
                        // Capital restant après cette année (0 si le crédit est soldé)
                        const derniere = tab.filter(r => r.mois <= fin).pop();
                        const capitalRestant = tranche.length ? tranche[tranche.length - 1].soldeApres
                                                              : (derniere ? derniere.soldeApres : 0);
                        return {
                            capitalRembourse: Math.round(tranche.reduce((x, r) => x + r.capital, 0) * 100) / 100,
                            interetsOuMarge:  Math.round(tranche.reduce((x, r) => x + r.interet, 0) * 100) / 100,
                            capitalRestant:   Math.round(Math.max(0, capitalRestant) * 100) / 100,
                            echeances:        Math.round(tranche.reduce((x, r) => x + r.echeance, 0) * 100) / 100,
                        };
                    };

                    // ── Solde de remboursement anticipé (Mourabaha avec Ibra'a) ────────
                    //   capital_restant + marge_non_echue × (1 − taux_ibraa)
                    const soldeAnticipe = (asset, apresMois) => {
                        const a = asset || {};
                        const tab = tableauAmortissement(a);
                        if (!tab.length) return { capitalRestant: 0, margeNonEchue: 0, ibraa: 0, solde: 0 };
                        const k = Math.max(0, Math.min(tab.length, Math.round(N(apresMois))));
                        const capitalRestant = k === 0 ? N(a.montant_credit) : tab[k - 1].soldeApres;
                        const margeTotale = tab.reduce((x, r) => x + r.interet, 0);
                        const margeCourue = tab.slice(0, k).reduce((x, r) => x + r.interet, 0);
                        const margeNonEchue = Math.max(0, margeTotale - margeCourue);
                        const estMourabaha = String(a.type_credit || 'classique') === 'mourabaha';
                        const tIbraa = estMourabaha ? N(a.taux_ibraa) / 100 : 1; // crédit classique : pas de marge future due
                        const ibraa = margeNonEchue * tIbraa;
                        return {
                            capitalRestant: Math.round(capitalRestant * 100) / 100,
                            margeNonEchue:  Math.round(margeNonEchue * 100) / 100,
                            ibraa:          Math.round(ibraa * 100) / 100,
                            solde:          Math.round((capitalRestant + margeNonEchue - ibraa) * 100) / 100,
                        };
                    };

                    // ── ÉCONOMIE D'EXPLOITATION D'UN ACTIF ─────────────────────────────
                    //   CA → charges → REX → service dette → impôt → cash-flow net
                    //   anneeIndex sert au régime professionnel (intérêts déductibles
                    //   de l'année) et au ramp-up éventuel.
                    const assetEconomics = (asset, anneeIndex = 0, opts = {}) => {
                        const a = Object.assign({}, _assetDefaultsV19(), asset || {});
                        const mode = String(a.mode_exploitation || 'aucun');
                        const occFactor = N(opts.occFactor, 1);       // stress / ramp-up
                        const loyerFactor = N(opts.loyerFactor, 1);   // stress -20 % etc.

                        // 1. CHIFFRE D'AFFAIRES
                        let ca = 0, nuitsAn = 0;
                        if (mode === 'courte_duree') {
                            const occ = (N(a.taux_occupation) / 100) * occFactor;
                            nuitsAn = 30.4 * occ * 12;
                            ca = N(a.adr) * loyerFactor * nuitsAn;
                        } else if (mode === 'longue_duree' || mode === 'commercial') {
                            ca = N(a.loyer_mensuel) * loyerFactor * 12 * occFactor;
                        }

                        // 2. CHARGES
                        const pctVar = (N(a.frais_plateforme_pct) + N(a.frais_cohost_pct) + N(a.maintenance_pct)) / 100;
                        const chargesVariables = mode === 'courte_duree' ? ca * pctVar : ca * (N(a.maintenance_pct) / 100);
                        const chargesFixesMensuelles = N(a.syndic) + N(a.internet) + N(a.electricite_eau) + N(a.consommables) + N(a.assurance_pno);
                        const chargesFixes = chargesFixesMensuelles * 12;

                        // 3. RÉSULTAT D'EXPLOITATION (avant crédit)
                        const rex = ca - chargesVariables - chargesFixes;

                        // 4. SERVICE DE LA DETTE
                        const amo = amortissementAnnuel(a, anneeIndex);
                        const mensualiteEff = N(a.mensualite) > 0 ? N(a.mensualite)
                                            : mensualiteClassique(a.montant_credit, a.taux_credit, a.duree_mois);
                        const serviceDette = amo.echeances > 0 ? amo.echeances + N(a.assurance_mensuelle) * 12
                                                               : (mensualiteEff + N(a.assurance_mensuelle)) * 12;
                        const cashflowAvantImpot = rex - serviceDette;

                        // 5. FISCALITÉ
                        const cout = coutTotalRevient(a);
                        const amortBati = (N(a.prix_acquisition) * N(a.part_bati_pct) / 100) * (N(a.amortissement_bati_pct) / 100);
                        const amortMobilier = N(a.travaux) * (N(a.amortissement_mobilier_pct) / 100);
                        const amortissements = amortBati + amortMobilier;
                        let baseImposable = 0, tauxImpot = 0;
                        const reg = String(a.regime_fiscal || 'exonere');
                        if (reg === 'professionnel') {
                            baseImposable = rex - amortissements - amo.interetsOuMarge;
                            tauxImpot = N(a.taux_marginal);
                        } else if (reg === 'foncier_bareme') {
                            baseImposable = ca * (1 - N(a.abattement_pct) / 100);
                            tauxImpot = N(a.taux_marginal);
                        } else if (reg === 'foncier_liberatoire') {
                            baseImposable = ca;
                            tauxImpot = N(a.taux_liberatoire);
                        }
                        const impot = Math.max(0, baseImposable) * (tauxImpot / 100);
                        const cashflowNet = cashflowAvantImpot - impot;

                        // 6. RENDEMENTS
                        const vRef = N(a.valeur_actuelle) || N(a.prix_acquisition) || cout;
                        const apport = N(a.apport_personnel);
                        const r2 = (v) => Math.round(v * 100) / 100;
                        return {
                            id: a.id, name: a.name, mode, regime: reg,
                            ca: r2(ca), nuitsAn: Math.round(nuitsAn),
                            chargesVariables: r2(chargesVariables),
                            chargesFixes: r2(chargesFixes), chargesFixesMensuelles: r2(chargesFixesMensuelles),
                            rex: r2(rex),
                            serviceDette: r2(serviceDette), mensualite: r2(mensualiteEff),
                            capitalRembourse: amo.capitalRembourse, interetsOuMarge: amo.interetsOuMarge,
                            capitalRestant: amo.capitalRestant,
                            cashflowAvantImpot: r2(cashflowAvantImpot),
                            amortissements: r2(amortissements),
                            baseImposable: r2(Math.max(0, baseImposable)), tauxImpot, impot: r2(impot),
                            cashflowNet: r2(cashflowNet), cashflowNetMensuel: r2(cashflowNet / 12),
                            coutTotalRevient: r2(cout),
                            rendementBrut: vRef > 0 ? r2((ca / vRef) * 100) : 0,
                            rendementNet:  vRef > 0 ? r2((rex / vRef) * 100) : 0,
                            roe: apport > 0 ? r2((cashflowNet / apport) * 100) : 0,
                            // seuil d'équilibre : CA à atteindre pour couvrir dette + charges fixes
                            seuilCA: (1 - pctVar) > 0 ? r2((serviceDette + chargesFixes) / (1 - pctVar)) : 0,
                        };
                    };

                    // Vue réactive : économie de chaque actif (année 0)
                    const assetsEconomics = computed(() => (masterAssets.value || []).map(a => assetEconomics(a, 0)));
                    const assetEcoById = computed(() => {
                        const m = {};
                        assetsEconomics.value.forEach(e => { m[e.id] = e; });
                        return m;
                    });
                    // Revenus passifs nets = Σ cash-flow net des actifs productifs
                    const revenusPassifsNetsAnnuel = computed(() =>
                        assetsEconomics.value
                            .filter(e => (masterAssets.value.find(a => a.id === e.id) || {}).isProductive)
                            .reduce((s, e) => s + e.cashflowNet, 0));
                    const revenusPassifsNetsMensuel = computed(() => revenusPassifsNetsAnnuel.value / 12);

                    // ── SURPLUS BUDGÉTAIRE ANNUEL dérivé du budget réel ────────────────
                    //   revenus − chargesFixes − chargesVariables − irrégulier net
                    const surplusBudgetaireAnnuel = (annee) => {
                        const dAll = donneesAnnuelles.value || {};
                        const d = dAll[annee] || dAll[Object.keys(dAll).map(Number).sort((x, y) => y - x)[0]] || {};
                        const revenus = Object.values(d.revenus || {}).reduce((s, r) => s + N(r.base) * 12, 0);
                        const fixes = Object.values(d.chargesFixes || {}).reduce((s, f) => s + N(f.valeur) * 12, 0);
                        const variables = Object.values(d.chargesVariables || {})
                            .reduce((s, c) => s + (c.periode === 'semaine' ? N(c.valeur) * 4.3 : N(c.valeur)) * 12, 0);
                        const irr = (Array.isArray(d.depensesIrregulieres) ? d.depensesIrregulieres : Object.values(d.depensesIrregulieres || {}))
                            .reduce((s, x) => s + N(x.montant), 0);
                        return Math.round((revenus - fixes - variables - irr) * 100) / 100;
                    };
`;

sub(
`                    // ─────────────────────────────────────────────────────
                    // ── v20.00 : SANDBOX / PROJECTIONS ────────────────────
                    // ─────────────────────────────────────────────────────`,
MOTEUR +
`
                    // ─────────────────────────────────────────────────────
                    // ── v20.00 : SANDBOX / PROJECTIONS ────────────────────
                    // ─────────────────────────────────────────────────────`);

/* ══════════════════════════════════════════════════════════════════════════
   B. NOUVEAUX PARAMÈTRES DE SIMULATION
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                    const sandboxSurplusMensuel = ref(0);`,
String.raw`                    const sandboxSurplusMensuel = ref(0);
                    // v33.00 : pilotage du moteur de projection
                    const sandboxSurplusAuto = ref(true);        // surplus dérivé du budget réel
                    const sandboxInflationOn = ref(true);        // érosion du pouvoir d'achat
                    const sandboxRevaloOn = ref(true);           // revalorisation des actifs
                    // Anti-double-comptage : par défaut les mensualités de crédit sont DÉJÀ
                    // dans chargesFixes (clés "credit*") du budget, donc on ne les sort pas
                    // une seconde fois de la trésorerie. Les loyers, eux, n'y sont pas.
                    const sandboxMensualitesDansBudget = ref(true);
                    const sandboxRevenusActifsDansBudget = ref(false);`);

/* ══════════════════════════════════════════════════════════════════════════
   C. RÉÉCRITURE DE sandboxProjection
   ══════════════════════════════════════════════════════════════════════════ */
const OLD_PROJ_HEAD = `                    // Projection annuelle isolée
                    const sandboxProjection = computed(() => {
                        const base = _sandboxBaseState();
                        let courant = base.courant;
                        let dette = base.dette;
                        let valeurActifs = base.valeurActifs;
                        const surplusAnnuel = (Number(sandboxSurplusMensuel.value) || 0) * 12;
                        const rows = [];
                        const horizon = Math.max(1, Math.min(20, Number(sandboxHorizon.value) || 1));
                        // Sandbox assets travaille en mémoire pour ajuster les ventes/achats
                        const sbAssets = JSON.parse(JSON.stringify(base.assets));
                        for (let i = 0; i <= horizon; i++) {
                            const annee = sandboxStartYear + i;
                            // Surplus annuel cumulé (sauf année 0 = "aujourd'hui")
                            if (i > 0) courant += surplusAnnuel;
                            // Appliquer les événements de cette année
`;

const NEW_PROJ_HEAD = String.raw`                    // ═══════════════════════════════════════════════════════════════
                    // v33.00 — PROJECTION ANNUELLE DYNAMIQUE
                    //   Pour chaque année :
                    //     1. revenus       (surplus budgétaire + cash-flow net des actifs)
                    //     2. amortissement (capital remboursé, dette et trésorerie)
                    //     3. revalorisation des actifs
                    //     4. inflation     (érosion du surplus)
                    //     5. événements    (achat / vente / remboursement)
                    //     6. patrimoine net = valeurActifs + courant − dette
                    // ═══════════════════════════════════════════════════════════════
                    const sandboxProjection = computed(() => {
                        calculationTick.value;
                        const base = _sandboxBaseState();
                        let courant = base.courant;
                        let dette = base.dette;
                        let valeurActifs = base.valeurActifs;
                        const rows = [];
                        const horizon = Math.max(1, Math.min(20, Number(sandboxHorizon.value) || 1));
                        const inflation = sandboxInflationOn.value ? N((parametres.value || {}).hypotheseInflation) / 100 : 0;
                        // Sandbox assets travaille en mémoire (schéma v19 garanti)
                        const sbAssets = migrateAssetsV19(JSON.parse(JSON.stringify(base.assets)));
                        // Surplus : dérivé du budget réel, ou saisie manuelle
                        let surplusAnnuel = sandboxSurplusAuto.value
                            ? surplusBudgetaireAnnuel(sandboxStartYear)
                            : (Number(sandboxSurplusMensuel.value) || 0) * 12;

                        for (let i = 0; i <= horizon; i++) {
                            const annee = sandboxStartYear + i;
                            let fluxSurplus = 0, fluxActifs = 0, capitalAmorti = 0,
                                interetsAnnee = 0, serviceDette = 0, revalo = 0;

                            if (i > 0) {
                                // ── 1. REVENUS ────────────────────────────────────────
                                fluxSurplus = surplusAnnuel;
                                courant += fluxSurplus;

                                sbAssets.forEach(a => {
                                    if (!a.isProductive) return;
                                    const eco = assetEconomics(a, i - 1);
                                    if (!sandboxRevenusActifsDansBudget.value) {
                                        // cash-flow net = REX − service dette − impôt : le service
                                        // de la dette est déjà dedans, on ne le resoustrait pas.
                                        fluxActifs += eco.cashflowNet;
                                    }
                                    interetsAnnee += eco.interetsOuMarge;
                                    serviceDette += eco.serviceDette;
                                });
                                courant += fluxActifs;

                                // ── 2. AMORTISSEMENT DES CRÉDITS ──────────────────────
                                sbAssets.forEach(a => {
                                    if (N(a.montant_credit) <= 0) return;
                                    const amo = amortissementAnnuel(a, i - 1);
                                    const paye = Math.min(N(a.montant_credit), amo.capitalRembourse);
                                    a.montant_credit = Math.max(0, N(a.montant_credit) - paye);
                                    dette -= paye;
                                    capitalAmorti += paye;
                                    // La mensualité ne sort de la trésorerie que si elle n'est
                                    // pas déjà comptée ailleurs (budget, ou cash-flow de l'actif).
                                    const dejaCompte = sandboxMensualitesDansBudget.value
                                        || (a.isProductive && !sandboxRevenusActifsDansBudget.value);
                                    if (!dejaCompte) courant -= (N(a.mensualite) + N(a.assurance_mensuelle)) * 12;
                                });

                                // ── 3. REVALORISATION ─────────────────────────────────
                                if (sandboxRevaloOn.value) {
                                    sbAssets.forEach(a => {
                                        const av = N(a.valeur_actuelle) || N(a.prix_acquisition) || N(a.value);
                                        const ap = av * (1 + N(a.taux_revalorisation) / 100);
                                        revalo += (ap - av);
                                        a.valeur_actuelle = ap;
                                    });
                                }
                                valeurActifs = sbAssets.reduce((s, a) => s + (N(a.valeur_actuelle) || N(a.prix_acquisition) || N(a.value)), 0);

                                // ── 4. INFLATION ──────────────────────────────────────
                                //   Érosion du pouvoir d'achat. Sur un surplus positif c'est
                                //   bien s×(1−infl) ; sur un DÉFICIT, l'inflation le creuse au
                                //   lieu de le réduire — d'où le raisonnement en valeur absolue.
                                surplusAnnuel = surplusAnnuel - Math.abs(surplusAnnuel) * inflation;
                            }

                            // ── 5. ÉVÉNEMENTS de l'année (logique conservée) ──────────
`;

sub(OLD_PROJ_HEAD, NEW_PROJ_HEAD);

// La ligne "const yearEvents = ..." suit immédiatement ; on l'atteint telle quelle.
sub(
`                            rows.push({
                                annee,
                                courant: Math.round(courant),
                                dette: Math.round(dette),
                                valeurActifs: Math.round(valeurActifs),
                                net: Math.round(courant + valeurActifs - dette),
                                events: yearEvents,
                            });`,
String.raw`                            // Recalage après événements (achats/ventes modifient sbAssets)
                            if (yearEvents.length) {
                                valeurActifs = sbAssets.reduce((s, a) => s + (N(a.valeur_actuelle) || N(a.prix_acquisition) || N(a.value)), 0);
                            }
                            rows.push({
                                annee,
                                courant: Math.round(courant),
                                dette: Math.round(Math.max(0, dette)),
                                valeurActifs: Math.round(valeurActifs),
                                net: Math.round(courant + valeurActifs - Math.max(0, dette)),
                                // v33.00 : décomposition du mouvement de l'année
                                fluxSurplus: Math.round(fluxSurplus),
                                fluxActifs: Math.round(fluxActifs),
                                capitalAmorti: Math.round(capitalAmorti),
                                interets: Math.round(interetsAnnee),
                                serviceDette: Math.round(serviceDette),
                                revalo: Math.round(revalo),
                                events: yearEvents,
                            });`);

/* ══════════════════════════════════════════════════════════════════════════
   D. MIGRATION DE SCHÉMA 18 → 19 (défauts + import)
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                            // v17.0 : hydratation Master Assets (avec migration v16→v17)
                            if (Array.isArray(data.masterAssets) && data.masterAssets.length) {
                                masterAssets.value = data.masterAssets;
                            } else if`,
`                            // v17.0 : hydratation Master Assets (avec migration v16→v17)
                            // v33.00 : puis migration de schéma 18 → 19 (idempotente, sans perte)
                            if (Array.isArray(data.masterAssets) && data.masterAssets.length) {
                                masterAssets.value = migrateAssetsV19(data.masterAssets);
                                if ((data._schemaVersion || 0) < 19) addLog('✅ Migration schéma 18→19 : ' + masterAssets.value.length + ' actif(s) enrichi(s).', 'success');
                            } else if`);

sub(
`                                if (migrated.length) { masterAssets.value = migrated; addLog('✅ Migration v16→v17 : masterAssets reconstruit.', 'success'); }`,
`                                if (migrated.length) { masterAssets.value = migrateAssetsV19(migrated); addLog('✅ Migration v16→v17→v19 : masterAssets reconstruit.', 'success'); }`);

sub(`_schemaVersion: 18,`, `_schemaVersion: 19,`);

/* ══════════════════════════════════════════════════════════════════════════
   E. EXPORTS setup()
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                        arbitrageCash, arbitrageDebtRate, arbitrageInvestRate, arbitrageYears,`,
`                        arbitrageCash, arbitrageDebtRate, arbitrageInvestRate, arbitrageYears,
                        // v33.00 : moteur de simulation patrimoniale
                        migrateAssetV19, migrateAssetsV19, coutTotalRevient, mensualiteClassique,
                        tableauAmortissement, amortissementAnnuel, soldeAnticipe, assetEconomics,
                        assetsEconomics, assetEcoById, revenusPassifsNetsAnnuel, revenusPassifsNetsMensuel,
                        surplusBudgetaireAnnuel,
                        sandboxSurplusAuto, sandboxInflationOn, sandboxRevaloOn,
                        sandboxMensualitesDansBudget, sandboxRevenusActifsDansBudget,`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v33.00 Phase A+B appliquée');
