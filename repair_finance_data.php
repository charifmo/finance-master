<?php
/**
 * ============================================================================
 *  repair_finance_data.php — remise en état des données déjà persistées
 * ----------------------------------------------------------------------------
 *  USAGE, sur le VPS :
 *      cd /var/www/finance
 *      php repair_finance_data.php            # simulation, n'écrit RIEN
 *      php repair_finance_data.php --apply    # applique, après sauvegarde
 *
 *  POURQUOI CE SCRIPT EXISTE
 *    La v36.0 empêche le moteur d'écrire des données incomplètes. Elle ne
 *    répare pas ce qui a DÉJÀ été écrit par les versions précédentes. Deux
 *    séquelles visibles à l'écran :
 *      • les Smart Goals créés avant la v35.6 n'ont pas de versement_mensuel
 *        (d'où « Aucun versement mensuel défini ») ;
 *      • ceux créés sans cible valide portent 10 000 DH — une valeur INVENTÉE
 *        par l'ancien create_objectif, jamais demandée par personne.
 *    Plus la remise à plat des virements d'épargne 2027.
 *
 *  PRINCIPE : ce script ne devine rien.
 *    - Les montants des virements viennent de la table FLUX ci-dessous, qui
 *      reprend mot pour mot la consigne du ticket.
 *    - Le versement mensuel de chaque objectif est DÉDUIT du virement qui
 *      alimente le compte correspondant — pas inventé.
 *    - Les cibles à 10 000 DH sont SIGNALÉES, jamais modifiées d'office :
 *      seul l'utilisateur connaît le vrai montant.
 * ============================================================================
 */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit("CLI uniquement.\n"); }

require_once __DIR__ . '/cfo_intent_engine.php';
require_once __DIR__ . '/pending_commit.php';   // en CLI : charge les fonctions, ne route pas

$APPLIQUER = in_array('--apply', $argv, true);
$ANNEE     = '2027';

/** Virements mensuels planifiés, désignés par le LIBELLÉ DU COMPTE destinataire. */
$FLUX = [
    'Compte urgence'      => 4000,
    'depenses annuels'    => 2000,
    'Épargne Long Terme'  => 7000,
];

$CIBLE_INVENTEE = 10000;   // valeur que l'ancien moteur posait faute de mieux

function ligne($s = '') { echo $s . "\n"; }
function titre($t) { ligne(); ligne('── ' . $t . ' ' . str_repeat('─', max(0, 68 - strlen($t)))); }

ligne();
ligne('  REMISE EN ÉTAT DE finance_data — ' . date('c'));
ligne('  Mode : ' . ($APPLIQUER ? '*** APPLICATION ***' : 'simulation (aucune écriture)'));

list($fd, $src) = cfo_load_finance_state();
if (!is_object($fd)) { ligne('❌ État financier illisible (source: ' . $src . ').'); exit(1); }
ligne('  Source : ' . $src);

$avantJson = json_encode($fd, JSON_UNESCAPED_UNICODE);
$modifs = 0;

/* ── Index des comptes, par libellé normalisé ─────────────────────────────── */
$parLibelle = [];
foreach ((oget($fd, 'comptes') ?: []) as $c) {
    if (!is_object($c)) continue;
    $lb = oget($c, 'label') ?: oget($c, 'nom');
    if ($lb) $parLibelle[cfo_norm_str($lb)] = ['id' => oget($c, 'id'), 'label' => $lb];
}

/* ── 1. Virements d'épargne de l'exercice ─────────────────────────────────── */
titre('1. VIREMENTS MENSUELS PLANIFIÉS ' . $ANNEE);
$annee = oget(oget($fd, 'donneesAnnuelles'), $ANNEE);
if (!is_object($annee)) {
    ligne('  ❌ Exercice ' . $ANNEE . ' absent — rien à faire ici.');
} else {
    cfo_ep_migrate($annee);
    $pool = oget($annee, 'epargne');
    if (!is_array($pool)) { $pool = []; oset($annee, 'epargne', $pool); }

    foreach ($FLUX as $libelleCompte => $montant) {
        $cle = cfo_norm_str($libelleCompte);
        if (!isset($parLibelle[$cle])) {
            ligne(sprintf('  ⚠️  %-22s compte introuvable — ligne ignorée', $libelleCompte));
            continue;
        }
        $idCompte = $parLibelle[$cle]['id'];
        $trouvee = null;
        foreach ($pool as $ep) {
            if (is_object($ep) && (string)oget($ep, 'linkedAccountId') === (string)$idCompte) { $trouvee = $ep; break; }
        }
        if (!$trouvee) {
            ligne(sprintf('  ⚠️  %-22s aucun virement ne pointe vers ce compte — non créé (à faire depuis l\'app)', $libelleCompte));
            continue;
        }
        $old = (float)(oget($trouvee, 'valeur', 0) ?: 0);
        if ((float)$montant === $old) {
            ligne(sprintf('  ✅ %-22s %7s DH/mois — déjà correct', $libelleCompte, number_format($montant, 0, ',', ' ')));
            continue;
        }
        ligne(sprintf('  ✏️  %-22s %7s → %s DH/mois', $libelleCompte,
              number_format($old, 0, ',', ' '), number_format($montant, 0, ',', ' ')));
        if ($APPLIQUER) { oset($trouvee, 'valeur', $montant + 0); }
        $modifs++;
    }
}

/* ── 2. Smart Goals : versement mensuel déduit du virement correspondant ──── */
titre('2. SMART GOALS — versement mensuel');
$goals = oget($fd, 'wealthGoals');
if (!is_array($goals) || !count($goals)) {
    ligne('  Aucun objectif enregistré.');
} else {
    foreach ($goals as $g) {
        if (!is_object($g)) continue;
        $nom = oget($g, 'libelle') ?: oget($g, 'name', '(sans nom)');
        $vm  = (float)(oget($g, 'versement_mensuel', 0) ?: 0);

        // Le versement attendu est celui du virement qui alimente le compte
        // correspondant. Le rapprochement passe par le MÊME classement que le
        // moteur (Levenshtein + ambiguïté) : un simple « contains » échouait sur
        // « Fonds d'urgence » ↔ « Compte urgence » et sur les pluriels
        // (« Dépenses Annuelles » ↔ « depenses annuels »).
        $attendu = null; $compteRapproche = null;
        $cands = [];
        foreach ($FLUX as $libelleCompte => $montant) {
            $nl = cfo_norm_str($libelleCompte);
            $cands[] = ['key'=>$libelleCompte, 'label'=>$libelleCompte, 'category'=>'compte',
                        'dist'=>cfo_levenshtein(cfo_norm_str($nom), $nl),
                        'contains'=>cfo_str_contains_either($nl, cfo_norm_str($nom))];
        }
        if (count($cands)) {
            $res = cfo_rank_candidates($nom, cfo_norm_str($nom), $cands);
            if (!empty($res['resolved'])) { $compteRapproche = $res['key']; $attendu = $FLUX[$res['key']]; }
        }
        if ($attendu === null) {
            ligne(sprintf('  ·  %-28s versement %6s — aucun virement rapprochable, laissé tel quel',
                  $nom, number_format($vm, 0, ',', ' ')));
        } elseif ((float)$attendu === $vm) {
            ligne(sprintf('  ✅ %-28s versement %6s DH/mois — déjà correct', $nom, number_format($vm, 0, ',', ' ')));
        } else {
            ligne(sprintf('  ✏️  %-28s versement %6s → %s DH/mois (virement vers « %s »)',
                  $nom, number_format($vm, 0, ',', ' '), number_format($attendu, 0, ',', ' '), $compteRapproche));
            if ($APPLIQUER) oset($g, 'versement_mensuel', $attendu + 0);
            $modifs++;
        }
        cfo_goal_sync_schema($g);   // aligne les deux schémas (v19 ↔ legacy)
    }
}

/* ── 3. Cibles inventées : signalées, jamais corrigées d'office ───────────── */
titre('3. CIBLES SUSPECTES (valeur inventée par l\'ancien moteur)');
$suspects = 0;
foreach ((is_array($goals) ? $goals : []) as $g) {
    if (!is_object($g)) continue;
    $cible = (float)(oget($g, 'montant_cible', oget($g, 'target', 0)) ?: 0);
    if ((float)$CIBLE_INVENTEE === $cible) {
        $suspects++;
        ligne(sprintf('  ⚠️  %-28s cible = %s DH', oget($g, 'libelle') ?: oget($g, 'name'),
              number_format($cible, 0, ',', ' ')));
    }
}
if ($suspects) {
    ligne();
    ligne('     Ces ' . $suspects . ' cible(s) valent exactement ' . number_format($CIBLE_INVENTEE, 0, ',', ' ') . ' DH : c\'est la valeur que');
    ligne('     l\'ancien create_objectif posait quand aucune cible valide n\'était fournie.');
    ligne('     Je ne les modifie PAS — je ne connais pas le vrai montant. Corrigez-les');
    ligne('     dans l\'application, ou demandez au CFO « fixe la cible de X à Y DH ».');
} else {
    ligne('  Aucune.');
}

/* ── 4. Écriture ──────────────────────────────────────────────────────────── */
titre('4. RÉSULTAT');
if (!$modifs) { ligne('  Rien à changer. État déjà conforme.'); exit(0); }
if (!$APPLIQUER) {
    ligne('  ' . $modifs . ' correction(s) identifiée(s). AUCUNE écriture (simulation).');
    ligne('  Pour appliquer :  php repair_finance_data.php --apply');
    exit(0);
}

$sauvegarde = __DIR__ . '/finance_data.backup-' . date('Ymd-His') . '.json';
if (file_put_contents($sauvegarde, $avantJson) === false) {
    ligne('  ❌ Sauvegarde impossible (' . $sauvegarde . ') — écriture ANNULÉE.');
    exit(1);
}
ligne('  Sauvegarde de l\'état précédent : ' . basename($sauvegarde));

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
        ligne('  ✅ Écrit dans Postgres (finance_state).');
        $ecrit = true;
    } catch (Exception $e) {
        ligne('  ⚠️  Postgres indisponible (' . $e->getMessage() . ') → repli fichier.');
    }
}
if (!$ecrit) {
    $f = __DIR__ . '/finance_data.json';
    if (file_put_contents($f, $raw, LOCK_EX) === false) { ligne('  ❌ Écriture fichier impossible.'); exit(1); }
    ligne('  ✅ Écrit dans ' . basename($f) . ' (' . strlen($raw) . ' octets).');
}
ligne();
ligne('  ⚠️  FERMEZ L\'ONGLET de l\'application AVANT de relancer ce script, puis');
ligne('      rechargez la page. Un onglet resté ouvert pousse son état en mémoire');
ligne('      toutes les 15 min et écraserait cette réparation (garde-fou v35.5).');
ligne();
exit(0);
