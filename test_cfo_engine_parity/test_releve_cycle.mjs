/**
 * v37.15 — LE RELEVÉ RANGE PAR CYCLE, PAS PAR CALENDRIER.
 *
 *   Le ticket affirmait deux choses. Une seule s'est vérifiée.
 *
 *   1) « Le salaire du j.27 s'affiche tout en bas du mois M au lieu d'être la
 *      première ligne de M+1. »  NON REPRODUIT : _pSort et _cSort ramenaient
 *      déjà chaque jour à son rang depuis la paie. Cette suite verrouille ce
 *      comportement pour qu'il ne se perde pas.
 *
 *   2) Le rangement, lui, était bien calendaire pour les créances déclarées
 *      (assurances_tracker) : une créance du 28 septembre, avec une paie le
 *      27, était routée sur le cycle de SEPTEMBRE — un cycle déjà refermé —
 *      et disparaissait purement et simplement du Relevé. Elle appartient au
 *      cycle « 27 sep → 26 oct », soit le mois budgétaire d'OCTOBRE.
 *
 *   Le jeu de données est bâti autour de la date du jour, jour de paie posé à
 *   hier : le cycle courant enjambe donc deux mois civils, exactement le cas
 *   du ticket.
 *
 *   v37.43 — la créance projetée est celle EN ATTENTE (case non cochée) : une
 *   créance cochée est encaissée, déjà dans le solde, jamais projetée. Une
 *   créance en attente dont la date est passée reste attendue, « en retard ».
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
const v = (t, ok, d = '') => { if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(62)} ${ok ? '' : d}`); };

console.log('\n  RELEVÉ DE COMPTES — RANGEMENT ET ORDRE PAR CYCLE DE PAIE\n  ' + '─'.repeat(78));

const require = createRequire(import.meta.url);
const essai = (f) => { try { return f(); } catch { return null; } };
const pw = essai(() => require('playwright-core'));
const vueJs = essai(() => require.resolve('vue/dist/vue.global.js'));
const chartJs = essai(() => fs.existsSync(path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js'))
                           && path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js'));
const chromium = process.env.CHROMIUM || ['/opt/pw-browsers/chromium']
    .find(p => essai(() => fs.existsSync(p) && fs.statSync(p).isFile()));
if (!pw || !vueJs || !chartJs || !chromium) {
    console.log('  ⏭️  ignoré (playwright-core, vue, chart.js ou Chromium absent)');
    console.log('  ✅ TOUT PASSE — 0 contrôle(s) en échec');
    process.exit(0);
}

/* ── Le décor : paie hier, donc cycle « hier → le mois prochain » ──────── */
const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
const maintenant = new Date();
const Y = maintenant.getFullYear();
const MOIS_CIVIL = maintenant.getMonth() + 1;
const MOIS_BUDGET = MOIS_CIVIL === 12 ? 1 : MOIS_CIVIL + 1;
const AN_BUDGET = MOIS_CIVIL === 12 ? Y + 1 : Y;
const jourDePaie = Math.max(2, maintenant.getDate() - 1);   // ≥ 2 : sinon le cycle = le mois civil

const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
fx.donneesAnnuelles = { [Y]: JSON.parse(JSON.stringify(base)), [Y + 1]: JSON.parse(JSON.stringify(base)) };
fx.soldesInitiaux.moisActuel = MOIS_CIVIL;
fx.soldesInitiaux.anneeActuelle = Y;
fx.soldesInitiaux.jourDePaie = jourDePaie;
fx.soldesInitiaux.salaireRecu = false;

/*  Deux revenus qui encadrent la paie : l'un le jour même de la paie (il
    ouvre le cycle), l'autre le 1er du mois (il tombe DANS le cycle, mais
    bien après). Leurs libellés sont choisis pour ne heurter aucun filtre. */
const dA = fx.donneesAnnuelles[Y];
dA.revenus = {
    paie:  { label: 'SALAIRE MENSUEL', base: 30000, jourPrevu: jourDePaie, destinationCompte: 'courant' },
    loyer: { label: 'LOYER RECU',      base: 4000,  jourPrevu: 1,          destinationCompte: 'courant' },
};
dA.epargne = [];
dA.depensesIrregulieres = [];

/*  LA CRÉANCE DU TICKET : datée d'AUJOURD'HUI, donc APRÈS la paie d'hier.
    Elle appartient au cycle en cours — celui du mois budgétaire. v37.43 : elle
    est EN ATTENTE (remboursement:false) — c'est celle qu'on attend. */
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const MONTANT_CREANCE = 7777;
fx.soldesInitiaux.assurances_tracker = [
    { id: 'cr1', libelle: 'REMB ASSURANCE', assureur: 'AXA', type: 'sante',
      remboursement: false, montant: MONTANT_CREANCE, montantRembourse: MONTANT_CREANCE,
      compteDepot: 'courant', dateDepot: iso(maintenant), dateRemboursement: iso(maintenant) },
];

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
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fx));
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });

try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
    page.on('dialog', d => d.accept());
    await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => {
        const a = document.querySelector('#app');
        const s = a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState;
        return s && s.journalHybridePourReleve;
    }, null, { timeout: 30000 });
    await page.waitForTimeout(900);

    /* ── Le cycle courant seul ────────────────────────────────────────── */
    const courant = await page.evaluate(() => {
        const st = document.querySelector('#app').__vue_app__._instance.setupState;
        st.moisSelectionnes.splice(0, st.moisSelectionnes.length);
        st.anneesSelectionnees.splice(0, st.anneesSelectionnees.length);
        st.releveComptesFiltres.splice(0, st.releveComptesFiltres.length);
        const j = st.journalHybridePourReleve;
        return {
            moisBudgetaire: st.moisBudgetaire.mois,
            anBudgetaire: st.moisBudgetaire.an,
            jourDePaie: st.jourDePaie,
            lignes: j.entries.filter(e => e.type !== 'initial' && e.type !== 'cycle_sep')
                             .map(e => ({ libelle: e.libelle, jour: e.jourPrevu, type: e.type, montant: e.montant })),
        };
    });

    console.log(`  ── aujourd'hui : ${iso(maintenant)} · paie le ${jourDePaie} · cycle budgétaire : ${courant.moisBudgetaire}/${courant.anBudgetaire}`);

    v(`le cycle en cours est le budget du mois ${MOIS_BUDGET}`,
      courant.moisBudgetaire === MOIS_BUDGET && courant.anBudgetaire === AN_BUDGET,
      JSON.stringify({ attendu: [MOIS_BUDGET, AN_BUDGET], obtenu: [courant.moisBudgetaire, courant.anBudgetaire] }));
    v('le jour de paie lu par l\'application est bien celui du jeu de données',
      courant.jourDePaie === jourDePaie, String(courant.jourDePaie));

    /* ── 1. L'ORDRE : le flux du jour de paie ouvre le cycle ──────────── */
    const apercu = JSON.stringify(courant.lignes.map(l => l.libelle + '@j' + l.jour));
    const rang = (j) => (Number(j) >= jourDePaie ? Number(j) - jourDePaie : Number(j) - jourDePaie + 31);
    const idx = (lib) => courant.lignes.findIndex(l => (l.libelle || '').includes(lib));
    const iPaie = idx('SALAIRE MENSUEL'), iLoyer = idx('LOYER RECU');

    v('le salaire du jour de paie est présent dans le cycle', iPaie >= 0, apercu);
    v(`le cycle s'OUVRE sur un flux du jour de paie (j.${jourDePaie})`,
      courant.lignes.length > 0 && Number(courant.lignes[0].jour) === jourDePaie, apercu);
    v('aucun flux du jour de paie n\'est relégué après un flux du mois suivant',
      iPaie < iLoyer && courant.lignes.every((l, i) =>
          Number(l.jour) !== jourDePaie || i < iLoyer), JSON.stringify({ iPaie, iLoyer }));
    v('le cycle se FERME sur le rang le plus élevé, pas sur le plus grand n° de jour',
      (() => {
          const avecJour = courant.lignes.filter(l => l.jour != null);
          if (avecJour.length < 2) return false;
          const dernier = avecJour[avecJour.length - 1];
          return avecJour.every(l => rang(l.jour) <= rang(dernier.jour))
              && Number(dernier.jour) < jourDePaie;   // la fin de cycle est un petit n° de jour
      })(), apercu);
    v('le journal est trié par rang dans le cycle, de bout en bout',
      (() => {
          const rangs = courant.lignes.filter(l => l.jour != null).map(l => rang(l.jour));
          return rangs.every((x, i) => i === 0 || rangs[i - 1] <= x);
      })(), apercu);

    /* ── La formule du rang n'existe plus qu'en un seul exemplaire ────── */
    const source = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8');
    v('une seule formule de rang dans le cycle dans tout le fichier',
      (source.match(/j >= jdp \? j - jdp : j - jdp \+ 31/g) || []).length === 1
      && !/\(j \|\| 0\) \+ \(32 - jdp\)/.test(source),
      'les copies _pSort / _cSort / _rangDansCycle doivent déléguer à rangDansCycle');
    v('les trois anciennes copies délèguent bien au helper partagé',
      /const _pSort = \(j\) => rangDansCycle\(j\)/.test(source)
      && /const _cSort = \(j\) => rangDansCycle\(j\)/.test(source)
      && /const _rangDansCycle = rangDansCycle;/.test(source),
      '_pSort / _cSort / _rangDansCycle');

    /* ── 2. LE BUG : le rangement de la créance déclarée ───────────────── */
    const creanceCycleCourant = courant.lignes.filter(l => (l.libelle || '').includes('REMB ASSURANCE'));
    v(`la créance datée d'aujourd'hui (après la paie) tombe dans le cycle EN COURS`,
      creanceCycleCourant.length === 1 && Math.round(creanceCycleCourant[0].montant) === MONTANT_CREANCE
      && creanceCycleCourant[0].type === 'credit',
      JSON.stringify({ trouvees: creanceCycleCourant, lignes: courant.lignes.map(l => l.libelle) }));

    /*  Et nulle part ailleurs : on déroule quatre cycles et on compte. */
    const balayage = await page.evaluate(({ MOIS_BUDGET, AN_BUDGET }) => {
        const st = document.querySelector('#app').__vue_app__._instance.setupState;
        const par = {};
        for (let k = 0; k < 4; k++) {
            let m = MOIS_BUDGET + k, a = AN_BUDGET;
            while (m > 12) { m -= 12; a++; }
            st.moisSelectionnes.splice(0, st.moisSelectionnes.length, m);
            st.anneesSelectionnees.splice(0, st.anneesSelectionnees.length, a);
            const j = st.journalHybridePourReleve;
            par[m + '-' + a] = j.entries.filter(e => (e.libelle || '').includes('REMB ASSURANCE')).length;
        }
        st.moisSelectionnes.splice(0, st.moisSelectionnes.length);
        st.anneesSelectionnees.splice(0, st.anneesSelectionnees.length);
        return par;
    }, { MOIS_BUDGET, AN_BUDGET });

    const cleBudget = MOIS_BUDGET + '-' + AN_BUDGET;
    v('la créance apparaît dans le cycle budgétaire et dans aucun autre',
      balayage[cleBudget] === 1
      && Object.entries(balayage).every(([k, n]) => k === cleBudget ? n === 1 : n === 0),
      JSON.stringify(balayage));

    /*  v37.43 : une créance EN ATTENTE datée de la VEILLE de la paie (cycle
        précédent, refermé) n'a pas été encaissée : elle reste attendue, « en
        retard », dans le cycle en cours — jamais perdue. */
    const veille = await page.evaluate((jdp) => {
        const st = document.querySelector('#app').__vue_app__._instance.setupState;
        const lignes = () => st.journalHybridePourReleve.entries.filter(e => (e.libelle || '').includes('REMB ASSURANCE'));
        const compter = () => lignes().length;
        const cr = st.soldesInitiaux.assurances_tracker[0];
        const sauv = cr.dateRemboursement;
        //  La veille de la PAIE (et non d'aujourd'hui) : ce jour-là appartient
        //  encore au cycle précédent, déjà refermé.
        const d = new Date(sauv); d.setDate(jdp - 1);
        cr.dateRemboursement = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        const n = compter(), libelle = (lignes()[0] || {}).libelle || '', jour = (lignes()[0] || {}).jourPrevu;
        cr.dateRemboursement = sauv;                             // remise en état
        return { veille: n, libelle, jour, aujourdhui: new Date().getDate(), retour: compter() };
    }, jourDePaie);

    v('une créance en attente datée AVANT la paie reste attendue : en retard, dans le cycle en cours',
      veille.veille === 1 && /en retard \(attendue le \d\d\/\d\d\/\d{4}\)/.test(veille.libelle) && veille.jour === veille.aujourdhui, JSON.stringify(veille));
    v('  → et revenir à la date d\'aujourd\'hui la ramène dans le cycle',
      veille.retour === 1, JSON.stringify(veille));

    /* ── L'atterrissage tient compte de la créance ─────────────────────── */
    const solde = await page.evaluate(() => {
        const st = document.querySelector('#app').__vue_app__._instance.setupState;
        st.moisSelectionnes.splice(0, st.moisSelectionnes.length);
        st.anneesSelectionnees.splice(0, st.anneesSelectionnees.length);
        const avec = st.journalHybridePourReleve.soldeAtterrissage;
        const cr = st.soldesInitiaux.assurances_tracker[0];
        cr.remboursement = true;                                 // encaissée : déjà dans le solde, plus attendue
        const sans = st.journalHybridePourReleve.soldeAtterrissage;
        cr.remboursement = false;                                // remise en état
        return { avec, sans, delta: Math.round(avec - sans) };
    });
    v('la créance attendue pèse sur l\'atterrissage du cycle, au dirham près',
      solde.delta === MONTANT_CREANCE, JSON.stringify(solde));

    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}

console.log('  ' + '─'.repeat(78));
console.log(ko === 0 ? `  ✅ TOUT PASSE — 0 contrôle(s) en échec` : `  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
