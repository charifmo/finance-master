#!/usr/bin/env python3
"""v37.99 — « 🧩 MES APPLIS » : passer de Finance à Santé (puis Psy, Voyage…) d'un toucher.
   lanceur.js + apps.json (une ligne par appli) + accueil.html ; un bouton dans chaque appli."""
import io, sys

def patch(F, reps):
    src = io.open(F, encoding='utf-8').read()
    for label, old, new in reps:
        c = src.count(old)
        if c != 1: print(f'✖ {F} · {label} : {c} ancre(s), 1 attendue'); sys.exit(1)
        src = src.replace(old, new)
    io.open(F, 'w', encoding='utf-8').write(src)
    print('✔', F)

CHARGEUR = """<script>/* v37.99 : le lanceur des applis — exécuté seulement s'il est servi comme un vrai script */
fetch('{url}', {{ cache: 'no-cache' }}).then(function (r) {{ return r.ok && /javascript/i.test(r.headers.get('content-type') || '') ? r.text() : null; }})
    .then(function (t) {{ if (!t) return; var s = document.createElement('script'); s.dataset.base = '{base}'; s.textContent = t; document.head.appendChild(s); }}).catch(function () {{}});</script>
</body>"""

BTN_NAV = """<span v-if="!isSidebarCollapsed" class="leading-tight">Aujourd’hui</span></button>
                    <button type="button" data-lanceur :title="isSidebarCollapsed ? 'Mes applis' : null" :class="['w-full flex items-center rounded-lg text-sm font-bold bg-sky-400/15 text-sky-200 hover:bg-sky-400/25', isSidebarCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5 text-left']"><span class="text-base leading-none shrink-0">🧩</span><span v-if="!isSidebarCollapsed" class="leading-tight">Mes applis</span></button>"""

patch('index.html', [
    ('chargeur', '</body>\n</html>', CHARGEUR.format(url='lanceur.js', base='./') + '\n</html>'),
    ('menu : Mes applis', '<span v-if="!isSidebarCollapsed" class="leading-tight">Aujourd’hui</span></button>', BTN_NAV),
    ('mobile : Mes applis', """mt-0.5">☀️ Aujourd’hui</button>""", """mt-0.5">☀️ Aujourd’hui</button>
                        <button type="button" data-lanceur class="ml-2 text-[8px] font-black uppercase tracking-widest text-sky-600 hover:text-sky-700 mt-0.5">🧩 Mes applis</button>"""),
    ('Aujourd\'hui : Mes applis', """                    <button type="button" data-mode-expert""", """                    <button type="button" data-lanceur class="text-[11px] font-black px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 shadow-sm">🧩 Applis</button>
                    <button type="button" data-mode-expert"""),
])
patch('sante/index.html', [
    ('chargeur', '</body>\n</html>', CHARGEUR.format(url='../lanceur.js', base='../') + '\n</html>'),
    ('en-tête : Mes applis', """            <label class="text-xs font-bold flex items-center gap-2">📅 Jour""", """            <button type="button" data-lanceur class="text-xs font-black px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25">🧩 Mes applis</button>
            <label class="text-xs font-bold flex items-center gap-2">📅 Jour"""),
    ('version', "const VERSION = '1.0';", "const VERSION = '1.1';"),
])
