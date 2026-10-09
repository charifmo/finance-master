<?php
declare(strict_types=1);
/**
 * v37.40 — LES MÉDIAS DE LA REVUE DE PRESSE, RÉGLABLES DEPUIS L'ÉCRAN.
 *
 *   « Donne accès depuis la page web pour ajouter des sources, puis modifier
 *   ou supprimer. »
 *
 *   La partie rejouable sans réseau ni base : ce qu'on accepte d'une saisie
 *   (un vrai site, un flux sur ce site), comment vos réglages se superposent à
 *   la liste d'origine (ajoutée, modifiée, retirée, nouvelle), et qu'un média
 *   en pause n'est plus interrogé.
 */
require_once __DIR__ . '/../cfo_veille_lib.php';

$ko = 0; $n = 0;
function v(string $titre, bool $ok, string $detail = ''): void {
    global $ko, $n; $n++; if (!$ok) $ko++;
    printf("  %s %-72s %s\n", $ok ? '✅' : '❌', $titre, $ok ? '' : $detail);
}
$j = fn($x) => json_encode($x, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
echo "\n  MÉDIAS RÉGLABLES — saisie, contrôles, superposition\n  " . str_repeat('─', 86) . "\n";
$cfg = json_decode(file_get_contents(__DIR__ . '/../veille_sources.json'), true);

/* ── 1. Le domaine, d'après ce qu'on colle ─────────────────────────────── */
foreach ([['https://www.Almarrakchia.net/2026/09/article?x=1#haut', 'almarrakchia.net'], ['ledesk.ma', 'ledesk.ma'],
          ['  WWW.Le360.ma  ', 'le360.ma'], ['fr.hespress.com/economie', 'fr.hespress.com'], ['https://exemple.ma:8443/x', 'exemple.ma'],
          ['xn--mgbh0fb.xn--mgbc0a9azcg', 'xn--mgbh0fb.xn--mgbc0a9azcg']] as [$saisi, $attendu])
    v("« $saisi » → $attendu", cfo_vp_domaine($saisi) === $attendu, (string)cfo_vp_domaine($saisi));
foreach (['localhost', '127.0.0.1', '192.168.1.10', 'http://169.254.169.254/latest', 'http://user:pass@evil.com', 'exemple', 'a..b.ma', '', 'ma isi.ma'] as $refus)
    v("« $refus » refusé (ni IP, ni localhost, ni identifiants)", cfo_vp_domaine($refus) === null, (string)cfo_vp_domaine($refus));

/* ── 2. Une source saisie ──────────────────────────────────────────────── */
$ok = cfo_vp_valider_source(['nom' => '  Marrakech <b>Today</b> ', 'domaine' => 'https://www.marrakechtoday.ma/foncier', 'portee' => 'locale', 'langue' => 'fr',
                             'origine' => 'ajoutee', 'url' => 'http://ailleurs', 'actif' => true]);
v('saisie propre : balises retirées, domaine extrait, champs inconnus écartés',
  ($ok['source'] ?? null) === ['nom' => 'Marrakech Today', 'domaine' => 'marrakechtoday.ma', 'portee' => 'locale', 'langue' => 'fr'], $j($ok));
$err = fn($s) => cfo_vp_valider_source($s + ['nom' => 'Média', 'domaine' => 'exemple.ma', 'portee' => 'locale', 'langue' => 'ar'])['erreur'] ?? '';
v('nom trop court : refusé', str_contains(cfo_vp_valider_source(['nom' => 'X', 'domaine' => 'exemple.ma', 'portee' => 'locale', 'langue' => 'ar'])['erreur'] ?? '', 'Nom'));
v('portée inconnue : refusée', str_contains($err(['portee' => 'mondiale']), 'Portée'));
v('langue inconnue : refusée', str_contains($err(['langue' => 'es']), 'Langue'));
v('flux sur un AUTRE site : refusé, et dit', str_contains($err(['flux' => 'https://evil.example/?q={q}']), "doit être sur le site du média (exemple.ma), pas sur « evil.example »"), $err(['flux' => 'https://evil.example/?q={q}']));
v('flux sur une IP interne : refusé', $err(['flux' => 'http://169.254.169.254/?q={q}']) !== '');
v('flux sans {q} : refusé', str_contains($err(['flux' => 'https://exemple.ma/feed']), '{q}'));
v('flux avec deux {q} : refusé', str_contains($err(['flux' => 'https://exemple.ma/?a={q}&b={q}']), '{q}'));
v('flux javascript: / ftp: : refusés', $err(['flux' => 'javascript:alert(1)//{q}']) !== '' && $err(['flux' => 'ftp://exemple.ma/{q}']) !== '');
v('flux avec identifiants ou port : refusé', $err(['flux' => 'https://u:p@exemple.ma/?s={q}']) !== '' && $err(['flux' => 'https://exemple.ma:8080/?s={q}']) !== '');
v('flux sur un sous-domaine du média : accepté', $err(['flux' => 'https://recherche.exemple.ma/?s={q}&feed=rss2']) === '');
v('flux WordPress du média (www.) : accepté', $err(['flux' => 'https://www.exemple.ma/?s={q}&feed=rss2']) === '');
$p = cfo_vp_valider_source(['nom' => 'Média', 'domaine' => 'exemple.ma', 'portee' => 'locale', 'langue' => 'ar', 'actif' => false]);
v('« en pause » conservé', ($p['source']['actif'] ?? null) === false);

/* ── 3. La liste envoyée par l'écran ───────────────────────────────────── */
$l = cfo_vp_valider_liste([['nom' => 'A', 'domaine' => 'a.ma'], ['nom' => 'Média A', 'domaine' => 'a.ma', 'portee' => 'locale', 'langue' => 'fr'],
                           ['nom' => 'Média B', 'domaine' => 'https://www.a.ma/x', 'portee' => 'locale', 'langue' => 'fr']]);
v('erreurs par position, lisibles ; doublon de domaine refusé', count($l['erreurs']) === 2 && str_contains(implode(' ', $l['erreurs']), 'a.ma figure déjà') && count($l['sources']) === 1, $j($l));
v('au plus 60 médias', isset(cfo_vp_valider_liste(array_fill(0, 61, ['nom' => 'M', 'domaine' => 'm.ma']))['erreurs']['liste']));
v('pas une liste : refusé', isset(cfo_vp_valider_liste('x')['erreurs']['liste']));

/* ── 4. Vos réglages sur la liste d'origine ───────────────────────────── */
$def = $cfg['sources'];
$f = cfo_vp_fusion($def, null);
v('sans réglage : la liste d\'origine, telle quelle', count($f['sources']) === count($def) && !array_filter($f['sources'], fn($s) => $s['origine'] !== 'origine') && !$f['supprimees']);
$dom = array_column($def, null, 'domaine');
$perso = ['defauts_connus' => array_keys($dom), 'sources' => []];
foreach ($def as $s) {
    if ($s['domaine'] === 'kech24.com') continue;                                   // retiré par vous
    if ($s['domaine'] === 'ledesk.ma') $s['portee'] = 'locale';                     // modifié
    if ($s['domaine'] === 'hespress.com') $s['actif'] = false;                      // en pause
    $perso['sources'][] = $s;
}
$perso['sources'][] = ['nom' => 'Marrakech Today', 'domaine' => 'marrakechtoday.ma', 'portee' => 'locale', 'langue' => 'fr'];   // ajouté
$perso['sources'][] = ['nom' => 'Piège', 'domaine' => 'localhost', 'portee' => 'locale', 'langue' => 'fr'];                     // abîmé en base
$defPlus = array_merge($def, [['nom' => 'Nouveau Média', 'domaine' => 'nouveaumedia.ma', 'portee' => 'locale', 'langue' => 'ar']]);  // livré après
$f = cfo_vp_fusion($defPlus, $perso);
$o = array_column($f['sources'], 'origine', 'domaine');
v('ajouté par vous : « ajoutee »', ($o['marrakechtoday.ma'] ?? '') === 'ajoutee', $j($o));
v('modifié : « modifiee »', ($o['ledesk.ma'] ?? '') === 'modifiee');
v('mis en pause : « modifiee », actif=false', ($o['hespress.com'] ?? '') === 'modifiee' && (array_column($f['sources'], null, 'domaine')['hespress.com']['actif'] ?? null) === false);
v('inchangé : « origine »', ($o['almarrakchia.net'] ?? '') === 'origine');
v('retiré par vous : il le RESTE, et il est proposé au rétablissement', !isset($o['kech24.com']) && array_column($f['supprimees'], 'domaine') === ['kech24.com'], $j($f['supprimees']));
v('livré par une mise à jour APRÈS vos réglages : « nouvelle »', ($o['nouveaumedia.ma'] ?? '') === 'nouvelle');
v('une ligne abîmée en base est ignorée, pas fatale', !isset($o['localhost']));

/* ── 5. Ce qui est interrogé ──────────────────────────────────────────── */
$cfgF = $cfg; $cfgF['sources'] = $f['sources'];
$R = cfo_vp_requetes($cfgF, ['Ouahat Sidi Brahim', 'واحة سيدي ابراهيم'], ['RN9', 'تصميم التهيئة']);
$tout = implode("\n", array_column($R, 'q')) . "\n" . implode("\n", array_column($R, 'url'));
v('le média ajouté a sa requête stricte de presse locale', (bool)array_filter($R, fn($r) => str_starts_with($r['q'], 'site:marrakechtoday.ma ')));
v('le média modifié en « locale » a désormais la sienne', (bool)array_filter($R, fn($r) => str_starts_with($r['q'], 'site:ledesk.ma ')));
v('le média en pause n\'est plus interrogé', !str_contains($tout, 'hespress'));
v('le média retiré non plus', !str_contains($tout, 'kech24'));
$t = cfo_vp_requetes_test($cfg, ['nom' => 'Al Marrakchia', 'domaine' => 'almarrakchia.net', 'portee' => 'locale', 'langue' => 'ar', 'flux' => 'https://www.almarrakchia.net/?s={q}&feed=rss2']);
v('tester un média arabe : Google Actualités (AR) sur son site, puis son flux', count($t) === 2 && $t[0]['q'] === 'site:almarrakchia.net مراكش' && str_contains($t[0]['url'], 'hl=ar')
  && $t[1]['type'] === 'flux' && $t[1]['url'] === 'https://www.almarrakchia.net/?s=' . rawurlencode('مراكش') . '&feed=rss2', $j($t));
v('tester un média sans flux : Google seul', count(cfo_vp_requetes_test($cfg, ['nom' => 'Le Desk', 'domaine' => 'ledesk.ma', 'portee' => 'nationale', 'langue' => 'fr'])) === 1);

echo "  " . str_repeat('─', 86) . "\n";
echo $ko === 0 ? "  ✅ TOUT PASSE — $n contrôles\n" : "  ❌ $ko contrôle(s) en échec sur $n\n";
exit($ko === 0 ? 0 : 1);
