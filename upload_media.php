<?php
// upload_media.php — Upload logo / favicon pour Finance Master v15
// POST multipart : champ "file" (image) + champ "type" (logo|favicon)
// Sauvegarde dans /assets/, retourne l'URL absolue.

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ── Validation type ──────────────────────────────────────────────────
$type = trim($_POST['type'] ?? 'logo');
if (!in_array($type, ['logo', 'favicon'], true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Parametre "type" invalide. Valeurs acceptees : logo | favicon']);
    exit;
}

// ── Validation fichier ───────────────────────────────────────────────
if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    $codes = [1=>'INI_SIZE',2=>'FORM_SIZE',3=>'PARTIAL',4=>'NO_FILE',6=>'NO_TMP_DIR',7=>'CANT_WRITE',8=>'EXTENSION'];
    $code  = $_FILES['file']['error'] ?? 4;
    http_response_code(400);
    echo json_encode(['error' => 'Erreur upload', 'code' => $codes[$code] ?? $code]);
    exit;
}

$allowedMime = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'
];
$maxSize = 2 * 1024 * 1024; // 2 MB

// Verification MIME via finfo (plus sure que l'extension)
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime  = finfo_file($finfo, $_FILES['file']['tmp_name']);
finfo_close($finfo);

if (!in_array($mime, $allowedMime, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Type MIME non autorise : ' . $mime, 'allowed' => $allowedMime]);
    exit;
}

if ($_FILES['file']['size'] > $maxSize) {
    http_response_code(400);
    echo json_encode(['error' => 'Fichier trop volumineux (max 2 Mo)', 'size' => $_FILES['file']['size']]);
    exit;
}

// ── Preparation dossier assets/ ──────────────────────────────────────
$assetsDir = __DIR__ . '/assets/';
if (!is_dir($assetsDir)) {
    if (!@mkdir($assetsDir, 0775, true)) {
        http_response_code(500);
        echo json_encode(['error' => 'Impossible de creer le dossier assets/']);
        exit;
    }
}

// Extension propre
$extMap = [
    'image/jpeg'                    => 'jpg',
    'image/png'                     => 'png',
    'image/gif'                     => 'gif',
    'image/webp'                    => 'webp',
    'image/svg+xml'                 => 'svg',
    'image/x-icon'                  => 'ico',
    'image/vnd.microsoft.icon'      => 'ico',
];
$ext      = $extMap[$mime] ?? 'png';
$filename = $type . '.' . $ext;
$dest     = $assetsDir . $filename;

if (!@move_uploaded_file($_FILES['file']['tmp_name'], $dest)) {
    http_response_code(500);
    echo json_encode(['error' => 'Deplacement du fichier echoue — verifier permissions']);
    exit;
}

// Cache-bust via timestamp
$url = '/finance/assets/' . $filename . '?v=' . time();

echo json_encode([
    'status'   => 'ok',
    'type'     => $type,
    'url'      => $url,
    'filename' => $filename,
    'mime'     => $mime,
    'bytes'    => filesize($dest),
    'time'     => date('c')
]);
