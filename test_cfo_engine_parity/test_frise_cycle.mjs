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
v('A. un bloc « Sur tout le cycle » mémorisé (uiOuvert / uiFixer), replié par défaut',
  /<details v-if="p\.postesCycle && p\.postesCycle\.length && sm\.dansCycle" data-pulse-cycle :open="uiOuvert\('meteo\.cycle', false\)" @toggle="uiFixer\('meteo\.cycle', \$event\.target\.open\)"/.test(html));
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
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
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
        const dom = await page.evaluate(() => {
            const b = document.querySelector('[data-pulse-cycle]');
            return b && { ouvert: b.open, resume: b.querySelector('[data-pulse-cycle-resume]')?.textContent.replace(/\s+/g, ' ').trim(),
                          lignes: [...b.querySelectorAll('[data-pulse-poste-cycle]')].map(e => e.dataset.poste),
                          alertes: [...b.querySelectorAll('[data-pulse-cycle-alerte]')].map(e => e.textContent.replace(/\s+/g, ' ').trim()),
                          note: b.querySelector('[data-pulse-cycle-quinzaine]')?.textContent.replace(/\s+/g, ' ').trim() };
        });
        v('  → replié par défaut ; « 📅 Sur tout le cycle · 2 postes … · 1 800 / 1 886 DH »',
          !!dom && dom.ouvert === false && /^📅 Sur tout le cycle/.test(dom.resume) && sansEsp(dom.resume).includes('1800/1886DH') && dom.lignes.length === 2, JSON.stringify(dom));
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
    });

    /* ── E. Fermer ────────────────────────────────────────────────────── */
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
