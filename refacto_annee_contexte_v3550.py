# -*- coding: utf-8 -*-
"""
v35.5 — FUITE INTER-ANNEES : l'agent lisait un exercice et ecrivait dans un autre.

MECANIQUE EXACTE, cote n8n
  `choisirExercice()` ne cherchait un millesime que dans la QUESTION COURANTE.
  Des que l'utilisateur citait 2027 dans un tour precedent puis enchainait
  ("et mes versements ?"), plus aucun `20\\d{2}` a matcher : repli silencieux
  sur soldesInitiaux.anneeActuelle (2026). Le modele recevait les chiffres de
  2026 et, la conversation parlant de 2027, les annoncait comme etant ceux de
  2027. C'est le 10 500 DH rapporte au lieu de 13 000 DH.

  Second trou, aggravant : `autres_exercices_resume` comptait les revenus, les
  charges fixes et les depenses irregulieres des autres exercices — mais PAS
  l'epargne. Le modele n'avait donc litteralement aucun moyen de connaitre les
  versements d'une annee non exposee, et l'a comble par ce qu'il avait sous la
  main. Une donnee absente du contexte est une donnee que le modele invente.

TROIS CORRECTIONS
  1. L'historique recent sert de repli AVANT l'annee de l'application : le
     dernier millesime cite dans la conversation l'emporte, a condition qu'il
     existe vraiment dans les donnees.
  2. Les versements planifies de CHAQUE exercice entrent dans le resume. C'est
     quelques dizaines d'octets et cela supprime la possibilite meme de
     l'hallucination inter-annees.
  3. L'exercice expose devient un champ de premier niveau du noeud, pour que le
     compilateur d'intention le transmette au backend (annee_contexte) : ce que
     l'agent a LU devient ce qu'il ECRIT.
"""
import json, io, sys

P = 'super_agent_cfo_audio.json'
w = json.load(io.open(P, encoding='utf-8'))
node = {n['name']: n for n in w['nodes']}

def sub(code, old, new, label):
    if code.count(old) != 1:
        raise SystemExit('ANCRE %s : %d occurrence(s)' % (label, code.count(old)))
    return code.replace(old, new)

# ══ 1. BUILD AGENT INPUT ═══════════════════════════════════════════════════
c = node['Build Agent Input']['parameters']['jsCode']

c = sub(c, """const choisirExercice = (fd, question) => {
  const dispo = Object.keys((fd && fd.donneesAnnuelles) || {});
  if (!dispo.length) return null;
  const cites = String(question || '').match(/\\b20\\d{2}\\b/g) || [];
  for (const y of cites) if (dispo.indexOf(y) !== -1) return y;
  const appAnnee = String(((fd.soldesInitiaux || {}).anneeActuelle) || '');""",
"""const choisirExercice = (fd, question, historique) => {
  const dispo = Object.keys((fd && fd.donneesAnnuelles) || {});
  if (!dispo.length) return null;
  const cites = String(question || '').match(/\\b20\\d{2}\\b/g) || [];
  for (const y of cites) if (dispo.indexOf(y) !== -1) return y;
  // v35.5 : la question courante ne porte souvent PAS le millesime -- il a ete
  //   pose un tour plus tot ("et en 2027 ?" puis "et mes versements ?"). On
  //   relit l'historique a l'envers : le dernier exercice reellement cite gagne.
  //   Sans cela, le repli sur l'annee de l'application faisait repondre 2026
  //   a une conversation qui portait sur 2027.
  const citesHist = String(historique || '').match(/\\b20\\d{2}\\b/g) || [];
  for (let i = citesHist.length - 1; i >= 0; i--) {
    if (dispo.indexOf(citesHist[i]) !== -1) return citesHist[i];
  }
  const appAnnee = String(((fd.soldesInitiaux || {}).anneeActuelle) || '');""",
 'choisirExercice')

c = sub(c, """const projeterPourLLM = (fd, question) => {""",
           """let _exerciceExpose = null;   // v35.5 : relu apres coup pour l'exporter
const projeterPourLLM = (fd, question, historique) => {""", 'signature')

c = sub(c, """  const cible = choisirExercice(fd, question);
  if (!cible) return fd;""",
           """  const cible = choisirExercice(fd, question, historique);
  if (!cible) return fd;
  _exerciceExpose = Number(cible);""", 'cible')

# Versements planifies dans le resume des autres exercices
c = sub(c, """    const irr = Array.isArray(y.depensesIrregulieres) ? y.depensesIrregulieres : [];
    autres.push({
      exercice: Number(a),
      nb_revenus: Object.keys(y.revenus || {}).length,
      nb_charges_fixes: Object.keys(y.chargesFixes || {}).length,
      nb_depenses_irregulieres: irr.length,
      total_depenses_irregulieres: irr.reduce((s, d) => s + (Number(d.montant) || 0), 0),
      nb_transactions_reelles: Array.isArray(y.transactionsReelles) ? y.transactionsReelles.length : 0
    });""",
"""    const irr = Array.isArray(y.depensesIrregulieres) ? y.depensesIrregulieres : [];
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
    });""", 'resume')

c = sub(c, """        + 'Si la question porte sur un exercice non exposé, utilise l outil au lieu de répondre depuis ce bloc.'""",
"""        + 'Si la question porte sur un exercice non exposé, utilise l outil au lieu de répondre depuis ce bloc.',
      regle_annee: 'INTERDIT de presenter les chiffres de l exercice ' + cible + ' comme ceux d une autre annee. '
        + 'Les versements planifies de chaque exercice figurent dans autres_exercices_resume[].versements_planifies : '
        + 'lis-les la, ne les deduis jamais de l exercice expose. Annonce toujours explicitement l annee sur laquelle tu reponds.'""",
 'avertissement')

c = sub(c, """    const allege = projeterPourLLM(_sourceContexte, normalized.question);""",
           """    const allege = projeterPourLLM(_sourceContexte, normalized.question, history_text);""", 'appel')

c = sub(c, """    finance_data_loaded_from: normalized.finance_data_loaded_from,""",
"""    finance_data_loaded_from: normalized.finance_data_loaded_from,
    exercice_expose: _exerciceExpose,   // v35.5 : lu par Tool: Intent Compiler""", 'sortie')

node['Build Agent Input']['parameters']['jsCode'] = c

# ══ 2. TOOL: INTENT COMPILER ═══════════════════════════════════════════════
c = node['Tool: Intent Compiler']['parameters']['jsCode']

c = sub(c, """const ssot = (normalized.finance_data && normalized.finance_data.surplus_mensuel_net_courant) || null;""",
"""const ssot = (normalized.finance_data && normalized.finance_data.surplus_mensuel_net_courant) || null;

// v35.5 : l'exercice REELLEMENT expose au modele part avec les calls. Sans lui,
//   un appel sans `year` retombait cote serveur sur date('Y') -- l'horloge du
//   VPS -- donc sur 2026 quoi qu'il arrive. Un `year` explicite dans un call
//   reste prioritaire : ce parametre n'est qu'un defaut, jamais un forcage.
const annee_contexte = Number(normalized.exercice_expose) || null;""", 'ssot')

c = sub(c, """    body: { session_id, calls, surplus_mensuel_net_courant: ssot },""",
           """    body: { session_id, calls, surplus_mensuel_net_courant: ssot, annee_contexte },""", 'body')

node['Tool: Intent Compiler']['parameters']['jsCode'] = c

json.dump(w, io.open(P, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('OK — Build Agent Input + Tool: Intent Compiler patches')
