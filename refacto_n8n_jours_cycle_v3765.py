# -*- coding: utf-8 -*-
"""
v37.65 — LE CFO N8N COMPTE LES JOURS DU CYCLE, COMME L'APPLICATION.

  Le moteur inline de super_agent_cfo.json (« Tool: Intent Compiler » : computeReliquat,
  computeMonthlyNetCourant) convertissait encore une charge variable « / sem » avec un
  facteur figé — valeur × 4,3 — et ignorait les lignes de détail. L'application et le
  recalcul de secours du serveur (cfo_intent_engine.php : cfo_jours_cycle, cfo_semaines_cycle,
  cfo_periode_detail, cfo_facteur_periode, cfo_cout_variable_cycle) comptent les semaines
  du cycle de paie : jours ÷ 7, ligne par ligne, exception du mois comprise.
    → mêmes fonctions, même règle, dans le nœud :
      • le cycle du mois budgétaire M court du jour de paie de M−1 à la veille de celui de M
        (soldesInitiaux.jourDePaie, 27 par défaut) : N = jours ÷ 7 (31 j → 4,43 ; 28 j → 4) ;
      • une ligne coûte montant × N (/sem), × N/2 (/15 j) ou × 1 (/cycle), sans rythme elle
        hérite de sa catégorie ; une exception du mois remplace la catégorie entière ;
      • net mensuel : le cycle de chaque mois ; reliquat : le mois moyen (12 cycles ÷ 12),
        sans exception — comme cfo_compute_reliquat.
  super_agent_cfo_audio.json n'a plus de moteur inline (ses calls partent à
  pending_commit.php, donc à cfo_intent_engine.php) : contrôlé, laissé intact.
"""
import io, json, re, sys

MARQUE = 'v37.65 — LE CYCLE DE PAIE, JOUR PAR JOUR'

A_HELPERS = """function computeReliquat(fd, yr) {
"""
B_HELPERS = """// ════════════════════════════════════════════════════════
// """ + MARQUE + """ (miroir de cfo_intent_engine.php :
//   cfo_jours_cycle, cfo_semaines_cycle, cfo_periode_detail, cfo_facteur_periode,
//   cfo_cout_variable_cycle — la règle de l'application).
//   Le cycle du mois budgétaire M court du jour de paie de M−1 à la veille du jour
//   de paie de M : il compte N = jours ÷ 7 semaines (31 j → 4,43 ; 28 j → 4), et
//   non plus 4,3. Une ligne de détail coûte montant × N (/sem), × N/2 (/15 j) ou
//   × 1 (/cycle) ; sans rythme, elle hérite de sa catégorie. Une exception du mois
//   remplace la catégorie entière, dans son unité.
// ════════════════════════════════════════════════════════
function jourDePaie(fd) {
  const j = Math.trunc(Number(fd && fd.soldesInitiaux && fd.soldesInitiaux.jourDePaie)) || 27;
  return j < 1 ? 27 : j;
}
// Date.UTC déborde comme setDate en PHP : mois 0 = décembre de l'an passé, 31 février = 3 mars
function joursCycle(m, an, jdp) { return Math.round((Date.UTC(an, m - 1, jdp) - Date.UTC(an, m - 2, jdp)) / 864e5); }
function semainesCycle(m, an, jdp) { return joursCycle(m, an, jdp) / 7; }
function periodeDetail(d, cv) {
  const p = d && d.periode;
  if (p === "semaine" || p === "quinzaine" || p === "cycle") return p;
  return (cv && cv.periode) === "semaine" ? "semaine" : "cycle";
}
function facteurPeriode(p, n) { return p === "semaine" ? n : (p === "quinzaine" ? n / 2 : 1); }
function exceptionDuMois(item, m) {
  let v = null;
  ((item && item.exceptions) || []).forEach(e => { const md = Number(e.moisDebut||0), mf = Number(e.moisFin||0); if (md && mf && m >= md && m <= mf) v = Number(e.nouvelleValeur||0); });
  return v;
}
function coutVariableCycle(cv, m, an, jdp, avecExceptions) {
  const c = cv || {};
  const n = semainesCycle(m, an, jdp);
  const exc = avecExceptions === false ? null : exceptionDuMois(c, m);
  if (exc === null && Array.isArray(c.details) && c.details.length)
    return c.details.reduce((s, d) => s + (Number(d && d.montant) || 0) * facteurPeriode(periodeDetail(d, c), n), 0);
  const v = exc !== null ? exc : (Number(c.valeur) || 0);
  return c.periode === "semaine" ? v * n : v;
}

function computeReliquat(fd, yr) {
"""

A_RELIQUAT = """  const sumVar = Object.values(y.chargesVariables || {}).reduce((s,o)=>{
    const v = Number(o && o.valeur) || 0;
    return s + (o && o.periode === "semaine" ? v * 4.3 : v);
  }, 0);
"""
B_RELIQUAT = """  // v37.65 : un mois MOYEN = ses 12 cycles réels ÷ 12, sans exception (cfo_compute_reliquat)
  const jdp = jourDePaie(fd);
  const sumVar = Object.values(y.chargesVariables || {}).reduce((s,o)=>{
    let t = 0; for (let mm = 1; mm <= 12; mm++) t += coutVariableCycle(o, mm, Number(yr), jdp, false);
    return s + t / 12;
  }, 0);
"""

A_JDP = """  const curM = Number(si.moisActuel) || (Number(year) === curA ? (new Date().getMonth() + 1) : 1);
"""
B_JDP = A_JDP + """  const jdp = jourDePaie(fd);   // v37.65
"""

A_NET = """    if (varSrc === courantKey) Object.values(y.chargesVariables || {}).forEach(cv => { let v = eff(cv, cv.valeur, m); if (cv.periode === "semaine") v = v * 4.3; if (v > 0) sortants += v; });
"""
B_NET = """    if (varSrc === courantKey) Object.values(y.chargesVariables || {}).forEach(cv => { const v = coutVariableCycle(cv, m, Number(year), jdp, true); if (v > 0) sortants += v; });   // v37.65 : jours du cycle ÷ 7, ligne par ligne
"""

FOIS_43 = re.compile(r'\*\s*4[.,]3\b|\b4[.,]3\s*\*')


def codes(w):
    return [n for n in w['nodes'] if isinstance(n.get('parameters', {}).get('jsCode'), str)]


for f, indent in (('super_agent_cfo.json', 2), ('super_agent_cfo_audio.json', 4)):
    raw = io.open(f, encoding='utf-8').read()
    w = json.loads(raw)
    ic = next((n for n in w['nodes'] if n['name'] == 'Tool: Intent Compiler'), None)
    if ic is None: sys.exit('✖ ' + f + ' : nœud « Tool: Intent Compiler » introuvable')
    code = ic['parameters']['jsCode']

    if 'function computeMonthlyNetCourant' not in code:
        # Routeur HTTP : la règle est appliquée par cfo_intent_engine.php
        if 'pending_commit.php' not in code: sys.exit('✖ ' + f + ' : ni moteur inline ni routeur pending_commit.php')
        if any(FOIS_43.search(n['parameters']['jsCode']) for n in codes(w)): sys.exit('✖ ' + f + ' : « × 4,3 » hors moteur inline')
        print('=', f, ': routeur vers pending_commit.php, rien à changer')
        continue
    if MARQUE in code:
        print('=', f, ': déjà appliqué')
        continue

    for nom, a, b in (('helpers', A_HELPERS, B_HELPERS), ('reliquat', A_RELIQUAT, B_RELIQUAT),
                      ('jour de paie', A_JDP, B_JDP), ('net mensuel', A_NET, B_NET)):
        if code.count(a) != 1: sys.exit('✖ ' + f + ' : ancre « ' + nom + ' » (' + str(code.count(a)) + ' trouvée(s), 1 attendue)')
        code = code.replace(a, b)
    ic['parameters']['jsCode'] = code

    restants = [n['name'] for n in codes(w) if FOIS_43.search(n['parameters']['jsCode'])]
    if restants: sys.exit('✖ ' + f + ' : « × 4,3 » encore présent dans ' + ', '.join(restants))
    out = json.dumps(w, indent=indent, ensure_ascii=False) + ('\n' if raw.endswith('\n') else '')
    io.open(f, 'w', encoding='utf-8').write(out)
    print('✔', f)
