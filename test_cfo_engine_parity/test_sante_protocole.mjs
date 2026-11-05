/**
 * Santé Master — RANGER UN PROTOCOLE PAR RÈGLES (sante_protocole.js) : un protocole FICTIF au format d'un PDF extrait
 * (puces, partie en gras suivie d'espaces, titres à emoji, phrases coupées, tableaux en colonnes, pied de page), un
 * document de forme toute différente (style Word), et les leçons apprises des corrections. Aucune donnée réelle.
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const ICI = path.dirname(fileURLToPath(import.meta.url)), S = path.resolve(ICI, '..', 'sante');
const require = createRequire(import.meta.url);
const P = require(path.join(S, 'sante_protocole.js')), cat = require(path.join(S, 'biomarqueurs.json'));
let ko = 0, n = 0;
const v = (t, ok, d = '') => { n++; if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(78)} ${ok ? '' : (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600)}`); };
console.log('\n  SANTÉ MASTER — RANGER UN PROTOCOLE PAR RÈGLES\n  ' + '─'.repeat(80));

const V1 = `PROTOCOLE TEST — V1
 Personne Fictive — 50 ans
 SOMMAIRE
 •   1. Paramètres
 •   2. La journée heure par heure
1. Paramètres
 Apport cible   ~2000 kcal/jour
 Pas de jeûne : il supprimerait le petit-déjeuner.
2. La journée heure par heure
🌅  RÉVEIL — le créneau clé
 •   1 grand verre d’eau
 •   30 minutes de marche à jeun, en Zone 2.   Le levier principal sur les triglycérides : à jeun le glycogène
 est bas, et l’allure modérée brûle les graisses.
 •   Zone 2 = 100-120 bpm   (repère : parler sans chanter).
 •   Si une douleur apparaît :   ralentir, écourter ce jour-là
 seulement.
🍳  PETIT-DÉJEUNER — ~400 kcal | 25 g protéines
 •   2 œufs entiers
 •   40 g de pain d’orge
 Suppléments à la première bouchée :   Oméga-3 ×2 · Vitamine C 500 mg
☀️  DÉJEUNER — ~900 kcal | 40 g protéines
 •   12h30 :   2 gélules de fibres + 1 grand verre d’eau.
⚠    Rien d’autre à 12h30 — les fibres captent les gélules. Ce conflit-
 là est réel.
 Séquençage strict
 •   1. D’abord :   150 g de salade
 •   2. Ensuite :   150 g de poisson blanc
 •   13h30 :   marche post-prandiale 15 min. Non négociable.
🥛  17h00 — PARE-FEU — ~250 kcal | 20 g protéines
 •   150 g de skyr
 •   10 amandes
🌙  DÎNER 19h30 — ~350 kcal | 30 g protéines
 •   120 g de poulet
 •   Grand bol de soupe de légumes.   Zéro pomme de terre.
 Éviter la soupe en boîte.
 •   Brossage de dents   → fin de la fenêtre alimentaire.
🛏️  22h00 — COUCHER
 •   1 comprimé de magnésium.   Le soir uniquement.
3. Fiches compléments
 Chaque produit répond à trois questions.
🟢  Le noyau
 OMÉGA-3 (EPA + DHA)
 POURQUOI   Les triglycérides sont élevés.
 COMBIEN   2 capsules = 1000 mg. Vérifier l’étiquette.
 QUAND   Au petit-déjeuner, avec le repas.
 AIL NOIR (extrait)
 POURQUOI   Immunité.
 COMBIEN   1 capsule par jour.
 QUAND   Au petit-déjeuner.
 ⚠  Effet fluidifiant léger.
❌  Écartés — et pourquoi
 Produit   Raison de l’exclusion
 Levure de riz rouge   Interaction avec un autre complément. Jamais les deux
 ensemble.
📅  Tableau de synthèse — vue rapide
 Heure   Produit   Dose   Avec quoi
 Petit-déj   Oméga-3   2 caps   Pendant le repas
 13h00   — RIEN —   —   Fenêtre fibres
 1x/mois   Vitamine D3   1 ampoule   Repas gras
4. Alimentation
✅  À privilégier
 •   Légumes à volonté :   courgette, brocoli.
❌  À éviter
 •   Sucre rapide :   sodas, viennoiseries.
5. La règle du zéro grignotage
 AUCUNE PRISE ENTRE LES REPAS.
 Pourquoi c’est la règle la plus importante
 •   Chaque prise déclenche de l’insuline.
6. Leviers pratiques
 •   Se peser 1 fois par semaine,   même jour.
 •   Mesurer le tour de taille 1 fois par mois :   il bouge quand la balance stagne.
 •   Fromages gras :   2x/semaine maximum.
7. Activité physique
 Le socle quotidien
 •   30 min de marche à jeun en Zone 2 le matin   — le levier n°1.
 •   8 000 pas par jour au total (~3000 le matin + ~5000 dans la journée).
 Renforcement musculaire — débutant
 2 séances par semaine (mardi + vendredi), ~30 min. Charges légères.
 Machine   Séries × Reps   Repos
 Presse à cuisses   2 × 12   90 s
 Règles de sécurité
 •   Échauffement 5 min obligatoire avant chaque séance.
8. KPI — bilan à 3 mois
 Marqueur   Départ   Cible réaliste   Résultat
 Poids   ~95 kg   -4 à -6 kg   ____
 Triglycérides   2,10   <1,5   ____
 HDL   0,38   >0,42   ____
 Acide urique   72   <70 (sans  ____
 traitement)
 Testostérone LIBRE   jamais dosée   à doser   ____
9. Vigilance et sécurité
🔴  Prioritaire
 •   Dos :   URGENCE si faiblesse de la jambe.
 Document personnel — ne remplace pas le suivi médical.`;

const r = P.analyser(V1);
const par = (b) => r.elements.filter(e => e.bucket === b);
const A = par('action'), trouve = (re) => A.find(a => re.test(a.texte));
v('A. titre du document lu ; le sommaire et l’en-tête sont ignorés (pas de cases)', r.titre === 'PROTOCOLE TEST — V1' && par('ignorer').some(e => /SOMMAIRE/.test(e.texte)) && !A.some(a => /Paramètres|SOMMAIRE/.test(a.texte)), r.titre);
const marche = trouve(/marche à jeun/);
v('B. actions : libellé = la partie en gras, le reste en détail ; phrase coupée recollée', marche && marche.texte === '30 minutes de marche à jeun, en Zone 2' && /brûle les graisses/.test(marche.detail) && marche.moment === 'reveil', marche);
v('  → la définition (« Zone 2 = … ») va en détail de la marche, pas en case', /Zone 2 = 100-120 bpm/.test(marche.detail) && !A.some(a => /^Zone 2 =/.test(a.texte)));
v('  → la même marche citée dans « Activité » n’est pas comptée deux fois (fusionnée)', A.filter(a => /marche à jeun/i.test(a.texte)).length === 1);
const pdj = A.find(a => a.repas && a.moment === 'petit_dejeuner'), dej = A.find(a => a.repas && a.moment === 'dejeuner'), col = A.find(a => a.repas && a.moment === 'collation');
v('C. un repas = UNE case, le menu en détail (« Petit-déjeuner », « Déjeuner séquencé », « Collation « Pare-feu » »)', pdj && pdj.texte === 'Petit-déjeuner' && /2 œufs entiers/.test(pdj.detail) && /40 g de pain d’orge/.test(pdj.detail) && /~400 kcal/.test(pdj.detail)
  && dej && dej.texte === 'Déjeuner séquencé' && /150 g de poisson blanc/.test(dej.detail) && col && col.texte === 'Collation « Pare-feu »' && col.heure === '17:00', [pdj, dej, col]);
const fib = trouve(/gélules de fibres/), mpp = trouve(/marche post-prandiale/);
v('  → heures lues (« 12h30 : », « 13h30 : », titres « 17h00 », « Dîner 19h30 », « 22h00 »)', fib.heure === '12:30' && mpp.heure === '13:30' && trouve(/Brossage/).heure === '19:30' && trouve(/magnésium/).heure === '22:00' && trouve(/magnésium/).moment === 'coucher');
v('  → suppléments du repas : une case (« Suppléments à la première bouchée : … »)', trouve(/^Suppléments à la première bouchée : Oméga-3/) && trouve(/^Suppléments/).moment === 'petit_dejeuner');
const R = par('regle');
v('D. règles : « Si… », avertissement ⚠, « Pas de… » ; mot coupé recollé (« conflit-là »)', R.some(x => /^Si une douleur apparaît : ralentir, écourter ce jour-là seulement/.test(x.texte)) && R.some(x => /conflit-là est réel/.test(x.texte)) && R.some(x => /^Pas de jeûne/.test(x.texte)), R.map(x => x.texte));
v('  → « Zéro pomme de terre » reste dans le menu du dîner, pas une case à part', /Zéro pomme de terre/.test(A.find(a => a.repas && a.moment === 'diner').detail) && !A.some(a => /^Zéro pomme/.test(a.texte)));
const SUP = par('supplement'), om = SUP.find(x => /OMÉGA/.test(x.nom)), ail = SUP.find(x => /AIL NOIR/.test(x.nom));
v('E. suppléments : fiches POURQUOI / COMBIEN / QUAND (nom court en capitales compris)', om && om.dose === '2 capsules = 1000 mg' && /petit-déjeuner/.test(om.quand) && /triglycérides/.test(om.pourquoi) && ail && ail.dose === '1 capsule par jour' && /fluidifiant/.test(ail.notes), SUP);
v('  → le tableau de synthèse complète la fiche (pas de doublon) ; « RIEN » = règle ; 1x/mois = case mensuelle', SUP.filter(x => /om[eé]ga/i.test(x.nom)).length === 1 && R.some(x => /13h00 : Fenêtre fibres — rien à prendre/.test(x.texte)) && A.some(a => /Vitamine D3 : 1 ampoule/.test(a.texte) && a.frequence === 'mois'), SUP.map(x => x.nom));
v('  → produits écartés : règles « Écarté — … », ligne coupée du tableau recollée', R.some(x => /^Écarté — Levure de riz rouge : Interaction avec un autre complément\. Jamais les deux ensemble/.test(x.texte)));
v('F. « La règle du zéro grignotage » donne une case quotidienne ; ses « Pourquoi » sont ignorés', A.some(a => a.texte === 'Zéro grignotage respecté' && a.moment === 'journee') && par('ignorer').some(e => /déclenche de l’insuline/.test(e.texte)));
v('  → gestes périodiques : se peser 1×/semaine, tour de taille 1×/mois ; « 2x/semaine maximum » reste une règle', A.some(a => /^Se peser 1 fois par semaine/.test(a.texte) && a.frequence === 'semaine') && A.some(a => /^Mesurer le tour de taille/.test(a.texte) && a.frequence === 'mois') && R.some(x => /Fromages gras/.test(x.texte)));
const pas = trouve(/8 000 pas/), muscu = trouve(/Renforcement musculaire/);
v('G. « 8 000 pas par jour » : toute la journée (pas « le matin ») ; séance mardi + vendredi, machines en détail', pas.moment === 'journee' && muscu && muscu.texte.startsWith('Renforcement musculaire : 2 séances') && JSON.stringify(muscu.jours) === '["mardi","vendredi"]' && /Presse à cuisses · 2 × 12/.test(muscu.detail), [pas, muscu]);
v('  → « Règles de sécurité » de l’activité : des règles, pas des cases', R.some(x => /Échauffement 5 min/.test(x.texte)));
const OB = par('objectif'), res = (l) => P.resoudreObjectif(OB.find(o => o.libelle === l), cat);
v('H. objectifs : tableau Marqueur / Départ / Cible ; en-tête ignoré ; « -4 à -6 kg » garde son signe', OB.length === 5 && OB[0].libelle === 'Poids' && OB[0].cible === '-4 à -6 kg' && OB[0].depart === '~95 kg', OB);
v('  → cibles chiffrées reliées au catalogue : triglycérides < 1,5 ; HDL > 0,42 ; « Testostérone LIBRE » n’est pas la totale', JSON.stringify(res('Triglycérides')) === '{"cle":"tg","op":"<","v":1.5}' && JSON.stringify(res('HDL')) === '{"cle":"hdl","op":">","v":0.42}' && res('Testostérone LIBRE').cle === null && res('Acide urique').v === 70);
v('I. vigilance : règle ; le pied de page n’est jamais recollé à la dernière ligne', R.some(x => /^Dos : URGENCE si faiblesse de la jambe/.test(x.texte)) && par('ignorer').some(e => /^Document personnel/.test(e.texte)), R.slice(-2));
v('  → en tout : peu de cases (16 à 20), aucune explication dans les cases', A.length >= 16 && A.length <= 20 && !A.some(a => /^(Chaque|Pourquoi|Le levier|Les )/.test(a.texte)), A.map(a => a.texte));

//  un document de forme toute différente (style Word : paragraphes, tirets, Matin / Midi / Soir, lignes vides)
const W = `Programme bien-être — exemple fictif

Matin
- Au réveil : un grand verre d'eau tiède
- Marche rapide 30 minutes
Pourquoi : bouger à jeun réveille le métabolisme.

Midi
- Assiette équilibrée : moitié légumes, un quart protéines
- 10 minutes de marche après le repas

Après-midi
- Collation : 1 yaourt nature et 10 amandes

Soir
- Dîner léger : soupe et poisson
- Pas d'écran après 22h
- Coucher avant 23h

Chaque semaine
- Natation le mercredi et le samedi (45 min)
- Se peser une fois par semaine

À éviter
- Sodas et jus de fruits`;
const w = P.analyser(W), wa = w.elements.filter(e => e.bucket === 'action'), wr = w.elements.filter(e => e.bucket === 'regle');
const m = (re) => wa.find(a => re.test(a.texte));
v('J. autre structure (Word) : titres courts jamais recollés, lignes vides respectées, moments lus', w.titre === 'Programme bien-être — exemple fictif' && m(/Marche rapide/).moment === 'matin' && m(/Collation/).moment === 'apres_midi' && m(/Coucher/).moment === 'soir' && wa.find(a => a.repas && a.moment === 'dejeuner'), wa.map(a => a.moment + ' ' + a.texte));
v('  → natation mercredi + samedi (45 min) ; pesée 1×/semaine ; « Pas d’écran » et « À éviter » = règles', JSON.stringify(m(/Natation/).jours) === '["mercredi","samedi"]' && m(/Natation/).duree_min === 45 && m(/Se peser/).frequence === 'semaine'
  && wr.some(x => /Pas d'écran/.test(x.texte)) && wr.some(x => /Sodas/.test(x.texte)) && /bouger à jeun/.test(m(/Marche rapide/).detail), [wr, m(/Natation/)]);

//  les leçons : une correction appliquée d'office au prochain import
const cleSecu = r.elements.find(e => /Échauffement/.test(e.texte)).cle, cleMuscu = muscu.cle;
const r2 = P.analyser(V1, { lecons: [{ cle: cleSecu, bucket: 'action', moment: 'matin' }, { cle: cleMuscu, texte: 'Machines (30 min)' }, { cle: trouve(/grand verre/).cle, bucket: 'ignorer' }] });
const secu2 = r2.elements.find(e => e.cle === cleSecu), muscu2 = r2.elements.find(e => e.cle === cleMuscu);
v('K. leçons apprises : la règle passée en case (au matin), le libellé corrigé, la ligne supprimée → ignorée', secu2.bucket === 'action' && secu2.moment === 'matin' && secu2.appris && muscu2.texte === 'Machines (30 min)' && r2.elements.find(e => /grand verre/.test(e.texte)).bucket === 'ignorer', [secu2, muscu2]);
v('  → sans leçon, rien n’est marqué « appris »', !r.elements.some(e => e.appris));
console.log(ko === 0 ? `\n  ✅ TOUT PASSE — ${n} contrôles` : `\n  ❌ ${ko} contrôle(s) en échec sur ${n}`);
process.exit(ko === 0 ? 0 : 1);
