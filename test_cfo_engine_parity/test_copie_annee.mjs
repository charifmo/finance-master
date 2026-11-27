/**
 * v37.158 — COPIER UNE ANNÉE VERS LES ANNÉES À VENIR, EN CHOISISSANT QUOI.
 *   « Je veux pouvoir copier les inputs du Calendrier pluriannuel et du Budget structurel de 2026 à 2027 : si j'ai changé
 *   beaucoup de choses, je veux que ça se reporte — je ne veux pas changer champ par champ sur chaque année. » « Et je peux
 *   choisir ce que je copie. » Décor fictif : 2027 = l'ancien 2026 (avec une ligne à elle, « École 2027 ») ; 2026 a changé
 *   (Syndic 1 275 trimestriel, Nounou 2 850, épargne 3 500 avec juin et décembre variables — décembre venant de l'adaptation,
 *   un nouveau flux, un virement). Vrai CSS.
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
console.log('\n  COPIER UNE ANNÉE, EN CHOISISSANT QUOI\n  ' + '─'.repeat(80));

v('A. « 📋 Copier vers… » : six rubriques, des lignes à cocher, un aperçu, « ↩ Annuler la copie »',
  /data-copier-annee/.test(html) && /const planCopieAnnee = /.test(html) && /data-copie-rubrique/.test(html) && /data-copie-ligne/.test(html)
  && /data-copie-apercu/.test(html) && /const annulerCopieAnnee = /.test(html));
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
    d.epargne = [{ id: 7, nom: 'Alimentation Dépenses Annuelles & Projets', valeur: 3000, sourceCompte: 'courant', linkedAccountId: 'acc_da', jourPrevu: 5, exceptions: [] }];
    fx.comptes = [{ id: 'acc_cc', label: 'Compte Courant', type: 'liquide', solde: 9000, icone: '💳' }, { id: 'acc_da', label: 'Dépenses Annuelles & Projets', type: 'epargne', solde: 0, icone: '💰' }];
    fx.soldesInitiaux.assurances_tracker = [{ id: 9, libelle: 'Analyses', montant: 2480, dateRemboursement: '2026-11-16', compteDepot: 'courant', remboursement: false }];
    d.virementsInternes = [{ id: 601, mois: 11, sourceCompte: 'courant', destinationCompte: 'cpt_acc_da', montant: 1000, jourPrevu: 15 }];
    d.depensesIrregulieres = [{ id: 701, mois: 11, annee: 2026, nom: 'Paiement Notaire & Travaux', montant: 4000, paye: false, montantPaye: 0, sourceCompte: 'courant', jourPrevu: 20, categorieId: 'cat_irr_depense_exceptionnelle' }];
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
//  le vrai CSS (Tailwind compilé) : la fenêtre doit passer DEVANT le Relevé (z-index), sinon on ne peut pas cliquer
const twBin = path.join(RACINE, 'node_modules/.bin/tailwindcss');
let tw = '';
if (fs.existsSync(twBin)) { const twTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-releve-'));
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
    //  le décor : 2027 = l'ancien 2026 ; puis 2026 est beaucoup modifié
    await E((st) => {
        const D = st.donneesAnnuelles, d6 = D[2026];
        d6.epargne = [{ id: 7, nom: 'Alimentation Dépenses Annuelles & Projets', valeur: 3000, sourceCompte: 'courant', linkedAccountId: null, exceptions: [] }];
        d6.depensesIrregulieres = [{ id: 701, mois: 12, annee: 2026, nom: 'Assurance kia', montant: 5000, paye: false, montantPaye: 0, sourceCompte: 'courant' }];
        d6.virementsInternes = [];
        const d7 = JSON.parse(JSON.stringify(d6)); d7.transactionsReelles = []; d7.chargesFixes.ecole2027 = { label: 'École 2027', valeur: 1500, exceptions: [], trackerRealise: {} };
        d7.depensesIrregulieres.forEach(x => { x.annee = 2027; x.id = 7701; });
        D[2027] = d7;
        //  ce qui change en 2026
        d6.chargesFixes.syndic.valeur = 1275; d6.chargesFixes.syndic.periodicite = { tous: 3, depart: 1 }; d6.chargesFixes.syndic.trackerRealise = { '2026-11': { paye: true, montantPaye: 0 } };
        d6.chargesFixes.nounou.label = 'Nounou'; d6.chargesFixes.nounou.valeur = 2850;
        d6.epargne[0].valeur = 3500; d6.epargne[0].exceptions = [{ id: 1, moisDebut: 6, moisFin: 6, nouvelleValeur: 1000 }, { id: 2, moisDebut: 12, moisFin: 12, nouvelleValeur: 22210 }];
        d6.epargne[0].adapteePotentiel = { an: 2026, plafond: null, le: '2026-11-20', mois: { 12: 22210 } };
        d6.depensesIrregulieres.push({ id: 702, mois: 12, annee: 2026, nom: 'Paiement Notaire & Travaux', montant: 160000, paye: false, montantPaye: 0, sourceCompte: 'courant' });
        d6.virementsInternes = [{ id: 801, mois: 12, sourceCompte: 'courant', destinationCompte: 'courant', montant: 35000, jourPrevu: 28 }];
        st.anneeAffichage = 2026; st.appMode = 'previsionnel'; st.activeTab = 'parametres'; st.forceUpdateCalculations();
    });
    await attendre(400);

    await section('B', async () => {
        await page.click('[data-copier-annee]'); await attendre(300);
        const R = await E((st) => { const c = st.copieAnnee; const ap = st.apercuCopieAnnee[0]; return { de: c.de, cibles: c.cibles, creer: c.creer, vers: ap.vers, maj: ap.budget.remplacees.length, nouv: ap.budget.nouvelles.length, gardees: ap.budget.gardees, flux: ap.flux.ajoutes.map(x => x.nom), ign: ap.flux.ignores, vir: ap.vir.ajoutes.length }; });
        v('B. « 📋 Copier vers… » depuis 2026 : 2027 cochée ; l\'aperçu dit les lignes mises à jour, la ligne propre à 2027 gardée, « Paiement Notaire » ajouté, « Assurance kia » déjà là (pas doublée), 1 virement',
          R.de === 2026 && JSON.stringify(R.cibles) === '[2027]' && !R.creer && R.vers === 2027 && R.maj >= 4 && R.nouv === 0 && JSON.stringify(R.gardees) === '["École 2027"]'
          && JSON.stringify(R.flux) === '["Paiement Notaire & Travaux"]' && R.ign === 1 && R.vir === 1, JSON.stringify(R));
        const N = await E((st) => { const ap = st.apercuCopieAnnee[0], L = st.lignesSourceCopie; return { plan: ap.budget.lignes.length, liste: ['revenus', 'chargesFixes', 'chargesVariables', 'epargne'].reduce((t, k) => t + (L[k] || []).length, 0), vides: ap.budget.lignes.filter(l => /^[—–-]*$/.test(String(l[2].label || l[2].nom || '').trim())).length }; });
        v('  → l\'aperçu compte exactement les lignes proposées à l\'écran ; les lignes de remplissage (« — », 0 DH) ne sont jamais copiées', N.plan === N.liste && N.vides === 0, JSON.stringify(N));
        const rub = await page.$$eval('[data-copie-rubrique]', els => els.map(e => e.dataset.rubrique));
        v('  → six rubriques à cocher : revenus, charges fixes, charges variables, épargne, flux, virements', JSON.stringify(rub) === '["revenus","chargesFixes","chargesVariables","epargne","flux","virements"]', JSON.stringify(rub));
    });

    await section('C', async () => {
        //  CHOISIR : pas les virements ; et, dans les charges fixes, pas « Nounou »
        await page.click('[data-copie-rubrique][data-rubrique="virements"] [data-copie-section]');
        await page.click('[data-copie-rubrique][data-rubrique="chargesFixes"] [data-copie-detail]'); await attendre(200);
        await page.click('[data-copie-rubrique][data-rubrique="chargesFixes"] [data-copie-ligne][data-cle="nounou"] input'); await attendre(200);
        const R = await E((st) => { const ap = st.apercuCopieAnnee[0]; return { vir: ap.vir.ajoutes.length, nounou: ap.budget.lignes.some(l => l[1] === 'nounou'), syndic: ap.budget.lignes.some(l => l[1] === 'syndic') }; });
        const compte = await page.textContent('[data-copie-rubrique][data-rubrique="chargesFixes"] [data-copie-compte]');
        v('C. je choisis : rubrique « Virements » décochée, ligne « Nounou » décochée — l\'aperçu suit (0 virement, Nounou hors copie, Syndic dedans)',
          R.vir === 0 && !R.nounou && R.syndic && /^\s*\d+ \/ \d+\s*$/.test(compte), JSON.stringify({ R, compte }));
        await page.click('[data-copie-valider]'); await attendre(500);
        const A = await E((st) => { const d7 = st.donneesAnnuelles[2027], s = d7.chargesFixes.syndic;
            return { syndic: [s.valeur, s.periodicite, JSON.stringify(s.trackerRealise)], nounou: d7.chargesFixes.nounou.valeur, ecole: !!d7.chargesFixes.ecole2027,
                     ep: [d7.epargne[0].valeur, d7.epargne[0].exceptions.length, !!d7.epargne[0].adapteePotentiel], flux: d7.depensesIrregulieres.map(x => x.nom + ':' + x.annee).sort(),
                     vir: (d7.virementsInternes || []).length, trace: d7.copieAnnee && d7.copieAnnee.de, ouvert: !!st.copieAnnee }; });
        v('  → « ✓ Copier » : en 2027, Syndic 1 275 trimestriel, pointage remis à zéro ; Nounou NON copiée ; « École 2027 » gardée',
          A.syndic[0] === 1275 && A.syndic[1] && A.syndic[1].tous === 3 && A.syndic[2] === '{}' && A.nounou !== 2850 && A.ecole && !A.ouvert, JSON.stringify(A));
        v('  → épargne 3 500 sans les montants par mois (option décochée), sans l\'adaptation de 2026 ; « Paiement Notaire » ajouté une fois, « Assurance kia » pas doublée ; aucun virement',
          A.ep[0] === 3500 && A.ep[1] === 0 && !A.ep[2] && JSON.stringify(A.flux) === '["Assurance kia:2027","Paiement Notaire & Travaux:2027"]' && A.vir === 0 && A.trace === 2026, JSON.stringify(A));
    });

    await section('D', async () => {
        //  vers une année CRÉÉE, avec les montants par mois : ceux d'« Adapter au potentiel » (déc. 22 210) ne suivent pas
        const R = await E((st) => { st.ouvrirCopieAnnee(); const c = st.copieAnnee; c.cibles = []; c.creer = true; c.exceptions = true; const r = st.appliquerCopieAnnee();
            const d8 = st.donneesAnnuelles[2028]; return { r, existe: !!d8, ep: d8 && d8.epargne[0].exceptions.map(e => [e.moisDebut, e.nouvelleValeur]), cree: d8 && d8.copieAnnee.cree, tx: d8 && d8.transactionsReelles.length, vir: d8 && d8.virementsInternes.length }; });
        v('D. « créer 2028 » avec les montants par mois : 2028 existe ; l\'épargne garde juin 1 000 mais PAS décembre 22 210 (adaptation de 2026) ; journal vide',
          R.existe && JSON.stringify(R.ep) === '[[6,1000]]' && R.cree === true && R.tx === 0 && R.vir === 1, JSON.stringify(R));
    });

    await section('E', async () => {
        const R = await E((st) => { const a = st.annulerCopieAnnee(2028); const b = st.annulerCopieAnnee(2027); const d7 = st.donneesAnnuelles[2027];
            return { a, b, d8: !!st.donneesAnnuelles[2028], syndic: d7.chargesFixes.syndic.valeur, per: !!d7.chargesFixes.syndic.periodicite, flux: d7.depensesIrregulieres.length, trace: !!d7.copieAnnee, ep: d7.epargne[0].valeur }; });
        v('E. « ↩ Annuler la copie » : 2028 disparaît ; 2027 redevient comme avant (Syndic 300 mensuel, 1 flux, épargne 3 000)',
          R.a && R.b && !R.d8 && R.syndic === 300 && !R.per && R.flux === 1 && !R.trace && R.ep === 3000, JSON.stringify(R));
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
