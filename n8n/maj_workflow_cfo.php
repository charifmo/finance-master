<?php
// ============================================================================
// v37.69 — MET À JOUR LE WORKFLOW « Super-Agent CFO » EXPORTÉ DE n8n
// ----------------------------------------------------------------------------
//   php n8n/maj_workflow_cfo.php <export.json> <sortie.json> [identifiants.json]
//
// <export.json> : la sortie de « n8n export:workflow --all » (ou un seul workflow).
// Repère le workflow du CFO (nœuds Normalize Input + Build Agent Input + AI Agent ;
// l'actif d'abord), et ne change QUE deux choses :
//   • Build Agent Input : le code v3 (n8n/build_agent_input.js) — contexte et
//     consignes demandés au VPS (cfo_contexte.php), copie de secours intégrée ;
//   • AI Agent : ses consignes deviennent « {{ $json.system_message }} ».
// Tout le reste (identifiants Telegram / Gemini / Postgres / OpenAI, autres nœuds,
// réglages faits dans l'interface) est recopié tel quel. Idempotent.
// Affiche un résumé JSON : { id, nom, actif, base, deja_a_jour }.
// ============================================================================

if ($argc < 3) { fwrite(STDERR, "usage : php maj_workflow_cfo.php <export.json> <sortie.json>\n"); exit(2); }
$ici = __DIR__;
$export = json_decode((string)file_get_contents($argv[1]), true);
if (!is_array($export)) { fwrite(STDERR, "export illisible\n"); exit(3); }
$liste = isset($export['nodes']) ? [$export] : array_values($export);

$noeud = function (array $wf, string $nom): ?int {
    foreach ($wf['nodes'] ?? [] as $i => $n) if (($n['name'] ?? '') === $nom) return $i;
    return null;
};
$candidats = array_values(array_filter($liste, fn($w) => is_array($w)
    && $noeud($w, 'Normalize Input') !== null && $noeud($w, 'Build Agent Input') !== null && $noeud($w, 'AI Agent') !== null));
if (!$candidats) { fwrite(STDERR, "aucun workflow CFO (Normalize Input + Build Agent Input + AI Agent) dans l'export\n"); exit(4); }
usort($candidats, function ($a, $b) {
    $act = (int)!empty($b['active']) <=> (int)!empty($a['active']);
    if ($act) return $act;
    $nom = (int)(stripos((string)($b['name'] ?? ''), 'Super-Agent CFO') !== false) <=> (int)(stripos((string)($a['name'] ?? ''), 'Super-Agent CFO') !== false);
    if ($nom) return $nom;
    return strcmp((string)($b['updatedAt'] ?? ''), (string)($a['updatedAt'] ?? ''));
});
$wf = $candidats[0];

//  L'adresse du VPS : celle que le workflow utilise déjà pour save_data.php
$iN = $noeud($wf, 'Normalize Input');
$codeN = (string)($wf['nodes'][$iN]['parameters']['jsCode'] ?? '');
if (!preg_match('#(https?://[^\'"\s`]+?)/finance/save_data\.php#', $codeN, $m)) { fwrite(STDERR, "adresse du VPS introuvable dans Normalize Input\n"); exit(5); }
$base = $m[1];

$modele = (string)file_get_contents($ici . '/build_agent_input.js');
$consignes = (string)file_get_contents(dirname($ici) . '/cfo_system_prompt.md');
if (strlen($consignes) < 500 || strpos($modele, '__PROMPT_SECOURS__') === false) { fwrite(STDERR, "modèle ou consignes manquants\n"); exit(6); }
$code = str_replace(['__FINANCE_BASE__', '__PROMPT_SECOURS__'],
                    [$base, json_encode($consignes, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)], $modele);

$iB = $noeud($wf, 'Build Agent Input');
$iA = $noeud($wf, 'AI Agent');
$avant = json_encode([$wf['nodes'][$iB]['parameters']['jsCode'] ?? null, $wf['nodes'][$iA]['parameters']['options']['systemMessage'] ?? null]);
$wf['nodes'][$iB]['parameters']['jsCode'] = $code;
if (!isset($wf['nodes'][$iA]['parameters']['options']) || !is_array($wf['nodes'][$iA]['parameters']['options'])) $wf['nodes'][$iA]['parameters']['options'] = [];
$wf['nodes'][$iA]['parameters']['options']['systemMessage'] = '={{ $json.system_message }}';
//  v37.69 : le bot Telegram du CFO. Telegram n'accepte qu'UN workflow par bot : un workflow CFO branché
//  sur un autre bot (« Telegram santé ») lui vole ses messages et laisse le bot CFO sans réponse. Avec la
//  liste des identifiants de n8n (3e argument), les nœuds Telegram sont rebranchés sur l'identifiant
//  Telegram dont le nom contient « CFO » — seulement s'il existe, et s'il est unique.
$telegram = null;
if ($argc >= 4 && is_readable($argv[3])) {
    $creds = json_decode((string)file_get_contents($argv[3]), true);
    $creds = is_array($creds) ? (isset($creds['id']) ? [$creds] : $creds) : [];
    $cfo = array_values(array_filter($creds, fn($c) => is_array($c) && ($c['type'] ?? '') === 'telegramApi' && stripos((string)($c['name'] ?? ''), 'cfo') !== false));
    if (count($cfo) === 1) {
        $cible = ['id' => (string)$cfo[0]['id'], 'name' => (string)$cfo[0]['name']];
        $avantT = [];
        foreach ($wf['nodes'] as $i => $n) {
            if (stripos((string)($n['type'] ?? ''), 'telegram') === false || !isset($n['credentials']['telegramApi'])) continue;
            $avantT[] = (string)($n['credentials']['telegramApi']['name'] ?? '?');
            $wf['nodes'][$i]['credentials']['telegramApi'] = $cible;
        }
        $telegram = ['avant' => array_values(array_unique($avantT)), 'apres' => $cible['name']];
    } else {
        $telegram = ['avant' => null, 'apres' => null, 'note' => count($cfo) ? 'plusieurs identifiants Telegram « CFO » : rien changé' : 'aucun identifiant Telegram « CFO » : rien changé'];
    }
}
$apres = json_encode([$code, '={{ $json.system_message }}']);
$telegramChange = $telegram && $telegram['apres'] && $telegram['avant'] !== [$telegram['apres']];

file_put_contents($argv[2], json_encode($wf, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
echo json_encode(['id' => $wf['id'] ?? null, 'nom' => $wf['name'] ?? null, 'actif' => !empty($wf['active']), 'base' => $base,
                  'telegram' => $telegram, 'deja_a_jour' => $avant === $apres && !$telegramChange], JSON_UNESCAPED_UNICODE), "\n";
