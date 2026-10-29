#!/usr/bin/env python3
"""v37.77 — LE CYCLE SE LIT COMME LE RELEVÉ.

« Regarde comme le journal est plus parlant que ton truc. Comment rendre le gros chiffre (14 k) plus
  compréhensible, et voir où sont les alertes (dans quelles cases j'ai dépassé) ? Pourquoi il me dit
  que le Courant sera négatif le 30 nov. ? Et améliorer le journal : les jours du mois au lieu des J-X. »

  1. Le Relevé date chaque ligne : « lun. 30 nov. » au lieu de « j.30 » (le mois se déduit du cycle :
     un jour au moins égal au jour de paie appartient au mois précédent).
  2. POURQUOI CE POINT BAS — pour chaque compte qui passe sous zéro (radar « Sécurité des comptes »,
     grande case des virements) : les sorties qui y mènent, depuis quand, les plus grosses, et les
     prochaines entrées qui le font remonter. Le cas rapporté : la paie du 27 nov. ouvre un cycle dont
     les budgets de la semaine sont pris sur le Courant dès le 27 et le 30, alors que ses entrées
     (loyers, CNSS) n'arrivent que les 5 et 6 déc. — le salaire, lui, tombe sur un autre compte.
  3. LE GROS CHIFFRE, EXPLIQUÉ — sous le Reste à dépenser, le calcul en clair : le budget conso moins
     ce qui est déjà dépensé ; et, s'il est plafonné, ce que le compte peut réellement payer d'ici la paie.
  4. LES DÉPASSEMENTS DU CYCLE dans la Météo (les mêmes que « À surveiller » de la frise), avec un
     bouton vers la frise ; au téléphone, leur nombre sur le bouton de la frise.
  5. LE ZOOM : un compte de « Vos comptes » se clique et ouvre son Relevé.
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

# ── 1. Le Relevé daté ───────────────────────────────────────────────────────────
sub('relevé : en-tête', """text-gray-400 w-10">J.</th>""", """text-gray-400 w-20">Date</th>""", 2)
sub('relevé : solde initial', """{{ e.jourPrevu ? 'J.' + e.jourPrevu : '' }}""", """{{ dateReleve(e) }}""", 2)
sub('relevé : réalisé', """{{ e.jourPrevu ? 'j.' + e.jourPrevu : '✓' }}""", """{{ dateReleve(e) || '✓' }}""", 2)
sub('relevé : prévu', """{{ e.jourPrevu ? 'j.' + e.jourPrevu : '' }}""", """{{ dateReleve(e) }}""", 2)
sub('relevé : la date d une ligne',
"""                    const _MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];""",
"""                    const _MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
                    //  v37.77 : « lun. 30 nov. » au lieu de « j.30 » — le mois vient du cycle de la ligne ; un jour au moins
                    //  égal au jour de paie appartient au mois PRÉCÉDENT (le cycle de décembre court du 27 nov. au 26 déc.)
                    const _JOURS_RELEVE = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
                    const dateReleve = (e) => {
                        const j = Number(e && e.jourPrevu);
                        if (!j) return '';
                        const mb = moisBudgetaire.value, jdp = jourDePaie.value;
                        let [m, a] = String((e && e.cycle) || (mb.mois + '-' + mb.an)).split('-').map(Number);
                        if (!m || !a) { m = mb.mois; a = mb.an; }
                        if (jdp > 1 && j >= jdp) { m--; if (m < 1) { m = 12; a--; } }
                        const d = new Date(a, m - 1, Math.min(j, new Date(a, m, 0).getDate()));
                        return _JOURS_RELEVE[d.getDay()] + ' ' + d.getDate() + ' ' + _MOIS_COURTS[d.getMonth()];
                    };""")

# ── 2. Pourquoi ce point bas ────────────────────────────────────────────────────
sub('radar : pourquoi',
"""                            const dateNeg = iNeg <= 0 ? null : lignes[iNeg - 1].date;""",
"""                            const dateNeg = iNeg <= 0 ? null : lignes[iNeg - 1].date;
                            //  v37.77 : POURQUOI ce point bas — les sorties qui s'enchaînent jusqu'à lui, et les entrées qui suivent
                            let pourquoi = null;
                            if (pointBas < 0 && iBas > 0) {
                                const court = (l) => String(l || '').replace(/^\\P{L}+/u, '').replace(/\\s+—\\s+/, ' · ').slice(0, 48);
                                const deb = [];
                                for (let q = iBas - 1; q >= 0 && lignes[q].type === 'debit'; q--) deb.push(lignes[q]);
                                const ent = lignes.slice(iBas).filter(p => p.type === 'credit').slice(0, 3);
                                if (deb.length) pourquoi = {
                                    depuis: lib(deb[deb.length - 1].date), jusque: lib(deb[0].date),
                                    sorties: Math.round(deb.reduce((x, p) => x + p.montant, 0)),
                                    principales: deb.slice().sort((x, y) => y.montant - x.montant).slice(0, 2).map(p => ({ libelle: court(p.libelle), montant: Math.round(p.montant), quand: lib(p.date) })),
                                    entrees: ent.map(p => ({ libelle: court(p.libelle), montant: Math.round(p.montant), quand: lib(p.date) })),
                                };
                            }""")
sub('radar : pourquoi exposé',
"""                                points: points.map(v => Math.round(v)), nbLignes: lignes.length, donneur: null,""",
"""                                points: points.map(v => Math.round(v)), nbLignes: lignes.length, donneur: null, pourquoi,""")
sub('radar : pourquoi affiché',
"""                <span v-if="c.fin >= 0" class="block font-semibold text-rose-700/80">La fin d'année est positive, mais le compte passe sous zéro avant.</span>
            </p>""",
"""                <span v-if="c.fin >= 0" class="block font-semibold text-rose-700/80">La fin d'année est positive, mais le compte passe sous zéro avant.</span>
            </p>
            <!-- v37.77 : pourquoi ce point bas -->
            <p v-if="c.aVirer > 0 && c.pourquoi" class="mt-1.5 rounded-lg bg-white/80 ring-1 ring-rose-100 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 leading-snug" data-radar-pourquoi>
                <b class="text-rose-800">Pourquoi ?</b> {{ c.pourquoi.depuis === c.pourquoi.jusque ? 'Le ' + c.pourquoi.depuis : 'Du ' + c.pourquoi.depuis + ' au ' + c.pourquoi.jusque }}, {{ formatMad(c.pourquoi.sorties) }} de sorties<template v-if="c.pourquoi.principales.length"> ({{ c.pourquoi.principales.map(x => x.libelle + ' ' + formatMad(x.montant)).join(', ') }})</template>
                <template v-if="c.pourquoi.entrees.length"> avant les prochaines entrées : {{ c.pourquoi.entrees.map(x => x.libelle + ' ' + formatMad(x.montant) + ' le ' + x.quand).join(', ') }}</template><template v-else> — et plus aucune entrée prévue d’ici le {{ radar.horizon }}</template>
            </p>""")
sub('virements : pourquoi',
"""                                pointBas: b.pointBas, datePointBas: b.datePointBas,""",
"""                                pointBas: b.pointBas, datePointBas: b.datePointBas, pourquoi: b.pourquoi || null,""")
sub('virements : pourquoi affiché',
"""                                <p class="text-slate-600" data-meteo-virement-quand>avant le <b>{{ b.avantLe }}</b> — sans lui, {{ b.compte.tag }} descendrait à <b class="text-rose-700 whitespace-nowrap">{{ formatMad(b.pointBas) }}</b> le {{ b.datePointBas }}</p>""",
"""                                <p class="text-slate-600" data-meteo-virement-quand>avant le <b>{{ b.avantLe }}</b> — sans lui, {{ b.compte.tag }} descendrait à <b class="text-rose-700 whitespace-nowrap">{{ formatMad(b.pointBas) }}</b> le {{ b.datePointBas }}</p>
                                <p v-if="b.pourquoi" class="text-[11px] text-slate-500 font-semibold" data-meteo-virement-pourquoi>Pourquoi : {{ formatMad(b.pourquoi.sorties) }} de sorties {{ b.pourquoi.depuis === b.pourquoi.jusque ? 'le ' + b.pourquoi.depuis : 'du ' + b.pourquoi.depuis + ' au ' + b.pourquoi.jusque }}<template v-if="b.pourquoi.entrees.length">, avant {{ b.pourquoi.entrees.map(x => x.libelle + ' le ' + x.quand).join(', ') }}</template></p>""")

# ── 3. Le gros chiffre, expliqué ────────────────────────────────────────────────
sub('reste : le calcul en clair',
"""                <p v-else-if="p.contrainte === 'tresorerie'" class="hidden md:block mt-2 text-[11px] font-bold text-amber-100 leading-snug" data-pulse-plafond>🏦 Plafonné par la trésorerie : le budget laisserait {{ formatMad(p.resteBudget) }}, le compte n'en couvre que {{ formatMad(p.reste) }} d'ici la paie.</p>""",
"""                <div v-else-if="p.contrainte === 'tresorerie'" class="hidden md:block mt-2 rounded-xl bg-black/20 ring-1 ring-white/15 px-2.5 py-1.5 text-[11px] font-semibold text-white/85 leading-snug tabular-nums" data-pulse-plafond>
                    <p class="font-black text-amber-100">🧮 {{ formatMad(p.reste) }} : le plus petit de deux montants (🏦 Plafonné par la trésorerie)</p>
                    <p>· le budget conso : {{ formatMad(p.budget) }} − {{ formatMad(p.engage) }} déjà dépensés = {{ formatMad(p.resteBudget) }}</p>
                    <p>· ce que {{ p.compte ? p.compte.tag : 'le compte' }} peut payer d’ici la paie, factures et charges déduites : <b class="text-white">{{ formatMad(p.reste) }}</b></p>
                </div>
                <p v-else-if="p.declare" class="hidden md:block mt-2 text-[11px] font-semibold text-white/75 leading-snug tabular-nums" data-pulse-calcul-clair>🧮 {{ formatMad(p.reste) }} = le budget conso {{ formatMad(p.budget) }} − {{ formatMad(p.engage) }} déjà dépensés.</p>""")

# ── 4. Les dépassements du cycle ────────────────────────────────────────────────
sub('frise : calcul sans la fenêtre',
"""                    const friseCycle = computed(() => {
                        if (!friseOuverte.value) return null;
""",
"""                    //  v37.77 : calculée même frise fermée — la Météo en montre les dépassements
                    const _friseCalc = computed(() => {
""")
sub('frise : la fenêtre',
"""                        return { du: lib(debut), au: lib(fin), jours: J, aujJ, aujPct: aujJ / J * 100, morceaux: morceaux.map(({ vals, T, defs, m, ...x }) => x), categories, alertes, quinzaine };
                    });
""",
"""                        return { du: lib(debut), au: lib(fin), jours: J, aujJ, aujPct: aujJ / J * 100, morceaux: morceaux.map(({ vals, T, defs, m, ...x }) => x), categories, alertes, quinzaine };
                    });
                    const friseCycle = computed(() => friseOuverte.value ? _friseCalc.value : null);
""")
sub('météo : dépassements',
"""                            pourquoi, ailleurs,
                            etat, icone, titre, raison, conseil, decouverts, atterrissages,""",
"""                            pourquoi, ailleurs,
                            depassements: (() => { try { return isCyclePasse.value ? [] : ((_friseCalc.value || {}).alertes || []); } catch (_) { return []; } })(),   // v37.77
                            etat, icone, titre, raison, conseil, decouverts, atterrissages,""")
sub('météo : dépassements affichés',
"""            <!-- 🗓️ Par SEMAINE : on LIT le reste de la semaine, on TAPE ce qui est parti.""",
"""            <!-- v37.77 : OÙ L'ON A DÉPASSÉ — les cases de la frise en alerte -->
            <div v-if="meteo.depassements && meteo.depassements.length" class="hidden md:block mt-2.5 rounded-xl bg-rose-500/25 ring-1 ring-rose-200/40 px-2.5 py-1.5" data-meteo-depassements>
                <p class="flex items-center justify-between gap-2 text-[11px] font-black text-white">
                    <span>⚠️ {{ meteo.depassements.length > 1 ? meteo.depassements.length + ' dépassements' : '1 dépassement' }} ce cycle</span>
                    <button type="button" data-meteo-depassements-frise @click="$emit('frise')" class="shrink-0 rounded-full bg-white text-rose-700 px-2 py-0.5 text-[10px] font-black hover:bg-rose-50">voir dans la frise</button>
                </p>
                <p v-for="(a, i) in meteo.depassements.slice(0, 3)" :key="'dp' + i" class="mt-0.5 text-[11px] font-semibold text-rose-50 leading-snug truncate" :title="a" data-meteo-depassement>{{ a }}</p>
            </div>
            <!-- 🗓️ Par SEMAINE : on LIT le reste de la semaine, on TAPE ce qui est parti.""")
sub('météo : nombre sur le bouton de la frise',
"""class="rounded-full bg-white text-slate-900 px-2.5 py-0.5 text-[10px] font-black shadow-sm hover:bg-emerald-100">📈 Voir le cycle et ses semaines</button>""",
"""class="rounded-full bg-white text-slate-900 px-2.5 py-0.5 text-[10px] font-black shadow-sm hover:bg-emerald-100">📈 Voir le cycle et ses semaines<span v-if="meteo.depassements && meteo.depassements.length" class="ml-1 text-rose-600" data-frise-nb-depassements>· ⚠️ {{ meteo.depassements.length }}</span></button>""")

# ── 5. Le zoom : un compte ouvre son Relevé ─────────────────────────────────────
sub('vos comptes : clic',
"""                        class="grid grid-cols-[minmax(0,1fr)_auto_auto] md:grid-cols-[minmax(0,1fr)_repeat(3,minmax(3.6rem,auto))] items-center gap-x-2 md:gap-x-3 py-1 md:py-2">""",
"""                        @click="$emit('releve', c.key)" role="button" tabindex="0" @keydown.enter="$emit('releve', c.key)"
                        class="grid grid-cols-[minmax(0,1fr)_auto_auto] md:grid-cols-[minmax(0,1fr)_repeat(3,minmax(3.6rem,auto))] items-center gap-x-2 md:gap-x-3 py-1 md:py-2 cursor-pointer rounded-lg hover:bg-white/[0.06]">""")
sub('vos comptes : titre du clic',
""":title="c.compte.label + ' : ' + formatMad(c.t0) + ' aujourd’hui · au plus bas ' + formatMad(c.bas) + ' (' + c.basQuand + ') · ' + formatMad(c.atterrissage) + ' le ' + meteo.dateFin\"""",
""":title="c.compte.label + ' : ' + formatMad(c.t0) + ' aujourd’hui · au plus bas ' + formatMad(c.bas) + ' (' + c.basQuand + ') · ' + formatMad(c.atterrissage) + ' le ' + meteo.dateFin + ' — cliquer : son Relevé, ligne à ligne'\"""")
sub('montages : relevé', """@frise="friseOuverte = true"></meteo-financiere>""", """@frise="friseOuverte = true" @releve="ouvrirReleve"></meteo-financiere>""", 3)
sub('exposition', """friseOuverte, friseCycle, """, """friseOuverte, friseCycle, dateReleve, """)

sub('météo : émet releve',
"""            emits: ['aller', 'revenir', 'effacer', 'semaine', 'saisie', 'retirer', 'cloturer', 'retirer-virement', 'frise'],""",
"""            emits: ['aller', 'revenir', 'effacer', 'semaine', 'saisie', 'retirer', 'cloturer', 'retirer-virement', 'frise', 'releve'],""")
io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.77 : Relevé daté, pourquoi du point bas, gros chiffre expliqué, dépassements, zoom vers le Relevé')
