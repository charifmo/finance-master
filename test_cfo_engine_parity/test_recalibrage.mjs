/**
 * v37.97 — RECALIBRER L'ANNÉE EN UN GESTE · GARDE-FOUS.
 *   Décor fictif (KARIM TESTEUR), celui de « Courant au juste besoin » : salaire 20 000 sur un Compte Salaire,
 *   loyer 5 000 (15 000 dès juillet) sur le Courant, charge 12 000 du Courant ; les anciens virements 9 100 le 28,
 *   un aller-retour Courant → Salaire le 28 novembre, 10 000 vers l'épargne en décembre — posé DEUX fois.
 *   Épargne : « Smart Goal » 1 000/mois (montant fixe, à ne jamais toucher) et « Voyage » déjà calée sur le potentiel.
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
console.log('\n  RECALIBRER L’ANNÉE · GARDE-FOUS\n  ' + '─'.repeat(80));

const php = fs.readFileSync(path.join(RACINE, 'cfo_intent_engine.php'), 'utf8');
const prompt = fs.readFileSync(path.join(RACINE, 'cfo_system_prompt.md'), 'utf8');
v('A. appli : bouton, Annuler, résumé, garde-fous, proposition après import ; CFO : recalibrer_annee (catalogue, prompt, lecture)',
  /data-recalibrer-annee/.test(html) && /data-annuler-recalibrage/.test(html) && /data-recalibrage-resume/.test(html) && /data-garde-fous/.test(html) && /data-proposition-recalibrage/.test(html)
  && /task=recalibrer_annee/.test(php) && /'recalibrer_annee', 'alimenter_courant', 'adapter_epargne'/.test(php) && /task=recalibrer_annee/.test(prompt)
  && /recalibrer_annee: 'task=recalibrer_annee/.test(html) && /garde_fous: \(\(\) =>/.test(html));

const require = createRequire(import.meta.url);
const essai = (f) => { try { return f(); } catch { return null; } };
let AVEC_DEMANDE = false;
const fixture = () => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    fx._schemaVersion = 24;
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = { 2026: JSON.parse(JSON.stringify(base)), 2027: JSON.parse(JSON.stringify(base)) };
    Object.assign(fx.soldesInitiaux, { moisActuel: 11, anneeActuelle: 2026, jourDePaie: 27, compteChargesFixes: 'courant', compteChargesVariables: 'courant', assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.soldesInitiaux.categories = []; fx.soldesInitiaux.compteChargesFixes = 'courant';
    fx.comptes = [{ id: 'acc_cc', label: 'Compte Courant', type: 'liquide', solde: 35103, icone: '💳' }, { id: 'acc_sal', label: 'Compte Salaire', type: 'liquide', solde: 0, icone: '🏦' },
                  { id: 'acc_ep', label: 'Compte Épargne', type: 'epargne', solde: 0, icone: '🛟' }];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    for (const an of ['2026', '2027']) {
        const d = fx.donneesAnnuelles[an], actif = an === '2027';
        const Rv = (label, b, j, dest, exc) => ({ ...neutre, label, base: actif ? b : 0, jourPrevu: j, destinationCompte: dest, exceptions: actif ? (exc || []) : [] });
        d.revenus = { salaire: Rv('SALAIRE', 20000, 27, 'cpt_acc_sal'), bonif: Rv('—', 0, 1, 'courant'), magasin: Rv('Loyer', 5000, 10, 'courant', [{ id: 1, moisDebut: 7, moisFin: 12, nouvelleValeur: 15000 }]),
                      cnss: Rv('—', 0, 1, 'courant'), appart: Rv('—', 0, 1, 'courant'), studio: Rv('—', 0, 1, 'courant') };
        const Fx = (label, valeur, j) => ({ ...neutre, label, valeur: actif ? valeur : 0, jourPrevu: j || null });
        d.chargesFixes = { creditImmo: Fx('Crédit', 12000, 15), creditStudio: Fx('—', 0), syndic: Fx('—', 0), nounou: Fx('—', 0), ecole: Fx('—', 0), femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
        d.chargesVariables = {}; d.depensesIrregulieres = []; d.consoRealiseeT0 = {}; d.consoClotureT0 = {}; d.banqueOperations = {}; d.transactionsReelles = [];
        d.epargne = actif ? [
            { id: 501, nom: 'Smart Goal', valeur: 1000, sourceCompte: 'cpt_acc_sal', linkedAccountId: 'cpt_acc_ep', exceptions: [], paye: false, montantPaye: 0 },
            { id: 502, nom: 'Voyage', valeur: 500, sourceCompte: 'cpt_acc_sal', exceptions: [{ id: 9, moisDebut: 1, moisFin: 12, nouvelleValeur: 300 }], paye: false, montantPaye: 0,
              adapteePotentiel: { an: 2027, plafond: 2000, le: '2026-10-01', mois: {}, virementsAbsorbes: [] } },
        ] : [];
        d.virementsInternes = actif ? [
            ...Array.from({ length: 12 }, (_, i) => ({ id: 100 + i, mois: i + 1, sourceCompte: 'cpt_acc_sal', destinationCompte: 'courant', montant: 9100, jourPrevu: 28 })),
            { id: 200, mois: 11, sourceCompte: 'courant', destinationCompte: 'cpt_acc_sal', montant: 5000, jourPrevu: 28 },
            { id: 300, mois: 12, sourceCompte: 'cpt_acc_sal', destinationCompte: 'cpt_acc_ep', montant: 10000 },
            { id: 301, mois: 12, sourceCompte: 'cpt_acc_sal', destinationCompte: 'cpt_acc_ep', montant: 10000 },
        ] : [];
    }
    if (AVEC_DEMANDE) fx.actionsAppli = [{ id: 'x1', tache: 'recalibrer_annee', annee: 2027 }];
    return fx;
};
//  B. le moteur du CFO (PHP) : la demande est déposée, aucun montant calculé
{
    const f = path.join(ICI, '.tmp_fx97.json'); fs.writeFileSync(f, JSON.stringify(fixture()));
    const moteur = path.join(RACINE, 'cfo_intent_engine.php');
    let R;
    try { R = JSON.parse(execFileSync('php', ['-r', `require '${moteur}'; $fd = json_decode(file_get_contents('${f}')); $r = cfo_compile(json_decode('[{"function":"app_action","args":{"task":"recalibrer","years":[2027]}}]'), $fd, ['anneeContexte' => 2027]); echo json_encode(['r' => $r, 'actions' => $fd->actionsAppli ?? null, 'nvir' => count($fd->donneesAnnuelles->{'2027'}->virementsInternes)], JSON_UNESCAPED_UNICODE);`], { encoding: 'utf8' })); } catch (e) { R = { erreur: String(e).slice(0, 300) }; }
    v('B. CFO : app_action task=« recalibrer » → demande recalibrer_annee 2027 déposée (aucun virement touché)',
      Array.isArray(R.actions) && R.actions.length === 1 && R.actions[0].tache === 'recalibrer_annee' && R.actions[0].annee === 2027 && R.nvir === 15, JSON.stringify(R).slice(0, 400));
    fs.rmSync(f, { force: true });
}

const pw = essai(() => require('playwright-core'));
const vueJs = essai(() => require.resolve('vue/dist/vue.global.js'));
const chartJs = essai(() => fs.existsSync(path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js')) && path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js'));
const chromium = process.env.CHROMIUM || ['/opt/pw-browsers/chromium'].find(p => essai(() => fs.existsSync(p) && fs.statSync(p).isFile()));
if (!pw || !vueJs || !chartJs || !chromium) {
    console.log('  ⏭️  partie navigateur ignorée (playwright-core, vue, chart.js ou Chromium absent)');
    console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
    process.exit(ko === 0 ? 0 : 1);
}
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
const ouvrir = async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    await page.clock.setFixedTime(new Date(2026, 10, 15, 12, 0, 0));
    page.on('pageerror', e => erreurs.push(String(e)));
    await page.route('**/webhook/**', route => route.abort());
    await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    return page;
};
const etat = (page) => page.evaluate((ST) => { const st = eval(ST); const d = st.donneesAnnuelles[2027];
    return JSON.parse(JSON.stringify({ vir: d.virementsInternes.map(v => [v.id, v.mois, v.jourPrevu || 0, v.montant, v.sourceCompte, v.destinationCompte]), v26: st.donneesAnnuelles[2026].virementsInternes.length,
        ep: d.epargne.map(o => ({ nom: o.nom, valeur: o.valeur, exc: o.exceptions, ap: o.adapteePotentiel || null })), rc: d.recalibrage || null, ajb: !!d.alimentationJusteBesoin,
        gf: st.gardeFousAffichage.map(g => g.type), tx: (d.transactionsReelles || []).length })); }, ST);
const texte = (page, sel) => page.evaluate((sel) => (document.querySelector(sel) || {}).textContent || '', sel);

try {
    const page = await ouvrir();
    let E0;
    await section('C', async () => {
        await page.evaluate(async (ST) => { const st = eval(ST); st.anneeAffichage = 2027; st.activeTab = 'irregulieres'; await new Promise(r => setTimeout(r, 500)); }, ST);
        E0 = await etat(page);
        const dom = await page.evaluate(() => [...document.querySelectorAll('[data-garde-fou]')].map(e => e.getAttribute('data-garde-fou')));
        v('C. garde-fous avant : le virement de 10 000 en double, l’aller-retour du 28 novembre (affichés)',
          E0.gf.includes('doublon') && E0.gf.includes('aller_retour') && dom.includes('doublon') && dom.includes('aller_retour'), JSON.stringify([E0.gf, dom]));
        const sz = await page.evaluate((ST) => { const st = eval(ST); const d = st.donneesAnnuelles[2027]; const keep = d.virementsInternes; d.virementsInternes = keep.filter(v => v.montant !== 9100); st.calculationTick++;
            const g = st.gardeFousAnnee(2027); d.virementsInternes = keep; st.calculationTick++; return g.filter(x => x.type === 'sous_zero').map(x => x.texte); }, ST);
        v('  → sans les 9 100, le Courant passe sous zéro : garde-fou « sous zéro » avec le mois et le montant', sz.some(t => /Courant passe sous zéro en \S+ 2027 \(-/.test(t)), JSON.stringify(sz));
        const ep = await page.evaluate((ST) => { const st = eval(ST); const o = st.donneesAnnuelles[2027].epargne[0]; const av = o.valeur; o.valeur = 400000; st.calculationTick++;
            const g = st.gardeFousAnnee(2027).map(x => x.type); o.valeur = av; st.calculationTick++; return g; }, ST);
        v('  → une épargne de 400 000/mois : garde-fou « épargne > ce que l’année permet »', ep.includes('epargne_sup_potentiel'), JSON.stringify(ep));
    });
    await section('D', async () => {
        await page.click('[data-recalibrer-annee]'); await page.waitForTimeout(900);
        const E = await etat(page);
        const sg = E.ep.find(o => o.nom === 'Smart Goal'), vo = E.ep.find(o => o.nom === 'Voyage');
        v('D. recalibré : le double retiré (un seul 10 000), plus aucun 9 100, plus d’aller-retour',
          E.vir.filter(x => x[3] === 10000).length === 1 && !E.vir.some(x => x[3] === 9100) && !E.vir.some(x => x[0] === 200), JSON.stringify(E.vir));
        v('  → Smart Goal (montant fixe) INTACT : 1 000, aucune exception', sg && sg.valeur === 1000 && sg.exc.length === 0 && !sg.ap, JSON.stringify(sg));
        v('  → Voyage (déjà calée sur le potentiel) recalée : nouvelles exceptions, plafond 2 000 gardé', vo && vo.ap && vo.ap.le !== '2026-10-01' && vo.ap.plafond === 2000 && Object.values(vo.ap.mois).every(x => x <= 2000) && Object.keys(vo.ap.mois).length === 12, JSON.stringify(vo));
        v('  → Courant alimenté au juste besoin (le plan est posé)', E.ajb, '');
        v('  → avant/après mémorisé : alertes en baisse, point bas du Courant ≥ 0, 3 étapes + montants fixes nommés',
          E.rc && E.rc.apres.alertes < E.rc.avant.alertes && E.rc.apres.courantBas >= 0 && E.rc.etapes.length === 4 && /Smart Goal/.test(E.rc.etapes[2]), JSON.stringify(E.rc && { av: E.rc.avant, ap: E.rc.apres, et: E.rc.etapes }));
        const R = await texte(page, '[data-recalibrage-resume]');
        v('  → le tableau avant / après est affiché (Point bas du Courant, Alertes)', /Avant/.test(R) && /Après/.test(R) && /Point bas du Courant/.test(R) && /Alertes/.test(R), R.slice(0, 200));
        v('  → les garde-fous « double » et « aller-retour » ont disparu', !E.gf.includes('doublon') && !E.gf.includes('aller_retour'), JSON.stringify(E.gf));
        //  une opération importée APRÈS le recalibrage
        await page.evaluate((ST) => { const st = eval(ST); st.donneesAnnuelles[2027].transactionsReelles.push({ id: 777, date: '2027-01-03', libelle: 'Import banque', montant: 50, compteId: 'acc_cc' }); }, ST);
        await page.click('[data-annuler-recalibrage]'); await page.waitForTimeout(600);
        const A = await etat(page);
        v('E. « Annuler » : virements et épargne d’avant revenus (15 virements, double compris ; Voyage telle qu’avant)',
          JSON.stringify(A.vir) === JSON.stringify(E0.vir) && A.v26 === E0.v26 && JSON.stringify(A.ep) === JSON.stringify(E0.ep) && !A.ajb && A.rc === null, JSON.stringify([A.vir.length, A.ep[1]]));
        v('  → l’opération importée entre-temps n’est PAS touchée', A.tx === 1, String(A.tx));
    });
    await section('F', async () => {
        await page.evaluate(async (ST) => { const st = eval(ST); st.anneeAffichage = 2026; Object.assign(st.importBanque, { ouvert: true, etape: 'fini', resume: { ajoutees: 2, suspens: 0, deja: 0, pointees: 0, ignorees: 0, frais: 0, soldes: 1, corrigees: 0, retirees: 0, appris: 0 }, recalibre: null });
            await new Promise(r => setTimeout(r, 300)); }, ST);
        const P = await texte(page, '[data-proposition-recalibrage]');
        v('F. après un import qui change les soldes : « Recalibrer l’année maintenant » proposé', /Recalibrer l’année maintenant/.test(P) && /2026/.test(P), P.slice(0, 160));
        await page.click('[data-recalibrer-apres-import]'); await page.waitForTimeout(900);
        const R = await texte(page, '[data-recalibrage-import-resume]');
        const rc = await page.evaluate((ST) => !!eval(ST).donneesAnnuelles[2026].recalibrage, ST);
        v('  → recalibré depuis l’écran d’import : avant / après affiché, mémorisé sur l’année', rc && /Point bas du Courant/.test(R), R.slice(0, 160));
        await page.click('[data-annuler-recalibrage-import]'); await page.waitForTimeout(400);
        const rc2 = await page.evaluate((ST) => !!eval(ST).donneesAnnuelles[2026].recalibrage, ST);
        v('  → « Annuler » depuis l’écran d’import', !rc2, '');
        await page.evaluate((ST) => { eval(ST).importBanque.ouvert = false; }, ST);
    });
    await page.close();
    await section('G', async () => {
        AVEC_DEMANDE = true;
        const p2 = await ouvrir(); await p2.waitForTimeout(1500);
        const E = await etat(p2);
        const fait = await p2.evaluate((ST) => (eval(ST).serverLogs || []).map(l => l.msg).filter(m => /Demande du CFO/.test(m)).join(' | '), ST);
        v('G. demande du CFO (recalibrer_annee) au chargement : exécutée par l’appli, résultat dans le fil',
          E.rc && E.vir.filter(x => x[3] === 10000).length === 1 && /2027 recalibrée par l’appli/.test(fait) && /alertes \d+ → \d+/.test(fait), JSON.stringify([!!E.rc, E.vir.length, fait.slice(0, 300)]));
        await p2.close();
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
