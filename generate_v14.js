#!/usr/bin/env node
// ════════════════════════════════════════════════════════
// Générateur v14.0 — Super-Agent CFO
// Transforme super_agent_cfo.json (v13.26) → v14.0
// Architecture NLU → Compiler → Apply
// ════════════════════════════════════════════════════════

const fs = require('fs');

const j = JSON.parse(fs.readFileSync('super_agent_cfo.json', 'utf8'));

// ── 1. Nom du workflow ──────────────────────────────────
j.name = 'Super-Agent CFO v14.0';

// ── 2. Tool description exposée à Gemini ───────────────
const INTENT_COMPILER_DESCRIPTION = `Simulateur budgétaire intelligent. Appelle cet outil pour simuler ET sauvegarder toute modification budgétaire demandée par l'utilisateur.

PARAMÈTRE UNIQUE :
{
  "changes": [
    {
      "action": "modify | add | remove | rename | add_exception | remove_exception | update_one_off | clone_year | set_balance | set_studio",
      "category": "revenu | charge_fixe | charge_variable | epargne | depense_ponctuelle | solde | studio | annee | compte | objectif | actif",
      "target": "libellé humain de la ligne ex: alimentation, loyer, salaire (l outil résout le mapping clé technique via fuzzy match)",
      "amount": 1000,
      "label": "Nouvel intitulé (si création ou renommage)",
      "period": "mois | semaine",
      "years": [2026],
      "month": 6,
      "exception_start": 1,
      "exception_end": 4,
      "exception_value": 0,
      "exception_id": 1234567890,
      "clone_from_year": 2026,
      "studio_key": "travaux",
      "balance_key": "courant",
      "one_off_id": 1234567890,
      "sub_target": "Nom exact de la sous-catégorie ou détail (ex: psy, essence, internet) si la modification cible une ligne précise à l intérieur d une catégorie.",
      "notes": "citation utilisateur (optionnel)"
    }
  ]
}

RÈGLES :
• years : TOUJOURS un tableau, même pour une année : [2026]. Batch multi-années : [2026, 2027].
• target : le nom humain tel que l utilisateur l a mentionné. N invente JAMAIS de clé technique.
• L outil retourne pending_saved=true si la simulation est prête : tu peux proposer OUI à l utilisateur.
• Si clarifications_needed non vide : pose les questions à l utilisateur, n invente PAS de réponse.
• Si error_ops non vide : explique le problème, NE PROPOSE PAS OUI.
• category "compte" : agit sur les comptes bancaires du bilan. action "add" crée un compte (fournir "label" et "amount" pour le solde initial). action "modify" ajuste le solde d un compte (fournir "target" = label du compte et "amount" à AJOUTER ou SOUSTRAIRE — valeur NÉGATIVE pour un retrait ou transfert sortant).
• category "objectif" : action "modify" pour AJOUTER des fonds à un objectif financier (fournir "target" = nom du projet, ex: "Paris", "Jlilou" ; "amount" = montant à AJOUTER à la valeur actuelle, donc INCREMENTAL).
• category "actif" : action "modify" pour réévaluer la valorisation d un actif (immobilier, bourse). Fournir "target" = nom de l actif et "amount" = NOUVELLE VALEUR TOTALE (remplace, ne s ajoute pas).`;

// ── 3. JS code du Intent Compiler ──────────────────────
const INTENT_COMPILER_CODE = `// ════════════════════════════════════════════════════════
// INTENT COMPILER v1.0 — Super-Agent CFO v14.0
// Architecture NLU -> Compiler -> Apply
//
// Interface Gemini (simple, sans types techniques) :
//   { "changes": [{ action, category, target, amount, years, ... }] }
//
// Pipeline interne :
//   1. Parse input (multi-strategy)
//   2. Valide et résout chaque change (fuzzy match target -> key)
//   3. Si clarification nécessaire : retourne sans appliquer
//   4. Capture snapshot "avant" par année
//   5. Construit les ops canoniques et les applique inline
//   6. Capture snapshot "après" et calcule delta
//   7. Sauvegarde pending_commit
// ════════════════════════════════════════════════════════

const TOOL_NAME = 'propose_changes';

// ── Multi-strategy parser (défense en profondeur) ──────
let input = {};
let _parseStrategy = 'none';
let _rawQuery = null;
const _strategiesAttempted = [];

try {
  if (typeof query !== 'undefined' && query !== null) {
    _rawQuery = typeof query === 'string' ? query : JSON.stringify(query);
  }
} catch (e) { _rawQuery = '<unstringifiable>'; }

if (typeof query !== 'undefined' && query !== null) {
  if (typeof query === 'object') {
    input = Object.assign({}, query);
    _parseStrategy = 'object_direct';
  } else if (typeof query === 'string') {
    const trimmed = query.trim();
    _strategiesAttempted.push('A:json_parse');
    try {
      const parsedA = JSON.parse(trimmed);
      if (parsedA && typeof parsedA === 'object' && !Array.isArray(parsedA)) {
        input = parsedA; _parseStrategy = 'A:json_object';
      }
    } catch (eA) {}
    if (_parseStrategy === 'none' && trimmed) {
      _strategiesAttempted.push('B:embedded_json');
      const m = trimmed.match(/\\{[\\s\\S]*\\}/);
      if (m) {
        try {
          const parsedB = JSON.parse(m[0]);
          if (parsedB && typeof parsedB === 'object' && !Array.isArray(parsedB)) {
            input = parsedB; _parseStrategy = 'B:json_embedded';
          }
        } catch (eB) {}
      }
    }
  }
}

// kwargs TDZ-safe
try { if (typeof changes !== 'undefined' && input.changes === undefined) input.changes = changes; } catch(e) {}

if (!input.changes || !Array.isArray(input.changes) || !input.changes.length) {
  return JSON.stringify({
    error: 'Paramètre "changes" manquant ou vide. Format : { "changes": [{ action, category, target, years, ... }] }',
    diagnostic: { tool: TOOL_NAME, raw_query: _rawQuery, parse_strategy: _parseStrategy, strategies_attempted: _strategiesAttempted }
  });
}

// ── Contexte ──────────────────────────────────────────
let normalized;
try { normalized = $('Build Agent Input').first().json; }
catch (e) {
  try { normalized = $('Normalize Input').first().json; }
  catch (e2) { return JSON.stringify({ error: 'Contexte introuvable (Build Agent Input / Normalize Input)' }); }
}
const session_id = normalized.session_id;
const financeData = normalized.finance_data ? JSON.parse(JSON.stringify(normalized.finance_data)) : null;
if (!financeData) return JSON.stringify({ error: 'finance_data absent. Recharge l\\'interface web.' });

// ════════════════════════════════════════════════════════
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
    for (const k in (y.epargne || {})) {
      const o = y.epargne[k]; if (!o) continue;
      if (o.valeur == null) { const rv = pickNum(o, 'montant', 'value', 'amount'); if (rv !== null) o.valeur = rv; }
      if (o.label == null && o.nom) o.label = String(o.nom);
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
    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
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
      const pool = y[POOL_MAP[cat]] || {};
      for (const key in pool) {
        const dk = cat + ':' + key;
        if (seen.has(dk)) continue; seen.add(dk);
        const item = pool[key];
        const lbl = item.label || key;
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
  const safeTarget = String(target || newLabel || 'nouvelle_ligne').replace(/\\s+/g, '_').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
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
        case 'actif':          return [{ type: 'update_actif', key: change.target_key || target, montant: amt }];
        default: return null;
      }
    case 'add':
      switch (resolvedCat) {
        case 'revenu':          return [{ type: 'add_revenu',         key: baseKey, label: newLabel || target, base: amt || 0 }];
        case 'charge_fixe':     return [{ type: 'add_charge_fixe',    key: baseKey, label: newLabel || target, valeur: amt || 0 }];
        case 'charge_variable': return [{ type: 'add_charge_variable',key: baseKey, label: newLabel || target, valeur: amt || 0, periode: period || 'mois' }];
        case 'epargne':         return [{ type: 'add_epargne',        key: baseKey, label: newLabel || target, valeur: amt || 0 }];
        case 'depense_ponctuelle': return [{ type: 'add_depense_ponctuelle', annee, mois: month || 1, nom: newLabel || target, montant: amt || 0 }];
        case 'compte':         return [{ type: 'create_compte', label: newLabel || target, montant: amt || 0 }];
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
        default: return null;
      }
    case 'remove_exception':
      switch (resolvedCat) {
        case 'revenu':      return [{ type: 'remove_revenu_exception',     key: resolvedKey, id: exception_id }];
        case 'charge_fixe': return [{ type: 'remove_charge_fixe_exception',key: resolvedKey, id: exception_id }];
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
        const normStrOp = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim();
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
      case 'set_epargne': {
        if (!y || !y.epargne || !y.epargne[op.key]) { log.status='skip'; log.reason='clé absente'; break; }
        const v=pickNum(op,'valeur','montant','value','amount');
        if (v===null){log.status='error';log.reason='valeur manquante';break;}
        const old=y.epargne[op.key].valeur; writeEpargne(y.epargne[op.key],v,null);
        log.key=op.key;log.avant=old;log.apres=v;break;
      }
      case 'add_epargne': {
        if (!y){log.status='skip';log.reason='année absente';break;}
        if (!y.epargne) y.epargne={};
        if (y.epargne[op.key]){log.status='skip';log.reason='clé existe déjà';break;}
        const v=pickNum(op,'valeur','montant','value','amount')??0;
        const lbl=pickStr(op,'label','nom')||op.key;
        y.epargne[op.key]={label:lbl,valeur:v};
        log.key=op.key;log.created=true;log.valeur=v;break;
      }
      case 'remove_epargne': {
        if (!y||!y.epargne||!y.epargne[op.key]){log.status='skip';log.reason='clé absente';break;}
        delete y.epargne[op.key];log.key=op.key;log.removed=true;break;
      }
      case 'update_epargne': {
        if (!y||!y.epargne||!y.epargne[op.key]){log.status='skip';log.reason='clé absente';break;}
        const v=pickNum(op,'valeur','montant','value','amount');
        const lbl=pickStr(op,'label','nom');
        const t=y.epargne[op.key]; const ch={};
        if (v!==null) ch.valeur={avant:t.valeur,apres:v};
        if (lbl!==null) ch.label={avant:t.label,apres:lbl};
        if (!Object.keys(ch).length){log.status='error';log.reason='aucun champ fourni';break;}
        writeEpargne(t,v,lbl);log.key=op.key;log.changes=ch;break;
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
        if (!Array.isArray(fd.wealthGoals) || !fd.wealthGoals.length) { log.status='error'; log.reason='Aucun objectif existant'; break; }
        const normKey = String(op.key||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
        const goal = fd.wealthGoals.find(x => String(x.name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').includes(normKey));
        if (!goal) { log.status='error'; log.reason='Objectif introuvable: '+op.key; break; }
        const oldVal = Number(goal.current) || 0;
        goal.current = oldVal + (Number(op.montant) || 0);
        log.status='success'; log.action='Mise a jour objectif (incremental)'; log.cible=goal.name; log.avant=oldVal; log.apres=goal.current; break;
      }
      case 'update_actif': {
        if (!Array.isArray(fd.wealthAssets) || !fd.wealthAssets.length) { log.status='error'; log.reason='Aucun actif existant'; break; }
        const normKey = String(op.key||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
        const asset = fd.wealthAssets.find(x => String(x.name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').includes(normKey));
        if (!asset) { log.status='error'; log.reason='Actif introuvable: '+op.key; break; }
        const oldVal = Number(asset.value) || 0;
        asset.value = Number(op.montant) || 0;
        log.status='success'; log.action='Reevaluation actif (replacement)'; log.cible=asset.name; log.avant=oldVal; log.apres=asset.value; break;
      }
      default:
        log.status='error'; log.reason='type inconnu: '+op.type;
    }
  } catch(e){ log.status='error'; log.reason=e.message; }
  return log;
}

// ════════════════════════════════════════════════════════
// ORCHESTRATION PRINCIPALE
// ════════════════════════════════════════════════════════

const sanitize_pre = sanitizeFinanceData(financeData);
const changes = input.changes;

// ── Phase 1 : résolution de toutes les entités (avant toute mutation) ──
const resolvedChanges = []; // { change, resolvedKey, resolvedCat, years, ops_to_apply }
const clarifications = [];

for (const change of changes) {
  const { action, category, target, years: rawYears } = change;
  const years = Array.isArray(rawYears) ? rawYears.map(Number) : [Number(rawYears || new Date().getFullYear())];

  const NEEDS_RESOLVE = ['modify', 'remove', 'rename', 'add_exception', 'remove_exception'];
  let resolvedKey = null, resolvedCat = category;

  if (NEEDS_RESOLVE.includes(action) && target && category && !['depense_ponctuelle','annee','solde','studio','compte','objectif','actif'].includes(category)) {
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
  return JSON.stringify({
    status: 'needs_clarification',
    clarifications_needed: clarifications,
    pending_saved: false,
    hint: 'Pose ces questions à l\\'utilisateur avant de relancer propose_changes.'
  }, null, 2);
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

// ── Phase 5 : sauvegarde pending ──
let pending_saved = false, pending_error = null;
if (valid && hasEffective && session_id) {
  const anneePayload = allYears.length === 1 ? allYears[0] : allYears;
  try {
    const resp = await this.helpers.httpRequest({
      method: 'POST',
      url: 'https://n8n.beau.ink/finance/pending_commit.php',
      body: { session_id, annee: anneePayload, operations: allOpsLog.map(o=>o.op), finance_data: financeData },
      json: true, timeout: 10000
    });
    pending_saved = !!(resp && resp.status === 'ok');
  } catch (e) { pending_error = e.message; }
}

return JSON.stringify({
  status: hasErrors ? 'partial_error' : 'ok',
  ops_summary: { total: allOpsLog.length, success: successOps.length, errors: errorOps.length, skipped: skipOps.length },
  resultats_par_annee: resultsByYear,
  error_ops: hasErrors ? errorOps.map(o=>({ op: o.op.type, key: o.op.key, annee: o.annee, reason: o.log.reason })) : null,
  redistribution_required: redistributionRequired.length ? redistributionRequired : null,
  auto_cloned_years: autoCloned.length ? autoCloned : null,
  sanitize_report: { pre: sanitize_pre, post: sanitize_post, total_purged: totalDirt },
  pending_saved, pending_error,
  warning: hasErrors ? 'Des opérations ont échoué — pending NON sauvegardé. Vérifiez error_ops.' : null
}, null, 2);`;

// ── 4. Nouveau system prompt (~70 lignes) ───────────────
const NEW_SYSTEM_PROMPT = `Tu es le CFO personnel IA de Mohamed, responsable du pilotage budgétaire et stratégique du foyer (Maroc, devise DH).

═══ 1. LA HIÉRARCHIE DE LA VÉRITÉ (RÈGLE ABSOLUE) ═══
En cas de conflit d'information, respecte cet ordre :
  • NIVEAU 1 (La Loi)            : les instructions explicites de l'utilisateur dans le message actuel.
  • NIVEAU 2 (Le Contexte Métier): les règles issues de la base vectorielle (outil finance_rag).
  • NIVEAU 3 (La Donnée Brute)   : le fichier JSON (CONTEXTE FINANCIER).
  • NIVEAU 4 (Dernier Recours)   : ton savoir général d'IA. À utiliser pour conseiller, JAMAIS pour contredire les niveaux 1, 2 et 3.

═══ 2. POLITIQUE ANTI-DÉRIVE SÉMANTIQUE ═══
Ne déduis JAMAIS la fréquence d'un flux financier à partir de son nom (ex: "Bonification", "Prime", "Allocation"). Si le JSON a la même structure qu'un salaire (champ base, periode='mois' ou absente), c'est mensuel. Si ce n'est pas écrit explicitement "annuel", c'est mensuel. Aucune interprétation libre du label.

═══ 3. UTILISATION STRICTE DES OUTILS ═══
  • finance_rag     → règle métier passée, OU SYSTÉMATIQUEMENT avant de commenter loyer/studio/revenu locatif.
  • propose_changes → UNIQUE outil pour SIMULER ou MODIFIER un poste budgétaire.
  • committer       → UNIQUEMENT si l'utilisateur répond "OUI" / "ok" / "valide" / "go" ET qu'une simulation a été présentée au tour précédent.
  • memory_writer   → UNIQUEMENT sur formulation explicite : "retiens que…", "mémorise…", "souviens-toi que…".

Pour tout le reste (analyse, diagnostic, projection, calcul) : lis directement le CONTEXTE FINANCIER JSON. Aucun outil.

═══ 4. RÈGLES MÉTIER : PROJET STUDIO & AIRBNB ═══
AVANT de commenter le studio / loyer / revenu locatif : appelle finance_rag avec "stratégie studio exploitation" ET "directive revenu locatif".
Si une directive Airbnb est trouvée :
  • Applique : RevenuNet = prix_nuit × jours_mois × taux_occupation × 0,825 − frais_fixes_mensuels
  • Taux d'occupation : 65 % (basse) / 85 % (haute saison). Présente TOUJOURS les deux scénarios.
  • Mentionne : "calcul basé sur la directive Airbnb mémorisée".
  • Compare avec le scénario bail classique.

═══ 5. WORKFLOW DE MODIFICATION (OBLIGATOIRE) ═══
Tour 1 — Simulation :
  1. Appelle propose_changes avec { "changes": [{ action, category, target, amount, years, ... }] }.
  2. Si clarifications_needed, error_ops ou redistribution_required non vide → gère l'erreur / pose la question. NE propose PAS OUI.
  3. Si pending_saved=true → présente le delta en HTML et termine EXACTEMENT par :
     « <b>Confirmez-vous ? Tapez <span style="color:#059669">OUI</span> pour exécuter.</b> »
  4. Si auto_cloned_years non vide → mentionne que les années ont été auto-créées (ex: « Années 2027-2029 créées automatiquement à partir de 2026 »).
  5. INTERDICTION ABSOLUE : demander OUI sans avoir reçu pending_saved=true au tour courant.

Tour 2 — Commit :
  1. Si message utilisateur = "OUI" / "ok" / "valide" / "go" → appelle committer avec { "confirmation": "OUI" } et RIEN d'autre.
  2. L'outil récupère seul la simulation en cache (pending_commit.php).
  3. Si status=ok et committed=true → confirme en HTML avec la liste des opérations.
  4. Si erreur "simulation en attente" → cache expirée (>30 min). Demande de reformuler la modification.

═══ 6. FORMAT & QUALITÉ ═══
FORMAT HTML BRUT OBLIGATOIRE. Markdown strictement INTERDIT (pas de **gras**, *italique*, ###titres, - listes, \`\`\`code\`\`\`, [lien](url)).
AUTORISÉ : <b>, <br>, <ul><li>…</li></ul>, <span style="color:#059669"> (vert), <span style="color:#dc2626"> (rouge), <hr>.
Montants : espaces insécables (ex: « 12 500 DH »), jamais de virgule milliers.
QUALITÉ : 3 paragraphes minimum par diagnostic. Priorise les chiffres sur les opinions. Cite la source (CONTEXTE FINANCIER). N'invente jamais un chiffre. Ne tronque jamais.

═══ MEMORY WRITER ═══
Déclencheurs valides : "retiens que…", "mémorise pour toujours…", "souviens-toi que…".
Appelle avec { texte: "...", categorie: "preference|regle|contexte|general" }.
En cas d'erreur : affiche le JSON d'erreur verbatim dans un <pre>. Ne paraphrase pas l'erreur.

═══ HISTORIQUE ═══
Les 8 derniers échanges (texte brut, sans tool calls) sont injectés en haut du message. Pas de mémoire LangChain automatique. Base-toi UNIQUEMENT sur ce bloc + la QUESTION ACTUELLE.

═══ OBJECTIF ═══
Analyses denses et 3+ recommandations chiffrées par tour, HTML brut conforme à la Hiérarchie de la Vérité.

═══ 7. TRANSPARENCE DE LA RECHERCHE WEB ═══
Outil disponible : web_search. Utilise cet outil UNIQUEMENT en Fallback (quand les niveaux 1-3 de la Hiérarchie de la Vérité ne suffisent pas). Si tu utilises le web, déclare-le explicitement : « <b>Source : Recherche Internet.</b> » avant de citer le résultat.

═══ 8. GESTION DES COMPTES BANCAIRES (BILAN) ═══
Tu peux créer et modifier les comptes bancaires de l utilisateur via propose_changes avec category="compte".
• Créer un compte : action="add", category="compte", label="Nom du compte", amount=solde_initial.
• Modifier le solde d un compte : action="modify", category="compte", target="Nom ou label du compte", amount=valeur_à_ajouter (négatif pour retrait).
• TRANSFERT ENTRE COMPTES : génère DEUX changements distincts dans le même appel propose_changes :
  1. { action:"modify", category:"compte", target:"Compte Source", amount:-X } — débit du compte source.
  2. { action:"modify", category:"compte", target:"Compte Cible", amount:+X } — crédit du compte cible.
  Ne génère JAMAIS un seul changement pour un transfert. Les deux opérations sont atomiques et présentées ensemble dans la simulation.

═══ 9. GESTION DU PATRIMOINE (WEALTH GOALS & ASSETS) ═══
Tu peux mettre à jour les jauges des objectifs financiers (Smart Goals) et réévaluer la valeur des actifs productifs (immobilier, bourse) du tab Wealth.

• OBJECTIF (category="objectif") — opération INCRÉMENTALE (ajoute des fonds à la cagnotte) :
  Format : { action:"modify", category:"objectif", target:"Nom du projet", amount:+X }
  Exemple : "j ai mis 5000 DH de plus sur le voyage Paris" → { action:"modify", category:"objectif", target:"Paris", amount:5000 }
  Le moteur exécute : goal.current += amount (pas de remplacement).

• ACTIF (category="actif") — opération de RÉÉVALUATION (remplace la valeur totale) :
  Format : { action:"modify", category:"actif", target:"Nom de l actif", amount:NOUVELLE_VALEUR_TOTALE }
  Exemple : "le local de Bouskoura est maintenant estimé à 1.3M" → { action:"modify", category:"actif", target:"Bouskoura", amount:1300000 }
  Le moteur exécute : asset.value = amount (remplacement complet, pas d ajout).

DISTINCTION CRITIQUE : Si l utilisateur dit "ajoute X" / "j ai épargné X de plus" → OBJECTIF (incrémental). Si il dit "vaut maintenant X" / "réévalué à X" / "estimation actuelle X" → ACTIF (remplacement). En cas de doute, demande une clarification.`;

// ── 5. Construction du nœud Intent Compiler ────────────
const intentCompilerNode = {
  id: 'node-tool-intent',
  name: 'Tool: Intent Compiler',
  type: '@n8n/n8n-nodes-langchain.toolCode',
  typeVersion: 1.2,
  position: [320, 460],
  parameters: {
    name: 'propose_changes',
    description: INTENT_COMPILER_DESCRIPTION,
    language: 'javaScript',
    jsCode: INTENT_COMPILER_CODE
  }
};

// Déduplique avant push (idempotent sur re-runs)
j.nodes = j.nodes.filter(n => n.id !== 'node-tool-intent' && n.id !== 'node-tool-tavily');
j.nodes.push(intentCompilerNode);

// ── 5b. Nœud web_search (Custom Code Tool — pas de credential requis) ──────────────────────────
const tavilyNode = {
  id: 'node-tool-tavily',
  name: 'web_search',
  type: '@n8n/n8n-nodes-langchain.toolCode',
  typeVersion: 1.2,
  position: [320, 600],
  parameters: {
    name: 'web_search',
    description: 'Utilise cet outil UNIQUEMENT en Fallback pour chercher sur Internet (cours de bourse, actualités, prix immobilier). Reçoit la requête en paramètre.',
    language: 'javaScript',
    jsCode: `const searchQuery = typeof query !== 'undefined' ? query : (typeof input !== 'undefined' ? input : '');
const apiKey = "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";
try {
  const response = await this.helpers.httpRequest({
    method: 'POST',
    url: 'https://api.tavily.com/search',
    headers: { 'Content-Type': 'application/json' },
    body: { api_key: apiKey, query: searchQuery, search_depth: "basic", include_answer: true }
  });
  return response.answer || JSON.stringify(response.results);
} catch (e) {
  return "Erreur lors de la recherche web : " + e.message;
}`
  }
};
j.nodes.push(tavilyNode);

// ── 6. Mise à jour du system prompt de l'AI Agent ──────
const agentNode = j.nodes.find(n => n.id === 'node-agent');
if (!agentNode) { console.error('ERREUR : nœud node-agent introuvable'); process.exit(1); }
agentNode.parameters.options.systemMessage = NEW_SYSTEM_PROMPT;

// ── 7. Mise à jour des connexions ──────────────────────
// Déconnecte Budget Engine (gardé dans le workflow pour rollback, mais dormant)
delete j.connections['Tool: Budget Engine'];

// Branche Intent Compiler sur l'AI Agent
j.connections['Tool: Intent Compiler'] = {
  ai_tool: [[ { node: 'AI Agent', type: 'ai_tool', index: 0 } ]]
};

// Branche Tavily sur l'AI Agent
j.connections['web_search'] = {
  ai_tool: [[ { node: 'AI Agent', type: 'ai_tool', index: 0 } ]]
};

// ── 8. Sauvegarde ──────────────────────────────────────
const output = JSON.stringify(j, null, 2);
fs.writeFileSync('super_agent_cfo.json', output);

const stats = {
  workflow_name: j.name,
  nodes_count: j.nodes.length,
  connections_count: Object.keys(j.connections).length,
  intent_compiler_added: j.nodes.some(n => n.id === 'node-tool-intent'),
  budget_engine_disconnected: !j.connections['Tool: Budget Engine'],
  system_prompt_lines: NEW_SYSTEM_PROMPT.split('\\n').length,
  system_prompt_chars: NEW_SYSTEM_PROMPT.length,
  intent_compiler_code_lines: INTENT_COMPILER_CODE.split('\\n').length,
  file_size_kb: Math.round(output.length / 1024)
};
console.log('✅ v14.0 générée avec succès');
console.log(JSON.stringify(stats, null, 2));
