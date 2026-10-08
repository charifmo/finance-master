/**
 * v37.21 — RAYONS X ET ROUTAGE ÉVIDENT.
 * v37.22 — … ET LA LISTE DE COURSES (sous-catégories prévues, poste par poste).
 * v37.23 — les tickets sont ceux du CYCLE de paie (plus de la semaine) : le
 *          panneau audite l'engagé du cycle, à côté du compteur en vrac.
 *
 *   « On voit un total, pas ce qui le compose » et « quel compte paie quoi ? ».
 *   Cette suite vérifie :
 *     - l'AUDIT : pour chaque catégorie, les lignes du panneau Rayons X sont
 *       exactement les transactions de la semaine, et leur somme est le total
 *       affiché — au dirham ;
 *     - le ROUTAGE : chaque compte a un monogramme (couleur + lettres, la
 *       banque quand le libellé la nomme) ; le Sanctuaire est ventilé par
 *       compte payeur selon la règle du Relevé, et le même compte porte le même
 *       monogramme dans la Liberté, le Sanctuaire et les pastilles de l'Inbox ;
 *     - le PANNEAU : téléporté dans <body>, z-index 9999, réellement au-dessus
 *       de tout, dans l'écran ; survol, épinglage au clic, Échap, toucher.
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
console.log('\n  RAYONS X & ROUTAGE BANCAIRE ÉVIDENT\n  ' + '─'.repeat(80));

/* ── A. Statique ─────────────────────────────────────────────────────── */
const comp = (html.match(/const MeteoFinanciere = \{[\s\S]*?\n        \};/) || [''])[0];
v('le panneau Rayons X est téléporté dans <body>, en z-[9999]', /<teleport to="body">/.test(comp) && /data-rayonx[\s\S]*fixed z-\[9999\]/.test(comp));
v('un seul monogramme de compte, partagé', /const MonoCompte = \{/.test(html) && (html.match(/'mono-compte': MonoCompte/g) || []).length >= 2);

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
    const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'twrx-'));
    fs.writeFileSync(path.join(tmp, 'in.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
    fs.writeFileSync(path.join(tmp, 'cfg.js'), 'module.exports={content:[' + JSON.stringify(path.join(RACINE, 'index.html')) + '],theme:{extend:{}}};');
    execFileSync(twBin, ['-c', path.join(tmp, 'cfg.js'), '-i', path.join(tmp, 'in.css'), '-o', path.join(tmp, 'out.css'), '--minify'], { stdio: 'ignore' });
    const css = fs.readFileSync(path.join(tmp, 'out.css'), 'utf8');
    return css.length > 10000 ? css : null;
});

/* ── B. Le décor : trois comptes, trois règles de routage ────────────── */
//    fixes → Assafa · variables et épargne → Courant · cadeau → CIH
const maintenant = new Date();
const T = maintenant.getDate();
const jourDePaie = T === 1 ? 28 : Math.min(28, Math.max(2, T - 1));
const Y = maintenant.getFullYear(), MC = maintenant.getMonth() + 1;
const MOIS_BUDGET = T >= jourDePaie ? (MC === 12 ? 1 : MC + 1) : MC;
const AN_BUDGET = (T >= jourDePaie && MC === 12) ? Y + 1 : Y;
//  v37.29 : les semaines RÉELLES du cycle (4 ou 5, plus 4,3) — les jeudis entre la paie de M−1
//  et la veille de celle de M, comptés jour par jour, indépendamment de l'application.
const semainesCycle = (mois, an, jdp) => { let n = 0; for (let d = new Date(an, mois - 2, jdp); d <= new Date(an, mois - 1, jdp - 1); d.setDate(d.getDate() + 1)) if (d.getDay() === 4) n++; return n; };
const NS = semainesCycle(MOIS_BUDGET, AN_BUDGET, jourDePaie);
const dans = (k) => new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() + k);
const jourDans = (k) => dans(k).getDate();
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const IDX = (maintenant.getDay() + 6) % 7;
const LUNDI = dans(-IDX);

const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
fx.donneesAnnuelles = {};
for (const an of [AN_BUDGET - 1, AN_BUDGET, AN_BUDGET + 1]) fx.donneesAnnuelles[an] = JSON.parse(JSON.stringify(base));
Object.assign(fx.soldesInitiaux, { moisActuel: MOIS_BUDGET, anneeActuelle: AN_BUDGET, jourDePaie,
    compteChargesFixes: 'cpt_2', compteChargesVariables: 'courant', assurances_tracker: [] });
fx.comptes = [
    { id: 1, label: 'Compte Courant', type: 'courant', solde: 60000, icone: '💳' },
    { id: 2, label: 'Compte Principale Assafa', type: 'epargne', solde: 20000, icone: '🏦' },
    { id: 3, label: 'Épargne CIH', type: 'epargne', solde: 5000, icone: '🏦' },
];
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
        //  v37.22 : les sous-catégories prévues (la liste de courses)
        alimentation: V('COURSES', 1000, 'semaine', [{ id: 1, nom: 'MARCHE', montant: 200 }, { id: 2, nom: 'HRI', montant: 500 }, { id: 3, nom: 'L7M', montant: 300 }]),
        sorties: V('SORTIES', 400, 'semaine', [76, 64, 52, 44, 40, 32, 28, 24, 20, 20].map((m, i) => ({ id: i + 1, nom: 'POSTE ' + (i + 1), montant: m }))),
        voiture: V('ESSENCE', 860, 'mois'),
        sante: V('MUTUELLE', 500, 'mois', [{ nom: 'MUTUELLE', montant: 500, jourPrevu: jourDans(1) }]),
        factures: { ...V('FACTURES', 800, 'mois'), categorieId: 'cat_cv_factures' },
    };
    d.epargne = [{ id: 31, nom: 'EPARGNE', valeur: 2000, sourceCompte: 'courant', jourPrevu: jourDans(4) }];
    d.depensesIrregulieres = Number(an) === dans(3).getFullYear()
        ? [{ id: 41, mois: dans(3).getMonth() + 1, annee: Number(an), nom: 'CADEAU', montant: 700, sourceCompte: 'cpt_3', jourPrevu: jourDans(3) }] : [];
    d.virementsInternes = []; d.transactionsReelles = [];
}
const TX = [
    { id: 900, date: iso(maintenant), libelle: 'MARJANE', montant: 300, cat: 'alimentation', compteId: 1 },
    { id: 901, date: iso(maintenant), libelle: 'CARREFOUR', montant: 150, cat: 'alimentation', poste: 'HRI', compteId: 2 },   // payé par Assafa, sur le poste Hri
    { id: 902, date: iso(maintenant), libelle: 'AFRIQUIA', montant: 100, cat: 'voiture', compteId: 1 },
    { id: 903, date: iso(dans(-40)), libelle: 'CYCLE PRECEDENT', montant: 999, cat: 'alimentation', compteId: 1 },
    { id: 904, date: iso(maintenant), libelle: 'LYDEC', montant: 250, cat: 'factures', compteId: 1 },
];

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
    await page.evaluate(async ({ ST, TX }) => {
        const st = eval(ST);
        st.appMode = 'reel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'pilotage';
        const cv = st.donneesAnnuelles[st.moisBudgetaire.an].chargesVariables;
        Object.values(st.donneesAnnuelles).forEach(d => { d.transactionsReelles = []; });
        TX.forEach(t => st.donneesAnnuelles[st.moisBudgetaire.an].transactionsReelles.push(
            { id: t.id, date: t.date, libelle: t.libelle, montant: t.montant, categorieId: t.poste ? cv[t.cat].details.find(d => d.nom === t.poste).categorieId : cv[t.cat].categorieId, compteId: t.compteId, source: 'test' }));
        st.forceUpdateCalculations();
    }, { ST, TX });
    await page.waitForTimeout(700);
    return { page, erreurs };
};
const sansEsp = (t) => String(t || '').replace(/\s/g, '');
const panneau = (page) => page.evaluate(() => {
    const p = document.querySelector('[data-rayonx]');
    if (!p) return null;
    const r = p.getBoundingClientRect();
    const auCentre = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 40));
    return {
        type: p.dataset.rxType, parent: p.parentElement.tagName, z: getComputedStyle(p).zIndex, dessus: p.contains(auCentre),
        dansEcran: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
        lignes: [...p.querySelectorAll('[data-rx-ligne]')].map(l => ({
            libelle: l.querySelector('[data-rx-libelle]')?.textContent.trim(), montant: l.querySelector('[data-rx-montant]')?.textContent.replace(/\s/g, ''),
            mono: l.querySelector('[data-mono-compte]')?.dataset.compte || null, horsCompte: l.textContent.includes('≠ prévu'), quand: l.querySelector('[data-rx-quand]')?.textContent.trim() })),
        total: p.querySelector('[data-rx-total]')?.textContent.replace(/\s/g, ''), reste: p.querySelector('[data-rx-reste]')?.textContent.replace(/\s/g, ''),
    };
});

try {
    const { page, erreurs } = await ouvrir({ viewport: { width: 1400, height: 1100 } });
    const L = await page.evaluate((ST) => {
        const st = eval(ST);
        return { p: JSON.parse(JSON.stringify(st.liberteCycle)), s: JSON.parse(JSON.stringify(st.sanctuaireHebdo)), urgence: st.kpiUrgence.montant,
                 routes: st.tachesPilotageToutes.map(t => [t.libelle, t.compte]) };
    }, ST);
    const present = !!(L.p.categories && L.p.categories[0] && Array.isArray(L.p.categories[0].transactions) && Array.isArray(L.s.parCompte));
    v('les getters remontent transactions et comptes', present, 'transactions / parCompte absents');
    if (!present) throw new Error('ABSENT');

    /* ── C. L'audit : le panneau = les transactions, la somme = le total ─ */
    const alim = L.p.categories.find(c => c.key === 'alimentation');
    v('Courses : CARREFOUR puis MARJANE (plus récent d\'abord), pas le cycle précédent',
      JSON.stringify(alim.transactions.map(t => t.libelle)) === '["CARREFOUR","MARJANE"]', JSON.stringify(alim.transactions.map(t => [t.libelle, t.date])));
    v('pour CHAQUE catégorie, Σ des lignes = total affiché',
      L.p.categories.every(c => Math.round(c.transactions.reduce((s, t) => s + t.montant, 0)) === c.tickets && c.nb === c.transactions.length),
      JSON.stringify(L.p.categories.map(c => [c.key, c.tickets, c.transactions.map(t => t.montant)])));
    v('chaque ligne dit son compte payeur', alim.transactions.find(t => t.libelle === 'MARJANE').compte.key === 'cpt_1'
      && alim.transactions.find(t => t.libelle === 'CARREFOUR').compte.key === 'cpt_2', JSON.stringify(alim.transactions.map(t => t.compte && t.compte.key)));
    v('  → payé hors du compte des variables : signalé (et seulement là)',
      L.p.categories.flatMap(c => c.transactions).filter(t => t.horsCompte).map(t => t.libelle).join() === 'CARREFOUR'
      && JSON.stringify(alim.comptesAutres.map(c => c.key)) === '["cpt_2"]', JSON.stringify(alim.comptesAutres));
    v('reste de la catégorie = budget du cycle − tickets (1 000 × ' + NS + ' semaines − 450)', alim.budget === 1000 * NS && alim.engage === 450 && alim.reste === 1000 * NS - 450, JSON.stringify([alim.budget, alim.engage, alim.reste]));
    v('hors budget conso : la facture LYDEC, auditée à part', L.p.horsBudgetTx.length === 1 && L.p.horsBudgetTx[0].libelle === 'LYDEC', JSON.stringify(L.p.horsBudgetTx));

    /* ── C bis. La liste de courses : le prévu, poste par poste ──────── */
    v('Courses : postes prévus, le plus gros d\'abord, avec leur emoji (🛍️ 500 · 🥩 300 · 🧺 200)',
      JSON.stringify(alim.prevu.map(x => [x.nom, x.montant, x.emoji])) === '[["HRI",500,"🛍️"],["L7M",300,"🥩"],["MARCHE",200,"🧺"]]', JSON.stringify(alim.prevu));
    //  La liste de courses est dans l'unité de la ligne (ici la semaine) ; le
    //  budget de la catégorie est celui du cycle (× ses semaines réelles, v37.29).
    v('pour chaque catégorie détaillée, Σ des postes = budget de la ligne (hebdo : cycle ÷ ' + NS + ' semaines)',
      L.p.categories.filter(c => c.prevu.length).length === 3 && L.p.categories.every(c => !c.prevu.length || c.prevu.reduce((s, x) => s + x.montant, 0) === Math.round(c.budget / (c.prevuUnite === 'semaine' ? NS : 1))),
      JSON.stringify(L.p.categories.map(c => [c.key, c.budget, c.prevu.reduce((s, x) => s + x.montant, 0)])));
    v('dépensé par poste : Hri 150 (CARREFOUR), le reste « non ventilé » (300)',
      alim.prevu.find(x => x.nom === 'HRI').depense === 150 && alim.prevu.filter(x => x.nom !== 'HRI').every(x => x.depense === 0) && alim.nonVentile === 300
      && alim.transactions.find(t => t.libelle === 'CARREFOUR').poste === 'HRI' && !alim.transactions.find(t => t.libelle === 'MARJANE').poste,
      JSON.stringify({ prevu: alim.prevu, nonVentile: alim.nonVentile }));
    v('  → Σ postes dépensés + non ventilé = total dépensé, partout',
      L.p.categories.every(c => c.prevu.reduce((s, x) => s + x.depense, 0) + c.nonVentile === c.tickets), JSON.stringify(L.p.categories.map(c => [c.key, c.tickets, c.nonVentile])));
    v('catégorie sans sous-catégories (Essence, mensuelle) : pas de liste', L.p.categories.find(c => c.key === 'voiture').prevu.length === 0);

    /* ── D. Le routage : un monogramme par compte, le Sanctuaire par compte ─ */
    v('la Liberté nomme son compte : Courant (CO)', L.p.compte.key === 'cpt_1' && L.p.compte.tag === 'Courant' && L.p.compte.initiales === 'CO', JSON.stringify(L.p.compte));
    const pc = L.s.parCompte;
    v('Sanctuaire par compte : Assafa 6 000 · Courant 2 500 · CIH 700',
      JSON.stringify(pc.map(c => [c.key, c.montant, c.nb])) === '[["cpt_2",6000,1],["cpt_1",2500,2],["cpt_3",700,1]]', JSON.stringify(pc.map(c => [c.key, c.montant, c.nb])));
    v('  → la banque devient le nom : « Assafa » (AS), « CIH »',
      pc[0].tag === 'Assafa' && pc[0].initiales === 'AS' && pc[2].tag === 'CIH' && pc[2].initiales === 'CIH', JSON.stringify(pc.map(c => [c.tag, c.initiales])));
    v('  → Σ des comptes = Sanctuaire = carte Urgence', pc.reduce((s, c) => s + c.montant, 0) === L.s.montant && L.s.montant === L.urgence,
      JSON.stringify([pc.reduce((s, c) => s + c.montant, 0), L.s.montant, L.urgence]));
    v('  → chaque ligne est rangée sous le compte que le Relevé débitera',
      pc.every(c => c.lignes.every(l => L.routes.some(([lib, k]) => lib === l.libelle && k === c.key))), JSON.stringify(pc.map(c => [c.key, c.lignes.map(l => l.libelle)])));
    v('  → les parts de la barre font 100 %', Math.abs(pc.reduce((s, c) => s + c.part, 0) - 100) < 0.01, JSON.stringify(pc.map(c => c.part)));
    v('  → couleurs distinctes, une par compte', new Set(pc.map(c => c.couleur)).size === pc.length, JSON.stringify(pc.map(c => c.couleur)));

    /* ── E. Le même compte a le même visage partout ───────────────────── */
    const visages = await page.evaluate(() => {
        const mono = (e) => e ? { lettres: e.textContent.trim(), classe: [...e.classList].find(c => /^bg-/.test(c)) } : null;
        return {
            liberte: mono(document.querySelector('[data-pulse-compte] [data-mono-compte]')),
            sanct: Object.fromEntries([...document.querySelectorAll('[data-sanct-compte]')].map(b => [b.dataset.compte, mono(b.querySelector('[data-mono-compte]'))])),
            inbox: Object.fromEntries([...document.querySelectorAll('[data-route]')].map(b => [b.dataset.compteRoute, mono(b.querySelector('[data-mono-compte]'))])),
            barre: [...document.querySelectorAll('[data-sanct-barre] > span')].map(s => [...s.classList].find(c => /^bg-/.test(c))),
        };
    });
    v('Liberté, Sanctuaire et pastilles de l\'Inbox : même monogramme pour Courant',
      !!visages.liberte && JSON.stringify(visages.liberte) === JSON.stringify(visages.sanct.cpt_1) && JSON.stringify(visages.inbox.cpt_1) === JSON.stringify(visages.liberte),
      JSON.stringify(visages));
    v('  → et pour Assafa (Sanctuaire = pastille de routage des fixes)',
      !!visages.sanct.cpt_2 && visages.sanct.cpt_2.lettres === 'AS' && JSON.stringify(visages.inbox.cpt_2) === JSON.stringify(visages.sanct.cpt_2),
      JSON.stringify([visages.sanct.cpt_2, visages.inbox.cpt_2]));
    v('la barre du Sanctuaire reprend les couleurs des comptes, dans l\'ordre', JSON.stringify(visages.barre) === JSON.stringify(pc.map(c => c.couleur)), JSON.stringify(visages.barre));

    /* ── F. Le panneau au bureau ──────────────────────────────────────── */
    await page.hover('[data-pulse-cat][data-cat="alimentation"]');
    await page.waitForTimeout(250);
    const p1 = await panneau(page);
    v('survol d\'une catégorie → panneau Rayons X', !!p1 && p1.type === 'cat', JSON.stringify(p1));
    v('  → dans <body>, z-index 9999, réellement au-dessus de tout, dans l\'écran',
      !!p1 && p1.parent === 'BODY' && p1.z === '9999' && p1.dessus && p1.dansEcran, JSON.stringify(p1 && { parent: p1.parent, z: p1.z, dessus: p1.dessus, ecran: p1.dansEcran }));
    v('  → les vraies lignes : libellé, montant, compte, date',
      !!p1 && p1.lignes.length === 2 && p1.lignes[0].libelle === 'CARREFOUR' && p1.lignes[0].montant === '150DH' && p1.lignes[0].mono === 'cpt_2'
      && p1.lignes[1].libelle === 'MARJANE' && p1.lignes[1].mono === 'cpt_1' && p1.lignes.every(l => !!l.quand), JSON.stringify(p1 && p1.lignes));
    v('  → « ≠ prévu » sur l\'achat payé par Assafa, total et reste exacts',
      !!p1 && p1.lignes[0].horsCompte && !p1.lignes[1].horsCompte && p1.total === '450DH' && p1.reste === 'Reste' + new Intl.NumberFormat('fr-FR').format(1000 * NS - 450).replace(/\s/g, '') + 'DH', JSON.stringify(p1 && [p1.total, p1.reste]));
    //  v37.22 : le bloc « Budget prévu » est sous l'en-tête, AVANT les dépenses réelles.
    const courses = await page.evaluate(() => {
        const p = document.querySelector('[data-rayonx]');
        const bloc = p && p.querySelector('[data-rx-prevu]'), reel = p && p.querySelector('[data-rx-reel]'), l1 = p && p.querySelector('[data-rx-ligne]');
        if (!bloc) return null;
        const hri = bloc.querySelector('[data-rx-poste]'), rempli = hri && hri.querySelector('[data-rx-poste-rempli]');
        return { etiquettes: [...bloc.querySelectorAll('[data-rx-poste]')].map(e => e.textContent.replace(/\s/g, '')),
                 ordre: !!reel && bloc.getBoundingClientRect().bottom <= reel.getBoundingClientRect().top && reel.getBoundingClientRect().bottom <= l1.getBoundingClientRect().top,
                 fond: getComputedStyle(bloc).backgroundColor, rempli: rempli ? rempli.getBoundingClientRect().width / hri.getBoundingClientRect().width : null,
                 nonVentile: !!bloc.querySelector('[data-rx-non-ventile]'), postesLignes: [...p.querySelectorAll('[data-rx-ligne-poste]')].map(e => e.textContent.trim()) };
    });
    v('panneau : « Budget prévu » [🛍️ HRI : 500 DH / sem] [🥩 L7M : 300 DH / sem] [🧺 MARCHE : 200 DH / sem] (v37.30 : le rythme de chaque ligne)',
      !!courses && JSON.stringify(courses.etiquettes) === JSON.stringify(['🛍️HRI:500DH/sem', '🥩L7M:300DH/sem', '🧺MARCHE:200DH/sem']), JSON.stringify(courses));
    v('  → sous l\'en-tête, séparé puis suivi des dépenses réelles', !!courses && courses.ordre, JSON.stringify(courses));
    v('  → un « ticket » clair dans le panneau sombre', !!courses && /^rgba?\((2[3-5]\d), (2[3-5]\d), (2[3-5]\d)/.test(courses.fond), courses && courses.fond);
    //  Le remplissage compare les tickets du poste à SA part du budget du cycle :
    //  150 / (4 300 × 500 / 1 000) = 7 %.
    if (twCss) v('  → l\'étiquette Hri se remplit à 7 % (150 / 2 150 du cycle)', !!courses && courses.rempli !== null && Math.abs(courses.rempli - 150 / 2150) < 0.02, JSON.stringify(courses && courses.rempli));
    v('  → les 300 DH non ventilés sont signalés ; l\'achat CARREFOUR porte « HRI »',
      !!courses && courses.nonVentile && JSON.stringify(courses.postesLignes) === '["🛍️ HRI"]', JSON.stringify(courses));
    // La souris rejoint le panneau : il reste ouvert.
    const boite = await page.evaluate(() => { const r = document.querySelector('[data-rayonx]').getBoundingClientRect(); return { x: r.left + 30, y: r.top + 30 }; });
    await page.mouse.move(boite.x, boite.y, { steps: 4 });
    await page.waitForTimeout(350);
    v('  → la souris peut entrer dans le panneau sans qu\'il se ferme', !!(await panneau(page)));
    await page.mouse.move(5, 5);
    await page.waitForTimeout(350);
    v('  → et il se referme quand elle s\'en va', !(await panneau(page)));
    // Le clic épingle ; Échap referme.
    await page.click('[data-pulse-cat][data-cat="voiture"]');
    await page.mouse.move(5, 5);
    await page.waitForTimeout(350);
    const p2 = await panneau(page);
    v('clic → panneau épinglé, il survit au départ de la souris', !!p2 && p2.lignes.length === 1 && p2.lignes[0].libelle === 'AFRIQUIA', JSON.stringify(p2));
    v('  → catégorie sans sous-catégories : pas de bloc « Budget prévu »', await page.evaluate(() => !document.querySelector('[data-rayonx] [data-rx-prevu]')));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    v('  → Échap le referme', !(await panneau(page)));
    // Dix postes : huit d'abord, « +2 » déplie sans fermer le panneau.
    await page.click('[data-pulse-cat][data-cat="sorties"]');
    await page.waitForTimeout(250);
    const plie = await page.evaluate(() => ({ n: document.querySelectorAll('[data-rayonx] [data-rx-poste]').length, plus: document.querySelector('[data-rayonx] [data-rx-plus]')?.textContent.trim() }));
    await page.click('[data-rayonx] [data-rx-plus]');
    await page.waitForTimeout(250);
    const deplie = await page.evaluate(() => ({ n: document.querySelectorAll('[data-rayonx] [data-rx-poste]').length, plus: !!document.querySelector('[data-rayonx] [data-rx-plus]') }));
    v('10 postes : 8 affichés et « +2 », qui déplie sans fermer le panneau',
      plie.n === 8 && plie.plus === '+2' && deplie.n === 10 && !deplie.plus, JSON.stringify({ plie, deplie }));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    // Une exception ce mois-ci (1 200 au lieu de 1 000) : les postes suivent.
    const ajuste = await page.evaluate(async (ST) => {
        const st = eval(ST);
        const m = st.moisBudgetaire.mois;
        st.donneesAnnuelles[st.moisBudgetaire.an].chargesVariables.alimentation.exceptions = [{ moisDebut: m, moisFin: m, nouvelleValeur: 1200 }];
        st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 200));
        const c = st.liberteCycle.categories.find(x => x.key === 'alimentation');
        const res = { budget: c.budget, prevu: c.prevu.map(x => x.montant), ajuste: c.prevuAjuste };
        st.donneesAnnuelles[st.moisBudgetaire.an].chargesVariables.alimentation.exceptions = [];
        st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 200));
        return res;
    }, ST);
    v('exception du mois (1 200 / sem.) : budget du cycle 1 200 × ' + NS + ' semaines, postes 600 · 360 · 240, signalé',
      ajuste.budget === 1200 * NS && JSON.stringify(ajuste.prevu) === '[600,360,240]' && ajuste.ajuste === true, JSON.stringify(ajuste));
    // Un compte du Sanctuaire
    await page.hover('[data-sanct-compte][data-compte="cpt_2"]');
    await page.waitForTimeout(250);
    const p3 = await panneau(page);
    v('survol d\'un compte du Sanctuaire → ses prélèvements (LOYER 6 000)',
      !!p3 && p3.type === 'compte' && p3.lignes.length === 1 && /LOYER/.test(p3.lignes[0].libelle) && p3.lignes[0].montant === '6000DH' && p3.total === '6000DH', JSON.stringify(p3));
    await page.mouse.move(5, 5); await page.waitForTimeout(300);
    await page.hover('[data-pulse-hors]');
    await page.waitForTimeout(250);
    const p4 = await panneau(page);
    v('« hors budget conso » s\'audite aussi', !!p4 && p4.type === 'hors' && p4.lignes.length === 1, JSON.stringify(p4));
    await page.mouse.move(5, 5); await page.waitForTimeout(300);
    // Payer le loyer vide le groupe Assafa
    await page.evaluate(async (ST) => {
        const st = eval(ST);
        const t = st.tachesPilotageToutes.find(x => x.libelle === 'LOYER');
        st.toggleItemPaid(t.ref, t.due, st.cyclePilotage); st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 200));
    }, ST);
    const apres = await page.evaluate((ST) => eval(ST).sanctuaireHebdo.parCompte.map(c => c.key), ST);
    v('loyer payé → Assafa n\'a plus rien à garder, son groupe disparaît', JSON.stringify(apres) === '["cpt_1","cpt_3"]', JSON.stringify(apres));
    v('aucune erreur JavaScript (bureau)', erreurs.length === 0, erreurs[0] || '');
    await page.close();

    /* ── G. Au téléphone : on touche ──────────────────────────────────── */
    const mo = await ouvrir({ viewport: { width: 384, height: 832 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await mo.page.evaluate(() => document.querySelector('[data-pulse-cat]').scrollIntoView({ block: 'center' }));
    await mo.page.waitForTimeout(300);
    await mo.page.tap('[data-pulse-cat][data-cat="alimentation"]');
    await mo.page.waitForTimeout(300);
    const t1 = await panneau(mo.page);
    const debord = await mo.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    v('S24+ : toucher une catégorie ouvre ses achats, dans l\'écran, au-dessus',
      !!t1 && t1.lignes.length === 2 && t1.dansEcran && t1.dessus && debord <= 0, JSON.stringify({ t1, debord }));
    await mo.page.tap('[data-pulse-cat][data-cat="alimentation"]');
    await mo.page.waitForTimeout(250);
    v('  → toucher à nouveau le referme', !(await panneau(mo.page)));
    await mo.page.tap('[data-sanct-compte]');
    await mo.page.waitForTimeout(250);
    v('  → toucher un compte du Sanctuaire ouvre ses prélèvements', ((await panneau(mo.page)) || {}).type === 'compte');
    await mo.page.tap('[data-meteo-titre]');
    await mo.page.waitForTimeout(250);
    v('  → toucher ailleurs le referme', !(await panneau(mo.page)));
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
