<?php
declare(strict_types=1);
/**
 * ============================================================================
 *  cfo_veille_collecte.php — LA COLLECTE CONTINUE (cron, ligne de commande) — v37.134
 * ----------------------------------------------------------------------------
 *  php cfo_veille_collecte.php            planifie les requêtes du jour, puis collecte un lot
 *  php cfo_veille_collecte.php collecter [n]   un lot de n requêtes (8 par défaut)
 *  php cfo_veille_collecte.php etat            l'état : tâches du jour, corpus, domaines proposés, budget Brave
 *  php cfo_veille_collecte.php chercher <mots…> le corpus contient-il cet article ? (tous les mots exigés)
 *
 *  Cron (toutes les 10 minutes, jamais deux à la fois) :
 *    *\/10 * * * * flock -n /tmp/fm-veille.lock php /var/www/finance/cfo_veille_collecte.php >> /var/log/fm-veille.log 2>&1
 *
 *  Installation automatique : sudo bash install_veille.sh [--brave CLE] [--max 1000]
 *  Option Brave Search (API officielle) — dans db_config.php (non versionné) :
 *    'brave_api_key' => '…', 'brave_max_appels_mois' => 1000
 *  ou dans /etc/fm-veille.env (écrit par install_veille.sh) : BRAVE_API_KEY=…, BRAVE_MAX_APPELS_MOIS=…
 * ============================================================================
 */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit("ligne de commande seulement\n"); }
require_once __DIR__ . '/cfo_veille_serveur.php';
require_once __DIR__ . '/cfo_veille_collecte_lib.php';

$conf = cfo_vp_config();
$cfg = $conf['cfg'] ?? null;
if (!is_array($cfg)) { fwrite(STDERR, "veille_sources.json absent ou illisible\n"); exit(1); }
$raison = null;
$pdo = vc_pdo($raison);
if (!$pdo) { fwrite(STDERR, "base indisponible : $raison\n"); exit(1); }
vc_schema($pdo);
vc_domaines_nettoyer($pdo, $cfg);   // v37.135 : plus de variantes de sources connues dans les propositions

$brave = cfo_vp_brave_config();   // v37.137 : db_config.php, l'environnement ou /etc/fm-veille.env — la même lecture que la revue

$cmd = $argv[1] ?? 'tout';
$horo = gmdate('Y-m-d H:i:s');
if ($cmd === 'etat') { echo json_encode(vc_etat($pdo), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), "\n"; exit(0); }
//  v37.138 — « chercher » : le corpus collecté contient-il cet article ? (ex. php cfo_veille_collecte.php chercher "plan de mobilité" ledesk)
if ($cmd === 'chercher') {
    $mots = array_values(array_filter(array_slice($argv, 2), fn($m) => trim($m) !== ''));
    if (!$mots) { fwrite(STDERR, "usage : chercher <mots…> (tous exigés, dans le titre, l'extrait ou l'adresse)\n"); exit(2); }
    foreach (vc_chercher($pdo, $mots) as $a) echo ($a['ts'] ? gmdate('Y-m-d', (int)$a['ts']) : 'sans date') . ' · ' . $a['domaine'] . ' · 1re vue ' . gmdate('Y-m-d H:i', (int)$a['premier'])
        . ' UTC · « ' . $a['titre'] . ' » · ' . $a['url'] . "\n";
    exit(0);
}
$planifiees = 0;
if ($cmd === 'tout') $planifiees = vc_planifier($pdo, $brave !== null);
if ($cmd === 'tout' || $cmd === 'collecter') {
    $b = vc_collecter($pdo, $cfg, ['lot' => max(1, min(50, (int)($argv[2] ?? VC_LOT))), 'brave' => $brave]);
    //  v37.138 : l'origine — sans terminal (TERM absent), c'est le cron ; sinon un lancement à la main
    $origine = getenv('TERM') ? 'manuel' : 'cron';
    echo "[$horo] ($origine) planifiées $planifiees · tâches {$b['taches']} · articles {$b['articles']} · Brave {$b['brave_appels']} · "
       . json_encode($b['statuts'], JSON_UNESCAPED_UNICODE) . "\n";
    exit(0);
}
fwrite(STDERR, "commande inconnue : $cmd (tout | collecter [n] | etat | chercher <mots…>)\n");
exit(2);
