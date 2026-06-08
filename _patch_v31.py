import json, sys
sys.stdout.reconfigure(encoding='utf-8')

path = r"D:\Users\mohamed_benabad\finance-master\super_agent_cfo.json"
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

patched = []

# =============================================================================
# 1. COMMITTER jsCode : injecter bloc ABORT avant GARDE 1
# =============================================================================

ABORT_BLOCK = (
    '// ── v31.00 : ABORT ─ confirmation = "NON" ou action = "cancel_pending" ──────\n'
    '// Route de sortie : purge le cache pending SANS rien committer.\n'
    "// Appelee si l'utilisateur dit NON, change de sujet, ou annule.\n"
    'const _isCancel =\n'
    "  (input.action && String(input.action).toLowerCase() === 'cancel_pending') ||\n"
    "  (input.confirmation && String(input.confirmation).toUpperCase().trim() === 'NON');\n"
    '\n'
    'if (_isCancel) {\n'
    '  let _cancelSid = null;\n'
    "  try { _cancelSid = $('Build Agent Input').first().json.session_id; } catch (e) {}\n"
    "  if (!_cancelSid) { try { _cancelSid = $('Normalize Input').first().json.session_id; } catch (e) {} }\n"
    "  let _cancelResp = { status: 'cancelled', was_pending: false };\n"
    '  if (_cancelSid) {\n'
    '    try {\n'
    '      _cancelResp = await this.helpers.httpRequest({\n'
    "        method: 'POST',\n"
    "        url: 'https://n8n.beau.ink/finance/pending_commit.php',\n"
    '        body: { session_id: _cancelSid, action: \'cancel_pending\' },\n'
    '        json: true,\n'
    '        timeout: 5000\n'
    '      });\n'
    '    } catch (e) {\n'
    "      _cancelResp = { status: 'cancelled', was_pending: null, detail: e.message };\n"
    '    }\n'
    '  }\n'
    '  return JSON.stringify({\n'
    "    status: 'cancelled',\n"
    "    message: 'Simulation annulee. Cache pending purge. Nouvelle question traitee librement.',\n"
    '    session_id: _cancelSid,\n'
    '    server_response: _cancelResp\n'
    '  });\n'
    '}\n'
    '\n'
)

GARDE1_MARKER = '// ── GARDE 1 : confirmation = "OUI" ──\n'

for node in data['nodes']:
    params = node.get('parameters', {})
    if params.get('name') == 'committer' and 'jsCode' in params:
        js = params['jsCode']
        if 'v31.00 : ABORT' not in js:
            if GARDE1_MARKER in js:
                js = js.replace(GARDE1_MARKER, ABORT_BLOCK + GARDE1_MARKER, 1)
                params['jsCode'] = js
                patched.append('committer_jsCode:OK')
            else:
                patched.append('committer_jsCode:GARDE1_NOT_FOUND')
        else:
            patched.append('committer_jsCode:already_done')

        # Description — append cancel note after first paragraph
        if 'cancel_pending' not in params.get('description', ''):
            desc = params['description']
            insert = (
                '\n\nPour ANNULER une simulation en attente (State Machine ABORT v31.00) : '
                'appelle avec { "action": "cancel_pending" }. '
                "Utilise ce mode si l'utilisateur dit NON, change de sujet, ou pose une question sans rapport. "
                "Retourne { status: 'cancelled' } — le cache pending est purge "
                'et le LLM peut traiter la nouvelle demande librement.'
            )
            # Insert after the first sentence (ends at first \n\n or end of string)
            first_para_end = desc.find('\n\n')
            if first_para_end == -1:
                params['description'] = desc + insert
            else:
                params['description'] = desc[:first_para_end] + insert + desc[first_para_end:]
            patched.append('committer_description:OK')
        else:
            patched.append('committer_description:already_done')

# =============================================================================
# 2. AI Agent system prompt : ajouter Tour 2b
# =============================================================================

TOUR2_OLD = (
    'Tour 2 — Commit :\n'
    '  1. Si message utilisateur = "OUI" / "ok" / "valide" / "go" → appelle committer avec { "confirmation": "OUI" } et RIEN d\'autre.\n'
    "  2. L'outil récupère seul la simulation en cache (pending_commit.php).\n"
    '  3. Si status=ok et committed=true → confirme en HTML avec la liste des opérations.\n'
    '  4. Si erreur "simulation en attente" → cache expirée (>30 min). Demande de reformuler la modification.'
)

TOUR2_NEW = (
    'Tour 2a — Validation :\n'
    '  1. Si message utilisateur = "OUI" / "ok" / "valide" / "go" → appelle committer avec { "confirmation": "OUI" } et RIEN d\'autre.\n'
    "  2. L'outil récupère seul la simulation en cache (pending_commit.php).\n"
    '  3. Si status=ok et committed=true → confirme en HTML avec la liste des opérations.\n'
    '  4. Si erreur "simulation en attente" → cache expirée (>30 min). Demande de reformuler la modification.\n\n'
    'Tour 2b — Annulation / Changement de sujet (STATE MACHINE ABORT v31.00) :\n'
    '  RÈGLE ABSOLUE : si une simulation est en attente (pending_saved=true reçu au tour précédent) ET que l\'utilisateur :\n'
    '    • Dit "NON", "annule", "laisse tomber", "non merci", "pas maintenant".\n'
    '    • OU pose une question SANS RAPPORT avec la simulation proposée.\n'
    '    • OU reformule une NOUVELLE modification différente.\n'
    '  → Appelle IMMEDÍATEMENT committer avec { "action": "cancel_pending" } pour purger le cache.\n'
    '  → Attends le { status: cancelled } puis traite la nouvelle demande normalement.\n'
    '  INTERDICTION ABSOLUE : ne JAMAIS re-proposer "tapez OUI pour confirmer" si l\'utilisateur a changé de sujet ou répondu négativement. C\'est la cause du State Lock.'
)

for node in data['nodes']:
    if node.get('name') == 'AI Agent':
        params = node.get('parameters', {})
        opts = params.get('options', {})
        sm = opts.get('systemMessage', '')
        if 'Tour 2b' not in sm:
            if TOUR2_OLD in sm:
                opts['systemMessage'] = sm.replace(TOUR2_OLD, TOUR2_NEW, 1)
                patched.append('system_prompt:OK')
            else:
                # Debug: show what Tour 2 looks like in the file
                idx = sm.find('Tour 2')
                if idx >= 0:
                    patched.append('system_prompt:FRAGMENT_MISMATCH idx=' + str(idx))
                    # Write debug file
                    with open(r'D:\Users\mohamed_benabad\finance-master\_debug_tour2.txt', 'w', encoding='utf-8') as dbg:
                        dbg.write('EXPECTED:\n' + repr(TOUR2_OLD) + '\n\nACTUAL:\n' + repr(sm[idx:idx+600]))
                else:
                    patched.append('system_prompt:TOUR2_NOT_FOUND')
        else:
            patched.append('system_prompt:already_done')

with open(path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print('Results:', patched)
