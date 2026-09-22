# -*- coding: utf-8 -*-
"""
v37.3 — Authentification Caddy dans les nœuds n8n qui appellent /finance/.

Depuis que basic_auth protège /finance/, tout appel sans en-tête Authorization
reçoit un 401 : le CFO ne peut plus ni lire l'état, ni committer, ni écrire une
transaction réelle. Trois nœuds sont concernés (le quatrième, Intent Compiler,
a déjà été corrigé à la main par l'utilisateur).

LES IDENTIFIANTS NE SONT PAS ÉCRITS DANS LE NŒUD.
  Un secret inscrit dans le code part dans l'export JSON du workflow — donc
  dans ce dépôt Git, et dans son historique pour toujours. Le bloc lit deux
  variables d'environnement n8n (FINANCE_USER / FINANCE_PASS) et n'expose
  aucune valeur. Si elles sont absentes, authHeader reste vide et la requête
  part comme avant : on ne casse rien, on échoue là où on échouait déjà.
"""
import json, io, re

P = 'super_agent_cfo_audio.json'

PREAMBULE = """// ── v37.3 : authentification Caddy (basic_auth sur /finance/) ──────────
//  Les identifiants viennent des variables d'environnement n8n, JAMAIS du
//  code : un secret écrit ici partirait dans l'export JSON du workflow.
//  Définir sur le serveur n8n : FINANCE_USER et FINANCE_PASS.
let authHeader = '';
try {
  const u = $env.FINANCE_USER, p = $env.FINANCE_PASS;
  if (u && p) authHeader = 'Basic ' + Buffer.from(u + ':' + p).toString('base64');
} catch (e) { /* $env indisponible : on part sans en-tête, comme avant */ }
const authHeaders = authHeader ? { Authorization: authHeader } : {};

"""

# (nœud, ancre, remplacement) — ancres vérifiées avant écriture
PATCHS = [
 ('Normalize Input',
  """    const fetched = await this.helpers.httpRequest({
      method: 'GET',
      url: 'https://n8n.beau.ink/finance/save_data.php',
      json: true,
      timeout: 10000
    });""",
  """    const fetched = await this.helpers.httpRequest({
      method: 'GET',
      url: 'https://n8n.beau.ink/finance/save_data.php',
      headers: { ...authHeaders },
      json: true,
      timeout: 10000
    });"""),

 ('Tool: Committer',
  """  pending = await this.helpers.httpRequest({
    method: 'GET',
    url: PENDING_URL + '?session_id=' + encodeURIComponent(session_id),
    json: true,
    timeout: 10000
  });""",
  """  pending = await this.helpers.httpRequest({
    method: 'GET',
    url: PENDING_URL + '?session_id=' + encodeURIComponent(session_id),
    headers: { ...authHeaders },
    json: true,
    timeout: 10000
  });"""),

 ('Tool: Committer',
  """    headers: { 'Content-Type': 'application/json' },
    timeout: 15000
  });""",
  """    headers: { 'Content-Type': 'application/json', ...authHeaders },
    timeout: 15000
  });"""),

 ('Tool: Committer',
  """    method: 'DELETE',
    url: PENDING_URL + '?session_id=' + encodeURIComponent(session_id),
    json: true,
    timeout: 5000
  });""",
  """    method: 'DELETE',
    url: PENDING_URL + '?session_id=' + encodeURIComponent(session_id),
    headers: { ...authHeaders },
    json: true,
    timeout: 5000
  });"""),

 ('Tool: Transactions Réelles',
  """      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });""",
  """      headers: { 'Content-Type': 'application/json', ...authHeaders },
      timeout: 15000
    });"""),
]

w = json.load(io.open(P, encoding='utf-8'))
idx = {n['name']: n for n in w['nodes']}

# 1. Vérifier TOUTES les ancres avant de toucher quoi que ce soit
for nom, old, _ in PATCHS:
    if nom not in idx: raise SystemExit(f"Nœud absent : {nom}")
    code = idx[nom]['parameters'].get('jsCode', '')
    c = code.count(old)
    if c != 1: raise SystemExit(f"ANCRE dans « {nom} » : {c} occurrence(s) au lieu de 1\n---\n{old[:200]}")
print("✅ 5 ancres vérifiées, 1 occurrence chacune")

# 2. Appliquer
touches = set()
for nom, old, new in PATCHS:
    idx[nom]['parameters']['jsCode'] = idx[nom]['parameters']['jsCode'].replace(old, new, 1)
    touches.add(nom)

# 3. Préambule en tête de chaque nœud touché (une seule fois)
for nom in touches:
    code = idx[nom]['parameters']['jsCode']
    if 'authHeader' not in code.split('\n')[0:20][0] and 'v37.3 : authentification Caddy' not in code:
        idx[nom]['parameters']['jsCode'] = PREAMBULE + code

json.dump(w, io.open(P, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print("✅ nœuds patchés : " + ', '.join(sorted(touches)))
