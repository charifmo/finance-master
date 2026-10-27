/**
 * v37.50 — UN COMPTE PAR LIGNE, ET LE BUDGET SANS « MODE ÉDITION ».
 *
 *   « Je veux pouvoir ajouter des lignes sur chaque catégorie (ex. "Syndic magasin" en charge
 *   fixe), affecter chaque charge à un compte — pas un compte global par catégorie —, sans
 *   alourdir l'interface ; et au lieu d'un bouton, un double-clic sur chaque nom pour le changer. »
 *
 *   Décor (paie le 27, aujourd'hui 14 oct. 2026 : cycle d'octobre, du 27 sept. au 26 oct.) :
 *     comptes Courant (1), Assafa (2), Dépenses annuels (3, épargne) ;
 *     charges fixes par défaut sur Assafa : Loyer 3 000 ; « Syndic magasin » 300 → Courant ;
 *     charges variables par défaut sur le Courant : Courses 1 000 / sem ; Voiture 800 / mois → Assafa.
 *
 *     A. statique · B. les moteurs (reste à payer, Relevé, enveloppe, cartes, tâches) ·
 *     C. surplus, Météo et CFO (PHP) · D. sans choix, rien ne bouge ·
 *     E. le Budget Structurel : double-clic, ajouter, montant, compte, supprimer, épargne, comptes, mobile.
 *
 *   v37.65 : un cycle compte ses jours ÷ 7 — octobre (30 jours) : Courses 1 000 × 30 / 7 = 4 286 ;
 *   novembre (31 jours) : 1 000 × 31 / 7 = 4 429 (et non 5 × 1 000).
 */
import fs from 'node:fs';
import os from 'node:os';
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
const section = async (nom, f) => { try { await f(); } catch (e) { v(`${nom} : exécution sans exception`, false, String(e && e.stack || e).slice(0, 300)); } };
console.log('\n  UN COMPTE PAR LIGNE · LE BUDGET SANS MODE ÉDITION\n  ' + '─'.repeat(80));

/* ── A. Statique ─────────────────────────────────────────────────────── */
v('A. une seule règle : compteDeLaCharge (le compte de la ligne, sinon celui par défaut)', /const compteDeLaCharge = \(nature, item\)/.test(html) && /if \(it\.compte\) return it\.compte;/.test(html));
v('  → plus de bouton « Éditer noms » ; double-clic, « + Ajouter », puce compte', !/modeEdition = !modeEdition/.test(html) && /@dblclick="commencerRenommer\(/.test(html) && /data-ajouter-ligne=/.test(html) && /data-compte-ligne/.test(html));
const php = fs.readFileSync(path.join(RACINE, 'cfo_intent_engine.php'), 'utf8');
v('  → le CFO (PHP) lit le compte de chaque ligne', /oget\(\$f, 'compte'\) \?: oget\(\$si, 'compteChargesFixes', 'courant'\)/.test(php) && /oget\(\$cv, 'compte'\) \?: oget\(\$si, 'compteChargesVariables', 'courant'\)/.test(php));

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

/* ── Le décor ────────────────────────────────────────────────────────── */
const fixture = () => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = {};
    for (const an of [2026, 2027]) fx.donneesAnnuelles[an] = JSON.parse(JSON.stringify(base));
    Object.assign(fx.soldesInitiaux, { moisActuel: 10, anneeActuelle: 2026, jourDePaie: 27, compteChargesFixes: 'cpt_2', compteChargesVariables: 'courant',
                                       assurances_tracker: [], voyageDebut: '', voyageFin: '', categories: [] });
    fx.comptes = [{ id: 1, label: 'Compte Courant', type: 'courant', solde: 20000, icone: '💳' },
                  { id: 2, label: 'Assafa', type: 'liquide', solde: 5000, icone: '🏦' },
                  { id: 3, label: 'Dépenses annuels', type: 'epargne', solde: 9000, icone: '💰' }];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    for (const an of Object.keys(fx.donneesAnnuelles)) {
        const d = fx.donneesAnnuelles[an];
        const Rv = (label, b) => ({ ...neutre, label, base: b, jourPrevu: 27, destinationCompte: 'courant' });
        d.revenus = { salaire: Rv('SALAIRE', 20000), bonif: Rv('—', 0), magasin: Rv('—', 0), cnss: Rv('—', 0), appart: Rv('—', 0), studio: Rv('—', 0) };
        const Fx = (label, valeur, extra = {}) => ({ ...neutre, label, valeur, jourPrevu: 5, sourceCompte: 'courant', ...extra });
        d.chargesFixes = { loyer: Fx('Loyer', 3000), syndicMag: Fx('Syndic magasin', 300, { compte: 'courant' }) };
        //  les lignes par défaut de l'application, à zéro
        for (const k of ['creditImmo', 'creditStudio', 'syndic', 'nounou', 'ecole', 'femmeMenage', 'habitsCharif', 'habitsBebe', 'jouets']) d.chargesFixes[k] = Fx('—', 0);
        const V = (label, valeur, periode, extra = {}) => ({ ...neutre, label, valeur, periode, details: [], sourceCompte: 'courant', ...extra });
        d.chargesVariables = { courses: V('Courses', 1000, 'semaine'), voiture: V('Voiture', 800, 'mois', { compte: 'cpt_2' }),
                               alimentation: V('—', 0, 'semaine'), sante: V('—', 0, 'semaine'), sorties: V('—', 0, 'semaine'), factures: V('—', 0, 'mois', { categorieId: 'cat_cv_factures' }) };
        d.epargne = [{ id: 7, nom: 'Coussin', valeur: 0, sourceCompte: 'courant', exceptions: [] }];
        d.depensesIrregulieres = []; d.virementsInternes = []; d.transactionsReelles = []; d.consoRealiseeT0 = {};
    }
    return fx;
};
const page0 = html.replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
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
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.clock.setFixedTime(new Date(2026, 9, 14, 10, 0, 0));
const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
page.on('dialog', d => d.accept());
await page.goto(`http://127.0.0.1:${srv.address().port}/finance/`, { waitUntil: 'load' });
await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
await page.waitForTimeout(700);
const ev = (f, arg) => page.evaluate(`(async (st, arg) => { ${f} })(${ST}, ${JSON.stringify(arg === undefined ? null : arg)})`);
const R = (x) => Math.round(Number(x) || 0);

//  Le Relevé d'octobre (en cours) et de novembre, par compte
const releve = () => ev(`st.anneesSelectionnees.splice(0); st.moisSelectionnes.splice(0); st.anneesSelectionnees.push(2026); st.moisSelectionnes.push(10, 11);
    await new Promise(r => setTimeout(r, 150));
    const e = (st.journalHybridePourReleve || {}).entries || [];
    const somme = (cpt, cyc, re) => Math.round(e.filter(x => x.compteKey === cpt && String(x.cycle || '').startsWith(cyc) && re.test(x.libelle || '')).reduce((s, x) => s + Math.abs(Number(x.montant) || 0), 0));
    return { fixC10: somme('cpt_1', '10', /Charges Fixes/), fixA10: somme('cpt_2', '10', /Charges Fixes/), fixC11: somme('cpt_1', '11', /Charges Fixes/), fixA11: somme('cpt_2', '11', /Charges Fixes/),
             varC11: somme('cpt_1', '11', /Charges variables/), varA11: somme('cpt_2', '11', /Charges variables/), varC10: somme('cpt_1', '10', /Charges variables/), varA10: somme('cpt_2', '10', /Charges variables/),
             cycles: [...new Set(e.map(x => x.cycle))] };`);

try {
    /* ── B. Les moteurs ──────────────────────────────────────────────── */
    await section('B', async () => {
        const b = await ev(`return { fixes: st.resteAPayerFixesParCompte, total: Math.round(st.resteAPayerFixes), env: st.enveloppeConsoParCompte, envTot: Math.round(st.enveloppeConsoRestante),
            flux: [st.compteDeFlux('fixe', st.donneesAnnuelles[2026].chargesFixes.syndicMag), st.compteDeFlux('fixe', st.donneesAnnuelles[2026].chargesFixes.loyer), st.compteDeFlux('variable', st.donneesAnnuelles[2026].chargesVariables.voiture)],
            groupes: Object.fromEntries(st.resteAPayerGroupes.map(g => [g.key, { m: Math.round(g.montant), l: g.lignes.map(l => l.nom) }])),
            taches: st.tachesPilotageToutes.filter(t => /Syndic|Loyer/.test(t.libelle)).map(t => t.libelle + '>' + t.compte) };`);
        v('B. reste à payer : Loyer 3 000 sur Assafa, Syndic magasin 300 sur le Courant (Σ 3 300)',
          JSON.stringify(b.fixes) === JSON.stringify({ cpt_2: 3000, courant: 300 }) && b.total === 3300, JSON.stringify(b));
        v('  → compteDeFlux : Syndic → Courant, Loyer → Assafa (défaut), Voiture → Assafa', JSON.stringify(b.flux) === '["cpt_1","cpt_2","cpt_2"]', JSON.stringify(b.flux));
        const ec = b.env.courant || 0, ea = b.env.cpt_2 || 0;
        v('  → l\'enveloppe conso par compte : Courses (1 000 × 30 / 7 × prorata) sur le Courant, Voiture (800 × prorata) sur Assafa',
          Object.keys(b.env).sort().join() === 'courant,cpt_2' && Math.abs(ec / ea - 30000 / 7 / 800) < 0.05 && Math.abs(ec + ea - b.envTot) <= 2, JSON.stringify([b.env, b.envTot]));
        v('  → cartes « reste à payer » : Assafa = Loyer + Voiture, Courant = Syndic magasin + Courses',
          b.groupes.cpt_2 && b.groupes.cpt_2.m === 3000 + ea && b.groupes.cpt_2.l.includes('Loyer') && b.groupes.cpt_2.l.includes('Voiture')
          && b.groupes.courant && b.groupes.courant.l.includes('Syndic magasin') && b.groupes.courant.l.includes('Courses') && !b.groupes.courant.l.includes('Voiture'), JSON.stringify(b.groupes));
        v('  → tâches du Pilotage : Syndic magasin → Courant, Loyer → Assafa', b.taches.some(t => /Syndic magasin>cpt_1/.test(t)) && b.taches.some(t => /Loyer>cpt_2/.test(t)), JSON.stringify(b.taches));
        const r = await releve();
        v('  → Relevé d\'octobre (en cours) : 💳 3 000 sur Assafa, 300 sur le Courant', r.fixA10 === 3000 && r.fixC10 === 300, JSON.stringify(r));
        v('  → Relevé de novembre : fixes 3 000 Assafa / 300 Courant ; variables 1 000 × 31 / 7 = 4 429 Courant, 800 Assafa',
          r.fixA11 === 3000 && r.fixC11 === 300 && r.varC11 === 4429 && r.varA11 === 800, JSON.stringify(r));
        v('  → et en octobre, l\'enveloppe restante de chaque compte, semaine par semaine', Math.abs(r.varC10 - ec) <= 1 && Math.abs(r.varA10 - ea) <= 1, JSON.stringify([r.varC10, r.varA10, ec, ea]));
    });

    /* ── C. Surplus, Météo, CFO ──────────────────────────────────────── */
    await section('C', async () => {
        const mesure = () => ev(`st.anneeAffichage = 2026; await new Promise(r => setTimeout(r, 200));
            const s = st.surplusParMois.find(x => x.mNum === 11); const m = st.respirationDuMois(2026, 11);
            return { brut: Math.round(s.brut), net: Math.round(s.net), marge: Math.round(m.marge), hors: m.horsPerimetreSorties,
                     fd: JSON.parse(JSON.stringify({ soldesInitiaux: st.soldesInitiaux, donneesAnnuelles: st.donneesAnnuelles, comptes: st.comptes })) };`);
        const netPhp = (fd) => { const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cpl-')), 'fd.json'); fs.writeFileSync(f, JSON.stringify(fd));
            const o = essai(() => execFileSync('php', ['-r', `require '${path.join(RACINE, 'cfo_intent_engine.php')}'; $fd = json_decode(file_get_contents('${f}')); cfo_sanitize_finance_data($fd); echo json_encode(array_column(cfo_compute_monthly_net_courant($fd, 2026), 'net', 'mois'));`], { encoding: 'utf8' }));
            return o ? Math.round(JSON.parse(o)[11]) : null; };
        //  Novembre, à la main : 20 000 − 3 000 − 300 − 1 000 × 31 / 7 (4 429) − 800 = 11 471 (Courant et Assafa : fonctionnement)
        const a = await mesure();
        v('C. surplus de novembre : 20 000 − 3 000 − 300 − 4 429 − 800 = 11 471 ; la Météo dit pareil', a.brut === 11471 && a.net === 11471 && a.marge === 11471, JSON.stringify({ ...a, fd: undefined }));
        const pa = netPhp(a.fd);
        v('  → le CFO (PHP) aussi : 11 471', pa === 11471, String(pa));
        await ev(`st.choisirCompteLigne('chargesFixes', 'syndicMag', 'cpt_3');`);
        const b = await mesure();
        v('  → « Syndic magasin » payé par les Dépenses annuels (épargne) : hors du brut (11 771), à part dans la Météo (300)',
          b.brut === 11771 && b.marge === 11771 && b.hors === 300, JSON.stringify({ ...b, fd: undefined }));
        const pb = netPhp(b.fd);
        v('  → le CFO suit : 11 771', pb === 11771, String(pb));
        await ev(`st.choisirCompteLigne('chargesFixes', 'syndicMag', 'courant');`);
    });

    /* ── D. Sans choix, rien ne bouge ────────────────────────────────── */
    await section('D', async () => {
        await ev(`st.choisirCompteLigne('chargesFixes', 'syndicMag', ''); st.choisirCompteLigne('chargesVariables', 'voiture', '');`);
        const d = await ev(`return { f: st.resteAPayerFixesParCompte, e: Object.keys(st.enveloppeConsoParCompte), en: Math.round(Object.values(st.enveloppeConsoParCompte)[0] || 0), tot: Math.round(st.enveloppeConsoRestante),
            ans: Object.keys(st.donneesAnnuelles).map(a => 'compte' in st.donneesAnnuelles[a].chargesFixes.syndicMag) };`);
        v('D. « par défaut » : la clé disparaît (2026 et 2027), tout revient au compte de la famille ; l\'enveloppe entière, au dirham',
          JSON.stringify(d.f) === JSON.stringify({ cpt_2: 3300 }) && d.e.join() === 'courant' && d.en === d.tot && d.ans.every(x => x === false), JSON.stringify(d));
        await ev(`st.choisirCompteLigne('chargesFixes', 'syndicMag', 'courant'); st.choisirCompteLigne('chargesVariables', 'voiture', 'cpt_2');`);
    });

    /* ── E. Le Budget Structurel ─────────────────────────────────────── */
    await section('E', async () => {
        await ev(`st.appMode = 'previsionnel'; await new Promise(r => setTimeout(r, 300)); st.activeTab = 'parametres'; st.anneeAffichage = 2026;`);
        await page.waitForTimeout(600);
        //  Double-clic, Échap : rien ; double-clic, Entrée : renommé, 2027 aussi
        await page.dblclick('[data-ligne="chargesFixes:loyer"]'); await page.keyboard.press('Control+A'); await page.keyboard.type('Bidon'); await page.keyboard.press('Escape'); await page.waitForTimeout(150);
        const e1 = await ev(`return [st.donneesAnnuelles[2026].chargesFixes.loyer.label, !!document.querySelector('[data-nom-edition]')];`);
        await page.dblclick('[data-ligne="chargesFixes:loyer"]'); await page.keyboard.press('Control+A'); await page.keyboard.type('Loyer magasin'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
        const e2 = await ev(`return [2026, 2027].map(a => st.donneesAnnuelles[a].chargesFixes.loyer.label);`);
        v('E. double-clic + Échap : rien ne change ; double-clic + Entrée : « Loyer magasin », en 2026 et 2027', e1[0] === 'Loyer' && !e1[1] && JSON.stringify(e2) === '["Loyer magasin","Loyer magasin"]', JSON.stringify([e1, e2]));
        //  Ajouter une charge fixe : le nom se tape tout de suite
        await page.click('[data-ajouter-ligne="chargesFixes"]'); await page.waitForTimeout(250);
        await page.keyboard.press('Control+A'); await page.keyboard.type('Assurance local'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
        const cle = await ev(`return Object.keys(st.donneesAnnuelles[2026].chargesFixes).find(k => st.donneesAnnuelles[2026].chargesFixes[k].label === 'Assurance local');`);
        const e3 = await ev(`return [2026, 2027].map(a => { const x = st.donneesAnnuelles[a].chargesFixes[arg]; return x && [x.label, x.valeur, 'sourceCompte' in x, x.categorieId]; });`, cle);
        v('  → « + Ajouter une charge fixe » : la ligne naît en 2026 ET 2027, son nom tapé aussitôt, sans faux compte « courant »',
          !!cle && e3.every(x => x && x[0] === 'Assurance local' && x[1] === 0 && x[2] === false && /^cat_cf_/.test(x[3])), JSON.stringify([cle, e3]));
        //  Le montant tapé rejoint 2027 (encore à 0), sans écraser un montant déjà saisi
        const champ = page.locator(`[data-ligne="chargesFixes:${cle}"]`).locator('xpath=ancestor::div[contains(@class,"justify-between")][1]//input[@type="number"]').first();
        await champ.fill('450'); await champ.press('Tab'); await page.waitForTimeout(200);
        await ev(`st.donneesAnnuelles[2027].chargesFixes.loyer.valeur = 3500;`);
        const loyer = page.locator('[data-ligne="chargesFixes:loyer"]').locator('xpath=ancestor::div[contains(@class,"justify-between")][1]//input[@type="number"]').first();
        await loyer.fill('3100'); await loyer.press('Tab'); await page.waitForTimeout(200);
        const e4 = await ev(`return [st.donneesAnnuelles[2027].chargesFixes[arg].valeur, st.donneesAnnuelles[2027].chargesFixes.loyer.valeur];`, cle);
        v('  → montant 450 : repris en 2027 (qui était à 0) ; Loyer 3 100 : 2027 garde ses 3 500', e4[0] === 450 && e4[1] === 3500, JSON.stringify(e4));
        //  Le compte de la ligne
        await page.selectOption(`select[data-compte-ligne][data-ligne="chargesFixes:${cle}"]`, 'courant'); await page.waitForTimeout(200);
        const e5 = await ev(`return { c: [2026, 2027].map(a => st.donneesAnnuelles[a].chargesFixes[arg].compte), f: st.resteAPayerFixesParCompte,
            def: [...document.querySelector('select[data-compte-ligne][data-ligne="chargesFixes:loyer"]').options].map(o => o.textContent.trim())[0] };`, cle);
        v('  → puce compte : « Assurance local » → Compte Courant (2026 et 2027 ; reste Courant 300 + 450) ; la puce du Loyer dit « Assafa · par défaut »',
          JSON.stringify(e5.c) === '["courant","courant"]' && e5.f.courant === 300 + 450 && e5.def === '🏦 Assafa · par défaut', JSON.stringify(e5));
        //  Supprimer : dans les options de la ligne, confirmé, 2026 et 2027
        v('  → Scinder / Supprimer n\'encombrent plus la ligne (cachés tant que ses options sont fermées)', !(await page.$(`[data-supprimer-ligne]`)), '');
        await page.click(`[data-ligne="chargesFixes:${cle}"] >> xpath=ancestor::div[contains(@class,"justify-between")][1]//button[contains(., "Gérer")]`); await page.waitForTimeout(200);
        await page.click('[data-supprimer-ligne]'); await page.waitForTimeout(250);
        const e6 = await ev(`return [2026, 2027].map(a => arg in st.donneesAnnuelles[a].chargesFixes);`, cle);
        v('  → « 🗑 Supprimer » (options ouvertes, confirmé) : la ligne quitte 2026 et 2027', JSON.stringify(e6) === '[false,false]', JSON.stringify(e6));
        //  Revenus et charges variables : même geste
        await page.click('[data-ajouter-ligne="revenus"]'); await page.waitForTimeout(250); await page.keyboard.press('Control+A'); await page.keyboard.type('Loyer studio'); await page.keyboard.press('Enter');
        await page.click('[data-ajouter-ligne="chargesVariables"]'); await page.waitForTimeout(250); await page.keyboard.press('Control+A'); await page.keyboard.type('Animaux'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
        const e7 = await ev(`return [Object.values(st.donneesAnnuelles[2027].revenus).some(r => r.label === 'Loyer studio'), Object.values(st.donneesAnnuelles[2027].chargesVariables).some(c => c.label === 'Animaux')];`);
        v('  → revenus et charges variables : « + Ajouter » et le nom tapé, jusqu\'en 2027', e7[0] && e7[1], JSON.stringify(e7));
        //  Épargne et comptes : double-clic aussi
        await page.dblclick('[data-ligne="epargne:7"]'); await page.keyboard.press('Control+A'); await page.keyboard.type('Coussin de sécurité'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
        await page.dblclick('[data-ligne="compte:2"]'); await page.keyboard.press('Control+A'); await page.keyboard.type('Assafa Bank'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
        const e8 = await ev(`return [st.donneesAnnuelles[2026].epargne[0].nom, st.donneesAnnuelles[2027].epargne[0].nom, st.comptes.find(c => c.id === 2).label];`);
        v('  → double-clic sur une épargne (2026 et 2027) et sur un compte : renommés', JSON.stringify(e8) === '["Coussin de sécurité","Coussin de sécurité","Assafa Bank"]', JSON.stringify(e8));
        v('  → l\'aide « ✎ double-clic sur un nom pour le renommer » remplace le bouton', !!(await page.$('[data-aide-double-clic]')) && !(await page.$('button:has-text("Editer Noms")')), '');
        //  Mobile : même puce, dans l'encart « ← Prélevé sur »
        await page.setViewportSize({ width: 400, height: 900 }); await page.waitForTimeout(300);
        await ev(`st.activeMobileTab = 'parametres';`); await page.waitForTimeout(400);
        const mob = await ev(`return [...document.querySelectorAll('select[data-compte-ligne]')].filter(s => s.offsetParent).map(s => s.dataset.ligne + '=' + s.value);`);
        v('  → mobile : chaque charge a son choix de compte (« Syndic magasin = courant », « Voiture = cpt_2 »)',
          mob.includes('chargesFixes:syndicMag=courant') && mob.includes('chargesVariables:voiture=cpt_2'), JSON.stringify(mob));
        await page.setViewportSize({ width: 1440, height: 1000 });
        v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
    });
} catch (e) {
    v('exécution sans exception', false, String(e && e.stack || e).slice(0, 400));
} finally {
    await browser.close(); srv.close();
}
console.log('  ' + '─'.repeat(80));
console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
