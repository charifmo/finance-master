/**
 * v37.83 — LE CFO SE BRANCHE TOUT SEUL.
 *   « C'est quoi ce truc ? » — « Configuration requise : collez l'URL du Webhook n8n » sur un téléphone.
 *     A. statique · B. la déduction · C. dans l'appli : l'adresse enregistrée gagne, la config disparaît sinon.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8').split('\r\n').join('\n');

let ko = 0;
const v = (t, ok, d = '') => { if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(64)} ${ok ? '' : d}`); };
const section = async (nom, f) => { try { await f(); } catch (e) { v(`${nom} : exécution sans exception`, false, String(e && e.stack || e).slice(0, 300)); } };
console.log('\n  LE CFO SE BRANCHE TOUT SEUL\n  ' + '─'.repeat(80));

v('A. sans adresse enregistrée, l\'appli déduit celle du serveur ; l\'adresse enregistrée garde la priorité',
  /const cfoWebhookUrl = ref\(localStorage\.getItem\('cfo_webhook_url'\) \|\| webhookCfoParDefaut\(\)\);/.test(html)
  && /return l\.origin \+ '\/webhook\/finance-cfo-web';/.test(html));
const path0 = JSON.parse(fs.readFileSync(path.join(RACINE, 'super_agent_cfo_audio.json'), 'utf8')).nodes.find(n => n.type === 'n8n-nodes-base.webhook');
v('  → le chemin déduit est bien celui du Webhook du workflow n8n du dépôt', !!path0 && path0.parameters.path === 'finance-cfo-web', JSON.stringify(path0 && path0.parameters.path));

const require = createRequire(import.meta.url);
const essai = (f) => { try { return f(); } catch { return null; } };
const pw = essai(() => require('playwright-core'));
const vueJs = essai(() => require.resolve('vue/dist/vue.global.js'));
const chartJs = essai(() => fs.existsSync(path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js')) && path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js'));
const chromium = process.env.CHROMIUM || ['/opt/pw-browsers/chromium'].find(p => essai(() => fs.existsSync(p) && fs.statSync(p).isFile()));
if (!pw || !vueJs || !chartJs || !chromium) {
    console.log('  ⏭️  partie navigateur ignorée (playwright-core, vue, chart.js ou Chromium absent)');
    console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
    process.exit(ko === 0 ? 0 : 1);
}
const fixture = () => { const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8')); fx._schemaVersion = 24; return fx; };
const page0 = html
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, '')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');
const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const s = (c, b, t = 'application/json') => { res.writeHead(c, { 'Content-Type': t }); res.end(b); };
    if (p === '/finance/') return s(200, page0, 'text/html; charset=utf-8');
    if (p === '/vue.js') return s(200, fs.readFileSync(vueJs), 'text/javascript');
    if (p === '/chart.js') return s(200, fs.readFileSync(chartJs), 'text/javascript');
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fixture()));
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
const erreurs = [];
const ouvrir = async (avant) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => erreurs.push(String(e)));
    if (avant) await page.addInitScript(avant);
    await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
    await page.waitForTimeout(600);
    return { ctx, page };
};

try {
    await section('B', async () => {
        const { ctx, page } = await ouvrir();
        const R = await page.evaluate((ST) => { const f = eval(ST).webhookCfoParDefaut, L = (protocol, hostname, origin) => ({ protocol, hostname, origin });
            return [f(L('https:', 'n8n.exemple.ink', 'https://n8n.exemple.ink')), f(L('http:', '192.168.1.20', 'http://192.168.1.20:8080')), f(L('http:', 'localhost', 'http://localhost:3000')),
                    f(L('http:', '127.0.0.1', 'http://127.0.0.1:5500')), f(L('file:', '', 'null')), f(null === 1 ? null : L('https:', '[::1]', 'https://[::1]'))]; }, ST);
        v('B. https://n8n.exemple.ink → …/webhook/finance-cfo-web ; une IP du réseau aussi ; localhost, 127.x, fichier, [::1] : rien de deviné',
          R[0] === 'https://n8n.exemple.ink/webhook/finance-cfo-web' && R[1] === 'http://192.168.1.20:8080/webhook/finance-cfo-web' && R.slice(2).every(x => x === ''), JSON.stringify(R));
        await ctx.close();
    });
    await section('C', async () => {
        const { ctx, page } = await ouvrir();
        await page.evaluate((ST) => { eval(ST).showCfoModal = true; }, ST); await page.waitForTimeout(300);
        const sans = await page.evaluate((ST) => ({ url: eval(ST).cfoWebhookUrl, config: [...document.querySelectorAll('div')].some(d => d.offsetParent && /CONFIGURATION REQUISE|Configuration requise/i.test(d.textContent) && d.className.includes('orange')) }), ST);
        v('C. en local (127.0.0.1) : rien de deviné — la zone « Configuration requise » reste (comportement d\'avant)', sans.url === '' && sans.config === true, JSON.stringify(sans));
        await ctx.close();
        const sauve = await ouvrir(() => localStorage.setItem('cfo_webhook_url', 'https://autre.exemple/webhook/mon-chemin'));
        const url = await sauve.page.evaluate((ST) => eval(ST).cfoWebhookUrl, ST);
        v('  → une adresse enregistrée à la main garde la priorité', url === 'https://autre.exemple/webhook/mon-chemin', url);
        await sauve.ctx.close();
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
