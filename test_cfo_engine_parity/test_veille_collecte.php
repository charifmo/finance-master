<?php
declare(strict_types=1);
/**
 * v37.134 — LA COLLECTE CONTINUE DE LA VEILLE.
 *
 *   « À chaque fois je dois ajouter des sites, des mots-clés à l'infini ; il rate l'article du Le360. »
 *
 *   Rejouable sans réseau : les requêtes d'une Recherche Éclair sont enregistrées pour le bien, planifiées
 *   une fois par jour, collectées par lots (faux téléchargeur : flux Google Actualités, 429, page vide),
 *   rangées dans le corpus, rendues à la revue suivante ; 403/429 → pause 24 h ; Brave dans son plafond ;
 *   domaines inconnus « proposés ». SQLite en mémoire ; le même scénario tourne sur PostgreSQL si
 *   FM_TEST_PG_DSN est donné (ex. pgsql:host=127.0.0.1;dbname=fm_test).
 */
require_once __DIR__ . '/../cfo_veille_collecte_lib.php';

$ko = 0; $n = 0;
function v(string $titre, bool $ok, string $detail = ''): void {
    global $ko, $n; $n++; if (!$ok) $ko++;
    printf("  %s %-90s %s\n", $ok ? '✅' : '❌', $titre, $ok ? '' : mb_substr($detail, 0, 600));
}
$j = fn($x) => json_encode($x, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
echo "\n  COLLECTE CONTINUE DE LA VEILLE — requêtes enregistrées, rejouées chaque jour, corpus du bien\n  " . str_repeat('─', 96) . "\n";

$cfg = json_decode(file_get_contents(__DIR__ . '/../veille_sources.json'), true);
$lieux = ['Ouahat Sidi Brahim', 'Marrakech', 'واحة سيدي ابراهيم'];
$sujets = ['Mondial 2030', 'RN9', 'Grand Stade', 'مونديال 2030'];
$R = cfo_vp_requetes($cfg, $lieux, $sujets);
$T0 = 1794470400;   // 2026-11-12 00:00 UTC

$rss = fn(array $items) => '<?xml version="1.0"?><rss><channel>' . implode('', array_map(fn($i) => '<item><title>' . htmlspecialchars($i[0]) . ' - ' . $i[2] . '</title><link>' . htmlspecialchars($i[1])
    . '</link><pubDate>' . $i[3] . '</pubDate><description>' . htmlspecialchars($i[0]) . '</description><source url="https://' . $i[4] . '">' . $i[2] . '</source></item>', $items)) . '</channel></rss>';
$LE360 = 'https://fr.le360.ma/sports/mondial-2030-75-milliards-de-dirhams-pour-les-acces-aux-stades-de-benslimane-et-de-marrakech_RHLGOHV6YRHBLB2KRSTDOMHBWM/';

function scenario(PDO $pdo, string $nom, array $cfg, array $lieux, array $sujets, array $R, int $T0, callable $rss, string $LE360, callable $j): void {
    echo "\n  ▸ $nom\n";
    vc_schema($pdo); vc_schema($pdo);   // deux fois : idempotent
    $bien = vc_cle_bien($lieux);

    /* ── 1. La Recherche Éclair enregistre ses requêtes (et leurs jumelles Brave) ── */
    $rv = vc_revue($pdo, $lieux, $sujets, $R, [], $cfg, $T0);
    $nReq = (int)$pdo->query('SELECT COUNT(*) FROM veille_requetes')->fetchColumn();
    $nBrave = count(array_unique(array_filter(array_map(fn($r) => ($b = vc_requete_brave($r)) ? $b['langue'] . '|' . $b['q'] : null, $R))));
    $sansWhen = !array_filter($pdo->query('SELECT req FROM veille_requetes')->fetchAll(PDO::FETCH_COLUMN), fn($q) => (json_decode($q, true)['type'] ?? '') === 'brave' && str_contains(json_decode($q, true)['q'], 'when:'));
    v('1. la Recherche Éclair enregistre SES ' . count($R) . ' requêtes pour le bien (+ ' . $nBrave . ' jumelles Brave, sans « when: ») — rien à écrire à la main',
      $nReq === count($R) + $nBrave && $rv['etat']['requetes'] === $nReq && $sansWhen && $rv['corpus'] === [], $j([$nReq, count($R), $nBrave, $rv['etat']]));
    vc_revue($pdo, $lieux, $sujets, $R, [], $cfg, $T0 + 60);
    v('  → refaite : aucune requête en double', (int)$pdo->query('SELECT COUNT(*) FROM veille_requetes')->fetchColumn() === $nReq);

    /* ── 2. Planifier : une fois par requête et par jour ; Brave seulement avec une clé ── */
    $p1 = vc_planifier($pdo, false, $T0 + 3600);
    $p2 = vc_planifier($pdo, false, $T0 + 7200);
    v('2. planifié : ' . count($R) . ' tâches aujourd\'hui (les Brave attendent une clé) ; replanifier le même jour : 0', $p1 === count($R) && $p2 === 0, $j([$p1, $p2]));

    /* ── 3. Collecter un lot : un flux avec l'article du Le360, un 429, une page vide ── */
    $vus = [];
    $faux = function (array $reqs, int $delai, int $budget) use (&$vus, $rss, $LE360) {
        $out = [];
        foreach ($reqs as $i => $r) {
            $vus[] = $r['url'];
            $k = count($vus);
            if ($k === 1) $out[$i] = ['http' => 200, 'erreur' => '', 'corps' => $rss([['Mondial 2030 : 7,5 milliards de dirhams pour les accès aux stades de Benslimane et de Marrakech', $LE360, 'Le360', 'Tue, 10 Nov 2026 09:00:00 GMT', 'fr.le360.ma'],
                                                                                         ['Un nouveau lotissement à Ouahat Sidi Brahim', 'https://actu-kech-exemple.ma/lotissement-ouahat', 'Actu Kech', 'Mon, 09 Nov 2026 09:00:00 GMT', 'actu-kech-exemple.ma']])];
            elseif ($k === 2) $out[$i] = ['http' => 429, 'erreur' => '', 'corps' => 'Too Many Requests'];
            else $out[$i] = ['http' => 200, 'erreur' => '', 'corps' => $rss([])];
        }
        return $out;
    };
    $b = vc_collecter($pdo, $cfg, ['lot' => 3, 'maintenant' => $T0 + 4000, 'telecharger' => $faux]);
    $art = $pdo->query('SELECT url, domaine, ts FROM veille_articles ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);
    v('3. un lot de 3 : l\'article du Le360 (daté du 10 nov.) et un autre rangés dans le corpus ; 1 bloquée ; 1 vide',
      $b['taches'] === 3 && $b['articles'] === 2 && ($b['statuts']['ok'] ?? 0) === 1 && ($b['statuts']['bloque'] ?? 0) === 1 && ($b['statuts']['vide'] ?? 0) === 1
      && $art[0]['url'] === $LE360 && (int)$art[0]['ts'] === strtotime('2026-11-10 09:00:00 UTC'), $j([$b, $art]));
    $pause = $pdo->query("SELECT pause_jusqu FROM veille_requetes WHERE dernier_statut = 'bloque'")->fetchAll(PDO::FETCH_COLUMN);
    v('  → 429 : la requête est en PAUSE 24 h (aucun proxy, aucun contournement) — pas replanifiée demain matin, reprise après',
      count($pause) === 1 && (int)$pause[0] === $T0 + 4000 + VC_PAUSE_BLOCAGE, $j($pause));
    $restent = (int)$pdo->query("SELECT COUNT(*) FROM veille_jobs WHERE statut = 'attente'")->fetchColumn();
    v('  → les autres tâches du jour attendent le passage suivant du cron (' . (count($R) - 3) . ')', $restent === count($R) - 3, (string)$restent);

    /* ── 4. Le corpus revient à la revue suivante du bien ── */
    $rv2 = vc_revue($pdo, $lieux, $sujets, $R, [], $cfg, $T0 + 5000);
    $urls = array_column($rv2['corpus'], 'url');
    v('4. revue suivante : le corpus du bien rend l\'article du Le360 (même si le moteur ne le renvoie plus), marqué « déjà trouvé le »',
      in_array($LE360, $urls, true) && $rv2['corpus'][array_search($LE360, $urls, true)]['memoire'] === gmdate('Y-m-d', $T0 + 4000) && $rv2['etat']['articles'] === 2, $j($rv2));
    $sel = cfo_vp_selection($rv2['corpus'], $lieux, $sujets, ['max_articles' => 50, 'quota_zone' => 20, 'large' => true] + $cfg, $T0 + 5000);
    v('  → il passe la sélection de la revue (candidats envoyés au tri IA)', in_array($LE360, array_column($sel, 'url'), true), $j(array_column($sel, 'titre')));
    $autre = vc_revue($pdo, ['Tamansourt'], ['RN9'], cfo_vp_requetes($cfg, ['Tamansourt'], ['RN9']), [], $cfg, $T0 + 5000);
    v('  → un AUTRE bien (Tamansourt) n\'hérite pas du corpus d\'Ouahat Sidi Brahim', !in_array($LE360, array_column($autre['corpus'], 'url'), true), $j(array_column($autre['corpus'], 'url')));

    /* ── 5. Les domaines inconnus sont PROPOSÉS, les connus jamais ── */
    $dom = $pdo->query("SELECT domaine FROM veille_domaines WHERE statut = 'propose'")->fetchAll(PDO::FETCH_COLUMN);
    v('5. « actu-kech-exemple.ma » (inconnu) est proposé comme nouvelle source ; le360.ma (déjà réglé) ne l\'est pas — rien n\'est lu d\'office',
      in_array('actu-kech-exemple.ma', $dom, true) && !in_array('fr.le360.ma', $dom, true) && !in_array('le360.ma', $dom, true), $j($dom));

    /* ── 6. Le lendemain : les requêtes reviennent (sauf celle en pause), Brave avec une clé, dans son plafond ── */
    //  (les deux biens — Ouahat Sidi Brahim et Tamansourt — sont collectés ; la requête en pause attend)
    $tot = (int)$pdo->query('SELECT COUNT(*) FROM veille_requetes')->fetchColumn();
    $nBrave = (int)$pdo->query("SELECT COUNT(*) FROM veille_requetes WHERE req LIKE '%\"type\":\"brave\"%'")->fetchColumn();
    $p3 = vc_planifier($pdo, true, $T0 + 86400 + 3600);
    v('6. le lendemain avec une clé Brave : toutes les requêtes des deux biens (' . ($tot - 1) . ', dont ' . $nBrave . ' Brave) — sauf celle en pause',
      $p3 === $tot - 1 && $nBrave > 0, $j([$p3, $tot, $nBrave]));
    $pdo->exec("UPDATE veille_jobs SET statut = 'fait' WHERE statut = 'attente' AND requete_id IN (SELECT id FROM veille_requetes WHERE req NOT LIKE '%\"type\":\"brave\"%')");
    $appels = [];
    $braveFaux = function (string $q, string $lg, array $brave) use (&$appels) {
        $appels[] = [$q, $lg, $brave['cle']];
        return ['http' => 200, 'erreur' => '', 'corps' => json_encode(['web' => ['results' => [
            ['title' => 'Plan de mobilité du Grand Marrakech : les axes prioritaires', 'url' => 'https://ledesk.ma/encontinu/plan-mobilite-grand-marrakech/', 'description' => 'Le plan…', 'page_age' => '2026-11-05T10:00:00'],
            ['title' => 'Sans date', 'url' => 'https://exemple-brave.ma/x', 'description' => '']]]])];
    };
    $b2 = vc_collecter($pdo, $cfg, ['lot' => 50, 'maintenant' => $T0 + 86400 + 4000, 'telecharger' => $faux, 'brave' => ['cle' => 'CLE-TEST', 'max_mois' => 2], 'brave_http' => $braveFaux]);
    $desk = $pdo->query("SELECT ts FROM veille_articles WHERE url = 'https://ledesk.ma/encontinu/plan-mobilite-grand-marrakech/'")->fetchColumn();
    $sansDate = $pdo->query("SELECT ts FROM veille_articles WHERE url = 'https://exemple-brave.ma/x'")->fetchColumn();
    $budget = (int)$pdo->query("SELECT appels FROM veille_budget WHERE mois = '" . gmdate('Y-m', $T0 + 86400) . "'")->fetchColumn();
    v('  → Brave (plafond 2 appels / mois) : 2 appels seulement, la clé envoyée en en-tête, le reste attend le mois suivant ; l\'article du Desk daté par Brave (page_age), l\'autre SANS date inventée',
      count($appels) === 2 && $appels[0][2] === 'CLE-TEST' && $b2['brave_appels'] === 2 && $budget === 2 && ($b2['statuts']['budget'] ?? 0) === $nBrave - 2
      && (int)$desk === strtotime('2026-11-05T10:00:00') && $sansDate === null, $j([$b2, $budget, $desk, $sansDate, count($appels)]));
    $attente = (int)$pdo->query("SELECT COUNT(*) FROM veille_jobs WHERE statut = 'attente'")->fetchColumn();
    v('  → les Brave hors plafond restent EN ATTENTE (pas perdues, pas appelées)', $attente === $nBrave - 2, (string)$attente);

    /* ── 7. L'état (commande « etat ») ── */
    $e = vc_etat($pdo, $T0 + 86400 + 5000);
    v('7. « etat » : biens, requêtes, en pause, tâches du jour, corpus, domaines proposés, appels Brave du mois',
      $e['biens'] === 2 && $e['en_pause'] === 0 && $e['articles'] === 4 && $e['brave_appels_mois'] === 2 && in_array('actu-kech-exemple.ma', array_column($e['domaines_proposes'], 'domaine'), true), $j($e));
}

$lite = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
try { scenario($lite, 'SQLite (en mémoire)', $cfg, $lieux, $sujets, $R, $T0, $rss, $LE360, $j); }
catch (Throwable $e) { v('SQLite : exécution sans exception', false, $e->getMessage() . ' @' . $e->getLine()); }

$dsn = getenv('FM_TEST_PG_DSN');
if ($dsn) {
    try {
        $pg = new PDO($dsn, getenv('FM_TEST_PG_USER') ?: null, getenv('FM_TEST_PG_PASS') ?: null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        foreach (['veille_biens', 'veille_requetes', 'veille_requete_biens', 'veille_jobs', 'veille_articles', 'veille_hits', 'veille_domaines', 'veille_budget'] as $t) $pg->exec("DROP TABLE IF EXISTS $t");
        scenario($pg, 'PostgreSQL (' . $pg->query('SHOW server_version')->fetchColumn() . ')', $cfg, $lieux, $sujets, $R, $T0, $rss, $LE360, $j);
    } catch (Throwable $e) { v('PostgreSQL : exécution sans exception', false, $e->getMessage() . ' @' . $e->getLine()); }
}

echo "  " . str_repeat('─', 96) . "\n";
echo $ko === 0 ? "  ✅ TOUT PASSE — $n contrôles\n" : "  ❌ $ko contrôle(s) en échec sur $n\n";
exit($ko === 0 ? 0 : 1);
