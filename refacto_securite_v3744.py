# -*- coding: utf-8 -*-
"""
v37.44 — « Chrome : hameçonnage détecté sur n8n.beau.ink/finance ».

Google Safe Browsing signale l'HÔTE n8n.beau.ink ; l'application Finance, servie
sous /finance/, hérite du signalement. Deux causes possibles, à départager AVANT
de demander un réexamen à Google :

  • le faux positif connu des n8n auto-hébergés : « n8n » dans le nom d'hôte et
    une page de connexion n8n publique, qui ressemble à celle de n8n.io ;
  • un vrai détournement : depuis octobre 2025, des campagnes d'hameçonnage
    servent leurs pages piégées par des webhooks n8n (Cisco Talos). Un n8n
    pas à jour ou mal protégé peut héberger, à l'insu de son propriétaire, un
    workflow qui sert une page HTML ou un formulaire public.

`sudo bash install.sh securite` fait ce contrôle en LECTURE SEULE : version de
n8n, et chaque workflow ACTIF qui expose quelque chose au public (webhook,
formulaire n8n, réponse HTML). Les deux webhooks de l'application
(finance-cfo-web, finance-memory-ingest, POST → JSON) sont reconnus ; tout le
reste est listé « À VÉRIFIER ». Rien n'est modifié, rien n'est redémarré.
"""
import io, sys

F = 'install.sh'
src = io.open(F, encoding='utf-8').read()

def sub(label, a, b):
    global src
    if src.count(a) != 1:
        print(f'✖ {F} — {label} : {src.count(a)} ancre(s), 1 attendue'); sys.exit(1)
    src = src.replace(a, b)

VERIF = r'''# -----------------------------------------------------------------------------
# Contrôle anti-hameçonnage (v37.44) — LECTURE SEULE, ne modifie rien.
#  Chrome signale n8n.beau.ink comme site d'hameçonnage. Avant de demander un
#  réexamen à Google, on s'assure que n8n ne sert pas une VRAIE page piégée :
#  workflows actifs exposant un webhook, un formulaire n8n ou une page HTML.
#  Seul :  sudo bash install.sh securite
# -----------------------------------------------------------------------------
WEBHOOKS_CONNUS="finance-cfo-web finance-memory-ingest"
verifier_securite() {
  if ! command -v docker >/dev/null 2>&1 || ! docker ps --format '{{.Names}}' | grep -qx "${N8N_CONTAINER}"; then
    warn "Conteneur ${N8N_CONTAINER} introuvable : controle n8n impossible."
    return 0
  fi
  log "Version de n8n : $(docker exec "${N8N_CONTAINER}" n8n --version 2>/dev/null | tail -1 || echo inconnue) (a tenir a jour : docker pull ${N8N_IMAGE})"
  local dans="/tmp/fm_workflows_$$.json" ici
  ici="$(mktemp)"
  if ! docker exec "${N8N_CONTAINER}" n8n export:workflow --all --output="${dans}" >/dev/null 2>&1 \
     || ! docker exec "${N8N_CONTAINER}" cat "${dans}" > "${ici}" 2>/dev/null; then
    docker exec "${N8N_CONTAINER}" rm -f "${dans}" >/dev/null 2>&1 || true
    rm -f "${ici}"
    warn "Export des workflows impossible (n8n export:workflow) : controle non fait."
    return 0
  fi
  docker exec "${N8N_CONTAINER}" rm -f "${dans}" >/dev/null 2>&1 || true
  WEBHOOKS_CONNUS="${WEBHOOKS_CONNUS}" php -- "${ici}" <<'PHP'
<?php
$wf = json_decode((string)file_get_contents($argv[1]), true);
if (!is_array($wf)) { echo "[!] Export illisible.\n"; exit(0); }
if (isset($wf['nodes'])) $wf = [$wf];
$connus = preg_split('/\s+/', trim((string)getenv('WEBHOOKS_CONNUS')));
$alertes = 0; $actifs = 0;
foreach ($wf as $w) {
    if (empty($w['active'])) continue;
    $actifs++;
    $exp = [];
    foreach ($w['nodes'] ?? [] as $n) {
        $t = (string)($n['type'] ?? ''); $p = $n['parameters'] ?? [];
        if ($t === 'n8n-nodes-base.webhook') {
            $chemin = trim((string)($p['path'] ?? ''), '/'); $meth = strtoupper((string)($p['httpMethod'] ?? 'GET'));
            $exp[] = ['quoi' => "webhook $meth /webhook/$chemin", 'suspect' => !in_array($chemin, $connus, true) || $meth === 'GET'];
        } elseif ($t === 'n8n-nodes-base.formTrigger' || $t === 'n8n-nodes-base.form') {
            $exp[] = ['quoi' => 'formulaire n8n PUBLIC (page HTML)', 'suspect' => true];
        } elseif ($t === 'n8n-nodes-base.respondToWebhook') {
            $corps = json_encode($p);
            $html = stripos($corps, 'text/html') !== false || stripos($corps, '<html') !== false || stripos($corps, '<form') !== false;
            if ($html || ($p['respondWith'] ?? '') === 'text') $exp[] = ['quoi' => 'reponse ' . ($html ? 'HTML' : 'texte') . ' a un webhook', 'suspect' => $html];
        }
    }
    if (!$exp) continue;
    $suspect = (bool)array_filter($exp, fn($e) => $e['suspect']);
    if ($suspect) $alertes++;
    printf("%s %s\n", $suspect ? '[A VERIFIER]' : '[ok]        ', (string)($w['name'] ?? '(sans nom)'));
    foreach ($exp as $e) printf("               - %s%s\n", $e['quoi'], $e['suspect'] ? '  <==' : '');
}
echo "\n$actifs workflow(s) actif(s).\n";
echo $alertes
    ? "[!] $alertes workflow(s) a verifier : ouvrez-les dans n8n. Un workflow que vous n'avez pas cree => desactivez-le, changez vos mots de passe n8n, mettez n8n a jour.\n"
    : "[OK] Aucun webhook inconnu, aucun formulaire public, aucune page HTML servie : le signalement est tres probablement un faux positif. Demandez le reexamen (voir SAFE_BROWSING.md).\n";
PHP
  rm -f "${ici}"
}

# -----------------------------------------------------------------------------
# Main'''

sub('fonction de contrôle', '''# -----------------------------------------------------------------------------
# Main''', VERIF)
sub('sous-commande securite', '''  if [[ "${1:-}" == "php" ]]; then
    install_php_extensions
    return 0
  fi''', '''  if [[ "${1:-}" == "php" ]]; then
    install_php_extensions
    return 0
  fi
  if [[ "${1:-}" == "securite" ]]; then
    verifier_securite
    return 0
  fi''')
sub('usage', '''#           sudo bash install.sh php    (extensions PHP seulement)''',
    '''#           sudo bash install.sh php    (extensions PHP seulement)
#           sudo bash install.sh securite  (controle anti-hameconnage, lecture seule)''')

io.open(F, 'w', encoding='utf-8').write(src)
print('✔ install.sh : contrôle anti-hameçonnage (sudo bash install.sh securite)')
