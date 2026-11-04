<?php
/**
 * Santé Master — OÙ LE FICHIER DE SECOURS VIT, ET POURQUOI UNE ÉCRITURE ÉCHOUE.
 *   « non enregistré » : le dossier sante/ créé par git pull (root) n'est pas inscriptible par PHP (www-data).
 *   Le second emplacement, pending/, l'est (install.sh). Décor FICTIF ; aucune donnée personnelle.
 */
putenv('SANTE_DATA_FILE'); // pas de surcharge : on teste le choix par défaut
require_once __DIR__ . '/../sante/sante_store.php';
$ko = 0; $n = 0;
function v(string $t, bool $ok, $d = '') { global $ko, $n; $n++; if (!$ok) $ko++; printf("  %s %-78s %s\n", $ok ? '✅' : '❌', $t, $ok ? '' : (is_string($d) ? $d : json_encode($d, JSON_UNESCAPED_UNICODE))); }
echo "\n  SANTÉ MASTER — LE STOCKAGE DE SECOURS\n  " . str_repeat('─', 80) . "\n";

$tmp = sys_get_temp_dir() . '/sante_stock_' . bin2hex(random_bytes(4));
mkdir("$tmp/sante", 0775, true); mkdir("$tmp/pending", 0775, true);
$S = "$tmp/sante/sante_data.json"; $P = "$tmp/pending/sante_data.json"; $C = [$S, $P];
$seulPending = fn($d) => str_ends_with($d, '/pending');   // « PHP ne peut écrire que dans pending/ »
$tout = fn($d) => true; $rien = fn($d) => false;

$r = sante_choisir_fichier($C, $tout);
v('A. rien d\'écrit encore, les deux dossiers inscriptibles : sante/ (le choix d\'origine)', $r['ecriture'] === $S && $r['lecture'] === $S && $r['ecrivable'], $r);
$r = sante_choisir_fichier($C, $seulPending);
v('  → sante/ non inscriptible (créé par root) : on écrit dans pending/ — c\'est la correction', $r['ecriture'] === $P && $r['ecrivable'], $r);
$r = sante_choisir_fichier($C, $rien);
v('  → aucun dossier inscriptible : le dit (ecrivable = faux), sans planter', $r['ecrivable'] === false, $r);

file_put_contents($S, '{"a":1}'); touch($S, time() - 100);
$r = sante_choisir_fichier($C, $tout);
v('B. un fichier existe dans sante/ (inscriptible) : on continue dessus, rien ne bouge', $r['lecture'] === $S && $r['ecriture'] === $S, $r);
$r = sante_choisir_fichier($C, $seulPending);
v('  → il existe mais sante/ n\'est pas inscriptible : on le LIT (rien de perdu), on écrit dans pending/', $r['lecture'] === $S && $r['ecriture'] === $P, $r);
file_put_contents($P, '{"a":2}'); touch($P, time());
$r = sante_choisir_fichier($C, $seulPending);
v('  → pending/ plus récent : c\'est lui qu\'on lit désormais (la version la plus à jour)', $r['lecture'] === $P && $r['ecriture'] === $P, $r);

// écriture réelle dans un dossier où PHP ne peut pas écrire : le message dit quoi et où
putenv('SANTE_DATA_FILE=/proc/inexistant/sante_data.json');
$e = sante_ecrire(['profil' => ['nom' => 'PERSONNE FICTIVE']]);
v('C. écriture impossible (ni base ni fichier) : ok = faux, le message nomme le dossier et la base', $e['ok'] === false && str_contains($e['erreur'], 'écriture impossible') && str_contains($e['erreur'], 'PHP ne peut pas écrire dans /proc/inexistant') && str_contains($e['erreur'], 'base :'), $e);
putenv('SANTE_DATA_FILE=' . $P);
$e = sante_ecrire(['profil' => ['nom' => 'PERSONNE FICTIVE'], 'bilans' => []]);
$lu = sante_lire();
v('  → écriture possible : ok, et relue à l\'identique', $e['ok'] === true && str_contains($lu[0], 'PERSONNE FICTIVE'), [$e, $lu[1]]);

// la sauvegarde nocturne regarde le même fichier
define('SAUVEGARDE_BIBLIOTHEQUE', true);
putenv('SANTE_DATA_FILE');
require_once __DIR__ . '/../sauvegarde.php';
v('D. sauvegarde.php : le fichier de Santé suit le même choix (env prioritaire, sinon le plus récent des deux)', sv_fichier_sante() !== '' && (function () { putenv('SANTE_DATA_FILE=/x/y.json'); $ok = sv_fichier_sante() === '/x/y.json'; putenv('SANTE_DATA_FILE'); return $ok; })());

array_map('unlink', glob("$tmp/*/*.json*") ?: []); @rmdir("$tmp/sante"); @rmdir("$tmp/pending"); @rmdir($tmp);
echo $ko === 0 ? "\n  ✅ TOUT PASSE — $n contrôles\n" : "\n  ❌ $ko contrôle(s) en échec sur $n\n";
exit($ko === 0 ? 0 : 1);
