/**
 * v37.74 — LE JOUR EXACT D'UN CHOC ET D'UN VIREMENT, DANS LE CALENDRIER PLURIANNUEL.
 *
 *   « Il faut ajouter une case jour exact du mois pour les pluriannuels. » Les calculs savaient placer
 *   un flux exceptionnel ou un virement à son jour (jourPrevu), le Calendrier ne permettait pas de le saisir.
 *   Décor fictif (KARIM TESTEUR), paie le 27, novembre 2026 :
 *     • « Vidange » 1 500 sans jour ; « Billets avion » 4 000 le 28 (après la paie) ;
 *     • virement Compte Salaire → Courant 2 000, sans jour.
 *     A. statique · B. bureau (cases, saisie, bornes, cycle suivant) · C. téléphone.
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
console.log('\n  LE JOUR EXACT DANS LE CALENDRIER PLURIANNUEL\n  ' + '─'.repeat(80));

v('A. une case « 📅 j. » par choc et par virement, bureau et téléphone (4 emplacements)',
  (html.match(/<input data-jour-exact /g) || []).length === 4 && (html.match(/data-jour-cycle-suivant/g) || []).length === 4);

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

const fixture = () => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    fx._schemaVersion = 24;
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = { 2026: JSON.parse(JSON.stringify(base)), 2027: JSON.parse(JSON.stringify(base)) };
    Object.assign(fx.soldesInitiaux, { moisActuel: 11, anneeActuelle: 2026, jourDePaie: 27, compteChargesFixes: 'courant', compteChargesVariables: 'courant', assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.soldesInitiaux.categories = [];
    fx.comptes = [{ id: 'acc_cc', label: 'Compte Courant', type: 'liquide', solde: 5000, icone: '💳' },
                  { id: 900, label: 'Compte Salaire', type: 'liquide', solde: 9000, icone: '🏦' }];
    for (const an of ['2026', '2027']) {
        const d = fx.donneesAnnuelles[an];
        d.epargne = []; d.consoRealiseeT0 = {}; d.consoClotureT0 = {}; d.banqueOperations = {}; d.transactionsReelles = [];
        d.depensesIrregulieres = an === '2026' ? [
            { id: 501, mois: 11, annee: 2026, nom: 'Vidange', montant: 1500, sourceCompte: 'courant', paye: false, montantPaye: 0 },
            { id: 502, mois: 11, annee: 2026, nom: 'Billets avion', montant: 4000, sourceCompte: 'courant', paye: false, montantPaye: 0, jourPrevu: 28 }] : [];
        d.virementsInternes = an === '2026' ? [{ id: 601, mois: 11, sourceCompte: 'cpt_900', destinationCompte: 'courant', montant: 2000 }] : [];
    }
    return fx;
};
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
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.clock.setFixedTime(new Date(2026, 10, 12, 10, 0, 0));
page.on('pageerror', e => erreurs.push(String(e)));
await page.route('**/webhook/**', route => route.abort());
await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
await page.waitForTimeout(1500);

const etat = () => page.evaluate((ST) => { const st = eval(ST), d = st.donneesAnnuelles[2026];
    const id = (x) => x.id;
    return JSON.parse(JSON.stringify({ dep: d.depensesIrregulieres.map(x => [x.nom, x.jourPrevu ?? null]), vir: d.virementsInternes.map(x => x.jourPrevu ?? null),
        c11: st.getDepensesCycle(11, 2026).map(id), c12: st.getDepensesCycle(12, 2026).map(id),
        v11: st.getVirementsCycle(11, 2026).map(id), v12: st.getVirementsCycle(12, 2026).map(id), statut: st.serverSyncStatus })); }, ST);

try {
    await section('B', async () => {
        await page.evaluate(async (ST) => { const st = eval(ST); st.anneeAffichage = 2026; st.appMode = 'previsionnel'; st.activeTab = 'irregulieres';
            if (!st.moisOuverts.includes(11)) st.toggleMois(11); await new Promise(r => setTimeout(r, 500)); }, ST);
        const lire = () => page.evaluate(() => {
            const cases = [...document.querySelectorAll('input[data-jour-exact]')].filter(e => e.offsetParent !== null);
            const badges = [...document.querySelectorAll('[data-jour-cycle-suivant]')].filter(e => e.offsetParent !== null);
            return { cases: cases.map(c => [c.value, c.max]), badges: badges.map(b => [b.textContent.trim(), b.getAttribute('title')]) }; });
        const L = await lire();
        v('B. novembre : 3 cases (2 chocs, 1 virement), le 28 affiché, les autres vides, max 30',
          JSON.stringify(L.cases) === JSON.stringify([['', '30'], ['28', '30'], ['', '30']]), JSON.stringify(L.cases));
        v('  → « Billets avion » le 28 : « après paie → Décembre » (règle du jour de paie expliquée)',
          L.badges.length === 1 && L.badges[0][0] === 'après paie → Décembre' && /Le 28 tombe après la paie \(le 27\)/.test(L.badges[0][1]), JSON.stringify(L.badges));
        const E0 = await etat();
        v('  → les calculs suivent déjà : « Billets avion » dans le cycle de décembre, pas dans celui de novembre',
          E0.c11.includes(501) && !E0.c11.includes(502) && E0.c12.includes(502), JSON.stringify(E0));

        const saisir = async (i, val) => { const c = page.locator('input[data-jour-exact]:visible').nth(i); await c.fill(String(val)); await c.dispatchEvent('change'); await page.waitForTimeout(150); };
        await saisir(0, 31);
        let E = await etat(), L2 = await lire();
        v('  → « Vidange » : 31 saisi en novembre → le 30 (mois de 30 jours), la case l\'affiche',
          E.dep[0][1] === 30 && L2.cases[0][0] === '30' && E.statut === 'modified', JSON.stringify([E.dep, L2.cases, E.statut]));
        v('  → et la Vidange passe au cycle de décembre, avec son badge', E.c12.includes(501) && L2.badges.length === 2, JSON.stringify([E.c12, L2.badges.length]));
        await saisir(0, 5);
        E = await etat();
        v('  → « 5 » : reste dans le cycle de novembre', E.dep[0][1] === 5 && E.c11.includes(501) && !E.c12.includes(501), JSON.stringify(E));
        await saisir(1, '');
        E = await etat(); L2 = await lire();
        v('  → case vidée : plus de jour précis (champ retiré), retour au cycle du mois',
          E.dep[1][1] === null && E.c11.includes(502) && L2.cases[1][0] === '' && L2.badges.length === 0, JSON.stringify([E.dep, L2]));
        await saisir(1, 0);
        E = await etat();
        v('  → 0 ou négatif : rien d\'enregistré', E.dep[1][1] === null, JSON.stringify(E.dep));
        await saisir(2, 10);
        E = await etat();
        v('  → virement : le 10 → enregistré, compté dans le cycle de novembre', E.vir[0] === 10 && E.v11.includes(601), JSON.stringify(E));
        await saisir(2, 27);
        E = await etat();
        v('  → virement le 27 (jour de paie) : cycle de décembre', E.vir[0] === 27 && E.v12.includes(601) && !E.v11.includes(601), JSON.stringify(E));
        const F = await page.evaluate((ST) => { const st = eval(ST); return [st.joursDuMoisCal(2, 2028), st.joursDuMoisCal(2, 2027), st.joursDuMoisCal(12, 2026), st.cycleSuivantNom(12)]; }, ST);
        v('  → bornes : février 2028 = 29, février 2027 = 28 ; décembre → cycle de Janvier', JSON.stringify(F) === '[29,28,31,"Janvier"]', JSON.stringify(F));
    });

    await section('C', async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(async (ST) => { const st = eval(ST); st.isMobile = true; st.activeMobileTab = 'flux'; await new Promise(r => setTimeout(r, 600)); }, ST);
        const M = await page.evaluate(() => {
            const cases = [...document.querySelectorAll('input[data-jour-exact]')].filter(e => e.offsetParent !== null);
            return { n: cases.length, v: cases.map(c => c.value), badges: [...document.querySelectorAll('[data-jour-cycle-suivant]')].filter(e => e.offsetParent !== null).map(b => b.textContent.trim()) }; });
        v('C. téléphone : la même case sur chaque choc et chaque virement, mêmes valeurs',
          M.n === 3 && JSON.stringify(M.v) === JSON.stringify(['5', '', '27']) && JSON.stringify(M.badges) === JSON.stringify(['après paie → Décembre']), JSON.stringify(M));
        const c = page.locator('input[data-jour-exact]:visible').nth(1); await c.fill('15'); await c.dispatchEvent('change'); await page.waitForTimeout(150);
        const E = await etat();
        v('  → saisie au téléphone : « Billets avion » le 15', E.dep[1][1] === 15, JSON.stringify(E.dep));
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
