# -*- coding: utf-8 -*-
"""
v37.25 Saisie-Accessible — le panneau d'audit ne bloque plus la saisie.

  Constat (capture de l'utilisateur, souris réelle reproduite) : survoler le NOM
  d'une catégorie ouvre le panneau Rayons X SOUS la ligne ; il recouvre alors les
  cases « déjà dépensé » des lignes suivantes — visibles, mais non cliquables.
  Les cases à placeholder grisé (« ≈ 2 051 ») ressemblaient en plus à des champs
  désactivés.
    1. Au bureau, le panneau s'ouvre À GAUCHE de la carte (sur le verdict / le
       Sanctuaire), jamais sur la colonne des cases. Au téléphone, comportement
       inchangé (dessous / dessus, fermeture au toucher ailleurs).
    2. Les cases ont l'air de cases : fond sombre, contour franc, crayon ✎,
       invite en italique pour l'estimation.
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

sub('placement : à côté de la carte', """                    const h = el.scrollHeight;
                    const bas = vh - r.bottom - 16, haut = r.top - 16;""", """                    const h = el.scrollHeight;
                    //  v37.25 : la colonne des cases de saisie est celle de la carte « Reste à
                    //  dépenser ». Au bureau, le panneau s'ouvre À GAUCHE de cette carte : il ne
                    //  recouvre jamais une case qu'on voudrait remplir.
                    const carte = a.closest && a.closest('[data-liberte]');
                    if (carte && vw >= 768) {
                        const rc = carte.getBoundingClientRect();
                        if (rc.left - 8 - W >= 8) {
                            const hMax = vh - 16, hh = Math.min(h, hMax);
                            const top = Math.min(Math.max(8, r.top - 24), vh - 8 - hh);
                            this.rxStyle = { left: (rc.left - 8 - W) + 'px', top: top + 'px', width: W + 'px', maxHeight: h > hMax ? hMax + 'px' : null, overflowY: h > hMax ? 'auto' : null };
                            return;
                        }
                    }
                    const bas = vh - r.bottom - 16, haut = r.top - 16;""")

sub('cases qui ont l\'air de cases', """                        <label :class="['shrink-0 flex items-center gap-1 rounded-lg ring-1 px-2 py-1 md:py-1.5 cursor-text transition-colors focus-within:ring-2 focus-within:ring-white/80 focus-within:bg-black/30',
                                        c.source === 'compteur' ? 'bg-black/25 ring-white/30' : 'bg-black/15 ring-white/15 hover:ring-white/40']\"""",
    """                        <label :class="['shrink-0 flex items-center gap-1 rounded-lg ring-1 px-2 py-1 md:py-1.5 cursor-text transition-colors shadow-inner focus-within:ring-2 focus-within:ring-white focus-within:bg-black/40',
                                        c.source === 'compteur' ? 'bg-black/35 ring-white/50' : 'bg-black/25 ring-white/35 hover:ring-white/70']\"""")
sub('crayon', """                            <span class="sr-only">Déjà dépensé ce cycle en {{ c.label }}</span>
                            <input type="number\"""", """                            <span class="sr-only">Déjà dépensé ce cycle en {{ c.label }}</span>
                            <span aria-hidden="true" class="text-[11px] text-white/60">✎</span>
                            <input type="number\"""")
sub('invite en italique', "placeholder:text-white/40 placeholder:font-semibold outline-none", "placeholder:text-white/55 placeholder:italic placeholder:font-semibold outline-none")

for a, r in edits: src = src.replace(a, r, 1)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ {len(edits)} modifications appliquées à {F}')
