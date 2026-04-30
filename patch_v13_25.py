#!/usr/bin/env python3
# patch_v13_25.py — Hotfix v13.25
# ════════════════════════════════════════════════════════════════════
# DIAGNOSTIC :
#   v13.24 a corrigé le crash TDZ, mais le Committer renvoie maintenant :
#     "REFUS : le paramètre confirmation doit être OUI"
#   alors que l'utilisateur a tapé "oui" et que Gemini affirme avoir
#   transmis la confirmation.
#
#   Root cause : les nœuds @n8n/n8n-nodes-langchain.toolCode du workflow
#   n'ont AUCUN inputSchema. En LangChain legacy, sans schéma, l'agent
#   appelle l'outil avec UN SEUL argument string (-> variable `query`).
#
#   Quand Gemini lit la description du Committer "{ confirmation: OUI }",
#   il envoie souvent juste `query = "OUI"` (la valeur scalaire), pas le
#   JSON. JSON.parse("OUI") lance -> catch silencieux -> input = {}.
#   Les kwargs (B) ne sauvent rien car n8n n'injecte pas les params
#   nommés en JS scope quand il n'y a pas de schéma. -> input.confirmation
#   reste undefined -> REFUS.
#
# FIX :
#   Bloc (A) "query parsing" élargi pour gérer 4 cas :
#     1. query = '{"k":"v"}' (JSON object string) -> input = parsed
#     2. query = '"OUI"'     (JSON string scalar) -> input.confirmation
#     3. query = 'OUI'       (plain string non-JSON) -> input.confirmation
#     4. query = { ... }     (objet direct)         -> input = copy
#
#   Pour Budget Engine, le cas 3 (string non-JSON) est sans conséquence
#   car l'engine attend operations[] et lèvera une erreur métier propre.
#   Pour Committer, le cas 3 résout exactement le bug observé.
# ════════════════════════════════════════════════════════════════════

import json, sys

SRC  = "D:/Users/mohamed_benabad/finance-master/super_agent_cfo.json"
DEST = "D:/Users/mohamed_benabad/finance-master/super_agent_cfo.json"

with open(SRC, "r", encoding="utf-8") as f:
    wf = json.load(f)

# ─── Ancien bloc (A) v13.23/v13.24 ───────────────────────────────────────────
OLD_QUERY_BLOCK = """// (A) Source primaire : query
if (typeof query !== 'undefined' && query !== null) {
  if (typeof query === 'string') {
    try {
      const parsed = JSON.parse(query);
      if (parsed && typeof parsed === 'object') input = parsed;
    } catch (e) { /* string non-JSON -> on ignore, kwargs prendront le relais */ }
  } else if (typeof query === 'object') {
    input = Object.assign({}, query);
  }
}"""

# ─── Nouveau bloc (A) v13.25 ─────────────────────────────────────────────────
NEW_QUERY_BLOCK = """// (A) Source primaire : query
// v13.25 : 4 cas de figure pour query (toolCode sans schéma -> agent envoie 1 string)
//   1. JSON object string  : '{"confirmation":"OUI"}' -> input = parsed
//   2. JSON string scalar  : '"OUI"'                  -> input.confirmation = parsed
//   3. Plain string non-JSON : 'OUI'                  -> input.confirmation = trimmed
//   4. Objet direct        : { confirmation: 'OUI' }  -> input = copy
if (typeof query !== 'undefined' && query !== null) {
  if (typeof query === 'string') {
    const trimmed = query.trim();
    let parsed = null;
    try { parsed = JSON.parse(trimmed); } catch (e) { /* pas du JSON */ }
    if (parsed !== null && typeof parsed === 'object') {
      input = parsed;
    } else if (typeof parsed === 'string') {
      // JSON scalar: '"OUI"' -> "OUI"
      input.confirmation = parsed;
    } else if (trimmed) {
      // Plain non-JSON: 'OUI' -> traité comme confirmation (param scalaire)
      input.confirmation = trimmed;
    }
  } else if (typeof query === 'object') {
    input = Object.assign({}, query);
  }
}"""

# ─── Application ─────────────────────────────────────────────────────────────
patched_count = 0
for node in wf["nodes"]:
    nid = node.get("id")
    if nid in ("node-tool-budget", "node-tool-commit"):
        code = node["parameters"]["jsCode"]
        assert OLD_QUERY_BLOCK in code, f"Bloc (A) v13.23/24 introuvable dans {nid}"
        node["parameters"]["jsCode"] = code.replace(OLD_QUERY_BLOCK, NEW_QUERY_BLOCK, 1)
        patched_count += 1
        print(f"[OK] {nid} : query parsing v13.25 applique (4 cas)")

assert patched_count == 2, f"Expected 2 patches, got {patched_count}"

# ─── Validations ──────────────────────────────────────────────────────────────
for node in wf["nodes"]:
    if node.get("id") in ("node-tool-budget", "node-tool-commit"):
        code = node["parameters"]["jsCode"]
        nid = node.get("id")
        # Nouveau pattern présent
        assert "v13.25 : 4 cas de figure" in code, f"Header v13.25 absent de {nid}"
        assert "input.confirmation = trimmed" in code, f"Cas 3 (plain string) absent de {nid}"
        assert "input.confirmation = parsed" in code, f"Cas 2 (JSON scalar) absent de {nid}"
        # Anciens elements toujours presents (kwargs v13.24, header)
        assert "try { if (confirmation !== undefined" in code, f"kwargs v13.24 manquant dans {nid}"
        # Pas de regression sur le bloc kwargs
        assert "try { if (simulate" in code
        print(f"[OK] Validations {nid} : OK")

print("[OK] Toutes les validations passees")

# ─── Mise à jour du nom ───────────────────────────────────────────────────────
wf["name"] = "Super-Agent CFO v13.25"

with open(DEST, "w", encoding="utf-8") as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)

print("[OK] Workflow renomme -> Super-Agent CFO v13.25")
print()
print("[DONE] super_agent_cfo.json v13.25 ecrit.")
print("  Outils corriges : Budget Engine + Committer")
print("  Root cause : toolCode sans schema -> Gemini envoie 'OUI' nu (pas JSON)")
print("  Fix : query parsing accepte string scalaire comme confirmation")
