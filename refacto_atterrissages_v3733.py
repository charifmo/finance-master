# -*- coding: utf-8 -*-
"""
v37.33 Atterrissage-Comptes — la Météo montre TOUJOURS où finit chaque compte.

  Le constat : depuis v37.32, la Météo ne nommait un compte que s'il finissait
  le cycle dans le rouge. Le compte principal (Assafa, + 649 DH) n'apparaissait
  nulle part : il a fallu demander à l'agent IA. Un tableau de bord ne cache pas
  un compte clé parce qu'il est dans le vert.

  La réponse : sous le verdict de la Météo, une liste compacte (une ligne par
  compte opérationnel) — monogramme, nom court, atterrissage en gras aligné à
  droite, vert si ≥ 0, rouge si < 0. Toujours là, que le ciel soit dégagé ou non.

    • Les chiffres : ceux du moteur du Relevé (atterrissageCycle), le même que
      le bloc rouge et que « Comptes du cycle ». Aucun second calcul.
    • Les comptes : le courant, et tout compte d'où de l'argent SORT ce cycle
      (il paie quelque chose). Un livret qui ne fait que recevoir, une poche
      virtuelle, un compte d'investissement n'y figurent pas. Un compte qui finit
      dans le rouge y est toujours : la liste ne contredit jamais le bloc rouge.
    • Ordre fixe (le courant, puis l'ordre de vos comptes) : l'œil retrouve
      chaque compte à la même place d'un jour à l'autre.
    • La pastille « 🏁 Atterrissage le … » (le courant seul) disparaît : la
      liste la remplace. La pastille « Respiration » reste (bureau).

  Le bloc rouge « Découvert projeté » n'est PAS touché : ni son gabarit, ni le
  calcul `decouverts`.
"""
import io, sys
F = 'index.html'
src = io.open(F, encoding='utf-8').read()
edits = []
def sub(label, anchor, replacement, expected=1):
    n = src.count(anchor)
    if n != expected:
        print(f'✖ {label} : {n} ancre(s), {expected} attendue(s)'); sys.exit(1)
    edits.append((anchor, replacement, expected))

# ══ 1. LE CALCUL : la liste des atterrissages, dans meteoFinanciere ══════════
sub('meteo : atterrissages', r"""                            }).sort((x, y) => y.manque - x.manque);
                        })();
                        return {
                            etat, icone, titre, raison, conseil, decouverts,
""", r"""                            }).sort((x, y) => y.manque - x.manque);
                        })();
                        /*  v37.33 — OÙ FINIT CHAQUE COMPTE, en permanence (pas seulement dans le
                            rouge). Les chiffres du moteur du Relevé, ceux du bloc rouge. Un compte
                            figure s'il est le courant, ou si de l'argent EN SORT ce cycle (il paie
                            quelque chose) : un livret qui ne fait que recevoir, une poche virtuelle,
                            un compte d'investissement n'y sont pas. Un compte qui finit dans le
                            rouge y est toujours : la liste ne contredit jamais le bloc. Ordre fixe —
                            le courant, puis l'ordre de vos comptes. */
                        const atterrissages = (() => {
                            const liste = comptes.value || [];
                            const rang = (k) => { const i = liste.findIndex(c => 'cpt_' + c.id === k); return i < 0 ? liste.length : i; };
                            const nonLiquide = (k) => ['investissement', 'bourse', 'credit'].includes((liste.find(c => 'cpt_' + c.id === k) || {}).type);
                            return (atterrissageCycle.value.comptes || [])
                                .filter(c => c.courant || (c.reel && (c.atterrissage < 0 || (c.sorties > 0 && !nonLiquide(c.key)))))
                                .map(c => ({
                                    key: c.key, compte: infoCompte(c.key), courant: !!c.courant,
                                    atterrissage: c.atterrissage, t0: c.t0,
                                    signe: c.atterrissage < 0 ? '−' : (c.atterrissage > 0 ? '+' : ''),
                                    valeur: Math.abs(c.atterrissage),
                                }))
                                .sort((x, y) => (y.courant - x.courant) || (rang(x.key) - rang(y.key)));
                        })();
                        return {
                            etat, icone, titre, raison, conseil, decouverts, atterrissages,
""")

# ══ 2. LE GABARIT : la liste sous le verdict, la pastille du courant seul s'en va ══
DEBUT = """        <!-- Le verdict -->
        <div class="flex gap-3 md:gap-4 items-start min-w-0 md:col-start-1 md:row-start-1">
"""
FIN = """
        <!-- 💸 RESTE À DÉPENSER"""
if src.count(DEBUT) != 1 or src.count(FIN) != 1:
    print('✖ bloc du verdict introuvable'); sys.exit(1)
i0 = src.index(DEBUT); i1 = src.index(FIN)
verdict = src[i0:i1]
PASTILLES = """                <div v-if="chips" class="mt-2.5 md:mt-3 flex flex-wrap gap-1.5 text-[10px] md:text-[11px] font-bold" data-meteo-etat>
                    <span class="rounded-full bg-white/15 ring-1 ring-white/20 px-2.5 py-1">🏁 Atterrissage le {{ meteo.dateFin }} : {{ formatMad(meteo.atterrissage) }}</span>
                    <span class="hidden md:inline rounded-full bg-white/15 ring-1 ring-white/20 px-2.5 py-1">🫁 Respiration du budget : {{ meteo.respirationPct }} %</span>
                </div>
"""
if verdict.count(PASTILLES) != 1 or not verdict.endswith("""            </div>
        </div>
"""):
    print('✖ pastilles du verdict introuvables'); sys.exit(1)
verdict = verdict.replace(PASTILLES, """                <div v-if="chips" class="hidden md:flex mt-3 flex-wrap gap-1.5 text-[11px] font-bold" data-meteo-etat>
                    <span class="rounded-full bg-white/15 ring-1 ring-white/20 px-2.5 py-1">🫁 Respiration du budget : {{ meteo.respirationPct }} %</span>
                </div>
""")
corps = verdict[len(DEBUT):]
#  Le verdict d'avant, tel quel, un cran plus à droite, dans un conteneur qui porte la liste
corps = ''.join(('    ' + l if l.strip() else l) for l in corps.splitlines(True))
nouveau = """        <!-- Le verdict, puis où finit chaque compte -->
        <div class="min-w-0 md:col-start-1 md:row-start-1">
            <div class="flex gap-3 md:gap-4 items-start min-w-0">
""" + corps + """            <!-- 🏁 v37.33 : L'ATTERRISSAGE DE CHAQUE COMPTE — toujours là, vert ou rouge -->
            <div v-if="meteo.atterrissages && meteo.atterrissages.length" data-meteo-atterrissages
                 class="mt-3 md:mt-4 rounded-2xl bg-slate-950/40 backdrop-blur-md ring-1 ring-white/10 px-2.5 pt-2 pb-1 md:px-3.5 md:pt-2.5">
                <p class="flex items-baseline justify-between gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/55">
                    <span class="whitespace-nowrap">🏁 Fin de cycle</span>
                    <span class="truncate normal-case tracking-normal font-bold text-white/45" data-meteo-atterrissages-date>le {{ meteo.dateFin }}</span>
                </p>
                <ul class="mt-1 divide-y divide-white/[0.08]" aria-label="Atterrissage de chaque compte en fin de cycle">
                    <li v-for="c in meteo.atterrissages" :key="'att_' + c.key" data-meteo-atterrissage :data-compte="c.key" :data-signe="c.atterrissage < 0 ? 'negatif' : 'positif'"
                        :title="c.compte.label + ' : ' + formatMad(c.t0) + ' aujourd’hui → ' + formatMad(c.atterrissage) + ' le ' + meteo.dateFin"
                        class="flex items-center gap-2.5 py-1.5 md:py-2">
                        <mono-compte :c="c.compte" grand></mono-compte>
                        <span class="min-w-0 flex-1 truncate text-[13px] md:text-sm font-bold text-white/90" data-meteo-atterrissage-nom>{{ c.compte.tag }}</span>
                        <span :class="['shrink-0 tabular-nums whitespace-nowrap leading-none', c.atterrissage < 0 ? 'text-rose-300' : 'text-emerald-300']" data-meteo-atterrissage-montant>
                            <span class="text-base md:text-lg font-black">{{ c.signe }} {{ chiffre(c.valeur) }}</span>
                            <span class="ml-0.5 text-[10px] font-bold opacity-75">DH</span>
                        </span>
                    </li>
                </ul>
            </div>
        </div>
"""
src = src[:i0] + nouveau + src[i1:]

for a, r, n in edits: src = src.replace(a, r, n)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ {len(edits)} modification(s) + gabarit du verdict appliqués à {F}')
