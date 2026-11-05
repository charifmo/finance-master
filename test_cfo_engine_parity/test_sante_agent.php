<?php
/**
 * Santé Master — L'AGENT TELEGRAM « [SANTÉ] - Médecin-Chef IA » : réécriture du workflow (n8n/maj_workflow_sante.php)
 * sur un export n8n FICTIF, et relais du chat de la page (sante_cmo.php). Aucun identifiant réel.
 */
$ko = 0; $n = 0;
function v(string $t, bool $ok, $d = '') { global $ko, $n; $n++; if (!$ok) $ko++; echo '  ' . ($ok ? '✅' : '❌') . ' ' . str_pad($t, 78) . ' ' . ($ok ? '' : mb_substr(is_string($d) ? $d : json_encode($d, JSON_UNESCAPED_UNICODE), 0, 500)) . "\n"; }
echo "\n  SANTÉ MASTER — L'AGENT TELEGRAM (MÉDECIN-CHEF IA)\n  " . str_repeat('─', 80) . "\n";
$R = dirname(__DIR__); $tmp = sys_get_temp_dir() . '/sante_agent_' . getmypid(); @mkdir($tmp);
$tg = fn($id, $nom) => ['telegramApi' => ['id' => $id, 'name' => $nom]];
//  l'ancien agent : presque tout sur le bot « Psy » (l'erreur réelle), la trace sur le bot santé
$ancien = ['id' => 'ANCIENSANTE00001', 'name' => '[SANTÉ] - Agent Biohacking', 'active' => false, 'settings' => ['executionOrder' => 'v1', 'callerPolicy' => 'workflowsFromSameOwner'], 'tags' => [], 'connections' => [],
  'nodes' => [
    ['id' => 'n1', 'name' => 'Telegram Trigger', 'type' => 'n8n-nodes-base.telegramTrigger', 'typeVersion' => 1.2, 'webhookId' => 'wh-tg-1', 'position' => [0, 0], 'parameters' => [], 'credentials' => $tg('PSY1', 'Telegram Psy account')],
    ['id' => 'n2', 'name' => 'AI Agent', 'type' => '@n8n/n8n-nodes-langchain.agent', 'typeVersion' => 3.1, 'position' => [0, 0], 'parameters' => ['options' => ['systemMessage' => 'ancien']]],
    ['id' => 'n3', 'name' => 'Postgres Chat Memory', 'type' => '@n8n/n8n-nodes-langchain.memoryPostgresChat', 'typeVersion' => 1.3, 'position' => [0, 0], 'parameters' => ['tableName' => 'chat_history_test'], 'credentials' => ['postgres' => ['id' => 'PG1', 'name' => 'base_fictive']]],
    ['id' => 'n4', 'name' => 'Postgres PGVector Store', 'type' => '@n8n/n8n-nodes-langchain.vectorStorePGVector', 'typeVersion' => 1.3, 'position' => [0, 0], 'parameters' => ['tableName' => 'vecteurs_test'], 'credentials' => ['postgres' => ['id' => 'PG2', 'name' => 'AUTH_SANTE_FICTIF']]],
    ['id' => 'n5', 'name' => 'Google Gemini Chat Model2', 'type' => '@n8n/n8n-nodes-langchain.lmChatGoogleGemini', 'typeVersion' => 1, 'position' => [0, 0], 'parameters' => ['modelName' => 'models/gemini-fictif', 'options' => ['temperature' => 0.3]], 'credentials' => ['googlePalmApi' => ['id' => 'GEM1', 'name' => 'Gemini fictif']]],
    ['id' => 'n6', 'name' => 'OpenAI Chat Model', 'type' => '@n8n/n8n-nodes-langchain.lmChatOpenAi', 'typeVersion' => 1.3, 'position' => [0, 0], 'parameters' => ['model' => ['__rl' => true, 'value' => 'deepseek-chat', 'mode' => 'id']], 'credentials' => ['openAiApi' => ['id' => 'DS1', 'name' => 'Deepseek fictif']]],
    ['id' => 'n7', 'name' => 'Transcribe a recording', 'type' => '@n8n/n8n-nodes-langchain.openAi', 'typeVersion' => 2.1, 'position' => [0, 0], 'parameters' => [], 'credentials' => ['openAiApi' => ['id' => 'OA1', 'name' => 'OpenAI fictif']]],
    ['id' => 'n8', 'name' => 'Send a text message2', 'type' => 'n8n-nodes-base.telegram', 'typeVersion' => 1.2, 'position' => [0, 0], 'parameters' => ['chatId' => '=123456789'], 'credentials' => $tg('SANTE1', 'Telegram santé  account')],
  ]];
$cfo = ['id' => 'CFO0000000000001', 'name' => 'Super-Agent CFO', 'active' => true, 'connections' => [], 'nodes' => [
    ['name' => 'Normalize Input', 'type' => 'n8n-nodes-base.code', 'typeVersion' => 2, 'parameters' => ['jsCode' => "url: 'https://hote-fictif.example/finance/save_data.php'"]],
    ['name' => 'Telegram Trigger', 'type' => 'n8n-nodes-base.telegramTrigger', 'typeVersion' => 1.2, 'parameters' => [], 'credentials' => $tg('CFO1', 'Telegram CFO account')]]];
$intrus = ['id' => 'INTRUS0000000001', 'name' => 'Vieux test', 'active' => true, 'connections' => [], 'nodes' => [
    ['name' => 'Telegram Trigger', 'type' => 'n8n-nodes-base.telegramTrigger', 'typeVersion' => 1.2, 'parameters' => [], 'credentials' => $tg('SANTE1', 'Telegram santé  account')]]];
$creds = [['id' => 'PSY1', 'name' => 'Telegram Psy account', 'type' => 'telegramApi'], ['id' => 'SANTE1', 'name' => 'Telegram santé  account', 'type' => 'telegramApi'], ['id' => 'CFO1', 'name' => 'Telegram CFO account', 'type' => 'telegramApi']];
file_put_contents("$tmp/export.json", json_encode([$cfo, $ancien, $intrus], JSON_UNESCAPED_UNICODE)); file_put_contents("$tmp/creds.json", json_encode($creds));
$sortie = shell_exec('php ' . escapeshellarg("$R/n8n/maj_workflow_sante.php") . ' ' . escapeshellarg("$tmp/export.json") . ' ' . escapeshellarg("$tmp/wf.json") . ' ' . escapeshellarg("$tmp/creds.json") . ' 2>&1');
$res = json_decode((string)$sortie, true); $wf = json_decode((string)@file_get_contents("$tmp/wf.json"), true);
v('A. réécriture : même id que l\'ancien agent (l\'agent maître continue de l\'appeler), nouveau nom, publié', is_array($wf) && $wf['id'] === 'ANCIENSANTE00001' && $wf['name'] === '[SANTÉ] - Médecin-Chef IA' && $wf['active'] === true, $sortie);
$noeuds = []; foreach ($wf['nodes'] ?? [] as $x) $noeuds[$x['name']] = $x;
$bots = []; foreach ($wf['nodes'] ?? [] as $x) if (isset($x['credentials']['telegramApi'])) $bots[] = $x['credentials']['telegramApi']['name'];
v('  → TOUS les nœuds Telegram sur « Telegram santé account » (plus aucun sur le bot Psy)', $bots && count(array_unique($bots)) === 1 && $bots[0] === 'Telegram santé  account' && count($bots) >= 6, array_count_values($bots));
v('  → identifiants repris de l\'ancien : mémoire, vecteurs (et leurs tables), Gemini, Deepseek, OpenAI', ($noeuds['Postgres Chat Memory']['credentials']['postgres']['id'] ?? '') === 'PG1' && ($noeuds['Postgres Chat Memory']['parameters']['tableName'] ?? '') === 'chat_history_test'
  && ($noeuds['Postgres PGVector Store']['credentials']['postgres']['id'] ?? '') === 'PG2' && ($noeuds['Postgres PGVector Store']['parameters']['tableName'] ?? '') === 'vecteurs_test' && ($noeuds['Modèle principal']['parameters']['modelName'] ?? '') === 'models/gemini-fictif'
  && ($noeuds['Modèle de la mémoire']['credentials']['openAiApi']['id'] ?? '') === 'DS1' && ($noeuds['Generate audio']['credentials']['openAiApi']['id'] ?? '') === 'OA1');
v('  → identifiants des nœuds et du déclencheur Telegram conservés ; versions du serveur reprises (agent 3.1)', ($noeuds['Telegram Trigger']['id'] ?? '') === 'n1' && ($noeuds['Telegram Trigger']['webhookId'] ?? '') === 'wh-tg-1' && ($noeuds['AI Agent']['typeVersion'] ?? 0) == 3.1);
$lire = $noeuds['sante_lire']['parameters']['jsCode'] ?? '';
v('B. outils : sante_lire, sante_simuler, sante_enregistrer sur https://hote-fictif.example/finance/sante/sante_api.php', str_contains($lire, "'https://hote-fictif.example/finance/sante/sante_api.php'") && str_contains($noeuds['sante_enregistrer']['parameters']['jsCode'] ?? '', "mode: 'commit'")
  && str_contains($noeuds['sante_simuler']['parameters']['jsCode'] ?? '', "mode: 'simulate'") && isset($noeuds['memoire_sante']));
require_once "$R/sante/sante_intent_engine.php";
$enum = json_decode($noeuds['sante_simuler']['parameters']['inputSchema'] ?? '{}', true)['properties']['calls']['items']['properties']['function']['enum'] ?? [];
v('  → le catalogue des fonctions vient du moteur PHP (liste fermée + description) : jamais désynchronisé', $enum === array_keys(sante_catalogue_fonctions()) && str_contains($noeuds['sante_simuler']['parameters']['description'] ?? '', 'log_daily_nutrition'), $enum);
v('  → les identifiants du site ne sont jamais écrits : $env.FINANCE_USER / FINANCE_PASS', str_contains($lire, '$env.FINANCE_USER') && !preg_match('/Basic [A-Za-z0-9+\/=]{8,}/', file_get_contents("$tmp/wf.json")));
$sys = $noeuds['AI Agent']['parameters']['options']['systemMessage'] ?? '';
v('C. consignes : sante/cmo_system_prompt.md (tu lis / simuler puis OUI / urgences) + la date du jour', str_contains($sys, 'tu lis, tu ne calcules pas') && str_contains($sys, 'sante_enregistrer') && str_contains($sys, '141') && str_contains($sys, "\$now.setZone('Africa/Casablanca')"));
v('  → la trace vers l\'agent maître garde le chat de l\'ancien workflow (jamais écrit dans le dépôt)', ($noeuds['Trace vers Telegram']['parameters']['chatId'] ?? '') === '=123456789' && !str_contains(file_get_contents("$R/n8n/agent_sante.json"), '123456789'));
v('  → le modèle du dépôt ne contient aucun identifiant réel (credentials vides, espaces réservés)', !preg_match('/"id":\s*"[A-Za-z0-9]{10,}"/', file_get_contents("$R/n8n/agent_sante.json")));
v('D. avertit : un autre workflow actif écoute aussi le bot santé (Telegram : un seul par bot)', is_array($res) && str_contains(implode(' ', $res['avertissements'] ?? []), 'Vieux test'), $res);
$js = 0; $jsKo = [];
foreach ($wf['nodes'] as $x) if (isset($x['parameters']['jsCode'])) { $js++; file_put_contents("$tmp/c.js", $x['parameters']['jsCode']);
    $o = shell_exec('node -e ' . escapeshellarg("const AF=Object.getPrototypeOf(async function(){}).constructor;try{new AF('\$input','\$','\$env','query','Buffer',require('fs').readFileSync(process.argv[1],'utf8'));}catch(e){console.log(e.message)}") . ' ' . escapeshellarg("$tmp/c.js") . ' 2>&1');
    if (trim((string)$o) !== '') $jsKo[] = $x['name'] . ' : ' . trim($o); }
v("  → les $js codes JavaScript du workflow compilent", $js >= 6 && !$jsKo, $jsKo);
shell_exec('php ' . escapeshellarg("$R/n8n/maj_workflow_sante.php") . ' ' . escapeshellarg("$tmp/wf.json") . ' ' . escapeshellarg("$tmp/wf2.json") . ' ' . escapeshellarg("$tmp/creds.json") . ' https://hote-fictif.example 2>&1');
$res2 = json_decode((string)shell_exec('php ' . escapeshellarg("$R/n8n/maj_workflow_sante.php") . ' ' . escapeshellarg("$tmp/wf2.json") . ' ' . escapeshellarg("$tmp/wf3.json") . ' ' . escapeshellarg("$tmp/creds.json") . ' https://hote-fictif.example 2>&1'), true);
v('  → relancé sur son propre résultat : « déjà à jour » (idempotent)', ($res2['deja_a_jour'] ?? null) === true, $res2);
file_put_contents("$tmp/creds_sans.json", json_encode([$creds[0]]));
file_put_contents("$tmp/export_sans.json", json_encode([array_merge($ancien, ['nodes' => array_slice($ancien['nodes'], 0, 7)])]));
$sans = shell_exec('php ' . escapeshellarg("$R/n8n/maj_workflow_sante.php") . ' ' . escapeshellarg("$tmp/export_sans.json") . ' ' . escapeshellarg("$tmp/x.json") . ' ' . escapeshellarg("$tmp/creds_sans.json") . ' https://h.example 2>&1; echo " [code $?]"');
v('  → sans identifiant « Telegram santé » : refus clair, rien n\'est produit (jamais un autre bot)', str_contains((string)$sans, 'Telegram « santé » introuvable') && str_contains((string)$sans, '[code 8]'), $sans);

//  le relais du chat de la page : sans authentification → 403 ; avec → la question part au webhook, Authorization transmis
$port1 = 23000 + random_int(0, 1500); $port2 = $port1 + 1700;
file_put_contents("$tmp/hook.php", '<?php header("Content-Type: application/json"); $b = json_decode(file_get_contents("php://input"), true); echo json_encode(["output" => "reçu : " . ($b["question"] ?? "") . " | auth : " . ($_SERVER["HTTP_AUTHORIZATION"] ?? "aucune")], JSON_UNESCAPED_UNICODE);');
$env = array_merge(getenv(), ['SANTE_CMO_WEBHOOK' => "http://127.0.0.1:$port2/hook.php", 'SANTE_DATA_FILE' => "$tmp/d.json"]);
$p1 = proc_open(['php', '-S', "127.0.0.1:$port1", '-t', $R], [['pipe', 'r'], ['file', '/dev/null', 'w'], ['file', '/dev/null', 'w']], $pp1, null, $env);
$p2 = proc_open(['php', '-S', "127.0.0.1:$port2", '-t', $tmp], [['pipe', 'r'], ['file', '/dev/null', 'w'], ['file', '/dev/null', 'w']], $pp2);
$post = function ($auth) use ($port1) { $h = "Content-Type: application/json\r\n" . ($auth ? "Authorization: $auth\r\n" : ''); $c = stream_context_create(['http' => ['method' => 'POST', 'header' => $h, 'content' => '{"question":"Que disent mes triglycérides ?"}', 'ignore_errors' => true, 'timeout' => 10]]); $r = null; for ($i = 0; $i < 40 && $r === null; $i++) { $r = @file_get_contents("http://127.0.0.1:$port1/sante/sante_cmo.php", false, $c); if ($r === false) { $r = null; usleep(150000); } } return [$http_response_header[0] ?? '', $r]; };
[$s1, $b1] = $post(null);
[$s2, $b2] = $post('Basic ' . base64_encode('testeur:secret'));
proc_terminate($p1); proc_terminate($p2);
v('E. chat de la page (sante_cmo.php) : sans le mot de passe du site → 403', str_contains($s1, '403'), [$s1, $b1]);
v('  → avec : la question est relayée au webhook de l\'agent, l\'authentification transmise, la réponse rendue', str_contains($s2, '200') && str_contains((string)$b2, 'reçu : Que disent mes triglycérides ?') && str_contains((string)$b2, 'Basic ' . base64_encode('testeur:secret')), [$s2, $b2]);
array_map('unlink', glob("$tmp/*")); @rmdir($tmp);
echo $ko === 0 ? "\n  ✅ TOUT PASSE — $n contrôles\n" : "\n  ❌ $ko contrôle(s) en échec sur $n\n";
exit($ko === 0 ? 0 : 1);
