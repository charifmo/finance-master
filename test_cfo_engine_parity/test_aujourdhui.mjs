/**
 * v37.98 — L'ÉCRAN « AUJOURD'HUI » · MODE EXPERT · RÉPONSES INSTANTANÉES DU CFO.
 *   Décor fictif (KARIM TESTEUR), cycle de novembre 2026 : salaire 20 000 sur un Compte Salaire, loyer 5 000 sur le
 *   Courant, crédit 12 000 du Courant, 9 100 du salaire vers le Courant le 28, une dépense exceptionnelle « Vidange »
 *   de 1 500 en décembre. Variante « doublon » : le virement de 10 000 vers l'épargne posé deux fois en décembre.
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
console.log('\n  AUJOURD’HUI · MODE EXPERT · RÉPONSES INSTANTANÉES\n  ' + '─'.repeat(80));
v('A. écran Aujourd’hui (3 chiffres + 1 action), Mode expert, retour ☀️, réponses instantanées branchées avant l’envoi au CFO',
  /data-aujourdhui/.test(html) && /data-auj-reste/.test(html) && /data-auj-point-bas/.test(html) && /data-auj-epargne/.test(html) && /data-auj-action/.test(html)
  && /data-mode-expert/.test(html) && /data-vers-aujourdhui/.test(html) && /_inst = reponseInstantanee\(q\)/.test(html));

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
let MODE = null, DOUBLON = false;
const fixture = () => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    fx._schemaVersion = 24;
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = { 2026: JSON.parse(JSON.stringify(base)) };
    Object.assign(fx.soldesInitiaux, { moisActuel: 11, anneeActuelle: 2026, jourDePaie: 27, compteChargesFixes: 'courant', compteChargesVariables: 'courant', assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    if (MODE) fx.soldesInitiaux.modeAffichage = MODE; else delete fx.soldesInitiaux.modeAffichage;
    fx.soldesInitiaux.categories = [];
    fx.comptes = [{ id: 'acc_cc', label: 'Compte Courant', type: 'liquide', solde: 250000, icone: '💳' }, { id: 'acc_sal', label: 'Compte Salaire', type: 'liquide', solde: 30000, icone: '🏦' },
                  { id: 'acc_ep', label: 'Compte Épargne', type: 'epargne', solde: 0, icone: '🛟' }];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    const d = fx.donneesAnnuelles[2026];
    const Rv = (label, b, j, dest) => ({ ...neutre, label, base: b, jourPrevu: j, destinationCompte: dest });
    d.revenus = { salaire: Rv('SALAIRE', 20000, 27, 'cpt_acc_sal'), bonif: Rv('—', 0, 1, 'courant'), magasin: Rv('Loyer', 5000, 10, 'courant'), cnss: Rv('—', 0, 1, 'courant'), appart: Rv('—', 0, 1, 'courant'), studio: Rv('—', 0, 1, 'courant') };
    const Fx = (label, valeur, j) => ({ ...neutre, label, valeur, jourPrevu: j || null });
    d.chargesFixes = { creditImmo: Fx('Crédit', 12000, 15), creditStudio: Fx('—', 0), syndic: Fx('—', 0), nounou: Fx('—', 0), ecole: Fx('—', 0), femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
    d.chargesVariables = {}; d.epargne = []; d.consoRealiseeT0 = {}; d.consoClotureT0 = {}; d.banqueOperations = {}; d.transactionsReelles = [];
    d.depensesIrregulieres = [{ id: 1, mois: 12, annee: 2026, nom: 'Vidange', montant: 1500, paye: false, montantPaye: 0, sourceCompte: 'courant', jourPrevu: 5 }];
    d.virementsInternes = [
        { id: 111, mois: 11, sourceCompte: 'cpt_acc_sal', destinationCompte: 'courant', montant: 9100, jourPrevu: 28 },
        { id: 112, mois: 12, sourceCompte: 'cpt_acc_sal', destinationCompte: 'courant', montant: 9100, jourPrevu: 28 },
        ...(DOUBLON ? [{ id: 300, mois: 12, sourceCompte: 'cpt_acc_sal', destinationCompte: 'cpt_acc_ep', montant: 10000 }, { id: 301, mois: 12, sourceCompte: 'cpt_acc_sal', destinationCompte: 'cpt_acc_ep', montant: 10000 }] : []),
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
let appelsCFO = 0;
const ouvrir = async (ctx) => {
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(2026, 10, 15, 12, 0, 0));
    page.on('pageerror', e => erreurs.push(String(e)));
    await page.route('**/webhook/**', route => { appelsCFO++; route.abort(); });
    await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    return page;
};
const texte = (page, sel) => page.evaluate((sel) => (document.querySelector(sel) || {}).innerText || '', sel);
const chiffre = (t) => Number(String(t).replace(/[^\d-]/g, ''));

try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await section('B', async () => {
        MODE = null;
        const page = await ouvrir(ctx);
        const vis = await page.isVisible('[data-aujourdhui]');
        const R = await texte(page, '[data-auj-reste]'), B = await texte(page, '[data-auj-point-bas]'), E = await texte(page, '[data-auj-epargne]'), A = await texte(page, '[data-auj-action]');
        const C = await page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST).chiffresDuJour)), ST);
        v('B. sans préférence : l’écran « Aujourd’hui » s’ouvre (téléphone)', vis, '');
        v('  → 3 chiffres : reste à dépenser, point bas du courant + date, épargne du mois — ceux du moteur',
          /reste à dépenser/.test(R) && chiffre(R.split('\n').filter(Boolean)[1]) === C.reste && /compte courant/.test(B) && /le \d+ \S+/.test(B) && /Épargne de ce mois/.test(E) && /(le mois permet|ne laisse rien)/.test(E), JSON.stringify([R, B, E, C]));
        v('  → une action : les soldes n’ont jamais été lus → « Importer mes captures »', /Importer mes captures/.test(A) && /jamais été lus/.test(A), A);
        await page.click('[data-auj-faire]'); await page.waitForTimeout(300);
        v('  → le bouton ouvre l’import de captures', await page.evaluate((ST) => eval(ST).importBanque.ouvert, ST), '');
        await page.evaluate((ST) => { eval(ST).importBanque.ouvert = false; }, ST);
        await page.click('[data-mode-expert]'); await page.waitForTimeout(300);
        const pref = await page.evaluate(() => localStorage.getItem('fm_mode_affichage'));
        v('C. « Mode expert » : l’écran simple se retire, la préférence est gardée sur l’appareil', !(await page.isVisible('[data-aujourdhui]')) && pref === 'expert', String(pref));
        await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(2200);
        v('  → rechargé : reste en mode expert', !(await page.isVisible('[data-aujourdhui]')), '');
        await page.click('[data-vers-aujourdhui-mobile]'); await page.waitForTimeout(300);
        v('  → « ☀️ Aujourd’hui » ramène l’écran simple', await page.isVisible('[data-aujourdhui]'), '');
        await page.close();
    });
    await ctx.close();
    await section('D', async () => {
        MODE = 'expert';
        const c2 = await browser.newContext({ viewport: { width: 1280, height: 1000 } }); const page = await ouvrir(c2);
        v('D. préférence « expert » dans les données : pas d’écran simple', !(await page.isVisible('[data-aujourdhui]')), '');
        await page.close(); await c2.close();
    });
    await section('E', async () => {
        MODE = null; DOUBLON = true;
        const c3 = await browser.newContext({ viewport: { width: 1280, height: 1000 } }); const page = await ouvrir(c3);
        const A = await texte(page, '[data-auj-action]');
        v('E. un virement en double : l’action du jour est « Tout recalculer »', /Virement en double/.test(A) && /Tout recalculer pour 2026/.test(A), A);
        await page.click('[data-auj-faire]'); await page.waitForTimeout(900);
        const A2 = await texte(page, '[data-auj-action]');
        const n = await page.evaluate((ST) => eval(ST).donneesAnnuelles[2026].virementsInternes.filter(v => v.montant === 10000).length, ST);
        v('  → recalibré d’un toucher : le double retiré, « recalibrée aujourd’hui », avant / après affiché', n === 1 && /recalibrée aujourd’hui/.test(A2) && /Point bas du Courant/.test(A2), JSON.stringify([n, A2.slice(0, 200)]));
        //  F. le CFO — réponses instantanées
        const demander = (q) => page.evaluate(async ([ST, q]) => { const st = eval(ST); const n0 = st.cfoMessages.length; st.cfoInput = q; st.envoyerCFO(); await new Promise(r => setTimeout(r, 300));
            const nv = st.cfoMessages.slice(n0); return nv.map(m => m.role + ':' + String(m.content)); }, [ST, q]);
        appelsCFO = 0;
        const Q1 = await demander('Je veu savoir comb en total j ai de depenses chaque moi et aussi les irreg');
        const r1 = Q1.join(' ');
        v('F. « combien de dépenses chaque mois et les irrég » : réponse immédiate, sans IA (aucun appel au CFO)',
          Q1.length === 2 && /data-cfo-instantane="depenses irregulieres"/.test(r1) && /sans IA/.test(r1) && appelsCFO === 0, r1.slice(0, 300) + ' appels=' + appelsCFO);
        v('  → les chiffres de l’appli : charges fixes 12 000, « Vidange » 1 500 en décembre, total exceptionnelles 1 500',
          /charges fixes 12[\s  ]?000/.test(r1) && /déc\. — Vidange : 1[\s  ]?500/i.test(r1) && /<b>1[\s  ]?500[\s  ]DH<\/b> sur l’année/.test(r1), r1.slice(300, 1400));
        v('  → « Demander au CFO quand même » proposé', /data-cfo-renvoyer/.test(r1) && /Demander au CFO quand même/.test(r1), '');
        const C = await page.evaluate((ST) => JSON.parse(JSON.stringify({ r: eval(ST).budgetConsoRestantReel })), ST);
        const r2 = (await demander('Combien il me reste à dépenser ?')).join(' ');
        v('  → « combien il me reste à dépenser » : le reste du moteur', /data-cfo-instantane="reste"/.test(r2) && chiffre((r2.match(/paie<\/b> : <b>([^<]+)<\/b>/) || [])[1] || 'x') === Math.round(C.r) && /jour\(s\) avant la paie/.test(r2), r2.slice(250, 900));
        const r3 = (await demander('Quel est le point bas de mon courant ?')).join(' ');
        v('  → « point bas » : montant + date', /data-cfo-instantane="point_bas"/.test(r3) && /Point le plus bas du compte courant/.test(r3), r3.slice(0, 300));
        const r4 = (await demander('Quel est le solde de mon compte salaire ?')).join(' ');
        v('  → « solde du compte salaire » : seulement ce compte', /data-cfo-instantane="soldes"/.test(r4) && /Compte Salaire : <b>30[\s  ]?000/.test(r4) && !/Compte Courant :/.test(r4), r4.slice(0, 300));
        await page.evaluate(([ST, port]) => { eval(ST).cfoWebhookUrl = 'http://127.0.0.1:' + port + '/webhook/cfo'; }, [ST, port]);
        appelsCFO = 0;
        const r5 = await demander('Ajoute 500 DH de courses');
        const r6 = await demander('Pourquoi mon épargne est négative ?');
        await page.waitForTimeout(800);
        v('  → une demande d’action ou un « pourquoi » part au CFO (pas de réponse instantanée)', !r5.join(' ').includes('data-cfo-instantane') && !r6.join(' ').includes('data-cfo-instantane') && appelsCFO >= 2, JSON.stringify([r5.length, r6.length, appelsCFO]));
        await page.close(); await c3.close();
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
