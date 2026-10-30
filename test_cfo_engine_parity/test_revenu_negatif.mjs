/**
 * v37.84 — UN REVENU NÉGATIF EST UNE SORTIE, ET ON LA VOIT.
 *
 *   « Pourquoi je ne vois pas le négatif du Studio sur les premiers mois ? » Décor fictif (KARIM TESTEUR) : un « Studio »
 *   à 8 000 DH par mois sur le Courant, règle d'exception de M1 à M6 à − 1 615 (il COÛTE ces mois-là), 2027.
 *     A. statique · B. le Relevé de comptes · C. le Surplus détaillé et la Respiration · D. les mois à 8 000 : inchangés.
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
console.log('\n  UNE OPÉRATION DU JOURNAL RÈGLE SA LIGNE DU PILOTAGE\n  ' + '─'.repeat(80));

v('A. un revenu négatif devient une sortie : Relevé, Surplus détaillé, Respiration du budget',
  /\(revenu négatif\)', montant: Math\.round\(-vn \* 100\) \/ 100, type: 'debit'/.test(html) && /if \(vn < 0\) sortants \+= Math\.round\(-vn \* 100\) \/ 100;/.test(html) && /\(r\.label \|\| r\.nom \|\| '\?'\) \+ ' \(net\)'/.test(html));

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
    fx.comptes = [{ id: 'acc_cc', label: 'Compte Courant', type: 'liquide', solde: 20000, icone: '💳' }];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    for (const an of ['2026', '2027']) {
        const d = fx.donneesAnnuelles[an];
        const Rv = (label, b, j, exc) => ({ ...neutre, label, base: b, jourPrevu: j, destinationCompte: 'courant', exceptions: exc || [] });
        d.revenus = { salaire: Rv('SALAIRE', 20000, 27), bonif: Rv('—', 0, 1), magasin: Rv('—', 0, 1), cnss: Rv('—', 0, 1), appart: Rv('—', 0, 1),
                      studio: Rv('Studio', 8000, 5, an === '2027' ? [{ id: 1, moisDebut: 1, moisFin: 6, nouvelleValeur: -1615 }] : []) };
        const Fx = (label, valeur) => ({ ...neutre, label, valeur, jourPrevu: null });
        d.chargesFixes = { creditImmo: Fx('—', 0), creditStudio: Fx('—', 0), syndic: Fx('—', 0), nounou: Fx('—', 0), ecole: Fx('—', 0), femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
        d.chargesVariables = {}; d.epargne = []; d.depensesIrregulieres = []; d.virementsInternes = []; d.consoRealiseeT0 = {}; d.consoClotureT0 = {}; d.banqueOperations = {}; d.transactionsReelles = [];
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
    const s = (c, b, ty = 'application/json') => { res.writeHead(c, { 'Content-Type': ty }); res.end(b); };
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
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
await page.clock.setFixedTime(new Date(2026, 9, 29, 12, 0, 0));
page.on('pageerror', e => erreurs.push(String(e)));
await page.route('**/webhook/**', route => route.abort());
await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
await page.waitForTimeout(1200);
await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'pilotage'; await new Promise(r => setTimeout(r, 500)); }, ST);
const taches = () => page.evaluate((ST) => Object.fromEntries(eval(ST).tachesPilotageToutes.map(t => [t.libelle, { paye: t.paye, regle: t.regle, due: t.due }])), ST);

try {
    await section('B', async () => {
        await page.evaluate(async (ST) => { const st = eval(ST); st.anneeAffichage = 2027; st.ouvrirReleve('cpt_acc_cc'); st.anneesSelectionnees.splice(0, 9, 2027); st.moisSelectionnees = null; st.moisSelectionnes.splice(0, 12, 1, 7); await new Promise(r => setTimeout(r, 700)); }, ST);
        const R = await page.evaluate(() => [...document.querySelectorAll('table tbody tr')].filter(r => r.offsetParent !== null).map(r => r.textContent.replace(/\s+/g, ' ').trim()).filter(t => /Studio/.test(t)));
        v('B. Relevé, janvier 2027 : « 💸 Studio (revenu négatif) » en SORTIE de 1 615 ; juillet 2027 : « 💰 Studio » en entrée de 8 000',
          R.some(t => /💸 Studio \(revenu négatif\)/.test(t) && /1[\s  ]?615/.test(t)) && R.some(t => /💰 Studio/.test(t) && /8[\s  ]?000/.test(t)), JSON.stringify(R));
        await page.evaluate(async (ST) => { eval(ST).showReleveModal = false; await new Promise(r => setTimeout(r, 200)); }, ST);
    });
    await section('C', async () => {
        const C = await page.evaluate((ST) => { const st = eval(ST), a = st.respirationDuMois(2027, 1), b = st.respirationDuMois(2027, 7);
            return JSON.parse(JSON.stringify({ fixesJan: a.lignes.fixes.map(l => [l.nom, l.montant]), revJan: a.lignes.revenus.map(l => [l.nom, l.montant]), sortiesJan: a.sorties, ressJan: a.ressources,
                                               fixesJul: b.lignes.fixes.length, revJul: b.lignes.revenus.map(l => [l.nom, l.montant]) })); }, ST);
        v('C. Respiration, janvier 2027 : « Studio (net) » 1 615 dans les charges fixes, plus dans les revenus ; sorties 1 615 ; ressources 20 000',
          JSON.stringify(C.fixesJan) === '[["Studio (net)",1615]]' && C.revJan.length === 1 && C.revJan[0][0] === 'SALAIRE' && C.sortiesJan === 1615 && C.ressJan === 20000, JSON.stringify(C));
        v('  → juillet 2027 : Studio à 8 000 en revenu, aucune charge fixe (inchangé)', C.fixesJul === 0 && C.revJul.some(x => x[0] === 'Studio' && x[1] === 8000), JSON.stringify(C));
        const B = await page.evaluate((ST) => { const st = eval(ST); st.anneeAffichage = 2027; const A = st.bilanAnnee; return [A.mois[0].fixes, A.mois[0].marge, A.mois[6].fixes, A.mois[6].marge]; }, ST);
        v('  → le Bilan 2027 : janvier : 1 615 de charges fixes, marge 18 385 ; juillet : 0 et 28 000', B[0] === 1615 && B[1] === 18385 && B[2] === 0 && B[3] === 28000, JSON.stringify(B));
    });
    await section('D', async () => {
        const S = await page.evaluate((ST) => { const st = eval(ST); st.anneeAffichage = 2027; const r = st.surplusParMois; return r.map(x => [x.mNum, x.brut]); }, ST);
        v('D. Surplus détaillé 2027 : janvier 18 385 (20 000 − 1 615), juillet 28 000 (20 000 + 8 000)', S[0][1] === 18385 && S[6][1] === 28000, JSON.stringify(S.slice(0, 7)));
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
