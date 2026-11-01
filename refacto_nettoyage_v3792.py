#!/usr/bin/env python3
"""v37.92 — AVANT DE POSER, L'APPLI NETTOIE : AUCUN RÉSIDU DES CALCULS PASSÉS.

« Est-ce que l'appli, à l'appel du CFO, supprime l'existant avant de mettre à jour ? Le clean est important. »
  « Alimenter le Courant » retirait déjà les virements salaire ↔ Courant des cycles qu'il recalcule. Deux résidus
  restaient :
  1. Les virements salaire ↔ Courant posés fin décembre pour le cycle de janvier SUIVANT (le 28 déc. → janvier
     2028), dans une année suivante qui n'existe pas encore : des allers-retours d'anciens calculs (9 100 vers le
     Courant, 6 000 retour vers Assafa le même jour). Ils sont retirés aussi — l'année suivante, une fois créée,
     aura son propre calcul (le premier cycle de l'année se pose fin décembre).
  2. Relancé deux fois, « Annuler » ne ramenait qu'au calcul précédent. Désormais il ramène à l'état d'AVANT le
     premier calcul : les virements posés par un calcul précédent sont remplacés sans être gardés comme « anciens ».
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

sub('alimentation : nettoyage complet',
"""                        const retires = [], ajoutes = [], plan = [];
                        [a - 1, a].forEach(y => {
                            const d = (donneesAnnuelles.value || {})[y];
                            if (!d || !Array.isArray(d.virementsInternes)) return;
                            d.virementsInternes = d.virementsInternes.filter(v => {
                                if (!v || !estAli(v)) return true;
                                const c = cycleDuVirement(v, y);
                                if (c.a === a && cycles.includes(c.m)) { retires.push({ an: y, v: JSON.parse(JSON.stringify(v)) }); return false; }
                                return true;
                            });
                        });""",
"""                        //  v37.92 : un calcul précédent est REMPLACÉ (ses virements ne deviennent pas des « anciens ») ; « Annuler »
                        //  ramène à l'état d'avant le premier calcul
                        const prec = ((donneesAnnuelles.value || {})[a] || {}).alimentationJusteBesoin;
                        const deja = new Set(((prec && prec.ajoutes) || []).map(x => String(x.id)));
                        const retires = ((prec && prec.retires) || []).slice(), ajoutes = [], plan = [];
                        const sansSuivante = !(donneesAnnuelles.value || {})[a + 1];
                        let nettoyes = 0;
                        [a - 1, a].forEach(y => {
                            const d = (donneesAnnuelles.value || {})[y];
                            if (!d || !Array.isArray(d.virementsInternes)) return;
                            d.virementsInternes = d.virementsInternes.filter(v => {
                                if (!v || !estAli(v)) return true;
                                const c = cycleDuVirement(v, y);
                                //  v37.92 : le cycle de janvier SUIVANT, posé fin décembre, quand l'année suivante n'existe pas encore —
                                //  un résidu d'anciens calculs : retiré aussi
                                const residu = sansSuivante && y === a && c.a === a + 1 && c.m === 1;
                                if ((c.a === a && cycles.includes(c.m)) || residu) {
                                    if (deja.has(String(v.id))) return false;
                                    retires.push({ an: y, v: JSON.parse(JSON.stringify(v)) }); nettoyes++; return false;
                                }
                                return true;
                            });
                        });""")
sub('alimentation : le journal dit le nettoyage',
"""                               + ' — ' + formatMAD(total) + ' au total, ' + retires.length + ' ancien(s) virement(s) remplacé(s).', 'success');""",
"""                               + ' — ' + formatMAD(total) + ' au total, ' + nettoyes + ' ancien(s) virement(s) retiré(s) avant de poser les nouveaux.', 'success');""")
sub('demande du CFO : le fil dit le nettoyage',
"""                                                  + (r.retires.length ? ' (' + r.retires.length + ' ancien(s) virement(s) remplacé(s))' : '')""",
"""                                                  + ' — nettoyage d’abord : ' + (r.nettoyes || 0) + ' ancien(s) virement(s) salaire ↔ Courant retiré(s)'""")
sub('alimentation : nettoyés gardés dans le compte rendu',
"""                        d.alimentationJusteBesoin = { le: _aujourdhuiISO(), salaire: getNomCompte(sk), retires, ajoutes, plan,""",
"""                        d.alimentationJusteBesoin = { le: _aujourdhuiISO(), salaire: getNomCompte(sk), retires, ajoutes, plan, nettoyes,""")
io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.92 : nettoyage complet avant de poser, Annuler ramène au tout premier état')
