<?php
/**
 * ============================================================================
 *  get_ai_memory.php — supervision de la mémoire de l'agent (v37.2)
 * ----------------------------------------------------------------------------
 *  GET /finance/get_ai_memory.php              → les deux tables
 *  GET /finance/get_ai_memory.php?table=rag    → règles mémorisées seules
 *  GET /finance/get_ai_memory.php?table=chat   → conversations seules
 *  Paramètres : limit (défaut 100, max 500), q (filtre plein texte simple)
 *
 *  POST (JSON) {action:"delete_vector", id:N}  → supprime une règle mémorisée
 *
 *  ⚠️  PROTECTION — ELLE EST EN AMONT, DANS CADDY
 *  Cet endpoint renvoie des RÈGLES MÉTIER et des CONVERSATIONS, et sait
 *  désormais SUPPRIMER. La protection est assurée par `basic_auth` sur
 *  /finance/ dans le Caddyfile — voir CADDY_SECURITE.md à la racine du dépôt.
 *
 *  Le jeton applicatif de la v37.0 a été retiré : il aurait dû être écrit en
 *  clair dans index.html pour que l'interface s'en serve, donc lisible par
 *  quiconque affiche la source. Une sécurité en trompe-l'œil vaut moins que
 *  pas de sécurité, parce qu'elle rassure à tort.
 *
 *  Ce fichier ne SUPPOSE pas que Caddy est en place : il en cherche la preuve
 *  (auth_amont) et refuse toute suppression à défaut.
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

/* ══════════════════════════════════════════════════════════════════════════
   v37.2 — LA PROTECTION EST EN AMONT (Caddy), MAIS ON VÉRIFIE QU'ELLE Y EST
   ──────────────────────────────────────────────────────────────────────────
   Le jeton 'ai_memory_token' est SUPPRIMÉ : il ne pouvait pas être utilisé par
   l'application sans être écrit en clair dans index.html, donc lisible par
   quiconque affiche la source. C'était une sécurité en trompe-l'œil.

   Caddy protège désormais /finance/ par basic_auth. Mais ce fichier ne se
   CONTENTE PAS de le supposer : entre le `git pull` et la mise à jour du
   Caddyfile il existe une fenêtre pendant laquelle un endpoint de SUPPRESSION
   serait ouvert à tout internet. On cherche donc une preuve que la requête est
   bien passée par une authentification, et à défaut la LECTURE reste permise
   (comportement actuel, rien n'est cassé) mais la SUPPRESSION est refusée.
   Échouer en refusant de détruire, jamais en détruisant.
   ══════════════════════════════════════════════════════════════════════════ */
function auth_amont(): ?string {
    foreach (['PHP_AUTH_USER', 'REMOTE_USER', 'REDIRECT_REMOTE_USER'] as $k) {
        if (!empty($_SERVER[$k])) return (string)$_SERVER[$k];
    }
    // Selon la passerelle (php-fpm, mod_php, proxy), l'en-tête arrive sous
    // l'un ou l'autre nom. On accepte les deux plutôt que d'en privilégier un.
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (stripos((string)$h, 'basic ') === 0) {
        $d = base64_decode(substr((string)$h, 6), true);
        if ($d !== false && strpos($d, ':') !== false) return explode(':', $d, 2)[0];
    }
    return null;
}
$utilisateurAmont = auth_amont();
$avertissement = $utilisateurAmont === null
    ? "Aucune authentification détectée en amont : ce chemin n'est pas protégé par Caddy. "
    . "La lecture reste possible, la SUPPRESSION est refusée tant que basic_auth n'est pas actif sur /finance/."
    : null;

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

/* ══════════════════════════════════════════════════════════════════════════
   v37.2 — SUPPRESSION D'UNE RÈGLE MÉMORISÉE
   ──────────────────────────────────────────────────────────────────────────
   POST JSON {action:"delete_vector", id:N}

   TROIS VERROUS, dans cet ordre :
     1. AUTH AMONT — la requête doit porter la trace d'une authentification
        (Caddy basic_auth). À défaut, refus : mieux vaut un bouton qui ne
        marche pas encore qu'un endpoint de destruction ouvert au monde.
     2. MÊME ORIGINE — une authentification basique est rejouée
        automatiquement par le navigateur : un site tiers pourrait déclencher
        une suppression à votre insu (CSRF). On exige un en-tête que seul du
        JavaScript peut poser (donc soumis au contrôle CORS) et une origine
        identique à l'hôte.
     3. IDENTIFIANT ENTIER — requête préparée, jamais de concaténation.

   ET UN FILET : la ligne supprimée est archivée en JSONL avant l'exécution.
   « Oublier définitivement » se dit à l'utilisateur, pas à la base — une
   règle effacée par erreur doit pouvoir être relue.
   ══════════════════════════════════════════════════════════════════════════ */
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    $corps = json_decode((string)file_get_contents('php://input'), true) ?: [];
    $action = $corps['action'] ?? '';

    if ($action !== 'delete_vector') {
        sortie(['status'=>'error','error'=>'ACTION_INCONNUE',
                'message'=>"Action non reconnue. Attendu : {action:'delete_vector', id:N}."], 400);
    }

    // Verrou 1 — preuve d'authentification en amont
    if ($utilisateurAmont === null) {
        sortie(['status'=>'error','error'=>'PROTECTION_ABSENTE',
                'message'=>"Suppression refusée : aucune authentification détectée sur ce chemin. "
                         . "Activez basic_auth sur /finance/ dans le Caddyfile (voir CADDY_SECURITE.md), "
                         . "puis rechargez la page.",
                'lecture_possible'=>true], 403);
    }

    // Verrou 2 — même origine (anti-CSRF)
    if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') === '') {
        sortie(['status'=>'error','error'=>'ENTETE_MANQUANT',
                'message'=>"En-tête X-Requested-With absent : requête rejetée (protection CSRF)."], 400);
    }
    $hote = $_SERVER['HTTP_HOST'] ?? '';
    $origine = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
    if ($origine !== '') {
        $hOrigine = parse_url($origine, PHP_URL_HOST);
        if ($hOrigine !== null && strcasecmp((string)$hOrigine, (string)preg_replace('/:\d+$/', '', $hote)) !== 0) {
            sortie(['status'=>'error','error'=>'ORIGINE_ETRANGERE',
                    'message'=>"Requête émise depuis « {$hOrigine} », qui n'est pas « {$hote} ». Rejetée."], 403);
        }
    }

    // Verrou 3 — identifiant entier strictement positif
    $id = $corps['id'] ?? null;
    if (!is_int($id) && !(is_string($id) && ctype_digit($id))) {
        sortie(['status'=>'error','error'=>'ID_INVALIDE',
                'message'=>"Identifiant attendu : un entier. Reçu : " . json_encode($id)], 400);
    }
    $id = (int)$id;
    if ($id <= 0) sortie(['status'=>'error','error'=>'ID_INVALIDE','message'=>'Identifiant doit être positif.'], 400);

    try {
        $dispo = colonnes($pdo, 'finance_vectors');
        if (!$dispo) throw new RuntimeException("table 'finance_vectors' absente de cette base");
        if (!in_array('id', $dispo, true)) throw new RuntimeException("la table n'a pas de colonne 'id' : suppression par identifiant impossible");
        $cTxt = col($dispo, ['text', 'content', 'document', 'page_content', 'texte']);
        $cMet = col($dispo, ['metadata', 'meta', 'metadatas']);

        // Relire la ligne AVANT de la détruire — pour l'archiver et pour
        // pouvoir dire à l'utilisateur ce qui a réellement disparu.
        $selArch = array_filter(['id', $cTxt, $cMet]);
        $sl = $pdo->prepare('SELECT ' . implode(', ', array_map(fn($c) => '"' . $c . '"', $selArch))
                          . ' FROM finance_vectors WHERE id = :id');
        $sl->execute([':id' => $id]);
        $ligne = $sl->fetch(PDO::FETCH_ASSOC);
        if (!$ligne) {
            sortie(['status'=>'error','error'=>'INTROUVABLE',
                    'message'=>"Aucune règle ne porte l'identifiant {$id}. Rien n'a été supprimé."], 404);
        }

        // Filet : archive append-only. Un échec d'écriture ANNULE la suppression.
        $archive = __DIR__ . '/vectors_supprimes.jsonl';
        $entree = json_encode([
            'supprime_le'  => date('c'),
            'par'          => $utilisateurAmont,
            'id'           => (int)$ligne['id'],
            'texte'        => $cTxt ? (string)$ligne[$cTxt] : null,
            'metadata'     => $cMet ? decodeJson($ligne[$cMet] ?? null) : null,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (@file_put_contents($archive, $entree . "\n", FILE_APPEND | LOCK_EX) === false) {
            sortie(['status'=>'error','error'=>'ARCHIVE_IMPOSSIBLE',
                    'message'=>"Impossible d'écrire l'archive " . basename($archive) . " — suppression ANNULÉE. "
                             . "Vérifiez les droits d'écriture du dossier.",
                    'supprime'=>false], 500);
        }

        $sd = $pdo->prepare('DELETE FROM finance_vectors WHERE id = :id');
        $sd->execute([':id' => $id]);

        $extrait = $cTxt ? (string)$ligne[$cTxt] : '';
        sortie(['status'=>'ok', 'supprime'=>true, 'id'=>$id,
                'lignes_supprimees'=>$sd->rowCount(),
                'extrait'=>mb_substr($extrait, 0, 120),
                'archive'=>basename($archive),
                'par'=>$utilisateurAmont]);
    } catch (Throwable $e) {
        sortie(['status'=>'error','error'=>'SUPPRESSION_ECHOUEE','message'=>$e->getMessage(),'supprime'=>false], 500);
    }
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
/**
 * v37.1 — MÉTADONNÉES TECHNIQUES ÉCARTÉES.
 *   Les chargeurs de documents (LangChain & co) accrochent à chaque vecteur
 *   des clés de découpage — loc.lines.from/to, blobType, pageNumber, pdf.* —
 *   qui décrivent le FICHIER d'origine, pas la règle métier. À l'écran elles
 *   noient les seules informations utiles (source, tags, catégorie).
 *   Liste de REFUS et non d'autorisation, volontairement : une clé métier que
 *   je n'ai pas prévue doit rester visible plutôt que disparaître en silence.
 *   ?meta=all rend tout, pour inspecter une règle en détail.
 */
const META_TECHNIQUES = [
    'loc', 'blobType', 'blob', 'pageNumber', 'totalPages', 'pdf', 'info',
    'version', 'lines', 'chunk', 'chunkIndex', 'chunk_index', 'charCount',
    'tokenCount', 'hash', 'checksum', 'mtime', 'ctime', 'size', 'encoding',
    'mimetype', 'mime_type', 'contentType', 'embedding', 'vector', '_id',
];
function meta_utile($meta, bool $tout) {
    if ($tout || !is_array($meta)) return $meta;
    $garde = [];
    foreach ($meta as $k => $v) {
        if (in_array((string)$k, META_TECHNIQUES, true)) continue;
        // Une valeur vide n'apporte rien à l'écran non plus.
        if ($v === null || $v === '' || $v === []) continue;
        $garde[$k] = $v;
    }
    return $garde ?: null;   // null → le frontend n'affiche aucun bandeau
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
// v37.1 : un vecteur dont le texte tient en moins de 30 caractères n'est pas
//   une règle — c'est un résidu d'indexation (une date, un tag isolé du type
//   « regle » ou « tg_1595… »). Seuil ajustable, 0 pour tout voir.
$minLen  = max(0, min(10000, (int)($_GET['min_len'] ?? 30)));
$metaAll = in_array(strtolower((string)($_GET['meta'] ?? '')), ['all', 'full', '1'], true);
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
        // v37.1 : le tri se fait EN SQL, avant le LIMIT. Filtrer en PHP après
        //   coup aurait rendu `limit` trompeur : on aurait demandé 200 lignes
        //   pour n'en afficher que 40, sans que personne ne sache pourquoi.
        //   char_length (et non length) pour compter des CARACTÈRES en UTF-8 :
        //   un « é » ne doit pas peser double dans le seuil.
        $ou = []; $params = [];
        if ($filtre !== '') { $ou[] = '"' . $cTxt . '" ILIKE :q'; $params[':q'] = '%' . $filtre . '%'; }
        if ($minLen > 0)    { $ou[] = 'char_length("' . $cTxt . '") > :minlen'; $params[':minlen'] = $minLen; }
        $sql = 'SELECT ' . implode(', ', array_map(fn($c) => '"' . $c . '"', $sel)) . ' FROM finance_vectors'
             . (count($ou) ? ' WHERE ' . implode(' AND ', $ou) : '')
             . ($cId ? ' ORDER BY "' . $cId . '" DESC' : '') . ' LIMIT ' . $limite;
        $st = $pdo->prepare($sql); $st->execute($params);

        $regles = [];
        foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $texte = (string)($r[$cTxt] ?? '');
            $regles[] = [
                'id'        => $cId ? $r[$cId] : null,
                'texte'     => $texte,
                'longueur'  => mb_strlen($texte),
                'metadata'  => $cMet ? meta_utile(decodeJson($r[$cMet] ?? null), $metaAll) : null,
            ];
        }
        // Combien de vecteurs le seuil a-t-il écartés ? Un compteur qui baisse
        // sans explication inquiète : on dit ce qui a été mis de côté.
        $ecartes = 0;
        if ($minLen > 0) {
            try {
                $sc = $pdo->prepare('SELECT count(*) AS n FROM finance_vectors WHERE char_length("' . $cTxt . '") <= :minlen');
                $sc->execute([':minlen' => $minLen]);
                $ecartes = (int)($sc->fetch(PDO::FETCH_ASSOC)['n'] ?? 0);
            } catch (Throwable $e) { $ecartes = 0; }
        }
        $out['rag'] = [
            'total'            => count($regles),
            'regles'           => $regles,
            'seuil_caracteres' => $minLen,
            'ecartes_trop_courts' => $ecartes,
        ];
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
