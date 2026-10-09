# -*- coding: utf-8 -*-
"""
v37.37 Surplus-Courant-Reel — le virement qui finance les charges fixes sort du
surplus du Courant.

  Le constat : la modale « Surplus Détaillé » annonce + 22 966 DH de brut en
  novembre. Le Relevé du Courant, lui, montre « 🔄 Virement → Compte Principale
  ASSAFA − 15 000 » : Assafa paie les charges fixes, le Courant l'alimente.

  La cause : le surplus est calculé au périmètre « Compte Courant strict »
  (_getMonthFlux, scope 'courant'). Il retire bien les charges fixes du Courant
  — elles sont payées par Assafa — mais il ignorait les virements internes : le
  virement de 15 000 qui FINANCE ces charges ne sortait pas non plus. Ces
  15 000 disparaissaient du calcul, et le surplus gonflait d'autant, chaque mois.

  La correction : au périmètre Courant, un virement interne qui QUITTE le
  Courant est une sortie, un virement qui y ARRIVE une entrée — dans le BRUT :
  ce n'est pas de l'épargne (« de toute façon je l'utiliserai pour les charges
  fixes »). Même règle de cycle et de pointage que le Relevé : un virement fait
  (pointé) est déjà dans le solde réel, il ne sort pas deux fois. Tous comptes
  confondus (KPI annuels Entrées / Sorties), un virement interne s'annule : il
  reste ignoré. Le moteur PHP du CFO (net mensuel de secours) suit la même règle.
"""
import io, sys

def patch(F, pairs):
    src = io.open(F, encoding='utf-8').read()
    for label, a, b in pairs:
        n = src.count(a)
        if n != 1:
            print(f'✖ {F} — {label} : {n} ancre(s), 1 attendue'); sys.exit(1)
    for label, a, b in pairs: src = src.replace(a, b, 1)
    io.open(F, 'w', encoding='utf-8').write(src)
    print(f'✔ {len(pairs)} modification(s) appliquée(s) à {F}')

patch('index.html', [
('surplus : virements internes', r"""                            if (a > 0) { if (isCreance) entrants += a; else sortants += a; }
                        });
                        return { entrants: Math.round(entrants * 100) / 100, sortants: Math.round(sortants * 100) / 100 };
                    };""", r"""                            if (a > 0) { if (isCreance) entrants += a; else sortants += a; }
                        });
                        //  v37.37 : VIREMENTS INTERNES, au périmètre Courant. Un virement qui QUITTE le
                        //  Courant (vers Assafa, qui paie les charges fixes) est une sortie ; un virement
                        //  qui y ARRIVE, une entrée. Ils étaient ignorés : le périmètre retirait les charges
                        //  payées par un autre compte SANS retirer le virement qui les finance, et le
                        //  surplus gonflait d'autant. Ce n'est pas de l'épargne : il reste dans le brut.
                        //  Pointé (fait), il est déjà dans le solde réel. Tous comptes confondus, un
                        //  virement interne s'annule : ignoré.
                        if (_courantOnly) getVirementsCycle(mNum, annee).forEach(vir => {
                            const due = Math.abs(Number(vir.montant) || 0); if (!due) return;
                            const sort = _isCourant(vir.sourceCompte || 'courant'), arrive = _isCourant(vir.destinationCompte || 'courant');
                            if (sort === arrive) return;          // ne touche pas le Courant, ou Courant → Courant
                            const cle = _cleCycle(mNum, annee);
                            let a;
                            if (isItemPaid(vir, due, cle)) a = 0; else { const r = due - (getPaidAmount(vir, due, cle) || 0); a = r > 0 ? r : 0; }
                            if (a > 0) { if (sort) sortants += a; else entrants += a; }
                        });
                        return { entrants: Math.round(entrants * 100) / 100, sortants: Math.round(sortants * 100) / 100 };
                    };"""),
('surplus : formule dite', r"""                    // v18.40 / v20.95 : Surplus BRUT mois par mois (exceptions incluses, épargne exclue)
                    // L'épargne est une réallocation patrimoniale, pas une charge consommée.
                    // Formule : Revenus - Charges fixes - Charges variables (hors épargne)""",
 r"""                    // v18.40 / v20.95 : Surplus BRUT mois par mois (exceptions incluses, épargne exclue)
                    // L'épargne est une réallocation patrimoniale, pas une charge consommée.
                    // Formule : Revenus - Charges fixes - Charges variables (hors épargne)
                    // v37.37 : au périmètre Courant, ± les virements internes qui quittent / rejoignent
                    //   le Courant (celui qui alimente le compte des charges fixes en est un).""")
])

patch('cfo_intent_engine.php', [
('net mensuel : virements internes', r"""        $ep = 0.0;
        foreach ($epArr as $o) $ep += $eff($o, oget($o, 'valeur'), $m);""", r"""        // v37.37 : virements internes — une sortie s'ils QUITTENT le Courant (le virement qui
        //   alimente le compte des charges fixes), une entrée s'ils y ARRIVENT. Pas de l'épargne.
        foreach ((oget($y, 'virementsInternes') ?: []) as $vi) {
            if (!is_object($vi) || (int)oget($vi, 'mois') !== $m) continue;
            $mt = abs((float)(oget($vi, 'montant', 0) ?: 0));
            if ($mt <= 0) continue;
            $sort = $isC(oget($vi, 'sourceCompte') ?: 'courant');
            $arrive = $isC(oget($vi, 'destinationCompte') ?: 'courant');
            if ($sort === $arrive) continue;
            if ($sort) $sortants += $mt; else $entrants += $mt;
        }
        $ep = 0.0;
        foreach ($epArr as $o) $ep += $eff($o, oget($o, 'valeur'), $m);"""),
])
