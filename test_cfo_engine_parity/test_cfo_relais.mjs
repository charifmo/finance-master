/**
 * v37.115 — LA RÉPONSE DU CFO NE SE PERD PLUS (cfo_relais.php).
 *
 *   « Ça tourne puis ça donne une erreur, car j'ai reçu un appel : je ne veux pas attendre des minutes sans pouvoir
 *   utiliser mon téléphone. »  La question passe par le VPS, qui attend la réponse de n8n à la place du téléphone et
 *   la garde ; revenu sur l'appli, le téléphone la relit.
 *
 *   Vrai PHP (php -S, plusieurs workers), faux n8n (lent), l'appli servie par le même serveur :
 *     A. le relais seul : le téléphone part au bout de 0,3 s, la réponse arrive quand même et est gardée
 *     B. ce qu'il refuse (adresse, rid, origine) · C. n8n injoignable d'ici : dit, l'appli repasse en direct
 *     D. l'appli : une question normale passe par le relais · E. connexion coupée pendant l'attente : la réponse
 *        s'affiche quand même, une seule question au CFO · F. l'onglet fermé puis rouvert : réponse retrouvée
 *     G. relais injoignable : la question part en direct, une seule fois
 */
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import net from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
let ko = 0, n = 0;
const v = (t, ok, d = '') => { n++; if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(78)} ${ok ? '' : String(d).slice(0, 600)}`); };
const section = async (nom, f) => { try { await f(); } catch (e) { v(`${nom} : exécution sans exception`, false, String(e && e.stack || e).slice(0, 400)); } };
const attendre = (ms) => new Promise(r => setTimeout(r, ms));
console.log('\n  LA RÉPONSE DU CFO NE SE PERD PLUS (RELAIS)\n  ' + '─'.repeat(80));

const essai = (f) => { try { return f(); } catch { return null; } };
const php = essai(() => execFileSync('which', ['php']).toString().trim());
if (!php) { console.log('  ⏭️  PHP absent : suite ignorée'); console.log('  ✅ TOUT PASSE — 0 contrôle'); process.exit(0); }
const portLibre = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const attendrePort = async (p) => { for (let i = 0; i < 100; i++) { const ok = await new Promise(r => { const c = net.connect(p, '127.0.0.1', () => { c.end(); r(true); }); c.on('error', () => r(false)); }); if (ok) return; await attendre(50); } throw new Error('port ' + p); };
const attendreQue = async (f, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const x = await f(); if (x) return x; await attendre(100); } return null; };

/* ── Le faux n8n : lent, il note chaque question reçue ─────────────────── */
const recues = [];
let delai = 1500;
const n8n = http.createServer((req, res) => {
    let b = ''; req.on('data', c => b += c); req.on('end', async () => {
        let j = {}; try { j = JSON.parse(b); } catch (_) { }
        recues.push({ chemin: req.url, corps: j, relais: req.headers['x-finance-relais'] || null });
        await attendre(delai);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ html: '<p>Réponse du CFO : ' + String(j.question || '').replace(/[<>]/g, '') + '</p>' }));
    });
});
const pN8n = await portLibre();
await new Promise(r => n8n.listen(pN8n, '127.0.0.1', r));
const pMort = await portLibre();   // personne n'y écoute

/* ── Le docroot, comme le VPS ─────────────────────────────────────────── */
const doc = fs.mkdtempSync(path.join(os.tmpdir(), 'relais-'));
const F = path.join(doc, 'finance');
fs.mkdirSync(F);
fs.copyFileSync(path.join(RACINE, 'cfo_relais.php'), path.join(F, 'cfo_relais.php'));
const PORT_N8N = path.join(F, 'port_n8n.txt');
fs.writeFileSync(PORT_N8N, String(pN8n));
fs.writeFileSync(path.join(F, 'db_config.php'), `<?php return ['cfo_webhook_interne' => 'http://127.0.0.1:' . trim((string)file_get_contents(__DIR__ . '/port_n8n.txt'))];`);
const port = await portLibre();
const ORIGINE = `http://127.0.0.1:${port}`;
const srv = spawn(php, ['-S', '127.0.0.1:' + port, '-t', doc], { stdio: 'ignore', env: { ...process.env, PHP_CLI_SERVER_WORKERS: '4' } });
await attendrePort(port);
const relais = (corps, entetes = {}, signal) => fetch(ORIGINE + '/finance/cfo_relais.php', { method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...entetes }, body: JSON.stringify(corps) });
const etat = async (rid) => (await fetch(ORIGINE + '/finance/cfo_relais.php?rid=' + encodeURIComponent(rid))).json();

let browser = null;
try {
    await section('A', async () => {
        const ac = new AbortController();
        const p = relais({ session_id: 's1', question: 'combien ?', source: 'web', rid: 'rid-aaaa-0001', cible: '/webhook/finance-cfo-web' }, {}, ac.signal).catch(e => ({ coupe: e }));
        await attendre(300); ac.abort();                                   // le téléphone part (appel reçu)
        const r = await p;
        const pendant = await etat('rid-aaaa-0001');
        const fin = await attendreQue(async () => { const e = await etat('rid-aaaa-0001'); return e.etat === 'fini' ? e : null; }, 10000);
        const q = recues.find(x => x.corps.question === 'combien ?');
        v('A. le téléphone part au bout de 0,3 s : le VPS attend quand même n8n (« en cours »), puis garde sa réponse',
          !!(r && r.coupe) && pendant.etat === 'en_cours' && fin && fin.http === 200 && /Réponse du CFO : combien \?/.test(fin.corps), JSON.stringify([pendant, fin]));
        v('  → n8n a reçu la question telle quelle (session, source), sans rid ni cible, marquée « relais »',
          q && q.chemin === '/webhook/finance-cfo-web' && q.corps.session_id === 's1' && q.corps.source === 'web' && !('rid' in q.corps) && !('cible' in q.corps) && q.relais === '1', JSON.stringify(q));
        const r2 = await relais({ session_id: 's1', question: 'et ensuite ?', rid: 'rid-aaaa-0002', cible: '/webhook/finance-cfo-web' });
        v('  → sans coupure : même code et même corps que n8n, signés « X-Finance-Relais »', r2.status === 200 && r2.headers.get('x-finance-relais') === 'rid-aaaa-0002'
          && /Réponse du CFO : et ensuite \?/.test(await r2.text()));
    });
    await section('B', async () => {
        const c1 = await relais({ question: 'x', rid: 'rid-bbbb-0001', cible: '/../../etc/passwd' });
        const c2 = await relais({ question: 'x', rid: 'rid-bbbb-0002', cible: 'http://169.254.169.254/latest' });
        const c3 = await relais({ question: 'x', rid: '../x', cible: '/webhook/finance-cfo-web' });
        const c4 = await relais({ question: 'x', rid: 'rid-bbbb-0004', cible: '/webhook/finance-cfo-web' }, { Origin: 'https://pirate.example' });
        const c5 = await fetch(ORIGINE + '/finance/cfo_relais.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        const avant = recues.length;
        v('B. refusé : une adresse hors /webhook/…, un rid piégé, une autre origine, sans X-Requested-With — n8n jamais appelé',
          c1.status === 400 && c2.status === 400 && c3.status === 400 && c4.status === 403 && c5.status === 400 && recues.length === avant, JSON.stringify([c1.status, c2.status, c3.status, c4.status, c5.status]));
        v('  → un rid inconnu : « inconnu »', (await etat('rid-jamais-vu-01')).etat === 'inconnu');
    });
    await section('C', async () => {
        fs.writeFileSync(PORT_N8N, String(pMort));
        const r = await relais({ question: 'y', rid: 'rid-cccc-0001', cible: '/webhook/finance-cfo-web' });
        const j = await r.json().catch(() => ({})), e = await etat('rid-cccc-0001');
        fs.writeFileSync(PORT_N8N, String(pN8n));
        v('C. n8n injoignable depuis le VPS : 502 RELAIS_INJOIGNABLE (sans signature), l\'état « erreur », la piste dite (cfo_webhook_interne)',
          r.status === 502 && !r.headers.get('x-finance-relais') && j.error === 'RELAIS_INJOIGNABLE' && /cfo_webhook_interne/.test(j.message || '') && e.etat === 'erreur', JSON.stringify([r.status, j, e]));
    });

    /* ── L'appli, servie par le même serveur que le relais ─────────────── */
    const require = createRequire(import.meta.url);
    const pw = essai(() => require('playwright-core'));
    const vueJs = essai(() => require.resolve('vue/dist/vue.global.js'));
    const chartJs = essai(() => fs.existsSync(path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js')) && path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js'));
    const chromium = process.env.CHROMIUM || ['/opt/pw-browsers/chromium'].find(p => essai(() => fs.existsSync(p) && fs.statSync(p).isFile()));
    if (!pw || !vueJs || !chartJs || !chromium) { console.log('  ⏭️  partie navigateur ignorée (playwright-core, vue, chart.js ou Chromium absent)'); }
    else {
        const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8')
            .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
            .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
            .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, '')
            .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');
        fs.writeFileSync(path.join(F, 'index.html'), html);
        fs.copyFileSync(vueJs, path.join(doc, 'vue.js'));
        fs.copyFileSync(chartJs, path.join(doc, 'chart.js'));
        const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
        fs.writeFileSync(path.join(F, 'finance_data.json'), JSON.stringify(fx));
        browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        await ctx.addInitScript((o) => { try { localStorage.setItem('cfo_webhook_url', o + '/webhook/finance-cfo-web'); } catch (_) { } }, ORIGINE);
        let directs = 0;
        //  le webhook en direct (sans relais) : le CFO « public » de n8n, simulé ici
        await ctx.route('**/webhook/finance-cfo-web', async (route) => { directs++; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ html: '<p>Réponse directe du CFO</p>' }) }); });
        const page = await ctx.newPage();
        const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
        const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
        await page.goto(ORIGINE + '/finance/', { waitUntil: 'load' });
        await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && Array.isArray(a.__vue_app__._instance.setupState.masterAssets); }, null, { timeout: 30000 });
        const derniere = () => page.evaluate((ST) => { const m = eval(ST).cfoMessages; return m.length ? m[m.length - 1].content : ''; }, ST);
        const reponseAvec = (txt, ms = 30000) => page.waitForFunction(({ ST, txt }) => !eval(ST).cfoLoading && eval(ST).cfoMessages.some(m => m.role === 'agent' && String(m.content).includes(txt)), { ST, txt }, { timeout: ms });

        await section('D', async () => {
            delai = 500;
            await page.evaluate((ST) => { eval(ST).consulterCFO('question normale'); }, ST);
            await reponseAvec('Réponse du CFO : question normale');
            const q = recues.filter(x => String(x.corps.question || '').startsWith('question normale'));
            v('D. une question de l\'appli passe par le relais (même serveur) : la réponse s\'affiche, n8n l\'a reçue une fois, rien en direct',
              q.length === 1 && q[0].relais === '1' && directs === 0 && q[0].corps.finance_data && typeof q[0].corps.finance_data === 'object', JSON.stringify([q.length, directs]));
        });
        await section('E', async () => {
            //  la connexion de l'onglet coupée pendant l'attente (appel reçu) : le VPS, lui, a reçu la question
            delai = 3000;
            await page.route('**/finance/cfo_relais.php', async (route) => {
                const r = route.request();
                if (r.method() !== 'POST') return route.continue();
                fetch(r.url(), { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: r.postData() }).catch(() => { });
                await attendre(300);
                await route.abort('connectionreset');
            });
            await page.evaluate((ST) => { eval(ST).consulterCFO('question pendant un appel'); }, ST);
            await page.waitForFunction((ST) => eval(ST).cfoAttente.actif && /continue sur le serveur|réponse s’affichera|rien n’est perdu/.test(eval(ST).cfoAttente.actif), ST, { timeout: 10000 }).catch(() => { });
            const phrase = await page.evaluate((ST) => eval(ST).cfoAttente.actif, ST);
            await reponseAvec('Réponse du CFO : question pendant un appel', 40000);
            await page.unroute('**/finance/cfo_relais.php');
            const q = recues.filter(x => String(x.corps.question || '').startsWith('question pendant un appel'));
            const tout = await page.evaluate((ST) => eval(ST).cfoMessages.map(m => m.content).join('\n'), ST);
            v('E. connexion coupée pendant l\'attente : « le CFO continue sur le serveur », puis SA réponse s\'affiche',
              /continue sur le serveur|réponse s’affichera|rien n’est perdu/.test(phrase) && /Réponse du CFO : question pendant un appel/.test(tout), phrase);
            v('  → une seule question au CFO (pas de doublon), aucune « Erreur de connexion », rien en direct', q.length === 1 && !/Erreur de connexion/.test(tout) && directs === 0, JSON.stringify([q.length, directs]));
        });
        await section('F', async () => {
            //  le téléphone a fermé l'onglet : la question attendait (mémo), la réponse est gardée sur le VPS
            delai = 200;
            await (await relais({ session_id: 'x', question: 'question avant fermeture', rid: 'rid-ffff-0001', cible: '/webhook/finance-cfo-web' })).text();
            await page.evaluate(() => localStorage.setItem('cfo_relais_en_attente', JSON.stringify({ rid: 'rid-ffff-0001', question: 'question avant fermeture', t: Date.now() })));
            await page.reload({ waitUntil: 'load' });
            await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && Array.isArray(a.__vue_app__._instance.setupState.masterAssets); }, null, { timeout: 30000 });
            await reponseAvec('Réponse du CFO : question avant fermeture', 20000);
            const d = await derniere(), memo = await page.evaluate(() => localStorage.getItem('cfo_relais_en_attente'));
            v('F. onglet fermé puis rouvert : « Réponse retrouvée sur le serveur », la réponse affichée, le mémo effacé', /Réponse retrouvée sur le serveur/.test(d) && /question avant fermeture/.test(d) && memo === null, d.slice(0, 200));
        });
        await section('G', async () => {
            fs.writeFileSync(PORT_N8N, String(pMort));
            const avant = recues.length;
            await page.evaluate((ST) => { eval(ST).consulterCFO('question relais en panne'); }, ST);
            await reponseAvec('Réponse directe du CFO');
            fs.writeFileSync(PORT_N8N, String(pN8n));
            v('G. le VPS ne joint pas n8n : la question part en direct, une seule fois (comme avant le relais)', directs === 1 && recues.length === avant, JSON.stringify([directs, recues.length - avant]));
            v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
        });
    }
} catch (e) {
    v('exécution sans exception', false, String(e && e.stack || e).slice(0, 400));
} finally {
    if (browser) await browser.close();
    srv.kill(); n8n.close();
    fs.rmSync(doc, { recursive: true, force: true });
}
console.log('  ' + '─'.repeat(80));
console.log(ko === 0 ? `  ✅ TOUT PASSE — ${n} contrôles` : `  ❌ ${ko} contrôle(s) en échec sur ${n}`);
process.exit(ko === 0 ? 0 : 1);
