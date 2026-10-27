/**
 * v37.29 — LES SEMAINES RÉELLES DU CYCLE (fin du « × 4,3 »).
 *
 *   « Tu as pris en charge le facteur 4,3 ? » — Oui, mais un cycle de paie compte
 *   4 ou 5 semaines, jamais 4,3. Dans un cycle de 5 semaines, dépenser exactement
 *   le prévu chaque semaine affichait un FAUX dépassement ; dans un cycle de 4,
 *   0,3 semaine de budget n'était portée par aucune semaine. Choix de
 *   l'utilisateur : compter les vraies semaines, partout, « y compris la partie
 *   prévu et calcul de la section charges variables ».
 *
 *   Cette suite vérifie, contre un comptage INDÉPENDANT (jour par jour) :
 *     - la règle : semaines du cycle M = les jeudis entre la paie de M−1 et la
 *       veille de celle de M (36 mois × 4 jours de paie) ; l'année : 52 ou 53 ;
 *     - la promesse : tenir son prévu chaque semaine = tenir son budget de
 *       cycle, AU DIRHAM PRÈS, dans un cycle de 5 semaines comme de 4 ;
 *     - la Météo : « sem. 2/5 », le Prévu hebdo d'une charge mensuelle = ÷ N ;
 *     - le Prévisionnel : chaque mois avec SES semaines ; le texte le dit ;
 *     - la section Charges variables : le calcul du cycle en cours et du suivant ;
 *     - le surplus mois par mois, le surplus annuel, le journal de trésorerie
 *       (et l'exception d'une charge « / sem », qui n'était pas multipliée).
 *
 *   v37.65 — LES SEMAINES COUPÉES PAR LA PAIE. « Une semaine partagée entre 2 cycles fausse les choses » :
 *   un cycle compte désormais ses JOURS ÷ 7 (31 jours = 4 sem. 3 j), en morceaux — ses semaines, coupées à
 *   la paie. La règle se vérifie contre un comptage jour par jour ; la promesse tient toujours (tenir son
 *   prévu à chaque morceau = tenir le budget du cycle, au dirham près) ; « sem. k/N » numérote les morceaux.
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
console.log('\n  SEMAINES DU CYCLE = SES JOURS ÷ 7 (PLUS × 4,3, PLUS DE JEUDI)\n  ' + '─'.repeat(80));

/* ── A. Statique ─────────────────────────────────────────────────────── */
const restes = html.split('\n').filter(l => /[*/]\s*4\.3\b/.test(l));
v('plus aucune conversion « × 4,3 » ni « ÷ 4,3 » dans l\'application', restes.length === 0, restes.map(l => l.trim().slice(0, 90)).join(' | '));
//  Le gabarit lui-même (« … (x4.3) : {{ … }} ») — le changelog, lui, peut citer l'ancien libellé.
v('« Impact mensuel calculé (x4.3) » a quitté la section Charges variables', !/\(x4\.3\)\s*:\s*\{\{/.test(html) && /data-cv-semaines/.test(html));

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
//  Chaque jour du cycle, un par un : combien de jours ? (v37.65 : un cycle compte ses jours ÷ 7)
const joursCycle = (mois, an, jdp) => { let n = 0; for (let d = new Date(an, mois - 2, jdp); d <= new Date(an, mois - 1, jdp - 1); d.setDate(d.getDate() + 1)) n++; return n; };
const semainesCycle = (mois, an, jdp) => joursCycle(mois, an, jdp) / 7;
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
//  Les débuts des morceaux du cycle M : son premier jour, puis chaque lundi
const debutsCycle = (mois, an, jdp) => { const out = []; for (let d = new Date(an, mois - 2, jdp), d0 = d.getTime(); d <= new Date(an, mois - 1, jdp - 1); d.setDate(d.getDate() + 1)) if (d.getTime() === d0 || d.getDay() === 1) out.push(iso(d)); return out; };
//  « 4 sem. 3 j », sans espaces (comparé aux textes sans espaces)
const libSem = (j) => Math.floor(j / 7) + 'sem.' + (j % 7 ? (j % 7) + 'j' : '');
const nf = (n) => new Intl.NumberFormat('fr-FR').format(n).replace(/\s/g, '');
const sansEsp = (t) => String(t || '').replace(/\s/g, '');

const JDP = 8;
//  Deux horloges FIXES, deux cycles : 31 jours (8 oct. → 7 nov. 2026, ex-« 5 semaines ») et 30 jours
//  (8 sept. → 7 oct. 2026, ex-« 4 semaines ») — chacun en 5 morceaux, coupés à la paie
const SCENARIOS = [
    { nom: 'cycle de 31 jours', maintenant: new Date(2026, 9, 14, 10, 0, 0), mois: 11, an: 2026 },
    { nom: 'cycle de 30 jours', maintenant: new Date(2026, 8, 16, 10, 0, 0), mois: 10, an: 2026 },
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
            alimentation: V('COURSES', 1000, 'semaine', [{ id: 1, nom: 'Marjane', montant: 600 }, { id: 2, nom: 'Hri', montant: 400 }]),
            sorties: V('SORTIES', 400, 'semaine'), voiture: V('ESSENCE', 860, 'mois'), sante: V('—', 0, 'semaine'),
            factures: { ...V('FACTURES', 800, 'mois'), categorieId: 'cat_cv_factures' },
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

try {
    for (const sc of SCENARIOS) {
        const J = joursCycle(sc.mois, sc.an, JDP), N = J / 7, DEB = debutsCycle(sc.mois, sc.an, JDP), M = DEB.length;
        console.log(`\n  ▸ ${sc.nom} — mois budgétaire ${sc.mois}/${sc.an}, ${J} jours comptés à la main, ${M} morceaux`);
        const { page, erreurs } = await ouvrir(sc);
        const mb = await page.evaluate((ST) => ({ ...eval(ST).moisBudgetaire }), ST);
        v('le décor : le bon mois budgétaire', mb.mois === sc.mois && mb.an === sc.an, JSON.stringify(mb));

        /* ── C. La règle, contre le comptage jour par jour ───────────── */
        if (sc === SCENARIOS[0]) {
            const ecarts = await page.evaluate(async ({ ST, jdps }) => {
                const st = eval(ST), out = [], avant = st.soldesInitiaux.jourDePaie;
                const ref = (mois, an, jdp) => { let n = 0; for (let d = new Date(an, mois - 2, jdp); d <= new Date(an, mois - 1, jdp - 1); d.setDate(d.getDate() + 1)) n++; return n; };
                for (const jdp of jdps) {
                    st.soldesInitiaux.jourDePaie = jdp;
                    for (let an = 2026; an <= 2028; an++) for (let m = 1; m <= 12; m++) {
                        const a = st.semainesDuCycle(m, an), b = ref(m, an, jdp) / 7;
                        const somme = st.morceauxDuCycle(m, an).reduce((s, x) => s + x.jours, 0);
                        if (a !== b || somme !== ref(m, an, jdp)) out.push(`${m}/${an} paie ${jdp} : ${a} ≠ ${b} (morceaux ${somme})`);
                    }
                    for (let an = 2026; an <= 2028; an++) {
                        let somme = 0; for (let m = 1; m <= 12; m++) somme += ref(m, an, jdp);
                        const s = st.semainesDeLAnnee(an);
                        if (Math.round(s * 7) !== somme || (somme !== 365 && somme !== 366)) out.push(`année ${an} paie ${jdp} : ${s * 7} ≠ ${somme}`);
                    }
                }
                st.soldesInitiaux.jourDePaie = avant;
                return out;
            }, { ST, jdps: [1, 8, 15, 27] });
            v('C. 144 cycles (4 jours de paie × 3 ans) : jours ÷ 7 = comptage jour par jour = Σ des morceaux ; année = 365 ou 366 jours', ecarts.length === 0, ecarts.slice(0, 3).join(' | '));
        }

        /* ── D. Le budget du cycle et la Météo ──────────────────────── */
        const L0 = await page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST).liberteCycle)), ST);
        const cat = (L, k) => L.categories.find(c => c.key === k) || { sem: {} };
        const budgetAttendu = Math.round(1000 * N) + Math.round(400 * N) + 860;
        v(`D. budget conso = 1 000 × ${J}/7 + 400 × ${J}/7 + 860 = ${nf(budgetAttendu)} (factures exclues)`, L0.budget === budgetAttendu && L0.nbSemaines === N, JSON.stringify([L0.budget, L0.nbSemaines]));
        v('  → Prévu de la semaine (entière) : COURSES 1 000, SORTIES 400 (la valeur saisie), postes 600 / 400',
          cat(L0, 'alimentation').sem.budget === 1000 && cat(L0, 'sorties').sem.budget === 400
          && JSON.stringify(cat(L0, 'alimentation').sem.postes.map(p => p.budget)) === '[600,400]', JSON.stringify([cat(L0, 'alimentation').sem, cat(L0, 'sorties').sem.budget]));
        //  la semaine en cours (entière) : sa part d'ESSENCE, arrondis cumulés depuis le début du cycle
        const lundiAuj = new Date(sc.maintenant.getFullYear(), sc.maintenant.getMonth(), sc.maintenant.getDate() - ((sc.maintenant.getDay() + 6) % 7));
        const avant = Math.round((lundiAuj - new Date(sc.an, sc.mois - 2, JDP)) / 864e5);
        const essAttendu = Math.round(860 * (avant + 7) / J) - Math.round(860 * avant / J);
        v(`  → une charge « / mois » se répartit sur ses ${J} jours : ESSENCE 860 × 7 / ${J} = ${essAttendu}`, cat(L0, 'voiture').sem.budget === essAttendu && essAttendu === Math.round(860 / N), String(cat(L0, 'voiture').sem.budget));
        //  « sem. k/N » : chaque morceau du cycle a son rang, les autres n'en ont pas
        const rangs = await page.evaluate(async (ST) => {
            const st = eval(ST), out = [];
            for (let k = -6; k <= 6; k++) { st.changerSemaine(0); st.changerSemaine(k); await new Promise(r => setTimeout(r, 40)); const s = st.liberteCycle.semaine; out.push({ debut: s.debut, rang: s.rang, nb: s.nb, dans: s.dansCycle }); }
            st.changerSemaine(0); await new Promise(r => setTimeout(r, 60));
            return out;
        }, ST);
        const dansCycle = rangs.filter(r => r.dans);
        v(`  → les ${M} morceaux du cycle portent « sem. 1/${M} » … « ${M}/${M} », les autres rien`,
          JSON.stringify(dansCycle.map(r => r.debut)) === JSON.stringify(DEB)
          && dansCycle.every((r, i) => r.rang === i + 1 && r.nb === M) && rangs.filter(r => !r.dans).every(r => r.rang === null), JSON.stringify(rangs));
        const rangDom = await page.evaluate(() => document.querySelector('[data-semaine-rang]')?.textContent.replace(/\s/g, ''));
        const rangCourant = rangs.find((r, i) => i === 6).rang;
        v('  → la barre de semaine le dit (« sem. k/N »)', rangDom === 'sem.' + rangCourant + '/' + M, String(rangDom));

        /* ── E. LA PROMESSE : tenir son prévu à chaque morceau = tenir son cycle ── */
        const tenu = await page.evaluate(async (ST) => {
            const st = eval(ST);
            st.resetConsoT0(); await new Promise(r => setTimeout(r, 100));
            //  v37.48 : le prévu se tient LIGNE PAR LIGNE (Marjane 600, Hri 400) ; « Autre » est hors de
            //  la liste — y taper le total laisserait les lignes vides, comptées à leur prévu en plus.
            //  v37.65 : chaque morceau a SON prévu (un morceau de 4 jours : 4/7, arrondis cumulés).
            let saisi = 0; const vus = [];
            for (let k = -6; k <= 6; k++) {
                st.changerSemaine(0); st.changerSemaine(k); await new Promise(r => setTimeout(r, 40));
                const L = st.liberteCycle, s = L.semaine;
                if (!s.dansCycle) continue;
                const cats = L.categories.filter(c => c.sem.budget > 0).flatMap(c => {
                    const lignes = c.sem.postes.filter(p => p.unite === 'semaine' && p.budget > 0);
                    return lignes.length ? lignes.map(p => [p.cle, p.budget]) : [[c.key, c.sem.budget]];
                });
                cats.forEach(([cle, b]) => { st.saisirSemaineConso(s.debut, cle, b); saisi += b; });
                vus.push(s.debut);
            }
            st.changerSemaine(0); await new Promise(r => setTimeout(r, 200));
            const L = st.liberteCycle;
            const r = { budget: L.budget, engage: L.engage, resteBudget: L.resteBudget, depassement: L.depassement, rythme: L.rythme, saisi, vus };
            st.resetConsoT0(); await new Promise(r2 => setTimeout(r2, 100));
            return r;
        }, ST);
        const ancien = Math.round(1400 * (N - 4.3));
        v(`E. le prévu tenu à chacun des ${M} morceaux = budget du cycle tenu, au dirham près (× 4,3 : ${ancien > 0 ? 'faux dépassement de ' + nf(ancien) : nf(-ancien) + ' sans semaine'})`,
          JSON.stringify(tenu.vus) === JSON.stringify(DEB) && tenu.saisi === tenu.budget && tenu.engage === tenu.budget && tenu.resteBudget === 0 && tenu.depassement === 0 && tenu.rythme !== 'depasse', JSON.stringify(tenu));

        if (sc === SCENARIOS[0]) {
            /* ── F. Le Prévisionnel : chaque mois avec SES semaines ─────── */
            const prev = await page.evaluate((ST) => {
                const st = eval(ST), an = st.moisBudgetaire.an, out = [];
                for (let m = 1; m <= 12; m++) { const r = st.respirationDuMois(an, m); out.push({ m, courses: (r.lignes.conso.find(l => l.nom === 'COURSES') || {}).montant, semaines: r.semaines }); }
                return out;
            }, ST);
            const ecartsF = prev.filter(p => Math.abs(p.courses - 1000 * semainesCycle(p.m, sc.an, JDP)) > 0.01 || p.semaines !== semainesCycle(p.m, sc.an, JDP));
            v('F. Prévisionnel : COURSES = 1 000 × les jours de CHAQUE mois ÷ 7 (jamais 4 300)', prev.length === 12 && ecartsF.length === 0, JSON.stringify(ecartsF));
            await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'previsionnel'; await new Promise(r => setTimeout(r, 200)); st.activeTab = 'pilotageTheo'; }, ST);
            await attendre(page, 500);
            const theo = await page.evaluate(() => document.querySelector('[data-theo-semaines]')?.textContent.replace(/\s/g, ''));
            v(`  → la carte Conso le dit : « 1 400 DH par semaine × ${libSem(J)} ce cycle »`, theo === `1400DHparsemaine×${libSem(J)}cecycle`, String(theo));

            /* ── G. La section Charges variables (là où l'on saisit le prévu) ── */
            await page.evaluate(async (ST) => { eval(ST).activeTab = 'parametres'; }, ST);
            await attendre(page, 500);
            const cv = await page.evaluate(() => [...document.querySelectorAll('[data-cv-semaines]')].map(e => [...e.querySelectorAll('[data-cv-cycle]')].map(s => s.textContent.replace(/\s/g, ''))));
            const J2 = joursCycle(sc.mois === 12 ? 1 : sc.mois + 1, sc.mois === 12 ? sc.an + 1 : sc.an, JDP), N2 = J2 / 7;
            const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
            const l1 = MOIS[sc.mois - 1], l2 = MOIS[sc.mois % 12];
            const sorties = cv.find(x => x[0] && x[0].endsWith('DH') && x[0].includes('→' + nf(Math.round(400 * N)) + 'DH'));
            v(`G. SORTIES 400 / sem. : « ${l1} : ${libSem(J)} → ${nf(Math.round(400 * N))} DH · ${l2} : ${libSem(J2)} → ${nf(Math.round(400 * N2))} DH »`,
              !!sorties && sorties[0] === `${l1}:${libSem(J)}→${nf(Math.round(400 * N))}DH` && sorties[1] === `${l2}:${libSem(J2)}→${nf(Math.round(400 * N2))}DH`, JSON.stringify(cv));
            const essence = cv.find(x => x[0] && x[0].endsWith('/sem.'));
            v(`  → ESSENCE 860 / mois : « ${l1} : ${libSem(J)} → ${Math.round(860 / N)} DH / sem. »`, !!essence && essence[0] === `${l1}:${libSem(J)}→${nf(Math.round(860 / N))}DH/sem.`, JSON.stringify(essence));
            v('  → FACTURES (montants exacts du mois) : pas de calcul par semaine', cv.length === 4, String(cv.length));
            await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; await new Promise(r => setTimeout(r, 200)); st.activeTab = 'pilotage'; }, ST);

            /* ── H. Le surplus, mois par mois et sur l'année ──────────────── */
            const surplus = await page.evaluate(async (ST) => {
                const st = eval(ST), an = st.moisBudgetaire.an, d = st.donneesAnnuelles[an];
                st.anneeAffichage = an;
                const lire = async () => { st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 120)); return { mois: JSON.parse(JSON.stringify(st.surplusParMois)), annee: st.surplusBudgetaireAnnuel(an) }; };
                const avec = await lire();
                d.chargesVariables.sorties.valeur = 0;
                const sans = await lire();
                d.chargesVariables.sorties.valeur = 400; await lire();
                return { avec, sans, an };
            }, ST);
            const deltas = surplus.avec.mois.filter(x => !x.isPast && !x.isCurrent).map(x => ({ m: x.mNum, d: Math.round(surplus.sans.mois.find(y => y.mNum === x.mNum).brut - x.brut) }));
            v('H. surplus de chaque mois à venir : SORTIES coûte 400 × les jours de CE mois-là ÷ 7',
              deltas.length > 0 && deltas.every(x => x.d === Math.round(400 * semainesCycle(x.m, surplus.an, JDP))), JSON.stringify(deltas));
            let joursAn = 0; for (let m = 1; m <= 12; m++) joursAn += joursCycle(m, surplus.an, JDP);
            const semAn = joursAn / 7;
            v(`  → surplus annuel : SORTIES coûte 400 × ${joursAn} jours ÷ 7 (et non 400 × 4,3 × 12)`, Math.round(surplus.sans.annee - surplus.avec.annee) === Math.round(400 * semAn),
              JSON.stringify([surplus.sans.annee - surplus.avec.annee, 400 * semAn]));

            const indep = await page.evaluate(async (ST) => {
                const st = eval(ST), an = st.moisBudgetaire.an;
                st.anneeAffichage = an; st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 120));
                return { an, valeur: st.depensesHorsCreditsMensuel };
            }, ST);
            //  hors crédits : LOYER (clé creditImmo) exclu ; COURSES + SORTIES hebdo × semaines de l'année ÷ 12 ; ESSENCE + FACTURES
            const indAttendu = Math.round((1400 * semAn / 12 + 860 + 800) * 100) / 100;
            v(`  → indépendance financière : le mois MOYEN = 1 400 × ${joursAn} ÷ 7 ÷ 12 + 1 660 (plus × 4,3)`, Math.abs(indep.valeur - indAttendu) < 0.01, JSON.stringify([indep, indAttendu]));

            /* ── I. Le journal de trésorerie, et l'exception d'une charge « / sem » ── */
            const mSuiv = sc.mois === 12 ? 1 : sc.mois + 1;
            const journal = await page.evaluate(async ({ ST, mSuiv }) => {
                const st = eval(ST), an = st.moisBudgetaire.an;
                st.donneesAnnuelles[an].chargesVariables.sorties.exceptions = [{ moisDebut: mSuiv, moisFin: mSuiv, nouvelleValeur: 600 }];
                st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 200));
                const lignes = Object.values(st.bilan.journal).flat().filter(e => e.libelle === 'Charges variables').map(e => ({ mois: e.mois, montant: Math.round(e.montant) }));
                st.donneesAnnuelles[an].chargesVariables.sorties.exceptions = [];
                st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 120));
                return { lignes, libelle: st.nomDuMois(mSuiv) + ' ' + an };
            }, { ST, mSuiv });
            const jl = journal.lignes.find(l => l.mois === journal.libelle);
            const Js = joursCycle(mSuiv, sc.an, JDP), Ns = Js / 7;
            const attenduJ = Math.round((1000 + 600) * Ns + 860 + 800);
            v(`I. journal, ${journal.libelle} (SORTIES en exception à 600 / sem.) : (1 000 + 600) × ${Js} / 7 + 860 + 800`,
              !!jl && jl.montant === attenduJ, JSON.stringify([jl, attenduJ, journal.lignes.slice(0, 3)]));
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
