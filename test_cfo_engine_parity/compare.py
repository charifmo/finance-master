# -*- coding: utf-8 -*-
"""Comparaison différentielle JS (moteur d'origine) vs PHP (port serveur)."""
import json, re, sys, os
D = os.path.dirname(os.path.abspath(__file__))
js = json.load(open(os.path.join(D,'out_js.json'), encoding='utf-8'))
ph = json.load(open(os.path.join(D,'out_php.json'), encoding='utf-8'))

def canon(o, path=""):
    """Neutralise ce qui est volatil par construction : identifiants horodatés
       et suffixes base36 des clés techniques générées sur les 'add'."""
    if isinstance(o, dict):
        r = {}
        for k, v in o.items():
            kk = k
            if re.match(r'^[a-z0-9_]+_[a-z0-9]{4}$', str(k)): kk = re.sub(r'_[a-z0-9]{4}$', '_*', k)
            if re.match(r'^ep_\d{10,}$', str(k)): kk = 'ep_<id>'
            if k == 'id': r[kk] = '<id>'
            elif k in ('key','removed_id') and isinstance(v,str) and re.match(r'^[a-z0-9_]+_[a-z0-9]{4}$', v):
                r[kk] = re.sub(r'_[a-z0-9]{4}$', '_*', v)
            elif k == 'key' and isinstance(v,str) and re.match(r'^ep_\d{10,}$', v): r[kk] = 'ep_<id>'
            else: r[kk] = canon(v, path + '.' + str(k))
        return r
    if isinstance(o, list): return [canon(x, path) for x in o]
    if isinstance(o, float) and o == int(o): return int(o)
    return o

# Clés que le PHP ajoute VOLONTAIREMENT et que le JS d'origine ne pouvait pas
# produire. Elles n'altèrent aucun calcul — l'état muté reste comparé à
# l'identique — mais exposent une décision jusque-là implicite.
#   v35.5 : l'exercice retenu par défaut et sa provenance. Le JS retombait en
#   silence sur l'horloge du serveur ; c'est précisément le bug corrigé, donc
#   la parité ne peut pas exiger de reproduire ce silence.
#   v35.6 : la trace de résolution demandé→résolu (compte, objectif, épargne,
#   ...), succès compris. Le JS ne l'a jamais produite — aucune trace de ce
#   qu'il résolvait réellement n'existait avant ce ticket.
#   v36.0 : le rapport de normalisation des arguments (alias redressés, types
#   convertis, paramètres ignorés). Le JS n'avait aucun contrat d'arguments —
#   il lisait chaque clé à la main, donc n'avait rien à rapporter.
AJOUTS_PHP_ASSUMES = {
    'res.annee_defaut_utilisee',
    'res.annee_defaut_source',
    'res.exercices_touches',
    'res.resolutions',
    'res.arguments_normalises',
#   v36.0 : le relevé littéral des écritures, produit par le serveur pour que la
#   confirmation lue à l'utilisateur ne dépende plus de la mémoire du modèle.
    'res.operations_appliquees',
#   v37.0 : les corrections d'intégrité appliquées à l'écriture (libellé vide
#   auto-nommé, montant retypé, compte lié fantôme délié). Le JS n'avait aucune
#   couche d'intégrité — il écrivait ce qu'on lui donnait.
    'res.integrite_corrections',
}

# v36.0 — Clés v19 d'un Smart Goal que le PHP écrit désormais EN PLUS du schéma
# historique. L'application lit en priorité montant_cible/montant_actuel/libelle
# et ne retombe sur target/current/name que s'ils sont absents (migrateGoalV19,
# index.html) : n'écrire que le legacy rendait toute modification d'un objectif
# déjà migré INVISIBLE à l'écran. Les valeurs métier restent comparées au JS —
# seule la présence des doublons de schéma est tolérée, et un test dédié
# (test_schema_goals.php) vérifie qu'ils ne divergent jamais entre eux.
GOAL_V19_KEYS = {'libelle', 'montant_cible', 'montant_actuel', 'type', 'date_cible',
                 'comptesLies', 'versement_mensuel'}
_RE_GOAL = re.compile(r'^etat\.wealthGoals\[\d+\]\.(\w+)$')

# v36.0 — update_smart_goal entre au catalogue : la liste renvoyée en cas
# d'appel hors catalogue compte donc une entrée de plus que la référence JS.
#
# v37.0 — LE JS DE RÉFÉRENCE PORTE LE BUG, ET C'EST TOUT L'ENJEU.
# Le moteur d'origine purgeait la clé `nom` de chaque ligne d'épargne, en la
# traitant comme un simple synonyme de `label`. Or c'est `obj.nom` que le
# template Vue affiche (index.html:2408 desktop, 3569 mobile) : chaque commit
# vidait donc le champ « Nom de l'objectif » de toutes les lignes. Le PHP ne
# purge plus cette clé. La parité ne peut pas exiger de reproduire un bug qui
# efface l'affichage — ces trois écarts sont la CORRECTION, pas une régression.
VALEURS_PHP_ASSUMEES = {
    'res.catalogue',
    'res.sanitize_report.pre.epargne',
    'res.sanitize_report.post.epargne',
    'res.sanitize_report.total_purged',
}
_RE_EPARGNE_NOM = re.compile(r'^etat\.donneesAnnuelles\.\d{4}\.epargne\[\d+\]\.nom$')

def diff(a, b, p=""):
    out = []
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b)):
            chemin = "%s.%s" % (p, k)
            if k not in a and chemin in AJOUTS_PHP_ASSUMES: continue
            m = _RE_GOAL.match(chemin)
            if k not in a and m and m.group(1) in GOAL_V19_KEYS: continue
            if chemin in VALEURS_PHP_ASSUMEES: continue
            # v37.0 : `nom` désormais conservé sur les lignes d'épargne (voir ci-dessus).
            if k not in a and _RE_EPARGNE_NOM.match(chemin): continue
            if k not in a: out.append("%s.%s: absent JS" % (p, k))
            elif k not in b: out.append("%s.%s: absent PHP" % (p, k))
            else: out += diff(a[k], b[k], "%s.%s" % (p, k))
    elif isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b): out.append("%s: longueur %d vs %d" % (p, len(a), len(b)))
        else:
            for i, (x, y) in enumerate(zip(a, b)): out += diff(x, y, "%s[%d]" % (p, i))
    elif a != b: out.append("%s: JS=%r PHP=%r" % (p, a, b))
    return out

ok = 0; ko = []
print("%-46s%-11s%s" % ('CAS', 'RÉSULTAT', 'ÉTAT MUTÉ'))
print("-" * 76)
for nom in js:
    dr = diff(canon(js[nom]['resultat']), canon(ph[nom]['resultat']), "res")
    de = diff(canon(js[nom]['etat']),      canon(ph[nom]['etat']),      "etat")
    print("%-46s%-11s%s" % (nom[:45], '✅' if not dr else '❌', '✅' if not de else '❌'))
    if dr or de: ko.append((nom, dr[:6], de[:6]))
    else: ok += 1
print("-" * 76)
print("  %d/%d cas strictement identiques (résultat ET état muté)" % (ok, len(js)))
for nom, dr, de in ko:
    print("\n▸ " + nom)
    for x in dr: print("   res ", x)
    for x in de: print("   etat", x)
sys.exit(0 if not ko else 1)
