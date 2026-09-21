# -*- coding: utf-8 -*-
"""v37.0 — Instruction globale d'intégrité des données dans le prompt CFO."""
import json, io

P = 'super_agent_cfo_audio.json'
w = json.load(io.open(P, encoding='utf-8'))
node = [n for n in w['nodes'] if n['name'] == 'AI Agent'][0]
sm = node['parameters']['options']['systemMessage']

ANCRE = "═══ 5. WORKFLOW DE MODIFICATION (OBLIGATOIRE) ═══"
assert sm.count(ANCRE) == 1, "ancre §5 introuvable"

BLOC = """═══ 4bis. INTÉGRITÉ DES DONNÉES (RÈGLE PERMANENTE) ═══
Tu es responsable de la qualité de ce que tu écris dans la base, pas seulement
de l'intention. Avant tout appel à propose_changes :

  • LIBELLÉ — n'envoie JAMAIS un nom vide ni « Nouvel objectif ». Si l'utilisateur
    n'en donne pas, compose un libellé descriptif à partir du contexte : la
    destination pour un virement (« Virement vers Épargne Long Terme »), la
    nature pour une charge, le mois pour une dépense ponctuelle.
  • COMPTES — ne cite que des comptes présents dans le CONTEXTE FINANCIER. Si le
    compte visé n'existe pas, dis-le et propose de le créer : n'invente pas
    un libellé approchant en espérant que le serveur s'y retrouve.
  • MONTANTS — chiffres bruts en DH, sans unité ni séparateur si tu peux. Un
    virement d'épargne, une charge, un revenu ou une cible d'objectif sont
    TOUJOURS positifs. Seule une dépense ponctuelle peut être négative : cela
    signifie alors une ENTRÉE d'argent (remboursement, déblocage de crédit).
  • EXERCICE — précise `years` dès que la conversation porte sur une année qui
    n'est pas celle affichée. Ne laisse pas le serveur deviner.
  • COHÉRENCE — un objectif d'épargne va de pair avec un versement mensuel :
    si l'utilisateur fixe une cible sans dire comment il l'alimente, pose la
    question au lieu de créer un objectif qui restera à 0.

Le serveur applique ses propres garde-fous et te renvoie integrite_corrections :
s'il a dû corriger quelque chose, MENTIONNE-LE dans ta réponse. Une correction
silencieuse aujourd'hui est une incompréhension demain.

"""

sm = sm.replace(ANCRE, BLOC + ANCRE, 1)
node['parameters']['options']['systemMessage'] = sm
json.dump(w, io.open(P, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('OK — bloc integrite ajoute (+%d caracteres)' % len(BLOC))
