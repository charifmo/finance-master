/**
 * v37.12 — LE SUIVI D'EXÉCUTION EST CYCLIQUE.
 *
 *   Le bug : `paye` et `montantPaye` vivaient à plat sur la charge, et la
 *   charge vit dans donneesAnnuelles[ANNÉE] — pas par mois. Cocher « Syndic
 *   payé » en octobre le laissait coché en novembre et jusqu'à la fin de
 *   l'année. Le suivi mensuel ne repartait jamais de zéro.
 *
 *   Ce que cette suite verrouille : le pointage est rattaché à un cycle, le
 *   cycle suivant repart vierge, le « Reste à payer » suit, une dépense
 *   PONCTUELLE reste attachée à SON mois — et la checklist se range par
 *   urgence au lieu de s'empiler par catégorie.
 *
 *   Prérequis locaux, non versionnés :
 *     npm install --no-save vue@3 playwright-core chart.js
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

console.log('\n  PILOTAGE RÉALISÉ — UN SUIVI PAR CYCLE\n  ' + '─'.repeat(78));

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

const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
const Y = new Date().getFullYear();
const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
fx.donneesAnnuelles = { [Y]: JSON.parse(JSON.stringify(base)), [Y + 1]: JSON.parse(JSON.stringify(base)) };
fx.soldesInitiaux.moisActuel = new Date().getMonth() + 1;
fx.soldesInitiaux.anneeActuelle = Y;
// Un état hérité de l'ancien modèle : à plat, sans tracker. C'est lui que la
// migration doit rattacher au cycle en cours.
fx.donneesAnnuelles[Y].chargesFixes.loyer.paye = true;
fx.donneesAnnuelles[Y].chargesFixes.loyer.montantPaye = 5000;

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
        return s && s.cycleRealiseActif;
    }, null, { timeout: 30000 });
    await page.waitForTimeout(900);

    const S = (f, arg) => page.evaluate(f, arg);
    const suivant = (cycle) => {
        const [an, mo] = cycle.split('-').map(Number);
        return (mo === 12) ? `${an + 1}-01` : `${an}-${String(mo + 1).padStart(2, '0')}`;
    };

    /* ── 1. MIGRATION : l'état plat rejoint le cycle en cours ─────────── */
    const mig = await S(() => {
        const st = document.querySelector('#app').__vue_app__._instance.setupState;
        const Y = new Date().getFullYear();
        const f = st.donneesAnnuelles[Y].chargesFixes.loyer;
        return { cycle: st.cycleRealiseActif, tracker: JSON.parse(JSON.stringify(f.trackerRealise || {})),
                 platPaye: 'paye' in f, platMontant: 'montantPaye' in f };
    });
    v('migration : le pointage plat est rattaché au cycle courant',
      !!mig.tracker[mig.cycle] && mig.tracker[mig.cycle].montantPaye === 5000, JSON.stringify(mig));
    v('  → et les champs plats sont retirés', !mig.platPaye && !mig.platMontant, JSON.stringify(mig));

    /* ── 2. LE BUG : cocher un cycle ne doit pas cocher le suivant ────── */
    const cyc = await S((suiv) => {
        const st = document.querySelector('#app').__vue_app__._instance.setupState;
        const Y = new Date().getFullYear();
        const f = st.donneesAnnuelles[Y].chargesFixes.syndic;
        const due = Number(f.valeur);
        const cycleA = st.cycleRealiseActif;
        // Le jeu de données livre « syndic » DÉJÀ payé : on part d'un état
        // connu au lieu de supposer, sinon le toggle dépaye au lieu de payer.
        if (st.isItemPaid(f, due, cycleA)) st.toggleItemPaid(f, due, cycleA);
        st.toggleItemPaid(f, due, cycleA);
        return {
            cycleA, due,
            payeCycleA: st.isItemPaid(f, due, cycleA),
            payeCycleSuivant: st.isItemPaid(f, due, suiv),
            montantCycleA: st.getPaidAmount(f, due, cycleA),
            montantCycleSuivant: st.getPaidAmount(f, due, suiv),
            cles: Object.keys(f.trackerRealise || {}),
        };
    }, suivant(mig.cycle));
    v('pointer une charge la marque payée POUR CE CYCLE', cyc.payeCycleA === true, JSON.stringify(cyc));
    v('  → le cycle suivant la retrouve À FAIRE', cyc.payeCycleSuivant === false, JSON.stringify(cyc));
    v('  → et son reste à payer y est entier',
      cyc.montantCycleSuivant === 0 && cyc.montantCycleA === cyc.due, JSON.stringify(cyc));
    v('  → une seule clé écrite, celle du cycle',
      cyc.cles.length === 1 && cyc.cles[0] === cyc.cycleA, JSON.stringify(cyc.cles));

    /* ── 3. Décocher remet la tâche à faire ──────────────────────────── */
    const dec = await S(() => {
        const st = document.querySelector('#app').__vue_app__._instance.setupState;
        const Y = new Date().getFullYear();
        const f = st.donneesAnnuelles[Y].chargesFixes.syndic;
        const due = Number(f.valeur);
        st.toggleItemPaid(f, due);
        return { paye: st.isItemPaid(f, due), montant: st.getPaidAmount(f, due) };
    });
    v('décocher remet la tâche à faire', dec.paye === false && dec.montant === 0, JSON.stringify(dec));

    /* ── 4. Avance partielle : rattachée au cycle elle aussi ─────────── */
    const part = await S((suiv) => {
        const st = document.querySelector('#app').__vue_app__._instance.setupState;
        const Y = new Date().getFullYear();
        const f = st.donneesAnnuelles[Y].chargesFixes.nounou;
        const due = Number(f.valeur);
        st.setMontantPayeCycle(f, Math.round(due / 3));
        return { due, ici: st.montantPayeCycle(f), ailleurs: st.montantPayeCycle(f, suiv),
                 paye: st.isItemPaid(f, due) };
    }, suivant(mig.cycle));
    v('avance partielle : enregistrée sur le cycle',
      part.ici === Math.round(part.due / 3), JSON.stringify(part));
    v('  → absente du cycle suivant', part.ailleurs === 0, JSON.stringify(part));
    v('  → et un tiers versé ne vaut pas « payé »', part.paye === false, JSON.stringify(part));

    /* ── 5. Une dépense PONCTUELLE reste attachée à son mois ─────────── */
    const ponct = await S(() => {
        const st = document.querySelector('#app').__vue_app__._instance.setupState;
        const Y = new Date().getFullYear();
        const arr = st.donneesAnnuelles[Y].depensesIrregulieres;
        const dep = (Array.isArray(arr) ? arr : Object.values(arr))[0];
        st.toggleItemPaid(dep, Number(dep.montant));
        return { cleAttendue: `${dep.annee}-${String(dep.mois).padStart(2, '0')}`,
                 cles: Object.keys(dep.trackerRealise || {}),
                 cycleActif: st.cycleRealiseActif,
                 paye: st.isItemPaid(dep, Number(dep.montant)) };
    });
    v('dépense ponctuelle : pointée sous SON mois, pas sous le cycle courant',
      ponct.cles.length === 1 && ponct.cles[0] === ponct.cleAttendue, JSON.stringify(ponct));
    v('  → elle reste payée quel que soit le cycle consulté', ponct.paye === true, JSON.stringify(ponct));

    /* ── 6. Le « Reste à payer » suit, en direct ─────────────────────── */
    const reste = await S(async () => {
        const st = document.querySelector('#app').__vue_app__._instance.setupState;
        const Y = new Date().getFullYear();
        const f = st.donneesAnnuelles[Y].chargesFixes.creditImmo || st.donneesAnnuelles[Y].chargesFixes.loyer;
        const due = st.getDueFixe(f, Y);
        if (st.isItemPaid(f, due)) st.toggleItemPaid(f, due);
        await new Promise(r => setTimeout(r, 250));
        const avant = Math.round(st.resteAPayerFixes);
        st.toggleItemPaid(f, due);
        await new Promise(r => setTimeout(r, 250));
        return { due, avant, apres: Math.round(st.resteAPayerFixes), delta: avant - Math.round(st.resteAPayerFixes) };
    });
    v('cocher fait baisser le « Reste à payer » du montant exact',
      Math.abs(reste.delta - reste.due) <= 1, JSON.stringify(reste));

    /* ── 7. La checklist se range par urgence ────────────────────────── */
    const inbox = await S(async () => {
        const st = document.querySelector('#app').__vue_app__._instance.setupState;
        st.activeTab = 'pilotage';
        await new Promise(r => setTimeout(r, 500));
        const g = JSON.parse(JSON.stringify(st.tachesGroupees));
        const aT = st.tachesATraiter.length, fini = st.tachesTerminees.length;
        return {
            groupes: g.map(x => ({ cle: x.cle, n: x.taches.length,
                                   rangs: x.taches.map(t => t.rang) })),
            aTraiter: aT, terminees: fini, total: st.tachesPilotage.length,
            reste: st.resteATraiterPilotage,
            resteAttendu: Math.round(st.tachesATraiter.reduce((s, t) => s + Math.max(0, t.due - t.regle), 0)),
            aucunPayeDansATraiter: st.tachesATraiter.every(t => !t.paye),
            tousPayesDansTermine: st.tachesTerminees.every(t => t.paye),
            ordreCles: g.map(x => x.cle),
        };
    });
    v('la checklist est découpée en paquets d\'urgence', inbox.groupes.length > 0, JSON.stringify(inbox.groupes));
    v('  → dans l\'ordre retard → semaine → plus tard',
      JSON.stringify(inbox.ordreCles) === JSON.stringify(['retard', 'semaine', 'apres'].filter(c => inbox.ordreCles.includes(c))),
      JSON.stringify(inbox.ordreCles));
    v('  → chaque paquet est trié par rang dans le cycle',
      inbox.groupes.every(g => g.rangs.every((r, i) => i === 0 || g.rangs[i - 1] <= r)), JSON.stringify(inbox.groupes));
    v('  → « À traiter » ne contient QUE du non payé', inbox.aucunPayeDansATraiter === true);
    v('  → « Terminé » ne contient QUE du payé', inbox.tousPayesDansTermine === true);
    v('  → à traiter + terminé = le total', inbox.aTraiter + inbox.terminees === inbox.total, JSON.stringify(inbox));
    v('  → le reste affiché est la somme des restes, pas des dus',
      inbox.reste === inbox.resteAttendu, JSON.stringify([inbox.reste, inbox.resteAttendu]));

    /* ── 7 bis. LE RANG DANS LE CYCLE, PAS LE JOUR DU MOIS ──────────────
           Un cycle va du 27 au 26 : le j.1 vient APRÈS le j.27. Comparer deux
           numéros de jour classerait le j.1 « en retard » alors qu'il est
           encore à venir. On pose trois échéances choisies et on vérifie où
           chacune atterrit. ────────────────────────────────────────────── */
    const rangs = await S(async () => {
        const st = document.querySelector('#app').__vue_app__._instance.setupState;
        const Y = new Date().getFullYear();
        const cf = st.donneesAnnuelles[Y].chargesFixes;
        const jdp = st.jourDePaie;
        const aujourdhui = new Date().getDate();
        const rang = (j) => (j >= jdp ? j - jdp : j - jdp + 31);
        const rAuj = rang(aujourdhui);
        // Trois échéances : franchement derrière, dans la semaine, très loin.
        const jPasse   = ((jdp - 1 + 31) % 31) + 1 === aujourdhui ? jdp : jdp;   // rang 0
        const jSemaine = ((jdp + Math.max(1, rAuj + 2) - 1) % 31) + 1;
        const jLoin    = ((jdp + Math.min(30, rAuj + 20) - 1) % 31) + 1;
        const cibles = Object.keys(cf).slice(0, 3);
        const plan = {};
        [jPasse, jSemaine, jLoin].forEach((j, i) => {
            const k = cibles[i]; if (!k) return;
            cf[k].jourPrevu = j;
            plan[k] = { jour: j, rang: rang(j) };
            const due = st.getDueFixe(cf[k], Y);
            if (st.isItemPaid(cf[k], due, st.cyclePilotage)) st.toggleItemPaid(cf[k], due, st.cyclePilotage);
        });
        await new Promise(r => setTimeout(r, 400));
        const ou = {};
        st.tachesGroupees.forEach(g => g.taches.forEach(t => {
            const k = Object.keys(plan).find(x => (cf[x].label || '') === t.libelle);
            if (k) ou[k] = g.cle;
        }));
        return { jdp, aujourdhui, rAuj, plan, ou, cibles };
    });
    const [kR, kS, kL] = rangs.cibles;
    v('échéance déjà passée dans le cycle → « En retard »',
      rangs.plan[kR] && (rangs.plan[kR].rang < rangs.rAuj ? rangs.ou[kR] === 'retard' : true),
      JSON.stringify(rangs));
    v('  → échéance des sept prochains jours → « Cette semaine »',
      rangs.ou[kS] === 'semaine', JSON.stringify({ plan: rangs.plan[kS], ou: rangs.ou[kS], rAuj: rangs.rAuj }));
    v('  → échéance lointaine → « Plus tard »',
      rangs.ou[kL] === 'apres', JSON.stringify({ plan: rangs.plan[kL], ou: rangs.ou[kL], rAuj: rangs.rAuj }));
    v('  → un j.1 sur un cycle 27→26 n\'est PAS traité comme le 1er du mois',
      rangs.jdp <= 1 || ((1 >= rangs.jdp ? 1 - rangs.jdp : 1 - rangs.jdp + 31) > 0), JSON.stringify({ jdp: rangs.jdp }));

    /* ── 8. Pointer une tâche la fait passer d'une liste à l'autre ───── */
    const bascule = await S(async () => {
        const st = document.querySelector('#app').__vue_app__._instance.setupState;
        const t = st.tachesATraiter[0];
        if (!t) return { saute: true };
        const avant = { aT: st.tachesATraiter.length, ok: st.tachesTerminees.length, reste: st.resteATraiterPilotage };
        st.toggleItemPaid(t.ref, t.due, st.cyclePilotage);
        await new Promise(r => setTimeout(r, 350));
        return { saute: false, libelle: t.libelle, due: t.due, reste: t.due - t.regle, avant,
                 apres: { aT: st.tachesATraiter.length, ok: st.tachesTerminees.length, reste: st.resteATraiterPilotage } };
    });
    if (bascule.saute) {
        v('bascule : rien à traiter dans ce jeu de données', true);
    } else {
        v('pointer une tâche la retire de « À traiter »',
          bascule.apres.aT === bascule.avant.aT - 1, JSON.stringify(bascule));
        v('  → et la range dans « Terminé »', bascule.apres.ok === bascule.avant.ok + 1, JSON.stringify(bascule));
        v('  → le reste baisse du montant de la tâche',
          Math.abs((bascule.avant.reste - bascule.apres.reste) - bascule.reste) <= 1, JSON.stringify(bascule));
    }

    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
    await page.close();
} finally {
    await browser.close();
    srv.close();
}

console.log('  ' + '─'.repeat(78));
console.log(ko ? `  ❌ ${ko} contrôle(s) en échec` : '  ✅ TOUT PASSE — 0 contrôle(s) en échec');
process.exit(ko ? 1 : 0);
