# -*- coding: utf-8 -*-
"""
v37.26 Saisie-Par-Poste — PARTIE MOTEUR.

  Retour utilisateur : « je ne veux pas des totaux à éditer, mais chaque case
  (chaque sous-catégorie : Marjane, khdra, kfta…), de façon ergonomique ».

  Stockage — dans le MÊME objet que le compteur du cycle, donc rien de nouveau
  à persister ni à fusionner :
      donneesAnnuelles[an].consoRealiseeT0['<mois>-<an>'] = {
          alimentation: 200,              // « Autre » : le total libre historique
          'alimentation::1': 400,         // poste id 1 (Marjane)
          'alimentation::2': 250, … }
  Règle — par catégorie :
      saisi    = libre + Σ postes            (le compteur déclaré)
      engagé   = max(saisi, tickets datés)   (inchangé : jamais la somme)
  Un ancien total (v37.23/24) reste donc valable : il devient la ligne « Autre ».
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

# ── 1. La clé d'un poste ────────────────────────────────────────────────────
sub('clé d\'un poste', r"""                    //  v37.23 : les tickets datés du cycle (onglet Saisie), par catégorie et""",
    r"""                    //  v37.26 : la clé d'un poste dans le compteur du cycle. L'id du détail
                    //  quand il existe (stable si on renomme), sinon le nom normalisé.
                    const cleDetailT0 = (catKey, det) => catKey + '::' + (det && det.id != null ? det.id : 'n' + _slugCat((det && det.nom) || ''));
                    //  v37.23 : les tickets datés du cycle (onglet Saisie), par catégorie et""")

# ── 2. consoCategoriesT0 : saisi = libre + Σ postes ────────────────────────
sub('saisi = libre + postes', r"""                                const saisi = Math.max(0, Math.round(Number(saisies[key] || 0)));""",
    r"""                                const libre = Math.max(0, Math.round(Number(saisies[key] || 0)));
                                const clesPostes = Object.keys(saisies).filter(k => k.startsWith(key + '::'));
                                const parPostes = clesPostes.reduce((s, k) => s + Math.max(0, Math.round(Number(saisies[k] || 0))), 0);
                                const saisi = libre + parPostes;""")
sub('déclarée si un poste existe', r"""                                const declare = saisi > 0 || tickets > 0 || (declareQuelquePart && Object.prototype.hasOwnProperty.call(saisies, key));""",
    r"""                                const declare = saisi > 0 || tickets > 0 || (declareQuelquePart && (Object.prototype.hasOwnProperty.call(saisies, key) || clesPostes.length > 0));""")
sub('libre et parPostes exposés', r"""                                    key, saisi, tickets, declare,
                                    label: cv.label || key,""", r"""                                    key, saisi, libre, parPostes, tickets, declare,
                                    label: cv.label || key,""")

# ── 3. liberteCycle : chaque poste porte sa saisie ──────────────────────────
sub('les postes portent leur saisie', r"""                                const p = { nom: x.nom || '—', emoji: emojiPoste(x.nom, x.icone), montant: Math.round(v * part), categorieId: x.categorieId || null,
                                            depense: dep, pct: partCycle > 0 ? Math.min(100, Math.round(dep / partCycle * 100)) : (dep > 0 ? 100 : 0), depasse: dep > partCycle };""",
    r"""                                //  v37.26 : ce que l'utilisateur a TAPÉ sur ce poste (sans date) ; les
                                //  tickets datés du poste restent dans `depense` (audit).
                                const cle = cleDetailT0(c.key, x);
                                const saisiP = Math.max(0, Math.round(Number(consoT0Saisies.value[cle] || 0)));
                                const engP = Math.max(saisiP, dep);
                                const p = { nom: x.nom || '—', emoji: emojiPoste(x.nom, x.icone), montant: Math.round(v * part), categorieId: x.categorieId || null,
                                            depense: dep, pct: partCycle > 0 ? Math.min(100, Math.round(dep / partCycle * 100)) : (dep > 0 ? 100 : 0), depasse: dep > partCycle,
                                            cle, saisi: saisiP, declare: Object.prototype.hasOwnProperty.call(consoT0Saisies.value, cle),
                                            partCycle: Math.round(partCycle), engage: engP,
                                            pctEngage: partCycle > 0 ? Math.min(100, Math.round(engP / partCycle * 100)) : (engP > 0 ? 100 : 0) };""")
sub('libre et parPostes dans la carte', r"""                                key: c.key, label: c.label, budget: c.budget, engage: engageCat, saisi: c.saisi, tickets: c.tickets, declare: c.declare,""",
    r"""                                key: c.key, label: c.label, budget: c.budget, engage: engageCat, saisi: c.saisi, libre: c.libre, parPostes: c.parPostes, tickets: c.tickets, declare: c.declare,""")

for a, r in edits: src = src.replace(a, r, 1)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ {len(edits)} modifications appliquées à {F}')
