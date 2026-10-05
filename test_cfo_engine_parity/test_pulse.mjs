/**
 * v37.20 — LE PULSE HEBDOMADAIRE.
 *
 *   À droite de la Météo, le « X DH / jour » cède la place à deux chiffres de
 *   la semaine calendaire (lundi → dimanche), qui croisent Prévu et Réalisé :
 *     🕊️ LIBERTÉ    = enveloppe hebdo du Prévisionnel − dépenses réelles datées
 *                    de lundi à aujourd'hui, plafonnée par le cash au rythme de
 *                    la paie ;
 *     🔒 SANCTUAIRE = ce qui reste à payer dans les 7 prochains jours, payés
 *                    exclus — au dirham près le total de la carte Urgence.
 *   Cette suite vérifie les chiffres AVANT l'apparence, chacun contre un calcul
 *   fait à la main sur un budget lisible, puis la jauge, la hiérarchie
 *   visuelle (le filet du cycle en mention discrète) et le téléphone.
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
console.log('\n  PULSE HEBDOMADAIRE : LIBERTÉ & SANCTUAIRE\n  ' + '─'.repeat(80));

/* ── A. Statique ─────────────────────────────────────────────────────── */
v('le « X DH / jour » n\'est plus le chiffre vedette de la Météo', !html.includes("Reste à vivre aujourd'hui"));
v('les deux tuiles sont dans le composant Météo',
  /const MeteoFinanciere = \{[\s\S]*data-pulse-liberte[\s\S]*data-pulse-sanctuaire[\s\S]*data-meteo-filet[\s\S]*\n\s*\};/.test(html));

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
    const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'twpulse-'));
    fs.writeFileSync(path.join(tmp, 'in.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
    fs.writeFileSync(path.join(tmp, 'cfg.js'), 'module.exports={content:[' + JSON.stringify(path.join(RACINE, 'index.html')) + '],theme:{extend:{}}};');
    execFileSync(twBin, ['-c', path.join(tmp, 'cfg.js'), '-i', path.join(tmp, 'in.css'), '-o', path.join(tmp, 'out.css'), '--minify'], { stdio: 'ignore' });
    const css = fs.readFileSync(path.join(tmp, 'out.css'), 'utf8');
    return css.length > 10000 ? css : null;
});

/* ── B. Le décor ─────────────────────────────────────────────────────── */
//  Paie hier (ou il y a quelques jours le 1er du mois) : la semaine qui vient
//  est toute entière dans le cycle.
const maintenant = new Date();
const T = maintenant.getDate();
const jourDePaie = T === 1 ? 28 : Math.min(28, Math.max(2, T - 1));
const Y = maintenant.getFullYear(), MC = maintenant.getMonth() + 1;
const MOIS_BUDGET = T >= jourDePaie ? (MC === 12 ? 1 : MC + 1) : MC;
const AN_BUDGET = (T >= jourDePaie && MC === 12) ? Y + 1 : Y;
const dans = (k) => new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() + k);
const jourDans = (k) => dans(k).getDate();
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const IDX = (maintenant.getDay() + 6) % 7;                                  // 0 = lundi
const LUNDI = dans(-IDX);

const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
fx.donneesAnnuelles = {};
for (const an of [AN_BUDGET - 1, AN_BUDGET, AN_BUDGET + 1]) fx.donneesAnnuelles[an] = JSON.parse(JSON.stringify(base));
Object.assign(fx.soldesInitiaux, { moisActuel: MOIS_BUDGET, anneeActuelle: AN_BUDGET, jourDePaie,
    compteChargesFixes: 'courant', compteChargesVariables: 'courant', assurances_tracker: [] });
fx.comptes = [{ id: 1, label: 'Compte Courant', type: 'courant', solde: 60000, icone: '💳' }];
const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
for (const an of Object.keys(fx.donneesAnnuelles)) {
    const d = fx.donneesAnnuelles[an];
    const Rv = (label, b, j) => ({ ...neutre, label, base: b, jourPrevu: j, destinationCompte: 'courant' });
    d.revenus = { salaire: Rv('SALAIRE', 20000, jourDePaie), bonif: Rv('—', 0), magasin: Rv('—', 0), cnss: Rv('—', 0), appart: Rv('—', 0), studio: Rv('—', 0) };
    const Fx = (label, valeur, j) => ({ ...neutre, label, valeur, jourPrevu: j });
    d.chargesFixes = { creditImmo: Fx('LOYER', 6000, jourDans(2)), creditStudio: Fx('ASSURANCE', 400, jourDans(15)), syndic: Fx('—', 0), nounou: Fx('—', 0),
                       ecole: Fx('—', 0), femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
    const V = (label, valeur, periode, details = []) => ({ ...neutre, label, valeur, periode, details });
    d.chargesVariables = {
        alimentation: V('COURSES', 1000, 'semaine'),                       // hebdo  → 1 000
        sorties: V('SORTIES', 400, 'semaine'),                              // hebdo  →   400
        voiture: V('ESSENCE', 860, 'mois'),                                 // mensuelle sans détail → 860 ÷ 4,3 = 200
        sante: V('MUTUELLE', 500, 'mois', [{ nom: 'MUTUELLE', montant: 500, jourPrevu: jourDans(1) }]),  // planifiée → Sanctuaire
        factures: { ...V('FACTURES', 800, 'mois'), categorieId: 'cat_cv_factures' },                     // jamais dans la Liberté
    };
    d.epargne = [{ id: 31, nom: 'EPARGNE', valeur: 2000, sourceCompte: 'courant', jourPrevu: jourDans(4) }];
    //  Les dépenses exceptionnelles se rangent au mois CALENDAIRE de leur date.
    d.depensesIrregulieres = Number(an) === dans(3).getFullYear()
        ? [{ id: 41, mois: dans(3).getMonth() + 1, annee: Number(an), nom: 'CADEAU', montant: 700, sourceCompte: 'courant', jourPrevu: jourDans(3) }] : [];
    d.virementsInternes = []; d.transactionsReelles = [];
}
const ENVELOPPE = 1000 + 400 + 200;

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
const ouvrir = async (opts, mode = 'reel', onglet = 'pilotage') => {
    const page = await browser.newPage(opts);
    const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
    page.on('dialog', d => d.accept());
    await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
    await page.waitForTimeout(600);
    await page.evaluate(async ({ ST, mode, onglet }) => { const st = eval(ST); st.appMode = mode; await new Promise(r => setTimeout(r, 250)); st.activeTab = onglet; }, { ST, mode, onglet });
    await page.waitForTimeout(600);
    return { page, erreurs };
};
const nf = (n) => new Intl.NumberFormat('fr-FR').format(n).replace(/\s/g, '');
const sansEsp = (t) => String(t || '').replace(/\s/g, '');

//  Les transactions de la semaine. « an » = le seau annuel où on la range :
//  une semaine peut enjamber le 31 décembre, le Pulse doit lire tous les seaux.
const TX_SEMAINE = [
    { an: AN_BUDGET, date: iso(LUNDI), montant: 300, cat: 'alimentation' },          // compté
    { an: AN_BUDGET + 1, date: iso(maintenant), montant: 150, cat: 'sorties' },      // compté (autre seau)
    { an: AN_BUDGET, date: iso(maintenant), montant: 100, cat: 'voiture' },          // compté (mensuelle sans détail)
    { an: AN_BUDGET, date: iso(dans(-IDX - 1)), montant: 999, cat: 'alimentation' }, // dimanche dernier → exclu
    { an: AN_BUDGET, date: iso(dans(1)), montant: 777, cat: 'alimentation' },        // demain → exclu
    { an: AN_BUDGET, date: iso(maintenant), montant: 250, cat: 'factures' },         // hors budget conso
    { an: AN_BUDGET, date: iso(maintenant), montant: 90, cat: 'sante' },             // planifiée → hors Liberté
];

try {
    const { page, erreurs } = await ouvrir({ viewport: { width: 1400, height: 1100 } });
    const present = await page.evaluate((ST) => !!eval(ST).pulseHebdo && !!eval(ST).sanctuaireHebdo, ST);
    v('pulseHebdo et sanctuaireHebdo sont exposés', present, 'absents');
    if (!present) throw new Error('ABSENT');

    const poserTx = (liste) => page.evaluate(async ({ ST, liste }) => {
        const st = eval(ST);
        Object.values(st.donneesAnnuelles).forEach(d => { d.transactionsReelles = []; });
        const cv = st.donneesAnnuelles[st.moisBudgetaire.an].chargesVariables;
        liste.forEach((t, i) => st.donneesAnnuelles[t.an].transactionsReelles.push(
            { id: 900 + i, date: t.date, libelle: 'T' + i, montant: t.montant, categorieId: cv[t.cat].categorieId, compteId: 1, source: 'test' }));
        st.forceUpdateCalculations();
        await new Promise(r => setTimeout(r, 150));
    }, { ST, liste });
    const poserSolde = (solde) => page.evaluate(async ({ ST, solde }) => {
        const st = eval(ST); st.comptes[0].solde = solde; st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 150));
    }, { ST, solde });
    const lire = () => page.evaluate((ST) => {
        const st = eval(ST);
        return { p: JSON.parse(JSON.stringify(st.pulseHebdo)), s: JSON.parse(JSON.stringify(st.sanctuaireHebdo)),
                 m: JSON.parse(JSON.stringify(st.meteoFinanciere)), cash: st.cashDispoPourConso,
                 conso: st.respirationGlobale.consoParSemaine, urgence: st.kpiUrgence.montant };
    }, ST);

    /* ── C. 🕊️ Liberté : l'enveloppe, le réel, le reste ───────────────── */
    await poserTx(TX_SEMAINE);
    const a = await lire();
    v(`enveloppe = hebdo du Prévisionnel + mensuelles non planifiées ÷ 4,3 (${ENVELOPPE})`,
      a.p.enveloppe === ENVELOPPE && a.p.enveloppe === a.conso + 200, JSON.stringify({ env: a.p.enveloppe, conso: a.conso }));
    v('  → factures et mensuelle découpée en prélèvements : hors enveloppe',
      !a.p.categories.some(c => c.key === 'factures' || c.key === 'sante'), JSON.stringify(a.p.categories.map(c => c.key)));
    v('dépensé = transactions de lundi à aujourd\'hui (300 + 150 + 100)', a.p.depense === 550 && a.p.nbTx === 3, JSON.stringify(a.p));
    v('  → dimanche dernier et demain ne comptent pas', a.p.depense === 550, String(a.p.depense));
    v('  → factures et prélèvements planifiés : signalés hors budget (340)', a.p.horsBudget === 340 && a.p.nbHors === 2, JSON.stringify([a.p.horsBudget, a.p.nbHors]));
    const cat = (k) => a.p.categories.find(c => c.key === k) || {};
    v('détail par catégorie : 300/1000 · 150/400 · 100/200',
      cat('alimentation').depense === 300 && cat('alimentation').budget === 1000 && cat('sorties').depense === 150 && cat('sorties').budget === 400
      && cat('voiture').depense === 100 && cat('voiture').budget === 200, JSON.stringify(a.p.categories));
    v('cash ample → Liberté = enveloppe − dépensé = 1 050, contrainte « budget »',
      a.p.liberte === 1050 && a.p.contrainte === 'budget', JSON.stringify({ liberte: a.p.liberte, plafond: a.p.plafond, c: a.p.contrainte }));
    const pctAttendu = Math.round(550 / ENVELOPPE * 100), tempsAttendu = Math.round((IDX + 1) / 7 * 100);
    v(`jauge : ${pctAttendu} % consommés, repère du jour à ${tempsAttendu} %`, a.p.pct === pctAttendu && a.p.pctTemps === tempsAttendu && a.p.idxJour === IDX,
      JSON.stringify([a.p.pct, a.p.pctTemps, a.p.idxJour]));
    v('rythme : « avance » seulement si la jauge passe le repère de plus de 10 points',
      a.p.rythme === (pctAttendu > tempsAttendu + 10 ? 'avance' : 'tenu'), a.p.rythme);
    v('la semaine va du lundi au dimanche', a.p.du === `${LUNDI.getDate()} ${['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'][LUNDI.getMonth()]}`
      && a.p.joursRestants === 7 - IDX, JSON.stringify([a.p.du, a.p.au, a.p.joursRestants]));
    v('plafond = cash ÷ jours avant la paie × jours restants d\'ici dimanche',
      a.p.plafond === Math.floor(Math.round(a.cash) / a.m.jours * Math.min(7 - IDX, a.m.jours)), JSON.stringify({ plafond: a.p.plafond, cash: a.cash, jours: a.m.jours }));

    /* ── D. Le cash mord : la Liberté ne promet pas plus que le conseil ── */
    //  cash = solde + K (linéaire) : on vise 300 DH de cash d'ici la paie.
    const K = Math.round(a.cash) - 60000;
    await poserSolde(300 - K);
    const b = await lire();
    v('cash serré → Liberté plafonnée, contrainte « trésorerie »',
      b.p.contrainte === 'tresorerie' && b.p.liberte === b.p.plafond && b.p.liberte < 1050, JSON.stringify({ liberte: b.p.liberte, plafond: b.p.plafond, cash: b.cash }));
    v('  → jamais plus que le « par semaine » du conseil de la Météo',
      b.p.liberte <= b.m.parSemaine && (IDX > 0 || b.m.jours < 7 || b.p.liberte === b.m.parSemaine), JSON.stringify({ liberte: b.p.liberte, parSemaine: b.m.parSemaine, idx: IDX }));
    const domPlafond = await page.evaluate(() => document.querySelector('[data-pulse-plafond]')?.textContent || '');
    v('  → et la tuile le dit', /Plafonnée par la trésorerie/.test(domPlafond), domPlafond);
    await poserSolde(60000);

    /* ── E. Dépassement, semaine vide, réel sans dates ────────────────── */
    await poserTx([...TX_SEMAINE, { an: AN_BUDGET, date: iso(maintenant), montant: 2000, cat: 'alimentation' }]);
    const c = await lire();
    const domDep = await page.evaluate(() => ({ rythme: document.querySelector('[data-pulse-liberte]')?.dataset.rythme,
        texte: document.querySelector('[data-pulse-liberte]')?.textContent || '' }));
    v('dépassement : Liberté 0, rythme « depasse », écart chiffré (950)',
      c.p.liberte === 0 && c.p.rythme === 'depasse' && c.p.depassement === 950 && domDep.rythme === 'depasse'
      && sansEsp(domDep.texte).includes('Dépasséede' + nf(950)), JSON.stringify({ p: [c.p.liberte, c.p.rythme, c.p.depassement], domDep: domDep.rythme }));
    await poserTx([]);
    const e = await lire();
    const vide = await page.evaluate(() => !!document.querySelector('[data-pulse-vide]'));
    v('semaine sans dépense : Liberté = enveloppe entière, et on le dit', e.p.depense === 0 && e.p.liberte === ENVELOPPE && vide, JSON.stringify([e.p.depense, e.p.liberte, vide]));
    await page.evaluate(async (ST) => { const st = eval(ST); st.setConsoT0('alimentation', 500); await new Promise(r => setTimeout(r, 150)); }, ST);
    const f = await lire();
    const sansDates = await page.evaluate(() => !!document.querySelector('[data-pulse-sans-dates]'));
    v('réel saisi par catégorie, sans dates : la tuile explique pourquoi elle ne le voit pas',
      f.p.reelSansDates === true && sansDates, JSON.stringify([f.p.reelSansDates, sansDates]));
    await page.evaluate(async (ST) => { const st = eval(ST); st.setConsoT0('alimentation', 0); await new Promise(r => setTimeout(r, 150)); }, ST);
    await poserTx(TX_SEMAINE);

    /* ── F. 🔒 Sanctuaire : le total de l'Urgence, payés exclus ──────── */
    const recalc = (ST) => {
        const st = eval(ST);
        const r = st._rangAujourdhuiTest, H = st.HORIZON_URGENCE;
        const l = st.tachesPilotageToutes.filter(t => !t.paye && t.rang <= r + H).map(t => ({ libelle: t.libelle, reste: Math.max(0, t.due - (t.regle || 0)), ref: t.ref, due: t.due }))
            .filter(t => t.reste > 0);
        return { total: Math.round(l.reduce((s, t) => s + t.reste, 0)), libelles: l.map(t => t.libelle) };
    };
    const g = await lire();
    const gr = await page.evaluate(recalc, ST);
    v('Sanctuaire = carte Urgence, au dirham', g.s.montant === g.urgence && g.s.montant > 0, JSON.stringify([g.s.montant, g.urgence]));
    v('  = Σ de ce qui reste à payer d\'ici 7 jours (recalcul indépendant)', g.s.montant === gr.total && g.s.nb === gr.libelles.length, JSON.stringify({ s: g.s.montant, gr }));
    v('  → loyer, mutuelle, épargne, cadeau dedans ; l\'assurance à J+15 dehors',
      ['LOYER', 'MUTUELLE', 'EPARGNE', 'CADEAU'].every(x => gr.libelles.includes(x)) && !gr.libelles.includes('ASSURANCE'), JSON.stringify(gr.libelles));
    v('  → ventilé par nature, sans perte', Math.abs(g.s.natures.reduce((s, n) => s + n.montant, 0) - g.s.montant) <= g.s.natures.length,
      JSON.stringify(g.s.natures));
    //  On paie le loyer : il quitte le sanctuaire, au dirham.
    const paye = await page.evaluate(async (ST) => {
        const st = eval(ST);
        const t = st.tachesPilotageToutes.find(x => x.libelle === 'LOYER');
        st.toggleItemPaid(t.ref, t.due, st.cyclePilotage);
        st.forceUpdateCalculations();
        await new Promise(r => setTimeout(r, 150));
        return { due: t.due };
    }, ST);
    const h = await lire();
    const hr = await page.evaluate(recalc, ST);
    v('loyer payé → le Sanctuaire baisse d\'exactement 6 000 DH',
      paye.due === 6000 && h.s.montant === g.s.montant - 6000 && h.s.nb === g.s.nb - 1 && !hr.libelles.includes('LOYER') && h.s.montant === h.urgence,
      JSON.stringify({ avant: g.s.montant, apres: h.s.montant, nb: [g.s.nb, h.s.nb] }));
    await page.evaluate(async (ST) => {
        const st = eval(ST);
        const t = st.tachesPilotageToutes.find(x => x.libelle === 'LOYER');
        st.toggleItemPaid(t.ref, t.due, st.cyclePilotage); st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 150));
    }, ST);

    /* ── G. Le rendu ──────────────────────────────────────────────────── */
    await page.waitForTimeout(1000);                       // la jauge s'anime en 700 ms
    const z = await lire();
    const dom = await page.evaluate(() => {
        const q = (s) => document.querySelector('[data-meteo] ' + s);
        const piste = q('[data-pulse-jauge]')?.parentElement;
        const w = (e) => e ? e.getBoundingClientRect() : null;
        const fs_ = (e) => e ? parseFloat(getComputedStyle(e).fontSize) : 0;
        return {
            montant: q('[data-pulse-montant]')?.textContent, legende: q('[data-pulse-legende]')?.textContent,
            sanct: q('[data-pulse-sanctuaire-montant]')?.textContent, rythme: q('[data-pulse-liberte]')?.dataset.rythme,
            jauge: piste ? w(q('[data-pulse-jauge]')).width / w(piste).width : null,
            repere: piste ? (w(q('[data-pulse-repere]')).left + w(q('[data-pulse-repere]')).width / 2 - w(piste).left) / w(piste).width : null,
            jours: [...document.querySelectorAll('[data-meteo] [data-pulse-liberte] [aria-hidden="true"].grid-cols-7 span')].filter(s => s.offsetParent).length,
            filet: q('[data-meteo-filet]')?.textContent, taillefilet: fs_(q('[data-meteo-filet]')), tailleMontant: fs_(q('[data-pulse-montant]')),
            rav: q('[data-meteo-rav]')?.textContent, jour: q('[data-meteo-jour]')?.textContent,
        };
    });
    v('la tuile Liberté affiche 1 050 DH', sansEsp(dom.montant) === nf(1050) + 'DH', dom.montant);
    v('  → et sa légende « N % … X sur Y »', sansEsp(dom.legende).includes(z.p.pct + '%') && sansEsp(dom.legende).includes(nf(550) + 'DHsur' + nf(ENVELOPPE) + 'DH'), dom.legende);
    if (twCss) {
        v('la jauge est remplie à hauteur de la consommation', dom.jauge !== null && Math.abs(dom.jauge - z.p.pct / 100) < 0.015, JSON.stringify([dom.jauge, z.p.pct]));
        v('  → le repère blanc marque le jour de la semaine', dom.repere !== null && Math.abs(dom.repere - z.p.pctTemps / 100) < 0.015, JSON.stringify([dom.repere, z.p.pctTemps]));
        v('  → sous la jauge, les 7 jours L → D', dom.jours === 7, String(dom.jours));
        v('le filet du cycle est une mention discrète (≤ 1/3 du chiffre vedette)',
          dom.taillefilet > 0 && dom.taillefilet * 3 <= dom.tailleMontant, JSON.stringify([dom.taillefilet, dom.tailleMontant]));
    }
    v('la tuile Sanctuaire affiche le total verrouillé', sansEsp(dom.sanct) === nf(z.s.montant) + 'DH', JSON.stringify([dom.sanct, z.s.montant]));
    v('le filet garde le reste à vivre du cycle et le « par jour »',
      sansEsp(dom.rav) === nf(Math.max(0, z.m.rav)) + 'DH' && sansEsp(dom.jour) === nf(z.m.parJour) + 'DH', JSON.stringify([dom.rav, dom.jour, z.m.rav, z.m.parJour]));
    await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'previsionnel'; await new Promise(r => setTimeout(r, 200)); st.activeTab = 'pilotageTheo'; }, ST);
    await page.waitForTimeout(600);
    const theo = await page.evaluate(() => [document.querySelector('[data-meteo] [data-pulse-montant]')?.textContent,
                                            document.querySelector('[data-meteo] [data-pulse-sanctuaire-montant]')?.textContent]);
    v('Prévisionnel : le même Pulse, aux mêmes chiffres', sansEsp(theo[0]) === sansEsp(dom.montant) && sansEsp(theo[1]) === sansEsp(dom.sanct), JSON.stringify(theo));
    v('aucune erreur JavaScript (bureau)', erreurs.length === 0, erreurs[0] || '');
    await page.close();

    /* ── H. Téléphone ─────────────────────────────────────────────────── */
    const mo = await ouvrir({ viewport: { width: 384, height: 832 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await mo.page.evaluate(async ({ ST, liste }) => {
        const st = eval(ST);
        const cv = st.donneesAnnuelles[st.moisBudgetaire.an].chargesVariables;
        liste.forEach((t, i) => st.donneesAnnuelles[t.an].transactionsReelles.push(
            { id: 900 + i, date: t.date, libelle: 'T' + i, montant: t.montant, categorieId: cv[t.cat].categorieId, compteId: 1, source: 'test' }));
        st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 200));
    }, { ST, liste: TX_SEMAINE });
    const tel = await mo.page.evaluate(() => {
        const m = document.querySelector('[data-meteo]');
        const vis = (s) => { const e = m && m.querySelector(s); return !!(e && e.offsetParent && e.getBoundingClientRect().width > 0); };
        const lib = m && m.querySelector('[data-pulse-liberte]');
        return { debord: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                 hauteur: m ? m.getBoundingClientRect().height : 0,
                 montant: vis('[data-pulse-montant]'), sanct: vis('[data-pulse-sanctuaire-montant]'), jauge: vis('[data-pulse-jauge]'),
                 categories: lib ? [...lib.querySelectorAll('ul')].some(u => u.offsetParent) : null,
                 entete: lib ? lib.querySelector('p').getBoundingClientRect().height : 0 };
    });
    v('S24+ : Liberté, jauge et Sanctuaire visibles, aucun débordement', tel.montant && tel.sanct && tel.jauge && tel.debord <= 0, JSON.stringify(tel));
    if (twCss) {
        v('  → la Météo garde de la place sous elle (< 75 % de l\'écran)', tel.hauteur < 832 * 0.75, String(tel.hauteur));
        v('  → le détail par catégorie est réservé au grand écran', tel.categories === false, String(tel.categories));
        v('  → l\'en-tête de la Liberté tient sur une ligne', tel.entete > 0 && tel.entete < 20, String(tel.entete));
    }
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
