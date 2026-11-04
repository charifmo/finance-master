/**
 * Santé Master — L'APPLI DANS UN VRAI NAVIGATEUR, SUR LE VRAI PHP (php -S) : accueil, démo, 5 onglets, Gilbert,
 * indicateurs, import d'un bilan, repas et checklist, pesée et projection, CSV Samsung, import du dossier,
 * enregistrement réel (fichier), conflit entre deux onglets (409), API du Médecin-Chef IA, webhook Samsung (jeton).
 * Décor FICTIF.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
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
        v('  → les 6 onglets (v1.4 : + Plans, après Nutrition)', onglets.length === 6 && /Pilotage/.test(onglets[0]) && /Analyses/.test(onglets[1]) && /Nutrition/.test(onglets[2]) && /Plans/.test(onglets[3]) && /Samsung/.test(onglets[4]) && /Médecin-Chef/.test(onglets[5]), onglets);
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
        // v1.4 — la course qui rendait le contrôle ci-dessus intermittent, rendue certaine : une sauvegarde (re-rendu)
        //   atterrit PENDANT la frappe, avant la sortie du champ. Avant : le champ revenait à vide, la saisie était perdue.
        await attendreEnregistre(page);
        await page.evaluate((ST) => { eval(ST).etat.objectifs.note_essai = 1; }, ST);
        await page.fill('[data-saisie-pas]', '4321');
        await page.waitForFunction(() => /modifié/.test(document.querySelector('[data-statut-sauvegarde]').textContent), null, { timeout: 3000 });
        await attendreEnregistre(page);
        const tape = await page.inputValue('[data-saisie-pas]');
        await page.press('[data-saisie-pas]', 'Tab');
        v('  → une sauvegarde qui tombe pendant la frappe n\'efface pas la saisie (pas : 4 321)', tape === '4321' && (await page.textContent('[data-pas]')).replace(/\D/g, '') === '4321', [tape, await page.textContent('[data-pas]')]);
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
    await section('J', async () => {
        //  « non enregistré » : le serveur refuse (dossier non inscriptible) — la page dit pourquoi et propose de réessayer
        const p3 = await ouvrir();
        let casse = true;
        await p3.route('**/save_sante.php', r => casse && r.request().method() === 'POST'
            ? r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, erreur: 'écriture impossible — base : indisponible ; fichier : PHP ne peut pas écrire dans /var/www/finance/sante' }) })
            : r.continue());
        await p3.evaluate((ST) => { eval(ST).etat.profil.nom = 'PERSONNE ESSAI ERREUR'; }, ST);
        await p3.waitForSelector('[data-erreur-sauvegarde]', { timeout: 8000 });
        const msg = await p3.textContent('[data-erreur-sauvegarde]'), statut = await p3.textContent('[data-statut-sauvegarde]');
        v('J. le serveur refuse l\u2019écriture : « non enregistré », la RAISON est écrite dans la page (le dossier concerné)', /non enregistré/.test(statut) && /PHP ne peut pas écrire dans \/var\/www\/finance\/sante/.test(msg) && /ne la fermez pas/.test(msg), [statut, msg]);
        casse = false;
        await p3.click('[data-reessayer]');
        await p3.waitForFunction(() => /enregistré/.test(document.querySelector('[data-statut-sauvegarde]').textContent) && !/non enregistré/.test(document.querySelector('[data-statut-sauvegarde]').textContent) && !document.querySelector('[data-erreur-sauvegarde]'), null, { timeout: 8000 });
        v('  → « ↻ Réessayer » une fois le serveur réparé : enregistré, le bandeau disparaît, rien n\u2019a été perdu', lireFichier().profil.nom === 'PERSONNE ESSAI ERREUR', lireFichier().profil);
        await p3.close();
    });
    await section('K', async () => {
        //  v1.4 — plusieurs fichiers d'un coup (texte, photo → OCR), date trouvée seule, chaque valeur liée à son document,
        //  modification et suppression ligne par ligne, document supprimé avec ses valeurs, grand ménage confirmé, plans.
        fs.rmSync(DATA, { force: true });
        const p4 = await ouvrir();
        await p4.click('[data-charger-demo]'); await p4.waitForTimeout(300); await attendreEnregistre(p4);
        await p4.evaluate(() => { window.Tesseract = { recognize: async () => ({ data: { text: 'LABO FICTIF\nPrélevé le 15/05/2026\nVitamine D 27.5 ng/mL > 30\nTSHus 1.400 µUI/mL 0.27 - 4.20' } }) }; });
        const fa = path.join(tmp, 'bilan_a.txt'), fb = path.join(tmp, 'bilan_b.txt'), fp = path.join(tmp, 'photo.jpg');
        fs.writeFileSync(fa, 'Dossier ouvert le : 15−05−2026\nMr TESTEUR Fictif\nNé le 02/02/1980\n Prélevé le : 15−05−2026 à 09:29   Réf dossier: 1234\nEdité le : 21−05−2026\nAntériorités du 20/02/2025\nHématies 5.06 T/L (4.28−6.00) 5.17\nTriglycérides 2.17 g/L < 1.50\nHémoglobine glyquée HbA1c 5.8 % 4.0 – 5.6\n');
        fs.writeFileSync(fb, 'Résultats du 12/09/2026\nHDL 0.44 g/L > 0.40\nTriglycérides 1.62 g/L < 1.50\n');
        fs.writeFileSync(fp, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
        await p4.click('[data-onglet="analyses"]'); await p4.click('[data-ouvrir-import]');
        await p4.setInputFiles('[data-import-fichier]', [fa, fb, fp]);
        await p4.waitForFunction(() => document.querySelectorAll('[data-apercu-bilan] [data-apercu-date]').length === 3, null, { timeout: 8000 });
        const ap = await p4.$$eval('[data-apercu-bilan]', l => l.map(x => [x.getAttribute('data-apercu-nom'), x.querySelector('[data-apercu-date]').value, x.querySelector('[data-apercu-compte]').textContent]));
        v('K. 3 fichiers d\'un coup (2 textes + 1 photo lue par OCR) : 3 aperçus', ap.length === 3 && ap.map(x => x[0]).join() === 'bilan_a.txt,bilan_b.txt,photo.jpg', ap);
        v('  → date trouvée seule : PRÉLÈVEMENT 15/05/2026 (tirets « − » du PDF ; ni naissance, ni antériorité 20/02/2025, ni édition)', ap[0][1] === '2026-05-15' && /Prélevé/.test(await p4.textContent('[data-apercu-bilan] [data-apercu-date-source]')), ap);
        v('  → « Résultats du 12/09/2026 » ; la photo : 15/05/2026', ap[1][1] === '2026-09-12' && ap[2][1] === '2026-05-15', ap);
        v('  → HbA1c lue 5,8 (pas le « 1 » de « A1c ») ; 3 + 2 + 2 biomarqueurs', /^3 /.test(ap[0][2]) && /^2 /.test(ap[1][2]) && /^2 /.test(ap[2][2]) && await p4.inputValue('[data-apercu-bilan] [data-apercu-valeur="hba1c"] input') === '5.8', ap);
        await p4.click('[data-ajouter-tous]'); await p4.waitForTimeout(200); await attendreEnregistre(p4);
        let f = lireFichier(), b15 = f.bilans.find(b => b.date === '2026-05-15');
        const docA = b15 && b15.documents.find(d => d.nom === 'bilan_a.txt'), docP = b15 && b15.documents.find(d => d.nom === 'photo.jpg');
        v('  → « Ajouter les 3 » : 2 bilans créés ; le 15/05 réunit 2 documents, chaque valeur garde le sien (enregistré)', f.bilans.length === 4 && docA && docP && b15.valeurs.tg.doc === docA.id && b15.valeurs.vitd.doc === docP.id && f.bilans.some(b => b.date === '2026-09-12' && b.documents.length === 1), b15);
        await p4.click('[data-systeme="cardio"]');
        v('  → le tableau dit d\'où vient chaque valeur (survol : « Source : bilan_a.txt »)', /bilan_a\.txt/.test(await p4.getAttribute('[data-cellule="tg|2026-05-15"]', 'title')));
        const doc = (nom) => `[data-bilan="2026-05-15"] [data-document="${nom}"]`;
        await p4.click(doc('photo.jpg') + ' [data-supprimer-document]');
        v('  → supprimer un document demande une confirmation (second clic)', /Confirmer/.test(await p4.textContent(doc('photo.jpg') + ' [data-supprimer-document]')) && lireFichier().bilans.find(b => b.date === '2026-05-15').valeurs.vitd);
        await p4.click(doc('photo.jpg') + ' [data-supprimer-document]'); await p4.waitForTimeout(100); await attendreEnregistre(p4);
        b15 = lireFichier().bilans.find(b => b.date === '2026-05-15');
        v('  → document supprimé : ses 2 valeurs partent, celles de bilan_a.txt restent', b15 && !b15.valeurs.vitd && !b15.valeurs.tsh && b15.valeurs.tg && b15.documents.length === 1, b15);
        await p4.click(doc('bilan_a.txt') + ' [data-voir-lignes]');
        await p4.fill(doc('bilan_a.txt') + ' [data-ligne="tg"] [data-saisie-valeur]', '2.05'); await p4.press(doc('bilan_a.txt') + ' [data-ligne="tg"] [data-saisie-valeur]', 'Tab');
        await p4.click(doc('bilan_a.txt') + ' [data-ligne="hba1c"] [data-supprimer-ligne]'); await p4.waitForTimeout(100); await attendreEnregistre(p4);
        b15 = lireFichier().bilans.find(b => b.date === '2026-05-15');
        v('  → une ligne modifiée (TG 2,17 → 2,05, marquée « corrigée », toujours liée au document) ; une ligne supprimée', b15.valeurs.tg.v === 2.05 && b15.valeurs.tg.edite === true && b15.valeurs.tg.doc === docA.id && !b15.valeurs.hba1c, b15.valeurs);
        await p4.click('[data-mode-edition]');
        await p4.fill('[data-cellule="hdl|2026-05-15"] [data-saisie-valeur]', '0.5'); await p4.press('[data-cellule="hdl|2026-05-15"] [data-saisie-valeur]', 'Tab'); await p4.waitForTimeout(100); await attendreEnregistre(p4);
        v('  → mode « Modifier les valeurs » : une case vide du tableau remplie devient une valeur', lireFichier().bilans.find(b => b.date === '2026-05-15').valeurs.hdl.v === 0.5);
        await p4.click('[data-mode-edition]');
        await p4.click('[data-ouvrir-nettoyage]');
        const bloque = await p4.isDisabled('[data-confirmer-nettoyage]');
        await p4.fill('[data-confirmation-nettoyage]', 'effacer');
        const libre = !(await p4.isDisabled('[data-confirmer-nettoyage]'));
        await p4.click('[data-confirmer-nettoyage]'); await p4.waitForTimeout(100); await attendreEnregistre(p4);
        f = lireFichier();
        v('  → « Tout effacer » : bloqué tant que EFFACER n\'est pas tapé ; puis toutes les analyses partent, le reste (profil) demeure', bloque && libre && f.bilans.length === 0 && /TESTEUR/.test(f.profil.nom), [bloque, libre, f.bilans.length]);

        //  les plans
        await p4.evaluate((ST) => { eval(ST).dateJour = '2026-11-02'; }, ST);      // un lundi
        await p4.click('[data-onglet="plans"]'); await p4.click('[data-ouvrir-plan="nutrition"]');
        await p4.fill('[data-texte-plan]', 'Plan nutritionnel — novembre\nTous les jours\nPetit-déjeuner : café noir + MCT\nLundi\nDéjeuner\n- salade, poulet 150 g, pain d\'orge\nDîner : soupe de légumes\nMardi\nDéjeuner : poisson 150 g');
        await p4.click('[data-lire-plan]');
        v('  → plan nutritionnel lu : 4 éléments rangés par jour et par repas, titre repris', (await p4.$$('[data-element-editeur]')).length === 4 && await p4.inputValue('[data-titre-plan]') === 'Plan nutritionnel - novembre');
        await p4.click('[data-enregistrer-plan]'); await p4.waitForTimeout(100);
        const prevus = await p4.$$eval('[data-plan="nutrition"] [data-element-plan]', l => l.map(x => x.textContent.trim()));
        v('  → lundi : 3 éléments prévus (petit-déjeuner de tous les jours + déjeuner + dîner du lundi), pas celui du mardi', prevus.length === 3 && !prevus.some(t => /poisson/.test(t)), prevus);
        await p4.check('[data-plan="nutrition"] [data-element-plan] input'); await p4.waitForTimeout(100); await attendreEnregistre(p4);
        f = lireFichier();
        const idPdj = f.plans.nutrition.items.find(i => /café/.test(i.texte)).id;
        v('  → cocher = RÉALISÉ, enregistré dans la journée ; semaine 1/3 · 33 %', f.journal['2026-11-02'].plan_fait[idPdj] === true && /1\/3/.test(await p4.textContent('[data-taux-plan="nutrition"]')) && /33 %/.test(await p4.textContent('[data-taux-plan="nutrition"]')), f.journal['2026-11-02']);
        const mammoth = essai(() => require.resolve('mammoth/mammoth.browser.min.js'));
        if (!mammoth) console.log('  ⏭️  plan Word (.docx) ignoré : mammoth absent (npm install --no-save mammoth@1.8.0)');
        else {
            await p4.route('https://cdn.jsdelivr.net/npm/mammoth@*/**', r => r.fulfill({ body: fs.readFileSync(mammoth), contentType: 'text/javascript' }));
            const docx = path.join(tmp, 'programme.docx');
            const para = ['Programme exercice', 'Lundi : Marche Zone 2 à jeun 45 min', 'Mercredi', 'Machines bas du corps 1 h', 'Soleus pushups 10 min'].map(t => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`).join('');
            execFileSync('python3', ['-c', `import zipfile,sys
z=zipfile.ZipFile(sys.argv[1],'w')
z.writestr('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
z.writestr('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
z.writestr('word/document.xml','<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+sys.argv[2]+'</w:body></w:document>')
z.close()`, docx, para]);
            await p4.click('[data-ouvrir-plan="exercice"]');
            await p4.setInputFiles('[data-import-plan]', docx);
            await p4.waitForFunction(() => document.querySelectorAll('[data-element-editeur]').length === 3, null, { timeout: 8000 }).catch(() => {});
            await p4.click('[data-enregistrer-plan]'); await p4.waitForTimeout(100); await attendreEnregistre(p4);
            const ex = lireFichier().plans.exercice;
            v('  → plan d\'exercice importé d\'un fichier Word (.docx) : 3 séances, durées lues (45 / 60 / 10 min)', ex && ex.source === 'programme.docx' && ex.items.map(i => i.duree_min).join() === '45,60,10' && ex.items[0].jour === 'lundi', ex);
            v('  → lundi : la marche Zone 2 est prévue, minutes de la semaine affichées', /Zone 2/.test(await p4.textContent('[data-plan="exercice"]')) && /0 réalisées sur 45 prévues/.test(await p4.textContent('[data-minutes-plan]')));
        }
        const lecture = await (await fetch(U + 'sante_api.php?lecture=1&date=2026-11-02')).json();
        v('  → le Médecin-Chef IA lit le plan du jour et le réalisé de la semaine', lecture.plans && lecture.plans.nutrition.suivi.semaine.faits === 1 && lecture.plans.nutrition.suivi.du_jour.length === 3, lecture.plans);
        //  CSV au format réel de Samsung Health : une ligne de description avant l'en-tête, day_time en millisecondes,
        //  téléphone + montre le même jour (on garde le maximum) ; et un second fichier, les pesées (start_time)
        const c1 = path.join(tmp, 'com.samsung.shealth.tracker.pedometer_day_summary.20261104.csv'), c2 = path.join(tmp, 'com.samsung.health.weight.20261104.csv');
        const ms = (d) => String(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)));
        fs.writeFileSync(c1, `com.samsung.shealth.tracker.pedometer_day_summary,6313005,3\nstep_count,calorie,day_time,deviceuuid\n6200,250.5,${ms('2026-10-20')},tel\n9100,380.2,${ms('2026-10-20')},montre\n7000,300,${ms('2026-10-21')},tel\n`);
        fs.writeFileSync(c2, 'com.samsung.health.weight,6312004,5\ncom.samsung.health.weight.start_time,com.samsung.health.weight.weight,com.samsung.health.weight.height\n2026-10-21 07:12:00.000,96.8,178\n');
        await p4.click('[data-onglet="poids"]');
        await p4.setInputFiles('[data-import-csv]', [c1, c2]); await p4.waitForTimeout(300); await attendreEnregistre(p4);
        f = lireFichier();
        v('  → CSV réels de Samsung Health (2 fichiers d\'un coup) : en-tête en 2ᵉ ligne lu, téléphone + montre → le maximum, pesée reprise', /2 jour\(s\) importé\(s\) depuis 2 fichiers/.test(await p4.textContent('[data-message-csv]'))
          && f.journal['2026-10-20'].samsung.pas === 9100 && f.journal['2026-10-21'].samsung.pas === 7000 && f.poids.some(p => p.date === '2026-10-21' && p.kg === 96.8 && p.source === 'samsung'), [await p4.textContent('[data-message-csv]'), f.journal['2026-10-20']]);
        await p4.click('[data-onglet="analyses"]'); await p4.click('[data-ouvrir-nettoyage]'); await p4.check('[data-portee="tout"]');
        await p4.fill('[data-confirmation-nettoyage]', 'EFFACER'); await p4.click('[data-confirmer-nettoyage]'); await p4.waitForTimeout(100); await attendreEnregistre(p4);
        f = lireFichier();
        v('  → « Toute l\'appli » : profil, plans, journal effacés, retour à l\'accueil', !f.profil.nom && !Object.keys(f.plans).length && f.bilans.length === 0 && f.poids.length === 0
          && Object.values(f.journal).every(j => !Object.values(j.checklist).some(Boolean) && !j.repas.length && !Object.keys(j.activite).length && !Object.keys(j.samsung).length && !j.plan_fait)   // (le jour affiché renaît vide, comme toujours)
          && await p4.isVisible('[data-accueil]'), { nom: f.profil.nom, plans: f.plans, journal: f.journal, accueil: await p4.isVisible('[data-accueil]') });
        await p4.close();
    });
    await section('L', async () => {
        //  v1.4 — la page blanche après une mise à jour : la nouvelle page tournait avec les anciens fichiers JS gardés en cache
        const html = fs.readFileSync(path.join(RACINE, 'sante/index.html'), 'utf8'), version = /const VERSION = '([^']+)'/.exec(html)[1];
        const srcs = [...html.matchAll(/<script src="(sante_[^"]+)"/g)].map(m => m[1]);
        v('L. chaque script local porte la version de la page (?v=' + version + ') : une mise à jour recharge toujours les bons fichiers', srcs.length === 3 && srcs.every(x => x.endsWith('?v=' + version)), srcs);
        const vieux = (f) => execFileSync('git', ['show', 'origin/main:sante/' + f], { cwd: RACINE, encoding: 'utf8' });
        const anciens = essai(() => ({ calculs: vieux('sante_calculs.js'), import: vieux('sante_import.js') }));
        if (!anciens || /suiviPlan/.test(anciens.calculs)) { console.log('  ⏭️  fichiers d\'avant la v1.4 introuvables (origin/main) : contrôle du cache périmé ignoré'); return; }
        const p5 = await browser.newPage();
        await p5.route('https://unpkg.com/**', r => r.fulfill({ body: fs.readFileSync(vueJs), contentType: 'text/javascript' }));
        await p5.route('https://cdn.jsdelivr.net/npm/chart.js', r => r.fulfill({ body: fs.readFileSync(chartJs), contentType: 'text/javascript' }));
        await p5.route('https://cdn.tailwindcss.com/**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
        //  le « cache » sert les vieux fichiers tant qu'on ne demande pas explicitement au serveur (cache: 'reload')
        let rafraichi = false;
        await p5.route('**/sante/sante_*.js*', r => { if (r.request().resourceType() === 'fetch') rafraichi = true;   // la demande explicite au serveur
            return rafraichi ? r.continue() : r.fulfill({ body: /calculs/.test(r.request().url()) ? anciens.calculs : anciens.import, contentType: 'text/javascript' }); });
        await p5.goto(U, { waitUntil: 'load' });
        await p5.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__; }, null, { timeout: 15000 }).catch(() => {});
        v('  → fichiers périmés détectés : rechargés depuis le serveur, la page redémarre seule (pas de page blanche)', rafraichi && await p5.isVisible('[data-onglet="plans"]'), { rafraichi });
        await p5.close();
    });
    await section('M', async () => {
        //  v1.5 — l'export Samsung Health TEL QUEL : le dossier samsunghealth_… compressé (.zip), choisi d'un seul geste
        const p6 = await ouvrir();
        const TC = '20261104123456', R = `samsunghealth_testeur_${TC}/`, d = (j) => { const x = new Date(Date.now() - j * 864e5); return x.toISOString().slice(0, 10); };
        const csv = (type, tete, lignes) => `﻿${type},6313005,${lignes.length}\n${tete.join(',')},\n` + lignes.map(l => l.join(',') + ',').join('\n') + '\n';
        const contenu = {
            [`${R}com.samsung.health.device_profile.${TC}.csv`]: csv('com.samsung.health.device_profile', ['deviceuuid', 'device_group'], [['TEL1', '360001'], ['COMB', '0']]),
            [`${R}com.samsung.shealth.tracker.pedometer_day_summary.${TC}.csv`]: csv('com.samsung.shealth.tracker.pedometer_day_summary', ['step_count', 'calorie', 'day_time', 'deviceuuid'],
                [['5000', '200', `${d(2)} 00:00:00.000`, 'TEL1'], ['8123', '320', `${d(2)} 00:00:00.000`, 'COMB'], ['4000', '150', `${d(500)} 00:00:00.000`, 'COMB']]),
            [`${R}com.samsung.health.weight.${TC}.csv`]: csv('com.samsung.health.weight', ['start_time', 'time_offset', 'weight'], [[`${d(2)} 07:00:00.000`, 'UTC+0000', '95.55'], [`${d(500)} 07:00:00.000`, 'UTC+0000', '101.2']]),
            [`${R}com.samsung.shealth.sleep.${TC}.csv`]: csv('com.samsung.shealth.sleep', ['com.samsung.health.sleep.start_time', 'com.samsung.health.sleep.end_time', 'com.samsung.health.sleep.time_offset', 'sleep_duration'], [[`${d(3)} 22:00:00.000`, `${d(2)} 05:00:00.000`, 'UTC+0000', '420']]),
            [`${R}com.samsung.shealth.exercise.${TC}.csv`]: csv('com.samsung.shealth.exercise', ['count'], [['99999']]),
            [`${R}files/com.samsung.shealth.food_image/repas.jpg`]: 'JPEG',
            [`${R}jsons/com.samsung.shealth.tracker.heart_rate/a/x.binning_data.json`]: '[]',
        };
        const src = path.join(tmp, 'export.json'), zip = path.join(tmp, `samsunghealth_testeur_${TC}.zip`);
        fs.writeFileSync(src, JSON.stringify(contenu));
        execFileSync('python3', ['-c', `import zipfile,json,sys
d=json.load(open(sys.argv[1],encoding='utf-8'))
z=zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED)
for k,t in d.items(): z.writestr(k,t)
z.close()`, src, zip]);
        await p6.click('[data-onglet="poids"]');
        await p6.setInputFiles('[data-import-csv]', zip);
        await p6.waitForFunction(() => /importé/.test(document.querySelector('[data-message-csv]')?.textContent || ''), null, { timeout: 8000 });
        await attendreEnregistre(p6);
        const f = lireFichier(), msg = await p6.textContent('[data-message-csv]');
        v('M. export Samsung Health en .zip, d\'un seul geste : pas de la ligne COMBINÉE (8 123), sommeil 420 min, pesée — enregistrés', f.journal[d(2)] && f.journal[d(2)].samsung.pas === 8123 && f.journal[d(2)].samsung.sommeil_min === 420 && f.poids.some(p => p.date === d(2) && p.kg === 95.6 && p.source === 'samsung'), [msg, f.journal[d(2)]]);
        v('  → plus d\'un an : pas dans le journal, mais la pesée rejoint la courbe ; exercice et photos ignorés', !f.journal[d(500)] && f.poids.some(p => p.date === d(500) && p.kg === 101.2) && !Object.values(f.journal).some(j => (j.samsung || {}).pas === 99999), msg);
        v('  → le message dit ce qui a été lu (jours de pas, nuits, pesées)', /jour\(s\) importé\(s\)/.test(msg) && /de pas/.test(msg) && /nuits/.test(msg) && /pesée/.test(msg), msg);
        await p6.close();
    });
    await section('N', async () => {
        //  v1.5 — la synchro automatique : HC Webhook (Health Connect) → sync_samsung.php, réglée depuis la page
        const sansAuth = await fetch(U + 'sante_jeton.php', { method: 'POST', body: '{"action":"creer"}' });
        v('N. le jeton de la synchro n\'est donné qu\'à une requête authentifiée (mot de passe du site) : sinon 403', sansAuth.status === 403);
        const p7 = await ouvrir();
        const basic = 'Basic ' + Buffer.from('testeur:secret-du-site').toString('base64');
        await p7.route('**/sante_jeton.php', r => r.continue({ headers: { ...r.request().headers(), authorization: basic } }));   // ce que fait Caddy
        await p7.click('[data-onglet="poids"]');
        await p7.click('[data-preparer-synchro]');
        await p7.waitForSelector('[data-config-synchro]', { timeout: 5000 });
        const url = await p7.inputValue('[data-url-webhook]');
        v('  → « Préparer ma synchro automatique » : l\'adresse du webhook ; l\'identifiant du site repris', /\/sante\/sync_samsung\.php$/.test(url) && await p7.inputValue('[data-config-synchro] input[autocomplete="username"]') === 'testeur', url);
        await p7.fill('[data-mdp-synchro]', 'secret-du-site');
        const entetes = JSON.parse(await p7.inputValue('[data-entetes-synchro]'));
        v('  → en-têtes JSON prêts à coller : Authorization (fabriqué dans la page) + X-Sante-Token', entetes.Authorization === basic && entetes['X-Sante-Token'] === JETON, entetes);
        //  ce qu'envoie HC Webhook (docs/webhook.md) avec ces en-têtes
        const auj = new Date(), dj = auj.toISOString().slice(0, 10);
        const envoi = { timestamp: auj.toISOString(), app_version: '1.9.40', timezone: 'UTC',
            steps: [{ count: 6543, start_time: `${dj}T00:00:00Z`, end_time: `${dj}T23:59:59Z` }],
            sleep: [{ session_end_time: `${dj}T05:30:00Z`, duration_seconds: 25200, stages: [], metadata: { id: 'n1', end_zone_offset_seconds: 0 } }],
            heart_rate: [{ avg: 72, min: 60, max: 90, bpm: 72, time: `${dj}T08:00:00Z`, metadata: { zone_offset_seconds: 0 } }] };
        const rep = await fetch(url.replace(/^https?:\/\/[^/]+/, `http://127.0.0.1:${port}`), { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', ...entetes }, body: JSON.stringify(envoi) });
        const corps = await rep.json(), f = lireFichier();
        v('  → un envoi HC Webhook accepté (200) et écrit : pas 6 543, sommeil 420 min, FC 72 ; « dernière synchro » notée', rep.status === 200 && corps.source === 'hc_webhook' && f.journal[dj].samsung.pas === 6543 && f.journal[dj].samsung.sommeil_min === 420 && f.journal[dj].samsung.fc_moy === 72 && /HC Webhook/.test(f.sync_auto.source), [rep.status, corps, f.journal[dj] && f.journal[dj].samsung]);
        const mauvais = await fetch(U + 'sync_samsung.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Sante-Token': 'faux-jeton-faux-jeton' }, body: JSON.stringify(envoi) });
        v('  → avec un mauvais jeton : 403', mauvais.status === 403);
        await p7.evaluate((ST) => eval(ST).rechargerEtat(), ST);          // revenir sur la page (visibilitychange)
        await p7.waitForSelector('[data-derniere-synchro]', { timeout: 5000 });
        v('  → de retour sur la page : « ✓ dernière synchro à l\'instant », les pas du jour affichés', /dernière synchro à l’instant/.test(await p7.textContent('[data-derniere-synchro]')) && (await p7.textContent('[data-samsung-jour]')).replace(/\D/g, '').startsWith('6543'), await p7.textContent('[data-samsung-jour]'));
        await p7.close();
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close(); php.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(ko === 0 ? `\n  ✅ TOUT PASSE — ${n} contrôles` : `\n  ❌ ${ko} contrôle(s) en échec sur ${n}`);
process.exit(ko === 0 ? 0 : 1);
