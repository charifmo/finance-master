<?php
// ============================================================================
// Finance Master v16.3 - Endpoint de sauvegarde DURABLE (Postgres + fallback)
// ----------------------------------------------------------------------------
// CHANGEMENT MAJEUR :
//   - Stockage primaire : table Postgres `finance_state` (1 ligne, JSONB)
//   - Fallback : finance_data.json (compat retro si DB indisponible)
//
// FAILLE CORRIGÉE :
//   Avant v16.3, l'état financier vivait dans /finance/finance_data.json
//   (fichier plat). Sur un VPS partagé / containerisé / soumis à git pull
//   automatique, ce fichier était écrasé ou perdu lors des redéploiements,
//   provoquant des "amnésies" : soldes à zéro, transactions disparues, etc.
//
// SETUP REQUIS :
//   1. Créer /finance/db_config.php (gitignored) — voir db_config.example.php
//   2. Vérifier que l'extension pdo_pgsql est activée (php -m | grep pgsql)
//   3. La table finance_state se crée toute seule au premier appel
// ============================================================================

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

// ── Mode Postgres : charge db_config.php si présent ────────────────────────
function loadDbConfig() {
    $configFile = __DIR__ . '/db_config.php';
    if (!file_exists($configFile)) return null;
    $cfg = include $configFile;
    if (!is_array($cfg)) return null;
    foreach (['host', 'port', 'dbname', 'user', 'password'] as $k) {
        if (!isset($cfg[$k])) return null;
    }
    return $cfg;
}

function pgConnect($cfg) {
    if (!extension_loaded('pdo_pgsql')) return null;
    $dsn = sprintf('pgsql:host=%s;port=%s;dbname=%s', $cfg['host'], $cfg['port'], $cfg['dbname']);
    try {
        $pdo = new PDO($dsn, $cfg['user'], $cfg['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 5,
        ]);
        // Auto-init du schéma (idempotent)
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS finance_state (
                id INTEGER PRIMARY KEY DEFAULT 1,
                data JSONB NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT finance_state_singleton CHECK (id = 1)
            );
        ");
        return $pdo;
    } catch (Exception $e) {
        error_log('[save_data.php] PG connect failed: ' . $e->getMessage());
        return null;
    }
}

$dbConfig = loadDbConfig();
$pdo = $dbConfig ? pgConnect($dbConfig) : null;
$mode = $pdo ? 'postgres' : 'file';

$dataFile = __DIR__ . '/finance_data.json';

// ════════════════════════════════════════════════════════════════════════════
// GET — renvoie l'état financier
// ════════════════════════════════════════════════════════════════════════════
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($mode === 'postgres') {
        try {
            $stmt = $pdo->query('SELECT data FROM finance_state WHERE id = 1');
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row && !empty($row['data'])) {
                echo $row['data'];
                exit;
            }
            // Première fois : la table existe mais est vide
            echo '{}';
            exit;
        } catch (Exception $e) {
            error_log('[save_data.php] PG read failed, falling back to file: ' . $e->getMessage());
            // Fallback file en lecture seule
        }
    }
    if (!file_exists($dataFile)) {
        http_response_code(200);
        echo '{}';
        exit;
    }
    echo file_get_contents($dataFile);
    exit;
}

// ════════════════════════════════════════════════════════════════════════════
// POST — sauvegarde l'état financier
// ════════════════════════════════════════════════════════════════════════════
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

// ── Mode Postgres : UPSERT atomique ──────────────────────────────────────
if ($mode === 'postgres') {
    try {
        $stmt = $pdo->prepare('
            INSERT INTO finance_state (id, data, updated_at)
            VALUES (1, :data::jsonb, now())
            ON CONFLICT (id) DO UPDATE
            SET data = EXCLUDED.data, updated_at = now()
        ');
        $stmt->execute([':data' => $raw]);
        echo json_encode([
            'status' => 'ok',
            'mode'   => 'postgres',
            'bytes'  => strlen($raw),
            'time'   => date('c'),
            'table'  => 'finance_state',
        ]);
        exit;
    } catch (Exception $e) {
        error_log('[save_data.php] PG write failed, falling back to file: ' . $e->getMessage());
        // Fallback file ci-dessous
    }
}

// ── Mode fichier (legacy / fallback) ──────────────────────────────────────
// Backup auto avant écriture
if (file_exists($dataFile)) {
    $backupDir = __DIR__ . '/backups';
    if (!is_dir($backupDir)) {
        @mkdir($backupDir, 0775, true);
    }
    if (is_dir($backupDir) && is_writable($backupDir)) {
        @copy($dataFile, $backupDir . '/finance_data_' . date('Ymd_His') . '.json');
        $files = glob($backupDir . '/finance_data_*.json');
        if (is_array($files) && count($files) > 30) {
            usort($files, function ($a, $b) { return filemtime($a) - filemtime($b); });
            $toDelete = array_slice($files, 0, count($files) - 30);
            foreach ($toDelete as $f) { @unlink($f); }
        }
    }
}

// Écriture atomique
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
    'mode'   => 'file',
    'bytes'  => $bytes,
    'time'   => date('c'),
    'file'   => basename($dataFile),
    'warning' => $dbConfig ? 'PG configured but connection failed — file fallback used. Check error_log.' : 'No db_config.php — file mode (volatile, not recommended).',
]);
