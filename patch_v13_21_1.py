#!/usr/bin/env python3
# patch_v13_21_1.py — Hotfix v13.21.1
# ═══════════════════════════════════════════════════════════════
# DIAGNOSTIC :
#   Dans patch_v13_21.py, FORMAT_TELEGRAM_CODE était un raw string r"""...""".
#   La ligne problématique :
#     .replace(/<(?!\\/?(b|i|u|s|code|pre|a)\b)[^>]+>/gi, '')
#   Dans le raw string Python, \\ = DEUX backslashes (raw = pas de traitement).
#   Chaîne d'encodage :
#     Python raw value  \\/  (2 backslashes + /)
#     json.dump       → \\\\/  dans le JSON
#     n8n JSON parse  → JS source \\/
#     Dans le littéral regex JS  /<(?!\\/:
#       \\  = backslash escapé (1 \ dans le pattern)
#       /   = TERMINE le littéral regex !
#     Pattern résultant = <(?!\  avec ( non fermé → "Unterminated group"
#
# FIX :
#   1. Écriture en Python string non-raw (backslashes explicitement doublés).
#   2. Le pattern complexe avec / utilise new RegExp() au lieu d'un littéral,
#      éliminant définitivement tout risque de terminaison prématurée.
#   3. Validation anti-bug intégrée au script.
#   4. Remplacement du template literal (backticks) par concaténation simple.
# ═══════════════════════════════════════════════════════════════

import json, sys

SRC  = "D:/Users/mohamed_benabad/finance-master/super_agent_cfo.json"
DEST = "D:/Users/mohamed_benabad/finance-master/super_agent_cfo.json"

with open(SRC, "r", encoding="utf-8") as f:
    wf = json.load(f)

# ─── Construction du jsCode ligne par ligne ─────────────────────────────────
# Règles d'encodage (Python string non-raw → JSON → JS source) :
#   Pour \n dans JS string literal  → Python "\n" (newline Python) ou "\\n"
#     (on veut \n en JS source pour produire newline → Python "\\n" → JSON \\n → JS \n)
#   Pour \s dans regex literal JS   → Python "\\s"
#   Pour \b word-boundary dans new RegExp() :
#     JS source doit avoir \\b (2 chars: backslash + b dans le source)
#     Python value doit avoir 2 backslashes + b = "\\\\"+"b" ou "\\\\b"
#     → json.dump → "\\\\b" → n8n reads → JS source \\b → string literal '\\b'
#     → string value = 1 backslash + b → RegExp word boundary ✓
#   Pour /? dans new RegExp() (pas littéral) → juste "/?" sans backslash
# ────────────────────────────────────────────────────────────────────────────

NEWLINE = "\\n"   # dans le source JS, \n = newline

# Pattern pour new RegExp() : strip les balises non-Telegram
# JS source : '<(?!/?(?:b|i|u|s|code|pre|a)\\b)[^>]+>'
# Python value : 2 backslashes + b pour \b en JS source (word boundary en RegExp)
REGEXP_PATTERN = "<(?!/?(?:b|i|u|s|code|pre|a)" + "\\\\" + "b)[^>]+>"

# Vérification round-trip : après json.dump + json.load, on retrouve la même valeur
import json as _json
_j = _json.dumps(REGEXP_PATTERN)
_back = _json.loads(_j)
assert _back == REGEXP_PATTERN, f"Round-trip FAIL: {repr(_back)} != {repr(REGEXP_PATTERN)}"

# Vérification : pas de double-backslash devant / dans un contexte littéral regex
# (signe du bug original). Dans new RegExp(), c'est OK d'avoir \\/,
# mais on n'en a pas car on utilise /? (sans backslash).
assert "\\\\/" not in REGEXP_PATTERN, "BUG: double-backslash+slash detecte dans le pattern"
print("[OK] Validation pattern RegExp : round-trip OK, pas de double-backslash+slash")

# ─── Code complet du noeud ───────────────────────────────────────────────────
lines = [
    "// ════════════════════════════════════════════════════════",
    "// FORMAT FOR TELEGRAM v13.21.1 — Hotfix Unterminated group",
    "// HOTFIX root cause : raw string Python introduisait 2 backslashes",
    "//   devant / dans le litteral regex -> / terminait le litteral",
    "//   -> pattern (<(?!\\\\ non ferme -> Unterminated group.",
    "// Fix : new RegExp() pour le pattern strip-tags (pas de litteral regex /.../).",
    "// ════════════════════════════════════════════════════════",
    "let html = '';",
    "let isError = false;",
    "let errorDetail = '';",
    "",
    "try {",
    "  const agentOut = $('AI Agent').first().json;",
    "  if (agentOut.error) {",
    "    isError = true;",
    "    errorDetail = typeof agentOut.error === 'string'",
    "      ? agentOut.error",
    "      : (agentOut.error.message || JSON.stringify(agentOut.error));",
    "  } else {",
    "    html = agentOut.output || agentOut.text || agentOut.response || '';",
    "    if (!html) {",
    "      isError = true;",
    "      errorDetail = 'Aucune réponse générée (output vide après continueOnFail).';",
    "    }",
    "  }",
    "} catch (e) {",
    "  isError = true;",
    "  errorDetail = e.message || 'Exception lors de la lecture de la sortie agent.';",
    "}",
    "",
    "if (isError) {",
    "  const safeDetail = String(errorDetail)",
    "    .replace(/&/g, '&amp;')",
    "    .replace(/</g, '&lt;')",
    "    .replace(/>/g, '&gt;');",
    "  return [{",
    "    json: {",
    "      telegram_text: '\\u26a0\\ufe0f <b>Alerte Syst\\u00e8me (Super-Agent CFO)</b>\\n'",
    "        + 'Une exception a emp\\u00each\\u00e9 l\\'ex\\u00e9cution correcte de la commande.\\n'",
    "        + '<b>D\\u00e9tail technique :</b> <code>' + safeDetail + '</code>',",
    "      chat_id: $('Telegram Trigger').first().json.message.chat.id",
    "    }",
    "  }];",
    "}",
    "",
    "if (typeof html !== 'string') html = String(html);",
    "",
    "// Regex pre-compilée hors littéral pour éviter le bug de terminaison /",
    "// JS source : '<(?!/?(?:b|i|u|s|code|pre|a)\\\\b)[^>]+>'",
    "// Dans le string literal JS, \\\\b = string value \\b = RegExp word boundary",
    "const STRIP_TAGS = new RegExp('" + REGEXP_PATTERN + "', 'gi');",
    "",
    "const text = html",
    "  .replace(/<br\\s*\\/?>/gi, '\\n')",
    "  .replace(/<\\/p>\\s*<p[^>]*>/gi, '\\n\\n')",
    "  .replace(/<\\/?p[^>]*>/gi, '')",
    "  .replace(/<\\/li>/gi, '\\n')",
    "  .replace(/<li[^>]*>/gi, '\\u2022 ')",
    "  .replace(/<\\/?ul[^>]*>/gi, '\\n')",
    "  .replace(/<\\/?ol[^>]*>/gi, '\\n')",
    "  .replace(/<hr\\s*\\/?>/gi, '\\n\\u2014\\u2014\\u2014\\n')",
    "  .replace(/<\\/?span[^>]*>/gi, '')",
    "  .replace(/<\\/?div[^>]*>/gi, '\\n')",
    "  .replace(/<strong>/gi, '<b>').replace(/<\\/strong>/gi, '</b>')",
    "  .replace(/<em>/gi, '<i>').replace(/<\\/em>/gi, '</i>')",
    "  .replace(STRIP_TAGS, '')",
    "  .replace(/&nbsp;/g, ' ')",
    "  .replace(/&amp;/g, '&')",
    "  .replace(/&lt;/g, '<')",
    "  .replace(/&gt;/g, '>')",
    "  .replace(/&quot;/g, '\"')",
    "  .replace(/&#39;/g, \"'\")",
    "  .replace(/\\n{3,}/g, '\\n\\n')",
    "  .trim();",
    "",
    "return [{",
    "  json: {",
    "    telegram_text: text,",
    "    chat_id: $('Telegram Trigger').first().json.message.chat.id",
    "  }",
    "}];",
]

FORMAT_TELEGRAM_CODE = "\n".join(lines)

# ─── Vérifications finales sur le code complet ──────────────────────────────
assert "new RegExp(" in FORMAT_TELEGRAM_CODE, "MISSING: new RegExp() absent du code"
assert "STRIP_TAGS" in FORMAT_TELEGRAM_CODE, "MISSING: variable STRIP_TAGS absente"

# Vérifier qu'il n'y a PAS de littéral regex contenant \\/ (le bug original)
# (le seul endroit où /.../ est OK ici est pour /&/g etc., qui ne contiennent pas \\/)
import re as _re
# Cherche un littéral /...\\\/.../ (double-backslash suivi de slash DANS un littéral)
bug_pattern = _re.compile(r'/[^/]*\\\\/')
regex_literals_with_bug = bug_pattern.findall(FORMAT_TELEGRAM_CODE)
assert not regex_literals_with_bug, f"BUG: littéral regex avec \\\\/ trouvé: {regex_literals_with_bug}"
print("[OK] Validation finale : aucun littéral regex avec double-backslash+slash")

# ─── Injection dans le workflow ──────────────────────────────────────────────
patched = False
for node in wf["nodes"]:
    if node.get("id") == "node-format-telegram":
        node["parameters"]["jsCode"] = FORMAT_TELEGRAM_CODE
        patched = True
        break

assert patched, "node-format-telegram introuvable dans le workflow"
print("[OK] node-format-telegram patche")

wf["name"] = "Super-Agent CFO v13.21.1"

with open(DEST, "w", encoding="utf-8") as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)

print("[OK] Workflow renomme -> Super-Agent CFO v13.21.1")
print()
print("[DONE] super_agent_cfo.json v13.21.1 ecrit.")
print("  HOTFIX : Unterminated group resolu")
print("  ROOT CAUSE : raw string Python + \\\\/ dans litteral regex")
print("               -> terminaison prematuree -> groupe ouvert non ferme")
print("  FIX : new RegExp() pre-compilee + Python string non-raw")
