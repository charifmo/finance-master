<?php
/**
 * Santé Master v1.22 — RÉPARATION APRÈS RETOUR D'UNE ANCIENNE VERSION.
 *
 *   Le 6 nov. 2026, une ancienne version de Santé (1.3) a été remise en ligne par-dessus la v1.20. Son
 *   save_sante.php réécrit les données avec une liste FIXE de champs : chaque enregistrement fait par elle
 *   effaçait ce que la v1.20 avait ajouté (plans santé, règles, cibles, objectifs suivis, synchro du
 *   téléphone, cases du plan réalisées, détails des compléments…).
 *
 *   Signe sûr : la v1.20 écrit TOUJOURS la clé « plans » ; l'ancienne version, JAMAIS. Si l'état servi n'a
 *   pas « plans » alors qu'une copie de sauvegarde (sante/backups/, pending/backups/) l'a, on repart de la
 *   plus récente de ces copies et on y reporte ce qui a été saisi depuis avec l'ancienne version (cases
 *   cochées, repas, activité, mesures du téléphone, pesées, nouveaux bilans, profil, compléments).
 *   L'état abîmé est lui-même copié dans les sauvegardes avant d'être remplacé : rien n'est perdu.
 *   Sans ce signe, rien n'est fait (installation neuve, données jamais passées en v1.20, déjà réparées).
 */
require_once __DIR__ . '/sante_store.php';
require_once __DIR__ . '/sante_integrity.php';

/** Les copies de sauvegarde, de la plus récente à la plus ancienne. */
function sante_copies_sauvegarde(): array {
    $dirs = array_unique(array_merge([dirname(sante_fichier()) . '/backups', dirname(sante_fichier_lecture()) . '/backups'],
        getenv('SANTE_DATA_FILE') ? [] : array_map(fn($f) => dirname($f) . '/backups', sante_candidats())));
    $L = [];
    foreach ($dirs as $d) foreach (glob($d . '/sante_data_*.json') ?: [] as $f) $L[$f] = basename($f);
    $L = array_keys($L);
    //  le nom porte la date (sante_data_AAAAMMJJ_HHMMSS.json) : plus sûr que la date du fichier, qu'une copie peut changer
    usort($L, fn($a, $b) => strcmp(basename($b), basename($a)) ?: filemtime($b) - filemtime($a));
    return $L;
}

/** Fusion : la dernière copie v1.20 ($b), plus ce que l'ancienne version a enregistré depuis ($c). */
function sante_fusion_reparation(array $b, array $c): array {
    $o = $b;
    foreach (['profil', 'objectifs'] as $k) $o[$k] = array_merge((array)($b[$k] ?? []), (array)($c[$k] ?? []));
    //  bilans : ceux de la copie (avec leurs documents), plus ceux ajoutés depuis (une date nouvelle)
    $dates = array_column((array)($b['bilans'] ?? []), 'date');
    $o['bilans'] = array_values((array)($b['bilans'] ?? []));
    foreach ((array)($c['bilans'] ?? []) as $x) if (is_array($x) && !in_array($x['date'] ?? null, $dates, true)) $o['bilans'][] = $x;
    //  pesées : l'union (date + source), la plus récente gagne
    $p = [];
    foreach ([(array)($b['poids'] ?? []), (array)($c['poids'] ?? [])] as $liste) foreach ($liste as $x) if (is_array($x)) $p[($x['date'] ?? '') . '|' . ($x['source'] ?? '')] = $x;
    $o['poids'] = array_values($p);
    //  journal : jour par jour — ce qui a été coché/saisi depuis est gardé, ce que seule la v1.20 connaît (plan_fait, hc…) revient
    $j = (array)($b['journal'] ?? []);
    foreach ((array)($c['journal'] ?? []) as $date => $jc) {
        if (!is_array($jc)) continue;
        $jb = is_array($j[$date] ?? null) ? $j[$date] : [];
        $n = $jb + $jc;
        $n['checklist'] = (array)($jb['checklist'] ?? []);
        foreach ((array)($jc['checklist'] ?? []) as $k => $v) $n['checklist'][$k] = !empty($v) || !empty($n['checklist'][$k]);
        foreach (['activite', 'samsung'] as $k) $n[$k] = array_merge((array)($jb[$k] ?? []), (array)($jc[$k] ?? []));
        $n['repas'] = count((array)($jc['repas'] ?? [])) >= count((array)($jb['repas'] ?? [])) ? (array)($jc['repas'] ?? []) : (array)($jb['repas'] ?? []);
        $j[$date] = $n;
    }
    $o['journal'] = $j;
    //  compléments : la liste d'après (un retrait est respecté), chacun avec les détails que la v1.20 gardait (pourquoi, notes…)
    $parNom = [];
    foreach ((array)($b['supplements'] ?? []) as $s) if (is_array($s) && isset($s['nom'])) $parNom[mb_strtolower((string)$s['nom'])] = $s;
    $o['supplements'] = array_map(fn($s) => is_array($s) ? array_merge($parNom[mb_strtolower((string)($s['nom'] ?? ''))] ?? [], $s) : $s, (array)($c['supplements'] ?? []));
    if (isset($c['protocole'])) $o['protocole'] = $c['protocole'];
    return $o;
}

/** À appeler avant de servir l'état. Rend null (rien à faire) ou ['copie' => nom, 'ok' => bool, ...]. */
function sante_reparer_retour_ancienne_version(): ?array {
    [$t] = sante_lire();
    if ($t === '{}' || str_contains($t, '"plans"')) return null;            // déjà en v1.20+ (ou rien) : le cas normal, sans rien lire d'autre
    $c = json_decode($t, true);
    if (!is_array($c) || array_key_exists('plans', $c)) return null;
    foreach (sante_copies_sauvegarde() as $f) {
        $tb = (string)@file_get_contents($f);
        if (!str_contains($tb, '"plans"')) continue;
        $b = json_decode($tb, true);
        if (!is_array($b) || !array_key_exists('plans', $b)) continue;
        $etat = sante_normaliser(sante_fusion_reparation($b, $c));
        $r = sante_ecrire($etat, sante_version($t));                           // si l'état a bougé entre-temps : conflit, on réessaiera au prochain chargement
        error_log('[sante_reparation] ' . ($r['ok'] ? 'données v1.20 rétablies' : 'réparation refusée') . ' depuis ' . basename($f));
        return ['copie' => basename($f), 'ok' => !empty($r['ok'])];
    }
    return null;
}
