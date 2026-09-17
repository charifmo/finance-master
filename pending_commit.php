<?php
// ============================================================================
// Finance Master v35.0 — Pending Commit + Intent Compiler serveur
// ----------------------------------------------------------------------------
// Ce fichier remplace la v13.5. Il CONSERVE intégralement l'ancien contrat —
// le Committer n8n et le front n'ont rien à changer :
//
//   GET    ?session_id=X                        -> le payload en attente (404 / 410)
//   DELETE ?session_id=X                        -> supprime (idempotent)
//   POST   {session_id, action:"cancel_pending"} -> annule la simulation en attente
//   POST   {session_id, finance_data, operations, annee} -> écriture brute (legacy)
//
// ET AJOUTE LA ROUTE QUI DÉPORTE LE MÉTIER DEPUIS n8n :
//
//   POST   {session_id, calls:[{function,args}]} -> COMPILE
//          1. lit l'état financier réel (Postgres finance_state, repli fichier)
//          2. traduit les calls via le catalogue strict
//          3. résout les entités (Levenshtein), applique les mutations,
//             calcule snapshots et deltas          [cfo_intent_engine.php]
//          4. écrit le pending (TTL 30 min)
//          5. renvoie un résumé JSON au nœud n8n
//
// Le nœud n8n « Intent Compiler » n'est plus qu'un POST vers cette route.
//
// POURQUOI LE MOTEUR EST DANS UN FICHIER SÉPARÉ
//   1 100 lignes de logique budgétaire dans le même fichier que le routage HTTP
//   redonnerait ici le monstre qu'on vient de sortir de n8n. cfo_intent_engine.php
//   est du métier pur, sans I/O : testable en ligne de commande, sans serveur.
//
// SETUP : identique à save_data.php — db_config.php + extension pdo_pgsql.
//         Le dossier ./pending doit être accessible en écriture par www-data.
// ============================================================================

// v35.1 : en CLI (script de diagnostic qui inclut ce fichier), header() n'a pas
//   de sens et déclenche « headers already sent » — on ne l'appelle qu'en web.
if (PHP_SAPI !== 'cli') {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Accept');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
}

// ────────────────────────────────────────────────────────────────────────────
// v35.1 — FILET ANTI-500-MUET
// Une erreur fatale non rattrapable (mémoire épuisée, temps dépassé, parse
// error d'un fichier inclus) ne passe par aucun try/catch : PHP meurt, le
// reverse-proxy renvoie un 500 sans corps, et la cause disparaît. Ce handler
// de shutdown la récupère via error_get_last() et la renvoie en JSON avec le
// FICHIER et la LIGNE exacts. Coût nul quand tout va bien.
// ────────────────────────────────────────────────────────────────────────────
register_shutdown_function(function () {
    $e = error_get_last();
    if (!$e || !in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR], true)) return;
    if (!headers_sent()) { http_response_code(500); header('Content-Type: application/json; charset=utf-8'); }
    echo "\n", json_encode([
        'status'  => 'error',
        'error'   => 'FATAL_PHP',
        'message' => $e['message'],
        'file'    => $e['file'],
        'line'    => $e['line'],
        'hint'    => 'Erreur fatale non rattrapable (mémoire, timeout, parse). Voir file/line.',
        'pending_saved' => false,
    ], JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR);
});

require_once __DIR__ . '/cfo_intent_engine.php';

function sanitize_session_id($s) {
    $clean = preg_replace('/[^A-Za-z0-9_\-]/', '_', (string)$s);
    return substr($clean, 0, 128);
}
function session_file($sessionId, $dir) {
    $clean = sanitize_session_id($sessionId);
    if ($clean === '') return null;
    return $dir . '/' . $clean . '.json';
}

// v35.1 : inclus depuis un script CLI de diagnostic (debug_500.php) → on ne
//   définit que les fonctions et on rend la main, sans jouer le routage HTTP.
if (PHP_SAPI === 'cli') { return; }

$pendingDir = __DIR__ . '/pending';
if (!is_dir($pendingDir)) { @mkdir($pendingDir, 0775, true); }
if (!is_dir($pendingDir) || !is_writable($pendingDir)) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'error'  => 'PENDING_DIR_NOT_WRITABLE',
        'path'   => $pendingDir,
        'hint'   => 'chown -R www-data:www-data ' . __DIR__ . ' puis vérifier que ' . $pendingDir . ' existe et est inscriptible.',
        'pending_saved' => false,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$ttlSeconds = 1800; // 30 min

// ════════════════════════════════════════════════════════════════════════════
// LECTURE DE L'ÉTAT FINANCIER — même contrat de stockage que save_data.php
// (Postgres finance_state, ligne unique id=1, colonne data JSONB ; repli fichier)
// Décodage en OBJETS et non en tableaux associatifs : json_decode(..., true)
// transformerait un « revenus: {} » vide en « [] » au ré-encodage, et l'appli Vue,
// qui fait Object.entries(y.revenus), casserait.
// ════════════════════════════════════════════════════════════════════════════
function cfo_load_finance_state() {
    $cfgFile = __DIR__ . '/db_config.php';
    if (file_exists($cfgFile)) {
        $cfg = include $cfgFile;
        $ok = is_array($cfg);
        foreach (['host','port','dbname','user','password'] as $k) { if (!isset($cfg[$k])) $ok = false; }
        if ($ok && extension_loaded('pdo_pgsql')) {
            try {
                $pdo = new PDO(
                    sprintf('pgsql:host=%s;port=%s;dbname=%s', $cfg['host'], $cfg['port'], $cfg['dbname']),
                    $cfg['user'], $cfg['password'],
                    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 5]
                );
                $row = $pdo->query('SELECT data FROM finance_state WHERE id = 1')->fetch(PDO::FETCH_ASSOC);
                if ($row && !empty($row['data'])) {
                    $d = json_decode($row['data']);
                    if (is_object($d)) return [$d, 'postgres'];
                }
            } catch (Exception $e) {
                error_log('[pending_commit.php] PG read failed: ' . $e->getMessage());
            }
        }
    }
    $f = __DIR__ . '/finance_data.json';
    if (file_exists($f)) {
        $d = json_decode((string)file_get_contents($f));
        if (is_object($d)) return [$d, 'file'];
    }
    return [null, 'none'];
}

function cfo_write_pending(string $f, array $payload, int $ttl) {
    $tmp = $f . '.tmp';
    $bytes = file_put_contents($tmp, json_encode($payload, JSON_UNESCAPED_UNICODE), LOCK_EX);
    if ($bytes === false || !@rename($tmp, $f)) { @unlink($tmp); return false; }
    return $bytes;
}

// ════════════════════════════════════════════════════════════════════════════
// GET — récupère le pending (lu par le Committer)
// ════════════════════════════════════════════════════════════════════════════
if ($method === 'GET') {
    $sid = $_GET['session_id'] ?? '';
    if ($sid === '') { http_response_code(400); echo json_encode(['error' => 'Missing session_id query param']); exit; }
    $f = session_file($sid, $pendingDir);
    if (!$f || !file_exists($f)) {
        http_response_code(404);
        echo json_encode(['error' => 'No pending commit for this session', 'session_id' => $sid]);
        exit;
    }
    $age = time() - filemtime($f);
    if ($age > $ttlSeconds) {
        @unlink($f);
        http_response_code(410);
        echo json_encode(['error' => 'Pending expired (TTL 30min)', 'session_id' => $sid, 'age_sec' => $age]);
        exit;
    }
    $raw = file_get_contents($f);
    if ($raw === false) { http_response_code(500); echo json_encode(['error' => 'Read failed']); exit; }
    echo $raw;
    exit;
}

// ════════════════════════════════════════════════════════════════════════════
// POST
// ════════════════════════════════════════════════════════════════════════════
if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') { http_response_code(400); echo json_encode(['error' => 'Empty body']); exit; }
    $body = json_decode($raw);
    if (!is_object($body) || empty($body->session_id)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid body : need {session_id, calls} or {session_id, finance_data, operations, annee}']);
        exit;
    }
    $sid = (string)$body->session_id;
    $f = session_file($sid, $pendingDir);
    if (!$f) { http_response_code(400); echo json_encode(['error' => 'Invalid session_id']); exit; }

    // ── Abort / Cancel (v31.00, inchangé) ───────────────────────────────────
    if (isset($body->action) && $body->action === 'cancel_pending') {
        $existed = file_exists($f);
        if ($existed) { @unlink($f); }
        echo json_encode(['status'=>'cancelled','session_id'=>$sid,'was_pending'=>$existed,'cancelled_at'=>date('c')]);
        exit;
    }

    // ── ROUTE COMPILE (v35.0) : { session_id, calls:[{function,args}] } ──────
    if (isset($body->calls)) {
        if (!is_array($body->calls) || !count($body->calls)) {
            http_response_code(400);
            echo json_encode(['error'=>'Parametre calls vide. Format : { calls: [{ function, args }] }',
                              'catalogue'=>cfo_catalog_names(), 'pending_saved'=>false]);
            exit;
        }

        // L'état vient du serveur. Un finance_data explicite dans le corps reste
        // accepté (tests, rejeu) mais n'est jamais nécessaire au fonctionnement.
        if (isset($body->finance_data) && is_object($body->finance_data)) {
            $fd = $body->finance_data; $stateSource = 'body';
        } else {
            list($fd, $stateSource) = cfo_load_finance_state();
        }
        if (!is_object($fd) || !isset($fd->donneesAnnuelles)) {
            http_response_code(503);
            echo json_encode(['error'=>'Etat financier illisible (donneesAnnuelles absent).',
                              'state_source'=>$stateSource, 'pending_saved'=>false]);
            exit;
        }

        $ctx = [
            'monthlyNetFromPayload' => (isset($body->surplus_mensuel_net_courant) && is_array($body->surplus_mensuel_net_courant))
                ? $body->surplus_mensuel_net_courant : null,
        ];

        try {
            $res = cfo_compile($body->calls, $fd, $ctx);
        } catch (Throwable $e) {
            // v35.1 : le message seul ne suffisait pas à localiser la panne.
            //   On renvoie la classe, le fichier, la ligne et les premières
            //   frames — c'est ce corps que le nœud n8n relaie désormais tel quel.
            http_response_code(500);
            $frames = [];
            foreach (array_slice($e->getTrace(), 0, 5) as $f) {
                $frames[] = ($f['function'] ?? '?') . '() @ ' . basename($f['file'] ?? '?') . ':' . ($f['line'] ?? '?');
            }
            echo json_encode([
                'status'  => 'error',
                'error'   => 'COMPILE_EXCEPTION',
                'class'   => get_class($e),
                'message' => $e->getMessage(),
                'file'    => $e->getFile(),
                'line'    => $e->getLine(),
                'trace'   => $frames,
                'pending_saved' => false,
            ], JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR);
            exit;
        }

        $internal = $res['_internal'] ?? null;
        unset($res['_internal']);

        // Hors catalogue / clarification : rien n'a été muté, rien à enregistrer.
        if (!$internal) {
            $res['state_source'] = $stateSource;
            echo json_encode($res, JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR);
            exit;
        }

        $res['pending_saved'] = false;
        $res['pending_error'] = null;
        if ($internal['valid'] && $internal['has_effective']) {
            $payload = [
                'session_id'   => $sid,
                'created_at'   => date('c'),
                'created_ts'   => time(),
                'annee'        => $internal['annee_payload'],
                'operations'   => $internal['operations'],
                'finance_data' => $internal['finance_data'],
            ];
            $bytes = cfo_write_pending($f, $payload, $ttlSeconds);
            if ($bytes === false) { $res['pending_error'] = 'Write failed'; }
            else { $res['pending_saved'] = true; $res['pending_bytes'] = $bytes; }
        }

        $res['session_id']  = $sid;
        $res['state_source'] = $stateSource;
        $res['ttl_sec']     = $ttlSeconds;
        echo json_encode($res, JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR);
        exit;
    }

    // ── ROUTE LEGACY : écriture brute d'un pending déjà calculé ──────────────
    if (empty($body->finance_data) || !is_object($body->finance_data)) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing finance_data (the simulated state)']);
        exit;
    }
    $payload = [
        'session_id'   => $sid,
        'created_at'   => date('c'),
        'created_ts'   => time(),
        'annee'        => $body->annee ?? null,
        'operations'   => $body->operations ?? [],
        'finance_data' => $body->finance_data,
    ];
    $bytes = cfo_write_pending($f, $payload, $ttlSeconds);
    if ($bytes === false) { http_response_code(500); echo json_encode(['error' => 'Write failed']); exit; }

    echo json_encode(['status'=>'ok','session_id'=>$sid,'bytes'=>$bytes,
                      'created_at'=>$payload['created_at'],'ttl_sec'=>$ttlSeconds,'file'=>basename($f)]);
    exit;
}

// ════════════════════════════════════════════════════════════════════════════
// DELETE — nettoyage après commit (inchangé)
// ════════════════════════════════════════════════════════════════════════════
if ($method === 'DELETE') {
    $sid = $_GET['session_id'] ?? '';
    if ($sid === '') { http_response_code(400); echo json_encode(['error' => 'Missing session_id query param']); exit; }
    $f = session_file($sid, $pendingDir);
    if (!$f) { http_response_code(400); echo json_encode(['error' => 'Invalid session_id']); exit; }
    if (file_exists($f)) { @unlink($f); echo json_encode(['status'=>'ok','deleted'=>true,'session_id'=>$sid]); }
    else { echo json_encode(['status'=>'ok','deleted'=>false,'reason'=>'no pending','session_id'=>$sid]); }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed', 'method' => $method, 'allowed' => ['GET', 'POST', 'DELETE']]);
