/**
 * v37.79 — PLUS AUCUN « J.X » : DES DATES, PARTOUT.
 *
 *   « Il faut enlever de partout ces J-X ! » (décor de la suite « Le journal règle sa ligne du Pilotage »)
 *   Décor fictif (KARIM TESTEUR), jeudi 29 oct. 2026, paie le 27 (cycle de novembre : 27 oct. → 26 nov.) :
 *     Factures (mensuel) : elect 200 le 6, tel 99 le 6 ; charge fixe Syndic 300 ; Courses (semaine) : khdra.
 *     A. statique · B. le Pilotage · C. ce qui ne règle rien · D. la case et le journal · E. le Relevé.
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
console.log('\n  DES DATES, PARTOUT\n  ' + '─'.repeat(80));

v('A. plus aucun « j.N », « 📅 j. » ni « J−N » affiché (hors historique des versions)',
  !/j\.\{\{|📅 j\.|J−\{\{|'\(j\.' \+/.test(html.replace(/const CHANGELOG = \[[\s\S]*?\n\s{20}\];/, '')));

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
    fx.donneesAnnuelles = { 2026: JSON.parse(JSON.stringify(base)) };
    Object.assign(fx.soldesInitiaux, { moisActuel: 11, anneeActuelle: 2026, jourDePaie: 27, compteChargesFixes: 'courant', compteChargesVariables: 'courant', assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.soldesInitiaux.categories = [];
    fx.comptes = [{ id: 'acc_cc', label: 'Compte Courant', type: 'liquide', solde: 9000, icone: '💳' }];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    const d = fx.donneesAnnuelles[2026];
    const Rv = (label, b, j) => ({ ...neutre, label, base: b, jourPrevu: j, destinationCompte: 'courant' });
    d.revenus = { salaire: Rv('SALAIRE', 20000, 27), bonif: Rv('—', 0), magasin: Rv('—', 0), cnss: Rv('—', 0), appart: Rv('—', 0), studio: Rv('—', 0) };
    const Fx = (label, valeur, j) => ({ ...neutre, label, valeur, jourPrevu: j });
    d.chargesFixes = { creditImmo: Fx('—', 0), creditStudio: Fx('—', 0), syndic: Fx('Syndic', 300, 10), nounou: Fx('—', 0), ecole: Fx('—', 0), femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
    d.chargesVariables = {
        alimentation: { ...neutre, label: 'Courses', valeur: 0, periode: 'semaine', details: [{ nom: 'khdra', montant: 200, periode: 'semaine' }] },
        factures: { ...neutre, label: 'Factures', valeur: 299, periode: 'mois', details: [{ nom: 'elect', montant: 200, jourPrevu: 6 }, { nom: 'tel', montant: 99, jourPrevu: 6 }] },
    };
    d.epargne = []; d.depensesIrregulieres = []; d.virementsInternes = []; d.consoRealiseeT0 = {}; d.consoClotureT0 = {}; d.banqueOperations = {};
    const T = (id, date, libelle, montant, categorieId, extra = {}) => ({ id, datetime: date + 'T12:00', date, mois: Number(date.slice(5, 7)), libelle, montant, categorieId, categorieSource: 'règle', compteId: 'acc_cc', source: 'banque', ...extra });
    d.transactionsReelles = [
        T(1, '2026-10-29', 'Société Régionale Mult', 221, 'cat_cv_factures__delect'),
        T(2, '2026-10-28', 'Orange', 49, 'cat_cv_factures__dtel'),
        T(3, '2026-10-29', 'khdra marché', 20, 'cat_cv_alimentation__dkhdra', { source: 'manuel' }),
        T(4, '2026-10-20', 'Syndic octobre', 300, 'cat_cf_syndic'),                                  // cycle d'octobre
        T(5, '2026-10-29', 'LIBELLE INCONNU', 300, 'cat_cf_syndic', { categorieSource: 'défaut', aVerifier: true }),
    ];
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
        const D = await page.evaluate((ST) => { const st = eval(ST); return [st.dateDuCycle(6, '2026-11'), st.dateDuCycle(28, '2026-12'), st.dateDuCycle(31, '2026-03'), st.dateDuCycle(29, '2027-01'), st.dateDuCycle(null, '2026-11'), st.dateDuCycle(6)]; }, ST);
        v('B. un jour de cycle → une date : 6 (nov.) → « 6 nov. » ; 28 (déc.) → « 28 nov. » ; 31 (mars) → « 28 févr. » ; 29 (janv. 2027) → « 29 déc. »',
          JSON.stringify(D) === JSON.stringify(['6 nov.', '28 nov.', '28 févr.', '29 déc.', '', '6 nov.']), JSON.stringify(D));
    });
    await section('C', async () => {
        const P = await page.evaluate(() => ({ badges: [...document.querySelectorAll('span')].filter(e => e.offsetParent !== null && /^📅/.test(e.textContent.trim())).map(e => e.textContent.trim()),
            entete: [...document.querySelectorAll('p')].map(p => p.textContent.replace(/\s+/g, ' ')).find(t => /avant la paie du/.test(t)) || '' }));
        v('C. Pilotage : les badges disent « 📅 6 nov. », « 📅 10 nov. » — aucun « j. »',
          P.badges.includes('📅 6 nov.') && P.badges.includes('📅 10 nov.') && !P.badges.some(b => /j\./.test(b)), JSON.stringify(P.badges));
        const J = await page.evaluate((ST) => eval(ST).joursRestantsAvantPaie, ST);
        v('  → l\'en-tête : « N jours avant la paie du … » (plus de « J−N »)', new RegExp('\\b' + J + ' jours avant la paie du').test(P.entete) && !/J−/.test(P.entete), P.entete);
    });
    await section('D', async () => {
        await page.evaluate(async (ST) => { const st = eval(ST), d = st.donneesAnnuelles[2026];
            d.virementsInternes = [{ id: 9, mois: 12, sourceCompte: 'cpt_acc_cc', destinationCompte: 'courant', montant: 100, jourPrevu: 1 }];
            st.appMode = 'previsionnel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'irregulieres'; st.anneeAffichage = 2026;
            if (!st.moisOuverts.includes(12)) st.toggleMois(12); await new Promise(r => setTimeout(r, 600)); }, ST);
        const C = await page.evaluate(() => [...document.querySelectorAll('input[data-jour-exact]')].filter(e => e.offsetParent !== null).map(i => i.closest('label').textContent.replace(/\s+/g, ' ').trim() + '|' + i.value));
        v('D. Calendrier : la case de jour se lit comme une date — « 📅 le [1] déc. »', C.some(x => /^📅 ?le ?déc\.\|1$/.test(x)), JSON.stringify(C));
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
