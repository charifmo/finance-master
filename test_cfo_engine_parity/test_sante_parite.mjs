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

//  v1.4 — la date du bilan, les tirets des PDF, les nombres collés aux lettres
const D = (t, auj) => I.lireBilan(t, cat, { aujourdhui: auj }).date;
v('C. date : PRÉLÈVEMENT avant ouverture / édition ; tirets « − » (U+2212) et « – » lus', D('Dossier ouvert le : 14−05−2026\nPrélevé le : 15−05−2026\nEdité le : 21–05–2026\nTG 1') === '2026-05-15');
v('  → jamais la naissance, ni une antériorité, ni une date future, ni avant 1990', D('Né(e) le 02/02/1980\nAntériorités du 20/02/2025\nTG 1') === null && D('Date de naissance : 03/03/1981\nPrélevé le 01/12/2026\nTG 1', '2026-11-04') === null && D('Le 01/01/1985\nTG 1') === null);
v('  → « Bilan du 1er octobre 2026 », « 03/11/26 », ISO « 2026-05-15 » ; une norme « 5.06-6.00 » n\'est pas une date', D('Bilan du 1er octobre 2026\nTG 1') === '2026-10-01' && D('Résultats 03/11/26\nTG 1') === '2026-11-03' && D('Prélèvement 2026-05-15\nTG 1') === '2026-05-15' && D('Hématies 5.06-6.00\nTG 0.27-4.20') === null);
const r2 = I.lireBilan('Hémoglobine glyquée HbA1c 5.8 % 4.0 – 5.6\nVitamine D (D2+D3) 27.5 ng/mL > 30\nCortisol 8 h 312 nmol/L 166−507\nPlaquettes 211 000 /mm3 150 000 - 400 000', cat);
v('  → « HbA1c 5.8 » lu 5,8 ; « (D2+D3) 27.5 » lu 27,5 ; « Cortisol 8 h 312 » lu 312 ; bornes « 150 000 - 400 000 »', r2.valeurs.hba1c.v === 5.8 && r2.valeurs.hba1c.max === 5.6 && r2.valeurs.vitd.v === 27.5 && r2.valeurs.cortisol.v === 312 && r2.valeurs.cortisol.min === 166
  && JSON.stringify(r2.valeurs.plaquettes) === '{"v":211000,"min":150000,"max":400000}', r2.valeurs);

//  v1.4 — les plans : lecture d'un texte libre, puis prévu / réalisé identique en JS et en PHP
const pn = I.lirePlan('Plan nutritionnel\nTous les jours\nPetit-déjeuner : café noir + MCT\n- 2 oeufs\nLundi\nDéjeuner\n• salade, poulet 150 g\nCollation : amandes 20 g\nDîner\n1. soupe de légumes\nMardi :\nDéjeuner : poisson 150 g', 'nutrition');
v('D. plan nutritionnel : titre, jours et repas en titres, puces et numéros retirés (« - 2 oeufs » garde son 2)', pn.titre === 'Plan nutritionnel' && pn.items.length === 6 && pn.items[1].texte === '2 oeufs' && pn.items[1].jour === 'tous' && pn.items[1].moment === 'petit_dejeuner'
  && pn.items[3].jour === 'lundi' && pn.items[3].moment === 'collation' && pn.items[4].texte === 'soupe de légumes' && pn.items[5].jour === 'mardi', pn.items);
const pe = I.lirePlan('Programme exercice\nLundi : Marche Zone 2 à jeun 45 min\nMercredi\n- Machines bas du corps 1 h\n- Soleus pushups 10 min\nSamedi\nVélo 1h30', 'exercice');
v('  → plan d\'exercice : durées « 45 min », « 1 h », « 1h30 » lues (45, 60, 90 min)', pe.items.map(i => i.jour + ':' + i.duree_min).join() === 'lundi:45,mercredi:60,mercredi:10,samedi:90', pe.items);
const plan = { items: pe.items.map((x, i) => Object.assign({ id: 'e' + i }, x)).concat([{ id: 'q', jour: 'tous', texte: 'soleus', duree_min: 5 }]) };
const journal = { '2026-11-02': { plan_fait: { e0: true, q: true } }, '2026-11-03': { plan_fait: { q: true } }, '2026-11-04': { plan_fait: { e1: true } } };
//  v1.8 — protocole : jours précis (mardi + vendredi) et gestes périodiques (1×/semaine, 1×/mois), cochés une fois dans la période
const proto = { items: [{ id: 'q1', jour: 'tous', texte: 'eau', moment: 'reveil' }, { id: 'm1', jour: 'tous', jours: ['mardi', 'vendredi'], texte: 'machines', duree_min: 30 },
                        { id: 'h1', jour: 'tous', frequence: 'semaine', texte: 'pesée' }, { id: 'o1', jour: 'tous', frequence: 'mois', texte: 'tour de taille' }] };
const jProto = { '2026-11-03': { plan_fait: { m1: true, h1: true } }, '2026-10-30': { plan_fait: { o1: true } }, '2026-11-20': { plan_fait: { o1: true } } };
const casPlan = [[plan, journal, '2026-11-04'], [plan, journal, '2026-11-08'], [plan, journal, '2026-11-02'], [plan, {}, '2026-11-09'], [null, journal, '2026-11-04'],
                 [proto, jProto, '2026-11-03'], [proto, jProto, '2026-11-05'], [proto, jProto, '2026-11-10'], [proto, jProto, '2026-10-31']];
const fp = path.join(ICI, '.tmp_sante_plan.json'); fs.writeFileSync(fp, JSON.stringify(casPlan));
const phpPlan = JSON.parse(execFileSync('php', ['-r', `require '${path.join(S, 'sante_lib.php')}'; $d = json_decode(file_get_contents('${fp}'), true); echo json_encode(array_map(fn($c) => sante_suivi_plan(...$c), $d), JSON_UNESCAPED_UNICODE);`], { encoding: 'utf8' }));
fs.rmSync(fp, { force: true });
const jsPlan = casPlan.map(c => C.suiviPlan(...c));
v(`  → prévu / réalisé : ${casPlan.length} cas identiques en JS et en PHP`, egal(jsPlan, phpPlan), [jsPlan[0], phpPlan[0]]);
v('  → mercredi 04/11 : prévus lun→mer 1+1+1 « tous les jours » + 1 + 2 = 6, faits 4, taux 67 %, minutes 45+5+5+60+10+5 / 45+5+5+60', JSON.stringify(jsPlan[0].semaine) === JSON.stringify({ du: '2026-11-02', prevus: 6, faits: 4, taux: 67, minutes_prevues: 130, minutes_faites: 115 }) && jsPlan[0].du_jour.length === 3 && jsPlan[0].du_jour[0].fait === true, jsPlan[0]);
v('  → protocole : machines les mardis et vendredis seulement ; pesée cochée mardi = faite toute la semaine ; tour de taille : le mois', jsPlan[5].du_jour.map(i => i.id).join() === 'q1,m1' && jsPlan[6].du_jour.map(i => i.id).join() === 'q1'
  && jsPlan[6].periodiques.find(i => i.id === 'h1').fait === true && jsPlan[7].periodiques.find(i => i.id === 'h1').fait === false && jsPlan[6].periodiques.find(i => i.id === 'o1').fait === true && jsPlan[8].periodiques.find(i => i.id === 'o1').fait === true
  && jsPlan[5].semaine.prevus === 3, [jsPlan[5], jsPlan[6].periodiques]);
v('  → dimanche : la semaine entière ; lundi suivant : nouvelle semaine ; sans plan : rien de prévu', jsPlan[1].semaine.du === '2026-11-02' && jsPlan[3].semaine.du === '2026-11-09' && jsPlan[3].semaine.faits === 0 && jsPlan[4].semaine.taux === null);
console.log(ko === 0 ? `\n  ✅ TOUT PASSE — ${n} contrôles` : `\n  ❌ ${ko} contrôle(s) en échec sur ${n}`);
process.exit(ko === 0 ? 0 : 1);
