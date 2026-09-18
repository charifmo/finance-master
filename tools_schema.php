<?php
/**
 * ============================================================================
 *  tools_schema.php — génère le schéma JSON de l'outil n8n DEPUIS cfo_arg_spec
 * ----------------------------------------------------------------------------
 *  USAGE :  php tools_schema.php            → écrit le schéma sur stdout
 *           php tools_schema.php --inject   → l'injecte dans le workflow n8n
 *           php tools_schema.php --check    → sort 1 si le workflow a dérivé
 *
 *  POURQUOI CE FICHIER EXISTE
 *    Le schéma de l'outil et le moteur décrivaient la même chose à deux
 *    endroits, maintenus à la main. Ils ont dérivé : le schéma documentait
 *    « args: name, target_amount, initial_funding » pour create_smart_goal
 *    alors que le moteur savait aussi lire versement_mensuel — que le modèle
 *    n'a donc jamais envoyé, et que personne ne pouvait deviner. Un seul
 *    contrat (cfo_arg_spec) produit désormais les deux. --check en CI, ou
 *    avant un import n8n, rend toute nouvelle dérive impossible en silence.
 * ============================================================================
 */
require_once __DIR__ . '/cfo_intent_engine.php';

function cfo_build_tool_schema(): array {
    $spec = cfo_arg_spec();
    $commun = cfo_arg_spec_commun();

    // Une ligne par fonction : signature explicite requis/optionnel.
    $lignes = []; $props = [];
    foreach ($spec as $fn => $def) {
        $req = []; $opt = [];
        foreach ($def['params'] as $k => $d) {
            if (!empty($d['required'])) $req[] = $k; else $opt[] = $k . '?';
        }
        $lignes[] = $fn . ' : ' . $def['desc']
                  . ' | args REQUIS : ' . (count($req) ? implode(', ', $req) : 'aucun')
                  . (count($opt) ? ' | optionnels : ' . implode(', ', $opt) : '');
    }

    // Tous les paramètres canoniques du catalogue, typés et décrits une fois.
    $typeJson = ['number'=>'number', 'int_list'=>'array', 'raw'=>'array', 'string'=>'string'];
    foreach ($spec as $fn => $def) {
        foreach ($def['params'] as $k => $d) {
            $t = $typeJson[$d['type'] ?? 'string'] ?? 'string';
            if (!isset($props[$k])) {
                $props[$k] = ['type'=>$t, 'description'=>$d['desc'] ?? '', '_fns'=>[$fn]];
            } else {
                $props[$k]['_fns'][] = $fn;
                // Type divergent entre deux fonctions : on ne contraint plus.
                if ($props[$k]['type'] !== $t) unset($props[$k]['type']);
            }
        }
    }
    foreach ($commun as $k => $d) {
        $props[$k] = ['type'=>($typeJson[$d['type']] ?? 'string'), 'description'=>$d['desc'] ?? '', '_fns'=>['*']];
    }
    ksort($props);
    foreach ($props as $k => &$pv) {
        $fns = $pv['_fns']; unset($pv['_fns']);
        $pv['description'] = trim($pv['description'] . ' [' . (in_array('*', $fns, true) ? 'toutes fonctions' : implode(', ', $fns)) . ']');
        if (($pv['type'] ?? null) === 'array') $pv['items'] = ['type' => ($k === 'years' ? 'integer' : 'object')];
    }
    unset($pv);

    return [
        'type' => 'object',
        'required' => ['calls'],
        'properties' => ['calls' => [
            'type' => 'array',
            'minItems' => 1,
            'description' => "Les operations a simuler, dans l'ordre. Un transfert entre deux comptes = DEUX appels adjust_account_balance dans ce meme tableau. "
                           . "Chaque appel est autonome : ses args ne concernent QUE lui, jamais l'appel voisin.",
            'items' => [
                'type' => 'object',
                'required' => ['function', 'args'],
                'properties' => [
                    'function' => [
                        'type' => 'string',
                        'enum' => array_values(cfo_catalog_names()),
                        'description' => implode("\n", $lignes),
                    ],
                    'args' => [
                        'type' => 'object',
                        'description' => "Arguments de CETTE fonction uniquement. Utilise les noms canoniques ci-dessous. "
                                       . "Le serveur accepte aussi les synonymes courants et les montants ecrits en toutes lettres "
                                       . "(« 5 445 DH »), mais il te renvoie alors arguments_normalises : lis-le, il dit ce qu'il a "
                                       . "redresse et ce qu'il a IGNORE. Un parametre requis manquant = refus, rien n'est ecrit.",
                        'properties' => $props,
                        'additionalProperties' => true,
                    ],
                ],
            ],
        ]],
    ];
}

if (PHP_SAPI !== 'cli') { http_response_code(403); exit("CLI uniquement.\n"); }

$schema = json_encode(cfo_build_tool_schema(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
$mode = $argv[1] ?? '';
$WF = __DIR__ . '/super_agent_cfo_audio.json';

if ($mode === '--inject' || $mode === '--check') {
    $wf = json_decode(file_get_contents($WF), true);
    $idx = null;
    foreach ($wf['nodes'] as $i => $n) { if (($n['name'] ?? '') === 'Tool: Intent Compiler') { $idx = $i; break; } }
    if ($idx === null) { fwrite(STDERR, "Noeud 'Tool: Intent Compiler' introuvable.\n"); exit(2); }
    $actuel = $wf['nodes'][$idx]['parameters']['inputSchema'] ?? '';
    $identique = json_decode($actuel, true) == json_decode($schema, true);

    if ($mode === '--check') {
        echo $identique ? "✅ Schéma n8n aligné sur cfo_arg_spec.\n"
                        : "❌ DÉRIVE : le schéma du workflow ne correspond plus à cfo_arg_spec. Relancer : php tools_schema.php --inject\n";
        exit($identique ? 0 : 1);
    }
    if ($identique) { echo "Schéma déjà à jour, workflow inchangé.\n"; exit(0); }
    $wf['nodes'][$idx]['parameters']['inputSchema'] = $schema;
    file_put_contents($WF, json_encode($wf, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\n");
    echo "✅ Schéma injecté dans " . basename($WF) . " (" . strlen($schema) . " octets).\n";
    exit(0);
}
echo $schema, "\n";
