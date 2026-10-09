/**
 * v37.37 — LE VIREMENT QUI FINANCE LES CHARGES FIXES SORT DU SURPLUS DU COURANT.
 *
 *   « Pourquoi + 22 966 DH en novembre ? Le transfert entre comptes n'est pas une
 *   épargne : je l'utilise pour les charges fixes. » Le surplus (périmètre Compte
 *   Courant) retirait les charges payées par Assafa, mais ignorait le virement de
 *   15 000 qui les finance : ces 15 000 disparaissaient. Un virement qui quitte le
 *   Courant est désormais une sortie du brut ; un virement qui y arrive, une entrée.
 *
 *   Tous les montants attendus sont calculés À LA MAIN depuis le décor ci-dessous.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8').split('\r\n').join('\n');

let ko = 0;
const v = (t, ok, d = '') => { if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(64)} ${ok ? '' : d}`); };
console.log('\n  LE VIREMENT QUI FINANCE LES CHARGES FIXES SORT DU SURPLUS DU COURANT\n  ' + '─'.repeat(80));

v('le surplus (périmètre Courant) lit les virements internes', /if \(_courantOnly\) getVirementsCycle\(mNum, annee\)\.forEach\(vir =>/.test(html));

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
const twBin = path.join(RACINE, 'node_modules/.bin/tailwindcss');
const twCss = essai(() => {
    if (!fs.existsSync(twBin)) return null;
    const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'twsurplus-'));
    fs.writeFileSync(path.join(tmp, 'in.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
    fs.writeFileSync(path.join(tmp, 'cfg.js'), 'module.exports={content:[' + JSON.stringify(path.join(RACINE, 'index.html')) + '],theme:{extend:{}}};');
    execFileSync(twBin, ['-c', path.join(tmp, 'cfg.js'), '-i', path.join(tmp, 'in.css'), '-o', path.join(tmp, 'out.css'), '--minify'], { stdio: 'ignore' });
    const css = fs.readFileSync(path.join(tmp, 'out.css'), 'utf8');
    return css.length > 10000 ? css : null;
});

/* ── B. Le décor : vendredi 9 oct. 2026, paie le 27 → mois en cours = octobre.
     Courant 5 000 · Salaire 20 000 et Magasin 7 000 → Courant · Factures 1 000 / mois (Courant)
     Assafa paie les charges fixes (Crédit 8 340, École 2 100) ; le Courant l'alimente :
     virement Courant → Assafa 15 000 en octobre, novembre et décembre.
     Épargne depuis le Courant : 3 000 vers Dépenses annuels, 2 000 vers une poche « Urgence ».
     Décembre : Assafa → Courant 500 (entrée). Novembre : Dépenses annuels → Assafa 1 000 (hors Courant).
       novembre : brut 27 000 − 1 000 − 15 000 = 11 000 · épargne 5 000 · net 6 000
       décembre : brut 27 000 + 500 − 1 000 − 15 000 = 11 500 · épargne 5 000 · net 6 500
       (sans la correction : novembre 26 000 / 21 000, décembre 26 000 / 21 000)
     Octobre, revenus déjà encaissés : brut 5 000 − 1 000 − 15 000 = − 11 000 · net − 16 000. */
const JDP = 27;
const SC = { maintenant: new Date(2026, 9, 9, 10, 0, 0), mois: 10, an: 2026 };
const fixture = (sc) => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = {};
    for (const an of [sc.an - 1, sc.an, sc.an + 1]) fx.donneesAnnuelles[an] = JSON.parse(JSON.stringify(base));
    Object.assign(fx.soldesInitiaux, { moisActuel: sc.mois, anneeActuelle: sc.an, jourDePaie: JDP,
        compteChargesFixes: 'cpt_2', compteChargesVariables: 'courant', assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.comptes = [
        { id: 1, label: 'Compte Courant', type: 'courant', solde: 5000, icone: '💳' },
        { id: 2, label: 'Compte Principale ASSAFA', type: 'epargne', solde: 1000, icone: '🏛️' },
        { id: 3, label: 'Dépenses annuels', type: 'epargne', solde: 10000, icone: '📅' },
    ];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    for (const an of Object.keys(fx.donneesAnnuelles)) {
        const d = fx.donneesAnnuelles[an];
        const Rv = (label, b, j) => ({ ...neutre, label, base: b, jourPrevu: j, destinationCompte: 'courant' });
        d.revenus = { salaire: Rv('Salaire', 20000, 27), bonif: Rv('—', 0), magasin: Rv('Magasin', 7000, 4), cnss: Rv('—', 0), appart: Rv('—', 0), studio: Rv('—', 0) };
        const Fx = (label, valeur, j) => ({ ...neutre, label, valeur, jourPrevu: j });
        d.chargesFixes = { creditImmo: Fx('Crédit', 8340, 28), ecole: Fx('École', 2100, 8), creditStudio: Fx('—', 0), syndic: Fx('—', 0), nounou: Fx('—', 0),
                           femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
        const V = (label, valeur, periode) => ({ ...neutre, label, valeur, periode, details: [], showDetails: false });
        d.chargesVariables = { alimentation: V('COURSES', 0, 'semaine'), sorties: V('SORTIES', 0, 'semaine'), voiture: V('—', 0, 'semaine'), sante: V('—', 0, 'semaine'),
                               factures: { ...V('FACTURES', 1000, 'mois'), categorieId: 'cat_cv_factures', jourPrevu: 6 } };
        d.epargne = [
            { id: 21, nom: 'Alimentation dépenses annuels', valeur: 3000, sourceCompte: 'courant', linkedAccountId: 3, jourPrevu: 1 },
            { id: 22, nom: 'Épargne urgence', valeur: 2000, sourceCompte: 'courant', jourPrevu: 1 },
        ];
        const ici = Number(an) === sc.an;
        d.virementsInternes = !ici ? [] : [
            { id: 31, mois: 10, sourceCompte: 'courant', destinationCompte: 'cpt_2', montant: 15000 },
            { id: 32, mois: 11, sourceCompte: 'courant', destinationCompte: 'cpt_2', montant: 15000 },
            { id: 33, mois: 12, sourceCompte: 'courant', destinationCompte: 'cpt_2', montant: 15000 },
            { id: 34, mois: 12, sourceCompte: 'cpt_2', destinationCompte: 'courant', montant: 500 },
            { id: 35, mois: 11, sourceCompte: 'cpt_3', destinationCompte: 'cpt_2', montant: 1000 },
        ];
        d.depensesIrregulieres = []; d.transactionsReelles = []; d.consoRealiseeT0 = {};
    }
    return fx;
};
let fxCourant = null;
const page0 = html
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, twCss ? '<link rel="stylesheet" href="/tailwind.css">' : '')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');
const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const s = (c, b, t = 'application/json') => { res.writeHead(c, { 'Content-Type': t }); res.end(b); };
    if (p === '/finance/') return s(200, page0, 'text/html; charset=utf-8');
    if (p === '/vue.js') return s(200, fs.readFileSync(vueJs), 'text/javascript');
    if (p === '/chart.js') return s(200, fs.readFileSync(chartJs), 'text/javascript');
    if (p === '/tailwind.css') return s(200, twCss || '', 'text/css');
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fxCourant));
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
const pret = (page) => page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
const auPilotage = async (page) => { await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'pilotage'; }, ST); await page.waitForTimeout(500); };
const ouvrir = async (sc, opts = { viewport: { width: 1400, height: 1100 } }) => {
    fxCourant = fixture(sc);
    const page = await browser.newPage(opts);
    await page.clock.setFixedTime(sc.maintenant);
    const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
    page.on('dialog', d => d.accept());
    await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
    await pret(page); await page.waitForTimeout(600);
    await auPilotage(page);
    return { page, erreurs };
};
const nf = (n) => new Intl.NumberFormat('fr-FR').format(n).replace(/\s/g, '');
const sansEsp = (t) => String(t || '').replace(/\s/g, '');
const attendre = (page, ms = 300) => page.waitForTimeout(ms);


const lire = (page) => page.evaluate((ST) => {
    const st = eval(ST);
    return {
        sp: Object.fromEntries(st.surplusParMois.filter(r => !r.isPast).map(r => [r.mNum, { brut: Math.round(r.brut), ep: r.epargne, net: Math.round(r.net) }])),
        moyen: Math.round(st.surplusMensuelBase), stats: { e: Math.round(st.statsFluxAnnee.totalEntrees), s: Math.round(st.statsFluxAnnee.totalSorties) },
        cfo: st.surplusParMois.filter(r => !r.isPast).map(r => Math.round(r.net)),
    };
}, ST);
//  Le Relevé du Courant, cycle par cycle : ce qui entre moins ce qui sort
const releveCourant = (page) => page.evaluate(async (ST) => {
    const st = eval(ST);
    st.moisSelectionnes.splice(0, st.moisSelectionnes.length, 10, 11, 12);
    st.anneesSelectionnees.splice(0, st.anneesSelectionnees.length, 2026);
    st.releveComptesFiltres.splice(0);
    await new Promise(r => setTimeout(r, 80));
    const par = {};
    (st.journalHybridePourReleve.entries || []).filter(e => e.compteKey === 'cpt_1' && (e.type === 'credit' || e.type === 'debit')).forEach(e => {
        const m = Number(String(e.cycle).split('-')[0]); par[m] = (par[m] || 0) + (e.type === 'credit' ? 1 : -1) * Math.round(e.montant); });
    st.moisSelectionnes.splice(0); st.anneesSelectionnees.splice(0);
    return par;
}, ST);

try {
    const { page, erreurs } = await ouvrir(SC);
    //  Octobre : les revenus du cycle sont déjà encaissés (pointés)
    await page.evaluate(async (ST) => { const st = eval(ST); const r = st.donneesAnnuelles[2026].revenus;
        [r.salaire, r.magasin].forEach(x => st.toggleItemPaid(x, x.base, st.cyclePilotage)); st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 300)); }, ST);
    let m = await lire(page);
    v('C. novembre : brut 11 000 (27 000 − 1 000 − 15 000 vers Assafa), épargne 5 000, net 6 000 — plus 26 000 / 21 000',
      m.sp[11] && m.sp[11].brut === 11000 && m.sp[11].ep === 5000 && m.sp[11].net === 6000, JSON.stringify(m.sp[11]));
    v('  → décembre : + 500 venus d\'Assafa → brut 11 500, net 6 500', m.sp[12] && m.sp[12].brut === 11500 && m.sp[12].net === 6500, JSON.stringify(m.sp[12]));
    v('  → le virement n\'est PAS de l\'épargne : la colonne reste 5 000 (3 000 + 2 000)', m.sp[11].ep === 5000 && m.sp[12].ep === 5000, JSON.stringify([m.sp[11].ep, m.sp[12].ep]));
    v('  → « Surplus » et « Reste à vivre moyen » : (6 000 + 6 500) / 2 = 6 250', m.moyen === 6250, String(m.moyen));
    const rc = await releveCourant(page);
    v('  → le net de la modale = le mouvement du Courant au Relevé, mois par mois (novembre 6 000, décembre 6 500)',
      rc[11] === m.sp[11].net && rc[12] === m.sp[12].net, JSON.stringify([rc, m.sp[11].net, m.sp[12].net]));
    v('D. octobre (revenus encaissés) : brut 5 000 − 1 000 − 15 000 = − 11 000, net − 16 000', m.sp[10] && m.sp[10].brut === -11000 && m.sp[10].net === -16000, JSON.stringify(m.sp[10]));
    await page.evaluate(async (ST) => { const st = eval(ST); const vir = st.donneesAnnuelles[2026].virementsInternes.find(x => x.id === 31);
        st.toggleItemPaid(vir, 15000, st.cyclePilotage); st.comptes.find(c => c.id === 1).solde = 5000 - 15000; st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 300)); }, ST);
    m = await lire(page);
    v('  → le virement d\'octobre fait et pointé (Courant − 10 000) : brut − 11 000, net − 16 000 — il ne sort qu\'une fois',
      m.sp[10].brut === -11000 && m.sp[10].net === -16000, JSON.stringify(m.sp[10]));
    //  Tous comptes confondus, un virement interne s'annule
    const sans = await page.evaluate(async (ST) => { const st = eval(ST); const d = st.donneesAnnuelles[2026]; const garde = d.virementsInternes; d.virementsInternes = [];
        st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 300));
        const s = { e: Math.round(st.statsFluxAnnee.totalEntrees), s: Math.round(st.statsFluxAnnee.totalSorties) };
        d.virementsInternes = garde; st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 300)); return s; }, ST);
    m = await lire(page);
    v('E. KPI annuels Entrées / Sorties (tous comptes) : les virements s\'y annulent, rien ne change',
      m.stats.e === sans.e && m.stats.s === sans.s, JSON.stringify([m.stats, sans]));
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
    await page.close();
} catch (err) {
    v('exécution sans exception', false, String(err && err.stack || err).slice(0, 400));
} finally {
    await browser.close(); srv.close();
}
console.log('  ' + '─'.repeat(80));
console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
