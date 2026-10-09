<?php
declare(strict_types=1);
/**
 * v37.42 — LA PRESSE SANS FLUX RSS, ET SANS CURL.
 *
 *   « L'erreur "L'extension curl de PHP est requise" s'affiche partout. » —
 *   « Aucun de ces sites locaux n'utilise de flux RSS ouvert : trouve les
 *   articles de manière robuste, sans jamais t'appuyer sur des flux RSS. »
 *
 *   A. Les pages des journaux, lues en HTML : l'en-tête d'un <article>
 *      WordPress (qui porte le titre) n'est plus jeté avec les menus ; une page
 *      d'accueil lit ses <article> ET ses blocs de une ; un thème maison sans
 *      <article> ni titre h1-h4 est lu par ses liens d'article.
 *   B. Sans php-xml : la lecture de secours (expressions régulières) rend les
 *      mêmes articles, rien de « spécifique ».
 *   C. Le bilan d'une porte : chaque échec dit en clair.
 *   D. Le réseau pour de vrai (un php -S local) : curl en parallèle et flux
 *      PHP une à une rendent la même chose ; sans curl, le budget de temps est
 *      tenu et ce qui n'a pas pu être interrogé est dit ; le proxy se lit comme
 *      curl le lit (jamais d'un en-tête « Proxy: ») ; un PHP sans curl, sans
 *      SimpleXML ou sans allow_url_fopen est diagnostiqué, commande à l'appui.
 */
require_once __DIR__ . '/../cfo_veille_serveur.php';

$ko = 0; $n = 0;
function v(string $titre, bool $ok, string $detail = ''): void {
    global $ko, $n; $n++; if (!$ok) $ko++;
    printf("  %s %-72s %s\n", $ok ? '✅' : '❌', $titre, $ok ? '' : $detail);
}
$j = fn($x) => json_encode($x, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
echo "\n  PRESSE SANS FLUX NI CURL — pages HTML, secours, réseau\n  " . str_repeat('─', 86) . "\n";
$cfg = json_decode(file_get_contents(__DIR__ . '/../veille_sources.json'), true);
foreach (['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'no_proxy', 'NO_PROXY'] as $e) putenv($e);   // réseau local direct
$titres = fn($l) => array_column($l ?? [], 'titre');

/* ── A. Les pages des journaux ─────────────────────────────────────────── */
$wpTheme = <<<'H'
<!DOCTYPE html><html lang="ar"><head><title>نتائج البحث عن واحة سيدي ابراهيم – المراكشية</title></head><body>
<header id="masthead" class="site-header"><p class="site-title"><a href="https://www.almarrakchia.net/2026/01/01/a-propos-du-journal-local/">المراكشية — أخبار مراكش وجهتها كل يوم</a></p>
<nav class="main-navigation"><a href="https://www.almarrakchia.net/category/region/">جهة مراكش آسفي جهة جهة</a></nav></header>
<main id="main"><header class="page-header"><h1 class="page-title">نتائج البحث عن: واحة سيدي ابراهيم</h1></header>
<article id="post-9" class="post type-post"><header class="entry-header"><h2 class="entry-title"><a href="https://www.almarrakchia.net/2026/09/01/coop/" rel="bookmark">واحة سيدي ابراهيم: تعاونية فلاحية تطالب بتصميم التهيئة</a></h2>
<div class="entry-meta"><time class="entry-date published" datetime="2026-09-01T09:00:00+01:00">1 شتنبر 2026</time></div></header>
<div class="entry-summary"><p>طالبت تعاونية فلاحية بتسريع إخراج تصميم التهيئة الجديد للجماعة القروية…</p></div>
<footer class="entry-footer"><a href="https://www.almarrakchia.net/category/region/">جهة مراكش</a></footer></article>
</main><footer id="colophon"><a href="https://www.almarrakchia.net/2026/01/01/conditions-generales/">الشروط العامة لاستعمال الموقع الإلكتروني</a></footer></body></html>
H;
$reqA = ['type' => 'page', 'canal' => 'recherche', 'nom' => 'Al Marrakchia', 'q' => 'واحة سيدي ابراهيم', 'langue' => 'ar',
         'url' => 'https://www.almarrakchia.net/?s=x', 'domaine' => 'almarrakchia.net', 'specifique' => true];
$a = cfo_vp_lire_reponse($wpTheme, $reqA, $cfg);
v('thème WordPress : le titre dans <header class="entry-header"> de l\'<article> est lu', $titres($a['articles']) === ['واحة سيدي ابراهيم: تعاونية فلاحية تطالب بتصميم التهيئة'], $j($a));
v('  → avec sa date (<time> de l\'en-tête), son chapô, « spécifique » (page de résultats)', ($a['articles'][0]['date'] ?? '') === '2026-09-01'
  && str_starts_with($a['articles'][0]['extrait'] ?? '', 'طالبت تعاونية') && ($a['articles'][0]['specifique'] ?? false) === true, $j($a['articles'][0] ?? null));
v('  → l\'en-tête du SITE (logo, menu) et son pied restent écartés', count($a['articles']) === 1);

$accueil = <<<'H'
<!DOCTYPE html><html lang="ar"><head><title>كش 24 - جريدة إلكترونية مغربية</title></head><body>
<header><nav class="menu"><a href="/category/marrakech/">مراكش مراكش مراكش مراكش مراكش</a></nav></header>
<div class="widget block-une"><h2><a href="https://www.kech24.com/2026/10/08/oasis-rn9/">واحة سيدي ابراهيم: انطلاق أشغال تثنية الطريق الوطنية رقم 9</a></h2></div>
<article class="post"><h3><a href="https://www.kech24.com/2026/10/08/kawkab/">الكوكب المراكشي يفوز في مباراة مثيرة جدا</a></h3><time datetime="2026-10-08">8 أكتوبر</time></article>
<div class="widget"><h3><a href="/2026/10/07/festival/">مهرجان مراكش الدولي للفيلم يكشف عن برنامجه</a></h3></div>
<footer><h4><a href="https://www.kech24.com/2026/01/01/contact/">اتصل بنا اتصل بنا اتصل بنا اتصل بنا</a></h4></footer></body></html>
H;
$reqH = ['type' => 'page', 'canal' => 'accueil', 'nom' => 'Kech24', 'q' => '', 'langue' => 'ar', 'url' => 'https://www.kech24.com/', 'domaine' => 'kech24.com', 'specifique' => false];
$h = cfo_vp_lire_reponse($accueil, $reqH, $cfg);
v('page d\'accueil : ses <article> ET ses blocs de une (« widget ») sont lus', $h['mode'] === 'page' && count($h['articles'] ?? []) === 3, $j($titres($h['articles'])));
v('  → menu et pied de page écartés, liens relatifs résolus', !array_filter($titres($h['articles']), fn($t) => str_contains($t, 'اتصل') || str_contains($t, 'مراكش مراكش'))
  && in_array('https://www.kech24.com/2026/10/07/festival/', array_column($h['articles'], 'url'), true));
v('  → rien n\'y est « spécifique » : la une ne prouve rien sur le lieu', !array_filter($h['articles'], fn($x) => $x['specifique']));
$sel = cfo_vp_selection($h['articles'], ['واحة سيدي ابراهيم'], ['الطريق الوطنية رقم 9'], $cfg, strtotime('2026-10-09'));
v('  → au tri, seul le titre qui nomme le lieu reste', $titres($sel) === ['واحة سيدي ابراهيم: انطلاق أشغال تثنية الطريق الوطنية رقم 9'], $j($titres($sel)));
$rh = cfo_vp_lire_reponse($accueil, ['canal' => 'recherche', 'q' => 'واحة سيدي ابراهيم'] + $reqH, $cfg);
v('sur une page de RÉSULTATS, les blocs « widget » restent écartés (barre latérale)', $titres($rh['articles']) === ['الكوكب المراكشي يفوز في مباراة مثيرة جدا'], $j($titres($rh['articles'])));

$maison = <<<'H'
<!DOCTYPE html><html><head><title>مراكش الآن</title></head><body>
<div class="top"><a href="https://marrakechalaan.com/rubrique/societe">مجتمع مجتمع مجتمع مجتمع مجتمع مجتمع</a></div>
<div class="liste"><div class="titre"><a href="https://marrakechalaan.com/actualites/184512.html">واحة سيدي ابراهيم: الساكنة تطالب بفك العزلة عن الدواوير</a></div>
<div class="titre"><a href="https://marrakechalaan.com/%D8%A7%D9%84%D9%88%D9%83%D8%A7%D9%84%D8%A9-%D8%A7%D9%84%D8%AD%D8%B6%D8%B1%D9%8A%D8%A9-%D8%AA%D9%81%D8%AA%D8%AD-%D8%B4%D8%B1%D9%8A%D8%B7">الوكالة الحضرية تفتح شريط الطريق الوطنية للأنشطة</a></div>
<div class="titre"><a href="https://marrakechalaan.com/actualites/184513.html">المزيد</a></div>
<div class="pub"><a href="https://pub.example.com/2026/promo-123456">عرض خاص على الشقق الفاخرة في مراكش اليوم</a></div></div></body></html>
H;
$m = cfo_vp_lire_reponse($maison, ['type' => 'page', 'canal' => 'accueil', 'nom' => 'Marrakech Alaan', 'q' => '', 'langue' => 'ar',
                                   'url' => 'https://marrakechalaan.com/', 'domaine' => 'marrakechalaan.com', 'specifique' => false], $cfg);
v('thème maison (ni <article>, ni h1-h4) : les liens qui ont l\'allure d\'un article sont lus', array_column($m['articles'] ?? [], 'url') === ['https://marrakechalaan.com/actualites/184512.html',
  'https://marrakechalaan.com/%D8%A7%D9%84%D9%88%D9%83%D8%A7%D9%84%D8%A9-%D8%A7%D9%84%D8%AD%D8%B6%D8%B1%D9%8A%D8%A9-%D8%AA%D9%81%D8%AA%D8%AD-%D8%B4%D8%B1%D9%8A%D8%B7'], $j($m));
v('  → ni la rubrique, ni « المزيد » (trop court), ni la publicité d\'un autre site', count($m['articles'] ?? []) === 2);
foreach ([['/2026/09/12/oasis/', true], ['/actualites/184512.html', true], ['/?p=4521', true], ['/مشروع-تجزئة-سكنية-جديدة-قرب-الطريق', true],
          ['/rubrique/societe', false], ['/contact', false], ['/', false], ['/a-b', false]] as [$lien, $attendu])
    v("allure d'article : $lien → " . ($attendu ? 'oui' : 'non'), cfo_vp_lien_article($lien) === $attendu);

/* ── B. Sans php-xml : la lecture de secours ───────────────────────────── */
$kech = <<<'H'
<!DOCTYPE html><html lang="ar"><head><title>نتائج البحث عن واحة سيدي ابراهيم - كش 24</title><script>var h2 = "<h2><a href='https://www.kech24.com/2026/01/01/piege-script/'>عنوان داخل سكريبت لا يقرأ أبدا</a></h2>";</script></head><body>
<nav><h3><a href="https://www.kech24.com/2026/02/02/menu-du-site/">رابط من القائمة الرئيسية للموقع</a></h3></nav>
<main><h1>نتائج البحث عن: واحة سيدي ابراهيم</h1>
<article><h2 class="entry-title"><a href="https://www.kech24.com/2026/09/12/oasis-plan/">واحة سيدي ابراهيم: الوكالة الحضرية تفتح شريط الطريق الوطنية رقم 9</a></h2></article>
<article><h2><a href='/2026/08/03/rocade/'>الطريق المداري الكبير لمراكش يمر قرب &laquo;الدواوير&raquo; الشمالية</a></h2></article>
<article><h2><a href="https://www.kech24.com/tag/oasis/">وسم واحة سيدي ابراهيم وسم وسم</a></h2></article>
<article><h3><a href="javascript:alert(1)">رابط مشبوه رابط مشبوه رابط مشبوه</a></h3></article></main>
<aside class="sidebar"><h3><a href="https://www.kech24.com/2026/10/01/foot/">الكوكب المراكشي يفوز في مباراة مثيرة</a></h3></aside>
<div class="ad"><h3><a href="https://pub.example.com/promo">عرض خاص على الشقق الفاخرة في مراكش</a></h3></div></body></html>
H;
$reqK = ['type' => 'page', 'canal' => 'recherche', 'nom' => 'Kech24', 'q' => 'واحة سيدي ابراهيم', 'langue' => 'ar', 'url' => 'https://www.kech24.com/?s=x', 'domaine' => 'kech24.com', 'specifique' => true];
$dom = cfo_vp_lire_html($kech, $reqK, $cfg, $reqK['url']);
$brut = cfo_vp_lire_html_brut($kech, $reqK, $cfg, $reqK['url']);
v('sans DOMDocument : les mêmes articles que la lecture DOM', array_column($brut ?? [], 'url') === array_column($dom ?? [], 'url')
  && array_column($brut, 'url') === ['https://www.kech24.com/2026/09/12/oasis-plan/', 'https://www.kech24.com/2026/08/03/rocade/'], $j([array_column($brut ?? [], 'url'), array_column($dom ?? [], 'url')]));
v('  → script, menu, barre latérale, étiquette, javascript:, publicité : écartés', count($brut) === 2);
v('  → entités décodées, guillemets simples compris', ($brut[1]['titre'] ?? '') === 'الطريق المداري الكبير لمراكش يمر قرب «الدواوير» الشمالية', $brut[1]['titre'] ?? '');
v('  → rien n\'y est « spécifique » (lecture moins fine : le titre devra nommer le lieu)', !array_filter($brut, fn($x) => $x['specifique']) && ($brut[0]['source'] ?? '') === 'Kech24');
v('  → l\'en-tête d\'<article> WordPress aussi', $titres(cfo_vp_lire_html_brut($wpTheme, $reqA, $cfg, $reqA['url'])) === ['واحة سيدي ابراهيم: تعاونية فلاحية تطالب بتصميم التهيئة']);
v('  → du JSON n\'est pas une page : null', cfo_vp_lire_html_brut('{"error":"blocked"}', $reqK, $cfg, $reqK['url']) === null);

/* ── C. Le bilan d'une porte ────────────────────────────────────────────── */
$moteur = ['type' => 'moteur', 'canal' => 'moteur', 'nom' => 'Google', 'q' => 'x', 'specifique' => true, 'url' => 'https://news.google.com/rss/search?q=x'];
$rss = '<?xml version="1.0"?><rss version="2.0"><channel><item><title>Ouahat Sidi Brahim : la RN9 doublée - Kech24</title><link>https://news.google.com/rss/articles/K9</link>'
     . '<pubDate>Mon, 05 Oct 2026 08:00:00 GMT</pubDate><source url="https://www.kech24.com">Kech24</source></item></channel></rss>';
$bl = fn($r, $x) => array_diff_key(cfo_vp_bilan($r, $x + ['corps' => '', 'erreur' => ''], $cfg), ['articles' => 1]);
v('bilan : moteur lu → ok, 1 article, mode « moteur »', $bl($moteur, ['http' => 200, 'corps' => $rss]) === ['statut' => 'ok', 'n' => 1, 'mode' => 'moteur']);
v('bilan : page de journal lue → ok, mode « page »', $bl($reqK, ['http' => 200, 'corps' => $kech]) === ['statut' => 'ok', 'n' => 2, 'mode' => 'page']);
v('bilan : non interrogée (budget) → « saute », dit', $bl($reqK, ['http' => 0, 'saute' => true, 'erreur' => 'non interrogée : temps total épuisé']) === ['statut' => 'saute', 'erreur' => 'non interrogée : temps total épuisé']);
v('bilan : HTTP 403 → accès refusé, en clair', ($bl($reqK, ['http' => 403])['erreur'] ?? '') === 'accès refusé par le site (HTTP 403 — protection anti-robots ?)');
v('bilan : HTTP 404 / 429 / 503 / 302 en clair', $bl($reqK, ['http' => 404])['erreur'] === 'page introuvable (HTTP 404)' && $bl($reqK, ['http' => 429])['erreur'] === 'trop de requêtes, le site temporise (HTTP 429)'
  && $bl($reqK, ['http' => 503])['erreur'] === 'le site est en panne (HTTP 503)' && $bl($reqK, ['http' => 302])['erreur'] === 'trop de redirections (HTTP 302)');
v('bilan : la cause réseau prime sur le code', $bl($reqK, ['http' => 0, 'erreur' => 'pas de réponse en 8 s'])['erreur'] === 'pas de réponse en 8 s');
v('bilan : un moteur qui rend une page (consentement, blocage) → illisible, dit', $bl($moteur, ['http' => 200, 'corps' => $kech]) === ['statut' => 'illisible', 'erreur' => 'réponse du moteur illisible (page de consentement ou de blocage ?)']);
v('bilan : un journal qui rend un flux au lieu de sa page → illisible, dit (jamais lu en RSS)', $bl($reqK, ['http' => 200, 'corps' => $rss]) === ['statut' => 'illisible', 'erreur' => 'le site a renvoyé un flux au lieu de sa page']);
v('bilan : page lue sans résultat → vide, mode « page »', $bl($reqK, ['http' => 200, 'corps' => '<!DOCTYPE html><html><body><p>لا توجد نتائج</p></body></html>']) === ['statut' => 'vide', 'n' => 0, 'mode' => 'page']);
v('nom des portes : moteur, page de recherche, page d\'accueil', cfo_vp_nom_canal($moteur) === 'Google' && cfo_vp_nom_canal($reqK) === 'page de recherche du site' && cfo_vp_nom_canal($reqH) === "page d'accueil");

/* ── D. Le réseau, pour de vrai ─────────────────────────────────────────── */
$tmp = sys_get_temp_dir() . '/veille_sans_flux_' . getmypid();
@mkdir($tmp);
file_put_contents("$tmp/rss.xml", $rss);
// servie par le faux site : liens absolus (un lien relatif se résoudrait sur 127.0.0.1, qui n'est pas Kech24)
$kechServi = str_replace("href='/2026/08/03/rocade/'", "href='https://www.kech24.com/2026/08/03/rocade/'", $kech);
file_put_contents("$tmp/page.html", $kechServi);
file_put_contents("$tmp/routeur.php", <<<'P'
<?php
$c = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if ($c === '/rss')      { header('Content-Type: application/rss+xml; charset=utf-8'); readfile(__DIR__ . '/rss.xml'); return true; }
if ($c === '/page')     { header('Content-Type: text/html; charset=utf-8'); readfile(__DIR__ . '/page.html'); return true; }
if ($c === '/redir')    { header('Location: /page', true, 302); return true; }
if ($c === '/boucle')   { header('Location: /boucle', true, 302); return true; }
if ($c === '/interdit') { http_response_code(403); echo '<html><body>Attention Required!</body></html>'; return true; }
if ($c === '/lent')     { sleep(4); echo 'trop tard'; return true; }
if ($c === '/ua')       { echo ($_SERVER['HTTP_USER_AGENT'] ?? '') . "\n" . ($_SERVER['HTTP_ACCEPT'] ?? ''); return true; }
http_response_code(404); return true;
P);
$libre = function (): int { $s = stream_socket_server('tcp://127.0.0.1:0'); $p = (int)substr(strrchr(stream_socket_get_name($s, false), ':'), 1); fclose($s); return $p; };
$port = $libre(); $ferme = $libre();
$srv = proc_open([PHP_BINARY, '-S', "127.0.0.1:$port", "$tmp/routeur.php"], [['file', '/dev/null', 'r'], ['file', '/dev/null', 'w'], ['file', '/dev/null', 'w']], $tuyaux,
                 null, ['PHP_CLI_SERVER_WORKERS' => '6', 'PATH' => getenv('PATH')]);
for ($i = 0; $i < 50 && !@fsockopen('127.0.0.1', $port); $i++) usleep(100000);
$B = "http://127.0.0.1:$port";
$R = fn(string $chemin, string $type = 'page') => ['type' => $type, 'canal' => $type === 'page' ? 'recherche' : 'moteur', 'url' => $B . $chemin] + $reqK;
try {
    $lot = [$R('/rss', 'moteur'), $R('/page'), $R('/redir'), $R('/interdit'), $R('/lent'), ['url' => "http://127.0.0.1:$ferme/"] + $R('/')];
    $t0 = microtime(true); $c = cfo_vp_telecharger($lot, 2); $dC = microtime(true) - $t0;
    $t0 = microtime(true); $f = cfo_vp_telecharger_flux($lot, 2, 20); $dF = microtime(true) - $t0;
    $resume = fn($x) => array_map(fn($y) => [$y['http'], md5($y['corps']), $y['erreur']], $x);
    v('curl et flux PHP : mêmes codes, mêmes corps, mêmes causes d\'échec', $resume(array_slice($c, 0, 4)) === $resume(array_slice($f, 0, 4)), $j([$resume($c), $resume($f)]));
    v('  → redirection suivie : la page finale (200)', $f[2]['http'] === 200 && $f[2]['corps'] === $kechServi && $c[2]['http'] === 200);
    v('  → HTTP 403 : code rendu, corps lu (pas une exception)', $f[3]['http'] === 403 && $c[3]['http'] === 403);
    v('  → trop lent : « pas de réponse en 2 s », dans les deux modes', $c[4]['erreur'] === 'pas de réponse en 2 s' && $f[4]['erreur'] === 'pas de réponse en 2 s', $j([$c[4]['erreur'], $f[4]['erreur']]));
    v('  → port fermé : « connexion refusée », dans les deux modes', $c[5]['erreur'] === 'connexion refusée' && $f[5]['erreur'] === 'connexion refusée', $j([$c[5]['erreur'], $f[5]['erreur']]));
    v('curl : en parallèle, le lot tient dans le délai de la plus lente (< 3 s)', $dC < 3.0, sprintf('%.2f s', $dC));
    v('flux PHP : les articles de la page sont lus comme avec curl', array_column(cfo_vp_bilan($lot[1], $f[1], $cfg)['articles'], 'url') === array_column(cfo_vp_bilan($lot[1], $c[1], $cfg)['articles'], 'url')
      && count(cfo_vp_bilan($lot[1], $f[1], $cfg)['articles']) === 2);
    $bc = cfo_vp_bilan($R('/boucle'), cfo_vp_telecharger([$R('/boucle')], 2)[0], $cfg); $bf = cfo_vp_bilan($R('/boucle'), cfo_vp_telecharger_flux([$R('/boucle')], 2, 20)[0], $cfg);
    v('redirections sans fin : « trop de redirections », dans les deux modes', str_starts_with($bc['erreur'] ?? '', 'trop de redirections') && str_starts_with($bf['erreur'] ?? '', 'trop de redirections'), $j([$bc, $bf]));
    $uaC = cfo_vp_telecharger([$R('/ua'), $R('/ua', 'moteur')], 2); $uaF = cfo_vp_telecharger_flux([$R('/ua'), $R('/ua', 'moteur')], 2, 20);
    v('une page de journal est demandée comme un navigateur (text/html), un moteur en RSS', str_contains($uaC[0]['corps'], 'Chrome/') && str_contains($uaC[0]['corps'], 'text/html')
      && str_contains($uaC[1]['corps'], 'compatible; FinanceMaster-Veille') && str_contains($uaC[1]['corps'], 'application/rss+xml') && $uaC[0]['corps'] === $uaF[0]['corps'] && $uaC[1]['corps'] === $uaF[1]['corps'], $j([$uaC, $uaF]));
    // le budget : sans curl, les sources passent une à une — la fin de la liste est sautée, et c'est dit
    $t0 = microtime(true); $bu = cfo_vp_telecharger_flux([$R('/lent'), $R('/lent'), $R('/page'), $R('/rss', 'moteur')], 2, 4); $dB = microtime(true) - $t0;
    v('budget de 4 s : la 1re attend 2 s, la 2e le temps qui reste (1 s)', $bu[0]['erreur'] === 'pas de réponse en 2 s' && $bu[1]['erreur'] === 'pas de réponse en 1 s', $j(array_column($bu, 'erreur')));
    v('  → les suivantes ne sont pas interrogées, et c\'est dit', !empty($bu[2]['saute']) && !empty($bu[3]['saute']) && str_starts_with($bu[3]['erreur'], 'non interrogée : temps total épuisé (4 s'), $j($bu[3]));
    v('  → le budget est tenu (< 4,2 s)', $dB < 4.2, sprintf('%.2f s', $dB));

    // un PHP SANS curl, SANS SimpleXML, SANS allow_url_fopen : chacun dit ce qui lui manque
    $v = PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION;
    file_put_contents("$tmp/sous.php", '<?php require ' . var_export(realpath(__DIR__ . '/../cfo_veille_serveur.php'), true) . ';
        $cfg = json_decode(file_get_contents(' . var_export(realpath(__DIR__ . '/../veille_sources.json'), true) . '), true);
        $req = ["type" => "page", "canal" => "recherche", "nom" => "Kech24", "q" => "واحة سيدي ابراهيم", "langue" => "ar", "url" => $argv[1] . "/page", "domaine" => "kech24.com", "specifique" => true];
        $x = cfo_vp_telecharger([$req], 2, 10)[0];
        echo json_encode(["pre" => cfo_vp_prerequis(), "x" => ["http" => $x["http"], "erreur" => $x["erreur"]], "n" => count(cfo_vp_bilan($req, $x, $cfg)["articles"]),
                          "cause" => cfo_vp_cause(99, 2), "rss" => cfo_vp_lire_rss(file_get_contents($argv[2]), ["type" => "moteur", "specifique" => true, "langue" => "fr"], $cfg)], JSON_UNESCAPED_UNICODE);');
    $sous = function (string $ini) use ($tmp, $B) {
        return json_decode((string)shell_exec(escapeshellarg(PHP_BINARY) . ' ' . $ini . ' ' . escapeshellarg("$tmp/sous.php") . ' ' . escapeshellarg($B) . ' ' . escapeshellarg("$tmp/rss.xml") . ' 2>&1'), true);
    };
    $sc = $sous('-d disable_functions=curl_init,curl_multi_init,curl_strerror');
    v('sans curl : diagnostiqué — mode « séquentiel », paquet manquant php' . $v . '-curl', ($sc['pre']['mode_reseau'] ?? '') === 'sequentiel' && ($sc['pre']['manquants'] ?? null) === ["php$v-curl"], $j($sc['pre'] ?? $sc));
    v('  → la commande exacte est donnée', ($sc['pre']['commande'] ?? '') === "sudo apt-get install -y php$v-curl && sudo systemctl restart php$v-fpm", $sc['pre']['commande'] ?? '');
    v('  → et la page est quand même lue (flux PHP) : 2 articles', ($sc['x']['http'] ?? 0) === 200 && ($sc['n'] ?? 0) === 2, $j($sc['x'] ?? null));
    v('  → une cause réseau inconnue ne plante pas sans curl_strerror', ($sc['cause'] ?? '') === 'erreur réseau (code 99)', $sc['cause'] ?? '');
    $sx = $sous('-d disable_functions=simplexml_load_string');
    v('sans SimpleXML : php' . $v . '-xml signalé, et les résultats du moteur sont lus pareil', in_array("php$v-xml", $sx['pre']['manquants'] ?? [], true)
      && $j($sx['rss'] ?? null) === $j(cfo_vp_lire_rss($rss, ['type' => 'moteur', 'specifique' => true, 'langue' => 'fr'], $cfg)) && ($sx['rss'][0]['source'] ?? '') === 'Kech24', $j($sx['rss'] ?? $sx));
    $si = $sous('-d disable_functions=curl_init,curl_multi_init -d allow_url_fopen=0');
    v('ni curl, ni allow_url_fopen : mode « impossible », et la requête le dit', ($si['pre']['mode_reseau'] ?? '') === 'impossible'
      && ($si['x']['erreur'] ?? '') === 'ni curl, ni allow_url_fopen : PHP ne peut pas joindre le web', $j($si['x'] ?? $si));
    $pc = cfo_vp_prerequis();
    v('ce PHP-ci (curl présent) : mode « parallèle »', $pc['mode_reseau'] === 'parallele' && $pc['extensions']['curl'] === true);
} finally {
    proc_terminate($srv); proc_close($srv);
    array_map('unlink', glob("$tmp/*")); @rmdir($tmp);
}

// le proxy, lu comme curl le lit : l'environnement du processus, jamais un en-tête « Proxy: » (httpoxy)
$_SERVER['HTTP_PROXY'] = 'http://evil.example:8080'; putenv('HTTP_PROXY=http://evil.example:8080');
v('un en-tête « Proxy: » (HTTP_PROXY) n\'est jamais pris pour un proxy (httpoxy)', cfo_vp_proxy('http://www.kech24.com/') === null);
putenv('HTTP_PROXY'); unset($_SERVER['HTTP_PROXY']);
putenv('http_proxy=http://10.0.0.5:3128'); putenv('https_proxy=http://10.0.0.6:3129'); putenv('no_proxy=localhost,127.0.0.1,.interne.ma');
v('http_proxy : pour http://, adresse complète dans la requête', cfo_vp_proxy('http://www.kech24.com/?s=x') === ['proxy' => 'tcp://10.0.0.5:3128', 'request_fulluri' => true]);
v('https_proxy : pour https:// (tunnel CONNECT)', cfo_vp_proxy('https://www.kech24.com/') === ['proxy' => 'tcp://10.0.0.6:3129', 'request_fulluri' => false]);
v('no_proxy : 127.0.0.1 et *.interne.ma en direct', cfo_vp_proxy('http://127.0.0.1:8080/x') === null && cfo_vp_proxy('http://news.interne.ma/') === null && cfo_vp_proxy('http://interne.ma/') === null);
foreach (['http_proxy', 'https_proxy', 'no_proxy'] as $e) putenv($e);
v('sans proxy configuré : connexion directe', cfo_vp_proxy('https://www.kech24.com/') === null);
foreach ([['php_network_getaddresses: getaddrinfo for x.invalid failed: Name or service not known', 0.1, 'site introuvable (adresse inconnue)'],
          ['file_get_contents(https://x.ma/): Failed to open stream: SSL operation failed with code 1. certificate verify failed', 0.2, 'certificat HTTPS refusé'],
          ['file_get_contents(http://x.ma/): Failed to open stream: Redirection limit reached, aborting', 0.2, 'trop de redirections'],
          ['file_get_contents(http://x.ma/): Failed to open stream: HTTP request failed!', 7.9, 'pas de réponse en 8 s'],
          ['file_get_contents(http://x.ma/): Failed to open stream: Connection reset by peer', 0.3, 'le site a coupé la connexion'],
          ['file_get_contents(http://x.ma/): Failed to open stream: étrange', 0.3, 'site injoignable (Failed to open stream: étrange)']] as [$msg, $duree, $attendu])
    v("cause en clair : « $attendu »", cfo_vp_cause_flux($msg, $duree, 8) === $attendu, cfo_vp_cause_flux($msg, $duree, 8));

/* ── E. install.sh : les extensions PHP, sans rien demander ───────────────── */
$sh = (string)file_get_contents(__DIR__ . '/../install.sh');
v('install.sh : plus aucun mot de passe écrit en dur (lu dans l\'environnement ou db_config.php)', !preg_match('/^\s*(?:export\s+)?PG_PASS="[^"$]+"/m', $sh)
  && str_contains($sh, 'PG_PASS="${PG_PASS:-}"') && str_contains($sh, 'db_config.php'));
if (function_exists('posix_geteuid') && posix_geteuid() === 0 && is_executable('/bin/bash')) {
    $bac = sys_get_temp_dir() . '/install_php_' . getmypid();
    @mkdir("$bac/bin", 0777, true);
    // faux php (version 8.3, sans curl ni pgsql tant que l'installation n'a pas eu lieu), faux apt-get, faux systemctl
    file_put_contents("$bac/bin/php", "#!/bin/bash\nif [[ \"\$1\" == \"-m\" ]]; then printf '[PHP Modules]\\nCore\\ndom\\nSimpleXML\\nmbstring\\n'; [[ -f \"$bac/installe\" ]] && printf 'curl\\npdo_pgsql\\n'; exit 0; fi\n"
        . "if [[ \"\$1\" == \"-r\" ]]; then echo -n 8.3; exit 0; fi\nexit 1\n");
    file_put_contents("$bac/bin/apt-get", "#!/bin/bash\necho \"apt-get \$*\" >> \"$bac/journal\"\n[[ \"\$*\" == *install* ]] && touch \"$bac/installe\"\nexit 0\n");
    file_put_contents("$bac/bin/systemctl", "#!/bin/bash\necho \"systemctl \$*\" >> \"$bac/journal\"\nexit 0\n");
    foreach (['php', 'apt-get', 'systemctl'] as $f) chmod("$bac/bin/$f", 0755);
    $lancer = function () use ($bac): int { exec('PATH=' . escapeshellarg("$bac/bin") . ':/usr/bin:/bin bash ' . escapeshellarg(realpath(__DIR__ . '/../install.sh')) . ' php > ' . escapeshellarg("$bac/sortie") . ' 2>&1', $o, $rc); return $rc; };
    $rc = $lancer();
    $journal = (string)@file_get_contents("$bac/journal");
    v('sudo bash install.sh php : installe exactement ce qui manque (php8.3-curl, php8.3-pgsql)', $rc === 0 && str_contains($journal, 'apt-get install -y -qq php8.3-curl php8.3-pgsql'), $journal . (string)@file_get_contents("$bac/sortie"));
    v('  → puis redémarre php8.3-fpm', str_contains($journal, 'systemctl restart php8.3-fpm'), $journal);
    v('  → sans toucher à la base ni à n8n (aucune autre étape)', !preg_match('/Permissions|PostgreSQL|docker|Docker|n8n/', (string)@file_get_contents("$bac/sortie")), (string)@file_get_contents("$bac/sortie"));
    @unlink("$bac/journal");
    v('  → relancé : rien à installer, rien à redémarrer', $lancer() === 0 && !file_exists("$bac/journal") && str_contains((string)@file_get_contents("$bac/sortie"), 'presentes'), (string)@file_get_contents("$bac/sortie"));
    array_map('unlink', array_merge(glob("$bac/bin/*"), glob("$bac/*.*"), array_filter(["$bac/journal", "$bac/sortie", "$bac/installe"], 'file_exists')));
    @rmdir("$bac/bin"); @rmdir($bac);
} else echo "  ⏭️  install.sh php : non joué (ni root, ni bash)\n";

echo "  " . str_repeat('─', 86) . "\n";
echo $ko === 0 ? "  ✅ TOUT PASSE — $n contrôles\n" : "  ❌ $ko contrôle(s) en échec sur $n\n";
exit($ko === 0 ? 0 : 1);
