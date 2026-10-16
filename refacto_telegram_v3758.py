# -*- coding: utf-8 -*-
"""
v37.58 — TELEGRAM : CHAQUE RÉPONSE ARRIVE, ET SEULEMENT CHEZ VOUS.

Audit du chemin Telegram des deux workflows (super_agent_cfo.json, super_agent_cfo_audio.json) :
  • « Format for Telegram » décodait &lt; &amp; APRÈS avoir retiré les balises : un « < 500 DH » ou un
    « & » partait nu en parse_mode HTML → Telegram refuse le message (400 « can't parse entities »),
    l'utilisateur ne reçoit RIEN. Idem au-delà de 4 096 caractères (« message is too long »), et pour
    une balise <b> non refermée. Les tableaux devenaient « Marjane331 DHEssence300 DH ».
    → nouveau formateur : texte ré-échappé, balises permises équilibrées, tableaux « a · b »,
      réponse longue découpée en plusieurs messages (≤ 3 900 caractères, « (1/3) »).
  • Audio : « If Voice Input » en executeOnce — plusieurs messages texte, UNE seule réponse vocale.
  • N'importe quel compte Telegram qui trouve le bot parle au CFO (vos chiffres, le Committer).
    → liste blanche : variable d'environnement n8n TELEGRAM_CHAT_IDS (ids séparés par des virgules).
      Absente : comportement inchangé. Présente : un chat inconnu est ignoré en silence.
"""
import io, json, sys

FORMAT = r'''// ════════════════════════════════════════════════════════
// FORMAT FOR TELEGRAM v37.58
//   Telegram (parse_mode HTML) REFUSE tout le message — 400, aucune réponse —
//   si le texte contient un « < » ou un « & » nu, une balise non fermée, ou
//   s'il dépasse 4 096 caractères. Ici :
//     • seules <b> <i> <u> <s> <code> <pre> <a href> survivent, équilibrées ;
//     • tout le reste du texte est ré-échappé (&lt; &gt; &amp;) ;
//     • tableaux : « cellule · cellule », une ligne par rangée ;
//     • une réponse longue part en plusieurs messages (≤ 3 900 car.).
// ════════════════════════════════════════════════════════
const LIMITE = 3900;
const chatId = $('Telegram Trigger').first().json.message.chat.id;
const echapper = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const decoder = (s) => String(s)
  .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n)))
  .replace(/&amp;/g, '&');

let html = '';
let isError = false;
let errorDetail = '';
try {
  const agentOut = $('AI Agent').first().json;
  if (agentOut.error) {
    isError = true;
    errorDetail = typeof agentOut.error === 'string' ? agentOut.error : (agentOut.error.message || JSON.stringify(agentOut.error));
  } else {
    html = agentOut.output || agentOut.text || agentOut.response || '';
    if (!html) { isError = true; errorDetail = 'Aucune réponse générée (output vide après continueOnFail).'; }
  }
} catch (e) {
  isError = true;
  errorDetail = e.message || 'Exception lors de la lecture de la sortie agent.';
}
if (isError) {
  return [{ json: { chat_id: chatId, telegram_text: '⚠️ <b>Alerte Système (Super-Agent CFO)</b>\n'
    + 'Une exception a empêché l\'exécution correcte de la commande.\n'
    + '<b>Détail technique :</b> <code>' + echapper(String(errorDetail).slice(0, 1500)) + '</code>' } }];
}

// 1. Mise en page : blocs → sauts de ligne, tableaux → « a · b », listes → puces
const plat = String(html)
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(?:td|th)>\s*(?=<(?:td|th)\b)/gi, ' · ')
  .replace(/<\/tr>/gi, '\n')
  .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
  .replace(/<\/li>/gi, '\n')
  .replace(/<li[^>]*>/gi, '• ')
  .replace(/<hr\s*\/?>/gi, '\n———\n')
  .replace(/<\/?(?:p|div|ul|ol|table|thead|tbody|h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<(\/?)strong\b[^>]*>/gi, '<$1b>').replace(/<(\/?)em\b[^>]*>/gi, '<$1i>');

// 2. Jetons : balise permise, ou texte (toute autre balise disparaît)
const jetons = [];
const re = /<(\/?)([a-z][a-z0-9]*)\b([^>]*)>/gi;
let i = 0, m;
const texte = (s) => { if (s) jetons.push({ t: echapper(decoder(s)) }); };
while ((m = re.exec(plat))) {
  texte(plat.slice(i, m.index)); i = re.lastIndex;
  const nom = m[2].toLowerCase(), ferme = m[1] === '/';
  if (!['b', 'i', 'u', 's', 'code', 'pre', 'a'].includes(nom)) continue;
  if (nom === 'a' && !ferme) {
    const h = /href\s*=\s*["']([^"']+)["']/i.exec(m[3]);
    if (!h || !/^https?:\/\//i.test(decoder(h[1]))) { jetons.push({ ouvre: 'a', vide: true }); continue; }
    jetons.push({ ouvre: 'a', balise: '<a href="' + echapper(decoder(h[1])).replace(/"/g, '&quot;') + '">' });
  } else if (ferme) jetons.push({ ferme: nom });
  else jetons.push({ ouvre: nom, balise: '<' + nom + '>' });
}
texte(plat.slice(i));

// 3. Morceaux ≤ LIMITE, balises équilibrées dans chacun
const morceaux = [];
let cour = '', pile = [];
const fermer = () => pile.slice().reverse().map(p => p.vide ? '' : '</' + p.ouvre + '>').join('');
const rouvrir = () => pile.map(p => p.vide ? '' : p.balise).join('');
const couper = () => { const s = (cour + fermer()).replace(/\n{3,}/g, '\n\n').trim(); if (s.replace(/<[^>]+>/g, '').trim()) morceaux.push(s); cour = rouvrir(); };
for (const j of jetons) {
  if (j.ouvre) { pile.push(j); cour += j.vide ? '' : j.balise; continue; }
  if (j.ferme) {
    const k = pile.map(p => p.ouvre).lastIndexOf(j.ferme);
    if (k < 0) continue;                                   // fermeture orpheline : ignorée
    const dessus = pile.splice(k);
    cour += dessus.slice().reverse().map(p => p.vide ? '' : '</' + p.ouvre + '>').join('');
    cour += dessus.slice(1).map(p => p.vide ? '' : p.balise).join('');
    pile.push(...dessus.slice(1));
    continue;
  }
  let reste = j.t;
  while (cour.length + reste.length + fermer().length > LIMITE) {
    const place = Math.max(0, LIMITE - cour.length - fermer().length);
    let cut = Math.max(reste.lastIndexOf('\n', place), reste.lastIndexOf(' ', place));
    if (cut <= 0) cut = place;
    while (cut > 0 && /&[a-z#0-9]*$/i.test(reste.slice(0, cut))) cut--;   // ne pas couper une entité
    if (cut <= 0 && cour.replace(/<[^>]+>/g, '').trim()) { couper(); continue; }
    if (cut <= 0) cut = Math.min(reste.length, LIMITE);
    cour += reste.slice(0, cut); reste = reste.slice(cut).replace(/^[ \n]+/, '');
    couper();
  }
  cour += reste;
}
couper();
if (!morceaux.length) morceaux.push('(réponse vide)');
return morceaux.map((t, n) => ({ json: { chat_id: chatId, telegram_text: morceaux.length > 1 ? t + '\n<i>(' + (n + 1) + '/' + morceaux.length + ')</i>' : t } }));
'''

A_NORM = """  chat_id = String(src.message.chat.id);
  session_id = 'tg_' + chat_id;
"""
B_NORM = A_NORM + """  // v37.58 : liste blanche — TELEGRAM_CHAT_IDS (env n8n) ; absente : tout chat est accepté
  let _autorises = [];
  try { _autorises = String($env.TELEGRAM_CHAT_IDS || '').split(/[\\s,;]+/).filter(Boolean); } catch (e) { _autorises = []; }
  if (_autorises.length && !_autorises.includes(chat_id)) return [];
"""

for f, indent in (('super_agent_cfo.json', 2), ('super_agent_cfo_audio.json', 4)):
    raw = io.open(f, encoding='utf-8').read()
    w = json.loads(raw)
    n = {x['name']: x for x in w['nodes']}
    code = n['Normalize Input']['parameters']['jsCode']
    if code.count(A_NORM) != 1: sys.exit('✖ ' + f + ' : ancre Normalize Input')
    n['Normalize Input']['parameters']['jsCode'] = code.replace(A_NORM, B_NORM)
    if 'FORMAT FOR TELEGRAM v13.21.1' not in n['Format for Telegram']['parameters']['jsCode']: sys.exit('✖ ' + f + ' : ancre Format for Telegram')
    n['Format for Telegram']['parameters']['jsCode'] = FORMAT
    if 'If Voice Input' in n: n['If Voice Input']['executeOnce'] = True
    out = json.dumps(w, indent=indent, ensure_ascii=False) + ('\n' if raw.endswith('\n') else '')
    io.open(f, 'w', encoding='utf-8').write(out)
    print('✔', f)
