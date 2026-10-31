/**
 * v37.85 — L'ÉPARGNE S'ADAPTE AU POTENTIEL DE CHAQUE MOIS, SUR LA LIGNE EXISTANTE.
 *
 *   « Pourquoi je ne vois pas le négatif du Studio sur les premiers mois ? » Décor fictif (KARIM TESTEUR) : un « Studio »
 *   à 8 000 DH par mois sur le Courant, règle d'exception de M1 à M6 à − 1 615 (il COÛTE ces mois-là), 2027.
 *     A. statique · B. le Relevé de comptes · C. le Surplus détaillé et la Respiration · D. les mois à 8 000 : inchangés.
 */
import fs from 'node:fs';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8').split('\r\n').join('\n');

let ko = 0;
const v = (t, ok, d = '') => { if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(64)} ${ok ? '' : d}`); };
const section = async (nom, f) => { try { await f(); } catch (e) { v(`${nom} : exécution sans exception`, false, String(e && e.stack || e).slice(0, 300)); } };
console.log('\n  L’ÉPARGNE S’ADAPTE AU POTENTIEL\n  ' + '─'.repeat(80));

const php = fs.readFileSync(path.join(RACINE, 'cfo_intent_engine.php'), 'utf8');
v('A. appli : bouton « Adapter au potentiel » ; CFO : exceptions sur update_recurring_savings, refus du doublon',
  /data-adapter-potentiel/.test(html) && /const adapterEpargneAuPotentiel = /.test(html) && /potentiel_epargne/.test(html)
  && /'exceptions' => \['type'=>'raw'/.test(php) && /doublerait la ligne existante/.test(php));
{   //  v37.86 : « Expected object, received number » — months = [1, 2, …] doit être une liste de NOMBRES dans le schéma de l'outil
    const wf = JSON.parse(fs.readFileSync(path.join(RACINE, 'super_agent_cfo_audio.json'), 'utf8'));
    let sch = wf.nodes.find(n => n.name === 'Tool: Intent Compiler').parameters.inputSchema; if (typeof sch === 'string') sch = JSON.parse(sch);
    const pr = sch.properties.calls.items.properties.args.properties;
    v('A2. schéma du CFO : months et years = listes de nombres (pas d\u2019objets), exceptions = liste d\u2019objets',
      pr.months.items.type === 'integer' && pr.years.items.type === 'integer' && pr.exceptions.items.type === 'object', JSON.stringify([pr.months.items, pr.exceptions.items]));
}
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
    fx.comptes = [{ id: 'acc_cc', label: 'Compte Courant', type: 'liquide', solde: 20000, icone: '💳' }, { id: 'acc_ur', label: 'Compte urgence', type: 'epargne', solde: 0, icone: '🛟' }];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    for (const an of ['2026', '2027']) {
        const d = fx.donneesAnnuelles[an];
        const Rv = (label, b, j, exc) => ({ ...neutre, label, base: b, jourPrevu: j, destinationCompte: 'courant', exceptions: exc || [] });
        d.revenus = { salaire: Rv('SALAIRE', 20000, 27), bonif: Rv('—', 0, 1), magasin: Rv('—', 0, 1), cnss: Rv('—', 0, 1), appart: Rv('—', 0, 1),
                      studio: Rv('Studio', 8000, 5, an === '2027' ? [{ id: 1, moisDebut: 1, moisFin: 6, nouvelleValeur: -1615 }] : []) };
        const Fx = (label, valeur) => ({ ...neutre, label, valeur, jourPrevu: null });
        d.chargesFixes = { creditImmo: Fx('—', 0), creditStudio: Fx('—', 0), syndic: Fx('—', 0), nounou: Fx('—', 0), ecole: Fx('—', 0), femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
        d.chargesVariables = {}; d.epargne = an === '2027' ? [{ id: 'ep_urg', nom: 'Urgence', label: 'Urgence', valeur: 20000, base: 20000, jourPrevu: null, exceptions: [], showExceptions: false, paye: false, montantPaye: 0, linkedAccountId: 'acc_ur', sourceCompte: 'courant' }] : []; d.depensesIrregulieres = []; d.virementsInternes = []; d.consoRealiseeT0 = {}; d.consoClotureT0 = {}; d.banqueOperations = {}; d.transactionsReelles = [];
    }
    return fx;
};
//  B. le moteur du CFO (PHP) : exceptions sur la ligne existante, doublon refusé
const jsonFx = JSON.stringify(fixture());
const phpFx = path.join(RACINE, 'test_cfo_engine_parity', '.tmp_fx85.json');
fs.writeFileSync(phpFx, jsonFx);
const essaiPhp = (code) => { try { return JSON.parse(execFileSync('php', ['-r', code], { encoding: 'utf8' })); } catch (e) { return { erreur: String(e).slice(0, 200) }; } };
const moteur = path.join(RACINE, 'cfo_intent_engine.php');
const R1 = essaiPhp(`require '${moteur}'; $fd = json_decode(file_get_contents('${phpFx}')); $op = json_decode('{"type":"update_epargne","key":"Urgence","annee":2027,"exceptions":[{"moisDebut":1,"moisFin":6,"nouvelleValeur":18380},{"moisDebut":7,"moisFin":12,"nouvelleValeur":20000}]}'); $l = cfo_apply_op($fd, $op, 2027); $e = $fd->donneesAnnuelles->{'2027'}->epargne; echo json_encode(['st'=>$l['status'] ?? null, 'n'=>count($e), 'exc'=>array_map(fn($x)=>[$x->moisDebut,$x->moisFin,$x->nouvelleValeur], $e[0]->exceptions)]);`);
v('B. CFO : update_recurring_savings remplace les exceptions de la ligne EXISTANTE (aucune seconde ligne)',
  R1.st !== 'error' && R1.n === 1 && JSON.stringify(R1.exc) === '[[1,6,18380],[7,12,20000]]', JSON.stringify(R1));
const R2 = essaiPhp(`require '${moteur}'; $fd = json_decode(file_get_contents('${phpFx}')); $op = json_decode('{"type":"update_epargne","key":"Urgence","annee":2027,"exceptions":[{"moisDebut":0,"moisFin":13,"nouvelleValeur":5}]}'); $l = cfo_apply_op($fd, $op, 2027); echo json_encode(['st'=>$l['status'] ?? null, 'n'=>count($fd->donneesAnnuelles->{'2027'}->epargne[0]->exceptions)]);`);
v('  → des mois hors 1-12 sont refusés, la ligne reste intacte', R2.st === 'error' && R2.n === 0, JSON.stringify(R2));
const R3 = essaiPhp(`require '${moteur}'; $fd = json_decode(file_get_contents('${phpFx}')); $op = json_decode('{"type":"add_epargne","label":"Epargne urgence","valeur":0,"annee":2027,"destinationCompte":"acc_ur","linkedAccountId":"acc_ur"}'); $l = cfo_apply_op($fd, $op, 2027); echo json_encode(['st'=>$l['status'] ?? null, 'r'=>$l['reason'] ?? '', 'n'=>count($fd->donneesAnnuelles->{'2027'}->epargne)]);`);
v('C. CFO : « Epargne urgence » vers le même compte que « Urgence » est refusée (elle se sommerait)',
  R3.st === 'error' && /doublerait/.test(R3.r || '') && R3.n === 1, JSON.stringify(R3));
fs.rmSync(phpFx, { force: true });



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

try {
    await section('D', async () => {
        const P = await page.evaluate(async (ST) => { const st = eval(ST); st.anneeAffichage = 2027; await new Promise(r => setTimeout(r, 300));
            return JSON.parse(JSON.stringify(st.potentielEpargneAn(2027).map(x => [x.mois, x.potentiel_avant_epargne, x.epargne_programmee]))); }, ST);
        v('D. potentiel 2027 : 18 385 de janvier à juin (Studio à −1 615), 28 000 ensuite ; épargne programmée 20 000',
          P.length === 12 && P.slice(0, 6).every(x => x[1] === 18385) && P.slice(6).every(x => x[1] === 28000) && P.every(x => x[2] === 20000), JSON.stringify(P));
    });
    await section('E', async () => {
        const R = await page.evaluate(async (ST) => { const st = eval(ST); st.anneeAffichage = 2027; await new Promise(r => setTimeout(r, 200));
            const ep = st.donneesAnnuelles[2027].epargne[0];
            st.adapterEpargneAuPotentiel(ep, 2027, 20000); await new Promise(r => setTimeout(r, 200));
            const apres = JSON.parse(JSON.stringify(ep.exceptions.map(e => [e.moisDebut, e.moisFin, e.nouvelleValeur])));
            const net = JSON.parse(JSON.stringify(st.potentielEpargneAn(2027).map(x => x.net_apres_epargne)));
            const flag = !!ep.adapteePotentiel;
            st.retirerAdaptationEpargne(ep); await new Promise(r => setTimeout(r, 200));
            return { apres, net, flag, retire: ep.exceptions.length, flagApres: !!ep.adapteePotentiel }; }, ST);
        v('E. « Adapter au potentiel » (plafond 20 000) : 18 380 de janvier à juin, 20 000 de juillet à décembre, en 2 périodes',
          JSON.stringify(R.apres) === '[[1,6,18380],[7,12,20000]]' && R.flag, JSON.stringify(R));
        v('  → plus aucun mois négatif après adaptation (net ≥ 0)', R.net.every(n => n >= 0), JSON.stringify(R.net));
        v('  → « Retirer l\u2019adaptation » rend la ligne telle qu\u2019avant', R.retire === 0 && !R.flagApres, JSON.stringify(R));
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
