/**
 * v37.30 — UN RYTHME PAR LIGNE DE DÉTAIL (/sem, /15 j, /cycle).
 *
 *   « Hri » (le ravitaillement) se fait une fois par mois, « L7m » (la viande) à la
 *   semaine, le « Psy » à la quinzaine. Chaque sous-catégorie porte désormais son
 *   rythme, sur le moteur des semaines réelles (v37.29) :
 *       /sem → montant × N      /15 j → montant × N / 2      /cycle → montant × 1
 *   Cette suite vérifie, contre des calculs faits à la main :
 *     - l'héritage : une ligne sans rythme prend celui de sa catégorie (rien ne
 *       change pour les données existantes) ;
 *     - le coût du cycle, ligne par ligne : Pilotage, Prévisionnel des 12 mois,
 *       surplus, journal de trésorerie ;
 *     - les Rayons X : [🛍️ Hri : 1 000 DH / cycle] [🥩 L7m : 150 DH / sem] ;
 *     - la semaine : une ligne /cycle ou /15 j se suit sur le cycle, et la semaine
 *       où on la dépense n'est PAS un faux dépassement ; tenir chaque rythme tout
 *       le cycle = tenir le budget ;
 *     - l'éditeur : un sélecteur par ligne, la nouvelle ligne au rythme de la
 *       catégorie, le calcul du cycle et la valeur résumée qui suivent.
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
console.log('\n  UN RYTHME PAR LIGNE DE DÉTAIL (/SEM, /15 J, /CYCLE)\n  ' + '─'.repeat(80));

/* ── A. Statique ─────────────────────────────────────────────────────── */
v('un sélecteur de rythme par ligne, bureau et téléphone (/sem, /15j, /cycle)',
  (html.match(/data-cv-detail-periode/g) || []).length === 2 && (html.match(/<option value="quinzaine">\/15j<\/option>/g) || []).length === 2);
v('les étiquettes des Rayons X portent leur rythme', /data-rx-poste-unite/.test(html));

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
//  Chaque jour du cycle, un par un : combien de jeudis ?
const semainesCycle = (mois, an, jdp) => { let n = 0; for (let d = new Date(an, mois - 2, jdp); d <= new Date(an, mois - 1, jdp - 1); d.setDate(d.getDate() + 1)) if (d.getDay() === 4) n++; return n; };
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
//  Les lundis des semaines du cycle M (celles dont le jeudi y tombe)
const lundisCycle = (mois, an, jdp) => { const out = []; for (let d = new Date(an, mois - 2, jdp); d <= new Date(an, mois - 1, jdp - 1); d.setDate(d.getDate() + 1)) if (d.getDay() === 4) out.push(iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 3))); return out; };
const nf = (n) => new Intl.NumberFormat('fr-FR').format(n).replace(/\s/g, '');
const sansEsp = (t) => String(t || '').replace(/\s/g, '');

const JDP = 8;
//  Deux horloges FIXES, deux cycles : 5 semaines (8 oct. → 7 nov. 2026) et 4 semaines (8 sept. → 7 oct. 2026)
const SCENARIOS = [
    { nom: 'cycle de 5 semaines', maintenant: new Date(2026, 9, 14, 10, 0, 0), mois: 11, an: 2026 },
    { nom: 'cycle de 4 semaines', maintenant: new Date(2026, 8, 16, 10, 0, 0), mois: 10, an: 2026 },
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
            //  v37.30 : chaque ligne SON rythme ; khdra n'en a pas → hérite de « / sem »
            alimentation: V('COURSES', 1650, 'semaine', [{ id: 1, nom: 'L7m', montant: 150, periode: 'semaine' }, { id: 2, nom: 'Psy', montant: 400, periode: 'quinzaine' },
                                                          { id: 3, nom: 'Hri', montant: 1000, periode: 'cycle' }, { id: 4, nom: 'khdra', montant: 100 }]),
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


//  Coût du cycle de COURSES, à la main : (150 + 100) × N + 400 × N / 2 + 1 000
const COURSES = (n) => 250 * n + 400 * n / 2 + 1000;
const lire = (page) => page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST).liberteCycle)), ST);
const cat = (L, k) => L.categories.find(c => c.key === k) || { sem: {} };

try {
    for (const sc of SCENARIOS) {
        const N = semainesCycle(sc.mois, sc.an, JDP);
        console.log(`\n  ▸ ${sc.nom} — ${N} semaines réelles`);
        const { page, erreurs } = await ouvrir(sc);

        /* ── B. Le modèle et le coût du cycle ─────────────────────────── */
        const her = await page.evaluate((ST) => { const st = eval(ST), d = st.donneesAnnuelles[st.moisBudgetaire.an].chargesVariables;
            return [st.periodeDetail(d.alimentation.details[3], d.alimentation), st.periodeDetail(d.factures.details[0], d.factures)]; }, ST);
        v('B. sans rythme, une ligne hérite : « / sem » → semaine, « / mois » → cycle', JSON.stringify(her) === '["semaine","cycle"]', JSON.stringify(her));
        const L0 = await lire(page);
        v(`  → COURSES = 250 × ${N} + 400 × ${N}/2 + 1 000 = ${nf(COURSES(N))} (et non ${nf(1650 * N)})`, cat(L0, 'alimentation').budget === COURSES(N), String(cat(L0, 'alimentation').budget));
        v(`  → budget conso du cycle = ${nf(COURSES(N) + 400 * N + 860)} (factures exclues)`, L0.budget === COURSES(N) + 400 * N + 860, String(L0.budget));

        /* ── C. La semaine : chaque ligne à son rythme ─────────────────── */
        const sem0 = cat(L0, 'alimentation').sem;
        v(`C. ligne COURSES : « Prévu : 250 DH + ${nf(400 * N / 2 + 1000)} / cycle » (le /15 j et le /cycle à part)`,
          sem0.prevuSemaine === 250 && sem0.prevuCycle === 400 * N / 2 + 1000 && sem0.budget === 250, JSON.stringify([sem0.prevuSemaine, sem0.prevuCycle, sem0.budget]));
        await (await page.$('[data-semaine-nav]')).scrollIntoViewIfNeeded();
        await page.click('[data-pulse-ouvrir][data-cat="alimentation"]'); await page.waitForTimeout(200);
        const postes = await page.evaluate(() => [...document.querySelectorAll('[data-pulse-postes][data-cat="alimentation"] [data-pulse-poste]')]
            .map(e => [e.querySelector('.truncate')?.textContent.trim(), e.querySelector('[data-pulse-prevu]')?.textContent.replace(/\s/g, '')]).filter(x => x[1]));
        const vu = Object.fromEntries(postes);
        v('  → chaque poste dit son rythme : L7m 150 · khdra 100 · Psy 400 / 15 j · Hri 1 000 / cycle',
          vu.L7m === 'Prévu:150DH' && vu.khdra === 'Prévu:100DH' && vu.Psy === 'Prévu:400DH/15j' && vu.Hri === 'Prévu:1000DH/cycle', JSON.stringify(postes));
        const ligne = await page.evaluate(() => { const l = document.querySelector('[data-pulse-ligne][data-cat="alimentation"]');
            return [l?.querySelector('[data-pulse-reste]')?.textContent.replace(/\s+/g, ' ').trim(), l?.querySelector('[data-pulse-prevu-cycle]')?.textContent.replace(/\s+/g, ' ').trim()]; });
        v(`  → la ligne le dit : « Prévu : 250 DH » puis « + ${nf(400 * N / 2 + 1000)} DH / cycle (Hri · Psy) »`,
          ligne[0] === 'Prévu : 250 DH' && sansEsp(ligne[1]) === `+${nf(400 * N / 2 + 1000)}DH/cycle(Hri·Psy)` && /^\+ [\d\s\u202f]+ DH \/ cycle \(Hri · Psy\)$/.test(ligne[1]), JSON.stringify(ligne));
        //  La semaine du ravitaillement : Hri 1 000 + L7m 150 + khdra 100 — PRÉVU, pas dépassé
        const lundi0 = await page.evaluate((ST) => eval(ST).liberteCycle.semaine.lundi, ST);
        const saisir = (lundi, k, m) => page.evaluate(async ({ ST, lundi, k, m }) => { eval(ST).saisirSemaineConso(lundi, k, m); await new Promise(r => setTimeout(r, 60)); }, { ST, lundi, k, m });
        await saisir(lundi0, 'alimentation::3', 1000); await saisir(lundi0, 'alimentation::1', 150); await saisir(lundi0, 'alimentation::4', 100);
        await page.waitForTimeout(200);
        const s1 = cat(await lire(page), 'alimentation').sem;
        const hri1 = s1.postes.find(p => p.nom === 'Hri');
        v('  → la semaine du ravitaillement (Hri 1 000 + 250) : prévu 1 250, reste 0 — pas de faux dépassement',
          s1.engage === 1250 && s1.budget === 1250 && s1.reste === 0 && !hri1.depasse && hri1.cycleEngage === 1000 && hri1.pct === 100, JSON.stringify([s1.engage, s1.budget, s1.reste, hri1]));
        const texteHri = await page.evaluate(() => [...document.querySelectorAll('[data-pulse-poste]')].find(e => e.textContent.includes('Hri'))?.querySelector('[data-pulse-prevu]')?.textContent.replace(/\s+/g, ' ').trim());
        v('  → le poste Hri : « 1 000 DH / cycle · 1 000 ce cycle » (espaces compris)', sansEsp(texteHri) === 'Prévu:1000DH/cycle·1000cecycle' && /DH \/ cycle · /.test(texteHri), String(texteHri));
        await saisir(lundi0, 'alimentation::3', 1200); await page.waitForTimeout(150);
        const s2 = cat(await lire(page), 'alimentation').sem;
        v('  → Hri à 1 200 (enveloppe 1 000) : là, c\'est un VRAI dépassement de 200', s2.reste === -200 && s2.postes.find(p => p.nom === 'Hri').depasse, JSON.stringify([s2.reste]));
        await page.evaluate(async (ST) => { eval(ST).resetConsoT0(); await new Promise(r => setTimeout(r, 120)); }, ST);

        /* ── D. LA PROMESSE : chaque rythme tenu tout le cycle = budget tenu ── */
        const lundis = lundisCycle(sc.mois, sc.an, JDP);
        const promesse = await page.evaluate(async ({ ST, lundis }) => {
            const st = eval(ST);
            st.resetConsoT0(); await new Promise(r => setTimeout(r, 80));
            lundis.forEach((l, i) => {
                st.saisirSemaineConso(l, 'alimentation::1', 150); st.saisirSemaineConso(l, 'alimentation::4', 100);   // chaque semaine
                if (i === 0) st.saisirSemaineConso(l, 'alimentation::3', 1000);                                        // une fois
                if (i % 2 === 0 && i < 2 * Math.floor(lundis.length / 2)) st.saisirSemaineConso(l, 'alimentation::2', 400);   // une semaine sur deux
            });
            await new Promise(r => setTimeout(r, 120));
            const semaines = [];
            for (let k = -6; k <= 6; k++) { st.changerSemaine(0); st.changerSemaine(k); await new Promise(r => setTimeout(r, 30)); const s = st.liberteCycle.semaine; if (s.dansCycle) semaines.push(st.liberteCycle.categories.find(c => c.key === 'alimentation').sem.reste); }
            st.changerSemaine(0); await new Promise(r => setTimeout(r, 60));
            const c = st.liberteCycle.categories.find(x => x.key === 'alimentation');
            const r = { semaines, engage: c.reel, budget: c.budget, reste: c.resteReel };
            st.resetConsoT0(); await new Promise(r2 => setTimeout(r2, 80));
            return r;
        }, { ST, lundis });
        const psyFois = Math.floor(N / 2);
        v(`D. L7m + khdra chaque semaine, Hri une fois, Psy ${psyFois} fois : aucune semaine « dépassée »`, promesse.semaines.length === N && promesse.semaines.every(x => x >= 0), JSON.stringify(promesse.semaines));
        v(`  → le cycle : ${nf(250 * N + 1000 + 400 * psyFois)} engagés sur ${nf(COURSES(N))}${N % 2 ? ' (½ quinzaine de marge : 5 semaines)' : ' — tenu au dirham près'}`,
          promesse.engage === 250 * N + 1000 + 400 * psyFois && promesse.reste === COURSES(N) - promesse.engage && promesse.reste >= 0, JSON.stringify(promesse));

        if (sc === SCENARIOS[0]) {
            /* ── E. Les Rayons X : le rythme sur chaque étiquette ───────── */
            await page.mouse.move(2, 2); await page.waitForTimeout(150);
            await page.hover('[data-pulse-cat][data-cat="alimentation"]'); await page.waitForTimeout(350);
            const rx = await page.evaluate(() => { const p = document.querySelector('[data-rayonx]'); return p && { tags: [...p.querySelectorAll('[data-rx-poste]')].map(e => e.textContent.replace(/\s/g, '')), unites: [...p.querySelectorAll('[data-rx-poste]')].map(e => e.dataset.unite), entete: p.querySelector('[data-rx-prevu-semaines]')?.textContent.replace(/\s/g, '') }; });
            const a = (nom) => rx && rx.tags.find(t => t.includes(nom + ':'));
            v('E. Rayons X : [Hri : 1 000 DH / cycle] [Psy : 400 DH / 15 j] [L7m : 150 DH / sem] [khdra : 100 DH / sem]',
              !!rx && a('Hri').endsWith('Hri:1000DH/cycle') && a('Psy').endsWith('Psy:400DH/15j') && a('L7m').endsWith('L7m:150DH/sem') && a('khdra').endsWith('khdra:100DH/sem'), JSON.stringify(rx));
            v(`  → triées par poids dans le cycle (Hri, Psy, L7m, khdra) ; en-tête « cycle de ${N} semaines »`,
              !!rx && rx.tags.map(t => t.replace(/^[^A-Za-z]+/, '').split(':')[0]).join() === 'Hri,Psy,L7m,khdra' && rx.entete === `cyclede${N}semaines`, JSON.stringify(rx));
            await page.mouse.move(2, 2); await page.waitForTimeout(250);
            //  Le tri suit le POIDS dans le cycle, pas le montant affiché : L7m 250 / sem (1 250 sur 5
            //  semaines) passe devant Hri 1 000 / cycle — à montant égal, le plus gros montant d'abord.
            const ordre = await page.evaluate(async (ST) => {
                const st = eval(ST), a = st.donneesAnnuelles[st.moisBudgetaire.an].chargesVariables.alimentation;
                a.details[0].montant = 250; st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 120));
                const o = st.liberteCycle.categories.find(c => c.key === 'alimentation').prevu.map(p => p.nom);
                a.details[0].montant = 150; st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 120));
                return o;
            }, ST);
            v('  → L7m à 250 / sem (1 250 ce cycle) passe devant Hri 1 000 / cycle : le tri suit le poids du cycle', ordre.join() === 'L7m,Hri,Psy,khdra', ordre.join());

            /* ── F. Les moteurs mois par mois ─────────────────────────── */
            const prev = await page.evaluate((ST) => { const st = eval(ST), an = st.moisBudgetaire.an, out = [];
                for (let m = 1; m <= 12; m++) { const r = st.respirationDuMois(an, m); out.push({ m, courses: (r.lignes.conso.find(l => l.nom === 'COURSES') || {}).montant, factures: (r.lignes.mensuelles.find(l => l.nom === 'FACTURES') || {}).montant }); }
                return out; }, ST);
            v('F. Prévisionnel des 12 mois : COURSES ligne par ligne, avec les semaines de CHAQUE mois',
              prev.every(p => p.courses === COURSES(semainesCycle(p.m, sc.an, JDP))), JSON.stringify(prev.filter(p => p.courses !== COURSES(semainesCycle(p.m, sc.an, JDP)))));
            v('  → FACTURES (lignes héritées au /cycle) : 399 chaque mois, comme avant', prev.every(p => p.factures === 399), JSON.stringify(prev.map(p => p.factures)));
            const surplus = await page.evaluate(async (ST) => {
                const st = eval(ST), an = st.moisBudgetaire.an, hri = st.donneesAnnuelles[an].chargesVariables.alimentation.details[2];
                st.anneeAffichage = an;
                const lire = async () => { st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 120)); return JSON.parse(JSON.stringify(st.surplusParMois)); };
                const cycle = await lire();
                hri.periode = 'semaine';
                const semaine = await lire();
                hri.periode = 'cycle'; await lire();
                return { cycle, semaine, an };
            }, ST);
            const deltas = surplus.cycle.filter(x => !x.isPast && !x.isCurrent).map(x => ({ m: x.mNum, d: Math.round(x.brut - surplus.semaine.find(y => y.mNum === x.mNum).brut) }));
            v('  → surplus du mois : Hri « /cycle » coûte 1 000 ; « /sem » coûterait 1 000 × N (écart 1 000 × (N − 1))',
              deltas.length > 0 && deltas.every(x => x.d === 1000 * (semainesCycle(x.m, surplus.an, JDP) - 1)), JSON.stringify(deltas));
            const mSuiv = sc.mois === 12 ? 1 : sc.mois + 1;
            const jl = await page.evaluate(async ({ ST, mSuiv }) => { const st = eval(ST); st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 150));
                const lib = st.nomDuMois(mSuiv) + ' ' + st.moisBudgetaire.an;
                const e = Object.values(st.bilan.journal).flat().find(x => x.libelle === 'Charges variables' && x.mois === lib); return e ? Math.round(e.montant) : null; }, { ST, mSuiv });
            const Ns = semainesCycle(mSuiv, sc.an, JDP);
            v(`  → journal, ${['', 'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'][mSuiv]} : COURSES + 400 × ${Ns} + 860 + 399`, jl === Math.round(COURSES(Ns) + 400 * Ns + 860 + 399), JSON.stringify([jl, COURSES(Ns) + 400 * Ns + 1259]));

            /* ── G. L'éditeur des détails ──────────────────────────────── */
            await page.evaluate(async (ST) => { const st = eval(ST), d = st.donneesAnnuelles[st.moisBudgetaire.an].chargesVariables;
                d.alimentation.showDetails = true; d.factures.showDetails = true; st.appMode = 'previsionnel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'parametres'; }, ST);
            await page.waitForTimeout(600);
            const selects = () => page.evaluate(() => [...document.querySelectorAll('[data-cv-detail-periode]')].map(s => s.value));
            const s0 = await selects();
            v('G. un sélecteur par ligne : COURSES /sem · /15j · /cycle · /sem (hérité) ; FACTURES /cycle · /cycle',
              JSON.stringify(s0) === JSON.stringify(['semaine', 'quinzaine', 'cycle', 'semaine', 'cycle', 'cycle']), JSON.stringify(s0));
            const sel = await page.$$('[data-cv-detail-periode]');
            await sel[3].selectOption('cycle'); await page.waitForTimeout(300);
            const apres = await page.evaluate((ST) => { const st = eval(ST), a = st.donneesAnnuelles[st.moisBudgetaire.an].chargesVariables.alimentation;
                return { periode: a.details[3].periode, budget: st.liberteCycle.categories.find(c => c.key === 'alimentation').budget, valeur: a.valeur,
                         ligne: [...document.querySelectorAll('[data-cv-semaines]')][0]?.querySelector('[data-cv-cycle]')?.textContent.replace(/\s/g, '') }; }, ST);
            let sa = 0; for (let m = 1; m <= 12; m++) sa += semainesCycle(m, sc.an, JDP);
            const nMoy = sa / 12, eq = Math.round((150 * nMoy + 400 * nMoy / 2 + 1100) / nMoy);
            const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
            v(`  → khdra passée à /cycle : enregistrée, COURSES = 150 × ${N} + 400 × ${N}/2 + 1 100, le calcul du cycle suit`,
              apres.periode === 'cycle' && apres.budget === 150 * N + 200 * N + 1100 && apres.ligne === `${MOIS[sc.mois - 1]}:${N}sem.→${nf(150 * N + 200 * N + 1100)}DH`, JSON.stringify(apres));
            v(`  → la valeur résumée = l'équivalent / sem sur ${sa} semaines (${eq}), plus la somme brute (1 650)`, apres.valeur === eq, JSON.stringify([apres.valeur, eq]));
            await sel[3].selectOption('semaine'); await page.waitForTimeout(200);
            const ajout = await page.evaluate(async (ST) => {
                const st = eval(ST), d = st.donneesAnnuelles[st.moisBudgetaire.an].chargesVariables;
                const boutons = [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === '+ Nouvelle ligne');
                boutons[0].click(); boutons[boutons.length - 1].click(); await new Promise(r => setTimeout(r, 200));
                const r = [d.alimentation.details.at(-1).periode, d.factures.details.at(-1).periode];
                d.alimentation.details.pop(); d.factures.details.pop(); await new Promise(r2 => setTimeout(r2, 100));
                return r;
            }, ST);
            v('  → « + Nouvelle ligne » prend le rythme de sa catégorie : /sem (COURSES), /cycle (FACTURES)', JSON.stringify(ajout) === '["semaine","cycle"]', JSON.stringify(ajout));
        }
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
