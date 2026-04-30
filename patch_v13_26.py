#!/usr/bin/env python3
# patch_v13_26.py — Refonte v13.26 (architecture robuste + diagnostique)
# ════════════════════════════════════════════════════════════════════
# DIAGNOSTIC v13.25 -> v13.26 :
#   v13.25 a introduit une régression silencieuse pour Budget Engine :
#     case 3 du parser : `if (trimmed) input.confirmation = trimmed`
#   capture TOUT le texte non-JSON dans input.confirmation, donc si
#   Gemini envoie pour budget_engine du JSON malformé OU du texte
#   naturel, input.operations reste [] et l'engine répond "0 ops"
#   sans la moindre alerte -> échec silencieux invisible.
#
# ARCHITECTURE v13.26 (3 couches):
#   1. PARSER MULTI-STRATEGIES (au lieu de 1 + fallback aveugle):
#      - JSON.parse direct
#      - Extraction d'un JSON object embarqué via regex /\{[\s\S]*\}/
#      - JSON scalar string ('"OUI"')
#      - Plain scalar ('OUI') -- UNIQUEMENT si l'outil l'autorise
#   2. PLUS JAMAIS D'ECHEC SILENCIEUX:
#      - Budget Engine sans operations[] -> erreur diagnostique
#      - Committer sans confirmation valide -> erreur diagnostique
#      - Diagnostic inclut raw_query + parse_strategy pour debug
#   3. ISOLATION OUTIL:
#      - Committer ACCEPTE plain scalar (mappe -> confirmation)
#      - Budget Engine REFUSE plain scalar (-> diagnostic explicite)
#   Couche kwargs (v13.24 TDZ-safe) conservée.
# ════════════════════════════════════════════════════════════════════

import json, sys

SRC  = "D:/Users/mohamed_benabad/finance-master/super_agent_cfo.json"
DEST = "D:/Users/mohamed_benabad/finance-master/super_agent_cfo.json"

with open(SRC, "r", encoding="utf-8") as f:
    wf = json.load(f)

# ─── ANCIEN bloc complet à remplacer (v13.25) ────────────────────────────────
OLD_HEADER_BUDGET = "// ── v13.24 : SAFE INPUT GATHERING (fix TDZ) ───────────────────────────"
OLD_HEADER_COMMIT = "// ── v13.24 : SAFE INPUT GATHERING (fix TDZ) ───────────────────────────"

OLD_BLOCK = """// Gemini peut passer les paramètres de 2 façons :
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
}

// (B) Source secondaire : kwargs nommés (Gemini mode direct)
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

def make_new_block(tool_name, accept_scalar):
    """tool_name: 'budget_engine' ou 'committer'
       accept_scalar: True si l'outil accepte un scalar nu en input (ex: confirmation pour committer)
    """
    accept_scalar_js = "true" if accept_scalar else "false"
    return f"""// REFONTE v13.26 : architecture robuste + diagnostique (plus jamais d'échec silencieux)
//
//  Couche 1 - PARSER MULTI-STRATEGIES :
//     Stratégie A : JSON.parse direct du query trim
//     Stratégie B : extraction d'un JSON object embarqué via regex (texte LLM verbeux)
//     Stratégie C : JSON scalar string ('"OUI"' -> "OUI")
//     Stratégie D : plain scalar ('OUI') -- UNIQUEMENT si l'outil l'autorise
//                   (committer oui, budget_engine non)
//
//  Couche 2 - PAS D'ECHEC SILENCIEUX :
//     Si parsing -> input vide, on retourne une erreur diagnostique
//     contenant raw_query, parse_strategy, et la liste des stratégies tentées.
//     -> permet de debug ce que Gemini envoie réellement.
//
//  Couche 3 - KWARGS TDZ-SAFE (v13.24 conservé) :
//     try/catch individuel par kwarg pour attraper ReferenceError + TDZ.
//
const TOOL_NAME = '{tool_name}';
const ACCEPT_SCALAR = {accept_scalar_js};

let input = {{}};
let _parseStrategy = 'none';
let _rawQuery = null;
const _strategiesAttempted = [];

// Snapshot du query brut (pour diagnostic)
try {{
  if (typeof query !== 'undefined' && query !== null) {{
    _rawQuery = (typeof query === 'string') ? query : JSON.stringify(query);
  }}
}} catch (e) {{ _rawQuery = '<unstringifiable>'; }}

// (A) Source primaire : query (multi-stratégies)
if (typeof query !== 'undefined' && query !== null) {{
  if (typeof query === 'object') {{
    input = Object.assign({{}}, query);
    _parseStrategy = 'object_direct';
  }} else if (typeof query === 'string') {{
    const trimmed = query.trim();

    // Stratégie A : JSON.parse direct
    _strategiesAttempted.push('A:json_parse');
    try {{
      const parsedA = JSON.parse(trimmed);
      if (parsedA !== null && typeof parsedA === 'object' && !Array.isArray(parsedA)) {{
        input = parsedA;
        _parseStrategy = 'A:json_object';
      }} else if (typeof parsedA === 'string') {{
        // JSON scalar '"OUI"' -> "OUI"
        if (ACCEPT_SCALAR) {{
          input.confirmation = parsedA;
          _parseStrategy = 'C:json_scalar';
        }}
      }}
    }} catch (eA) {{ /* pas du JSON pur */ }}

    // Stratégie B : extraction d'un JSON object embarqué (LLM verbeux)
    if (_parseStrategy === 'none' && trimmed) {{
      _strategiesAttempted.push('B:embedded_json');
      const m = trimmed.match(/\\{{[\\s\\S]*\\}}/);
      if (m) {{
        try {{
          const parsedB = JSON.parse(m[0]);
          if (parsedB && typeof parsedB === 'object' && !Array.isArray(parsedB)) {{
            input = parsedB;
            _parseStrategy = 'B:json_embedded';
          }}
        }} catch (eB) {{ /* échec extraction */ }}
      }}
    }}

    // Stratégie D : plain scalar (uniquement outils l'acceptant)
    if (_parseStrategy === 'none' && trimmed && ACCEPT_SCALAR) {{
      _strategiesAttempted.push('D:plain_scalar');
      input.confirmation = trimmed;
      _parseStrategy = 'D:plain_scalar';
    }}
  }}
}}

// (B) kwargs nommés (TDZ-safe, v13.24 conservé)
try {{ if (confirmation !== undefined && input.confirmation === undefined) input.confirmation = confirmation; }} catch(e) {{}}
try {{ if (simulate     !== undefined && input.simulate     === undefined) input.simulate     = simulate;     }} catch(e) {{}}
try {{ if (operations   !== undefined && input.operations   === undefined) input.operations   = operations;   }} catch(e) {{}}
try {{ if (annee        !== undefined && input.annee        === undefined) input.annee        = annee;        }} catch(e) {{}}
try {{ if (session_id   !== undefined && input.session_id   === undefined) input.session_id  = session_id;   }} catch(e) {{}}

// COUCHE 2 : Diagnostic anti-silence
// Si parsing complètement raté ET pas de kwargs -> erreur explicite avec raw_query
if (Object.keys(input).length === 0) {{
  return JSON.stringify({{
    error: 'Aucun paramètre détecté (parsing query échoué, kwargs vides). Stratégies tentées: ' + _strategiesAttempted.join(', '),
    diagnostic: {{
      tool: TOOL_NAME,
      raw_query: _rawQuery,
      query_type: typeof query,
      parse_strategy: _parseStrategy,
      strategies_attempted: _strategiesAttempted,
      hint: 'Gemini doit envoyer un JSON object {{ ... }} dans query.'
    }}
  }});
}}
// ──────────────────────────────────────────────────────────────────────────"""

# ─── Construction des nouveaux blocs ─────────────────────────────────────────
NEW_BLOCK_BUDGET = make_new_block('budget_engine', accept_scalar=False)
NEW_BLOCK_COMMIT = make_new_block('committer',     accept_scalar=True)

# ─── Application ─────────────────────────────────────────────────────────────
patched_count = 0
for node in wf["nodes"]:
    nid = node.get("id")
    if nid == "node-tool-budget":
        code = node["parameters"]["jsCode"]
        assert OLD_HEADER_BUDGET in code, f"Header v13.24 introuvable dans {nid}"
        assert OLD_BLOCK in code, f"Bloc query+kwargs v13.25 introuvable dans {nid}"
        new_header = "// ── v13.26 : ROBUST PARSING + DIAGNOSTICS (anti-silence) ─────────────"
        code = code.replace(OLD_HEADER_BUDGET, new_header, 1)
        code = code.replace(OLD_BLOCK, NEW_BLOCK_BUDGET, 1)
        node["parameters"]["jsCode"] = code
        patched_count += 1
        print(f"[OK] {nid} : v13.26 applique (ACCEPT_SCALAR=false)")

    elif nid == "node-tool-commit":
        code = node["parameters"]["jsCode"]
        assert OLD_HEADER_COMMIT in code, f"Header v13.24 introuvable dans {nid}"
        assert OLD_BLOCK in code, f"Bloc query+kwargs v13.25 introuvable dans {nid}"
        new_header = "// ── v13.26 : ROBUST PARSING + DIAGNOSTICS (anti-silence) ─────────────"
        code = code.replace(OLD_HEADER_COMMIT, new_header, 1)
        code = code.replace(OLD_BLOCK, NEW_BLOCK_COMMIT, 1)
        node["parameters"]["jsCode"] = code
        patched_count += 1
        print(f"[OK] {nid} : v13.26 applique (ACCEPT_SCALAR=true)")

assert patched_count == 2, f"Expected 2 patches, got {patched_count}"

# ─── Validations ──────────────────────────────────────────────────────────────
for node in wf["nodes"]:
    if node.get("id") in ("node-tool-budget", "node-tool-commit"):
        code = node["parameters"]["jsCode"]
        nid = node.get("id")
        assert "v13.26 : ROBUST PARSING + DIAGNOSTICS" in code, f"Header v13.26 absent de {nid}"
        assert "PARSER MULTI-STRATEGIES" in code, f"Comment multi-strategies absent de {nid}"
        assert "_strategiesAttempted" in code, f"Tracking strategies absent de {nid}"
        assert "B:embedded_json" in code, f"Stratégie B absente de {nid}"
        assert "raw_query: _rawQuery" in code, f"Diagnostic raw_query absent de {nid}"
        # TDZ-safe kwargs conservés
        assert "try { if (confirmation !== undefined" in code, f"kwargs TDZ absent de {nid}"
        # Isolation outil
        if nid == "node-tool-budget":
            assert "TOOL_NAME = 'budget_engine'" in code
            assert "ACCEPT_SCALAR = false" in code, f"Budget Engine doit refuser scalar"
        else:
            assert "TOOL_NAME = 'committer'" in code
            assert "ACCEPT_SCALAR = true" in code, f"Committer doit accepter scalar"
        print(f"[OK] Validations {nid} : OK")

print("[OK] Toutes les validations passees")

# ─── Mise à jour du nom ───────────────────────────────────────────────────────
wf["name"] = "Super-Agent CFO v13.26"

with open(DEST, "w", encoding="utf-8") as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)

print("[OK] Workflow renomme -> Super-Agent CFO v13.26")
print()
print("[DONE] super_agent_cfo.json v13.26 ecrit.")
print("  Architecture: parser multi-strategies + diagnostic anti-silence")
print("  Budget Engine : refuse scalar (force JSON object)")
print("  Committer     : accepte scalar (mappe -> confirmation)")
print("  Echec parsing : erreur explicite avec raw_query + strategies tentees")
