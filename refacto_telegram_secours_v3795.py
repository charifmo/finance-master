#!/usr/bin/env python3
"""v37.95 — TELEGRAM « BAD REQUEST » : LA RÉPONSE ARRIVE QUAND MÊME.

« Send Telegram : Bad request — please check your parameters » (13:55, 22:25) : le CFO avait répondu, mais
  Telegram a refusé le message — en mode HTML, il rejette TOUT le message à la moindre mise en forme qu'il ne
  sait pas lire (une balise dans un bloc de code, par exemple). Vous n'avez rien reçu.

  1. Format for Telegram : dans un bloc <code>/<pre>, plus aucune autre balise (Telegram les refuse) ; chaque
     morceau porte aussi sa version en TEXTE BRUT.
  2. Send Telegram : en cas de refus, il ne casse plus le workflow — la sortie « erreur » part vers un second
     nœud, « Send Telegram (texte brut) », qui envoie la même réponse sans mise en forme (Telegram ne peut pas
     la refuser). La réponse vocale suit l'un ou l'autre.
  3. Plus de « This message was sent automatically with n8n » sous chaque réponse.
  4. install.sh cfo installe tout cela dans le workflow en service (n8n/maj_workflow_cfo.php).
"""
import io, json, sys

P = 'super_agent_cfo_audio.json'
wf = json.load(io.open(P, encoding='utf-8'))
noeud = lambda nom: next(n for n in wf['nodes'] if n['name'] == nom)

fmt = noeud('Format for Telegram')
code = fmt['parameters']['jsCode']
def sub(label, old, new):
    global code
    if code.count(old) != 1: print(f'✖ {label} : {code.count(old)} ancre(s)'); sys.exit(1)
    code = code.replace(old, new)
sub('en-tête', "// FORMAT FOR TELEGRAM v37.58", "// FORMAT FOR TELEGRAM v37.95 (v37.58 + blocs de code nus, texte brut de secours)")
sub('jetons : rien dans un bloc de code',
"""const jetons = [];
const re = /<(\\/?)([a-z][a-z0-9]*)\\b([^>]*)>/gi;
let i = 0, m;
const texte = (s) => { if (s) jetons.push({ t: echapper(decoder(s)) }); };
while ((m = re.exec(plat))) {
  texte(plat.slice(i, m.index)); i = re.lastIndex;
  const nom = m[2].toLowerCase(), ferme = m[1] === '/';
  if (!['b', 'i', 'u', 's', 'code', 'pre', 'a'].includes(nom)) continue;""",
"""const jetons = [];
const re = /<(\\/?)([a-z][a-z0-9]*)\\b([^>]*)>/gi;
let i = 0, m, brut = 0;   // v37.95 : dans <code>/<pre>, Telegram refuse toute autre balise
const texte = (s) => { if (s) jetons.push({ t: echapper(decoder(s)) }); };
while ((m = re.exec(plat))) {
  texte(plat.slice(i, m.index)); i = re.lastIndex;
  const nom = m[2].toLowerCase(), ferme = m[1] === '/';
  if (!['b', 'i', 'u', 's', 'code', 'pre', 'a'].includes(nom)) continue;
  if (brut > 0 && !(ferme && (nom === 'code' || nom === 'pre'))) continue;
  if (nom === 'code' || nom === 'pre') brut = Math.max(0, brut + (ferme ? -1 : 1));""")
sub('sortie : texte brut de secours',
"""return morceaux.map((t, n) => ({ json: { chat_id: chatId, telegram_text: morceaux.length > 1 ? t + '\\n<i>(' + (n + 1) + '/' + morceaux.length + ')</i>' : t } }));""",
"""//  v37.95 : la même réponse en texte brut — envoyée par « Send Telegram (texte brut) » si Telegram refuse le HTML
const brutDe = (t) => decoder(String(t).replace(/<[^>]+>/g, '')).slice(0, 4000);
return morceaux.map((t, n) => { const tt = morceaux.length > 1 ? t + '\\n<i>(' + (n + 1) + '/' + morceaux.length + ')</i>' : t;
  return { json: { chat_id: chatId, telegram_text: tt, telegram_plain: brutDe(tt) } }; });""")
sub('erreur : texte brut aussi',
"""    + '<b>Détail technique :</b> <code>' + echapper(String(errorDetail).slice(0, 1500)) + '</code>' } }];""",
"""    + '<b>Détail technique :</b> <code>' + echapper(String(errorDetail).slice(0, 1500)) + '</code>',
    telegram_plain: '⚠️ Alerte Système (Super-Agent CFO)\\nUne exception a empêché l\\'exécution correcte de la commande.\\nDétail technique : ' + String(errorDetail).slice(0, 1500) } }];""")
fmt['parameters']['jsCode'] = code

st = noeud('Send Telegram')
st['parameters']['additionalFields'] = {'parse_mode': 'HTML', 'appendAttribution': False}
st['onError'] = 'continueErrorOutput'
if not any(n['name'] == 'Send Telegram (texte brut)' for n in wf['nodes']):
    wf['nodes'].append({
        'parameters': {'chatId': "={{ $('Telegram Trigger').first().json.message.chat.id }}", 'text': '={{ $json.telegram_plain || $json.telegram_text }}',
                       'additionalFields': {'appendAttribution': False}},
        'id': 'node-send-telegram-brut', 'name': 'Send Telegram (texte brut)', 'type': 'n8n-nodes-base.telegram', 'typeVersion': st.get('typeVersion', 1.2),
        'position': [st['position'][0], st['position'][1] + 180], 'credentials': st.get('credentials', {}),
    })
wf['connections']['Send Telegram'] = {'main': [[{'node': 'If Voice Input', 'type': 'main', 'index': 0}], [{'node': 'Send Telegram (texte brut)', 'type': 'main', 'index': 0}]]}
wf['connections']['Send Telegram (texte brut)'] = {'main': [[{'node': 'If Voice Input', 'type': 'main', 'index': 0}]]}
io.open(P, 'w', encoding='utf-8').write(json.dumps(wf, ensure_ascii=False, indent=4))
print('✔ v37.95 : Telegram — blocs de code nus, secours en texte brut, plus de mention n8n')
