#!/usr/bin/env python3
"""v37.80 — LE MÊME JOUR, L'ARGENT ARRIVE AVANT DE PARTIR · LA GRANDE CASE DIT OÙ ELLE REGARDE.

« Pourquoi c'est désynchronisé ? » Le Relevé et « Vos comptes » s'arrêtent à la fin du cycle (26 nov.) :
  le Courant y finit à + 578. La grande case des virements regarde jusqu'au 26 déc. : le 27 nov., la paie
  ouvre le cycle de décembre, son premier morceau de semaine (27 → 29 nov.) est pris sur le Courant dès le
  27, et le virement d'Assafa n'arrive que le 28 — − 1 249 un seul jour.

  1. Le même jour, les ENTRÉES passent avant les sorties (salaire, virement reçu, puis les dépenses) : un
     virement posé le jour de paie couvre les dépenses de ce jour.
  2. La grande case et le radar disent quand le point bas tombe APRÈS le cycle affiché : « c'est le
     27 nov., au début du cycle suivant — Vos comptes et le Relevé de ce cycle s'arrêtent au 26 nov. »
  3. Quand la première entrée qui suit le point bas est un virement qui suffit, ils le disent : « Avancez
     ce virement au 27 nov. : le compte ne passe plus sous zéro. »
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

sub('même jour : entrées d abord',
"""                            dispLegs.sort((x, y) => _cSort(x.jourPrevu) - _cSort(y.jourPrevu));""",
"""                            //  v37.80 : le même jour, les entrées d'abord (salaire, virement reçu), puis les sorties
                            dispLegs.sort((x, y) => _cSort(x.jourPrevu) - _cSort(y.jourPrevu) || ((y.type === 'credit') - (x.type === 'credit')));""")

sub('radar : après le cycle, et le virement à avancer',
"""                                if (deb.length) pourquoi = {""",
"""                                //  v37.80 : le point bas tombe-t-il APRÈS le cycle affiché ? et la première entrée qui suit
                                //  est-elle un virement qui suffit — à avancer au jour où le compte passe sous zéro ?
                                const _finCycle = (consoT0Fenetre.value || {}).fin;
                                const _dBas = lignes[iBas - 1].date;
                                //  avancer : seulement après la paie (le compte passe sous zéro APRÈS la fin du cycle — le donneur a
                                //  reçu le salaire) ; avant, rien ne dit que l'argent du virement est déjà là
                                const _apresPaie = !!(_finCycle && dateNeg && dateNeg > _finCycle);
                                const _vir = _apresPaie && ent[0] && /^🔄/.test(String(ent[0].libelle || '')) && ent[0].montant >= -pointBas ? ent[0] : null;
                                if (deb.length) pourquoi = {
                                    apresCycle: !!(_finCycle && _dBas && _dBas > _finCycle), finCycle: _finCycle ? lib(_finCycle) : null,
                                    avancer: _vir && dateNeg ? { libelle: court(_vir.libelle), montant: Math.round(_vir.montant), de: lib(_vir.date), a: lib(dateNeg) } : null,""")

sub('radar : affiché',
"""                <template v-if="c.pourquoi.entrees.length"> avant les prochaines entrées : {{ c.pourquoi.entrees.map(x => x.libelle + ' ' + formatMad(x.montant) + ' le ' + x.quand).join(', ') }}</template><template v-else> — et plus aucune entrée prévue d’ici le {{ radar.horizon }}</template>
            </p>""",
"""                <template v-if="c.pourquoi.entrees.length"> avant les prochaines entrées : {{ c.pourquoi.entrees.map(x => x.libelle + ' ' + formatMad(x.montant) + ' le ' + x.quand).join(', ') }}</template><template v-else> — et plus aucune entrée prévue d’ici le {{ radar.horizon }}</template>
                <span v-if="c.pourquoi.apresCycle" class="block mt-0.5 text-slate-500" data-radar-apres-cycle>⏭️ C’est au début du cycle suivant, après le {{ c.pourquoi.finCycle }} : le Relevé de ce cycle s’arrête avant.</span>
                <span v-if="c.pourquoi.avancer" class="block mt-0.5 font-black text-emerald-700" data-radar-avancer>💡 Avancez « {{ c.pourquoi.avancer.libelle }} » ({{ formatMad(c.pourquoi.avancer.montant) }}) du {{ c.pourquoi.avancer.de }} au {{ c.pourquoi.avancer.a }} : le compte ne passe plus sous zéro.</span>
            </p>""")

sub('grande case : affiché',
"""                                <p v-if="b.pourquoi" class="text-[11px] text-slate-500 font-semibold" data-meteo-virement-pourquoi>""",
"""                                <p v-if="b.pourquoi && b.pourquoi.apresCycle" class="text-[11px] font-black text-indigo-700" data-meteo-virement-apres-cycle>⏭️ C’est au début du cycle suivant, après le {{ b.pourquoi.finCycle }} — « Vos comptes » et le Relevé de ce cycle s’arrêtent avant.</p>
                                <p v-if="b.pourquoi && b.pourquoi.avancer" class="text-[11px] font-black text-emerald-700" data-meteo-virement-avancer>💡 Plutôt : avancez « {{ b.pourquoi.avancer.libelle }} » ({{ formatMad(b.pourquoi.avancer.montant) }}) du {{ b.pourquoi.avancer.de }} au {{ b.pourquoi.avancer.a }} — le compte ne passe plus sous zéro.</p>
                                <p v-if="b.pourquoi" class="text-[11px] text-slate-500 font-semibold" data-meteo-virement-pourquoi>""")

io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.80 : le même jour, les entrées d’abord ; la grande case dit où elle regarde et quel virement avancer')
