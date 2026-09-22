<?php
/**
 * v37.1 — TRI DU BRUIT DANS LA SUPERVISION IA.
 *   Teste meta_utile() isolément : c'est la règle qui décide ce que l'écran
 *   montre. Le filtre de longueur, lui, vit en SQL (char_length > seuil) et a
 *   été vérifié contre un vrai PostgreSQL — il n'est pas rejouable ici sans
 *   base, ce test ne prétend donc pas le couvrir.
 */

// On charge le fichier sans déclencher son routage HTTP : seules les
// définitions nous intéressent. Le script sort tôt faute de db_config.php,
// on récupère donc les fonctions via une inclusion protégée.
$src = file_get_contents(__DIR__ . '/../get_ai_memory.php');
$deb = strpos($src, 'const META_TECHNIQUES');
$fin = strpos($src, 'function decodeJson');
if ($deb === false || $fin === false) { echo "  ❌ meta_utile() introuvable dans get_ai_memory.php\n"; exit(1); }
eval(substr($src, $deb, $fin - $deb));

$ko = 0;
function v($titre, $attendu, $obtenu) {
    global $ko; $ok = $attendu === $obtenu; if (!$ok) $ko++;
    printf("  %s %-52s %s\n", $ok ? '✅' : '❌', $titre,
           $ok ? '' : 'attendu=' . json_encode($attendu, JSON_UNESCAPED_UNICODE) . ' obtenu=' . json_encode($obtenu, JSON_UNESCAPED_UNICODE));
}

echo "\n  TRI DES MÉTADONNÉES (Supervision IA)\n";
echo "  " . str_repeat('─', 74) . "\n";

// Métadonnées typiques d'un chargeur de documents
$brut = [
    'source'     => 'directive_studio.txt',
    'tags'       => ['studio', 'airbnb'],
    'categorie'  => 'budget',
    'loc'        => ['lines' => ['from' => 1, 'to' => 3]],
    'blobType'   => 'text/plain',
    'pageNumber' => 1,
    'pdf'        => ['version' => '1.4', 'totalPages' => 2],
];
$net = meta_utile($brut, false);
v('loc (découpage du fichier) écarté',        false, array_key_exists('loc', $net));
v('blobType écarté',                          false, array_key_exists('blobType', $net));
v('pageNumber écarté',                        false, array_key_exists('pageNumber', $net));
v('pdf.* écarté',                             false, array_key_exists('pdf', $net));
v('source CONSERVÉE (elle situe la règle)',   'directive_studio.txt', $net['source'] ?? null);
v('tags CONSERVÉS',                           ['studio', 'airbnb'], $net['tags'] ?? null);
v('catégorie métier CONSERVÉE',               'budget', $net['categorie'] ?? null);

// Une clé métier inconnue doit passer : liste de REFUS, pas d'autorisation.
$net2 = meta_utile(['exercice' => 2027, 'auteur_regle' => 'Mohamed'], false);
v('clé métier imprévue conservée (liste de refus)', 2, count($net2));

// Métadonnées entièrement techniques → null, pour que l'UI n'affiche RIEN
v('métadonnées 100% techniques → null (aucun bandeau vide)', null,
  meta_utile(['loc' => ['lines' => ['from' => 1]], 'blobType' => 'text/plain'], false));
v('valeurs vides écartées', null, meta_utile(['source' => '', 'tags' => []], false));

// Échappatoire
v('meta=all rend tout, intact', $brut, meta_utile($brut, true));

// Robustesse
v('metadata absente → null tel quel', null, meta_utile(null, false));
v('metadata en chaîne → rendue telle quelle', 'texte libre', meta_utile('texte libre', false));


/* ── v37.2 — Détection de l'authentification amont (Caddy) ─────────────────
 *   C'est ce test qui décide si la SUPPRESSION est autorisée. Il doit
 *   reconnaître les différentes façons dont la passerelle transmet
 *   l'information, et surtout ne JAMAIS conclure à tort qu'une protection
 *   existe : un faux positif ouvrirait la destruction à tout internet.
 */
$srcAuth = file_get_contents(__DIR__ . '/../get_ai_memory.php');
$d2 = strpos($srcAuth, 'function auth_amont');
$f2 = strpos($srcAuth, '$utilisateurAmont = auth_amont');
if ($d2 === false || $f2 === false) { echo "  ❌ auth_amont() introuvable\n"; exit(1); }
eval(substr($srcAuth, $d2, $f2 - $d2));

echo "\n  DÉTECTION DE L'AUTHENTIFICATION AMONT (autorise la suppression)\n";
echo "  " . str_repeat('─', 74) . "\n";
$scenarios = [
    'aucun en-tête → PAS protégé'                  => [[], null],
    'PHP_AUTH_USER (mod_php / fpm classique)'      => [['PHP_AUTH_USER' => 'mohamed'], 'mohamed'],
    'REMOTE_USER (proxy)'                          => [['REMOTE_USER' => 'mohamed'], 'mohamed'],
    'REDIRECT_REMOTE_USER (réécriture)'            => [['REDIRECT_REMOTE_USER' => 'mohamed'], 'mohamed'],
    'HTTP_AUTHORIZATION Basic (Caddy + env)'       => [['HTTP_AUTHORIZATION' => 'Basic ' . base64_encode('mohamed:secret')], 'mohamed'],
    'REDIRECT_HTTP_AUTHORIZATION'                  => [['REDIRECT_HTTP_AUTHORIZATION' => 'Basic ' . base64_encode('charif:x')], 'charif'],
    'Bearer (pas du basic) → PAS reconnu'          => [['HTTP_AUTHORIZATION' => 'Bearer abc123'], null],
    'Basic illisible → PAS reconnu'                => [['HTTP_AUTHORIZATION' => 'Basic @@@pas-du-base64@@@'], null],
    'Basic sans deux-points → PAS reconnu'         => [['HTTP_AUTHORIZATION' => 'Basic ' . base64_encode('sansseparateur')], null],
    'valeur vide → PAS reconnu'                    => [['PHP_AUTH_USER' => ''], null],
];
foreach ($scenarios as $titre => $cas) {
    $_SERVER = array_merge(['REQUEST_METHOD' => 'POST'], $cas[0]);
    v($titre, $cas[1], auth_amont());
}

echo "  " . str_repeat('─', 74) . "\n";
printf("  %s — %d contrôle(s) en échec\n\n", $ko ? '❌ ÉCHEC' : '✅ TOUT PASSE', $ko);
exit($ko ? 1 : 0);
