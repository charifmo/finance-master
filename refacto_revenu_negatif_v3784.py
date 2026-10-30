#!/usr/bin/env python3
"""v37.84 — UN REVENU NÉGATIF EST UNE SORTIE, ET ON LA VOIT.

« Pourquoi je ne vois pas le négatif du Studio sur les premiers mois ? » — le Studio rapporte 8 000 DH par mois,
  avec une règle d'exception de M1 à M6 à − 1 615 : ces mois-là, il COÛTE 1 615 (charges, crédit, vacance…).
  Mais partout où l'appli lisait les revenus, « > 0 » : un revenu négatif disparaissait — du Relevé de comptes
  (donc de la trajectoire et de la Météo), du Surplus détaillé et de la Respiration du budget. Les 1 615 DH
  par mois n'étaient comptés nulle part : le Courant paraissait plus riche qu'il ne l'est.

  Désormais un revenu négatif ce mois-là est une SORTIE du même compte :
    • Relevé de comptes : une ligne « 💸 Studio (revenu négatif) » en sortie, à sa date ;
    • Surplus détaillé : compté dans les sorties ;
    • Respiration du budget : dans les charges fixes (« Studio (net) »).
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

sub('relevé : revenu négatif = sortie',
"""                                const amt = _amt(r, r.base);
                                if (amt > 0) out.push({ account: _normKey(r.destinationCompte), libelle: '💰 ' + (r.label || r.nom || 'Revenu'), montant: amt, type: 'credit', jourPrevu: Number(r.jourPrevu || jdp), internal: false });""",
"""                                const amt = _amt(r, r.base);
                                if (amt > 0) out.push({ account: _normKey(r.destinationCompte), libelle: '💰 ' + (r.label || r.nom || 'Revenu'), montant: amt, type: 'credit', jourPrevu: Number(r.jourPrevu || jdp), internal: false });
                                //  v37.84 : un revenu NÉGATIF ce mois-là (règle d'exception) coûte : une sortie du même compte.
                                //  (_amt écarte tout ce qui est ≤ 0 — « flux inactif » : zéro = suspendu, négatif = un coût)
                                else {
                                    const vn = _effVal(r, r.base, m);
                                    if (vn < 0) out.push({ account: _normKey(r.destinationCompte), libelle: '💸 ' + (r.label || r.nom || 'Revenu') + ' (revenu négatif)', montant: Math.round(-vn * 100) / 100, type: 'debit', jourPrevu: Number(r.jourPrevu || jdp), internal: false });
                                }""")
sub('surplus : revenu négatif = sortie',
"""                            const a = _amt(r, r.base); if (a > 0) entrants += a;
                        });
                        // Charges fixes → sortants (filtre compte macro des fixes si scope courant)
                        //  v37.50 : ligne par ligne — chacune sur SON compte""",
"""                            const a = _amt(r, r.base); if (a > 0) entrants += a;
                            else { const vn = _effVal(r, r.base); if (vn < 0) sortants += Math.round(-vn * 100) / 100; }   // v37.84 : un revenu négatif est une sortie
                        });
                        // Charges fixes → sortants (filtre compte macro des fixes si scope courant)
                        //  v37.50 : ligne par ligne — chacune sur SON compte""")
sub('respiration : revenu négatif = charge',
"""                            const v = valeurEffective(r, r.base, m);
                            if (!(v > 0)) return;
                            const l = { nom: r.label || r.nom || '?', montant: v, jourPrevu: r.jourPrevu || null, compte: compteDeFlux('revenu', r), nature: 'revenu' };""",
"""                            const v = valeurEffective(r, r.base, m);
                            //  v37.84 : un revenu négatif ce mois-là est une charge nette du même compte
                            if (v < 0) {
                                const ln = { cle: 'net_' + (r.label || '?'), nom: (r.label || r.nom || '?') + ' (net)', montant: -v, jourPrevu: r.jourPrevu || null, compte: compteDeFlux('revenu', r), nature: 'fixe', ref: r };
                                if (estFonctionnement(ln.compte)) lignes.fixes.push(ln); else _hors({ ...ln, sens: 'sortie' });
                                return;
                            }
                            if (!(v > 0)) return;
                            const l = { nom: r.label || r.nom || '?', montant: v, jourPrevu: r.jourPrevu || null, compte: compteDeFlux('revenu', r), nature: 'revenu' };""")
sub('bilan : la charge nette est un poste',
"""                                const poste = String(k).startsWith('credit') ? 'credits' : 'fixes';
                                val[poste] += v; ajoute(poste, (f || {}).label || k, v);
                            });""",
"""                                const poste = String(k).startsWith('credit') ? 'credits' : 'fixes';
                                val[poste] += v; ajoute(poste, (f || {}).label || k, v);
                            });
                            //  v37.84 : un revenu négatif ce mois-là est une charge nette — un poste du Bilan, comme la Respiration
                            (r.lignes.fixes || []).filter(l => String(l.cle || '').startsWith('net_')).forEach(l => { val.fixes += l.montant; ajoute('fixes', l.nom, l.montant); });""")
io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.84 : un revenu négatif est une sortie')
