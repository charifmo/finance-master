#!/usr/bin/env python3
# patch_v13_21.py — Super-Agent CFO v13.21
# CHANTIER 1 : Bouclier Anti-Crash (retryOnFail + Format for Telegram error shield)
# CHANTIER 2 : Budget Engine batch processing (annee accept int OR array)

import json, sys, copy

SRC  = "D:/Users/mohamed_benabad/finance-master/super_agent_cfo.json"
DEST = "D:/Users/mohamed_benabad/finance-master/super_agent_cfo.json"

with open(SRC, "r", encoding="utf-8") as f:
    wf = json.load(f)

# ═══════════════════════════════════════════════════════════════════════
# CHANTIER 1a — AI Agent : retryOnFail
# ═══════════════════════════════════════════════════════════════════════
agent_patched = False
for node in wf["nodes"]:
    if node.get("id") == "node-agent":
        node["retryOnFail"]      = True
        node["maxTries"]         = 3
        node["waitBetweenTries"] = 1000
        agent_patched = True
        break
assert agent_patched, "node-agent introuvable"
print("[OK] CHANTIER 1a — retryOnFail ajouté à AI Agent")

# ═══════════════════════════════════════════════════════════════════════
# CHANTIER 1b — Format for Telegram : bouclier anti-crash
# ═══════════════════════════════════════════════════════════════════════
FORMAT_TELEGRAM_CODE = r"""// ════════════════════════════════════════════════════════
// FORMAT FOR TELEGRAM v13.21 — Bouclier Anti-Crash
// • Si l'agent a crashé (json.error présent) ou output vide → alerte système
// • Sinon : convertit HTML riche → texte Telegram (parse_mode=HTML)
// Telegram supporte uniquement : <b>, <i>, <u>, <s>, <code>, <pre>, <a>
// ════════════════════════════════════════════════════════
let html = '';
let isError = false;
let errorDetail = '';

try {
  const agentOut = $('AI Agent').first().json;

  if (agentOut.error) {
    // Agent a planté : continueOnFail a capturé l'exception
    isError = true;
    errorDetail = typeof agentOut.error === 'string'
      ? agentOut.error
      : (agentOut.error.message || JSON.stringify(agentOut.error));
  } else {
    html = agentOut.output || agentOut.text || agentOut.response || '';
    if (!html) {
      isError = true;
      errorDetail = 'Aucune réponse générée (output vide après continueOnFail).';
    }
  }
} catch (e) {
  isError = true;
  errorDetail = e.message || 'Exception lors de la lecture de la sortie agent.';
}

// Alerte Telegram formatée si crash
if (isError) {
  const safeDetail = errorDetail.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return [{
    json: {
      telegram_text: `⚠️ <b>Alerte Système (Super-Agent CFO)</b>\nUne exception a empêché l’exécution correcte de la commande.\n<b>Détail technique :</b> <code>${safeDetail}</code>`,
      chat_id: $('Telegram Trigger').first().json.message.chat.id
    }
  }];
}

if (typeof html !== 'string') html = String(html);

const text = html
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
  .replace(/<\/?p[^>]*>/gi, '')
  .replace(/<\/li>/gi, '\n')
  .replace(/<li[^>]*>/gi, '• ')
  .replace(/<\/?ul[^>]*>/gi, '\n')
  .replace(/<\/?ol[^>]*>/gi, '\n')
  .replace(/<hr\s*\/?>/gi, '\n———\n')
  .replace(/<\/?span[^>]*>/gi, '')
  .replace(/<\/?div[^>]*>/gi, '\n')
  .replace(/<strong>/gi, '<b>').replace(/<\/strong>/gi, '</b>')
  .replace(/<em>/gi, '<i>').replace(/<\/em>/gi, '</i>')
  .replace(/<(?!\\/?(b|i|u|s|code|pre|a)\b)[^>]+>/gi, '')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/\n{3,}/g, '\n\n')
  .trim();

return [{
  json: {
    telegram_text: text,
    chat_id: $('Telegram Trigger').first().json.message.chat.id
  }
}];"""

fmt_patched = False
for node in wf["nodes"]:
    if node.get("id") == "node-format-telegram":
        node["parameters"]["jsCode"] = FORMAT_TELEGRAM_CODE
        fmt_patched = True
        break
assert fmt_patched, "node-format-telegram introuvable"
print("[OK] CHANTIER 1b — Format for Telegram bouclier anti-crash appliqué")

# ═══════════════════════════════════════════════════════════════════════
# CHANTIER 2a — Budget Engine description : note CRITICAL batch
# ═══════════════════════════════════════════════════════════════════════
BATCH_NOTE = """
═══ CRITICAL v13.21 — BATCH MULTI-ANNÉES ═══
Si tu dois appliquer la même opération sur plusieurs années :
  NE FAIS PAS plusieurs appels séparés — utilise UNE SEULE fois budget_engine
  avec le champ annee en TABLEAU :

    { "annee": [2026, 2027, 2028], "operations": [...] }

L’outil itère en interne sur chaque année et retourne un résultat consolidé
avec la clé par_annee (un bloc résultat par année) + ops_summary_total global.
"""

budget_desc_patched = False
for node in wf["nodes"]:
    if node.get("id") == "node-tool-budget":
        old_desc = node["parameters"].get("description", "")
        if "CRITICAL v13.21" not in old_desc:
            node["parameters"]["description"] = BATCH_NOTE.strip() + "\n\n" + old_desc
        budget_desc_patched = True
        break
assert budget_desc_patched, "node-tool-budget introuvable (description)"
print("[OK] CHANTIER 2a — Budget Engine description mise à jour (CRITICAL batch note)")

# ═══════════════════════════════════════════════════════════════════════
# CHANTIER 2b — Budget Engine jsCode : annee int OR array + batch loop
# ═══════════════════════════════════════════════════════════════════════
# Remplacements ciblés dans le jsCode existant

OLD_ANNEE_LINE = "const anneeTarget = Number(input.annee) || new Date().getFullYear();"
NEW_ANNEE_LINE = "const annees = Array.isArray(input.annee) ? input.annee.map(Number) : [Number(input.annee) || new Date().getFullYear()];\nconst isBatch = annees.length > 1;"

# Le bloc d'exécution à remplacer (de "const before = snapshot" jusqu'à la fin du return)
OLD_EXEC_BLOCK = """const before = snapshot(financeData, anneeTarget);
const log = [];
for (const op of operations) {
  log.push(applyOp(financeData, op, anneeTarget));
}

// ⚠️ PASSE 2 : sanitize globale APRÈS les ops (filet de sécurité)
const sanitize_report_post = sanitizeFinanceData(financeData);

const after = snapshot(financeData, anneeTarget);

const valid = financeData.donneesAnnuelles && typeof financeData.donneesAnnuelles === 'object' &&
              financeData.soldesInitiaux && typeof financeData.soldesInitiaux === 'object';

const successCount = log.filter(l => l.status !== 'skip' && l.status !== 'error').length;
const errorCount   = log.filter(l => l.status === 'error').length;
const skipCount    = log.filter(l => l.status === 'skip').length;

const totalDirtPurged = Object.values(sanitize_report_pre).reduce((s, n) => s + n, 0)
                     + Object.values(sanitize_report_post).reduce((s, n) => s + n, 0);

// Si AUCUN op réussi MAIS du dirt a été nettoyé → on cache quand même la sanitize
// pour que le user puisse valider le nettoyage
const hasEffectiveChanges = (successCount > 0 && errorCount === 0) || (totalDirtPurged > 0 && errorCount === 0);

let pending_saved = false;
let pending_error = null;
if (simulate && valid && hasEffectiveChanges && session_id) {
  try {
    const resp = await this.helpers.httpRequest({
      method: 'POST',
      url: 'https://n8n.beau.ink/finance/pending_commit.php',
      body: { session_id, annee: anneeTarget, operations, finance_data: financeData },
      json: true,
      timeout: 10000
    });
    pending_saved = !!(resp && resp.status === 'ok');
  } catch (e) {
    pending_error = e.message;
  }
}

return JSON.stringify({
  mode: simulate ? 'SIMULATION' : 'APPLY',
  valid,
  annee: anneeTarget,
  avant: before,
  apres: after,
  delta: before && after ? {
    revenus: after.revenus - before.revenus,
    fixes: after.fixes - before.fixes,
    variables: after.variables - before.variables,
    epargne: after.epargne - before.epargne
  } : null,
  ops_summary: { total: operations.length, success: successCount, errors: errorCount, skipped: skipCount },
  operations_appliquees: log,
  sanitize_report: {
    pre_ops: sanitize_report_pre,
    post_ops: sanitize_report_post,
    total_keys_purged: totalDirtPurged
  },
  pending_saved,
  pending_error,
  pending_session_id: session_id || null,
  warning: errorCount > 0 ? "Au moins une opération a échoué — pending NON sauvegardé. Vérifie operations_appliquees, corrige et relance." : null,
  redistribution_required: log.some(l => l.requires_redistribution) ? log.filter(l => l.requires_redistribution) : null
}, null, 2);"""

NEW_EXEC_BLOCK = """// ═══ v13.21 : BATCH MULTI-ANNÉES ═══
const resultsByYear = {};
let allLogs = [];

for (const anneeTarget of annees) {
  const before = snapshot(financeData, anneeTarget);
  const log = [];
  for (const op of operations) {
    log.push(applyOp(financeData, op, anneeTarget));
  }
  const after = snapshot(financeData, anneeTarget);
  const sc = log.filter(l => l.status !== 'skip' && l.status !== 'error').length;
  const ec = log.filter(l => l.status === 'error').length;
  const sk = log.filter(l => l.status === 'skip').length;
  resultsByYear[anneeTarget] = {
    avant: before,
    apres: after,
    delta: before && after ? {
      revenus: after.revenus - before.revenus,
      fixes: after.fixes - before.fixes,
      variables: after.variables - before.variables,
      epargne: after.epargne - before.epargne
    } : null,
    ops_summary: { total: operations.length, success: sc, errors: ec, skipped: sk },
    operations_appliquees: log
  };
  allLogs = allLogs.concat(log);
}

// ⚠️ PASSE 2 : sanitize globale APRÈS toutes les ops (filet de sécurité)
const sanitize_report_post = sanitizeFinanceData(financeData);

const valid = financeData.donneesAnnuelles && typeof financeData.donneesAnnuelles === 'object' &&
              financeData.soldesInitiaux && typeof financeData.soldesInitiaux === 'object';

const successCount = allLogs.filter(l => l.status !== 'skip' && l.status !== 'error').length;
const errorCount   = allLogs.filter(l => l.status === 'error').length;
const skipCount    = allLogs.filter(l => l.status === 'skip').length;

const totalDirtPurged = Object.values(sanitize_report_pre).reduce((s, n) => s + n, 0)
                     + Object.values(sanitize_report_post).reduce((s, n) => s + n, 0);

// Si AUCUN op réussi MAIS du dirt a été nettoyé → on cache quand même la sanitize
const hasEffectiveChanges = (successCount > 0 && errorCount === 0) || (totalDirtPurged > 0 && errorCount === 0);

let pending_saved = false;
let pending_error = null;
if (simulate && valid && hasEffectiveChanges && session_id) {
  try {
    const resp = await this.helpers.httpRequest({
      method: 'POST',
      url: 'https://n8n.beau.ink/finance/pending_commit.php',
      body: {
        session_id,
        annee: isBatch ? annees : annees[0],
        operations,
        finance_data: financeData
      },
      json: true,
      timeout: 10000
    });
    pending_saved = !!(resp && resp.status === 'ok');
  } catch (e) {
    pending_error = e.message;
  }
}

// Retour consolidé : batch vs single-year (même interface backward-compat)
const firstYear = annees[0];
return JSON.stringify(isBatch ? {
  mode: simulate ? 'SIMULATION' : 'APPLY',
  valid,
  annees,
  batch: true,
  par_annee: resultsByYear,
  ops_summary_total: {
    total: operations.length * annees.length,
    success: successCount,
    errors: errorCount,
    skipped: skipCount
  },
  sanitize_report: {
    pre_ops: sanitize_report_pre,
    post_ops: sanitize_report_post,
    total_keys_purged: totalDirtPurged
  },
  pending_saved,
  pending_error,
  pending_session_id: session_id || null,
  warning: errorCount > 0 ? "Au moins une opération a échoué — pending NON sauvegardé. Vérifie par_annee, corrige et relance." : null,
  redistribution_required: allLogs.some(l => l.requires_redistribution) ? allLogs.filter(l => l.requires_redistribution) : null
} : {
  mode: simulate ? 'SIMULATION' : 'APPLY',
  valid,
  annee: firstYear,
  avant: resultsByYear[firstYear].avant,
  apres: resultsByYear[firstYear].apres,
  delta: resultsByYear[firstYear].delta,
  ops_summary: resultsByYear[firstYear].ops_summary,
  operations_appliquees: resultsByYear[firstYear].operations_appliquees,
  sanitize_report: {
    pre_ops: sanitize_report_pre,
    post_ops: sanitize_report_post,
    total_keys_purged: totalDirtPurged
  },
  pending_saved,
  pending_error,
  pending_session_id: session_id || null,
  warning: errorCount > 0 ? "Au moins une opération a échoué — pending NON sauvegardé. Vérifie operations_appliquees, corrige et relance." : null,
  redistribution_required: allLogs.some(l => l.requires_redistribution) ? allLogs.filter(l => l.requires_redistribution) : null
}, null, 2);"""

budget_code_patched = False
for node in wf["nodes"]:
    if node.get("id") == "node-tool-budget":
        code = node["parameters"]["jsCode"]
        # Patch 1 : anneeTarget → annees
        if OLD_ANNEE_LINE not in code:
            print(f"[WARN] OLD_ANNEE_LINE not found in jsCode. Current start: {repr(code[780:900])}")
        else:
            code = code.replace(OLD_ANNEE_LINE, NEW_ANNEE_LINE, 1)
            print("[OK] CHANTIER 2b — anneeTarget remplacé par annees/isBatch")

        # Patch 2 : exec block → batch loop
        if OLD_EXEC_BLOCK not in code:
            print("[WARN] OLD_EXEC_BLOCK not found verbatim — trying whitespace-normalized match")
            # Try to find the key anchor points
            import re
            anchor = "const before = snapshot(financeData, anneeTarget);"
            if anchor in code:
                idx = code.find(anchor)
                print(f"[INFO] Found anchor at index {idx}, replacing from there to end")
                code = code[:idx] + NEW_EXEC_BLOCK
                budget_code_patched = True
            else:
                print("[ERROR] Cannot find exec block anchor — manual intervention required")
        else:
            code = code.replace(OLD_EXEC_BLOCK, NEW_EXEC_BLOCK, 1)
            budget_code_patched = True
            print("[OK] CHANTIER 2b — Exec block remplacé par batch loop")

        node["parameters"]["jsCode"] = code
        break

# ═══════════════════════════════════════════════════════════════════════
# Mise à jour du nom du workflow
# ═══════════════════════════════════════════════════════════════════════
wf["name"] = "Super-Agent CFO v13.21"

# ═══════════════════════════════════════════════════════════════════════
# Ecriture du fichier (avant les prints pour eviter crash cp1252)
# ═══════════════════════════════════════════════════════════════════════
with open(DEST, "w", encoding="utf-8") as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)

print("[OK] Workflow renomme -> Super-Agent CFO v13.21")
print("\n[DONE] super_agent_cfo.json v13.21 ecrit avec succes.")
print("  CHANTIER 1 : retryOnFail(3) sur AI Agent + bouclier crash sur Format for Telegram")
print("  CHANTIER 2 : Budget Engine annee int|array + batch loop multi-annees")
