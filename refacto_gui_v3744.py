# -*- coding: utf-8 -*-
"""
v37.44 Interface-Desktop — audit global de l'interface de bureau (Playwright,
1280×720 et 1440×900, chaque onglet des deux modes et les modales), et ses
corrections :

  1. LISIBILITÉ — 672 textes de 7 à 9 px (13 écrans à 1280 px). Sur ordinateur : 7-8 px → 10 px,
     9 px → 10,5 px (une taille md:/lg: propre est respectée ; le monogramme de
     compte, pastille de taille fixe, n'est pas touché).
  2. CONTRASTE — les gris clairs (gray-400, slate-400) sur fond clair donnaient
     2,4:1 à 2,6:1. Sur fond clair seulement, ils passent au ton au-dessus
     (≥ 4,5:1) ; sur fond sombre, rien ne change. La surface la plus proche
     décide (variables CSS héritées) : une seule règle par ton, 19 Ko. Libellés du menu
     (« MODE APPLICATION », « ACTIONS IA ») et Annuler/Refaire inactifs relevés.
  3. TABLEAU DE BORD À 1280 PX — les cinq cartes KPI débordaient de 27 à 60 px
     (« -20 239 DH » coupé au bord). Grille auto-ajustée à la place disponible.
  4. MENU — « Calendrier Plurian… », « Patrimoine & Obje… », « Contrôle Budget
     v… » tronqués : le libellé passe à la ligne au lieu d'être coupé.
  5. CHANGELOG ET AVERTISSEMENT D'IMPORT MUETS en mode Réalisé (et sur mobile) :
     les deux fenêtres étaient rangées dans le conteneur du mode Prévisionnel de
     bureau. Elles vivent maintenant à la racine de l'application.
  6. SOLDES : Trésorerie disait « pour modifier les soldes, utilisez Budget
     Structurel » alors que ses soldes sont éditables, et Budget Structurel
     renvoyait à Trésorerie. Les deux disent maintenant la vérité.
  7. FONDS DE SÉCURITÉ : la cible valait N mois de SURPLUS (négative quand le
     surplus l'est : « -121 437 DH »). Elle vaut N mois de DÉPENSES (charges
     fixes + variables), la base du KPI « Fonds de survie », avec la couverture
     actuelle.
  8. PATRIMOINE : la pastille de quote-part s'affichait vide pour un bien sans
     quote-part, et « 35 » sans unité.
  9. BOUTONS-ICÔNES (✕, ×, ↑, ↓) : 41 boutons sans nom — un libellé (Supprimer,
     Fermer, Annuler, Monter, Descendre) tiré de leur action.
 11. TITRE DE L'ONGLET : « v32.60 Auto-Categorisation » (douze versions de retard)
     → « Finance Master — espace privé » ; la page se déclare non indexable
     (robots noindex) : elle n'a rien à faire dans un moteur de recherche.
 10. SYNTHÈSE RÉEL : « En construction — Phase 5 » faisait une page morte dans le
     menu. Elle montre l'année mois par mois (prévu, réalisé, écart, consommé),
     avec les MÊMES chiffres que le Contrôle Budget vs Réel ; un clic sur un mois
     ouvre son détail par catégorie.
"""
import io, re, sys

F = 'index.html'
src = io.open(F, encoding='utf-8').read()

def sub(label, a, b, n=1):
    global src
    c = src.count(a)
    if c != n:
        print(f'✖ {label} : {c} ancre(s), {n} attendue(s)'); sys.exit(1)
    src = src.replace(a, b)

# ── 1-2. Lisibilité et contraste (desktop) ────────────────────────────────────
TEINTES_TW = ['slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'rose', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald',
              'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink']
SANS_TAILLE = ':not(:where([class*="md:text-"], [class*="lg:text-"]))'
#  La SURFACE LA PLUS PROCHE décide (variables CSS héritées) :
#   • claire : blanc (plein ou opaque à 60 % et plus), toute teinte 50 / 100, un dégradé qui part d'une teinte
#     50 / 100 — elle pose les tons lisibles ;
#   • sombre : toute teinte 500 à 950 (pleine ou translucide), noir, couleur arbitraire, dégradé qui part d'une
#     teinte 500 à 900 — elle les annule : le ton d'origine revient.
#   Un voile léger (blanc à 10-30 %, teinte 50 à 40 %) n'est pas une surface : on regarde au-dessus.
#   Classes exactes : « hover:bg-white » n'est pas un fond. Même spécificité : un élément à la fois clair et
#   sombre (bordure translucide sur une carte blanche) reste clair, la règle claire venant après.
CLAIR = ', '.join(['.bg-white'] + [f'.bg-white\\/{n}' for n in (60, 70, 75, 80, 90, 95)]
                  + [f'.{p}-{c}-{d}' for p in ('bg', 'from') for c in TEINTES_TW for d in ('50', '100')]
                  + [f'.bg-{c}-{d}\\/{n}' for c in TEINTES_TW for d in ('50', '100') for n in (60, 70, 75, 80, 90, 95)])
FONCE = ', '.join([f'.bg-{c}-{d}' for c in TEINTES_TW for d in ('500', '600', '700', '800', '900', '950')]
                  + [f'.from-{c}-{d}' for c in TEINTES_TW for d in ('500', '600', '700', '800', '900', '950')]
                  + ['.bg-black', '[class*="bg-black/"]', '[class*="bg-["]']
                  + [f'[class*="bg-{c}-{d}/"]' for c in TEINTES_TW for d in ('500', '600', '700', '800', '900', '950')])
#  ton d'origine (Tailwind 3) → ton lisible (≥ 4,5:1 sur blanc), même teinte
TONS = [('gray-400', '156 163 175', '#6b7280'), ('slate-400', '148 163 184', '#64748b'),
        ('red-400', '248 113 113', '#dc2626'), ('red-500', '239 68 68', '#dc2626'),
        ('orange-400', '251 146 60', '#c2410c'), ('orange-500', '249 115 22', '#c2410c'), ('orange-600', '234 88 12', '#c2410c'),
        ('amber-500', '245 158 11', '#b45309'), ('amber-600', '217 119 6', '#b45309'),
        ('blue-400', '96 165 250', '#2563eb'), ('blue-500', '59 130 246', '#2563eb'),
        ('sky-400', '56 189 248', '#0369a1'), ('sky-500', '14 165 233', '#0369a1'),
        ('indigo-400', '129 140 248', '#4f46e5'), ('indigo-500', '99 102 241', '#4f46e5'), ('purple-400', '192 132 252', '#9333ea'),
        ('emerald-400', '52 211 153', '#047857'), ('emerald-500', '16 185 129', '#047857'), ('emerald-600', '5 150 105', '#047857'),
        ('green-400', '74 222 128', '#15803d'), ('green-500', '34 197 94', '#15803d'), ('green-600', '22 163 74', '#15803d'),
        ('rose-500', '244 63 94', '#e11d48')]
VARS_CLAIR = ' '.join(f'--v3744-{t}: {c};' for t, _, c in TONS)
VARS_FONCE = ' '.join(f'--v3744-{t}: initial;' for t, _, _ in TONS)
TEINTES = '\n'.join(f'        html .text-{t} {{ color: var(--v3744-{t}, rgb({o} / var(--tw-text-opacity, 1))); }}' for t, o, _ in TONS)
TEINTES = f"""        {FONCE} {{ {VARS_FONCE} }}
        {CLAIR} {{ {VARS_CLAIR} }}
{TEINTES}"""
STYLE = f"""    <!-- v37.44 — LISIBILITÉ DE L'INTERFACE DE BUREAU (audit : tailles, contrastes) -->
    <style id="v3744-lisibilite">
        /*  Plus aucun texte de 7 à 9 px sur un écran de bureau : 7-8 px → 10 px, 9 px → 10,5 px.
            Une taille propre à md: / lg: est respectée ; le monogramme de compte (7,5 px, pastille de
            taille fixe) n'est pas touché. Spécificité (0,1,1) : au-dessus de l'utilitaire Tailwind,
            au-dessous de ses variantes hover: / focus:. */
        @media (min-width: 768px) {{
            html .text-\\[7px\\]{SANS_TAILLE}, html .text-\\[8px\\]{SANS_TAILLE} {{ font-size: 10px; }}
            html .text-\\[9px\\]{SANS_TAILLE} {{ font-size: 10.5px; }}
        }}
        /*  Les gris clairs et les couleurs pâles SUR FOND CLAIR passent au ton au-dessus (gris 2,5:1 → 4,8:1,
            rouge 3,8:1 → 4,8:1…), même teinte. La surface la plus proche décide : une surface claire
            pose les tons lisibles (--v3744-*), une surface sombre (menu, Météo, cartes foncées, voile
            d'une modale) les annule et le ton d'origine revient. Spécificité (0,1,1) : au-dessus de
            l'utilitaire Tailwind, au-dessous de ses variantes hover: / group-hover:. */
{TEINTES}
    </style>
</head>"""
sub('style de lisibilité', '</head>', STYLE)
sub('titre de l\'onglet', '<title>v32.60 Auto-Categorisation - Finance Master</title>',
    '<title>Finance Master — espace privé</title>\n'
    '    <!-- v37.44 : application privée — jamais indexée ni mise en cache par un moteur de recherche -->\n'
    '    <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">')

sub('menu : libellé « Mode application »', """<p v-if="!isSidebarCollapsed" class="text-[9px] text-slate-500 font-black uppercase tracking-widest text-center mb-2">Mode application</p>""",
    """<p v-if="!isSidebarCollapsed" class="text-[9px] text-slate-400 font-black uppercase tracking-widest text-center mb-2">Mode application</p>""")
sub('menu : libellé « Actions IA »', """<p v-if="!isSidebarCollapsed" class="text-[9px] text-slate-500 font-black uppercase tracking-widest text-center mb-2">Actions IA</p>""",
    """<p v-if="!isSidebarCollapsed" class="text-[9px] text-slate-400 font-black uppercase tracking-widest text-center mb-2">Actions IA</p>""")
n_ur = src.count("'bg-slate-900 text-slate-700 cursor-not-allowed border-slate-800'")
if n_ur != 2: print(f'✖ annuler/refaire inactifs : {n_ur} ancre(s), 2 attendues'); sys.exit(1)
src = src.replace("'bg-slate-900 text-slate-700 cursor-not-allowed border-slate-800'", "'bg-slate-900 text-slate-500 cursor-not-allowed border-slate-800'")

# ── 3. Tableau de bord : grille auto-ajustée ──────────────────────────────────
sub('KPI : grille', """                        <div class="cfo-collapsible-body">
                    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">""",
    """                        <div class="cfo-collapsible-body">
                    <!-- v37.44 : autant de colonnes que la place en permet (5 à 1440 px, 4 à 1280 px) — plus de chiffre qui déborde de sa carte -->
                    <div data-kpi-grille class="grid grid-cols-1 gap-4 xl:gap-6 md:[grid-template-columns:repeat(auto-fit,minmax(12.5rem,1fr))]">""")

# Les cartes : valeur en 2xl jusqu'aux très grands écrans, marge p-5, chiffres sur une ligne
g0 = src.index('data-kpi-grille'); g1 = src.index('📈 Graphiques de Répartition', g0)
zone = src[g0:g1]
if zone.count('text-2xl lg:text-3xl font-black mt-2') != 5 or zone.count('bg-white p-6 rounded-xl') != 5:
    print('✖ KPI : cartes inattendues'); sys.exit(1)
zone = zone.replace('text-2xl lg:text-3xl font-black mt-2', 'text-2xl 2xl:text-3xl font-black mt-2 tabular-nums whitespace-nowrap').replace('bg-white p-6 rounded-xl', 'bg-white p-5 rounded-xl')
src = src[:g0] + zone + src[g1:]
sub('KPI : paliers de crédit', '<span class="text-gray-400 flex-1 truncate">{{ p.range }}', '<span class="text-gray-400 flex-1 min-w-0 leading-tight">{{ p.range }}')

# ── 4. Menu : libellés sur deux lignes plutôt que coupés ──────────────────────
LIBELLES = ['Pilotage Théorique', 'Bilan & Simulation', 'Budget Structurel', 'Calendrier Pluriannuel', 'Projet Studio',
            'Patrimoine & Objectifs', 'Supervision IA', 'Paramètres', 'Pilotage Mensuel', 'Saisie', 'Contrôle Budget vs Réel',
            'Trésorerie', 'Synthèse Réel']
for l in LIBELLES:
    sub('menu : ' + l, f'<span v-if="!isSidebarCollapsed" class="truncate">{l}</span>',
        f'<span v-if="!isSidebarCollapsed" class="leading-tight" data-nav-libelle>{l}</span>')

# ── 5. Changelog et avertissement d'import : à la racine ──────────────────────
debut = src.index('            <div v-if="showImportWarning"')
fin = src.index('\n\n        </div>\n\n        <!-- ', src.index('<div v-if="showChangelog"'))
bloc = src[debut:fin]
if bloc.count('<div v-if="showChangelog"') != 1 or bloc.count('<div v-if="showImportWarning"') != 1:
    print('✖ bloc des modales : contenu inattendu'); sys.exit(1)
src = src[:debut].rstrip(' \n') + src[fin:]
sub('modales globales : point d\'arrivée', '        <div v-if="veilleSources.ouvert"',
    '        <!-- v37.44 : fenêtres globales — elles étaient rangées dans le mode Prévisionnel de bureau,\n'
    '             muettes en mode Réalisé et sur mobile (Changelog, avertissement d\'import). -->\n'
    + bloc + '\n\n        <div v-if="veilleSources.ouvert"')

sub('changelog : puces décoratives', '<span class="text-gray-300 mt-0.5">▹</span>', '<span class="text-gray-400 mt-0.5" aria-hidden="true">▹</span>')
sub('changelog : date', 'text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded font-bold uppercase', 'text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded font-bold uppercase')

# ── 6. Soldes : des indications qui disent la vérité ──────────────────────────
sub('trésorerie : aide', """                    <!-- Comptes résumé (lecture seule depuis Trésorerie) -->""",
    """                    <!-- v37.44 : les soldes RÉELS se saisissent ici (le Budget Structurel règle nom, type, ordre) -->""")
sub('trésorerie : texte', """<p class="text-[10px] text-gray-400 mt-0.5">Pour modifier les soldes, utilisez ⚙️ Budget Structurel.</p>""",
    """<p class="text-[10px] text-gray-500 mt-0.5" data-treso-aide>Saisissez ici le solde réel de chaque compte, tel que sur votre relevé bancaire : c'est le point de départ de toutes les projections. Nom, type et ordre des comptes : ⚙️ Budget Structurel.</p>""")
sub('budget structurel : renvoi', """<p class="text-[9px] text-slate-400 mt-0.5">✏️ Éditable dans Trésorerie</p>""",
    """<button type="button" @click="appMode = 'reel'; activeTab = 'tresorerie'" data-solde-tresorerie class="text-[9px] text-blue-600 hover:underline font-bold mt-0.5" title="Ouvrir la Trésorerie (mode Réalisé)">✏️ Solde réel : « Modifier » ou Trésorerie →</button>""")

# ── 7. Fonds de sécurité : N mois de dépenses ─────────────────────────────────
sub('fonds : paramètres', """<p class="text-xs text-gray-500 mt-2">Cible de liquidité : <span class="font-black text-blue-700">{{ formatMAD(surplusMensuelBase * parametres.objectifFondsSecuriteMois) }}</span></p>""",
    """<p class="text-xs text-gray-500 mt-2" data-fonds-cible>Cible de liquidité : <span class="font-black text-blue-700">{{ formatMAD(cibleFondsSecurite) }}</span>
                                    <span class="text-gray-500"> — {{ parametres.objectifFondsSecuriteMois }} mois × {{ formatMAD(depensesMensuellesBase) }} de dépenses mensuelles</span></p>
                                <p class="text-xs text-gray-500 mt-1" data-fonds-couverture>Liquidités aujourd'hui : <span class="font-black" :class="patrimoineLiquide >= cibleFondsSecurite ? 'text-emerald-700' : 'text-amber-700'">{{ formatMAD(patrimoineLiquide) }}</span>
                                    — {{ cibleFondsSecurite > 0 ? (patrimoineLiquide >= cibleFondsSecurite ? 'objectif atteint' : Math.round(patrimoineLiquide / cibleFondsSecurite * 100) + ' % de l\\'objectif') : 'aucune dépense mensuelle saisie' }}</p>""")
sub('fonds : mobile', """<p class="text-xs font-black text-blue-700 text-right">Cible : {{ formatMAD(surplusMensuelBase * parametres.objectifFondsSecuriteMois) }}</p>""",
    """<p class="text-xs font-black text-blue-700 text-right">Cible : {{ formatMAD(cibleFondsSecurite) }}</p>""")
sub('fonds : calcul', """                    const surplusMensuelBase = computed(() => {""",
    """                    //  v37.44 : le fonds de sécurité = N mois de DÉPENSES (charges fixes + variables) — la base
                    //  du KPI « Fonds de survie ». Il valait N mois de SURPLUS : négatif dès que le surplus l'est.
                    const depensesMensuellesBase = computed(() => Math.max(0, Math.round(totalFixes.value + totalVariables.value)));
                    const cibleFondsSecurite = computed(() => Math.round(depensesMensuellesBase.value * (Number(parametres.value.objectifFondsSecuriteMois) || 0)));
                    const surplusMensuelBase = computed(() => {""")

# ── 8. Patrimoine : la pastille de quote-part ─────────────────────────────────
sub('patrimoine : cellules vides', '<span v-else class="text-gray-300">—</span>', '<span v-else class="text-gray-400" title="Sans objet">—</span>', n=2)
sub('patrimoine : quote-part', """<span :class="['px-1.5 py-0.5 rounded-full border', asset.quotePart === '100%' ? 'bg-gray-50 text-gray-500 border-gray-200' : 'bg-amber-100 text-amber-700 border-amber-300']">{{ asset.quotePart }}</span>""",
    """<span v-if="String(asset.quotePart || '').trim()" data-quote-part title="Quote-part détenue" :class="['px-1.5 py-0.5 rounded-full border', asset.quotePart === '100%' ? 'bg-gray-50 text-gray-500 border-gray-200' : 'bg-amber-100 text-amber-700 border-amber-300']">{{ /%$/.test(String(asset.quotePart).trim()) ? asset.quotePart : String(asset.quotePart).trim() + ' %' }}</span>""")
# Brouillon de projection : l'encart « dérivé du budget » est sous un bandeau
# sombre plus haut (la règle générale ne le voit pas clair), et « extrapolée »
# était en slate-300 (1,5:1). Teintes posées directement.
sub('projection : surplus dérivé', 'text-[8px] font-bold uppercase tracking-widest text-indigo-400">dérivé du budget',
    'text-[8px] font-bold uppercase tracking-widest text-indigo-600">dérivé du budget')
sub('projection : année extrapolée', 'text-[8px] font-black uppercase tracking-widest text-slate-300">extrapolée',
    'text-[8px] font-black uppercase tracking-widest text-slate-500">extrapolée')

# ── 9. Boutons-icônes : un nom tiré de leur action ────────────────────────────
def nom_bouton(m):
    attrs, icone = m.group(1), m.group(2)
    if icone == '↑': nom = 'Monter'
    elif icone == '↓': nom = 'Descendre'
    elif re.search(r'supprimer|delete|remove|splice', attrs, re.I): nom = 'Supprimer'
    elif re.search(r'annuler|cancel', attrs, re.I): nom = 'Annuler'
    else: nom = 'Fermer'
    return f'<button title="{nom}" aria-label="{nom}" {attrs}>{icone}</button>'
motif = re.compile(r'<button (?![^>\n]*\btitle=)([^>\n]*)>(✕|×|&times;|↑|↓)</button>')
src, n_boutons = motif.subn(nom_bouton, src)
if n_boutons != 41: print(f"✖ boutons-icônes : {n_boutons} trouvés, 41 attendus"); sys.exit(1)
sub('flèches de rangement : contraste', 'class="text-[10px] text-gray-300 hover:text-blue-600 disabled:opacity-20 leading-tight font-black"',
    'class="text-[10px] text-gray-400 hover:text-blue-600 disabled:opacity-20 leading-tight font-black"', n=2)

# ── 10. Synthèse Réel : l'année mois par mois ─────────────────────────────────
sub('contrôle : un mois en fonction', """                    const controleBudgetVsReel = computed(() => {
                        const a = anneeAffichage.value;
                        const m = moisControle.value;
                        const d = donneesAnnuelles.value[a];""",
    """                    //  v37.44 : le calcul d'UN mois, partagé par le Contrôle et la Synthèse de l'année
                    const _lignesControle = (a, m) => {
                        const d = donneesAnnuelles.value[a];""")
sub('contrôle : fin du calcul', """                            .sort((a, b) => b.budget - a.budget);
                    });

                    const controleTotaux = computed(() => {""",
    """                            .sort((a, b) => b.budget - a.budget);
                    };
                    const controleBudgetVsReel = computed(() => _lignesControle(anneeAffichage.value, moisControle.value));

                    //  v37.44 — SYNTHÈSE RÉELLE : l'année mois par mois, avec les MÊMES chiffres que le
                    //  Contrôle Budget vs Réel (même calcul, mois après mois). Les mois à venir sont
                    //  montés pour mémoire ; les cumuls ne comptent que les mois écoulés et le mois en cours.
                    const syntheseAnnee = computed(() => {
                        calculationTick.value;
                        const a = Number(anneeAffichage.value), auj = new Date();
                        const courant = a === auj.getFullYear() ? auj.getMonth() + 1 : (a < auj.getFullYear() ? 13 : 0);
                        const mois = Array.from({ length: 12 }, (_, i) => {
                            const m = i + 1, l = _lignesControle(a, m);
                            const budget = l.reduce((s, x) => s + x.budget, 0), realise = l.reduce((s, x) => s + x.realise, 0);
                            return { m, nom: nomDuMois(m), budget, realise, ecart: budget - realise,
                                     pct: budget > 0 ? Math.round(realise / budget * 100) : (realise > 0 ? 999 : 0),
                                     etat: m < courant ? 'passe' : (m === courant ? 'courant' : 'avenir') };
                        });
                        const vus = mois.filter(x => x.etat !== 'avenir');
                        const somme = (arr, k) => arr.reduce((s, x) => s + x[k], 0);
                        return { mois, cumul: { budget: somme(vus, 'budget'), realise: somme(vus, 'realise'), ecart: somme(vus, 'ecart'), nb: vus.length },
                                 annee: { budget: somme(mois, 'budget') }, depassements: vus.filter(x => x.budget > 0 && x.realise > x.budget).length };
                    });
                    const ouvrirControleMois = (m) => { moisControle.value = m; activeTab.value = 'controle'; };

                    const controleTotaux = computed(() => {""")
sub('synthèse : exposée', """                        moisControle, controleBudgetVsReel, controleTotaux,""",
    """                        moisControle, controleBudgetVsReel, controleTotaux, syntheseAnnee, ouvrirControleMois,
                        cibleFondsSecurite, depensesMensuellesBase,""")
sub('synthèse : page', """                <!-- ─── Onglet SYNTHÈSE (placeholder P5) ─── -->
                <div v-if="activeTab === 'syntheseReel'" class="max-w-4xl mx-auto space-y-4 md:space-y-6">
                    <h2 class="text-xl md:text-2xl font-bold text-gray-800 border-b pb-4">📈 Synthèse Réelle</h2>
                    <div class="p-8 md:p-12 text-center text-slate-400 italic border-2 border-dashed border-slate-300 rounded-2xl bg-white text-sm">En construction — Phase 5.</div>
                </div>""",
    """                <!-- ─── Onglet SYNTHÈSE — v37.44 : l'année mois par mois (les chiffres du Contrôle) ─── -->
                <div v-if="activeTab === 'syntheseReel'" class="max-w-5xl mx-auto space-y-4 md:space-y-6" data-synthese>
                    <div class="border-b pb-4">
                        <h2 class="text-xl md:text-2xl font-bold text-gray-800">📈 Synthèse Réelle — {{ anneeAffichage }}</h2>
                        <p class="text-xs text-gray-500 mt-1">Le budget prévu face au réalisé, mois par mois — les mêmes chiffres que 🔍 Contrôle Budget vs Réel. Cliquez un mois pour son détail par catégorie.</p>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                        <div class="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 md:p-5">
                            <p class="text-[10px] font-black uppercase tracking-widest text-blue-700 mb-2">📋 Prévu — {{ syntheseAnnee.cumul.nb }} mois</p>
                            <p class="text-xl md:text-2xl font-black text-blue-900 tabular-nums" data-synthese-prevu>{{ formatMAD(syntheseAnnee.cumul.budget) }}</p>
                            <p class="text-[10px] text-blue-700 mt-1">Année entière : {{ formatMAD(syntheseAnnee.annee.budget) }}</p>
                        </div>
                        <div class="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 md:p-5">
                            <p class="text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-2">✓ Réalisé</p>
                            <p class="text-xl md:text-2xl font-black text-emerald-900 tabular-nums" data-synthese-realise>{{ formatMAD(syntheseAnnee.cumul.realise) }}</p>
                            <p class="text-[10px] text-emerald-700 mt-1">{{ syntheseAnnee.depassements ? syntheseAnnee.depassements + ' mois au-dessus du budget' : 'Aucun mois au-dessus du budget' }}</p>
                        </div>
                        <div :class="syntheseAnnee.cumul.ecart >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-300'" class="border-2 rounded-2xl p-4 md:p-5">
                            <p :class="syntheseAnnee.cumul.ecart >= 0 ? 'text-emerald-700' : 'text-red-700'" class="text-[10px] font-black uppercase tracking-widest mb-2">📊 Écart cumulé</p>
                            <p :class="syntheseAnnee.cumul.ecart >= 0 ? 'text-emerald-900' : 'text-red-900'" class="text-xl md:text-2xl font-black tabular-nums" data-synthese-ecart>{{ syntheseAnnee.cumul.ecart >= 0 ? '+' : '' }}{{ formatMAD(syntheseAnnee.cumul.ecart) }}</p>
                            <p :class="syntheseAnnee.cumul.ecart >= 0 ? 'text-emerald-700' : 'text-red-700'" class="text-[10px] mt-1">{{ syntheseAnnee.cumul.ecart >= 0 ? 'sous le budget prévu' : 'au-dessus du budget prévu' }}</p>
                        </div>
                    </div>
                    <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <div class="px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 bg-slate-50">
                            <h3 class="font-black uppercase tracking-widest text-gray-700 text-xs md:text-sm">📅 Mois par mois — {{ anneeAffichage }}</h3>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-sm min-w-[640px]">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="p-2 md:p-3 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Mois</th>
                                        <th class="p-2 md:p-3 text-right font-black text-[10px] uppercase tracking-widest text-blue-600">Prévu</th>
                                        <th class="p-2 md:p-3 text-right font-black text-[10px] uppercase tracking-widest text-emerald-600">Réalisé</th>
                                        <th class="p-2 md:p-3 text-right font-black text-[10px] uppercase tracking-widest text-gray-500">Écart</th>
                                        <th class="p-2 md:p-3 text-center font-black text-[10px] uppercase tracking-widest text-gray-500 w-56 md:w-64">Consommé</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="x in syntheseAnnee.mois" :key="x.m" :data-synthese-mois="x.m" :data-etat="x.etat" @click="ouvrirControleMois(x.m)"
                                        :title="'Ouvrir le détail de ' + x.nom" class="border-b border-gray-100 cursor-pointer transition-colors"
                                        :class="x.etat === 'courant' ? 'bg-emerald-50/70 hover:bg-emerald-100/70' : (x.etat === 'avenir' ? 'text-gray-500 hover:bg-gray-50' : 'hover:bg-gray-50')">
                                        <td class="p-2 md:p-3 font-bold text-gray-800 text-xs md:text-sm whitespace-nowrap">{{ x.nom }}
                                            <span v-if="x.etat === 'courant'" class="ml-1.5 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-emerald-600 text-white">en cours</span>
                                            <span v-else-if="x.etat === 'avenir'" class="ml-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-500">à venir</span>
                                        </td>
                                        <td class="p-2 md:p-3 text-right font-black text-blue-700 tabular-nums whitespace-nowrap text-xs md:text-sm">{{ formatMAD(x.budget) }}</td>
                                        <td class="p-2 md:p-3 text-right font-black text-emerald-700 tabular-nums whitespace-nowrap text-xs md:text-sm">{{ x.etat === 'avenir' && !x.realise ? '—' : formatMAD(x.realise) }}</td>
                                        <td class="p-2 md:p-3 text-right font-black tabular-nums whitespace-nowrap text-xs md:text-sm" :class="x.etat === 'avenir' ? 'text-gray-400' : (x.ecart >= 0 ? 'text-emerald-600' : 'text-red-600')">{{ x.etat === 'avenir' ? '—' : (x.ecart >= 0 ? '+' : '') + formatMAD(x.ecart) }}</td>
                                        <td class="p-2 md:p-3">
                                            <div v-if="x.etat !== 'avenir'" class="flex items-center gap-2">
                                                <div class="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div :class="x.pct > 100 ? 'bg-red-500' : (x.pct > 80 ? 'bg-orange-400' : 'bg-emerald-500')" class="h-full rounded-full transition-all" :style="{ width: Math.min(100, x.pct) + '%' }"></div>
                                                </div>
                                                <span class="text-[10px] font-black w-10 md:w-12 text-right" :class="x.pct > 100 ? 'text-red-600' : 'text-gray-600'">{{ x.pct }}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>""")

io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ index.html : interface de bureau corrigée ({n_boutons} boutons-icônes nommés)')
