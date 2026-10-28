/**
 * v37.69 — LE WORKFLOW n8n DU CFO DEVIENT UNE COQUILLE.
 *
 *   « Je veux refaire le CFO s'il le faut pour éviter ce genre de problème critique. »
 *   Le contexte envoyé au modèle et ses consignes viennent désormais du VPS (cfo_contexte.php +
 *   cfo_system_prompt.md, mis à jour par git pull) ; le nœud n8n « Build Agent Input » les demande,
 *   et garde une copie de secours identique si le VPS ne répond pas.
 *     A. statique (consignes §0, install.sh cfo / cfo-retour) ·
 *     B. cfo_contexte.php (GET / POST, brut Telegram → lecture_moteur en tête, web tel quel) ·
 *     C. le programme de mise à jour du workflow (2 nœuds seulement, identifiants intacts, idempotent) ·
 *     D. le code du nœud, exécuté comme n8n le ferait : VPS joignable, puis injoignable (secours),
 *        et la copie de secours donne exactement le même contexte que le VPS.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
let ko = 0;
const v = (t, ok, d = '') => { if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(64)} ${ok ? '' : d}`); };
const section = async (nom, f) => { try { await f(); } catch (e) { v(`${nom} : exécution sans exception`, false, String(e && e.stack || e).slice(0, 300)); } };
console.log('\n  LE WORKFLOW DU CFO : UNE COQUILLE, LE CERVEAU SUR LE VPS\n  ' + '─'.repeat(80));

const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
const consignes = lire('cfo_system_prompt.md');
const install = lire('install.sh');

/* ── A. Statique ─────────────────────────────────────────────────────── */
v('A. consignes : « §0 TU LIS, TU NE CALCULES PAS » ; × 4,33 interdit ; alimentation_du_courant',
  /═══ 0\. TU LIS, TU NE CALCULES PAS/.test(consignes) && /ne multiplie JAMAIS un montant par semaine par 4,33/.test(consignes) && /alimentation_du_courant/.test(consignes)
  && !/lis directement le CONTEXTE FINANCIER JSON/.test(consignes) && !/CFO personnel IA de [A-Z]/.test(consignes));
v('  → install.sh : modes « cfo » (sauvegarde, import, publication, vérification) et « cfo-retour »',
  /"\$\{1:-\}" == "cfo" \]\]/.test(install) && /"\$\{1:-\}" == "cfo-retour" \]\]/.test(install) && /n8n_workflows_\$\(date/.test(install)
  && /grep -q 'BUILD AGENT INPUT v3'/.test(install) && (() => { try { execFileSync('bash', ['-n', path.join(RACINE, 'install.sh')]); return true; } catch { return false; } })());

const php = ['php', '/usr/bin/php'].find(p => { try { execFileSync(p, ['-v'], { stdio: 'ignore' }); return true; } catch { return false; } });
if (!php) {
    console.log('  ⏭️  partie PHP ignorée (php absent)');
    console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
    process.exit(ko === 0 ? 0 : 1);
}
const portLibre = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const doc = fs.mkdtempSync(path.join(os.tmpdir(), 'cfo-coq-'));
fs.mkdirSync(path.join(doc, 'finance'));
for (const f of ['cfo_contexte.php', 'cfo_system_prompt.md']) fs.copyFileSync(path.join(RACINE, f), path.join(doc, 'finance', f));
const port = await portLibre();
const srv = spawn(php, ['-S', '127.0.0.1:' + port, '-t', doc], { stdio: 'ignore' });
for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${port}/finance/cfo_contexte.php`); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
const URL0 = `http://127.0.0.1:${port}/finance/cfo_contexte.php`;

//  Un JSON brut de serveur (fictif), tel que Telegram le charge
const brut = {
    version: '37.69', _schemaVersion: 23,
    soldesInitiaux: { anneeActuelle: 2026, jourDePaie: 27, categories: [{ id: 'c1', label: 'Courses' }, { id: 'c2', label: 'Vieille', archive: true }] },
    comptes: [{ id: 'acc_cc', label: 'Compte Courant', type: 'liquide', solde: 5000, icone: '💳' }, { id: 900, label: 'Compte Salaire', type: 'liquide', solde: 1000 }],
    donneesAnnuelles: {
        2026: { revenus: { salaire: { label: 'SALAIRE', base: 20000, destinationCompte: 'cpt_900' } }, chargesFixes: { credit: { label: 'CRÉDIT', valeur: 5000 } },
                epargne: [{ label: 'Urgence', valeur: 1000 }], depensesIrregulieres: [{ nom: 'Pneus', montant: 800 }], transactionsReelles: [{ id: 1 }, { id: 2 }] },
        2027: { revenus: { salaire: { label: 'SALAIRE', base: 21000, destinationCompte: 'cpt_900' } }, chargesFixes: {}, epargne: [{ label: 'Urgence', valeur: 1500 }],
                depensesIrregulieres: [], transactionsReelles: [] },
    },
    wealthGoals: [{ name: 'Voyage', target: 9000, current: 1000, extra: 'x' }],
    masterAssets: [{ id: 'a1', name: 'Studio', isProductive: true, value: 500000, valeur_actuelle: 520000, revenue: 30000, apport_personnel: 1, montant_credit: 2, note: 'x' }],
    gConfig: { clientId: 'x' }, parametres: { theme: 'x' },
    _lectureCFO: { regle: 'v37.67 — …', alimentation_du_courant: { virement_permanent_conseille: 2100, compte_du_salaire: 'Compte Salaire' } },
};
const web = { annee: 2026, matrice_cash_flow_calculee: '=== MATRICE ===', alimentation_du_courant: { virement_permanent_conseille: 2100 } };
const poster = async (corps) => (await fetch(URL0, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })).json();
//  Comparaison profonde, insensible à l'ordre des clés et à {} ↔ [] (PHP rend un objet vide en tableau)
const canon = (x) => Array.isArray(x) ? (x.length ? x.map(canon) : []) : (x && typeof x === 'object'
    ? (Object.keys(x).length ? Object.keys(x).sort().reduce((o, k) => { o[k] = canon(x[k]); return o; }, {}) : []) : x);

try {
    /* ── B. cfo_contexte.php ─────────────────────────────────────────── */
    let viaVps = null;
    await section('B', async () => {
        const g = await (await fetch(URL0)).json();
        v('B. GET : les consignes du dépôt, telles quelles (version 37.69)', g.version === '37.69' && g.system_message === consignes, String(g.version));
        const r = await poster({ question: 'combien virer ?', historique: '', finance_data: brut });
        const c = JSON.parse(r.finance_data_json);
        viaVps = c;
        v('  → brut (Telegram) : lecture_moteur EN TÊTE (conseillé 2 100) + son mode d\'emploi',
          Object.keys(c)[0] === 'lecture_moteur' && c.lecture_moteur.alimentation_du_courant.virement_permanent_conseille === 2100 && /JAMAIS à recalculer/.test(c.lecture_moteur_mode_emploi), Object.keys(c).join(','));
        v('  → borné à 2026 (sans les transactions, 2 masquées), 2027 résumé (versement 1 500), sans gConfig ni paramètres',
          r.exercice_expose === 2026 && JSON.stringify(Object.keys(c.donneesAnnuelles)) === '["2026"]' && !('transactionsReelles' in c.donneesAnnuelles['2026'])
          && c._contexte.transactions_reelles_masquees === 2 && c._contexte.autres_exercices_resume[0].total_versements_planifies === 1500 && !('gConfig' in c) && !('parametres' in c)
          && JSON.stringify(c.soldesInitiaux.categories) === '[{"id":"c1","label":"Courses"}]', JSON.stringify(c._contexte));
        const r27 = await poster({ question: 'et mes versements ?', historique: '[User]: et en 2027 ?', finance_data: brut });
        v('  → l\'année citée plus tôt dans la conversation (2027) est celle exposée', r27.exercice_expose === 2027, String(r27.exercice_expose));
        const w = await poster({ question: 'x', historique: '', finance_data: web });
        v('  → payload de l\'appli web (déjà calculé) : transmis tel quel', JSON.stringify(JSON.parse(w.finance_data_json)) === JSON.stringify(web) && w.exercice_expose === null, w.finance_data_json);
    });

    /* ── C. Le programme de mise à jour du workflow ───────────────────── */
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cfo-wf-'));
    let wfLocal = null;
    await section('C', async () => {
        //  Un export n8n « --all » : le workflow CFO (version d'avant, actif) + un autre
        const origine = JSON.parse(lire('super_agent_cfo_audio.json'));
        const avant = JSON.parse(JSON.stringify(origine));
        const iB = avant.nodes.findIndex(n => n.name === 'Build Agent Input'), iA = avant.nodes.findIndex(n => n.name === 'AI Agent');
        avant.nodes[iB].parameters.jsCode = '// BUILD AGENT INPUT v2\nreturn [];';
        avant.nodes[iA].parameters.options.systemMessage = 'Tu es le CFO (ancienne version).';
        Object.assign(avant, { id: 'wfCFO1', active: true });
        const autre = { id: 'wfX', name: 'PCRF Reporting', active: true, nodes: [{ name: 'Cron', parameters: {} }] };
        fs.writeFileSync(path.join(tmp, 'export.json'), JSON.stringify([autre, avant]));
        const res = JSON.parse(execFileSync(php, [path.join(RACINE, 'n8n/maj_workflow_cfo.php'), path.join(tmp, 'export.json'), path.join(tmp, 'sortie.json')], { encoding: 'utf8' }));
        const apres = JSON.parse(fs.readFileSync(path.join(tmp, 'sortie.json'), 'utf8'));
        const diff = apres.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(avant.nodes[i])).map(n => n.name);
        v('C. le workflow CFO est trouvé (actif, id gardé), l\'autre ignoré ; adresse du VPS lue dans Normalize Input',
          res.id === 'wfCFO1' && res.actif === true && /^https:\/\//.test(res.base) && res.deja_a_jour === false && apres.id === 'wfCFO1' && apres.active === true, JSON.stringify(res));
        v('  → seuls « Build Agent Input » et « AI Agent » changent ; identifiants et connexions intacts',
          JSON.stringify(diff.slice().sort()) === '["AI Agent","Build Agent Input"]'
          && JSON.stringify(apres.connections) === JSON.stringify(avant.connections)
          && JSON.stringify(apres.nodes.map(n => n.credentials || null)) === JSON.stringify(avant.nodes.map(n => n.credentials || null)), JSON.stringify(diff));
        const b = apres.nodes[iB].parameters.jsCode;
        v('  → Build Agent Input v3 (appel du VPS + consignes de secours = le dépôt) ; AI Agent lit {{ $json.system_message }}',
          /BUILD AGENT INPUT v3/.test(b) && b.includes(res.base + '/finance/cfo_contexte.php') && b.includes(JSON.stringify(consignes)) && !/__PROMPT_SECOURS__|__FINANCE_BASE__/.test(b)
          && apres.nodes[iA].parameters.options.systemMessage === '={{ $json.system_message }}' && apres.nodes[iA].parameters.options.maxIterations === avant.nodes[iA].parameters.options.maxIterations, '');
        const res2 = JSON.parse(execFileSync(php, [path.join(RACINE, 'n8n/maj_workflow_cfo.php'), path.join(tmp, 'sortie.json'), path.join(tmp, 'sortie2.json')], { encoding: 'utf8' }));
        v('  → rejoué : « déjà à jour », fichier identique', res2.deja_a_jour === true && fs.readFileSync(path.join(tmp, 'sortie.json'), 'utf8') === fs.readFileSync(path.join(tmp, 'sortie2.json'), 'utf8'), JSON.stringify(res2));
        //  Le bot Telegram : workflow branché sur un autre bot (« santé ») → rebranché sur l'identifiant « CFO »
        const sante = JSON.parse(JSON.stringify(avant));
        sante.nodes.forEach(n => { if (n.credentials && n.credentials.telegramApi) n.credentials.telegramApi = { id: 'santeID', name: 'Telegram santé  account' }; });
        fs.writeFileSync(path.join(tmp, 'sante.json'), JSON.stringify([sante]));
        fs.writeFileSync(path.join(tmp, 'creds.json'), JSON.stringify([{ id: 'santeID', name: 'Telegram santé  account', type: 'telegramApi', data: 'chiffré' },
            { id: 'CFOV2TelegramAPI', name: 'CFO V2 Telegram API', type: 'telegramApi', data: 'chiffré' }, { id: 'pg', name: 'charif_finance_db', type: 'postgres', data: 'chiffré' }]));
        const rt = JSON.parse(execFileSync(php, [path.join(RACINE, 'n8n/maj_workflow_cfo.php'), path.join(tmp, 'sante.json'), path.join(tmp, 'sante_sortie.json'), path.join(tmp, 'creds.json')], { encoding: 'utf8' }));
        const st = JSON.parse(fs.readFileSync(path.join(tmp, 'sante_sortie.json'), 'utf8'));
        const tg = st.nodes.filter(n => n.credentials && n.credentials.telegramApi).map(n => n.credentials.telegramApi.id);
        v('  → branché sur « Telegram santé » : les 4 nœuds Telegram rebranchés sur « CFO V2 Telegram API », les autres identifiants intacts',
          tg.length === 4 && tg.every(x => x === 'CFOV2TelegramAPI') && rt.telegram.apres === 'CFO V2 Telegram API' && JSON.stringify(rt.telegram.avant) === '["Telegram santé  account"]'
          && JSON.stringify(st.nodes.filter(n => n.credentials && !n.credentials.telegramApi).map(n => n.credentials)) === JSON.stringify(avant.nodes.filter(n => n.credentials && !n.credentials.telegramApi).map(n => n.credentials)), JSON.stringify(rt.telegram));
        const rt2 = JSON.parse(execFileSync(php, [path.join(RACINE, 'n8n/maj_workflow_cfo.php'), path.join(tmp, 'sante_sortie.json'), path.join(tmp, 'sante2.json'), path.join(tmp, 'creds.json')], { encoding: 'utf8' }));
        fs.writeFileSync(path.join(tmp, 'creds2.json'), JSON.stringify([{ id: 'a', name: 'CFO A', type: 'telegramApi' }, { id: 'b', name: 'CFO B', type: 'telegramApi' }]));
        const rt3 = JSON.parse(execFileSync(php, [path.join(RACINE, 'n8n/maj_workflow_cfo.php'), path.join(tmp, 'sante.json'), path.join(tmp, 'sante3.json'), path.join(tmp, 'creds2.json')], { encoding: 'utf8' }));
        const st3 = JSON.parse(fs.readFileSync(path.join(tmp, 'sante3.json'), 'utf8'));
        v('  → rejoué : déjà à jour ; deux identifiants « CFO » possibles : rien n\'est rebranché (pas de devinette)',
          rt2.deja_a_jour === true && rt3.telegram.apres === null && st3.nodes.filter(n => n.credentials && n.credentials.telegramApi).every(n => n.credentials.telegramApi.id === 'santeID'), JSON.stringify([rt2, rt3.telegram]));
        //  Le schéma de l'outil « Tool: Intent Compiler » suit celui du dépôt (nouveaux paramètres connus du modèle)
        const vieux = JSON.parse(JSON.stringify(avant));
        vieux.nodes.find(n => n.name === 'Tool: Intent Compiler').parameters.inputSchema = '{"type":"object","properties":{}}';
        fs.writeFileSync(path.join(tmp, 'vieux.json'), JSON.stringify([vieux]));
        const rs = JSON.parse(execFileSync(php, [path.join(RACINE, 'n8n/maj_workflow_cfo.php'), path.join(tmp, 'vieux.json'), path.join(tmp, 'vieux_sortie.json')], { encoding: 'utf8' }));
        const sv = JSON.parse(fs.readFileSync(path.join(tmp, 'vieux_sortie.json'), 'utf8'));
        const schemaDepot = JSON.parse(lire('super_agent_cfo_audio.json')).nodes.find(n => n.name === 'Tool: Intent Compiler').parameters.inputSchema;
        v('  → schéma de l\'outil Intent Compiler resynchronisé sur le dépôt (destination_account connu du modèle)',
          rs.schema_outil === 'mis à jour' && sv.nodes.find(n => n.name === 'Tool: Intent Compiler').parameters.inputSchema === schemaDepot && schemaDepot.includes('destination_account'), JSON.stringify(rs));
        const depot = JSON.parse(lire('super_agent_cfo_audio.json'));
        v('  → le fichier du dépôt est déjà à jour (même code que celui installé)',
          depot.nodes.find(n => n.name === 'Build Agent Input').parameters.jsCode === b && depot.nodes.find(n => n.name === 'AI Agent').parameters.options.systemMessage === '={{ $json.system_message }}', '');
        //  Pour D : la même mise à jour, l'adresse du VPS pointant sur le serveur de test
        const local = JSON.parse(JSON.stringify(avant));
        const iN = local.nodes.findIndex(n => n.name === 'Normalize Input');
        local.nodes[iN].parameters.jsCode = local.nodes[iN].parameters.jsCode.replace(/https?:\/\/[^'"\s`]+?\/finance\/save_data\.php/g, `http://127.0.0.1:${port}/finance/save_data.php`);
        fs.writeFileSync(path.join(tmp, 'local.json'), JSON.stringify(local));
        execFileSync(php, [path.join(RACINE, 'n8n/maj_workflow_cfo.php'), path.join(tmp, 'local.json'), path.join(tmp, 'local_sortie.json')]);
        wfLocal = JSON.parse(fs.readFileSync(path.join(tmp, 'local_sortie.json'), 'utf8'));
    });

    /* ── D. Le code du nœud, exécuté comme n8n ───────────────────────── */
    await section('D', async () => {
        const code = wfLocal.nodes.find(n => n.name === 'Build Agent Input').parameters.jsCode;
        const Async = Object.getPrototypeOf(async function () {}).constructor;
        const executer = async (code, normalized) => {
            const f = new Async('$', '$input', '$env', 'Buffer', code);
            const helpers = { httpRequest: async ({ method, url, body, headers }) => {
                const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...(headers || {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            } };
            const $ = () => ({ first: () => ({ json: normalized }) });
            const $input = { all: () => [{ json: { msg_json: JSON.stringify({ type: 'human', data: { content: 'et en 2026 ?' } }) } }] };
            return (await f.call({ helpers }, $, $input, {}, Buffer))[0].json;
        };
        const normalized = { source: 'telegram', session_id: 'tg_1', chat_id: '1', question: 'combien virer sur le courant ?', finance_data: brut, finance_data_json: JSON.stringify(brut), finance_data_raw: null, finance_data_loaded_from: 'vps_save_data_php' };
        //  Un git pull a changé les consignes sur le VPS : le nœud doit suivre, sans réinstallation
        const majVps = consignes + '\n\n═══ 12. RÈGLE AJOUTÉE PAR UN GIT PULL ═══\nTest.';
        fs.writeFileSync(path.join(doc, 'finance', 'cfo_system_prompt.md'), majVps);
        const o = await executer(code, normalized);
        const cv = JSON.parse(o.finance_data_json);
        v('D. VPS joignable : consignes (mises à jour par un git pull) et contexte du VPS, lecture_moteur en tête',
          o.contexte_source === 'vps 37.69' && o.system_message === majVps && Object.keys(cv)[0] === 'lecture_moteur' && o.exercice_expose === 2026 && o.contexte_erreur === null, JSON.stringify([o.contexte_source, o.contexte_erreur]));
        v('  → les outils gardent le JSON complet (finance_data intact)', o.finance_data === brut || JSON.stringify(o.finance_data) === JSON.stringify(brut), '');
        srv.kill();
        await new Promise(r => setTimeout(r, 300));
        const s = await executer(code, normalized);
        const cs = JSON.parse(s.finance_data_json);
        v('  → VPS injoignable : la copie de secours (mêmes consignes que le dépôt), et le CFO répond quand même',
          s.contexte_source === 'secours' && !!s.contexte_erreur && s.system_message === consignes && Object.keys(cs)[0] === 'lecture_moteur', JSON.stringify([s.contexte_source, s.contexte_erreur]));
        v('  → la copie de secours donne EXACTEMENT le même contexte que le VPS',
          JSON.stringify(canon(cs)) === JSON.stringify(canon(cv)), JSON.stringify(canon(cs)).slice(0, 200) + ' ≠ ' + JSON.stringify(canon(cv)).slice(0, 200));
        void viaVps;
    });
} finally {
    try { srv.kill(); } catch { /* déjà arrêté */ }
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
