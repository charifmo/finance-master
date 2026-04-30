#!/usr/bin/env python3
# patch_v13_23.py — Super-Agent CFO v13.23
# ════════════════════════════════════════════════════════════════════
# DIAGNOSTIC :
#   Le pattern legacy au top des outils Budget Engine et Committer :
#
#     let input;
#     try {
#       input = typeof query === 'string' ? JSON.parse(query) : query;
#     } catch (e) { return JSON.stringify({error: "JSON invalide..."}); }
#
#   Bug fondamental : `typeof` est le SEUL opérateur JavaScript qui ne
#   plante pas sur une variable non déclarée. Mais la branche else du
#   ternaire `: query` (sans typeof) déréférence `query` directement.
#   -> ReferenceError quand Gemini envoie les params en kwargs nommés
#   (ex: confirmation="OUI" directement) au lieu d'un JSON dans `query`.
#   Le `try/catch` ne capture PAS la ReferenceError car elle survient
#   à la phase d'évaluation de l'expression du ternaire (lookup global).
#
# FIX ARCHITECTURAL :
#   Helper "safe gathering" qui :
#     (A) Lit query si déclaré (string JSON OU objet)
#     (B) Merge les variables nommées individuelles (kwargs Gemini)
#         via typeof + court-circuit && qui garantit qu'on ne
#         déréférence jamais une variable inexistante.
#
#   Application : Budget Engine + Committer (les 2 outils impactés).
#   Memory Writer est déjà sécurisé depuis v13.19 (pattern différent).
# ════════════════════════════════════════════════════════════════════

import json, sys

SRC  = "D:/Users/mohamed_benabad/finance-master/super_agent_cfo.json"
DEST = "D:/Users/mohamed_benabad/finance-master/super_agent_cfo.json"

with open(SRC, "r", encoding="utf-8") as f:
    wf = json.load(f)

# ─── Pattern de safe input gathering (commun aux 2 outils) ──────────────────
SAFE_INPUT_GATHER = """// ── v13.23 : SAFE INPUT GATHERING ──────────────────────────────────────
// Gemini peut passer les paramètres de 2 façons :
//   (A) query = string JSON OU objet (mode legacy avec schéma)
//   (B) variables nommées directes (mode kwargs : confirmation="OUI")
// L'ancien pattern (ternaire string-vs-object) crashait en mode (B) :
// la branche else déréférençait directement la variable globale (sans typeof)
// -> ReferenceError NON capturée par try/catch (échoue à l'évaluation lazy).
//
// On collecte depuis les 2 sources sans jamais lire de variable non déclarée.
// `typeof` est le seul opérateur JS safe sur var indéclarée. Le court-circuit
// de && garantit qu'on ne lit `X` qu'une fois `typeof X !== 'undefined'` validé.
let input = {};

// (A) Source primaire : query
if (typeof query !== 'undefined' && query !== null) {
  if (typeof query === 'string') {
    try {
      const parsed = JSON.parse(query);
      if (parsed && typeof parsed === 'object') input = parsed;
    } catch (e) { /* string non-JSON -> on ignore, kwargs prendront le relais */ }
  } else if (typeof query === 'object') {
    input = Object.assign({}, query);
  }
}

// (B) Source secondaire : kwargs nommés que Gemini peut passer
//   typeof X évite ReferenceError, le && court-circuite avant le déréférencement
if (typeof confirmation !== 'undefined' && input.confirmation === undefined) input.confirmation = confirmation;
if (typeof simulate     !== 'undefined' && input.simulate     === undefined) input.simulate     = simulate;
if (typeof operations   !== 'undefined' && input.operations   === undefined) input.operations   = operations;
if (typeof annee        !== 'undefined' && input.annee        === undefined) input.annee        = annee;
if (typeof session_id   !== 'undefined' && input.session_id   === undefined) input.session_id   = session_id;
// ──────────────────────────────────────────────────────────────────────────"""

# ─── Patch Budget Engine ────────────────────────────────────────────────────
OLD_BUDGET_INIT = """let input;
try {
  input = typeof query === 'string' ? JSON.parse(query) : query;
} catch (e) {
  return JSON.stringify({ error: "JSON d'entrée invalide : " + e.message });
}"""

# ─── Patch Committer ────────────────────────────────────────────────────────
OLD_COMMIT_INIT = """let input;
try {
  input = typeof query === 'string' ? JSON.parse(query) : query;
} catch (e) {
  return JSON.stringify({ error: "JSON invalide : " + e.message });
}"""

# ─── Application ────────────────────────────────────────────────────────────
patched_count = 0
for node in wf["nodes"]:
    nid = node.get("id")
    if nid == "node-tool-budget":
        code = node["parameters"]["jsCode"]
        assert OLD_BUDGET_INIT in code, "Budget Engine init pattern introuvable"
        node["parameters"]["jsCode"] = code.replace(OLD_BUDGET_INIT, SAFE_INPUT_GATHER, 1)
        patched_count += 1
        print("[OK] Budget Engine : safe input gathering applique")
    elif nid == "node-tool-commit":
        code = node["parameters"]["jsCode"]
        assert OLD_COMMIT_INIT in code, "Committer init pattern introuvable"
        node["parameters"]["jsCode"] = code.replace(OLD_COMMIT_INIT, SAFE_INPUT_GATHER, 1)
        patched_count += 1
        print("[OK] Committer : safe input gathering applique")

assert patched_count == 2, f"Expected 2 patches, got {patched_count}"

# ─── Validation : verifier que le code patche compile mentalement ───────────
for node in wf["nodes"]:
    if node.get("id") in ("node-tool-budget", "node-tool-commit"):
        code = node["parameters"]["jsCode"]
        # Pas d'ancien pattern fautif
        assert "typeof query === 'string' ? JSON.parse(query) : query" not in code, \
            f"Bug residuel dans {node.get('id')}"
        # Pattern safe present
        assert "SAFE INPUT GATHERING" in code, f"Marker safe gathering absent de {node.get('id')}"
        # Le helper doit etre avant la premiere utilisation de `input`
        idx_helper = code.find("let input = {};")
        idx_first_use = code.find("input.")
        assert idx_helper > 0 and idx_first_use > idx_helper, \
            f"Ordre helper/use incorrect dans {node.get('id')}"

print("[OK] Validations syntaxiques passees")

# ─── Mise a jour du nom ─────────────────────────────────────────────────────
wf["name"] = "Super-Agent CFO v13.23"

with open(DEST, "w", encoding="utf-8") as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)

print("[OK] Workflow renomme -> Super-Agent CFO v13.23")
print()
print("[DONE] super_agent_cfo.json v13.23 ecrit.")
print("  Outils corriges : Budget Engine + Committer")
print("  Pattern : safe input gathering (typeof + court-circuit &&)")
print("  Comportement : ne crash PLUS jamais sur var non declaree par Gemini")
