/**
 * v37.156 — « L'AFFICHAGE N'EST PAS OK, JE NE PEUX PAS SUPPRIMER LE VIREMENT ! » : au Calendrier, la ligne d'un virement
 *   (deux comptes aux noms longs, le jour, « après paie → Janvier », le montant) ne passait pas à la ligne : le ✕ sortait de
 *   l'écran. Celle d'un flux exceptionnel cachait le sien derrière une barre de défilement. Vrai CSS (Tailwind compilé),
 *   bureau (1280) et téléphone (390) : chaque ✕ doit être ENTIER dans sa ligne, et supprimer.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { twCompiler } from './tw_cache.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8').split('\r\n').join('\n');

let ko = 0;
const v = (t, ok, d = '') => { if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(64)} ${ok ? '' : d}`); };
const section = async (nom, f) => { try { await f(); } catch (e) { v(`${nom} : exécution sans exception`, false, String(e && e.stack || e).slice(0, 300)); } };
console.log('\n  CALENDRIER : CHAQUE ✕ VISIBLE\n  ' + '─'.repeat(80));

v('A. les lignes de virement et de flux exceptionnel passent à la ligne (plus de min-w-max ni de ✕ à demi caché)',
  /data-vir-ligne class="flex flex-wrap/.test(html) && /data-dep-ligne class="flex flex-wrap/.test(html) && /data-vir-supprimer/.test(html) && /data-dep-supprimer/.test(html)
  && !/min-w-max md:min-w-0/.test(html));
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
    d.epargne = [];
    fx.comptes = [{ id: 'acc_cc', label: 'Compte Courant', type: 'liquide', solde: 9000, icone: '💳' }, { id: 'acc_as', label: 'Compte Principale ASSAFA', type: 'epargne', solde: 30000, icone: '💰' },
                  { id: 'acc_da', label: 'Dépenses Annuelles & Projets', type: 'epargne', solde: 0, icone: '💰' }, { id: 'acc_ur', label: 'Compte urgence', type: 'epargne', solde: 0, icone: '💰' }];
    d.virementsInternes = [{ id: 601, mois: 12, sourceCompte: 'cpt_acc_da', destinationCompte: 'cpt_acc_ur', montant: 35000, jourPrevu: 28 },
                           { id: 602, mois: 12, sourceCompte: 'cpt_acc_as', destinationCompte: 'cpt_acc_da', montant: 0, jourPrevu: 28 }];
    d.depensesIrregulieres = [{ id: 701, mois: 12, annee: 2026, nom: 'Paiement Notaire & Travaux', montant: 160000, paye: false, montantPaye: 0, sourceCompte: 'courant', categorieId: 'cat_irr_depense_exceptionnelle' }];
    d.consoRealiseeT0 = {}; d.consoClotureT0 = {}; d.banqueOperations = {};
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
const twBin = path.join(RACINE, 'node_modules/.bin/tailwindcss');
let tw = '';
if (fs.existsSync(twBin)) { const twTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-lignes-'));
  fs.writeFileSync(path.join(twTmp, 'in.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
  fs.writeFileSync(path.join(twTmp, 'cfg.js'), 'module.exports={content:[' + JSON.stringify(path.join(RACINE, 'index.html')) + '],theme:{extend:{}}};');
  twCompiler(twBin, ['-c', path.join(twTmp, 'cfg.js'), '-i', path.join(twTmp, 'in.css'), '-o', path.join(twTmp, 'out.css'), '--minify'], { stdio: 'ignore' });
  tw = fs.readFileSync(path.join(twTmp, 'out.css'), 'utf8'); fs.rmSync(twTmp, { recursive: true, force: true }); }
const page0 = html
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, '<link rel="stylesheet" href="/tailwind.css">')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');
const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const s = (c, b, ty = 'application/json') => { res.writeHead(c, { 'Content-Type': ty }); res.end(b); };
    if (p === '/finance/') return s(200, page0, 'text/html; charset=utf-8');
    if (p === '/tailwind.css') return s(200, tw, 'text/css');
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
    const mesurer = () => page.evaluate(() => {
        const vis = (e) => e.offsetParent !== null;
        const verif = (sel, ligneSel) => [...document.querySelectorAll(sel)].filter(vis).map(b => {
            const l = b.closest(ligneSel), rb = b.getBoundingClientRect(), rl = l.getBoundingClientRect();
            return { dedans: rb.left >= rl.left - 1 && rb.right <= rl.right + 1 && rb.right <= innerWidth + 1 && rb.width > 10,
                     defile: l.scrollWidth > l.clientWidth + 1 || (l.parentElement && l.parentElement.scrollWidth > l.parentElement.clientWidth + 1) };
        });
        return { vir: verif('[data-vir-supprimer]', '[data-vir-ligne]'), dep: verif('[data-dep-supprimer]', '[data-dep-ligne]'), page: document.documentElement.scrollWidth <= innerWidth + 1 };
    });
    const ouvrirDecembre = async () => {
        await E((st) => { st.appMode = 'previsionnel'; st.activeTab = 'irregulieres'; st.moisOuverts.splice(0, st.moisOuverts.length, 12); });
        await attendre(700);
        await page.evaluate(() => { const l = document.querySelector('[data-vir-ligne]'); if (l) l.scrollIntoView({ block: 'center' }); });
        await attendre(200);
    };
    await section('B', async () => {
        await ouvrirDecembre();
        const M = await mesurer();
        v('B. bureau (1280) : les 2 virements et le flux de décembre ont leur ✕ ENTIER dans leur ligne, sans barre de défilement',
          M.vir.length === 2 && M.dep.length === 1 && [...M.vir, ...M.dep].every(x => x.dedans && !x.defile), JSON.stringify(M));
    });
    await section('C', async () => {
        await page.setViewportSize({ width: 820, height: 1000 }); await attendre(500);
        await ouvrirDecembre();
        const M = await mesurer();
        v('C. petit écran de bureau (820) : idem — les lignes passent à la ligne au lieu de cacher le ✕', M.vir.length === 2 && M.dep.length === 1 && [...M.vir, ...M.dep].every(x => x.dedans && !x.defile), JSON.stringify(M));
        await page.setViewportSize({ width: 390, height: 844 }); await E((st) => { st.isMobile = true; st.activeMobileTab = 'flux'; }); await attendre(700);
        await page.evaluate(() => { const l = [...document.querySelectorAll('[data-vir-ligne]')].find(e => e.offsetParent !== null); if (l) l.scrollIntoView({ block: 'center' }); });
        await attendre(200);
        const T = await mesurer();
        v('  → téléphone (390, onglet flux) : chaque virement a son ✕ entier, la page ne défile pas de côté', T.vir.length === 2 && T.vir.every(x => x.dedans) && T.page, JSON.stringify(T));
        await page.setViewportSize({ width: 1280, height: 1000 }); await E((st) => { st.isMobile = false; }); await attendre(400);
    });
    await section('D', async () => {
        await ouvrirDecembre();
        page.once('dialog', d => d.accept());
        await page.locator('[data-vir-supprimer]').first().click(); await attendre(400);
        const n = await E((st) => (st.donneesAnnuelles[2026].virementsInternes || []).filter(v => Number(v.mois) === 12).map(v => v.id));
        v('D. un clic sur le ✕ du premier virement le supprime (reste celui de 0 DH)', JSON.stringify(n) === '[602]', JSON.stringify(n));
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
