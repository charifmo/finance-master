# -*- coding: utf-8 -*-
"""
v37.46 — « charges variables ne se prennent pas à j15 une seule fois ! mais une fois
par semaine : revois ça pour dispatcher les déductions des variables ».

  AVANT — le Relevé de comptes (et tout ce qui le lit : atterrissage, radar de la
  Météo, trajectoire du Bilan) déduisait TOUT le budget variable d'un cycle le 15,
  d'un bloc : « 🛒 Total Charges Variables … 9 686 DH » au j.15. Le solde restait
  artificiellement haut jusqu'au 14 puis plongeait d'un coup ; le point bas et la
  date « virer avant le … » en étaient faussés.

  APRÈS — une ligne PAR SEMAINE, sur les semaines réelles du cycle (règle du jeudi,
  v37.27 / v37.29 : 4 ou 5 semaines) :
    • cycle à venir : le budget variable du cycle, en parts égales sur ses N
      semaines (une catégorie « / mois » se répartit sur ses N semaines, comme
      partout ailleurs depuis la v37.29), chaque ligne datée du lundi de sa
      semaine (borné au début du cycle) ;
    • cycle en cours : l'enveloppe RESTANTE (le même chiffre qu'avant), sur les
      semaines qui ne sont pas finies, au prorata des jours qui leur restent ; la
      semaine en cours est datée d'aujourd'hui.
  Le TOTAL d'un cycle ne change pas d'un centime : seul le calendrier des sorties
  change. Fin de cycle, atterrissage, bandeau et Bilan gardent leurs chiffres ; le
  point bas, lui, devient réaliste.
"""
import io, sys

F = 'index.html'
src = io.open(F, encoding='utf-8').read()

def sub(label, a, b, n=1):
    global src
    c = src.count(a)
    if c != n:
        print(f'✖ {label} : {c} ancre(s), {n} attendue(s)'); sys.exit(1)
    src = src.replace(a, b)

sub('répartition hebdomadaire', """                    const semainesDeLAnnee = (an) => { let s = 0; for (let m = 1; m <= 12; m++) s += semainesDuCycle(m, an); return s; };""",
"""                    const semainesDeLAnnee = (an) => { let s = 0; for (let m = 1; m <= 12; m++) s += semainesDuCycle(m, an); return s; };
                    /*  v37.46 — LES CHARGES VARIABLES, SEMAINE PAR SEMAINE.
                        Le Relevé déduisait tout le budget variable d'un cycle le 15, d'un bloc.
                        On le répartit sur les semaines réelles du cycle (celles dont le JEUDI
                        tombe dans le cycle, comme semainesDuCycle) : une ligne par semaine,
                        datée de son lundi, borné au début du cycle.
                          • cycle à venir : parts égales sur les N semaines ;
                          • cycle en cours (depuis = aujourd'hui) : seulement les semaines pas
                            finies, au prorata des jours qui leur restent ; la semaine en cours
                            datée d'aujourd'hui. Plus aucune semaine : tout aujourd'hui.
                        La somme des lignes vaut EXACTEMENT le total, au centime (le reliquat
                        d'arrondi va sur la dernière) : seul le calendrier change.
                        → [{ jour, date: Date, montant, libelle, enCours }] */
                    const _MOIS_SEM = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
                    const semainesVariablesDuCycle = (mois, an, total, depuis = null) => {
                        const t = Math.round((Number(total) || 0) * 100);
                        if (t <= 0) return [];
                        const jdp = Number((soldesInitiaux.value || {}).jourDePaie) || 27;
                        const m = Number(mois), a = Number(an);
                        const debut = new Date(a, m - 2, jdp), fin = new Date(a, m - 1, jdp - 1);
                        const jour0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
                        const plus = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
                        const lib = (d) => d.getDate() + ' ' + _MOIS_SEM[d.getMonth()];
                        const auj = depuis ? jour0(depuis) : null;
                        const semaines = [];
                        for (let j = plus(debut, (4 - debut.getDay() + 7) % 7); j <= fin && semaines.length < 6; j = plus(j, 7))
                            semaines.push({ lundi: plus(j, -3), dimanche: plus(j, 3) });
                        let lignes = semaines.map(s => {
                            const date = new Date(Math.max(s.lundi, debut, auj || debut));
                            const poids = auj ? Math.max(0, Math.round((s.dimanche - Math.max(s.lundi, auj)) / 864e5) + 1) : 1;
                            const enCours = !!auj && s.lundi <= auj && auj <= s.dimanche;
                            return { date, poids, enCours,
                                     libelle: '🛒 Charges variables — ' + (enCours ? 'semaine en cours (jusqu’au ' + lib(s.dimanche) + ')' : 'semaine du ' + lib(s.lundi) + ' au ' + lib(s.dimanche)) };
                        }).filter(l => l.poids > 0);
                        if (!lignes.length) lignes = [{ date: auj || debut, poids: 1, enCours: !!auj, libelle: '🛒 Charges variables — reste du cycle' }];
                        const P = lignes.reduce((s, l) => s + l.poids, 0);
                        let reste = t;
                        return lignes.map((l, i) => {
                            const c = i === lignes.length - 1 ? reste : Math.round(t * l.poids / P);
                            reste -= c;
                            return { jour: l.date.getDate(), date: l.date, montant: c / 100, libelle: l.libelle, enCours: l.enCours };
                        });
                    };""")

sub('relevé : cycle en cours', """                                const _envVar = Math.round(Number(enveloppeVariableProrata.value || 0) * 100) / 100;
                                if (_envVar > 0) out.push({ account: _varSrc, libelle: '🛒 Total Charges Variables', montant: _envVar, type: 'debit', jourPrevu: 15, internal: false });""",
"""                                const _envVar = Math.round(Number(enveloppeVariableProrata.value || 0) * 100) / 100;
                                //  v37.46 : une ligne par semaine restante, plus un bloc au 15
                                semainesVariablesDuCycle(m, a, _envVar, new Date()).forEach(s =>
                                    out.push({ account: _varSrc, libelle: s.libelle, montant: s.montant, type: 'debit', jourPrevu: s.jour, internal: false, variableSemaine: true }));""")
sub('relevé : cycles à venir', """                                Object.keys(_varByAcc).forEach(k => { if (_varByAcc[k] > 0) out.push({ account: k, libelle: '🛒 Total Charges Variables', montant: _varByAcc[k], type: 'debit', jourPrevu: 15, internal: false }); });""",
"""                                //  v37.46 : le budget variable du cycle, une ligne par semaine réelle
                                Object.keys(_varByAcc).forEach(k => semainesVariablesDuCycle(m, a, _varByAcc[k]).forEach(s =>
                                    out.push({ account: k, libelle: s.libelle, montant: s.montant, type: 'debit', jourPrevu: s.jour, internal: false, variableSemaine: true })));""")
sub('exposé', "                        meteoFinanciere, respirationBudgetaire, respirationDuMois, NIVEAUX_RESPIRATION,",
    "                        meteoFinanciere, respirationBudgetaire, respirationDuMois, NIVEAUX_RESPIRATION, semainesVariablesDuCycle,")

io.open(F, 'w', encoding='utf-8').write(src)
print('✔ index.html : charges variables réparties semaine par semaine dans le Relevé')
