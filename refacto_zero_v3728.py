# -*- coding: utf-8 -*-
"""
v37.28 Cases-Vierges — « les champs de saisie doivent être à zéro par défaut ».

  Retour utilisateur : les cases des postes (Marjane, Hri…) affichaient avant
  toute frappe une estimation en italique (« ≈ 172 ») ; on croyait la case
  déjà remplie. Règle désormais :

    • une case vaut ce que l'utilisateur a TAPÉ, rien d'autre : vide, invite « 0 » ;
    • le « Prévu » de la semaine se lit À CÔTÉ de la case, en texte gris
      (« Prévu : 400 DH »), jamais dedans ;
    • aucune estimation n'entre dans une case, un total de ligne ou l'en-tête
      des Rayons X : sans saisie, 0 DH dépensé ;
    • plus aucune fonction n'écrit dans les saisies à la place de l'utilisateur
      (l'agrégation automatique « remplirConsoT0DepuisReel », orpheline depuis
      la suppression du bloc T0 en v37.24, est retirée).

  Le grand « Reste à dépenser » garde sa prudence (estimation au prorata tant
  que rien n'est saisi) : elle est dite en clair sous le chiffre et dans ⓘ,
  et le moteur (consoCategoriesT0, liberteCycle.engage/reste) ne change pas.
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

# ══ MOTEUR ═══════════════════════════════════════════════════════════════════
# ── 1. La semaine : 0 sans saisie, plus d'estimation ────────────────────────
sub('semaine sans estimation', r"""                            const ailleurs = c.declare || declare;                       // déclaré ailleurs dans le cycle
                            //  Une estimation n'a de sens que pour la semaine EN COURS, tant que rien n'est déclaré
                            //  dans le cycle ; une semaine passée ou à venir sans saisie vaut 0, pas « tout dépensé ».
                            const estimee = !declS && !ailleurs && decal === 0;
                            const engS = declS ? Math.max(saisiS, ticketsS) : (estimee ? Math.round(semBudget * frac) : 0);""",
    r"""                            //  v37.28 : une semaine vaut ce qui a été TAPÉ (ou ticketé), rien d'autre.
                            //  Aucune estimation n'entre dans une case : sans saisie, 0.
                            const engS = declS ? Math.max(saisiS, ticketsS) : 0;""")
sub('source sans « estime »', r"""                                source: declS ? (ticketsS > saisiS ? 'tickets' : 'compteur') : (estimee ? 'estime' : 'vide'),""",
    r"""                                source: declS ? (ticketsS > saisiS ? 'tickets' : 'compteur') : 'vide',""")
sub('semaine.estime retiré', r"""                                         estime: categories.length > 0 && categories.every(c => c.sem.source === 'estime'),
""", '')

# ── 2. La catégorie du cycle : le RÉEL, à côté de l'engagé du moteur ───────
sub('réel de la catégorie', r"""                            const resteCat = c.budget - engageCat;
""", r"""                            const resteCat = c.budget - engageCat;
                            //  v37.28 : ce qui a VRAIMENT été saisi ou ticketé — 0 tant que rien
                            //  n'est déclaré. C'est ce qu'affichent les Rayons X ; l'estimation
                            //  reste l'affaire du moteur (grand chiffre, ⓘ), jamais d'une case.
                            const reelCat = c.declare ? engageCat : 0;""")
sub('réel exposé', r"""                                reste: resteCat, parSemaine: resteCat > 0 ? Math.floor(resteCat / jours * 7) : 0,
""", r"""                                reste: resteCat, parSemaine: resteCat > 0 ? Math.floor(resteCat / jours * 7) : 0,
                                reel: reelCat, resteReel: c.budget - reelCat, parSemaineReel: c.budget - reelCat > 0 ? Math.floor((c.budget - reelCat) / jours * 7) : 0,
""")

# ── 3. Plus aucune écriture automatique dans les saisies ───────────────────
debut = "                    // ⚡ Agrégation automatique depuis les transactions réelles du cycle\n"
fin = "                    // Listes en lecture seule pour la vue théorique (groupées par compte)\n"
i, j = src.find(debut), src.find(fin)
if i < 0 or j < 0 or j < i or src.count(debut) != 1:
    print('✖ remplirConsoT0DepuisReel : bornes introuvables'); sys.exit(1)
bloc = src[i:j]
if 'const remplirConsoT0DepuisReel = () => {' not in bloc or bloc.count('const ') > 20:
    print('✖ remplirConsoT0DepuisReel : bloc inattendu'); sys.exit(1)
sub('agrégation automatique retirée', bloc, '')
sub('agrégation retirée de l\'export', r"""                        setConsoT0, resetConsoT0, remplirConsoT0DepuisReel,""",
    r"""                        setConsoT0, resetConsoT0,""")

# ══ MÉTÉO ════════════════════════════════════════════════════════════════════
# ── 4. Les invites « ≈ » disparaissent : une case vide dit « 0 » ────────────
sub('invite(c) retirée', r"""                //  L'invite du champ dit ce qui compte tant qu'on n'a rien tapé :
                //  les tickets s'il y en a, sinon l'estimation au rythme attendu.
                invite(c) { return c.sem.tickets > 0 ? String(c.sem.tickets) : (c.sem.source === 'estime' && c.sem.engage > 0 ? '≈ ' + this.chiffre(c.sem.engage) : '0'); },
""", '')
sub('invitePoste retirée', r"""                //  Avant toute saisie : l'estimation du poste pour la part écoulée de la semaine.
                invitePoste(c, d) {
                    const e = c.sem.source === 'estime' ? Math.round(d.budget * (this.sm.frac || 0)) : 0;
                    return e > 0 ? '≈ ' + this.chiffre(e) : '0';
                },
""", '')
sub('case unique : invite 0', r"""                                   :value="c.sem.saisi || ''" :placeholder="invite(c)"
""", r"""                                   :value="c.sem.saisi || ''" placeholder="0"
""")
sub('case poste : invite 0', r"""                                       :value="d.declare ? d.saisi : ''" :placeholder="invitePoste(c, d)"
""", r"""                                       :value="d.declare ? d.saisi : ''" placeholder="0"
""")
# L'italique faisait passer l'invite pour une valeur estimée : invite droite et pâle.
sub('invite non italique (case unique)', r"""placeholder:text-white/55 placeholder:italic placeholder:font-semibold""",
    r"""placeholder:text-white/35 placeholder:font-semibold""")
sub('invite non italique (postes)', r"""placeholder:text-white/45 placeholder:italic placeholder:font-semibold""",
    r"""placeholder:text-white/35 placeholder:font-semibold""", expected=2)

# ── 5. Le Prévu se lit À CÔTÉ de la case ────────────────────────────────────
sub('ligne : Prévu : X DH', r"""                                    <template v-if="c.sem.reste >= 0">{{ c.sem.source === 'estime' ? '≈ ' : '' }}reste <span class="font-black text-white/90">{{ chiffre(c.sem.reste) }}</span> / {{ chiffre(c.sem.budget) }}</template>
                                    <template v-else><span class="font-black text-rose-200">dépassé de {{ chiffre(-c.sem.reste) }}</span> / {{ chiffre(c.sem.budget) }}</template>
""", r"""                                    <span data-pulse-prevu>Prévu : {{ chiffre(c.sem.budget) }} DH</span>
                                    <template v-if="c.sem.declare"> · <template v-if="c.sem.reste >= 0">reste <span class="font-black text-white/90">{{ chiffre(c.sem.reste) }}</span></template><span v-else class="font-black text-rose-200">dépassé de {{ chiffre(-c.sem.reste) }}</span></template>
""")
sub('poste : Prévu : X DH', r"""<span class="block text-[10px] font-semibold text-white/45 tabular-nums leading-tight whitespace-nowrap">prévu {{ chiffre(d.budget) }}<template""",
    r"""<span class="block text-[10px] font-semibold text-white/45 tabular-nums leading-tight whitespace-nowrap" data-pulse-prevu>Prévu : {{ chiffre(d.budget) }} DH<template""")

# ── 6. Le total d'une ligne : le réel de la semaine, sans « ≈ » ni italique ─
sub('total de ligne réel', r"""<span :class="['text-[13px] md:text-sm font-black tabular-nums', c.sem.source === 'estime' ? 'italic text-white/65' : 'text-white']" data-pulse-total>{{ c.sem.source === 'estime' ? '≈ ' : '' }}{{ chiffre(c.sem.engage) }}</span>""",
    r"""<span class="text-[13px] md:text-sm font-black tabular-nums text-white" data-pulse-total>{{ chiffre(c.sem.engage) }}</span>""")
sub('total de semaine réel', r"""{{ sm.estime ? '≈ ' : '' }}{{ formatMad(sm.engage) }}""", r"""{{ formatMad(sm.engage) }}""")
sub('ligne : plus de style « estimé »', r"""(c.sem.source === 'estime' ? 'bg-white/[0.04] ring-white/10' : 'bg-white/[0.08] ring-white/15')""", r"""'bg-white/[0.08] ring-white/15'""")
sub('anneau : plus de style « estimé »', r"""(c.sem.source === 'estime' ? 'stroke-white/50' : 'stroke-white')""", r"""'stroke-white'""")
sub('bouton : plus de style « estimé »', r"""(c.sem.source === 'estime' ? 'bg-black/25 ring-white/35 hover:ring-white/70' : 'bg-black/35 ring-white/50 hover:ring-white/70')""",
    r"""'bg-black/35 ring-white/50 hover:ring-white/70'""")

# ══ RAYONS X ═════════════════════════════════════════════════════════════════
# ── 7. L'en-tête : ce qui est dépensé (0 sans saisie), le prévu à part ──────
sub('rx : dépensé réel, prévu à part', r"""                        <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">🔍 Ce cycle</p>
                        <p class="text-sm font-black text-white truncate">{{ rxContenu.c.label }}</p>
                    </div>
                    <p class="shrink-0 text-right tabular-nums leading-tight">
                        <span class="block text-lg font-black text-white" data-rx-total>{{ formatMad(rxContenu.c.engage) }}</span>
                        <span class="block text-[10px] font-semibold text-slate-400">sur {{ formatMad(rxContenu.c.budget) }}</span>""",
    r"""                        <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">🔍 Ce cycle</p>
                        <p class="text-sm font-black text-white truncate">{{ rxContenu.c.label }}</p>
                        <p class="text-[10px] font-semibold text-slate-400 tabular-nums" data-rx-prevu-total>Prévu : {{ formatMad(rxContenu.c.budget) }}</p>
                    </div>
                    <p class="shrink-0 text-right tabular-nums leading-tight">
                        <span class="block text-lg font-black text-white" data-rx-total>{{ formatMad(rxContenu.c.reel) }}</span>
                        <span class="block text-[10px] font-semibold text-slate-400">dépensé</span>""")
sub('rx : barre du réel', r"""<div :class="['h-full rounded-full', rxContenu.c.reste < 0 ? 'bg-rose-400' : 'bg-emerald-300']" :style="{ width: anneau(rxContenu.c) + '%' }"></div>""",
    r"""<div data-rx-barre :class="['h-full rounded-full', rxContenu.c.resteReel < 0 ? 'bg-rose-400' : 'bg-emerald-300']" :style="{ width: anneau({ engage: rxContenu.c.reel, budget: rxContenu.c.budget }) + '%' }"></div>""")
sub('rx : rien de saisi = 0', r"""                    <template v-if="rxContenu.c.source === 'estime'">≈ Rien de déclaré : estimé au rythme attendu ({{ formatMad(rxContenu.c.engage) }}). Saisissez-le sur la carte (bouton ✎ de la ligne).</template>""",
    r"""                    <template v-if="rxContenu.c.source === 'estime'">✍️ Rien de saisi ce cycle : 0 DH dépensé. Tapez vos dépenses dans les cases de la ligne (✎), semaine par semaine.<span v-if="rxContenu.c.engage > 0" class="block mt-1 text-slate-500" data-rx-prudence>En attendant, le Reste à dépenser en déduit par prudence {{ formatMad(rxContenu.c.engage) }} (rythme attendu, voir ⓘ) — rien n'est écrit dans vos cases.</span></template>""")
sub('rx : reste du réel', r"""                    <span class="text-slate-400"><template v-if="rxContenu.c.reste > 0">≈ {{ formatMad(rxContenu.c.parSemaine) }} / sem. d'ici la paie</template><template v-else>Plus rien à dépenser ici</template></span>
                    <span :class="['whitespace-nowrap', rxContenu.c.reste < 0 ? 'text-rose-300' : 'text-emerald-300']" data-rx-reste>{{ rxContenu.c.reste >= 0 ? 'Reste ' + formatMad(rxContenu.c.reste) : 'Dépassé de ' + formatMad(-rxContenu.c.reste) }}</span>""",
    r"""                    <span class="text-slate-400"><template v-if="rxContenu.c.resteReel > 0">≈ {{ formatMad(rxContenu.c.parSemaineReel) }} / sem. d'ici la paie</template><template v-else>Plus rien à dépenser ici</template></span>
                    <span :class="['whitespace-nowrap', rxContenu.c.resteReel < 0 ? 'text-rose-300' : 'text-emerald-300']" data-rx-reste>{{ rxContenu.c.resteReel >= 0 ? 'Reste ' + formatMad(rxContenu.c.resteReel) : 'Dépassé de ' + formatMad(-rxContenu.c.resteReel) }}</span>""")

for a, r, n in edits: src = src.replace(a, r, n)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ {len(edits)} modifications appliquées à {F}')
