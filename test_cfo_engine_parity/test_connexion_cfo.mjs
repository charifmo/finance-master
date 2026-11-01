/**
 * v37.90 — « FAILED TO FETCH » : L'APPLI DIAGNOSTIQUE, RÉESSAIE, ET GARDE L'ÉCRAN ALLUMÉ.
 *   L'appli servie par un faux serveur « http://finance.test » (pour que l'adresse du serveur soit déductible) :
 *   A. statique · B. adresse enregistrée morte → nouvel essai sur celle du serveur, gardée · C. le CFO a reçu la
 *   question puis la connexion a été coupée (étapes notées) · D. le CFO (n8n) ne répond pas · E. pas de réseau.
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
v('A. écran allumé pendant l\u2019attente (Wake Lock), diagnostic de « Failed to fetch », nouvel essai, « ↻ Renvoyer »',
  /navigator\.wakeLock\.request\('screen'\)/.test(html) && /const diagnostiquerConnexionCFO = /.test(html) && /data-cfo-adresse-corrigee/.test(html) && /data-cfo-renvoyer/.test(html));
const essai = (f) => { try { return f(); } catch { return null; } };
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

const ORIGINE = 'http://finance.test';
let mode = { webhook: 'ok', etapes: [] };
let t0 = 0;
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
const erreurs = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.route('**/*', async (route) => {
    const u = new URL(route.request().url()), p = u.pathname;
    const s = (c, b, t = 'application/json') => route.fulfill({ status: c, contentType: t, body: b });
    if (u.hostname === 'mort.invalid') return route.abort('connectionrefused');
    if (u.origin !== ORIGINE) return route.abort();
    if (p === '/finance/') return s(200, page0, 'text/html; charset=utf-8');
    if (p === '/vue.js') return s(200, fs.readFileSync(vueJs), 'text/javascript');
    if (p === '/chart.js') return s(200, fs.readFileSync(chartJs), 'text/javascript');
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fixture()));
    if (p === '/webhook/finance-cfo-web') { t0 = Date.now(); if (mode.webhook === 'ok') return s(200, JSON.stringify({ html: '<p>Réponse du CFO</p>' })); return route.abort('connectionreset'); }
    if (p === '/finance/cfo_etapes.php') { if (mode.etapesKO) return route.abort(); return s(200, JSON.stringify({ etapes: mode.etapes.map(e => ({ ...e, il_y_a_ms: 100 })), maintenant: Date.now() })); }
    return s(200, '{"status":"ok"}');
});
const page = await ctx.newPage();
page.on('pageerror', e => erreurs.push(String(e)));
await page.addInitScript(() => { try { localStorage.setItem('cfo_webhook_url', 'https://mort.invalid/webhook/vieux'); } catch (_) {} });
await page.goto(`${ORIGINE}/finance/`, { waitUntil: 'load' });
await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
await page.waitForTimeout(1200);
const demander = async (q) => { await page.evaluate(([ST, q]) => { const st = eval(ST); st.showCfoModal = true; st.consulterCFO(q); }, [ST, q]);
    await page.waitForFunction((ST) => !eval(ST).cfoLoading, ST, { timeout: 15000 }); await page.waitForTimeout(300);
    return page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST).cfoMessages.slice(-3).map(m => m.content))), ST); };

try {
    await section('B', async () => {
        const avant = await page.evaluate((ST) => eval(ST).cfoWebhookUrl, ST);
        const M = await demander('Question 1');
        const apres = await page.evaluate((ST) => [eval(ST).cfoWebhookUrl, localStorage.getItem('cfo_webhook_url')], ST);
        v('B. adresse enregistrée morte : la question repart vers celle du serveur, la réponse s\u2019affiche, l\u2019adresse est gardée',
          avant === 'https://mort.invalid/webhook/vieux' && M.some(c => /data-cfo-adresse-corrigee/.test(c)) && M.some(c => /Réponse du CFO/.test(c))
          && apres[0] === ORIGINE + '/webhook/finance-cfo-web' && apres[1] === apres[0], JSON.stringify([avant, apres, M]).slice(0, 500));
    });
    await section('C', async () => {
        mode = { webhook: 'coupe', etapes: [{ code: 'contexte', libelle: 'Vos chiffres transmis au CFO' }] };
        const M = await demander('Question 2');
        const d = M.filter(c => /data-cfo-diagnostic/.test(c)).pop() || '';
        v('C. connexion coupée pendant l\u2019attente : « le CFO a bien reçu votre question », ses étapes, « ↻ Renvoyer »',
          /data-cfo-diagnostic="coupee"/.test(d) && /a bien reçu votre question/.test(d) && /Vos chiffres transmis au CFO/.test(d) && /data-cfo-renvoyer/.test(d), d.slice(0, 300));
        mode = { webhook: 'ok', etapes: [] };
        await page.click('[data-cfo-renvoyer] >> nth=-1'); await page.waitForTimeout(200);
        await page.waitForFunction((ST) => !eval(ST).cfoLoading, ST, { timeout: 15000 }); await page.waitForTimeout(300);
        const R = await page.evaluate((ST) => { const m = eval(ST).cfoMessages; return [m[m.length - 2].content, m[m.length - 1].content]; }, ST);
        v('  → « ↻ Renvoyer » renvoie la même question, et la réponse arrive', R[0] === 'Question 2' && /Réponse du CFO/.test(R[1]), JSON.stringify(R).slice(0, 300));
    });
    await section('D', async () => {
        mode = { webhook: 'coupe', etapes: [] };
        const M = await demander('Question 3');
        const d = M.filter(c => /data-cfo-diagnostic/.test(c)).pop() || '';
        v('D. rien reçu, l\u2019adresse est celle du serveur : « le serveur répond, mais pas le CFO (n8n) » + sudo bash install.sh cfo',
          /data-cfo-diagnostic="n8n"/.test(d) && /install\.sh cfo/.test(d), d.slice(0, 300));
    });
    await section('E', async () => {
        mode = { webhook: 'coupe', etapes: [], etapesKO: true };
        await ctx.setOffline(true);
        const M = await demander('Question 4');
        await ctx.setOffline(false);
        const d = M.filter(c => /data-cfo-diagnostic/.test(c)).pop() || '';
        v('E. pas de réseau : « Pas de réseau sur cet appareil »', /data-cfo-diagnostic="hors_ligne"/.test(d) && /Pas de réseau/.test(d), d.slice(0, 300));
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
