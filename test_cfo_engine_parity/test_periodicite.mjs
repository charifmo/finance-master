/**
 * v37.150 — UNE CHARGE FIXE SELON X MOIS.
 *
 *   « Je veux ajouter une option dans les charges fixes qui se font selon x mois, par exemple le syndic :
 *     des fois c'est chaque trimestre que je dois payer ! »
 *   Décor fictif, jeudi 29 oct. 2026, paie le 27 (cycle de novembre : 27 oct. → 26 nov.) : Syndic 300 le 10, chaque mois.
 *     A. statique · B. le calendrier des paiements · C. l'écran (bureau) · D. le Pilotage et la projection fin 2026 ·
 *     E. les années suivantes et l'équivalent mensuel.
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
console.log('\n  UNE CHARGE FIXE SELON X MOIS (trimestre, semestre, an)\n  ' + '─'.repeat(80));

v('A. un seul évaluateur : valeurEffective ne doit rien les mois sans paiement ; la projection « bilan » passe par lui (plus de copie des exceptions)',
  /if \(!estMoisDePaiement\(item, m\)\) return 0;/.test(html) && /const effVal = valeurEffective\(f, \(f \|\| \{\}\)\.valeur, mNum\);/.test(html)
  && !/\(f\?\.exceptions \|\| \[\]\)\.forEach\(e => \{ if \(mNum >= e\.moisDebut/.test(html));
v('  → le choix « 🔁 Paiement » sur chaque charge fixe, au bureau ET au téléphone ; le journal du cycle et la clôture rétro lisent le dû du mois',
  (html.match(/data-periodicite-tous/g) || []).length === 2 && (html.match(/getDueFixe\(f, an, mois\)/g) || []).length >= 3);
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
    d.transactionsReelles = []; const _ancien = [
        T(1, '2026-10-29', 'Société Régionale Mult', 221, 'cat_cv_factures__delect'),
        T(2, '2026-10-28', 'Orange', 49, 'cat_cv_factures__dtel'),
        T(3, '2026-10-29', 'khdra marché', 20, 'cat_cv_alimentation__dkhdra', { source: 'manuel' }),
        T(4, '2026-10-20', 'Syndic octobre', 300, 'cat_cf_syndic'),                                  // cycle d'octobre
        T(5, '2026-10-29', 'LIBELLE INCONNU', 300, 'cat_cf_syndic', { categorieSource: 'défaut', aVerifier: true }),
    ]; void _ancien;
    fx.donneesAnnuelles[2027] = JSON.parse(JSON.stringify(d));
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
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox', '--force-prefers-reduced-motion'] });
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
    const E = (f, ...a) => page.evaluate(({ ST, f, a }) => { const st = eval(ST); return new Function('st', 'a', 'return (' + f + ')(st, ...a)')(st, a); }, { ST, f: f.toString(), a });
    const attendre = (ms) => page.waitForTimeout(ms);
    const regler = async (per, valeur) => { await E((st, per, valeur) => { const it = st.donneesAnnuelles[2026].chargesFixes.syndic; if (per) it.periodicite = per; else delete it.periodicite; it.valeur = valeur; st.forceUpdateCalculations(); }, per, valeur); await attendre(400); };
    const etat = () => E((st) => { const t = st.tachesPilotageToutes.find(x => x.libelle === 'Syndic'); return { pilotage: t ? t.due : null, projete: Math.round(st.patrimoineProjeteGlobal), totalFixes: Math.round(st.totalFixes) }; });

    await section('B', async () => {
        const R = await E((st) => ({
            trim3: st.moisDePaiement({ periodicite: { tous: 3, depart: 3 } }),
            trim11: st.moisDePaiement({ periodicite: { tous: 3, depart: 11 } }),
            sem: st.moisDePaiement({ periodicite: { tous: 6, depart: 1 } }),
            an: st.moisDePaiement({ periodicite: { tous: 12, depart: 12 } }),
            bi: st.moisDePaiement({ periodicite: { tous: 2, depart: 2 } }),
            faux: st.moisDePaiement({ periodicite: { tous: 5, depart: 1 } }).length,
            mens: st.moisDePaiement({}).length,
            v: [st.valeurEffective({ valeur: 900, periodicite: { tous: 3, depart: 3 } }, 900, 6), st.valeurEffective({ valeur: 900, periodicite: { tous: 3, depart: 3 } }, 900, 7)],
            exc: st.valeurEffective({ valeur: 900, periodicite: { tous: 3, depart: 3 }, exceptions: [{ moisDebut: 1, moisFin: 12, nouvelleValeur: 950 }] }, 900, 8),
            lisse: st.mensuelLisse({ periodicite: { tous: 3, depart: 1 } }, 900),
        }));
        v('B. trimestre dès mars : mars · juin · sept. · déc. ; dès novembre : févr. · mai · août · nov. ; semestre dès janvier : janv. · juil. ; an : déc. ; 2 mois : pairs',
          JSON.stringify([R.trim3, R.trim11, R.sem, R.an, R.bi]) === JSON.stringify([[3, 6, 9, 12], [2, 5, 8, 11], [1, 7], [12], [2, 4, 6, 8, 10, 12]]), JSON.stringify(R));
        v('  → « tous les 5 mois » (ne tombe pas pareil chaque année) n\'est pas un rythme : la ligne reste mensuelle ; sans rythme : 12 mois', R.faux === 12 && R.mens === 12, JSON.stringify(R));
        v('  → 900 dus en juin, rien en juillet ; une exception « 950 » ne crée pas de paiement en août (hors rythme) ; équivalent mensuel 300',
          JSON.stringify(R.v) === '[900,0]' && R.exc === 0 && R.lisse === 300, JSON.stringify(R));
    });

    let P0;
    await section('C', async () => {
        P0 = await etat();
        v('C0. référence — Syndic 300 chaque mois : à traiter en novembre (300), 300 / mois au budget', P0.pilotage === 300 && P0.totalFixes === 300, JSON.stringify(P0));
        await E((st) => { st.appMode = 'previsionnel'; st.activeTab = 'parametres'; });
        await attendre(600);
        await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
        const sel = await page.$$eval('[data-periodicite][data-ligne="chargesFixes:syndic"] [data-periodicite-tous]', els => els.filter(e => e.offsetParent !== null).length);
        v('C1. au Budget, la ligne « Syndic » propose « 🔁 Paiement : Chaque mois » (rien d\'autre à l\'écran tant qu\'elle est mensuelle)', sel >= 1
          && await page.$$eval('[data-periodicite][data-ligne="chargesFixes:syndic"] [data-periodicite-depart]', els => els.filter(e => e.offsetParent !== null).length) === 0, String(sel));
        const visible = '[data-periodicite][data-ligne="chargesFixes:syndic"]:visible';
        await page.locator(visible + ' [data-periodicite-tous]').first().selectOption('3');
        await attendre(300);
        await page.locator(visible + ' [data-periodicite-depart]').first().selectOption('12');
        await E((st) => { st.donneesAnnuelles[2026].chargesFixes.syndic.valeur = 900; st.forceUpdateCalculations(); });
        await attendre(400);
        const R = await E((st) => ({ per: st.donneesAnnuelles[2026].chargesFixes.syndic.periodicite, per27: st.donneesAnnuelles[2027].chargesFixes.syndic.periodicite }));
        const resume = await page.locator(visible + ' [data-periodicite-resume]').first().textContent();
        v('C2. « Chaque trimestre », 1ᵉʳ paiement « Décembre », 900 : enregistré { tous: 3, depart: 12 } et le résumé le dit (« mars · juin · sept. · déc. », ≈ 300 / mois)',
          JSON.stringify(R.per) === '{"tous":3,"depart":12}' && /payé en mars · juin · sept\. · déc\./.test(resume) && /≈ 300/.test(resume), JSON.stringify({ R, resume }));
        v('  → le rythme vaut aussi pour 2027 (même ligne) : un syndic trimestriel le reste', JSON.stringify(R.per27) === '{"tous":3,"depart":12}', JSON.stringify(R));
        await E((st) => { st.activeTab = 'pilotage'; st.appMode = 'reel'; });
        await attendre(500);
    });

    await section('D', async () => {
        const D1 = await etat();
        v('D1. trimestriel dès décembre (900) : rien à payer en novembre ; fin 2026 : un paiement de 900 en déc. au lieu de 2 × 300 → projection −300',
          D1.pilotage === null && D1.projete === P0.projete - 300 && D1.totalFixes === 300, JSON.stringify({ P0, D1 }));
        await regler({ tous: 3, depart: 2 }, 900);
        const D2 = await etat();
        v('D2. dès février (févr. · mai · août · nov.) : 900 à traiter en novembre, plus rien en décembre → projection −300 aussi',
          D2.pilotage === 900 && D2.projete === P0.projete - 300, JSON.stringify(D2));
        await regler({ tous: 3, depart: 1 }, 900);
        const D3 = await etat();
        v('D3. dès janvier (janv. · avr. · juil. · oct.) : aucun paiement d\'ici fin 2026 → projection +600 (les deux mois à 300 tombent)',
          D3.pilotage === null && D3.projete === P0.projete + 600, JSON.stringify(D3));
        await regler({ tous: 12, depart: 11 }, 3600);
        const D4 = await etat();
        v('D4. une fois par an, en novembre, 3 600 : à traiter maintenant (3 600) ; au budget, 300 / mois lissé', D4.pilotage === 3600 && D4.totalFixes === 300 && D4.projete === P0.projete - 3000, JSON.stringify(D4));
        await regler(null, 300);
        const D5 = await etat();
        v('D5. retour à « Chaque mois » : tout revient comme avant (300 en novembre, même projection)', D5.pilotage === 300 && D5.projete === P0.projete && D5.totalFixes === 300, JSON.stringify(D5));
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
