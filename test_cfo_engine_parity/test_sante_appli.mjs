/**
 * Santé Master — L'APPLI DANS UN VRAI NAVIGATEUR, SUR LE VRAI PHP (php -S) : accueil, démo, 5 onglets, Gilbert,
 * indicateurs, import d'un bilan, repas et checklist, pesée et projection, CSV Samsung, import du dossier,
 * enregistrement réel (fichier), conflit entre deux onglets (409), API du Médecin-Chef IA, webhook Samsung (jeton).
 * Décor FICTIF.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const ICI = path.dirname(fileURLToPath(import.meta.url)), RACINE = path.resolve(ICI, '..');
const require = createRequire(import.meta.url);
let ko = 0, n = 0;
const v = (t, ok, d = '') => { n++; if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(78)} ${ok ? '' : (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400)}`); };
const section = async (nom, f) => { try { await f(); } catch (e) { v(`${nom} : exécution sans exception`, false, String(e && e.stack || e).slice(0, 300)); } };
console.log('\n  SANTÉ MASTER — L\'APPLI, LE STOCKAGE, L\'API, LE WEBHOOK\n  ' + '─'.repeat(80));
const essai = (f) => { try { return f(); } catch { return null; } };
const pw = essai(() => require('playwright-core')), vueJs = essai(() => require.resolve('vue/dist/vue.global.js'));
const chartJs = path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js');
const chromium = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
if (!pw || !vueJs || !fs.existsSync(chartJs) || !fs.existsSync(chromium)) { console.log('  ⏭️  ignoré (playwright-core, vue, chart.js ou Chromium absent)'); process.exit(0); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sante-')), DATA = path.join(tmp, 'sante_data.json'), JETON = 'jeton-de-test-' + Math.random().toString(16).slice(2);
const port = 22000 + Math.floor(Math.random() * 3000);
const php = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', RACINE], { env: { ...process.env, SANTE_DATA_FILE: DATA, SANTE_SAMSUNG_TOKEN: JETON }, stdio: 'ignore' });
const U = `http://127.0.0.1:${port}/sante/`;
for (let i = 0; i < 50; i++) { try { await fetch(U + 'biomarqueurs.json'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const erreurs = [];
const ouvrir = async () => {
    const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } });
    page.on('pageerror', e => erreurs.push(String(e)));
    await page.route('https://unpkg.com/**', r => r.fulfill({ body: fs.readFileSync(vueJs), contentType: 'text/javascript' }));
    await page.route('https://cdn.jsdelivr.net/npm/chart.js', r => r.fulfill({ body: fs.readFileSync(chartJs), contentType: 'text/javascript' }));
    await page.route('https://cdn.tailwindcss.com/**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
    await page.route('**/webhook/**', r => r.abort());
    await page.goto(U, { waitUntil: 'load' });
    await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && !document.querySelector('[data-statut-sauvegarde]').textContent.includes('chargement'); }, null, { timeout: 20000 });
    return page;
};
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
const lireFichier = () => JSON.parse(fs.readFileSync(DATA, 'utf8'));
const attendreEnregistre = (page) => page.waitForFunction(() => /enregistré/.test(document.querySelector('[data-statut-sauvegarde]').textContent), null, { timeout: 10000 });

try {
    const page = await ouvrir();
    await section('A', async () => {
        v('A. premier lancement : accueil « Importer mon dossier » / « Charger la démo », avertissement médical', await page.isVisible('[data-accueil]') && await page.isVisible('[data-avertissement]'));
        await page.click('[data-charger-demo]'); await page.waitForTimeout(300); await attendreEnregistre(page);
        const f = lireFichier();
        v('  → démo chargée et ENREGISTRÉE par save_sante.php (fichier), profil fictif', f.bilans.length === 2 && /TESTEUR/.test(f.profil.nom) && !(await page.isVisible('[data-accueil]')), f.profil);
        const onglets = await page.$$eval('[data-onglet]', l => l.map(x => x.textContent.trim()));
        v('  → les 5 onglets', onglets.length === 5 && /Pilotage/.test(onglets[0]) && /Analyses/.test(onglets[1]) && /Nutrition/.test(onglets[2]) && /Samsung/.test(onglets[3]) && /Médecin-Chef/.test(onglets[4]), onglets);
    });
    await section('B', async () => {
        await page.click('[data-onglet="analyses"]'); await page.waitForTimeout(300);
        v('B. Analyses : badge « 🧬 Profil Gilbert » (bilirubine haute, ASAT/ALAT/GGT normales), pas d\'alerte rouge', /Profil Gilbert/.test(await page.textContent('[data-badge-gilbert]')) && !(await page.$('[data-alerte-bilirubine]')));
        v('  → indicateurs calculés : TG/HDL 4,76 ; HOMA-IR 3,14 ; TyG affiché', (await page.textContent('[data-ind-tg-hdl]')).trim() === '4.76' && (await page.textContent('[data-ind-homa]')).trim() === '3.14' && /^\d/.test((await page.textContent('[data-ind-tyg]')).trim()));
        v('  → SCORE2 : 3,2 % « élevé » (46 ans : seuils 2,5 / 7,5)', /3\.2 %/.test(await page.textContent('[data-score2]')) && /élevé/.test(await page.textContent('[data-score2]')));
        v('  → triglycérides en rouge (au-dessus de la norme), cible « < 1.5 » affichée', /rose/.test(await page.getAttribute('[data-cellule="tg|2026-04-20"]', 'class')) && /< 1\.5/.test(await page.textContent('[data-marqueur="tg"]')));
        await page.click('[data-merlin]'); await page.click('[data-marqueur="tg"]'); await page.waitForTimeout(300);
        const ex = await page.textContent('[data-explication]');
        v('  → 🪄 Merlin sur les triglycérides : rôle, explication du « haut », leviers, impact du protocole', /Graisses circulantes/.test(ex) && /résistance à l'insuline/.test(ex) && /Séquençage/.test(ex) && /protocole actuel/.test(ex), ex.slice(0, 200));
        v('  → le graphique du biomarqueur est dessiné (Chart.js)', await page.evaluate(() => !!Chart.getChart(document.getElementById('graphMarqueur'))));
    });
    await section('C', async () => {
        await page.click('[data-ouvrir-import]');
        await page.fill('[data-import-texte]', 'Bilan du 01/10/2026\nTriglycérides 1.62 g/L < 1.50\nHDL 0.44 g/L > 0.40\nVitamine D 33 ng/mL > 30\nGlycémie 0.95 g/L 0.70 - 1.10');
        await page.click('[data-analyser-bilan]'); await page.waitForTimeout(200);
        v('C. import d\'un bilan collé : date lue (01/10/2026), 4 biomarqueurs reconnus', (await page.inputValue('[data-apercu-date]')) === '2026-10-01' && /4 biomarqueur/.test(await page.textContent('[data-apercu-compte]')));
        await page.click('[data-ajouter-bilan]'); await page.waitForTimeout(300); await attendreEnregistre(page);
        const f = lireFichier();
        v('  → ajouté et enregistré ; il devient le dernier bilan (TG/HDL recalculé : 3,68)', f.bilans.length === 3 && f.bilans[2].date === '2026-10-01' && (await page.textContent('[data-ind-tg-hdl]')).trim() === '3.68');
    });
    await section('D', async () => {
        await page.evaluate((ST) => { eval(ST).dateJour = '2026-11-03'; }, ST);
        await page.click('[data-onglet="nutrition"]');
        await page.selectOption('[data-repas-moment]', 'dejeuner'); await page.check('[data-repas-marche]');
        await page.fill('[data-repas-texte]', "salade 150, poulet 120, pain d'orge 60"); await page.waitForTimeout(200);
        v('D. repas « salade → poulet → pain d\'orge » + marche : score 100, 359 kcal (table des aliments)', /100\/100/.test(await page.textContent('[data-repas-score]')) && /359 kcal/.test(await page.textContent('[data-repas-score]')));
        await page.click('[data-repas-ajouter]'); await page.waitForTimeout(200);
        await page.fill('[data-repas-texte]', 'mie de pain 60, biscuits 30, poulet 100'); await page.waitForTimeout(200);
        v('  → « mie de pain → biscuits → poulet », sans marche : 10/100 (malus raffiné, glucides en premier)', /10\/100/.test(await page.textContent('[data-repas-score]')));
        await page.click('[data-onglet="pilotage"]'); await page.waitForTimeout(200);
        v('  → la checklist coche « déjeuner séquencé » et « marche après le déjeuner »', await page.isChecked('[data-check="dej_seq"] input') && await page.isChecked('[data-check="dej_marche"] input'));
        await page.fill('[data-saisie-zone2]', '42'); await page.press('[data-saisie-zone2]', 'Tab'); await page.check('[data-saisie-machines]'); await page.waitForTimeout(200);
        await page.waitForFunction(() => document.querySelector('[data-check="zone2"] input').checked, null, { timeout: 3000 }).catch(() => {});
        const z = [await page.isChecked('[data-check="zone2"] input'), await page.textContent('[data-machines-semaine]')];
        v('  → Zone 2 à 42 min coche la case ; 1 séance machines cette semaine', z[0] && /1\/2 séances/.test(z[1]), z);
        v('  → bilan énergétique : 359 kcal ingérées, métabolisme de base calculé (taille + pesée)', /359 kcal/.test(await page.textContent('[data-kcal-ingerees]')) && !/—/.test(await page.textContent('[data-bilan-net]')));
    });
    await section('E', async () => {
        await page.click('[data-onglet="poids"]'); await page.fill('[data-pesee]', '97.2'); await page.click('[data-ajouter-pesee]'); await page.waitForTimeout(300);
        v('E. pesée 97,2 kg ajoutée ; projection vers 85 kg avec une date', (await page.textContent('[data-poids-actuel]')).includes('97.2') && /\d{4}/.test(await page.textContent('[data-projection]')));
        v('  → la courbe de poids est dessinée', await page.evaluate(() => !!Chart.getChart(document.getElementById('graphPoids'))));
        const csv = path.join(tmp, 'samsung.csv'); fs.writeFileSync(csv, 'date,step_count,active_calorie,weight\n2026-11-01,10450,612,97.4\n2026-11-02,8200,480,\n');
        await page.setInputFiles('[data-import-csv]', csv); await page.waitForTimeout(400); await attendreEnregistre(page);
        const f = lireFichier();
        v('  → CSV Samsung Health : 2 jours importés (pas, kcal actives), la pesée du 01/11 rejoint la courbe', /2 jour/.test(await page.textContent('[data-message-csv]')) && f.journal['2026-11-01'].samsung.pas === 10450 && f.poids.some(p => p.date === '2026-11-01' && p.source === 'samsung'));
    });
    await section('F', async () => {
        const autre = await ouvrir();
        await autre.evaluate((ST) => { eval(ST).etat.objectifs.poids_kg = 88; }, ST); await attendreEnregistre(autre);
        await page.evaluate((ST) => { eval(ST).etat.objectifs.poids_kg = 80; }, ST);
        await page.waitForFunction(() => /modifié ailleurs/.test(document.querySelector('[data-statut-sauvegarde]').textContent), null, { timeout: 8000 });
        v('F. deux onglets : le second enregistre, le premier (périmé) est REFUSÉ (409) au lieu d\'écraser', lireFichier().objectifs.poids_kg === 88);
        await autre.close();
    });
    await section('G', async () => {
        const L = await (await fetch(U + 'sante_api.php?lecture=1&date=2026-11-03')).json();
        v('G. API du CMO, lecture : dernier bilan avec statuts et indicateurs, règle « tu lis, tu ne calcules pas »', L.dernier_bilan.date === '2026-10-01' && L.dernier_bilan.valeurs['Triglycérides'].statut === 'haut' && /ne calcules pas/.test(L.regle), L.dernier_bilan);
        const appel = (calls, mode) => fetch(U + 'sante_api.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ calls, mode }) }).then(r => r.json());
        const avant = lireFichier().supplements.length;
        const sim = await appel([{ function: 'update_supplement_protocol', args: { action: 'add', nom: 'Inositol', dose: '2 g' } }], 'simulate');
        v('  → simulate : compte rendu, RIEN d\'écrit', sim.status === 'ok' && sim.enregistre === false && lireFichier().supplements.length === avant);
        const com = await appel([{ function: 'update_supplement_protocol', args: { action: 'add', nom: 'Inositol', dose: '2 g' } }], 'commit');
        v('  → commit : écrit', com.status === 'ok' && com.enregistre === true && lireFichier().supplements.some(s => s.nom === 'Inositol'));
        const hors = await appel([{ function: 'prescrire', args: {} }], 'commit');
        v('  → hors catalogue : refusé', hors.status === 'error' && hors.journal[0].erreur === 'ERROR_OUT_OF_CATALOG');
    });
    await section('H', async () => {
        const post = (corps, jeton) => fetch(U + 'sync_samsung.php', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(jeton ? { 'X-Sante-Token': jeton } : {}) }, body: JSON.stringify(corps) });
        const r1 = await post({ date: '2026-11-03', steps: 11000 }, null), r2 = await post({ date: '2026-11-03', steps: 11000 }, 'mauvais');
        v('H. webhook Samsung sans jeton ou avec un mauvais jeton : 403, rien d\'écrit', r1.status === 403 && r2.status === 403 && !(lireFichier().journal['2026-11-03'] || {}).samsung?.pas);
        const r3 = await post([{ date: '2026-11-03', steps: 11000, active_calories: 640, resting_heart_rate: 60, sleep_minutes: 412, weight: 97.0 }, { date: '2026-11-02', steps: 8300 }], JETON);
        const j3 = await r3.json(), f = lireFichier();
        v('  → bon jeton, 2 jours au format Health Connect : pas, kcal, FC repos, sommeil, poids écrits', r3.status === 200 && j3.jours === 2 && f.journal['2026-11-03'].samsung.pas === 11000 && f.journal['2026-11-03'].samsung.sommeil_min === 412 && f.poids.some(p => p.date === '2026-11-03' && p.kg === 97), j3);
        const r4 = await post({ date: '2026-11-03', resting_heart_rate: 400 }, JETON);
        v('  → valeur hors bornes (FC 400) : 422, rien d\'écrit', r4.status === 422 && lireFichier().journal['2026-11-03'].samsung.fc_repos === 60);
    });
    await section('I', async () => {
        fs.rmSync(DATA, { force: true });
        const p2 = await ouvrir();
        const dossier = path.join(tmp, 'dossier_fictif.json');
        fs.writeFileSync(dossier, JSON.stringify({ profil: { nom: 'PERSONNE FICTIVE', sexe: 'H', naissance: '1975-02-02' }, objectifs: { poids_kg: 80 }, bilans: [{ date: '2026-01-10', valeurs: { tg: { v: 1.2 } } }], poids: [], journal: {}, supplements: [], protocole: [] }));
        await p2.setInputFiles('[data-import-dossier]', dossier); await p2.waitForTimeout(300); await attendreEnregistre(p2);
        v('I. « Importer mon dossier » (.json) : profil et bilans chargés et enregistrés', /1 bilan/.test(await p2.textContent('[data-message-import]')) && lireFichier().profil.nom === 'PERSONNE FICTIVE');
        await p2.close();
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close(); php.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(ko === 0 ? `\n  ✅ TOUT PASSE — ${n} contrôles` : `\n  ❌ ${ko} contrôle(s) en échec sur ${n}`);
process.exit(ko === 0 ? 0 : 1);
