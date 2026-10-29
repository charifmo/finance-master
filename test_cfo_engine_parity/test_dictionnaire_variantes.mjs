/**
 * v37.76 — UN DICTIONNAIRE PLUS RICHE, QUI APPREND VOS VARIANTES · LA FRISE DU CYCLE EN VUE.
 *
 *   « Il n'a pas su ajouter Carrefour à Supermarché ! Et une fois que je corrige quelque chose de l'IA ou
 *     quelque chose de suspendu, il ajoute ça au dictionnaire sous variantes. »
 *   Décor fictif (KARIM TESTEUR) : Alimentation › « Super marché », et une autre catégorie « Vie Karim »
 *   › « Super marché Karim » (le piège : deux lignes qui commencent pareil). Lundi 19 oct. 2026.
 *     A. statique · B. le dictionnaire · C. une correction devient une variante · D. une opération en
 *     suspens validée · E. une réponse sûre de l'IA · F. vos choix devant le dictionnaire · G. la frise.
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
console.log('\n  DICTIONNAIRE ENRICHI, VARIANTES APPRISES\n  ' + '─'.repeat(80));

/* ── A. Statique ─────────────────────────────────────────────────────── */
const bloc = html.slice(html.indexOf('const DICO_ENRICHI = {'), html.indexOf('DICO_CATEGORIES.forEach(r => {'));
const cles = [...bloc.matchAll(/^\s+'([^']+)': \{ m: /gm)].map(m => m[1]);
const themes = [...html.matchAll(/\{ t: '([^']+)'/g)].map(m => m[1]);
const orphelins = cles.filter(k => themes.filter(t => t.startsWith(k)).length !== 1);
v('A. dictionnaire enrichi : ' + cles.length + ' thèmes complétés, chacun rattaché à UN thème existant', cles.length >= 18 && !orphelins.length, JSON.stringify(orphelins));
v('  → « Variantes ajoutées au dictionnaire » dans « Ce que l\'appli a appris », chacune oubliable',
  /data-apprentissage-variantes/.test(html) && /data-apprentissage-oublier-variante @click="oublierVariante\(x\.mot\)"/.test(html));
v('  → la frise du cycle : un bouton dans l\'en-tête du Pilotage, un vrai bouton dans la Météo',
  /data-ouvrir-frise-entete @click="friseOuverte = true"/.test(html) && />📈 Cycle et semaines<\/button>/.test(html) && />📈 Voir le cycle et ses semaines(<span[^<]*>[^<]*<\/span>)?<\/button>/.test(html));

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

const CC = 'acc_cc';
const fixture = () => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = { 2026: JSON.parse(JSON.stringify(base)) };
    Object.assign(fx.soldesInitiaux, { moisActuel: 10, anneeActuelle: 2026, jourDePaie: 27, compteChargesFixes: 'courant', compteChargesVariables: 'courant', assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.soldesInitiaux.categories = [];
    fx.comptes = [{ id: CC, label: 'Compte Courant', type: 'liquide', solde: 6300, icone: '💳' }];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    const L = (nom, montant) => ({ nom, montant });
    const d = fx.donneesAnnuelles[2026];
    const V = (label, valeur, periode, details) => ({ ...neutre, label, valeur, periode, details });
    d.chargesVariables = {
        alimentation: V('Alimentation (Tqdya)', 0, 'semaine', [L('khdra', 200), L('Super marché', 400)]),
        sorties: V('Sorties', 0, 'semaine', [L('cafe Resto Wknd', 400)]),
        viekarim: V('Vie Karim', 0, 'semaine', [L('Super marché Karim', 300)]),
        factures: V('Factures', 0, 'mois', [L('tel', 99), L('eau', 300)]),
    };
    d.epargne = []; d.depensesIrregulieres = []; d.consoRealiseeT0 = {}; d.virementsInternes = []; d.transactionsReelles = [];
    return fx;
};
const page0 = html
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, '')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');
let reponseIA = null;
const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const s = (c, b, t = 'application/json') => { res.writeHead(c, { 'Content-Type': t }); res.end(b); };
    if (p === '/finance/') return s(200, page0, 'text/html; charset=utf-8');
    if (p === '/vue.js') return s(200, fs.readFileSync(vueJs), 'text/javascript');
    if (p === '/chart.js') return s(200, fs.readFileSync(chartJs), 'text/javascript');
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fixture()));
    if (p === '/ia') return s(200, JSON.stringify({ html: JSON.stringify(reponseIA) }));
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
const erreurs = [];
const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } });
await page.clock.setFixedTime(new Date(2026, 9, 19, 9, 30, 0));
page.on('pageerror', e => erreurs.push(String(e)));
page.on('dialog', d => d.accept());
await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
await page.waitForTimeout(800);
await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'saisie'; }, ST);
await page.waitForTimeout(400);

const attendre = (ms = 250) => page.waitForTimeout(ms);
const cat = (lib, m = 100) => page.evaluate(({ ST, lib, m }) => JSON.parse(JSON.stringify(eval(ST).categoriserLibelle(lib, m))), { ST, lib, m });
const variantes = () => page.evaluate((ST) => JSON.parse(JSON.stringify((eval(ST).parametres.apprentissage || {}).variantes || {})), ST);
const tx = (id) => page.evaluate(({ ST, id }) => { const t = (eval(ST).donneesAnnuelles[2026].transactionsReelles || []).find(x => x.id === id); return t ? JSON.parse(JSON.stringify(t)) : null; }, { ST, id });
const T = (id, libelle, montant, categorieId, categorieSource, extra = {}) => ({ id, datetime: '2026-10-18T12:00', date: '2026-10-18', mois: 10, libelle, montant, categorieId, categorieSource, compteId: CC, source: 'manuel', ...extra });
const poser = (liste) => page.evaluate(async ({ ST, liste }) => { const st = eval(ST); st.donneesAnnuelles[2026].transactionsReelles = liste; st.donneesAnnuelles[2026].banqueOperations = {};
    st.calculationTick++; st.journal.periode = 'tout'; st.journal.vue = 'date'; st.activeTab = 'saisie'; await new Promise(r => setTimeout(r, 400)); }, { ST, liste });
const enregistrer = async (id, catId) => {
    await page.click(`[data-journal-ligne][data-tx="${id}"] [data-journal-ouvrir]`); await attendre();
    if (catId) await page.selectOption('[data-journal-edit-cat]', catId);
    await page.click('[data-journal-enregistrer]'); await attendre(350);
};

try {
    const SM = (await cat('super marché')).id, SMK = (await cat('super marché karim')).id, CAFE = (await cat('cafe resto wknd')).id, TEL = (await cat('tel')).id;
    await section('B', async () => {
        v('B. le décor : « Super marché » et « Super marché Karim » sont deux lignes distinctes', !!SM && !!SMK && SM !== SMK && /super_marche$/.test(SM), JSON.stringify([SM, SMK]));
        const r = await Promise.all(['carrefour', 'PAIEMENT CB 17 10 26 Carrefour (...', 'Carrefour Market', 'kazyon', 'bim', 'hanouti'].map(l => cat(l)));
        v('  → « carrefour » (et la ligne bancaire, Carrefour Market, Kazyon, BIM, Hanouti) → « Super marché », SÛR, sans IA',
          r.every(x => x.id === SM && x.statut === 'sur' && x.source === 'règle'), JSON.stringify(r.map(x => [x.id, x.statut, x.score])));
        const o = await Promise.all(['orange maroc', 'jumia food', 'PAIEMENT CB 18 10 26 KFC MARRAKECH'].map(l => cat(l)));
        v('  → enseignes ajoutées : Orange Maroc → tel, Jumia Food et KFC → cafe Resto Wknd',
          o[0].id === TEL && o[0].statut === 'sur' && o[1].id === CAFE && o[1].statut === 'sur' && o[2].id === CAFE, JSON.stringify(o.map(x => [x.id, x.statut, x.score])));
    });

    await section('C', async () => {
        await poser([T(9101, 'ZITOUNA SHOP 2', 80, 'cat_misc', 'défaut', { aVerifier: true })]);
        const avant = await cat('ZITOUNA GUELIZ 45');
        await enregistrer(9101, SM);
        const vv = await variantes(), apres = await cat('ZITOUNA GUELIZ 45');
        v('C. « ZITOUNA SHOP 2 » corrigée en Super marché : la variante « zitouna » entre au dictionnaire (votre correction)',
          avant.statut === 'inconnu' && vv.zitouna && vv.zitouna.c === SM && vv.zitouna.src === 'vous' && /ZITOUNA SHOP 2/.test(vv.zitouna.ex), JSON.stringify([avant.statut, vv]));
        v('  → « ZITOUNA GUELIZ 45 », jamais vue : rangée Super marché, sûr, « votre correction » (pas d\'IA)',
          apres.id === SM && apres.statut === 'sur' && apres.source === 'vous' && /votre correction/.test(apres.raison), JSON.stringify(apres));
        await poser([]);
        const sans = await cat('zitouna');
        v('  → l\'opération d\'origine supprimée : la variante reste (le dictionnaire la garde)', sans.id === SM && sans.statut === 'sur', JSON.stringify(sans));
        await page.evaluate(async (ST) => { document.querySelectorAll('details[data-apprentissage]').forEach(d => { d.open = true; }); await new Promise(r => setTimeout(r, 200)); }, ST);
        const ligne = await page.textContent('[data-apprentissage-variante][data-mot="zitouna"]');
        v('  → visible dans « Ce que l\'appli a appris » : « zitouna » → Super marché · votre correction', /« zitouna » → Super marché/.test(ligne) && /votre correction/.test(ligne), ligne);
        await page.click('[data-apprentissage-variante][data-mot="zitouna"] [data-apprentissage-oublier-variante]'); await attendre();
        const oublie = await cat('zitouna'), vv2 = await variantes();
        v('  → 🗑 l\'oublie : plus de variante, plus de rangement', !vv2.zitouna && oublie.statut === 'inconnu', JSON.stringify([oublie, vv2]));
    });

    await section('D', async () => {
        await poser([T(9201, 'NOURDIS 7 GUELIZ', 50, SM, 'ia', { aVerifier: true, source: 'banque', iaConfiance: 'moyenne' })]);
        await enregistrer(9201, null);
        const t = await tx(9201), vv = await variantes(), r = await cat('NOURDIS ANNAKHIL');
        v('D. une opération en suspens (import, IA pas sûre) enregistrée sans changer sa catégorie : validée',
          t && !t.aVerifier && t.categorieSource === 'vous' && t.categorieId === SM && !t.iaConfiance, JSON.stringify(t));
        v('  → et apprise : « nourdis » → Super marché ; « NOURDIS ANNAKHIL » rangé sûr', vv.nourdis && vv.nourdis.c === SM && vv.nourdis.src === 'vous' && r.id === SM && r.statut === 'sur', JSON.stringify([vv.nourdis, r]));
        await poser([T(9202, 'LIBELLE NEUF', 50, 'cat_misc', 'défaut', { aVerifier: true })]);
        await enregistrer(9202, null);
        const t2 = await tx(9202);
        v('  → un libellé inconnu rangé PAR DÉFAUT, enregistré tel quel : il reste à vérifier, rien d\'appris',
          t2.categorieSource === 'défaut' && t2.aVerifier === true && !(await variantes()).libelle, JSON.stringify(t2));

        //  Depuis « À catégoriser » : ranger d'un clic apprend aussi
        await poser([T(9203, 'MOUHIB DISTRIB 12', 70, 'cat_misc', 'défaut', { aVerifier: true })]);
        await page.evaluate(({ ST, SM }) => eval(ST).rangerTransaction(9203, SM), { ST, SM });
        const vm = await variantes();
        v('  → rangée d\'un clic dans « À catégoriser » : « mouhib » appris aussi', vm.mouhib && vm.mouhib.c === SM && vm.mouhib.src === 'vous', JSON.stringify(vm.mouhib));
    });

    await section('E', async () => {
        await page.evaluate(({ ST, port }) => { eval(ST).cfoWebhookUrl = `http://127.0.0.1:${port}/ia`; }, { ST, port });
        reponseIA = { id: TEL, confiance: 'haute', raison: 'opérateur télécom' };
        await poser([T(9301, 'WANA RECH 50', 50, 'cat_misc', 'défaut', { aVerifier: true })]);
        await page.evaluate(async (ST) => { await eval(ST).demanderCategorieIA(9301); }, ST);
        let vv = await variantes(), r = await cat('WANA CORPORATE');
        v('E. réponse SÛRE de l\'IA : « wana » entre au dictionnaire (IA) — la prochaine fois, sans l\'IA',
          vv.wana && vv.wana.c === TEL && vv.wana.src === 'ia' && r.id === TEL && r.statut === 'sur' && r.score === 84, JSON.stringify([vv.wana, r]));
        reponseIA = { id: CAFE, confiance: 'moyenne' };
        await poser([T(9302, 'DAKAR SNACK', 50, 'cat_misc', 'défaut', { aVerifier: true })]);
        await page.evaluate(async (ST) => { await eval(ST).demanderCategorieIA(9302); }, ST);
        vv = await variantes();
        v('  → une réponse MOYENNE de l\'IA n\'apprend rien (elle reste à vérifier)', !vv.dakar && (await tx(9302)).aVerifier === true, JSON.stringify(vv));
        await poser([T(9303, 'WANA RECH 50', 50, TEL, 'ia')]);
        await enregistrer(9303, CAFE);
        const ia = await page.evaluate(({ ST, TEL }) => eval(ST).retenirVariante('wana x', TEL, 'ia'), { ST, TEL });
        vv = await variantes();
        v('  → vous corrigez : votre choix remplace celui de l\'IA, et l\'IA ne peut plus l\'écraser',
          vv.wana.c === CAFE && vv.wana.src === 'vous' && ia === null, JSON.stringify([vv.wana, ia]));
    });

    await section('F', async () => {
        await poser([T(9401, 'carrefour', 200, SM, 'règle', { aVerifier: true })]);
        await enregistrer(9401, SMK);
        const r = await cat('PAIEMENT CB 18 10 26 CARREFOUR EXPRESS');
        v('F. vous rangez « carrefour » dans « Super marché Karim » : votre choix l\'emporte sur le dictionnaire, SÛR (pas de doute)',
          r.id === SMK && r.statut === 'sur' && r.source === 'vous', JSON.stringify(r));
    });

    await section('G', async () => {
        await page.evaluate(async (ST) => { const st = eval(ST); st.activeTab = 'pilotage'; await new Promise(r => setTimeout(r, 600)); }, ST);
        const b = await page.$('[data-ouvrir-frise-entete]');
        v('G. Pilotage : « 📈 Cycle et semaines » visible dans l\'en-tête', !!b && await b.isVisible());
        await b.click(); await attendre(400);
        v('  → il ouvre la frise du cycle', await page.evaluate(() => !!document.querySelector('[data-frise]')));
        await page.click('[data-frise-fermer]'); await attendre();
        const m = await page.$('[data-meteo] [data-ouvrir-frise]');
        v('  → et dans la Météo, un vrai bouton « 📈 Voir le cycle et ses semaines »', !!m && await m.isVisible() && /Voir le cycle et ses semaines/.test(await m.textContent()));
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
