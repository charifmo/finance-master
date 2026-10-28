/**
 * v37.67 — LE CFO LIT LE MOTEUR, IL NE CALCULE PLUS · ANNULER : 50 PAS QUI SURVIVENT AU RECHARGEMENT.
 *
 *   « Pourquoi le CFO se trompe ? D'où il prend ces infos ? Pourquoi il dit que toutes ces charges sont
 *   prises du compte courant alors que non ? » — le résumé envoyé au CFO lisait `sourceCompte`, un champ
 *   mort depuis la v20 (« courant » sur chaque ligne), le montant de base sans exceptions, et le montant
 *   « / semaine » brut que le modèle multipliait par 4,33.
 *   Décor fictif, paie le 27, jeudi 12 nov. 2026 :
 *     • salaire 20 000 → « Compte Salaire » ; magasin 2 000 → Compte Courant ;
 *     • charges fixes : compte par défaut = Compte Salaire ; Crédit 5 000 ; Prêt 3 000 avec une exception
 *       à 0 toute l'année ; Syndic 400 sur « Compte Épargne » (son propre compte) — tous portent encore le
 *       champ mort sourceCompte: 'courant' ;
 *     • courses : Marjane 700 / sem, depuis le Courant ; épargne Urgence 1 000 / mois, Courant → Compte Épargne.
 *   Calculs faits à la main :
 *     • novembre (27 oct. → 26 nov., 31 j) : Marjane 700 × 31 / 7 = 3 100 ;
 *     • décembre (27 nov. → 26 déc., 30 j) : le Courant encaisse 2 000 et paie 700 × 30 / 7 = 3 000
 *       + 1 000 d'épargne = 4 000 → 2 000 à virer ; le Compte Salaire reçoit 20 000 et paie 5 000 ;
 *     • janvier et février 2027 (31 j) : 3 100 + 1 000 − 2 000 = 2 100 → virement conseillé 2 100 ;
 *       si 2027 envoie le salaire sur le Courant, l'appli le signale (alerte_donnees).
 *     A. statique · B. la lecture du moteur · C. alimentation du Courant · D. le payload envoyé au CFO ·
 *     E. le champ mort retiré (schéma 22) et la lecture enregistrée avec les données (Telegram) ·
 *     F. Annuler : 50 retours, retrouvés après rechargement ; jetés si les données ont changé ailleurs.
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
console.log('\n  LE CFO LIT LE MOTEUR · ANNULER 50 PAS PERSISTANTS\n  ' + '─'.repeat(80));

/* ── A. Statique ─────────────────────────────────────────────────────── */
v('A. le résumé du CFO ne lit plus le champ mort sourceCompte des charges',
  !/compte_source: _getLabel\(v\.sourceCompte/.test(html) && /payee_depuis: nom\(compteDeFlux\('fixe', v\)\)/.test(html) && /payee_depuis: nom\(compteDeFlux\('variable', v\)\)/.test(html));
v('  → schéma 22 ; la lecture voyage avec les données ; Annuler : 50 retours',
  /_schemaVersion: (2[2-9]|[3-9]\d),/.test(html) && /_lectureCFO: _lectureCFOSure\(\)/.test(html) && /const UNDO_MAX = 50;/.test(html));

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
    delete fx._schemaVersion;                                   // des données d'avant la v37.67
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = {};
    for (const an of [2026, 2027]) fx.donneesAnnuelles[an] = JSON.parse(JSON.stringify(base));
    Object.assign(fx.soldesInitiaux, { moisActuel: 11, anneeActuelle: 2026, jourDePaie: 27, compteChargesFixes: 'cpt_900', compteChargesVariables: 'courant',
                                       assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.soldesInitiaux.categories = [];
    fx.comptes = [{ id: 'acc_cc', label: 'Compte Courant', type: 'liquide', solde: 5000, icone: '💳' },
                  { id: 900, label: 'Compte Salaire', type: 'liquide', solde: 1000, icone: '🏦' },
                  { id: 901, label: 'Compte Épargne', type: 'epargne', solde: 0, icone: '🐷' }];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    for (const an of Object.keys(fx.donneesAnnuelles)) {
        const d = fx.donneesAnnuelles[an];
        const Rv = (label, b, j, dest) => ({ ...neutre, label, base: b, jourPrevu: j, destinationCompte: dest });
        d.revenus = { salaire: Rv('SALAIRE', 20000, 27, an === '2027' ? 'courant' : 'cpt_900'), bonif: Rv('—', 0, null, 'courant'), magasin: Rv('MAGASIN', 2000, 6, 'courant'),
                      cnss: Rv('—', 0, null, 'courant'), appart: Rv('—', 0, null, 'courant'), studio: Rv('—', 0, null, 'courant') };
        const Fx = (label, valeur, j, extra = {}) => ({ ...neutre, label, valeur, jourPrevu: j, sourceCompte: 'courant', ...extra });
        d.chargesFixes = { creditImmo: Fx('CRÉDIT', 5000, 1), creditStudio: Fx('PRÊT', 3000, 1, { exceptions: [{ id: 1, moisDebut: 1, moisFin: 12, nouvelleValeur: 0 }] }),
                           syndic: Fx('SYNDIC', 400, 5, { compte: 'cpt_901' }), nounou: Fx('—', 0), ecole: Fx('—', 0), femmeMenage: Fx('—', 0),
                           habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
        d.chargesVariables = {
            alimentation: { ...neutre, label: 'Courses', valeur: 0, periode: 'semaine', categorieId: 'cat_cv_alimentation', sourceCompte: 'courant',
                            details: [{ id: 1, nom: 'Marjane', montant: 700, sourceCompte: 'courant' }] },
            factures: { ...neutre, label: 'Factures', valeur: 0, periode: 'mois', details: [], categorieId: 'cat_cv_factures', sourceCompte: 'courant' },
            //  les catégories par défaut de l'appli, neutralisées (sinon elles s'ajoutent en 2026)
            sante: { ...neutre, label: '—', valeur: 0, periode: 'semaine', details: [] },
            sorties: { ...neutre, label: '—', valeur: 0, periode: 'semaine', details: [] },
            voiture: { ...neutre, label: '—', valeur: 0, periode: 'semaine', details: [] },
        };
        d.epargne = [{ id: 77, nom: 'Urgence', label: 'Urgence', valeur: 1000, sourceCompte: 'courant', linkedAccountId: 901, exceptions: [] }];
        d.depensesIrregulieres = []; d.virementsInternes = []; d.banqueOperations = {}; d.transactionsReelles = [];
        d.consoRealiseeT0 = {}; d.consoClotureT0 = {};
    }
    return fx;
};
let enregistre = null;                                          // le « serveur » : le dernier état enregistré
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
    if (p === '/finance/finance_data.json') return s(200, enregistre || JSON.stringify(fixture()));
    if (p === '/finance/save_data.php' && req.method === 'GET' && enregistre) return s(200, enregistre);
    if (p === '/finance/save_data.php' && req.method === 'POST') {
        let b = ''; req.on('data', c => { b += c; }); req.on('end', () => { try { if (JSON.parse(b).donneesAnnuelles) enregistre = b; } catch { /* corps non JSON */ } s(200, '{"status":"ok"}'); });
        return;
    }
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
const erreurs = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date(2026, 10, 12, 10, 0, 0));
page.on('pageerror', e => erreurs.push(String(e)));
page.on('dialog', d => d.accept());
let webhook = null;
page.on('request', r => { if (/\/webhook\//.test(r.url()) && r.method() === 'POST') webhook = r.postData(); });
await page.route('**/webhook/**', route => route.abort());
const charger = async () => {
    await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
    await page.waitForTimeout(1200);
};
await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
await charger();
const lecture = () => page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST)._lectureCFO())), ST);

try {
    /* ── B. La lecture du moteur ──────────────────────────────────────── */
    await section('B', async () => {
        const L = await lecture();
        const f = (l) => L.charges_fixes.find(x => x.label === l) || {};
        v('B. CRÉDIT 5 000 et PRÊT : payés depuis « Compte Salaire » (le compte par défaut des charges fixes)',
          f('CRÉDIT').payee_depuis === 'Compte Salaire' && f('CRÉDIT').montant_ce_cycle === 5000 && f('PRÊT').payee_depuis === 'Compte Salaire', JSON.stringify(L.charges_fixes.slice(0, 3)));
        v('  → PRÊT : 0 ce cycle (exception toute l\'année), 3 000 d\'habitude ; SYNDIC : depuis son propre compte',
          f('PRÊT').montant_ce_cycle === 0 && f('PRÊT').montant_habituel === 3000 && f('SYNDIC').payee_depuis === 'Compte Épargne' && f('SYNDIC').montant_ce_cycle === 400, JSON.stringify([f('PRÊT'), f('SYNDIC')]));
        const c = L.charges_variables.find(x => x.label === 'Courses') || {};
        v('  → Courses : budget du cycle 700 × 31 / 7 = 3 100, depuis le Courant, Marjane « par semaine »',
          c.budget_ce_cycle === 3100 && c.payee_depuis === 'Compte Courant' && JSON.stringify(c.postes) === JSON.stringify([{ nom: 'Marjane', montant: 700, rythme: 'par semaine' }]), JSON.stringify(c));
        const r = (l) => L.revenus_fixes.find(x => x.label === l) || {};
        v('  → SALAIRE 20 000 arrive sur « Compte Salaire », MAGASIN 2 000 sur le Courant ; épargne Urgence : Courant → Compte Épargne',
          r('SALAIRE').arrive_sur === 'Compte Salaire' && r('SALAIRE').montant_ce_cycle === 20000 && r('MAGASIN').arrive_sur === 'Compte Courant'
          && JSON.stringify(L.epargne_recurrente) === JSON.stringify([{ label: 'Urgence', montant_ce_cycle: 1000, depuis: 'Compte Courant', vers: 'Compte Épargne' }]), JSON.stringify([L.revenus_fixes.slice(0, 3), L.epargne_recurrente]));
        v('  → la règle de lecture interdit le × 4,33 et renvoie à alimentation_du_courant',
          /ne multiplie JAMAIS une semaine par 4,33/.test(L.regle) && /alimentation_du_courant/.test(L.regle) && L.cycle_en_cours === 'Novembre 2026 (du 27 oct. 2026 au 26 nov. 2026)', L.regle);
    });

    /* ── C. Alimentation du Courant ───────────────────────────────────── */
    await section('C', async () => {
        //  v37.68 : le chargement remet le salaire des années suivantes sur son compte (correction approuvée) ;
        //  on le renvoie ici sur le Courant pour 2027, comme une modification faite après coup
        await page.evaluate((ST) => { eval(ST).donneesAnnuelles[2027].revenus.salaire.destinationCompte = 'courant'; }, ST);
        await page.waitForTimeout(400);
        let A = (await lecture()).alimentation_du_courant;
        const [dec, jan, fev] = A.cycles_suivants;
        v('C. décembre : le Courant encaisse 2 000, paie 3 000 + 1 000 → 2 000 à virer depuis « Compte Salaire »',
          A.compte_du_salaire === 'Compte Salaire' && dec.cycle === 'Décembre 2026 (du 27 nov. 2026 au 26 déc. 2026)' && dec.entrees_propres_du_courant === 2000
          && dec.sorties_du_courant === 4000 && dec.a_virer_vers_courant === 2000 && dec.compte_du_salaire_entrees === 20000 && dec.compte_du_salaire_sorties === 5000, JSON.stringify(dec));
        v('  → 2027 envoie le salaire sur le Courant : janvier n\'a rien à virer, et l\'appli le signale',
          jan.a_virer_vers_courant === 0 && /2026 → Compte Salaire, 2027 → Compte Courant/.test(A.alerte_donnees || '') && A.virement_permanent_conseille === 2000, JSON.stringify([jan, A.alerte_donnees]));
        await page.evaluate((ST) => { eval(ST).donneesAnnuelles[2027].revenus.salaire.destinationCompte = 'cpt_900'; }, ST);
        await page.waitForTimeout(400);
        A = (await lecture()).alimentation_du_courant;
        v('  → salaire remis sur « Compte Salaire » en 2027 : janvier et février 3 100 + 1 000 − 2 000 = 2 100 ; conseillé 2 100, plus d\'alerte',
          A.cycles_suivants[1].a_virer_vers_courant === 2100 && A.cycles_suivants[2].a_virer_vers_courant === 2100 && A.virement_permanent_conseille === 2100 && A.alerte_donnees === null,
          JSON.stringify([A.cycles_suivants.map(x => x.a_virer_vers_courant), A.alerte_donnees]));
        v('  → le cycle en cours : le solde d\'aujourd\'hui (5 000) compte, rien à virer', A.cycle_en_cours.solde_du_courant_aujourdhui === 5000 && A.cycle_en_cours.a_virer_vers_courant === 0, JSON.stringify(A.cycle_en_cours));
        void fev;
    });

    /* ── D. Le payload envoyé au CFO ──────────────────────────────────── */
    await section('D', async () => {
        await page.evaluate((ST) => { const st = eval(ST); st.cfoWebhookUrl = location.origin + '/webhook/cfo'; st.consulterCFO('combien virer ?'); }, ST);
        await page.waitForTimeout(2500);
        const P = webhook ? JSON.parse(webhook).finance_data : null;
        v('D. envoyé au CFO : aucune charge fixe « Compte Courant », le PRÊT à 0, Courses 3 100 — plus de montant_mensuel brut',
          !!P && !P.charges_fixes.some(x => x.payee_depuis === 'Compte Courant') && P.charges_fixes.find(x => x.label === 'PRÊT').montant_ce_cycle === 0
          && P.charges_variables.find(x => x.label === 'Courses').budget_ce_cycle === 3100 && !/montant_mensuel/.test(JSON.stringify(P.charges_fixes.concat(P.charges_variables))), P ? JSON.stringify(P.charges_fixes.slice(0, 3)) : 'aucun envoi');
        v('  → il porte alimentation_du_courant (conseillé 2 100) et la règle dans instruction_lecture',
          !!P && P.alimentation_du_courant.virement_permanent_conseille === 2100 && /4,33/.test(P.instruction_lecture) && P.epargne_recurrente.length === 1, P ? P.instruction_lecture.slice(-200) : '');
    });

    /* ── E. Schéma 22 et lecture enregistrée ──────────────────────────── */
    await section('E', async () => {
        await page.waitForTimeout(2600);
        const E = enregistre ? JSON.parse(enregistre) : null;
        const d = E && E.donneesAnnuelles['2026'];
        v('E. enregistré : schéma 22 ou plus, plus de sourceCompte sur les charges (ni leurs postes) ; l\'épargne garde le sien',
          !!E && E._schemaVersion >= 22 && !Object.values(d.chargesFixes).some(c => 'sourceCompte' in c) && !Object.values(d.chargesVariables).some(c => 'sourceCompte' in c || (c.details || []).some(p => 'sourceCompte' in p))
          && d.epargne[0].sourceCompte === 'courant' && d.chargesFixes.syndic.compte === 'cpt_901', E ? String(E._schemaVersion) : 'rien enregistré');
        v('  → la lecture du CFO voyage avec les données (pour Telegram, qui lit ce fichier brut)',
          !!E && E._lectureCFO && E._lectureCFO.alimentation_du_courant.virement_permanent_conseille === 2100 && E._lectureCFO.charges_fixes[0].payee_depuis === 'Compte Salaire', E ? JSON.stringify(Object.keys(E._lectureCFO || {})) : '');
        const l1 = JSON.stringify(await lecture()); await page.clock.setFixedTime(new Date(2026, 10, 12, 10, 0, 7)); const l2 = JSON.stringify(await lecture());
        v('  → à données égales, lecture identique (sans horodatage) : un onglet rechargé qui ré-enregistre ne crée pas de conflit', l1 === l2, l1 === l2 ? '' : 'diffère');
        const n = await page.evaluate((ST) => { const st = eval(ST), D = (v) => ({ ...(v ? { _schemaVersion: v } : {}), donneesAnnuelles: { 2026: { chargesFixes: { a: { sourceCompte: 'courant' } }, chargesVariables: { b: { sourceCompte: 'courant', details: [{ sourceCompte: 'courant' }] } }, epargne: [{ sourceCompte: 'courant' }] } } });
            const a = D(21), b = D(22); return [st.purgerSourceCompteCharges(a), st.purgerSourceCompteCharges(b), a.donneesAnnuelles[2026].epargne[0].sourceCompte]; }, ST);
        v('  → la purge : 3 champs morts au schéma 21, rien au schéma 22, l\'épargne intacte', JSON.stringify(n) === JSON.stringify([3, 0, 'courant']), JSON.stringify(n));
    });

    /* ── F. Annuler ───────────────────────────────────────────────────── */
    await section('F', async () => {
        //  Un premier rechargement : le décor fictif reçoit ses champs par défaut au premier enregistrement
        //  (de vraies données déjà enregistrées par l'appli reviennent identiques — vérifié)
        await page.reload({ waitUntil: 'load' });
        await charger();
        for (let i = 0; i < 55; i++) {
            await page.evaluate(({ ST, i }) => { eval(ST).donneesAnnuelles[2026].revenus.studio.base = i + 1; }, { ST, i });
            await page.waitForTimeout(60);
        }
        await page.waitForTimeout(300);
        const n55 = await page.evaluate((ST) => eval(ST).undoCount, ST);
        v('F. 55 modifications : 50 retours disponibles (et non 30)', n55 === 50, String(n55));
        await page.waitForTimeout(3000);                         // enregistrement (2 s) + copie de la pile
        await page.reload({ waitUntil: 'load' });
        await charger();
        await page.waitForTimeout(800);
        const apres = await page.evaluate((ST) => ({ n: eval(ST).undoCount, base: eval(ST).donneesAnnuelles[2026].revenus.studio.base }), ST);
        v('  → la page rechargée : les 50 retours sont toujours là', apres.n === 50 && apres.base === 55, JSON.stringify(apres));
        await page.evaluate((ST) => eval(ST).undo(), ST);
        await page.waitForTimeout(400);
        const un = await page.evaluate((ST) => eval(ST).donneesAnnuelles[2026].revenus.studio.base, ST);
        v('  → un retour ramène la valeur d\'avant (54)', un === 54, String(un));
        //  Les données changent ailleurs (autre appareil, CFO) : la pile ne doit pas revenir par-dessus
        await page.waitForTimeout(3000);
        const E = JSON.parse(enregistre); E.donneesAnnuelles['2026'].revenus.studio.base = 999; enregistre = JSON.stringify(E);
        await page.reload({ waitUntil: 'load' });
        await charger();
        await page.waitForTimeout(800);
        const ailleurs = await page.evaluate((ST) => ({ n: eval(ST).undoCount, base: eval(ST).donneesAnnuelles[2026].revenus.studio.base }), ST);
        v('  → données modifiées ailleurs entre-temps : la pile est jetée (0 retour), rien n\'écrase 999', ailleurs.n === 0 && ailleurs.base === 999, JSON.stringify(ailleurs));
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
