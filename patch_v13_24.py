#!/usr/bin/env python3
# patch_v13_24.py — Hotfix v13.24
# ════════════════════════════════════════════════════════════════════
# DIAGNOSTIC :
#   patch_v13_23.py a introduit un nouveau crash dans Budget Engine :
#     "Cannot access 'simulate' before initialization [line 36]"
#
#   Root cause : Temporal Dead Zone (TDZ) JavaScript.
#   `typeof X` est safe UNIQUEMENT pour les variables jamais déclarées.
#   Pour une variable `const`/`let` déclarée PLUS BAS dans le même scope
#   (Temporal Dead Zone), `typeof X` lance ReferenceError :
#     "Cannot access X before initialization"
#   Le `&&` ne court-circuite PAS `typeof` — l'opérateur évalue le nom
#   avant toute autre chose.
#
#   Conflits identifiés dans Budget Engine :
#     - ligne 36 : typeof simulate     <-> const simulate     (ligne 42)
#     - ligne 37 : typeof operations   <-> const operations   (ligne 43)
#     - ligne 39 : typeof session_id   <-> const session_id   (ligne 53)
#   Conflit identifié dans Committer :
#     - ligne 41 : typeof session_id   <-> let session_id     (ligne 50)
#
# FIX :
#   Remplacer chaque `typeof X !== 'undefined'` par un try/catch individuel.
#   try { if (X !== undefined && input.X === undefined) input.X = X; } catch(e) {}
#   -> attrape les 2 cas : ReferenceError (indéclarée) ET TDZ error.
#   -> ne crashe JAMAIS, peu importe le mode de passage Gemini.
# ════════════════════════════════════════════════════════════════════

import json, sys

SRC  = "D:/Users/mohamed_benabad/finance-master/super_agent_cfo.json"
DEST = "D:/Users/mohamed_benabad/finance-master/super_agent_cfo.json"

with open(SRC, "r", encoding="utf-8") as f:
    wf = json.load(f)

# ─── Ancien bloc kwargs (v13.23) ─────────────────────────────────────────────
OLD_KWARGS = """// (B) Source secondaire : kwargs nommés que Gemini peut passer
//   typeof X évite ReferenceError, le && court-circuite avant le déréférencement
if (typeof confirmation !== 'undefined' && input.confirmation === undefined) input.confirmation = confirmation;
if (typeof simulate     !== 'undefined' && input.simulate     === undefined) input.simulate     = simulate;
if (typeof operations   !== 'undefined' && input.operations   === undefined) input.operations   = operations;
if (typeof annee        !== 'undefined' && input.annee        === undefined) input.annee        = annee;
if (typeof session_id   !== 'undefined' && input.session_id   === undefined) input.session_id   = session_id;
// ──────────────────────────────────────────────────────────────────────────"""

# ─── Nouveau bloc kwargs (v13.24) ─────────────────────────────────────────────
NEW_KWARGS = """// (B) Source secondaire : kwargs nommés (Gemini mode direct)
// v13.24 FIX TDZ : typeof X plante pour const/let en TDZ (même scope, décl. plus bas).
//   Ex: "Cannot access 'simulate' before initialization" car const simulate est à la
//   ligne 42, même scope. typeof évalue le nom avant tout — pas de court-circuit.
//   Fix : try/catch individuel par kwarg — attrape ReferenceError (indéclarée) ET TDZ.
try { if (confirmation !== undefined && input.confirmation === undefined) input.confirmation = confirmation; } catch(e) {}
try { if (simulate     !== undefined && input.simulate     === undefined) input.simulate     = simulate;     } catch(e) {}
try { if (operations   !== undefined && input.operations   === undefined) input.operations   = operations;   } catch(e) {}
try { if (annee        !== undefined && input.annee        === undefined) input.annee        = annee;        } catch(e) {}
try { if (session_id   !== undefined && input.session_id   === undefined) input.session_id  = session_id;   } catch(e) {}
// ──────────────────────────────────────────────────────────────────────────"""

# ─── Mise à jour de l'en-tête version ────────────────────────────────────────
OLD_HEADER = "// ── v13.23 : SAFE INPUT GATHERING ──────────────────────────────────────"
NEW_HEADER = "// ── v13.24 : SAFE INPUT GATHERING (fix TDZ) ───────────────────────────"

# ─── Application ─────────────────────────────────────────────────────────────
patched_count = 0
for node in wf["nodes"]:
    nid = node.get("id")
    if nid in ("node-tool-budget", "node-tool-commit"):
        code = node["parameters"]["jsCode"]
        assert OLD_KWARGS in code, f"Pattern kwargs v13.23 introuvable dans {nid}"
        assert OLD_HEADER in code, f"Header v13.23 introuvable dans {nid}"
        code = code.replace(OLD_KWARGS, NEW_KWARGS, 1)
        code = code.replace(OLD_HEADER, NEW_HEADER, 1)
        node["parameters"]["jsCode"] = code
        patched_count += 1
        print(f"[OK] {nid} : kwargs TDZ fix appliqué")

assert patched_count == 2, f"Expected 2 patches, got {patched_count}"

# ─── Validations ──────────────────────────────────────────────────────────────
for node in wf["nodes"]:
    if node.get("id") in ("node-tool-budget", "node-tool-commit"):
        code = node["parameters"]["jsCode"]
        nid = node.get("id")
        # Ancien pattern typeof absent
        assert "typeof simulate     !== 'undefined'" not in code, \
            f"typeof simulate encore présent dans {nid}"
        assert "typeof session_id   !== 'undefined'" not in code, \
            f"typeof session_id encore présent dans {nid}"
        # Nouveau pattern try/catch présent
        assert "try { if (simulate" in code, f"try/catch simulate absent de {nid}"
        assert "try { if (session_id" in code, f"try/catch session_id absent de {nid}"
        # Marker version mis à jour
        assert "v13.24" in code, f"Marker v13.24 absent de {nid}"
        # query section (A) inchangée
        assert "typeof query !== 'undefined'" in code, f"Guard query absent de {nid}"
        print(f"[OK] Validations {nid} : OK")

print("[OK] Toutes les validations passées")

# ─── Mise à jour du nom ───────────────────────────────────────────────────────
wf["name"] = "Super-Agent CFO v13.24"

with open(DEST, "w", encoding="utf-8") as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)

print("[OK] Workflow renommé -> Super-Agent CFO v13.24")
print()
print("[DONE] super_agent_cfo.json v13.24 écrit.")
print("  Outils corrigés : Budget Engine + Committer")
print("  Root cause : typeof X plante pour const/let en TDZ")
print("  Fix : try/catch individuel par kwarg (attrape ReferenceError + TDZ)")
print("  Comportement : ne crash PLUS jamais sur kwargs Gemini")
