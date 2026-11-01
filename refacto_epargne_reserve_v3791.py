#!/usr/bin/env python3
"""v37.91 — L'ÉPARGNE ADAPTÉE GARDE DE QUOI PAYER LES VIREMENTS PONCTUELS À VENIR.

« C'est quoi ce massacre ! » Après « adapter l'épargne au potentiel », Compte Principale ASSAFA finissait 2027 à
  − 44 919 et Compte urgence à 146 085. Chaque mois, l'épargne prenait TOUT le potentiel du mois ; mais en décembre
  partent d'un coup 63 000 DH (40 000 + 20 000 vers urgence, 3 000 vers Long Terme) qui, eux, se paient avec ce
  qui s'est ACCUMULÉ pendant l'année. Plus rien ne s'accumulait : décembre était à − 50 243, la moyenne du Bilan à
  − 4 182 « par mois ».

  Désormais l'adaptation lit l'année entière : un mois dont le potentiel ne suffit pas (un gros virement ponctuel,
  une dépense lourde) se prépare dans les mois d'avant. On garde en réserve, à la fin de chaque mois, ce qu'il
  faudra pour les mois déficitaires qui suivent ; l'épargne du mois prend le reste. Le cumul ne passe jamais sous
  zéro : ce que l'année dégage va à l'épargne, une seule fois.
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

sub('adaptation : réserve pour les mois déficitaires à venir',
"""                        const valeurs = {};
                        mois.forEach(m => {
                            const marge = potentielEpargneDuMois(a, m) - epargneDuMoisHors(a, m, obj);
                            let v = Math.max(0, Math.floor(marge / 10) * 10);
                            if (cap !== null) v = Math.min(v, cap);
                            valeurs[m] = v;
                        });""",
"""                        const valeurs = {};
                        /*  v37.91 — L'ANNÉE ENTIÈRE, PAS MOIS PAR MOIS. libre(m) = potentiel − les autres épargnes et virements
                            ponctuels du mois (négatif en décembre quand 63 000 partent d'un coup). reserve(m) = ce qu'il faut
                            garder à la fin du mois m pour les mois déficitaires qui suivent. L'épargne du mois prend ce qui
                            dépasse la réserve ; le cumul ne passe jamais sous zéro. */
                        const libre = {};
                        mois.forEach(m => { libre[m] = Math.floor((potentielEpargneDuMois(a, m) - epargneDuMoisHors(a, m, obj)) / 10) * 10; });
                        const reserve = {};
                        for (let i = mois.length - 1; i >= 0; i--) {
                            const m = mois[i], suivant = mois[i + 1];
                            reserve[m] = suivant === undefined ? 0 : Math.max(0, reserve[suivant] - libre[suivant]);
                        }
                        let cumul = 0;
                        mois.forEach(m => {
                            let v = Math.max(0, Math.floor((cumul + libre[m] - reserve[m]) / 10) * 10);
                            if (cap !== null) v = Math.min(v, cap);
                            valeurs[m] = v;
                            cumul += libre[m] - v;
                        });""")
io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.91 : épargne adaptée avec réserve pour les virements ponctuels à venir')
