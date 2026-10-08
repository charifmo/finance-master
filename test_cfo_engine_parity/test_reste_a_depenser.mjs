/**
 * v37.23 — LE RESTE À DÉPENSER DU CYCLE (remplace le Pulse hebdomadaire).
 *
 *   Deux frictions de la vraie vie :
 *     1. « La dictature de la date » : on doit pouvoir déclarer ses dépenses EN
 *        VRAC (un total par catégorie, sans date) et obtenir un chiffre juste.
 *     2. Deux chiffres concurrents (gauche / droite) : un seul endroit parle de
 *        l'argent à vivre — la carte « Reste à dépenser ».
 *   Cette suite vérifie, contre des calculs faits à la main :
 *     - engagé(catégorie) = max(compteur en vrac, Σ tickets datés du cycle),
 *       jamais la somme ; les tickets comptent sans bouton ;
 *     - une catégorie non déclarée reste ESTIMÉE à son rythme attendu (déclarer
 *       une catégorie ne fait pas croire que les autres n'ont rien coûté) ;
 *     - la carte = le moteur (enveloppeConsoRestante, budgetConsoRestantReel) ;
 *     - le rythme (par semaine, par jour) se déduit du temps restant (moteur ; la carte ne
 *       l'affiche plus depuis la v37.32) ;
 *     - v37.24 : la saisie en vrac se fait sur la LIGNE de la carte (un champ
 *       par catégorie) ; l'ancien bloc « Réalisé à T0 » a disparu ; les Rayons X
 *       ne servent plus qu'à l'audit ; le mode Voyage survit, replié.
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
console.log('\n  RESTE À DÉPENSER DU CYCLE : SAISIE EN VRAC, RYTHME, RÔLES\n  ' + '─'.repeat(80));

/* ── A. Statique ─────────────────────────────────────────────────────── */
v('plus de Pulse hebdomadaire ni de « filet » concurrent', !/const pulseHebdo = computed/.test(html) && !/data-meteo-filet/.test(html));
v('la carte de droite s\'appelle « Reste à dépenser »', /💸 Reste à dépenser/.test(html) && /data-liberte-jours/.test(html));
//  v37.32 : plus de tuiles « par semaine » ni « par jour » — pollution visuelle, anxiogène en pleine urgence
v('  → sans tuiles « ≈ par semaine » ni « par jour » (v37.32)', !/data-liberte-semaine/.test(html) && !/data-meteo-jour/.test(html) && !/data-liberte-rythme/.test(html) && !/≈ Par semaine/.test(html));

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
    const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'twrad-'));
    fs.writeFileSync(path.join(tmp, 'in.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
    fs.writeFileSync(path.join(tmp, 'cfg.js'), 'module.exports={content:[' + JSON.stringify(path.join(RACINE, 'index.html')) + '],theme:{extend:{}}};');
    execFileSync(twBin, ['-c', path.join(tmp, 'cfg.js'), '-i', path.join(tmp, 'in.css'), '-o', path.join(tmp, 'out.css'), '--minify'], { stdio: 'ignore' });
    const css = fs.readFileSync(path.join(tmp, 'out.css'), 'utf8');
    return css.length > 10000 ? css : null;
});

/* ── B. Le décor : un budget conso lisible à la main ─────────────────── */
//    COURSES 1 000 / sem. → 1 000 × N · SORTIES 400 / sem. → 400 × N · ESSENCE 860 / mois
//    (v37.29 : N = les semaines RÉELLES du cycle — 5 ici, du 8 oct. au 7 nov. 2026)
//    budget conso du cycle = 1 400 × N + 860 (factures exclues)
//  L'HORLOGE EST FIXÉE (navigateur compris) : dimanche 11 octobre 2026 — la PREMIÈRE semaine du cycle
//  (5-11 oct., jeudi 8 = jour de paie), pas encore écoulée : les règles de saisie se testent sans le
//  prévu par défaut des semaines écoulées (v37.31), que la section L, elle, joue au mercredi 14
//  (horloge H14 : la semaine du 5 au 11 est alors écoulée). Le calendrier ne dépend plus du jour
//  du test, et les deux règles de rattachement d'une semaine (jeudi / lundi) restent distinguables.
const maintenant = new Date(2026, 9, 11, 10, 0, 0);
const H14 = new Date(2026, 9, 14, 10, 0, 0);
const dans14 = (k) => new Date(2026, 9, 14 + k);
const IDX14 = 2;                                                              // mercredi
const T = maintenant.getDate();
//  v37.27 : une semaine appartient au cycle où tombe son JEUDI. Paie le 8 (un jeudi) : le cycle va du
//  jeudi 8 oct. au 7 nov. — la semaine du 5 au 11 (jeudi 8 = début du cycle) et les suivantes en font
//  partie ; celle d'avant (28 sept.-4 oct., jeudi 1ᵉʳ) est dans le cycle précédent.
const jourDePaie = 8;
const Y = maintenant.getFullYear(), MC = maintenant.getMonth() + 1;
const MOIS_BUDGET = T >= jourDePaie ? (MC === 12 ? 1 : MC + 1) : MC;
const AN_BUDGET = (T >= jourDePaie && MC === 12) ? Y + 1 : Y;
const dans = (k) => new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() + k);
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
fx.donneesAnnuelles = {};
for (const an of [AN_BUDGET - 1, AN_BUDGET, AN_BUDGET + 1]) fx.donneesAnnuelles[an] = JSON.parse(JSON.stringify(base));
Object.assign(fx.soldesInitiaux, { moisActuel: MOIS_BUDGET, anneeActuelle: AN_BUDGET, jourDePaie,
    compteChargesFixes: 'courant', compteChargesVariables: 'courant', assurances_tracker: [], voyageDebut: '', voyageFin: '' });
fx.comptes = [{ id: 1, label: 'Compte Courant', type: 'courant', solde: 60000, icone: '💳' }];
const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
for (const an of Object.keys(fx.donneesAnnuelles)) {
    const d = fx.donneesAnnuelles[an];
    const Rv = (label, b, j) => ({ ...neutre, label, base: b, jourPrevu: j, destinationCompte: 'courant' });
    d.revenus = { salaire: Rv('SALAIRE', 20000, jourDePaie), bonif: Rv('—', 0), magasin: Rv('—', 0), cnss: Rv('—', 0), appart: Rv('—', 0), studio: Rv('—', 0) };
    const Fx = (label, valeur) => ({ ...neutre, label, valeur, jourPrevu: null });
    d.chargesFixes = { creditImmo: Fx('LOYER', 6000), creditStudio: Fx('—', 0), syndic: Fx('—', 0), nounou: Fx('—', 0), ecole: Fx('—', 0),
                       femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
    const V = (label, valeur, periode, details = []) => ({ ...neutre, label, valeur, periode, details });
    d.chargesVariables = {
        alimentation: V('COURSES', 1000, 'semaine', [{ id: 1, nom: 'HRI', montant: 600 }, { id: 2, nom: 'L7M', montant: 400 }]),
        sorties: V('SORTIES', 400, 'semaine'), voiture: V('ESSENCE', 860, 'mois'), sante: V('—', 0, 'semaine'),
        factures: { ...V('FACTURES', 800, 'mois'), categorieId: 'cat_cv_factures' },
    };
    d.epargne = []; d.depensesIrregulieres = []; d.virementsInternes = []; d.transactionsReelles = []; d.consoRealiseeT0 = {};
}
//  v37.29 : les jeudis entre la paie de M−1 et la veille de celle de M, comptés jour par jour
const semainesCycle = (mois, an, jdp) => { let n = 0; for (let d = new Date(an, mois - 2, jdp); d <= new Date(an, mois - 1, jdp - 1); d.setDate(d.getDate() + 1)) if (d.getDay() === 4) n++; return n; };
const NS = semainesCycle(MOIS_BUDGET, AN_BUDGET, jourDePaie);
const BUDGET = 1000 * NS + 400 * NS + 860;
const IDX = (maintenant.getDay() + 6) % 7;                                   // 0 = lundi

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
    await page.clock.setFixedTime(maintenant);
    const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
    page.on('dialog', d => d.accept());
    await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
    await page.waitForTimeout(600);
    await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'pilotage'; }, ST);
    await page.waitForTimeout(600);
    return { page, erreurs };
};
const nf = (n) => new Intl.NumberFormat('fr-FR').format(n).replace(/\s/g, '');
const sansEsp = (t) => String(t || '').replace(/\s/g, '');

try {
    const { page, erreurs } = await ouvrir({ viewport: { width: 1400, height: 1100 } });
    const present = await page.evaluate((ST) => !!eval(ST).liberteCycle && typeof eval(ST).saisirCompteurConso === 'function', ST);
    v('liberteCycle et la saisie en vrac sont exposés', present, 'absents');
    if (!present) throw new Error('ABSENT');

    //  Recharge la page à une autre HEURE (horloge fixe) : l'état repart de la fixture.
    const recharger = async (horloge) => {
        await page.clock.setFixedTime(horloge);
        await page.reload({ waitUntil: 'load' });
        await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
        await page.waitForTimeout(600);
        await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'pilotage'; }, ST);
        await page.waitForTimeout(600);
    };
    const lire = () => page.evaluate((ST) => {
        const st = eval(ST);
        const L = JSON.parse(JSON.stringify(st.liberteCycle));
        const cat = (k) => L.categories.find(c => c.key === k) || {};
        return { L, cat: { a: cat('alimentation'), s: cat('sorties'), e: cat('voiture') },
                 env: Math.round(st.enveloppeConsoRestante), rav: Math.round(st.budgetConsoRestantReel), prorata: Math.round(st.enveloppeConsoProrataTemps),
                 cash: Math.round(st.cashDispoPourConso), jours: st.joursRestantsAvantPaie, budgetConso: st.budgetConsoCycle,
                 t0: JSON.parse(JSON.stringify(st.consoCategoriesT0)) };
    }, ST);
    const compteur = (k, val) => page.evaluate(async ({ ST, k, val }) => { const st = eval(ST); st.saisirCompteurConso(k, val); await new Promise(r => setTimeout(r, 150)); }, { ST, k, val });
    const tickets = (liste) => page.evaluate(async ({ ST, liste }) => {
        const st = eval(ST);
        Object.values(st.donneesAnnuelles).forEach(d => { d.transactionsReelles = []; });
        const cv = st.donneesAnnuelles[st.moisBudgetaire.an].chargesVariables;
        liste.forEach((t, i) => st.donneesAnnuelles[st.moisBudgetaire.an].transactionsReelles.push(
            { id: 700 + i, date: t.date, libelle: 'T' + i, montant: t.montant, categorieId: cv[t.cat].categorieId, compteId: 1, source: 'test' }));
        st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 150));
    }, { ST, liste });
    const solde = (x) => page.evaluate(async ({ ST, x }) => { const st = eval(ST); st.comptes[0].solde = x; st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 150)); }, { ST, x });

    /* ── C. Rien de déclaré : l'estimation du moteur, dite comme telle ── */
    const a0 = await lire();
    const i0cats = a0.L.categories.filter(c => !c.prevu.length).map(c => c.key);       // sans poste : une case
    const i0postes = a0.L.categories.filter(c => c.prevu.length).map(c => c.key);       // avec postes : un ✎ qui déplie
    v(`budget conso du cycle = ${BUDGET} (1 000 × ${NS} + 400 × ${NS} + 860 : les ${NS} semaines réelles du cycle)`, a0.L.budget === BUDGET && a0.budgetConso === BUDGET, JSON.stringify([a0.L.budget, a0.budgetConso]));
    v('rien de déclaré → « estimé », reste = prorata du moteur', !a0.L.declare && a0.L.rythme === 'estime' && a0.L.reste === a0.prorata && a0.L.reste === a0.rav,
      JSON.stringify({ declare: a0.L.declare, reste: a0.L.reste, prorata: a0.prorata, rav: a0.rav }));
    v('  → chaque catégorie s\'affiche à son rythme attendu', Object.values(a0.cat).every(c => c.source === 'estime' && c.engage === c.theorique), JSON.stringify(a0.cat));
    const jours = Math.max(1, a0.jours);
    v('rythme : par semaine = reste ÷ jours avant la paie × 7, par jour = reste ÷ jours',
      a0.L.parSemaine === Math.floor(a0.L.reste / jours * 7) && a0.L.parJour === Math.floor(a0.L.reste / jours) && a0.L.jours === jours,
      JSON.stringify({ reste: a0.L.reste, jours, sem: a0.L.parSemaine, j: a0.L.parJour }));

    /* ── D. Saisie EN VRAC, sans aucune date ──────────────────────────── */
    await compteur('alimentation', 2500);
    const a1 = await lire();
    v('compteur en vrac : Courses = 2 500, source « compteur », aucun ticket daté', a1.cat.a.engage === 2500 && a1.cat.a.source === 'compteur' && a1.L.nbTickets === 0,
      JSON.stringify(a1.cat.a));
    v('  → les autres catégories restent ESTIMÉES à leur rythme', a1.cat.s.source === 'estime' && a1.cat.s.engage === a1.cat.s.theorique && a1.cat.e.engage === a1.cat.e.theorique,
      JSON.stringify([a1.cat.s, a1.cat.e]));
    const attenduA = a0.cat.a.theorique;
    v('  → déclarer 2 500 là où 1 rythme attendait X fait bouger le reste de exactement X − 2 500',
      Math.abs((a0.L.reste - a1.L.reste) - (2500 - attenduA)) <= 2, JSON.stringify({ avant: a0.L.reste, apres: a1.L.reste, attenduA }));
    v('la carte = le moteur : reste = enveloppeConsoRestante = budgetConsoRestantReel', a1.L.reste === a1.env && a1.env === a1.rav && a1.L.declare, JSON.stringify([a1.L.reste, a1.env, a1.rav]));
    v('  → reste = budget − Σ engagés (déclarés + estimés)',
      a1.L.reste === BUDGET - a1.L.categories.reduce((s, c) => s + c.engage, 0), JSON.stringify([a1.L.reste, a1.L.categories.map(c => [c.key, c.engage])]));
    await compteur('alimentation', '');
    const a2 = await lire();
    v('vider le champ retire la déclaration : retour à l\'estimation', a2.cat.a.source === 'estime' && a2.L.reste === a0.L.reste && !a2.L.declare, JSON.stringify([a2.cat.a, a2.L.reste]));
    //  « 0 » veut dire « rien dépensé » dès qu'une vraie déclaration existe ; seul,
    //  il ne bascule pas le cycle au réel (d'anciens 0 traînent dans les données).
    await compteur('sorties', 0);
    const a3 = await lire();
    await compteur('alimentation', 2500);
    const a4 = await lire();
    v('« 0 » seul ne bascule rien ; avec une vraie déclaration, il veut dire « rien dépensé »',
      !a3.L.declare && a3.cat.s.source === 'estime' && a4.L.declare && a4.cat.s.source === 'compteur' && a4.cat.s.engage === 0,
      JSON.stringify([a3.L.declare, a3.cat.s.source, a4.cat.s]));
    await compteur('sorties', '');
    await compteur('alimentation', '');

    /* ── E. Tickets datés : comptés sans bouton, jamais en double ─────── */
    await tickets([
        { date: iso(maintenant), montant: 300, cat: 'sorties' },
        { date: iso(maintenant), montant: 150, cat: 'sorties' },
        { date: iso(dans(-45)), montant: 999, cat: 'sorties' },      // cycle précédent
        { date: iso(dans(1)), montant: 777, cat: 'sorties' },        // demain
    ]);
    const b1 = await lire();
    const t0s = b1.t0.find(c => c.key === 'sorties');
    v('tickets du cycle (300 + 150) comptés sans « ⚡ Depuis le réel »', b1.cat.s.engage === 450 && b1.cat.s.source === 'tickets' && b1.cat.s.nb === 2 && t0s.tickets === 450 && t0s.saisi === 0,
      JSON.stringify({ s: b1.cat.s, t0s }));
    v('  → le moteur passe au réel, et le compteur du Réalisé reste vide (saisi = 0)', b1.L.declare && b1.L.reste === b1.env && t0s.engage === 450, JSON.stringify([b1.L.declare, b1.L.reste, b1.env]));
    await compteur('sorties', 1000);
    const b2 = await lire();
    v('compteur 1 000 + tickets 450 → engagé 1 000 (le plus grand, pas 1 450)', b2.cat.s.engage === 1000 && b2.cat.s.source === 'compteur', JSON.stringify(b2.cat.s));
    await compteur('sorties', 200);
    const b3 = await lire();
    v('compteur 200 < tickets 450 → engagé 450 (les tickets complètent)', b3.cat.s.engage === 450 && b3.cat.s.source === 'tickets', JSON.stringify(b3.cat.s));
    await compteur('sorties', '');

    /* ── F. Rythme du cycle, sans dater ───────────────────────────────── */
    await tickets([]);
    await compteur('alimentation', attenduA);
    const r1 = await lire();
    v('Courses déclarée au rythme attendu → « tenu »', r1.L.rythme === 'tenu', JSON.stringify([r1.L.rythme, r1.L.engage, r1.L.attendu]));
    await compteur('alimentation', attenduA + 500);
    const r2 = await lire();
    v('500 au-dessus du rythme (> 5 % du budget) → « avance »', r2.L.rythme === 'avance', JSON.stringify([r2.L.rythme, r2.L.engage, r2.L.attendu]));
    await compteur('alimentation', 8000);
    const r3 = await lire();
    v('au-delà du budget du cycle → « depasse », écart chiffré, reste 0',
      r3.L.rythme === 'depasse' && r3.L.depassement === r3.L.engage - BUDGET && r3.L.reste === 0 && r3.cat.a.reste === 1000 * NS - 8000, JSON.stringify([r3.L.rythme, r3.L.depassement, r3.L.reste]));
    await compteur('alimentation', 1000);

    /* ── G. Le cash mord : la carte ne promet pas plus que le compte ──── */
    const c0 = await lire();
    const K = c0.cash - 60000;
    await solde(900 - K);
    const c1 = await lire();
    v('cash serré → reste = cash disponible, contrainte « trésorerie »',
      c1.L.contrainte === 'tresorerie' && c1.L.reste === c1.cash && c1.L.reste < c1.L.resteBudget && c1.L.parSemaine === Math.floor(c1.L.reste / jours * 7),
      JSON.stringify({ reste: c1.L.reste, cash: c1.cash, budget: c1.L.resteBudget }));
    const plafond = await page.evaluate(() => document.querySelector('[data-pulse-plafond]')?.textContent || '');
    v('  → la carte le dit, avec les deux chiffres', /Plafonné par la trésorerie/.test(plafond) && sansEsp(plafond).includes(nf(c1.L.resteBudget)), plafond);
    await solde(60000);

    /* ── H. Le rendu : un chiffre, son rythme, la jauge du cycle ──────── */
    await page.waitForTimeout(900);
    const z = await lire();
    const dom = await page.evaluate(() => {
        const q = (s) => document.querySelector('[data-meteo] ' + s);
        const piste = q('[data-pulse-jauge]')?.parentElement, w = (e) => e.getBoundingClientRect();
        return { montant: q('[data-pulse-montant]')?.textContent, semaine: q('[data-liberte-semaine]')?.textContent, jour: q('[data-meteo-jour]')?.textContent,
                 jours: q('[data-liberte-jours]')?.textContent, legende: q('[data-pulse-legende]')?.textContent,
                 jauge: piste ? w(q('[data-pulse-jauge]')).width / w(piste).width : null,
                 repere: piste ? (w(q('[data-pulse-repere]')).left + w(q('[data-pulse-repere]')).width / 2 - w(piste).left) / w(piste).width : null,
                 sources: Object.fromEntries([...document.querySelectorAll('[data-pulse-cat]')].map(b => [b.dataset.cat, b.dataset.source])),
                 estime: !!q('[data-liberte-estime]') };
    });
    v('la carte affiche le reste et les jours avant la paie (« dans N j ») — plus de « par semaine » ni « par jour »',
      sansEsp(dom.montant) === nf(z.L.reste) + 'DH' && dom.semaine === undefined && dom.jour === undefined && sansEsp(dom.jours) === '(dans' + z.L.jours + 'j)',
      JSON.stringify(dom));
    v('  → légende « X dépensés sur Y · N % »', sansEsp(dom.legende).includes(nf(z.L.engage) + 'DHdépenséssur' + nf(BUDGET) + 'DH') && sansEsp(dom.legende).includes(z.L.pct + '%'), dom.legende);
    if (twCss) v('  → jauge = engagé / budget, repère = rythme attendu', Math.abs(dom.jauge - z.L.pct / 100) < 0.015 && Math.abs(dom.repere - z.L.pctAttendu / 100) < 0.015,
      JSON.stringify([dom.jauge, z.L.pct, dom.repere, z.L.pctAttendu]));
    //  v37.27 : les lignes montrent la SEMAINE. Le compteur d'Alimentation (1 000, saisi sur le cycle
    //  via l'API) n'est pas dans cette semaine : la ligne est « vide », et la note le rappelle.
    const avant = await page.evaluate(() => document.querySelector('[data-pulse-categorie][data-cat="alimentation"] [data-pulse-cycle-avant]')?.textContent.replace(/\s/g, '') || '');
    v('  → les lignes disent la semaine ; le total de cycle d\'Alimentation (1 000) est rappelé',
      Object.values(dom.sources).every(x => x === 'vide') && !dom.estime && /1000DH/.test(avant), JSON.stringify([dom.sources, avant]));

    /* ── I. v37.24 : UNE seule saisie, sur la ligne de la carte ─────────── */
    const surface = await page.evaluate(() => ({
        //  Le titre exact du bloc (textContent : innerText applique « uppercase » ;
        //  le changelog, lui, cite encore le nom dans ses notes).
        ancienBloc: [...document.querySelectorAll('p')].some(p => p.textContent.trim() === 'Réalisé à T0 — conso engagée'),
        champsHorsMeteo: [...document.querySelectorAll('input[type=number]')].filter(i => !i.closest('[data-meteo]') && /conso|engag/i.test(i.closest('div')?.textContent || '')).length,
        champs: [...document.querySelectorAll('[data-meteo] [data-pulse-saisie]')].map(i => i.dataset.cat),
        ouvrir: [...document.querySelectorAll('[data-meteo] [data-pulse-ouvrir]')].map(i => i.dataset.cat),
        voyage: !!document.querySelector('[data-voyage]'),
    }));
    v('l\'ancien bloc « Réalisé à T0 » a quitté la page', !surface.ancienBloc, JSON.stringify(surface));
    v('une case par catégorie sans poste ; un bouton ✎ qui déplie les postes pour les autres',
      JSON.stringify(surface.champs) === JSON.stringify(i0cats) && JSON.stringify(surface.ouvrir) === JSON.stringify(i0postes) && i0postes.length > 0, JSON.stringify([surface, i0cats, i0postes]));
    await page.click('[data-meteo] [data-pulse-saisie][data-cat="sorties"]');
    await page.keyboard.type('640');
    await page.waitForTimeout(300);
    const i1 = await lire();
    const vu = await page.evaluate(() => ({ panneau: !!document.querySelector('[data-rayonx]'), montant: document.querySelector('[data-pulse-montant]')?.textContent.replace(/\s/g, '') }));
    v('cliquer sur la ligne Sorties et taper 640 : le moteur suit EN DIRECT, sans panneau',
      i1.cat.s.engage === 640 && i1.cat.s.source === 'compteur' && i1.L.reste === i1.env && !vu.panneau && vu.montant === nf(i1.L.reste) + 'DH', JSON.stringify({ s: i1.cat.s, vu, reste: i1.L.reste }));
    const persiste = await page.evaluate((ST) => { const st = eval(ST); const d = st.donneesAnnuelles[st.moisBudgetaire.an]; return JSON.parse(JSON.stringify(d.consoRealiseeT0 || {})); }, ST);
    v('  → enregistré dans le compteur du cycle (consoRealiseeT0)', Object.values(persiste).some(l => l && l.sorties === 640), JSON.stringify(persiste));
    await page.fill('[data-meteo] [data-pulse-saisie][data-cat="sorties"]', '');
    await page.waitForTimeout(300);
    v('  → vider le champ rend la catégorie à l\'estimation', (await lire()).cat.s.source === 'estime');
    //  v37.25 : le panneau d'audit ne doit JAMAIS recouvrir une case de saisie
    //  (capture de l'utilisateur : « je ne peux pas changer les valeurs »).
    await page.mouse.move(5, 5); await page.waitForTimeout(300);
    for (const cat of ['alimentation', 'sorties', 'voiture']) {
        const n = await (await page.$('[data-pulse-cat][data-cat="' + cat + '"]')).boundingBox();
        await page.mouse.move(n.x + 30, n.y + n.height / 2, { steps: 5 });
        await page.waitForTimeout(300);
        const couvre = await page.evaluate(() => {
            const p = document.querySelector('[data-rayonx]');
            if (!p) return { ouvert: false };
            const r = p.getBoundingClientRect();
            const mal = [...document.querySelectorAll('[data-pulse-saisie]')].filter(i => {
                const q = i.getBoundingClientRect(), e = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
                return e !== i;
            }).map(i => i.dataset.cat);
            return { ouvert: true, gauche: r.right <= document.querySelector('[data-liberte]').getBoundingClientRect().left, mal };
        });
        v('panneau de « ' + cat + ' » : à gauche de la carte, toutes les cases restent cliquables', couvre.ouvert && couvre.gauche && couvre.mal.length === 0, JSON.stringify(couvre));
    }
    //  Le parcours réel : survol du nom d'Alimentation, puis la souris glisse vers la case de Sorties
    const nA = await (await page.$('[data-pulse-cat][data-cat="alimentation"]')).boundingBox();
    await page.mouse.move(nA.x + 30, nA.y + nA.height / 2, { steps: 5 }); await page.waitForTimeout(300);
    const cS = await (await page.$('[data-pulse-saisie][data-cat="sorties"]')).boundingBox();
    await page.mouse.move(cS.x + cS.width / 2, cS.y + cS.height / 2, { steps: 15 }); await page.waitForTimeout(300);
    await page.mouse.down(); await page.mouse.up();
    await page.keyboard.type('777');
    await page.waitForTimeout(300);
    v('depuis le nom d\'Alimentation, glisser jusqu\'à la case de Sorties et taper 777 : ça marche', (await lire()).cat.s.engage === 777, JSON.stringify((await lire()).cat.s));
    await page.fill('[data-meteo] [data-pulse-saisie][data-cat="sorties"]', '');
    await page.mouse.move(5, 5); await page.waitForTimeout(300);
    //  Rayons X : l'audit seul, plus de champ de saisie
    await page.hover('[data-pulse-cat][data-cat="alimentation"]');
    await page.waitForTimeout(250);
    const audit = await page.evaluate(() => { const p = document.querySelector('[data-rayonx]'); return p ? { champ: !!p.querySelector('input'), retenu: p.querySelector('[data-rx-retenu]')?.textContent.trim() } : null; });
    v('Rayons X = audit : aucun champ dans le panneau, il dit ce qui est retenu', !!audit && !audit.champ && /Total saisi/.test(audit.retenu), JSON.stringify(audit));
    await page.mouse.move(5, 5); await page.waitForTimeout(300);
    //  ⓘ : le calcul du chiffre, terme à terme
    await page.hover('[data-liberte-calcul]');
    await page.waitForTimeout(250);
    const k = await lire();
    const calc = await page.evaluate(() => ({ ouvert: document.querySelector('[data-rayonx]')?.dataset.rxType, total: document.querySelector('[data-rayonx] [data-rx-total]')?.textContent.replace(/\s/g, '') }));
    v('ⓘ : 🅰️ budget − déclaré − estimé = reste au budget ; 🅱️ tréso + à venir − charges = cash',
      calc.ouvert === 'calcul' && calc.total === nf(k.L.reste) + 'DH'
      && k.L.budget - k.L.calcul.engageDeclare - k.L.calcul.engageEstime === k.L.resteBudget
      && Math.abs(k.L.calcul.treso + k.L.calcul.revenusAttente - k.L.calcul.obligations - k.L.cash) <= 1
      && k.L.reste === Math.max(0, Math.min(k.L.resteBudget, k.L.cash)), JSON.stringify({ calc, L: { budget: k.L.budget, resteBudget: k.L.resteBudget, cash: k.L.cash, reste: k.L.reste, calcul: k.L.calcul } }));
    await page.mouse.move(5, 5); await page.waitForTimeout(300);
    //  Le mode Voyage, rescapé de l'ancien bloc
    const vy = await page.evaluate(async (ST) => {
        const st = eval(ST);
        const avant = st.consoCategoriesT0.find(c => c.key === 'sorties').suspendue;
        document.querySelector('[data-voyage]').open = true;
        await new Promise(r => setTimeout(r, 100));
        document.querySelector('[data-voyage-cat][data-cat="sorties"]').click();
        await new Promise(r => setTimeout(r, 150));
        const apres = st.consoCategoriesT0.find(c => c.key === 'sorties').suspendue;
        document.querySelector('[data-voyage-cat][data-cat="sorties"]').click();
        await new Promise(r => setTimeout(r, 150));
        return { avant, apres, dates: !!document.querySelector('[data-voyage-debut]') && !!document.querySelector('[data-voyage-fin]') };
    }, ST);
    v('le mode Voyage survit : dates d\'absence et catégories suspendues', surface.voyage && vy.dates && vy.avant !== vy.apres, JSON.stringify(vy));
    /* ── K. v37.26 : une case par POSTE, pas de totaux à éditer ─────────── */
    await page.mouse.move(5, 5);
    await page.evaluate(async (ST) => { const st = eval(ST); st.resetConsoT0(); await new Promise(r => setTimeout(r, 150)); }, ST);
    const k0 = await lire();
    const cA = k0.L.categories.find(c => c.key === 'alimentation');
    v('Alimentation (2 postes) : plus de case « total », un bouton ✎ qui déplie',
      await page.evaluate(() => !document.querySelector('[data-meteo] [data-pulse-saisie][data-cat="alimentation"]') && !!document.querySelector('[data-meteo] [data-pulse-ouvrir][data-cat="alimentation"]') && !document.querySelector('[data-pulse-postes]')));
    await page.click('[data-pulse-ouvrir][data-cat="alimentation"]');
    await page.waitForTimeout(250);
    const lignes = await page.evaluate(() => [...document.querySelectorAll('[data-pulse-postes] [data-pulse-poste]')].map(e => e.dataset.poste));
    v('déplier : une case par poste (HRI, L7M) + « Autre »', JSON.stringify(lignes) === JSON.stringify([cA.prevu[0].cle, cA.prevu[1].cle, 'libre']) && lignes.length === 3, JSON.stringify([lignes, cA.prevu.map(p => p.cle)]));
    //  v37.28 : une case vaut ce qu'on a TAPÉ — vide, invite « 0 » ; le prévu se lit À CÔTÉ
    const vierge = await page.evaluate(() => [...document.querySelectorAll('[data-pulse-poste-saisie]')].map(i => ({ v: i.value, p: i.placeholder })));
    const prevuP = await page.evaluate(() => [...document.querySelectorAll('[data-pulse-postes] [data-pulse-poste]')].map(e => {
        const t = e.querySelector('[data-pulse-prevu]'); return t ? { t: t.textContent.replace(/\s/g, ''), dansCase: !!t.closest('label') || !!t.querySelector('input') } : null; }));
    v('  → avant toute saisie, chaque case est VIDE (invite « 0 », pas d\'estimation) ; « Prévu : 600 DH » / « 400 DH » se lisent à côté',
      vierge.length === 3 && vierge.every(x => x.v === '' && x.p === '0') && prevuP[0] && prevuP[0].t === 'Prévu:600DH' && prevuP[1] && prevuP[1].t === 'Prévu:400DH'
      && !prevuP[0].dansCase && !prevuP[1].dansCase, JSON.stringify([vierge, prevuP]));
    const [pH, pL] = cA.prevu;                                            // HRI 600 → 600 × N ; L7M 400 → 400 × N sur le cycle (v37.29)
    v('  → le budget du cycle de chaque poste s\'affiche (600 × ' + NS + ' / 400 × ' + NS + ')', pH.partCycle === 600 * NS && pL.partCycle === 400 * NS && pH.cle === 'alimentation::1', JSON.stringify([pH, pL]));
    await page.click('[data-pulse-poste-saisie][data-poste="' + pH.cle + '"]');
    await page.keyboard.type('800');
    await page.keyboard.press('Enter');
    const actif = await page.evaluate(() => document.activeElement.dataset.poste);
    await page.keyboard.type('300');
    await page.waitForTimeout(300);
    const k1 = await lire();
    const kA = k1.cat.a;
    v('taper 800, Entrée → focus sur le poste suivant ; 300 : Alimentation = 1 100, en direct',
      actif === pL.cle && kA.engage === 1100 && kA.saisi === 1100 && kA.source === 'compteur' && k1.L.reste === k1.env, JSON.stringify({ actif, kA }));
    const stock = await page.evaluate((ST) => { const st = eval(ST); const d = st.donneesAnnuelles[st.moisBudgetaire.an]; return JSON.parse(JSON.stringify(Object.values(d.consoRealiseeT0 || {})[0] || {})); }, ST);
    v('  → stocké dans le compteur du cycle, par poste (alimentation::1, ::2)', stock['alimentation::1'] === 800 && stock['alimentation::2'] === 300 && stock.alimentation === undefined, JSON.stringify(stock));
    const total = await page.evaluate(() => document.querySelector('[data-pulse-ouvrir][data-cat="alimentation"] [data-pulse-total]').textContent.replace(/\s/g, ''));
    v('  → le total de la ligne se met à jour (lecture seule) : 1100', total === '1100', total);
    await page.fill('[data-pulse-poste-saisie][data-poste="libre"]', '200');
    await page.waitForTimeout(250);
    v('« Autre » 200 s\'ajoute : 1 300', (await lire()).cat.a.engage === 1300);
    await page.click('[data-pulse-poste-saisie][data-poste="' + pH.cle + '"]');
    await page.keyboard.type('+50');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
    const k2 = await lire();
    const hv = await page.evaluate((cle) => document.querySelector('[data-pulse-poste-saisie][data-poste="' + cle + '"]').value, pH.cle);
    v('« +50 » + Entrée AJOUTE au poste : 800 → 850, total 1 350', hv === '850' && k2.cat.a.engage === 1350, JSON.stringify([hv, k2.cat.a.engage]));
    await page.click('[data-pulse-poste-saisie][data-poste="' + pH.cle + '"]');
    await page.keyboard.type('abc');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
    const hv2 = await page.evaluate((cle) => document.querySelector('[data-pulse-poste-saisie][data-poste="' + cle + '"]').value, pH.cle);
    v('un texte invalide est refusé : le poste garde 850', hv2 === '850' && (await lire()).cat.a.engage === 1350, hv2);
    await page.fill('[data-pulse-poste-saisie][data-poste="' + pH.cle + '"]', '');
    await page.waitForTimeout(250);
    const k3 = await lire();
    v('vider un poste le retire : 850 en moins → 500', k3.cat.a.engage === 500 && k3.cat.a.prevu[0].declare === false, JSON.stringify([k3.cat.a.engage, k3.cat.a.prevu.map(p => p.declare)]));
    //  Un ticket daté de 900 sur HRI, compteur 500 : le plus grand l'emporte
    await tickets([{ date: iso(maintenant), montant: 900, cat: 'alimentation', poste: 'HRI' }].map(t => ({ ...t, cat: 'alimentation' })));
    const k4 = await lire();
    v('compteur 500 < tickets 900 → engagé 900, le poste Hri montre 🧾 900', k4.cat.a.engage === 900 && k4.cat.a.source === 'tickets', JSON.stringify(k4.cat.a));
    await tickets([]);
    //  Un ancien total (v37.23/24) devient « Autre » et reste compté
    await page.evaluate(async (ST) => { const st = eval(ST); st.resetConsoT0(); st.saisirCompteurConso('alimentation', 2500); await new Promise(r => setTimeout(r, 200)); }, ST);
    await page.waitForTimeout(250);
    const k5 = await lire();
    const note = await page.evaluate(() => document.querySelector('[data-pulse-cycle-avant]')?.textContent.replace(/\s/g, '') || '');
    v('un ancien total de CYCLE (2 500) reste compté, et on le dit', k5.cat.a.engage === 2500 && /2500DH/.test(note), JSON.stringify([k5.cat.a.engage, note]));
    await page.fill('[data-pulse-poste-saisie][data-poste="' + pH.cle + '"]', '100');
    await page.waitForTimeout(250);
    v('  → et la saisie de la semaine s\'y ajoute : 2 600', (await lire()).cat.a.engage === 2600);
    await page.click('[data-pulse-retirer]');
    await page.waitForTimeout(250);
    v('  → « retirer » ôte l\'ancien total de cycle : il reste les 100 de la semaine', (await lire()).cat.a.engage === 100 && await page.evaluate(() => !document.querySelector('[data-pulse-cycle-avant]')));
    v('  → effacer le cycle remet tous les postes à zéro',
      await page.evaluate(async (ST) => { const st = eval(ST); st.resetConsoT0(); await new Promise(r => setTimeout(r, 200)); return !st.liberteCycle.declare; }, ST));
    await page.click('[data-pulse-ouvrir][data-cat="alimentation"]');
    await page.waitForTimeout(200);
    v('un second clic sur ✎ replie les postes', await page.evaluate(() => !document.querySelector('[data-pulse-postes]')));
    v('aucune erreur JavaScript (postes)', erreurs.length === 0, erreurs[0] || '');

    /* ── L. v37.27 : PAR SEMAINE — en cours, passée, à venir ──────────── */
    //  Au MERCREDI 14 : la semaine du 5 au 11 (dans le cycle) est ÉCOULÉE — v37.31 : ses lignes laissées
    //  vides comptent leur prévu. Hri 600 + L7M 400 + SORTIES 400 + ESSENCE 860 ÷ 5 = 172 → 1 572.
    await recharger(H14);
    const PREVU_ECOULEE = 600 + 400 + 400 + Math.round(860 / 5);
    await page.evaluate(async (ST) => { const st = eval(ST); st.resetConsoT0(); st.changerSemaine(0); await new Promise(r => setTimeout(r, 150)); }, ST);
    await tickets([]);
    const fr = (d) => d.getDate() + ' ' + ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'][d.getMonth()];
    const sem = (k) => ({ lundi: iso(dans14(-IDX14 + 7 * k)), du: fr(dans14(-IDX14 + 7 * k)), au: fr(dans14(-IDX14 + 7 * k + 6)) });
    const nav = () => page.evaluate(() => ({ titre: document.querySelector('[data-semaine-titre]')?.textContent.trim(), statut: document.querySelector('[data-semaine-statut]')?.dataset.statut,
        total: document.querySelector('[data-semaine-total]')?.textContent.replace(/\s/g, ''), aujourdhui: !!document.querySelector('[data-semaine-aujourdhui]'), hors: !!document.querySelector('[data-semaine-hors]') }));
    //  v37.28 : rien de déclaré → la semaine EN COURS vaut 0, cases vides, invite « 0 ».
    //  v37.31 : la semaine ÉCOULÉE compte son prévu, et ses cases le montrent (✓ au prévu).
    const est0 = await page.evaluate(() => ({ total: document.querySelector('[data-semaine-total]').textContent.replace(/\s/g, ''), cases: [...document.querySelectorAll('[data-pulse-saisie]')].map(i => i.placeholder),
        valeurs: [...document.querySelectorAll('[data-pulse-saisie]')].map(i => i.value), lignes: [...document.querySelectorAll('[data-pulse-total]')].map(e => e.textContent.replace(/\s/g, '')) }));
    await page.click('[data-semaine-prec]'); await page.waitForTimeout(250);
    const est1 = await page.evaluate(() => ({ total: document.querySelector('[data-semaine-total]').textContent.replace(/\s/g, ''), cases: [...document.querySelectorAll('[data-pulse-saisie]')].map(i => [i.dataset.cat, i.value, i.dataset.defaut || '']),
        note: !!document.querySelector('[data-semaine-defaut]') }));
    await page.click('[data-semaine-aujourdhui]'); await page.waitForTimeout(250);
    v('rien déclaré : la semaine EN COURS à 0 DH, cases vides (invite « 0 »), totaux de ligne à 0 — aucune estimation',
      est0.total.startsWith('0DH') && est0.cases.length > 0 && est0.cases.every(x => x === '0') && est0.valeurs.every(x => x === '') && est0.lignes.length > 0 && est0.lignes.every(x => x === '0'), JSON.stringify(est0));
    v(`  → la semaine ÉCOULÉE compte son prévu (${PREVU_ECOULEE} DH), ses cases le montrent (SORTIES 400, ESSENCE 172), avec la note`,
      est1.total.startsWith(PREVU_ECOULEE + 'DH') && est1.note && JSON.stringify(est1.cases) === JSON.stringify([['sorties', '400', '1'], ['voiture', '172', '1']]), JSON.stringify(est1));
    const n0 = await nav();
    v('barre de semaine : « Semaine du lundi au dimanche », en cours', n0.titre === 'Semaine du ' + sem(0).du + ' au ' + sem(0).au && n0.statut === 'en_cours' && !n0.aujourdhui, JSON.stringify([n0, sem(0)]));
    await page.click('[data-pulse-ouvrir][data-cat="alimentation"]');
    await page.waitForTimeout(200);
    await page.click('[data-pulse-poste-saisie][data-poste="alimentation::1"]'); await page.keyboard.type('320'); await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
    const w0 = await lire();
    v('saisie de la semaine en cours : 320 sur Hri → stocké sous le lundi, compté dans le cycle (+ 1 000 au prévu, semaine écoulée)',
      w0.cat.a.engage === 320 + 1000 && await page.evaluate((cle) => { const st = eval('document.querySelector("#app").__vue_app__._instance.setupState'); const d = st.donneesAnnuelles[st.moisBudgetaire.an]; return Object.keys(d.consoRealiseeT0 || {}).includes(cle); }, 'S' + sem(0).lundi),
      JSON.stringify([w0.cat.a.engage, sem(0).lundi]));
    //  ‹ : la semaine passée (dans le cycle) — écoulée : ses postes montrent leur prévu retenu
    await page.click('[data-semaine-prec]');
    await page.waitForTimeout(250);
    const n1 = await nav();
    const vide = await page.evaluate(() => [...document.querySelectorAll('[data-pulse-poste-saisie]')].map(i => [i.dataset.poste, i.value, i.dataset.defaut || '']));
    v('‹ : la semaine passée (« passée », « Cette semaine » apparaît) : Hri 600 et L7M 400 au prévu, « Autre » vide',
      n1.titre === 'Semaine du ' + sem(-1).du + ' au ' + sem(-1).au && n1.statut === 'passee' && n1.aujourdhui && !n1.hors
      && JSON.stringify(vide) === JSON.stringify([['alimentation::1', '600', '1'], ['alimentation::2', '400', '1'], ['libre', '', '']]), JSON.stringify([n1, vide]));
    await page.click('[data-pulse-poste-saisie][data-poste="alimentation::1"]'); await page.keyboard.type('410'); await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
    const w1 = await lire();
    v('saisir 410 sur Hri la semaine passée : il remplace son prévu — 320 + 410 + L7M 400 (au prévu) = 1 130', w1.cat.a.engage === 1130, JSON.stringify(w1.cat.a.engage));
    //  ‹‹ : deux semaines en arrière = le cycle précédent : dit, et ne change rien
    await page.click('[data-semaine-prec]');
    await page.waitForTimeout(250);
    const n2 = await nav();
    await page.click('[data-pulse-poste-saisie][data-poste="alimentation::1"]'); await page.keyboard.type('999'); await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
    const w2 = await lire();
    v('deux semaines en arrière : « cycle précédent », sa saisie ne change PAS le Reste à dépenser',
      n2.hors && w2.cat.a.engage === 1130 && w2.L.reste === w1.L.reste && await page.evaluate((cle) => { const st = eval('document.querySelector("#app").__vue_app__._instance.setupState'); return Object.values(st.donneesAnnuelles).some(d => d.consoRealiseeT0 && d.consoRealiseeT0[cle]); }, 'S' + sem(-2).lundi),
      JSON.stringify([n2, w2.cat.a.engage, w1.L.reste, w2.L.reste]));
    //  › › › : la semaine en cours, puis à venir
    await page.click('[data-semaine-suiv]'); await page.click('[data-semaine-suiv]');
    await page.waitForTimeout(250);
    const back = await page.evaluate(() => document.querySelector('[data-pulse-poste-saisie][data-poste="alimentation::1"]').value);
    v('› › : on retrouve la semaine en cours telle qu\'on l\'a laissée (Hri 320)', back === '320' && (await nav()).statut === 'en_cours', JSON.stringify([back, await nav()]));
    await page.click('[data-semaine-suiv]');
    await page.waitForTimeout(250);
    const n3 = await nav();
    await page.click('[data-pulse-poste-saisie][data-poste="alimentation::2"]'); await page.keyboard.type('150'); await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
    const w3 = await lire();
    v('semaine à venir : « à venir », saisissable (un achat déjà payé d\'avance) : 1 130 + 150 = 1 280',
      n3.statut === 'avenir' && n3.titre === 'Semaine du ' + sem(1).du + ' au ' + sem(1).au && w3.cat.a.engage === 1280, JSON.stringify([n3, w3.cat.a.engage]));
    //  La frontière de FIN du cycle (7 nov.) : la semaine du 2 au 8 nov. a son jeudi (5) dedans, pas son dimanche
    await page.click('[data-semaine-suiv]'); await page.click('[data-semaine-suiv]');
    await page.waitForTimeout(250);
    const n3b = await nav();
    await page.click('[data-pulse-poste-saisie][data-poste="alimentation::2"]'); await page.keyboard.type('60'); await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
    const w3b = await lire();
    v('semaine du 2 au 8 nov. (jeudi 5 dans le cycle, dimanche 8 dehors) : elle compte — 1 280 + 60 = 1 340',
      n3b.titre === 'Semaine du ' + sem(3).du + ' au ' + sem(3).au && !n3b.hors && w3b.cat.a.engage === 1340, JSON.stringify([n3b, w3b.cat.a.engage]));
    await page.click('[data-semaine-suiv]');
    await page.waitForTimeout(250);
    const n3c = await nav();
    await page.click('[data-pulse-poste-saisie][data-poste="alimentation::2"]'); await page.keyboard.type('777'); await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
    v('semaine du 9 au 15 nov. (jeudi 12 > fin du cycle) : « cycle suivant », ne change rien (1 340)', n3c.hors && (await lire()).cat.a.engage === 1340, JSON.stringify([n3c, (await lire()).cat.a.engage]));
    await page.click('[data-semaine-aujourdhui]');
    await page.waitForTimeout(250);
    const n4 = await nav();
    v('« ↩ Cette semaine » ramène à la semaine en cours', n4.statut === 'en_cours' && !n4.aujourdhui, JSON.stringify(n4));
    //  Les tickets datés se rangent dans LEUR semaine
    await tickets([{ date: iso(dans14(-IDX14 - 6)), montant: 275, cat: 'alimentation' }]);     // mardi de la semaine passée
    const wt = await page.evaluate((ST) => { const st = eval(ST); const c = st.liberteCycle.categories.find(x => x.key === 'alimentation'); return { cetteSemaine: c.sem.tickets }; }, ST);
    await page.click('[data-semaine-prec]');
    await page.waitForTimeout(250);
    const wt1 = await page.evaluate((ST) => { const st = eval(ST); const c = st.liberteCycle.categories.find(x => x.key === 'alimentation'); return { tickets: c.sem.tickets, engage: c.sem.engage, source: c.sem.source }; }, ST);
    v('un ticket daté de la semaine passée n\'apparaît que dans CETTE semaine-là (275 < 410 saisis → 410 ; ticket non ventilé = saisie en vrac, pas de prévu ajouté)',
      wt.cetteSemaine === 0 && wt1.tickets === 275 && wt1.engage === 410 && wt1.source === 'compteur', JSON.stringify([wt, wt1]));
    await tickets([]);
    await page.click('[data-semaine-aujourdhui]');
    await page.waitForTimeout(200);
    await page.evaluate(async (ST) => { const st = eval(ST); st.resetConsoT0(); await new Promise(r => setTimeout(r, 150)); }, ST);
    v('« effacer tout le cycle » vide aussi les semaines du cycle (mais pas celle du cycle précédent)',
      await page.evaluate(({ ST, a, b }) => { const st = eval(ST); const cles = Object.values(st.donneesAnnuelles).flatMap(d => Object.keys(d.consoRealiseeT0 || {})); return !cles.includes('S' + a) && cles.includes('S' + b); }, { ST, a: sem(0).lundi, b: sem(-2).lundi }),
      'les semaines du cycle devraient disparaître, celle du cycle précédent rester');
    v('aucune erreur JavaScript (semaines)', erreurs.length === 0, erreurs[0] || '');

    /* ── M. v37.28 : des CASES VIERGES — zéro par défaut, le prévu à côté ── */
    await recharger(maintenant);                                            // dimanche 11 : rien d'écoulé dans le cycle
    await page.evaluate(async (ST) => { const st = eval(ST); st.resetConsoT0(); st.changerSemaine(0); await new Promise(r => setTimeout(r, 150)); }, ST);
    await tickets([]);
    await page.mouse.move(5, 5); await page.waitForTimeout(200);
    if (!(await page.$('[data-pulse-postes][data-cat="alimentation"]'))) { await page.click('[data-pulse-ouvrir][data-cat="alimentation"]'); await page.waitForTimeout(200); }
    const m0 = await lire();
    const cases = () => page.evaluate(() => [...document.querySelectorAll('[data-meteo] input[data-saisie]')].map(i => ({ cle: i.dataset.poste || i.dataset.cat, v: i.value, p: i.placeholder, italique: /placeholder:italic/.test(i.className) })));
    const v0 = await cases();
    v('M. toutes les cases de la Météo (catégories, postes, « Autre ») : vides, invite « 0 », droite (pas d\'italique)',
      v0.length >= 5 && v0.every(x => x.v === '' && x.p === '0' && !x.italique), JSON.stringify(v0));
    const lg = await page.evaluate(() => [...document.querySelectorAll('[data-pulse-ligne]')].map(l => {
        const p = l.querySelector('[data-pulse-prevu]'), r = l.querySelector('[data-pulse-reste]');
        return { cat: l.dataset.cat, prevu: p && p.textContent.replace(/\s/g, ''), dansCase: !!(p && p.closest('label')), reste: r && r.textContent.replace(/\s/g, '') };
    }));
    v('  → chaque ligne dit « Prévu : X DH » (le budget de la SEMAINE), hors de la case, sans « reste » tant que rien n\'est saisi',
      lg.length === m0.L.categories.length && lg.every(x => { const c = m0.L.categories.find(k => k.key === x.cat); return c && x.prevu === 'Prévu:' + nf(c.sem.budget) + 'DH' && !x.dansCase && !/reste|dépassé/.test(x.reste); }),
      JSON.stringify([lg, m0.L.categories.map(c => [c.key, c.sem.budget])]));
    const sansApprox = await page.evaluate(() => { const z = document.querySelector('[data-liberte-saisie]'); return !/≈/.test(z.textContent) && ![...z.querySelectorAll('input')].some(i => /≈/.test(i.placeholder + i.value)); });
    v('  → plus aucun « ≈ » dans la zone de saisie (cases, totaux, semaine)', sansApprox);
    v('  → le grand chiffre garde sa prudence, dite en clair (« estimé au prorata »)', !m0.L.declare && m0.L.reste === m0.prorata && await page.evaluate(() => !!document.querySelector('[data-liberte-estime]')),
      JSON.stringify({ reste: m0.L.reste, prorata: m0.prorata }));
    //  Rayons X d'une catégorie sans saisie : 0 DH dépensé, le prévu à part, l'estimation nommée comme telle
    await page.hover('[data-pulse-cat][data-cat="alimentation"]'); await page.waitForTimeout(300);
    const cAm = m0.L.categories.find(c => c.key === 'alimentation');
    const rx0 = await page.evaluate(() => { const p = document.querySelector('[data-rayonx]'); const q = (s) => p && p.querySelector(s);
        return p && { total: q('[data-rx-total]')?.textContent.replace(/\s/g, ''), prevu: q('[data-rx-prevu-total]')?.textContent.replace(/\s/g, ''), barre: q('[data-rx-barre]')?.style.width,
                      reste: q('[data-rx-reste]')?.textContent.replace(/\s/g, ''), retenu: q('[data-rx-retenu]')?.textContent.replace(/\s+/g, ' ').trim(), prudence: q('[data-rx-prudence]')?.textContent.replace(/\s/g, '') }; });
    v('  → Rayons X sans saisie : « 0 DH dépensé », « Prévu : 4 300 DH » à part, barre vide, reste = le prévu entier',
      !!rx0 && rx0.total === '0DH' && rx0.prevu === 'Prévu:' + nf(cAm.budget) + 'DH' && rx0.barre === '0%' && rx0.reste === 'Reste' + nf(cAm.budget) + 'DH', JSON.stringify([rx0, cAm.budget]));
    v('  → l\'estimation du moteur n\'y est plus un « dépensé » : elle est nommée « par prudence », à part',
      !!rx0 && /Rien de saisi ce cycle : 0 DH/.test(rx0.retenu) && cAm.engage > 0 && rx0.prudence && rx0.prudence.includes(nf(cAm.engage) + 'DH'), JSON.stringify([rx0 && rx0.retenu, cAm.engage]));
    await page.mouse.move(5, 5); await page.waitForTimeout(300);
    //  On tape : seule la case touchée se remplit, les autres restent vierges
    await page.click('[data-pulse-poste-saisie][data-poste="alimentation::1"]'); await page.keyboard.type('250'); await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
    const v1 = await cases();
    const m1 = await lire();
    const tot1 = await page.evaluate(() => document.querySelector('[data-pulse-ouvrir][data-cat="alimentation"] [data-pulse-total]').textContent.replace(/\s/g, ''));
    const reste1 = await page.evaluate(() => document.querySelector('[data-pulse-ligne][data-cat="alimentation"] [data-pulse-reste]').textContent.replace(/\s/g, ''));
    v('  → taper 250 sur Hri : seule cette case porte 250, les autres restent vides ; la ligne dit « Prévu : 1 000 DH · reste 750 »',
      v1.find(x => x.cle === 'alimentation::1').v === '250' && v1.filter(x => x.cle !== 'alimentation::1').every(x => x.v === '' && x.p === '0') && tot1 === '250'
      && reste1 === 'Prévu:1000DH·reste750', JSON.stringify([v1, tot1, reste1]));
    await page.hover('[data-pulse-cat][data-cat="alimentation"]'); await page.waitForTimeout(300);
    const rx1 = await page.evaluate(() => { const p = document.querySelector('[data-rayonx]'); return p && { total: p.querySelector('[data-rx-total]')?.textContent.replace(/\s/g, ''), reste: p.querySelector('[data-rx-reste]')?.textContent.replace(/\s/g, ''), prudence: !!p.querySelector('[data-rx-prudence]') }; });
    const cA1 = m1.L.categories.find(c => c.key === 'alimentation');
    v('  → Rayons X après saisie : 250 DH dépensé, reste du cycle = 4 300 − 250', !!rx1 && rx1.total === '250DH' && rx1.reste === 'Reste' + nf(cA1.budget - 250) + 'DH' && !rx1.prudence && cA1.reel === 250,
      JSON.stringify([rx1, cA1.reel]));
    await page.mouse.move(5, 5); await page.waitForTimeout(300);
    //  Une catégorie encore vide, alors qu'une autre est déclarée : le moteur l'estime, la case et les Rayons X disent 0
    await page.hover('[data-pulse-cat][data-cat="sorties"]'); await page.waitForTimeout(300);
    const cS1 = m1.L.categories.find(c => c.key === 'sorties');
    const rx2 = await page.evaluate(() => { const p = document.querySelector('[data-rayonx]'); return p && { total: p.querySelector('[data-rx-total]')?.textContent.replace(/\s/g, ''), prudence: p.querySelector('[data-rx-prudence]')?.textContent.replace(/\s/g, '') }; });
    v('  → Sorties encore vide (Alimentation déclarée) : le moteur l\'estime, mais les Rayons X disent 0 DH dépensé',
      cS1.source === 'estime' && cS1.engage > 0 && cS1.reel === 0 && !!rx2 && rx2.total === '0DH' && rx2.prudence.includes(nf(cS1.engage) + 'DH'), JSON.stringify([cS1.engage, cS1.reel, rx2]));
    await page.mouse.move(5, 5); await page.waitForTimeout(300);
    //  Vider la case : elle redevient vierge ; une autre semaine : vierge aussi
    await page.fill('[data-pulse-poste-saisie][data-poste="alimentation::1"]', ''); await page.waitForTimeout(250);
    const v2 = await cases();
    await page.click('[data-semaine-suiv]'); await page.waitForTimeout(250);
    const v3 = await cases();
    await page.click('[data-semaine-aujourdhui]'); await page.waitForTimeout(250);
    v('  → vider la case la rend vierge (invite « 0 ») ; la semaine à venir : toutes vierges',
      v2.every(x => x.v === '' && x.p === '0') && v3.length === v2.length && v3.every(x => x.v === '' && x.p === '0'), JSON.stringify([v2, v3]));
    //  v37.31 : une semaine ÉCOULÉE (ici celle du 28 sept., cycle précédent) montre le prévu retenu
    await page.click('[data-semaine-prec]'); await page.waitForTimeout(250);
    const v4 = await page.evaluate(() => [...document.querySelectorAll('[data-meteo] input[data-saisie]')].map(i => [i.dataset.poste || i.dataset.cat, i.value, i.dataset.defaut || '']));
    await page.click('[data-semaine-aujourdhui]'); await page.waitForTimeout(250);
    v('  → la semaine ÉCOULÉE : chaque case vide montre son prévu retenu (Hri 600, L7M 400, SORTIES 400, ESSENCE 172), « Autre » vide',
      JSON.stringify(v4) === JSON.stringify([['alimentation::1', '600', '1'], ['alimentation::2', '400', '1'], ['libre', '', ''], ['sorties', '400', '1'], ['voiture', '172', '1']]), JSON.stringify(v4));
    v('  → plus aucune fonction ne remplit les saisies à la place de l\'utilisateur',
      await page.evaluate((ST) => { const st = eval(ST); return typeof st.remplirConsoT0DepuisReel === 'undefined'; }, ST));
    await page.evaluate(async (ST) => { const st = eval(ST); st.resetConsoT0(); await new Promise(r => setTimeout(r, 150)); }, ST);
    v('aucune erreur JavaScript (cases vierges)', erreurs.length === 0, erreurs[0] || '');

    v('aucune erreur JavaScript (bureau)', erreurs.length === 0, erreurs[0] || '');
    await page.close();

    /* ── J. Téléphone ─────────────────────────────────────────────────── */
    const mo = await ouvrir({ viewport: { width: 384, height: 832 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const tel = await mo.page.evaluate(() => {
        const m = document.querySelector('[data-meteo]');
        return { h: m.getBoundingClientRect().height, debord: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                 champs: [...m.querySelectorAll('[data-pulse-saisie], [data-pulse-ouvrir]')].filter(e => e.offsetParent).length };
    });
    v('S24+ : aucun débordement, une case ou un ✎ visible par catégorie', tel.debord <= 0 && tel.champs >= 3, JSON.stringify(tel));
    //  v37.24 : la Météo est devenue LA surface de saisie (elle remplace un bloc
    //  de plusieurs écrans) : elle doit tenir dans un écran.
    if (twCss) v('  → la Météo, saisie comprise, tient dans un écran', tel.h < 832, String(tel.h));
    await mo.page.evaluate(() => document.querySelector('[data-pulse-saisie]').scrollIntoView({ block: 'center' }));
    await mo.page.tap('[data-pulse-saisie][data-cat="sorties"]');
    await mo.page.keyboard.type('1500');
    await mo.page.waitForTimeout(300);
    const t1 = await mo.page.evaluate((ST) => { const st = eval(ST); return { a: st.liberteCycle.categories.find(c => c.key === 'sorties').engage, panneau: !!document.querySelector('[data-rayonx]') }; }, ST);
    v('  → toucher la case de Sorties et taper 1500 : saisi, sans ouvrir de panneau', t1.a === 1500 && !t1.panneau, JSON.stringify(t1));
    //  v37.26 : Alimentation a des postes — toucher ✎, puis la case d'un poste
    await mo.page.tap('[data-pulse-ouvrir][data-cat="alimentation"]');
    await mo.page.waitForTimeout(300);
    await mo.page.tap('[data-pulse-poste-saisie][data-poste="alimentation::1"]');
    await mo.page.keyboard.type('640');
    await mo.page.waitForTimeout(300);
    const t2 = await mo.page.evaluate((ST) => {
        const st = eval(ST), p = document.querySelector('[data-pulse-postes]'), r = p.getBoundingClientRect();
        return { a: st.liberteCycle.categories.find(c => c.key === 'alimentation').engage, dansEcran: r.left >= 0 && r.right <= innerWidth,
                 debord: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    }, ST);
    v('  → toucher ✎ puis la case d\'un poste et taper 640 : saisi, rien ne déborde', t2.a === 640 && t2.dansEcran && t2.debord <= 0, JSON.stringify(t2));
    await mo.page.tap('[data-pulse-cat][data-cat="alimentation"]');
    await mo.page.waitForTimeout(300);
    v('  → toucher le nom ouvre l\'audit (Rayons X)', await mo.page.evaluate(() => document.querySelector('[data-rayonx]')?.dataset.rxType === 'cat'));
    v('  → aucune erreur JavaScript', mo.erreurs.length === 0, mo.erreurs[0] || '');
    await mo.page.close();
} catch (e) {
    if (e.message !== 'ABSENT') { ko++; console.log('  ❌ exception : ' + e.message.split('\n')[0]); }
} finally {
    await browser.close();
    srv.close();
}
console.log('  ' + '─'.repeat(80));
console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
