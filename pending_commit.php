<?php
// ============================================================================
// Finance Master v13.5 - Pending Commit Cache (Stateful Tools)
// ----------------------------------------------------------------------------
// Stocke par session_id la simulation produite par Budget Engine, en attente
// du "OUI" utilisateur. Le Committer lit le fichier puis le supprime.
//
//   POST   /finance/pending_commit.php
//          body JSON : { session_id, finance_data, operations, annee }
//          -> écrit /var/www/finance/pending/<sanitized_session_id>.json
//
//   GET    /finance/pending_commit.php?session_id=XXXX
//          -> renvoie le payload JSON (404 si rien, 410 si expiré >30min)
//
//   DELETE /finance/pending_commit.php?session_id=XXXX
//          -> supprime le fichier (idempotent)
//
// Sécurité :
//   - session_id sanitizé (regex [^A-Za-z0-9_-])
//   - TTL 30 minutes : auto-expire si l'utilisateur ne valide pas à temps
// ============================================================================

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

// CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$pendingDir = __DIR__ . '/pending';
if (!is_dir($pendingDir)) {
    @mkdir($pendingDir, 0775, true);
}
if (!is_dir($pendingDir) || !is_writable($pendingDir)) {
    http_response_code(500);
    echo json_encode(['error' => 'pending dir not writable', 'path' => $pendingDir]);
    exit;
}

function sanitize_session_id($s) {
    $clean = preg_replace('/[^A-Za-z0-9_\-]/', '_', (string)$s);
    return substr($clean, 0, 128);
}

function session_file($sessionId, $dir) {
    $clean = sanitize_session_id($sessionId);
    if ($clean === '') return null;
    return $dir . '/' . $clean . '.json';
}

$method = $_SERVER['REQUEST_METHOD'];
$ttlSeconds = 1800; // 30 min

// ── GET ─────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $sid = $_GET['session_id'] ?? '';
    if ($sid === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Missing session_id query param']);
        exit;
    }
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
    if ($raw === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Read failed']);
        exit;
    }
    echo $raw;
    exit;
}

// ── POST ────────────────────────────────────────────────────────────────────
if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Empty body']);
        exit;
    }
    $body = json_decode($raw, true);
    if (!is_array($body) || empty($body['session_id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid body : need {session_id, finance_data, operations, annee}']);
        exit;
    }

    $sid = (string)$body['session_id'];
    $f = session_file($sid, $pendingDir);
    if (!$f) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid session_id']);
        exit;
    }

    if (empty($body['finance_data']) || !is_array($body['finance_data'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing finance_data (the simulated state)']);
        exit;
    }

    $payload = [
        'session_id' => $sid,
        'created_at' => date('c'),
        'created_ts' => time(),
        'annee'      => $body['annee'] ?? null,
        'operations' => $body['operations'] ?? [],
        'finance_data' => $body['finance_data'],
    ];

    $tmp = $f . '.tmp';
    $bytes = file_put_contents($tmp, json_encode($payload, JSON_UNESCAPED_UNICODE), LOCK_EX);
    if ($bytes === false || !@rename($tmp, $f)) {
        @unlink($tmp);
        http_response_code(500);
        echo json_encode(['error' => 'Write failed']);
        exit;
    }

    echo json_encode([
        'status'     => 'ok',
        'session_id' => $sid,
        'bytes'      => $bytes,
        'created_at' => $payload['created_at'],
        'ttl_sec'    => $ttlSeconds,
        'file'       => basename($f),
    ]);
    exit;
}

// ── DELETE ──────────────────────────────────────────────────────────────────
if ($method === 'DELETE') {
    $sid = $_GET['session_id'] ?? '';
    if ($sid === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Missing session_id query param']);
        exit;
    }
    $f = session_file($sid, $pendingDir);
    if (!$f) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid session_id']);
        exit;
    }
    if (file_exists($f)) {
        @unlink($f);
        echo json_encode(['status' => 'ok', 'deleted' => true, 'session_id' => $sid]);
    } else {
        echo json_encode(['status' => 'ok', 'deleted' => false, 'reason' => 'no pending', 'session_id' => $sid]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed', 'method' => $method, 'allowed' => ['GET', 'POST', 'DELETE']]);
