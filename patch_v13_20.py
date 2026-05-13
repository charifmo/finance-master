"""
patch_v13_20.py - Super-Agent CFO v13.20
Error Handling complet + visibilite Telegram :
  1. AI Agent : retryOnFail (3 tries) + waitBetweenTries (2s)
                continueOnFail/alwaysOutputData deja presents (v13.12)
  2. Format for Telegram : detecte l erreur en amont et formate l'alerte
                exactement comme demande par l utilisateur
"""
import sys, json

FILEPATH = r'D:\Users\mohamed_benabad\finance-master\super_agent_cfo.json'

with open(FILEPATH, 'r', encoding='utf-8') as f:
    d = json.load(f)

d['name'] = 'Super-Agent CFO v13.20'

nodes = {n['id']: n for n in d['nodes']}

# ─── 1. AI Agent : retry on fail ──────────────────────────────────────────────
agent = nodes['node-agent']
agent['retryOnFail']     = True
agent['maxTries']        = 3      # 3 essais avant d abandonner
agent['waitBetweenTries'] = 2000  # 2 secondes entre tentatives (back-off)

sys.stdout.buffer.write(b'[1/2] AI Agent : retryOnFail=true, maxTries=3, waitBetweenTries=2000ms\n')

# ─── 2. Format for Telegram : detection d'erreur + alerte explicite ───────────
NEW_FORMAT_CODE = r"""// ════════════════════════════════════════════════════════
// FORMAT FOR TELEGRAM v13.20
// - Detecte si l AI Agent a failed (continueOnFail propage l'erreur ici)
// - Format ALERTE specifique en cas d'echec
// - Sinon, conversion HTML -> texte Telegram (logique v13.4 conservee)
// ════════════════════════════════════════════════════════

// ── 1. Recupere la sortie de l AI Agent ──────────────────────────────────────
let agentOut = {};
try {
  agentOut = $('AI Agent').first().json || {};
} catch (e) {
  agentOut = {};
}

// ── 2. Detection d'erreur ────────────────────────────────────────────────────
// continueOnFail=true sur AI Agent injecte l'erreur dans la sortie sous
// differentes formes selon la version n8n :
//   - agentOut.error               (string ou objet)
//   - agentOut.error.message       (objet avec message)
//   - agentOut.error.description
//   - agentOut.lastError
//   - $execution.lastError
// On detecte aussi les "fausses success" : output vide + error present
function extractError(o) {
  if (!o || typeof o !== 'object') return null;
  // Direct
  if (typeof o.error === 'string' && o.error.length > 0) return o.error;
  if (typeof o.error === 'object' && o.error !== null) {
    return o.error.message || o.error.description || o.error.detail
      || (typeof o.error === 'object' ? JSON.stringify(o.error) : String(o.error));
  }
  if (typeof o.lastError === 'string' && o.lastError.length > 0) return o.lastError;
  if (typeof o.lastError === 'object' && o.lastError !== null) {
    return o.lastError.message || o.lastError.description
      || JSON.stringify(o.lastError);
  }
  if (typeof o.message === 'string' && /error|exception|fail|503|429|502|500/i.test(o.message)) {
    return o.message;
  }
  return null;
}

const errMsg = extractError(agentOut);
const html   = agentOut.output || agentOut.text || agentOut.response || '';

// ── 3. Recupere chat_id Telegram ─────────────────────────────────────────────
let chatId = null;
try { chatId = $('Telegram Trigger').first().json.message.chat.id; } catch (e) {}
if (!chatId) {
  try { chatId = $('Normalize Input').first().json.chat_id; } catch (e) {}
}

// ── 4. Si erreur detectee OU output vide -> ALERTE SYSTEME ───────────────────
const isError = errMsg !== null || (!html && Object.keys(agentOut).length > 0);

if (isError) {
  const detail = errMsg || 'Aucune sortie produite par l agent (cause inconnue).';
  // Echappe les chevrons pour <pre> Telegram
  const safeDetail = String(detail)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .slice(0, 1500);

  const alertText =
    '⚠️ <b>Alerte Système (Super-Agent CFO)</b>\n\n' +
    'Une exception a empêché l\'exécution correcte de la commande.\n\n' +
    '<b>Détail technique :</b>\n' +
    '<pre>' + safeDetail + '</pre>';

  return [{
    json: {
      telegram_text: alertText,
      chat_id: chatId,
      is_error: true
    }
  }];
}

// ── 5. Sinon : conversion HTML -> texte Telegram (logique v13.4) ─────────────
let body = (typeof html === 'string') ? html : String(html);

const text = body
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
  .replace(/<(?!\/?(b|i|u|s|code|pre|a)\b)[^>]+>/gi, '')
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
    telegram_text: text || '⚠️ Aucune réponse générée par l\'agent.',
    chat_id: chatId,
    is_error: false
  }
}];"""

ft = nodes['node-format-telegram']
ft['parameters']['jsCode'] = NEW_FORMAT_CODE
sys.stdout.buffer.write(b'[2/2] Format for Telegram : detection erreur + alerte v13.20 injectee\n')

with open(FILEPATH, 'w', encoding='utf-8') as f:
    json.dump(d, f, ensure_ascii=False, indent=2)

# ─── Verification ────────────────────────────────────────────────────────────
with open(FILEPATH, 'r', encoding='utf-8') as f:
    d2 = json.load(f)
nodes2 = {n['id']: n for n in d2['nodes']}
ag2  = nodes2['node-agent']
ft2  = nodes2['node-format-telegram']
code2 = ft2['parameters']['jsCode']

checks = [
    ('name v13.20',                  d2['name'] == 'Super-Agent CFO v13.20'),
    ('18 nodes',                     len(d2['nodes']) == 18),
    ('AI Agent continueOnFail',      ag2.get('continueOnFail') is True),
    ('AI Agent alwaysOutputData',    ag2.get('alwaysOutputData') is True),
    ('AI Agent retryOnFail',         ag2.get('retryOnFail') is True),
    ('AI Agent maxTries=3',          ag2.get('maxTries') == 3),
    ('AI Agent waitBetweenTries',    ag2.get('waitBetweenTries') == 2000),
    ('Format v13.20',                'v13.20' in code2),
    ('extractError function',        'function extractError' in code2),
    ('Alerte Système titre',         'Alerte Système' in code2),
    ('Détail technique label',       'Détail technique' in code2),
    ('warning emoji',                '⚠️' in code2),
    ('<pre> safe escape',            '&lt;' in code2),
    ('chat_id fallback',             'Normalize Input' in code2),
    ('is_error flag dans output',    'is_error' in code2),
    ('memory_writer v1.4 intact',    'v1.4' in nodes2['node-tool-memory']['parameters']['jsCode']),
    ('Route fallback main[2]',       len(d2['connections']['Route Response']['main']) == 3),
    ('QR null-safe Save Conv',       '??' in nodes2['node-save-conv']['parameters']['options']['queryReplacement']),
]

out = '\n=== VERIFICATION v13.20 ===\n'
all_ok = True
for label, ok in checks:
    out += ('OK   ' if ok else 'FAIL ') + label + '\n'
    if not ok: all_ok = False
out += '\n>>> 18/18 OK - v13.20 PRET\n' if all_ok else '\n>>> ECHECS\n'
sys.stdout.buffer.write(out.encode('utf-8'))
if not all_ok: exit(1)
