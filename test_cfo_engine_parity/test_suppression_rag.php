<?php
declare(strict_types=1);
/**
 * v37.10 — LE BOUTON « OUBLIER » NE POUVAIT PAS FONCTIONNER.
 *
 *   Le verrou n'acceptait qu'un identifiant ENTIER. Or le nœud PGVector de
 *   LangChain crée finance_vectors avec « id uuid PRIMARY KEY DEFAULT
 *   gen_random_uuid() » : chaque règle porte un UUID. Le serveur répondait
 *   donc invariablement ID_INVALIDE et la règle restait en base — exactement
 *   ce qui était rapporté depuis l'écran Supervision IA.
 *
 *   Vérifié de bout en bout sur un PostgreSQL 16 réel (table à clés UUID
 *   puis table à clés entières) ; cette suite verrouille la logique de
 *   reconnaissance, qui est la partie rejouable sans base de données.
 */
require_once __DIR__ . '/../cfo_rag_ids.php';

$ko = 0;
function v(string $titre, bool $ok, string $detail = ''): void {
    global $ko; if (!$ok) $ko++;
    printf("  %s %-62s %s\n", $ok ? '✅' : '❌', $titre, $ok ? '' : $detail);
}

echo "\n  SUPPRESSION D'UNE RÈGLE RAG — RECONNAISSANCE DES IDENTIFIANTS\n  " . str_repeat('─', 78) . "\n";

/* ── Le cas de production : un UUID, tel que l'écran l'affiche ───────────── */
$r = cfo_valider_id_vecteur('FE0505E9-BA36-4640-A0C4-8F076114FE92');
v('UUID en majuscules accepté', $r['ok'] && $r['forme'] === 'uuid', json_encode($r));
v('  → normalisé en minuscules', $r['valeur'] === 'fe0505e9-ba36-4640-a0c4-8f076114fe92', (string)$r['valeur']);

$r = cfo_valider_id_vecteur('f64decdb-8e65-4a78-990a-a2ab402b3afd');
v('UUID en minuscules accepté', $r['ok'] && $r['forme'] === 'uuid', json_encode($r));

/* ── Rétrocompatibilité : les clés entières marchent toujours ────────────── */
foreach ([['entier natif', 42], ['entier en chaîne', '42']] as [$titre, $val]) {
    $r = cfo_valider_id_vecteur($val);
    v($titre . ' accepté', $r['ok'] && $r['forme'] === 'entier' && $r['valeur'] === 42, json_encode($r));
}
$r = cfo_valider_id_vecteur(0);
v('entier nul refusé', !$r['ok'], json_encode($r));
$r = cfo_valider_id_vecteur(-7);
v('entier négatif refusé', !$r['ok'], json_encode($r));

/* ── Tout le reste est refusé. La liste blanche reste une liste blanche. ── */
$hostiles = [
    'injection SQL après un UUID valide' => "fe0505e9-ba36-4640-a0c4-8f076114fe92'; DROP TABLE finance_vectors--",
    'injection SQL après un entier'       => "1; DROP TABLE finance_vectors",
    'UUID sans tirets'                    => 'fe0505e9ba364640a0c48f076114fe92',
    'UUID tronqué'                        => 'fe0505e9-ba36-4640-a0c4',
    'UUID avec un caractère hors hexa'    => 'ge0505e9-ba36-4640-a0c4-8f076114fe92',
    'chaîne vide'                         => '',
    'null'                                => null,
    'tableau'                             => ['fe0505e9-ba36-4640-a0c4-8f076114fe92'],
    'booléen'                             => true,
    'flottant'                            => 1.5,
    'espace avant le UUID'                => ' fe0505e9-ba36-4640-a0c4-8f076114fe92',
    'caractère joker'                     => '%',
];
foreach ($hostiles as $titre => $val) {
    $r = cfo_valider_id_vecteur($val);
    v($titre . ' refusé', !$r['ok'] && $r['valeur'] === null, json_encode($r));
}

/* ── Le type de la colonne décide de la comparaison ──────────────────────── */
v('colonne uuid + UUID → compatible',    cfo_id_incompatible('uuid', 'uuid') === null);
v('colonne integer + entier → compatible', cfo_id_incompatible('integer', 'entier') === null);
v('colonne bigint + entier → compatible',  cfo_id_incompatible('bigint', 'entier') === null);
$m = cfo_id_incompatible('uuid', 'entier');
v('colonne uuid + entier → refus nommé', $m !== null && strpos($m, 'uuid') !== false, (string)$m);
$m = cfo_id_incompatible('integer', 'uuid');
v('colonne integer + UUID → refus nommé', $m !== null && strpos($m, 'integer') !== false, (string)$m);

/* ── La clause SQL : transtypage explicite pour une colonne uuid ─────────── */
v('colonne uuid → id = :id::uuid',   cfo_clause_id('uuid') === 'id = :id::uuid', cfo_clause_id('uuid'));
v('colonne entière → id = :id',      cfo_clause_id('integer') === 'id = :id', cfo_clause_id('integer'));
v('la clause ne concatène jamais la valeur',
  strpos(cfo_clause_id('uuid'), ':id') !== false && strpos(cfo_clause_id('integer'), ':id') !== false);

echo '  ' . str_repeat('─', 78) . "\n";
echo $ko ? "  ❌ {$ko} contrôle(s) en échec\n" : "  ✅ TOUT PASSE — 0 contrôle(s) en échec\n";
exit($ko ? 1 : 0);
