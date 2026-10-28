/**
 * v37.70 — UNE ÉPARGNE VA TOUJOURS SUR UN VRAI COMPTE · ANNULER DIT DEPUIS QUAND IL COMPTE.
 *
 *   « Pourquoi cette duplication de comptes ? Toujours cette confusion entre objectif et compte. » — des
 *   épargnes recréées sans compte de destination devenaient des poches fantômes (« Urgence » à
 *   côté de « Compte urgence »). À chaque chargement, une épargne sans compte est rattachée quand il n'y a
 *   aucun doute ; sinon le sélecteur « Vers : » la signale en rouge et la poche se dit « (sans compte) ».
 *   Décor fictif (KARIM TESTEUR), 12 nov. 2026 :
 *     • 2026 « Epargne urgence » 1 000 depuis Compte Salaire, sans destination → Compte urgence (nom) ;
 *     • 2027 « Long Terme » 500 sans destination, reliée à Épargne Long Terme en 2028 → même épargne ;
 *     • 2027 « Voyage Japon » 300 : aucun compte de ce nom → reste sans compte, signalée ;
 *     • 2027 « Compte Salaire » 200 DEPUIS le Compte Salaire : jamais rattachée à sa propre source.
 *     A. statique · B. rattachement au chargement · C. l'écran (sélecteur, nom des poches, projection) ·
 *     D. Annuler explique sa pile.
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
console.log('\n  UNE ÉPARGNE VA TOUJOURS SUR UN VRAI COMPTE\n  ' + '─'.repeat(80));

/* ── A. Statique ─────────────────────────────────────────────────────── */
v('A. rattachement à chaque chargement ; plus d\'« Enveloppe virtuelle » proposée comme un choix normal',
  /const _rat = rattacherEpargnes\(data\);/.test(html) && !/<option :value="null">🎯 Enveloppe virtuelle<\/option>/.test(html) && (html.match(/<option :value="null">⚠️ Aucun compte — à choisir<\/option>/g) || []).length === 3);

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
    console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
    process.exit(ko === 0 ? 0 : 1);
}

/* ── Le décor ────────────────────────────────────────────────────────── */
const fixture = () => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    fx._schemaVersion = 23;
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = {};
    for (const an of [2026, 2027, 2028]) fx.donneesAnnuelles[an] = JSON.parse(JSON.stringify(base));
    Object.assign(fx.soldesInitiaux, { moisActuel: 11, anneeActuelle: 2026, jourDePaie: 27, compteChargesFixes: 'cpt_900', compteChargesVariables: 'courant', assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.soldesInitiaux.categories = [];
    fx.comptes = [{ id: 'acc_cc', label: 'Compte Courant', type: 'liquide', solde: 5000, icone: '💳' },
                  { id: 900, label: 'Compte Salaire', type: 'liquide', solde: 1000, icone: '🏦' },
                  { id: 901, label: 'Compte urgence', type: 'liquide', solde: 0, icone: '🛟' },
                  { id: 'acc_lt', label: 'Épargne Long Terme', type: 'epargne', solde: 0, icone: '🐷' }];
    const E = (id, nom, valeur, src, lie) => ({ id, nom, label: nom, valeur, sourceCompte: src, linkedAccountId: lie, exceptions: [], showExceptions: false });
    for (const an of Object.keys(fx.donneesAnnuelles)) {
        const d = fx.donneesAnnuelles[an];
        d.epargne = an === '2026' ? [E(11, 'Epargne urgence', 1000, 'cpt_900', null)]
                  : an === '2027' ? [E(21, 'Long Terme', 500, 'cpt_900', null), E(22, 'Voyage Japon', 300, 'cpt_900', null), E(23, 'Compte Salaire', 200, 'cpt_900', null)]
                  : [E(31, 'Long Terme', 500, 'courant', 'acc_lt')];
        d.depensesIrregulieres = []; d.virementsInternes = []; d.consoRealiseeT0 = {}; d.consoClotureT0 = {}; d.banqueOperations = {}; d.transactionsReelles = [];
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

try {
    /* ── B. Rattachement au chargement ─────────────────────────────────── */
    await section('B', async () => {
        const B = await page.evaluate((ST) => { const st = eval(ST), d = st.donneesAnnuelles;
            return JSON.parse(JSON.stringify({ e: [2026, 2027].flatMap(a => d[a].epargne.map(x => [a, x.nom, x.linkedAccountId])), log: st.serverLogs.map(l => l.msg).filter(m => /^🔗/.test(m)) })); }, ST);
        const lie = (a, n) => (B.e.find(x => x[0] === a && x[1] === n) || [])[2];
        v('B. « Epargne urgence » 2026 → Compte urgence (le seul compte dont le nom y figure)', lie(2026, 'Epargne urgence') === 901, JSON.stringify(B.e));
        v('  → « Long Terme » 2027 → Épargne Long Terme (la même épargne en 2028)', lie(2027, 'Long Terme') === 'acc_lt', JSON.stringify(B.e));
        v('  → « Voyage Japon » : aucun compte de ce nom → reste sans compte (pas de devinette)', lie(2027, 'Voyage Japon') === null, JSON.stringify(B.e));
        v('  → « Compte Salaire » depuis le Compte Salaire : jamais rattachée à sa propre source', lie(2027, 'Compte Salaire') === null, JSON.stringify(B.e));
        v('  → le journal le dit (2 rattachements, avec l\'année et le compte)',
          B.log.length === 1 && /^🔗 2 épargne\(s\)/.test(B.log[0]) && B.log[0].includes('Epargne urgence 2026 → Compte urgence') && B.log[0].includes('Long Terme 2027 → Épargne Long Terme'), JSON.stringify(B.log));
        const fn = await page.evaluate((ST) => { const st = eval(ST);
            const d = { comptes: [{ id: 'cc', type: 'liquide', label: 'Compte Courant' }, { id: 1, label: 'Compte urgence' }, { id: 2, label: 'Épargne Urgence' }],
                        donneesAnnuelles: { 2026: { epargne: [{ id: 5, nom: 'Urgence', sourceCompte: 'courant', linkedAccountId: null }] } } };
            const r = st.rattacherEpargnes(d); return [r.length, d.donneesAnnuelles[2026].epargne[0].linkedAccountId]; }, ST);
        v('  → deux comptes possibles (« Compte urgence », « Épargne Urgence ») : rien n\'est rattaché', JSON.stringify(fn) === '[0,null]', JSON.stringify(fn));
    });

    /* ── C. L'écran ───────────────────────────────────────────────────── */
    await section('C', async () => {
        const C = await page.evaluate(async (ST) => { const st = eval(ST);
            st.anneeAffichage = 2027; st.appMode = 'previsionnel'; await new Promise(r => setTimeout(r, 300)); st.activeTab = 'parametres'; await new Promise(r => setTimeout(r, 600));
            const sel = [...document.querySelectorAll('[data-ep-sans-compte]')].filter(e => e.offsetParent !== null);
            return { n: sel.length, opt: sel[0] ? sel[0].options[sel[0].selectedIndex].textContent.trim() : null, rouge: sel[0] ? /rose/.test(sel[0].className) : false,
                     nom: st.getNomCompte('ep_22'), nom2026: (st.anneeAffichage = 2026, st.getNomCompte('ep_22')) }; }, ST);
        v('C. Budget 2027 : les 2 épargnes restées sans compte sont signalées en rouge « ⚠️ Aucun compte — à choisir »',
          C.n === 2 && C.opt === '⚠️ Aucun compte — à choisir' && C.rouge, JSON.stringify(C));
        v('  → une poche restée sans compte se dit « 🎯 Voyage Japon (sans compte) », même vue depuis 2026',
          C.nom === '🎯 Voyage Japon (sans compte)' && C.nom2026 === '🎯 Voyage Japon (sans compte)', JSON.stringify(C));
        const P = await page.evaluate((ST) => { const st = eval(ST); st.anneeAffichage = 2027; return JSON.parse(JSON.stringify({ comptes: st.detailsComptesFinal, poches: st.epargneNonLieeFinal })); }, ST);
        const pochesN = Object.keys(P.poches || {});
        v('  → patrimoine projeté : plus de poche pour les épargnes rattachées (seules Voyage Japon et Compte Salaire en restent)',
          !pochesN.includes('ep_11') && !pochesN.includes('ep_21') && pochesN.every(k => ['ep_22', 'ep_23'].includes(k)), JSON.stringify(P.poches));
    });

    /* ── D. Annuler explique sa pile ──────────────────────────────────── */
    await section('D', async () => {
        const D = await page.evaluate((ST) => { const st = eval(ST); const b = document.querySelector('button[aria-label="Annuler"]'); return { info: st.undoInfo, titre: b ? b.getAttribute('title') : null }; }, ST);
        v('D. Annuler : « … sur 50 — depuis l\'ouverture de l\'appli à 10:00 »', /^depuis l’ouverture de l’appli à \d\d:\d\d$/.test(D.info) && /sur 50 — depuis l’ouverture/.test(D.titre || ''), JSON.stringify(D));
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
