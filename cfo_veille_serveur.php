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
 *  • cfo_vp_telecharger : toutes les requêtes en parallèle (curl), délai borné ;
 *    v37.42 : sans curl, une à une par les flux PHP, dans un budget de temps.
 *  • cfo_vp_prerequis : ce qui manque au PHP du serveur, et la commande exacte.
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
        default: return 'erreur réseau (' . (function_exists('curl_strerror') ? curl_strerror($code) : 'code ' . $code) . ')';
    }
}

/**
 * v37.42 : toutes les requêtes. Avec curl : en parallèle, le délai total est
 * celui de la plus lente. SANS curl (php-curl absent du VPS) : une à une par
 * les flux PHP, dans un budget de temps — la fin de la liste, la moins
 * importante, est alors « non interrogée », et c'est dit.
 * [i => ['corps', 'http', 'erreur', 'saute'?]]
 */
function cfo_vp_telecharger(array $requetes, int $delai, int $budget = 20): array {
    if (!function_exists('curl_multi_init') || !function_exists('curl_init')) return cfo_vp_telecharger_flux($requetes, $delai, $budget);
    $mh = curl_multi_init(); $poignees = []; $out = [];
    foreach ($requetes as $i => $r) {
        $ch = curl_init($r['url']);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 4,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS, CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_TIMEOUT => $delai, CURLOPT_CONNECTTIMEOUT => min(5, $delai), CURLOPT_ENCODING => '',
            CURLOPT_HTTPHEADER => cfo_vp_entetes($r)]);
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

/** v37.42 : les en-têtes d'une requête — une page de journal est demandée comme le ferait un navigateur. */
function cfo_vp_entetes(array $r): array {
    return ($r['type'] ?? '') === 'page'
        ? ['User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 FinanceMaster-Veille/1.0',
           'Accept: text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', 'Accept-Language: ar,fr;q=0.9,en;q=0.5']
        : ['User-Agent: Mozilla/5.0 (compatible; FinanceMaster-Veille/1.0)',
           'Accept: application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5', 'Accept-Language: fr,ar;q=0.9'];
}

/** v37.42 : sans curl — une requête après l'autre, chacune bornée par le temps qui reste. */
function cfo_vp_telecharger_flux(array $requetes, int $delai, int $budget): array {
    $out = []; $debut = microtime(true);
    foreach ($requetes as $i => $r) {
        $reste = $budget - (microtime(true) - $debut);
        if (!ini_get('allow_url_fopen')) { $out[$i] = ['corps' => '', 'http' => 0, 'erreur' => 'ni curl, ni allow_url_fopen : PHP ne peut pas joindre le web']; continue; }
        if ($reste < 1.0) { $out[$i] = ['corps' => '', 'http' => 0, 'saute' => true,
                                        'erreur' => "non interrogée : temps total épuisé ($budget s — sans curl, les sources passent une à une)"]; continue; }
        $out[$i] = cfo_vp_lire_url($r, max(1, min($delai, (int)floor($reste))));
    }
    return $out;
}

/** Une adresse lue par les flux PHP : code HTTP final (redirections suivies), corps, cause d'un échec en clair. */
function cfo_vp_lire_url(array $r, int $delai): array {
    $url = (string)$r['url'];
    $http = ['method' => 'GET', 'timeout' => $delai, 'follow_location' => 1, 'max_redirects' => 5, 'ignore_errors' => true,
             'protocol_version' => 1.1, 'header' => implode("\r\n", array_merge(cfo_vp_entetes($r), ['Connection: close']))] + (cfo_vp_proxy($url) ?? []);
    $ctx = stream_context_create(['http' => $http, 'ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
    $prec = ini_set('default_socket_timeout', (string)$delai);
    $msg = '';
    set_error_handler(function (int $no, string $m) use (&$msg): bool { $msg = $m; return true; });
    $t0 = microtime(true);
    try { $corps = file_get_contents($url, false, $ctx, 0, 4000000); }
    finally { restore_error_handler(); if ($prec !== false) ini_set('default_socket_timeout', $prec); }
    $duree = microtime(true) - $t0;
    $entetes = function_exists('http_get_last_response_headers') ? (http_get_last_response_headers() ?? []) : ($http_response_header ?? []);
    $code = 0;
    foreach ((array)$entetes as $l) if (preg_match('#^HTTP/\S+\s+(\d{3})#', (string)$l, $m)) $code = (int)$m[1];
    return ['corps' => is_string($corps) ? $corps : '', 'http' => $code, 'erreur' => $code ? '' : cfo_vp_cause_flux($msg, $duree, $delai)];
}

/** La cause d'un échec des flux PHP, en clair — les mêmes mots qu'avec curl. */
function cfo_vp_cause_flux(string $msg, float $duree, int $delai): string {
    $m = strtolower($msg);
    if (str_contains($m, 'timed out') || $duree >= $delai - 0.25) return "pas de réponse en $delai s";
    if (preg_match('/getaddrinfo|name or service not known|no address associated|name resolution/', $m)) return 'site introuvable (adresse inconnue)';
    if (str_contains($m, 'refused')) return 'connexion refusée';
    if (preg_match('/ssl|certificate|crypto/', $m)) return 'certificat HTTPS refusé';
    if (str_contains($m, 'redirection limit')) return 'trop de redirections';
    if (str_contains($m, 'reset') || str_contains($m, 'broken pipe')) return 'le site a coupé la connexion';
    $detail = trim((string)preg_replace('/^.*?\):\s*/', '', $msg));
    return 'site injoignable' . ($detail !== '' ? ' (' . mb_substr($detail, 0, 120) . ')' : '');
}

/**
 * Le mandataire (proxy) de sortie, comme curl le lit : http_proxy / https_proxy /
 * no_proxy de l'environnement du PROCESSUS seulement (jamais un en-tête « Proxy: »
 * d'une requête — httpoxy). Sans proxy configuré : null, connexion directe.
 */
function cfo_vp_proxy(string $url): ?array {
    $p = parse_url($url);
    $sch = strtolower((string)($p['scheme'] ?? '')); $h = strtolower((string)($p['host'] ?? ''));
    $px = getenv($sch === 'https' ? 'https_proxy' : 'http_proxy', true);
    if (!is_string($px) || $px === '' || $h === '') return null;
    foreach (explode(',', strtolower((string)getenv('no_proxy', true))) as $np) {
        $np = ltrim(trim($np), '.');
        if ($np !== '' && ($np === '*' || $h === $np || substr($h, -strlen($np) - 1) === '.' . $np)) return null;
    }
    $u = parse_url($px);
    if (!is_array($u) || empty($u['host'])) return null;
    return ['proxy' => 'tcp://' . $u['host'] . ':' . ($u['port'] ?? 80), 'request_fulluri' => $sch === 'http'];
}

/**
 * v37.42 : ce que le PHP du serveur sait faire, et ce qui lui manque — avec la
 * commande exacte pour l'installer. mode_reseau : parallele (curl) |
 * sequentiel (flux PHP, plus lent) | impossible (ni curl, ni allow_url_fopen).
 */
function cfo_vp_prerequis(): array {
    $v = PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION;
    $e = ['curl' => function_exists('curl_multi_init') && function_exists('curl_init'), 'dom' => class_exists('DOMDocument'),
          'simplexml' => function_exists('simplexml_load_string'), 'mbstring' => function_exists('mb_strtolower'),
          'openssl' => extension_loaded('openssl'), 'allow_url_fopen' => (bool)ini_get('allow_url_fopen'), 'pdo_pgsql' => extension_loaded('pdo_pgsql')];
    $paquets = ['curl' => "php$v-curl", 'dom' => "php$v-xml", 'simplexml' => "php$v-xml", 'mbstring' => "php$v-mbstring", 'pdo_pgsql' => "php$v-pgsql"];
    $manquants = [];
    foreach ($paquets as $ext => $paquet) if (!$e[$ext] && !in_array($paquet, $manquants, true)) $manquants[] = $paquet;
    return ['php' => $v, 'extensions' => $e, 'manquants' => $manquants,
            'mode_reseau' => $e['curl'] ? 'parallele' : ($e['allow_url_fopen'] ? 'sequentiel' : 'impossible'),
            'commande' => $manquants ? 'sudo apt-get install -y ' . implode(' ', $manquants) . " && sudo systemctl restart php$v-fpm" : ''];
}
