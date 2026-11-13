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
    //  v1.26 — une séance sans durée ni fin : écartée (et son « count » de 99 999 ne pollue pas les pas du jour)
    [`${R}com.samsung.shealth.exercise.${TC}.csv`]: csv('com.samsung.shealth.exercise', ['com.samsung.health.exercise.count', 'com.samsung.health.exercise.calorie', 'com.samsung.health.exercise.start_time'], [['99999', '9999', '2026-11-01 07:00:00.000']]),
    //  inutiles : ignorés sans être lus
    [`${R}jsons/com.samsung.shealth.tracker.heart_rate/a/abc.binning_data.json`]: '[{"heart_rate":200,"start_time":1}]',
    [`${R}files/com.samsung.shealth.food_image/photo.jpg`]: 'JPEG',
};
const tous = Object.entries(fichiers).map(([nom, texte]) => ({ nom, texte }));
v('A. noms : les CSV utiles sont reconnus (séances comprises, v1.26) ; détails jsons inutiles et photos ne sont pas lus', tous.filter(f => S.estUtile(f.nom)).length === 8 && S.estUtile(`${R}com.samsung.shealth.exercise.${TC}.csv`) && tous.every(f => S.estExportSamsung(f.nom)));
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
v('D. .zip du dossier : seuls les 8 CSV utiles sont décompressés, même résultat qu\'avec le dossier ouvert', lus.length === 8 && JSON.stringify(rz.jours) === JSON.stringify(r.jours) && lus0.length === 8, lus.map(f => f.nom));
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
v('  → zip64 (65 600 fichiers de détail) : les 8 CSV utiles retrouvés', lus64.length === 8, lus64.length);
fs.rmSync(tmp, { recursive: true, force: true });
/* ── v1.26 — « JE VEUX TOUT CE QUE SAMSUNG A, AVEC L'HISTORIQUE » : composition corporelle, séances détaillées, VO₂ max (décor FICTIF) ── */
const TC2 = '20261113091500', R2 = `samsunghealth_testeur_${TC2}/`;
const live = []; const t0 = Date.UTC(2026, 10, 13, 6, 22);
//  44 min de marche à ~4,8 km/h (1,33 m/s), une mesure toutes les 10 s : distance CUMULÉE, FC qui monte de 95 à 125
for (let s = 0; s <= 2640; s += 10) live.push({ start_time: t0 + s * 1000, heart_rate: Math.round(95 + 30 * Math.min(1, s / 600)), speed: 1.33, distance: Math.round(s * 1.33) });
const f2 = {
    //  la table des pesées porte aussi la composition (montre BIA) ; une 2e mesure du même jour, plus tardive, l'emporte
    [`${R2}com.samsung.health.weight.${TC2}.csv`]: csv('com.samsung.health.weight', ['start_time', 'time_offset', 'weight', 'body_fat', 'body_fat_mass', 'skeletal_muscle_mass', 'fat_free_mass', 'total_body_water', 'basal_metabolic_rate', 'vfa_level'],
        [['2026-01-10 06:00:00.000', 'UTC+0100', '103.1', '33.0', '34.0', '37.9', '69.1', '50.6', '2010', '14'],
         ['2026-11-12 06:00:00.000', 'UTC+0100', '110.9', '35.0', '38.8', '39.5', '72.1', '52.8', '2085', '16'], ['2026-11-12 07:30:00.000', 'UTC+0100', '110.5', '34.8', '38.5', '39.6', '72.0', '52.7', '2083', '16'],
         ['2026-11-11 06:00:00.000', 'UTC+0100', '111.0', '', '', '', '', '', '', '']]),
    [`${R2}com.samsung.shealth.exercise.${TC2}.csv`]: csv('com.samsung.shealth.exercise',
        ['com.samsung.health.exercise.start_time', 'com.samsung.health.exercise.end_time', 'com.samsung.health.exercise.time_offset', 'com.samsung.health.exercise.exercise_type',
         'com.samsung.health.exercise.duration', 'com.samsung.health.exercise.distance', 'com.samsung.health.exercise.calorie', 'com.samsung.health.exercise.mean_heart_rate',
         'com.samsung.health.exercise.max_heart_rate', 'com.samsung.health.exercise.mean_speed', 'com.samsung.health.exercise.altitude_gain', 'com.samsung.health.exercise.count',
         'com.samsung.health.exercise.count_type', 'com.samsung.health.exercise.vo2_max', 'com.samsung.health.exercise.datauuid', 'com.samsung.health.exercise.live_data'],
        [['2026-11-13 06:22:00.000', '2026-11-13 07:06:09.000', 'UTC+0100', '1001', '2649000', '3510', '351', '110', '125', '1.33', '8', '4636', '30001', '35.4', 'abc-123', 'abc-123.com.samsung.health.exercise.live_data.json'],
         ['2025-03-02 17:00:00.000', '2025-03-02 17:30:00.000', 'UTC+0100', '1002', '1800000', '4000', '300', '140', '165', '2.2', '', '', '', '', 'old-1', '']]),
    [`${R2}jsons/com.samsung.shealth.exercise/a/abc-123.com.samsung.health.exercise.live_data.json`]: JSON.stringify(live),
    [`${R2}com.samsung.shealth.vo2_max.${TC2}.csv`]: csv('com.samsung.shealth.vo2_max', ['start_time', 'time_offset', 'vo2_max'], [['2026-10-01 08:00:00.000', 'UTC+0100', '34.9']]),
};
const t2 = Object.entries(f2).map(([nom, texte]) => ({ nom, texte }));
v('F. noms : la composition (pesées), les séances, le VO₂ max et le DÉTAIL d\'une séance (live_data) sont reconnus', t2.filter(f => S.estUtile(f.nom) || S.estLiveData(f.nom)).length === 4
  && S.estLiveData(`${R2}jsons/com.samsung.shealth.exercise/a/abc-123.com.samsung.health.exercise.live_data.json`) && !S.estLiveData(`${R2}jsons/com.samsung.shealth.tracker.heart_rate/a/x.binning_data.json`));
const r3 = S.extraire(t2, { decalageMin: 60, fcMax: 176 });
const c12 = r3.compo.find(x => x.date === '2026-11-12') || {};
v('  → composition corporelle : graisse % et kg, muscle squelettique, masse maigre, eau, métabolisme de base, graisse viscérale — la DERNIÈRE mesure du jour',
  c12.kg === 110.5 && c12.graisse_pct === 34.8 && c12.graisse_kg === 38.5 && c12.muscle_kg === 39.6 && c12.masse_maigre_kg === 72 && c12.eau_kg === 52.7 && c12.bmr_kcal === 2083 && c12.graisse_viscerale === 16, c12);
v('  → TOUT l\'historique : la mesure de janvier gardée ; une pesée sans composition ne crée pas de ligne de composition', r3.compo.length === 2 && r3.compo[0].date === '2026-01-10' && !r3.compo.some(x => x.date === '2026-11-11'), r3.compo.map(x => x.date));
const m = r3.seances.find(x => x.id === 'abc-123') || {};
v('  → la séance de marche : nom, date et heure LOCALES, 44 min 9 s, 3,51 km, 351 kcal, FC 110 / 125, 4,8 km/h, 8 m de dénivelé, 4 636 pas, VO₂ max 35,4',
  m.nom === 'Marche' && m.date === '2026-11-13' && m.heure === '07:22' && m.duree_s === 2649 && m.distance_m === 3510 && m.kcal === 351 && m.fc_moy === 110 && m.fc_max === 125
  && m.vitesse_kmh === 4.8 && m.denivele_m === 8 && m.pas === 4636 && m.vo2max === 35.4, m);
const zs = m.zones_s || [];
v('  → zones de FC calculées sur le détail (FC max 176) : < 60 %, 60-70 %, 70-80 %… ; leur total = la durée du détail',
  zs.length === 5 && Math.abs(zs.reduce((s, x) => s + x, 0) - 2641) <= 2 && zs[0] > 0 && zs[1] > zs[0] && zs[3] === 0 && zs[4] === 0 && m.fc_max_ref === 176, zs);
const pk = m.par_km || [];
v('  → temps par km : 3 km complets (~12 min 30 s chacun) puis le reste (0,51 km), chacun avec sa FC moyenne',
  pk.length === 4 && pk.slice(0, 3).every(k => k.km === 1 && Math.abs(k.duree_s - 752) <= 2 && k.fc >= 95) && Math.abs(pk[3].km - 0.511) < 0.01 && pk[3].fc === 125, pk);
const o1 = r3.seances.find(x => x.id === 'old-1') || {};
v('  → une course de mars 2025 sans détail : gardée (historique), sans zones ni temps par km inventés', o1.nom === 'Course' && o1.date === '2025-03-02' && !o1.zones_s && !o1.par_km && o1.vitesse_kmh === 7.9, o1);
v('  → VO₂ max par jour : sa table (34,9 le 01/10) et celui de la séance (35,4 le 13/11)', JSON.stringify(r3.vo2) === JSON.stringify([{ date: '2026-10-01', vo2max: 34.9 }, { date: '2026-11-13', vo2max: 35.4 }]), r3.vo2);
const r4 = S.extraire(t2, { decalageMin: 60 });
v('  → sans FC max connue (profil sans date de naissance) : pas de zones inventées ; les temps par km restent', !(r4.seances.find(x => x.id === 'abc-123') || {}).zones_s && ((r4.seances.find(x => x.id === 'abc-123') || {}).par_km || []).length === 4);
v('  → distance du détail PAR INTERVALLE (non cumulée) : mêmes temps par km', (() => { const inc = live.map((p, i) => ({ ...p, distance: i ? p.distance - live[i - 1].distance : 0 }));
  const d = S.detailSeance(JSON.stringify(inc), t0, 176); return (d.par_km || []).length === 4 && Math.abs(d.par_km[0].duree_s - 752) <= 2; })());
v('  → un code inconnu est dit tel quel, jamais deviné', S.nomSeance(99999, '') === 'Séance (type 99999)' && S.nomSeance(1001, '') === 'Marche' && S.nomSeance(0, 'Padel') === 'Padel');

/* ── v1.26 — « LES FICHIERS SAMSUNG SONT DISPERSÉS DANS DES DOSSIERS ET SOUS-DOSSIERS » : l'import doit marcher du premier coup,
      quelle que soit la version de l'export (Samsung ne publie pas son format) ── */
const R3 = 'Samsung Health/samsunghealth_testeur_20250101/';
//  (a) un ancien export : le détail de séance dans files/…, COMPRESSÉ en gzip, sans clé « distance » mais avec le TRACÉ (location_data)
const liveSans = live.map(({ start_time, heart_rate }) => ({ start_time, heart_rate }));
const lat0 = 31.6295, lon0 = -7.9811, parSec = 1.33 / 111320;   // ~1,33 m/s vers le nord
const trace = live.filter((_, i) => i % 3 === 0).map(p => ({ start_time: p.start_time, latitude: lat0 + (p.start_time - t0) / 1000 * parSec, longitude: lon0, altitude: 470 }));
const tmp3 = fs.mkdtempSync(path.join(os.tmpdir(), 'samsung3-')), src3 = path.join(tmp3, 'f.json'), zip3 = path.join(tmp3, 'ancien.zip');
fs.writeFileSync(src3, JSON.stringify({
    [`${R3}com.samsung.shealth.exercise.20250101.csv`]: f2[`${R2}com.samsung.shealth.exercise.${TC2}.csv`].replace(/abc-123\.com\.samsung\.health\.exercise\.live_data\.json/, '1'),   // ancien : live_data = 1
    [`${R3}files/com.samsung.shealth.exercise/abc-123.com.samsung.health.exercise.live_data.json`]: JSON.stringify(liveSans),
    [`${R3}files/com.samsung.shealth.exercise/abc-123.com.samsung.health.exercise.location_data.json`]: JSON.stringify(trace),
    [`${R3}sous/dossier/profond/com.samsung.health.weight.20250101.csv`]: f2[`${R2}com.samsung.health.weight.${TC2}.csv`],
    [`${R3}files/com.samsung.shealth.food_image/x.jpg`]: 'JPEG',
}));
execFileSync('python3', ['-c', `import zipfile,json,sys,gzip
d=json.load(open(sys.argv[1],encoding='utf-8'))
z=zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED)
for k,t in d.items():
    b=t.encode('utf-8')
    if 'live_data' in k or 'location_data' in k: b=gzip.compress(b)
    z.writestr(k,b)
z.close()`, src3, zip3]);
const lus3 = await S.lireZip(fs.readFileSync(zip3), (nom) => S.estUtile(nom) || S.estLiveData(nom));
const r5 = S.extraire(lus3, { decalageMin: 60, fcMax: 176 });
const m5 = r5.seances.find(x => x.id === 'abc-123') || {};
v('G. ancien export en .zip : CSV dans des sous-dossiers profonds, détail de séance dans files/ et COMPRESSÉ (gzip) — tout est retrouvé',
  lus3.length === 4 && !lus3.some(x => /\.jpg$/.test(x.nom)) && r5.compo.length === 2 && (m5.zones_s || []).length === 5, lus3.map(x => x.nom.slice(R3.length)));
v('  → pas de clé « distance » dans le détail : les temps par km viennent du TRACÉ GPS (location_data), à quelques secondes près',
  (m5.par_km || []).length === 4 && m5.par_km.slice(0, 3).every(k => Math.abs(k.duree_s - 752) <= 8), m5.par_km);
const dV = S.detailSeance(JSON.stringify(live.map(({ start_time, heart_rate, speed }) => ({ start_time, heart_rate, speed }))), t0, 176);
v('  → ni distance ni tracé, seulement la vitesse : intégrée dans le temps (3 km + le reste)', (dV.par_km || []).length === 4 && Math.abs(dV.par_km[0].duree_s - 752) <= 10, dV.par_km);
const dR = S.detailSeance(JSON.stringify(liveSans), t0, 176);
v('  → seulement la FC : des zones, mais AUCUN temps par km inventé', (dR.zones_s || []).length === 5 && !dR.par_km);
v('  → un détail gzip lu à part (dossier ouvert) : décompressé', await S.texteDe(execFileSync('python3', ['-c', 'import gzip,sys;sys.stdout.buffer.write(gzip.compress(b"[1,2]"))'])) === '[1,2]' && await S.texteDe(Buffer.from('[3]')) === '[3]');
fs.rmSync(tmp3, { recursive: true, force: true });

/* ── v1.27 — « ÇA SE BLOQUE APRÈS AVOIR IMPORTÉ LE DOSSIER EN ENTIER » : lecture pas à pas, en flux, jamais tout en mémoire ── */
const decoupe = (t, tailles) => { const out = []; let i = 0, k = 0; while (i < t.length) { const n = tailles[k++ % tailles.length]; out.push(t.slice(i, i + n)); i += n; } return out; };
const csvPiege = '﻿com.samsung.x,1,3\nа,b,c,\n"x, ""y""\nz",2,3,\r\nsimple,4,5,\n"",,"fin"\n';
const attendu = JSON.stringify(S.csvLignes(csvPiege));
const parMorceaux = [[1], [2, 3], [5], [7, 1, 13], [1000]].map(t => { const l = []; const p = S.analyseurCsv(x => l.push(x)); decoupe(csvPiege, t).forEach(m => p.morceau(m)); p.fin(); return JSON.stringify(l); });
v('H. analyseur PAR MORCEAUX : guillemets, virgules et retours à la ligne dans un champ, CRLF, BOM — même résultat, quel que soit le découpage',
  parMorceaux.every(x => x === attendu), [attendu, parMorceaux]);
//  un gros CSV de FC (500 000 lignes, ~28 Mo) lu en FLUX par morceaux de 64 Ko : mêmes moyennes que la lecture d'un bloc
const lignesFc = ['com.samsung.shealth.tracker.heart_rate,6313005,500000', 'com.samsung.health.heart_rate.start_time,com.samsung.health.heart_rate.time_offset,com.samsung.health.heart_rate.heart_rate,'];
for (let i = 0; i < 500000; i++) { const ms = Date.UTC(2024, 0, 1) + i * 600000; lignesFc.push(new Date(ms).toISOString().replace('T', ' ').replace('Z', '') + ',UTC+0100,' + (60 + (i % 40)) + ','); }
const grosCsv = lignesFc.join('\n') + '\n', nomFc = `${R}com.samsung.shealth.tracker.heart_rate.${TC}.csv`;
const octets = new TextEncoder().encode(grosCsv);
const flux = new ReadableStream({ start(c) { for (let i = 0; i < octets.length; i += 65536) c.enqueue(octets.subarray(i, i + 65536)); c.close(); } });
const tF = Date.now(), exF = S.creerExtracteur({ decalageMin: 60 }); await exF.ajouterFlux(nomFc, flux); const rF = exF.resultat(), dureeF = Date.now() - tF;
const rB = S.extraire([{ nom: nomFc, texte: grosCsv }], { decalageMin: 60 });
v(`  → un CSV de FC de ${(octets.length / 1e6).toFixed(0)} Mo lu en flux (morceaux de 64 Ko) : ${Object.keys(rF.jours).length} jours, mêmes moyennes qu'en un bloc (${dureeF} ms)`,
  rF.lus.fc === 500000 && JSON.stringify(rF.jours) === JSON.stringify(rB.jours) && Object.keys(rF.jours).length >= 3470, [rF.lus, Object.keys(rF.jours).length]);
//  l'ordre des fichiers n'importe plus : les pas (combinée) avant la table des appareils, la séance avant son détail
const ordreInverse = S.extraire([...tous].reverse().filter(f => S.estUtile(f.nom)), { decalageMin: 60 });
const sInv = S.extraire([...t2].reverse(), { decalageMin: 60, fcMax: 176 });
v('  → l\'ordre des fichiers n\'importe pas : pas de la ligne combinée et détail de séance retrouvés même dans l\'ordre inverse',
  JSON.stringify(ordreInverse.jours) === JSON.stringify(r.jours) && JSON.stringify(sInv.seances) === JSON.stringify(r3.seances));
//  le .zip PARCOURU sans être chargé : depuis un Blob (un File du navigateur), entrée par entrée, en flux
const zipB = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'samsung4-')), 'e.zip');
fs.writeFileSync(zipB + '.json', JSON.stringify({ ...fichiers, [nomFc]: grosCsv }));
execFileSync('python3', ['-c', `import zipfile,json,sys
d=json.load(open(sys.argv[1],encoding='utf-8'))
z=zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED)
for k,t in d.items(): z.writestr(k,t)
z.close()`, zipB + '.json', zipB]);
const exZ = S.creerExtracteur({ decalageMin: 60 }); let nZ = 0;
await S.parcourirZip(new Blob([fs.readFileSync(zipB)]), S.estUtile, async (nom, fl) => { nZ++; await exZ.ajouterFlux(nom, fl); });
const rZ = exZ.resultat();
v('  → .zip parcouru en flux depuis un Blob (comme un fichier choisi sur le téléphone) : 8 CSV, la FC des 500 000 lignes, les pas du 01/11',
  nZ === 8 && rZ.lus.fc >= 500000 && rZ.jours['2026-11-01'] && rZ.jours['2026-11-01'].pas === 9050, [nZ, rZ.lus]);
fs.rmSync(path.dirname(zipB), { recursive: true, force: true });

//  v1.28 — le détail réduit à son résultat dès sa lecture : le tracé AVANT le détail (ordre inverse dans le .zip) donne les mêmes temps par km
const exO = S.creerExtracteur({ decalageMin: 60, fcMax: 176 });
exO.ajouterTexte(`${R3}files/x/abc-123.com.samsung.health.exercise.location_data.json`, JSON.stringify(trace));
exO.ajouterTexte(`${R3}files/x/abc-123.com.samsung.health.exercise.live_data.json`, JSON.stringify(liveSans));
exO.ajouterTexte(`${R3}com.samsung.shealth.exercise.20250101.csv`, f2[`${R2}com.samsung.shealth.exercise.${TC2}.csv`]);
const mO = exO.resultat().seances.find(x => x.id === 'abc-123') || {};
v('  → v1.28 : le tracé lu AVANT le détail (ordre inverse) : mêmes zones et mêmes temps par km', (mO.par_km || []).length === 4 && JSON.stringify(mO.zones_s) === JSON.stringify(m5.zones_s), [mO.par_km, mO.zones_s, m5.zones_s]);
//  3 000 séances avec leur détail (des années d'export) : traitées une à une, résultat complet
const ex3 = S.creerExtracteur({ decalageMin: 60, fcMax: 176 }), lig = [];
const t3 = Date.now();
for (let i = 0; i < 3000; i++) { const id = 'm' + i, d0 = Date.UTC(2018, 0, 1) + i * 86400000; lig.push([new Date(d0).toISOString().replace('T', ' ').replace('Z', ''), '', 'UTC+0100', '1001', '1800000', '2400', '200', '110', '125', '1.33', '', '', '', '', id, id + '.com.samsung.health.exercise.live_data.json'].join(','));
  ex3.ajouterTexte(`${R3}jsons/com.samsung.shealth.exercise/${i % 16}/${id}.com.samsung.health.exercise.live_data.json`, JSON.stringify(live.slice(0, 181).map(p => ({ ...p, start_time: p.start_time - t0 + d0 })))); }
ex3.ajouterTexte(`${R3}com.samsung.shealth.exercise.20250101.csv`, csv('com.samsung.shealth.exercise', ['start_time', 'end_time', 'time_offset', 'exercise_type', 'duration', 'distance', 'calorie', 'mean_heart_rate', 'max_heart_rate', 'mean_speed', 'altitude_gain', 'count', 'count_type', 'vo2_max', 'datauuid', 'live_data'], lig.map(l => l.split(','))));
const s3 = ex3.resultat().seances;
v(`  → 3 000 séances et leurs 3 000 fichiers de détail (8 ans) : toutes rendues avec zones et temps par km (${Date.now() - t3} ms)`, s3.length === 3000 && s3.every(x => (x.zones_s || []).length === 5 && (x.par_km || []).length >= 2), s3.length);

v('E. CSV : guillemets, virgules et retours à la ligne dans un champ', JSON.stringify(S.csvLignes('a,b\n"x, ""y""\nz",2\n')) === JSON.stringify([['a', 'b'], ['x, "y"\nz', '2']]));
v('  → décalages « UTC+0100 », « UTC+05:30 », « UTC-5 », « GMT »', S.decalage('UTC+0100') === 60 && S.decalage('UTC+05:30') === 330 && S.decalage('UTC-5') === -300 && S.decalage('GMT') === 0);
console.log(ko === 0 ? `\n  ✅ TOUT PASSE — ${n} contrôles` : `\n  ❌ ${ko} contrôle(s) en échec sur ${n}`);
process.exit(ko === 0 ? 0 : 1);
