/**
 * v37.16 — LE COCKPIT DU PILOTAGE RÉALISÉ.
 *
 *   Le ticket (04/10/2026, vidéo à l'appui) : « les infobulles se chevauchent,
 *   les données ne sont pas orientées vers l'action ». Trois chiffres en tête,
 *   une file de travail catégorisée, une validation en un clic.
 *
 *   CE QUE LA VIDÉO MONTRAIT, ET QUE CETTE SUITE VERROUILLE :
 *     - deux bulles ouvertes l'une sur l'autre : celle de « Budget conso »
 *       laissait passer la souris (pointer-events-none) jusqu'à la carte du
 *       dessous, qui ouvrait la sienne. Un z-index plus haut n'y change rien —
 *       les deux l'auraient. Il faut qu'il n'y en ait qu'UNE ;
 *     - trois « atterrissages » différents sur le même écran. Le cockpit lit
 *       le moteur du Relevé, et l'ancien chiffre isolé disparaît.
 *
 *   Le jeu de données est bâti autour de la date du jour : le jour de paie est
 *   choisi pour qu'on soit à peu près au 8e jour du cycle, et chaque ligne est
 *   posée par son RANG dans le cycle (en retard, aujourd'hui, cette semaine,
 *   plus tard, sans date). Les montants sont choisis pour que chaque total
 *   attendu se lise à la main.
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

console.log('\n  COCKPIT DU PILOTAGE — TROIS CHIFFRES, UNE FILE, UNE BULLE À LA FOIS\n  ' + '─'.repeat(80));

/* ── A. Contrôles statiques : ils tournent partout, même sans navigateur ── */
const debutOnglet = html.indexOf(`<div v-if="activeTab === 'pilotage'"`);
const finOnglet = html.indexOf('<!-- v20.98 — TRACKER ASSURANCES');
const onglet = debutOnglet > 0 && finOnglet > debutOnglet ? html.slice(debutOnglet, finOnglet) : '';
v('l\'onglet Pilotage est localisable dans le source', onglet.length > 1000);
v('plus aucune infobulle « transparente à la souris » dans l\'onglet',
  !/pointer-events-none[^"]*group-hover:opacity-100/.test(onglet) && !/group-hover:opacity-100[^"]*pointer-events-none/.test(onglet),
  'une bulle qui laisse passer la souris réveille la carte du dessous');
const bulles = onglet.match(/<div[^>]*\sdata-bulle\s[^>]*>\s*<div[^>]*>/g) || [];
v('chaque bulle est en absolute z-[200], boîte en shadow-2xl',
  bulles.length >= 3 && bulles.every(b => /class="[^"]*\babsolute\b[^"]*z-\[200\]/.test(b) && /shadow-2xl/.test(b)),
  JSON.stringify(bulles.map(b => b.slice(0, 120))));
const porteurs = onglet.match(/<div[^>]*data-bulle-cle[^>]*>/g) || [];
v('… et chaque porteur de bulle est en « relative »',
  porteurs.length >= 3 && porteurs.every(t => /class="relative\b/.test(t)), JSON.stringify(porteurs.map(t => t.slice(0, 100))));
v('l\'ancien atterrissage isolé (journalHybride) n\'est plus affiché',
  !onglet.includes('journalHybride.soldeAtterrissage'), 'un troisième chiffre pour la même question');

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

/* La feuille Tailwind du projet, reconstruite : sans elle, ni z-index ni
   mise en page ne sont mesurables (cdn.tailwindcss.com est injoignable ici). */
const twBin = path.join(RACINE, 'node_modules/.bin/tailwindcss');
const twCss = essai(() => {
    if (!fs.existsSync(twBin)) return null;
    const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'twcockpit-'));
    fs.writeFileSync(path.join(tmp, 'in.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
    fs.writeFileSync(path.join(tmp, 'cfg.js'),
        'module.exports={content:[' + JSON.stringify(path.join(RACINE, 'index.html')) + '],theme:{extend:{}}};');
    execFileSync(twBin, ['-c', path.join(tmp, 'cfg.js'), '-i', path.join(tmp, 'in.css'),
                         '-o', path.join(tmp, 'out.css'), '--minify'], { stdio: 'ignore' });
    const css = fs.readFileSync(path.join(tmp, 'out.css'), 'utf8');
    return css.length > 10000 ? css : null;
});
const MISE_EN_PAGE = !!twCss;

/* ── B. Le décor : on se place vers le 8e jour du cycle ─────────────────── */
const maintenant = new Date();
const T = maintenant.getDate();
const rangDe = (j, jdp) => (j >= jdp ? j - jdp : j - jdp + 31);
let jourDePaie = 2;
for (let c = 2; c <= 28; c++) if (Math.abs(rangDe(T, c) - 8) < Math.abs(rangDe(T, jourDePaie) - 8)) jourDePaie = c;
const R = rangDe(T, jourDePaie);                         // rang d'aujourd'hui
const jourDuRang = (r) => { const j = jourDePaie + r; return j > 31 ? j - 31 : j; };
const Y = maintenant.getFullYear();
const MOIS_CIVIL = maintenant.getMonth() + 1;
const MOIS_BUDGET = T >= jourDePaie ? (MOIS_CIVIL === 12 ? 1 : MOIS_CIVIL + 1) : MOIS_CIVIL;
const AN_BUDGET = (T >= jourDePaie && MOIS_CIVIL === 12) ? Y + 1 : Y;
const CYCLE = AN_BUDGET + '-' + String(MOIS_BUDGET).padStart(2, '0');
const finCycle = new Date(AN_BUDGET, MOIS_BUDGET - 1, jourDePaie - 1);
const MOIS_LONGS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const DATE_FIN = finCycle.getDate() + ' ' + MOIS_LONGS[finCycle.getMonth()];

const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
fx.donneesAnnuelles = {};
for (const an of [AN_BUDGET, AN_BUDGET + 1]) fx.donneesAnnuelles[an] = JSON.parse(JSON.stringify(base));
Object.assign(fx.soldesInitiaux, {
    moisActuel: MOIS_BUDGET, anneeActuelle: AN_BUDGET, jourDePaie,
    compteChargesFixes: 'cpt_2', compteChargesVariables: 'courant', assurances_tracker: [],
});
fx.comptes = [
    { id: 1, label: 'Compte Courant', type: 'courant', solde: 1000, icone: '💳' },
    { id: 2, label: 'Compte Annexe Test', type: 'epargne', solde: 500, icone: '🏛️' },
];
//  Les valeurs par défaut de l'application sont FUSIONNÉES au chargement : on
//  neutralise chacune de leurs clés, sinon elles s'ajoutent à nos lignes.
const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
const paye = (m) => ({ [CYCLE]: { paye: true, montantPaye: m, dateReelle: '' } });
for (const an of Object.keys(fx.donneesAnnuelles)) {
    const d = fx.donneesAnnuelles[an];
    const P = Number(an) === AN_BUDGET;
    const Rv = (label, base, j, tr) => ({ ...neutre, label, base, jourPrevu: j, destinationCompte: 'courant', trackerRealise: tr || {} });
    d.revenus = {
        salaire: Rv('PAIE TEST', 9000, jourDePaie, P ? paye(9000) : null),
        bonif: Rv('—', 0), magasin: Rv('—', 0), cnss: Rv('—', 0), appart: Rv('—', 0), studio: Rv('—', 0),
        attendu: Rv('REVENU ATTENDU', 1200, jourDuRang(R + 5)),
    };
    const Fx = (id, label, valeur, j, tr) => ({ ...neutre, id, label, valeur, jourPrevu: j, trackerRealise: tr || {} });
    d.chargesFixes = {
        creditImmo: Fx('d1', '—', 0), creditStudio: Fx('d2', '—', 0), syndic: Fx('d3', '—', 0),
        nounou: Fx('d4', '—', 0), ecole: Fx('d5', '—', 0), femmeMenage: Fx('d6', '—', 0),
        habitsCharif: Fx('d7', '—', 0), habitsBebe: Fx('d8', '—', 0), jouets: Fx('d9', '—', 0),
        fRetard:  Fx('t1', 'FIXE EN RETARD', 700, jourDuRang(R - 2)),
        fPartiel: Fx('t2', 'FIXE AVANCE PARTIELLE', 1000, jourDuRang(R - 1), P ? { [CYCLE]: { paye: false, montantPaye: 300 } } : null),
        fJour:    Fx('t3', 'FIXE DU JOUR', 400, jourDuRang(R)),
        fSemaine: Fx('t4', 'FIXE DANS 3 JOURS', 900, jourDuRang(R + 3)),
        fLoin:    Fx('t5', 'FIXE LOINTAINE', 1100, jourDuRang(R + 12)),
        fSansDate:Fx('t6', 'FIXE SANS DATE', 250, null),
        fPaye:    Fx('t7', 'FIXE DEJA PAYEE', 1500, jourDuRang(R - 5), P ? paye(1500) : null),
    };
    const V0 = (label) => ({ ...neutre, label, valeur: 0, periode: 'semaine', details: [] });
    d.chargesVariables = {
        alimentation: V0('—'), sante: V0('—'), sorties: V0('—'), voiture: V0('—'),
        factures: { ...neutre, label: 'Factures', valeur: 150, periode: 'mois', categorieId: 'cat_cv_factures',
                    jourPrevu: jourDuRang(R + 1), details: [{ id: 901, nom: 'VARIABLE SEMAINE', montant: 150 }] },
    };
    d.epargne = [{ id: 31, nom: 'EPARGNE EN RETARD', valeur: 500, sourceCompte: 'courant', jourPrevu: jourDuRang(R - 3) }];
    d.depensesIrregulieres = P ? [{ id: 41, mois: MOIS_BUDGET, annee: AN_BUDGET, nom: 'EXCEPTIONNEL SANS DATE', montant: 2000, sourceCompte: 'courant' }] : [];
    d.virementsInternes = [];
    d.transactionsReelles = [];
}

/*  Attendus, lisibles à la main (restes = dû − avance) :
      En retard     : 700 + (1000−300) + 500        = 1 900   (3 lignes)
      Cette semaine : 400 + 150 + 900               = 1 450   (3 lignes)
      Reste du mois : 1100 + 250 + 2000             = 3 350   (3 lignes, dont 2 sans date)
      Urgence       : 1 900 + 1 450                 = 3 350
      Réglé         : 1500 (payée) + 300 (avance)   = 1 800 ; total 1 800 + 6 700 = 8 500
      Échues (fixes, date arrivée) : 700 + 700 + 400 = 1 800 (3 lignes)
      Courant       : 1000 + 1200 − 150 − 500 − 2000 = −450
      Annexe        : 500 − (700+700+400+900+1100+250) = −3 550                        */
const ATTENDU = { retard: 1900, semaine: 1450, reste: 3350, urgence: 3350, regle: 1800, total: 8500,
                  echues: 1800, nbEchues: 3, courant: -450, annexe: -3550 };

const page0 = html
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/,
             twCss ? '<link rel="stylesheet" href="/tailwind.css">' : '')
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

const ouvrir = async (opts) => {
    const page = await browser.newPage(opts);
    const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
    page.on('dialog', d => d.accept());
    await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => {
        const a = document.querySelector('#app');
        const s = a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState;
        return s && s.moisBudgetaire;
    }, null, { timeout: 30000 });
    await page.waitForTimeout(700);
    await page.evaluate(async () => {
        const st = document.querySelector('#app').__vue_app__._instance.setupState;
        st.appMode = 'reel'; await new Promise(r => setTimeout(r, 300));
        st.activeTab = 'pilotage';
    });
    await page.waitForTimeout(700);
    return { page, erreurs };
};
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
const txt = (s) => String(s || '').replace(/[\s  ]+/g, ' ').trim();
const mad = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' DH';

try {
    const { page, erreurs } = await ouvrir({ viewport: { width: 1400, height: 1000 } });
    console.log(`  ── aujourd'hui j.${T} · paie le ${jourDePaie} · rang ${R} · cycle ${CYCLE} · fin le ${DATE_FIN}`);
    const present = await page.evaluate((ST) => { const st = eval(ST); return !!(st.kpiUrgence && st.kpiProgression && st.kpiAtterrissage); }, ST);
    v('le cockpit est exposé (Urgence, Progression, Atterrissage)', present, 'kpiUrgence / kpiProgression / kpiAtterrissage absents');
    if (!present) throw new Error('COCKPIT_ABSENT');

    /* ── C. Les trois chiffres = les sources qu'ils prétendent lire ───────── */
    const k = await page.evaluate((ST) => {
        const st = eval(ST);
        const pq = Object.fromEntries(st.tachesGroupees.map(p => [p.cle, { total: p.total, n: p.taches.length, titre: p.titre }]));
        const dom = (sel) => { const e = document.querySelector(sel); return e ? e.innerText : null; };
        return {
            cycle: st.cyclePilotage, moisBud: st.moisBudgetaire.mois, rAuj: st._rangAujourdhuiTest,
            urgence: st.kpiUrgence, progression: st.kpiProgression,
            atterr: { montant: st.kpiAtterrissage.montant, negatif: st.kpiAtterrissage.negatif, dateFin: st.kpiAtterrissage.dateFin,
                      vedette: st.kpiAtterrissage.vedette && st.kpiAtterrissage.vedette.key,
                      alertes: st.kpiAtterrissage.alertes.map(c => [c.key, c.atterrissage]) },
            pq, resteATraiter: st.resteATraiterPilotage, couverture: st.couvertureCourant,
            echues: st.chargesFixesEchues.map(t => t.libelle), montantEchues: st.montantChargesFixesEchues,
            domUrgence: dom('[data-kpi="urgence"] [data-kpi-valeur]'),
            domRetard: dom('[data-kpi="urgence"] [data-kpi-retard]'),
            domRegle: dom('[data-kpi="progression"] [data-kpi-valeur]'),
            domProgression: dom('[data-kpi="progression"]'),
            domAtterr: dom('[data-kpi="atterrissage"] [data-kpi-valeur]'),
            domPhrase: dom('[data-kpi="atterrissage"] [data-kpi-phrase]'),
            domAutre: [...document.querySelectorAll('[data-kpi="atterrissage"] [data-kpi-autre-alerte]')].map(e => e.innerText),
            alerte: (document.querySelector('[data-kpi="atterrissage"]') || {}).dataset?.alerte,
            barre: (() => { const b = document.querySelector('[data-kpi-barre] > div'); return b ? b.style.width : null; })(),
        };
    }, ST);

    v(`le cycle construit est bien ${CYCLE} (rang du jour ${R})`, k.cycle === CYCLE && k.rAuj === R,
      JSON.stringify({ cycle: k.cycle, rAuj: k.rAuj }));
    v('paquets : En retard / Cette semaine / Reste du mois aux bons totaux',
      k.pq.retard?.total === ATTENDU.retard && k.pq.semaine?.total === ATTENDU.semaine && k.pq.apres?.total === ATTENDU.reste
      && k.pq.apres?.titre === '📅 Reste du mois', JSON.stringify(k.pq));
    v(`🔥 Urgence = En retard + Cette semaine = ${ATTENDU.urgence} DH`,
      k.urgence.montant === ATTENDU.urgence && k.urgence.montant === k.pq.retard.total + k.pq.semaine.total, JSON.stringify(k.urgence));
    v('  → dont la part en retard, chiffrée à part', k.urgence.retard === ATTENDU.retard && /1\s?900/.test(txt(k.domRetard)),
      JSON.stringify([k.urgence.retard, k.domRetard]));
    v('  → les lignes sans date sont annoncées, pas comptées', k.urgence.sansDate === 2, String(k.urgence.sansDate));
    v('  → la carte affiche exactement ce chiffre', txt(k.domUrgence) === txt(mad(ATTENDU.urgence)), JSON.stringify(k.domUrgence));
    v(`📈 réglé ${ATTENDU.regle} / total ${ATTENDU.total} (payé + avances / dû)`,
      k.progression.regle === ATTENDU.regle && k.progression.total === ATTENDU.total, JSON.stringify(k.progression));
    v('  → réglé + reste = total, et le reste est celui de « À traiter »',
      k.progression.regle + k.progression.reste === k.progression.total && k.progression.reste === k.resteATraiter,
      JSON.stringify([k.progression, k.resteATraiter]));
    v('  → la barre est remplie au pourcentage annoncé',
      k.barre === Math.round(ATTENDU.regle / ATTENDU.total * 100) + '%' && txt(k.domRegle) === '1 800',
      JSON.stringify([k.barre, k.domRegle]));
    v('  → le détail par nature est donné (Fixe / Variable / Épargne / Exceptionnel)',
      ['🏢 Fixe', '🛒 Variable', '💎 Épargne', '⚠️ Exceptionnel'].every(b => k.domProgression.includes(b)), k.domProgression);
    v(`🚨 courant à ${ATTENDU.courant} DH le ${DATE_FIN}`,
      k.atterr.montant === ATTENDU.courant && k.atterr.dateFin === DATE_FIN, JSON.stringify(k.atterr));
    v('  → carte en alerte rouge, phrase exacte du ticket',
      k.alerte === 'oui' && txt(k.domPhrase) === txt(`Découvert projeté le ${DATE_FIN} :`) && txt(k.domAtterr) === txt(mad(ATTENDU.courant)),
      JSON.stringify([k.alerte, k.domPhrase, k.domAtterr]));
    v('  → l\'autre compte à découvert est signalé avec son montant',
      k.atterr.alertes.length === 1 && k.atterr.alertes[0][1] === ATTENDU.annexe
      && k.domAutre.length === 1 && /Compte Annexe Test/.test(k.domAutre[0]) && /3\s?550/.test(txt(k.domAutre[0])),
      JSON.stringify([k.atterr.alertes, k.domAutre]));

    /* UN SEUL ATTERRISSAGE : la carte = le Relevé filtré sur le compte = la
       couverture que l'ancien écran affichait dans sa bulle. */
    const releve = await page.evaluate(async (ST) => {
        const st = eval(ST);
        const lire = async (cle) => {
            st.moisSelectionnes.splice(0); st.anneesSelectionnees.splice(0);
            st.releveComptesFiltres.splice(0, st.releveComptesFiltres.length, cle);
            await new Promise(r => setTimeout(r, 30));
            return st.journalHybridePourReleve.soldeAtterrissage;
        };
        const r = { courant: await lire('cpt_1'), annexe: await lire('cpt_2') };
        st.releveComptesFiltres.splice(0);
        return r;
    }, ST);
    v('un seul atterrissage : carte = Relevé (courant) = ancienne couverture',
      Math.round(releve.courant) === k.atterr.montant && Math.round(k.couverture) === k.atterr.montant,
      JSON.stringify({ releve, carte: k.atterr.montant, couverture: k.couverture }));
    v('  → et pour l\'autre compte, carte = Relevé', Math.round(releve.annexe) === ATTENDU.annexe, JSON.stringify(releve));

    /* ── D. La file : badges de nature, ordre, paquets ─────────────────────── */
    const file = await page.evaluate(() => {
        const lignes = [...document.querySelectorAll('#pilotage-inbox [data-tache]')].map(row => {
            const b = row.querySelector('[data-badge-nature]'), n = row.querySelector('[data-tache-nom]');
            return { nom: n ? n.innerText.trim() : null, badge: b ? b.innerText.trim() : null, nature: b ? b.dataset.nature : null,
                     badgeAvantNom: !!(b && n && (b.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING)) };
        });
        //  textContent, pas innerText : la classe « uppercase » transformerait le texte lu.
        const titres = [...document.querySelectorAll('#pilotage-inbox [data-paquet-titre]')].map(e => e.textContent.trim());
        return { lignes, titres };
    });
    const attenduBadge = { 'FIXE EN RETARD': '🏢 Fixe', 'FIXE AVANCE PARTIELLE': '🏢 Fixe', 'FIXE DU JOUR': '🏢 Fixe',
        'FIXE DANS 3 JOURS': '🏢 Fixe', 'FIXE LOINTAINE': '🏢 Fixe', 'FIXE SANS DATE': '🏢 Fixe',
        'VARIABLE SEMAINE': '🛒 Variable', 'EPARGNE EN RETARD': '💎 Épargne', 'EXCEPTIONNEL SANS DATE': '⚠️ Exceptionnel' };
    v('les trois paquets, dans l\'ordre où on les traite',
      JSON.stringify(file.titres) === JSON.stringify(['⚠️ En retard', '⏳ Cette semaine', '📅 Reste du mois']), JSON.stringify(file.titres));
    v('chaque ligne porte son badge de nature, le bon',
      file.lignes.length === 9 && file.lignes.every(l => attenduBadge[l.nom] === l.badge),
      JSON.stringify(file.lignes.map(l => [l.nom, l.badge])));
    v('  → et le badge précède le nom', file.lignes.every(l => l.badgeAvantNom), JSON.stringify(file.lignes));

    /* ── E. Validation en un clic : les fixes ÉCHUES, rien d'autre ───────── */
    v(`le bouton propose les ${ATTENDU.nbEchues} fixes échues (${ATTENDU.echues} DH)`,
      k.echues.length === ATTENDU.nbEchues && k.montantEchues === ATTENDU.echues
      && ['FIXE EN RETARD', 'FIXE AVANCE PARTIELLE', 'FIXE DU JOUR'].every(n => k.echues.includes(n)),
      JSON.stringify([k.echues, k.montantEchues]));
    /* v37.17 — le variable se SAISIT, le fixe se COCHE (ou se valide en un clic) */
    const saisies = await page.evaluate(() => [...document.querySelectorAll('#pilotage-inbox [data-tache]')]
        .map(r => [r.dataset.natureLigne, (r.querySelector('input[type=number]') || {}).dataset?.saisie,
                   !!r.querySelector('[data-chip-echue]'), r.querySelector('[data-tache-nom]').textContent.trim()]));
    v('saisie invitante (variable, exceptionnel), discrète (fixe, épargne)',
      saisies.length === 9 && saisies.every(([n, sa]) => (n === 'variable' || n === 'exceptionnel') ? sa === 'invitante' : sa === 'discrete'),
      JSON.stringify(saisies));
    v('  → la pastille « ⚡ échue » marque exactement les fixes du bouton',
      JSON.stringify(saisies.filter(x => x[2]).map(x => x[3]).sort()) === JSON.stringify(['FIXE AVANCE PARTIELLE', 'FIXE DU JOUR', 'FIXE EN RETARD']),
      JSON.stringify(saisies.filter(x => x[2])));
    await page.hover('[data-valider-echues]');
    await page.waitForTimeout(150);
    const allumees = await page.evaluate(() => [...document.querySelectorAll('#pilotage-inbox [data-tache]')]
        .filter(r => r.className.includes('ring-emerald-400')).map(r => r.querySelector('[data-tache-nom]').textContent.trim()).sort());
    await page.mouse.move(5, 5);
    v('  → survoler le bouton allume les lignes qu\'il va cocher, et elles seules',
      JSON.stringify(allumees) === JSON.stringify(['FIXE AVANCE PARTIELLE', 'FIXE DU JOUR', 'FIXE EN RETARD']), JSON.stringify(allumees));

    const etat = (page) => page.evaluate(({ ST, CYCLE }) => {
        const st = eval(ST);
        const d = st.donneesAnnuelles[Number(CYCLE.slice(0, 4))];
        const tr = (it) => JSON.stringify((it.trackerRealise || {})[CYCLE] || null);
        return {
            fixes: Object.fromEntries(Object.values(d.chargesFixes).filter(f => f.valeur > 0).map(f => [f.label, tr(f)])),
            epargne: tr(d.epargne[0]), variable: tr(d.chargesVariables.factures.details[0]),
            urgence: st.kpiUrgence.montant, aTraiter: st.tachesATraiter.length,
        };
    }, { ST, CYCLE });
    const avant = await etat(page);
    await page.click('[data-valider-echues]');
    await page.waitForTimeout(400);
    const apres = await etat(page);
    const paye3 = ['FIXE EN RETARD', 'FIXE AVANCE PARTIELLE', 'FIXE DU JOUR'].every(n => /"paye":true/.test(apres.fixes[n]));
    const intactes = ['FIXE DANS 3 JOURS', 'FIXE LOINTAINE', 'FIXE SANS DATE'].every(n => apres.fixes[n] === avant.fixes[n]);
    v('un clic : les trois fixes échues passent payées', paye3, JSON.stringify(apres.fixes));
    v('  → l\'avance partielle est complétée au dû, pas laissée à 300',
      /"montantPaye":1000/.test(apres.fixes['FIXE AVANCE PARTIELLE']), apres.fixes['FIXE AVANCE PARTIELLE']);
    v('  → la fixe de dans 3 jours, la lointaine et la sans-date restent ouvertes', intactes, JSON.stringify(apres.fixes));
    v('  → l\'épargne et la variable ne sont pas touchées (ce ne sont pas des fixes)',
      apres.epargne === avant.epargne && apres.variable === avant.variable, JSON.stringify([apres.epargne, apres.variable]));
    v('  → l\'Urgence baisse exactement du montant validé',
      avant.urgence - apres.urgence === ATTENDU.echues, JSON.stringify([avant.urgence, apres.urgence]));
    const bandeau = await page.evaluate(() => { const e = document.querySelector('[data-validation-faite]'); return e ? e.innerText : null; });
    v('  → un bandeau confirme et propose d\'annuler', !!bandeau && /3 charges validées/.test(txt(bandeau)), JSON.stringify(bandeau));
    await page.click('[data-annuler-validation]');
    await page.waitForTimeout(400);
    const annule = await etat(page);
    v('« Annuler » rend EXACTEMENT l\'état d\'avant, avance de 300 comprise',
      JSON.stringify(annule.fixes) === JSON.stringify(avant.fixes) && annule.urgence === avant.urgence,
      JSON.stringify({ avant: avant.fixes, annule: annule.fixes }));

    /* ── F. Les bulles : une seule, opaque, au-dessus de tout ─────────────── */
    if (MISE_EN_PAGE) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.hover('[data-kpi="atterrissage"]');
        await page.waitForTimeout(150);
        const b1 = await page.evaluate(() => {
            const bulles = [...document.querySelectorAll('[data-bulle]')];
            const b = bulles[0]; if (!b) return { n: 0 };
            const cs = getComputedStyle(b), fond = getComputedStyle(b.firstElementChild);
            const r = b.firstElementChild.getBoundingClientRect();
            const parent = b.closest('[data-bulle-cle]');
            // Un point bas de la bulle, dans l'écran, tombe sur la file « À
            // traiter » : c'est la bulle qu'on doit trouver, pas ce qu'il y a dessous.
            const x = r.left + r.width / 2, y = Math.min(r.bottom, window.innerHeight) - 20;
            const sous = document.elementFromPoint(x, y);
            return { n: bulles.length, pos: cs.position, z: cs.zIndex, ombre: fond.boxShadow !== 'none',
                     fond: fond.backgroundColor, parentRelatif: parent ? getComputedStyle(parent).position : null,
                     dessus: !!(sous && b.contains(sous)), x, y };
        });
        v('survol de l\'Atterrissage : UNE bulle, absolute, z-index 200, ombrée',
          b1.n === 1 && b1.pos === 'absolute' && b1.z === '200' && b1.ombre, JSON.stringify(b1));
        v('  → fond opaque (aucune transparence qui superpose deux textes)',
          /^rgb\(/.test(b1.fond) || /,\s*1\)$/.test(b1.fond), b1.fond);
        v('  → parent en position relative', b1.parentRelatif === 'relative', String(b1.parentRelatif));
        v('  → elle passe AU-DESSUS de la file de travail', b1.dessus === true, JSON.stringify(b1));
        // La souris descend DANS la bulle : elle doit rester ouverte, seule.
        await page.mouse.move(b1.x, b1.y, { steps: 6 });
        await page.waitForTimeout(150);
        const b2 = await page.evaluate((ST) => ({ n: document.querySelectorAll('[data-bulle]').length, cle: eval(ST).bulleOuverte }), ST);
        v('  → la souris entre dans la bulle : elle reste, et reste seule',
          b2.n === 1 && b2.cle === 'kpi-atterrissage', JSON.stringify(b2));
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
        v('  → Échap la referme', await page.evaluate(() => document.querySelectorAll('[data-bulle]').length) === 0);

        // LE CAS DE LA VIDÉO : la bulle d'une carte descend sur la carte du
        // dessous. On ouvre les comptes et on glisse de la 1re carte vers sa bulle.
        await page.evaluate(() => { const d = document.querySelector('[data-comptes-cycle]'); if (d) d.open = true; });
        await page.waitForTimeout(200);
        const cartes = await page.evaluate(() => [...document.querySelectorAll('[data-comptes-cycle] [data-compte]')].map(b => {
            const r = b.getBoundingClientRect(); return { cle: b.dataset.compte, x: r.left + r.width / 2, y: r.top + r.height / 2, bas: r.bottom, gauche: r.left, haut: r.top };
        }));
        if (cartes.length >= 3) {
            const A = cartes[0];
            const C = cartes.find(c => Math.abs(c.gauche - A.gauche) < 5 && c.haut > A.bas) || cartes[2];   // la carte sous A
            await page.locator('[data-comptes-cycle] [data-compte]').first().scrollIntoViewIfNeeded();
            const re = await page.evaluate(() => [...document.querySelectorAll('[data-comptes-cycle] [data-compte]')].map(b => {
                const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, bas: r.bottom };
            }));
            const iC = cartes.indexOf(C);
            await page.mouse.move(re[0].x, re[0].y);
            await page.waitForTimeout(120);
            await page.mouse.move(re[iC].x, re[iC].y, { steps: 10 });   // traverse la bulle de A, vers la carte C
            await page.waitForTimeout(150);
            const b3 = await page.evaluate((ST) => ({ n: document.querySelectorAll('[data-bulle]').length, cle: eval(ST).bulleOuverte }), ST);
            v('glisser d\'une carte vers celle du dessous n\'ouvre JAMAIS deux bulles',
              b3.n <= 1, JSON.stringify(b3));
            v('  → c\'est la bulle de la carte d\'origine qui capte la souris',
              b3.cle === 'compte:' + A.cle, JSON.stringify({ attendu: 'compte:' + A.cle, b3 }));
        } else {
            v('glisser d\'une carte vers celle du dessous (au moins 3 comptes requis)', false, JSON.stringify(cartes));
        }
        // Clic = épingler ; clic ailleurs = fermer
        await page.mouse.move(5, 5);
        await page.click('[data-kpi="atterrissage"]');
        await page.waitForTimeout(100);
        const epingle = await page.evaluate((ST) => ({ n: document.querySelectorAll('[data-bulle]').length, ep: eval(ST).bulleEpinglee }), ST);
        await page.mouse.click(5, 300);
        await page.waitForTimeout(100);
        const ferme = await page.evaluate(() => document.querySelectorAll('[data-bulle]').length);
        v('clic : la bulle s\'épingle ; clic ailleurs : elle se ferme',
          epingle.n === 1 && epingle.ep === true && ferme === 0, JSON.stringify({ epingle, ferme }));

        /* Hiérarchie : les trois chiffres, puis la file, puis le reste. */
        const y = await page.evaluate(() => {
            const top = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top + window.scrollY : null; };
            return { kpi: top('[data-cockpit-kpis]'), inbox: top('#pilotage-inbox'), comptes: top('[data-comptes-cycle]') };
        });
        v('les trois chiffres précèdent la file, qui précède les comptes',
          y.kpi !== null && y.kpi < y.inbox && y.inbox < y.comptes, JSON.stringify(y));
    } else {
        console.log('  ⏭️  bulles et mise en page non mesurées (feuille Tailwind indisponible)');
    }

    /* ── G. Les trois scénarios d'alerte ─────────────────────────────────── */
    const scenario = async (soldeCourant, soldeAnnexe) => page.evaluate(async ({ ST, soldeCourant, soldeAnnexe }) => {
        const st = eval(ST);
        st.comptes[0].solde = soldeCourant; st.comptes[1].solde = soldeAnnexe;
        st.forceUpdateCalculations();
        await new Promise(r => setTimeout(r, 120));
        const b = document.querySelector('[data-kpi="atterrissage"]');
        return { alerte: b.dataset.alerte, texte: b.innerText, vedette: st.kpiAtterrissage.vedette && st.kpiAtterrissage.vedette.key,
                 fond: getComputedStyle(b).backgroundColor };
    }, { ST, soldeCourant, soldeAnnexe });
    const sB = await scenario(10000, 500);
    v('courant positif mais autre compte à découvert : alerte quand même',
      sB.alerte === 'oui' && sB.vedette === 'cpt_2' && /Compte Annexe Test/.test(sB.texte) && /3\s?550/.test(txt(sB.texte)),
      JSON.stringify(sB));
    const sC = await scenario(10000, 10000);
    v('tout couvert : plus d\'alerte, « Atterrissage » en clair',
      sC.alerte === 'non' && /atterrissage/i.test(sC.texte) && !/découvert/i.test(sC.texte), JSON.stringify(sC));
    if (MISE_EN_PAGE) {
        const sA = await scenario(1000, 500);
        v('découvert : fond rouge vif (rouge dominant)',
          (() => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(sA.fond); return m && +m[1] > 180 && +m[2] < 80 && +m[3] < 80; })(),
          sA.fond);
    }

    /* ── H. Régularisation d'un cycle passé : lu ET écrit sur ce cycle ────── */
    const retro = await page.evaluate(async ({ ST, MOIS_BUDGET, AN_BUDGET }) => {
        const st = eval(ST);
        const mP = MOIS_BUDGET === 1 ? 12 : MOIS_BUDGET - 1, aP = MOIS_BUDGET === 1 ? AN_BUDGET - 1 : AN_BUDGET;
        if (!st.donneesAnnuelles[aP]) return { saute: true };
        st.pilotageViewedCycle = mP + '-' + aP;
        await new Promise(r => setTimeout(r, 300));
        const cle = aP + '-' + String(mP).padStart(2, '0');
        const cartes = [...document.querySelectorAll('[data-kpi]')].map(e => e.innerText);
        // Pointer un revenu dans « Entrées d'argent » : la case doit s'écrire sur le
        // cycle CONSULTÉ, pas sur le cycle en cours.
        const det = [...document.querySelectorAll('details')].find(d => /Entrées d'Argent/.test(d.textContent));
        if (det) det.open = true;
        await new Promise(r => setTimeout(r, 150));
        const rev = st.donneesAnnuelles[aP].revenus.attendu;
        const box = det ? [...det.querySelectorAll('input[type=checkbox]')].find(i => (i.closest('div') || {}).textContent?.includes('REVENU ATTENDU')) : null;
        if (box) box.click();
        await new Promise(r => setTimeout(r, 200));
        const ecrit = JSON.stringify(rev.trackerRealise || {});
        if (box) box.click();
        await new Promise(r => setTimeout(r, 150));
        st.pilotageViewedCycle = null;
        await new Promise(r => setTimeout(r, 200));
        return { saute: false, cle, cartes, ecrit, coche: !!box };
    }, { ST, MOIS_BUDGET, AN_BUDGET });
    if (retro.saute) {
        v('régularisation : cycle précédent hors du jeu de données', true);
    } else {
        v('cycle passé : « À régulariser » et « Solde de clôture » remplacent l\'urgence',
          retro.cartes.some(t => /À régulariser/i.test(t)) && retro.cartes.some(t => /Solde de clôture/i.test(t)),
          JSON.stringify(retro.cartes));
        v('  → une entrée pointée s\'écrit sur le cycle CONSULTÉ',
          retro.coche && retro.ecrit.includes('"' + retro.cle + '"') && !retro.ecrit.includes('"' + CYCLE + '"'),
          JSON.stringify(retro));
    }

    v('aucune erreur JavaScript (bureau)', erreurs.length === 0, erreurs[0] || '');
    await page.close();

    /* ── I. Au pouce, sur un écran de S24+ ───────────────────────────────── */
    if (MISE_EN_PAGE) {
        const m = await ouvrir({ viewport: { width: 384, height: 832 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        const mob = await m.page.evaluate(() => {
            const r = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
            const u = r('[data-kpi="urgence"]'), p = r('[data-kpi="progression"]'), a = r('[data-kpi="atterrissage"]');
            const bouton = r('[data-valider-echues]'), inbox = r('#pilotage-inbox');
            const lignes = [...document.querySelectorAll('#pilotage-inbox [data-tache]')].map(e => e.getBoundingClientRect());
            return {
                debord: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                empile: !!(u && p && a && u.bottom <= p.top + 1 && p.bottom <= a.top + 1),
                urgencePremier: !!(u && p && u.top < p.top),
                bouton: bouton && inbox ? { l: Math.round(bouton.width), inbox: Math.round(inbox.width), h: Math.round(bouton.height) } : null,
                lignesDansEcran: lignes.every(l => l.left >= 0 && l.right <= window.innerWidth + 0.5),
            };
        });
        v('S24+ : aucun défilement horizontal', mob.debord <= 0, JSON.stringify(mob));
        v('  → les trois cartes s\'empilent, Urgence en premier', mob.empile && mob.urgencePremier, JSON.stringify(mob));
        v('  → le bouton de validation tient le pouce (pleine largeur, ≥ 40 px)',
          !!mob.bouton && mob.bouton.l >= mob.bouton.inbox - 60 && mob.bouton.h >= 40, JSON.stringify(mob.bouton));
        v('  → chaque ligne de la file tient dans l\'écran', mob.lignesDansEcran, JSON.stringify(mob));
        await m.page.tap('[data-kpi="atterrissage"]');
        await m.page.waitForTimeout(200);
        const t1 = await m.page.evaluate(() => {
            const b = document.querySelector('[data-bulle]');
            if (!b) return { n: 0 };
            const r = b.firstElementChild.getBoundingClientRect();
            return { n: document.querySelectorAll('[data-bulle]').length, g: r.left, d: r.right, w: window.innerWidth };
        });
        v('  → un tap ouvre la bulle, entièrement dans l\'écran',
          t1.n === 1 && t1.g >= 0 && t1.d <= t1.w + 0.5, JSON.stringify(t1));
        await m.page.tap('[data-kpi="atterrissage"]');
        await m.page.waitForTimeout(200);
        v('  → un second tap la referme', await m.page.evaluate(() => document.querySelectorAll('[data-bulle]').length) === 0);
        v('aucune erreur JavaScript (mobile)', m.erreurs.length === 0, m.erreurs[0] || '');
        await m.page.close();
    }
} catch (e) {
    //  Toute exception devient un contrôle en échec, nommé — pas un plantage muet.
    if (e.message !== 'COCKPIT_ABSENT') { ko++; console.log('  ❌ exception : ' + e.message.split('\n')[0]); }
} finally {
    await browser.close();
    srv.close();
}

console.log('  ' + '─'.repeat(80));
console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
