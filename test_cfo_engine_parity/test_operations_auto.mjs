/**
 * v37.155 — « L'APPLI NE DOIT PAS ÊTRE MUETTE : SI RECALIBRER FAIT QUELQUE CHOSE, ELLE DOIT AFFICHER EN PERMANENCE SES
 *   TRANSACTIONS, SUR CHAQUE MOIS. »
 *   Décor fictif, jeudi 29 oct. 2026, paie le 27 : le salaire arrive sur « Compte Salaire » (comme ASSAFA), les charges
 *   partent du Courant (2 000) ; une épargne « Alimentation Dépenses Annuelles & Projets » part du Compte Salaire, déjà
 *   adaptée au potentiel ; un virement en DOUBLE en décembre. « Recalibrer 2026 » : doublon retiré, épargne réadaptée,
 *   Courant alimenté au juste besoin — et chaque mois le dit.
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
console.log('\n  CE QUE L’APPLI POSE, AFFICHÉ CHAQUE MOIS\n  ' + '─'.repeat(80));

v('A. un journal des opérations automatiques par mois (relu des données), au Calendrier (en-tête, détail, virement) et au Relevé',
  /const operationsAutoDuMois = \(an, m\) =>/.test(html) && /data-mois-auto /.test(html) && /data-mois-auto-detail/.test(html) && /data-vir-auto/.test(html)
  && /🤖 posé par l’appli/.test(html) && /⚖️ adapté par l’appli/.test(html) && /d\.doublonsRetires\.push/.test(html));
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
    fx.comptes = [{ id: 'acc_cc', label: 'Compte Courant', type: 'liquide', solde: 2000, icone: '💳' }, { id: 'acc_sal', label: 'Compte Salaire', type: 'courant', solde: 30000, icone: '🏦' },
                  { id: 'acc_da', label: 'Dépenses Annuelles & Projets', type: 'epargne', solde: 0, icone: '💰' }];
    d.revenus.salaire.destinationCompte = 'cpt_acc_sal';
    d.revenus.salaire.trackerRealise = { '2026-11': { paye: true, montantPaye: 0 } };
    d.epargne = [{ id: 7, nom: 'Alimentation Dépenses Annuelles & Projets', valeur: 3000, sourceCompte: 'cpt_acc_sal', linkedAccountId: 'acc_da', exceptions: [],
                   adapteePotentiel: { an: 2026, plafond: null, le: '2026-10-01', mois: {} } }];
    d.virementsInternes = [{ id: 501, mois: 12, sourceCompte: 'cpt_acc_sal', destinationCompte: 'cpt_acc_da', montant: 1000, jourPrevu: 15 },
                           { id: 502, mois: 12, sourceCompte: 'cpt_acc_sal', destinationCompte: 'cpt_acc_da', montant: 1000, jourPrevu: 15 }];
    d.depensesIrregulieres = []; d.consoRealiseeT0 = {}; d.consoClotureT0 = {}; d.banqueOperations = {};
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
    const ops = () => E((st) => { const o = {}; for (let m = 1; m <= 12; m++) { const l = st.operationsAutoDuMois(2026, m); if (l.length) o[m] = l.map(x => x.type + ' ' + x.icone + ' ' + x.texte + ' | ' + x.par); } return o; });

    await section('B', async () => {
        const O = await ops();
        v('B. avant tout recalibrage : aucun mois ne dit « posé par l’appli »', Object.keys(O).length === 0, JSON.stringify(O));
    });

    let O;
    await section('C', async () => {
        const R = await E((st) => { const r = st.recalibrerAnnee(2026); const d = st.donneesAnnuelles[2026];
            return { ok: !!r, aj: (d.virementsInternes || []).filter(v => v.origine === 'juste_besoin').map(v => [v.mois, v.montant]), db: (d.doublonsRetires || []).length,
                     ep: d.epargne[0].adapteePotentiel && d.epargne[0].adapteePotentiel.mois }; });
        console.log('    recalibrage :', JSON.stringify(R));
        O = await ops();
        console.log('    par mois :', JSON.stringify(O, null, 1).slice(0, 1500));
        const tous = Object.values(O).flat();
        v('C. après « Recalibrer 2026 » : le doublon de décembre est dit, dans décembre (« 🧹 Doublon retiré : 1 000 DH de Compte Salaire vers … (le 15) »)',
          R.db === 1 && (O[12] || []).some(x => /^retrait 🧹 Doublon retiré : 1.000 DH de Compte Salaire vers Dépenses Annuelles & Projets \(le 15\) \| Recalibrer 2026/.test(x.replace(/\s/g, ' '))), JSON.stringify(O[12]));
        v('  → chaque virement posé pour le Courant est dit dans SON mois (« 🔄 Virement posé : … de Compte Salaire vers Compte Courant »)',
          R.aj.length >= 1 && R.aj.every(([m, mt]) => (O[m] || []).some(x => /^ajout 🔄 Virement posé : .* de Compte Salaire vers Compte Courant/.test(x))), JSON.stringify({ aj: R.aj, O }));
        v('  → les mois de l\'épargne réadaptée sont dits (« ⚖️ « Alimentation… » : X ce mois (montant de base 3 000 DH) »)',
          R.ep && Object.keys(R.ep).length >= 1 && Object.keys(R.ep).every(m => (O[m] || []).some(x => /^epargne ⚖️ « Alimentation Dépenses Annuelles & Projets » : .* ce mois \(montant de base 3.000 DH\)/.test(x.replace(/\s/g, ' ')))), JSON.stringify({ ep: R.ep, O }));
        v('  → et qui l\'a fait : « Recalibrer 2026, le jj/mm/aaaa »', tous.length >= 3 && tous.every(x => /\| (Recalibrer 2026|Adapter au potentiel|Alimentation au juste besoin|Retirer les doublons), le \d\d\/\d\d\/\d{4}$/.test(x)), JSON.stringify(tous));
    });

    await section('D', async () => {
        await E((st) => { st.appMode = 'previsionnel'; st.activeTab = 'irregulieres'; }); await attendre(600);
        const H = await page.$$eval('[data-mois-auto]', els => els.map(e => [e.closest('[data-mois-resume]').dataset.mois, e.textContent.replace(/\s+/g, ' ').trim()]));
        const attendu = Object.entries(O).map(([m, l]) => [String(m), '🤖 ' + l.length + ' posé' + (l.length > 1 ? 's' : '') + ' par l’appli']);
        v('D. Calendrier : l\'en-tête de chaque mois concerné, MÊME FERMÉ, dit « 🤖 N posé(s) par l’appli »', JSON.stringify(H) === JSON.stringify(attendu), JSON.stringify({ H, attendu }));
        await E((st) => { st.moisOuverts.splice(0, st.moisOuverts.length, 12); }); await attendre(300);
        const L = await page.$$eval('[data-mois-auto-detail] [data-mois-auto-ligne]', els => els.filter(e => e.offsetParent !== null).map(e => e.dataset.type + ' ' + e.textContent.replace(/\s+/g, ' ').trim()));
        v('  → décembre ouvert : « 🤖 Posé par l’appli ce mois », une ligne par opération (doublon, épargne…)', L.length === (O[12] || []).length && L.some(x => /Doublon retiré/.test(x)), JSON.stringify(L));
        const auto = await E((st) => { const mois = (st.donneesAnnuelles[2026].virementsInternes || []).filter(v => v.origine === 'juste_besoin').map(v => v.mois); return [...new Set(mois)]; });
        await E((st, ms) => { st.moisOuverts.splice(0, st.moisOuverts.length, ...ms); }, auto); await attendre(300);
        const badges = await page.$$eval('[data-vir-auto]', els => els.filter(e => e.offsetParent !== null).length);
        v('  → dans la liste des virements, ceux posés par l\'appli portent « 🤖 auto »', auto.length >= 1 && badges >= auto.length, JSON.stringify({ auto, badges }));
    });

    await section('E', async () => {
        const R = await E((st) => { const cles = []; for (let m = st.moisBudgetaire.mois; m <= 12; m++) cles.push(m + '-2026');
            const E2 = (st.buildJournalReleve([], cles) || {}).entries || [];
            return { auto: E2.filter(e => /🤖 posé par l’appli/.test(e.libelle || '')).length, adapte: E2.filter(e => /⚖️ adapté par l’appli/.test(e.libelle || '')).length,
                     nAj: (st.donneesAnnuelles[2026].virementsInternes || []).filter(v => v.origine === 'juste_besoin').length }; });
        v('E. au Relevé, les virements posés par l\'appli le disent (« · 🤖 posé par l’appli », départ et arrivée) et l\'épargne adaptée aussi (« · ⚖️ adapté par l’appli »)',
          R.auto >= 2 * Math.min(1, R.nAj) && R.auto >= 2 && R.adapte >= 1, JSON.stringify(R));
    });

    await section('F', async () => {
        const R = await E((st) => { st.annulerRecalibrage(2026); const o = {}; for (let m = 1; m <= 12; m++) { const l = st.operationsAutoDuMois(2026, m); if (l.length) o[m] = l.map(x => x.type + ' ' + x.icone); }
            return { o, vir: (st.donneesAnnuelles[2026].virementsInternes || []).length }; });
        v('F. « Annuler le recalibrage » : le doublon revient, et plus aucun mois ne parle d\'un doublon retiré ni d\'un virement posé',
          !Object.values(R.o).flat().some(x => /🧹|🔄/.test(x)) && R.vir === 2, JSON.stringify(R));
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
