/**
 * v37.18 — LOGISTIQUE BANCAIRE : où l'argent doit-il se trouver, et quand ?
 *
 *   Trois promesses, vérifiées contre le moteur du Relevé — pas contre un
 *   calcul parallèle :
 *     1. ROUTAGE  — la pastille de chaque ligne nomme le compte que le Relevé
 *                   débitera (ou créditera) pour cette ligne, sans exception.
 *     2. RADAR    — la fin d'année de chaque compte = le Relevé filtré sur ce
 *                   compte jusqu'au cycle de décembre ; « à virer » = ce qui
 *                   garde le POINT BAS à zéro. Preuve par l'acte : on fait le
 *                   virement proposé, et plus aucun compte ne passe sous zéro.
 *     3. FOCUS    — un clic filtre la file, les KPIs et le Prévisionnel sur un
 *                   compte ; la Météo reste globale.
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
console.log('\n  LOGISTIQUE BANCAIRE — ROUTAGE, RADAR DE COUVERTURE, FOCUS\n  ' + '─'.repeat(80));

v('composants pastille et radar enregistrés',
  html.includes("'chip-compte': ChipCompte") && html.includes("'radar-comptes': RadarComptes"));
v('une barre de focus dans chacun des deux onglets',
  (html.match(/data-focus-ou="realise"/g) || []).length === 1 && (html.match(/data-focus-ou="previsionnel"/g) || []).length === 1);

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
const twBin = path.join(RACINE, 'node_modules/.bin/tailwindcss');
const twCss = essai(() => {
    if (!fs.existsSync(twBin)) return null;
    const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'twlog-'));
    fs.writeFileSync(path.join(tmp, 'in.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
    fs.writeFileSync(path.join(tmp, 'cfg.js'), 'module.exports={content:[' + JSON.stringify(path.join(RACINE, 'index.html')) + '],theme:{extend:{}}};');
    execFileSync(twBin, ['-c', path.join(tmp, 'cfg.js'), '-i', path.join(tmp, 'in.css'), '-o', path.join(tmp, 'out.css'), '--minify'], { stdio: 'ignore' });
    const css = fs.readFileSync(path.join(tmp, 'out.css'), 'utf8');
    return css.length > 10000 ? css : null;
});

/* ── Le décor : deux comptes réels qui vivent différemment ──────────────── */
const maintenant = new Date();
const T = maintenant.getDate();
const jourDePaie = Math.min(28, Math.max(2, T - 1));
const Y = maintenant.getFullYear(), MC = maintenant.getMonth() + 1;
const MB = T >= jourDePaie ? (MC === 12 ? 1 : MC + 1) : MC;
const AB = (T >= jourDePaie && MC === 12) ? Y + 1 : Y;
const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
fx.donneesAnnuelles = {};
for (const an of [AB, AB + 1]) fx.donneesAnnuelles[an] = JSON.parse(JSON.stringify(base));
//  Les charges fixes sortent d'ASSAFA, qui ne reçoit qu'un petit loyer : il
//  s'épuise. Le courant reçoit le salaire et paie le reste.
Object.assign(fx.soldesInitiaux, { moisActuel: MB, anneeActuelle: AB, jourDePaie,
    compteChargesFixes: 'cpt_2', compteChargesVariables: 'courant', assurances_tracker: [] });
fx.comptes = [
    { id: 1, label: 'Compte Courant', type: 'courant', solde: 4000, icone: '💳' },
    { id: 2, label: 'Compte Assafa Test', type: 'epargne', solde: 1500, icone: '🏛️' },
    { id: 3, label: 'Livret Réserve', type: 'epargne', solde: 80000, icone: '🏦' },
];
const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
for (const an of Object.keys(fx.donneesAnnuelles)) {
    const d = fx.donneesAnnuelles[an];
    const Rv = (label, b, j, dst) => ({ ...neutre, label, base: b, jourPrevu: j, destinationCompte: dst });
    d.revenus = { salaire: Rv('SALAIRE', 20000, jourDePaie, 'courant'), bonif: Rv('—', 0, null, 'courant'), magasin: Rv('—', 0, null, 'courant'),
                  cnss: Rv('—', 0, null, 'courant'), appart: Rv('LOYER RECU ASSAFA', 1000, 5, 'cpt_2'), studio: Rv('—', 0, null, 'courant') };
    const Fx = (label, valeur, j) => ({ ...neutre, label, valeur, jourPrevu: j });
    d.chargesFixes = { creditImmo: Fx('CREDIT ASSAFA', 3000, 5), creditStudio: Fx('—', 0), syndic: Fx('SYNDIC ASSAFA', 500, 10), nounou: Fx('—', 0),
                       ecole: Fx('—', 0), femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
    const V = (label, valeur, periode) => ({ ...neutre, label, valeur, periode, details: [] });
    d.chargesVariables = { alimentation: V('COURSES', 800, 'semaine'), sante: V('—', 0, 'semaine'), sorties: V('—', 0, 'semaine'),
        voiture: V('—', 0, 'semaine'), factures: { ...V('FACTURES', 600, 'mois'), categorieId: 'cat_cv_factures', jourPrevu: 8, details: [{ id: 901, nom: 'ELECTRICITE', montant: 600 }] } };
    d.epargne = [{ id: 31, nom: 'EPARGNE MENSUELLE', valeur: 2000, sourceCompte: 'courant', jourPrevu: 3 }];
    d.depensesIrregulieres = Number(an) === AB ? [{ id: 41, mois: MB, annee: AB, nom: 'TAXE ASSAFA', montant: 700, sourceCompte: 'cpt_2' }] : [];
    d.virementsInternes = []; d.transactionsReelles = [];
}

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
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fx));
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
const ouvrir = async (opts) => {
    const page = await browser.newPage(opts);
    const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
    page.on('dialog', d => d.accept());
    await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
    await page.waitForTimeout(600);
    await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'pilotage'; }, ST);
    await page.waitForTimeout(600);
    return { page, erreurs };
};

try {
    const { page, erreurs } = await ouvrir({ viewport: { width: 1400, height: 1000 } });
    const present = await page.evaluate((ST) => !!(eval(ST).radarComptes && eval(ST).compteDeFlux), ST);
    v('radar et routage exposés', present);
    if (!present) throw new Error('ABSENT');

    /* ── 1. ROUTAGE = le compte de la ligne dans le Relevé ───────────────── */
    const routage = await page.evaluate(async (ST) => {
        const st = eval(ST);
        st.moisSelectionnes.splice(0); st.anneesSelectionnees.splice(0); st.releveComptesFiltres.splice(0);
        await new Promise(r => setTimeout(r, 50));
        const legs = st.journalHybridePourReleve.entries.filter(e => e.compteKey && e.type !== 'initial');
        const compteDuLeg = (pred) => { const l = legs.find(e => pred(e.libelle || '')); return l ? l.compteKey : null; };
        return st.tachesPilotageToutes.filter(t => !t.paye).map(t => {
            let attendu;
            if (t.nature === 'fixe') attendu = compteDuLeg(x => x.includes('Total Charges Fixes'));
            else if (t.nature === 'variable') attendu = compteDuLeg(x => x.includes('Total Factures'));
            else if (t.nature === 'epargne') attendu = compteDuLeg(x => x.includes('Transfert → ' + t.libelle));
            else attendu = compteDuLeg(x => x.includes(t.libelle));
            return { libelle: t.libelle, nature: t.nature, compte: t.compte, attendu };
        });
    }, ST);
    v('chaque ligne est routée sur le compte que le Relevé débite',
      routage.length >= 5 && routage.every(r => r.attendu && r.compte === r.attendu), JSON.stringify(routage));
    v('  → fixes sur Assafa (réglage global), taxe sur Assafa (son compte), épargne sur le courant',
      routage.filter(r => r.nature === 'fixe').every(r => r.compte === 'cpt_2')
      && routage.find(r => r.libelle === 'TAXE ASSAFA')?.compte === 'cpt_2'
      && routage.find(r => r.libelle === 'EPARGNE MENSUELLE')?.compte === 'cpt_1', JSON.stringify(routage));

    /* ── 2. RADAR = le Relevé jusqu'en décembre, compte par compte ───────── */
    const radar = await page.evaluate(async ({ ST, MB, AB }) => {
        const st = eval(ST);
        const R = JSON.parse(JSON.stringify(st.radarComptes));
        const releve = {};
        for (const c of R.comptes) {
            st.anneesSelectionnees.splice(0, st.anneesSelectionnees.length, AB);
            st.moisSelectionnes.splice(0, st.moisSelectionnes.length, ...Array.from({ length: 13 - MB }, (_, i) => MB + i));
            st.releveComptesFiltres.splice(0, st.releveComptesFiltres.length, c.key);
            await new Promise(r => setTimeout(r, 40));
            releve[c.key] = Math.round(st.journalHybridePourReleve.soldeAtterrissage);
        }
        st.moisSelectionnes.splice(0); st.anneesSelectionnees.splice(0); st.releveComptesFiltres.splice(0);
        return { R, releve };
    }, { ST, MB, AB });
    const A = radar.R.comptes.find(c => c.key === 'cpt_2'), C = radar.R.comptes.find(c => c.key === 'cpt_1');
    v('fin d\'année de chaque compte = Relevé filtré jusqu\'au cycle de décembre',
      radar.R.comptes.length === 3 && radar.R.comptes.every(c => c.fin === radar.releve[c.key]), JSON.stringify({ radar: radar.R.comptes.map(c => [c.key, c.fin]), releve: radar.releve }));
    v('  → les revenus qui tombent sur Assafa sont comptés', !!A && A.entrees > 0, JSON.stringify(A));
    v('point bas ≤ solde du jour et ≤ fin d\'année, partout',
      radar.R.comptes.every(c => c.pointBas <= c.t0 && c.pointBas <= c.fin), JSON.stringify(radar.R.comptes.map(c => [c.key, c.t0, c.pointBas, c.fin])));
    v('à virer = ce qui ramène le point bas à zéro',
      radar.R.comptes.every(c => c.aVirer === (c.pointBas < 0 ? Math.ceil(-c.pointBas) : 0)), JSON.stringify(radar.R.comptes.map(c => [c.key, c.pointBas, c.aVirer])));
    v('Assafa, qui paie sans recevoir assez, demande un virement', !!A && A.aVirer > 0 && !!A.donneur, JSON.stringify(A));

    // La preuve par l'acte : on fait les virements proposés, aujourd'hui.
    const apres = await page.evaluate(async ({ ST, R }) => {
        const st = eval(ST);
        R.comptes.filter(c => c.aVirer > 0 && c.donneur).forEach(c => {
            const cible = st.comptes.find(x => 'cpt_' + x.id === c.key), source = st.comptes.find(x => 'cpt_' + x.id === c.donneur.key);
            cible.solde = Number(cible.solde) + c.aVirer; source.solde = Number(source.solde) - c.aVirer;
        });
        st.forceUpdateCalculations();
        await new Promise(r => setTimeout(r, 150));
        const out = JSON.parse(JSON.stringify(st.radarComptes));
        return { comptes: out.comptes.map(c => [c.key, c.pointBas, c.aVirer]), besoins: out.besoins.length };
    }, { ST, R: radar.R });
    v('après les virements proposés, aucun compte ne passe sous zéro',
      apres.besoins === 0 && apres.comptes.every(([, bas]) => bas >= -1), JSON.stringify(apres));
    // On remet les soldes d'origine
    await page.evaluate(async ({ ST, soldes }) => { const st = eval(ST); st.comptes.forEach((c, i) => { c.solde = soldes[i]; }); st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 120)); },
                        { ST, soldes: fx.comptes.map(c => c.solde) });

    const meteo = await page.evaluate((ST) => eval(ST).meteoFinanciere.logistique, ST);
    v('la Météo dit le virement le plus pressant, en une ligne',
      !!meteo && meteo.includes('Compte Assafa Test') && meteo.includes(new Intl.NumberFormat('fr-FR').format(A.aVirer)), String(meteo));

    /* ── 3. Pastilles et bulle ───────────────────────────────────────────── */
    //  v37.34 : la file est en tiroirs fermés d'office — on les ouvre.
    await page.evaluate(() => document.querySelectorAll('#pilotage-inbox [data-tiroir]').forEach(d => { d.open = true; }));
    await page.waitForTimeout(200);
    const pastilles = await page.evaluate((ST) => {
        const st = eval(ST);
        const rows = [...document.querySelectorAll('#pilotage-inbox [data-tache]')];
        return { n: rows.length, ok: rows.every(r => {
            const nom = r.querySelector('[data-tache-nom]').textContent.trim();
            const t = st.tachesATraiter.find(x => x.libelle === nom);
            const chip = r.querySelector('[data-route]');
            return t && chip && chip.dataset.compteRoute === t.compte;
        }) };
    }, ST);
    v('chaque carte de la file porte la pastille de son compte', pastilles.n > 0 && pastilles.ok, JSON.stringify(pastilles));
    await page.hover('#pilotage-inbox [data-tache] [data-route]');
    await page.waitForTimeout(150);
    const bulle = await page.evaluate(() => { const b = document.querySelector('[data-bulle]'); return b ? { n: document.querySelectorAll('[data-bulle]').length, t: b.textContent.replace(/\s+/g, ' ') } : { n: 0 }; });
    v('survol de la pastille : la mécanique bancaire, dans une bulle unique',
      bulle.n === 1 && /Prélevé sur/.test(bulle.t) && /Point bas/.test(bulle.t) && /(Virer|Tranquille)/.test(bulle.t), JSON.stringify(bulle));
    await page.keyboard.press('Escape');

    /* ── 4. FOCUS ─────────────────────────────────────────────────────────── */
    const meteoAvant = await page.evaluate((ST) => JSON.stringify(eval(ST).meteoFinanciere), ST);
    await page.click('[data-focus-ou="realise"] [data-focus="cpt_2"]');
    await page.waitForTimeout(300);
    const focus = await page.evaluate((ST) => {
        const st = eval(ST);
        const pq = st.tachesGroupees;
        return {
            focus: st.focusCompte, toutes: st.tachesPilotage.every(t => t.compte === 'cpt_2'), n: st.tachesPilotage.length,
            urgence: st.kpiUrgence.montant, somme: (pq.find(p => p.cle === 'retard')?.total || 0) + (pq.find(p => p.cle === 'semaine')?.total || 0),
            atterr: st.kpiAtterrissage.montant, atterrCompte: (st.atterrissageCycle.comptes.find(c => c.key === 'cpt_2') || {}).atterrissage,
            banniere: !!document.querySelector('[data-focus-banner]'),
            entreesVisibles: [...document.querySelectorAll('details')].filter(d => /Entrées d'Argent/.test(d.textContent))
                .flatMap(d => [...d.querySelectorAll('[data-route]')].map(c => c.closest('[style*="display: none"]') ? null : c.dataset.compteRoute)).filter(Boolean),
            meteo: JSON.stringify(st.meteoFinanciere),
        };
    }, ST);
    v('focus Assafa : la file ne montre que ses lignes', focus.focus === 'cpt_2' && focus.toutes && focus.n > 0 && focus.banniere, JSON.stringify(focus));
    v('  → l\'Urgence reste la somme des paquets affichés', focus.urgence === focus.somme, JSON.stringify(focus));
    v('  → la carte Atterrissage parle d\'Assafa', focus.atterr === focus.atterrCompte, JSON.stringify(focus));
    v('  → les entrées d\'argent ne montrent que celles d\'Assafa',
      focus.entreesVisibles.length > 0 && focus.entreesVisibles.every(k => k === 'cpt_2'), JSON.stringify(focus.entreesVisibles));
    v('  → la Météo, elle, ne bouge pas', focus.meteo === meteoAvant);
    await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'previsionnel'; await new Promise(r => setTimeout(r, 200)); st.activeTab = 'pilotageTheo'; }, ST);
    await page.waitForTimeout(600);
    const theo = await page.evaluate((ST) => {
        const st = eval(ST);
        const R = st.respirationBudgetaire;
        const lignes = Object.values(R.lignes).flat();
        return { focus: st.focusCompte, tout: lignes.length > 0 && lignes.every(l => l.compte === 'cpt_2'),
                 radar: [...document.querySelectorAll('[data-radar-compte]')].map(e => e.dataset.compte),
                 chips: [...document.querySelectorAll('[data-theo-carte] [data-route]')].map(c => c.dataset.compteRoute) };
    }, ST);
    v('Prévisionnel : le focus suit (respiration, cartes, radar d\'Assafa seul)',
      theo.focus === 'cpt_2' && theo.tout && JSON.stringify(theo.radar) === '["cpt_2"]' && theo.chips.length > 0 && theo.chips.every(k => k === 'cpt_2'), JSON.stringify(theo));
    await page.click('[data-focus-banner] button');
    await page.waitForTimeout(300);
    const libre = await page.evaluate((ST) => ({ f: eval(ST).focusCompte, radar: document.querySelectorAll('[data-radar-compte]').length }), ST);
    v('« Tout afficher » rend la vue complète', libre.f === null && libre.radar === 3, JSON.stringify(libre));
    v('aucune erreur JavaScript (bureau)', erreurs.length === 0, erreurs[0] || '');
    await page.close();

    /* ── 5. Téléphone ─────────────────────────────────────────────────────── */
    if (twCss) {
        const m = await ouvrir({ viewport: { width: 384, height: 832 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        const debord = await m.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        v('S24+ : barre de focus et pastilles sans débordement', debord <= 0, String(debord));
        await m.page.evaluate(() => document.querySelectorAll('#pilotage-inbox [data-tiroir]').forEach(d => { d.open = true; }));
        await m.page.waitForTimeout(200);
        await m.page.tap('#pilotage-inbox [data-tache] [data-route]');
        await m.page.waitForTimeout(200);
        const t = await m.page.evaluate(() => { const b = document.querySelector('[data-bulle] > span'); if (!b) return null; const r = b.getBoundingClientRect(); return { g: r.left, d: r.right, w: window.innerWidth }; });
        v('  → un tap sur la pastille ouvre sa bulle, dans l\'écran', !!t && t.g >= 0 && t.d <= t.w + 0.5, JSON.stringify(t));
        v('  → aucune erreur JavaScript', m.erreurs.length === 0, m.erreurs[0] || '');
        await m.page.close();
    }
} catch (e) {
    if (e.message !== 'ABSENT') { ko++; console.log('  ❌ exception : ' + e.message.split('\n')[0]); }
} finally {
    await browser.close();
    srv.close();
}
console.log('  ' + '─'.repeat(80));
console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
