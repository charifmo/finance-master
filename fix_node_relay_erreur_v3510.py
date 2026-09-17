# -*- coding: utf-8 -*-
"""
v35.1 — Le nœud Intent Compiler doit RELAYER l'erreur du serveur, pas l'inventer
===============================================================================
CE QUI S'EST PASSÉ

Le bloc catch du nœud (écrit en phase 3) jetait le corps de la réponse du
serveur et renvoyait à la place une cause codée en dur :

    cause_probable: 'pending_commit.php absent, cfo_intent_engine.php non
                     deploye, ou VPS injoignable.'

Ce texte s'affiche à l'identique que le VPS soit réellement injoignable OU
qu'il ait répondu proprement 500/503 avec un diagnostic précis dans le corps.
Résultat concret : un ticket entier a été consacré à corriger un require_once
qui n'avait jamais été cassé — le vrai message du serveur n'a jamais été vu.

CORRECTIF
  · Le serveur a répondu  → on relaie SON corps tel quel (BACKEND_ERREUR).
  · Aucune réponse du tout → alors seulement « injoignable », et la cause
    annoncée se limite à ce qu'on sait vraiment (pas de réponse HTTP).
Aucune cause n'est plus devinée à la place du serveur.
"""
import json, io, os

PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'super_agent_cfo_audio.json')
with io.open(PATH, encoding='utf-8') as f:
    ORIGINAL = f.read()
wf = json.loads(ORIGINAL)

node = None
for n in wf['nodes']:
    if n['name'] == 'Tool: Intent Compiler':
        node = n
if node is None:
    raise SystemExit('Noeud "Tool: Intent Compiler" introuvable')

code = node['parameters']['jsCode']

AVANT = """} catch (e) {
  const body = (e && e.response && e.response.body) || null;
  // Hors catalogue : on conserve l'arret franc de la v1 plutot qu'un retour
  // silencieux — le modele ne doit pas enchainer comme si de rien n'etait.
  if (body && body.error === 'ERROR_OUT_OF_CATALOG') {
    throw new Error('ERROR_OUT_OF_CATALOG: ' + (body.message || "L'action demandee n'existe pas dans le catalogue."));
  }
  return JSON.stringify({
    error: 'BACKEND_INJOIGNABLE',
    detail: (e && e.message) || null,
    statusCode: (e && (e.statusCode || e.code)) || null,
    endpoint: ENDPOINT,
    cause_probable: 'pending_commit.php absent, cfo_intent_engine.php non deploye, ou VPS injoignable.'
  });
}"""

APRES = """} catch (e) {
  // v35.1 : NE JAMAIS inventer la cause. La v1 renvoyait une cause_probable
  // codee en dur ("pending_commit.php absent...") meme quand le serveur avait
  // repondu avec un diagnostic precis — ce qui a envoye tout un debug sur une
  // fausse piste. On distingue desormais deux situations franchement.
  const status = (e && (e.statusCode || e.status || (e.response && e.response.statusCode))) || null;
  let body = (e && e.response && e.response.body) || (e && e.error) || null;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { /* corps non-JSON : relaye brut */ } }

  // Hors catalogue : arret franc, le modele ne doit pas enchainer.
  if (body && body.error === 'ERROR_OUT_OF_CATALOG') {
    throw new Error('ERROR_OUT_OF_CATALOG: ' + (body.message || "L'action demandee n'existe pas dans le catalogue."));
  }

  // CAS 1 — le serveur A repondu : on relaie SON diagnostic, mot pour mot.
  //   pending_commit.php renvoie desormais error/class/file/line (COMPILE_EXCEPTION,
  //   FATAL_PHP, PENDING_DIR_NOT_WRITABLE...) : tout est deja dans body.
  if (body) {
    return JSON.stringify({ error: 'BACKEND_ERREUR', http_status: status, reponse_serveur: body });
  }

  // CAS 2 — aucune reponse : la, oui, le backend est vraiment injoignable.
  return JSON.stringify({
    error: 'BACKEND_INJOIGNABLE',
    detail: (e && e.message) || null,
    http_status: status,
    endpoint: ENDPOINT,
    cause_probable: "Aucune reponse HTTP recue (DNS, reseau, ou service arrete). Si le serveur avait repondu, son message figurerait ici."
  });
}"""

if code.count(AVANT) != 1:
    raise SystemExit('Ancre catch introuvable ou multiple : %d' % code.count(AVANT))
code = code.replace(AVANT, APRES)
node['parameters']['jsCode'] = code

out = json.dumps(wf, ensure_ascii=False, indent=2)
with io.open(PATH, 'w', encoding='utf-8') as f:
    f.write(out)
print('✅ v35.1 — le noeud relaie le diagnostic du serveur au lieu de l\'inventer')
print('   fichier : %d -> %d octets' % (len(ORIGINAL), len(out)))
