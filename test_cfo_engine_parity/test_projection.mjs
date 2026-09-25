/**
 * v37.8 — LE MOTEUR DE PROJECTION, EN CASH-FLOW STRICT.
 *
 *   Le bug corrigé : l'ancien moteur ajoutait à la trésorerie le surplus
 *   budgétaire (qui retranche DÉJÀ les mensualités de crédit, rangées dans
 *   chargesFixes sous les clés « credit* »), PUIS le cash-flow net de chaque
 *   actif productif — lequel vaut REX − SERVICE DE DETTE − impôt. Le service
 *   de la dette sortait donc deux fois de la caisse, chaque année, de façon
 *   cumulative. D'où des liquidités qui plongent dans le rouge sans qu'aucune
 *   dépense réelle n'existe.
 *
 *   Ce que cette suite verrouille : l'IDENTITÉ DE CAISSE. Toute variation de
 *   liquidité doit s'expliquer, au dirham près, par des flux nommés. Un
 *   amortissement de capital n'est pas une sortie de caisse ; un achat ne
 *   déduit que l'apport et les frais.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8').split('\r\n').join('\n');

const DEBUT = 'const projeterPatrimoine = (p) => {';
const FIN   = '\n                    //   L\'adaptateur Vue';
const i = html.indexOf(DEBUT), j = html.indexOf(FIN);
if (i < 0 || j < 0) { console.log('  ❌ projeterPatrimoine introuvable dans index.html'); process.exit(1); }
const { projeterPatrimoine } = new Function(html.slice(i, j) + '\n return { projeterPatrimoine };')();

let ko = 0;
const v = (titre, ok, detail = '') => { if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${titre.padEnd(62)} ${ok ? '' : detail}`); };
const eq = (titre, a, b, tol = 1) => v(titre, Math.abs(a - b) <= tol, `attendu ${Math.round(b)}, obtenu ${Math.round(a)}`);

/* ── Fonctions financières injectées : un crédit linéaire, volontairement
      simple, pour que l'arithmétique attendue tienne sur une ligne. ───────── */
const MENS = (capital, taux, duree) => (duree > 0 ? capital / duree : 0);   // taux 0 : 100 % capital
const amortissement = (a, idx) => {
    const capital = Number(a.capital_initial ?? a.montant_credit) || 0;
    const duree = Number(a.duree_mois) || 0;
    if (capital <= 0 || duree <= 0) return { capitalRembourse: 0, interetsOuMarge: 0 };
    return { capitalRembourse: Math.min(Number(a.montant_credit) || 0, (capital / duree) * 12), interetsOuMarge: 0 };
};
//   REX = loyer × 12 (net) ; service de dette = mensualité × 12 ; impôt nul.
const economieActif = (a) => {
    const rex = (Number(a.loyer_mensuel) || 0) * 12;
    const serviceDette = (Number(a.mensualite) || 0) * 12;
    return { rex, impot: 0, serviceDette, interetsOuMarge: 0, cashflowNet: rex - serviceDette };
};
const socle = (extra = {}) => Object.assign({
    anneeDepart: 2026, horizon: 3, liquiditeInitiale: 0, actifs: [], surplusAnnuel: 0,
    inflation: 0, revaloOn: false, mensualitesDansBudget: true, revenusActifsDansBudget: false,
    evenements: [], economieActif, amortissement, mensualitePour: MENS,
}, extra);

/* Un actif locatif réel, déjà au patrimoine, avec un crédit :
   loyer net 6 000 DH/mois, mensualité 5 000 DH/mois (capital pur sur 240 mois). */
const ACTIF = () => ({
    id: 'a1', name: 'Studio', isProductive: true, valeur_actuelle: 1200000,
    montant_credit: 1200000, capital_initial: 1200000, duree_mois: 240,
    mensualite: 5000, assurance_mensuelle: 0, loyer_mensuel: 6000, taux_revalorisation: 3,
});

console.log('\n  PROJECTION PATRIMONIALE — IDENTITÉ DE CAISSE\n  ' + '─'.repeat(80));

/* ══ 1. LA RÉGRESSION : le service de la dette ne sort qu'une fois ═════════ */
{
    // Le budget porte déjà les 60 000 DH/an de mensualité : le surplus annuel
    // saisi (120 000) en est donc déjà net. L'actif ne doit apporter que son
    // exploitation, soit 72 000 DH de loyer — surtout pas 72 000 − 60 000.
    const r = projeterPatrimoine(socle({ liquiditeInitiale: 100000, surplusAnnuel: 120000, actifs: [ACTIF()] }));
    eq('mensualité au budget → l\'actif n\'apporte que son exploitation', r[1].fluxActifs, 72000);
    eq('  → liquidités N+1 = 100 000 + 120 000 + 72 000', r[1].liquidite, 292000);
    // Preuve chiffrée du bug : l'ancien moteur retranchait 60 000 DH de plus,
    // chaque année, sans qu'aucune dépense réelle n'existe.
    eq('  → écart avec l\'ancien calcul sur 3 ans', r[3].liquidite - (292000 + 192000 + 192000 - 3 * 60000), 3 * 60000);
}

/* ══ 2. Le même actif quand les mensualités NE SONT PAS au budget ══════════ */
{
    const r = projeterPatrimoine(socle({ liquiditeInitiale: 100000, surplusAnnuel: 120000, actifs: [ACTIF()],
                                         mensualitesDansBudget: false }));
    eq('mensualité hors budget → l\'actif porte sa dette', r[1].fluxActifs, 72000 - 60000);
    eq('  → liquidités N+1 = 100 000 + 120 000 + 12 000', r[1].liquidite, 232000);
}

/* ══ 3. Loyers déjà dans les revenus du budget : l'actif n'apporte rien ════ */
{
    const r = projeterPatrimoine(socle({ liquiditeInitiale: 100000, surplusAnnuel: 120000, actifs: [ACTIF()],
                                         revenusActifsDansBudget: true }));
    eq('loyers déjà au budget → aucune contribution', r[1].fluxActifs, 0);
    eq('  → liquidités N+1 = 100 000 + 120 000', r[1].liquidite, 220000);
}

/* ══ 4. L'AMORTISSEMENT EST UNE ÉCRITURE DE BILAN ═════════════════════════ */
{
    const sansLoyer = Object.assign(ACTIF(), { isProductive: false, loyer_mensuel: 0 });
    const r = projeterPatrimoine(socle({ liquiditeInitiale: 500000, surplusAnnuel: 0, actifs: [sansLoyer] }));
    eq('capital remboursé : la dette baisse', r[1].dette, 1200000 - 60000);
    eq('  → la trésorerie ne bouge pas d\'un dirham', r[1].liquidite, 500000);
    eq('  → et le capital amorti est bien tracé', r[1].capitalAmorti, 60000);
    eq('  → le patrimoine net monte du capital remboursé', r[1].net - r[0].net, 60000);
}

/* ══ 5. ACHAT LOCATIF : seuls l'apport et les frais sortent du cash ════════ */
{
    const achat = { id: 'e1', annee: 2027, mois: 6, type: 'achat_locatif', nom: 'Gauthier',
        prixAchat: 1000000, apport: 300000, frais: 70000, montantCredit: 700000,
        taux: 0, dureeMois: 240, loyerMensuelNet: 5000 };
    const r = projeterPatrimoine(socle({ liquiditeInitiale: 1000000, evenements: [achat] }));
    eq('achat : cash sorti = apport + frais', r[1].chocsNegatifs, 370000);
    eq('  → la liquidité ne perd QUE cela', r[1].liquidite, 1000000 - 370000);
    eq('  → la dette monte du crédit, pas du prix', r[1].dette, 700000);
    eq('  → l\'actif entre à son prix d\'achat', r[1].valeurActifs, 1000000);
    eq('  → le patrimoine net ne perd que les frais', r[1].net - r[0].net, -70000);
    v('  → plan de financement bouclé : aucune alerte', r[1].alertes.length === 0, JSON.stringify(r[1].alertes));
    // Année suivante : le loyer net alimente le surplus, la mensualité en sort.
    //   mensualité = 700 000 / 240 = 2 916,67 DH → 35 000 DH sur l'année.
    eq('année N+1 : loyer 60 000 − mensualité 35 000', r[2].fluxActifs, 60000 - 35000);
    eq('  → et le crédit commence à s\'amortir', r[2].capitalAmorti, 35000);
}

/* ══ 6. Plan de financement incohérent : signalé, jamais avalé ════════════ */
{
    const achat = { id: 'e2', annee: 2027, mois: 1, type: 'achat_locatif', nom: 'Bancal',
        prixAchat: 1000000, apport: 100000, frais: 0, montantCredit: 500000, taux: 0, dureeMois: 120, loyerMensuelNet: 0 };
    const r = projeterPatrimoine(socle({ liquiditeInitiale: 1000000, evenements: [achat] }));
    v('financement incomplet → alerte explicite', r[1].alertes.some(a => /400000|400 000/.test(a.replace(/\s/g, '')) && /non financés/.test(a)), JSON.stringify(r[1].alertes));
}

/* ══ 7. CAPEX : n'impacte QUE les liquidités de l'année N ═════════════════ */
{
    const choc = { id: 'e3', annee: 2027, mois: 3, type: 'capex', nom: 'Ravalement', montant: 80000, sensChoc: 'sortie' };
    const entree = { id: 'e4', annee: 2028, mois: 3, type: 'capex', nom: 'Prime', montant: 20000, sensChoc: 'entree' };
    const r = projeterPatrimoine(socle({ liquiditeInitiale: 500000, actifs: [ACTIF()], evenements: [choc, entree] }));
    eq('capex sortie : −80 000 sur l\'année seule', r[1].liquidite - (r[0].liquidite + r[1].fluxSurplus + r[1].fluxActifs), -80000);
    eq('  → la dette est inchangée par le choc', r[1].dette, r[0].dette - r[1].capitalAmorti);
    eq('  → l\'année suivante ne le répète pas', r[2].chocsNegatifs, 0);
    eq('choc positif : +20 000', r[2].chocsPositifs, 20000);
}

/* ══ 8. VENTE : net vendeur encaissé, capital restant dû soldé ════════════ */
{
    const vente = { id: 'e5', annee: 2027, mois: 9, type: 'vente', cible: 'a1', montant: 1500000 };
    const r = projeterPatrimoine(socle({ liquiditeInitiale: 0, actifs: [ACTIF()], evenements: [vente] }));
    const crd = 1200000 - 60000;                       // après l'amortissement de l'année
    eq('vente : liquidité = net vendeur − capital restant dû', r[1].liquidite, 72000 + (1500000 - crd));
    eq('  → la dette est soldée', r[1].dette, 0);
    eq('  → l\'actif quitte le patrimoine', r[1].valeurActifs, 0);
}
{
    const vente = { id: 'e6', annee: 2027, mois: 9, type: 'vente', cible: 'a1', montant: 300000 };
    const r = projeterPatrimoine(socle({ liquiditeInitiale: 0, actifs: [ACTIF()], evenements: [vente] }));
    v('vente à perte : l\'insuffisance est nommée', r[1].alertes.some(a => /ne couvre pas/.test(a)), JSON.stringify(r[1].alertes));
}

/* ══ 9. REMBOURSEMENT ANTICIPÉ : plafonné au capital restant dû ═══════════ */
{
    const remb = { id: 'e7', annee: 2027, mois: 1, type: 'remboursement', cible: 'a1', montant: 5000000 };
    const r = projeterPatrimoine(socle({ liquiditeInitiale: 5000000, actifs: [ACTIF()], evenements: [remb] }));
    eq('remboursement plafonné au CRD', r[1].chocsNegatifs, 1200000 - 60000);
    v('  → le plafonnement est dit', r[1].alertes.some(a => /plafonné/.test(a)), JSON.stringify(r[1].alertes));
    eq('  → dette soldée', r[1].dette, 0);
}

/* ══ 10. Brouillon d'avant la refonte : relu, pas jeté ════════════════════ */
{
    const legacy = { id: 'old', annee: 2027, mois: 1, type: 'achat', cible: 'Terrain', montant: 250000 };
    const normaliser = (e) => e.type === 'achat'
        ? Object.assign({}, e, { type: 'achat_locatif', nom: e.cible, prixAchat: e.montant, apport: e.montant, frais: 0, montantCredit: 0, taux: 0, dureeMois: 0, loyerMensuelNet: 0 })
        : e;
    const r = projeterPatrimoine(socle({ liquiditeInitiale: 400000, evenements: [legacy], normaliser }));
    eq('achat legacy payé comptant : −250 000 en cash', r[1].liquidite, 150000);
    eq('  → et +250 000 à l\'actif', r[1].valeurActifs, 250000);
}

/* ══ 11. L'IDENTITÉ DE CAISSE, SUR UN SCÉNARIO COMPLET ════════════════════ */
{
    const r = projeterPatrimoine(socle({
        horizon: 6, liquiditeInitiale: 250000, surplusAnnuel: 180000, inflation: 0.025,
        revaloOn: true, actifs: [ACTIF(), Object.assign(ACTIF(), { id: 'a2', name: 'Terrain', isProductive: false, loyer_mensuel: 0, montant_credit: 0, capital_initial: 0, mensualite: 0 })],
        evenements: [
            { id: 'x1', annee: 2028, mois: 1, type: 'achat_locatif', nom: 'Gauthier', prixAchat: 900000, apport: 200000, frais: 60000, montantCredit: 700000, taux: 0, dureeMois: 180, loyerMensuelNet: 5500 },
            { id: 'x2', annee: 2029, mois: 6, type: 'capex', nom: 'Vacance', montant: 45000, sensChoc: 'sortie' },
            { id: 'x3', annee: 2031, mois: 3, type: 'vente', cible: 'a2', montant: 1400000 },
        ],
    }));
    const hors = r.filter(x => Math.abs(x.ecartControle) > 1);
    v('scénario complet : aucune variation de caisse inexpliquée', hors.length === 0,
      JSON.stringify(hors.map(x => [x.annee, x.ecartControle])));
    // Vérification indépendante, ligne à ligne, sans passer par ecartControle.
    let derive = 0;
    for (let k = 1; k < r.length; k++) {
        const attendu = r[k - 1].liquidite + r[k].fluxSurplus + r[k].fluxActifs + r[k].chocsPositifs - r[k].chocsNegatifs;
        if (Math.abs(attendu - r[k].liquidite) > 1) derive++;
    }
    v('  → recomposition externe : L(N) = L(N−1) + surplus + actifs + chocs', derive === 0, `${derive} ligne(s) en écart`);
    v('  → le patrimoine net reste = liquidités + actifs − dette',
      r.every(x => Math.abs(x.net - (x.liquidite + x.valeurActifs - x.dette)) <= 1));
    v('  → aucune liquidité négative dans ce scénario sain', r.every(x => x.liquidite > 0),
      JSON.stringify(r.map(x => [x.annee, x.liquidite])));
}

/* ══ 12. Bornes ══════════════════════════════════════════════════════════ */
{
    const r = projeterPatrimoine(socle({ horizon: 99 }));
    eq('horizon borné à 20 ans', r.length, 21, 0);
    const vide = projeterPatrimoine({ });
    v('appel sans paramètre : ne jette pas', Array.isArray(vide) && vide.length > 0);
    v('  → tout est à zéro, rien n\'est inventé', vide.every(x => x.liquidite === 0 && x.dette === 0 && x.net === 0));
}

console.log('  ' + '─'.repeat(80));
console.log(ko ? `  ❌ ${ko} contrôle(s) en échec` : '  ✅ TOUT PASSE — 0 contrôle(s) en échec');
process.exit(ko ? 1 : 0);
