/**
 * v37.89 — LE COURANT ALIMENTÉ AU JUSTE BESOIN · LE CFO DEMANDE, L'APPLI CALCULE.
 *   Décor fictif (KARIM TESTEUR) : salaire 20 000 sur un « Compte Salaire », loyer 5 000 sur le Courant le 10
 *   (15 000 à partir de juillet), une charge fixe de 12 000 payée du Courant le 15 ; les anciens virements du CFO :
 *   9 100 le 28 de chaque mois + un aller-retour Courant → Salaire en novembre ; 10 000 vers l'épargne en décembre.
 *
 *
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
console.log('\n  LE COURANT ALIMENTÉ AU JUSTE BESOIN\n  ' + '─'.repeat(80));

const php = fs.readFileSync(path.join(RACINE, 'cfo_intent_engine.php'), 'utf8');
v('A. appli : « Alimenter le Courant au juste besoin », Annuler, demandes du CFO exécutées ; CFO : app_action, doublon refusé',
  /data-alimenter-courant/.test(html) && /data-annuler-alimentation/.test(html) && /const executerActionsAppli = /.test(html) && /data-cfo-actions-appli/.test(html)
  && /'app_action' => \['desc'/.test(php) && /le reposer le DOUBLERAIT/.test(php));
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
    //  35 103 : ce que coûtent les semaines du décor jusqu'au 26 déc. 2026 — le Courant entre en janvier à 0
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    for (const an of ['2026', '2027']) {
        const d = fx.donneesAnnuelles[an], actif = an === '2027';
        const Rv = (label, b, j, dest, exc) => ({ ...neutre, label, base: actif ? b : 0, jourPrevu: j, destinationCompte: dest, exceptions: actif ? (exc || []) : [] });
        d.revenus = { salaire: Rv('SALAIRE', 20000, 27, 'cpt_acc_sal'), bonif: Rv('—', 0, 1, 'courant'), magasin: Rv('Loyer', 5000, 10, 'courant', [{ id: 1, moisDebut: 7, moisFin: 12, nouvelleValeur: 15000 }]),
                      cnss: Rv('—', 0, 1, 'courant'), appart: Rv('—', 0, 1, 'courant'), studio: Rv('—', 0, 1, 'courant') };
        const Fx = (label, valeur, j) => ({ ...neutre, label, valeur: actif ? valeur : 0, jourPrevu: j || null });
        d.chargesFixes = { creditImmo: Fx('Crédit', 12000, 15), creditStudio: Fx('—', 0), syndic: Fx('—', 0), nounou: Fx('—', 0), ecole: Fx('—', 0), femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
        d.chargesVariables = {}; d.epargne = []; d.depensesIrregulieres = []; d.consoRealiseeT0 = {}; d.consoClotureT0 = {}; d.banqueOperations = {}; d.transactionsReelles = [];
        d.virementsInternes = actif ? [
            ...Array.from({ length: 12 }, (_, i) => ({ id: 100 + i, mois: i + 1, sourceCompte: 'cpt_acc_sal', destinationCompte: 'courant', montant: 9100, jourPrevu: 28 })),
            { id: 200, mois: 11, sourceCompte: 'courant', destinationCompte: 'cpt_acc_sal', montant: 5000, jourPrevu: 28 },
            { id: 300, mois: 12, sourceCompte: 'cpt_acc_sal', destinationCompte: 'cpt_acc_ep', montant: 10000 },
        ] : [];
    }
    if (AVEC_DEMANDE) fx.actionsAppli = [{ id: 'x1', tache: 'alimenter_courant', annee: 2027 }];
    return fx;
};
//  B. le moteur du CFO (PHP)
{
    const f = path.join(ICI, '.tmp_fx89.json'); fs.writeFileSync(f, JSON.stringify(fixture()));
    const moteur = path.join(RACINE, 'cfo_intent_engine.php');
    const run = (calls) => { try { return JSON.parse(execFileSync('php', ['-r', `require '${moteur}'; $fd = json_decode(file_get_contents('${f}')); $r = cfo_compile(json_decode('${calls}'), $fd, ['anneeContexte' => 2027]); echo json_encode(['r' => $r, 'actions' => $fd->actionsAppli ?? null, 'nvir' => count($fd->donneesAnnuelles->{'2027'}->virementsInternes)], JSON_UNESCAPED_UNICODE);`], { encoding: 'utf8' })); } catch (e) { return { erreur: String(e).slice(0, 300) }; } };
    const R1 = run('[{"function":"app_action","args":{"task":"alimenter_courant","years":[2027]}}]');
    v('B. CFO : app_action alimenter_courant → une demande déposée pour l\u2019appli (aucun montant calculé par le CFO)',
      Array.isArray(R1.actions) && R1.actions.length === 1 && R1.actions[0].tache === 'alimenter_courant' && R1.actions[0].annee === 2027 && R1.nvir === 14, JSON.stringify(R1).slice(0, 400));
    const R2 = run('[{"function":"app_action","args":{"task":"adapter_epargne","name":"Inexistante","years":[2027]}}]');
    v('  → adapter_epargne sur une ligne qui n\u2019existe pas : refusé', !R2.actions && JSON.stringify(R2.r).includes('introuvable'), JSON.stringify(R2).slice(0, 300));
    const R3 = run('[{"function":"plan_transfer","args":{"from_account":"Compte Salaire","to_account":"Compte Courant","amount":9100,"month":1,"day":28,"years":[2027]}}]');
    v('  → plan_transfer identique à un virement existant (9 100 le 28 janvier) : REFUSÉ, il le doublerait', R3.nvir === 14 && JSON.stringify(R3.r).includes('DOUBLERAIT'), JSON.stringify(R3).slice(0, 300));
    fs.rmSync(f, { force: true });
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
    await page.clock.setFixedTime(new Date(2026, 10, 1, 12, 0, 0));
    page.on('pageerror', e => erreurs.push(String(e)));
    await page.route('**/webhook/**', route => route.abort());
    await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    return page;
};
//  les soldes du Courant et du salaire, cycle par cycle (le Relevé)
const soldes = (page) => page.evaluate((ST) => { const st = eval(ST); const cles = ['11-2026', '12-2026', ...Array.from({ length: 12 }, (_, i) => (i + 1) + '-2027')];
    st.ouvrirReleve('cpt_acc_cc'); st.showReleveModal = false;
    return null; }, ST);
const plan = (page) => page.evaluate((ST) => { const st = eval(ST); const v26 = st.donneesAnnuelles[2026].virementsInternes, v27 = st.donneesAnnuelles[2027].virementsInternes;
    return JSON.parse(JSON.stringify({ r: st.donneesAnnuelles[2027].alimentationJusteBesoin || null, v26: v26.map(v => [v.mois, v.jourPrevu, v.montant, v.sourceCompte, v.destinationCompte]),
        v27: v27.map(v => [v.mois, v.jourPrevu, v.montant, v.sourceCompte, v.destinationCompte]) })); }, ST);

try {
    const page = await ouvrir();
    await section('C', async () => {
        await page.evaluate(async (ST) => { const st = eval(ST); st.anneeAffichage = 2027; st.activeTab = 'irregulieres'; await new Promise(r => setTimeout(r, 400)); }, ST);
        await page.click('[data-alimenter-courant]'); await page.waitForTimeout(700);
        const P = await plan(page);
        const montants = P.r ? P.r.plan.map(p => p.montant) : null;
        v('C. le plan, cycle par cycle : 7 000 de janvier à juin (loyer 5 000 − charge 12 000), RIEN de juillet à décembre (loyer 15 000)',
          JSON.stringify(montants) === JSON.stringify([7000, 7000, 7000, 7000, 7000, 7000, 0, 0, 0, 0, 0, 0]), JSON.stringify(P.r && P.r.plan));
        v('  → janvier posé le 27 DÉCEMBRE 2026 (le jour de paie ouvre le cycle), février le 27 janvier',
          JSON.stringify(P.v26) === JSON.stringify([[12, 27, 7000, 'cpt_acc_sal', 'courant']]) && P.v27.some(x => x[0] === 1 && x[1] === 27 && x[2] === 7000) && !P.v27.some(x => x[1] === 28 && x[4] === 'courant' && x[0] < 12), JSON.stringify(P));
        v('  → nettoyage d\u2019abord : les 12 virements de 9 100 (dont le 28 déc., résidu pour janvier 2028 — année absente) et l\u2019aller-retour retirés (13) ; l\u2019épargne gardée',
          P.r.retires.length === 13 && P.r.nettoyes === 13 && !P.v27.some(x => x[2] === 9100) && P.v27.some(x => x[2] === 10000 && x[4] === 'cpt_acc_ep') && !P.v27.some(x => x[2] === 5000), JSON.stringify([P.r.retires.length, P.r.nettoyes]));
        //  relancé : ses propres virements remplacés, pas gardés comme « anciens »
        await page.click('[data-alimenter-courant]'); await page.waitForTimeout(700);
        const P2 = await plan(page);
        v('  → relancé : mêmes virements, aucun doublon ; ses propres virements ne deviennent pas des « anciens » (13 gardés pour Annuler)',
          P2.r.nettoyes === 0 && P2.r.retires.length === 13 && P2.v27.filter(x => x[4] === 'courant').length === 5 && P2.v26.length === 1, JSON.stringify([P2.r.nettoyes, P2.r.retires.length, P2.v26, P2.v27]));
        //  le Courant ne passe jamais sous zéro (le radar du Relevé, jusqu'à fin 2027)
        const bas = await page.evaluate((ST) => { const st = eval(ST); const c = st.radarComptes.comptes.find(x => x.key === 'cpt_acc_cc'); return c ? c.pointBas : null; }, ST);
        v('  → le Courant ne passe plus jamais sous zéro (point bas ≥ 0)', bas !== null && bas >= 0, String(bas));
        const affiche = await page.evaluate(() => (document.querySelector('[data-alimentation-plan]') || {}).textContent || '');
        v('  → affiché : « Janvier : 7 000 DH le 27 déc. 2026 » … « Juillet : rien »', /Janvier : 7[\s\u00a0\u202f]?000[\s\u00a0]DH le 27 déc\. 2026/.test(affiche) && /Juillet : rien/.test(affiche), affiche.slice(0, 200));
        await page.click('[data-annuler-alimentation]'); await page.waitForTimeout(400);
        const A = await plan(page);
        v('D. « Annuler » (après deux calculs) : retour à l\u2019état d\u2019AVANT le premier — les 14 virements reviennent', A.r === null && A.v26.length === 0 && A.v27.length === 14 && A.v27.filter(x => x[2] === 9100).length === 12, JSON.stringify(A));
    });
    await section('E', async () => {
        const S = await page.evaluate(async (ST) => { const st = eval(ST); st.anneeAffichage = 2027; await new Promise(r => setTimeout(r, 200)); return JSON.parse(JSON.stringify(st.surplusStats)); }, ST);
        v('E. Surplus détaillé : la moyenne HORS virements du calendrier ajoute les 10 000 de décembre (÷ 12)',
          S.virements === 10000 && Math.round(S.moyNetHorsVirements - S.moyNet) === Math.round(10000 / 12) && JSON.stringify(S.moisVirements) === '[12]', JSON.stringify(S));
    });
    await page.close();
    await section('F', async () => {
        AVEC_DEMANDE = true;
        const p2 = await ouvrir(); await p2.waitForTimeout(1500);
        const P = await plan(p2);
        v('F. une demande du CFO (actionsAppli) au chargement : exécutée par l\u2019appli — le plan juste besoin est posé',
          P.r && JSON.stringify(P.r.plan.map(p => p.montant)) === JSON.stringify([7000, 7000, 7000, 7000, 7000, 7000, 0, 0, 0, 0, 0, 0]), JSON.stringify(P.r && P.r.plan));
        const reste = await p2.evaluate((ST) => eval(ST).actionsEnAttente.length, ST);
        v('  → la demande est consommée (pas rejouée)', reste === 0, String(reste));
        await p2.close();
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
