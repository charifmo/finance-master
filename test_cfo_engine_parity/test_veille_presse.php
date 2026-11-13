<?php
declare(strict_types=1);
/**
 * v37.39 — LA REVUE DE PRESSE LOCALE : REQUÊTES, FLUX, TRI.
 * v37.42 — aucun flux RSS de journal : quatre portes par média local (Google et
 *          Bing restreints au site, sa page de recherche et sa page d'accueil en HTML).
 *
 *   « Je veux qu'il cherche dans les journaux locaux — Al Marrakchia, Marrakech
 *   Alaan, Le Desk… — avant de me répondre, pas une recherche généraliste. »
 *
 *   La partie rejouable sans réseau : les requêtes construites (lieux en
 *   français ET en arabe, presse locale puis nationale, jamais une URL venue du
 *   navigateur), la lecture des flux RSS (Google Actualités, WordPress), et le
 *   tri des articles (pertinence pour CE bien, fraîcheur, doublons).
 */
require_once __DIR__ . '/../cfo_veille_lib.php';

$ko = 0; $n = 0;
function v(string $titre, bool $ok, string $detail = ''): void {
    global $ko, $n; $n++; if (!$ok) $ko++;
    printf("  %s %-72s %s\n", $ok ? '✅' : '❌', $titre, $ok ? '' : $detail);
}
$j = fn($x) => json_encode($x, JSON_UNESCAPED_UNICODE);
echo "\n  REVUE DE PRESSE LOCALE — requêtes, flux, tri\n  " . str_repeat('─', 86) . "\n";

$cfg = json_decode(file_get_contents(__DIR__ . '/../veille_sources.json'), true);
v('veille_sources.json se lit, et nomme la presse demandée', is_array($cfg)
  && count(array_intersect(['almarrakchia.net', 'marrakechalaan.com', 'ledesk.ma'], array_column($cfg['sources'], 'domaine'))) === 3);

/* ── 1. Les termes venus du navigateur ─────────────────────────────────── */
$t = cfo_vp_valider(['lieux' => ['Ouahat Sidi Brahim', 'ouahat  sidi brahim', 'http://169.254.169.254/latest', '"; DROP', str_repeat('x', 80), 42, 'واحة سيدي ابراهيم'],
                     'sujets' => array_merge(['RN9'], array_fill(0, 20, 'SDAU'), array_map(fn($i) => "sujet $i", range(1, 20)))]);
v('doublon (casse, espaces) fusionné', $t['lieux'][0] === 'Ouahat Sidi Brahim' && count(array_filter($t['lieux'], fn($l) => cfo_vp_norm($l) === 'ouahat sidi brahim')) === 1, $j($t['lieux']));
v('ni « : », ni « / », ni guillemets : une URL n\'est qu\'un texte à chercher', !preg_grep('#[:/"]#', $t['lieux']), $j($t['lieux']));
v('trop long ou pas une chaîne : écarté', !in_array(str_repeat('x', 80), $t['lieux'], true) && !in_array(42, $t['lieux'], true));
v('l\'arabe passe tel quel', in_array('واحة سيدي ابراهيم', $t['lieux'], true));
v('plafonds : 6 lieux, 12 sujets', count($t['lieux']) <= CFO_VP_MAX_LIEUX && count($t['sujets']) === CFO_VP_MAX_SUJETS, count($t['lieux']) . '/' . count($t['sujets']));

/* ── 2. Les requêtes ───────────────────────────────────────────────────── */
$lieux = ['Ouahat Sidi Brahim', 'Oulad Belaagid', 'واحة سيدي ابراهيم'];
$sujets = ['RN9', 'SDAU', "plan d'aménagement", 'Grand Stade', 'الطريق الوطنية رقم 9', 'المخطط المديري', 'تصميم التهيئة'];
$R = cfo_vp_requetes($cfg, $lieux, $sujets);
$qs = array_column($R, 'q');
$locales = '(site:almarrakchia.net OR site:marrakechalaan.com OR site:kech24.com OR site:marrakech7.com)';
// v37.41 : une requête STRICTE par média local, avec les lieux des deux langues
//  v37.139 : le lieu arabe dans ses DEUX orthographes (« ابراهيم » / « إبراهيم »)
$strict = fn($dom) => 'site:' . $dom . ' ("واحة سيدي ابراهيم" OR "واحة سيدي إبراهيم" OR "Ouahat Sidi Brahim" OR "Oulad Belaagid")';
foreach (['almarrakchia.net', 'marrakechalaan.com', 'kech24.com', 'marrakech7.com'] as $dom)
    v("requête stricte pour $dom : site:$dom (lieux AR OR FR), Google en arabe",
      (bool)array_filter($R, fn($r) => $r['q'] === $strict($dom) && str_contains($r['url'], 'hl=ar') && $r['domaine'] === $dom && $r['specifique']), $j($qs));
v('plus de OR groupé des sites locaux pour un lieu (les petits médias y étaient noyés)', !in_array('"Ouahat Sidi Brahim" ' . $locales, $qs, true) && !in_array('("واحة سيدي ابراهيم" OR "واحة سيدي إبراهيم") ' . $locales, $qs, true));
v('le lieu avec les sujets fonciers (RN9, SDAU, plan d\'aménagement…)', in_array('"Ouahat Sidi Brahim" (RN9 OR SDAU OR "plan d\'aménagement" OR "Grand Stade")', $qs, true));
v('la presse nationale (Le Desk, Médias24, Hespress…)', (bool)array_filter($qs, fn($q) => str_starts_with($q, '"Ouahat Sidi Brahim" (site:ledesk.ma OR site:medias24.com')));
v('le lieu en ARABE, sur Google Actualités en arabe', (bool)array_filter($R, fn($r) => str_starts_with($r['q'], '("واحة سيدي ابراهيم" OR "واحة سيدي إبراهيم")') && str_contains($r['url'], 'hl=ar')));
v('les sujets en arabe vont avec le lieu en arabe', in_array('("واحة سيدي ابراهيم" OR "واحة سيدي إبراهيم") ("الطريق الوطنية رقم 9" OR "المخطط المديري" OR "تصميم التهيئة")', $qs, true));
v('la recherche des sites locaux reçoit le lieu dans LEUR langue (arabe), lue comme une PAGE',
  count(array_filter($R, fn($r) => $r['canal'] === 'recherche' && $r['type'] === 'page' && $r['q'] === 'واحة سيدي ابراهيم')) === 4
  && count(array_filter($R, fn($r) => $r['canal'] === 'recherche' && $r['type'] === 'page' && $r['q'] === 'واحة سيدي إبراهيم')) === 4, $j(array_values(array_filter($R, fn($r) => $r['canal'] === 'recherche'))));
v('la zone : Marrakech + sujets, presse locale', in_array('Marrakech (RN9 OR SDAU OR "plan d\'aménagement" OR "Grand Stade") ' . $locales, $qs, true));
v('au plus ' . CFO_VP_MAX_REQUETES . ' requêtes', count($R) <= CFO_VP_MAX_REQUETES && count($R) >= 10, (string)count($R));
$gabarits = array_merge(array_column($cfg['moteurs'], 'gabarit'), array_map('cfo_vp_sans_flux', array_filter(array_column($cfg['sources'], 'flux'))));
$prefixes = array_map(fn($g) => substr($g, 0, strpos($g, '{q}')), $gabarits);
$accueils = array_map('cfo_vp_accueil', $cfg['sources']);
v('chaque URL vient de veille_sources.json (gabarit, ou accueil d\'un média)', !array_filter($R, fn($r) => $r['canal'] === 'accueil'
  ? !in_array($r['url'], $accueils, true) : !array_filter($prefixes, fn($p) => str_starts_with($r['url'], $p))));
v('les termes sont encodés (guillemets, arabe, espaces)', str_contains($R[0]['url'], '%22Ouahat%20Sidi%20Brahim%22') && !preg_match('/[\s"]/', implode('', array_column($R, 'url'))), $R[0]['url']);
v('les requêtes « lieu » exigent le lieu exact (spécifiques) ; la zone et les pages d\'accueil non',
  !array_filter($R, fn($r) => (str_starts_with($r['libelle'], 'zone') || $r['canal'] === 'accueil') ? $r['specifique'] : !$r['specifique']));

/* ── 2bis. v37.42 : aucun flux RSS de journal — quatre portes par média local ── */
$portes = [];
foreach ($R as $r) if (!empty($r['domaine'])) $portes[$r['domaine']][] = $r['canal'];
foreach (['almarrakchia.net', 'marrakechalaan.com', 'kech24.com', 'marrakech7.com'] as $dom)
    v("$dom : Google (site:), sa page de recherche (dans les deux orthographes du lieu), Bing (site:), sa page d'accueil", ($portes[$dom] ?? []) === ['moteur', 'recherche', 'recherche', 'bing', 'accueil'], $j($portes[$dom] ?? null));
$bing = array_values(array_filter($R, fn($r) => $r['canal'] === 'bing'));
v('Bing Actualités : même requête stricte, sur son gabarit RSS de RÉSULTATS', count($bing) === 4 && $bing[2]['q'] === $strict('kech24.com')
  && str_starts_with($bing[2]['url'], 'https://www.bing.com/news/search?q=site%3Akech24.com%20') && $bing[2]['type'] === 'moteur' && $bing[2]['specifique'], $j($bing[2] ?? null));
$acc = array_values(array_filter($R, fn($r) => $r['canal'] === 'accueil'));
v("page d'accueil : l'hôte de sa recherche (www.kech24.com), lue comme une page, sans terme", ($acc[2]['url'] ?? '') === 'https://www.kech24.com/' && $acc[2]['type'] === 'page' && $acc[2]['q'] === '', $j($acc[2] ?? null));
v("  → un média sans adresse de recherche : https://domaine/", cfo_vp_accueil(['domaine' => 'ledesk.ma', 'nom' => 'Le Desk']) === 'https://ledesk.ma/');
v('aucune page de journal n\'est demandée en RSS', !array_filter($R, fn($r) => $r['type'] === 'page' && preg_match('/feed=|format=rss|\/feed\//i', $r['url'])));
$cfgAncien = $cfg;
$cfgAncien['sources'][0]['flux'] = 'https://www.almarrakchia.net/?s={q}&feed=rss2';            // réglage enregistré avant la v37.41
$ra = array_values(array_filter(cfo_vp_requetes($cfgAncien, $lieux, $sujets), fn($r) => $r['canal'] === 'recherche' && $r['domaine'] === 'almarrakchia.net'));
v('  → un ancien réglage « &feed=rss2 » : retiré, c\'est la PAGE qui est demandée', ($ra[0]['url'] ?? '') === 'https://www.almarrakchia.net/?s=' . rawurlencode('واحة سيدي ابراهيم'), $ra[0]['url'] ?? '');
foreach ([['https://x.ma/?s={q}&feed=rss2', 'https://x.ma/?s={q}'], ['https://x.ma/?feed=rss2&s={q}', 'https://x.ma/?s={q}'], ['https://x.ma/search/{q}/feed/rss2/', 'https://x.ma/search/{q}/'],
          ['https://x.ma/recherche?q={q}&format=rss', 'https://x.ma/recherche?q={q}'], ['https://x.ma/?s={q}', 'https://x.ma/?s={q}']] as [$avant, $apres])
    v("sans flux : $avant → $apres", cfo_vp_sans_flux($avant) === $apres, cfo_vp_sans_flux($avant));
$ordre = array_column($R, 'canal');
v('ordre d\'importance : Google site: d\'abord, puis lieu/presse nationale, pages de recherche, Bing, accueils, zone en dernier',
  array_slice($ordre, 0, 4) === ['moteur', 'moteur', 'moteur', 'moteur'] && $R[4]['libelle'] === 'lieu + urbanisme' && max(array_keys($ordre, 'recherche')) < min(array_keys($ordre, 'bing'))
  && max(array_keys($ordre, 'bing')) < min(array_keys($ordre, 'accueil')) && str_starts_with(end($R)['libelle'], 'zone'), $j(array_column($R, 'libelle')));
$cfg8 = $cfg;
//  v37.111 : plafond porté à 48 (réseaux sociaux, forums, annonces) — 12 médias locaux pour le dépasser
foreach (range(1, 8) as $k) $cfg8['sources'][] = ['nom' => "Local $k", 'domaine' => "local$k.ma", 'portee' => 'locale', 'langue' => 'ar', 'flux' => "https://local$k.ma/?s={q}"];
$R8 = cfo_vp_requetes($cfg8, $lieux, $sujets);
v('12 médias locaux : plafonné à ' . CFO_VP_MAX_REQUETES . ', la presse nationale, les réseaux sociaux et toutes les requêtes Google site: restent',
  count($R8) === CFO_VP_MAX_REQUETES && (bool)array_filter($R8, fn($r) => $r['libelle'] === 'presse nationale') && (bool)array_filter($R8, fn($r) => ($r['groupe'] ?? '') === 'reseau')
  && count(array_filter($R8, fn($r) => $r['canal'] === 'moteur' && str_starts_with($r['libelle'], 'site:'))) === 12, (string)count($R8));

/* ── 3. Les flux ───────────────────────────────────────────────────────── */
$gnews = <<<XML
<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Google</title>
<item><title>Ouahat Sidi Brahim : le plan d'aménagement ouvre la bande RN9 à la logistique - Al Marrakchia</title>
<link>https://news.google.com/rss/articles/CBMiAAA?oc=5</link><pubDate>Mon, 14 Sep 2026 08:00:00 GMT</pubDate>
<description>&lt;a href="https://news.google.com/rss/articles/CBMiAAA"&gt;Ouahat Sidi Brahim : le plan d'aménagement ouvre la bande RN9 à la logistique&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font color="#6f6f6f"&gt;Al Marrakchia&lt;/font&gt;</description>
<source url="https://www.almarrakchia.net">Al Marrakchia</source></item>
<item><title>Piège - Inconnu</title><link>javascript:alert(1)</link><pubDate>Mon, 14 Sep 2026 08:00:00 GMT</pubDate></item>
</channel></rss>
XML;
$a = cfo_vp_lire_rss($gnews, ['type' => 'moteur', 'nom' => 'Google Actualités (FR)', 'specifique' => true, 'langue' => 'fr'], $cfg);
v('Google Actualités : article lu, média reconnu (Al Marrakchia, presse locale)', $a && $a[0]['source'] === 'Al Marrakchia' && $a[0]['portee'] === 'locale' && $a[0]['domaine'] === 'almarrakchia.net', $j($a));
v('  → le suffixe « - Al Marrakchia » du titre est retiré', $a && $a[0]['titre'] === "Ouahat Sidi Brahim : le plan d'aménagement ouvre la bande RN9 à la logistique", $a[0]['titre'] ?? '');
v('  → l\'extrait qui ne fait que répéter le titre est vidé', $a && $a[0]['extrait'] === '', $a[0]['extrait'] ?? '');
v('  → date lue', $a && $a[0]['date'] === '2026-09-14');
v('  → un lien javascript: est écarté', $a && count($a) === 1);
$wp = '<?xml version="1.0"?><rss version="2.0"><channel><item><title>واحة سيدي إبراهيم: تصميم التهيئة الجديد</title><link>https://marrakechalaan.com/2026/08/123</link>'
    . '<pubDate>Tue, 18 Aug 2026 10:00:00 +0100</pubDate><description><![CDATA[<p>صادق المجلس على تصميم التهيئة&#8230;</p>]]></description></item></channel></rss>';
// v37.42 : Bing Actualités enrobe le lien de l'article ; le média se lit dans le lien rendu
$bingRss = '<?xml version="1.0" encoding="utf-8"?><rss version="2.0" xmlns:News="https://www.bing.com:443/news/search?q=x&amp;format=rss"><channel><title>Bing</title>'
    . '<item><title>واحة سيدي إبراهيم: تصميم التهيئة الجديد</title><link>http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;aid=&amp;tid=AB12&amp;url=https%3a%2f%2fwww.kech24.com%2f2026%2f08%2f18%2foasis-plan%2f&amp;c=1234&amp;mkt=fr-ma</link>'
    . '<description><![CDATA[<p>صادق المجلس على تصميم التهيئة&#8230;</p>]]></description><pubDate>Tue, 18 Aug 2026 10:00:00 GMT</pubDate><News:Source>Kech24</News:Source></item></channel></rss>';
$b = cfo_vp_lire_rss($bingRss, ['type' => 'moteur', 'canal' => 'bing', 'nom' => 'Bing Actualités', 'domaine' => 'kech24.com', 'specifique' => true, 'langue' => 'ar'], $cfg);
v('Bing Actualités : le lien de l\'article est extrait de l\'enrobage de Bing', ($b[0]['url'] ?? '') === 'https://www.kech24.com/2026/08/18/oasis-plan/', $j($b));
v('  → média reconnu par ce lien (Kech24, presse locale), chapô nettoyé, date', ($b[0]['source'] ?? '') === 'Kech24' && $b[0]['portee'] === 'locale'
  && $b[0]['extrait'] === 'صادق المجلس على تصميم التهيئة…' && $b[0]['date'] === '2026-08-18', $j($b));
v('un lien Bing sans adresse d\'article reste tel quel', cfo_vp_lien_moteur('https://www.bing.com/news/apiclick.aspx?url=javascript%3aalert(1)') === 'https://www.bing.com/news/apiclick.aspx?url=javascript%3aalert(1)'
  && cfo_vp_lien_moteur('https://news.google.com/rss/articles/A1?url=https://evil.example') === 'https://news.google.com/rss/articles/A1?url=https://evil.example');
v('une page HTML renvoyée par un moteur n\'est pas une liste de résultats : null, dit, pas inventé', cfo_vp_lire_rss('<!DOCTYPE html><html><body>Recherche</body></html>', ['type' => 'moteur', 'specifique' => true], $cfg) === null);
v('un XML cassé non plus', cfo_vp_lire_rss('<?xml version="1.0"?><rss><channel><item><title>x', ['type' => 'moteur', 'specifique' => true], $cfg) === null);
v('sans SimpleXML (php-xml absent) : la lecture de secours rend les mêmes champs', cfo_vp_items_rss_brut($gnews) === cfo_vp_items_rss($gnews) && cfo_vp_items_rss_brut($bingRss) === cfo_vp_items_rss($bingRss)
  && cfo_vp_items_rss_brut($wp) === cfo_vp_items_rss($wp), $j([cfo_vp_items_rss_brut($wp), cfo_vp_items_rss($wp)]));
v('  → et refuse aussi le XML cassé', cfo_vp_items_rss_brut('<?xml version="1.0"?><rss><channel><item><title>x') === null);

/* ── 3bis. v37.41 : la page de résultats, quand le site n'a pas de RSS ── */
$page = <<<'H'
<!DOCTYPE html><html lang="ar" dir="rtl"><head><title>نتائج البحث عن واحة سيدي ابراهيم - كش 24</title></head><body>
<header><nav class="main-menu"><a href="https://www.kech24.com/category/marrakech/">مراكش جهة جهة جهة</a><a href="/">الرئيسية</a></nav></header>
<main id="content"><h1 class="page-title">نتائج البحث عن: واحة سيدي ابراهيم</h1>
<article class="post"><h2 class="entry-title"><a href="https://www.kech24.com/2026/09/12/oasis-plan/">واحة سيدي ابراهيم: الوكالة الحضرية تفتح شريط الطريق الوطنية رقم 9</a></h2>
 <time datetime="2026-09-12T09:30:00+01:00">12 سبتمبر 2026</time><p>صادقت اللجنة على تعديل تصميم التهيئة لفائدة الأنشطة اللوجستيكية على طول الطريق الوطنية رقم 9...</p></article>
<article class="post"><h2 class="entry-title"><a href="/2026/08/03/rocade/">الطريق المداري الكبير لمراكش يمر قرب الدواوير الشمالية</a></h2><time datetime="2026-08-03">3 غشت</time></article>
<article class="post"><h3><a href="javascript:alert(1)">رابط مشبوه رابط مشبوه رابط مشبوه</a></h3></article>
<article class="post"><h2><a href="https://www.kech24.com/tag/oasis/">وسم واحة سيدي ابراهيم وسم وسم</a></h2></article>
</main>
<aside class="sidebar"><div class="widget popular"><h3><a href="https://www.kech24.com/2026/10/01/football/">الكوكب المراكشي يفوز في مباراة مثيرة</a></h3></div></aside>
<div class="ad"><h3><a href="https://pub.example.com/promo">عرض خاص على الشقق الفاخرة في مراكش</a></h3></div>
<footer><a href="https://www.kech24.com/page/2/">الصفحة التالية الصفحة التالية</a></footer></body></html>
H;
$reqK = ['type' => 'page', 'canal' => 'recherche', 'nom' => 'Kech24', 'q' => 'واحة سيدي ابراهيم', 'langue' => 'ar', 'url' => 'https://www.kech24.com/?s=x', 'domaine' => 'kech24.com', 'specifique' => true];
$lu = cfo_vp_lire_reponse($page, $reqK, $cfg);
$tk = array_column($lu['articles'] ?? [], 'titre');
v('pas de RSS : la page de résultats est lue (mode « page »)', $lu['mode'] === 'page' && count($tk) === 2, $j($lu));
v('  → titre, lien absolu (lien relatif résolu), date <time>, chapô', ($lu['articles'][0]['date'] ?? '') === '2026-09-12' && str_starts_with($lu['articles'][0]['extrait'] ?? '', 'صادقت اللجنة')
  && ($lu['articles'][1]['url'] ?? '') === 'https://www.kech24.com/2026/08/03/rocade/' && ($lu['articles'][0]['source'] ?? '') === 'Kech24' && ($lu['articles'][0]['portee'] ?? '') === 'locale', $j($lu['articles'] ?? []));
v('  → écartés : menu, barre latérale « les plus lus », publicité externe, étiquette, pagination, javascript:',
  !array_filter($tk, fn($t) => str_contains($t, 'الكوكب') || str_contains($t, 'عرض خاص') || str_contains($t, 'وسم') || str_contains($t, 'مشبوه') || str_contains($t, 'الصفحة')), $j($tk));
v('  → page de résultats (le terme y figure) : ses articles sont « spécifiques »', !array_filter($lu['articles'], fn($a) => !$a['specifique']));
// Un thème SANS <article> pour ses résultats, une publicité parmi eux, et un widget « article » dans la barre latérale
$sansArticle = '<!DOCTYPE html><html><head><title>بحث: واحة سيدي ابراهيم</title></head><body>'
    . '<div class="menu"><h3><a href="https://www.kech24.com/2026/01/01/menu-item/">رابط من القائمة الرئيسية للموقع</a></h3></div>'
    . '<div id="results"><div class="item"><h3><a href="https://www.kech24.com/2026/09/20/r1/">واحة سيدي ابراهيم: مشروع تجزئة سكنية جديدة قرب الطريق</a></h3></div>'
    . '<div class="item"><h3><a href="https://pub.example.com/promo">إعلان: شقق فاخرة بأثمنة مغرية في مراكش</a></h3></div></div>'
    . '<div class="sidebar"><article class="mini"><h4><a href="https://www.kech24.com/2026/10/01/foot/">الكوكب المراكشي يفوز في مباراة مثيرة جدا</a></h4></article></div>'
    . '</body></html>';
$ls = cfo_vp_lire_reponse($sansArticle, $reqK, $cfg);
v('thème sans <article> : les titres des résultats sont lus, le menu écarté', $ls['mode'] === 'page' && array_column($ls['articles'], 'url') === ['https://www.kech24.com/2026/09/20/r1/'], $j($ls['articles'] ?? null));
v('  → le widget « article » de la barre latérale ne passe pas pour un résultat', !in_array('https://www.kech24.com/2026/10/01/foot/', array_column($ls['articles'] ?? [], 'url'), true));
v('  → la publicité (autre site) parmi les résultats est écartée', !in_array('https://pub.example.com/promo', array_column($ls['articles'] ?? [], 'url'), true));
$accueil = '<!DOCTYPE html><html><body><article><h2><a href="/2026/10/01/a/">Marrakech : nouvelle saison touristique record</a></h2></article>'
         . '<article><h2><a href="/2026/10/02/b/">واحة سيدي ابراهيم: انطلاق أشغال الطريق المداري</a></h2></article></body></html>';
$la = cfo_vp_lire_reponse($accueil, $reqK, $cfg);
v('page qui ne contient pas le terme (accueil par redirection) : rien n\'est « spécifique »', $la['mode'] === 'page' && count($la['articles']) === 2 && !array_filter($la['articles'], fn($a) => $a['specifique']));
$sel = cfo_vp_selection($la['articles'], ['واحة سيدي ابراهيم'], [], $cfg, strtotime('2026-10-09'));
v('  → au tri, seul le titre qui nomme le lieu reste', array_column($sel, 'titre') === ['واحة سيدي ابراهيم: انطلاق أشغال الطريق المداري'], $j(array_column($sel, 'titre')));
v('page lue sans aucun article : vide, mode « page » (dit, pas un échec muet)', ($v = cfo_vp_lire_reponse('<!DOCTYPE html><html><body><p>لا توجد نتائج</p></body></html>', $reqK, $cfg)) && $v['mode'] === 'page' && $v['articles'] === []);
v('réponse ni RSS ni HTML (JSON) : illisible', cfo_vp_lire_reponse('{"error":"blocked"}', $reqK, $cfg)['articles'] === null);
v('une page HTML renvoyée par GOOGLE (consentement…) n\'est jamais lue comme des articles',
  cfo_vp_lire_reponse($page, ['type' => 'moteur', 'nom' => 'Google', 'q' => 'x', 'specifique' => true], $cfg)['articles'] === null);
$lf = cfo_vp_lire_reponse($wp, ['type' => 'page', 'canal' => 'recherche', 'nom' => 'Marrakech Alaan', 'domaine' => 'marrakechalaan.com', 'q' => 'x', 'specifique' => true, 'langue' => 'ar', 'url' => 'https://marrakechalaan.com/?s=x'], $cfg);
v('v37.42 : une page de journal qui renvoie un flux RSS n\'est JAMAIS lue comme RSS — illisible, et dit', $lf['articles'] === null && ($lf['raison'] ?? '') === 'flux', $j($lf));

/* ── 4. Le tri ─────────────────────────────────────────────────────────── */
$now = strtotime('2026-10-09 12:00:00 UTC');
$art = fn($titre, $jours, $portee = 'nationale', $spec = false, $url = null) => ['titre' => $titre, 'extrait' => '', 'url' => $url ?? 'https://x.ma/' . md5($titre),
    'source' => 'S', 'domaine' => 'x.ma', 'portee' => $portee, 'ts' => $jours === null ? null : $now - $jours * 86400, 'date' => null, 'specifique' => $spec, 'langue' => 'fr'];
$liste = [
    $art('Prix des villas à Agadir : la flambée continue', 10),                                         // zone, hors sujet
    $art('Marrakech : le contournement de la RN9 lancé', 30),                                           // zone + sujet
    $art('Ouahat Sidi Brahim : nouveau lotissement autorisé', 400, 'nationale'),                         // lieu, ancien
    $art('Ouahat Sidi Brahim : le plan d\'aménagement adopté', 20, 'locale'),                             // lieu, récent, local
    $art('Ouahat Sidi Brahim : le plan d\'aménagement adopté', 21, 'nationale'),                          // doublon
    $art('واحة سيدي إبراهيم: تصميم التهيئة الجديد', 50, 'locale'),                                       // arabe, hamza
    $art('Ouahat Sidi Brahim en 2022', 1200, 'locale'),                                                   // trop vieux
    $art('Un titre qui ne nomme rien', 5, 'locale', true),                                                // requête spécifique : le lieu est dans le corps
];
$s = cfo_vp_selection($liste, ['Ouahat Sidi Brahim', 'واحة سيدي ابراهيم'], ['RN9', 'contournement', 'تصميم التهيئة'], $cfg, $now);
$titres = array_column($s, 'titre');
v('hors zone et hors sujet (villas à Agadir) : écarté', !in_array('Prix des villas à Agadir : la flambée continue', $titres, true), $j($titres));
v('Marrakech + un sujet foncier : gardé', in_array('Marrakech : le contournement de la RN9 lancé', $titres, true));
v('au-delà de la fenêtre (2 ans) : écarté', !in_array('Ouahat Sidi Brahim en 2022', $titres, true));
v('doublon (même titre, autre média) : une fois', count(array_keys($titres, "Ouahat Sidi Brahim : le plan d'aménagement adopté", true)) === 1);
v('« إبراهيم » avec hamza reconnaît « ابراهيم »', in_array('واحة سيدي إبراهيم: تصميم التهيئة الجديد', $titres, true));
v('une requête qui exigeait le lieu garde son article même si le titre ne le nomme pas', in_array('Un titre qui ne nomme rien', $titres, true));
v('en tête : les articles qui nomment le lieu, locaux et récents (FR et AR)',
  array_slice($titres, 0, 2) == ['واحة سيدي إبراهيم: تصميم التهيئة الجديد', "Ouahat Sidi Brahim : le plan d'aménagement adopté"], $j($titres));
v('le bien nommé, même il y a un an, passe devant la zone seule récente', array_search('Ouahat Sidi Brahim : nouveau lotissement autorisé', $titres, true) < array_search('Marrakech : le contournement de la RN9 lancé', $titres, true), $j($titres));

/* ── v37.139 — « IL N'A PAS TROUVÉ CET ARTICLE » (Marrakech Alaan, 12 nov. 2026 : « …لجماعة واحة سيدي إبراهيم ») ── */
v('v37.139 orthographes : « واحة سيدي ابراهيم » ↔ « واحة سيدي إبراهيم » (dans les deux sens) ; « الويدان » n\'en a pas',
  cfo_vp_orthographes_ar('واحة سيدي ابراهيم') === ['واحة سيدي إبراهيم'] && cfo_vp_orthographes_ar('واحة سيدي إبراهيم') === ['واحة سيدي ابراهيم'] && cfo_vp_orthographes_ar('الويدان') === [],
  $j([cfo_vp_orthographes_ar('واحة سيدي ابراهيم'), cfo_vp_orthographes_ar('الويدان')]));
$R2 = cfo_vp_requetes($cfg, ['Ouahat Sidi Brahim', 'واحة سيدي ابراهيم', 'الويدان'], ['RN9']);
$st2 = array_values(array_filter($R2, fn($r) => ($r['libelle'] ?? '') === 'site:marrakechalaan.com' && ($r['canal'] ?? '') === 'moteur'))[0]['q'] ?? '';
$rc2 = array_values(array_filter($R2, fn($r) => ($r['canal'] ?? '') === 'recherche' && ($r['domaine'] ?? '') === 'marrakechalaan.com'));
v('  → Marrakech Alaan : sa page de recherche dans les DEUX orthographes ; Google (site:) avec les deux ; le 2ᵉ lieu arabe (الويدان) garde sa place',
  count($rc2) === 2 && $rc2[0]['q'] === 'واحة سيدي ابراهيم' && $rc2[1]['q'] === 'واحة سيدي إبراهيم' && str_contains($rc2[1]['url'], rawurlencode('واحة سيدي إبراهيم'))
  && str_contains($st2, '"واحة سيدي إبراهيم"') && str_contains($st2, 'الويدان') && count($R2) <= CFO_VP_MAX_REQUETES, $j([$st2, array_column($rc2, 'q'), count($R2)]));
//  la page d'accueil : le bandeau des dernières nouvelles (« ticker ») est LU — l'article du jour y était
$reqAcc = ['type' => 'page', 'canal' => 'accueil', 'nom' => 'Marrakech Alaan', 'domaine' => 'marrakechalaan.com', 'q' => '', 'langue' => 'ar', 'url' => 'https://www.marrakechalaan.com/'];
$acc = '<html><body><nav class="menu"><a href="https://www.marrakechalaan.com/category/a">اخبار جهة مراكش اليوم وغدا</a></nav>'
     . '<div class="news-ticker"><a href="https://www.marrakechalaan.com/article-700001">المصادقة على مشاريع طرقية مهيكلة بمحيط الملعب الكبير لمراكش خلال دورة استثنائية لجماعة واحة سيدي إبراهيم</a></div>'
     . '<main><h2><a href="https://www.marrakechalaan.com/article-699990">حملة نظافة واسعة بحي المسيرة بمراكش هذا الأسبوع</a></h2></main></body></html>';
$A2 = cfo_vp_lire_html($acc, $reqAcc, $cfg, $reqAcc['url']) ?? [];
$sel2 = cfo_vp_selection($A2, ['واحة سيدي ابراهيم'], ['الملعب الكبير'], $cfg, $now);
v('  → la page d\'accueil : l\'article du bandeau « dernières nouvelles » est lu, et le tri le garde (« إبراهيم » reconnaît « ابراهيم ») ; le menu reste ignoré',
  in_array('https://www.marrakechalaan.com/article-700001', array_column($A2, 'url'), true) && !in_array('https://www.marrakechalaan.com/category/a', array_column($A2, 'url'), true)
  && in_array('https://www.marrakechalaan.com/article-700001', array_column($sel2, 'url'), true), $j([array_column($A2, 'url'), array_column($sel2, 'url')]));

/* ── v37.138 — TROIS CIRCUITS : annonces (prix DEMANDÉS extraits), signaux sociaux (traçables, jamais forcés), contexte plafonné en événements ── */
$A = fn($t, $ex = '', $url = null, $jours = 5) => ['titre' => $t, 'extrait' => $ex, 'url' => $url ?? 'https://www.avito.ma/fr/x/' . md5($t . $ex), 'source' => 'Avito', 'domaine' => 'avito.ma',
    'portee' => 'annonces', 'ts' => $now - $jours * 86400, 'date' => gmdate('Y-m-d', $now - $jours * 86400), 'specifique' => true, 'langue' => 'fr'];
$an = cfo_vp_annonces([
    $A('Terrain 1 ha titré à vendre Ouahat Sidi Brahim façade RN9', '180 DH/m², zone SHL2', 'https://www.avito.ma/fr/a/1'),
    $A('Terrain 1 ha titré à vendre Ouahat Sidi Brahim façade RN9', '180 DH/m², zone SHL2', 'https://www.avito.ma/fr/a/1'),             // même lien
    $A('Parcelle agricole 2,5 hectares Ouahat Sidi Brahim', 'Prix : 3,5 MDH, non titré (melkia), piste', 'https://www.avito.ma/fr/a/2'),
    $A('Lot de terrain 5 000 m² Marrakech route de Casablanca', '1 200 000 DH', 'https://www.mubawab.ma/fr/a/3'),
    $A('Villa 800 m² Marrakech Palmeraie', '9 500 000 DH', 'https://www.avito.ma/fr/a/4'),
    $A('أرض للبيع 3 هكتارات واحة سيدي ابراهيم', '900 درهم للمتر', 'https://www.avito.ma/ar/a/5'),
    $A('Terrain à Agadir 2 ha', '500 DH/m²', 'https://www.avito.ma/fr/agadir/a/6'),                                                  // hors marché
    $A('Terrain 1 ha à vendre Ouahat Sidi Brahim route de Casablanca', '1 ha titré, façade RN9, 210 DH/m².', 'https://www.avito.ma/fr/a/8'),          // « RN9, 180 » ≠ 9,18
    $A('Parcelle agricole 2,5 ha Ouahat Sidi Brahim - autre portail', 'Prix : 3,5 MDH, melkia', 'https://www.sarouty.ma/fr/a/7'),     // même prix + surface : doublon
], ['Ouahat Sidi Brahim', 'واحة سيدي ابراهيم'], $now);
$parU = []; foreach ($an as $x) $parU[basename($x['url'])] = $x;
v('v37.138 annonces : « 180 DH/m² » sur 1 ha (prix au m² ÉCRIT, total inconnu) ; « 3,5 MDH » sur 2,5 ha → 140 DH/m² CALCULÉ (marqué) ; zonage, titre, accès lus',
  ($parU['1']['prix_m2'] ?? 0) === 180 && $parU['1']['prix_demande'] === null && $parU['1']['surface_m2'] === 10000 && $parU['1']['prix_m2_calcule'] === false
  && $parU['1']['zonage'] === 'SHL2' && $parU['1']['titre_foncier'] === 'titré' && in_array('RN9', $parU['1']['acces'] ?? [], true) && in_array('façade', $parU['1']['acces'] ?? [], true)
  && ($parU['2']['prix_demande'] ?? 0) === 3500000 && $parU['2']['surface_m2'] === 25000 && $parU['2']['prix_m2'] === 140 && $parU['2']['prix_m2_calcule'] === true
  && $parU['2']['titre_foncier'] === 'non titré / melkia' && $parU['2']['zonage'] === 'agricole' && in_array('piste', $parU['2']['acces'] ?? [], true), $j([$parU['1'] ?? null, $parU['2'] ?? null]));
v('  → « 5 000 m² · 1 200 000 DH » → 240 DH/m² calculé, lieu INCONNU (Marrakech seulement) ; la villa est typée « villa » ; l\'annonce arabe (3 هكتارات, 900 درهم للمتر) lue',
  ($parU['3']['surface_m2'] ?? 0) === 5000 && $parU['3']['prix_demande'] === 1200000 && $parU['3']['prix_m2'] === 240 && $parU['3']['lieu'] === null && $parU['3']['marrakech'] === true
  && ($parU['4']['type'] ?? '') === 'villa' && ($parU['5']['surface_m2'] ?? 0) === 30000 && $parU['5']['prix_m2'] === 900 && $parU['5']['lieu'] === 'واحة سيدي ابراهيم' && $parU['5']['type'] === 'terrain',
  $j([$parU['3'] ?? null, $parU['4']['type'] ?? null, $parU['5'] ?? null]));
v('  → « façade RN9, 210 DH/m² » : 210 DH/m² (le 9 de RN9 n\'est pas collé au prix) ; RN9 lue comme accès', ($parU['8']['prix_m2'] ?? 0) === 210 && in_array('RN9', $parU['8']['acces'] ?? [], true) && ($parU['8']['portee'] ?? '') === 'annonces', $j($parU['8'] ?? null));
v('  → doublons fusionnés (même lien ; même prix + même surface sur un autre portail) ; Agadir écartée ; celles qui nomment le lieu d\'abord ; ce qui manque reste null',
  count($an) === 6 && !isset($parU['6']) && !isset($parU['7']) && $an[0]['lieu'] !== null && $an[count($an) - 1]['lieu'] === null && $parU['4']['zonage'] === null && $parU['4']['titre_foncier'] === null,
  $j(array_map(fn($x) => [basename($x['url']), $x['lieu']], $an)));
$S = fn($t, $ex, $pt, $url, $jours = null) => ['titre' => $t, 'extrait' => $ex, 'url' => $url, 'source' => 'x', 'domaine' => parse_url($url, PHP_URL_HOST), 'portee' => $pt,
    'ts' => $jours === null ? null : $now - $jours * 86400, 'date' => $jours === null ? null : gmdate('Y-m-d', $now - $jours * 86400), 'specifique' => true, 'langue' => 'fr'];
$sg = cfo_vp_signaux([
    $S('Réunion des ayants droit à Ouahat Sidi Brahim', 'bande RN9', 'reseau', 'https://www.facebook.com/groups/o/posts/1', 3),
    $S('Réunion des ayants droit à Ouahat Sidi Brahim', 'bande RN9', 'reseau', 'https://www.facebook.com/groups/o/posts/1', 3),
    $S('Les plus belles photos de Marrakech', 'coucher de soleil', 'reseau', 'https://www.instagram.com/p/2', 1),                       // ne nomme pas le lieu
    $S('Ouahat Sidi Brahim : qui connaît le prix du terrain ?', 'discussion', 'forum', 'https://www.yabiladi.com/forum/3', null),
    $S('Ouahat Sidi Brahim en 2019', 'vieux', 'reseau', 'https://www.facebook.com/p/4', 1500),                                         // trop vieux
], ['Ouahat Sidi Brahim'], $now);
v('  → signaux : gardés seulement s\'ils nomment le lieu, traçables (adresse), dédupliqués, pas trop vieux ; niveau de lecture dit (titre et extrait, véracité non vérifiée)',
  count($sg) === 2 && $sg[0]['url'] === 'https://www.facebook.com/groups/o/posts/1' && $sg[1]['plateforme'] === 'www.yabiladi.com' && $sg[1]['date'] === null
  && str_contains($sg[0]['niveau'], 'publication complète non lue'), $j($sg));
v('  → aucun signal pertinent : liste VIDE (leur présence n\'est jamais forcée)', cfo_vp_signaux([$S('Marrakech by night', '', 'reseau', 'https://www.instagram.com/p/9', 1)], ['Ouahat Sidi Brahim'], $now) === []);
//  le contexte : 6 ÉVÉNEMENTS distincts de contexte → 4 + l'exception majeure (marché attribué) ; les échos écartés
$ctx = [
    $art('Marrakech : le chantier de la LGV démarre près de la Palmeraie', 3),
    $art('Mondial 2030 : le Grand Stade de Marrakech métamorphosé', 4), $art('Le Grand Stade de Marrakech métamorphosé pour le Mondial 2030', 5),   // écho
    $art('Marrakech : la rocade nord avance, RN9', 6), $art('Marrakech : le plan de mobilité urbaine durable lancé', 7),
    $art('Marrakech : nouvel aéroport, extension du terminal pour le Mondial 2030', 8),
    $art('Mondial 2030 : un groupe marocain décroche le marché des gares Benguerir-Marrakech', 40),
    $art('Marrakech : la fête des roses du Mondial 2030', 9),
];
$sC = cfo_vp_selection($ctx, ['Ouahat Sidi Brahim'], ['Mondial 2030', 'RN9', 'LGV', 'stades', 'plan de mobilité'], ['max_articles' => 20, 'quota_zone' => 20] + $cfg, $now);
$tC = array_column($sC, 'titre');
v('  → contexte général : 4 ÉVÉNEMENTS distincts au plus (pas 4 articles du même fait) + l\'exception « décroche le marché » (évolution majeure documentée) ; l\'écho du Grand Stade écarté',
  count($sC) === 5 && in_array('Mondial 2030 : un groupe marocain décroche le marché des gares Benguerir-Marrakech', $tC, true)
  && count(array_filter($tC, fn($t) => str_contains($t, 'Grand Stade'))) === 1 && !empty(array_values(array_filter($sC, fn($a) => !empty($a['majeur'])))), $j($tC));
//  nouveau depuis la précédente analyse
$dep = $now - 3600;
$nv = fn($a, $p, $d = null, $c = []) => cfo_vp_statut_nouveaute($a, $p, $d, $c);
v('  → statuts : première analyse ; vu avant la précédente → « déjà connu » ; nouveau lien d\'une histoire connue → « mise à jour » ; sinon « nouvel événement »',
  $nv(['titre' => 'x'], null) === 'premiere_analyse' && $nv(['titre' => 'x'], $dep - 60, $dep) === 'deja_connu'
  && $nv(['titre' => 'Le Grand Stade de Marrakech métamorphosé pour le Mondial 2030'], $dep + 60, $dep, ['Mondial 2030 : le Grand Stade de Marrakech métamorphosé']) === 'mise_a_jour'
  && $nv(['titre' => 'Ouahat Sidi Brahim : le plan d\'aménagement homologué'], $dep + 60, $dep, ['Mondial 2030 : le Grand Stade de Marrakech métamorphosé']) === 'nouvel_evenement'
  && $nv(['titre' => 'y', 'memoire' => gmdate('Y-m-d', $dep - 2 * 86400)], null, $dep) === 'deja_connu');
v('  → v37.140 : un article de février 2025 découvert seulement maintenant = « ancien, découvert récemment », pas « nouvel événement » ; daté d\'hier = nouveau',
  $nv(['titre' => 'Visite de chantier au Grand Stade', 'date' => gmdate('Y-m-d', $dep - 280 * 86400)], $dep + 60, $dep) === 'ancien_decouvert'
  && $nv(['titre' => 'Visite de chantier au Grand Stade', 'date' => gmdate('Y-m-d', $dep - 86400)], $dep + 60, $dep) === 'nouvel_evenement');

/* ── v37.136 — « LE RÉSULTAT EST NUL » : dates écrites, cartes de Marrakech Alaan, une même histoire, Le360 ── */
$D = fn($t) => ($x = cfo_vp_date_texte($t, $now)) ? gmdate('Y-m-d', $x[0]) : null;
v('v37.136 dates écrites : « 4 ديسمبر 2024 », « 14 نونبر 2023 » (mois marocain), « 1er mars 2026 », « 2026-11-04 », « 04/12/2024 » ; « 31/02/2024 » et « 2099 » refusés',
  $D('4 ديسمبر 2024بالفيديو.. شميس') === '2024-12-04' && $D('14 نونبر 2023 الشقيق') === '2023-11-14' && $D('Publié le 1er mars 2026') === '2026-03-01'
  && $D('maj 2026-11-04') === '2026-11-04' && $D('le 04/12/2024') === '2024-12-04' && $D('31/02/2024') === null && $D('4 ديسمبر 2099') === null,
  $j([$D('4 ديسمبر 2024بالفيديو.. شميس'), $D('14 نونبر 2023 الشقيق'), $D('Publié le 1er mars 2026'), $D('maj 2026-11-04'), $D('le 04/12/2024'), $D('31/02/2024'), $D('4 ديسمبر 2099')]));
$reqMA = ['type' => 'page', 'canal' => 'recherche', 'nom' => 'Marrakech Alaan', 'domaine' => 'marrakechalaan.com', 'q' => 'واحة سيدي ابراهيم', 'langue' => 'ar', 'url' => 'https://www.marrakechalaan.com/?s=x'];
$cartes = '<html><body><div class="resultats">'
  . '<a href="https://www.marrakechalaan.com/article-577251"><span class="date">4 ديسمبر 2024</span><h3>بالفيديو.. شميس يثمن زيارة كاتب الدولة لورش قرية الحرفيين بواحة سيدي ابراهيم</h3><p>تفقد كاتب الدولة المكلف بالصناعة التقليدية صباح اليوم ورش بناء قرية الحرفيين بواحة سيدي ابراهيم.</p></a>'
  . '<a href="https://www.marrakechalaan.com/article-557506"><div>2 يوليو 2024</div><div>الشقيق رئيس واحة سيدي ابراهيم يعطي انطلاقة اشغال انجاز ملاعب القرب ببلعكيد</div><div>اعلن محمد الشقيق رئيس جماعة واحة سيدي ابراهيم عن انطلاقة أشغال انجاز ملاعب القرب بمنطقة بلعكيد بحضور اللجنة التقنية.</div></a>'
  . '<a href="https://www.marrakechalaan.com/article-600001">5 نوفمبر 2026قنطرة جديدة بواحة سيدي ابراهيم لمواكبة القطار فائق السرعة</a>'
  . '</div></body></html>';
$C = cfo_vp_lire_html($cartes, $reqMA, $cfg, $reqMA['url']) ?? [];
$par = []; foreach ($C as $c) $par[basename($c['url'])] = $c;
v('  → une carte « date + intertitre + résumé » : le titre est l\'intertitre, la date (4 déc. 2024) est lue, le résumé est le paragraphe',
  isset($par['article-577251']) && str_starts_with($par['article-577251']['titre'], 'بالفيديو.. شميس') && $par['article-577251']['date'] === '2024-12-04'
  && str_starts_with($par['article-577251']['extrait'], 'تفقد كاتب الدولة'), $j($C));
v('  → une carte en blocs sans intertitre : le titre est le bloc qui n\'est pas la date (2 juil. 2024), pas date+titre+résumé collés',
  isset($par['article-557506']) && str_starts_with($par['article-557506']['titre'], 'الشقيق رئيس') && !str_contains($par['article-557506']['titre'], 'اعلن') && $par['article-557506']['date'] === '2024-07-02', $j($par['article-557506'] ?? null));
v('  → un lien « 5 نوفمبر 2026قنطرة… » : la date est retirée du titre, et lue (5 nov. 2026)',
  isset($par['article-600001']) && str_starts_with($par['article-600001']['titre'], 'قنطرة جديدة') && $par['article-600001']['date'] === '2026-11-05', $j($par['article-600001'] ?? null));
//  dix échos locaux du même sujet (Grand Stade · Mondial 2030) et l'article du Le360 (presse nationale) : il garde sa place
//  (titres variés, comme les vrais : « un stade métamorphosé », « se refait une beauté », « prêt pour »… — même histoire)
$echos = []; foreach (['Grand Stade de Marrakech : un stade métamorphosé pour le Mondial 2030', 'Marrakech : le Grand Stade se refait une beauté pour le Mondial 2030',
                       'Mondial 2030 : le Grand Stade de Marrakech se refait une beauté', 'Le Grand Stade de Marrakech métamorphosé pour le Mondial 2030',
                       'Marrakech : le Grand Stade prêt pour le Mondial 2030', 'Mondial 2030 : Marrakech et son Grand Stade se préparent'] as $k => $t)
    $echos[] = $art($t, $k + 1, 'locale', false, "https://kech24.com/gs-$k");
$le360 = $art('Mondial 2030 : 7,5 milliards de dirhams pour les accès aux stades de Benslimane et de Marrakech', 40, 'nationale', false, 'https://fr.le360.ma/sports/mondial-2030-75-milliards');
$mob = $art('Marrakech : le plan de mobilité urbaine durable du Grand Marrakech lancé', 12, 'nationale', false, 'https://ledesk.ma/plan-mobilite');
$sZ = cfo_vp_selection(array_merge($echos, [$le360, $mob, $art('Ouahat Sidi Brahim : le plan d\'aménagement adopté', 20, 'locale')]), ['Ouahat Sidi Brahim'], ['Mondial 2030', 'stades'], ['max_articles' => 5, 'quota_zone' => 4] + $cfg, $now);
$tZ = array_column($sZ, 'url');
v('  → six échos « Grand Stade » (titres variés) ne prennent plus toutes les places : l\'article du Le360 (7,5 MMDH, accès aux stades) et le plan de mobilité du Desk sont retenus',
  in_array('https://fr.le360.ma/sports/mondial-2030-75-milliards', $tZ, true) && in_array('https://ledesk.ma/plan-mobilite', $tZ, true)
  && count(array_filter($tZ, fn($u) => str_contains($u, 'kech24.com/gs-'))) <= 2, $j(array_column($sZ, 'titre')));
v('plafond max_articles respecté', count(cfo_vp_selection(array_map(fn($i) => $art("Ouahat Sidi Brahim $i", $i), range(1, 40)), ['Ouahat Sidi Brahim'], [], $cfg, $now)) === (int)$cfg['max_articles']);

/* ── 5. v37.111 : réseaux sociaux, forums, annonces — les moteurs du web ── */
$ouL = '("واحة سيدي ابراهيم" OR "واحة سيدي إبراهيم" OR "Ouahat Sidi Brahim" OR "Oulad Belaagid")';
$web = array_values(array_filter($R, fn($r) => !empty($r['groupe'])));
$parGroupe = []; foreach ($web as $r) $parGroupe[$r['groupe']][] = $r['canal'];
v('réseaux sociaux, forums, annonces : chacun cherché par Bing (web) ET DuckDuckGo',
  ($parGroupe['reseau'] ?? []) === ['bing_web', 'ddg'] && ($parGroupe['forum'] ?? []) === ['bing_web', 'ddg'] && ($parGroupe['annonces'] ?? []) === ['bing_web', 'ddg'], $j($parGroupe));
$rs = array_values(array_filter($web, fn($r) => $r['groupe'] === 'reseau'));
v('  → réseaux sociaux : (site:facebook.com OR site:instagram.com OR site:youtube.com) + les lieux des deux langues, exigés',
  ($rs[0]['q'] ?? '') === '(site:facebook.com OR site:instagram.com OR site:youtube.com) ' . $ouL && $rs[0]['specifique'] && $rs[0]['type'] === 'moteur', $j($rs[0] ?? null));
v('  → Bing web en RSS de résultats ; DuckDuckGo en page HTML (format html_ddg)', str_starts_with($rs[0]['url'], 'https://www.bing.com/search?q=') && str_contains($rs[0]['url'], 'format=rss')
  && str_starts_with($rs[1]['url'], 'https://html.duckduckgo.com/html/?q=') && ($rs[1]['format'] ?? '') === 'html_ddg' && empty($rs[0]['format']), $j([$rs[0]['url'] ?? '', $rs[1]['url'] ?? '']));
$ann = array_values(array_filter($web, fn($r) => $r['groupe'] === 'annonces'));
v('  → annonces : Avito, Mubawab, Sarouty, Yakeey, Agenz, Marocannonces', str_starts_with($ann[0]['q'] ?? '', '(site:avito.ma OR site:mubawab.ma OR site:sarouty.ma OR site:yakeey.com OR site:agenz.ma OR site:marocannonces.com) '), $ann[0]['q'] ?? '');
$nat = array_values(array_filter($R, fn($r) => $r['libelle'] === 'presse nationale'));
$fr = array_values(array_filter($nat, fn($r) => $r['langue'] === 'fr')); $ar = array_values(array_filter($nat, fn($r) => $r['langue'] === 'ar'));
v('presse nationale par paquets de 10 sites au plus, chacun avec le lieu dans SA langue (hespress avec le lieu arabe, ledesk avec le lieu français)',
  $fr && $ar && !array_filter($nat, fn($r) => substr_count($r['q'], 'site:') > 10) && str_contains($ar[0]['q'], 'site:hespress.com') && !str_contains($fr[0]['q'] . ($fr[1]['q'] ?? ''), 'hespress')
  && str_starts_with($ar[0]['q'], '("واحة سيدي ابراهيم" OR "واحة سيدي إبراهيم")') && !str_contains(implode(' ', array_column($ar, 'q')), 'ledesk'), $j(array_column($nat, 'q')));
v('chaque source nationale est interrogée (aucune perdue par les paquets)', count(array_filter($cfg['sources'], fn($x) => $x['portee'] === 'nationale' && !str_contains(implode(' ', array_column($nat, 'q')), 'site:' . $x['domaine']))) === 0);
//  une page / un groupe précis
$cfgG = $cfg; $cfgG['sources'][] = ['nom' => 'Groupe Ouahat', 'domaine' => 'facebook.com', 'chemin' => 'groups/123456', 'portee' => 'reseau', 'langue' => 'ar'];
$RG = cfo_vp_requetes($cfgG, $lieux, $sujets);
$grp = array_values(array_filter($RG, fn($r) => ($r['domaine'] ?? '') === 'facebook.com/groups/123456'));
v('un groupe Facebook précis : site:facebook.com/groups/123456 + lieux, par les deux moteurs du web', count($grp) === 2 && $grp[0]['q'] === 'site:facebook.com/groups/123456 ' . $ouL && $grp[0]['media'] === 'Groupe Ouahat', $j($grp));
v('  → le groupe précis ne retire pas Facebook de la recherche large', (bool)array_filter($RG, fn($r) => ($r['groupe'] ?? '') === 'reseau' && str_contains($r['q'], 'site:facebook.com')));
//  la saisie depuis l'écran
$vg = cfo_vp_valider_source(['nom' => 'Groupe Ouahat', 'domaine' => 'https://www.facebook.com/groups/123456/?ref=share', 'portee' => 'reseau', 'langue' => 'ar']);
v('adresse d\'un groupe collée : domaine facebook.com, chemin groups/123456 (paramètres retirés)', ($vg['source']['domaine'] ?? '') === 'facebook.com' && ($vg['source']['chemin'] ?? '') === 'groups/123456', $j($vg));
$vl = cfo_vp_valider_source(['nom' => 'Kech24', 'domaine' => 'https://www.kech24.com/category/x', 'portee' => 'locale', 'langue' => 'ar']);
v('  → la presse garde le site entier (pas de chemin)', ($vl['source']['domaine'] ?? '') === 'kech24.com' && !isset($vl['source']['chemin']), $j($vl));
v('  → un chemin piégé (« .. », caractères) : refusé, dit en clair', isset(cfo_vp_valider_source(['nom' => 'X', 'domaine' => 'facebook.com', 'chemin' => '../../etc', 'portee' => 'reseau', 'langue' => 'ar'])['erreur'])
  && isset(cfo_vp_valider_source(['nom' => 'X', 'domaine' => 'facebook.com', 'chemin' => 'a b"<x>', 'portee' => 'reseau', 'langue' => 'ar'])['erreur']));
v('  → portée inconnue : refusée', isset(cfo_vp_valider_source(['nom' => 'X', 'domaine' => 'x.ma', 'portee' => 'blog', 'langue' => 'fr'])['erreur']));
$L2 = cfo_vp_valider_liste([['nom' => 'Facebook', 'domaine' => 'facebook.com', 'portee' => 'reseau', 'langue' => 'ar'], ['nom' => 'Groupe', 'domaine' => 'facebook.com/groups/1', 'portee' => 'reseau', 'langue' => 'ar'],
                            ['nom' => 'Groupe bis', 'domaine' => 'facebook.com', 'chemin' => 'groups/1', 'portee' => 'reseau', 'langue' => 'ar']]);
v('plusieurs pages Facebook dans la liste ; la même page deux fois : refusée', count($L2['sources']) === 2 && count($L2['erreurs']) === 1 && str_contains(reset($L2['erreurs']), 'facebook.com/groups/1'), $j($L2));
$fu = cfo_vp_fusion($cfg['sources'], ['sources' => array_merge($cfg['sources'], [['nom' => 'Groupe', 'domaine' => 'facebook.com', 'chemin' => 'groups/1', 'portee' => 'reseau', 'langue' => 'ar']]),
                                      'defauts_connus' => array_map('cfo_vp_cle', $cfg['sources'])]);
$orig = array_column(array_map(fn($x) => ['c' => cfo_vp_cle($x), 'o' => $x['origine']], $fu['sources']), 'o', 'c');
v('  → vos réglages : le groupe « ajouté par vous », Facebook (tout le site) reste « d\'origine »', ($orig['facebook.com/groups/1'] ?? '') === 'ajoutee' && ($orig['facebook.com'] ?? '') === 'origine', $j($orig));
//  qui a écrit quoi : la page précise d'abord
v('un résultat facebook.com/groups/123456/posts/9 → le groupe ; facebook.com/autre → Facebook (tout le site)',
  (cfo_vp_media($cfgG, 'www.facebook.com', '/groups/123456/posts/9')['nom'] ?? '') === 'Groupe Ouahat' && (cfo_vp_media($cfgG, 'm.facebook.com', '/autre')['nom'] ?? '') === 'Facebook (pages et groupes publics)'
  && (cfo_vp_media($cfgG, 'facebook.com', '/groups/1234567')['nom'] ?? '') === 'Facebook (pages et groupes publics)');
//  DuckDuckGo (HTML)
$reqD = $grp[1];
$ddg = '<html><body><div class="results">'
     . '<div class="result results_links"><a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.facebook.com%2Fgroups%2F123456%2Fposts%2F9&amp;rut=abc">Lotissement à Ouahat Sidi Brahim : les prix</a>'
     . '<a class="result__snippet" href="#">Terrain de 5 000 m² à <b>Ouahat Sidi Brahim</b>, 450 DH le m²…</a></div>'
     . '<div class="result result--ad"><a class="result__a" href="https://duckduckgo.com/y.js?ad_domain=x.com&amp;u3=1">Publicité</a></div>'
     . '<div class="result"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.avito.ma%2Ffr%2Fmarrakech%2Fterrains%2F12345.htm">Terrain 2 ha Oulad Belaagid</a>'
     . '<a class="result__snippet">Vente terrain agricole</a></div></div></body></html>';
$bD = cfo_vp_bilan($reqD, ['http' => 200, 'corps' => $ddg], $cfgG);
$aD = $bD['articles'];
v('DuckDuckGo : 2 résultats (publicité écartée), adresses d\'origine rendues, extrait lu, page attribuée au groupe, annonce à Avito',
  $bD['statut'] === 'ok' && count($aD) === 2 && $aD[0]['url'] === 'https://www.facebook.com/groups/123456/posts/9' && $aD[0]['source'] === 'Groupe Ouahat' && $aD[0]['portee'] === 'reseau'
  && str_contains($aD[0]['extrait'], '450 DH') && $aD[1]['source'] === 'Avito' && $aD[1]['portee'] === 'annonces' && $aD[0]['specifique'], $j($bD));
$bC = cfo_vp_bilan($reqD, ['http' => 200, 'corps' => '<html><body><form id="challenge-form">Unfortunately, bots use DuckDuckGo too.</form></body></html>'], $cfgG);
v('  → une page anti-robots : « illisible », dit, rien d\'inventé', $bC['statut'] === 'illisible' && $bC['articles'] === [], $j($bC));
$bV = cfo_vp_bilan($reqD, ['http' => 200, 'corps' => '<html><body><div class="no-results">No results.</div></body></html>'], $cfgG);
v('  → aucun résultat : « vide », pas un échec', $bV['statut'] === 'vide', $j($bV));
//  Bing web (RSS)
$bingWeb = '<?xml version="1.0" encoding="utf-8" ?><rss version="2.0"><channel><title>Bing</title>'
         . '<item><title>Terrain à vendre Ouahat Sidi Brahim - Mubawab</title><link>https://www.mubawab.ma/fr/a/1234/terrain</link><description>3 ha titré</description><pubDate>' . gmdate('D, d M Y H:i:s', $now - 5 * 86400) . ' GMT</pubDate></item>'
         . '<item><title>Forum Yabiladi : Ouahat Sidi Brahim</title><link>https://www.yabiladi.com/forum/x-1-2.html</link><description>discussion</description></item></channel></rss>';
$bB = cfo_vp_bilan($rs[0], ['http' => 200, 'corps' => $bingWeb], $cfg);
v('Bing web (RSS) : annonce Mubawab et forum Yabiladi reconnus, datés quand le moteur date', $bB['statut'] === 'ok' && $bB['articles'][0]['source'] === 'Mubawab' && $bB['articles'][0]['portee'] === 'annonces'
  && $bB['articles'][0]['date'] !== null && $bB['articles'][1]['portee'] === 'forum' && $bB['articles'][1]['date'] === null, $j($bB['articles']));
$sel = cfo_vp_selection(array_merge($aD, $bB['articles']), ['Ouahat Sidi Brahim'], [], $cfg, $now);
$anD = cfo_vp_annonces(array_merge($aD, $bB['articles']), ['Ouahat Sidi Brahim'], $now); $sgD = cfo_vp_signaux(array_merge($aD, $bB['articles']), ['Ouahat Sidi Brahim'], $now);
v('  → v37.138 trois circuits : aucune annonce ni aucun post dans les ACTUALITÉS ; annonces Mubawab (3 ha, titré) et Avito (2 ha, rubrique Marrakech) dans leur circuit ; post Facebook et forum Yabiladi en signaux',
  $sel === [] && count($anD) === 2 && $anD[0]['source'] === 'Mubawab' && $anD[0]['surface_m2'] === 30000 && $anD[0]['titre_foncier'] === 'titré' && $anD[0]['lieu'] === 'Ouahat Sidi Brahim'
  && $anD[1]['source'] === 'Avito' && $anD[1]['surface_m2'] === 20000 && $anD[1]['lieu'] === null && $anD[1]['marrakech'] === true
  && count($sgD) === 2 && in_array('facebook.com', array_column($sgD, 'plateforme'), true) && in_array('yabiladi.com', array_column($sgD, 'plateforme'), true)
  && str_contains($sgD[0]['niveau'], 'véracité non vérifiée'), $j([array_column($sel, 'titre'), $anD, $sgD]));
//  combien de retenus par source
$ret = array_merge($aD, $bB['articles']);
v('retenus par source : famille « annonces » 2, groupe Facebook 1, Facebook entier 1',
  cfo_vp_retenus_de($ret, ['groupe' => 'annonces']) === 2 && cfo_vp_retenus_de($ret, ['domaine' => 'facebook.com/groups/123456']) === 1 && cfo_vp_retenus_de($ret, ['domaine' => 'facebook.com']) === 1
  && cfo_vp_retenus_de($ret, ['domaine' => 'facebook.com/groups/999']) === 0);
//  tester une source du web depuis l'écran
$tq = cfo_vp_requetes_test($cfgG, ['nom' => 'Groupe Ouahat', 'domaine' => 'facebook.com', 'chemin' => 'groups/123456', 'portee' => 'reseau', 'langue' => 'ar']);
v('🧪 tester un groupe : Bing (web) et DuckDuckGo sur site:facebook.com/groups/123456, sans page d\'accueil', array_column($tq, 'canal') === ['bing_web', 'ddg']
  && $tq[0]['q'] === 'site:facebook.com/groups/123456 (Marrakech OR مراكش)' && ($tq[1]['format'] ?? '') === 'html_ddg', $j($tq));

/* ── 6. v37.121 : les catalyseurs de la zone, dans toute la presse ── */
//  « Pourquoi il ne trouve pas Le360 : Mondial 2030, 7,5 milliards de dirhams pour les accès aux stades de Benslimane et de Marrakech ? »
$sujZ = ['RN9', 'SDAU', "plan d'aménagement", 'LGV', 'Grand Stade', 'contournement', 'Mondial 2030', 'الطريق الوطنية رقم 9', 'المخطط المديري', 'تصميم التهيئة', 'القطار فائق السرعة', 'الملعب الكبير', 'مونديال 2030'];
$RZ = cfo_vp_requetes($cfg, $lieux, $sujZ);
$cz = array_values(array_filter($RZ, fn($r) => str_starts_with($r['libelle'], 'zone · catalyseurs')));
$czfr = array_values(array_filter($cz, fn($r) => $r['langue'] === 'fr' && $r['canal'] === 'moteur'))[0] ?? null;
v('zone : « Marrakech + catalyseurs » dans TOUTE la presse (sans site:), synonymes compris — « Mondial 2030 », « stades », « grande vitesse »',
  $czfr && str_starts_with($czfr['q'], 'Marrakech (') && !str_contains($czfr['q'], 'site:') && str_contains($czfr['q'], '"Mondial 2030"') && str_contains($czfr['q'], 'stades')
  && str_contains($czfr['q'], '"Grand Stade"') && str_contains($czfr['q'], '"grande vitesse"') && !$czfr['specifique'], $j($czfr));
v('  → les sujets du lieu (SDAU, plan d\'aménagement, RN9) n\'y sont pas : ils sont cherchés AVEC le lieu', $czfr && !preg_match('/SDAU|aménagement|RN9/u', $czfr['q']), $czfr['q'] ?? '');
v('  → aussi par Bing (canal à part) et en arabe (« مراكش » + مونديال 2030…) ; juste après les requêtes du lieu',
  count(array_filter($cz, fn($r) => $r['canal'] === 'bing_zone')) === 1 && (bool)array_filter($cz, fn($r) => $r['langue'] === 'ar' && str_starts_with($r['q'], 'مراكش') && str_contains($r['q'], 'مونديال 2030'))
  && array_search($cz[0], $RZ, true) < min(array_keys(array_column($RZ, 'canal'), 'recherche')), $j(array_column($RZ, 'libelle')));
//  le tri : 20 articles qui nomment le lieu, et l'article de Le360 qui n'en parle pas mais touche le Grand Stade
$lieuArt = array_map(fn($i) => ['titre' => "Ouahat Sidi Brahim : nouvelle info $i", 'extrait' => '', 'url' => "https://almarrakchia.net/a$i", 'source' => 'Al Marrakchia', 'domaine' => 'almarrakchia.net',
    'portee' => 'locale', 'ts' => $now - $i * 86400, 'date' => null, 'specifique' => true, 'langue' => 'fr'], range(1, 20));
$le360 = ['titre' => 'Mondial 2030 : 7,5 milliards de dirhams pour les accès aux stades de Benslimane et de Marrakech', 'extrait' => '', 'url' => 'https://fr.le360.ma/sports/mondial-2030-75-milliards',
    'source' => 'Le360', 'domaine' => 'fr.le360.ma', 'portee' => 'nationale', 'ts' => $now - 3 * 86400, 'date' => null, 'specifique' => false, 'langue' => 'fr'];
$tanger = ['titre' => 'Mondial 2030 : le stade de Tanger agrandi', 'extrait' => '', 'url' => 'https://le360.ma/tanger', 'source' => 'Le360', 'domaine' => 'le360.ma', 'portee' => 'nationale',
    'ts' => $now - 2 * 86400, 'date' => null, 'specifique' => false, 'langue' => 'fr'];
$selZ = cfo_vp_selection(array_merge($lieuArt, [$le360, $tanger]), ['Ouahat Sidi Brahim'], ['Grand Stade'], $cfg, $now);
$titresZ = array_column($selZ, 'titre');
v('tri : l\'article de Le360 (« Mondial 2030 », « accès aux stades de … Marrakech ») est GARDÉ, marqué « zone », même face à 20 articles qui nomment le lieu',
  in_array($le360['titre'], $titresZ, true) && (array_values(array_filter($selZ, fn($a) => $a['titre'] === $le360['titre']))[0]['zone'] ?? false) === true
  && count($selZ) === (int)$cfg['max_articles'] && count(array_filter($selZ, fn($a) => !$a['zone'])) >= (int)$cfg['max_articles'] - (int)$cfg['quota_zone'], $j($titresZ));
v('  → « Grand Stade » reconnu par ses synonymes (Mondial 2030, stades) ; un stade hors de Marrakech (Tanger) : écarté', !in_array($tanger['titre'], $titresZ, true));
//  « Et cet article ? » — Le Desk : « Egis lance les enquêtes du plan de mobilité du Grand Marrakech » — ni le lieu, ni un sujet de la fiche
$gp = array_values(array_filter($RZ, fn($r) => str_starts_with($r['libelle'], 'zone · grands projets') && $r['canal'] === 'moteur' && $r['langue'] === 'fr'))[0] ?? null;
v('grands projets de la zone (veille_sources.json) TOUJOURS cherchés dans toute la presse : « Marrakech ("plan de mobilité" OR PMUD OR "Grand Marrakech"…) », + Bing, + arabe',
  $gp && str_starts_with($gp['q'], 'Marrakech (') && str_contains($gp['q'], '"plan de mobilité"') && str_contains($gp['q'], 'PMUD') && !str_contains($gp['q'], 'site:')
  && (bool)array_filter($RZ, fn($r) => $r['libelle'] === 'zone · grands projets (Bing)') && (bool)array_filter($RZ, fn($r) => str_starts_with($r['libelle'], 'zone · grands projets') && $r['langue'] === 'ar'), $j($gp));
$ledesk = ['titre' => 'Egis lance les enquêtes du plan de mobilité du Grand Marrakech', 'extrait' => '5 000 ménages enquêtés, d\'octobre à décembre 2026', 'url' => 'https://ledesk.ma/encontinu/egis-plan-mobilite',
    'source' => 'Le Desk', 'domaine' => 'ledesk.ma', 'portee' => 'nationale', 'ts' => $now - 4 * 86400, 'date' => null, 'specifique' => false, 'langue' => 'fr'];
$selD = cfo_vp_selection(array_merge($lieuArt, [$ledesk]), ['Ouahat Sidi Brahim'], ['RN9', 'SDAU'], $cfg, $now);
v('  → l\'article de Le Desk (plan de mobilité du Grand Marrakech) est GARDÉ, « zone », même si la fiche du bien ne parle pas de mobilité',
  (bool)array_filter($selD, fn($a) => $a['titre'] === $ledesk['titre'] && $a['zone']), $j(array_column($selD, 'titre')));
//  v37.123 — élargir : les candidats (vérifiés ensuite par l'IA) prennent aussi Marrakech sans sujet reconnu, jusqu'à max_candidats
$generique = ['titre' => 'Marrakech : la ville accueille un forum international', 'extrait' => '', 'url' => 'https://le360.ma/forum', 'source' => 'Le360', 'domaine' => 'le360.ma',
    'portee' => 'nationale', 'ts' => $now - 86400, 'date' => null, 'specifique' => false, 'langue' => 'fr'];
$candL = cfo_vp_selection(array_merge($lieuArt, [$generique, $le360, $tanger]), ['Ouahat Sidi Brahim'], ['Grand Stade'], ['max_articles' => (int)$cfg['max_candidats'], 'quota_zone' => 20, 'large' => true] + $cfg, $now);
$selN = cfo_vp_selection(array_merge($lieuArt, [$generique]), ['Ouahat Sidi Brahim'], ['Grand Stade'], $cfg, $now);
v('élargi (candidats pour l\'IA) : Marrakech sans sujet reconnu entre aussi — pas dans le tri habituel ; Tanger reste dehors ; ' . $cfg['max_candidats'] . ' au plus',
  in_array($generique['titre'], array_column($candL, 'titre'), true) && !in_array($generique['titre'], array_column($selN, 'titre'), true) && !in_array($tanger['titre'], array_column($candL, 'titre'), true)
  && count($candL) === 22 && (int)$cfg['max_candidats'] === 50, (string)count($candL));
$selSeul = cfo_vp_selection($lieuArt, ['Ouahat Sidi Brahim'], ['Grand Stade'], $cfg, $now);
v('  → sans article de zone, ses places reviennent au lieu (' . $cfg['max_articles'] . ' articles)', count($selSeul) === (int)$cfg['max_articles'] && !array_filter($selSeul, fn($a) => $a['zone']));

/* ── 7. v37.125 : « chambouler » — une requête par grand projet, et la mémoire de la veille ── */
$proj = array_values(array_filter($RZ, fn($r) => str_ends_with($r['libelle'], '(6 mois)')));
$qp = array_column($proj, 'q');
v('une requête PAR grand projet, sur les 6 derniers mois : « "Grand Stade" Marrakech when:180d », « "Mondial 2030" Marrakech… », « "plan de mobilité"… », en arabe aussi',
  in_array('"Grand Stade" Marrakech when:180d', $qp, true) && in_array('"Mondial 2030" Marrakech when:180d', $qp, true) && in_array('"plan de mobilité" Marrakech when:180d', $qp, true)
  && (bool)array_filter($qp, fn($q) => str_contains($q, 'مراكش when:180d')) && !array_filter($proj, fn($r) => $r['specifique']) && !preg_grep('/SDAU|aménagement|RN9/u', $qp), $j($qp));
v('  → juste après les requêtes du lieu (avant les moteurs du web, les pages des journaux et les accueils)',
  array_search($proj[0], $RZ, true) < min(array_keys(array_column($RZ, 'canal'), 'recherche')) && array_search($proj[0], $RZ, true) > array_search('lieu + urbanisme', array_column($RZ, 'libelle')), $j(array_column($RZ, 'libelle')));
//  la mémoire : un article trouvé une fois revient ; 180 jours ; 200 au plus ; marqué « déjà trouvé le »
$m1 = cfo_vp_memoire_maj([], [$le360 + ['zone' => true], $ledesk], $now);
$m2 = cfo_vp_memoire_maj($m1, [$generique], $now + 86400);
$memA = cfo_vp_memoire_articles($m2);
v('mémoire de la veille : Le360 et Le Desk trouvés une fois sont GARDÉS au passage suivant (même si le moteur ne les rend plus), marqués « déjà trouvé le … »',
  count($m2) === 3 && in_array($le360['url'], array_column($memA, 'url'), true) && ($memA[array_search($le360['url'], array_column($memA, 'url'))]['memoire'] ?? '') === gmdate('Y-m-d', $now), $j($m2));
$selM = cfo_vp_selection(array_merge($lieuArt, $memA), ['Ouahat Sidi Brahim'], ['Grand Stade'], $cfg, $now + 86400);
v('  → au tri, l\'article de Le360 revenu de la mémoire est retenu (contexte zone), avec sa marque', (bool)array_filter($selM, fn($a) => $a['url'] === $le360['url'] && !empty($a['memoire']) && $a['zone']), $j(array_column($selM, 'titre')));
$vieux = cfo_vp_memoire_maj($m1, [], $now + 181 * 86400);
$beaucoup = cfo_vp_memoire_maj([], array_map(fn($i) => ['titre' => "Article $i", 'url' => "https://x.ma/$i", 'ts' => $now - $i], range(1, 260)), $now);
v('  → 180 jours sans être revu : oublié ; 200 articles au plus (les plus récents)', $vieux === [] && count($beaucoup) === 200 && $beaucoup[0]['url'] === 'https://x.ma/1', (string)count($beaucoup));

echo "  " . str_repeat('─', 86) . "\n";
echo $ko === 0 ? "  ✅ TOUT PASSE — $n contrôles\n" : "  ❌ $ko contrôle(s) en échec sur $n\n";
exit($ko === 0 ? 0 : 1);
