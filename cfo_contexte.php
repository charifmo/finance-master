<?php
// ============================================================================
// Finance Master v37.69 — LE CONTEXTE ET LES CONSIGNES DU CFO, SERVIS PAR LE VPS
// ----------------------------------------------------------------------------
// « Je veux refaire le CFO s'il le faut pour éviter ce genre de problème critique. »
// Le nœud n8n « Build Agent Input » fabriquait lui-même le contexte envoyé au modèle
// et les consignes étaient figées dans le nœud « AI Agent » : toute correction
// demandait une intervention dans n8n. Désormais n8n n'est qu'une coquille :
//
//   GET                                  -> { system_message, version }
//   POST { question, historique,
//          finance_data }                -> { system_message, finance_data_json,
//                                             exercice_expose, version }
//
// Un `git pull` met à jour ce que le CFO lit et les règles qu'il suit.
//   • finance_data pré-digéré par l'appli web (matrice_cash_flow_calculee) : tel quel ;
//   • JSON brut du serveur (Telegram) : borné à l'exercice utile, et la lecture du
//     moteur (_lectureCFO, enregistrée par l'appli depuis la v37.67) passe EN TÊTE
//     sous le nom « lecture_moteur » — c'est elle que les consignes (§0) font lire.
// Les consignes vivent dans cfo_system_prompt.md, à côté de ce fichier.
// Le nœud n8n garde une copie de secours de tout ceci : si ce fichier ne répond
// pas, le CFO marche quand même (avec la version installée).
// ============================================================================

const CFO_CONTEXTE_VERSION = '37.73';
//  v37.73 : suivi des étapes, lu par l'appli pendant l'attente — facultatif, son absence ne casse rien
if (is_readable(__DIR__ . '/cfo_etapes.php')) require_once __DIR__ . '/cfo_etapes.php';
if (!function_exists('cfo_etape_noter')) { function cfo_etape_noter(string $sid, string $code, string $libelle = ''): void {} }

function cfo_consignes(): string {
    $f = __DIR__ . '/cfo_system_prompt.md';
    $t = is_readable($f) ? (string)file_get_contents($f) : '';
    return $t;
}

//  L'exercice à exposer : cité dans la question > cité dans l'historique (le dernier)
//  > année de l'application > année civile > dernière année connue.
function cfo_choisir_exercice(array $fd, string $question, string $historique): ?string {
    $dispo = array_map('strval', array_keys($fd['donneesAnnuelles'] ?? []));
    if (!$dispo) return null;
    preg_match_all('/\b20\d{2}\b/', $question, $m);
    foreach ($m[0] as $y) if (in_array($y, $dispo, true)) return $y;
    preg_match_all('/\b20\d{2}\b/', $historique, $h);
    for ($i = count($h[0]) - 1; $i >= 0; $i--) if (in_array($h[0][$i], $dispo, true)) return $h[0][$i];
    $app = (string)(($fd['soldesInitiaux'] ?? [])['anneeActuelle'] ?? '');
    if ($app !== '' && in_array($app, $dispo, true)) return $app;
    $civ = date('Y');
    if (in_array($civ, $dispo, true)) return $civ;
    $tri = $dispo; sort($tri);
    return end($tri);
}

//  Le contexte du modèle (même projection que l'ancien nœud n8n, plus lecture_moteur).
function cfo_projeter(array $fd, string $question, string $historique): array {
    if (isset($fd['matrice_cash_flow_calculee'])) return ['contexte' => $fd, 'exercice' => null];
    if (!isset($fd['donneesAnnuelles']) || !is_array($fd['donneesAnnuelles'])) return ['contexte' => $fd, 'exercice' => null];
    $cible = cfo_choisir_exercice($fd, $question, $historique);
    if ($cible === null) return ['contexte' => $fd, 'exercice' => null];

    $annees = array_map('strval', array_keys($fd['donneesAnnuelles'])); sort($annees);
    $src = $fd['donneesAnnuelles'][$cible] ?? [];
    $exercice = []; $nbTx = 0;
    foreach ($src as $k => $v) {
        if ($k === 'transactionsReelles') { $nbTx = is_array($v) ? count($v) : 0; continue; }
        $exercice[$k] = $v;
    }
    $autres = [];
    foreach ($annees as $a) {
        if ($a === $cible) continue;
        $y = $fd['donneesAnnuelles'][$a] ?? [];
        $irr = is_array($y['depensesIrregulieres'] ?? null) ? $y['depensesIrregulieres'] : [];
        $ep = is_array($y['epargne'] ?? null) ? array_values(array_filter($y['epargne'])) : [];
        $autres[] = [
            'exercice' => (int)$a,
            'nb_revenus' => count($y['revenus'] ?? []),
            'nb_charges_fixes' => count($y['chargesFixes'] ?? []),
            'nb_depenses_irregulieres' => count($irr),
            'total_depenses_irregulieres' => array_sum(array_map(fn($d) => (float)($d['montant'] ?? 0), $irr)),
            'versements_planifies' => array_map(fn($e) => ['label' => $e['label'] ?? ($e['nom'] ?? ''), 'montant' => (float)($e['valeur'] ?? 0)], $ep),
            'total_versements_planifies' => array_sum(array_map(fn($e) => (float)($e['valeur'] ?? 0), $ep)),
            'nb_transactions_reelles' => is_array($y['transactionsReelles'] ?? null) ? count($y['transactionsReelles']) : 0,
        ];
    }
    $si = $fd['soldesInitiaux'] ?? [];
    $si['categories'] = array_values(array_map(fn($c) => ['id' => $c['id'] ?? null, 'label' => $c['label'] ?? null],
                                              array_filter($si['categories'] ?? [], fn($c) => is_array($c) && empty($c['archive']))));
    $lecture = $fd['_lectureCFO'] ?? null;
    $ctx = [];
    if (is_array($lecture)) {
        $ctx['lecture_moteur'] = $lecture;
        $ctx['lecture_moteur_mode_emploi'] = 'CHIFFRES CALCULÉS PAR L’APPLICATION, à lire tels quels (consigne §0) : comptes réels de chaque ligne, montants de ce cycle exceptions comprises, budget du cycle des charges variables, alimentation du Compte Courant. Les lignes brutes de donneesAnnuelles ci-dessous servent à comprendre la structure, JAMAIS à recalculer ces chiffres.';
    }
    $ctx['_contexte'] = [
        'exercice_expose' => (int)$cible,
        'exercices_disponibles' => array_map('intval', $annees),
        'autres_exercices_resume' => $autres,
        'transactions_reelles_masquees' => $nbTx,
        'avertissement' => 'Ce contexte est volontairement borné à l exercice ' . $cible . '. '
            . 'Les autres exercices et l historique des transactions réelles existent bien côté serveur : '
            . 'ils ne sont simplement pas injectés ici. NE CONCLUS JAMAIS qu une donnée absente de ce bloc n existe pas. '
            . 'Les outils travaillent sur le JSON complet — propose_changes peut modifier n importe quelle année, '
            . 'et transactions_reelles_engine avec action "list" retourne l historique. '
            . 'Si la question porte sur un exercice non exposé, utilise l outil au lieu de répondre depuis ce bloc.',
        'regle_annee' => 'INTERDIT de presenter les chiffres de l exercice ' . $cible . ' comme ceux d une autre annee. '
            . 'Les versements planifies de chaque exercice figurent dans autres_exercices_resume[].versements_planifies : '
            . 'lis-les la, ne les deduis jamais de l exercice expose. Annonce toujours explicitement l annee sur laquelle tu reponds.',
    ];
    $ctx['version'] = $fd['version'] ?? null;
    $ctx['_schemaVersion'] = $fd['_schemaVersion'] ?? null;
    $ctx['comptes'] = array_map(fn($c) => ['id' => $c['id'] ?? null, 'label' => $c['label'] ?? null, 'type' => $c['type'] ?? null, 'solde' => $c['solde'] ?? null], $fd['comptes'] ?? []);
    $ctx['soldesInitiaux'] = $si;
    $ctx['donneesAnnuelles'] = [(string)$cible => $exercice];
    $ctx['wealthGoals'] = array_map(fn($g) => ['name' => $g['name'] ?? null, 'target' => $g['target'] ?? null, 'current' => $g['current'] ?? null], $fd['wealthGoals'] ?? []);
    $ctx['masterAssets'] = array_map(fn($a) => [
        'id' => $a['id'] ?? null, 'name' => $a['name'] ?? null, 'isProductive' => $a['isProductive'] ?? null,
        'value' => $a['value'] ?? null, 'valeur_actuelle' => $a['valeur_actuelle'] ?? null, 'revenue' => $a['revenue'] ?? null,
        'apport_personnel' => $a['apport_personnel'] ?? null, 'montant_credit' => $a['montant_credit'] ?? null,
    ], $fd['masterAssets'] ?? []);
    return ['contexte' => $ctx, 'exercice' => (int)$cible];
}

function cfo_contexte_reponse(array $entree): array {
    $fd = $entree['finance_data'] ?? null;
    $q = (string)($entree['question'] ?? '');
    $hist = (string)($entree['historique'] ?? '');
    $out = ['version' => CFO_CONTEXTE_VERSION, 'system_message' => cfo_consignes(), 'finance_data_json' => null, 'exercice_expose' => null];
    if (is_array($fd)) {
        $p = cfo_projeter($fd, $q, $hist);
        $out['finance_data_json'] = json_encode($p['contexte'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $out['exercice_expose'] = $p['exercice'];
    }
    if (!empty($entree['session_id']))
        cfo_etape_noter((string)$entree['session_id'], 'contexte', 'Vos chiffres transmis au CFO' . ($out['exercice_expose'] ? ' (exercice ' . $out['exercice_expose'] . ')' : ''));
    return $out;
}

if (PHP_SAPI !== 'cli' && basename($_SERVER['SCRIPT_FILENAME'] ?? '') === basename(__FILE__)) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    $m = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($m === 'OPTIONS') { http_response_code(204); exit; }
    if ($m === 'GET') { echo json_encode(['version' => CFO_CONTEXTE_VERSION, 'system_message' => cfo_consignes()], JSON_UNESCAPED_UNICODE); exit; }
    if ($m !== 'POST') { http_response_code(405); echo '{"error":"methode"}'; exit; }
    $corps = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($corps)) { http_response_code(400); echo '{"error":"JSON attendu"}'; exit; }
    echo json_encode(cfo_contexte_reponse($corps), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
