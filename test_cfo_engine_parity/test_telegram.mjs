/**
 * v37.58 — TELEGRAM : CHAQUE RÉPONSE ARRIVE, ET SEULEMENT CHEZ VOUS.
 *   « Vérifie que l'intégration avec Telegram est OK. » Le chemin Telegram des deux workflows n8n,
 *   exécuté tel quel (le code des nœuds, $ simulé) :
 *     A. le texte envoyé est du HTML que Telegram ACCEPTE (« < », « & », balises croisées, liens)
 *     B. une réponse longue part en plusieurs messages ≤ 4 096 · C. les tableaux restent lisibles
 *     D. l'erreur de l'agent reste lisible · E. la liste blanche TELEGRAM_CHAT_IDS · F. une seule réponse vocale
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
let ko = 0;
const v = (t, ok, d = '') => { if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(64)} ${ok ? '' : d}`); };
console.log('\n  TELEGRAM : CHAQUE RÉPONSE ARRIVE, ET SEULEMENT CHEZ VOUS\n  ' + '─'.repeat(80));

//  Ce que Telegram accepte en parse_mode HTML : <b> <i> <u> <s> <code> <pre> <a href>, équilibrées ;
//  aucun « < » ni « & » nu ; 4 096 caractères au plus
const valideTelegram = (s) => {
    if (s.length > 4096) return 'trop long : ' + s.length;
    const pile = [];
    const re = /<(\/?)([a-z]+)([^>]*)>|&(#\d+|[a-z]+);|[<>&]/gi;
    let m;
    while ((m = re.exec(s))) {
        if (m[0] === '<' || m[0] === '>' || m[0] === '&') return 'caractère nu « ' + m[0] + ' » à ' + m.index;
        if (m[4] !== undefined) { if (!/^(lt|gt|amp|quot|#\d+)$/.test(m[4])) return 'entité ' + m[0]; continue; }
        const nom = m[2].toLowerCase();
        if (!['b', 'i', 'u', 's', 'code', 'pre', 'a'].includes(nom)) return 'balise ' + m[0];
        if (m[1]) { if (pile.pop() !== nom) return 'fermeture croisée ' + m[0]; }
        else pile.push(nom);
    }
    return pile.length ? 'non fermé : ' + pile.join(',') : '';
};
const WF = ['super_agent_cfo.json', 'super_agent_cfo_audio.json'].map(f => [f, JSON.parse(fs.readFileSync(path.join(RACINE, f), 'utf8'))]);
const noeud = (w, nom) => w.nodes.find(n => n.name === nom);
const formater = (code, sortie) => {
    const $ = (n) => ({ first: () => ({ json: n === 'AI Agent' ? sortie : { message: { chat: { id: 4242 } } } }) });
    return new Function('$', code)($).map(x => x.json);
};
for (const [f, w] of WF) {
    const code = noeud(w, 'Format for Telegram').parameters.jsCode;
    const fmt = (html) => formater(code, { output: html });
    console.log('  · ' + f);
    {
        const r = fmt('<p>Reste à vivre <b>&lt; 500 DH</b> &amp; épargne : R&D, 3<5, "ok"</p><span style="x">fin</span>');
        const t = r.map(x => x.telegram_text).join('');
        v('A. « < 500 DH » et « & » : ré-échappés, Telegram accepte le message', r.length === 1 && !valideTelegram(t) && /&lt; 500 DH/.test(t) && /R&amp;D/.test(t), valideTelegram(t) + ' ' + JSON.stringify(t));
        const c = fmt('<b>gras <i>mixte</b> fin</i> </i><b>ouvert <a href="javascript:alert(1)">piège</a> <a href="https://exemple.ma/?a=1&amp;b=2">lien</a>').map(x => x.telegram_text).join('');
        v('  → balises croisées / orphelines / non fermées réparées ; lien javascript: retiré, lien https gardé',
          !valideTelegram(c) && !/javascript/.test(c) && /<a href="https:\/\/exemple\.ma\/\?a=1&amp;b=2">lien<\/a>/.test(c), valideTelegram(c) + ' ' + JSON.stringify(c));
        v('  → le message part au bon chat', r[0].chat_id === 4242);
    }
    {
        const r = fmt('<h3>Bilan</h3><p><b>' + 'Analyse détaillée &amp; budget du cycle. '.repeat(300) + '</b></p><ul><li>fin</li></ul>');
        const bad = r.map(x => valideTelegram(x.telegram_text)).filter(Boolean);
        v('B. 12 000 caractères : plusieurs messages, chacun ≤ 4 096 et valide, numérotés (1/n)',
          r.length >= 3 && !bad.length && r.every((x, i) => x.telegram_text.endsWith('(' + (i + 1) + '/' + r.length + ')</i>')), r.length + ' ' + bad.join(' | '));
        const tout = r.map(x => x.telegram_text.replace(/<[^>]+>|\(\d+\/\d+\)/g, '')).join(' ').replace(/\s+/g, ' ');
        v('  → rien de perdu (300 phrases), le gras suit d\'un message à l\'autre',
          (tout.match(/Analyse détaillée &amp; budget du cycle\./g) || []).length === 300 && r.slice(0, -1).every(x => /^<b>/.test(x.telegram_text) || /<b>/.test(x.telegram_text)), String((tout.match(/Analyse détaillée/g) || []).length));
    }
    {
        const t = fmt('<table><tr><th>Poste</th><th>Montant</th></tr><tr><td>Marjane</td><td>331 DH</td></tr><tr><td>Essence</td><td>300 DH</td></tr></table>')[0].telegram_text;
        v('C. un tableau reste lisible : « Marjane · 331 DH », une ligne par rangée', /Poste · Montant\nMarjane · 331 DH\nEssence · 300 DH/.test(t) && !valideTelegram(t), JSON.stringify(t));
    }
    {
        const t = formater(code, { error: { message: 'Bad <request> & co' } })[0].telegram_text;
        v('D. l\'agent en erreur : l\'alerte arrive, détail échappé', /Alerte Syst/.test(t) && /Bad &lt;request&gt; &amp; co/.test(t) && !valideTelegram(t), JSON.stringify(t));
        const vide = formater(code, { output: '' })[0].telegram_text;
        v('  → réponse vide : alerte, pas de message vide refusé', /Aucune réponse générée/.test(vide) && !valideTelegram(vide));
    }
    {
        const code2 = noeud(w, 'Normalize Input').parameters.jsCode;
        const Async = Object.getPrototypeOf(async function () {}).constructor;
        const norm = async (env, chat) => {
            const fn = new Async('$input', '$env', code2);
            return fn.call({ helpers: { httpRequest: async () => ({ donneesAnnuelles: { 2026: {} } }) } },
                { first: () => ({ json: { message: { chat: { id: chat }, text: 'Mon budget ?' } } }) }, env);
        };
        const libre = await norm({}, 111), refuse = await norm({ TELEGRAM_CHAT_IDS: '4242, 777' }, 111), admis = await norm({ TELEGRAM_CHAT_IDS: '4242, 777' }, 777);
        v('E. sans TELEGRAM_CHAT_IDS : comportement inchangé (tout chat répond)', libre.length === 1 && libre[0].json.session_id === 'tg_111');
        v('  → avec TELEGRAM_CHAT_IDS : un inconnu est ignoré, en silence ; vous, oui', refuse.length === 0 && admis.length === 1 && admis[0].json.session_id === 'tg_777' && admis[0].json.finance_data);
    }
    if (noeud(w, 'If Voice Input')) {
        v('F. audio : plusieurs messages texte, UNE seule réponse vocale (If Voice Input en executeOnce)', noeud(w, 'If Voice Input').executeOnce === true);
    }
}
console.log('  ' + '─'.repeat(80));
console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
