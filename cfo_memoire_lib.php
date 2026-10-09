<?php
declare(strict_types=1);
/**
 * ============================================================================
 *  cfo_memoire_lib.php — GARDE-MÉMOIRE (v37.38), la partie sans base de données
 * ----------------------------------------------------------------------------
 *  LE CONSTAT : « mémorise ces deux actifs : Actif Nord … Actif Est / Al
 *  Ouidane … ». Le CFO répond « j'ai mémorisé les deux » — la Supervision IA
 *  ne montre que l'Actif Nord. Le modèle a appelé memory_writer UNE fois, puis
 *  a rédigé une réponse qui affirmait le contraire. Rien, nulle part, ne
 *  confrontait l'affirmation à la base.
 *
 *  LA RÈGLE : ce qui garantit une écriture ne peut pas être le modèle qui l'a
 *  oubliée. Le modèle reste le premier rédacteur — il reformule mieux qu'un
 *  programme — mais un contrôle DÉTERMINISTE relit la demande, la découpe en
 *  entités, cherche chacune dans finance_vectors et écrit celles qui manquent.
 *
 *  Ce fichier ne contient que des fonctions pures (aucune E/S) : elles sont
 *  rejouables sans base, et la suite test_garde_memoire.php les verrouille.
 *  L'endpoint cfo_memoire_garde.php fait les lectures et les écritures.
 * ============================================================================
 */

/** La consigne que l'application ajoute à une demande de mémorisation (v37.38).
 *  Elle voyage jusqu'à chat_history : on la retire avant toute analyse. */
const CFO_GM_CONSIGNE_RE = '/\s*⟦GARDE-MÉMOIRE⟧.*?⟦\/GARDE-MÉMOIRE⟧\s*/su';

/** Au-dessus de ce taux de recouvrement, une entité est « déjà en mémoire ». */
const CFO_GM_SEUIL = 0.5;

/** Les mots qui désignent une ENTITÉ du patrimoine, suivis de son nom propre. */
const CFO_GM_MOTS_ENTITE = 'actif|terrain|foncier|lot|parcelle|bien|local|villa|appartement|appart|studio|maison|immeuble|ferme|lotissement';
/** Les mêmes, plus ceux qui situent (pour reconnaître « zone Nord »). */
const CFO_GM_MOTS_LIEU = CFO_GM_MOTS_ENTITE . '|zone|site|secteur';
const CFO_GM_CARDINAUX = ['nord', 'sud', 'est', 'ouest', 'centre'];

/** Mots fréquents ou génériques : ils ne disent pas DE QUOI parle un bloc. */
const CFO_GM_VIDES = [
    'memorise', 'memoriser', 'memorisez', 'retiens', 'retenir', 'souviens', 'rappelle', 'garde', 'memoire',
    'enregistre', 'sauvegarde', 'actif', 'actifs', 'terrain', 'terrains', 'foncier', 'fonciers', 'biens',
    'information', 'informations', 'infos', 'suivant', 'suivante', 'suivants', 'suivantes', 'concernant',
    'environ', 'situe', 'situee', 'avoir', 'faire', 'cette', 'comme', 'aussi', 'toujours', 'jamais', 'parce',
    'quand', 'entre', 'selon', 'chaque', 'autre', 'autres', 'notre', 'votre', 'leurs', 'elles', 'ainsi',
    'alors', 'apres', 'avant', 'depuis', 'encore', 'moins', 'toute', 'toutes', 'etait', 'seront', 'serait',
    'pourrait', 'devrait', 'dessus', 'dessous', 'plusieurs', 'beaucoup', 'vraiment', 'surtout', 'merci',
    'egalement', 'actuellement', 'actuel', 'actuelle', 'total', 'totale', 'premier', 'premiere', 'second',
    'seconde', 'trois', 'quatre', 'possede', 'possedes', 'detiens', 'nommes', 'appele', 'appelle', 'ensuite',
];

/* ── Normalisation ─────────────────────────────────────────────────────────── */

function cfo_gm_sans_consigne(string $t): string {
    return trim((string)preg_replace(CFO_GM_CONSIGNE_RE, ' ', $t));
}

/** Minuscules, sans accents, nombres unifiés (« 70 000 » → 70000, « 1,2 » → 1.2). */
function cfo_gm_norm(string $t): string {
    $t = mb_strtolower($t, 'UTF-8');
    $t = strtr($t, [
        'à'=>'a','â'=>'a','ä'=>'a','á'=>'a','ã'=>'a','é'=>'e','è'=>'e','ê'=>'e','ë'=>'e','î'=>'i','ï'=>'i',
        'í'=>'i','ô'=>'o','ö'=>'o','ó'=>'o','ù'=>'u','û'=>'u','ü'=>'u','ú'=>'u','ç'=>'c','ÿ'=>'y','ñ'=>'n',
        'œ'=>'oe','æ'=>'ae','’'=>"'",'²'=>'2',
    ]);
    do {
        $avant = $t;
        $t = (string)preg_replace('/(?<=\d)[ \x{00A0}\x{202F}.](?=\d{3}(?!\d))/u', '', $t);
    } while ($t !== $avant);
    return (string)preg_replace('/(?<=\d),(?=\d)/u', '.', $t);
}

/** Jetons d'un texte normalisé : nombres (décimaux compris), mots, codes (SHL2, RN9, R+1). */
function cfo_gm_jetons(string $norm): array {
    preg_match_all('/\p{N}+(?:\.\p{N}+)?|[\p{L}\p{N}]+(?:\+\p{N}+)?/u', $norm, $m);
    return $m[0];
}

/** Tous les jetons d'un texte, en ensemble. */
function cfo_gm_tous(string $texte): array {
    return array_fill_keys(cfo_gm_jetons(cfo_gm_norm($texte)), true);
}

/**
 * Les jetons FORTS d'un bloc — ceux qui disent de quoi il parle : nombres et
 * codes, mots d'au moins 5 lettres hors mots vides, noms propres courts en
 * milieu de phrase. Les points cardinaux en sont exclus : « Est » se confond
 * avec le verbe ; il est vérifié à part, comme identité.
 */
function cfo_gm_forts(string $bloc): array {
    $forts = [];
    foreach (cfo_gm_jetons(cfo_gm_norm($bloc)) as $j) {
        if (in_array($j, CFO_GM_CARDINAUX, true)) continue;
        if (preg_match('/\p{N}/u', $j)) { $forts[$j] = true; continue; }
        if (mb_strlen($j) >= 5 && !in_array($j, CFO_GM_VIDES, true)) $forts[$j] = true;
    }
    preg_match_all('/[\p{L}\p{N}]+/u', $bloc, $m, PREG_OFFSET_CAPTURE);
    foreach ($m[0] as $i => [$mot, $pos]) {
        if ($i === 0 || !preg_match('/^\p{Lu}\p{Ll}{2,3}$/u', $mot)) continue;
        $avant = rtrim(substr($bloc, 0, $pos));
        if ($avant === '' || preg_match('/[.!?:]$/u', $avant)) continue;      // début de phrase
        $n = cfo_gm_norm($mot);
        if (!in_array($n, CFO_GM_CARDINAUX, true) && !in_array($n, CFO_GM_VIDES, true)) $forts[$n] = true;
    }
    return $forts;
}

/* ── Identité d'une entité ─────────────────────────────────────────────────── */

/**
 * « Actif Est / Al Ouidane : … » → [Est (cardinal), Ouidane]. Le nom s'arrête au
 * premier mot en minuscules qui n'est pas un connecteur (de, al, sidi…). Vide
 * si le bloc ne COMMENCE pas par une entité (au-delà de $maxDebut octets).
 */
function cfo_gm_identite(string $bloc, int $maxDebut = 60): array {
    $tete = substr($bloc, 0, 400);
    if (!preg_match('/(?<![\p{L}])(?:[Ll][\'’])?(?i:' . CFO_GM_MOTS_ENTITE . ')s?\s+(?=[\p{Lu}\p{N}«"(])/u',
                    $tete, $m, PREG_OFFSET_CAPTURE)) return [];
    if ($m[0][1] > $maxDebut) return [];
    $reste = substr($tete, $m[0][1] + strlen($m[0][0]));
    $reste = preg_split('/[:\n,;.!?]/u', $reste)[0];
    $ids = [];
    foreach (preg_split('/\s+/u', trim($reste)) as $w) {
        $mot = trim($w, "()«»\"'/–-");
        if ($mot === '') continue;
        $n = cfo_gm_norm($mot);
        $connecteur = in_array($n, ['de', 'du', 'des', 'd', 'el', 'al', 'ait', 'ben', 'et', 'la', 'le', 'les', 'l'], true);
        if (!$connecteur && !preg_match('/^[\p{Lu}\p{N}]/u', $mot) && $w[0] !== '(') break;
        if ($connecteur || mb_strlen($n) < 2) continue;
        $ids[] = ['brut' => $mot, 'norm' => $n, 'cardinal' => in_array($n, CFO_GM_CARDINAUX, true)];
        if (count($ids) >= 6) break;
    }
    return $ids;
}

/** Le texte parle-t-il de CETTE entité ? Un cardinal compte s'il suit un mot de
 *  lieu, avec sa majuscule (« Actif Est », jamais « le terrain est ») ; un nom
 *  propre compte partout. Sans identité, rien à vérifier. */
function cfo_gm_identite_ok(array $ids, string $texte): bool {
    if (!$ids) return true;
    $norm = null;
    foreach ($ids as $id) {
        if ($id['cardinal']) {
            if (preg_match('/(?i:' . CFO_GM_MOTS_LIEU . ')s?\s+' . preg_quote($id['brut'], '/') . '(?![\p{L}])/u', $texte)) return true;
            continue;
        }
        if (mb_strlen($id['norm']) < 3) continue;
        $norm = $norm ?? cfo_gm_norm($texte);
        if (preg_match('/(?<![\p{L}\p{N}])' . preg_quote($id['norm'], '/') . '(?![\p{L}\p{N}])/u', $norm)) return true;
    }
    return false;
}

/** Recouvrement d'un bloc par UN texte mémorisé, entre 0 et 1. */
function cfo_gm_recouvrement(string $bloc, string $texte, ?array $ids = null, ?array $forts = null): float {
    $ids = $ids ?? cfo_gm_identite($bloc);
    if (!cfo_gm_identite_ok($ids, $texte)) return 0.0;
    $forts = $forts ?? cfo_gm_forts($bloc);
    if (!$forts) return 0.0;
    $tous = cfo_gm_tous($texte);
    $n = 0;
    foreach ($forts as $j => $_) if (isset($tous[$j])) $n++;
    return $n / count($forts);
}

/** Le meilleur texte pour ce bloc : ['taux' => …, 'index' => …]. Max, jamais
 *  l'union : deux règles qui partagent « terrain », « RN9 » et « Marrakech »
 *  ne couvrent pas à elles deux un actif qu'aucune ne nomme. */
function cfo_gm_meilleur(string $bloc, array $textes): array {
    $ids = cfo_gm_identite($bloc); $forts = cfo_gm_forts($bloc);
    $best = ['taux' => 0.0, 'index' => null];
    foreach ($textes as $i => $t) {
        $r = cfo_gm_recouvrement($bloc, (string)$t, $ids, $forts);
        if ($r > $best['taux']) $best = ['taux' => $r, 'index' => $i];
    }
    return $best;
}

/* ── La demande ────────────────────────────────────────────────────────────── */

/**
 * Le déclencheur explicite (« mémorise », « retiens », « souviens-toi »…), non
 * nié et non interrogatif. Renvoie [position, longueur] en octets, ou null.
 */
function cfo_gm_declencheur(string $q): ?array {
    $re = '/(?<![\p{L}])(?:'
        . 'm[ée]moris(?:e|es|ez|er|ons)(?![\p{L}])'
        . '|retiens(?![\p{L}])(?![\s\-]*tu(?![\p{L}]))'
        . '|retenir\s+(?:que|qu[\'’]|ceci|cela|[çc]a|bien|ces?\s)'
        . '|souviens[\s\-]+toi(?![\p{L}])'
        . '|rappelle[\s\-]+toi(?![\p{L}])'
        . '|garde[sz]?\s+(?:[çc]a\s+|cela\s+|ceci\s+|bien\s+|les\s+\p{L}+\s+|ces\s+\p{L}+\s+)?en\s+(?:m[ée]moire|t[êe]te)(?![\p{L}])'
        . '|n[\'’]oublie\s+pas\s+que(?![\p{L}])'
        . '|(?<!je\s)prends?\s+(?:bonne\s+)?note(?![\p{L}])'
        . '|(?<!je\s)note\s+(?:que|bien|pour\s+(?:le\s+)?futur)(?![\p{L}])'
        . '|(?:enregistr|sauvegard|ajout|stock|consign|mets|met|place)(?:e|es|ez|er|[ée]|[ée]e|[ée]s|[ée]es)?(?:[\s\-]+(?:le|la|les|[çc]a|cela|ceci|tout))?\s+(?:[^.\n?]{0,40}\s)?(?:dans|en|[àa]u?)\s+(?:ta\s+|la\s+|ma\s+|le\s+|votre\s+)?(?:m[ée]moire|base\s+de\s+connaissances?|rag|r[ée]f[ée]rentiel)(?![\p{L}])'
        . ')/iu';
    if (!preg_match_all($re, $q, $m, PREG_OFFSET_CAPTURE)) return null;
    foreach ($m[0] as [$mot, $pos]) {
        // mb_strcut : une coupe au milieu d'un « é » rendrait la chaîne invalide, et
        // preg_match /u échouerait en silence — la négation passerait inaperçue
        $avant = mb_strcut($q, max(0, $pos - 14), min(14, $pos), 'UTF-8');
        // la négation suit le VERBE (« n'enregistre pas ça en mémoire »), pas la fin du motif
        $verbe = preg_match('/^[^\s\-]+/u', $mot, $mv) ? $mv[0] : $mot;
        $apres = mb_strcut($q, $pos + strlen($verbe), 16, 'UTF-8');
        // « ne mémorise pas », « n'enregistre jamais » : un refus n'est pas une demande
        if (preg_match('/(?:^|\s)(?:ne|n[\'’])\s*$/iu', $avant) && preg_match('/^\s+(?:pas|plus|jamais|rien)(?![\p{L}])/iu', $apres)) continue;
        return [$pos, strlen($mot)];
    }
    return null;
}

/** Ce que l'IA affirme AVOIR mémorisé (« j'ai bien mémorisé… », « c'est mémorisé »,
 *  « sont désormais mémorisés ») — pas « selon votre règle mémorisée », qui
 *  cite la mémoire sans rien y ajouter, ni un échec avoué. */
function cfo_gm_revendique(string $html): bool {
    $t = html_entity_decode(strip_tags(str_replace(['<br>', '<br/>', '<br />', '</li>', '</p>'], "\n", $html)), ENT_QUOTES, 'UTF-8');
    $ecrit = 'm[ée]moris[ée]e?s?|enregistr[ée]e?s?\s+(?:[^.\n]{0,40}\s)?(?:en|dans)\s+(?:ma\s+|la\s+)?m[ée]moire|ajout[ée]e?s?\s+(?:[^.\n]{0,40}\s)?[àa]\s+(?:ma|la)\s+m[ée]moire';
    if (!preg_match('/(?:j[\'’]ai\s+(?:\p{L}+ment\s+|bien\s+|donc\s+|aussi\s+)?(?:' . $ecrit . '|retenu|not[ée]\s+dans\s+ma\s+m[ée]moire)'
                  . '|c[\'’]est\s+(?:bien\s+|d[ée]sormais\s+)?(?:' . $ecrit . ')'
                  . '|(?:est|sont|a\s+[ée]t[ée]|ont\s+[ée]t[ée])\s+(?:bien\s+|d[ée]sormais\s+|maintenant\s+)?(?:' . $ecrit . ')'
                  . '|m[ée]morisation\s+(?:confirm[ée]e|effectu[ée]e|r[ée]ussie|enregistr[ée]e)'
                  . '|(?:consign|enregistr|stock|sauvegard|int[ée]gr|ajout)[ée]e?s?\s+(?:[^.\n]{0,40}\s)?(?:dans|[àa]|au)\s+(?:votre|ma|la|le|ta)\s+(?:r[ée]f[ée]rentiel|base|m[ée]moire|rag)'
                  . '|(?:^|\n)\s*m[ée]moris[ée]e?s?(?![\p{L}]))/iu', $t)) return false;
    return !preg_match('/(?:n[\'’]ai\s+pas|pas\s+pu|impossible|[ée]chec|erreur|n[\'’]a\s+pas|aucune?)[^.\n]{0,40}(?:m[ée]moris|enregistr)/iu', $t);
}

/** La partie de la question qui contient l'information à mémoriser. */
function cfo_gm_charge(string $q, array $decl): string {
    [$pos, $len] = $decl;
    $avant = trim(substr($q, 0, $pos));
    $apres = trim(substr($q, $pos + $len));
    // politesse et appel au CFO autour du verbe
    $avant = trim((string)preg_replace('/(?:(?:^|[\s,])(?:cfo|stp|svp|merci\s+de|s[\'’]il\s+te\s+pla[iî]t)|(?:peux|pourrais|veux)[\s\-]+tu|tu\s+peux|est[\s\-]ce\s+que\s+tu\s+peux)[\s,]*$/iu', '', $avant));
    $apres = trim((string)preg_replace('/[\s,]*(?:stp|svp|merci|s[\'’]il\s+te\s+pla[iî]t)[\s.!]*$/iu', '', $apres));
    if (mb_strlen($apres) >= 40) return $apres;
    return mb_strlen($avant) > mb_strlen($apres) ? $avant : $apres;
}

/* ── Découpage en entités ──────────────────────────────────────────────────── */

/** Un paragraphe qui nomme au moins deux entités DISTINCTES, en début de phrase
 *  (« …, et l'Actif Est fait… »), est coupé devant chacune. Une simple mention
 *  (« à côté du Terrain Est ») ne coupe pas. */
function cfo_gm_couper_en_ligne(string $bloc): array {
    $re = '/(^|[.;!?]\s+|:\s+|,\s+(?:et\s+|puis\s+)?|\s+et\s+|\s+puis\s+|\n)'
        . '((?:[Ll][\'’]|[Ll]e\s+|[Ll]a\s+|[Mm]on\s+|[Mm]a\s+)?(?i:' . CFO_GM_MOTS_ENTITE . ')s?\s+[\p{Lu}\p{N}«"(])/u';
    if (!preg_match_all($re, $bloc, $m, PREG_OFFSET_CAPTURE | PREG_SET_ORDER)) return [$bloc];
    $coupes = []; $vus = [];
    foreach ($m as $x) {
        $pos = $x[2][1];
        $ids = cfo_gm_identite(substr($bloc, $pos), 4);
        if (!$ids) continue;
        $cle = implode(' ', array_map(fn($i) => $i['norm'], $ids));
        if (isset($vus[$cle])) continue;
        $vus[$cle] = true; $coupes[] = $pos;
    }
    if (count($coupes) < 2) return [$bloc];
    if ($coupes[0] !== 0) array_unshift($coupes, 0);
    $out = [];
    foreach ($coupes as $k => $debut) {
        $fin = $coupes[$k + 1] ?? strlen($bloc);
        $seg = trim(substr($bloc, $debut, $fin - $debut));
        $seg = trim((string)preg_replace('/[\s,;]+(?:et|puis)?\s*$/u', '', $seg));
        if ($seg !== '') $out[] = $seg;
    }
    return $out;
}

/**
 * La charge découpée en blocs, un par entité :
 *   • une ligne qui commence par une entité (« Actif Est : … »), un élément
 *     numéroté ou une ligne vide ouvrent un nouveau bloc ;
 *   • une puce SOUS une entité en est un détail ; une puce libre est un fait ;
 *   • un paragraphe qui nomme plusieurs entités est coupé devant chacune ;
 *   • l'en-tête (« ces deux actifs : ») n'est pas un bloc : s'il porte une
 *     information (« en indivision à 35 % »), il préfixe chaque écriture.
 * Renvoie ['blocs' => [['texte','entite','titre']...], 'prefixe' => ?string].
 */
function cfo_gm_blocs(string $charge): array {
    $charge = trim((string)preg_replace('/^\s*[:\-–,]?\s*(?:(?:que|qu[\'’](?=\p{L})|ceci|cela|[çc]a|bien|les\s+(?:infos?|informations?|[ée]l[ée]ments?)\s+suivant(?:e?s)?|ce\s+qui\s+suit)\s*[:,]?\s*)?/iu', '', $charge));
    $bruts = []; $cur = null;
    $fermer = function () use (&$cur, &$bruts) { if ($cur !== null && trim($cur['texte']) !== '') $bruts[] = $cur; $cur = null; };
    foreach (preg_split('/\R/u', $charge) as $ligne) {
        $t = trim($ligne);
        if ($t === '') { $fermer(); continue; }
        $sansPuce = (string)preg_replace('/^(?:[-•*▪►‣–]\s+|\d+\s*[.)]\s+|#+\s*)/u', '', $t);
        $puce = $sansPuce !== $t;
        $numero = (bool)preg_match('/^\d+\s*[.)]\s+/u', $t);
        $entete = (bool)cfo_gm_identite($sansPuce, 12);
        if ($entete || $numero || ($puce && ($cur === null || !$cur['entite']))) {
            $fermer();
            $cur = ['texte' => $sansPuce, 'entite' => $entete];
        } elseif ($cur === null) {
            $cur = ['texte' => $sansPuce, 'entite' => false];
        } else {
            $cur['texte'] .= "\n" . $t;
        }
    }
    $fermer();

    $blocs = [];
    foreach ($bruts as $b) {
        foreach (cfo_gm_couper_en_ligne($b['texte']) as $seg) {
            $blocs[] = ['texte' => $seg, 'entite' => (bool)cfo_gm_identite($seg, 12)];
        }
    }
    // L'en-tête : premier bloc sans entité, suivi d'entités, court ou fini par « : »
    $prefixe = null;
    if (count($blocs) >= 2 && !$blocs[0]['entite'] && count(array_filter($blocs, fn($b) => $b['entite'])) >= 1
        && (preg_match('/:\s*$/u', $blocs[0]['texte']) || mb_strlen($blocs[0]['texte']) < 100)) {
        $tete = array_shift($blocs)['texte'];
        if (count(cfo_gm_forts($tete)) >= 2) $prefixe = $tete;
    }
    // Un fragment très court sans entité complète le bloc précédent
    $fusion = [];
    foreach ($blocs as $b) {
        if ($fusion && !$b['entite'] && mb_strlen($b['texte']) < 25) { $fusion[count($fusion) - 1]['texte'] .= "\n" . $b['texte']; continue; }
        $fusion[] = $b;
    }
    foreach ($fusion as &$b) $b['titre'] = cfo_gm_titre($b['texte']);
    unset($b);
    return ['blocs' => $fusion, 'prefixe' => $prefixe];
}

/** Ce qu'affiche le reçu : le nom de l'entité (« Actif Est / Al Ouidane »),
 *  sinon le début du bloc. */
function cfo_gm_titre(string $bloc): string {
    if (preg_match('/^(?:[Ll][\'’]|[Ll]e\s+|[Ll]a\s+|[Mm]on\s+|[Mm]a\s+)?((?i:' . CFO_GM_MOTS_ENTITE . ')s?)\s+(?=[\p{Lu}\p{N}«"(])/u', $bloc, $m)) {
        $nom = [$m[1]];
        $reste = preg_split('/[:\n,;.!?]/u', substr($bloc, strlen($m[0])))[0];
        foreach (preg_split('/\s+/u', trim($reste)) as $w) {
            $mot = trim($w, "()«»\"'/–-");
            $connecteur = $mot === '' || in_array(cfo_gm_norm($mot), ['de', 'du', 'des', 'd', 'el', 'al', 'ait', 'ben', 'et', 'la', 'le', 'les', 'l'], true);
            if (!$connecteur && !preg_match('/^[\p{Lu}\p{N}]/u', $mot) && $w[0] !== '(') break;
            $nom[] = $w;
        }
        $titre = rtrim(implode(' ', $nom), ' /–-');
        if (mb_strlen($titre) <= 70) return mb_strtoupper(mb_substr($titre, 0, 1)) . mb_substr($titre, 1);
    }
    $l = trim(preg_split('/\R/u', $bloc)[0]);
    $l = trim(preg_split('/\s:\s|:\s|\s:$/u', $l)[0]);
    $l = mb_strtoupper(mb_substr($l, 0, 1)) . mb_substr($l, 1);
    return mb_strlen($l) > 70 ? rtrim(mb_substr($l, 0, 68)) . '…' : $l;
}

/** preference | regle | contexte — la catégorie que l'ingestion attend. */
function cfo_gm_categorie(string $bloc): string {
    $n = cfo_gm_norm($bloc);
    if (preg_match('/\b(?:jamais|toujours|plafond|maximum|minimum|limite|interdit|obligatoire|regle|ne\s+\S+\s+(?:pas|jamais)|il\s+faut|je\s+dois)\b/u', $n)) return 'regle';
    if (preg_match('/\b(?:prefere|preferes|preference|j\'aime|je\s+n\'aime|plutot\s+que|favori)\b/u', $n)) return 'preference';
    return 'contexte';
}

/* ── Le plan ───────────────────────────────────────────────────────────────── */

/**
 * Pour UN échange (question de l'utilisateur, réponse de l'IA) : ce qui a été
 * demandé, ce qui est en mémoire, ce qu'il reste à écrire.
 *   $memoire   : textes présents dans finance_vectors (clé = identifiant)
 *   $supprimes : textes effacés par l'utilisateur depuis la Supervision IA —
 *                une décision : on ne les ressuscite jamais.
 */
function cfo_gm_plan(string $question, string $reponse, array $memoire, array $supprimes = []): array {
    $q = cfo_gm_sans_consigne($question);
    $decl = cfo_gm_declencheur($q);
    $revendique = cfo_gm_revendique($reponse);
    if (!$decl && !$revendique) return ['demande' => false, 'entites' => []];

    $source = $decl ? 'declencheur' : 'revendication';
    $charge = $decl ? cfo_gm_charge($q, $decl) : $q;
    $d = cfo_gm_blocs($charge);
    $entites = [];
    foreach ($d['blocs'] as $b) {
        $texte = trim((string)preg_replace('/[ \t]+/u', ' ', $b['texte']));
        // Sans verbe explicite, on n'écrit qu'une affirmation substantielle,
        // jamais une question (« qu'as-tu mémorisé sur mes terrains ? »).
        if ($decl) $texte = rtrim($texte, " ?\t");
        $forts = cfo_gm_forts($texte);
        if (mb_strlen($texte) < 20 || count($forts) < 2) continue;
        if (!$decl && (preg_match('/\?\s*$/u', $texte) || count($forts) < 3 || mb_strlen($texte) < 40)) continue;

        $e = ['titre' => cfo_gm_titre($texte), 'texte' => $texte, 'categorie' => cfo_gm_categorie($texte)];
        $cles = array_keys($memoire);
        $best = cfo_gm_meilleur($texte, array_values($memoire));
        if ($best['taux'] >= CFO_GM_SEUIL) {
            $e['statut'] = 'en_memoire';
            $e['regle_id'] = $cles[$best['index']];
            $e['taux'] = round($best['taux'], 2);
        } elseif ($supprimes && cfo_gm_meilleur($texte, $supprimes)['taux'] >= CFO_GM_SEUIL) {
            $e['statut'] = 'supprimee';
        } else {
            $e['statut'] = 'a_ecrire';
            $w = $d['prefixe'] ? $d['prefixe'] . ' ' . $texte : $texte;
            $e['a_ecrire'] = mb_strtoupper(mb_substr($w, 0, 1)) . mb_substr($w, 1);
        }
        $entites[] = $e;
    }
    return ['demande' => true, 'source' => $source, 'entites' => $entites];
}
