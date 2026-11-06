<?php
// ============================================================================
// v1.6 — RÉÉCRIT ET PRÉPARE LE WORKFLOW « [SANTÉ] - Médecin-Chef IA » POUR n8n
// ----------------------------------------------------------------------------
//   php n8n/maj_workflow_sante.php <export.json> <sortie.json> [identifiants.json] [https://hôte]
//
// <export.json>      : « n8n export:workflow --all » (ou un seul workflow).
// [identifiants.json]: « n8n export:credentials --all » (noms et types ; le contenu reste chiffré).
//
// Part du modèle du dépôt (n8n/agent_sante.json) et le remplit avec ce qui existe déjà sur le serveur :
//   • l'id du workflow Santé existant (« [SANTÉ] … » avec un AI Agent) : l'import le REMPLACE, et l'agent maître
//     qui l'appelle par son id continue de fonctionner ;
//   • l'identifiant Telegram dont le nom contient « santé » (unique) — jamais celui d'un autre bot ;
//   • les identifiants Postgres (mémoire de conversation, mémoire vectorielle), Gemini, OpenAI, Deepseek, les noms
//     de tables et les modèles déjà choisis dans l'ancien workflow ;
//   • l'adresse du VPS (lue dans les workflows existants : …/finance/…), le chat de la trace ;
//   • les consignes (sante/cmo_system_prompt.md) et le catalogue des fonctions (sante_intent_engine.php).
// Les versions de nœuds déjà présentes sur le serveur sont reprises. Aucun secret n'est écrit.
// Affiche un résumé JSON : { id, nom, telegram, base, deja_a_jour, avertissements }.
// ============================================================================

if ($argc < 3) { fwrite(STDERR, "usage : php maj_workflow_sante.php <export.json> <sortie.json> [identifiants.json] [https://hôte]\n"); exit(2); }
$ici = __DIR__; $racine = dirname($ici);
require_once $racine . '/sante/sante_intent_engine.php';
$export = json_decode((string)file_get_contents($argv[1]), true);
if (!is_array($export)) { fwrite(STDERR, "export illisible\n"); exit(3); }
$liste = isset($export['nodes']) ? [$export] : array_values($export);
$modele = json_decode((string)file_get_contents($ici . '/agent_sante.json'), true);
$consignes = (string)file_get_contents($racine . '/sante/cmo_system_prompt.md');
$consignesVerif = (string)@file_get_contents($racine . '/sante/verif_protocole_prompt.md');
if (strlen($consignesVerif) < 300) { fwrite(STDERR, "consignes de vérification sante/verif_protocole_prompt.md manquantes\n"); exit(6); }
if (!is_array($modele) || strlen($consignes) < 500) { fwrite(STDERR, "modèle n8n/agent_sante.json ou consignes sante/cmo_system_prompt.md manquants\n"); exit(6); }
$avert = [];
$sansAccent = fn($s) => strtolower(strtr((string)$s, ['é' => 'e', 'É' => 'e', 'è' => 'e', 'ê' => 'e', 'à' => 'a']));

//  1. l'ancien workflow Santé : nom « SANTÉ / SANTE » + un AI Agent (le plus récent, l'actif d'abord)
$estSante = function ($w) use ($sansAccent) {
    if (!is_array($w) || !is_array($w['nodes'] ?? null)) return false;
    $agent = false; foreach ($w['nodes'] as $n) if (($n['type'] ?? '') === '@n8n/n8n-nodes-langchain.agent') $agent = true;
    return $agent && str_contains($sansAccent($w['name'] ?? ''), 'sante');
};
$anciens = array_values(array_filter($liste, $estSante));
usort($anciens, fn($a, $b) => ((int)!empty($b['active']) <=> (int)!empty($a['active'])) ?: strcmp((string)($b['updatedAt'] ?? ''), (string)($a['updatedAt'] ?? '')));
$ancien = $anciens[0] ?? null;
if (!$ancien) $avert[] = "aucun workflow « SANTÉ » existant : un nouveau sera créé";
$parType = function (string $type) use ($ancien) { foreach (($ancien['nodes'] ?? []) as $n) if (($n['type'] ?? '') === $type) return $n; return null; };
$parNom = function (string $nom) use ($ancien) { foreach (($ancien['nodes'] ?? []) as $n) if (($n['name'] ?? '') === $nom) return $n; return null; };

//  2. les identifiants
$creds = [];
if ($argc >= 4 && is_readable($argv[3])) { $c = json_decode((string)file_get_contents($argv[3]), true); $creds = is_array($c) ? (isset($c['id']) ? [$c] : $c) : []; }
$telegram = null;
$tg = array_values(array_filter($creds, fn($c) => is_array($c) && ($c['type'] ?? '') === 'telegramApi' && str_contains($sansAccent($c['name'] ?? ''), 'sante')));
if (count($tg) === 1) $telegram = ['id' => (string)$tg[0]['id'], 'name' => (string)$tg[0]['name']];
elseif (count($tg) > 1) { fwrite(STDERR, "plusieurs identifiants Telegram « santé » : impossible de choisir\n"); exit(7); }
else foreach (($ancien['nodes'] ?? []) as $n) {                 // sans liste : un nœud de l'ancien workflow déjà sur le bot santé
    $t = $n['credentials']['telegramApi'] ?? null;
    if ($t && str_contains($sansAccent($t['name'] ?? ''), 'sante')) { $telegram = ['id' => (string)$t['id'], 'name' => (string)$t['name']]; break; }
}
if (!$telegram) { fwrite(STDERR, "identifiant Telegram « santé » introuvable (créez-le dans n8n : Telegram santé account)\n"); exit(8); }
$credDe = function (string $type, string $cle, ?string $repliNom = null) use ($parType, $creds, &$avert) {
    $n = $parType($type);
    if ($n && isset($n['credentials'][$cle])) return ['id' => (string)$n['credentials'][$cle]['id'], 'name' => (string)$n['credentials'][$cle]['name']];
    if ($repliNom) foreach ($creds as $c) if (($c['type'] ?? '') === $cle && stripos((string)($c['name'] ?? ''), $repliNom) !== false) return ['id' => (string)$c['id'], 'name' => (string)$c['name']];
    $avert[] = "identifiant $cle pour $type introuvable : à choisir dans n8n";
    return null;
};
$cMemoire = $credDe('@n8n/n8n-nodes-langchain.memoryPostgresChat', 'postgres');
$cVecteurs = $credDe('@n8n/n8n-nodes-langchain.vectorStorePGVector', 'postgres', 'sante');
$cGemini = $credDe('@n8n/n8n-nodes-langchain.lmChatGoogleGemini', 'googlePalmApi', 'gemini') ?? $credDe('@n8n/n8n-nodes-langchain.embeddingsGoogleGemini', 'googlePalmApi');
$cDeepseek = $credDe('@n8n/n8n-nodes-langchain.lmChatOpenAi', 'openAiApi', 'deepseek');
$cOpenai = null;
foreach (($ancien['nodes'] ?? []) as $n) if (($n['type'] ?? '') === '@n8n/n8n-nodes-langchain.openAi' && isset($n['credentials']['openAiApi'])) { $cOpenai = ['id' => (string)$n['credentials']['openAiApi']['id'], 'name' => (string)$n['credentials']['openAiApi']['name']]; break; }
if (!$cOpenai) foreach ($creds as $c) if (($c['type'] ?? '') === 'openAiApi' && stripos((string)$c['name'], 'deepseek') === false) { $cOpenai = ['id' => (string)$c['id'], 'name' => (string)$c['name']]; break; }
if (!$cOpenai) $avert[] = "identifiant OpenAI (voix) introuvable : à choisir dans n8n";

//  3. l'adresse du VPS : celle que les workflows existants utilisent déjà pour /finance/
$base = $argv[4] ?? null;
if (!$base && preg_match('#(https?://[A-Za-z0-9.\-:]+)/finance/#', json_encode($liste, JSON_UNESCAPED_SLASHES), $m)) $base = $m[1];
if (!$base) { fwrite(STDERR, "adresse du VPS introuvable dans les workflows : passez-la en 4e argument (https://hôte)\n"); exit(5); }
$base = rtrim($base, '/');

//  4. le chat de la trace (envois vers l'agent maître) : celui de l'ancien workflow, jamais écrit dans le dépôt
$traceChat = null;
foreach (($ancien['nodes'] ?? []) as $n) {
    $cid = (string)($n['parameters']['chatId'] ?? '');
    if (($n['type'] ?? '') === 'n8n-nodes-base.telegram' && preg_match('/^=?\s*(-?\d{5,})\s*$/', $cid, $mm)) { $traceChat = $mm[1]; break; }
}

//  5. le catalogue des fonctions (description de l'outil sante_simuler, et liste fermée du schéma)
$cat = sante_catalogue_fonctions();
$desc = "SIMULE des écritures dans le dossier santé, sans rien enregistrer : tu appelles des fonctions du catalogue, le moteur valide, calcule (calories, macros, score de séquençage, indicateurs) et rend avant → après. Présente le résultat puis demande « OUI ? » ; n'enregistre qu'avec sante_enregistrer, après un oui.\n\nCATALOGUE :\n";
foreach ($cat as $nom => $d) {
    $desc .= "• $nom — {$d['desc']}";
    if ($d['requis']) $desc .= ' Requis : ' . implode(', ', $d['requis']) . '.';
    $opt = array_values(array_diff($d['optionnels'] ?? [], $d['requis'] ?? []));
    if ($opt) $desc .= ' Facultatifs : ' . implode(', ', $opt) . '.';
    $desc .= "\n";
}
$desc .= "\nLECTURE DE LA RÉPONSE : status=ok → présente le journal (avant → après) ; status=error → explique le refus (argument manquant, hors bornes, ERROR_OUT_OF_CATALOG) sans contourner.";

//  6. remplissage du modèle
$uuid = fn() => sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x', random_int(0, 0xffff), random_int(0, 0xffff), random_int(0, 0xffff), random_int(0, 0x0fff) | 0x4000, random_int(0, 0x3fff) | 0x8000, random_int(0, 0xffff), random_int(0, 0xffff), random_int(0, 0xffff));
$versions = []; foreach (($ancien['nodes'] ?? []) as $n) if (isset($n['type'], $n['typeVersion'])) $versions[$n['type']] = max($versions[$n['type']] ?? 0, $n['typeVersion']);
$ancienGemini = $parType('@n8n/n8n-nodes-langchain.lmChatGoogleGemini');
$ancienDeepseek = $parType('@n8n/n8n-nodes-langchain.lmChatOpenAi');
$ancienPg = $parType('@n8n/n8n-nodes-langchain.vectorStorePGVector');
$ancienMem = $parType('@n8n/n8n-nodes-langchain.memoryPostgresChat');
$ancienTrigger = $parType('n8n-nodes-base.telegramTrigger');
$ancienWebhook = $parType('n8n-nodes-base.webhook');
$prompt = '=' . str_replace(['{{', '}}'], ['{ {', '} }'], $consignes) . "\n\nAujourd'hui : {{ \$now.setZone('Africa/Casablanca').toFormat('cccc d LLLL yyyy', { locale: 'fr' }) }} ({{ \$now.setZone('Africa/Casablanca').toFormat('yyyy-LL-dd') }}).";
$catalogueEnum = array_keys($cat);
$wf = $modele;
$credObj = fn($c) => $c ? ['id' => $c['id'], 'name' => $c['name']] : null;
$nouveaux = [];
foreach ($wf['nodes'] as $n) {
    $nomNoeud = $n['name'];
    $vieux = $parNom($nomNoeud);
    $n['id'] = $vieux['id'] ?? $uuid();
    if (isset($versions[$n['type']]) && $versions[$n['type']] > $n['typeVersion']) $n['typeVersion'] = $versions[$n['type']];
    if (isset($n['webhookId'])) {
        if ($n['type'] === 'n8n-nodes-base.telegramTrigger') $n['webhookId'] = $ancienTrigger['webhookId'] ?? $uuid();
        elseif ($n['type'] === 'n8n-nodes-base.webhook') $n['webhookId'] = $ancienWebhook['webhookId'] ?? $uuid();
    }
    if ($n['parameters'] === '__PARAMS_GEMINI__') $n['parameters'] = $ancienGemini['parameters'] ?? ['modelName' => 'models/gemini-2.5-pro', 'options' => ['temperature' => 0.3]];
    if ($n['parameters'] === '__PARAMS_DEEPSEEK__') $n['parameters'] = $ancienDeepseek['parameters'] ?? ['model' => ['__rl' => true, 'value' => 'deepseek-chat', 'mode' => 'id'], 'options' => []];
    $json = json_encode($n['parameters'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $json = str_replace('__FINANCE_BASE__', $base, $json);
    //  les consignes du vérificateur : une chaîne JavaScript dans le code du nœud « Préparer la vérification »
    $json = str_replace('__PROMPT_VERIF__', substr(json_encode(json_encode($consignesVerif, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 1, -1), $json);
    $json = str_replace('"__PROMPT__"', json_encode($prompt, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $json);
    $json = str_replace('"__DESC_SIMULER__"', json_encode($desc, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $json);
    $json = str_replace('__MEMOIRE_TABLE__', (string)($ancienMem['parameters']['tableName'] ?? 'chat_history'), $json);
    $json = str_replace('__VECTEURS_TABLE__', (string)($ancienPg['parameters']['tableName'] ?? 'sante_vectors'), $json);
    $n['parameters'] = json_decode($json, true);
    if (isset($n['parameters']['inputSchema']) && str_contains($n['parameters']['inputSchema'], '__CATALOGUE__')) {
        $s = json_decode($n['parameters']['inputSchema'], true);
        $s['properties']['calls']['items']['properties']['function']['enum'] = $catalogueEnum;
        $n['parameters']['inputSchema'] = json_encode($s, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    }
    if ($nomNoeud === 'Trace vers Telegram') { if (!$traceChat) { $avert[] = 'chat de la trace inconnu : nœud « Trace vers Telegram » retiré'; continue; } $n['parameters']['chatId'] = '=' . $traceChat; }
    foreach (($n['credentials'] ?? []) as $cle => $c) {
        $nom = $c['name'] ?? '';
        $choix = match ($nom) {
            '__CRED_TELEGRAM__' => $telegram, '__CRED_OPENAI__' => $cOpenai, '__CRED_GEMINI__' => $cGemini, '__CRED_DEEPSEEK__' => $cDeepseek,
            '__CRED_PG_MEMOIRE__' => $cMemoire, '__CRED_PG_VECTEURS__' => $cVecteurs, default => $c,
        };
        if ($choix) $n['credentials'][$cle] = $credObj($choix); else unset($n['credentials'][$cle]);
    }
    if (isset($n['credentials']) && !$n['credentials']) unset($n['credentials']);
    $nouveaux[] = $n;
}
$wf['nodes'] = $nouveaux;
$noms = array_column($nouveaux, 'name');
if (!in_array('Trace vers Telegram', $noms, true)) unset($wf['connections']['Réponse à l\'agent maître']);
$wf['id'] = $ancien['id'] ?? substr(str_replace('-', '', $uuid()), 0, 16);
$wf['settings'] = array_merge($ancien['settings'] ?? [], $modele['settings']);
$wf['active'] = true;
unset($wf['meta']);
if (isset($ancien['tags'])) $wf['tags'] = $ancien['tags'];

//  7. contrôles : plus aucun espace réservé, chaque liaison mène à un nœud existant, le bot santé n'est pas écouté ailleurs
$sortie = json_encode($wf, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
if (preg_match('/__[A-Z_]{4,}__/', $sortie, $reste)) { fwrite(STDERR, "espace réservé non rempli : {$reste[0]}\n"); exit(9); }
foreach ($wf['connections'] as $de => $types) {
    if (!in_array($de, $noms, true)) { fwrite(STDERR, "liaison depuis un nœud absent : $de\n"); exit(10); }
    foreach ($types as $sorties) foreach ($sorties as $groupe) foreach ($groupe as $l) if (!in_array($l['node'], $noms, true)) { fwrite(STDERR, "liaison vers un nœud absent : {$l['node']}\n"); exit(10); }
}
$concurrents = [];
foreach ($liste as $w) {
    if (!is_array($w) || ($w['id'] ?? null) === $wf['id'] || empty($w['active'])) continue;
    foreach ($w['nodes'] ?? [] as $n) if (($n['type'] ?? '') === 'n8n-nodes-base.telegramTrigger' && (string)($n['credentials']['telegramApi']['id'] ?? '') === $telegram['id']) $concurrents[] = (string)($w['name'] ?? $w['id']);
}
if ($concurrents) $avert[] = 'le bot santé est AUSSI écouté par : ' . implode(', ', array_unique($concurrents)) . ' — Telegram n\'accepte qu\'un workflow par bot : désactivez son déclencheur';

//  8. déjà à jour ? (mêmes nœuds et liaisons, aux positions près)
$empreinte = function ($w) { $n = array_map(function ($x) { unset($x['position']); return $x; }, $w['nodes'] ?? []); usort($n, fn($a, $b) => strcmp($a['name'], $b['name'])); return md5(json_encode([$n, $w['connections'] ?? [], $w['name'] ?? ''])); };
$dejaAJour = $ancien && $empreinte($ancien) === $empreinte($wf);
file_put_contents($argv[2], $sortie);
echo json_encode(['id' => $wf['id'], 'nom' => $wf['name'], 'remplace' => $ancien['name'] ?? null, 'telegram' => $telegram['name'], 'base' => $base,
                  'trace' => $traceChat ? 'oui' : 'non', 'outils' => ['sante_lire', 'sante_simuler', 'sante_enregistrer', 'memoire_sante'], 'verification_protocole' => in_array('Vérificateur', $noms, true), 'catalogue' => count($cat),
                  'deja_a_jour' => $dejaAJour, 'avertissements' => $avert], JSON_UNESCAPED_UNICODE), "\n";
