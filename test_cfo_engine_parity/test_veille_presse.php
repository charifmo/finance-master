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
$strict = fn($dom) => 'site:' . $dom . ' ("واحة سيدي ابراهيم" OR "Ouahat Sidi Brahim" OR "Oulad Belaagid")';
foreach (['almarrakchia.net', 'marrakechalaan.com', 'kech24.com', 'marrakech7.com'] as $dom)
    v("requête stricte pour $dom : site:$dom (lieux AR OR FR), Google en arabe",
      (bool)array_filter($R, fn($r) => $r['q'] === $strict($dom) && str_contains($r['url'], 'hl=ar') && $r['domaine'] === $dom && $r['specifique']), $j($qs));
v('plus de OR groupé des sites locaux pour un lieu (les petits médias y étaient noyés)', !in_array('"Ouahat Sidi Brahim" ' . $locales, $qs, true) && !in_array('"واحة سيدي ابراهيم" ' . $locales, $qs, true));
v('le lieu avec les sujets fonciers (RN9, SDAU, plan d\'aménagement…)', in_array('"Ouahat Sidi Brahim" (RN9 OR SDAU OR "plan d\'aménagement" OR "Grand Stade")', $qs, true));
v('la presse nationale (Le Desk, Médias24, Hespress…)', (bool)array_filter($qs, fn($q) => str_starts_with($q, '"Ouahat Sidi Brahim" (site:ledesk.ma OR site:medias24.com')));
v('le lieu en ARABE, sur Google Actualités en arabe', (bool)array_filter($R, fn($r) => str_starts_with($r['q'], '"واحة سيدي ابراهيم"') && str_contains($r['url'], 'hl=ar')));
v('les sujets en arabe vont avec le lieu en arabe', in_array('"واحة سيدي ابراهيم" ("الطريق الوطنية رقم 9" OR "المخطط المديري" OR "تصميم التهيئة")', $qs, true));
v('la recherche des sites locaux reçoit le lieu dans LEUR langue (arabe), lue comme une PAGE',
  count(array_filter($R, fn($r) => $r['canal'] === 'recherche' && $r['type'] === 'page' && $r['q'] === 'واحة سيدي ابراهيم')) === 4, $j(array_values(array_filter($R, fn($r) => $r['canal'] === 'recherche'))));
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
    v("$dom : Google (site:), sa page de recherche, Bing (site:), sa page d'accueil", ($portes[$dom] ?? []) === ['moteur', 'recherche', 'bing', 'accueil'], $j($portes[$dom] ?? null));
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
foreach (range(1, 4) as $k) $cfg8['sources'][] = ['nom' => "Local $k", 'domaine' => "local$k.ma", 'portee' => 'locale', 'langue' => 'ar', 'flux' => "https://local$k.ma/?s={q}"];
$R8 = cfo_vp_requetes($cfg8, $lieux, $sujets);
v('8 médias locaux : plafonné à ' . CFO_VP_MAX_REQUETES . ', la presse nationale et toutes les requêtes Google site: restent',
  count($R8) === CFO_VP_MAX_REQUETES && (bool)array_filter($R8, fn($r) => $r['libelle'] === 'presse nationale')
  && count(array_filter($R8, fn($r) => $r['canal'] === 'moteur' && str_starts_with($r['libelle'], 'site:'))) === 8, (string)count($R8));

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
v('plafond max_articles respecté', count(cfo_vp_selection(array_map(fn($i) => $art("Ouahat Sidi Brahim $i", $i), range(1, 40)), ['Ouahat Sidi Brahim'], [], $cfg, $now)) === (int)$cfg['max_articles']);

echo "  " . str_repeat('─', 86) . "\n";
echo $ko === 0 ? "  ✅ TOUT PASSE — $n contrôles\n" : "  ❌ $ko contrôle(s) en échec sur $n\n";
exit($ko === 0 ? 0 : 1);
