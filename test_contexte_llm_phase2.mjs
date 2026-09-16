/* Fonction extraite VERBATIM du noeud « Build Agent Input » du workflow.
   Regenerer ce bloc apres toute modification du noeud. */
const choisirExercice = (fd, question) => {
  const dispo = Object.keys((fd && fd.donneesAnnuelles) || {});
  if (!dispo.length) return null;
  const cites = String(question || '').match(/\b20\d{2}\b/g) || [];
  for (const y of cites) if (dispo.indexOf(y) !== -1) return y;
  const appAnnee = String(((fd.soldesInitiaux || {}).anneeActuelle) || '');
  if (appAnnee && dispo.indexOf(appAnnee) !== -1) return appAnnee;
  const civile = String(new Date().getFullYear());
  if (dispo.indexOf(civile) !== -1) return civile;
  return dispo.slice().sort()[dispo.length - 1];
};

// ─────────────────────────────────────────────────────────────────────────
// 3. PROJECTION POUR LE MODELE
//    Sortent du contexte LLM (et de nulle part ailleurs) :
//      • les exercices autres que celui expose — remplaces par un resume
//      • transactionsReelles — historique pur, interrogeable par l'outil
//      • gConfig      : ne contient que le client ID Google OAuth
//      • parametres   : branding, cartes du ruban — de l'UI, pas de la finance
//      • studioExpl   : parametrage d'exploitation, du ressort du RAG
//      • categories archivees
// ─────────────────────────────────────────────────────────────────────────
const projeterPourLLM = (fd, question) => {
  if (!fd || typeof fd !== 'object') return null;
  // Payload web deja pre-digere par _buildPayloadCFO() : rien a faire.
  if (fd.matrice_cash_flow_calculee) return fd;
  if (!fd.donneesAnnuelles) return fd;

  const cible = choisirExercice(fd, question);
  if (!cible) return fd;

  const annees = Object.keys(fd.donneesAnnuelles).slice().sort();
  const src = fd.donneesAnnuelles[cible] || {};

  // Exercice expose, sans l'historique des transactions
  const exercice = {};
  let nbTx = 0;
  for (const k of Object.keys(src)) {
    if (k === 'transactionsReelles') {
      nbTx = Array.isArray(src[k]) ? src[k].length : 0;
      continue;
    }
    exercice[k] = src[k];
  }

  // Resume une ligne par exercice absent : le modele sait qu'ils existent
  const autres = [];
  for (const a of annees) {
    if (a === cible) continue;
    const y = fd.donneesAnnuelles[a] || {};
    const irr = Array.isArray(y.depensesIrregulieres) ? y.depensesIrregulieres : [];
    autres.push({
      exercice: Number(a),
      nb_revenus: Object.keys(y.revenus || {}).length,
      nb_charges_fixes: Object.keys(y.chargesFixes || {}).length,
      nb_depenses_irregulieres: irr.length,
      total_depenses_irregulieres: irr.reduce((s, d) => s + (Number(d.montant) || 0), 0),
      nb_transactions_reelles: Array.isArray(y.transactionsReelles) ? y.transactionsReelles.length : 0
    });
  }

  const si = fd.soldesInitiaux || {};
  const soldesInitiaux = {};
  for (const k of Object.keys(si)) soldesInitiaux[k] = si[k];
  soldesInitiaux.categories = (si.categories || [])
    .filter(c => c && !c.archive)
    .map(c => ({ id: c.id, label: c.label }));

  return {
    _contexte: {
      exercice_expose: Number(cible),
      exercices_disponibles: annees.map(Number),
      autres_exercices_resume: autres,
      transactions_reelles_masquees: nbTx,
      avertissement: 'Ce contexte est volontairement borné à l exercice ' + cible + '. '
        + 'Les autres exercices et l historique des transactions réelles existent bien côté serveur : '
        + 'ils ne sont simplement pas injectés ici. NE CONCLUS JAMAIS qu une donnée absente de ce bloc n existe pas. '
        + 'Les outils travaillent sur le JSON complet — propose_changes peut modifier n importe quelle année, '
        + 'et transactions_reelles_engine avec action "list" retourne l historique. '
        + 'Si la question porte sur un exercice non exposé, utilise l outil au lieu de répondre depuis ce bloc.'
    },
    version: fd.version,
    _schemaVersion: fd._schemaVersion,
    comptes: (fd.comptes || []).map(c => ({ id: c.id, label: c.label, type: c.type, solde: c.solde })),
    soldesInitiaux,
    donneesAnnuelles: (function () { const o = {}; o[cible] = exercice; return o; })(),
    wealthGoals: (fd.wealthGoals || []).map(g => ({ name: g.name, target: g.target, current: g.current })),
    masterAssets: (fd.masterAssets || []).map(a => ({
      id: a.id, name: a.name, isProductive: a.isProductive,
      value: a.value, valeur_actuelle: a.valeur_actuelle, revenue: a.revenue,
      apport_personnel: a.apport_personnel, montant_credit: a.montant_credit
    }))
  };
};



/* Jeu de données SYNTHÉTIQUE mais fidèle à la structure réelle du dépôt :
   clés de getExportData(), clés d'un exercice, details[] des charges variables,
   masterAssets schéma v19, gConfig = { clientId }. */
const mkAnnee = (a, nTx) => ({
  revenus: Object.fromEntries([...Array(4)].map((_, i) => [`rev_${i}`,
    { label: `Revenu ${i}`, base: 12000 + i * 900, periode: 'mois', destinationCompte: 'courant',
      exceptions: [{ moisDebut: 3, moisFin: 5, nouvelleValeur: 11000 }] }])),
  chargesFixes: Object.fromEntries([...Array(11)].map((_, i) => [`cf_${i}`,
    { label: `Charge fixe ${i}`, valeur: 500 + i * 220, jourPrevu: 5 + i, sourceCompte: 'courant', exceptions: [] }])),
  chargesVariables: {
    alimentation: { label: 'Alimentation (Tqdya)', valeur: 1487, periode: 'semaine', showDetails: true,
      details: [...Array(18)].map((_, i) => ({ id: i + 1, nom: `poste ${i}`, montant: 30 + i * 17 })) },
    sante:   { label: 'Santé',   valeur: 1100, periode: 'semaine', details: [...Array(4)].map((_, i) => ({ id: i, nom: 'p' + i, montant: 100 })) },
    sorties: { label: 'Sorties', valeur: 1040, periode: 'semaine', details: [...Array(3)].map((_, i) => ({ id: i, nom: 'p' + i, montant: 300 })) },
    voiture: { label: 'Voiture', valeur: 440,  periode: 'semaine', details: [...Array(3)].map((_, i) => ({ id: i, nom: 'p' + i, montant: 150 })) },
    factures:{ label: 'Factures',valeur: 2167, periode: 'mois',    details: [...Array(6)].map((_, i) => ({ id: i, nom: 'f' + i, montant: 200, paye: i % 2 === 0, montantPaye: 100 })) }
  },
  epargne: [...Array(3)].map((_, i) => ({ id: 'ep' + i, label: 'Épargne ' + i, valeur: 2000, linkedAccountId: null })),
  virementsInternes: [...Array(4)].map((_, i) => ({ id: i, source: 'courant', dest: 'ep0', montant: 1500, mois: i + 1 })),
  projetStudio: { prix: 450000, apport: 120000, taux: 4.75, duree: 20, charges: {} },
  depensesIrregulieres: [...Array(14)].map((_, i) => ({ id: i, mois: (i % 12) + 1, annee: a, nom: `Dépense ${i}`, montant: 1800 + i * 640, paye: false, montantPaye: 0, sourceCompte: 'cpt_7', jourPrevu: 20 })),
  transactionsReelles: [...Array(nTx)].map((_, i) => ({
    id: 1770000000000 + i, amount: 50 + (i % 400), libelle: `Achat ${i}`,
    categorieId: 'cat_cv_alim', compteId: 'cpt_1', date: `${a}-0${(i % 9) + 1}-15`,
    datetime: `${a}-0${(i % 9) + 1}-15T12:30`, source: 'saisie' }))
});

const fd = {
  version: '34.07 Bulle-Exercice', _schemaVersion: 19,
  soldesInitiaux: {
    courant: 125000, urgence: 0, lt: 0, bourse: 0, moisActuel: 9, anneeActuelle: 2026,
    salaireRecu: false, semainesRestantes: 3, jourDePaie: 27, decalagePaie: true,
    destinationSurplus: 'courant', compteChargesFixes: 'courant', compteChargesVariables: 'courant',
    categories: [...Array(28)].map((_, i) => ({ id: 'cat_' + i, label: 'Catégorie ' + i, archive: i > 21, couleur: '#059669', icone: '📦' })),
    config_assurances: { assureurs: ['AXA', 'CNOPS'], beneficiaires: ['a', 'b', 'c'], types: ['t1', 't2'], delaiJours: 45 },
    assurances_tracker: [...Array(9)].map((_, i) => ({ id: i, assureur: 'AXA', montant: 1200, remboursement: true, dateRemboursement: '2026-11-0' + ((i % 9) + 1) }))
  },
  donneesAnnuelles: Object.fromEntries([2026, 2027, 2028, 2029, 2030].map(a => [a, mkAnnee(a, a === 2026 ? 380 : 40)])),
  gConfig: { clientId: '8417xxxxxxxx-abcdefghijklmnop.apps.googleusercontent.com' },
  comptes: [...Array(5)].map((_, i) => ({ id: i + 1, label: 'Compte ' + i, type: i ? 'epargne' : 'courant', solde: 45300 - i * 8000, icone: '💳', ordre: i })),
  parametres: { branding: { appName: 'Finance Master', logoUrl: '/assets/logo.png', faviconUrl: '/assets/fav.png' },
    ribbon: { solde: true, cumul: true, stats: true, projection: true }, backupIntervalMinutes: 15,
    inflation: 2.5, fondsSecuriteMois: 6, moisActuel: 9, anneeActuelle: 2026 },
  wealthGoals: [...Array(4)].map((_, i) => ({ id: i, name: 'Objectif ' + i, target: 60000, current: 21000, deadline: '2027-06' })),
  masterAssets: [...Array(7)].map((_, i) => ({
    id: i, name: 'Actif ' + i, type: 'immo', isProductive: i < 3, value: 900000, valeur_actuelle: 1050000,
    revenue: i < 3 ? 72000 : 0, taux_credit: 4.75, annees_total: 20, annees_restantes: 18,
    apport_personnel: 200000, montant_credit: 700000, capital_initial: 750000, mois_deja_payes: 24,
    val_pessimiste: 800000, val_optimiste: 1400000, quotePart: 35, frais_revente_pct: 3,
    surface_totale: 1200, prix_m2: 900, zonage_actuel: 'R+2', zonage_cible: 'R+4',
    scenarios_par_m2: { pess: 700, med: 900, opti: 1300 }, arrieres_tnb: 0, provision_tpi: 0,
    commission_semsar_pct: 2.5, exploitation: { adr: 650, occupation: 0.7, saisonnalite: [...Array(12)].map(() => 1) } })),
  studioExpl: { adr_base: 650, saisonnalite: [...Array(12)].map((_, m) => 0.8 + m * 0.03),
    occupation_base: 0.68, occupation_saisonnalite: [...Array(12)].map((_, m) => 0.6 + m * 0.02),
    rampUp: [...Array(12)].map((_, m) => m / 12), scenarios: { pess: {}, central: {}, opti: {} }, charges: {} }
};

const avant = JSON.stringify(fd);
const apres = JSON.stringify(projeterPourLLM(fd, 'combien il me reste ce mois ?'));
const tok = n => Math.round(n / 4);

console.log('═'.repeat(72));
console.log('CONTEXTE LLM — voie Telegram (JSON VPS intégral)');
console.log('═'.repeat(72));
console.log(`  avant : ${avant.length.toLocaleString('fr')} car.  ≈ ${tok(avant.length).toLocaleString('fr')} tokens`);
console.log(`  après : ${apres.length.toLocaleString('fr')} car.  ≈ ${tok(apres.length).toLocaleString('fr')} tokens`);
console.log(`  GAIN  : ${(100 - apres.length / avant.length * 100).toFixed(1)} %   (−${tok(avant.length - apres.length).toLocaleString('fr')} tokens / requête)`);

const p = JSON.parse(apres);
console.log('\n── contrôles ──');
console.log('  exercice exposé              :', p._contexte.exercice_expose);
console.log('  exercices déclarés présents  :', p._contexte.exercices_disponibles.join(', '));
console.log('  transactions masquées        :', p._contexte.transactions_reelles_masquees);
console.log('  résumé des autres exercices  :', p._contexte.autres_exercices_resume.length, 'lignes');
console.log('  gConfig (clientId Google)    :', 'gConfig' in p ? '❌ ENCORE PRÉSENT' : '✅ retiré');
console.log('  parametres (branding/UI)     :', 'parametres' in p ? '❌ ENCORE PRÉSENT' : '✅ retiré');
console.log('  studioExpl                   :', 'studioExpl' in p ? '❌ ENCORE PRÉSENT' : '✅ retiré');
console.log('  catégories archivées         :', p.soldesInitiaux.categories.filter(c => c.archive).length === 0 ? '✅ retirées' : '❌');
console.log('  catégories actives gardées   :', p.soldesInitiaux.categories.length, '(la saisie vocale en a besoin)');
console.log('  charges variables + details  :', Object.keys(p.donneesAnnuelles[2026].chargesVariables).length, 'postes ✅ conservés');
console.log('  dépenses irrégulières 2026   :', p.donneesAnnuelles[2026].depensesIrregulieres.length, '✅ conservées');
console.log('  jourDePaie conservé          :', p.soldesInitiaux.jourDePaie);

console.log('\n── sélection de l exercice ──');
for (const q of ['combien il me reste ?', 'et en 2028 ?', 'mes charges de 2031 ?']) {
  const r = JSON.parse(JSON.stringify(projeterPourLLM(fd, q)));
  console.log(`  "${q}" -> exercice ${r._contexte.exercice_expose}`);
}

console.log('\n── idempotence : payload web déjà pré-digéré ──');
const web = { annee: 2026, matrice_cash_flow_calculee: 'blob', comptes_actuels: [], revenus_fixes: [] };
console.log('  inchangé :', JSON.stringify(projeterPourLLM(web, 'x')) === JSON.stringify(web) ? '✅' : '❌');
console.log('\n── robustesse ──');
for (const [lbl, v] of [['null', null], ['{}', {}], ['sans donneesAnnuelles', { comptes: [] }]]) {
  let r; try { r = JSON.stringify(projeterPourLLM(v, 'x')); } catch (e) { r = 'THROW ' + e.message; }
  console.log(`  ${lbl.padEnd(22)} -> ${String(r).slice(0, 40)}`);
}
