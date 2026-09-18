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
AJOUTS_PHP_ASSUMES = {
    'res.annee_defaut_utilisee',
    'res.annee_defaut_source',
    'res.exercices_touches',
    'res.resolutions',
}

def diff(a, b, p=""):
    out = []
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a and ("%s.%s" % (p, k)) in AJOUTS_PHP_ASSUMES: continue
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
