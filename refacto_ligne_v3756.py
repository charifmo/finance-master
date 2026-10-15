# -*- coding: utf-8 -*-
"""
v37.56 — « POURQUOI LES SAISIES MARJANE NE SONT PAS CUMULÉES ? »
Le Pilotage affichait « Marjane · 180 » alors que le journal en comptait 180 + 176 + 80 + 80. Les tickets
de 176 et 80 (saisis le 10 oct., avant le rangement automatique v37.49) étaient rangés sur la catégorie MÈRE
« Alimentation », pas sur la ligne « Marjane » : le Pilotage ne compte sur une ligne que les tickets rangés
SUR elle. Désormais un ticket posé sur la catégorie mère, dont le libellé dit sûrement une de ses lignes
(règles v37.52 : « sûr »), est rattaché à cette ligne — tout seul, une fois, partout (journal, Pilotage,
Rayons X). Jamais un ticket « à vérifier », ni un choix fait à la main (« vous »), ni un doute.
"""
import io, sys
F = 'index.html'
src = io.open(F, encoding='utf-8').read()
a = "                    const ajouterTransactionReelle = (data) => {"
if src.count(a) != 1: print('✖ ancre ajouterTransactionReelle :', src.count(a)); sys.exit(1)
nouveau = r"""                    //  v37.56 — UN TICKET SUR LA CATÉGORIE MÈRE, DONT LE LIBELLÉ DIT UNE DE SES LIGNES : rattaché à cette ligne.
                    //  (« Marjane » 176 sur « Alimentation » → ligne « Marjane » : le Pilotage les cumule.) Seulement si
                    //  les règles sont SÛRES ; jamais un choix « vous », un ticket à vérifier, un doute.
                    let _rattachement = false;
                    const rattacherTicketsALaLigne = () => {
                        if (_rattachement) return 0;
                        _rattachement = true;
                        let n = 0;
                        try {
                            const cats = _categoriesCandidates.value;
                            const meres = new Set(cats.filter(c => c.parent).map(c => c.parent));
                            if (!meres.size) return 0;
                            const parId = new Map(cats.map(c => [c.id, c]));
                            Object.values(donneesAnnuelles.value || {}).forEach(d => (d && Array.isArray(d.transactionsReelles) ? d.transactionsReelles : []).forEach(t => {
                                if (!t || !meres.has(t.categorieId) || t.aVerifier || t.categorieSource === 'vous' || t.categorieSource === 'banque') return;
                                if (!(Number(t.montant) > 0) || !String(t.libelle || '').trim()) return;
                                const r = categoriserLibelle(t.libelle);
                                if (r.statut !== 'sur' || !r.id || r.id === t.categorieId) return;
                                const c = parId.get(r.id);
                                if (!c || c.parent !== t.categorieId) return;
                                t.categorieId = r.id; t.categorieSource = 'auto'; n++;
                            }));
                        } finally { _rattachement = false; }
                        if (n) { calculationTick.value++; handleDataChange(); }
                        return n;
                    };
"""
src = src.replace(a, nouveau + a)
#  Le guetteur en FIN de setup : calculationTick et les données y existent (un watch évalue sa source tout de suite)
w = "                    const BANQUES_SELECT = BANQUES_CB;"
if src.count(w) != 1: print('✖ ancre BANQUES_SELECT :', src.count(w)); sys.exit(1)
src = src.replace(w, w + "\n                    watch(_categoriesCandidates, () => { rattacherTicketsALaLigne(); }, { flush: 'post' });")
b = "bqHash, bqLibProche, bqAnalyserOCR, bqMemeCompte, bqRibValide, ocrCapture,"
if src.count(b) != 1: print('✖ ancre expose :', src.count(b)); sys.exit(1)
src = src.replace(b, "bqHash, bqLibProche, bqAnalyserOCR, bqMemeCompte, bqRibValide, rattacherTicketsALaLigne, ocrCapture,")
#  Le « par défaut » (IA muette) est une FAMILLE, pas une ligne : avec les tickets rattachés à leurs lignes,
#  « la catégorie la plus utilisée » serait devenue « Marjane » pour un objet inconnu. On compte par famille.
c1 = """                                if (!t || !t.categorieId || t.categorieId === 'cat_misc') return;
                                compte[t.categorieId] = (compte[t.categorieId] || 0) + 1;"""
if src.count(c1) != 1: print('✖ ancre plus utilisées :', src.count(c1)); sys.exit(1)
src = src.replace(c1, """                                if (!t || !t.categorieId || t.categorieId === 'cat_misc') return;
                                const fam = ((soldesInitiaux.value.categories || []).find(c => c && c.id === t.categorieId) || {}).parent || t.categorieId;   // v37.56 : la famille
                                compte[fam] = (compte[fam] || 0) + 1;""")
io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.56 — un ticket sur la catégorie mère est rattaché à sa ligne')
