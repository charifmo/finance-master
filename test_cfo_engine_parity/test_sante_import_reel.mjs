/**
 * Santé Master v1.21 — LA LECTURE DES VRAIS COMPTES RENDUS, et le statut « à vérifier ».
 *   Textes FICTIFS (patient inventé, valeurs inventées) qui reprennent les MISES EN PAGE réelles de trois laboratoires :
 *   un laboratoire marocain à « Valeurs références / Antériorités » (formule leucocytaire avec « Soit : »), Cerba (le nom sur une
 *   ligne, « 1,42 g/l   N : 0,66 à 1,33 » quelques lignes plus bas), et un laboratoire à points de conduite (« PROLACTINE.....: 14,12 »).
 *   Défauts corrigés : pourcentage lu à la place de la valeur absolue (faux orange), bornes collées à la valeur antérieure,
 *   « 8 heures » lu comme valeur, nom et valeur sur deux lignes, noms à tirets / parenthèses, numérations en G/L.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url)), RACINE = path.resolve(ICI, '..');
const require = createRequire(import.meta.url);
const SI = require(path.join(RACINE, 'sante/sante_import.js')), Calc = require(path.join(RACINE, 'sante/sante_calculs.js'));
const cat = JSON.parse(fs.readFileSync(path.join(RACINE, 'sante/biomarqueurs.json'), 'utf8'));
let ko = 0, n = 0;
const v = (t, ok, d = '') => { n++; if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(64)} ${ok ? '' : (typeof d === 'string' ? d : JSON.stringify(d))}`); };
console.log('\n  SANTÉ — LECTURE DES VRAIS COMPTES RENDUS\n  ' + '─'.repeat(80));
const eq = (o, x) => o && Object.keys(x).every(k => o[k] === x[k]);

//  ── A. Laboratoire à « Valeurs références / Antériorités » (mise en page de l'hémogramme) ──
const A = `Dossier ouvert le : 12−10−2026                         Mr TESTEUR Fictif
Prélevé le : 12−10−2026 à 09:10                          Réf dossier: 26101234
Edité le : 18−10−2026
HEMOGRAMME (Sysmex XN 550)
                                                                       Valeurs références     Antériorités
Hématies : [AC]                      4.95  M/mm3    (4.28−6.00)                          5.10
Hémoglobine : [AC]                   14.20 g/dL     (13.00−18.00)                        14.90
Leucocytes : [AC]                    5 420 /Mm3     (4 000−11 000)                       5 100
   Polynucléaires Neutrophiles : [AC] 52.0 %
                       Soit: [AC]    2 818 /mm3     (1 400−7 700)                        2 600
   Polynucléaires Eosinophiles : [AC] 3.0 %
                       Soit: [AC]    163 /mm3       (20−630)                             150
   Lymphocytes : [AC]                36.5 %
                       Soit: [AC]    1 978 /mm3     (1 000−4 800)                        2 000
Plaquettes : [AC]                    211 000 /Mm3   (150 000−400 000)                    225 000
VS 1ère heure                        7 mm           (0−15)
Glycémie à jeun [AC]                 0.96 g/L       (0.74−1.09)
(Dosage enzymatique)                 5.33 mmol/L    (4.11−6.05)
Hémoglobine glyquée (HBA1C) [AC]     4.5 %
Créatinine [AC]                      8.4 mg/L       (7.0−12.0)                           8.3
DFG Selon la Formule CKD EPI         106 ml/min/1.73m²                                   108
DFG Selon la Formule MDRD            101 ml/min/1.73m²                                   103
Acide Urique sanguin [AC]            74 mg/L        (34−70)
Cholestérol total [AC]               2.29 g/l       (<2.00)                              2.20
Cholestérol HDL [AC]                 0.37 g/L       (>0.40)                              0.39
Cholestérol LDL [AC]                 1.49 g/L       (<1.60)                              1.40
Transaminases SGOT /ASAT  [AC]       24 UI/L        (<50)                                25
Transaminases ALAT(GPT) [AC]         27 UI/L        (<50)                                29
Gamma glutamyl−transferase (GGT) [AC] 26 UI/L       (<60)
Cortisol plasmatique à 8 heures      170.9 nmoL/L   (166.0−507.0)
Site web : www.laboratoire-fictif.example INP: 093001006 − Patente : 35404878
394, Bd Fictif − Résidence Exemple − 20040 Casablanca`;
const a = SI.lireBilan(A, cat);
v('A. date : le prélèvement (12/10/2026), ni l’ouverture, ni l’édition', a.date === '2026-10-12', a.date);
v('  → formule leucocytaire : la valeur ABSOLUE de « Soit : » (2 818 /mm3, pas 52,0 %), avec ses bornes (1 400–7 700)', eq(a.valeurs.neutro, { v: 2818, min: 1400, max: 7700 }) && eq(a.valeurs.eos, { v: 163, min: 20, max: 630 }) && eq(a.valeurs.lympho, { v: 1978, min: 1000, max: 4800 }), [a.valeurs.neutro, a.valeurs.eos]);
v('  → bornes entre parenthèses : « (150 000−400 000) 225 000 » ne colle plus la valeur antérieure (max 400 000, pas 400 000 225 000)', eq(a.valeurs.plaquettes, { v: 211000, min: 150000, max: 400000 }) && eq(a.valeurs.leuco, { v: 5420, min: 4000, max: 11000 }), [a.valeurs.plaquettes, a.valeurs.leuco]);
v('  → la valeur du jour, jamais l’antérieure : hémoglobine 14,2 (pas 14,9) ; créatinine 8,4 (pas 8,3)', a.valeurs.hb.v === 14.2 && a.valeurs.creatinine.v === 8.4, [a.valeurs.hb, a.valeurs.creatinine]);
v('  → « Cortisol plasmatique à 8 heures 170,9 » : 170,9 (« 8 heures » n’est pas la valeur)', eq(a.valeurs.cortisol, { v: 170.9, min: 166, max: 507 }), a.valeurs.cortisol);
v('  → noms à tirets, parenthèses, « / » : HDL, LDL, ASAT, ALAT, GGT lus avec leurs bornes « < » et « > »',
  eq(a.valeurs.hdl, { v: 0.37, min: 0.4 }) && eq(a.valeurs.ldl, { v: 1.49, max: 1.6 }) && eq(a.valeurs.asat, { v: 24, max: 50 }) && eq(a.valeurs.alat, { v: 27, max: 50 }) && eq(a.valeurs.ggt, { v: 26, max: 60 }), [a.valeurs.hdl, a.valeurs.asat, a.valeurs.alat, a.valeurs.ggt]);
v('  → « Hémoglobine glyquée (HBA1C) 4,5 % » est l’HbA1c, pas l’hémoglobine ; le DFG CKD-EPI (pas MDRD) ; la glycémie en g/L (pas la ligne mmol/L)',
  a.valeurs.hba1c.v === 4.5 && a.valeurs.hb.v === 14.2 && a.valeurs.dfg.v === 106 && a.valeurs.glycemie.v === 0.96, [a.valeurs.hba1c, a.valeurs.dfg, a.valeurs.glycemie]);
v('  → nouveaux marqueurs lus : VS, acide urique, créatinine, DFG', a.valeurs.vs1.v === 7 && eq(a.valeurs.acide_urique, { v: 74, min: 34, max: 70 }) && a.valeurs.dfg.v === 106);
v('  → la source de chaque valeur est gardée (preuve) ; les pieds de page ne sont pas des « lignes non reconnues »',
  /Soit/.test(a.sources.neutro) && /2 818/.test(a.sources.neutro) && /Hématies/.test(a.sources.hematies) && !a.nonReconnues.some(l => /Site web|394, Bd/.test(l)), [a.sources.neutro, a.nonReconnues]);

//  ── B. Cerba : le nom, puis la valeur quelques lignes plus bas ──
const B = `APO-LIPOPROTEINE B (Immunoturbidimétrie) #
Prélèvement : 15.05.2026 Sérum                    07h 56
                                                  1,42 g/l                         N : 0,66 à 1,33
Afin de préserver la confidentialité, aucun résultat ne pourra vous être communiqué par téléphone.
ANTIGENE SPECIFIQUE PROSTATIQUE - PSA
  Résultat            :       0,46     ng/ml
PROTEINE LIANT LA TESTOSTERONE ET L'ESTRADIOL (TeBG ou SBP) (ECLIA) #
Prélèvement : 01.12.2025 Sérum    10h 00
                                                  19 nmol/l                        N : 18 à 54
Pour un homme de cet âge.`;
const b = SI.lireBilan(B, cat);
v('B. Cerba : « APO-LIPOPROTEINE B » puis « 1,42 g/l   N : 0,66 à 1,33 » quatre lignes plus bas : ApoB 1,42 (bornes 0,66–1,33)', eq(b.valeurs.apob, { v: 1.42, min: 0.66, max: 1.33 }), b.valeurs.apob);
v('  → « Résultat : 0,46 ng/ml » après le nom du PSA ; la SHBG « 19 nmol/l   N : 18 à 54 »', b.valeurs.psa.v === 0.46 && eq(b.valeurs.shbg, { v: 19, min: 18, max: 54 }), [b.valeurs.psa, b.valeurs.shbg]);
const B2 = `ANALYSES TRANSMISES
APOLIPOPROTEINE B :                         Veuillez consultez le compte rendu ci-joint.
Prélèvement à domicile sur rendez vous
394, Bd Zerktouni − Resd. Le Casablanca − Bourgogne − 20040 Casablanca Tél : 05 22.27.48.96`;
v('  → garde-fou : « Veuillez consulter le compte rendu ci-joint » n’attend aucune valeur — le « 394 » de l’adresse n’est jamais un résultat', !SI.lireBilan(B2, cat).valeurs.apob);

//  PDF dont le texte arrive en lignes séparées (« ng/ml », « Résultat : », puis « 0,46 ») : le nombre nu n'est accepté qu'après une ancre
const B3 = SI.lireBilan('ANTIGENE   SPECIFIQUE   PROSTATIQUE   - PSA\nng/ml\nRésultat   :  \n0,46  \n(Chimiluminescence)', cat);
const B4 = SI.lireBilan('ANTIGENE   SPECIFIQUE   PROSTATIQUE   - PSA\nPage 2\n12', cat);
v('  → texte coupé en trois lignes (« ng/ml », « Résultat : », « 0,46 ») : lu 0,46 ; un nombre nu SANS « Résultat : » ni unité avant (« Page 2 » puis « 12 ») n\u2019est jamais un résultat', B3.valeurs.psa && B3.valeurs.psa.v === 0.46 && !B4.valeurs.psa, [B3.valeurs, B4.valeurs]);

//  ── C. Points de conduite et lignes à une seule valeur ──
const C = `PROLACTINE........................: 14,12               ng/ml
TESTOSTERONE TOTALE...............: 2,95                ng/mL
 25−(OH)−vitamine D (D2+D3)                 31.77 ng/ml
 17−Béta−estradiol (E2)                     44.00 pg/ml
 Albuminémie :                                50 g/l            (40−50)
 Cholestérol − HDL                         0.46 g/L            (0.35−0.65)`;
const c = SI.lireBilan(C, cat);
v('C. « PROLACTINE.....: 14,12 », « TESTOSTERONE TOTALE.....: 2,95 », « 25−(OH)−vitamine D (D2+D3) 31.77 », estradiol, albumine', c.valeurs.prolactine.v === 14.12 && c.valeurs.testo.v === 2.95 && c.valeurs.vitd.v === 31.77 && c.valeurs.estradiol.v === 44 && eq(c.valeurs.albumine, { v: 50, min: 40, max: 50 }), c.valeurs);
v('  → « Cholestérol − HDL » (tiret entouré d’espaces) reconnu avec ses bornes 0,35–0,65', eq(c.valeurs.hdl, { v: 0.46, min: 0.35, max: 0.65 }), c.valeurs.hdl);

//  ── D. Unités et pourcentage seul ──
const D = `Leucocytes : 5.7 G/L (4.0−11.0)
Plaquettes : 196 G/L (150−400)
Polynucléaires Neutrophiles : 53.7 %`;
const d = SI.lireBilan(D, cat);
v('D. numérations en G/L ramenées à /mm³ : 5,7 G/L → 5 700 (bornes 4 000–11 000) ; 196 G/L → 196 000', eq(d.valeurs.leuco, { v: 5700, min: 4000, max: 11000 }) && eq(d.valeurs.plaquettes, { v: 196000, min: 150000, max: 400000 }), [d.valeurs.leuco, d.valeurs.plaquettes]);
v('  → un pourcentage SANS ligne « Soit » : valeur absolue calculée (5 700 × 53,7 % = 3 061), dite dans la source', d.valeurs.neutro.v === 3061 && /calculé/.test(d.sources.neutro) && d.valeurs.neutro.pct === undefined, [d.valeurs.neutro, d.sources.neutro]);
const d2 = SI.lireBilan('Polynucléaires Neutrophiles : 53.7 %', cat);
v('  → un pourcentage sans leucocytes ni « Soit » : rien d’inventé — rendu pour vérification', !d2.valeurs.neutro && d2.nonReconnues.length === 1, d2);
v('  → une vraie ligne inconnue reste signalée pour vérification', SI.lireBilan('Résultat étrange 12 unités\nHémoglobine 14,1 g/dL (13−18)', cat).nonReconnues.includes('Résultat étrange 12 unités'));

//  ── E. « à vérifier » : JS et PHP disent la même chose ──
const cas = [
  ['neutro', { v: 53.7, min: 1500, max: 7000 }], ['plaquettes', { v: 196 }], ['hb', { v: 14.7, min: 13, max: 18 }], ['hb', { v: 4.6, min: 13, max: 18 }],
  ['tg', { v: 25, max: 1.5 }], ['tg', { v: 2.17, max: 1.5 }], ['eos', { v: 0, min: 20, max: 630 }], ['hdl', { v: 0.03, min: 0.4 }], ['alat', { v: 27, max: 50 }],
];
const bilan = (o) => ({ date: '2026-10-12', valeurs: o });
const calc = Calc.creer({ catalogue: cat, aliments: {} });
const attendu = { neutro: 'suspect', plaquettes: 'suspect', 'hb:14.7': 'normal', 'hb:4.6': 'bas', 'tg:25': 'suspect', 'tg:2.17': 'haut', eos: 'bas', hdl: 'suspect', alat: 'normal' };
let paritéOk = true; const detail = [];
const phpCode = `require '${path.join(RACINE, 'sante/sante_lib.php')}'; $c = json_decode(file_get_contents('${path.join(RACINE, 'sante/biomarqueurs.json')}'), true); $GLOBALS['SANTE_CATALOGUE'] = $c; $cas = json_decode($argv[1], true); $o = []; foreach ($cas as [$k, $x]) $o[] = sante_statut(['date' => '2026-10-12', 'valeurs' => [$k => $x]], $k); echo json_encode($o);`;
let php = null; try { php = JSON.parse(execFileSync('php', ['-r', phpCode, JSON.stringify(cas)], { encoding: 'utf8' })); } catch (e) { detail.push(String(e).slice(0, 200)); }
const js = cas.map(([k, x]) => calc.statut(bilan({ [k]: x }), k));
cas.forEach(([k, x], i) => { const cle = k === 'hb' || k === 'tg' ? k + ':' + x.v : k; if (js[i] !== attendu[cle] || !php || php[i] !== js[i]) { paritéOk = false; detail.push([cle, js[i], php && php[i]]); } });
v('E. « à vérifier » (dix fois sous le bas ou au-dessus du haut de la norme) : pourcentage lu pour un nombre, autre unité — JS = PHP', paritéOk, detail);
v('  → un vrai résultat bas (hémoglobine 4,6 pour 13–18) reste « bas » ; un zéro (éosinophiles) n’est jamais « à vérifier » ; une bilirubine suspecte ne conclut pas à Gilbert',
  js[3] === 'bas' && js[6] === 'bas' && calc.gilbert(bilan({ bili_t: { v: 400, max: 14 }, asat: { v: 20 }, alat: { v: 20 }, ggt: { v: 20 } })).statut === 'incomplet');

//  ── F. Le catalogue ──
v('F. le catalogue : 53 biomarqueurs, 5 systèmes (rein, ionogramme & inflammation en plus) ; chaque clé a un libellé, une unité, un système',
  Object.keys(cat.marqueurs).length === 53 && Object.keys(cat.systemes).length === 5 && Object.values(cat.marqueurs).every(m => m.libelle && m.unite && cat.systemes[m.systeme]), Object.keys(cat.marqueurs).length);
console.log(ko === 0 ? `\n  ✅ TOUT PASSE — ${n} contrôles\n` : `\n  ❌ ${ko} contrôle(s) en échec sur ${n}\n`);
process.exit(ko === 0 ? 0 : 1);
