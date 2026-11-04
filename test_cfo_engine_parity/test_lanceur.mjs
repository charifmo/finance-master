/**
 * v37.99 — « 🧩 MES APPLIS » : passer de Finance à Santé (puis Psy, Voyage…) d'un toucher.
 *   Vrais fichiers servis par PHP (php -S) : lanceur.js, apps.json, accueil.html, Finance, Santé.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
let ko = 0;
const v = (t, ok, d = '') => { if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(64)} ${ok ? '' : d}`); };
const section = async (nom, f) => { try { await f(); } catch (e) { v(`${nom} : exécution sans exception`, false, String(e && e.stack || e).slice(0, 300)); } };
console.log('\n  🧩 MES APPLIS — LE LANCEUR\n  ' + '─'.repeat(80));

const apps = JSON.parse(fs.readFileSync(path.join(RACINE, 'apps.json'), 'utf8'));
const fin = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8'), san = fs.readFileSync(path.join(RACINE, 'sante/index.html'), 'utf8');
v('A. apps.json : Finance, Santé, puis Psy et Voyage « bientôt » ; un bouton 🧩 dans chaque appli',
  apps.applis.map(a => a.id).join(',') === 'finance,sante,psy,voyage' && apps.applis.filter(a => a.bientot).length === 2
  && /data-lanceur /.test(fin) && /fetch\('lanceur\.js'/.test(fin) && /data-lanceur /.test(san) && /fetch\('\.\.\/lanceur\.js'/.test(san));
try { new Function(fs.readFileSync(path.join(RACINE, 'lanceur.js'), 'utf8')); v('  → lanceur.js se lit sans erreur de syntaxe', true); } catch (e) { v('  → lanceur.js se lit sans erreur de syntaxe', false, String(e)); }

const require = createRequire(import.meta.url);
const essai = (f) => { try { return f(); } catch { return null; } };
const pw = essai(() => require('playwright-core')), vueJs = essai(() => require.resolve('vue/dist/vue.global.js'));
const chartJs = path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js');
const chromium = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
if (!pw || !vueJs || !fs.existsSync(chartJs) || !fs.existsSync(chromium)) { console.log('  ⏭️  partie navigateur ignorée'); console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`); process.exit(ko === 0 ? 0 : 1); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lanceur-'));
const port = 25000 + Math.floor(Math.random() * 3000);
const php = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', RACINE], { env: { ...process.env, SANTE_DATA_FILE: path.join(tmp, 'sante.json') }, stdio: 'ignore' });
const U = `http://127.0.0.1:${port}/`;
for (let i = 0; i < 50; i++) { try { await fetch(U + 'apps.json'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const erreurs = [];
const preparer = async (ctx, { sansApps = false } = {}) => {
    const page = await ctx.newPage();
    page.on('pageerror', e => erreurs.push(page.url() + ' — ' + String(e)));
    await page.route('https://unpkg.com/**', r => r.fulfill({ body: fs.readFileSync(vueJs), contentType: 'text/javascript' }));
    await page.route('https://cdn.jsdelivr.net/npm/chart.js', r => r.fulfill({ body: fs.readFileSync(chartJs), contentType: 'text/javascript' }));
    await page.route(/^https:\/\/(?!unpkg\.com|cdn\.jsdelivr\.net\/npm\/chart\.js)/, r => r.fulfill({ body: '', contentType: 'text/javascript' }));
    await page.route('**/save_data.php**', r => r.fulfill({ status: 404, body: '' }));
    await page.route('**/webhook/**', r => r.abort());
    if (sansApps) await page.route('**/apps.json', r => r.fulfill({ status: 404, body: '' }));
    return page;
};
const tuiles = (page) => page.$$eval('[data-lanceur-panneau] [data-lanceur-appli]', l => l.map(x => x.getAttribute('data-lanceur-appli') + (x.hasAttribute('data-lanceur-ici') ? '*' : '') + (x.hasAttribute('data-lanceur-bientot') ? '~' : '')));

try {
    await section('B', async () => {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await preparer(ctx);
        await page.goto(U, { waitUntil: 'load' });
        await page.waitForFunction(() => window.Lanceur && document.querySelector('[data-aujourdhui]'), null, { timeout: 30000 });
        await page.click('[data-aujourdhui] [data-lanceur]');
        await page.waitForSelector('[data-lanceur-panneau]');
        const T = await tuiles(page);
        v('B. Finance (téléphone, écran Aujourd’hui) : 🧩 ouvre « Mes applis » — Finance (ici), Santé, Psy et Voyage bientôt',
          JSON.stringify(T) === JSON.stringify(['finance*', 'sante', 'psy~', 'voyage~']), JSON.stringify(T));
        await page.click('[data-lanceur-panneau] [data-lanceur-appli="psy"]'); await page.waitForTimeout(300);
        v('  → une tuile « bientôt » ne mène nulle part', new URL(page.url()).pathname === '/' && await page.isVisible('[data-lanceur-panneau]'), page.url());
        await page.keyboard.press('Escape'); await page.waitForTimeout(100);
        v('  → Échap ferme le panneau', !(await page.$('[data-lanceur-panneau]')), '');
        await page.click('[data-aujourdhui] [data-lanceur]'); await page.waitForSelector('[data-lanceur-panneau]');
        await Promise.all([page.waitForURL('**/sante/'), page.click('[data-lanceur-panneau] [data-lanceur-appli="sante"]')]);
        await page.waitForFunction(() => window.Lanceur && document.querySelector('#app') && document.querySelector('#app').__vue_app__, null, { timeout: 30000 });
        v('C. un toucher sur Santé : on arrive dans Santé Master', /Santé Master/.test(await page.title()), await page.title());
        await page.click('header [data-lanceur]'); await page.waitForSelector('[data-lanceur-panneau]');
        const T2 = await tuiles(page);
        v('  → dans Santé, 🧩 « Mes applis » : Santé est « ici »', JSON.stringify(T2) === JSON.stringify(['finance', 'sante*', 'psy~', 'voyage~']), JSON.stringify(T2));
        await Promise.all([page.waitForURL(U), page.click('[data-lanceur-panneau] [data-lanceur-appli="finance"]')]);
        v('  → retour à Finance d’un toucher', new URL(page.url()).pathname === '/', page.url());
        await ctx.close();
    });
    await section('D', async () => {
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        await ctx.addInitScript(() => { try { localStorage.setItem('fm_mode_affichage', 'expert'); } catch (e) {} });
        const page = await preparer(ctx, { sansApps: true });
        await page.goto(U, { waitUntil: 'load' });
        await page.waitForFunction(() => window.Lanceur && document.querySelector('nav [data-lanceur]'), null, { timeout: 30000 });
        await page.click('nav [data-lanceur]'); await page.waitForSelector('[data-lanceur-panneau]');
        const T = await tuiles(page);
        v('D. ordinateur, mode expert : 🧩 « Mes applis » dans le menu ; sans apps.json, Finance et Santé quand même', JSON.stringify(T) === JSON.stringify(['finance*', 'sante']), JSON.stringify(T));
        await ctx.close();
    });
    await section('E', async () => {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await preparer(ctx);
        await page.goto(U + 'accueil.html', { waitUntil: 'load' });
        await page.waitForSelector('[data-lanceur-page] [data-lanceur-appli]');
        const T = await page.$$eval('[data-lanceur-page] [data-lanceur-appli]', l => l.map(x => x.getAttribute('data-lanceur-appli') + (x.getAttribute('href') ? '→' + new URL(x.href).pathname : '')));
        v('E. accueil.html (à mettre sur l’écran d’accueil du téléphone) : les 4 tuiles, liens vers / et /sante/', JSON.stringify(T) === JSON.stringify(['finance→/', 'sante→/sante/', 'psy', 'voyage']), JSON.stringify(T));
        await ctx.close();
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    php.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
