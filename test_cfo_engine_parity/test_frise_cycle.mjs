/**
 * v37.66 — « SUR TOUT LE CYCLE », LES SÉANCES « TOUTES LES 2 SEMAINES » ET LA FRISE DU CYCLE.
 *
 *   « Vérifie aussi la même chose pour les charges en demi-cycle qui franchissent le cycle d'après, il faut
 *   alerter ; et il faut un outil graphique sur le temps : le cycle, l'avancement de chaque catégorie et
 *   sous-catégorie, les chevauchements, les dépassements… à la demande. »
 *   Paie le 27. Jeudi 12 nov. 2026 : le cycle de novembre court du 27 oct. au 26 nov. (31 jours = 4 sem. 3 j),
 *   morceaux 6 + 7 + 7 + 7 + 4 jours ; on est au 17ᵉ jour.
 *   Courses : Marjane 600 / sem · Psy 400 / 15 j · Hri 1 000 / cycle. Calculs faits à la main :
 *     • Marjane : morceau de 6 jours = 600 × 6 / 7 = 514 ; saisies 700 (dépassé), 600 (tenu), 300 (en cours) ;
 *     • Psy : 31 jours ÷ 14 ≈ 2,2 séances ; enveloppe 400 × 31 / 14 = 886. Payé le 27 oct. et le 9 nov. : 800,
 *       reste 86. Prochaine séance ≈ 9 nov. + 14 j = 23 nov., AVANT la paie du 27 → elle dépasserait de
 *       400 − 86 = 314 DH. Payé le 16 nov. au lieu du 9 : prochaine ≈ 30 nov. → au cycle suivant. Une seule
 *       séance (27 oct.) : prochaine ≈ 10 nov., reste 486 ≥ 400 → couverte. Aucune : « une 3ᵉ … 1 200 − 886 = 314 ».
 *     • Hri : 1 000 / 1 000 → rien ; à 1 200 → 🔴 dépassement de 200.
 *     A. statique · B. le bloc « Sur tout le cycle » de la Météo (la semaine ne garde que ses postes / sem) ·
 *     C. l'alerte du Psy, ses quatre cas · D. la frise : axe, aujourd'hui, cases, séances, alertes ·
 *     E. elle s'ouvre et se ferme à la demande (rien n'est calculé fermée).
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
console.log('\n  SUR TOUT LE CYCLE · SÉANCES À LA QUINZAINE · FRISE DU CYCLE\n  ' + '─'.repeat(80));

/* ── A. Statique ─────────────────────────────────────────────────────── */
v('A. un bloc « Sur tout le cycle » PAR CATÉGORIE, sous ses postes de la semaine, mémorisé (uiOuvert / uiFixer), ouvert d\'office (v37.127 : « ya pas l7m ni djaj »)',
  /<details v-if="c\.sem\.postes\.length && ouverte\(c\.key\) && sm\.dansCycle && cyclePostes\(p, c\.key\)\.length" data-pulse-cycle :data-cat="c\.key" :open="uiOuvert\('meteo\.cycle\.' \+ c\.key, true\)" @toggle="uiFixer\('meteo\.cycle\.' \+ c\.key, \$event\.target\.open\)"/.test(html));
v('  → la frise s\'ouvre d\'un bouton (les 3 Météo la branchent) ; fermée, elle n\'est pas affichée (v37.77 : ses dépassements, eux, vont à la Météo)',
  /data-ouvrir-frise @click="\$emit\('frise'\)"/.test(html) && (html.match(/@frise="friseOuverte = true"/g) || []).length === 3
  && /const friseCycle = computed\(\(\) => friseOuverte\.value \? _friseCalc\.value : null\);/.test(html));
v('  → plus de note « semaine coupée » (le titre suffit)', !/data-semaine-coupee/.test(html));

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
const MARJANE = 'alimentation::1', PSY = 'alimentation::2', HRI = 'alimentation::3';
const fixture = () => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    fx._schemaVersion = 21;
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = {};
    for (const an of [2026, 2027]) fx.donneesAnnuelles[an] = JSON.parse(JSON.stringify(base));
    Object.assign(fx.soldesInitiaux, { moisActuel: 11, anneeActuelle: 2026, jourDePaie: 27, compteChargesFixes: 'courant', compteChargesVariables: 'courant',
                                       assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.soldesInitiaux.categories = [];
    fx.comptes = [{ id: 'acc_cc', label: 'Compte Courant', type: 'liquide', solde: 30000, icone: '💳' }];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    for (const an of Object.keys(fx.donneesAnnuelles)) {
        const d = fx.donneesAnnuelles[an];
        const Rv = (label, b, j) => ({ ...neutre, label, base: b, jourPrevu: j, destinationCompte: 'courant' });
        d.revenus = { salaire: Rv('SALAIRE', 20000, 27), bonif: Rv('—', 0), magasin: Rv('—', 0), cnss: Rv('—', 0), appart: Rv('—', 0), studio: Rv('—', 0) };
        const Fx = (label, valeur) => ({ ...neutre, label, valeur, jourPrevu: null });
        d.chargesFixes = { creditImmo: Fx('—', 0), creditStudio: Fx('—', 0), syndic: Fx('—', 0), nounou: Fx('—', 0),
                           ecole: Fx('—', 0), femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
        const V = (label, cat, details) => ({ ...neutre, label, valeur: 0, periode: 'semaine', categorieId: cat, details });
        d.chargesVariables = {
            alimentation: V('Courses', 'cat_cv_alimentation', [{ id: 1, nom: 'Marjane', montant: 600, periode: 'semaine' },
                                                                { id: 2, nom: 'Psy', montant: 400, periode: 'quinzaine' },
                                                                { id: 3, nom: 'Hri', montant: 1000, periode: 'cycle' }]),
            factures: { ...neutre, label: 'Factures', valeur: 0, periode: 'mois', details: [], categorieId: 'cat_cv_factures' },
        };
        d.epargne = []; d.depensesIrregulieres = []; d.virementsInternes = []; d.banqueOperations = {}; d.transactionsReelles = [];
        d.consoRealiseeT0 = an !== '2026' ? {} : {
            'S2026-10-26': { [MARJANE]: 90 },                                    // la veille de la paie : cycle d'octobre
            'S2026-10-27': { [MARJANE]: 700, [PSY]: 400, [HRI]: 1000 },          // 6 jours (27 oct. → 1ᵉʳ nov.)
            'S2026-11-02': { [MARJANE]: 600 },
            'S2026-11-09': { [MARJANE]: 300, [PSY]: 400 },                       // la semaine en cours
        };
        d.consoClotureT0 = {};
    }
    return fx;
};
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
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fixture()));
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox', '--force-prefers-reduced-motion'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
const erreurs = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date(2026, 10, 12, 10, 0, 0));
page.on('pageerror', e => erreurs.push(String(e)));
await page.route('**/webhook/**', route => route.abort());
await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
await page.waitForTimeout(600);
await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'previsionnel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'pilotageTheo'; }, ST);
await page.waitForTimeout(500);

const txt = (e) => e.textContent.replace(/\s+/g, ' ').trim();
const sansEsp = (s) => String(s || '').replace(/[\s  ]/g, '');
//  Le Psy (et Hri) tel que le bloc « Sur tout le cycle » le calcule
const cycle = () => page.evaluate((ST) => {
    const L = eval(ST).liberteCycle;
    return JSON.parse(JSON.stringify((L.postesCycle || []).map(p => ({ nom: p.nom, unite: p.unite, prevu: p.prevu, enveloppe: p.cyclePrevu, engage: p.cycleEngage,
        paiements: p.paiements, prochaine: p.prochaine, alerte: p.alerte }))));
}, ST);
const saisir = async (k, cle, val) => {
    await page.evaluate(({ ST, k, cle, val }) => {
        const r = eval(ST).donneesAnnuelles[2026].consoRealiseeT0;
        if (val === null) { if (r[k]) delete r[k][cle]; } else r[k] = { ...(r[k] || {}), [cle]: val };
    }, { ST, k, cle, val });
    await page.waitForTimeout(300);
};

try {
    /* ── B. Le bloc « Sur tout le cycle » ─────────────────────────────── */
    await section('B', async () => {
        const B = await page.evaluate((ST) => {
            const L = eval(ST).liberteCycle, c = L.categories.find(x => x.key === 'alimentation');
            return JSON.parse(JSON.stringify({ titre: L.semaine.titre, du: L.cycleDu, au: L.cycleAu, hebdo: c.sem.hebdo, postesSem: c.sem.postes.map(p => p.nom) }));
        }, ST);
        v('B. la semaine du 9 au 15 nov. ne garde que Marjane (prévu 600, engagé 300, reste 300)',
          JSON.stringify(B.postesSem.filter(n => n !== 'Psy' && n !== 'Hri')) === '["Marjane"]' && B.hebdo.budget === 600 && B.hebdo.engage === 300 && B.hebdo.reste === 300, JSON.stringify(B));
        const P = await cycle();
        v('  → sur tout le cycle : Hri 1 000 / cycle (1 000 engagés), Psy 400 / 15 j : enveloppe 886, 800 engagés',
          P.length === 2 && P.some(p => p.nom === 'Hri' && p.unite === 'cycle' && p.enveloppe === 1000 && p.engage === 1000)
          && P.some(p => p.nom === 'Psy' && p.unite === 'quinzaine' && p.enveloppe === 886 && p.engage === 800), JSON.stringify(P));
        //  le bloc vit sous la catégorie : on déplie « Alimentation » (comme l'utilisateur), il s'ouvre d'office
        await page.click('[data-pulse-ouvrir][data-cat="alimentation"]'); await page.waitForTimeout(250);
        const dom = await page.evaluate(() => {
            const b = document.querySelector('[data-pulse-cycle]');
            return b && { ouvert: b.open, resume: b.querySelector('[data-pulse-cycle-resume]')?.textContent.replace(/\s+/g, ' ').trim(),
                          lignes: [...b.querySelectorAll('[data-pulse-poste-cycle]')].map(e => e.dataset.poste),
                          alertes: [...b.querySelectorAll('[data-pulse-cycle-alerte]')].map(e => e.textContent.replace(/\s+/g, ' ').trim()),
                          note: b.querySelector('[data-pulse-cycle-quinzaine]')?.textContent.replace(/\s+/g, ' ').trim() };
        });
        v('  → ouvert d\'office sous « Alimentation » ; « 📅 Sur tout le cycle · 2 postes … · 1 800 / 1 886 DH »',
          !!dom && dom.ouvert === true && /^📅 Sur tout le cycle/.test(dom.resume) && sansEsp(dom.resume).includes('1800/1886DH') && dom.lignes.length === 2, JSON.stringify(dom));
        v('  → la ligne du Psy porte l\'alerte « ⚠️ Prochaine séance ≈ 23 nov. : elle dépasserait l\'enveloppe de 314 DH »',
          !!dom && dom.alertes.length === 1 && dom.alertes[0] === '⚠️ Prochaine séance ≈ 23 nov. : elle dépasserait l’enveloppe de 314 DH', JSON.stringify(dom && dom.alertes));
    });

    /* ── C. Le Psy : ses quatre cas ───────────────────────────────────── */
    await section('C', async () => {
        const psy = async () => (await cycle()).find(p => p.nom === 'Psy');
        let p = await psy();
        v('C. payé le 27 oct. et le 9 nov. : prochaine ≈ 23 nov., avant la paie → dépasserait de 314',
          JSON.stringify(p.paiements) === '["2026-10-27","2026-11-09"]' && p.prochaine === '2026-11-23' && p.alerte.niveau === 'depasse', JSON.stringify(p));
        await saisir('S2026-11-09', PSY, null); await saisir('S2026-11-16', PSY, 400);
        p = await psy();
        v('  → payé le 16 nov. au lieu du 9 : prochaine ≈ 30 nov. → « ↪ … : au cycle suivant »',
          p.prochaine === '2026-11-30' && p.alerte.niveau === 'suivant' && p.alerte.texte === '↪ Prochaine séance ≈ 30 nov. : au cycle suivant', JSON.stringify(p));
        await saisir('S2026-11-16', PSY, null);
        p = await psy();
        v('  → une seule séance (27 oct.) : prochaine ≈ 10 nov., reste 486 ≥ 400 → « couverte »',
          p.engage === 400 && p.prochaine === '2026-11-10' && p.alerte.niveau === 'ok' && p.alerte.texte === '↪ Prochaine séance ≈ 10 nov. : couverte', JSON.stringify(p));
        await saisir('S2026-10-27', PSY, null);
        p = await psy();
        v('  → aucune : « ≈ 2,2 séances ce cycle : une 3ᵉ avant le 26 nov. dépasserait l\'enveloppe de 314 DH » (info, sans alerte rouge)',
          p.alerte.niveau === 'info' && p.alerte.texte === '≈ 2,2 séances ce cycle : une 3ᵉ avant le 26 nov. dépasserait l’enveloppe de 314 DH', JSON.stringify(p));
        const n = await page.evaluate(() => document.querySelectorAll('[data-pulse-cycle-alerte]').length);
        v('  → l\'info ne s\'affiche pas ligne par ligne : une seule note pour le bloc', n === 0, String(n));
        await saisir('S2026-10-27', PSY, 400); await saisir('S2026-11-09', PSY, 400);
    });

    /* ── D. La frise ──────────────────────────────────────────────────── */
    await section('D', async () => {
        const fermee = await page.evaluate((ST) => eval(ST).friseCycle, ST);
        v('D. fermée : rien n\'est calculé (friseCycle = null), rien n\'est affiché', fermee === null && !(await page.$('[data-frise]')));
        await page.click('[data-ouvrir-frise]');
        await page.waitForSelector('[data-frise]', { timeout: 5000 });
        const F = await page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST).friseCycle)), ST);
        v('  → « 27 oct. → 26 nov. (31 j) », 17ᵉ jour ; morceaux 6 + 7 + 7 + 7 + 4 (le 1ᵉʳ et le dernier coupés par la paie)',
          F.du === '27 oct.' && F.au === '26 nov.' && F.jours === 31 && F.aujJ === 17 && F.morceaux.map(m => m.jours).join('+') === '6+7+7+7+4'
          && F.morceaux[0].coupe && F.morceaux[4].coupe && !F.morceaux[1].coupe && F.morceaux.map(m => m.etat).join() === 'passe,passe,encours,avenir,avenir', JSON.stringify(F.morceaux));
        const c = F.categories.find(x => x.key === 'alimentation');
        const mj = c && c.lignes.find(l => l.nom === 'Marjane');
        v('  → Marjane : 700 / 514 dépassé · 600 / 600 · 300 / 600 en cours · 600 · 343 à venir',
          !!mj && mj.cellules.map(x => x.reel + '/' + x.prevu).slice(0, 3).join(' ') === '700/514 600/600 300/600'
          && mj.cellules.map(x => x.prevu).slice(3).join() === '600,343' && mj.cellules[0].depasse && !mj.cellules[1].depasse
          && mj.cellules[2].encours && mj.cellules[3].avenir && mj.cellules[4].avenir, JSON.stringify(mj));
        const ps = c && c.lignes.find(l => l.nom === 'Psy'), hr = c && c.lignes.find(l => l.nom === 'Hri');
        v('  → Psy : payé 27 oct. et 9 nov., prochaine ≈ 23 nov. (dans le cycle), puis ≈ 7 déc. (cycle suivant)',
          !!ps && ps.seances.map(s => s.quand + ':' + s.etat).join() === '27 oct.:paye,9 nov.:paye,23 nov.:prevue,7 déc.:suivant' && ps.seances[3].pos === 100
          && ps.enveloppe === 886 && ps.engage === 800, JSON.stringify(ps));
        v('  → Hri : 1 000 / 1 000, payé le 27 oct., sans dépassement', !!hr && hr.engage === 1000 && hr.enveloppe === 1000 && !hr.depasse && hr.pct === 100, JSON.stringify(hr));
        v('  → alertes : le Psy (⚠️ 314 DH) et Marjane (🟠 700 pour 514) — pas Hri',
          JSON.stringify(F.alertes) === JSON.stringify(['⚠️ Psy : Prochaine séance ≈ 23 nov. : elle dépasserait l’enveloppe de 314 DH',
                                                       '🟠 Marjane : 700 DH pour 514 prévus (Du 27 oct. au 1 nov. · 6 j (coupé par la paie))']), JSON.stringify(F.alertes));
        v('  → une note pour les quinzaines : « ce cycle de 31 jours en couvre ≈ 2,2 fois — une 3ᵉ fois avant le 26 nov. … »',
          /^⏱️ 1 poste « toutes les 2 semaines » : ce cycle de 31 jours en couvre ≈ 2,2 fois — une 3ᵉ fois avant le 26 nov\. dépasserait leur enveloppe ; après le 26 nov\., elle compte au cycle suivant\.$/.test(F.quinzaine), F.quinzaine);
        const dom = await page.evaluate(() => {
            const f = document.querySelector('[data-frise]'), t = (e) => e && e.textContent.replace(/\s+/g, ' ').trim();
            return { titre: t(f.querySelector('[data-frise-titre]')), morceaux: f.querySelectorAll('[data-frise-morceau]').length,
                     auj: f.querySelector('[data-frise-auj]')?.style.left, alertes: f.querySelectorAll('[data-frise-alerte]').length,
                     cases: [...f.querySelectorAll('[data-frise-ligne][data-poste="alimentation::1"] [data-frise-case]')].map(e => e.dataset.etat),
                     seances: [...f.querySelectorAll('[data-frise-ligne][data-poste="alimentation::2"] [data-frise-seance]')].map(e => e.dataset.etat),
                     total: t(f.querySelector('[data-frise-categorie][data-cat="alimentation"] [data-frise-cat-total]')), legende: !!f.querySelector('[data-frise-legende]') };
        });
        v('  → l\'écran : titre, 5 morceaux, le trait d\'aujourd\'hui à 17/31, 2 alertes, la légende',
          dom.titre === '📈 Frise du cycle · 27 oct. → 26 nov. (31 j)' && dom.morceaux === 5 && Math.abs(parseFloat(dom.auj) - 17 / 31 * 100) < 0.01 && dom.alertes === 2 && dom.legende, JSON.stringify(dom));
        v('  → cases Marjane : dépassé · tenu · en cours · à venir · à venir ; séances Psy : payé · payé · prévue · suivant',
          dom.cases.join() === 'depasse,tenu,encours,avenir,avenir' && dom.seances.join() === 'paye,paye,prevue,suivant', JSON.stringify(dom));
        //  Hri à 1 200 : un vrai dépassement d'enveloppe
        await saisir('S2026-10-27', HRI, 1200);
        const A = await page.evaluate((ST) => eval(ST).friseCycle.alertes.slice(), ST);
        v('  → Hri à 1 200 : « 🔴 Hri (Courses) : 1200 DH sur une enveloppe de 1000 — dépassement de 200 DH »',
          A.includes('🔴 Hri (Courses) : 1200 DH sur une enveloppe de 1000 — dépassement de 200 DH'), JSON.stringify(A));
        await saisir('S2026-10-27', HRI, 1000);
        //  v37.128 — AUDIT Réalisé ↔ frise : ce qui est coché / ajouté dans le Réalisé (sans semaine) ne disparaît plus de la frise
        const au = await page.evaluate(async (ST) => {
            const st = eval(ST), D = st.donneesAnnuelles[2026], cv = D.chargesVariables.alimentation, det = (id) => cv.details.find(x => x.id === id);
            const tick = async () => { st.calculationTick++; await Vue.nextTick(); await new Promise(r => setTimeout(r, 30)); return JSON.parse(JSON.stringify(st.friseCycle)); };
            st.ajouterAuRegle(det(1), 2400, '+2000'); st.ajouterAuRegle(det(3), 1000, '+1200');
            D.chargesVariables.factures.valeur = 300;
            D.chargesVariables.factures.details = [{ id: 7, nom: 'Élec', montant: 300, periode: 'cycle', categorieId: 'cat_cv_factures__delec' }];
            st.calculationTick++; await Vue.nextTick();
            const F = await tick();
            st.toggleItemPaid(D.chargesVariables.factures.details[0], 300);
            const G = await tick();
            const cat = (X, k) => X.categories.find(c => c.key === k), ligne = (X, k, n) => (cat(X, k)?.lignes || []).find(l => l.nom === n);
            const dom = [...document.querySelectorAll('[data-frise-ligne][data-poste="alimentation::1"] ~ [data-frise-ecart-realise], [data-frise-ecart-realise]')].map(e => e.textContent.replace(/\s+/g, ' ').trim());
            const r = { marjane: ligne(F, 'alimentation', 'Marjane'), hri: ligne(F, 'alimentation', 'Hri'), elecAvant: ligne(F, 'factures', 'Élec')?.engage, elecApres: ligne(G, 'factures', 'Élec')?.engage,
                        realiseElec: Math.round(st.getPaidAmount(D.chargesVariables.factures.details[0], 300)), alertes: G.alertes, dom };
            delete det(1).trackerRealise; delete det(3).trackerRealise;
            D.chargesVariables.factures.valeur = 0; D.chargesVariables.factures.details = [];
            st.calculationTick++; await Vue.nextTick();
            return r;
        }, ST);
        v('  → v37.128 audit : Marjane « + 2 000 » dans le Réalisé, 1 600 tapés dans les semaines : la frise le signale (🟣 400 DH cochés sans semaine)',
          au.marjane && au.marjane.realise === 2000 && au.marjane.ecartRealise === 400 && au.alertes.some(a => /^🟣 Marjane : le Réalisé dit 2000 DH réglés, les semaines 1600 DH — 400 DH cochés dans le Réalisé sans semaine$/.test(a))
          && au.dom.some(t => /Réalisé : 2000 DH réglés — dont 400 DH cochés sans semaine/.test(t)), JSON.stringify([au.marjane, au.alertes, au.dom]));
        v('  → Hri « / cycle » à 1 200 dans le Réalisé (1 000 tapés) : la frise compte 1 200 et voit le dépassement',
          au.hri && au.hri.engage === 1200 && au.hri.depasse && au.alertes.some(a => /Hri \(Courses\) : 1200 DH sur une enveloppe de 1000/.test(a)), JSON.stringify(au.hri));
        v('  → facture « Élec » cochée dans le Réalisé (aucune opération) : 0 → 300 dans la frise, comme le Réalisé', au.elecAvant === 0 && au.elecApres === 300 && au.realiseElec === 300, JSON.stringify([au.elecAvant, au.elecApres, au.realiseElec]));
        //  v37.130 — « résolu dans la Météo, pas dans la frise » : les cases par quinzaine, dans la frise aussi
        const lireQ = () => page.evaluate(() => [...document.querySelectorAll('[data-frise-ligne][data-poste="alimentation::2"] [data-frise-quinzaine]')]
            .map(e => ({ rang: e.dataset.rang, texte: e.textContent.replace(/\s+/g, ' ').trim(), largeur: parseFloat(e.style.width) })));
        const q0 = await lireQ();
        //  v37.131 : la coupure au MILIEU des semaines (27 oct. → 8 nov. : 13 j | 9 → 26 nov. : 18 j), chaque part = 886 ÷ 2 = 443
        v('  → v37.130/131 frise : Psy a 2 cases (27 oct. → 8 nov. : 400 / 443 ; 9 → 26 nov. : 400 / 443), alignées sur les semaines (13 et 18 jours sur 31)',
          q0.length === 2 && /400 \/ 443/.test(q0[0].texte) && /400 \/ 443/.test(q0[1].texte) && Math.abs(q0[0].largeur - 13 / 31 * 100) < 0.01 && Math.abs(q0[1].largeur - 18 / 31 * 100) < 0.01, JSON.stringify(q0));
        await saisir('S2026-11-09', PSY, null);
        await page.click('[data-frise-ligne][data-poste="alimentation::2"] [data-frise-quinzaine-payee][data-rang="2"]'); await page.waitForTimeout(250);
        await page.click('[data-frise-ligne][data-poste="alimentation::2"] [data-frise-quinzaine-ouvrir][data-rang="1"]');
        await page.fill('[data-frise-quinzaine-saisie][data-rang="1"]', '450'); await page.press('[data-frise-quinzaine-saisie][data-rang="1"]', 'Enter'); await page.waitForTimeout(250);
        const q1 = await lireQ();
        const stock = await page.evaluate(() => { const r = document.querySelector('#app').__vue_app__._instance.setupState.donneesAnnuelles[2026].consoRealiseeT0;
            return ['S2026-10-27', 'S2026-11-02', 'S2026-11-09', 'S2026-11-16', 'S2026-11-23'].map(k => (r[k] || {})['alimentation::2'] ?? null); });
        v('  → 2ᵉ vidée puis ✓ : sa part (443) dans la semaine affichée (9 nov.) ; la 1ʳᵉ retapée 450 : dans UNE semaine (27 oct.)',
          /450 \/ 443/.test(q1[0].texte) && /443 \/ 443/.test(q1[1].texte) && JSON.stringify(stock) === '[450,null,443,null,null]', JSON.stringify([q1, stock]));
        await saisir('S2026-10-27', PSY, 400); await saisir('S2026-11-09', PSY, 400); await saisir('S2026-11-16', PSY, null);
    });

    /* ── E. Fermer ────────────────────────────────────────────────────── */
    /* ── F. v37.143 — « LHRRI EST VERROUILLÉ POUR CE CYCLE MAIS PAS DANS LA FRISE » et « SAMAK : 250 + 230 DANS LES CASES, 250 / 500 SUR L'ENVELOPPE » ── */
    await section('F', async () => {
        await page.evaluate((ST) => { eval(ST).friseOuverte = true; }, ST); await page.waitForTimeout(300);
        //  le cas samak : 400 tapés la 1ʳᵉ quinzaine, 300 au journal (sans rien taper) la 2ᵉ → deux achats : 700, pas max(400, 300) = 400
        await page.evaluate(({ ST, PSY }) => {
            const d = eval(ST).donneesAnnuelles[2026];
            d.chargesVariables.alimentation.details[1].categorieId = 'cat_cv_alimentation__psy';
            delete d.consoRealiseeT0['S2026-11-09'][PSY];
            d.transactionsReelles.push({ id: 'tx_psy', date: '2026-11-10', montant: 300, libelle: 'PSY', categorieId: 'cat_cv_alimentation__psy', compteId: 'acc_cc' });
            eval(ST).calculationTick++;
        }, { ST, PSY }); await page.waitForTimeout(400);
        const F1 = await page.evaluate(({ ST, PSY }) => { const S = eval(ST), p = S.liberteCycle.postesCycle.find(x => x.cle === PSY), l = S.friseCycle.categories.flatMap(c => c.lignes).find(x => x.cle === PSY);
            return JSON.parse(JSON.stringify({ meteo: p.cycleEngage, frise: l.engage, env: l.enveloppe, q: l.quinzaines.map(q => [q.saisi, q.tickets, q.prevu]) })); }, { ST, PSY });
        v('F. Psy : 400 tapés (1ʳᵉ quinzaine) + 300 au journal (2ᵉ) = 700 sur l\'enveloppe, dans la Météo ET la frise (avant : 400, le plus grand des deux sur tout le cycle)',
          F1.meteo === 700 && F1.frise === 700 && JSON.stringify(F1.q.map(q => q.slice(0, 2))) === '[[400,0],[0,300]]', JSON.stringify(F1));
        const qtxt = await page.$$eval(`[data-frise-quinzaines][data-poste="${PSY}"] [data-frise-quinzaine]`, l => l.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
        v('  → les cases : « 400 / … » et « 300 / … » — leur somme est l\'engagé de l\'enveloppe', qtxt.length === 2 && /400 \//.test(qtxt[0]) && /300 \//.test(qtxt[1]), JSON.stringify(qtxt));
        //  le verrou du cycle, dans la frise : le même que la Météo et le Réalisé
        const env = `[data-frise-ligne][data-poste="${PSY}"] [data-frise-enveloppe]`, btn = `[data-frise-ligne][data-poste="${PSY}"] [data-frise-cloturer]`;
        v('  → ouvert : 🔓 sur la ligne, enveloppe normale', (await page.textContent(btn)).trim() === '🔓' && await page.getAttribute(env, 'data-clos') === 'non');
        await page.click(btn); await page.waitForTimeout(300);
        const F2 = await page.evaluate(({ ST, PSY }) => { const S = eval(ST); return { meteo: S.liberteCycle.postesCycle.find(x => x.cle === PSY).clos, frise: S.friseCycle.categories.flatMap(c => c.lignes).find(x => x.cle === PSY).clos }; }, { ST, PSY });
        const chiffres = (await page.textContent(env + ' [data-frise-chiffres]')).replace(/\s+/g, ' ');
        const lib = F1.env - 700;
        v('  → 🔓 touché dans la frise : clôturé pour le cycle — la Météo le voit aussi ; « 🔒 Clôturé · 700 / … DH · N libérés », enveloppe grisée, bouton 🔒',
          F2.meteo && F2.frise && new RegExp('🔒 Clôturé · 700 / ' + F1.env + ' DH · ' + lib + ' libérés').test(chiffres) && await page.getAttribute(env, 'data-clos') === 'oui' && (await page.textContent(btn)).trim() === '🔒', JSON.stringify([F2, chiffres]));
        await page.click(btn); await page.waitForTimeout(300);
        v('  → 🔒 retouché : rouvert partout', await page.evaluate(({ ST, PSY }) => !eval(ST).liberteCycle.postesCycle.find(x => x.cle === PSY).clos, { ST, PSY }) && await page.getAttribute(env, 'data-clos') === 'non');
        //  clôturé depuis la Météo (le 🔒 de « Sur tout le cycle ») → la frise le montre
        await page.evaluate(({ ST, HRI }) => eval(ST).basculerClotureConso(null, HRI, 'cycle'), { ST, HRI }); await page.waitForTimeout(300);
        v('  → Hri clôturé depuis la Météo : la frise affiche « 🔒 Clôturé » sur son enveloppe', /🔒 Clôturé/.test(await page.textContent(`[data-frise-ligne][data-poste="${HRI}"] [data-frise-chiffres]`)));
        //  une case / sem close pour SA semaine : « 🔒 » dans la case ; l'aperçu la clôt et la rouvre
        await page.evaluate(({ ST, MARJANE }) => eval(ST).basculerClotureConso('2026-11-09', MARJANE, 'semaine'), { ST, MARJANE }); await page.waitForTimeout(300);
        const cases = await page.$$eval(`[data-frise-ligne][data-poste="${MARJANE}"] [data-frise-case]`, l => l.map(x => [x.dataset.clos, x.textContent.trim()]));
        v('  → Marjane close pour la semaine du 9 nov. : sa case porte « 🔒 », les autres non', cases.filter(c => c[0] === 'oui').length === 1 && cases.find(c => c[0] === 'oui')[1].startsWith('🔒'), JSON.stringify(cases));
        const i9 = cases.findIndex(c => c[0] === 'oui');
        await (await page.$$(`[data-frise-ligne][data-poste="${MARJANE}"] [data-frise-case]`))[i9].click(); await page.waitForTimeout(250);
        v('  → l\'aperçu de la case : « 🔒 Clôturé pour du 9 nov. … Toucher pour rouvrir »', /Clôturé pour du 9 nov/.test(await page.textContent('[data-frise-apercu-cloturer]')), await page.textContent('[data-frise-apercu-cloturer]').catch(() => ''));
        await page.click('[data-frise-apercu-cloturer]'); await page.waitForTimeout(300);
        v('  → touché : la semaine rouverte (la case perd son 🔒)', (await page.$$eval(`[data-frise-ligne][data-poste="${MARJANE}"] [data-frise-case]`, l => l.filter(x => x.dataset.clos === 'oui').length)) === 0
          && /Clôturer pour/.test(await page.textContent('[data-frise-apercu-cloturer]')));
        await page.evaluate((ST) => eval(ST).fermerApercuFrise(), ST); await page.waitForTimeout(150);
        //  « C'EST QUOI CE ✓ ? PARFOIS IL DISPARAÎT » : « ✓ payé » inscrit le prévu ; une fois inscrit, « ✕ » l'annule (le bouton ne s'évanouit plus)
        await page.evaluate(({ ST, HRI }) => eval(ST).basculerClotureConso(null, HRI, 'cycle'), { ST, HRI }); await page.waitForTimeout(250);   // Hri rouvert
        const qH = `[data-frise-quinzaines][data-poste="${HRI}"]`;
        const avant = { annuler: !!(await page.$(qH + ' [data-frise-quinzaine-annuler]')), payer: !!(await page.$(qH + ' [data-frise-quinzaine-payee]')) };
        await page.click(qH + ' [data-frise-quinzaine-annuler]'); await page.waitForTimeout(300);
        const vide = { payer: (await page.textContent(qH + ' [data-frise-quinzaine-payee]').catch(() => '')).trim(), engage: await page.evaluate(({ ST, HRI }) => eval(ST).friseCycle.categories.flatMap(c => c.lignes).find(x => x.cle === HRI).engage, { ST, HRI }) };
        await page.click(qH + ' [data-frise-quinzaine-payee]'); await page.waitForTimeout(300);
        const paye = { annuler: !!(await page.$(qH + ' [data-frise-quinzaine-annuler]')), engage: await page.evaluate(({ ST, HRI }) => eval(ST).friseCycle.categories.flatMap(c => c.lignes).find(x => x.cle === HRI).engage, { ST, HRI }) };
        v('  → Hri : saisi → « ✕ » (annuler) ; ✕ touché → vide, « ✓ payé » apparaît ; ✓ payé touché → le prévu (1 000) inscrit, « ✕ » revient',
          avant.annuler && !avant.payer && vide.payer === '✓ payé' && vide.engage === 0 && paye.annuler && paye.engage === 1000, JSON.stringify({ avant, vide, paye }));
        //  v37.144 — « CHAQUE LIGNE DOIT MENTIONNER SON COMPTE » : la règle du Relevé (compte choisi sur la charge, sinon celui des charges variables)
        const cptAvant = await page.$$eval('[data-frise-categorie] [data-frise-ligne] [data-frise-compte]', l => l.map(x => x.textContent.trim()));
        await page.evaluate((ST) => { const st = eval(ST); st.comptes.push({ id: 'acc_as', label: 'Assafa principal', type: 'liquide', solde: 5000, icone: '🏦' });
            st.donneesAnnuelles[2026].chargesVariables.alimentation.compte = 'cpt_acc_as'; st.calculationTick++; }, ST); await page.waitForTimeout(400);
        const cpt = await page.evaluate(() => [...document.querySelectorAll('[data-frise-ligne]')].map(l => [l.dataset.poste, (l.querySelector('[data-frise-compte]') || {}).textContent || ''].map(x => String(x).trim())));
        v('  → chaque ligne dit son compte : « 💳 Compte Courant » par défaut ; la charge Courses prélevée sur Assafa → ses lignes (Marjane, Psy, Hri) disent « 💳 Assafa principal »',
          cptAvant.length >= 3 && cptAvant.every(t => /Compte Courant/.test(t)) && ['alimentation::1', 'alimentation::2', 'alimentation::3'].every(k => (cpt.find(x => x[0] === k) || [])[1] === '💳 Assafa principal'), JSON.stringify([cptAvant, cpt]));
        //  v37.147 — « POURQUOI JE NE PEUX PAS CLÔTURER ICI ? » : une FACTURE se clôt par le verrou du Réalisé, depuis la frise aussi
        await page.evaluate((ST) => { const st = eval(ST); st.donneesAnnuelles[2026].chargesVariables.factures.details = [{ id: 7, nom: 'Élec', montant: 300, periode: 'cycle', categorieId: 'cat_cv_factures__delec' }]; st.calculationTick++; }, ST);
        await page.waitForTimeout(400);
        const bF = '[data-frise-ligne][data-poste="factures::7"] [data-frise-cloturer]', eF = '[data-frise-ligne][data-poste="factures::7"] [data-frise-enveloppe]';
        const realise = () => page.evaluate((ST) => { const st = eval(ST), mb = st.moisBudgetaire, det = st.donneesAnnuelles[2026].chargesVariables.factures.details[0]; return st.estClotureItem(det, st.cyclePilotage); }, ST);
        const f0 = { bouton: (await page.textContent(bF).catch(() => '')).trim(), realise: await realise(), chiffres: (await page.textContent(eF + ' [data-frise-chiffres]').catch(() => '')).replace(/\s+/g, ' ') };
        await page.click(bF); await page.waitForTimeout(300);
        const f1 = { bouton: (await page.textContent(bF)).trim(), clos: await page.getAttribute(eF, 'data-clos'), realise: await realise(), chiffres: (await page.textContent(eF + ' [data-frise-chiffres]')).replace(/\s+/g, ' ') };
        await page.click(bF); await page.waitForTimeout(300);
        const f2 = { bouton: (await page.textContent(bF)).trim(), clos: await page.getAttribute(eF, 'data-clos'), realise: await realise() };
        v('  → v37.147 : la facture Élec a son 🔓 dans la frise ; touché → clôturée (« 🔒 Clôturé · 300 / 300 DH », déjà réglée au journal) ET clôturée dans le Réalisé ; retouché → rouverte partout',
          f0.bouton === '🔓' && !f0.realise && f1.bouton === '🔒' && f1.clos === 'oui' && f1.realise && /^🔒 Clôturé · 300 \/ 300 DH$/.test(f1.chiffres.trim()) && /300 \/ 300 DH sur le cycle/.test(f0.chiffres) && f2.bouton === '🔓' && f2.clos === 'non' && !f2.realise,
          JSON.stringify({ f0, f1, f2 }));
        //  v37.147 — « JOUETS ABDELJALIL, HABITS ABDELJALIL, HABITS CHARIF… IL NE DOIT RIEN MANQUER À LA FRISE » : charges fixes, épargne, virements, revenus
        await page.evaluate((ST) => { const st = eval(ST), d = st.donneesAnnuelles[2026];
            Object.assign(d.chargesFixes.jouets, { label: 'Jouets Abdeljalil', valeur: 300, jourPrevu: 5 }); Object.assign(d.chargesFixes.habitsBebe, { label: 'Habits Abdeljalil', valeur: 400, jourPrevu: 10 });
            d.epargne = [{ id: 91, nom: 'Épargne voyage', valeur: 1000, jourPrevu: 28, paye: false, montantPaye: 0 }];
            st.calculationTick++; }, ST);
        await page.waitForTimeout(400);
        const blocs = await page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST).friseCycle.categories.filter(c => c.key.startsWith('__')).map(c => ({ key: c.key, lignes: c.lignes.map(l => [l.nom, l.engage, l.enveloppe, l.compte, l.verrouillable]) })))), ST);
        const fixes = (blocs.find(b => b.key === '__fixes') || {}).lignes || [], rev = (blocs.find(b => b.key === '__revenus') || {}).lignes || [], ep = (blocs.find(b => b.key === '__epargne') || {}).lignes || [];
        v('  → v37.147 : la frise a ses blocs « Charges fixes » (Jouets Abdeljalil 0 / 300, Habits Abdeljalil 0 / 400), « Épargne » (1 000), « Revenus » (SALAIRE 20 000) — chaque ligne avec son compte et son verrou',
          fixes.some(l => l[0] === 'Jouets Abdeljalil' && l[1] === 0 && l[2] === 300 && /Compte Courant/.test(l[3]) && l[4]) && fixes.some(l => l[0] === 'Habits Abdeljalil' && l[2] === 400)
          && ep.some(l => l[0] === 'Épargne voyage' && l[2] === 1000) && rev.some(l => l[0] === 'SALAIRE' && l[2] === 20000) && !fixes.some(l => l[0] === '—'), JSON.stringify(blocs));
        const bJ = '[data-frise-ligne][data-poste="fixe_jouets"] [data-frise-cloturer]';
        await page.click(bJ); await page.waitForTimeout(300);
        const jClos = await page.evaluate((ST) => { const st = eval(ST); return st.estClotureItem(st.donneesAnnuelles[2026].chargesFixes.jouets, st.cyclePilotage); }, ST);
        await page.click(bJ); await page.waitForTimeout(300);
        v('  → une charge fixe se clôt depuis la frise (verrou du Réalisé) et se rouvre', jClos && !(await page.evaluate((ST) => { const st = eval(ST); return st.estClotureItem(st.donneesAnnuelles[2026].chargesFixes.jouets, st.cyclePilotage); }, ST)));
        await page.click('[data-frise-ligne][data-poste="fixe_jouets"] [data-frise-vers-prevu]'); await page.waitForSelector('[data-prevu-frise]');
        const sansRythme = !(await page.$('[data-prevu-frise-rythme]'));
        await page.fill('[data-prevu-frise-montant]', '350'); await page.click('[data-prevu-frise-enregistrer]'); await page.waitForTimeout(300);
        const jv = await page.evaluate((ST) => eval(ST).donneesAnnuelles[2026].chargesFixes.jouets.valeur, ST);
        v('  → ✏️ sur « Jouets Abdeljalil » : la petite fenêtre (nom, montant, sans rythme) ; 350 enregistré sur la charge fixe', sansRythme && jv === 350, JSON.stringify({ sansRythme, jv }));
    });
    await section('E', async () => {
        await page.click('[data-frise-fermer]');
        await page.waitForTimeout(250);
        const E = await page.evaluate((ST) => ({ ouverte: eval(ST).friseOuverte, frise: eval(ST).friseCycle, dom: !!document.querySelector('[data-frise]') }), ST);
        v('E. ✕ la ferme : plus affichée, plus calculée', !E.ouverte && E.frise === null && !E.dom, JSON.stringify(E));
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
