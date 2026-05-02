<?php
// backup_legacy.php — Sauvegarde froide avant migration v15
// POST -> cree finance_data_v14_legacy.backup.json (idempotent : n'ecrase jamais)

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$dataFile   = __DIR__ . '/finance_data.json';
$backupFile = __DIR__ . '/finance_data_v14_legacy.backup.json';

// Idempotent : si le backup existe deja on ne l'ecrase pas
if (file_exists($backupFile)) {
    echo json_encode([
        'status' => 'already_exists',
        'file'   => basename($backupFile),
        'bytes'  => filesize($backupFile)
    ]);
    exit;
}

if (!file_exists($dataFile)) {
    echo json_encode(['status' => 'no_source', 'message' => 'finance_data.json introuvable']);
    exit;
}

if (@copy($dataFile, $backupFile)) {
    echo json_encode([
        'status' => 'ok',
        'file'   => basename($backupFile),
        'bytes'  => filesize($backupFile),
        'time'   => date('c')
    ]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Copy failed — verifier permissions dossier']);
}
