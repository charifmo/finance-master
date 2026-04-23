<?php
// Finance Master - Endpoint de sauvegarde VPS
// POST JSON brut -> ecrit dans finance_data.json (meme dossier)

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

// Preflight CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$dataFile = __DIR__ . '/finance_data.json';

// GET -> renvoie le JSON (pratique pour debug)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!file_exists($dataFile)) {
        http_response_code(200);
        echo '{}';
        exit;
    }
    echo file_get_contents($dataFile);
    exit;
}

// POST -> ecrit
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed', 'method' => $_SERVER['REQUEST_METHOD']]);
    exit;
}

$raw = file_get_contents('php://input');
if ($raw === false || $raw === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Empty body']);
    exit;
}

// Validation JSON
$decoded = json_decode($raw, true);
if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON', 'json_error' => json_last_error_msg()]);
    exit;
}

// Backup auto du fichier precedent avant ecriture
if (file_exists($dataFile)) {
    $backupDir = __DIR__ . '/backups';
    if (!is_dir($backupDir)) {
        @mkdir($backupDir, 0775, true);
    }
    if (is_dir($backupDir) && is_writable($backupDir)) {
        @copy($dataFile, $backupDir . '/finance_data_' . date('Ymd_His') . '.json');
        // Garde seulement les 30 dernieres sauvegardes
        $files = glob($backupDir . '/finance_data_*.json');
        if (is_array($files) && count($files) > 30) {
            usort($files, function ($a, $b) { return filemtime($a) - filemtime($b); });
            $toDelete = array_slice($files, 0, count($files) - 30);
            foreach ($toDelete as $f) { @unlink($f); }
        }
    }
}

// Ecriture atomique : .tmp -> rename
$tmpFile = $dataFile . '.tmp';
$bytes = file_put_contents($tmpFile, $raw, LOCK_EX);
if ($bytes === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Write failed', 'path' => $dataFile]);
    exit;
}
if (!@rename($tmpFile, $dataFile)) {
    @unlink($tmpFile);
    http_response_code(500);
    echo json_encode(['error' => 'Rename failed']);
    exit;
}

echo json_encode([
    'status' => 'ok',
    'bytes'  => $bytes,
    'time'   => date('c'),
    'file'   => basename($dataFile)
]);
