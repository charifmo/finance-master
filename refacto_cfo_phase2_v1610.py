# -*- coding: utf-8 -*-
"""
REFACTO CFO — PHASE 2 : le token bloat du contexte LLM
===============================================================================
Cible : noeud "Build Agent Input" de super_agent_cfo_audio.json

CE QUE L'ANALYSE A MONTRE (et qui change le correctif)
-------------------------------------------------------------------------------
La voie WEB est deja propre. Le front envoie `_buildPayloadCFO()` (v20.30), un
JSON pre-digere : matrice deja calculee, labels + montants, pas d'historique.
Et `Normalize Input` range deja le JSON brut a part, dans `finance_data_raw`,
pour les outils de mutation.

La fuite est sur la voie TELEGRAM. Une seule ligne :

    finance_data = fetched;   // le JSON VPS INTEGRAL

...qui part ensuite en entier dans le prompt via finance_data_json :
toutes les annees, tout l'historique des transactions reelles, la config d'UI,
le branding, et gConfig — qui contient le client ID Google OAuth. Tout ca lu
par le modele a chaque question, y compris pour dire « j'ai depense 150 DH ».

POURQUOI LE CORRECTIF TIENT EN UN SEUL CHAMP
-------------------------------------------------------------------------------
Inventaire des consommateurs, fait sur le workflow :
    finance_data_json  ->  AI Agent UNIQUEMENT (parametre `text`)
    finance_data / finance_data_raw -> Intent Compiler, Transactions Reelles,
                                       Committer  (`finance_data_raw || finance_data`)

Donc : on ne projette QUE `finance_data_json`. `finance_data` et
`finance_data_raw` traversent le noeud inchanges. Les outils de mutation
continuent de voir le JSON complet, ils peuvent toujours ecrire sur n'importe
quelle annee. Rayon d'action du changement : un champ, un consommateur.

C'est aussi la raison pour laquelle le correctif va dans `Build Agent Input` et
pas dans `Normalize Input` : normaliser les sources et decider ce que le modele
a le droit de voir sont deux responsabilites differentes. La seconde appartient
au noeud qui construit l'entree de l'agent.

LE PIEGE EVITE
-------------------------------------------------------------------------------
Un contexte tronque sans le dire fabrique des hallucinations par omission : le
modele ne voit pas 2027, il conclut que 2027 n'existe pas. La projection porte
donc un bloc `_contexte` qui declare explicitement ce qui est masque, ou le
retrouver, et un resume d'une ligne par exercice absent.
"""
import json, io, os

PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'super_agent_cfo_audio.json')
with io.open(PATH, encoding='utf-8') as f:
    ORIGINAL = f.read()
wf = json.loads(ORIGINAL)

bai = None
for n in wf['nodes']:
    if n['name'] == 'Build Agent Input':
        bai = n
if bai is None:
    raise SystemExit('Noeud "Build Agent Input" introuvable')

AVANT = bai['parameters']['jsCode']

bai['parameters']['jsCode'] = r'''// ════════════════════════════════════════════════════════
// BUILD AGENT INPUT v2
//   1. Historique conversationnel aplati (inchange depuis v1).
//   2. NOUVEAU — le contexte financier envoye au MODELE est projete sur le
//      seul exercice utile. Les outils de mutation, eux, continuent de
//      recevoir le JSON COMPLET : seul `finance_data_json` est allege,
//      `finance_data` et `finance_data_raw` traversent intacts.
//
//   Consommateurs verifies sur le workflow :
//     finance_data_json              -> AI Agent, et lui seul
//     finance_data / _raw            -> Intent Compiler, Transactions Reelles,
//                                       Committer
// ════════════════════════════════════════════════════════
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

// ─────────────────────────────────────────────────────────────────────────
// 4. SORTIE — seul finance_data_json est projete
// ─────────────────────────────────────────────────────────────────────────
const _sourceContexte = normalized.finance_data;
let finance_data_json = normalized.finance_data_json;
let contexte_projete = false;
let contexte_octets_avant = null;
let contexte_octets_apres = null;

try {
  if (_sourceContexte) {
    contexte_octets_avant = (normalized.finance_data_json || '').length;
    const allege = projeterPourLLM(_sourceContexte, normalized.question);
    if (allege) {
      finance_data_json = JSON.stringify(allege);
      contexte_octets_apres = finance_data_json.length;
      contexte_projete = contexte_octets_apres < contexte_octets_avant;
    }
  }
} catch (e) {
  // Un échec de projection ne doit jamais priver l'agent de son contexte :
  // on retombe sur le JSON d'origine.
  finance_data_json = normalized.finance_data_json;
  contexte_projete = false;
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
    history_text,
    history_count: rows.length,
    contexte_projete,
    contexte_octets_avant,
    contexte_octets_apres
  }
}];'''

out = json.dumps(wf, ensure_ascii=False, indent=2)
with io.open(PATH, 'w', encoding='utf-8') as f:
    f.write(out)

print('Build Agent Input : %d -> %d caracteres de code' % (len(AVANT), len(bai['parameters']['jsCode'])))
print('Fichier           : %d -> %d octets' % (len(ORIGINAL), len(out)))
