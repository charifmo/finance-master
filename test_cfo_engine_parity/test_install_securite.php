<?php
declare(strict_types=1);
/**
 * v37.44 — « CHROME : HAMEÇONNAGE DÉTECTÉ SUR n8n.beau.ink ».
 *
 *   Avant de demander un réexamen à Google, `sudo bash install.sh securite`
 *   vérifie que n8n ne sert pas une VRAIE page piégée (des campagnes servent
 *   leurs pages par des webhooks n8n depuis octobre 2025). Joué ici avec un faux
 *   `docker` : un n8n sain, puis un n8n détourné. Le contrôle ne modifie rien.
 */
$ko = 0; $n = 0;
function v(string $titre, bool $ok, string $detail = ''): void {
    global $ko, $n; $n++; if (!$ok) $ko++;
    printf("  %s %-72s %s\n", $ok ? '✅' : '❌', $titre, $ok ? '' : $detail);
}
echo "\n  CONTRÔLE ANTI-HAMEÇONNAGE — install.sh securite (lecture seule)\n  " . str_repeat('─', 86) . "\n";
if (!is_executable('/bin/bash')) { echo "  ⏭️  ignoré (bash absent)\n  ✅ TOUT PASSE — 0 contrôles\n"; exit(0); }

$sh = realpath(__DIR__ . '/../install.sh');
$bac = sys_get_temp_dir() . '/securite_' . getmypid();
@mkdir("$bac/bin", 0777, true);
$WF_SAIN = [
    ['name' => 'Super-Agent CFO', 'active' => true, 'nodes' => [
        ['type' => 'n8n-nodes-base.webhook', 'parameters' => ['path' => 'finance-cfo-web', 'httpMethod' => 'POST']],
        ['type' => 'n8n-nodes-base.respondToWebhook', 'parameters' => ['respondWith' => 'json']]]],
    ['name' => 'Memory ingest', 'active' => true, 'nodes' => [
        ['type' => 'n8n-nodes-base.webhook', 'parameters' => ['path' => 'finance-memory-ingest', 'httpMethod' => 'POST']]]],
    ['name' => 'Brouillon de formulaire', 'active' => false, 'nodes' => [['type' => 'n8n-nodes-base.formTrigger', 'parameters' => []]]],
    ['name' => 'Rappel quotidien', 'active' => true, 'nodes' => [['type' => 'n8n-nodes-base.scheduleTrigger', 'parameters' => []]]],
];
$WF_PIEGE = array_merge($WF_SAIN, [
    ['name' => 'Partage OneDrive', 'active' => true, 'nodes' => [
        ['type' => 'n8n-nodes-base.webhook', 'parameters' => ['path' => 'doc-7781', 'httpMethod' => 'GET']],
        ['type' => 'n8n-nodes-base.respondToWebhook', 'parameters' => ['respondWith' => 'text', 'responseBody' => '<html><body><form>Vérifiez votre compte</form></body></html>']]]],
    ['name' => 'Inscription', 'active' => true, 'nodes' => [['type' => 'n8n-nodes-base.formTrigger', 'parameters' => ['formTitle' => 'Connexion']]]],
    // un GET greffé sur le chemin d'un webhook légitime : le chemin ne suffit pas
    ['name' => 'Copie CFO', 'active' => true, 'nodes' => [
        ['type' => 'n8n-nodes-base.webhook', 'parameters' => ['path' => 'finance-cfo-web', 'httpMethod' => 'GET']]]],
]);
// faux docker : journalise chaque appel, sert l'export demandé
file_put_contents("$bac/bin/docker", "#!/bin/bash\necho \"\$*\" >> \"$bac/journal\"\n"
    . "case \"\$1 \$2\" in\n  'ps --format') echo n8n ;;\n  'exec n8n') shift 2; case \"\$1\" in\n"
    . "    n8n) [[ \"\$2\" == '--version' ]] && echo 1.123.4; exit 0 ;;\n    cat) cat \"$bac/export.json\" ;;\n    rm) exit 0 ;;\n  esac ;;\nesac\n");
chmod("$bac/bin/docker", 0755);
$lancer = function (array $export) use ($bac, $sh): array {
    file_put_contents("$bac/export.json", json_encode($export));
    @unlink("$bac/journal");
    exec('PATH=' . escapeshellarg("$bac/bin") . ':/usr/bin:/bin bash ' . escapeshellarg($sh) . ' securite 2>&1', $o, $rc);
    return ['rc' => $rc, 'sortie' => implode("\n", $o), 'journal' => (string)@file_get_contents("$bac/journal")];
};
$moi = function_exists('posix_geteuid') ? posix_geteuid() : 0;
if ($moi !== 0) { echo "  ⏭️  ignoré (install.sh exige root)\n  ✅ TOUT PASSE — 0 contrôles\n"; exit(0); }

$tmpAvant = count(glob(sys_get_temp_dir() . '/tmp.*') ?: []);
$s = $lancer($WF_SAIN);
v('n8n sain : réussit, version affichée', $s['rc'] === 0 && str_contains($s['sortie'], 'Version de n8n : 1.123.4'), $s['sortie']);
v('  → les deux webhooks de l\'application reconnus [ok]', preg_match('/\[ok\]\s+Super-Agent CFO/', $s['sortie']) && preg_match('/\[ok\]\s+Memory ingest/', $s['sortie'])
  && str_contains($s['sortie'], 'webhook POST /webhook/finance-cfo-web'), $s['sortie']);
v('  → un workflow INACTIF n\'est pas exposé : ignoré', !str_contains($s['sortie'], 'Brouillon'));
v('  → un workflow sans entrée publique (planifié) : ignoré', !str_contains($s['sortie'], 'Rappel quotidien'));
v('  → verdict : très probablement un faux positif, réexamen à demander', str_contains($s['sortie'], '[OK] Aucun webhook inconnu') && str_contains($s['sortie'], 'SAFE_BROWSING.md'), $s['sortie']);

$p = $lancer($WF_PIEGE);
v('n8n détourné : le faux « partage OneDrive » est À VÉRIFIER', (bool)preg_match('/\[A VERIFIER\] Partage OneDrive\s+- webhook GET \/webhook\/doc-7781  <==\s+- reponse HTML a un webhook  <==/', $p['sortie']), $p['sortie']);
v('  → un formulaire n8n public aussi', (bool)preg_match('/\[A VERIFIER\] Inscription\s+- formulaire n8n PUBLIC/', $p['sortie']), $p['sortie']);
v('  → un GET sur le chemin d\'un webhook connu aussi (l\'application n\'y répond qu\'en POST)', (bool)preg_match('/\[A VERIFIER\] Copie CFO\s+- webhook GET \/webhook\/finance-cfo-web  <==/', $p['sortie']), $p['sortie']);
v('  → verdict : 3 workflows à vérifier, et quoi faire', str_contains($p['sortie'], '[!] 3 workflow(s) a verifier') && str_contains($p['sortie'], 'desactivez-le'), $p['sortie']);
v('  → les webhooks légitimes restent [ok]', preg_match('/\[ok\]\s+Super-Agent CFO/', $p['sortie']) === 1);

$cmds = array_filter(explode("\n", trim($p['journal'] . "\n" . $s['journal'])));
$permis = fn($c) => preg_match('#^ps --format#', $c) || preg_match('#^exec n8n (n8n --version|n8n export:workflow --all --output=/tmp/fm_workflows_\d+\.json|cat /tmp/fm_workflows_\d+\.json|rm -f /tmp/fm_workflows_\d+\.json)$#', $c);
v('LECTURE SEULE : rien d\'autre que version, export, lecture, nettoyage du fichier temporaire', $cmds && !array_filter($cmds, fn($c) => !$permis($c)), implode(' | ', array_filter($cmds, fn($c) => !$permis($c))));
v('  → ni redémarrage, ni import, ni arrêt de n8n', !preg_match('/restart|import|stop|update|delete|activate/i', implode("\n", $cmds)));
v('  → aucun fichier temporaire laissé sur l\'hôte', count(glob(sys_get_temp_dir() . '/tmp.*') ?: []) === $tmpAvant);

file_put_contents("$bac/bin/docker", "#!/bin/bash\nexit 1\n");
$a = $lancer([]);
v('sans conteneur n8n : le dit, ne plante pas', $a['rc'] === 0 && str_contains($a['sortie'], 'introuvable'), $a['sortie']);
v('usage documenté en tête d\'install.sh', str_contains((string)file_get_contents($sh), 'sudo bash install.sh securite'));
v('SAFE_BROWSING.md : vérifier, signaler, prévenir', ($doc = (string)@file_get_contents(__DIR__ . '/../SAFE_BROWSING.md')) !== ''
  && str_contains($doc, 'install.sh securite') && str_contains($doc, 'report_error') && str_contains($doc, 'Search Console'));

array_map('unlink', array_filter(array_merge(glob("$bac/bin/*"), glob("$bac/*")), 'is_file'));
@rmdir("$bac/bin"); @rmdir($bac);
echo "  " . str_repeat('─', 86) . "\n";
echo $ko === 0 ? "  ✅ TOUT PASSE — $n contrôles\n" : "  ❌ $ko contrôle(s) en échec sur $n\n";
exit($ko === 0 ? 0 : 1);
