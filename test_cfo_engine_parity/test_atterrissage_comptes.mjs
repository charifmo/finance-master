/**
 * v37.33 — LA MÉTÉO MONTRE TOUJOURS OÙ FINIT CHAQUE COMPTE.
 *
 *   « J'ai dû demander à l'agent IA où finissait mon compte principal (Assafa,
 *   + 649 DH) : comme il n'était pas à découvert, la Météo le cachait. » Sous le
 *   verdict, une liste compacte : un compte opérationnel par ligne, son
 *   monogramme, son nom court, son atterrissage — vert si ≥ 0, rouge si < 0.
 *   Le bloc rouge « Découvert projeté » (v37.32) ne bouge pas d'un octet.
 *
 *   Les montants attendus sont calculés À LA MAIN depuis le décor ci-dessous,
 *   pas relus dans l'application.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8').split('\r\n').join('\n');

let ko = 0;
const v = (t, ok, d = '') => { if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(64)} ${ok ? '' : d}`); };
console.log('\n  LA MÉTÉO MONTRE OÙ FINIT CHAQUE COMPTE\n  ' + '─'.repeat(80));

/* ── A. Statique : la liste existe, le bloc rouge est intact ─────────────── */
const tranche = (a, b) => { const i = html.indexOf(a); const j = i < 0 ? -1 : html.indexOf(b, i); return j < 0 ? '' : html.slice(i, j + b.length); };
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
//  Empreintes relevées sur v37.32 : le gabarit du bloc rouge et le calcul `decouverts`
v('le gabarit du bloc rouge « Découvert projeté » : identique à v37.32, octet pour octet',
  sha(tranche('<div v-if="meteo.decouverts && meteo.decouverts.length && !meteo.retro" data-meteo-decouvert', '\n    </div>\n    <div class="relative grid')) === '240942908e7c64e4');
v('  → son calcul (decouverts : montant, compte donneur, date limite) aussi',
  sha(tranche('const decouverts = (() => {', '})();')) === '27276b8d2ceab6af');
v('la liste des atterrissages ne dépend ni d\'un découvert ni des pastilles',
  /<div v-if="meteo\.atterrissages && meteo\.atterrissages\.length" data-meteo-atterrissages/.test(html)
  && !/🏁 Atterrissage le \{\{ meteo\.dateFin \}\} : \{\{ formatMad\(meteo\.atterrissage\) \}\}/.test(html));

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
//  Tailwind reconstruit : sans lui, ni colonnes ni couleurs — la disposition ne se vérifie pas
const twBin = path.join(RACINE, 'node_modules/.bin/tailwindcss');
const twCss = essai(() => {
    if (!fs.existsSync(twBin)) return null;
    const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'twatt-'));
    fs.writeFileSync(path.join(tmp, 'in.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
    fs.writeFileSync(path.join(tmp, 'cfg.js'), 'module.exports={content:[' + JSON.stringify(path.join(RACINE, 'index.html')) + '],theme:{extend:{}}};');
    execFileSync(twBin, ['-c', path.join(tmp, 'cfg.js'), '-i', path.join(tmp, 'in.css'), '-o', path.join(tmp, 'out.css'), '--minify'], { stdio: 'ignore' });
    const css = fs.readFileSync(path.join(tmp, 'out.css'), 'utf8');
    return css.length > 10000 ? css : null;
});

/* ── B. Le décor (mercredi 14 oct. 2026, paie le 8, cycle du 8 oct. au 7 nov.) ──
   Aucune conso, aucun revenu : chaque atterrissage se calcule de tête.
     Assafa  (épargne) : 6 649, paie le LOYER 6 000 (compte des charges fixes)  → + 649
     Courant (courant) :    95, verse 2 000 au Livret et 1 000 à la poche Voyage → − 2 905
     Livret  (épargne) : 50 000, ne fait que RECEVOIR (+ 2 000 + 500)            → 52 500, absent
     Bourse  (invest.) : 10 000, verse 500 au Livret                              → 9 500, absent (non liquide)
     Coffre  (épargne) :    400, aucun mouvement                                  → absent
     Voyage  (poche virtuelle ep_)                                                → absent
   Les comptes sont rangés Assafa d'abord : le courant doit tout de même ouvrir la liste. */
const JDP = 8;
const SC = { maintenant: new Date(2026, 9, 14, 10, 0, 0), mois: 11, an: 2026 };
const fixture = (sc) => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = {};
    for (const an of [sc.an - 1, sc.an, sc.an + 1]) fx.donneesAnnuelles[an] = JSON.parse(JSON.stringify(base));
    Object.assign(fx.soldesInitiaux, { moisActuel: sc.mois, anneeActuelle: sc.an, jourDePaie: JDP,
        compteChargesFixes: 'cpt_2', compteChargesVariables: 'courant', assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.comptes = [
        { id: 2, label: 'Compte Assafa', type: 'epargne', solde: 6649, icone: '🏛️' },
        { id: 1, label: 'Compte Courant', type: 'courant', solde: 95, icone: '💳' },
        { id: 3, label: 'Livret Réserve', type: 'epargne', solde: 50000, icone: '🏦' },
        { id: 4, label: 'Bourse / CTO', type: 'investissement', solde: 10000, icone: '📈' },
        { id: 5, label: 'Coffre', type: 'epargne', solde: 400, icone: '🗝️' },
    ];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    for (const an of Object.keys(fx.donneesAnnuelles)) {
        const d = fx.donneesAnnuelles[an];
        const Rv = (label, b, j) => ({ ...neutre, label, base: b, jourPrevu: j, destinationCompte: 'courant' });
        d.revenus = { salaire: Rv('SALAIRE', 0, JDP), bonif: Rv('—', 0), magasin: Rv('—', 0), cnss: Rv('—', 0), appart: Rv('—', 0), studio: Rv('—', 0) };
        const Fx = (label, valeur, j) => ({ ...neutre, label, valeur, jourPrevu: j });
        d.chargesFixes = { creditImmo: Fx('LOYER', 6000, 20), creditStudio: Fx('—', 0), syndic: Fx('—', 0), nounou: Fx('—', 0), ecole: Fx('—', 0),
                           femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
        const V = (label, valeur, periode) => ({ ...neutre, label, valeur, periode, details: [], showDetails: false });
        d.chargesVariables = {
            alimentation: V('COURSES', 0, 'semaine'), sorties: V('SORTIES', 0, 'semaine'), voiture: V('—', 0, 'semaine'), sante: V('—', 0, 'semaine'),
            factures: { ...V('FACTURES', 0, 'mois'), categorieId: 'cat_cv_factures' },
        };
        d.epargne = [
            { ...neutre, id: 21, nom: 'Réserve', valeur: 2000, sourceCompte: 'courant', linkedAccountId: 'cpt_3', jourPrevu: 20 },
            { ...neutre, id: 22, nom: 'Voyage', valeur: 1000, sourceCompte: 'courant', jourPrevu: 25 },
            { ...neutre, id: 23, nom: 'DCA', valeur: 500, sourceCompte: 'cpt_4', linkedAccountId: 'cpt_3', jourPrevu: 22 },
        ];
        d.depensesIrregulieres = []; d.virementsInternes = []; d.transactionsReelles = []; d.consoRealiseeT0 = {};
    }
    return fx;
};
let fxCourant = null;
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
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fxCourant));
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
const ouvrir = async (sc, opts = { viewport: { width: 1400, height: 1100 } }) => {
    fxCourant = fixture(sc);
    const page = await browser.newPage(opts);
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
const nf = (n) => new Intl.NumberFormat('fr-FR').format(n).replace(/\s/g, '');
//  « − 2 905 DH » / « + 649 DH » / « 0 DH », espaces retirés
const attendu = (x) => (x < 0 ? '−' : (x > 0 ? '+' : '')) + nf(Math.abs(x)) + 'DH';

//  Ce que montre la Météo : la liste (DOM), le bloc rouge (DOM), et le moteur du Relevé
const lire = (page) => page.evaluate((ST) => {
    const st = eval(ST), m = document.querySelector('[data-meteo]');
    const boite = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { haut: r.top, bas: r.bottom, gauche: r.left, droite: r.right, h: r.height }; };
    const liste = m.querySelector('[data-meteo-atterrissages]');
    const bloc = m.querySelector('[data-meteo-decouvert]');
    return {
        liste: liste ? [...liste.querySelectorAll('[data-meteo-atterrissage]')].map(l => {
            const mt = l.querySelector('[data-meteo-atterrissage-montant]');
            return { cle: l.dataset.compte, signe: l.dataset.signe, nom: l.querySelector('[data-meteo-atterrissage-nom]')?.textContent.trim(),
                     mono: l.querySelector('[data-mono-compte]')?.textContent.trim(), montant: mt?.textContent.replace(/\s/g, ''),
                     rouge: /\btext-rose-300\b/.test(mt?.className || ''), vert: /\btext-emerald-300\b/.test(mt?.className || ''),
                     couleur: mt ? getComputedStyle(mt).color : null, h: l.getBoundingClientRect().height };
        }) : null,
        date: liste?.querySelector('[data-meteo-atterrissages-date]')?.textContent.trim(),
        bloc: bloc ? [...bloc.querySelectorAll('[data-meteo-decouvert-compte]')].map(l => ({ cle: l.dataset.compte, montant: l.querySelector('[data-meteo-decouvert-montant]')?.textContent.replace(/\s/g, ''),
                     sauvetage: l.querySelector('[data-meteo-sauvetage]')?.textContent.replace(/\s+/g, ' ').trim() })) : [],
        moteur: Object.fromEntries(st.atterrissageCycle.comptes.map(c => [c.key, c.atterrissage])),
        etat: st.meteoFinanciere.etat, dateFin: st.meteoFinanciere.dateFin,
        pos: { meteo: boite(m), bloc: boite(bloc), titre: boite(m.querySelector('[data-meteo-titre]')), liste: boite(liste), carte: boite(m.querySelector('[data-liberte]')) },
        debord: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
}, ST);
const solde = (page, k, x) => page.evaluate(async ({ ST, k, x }) => { const st = eval(ST); st.comptes.find(c => c.id === k).solde = x; st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 300)); }, { ST, k, x });
const cles = (l) => (l || []).map(x => x.cle).join(',');

try {
    /* ══ C. LE CAS RAPPORTÉ : Courant dans le rouge, Assafa dans le vert ══ */
    const { page, erreurs } = await ouvrir(SC);
    let e = await lire(page);
    v('C. le moteur du Relevé atterrit où le calcul à la main l\'attend (Courant, Assafa, Livret, Bourse, Coffre)',
      e.moteur.cpt_1 === -2905 && e.moteur.cpt_2 === 649 && e.moteur.cpt_3 === 52500 && e.moteur.cpt_4 === 9500 && e.moteur.cpt_5 === 400, JSON.stringify(e.moteur));
    v('  → la liste : Courant puis Assafa — le courant d\'abord, même rangé second', cles(e.liste) === 'cpt_1,cpt_2', JSON.stringify(e.liste));
    const [co, as] = e.liste || [{}, {}];
    v('  → « CO Courant − 2 905 DH », en rouge', co.nom === 'Courant' && co.mono === 'CO' && co.montant === attendu(-2905) && co.signe === 'negatif' && co.rouge && !co.vert, JSON.stringify(co));
    v('  → « AS Assafa + 649 DH », en vert — visible bien qu\'il ne soit pas à découvert',
      as.nom === 'Assafa' && as.mono === 'AS' && as.montant === attendu(649) && as.signe === 'positif' && as.vert && !as.rouge && as.h > 0, JSON.stringify(as));
    v('  → absents : le Livret (ne fait que recevoir), la Bourse (non liquide), le Coffre (immobile), la poche Voyage',
      !/cpt_3|cpt_4|cpt_5|ep_/.test(cles(e.liste)), cles(e.liste));
    v(`  → l'en-tête donne la date de fin de cycle (« le ${e.dateFin} »)`, e.date === 'le ' + e.dateFin && /^\d+ \S+$/.test(e.dateFin || ''), String(e.date));
    v('  → le bloc rouge, inchangé : Courant seul, − 2 905 DH, virement depuis le Livret',
      e.etat === 'orage' && cles(e.bloc) === 'cpt_1' && e.bloc[0].montant === '−' + nf(2905) + 'DH' && /^➜ Virer 2\s?905 DH depuis .*Livret Réserve avant le /.test(e.bloc[0].sauvetage), JSON.stringify(e.bloc));
    if (twCss) {
        v('  → disposition : bloc rouge en tête, puis le verdict, puis la liste — dans la colonne de gauche',
          e.pos.bloc.bas <= e.pos.titre.haut && e.pos.titre.bas <= e.pos.liste.haut && e.pos.liste.droite <= e.pos.carte.gauche && e.pos.liste.haut < e.pos.carte.bas, JSON.stringify(e.pos));
        //  rose-300 = rgb(253, 164, 175) ; emerald-300 = rgb(110, 231, 183)
        v('  → couleurs réellement rendues : rouge rosé pour Courant, vert pour Assafa', co.couleur === 'rgb(253, 164, 175)' && as.couleur === 'rgb(110, 231, 183)', JSON.stringify([co.couleur, as.couleur]));
    } else console.log('  ⏭️  disposition et couleurs non vérifiées (Tailwind absent)');

    /* ══ D. CIEL SANS DÉCOUVERT : la liste reste ══════════════════════ */
    await solde(page, 1, 5000);                 // Courant : 5 000 − 3 000 = + 2 000
    e = await lire(page);
    v('D. aucun découvert : plus de bloc rouge, et la liste est toujours là', e.bloc.length === 0 && e.etat !== 'orage' && cles(e.liste) === 'cpt_1,cpt_2', JSON.stringify([e.etat, e.bloc, cles(e.liste)]));
    v('  → « Courant + 2 000 DH » et « Assafa + 649 DH », en vert', e.liste[0].montant === attendu(2000) && e.liste[1].montant === attendu(649) && e.liste.every(l => l.vert && l.signe === 'positif'), JSON.stringify(e.liste));

    /* ══ E. ASSAFA DANS LE ROUGE : l'ordre ne bouge pas ════════════════ */
    await solde(page, 2, 5000);                 // Assafa : 5 000 − 6 000 = − 1 000
    e = await lire(page);
    v('E. Assafa à − 1 000 : la liste garde son ordre (Courant, Assafa), Assafa passe au rouge',
      cles(e.liste) === 'cpt_1,cpt_2' && e.liste[1].montant === attendu(-1000) && e.liste[1].rouge && e.liste[0].vert, JSON.stringify(e.liste));
    v('  → le bloc rouge nomme Assafa, − 1 000 DH, avec son virement', cles(e.bloc) === 'cpt_2' && e.bloc[0].montant === '−' + nf(1000) + 'DH' && /^➜ Virer /.test(e.bloc[0].sauvetage), JSON.stringify(e.bloc));

    /* ══ F. UN COMPTE NON LIQUIDE DANS LE ROUGE : il entre dans la liste ══ */
    await solde(page, 2, 6649); await solde(page, 4, 100);     // Bourse : 100 − 500 = − 400
    e = await lire(page);
    v('F. la Bourse finit à − 400 : elle rejoint la liste (le bloc rouge la nomme, la liste aussi)',
      cles(e.liste) === 'cpt_1,cpt_2,cpt_4' && e.liste[2].montant === attendu(-400) && e.liste[2].rouge && cles(e.bloc) === 'cpt_4', JSON.stringify([e.liste, e.bloc]));
    v('  → tout compte du bloc rouge figure dans la liste, au même montant',
      e.bloc.every(b => (e.liste.find(l => l.cle === b.cle) || {}).montant === b.montant), JSON.stringify([e.liste, e.bloc]));

    /* ══ G. PILE À ZÉRO : ni signe, vert ═══════════════════════════════ */
    await solde(page, 4, 10000); await solde(page, 2, 6000);   // Assafa : 6 000 − 6 000 = 0
    e = await lire(page);
    v('G. Assafa atterrit pile à 0 : « 0 DH », sans signe, en vert', e.liste[1].montant === attendu(0) && e.liste[1].montant === '0DH' && e.liste[1].vert && e.liste[1].signe === 'positif', JSON.stringify(e.liste[1]));

    /* ══ H. LE LIVRET SE MET À PAYER : il devient opérationnel ═════════ */
    await solde(page, 2, 6649);
    await page.evaluate(async (ST) => { const st = eval(ST); const d = st.donneesAnnuelles[st.moisBudgetaire.an];
        d.depensesIrregulieres.push({ id: 601, mois: st.moisBudgetaire.mois, annee: st.moisBudgetaire.an, nom: 'Assurance auto', montant: 1200, sourceCompte: 'cpt_3', exceptions: [] });
        st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 300)); }, ST);
    e = await lire(page);
    v('H. le Livret paie l\'assurance (1 200) : il entre, à sa place (Courant, Assafa, Livret), à 51 300',
      cles(e.liste) === 'cpt_1,cpt_2,cpt_3' && e.liste[2].nom === 'Livret Réserve' && e.liste[2].montant === attendu(52500 - 1200), JSON.stringify(e.liste));

    /* ══ I. UN COURANT IMMOBILE : il reste en tête ══════════════════════ */
    await page.evaluate(async (ST) => { const st = eval(ST); const d = st.donneesAnnuelles[st.moisBudgetaire.an];
        d.depensesIrregulieres = []; d.epargne.filter(x => x.sourceCompte === 'courant').forEach(x => { x.valeur = 0; });
        st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 300)); }, ST);
    e = await lire(page);
    v('I. le courant ne paie plus rien ce cycle : il ouvre quand même la liste, à son solde (+ 5 000)',
      cles(e.liste) === 'cpt_1,cpt_2' && e.liste[0].montant === attendu(5000), JSON.stringify(e.liste));
    v('aucune erreur JavaScript (bureau)', erreurs.length === 0, erreurs[0] || '');
    await page.close();

    /* ══ J. TÉLÉPHONE : la liste entre le verdict et la carte, sans débordement ══ */
    const mo = await ouvrir(SC, { viewport: { width: 384, height: 832 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    e = await lire(mo.page);
    v('J. téléphone : Courant − 2 905, Assafa + 649', cles(e.liste) === 'cpt_1,cpt_2' && e.liste[0].montant === attendu(-2905) && e.liste[1].montant === attendu(649), JSON.stringify(e.liste));
    if (twCss) v('  → bloc rouge, verdict, liste, puis « Reste à dépenser » : dans cet ordre, de haut en bas',
      e.pos.bloc.bas <= e.pos.titre.haut && e.pos.titre.bas <= e.pos.liste.haut && e.pos.liste.bas <= e.pos.carte.haut && e.pos.liste.droite <= e.pos.meteo.droite, JSON.stringify(e.pos));
    v('  → pas de défilement horizontal ; aucune erreur JavaScript', e.debord <= 0 && mo.erreurs.length === 0, JSON.stringify([e.debord, mo.erreurs[0]]));
    await mo.page.close();
} catch (err) {
    v('exécution sans exception', false, String(err && err.stack || err).slice(0, 400));
} finally {
    await browser.close(); srv.close();
}
console.log('  ' + '─'.repeat(80));
console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
