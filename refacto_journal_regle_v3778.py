#!/usr/bin/env python3
"""v37.78 — UNE OPÉRATION DU JOURNAL RANGÉE SUR UNE LIGNE DU PILOTAGE LA RÈGLE.

« Facture élec déjà saisie, mais elle apparaît à 0 dans la partie saisie. » L'opération « Société
  Régionale Mult » (221 DH, importée de la banque) était bien rangée sur « elect » — mais une ligne du
  Pilotage ne se réglait que par sa propre case ou par un « pointage » à l'import. Le journal disait
  « payé », le Pilotage « Saisir », et le Relevé projetait encore les 200 DH le 6 nov., alors qu'ils
  avaient déjà quitté le compte (comptés deux fois).

  Désormais, pour une ligne du Pilotage — charge fixe, ligne d'une catégorie mensuelle (factures…),
  épargne — les opérations du journal rangées sur SA catégorie, datées dans le cycle (un jour au moins
  égal au jour de paie ouvre le cycle suivant), la règlent. La case et le journal ne s'additionnent
  pas : c'est le plus grand des deux qui compte (le même paiement, vu deux fois). Une opération rangée
  « par défaut » (libellé inconnu) ne règle rien. Les postes de la semaine (courses…) gardent leur saisie.
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

sub('réglé : par le journal',
"""                    const isItemPaid = (item, dueAmount, cle) => {
                        const e = _etatCycle(item, cle);
                        if (!e) return false;
                        if (e.cloture) return true;          // v37.51 : close = plus rien n'est attendu
                        if (e.paye && !e.montantPaye) return true;
                        return Math.abs(Number(e.montantPaye) || 0) >= Math.abs(Number(dueAmount) || 0);
                    };

                    const getPaidAmount = (item, dueAmount, cle) => {
                        const e = _etatCycle(item, cle);
                        if (!e) return 0;
                        if (e.paye && !e.montantPaye) return dueAmount;
                        if (e.montantPaye !== undefined && e.montantPaye !== null)
                            return (Number(dueAmount) < 0 ? -1 : 1) * Math.abs(Number(e.montantPaye) || 0);
                        return e.paye ? dueAmount : 0;
                    };""",
"""                    //  v37.78 : UNE OPÉRATION DU JOURNAL RANGÉE SUR UNE LIGNE DU PILOTAGE LA RÈGLE — charges fixes, lignes
                    //  des catégories mensuelles (factures…), épargne ; pas les postes de la semaine (ils ont leur saisie).
                    //  Le montant des opérations de SA catégorie, datées dans le cycle ; « par défaut » ne règle rien.
                    const _catsLignesPilotage = computed(() => {
                        const s = new Set();
                        const noter = (x) => { if (x && x.categorieId) s.add(x.categorieId); };
                        (chargesFixesBudgetairesTriees.value || []).forEach(noter);
                        (chargesVarMensuellePilotage.value || []).forEach(c => (c.details || []).forEach(noter));
                        (epargneBudgetairePilotage.value || []).forEach(noter);
                        return s;
                    });
                    const _txParCategorieCycle = computed(() => {
                        calculationTick.value;
                        const jdp = jourDePaie.value, out = Object.create(null);
                        Object.values(donneesAnnuelles.value || {}).forEach(d => (d && Array.isArray(d.transactionsReelles) ? d.transactionsReelles : []).forEach(t => {
                            if (!t || !t.categorieId || t.categorieId === 'cat_misc' || t.categorieSource === 'défaut') return;
                            const m = /^(\\d{4})-(\\d{2})-(\\d{2})/.exec(String(t.date || t.datetime || ''));
                            if (!m) return;
                            let a = Number(m[1]), mo = Number(m[2]);
                            if (jdp > 1 && Number(m[3]) >= jdp) { mo++; if (mo > 12) { mo = 1; a++; } }
                            const k = t.categorieId + '|' + _cleCycle(mo, a);
                            out[k] = Math.round(((out[k] || 0) + Math.abs(Number(t.montant) || 0)) * 100) / 100;
                        }));
                        return out;
                    });
                    const regleParJournal = (item, cle) => {
                        if (!item || !item.categorieId || !_catsLignesPilotage.value.has(item.categorieId)) return 0;
                        return _txParCategorieCycle.value[item.categorieId + '|' + _cycleDe(item, cle)] || 0;
                    };

                    const isItemPaid = (item, dueAmount, cle) => {
                        const e = _etatCycle(item, cle);
                        if (e) {
                            if (e.cloture) return true;          // v37.51 : close = plus rien n'est attendu
                            if (e.paye && !e.montantPaye) return true;
                            if (Math.abs(Number(e.montantPaye) || 0) >= Math.abs(Number(dueAmount) || 0)) return true;
                        }
                        const j = regleParJournal(item, cle);    // v37.78
                        return j > 0 && j >= Math.abs(Number(dueAmount) || 0);
                    };

                    const getPaidAmount = (item, dueAmount, cle) => {
                        const e = _etatCycle(item, cle);
                        const sg = Number(dueAmount) < 0 ? -1 : 1, j = regleParJournal(item, cle);   // v37.78 : le plus grand des deux
                        let p = 0;
                        if (e) {
                            if (e.paye && !e.montantPaye) p = dueAmount;
                            else if (e.montantPaye !== undefined && e.montantPaye !== null) p = sg * Math.abs(Number(e.montantPaye) || 0);
                            else p = e.paye ? dueAmount : 0;
                        }
                        return j > Math.abs(Number(p) || 0) ? sg * j : p;
                    };""")
sub('exposition', """friseOuverte, friseCycle, dateReleve, """, """friseOuverte, friseCycle, dateReleve, regleParJournal, """)
io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.78 : une opération du journal rangée sur une ligne du Pilotage la règle')
