<?php
/**
 * ============================================================================
 *  get_ai_memory.php — supervision de la mémoire de l'agent (v37.0)
 * ----------------------------------------------------------------------------
 *  GET /finance/get_ai_memory.php              → les deux tables
 *  GET /finance/get_ai_memory.php?table=rag    → règles mémorisées seules
 *  GET /finance/get_ai_memory.php?table=chat   → conversations seules
 *  Paramètres : limit (défaut 100, max 500), q (filtre plein texte simple)
 *
 *  ⚠️  EXPOSITION — À LIRE
 *  Cet endpoint renvoie des RÈGLES MÉTIER et des CONVERSATIONS PASSÉES. C'est
 *  plus sensible que le reste de l'application. Aucun autre fichier de ce
 *  dossier n'est protégé (save_data.php accepte d'écraser tout l'état financier
 *  sans authentification) : je ne prétends donc pas « sécuriser » quoi que ce
 *  soit ici, mais je ne veux pas aggraver l'exposition en silence.
 *
 *  Pour exiger un jeton, ajoutez dans db_config.php :
 *      'ai_memory_token' => 'une-chaine-longue-et-aleatoire',
 *  puis appelez avec ?token=... (ou l'en-tête X-Auth-Token). Sans cette clé,
 *  l'endpoint répond mais signale son ouverture dans le champ `avertissement`.
 *
 *  La colonne `embedding` n'est JAMAIS lue : des milliers de flottants, inutiles
 *  à l'écran et coûteux à transporter.
 * ============================================================================
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function sortie(array $p, int $code = 200) {
    http_response_code($code);
    echo json_encode($p, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
    exit;
}

$cfgFile = __DIR__ . '/db_config.php';
if (!file_exists($cfgFile)) {
    sortie(['status' => 'error', 'error' => 'CONFIG_ABSENTE',
            'message' => "db_config.php introuvable. Copiez db_config.example.php et renseignez les accès Postgres."], 503);
}
$cfg = include $cfgFile;
if (!is_array($cfg)) sortie(['status'=>'error','error'=>'CONFIG_INVALIDE','message'=>'db_config.php ne retourne pas un tableau.'], 503);

/* ── Jeton facultatif ─────────────────────────────────────────────────────── */
$tokenAttendu = $cfg['ai_memory_token'] ?? null;
$avertissement = null;
if ($tokenAttendu) {
    $fourni = $_GET['token'] ?? ($_SERVER['HTTP_X_AUTH_TOKEN'] ?? '');
    if (!hash_equals((string)$tokenAttendu, (string)$fourni)) {
        sortie(['status'=>'error','error'=>'NON_AUTORISE','message'=>'Jeton manquant ou invalide.'], 403);
    }
} else {
    $avertissement = "Endpoint ouvert : aucun 'ai_memory_token' dans db_config.php. "
                   . "Vos conversations sont lisibles par quiconque connaît l'URL.";
}

if (!extension_loaded('pdo_pgsql')) {
    sortie(['status'=>'error','error'=>'PDO_PGSQL_ABSENT',
            'message'=>"L'extension pdo_pgsql n'est pas chargée. Sur le VPS : apt install php-pgsql && systemctl reload php-fpm"], 503);
}

/* ── Connexion, avec repli sur les hôtes plausibles ───────────────────────── */
//  L'hôte varie selon la configuration Docker ('postgres-psy' ne résout pas
//  toujours depuis le conteneur PHP — panne déjà constatée). Plutôt que
//  d'échouer sur le premier essai, on tente les candidats et on DIT lequel a
//  répondu, pour que la configuration puisse être corrigée en connaissance de
//  cause.
$candidats = array_values(array_unique(array_filter([
    $cfg['host'] ?? null, 'localhost', '127.0.0.1', 'postgres', 'postgres-psy', 'db',
])));
$pdo = null; $hoteRetenu = null; $echecs = [];
foreach ($candidats as $h) {
    try {
        $pdo = new PDO(
            sprintf('pgsql:host=%s;port=%s;dbname=%s', $h, $cfg['port'] ?? '5432', $cfg['dbname'] ?? ''),
            $cfg['user'] ?? '', $cfg['password'] ?? '',
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 4]
        );
        $hoteRetenu = $h;
        break;
    } catch (Throwable $e) {
        $echecs[$h] = $e->getMessage();
        $pdo = null;
    }
}
if (!$pdo) {
    sortie(['status'=>'error','error'=>'POSTGRES_INJOIGNABLE',
            'message'=>"Aucun hôte Postgres n'a répondu.",
            'hotes_tentes'=>$echecs,
            'indice'=>"Corrigez 'host' dans db_config.php avec celui qui fonctionne depuis ce conteneur."], 503);
}

/* ── Introspection : on ne SELECT que des colonnes qui existent ───────────── */
function colonnes(PDO $pdo, string $table): array {
    $st = $pdo->prepare("SELECT column_name FROM information_schema.columns WHERE table_name = :t");
    $st->execute([':t' => $table]);
    return array_map(fn($r) => $r['column_name'], $st->fetchAll(PDO::FETCH_ASSOC));
}
/** Première colonne existante parmi les candidates, sinon null. */
function col(array $dispo, array $cands): ?string {
    foreach ($cands as $c) if (in_array($c, $dispo, true)) return $c;
    return null;
}
function decodeJson($v) {
    if (is_array($v) || is_object($v)) return $v;
    if (!is_string($v) || $v === '') return null;
    $d = json_decode($v, true);
    return json_last_error() === JSON_ERROR_NONE ? $d : $v;
}

$limite = max(1, min(500, (int)($_GET['limit'] ?? 100)));
$filtre = trim((string)($_GET['q'] ?? ''));
$table  = $_GET['table'] ?? 'all';
$out = ['status'=>'ok', 'hote'=>$hoteRetenu, 'genere_a'=>date('c')];
if ($avertissement) $out['avertissement'] = $avertissement;

/* ── 1. finance_vectors : les règles mémorisées (RAG) ─────────────────────── */
if ($table === 'all' || $table === 'rag') {
    try {
        $dispo = colonnes($pdo, 'finance_vectors');
        if (!$dispo) throw new RuntimeException("table 'finance_vectors' absente de cette base");
        $cId  = col($dispo, ['id']);
        $cTxt = col($dispo, ['text', 'content', 'document', 'page_content', 'texte']);
        $cMet = col($dispo, ['metadata', 'meta', 'metadatas']);
        if (!$cTxt) throw new RuntimeException('aucune colonne de texte reconnue (colonnes : ' . implode(', ', $dispo) . ')');

        $sel = array_filter([$cId, $cTxt, $cMet]);
        $sql = 'SELECT ' . implode(', ', array_map(fn($c) => '"' . $c . '"', $sel)) . ' FROM finance_vectors';
        $params = [];
        if ($filtre !== '') { $sql .= ' WHERE "' . $cTxt . '" ILIKE :q'; $params[':q'] = '%' . $filtre . '%'; }
        $sql .= ($cId ? ' ORDER BY "' . $cId . '" DESC' : '') . ' LIMIT ' . $limite;
        $st = $pdo->prepare($sql); $st->execute($params);

        $regles = [];
        foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $texte = (string)($r[$cTxt] ?? '');
            $regles[] = [
                'id'        => $cId ? $r[$cId] : null,
                'texte'     => $texte,
                'longueur'  => mb_strlen($texte),
                'metadata'  => $cMet ? decodeJson($r[$cMet] ?? null) : null,
            ];
        }
        $out['rag'] = ['total' => count($regles), 'regles' => $regles];
    } catch (Throwable $e) {
        $out['rag'] = ['erreur' => $e->getMessage(), 'regles' => [], 'total' => 0];
    }
}

/* ── 2. chat_history : les conversations ─────────────────────────────────── */
if ($table === 'all' || $table === 'chat') {
    try {
        $dispo = colonnes($pdo, 'chat_history');
        if (!$dispo) throw new RuntimeException("table 'chat_history' absente de cette base");
        $cId  = col($dispo, ['id']);
        $cSes = col($dispo, ['session_id', 'sessionid', 'session']);
        $cMsg = col($dispo, ['message', 'messages', 'content', 'data']);
        $cAt  = col($dispo, ['created_at', 'createdat', 'inserted_at', 'timestamp']);
        if (!$cMsg) throw new RuntimeException('aucune colonne de message reconnue (colonnes : ' . implode(', ', $dispo) . ')');

        $sel = array_filter([$cId, $cSes, $cMsg, $cAt]);
        $sql = 'SELECT ' . implode(', ', array_map(fn($c) => '"' . $c . '"', $sel)) . ' FROM chat_history';
        $params = [];
        if ($filtre !== '') { $sql .= ' WHERE "' . $cMsg . '"::text ILIKE :q'; $params[':q'] = '%' . $filtre . '%'; }
        $sql .= ' ORDER BY "' . ($cAt ?: $cId) . '" DESC LIMIT ' . $limite;
        $st = $pdo->prepare($sql); $st->execute($params);

        // LangChain stocke {"type":"human","data":{"content":"..."}} — parfois
        // imbriqué différemment selon la version. On cherche le contenu là où il
        // peut être, plutôt que de supposer une seule forme.
        $extraire = function ($brut): array {
            $d = decodeJson($brut);
            if (is_string($d) || $d === null) return ['auteur' => 'inconnu', 'contenu' => (string)$brut];
            $type = $d['type'] ?? ($d['data']['type'] ?? ($d['role'] ?? ''));
            $contenu = $d['data']['content'] ?? ($d['content'] ?? ($d['text'] ?? ''));
            if (is_array($contenu)) $contenu = json_encode($contenu, JSON_UNESCAPED_UNICODE);
            $t = strtolower((string)$type);
            $auteur = (strpos($t, 'human') !== false || strpos($t, 'user') !== false) ? 'Vous'
                    : ((strpos($t, 'ai') !== false || strpos($t, 'assistant') !== false) ? 'CFO'
                    : ($t !== '' ? $type : 'inconnu'));
            return ['auteur' => $auteur, 'contenu' => (string)$contenu];
        };

        $messages = [];
        foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $m = $extraire($r[$cMsg] ?? null);
            $messages[] = [
                'id'         => $cId ? $r[$cId] : null,
                'session_id' => $cSes ? $r[$cSes] : null,
                'auteur'     => $m['auteur'],
                'contenu'    => $m['contenu'],
                'date'       => $cAt ? $r[$cAt] : null,
            ];
        }
        $out['chat'] = ['total' => count($messages), 'messages' => $messages];
    } catch (Throwable $e) {
        $out['chat'] = ['erreur' => $e->getMessage(), 'messages' => [], 'total' => 0];
    }
}

sortie($out);
