// ════════════════════════════════════════════════════════
// BUILD AGENT INPUT v3 — v37.69 : n8n n'est plus qu'une coquille
//   Le contexte envoyé au modèle ET ses consignes viennent du VPS
//   (cfo_contexte.php + cfo_system_prompt.md, mis à jour par git pull).
//   Si le VPS ne répond pas : copie de secours ci-dessous (projection locale
//   + consignes de secours), le CFO répond quand même.
//   Les outils (Intent Compiler, Transactions Réelles, Committer) reçoivent
//   toujours le JSON COMPLET : seul finance_data_json (le modèle) est projeté.
// ════════════════════════════════════════════════════════
let authHeader = '';
try {
  const u = $env.FINANCE_USER, p = $env.FINANCE_PASS;
  if (u && p) authHeader = 'Basic ' + Buffer.from(u + ':' + p).toString('base64');
} catch (e) { /* $env indisponible : sans en-tête */ }
const authHeaders = authHeader ? { Authorization: authHeader } : {};
const CONTEXTE_URL = '__FINANCE_BASE__/finance/cfo_contexte.php';
const CONSIGNES_SECOURS = __PROMPT_SECOURS__;

const normalized = $('Normalize Input').first().json;

// ─────────────────────────────────────────────────────────────────────────
// 1. HISTORIQUE (inchange)
// ─────────────────────────────────────────────────────────────────────────
let rows = [];
try {
  rows = $input.all().map(item => item.json).filter(r => r && r.msg_json);
} catch (e) {
  rows = [];
}
rows = rows.reverse();

let history_text = '';
if (rows.length > 0) {
  const lines = [];
  for (const row of rows) {
    let parsed;
    try { parsed = typeof row.msg_json === 'string' ? JSON.parse(row.msg_json) : row.msg_json; }
    catch (e) { continue; }
    const type = parsed.type;
    const content = (parsed.data && parsed.data.content) || '';
    if (!content || typeof content !== 'string') continue;
    const plain = content
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/?[^>]+(>|$)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!plain) continue;
    const tag = type === 'human' ? 'User' : 'Assistant';
    const truncated = plain.length > 600 ? plain.slice(0, 600) + '…' : plain;
    lines.push(`[${tag}]: ${truncated}`);
  }
  if (lines.length > 0) {
    history_text = 'HISTORIQUE RÉCENT (derniers échanges, texte brut sans tool calls) :\n' + lines.join('\n') + '\n';
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 2. EXERCICE A EXPOSER
//    Priorite : annee citee dans la question (si elle existe reellement)
//             > annee courante de l'application (soldesInitiaux.anneeActuelle)
//             > annee civile
//             > derniere annee connue
// ─────────────────────────────────────────────────────────────────────────
const choisirExercice = (fd, question, historique) => {
  const dispo = Object.keys((fd && fd.donneesAnnuelles) || {});
  if (!dispo.length) return null;
  const cites = String(question || '').match(/\b20\d{2}\b/g) || [];
  for (const y of cites) if (dispo.indexOf(y) !== -1) return y;
  // v35.5 : la question courante ne porte souvent PAS le millesime -- il a ete
  //   pose un tour plus tot ("et en 2027 ?" puis "et mes versements ?"). On
  //   relit l'historique a l'envers : le dernier exercice reellement cite gagne.
  //   Sans cela, le repli sur l'annee de l'application faisait repondre 2026
  //   a une conversation qui portait sur 2027.
  const citesHist = String(historique || '').match(/\b20\d{2}\b/g) || [];
  for (let i = citesHist.length - 1; i >= 0; i--) {
    if (dispo.indexOf(citesHist[i]) !== -1) return citesHist[i];
  }
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
let _exerciceExpose = null;   // v35.5 : relu apres coup pour l'exporter
const projeterPourLLM = (fd, question, historique) => {
  if (!fd || typeof fd !== 'object') return null;
  // Payload web deja pre-digere par _buildPayloadCFO() : rien a faire.
  if (fd.matrice_cash_flow_calculee) return fd;
  if (!fd.donneesAnnuelles) return fd;

  const cible = choisirExercice(fd, question, historique);
  if (!cible) return fd;
  _exerciceExpose = Number(cible);

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
    // v35.5 : les versements planifies de CHAQUE exercice, pas seulement de
    //   celui expose. Ils tiennent en quelques dizaines d'octets et leur
    //   absence est ce qui a permis au modele d'annoncer les 10 500 DH de 2026
    //   comme etant ceux de 2027.
    const ep = Array.isArray(y.epargne) ? y.epargne : [];
    autres.push({
      exercice: Number(a),
      nb_revenus: Object.keys(y.revenus || {}).length,
      nb_charges_fixes: Object.keys(y.chargesFixes || {}).length,
      nb_depenses_irregulieres: irr.length,
      total_depenses_irregulieres: irr.reduce((s, d) => s + (Number(d.montant) || 0), 0),
      versements_planifies: ep.map(e => ({ label: e.label, montant: Number(e.valeur) || 0 })),
      total_versements_planifies: ep.reduce((s, e) => s + (Number(e.valeur) || 0), 0),
      nb_transactions_reelles: Array.isArray(y.transactionsReelles) ? y.transactionsReelles.length : 0
    });
  }

  const si = fd.soldesInitiaux || {};
  const soldesInitiaux = {};
  for (const k of Object.keys(si)) soldesInitiaux[k] = si[k];
  soldesInitiaux.categories = (si.categories || [])
    .filter(c => c && !c.archive)
    .map(c => ({ id: c.id, label: c.label }));

  const lecture = fd._lectureCFO && typeof fd._lectureCFO === 'object' ? fd._lectureCFO : null;
  return {
    ...(lecture ? { lecture_moteur: lecture, lecture_moteur_mode_emploi: 'CHIFFRES CALCULÉS PAR L’APPLICATION, à lire tels quels (consigne §0) : comptes réels de chaque ligne, montants de ce cycle exceptions comprises, budget du cycle des charges variables, alimentation du Compte Courant. Les lignes brutes de donneesAnnuelles ci-dessous servent à comprendre la structure, JAMAIS à recalculer ces chiffres.' } : {}),
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
        + 'Si la question porte sur un exercice non exposé, utilise l outil au lieu de répondre depuis ce bloc.',
      regle_annee: 'INTERDIT de presenter les chiffres de l exercice ' + cible + ' comme ceux d une autre annee. '
        + 'Les versements planifies de chaque exercice figurent dans autres_exercices_resume[].versements_planifies : '
        + 'lis-les la, ne les deduis jamais de l exercice expose. Annonce toujours explicitement l annee sur laquelle tu reponds.'
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

// ─────────────────────────────────────────────────────────────────────────
// 4. CONTEXTE ET CONSIGNES : le VPS d'abord, la copie de secours sinon
// ─────────────────────────────────────────────────────────────────────────
const _sourceContexte = normalized.finance_data;
let finance_data_json = normalized.finance_data_json;
let system_message = CONSIGNES_SECOURS;
let contexte_source = 'secours';
let contexte_erreur = null;
try {
  const r = await this.helpers.httpRequest({
    method: 'POST', url: CONTEXTE_URL, headers: { ...authHeaders }, json: true, timeout: 8000,
    body: { question: normalized.question, historique: history_text, finance_data: _sourceContexte || null }
  });
  if (r && typeof r.system_message === 'string' && r.system_message.length > 200) {
    system_message = r.system_message;
    if (r.finance_data_json) finance_data_json = r.finance_data_json;
    if (r.exercice_expose) _exerciceExpose = Number(r.exercice_expose);
    contexte_source = 'vps ' + (r.version || '?');
  } else {
    contexte_erreur = 'réponse inattendue du VPS';
  }
} catch (e) {
  contexte_erreur = (e && e.message) || String(e);
}
if (contexte_source === 'secours') {
  try {
    if (_sourceContexte) {
      const allege = projeterPourLLM(_sourceContexte, normalized.question, history_text);
      if (allege) finance_data_json = JSON.stringify(allege);
    }
  } catch (e) {
    finance_data_json = normalized.finance_data_json;
  }
}

return [{
  json: {
    source: normalized.source,
    session_id: normalized.session_id,
    chat_id: normalized.chat_id,
    question: normalized.question,
    finance_data_json,                                  // ← projeté (modèle)
    finance_data: normalized.finance_data,              // ← intact (outils)
    finance_data_raw: normalized.finance_data_raw || null, // ← intact (outils)
    finance_data_loaded_from: normalized.finance_data_loaded_from,
    exercice_expose: _exerciceExpose,   // lu par Tool: Intent Compiler
    system_message,                     // ← lu par AI Agent (consignes)
    contexte_source,
    contexte_erreur,
    history_text,
    history_count: rows.length
  }
}];
