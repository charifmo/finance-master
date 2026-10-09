<?php
declare(strict_types=1);
/**
 * v37.38 — LE GARDE-MÉMOIRE : DÉCOUPER, RECONNAÎTRE, NE RIEN OUBLIER.
 *
 *   Le signalement : « mémorise ces deux actifs » — le CFO écrit l'Actif Nord,
 *   oublie l'Actif Est / Al Ouidane, et affirme avoir tout mémorisé.
 *
 *   Cette suite verrouille la partie déterministe du garde-fou, celle qui se
 *   rejoue sans base : reconnaître une demande (et un refus), la découper en
 *   entités, et dire pour chacune si la mémoire la contient déjà. La suite
 *   navigateur + PostgreSQL (test_garde_memoire.mjs) joue l'écriture réelle.
 */
require_once __DIR__ . '/../cfo_memoire_lib.php';

$ko = 0; $n = 0;
function v(string $titre, bool $ok, string $detail = ''): void {
    global $ko, $n; $n++; if (!$ok) $ko++;
    printf("  %s %-70s %s\n", $ok ? '✅' : '❌', $titre, $ok ? '' : $detail);
}
$statuts = fn(array $p) => array_map(fn($e) => $e['titre'] . '=' . $e['statut'], $p['entites']);
$j = fn($x) => json_encode($x, JSON_UNESCAPED_UNICODE);

echo "\n  GARDE-MÉMOIRE — demandes, entités, recouvrement\n  " . str_repeat('─', 84) . "\n";

$NORD = "L'Actif Nord (Ouahat Sidi Brahim) est un terrain de 7 hectares situé en zone SHL2 le long de la RN9, près de Marrakech, détenu en indivision à 35 %.";
$memoire = ['u-nord' => $NORD];

/* ── 1. Le cas du signalement ──────────────────────────────────────────── */
$q = "Mémorise ces deux actifs :\n"
   . "Actif Nord (Ouahat Sidi Brahim) : terrain de 7 hectares en zone SHL2 sur la RN9, titre foncier, indivision 35 %.\n"
   . "Actif Est / Al Ouidane : terrain agricole de 3 ha sur la route d'Al Ouidane, près de Marrakech, sur la RN9, non constructible en attente du SDAU.";
$p = cfo_gm_plan($q, "J'ai bien mémorisé les deux actifs.", $memoire);
v('la demande est reconnue (verbe explicite)', $p['demande'] && $p['source'] === 'declencheur', $j($p));
v('deux entités, ni plus ni moins (l\'en-tête « ces deux actifs » n\'en est pas une)', count($p['entites']) === 2, $j($statuts($p)));
v('Actif Nord : déjà en mémoire (le CFO l\'a écrit)', ($p['entites'][0]['statut'] ?? '') === 'en_memoire' && $p['entites'][0]['regle_id'] === 'u-nord', $j($p['entites'][0] ?? null));
v('Actif Est / Al Ouidane : À ÉCRIRE — c\'est l\'oubli du CFO', ($p['entites'][1]['statut'] ?? '') === 'a_ecrire', $j($p['entites'][1] ?? null));
v('  → titre du reçu : « Actif Est / Al Ouidane »', ($p['entites'][1]['titre'] ?? '') === 'Actif Est / Al Ouidane', $p['entites'][1]['titre'] ?? '');
v('  → le texte écrit est celui de l\'utilisateur, complet', str_contains($p['entites'][1]['a_ecrire'] ?? '', 'non constructible en attente du SDAU'), $p['entites'][1]['a_ecrire'] ?? '');
v('  → catégorie contexte', ($p['entites'][1]['categorie'] ?? '') === 'contexte');

/* ── 2. Le recouvrement ne se laisse pas tromper par les mots communs ──── */
$est = $p['entites'][1]['texte'];
v('« terrain », « RN9 », « Marrakech » en commun ne couvrent pas l\'Actif Est', cfo_gm_recouvrement($est, $NORD) === 0.0, (string)cfo_gm_recouvrement($est, $NORD));
v('« le terrain est situé » n\'est pas l\'Actif Est', !cfo_gm_identite_ok(cfo_gm_identite('Actif Est : 3 ha'), 'Le terrain est situé sur la RN9.'));
v('« l\'Actif Est » l\'est, même reformulé', cfo_gm_identite_ok(cfo_gm_identite('Actif Est : 3 ha'), "Je possède aussi l'Actif Est, un terrain agricole."));
v('le nom propre suffit (« le terrain d\'Al Ouidane »)', cfo_gm_identite_ok(cfo_gm_identite('Actif Est / Al Ouidane : 3 ha'), "Le terrain d'Al Ouidane fait 3 ha."));
$pref = 'Je préfère louer des Airbnb plutôt que des hôtels';
$deux = ['Je préfère les hôtels de luxe à Marrakech.', 'Le studio Airbnb se loue bien : louer en été rapporte 3 000 DH.'];
v('deux règles qui en couvrent chacune un morceau ne la couvrent pas (max, pas union)',
  cfo_gm_meilleur($pref, $deux)['taux'] < CFO_GM_SEUIL && cfo_gm_plan('Retiens que ' . lcfirst($pref), '', $deux)['entites'][0]['statut'] === 'a_ecrire',
  (string)cfo_gm_meilleur($pref, $deux)['taux']);
$reform = "L'Actif Est (Al Ouidane) est un terrain agricole de 3 ha, route d'Al Ouidane près de Marrakech, sur la RN9, non constructible tant que le SDAU n'est pas publié.";
v('une reformulation fidèle du CFO couvre l\'entité', cfo_gm_recouvrement($est, $reform) >= CFO_GM_SEUIL, (string)cfo_gm_recouvrement($est, $reform));
v('« 70 000 m² » et « 70000 m2 » sont le même nombre', cfo_gm_recouvrement('Terrain Sud : 70 000 m² à Tit Mellil', 'Le Terrain Sud fait 70000 m2 à Tit Mellil') === 1.0);

/* ── 3. Les formes d'une demande ──────────────────────────────────────── */
$p = cfo_gm_plan("Retiens que l'Actif Nord fait 7 hectares en zone SHL2 sur la RN9, et l'Actif Est / Al Ouidane fait 3 ha en zone agricole sur la route d'Ourika.", '', $memoire);
v('un paragraphe qui nomme deux actifs est coupé en deux', count($p['entites']) === 2, $j($statuts($p)));
v('  → Nord couvert, Est à écrire', ($p['entites'][0]['statut'] ?? '') === 'en_memoire' && ($p['entites'][1]['statut'] ?? '') === 'a_ecrire', $j($statuts($p)));
v('  → le texte écrit commence par une majuscule', str_starts_with($p['entites'][1]['a_ecrire'] ?? '', "L'Actif Est"), $p['entites'][1]['a_ecrire'] ?? '');

$p = cfo_gm_plan("Mémorise que l'Actif Nord fait 7 ha et qu'il est situé à côté du Terrain Est de mon frère, sur la RN9.", '', []);
v('une simple mention (« à côté du Terrain Est ») ne coupe pas', count($p['entites']) === 1, $j($statuts($p)));
$p = cfo_gm_plan("Mémorise : l'Actif Nord fait 7 ha. L'Actif Nord est en zone SHL2 sur la RN9.", '', []);
v('la même entité nommée deux fois reste UNE entité', count($p['entites']) === 1, $j($statuts($p)));

$p = cfo_gm_plan("J'ai deux terrains en indivision à 35 % avec mes frères :\nTerrain Nord : 7 ha, SHL2, RN9.\nTerrain Est : 3 ha agricole, Al Ouidane.\nMémorise tout ça stp", '', []);
v('verbe à la FIN : la charge est ce qui précède', count($p['entites']) === 2, $j($statuts($p)));
v('  → l\'en-tête porteur d\'information préfixe chaque écriture', str_starts_with($p['entites'][1]['a_ecrire'] ?? '', "J'ai deux terrains en indivision à 35 %"), $p['entites'][1]['a_ecrire'] ?? '');

$p = cfo_gm_plan("Mémorise :\n- je préfère louer des Airbnb plutôt que des hôtels\n- mon plafond restaurant est de 2 000 DH par mois", '', []);
v('des puces libres sont des faits distincts', count($p['entites']) === 2, $j($statuts($p)));
v('  → préférence / règle', ($p['entites'][0]['categorie'] ?? '') === 'preference' && ($p['entites'][1]['categorie'] ?? '') === 'regle', $j(array_column($p['entites'], 'categorie')));
$p = cfo_gm_plan("Mémorise l'Actif Nord :\n- superficie 7 hectares\n- zone SHL2\n- sur la RN9, titre foncier", '', []);
v('des puces SOUS une entité en sont les détails (une seule entité)', count($p['entites']) === 1 && str_contains($p['entites'][0]['texte'], 'titre foncier'), $j($p['entites']));

$p = cfo_gm_plan("Peux-tu mémoriser que mon plafond resto est de 2 000 DH par mois ?", '', []);
v('demande polie terminée par « ? » : écrite, sans le « ? »', count($p['entites']) === 1 && ($p['entites'][0]['a_ecrire'] ?? '') === 'Mon plafond resto est de 2 000 DH par mois', $j($p['entites']));
$p = cfo_gm_plan("Retiens que je préfère louer des Airbnb plutôt que des hôtels", '', ['x' => 'Je préfère louer des Airbnb plutôt que des hôtels.']);
v('une préférence déjà mémorisée n\'est pas réécrite', ($p['entites'][0]['statut'] ?? '') === 'en_memoire', $j($p));

/* ── 4. Ce qui n'est PAS une demande ──────────────────────────────────── */
v('« ne mémorise pas ça » est un refus', !cfo_gm_plan("Ne mémorise pas ça, c'est juste une idée : acheter un terrain de 500 m² à Bouskoura.", '', [])['demande']);
v('« n\'enregistre pas ça en mémoire » aussi', cfo_gm_declencheur("N'enregistre pas ça en mémoire") === null);
v('« ne mémorise jamais ça » aussi (coupe UTF-8 sûre)', cfo_gm_declencheur("Ne mémorise jamais ça, c'était une hypothèse.") === null);
v('« retiens-tu mes plafonds ? » est une question', cfo_gm_declencheur('Retiens-tu mes plafonds ?') === null);
v('« qu\'as-tu mémorisé ? » n\'est pas une demande', !cfo_gm_plan("Qu'as-tu mémorisé sur mes terrains ?", '', [])['demande']);
$p = cfo_gm_plan("Qu'as-tu mémorisé sur mes terrains ?", "J'ai mémorisé l'Actif Nord.", []);
v('… même si le CFO répond « j\'ai mémorisé » : une question ne s\'écrit pas', $p['entites'] === [], $j($p));
v('« C\'est noté, 150 DH en Restauration » n\'est pas une mémorisation', !cfo_gm_revendique("C'est noté, j'ai ajouté 150 DH en Restauration."));
v('« selon votre règle mémorisée » cite la mémoire, n\'y écrit rien', !cfo_gm_revendique("Selon votre règle mémorisée sur l'épargne, je propose 3 000 DH par mois."));
v('… donc une demande ordinaire n\'est pas mémorisée pour autant',
  !cfo_gm_plan("Je vais acheter une voiture à 200 000 DH en 2027 avec un crédit sur 5 ans, prépare le plan de financement.",
               "Selon votre règle mémorisée sur l'épargne, voici le plan.", [])['demande']);
foreach (["J'ai bien mémorisé les deux actifs.", "C'est mémorisé ✓", "Les deux actifs sont désormais mémorisés.", "Mémorisé.", "J'ai enregistré cette information dans ma mémoire."] as $r)
    v('« ' . $r . ' » est une affirmation d\'écriture', cfo_gm_revendique($r));
/* Les formulations RÉELLES de l'échange signalé (captures du 09/10/2026) */
v('réponse réelle : « Mémorisation confirmée dans la base de connaissances (RAG) »',
  cfo_gm_revendique('<b>Mémorisation confirmée dans la base de connaissances (RAG).</b><br>L\'ensemble des caractéristiques pour l\'Actif Nord et l\'Actif Est (Al Ouidane) a été consigné dans votre référentiel patrimonial permanent.'));
foreach (['… susceptible de multiplier la valeur du terrain. Tout ça est à stocker dans le rag.', 'Stocke ces deux fiches dans le RAG.',
          'Ajoute ces informations à ta mémoire.', 'Enregistre tout ça dans ta base de connaissances.', 'Mets ça dans ta mémoire stp'] as $q)
    v('demande réelle : « ' . mb_substr($q, -45) . ' »', cfo_gm_declencheur($q) !== null);
$p = cfo_gm_plan("Actif Nord (Ouahat Sidi Brahim) : TF 9479/M, superficie 20 ha, quote-part 35 % soit 7 ha nets, bande RN9 en zone SHL2.\n"
               . "Actif Est (Al Ouidane) : 3 hectares, quote-part 35 %, zonage RA agricole, catalyseur barrage Ait Zyat.\nÀ stocker dans le rag.",
                 '<b>Mémorisation confirmée dans la base de connaissances (RAG).</b>', $memoire);
v('… l\'échange réel : Nord en mémoire, Est à écrire', $statuts($p) === ['Actif Nord (Ouahat Sidi Brahim)=en_memoire', 'Actif Est (Al Ouidane)=a_ecrire'], $j($statuts($p)));
v('« ajoute 500 DH en restauration » n\'est pas une mémorisation', cfo_gm_declencheur('Ajoute 500 DH en restauration pour ce mois.') === null);
v('« je dois retenir 30 % de mon salaire » n\'est pas une demande', cfo_gm_declencheur("Je dois retenir 30 % de mon salaire chaque mois pour l'épargne.") === null);
v('« peux-tu retenir que… » en est une', cfo_gm_declencheur("Peux-tu retenir que mon loyer passe à 6 000 DH en janvier ?") !== null);
v('« je note que tu as oublié… » n\'en est pas une', cfo_gm_declencheur("Je note que tu as oublié la taxe d'habitation de 2 400 DH.") === null);
v('« je n\'ai pas pu mémoriser » non plus', !cfo_gm_revendique("Désolé, je n'ai pas pu mémoriser cette information."));
$mi = "MISSION — Recherche Éclair (lecture seule) : veille de marché CIBLÉE. FICHE MÉMORISÉE — ta mémoire (RAG), citée telle quelle. "
    . "LECTURE SEULE : aucun propose_changes, aucun committer, aucun memory_writer.";
v('la question de la Recherche Éclair ne déclenche rien', cfo_gm_declencheur($mi) === null);

/* ── 5. Sans verbe, une affirmation du CFO suffit — pour un vrai contenu ── */
$p = cfo_gm_plan("Voici mon Terrain Sud : 2 hectares à Tit Mellil, zone industrielle, titre foncier, loué 4 000 DH par mois à un ferrailleur.",
                 "Parfait, j'ai bien mémorisé votre Terrain Sud.", []);
v('le CFO affirme « mémorisé » sans avoir écrit : l\'entité est à écrire', $p['demande'] && $p['source'] === 'revendication' && ($p['entites'][0]['statut'] ?? '') === 'a_ecrire', $j($p));

/* ── 6. Décisions de l'utilisateur et consigne de l'application ───────── */
$p = cfo_gm_plan("Mémorise que mon plafond resto est de 1 500 DH par mois", '', [], ['Mon plafond resto est de 1 500 DH par mois.']);
v('une règle effacée depuis la Supervision IA n\'est jamais ressuscitée', ($p['entites'][0]['statut'] ?? '') === 'supprimee', $j($p));
$avec = "Mémorise ces deux actifs :\nActif Nord : 7 ha en SHL2.\nActif Est / Al Ouidane : 3 ha agricole."
      . "\n\n⟦GARDE-MÉMOIRE⟧ Consigne de l'application, à appliquer sans la citer : appelle memory_writer UNE FOIS PAR ENTITÉ (superficie, zonage, prix, dates). ⟦/GARDE-MÉMOIRE⟧";
$sans = "Mémorise ces deux actifs :\nActif Nord : 7 ha en SHL2.\nActif Est / Al Ouidane : 3 ha agricole.";
v('la consigne ajoutée par l\'application est ignorée par l\'analyse', $j(cfo_gm_plan($avec, '', [])) === $j(cfo_gm_plan($sans, '', [])));
v('… et retirée du texte affiché', cfo_gm_sans_consigne($avec) === $sans);

echo "  " . str_repeat('─', 84) . "\n";
echo $ko === 0 ? "  ✅ TOUT PASSE — $n contrôles\n" : "  ❌ $ko contrôle(s) en échec sur $n\n";
exit($ko === 0 ? 0 : 1);
