#!/usr/bin/env python3
"""v37.79 — PLUS AUCUN « J.X » : DES DATES, PARTOUT.

« Il faut enlever de partout ces J-X ! » Après le Relevé (v37.77), les derniers « j.6 », « 📅 j.18 »,
  « J−29 » : le Pilotage (badges des lignes), la Respiration et l'atterrissage du Pilotage théorique,
  l'épargne au téléphone, l'en-tête du Pilotage, et la case de jour du Calendrier Pluriannuel.

  1. Un jour de cycle devient une date : « 6 nov. » (le mois vient du cycle ; un jour au moins égal au
     jour de paie appartient au mois précédent — le cycle de décembre court du 27 nov. au 26 déc.).
  2. Le Calendrier se lit comme une date : « 📅 le [1] déc. » au lieu de « 📅 j. [1] ».
  3. L'en-tête du Pilotage : « 29 jours avant la paie du 27 nov. » au lieu de « J−29 ».
"""
import io, sys

F = 'index.html'
src = io.open(F, encoding='utf-8').read()
def sub(label, old, new, n=1):
    global src
    c = src.count(old)
    if c != n:
        print(f'✖ {label} : {c} ancre(s), {n} attendue(s)'); sys.exit(1)
    src = src.replace(old, new)

sub('aide : date d un jour de cycle',
"""                    const _JOURS_RELEVE = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];""",
"""                    const _JOURS_RELEVE = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
                    //  v37.79 : un jour du cycle « AAAA-MM » → « 6 nov. » (jour ≥ jour de paie : le mois d'avant)
                    const dateDuCycle = (jour, cle) => {
                        const j = Number(jour);
                        if (!j) return '';
                        const k = /^(\\d{4})-(\\d{2})$/.exec(String(cle || cycleRealiseActif.value || ''));
                        let a = k ? Number(k[1]) : moisBudgetaire.value.an, m = k ? Number(k[2]) : moisBudgetaire.value.mois;
                        const jdp = jourDePaie.value;
                        if (jdp > 1 && j >= jdp) { m--; if (m < 1) { m = 12; a--; } }
                        return Math.min(j, new Date(a, m, 0).getDate()) + ' ' + _MOIS_COURTS[m - 1];
                    };
                    const moisCourt = (m) => _MOIS_COURTS[(Number(m) || 1) - 1] || '';""")

sub('respiration : revenus et factures', """<span v-if="l.jourPrevu" class="text-[10px] text-slate-400 font-bold">📅 j.{{ l.jourPrevu }}</span>""",
    """<span v-if="l.jourPrevu" class="text-[10px] text-slate-400 font-bold">📅 {{ dateDuCycle(l.jourPrevu, cycleRealiseActif) }}</span>""", 2)
sub('atterrissage : lignes', """<span v-if="l.jourPrevu" class="text-slate-600 font-bold ml-1">j.{{ l.jourPrevu }}</span>""",
    """<span v-if="l.jourPrevu" class="text-slate-600 font-bold ml-1">{{ dateDuCycle(l.jourPrevu, cycleRealiseActif) }}</span>""", 2)
sub('épargne au téléphone', """<span v-if="ep.jourPrevu" class="text-slate-500 ml-1">· j.{{ ep.jourPrevu }}</span>""",
    """<span v-if="ep.jourPrevu" class="text-slate-500 ml-1">· {{ dateDuCycle(ep.jourPrevu, cycleRealiseActif) }}</span>""")
sub('pilotage : badge de date', """📅 j.{{ t.jourPrevu }}</span>""", """📅 {{ dateDuCycle(t.jourPrevu, cyclePilotage) }}</span>""")
sub('pilotage : en-tête', """ · J−{{ joursRestantsAvantPaie }} avant la paie du {{ prochainePaieLabel }}""",
    """ · {{ joursRestantsAvantPaie }} jour{{ joursRestantsAvantPaie > 1 ? 's' : '' }} avant la paie du {{ prochainePaieLabel }}""")

# Le Calendrier : « 📅 le [1] déc. »
sub('calendrier bureau : libellé', """<span class="text-[10px] font-black text-gray-400">📅 j.</span>""", """<span class="text-[10px] font-black text-gray-400">📅 le</span>""", 2)
sub('calendrier téléphone : libellé', """<span class="text-[9px] font-black uppercase tracking-widest text-gray-500">📅 j.</span>""",
    """<span class="text-[9px] font-black uppercase tracking-widest text-gray-500">📅 le</span>""", 2)
#  le mois après la case (chaque case connaît son item : depense / vir / choc)
for item in ('depense', 'vir', 'choc'):
    old = f"""@change="fixerJourExact({item}, $event.target.value, {item}.mois, anneeAffichage); $event.target.value = {item}.jourPrevu || ''\""""
    n = src.count(old)
    if n < 1:
        print(f'✖ calendrier : case {item} introuvable'); sys.exit(1)
    #  la balise <input …/></label> qui suit : on insère le mois avant </label>
    parts = src.split(old)
    out = parts[0]
    for p in parts[1:]:
        i = p.index('/></label>')
        out += old + p[:i] + f'/><span data-jour-mois class="text-[10px] font-black text-gray-400">{{{{ moisCourt({item}.mois) }}}}</span></label>' + p[i + len('/></label>'):]
    src = out

sub('fixes échues', """{{ chargesFixesEchues.map(t => t.libelle + ' (j.' + t.jourPrevu + ')').join(' · ') }}""",
    """{{ chargesFixesEchues.map(t => t.libelle + ' (' + dateDuCycle(t.jourPrevu, cyclePilotage) + ')').join(' · ') }}""")
sub('exposition', """friseOuverte, friseCycle, dateReleve, """, """friseOuverte, friseCycle, dateReleve, dateDuCycle, moisCourt, """)
io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.79 : des dates partout, plus aucun « j.x »')
