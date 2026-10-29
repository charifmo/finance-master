/**
 * v37.80 — LE MÊME JOUR, L'ARGENT ARRIVE AVANT DE PARTIR · LA GRANDE CASE DIT OÙ ELLE REGARDE.
 *
 *   « Pourquoi c'est désynchronisé ? » Le Relevé de ce cycle finit positif ; la grande case regarde jusqu'au
 *   26 déc. : le 27 nov., la paie ouvre le cycle suivant, son premier morceau de semaine part du Courant le 27,
 *   et le virement d'Assafa n'arrive que le 28. Décor fictif (KARIM TESTEUR), dimanche 1ᵉʳ nov. 2026, paie le 27 :
 *   Courses sur le Courant ; loyer du magasin le 6 sur le Courant ; le salaire tombe sur Assafa ; virement Assafa → Courant 15 000 le 28 nov.
 *     A. statique · B. le creux du 27 · C. la grande case et le radar · D. le virement posé le 27 : plus de creux.
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
const nf = (x) => new Intl.NumberFormat('fr-FR').format(x).replace(/\s/g, ' ');
const sans = (s) => String(s || '').replace(/\s/g, '');
console.log('\n  VOS COMPTES DANS LE CYCLE · LA BONNE VERSION\n  ' + '─'.repeat(80));

v('A. le même jour, les entrées passent avant les sorties ; « après le cycle » et « avancez » dans la case et le radar',
  /_cSort\(x\.jourPrevu\) - _cSort\(y\.jourPrevu\) \|\| \(\(y\.type === 'credit'\) - \(x\.type === 'credit'\)\)/.test(html)
  && /data-meteo-virement-apres-cycle/.test(html) && /data-meteo-virement-avancer/.test(html) && /data-radar-avancer/.test(html));

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

let jourVir = 28;
const fixture = () => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    fx._schemaVersion = 24;
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = { 2026: JSON.parse(JSON.stringify(base)) };
    Object.assign(fx.soldesInitiaux, { moisActuel: 11, anneeActuelle: 2026, jourDePaie: 27, compteChargesFixes: 'courant', compteChargesVariables: 'courant', assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.soldesInitiaux.categories = [];
    fx.comptes = [{ id: 800, label: 'Compte Courant', type: 'liquide', solde: 8000, icone: '💳' },
                  { id: 801, label: 'Compte Assafa', type: 'liquide', solde: 2000, icone: '🏦' }];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    const d = fx.donneesAnnuelles[2026];
    const Rv = (label, b, j, dest) => ({ ...neutre, label, base: b, jourPrevu: j, destinationCompte: dest });
    d.revenus = { salaire: Rv('SALAIRE', 20000, 27, 'cpt_801'), bonif: Rv('—', 0, 1, 'courant'), magasin: Rv('Loyer magasin', 6000, 6, 'courant'), cnss: Rv('—', 0, 1, 'courant'), appart: Rv('—', 0, 1, 'courant'), studio: Rv('—', 0, 1, 'courant') };
    const Fx = (label, valeur) => ({ ...neutre, label, valeur, jourPrevu: null });
    d.chargesFixes = { creditImmo: Fx('—', 0), creditStudio: Fx('—', 0), syndic: Fx('—', 0), nounou: Fx('—', 0), ecole: Fx('—', 0), femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
    d.chargesVariables = { alimentation: { ...neutre, label: 'Courses', valeur: 0, periode: 'semaine', categorieId: 'cat_cv_alimentation', details: [{ id: 1, nom: 'Marjane', montant: 1400, periode: 'semaine' }] } };
    d.epargne = []; d.depensesIrregulieres = []; d.consoRealiseeT0 = {}; d.consoClotureT0 = {}; d.banqueOperations = {}; d.transactionsReelles = [];
    d.virementsInternes = [{ id: 702, mois: 11, sourceCompte: 'cpt_801', destinationCompte: 'courant', montant: 15000, jourPrevu: jourVir }];
    return fx;
};
const page0 = html
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, '')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');
const srv = http.createServer((req, res) => {
    const [p, q = ''] = req.url.split('?');
    const s = (c, b, t = 'application/json') => { res.writeHead(c, { 'Content-Type': t }); res.end(b); };
    if (p === '/finance/') {
        return s(200, page0, 'text/html; charset=utf-8');
    }
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
const T0 = new Date(2026, 10, 1, 10, 0, 0);
const ouvrir = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(T0);
    page.on('pageerror', e => erreurs.push(String(e)));
    await page.route('**/webhook/**', route => route.abort());
    await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
    await page.waitForTimeout(1200);
    await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'pilotage'; }, ST);
    await page.waitForTimeout(800);
    return { ctx, page };
};
const lire = (page) => page.evaluate(() => {
    const m = document.querySelector('[data-meteo]');
    const L = m ? [...m.querySelectorAll('[data-meteo-atterrissage]')].map(l => ({ cle: l.dataset.compte, nom: l.querySelector('[data-meteo-atterrissage-nom]')?.textContent.trim(),
        t0: l.querySelector('[data-meteo-atterrissage-t0]')?.textContent.trim(), bas: l.querySelector('[data-meteo-atterrissage-bas] > span')?.textContent.trim(),
        basQuand: l.querySelector('[data-meteo-atterrissage-bas-quand]')?.textContent.trim(), basRouge: /text-rose-300/.test(l.querySelector('[data-meteo-atterrissage-bas]')?.className || ''),
        fin: l.querySelector('[data-meteo-atterrissage-montant]')?.textContent.replace(/\s+/g, ' ').trim() })) : [];
    const V = m ? [...m.querySelectorAll('[data-meteo-virement]')].map(b => ({ cle: b.dataset.compte, montant: b.querySelector('[data-meteo-virement-montant]')?.textContent.replace(/\s+/g, ' ').trim(),
        vers: b.querySelector('[data-meteo-virement-vers]')?.textContent.replace(/\s+/g, ' ').trim(), depuis: b.querySelector('[data-meteo-virement-depuis]')?.textContent.replace(/\s+/g, ' ').trim(),
        quand: b.querySelector('[data-meteo-virement-quand]')?.textContent.replace(/\s+/g, ' ').trim() })) : [];
    return { L, V, titre: m?.querySelector('[data-meteo-virements] p')?.textContent.trim(), colonnes: m?.querySelector('[data-meteo-colonnes]')?.textContent.replace(/\s+/g, ' ').trim() };
});

const courant = (page) => page.evaluate((ST) => { const st = eval(ST); return JSON.parse(JSON.stringify(st.radarComptes.comptes.find(c => c.key === 'cpt_800') || null)); }, ST);
const caler = (page, fin) => page.evaluate(async ({ ST, fin }) => { const st = eval(ST);
    const a = st.atterrissageCycle.comptes.find(c => c.courant).atterrissage; st.comptes.find(c => c.id === 800).solde += (fin - a);
    st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 400)); return st.atterrissageCycle.comptes.find(c => c.courant).atterrissage; }, { ST, fin });
try {
    const { ctx, page } = await ouvrir();
    await section('B', async () => {
        const fin = await caler(page, 300);
        const c = await courant(page);
        v('B. le Courant finit le cycle à + 300 (26 nov.) — mais le 27, le premier morceau de semaine part avant le virement du 28 : sous zéro ce seul jour',
          fin === 300 && c.pointBas < 0 && c.datePointBas === '27 nov.' && c.aVirer === -c.pointBas && c.points.filter(p => p < 0).length === 1, JSON.stringify([fin, c.pointBas, c.datePointBas, c.aVirer, c.points]));
    });
    await section('C', async () => {
        const c = await courant(page);
        v('C. le radar sait que c\'est APRÈS le cycle affiché (fin le 26 nov.) et propose d\'avancer le virement du 28 au 27 nov.',
          c.pourquoi && c.pourquoi.apresCycle === true && c.pourquoi.finCycle === '26 nov.' && c.pourquoi.avancer && c.pourquoi.avancer.de === '28 nov.' && c.pourquoi.avancer.a === '27 nov.' && c.pourquoi.avancer.montant === 15000,
          JSON.stringify(c.pourquoi));
        const box = await page.evaluate(() => { const t = (s) => document.querySelector(s)?.textContent.replace(/\s+/g, ' ').trim() || ''; return { apres: t('[data-meteo-virement-apres-cycle]'), avancer: t('[data-meteo-virement-avancer]') }; });
        v('  → la grande case le dit : « ⏭️ … après le 26 nov. » et « 💡 Plutôt : avancez … du 28 nov. au 27 nov. »',
          /^⏭️ C’est au début du cycle suivant, après le 26 nov\./.test(box.apres) && /^💡 Plutôt : avancez « Virement reçu ← Compte Assafa » \(15\s000 DH\) du 28 nov\. au 27 nov\./.test(box.avancer.replace(/ | /g, ' ')), JSON.stringify(box));
    });
    await section('D', async () => {
        await page.evaluate(async (ST) => { const st = eval(ST); st.donneesAnnuelles[2026].virementsInternes[0].jourPrevu = 27; st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 400)); }, ST);
        const c = await courant(page);
        v('D. le virement posé le 27 (jour de paie) : le même jour, il arrive AVANT les dépenses — plus de creux, plus rien à virer',
          c.aVirer === 0 && c.pointBas >= 0, JSON.stringify([c.pointBas, c.datePointBas, c.aVirer]));
        const J = await page.evaluate((ST) => { const st = eval(ST), mb = st.moisBudgetaire, cyc = []; for (let m = mb.mois; m <= 12; m++) cyc.push(m + '-' + mb.an);
            return st.radarComptes.comptes.find(x => x.key === 'cpt_800').points; }, ST);
        v('  → la courbe du Courant ne passe jamais sous zéro', J.every(p => p >= 0), JSON.stringify(J));
        const vb = await page.evaluate(() => document.querySelectorAll('[data-meteo-virement]').length);
        v('  → la grande case des virements disparaît', vb === 0, String(vb));
    });
    await section('E', async () => {
        await page.evaluate(async (ST) => { const st = eval(ST); st.donneesAnnuelles[2026].virementsInternes[0].jourPrevu = 28; st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 300)); }, ST);
        await caler(page, -200);
        const c = await courant(page);
        v('E. le Courant passe sous zéro AVANT la paie (− 200 le 26 nov.) : on ne propose pas d\'avancer le virement d\'Assafa (son argent n\'est pas encore là)',
          c.pointBas < 0 && c.pourquoi && c.pourquoi.avancer === null && !(await page.$('[data-meteo-virement-avancer]')), JSON.stringify([c.pointBas, c.datePointBas, c.pourquoi && c.pourquoi.avancer]));
    });
    await ctx.close();
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
