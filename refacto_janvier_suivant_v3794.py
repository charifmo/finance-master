#!/usr/bin/env python3
"""v37.94 — LE CYCLE DE JANVIER SUIVANT FAIT PARTIE DU CALCUL DE L'ANNÉE.

« Je viens d'appuyer sur Recalculer, mais il reste tout ça sans nettoyage. » Les deux virements du 28 décembre 2027
  (9 100 d'Assafa vers le Courant, 6 000 du Courant vers Assafa : un aller-retour d'anciens calculs) alimentent le
  cycle de JANVIER 2028 — et votre 2028 existe déjà : la v37.92 ne les retirait que si l'année suivante manquait.

  Désormais « Alimenter le Courant » pour 2027 traite aussi le cycle de janvier 2028 (son virement se pose le jour
  de paie de décembre 2027, il est dans les virements de 2027) : les anciens virements salaire ↔ Courant de ce cycle
  sont retirés, et, si l'année suivante existe, le montant juste est calculé et posé (le plan affiche « Janvier
  2028 »). Sans année suivante, ils sont seulement retirés (comme en v37.92).
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

sub('résidu : le cycle de janvier suivant, que l année suivante existe ou non',
"""                                const residu = sansSuivante && y === a && c.a === a + 1 && c.m === 1;""",
"""                                const residu = y === a && c.a === a + 1 && c.m === 1;   // v37.94 : que l'année suivante existe ou non""")
sub('cycles : janvier suivant calculé si l année suivante existe',
"""                        const cles = []; for (let m = mb.mois, y = mb.an; y < a || (y === a && m <= 12); ) { cles.push(m + '-' + y); m++; if (m > 12) { m = 1; y++; } }
                        let n = 0;
                        cycles.forEach(M => {
                            const cle = M + '-' + a, i = cles.indexOf(cle), dv = _dateVirementDuCycle(M, a);""",
"""                        const cles = []; for (let m = mb.mois, y = mb.an; y < a || (y === a && m <= 12); ) { cles.push(m + '-' + y); m++; if (m > 12) { m = 1; y++; } }
                        //  v37.94 : le cycle de janvier SUIVANT (son virement se pose fin décembre de cette année) — calculé si l'année suivante existe
                        const paires = cycles.map(M => [M, a]);
                        if (!sansSuivante) { paires.push([1, a + 1]); cles.push('1-' + (a + 1)); }
                        let n = 0;
                        paires.forEach(([M, A]) => {
                            const cle = M + '-' + A, i = cles.indexOf(cle), dv = _dateVirementDuCycle(M, A);""")
sub('plan : l année du cycle',
"""                            const ligne = { cycle: M, montant, le: dv.jour + ' ' + _MOIS_COURTS[dv.mois - 1] + ' ' + dv.an };""",
"""                            const ligne = { cycle: M, an: A, montant, le: dv.jour + ' ' + _MOIS_COURTS[dv.mois - 1] + ' ' + dv.an };""")
sub('écran : « Janvier 2028 »',
"""{{ nomDuMois(p.cycle) }} : {{ p.montant ? formatMAD(p.montant) + ' le ' + p.le : 'rien' }}""",
"""{{ nomDuMois(p.cycle) }}{{ p.an && p.an !== anneeAffichage ? ' ' + p.an : '' }} : {{ p.montant ? formatMAD(p.montant) + ' le ' + p.le : 'rien' }}""")
io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.94 : le cycle de janvier suivant fait partie du calcul de l année')
