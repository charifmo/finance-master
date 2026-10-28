/**
 * v37.73 — L'ATTENTE DU CFO : UN CHRONOMÈTRE ET SES VRAIES ÉTAPES, SANS UN TOKEN.
 *
 *   « Un timer est mieux, et une animation dynamique mieux que « Le CFO analyse… ».
 *     Aussi tracker les étapes si ce n'est pas consommateur de tokens. »
 *   Le VPS note une étape quand le CFO y passe (cfo_etapes.php) ; l'appli la relit pendant l'attente.
 *   Et un virement programmé vers le Compte Courant s'affichait sans destination (« cpt_<id> »).
 *   Décor fictif (KARIM TESTEUR).
 *     A. statique · B. le VPS note les étapes (vrai PHP, vrai serveur) · C. l'attente à l'écran ·
 *     D. virement vers le Courant (chargement + moteur).
 */
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8').split('\r\n').join('\n');
const html = lire('index.html');

let ko = 0;
const v = (t, ok, d = '') => { if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(64)} ${ok ? '' : d}`); };
const section = async (nom, f) => { try { await f(); } catch (e) { v(`${nom} : exécution sans exception`, false, String(e && e.stack || e).slice(0, 300)); } };
const attendre = (ms) => new Promise(r => setTimeout(r, ms));
console.log('\n  L\'ATTENTE DU CFO : CHRONOMÈTRE ET ÉTAPES\n  ' + '─'.repeat(80));

/* ── A. Statique ─────────────────────────────────────────────────────── */
v('A. plus de « Le CFO analyse… » ; deux attentes (bureau, téléphone) avec chronomètre et étapes',
  !html.includes('Le CFO analyse…') && (html.match(/data-cfo-attente/g) || []).length === 2 && (html.match(/data-cfo-chrono/g) || []).length === 2 && (html.match(/data-cfo-etape /g) || []).length === 2);
const bai = lire('n8n/build_agent_input.js');
v('  → Build Agent Input transmet le session_id au VPS (requête HTTP), jamais dans le prompt',
  /finance_data: _sourceContexte \|\| null, session_id: normalized\.session_id \|\| null \}/.test(bai) && !/system_message[^\n]*session_id/.test(bai));
const wf = JSON.parse(lire('super_agent_cfo_audio.json'));
v('  → le workflow du dépôt porte ce code (install.sh cfo l\'installe)',
  wf.nodes.find(n => n.name === 'Build Agent Input').parameters.jsCode.includes('session_id: normalized.session_id || null }'));

const essai = (f) => { try { return f(); } catch { return null; } };
const php = essai(() => execFileSync('php', ['-r', 'echo PHP_BINARY;'], { encoding: 'utf8' }).trim());

/* ── B. Le VPS note les étapes ───────────────────────────────────────── */
await section('B', async () => {
    if (!php) { console.log('  ⏭️  partie PHP ignorée (php absent)'); return; }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'attente-'));
    const doc = path.join(tmp, 'www'); fs.mkdirSync(path.join(doc, 'finance'), { recursive: true });
    for (const f of ['cfo_etapes.php', 'cfo_contexte.php', 'cfo_system_prompt.md', 'pending_commit.php', 'cfo_intent_engine.php', 'cfo_integrity.php'])
        fs.copyFileSync(path.join(RACINE, f), path.join(doc, 'finance', f));
    const port = 20000 + Math.floor(Math.random() * 20000);
    const srv = spawn(php, ['-S', `127.0.0.1:${port}`, '-t', doc], { stdio: 'ignore' });
    try {
        const U = `http://127.0.0.1:${port}/finance/`;
        for (let i = 0; i < 50; i++) { try { await fetch(U + 'cfo_etapes.php'); break; } catch { await attendre(100); } }
        const post = (f, b) => fetch(U + f, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json());
        const etapes = (sid) => fetch(U + 'cfo_etapes.php?session_id=' + encodeURIComponent(sid)).then(r => r.json());
        const fd = {
            soldesInitiaux: { anneeActuelle: 2026, moisActuel: 11, jourDePaie: 27 },
            comptes: [{ id: 'acc_cc', label: 'Compte Courant', type: 'liquide', solde: 5000 }, { id: 900, label: 'Compte Salaire', type: 'liquide', solde: 3000 }],
            donneesAnnuelles: { 2026: { revenus: {}, chargesFixes: {}, chargesVariables: {}, depensesIrregulieres: [], epargne: [], virementsInternes: [] } },
            wealthGoals: [], masterAssets: [],
        };
        const SID = 'web_karim-testeur', AUTRE = 'tg_99';
        await post('cfo_contexte.php', { question: 'Combien virer ?', historique: '', finance_data: fd, session_id: SID });
        await attendre(60);
        const sim = await post('pending_commit.php', { session_id: SID, finance_data: fd, annee_contexte: 2026,
            calls: [{ function: 'plan_transfer', args: { from_account: 'Compte Salaire', to_account: 'Compte Courant', amount: 6500, month: 12, day: 20 } }] });
        await attendre(60);
        await post('pending_commit.php', { session_id: SID, finance_data: fd, calls: [{ function: 'plan_transfer', args: { from_account: 'Compte Salaire', to_account: 'Compte Salaire', amount: 10, month: 12 } }] });
        const pend = await fetch(U + 'pending_commit.php?session_id=' + SID).then(r => r.json());
        await post('pending_commit.php', { session_id: SID, action: 'cancel_pending' });
        await post('cfo_contexte.php', { question: 'Autre', historique: '', finance_data: fd, session_id: AUTRE });
        await post('cfo_contexte.php', { question: 'Sans session', historique: '', finance_data: fd });
        const E = await etapes(SID), A = await etapes(AUTRE), V = await etapes('inconnue');
        const codes = E.etapes.map(e => e.code), libs = E.etapes.map(e => e.libelle);
        v('B. une conversation : contexte → simulation → simulation refusée → OUI relu → annulation, dans l\'ordre',
          JSON.stringify(codes) === JSON.stringify(['contexte', 'simulation', 'simulation', 'validation', 'annulation']), JSON.stringify(E));
        v('  → libellés : exercice transmis, opérations prêtes, refus, OUI relu',
          libs[0] === 'Vos chiffres transmis au CFO (exercice 2026)' && libs[1] === 'Simulation prête : 1 opération(s)' && /^Simulation refusée/.test(libs[2])
          && libs[3] === 'Votre OUI : simulation relue pour écriture' && libs[4] === 'Simulation annulée', JSON.stringify(libs));
        v('  → chaque étape avec son âge (la plus ancienne d\'abord), sans dépendre de l\'horloge de l\'appli',
          E.etapes.every((e, i) => Number.isInteger(e.il_y_a_ms) && e.il_y_a_ms >= 0 && (i === 0 || e.il_y_a_ms <= E.etapes[i - 1].il_y_a_ms)) && E.etapes[0].il_y_a_ms >= 100 && !('t' in E.etapes[0]), JSON.stringify(E.etapes));
        v('  → la simulation elle-même inchangée (pending enregistré, virement vers « courant »)',
          sim.pending_saved === true && pend.finance_data.donneesAnnuelles['2026'].virementsInternes[0].destinationCompte === 'courant', JSON.stringify([sim.pending_saved, pend.finance_data && pend.finance_data.donneesAnnuelles['2026'].virementsInternes]));
        v('  → chaque conversation a son suivi ; une inconnue : rien ; sans session_id : rien n\'est noté',
          A.etapes.length === 1 && A.etapes[0].code === 'contexte' && V.etapes.length === 0 && fs.readdirSync(path.join(doc, 'finance', 'pending', 'etapes')).length === 2, JSON.stringify([A, V]));
        for (let i = 0; i < 35; i++) execFileSync(php, ['-r', `$_SERVER['SCRIPT_FILENAME']='x'; require '${path.join(doc, 'finance', 'cfo_etapes.php')}'; cfo_etape_noter('${AUTRE}', 'contexte', 'n${i}');`]);
        const A2 = await etapes(AUTRE);
        v('  → suivi borné (30 dernières étapes)', A2.etapes.length === 30 && A2.etapes[29].libelle === 'n34', String(A2.etapes.length));
        // cfo_etapes.php absent (VPS pas encore à jour) : rien ne casse
        fs.unlinkSync(path.join(doc, 'finance', 'cfo_etapes.php'));
        const sim2 = await post('pending_commit.php', { session_id: 'web_x', finance_data: fd, calls: [{ function: 'plan_transfer', args: { from_account: 'Compte Salaire', to_account: 'Compte Courant', amount: 100, month: 12 } }] });
        const ctx2 = await post('cfo_contexte.php', { question: 'q', historique: '', finance_data: fd, session_id: 'web_x' });
        v('  → sans cfo_etapes.php : simulation et contexte fonctionnent comme avant', sim2.pending_saved === true && ctx2.system_message.length > 200, JSON.stringify([sim2.pending_saved, sim2.error]));
    } finally { srv.kill(); fs.rmSync(tmp, { recursive: true, force: true }); }
});

/* ── C/D. L'appli ────────────────────────────────────────────────────── */
const require = createRequire(import.meta.url);
const pw = essai(() => require('playwright-core'));
const vueJs = essai(() => require.resolve('vue/dist/vue.global.js'));
const chartJs = essai(() => fs.existsSync(path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js')) && path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js'));
const chromium = process.env.CHROMIUM || ['/opt/pw-browsers/chromium'].find(p => essai(() => fs.existsSync(p) && fs.statSync(p).isFile()));
if (!pw || !vueJs || !chartJs || !chromium) {
    console.log('  ⏭️  partie navigateur ignorée (playwright-core, vue, chart.js ou Chromium absent)');
    console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
    process.exit(ko === 0 ? 0 : 1);
}

const fixture = () => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    fx._schemaVersion = 24;
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = { 2026: JSON.parse(JSON.stringify(base)) };
    Object.assign(fx.soldesInitiaux, { moisActuel: 11, anneeActuelle: 2026, jourDePaie: 27, compteChargesFixes: 'courant', compteChargesVariables: 'courant', assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.soldesInitiaux.categories = [];
    fx.comptes = [{ id: 'acc_cc', label: 'Compte Courant', type: 'liquide', solde: 5000, icone: '💳' },
                  { id: 900, label: 'Compte Salaire', type: 'liquide', solde: 9000, icone: '🏦' }];
    const d = fx.donneesAnnuelles[2026];
    d.epargne = []; d.depensesIrregulieres = []; d.consoRealiseeT0 = {}; d.consoClotureT0 = {}; d.banqueOperations = {}; d.transactionsReelles = [];
    d.virementsInternes = [{ id: 77, mois: 12, sourceCompte: 'cpt_900', destinationCompte: 'cpt_acc_cc', montant: 6500, jourPrevu: 20 },
                           { id: 78, mois: 12, sourceCompte: 'cpt_acc_cc', destinationCompte: 'cpt_900', montant: 50 }];
    return fx;
};
const page0 = html
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, '')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');
//  Faux VPS : le webhook répond en 4,5 s ; pendant ce temps cfo_etapes.php renvoie les étapes nées
//  depuis l'arrivée de la question (contexte à +0,5 s, simulation à +2 s), plus une étape d'un tour PRÉCÉDENT.
let t0 = 0, sidVu = null, sondages = 0;
const srv = http.createServer((req, res) => {
    const [p, q] = req.url.split('?');
    const s = (c, b, t = 'application/json') => { res.writeHead(c, { 'Content-Type': t }); res.end(b); };
    if (p === '/finance/') return s(200, page0, 'text/html; charset=utf-8');
    if (p === '/vue.js') return s(200, fs.readFileSync(vueJs), 'text/javascript');
    if (p === '/chart.js') return s(200, fs.readFileSync(chartJs), 'text/javascript');
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fixture()));
    if (p === '/webhook/cfo') { t0 = Date.now(); return setTimeout(() => s(200, JSON.stringify({ html: '<p>Réponse du CFO</p>' })), 4500); }
    if (p === '/finance/cfo_etapes.php') {
        sondages++; sidVu = new URLSearchParams(q).get('session_id');
        const now = Date.now(), e = [{ code: 'validation', libelle: 'Étape du tour précédent', il_y_a_ms: now - t0 + 60000 }];
        if (t0 && now >= t0 + 500) e.push({ code: 'contexte', libelle: 'Vos chiffres transmis au CFO (exercice 2026)', il_y_a_ms: now - t0 - 500 });
        if (t0 && now >= t0 + 2000) e.push({ code: 'simulation', libelle: 'Simulation prête : 1 opération(s)', il_y_a_ms: now - t0 - 2000 });
        return s(200, JSON.stringify({ etapes: e, maintenant: now }));
    }
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
const erreurs = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('pageerror', e => erreurs.push(String(e)));
await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
await page.waitForTimeout(1500);

try {
    await section('C', async () => {
        await page.evaluate(([ST, port]) => { const st = eval(ST); st.cfoWebhookUrl = `http://127.0.0.1:${port}/webhook/cfo`; st.showCfoModal = true; }, [ST, port]);
        await page.waitForTimeout(400);
        const sid = await page.evaluate((ST) => { const st = eval(ST); st.consulterCFO('Combien virer vers le Courant ?'); return st.cfoSessionId; }, ST);
        await page.waitForTimeout(600);
        const debut = await page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST).cfoAttente)), ST);
        await page.waitForTimeout(2900);
        const C = await page.evaluate((ST) => { const st = eval(ST), bloc = [...document.querySelectorAll('[data-cfo-attente]')].find(e => e.offsetParent !== null);
            return { a: JSON.parse(JSON.stringify(st.cfoAttente)), vu: !!bloc, chrono: bloc && bloc.querySelector('[data-cfo-chrono]').textContent.trim(),
                     lignes: bloc ? [...bloc.querySelectorAll('[data-cfo-etape]')].map(l => l.textContent.replace(/\s+/g, ' ').trim()) : [], barre: !!(bloc && bloc.querySelector('.cfo-barre > span')) }; }, ST);
        const sec = parseFloat(String(C.chrono).replace(',', '.'));
        v('C. pendant l\'attente : un chronomètre qui avance (dixièmes, « 3,5 s »), une barre qui court',
          C.vu && /^\d+,\d s$/.test(C.chrono) && sec >= 3 && sec < 4.5 && C.barre && /^0,\d s$/.test(debut.chrono), JSON.stringify([debut.chrono, C.chrono]));
        v('  → les étapes du VPS apparaissent, avec leur instant depuis l\'envoi',
          C.lignes.length === 3 && /^✓\s*Question envoyée\s*0,0 s$/.test(C.lignes[0]) && /^✓\s*Vos chiffres transmis au CFO \(exercice 2026\)\s*0,[3-9] s$/.test(C.lignes[1]) && /^✓\s*Simulation prête : 1 opération\(s\)\s*[12],\d s$/.test(C.lignes[2]), JSON.stringify(C.lignes));
        v('  → l\'étape d\'un tour précédent n\'est pas reprise ; le suivi est celui de cette conversation',
          !C.lignes.some(l => l.includes('tour précédent')) && sidVu === sid && sondages >= 2, JSON.stringify([sidVu, sid, sondages]));
        v('  → la phrase suit le CFO : à l\'envoi, puis après la simulation',
          /Envoi|reçoit/.test(debut.actif) && /simulation/i.test(C.a.actif), JSON.stringify([debut.actif, C.a.actif]));
        await page.waitForFunction((ST) => !eval(ST).cfoLoading, ST, { timeout: 10000 });
        await page.waitForTimeout(300);
        const F = await page.evaluate((ST) => ({ chrono: eval(ST).cfoAttente.chrono, vu: [...document.querySelectorAll('[data-cfo-attente]')].length }), ST);
        const s1 = sondages; await page.waitForTimeout(1800);
        const F2 = await page.evaluate((ST) => ({ chrono: eval(ST).cfoAttente.chrono, rep: eval(ST).cfoMessages.some(m => m.role === 'agent' && /Réponse du CFO/.test(m.content)) }), ST);
        v('  → à la réponse : l\'attente disparaît, la réponse s\'affiche, chronomètre et relecture s\'arrêtent',
          F.vu === 0 && F2.rep && F2.chrono === F.chrono && sondages === s1, JSON.stringify([F, F2, s1, sondages]));
        //  Téléphone : la même attente
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate((ST) => { const st = eval(ST); st.showCfoModal = false; st.isMobile = true; st.activeMobileTab = 'cfo'; st.consulterCFO('Et en janvier ?'); }, ST);
        await page.waitForTimeout(1200);
        const M = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-cfo-attente]')].find(e => e.offsetParent !== null); return b ? b.querySelector('[data-cfo-chrono]').textContent.trim() : null; });
        v('  → sur téléphone aussi : chronomètre visible', /^[01],\d s$/.test(M || ''), String(M));
        await page.waitForFunction((ST) => !eval(ST).cfoLoading, ST, { timeout: 10000 });
        await page.setViewportSize({ width: 1280, height: 900 });
    });

    await section('D', async () => {
        const D = await page.evaluate((ST) => { const st = eval(ST);
            return { v: JSON.parse(JSON.stringify(st.donneesAnnuelles[2026].virementsInternes)), log: st.serverLogs.map(l => l.msg).filter(m => /^🔄/.test(m)),
                     nom: st.getNomCompte(st.donneesAnnuelles[2026].virementsInternes[0].destinationCompte) }; }, ST);
        v('D. virement « cpt_<id du Courant> » chargé : destination et source rétablies en « courant »',
          D.v[0].destinationCompte === 'courant' && D.v[0].sourceCompte === 'cpt_900' && D.v[1].sourceCompte === 'courant' && D.v[1].destinationCompte === 'cpt_900', JSON.stringify(D.v));
        v('  → le journal le dit ; montant et jour inchangés', D.log.length === 1 && /^🔄 2 virement/.test(D.log[0]) && D.v[0].montant === 6500 && D.v[0].jourPrevu === 20, JSON.stringify(D.log));
        const S = await page.evaluate(async (ST) => { const st = eval(ST); st.anneeAffichage = 2026; st.appMode = 'previsionnel'; st.activeTab = 'irregulieres';
            await new Promise(r => setTimeout(r, 800));
            const sels = [...document.querySelectorAll('select[title="Compte destination"]')].filter(s => s.offsetParent !== null);
            return sels.map(s => s.options[s.selectedIndex] ? s.options[s.selectedIndex].textContent.trim() : ''); }, ST);
        v('  → le calendrier affiche « 💳 Courant » dans la case « vers » (plus de case vide)', S.length >= 1 && S.includes('💳 Courant') && !S.includes(''), JSON.stringify(S));
        const R = await page.evaluate((ST) => { const st = eval(ST), d = { comptes: [{ id: 'c1', type: 'liquide' }], donneesAnnuelles: { 2026: { virementsInternes: [{ sourceCompte: 'courant', destinationCompte: 'cpt_9' }] } } };
            return [st.virementsVersCourant(d), st.virementsVersCourant(d)]; }, ST);
        v('  → rien à faire quand c\'est déjà juste (idempotent)', JSON.stringify(R) === '[0,0]', JSON.stringify(R));
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
