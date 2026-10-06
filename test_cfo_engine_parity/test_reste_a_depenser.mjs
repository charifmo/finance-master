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
 *     - le rythme (par semaine, par jour) se déduit du temps restant ;
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
v('la carte de droite s\'appelle « Reste à dépenser »', /💸 Reste à dépenser/.test(html) && /data-liberte-semaine/.test(html));

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
//    COURSES 1 000 / sem. → 4 300 · SORTIES 400 / sem. → 1 720 · ESSENCE 860 / mois
//    budget conso du cycle = 6 880 (factures exclues)
const maintenant = new Date();
const T = maintenant.getDate();
const jourDePaie = T === 1 ? 28 : Math.min(28, Math.max(2, T - 1));
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
const BUDGET = 4300 + 1720 + 860;

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
const nf = (n) => new Intl.NumberFormat('fr-FR').format(n).replace(/\s/g, '');
const sansEsp = (t) => String(t || '').replace(/\s/g, '');

try {
    const { page, erreurs } = await ouvrir({ viewport: { width: 1400, height: 1100 } });
    const present = await page.evaluate((ST) => !!eval(ST).liberteCycle && typeof eval(ST).saisirCompteurConso === 'function', ST);
    v('liberteCycle et la saisie en vrac sont exposés', present, 'absents');
    if (!present) throw new Error('ABSENT');

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
    const i0cats = a0.L.categories.map(c => c.key);
    v(`budget conso du cycle = ${BUDGET} (4 300 + 1 720 + 860)`, a0.L.budget === BUDGET && a0.budgetConso === BUDGET, JSON.stringify([a0.L.budget, a0.budgetConso]));
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
      r3.L.rythme === 'depasse' && r3.L.depassement === r3.L.engage - BUDGET && r3.L.reste === 0 && r3.cat.a.reste === 4300 - 8000, JSON.stringify([r3.L.rythme, r3.L.depassement, r3.L.reste]));
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
    v('la carte affiche le reste, ≈ par semaine, par jour, jours avant la paie',
      sansEsp(dom.montant) === nf(z.L.reste) + 'DH' && sansEsp(dom.semaine) === nf(z.L.parSemaine) + 'DH' && sansEsp(dom.jour) === nf(z.L.parJour) + 'DH' && sansEsp(dom.jours) === z.L.jours + 'j',
      JSON.stringify(dom));
    v('  → légende « X dépensés sur Y · N % »', sansEsp(dom.legende).includes(nf(z.L.engage) + 'DHdépenséssur' + nf(BUDGET) + 'DH') && sansEsp(dom.legende).includes(z.L.pct + '%'), dom.legende);
    if (twCss) v('  → jauge = engagé / budget, repère = rythme attendu', Math.abs(dom.jauge - z.L.pct / 100) < 0.015 && Math.abs(dom.repere - z.L.pctAttendu / 100) < 0.015,
      JSON.stringify([dom.jauge, z.L.pct, dom.repere, z.L.pctAttendu]));
    v('  → chaque tuile dit d\'où vient son chiffre (📝 / 🧾 / estimé)', dom.sources.alimentation === 'compteur' && dom.sources.sorties === 'estime' && !dom.estime, JSON.stringify(dom.sources));

    /* ── I. v37.24 : UNE seule saisie, sur la ligne de la carte ─────────── */
    const surface = await page.evaluate(() => ({
        //  Le titre exact du bloc (textContent : innerText applique « uppercase » ;
        //  le changelog, lui, cite encore le nom dans ses notes).
        ancienBloc: [...document.querySelectorAll('p')].some(p => p.textContent.trim() === 'Réalisé à T0 — conso engagée'),
        champsHorsMeteo: [...document.querySelectorAll('input[type=number]')].filter(i => !i.closest('[data-meteo]') && /conso|engag/i.test(i.closest('div')?.textContent || '')).length,
        champs: [...document.querySelectorAll('[data-meteo] [data-pulse-saisie]')].map(i => i.dataset.cat),
        voyage: !!document.querySelector('[data-voyage]'),
    }));
    v('l\'ancien bloc « Réalisé à T0 » a quitté la page', !surface.ancienBloc, JSON.stringify(surface));
    v('un champ « déjà dépensé » par ligne de catégorie, dans la Météo', JSON.stringify(surface.champs) === JSON.stringify(i0cats), JSON.stringify([surface.champs, i0cats]));
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
    v('aucune erreur JavaScript (bureau)', erreurs.length === 0, erreurs[0] || '');
    await page.close();

    /* ── J. Téléphone ─────────────────────────────────────────────────── */
    const mo = await ouvrir({ viewport: { width: 384, height: 832 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const tel = await mo.page.evaluate(() => {
        const m = document.querySelector('[data-meteo]');
        return { h: m.getBoundingClientRect().height, debord: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                 champs: [...m.querySelectorAll('[data-pulse-saisie]')].filter(e => e.offsetParent).length };
    });
    v('S24+ : aucun débordement, un champ visible par catégorie', tel.debord <= 0 && tel.champs >= 3, JSON.stringify(tel));
    //  v37.24 : la Météo est devenue LA surface de saisie (elle remplace un bloc
    //  de plusieurs écrans) : elle doit tenir dans un écran.
    if (twCss) v('  → la Météo, saisie comprise, tient dans un écran', tel.h < 832, String(tel.h));
    await mo.page.evaluate(() => document.querySelector('[data-pulse-saisie]').scrollIntoView({ block: 'center' }));
    await mo.page.tap('[data-pulse-saisie][data-cat="alimentation"]');
    await mo.page.keyboard.type('1500');
    await mo.page.waitForTimeout(300);
    const t1 = await mo.page.evaluate((ST) => { const st = eval(ST); return { a: st.liberteCycle.categories.find(c => c.key === 'alimentation').engage, panneau: !!document.querySelector('[data-rayonx]') }; }, ST);
    v('  → toucher la ligne et taper 1500 : saisi, sans ouvrir de panneau', t1.a === 1500 && !t1.panneau, JSON.stringify(t1));
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
