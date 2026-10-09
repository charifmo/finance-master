<?php
declare(strict_types=1);
/**
 * ============================================================================
 *  cfo_veille_serveur.php — REVUE DE PRESSE : stockage et réseau (v37.40)
 * ----------------------------------------------------------------------------
 *  • La liste d'ORIGINE des médias est veille_sources.json (versionnée) ;
 *    VOS ajouts / modifications / suppressions faits depuis l'écran sont dans
 *    PostgreSQL (table cfo_veille_sources, créée au premier enregistrement).
 *    Jamais dans le fichier : un fichier suivi par git modifié sur le VPS
 *    ferait échouer le prochain `git pull`.
 *  • Sans base joignable, la liste d'origine s'applique (lecture seule).
 *  • cfo_vp_telecharger : toutes les requêtes en parallèle, délai borné.
 * ============================================================================
 */
require_once __DIR__ . '/cfo_veille_lib.php';

function cfo_vp_defauts(): ?array {
    $cfg = json_decode((string)@file_get_contents(__DIR__ . '/veille_sources.json'), true);
    return is_array($cfg) ? $cfg : null;
}

/** Connexion (mêmes hôtes candidats que get_ai_memory.php), ou null — jamais d'exception. */
function cfo_vp_pdo(?string &$raison = null): ?PDO {
    static $pdo = false, $motif = null;
    if ($pdo !== false) { $raison = $motif; return $pdo; }
    $pdo = null;
    $f = __DIR__ . '/db_config.php';
    if (!file_exists($f)) { $raison = $motif = 'db_config.php absent'; return null; }
    if (!extension_loaded('pdo_pgsql')) { $raison = $motif = 'extension pdo_pgsql absente'; return null; }
    $cfg = include $f;
    if (!is_array($cfg)) { $raison = $motif = 'db_config.php invalide'; return null; }
    foreach (array_values(array_unique(array_filter([$cfg['host'] ?? null, 'localhost', '127.0.0.1', 'postgres', 'postgres-psy', 'db']))) as $h) {
        try {
            $pdo = new PDO(sprintf('pgsql:host=%s;port=%s;dbname=%s', $h, $cfg['port'] ?? '5432', $cfg['dbname'] ?? ''),
                           $cfg['user'] ?? '', $cfg['password'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 3]);
            $raison = $motif = null;
            return $pdo;
        } catch (Throwable $e) { $pdo = null; }
    }
    $raison = $motif = 'PostgreSQL injoignable';
    return null;
}

function cfo_vp_lire_perso(PDO $pdo): ?array {
    $pdo->exec('CREATE TABLE IF NOT EXISTS cfo_veille_sources (id INT PRIMARY KEY, donnees JSONB NOT NULL, maj TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    $v = $pdo->query('SELECT donnees::text FROM cfo_veille_sources WHERE id = 1')->fetchColumn();
    $d = $v === false ? null : json_decode((string)$v, true);
    return is_array($d) ? $d : null;
}

function cfo_vp_ecrire_perso(PDO $pdo, ?array $perso): void {
    $pdo->exec('CREATE TABLE IF NOT EXISTS cfo_veille_sources (id INT PRIMARY KEY, donnees JSONB NOT NULL, maj TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    if ($perso === null) { $pdo->exec('DELETE FROM cfo_veille_sources WHERE id = 1'); return; }
    $pdo->prepare('INSERT INTO cfo_veille_sources (id, donnees, maj) VALUES (1, CAST(:d AS jsonb), NOW())
                   ON CONFLICT (id) DO UPDATE SET donnees = EXCLUDED.donnees, maj = NOW()')
        ->execute([':d' => json_encode($perso, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]);
}

/**
 * La configuration EFFECTIVE : la liste d'origine, à laquelle s'appliquent vos
 * réglages. ['cfg' => …, 'supprimees' => […], 'stockage' => postgres|indisponible, 'raison' => …]
 */
function cfo_vp_config(): ?array {
    $def = cfo_vp_defauts();
    if (!$def) return null;
    $raison = null; $perso = null; $stockage = 'indisponible';
    $pdo = cfo_vp_pdo($raison);
    if ($pdo) {
        try { $perso = cfo_vp_lire_perso($pdo); $stockage = 'postgres'; }
        catch (Throwable $e) { $raison = 'lecture impossible : ' . $e->getMessage(); }
    }
    $f = cfo_vp_fusion($def['sources'] ?? [], $perso);
    $cfg = $def; $cfg['sources'] = $f['sources'];
    return ['cfg' => $cfg, 'supprimees' => $f['supprimees'], 'stockage' => $stockage, 'raison' => $raison, 'maj' => $perso['maj'] ?? null];
}

/** La cause d'un échec réseau, en clair. */
function cfo_vp_cause(int $code, int $delai): string {
    switch ($code) {
        case 28: return "pas de réponse en $delai s";
        case 6:  return 'site introuvable (adresse inconnue)';
        case 7:  return 'connexion refusée';
        case 35: case 51: case 60: return 'certificat HTTPS refusé';
        case 47: return 'trop de redirections';
        case 52: case 56: return 'le site a coupé la connexion';
        default: return 'erreur réseau (' . curl_strerror($code) . ')';
    }
}

/** Toutes les requêtes en parallèle. [i => ['corps', 'http', 'erreur']] */
function cfo_vp_telecharger(array $requetes, int $delai): array {
    $mh = curl_multi_init(); $poignees = []; $out = [];
    foreach ($requetes as $i => $r) {
        $ch = curl_init($r['url']);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 3,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS, CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_TIMEOUT => $delai, CURLOPT_CONNECTTIMEOUT => min(5, $delai), CURLOPT_ENCODING => '',
            CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; FinanceMaster-Veille/1.0)',
            CURLOPT_HTTPHEADER => ['Accept: application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5']]);
        curl_multi_add_handle($mh, $ch); $poignees[$i] = $ch;
    }
    // En mode parallèle, curl_error() reste vide : la cause se lit dans curl_multi_info_read.
    $codes = [];
    do {
        $st = curl_multi_exec($mh, $actifs);
        while ($info = curl_multi_info_read($mh)) $codes[spl_object_id($info['handle'])] = (int)$info['result'];
        if ($actifs) curl_multi_select($mh, 1.0);
    } while ($actifs && $st === CURLM_OK);
    while ($info = curl_multi_info_read($mh)) $codes[spl_object_id($info['handle'])] = (int)$info['result'];
    foreach ($poignees as $i => $ch) {
        $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $code = $codes[spl_object_id($ch)] ?? 0;
        $err = $code ? cfo_vp_cause($code, $delai) : (curl_error($ch) ?: ($http === 0 ? 'site injoignable' : ''));
        $out[$i] = ['corps' => (string)curl_multi_getcontent($ch), 'http' => $http, 'erreur' => $err];
        curl_multi_remove_handle($mh, $ch); curl_close($ch);
    }
    curl_multi_close($mh);
    return $out;
}
