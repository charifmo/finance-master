#!/usr/bin/env python3
"""Santé 1.2 + Finance v37.101 — UN SEUL SYSTÈME : Santé prend l'habillage de Finance (menu vertical sombre à gauche,
   barre du haut blanche, mêmes boutons), une rangée d'applis en haut du menu de chaque appli (lanceur.js,
   [data-lanceur-barre]), et Santé se met à jour seule quand une nouvelle version est publiée."""
import io, sys

def patch(F, reps):
    src = io.open(F, encoding='utf-8').read()
    for label, old, new in reps:
        c = src.count(old)
        if c != 1: print(f'✖ {F} · {label} : {c} ancre(s), 1 attendue'); sys.exit(1)
        src = src.replace(old, new)
    io.open(F, 'w', encoding='utf-8').write(src)
    print('✔', F)

ANCIEN_ENTETE = """<div id="app" v-cloak class="min-h-screen">

    <!-- En-tête -->
    <header class="bg-gradient-to-r from-emerald-700 to-teal-600 text-white">
        <div class="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
            <div class="flex-1 min-w-[200px]">
                <h1 class="text-xl font-black tracking-tight">🩺 Santé Master <span class="text-xs font-bold opacity-80">v{{ VERSION }}</span></h1>
                <p class="text-xs opacity-90" data-profil-resume>{{ resumeProfil }}</p>
            </div>
            <button type="button" data-lanceur class="text-xs font-black px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25">🧩 Mes applis</button>
            <label class="text-xs font-bold flex items-center gap-2">📅 Jour
                <input type="date" v-model="dateJour" data-date-jour class="text-slate-800 rounded-lg px-2 py-1 text-sm font-bold">
            </label>
            <span data-statut-sauvegarde class="text-xs font-bold px-2 py-1 rounded-full" :class="statut === 'conflit' ? 'bg-rose-500' : statut === 'modifié' ? 'bg-amber-500' : 'bg-white/20'">{{ libelleStatut }}</span>
        </div>
        <nav class="max-w-6xl mx-auto px-2 flex gap-1 overflow-x-auto">
            <button v-for="o in ONGLETS" :key="o.id" type="button" :data-onglet="o.id" @click="onglet = o.id"
                    class="px-3 py-2 text-sm font-bold rounded-t-xl whitespace-nowrap" :class="onglet === o.id ? 'bg-slate-50 text-emerald-800' : 'text-white/90 hover:bg-white/10'">{{ o.libelle }}</button>
        </nav>
    </header>

    <main class="max-w-6xl mx-auto px-4 py-5 space-y-5">"""

NOUVEL_ENTETE = """<div id="app" v-cloak class="h-screen flex overflow-hidden bg-slate-50">

    <!-- Le menu, comme dans Finance : barre verticale sombre à gauche (un tiroir sur le téléphone) -->
    <div v-if="menuOuvert" class="md:hidden fixed inset-0 z-40 bg-slate-900/60" @click="menuOuvert = false"></div>
    <aside data-barre-sante :class="['fixed md:static inset-y-0 left-0 z-50 w-64 shrink-0 bg-slate-900 text-white flex flex-col shadow-2xl border-r border-slate-800 transition-transform duration-300', menuOuvert ? 'translate-x-0' : '-translate-x-full md:translate-x-0']">
        <div class="shrink-0 border-b border-slate-800 bg-slate-950/40 px-3 pt-3 pb-2.5">
            <div class="flex items-center gap-2">
                <span class="text-2xl shrink-0">🩺</span>
                <h1 class="flex-1 min-w-0 text-lg font-black text-emerald-400 italic uppercase tracking-tighter truncate">Santé Master</h1>
                <button type="button" class="md:hidden w-8 h-7 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-300 text-sm font-black" aria-label="Fermer le menu" @click="menuOuvert = false">✕</button>
            </div>
            <div class="mt-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest bg-emerald-600/30 text-emerald-200 px-2 py-1 rounded border border-emerald-500/30" data-version>v{{ VERSION }}</div>
            <p class="mt-1.5 text-[11px] font-semibold text-slate-400 truncate" data-profil-resume>{{ resumeProfil }}</p>
        </div>
        <div class="shrink-0 border-b border-slate-800 bg-slate-950/40 px-3 py-2 flex items-center gap-2">
            <span class="text-[9px] font-black uppercase tracking-widest text-slate-500 shrink-0">Mes applis</span>
            <div data-lanceur-barre class="ml-auto"></div>
        </div>
        <nav aria-label="Onglets" class="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-1.5">
            <button v-for="o in ONGLETS" :key="o.id" type="button" :data-onglet="o.id" @click="onglet = o.id; menuOuvert = false"
                    :class="['w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg text-sm font-bold transition-colors', onglet === o.id ? 'bg-emerald-600 shadow-lg shadow-emerald-900/50' : 'hover:bg-slate-800 text-slate-300']"><span class="text-base leading-none shrink-0">{{ o.icone }}</span><span class="leading-tight">{{ o.nom }}</span></button>
        </nav>
        <div class="shrink-0 border-t border-slate-800 bg-slate-950/60 p-3 space-y-2">
            <button type="button" data-lanceur class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold bg-sky-400/15 text-sky-200 hover:bg-sky-400/25"><span class="text-base leading-none">🧩</span><span>Mes applis</span></button>
        </div>
    </aside>

    <div class="flex-1 min-w-0 flex flex-col">
        <!-- La barre du haut, comme dans Finance -->
        <header class="shrink-0 bg-white border-b border-slate-200 px-3 md:px-6 py-2.5 flex flex-wrap items-center gap-3">
            <button type="button" data-menu-sante class="md:hidden w-9 h-9 rounded-lg bg-slate-900 text-white font-black" aria-label="Ouvrir le menu" @click="menuOuvert = true">☰</button>
            <p class="flex-1 min-w-0 text-sm font-black uppercase tracking-[0.08em] md:tracking-[0.2em] text-emerald-700 truncate" data-titre-onglet>{{ (ONGLETS.find(o => o.id === onglet) || {}).icone }} {{ (ONGLETS.find(o => o.id === onglet) || {}).nom }}</p>
            <div class="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-3">
            <label class="text-[11px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2"><span class="hidden sm:inline">Jour</span>
                <input type="date" v-model="dateJour" data-date-jour class="text-slate-800 rounded-lg px-2 py-1.5 text-sm font-bold border border-slate-200 bg-slate-50">
            </label>
            <span data-statut-sauvegarde class="text-xs font-bold px-2.5 py-1 rounded-full" :class="statut === 'conflit' ? 'bg-rose-500 text-white' : statut === 'modifié' ? 'bg-amber-100 text-amber-800' : statut === 'erreur' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-50 text-emerald-700'">{{ libelleStatut }}</span>
            </div>
        </header>

    <main class="flex-1 overflow-y-auto">
    <div class="max-w-6xl mx-auto px-4 py-5 space-y-5">"""

patch('sante/index.html', [
    ('en-tête → menu vertical', ANCIEN_ENTETE, NOUVEL_ENTETE),
    ('fin du contenu', """        </section>
    </main>
</div>

<script>""", """        </section>
    </div>
    </main>
    </div>
</div>

<script>"""),
    ('version', "const VERSION = '1.1';", "const VERSION = '1.2';"),
    ('onglets : icône + nom', """            { id: 'pilotage', libelle: '🎯 Pilotage' }, { id: 'analyses', libelle: '🩸 Analyses' }, { id: 'nutrition', libelle: '🥗 Nutrition' },
            { id: 'poids', libelle: '📱 Samsung & Poids' }, { id: 'cmo', libelle: '🧠 Médecin-Chef IA' },
        ];""",
     """            { id: 'pilotage', icone: '🎯', nom: 'Pilotage' }, { id: 'analyses', icone: '🩸', nom: 'Analyses' }, { id: 'nutrition', icone: '🥗', nom: 'Nutrition' },
            { id: 'poids', icone: '📱', nom: 'Samsung & Poids' }, { id: 'cmo', icone: '🧠', nom: 'Médecin-Chef IA' },
        ].map(o => ({ ...o, libelle: o.icone + ' ' + o.nom }));"""),
    ('menu ouvert + mise à jour auto', "        onMounted(charger);", """        const menuOuvert = ref(false);
        //  Une nouvelle version publiée : la page se recharge seule (une fois par version), comme Finance
        const verifierVersion = async () => {
            try {
                const r = await fetch(location.pathname + '?version=' + Date.now(), { cache: 'no-store' });
                const m = r.ok ? /const VERSION = '([^']+)'/.exec(await r.text()) : null;
                if (!m || m[1] === VERSION) return;
                let deja = false; try { deja = sessionStorage.getItem('sante_maj_' + m[1]) === '1'; sessionStorage.setItem('sante_maj_' + m[1], '1'); } catch (e) { /* navigation privée */ }
                if (!deja && statut.value !== 'modifié') location.replace(location.pathname + '?v=' + encodeURIComponent(m[1]));
            } catch (e) { /* hors ligne */ }
        };
        onMounted(charger);
        onMounted(() => { setTimeout(verifierVersion, 2500); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') verifierVersion(); }); });"""),
    ('exports', "return { VERSION, ONGLETS, CHECKLIST,", "return { VERSION, ONGLETS, menuOuvert, CHECKLIST,"),
])

# Finance : la rangée d'applis en haut du menu (sur une ligne) ; le bouton « Mes applis » seulement menu replié
patch('index.html', [
    ('menu : bouton Mes applis replié seulement', """                    <button type="button" data-lanceur :title="isSidebarCollapsed ? 'Mes applis' : null" """, """                    <button v-if="isSidebarCollapsed" type="button" data-lanceur title="Mes applis" """),
    ('menu : rangée d\'applis', """                <!-- ═══ v22.00 P2 — MASTER SWITCH DUAL-MODE ═══ -->""", """                <!-- v37.101 : un seul système — la rangée de vos applis, la même dans chaque appli -->
                <div v-if="!isSidebarCollapsed" class="shrink-0 border-b border-slate-800 bg-slate-950/40 px-3 py-2 flex items-center gap-2">
                    <span class="text-[9px] font-black uppercase tracking-widest text-slate-500 shrink-0">Mes applis</span>
                    <div data-lanceur-barre class="ml-auto"></div>
                </div>
                <!-- ═══ v22.00 P2 — MASTER SWITCH DUAL-MODE ═══ -->"""),
])
