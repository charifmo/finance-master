<?php
/**
 * Santé Master v1.22 — APRÈS LE RETOUR D'UNE ANCIENNE VERSION, LES DONNÉES DE LA v1.20 RÉTABLIES TOUTES SEULES.
 *   Une ancienne version (1.3) remise en ligne réécrivait les données avec une liste fixe de champs : plans,
 *   règles, cibles, synchro du téléphone, cases du plan réalisées, détails des compléments… disparaissaient.
 *   Au chargement, la v1.22 repart de la dernière copie de sauvegarde v1.20 et y reporte ce qui a été saisi
 *   depuis. Décor FICTIF ; aucune donnée personnelle.
 */
$tmp = sys_get_temp_dir() . '/sante_rep_' . bin2hex(random_bytes(4));
mkdir("$tmp/backups", 0775, true);
$F = "$tmp/sante_data.json";
putenv("SANTE_DATA_FILE=$F");
require_once __DIR__ . '/../sante/sante_reparation.php';
$ko = 0; $n = 0;
function v(string $t, bool $ok, $d = '') { global $ko, $n; $n++; if (!$ok) $ko++; printf("  %s %-78s %s\n", $ok ? '✅' : '❌', $t, $ok ? '' : mb_substr(is_string($d) ? $d : json_encode($d, JSON_UNESCAPED_UNICODE), 0, 600)); }
echo "\n  SANTÉ MASTER — RÉPARATION APRÈS LE RETOUR D'UNE ANCIENNE VERSION\n  " . str_repeat('─', 80) . "\n";
$enc = fn($e) => json_encode($e, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
$hier = gmdate('Y-m-d', time() - 86400); $auj = gmdate('Y-m-d');

//  L'état tel que la v1.20 l'écrivait (passé par le normaliseur actuel)
$bon = sante_normaliser([
    'profil' => ['nom' => 'PERSONNE FICTIVE', 'sexe' => 'H', 'naissance' => '1980-01-01', 'taille_cm' => 180],
    'bilans' => [['date' => '2026-10-01', 'valeurs' => ['tg' => ['v' => 1.62]]]],
    'poids' => [['date' => $hier, 'kg' => 97.0, 'source' => 'samsung']],
    'journal' => [$hier => ['checklist' => ['zone2' => true], 'plan_fait' => ['p_eau' => true], 'samsung' => ['pas' => 8000],
                            'hc' => ['pas' => ['2026-11-05T08:00:00Z|s1a2b3c' => 4077]]]],
    'supplements' => [['nom' => 'Oméga-3', 'dose' => '2 g', 'moment' => 'midi', 'pourquoi' => 'triglycérides', 'notes' => 'pendant le repas']],
    'plans' => ['protocole' => ['items' => [['id' => 'p_eau', 'texte' => 'Grand verre d\'eau au réveil', 'moment' => 'matin']]]],
    'regles' => [['texte' => 'Zéro grignotage entre les repas', 'section' => 'Règles']],
    'cibles' => ['tg' => ['op' => '<', 'v' => 1.2]],
    'sync_auto' => ['derniere' => $hier . 'T20:00:00Z', 'source' => 'HC Webhook', 'jours' => 3],
]);
$tBon = $enc($bon);
//  Ce que l'ancienne version a écrit ensuite (sa liste fixe de champs) — avec ce que vous avez saisi entre-temps :
//  « café MCT » coché hier, une pesée aujourd'hui, 5 000 pas aujourd'hui, la vitamine D ajoutée, un bilan le 06/11.
$CL = fn(array $c) => array_merge(array_fill_keys(SANTE_CHECKLIST, false), $c);
$abime = [
    '_schema' => 1, 'profil' => $bon['profil'], 'objectifs' => $bon['objectifs'],
    'bilans' => [['date' => '2026-10-01', 'valeurs' => ['tg' => ['v' => 1.62]]], ['date' => '2026-11-06', 'valeurs' => ['tg' => ['v' => 1.40]]]],
    'poids' => [['date' => $hier, 'kg' => 97.0, 'source' => 'samsung'], ['date' => $auj, 'kg' => 96.5, 'source' => 'saisie']],
    'journal' => [$hier => ['checklist' => $CL(['zone2' => true, 'cafe_mct' => true]), 'repas' => [], 'activite' => [], 'samsung' => ['pas' => 8000]],
                  $auj => ['checklist' => $CL([]), 'repas' => [], 'activite' => ['pas' => 5000], 'samsung' => []]],
    'supplements' => [['nom' => 'Oméga-3', 'dose' => '2 g', 'moment' => 'midi', 'actif' => true], ['nom' => 'Vitamine D3', 'dose' => '2000 UI', 'moment' => 'matin', 'actif' => true]],
    'protocole' => [],
];
$tAbime = $enc($abime);
file_put_contents("$tmp/backups/sante_data_20261105_093000.json", '{"profil":{"nom":"ANCIEN"},"plans":{}}');   // plus ancienne : pas celle-là
file_put_contents("$tmp/backups/sante_data_20261106_200000.json", $tBon);                                    // la dernière copie v1.20
file_put_contents("$tmp/backups/sante_data_20261106_210500.json", $tAbime);                                  // déjà abîmée : à ignorer
file_put_contents($F, $tAbime);

v('A. statique : save_sante.php répare avant de servir, et dit d\'où (X-Sante-Reparation)',
  str_contains((string)file_get_contents(__DIR__ . '/../sante/save_sante.php'), 'sante_reparer_retour_ancienne_version()')
  && str_contains((string)file_get_contents(__DIR__ . '/../sante/save_sante.php'), 'X-Sante-Reparation'));
$r = sante_reparer_retour_ancienne_version();
v('B. données abîmées par l\'ancienne version : réparées depuis la DERNIÈRE copie v1.20 (pas la plus ancienne, pas une abîmée)',
  ($r['ok'] ?? false) && ($r['copie'] ?? '') === 'sante_data_20261106_200000.json', $r);
$e = json_decode((string)file_get_contents($F), true);
v('  → plan santé, règles, cibles et synchro du téléphone : de retour',
  ($e['plans']['protocole']['items'][0]['texte'] ?? '') === 'Grand verre d\'eau au réveil' && ($e['regles'][0]['texte'] ?? '') === 'Zéro grignotage entre les repas'
  && ($e['cibles']['tg']['v'] ?? null) == 1.2 && ($e['sync_auto']['source'] ?? '') === 'HC Webhook', $e);
v('  → hier : la case du plan réalisée et les mesures du téléphone (minute par minute) reviennent',
  !empty($e['journal'][$hier]['plan_fait']['p_eau']) && !empty($e['journal'][$hier]['hc']['pas']) && ($e['journal'][$hier]['samsung']['pas'] ?? null) == 8000, $e['journal'][$hier] ?? null);
v('  → ce que vous avez saisi depuis est gardé : « café MCT » coché hier, 5 000 pas aujourd\'hui',
  !empty($e['journal'][$hier]['checklist']['zone2']) && !empty($e['journal'][$hier]['checklist']['cafe_mct']) && ($e['journal'][$auj]['activite']['pas'] ?? null) == 5000, $e['journal']);
v('  → la pesée d\'aujourd\'hui et le bilan du 06/11 sont gardés',
  count(array_filter($e['poids'], fn($p) => $p['date'] === $auj && $p['kg'] == 96.5)) === 1 && in_array('2026-11-06', array_column($e['bilans'], 'date'), true) && count($e['bilans']) === 2, [$e['poids'], array_column($e['bilans'], 'date')]);
$om = array_values(array_filter($e['supplements'], fn($s) => $s['nom'] === 'Oméga-3'))[0] ?? [];
v('  → compléments : la vitamine D ajoutée est gardée, l\'Oméga-3 retrouve son « pourquoi » et ses notes',
  in_array('Vitamine D3', array_column($e['supplements'], 'nom'), true) && ($om['pourquoi'] ?? '') === 'triglycérides' && ($om['notes'] ?? '') === 'pendant le repas', $e['supplements']);
$copies = glob("$tmp/backups/sante_data_*.json");
v('  → rien n\'est perdu : l\'état abîmé a été copié dans les sauvegardes avant d\'être remplacé',
  count(array_filter($copies, fn($f) => (string)file_get_contents($f) === $tAbime)) >= 2, count($copies) . ' copie(s)');
v('C. relancé : plus rien à faire (déjà en v1.20+)', sante_reparer_retour_ancienne_version() === null);

//  Sans le signe : rien
file_put_contents($F, $enc($bon));
array_map('unlink', glob("$tmp/backups/*.json"));
v('D. données v1.20 intactes : on n\'y touche pas', sante_reparer_retour_ancienne_version() === null && (string)file_get_contents($F) === $enc($bon));
file_put_contents($F, $tAbime);
v('  → données d\'avant la v1.20, sans aucune copie v1.20 : on n\'y touche pas non plus', sante_reparer_retour_ancienne_version() === null && (string)file_get_contents($F) === $tAbime);
unlink($F);
v('  → installation neuve (aucune donnée) : rien', sante_reparer_retour_ancienne_version() === null && !is_file($F));

//  De bout en bout : le vrai save_sante.php servi par php -S, comme la page le lit
file_put_contents("$tmp/backups/sante_data_20261106_200000.json", $tBon);
file_put_contents($F, $tAbime);
$libre = function (): int { $s = stream_socket_server('tcp://127.0.0.1:0'); $p = (int)substr(strrchr(stream_socket_get_name($s, false), ':'), 1); fclose($s); return $p; };
$port = $libre();
$srv = proc_open([PHP_BINARY, '-S', "127.0.0.1:$port", '-t', realpath(__DIR__ . '/..')], [['file', '/dev/null', 'r'], ['file', '/dev/null', 'w'], ['file', '/dev/null', 'w']], $tuyaux,
                 null, ['SANTE_DATA_FILE' => $F, 'PATH' => getenv('PATH')]);
for ($i = 0; $i < 50 && !@fsockopen('127.0.0.1', $port); $i++) usleep(100000);
$ctx = stream_context_create(['http' => ['ignore_errors' => true, 'timeout' => 10]]);
$corps = @file_get_contents("http://127.0.0.1:$port/sante/save_sante.php", false, $ctx);
$entetes = implode("\n", $http_response_header ?? []);
$servi = json_decode((string)$corps, true);
v('E. la page charge Santé : l\'état servi est déjà réparé, et l\'en-tête nomme la copie (pour le message à l\'écran)',
  str_contains($entetes, 'X-Sante-Reparation: sante_data_20261106_200000.json') && ($servi['regles'][0]['texte'] ?? '') === 'Zéro grignotage entre les repas', $entetes);
$corps2 = @file_get_contents("http://127.0.0.1:$port/sante/save_sante.php", false, $ctx);
$entetes2 = implode("\n", $http_response_header ?? []); $servi2 = json_decode((string)$corps2, true);
$diff = array_keys(array_filter(array_merge((array)$servi, (array)$servi2), fn($v, $k) => ($servi[$k] ?? null) != ($servi2[$k] ?? null), ARRAY_FILTER_USE_BOTH));
v('  → au chargement suivant : plus d\'en-tête, rien de refait', !preg_match('/^X-Sante-Reparation:/mi', $entetes2) && !$diff, [$entetes2, $diff]);
proc_terminate($srv);

array_map('unlink', glob("$tmp/backups/*.json") ?: []); array_map('unlink', glob("$tmp/*.json*") ?: []); @rmdir("$tmp/backups"); @rmdir($tmp);
echo $ko === 0 ? "\n  ✅ TOUT PASSE — $n contrôles\n" : "\n  ❌ $ko contrôle(s) en échec sur $n\n";
exit($ko === 0 ? 0 : 1);
