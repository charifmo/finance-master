# -*- coding: utf-8 -*-
"""
v37.24 Une-Seule-Saisie — PARTIE MOTEUR.

  La carte « Reste à dépenser » absorbe l'ancien bloc « Réalisé à T0 ». Elle
  doit donc aussi savoir EXPLIQUER son chiffre, comme le faisait la bulle
  « Disponible réel » de ce bloc : 🅰️ budget − engagé, 🅱️ trésorerie, et le
  plus contraignant des deux. Le moteur ne change pas : on expose ses termes.
"""
import io, sys
F = 'index.html'
src = io.open(F, encoding='utf-8').read()
edits = []
def sub(label, anchor, replacement, expected=1):
    n = src.count(anchor)
    if n != expected:
        print(f'✖ {label} : {n} ancre(s), {expected} attendue(s)'); sys.exit(1)
    edits.append((anchor, replacement))

sub('les termes du calcul', """                            declare, compteur: consoCompteurRenseigne.value, nbTickets:""",
    """                            //  v37.24 : de quoi expliquer le chiffre (ex-bulle « Disponible réel »)
                            calcul: {
                                treso: Math.round(tresoActuelleCourante.value),
                                revenusAttente: Math.round(revenusEnAttenteCourant.value),
                                obligations: Math.round(obligationsCourantHorsConso.value),
                                engageDeclare: categories.filter(c => c.declare).reduce((s, c) => s + c.engage, 0),
                                engageEstime: categories.filter(c => !c.declare).reduce((s, c) => s + c.engage, 0),
                            },
                            declare, compteur: consoCompteurRenseigne.value, nbTickets:""")

for a, r in edits: src = src.replace(a, r, 1)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ {len(edits)} modification(s) appliquée(s) à {F}')
