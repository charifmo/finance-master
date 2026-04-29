#!/usr/bin/env python3
# patch_v13_22.py — Finance App v13.22 : Collapsible Cards
# Adds collapse/expand toggle to all major dashboard & parametres cards
# with localStorage persistence and chevron icon

import sys

SRC  = "D:/Users/mohamed_benabad/finance-master/index.html"
DEST = "D:/Users/mohamed_benabad/finance-master/index.html"

with open(SRC, "r", encoding="utf-8") as f:
    html = f.read()

changes = []

# ═══════════════════════════════════════════════════════════════════════
# 1. CSS — append to <style> block
# ═══════════════════════════════════════════════════════════════════════
OLD_CSS_END = "        .cfo-html th, .cfo-html td { border: 1px solid #e5e7eb; padding: 3px 8px; font-size: 0.85em; }\n    </style>"
NEW_CSS_END = """        .cfo-html th, .cfo-html td { border: 1px solid #e5e7eb; padding: 3px 8px; font-size: 0.85em; }
        /* === v13.22 Collapsible Cards === */
        .cfo-collapsible-body { }
        .cfo-card-collapsed > .cfo-collapsible-body { display: none !important; }
        .cfo-collapse-header { cursor: pointer; user-select: none; transition: opacity 0.15s; }
        .cfo-collapse-header:hover { opacity: 0.82; }
        .cfo-chevron { transition: transform 0.2s ease; display: inline-block; font-style: normal; }
        .cfo-card-collapsed .cfo-chevron { transform: rotate(-90deg); }
        /* Section wrappers for dashboard groups */
        .cfo-section-wrap { margin-bottom: 0; }
        .cfo-section-header { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; border-radius: 8px; margin-bottom: 8px; }
        .cfo-section-header:hover { background: rgba(0,0,0,0.04); }
    </style>"""
assert OLD_CSS_END in html, "CSS anchor not found"
html = html.replace(OLD_CSS_END, NEW_CSS_END, 1)
changes.append("CSS rules added")

# ═══════════════════════════════════════════════════════════════════════
# 2. Dashboard — KPIs 4-card grid: wrap with collapsible section
# ═══════════════════════════════════════════════════════════════════════
OLD_DASH_KPI = '                    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">'
NEW_DASH_KPI = '''                    <div data-cfo-collapse="dash-kpis" class="cfo-section-wrap">
                        <div class="cfo-section-header cfo-collapse-header">
                            <span class="text-[10px] font-black uppercase tracking-widest text-gray-400">📊 Indicateurs Clés de Performance</span>
                            <span class="cfo-chevron text-gray-400 text-xs">▼</span>
                        </div>
                        <div class="cfo-collapsible-body">
                    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">'''
assert OLD_DASH_KPI in html, "Dash KPI grid anchor not found"
html = html.replace(OLD_DASH_KPI, NEW_DASH_KPI, 1)
changes.append("Dashboard KPIs collapsible added")

# Close after the KPI grid closing </div> — find first occurrence after the grid open
# The KPI grid is followed immediately by the charts grid
OLD_DASH_KPI_END = '''                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">'''
NEW_DASH_KPI_END = '''                    </div>
                        </div><!-- /cfo-collapsible-body kpi -->
                    </div><!-- /dash-kpis -->

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">'''
assert OLD_DASH_KPI_END in html, "Dash KPI grid close anchor not found"
html = html.replace(OLD_DASH_KPI_END, NEW_DASH_KPI_END, 1)
changes.append("Dashboard KPIs collapsible closed")

# ═══════════════════════════════════════════════════════════════════════
# 3. Dashboard — 2-chart grid: wrap with collapsible section
# ═══════════════════════════════════════════════════════════════════════
OLD_DASH_CHARTS = '                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">'
NEW_DASH_CHARTS = '''                    <div data-cfo-collapse="dash-charts" class="cfo-section-wrap">
                        <div class="cfo-section-header cfo-collapse-header">
                            <span class="text-[10px] font-black uppercase tracking-widest text-gray-400">📈 Graphiques de Répartition</span>
                            <span class="cfo-chevron text-gray-400 text-xs">▼</span>
                        </div>
                        <div class="cfo-collapsible-body">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">'''
assert OLD_DASH_CHARTS in html, "Dash charts grid anchor not found"
html = html.replace(OLD_DASH_CHARTS, NEW_DASH_CHARTS, 1)
changes.append("Dashboard Charts collapsible added")

# Close charts section: ends before the evolution grid
OLD_DASH_CHARTS_END = '''                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">'''
NEW_DASH_CHARTS_END = '''                    </div>
                        </div><!-- /cfo-collapsible-body charts -->
                    </div><!-- /dash-charts -->

                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">'''
assert OLD_DASH_CHARTS_END in html, "Dash charts grid close anchor not found"
html = html.replace(OLD_DASH_CHARTS_END, NEW_DASH_CHARTS_END, 1)
changes.append("Dashboard Charts collapsible closed")

# ═══════════════════════════════════════════════════════════════════════
# 4. Dashboard — Evolution+Audit grid: wrap with collapsible section
# ═══════════════════════════════════════════════════════════════════════
OLD_DASH_EVO = '                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">'
NEW_DASH_EVO = '''                    <div data-cfo-collapse="dash-evolution" class="cfo-section-wrap">
                        <div class="cfo-section-header cfo-collapse-header">
                            <span class="text-[10px] font-black uppercase tracking-widest text-gray-400">📉 Évolution Pluriannuelle & Audit Détaillé</span>
                            <span class="cfo-chevron text-gray-400 text-xs">▼</span>
                        </div>
                        <div class="cfo-collapsible-body">
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">'''
assert OLD_DASH_EVO in html, "Dash evolution grid anchor not found"
html = html.replace(OLD_DASH_EVO, NEW_DASH_EVO, 1)
changes.append("Dashboard Evolution collapsible added")

# Close evo section: ends before the simulation table
OLD_DASH_EVO_END = '''                    </div>

                    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-8">'''
NEW_DASH_EVO_END = '''                    </div>
                        </div><!-- /cfo-collapsible-body evolution -->
                    </div><!-- /dash-evolution -->

                    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-8">'''
assert OLD_DASH_EVO_END in html, "Dash evolution grid close anchor not found"
html = html.replace(OLD_DASH_EVO_END, NEW_DASH_EVO_END, 1)
changes.append("Dashboard Evolution collapsible closed")

# ═══════════════════════════════════════════════════════════════════════
# 5. Dashboard — Simulation Table: make existing header clickable
# ═══════════════════════════════════════════════════════════════════════
OLD_SIM_WRAP  = '                    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-8">'
NEW_SIM_WRAP  = '                    <div data-cfo-collapse="dash-simulation" class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-8">'
assert OLD_SIM_WRAP in html, "Simulation table wrapper anchor not found"
html = html.replace(OLD_SIM_WRAP, NEW_SIM_WRAP, 1)
changes.append("Simulation table data-cfo-collapse added")

OLD_SIM_HEADER = '                        <div class="px-6 py-4 bg-gray-100 font-bold text-gray-800 flex justify-between items-center">\n                            <span>Simulation du Cash Global Pluriannuelle</span>\n                            <span class="text-[9px] bg-slate-800 text-white px-2 py-1 rounded uppercase tracking-widest">Time Engine</span>\n                        </div>\n                        <div class="overflow-x-auto max-h-[600px] custom-scroll">'
NEW_SIM_HEADER = '''                        <div class="cfo-collapse-header px-6 py-4 bg-gray-100 font-bold text-gray-800 flex justify-between items-center">
                            <span>Simulation du Cash Global Pluriannuelle</span>
                            <div class="flex items-center gap-3">
                                <span class="text-[9px] bg-slate-800 text-white px-2 py-1 rounded uppercase tracking-widest">Time Engine</span>
                                <span class="cfo-chevron text-gray-500 text-sm">▼</span>
                            </div>
                        </div>
                        <div class="cfo-collapsible-body">
                        <div class="overflow-x-auto max-h-[600px] custom-scroll">'''
assert OLD_SIM_HEADER in html, "Simulation table header anchor not found"
html = html.replace(OLD_SIM_HEADER, NEW_SIM_HEADER, 1)
changes.append("Simulation table header made collapsible")

# Close simulation body — find the closing div of the simulation section
# The simulation table ends with the table closing and then the outer div closes
# We need to close the cfo-collapsible-body before the outer dash-simulation div closes
# The simulation table section is closed by matching </div> after the table
# Identify by searching for the unique pattern at the end of the simulation table
OLD_SIM_END = '                            </table>\n                        </div>\n                    </div>\n                </div>'
NEW_SIM_END = '                            </table>\n                        </div>\n                        </div><!-- /cfo-collapsible-body simulation -->\n                    </div><!-- /dash-simulation -->\n                </div>'
assert OLD_SIM_END in html, "Simulation table close anchor not found"
html = html.replace(OLD_SIM_END, NEW_SIM_END, 1)
changes.append("Simulation table collapsible closed")

# ═══════════════════════════════════════════════════════════════════════
# 6. Parametres — PILOTAGE DU MOIS COURANT
# ═══════════════════════════════════════════════════════════════════════
OLD_PILOTAGE_DIV = '                    <div v-if="anneeAffichage === soldesInitiaux.anneeActuelle" class="bg-white p-8 rounded-[2.5rem] border-t-8 border-blue-500 shadow-sm relative text-center">'
NEW_PILOTAGE_DIV = '                    <div v-if="anneeAffichage === soldesInitiaux.anneeActuelle" data-cfo-collapse="param-pilotage" class="bg-white p-8 rounded-[2.5rem] border-t-8 border-blue-500 shadow-sm relative">'
assert OLD_PILOTAGE_DIV in html, "PILOTAGE outer div anchor not found"
html = html.replace(OLD_PILOTAGE_DIV, NEW_PILOTAGE_DIV, 1)
changes.append("PILOTAGE outer div updated")

OLD_PILOTAGE_H3 = '                        <h3 class="font-black text-blue-900 text-xl mb-8 uppercase tracking-tighter flex items-center justify-center gap-3">⚙️ PILOTAGE DU MOIS COURANT ({{nomDuMois(soldesInitiaux.moisActuel)}})</h3>'
NEW_PILOTAGE_H3 = '''                        <h3 class="cfo-collapse-header font-black text-blue-900 text-xl mb-0 pb-6 uppercase tracking-tighter flex items-center justify-between gap-3">
                            <span class="flex-1 text-center">⚙️ PILOTAGE DU MOIS COURANT ({{nomDuMois(soldesInitiaux.moisActuel)}})</span>
                            <span class="cfo-chevron text-sm text-gray-400 shrink-0">▼</span>
                        </h3>
                        <div class="cfo-collapsible-body pt-4">'''
assert OLD_PILOTAGE_H3 in html, "PILOTAGE h3 anchor not found"
html = html.replace(OLD_PILOTAGE_H3, NEW_PILOTAGE_H3, 1)
changes.append("PILOTAGE h3 made collapsible header")

# Close PILOTAGE body before the outer </div>
# The PILOTAGE block ends right before the yellow note about "pilotage actif que pour l'année en cours"
# Actually we need to close before the </div> that closes the PILOTAGE card
OLD_PILOTAGE_END = '''                    </div>

                    <div class="bg-white p-8 rounded-2xl border-t-8 border-green-500 shadow-sm">'''
NEW_PILOTAGE_END = '''                        </div><!-- /cfo-collapsible-body pilotage -->
                    </div><!-- /param-pilotage -->

                    <div class="bg-white p-8 rounded-2xl border-t-8 border-green-500 shadow-sm">'''
assert OLD_PILOTAGE_END in html, "PILOTAGE close anchor not found"
html = html.replace(OLD_PILOTAGE_END, NEW_PILOTAGE_END, 1)
changes.append("PILOTAGE collapsible body closed")

# ═══════════════════════════════════════════════════════════════════════
# 7. Parametres — 1. REVENUS / ENTRÉES MENSUELLES (border-green)
# ═══════════════════════════════════════════════════════════════════════
OLD_REV_DIV = '                    <div class="bg-white p-8 rounded-2xl border-t-8 border-green-500 shadow-sm">'
NEW_REV_DIV = '                    <div data-cfo-collapse="param-revenus" class="bg-white p-8 rounded-2xl border-t-8 border-green-500 shadow-sm">'
assert OLD_REV_DIV in html, "REVENUS outer div anchor not found"
html = html.replace(OLD_REV_DIV, NEW_REV_DIV, 1)
changes.append("REVENUS outer div updated")

OLD_REV_H3 = '                        <h3 class="font-black text-green-900 text-xl mb-6 flex justify-between items-center uppercase italic">ENTRÉES MENSUELLES ({{anneeAffichage}}) <span class="text-sm font-normal text-gray-400 font-mono">{{formatMAD(totalRevenusBase)}}</span></h3>'
NEW_REV_H3 = '''                        <h3 class="cfo-collapse-header font-black text-green-900 text-xl mb-6 flex justify-between items-center uppercase italic">
                            ENTRÉES MENSUELLES ({{anneeAffichage}})
                            <div class="flex items-center gap-2"><span class="cfo-chevron text-xs text-gray-400">▼</span><span class="text-sm font-normal text-gray-400 font-mono">{{formatMAD(totalRevenusBase)}}</span></div>
                        </h3>
                        <div class="cfo-collapsible-body">'''
assert OLD_REV_H3 in html, "REVENUS h3 anchor not found"
html = html.replace(OLD_REV_H3, NEW_REV_H3, 1)
changes.append("REVENUS h3 made collapsible header")

# Close REVENUS body before the closing </div> of the card
# Identified by: the REVENUS card closes just before the CHARGES FIXES card
OLD_REV_END = '''                    </div>

                    <div class="bg-white p-8 rounded-2xl border-t-8 border-orange-500 shadow-sm">'''
NEW_REV_END = '''                        </div><!-- /cfo-collapsible-body revenus -->
                    </div><!-- /param-revenus -->

                    <div class="bg-white p-8 rounded-2xl border-t-8 border-orange-500 shadow-sm">'''
assert OLD_REV_END in html, "REVENUS close anchor not found"
html = html.replace(OLD_REV_END, NEW_REV_END, 1)
changes.append("REVENUS collapsible body closed")

# ═══════════════════════════════════════════════════════════════════════
# 8. Parametres — 2. CHARGES FIXES (border-orange)
# ═══════════════════════════════════════════════════════════════════════
OLD_CF_DIV = '                    <div class="bg-white p-8 rounded-2xl border-t-8 border-orange-500 shadow-sm">'
NEW_CF_DIV = '                    <div data-cfo-collapse="param-charges-fixes" class="bg-white p-8 rounded-2xl border-t-8 border-orange-500 shadow-sm">'
assert OLD_CF_DIV in html, "CHARGES FIXES outer div anchor not found"
html = html.replace(OLD_CF_DIV, NEW_CF_DIV, 1)
changes.append("CHARGES FIXES outer div updated")

OLD_CF_H3 = '''                        <h3 class="font-black text-orange-900 text-xl mb-6 flex justify-between items-center">
                            2. CHARGES FIXES ({{anneeAffichage}}) <span class="text-sm font-normal text-gray-500 font-mono bg-gray-100 px-3 py-1 rounded-lg">{{ formatMAD(totalFixes) }} / mois</span>
                        </h3>'''
NEW_CF_H3 = '''                        <h3 class="cfo-collapse-header font-black text-orange-900 text-xl mb-6 flex justify-between items-center">
                            2. CHARGES FIXES ({{anneeAffichage}})
                            <div class="flex items-center gap-2"><span class="cfo-chevron text-xs text-gray-400">▼</span><span class="text-sm font-normal text-gray-500 font-mono bg-gray-100 px-3 py-1 rounded-lg">{{ formatMAD(totalFixes) }} / mois</span></div>
                        </h3>
                        <div class="cfo-collapsible-body">'''
assert OLD_CF_H3 in html, "CHARGES FIXES h3 anchor not found"
html = html.replace(OLD_CF_H3, NEW_CF_H3, 1)
changes.append("CHARGES FIXES h3 made collapsible header")

OLD_CF_END = '''                    </div>

                    <div class="bg-white p-8 rounded-2xl border-t-8 border-red-500 shadow-sm">'''
NEW_CF_END = '''                        </div><!-- /cfo-collapsible-body charges-fixes -->
                    </div><!-- /param-charges-fixes -->

                    <div class="bg-white p-8 rounded-2xl border-t-8 border-red-500 shadow-sm">'''
assert OLD_CF_END in html, "CHARGES FIXES close anchor not found"
html = html.replace(OLD_CF_END, NEW_CF_END, 1)
changes.append("CHARGES FIXES collapsible body closed")

# ═══════════════════════════════════════════════════════════════════════
# 9. Parametres — 3. CONSOMMATION VARIABLE (border-red)
# ═══════════════════════════════════════════════════════════════════════
OLD_CV_DIV = '                    <div class="bg-white p-8 rounded-2xl border-t-8 border-red-500 shadow-sm">'
NEW_CV_DIV = '                    <div data-cfo-collapse="param-charges-var" class="bg-white p-8 rounded-2xl border-t-8 border-red-500 shadow-sm">'
assert OLD_CV_DIV in html, "CHARGES VAR outer div anchor not found"
html = html.replace(OLD_CV_DIV, NEW_CV_DIV, 1)
changes.append("CHARGES VARIABLES outer div updated")

OLD_CV_H3 = '''                        <h3 class="font-black text-red-900 text-xl mb-6 flex justify-between items-center">
                            3. CONSOMMATION VARIABLE ({{anneeAffichage}}) <span class="text-sm font-normal text-gray-500 font-mono bg-gray-100 px-3 py-1 rounded-lg">{{ formatMAD(totalVariables) }} / mois</span>
                        </h3>'''
NEW_CV_H3 = '''                        <h3 class="cfo-collapse-header font-black text-red-900 text-xl mb-6 flex justify-between items-center">
                            3. CONSOMMATION VARIABLE ({{anneeAffichage}})
                            <div class="flex items-center gap-2"><span class="cfo-chevron text-xs text-gray-400">▼</span><span class="text-sm font-normal text-gray-500 font-mono bg-gray-100 px-3 py-1 rounded-lg">{{ formatMAD(totalVariables) }} / mois</span></div>
                        </h3>
                        <div class="cfo-collapsible-body">'''
assert OLD_CV_H3 in html, "CHARGES VAR h3 anchor not found"
html = html.replace(OLD_CV_H3, NEW_CV_H3, 1)
changes.append("CHARGES VARIABLES h3 made collapsible header")

OLD_CV_END = '''                    </div>

                    <div class="bg-white p-8 rounded-2xl border-t-8 border-purple-500 shadow-sm">'''
NEW_CV_END = '''                        </div><!-- /cfo-collapsible-body charges-var -->
                    </div><!-- /param-charges-var -->

                    <div class="bg-white p-8 rounded-2xl border-t-8 border-purple-500 shadow-sm">'''
assert OLD_CV_END in html, "CHARGES VAR close anchor not found"
html = html.replace(OLD_CV_END, NEW_CV_END, 1)
changes.append("CHARGES VARIABLES collapsible body closed")

# ═══════════════════════════════════════════════════════════════════════
# 10. Parametres — 4. OBJECTIFS ÉPARGNE (border-purple)
# ═══════════════════════════════════════════════════════════════════════
OLD_EP_DIV = '                    <div class="bg-white p-8 rounded-2xl border-t-8 border-purple-500 shadow-sm">'
NEW_EP_DIV = '                    <div data-cfo-collapse="param-epargne" class="bg-white p-8 rounded-2xl border-t-8 border-purple-500 shadow-sm">'
assert OLD_EP_DIV in html, "EPARGNE outer div anchor not found"
html = html.replace(OLD_EP_DIV, NEW_EP_DIV, 1)
changes.append("EPARGNE outer div updated")

OLD_EP_H3 = '                        <h3 class="font-black text-purple-900 text-xl mb-6">4. OBJECTIFS ÉPARGNE ({{anneeAffichage}})</h3>'
NEW_EP_H3 = '''                        <h3 class="cfo-collapse-header font-black text-purple-900 text-xl mb-6 flex justify-between items-center">
                            4. OBJECTIFS ÉPARGNE ({{anneeAffichage}})
                            <span class="cfo-chevron text-xs text-gray-400">▼</span>
                        </h3>
                        <div class="cfo-collapsible-body">'''
assert OLD_EP_H3 in html, "EPARGNE h3 anchor not found"
html = html.replace(OLD_EP_H3, NEW_EP_H3, 1)
changes.append("EPARGNE h3 made collapsible header")

# Close EPARGNE body before the </div> that closes the epargne card
# The epargne card is the last in parametres, so it closes before </div></div>
OLD_EP_END = '''                    </div>
                </div>

                <div v-if="activeTab === 'irregulieres'"'''
NEW_EP_END = '''                        </div><!-- /cfo-collapsible-body epargne -->
                    </div><!-- /param-epargne -->
                </div>

                <div v-if="activeTab === 'irregulieres'"'''
assert OLD_EP_END in html, "EPARGNE close anchor not found"
html = html.replace(OLD_EP_END, NEW_EP_END, 1)
changes.append("EPARGNE collapsible body closed")

# ═══════════════════════════════════════════════════════════════════════
# 11. JS init script — add before </body>
# ═══════════════════════════════════════════════════════════════════════
OLD_BODY_END = "</body>"
NEW_BODY_END = '''    <script>
    // === v13.22 Collapsible Cards — localStorage persistence ===
    (function () {
      var PREF = 'cfo_c_';

      function restoreCollapsed() {
        document.querySelectorAll('[data-cfo-collapse]').forEach(function (card) {
          var id = card.dataset.cfoCollapse;
          if (localStorage.getItem(PREF + id) === '1') {
            if (!card.classList.contains('cfo-card-collapsed')) {
              card.classList.add('cfo-card-collapsed');
            }
          }
        });
      }

      // Event delegation: works for all tabs including v-if rendered ones
      document.addEventListener('click', function (e) {
        var header = e.target.closest('.cfo-collapse-header');
        if (!header) return;
        var card = header.closest('[data-cfo-collapse]');
        if (!card) return;
        card.classList.toggle('cfo-card-collapsed');
        var id = card.dataset.cfoCollapse;
        localStorage.setItem(PREF + id, card.classList.contains('cfo-card-collapsed') ? '1' : '0');
      });

      // Debounced MutationObserver: restores state as Vue renders new tabs
      var restoreTimer;
      var obs = new MutationObserver(function () {
        clearTimeout(restoreTimer);
        restoreTimer = setTimeout(restoreCollapsed, 150);
      });
      var appEl = document.getElementById('app');
      obs.observe(appEl || document.body, { childList: true, subtree: true });

      // Initial restore after DOM ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', restoreCollapsed);
      } else {
        restoreCollapsed();
      }
    })();
    </script>
</body>'''
assert OLD_BODY_END in html, "</body> anchor not found"
html = html.replace(OLD_BODY_END, NEW_BODY_END, 1)
changes.append("JS collapsible init script added before </body>")

# ═══════════════════════════════════════════════════════════════════════
# Write output
# ═══════════════════════════════════════════════════════════════════════
with open(DEST, "w", encoding="utf-8") as f:
    f.write(html)

print("[DONE] index.html v13.22 written successfully.")
print(f"  {len(changes)} changes applied:")
for c in changes:
    print(f"  OK  {c}")
