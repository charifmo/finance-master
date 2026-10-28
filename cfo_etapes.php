<?php
// ============================================================================
// Finance Master v37.73 — LES ÉTAPES DU CFO, SUIVIES SANS UN SEUL TOKEN
// ----------------------------------------------------------------------------
// « Un timer est mieux, et tracker les étapes si ce n'est pas consommateur de tokens. »
// Le CFO passe déjà par le VPS aux moments qui comptent : le contexte
// (cfo_contexte.php), la simulation (pending_commit.php, route compile), la
// validation d'un OUI (le Committer relit le pending). Chacun de ces passages
// note une ligne ici ; l'appli la relit pendant l'attente et ne garde que les
// lignes nées depuis l'envoi de la question. Le modèle n'en voit rien.
//
//   GET    ?session_id=X  -> { etapes:[{code, libelle, il_y_a_ms}], maintenant }
//
// Inclus par cfo_contexte.php et pending_commit.php : seules les fonctions
// sont définies, le routage ne joue que si ce fichier est appelé directement.
// Une écriture qui échoue ne casse jamais le CFO : le suivi est un confort.
// ============================================================================

const CFO_ETAPES_MAX = 30;

function cfo_etapes_fichier(string $sid): ?string {
    $c = substr(preg_replace('/[^A-Za-z0-9_\-]/', '_', $sid), 0, 128);
    if ($c === '') return null;
    $d = __DIR__ . '/pending/etapes';
    if (!is_dir($d)) @mkdir($d, 0775, true);
    return $d . '/' . $c . '.json';
}

function cfo_etapes_lire(string $sid): array {
    $f = cfo_etapes_fichier($sid);
    if (!$f || !is_readable($f)) return [];
    $l = json_decode((string)@file_get_contents($f), true);
    return is_array($l) ? $l : [];
}

function cfo_etape_noter(string $sid, string $code, string $libelle = ''): void {
    $f = cfo_etapes_fichier($sid);
    if (!$f) return;
    $l = cfo_etapes_lire($sid);
    $l[] = ['code' => $code, 'libelle' => $libelle, 't' => round(microtime(true) * 1000)];
    @file_put_contents($f, json_encode(array_slice($l, -CFO_ETAPES_MAX), JSON_UNESCAPED_UNICODE), LOCK_EX);
}

function cfo_etapes_reponse(string $sid, ?float $maintenant = null): array {
    $now = $maintenant ?? round(microtime(true) * 1000);
    $out = [];
    foreach (cfo_etapes_lire($sid) as $e) {
        $out[] = ['code' => (string)($e['code'] ?? ''), 'libelle' => (string)($e['libelle'] ?? ''),
                  'il_y_a_ms' => max(0, (int)($now - (float)($e['t'] ?? $now)))];
    }
    return ['etapes' => $out, 'maintenant' => $now];
}

if (PHP_SAPI !== 'cli' && basename($_SERVER['SCRIPT_FILENAME'] ?? '') === basename(__FILE__)) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    $m = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($m === 'GET') {
        echo json_encode(cfo_etapes_reponse((string)($_GET['session_id'] ?? '')), JSON_UNESCAPED_UNICODE);
        exit;
    }
    http_response_code(405); echo '{"error":"methode"}';
}
