// Harnais de référence : le JS ORIGINAL du noeud n8n, extrait verbatim.
let financeData = null;
const _CY = new Date().getFullYear();
const _yrs = (a) => Array.isArray(a.years) ? a.years.map(Number) : [Number(a.year || a.annee || _CY)];

function computeReliquat(fd, yr) {
  const y = fd && fd.donneesAnnuelles && fd.donneesAnnuelles[yr];
  if (!y) return 0;
  const sumRev = Object.values(y.revenus || {}).reduce((s,o)=> s + (Number(o && o.base) || 0), 0);
  const sumFix = Object.values(y.chargesFixes || {}).reduce((s,o)=> s + (Number(o && o.valeur) || 0), 0);
  const sumVar = Object.values(y.chargesVariables || {}).reduce((s,o)=>{
    const v = Number(o && o.valeur) || 0;
    return s + (o && o.periode === "semaine" ? v * 4.3 : v);
  }, 0);
  return Math.round((sumRev - sumFix - sumVar) * 100) / 100;
}

function _normKeyC(k, courantKey) {
  if (!k || k === "courant") return courantKey;
  if (/^\d+$/.test(String(k))) return "cpt_" + k;
  return k;
}
function computeMonthlyNetCourant(fd, year) {
  const y = fd && fd.donneesAnnuelles && fd.donneesAnnuelles[year];
  if (!y) return [];
  const si = fd.soldesInitiaux || {};
  const courantCpt = (fd.comptes || []).find(c => c.type === "courant" || c.type === "liquide");
  const courantKey = courantCpt ? "cpt_" + courantCpt.id : "courant";
  const isC = (k) => _normKeyC(k, courantKey) === courantKey;
  const fxSrc = _normKeyC(si.compteChargesFixes || "courant", courantKey);
  const varSrc = _normKeyC(si.compteChargesVariables || "courant", courantKey);
  const curA = Number(si.anneeActuelle) || new Date().getFullYear();
  const curM = Number(si.moisActuel) || (Number(year) === curA ? (new Date().getMonth() + 1) : 1);
  const eff = (item, base, m) => {
    let v = Number(base || 0);
    ((item && item.exceptions) || []).forEach(e => { const md = Number(e.moisDebut||0), mf = Number(e.moisFin||0); if (md && mf && m >= md && m <= mf) v = Number(e.nouvelleValeur||0); });
    return v;
  };
  const epArr = (Array.isArray(y.epargne) ? y.epargne : Object.values(y.epargne || {})).filter(Boolean).filter(o => isC(o.sourceCompte));
  const out = [];
  for (let m = 1; m <= 12; m++) {
    const isPast = (Number(year) < curA) || (Number(year) === curA && m < curM);
    const isCurrent = (Number(year) === curA && m === curM);
    if (isPast) { out.push({ mois: m, net: null, isPast: true, isCurrent: false }); continue; }
    let entrants = 0, sortants = 0;
    Object.values(y.revenus || {}).forEach(r => { if (!isC(r.destinationCompte)) return; const v = eff(r, r.base, m); if (v > 0) entrants += v; });
    if (fxSrc === courantKey) Object.values(y.chargesFixes || {}).forEach(f => { const v = eff(f, f.valeur, m); if (v > 0) sortants += v; });
    if (varSrc === courantKey) Object.values(y.chargesVariables || {}).forEach(cv => { let v = eff(cv, cv.valeur, m); if (cv.periode === "semaine") v = v * 4.3; if (v > 0) sortants += v; });
    (y.depensesIrregulieres || []).forEach(d => { if (!d || d.sourceAssurance) return; if (Number(d.mois) !== m) return; if (!isC(d.sourceCompte)) return; const raw = Number(d.montant || 0); if (raw === 0) return; if (raw < 0) entrants += Math.abs(raw); else sortants += raw; });
    let ep = 0; epArr.forEach(o => { ep += eff(o, o.valeur, m); });
    let solde = 0;
    if (isCurrent) { solde = courantCpt ? Number(courantCpt.solde || 0) : Number(si.courant || 0); }
    out.push({ mois: m, net: Math.round(solde + entrants - sortants - ep), isPast: false, isCurrent: isCurrent });
  }
  return out;
}

const FUNCTION_CATALOG = {
  create_smart_goal: (a) => [{ action:"add", category:"objectif", target:a.name, label:a.name, amount:Number(a.initial_funding)||0, target_amount:Number(a.target_amount)||0, years:_yrs(a), notes:a.notes }],
  add_funds_to_goal: (a) => [{ action:"modify", category:"objectif", target:a.name, amount:Number(a.amount)||0, years:_yrs(a), notes:a.notes }],
  set_recurring_savings: (a, ctx) => _yrs(a).map(function(yr){
    // Mode 1 : pourcentage du NET mensuel ISOLÉ (90% du surplus, mois positifs uniquement)
    if (a.percentage_of_reliquat !== undefined && a.percentage_of_reliquat !== null) {
      var pct = Number(a.percentage_of_reliquat) / 100;
      // SSOT prioritaire : net mensuel exporté par l app ; sinon recalcul backend
      var monthly = (Array.isArray(ctx.monthlyNetFromPayload) && ctx.monthlyNetFromPayload.length)
        ? ctx.monthlyNetFromPayload
        : ctx.computeMonthlyNetCourant(ctx.financeData, yr);
      var exceptions = [];
      for (var k = 0; k < monthly.length; k++) {
        var mo = monthly[k] || {};
        var amt = (!mo.isPast && Number(mo.net) > 0) ? Math.round(pct * Number(mo.net)) : 0;
        exceptions.push({ moisDebut: mo.mois, moisFin: mo.mois, nouvelleValeur: amt });
      }
      return { action:"add", category:"epargne", target:a.name, label:a.name, amount:0, sourceCompte:a.source_account || "courant", years:[yr], exceptions:exceptions, notes:a.notes };
    }
    // Mode 2 : montant fixe mensuel
    var amount = Number(a.fixed_amount !== undefined && a.fixed_amount !== null ? a.fixed_amount : a.amount) || 0;
    var ch = { action:"add", category:"epargne", target:a.name, label:a.name, amount:amount, sourceCompte:a.source_account || "courant", years:[yr], notes:a.notes };
    if (Array.isArray(a.exceptions)) ch.exceptions = a.exceptions;
    return ch;
  }),
  update_recurring_savings: (a) => [{ action:"modify", category:"epargne", target:a.name, amount:Number(a.amount)||0, label:a.new_name, years:_yrs(a) }],
  remove_recurring_savings: (a) => [{ action:"remove", category:"epargne", target:a.name, years:_yrs(a) }],
  update_asset_valuation: (a) => { var ch = { action:"modify", category:"actif", target:a.asset_name, amount:Number(a.new_value)||0 }; if (a.scenario) ch.sub_target = a.scenario; if (a.valeur_actuelle !== undefined) ch.valeur_actuelle = a.valeur_actuelle; return [ch]; },
  add_fixed_expense: (a) => [{ action:"add", category:"charge_fixe", target:a.name, label:a.name, amount:Number(a.amount)||0, years:_yrs(a) }],
  update_fixed_expense: (a) => [{ action:"modify", category:"charge_fixe", target:a.name, amount:Number(a.amount)||0, years:_yrs(a) }],
  remove_fixed_expense: (a) => [{ action:"remove", category:"charge_fixe", target:a.name, years:_yrs(a) }],
  add_variable_expense: (a) => [{ action:"add", category:"charge_variable", target:a.name, label:a.name, amount:Number(a.amount)||0, period:a.period||"mois", years:_yrs(a) }],
  update_variable_expense: (a) => { var ch = { action:"modify", category:"charge_variable", target:a.name, amount:Number(a.amount)||0, years:_yrs(a) }; if (a.sub_target) ch.sub_target = a.sub_target; return [ch]; },
  add_income: (a) => [{ action:"add", category:"revenu", target:a.name, label:a.name, amount:Number(a.amount)||0, years:_yrs(a) }],
  update_income: (a) => [{ action:"modify", category:"revenu", target:a.name, amount:Number(a.amount)||0, years:_yrs(a) }],
  add_one_off_expense: (a) => [{ action:"add", category:"depense_ponctuelle", target:a.name, label:a.name, amount:Number(a.amount)||0, month:Number(a.month)||1, years:_yrs(a) }],
  create_account: (a) => [{ action:"add", category:"compte", target:a.label, label:a.label, amount:Number(a.balance)||0 }],
  adjust_account_balance: (a) => [{ action:"modify", category:"compte", target:a.account, amount:Number(a.amount)||0 }],
  set_initial_balance: (a) => [{ action:"set_balance", category:"solde", balance_key:a.account||"courant", amount:Number(a.amount)||0 }],
  clone_year: (a) => [{ action:"clone_year", category:"annee", clone_from_year:Number(a.from_year), years:[Number(a.to_year)] }]
};
// HELPERS (portés du Budget Engine v6/v13.9)
// ════════════════════════════════════════════════════════
const pickNum = (op, ...keys) => {
  for (const k of keys) {
    if (op[k] !== undefined && op[k] !== null && op[k] !== '') {
      const n = Number(op[k]); if (Number.isFinite(n)) return n;
    }
  }
  return null;
};
const pickStr = (op, ...keys) => {
  for (const k of keys) { if (op[k] !== undefined && op[k] !== null) return String(op[k]); }
  return null;
};

const SYN_NUM_CHARGE  = ['montant', 'value', 'amount'];
const SYN_NUM_REVENU  = ['valeur', 'montant', 'value', 'amount', 'salaire'];
const SYN_NUM_DEPENSE = ['valeur', 'value', 'amount'];
const SYN_LBL         = ['nom'];

const purgeKeys = (obj, syns) => {
  let p = 0;
  if (!obj || typeof obj !== 'object') return 0;
  for (const s of syns) { if (Object.prototype.hasOwnProperty.call(obj, s)) { delete obj[s]; p++; } }
  return p;
};

function sanitizeFinanceData(fd) {
  const r = { revenus: 0, fixes: 0, variables: 0, epargne: 0, depenses: 0 };
  if (!fd || !fd.donneesAnnuelles) return r;
  for (const yr in fd.donneesAnnuelles) {
    const y = fd.donneesAnnuelles[yr]; if (!y) continue;
    for (const k in (y.revenus || {})) {
      const o = y.revenus[k]; if (!o) continue;
      if (o.base == null) { const rv = pickNum(o, 'valeur', 'montant', 'value', 'amount', 'salaire'); if (rv !== null) o.base = rv; }
      if (o.label == null && o.nom) o.label = String(o.nom);
      r.revenus += purgeKeys(o, SYN_NUM_REVENU) + purgeKeys(o, SYN_LBL);
    }
    for (const k in (y.chargesFixes || {})) {
      const o = y.chargesFixes[k]; if (!o) continue;
      if (o.valeur == null) { const rv = pickNum(o, 'montant', 'value', 'amount'); if (rv !== null) o.valeur = rv; }
      if (o.label == null && o.nom) o.label = String(o.nom);
      r.fixes += purgeKeys(o, SYN_NUM_CHARGE) + purgeKeys(o, SYN_LBL);
    }
    for (const k in (y.chargesVariables || {})) {
      const o = y.chargesVariables[k]; if (!o) continue;
      if (o.valeur == null) { const rv = pickNum(o, 'montant', 'value', 'amount'); if (rv !== null) o.valeur = rv; }
      if (o.label == null && o.nom) o.label = String(o.nom);
      r.variables += purgeKeys(o, SYN_NUM_CHARGE) + purgeKeys(o, SYN_LBL);
    }
    // v20.90 : epargne peut etre array (Vue.js v17.99) OU legacy object — itere les deux
    const _epPool = Array.isArray(y.epargne) ? y.epargne.filter(Boolean) : Object.values(y.epargne || {}).filter(Boolean);
    for (const o of _epPool) {
      if (o.valeur == null) { const rv = pickNum(o, 'montant', 'value', 'amount'); if (rv !== null) o.valeur = rv; }
      if (o.label == null && o.nom) o.label = String(o.nom);
      if (o.nom == null && o.label) o.nom = String(o.label);
      r.epargne += purgeKeys(o, SYN_NUM_CHARGE) + purgeKeys(o, SYN_LBL);
    }
    for (const d of (y.depensesIrregulieres || [])) {
      if (!d) continue;
      if (d.montant == null) { const rv = pickNum(d, 'valeur', 'value', 'amount'); if (rv !== null) d.montant = rv; }
      r.depenses += purgeKeys(d, SYN_NUM_DEPENSE);
    }
  }
  return r;
}

const writeCharge = (t, v, l) => { if (v != null) t.valeur = v; if (l != null) t.label = l; purgeKeys(t, SYN_NUM_CHARGE); purgeKeys(t, SYN_LBL); };
const writeRevenu  = (t, b, l) => { if (b != null) t.base  = b; if (l != null) t.label = l; purgeKeys(t, SYN_NUM_REVENU);  purgeKeys(t, SYN_LBL); };
const writeEpargne = (t, v, l) => { if (v != null) t.valeur = v; if (l != null) t.label = l; purgeKeys(t, SYN_NUM_CHARGE); purgeKeys(t, SYN_LBL); };

const snapshot = (fd, yr) => {
  const y = fd.donneesAnnuelles && fd.donneesAnnuelles[yr];
  if (!y) return null;
  const sum = obj => Object.values(obj || {}).reduce((s, v) => s + (Number(v && v.valeur) || Number(v && v.base) || 0), 0);
  return { revenus: sum(y.revenus), fixes: sum(y.chargesFixes), variables: sum(y.chargesVariables), epargne: sum(y.epargne), depensesIrreg: (y.depensesIrregulieres || []).length };
};

// ════════════════════════════════════════════════════════
// ENTITY RESOLVER — fuzzy match target label -> key technique
// ════════════════════════════════════════════════════════
function normStr(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = [];
  for (let i = 0; i <= m; i++) { dp[i] = [i]; for (let j = 1; j <= n; j++) dp[i][j] = 0; }
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

const POOL_MAP = { revenu: 'revenus', charge_fixe: 'chargesFixes', charge_variable: 'chargesVariables', epargne: 'epargne' };

function resolveEntity(target, category, fd) {
  const normT = normStr(target);
  const candidates = [];
  const seen = new Set();

  const catKeys = category && POOL_MAP[category] ? [category] : Object.keys(POOL_MAP);

  for (const yr in fd.donneesAnnuelles) {
    const y = fd.donneesAnnuelles[yr]; if (!y) continue;
    for (const cat of catKeys) {
      const rawPool = y[POOL_MAP[cat]] || {};
      // v20.90 : epargne v17.99 = array d'objets {id, nom, ...} → cle technique = 'ep_'+id
      const pool = Array.isArray(rawPool)
        ? Object.fromEntries(rawPool.filter(Boolean).map(item => ['ep_' + (item.id || ''), item]))
        : rawPool;
      for (const key in pool) {
        const dk = cat + ':' + key;
        if (seen.has(dk)) continue; seen.add(dk);
        const item = pool[key];
        const lbl = item.label || item.nom || key;
        const normL = normStr(lbl), normK = normStr(key);
        const dist = Math.min(levenshtein(normT, normL), levenshtein(normT, normK));
        const contains = normL.includes(normT) || normK.includes(normT) || normT.includes(normL) || normT.includes(normK);
        candidates.push({ key, label: lbl, category: cat, dist, contains });
      }
    }
  }

  // Soldes initiaux
  if (!category || category === 'solde') {
    for (const key in (fd.soldesInitiaux || {})) {
      const dk = 'solde:' + key;
      if (seen.has(dk)) continue; seen.add(dk);
      const normK = normStr(key);
      const dist = levenshtein(normT, normK);
      const contains = normK.includes(normT) || normT.includes(normK);
      candidates.push({ key, label: key, category: 'solde', dist, contains });
    }
  }

  if (!candidates.length) {
    return { resolved: false, error: '"' + target + '" introuvable' + (category ? ' dans ' + category : '') + '. Finance data vide ou catégorie incorrecte.' };
  }

  candidates.sort((a, b) => {
    if (a.contains !== b.contains) return a.contains ? -1 : 1;
    return a.dist - b.dist;
  });

  const best = candidates[0];
  const second = candidates[1];
  const thresh = Math.max(4, Math.floor(normT.length * 0.55));

  // Ambiguïté : deux candidats "contains" avec même distance
  if (second && second.contains && best.contains && best.key !== second.key && best.dist === second.dist && best.category === second.category) {
    return { resolved: false, ambiguous: true, choices: [best, second],
      error: '"' + target + '" est ambigu. Précise : "' + best.label + '" (' + best.key + ') ou "' + second.label + '" (' + second.key + ') ?' };
  }

  // Distance trop grande sans "contains"
  if (!best.contains && best.dist > thresh) {
    const sugg = candidates.slice(0, 4).map(c => '"' + c.label + '"').join(', ');
    return { resolved: false, error: '"' + target + '" ne correspond à aucune ligne connue. Lignes proches : ' + sugg };
  }

  return { resolved: true, key: best.key, label: best.label, category: best.category };
}
// ════════════════════════════════════════════════════════
// OP BUILDER — (action, category, resolvedKey) -> op[]
// Gemini ne voit JAMAIS les types techniques — c'est ici qu'ils sont déterminés.
// ════════════════════════════════════════════════════════
function buildOps(change, resolvedKey, resolvedCat, annee) {
  const { action, amount, label: newLabel, period, month, exception_start, exception_end, exception_value, exception_id, clone_from_year, studio_key, balance_key, one_off_id, target, sub_target: subTarget } = change;
  const amt = (amount !== undefined && amount !== null && !isNaN(Number(amount))) ? Number(amount) : null;
  // v15.14 — Multi-Add Key Collision fix : suffixe aléatoire pour les ops 'add'
  // garantit l'unicité de la clé technique même si l'IA ajoute 3 fois le même label
  const safeTarget = String(target || newLabel || 'nouvelle_ligne').replace(/\s+/g, '_').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const baseKey = resolvedKey || (action === 'add' ? safeTarget + '_' + Math.random().toString(36).substring(2, 6) : safeTarget);

  switch (action) {
    case 'modify':
      switch (resolvedCat) {
        case 'revenu':         return [{ type: 'update_revenu',         key: resolvedKey, ...(amt != null && { base: amt }),   ...(newLabel && { label: newLabel }) }];
        case 'charge_fixe':    return [{ type: 'update_charge_fixe',    key: resolvedKey, ...(amt != null && { valeur: amt }), ...(newLabel && { label: newLabel }) }];
        case 'charge_variable':
          if (subTarget) return [{ type: 'update_charge_variable_detail', key: resolvedKey, sub_key: subTarget, montant: amt }];
          return [{ type: 'update_charge_variable', key: resolvedKey, ...(amt != null && { valeur: amt }), ...(period && { periode: period }), ...(newLabel && { label: newLabel }) }];
        case 'epargne':        return [{ type: 'update_epargne',        key: resolvedKey, ...(amt != null && { valeur: amt }), ...(newLabel && { label: newLabel }) }];
        case 'studio':         return [{ type: 'set_projet_studio', annee, key: studio_key || resolvedKey || 'travaux', valeur: amt }];
        case 'solde':          return [{ type: 'set_solde_initial', key: balance_key || resolvedKey || 'courant', valeur: amt }];
        case 'compte':         return [{ type: 'update_compte', key: change.target_key || target, montant: amt }];
        case 'objectif':       return [{ type: 'update_objectif', key: change.target_key || target, montant: amt }];
        case 'actif':
        case 'foncier':        return [{ type: 'update_master_asset', key: change.target_key || target, montant: amt, ...(subTarget && { scenario: subTarget }), ...(change.sous_categorie && { scenario: change.sous_categorie }), ...(change.taux_credit !== undefined && { taux_credit: change.taux_credit }), ...(change.annees_total !== undefined && { annees_total: change.annees_total }), ...(change.annees_restantes !== undefined && { annees_restantes: change.annees_restantes }), ...(change.apport_personnel !== undefined && { apport_personnel: change.apport_personnel }), ...(change.montant_credit !== undefined && { montant_credit: change.montant_credit }), ...(change.valeur_actuelle !== undefined && { valeur_actuelle: change.valeur_actuelle }) }];
        default: return null;
      }
    case 'add':
      switch (resolvedCat) {
        case 'revenu':          return [{ type: 'add_revenu',         key: baseKey, label: newLabel || target, base: amt || 0 }];
        case 'charge_fixe':     return [{ type: 'add_charge_fixe',    key: baseKey, label: newLabel || target, valeur: amt || 0 }];
        case 'charge_variable': return [{ type: 'add_charge_variable',key: baseKey, label: newLabel || target, valeur: amt || 0, periode: period || 'mois' }];
        case 'epargne': return [{ type: 'add_epargne', key: baseKey, label: newLabel || target, valeur: amt || 0, ...(change.sourceCompte && { sourceCompte: change.sourceCompte }), ...(change.linkedAccountId !== undefined && change.linkedAccountId !== null && { linkedAccountId: change.linkedAccountId }), ...(Array.isArray(change.exceptions) && { exceptions: change.exceptions }) }];
        case 'depense_ponctuelle': return [{ type: 'add_depense_ponctuelle', annee, mois: month || 1, nom: newLabel || target, montant: amt || 0 }];
        case 'compte':         return [{ type: 'create_compte', label: newLabel || target, montant: amt || 0 }];
        case 'objectif':       return [{ type: 'create_objectif', name: newLabel || target, current: amt || 0, target_amount: change.target_amount || 0 }];
        default: return null;
      }
    case 'remove':
      switch (resolvedCat) {
        case 'revenu':          return [{ type: 'remove_revenu',         key: resolvedKey }];
        case 'charge_fixe':     return [{ type: 'remove_charge_fixe',    key: resolvedKey }];
        case 'charge_variable': return [{ type: 'remove_charge_variable',key: resolvedKey }];
        case 'epargne':         return [{ type: 'remove_epargne',        key: resolvedKey }];
        case 'depense_ponctuelle': return one_off_id ? [{ type: 'remove_depense_ponctuelle', annee, id: one_off_id }] : [{ type: 'remove_depense_ponctuelle', annee, nom: target }];
        case 'annee':           return [{ type: 'delete_annee', annee }];
        default: return null;
      }
    case 'rename':
      if (!newLabel) return null;
      switch (resolvedCat) {
        case 'revenu':      return [{ type: 'rename_revenu',      key: resolvedKey, label: newLabel }];
        case 'charge_fixe': return [{ type: 'rename_charge_fixe', key: resolvedKey, label: newLabel }];
        default: return null;
      }
    case 'add_exception':
      switch (resolvedCat) {
        case 'revenu':      return [{ type: 'add_revenu_exception',     key: resolvedKey, moisDebut: exception_start, moisFin: exception_end, nouvelleValeur: exception_value }];
        case 'charge_fixe': return [{ type: 'add_charge_fixe_exception',key: resolvedKey, moisDebut: exception_start, moisFin: exception_end, nouvelleValeur: exception_value }];
        case 'epargne':     return [{ type: 'add_epargne_exception',    key: resolvedKey || target, moisDebut: exception_start, moisFin: exception_end, nouvelleValeur: exception_value }];
        default: return null;
      }
    case 'remove_exception':
      switch (resolvedCat) {
        case 'revenu':      return [{ type: 'remove_revenu_exception',     key: resolvedKey, id: exception_id }];
        case 'charge_fixe': return [{ type: 'remove_charge_fixe_exception',key: resolvedKey, id: exception_id }];
        case 'epargne':     return [{ type: 'remove_epargne_exception',    key: resolvedKey || target, id: exception_id }];
        default: return null;
      }
    case 'update_one_off':
      return one_off_id ? [{ type: 'update_depense_ponctuelle', id: one_off_id, ...(amt != null && { montant: amt }), ...(month && { mois: month }), ...(newLabel && { nom: newLabel }) }] : null;
    case 'clone_year':
      return [{ type: 'clone_annee', depuis: clone_from_year || (annee - 1), vers: annee }];
    case 'set_balance':
      return [{ type: 'set_solde_initial', key: balance_key || baseKey, valeur: amt }];
    case 'set_studio':
      return [{ type: 'set_projet_studio', annee, key: studio_key || baseKey, valeur: amt }];
    default: return null;
  }
}
// ════════════════════════════════════════════════════════
// applyOp — inline depuis Budget Engine v6/v13.9 (logique identique)
// ════════════════════════════════════════════════════════
function applyOp(fd, op, anneeTarget) {
  const a = Number(op.annee || anneeTarget);
  const y = fd.donneesAnnuelles && fd.donneesAnnuelles[a];
  const log = { op: op.type };
  try {
    switch (op.type) {
      // ── REVENUS ────────────────────────────────────────
      case 'set_revenu': {
        if (!y || !y.revenus || !y.revenus[op.key]) { log.status='skip'; log.reason='clé absente'; break; }
        const v = pickNum(op, 'base', 'valeur', 'montant', 'value', 'amount', 'salaire');
        if (v === null) { log.status='error'; log.reason='valeur manquante'; break; }
        const old = y.revenus[op.key].base; writeRevenu(y.revenus[op.key], v, null);
        log.key=op.key; log.avant=old; log.apres=v; break;
      }
      case 'add_revenu': {
        if (!y) { log.status='skip'; log.reason='année absente'; break; }
        if (!y.revenus) y.revenus={};
        if (y.revenus[op.key]) { log.status='skip'; log.reason='clé existe déjà'; break; }
        const v = pickNum(op, 'base', 'valeur', 'montant', 'value', 'amount', 'salaire') ?? 0;
        const lbl = pickStr(op, 'label', 'nom') || op.key;
        y.revenus[op.key] = { label: lbl, base: v, showExceptions: false, exceptions: [] };
        log.key=op.key; log.created=true; log.base=v; break;
      }
      case 'remove_revenu': {
        if (!y || !y.revenus || !y.revenus[op.key]) { log.status='skip'; log.reason='clé absente'; break; }
        delete y.revenus[op.key]; log.key=op.key; log.removed=true; break;
      }
      case 'rename_revenu': {
        if (!y || !y.revenus || !y.revenus[op.key]) { log.status='skip'; log.reason='clé absente'; break; }
        const lbl = pickStr(op, 'label', 'nom');
        if (!lbl) { log.status='error'; log.reason='label manquant'; break; }
        const old = y.revenus[op.key].label; writeRevenu(y.revenus[op.key], null, lbl);
        log.key=op.key; log.avant=old; log.apres=lbl; break;
      }
      case 'update_revenu': {
        if (!y || !y.revenus || !y.revenus[op.key]) { log.status='skip'; log.reason='clé absente'; break; }
        const v = pickNum(op, 'base', 'valeur', 'montant', 'value', 'amount', 'salaire');
        const lbl = pickStr(op, 'label', 'nom');
        const t = y.revenus[op.key]; const ch = {};
        if (v !== null) ch.base = { avant: t.base, apres: v };
        if (lbl !== null) ch.label = { avant: t.label, apres: lbl };
        if (!Object.keys(ch).length) { log.status='error'; log.reason='aucun champ fourni'; break; }
        writeRevenu(t, v, lbl); log.key=op.key; log.changes=ch; break;
      }
      case 'add_revenu_exception': {
        if (!y || !y.revenus || !y.revenus[op.key]) { log.status='skip'; log.reason='clé absente'; break; }
        if (!Array.isArray(y.revenus[op.key].exceptions)) y.revenus[op.key].exceptions=[];
        const id = Date.now()+Math.floor(Math.random()*1000);
        y.revenus[op.key].exceptions.push({ id, moisDebut:Number(op.moisDebut), moisFin:Number(op.moisFin), nouvelleValeur:Number(op.nouvelleValeur) });
        y.revenus[op.key].showExceptions=true; log.key=op.key; log.id=id; break;
      }
      case 'remove_revenu_exception': {
        if (!y || !y.revenus || !y.revenus[op.key]) { log.status='skip'; log.reason='clé absente'; break; }
        const before=(y.revenus[op.key].exceptions||[]).length;
        y.revenus[op.key].exceptions=(y.revenus[op.key].exceptions||[]).filter(e=>Number(e.id)!==Number(op.id));
        log.key=op.key; log.supprimees=before-y.revenus[op.key].exceptions.length; break;
      }
      // ── CHARGES FIXES ──────────────────────────────────
      case 'set_charge_fixe': {
        if (!y || !y.chargesFixes || !y.chargesFixes[op.key]) { log.status='skip'; log.reason='clé absente'; break; }
        const v = pickNum(op, 'valeur', 'montant', 'value', 'amount');
        if (v === null) { log.status='error'; log.reason='valeur manquante'; break; }
        const old = y.chargesFixes[op.key].valeur; writeCharge(y.chargesFixes[op.key], v, null);
        log.key=op.key; log.avant=old; log.apres=v; break;
      }
      case 'add_charge_fixe': {
        if (!y) { log.status='skip'; log.reason='année absente'; break; }
        if (!y.chargesFixes) y.chargesFixes={};
        if (y.chargesFixes[op.key]) { log.status='skip'; log.reason='clé existe déjà'; break; }
        const v = pickNum(op, 'valeur', 'montant', 'value', 'amount') ?? 0;
        const lbl = pickStr(op, 'label', 'nom') || op.key;
        y.chargesFixes[op.key] = { label:lbl, valeur:v, showExceptions:false, exceptions:[], montantPaye:0, paye:false };
        log.key=op.key; log.created=true; log.valeur=v; break;
      }
      case 'remove_charge_fixe': {
        if (!y || !y.chargesFixes || !y.chargesFixes[op.key]) { log.status='skip'; log.reason='clé absente'; break; }
        delete y.chargesFixes[op.key]; log.key=op.key; log.removed=true; break;
      }
      case 'rename_charge_fixe': {
        if (!y || !y.chargesFixes || !y.chargesFixes[op.key]) { log.status='skip'; log.reason='clé absente'; break; }
        const lbl = pickStr(op, 'label', 'nom');
        if (!lbl) { log.status='error'; log.reason='label manquant'; break; }
        const old = y.chargesFixes[op.key].label; writeCharge(y.chargesFixes[op.key], null, lbl);
        log.key=op.key; log.avant=old; log.apres=lbl; break;
      }
      case 'update_charge_fixe': {
        if (!y || !y.chargesFixes || !y.chargesFixes[op.key]) { log.status='skip'; log.reason='clé absente'; break; }
        const v = pickNum(op, 'valeur', 'montant', 'value', 'amount');
        const lbl = pickStr(op, 'label', 'nom');
        const t = y.chargesFixes[op.key]; const ch={};
        if (v !== null) ch.valeur = { avant:t.valeur, apres:v };
        if (lbl !== null) ch.label = { avant:t.label, apres:lbl };
        if (!Object.keys(ch).length) { log.status='error'; log.reason='aucun champ fourni'; break; }
        writeCharge(t, v, lbl); log.key=op.key; log.changes=ch; break;
      }
      case 'add_charge_fixe_exception': {
        if (!y || !y.chargesFixes || !y.chargesFixes[op.key]) { log.status='skip'; log.reason='clé absente'; break; }
        if (!Array.isArray(y.chargesFixes[op.key].exceptions)) y.chargesFixes[op.key].exceptions=[];
        const id=Date.now()+Math.floor(Math.random()*1000);
        y.chargesFixes[op.key].exceptions.push({ id, moisDebut:Number(op.moisDebut), moisFin:Number(op.moisFin), nouvelleValeur:Number(op.nouvelleValeur) });
        y.chargesFixes[op.key].showExceptions=true; log.key=op.key; log.id=id; break;
      }
      case 'remove_charge_fixe_exception': {
        if (!y || !y.chargesFixes || !y.chargesFixes[op.key]) { log.status='skip'; log.reason='clé absente'; break; }
        const before=(y.chargesFixes[op.key].exceptions||[]).length;
        y.chargesFixes[op.key].exceptions=(y.chargesFixes[op.key].exceptions||[]).filter(e=>Number(e.id)!==Number(op.id));
        log.key=op.key; log.supprimees=before-y.chargesFixes[op.key].exceptions.length; break;
      }
      // ── CHARGES VARIABLES ──────────────────────────────
      case 'set_charge_variable': {
        if (!y || !y.chargesVariables || !y.chargesVariables[op.key]) { log.status='skip'; log.reason='clé absente'; break; }
        const v = pickNum(op, 'valeur', 'montant', 'value', 'amount');
        if (v === null) { log.status='error'; log.reason='valeur manquante'; break; }
        const item = y.chargesVariables[op.key]; const old = item.valeur;
        if (item.details && item.details.length > 0) {
          const cs = item.details.reduce((s,d) => s+(Number(d.montant)||0), 0);
          if (cs === 0) { log.status='error'; log.requires_redistribution=true; log.reason='Sous-lignes toutes à 0 — précise comment ventiler'; log.nouveau_total=v; log.lignes=item.details.map(d=>({id:d.id,nom:d.nom,montant_actuel:d.montant})); break; }
          const ratio = v/cs; let dist=0;
          for (let i=0; i<item.details.length-1; i++) { const nm=Math.round(item.details[i].montant*ratio); item.details[i].montant=nm; dist+=nm; }
          item.details[item.details.length-1].montant=v-dist;
          log.redistribution='proportionnelle'; log.ratio=Math.round(ratio*1000)/1000; log.details_apres=item.details.map(d=>({nom:d.nom,montant:d.montant}));
        }
        writeCharge(item, v, null); log.key=op.key; log.avant=old; log.apres=v; break;
      }
      case 'add_charge_variable': {
        if (!y) { log.status='skip'; log.reason='année absente'; break; }
        if (!y.chargesVariables) y.chargesVariables={};
        if (y.chargesVariables[op.key]) { log.status='skip'; log.reason='clé existe déjà'; break; }
        const v = pickNum(op, 'valeur', 'montant', 'value', 'amount') ?? 0;
        const per = (op.periode==='semaine'||op.periode==='mois') ? op.periode : 'mois';
        const lbl = pickStr(op, 'label', 'nom') || op.key;
        y.chargesVariables[op.key]={ label:lbl, valeur:v, periode:per, showDetails:false, details:[] };
        log.key=op.key; log.created=true; log.valeur=v; log.periode=per; break;
      }
      case 'remove_charge_variable': {
        if (!y || !y.chargesVariables || !y.chargesVariables[op.key]) { log.status='skip'; log.reason='clé absente'; break; }
        delete y.chargesVariables[op.key]; log.key=op.key; log.removed=true; break;
      }
      case 'set_charge_variable_periode': {
        if (!y || !y.chargesVariables || !y.chargesVariables[op.key]) { log.status='skip'; log.reason='clé absente'; break; }
        if (op.periode!=='mois' && op.periode!=='semaine') { log.status='error'; log.reason='periode invalide (mois|semaine)'; break; }
        const old=y.chargesVariables[op.key].periode; y.chargesVariables[op.key].periode=op.periode;
        log.key=op.key; log.avant=old; log.apres=op.periode; break;
      }
      case 'update_charge_variable_detail': {
        if (!y || !y.chargesVariables || !y.chargesVariables[op.key]) { log.status='skip'; log.reason='clé mère absente'; break; }
        const t = y.chargesVariables[op.key];
        if (!t.details || !t.details.length) { log.status='error'; log.reason='aucune sous-ligne existante'; break; }
        const normStrOp = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const normSub = normStrOp(op.sub_key);
        const detail = t.details.find(d => normStrOp(d.nom).includes(normSub) || normSub.includes(normStrOp(d.nom)));
        if (!detail) { log.status='error'; log.reason='sous-ligne introuvable: '+op.sub_key; break; }
        const v = pickNum(op, 'montant', 'valeur', 'value', 'amount');
        if (v === null) { log.status='error'; log.reason='montant manquant'; break; }
        const old = detail.montant;
        detail.montant = v;
        t.valeur = t.details.reduce((s, d) => s + (Number(d.montant) || 0), 0);
        log.key=op.key; log.sub_key=detail.nom; log.avant=old; log.apres=v; log.nouveau_total=t.valeur;
        break;
      }
      case 'update_charge_variable': {
        if (!y || !y.chargesVariables || !y.chargesVariables[op.key]) { log.status='skip'; log.reason='clé absente'; break; }
        const v = pickNum(op, 'valeur', 'montant', 'value', 'amount');
        const lbl = pickStr(op, 'label', 'nom');
        const per = (op.periode==='mois'||op.periode==='semaine') ? op.periode : null;
        const t = y.chargesVariables[op.key]; const ch={};
        if (v !== null) {
          if (t.details && t.details.length > 0) {
            const cs=t.details.reduce((s,d)=>s+(Number(d.montant)||0),0);
            if (cs===0) { log.status='error'; log.requires_redistribution=true; log.reason='Sous-lignes toutes à 0'; log.nouveau_total=v; log.lignes=t.details.map(d=>({id:d.id,nom:d.nom,montant_actuel:d.montant})); break; }
            const ratio=v/cs; let dist=0;
            for (let i=0;i<t.details.length-1;i++){const nm=Math.round(t.details[i].montant*ratio);t.details[i].montant=nm;dist+=nm;}
            t.details[t.details.length-1].montant=v-dist;
            ch.redistribution={mode:'proportionnelle',ratio:Math.round(ratio*1000)/1000,details_apres:t.details.map(d=>({nom:d.nom,montant:d.montant}))};
          }
          ch.valeur={avant:t.valeur,apres:v};
        }
        if (per!==null) { ch.periode={avant:t.periode,apres:per}; t.periode=per; }
        if (lbl!==null) ch.label={avant:t.label,apres:lbl};
        if (!Object.keys(ch).length) { log.status='error'; log.reason='aucun champ fourni'; break; }
        writeCharge(t, v, lbl); log.key=op.key; log.changes=ch; break;
      }
      // ── ÉPARGNE ────────────────────────────────────────
      // ── ÉPARGNES v20.90 : Schema ARRAY d'objets {id, nom, label, valeur, sourceCompte, linkedAccountId, exceptions[], showExceptions} aligné Vue.js v17.99 ──
      // Helper de migration legacy object → array (idempotent)
      // -- LE BLOC suivant utilise une fonction locale dans chaque case pour rester compatible avec n8n typeVersion 1.2 (pas de hoisting global) --
      case 'set_epargne': {
        if (!y){log.status='skip';log.reason='année absente';break;}
        if (y.epargne && !Array.isArray(y.epargne)) y.epargne = Object.entries(y.epargne).map(([k,v]) => ({...v, id: (v && v.id) || k}));
        if (!Array.isArray(y.epargne) || !y.epargne.length){log.status='skip';log.reason='aucune epargne';break;}
        const normKey=String(op.key||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
        const ep=y.epargne.find(e=>e&&(String(e.id)===String(op.key)||'ep_'+e.id===op.key||String(e.nom||e.label||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(normKey)));
        if (!ep){log.status='skip';log.reason='epargne introuvable: '+op.key;break;}
        const v=pickNum(op,'valeur','montant','value','amount');
        if (v===null){log.status='error';log.reason='valeur manquante';break;}
        const old=ep.valeur; ep.valeur=v;
        log.cible=ep.nom||ep.label;log.avant=old;log.apres=v;break;
      }
      case 'add_epargne': {
        // v20.90 : Création au format ARRAY (était objet → invisible dans surplusParMois et selects)
        if (!y){log.status='skip';log.reason='année absente';break;}
        if (y.epargne && !Array.isArray(y.epargne)) y.epargne = Object.entries(y.epargne).map(([k,v]) => ({...v, id: (v && v.id) || k}));
        if (!Array.isArray(y.epargne)) y.epargne = [];
        const v = pickNum(op,'valeur','montant','value','amount') ?? 0;
        const lbl = pickStr(op,'label','nom') || op.key || 'Nouvel objectif';
        // Anti-doublon par nom normalisé
        const normLbl = String(lbl).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
        const existing = y.epargne.find(e => e && String(e.nom||e.label||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim() === normLbl);
        if (existing){log.status='skip';log.reason='Objectif epargne deja existant: '+lbl;break;}
        const newId = Date.now() + Math.floor(Math.random()*1000);
        const newEp = {
          id: newId,
          nom: lbl,
          label: lbl,
          valeur: v,
          sourceCompte: pickStr(op,'sourceCompte') || 'courant',
          linkedAccountId: (op.linkedAccountId !== undefined && op.linkedAccountId !== null) ? op.linkedAccountId : null,
          exceptions: [],
          showExceptions: false
        };
        // v20.90 : Support des exceptions inline { exceptions: [{moisDebut, moisFin, nouvelleValeur}] }
        if (Array.isArray(op.exceptions)) {
          for (const e of op.exceptions) {
            if (!e) continue;
            const mD = Number(e.moisDebut !== undefined ? e.moisDebut : (e.month_start !== undefined ? e.month_start : e.exception_start));
            const mF = Number(e.moisFin !== undefined ? e.moisFin : (e.month_end !== undefined ? e.month_end : e.exception_end));
            const nv = Number(e.nouvelleValeur !== undefined ? e.nouvelleValeur : (e.value !== undefined ? e.value : e.exception_value));
            if (mD>=1 && mD<=12 && mF>=mD && mF<=12 && Number.isFinite(nv)) {
              newEp.exceptions.push({id: Date.now() + Math.floor(Math.random()*10000), moisDebut: mD, moisFin: mF, nouvelleValeur: nv});
              newEp.showExceptions = true;
            }
          }
        }
        y.epargne.push(newEp);
        // Initialise le solde initial de l'objectif (comme addObjectifEpargne dans Vue.js)
        if (!financeData.soldesInitiaux) financeData.soldesInitiaux = {};
        if (financeData.soldesInitiaux['ep_'+newId] === undefined) financeData.soldesInitiaux['ep_'+newId] = 0;
        log.id = newId; log.key = 'ep_'+newId; log.cible = lbl; log.created = true; log.valeur = v;
        if (newEp.exceptions.length) log.exceptions_count = newEp.exceptions.length;
        break;
      }
      case 'remove_epargne': {
        if (!y){log.status='skip';log.reason='année absente';break;}
        if (y.epargne && !Array.isArray(y.epargne)) y.epargne = Object.entries(y.epargne).map(([k,v]) => ({...v, id: (v && v.id) || k}));
        if (!Array.isArray(y.epargne)){log.status='skip';log.reason='aucune epargne';break;}
        const normKey=String(op.key||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
        const idx=y.epargne.findIndex(e=>e&&(String(e.id)===String(op.key)||'ep_'+e.id===op.key||String(e.nom||e.label||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(normKey)));
        if (idx===-1){log.status='skip';log.reason='epargne introuvable: '+op.key;break;}
        const removed=y.epargne[idx]; y.epargne.splice(idx,1);
        log.cible=removed.nom||removed.label;log.removed=true;break;
      }
      case 'update_epargne': {
        if (!y){log.status='skip';log.reason='année absente';break;}
        if (y.epargne && !Array.isArray(y.epargne)) y.epargne = Object.entries(y.epargne).map(([k,v]) => ({...v, id: (v && v.id) || k}));
        if (!Array.isArray(y.epargne) || !y.epargne.length){log.status='skip';log.reason='aucune epargne';break;}
        const normKey=String(op.key||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
        const ep=y.epargne.find(e=>e&&(String(e.id)===String(op.key)||'ep_'+e.id===op.key||String(e.nom||e.label||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(normKey)));
        if (!ep){log.status='skip';log.reason='epargne introuvable: '+op.key;break;}
        const v=pickNum(op,'valeur','montant','value','amount');
        const lbl=pickStr(op,'label','nom');
        const ch={};
        if (v!==null){ ch.valeur={avant:ep.valeur,apres:v}; ep.valeur=v; }
        if (lbl!==null){ ch.label={avant:ep.nom||ep.label,apres:lbl}; ep.nom=lbl; ep.label=lbl; }
        if (!Object.keys(ch).length){log.status='error';log.reason='aucun champ fourni';break;}
        log.cible=ep.nom||ep.label;log.changes=ch;break;
      }
      case 'add_epargne_exception': {
        // v20.90 : Modulation mensuelle d'une epargne (Vue.js v17.99 lignes 6477/6631 appliquent moisDebut<=mNum<=moisFin)
        if (!y){log.status='error';log.reason='année absente';break;}
        if (y.epargne && !Array.isArray(y.epargne)) y.epargne = Object.entries(y.epargne).map(([k,v]) => ({...v, id: (v && v.id) || k}));
        if (!Array.isArray(y.epargne) || !y.epargne.length){log.status='error';log.reason='Aucune epargne dans cette annee — cree-la d abord avec action=add category=epargne';break;}
        const normKey=String(op.key||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
        const ep=y.epargne.find(e=>e&&(String(e.id)===String(op.key)||'ep_'+e.id===op.key||String(e.nom||e.label||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(normKey)));
        if (!ep){log.status='error';log.reason='Epargne introuvable: '+op.key;break;}
        const mD=Number(op.moisDebut); const mF=Number(op.moisFin); const nv=Number(op.nouvelleValeur);
        if (!(mD>=1 && mD<=12)){log.status='error';log.reason='moisDebut invalide (1-12 requis)';break;}
        if (!(mF>=mD && mF<=12)){log.status='error';log.reason='moisFin invalide (>=moisDebut, <=12)';break;}
        if (!Number.isFinite(nv)){log.status='error';log.reason='nouvelleValeur manquante ou invalide';break;}
        if (!Array.isArray(ep.exceptions)) ep.exceptions=[];
        const xid=Date.now()+Math.floor(Math.random()*1000);
        ep.exceptions.push({id:xid, moisDebut:mD, moisFin:mF, nouvelleValeur:nv});
        ep.showExceptions=true;
        log.cible=ep.nom||ep.label; log.id=xid; log.exception={moisDebut:mD,moisFin:mF,nouvelleValeur:nv}; break;
      }
      case 'remove_epargne_exception': {
        if (!y){log.status='error';log.reason='année absente';break;}
        if (y.epargne && !Array.isArray(y.epargne)) y.epargne = Object.entries(y.epargne).map(([k,v]) => ({...v, id: (v && v.id) || k}));
        if (!Array.isArray(y.epargne)){log.status='error';log.reason='aucune epargne';break;}
        const normKey=String(op.key||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
        const ep=y.epargne.find(e=>e&&(String(e.id)===String(op.key)||'ep_'+e.id===op.key||String(e.nom||e.label||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(normKey)));
        if (!ep || !Array.isArray(ep.exceptions)){log.status='error';log.reason='epargne ou exceptions introuvable';break;}
        const idx=ep.exceptions.findIndex(x=>String(x.id)===String(op.id));
        if (idx===-1){log.status='error';log.reason='exception id introuvable: '+op.id;break;}
        ep.exceptions.splice(idx,1);
        if (!ep.exceptions.length) ep.showExceptions=false;
        log.cible=ep.nom||ep.label; log.removed_id=op.id; break;
      }
      // ── DÉPENSES PONCTUELLES ──────────────────────────
      case 'add_depense_ponctuelle': {
        if (!y){log.status='skip';log.reason='année absente';break;}
        if (!Array.isArray(y.depensesIrregulieres)) y.depensesIrregulieres=[];
        const v=pickNum(op,'montant','valeur','value','amount');
        if (v===null){log.status='error';log.reason='montant requis';break;}
        const id=Date.now()+Math.floor(Math.random()*1000);
        y.depensesIrregulieres.push({id,mois:Number(op.mois),annee:a,nom:pickStr(op,'nom','label')||'Dépense',montant:v,paye:false,montantPaye:0});
        log.id=id;log.nom=op.nom;log.montant=v;break;
      }
      case 'remove_depense_ponctuelle': {
        if (!y||!Array.isArray(y.depensesIrregulieres)){log.status='skip';log.reason='année absente';break;}
        const before=y.depensesIrregulieres.length;
        y.depensesIrregulieres=y.depensesIrregulieres.filter(d=>{
          if (op.id!=null&&Number(d.id)===Number(op.id)) return false;
          if (op.nom!=null&&String(d.nom).toLowerCase().trim()===String(op.nom).toLowerCase().trim()) return false;
          return true;
        });
        log.supprimees=before-y.depensesIrregulieres.length;break;
      }
      case 'update_depense_ponctuelle': {
        if (!y||!Array.isArray(y.depensesIrregulieres)){log.status='skip';log.reason='année absente';break;}
        const t=y.depensesIrregulieres.find(d=>Number(d.id)===Number(op.id));
        if (!t){log.status='skip';log.reason='id introuvable';break;}
        const v=pickNum(op,'montant','valeur','value','amount'); const ch={};
        if (v!==null){ch.montant={avant:t.montant,apres:v};t.montant=v;}
        if (op.mois!=null){ch.mois={avant:t.mois,apres:Number(op.mois)};t.mois=Number(op.mois);}
        if (op.nom!=null){ch.nom={avant:t.nom,apres:String(op.nom)};t.nom=String(op.nom);}
        purgeKeys(t,SYN_NUM_DEPENSE);
        if (!Object.keys(ch).length){log.status='error';log.reason='aucun champ fourni';break;}
        log.id=op.id;log.changes=ch;break;
      }
      // ── SOLDES INITIAUX ────────────────────────────────
      case 'set_solde_initial': {
        if (!fd.soldesInitiaux) fd.soldesInitiaux={};
        const allowed=['courant','urgence','lt','bourse','moisActuel','anneeActuelle','semainesRestantes'];
        if (!allowed.includes(op.key)){log.status='error';log.reason='clé non autorisée. Autorisées: '+allowed.join(', ');break;}
        const v=pickNum(op,'valeur','montant','value','amount');
        if (v===null){log.status='error';log.reason='valeur manquante';break;}
        const old=fd.soldesInitiaux[op.key];fd.soldesInitiaux[op.key]=v;
        log.key=op.key;log.avant=old;log.apres=v;break;
      }
      // ── ANNÉES ────────────────────────────────────────
      case 'clone_annee': {
        const src=fd.donneesAnnuelles&&fd.donneesAnnuelles[op.depuis];
        if (!src){log.status='skip';log.reason='année source absente';break;}
        if (fd.donneesAnnuelles[op.vers]){log.status='skip';log.reason='année cible existe déjà';break;}
        const cloned=JSON.parse(JSON.stringify(src));
        Object.values(cloned.chargesFixes||{}).forEach(f=>{f.paye=false;f.montantPaye=0;});
        Object.values(cloned.chargesVariables||{}).forEach(c=>{if(c.details)c.details.forEach(d=>{d.paye=false;d.montantPaye=0;});});
        (cloned.depensesIrregulieres||[]).forEach(d=>{d.paye=false;d.montantPaye=0;d.annee=Number(op.vers);d.id=Date.now()+Math.floor(Math.random()*1000);});
        fd.donneesAnnuelles[op.vers]=cloned;
        log.depuis=op.depuis;log.vers=op.vers;log.created=true;break;
      }
      case 'delete_annee': {
        if (!fd.donneesAnnuelles[op.annee]){log.status='skip';log.reason='année absente';break;}
        delete fd.donneesAnnuelles[op.annee];log.annee=op.annee;log.removed=true;break;
      }
      // ── PROJET STUDIO ──────────────────────────────────
      case 'set_projet_studio': {
        if (!y){log.status='skip';log.reason='année absente';break;}
        if (!y.projetStudio) y.projetStudio={};
        const allowed=['prixM2','surface','avance','taux','duree','taxSyndic','taxCouvertCredit','surplusCredit','assuranceMensuelle','travaux','epargneDispo'];
        if (!allowed.includes(op.key)){log.status='error';log.reason='champ non autorisé. Autorisés: '+allowed.join(', ');break;}
        const v=pickNum(op,'valeur','montant','value','amount');
        if (v===null){log.status='error';log.reason='valeur manquante';break;}
        const old=y.projetStudio[op.key];y.projetStudio[op.key]=v;
        log.key=op.key;log.avant=old;log.apres=v;break;
      }
      // ── COMPTES BANCAIRES (BILAN) ──────────────────────
      case 'create_compte': {
        if (!fd.comptes) fd.comptes = [];
        const newId = String(op.label||'compte').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]/g,'_');
        if (fd.comptes.find(c => c.id === newId)) { log.status='error'; log.reason='Compte avec cet id existe déjà: '+newId; break; }
        fd.comptes.push({ id: newId, label: String(op.label), solde: Number(op.montant) || 0 });
        log.status='success'; log.action='Creation compte'; log.compte=op.label; log.solde=op.montant; break;
      }
      case 'update_compte': {
        if (!fd.comptes || !fd.comptes.length) { log.status='error'; log.reason='Aucun compte existant'; break; }
        const normKey = String(op.key||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
        const c = fd.comptes.find(x => x.id === normKey || String(x.label).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').includes(normKey));
        if (!c) { log.status='error'; log.reason='Compte introuvable: '+op.key; break; }
        const oldVal = c.solde;
        c.solde += Number(op.montant);
        log.status='success'; log.action='Mise a jour compte'; log.compte=c.label; log.avant=oldVal; log.apres=c.solde; break;
      }
      // ── WEALTH : OBJECTIFS & ACTIFS (top-level fd.*) ───
      case 'update_objectif': {
        if (!Array.isArray(fd.wealthGoals)) fd.wealthGoals = [];
        const normKey = String(op.key||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
        const goal = fd.wealthGoals.find(x => String(x.name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').includes(normKey));
        if (!goal) {
          // Upsert : objectif introuvable → création automatique (même comportement que create_objectif)
          const newGoal = { name: String(op.key || 'Nouvel objectif'), target: 10000, current: Number(op.montant) || 0 };
          fd.wealthGoals.push(newGoal);
          log.status='success'; log.action='Upsert objectif (creation auto)'; log.cible=newGoal.name; log.target=newGoal.target; log.current=newGoal.current; break;
        }
        const oldVal = Number(goal.current) || 0;
        goal.current = oldVal + (Number(op.montant) || 0);
        log.status='success'; log.action='Mise a jour objectif (incremental)'; log.cible=goal.name; log.avant=oldVal; log.apres=goal.current; break;
      }
      case 'create_objectif': {
        // v20.70 : Création d'un nouveau Smart Goal (wealthGoals[])
        // Schéma Vue.js attendu : { name, target, current }
        if (!Array.isArray(fd.wealthGoals)) fd.wealthGoals = [];
        const goalName = String(op.name || 'Nouvel objectif').trim();
        // Éviter les doublons exacts (même nom normalisé)
        const normNew = goalName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
        const exists = fd.wealthGoals.find(x => String(x.name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim() === normNew);
        if (exists) {
          // Objectif déjà existant : on incrémente current au lieu de dupliquer
          const oldVal = Number(exists.current) || 0;
          exists.current = oldVal + (Number(op.current) || 0);
          log.status='success'; log.action='Objectif existant — current incremente'; log.cible=exists.name; log.avant=oldVal; log.apres=exists.current; break;
        }
        const newGoal = {
          name: goalName,
          target: Number(op.target_amount) > 0 ? Number(op.target_amount) : 10000,
          current: Number(op.current) || 0
        };
        fd.wealthGoals.push(newGoal);
        log.status='success'; log.action='Creation objectif'; log.cible=newGoal.name; log.target=newGoal.target; log.current=newGoal.current; break;
      }
      // ── MASTER ASSET ENGINE v17.0 (unifié productif + foncier) ──
      case 'update_master_asset':
      case 'update_actif':
      case 'update_foncier': {
        if (!Array.isArray(fd.masterAssets) || !fd.masterAssets.length) { log.status='error'; log.reason='Aucun actif dans masterAssets'; break; }
        const normKey = String(op.key||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
        const asset = fd.masterAssets.find(x => String(x.name||x.nom||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').includes(normKey));
        if (!asset) { log.status='error'; log.reason='Actif introuvable dans masterAssets: '+op.key; break; }
        const changes = {};
        const scenarioMap = { conservateur: 'value', pessimiste: 'val_pessimiste', optimiste: 'val_optimiste' };
        if (op.scenario) {
          // Mode foncier : mise à jour d un scénario spécifique
          const normScen = String(op.scenario).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
          const fieldName = scenarioMap[normScen];
          if (!fieldName) { log.status='error'; log.reason='Scenario invalide (conservateur|pessimiste|optimiste): '+op.scenario; break; }
          const oldVal = Number(asset[fieldName]) || 0;
          asset[fieldName] = Number(op.montant) || 0;
          changes[fieldName] = { avant: oldVal, apres: asset[fieldName] };
        } else if (op.montant !== undefined && op.montant !== null) {
          // Mode productif : mise à jour de la valeur principale
          const oldVal = Number(asset.value) || 0;
          asset.value = Number(op.montant) || 0;
          changes.value = { avant: oldVal, apres: asset.value };
        }
        if (op.taux_credit !== undefined) { const old = asset.taux_credit; asset.taux_credit = Number(op.taux_credit) || 0; changes.taux_credit = { avant: old, apres: asset.taux_credit }; }
        if (op.annees_total !== undefined) { const old = asset.annees_total; asset.annees_total = Number(op.annees_total) || 0; changes.annees_total = { avant: old, apres: asset.annees_total }; }
        if (op.annees_restantes !== undefined) { const old = asset.annees_restantes; asset.annees_restantes = Number(op.annees_restantes) || 0; changes.annees_restantes = { avant: old, apres: asset.annees_restantes }; }
        if (op.apport_personnel !== undefined) { const old = asset.apport_personnel||0; asset.apport_personnel = Number(op.apport_personnel) || 0; changes.apport_personnel = { avant: old, apres: asset.apport_personnel }; }
        if (op.montant_credit !== undefined) { const old = asset.montant_credit||0; asset.montant_credit = Number(op.montant_credit) || 0; changes.montant_credit = { avant: old, apres: asset.montant_credit }; }
        if (op.valeur_actuelle !== undefined) { const old = asset.valeur_actuelle||0; asset.valeur_actuelle = Number(op.valeur_actuelle) || 0; changes.valeur_actuelle = { avant: old, apres: asset.valeur_actuelle }; }
        if (!Object.keys(changes).length) { log.status='error'; log.reason='Aucun champ fourni'; break; }
        log.status='success'; log.action='Update master asset'; log.cible=asset.name; log.changes=changes; break;
      }
      default:
        log.status='error'; log.reason='type inconnu: '+op.type;
    }
  } catch(e){ log.status='error'; log.reason=e.message; }
  return log;
}

export function compileJS(calls, fd, monthlyNetFromPayload) {
  financeData = fd;
  const _ctx = { financeData: fd, computeReliquat, computeMonthlyNetCourant, monthlyNetFromPayload: monthlyNetFromPayload || null, currentYear: _CY };
  let changes = [];
  for (const call of calls) {
    const fn = call.function, args = call.args || {};
    if (!fn || !FUNCTION_CATALOG[fn]) return { status:'error', error:'ERROR_OUT_OF_CATALOG',
      message: "L'action demandée n'existe pas dans le catalogue. Demande à l'utilisateur de faire développer cette fonction.",
      function_demandee: fn, catalogue: Object.keys(FUNCTION_CATALOG), pending_saved: false };
    const produced = FUNCTION_CATALOG[fn](args, _ctx) || [];
    for (const p of produced) changes.push(p);
  }
  const sanitize_pre = sanitizeFinanceData(financeData);


// ── Phase 1 : résolution de toutes les entités (avant toute mutation) ──
const resolvedChanges = []; // { change, resolvedKey, resolvedCat, years, ops_to_apply }
const clarifications = [];

for (const change of changes) {
  const { action, category, target, years: rawYears } = change;
  const years = Array.isArray(rawYears) ? rawYears.map(Number) : [Number(rawYears || new Date().getFullYear())];

  const NEEDS_RESOLVE = ['modify', 'remove', 'rename', 'add_exception', 'remove_exception'];
  let resolvedKey = null, resolvedCat = category;

  if (NEEDS_RESOLVE.includes(action) && target && category && !['depense_ponctuelle','annee','solde','studio','compte','objectif','actif','foncier'].includes(category)) {
    const res = resolveEntity(target, category, financeData);
    if (!res.resolved) {
      clarifications.push({ change_index: changes.indexOf(change), target, category, action, error: res.error, ambiguous: res.ambiguous || false, choices: res.choices || null });
      continue;
    }
    resolvedKey = res.key; resolvedCat = res.category;
  }

  resolvedChanges.push({ change, resolvedKey, resolvedCat, years });
}

// Si des clarifications sont nécessaires : retour immédiat sans mutation
if (clarifications.length > 0) {
  return ({
    status: 'needs_clarification',
    clarifications_needed: clarifications,
    pending_saved: false,
    hint: "Pose ces questions à l'utilisateur avant de relancer propose_changes."
  });
}

// ── Phase 2a : auto-création des années manquantes (clone depuis la plus proche) ──
const allYears = [...new Set(resolvedChanges.flatMap(rc => rc.years))].sort((a,b)=>a-b);
const autoCloned = [];
for (const yr of allYears) {
  if (!financeData.donneesAnnuelles[yr]) {
    const existing = Object.keys(financeData.donneesAnnuelles).map(Number).sort((a,b)=>a-b);
    if (existing.length) {
      const src = existing.reduce((best,e) => Math.abs(e-yr) < Math.abs(best-yr) ? e : best, existing[0]);
      const cloned = JSON.parse(JSON.stringify(financeData.donneesAnnuelles[src]));
      Object.values(cloned.chargesFixes||{}).forEach(f=>{f.paye=false;f.montantPaye=0;});
      Object.values(cloned.chargesVariables||{}).forEach(c=>{if(c.details)c.details.forEach(d=>{d.paye=false;d.montantPaye=0;});});
      (cloned.depensesIrregulieres||[]).forEach(d=>{d.paye=false;d.montantPaye=0;d.annee=yr;d.id=Date.now()+Math.floor(Math.random()*1000);});
      financeData.donneesAnnuelles[yr] = cloned;
      autoCloned.push({ annee: yr, cloned_from: src });
    }
  }
}

// ── Phase 2b : snapshot "avant" par année ──
const snapshotBefore = {};
for (const yr of allYears) snapshotBefore[yr] = snapshot(financeData, yr);

// ── Phase 3 : construction et application des ops ──
const allOpsLog = [];

for (const { change, resolvedKey, resolvedCat, years } of resolvedChanges) {
  for (const annee of years) {
    const ops = buildOps(change, resolvedKey, resolvedCat, annee);
    if (!ops || !ops.length) {
      allOpsLog.push({ annee, op: { type: 'n/a', action: change.action, category: resolvedCat }, log: { status: 'error', reason: 'Action "' + change.action + '" non supportée pour "' + resolvedCat + '"' } });
      continue;
    }
    for (const op of ops) {
      const opLog = applyOp(financeData, op, annee);
      allOpsLog.push({ annee, op, log: opLog });
    }
  }
}

// ── Phase 4 : snapshot "après" + delta ──
const resultsByYear = {};
for (const yr of allYears) {
  const before = snapshotBefore[yr], after = snapshot(financeData, yr);
  resultsByYear[yr] = {
    avant: before, apres: after,
    delta: (before && after) ? { revenus: after.revenus-before.revenus, fixes: after.fixes-before.fixes, variables: after.variables-before.variables, epargne: after.epargne-before.epargne } : null
  };
}

const sanitize_post = sanitizeFinanceData(financeData);

const successOps = allOpsLog.filter(o => o.log.status !== 'error' && o.log.status !== 'skip');
const errorOps   = allOpsLog.filter(o => o.log.status === 'error');
const skipOps    = allOpsLog.filter(o => o.log.status === 'skip');
const redistributionRequired = allOpsLog.filter(o => o.log.requires_redistribution).map(o => o.log);

const totalDirt = Object.values(sanitize_pre).reduce((s,v)=>s+v,0) + Object.values(sanitize_post).reduce((s,v)=>s+v,0);
const hasErrors = errorOps.length > 0;
const hasEffective = (successOps.length > 0 && !hasErrors) || (totalDirt > 0 && !hasErrors);
const valid = !!(financeData.donneesAnnuelles && financeData.soldesInitiaux);
  return {
    status: hasErrors ? 'partial_error' : 'ok',
    ops_summary: { total: allOpsLog.length, success: successOps.length, errors: errorOps.length, skipped: skipOps.length },
    resultats_par_annee: resultsByYear,
    error_ops: hasErrors ? errorOps.map(o=>({ op:o.op.type, key:o.op.key, annee:o.annee, reason:o.log.reason })) : null,
    redistribution_required: redistributionRequired.length ? redistributionRequired : null,
    auto_cloned_years: autoCloned.length ? autoCloned : null,
    sanitize_report: { pre: sanitize_pre, post: sanitize_post, total_purged: totalDirt },
    warning: hasErrors ? 'Des opérations ont échoué — pending NON sauvegardé. Vérifiez error_ops.' : null,
    _financeData: financeData
  };
}
