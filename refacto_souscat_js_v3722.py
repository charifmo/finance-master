# -*- coding: utf-8 -*-
"""
v37.22 Liste-de-Courses — PARTIE MOTEUR (getter pulseHebdo).

  Chaque catégorie de la Liberté remonte désormais sa décomposition PRÉVUE :
  les `details` de la charge variable (Hri, L7m, Marché…), en DH de la
  semaine, avec un emoji déduit du nom, et ce qui a déjà été dépensé sur
  chaque poste cette semaine.

  Règles :
    • même année que l'enveloppe (moisBudgetaire.an) : le prévu et le total
      affiché viennent de la même ligne du Prévisionnel ;
    • les détails d'une catégorie hebdo SONT l'enveloppe (l'app recopie leur
      somme dans `valeur`). Si une exception change le budget de ce mois, les
      postes sont mis à l'échelle pour que leur somme reste le budget affiché
      (`prevuAjuste`) ;
    • une dépense saisie sur une sous-catégorie (categorieId du détail) est
      comptée sur ce poste ; une dépense saisie sur la catégorie elle-même est
      « non ventilée » — on le dit plutôt que de laisser croire qu'un poste
      est intact.
"""
import io, sys
F = 'index.html'
src = io.open(F, encoding='utf-8').read()
edits = []
def sub(label, anchor, replacement, expected=1):
    n = src.count(anchor)
    if n != expected:
        print(f'✖ {label} : {n} ancre(s), {expected} attendue(s)'); sys.exit(1)
    edits.append((anchor, replacement))

sub('emoji d\'un poste', """                    const _parDateDesc = (a, b) =>""", """                    //  v37.22 : un emoji par poste, déduit du nom (darija et français). Le
                    //  produit l'emporte sur l'enseigne : « Marjane Lait » → 🥛.
                    const _EMOJIS_POSTES = [
                        [/hrr?i\\b|hanout|epicerie|stock/, '🛍️'], [/l7m|lhm|lahm|viande|boucher/, '🥩'], [/djaj|dajaj|poulet|volaille/, '🍗'],
                        [/samak|poisson|hout\\b|crevette/, '🐟'], [/kfta|kefta|hache/, '🍖'], [/khdra|khodra|legume/, '🥬'], [/fakya|fruit/, '🍎'],
                        [/lait|7lib|halib|danup|danone|yaourt|calin/, '🥛'], [/fromage|edam|parmesan|jben|gouda/, '🧀'], [/oeuf|\\bbid\\b|bayd/, '🥚'],
                        [/farine|dqiq|semoule/, '🌾'], [/pain|khobz|boulang/, '🥖'], [/dessert|gateau|patiss|sucre/, '🍰'],
                        [/marche|souk/, '🧺'], [/marjane?|carrefour|\\bbim\\b|aswak|supermarch|acima/, '🛒'],
                        [/cafe|coffee/, '☕'], [/resto|restaurant|wknd|sortie/, '🍽️'], [/barber|coiff/, '💈'],
                        [/essence|diesel|gasoil|carbur|afriquia/, '⛽'], [/ghsil|lavage/, '🧽'], [/psy|medecin|docteur|consult/, '🩺'],
                        [/medic|pharma|complement|vitamine/, '💊'], [/\\beau\\b|lydec|redal|amendis/, '💧'], [/elec/, '⚡'],
                        [/\\btel\\b|telephone|internet|fibre|inwi|orange/, '📶'], [/netflix|spotify|youtube|disney|shahid/, '🎬'],
                        [/chatgpt|openai|claude|abonn/, '🤖'], [/ecole|cours|livre/, '📚'], [/bebe|couche/, '🍼'],
                    ];
                    const emojiPoste = (nom, icone) => {
                        if (icone) return icone;
                        const n = String(nom || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
                        const e = _EMOJIS_POSTES.find(([re]) => re.test(n));
                        return e ? e[1] : '🏷️';
                    };
                    const _parDateDesc = (a, b) =>""")

sub('les postes prévus de chaque catégorie',
    """                            cats.push({ key, label: cv.label || key, budget: cv.periode === 'semaine' ? v : v / 4.3, depense: 0, tx: [] });""",
    """                            const budget = cv.periode === 'semaine' ? v : v / 4.3;
                            //  v37.22 : la décomposition prévue (la liste de courses)
                            const dets = (cv.details || []).filter(x => x && Number(x.montant) > 0);
                            const sommeDets = dets.reduce((s, x) => s + Number(x.montant), 0);
                            const echelle = sommeDets > 0 ? budget / sommeDets : 0;
                            cats.push({ key, label: cv.label || key, budget, depense: 0, tx: [], nonVentile: 0,
                                        prevuAjuste: sommeDets > 0 && Math.abs(echelle - 1) > 0.001,
                                        prevu: dets.map(x => ({ nom: x.nom || '—', emoji: emojiPoste(x.nom, x.icone),
                                                                montant: Number(x.montant) * echelle, categorieId: x.categorieId || null, depense: 0 })) });""")

sub('chaque dépense comptée sur son poste', """                                c.depense += m; nbTx++; c.tx.push(tx);""", """                                c.depense += m; nbTx++; c.tx.push(tx);
                                const poste = t.categorieId ? c.prevu.find(x => x.categorieId === t.categorieId) : null;
                                if (poste) { poste.depense += m; tx.poste = poste.nom; tx.posteEmoji = poste.emoji; }
                                else c.nonVentile += m;""")

sub('exposer les postes', """                                    return { ...c, budget: Math.round(c.budget), depense: Math.round(c.depense),""", """                                    //  Arrondis : le reliquat va au plus gros poste, pour que la
                                    //  somme des étiquettes tombe EXACTEMENT sur le budget affiché.
                                    const prevu = c.prevu.map(x => ({ ...x, montant: Math.round(x.montant), depense: Math.round(x.depense) }))
                                        .sort((a, b) => b.montant - a.montant);
                                    if (prevu.length) prevu[0].montant += Math.round(c.budget) - prevu.reduce((s, x) => s + x.montant, 0);
                                    prevu.forEach(x => { x.pct = x.montant > 0 ? Math.min(100, Math.round(x.depense / x.montant * 100)) : (x.depense > 0 ? 100 : 0); });
                                    return { ...c, budget: Math.round(c.budget), depense: Math.round(c.depense),
                                             prevu, nonVentile: Math.round(c.nonVentile),""")

for a, r in edits: src = src.replace(a, r, 1)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ {len(edits)} modifications appliquées à {F}')
