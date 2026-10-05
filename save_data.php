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
// v37.19 — UNE SEULE SOURCE, ET UNE VERSION
// ----------------------------------------------------------------------------
// MESURÉ (deux navigateurs, vrai save_data.php, Postgres réel) :
//   1. En mode Postgres, POST écrivait dans la base, mais l'application relisait
//      le FICHIER statique finance_data.json, que plus rien ne mettait à jour.
//      Un autre PC ouvrait donc l'appli sur un état ancien… et le ré-enregistrait.
//   2. Dans les deux modes, un onglet resté ouvert sur une version périmée
//      écrasait sans prévenir ce qu'un autre PC venait d'enregistrer.
// CORRECTION :
//   - GET sert exactement ce que POST écrit (Postgres, sinon le fichier), avec
//     l'en-tête X-Finance-Version (sha1 du texte servi).
//   - POST accepte X-Finance-Base : si le serveur a changé depuis cette version,
//     il REFUSE (409) au lieu d'écraser. Sans en-tête (agent n8n, anciens
//     onglets), il écrit comme avant.
//   - En mode Postgres, chaque écriture est recopiée dans finance_data.json :
//     anciens onglets et sauvegardes voient la même chose que la base.
// ════════════════════════════════════════════════════════════════════════════
header('Access-Control-Allow-Headers: Content-Type, Accept, X-Finance-Base');
header('Access-Control-Expose-Headers: X-Finance-Version, X-Finance-Mode');

function versionDe($texte) { return sha1((string)$texte); }

// État courant tel qu'on le sert : la base si elle a une ligne, sinon le fichier.
// (Une base fraîchement branchée mais encore vide ne doit pas masquer le fichier :
//  servir '{}' ferait repartir l'appli des valeurs par défaut, puis les enregistrer.)
function lireEtatCourant($pdo, $dataFile, $verrouiller = false) {
    if ($pdo) {
        $row = $pdo->query('SELECT data::text AS t FROM finance_state WHERE id = 1' . ($verrouiller ? ' FOR UPDATE' : ''))->fetch(PDO::FETCH_ASSOC);
        if ($row && $row['t'] !== null && $row['t'] !== '') return [$row['t'], 'postgres'];
    }
    if (file_exists($dataFile)) {
        $t = file_get_contents($dataFile);
        if ($t !== false && trim($t) !== '') return [$t, 'file'];
    }
    return ['{}', 'vide'];
}

// Écriture atomique du fichier, avec la rotation de sauvegardes historique.
function ecrireFichier($dataFile, $texte) {
    if (file_exists($dataFile)) {
        $backupDir = dirname($dataFile) . '/backups';
        if (!is_dir($backupDir)) @mkdir($backupDir, 0775, true);
        if (is_dir($backupDir) && is_writable($backupDir)) {
            @copy($dataFile, $backupDir . '/finance_data_' . date('Ymd_His') . '.json');
            $files = glob($backupDir . '/finance_data_*.json');
            if (is_array($files) && count($files) > 30) {
                usort($files, function ($a, $b) { return filemtime($a) - filemtime($b); });
                foreach (array_slice($files, 0, count($files) - 30) as $f) @unlink($f);
            }
        }
    }
    $tmp = $dataFile . '.tmp';
    if (file_put_contents($tmp, $texte, LOCK_EX) === false) return false;
    if (!@rename($tmp, $dataFile)) { @unlink($tmp); return false; }
    return true;
}

function conflit($versionCourante) {
    http_response_code(409);
    echo json_encode([
        'status'  => 'conflict',
        'version' => $versionCourante,
        'message' => 'Le serveur a été modifié depuis votre chargement (autre appareil, autre onglet ou agent CFO). Rien n\'a été écrasé.',
    ]);
    exit;
}

// ════════════════════════════════════════════════════════════════════════════
// GET — renvoie l'état financier (la même source que POST)
// ════════════════════════════════════════════════════════════════════════════
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        list($texte, $source) = lireEtatCourant($pdo, $dataFile);
    } catch (Exception $e) {
        error_log('[save_data.php] PG read failed, falling back to file: ' . $e->getMessage());
        list($texte, $source) = lireEtatCourant(null, $dataFile);
    }
    header('X-Finance-Version: ' . versionDe($texte));
    header('X-Finance-Mode: ' . $source);
    echo $texte;
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

// Version sur laquelle le client a travaillé (absente = écrivain historique : on écrit)
$base = isset($_SERVER['HTTP_X_FINANCE_BASE']) ? trim($_SERVER['HTTP_X_FINANCE_BASE']) : '';

// ── Mode Postgres : vérification + UPSERT dans UNE transaction ────────────
if ($mode === 'postgres') {
    try {
        $pdo->beginTransaction();
        // Un seul écrivain à la fois : la vérification et l'écriture sont indissociables.
        $pdo->query('SELECT pg_advisory_xact_lock(3719)');
        list($courant, ) = lireEtatCourant($pdo, $dataFile, true);
        if ($base !== '' && $base !== versionDe($courant)) {
            $pdo->rollBack();
            conflit(versionDe($courant));
        }
        $stmt = $pdo->prepare('
            INSERT INTO finance_state (id, data, updated_at)
            VALUES (1, :data::jsonb, now())
            ON CONFLICT (id) DO UPDATE
            SET data = EXCLUDED.data, updated_at = now()
            RETURNING data::text AS t
        ');
        $stmt->execute([':data' => $raw]);
        $stocke = $stmt->fetch(PDO::FETCH_ASSOC)['t'];
        $pdo->commit();
        // Miroir : le fichier suit la base (anciens onglets, sauvegardes, outils)
        $miroir = ecrireFichier($dataFile, $stocke);
        echo json_encode([
            'status'  => 'ok',
            'mode'    => 'postgres',
            'version' => versionDe($stocke),
            'bytes'   => strlen($raw),
            'time'    => date('c'),
            'table'   => 'finance_state',
            'miroir'  => $miroir ? 'finance_data.json' : 'échec',
        ]);
        exit;
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('[save_data.php] PG write failed, falling back to file: ' . $e->getMessage());
        // Fallback file ci-dessous
    }
}

// ── Mode fichier (legacy / fallback) : verrou, vérification, écriture ─────
$verrou = fopen($dataFile . '.lock', 'c');
if ($verrou) flock($verrou, LOCK_EX);
list($courant, ) = lireEtatCourant(null, $dataFile);
if ($base !== '' && $base !== versionDe($courant)) {
    if ($verrou) { flock($verrou, LOCK_UN); fclose($verrou); }
    conflit(versionDe($courant));
}
$ok = ecrireFichier($dataFile, $raw);
if ($verrou) { flock($verrou, LOCK_UN); fclose($verrou); }
if (!$ok) {
    http_response_code(500);
    echo json_encode(['error' => 'Write failed', 'path' => $dataFile]);
    exit;
}

echo json_encode([
    'status'  => 'ok',
    'mode'    => 'file',
    'version' => versionDe($raw),
    'bytes'   => strlen($raw),
    'time'    => date('c'),
    'file'    => basename($dataFile),
    'warning' => $dbConfig ? 'PG configured but connection failed — file fallback used. Check error_log.' : 'No db_config.php — file mode (volatile, not recommended).',
]);
