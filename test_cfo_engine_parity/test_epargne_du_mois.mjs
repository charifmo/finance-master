/**
 * v37.36 — L'ÉPARGNE DU MOIS, MÊME DÉJÀ VERSÉE.
 *
 *   « Deux objectifs (2 000 + 5 000 par mois), une exception de novembre à
 *   décembre (3 000 + 2 000). Novembre et décembre affichent 5 000 ; octobre,
 *   sans exception, affiche 0 au lieu de 7 000. » Le repli sur le montant de base
 *   fonctionnait : le 0 venait des virements d'octobre POINTÉS (faits) — la modale
 *   ne montrait, pour le mois en cours, que l'épargne restant à verser.
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
console.log('\n  L\'ÉPARGNE DU MOIS, MÊME DÉJÀ VERSÉE\n  ' + '─'.repeat(80));

/* ── A. Statique ─────────────────────────────────────────────────────── */
v('la modale lit chaque objectif par l\'évaluateur unique (exception, sinon montant de base)',
  /const v = valeurEffective\(obj, obj\.valeur, mNum\);/.test(html));
v('les deux modales (bureau, téléphone) marquent l\'épargne versée', (html.match(/data-surplus-epargne-versee/g) || []).length === 2 && (html.match(/data-surplus-note-versee/g) || []).length === 2);

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
    const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'twepargne-'));
    fs.writeFileSync(path.join(tmp, 'in.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
    fs.writeFileSync(path.join(tmp, 'cfg.js'), 'module.exports={content:[' + JSON.stringify(path.join(RACINE, 'index.html')) + '],theme:{extend:{}}};');
    execFileSync(twBin, ['-c', path.join(tmp, 'cfg.js'), '-i', path.join(tmp, 'in.css'), '-o', path.join(tmp, 'out.css'), '--minify'], { stdio: 'ignore' });
    const css = fs.readFileSync(path.join(tmp, 'out.css'), 'utf8');
    return css.length > 10000 ? css : null;
});

/* ── B. Le décor : vendredi 9 oct. 2026, paie le 27 → mois en cours = octobre.
     Courant 20 000 · LOYER 4 000 le 5 (pas encore pointé) · aucun revenu, aucune conso.
     Objectif A : 2 000 / mois, 3 000 de novembre à décembre ; Objectif B : 5 000, 2 000
     de novembre à décembre. Tous deux depuis le Courant, liés à l'Épargne Long Terme.
       octobre  : brut 20 000 − 4 000 = 16 000 · épargne 2 000 + 5 000 = 7 000 · net 9 000
       nov., déc. : brut − 4 000 · épargne 3 000 + 2 000 = 5 000 · net − 9 000
       2027, hors exception : épargne 7 000 ; novembre 2027 : 5 000
     Quoi qu'on ait déjà versé en octobre, son net reste 9 000 : ce qui sort du solde réel
     est remis au brut, et retiré une seule fois. */
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
        { id: 1, label: 'Compte Courant', type: 'courant', solde: 20000, icone: '💳' },
        { id: 2, label: 'Épargne Long Terme', type: 'epargne', solde: 50000, icone: '🏦' },
    ];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    for (const an of Object.keys(fx.donneesAnnuelles)) {
        const d = fx.donneesAnnuelles[an];
        const Rv = (label) => ({ ...neutre, label, base: 0, jourPrevu: JDP, destinationCompte: 'courant' });
        d.revenus = { salaire: Rv('SALAIRE'), bonif: Rv('—'), magasin: Rv('—'), cnss: Rv('—'), appart: Rv('—'), studio: Rv('—') };
        const Fx = (label, valeur, j) => ({ ...neutre, label, valeur, jourPrevu: j });
        d.chargesFixes = Object.fromEntries(['creditImmo', 'creditStudio', 'syndic', 'nounou', 'ecole', 'femmeMenage', 'habitsCharif', 'habitsBebe', 'jouets']
            .map((k, i) => [k, i === 0 ? Fx('LOYER', 4000, 5) : Fx('—', 0)]));
        const V = (label, periode) => ({ ...neutre, label, valeur: 0, periode, details: [], showDetails: false });
        d.chargesVariables = { alimentation: V('COURSES', 'semaine'), sorties: V('SORTIES', 'semaine'), voiture: V('—', 'semaine'), sante: V('—', 'semaine'),
                               factures: { ...V('FACTURES', 'mois'), categorieId: 'cat_cv_factures' } };
        d.epargne = [
            { id: 11, nom: 'Objectif A', valeur: 2000, sourceCompte: 'courant', linkedAccountId: 2, jourPrevu: 30, exceptions: [{ id: 1, moisDebut: 11, moisFin: 12, nouvelleValeur: 3000 }] },
            { id: 12, nom: 'Objectif B', valeur: 5000, sourceCompte: 'courant', linkedAccountId: 2, jourPrevu: 30, exceptions: [{ id: 2, moisDebut: 11, moisFin: 12, nouvelleValeur: 2000 }] },
        ];
        d.depensesIrregulieres = []; d.virementsInternes = []; d.transactionsReelles = []; d.consoRealiseeT0 = {};
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


//  La modale « Surplus Détaillé » (le calcul), le KPI, et ce qu'écrit le Relevé d'octobre
const lire = (page) => page.evaluate((ST) => {
    const st = eval(ST);
    const sp = Object.fromEntries(st.surplusParMois.filter(r => !r.isPast).map(r => [r.mNum, { brut: Math.round(r.brut), ep: r.epargne, versee: r.epargneVersee, net: Math.round(r.net) }]));
    const rel = st.atterrissageCycle.comptes.flatMap(c => c.lignes.filter(l => /Objectif/.test(l.libelle)).map(l => [c.key, l.type, l.montant]));
    return { sp, kpi: st.epargneTotaleFinal, rel };
}, ST);
//  La modale telle qu'elle s'affiche
const modale = (page) => page.evaluate(() => {
    const cell = (m) => document.querySelector('[data-surplus-epargne][data-mois="' + m + '"]');
    const c10 = cell(10);
    return { oct: c10 ? c10.textContent.replace(/\s+/g, '') : null, coche: !!(c10 && c10.querySelector('[data-surplus-epargne-versee]')),
             titre: c10 ? (c10.getAttribute('title') || '').replace(/\s+/g, '') : null, nov: cell(11) ? cell(11).textContent.replace(/\s+/g, '') : null,
             note: document.querySelector('[data-surplus-note-versee]')?.textContent.replace(/\s+/g, ' ').trim() || null };
});
const ouvrirModale = async (page) => {
    await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'previsionnel'; await new Promise(r => setTimeout(r, 250)); st.anneeAffichage = 2026; st.activeTab = 'dashboard'; st.showSurplusTooltip = true; await new Promise(r => setTimeout(r, 400)); }, ST);
};
const auPilotageReel = (page) => page.evaluate(async (ST) => { const st = eval(ST); st.showSurplusTooltip = false; st.appMode = 'reel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'pilotage'; await new Promise(r => setTimeout(r, 400)); }, ST);
const soldeCourant = (page, x) => page.evaluate(async ({ ST, x }) => { const st = eval(ST); st.comptes.find(c => c.id === 1).solde = x; st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 300)); }, { ST, x });

try {
    const { page, erreurs } = await ouvrir(SC);
    /* ══ C. RIEN DE VERSÉ : le montant de base s'applique hors exception ══ */
    let m = await lire(page);
    v('C. octobre (sans exception) : épargne 7 000 = 2 000 + 5 000 — le montant de base',
      m.sp[10] && m.sp[10].ep === 7000 && m.sp[10].versee === 0 && m.sp[10].brut === 16000 && m.sp[10].net === 9000, JSON.stringify(m.sp[10]));
    v('  → novembre et décembre (exception) : 3 000 + 2 000 = 5 000, net − 9 000',
      [11, 12].every(k => m.sp[k] && m.sp[k].ep === 5000 && m.sp[k].brut === -4000 && m.sp[k].net === -9000), JSON.stringify([m.sp[11], m.sp[12]]));
    v('  → KPI « Épargne générée (2026) » : 7 000 + 5 000 + 5 000 = 17 000', m.kpi === 17000, String(m.kpi));
    v('  → le Relevé d\'octobre porte les deux virements (2 000 et 5 000)',
      JSON.stringify(m.rel.filter(x => x[1] === 'debit').map(x => x[2]).sort((a, b) => a - b)) === '[2000,5000]', JSON.stringify(m.rel));
    const an2027 = await page.evaluate(async (ST) => { const st = eval(ST); st.anneeAffichage = 2027; await new Promise(r => setTimeout(r, 200));
        const r = Object.fromEntries(st.surplusParMois.map(x => [x.mNum, x.epargne])); st.anneeAffichage = 2026; await new Promise(r => setTimeout(r, 200)); return r; }, ST);
    v('  → en 2027, hors exception (janvier, juin) : 7 000 ; novembre 2027 : 5 000',
      an2027[1] === 7000 && an2027[6] === 7000 && an2027[11] === 5000, JSON.stringify(an2027));

    /* ══ D. LES DEUX VIREMENTS D'OCTOBRE POINTÉS (le cas rapporté) ═════ */
    await page.click('#pilotage-inbox [data-tiroir="epargne"] > summary'); await page.waitForTimeout(200);
    for (const nom of ['Objectif A', 'Objectif B']) {
        await page.locator('#pilotage-inbox [data-tiroir="epargne"] [data-tache]').filter({ hasText: nom }).locator('input[type=checkbox]').click();
        await page.waitForTimeout(650);
    }
    await soldeCourant(page, 13000);              // la banque les a exécutés : 20 000 − 7 000
    m = await lire(page);
    v('D. pointés et versés : octobre affiche toujours 7 000 d\'épargne (plus 0), dont 7 000 versés',
      m.sp[10].ep === 7000 && m.sp[10].versee === 7000, JSON.stringify(m.sp[10]));
    v('  → brut 13 000 + 7 000 − 4 000 = 16 000 ; net 9 000 — comme avant le virement',
      m.sp[10].brut === 16000 && m.sp[10].net === 9000 && m.sp[10].brut - m.sp[10].ep === m.sp[10].net, JSON.stringify(m.sp[10]));
    v('  → KPI toujours 17 000 ; le Relevé ne les reprojette pas (déjà dans les soldes)', m.kpi === 17000 && m.rel.length === 0, JSON.stringify([m.kpi, m.rel]));
    await ouvrirModale(page);
    let mo = await modale(page);
    v('  → la modale : « -7 000 DH ✓ », avec ce qui est versé au survol',
      mo.oct === '-' + nf(7000) + 'DH✓' && mo.coche && (mo.titre || '').includes('7000DHdéjàversés') && mo.nov === '-' + nf(5000) + 'DH', JSON.stringify(mo));
    v('  → et le dit en une ligne sous le tableau', /^✓ Octobre : 7\s?000 DH d'épargne déjà versés/.test(mo.note || ''), String(mo.note));
    await auPilotageReel(page);

    /* ══ E. UNE AVANCE : 1 000 sur l'Objectif B ═══════════════════════════ */
    await page.click('#pilotage-inbox [data-deja-valide] > summary'); await page.waitForTimeout(200);
    await page.locator('#pilotage-inbox [data-deja-valide] [data-valide]').filter({ hasText: 'Objectif B' }).locator('input[type=checkbox]').click();
    await page.waitForTimeout(650);
    if (!(await page.evaluate(() => document.querySelector('#pilotage-inbox [data-tiroir="epargne"]')?.open))) { await page.click('#pilotage-inbox [data-tiroir="epargne"] > summary'); await page.waitForTimeout(200); }
    await page.locator('#pilotage-inbox [data-tiroir="epargne"] [data-tache]').filter({ hasText: 'Objectif B' }).locator('input[type=number]').fill('1000');
    await page.waitForTimeout(300);
    await soldeCourant(page, 17000);              // 20 000 − 2 000 (A) − 1 000 (avance B)
    m = await lire(page);
    v('E. A versé, 1 000 d\'avance sur B : 3 000 versés sur 7 000, et le net reste 9 000',
      m.sp[10].ep === 7000 && m.sp[10].versee === 3000 && m.sp[10].brut === 16000 && m.sp[10].net === 9000, JSON.stringify(m.sp[10]));
    await ouvrirModale(page);
    mo = await modale(page);
    v('  → la modale : 3 000 versés, 4 000 à verser (au survol)', (mo.titre || '').includes('3000DHdéjàversés') && (mo.titre || '').includes('4000DHàverser'), String(mo.titre));
    await auPilotageReel(page);

    /* ══ F. UN TRANSFERT N'EST PAS DE L'ÉPARGNE ═══════════════════════════ */
    //  Une charge fixe « Virement Assafa » (1 500) : un transfert, pas une épargne.
    //  Une charge fixe « Épargne manuelle » (1 000, suspendue en novembre) : de l'épargne
    //  codée en charge (usage ancien) — comptée, mais à sa valeur du mois.
    const kpi = (fn) => page.evaluate(async ({ ST, fn }) => { const st = eval(ST); const cf = st.donneesAnnuelles[2026].chargesFixes;
        eval(fn)(cf); st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 300));
        return { kpi: st.epargneTotaleFinal, ep: Object.fromEntries(st.surplusParMois.filter(r => !r.isPast).map(r => [r.mNum, r.epargne])) }; }, { ST, fn: String(fn) });
    let k = await kpi((cf) => { Object.assign(cf.syndic, { label: 'Virement Assafa', valeur: 1500, jourPrevu: 12 }); });
    v('F. une charge fixe « Virement Assafa » (1 500) : l\'épargne générée reste 17 000 (pas 21 500)',
      k.kpi === 17000 && k.ep[10] === 7000 && k.ep[11] === 5000, JSON.stringify(k));
    k = await kpi((cf) => { Object.assign(cf.nounou, { label: 'Épargne manuelle', valeur: 1000, jourPrevu: 12, exceptions: [{ id: 9, moisDebut: 11, moisFin: 11, nouvelleValeur: 0 }] }); });
    v('  → une charge « Épargne manuelle » (1 000, suspendue en novembre) compte à sa valeur du mois : 17 000 + 1 000 + 0 + 1 000',
      k.kpi === 19000, JSON.stringify(k));
    //  Un virement interne d'octobre (Courant → Épargne LT, 1 500) : son tiroir, pas l'épargne
    const vir = await page.evaluate(async (ST) => { const st = eval(ST);
        st.donneesAnnuelles[2026].virementsInternes.push({ id: 871, mois: 10, sourceCompte: 'courant', destinationCompte: 'cpt_2', montant: 1500 });
        st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 400));
        const nat = Object.fromEntries(st.kpiProgression.natures.map(n => [n.cle, [n.badge, n.total]]));
        return { nat, ep10: st.surplusParMois.find(r => r.mNum === 10).epargne,
                 tiroirs: [...document.querySelectorAll('#pilotage-inbox [data-tiroir]')].map(d => [d.dataset.tiroir, [...d.querySelectorAll('[data-tache-nom]')].map(e => e.textContent.trim())]) }; }, ST);
    const tv = (vir.tiroirs.find(x => x[0] === 'virement') || [null, []])[1], te = (vir.tiroirs.find(x => x[0] === 'epargne') || [null, []])[1];
    v('  → un virement interne a son tiroir « 🔄 Virements internes » ; le tiroir 💎 n\'a que l\'épargne',
      JSON.stringify(tv) === '["Virement Courant → Épargne Long Terme"]' && !te.some(n => /Virement/.test(n)), JSON.stringify(vir.tiroirs));
    v('  → la Progression le compte en « 🔄 Virement » (1 500), « 💎 Épargne » reste 7 000',
      vir.nat.virement && vir.nat.virement[0] === '🔄 Virement' && vir.nat.virement[1] === 1500 && vir.nat.epargne && vir.nat.epargne[1] === 7000, JSON.stringify(vir.nat));
    v('  → et la colonne Épargne de la modale ne bouge pas (7 000)', vir.ep10 === 7000, String(vir.ep10));
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
