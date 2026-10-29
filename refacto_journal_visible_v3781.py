#!/usr/bin/env python3
"""v37.81 — CE QUE LE JOURNAL A DÉJÀ RÉGLÉ SE VOIT SUR SA LIGNE DU PILOTAGE.

« Toujours ce problème d'élec. » Depuis la v37.78 le journal règle la ligne (221 DH de « Société Régionale
  Mult » sur « elect »), mais la case restait vide, « Saisir », sans rien dire : on ne voyait pas que les
  221 étaient comptés, ni qu'il en reste 129 sur 350.

  La ligne dit maintenant « 🧾 221 DH réglés par le journal » ; la case, vide, propose « 221 🧾 » ; le
  montant restant (« / 350 ») reste celui du prévu. Pour clore la ligne quand le prévu est trop haut
  (350 attendus, 221 payés) : le bouton ✓ « clôturer » existe déjà.
"""
import io, sys
F = 'index.html'
src = io.open(F, encoding='utf-8').read()
def sub(label, old, new):
    global src
    c = src.count(old)
    if c != 1:
        print(f'✖ {label} : {c} ancre(s), 1 attendue'); sys.exit(1)
    src = src.replace(old, new)

sub('tâche : réglé par le journal',
"""                                regle: getPaidAmount(ref, d, cyc) || 0,""",
"""                                regle: getPaidAmount(ref, d, cyc) || 0,
                                parJournal: regleParJournal(ref, cyc),   // v37.81 : ce que le journal a déjà réglé, visible sur la ligne""")
sub('case : placeholder',
""":placeholder="t.sens === 'credit' ? 'reçu' : ((t.nature === 'variable' || t.nature === 'exceptionnel') ? 'Saisir' : 'avance')\"""",
""":placeholder="t.parJournal > 0 && t.sens !== 'credit' ? formatNombre(t.parJournal) + ' 🧾' : (t.sens === 'credit' ? 'reçu' : ((t.nature === 'variable' || t.nature === 'exceptionnel') ? 'Saisir' : 'avance'))\"""")
sub('ligne : badge journal',
"""                                                    <span v-if="t.sens === 'credit'" data-entree-montant""",
"""                                                    <span v-if="t.parJournal > 0 && t.sens !== 'credit'" data-par-journal class="text-[10px] font-black px-1.5 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shrink-0 whitespace-nowrap"
                                                          :title="'Des opérations du journal rangées sur « ' + t.libelle + ' » ce cycle : ' + formatNombre(t.parJournal) + ' DH, comptés comme réglés'">🧾 {{ formatNombre(t.parJournal) }} réglés</span>
                                                    <span v-if="t.sens === 'credit'" data-entree-montant""")
io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.81 : ce que le journal a réglé se voit sur la ligne')
