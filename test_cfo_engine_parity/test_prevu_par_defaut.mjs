/**
 * v37.31 — UNE SEMAINE ÉCOULÉE SANS SAISIE COMPTE SON PRÉVU.
 *
 *   « Quand je ne remplis pas un poste variable et que la semaine s'est écoulée,
 *   il faut mettre par défaut la valeur prévue en réalisé. »
 *   Cette suite vérifie, contre des calculs faits à la main :
 *     - le moteur : une semaine écoulée (dimanche passé) sans saisie compte le prévu
 *       de chaque ligne « / sem » et de chaque charge sans ligne ; la semaine en
 *       cours reste à 0 (v37.28) ; une ligne /cycle n'en reçoit jamais ;
 *     - la frontière : le dimanche soir, la semaine n'est pas encore écoulée ;
 *     - corriger : un montant tapé (même 0) remplace le prévu ; vider la case le
 *       rend ; « +50 » part du prévu ; un ticket daté sur un poste le remplace ;
 *     - pas de double comptage : un ancien total de cycle ; et (v37.48) « Autre », hors de
 *       la liste, s'ajoute sans vider les lignes de leur prévu ;
 *     - rien n'est écrit : le défaut suit le prévu, survit à « effacer le cycle » ;
 *     - l'affichage : cases, marques « ✓ au prévu », note de semaine, Rayons X, ⓘ.
 *
 *   v37.65 — LES SEMAINES COUPÉES PAR LA PAIE : la paie tombe le jeudi 8 oct., le cycle commence donc
 *   par un morceau de 4 jours (du 8 au 11 oct.) — l'ex-« semaine du 5 », dont le lundi, le mardi et le
 *   mercredi appartiennent au cycle précédent. Son prévu est au prorata de ses jours, les semaines
 *   entières gardent le leur (ESSENCE : 860 × 7 / 31 = 194 ; plus 860 ÷ 5 = 172). Calculs à la main :
 *     • morceau du 8 au 11 (4 j) : Marjane 343, L7m 229, SORTIES 228, ESSENCE 111 — soit 911 DH ;
 *     • semaine entière : Marjane 600, L7m 400, SORTIES 400, ESSENCE 194 — soit 1 594 DH ;
 *     (sur le cycle, les morceaux coupés se partagent l'arrondi : 343 + 600 × 3 + 514 = 2 657 pour Marjane).
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
console.log('\n  SEMAINE ÉCOULÉE SANS SAISIE = SON PRÉVU, RÉALISÉ PAR DÉFAUT\n  ' + '─'.repeat(80));

/* ── A. Statique ─────────────────────────────────────────────────────── */
v('la note de semaine écoulée et la marque des cases retenues au prévu existent', /data-semaine-defaut/.test(html) && /:data-defaut=/.test(html));

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

/* ── B. Le comptage de référence et le décor ──────────────────────────── */
//  Chaque jour du cycle, un par un : combien de jours ? (v37.65 : semaines = jours ÷ 7)
const semainesCycle = (mois, an, jdp) => { let n = 0; for (let d = new Date(an, mois - 2, jdp); d <= new Date(an, mois - 1, jdp - 1); d.setDate(d.getDate() + 1)) n++; return n / 7; };
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
//  Les débuts des morceaux du cycle M : son premier jour, puis chaque lundi (v37.65)
const debutsCycle = (mois, an, jdp) => { const out = []; for (let d = new Date(an, mois - 2, jdp), d0 = d.getTime(); d <= new Date(an, mois - 1, jdp - 1); d.setDate(d.getDate() + 1)) if (d.getTime() === d0 || d.getDay() === 1) out.push(iso(d)); return out; };
const nf = (n) => new Intl.NumberFormat('fr-FR').format(n).replace(/\s/g, '');
const sansEsp = (t) => String(t || '').replace(/\s/g, '');

const JDP = 8;
//  Deux horloges FIXES, deux cycles : 5 semaines (8 oct. → 7 nov. 2026) et 4 semaines (8 sept. → 7 oct. 2026)
//  Deux horloges FIXES dans le cycle du 8 oct. au 7 nov. 2026 (31 jours : 4 + 7 + 7 + 7 + 6) :
//    mercredi 21 oct. → deux morceaux ÉCOULÉS (8-11 et 12-18 oct.), la semaine en cours 19-25 ;
//    dimanche 18 oct. 23 h → un seul : la semaine 12-18 n'est écoulée que LUNDI.
const SCENARIOS = [
    { nom: 'mercredi 21 oct.', maintenant: new Date(2026, 9, 21, 10, 0, 0), mois: 11, an: 2026 },
    { nom: 'dimanche 18 oct., 23 h', maintenant: new Date(2026, 9, 18, 23, 0, 0), mois: 11, an: 2026 },
];
const fixture = (sc) => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = {};
    for (const an of [sc.an - 1, sc.an, sc.an + 1]) fx.donneesAnnuelles[an] = JSON.parse(JSON.stringify(base));
    Object.assign(fx.soldesInitiaux, { moisActuel: sc.mois, anneeActuelle: sc.an, jourDePaie: JDP,
        compteChargesFixes: 'courant', compteChargesVariables: 'courant', assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.comptes = [{ id: 1, label: 'Compte Courant', type: 'courant', solde: 90000, icone: '💳' }];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    for (const an of Object.keys(fx.donneesAnnuelles)) {
        const d = fx.donneesAnnuelles[an];
        const Rv = (label, b, j) => ({ ...neutre, label, base: b, jourPrevu: j, destinationCompte: 'courant' });
        d.revenus = { salaire: Rv('SALAIRE', 20000, JDP), bonif: Rv('—', 0), magasin: Rv('—', 0), cnss: Rv('—', 0), appart: Rv('—', 0), studio: Rv('—', 0) };
        const Fx = (label, valeur) => ({ ...neutre, label, valeur, jourPrevu: null });
        d.chargesFixes = { creditImmo: Fx('LOYER', 6000), creditStudio: Fx('—', 0), syndic: Fx('—', 0), nounou: Fx('—', 0), ecole: Fx('—', 0),
                           femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
        const V = (label, valeur, periode, details = []) => ({ ...neutre, label, valeur, periode, details });
        d.chargesVariables = {
            //  Marjane et L7m à la semaine (L7m hérite), Hri une fois par cycle
            alimentation: V('COURSES', 1231, 'semaine', [{ id: 1, nom: 'Marjane', montant: 600, periode: 'semaine', categorieId: 'cat_marjane' },
                                                          { id: 2, nom: 'L7m', montant: 400, categorieId: 'cat_l7m' }, { id: 3, nom: 'Hri', montant: 1000, periode: 'cycle', categorieId: 'cat_hri' }]),
            sorties: V('SORTIES', 400, 'semaine'), voiture: V('ESSENCE', 860, 'mois'), sante: V('—', 0, 'semaine'),
            factures: { ...V('FACTURES', 399, 'mois', [{ id: 11, nom: 'tel', montant: 99 }, { id: 12, nom: 'eau', montant: 300 }]), categorieId: 'cat_cv_factures' },
        };
        d.epargne = []; d.depensesIrregulieres = []; d.virementsInternes = []; d.transactionsReelles = []; d.consoRealiseeT0 = {};
    }
    return fx;
};

let fxCourant = null;
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
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fxCourant));
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
const ouvrir = async (sc) => {
    fxCourant = fixture(sc);
    const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
    await page.clock.setFixedTime(sc.maintenant);
    const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
    page.on('dialog', d => d.accept());
    await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
    await page.waitForTimeout(600);
    await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'pilotage'; }, ST);
    await page.waitForTimeout(500);
    return { page, erreurs };
};
const attendre = (page, ms = 200) => page.waitForTimeout(ms);



//  Prévu HEBDO, à la main : Marjane 600 + L7m 400 (Hri /cycle : jamais) · SORTIES 400 · ESSENCE 860 × 7 / 31 = 194
const SEMAINE = 600 + 400 + 400 + 194;                              // 1 594
//  v37.65 : le morceau du 8 au 11 oct. (4 jours sur 31) — Marjane 343, L7m 229, SORTIES 228, ESSENCE 111
const MORCEAU1 = { 'alimentation::1': 343, 'alimentation::2': 229, sorties: 228, voiture: 111 };
const DEBUT = 343 + 229 + 228 + 111;                                // 911
const COURSES1 = 343 + 229;                                         // 572
//  COURSES (600 + 400) × 31 / 7 + 1 000 = 5 429 · SORTIES 400 × 31 / 7 = 1 771 · ESSENCE 860
const BUDGET = 5429 + 1771 + 860;                                   // 8 060
const etat = (page) => page.evaluate((ST) => { const st = eval(ST), L = st.liberteCycle;
    return { L: JSON.parse(JSON.stringify(L)), env: Math.round(st.enveloppeConsoRestante), defauts: JSON.parse(JSON.stringify(st.consoDefautsDuCycle)),
             stock: JSON.parse(JSON.stringify(st.donneesAnnuelles[st.moisBudgetaire.an].consoRealiseeT0 || {})) }; }, ST);
const cat = (L, k) => L.categories.find(c => c.key === k) || {};
const saisir = (page, lundi, k, m) => page.evaluate(async ({ ST, lundi, k, m }) => { eval(ST).saisirSemaineConso(lundi, k, m); await new Promise(r => setTimeout(r, 80)); }, { ST, lundi, k, m });
const reset = (page) => page.evaluate(async (ST) => { const st = eval(ST); st.resetConsoT0(); Object.values(st.donneesAnnuelles).forEach(d => { d.transactionsReelles = []; }); st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 120)); }, ST);
const S1 = '2026-10-08', S2 = '2026-10-12', S3 = '2026-10-19';   // v37.65 : le cycle commence le jeudi 8

try {
    for (const sc of SCENARIOS) {
        console.log(`\n  ▸ ${sc.nom}`);
        const { page, erreurs } = await ouvrir(sc);
        const e0 = await etat(page);
        if (sc === SCENARIOS[1]) {
            /* ── Frontière : le dimanche soir, la semaine n'est pas encore écoulée ── */
            v('dimanche 18, 23 h : seul le morceau du 8 au 11 est écoulé (la semaine du 12 au 18 : lundi) — 911 DH',
              JSON.stringify(Object.keys(e0.defauts)) === JSON.stringify([S1]) && e0.L.engage === DEBUT, JSON.stringify([Object.keys(e0.defauts), e0.L.engage]));
            v(`aucune erreur JavaScript (${sc.nom})`, erreurs.length === 0, erreurs[0] || '');
            await page.close();
            continue;
        }

        /* ── B. Le moteur ──────────────────────────────────────────────── */
        v(`B. deux morceaux écoulés, rien saisi : ${DEBUT} + ${nf(SEMAINE)} = ${nf(DEBUT + SEMAINE)} réalisés au prévu, la semaine en cours 0`,
          JSON.stringify(Object.keys(e0.defauts)) === JSON.stringify([S1, S2]) && e0.L.engage === DEBUT + SEMAINE && e0.L.declare && e0.L.budget === BUDGET && e0.env === BUDGET - DEBUT - SEMAINE,
          JSON.stringify([Object.keys(e0.defauts), e0.L.engage, e0.L.budget, e0.env]));
        v('  → par ligne, du 8 au 11 (4 j) : Marjane 343, L7m 229 (hérite de « / sem »), SORTIES 228, ESSENCE 111 — Hri (/cycle) : rien',
          JSON.stringify(e0.defauts[S1]) === JSON.stringify(MORCEAU1), JSON.stringify(e0.defauts[S1]));
        v('  → semaine du 12 (entière) : Marjane 600, L7m 400, SORTIES 400, ESSENCE 194',
          JSON.stringify(e0.defauts[S2]) === JSON.stringify({ 'alimentation::1': 600, 'alimentation::2': 400, sorties: 400, voiture: 194 }), JSON.stringify(e0.defauts[S2]));
        v('  → COURSES = 572 + 1 000, SORTIES = 228 + 400, ESSENCE = 111 + 194 ; rien n\'est écrit dans les données',
          cat(e0.L, 'alimentation').reel === COURSES1 + 1000 && cat(e0.L, 'sorties').reel === 628 && cat(e0.L, 'voiture').reel === 305 && Object.keys(e0.stock).length === 0, JSON.stringify([cat(e0.L, 'alimentation').reel, e0.stock]));
        v('  → la semaine EN COURS reste vierge (v37.28) : 0 DH, aucune case retenue',
          e0.L.semaine.debut === S3 && e0.L.semaine.engage === 0 && e0.L.semaine.defaut === 0, JSON.stringify(e0.L.semaine));

        /* ── C. L'affichage de la semaine écoulée ─────────────────────── */
        await (await page.$('[data-semaine-nav]')).scrollIntoViewIfNeeded();
        await page.click('[data-semaine-prec]'); await page.waitForTimeout(250);
        await page.click('[data-pulse-ouvrir][data-cat="alimentation"]'); await page.waitForTimeout(200);
        const vue = () => page.evaluate(() => ({
            cases: [...document.querySelectorAll('[data-meteo] input[data-saisie]')].map(i => [i.dataset.poste || i.dataset.cat, i.value, i.dataset.defaut || '']),
            note: document.querySelector('[data-semaine-defaut]')?.textContent.replace(/\s+/g, ' ').trim(),
            total: document.querySelector('[data-semaine-total]')?.textContent.replace(/\s/g, ''),
            marques: [...document.querySelectorAll('[data-pulse-poste-defaut], [data-pulse-defaut]')].length,
            courses: document.querySelector('[data-pulse-ouvrir][data-cat="alimentation"] [data-pulse-total]')?.textContent.replace(/\s/g, '') }));
        const c1 = await vue();
        //  v37.66 : Hri (/ cycle) a quitté les lignes de la semaine pour le bloc « Sur tout le cycle », en dernier
        v('C. semaine du 12 au 18 : chaque case vide montre son prévu (Marjane 600, L7m 400, SORTIES 400, ESSENCE 194), « Autre » et Hri (cycle) vides',
          JSON.stringify(c1.cases) === JSON.stringify([['alimentation::1', '600', '1'], ['alimentation::2', '400', '1'], ['libre', '', ''], ['sorties', '400', '1'], ['voiture', '194', '1'], ['alimentation::3', '', '']]),
          JSON.stringify(c1.cases));
        v(`  → la note le dit (« … comptent leur prévu (${nf(SEMAINE)} DH) … 0 si rien n'a été dépensé »), total ${nf(SEMAINE)} DH, COURSES 1 000`,
          !!c1.note && c1.note.includes('comptent leur prévu') && sansEsp(c1.note).includes(nf(SEMAINE) + 'DH') && c1.total.startsWith(nf(SEMAINE) + 'DH') && c1.courses === '1000' && c1.marques >= 4, JSON.stringify(c1));

        /* ── D. Corriger ───────────────────────────────────────────────── */
        await page.click('[data-pulse-poste-saisie][data-poste="alimentation::1"]'); await page.keyboard.type('450'); await page.keyboard.press('Enter'); await page.waitForTimeout(250);
        let e = await etat(page);
        const c2 = await vue();
        v('D. Marjane tapée 450 la semaine du 12 : elle remplace son prévu — COURSES = 450 + 400 + 572 (du 8 au 11)',
          cat(e.L, 'alimentation').reel === 450 + 400 + COURSES1 && c2.cases[0][1] === '450' && c2.cases[0][2] === '' && c2.cases[1][2] === '1', JSON.stringify([cat(e.L, 'alimentation').reel, c2.cases]));
        await page.click('[data-pulse-poste-saisie][data-poste="alimentation::2"]'); await page.keyboard.type('0'); await page.keyboard.press('Enter'); await page.waitForTimeout(250);
        e = await etat(page);
        v('  → L7m tapé 0 (« rien dépensé ») : plus de prévu — COURSES = 450 + 0 + 572', cat(e.L, 'alimentation').reel === 450 + COURSES1, String(cat(e.L, 'alimentation').reel));
        await page.fill('[data-pulse-poste-saisie][data-poste="alimentation::1"]', ''); await page.waitForTimeout(250);
        e = await etat(page);
        v('  → vider Marjane lui rend son prévu (600) — COURSES = 600 + 0 + 572', cat(e.L, 'alimentation').reel === 600 + COURSES1, String(cat(e.L, 'alimentation').reel));
        await page.fill('[data-pulse-poste-saisie][data-poste="alimentation::2"]', ''); await page.waitForTimeout(200);
        await page.click('[data-pulse-poste-saisie][data-poste="alimentation::2"]'); await page.keyboard.type('+50'); await page.keyboard.press('Enter'); await page.waitForTimeout(250);
        e = await etat(page);
        v('  → « +50 » sur L7m retenu au prévu : 400 + 50 = 450', JSON.stringify(e.stock['S' + S2]) === '{"alimentation::2":450}' && cat(e.L, 'alimentation').reel === 600 + 450 + COURSES1, JSON.stringify([e.stock, cat(e.L, 'alimentation').reel]));
        await page.click('[data-semaine-aujourdhui]'); await page.waitForTimeout(200);
        await reset(page);

        /* ── E. Pas de double comptage ─────────────────────────────────── */
        //  Un ticket daté sur le poste L7m, vendredi 9 oct. : il remplace le prévu de L7m dans CE morceau-là
        await page.evaluate(async (ST) => { const st = eval(ST), an = st.moisBudgetaire.an;
            //  la sous-catégorie que l'application a attribuée à la ligne L7m
            const l7m = st.donneesAnnuelles[an].chargesVariables.alimentation.details[1].categorieId;
            st.donneesAnnuelles[an].transactionsReelles.push({ id: 9001, date: '2026-10-09', libelle: 'BOUCHER', montant: 380, categorieId: l7m, compteId: 1, source: 'test' });
            st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 150)); }, ST);
        e = await etat(page);
        v('E. ticket L7m 380 le 9 oct. : plus de prévu pour L7m du 8 au 11 — COURSES = 380 + Marjane 343 + 1 000',
          !('alimentation::2' in e.defauts[S1]) && cat(e.L, 'alimentation').reel === 380 + 343 + 1000, JSON.stringify([e.defauts[S1], cat(e.L, 'alimentation').reel]));
        await reset(page);
        await saisir(page, S2, 'alimentation', 900);
        e = await etat(page);
        //  v37.48 : « Autre » est HORS de la liste — ses lignes vides gardent leur prévu (Marjane 600 + L7m 400)
        v('  → « Autre » 900 la semaine du 12 (hors liste) : ses lignes vides gardent leur prévu — COURSES = 572 + 900 + 1 000',
          e.defauts[S2]['alimentation::1'] === 600 && e.defauts[S2]['alimentation::2'] === 400 && cat(e.L, 'alimentation').reel === COURSES1 + 900 + 1000, JSON.stringify([e.defauts[S2], cat(e.L, 'alimentation').reel]));
        await reset(page);
        await page.evaluate(async (ST) => { const st = eval(ST); st.saisirCompteurConso('sorties', 1500); await new Promise(r => setTimeout(r, 150)); }, ST);
        e = await etat(page);
        v('  → un ancien total de CYCLE sur SORTIES (1 500) couvre ses semaines : 1 500, pas 1 500 + 628',
          cat(e.L, 'sorties').reel === 1500 && !('sorties' in e.defauts[S1]), JSON.stringify([cat(e.L, 'sorties').reel, e.defauts[S1]]));
        await reset(page);

        /* ── F. Le défaut suit le prévu ; « effacer le cycle » ne l'efface pas ── */
        await page.evaluate(async (ST) => { const st = eval(ST); st.donneesAnnuelles[st.moisBudgetaire.an].chargesVariables.alimentation.details[0].montant = 700; st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 150)); }, ST);
        e = await etat(page);
        //  Marjane 700 × 4 / 7 = 400 (du 8 au 11) + 700 ; L7m 228 + 400 (le budget de COURSES passe à 5 871 : l'arrondi se répartit autrement)
        v('F. Marjane passe à 700 / sem : ses morceaux écoulés suivent (400 + 700), rien d\'écrit', cat(e.L, 'alimentation').reel === 400 + 700 + 228 + 400 && e.defauts[S1]['alimentation::1'] === 400 && Object.keys(e.stock).length === 0,
          JSON.stringify([cat(e.L, 'alimentation').reel, e.defauts[S1]]));
        await page.evaluate(async (ST) => { const st = eval(ST); st.donneesAnnuelles[st.moisBudgetaire.an].chargesVariables.alimentation.details[0].montant = 600; st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 150)); }, ST);
        e = await etat(page);
        v('  → après « effacer tout le cycle », les semaines écoulées comptent toujours leur prévu', e.L.engage === DEBUT + SEMAINE, String(e.L.engage));

        /* ── G. Les Rayons X et ⓘ ──────────────────────────────────────── */
        await page.mouse.move(2, 2); await page.waitForTimeout(150);
        await page.hover('[data-pulse-cat][data-cat="alimentation"]'); await page.waitForTimeout(350);
        const rx = await page.evaluate(() => document.querySelector('[data-rayonx] [data-rx-retenu]')?.textContent.replace(/\s+/g, ' ').trim());
        v('G. Rayons X, rien saisi : « ✓ Rien saisi ce cycle : les semaines écoulées comptent leur prévu, 1 572 DH »',
          !!rx && rx.startsWith('✓ Rien saisi ce cycle') && sansEsp(rx).includes('prévu,' + nf(COURSES1 + 1000) + 'DH'), String(rx));
        await page.mouse.move(2, 2); await page.waitForTimeout(250);
        await saisir(page, S3, 'alimentation::1', 300);
        await page.hover('[data-pulse-cat][data-cat="alimentation"]'); await page.waitForTimeout(350);
        const rx2 = await page.evaluate(() => { const p = document.querySelector('[data-rayonx]'); return p && { retenu: p.querySelector('[data-rx-retenu]')?.textContent.replace(/\s+/g, ' ').trim(), defaut: p.querySelector('[data-rx-defaut]')?.textContent.replace(/\s/g, ''), total: p.querySelector('[data-rx-total]')?.textContent.replace(/\s/g, '') }; });
        v('  → après 300 tapés cette semaine : « Total saisi 300 » + « ✓ + 1 572 au prévu », dépensé 1 872',
          !!rx2 && /Total saisi sur la carte : 300/.test(rx2.retenu) && rx2.defaut === '✓+' + nf(COURSES1 + 1000) + 'DHauprévu:semainesécouléessanssaisie.' && rx2.total === nf(300 + COURSES1 + 1000) + 'DH', JSON.stringify(rx2));
        await page.mouse.move(2, 2); await page.waitForTimeout(400);
        await (await page.$('[data-liberte-calcul]')).scrollIntoViewIfNeeded(); await page.waitForTimeout(150);
        await page.hover('[data-liberte-calcul]'); await page.waitForTimeout(400);
        const calc = await page.evaluate(() => document.querySelector('[data-rayonx] [data-rx-calcul-defaut]')?.textContent.replace(/\s/g, ''));
        v(`  → ⓘ : « dont au prévu (semaines écoulées sans saisie) ${nf(DEBUT + SEMAINE)} »`, calc === 'dontauprévu(semainesécouléessanssaisie)' + nf(DEBUT + SEMAINE) + 'DH', String(calc));
        await page.mouse.move(2, 2);
        v(`aucune erreur JavaScript (${sc.nom})`, erreurs.length === 0, erreurs[0] || '');
        await page.close();
    }
} catch (e) {
    v('exécution sans exception', false, String(e && e.stack || e).slice(0, 400));
} finally {
    await browser.close(); srv.close();
}
console.log('  ' + '─'.repeat(80));
console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
