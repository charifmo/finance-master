/**
 * v37.104 — CHOISIR UNE CATÉGORIE EN CHERCHANT.
 *
 *   « Cette liste n'est pas très pratique : je préconise un truc où je peux faire une recherche pour trouver la catégorie. »
 *
 *   Les 7 menus de catégorie (saisie, saisie rapide, « autre… », journal : filtre, clic, modifier ; frise) ouvrent un panneau
 *   avec une recherche déjà active. Décor : vos catégories (celui de la catégorisation).
 *     A. le panneau · B. chercher (mère, accents, plusieurs mots, rien) · C. clavier, Échap, à côté, « Automatique » ·
 *     D. « autre… » dans « À vérifier » · E. au téléphone.
 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8').split('\r\n').join('\n');


let ko = 0, n = 0;
const v = (t, ok, d = '') => { n++; if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(78)} ${ok ? '' : String(d).slice(0, 600)}`); };
const section = async (nom, f) => { try { await f(); } catch (e) { v(`${nom} : exécution sans exception`, false, String(e && e.stack || e).slice(0, 400)); } };
console.log('\n  CHOISIR UNE CATÉGORIE EN CHERCHANT\n  ' + '─'.repeat(80));

const require = createRequire(import.meta.url);
const essai = (f) => { try { return f(); } catch { return null; } };
const pw = essai(() => require('playwright-core'));
const vueJs = essai(() => require.resolve('vue/dist/vue.global.js'));
const chartJs = essai(() => fs.existsSync(path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js'))
                           && path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js'));
const chromium = process.env.CHROMIUM || ['/opt/pw-browsers/chromium']
    .find(p => essai(() => fs.existsSync(p) && fs.statSync(p).isFile()));
if (!pw || !vueJs || !chartJs || !chromium) {
    console.log('  ⏭️  partie navigateur ignorée (playwright-core, vue, chart.js ou Chromium absent)');
    console.log(ko === 0 ? `  ✅ TOUT PASSE — ${n} contrôles` : `  ❌ ${ko} contrôle(s) en échec`);
    process.exit(ko === 0 ? 0 : 1);
}

const twBin = path.join(RACINE, 'node_modules/.bin/tailwindcss');
if (!fs.existsSync(twBin)) { console.log('  ⏭️  partie navigateur ignorée (tailwindcss absent)'); process.exit(ko === 0 ? 0 : 1); }
const twTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-choix-'));
fs.writeFileSync(path.join(twTmp, 'in.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
fs.writeFileSync(path.join(twTmp, 'cfg.js'), 'module.exports={content:[' + JSON.stringify(path.join(RACINE, 'index.html')) + '],theme:{extend:{}}};');
execFileSync(twBin, ['-c', path.join(twTmp, 'cfg.js'), '-i', path.join(twTmp, 'in.css'), '-o', path.join(twTmp, 'out.css'), '--minify'], { stdio: 'ignore' });
const tw = fs.readFileSync(path.join(twTmp, 'out.css'), 'utf8');
fs.rmSync(twTmp, { recursive: true, force: true });

/* ── Le décor : vos catégories ───────────────────────────────────────── */
const fixture = () => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = {};
    for (const an of [2026, 2027]) fx.donneesAnnuelles[an] = JSON.parse(JSON.stringify(base));
    Object.assign(fx.soldesInitiaux, { moisActuel: 10, anneeActuelle: 2026, jourDePaie: 27, compteChargesFixes: 'courant', compteChargesVariables: 'courant',
                                       assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    //  Une catégorie restée au registre, plus portée par aucune ligne
    fx.soldesInitiaux.categories = [{ id: 'cat_cv_alimentation__dmarjane_lait', label: 'Marjane Lait', type: 'charge_variable_detail', parent: 'cat_cv_alimentation', archive: false }];
    fx.comptes = [{ id: 1, label: 'Compte Courant', type: 'courant', solde: 9000, icone: '💳' }];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    const L = (nom, montant, periode) => ({ nom, montant, ...(periode ? { periode } : {}) });
    for (const an of Object.keys(fx.donneesAnnuelles)) {
        const d = fx.donneesAnnuelles[an];
        const Fx = (label, valeur) => ({ ...neutre, label, valeur, jourPrevu: null });
        d.chargesFixes = { creditImmo: Fx('Crédit Immo + Assur', 5000), creditStudio: Fx('Crédit Studio', 2000), syndic: Fx('Syndic', 300), nounou: Fx('Nounou', 2500),
                           ecole: Fx('École', 1500), femmeMenage: Fx('Femme de ménage', 1200), habitsCharif: Fx('Habits Charif', 300), habitsBebe: Fx('Habits Bébé', 300), jouets: Fx('Jouets', 200) };
        const V = (label, valeur, periode, details) => ({ ...neutre, label, valeur, periode, details });
        d.chargesVariables = {
            alimentation: V('Alimentation (Tqdya)', 0, 'semaine', [L('samak', 75), L('l7m', 75), L('kfta', 150), L('djaj', 40), L('sqata', 150), L('khdra', 200), L('dessert', 100),
                                                                 L('Œufs', 50), L('Marjane ', 400), L('Nuggets', 100), L('lhrri', 1200, 'cycle')]),
            sorties: V('Sorties', 0, 'semaine', [L('cafe Resto Wknd', 400), L('Cafe Charif', 100), L('barber', 60, 'quinzaine')]),
            voiture: V('Voiture', 0, 'semaine', [L('essence picanto', 300), L('diesel skoda', 350), L('Ghsil voiture', 40)]),
            sante: V('Santé', 0, 'semaine', [L('Medicam (reste à charge)', 200, 'cycle'), L('Medecin (reste à charge)', 500, 'cycle'), L('Psy', 500, 'quinzaine'), L('psy charif', 300, 'cycle'), L('complement', 500, 'cycle')]),
            factures: { ...V('Factures', 0, 'mois', [L('elect', 200), L('tel', 99), L('internet', 250), L('eau', 300), L('netflix', 98), L('IA', 500), L('chatgpt', 200)]), categorieId: 'cat_cv_factures' },
        };
        d.epargne = [{ id: 1, nom: 'Alimentation depenses annuels', valeur: 1000, sourceCompte: 'courant', exceptions: [] },
                     { id: 2, nom: 'Épargne courses', valeur: 500, sourceCompte: 'courant', exceptions: [] }];
        d.depensesIrregulieres = []; d.virementsInternes = []; d.consoRealiseeT0 = {};
        //  Deux « Marjane » rangés AUTOMATIQUEMENT par l'ancien moteur dans la catégorie mère,
        //  un « café » dans Sorties, et le « mcdonald s » resté Non catégorisé
        d.transactionsReelles = an !== '2026' ? [] : [
            { id: 501, datetime: '2026-10-10T21:08', date: '2026-10-10', mois: 10, libelle: 'Marjane', montant: 176, categorieId: 'cat_cv_alimentation', compteId: 1, source: 'manuel' },
            { id: 502, datetime: '2026-10-10T21:09', date: '2026-10-10', mois: 10, libelle: 'Marjane', montant: 80, categorieId: 'cat_cv_alimentation', compteId: 1, source: 'manuel' },
            { id: 503, datetime: '2026-10-13T11:03', date: '2026-10-13', mois: 10, libelle: 'mcdonald s', montant: 65, categorieId: 'cat_misc', compteId: 1, source: 'manuel' },
        ];
    }
    return fx;
};
const page0 = html
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, '<link rel="stylesheet" href="/tailwind.css">')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');
const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const s = (c, b, t = 'application/json') => { res.writeHead(c, { 'Content-Type': t }); res.end(b); };
    if (p === '/finance/') return s(200, page0, 'text/html; charset=utf-8');
    if (p === '/vue.js') return s(200, fs.readFileSync(vueJs), 'text/javascript');
    if (p === '/tailwind.css') return s(200, tw, 'text/css');
    if (p === '/chart.js') return s(200, fs.readFileSync(chartJs), 'text/javascript');
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fixture()));
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';

//  ── Les contrôles ──────────────────────────────────────────────────────────
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
await page.clock.setFixedTime(new Date(2026, 9, 13, 12, 0, 0));
const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
page.on('dialog', d => d.accept());
await page.route('**/webhook/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ output: '{"id": null, "confiance": "basse", "raison": "test"}' }) }));
await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
//  les données du décor sont arrivées (l'appli démarre d'abord sur un état vide : sous charge, le serveur répond après)
await page.waitForFunction((ST) => { const st = eval(ST); return (st.donneesAnnuelles[2026]?.transactionsReelles || []).some(t => t.id === 501); }, ST, { timeout: 30000 });
await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; await Vue.nextTick(); st.activeTab = 'saisie'; await Vue.nextTick(); }, ST);
await page.fill('input[placeholder="Ex: 200 courses"]', '40 essai');      // « ⚙️ Ajuster » n'apparaît qu'une fois la saisie commencée
await page.waitForSelector('[data-saisie-ajuster]', { state: 'visible', timeout: 10000 });
await page.click('[data-saisie-ajuster]');                     // « ⚙️ Ajuster » : le volet où se trouve la catégorie, sur ordinateur
await page.waitForSelector('[data-saisie-details] [data-saisie-categorie] [data-cc-ouvrir]', { state: 'visible', timeout: 10000 });
const idDe = (label) => page.evaluate(({ ST, label }) => { const c = (eval(ST).soldesInitiaux.categories || []).find(x => String(x.label).trim() === label && !x.archive); return c ? c.id : null; }, { ST, label });
const SEL = '[data-saisie-details] [data-saisie-categorie]';
const ouvrir = async () => { if (!(await page.$('[data-cc-panneau]'))) await page.click(`${SEL} [data-cc-ouvrir]`); await page.waitForSelector('[data-cc-panneau] [data-cc-recherche]'); };
const chercher = async (q) => { await page.fill('[data-cc-panneau] [data-cc-recherche]', q); await page.evaluate(() => Vue.nextTick()); };
const lignes = () => page.$$eval('[data-cc-panneau] [data-cc-option]', l => l.map(o => ({ id: o.dataset.id, libelle: o.querySelector('[data-cc-libelle]').textContent.trim(), mere: (o.querySelector('[data-cc-parent]') || {}).textContent?.trim() || '' })));
const ouvert = async () => !!(await page.$('[data-cc-panneau]'));

try {
    await section('A', async () => {
        v('A. plus aucune liste déroulante de catégories : les 7 menus sont des sélecteurs avec recherche',
          !/<optgroup v-for="g in categoriesPourRanger"/.test(html) && (html.match(/<choix-categorie /g) || []).length === 7);
        await ouvrir();
        const focus = await page.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-cc-recherche'));
        const l0 = await lignes();
        v('  → un appui ouvre le panneau, le curseur est DÉJÀ dans la recherche ; sans recherche, toute la liste (« Automatique » en tête)',
          focus && l0[0].id === '' && /Automatique/.test(l0[0].libelle) && l0.length > 40, JSON.stringify([focus, l0.length, l0[0]]));
    });
    await section('B', async () => {
        await chercher('dies');
        const r = await lignes();
        v('B. « dies » → « diesel skoda », avec sa catégorie mère « Voiture »', r.length >= 1 && r[0].libelle === 'diesel skoda' && r[0].mere === 'Voiture', JSON.stringify(r));
        await chercher('voiture');
        const rv = (await lignes()).map(x => x.libelle);
        v('  → « voiture » : la mère et toutes ses lignes (essence picanto, diesel skoda, Ghsil voiture)',
          ['Voiture', 'essence picanto', 'diesel skoda', 'Ghsil voiture'].every(x => rv.includes(x)), JSON.stringify(rv));
        await chercher('MÉDECIN');
        const rm = (await lignes()).map(x => x.libelle);
        await chercher('oeufs');
        const ro = (await lignes()).map(x => x.libelle);
        v('  → accents et majuscules ne comptent pas : « MÉDECIN » → Medecin (reste à charge) ; « oeufs » → Œufs', rm.includes('Medecin (reste à charge)') && ro.includes('Œufs'), JSON.stringify([rm, ro]));
        await chercher('cafe charif');
        const rc = (await lignes()).map(x => x.libelle);
        v('  → plusieurs mots, tous retrouvés : « cafe charif » → Cafe Charif seul (pas cafe Resto Wknd)', rc.length === 1 && rc[0] === 'Cafe Charif', JSON.stringify(rc));
        await chercher('zzzz');
        v('  → rien ne correspond : « Aucune catégorie ne contient « zzzz » », aucune ligne', (await lignes()).length === 0 && /Aucune catégorie ne contient « zzzz »/.test(await page.textContent('[data-cc-panneau] [data-cc-aucune]')));
    });
    await section('C', async () => {
        await chercher('dies'); await page.keyboard.press('Enter');
        const diesel = await idDe('diesel skoda');
        const e = await page.evaluate((ST) => { const st = eval(ST); return { cat: st.saisieForm.categorieId, source: st.saisieCatSource }; }, ST);
        v('C. au clavier : « dies » puis Entrée → diesel skoda choisi (à la main : « manuel »), le panneau se ferme',
          e.cat === diesel && e.source === 'manuel' && !(await ouvert()), JSON.stringify(e));
        v('  → le bouton affiche « diesel skoda · Voiture »', (await page.textContent(`${SEL} [data-cc-texte]`)).trim() === 'diesel skoda · Voiture');
        await ouvrir();
        v('  → rouvert : la catégorie choisie est cochée (✓) et mise en avant', await page.evaluate((id) => { const b = document.querySelector(`[data-cc-panneau] [data-cc-option][data-id="${id}"]`); return !!b && /✓/.test(b.textContent) && b.hasAttribute('data-cc-actif'); }, diesel));
        await chercher('ess'); await page.keyboard.press('Escape');
        v('  → Échap : fermé, rien de changé (toujours diesel skoda)', !(await ouvert()) && await page.evaluate((ST) => eval(ST).saisieForm.categorieId, ST) === diesel);
        await ouvrir(); await page.mouse.click(10, 10);
        v('  → un appui à côté du panneau le ferme aussi', !(await ouvert()));
        await ouvrir(); await page.click('[data-cc-panneau] [data-cc-option][data-id=""]');
        v('  → « 🤖 Automatique » rend la main aux règles (plus de choix manuel)', await page.evaluate((ST) => { const st = eval(ST); return st.saisieCatSource !== 'manuel'; }, ST) && /Automatique/.test(await page.textContent(`${SEL} [data-cc-texte]`)));
    });
    await section('D', async () => {
        //  « autre… » dans « À vérifier » : on cherche, on clique, l'opération est rangée (et le choix devient une règle)
        const t = await page.evaluate((ST) => { const st = eval(ST); const d = st.donneesAnnuelles[2026]; const id = 990001; d.transactionsReelles.push({ id, datetime: '2026-10-13T10:00', date: '2026-10-13', mois: 10, libelle: 'achat inconnu', montant: 30, categorieId: 'cat_misc', compteId: 1, source: 'manuel', aVerifier: true }); st.calculationTick++; return id; }, ST);
        await page.waitForSelector(`[data-a-categoriser-ligne][data-tx="${t}"] [data-ranger-autre] [data-cc-ouvrir]`);
        await page.click(`[data-a-categoriser-ligne][data-tx="${t}"] [data-ranger-autre] [data-cc-ouvrir]`);
        await chercher('barb'); const rb = await lignes();
        await page.click(`[data-cc-panneau] [data-cc-option][data-id="${rb[0].id}"]`);
        const x = await page.evaluate(({ ST, t }) => JSON.parse(JSON.stringify(eval(ST).donneesAnnuelles[2026].transactionsReelles.find(y => y.id === t))), { ST, t });
        v('D. « autre… » dans « À vérifier » : « barb » → barber, l’opération est rangée (« vous »), le bouton redit « autre… »',
          rb[0].libelle === 'barber' && x.categorieId === await idDe('barber') && x.categorieSource === 'vous' && !(await ouvert()), JSON.stringify([rb[0], x]));
    });
    await section('E', async () => {
        //  au téléphone : le panneau s'ouvre en HAUT de l'écran — le clavier monte du bas et ne cache ni la recherche ni les résultats —, sa liste défile
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(async (ST) => { const st = eval(ST); st.openSaisieQuickModal(); await Vue.nextTick(); }, ST);
        await page.fill(`input[placeholder='Ex: "400 courses"']`, '30 essai'); await page.click('.fixed.inset-0.z-\\[80\\] [data-saisie-ajuster]');
        await page.waitForSelector('.fixed.inset-0.z-\\[80\\] [data-saisie-categorie] [data-cc-ouvrir]', { state: 'visible' });
        await page.click('.fixed.inset-0.z-\\[80\\] [data-saisie-categorie] [data-cc-ouvrir]');
        await page.waitForSelector('[data-cc-panneau] [data-cc-recherche]');
        const g = await page.evaluate(() => { const p = document.querySelector('[data-cc-panneau] > div'), r = p.getBoundingClientRect(), l = document.querySelector('[data-cc-panneau] [data-cc-liste]');
            return { bas: Math.round(r.bottom), haut: Math.round(r.top), H: innerHeight, W: innerWidth, larg: Math.round(r.width), defile: l.scrollHeight > l.clientHeight, dessus: document.elementFromPoint(r.left + 20, r.top + 20)?.closest('[data-cc-panneau]') !== null }; });
        v('E. au téléphone : panneau en HAUT de l’écran (le clavier ne le cache pas), pleine largeur, au-dessus de la saisie rapide, sa liste défile',
          g.haut === 0 && g.bas <= Math.round(g.H * 0.76) && g.larg === g.W && g.defile && g.dessus, JSON.stringify(g));
        await chercher('netf'); await page.click('[data-cc-panneau] [data-cc-option]');
        v('  → « netf » → netflix, choisi dans la saisie rapide', await page.evaluate((ST) => eval(ST).saisieForm.categorieId, ST) === await idDe('netflix'));
        await page.evaluate((ST) => eval(ST).closeSaisieQuickModal(), ST);
        v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
    });
} catch (e) {
    v('exécution sans exception', false, String(e && e.stack || e).slice(0, 400));
} finally {
    await browser.close(); srv.close();
}
console.log('  ' + '─'.repeat(80));
console.log(ko === 0 ? `  ✅ TOUT PASSE — ${n} contrôles` : `  ❌ ${ko} contrôle(s) en échec sur ${n}`);
process.exit(ko === 0 ? 0 : 1);
