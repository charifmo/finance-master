/**
 * Santé Master — L'EXPORT SAMSUNG HEALTH TEL QUEL : un faux export au format réel (CSV à la racine, ligne de description,
 * colonnes préfixées, virgule finale, UTC + time_offset, plusieurs lignes de pas par jour, nuit en morceaux, sieste,
 * fichiers inutiles), lu dossier ouvert ou compressé (.zip). Décor FICTIF.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const ICI = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const S = require(path.resolve(ICI, '..', 'sante', 'sante_samsung.js'));
let ko = 0, n = 0;
const v = (t, ok, d = '') => { n++; if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(78)} ${ok ? '' : (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500)}`); };
console.log('\n  SANTÉ MASTER — L\'EXPORT SAMSUNG HEALTH TEL QUEL\n  ' + '─'.repeat(80));

const TC = '20261104123456', R = `samsunghealth_testeur_${TC}/`;
const csv = (type, tete, lignes) => `﻿${type},6313005,${lignes.length}\n${tete.join(',')},\n` + lignes.map(l => l.join(',') + ',').join('\n') + '\n';
const ms = (d) => String(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)));
const fichiers = {
    [`${R}com.samsung.health.device_profile.${TC}.csv`]: csv('com.samsung.health.device_profile', ['deviceuuid', 'device_group', 'name'], [['TEL1', '360001', 'Galaxy'], ['MONTRE1', '360003', 'Watch'], ['VfS0qUERdZ', '0', 'Combined']]),
    //  3 lignes par jour : téléphone, montre, combinée (pas forcément la plus grande en apparence : on prend la combinée)
    [`${R}com.samsung.shealth.tracker.pedometer_day_summary.${TC}.csv`]: csv('com.samsung.shealth.tracker.pedometer_day_summary', ['step_count', 'calorie', 'day_time', 'deviceuuid', 'source_info', 'binning_data'],
        [['6200', '250.5', '2026-11-01 00:00:00.000', 'TEL1', '', '"x.binning_data.json"'], ['9100', '380.2', '2026-11-01 00:00:00.000', 'MONTRE1', '', ''], ['9050', '377', '2026-11-01 00:00:00.000', 'VfS0qUERdZ', '', ''],
         ['7000', '300', ms('2026-11-02'), 'TEL1', '', '']]),
    [`${R}com.samsung.shealth.calories_burned.details.${TC}.csv`]: csv('com.samsung.shealth.calories_burned.details', ['com.samsung.shealth.calories_burned.active_calorie', 'com.samsung.shealth.calories_burned.rest_calorie', 'com.samsung.shealth.calories_burned.day_time'],
        [['512.4', '1700', '2026-11-01 00:00:00.000'], ['498', '1700', '2026-11-01 00:00:00.000']]),
    //  pesées : 23:30 UTC le 31/10 avec UTC+0100 = le 01/11 à 00:30 en local ; deux pesées le 02/11 → la dernière
    [`${R}com.samsung.health.weight.${TC}.csv`]: csv('com.samsung.health.weight', ['start_time', 'time_offset', 'weight', 'height', 'body_fat'],
        [['2026-10-31 23:30:00.000', 'UTC+0100', '97.42', '178', '25'], ['2026-11-02 06:00:00.000', 'UTC+0100', '97.0', '178', ''], ['2026-11-02 19:00:00.000', 'UTC+0100', '96.81', '178', '']]),
    [`${R}com.samsung.shealth.tracker.heart_rate.${TC}.csv`]: csv('com.samsung.shealth.tracker.heart_rate', ['com.samsung.health.heart_rate.start_time', 'com.samsung.health.heart_rate.time_offset', 'com.samsung.health.heart_rate.heart_rate', 'com.samsung.health.heart_rate.min', 'com.samsung.health.heart_rate.max'],
        [['2026-11-01 08:00:00.000', 'UTC+0100', '70', '60', '90'], ['2026-11-01 09:00:00.000', 'UTC+0100', '80', '70', '95'], ['2026-11-01 10:00:00.000', 'UTC+0100', '0', '0', '0']]),
    //  nuit du 01 au 02 en deux morceaux (combined_id) + la ligne combinée ; une sieste (nap_score) écartée ; une nuit simple du 31 au 01
    [`${R}com.samsung.shealth.sleep.${TC}.csv`]: csv('com.samsung.shealth.sleep', ['com.samsung.health.sleep.start_time', 'com.samsung.health.sleep.end_time', 'com.samsung.health.sleep.time_offset', 'sleep_duration', 'combined_id', 'nap_score'],
        [['2026-10-31 22:00:00.000', '2026-11-01 05:30:00.000', 'UTC+0100', '450', '', ''], ['2026-11-01 22:00:00.000', '2026-11-02 01:00:00.000', 'UTC+0100', '180', 'C1', ''], ['2026-11-02 01:30:00.000', '2026-11-02 05:00:00.000', 'UTC+0100', '210', 'C1', ''],
         ['2026-11-02 13:00:00.000', '2026-11-02 13:40:00.000', 'UTC+0100', '40', '', '62']]),
    [`${R}com.samsung.shealth.sleep_combined.${TC}.csv`]: csv('com.samsung.shealth.sleep_combined', ['start_time', 'end_time', 'time_offset', 'sleep_duration'], [['2026-11-01 22:00:00.000', '2026-11-02 05:00:00.000', 'UTC+0100', '390']]),
    //  inutiles : ignorés sans être lus
    [`${R}com.samsung.shealth.exercise.${TC}.csv`]: csv('com.samsung.shealth.exercise', ['com.samsung.health.exercise.count', 'com.samsung.health.exercise.calorie', 'com.samsung.health.exercise.start_time'], [['99999', '9999', '2026-11-01 07:00:00.000']]),
    [`${R}jsons/com.samsung.shealth.tracker.heart_rate/a/abc.binning_data.json`]: '[{"heart_rate":200,"start_time":1}]',
    [`${R}files/com.samsung.shealth.food_image/photo.jpg`]: 'JPEG',
};
const tous = Object.entries(fichiers).map(([nom, texte]) => ({ nom, texte }));
v('A. noms : les CSV utiles sont reconnus ; exercice, détails jsons et photos ne sont pas lus', tous.filter(f => S.estUtile(f.nom)).length === 7 && !S.estUtile(`${R}com.samsung.shealth.exercise.${TC}.csv`) && tous.every(f => S.estExportSamsung(f.nom)));
const r = S.extraire(tous.filter(f => S.estUtile(f.nom)), { decalageMin: 60 });
const j1 = r.jours['2026-11-01'] || {}, j2 = r.jours['2026-11-02'] || {};
v('B. pas : la ligne COMBINÉE de Samsung (9 050), pas la montre (9 100) ni le téléphone ; vieux day_time en ms lu', j1.pas === 9050 && j2.pas === 7000, r.jours);
v('  → kcal actives : calories_burned.details (la plus grande du jour : 512), sinon les kcal de marche (02/11 : 300)', j1.kcal_actives === 512 && j2.kcal_actives === 300, [j1, j2]);
v('  → poids : 23:30 UTC + 1 h = le 01/11 en local (97,4) ; deux pesées le 02/11 → la dernière (96,8)', j1.poids === 97.4 && j2.poids === 96.8 && r.pesees.length === 2 && !r.jours['2026-10-31'], r.pesees);
v('  → FC moyenne du jour : (70 + 80) / 2 = 75 ; la lecture à 0 (capteur pas prêt) écartée', j1.fc_moy === 75, j1);
v('  → sommeil par jour de réveil : 450 min le 01/11 ; le 02/11 la nuit COMBINÉE (390), pas morceaux + combinée, sans la sieste', j1.sommeil_min === 450 && j2.sommeil_min === 390, [j1.sommeil_min, j2.sommeil_min]);
v('  → l\'exercice (99 999 « count ») n\'a rien pollué', !Object.values(r.jours).some(j => j.pas === 99999));

//  sans aucun CSV de pas : le détail par 10 min de jsons/ sert de secours (somme du jour, max entre fichiers)
const bins = (lst) => JSON.stringify(lst.map(([h, p]) => ({ start_time: Date.UTC(2026, 10, 3, h, 0), mStepCount: p })));
const r2 = S.extraire([{ nom: `${R}jsons/com.samsung.shealth.tracker.pedometer_day_summary/1/u1.binning_data.json`, texte: bins([[8, 1000], [9, 2500]]) },
                       { nom: `${R}jsons/com.samsung.shealth.tracker.pedometer_day_summary/2/u2.binning_data.json`, texte: bins([[8, 900], [9, 2000]]) }], { decalageMin: 60 });
v('C. secours sans CSV : pas reconstitués du détail par 10 min (3 500 = le fichier le plus complet, sans additionner les appareils)', r2.jours['2026-11-03'] && r2.jours['2026-11-03'].pas === 3500, r2);

//  le dossier compressé (.zip), comme le fait « Mes fichiers » → Compresser ; et en zip « stocké » (sans compression)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'samsung-')), zip = path.join(tmp, 'export.zip'), zip0 = path.join(tmp, 'export0.zip'), src = path.join(tmp, 'f.json');
fs.writeFileSync(src, JSON.stringify(fichiers));
execFileSync('python3', ['-c', `import zipfile,json,sys
d=json.load(open(sys.argv[1],encoding='utf-8'))
for out,m in ((sys.argv[2],zipfile.ZIP_DEFLATED),(sys.argv[3],zipfile.ZIP_STORED)):
    z=zipfile.ZipFile(out,'w',m)
    z.writestr('samsunghealth_testeur_${TC}/','')
    for k,t in d.items(): z.writestr(k,t)
    z.close()`, src, zip, zip0]);
const lus = await S.lireZip(fs.readFileSync(zip), S.estUtile), lus0 = await S.lireZip(fs.readFileSync(zip0), S.estUtile);
const rz = S.extraire(lus, { decalageMin: 60 });
v('D. .zip du dossier : seuls les 7 CSV utiles sont décompressés, même résultat qu\'avec le dossier ouvert', lus.length === 7 && JSON.stringify(rz.jours) === JSON.stringify(r.jours) && lus0.length === 7, lus.map(f => f.nom));
let erreur = ''; try { await S.lireZip(Buffer.from('pas un zip'), S.estUtile); } catch (e) { erreur = e.message; }
v('  → un fichier qui n\'est pas un .zip : message clair', /pas un \.zip/.test(erreur), erreur);
//  zip64 : plus de 65 535 entrées (un export complet avec jsons/ peut les dépasser)
const zip64 = path.join(tmp, 'export64.zip');
execFileSync('python3', ['-c', `import zipfile,json,sys
d=json.load(open(sys.argv[1],encoding='utf-8'))
z=zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED,allowZip64=True)
for k,t in d.items(): z.writestr(k,t)
for i in range(65600): z.writestr('samsunghealth_testeur_${TC}/jsons/x/%d.json'%i,'')
z.close()`, src, zip64]);
const lus64 = await S.lireZip(fs.readFileSync(zip64), S.estUtile);
v('  → zip64 (65 600 fichiers de détail) : les 7 CSV utiles retrouvés', lus64.length === 7, lus64.length);
fs.rmSync(tmp, { recursive: true, force: true });
v('E. CSV : guillemets, virgules et retours à la ligne dans un champ', JSON.stringify(S.csvLignes('a,b\n"x, ""y""\nz",2\n')) === JSON.stringify([['a', 'b'], ['x, "y"\nz', '2']]));
v('  → décalages « UTC+0100 », « UTC+05:30 », « UTC-5 », « GMT »', S.decalage('UTC+0100') === 60 && S.decalage('UTC+05:30') === 330 && S.decalage('UTC-5') === -300 && S.decalage('GMT') === 0);
console.log(ko === 0 ? `\n  ✅ TOUT PASSE — ${n} contrôles` : `\n  ❌ ${ko} contrôle(s) en échec sur ${n}`);
process.exit(ko === 0 ? 0 : 1);
