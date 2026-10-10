/**
 * v37.43 — UNE CRÉANCE COCHÉE EST ENCAISSÉE : ON N'ATTEND QUE CELLES EN ATTENTE.
 *
 *   « Il ne faut pas mettre ceux déjà validés comme en attente sur le journal,
 *   mais comme déjà encaissés ! C'est ceux qui sont justement en attente qu'il
 *   faut attendre. »
 *
 *   Le tracker des créances (remboursements Wafa Assurance, Inwi…) projetait
 *   les créances COCHÉES ✓ comme des rentrées à venir — alors que cochées,
 *   l'argent est déjà sur le compte, donc dans le solde d'aujourd'hui : elles
 *   étaient comptées deux fois. Les créances EN ATTENTE ○, les seules qu'on
 *   attend, n'apparaissaient nulle part.
 *
 *   La scène, dans un vrai navigateur, autour de la date du jour (paie hier) :
 *     ✓ deux créances encaissées (l'une datée dans trois jours, l'autre d'avant-hier) ;
 *     ○ quatre en attente : dans cinq jours, dans quarante jours, en retard
 *       (il y a dix jours), sans date.
 *   Journal (cycle en cours et suivants), atterrissage, bilan, soldes projetés,
 *   et l'écran (badges, montants, case à cocher).
 */
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8').split('\r\n').join('\n');

let ko = 0, n = 0;
const v = (t, ok, d = '') => { n++; if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(76)} ${ok ? '' : d}`); };
console.log('\n  CRÉANCES — ENCAISSÉES (✓) DANS LE SOLDE, EN ATTENTE (○) AU JOURNAL\n  ' + '─'.repeat(92));

const require = createRequire(import.meta.url);
const essai = (f) => { try { return f(); } catch { return null; } };
const pw = essai(() => require('playwright-core'));
const vueJs = essai(() => require.resolve('vue/dist/vue.global.js'));
const chartJs = essai(() => fs.existsSync(path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js')) && path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js'));
const chromium = process.env.CHROMIUM || ['/opt/pw-browsers/chromium'].find(p => essai(() => fs.existsSync(p) && fs.statSync(p).isFile()));
const fin = () => { console.log('  ' + '─'.repeat(92)); console.log(ko === 0 ? `  ✅ TOUT PASSE — ${n} contrôles` : `  ❌ ${ko} contrôle(s) en échec sur ${n}`); process.exit(ko === 0 ? 0 : 1); };
if (!pw || !vueJs || !chartJs || !chromium) { console.log('  ⏭️  ignoré (playwright-core, vue, chart.js ou Chromium absent)'); fin(); }

/* ── Le décor : paie hier, donc le cycle en cours court d'hier au mois prochain ── */
const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
const maintenant = new Date();
const Y = maintenant.getFullYear();
const jourDePaie = Math.max(2, maintenant.getDate() - 1);
const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
fx.donneesAnnuelles = { [Y]: JSON.parse(JSON.stringify(base)), [Y + 1]: JSON.parse(JSON.stringify(base)) };
Object.assign(fx.soldesInitiaux, { moisActuel: maintenant.getMonth() + 1, anneeActuelle: Y, jourDePaie, salaireRecu: false });
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const dans = (j) => { const d = new Date(maintenant); d.setDate(d.getDate() + j); return iso(d); };
const C = (id, libelle, montant, remboursement, date) => ({ id, assureur: 'Wafa Assurance', type: 'Santé', libelle, beneficiaire: 'Mon fils',
    montant: Math.round(montant / 0.8), montantRembourse: montant, remboursement, compteDepot: 'courant', dateDepot: dans(-20), dateRemboursement: date });
const CREANCES = [
    C('e1', 'ENC PEDIATRE', 514, true, dans(3)),            // encaissée, datée dans 3 jours : déjà dans le solde
    C('e2', 'ENC GENERALISTE', 213, true, dans(-2)),        // encaissée, datée d'avant-hier
    C('a1', 'ATT PEDIATRE', 230, false, dans(5)),           // en attente, dans le cycle en cours
    C('a2', 'ATT INWI', 1000, false, dans(40)),             // en attente, cycle suivant
    C('a3', 'ATT ORL', 240, false, dans(-10)),              // en attente, EN RETARD
    C('a4', 'ATT SANS DATE', 100, false, ''),               // en attente, sans date
];
fx.soldesInitiaux.assurances_tracker = JSON.parse(JSON.stringify(CREANCES));

const CAPTURES = process.env.CAPTURES || '';
let tw = '';
if (CAPTURES) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-creances-'));
    fs.writeFileSync(path.join(tmp, 'in.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
    fs.writeFileSync(path.join(tmp, 'cfg.js'), 'module.exports={content:[' + JSON.stringify(path.join(RACINE, 'index.html')) + '],theme:{extend:{}}};');
    execFileSync(path.join(RACINE, 'node_modules/.bin/tailwindcss'), ['-c', path.join(tmp, 'cfg.js'), '-i', path.join(tmp, 'in.css'), '-o', path.join(tmp, 'out.css'), '--minify'], { stdio: 'ignore' });
    tw = fs.readFileSync(path.join(tmp, 'out.css'), 'utf8');
    fs.mkdirSync(CAPTURES, { recursive: true });
}
const page0 = html
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, CAPTURES ? '<link rel="stylesheet" href="/tailwind.css">' : '')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');
const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const s = (c, b, t = 'application/json') => { res.writeHead(c, { 'Content-Type': t }); res.end(b); };
    if (p === '/finance/') return s(200, page0, 'text/html; charset=utf-8');
    if (p === '/vue.js') return s(200, fs.readFileSync(vueJs), 'text/javascript');
    if (p === '/chart.js') return s(200, fs.readFileSync(chartJs), 'text/javascript');
    if (p === '/tailwind.css') return s(200, tw, 'text/css');
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fx));
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
    page.on('dialog', d => d.accept());
    await page.goto(`http://127.0.0.1:${srv.address().port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => { const a = document.querySelector('#app'); const s = a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState; return s && s.journalHybridePourReleve; }, null, { timeout: 30000 });
    await page.waitForTimeout(900);

    /* ── 1. Le journal : cycle en cours, puis les quatre suivants ─────────── */
    const scene = await page.evaluate((ST) => {
        const st = eval(ST);
        const vider = (a) => a.splice(0, a.length);
        vider(st.moisSelectionnes); vider(st.anneesSelectionnees); vider(st.releveComptesFiltres);
        const lignes = () => st.journalHybridePourReleve.entries.filter(e => /^💰 Créance/.test(e.libelle || ''))
            .map(e => ({ libelle: e.libelle, jour: e.jourPrevu, montant: Math.round(e.montant), type: e.type }));
        const courant = lignes();
        const atterrissage = st.journalHybridePourReleve.soldeAtterrissage;
        const parCycle = {};
        let m = st.moisBudgetaire.mois, a = st.moisBudgetaire.an;
        for (let k = 1; k <= 4; k++) {
            m++; if (m > 12) { m = 1; a++; }
            st.moisSelectionnes.splice(0, st.moisSelectionnes.length, m);
            st.anneesSelectionnees.splice(0, st.anneesSelectionnees.length, a);
            parCycle[m + '-' + a] = lignes();
        }
        vider(st.moisSelectionnes); vider(st.anneesSelectionnees);
        return { courant, atterrissage, parCycle, cycle: [st.moisBudgetaire.mois, st.moisBudgetaire.an], aujourdhui: new Date().getDate(), jdp: st.jourDePaie };
    }, ST);
    const libs = (l) => l.map(x => x.libelle);
    const tout = [...scene.courant, ...Object.values(scene.parCycle).flat()];
    console.log(`  ── aujourd'hui : ${iso(maintenant)} · paie le ${jourDePaie} · cycle ${scene.cycle.join('/')}`);
    v('✓ encaissées : JAMAIS projetées — ni dans le cycle en cours, ni dans les suivants', !tout.some(x => /ENC (PEDIATRE|GENERALISTE)/.test(x.libelle)), JSON.stringify(libs(tout)));
    const trouve = (re) => scene.courant.filter(x => re.test(x.libelle));
    const a1 = trouve(/ATT PEDIATRE/), a3 = trouve(/ATT ORL/), a4 = trouve(/ATT SANS DATE/);
    v('○ en attente dans 5 jours : attendue dans le cycle en cours, à sa date, créditée', a1.length === 1 && a1[0].montant === 230 && a1[0].type === 'credit'
      && a1[0].jour === Number(dans(5).slice(8)) && /^💰 Créance attendue : ATT PEDIATRE$/.test(a1[0].libelle), JSON.stringify(a1));
    v('○ en retard (date passée) : toujours attendue, « en retard », à aujourd\'hui', a3.length === 1 && a3[0].montant === 240 && a3[0].jour === scene.aujourdhui
      && a3[0].libelle === '💰 Créance en retard (attendue le ' + dans(-10).split('-').reverse().join('/') + ') : ATT ORL', JSON.stringify(a3));
    v('○ sans date : attendue dans le cycle en cours, au jour de paie', a4.length === 1 && a4[0].montant === 100 && a4[0].jour === scene.jdp, JSON.stringify(a4));
    //  le cycle budgétaire d'une date : avant le jour de paie, le mois de la date ; à partir de la paie, le mois suivant
    const [y2, m2, d2] = dans(40).split('-').map(Number);
    const cleA2 = d2 < jourDePaie ? m2 + '-' + y2 : (m2 === 12 ? '1-' + (y2 + 1) : (m2 + 1) + '-' + y2);
    v('○ dans 40 jours : attendue dans SON cycle budgétaire, et dans aucun autre', !scene.courant.some(x => /ATT INWI/.test(x.libelle))
      && Object.entries(scene.parCycle).every(([k, l]) => l.filter(x => /ATT INWI/.test(x.libelle)).length === (k === cleA2 ? 1 : 0)), JSON.stringify({ cleA2, parCycle: scene.parCycle }));
    v('chaque créance en attente apparaît une seule fois sur cinq cycles', ['ATT PEDIATRE', 'ATT ORL', 'ATT SANS DATE', 'ATT INWI'].every(l => tout.filter(x => x.libelle.includes(l)).length === 1), JSON.stringify(libs(tout)));

    /* ── 2. Les soldes : atterrissage, bilan, soldes projetés ─────────────── */
    const soldes = await page.evaluate((ST) => {
        const st = eval(ST);
        const lire = () => { st.forceUpdateCalculations && st.forceUpdateCalculations();
            const lignes = st.bilanLignes; const der = lignes[lignes.length - 1] || {};
            return { att: st.journalHybridePourReleve.soldeAtterrissage, bilan: Number(der.soldeCourant), proj: Number((st.soldesProjetesJournal || {})['cpt_1']) }; };
        const tracker = st.soldesInitiaux.assurances_tracker;
        const avec = lire();
        const sauve = tracker.splice(0, tracker.length);
        const sans = lire();
        tracker.push(...sauve.filter(c => c.remboursement));                // les encaissées seules
        const encaisseesSeules = lire();
        tracker.splice(0, tracker.length, ...sauve);                           // remise en état
        const retour = lire();
        return { avec, sans, encaisseesSeules, retour };
    }, ST);
    const d = (x, y) => Math.round(x - y);
    v('atterrissage du cycle : + les créances attendues de CE cycle (230 + 240 + 100)', d(soldes.avec.att, soldes.sans.att) === 570, JSON.stringify(soldes));
    v('  → les créances encaissées n\'y ajoutent RIEN (elles sont déjà dans le solde)', d(soldes.encaisseesSeules.att, soldes.sans.att) === 0, JSON.stringify(soldes));
    v('bilan (patrimoine projeté) : + toutes les créances attendues (1 570), rien pour les encaissées', d(soldes.avec.bilan, soldes.sans.bilan) === 1570
      && d(soldes.encaisseesSeules.bilan, soldes.sans.bilan) === 0, JSON.stringify(soldes));
    v('soldes projetés (moteur du relevé) : les encaissées n\'y ajoutent rien', d(soldes.encaisseesSeules.proj, soldes.sans.proj) === 0 && d(soldes.avec.proj, soldes.sans.proj) >= 570, JSON.stringify(soldes));
    v('remise en état : tout revient', soldes.retour.att === soldes.avec.att && soldes.retour.bilan === soldes.avec.bilan);

    /* ── 3. L'écran : badges, montants, case à cocher ─────────────────────── */
    await page.evaluate((ST) => { const st = eval(ST); st.appMode = 'reel'; st.activeTab = 'pilotage'; }, ST);
    await page.waitForTimeout(500);
    await page.evaluate(() => { const w = document.querySelector('[data-cfo-collapse="assurances-tracker"]'); if (w) { w.classList.remove('collapsed'); w.scrollIntoView({ block: 'start' }); } });
    const ecran = async () => page.$$eval('[data-assur-ligne]', els => els.map(e => ({ etat: e.dataset.assurEtat, texte: e.textContent.replace(/\s+/g, ' ').trim() })));
    const e0 = await ecran();
    const ligne = (l, lib) => l.find(x => x.texte.includes(lib)) || { texte: '' };
    v('écran : les six créances, les en-attente d\'abord', e0.length === 6 && e0.slice(0, 4).every(x => x.etat === 'attente') && e0.slice(4).every(x => x.etat === 'encaissee'), JSON.stringify(e0.map(x => x.etat)));
    v('  → ✓ « 💰 Encaissé — déjà compté dans le solde, ne figure plus dans le journal à venir »', /💰 Encaissé/.test(ligne(e0, 'ENC PEDIATRE').texte)
      && /Remboursement encaissé — déjà compté dans le solde du compte : il ne figure plus dans le journal à venir/.test(ligne(e0, 'ENC PEDIATRE').texte) && !/Déclaré|déclarée/.test(ligne(e0, 'ENC PEDIATRE').texte), ligne(e0, 'ENC PEDIATRE').texte);
    v('  → ○ « ⏳ En attente — attendu le JJ/MM/AAAA, inscrit dans le journal »', /⏳ En attente/.test(ligne(e0, 'ATT PEDIATRE').texte)
      && ligne(e0, 'ATT PEDIATRE').texte.includes('Attendu le ' + dans(5).split('-').reverse().join('/') + ' — inscrit dans le journal prévisionnel'), ligne(e0, 'ATT PEDIATRE').texte);
    v('  → en retard : « ⏰ En retard », toujours attendu', /⏰ En retard/.test(ligne(e0, 'ATT ORL').texte) && /toujours pas encaissé — reste attendu dans le journal/.test(ligne(e0, 'ATT ORL').texte), ligne(e0, 'ATT ORL').texte);
    const kpi = async () => page.evaluate(() => ({ att: document.querySelector('[data-assur-attendu]')?.textContent.replace(/\s/g, ''), enc: document.querySelector('[data-assur-encaisse]')?.textContent.replace(/\s/g, '') }));
    const k0 = await kpi();
    v('résumé : « À recouvrer » = les en-attente (1 570), « ✅ Encaissé » = les cochées (727)', /^1570/.test(k0.att || '') && /^727/.test(k0.enc || ''), JSON.stringify(k0));
    if (CAPTURES) await page.screenshot({ path: path.join(CAPTURES, 'creances_tracker.png') });

    // cocher ○ → ✓ : le remboursement est arrivé, il sort du journal
    await page.click('[data-assur-ligne]:has-text("ATT PEDIATRE") [data-assur-toggle]');
    await page.waitForTimeout(300);
    const apres = await page.evaluate((ST) => { const st = eval(ST);
        return { journal: st.journalHybridePourReleve.entries.some(e => (e.libelle || '').includes('ATT PEDIATRE')), att: st.journalHybridePourReleve.soldeAtterrissage }; }, ST);
    const e1 = await ecran(); const k1 = await kpi();
    v('cocher ✓ (remboursement arrivé) : la créance sort du journal à venir', !apres.journal && Math.round(scene.atterrissage - apres.att) === 230, JSON.stringify({ apres, avant: scene.atterrissage }));
    v('  → elle passe « 💰 Encaissé », les montants du résumé suivent', ligne(e1, 'ATT PEDIATRE').texte.includes('💰 Encaissé') && /^1340/.test(k1.att || '') && /^957/.test(k1.enc || ''), JSON.stringify({ k1, t: ligne(e1, 'ATT PEDIATRE').texte }));
    await page.click('[data-assur-ligne]:has-text("ATT PEDIATRE") [data-assur-toggle]');
    await page.waitForTimeout(300);
    v('décocher : elle redevient attendue au journal', await page.evaluate((ST) => eval(ST).journalHybridePourReleve.entries.some(e => (e.libelle || '').includes('Créance attendue : ATT PEDIATRE')), ST));

    if (CAPTURES) {
        await page.evaluate((ST) => { const st = eval(ST); st.ouvrirReleve && st.ouvrirReleve('cpt_1'); }, ST);
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(CAPTURES, 'creances_releve.png') });
    }
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
} catch (e) {
    v('scène complète sans exception', false, String(e && e.stack || e));
} finally {
    await browser.close();
    srv.close();
}
fin();
