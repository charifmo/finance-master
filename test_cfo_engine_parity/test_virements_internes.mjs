/**
 * v37.35 — LES VIREMENTS INTERNES BOUGENT LES SOLDES · UN MOIS FERMÉ DIT CE QU'IL CONTIENT.
 *
 *   1. « Un virement de 60 000 DH de l'Épargne Long Terme vers les Dépenses
 *      annuelles, en novembre, n'apparaît pas dans le Relevé. » Le moteur du Relevé
 *      ne lisait pas les virements internes. Chacun génère désormais deux jambes :
 *      une sortie sur la source, une entrée sur la destination.
 *   2. « Novembre affiche 7 150 DH ; octobre, qui contient un virement, rien. »
 *      L'en-tête d'un mois dit ses sorties, ses entrées et ses virements.
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
console.log('\n  LES VIREMENTS INTERNES BOUGENT LES SOLDES · LES MOIS DISENT CE QU\'ILS CONTIENNENT\n  ' + '─'.repeat(80));

/* ── A. Statique ─────────────────────────────────────────────────────── */
v('le moteur du Relevé lit les virements du cycle (deux jambes)',
  /getVirementsCycle\(m, a\)\.forEach\(vir =>/.test(html) && /type: 'debit', jourPrevu: _vj/.test(html) && /type: 'credit', jourPrevu: _vj/.test(html));
v('l\'en-tête d\'un mois ne dépend plus d\'un total net positif', !/v-if="totalMoisAffichage\(moisNum\) > 0"/.test(html) && /data-mois-virements/.test(html));

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
    const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'twvirements-'));
    fs.writeFileSync(path.join(tmp, 'in.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
    fs.writeFileSync(path.join(tmp, 'cfg.js'), 'module.exports={content:[' + JSON.stringify(path.join(RACINE, 'index.html')) + '],theme:{extend:{}}};');
    execFileSync(twBin, ['-c', path.join(tmp, 'cfg.js'), '-i', path.join(tmp, 'in.css'), '-o', path.join(tmp, 'out.css'), '--minify'], { stdio: 'ignore' });
    const css = fs.readFileSync(path.join(tmp, 'out.css'), 'utf8');
    return css.length > 10000 ? css : null;
});

/* ── B. Le décor : vendredi 9 oct. 2026, paie le 27 → cycle d'octobre = 27 sep. → 26 oct.
     Courant            10 000 · octobre  : − 1 500 vers Dépenses annuelles      → 8 500
                               · décembre : + 5 000 (prime) − 2 000 (cadeaux) − 1 000 − 500 vers l'Épargne LT
     Épargne Long Terme 100 000 · novembre : − 60 000 vers Dépenses annuelles
                                · décembre : + 1 000 + 500
     Dépenses annuelles  2 000 · octobre  : + 1 500                               → 3 500
                               · novembre : + 60 000, puis − 7 150 (assurance)    → 56 350
   Fin décembre : Courant 10 000 · Épargne LT 41 500 · Dépenses annuelles 56 350.
   Décembre mêle une sortie (2 000) et une entrée (5 000) : son ancien en-tête (total net
   − 3 000, donc négatif) restait muet. */
const JDP = 27;
const SC = { maintenant: new Date(2026, 9, 9, 10, 0, 0), mois: 10, an: 2026 };
const fixture = (sc) => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = {};
    for (const an of [sc.an - 1, sc.an, sc.an + 1]) fx.donneesAnnuelles[an] = JSON.parse(JSON.stringify(base));
    Object.assign(fx.soldesInitiaux, { moisActuel: sc.mois, anneeActuelle: sc.an, jourDePaie: JDP,
        compteChargesFixes: 'courant', compteChargesVariables: 'courant', assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.comptes = [
        { id: 1, label: 'Compte Courant', type: 'courant', solde: 10000, icone: '💳' },
        { id: 2, label: 'Épargne Long Terme', type: 'epargne', solde: 100000, icone: '🏦' },
        { id: 3, label: 'Dépenses annuelles', type: 'epargne', solde: 2000, icone: '📅' },
    ];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    for (const an of Object.keys(fx.donneesAnnuelles)) {
        const d = fx.donneesAnnuelles[an];
        const Rv = (label) => ({ ...neutre, label, base: 0, jourPrevu: JDP, destinationCompte: 'courant' });
        d.revenus = { salaire: Rv('SALAIRE'), bonif: Rv('—'), magasin: Rv('—'), cnss: Rv('—'), appart: Rv('—'), studio: Rv('—') };
        const Fx = (label) => ({ ...neutre, label, valeur: 0 });
        d.chargesFixes = Object.fromEntries(['creditImmo', 'creditStudio', 'syndic', 'nounou', 'ecole', 'femmeMenage', 'habitsCharif', 'habitsBebe', 'jouets'].map(k => [k, Fx('—')]));
        const V = (label, periode) => ({ ...neutre, label, valeur: 0, periode, details: [], showDetails: false });
        d.chargesVariables = { alimentation: V('COURSES', 'semaine'), sorties: V('SORTIES', 'semaine'), voiture: V('—', 'semaine'), sante: V('—', 'semaine'),
                               factures: { ...V('FACTURES', 'mois'), categorieId: 'cat_cv_factures' } };
        d.epargne = [];
        const ici = Number(an) === sc.an;
        d.depensesIrregulieres = !ici ? [] : [
            { id: 901, mois: 11, annee: sc.an, nom: 'Assurance annuelle', montant: 7150, sourceCompte: 'cpt_3' },
            { id: 902, mois: 12, annee: sc.an, nom: 'Prime', montant: -5000, sourceCompte: 'courant' },
            { id: 903, mois: 12, annee: sc.an, nom: 'Cadeaux', montant: 2000, sourceCompte: 'courant' },
        ];
        d.virementsInternes = !ici ? [] : [
            { id: 801, mois: 10, sourceCompte: 'courant', destinationCompte: 'cpt_3', montant: 1500 },
            { id: 802, mois: 11, sourceCompte: 'cpt_2', destinationCompte: 'cpt_3', montant: 60000 },
            { id: 803, mois: 12, sourceCompte: 'courant', destinationCompte: 'cpt_2', montant: 1000 },
            { id: 804, mois: 12, sourceCompte: 'courant', destinationCompte: 'cpt_2', montant: 500 },
        ];
        d.transactionsReelles = []; d.consoRealiseeT0 = {};
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


//  Le moteur : atterrissage du cycle (et ses lignes), radar jusqu'en décembre, KPI « Dépenses annuelles »
const moteur = (page) => page.evaluate((ST) => {
    const st = eval(ST);
    const ac = st.atterrissageCycle.comptes;
    return {
        a: Object.fromEntries(ac.map(c => [c.key, c.atterrissage])),
        lignes: Object.fromEntries(ac.map(c => [c.key, c.lignes.map(l => [l.libelle, l.type, l.montant])])),
        fin: Object.fromEntries(st.radarComptes.comptes.map(c => [c.key, c.fin])),
        radarDA: (() => { const r = st.radarComptes.comptes.find(c => c.key === 'cpt_3') || {}; return { pointBas: r.pointBas, aVirer: r.aVirer }; })(),
        kpiDA: { fin: st.kpiDepensesAnnuelles.soldeFinal, entrees: st.kpiDepensesAnnuelles.totalEntrees, sorties: st.kpiDepensesAnnuelles.totalSorties },
    };
}, ST);
//  Le Relevé tel que l'écran le montre pour un mois choisi (sélecteur du Relevé)
const releve = (page, mois) => page.evaluate(async ({ ST, mois }) => {
    const st = eval(ST);
    st.moisSelectionnes.splice(0, st.moisSelectionnes.length, mois);
    st.anneesSelectionnees.splice(0, st.anneesSelectionnees.length, 2026);
    st.releveComptesFiltres.splice(0);
    await new Promise(r => setTimeout(r, 60));
    const e = (st.journalHybridePourReleve.entries || []).filter(x => x.type === 'credit' || x.type === 'debit')
        .map(x => ({ cle: x.compteKey, lib: x.libelle, type: x.type, montant: Math.round(x.montant), jour: x.jourPrevu, apres: Math.round(x.soldeCompteApres) }));
    st.moisSelectionnes.splice(0); st.anneesSelectionnees.splice(0);
    return e;
}, { ST, mois });
//  Les en-têtes des mois du Calendrier pluriannuel
const entetes = (page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-mois-resume]')].map(r => [r.dataset.mois, {
    sorties: r.querySelector('[data-mois-sorties]')?.textContent.trim() || null,
    entrees: r.querySelector('[data-mois-entrees]')?.textContent.trim() || null,
    virements: r.querySelector('[data-mois-virements]')?.textContent.trim() || null,
    titre: r.querySelector('[data-mois-virements]')?.getAttribute('title') || null }])));

try {
    const { page, erreurs } = await ouvrir(SC);
    /* ══ C. LE CYCLE EN COURS : le virement d'octobre bouge deux soldes ══ */
    let m = await moteur(page);
    v('C. octobre : Courant 8 500 (− 1 500), Dépenses annuelles 3 500 (+ 1 500), Épargne LT 100 000',
      m.a.cpt_1 === 8500 && m.a.cpt_3 === 3500 && m.a.cpt_2 === 100000, JSON.stringify(m.a));
    v('  → le Relevé porte les deux jambes : sortie sur le Courant, entrée sur Dépenses annuelles',
      JSON.stringify(m.lignes.cpt_1) === JSON.stringify([['🔄 Virement → Dépenses annuelles', 'debit', 1500]])
      && JSON.stringify(m.lignes.cpt_3) === JSON.stringify([['🔄 Virement reçu ← Compte Courant', 'credit', 1500]]), JSON.stringify([m.lignes.cpt_1, m.lignes.cpt_3]));

    /* ══ D. NOVEMBRE : les 60 000 de l'Épargne LT vers les Dépenses annuelles ══ */
    const nov = await releve(page, 11);
    const sortie = nov.find(x => x.cle === 'cpt_2' && x.type === 'debit') || {};
    const entree = nov.find(x => x.cle === 'cpt_3' && x.type === 'credit') || {};
    v('D. Relevé de novembre : − 60 000 sur l\'Épargne LT (→ 40 000)',
      sortie.lib === '🔄 Virement → Dépenses annuelles' && sortie.montant === 60000 && sortie.apres === 40000, JSON.stringify(nov));
    v('  → + 60 000 sur Dépenses annuelles (3 500 → 63 500), le même jour',
      entree.lib === '🔄 Virement reçu ← Épargne Long Terme' && entree.montant === 60000 && entree.apres === 63500 && entree.jour === sortie.jour, JSON.stringify(nov));
    const iVir = nov.findIndex(x => x === entree), iAss = nov.findIndex(x => x.cle === 'cpt_3' && /Assurance annuelle/.test(x.lib));
    v('  → le virement passe AVANT l\'assurance qu\'il finance (même jour) : 63 500 puis 56 350',
      iVir >= 0 && iAss > iVir && nov[iAss].apres === 56350, JSON.stringify(nov.filter(x => x.cle === 'cpt_3')));
    m = await moteur(page);
    v('  → fin décembre (radar) : Courant 10 000, Épargne LT 41 500, Dépenses annuelles 56 350',
      m.fin.cpt_1 === 10000 && m.fin.cpt_2 === 41500 && m.fin.cpt_3 === 56350, JSON.stringify(m.fin));
    v('  → le radar ne voit aucun découvert des Dépenses annuelles (point bas 2 000, rien à virer)',
      m.radarDA.pointBas === 2000 && m.radarDA.aVirer === 0, JSON.stringify(m.radarDA));
    v('  → le KPI « Dépenses annuelles » atterrit à 56 350 (+ 61 500 reçus, − 7 150 payés)',
      Math.round(m.kpiDA.fin) === 56350 && Math.round(m.kpiDA.entrees) === 61500 && Math.round(m.kpiDA.sorties) === 7150, JSON.stringify(m.kpiDA));

    /* ══ E. LE VIREMENT D'OCTOBRE SE POINTE : fait, il n'est plus projeté ══ */
    const ligne = await page.evaluate(() => {
        const r = [...document.querySelectorAll('#pilotage-inbox [data-tiroir="virement"] [data-tache]')].find(x => /Virement/.test(x.textContent));
        return r ? { nom: r.querySelector('[data-tache-nom]').textContent.trim(), compte: r.querySelector('[data-route]')?.dataset.compteRoute,
                     date: [...r.querySelectorAll('span')].map(s => s.textContent.trim()).find(t => /^📅/.test(t)) } : null;
    });
    v('E. la checklist le propose dans « 🔄 Virements internes » (pas dans l\'épargne) : « Virement Courant → Dépenses annuelles », prélevé sur le Courant',
      !!ligne && ligne.nom === 'Virement Courant → Dépenses annuelles' && ligne.compte === 'cpt_1' && ligne.date === '📅 sans date', JSON.stringify(ligne));
    await page.click('#pilotage-inbox [data-tiroir="virement"] > summary'); await attendre(page, 200);
    await page.locator('#pilotage-inbox [data-tiroir="virement"] [data-tache]').filter({ hasText: 'Virement' }).locator('input[type=checkbox]').click();
    await attendre(page, 650);
    await page.evaluate(async (ST) => { const st = eval(ST);   // la banque l'a exécuté : les deux soldes ont bougé
        st.comptes.find(c => c.id === 1).solde = 8500; st.comptes.find(c => c.id === 3).solde = 3500;
        st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 300)); }, ST);
    m = await moteur(page);
    v('  → pointé et exécuté : Courant 8 500, Dépenses annuelles 3 500 — compté UNE fois',
      m.a.cpt_1 === 8500 && m.a.cpt_3 === 3500 && !(m.lignes.cpt_1 || []).length && !(m.lignes.cpt_3 || []).length, JSON.stringify([m.a, m.lignes.cpt_1, m.lignes.cpt_3]));
    const valide = await page.evaluate(() => [...document.querySelectorAll('#pilotage-inbox [data-deja-valide] [data-valide]')]
        .map(r => [r.querySelector('[data-badge-nature]').textContent.trim(), r.querySelector('[data-valide-nom]').textContent.trim()]));
    v('  → il passe dans « Déjà validé », badge « 🔄 Virement »', JSON.stringify(valide) === JSON.stringify([['🔄 Virement', 'Virement Courant → Dépenses annuelles']]), JSON.stringify(valide));
    m = await moteur(page);
    v('  → et la fin d\'année ne bouge pas (Dépenses annuelles 56 350)', m.fin.cpt_3 === 56350 && m.fin.cpt_1 === 10000, JSON.stringify(m.fin));

    /* ══ F. LE CALENDRIER : un mois fermé dit ce qu'il contient ═════════ */
    await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'previsionnel'; await new Promise(r => setTimeout(r, 250)); st.anneeAffichage = 2026; st.activeTab = 'irregulieres'; await new Promise(r => setTimeout(r, 400)); }, ST);
    const h = await entetes(page);
    v('F. octobre (un seul virement) : « 🔄 1 Virement », plus d\'en-tête muet',
      h['10'] && h['10'].sorties === null && h['10'].entrees === null && h['10'].virements === '🔄 1 Virement', JSON.stringify(h['10']));
    v('  → novembre : « 7 150 DH » et « 🔄 1 Virement » (60 000 DH au survol)',
      h['11'] && sansEsp(h['11'].sorties) === nf(7150) + 'DH' && h['11'].virements === '🔄 1 Virement' && sansEsp(h['11'].titre).startsWith(nf(60000) + 'DH'), JSON.stringify(h['11']));
    v('  → décembre (total net négatif, jadis muet) : « 2 000 DH », « + 5 000 DH », « 🔄 2 Virements »',
      h['12'] && sansEsp(h['12'].sorties) === nf(2000) + 'DH' && sansEsp(h['12'].entrees) === '+' + nf(5000) + 'DH' && h['12'].virements === '🔄 2 Virements', JSON.stringify(h['12']));
    v('  → un mois vide reste sobre (janvier : rien)', h['1'] && !h['1'].sorties && !h['1'].entrees && !h['1'].virements, JSON.stringify(h['1']));
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
