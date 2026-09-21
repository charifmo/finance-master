<?php
/**
 * ============================================================================
 *  repair_finance_data.php — AUDIT & RÉPARATION GLOBALE (v37.0)
 * ----------------------------------------------------------------------------
 *  USAGE, sur le VPS :
 *      cd /var/www/finance
 *      php repair_finance_data.php              # audit complet, n'écrit RIEN
 *      php repair_finance_data.php --apply      # applique, après sauvegarde
 *      php repair_finance_data.php --apply --lier-objectifs
 *                                               # + déduit les versements
 *                                                 mensuels manquants
 *
 *  CE QU'IL FAIT
 *    Balayage de TOUTES les collections, de TOUS les exercices, avec la MÊME
 *    couche d'intégrité que le moteur applique à l'écriture (cfo_integrity.php).
 *    Une seule définition de « donnée saine », deux points d'appel : ce qui est
 *    refusé en écriture est réparé dans l'historique, et réciproquement.
 *
 *  CE QU'IL NE FAIT PAS, DÉLIBÉRÉMENT
 *    Aucun montant métier codé en dur. Une table de valeurs figée dans un
 *    script de maintenance écrase les saisies de l'utilisateur au prochain
 *    lancement : la réparation ponctuelle des virements 2027 (v36.1) a été
 *    appliquée et vérifiée, elle n'a pas à être rejouée éternellement.
 *    Le script ne corrige que ce qui est structurellement invalide.
 * ============================================================================
 */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit("CLI uniquement.\n"); }

require_once __DIR__ . '/cfo_intent_engine.php';
require_once __DIR__ . '/pending_commit.php';   // en CLI : charge les fonctions, ne route pas

$APPLIQUER = in_array('--apply', $argv, true);
$LIER      = in_array('--lier-objectifs', $argv, true);

function l($s = '') { echo $s . "\n"; }
function titre($t) { l(); l('── ' . $t . ' ' . str_repeat('─', max(0, 70 - mb_strlen($t)))); }

l();
l('  AUDIT & RÉPARATION GLOBALE — ' . date('c'));
l('  Mode : ' . ($APPLIQUER ? '*** APPLICATION ***' : 'audit seul (aucune écriture)'));

list($fd, $src) = cfo_load_finance_state();
if (!is_object($fd)) { l('  ❌ État financier illisible (source: ' . $src . ').'); exit(1); }
l('  Source : ' . $src);

$avantJson = json_encode($fd, JSON_UNESCAPED_UNICODE);
$modifs = 0;

/* ── 1. Inventaire ────────────────────────────────────────────────────────── */
titre('1. INVENTAIRE');
$da = oget($fd, 'donneesAnnuelles');
$exercices = is_object($da) ? array_map('strval', okeys($da)) : [];
sort($exercices);
l(sprintf('  Exercices        : %s', $exercices ? implode(', ', $exercices) : 'AUCUN'));
l(sprintf('  Comptes          : %d', count(oget($fd, 'comptes') ?: [])));
l(sprintf('  Objectifs        : %d', count(oget($fd, 'wealthGoals') ?: [])));
l(sprintf('  Actifs           : %d', count(oget($fd, 'masterAssets') ?: [])));
foreach ($exercices as $yr) {
    $y = oget($da, $yr); if (!is_object($y)) continue;
    $parts = [];
    foreach (cfo_poches_annuelles() as $champ => $poche) {
        $p = oget($y, $champ);
        $parts[] = sprintf('%s %d', $champ, is_array($p) ? count($p) : (is_object($p) ? count(okeys($p)) : 0));
    }
    l(sprintf('    %s : %s', $yr, implode(' · ', $parts)));
}

/* ── 2. Nettoyage de format (même passe que le moteur) ────────────────────── */
titre('2. NETTOYAGE DE FORMAT (synonymes, champs dérivés)');
$rapSan = cfo_sanitize_finance_data($fd);
$totalSan = array_sum($rapSan);
l($totalSan ? '  ' . $totalSan . ' clé(s) parasite(s) purgée(s) : ' . json_encode($rapSan)
            : '  Rien à purger.');
if ($totalSan) $modifs += $totalSan;

/* ── 3. Intégrité : TOUTES collections, TOUS exercices ────────────────────── */
titre('3. INTÉGRITÉ — balayage global');
$corrections = cfo_integrite_passe($fd, null, $APPLIQUER);
if (!count($corrections)) {
    l('  ✅ Aucune anomalie. La base est structurellement saine.');
} else {
    $parType = [];
    foreach ($corrections as $c) {
        $parType[$c['quoi']] = ($parType[$c['quoi']] ?? 0) + 1;
        l(sprintf('  %s %-26s %-28s %s → %s',
            $APPLIQUER ? '✏️ ' : '  ', $c['ou'], $c['quoi'],
            json_encode($c['avant'], JSON_UNESCAPED_UNICODE),
            json_encode($c['apres'], JSON_UNESCAPED_UNICODE)));
    }
    l();
    l('  Récapitulatif par type :');
    arsort($parType);
    foreach ($parType as $t => $n) l(sprintf('    %-32s %d', $t, $n));
    $modifs += count($corrections);
}

/* ── 4. Objectifs sans versement mensuel (opt-in) ─────────────────────────── */
titre('4. OBJECTIFS SANS VERSEMENT MENSUEL');
$comptes = cfo_index_comptes($fd);
$sansVersement = [];
foreach ((oget($fd, 'wealthGoals') ?: []) as $g) {
    if (!is_object($g)) continue;
    if ((float)(oget($g, 'versement_mensuel', 0) ?: 0) <= 0) $sansVersement[] = $g;
}
if (!count($sansVersement)) {
    l('  Tous les objectifs ont un versement mensuel.');
} elseif (!$LIER) {
    foreach ($sansVersement as $g) l(sprintf('  ⚠️  %-32s versement 0 — « Aucun versement mensuel défini » à l\'écran',
                                             oget($g, 'libelle') ?: oget($g, 'name')));
    l();
    l('     Relancez avec --lier-objectifs pour DÉDUIRE ces versements des');
    l('     virements d\'épargne existants (le montant vient de vos données,');
    l('     il n\'est pas inventé). Les versements déjà renseignés ne sont');
    l('     jamais écrasés.');
} else {
    // Candidats : les virements d'épargne de tous les exercices, nommés par leur
    // libellé ou par le compte qu'ils alimentent.
    $flux = [];
    foreach ($exercices as $yr) {
        $y = oget($da, $yr); if (!is_object($y)) continue;
        foreach ((oget($y, 'epargne') ?: []) as $ep) {
            if (!is_object($ep)) continue;
            $v = (float)(oget($ep, 'valeur', 0) ?: 0);
            if ($v <= 0) continue;
            $noms = [cfo_nommer_epargne($ep, $fd)];
            foreach (cfo_libelles_comptes_lies($ep, $fd) as $al) $noms[] = $al;
            foreach ($noms as $nm) {
                $nm = ltrim((string)$nm, '→ ');
                if ($nm !== '' && !isset($flux[$nm])) $flux[$nm] = $v;
            }
        }
    }
    foreach ($sansVersement as $g) {
        $nom = oget($g, 'libelle') ?: oget($g, 'name', '');
        $cands = [];
        foreach ($flux as $nm => $v) {
            $nl = cfo_norm_str($nm);
            $cands[] = ['key'=>$nm, 'label'=>$nm, 'category'=>'flux',
                        'dist'=>cfo_levenshtein(cfo_norm_str($nom), $nl),
                        'contains'=>cfo_str_contains_either($nl, cfo_norm_str($nom))];
        }
        $res = count($cands) ? cfo_rank_candidates($nom, cfo_norm_str($nom), $cands) : ['resolved'=>false];
        if (empty($res['resolved'])) {
            l(sprintf('  ·  %-32s aucun virement rapprochable — laissé tel quel', $nom));
            continue;
        }
        $v = $flux[$res['key']];
        l(sprintf('  ✏️  %-32s versement 0 → %s DH/mois (virement « %s »)',
                  $nom, number_format($v, 0, ',', ' '), $res['key']));
        if ($APPLIQUER) { oset($g, 'versement_mensuel', $v); cfo_goal_sync_schema($g); }
        $modifs++;
    }
}

/* ── 5. Signalements sans correction automatique ──────────────────────────── */
titre('5. À VÉRIFIER PAR VOUS (non corrigé automatiquement)');
$alertes = 0;
foreach ((oget($fd, 'wealthGoals') ?: []) as $g) {
    if (!is_object($g)) continue;
    $c = (float)(oget($g, 'montant_cible', oget($g, 'target', 0)) ?: 0);
    if ($c === 10000.0) {
        $alertes++;
        l(sprintf('  ⚠️  %-32s cible = 10 000 DH — valeur qu\'inventait l\'ancien moteur', oget($g, 'libelle') ?: oget($g, 'name')));
    }
}
foreach ($exercices as $yr) {
    $y = oget($da, $yr); if (!is_object($y)) continue;
    foreach ((oget($y, 'epargne') ?: []) as $ep) {
        if (!is_object($ep)) continue;
        if ((float)(oget($ep, 'valeur', 0) ?: 0) === 0.0) {
            $alertes++;
            l(sprintf('  ⚠️  %s : virement « %s » à 0 DH/mois — sans effet', $yr, cfo_nommer_epargne($ep, $fd)));
        }
    }
}
if (!$alertes) l('  Rien à signaler.');

/* ── 6. Écriture ──────────────────────────────────────────────────────────── */
titre('6. RÉSULTAT');
if (!$modifs) { l('  Base déjà saine. Rien à écrire.'); l(); exit(0); }
if (!$APPLIQUER) {
    l('  ' . $modifs . ' correction(s) identifiée(s). AUCUNE écriture (audit seul).');
    l('  Pour appliquer :  php repair_finance_data.php --apply' . ($LIER ? ' --lier-objectifs' : ''));
    l();
    exit(0);
}

$sauvegarde = __DIR__ . '/finance_data.backup-' . date('Ymd-His') . '.json';
if (file_put_contents($sauvegarde, $avantJson) === false) {
    l('  ❌ Sauvegarde impossible (' . $sauvegarde . ') — écriture ANNULÉE.');
    exit(1);
}
l('  Sauvegarde de l\'état précédent : ' . basename($sauvegarde));

$raw = json_encode($fd, JSON_UNESCAPED_UNICODE);
$ecrit = false;
$cfgFile = __DIR__ . '/db_config.php';
if (file_exists($cfgFile) && extension_loaded('pdo_pgsql')) {
    $cfg = include $cfgFile;
    try {
        $pdo = new PDO(sprintf('pgsql:host=%s;port=%s;dbname=%s', $cfg['host'], $cfg['port'], $cfg['dbname']),
                       $cfg['user'], $cfg['password'],
                       [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 5]);
        $st = $pdo->prepare('INSERT INTO finance_state (id, data, updated_at) VALUES (1, :d::jsonb, now())
                             ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()');
        $st->execute([':d' => $raw]);
        l('  ✅ Écrit dans Postgres (finance_state).');
        $ecrit = true;
    } catch (Exception $e) {
        l('  ⚠️  Postgres indisponible (' . $e->getMessage() . ') → repli fichier.');
    }
}
if (!$ecrit) {
    $f = __DIR__ . '/finance_data.json';
    if (file_put_contents($f, $raw, LOCK_EX) === false) { l('  ❌ Écriture fichier impossible.'); exit(1); }
    l('  ✅ Écrit dans ' . basename($f) . ' (' . strlen($raw) . ' octets).');
}
l();
l('  ⚠️  FERMEZ L\'ONGLET de l\'application avant de lancer ce script, puis');
l('      rechargez la page. Un onglet resté ouvert pousse son état en mémoire');
l('      toutes les 15 min et écraserait cette réparation.');
l();
exit(0);
