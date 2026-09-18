# -*- coding: utf-8 -*-
"""
v36.0 — Le prompt doit exploiter les nouveaux garde-fous du moteur.

Sans ça, le backend renvoie arguments_normalises, operations_appliquees,
ERROR_ARGUMENTS_INCOMPLETS et ERROR_ETANCHEITE_EXERCICE... que l'agent ignore
poliment. Le §5 impose désormais de lire le RELEVÉ DU SERVEUR à l'utilisateur
avant de demander OUI : c'est ce qui rend une interversion de montants visible
AVANT la validation, alors qu'elle était jusqu'ici invisible jusqu'à ce que
l'utilisateur rouvre l'application.
"""
import json, io

P = 'super_agent_cfo_audio.json'
w = json.load(io.open(P, encoding='utf-8'))
node = [n for n in w['nodes'] if n['name'] == 'AI Agent'][0]
sm = node['parameters']['options']['systemMessage']

OLD = """Tour 1 — Simulation :
  1. Appelle propose_changes.
  2. Si clarifications_needed, error_ops ou redistribution_required non vide → gère l'erreur / pose la question. NE propose PAS OUI.
  3. Si pending_saved=true → présente le delta en HTML et termine EXACTEMENT par :
     « <b>Confirmez-vous ? Tapez <span style="color:#059669">OUI</span> pour exécuter.</b> »
  4. Si auto_cloned_years non vide → mentionne que les années ont été auto-créées (ex: « Années 2027-2029 créées automatiquement à partir de 2026 »).
  5. INTERDICTION ABSOLUE : demander OUI sans avoir reçu pending_saved=true au tour courant."""

NEW = """Tour 1 — Simulation :
  1. Appelle propose_changes. Un appel = une opération autonome : ses args ne
     concernent QUE lui. Ne réutilise jamais le montant d'un appel dans un autre.
  2. Si clarifications_needed, error_ops ou redistribution_required non vide → gère l'erreur / pose la question. NE propose PAS OUI.
  3. Si pending_saved=true → présente le delta en HTML et termine EXACTEMENT par :
     « <b>Confirmez-vous ? Tapez <span style="color:#059669">OUI</span> pour exécuter.</b> »
  4. Si auto_cloned_years non vide → mentionne que les années ont été auto-créées (ex: « Années 2027-2029 créées automatiquement à partir de 2026 »).
  5. INTERDICTION ABSOLUE : demander OUI sans avoir reçu pending_saved=true au tour courant.

  6. LE RELEVÉ DU SERVEUR FAIT FOI, PAS TA MÉMOIRE (v36.0).
     La réponse contient operations_appliquees : la liste de ce que le serveur a
     RÉELLEMENT écrit (exercice, cible résolue, avant, après). Construis ton
     récapitulatif À PARTIR DE CE TABLEAU, jamais à partir de ce que tu croyais
     avoir demandé. Nomme chaque cible et chaque montant tels qu'ils y figurent.
     Si une ligne ne correspond pas à l'intention de l'utilisateur (mauvaise
     poche, montants intervertis, mauvais exercice) : signale-le et propose la
     correction AU LIEU de demander OUI.
  7. resolutions[] indique, pour chaque nom approximatif, la cible réellement
     retenue (demande → resolu). Si un « resolu » n'est pas celui attendu, dis-le.
  8. arguments_normalises liste ce que le serveur a redressé (alias, montants
     texte) et surtout ce qu'il a IGNORÉ. Un paramètre dans « inconnus » n'a PAS
     été pris en compte : corrige son nom et relance plutôt que d'annoncer un
     résultat qui n'a pas eu lieu.
  9. Erreurs structurantes, à traiter sans insister :
     • ERROR_ARGUMENTS_INCOMPLETS → parametres_manquants dit quoi ajouter, et
       parametres_attendus donne la signature complète. Rien n'a été écrit.
     • ERROR_ETANCHEITE_EXERCICE  → un exercice non ciblé a bougé : le lot a été
       refusé en bloc. Ne réessaie pas à l'identique, signale-le à l'utilisateur.
     • ERROR_OUT_OF_CATALOG       → la fonction n'existe pas. Ne la contourne pas
       avec une autre : dis qu'elle doit être développée."""

assert sm.count(OLD) == 1, "ancre §5 introuvable"
sm = sm.replace(OLD, NEW, 1)

node['parameters']['options']['systemMessage'] = sm
json.dump(w, io.open(P, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('OK — prompt AI Agent mis a jour (+%d caracteres)' % (len(NEW) - len(OLD)))
