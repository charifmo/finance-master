<?php
declare(strict_types=1);
/**
 * ============================================================================
 *  cfo_veille_collecte_lib.php — LA COLLECTE CONTINUE DE LA VEILLE (v37.134)
 * ----------------------------------------------------------------------------
 *  « À chaque fois je dois ajouter des sites et des mots-clés à l'infini ;
 *    la recherche rate des articles (Le360, Le Desk…) » — plan retenu avec Fable :
 *
 *  • Chaque Recherche Éclair ENREGISTRE ses requêtes (celles que l'appli
 *    fabrique déjà : lieux × sujets, grands projets, site:, pages de recherche
 *    des journaux…), rattachées au bien. Rien à écrire à la main.
 *  • Un cron (cfo_veille_collecte.php) les REJOUE chaque jour, par petits lots,
 *    sans la limite de 20 s de la recherche à la demande : le corpus du bien
 *    s'accumule (Google Actualités ne rend qu'~100 résultats mélangés : rejoué
 *    chaque jour, il finit par tout montrer).
 *  • Option Brave Search (API officielle, clé dans db_config.php) : chaque
 *    requête « moteur » est aussi posée à Brave, dans un plafond d'appels/mois.
 *  • À la Recherche Éclair suivante, le corpus du bien rejoint les candidats ;
 *    le tri par l'IA (0–3) décide, comme avant.
 *  • Les domaines inconnus qui reviennent sont PROPOSÉS (jamais lus d'office).
 *  • Une source qui répond 403 / 429 est mise en pause 24 h : pas de proxy, pas
 *    de rotation d'IP, pas de contournement de captcha.
 *
 *  SQL portable PostgreSQL (production) / SQLite (tests) : dates en secondes
 *  epoch, JSON en TEXT, upserts ON CONFLICT, pas de RETURNING.
 * ============================================================================
 */
require_once __DIR__ . '/cfo_veille_lib.php';

const VC_LOT = 8;                 // requêtes par passage du cron (toutes les 10 min → ~1 100 / jour au plus)
const VC_JOURS_ACTIF = 60;        // un bien non revu depuis 60 jours n'est plus collecté
const VC_PAUSE_BLOCAGE = 86400;   // 403 / 429 : la requête attend 24 h
const VC_MAX_CORPUS = 300;        // articles du corpus rendus à la revue d'un bien

/** La base de la collecte : FM_VEILLE_DSN (tests) sinon la base PostgreSQL de l'appli. */
function vc_pdo(?string &$raison = null): ?PDO {
    $dsn = getenv('FM_VEILLE_DSN');
    if ($dsn) {
        try { return new PDO($dsn, getenv('FM_VEILLE_USER') ?: null, getenv('FM_VEILLE_PASS') ?: null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]); }
        catch (Throwable $e) { $raison = $e->getMessage(); return null; }
    }
    if (!function_exists('cfo_vp_pdo')) require_once __DIR__ . '/cfo_veille_serveur.php';
    return cfo_vp_pdo($raison);
}

/** v37.137 : réserve $n appels Brave dans le plafond du mois (AVANT l'appel). → true si réservé, false si le plafond ne le permet pas. */
function vc_reserver_brave(PDO $pdo, int $n, int $max, ?int $maintenant = null): bool {
    if ($n <= 0) return true;
    $mois = gmdate('Y-m', $maintenant ?? time());
    $pdo->prepare('INSERT INTO veille_budget (mois, appels) VALUES (?, 0) ON CONFLICT DO NOTHING')->execute([$mois]);
    //  les nombres liés en ENTIERS : en texte, SQLite juge « appels + '3' <= '4' » toujours vrai (un calcul comparé à un texte)
    $s = $pdo->prepare('UPDATE veille_budget SET appels = appels + :n WHERE mois = :m AND appels + :n2 <= :max');
    $s->bindValue(':n', $n, PDO::PARAM_INT); $s->bindValue(':n2', $n, PDO::PARAM_INT); $s->bindValue(':m', $mois); $s->bindValue(':max', $max, PDO::PARAM_INT);
    $s->execute();
    return $s->rowCount() > 0;
}

/** La clé d'un bien : ses lieux normalisés (la même que la mémoire de la veille). */
function vc_cle_bien(array $lieux): string { return substr(sha1(implode('|', array_map('cfo_vp_norm', $lieux))), 0, 20); }

function vc_schema(PDO $pdo): void {
    $id = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite' ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'BIGSERIAL PRIMARY KEY';
    foreach ([
        "CREATE TABLE IF NOT EXISTS veille_biens (bien TEXT PRIMARY KEY, lieux TEXT NOT NULL, sujets TEXT NOT NULL, vu_le BIGINT NOT NULL)",
        "CREATE TABLE IF NOT EXISTS veille_requetes (id $id, cle TEXT UNIQUE NOT NULL, req TEXT NOT NULL, actif INTEGER NOT NULL DEFAULT 1,
            pause_jusqu BIGINT NOT NULL DEFAULT 0, derniere BIGINT, dernier_statut TEXT, n_ok INTEGER NOT NULL DEFAULT 0, n_err INTEGER NOT NULL DEFAULT 0)",
        "CREATE TABLE IF NOT EXISTS veille_requete_biens (requete_id BIGINT NOT NULL, bien TEXT NOT NULL, PRIMARY KEY (requete_id, bien))",
        "CREATE TABLE IF NOT EXISTS veille_jobs (id $id, requete_id BIGINT NOT NULL, jour TEXT NOT NULL, statut TEXT NOT NULL DEFAULT 'attente',
            debut BIGINT, fin BIGINT, n INTEGER, erreur TEXT, UNIQUE (requete_id, jour))",
        "CREATE INDEX IF NOT EXISTS veille_jobs_file ON veille_jobs (statut, id)",
        "CREATE TABLE IF NOT EXISTS veille_articles (id $id, url TEXT UNIQUE NOT NULL, domaine TEXT NOT NULL, titre TEXT NOT NULL, extrait TEXT,
            source TEXT, portee TEXT, langue TEXT, ts BIGINT, specifique INTEGER NOT NULL DEFAULT 0, premier BIGINT NOT NULL, dernier BIGINT NOT NULL)",
        "CREATE TABLE IF NOT EXISTS veille_hits (article_id BIGINT NOT NULL, requete_id BIGINT NOT NULL, premier BIGINT NOT NULL, dernier BIGINT NOT NULL,
            PRIMARY KEY (article_id, requete_id))",
        "CREATE INDEX IF NOT EXISTS veille_hits_req ON veille_hits (requete_id)",
        "CREATE TABLE IF NOT EXISTS veille_domaines (domaine TEXT PRIMARY KEY, statut TEXT NOT NULL DEFAULT 'propose', vu INTEGER NOT NULL DEFAULT 0,
            premier BIGINT NOT NULL, dernier BIGINT NOT NULL, exemple TEXT)",
        "CREATE TABLE IF NOT EXISTS veille_budget (mois TEXT PRIMARY KEY, appels INTEGER NOT NULL DEFAULT 0)",
    ] as $sql) $pdo->exec($sql);
}

/** Une requête Brave tirée d'une requête « moteur » : sans l'opérateur when: (propre à Google). */
function vc_requete_brave(array $r): ?array {
    if (($r['type'] ?? '') !== 'moteur' || trim((string)($r['q'] ?? '')) === '') return null;
    $q = trim((string)preg_replace('/\s*\bwhen:\d+[dhmy]\b/i', '', (string)$r['q']));
    return $q === '' ? null : ['type' => 'brave', 'canal' => 'brave', 'nom' => 'Brave Search', 'libelle' => (string)($r['libelle'] ?? $q), 'q' => $q,
                               'langue' => (string)($r['langue'] ?? 'fr'), 'specifique' => !empty($r['specifique'])];
}
function vc_cle_requete(array $r): string { return sha1(($r['type'] ?? '') === 'brave' ? 'brave|' . $r['langue'] . '|' . $r['q'] : (string)($r['url'] ?? '')); }

/**
 * Enregistre le bien et ses requêtes (et leurs jumelles Brave). → [indice de $requetes => id de requête]
 */
function vc_memoriser(PDO $pdo, string $bien, array $lieux, array $sujets, array $requetes, ?int $maintenant = null): array {
    $now = $maintenant ?? time();
    $pdo->prepare('INSERT INTO veille_biens (bien, lieux, sujets, vu_le) VALUES (?, ?, ?, ?)
                   ON CONFLICT (bien) DO UPDATE SET lieux = excluded.lieux, sujets = excluded.sujets, vu_le = excluded.vu_le')
        ->execute([$bien, json_encode(array_values($lieux), JSON_UNESCAPED_UNICODE), json_encode(array_values($sujets), JSON_UNESCAPED_UNICODE), $now]);
    $ins = $pdo->prepare('INSERT INTO veille_requetes (cle, req) VALUES (?, ?) ON CONFLICT (cle) DO UPDATE SET req = excluded.req');
    $sel = $pdo->prepare('SELECT id FROM veille_requetes WHERE cle = ?');
    $lien = $pdo->prepare('INSERT INTO veille_requete_biens (requete_id, bien) VALUES (?, ?) ON CONFLICT DO NOTHING');
    $ids = []; $vusBrave = [];
    $poser = function (array $r) use ($ins, $sel, $lien, $bien): int {
        $cle = vc_cle_requete($r);
        $ins->execute([$cle, json_encode($r, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]);
        $sel->execute([$cle]); $id = (int)$sel->fetchColumn();
        $lien->execute([$id, $bien]);
        return $id;
    };
    foreach ($requetes as $i => $r) {
        if (!is_array($r) || empty($r['url'])) continue;
        $ids[$i] = $poser($r);
        $b = vc_requete_brave($r);
        if ($b && !isset($vusBrave[$b['langue'] . '|' . $b['q']])) { $vusBrave[$b['langue'] . '|' . $b['q']] = true; $poser($b); }
    }
    return $ids;
}

/** Les domaines déjà connus (sources réglées, moteurs) : jamais « proposés ». */
function vc_domaines_connus(array $cfg): array {
    $k = [];
    foreach ($cfg['sources'] ?? [] as $s) if (!empty($s['domaine'])) $k[strtolower((string)$s['domaine'])] = true;
    foreach (['news.google.com', 'google.com', 'bing.com', 'duckduckgo.com', 'msn.com', 'youtube.com'] as $d) $k[$d] = true;
    return $k;
}

/** v37.135 : un domaine est « connu » s'il est une source réglée OU l'une de ses variantes (sport.le360.ma, mobile.telquel.ma, www…). */
function vc_domaine_connu(string $d, array $connus): bool {
    $d = strtolower(trim($d));
    if ($d === '') return true;
    if (isset($connus[$d])) return true;
    foreach ($connus as $k => $_) if (str_ends_with($d, '.' . $k)) return true;   // frontière de point : « notle360.ma » n'est pas « le360.ma »
    return false;
}

/** v37.135 : retire des propositions les domaines devenus connus (variantes déjà proposées avant ce correctif). → nombre retiré */
function vc_domaines_nettoyer(PDO $pdo, array $cfg): int {
    $connus = vc_domaines_connus($cfg); $n = 0;
    $del = $pdo->prepare('DELETE FROM veille_domaines WHERE domaine = ?');
    foreach ($pdo->query("SELECT domaine FROM veille_domaines WHERE statut = 'propose'")->fetchAll(PDO::FETCH_COLUMN) as $d)
        if (vc_domaine_connu((string)$d, $connus)) { $del->execute([$d]); $n += $del->rowCount(); }
    return $n;
}

/** Range des articles (format de cfo_vp_bilan) dans le corpus, rattachés à une requête. → nombre d'articles */
function vc_stocker(PDO $pdo, int $requeteId, array $articles, array $cfg, ?int $maintenant = null): int {
    $now = $maintenant ?? time(); $connus = vc_domaines_connus($cfg); $n = 0;
    $up = $pdo->prepare('INSERT INTO veille_articles (url, domaine, titre, extrait, source, portee, langue, ts, specifique, premier, dernier)
                         VALUES (:u, :d, :t, :e, :s, :p, :l, :ts, :sp, :n, :n)
                         ON CONFLICT (url) DO UPDATE SET dernier = excluded.dernier, ts = COALESCE(veille_articles.ts, excluded.ts),
                                                         extrait = COALESCE(veille_articles.extrait, excluded.extrait)');
    $sel = $pdo->prepare('SELECT id FROM veille_articles WHERE url = ?');
    $hit = $pdo->prepare('INSERT INTO veille_hits (article_id, requete_id, premier, dernier) VALUES (?, ?, ?, ?)
                          ON CONFLICT (article_id, requete_id) DO UPDATE SET dernier = excluded.dernier');
    $dom = $pdo->prepare("INSERT INTO veille_domaines (domaine, vu, premier, dernier, exemple) VALUES (?, 1, ?, ?, ?)
                          ON CONFLICT (domaine) DO UPDATE SET vu = veille_domaines.vu + 1, dernier = excluded.dernier");
    foreach ($articles as $a) {
        $url = (string)($a['url'] ?? ''); $titre = trim((string)($a['titre'] ?? ''));
        if ($titre === '' || !preg_match('#^https?://#i', $url)) continue;
        $url = explode('#', $url, 2)[0];
        $d = (string)($a['domaine'] ?? '') ?: (string)preg_replace('/^www\./', '', strtolower((string)parse_url($url, PHP_URL_HOST)));
        $up->execute([':u' => $url, ':d' => $d, ':t' => mb_substr($titre, 0, 500), ':e' => ($a['extrait'] ?? '') !== '' ? mb_substr((string)$a['extrait'], 0, 400) : null,
                      ':s' => (string)($a['source'] ?? $d), ':p' => (string)($a['portee'] ?? 'autre'), ':l' => (string)($a['langue'] ?? 'fr'),
                      ':ts' => isset($a['ts']) && $a['ts'] ? (int)$a['ts'] : null, ':sp' => !empty($a['specifique']) ? 1 : 0, ':n' => $now]);
        $sel->execute([$url]); $aid = (int)$sel->fetchColumn();
        $hit->execute([$aid, $requeteId, $now, $now]);
        if (!vc_domaine_connu($d, $connus)) $dom->execute([$d, $now, $now, $url]);
        $n++;
    }
    return $n;
}

/** Planifie les requêtes du jour (une fois par requête et par jour). → nombre de tâches ajoutées */
function vc_planifier(PDO $pdo, bool $braveActif, ?int $maintenant = null): int {
    $now = $maintenant ?? time(); $jour = gmdate('Y-m-d', $now);
    $rows = $pdo->query('SELECT DISTINCT r.id, r.req FROM veille_requetes r JOIN veille_requete_biens rb ON rb.requete_id = r.id
                         JOIN veille_biens b ON b.bien = rb.bien WHERE r.actif = 1 AND r.pause_jusqu <= ' . (int)$now . ' AND b.vu_le >= ' . (int)($now - VC_JOURS_ACTIF * 86400))
                ->fetchAll(PDO::FETCH_ASSOC);
    $ins = $pdo->prepare('INSERT INTO veille_jobs (requete_id, jour) VALUES (?, ?) ON CONFLICT DO NOTHING');
    $n = 0;
    foreach ($rows as $r) {
        $req = json_decode((string)$r['req'], true) ?: [];
        if ((($req['type'] ?? '') === 'brave' || ($req['format'] ?? '') === 'brave_json') && !$braveActif) continue;
        $ins->execute([(int)$r['id'], $jour]); $n += $ins->rowCount();
    }
    return $n;
}

/** Une recherche Brave Search (API officielle) → [http, corps, erreur]. */
function vc_brave_http(string $q, string $langue, array $brave): array {
    $url = rtrim((string)($brave['endpoint'] ?? 'https://api.search.brave.com/res/v1/web/search'), '?') . '?'
         . http_build_query(['q' => $q, 'count' => 20, 'search_lang' => in_array($langue, ['fr', 'ar', 'en'], true) ? $langue : 'fr']);
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 15, CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS | CURLPROTO_HTTP, CURLOPT_HTTPHEADER => ['Accept: application/json', 'X-Subscription-Token: ' . $brave['cle']],
        CURLOPT_USERAGENT => 'FinanceMasterVeille/1.0']);
    $corps = curl_exec($ch); $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch); curl_close($ch);
    return ['http' => $http, 'corps' => $corps === false ? '' : (string)$corps, 'erreur' => $err];
}
/** La réponse JSON de Brave → articles (format de cfo_vp_bilan). null si ce n'est pas une réponse de recherche. */
function vc_lire_brave(string $corps, array $req, array $cfg): ?array { return cfo_vp_lire_brave($corps, $req, $cfg); }

/**
 * Un passage du cron : prend jusqu'à $o['lot'] tâches en attente, les télécharge, range les articles.
 * $o : lot, delai (s), maintenant, telecharger (callable($requetes,$delai,$budget) — cfo_vp_telecharger par défaut),
 *      brave ([cle, max_mois, endpoint] ou null), brave_http (callable($q,$langue,$brave)).
 * → ['taches' => n, 'articles' => n, 'statuts' => [statut => n], 'brave_appels' => n]
 */
function vc_collecter(PDO $pdo, array $cfg, array $o = []): array {
    $now = $o['maintenant'] ?? time(); $lot = max(1, (int)($o['lot'] ?? VC_LOT)); $delai = max(3, (int)($o['delai'] ?? 15));
    $telecharger = $o['telecharger'] ?? 'cfo_vp_telecharger'; $brave = $o['brave'] ?? null; $braveHttp = $o['brave_http'] ?? 'vc_brave_http';
    $jobs = $pdo->query("SELECT j.id, j.requete_id, r.req FROM veille_jobs j JOIN veille_requetes r ON r.id = j.requete_id
                         WHERE j.statut = 'attente' ORDER BY j.id LIMIT " . $lot)->fetchAll(PDO::FETCH_ASSOC);
    $bilan = ['taches' => count($jobs), 'articles' => 0, 'statuts' => [], 'brave_appels' => 0];
    if (!$jobs) return $bilan;
    $marquer = $pdo->prepare("UPDATE veille_jobs SET statut = ?, debut = COALESCE(debut, ?), fin = ?, n = ?, erreur = ? WHERE id = ?");
    $req = $pdo->prepare('UPDATE veille_requetes SET derniere = ?, dernier_statut = ?, n_ok = n_ok + ?, n_err = n_err + ?, pause_jusqu = ? WHERE id = ?');
    $pdo->exec("UPDATE veille_jobs SET statut = 'encours', debut = " . (int)$now . " WHERE id IN (" . implode(',', array_map(fn($j) => (int)$j['id'], $jobs)) . ")");
    $web = []; $braves = [];
    foreach ($jobs as $j) { $r = json_decode((string)$j['req'], true) ?: []; $j['r'] = $r; if (($r['type'] ?? '') === 'brave') $braves[] = $j; else $web[] = $j; }
    $finir = function (array $j, string $statut, int $n, string $err) use ($marquer, $req, $now, &$bilan) {
        $bloque = $statut === 'bloque';
        $marquer->execute([$statut, $now, $now, $n, $err !== '' ? mb_substr($err, 0, 300) : null, (int)$j['id']]);
        $req->execute([$now, $statut, in_array($statut, ['ok', 'vide'], true) ? 1 : 0, in_array($statut, ['ok', 'vide'], true) ? 0 : 1, $bloque ? $now + VC_PAUSE_BLOCAGE : 0, (int)$j['requete_id']]);
        $bilan['statuts'][$statut] = ($bilan['statuts'][$statut] ?? 0) + 1;
    };
    //  v37.137 : les requêtes web Brave (réseaux sociaux, forums, annonces) comptent aussi dans le plafond du mois
    $webB = array_values(array_filter($web, fn($j) => ($j['r']['format'] ?? '') === 'brave_json'));
    if ($webB) {
        $ok = $brave && !empty($brave['cle']) && vc_reserver_brave($pdo, count($webB), (int)($brave['max_mois'] ?? 1000), $now);
        if (!$ok) {
            $ids = array_map(fn($j) => (int)$j['id'], $webB);
            if (!$brave || empty($brave['cle'])) foreach ($webB as $j) $finir($j, 'saute', 0, 'pas de clé Brave');
            else { $pdo->exec("UPDATE veille_jobs SET statut = 'attente', debut = NULL WHERE id IN (" . implode(',', $ids) . ")");
                   $bilan['statuts']['budget'] = ($bilan['statuts']['budget'] ?? 0) + count($webB); }
            $web = array_values(array_filter($web, fn($j) => ($j['r']['format'] ?? '') !== 'brave_json'));
        } else $bilan['brave_appels'] += count($webB);
    }
    if ($web) {
        $reps = $telecharger(array_map(fn($j) => $j['r'], $web), $delai, $delai + 10);
        foreach ($web as $i => $j) {
            $x = $reps[$i] ?? ['http' => 0, 'corps' => '', 'erreur' => 'pas de réponse'];
            $http = (int)($x['http'] ?? 0);
            if ($http === 403 || $http === 429) { $finir($j, 'bloque', 0, 'HTTP ' . $http . ' : pause 24 h (aucun contournement)'); continue; }
            $b = cfo_vp_bilan($j['r'], $x, $cfg);
            $n = $b['articles'] ? vc_stocker($pdo, (int)$j['requete_id'], $b['articles'], $cfg, $now) : 0;
            $bilan['articles'] += $n;
            $finir($j, $b['statut'], $n, (string)($b['erreur'] ?? ''));
        }
    }
    foreach ($braves as $j) {
        if (!$brave || empty($brave['cle'])) { $finir($j, 'saute', 0, 'pas de clé Brave'); continue; }
        $mois = gmdate('Y-m', $now); $max = max(0, (int)($brave['max_mois'] ?? 1000));
        $pdo->prepare('INSERT INTO veille_budget (mois, appels) VALUES (?, 0) ON CONFLICT DO NOTHING')->execute([$mois]);
        $s = $pdo->prepare('UPDATE veille_budget SET appels = appels + 1 WHERE mois = :m AND appels < :max');   // réservé AVANT l'appel (entier lié en entier)
        $s->bindValue(':m', $mois); $s->bindValue(':max', $max, PDO::PARAM_INT); $s->execute();
        if ($s->rowCount() < 1) { $pdo->prepare("UPDATE veille_jobs SET statut = 'attente', debut = NULL WHERE id = ?")->execute([(int)$j['id']]);
                                   $bilan['statuts']['budget'] = ($bilan['statuts']['budget'] ?? 0) + 1; continue; }
        $bilan['brave_appels']++;
        $x = $braveHttp((string)$j['r']['q'], (string)($j['r']['langue'] ?? 'fr'), $brave);
        $http = (int)($x['http'] ?? 0);
        if (in_array($http, [401, 403, 429], true)) { $finir($j, 'bloque', 0, 'Brave HTTP ' . $http); continue; }
        if ($http < 200 || $http >= 300) { $finir($j, 'erreur', 0, 'Brave HTTP ' . $http . ' ' . ($x['erreur'] ?? '')); continue; }
        $arts = vc_lire_brave((string)($x['corps'] ?? ''), $j['r'], $cfg);
        if ($arts === null) { $finir($j, 'illisible', 0, 'réponse Brave inattendue'); continue; }
        $n = $arts ? vc_stocker($pdo, (int)$j['requete_id'], $arts, $cfg, $now) : 0;
        $bilan['articles'] += $n;
        $finir($j, $arts ? 'ok' : 'vide', $n, '');
    }
    return $bilan;
}

/** Le corpus d'un bien : les articles trouvés par SES requêtes, au format de la revue (marqués « memoire » = 1re vue). */
function vc_articles_bien(PDO $pdo, string $bien, ?int $maintenant = null, int $fenetreJours = 730): array {
    $now = $maintenant ?? time();
    $s = $pdo->prepare('SELECT DISTINCT a.id, a.url, a.domaine, a.titre, a.extrait, a.source, a.portee, a.langue, a.ts, a.specifique, a.premier
                        FROM veille_articles a JOIN veille_hits h ON h.article_id = a.id JOIN veille_requete_biens rb ON rb.requete_id = h.requete_id
                        WHERE rb.bien = ? AND a.dernier >= ? ORDER BY a.premier DESC LIMIT ' . VC_MAX_CORPUS);
    $s->execute([$bien, $now - $fenetreJours * 86400]);
    $out = [];
    foreach ($s->fetchAll(PDO::FETCH_ASSOC) as $a) {
        $ts = $a['ts'] !== null ? (int)$a['ts'] : null;
        $out[] = ['titre' => (string)$a['titre'], 'extrait' => (string)($a['extrait'] ?? ''), 'url' => (string)$a['url'], 'source' => (string)$a['source'],
                  'domaine' => (string)$a['domaine'], 'portee' => (string)($a['portee'] ?: 'autre'), 'ts' => $ts, 'date' => $ts ? gmdate('Y-m-d', $ts) : null,
                  'specifique' => (bool)$a['specifique'], 'langue' => (string)($a['langue'] ?: 'fr'), 'memoire' => gmdate('Y-m-d', (int)$a['premier'])];
    }
    return $out;
}

/** L'état de la collecte d'un bien (pour l'écran). */
function vc_etat_bien(PDO $pdo, string $bien): array {
    $q = fn(string $sql, array $p = []) => (function () use ($pdo, $sql, $p) { $s = $pdo->prepare($sql); $s->execute($p); return $s->fetchColumn(); })();
    $req = (int)$q('SELECT COUNT(*) FROM veille_requete_biens WHERE bien = ?', [$bien]);
    $art = (int)$q('SELECT COUNT(DISTINCT h.article_id) FROM veille_hits h JOIN veille_requete_biens rb ON rb.requete_id = h.requete_id WHERE rb.bien = ?', [$bien]);
    $der = $q("SELECT MAX(j.fin) FROM veille_jobs j JOIN veille_requete_biens rb ON rb.requete_id = j.requete_id WHERE rb.bien = ? AND j.statut IN ('ok','vide')", [$bien]);
    return ['requetes' => $req, 'articles' => $art, 'derniere' => $der ? (int)$der : null];
}

/** L'état général (commande « etat ») : tâches du jour, corpus, domaines proposés, budget Brave. */
function vc_etat(PDO $pdo, ?int $maintenant = null): array {
    $now = $maintenant ?? time(); $jour = gmdate('Y-m-d', $now);
    $col = fn(string $sql) => $pdo->query($sql)->fetchColumn();
    $jobs = [];
    foreach ($pdo->query("SELECT statut, COUNT(*) AS n FROM veille_jobs WHERE jour = '" . $jour . "' GROUP BY statut")->fetchAll(PDO::FETCH_ASSOC) as $r) $jobs[$r['statut']] = (int)$r['n'];
    return [
        'biens' => (int)$col('SELECT COUNT(*) FROM veille_biens'),
        'requetes' => (int)$col('SELECT COUNT(*) FROM veille_requetes'),
        'en_pause' => (int)$col('SELECT COUNT(*) FROM veille_requetes WHERE pause_jusqu > ' . (int)$now),
        'jobs_du_jour' => $jobs,
        'articles' => (int)$col('SELECT COUNT(*) FROM veille_articles'),
        'articles_24h' => (int)$col('SELECT COUNT(*) FROM veille_articles WHERE premier >= ' . (int)($now - 86400)),
        'domaines_proposes' => $pdo->query("SELECT domaine, vu, exemple FROM veille_domaines WHERE statut = 'propose' ORDER BY vu DESC, domaine LIMIT 15")->fetchAll(PDO::FETCH_ASSOC),
        'brave_appels_mois' => (int)($col("SELECT appels FROM veille_budget WHERE mois = '" . gmdate('Y-m', $now) . "'") ?: 0),
        //  v37.137 : la preuve que le cron tourne SANS l'appli — l'heure de la dernière tâche traitée, et combien au total
        'dernier_passage_cron' => ($dp = $col("SELECT MAX(fin) FROM veille_jobs WHERE statut NOT IN ('attente', 'encours')")) ? gmdate('Y-m-d H:i', (int)$dp) . ' UTC' : null,
        'taches_traitees' => (int)$col("SELECT COUNT(*) FROM veille_jobs WHERE statut NOT IN ('attente', 'encours')"),
    ];
}

/**
 * À la Recherche Éclair : mémorise le bien et ses requêtes, range ce qu'elles viennent de trouver, et rend le corpus du bien.
 * $trouves : [indice de $requetes => articles]. → ['corpus' => articles, 'etat' => vc_etat_bien]
 */
function vc_revue(PDO $pdo, array $lieux, array $sujets, array $requetes, array $trouves, array $cfg, ?int $maintenant = null): array {
    vc_schema($pdo);
    $bien = vc_cle_bien($lieux);
    $ids = vc_memoriser($pdo, $bien, $lieux, $sujets, $requetes, $maintenant);
    foreach ($trouves as $i => $arts) if (isset($ids[$i]) && $arts) vc_stocker($pdo, $ids[$i], $arts, $cfg, $maintenant);
    return ['corpus' => vc_articles_bien($pdo, $bien, $maintenant), 'etat' => vc_etat_bien($pdo, $bien)];
}
