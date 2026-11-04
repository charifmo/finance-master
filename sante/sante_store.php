<?php
/**
 * Santé Master — LE STOCKAGE (même principe que save_data.php de Finance Master).
 *   Primaire : table PostgreSQL `sante_state` (une ligne, JSONB) dans la base de Finance Master — mêmes
 *   identifiants, lus dans ../db_config.php (jamais commité). Secours : sante_data.json, recopié à chaque
 *   écriture, avec 30 sauvegardes tournantes dans sante/backups/. Une version (sha1 du texte servi)
 *   empêche un onglet périmé d'écraser ce qu'un autre a écrit (409).
 *   La table vectorielle `sante_vectors` (RAG médical) est SÉPARÉE de finance_vectors.
 */
function sante_db_config(): ?array {
    $f = dirname(__DIR__) . '/db_config.php';
    if (!is_file($f)) return null;
    $c = include $f;
    if (!is_array($c)) return null;
    foreach (['host', 'port', 'dbname', 'user', 'password'] as $k) if (!isset($c[$k])) return null;
    return $c;
}
function sante_pdo(): ?PDO {
    static $pdo = false;
    if ($pdo !== false) return $pdo;
    $pdo = null;
    $c = sante_db_config();
    if (!$c || !extension_loaded('pdo_pgsql')) return null;
    try {
        $pdo = new PDO(sprintf('pgsql:host=%s;port=%s;dbname=%s', $c['host'], $c['port'], $c['dbname']), $c['user'], $c['password'],
                       [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 5]);
        $pdo->exec(file_get_contents(__DIR__ . '/sql/sante_state.sql'));
    } catch (Throwable $e) { error_log('[sante_store] PG : ' . $e->getMessage()); $GLOBALS['sante_pg_erreur'] = $e->getMessage(); $pdo = null; }
    return $pdo;
}
/**
 * Où vit le fichier de secours. Le dossier sante/ est créé par « git pull » — souvent par root : PHP (www-data) n'y
 * peut alors rien écrire. Second emplacement : pending/ (que install.sh donne à PHP, hors dépôt). On LIT le fichier
 * le plus récent des deux ; on ÉCRIT dans le dossier où PHP peut écrire (celui du fichier lu si possible).
 * $ecrivable : prédicat de dossier (injecté par les tests ; is_writable par défaut).
 */
function sante_choisir_fichier(array $candidats, ?callable $ecrivable = null): array {
    $ecrivable = $ecrivable ?: 'is_writable';
    $existants = array_values(array_filter($candidats, 'is_file'));
    usort($existants, fn($a, $b) => filemtime($b) <=> filemtime($a));
    $lecture = $existants[0] ?? $candidats[0];
    $ecriture = null;
    foreach (array_merge($existants ? [$lecture] : [], $candidats) as $f) if ($ecrivable(dirname($f))) { $ecriture = $f; break; }
    return ['lecture' => $lecture, 'ecriture' => $ecriture ?? $lecture, 'ecrivable' => $ecriture !== null];
}
function sante_candidats(): array { return [__DIR__ . '/sante_data.json', dirname(__DIR__) . '/pending/sante_data.json']; }
function sante_fichier(): string { return getenv('SANTE_DATA_FILE') ?: sante_choisir_fichier(sante_candidats())['ecriture']; }
function sante_fichier_lecture(): string { return getenv('SANTE_DATA_FILE') ?: sante_choisir_fichier(sante_candidats())['lecture']; }
function sante_version(string $t): string { return sha1($t); }

/** [texte, mode] : la base si elle a une ligne, sinon le fichier, sinon '{}'. */
function sante_lire(bool $verrou = false): array {
    $pdo = sante_pdo();
    if ($pdo) {
        $r = $pdo->query('SELECT data::text AS t FROM sante_state WHERE id = 1' . ($verrou ? ' FOR UPDATE' : ''))->fetch(PDO::FETCH_ASSOC);
        if ($r && $r['t'] !== null && $r['t'] !== '') return [$r['t'], 'postgres'];
    }
    $f = sante_fichier_lecture();
    if (is_file($f)) { $t = (string)file_get_contents($f); if (trim($t) !== '') return [$t, 'file']; }
    return ['{}', 'vide'];
}
function sante_ecrire_fichier(string $texte): bool {
    $f = sante_fichier();
    if (is_file($f)) {
        $dir = dirname($f) . '/backups';
        if (!is_dir($dir)) @mkdir($dir, 0775, true);
        if (is_dir($dir) && is_writable($dir)) {
            @copy($f, $dir . '/sante_data_' . date('Ymd_His') . '.json');
            $L = glob($dir . '/sante_data_*.json') ?: [];
            if (count($L) > 30) { usort($L, fn($a, $b) => filemtime($a) - filemtime($b)); foreach (array_slice($L, 0, count($L) - 30) as $x) @unlink($x); }
        }
    }
    $tmp = $f . '.tmp';
    if (@file_put_contents($tmp, $texte, LOCK_EX) === false) { $GLOBALS['sante_fichier_erreur'] = 'PHP ne peut pas écrire dans ' . dirname($f); error_log('[sante_store] ' . $GLOBALS['sante_fichier_erreur']); return false; }
    if (!@rename($tmp, $f)) { @unlink($tmp); $GLOBALS['sante_fichier_erreur'] = 'impossible de remplacer ' . $f; error_log('[sante_store] ' . $GLOBALS['sante_fichier_erreur']); return false; }
    return true;
}
/** Écrit l'état (tableau). $base = version connue du client : refus (conflit) si le serveur a changé depuis. */
function sante_ecrire(array $etat, ?string $base = null): array {
    $texte = json_encode($etat, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    if ($texte === false) return ['ok' => false, 'erreur' => 'JSON invalide'];
    $pdo = sante_pdo();
    try {
        if ($pdo) $pdo->beginTransaction();
        [$actuel] = sante_lire(true);
        if ($base !== null && $base !== '' && $base !== sante_version($actuel) && $actuel !== '{}') {
            if ($pdo) $pdo->rollBack();
            return ['ok' => false, 'conflit' => true, 'version' => sante_version($actuel)];
        }
        if ($pdo) {
            $st = $pdo->prepare('INSERT INTO sante_state (id, data, updated_at) VALUES (1, CAST(:d AS jsonb), now())
                                 ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()');
            $st->execute([':d' => $texte]);
            $pdo->commit();
        }
        $okF = sante_ecrire_fichier($texte);
        if (!$pdo && !$okF) return ['ok' => false, 'erreur' => 'écriture impossible — base : ' . ($GLOBALS['sante_pg_erreur'] ?? 'indisponible') . ' ; fichier : ' . ($GLOBALS['sante_fichier_erreur'] ?? 'inconnu')];
        [$relu] = sante_lire();
        return ['ok' => true, 'mode' => $pdo ? 'postgres' : 'file', 'version' => sante_version($relu)];
    } catch (Throwable $e) {
        if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
        return ['ok' => false, 'erreur' => $e->getMessage()];
    }
}
