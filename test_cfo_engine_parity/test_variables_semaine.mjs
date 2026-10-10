/**
 * v37.46 — « charges variables ne se prennent pas à j15 une seule fois ! mais une fois
 * par semaine : revois ça pour dispatcher les déductions des variables ».
 *
 *   Le Relevé de comptes déduisait tout le budget variable d'un cycle le 15, d'un
 *   bloc. Il le répartit maintenant sur les semaines réelles du cycle (celles dont le
 *   JEUDI tombe dans le cycle, v37.27) :
 *     • cycle en cours : l'enveloppe restante, sur les semaines pas finies, au prorata
 *       des jours qui leur restent ; la semaine en cours datée d'aujourd'hui ;
 *     • cycle à venir : le budget variable du cycle, en parts égales, chaque semaine
 *       datée de son lundi.
 *   Le total d'un cycle ne bouge pas d'un centime : la fin de cycle reste la même.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
let ko = 0, n = 0;
const v = (t, ok, d = '') => { n++; if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(78)} ${ok ? '' : d}`); };
console.log('\n  CHARGES VARIABLES : UNE DÉDUCTION PAR SEMAINE, PLUS UN BLOC AU 15\n  ' + '─'.repeat(94));
const require = createRequire(import.meta.url);
const essai = (f) => { try { return f(); } catch { return null; } };
const pw = essai(() => require('playwright-core'));
const vueJs = essai(() => require.resolve('vue/dist/vue.global.js'));
const chromium = process.env.CHROMIUM || ['/opt/pw-browsers/chromium'].find(p => essai(() => fs.existsSync(p) && fs.statSync(p).isFile()));
const fin = () => { console.log('  ' + '─'.repeat(94)); console.log(ko === 0 ? `  ✅ TOUT PASSE — ${n} contrôles` : `  ❌ ${ko} contrôle(s) en échec sur ${n}`); process.exit(ko === 0 ? 0 : 1); };
if (!pw || !vueJs || !chromium) { console.log('  ⏭️  ignoré (playwright-core, vue ou Chromium absent)'); fin(); }

const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
const now = new Date(), Y = now.getFullYear();
const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
fx.donneesAnnuelles = { [Y]: JSON.parse(JSON.stringify(base)), [Y + 1]: JSON.parse(JSON.stringify(base)) };
Object.values(fx.donneesAnnuelles).forEach((d, i) => (d.depensesIrregulieres || []).forEach(x => { x.annee = Y + i; }));
Object.assign(fx.soldesInitiaux, { anneeActuelle: Y, moisActuel: now.getMonth() + 1 });
const page0 = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8')
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');
const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const s = (c, b, t = 'application/json') => { res.writeHead(c, { 'Content-Type': t }); res.end(b); };
    if (p === '/finance/') return s(200, page0, 'text/html; charset=utf-8');
    if (p === '/vue.js') return s(200, fs.readFileSync(vueJs), 'text/javascript');
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fx));
    if (p.endsWith('get_ai_memory.php')) return s(200, JSON.stringify({ status: 'ok', rag: { regles: [] }, chat: [] }));
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';

//  Les semaines d'un cycle, recalculées ici à la main : lundi → dimanche, jeudi dans le cycle.
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const jour0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const plus = (d, k) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + k);
const semaines = (m, a, jdp) => {
    const debut = new Date(a, m - 2, jdp), finC = new Date(a, m - 1, jdp - 1), out = [];
    for (let j = plus(debut, (4 - debut.getDay() + 7) % 7); j <= finC; j = plus(j, 7)) out.push({ lundi: plus(j, -3), dimanche: plus(j, 3) });
    return { debut, fin: finC, liste: out };
};
const lib = (d) => d.getDate() + ' ' + MOIS[d.getMonth()];
const VAR = /^🛒 Charges variables/;

try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
    page.on('dialog', d => d.dismiss());
    await page.goto(`http://127.0.0.1:${srv.address().port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && Array.isArray(a.__vue_app__._instance.setupState.masterAssets); }, null, { timeout: 30000 });
    await page.waitForTimeout(800);

    /* ══ A. LE CYCLE EN COURS ═════════════════════════════════════════════ */
    console.log('  ── le cycle en cours : l\'enveloppe restante, semaine par semaine');
    const A = await page.evaluate(async (ST) => {
        const st = eval(ST);
        st.ouvrirReleve('cpt_1'); await new Promise(r => setTimeout(r, 300));
        const j = st.journalHybridePourReleve;
        const lignes = j.entries.filter(e => e.libelle && e.type !== 'initial').map(e => ({ l: e.libelle, m: e.montant, j: e.jourPrevu, c: e.cycle, s: e.soldeCompteApres }));
        const r = { lignes, env: st.enveloppeConsoRestante, jdp: st.jourDePaie, mb: { m: st.moisBudgetaire.mois, a: st.moisBudgetaire.an },
                    atterr: j.soldeAtterrissage, meteo: st.kpiAtterrissageGlobal.montant, dom: [...document.querySelectorAll('td')].map(t => t.textContent.trim()).filter(t => /Charges variables/.test(t)) };
        st.showReleveModal = false; return r;
    }, ST);
    const vars = A.lignes.filter(x => VAR.test(x.l));
    const S = semaines(A.mb.m, A.mb.a, A.jdp), auj = jour0(now);
    const restantes = S.liste.filter(s => s.dimanche >= auj);
    v('plus de bloc « Total Charges Variables » au j.15', !A.lignes.some(x => /Total Charges Variables/.test(x.l)), JSON.stringify(A.lignes.map(x => x.l)));
    v(`une ligne par semaine pas finie du cycle (${restantes.length})`, vars.length === Math.max(1, restantes.length), JSON.stringify(vars.map(x => x.l)));
    v("  → affichées dans le Relevé", JSON.stringify([...new Set(A.dom)]) === JSON.stringify(vars.map(x => x.l)), JSON.stringify(A.dom));
    const enCours = restantes.find(s => s.lundi <= auj && auj <= s.dimanche);
    v('la semaine en cours : datée d\'aujourd\'hui, « semaine en cours (jusqu\'au dimanche) »',
      !enCours || (vars[0].j === auj.getDate() && vars[0].l === '🛒 Charges variables — semaine en cours (jusqu’au ' + lib(enCours.dimanche) + ')'), JSON.stringify(vars[0]));
    const suivantes = restantes.filter(s => s !== enCours), vSuiv = vars.slice(enCours ? 1 : 0);
    v('les suivantes : datées de leur lundi, « semaine du lundi au dimanche »',
      suivantes.every((s, i) => vSuiv[i] && vSuiv[i].j === s.lundi.getDate() && vSuiv[i].l === '🛒 Charges variables — semaine du ' + lib(s.lundi) + ' au ' + lib(s.dimanche)), JSON.stringify(vSuiv.map(x => [x.j, x.l])));
    const somme = Math.round(vars.reduce((s, x) => s + x.m, 0) * 100);
    v('somme des lignes = l\'enveloppe variable restante, au centime', somme === Math.round(A.env * 100), JSON.stringify([somme / 100, A.env]));
    const jours = restantes.map(s => Math.round((s.dimanche - Math.max(s.lundi, auj)) / 864e5) + 1), P = jours.reduce((s, x) => s + x, 0);
    v('au prorata des jours qui restent à chaque semaine (semaines pleines égales)',
      vars.every((x, i) => Math.abs(x.m - A.env * jours[i] / P) <= 0.02 + (i === vars.length - 1 ? vars.length * 0.01 : 0)), JSON.stringify({ jours, m: vars.map(x => x.m) }));
    v('aucune ligne ne pèse plus qu\'une semaine pleine (fini le bloc)', vars.every(x => x.m <= A.env * 7 / P + 0.02), JSON.stringify(vars.map(x => x.m)));
    v('le solde descend semaine après semaine, la fin de cycle ne change pas (= Météo)', Math.round(A.atterr) === Math.round(A.meteo)
      && vars.every((x, i) => i === 0 || x.s < vars[i - 1].s), JSON.stringify({ atterr: A.atterr, meteo: A.meteo, soldes: vars.map(x => x.s) }));

    /* ══ B. UN CYCLE À VENIR ══════════════════════════════════════════════ */
    console.log('  ── un cycle à venir : le budget variable, en parts égales sur ses semaines');
    const m2 = A.mb.m === 12 ? 1 : A.mb.m + 1, a2 = A.mb.m === 12 ? A.mb.a + 1 : A.mb.a;
    const B = await page.evaluate(async ({ ST, m2, a2 }) => {
        const st = eval(ST);
        st.moisSelectionnes.splice(0, st.moisSelectionnes.length, m2); st.anneesSelectionnees.splice(0, st.anneesSelectionnees.length, a2);
        st.releveComptesFiltres = ['cpt_1']; await new Promise(r => setTimeout(r, 300));
        const e = st.journalHybridePourReleve.entries.filter(x => x.cycle === m2 + '-' + a2 && x.type !== 'initial').map(x => ({ l: x.libelle, m: x.montant, j: x.jourPrevu }));
        const d = st.donneesAnnuelles[a2];
        const attendu = Object.values(d.chargesVariables || {}).reduce((s, cv) => { const x = Math.round(st.coutVariableDuCycle(cv, m2, a2, true) * 100) / 100; return s + (x > 0 ? x : 0); }, 0);
        const nSem = st.semainesDuCycle(m2, a2);
        st.moisSelectionnes.splice(0); st.anneesSelectionnees.splice(0);
        return { e, attendu, nSem };
    }, { ST, m2, a2 });
    const vB = B.e.filter(x => VAR.test(x.l)), S2 = semaines(m2, a2, A.jdp);
    v(`${MOIS[m2 - 1]} ${a2} : une ligne par semaine réelle du cycle (${B.nSem}), plus de bloc au 15`,
      vB.length === B.nSem && S2.liste.length === B.nSem && !B.e.some(x => /Total Charges Variables/.test(x.l)), JSON.stringify(vB.map(x => x.l)));
    v('  → chacune datée de son lundi (borné au début du cycle)', vB.every((x, i) => x.j === new Date(Math.max(S2.liste[i].lundi, S2.debut)).getDate()), JSON.stringify(vB.map(x => x.j)));
    v('  → parts égales, somme = le budget variable du cycle (coutVariableDuCycle), au centime',
      Math.round(vB.reduce((s, x) => s + x.m, 0) * 100) === Math.round(B.attendu * 100) && vB.every(x => Math.abs(x.m - B.attendu / B.nSem) <= 0.02 * B.nSem), JSON.stringify({ m: vB.map(x => x.m), attendu: B.attendu }));

    /* ══ C. LA FONCTION, CAS LIMITES ══════════════════════════════════════ */
    console.log('  ── la répartition, cas limites');
    const C = await page.evaluate((ST) => {
        const st = eval(ST), f = st.semainesVariablesDuCycle;
        const somme = (l) => Math.round(l.reduce((s, x) => s + x.montant, 0) * 100);
        const r1 = f(10, 2026, 1000.01), r2 = f(10, 2026, 0), r3 = f(10, 2026, 999.99, new Date(2026, 9, 26));
        const jdp = st.jourDePaie, debut = new Date(2026, 8, jdp).getTime();
        const r4 = f(10, 2026, 500, new Date(2026, 8, jdp));
        return { r1: { n: r1.length, s: somme(r1), m: r1.map(x => x.montant) }, r2: r2.length, r3: { n: r3.length, s: somme(r3), l: r3.map(x => x.libelle) },
                 r4: { n: r4.length, s: somme(r4), avant: r4.filter(x => x.date.getTime() < debut).length } };
    }, ST);
    v('1 000,01 DH sur 4 semaines : la somme tombe juste au centime', C.r1.n === semaines(10, 2026, A.jdp).liste.length && C.r1.s === 100001, JSON.stringify(C.r1));
    v('rien à répartir : aucune ligne', C.r2 === 0, String(C.r2));
    v('dernier jour du cycle, plus de semaine à venir : tout sur aujourd\'hui, rien de perdu', C.r3.s === 99999 && C.r3.n >= 1, JSON.stringify(C.r3));
    v('premier jour du cycle : toutes les semaines, aucune datée avant le début du cycle', C.r4.s === 50000 && C.r4.n === semaines(10, 2026, A.jdp).liste.length && C.r4.avant === 0, JSON.stringify(C.r4));
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs.slice(0, 2).join(' | '));
} catch (e) {
    v('scène complète sans exception', false, String(e && e.stack || e).slice(0, 600));
} finally {
    await browser.close();
    srv.close();
}
fin();
