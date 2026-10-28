#!/usr/bin/env python3
"""v37.71 — LA CAPTURE ATTIJARI « MES COMPTES » RECONNUE.

« Pourquoi il ne reconnaît pas le compte Attijari ? » — sur l'écran mobile « Mes comptes » d'Attijari,
la liste des opérations n'a pas d'autre titre que le mois (« Octobre 2026 »). Faute de titre reconnu,
l'en-tête était coupé au premier solde annoncé : le total « Mes comptes ». Le n° du compte
et le solde du compte chèque, lus juste en dessous, tombaient dans la
liste des opérations : « Capture Attijariwafa Bank, sans RIB visible. À quel compte l'associer ? »

  1. Un mois seul sur sa ligne (« Octobre 2026 ») est le titre de la liste : tout ce qui est au-dessus
     est l'en-tête (comptes, n°, soldes).
  2. Une empreinte mémorisée (« attijari|pad compte cheque », un « pad » lu sur l'icône) reconnaît la
     même banque et le même intitulé à un mot parasite près ; une empreinte vide (« attijari| ») ne
     reconnaît jamais rien.
  3. « Mes comptes » à l'écran mais illisible (« 987600DH ») : la 3e lecture (seuil local) est lancée aussi —
     c'est le solde que suit ce compte.
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

sub('titre : mois',
"""                    const BQ_TITRES = /dernieres operations|transactions recentes|total des mouvements|derniers mouvements|historique des operations|liste des operations|mes operations/;""",
"""                    const BQ_TITRES = /dernieres operations|transactions recentes|total des mouvements|derniers mouvements|historique des operations|liste des operations|mes operations/;
                    //  v37.71 : Attijari mobile « Mes comptes » — la liste n'a d'autre titre que son mois (« Octobre 2026 »)
                    const BQ_TITRE_MOIS = /^(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\\s+20\\d\\d$/;""")
sub('titre : recherche',
"""                        let iTitre = lignes.findIndex(l => BQ_TITRES.test(bqNorm(l)));""",
"""                        let iTitre = lignes.findIndex(l => BQ_TITRES.test(bqNorm(l)) || BQ_TITRE_MOIS.test(bqNorm(l).trim()));""")
sub('empreinte tolérante',
"""                        const parEmp = (comptes.value || []).filter(c => (c.empreintes || []).includes(a.signature));""",
"""                        //  v37.71 : même banque, même intitulé à un mot parasite près (« pad compte cheque » ↔ « compte cheque »,
                        //  l'OCR lit parfois l'icône) ; une empreinte sans intitulé (« attijari| ») ne reconnaît rien
                        const _motsEmp = (s) => String(s || '').split(' ').filter(Boolean);
                        const empPareille = (x, y) => {
                            if (x === y) return !/\\|$/.test(String(x));
                            const [bx, ix] = String(x || '').split('|'), [by, iy] = String(y || '').split('|');
                            if (!bx || bx !== by || !ix || !iy) return false;
                            const mx = _motsEmp(ix), my = _motsEmp(iy), [c, l] = mx.length <= my.length ? [mx, my] : [my, mx];
                            return c.length >= 2 && l.length - c.length <= 1 && c.every(w => l.includes(w));
                        };
                        const parEmp = (comptes.value || []).filter(c => (c.empreintes || []).some(e => empPareille(e, a.signature)));""")
sub('3e lecture si « Mes comptes » illisible',
"""                        if (img.height > img.width * 1.4 && !textes.some(t => Object.keys(bqAnalyser(t).soldes).length)) {""",
"""                        //  v37.71 : …ou quand « Mes comptes » est à l'écran sans montant lisible (« 987600DH ») — c'est le solde
                        //  que suivent certains comptes Attijari, et le compte chèque lu au-dessous ne le remplace pas
                        const _mesComptesManque = (t) => /mes comptes/.test(bqNorm(t)) && bqAnalyser(t).soldes.mesComptes == null;
                        if (img.height > img.width * 1.4 && (!textes.some(t => Object.keys(bqAnalyser(t).soldes).length) || textes.every(_mesComptesManque))) {""")
io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.71 : Attijari « Mes comptes » — en-tête coupé au mois, empreinte tolérante')
