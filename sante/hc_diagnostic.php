<?php
/**
 * Santé Master v1.24 — DIAGNOSTIC DE LA SYNCHRO DU TÉLÉPHONE (Samsung Health → Health Connect → appli webhook → ici).
 *   Sur le serveur seulement :  sudo php /var/www/finance/sante/hc_diagnostic.php   (ajoutez  --brut  pour les exemples)
 *   Dit, pour chaque mesure, si elle arrive, de quelle appli, et si des mesures arrivent en retard ; puis où chercher.
 *   Rien n'est modifié. Par le web : 404 (le résumé des envois reste derrière le mot de passe du site, dans backups/).
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/sante_store.php';
require_once __DIR__ . '/sante_intent_engine.php';
require_once __DIR__ . '/sante_hc.php';

$brut = in_array('--brut', $argv, true);
[$t, $mode] = sante_lire();
$e = json_decode($t, true) ?: [];
$s = (array)($e['sync_auto'] ?? []);
$age = function ($iso) { $x = strtotime((string)$iso); if (!$x) return '?'; $m = (int)round((time() - $x) / 60); return $m < 60 ? "il y a $m min" : ($m < 2880 ? 'il y a ' . round($m / 60, 1) . ' h' : 'il y a ' . round($m / 1440, 1) . ' j'); };
echo "== Santé Master — synchro du téléphone (données : $mode)\n";
if (!$s) { echo "Aucune synchro reçue. Vérifiez l'adresse et le mot de passe dans l'appli webhook.\n"; exit(0); }
echo 'Dernière synchro : ' . ($s['derniere'] ?? '?') . ' (' . $age($s['derniere'] ?? '') . ') — ' . ($s['source'] ?? '') . "\n";
echo 'Dernier envoi    : ' . (empty($s['recu']) ? 'vide (rien de neuf)' : json_encode($s['recu'], JSON_UNESCAPED_UNICODE)) . "\n";

$vus = (array)($s['vus'] ?? []);
echo "\n-- Mesures déjà reçues (depuis la v1.24) : type → dernière fois, applis\n";
if (!$vus) echo "   (pas encore de relevé : attendez le prochain envoi du téléphone)\n";
foreach ($vus as $type => $v) {
    $src = []; foreach ((array)($v['s'] ?? []) as $n => $d) $src[] = "$n (" . $age($d) . ')';
    printf("   %-24s %-16s %s\n", $type, $age($v['d'] ?? ''), implode(', ', $src));
}

echo "\n-- Pas des 3 derniers jours (retenus, puis par appli)\n";
for ($i = 0; $i < 3; $i++) {
    $d = date('Y-m-d', time() - $i * 86400);
    $j = (array)($e['journal'][$d] ?? []);
    $par = [];
    foreach ((array)($j['hc']['pas'] ?? []) as $k => $v) {
        $h = preg_match('/^(?:id:)?(s[0-9a-f]{6})\|/', (string)$k, $m) ? $m[1] : '_';
        $nom = $h === '_' ? 'total du jour' : ($h === 's000000' ? 'regroupé' : ((string)($s['sources'][$h] ?? ('source ' . $h))));
        $par[$nom] = ($par[$nom] ?? 0) + (float)$v;
    }
    printf("   %s  %6s pas", $d, isset($j['samsung']['pas']) ? (int)$j['samsung']['pas'] : '—');
    foreach ($par as $n => $v) echo "  · $n " . (int)round($v);
    echo "  (" . count((array)($j['hc']['pas'] ?? [])) . " mesures)\n";
}

$f = dirname(sante_fichier()) . '/backups/hc_envois.json';
$L = is_file($f) ? (json_decode((string)file_get_contents($f), true) ?: []) : [];
echo "\n-- " . count($L) . " derniers envois gardés ($f)\n";
$retard = 0; $sources = []; $types = [];
foreach (array_slice($L, -12) as $x) {
    $resume = [];
    foreach ((array)($x['types'] ?? []) as $type => $y) {
        $resume[] = "$type " . ($y['n'] ?? 0) . ($y['en_retard'] ? ' (dont ' . $y['en_retard'] . ' en retard)' : '');
        $retard += (int)($y['en_retard'] ?? 0); $types[$type] = true;
        foreach ((array)($y['sources'] ?? []) as $n => $c) $sources[sante_hc_nom_source((string)$n) . ' = ' . ($n === '' ? '(vide)' : $n)][$type] = true;
    }
    echo '   ' . ($x['recu_le'] ?? '?') . '  ' . ($resume ? implode(' · ', $resume) : 'vide') . "\n";
    if ($brut) foreach ((array)($x['types'] ?? []) as $type => $y) {
        echo "      $type : " . ($y['debut'] ?? '?') . ' → ' . ($y['fin'] ?? '?') . ', somme ' . ($y['somme'] ?? 0) . ', champs ' . implode(',', (array)($y['champs'] ?? [])) . "\n";
        foreach ((array)($y['exemples'] ?? []) as $ex) echo "         $ex\n";
    }
}
if ($sources) { echo "\n-- Applis qui écrivent dans Health Connect (vues dans ces envois)\n"; foreach ($sources as $n => $ts) echo "   $n : " . implode(', ', array_keys($ts)) . "\n"; }

echo "\n== Ce qu'il faut regarder\n";
$noms = [];
foreach ($L as $x) foreach ((array)($x['types'] ?? []) as $y) foreach (array_keys((array)($y['sources'] ?? [])) as $src) $noms[] = sante_hc_nom_source((string)$src);
foreach ($vus as $v) $noms = array_merge($noms, array_keys((array)($v['s'] ?? [])));
$samsung = (bool)array_intersect($noms, ['Samsung Health', 'montre']);
$n = 0;
if (($vus || $L) && !$samsung) echo ++$n . ". Aucune mesure de Samsung Health ni de la montre : seuls les pas comptés par Android arrivent. Samsung Health\n   n'écrit pas dans Health Connect → Samsung Health › Paramètres › Health Connect › autoriser l'ÉCRITURE de tout.\n";
foreach (['heart_rate' => 'fréquence cardiaque', 'sleep' => 'sommeil', 'weight' => 'poids'] as $type => $lib)
    if (($vus || $L) && !isset($vus[$type]) && !array_filter(array_keys($types), fn($k) => str_starts_with(preg_replace('/[^a-z]/', '', strtolower($k)), str_replace('_', '', $type))))
        echo ++$n . ". Jamais reçu : $lib → cochez-le dans l'appli webhook (types de données) et autorisez-le pour Samsung Health dans Health Connect.\n";
if (strtotime((string)($s['derniere'] ?? '')) < time() - 3 * 3600) echo ++$n . ". Pas d'envoi depuis plus de 3 h : Android endort l'appli webhook → Paramètres › Applis › (appli webhook) › Batterie › Non restreinte.\n";
if ($retard) echo ++$n . ". $retard mesure(s) arrivées après l'envoi suivant : Samsung Health écrit en retard ; elles sont bien comptées ici quand elles arrivent.\n";
if (!$n) echo "Rien d'anormal vu ici. Si les pas restent bas, comparez avec Health Connect › Données et accès › Pas (même total que Samsung ?).\n";
