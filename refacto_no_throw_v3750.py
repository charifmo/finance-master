# -*- coding: utf-8 -*-
"""
v37.5 — Un outil qui LÈVE une exception tue l'agent entier.

Le nœud « AI Agent » porte continueOnFail : quand un outil jette, n8n émet un
item sans clé `output`, le responder construit une réponse sans `html`, et
l'utilisateur reçoit {"session_id":"..."} — sans la moindre indication de ce
qui a échoué. C'est le symptôme observé deux fois en production.

Le `throw` de la phase 3 visait à empêcher le modèle d'enchaîner sur une autre
fonction après un appel hors catalogue. L'intention était bonne, le moyen
mauvais : on obtient le silence au lieu d'un refus explicite. On RETOURNE
désormais l'erreur, avec la consigne de ne pas substituer et le catalogue réel.
Le modèle peut alors l'expliquer à l'utilisateur — ce qu'un agent mort ne peut
pas faire.
"""
import json, io

P = 'super_agent_cfo_audio.json'
w = json.load(io.open(P, encoding='utf-8'))
n = [x for x in w['nodes'] if x['name'] == 'Tool: Intent Compiler'][0]
code = n['parameters']['jsCode']

PATCHS = [
 ("""    throw new Error('ERROR_OUT_OF_CATALOG: ' + (body.message || "L'action demandee n'existe pas dans le catalogue."));""",
  """    // v37.5 : on RETOURNE au lieu de jeter — une exception ici tue l'agent
    //   entier et l'utilisateur ne recoit aucune explication.
    return JSON.stringify({
      error: 'ERROR_OUT_OF_CATALOG',
      message: body.message || "L'action demandee n'existe pas dans le catalogue.",
      catalogue: body.catalogue || null,
      consigne: "N'invente PAS de fonction de remplacement. Dis a l'utilisateur que cette action n'existe pas encore et propose de la faire developper."
    });"""),
 ("""  throw new Error('ERROR_OUT_OF_CATALOG: ' + (resp.message || "L'action demandee n'existe pas dans le catalogue."));""",
  """  return JSON.stringify({
    error: 'ERROR_OUT_OF_CATALOG',
    message: resp.message || "L'action demandee n'existe pas dans le catalogue.",
    catalogue: resp.catalogue || null,
    consigne: "N'invente PAS de fonction de remplacement. Dis a l'utilisateur que cette action n'existe pas encore et propose de la faire developper."
  });"""),
]

for old, new in PATCHS:
    c = code.count(old)
    if c != 1:
        raise SystemExit(f"ANCRE : {c} occurrence(s)\n---\n{old[:140]}")
    code = code.replace(old, new, 1)

assert 'throw new Error' not in code, "un throw subsiste"
n['parameters']['jsCode'] = code
json.dump(w, io.open(P, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print("OK — les 2 throw sont remplaces par des retours structures")
