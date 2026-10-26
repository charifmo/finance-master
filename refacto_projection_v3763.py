# -*- coding: utf-8 -*-
"""
v37.63 — LE PATRIMOINE PROJETÉ, TOUJOURS EN HAUT À DROITE.

« En haut à droite j'avais la projection directe des comptes pour une période donnée, ça a tout simplement
disparu ! Quand je l'effleurais, elle me donnait le détail des comptes, avec un clic qui m'envoyait vers le
journal de chaque compte. »
Le bloc « Patrimoine Global Projeté (Fin AAAA) » n'avait pas changé depuis la v37.46 (bloc identique) — mais
la ligne de l'en-tête passe à la ligne sous ~1 300 px de large : le bloc tombait alors À GAUCHE, sous l'année,
méconnaissable (mesuré : v37.46 et v37.62 identiques à 1 265 px). Aucun test ne gardait cet en-tête.
  • Le libellé « Édition des paramètres de l'année : » devient « Année : » sous 1 536 px : à 1 265 px tout tient
    sur une ligne, le patrimoine projeté en haut à droite.
  • Plus étroit encore : s'il passe à la ligne, il reste collé À DROITE.
  • « ⓘ » le signale ; le détail des comptes s'ouvre au survol, et aussi au toucher / au clavier (tablette) ;
    un clic sur un compte ouvre son relevé sur le même horizon, et le détail se referme.
"""
import io, sys
F = 'index.html'
src = io.open(F, encoding='utf-8').read()
def sub(label, a, b, n=1):
    global src
    if src.count(a) != n: print('✖', label, ':', src.count(a), 'ancre(s),', n, 'attendue(s)'); sys.exit(1)
    src = src.replace(a, b)

sub('libellé année',
"""                        <span class="text-xs font-black uppercase text-slate-500 tracking-widest">Édition des paramètres de l'année :</span>""",
"""                        <!-- v37.63 : « Année : » sous 1 536 px — le patrimoine projeté garde sa place, en haut à droite -->
                        <span class="hidden 2xl:inline text-xs font-black uppercase text-slate-500 tracking-widest">Édition des paramètres de l'année :</span>
                        <span class="2xl:hidden text-xs font-black uppercase text-slate-500 tracking-widest" title="Édition des paramètres de l'année">Année :</span>""")
sub('bloc projeté',
"""                    <div class="text-right relative group flex items-center justify-end gap-2 flex-wrap">
                        <p class="text-[9px] font-black text-gray-400 uppercase tracking-wide italic flex items-center gap-1 whitespace-nowrap">
                            <span>Patrimoine Global Projeté</span>""",
"""                    <!-- v37.63 : collé à droite même quand la ligne passe à la ligne ; détail au survol, au toucher, au clavier -->
                    <div data-projection-entete tabindex="0" aria-label="Patrimoine global projeté : détail des comptes" class="ml-auto text-right relative group flex items-center justify-end gap-2 flex-wrap cursor-help outline-none">
                        <p class="text-[9px] font-black text-gray-400 uppercase tracking-wide italic flex items-center gap-1 whitespace-nowrap">
                            <span>Patrimoine Global Projeté ⓘ</span>""")
sub('détail',
"""                        <div class="hidden group-hover:block absolute right-0 top-full mt-1 z-50 bg-slate-900 text-white rounded-xl shadow-2xl p-4 min-w-[300px] text-left border border-slate-700">
                            <p class="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Répartition du Patrimoine Projeté</p>""",
"""                        <div data-projection-detail class="hidden group-hover:block group-focus-within:block absolute right-0 top-full mt-1 z-50 bg-slate-900 text-white rounded-xl shadow-2xl p-4 min-w-[300px] text-left border border-slate-700">
                            <p class="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Répartition du Patrimoine Projeté</p>""")

sub('refermer après le clic',
    '@click="ouvrirReleveProjection(key)"',
    '@click="ouvrirReleveProjection(key); $event.target.closest(\'[data-projection-entete]\').blur()"', n=2)

io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.63 Projection : le patrimoine projeté reste en haut à droite, son détail au survol comme au toucher')
