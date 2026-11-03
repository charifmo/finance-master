/**
 * Santé Master — PARITÉ JS ↔ PHP : l'appli (sante_calculs.js) et le moteur du Médecin-Chef IA (sante_lib.php)
 * donnent EXACTEMENT les mêmes chiffres, cas par cas. Plus la lecture des comptes rendus (sante_import.js).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const ICI = path.dirname(fileURLToPath(import.meta.url)), S = path.resolve(ICI, '..', 'sante');
const require = createRequire(import.meta.url);
const C = require(path.join(S, 'sante_calculs.js')).creer({ catalogue: require(path.join(S, 'biomarqueurs.json')), aliments: require(path.join(S, 'aliments.json')).aliments });
const I = require(path.join(S, 'sante_import.js'));
let ko = 0, n = 0;
const v = (t, ok, d = '') => { n++; if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(78)} ${ok ? '' : (typeof d === 'string' ? d : JSON.stringify(d))}`); };
console.log('\n  SANTÉ MASTER — PARITÉ JS ↔ PHP, LECTURE DES BILANS\n  ' + '─'.repeat(80));

const B = (vals, date = '2026-04-02') => ({ date, valeurs: vals });
const cas = [
    ['gilbert', B({ bili_t: { v: 15.7, max: 14 }, bili_c: { v: 3.4, max: 3.4 }, bili_l: { v: 12.3 }, asat: { v: 24 }, alat: { v: 27 }, ggt: { v: 26 } })],
    ['gilbert', B({ bili_t: { v: 15.7, max: 14 }, asat: { v: 24 }, alat: { v: 72 }, ggt: { v: 26 } })],
    ['gilbert', B({ bili_t: { v: 20 }, bili_c: { v: 6 }, asat: { v: 24 }, alat: { v: 27 }, ggt: { v: 26 } })],
    ['gilbert', B({ bili_l: { v: 12 } })],
    ['gilbert', B({})],
    ['ratioTgHdl', 2.17, 0.4], ['nonHdl', 2.1, 0.4], ['homaIr', 1.0, 10], ['homaIr', 0.98, 13.0], ['tyg', 2.17, 1.0], ['tyg', 1.95, 0.98],
    ['score2', 50, 'H', true, 140, 5.5 / 2.586, 1.3 / 2.586, 'low'], ['score2', 50, 'H', true, 140, 5.5 / 2.586, 1.3 / 2.586, 'very_high'],
    ['score2', 44, 'H', false, 128, 2.05, 0.41, 'moderate'], ['score2', 62, 'H', false, 150, 2.3, 0.45, 'high'], ['score2', 44, 'H', false, null, 2.0, null, 'moderate'],
    ['bmr', 110, 175, 44, 'H'], ['bmr', 97.6, 178, 46, 'H'], ['bilanEnergie', 2000, 1779, 500], ['bilanEnergie', 1650, 1979, null],
    ['projectionPoids', [{ date: '2026-10-01', kg: 100 }, { date: '2026-10-29', kg: 98 }], 90, null, '2026-10-29'],
    ['projectionPoids', [{ date: '2026-10-29', kg: 98 }], 90, -550, '2026-10-29'],
    ['projectionPoids', [{ date: '2026-09-01', kg: 101 }, { date: '2026-09-15', kg: 100.2 }, { date: '2026-10-01', kg: 99.1 }, { date: '2026-10-15', kg: 98.4 }, { date: '2026-11-01', kg: 97.6 }], 85, null, '2026-11-01'],
    ['age', '1980-01-07', '2026-04-02'], ['age', '1980-01-07', '2026-01-06'],
];
const phpFn = { gilbert: 'sante_gilbert', ratioTgHdl: 'sante_ratio_tg_hdl', nonHdl: 'sante_non_hdl', homaIr: 'sante_homa_ir', tyg: 'sante_tyg', score2: 'sante_score2', bmr: 'sante_bmr', bilanEnergie: 'sante_bilan_energie', projectionPoids: 'sante_projection_poids', age: 'sante_age' };
const repas = [
    [[{ nom: 'salade', g: 150 }, { nom: 'poulet', g: 120 }, { nom: "pain d'orge", g: 60 }], true],
    [[{ nom: 'pain de mie', g: 60 }, { nom: 'biscuits', g: 30 }, { nom: 'poulet', g: 100 }], false],
    [[{ nom: 'œufs', g: 110 }, { nom: 'kefir', g: 200 }, { nom: 'tomate', g: 80 }], false],
    [[{ nom: 'tajine', g: 350 }, { nom: 'pain', g: 50 }], true],
];
const f = path.join(ICI, '.tmp_sante_parite.json');
fs.writeFileSync(f, JSON.stringify({ cas: cas.map(([fn, ...a]) => [phpFn[fn], a]), repas }));
const php = JSON.parse(execFileSync('php', ['-r', `require '${path.join(S, 'sante_lib.php')}'; $d = json_decode(file_get_contents('${f}'), true); $o = ['cas' => [], 'repas' => []];
  foreach ($d['cas'] as [$fn, $a]) { if ($fn === 'sante_score2') { $a[2] = (bool)$a[2]; } $o['cas'][] = $fn(...$a); }
  foreach ($d['repas'] as [$it, $m]) { $x = array_map('sante_item', $it); $o['repas'][] = [$x, sante_score_sequencage($x, $m), sante_totaux_repas($x)]; }
  echo json_encode($o, JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION);`], { encoding: 'utf8' }));
fs.rmSync(f, { force: true });
const egal = (a, b) => JSON.stringify(a, (k, x) => typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : x) === JSON.stringify(b, (k, x) => typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : x);
let diff = [];
cas.forEach(([fn, ...a], i) => { const js = C[fn](...a); if (!egal(js, php.cas[i])) diff.push([fn, a, js, php.cas[i]]); });
v(`A. ${cas.length} calculs identiques en JS et en PHP (Gilbert, ratios, HOMA, TyG, SCORE2, BMR, énergie, projection, âge)`, diff.length === 0, diff.slice(0, 2));
diff = [];
repas.forEach(([it, m], i) => { const x = it.map(C.item); const js = [x, C.scoreSequencage(x, m), C.totauxRepas(x)]; if (!egal(js, php.repas[i])) diff.push([i, js, php.repas[i]]); });
v(`  → ${repas.length} repas : mêmes aliments reconnus, mêmes calories, même score de séquençage`, diff.length === 0, diff.slice(0, 1));

const cat = require(path.join(S, 'biomarqueurs.json'));
const T = `LABORATOIRE FICTIF — Bilan du 02/04/2026
Hématies 5.06 M/mm3 (4.28 - 6.00)
Hémoglobine 14,70 g/dL 13 - 18
Leucocytes 4 420 /mm3
Neutrophiles 49.9 % 2206
Triglycérides : 2.17 g/L < 1.50
Apolipoprotéine B 1.42 g/L < 1.00
Bilirubine totale 15.7 mg/L < 14.0
Bilirubine conjuguée 3.4 mg/L < 3.4
Bilirubine libre 12.3 mg/L
TSHus 1.400 µUI/mL 0.27 - 4.20
Vitamine D2/D3 27.5 ng/mL > 30
Vitamine B9 5.86 ng/mL > 3.89
Commentaire 12`;
const r = I.lireBilan(T, cat);
v('B. lecture d\'un compte rendu : date, 12 biomarqueurs, bornes (intervalle, « < », « > »)', r.date === '2026-04-02' && Object.keys(r.valeurs).length === 12
  && JSON.stringify(r.valeurs.hematies) === '{"v":5.06,"min":4.28,"max":6}' && r.valeurs.tg.max === 1.5 && r.valeurs.vitd.min === 30 && r.valeurs.apob.v === 1.42, r);
v('  → « 4 420 » lu 4 420 ; la formule « 49.9 % 2206 » garde la valeur absolue ; « 14,70 » lu 14,7', r.valeurs.leuco.v === 4420 && r.valeurs.neutro.v === 2206 && r.valeurs.hb.v === 14.7);
v('  → bilirubine conjuguée et libre ne sont pas confondues avec la totale', r.valeurs.bili_c.v === 3.4 && r.valeurs.bili_l.v === 12.3 && r.valeurs.bili_t.v === 15.7);
v('  → une ligne inconnue est rendue pour vérification, jamais devinée', r.nonReconnues.includes('Commentaire 12'));
console.log(ko === 0 ? `\n  ✅ TOUT PASSE — ${n} contrôles` : `\n  ❌ ${ko} contrôle(s) en échec sur ${n}`);
process.exit(ko === 0 ? 0 : 1);
