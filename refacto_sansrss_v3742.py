# -*- coding: utf-8 -*-
"""
v37.42 Presse-Sans-Flux — deux constats du terrain :

  1. « L'extension curl de PHP est requise » s'affichait partout : le PHP du
     VPS n'a pas php-curl. La revue de presse et le 🧪 des sources s'arrêtaient
     net. Désormais curl est FACULTATIF : avec lui, les sources partent en
     parallèle ; sans lui, elles sont lues une à une par les flux PHP
     (file_get_contents), dans un budget de temps (budget_s), même résultat en
     plus lent. L'écran dit ce qui manque et donne la commande exacte ;
     install.sh l'installe (sudo bash install.sh php). Sans php-xml (DOM,
     SimpleXML), une lecture de secours par expressions régulières prend le
     relais.
  2. AUCUN des sites marrakchis (Kech24, Al Marrakchia, Marrakech Alaan…) n'a
     de flux RSS ouvert. Plus aucune lecture ne repose sur le RSS d'un journal.
     Pour chaque média local, quatre portes :
       • Google Actualités restreint à son site (site:kech24.com "lieu") — le
         RSS lu là est la liste de RÉSULTATS de Google, pas celui du journal ;
       • sa page de recherche (/?s=lieu), lue en HTML — jamais en RSS, même si
         le site en servait un (« &feed=rss2 » est retiré de l'adresse) ;
       • Bing Actualités restreint à son site (second moteur, lien de
         l'article extrait de l'enrobage de Bing) ;
       • sa PAGE D'ACCUEIL, lue en HTML : titres et liens du jour, gardés
         s'ils nomment le lieu du bien.
     Lecture HTML plus robuste : un <header> DANS un <article> (thèmes
     WordPress) porte le titre et n'est plus jeté avec les menus ; à défaut
     d'<article> et de titres h1-h4, les liens qui ont l'allure d'un article
     (identifiant, date, .html, long titre-adresse) sont lus.
     Le bilan par média détaille chaque porte (Google, Bing, page de
     recherche, page d'accueil), et une source non interrogée faute de temps
     le dit.
"""
import io, re, sys

def patch(F, pairs):
    src = io.open(F, encoding='utf-8').read()
    for label, a, b in pairs:
        n = src.count(a)
        if n != 1:
            print(f'✖ {F} — {label} : {n} ancre(s), 1 attendue'); sys.exit(1)
    for label, a, b in pairs: src = src.replace(a, b, 1)
    io.open(F, 'w', encoding='utf-8').write(src)
    print(f'✔ {len(pairs)} modification(s) appliquée(s) à {F}')

def fonction(src, nom):
    """Le texte d'une fonction PHP de premier niveau, docblock compris (de « /** » à la « } » de colonne 0)."""
    i = src.find('\nfunction ' + nom + '(')
    if i < 0 or src.count('\nfunction ' + nom + '(') != 1:
        print(f'✖ fonction {nom} : introuvable ou en double'); sys.exit(1)
    debut = i + 1
    avant = src[:i]
    if avant.endswith('*/'):
        debut = avant.rfind('/**')
    fin = src.find('\n}\n', i) + 3
    return src[debut:fin]

def remplacer_fonctions(F, pairs):
    src = io.open(F, encoding='utf-8').read()
    for nom, nouveau in pairs:
        ancien = fonction(src, nom)
        src = src.replace(ancien, nouveau.lstrip('\n'), 1)
    io.open(F, 'w', encoding='utf-8').write(src)
    print(f'✔ {len(pairs)} fonction(s) réécrite(s) dans {F}')

# ═══ 1. cfo_veille_lib.php ═══════════════════════════════════════════════════

REQUETES = r"""
/**
 * Les requêtes, construites ICI à partir du fichier de sources — jamais une URL
 * venue du navigateur. v37.42 : AUCUN flux RSS de journal n'est requis (les
 * sites marrakchis n'en ont pas d'ouvert). Pour chaque média local, quatre portes :
 *   1. Google Actualités restreint à son site — site:kech24.com ("واحة سيدي ابراهيم"
 *      OR "Ouahat Sidi Brahim") : le RSS lu là est la liste de RÉSULTATS de Google ;
 *   2. sa page de recherche (« /?s=lieu »), lue en HTML ;
 *   3. le moteur secondaire (Bing Actualités), restreint à son site ;
 *   4. sa page d'accueil, lue en HTML : les titres du jour qui nomment le lieu.
 * S'y ajoutent le lieu avec les sujets fonciers, la presse nationale, la zone.
 * L'ordre est celui de l'importance : sans curl, les requêtes partent une à une
 * et le budget de temps coupe la fin de la liste.
 * 'specifique' : la requête exige le lieu exact — tout article rendu le concerne.
 */
function cfo_vp_requetes(array $cfg, array $lieux, array $sujets): array {
    $moteurs = []; $secondaires = [];
    foreach ($cfg['moteurs'] ?? [] as $m) {
        if (empty($m['gabarit'])) continue;
        if (($m['role'] ?? '') === 'site') $secondaires[] = $m; else $moteurs[$m['langue'] ?? 'fr'] = $m;
    }
    // v37.40 : un média mis en pause depuis l'écran n'est pas interrogé
    $sources = array_values(array_filter($cfg['sources'] ?? [], fn($s) => ($s['actif'] ?? true) !== false && !empty($s['domaine'])));
    $locales = array_values(array_filter($sources, fn($s) => ($s['portee'] ?? '') === 'locale'));
    $sitesLocaux = cfo_vp_sites($sources, 'locale'); $nationales = cfo_vp_sites($sources, 'nationale');
    $suj = ['fr' => array_slice(array_values(array_filter($sujets, fn($s) => !cfo_vp_arabe($s))), 0, 5),
            'ar' => array_slice(array_values(array_filter($sujets, fn($s) => cfo_vp_arabe($s))), 0, 5)];
    $parLangue = ['fr' => [], 'ar' => []];
    foreach ($lieux as $l) $parLangue[cfo_vp_arabe($l) ? 'ar' : 'fr'][] = $l;
    $tousLieux = array_merge(array_slice($parLangue['ar'], 0, 2), array_slice($parLangue['fr'], 0, 2));
    $langue = fn(array $s) => ($s['langue'] ?? 'fr') === 'ar' ? 'ar' : 'fr';
    $media = fn(array $s) => ['domaine' => $s['domaine'], 'media' => $s['nom']];
    $moteur = function (string $lg, string $q, bool $specifique, string $libelle, array $plus = []) use ($moteurs): ?array {
        if (!isset($moteurs[$lg]) || trim($q) === '') return null;
        return ['type' => 'moteur', 'canal' => 'moteur', 'nom' => $moteurs[$lg]['nom'], 'libelle' => $libelle, 'q' => $q, 'langue' => $lg,
                'specifique' => $specifique, 'url' => cfo_vp_url($moteurs[$lg]['gabarit'], $q)] + $plus;
    };
    $strict = []; $theme = []; $pages = []; $second = []; $accueil = []; $zone = [];
    foreach ($locales as $s) {
        $lg = $langue($s);
        if ($tousLieux) {
            $q = 'site:' . $s['domaine'] . ' ' . cfo_vp_ou($tousLieux);
            $strict[] = $moteur(isset($moteurs[$lg]) ? $lg : ($lg === 'ar' ? 'fr' : 'ar'), $q, true, 'site:' . $s['domaine'], $media($s));
            foreach ($secondaires as $m) $second[] = ['type' => 'moteur', 'canal' => (string)($m['id'] ?? 'moteur2'), 'nom' => (string)($m['nom'] ?? 'moteur'),
                'libelle' => 'site:' . $s['domaine'], 'q' => $q, 'langue' => $lg, 'specifique' => true, 'url' => cfo_vp_url($m['gabarit'], $q)] + $media($s);
        }
        $accueil[] = ['type' => 'page', 'canal' => 'accueil', 'nom' => $s['nom'], 'libelle' => "page d'accueil", 'q' => '', 'langue' => $lg,
                      'specifique' => false, 'url' => cfo_vp_accueil($s)] + $media($s);
    }
    // La recherche du site, lue en HTML — jamais en RSS (« &feed=rss2 » est retiré)
    foreach ($sources as $s) {
        if (empty($s['flux'])) continue;
        $lg = $langue($s);
        $l = ($parLangue[$lg] ?: $parLangue[$lg === 'ar' ? 'fr' : 'ar'])[0] ?? null;
        if ($l === null) continue;
        $pages[] = ['type' => 'page', 'canal' => 'recherche', 'nom' => $s['nom'], 'libelle' => 'recherche du site', 'q' => $l, 'langue' => $lg,
                    'specifique' => true, 'url' => cfo_vp_url(cfo_vp_sans_flux($s['flux']), $l)] + $media($s);
    }
    foreach (['fr', 'ar'] as $lg) foreach (array_slice($parLangue[$lg], 0, 2) as $i => $l) {
        $g = cfo_vp_guillemets($l);
        $theme[] = $moteur($lg, trim($g . ' ' . cfo_vp_ou($suj[$lg])), true, $suj[$lg] ? 'lieu + urbanisme' : 'lieu');
        if ($i === 0 && $nationales) $theme[] = $moteur($lg, $g . ' ' . $nationales, true, 'presse nationale');
    }
    if ($suj['fr']) $zone[] = $moteur('fr', 'Marrakech ' . cfo_vp_ou($suj['fr']) . ($sitesLocaux ? ' ' . $sitesLocaux : ''), false, 'zone (Marrakech)');
    if ($suj['ar']) $zone[] = $moteur('ar', 'مراكش ' . cfo_vp_ou($suj['ar']), false, 'zone (مراكش)');
    return array_slice(array_values(array_filter(array_merge($strict, $theme, $pages, $second, $accueil, $zone))), 0, CFO_VP_MAX_REQUETES);
}

/** v37.42 : l'adresse de recherche d'un site, sans demande de flux (« &feed=rss2 », « /feed/ », « format=rss ») — on lit la PAGE. */
function cfo_vp_sans_flux(string $gabarit): string {
    $g = (string)preg_replace('/([?&])(?:feed=[^&#]*|format=(?:rss2?|atom|xml)|output=rss)(?:&|(?=#)|$)/i', '$1', $gabarit);
    $g = (string)preg_replace('#/feed(?:/(?:rss2?|atom|rdf))?/?(?=$|[?\#])#i', '/', $g);
    return rtrim($g, '?&');
}

/** v37.42 : la page d'accueil d'un média — l'hôte de sa recherche s'il en a une, sinon https://domaine/. */
function cfo_vp_accueil(array $s): string {
    $p = !empty($s['flux']) ? parse_url(str_replace('{q}', 'x', (string)$s['flux'])) : null;
    if (is_array($p) && !empty($p['host'])) return strtolower($p['scheme'] ?? 'https') . '://' . $p['host'] . (isset($p['port']) ? ':' . $p['port'] : '') . '/';
    return 'https://' . $s['domaine'] . '/';
}
"""

LIRE_RSS = r"""
/**
 * Les RÉSULTATS d'un moteur (Google Actualités, Bing Actualités — servis en RSS)
 * → articles. null si la réponse n'est pas une liste de résultats (page de
 * consentement, de blocage…) : on le dit, on ne l'invente pas. Les pages des
 * journaux, elles, ne sont jamais lues ici (v37.42) : elles passent par
 * cfo_vp_lire_html.
 */
function cfo_vp_lire_rss(string $xml, array $req, array $cfg): ?array {
    $items = cfo_vp_items_rss($xml);
    if ($items === null) return null;
    $out = [];
    foreach ($items as $it) {
        $url = cfo_vp_lien_moteur($it['lien']);
        if (!preg_match('#^https?://#i', $url)) continue;            // ni javascript:, ni data:
        $titre = trim(html_entity_decode(strip_tags($it['titre']), ENT_QUOTES, 'UTF-8'));
        $srcNom = $it['source']; $srcUrl = $it['source_url'];
        $hote = parse_url($srcUrl ?: $url, PHP_URL_HOST) ?: '';
        $media = cfo_vp_media($cfg, $hote);
        // Google Actualités suffixe le titre par « - Nom du média »
        if ($srcNom !== '' && mb_substr($titre, -mb_strlen(' - ' . $srcNom)) === ' - ' . $srcNom) $titre = trim(mb_substr($titre, 0, -mb_strlen(' - ' . $srcNom)));
        $extrait = trim((string)preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags($it['description']), ENT_QUOTES, 'UTF-8')));
        if ($srcNom !== '' && $extrait !== '' && cfo_vp_norm($extrait) === cfo_vp_norm($titre . ' ' . $srcNom)) $extrait = '';
        $ts = strtotime($it['date']) ?: null;
        if ($titre === '') continue;
        $out[] = ['titre' => $titre, 'url' => $url, 'source' => $media['nom'] ?? ($srcNom ?: ($req['nom'] ?? $hote)),
                  'domaine' => preg_replace('/^www\./', '', strtolower($hote)), 'portee' => $media['portee'] ?? 'autre',
                  'ts' => $ts, 'date' => $ts ? gmdate('Y-m-d', $ts) : null,
                  'extrait' => mb_strlen($extrait) > 280 ? rtrim(mb_substr($extrait, 0, 277)) . '…' : $extrait,
                  'specifique' => !empty($req['specifique']), 'langue' => $req['langue'] ?? 'fr'];
    }
    return $out;
}

/** v37.42 : les <item> d'une liste de résultats → champs bruts. SimpleXML s'il est là, sinon lecture de secours. */
function cfo_vp_items_rss(string $xml): ?array {
    $debut = substr(ltrim($xml), 0, 400);
    if (stripos($debut, '<rss') === false && stripos($debut, '<?xml') === false) return null;
    if (!function_exists('simplexml_load_string')) return cfo_vp_items_rss_brut($xml);       // php-xml absent
    $prec = libxml_use_internal_errors(true);
    $doc = simplexml_load_string($xml, 'SimpleXMLElement', LIBXML_NOCDATA | LIBXML_NONET);
    libxml_clear_errors(); libxml_use_internal_errors($prec);
    if ($doc === false || !isset($doc->channel)) return null;
    $out = [];
    foreach ($doc->channel->item as $it) {
        $out[] = ['titre' => (string)$it->title, 'lien' => trim((string)$it->link), 'date' => (string)$it->pubDate, 'description' => (string)$it->description,
                  'source' => trim((string)$it->source), 'source_url' => (string)($it->source['url'] ?? '')];
    }
    return $out;
}

/** La même lecture sans SimpleXML (php-xml absent du serveur). Un flux tronqué ou cassé : null. */
function cfo_vp_items_rss_brut(string $xml): ?array {
    if (!preg_match('#<channel\b.*</channel>#is', $xml)) return null;
    $champ = function (string $bloc, string $balise): string {
        if (!preg_match('#<' . $balise . '\b[^>]*>(.*?)</' . $balise . '>#is', $bloc, $m)) return '';
        if (preg_match('#^\s*<!\[CDATA\[(.*?)\]\]>\s*$#s', $m[1], $c)) return $c[1];
        return html_entity_decode($m[1], ENT_QUOTES | ENT_XML1, 'UTF-8');
    };
    $out = [];
    preg_match_all('#<item\b[^>]*>(.*?)</item>#is', $xml, $mm);
    foreach ($mm[1] as $b) {
        $su = preg_match('#<source\b[^>]*\burl\s*=\s*"([^"]*)"#i', $b, $m) ? html_entity_decode($m[1], ENT_QUOTES | ENT_XML1, 'UTF-8') : '';
        $out[] = ['titre' => $champ($b, 'title'), 'lien' => trim($champ($b, 'link')), 'date' => $champ($b, 'pubDate'), 'description' => $champ($b, 'description'),
                  'source' => trim($champ($b, 'source')), 'source_url' => $su];
    }
    return $out;
}

/** v37.42 : Bing Actualités enrobe le lien (apiclick.aspx?…&url=https%3a%2f%2f…) — on rend celui du journal. */
function cfo_vp_lien_moteur(string $lien): string {
    $p = parse_url($lien);
    if (is_array($p) && preg_match('/(^|\.)bing\.com$/i', (string)($p['host'] ?? '')) && !empty($p['query'])) {
        parse_str((string)$p['query'], $q);
        if (isset($q['url']) && is_string($q['url']) && preg_match('#^https?://#i', $q['url'])) return $q['url'];
    }
    return $lien;
}
"""

LIRE_HTML = r"""
/**
 * Une page HTML d'un journal — sa page de résultats ou sa page d'accueil —
 * → articles. null si ce n'est pas du HTML. Les articles sont les <article>
 * (WordPress et la plupart des thèmes), à défaut les liens des titres (h1-h4),
 * à défaut les liens qui ont l'allure d'un article ; une page d'accueil lit
 * les <article> ET les titres de ses blocs. Menus, en-têtes, pieds,
 * barres latérales et widgets sont retirés AVANT la lecture — sauf l'en-tête
 * d'un <article>, qui porte son titre (v37.42) ; sur une page d'accueil, les
 * blocs « widget » restent (beaucoup de thèmes y rangent la une). Ne restent
 * que les liens vers le site du média lui-même, hors pages de catégorie,
 * d'étiquette, d'auteur ou de pagination. « specifique » : seulement pour un
 * <article> d'une page de résultats (le terme est dans son titre, son h1 ou sa
 * boîte de recherche) — sinon le titre devra nommer le lieu pour être gardé.
 */
function cfo_vp_lire_html(string $html, array $req, array $cfg, string $urlPage): ?array {
    if (!preg_match('/<(?:!doctype|html|body|div|article|h[1-4])[\s>]/i', substr($html, 0, 20000))) return null;
    if (!class_exists('DOMDocument')) return cfo_vp_lire_html_brut($html, $req, $cfg, $urlPage);      // v37.42 : php-xml absent
    $doc = new DOMDocument();
    $prec = libxml_use_internal_errors(true);
    $ok = $doc->loadHTML('<?xml encoding="UTF-8">' . $html, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
    libxml_clear_errors(); libxml_use_internal_errors($prec);
    if (!$ok) return null;
    $xp = new DOMXPath($doc);
    $accueil = ($req['canal'] ?? '') === 'accueil';
    // Une PAGE DE RÉSULTATS répète le terme cherché dans son titre, son h1 ou sa boîte de recherche.
    // Le corps ne prouve rien : une page d'accueil peut citer le lieu dans un article récent.
    $terme = cfo_vp_norm((string)($req['q'] ?? ''));
    $signal = '';
    foreach ($xp->query('//title|//h1|//input[@name="s" or @type="search" or @name="q"]/@value') as $n) $signal .= ' ' . $n->textContent;
    $pageDeResultats = $terme !== '' && mb_strpos(cfo_vp_norm($signal), $terme) !== false;
    $bruit = '//script|//style|//noscript|//nav|//form|//iframe|//header[not(ancestor::article)]|//footer[not(ancestor::article)]'
           . '|//*[contains(@class,"menu") or contains(@id,"menu") or contains(@class,"breadcrumb") or contains(@class,"ticker")'
           . ' or contains(@class,"footer") or contains(@id,"footer")'
           . ($accueil ? ']' : ' or contains(@class,"sidebar") or contains(@id,"sidebar") or contains(@class,"widget") or contains(@class,"related")'
                             . ' or contains(@class,"popular") or contains(@class,"trending")]|//aside');
    foreach ($xp->query($bruit) as $n) if ($n->parentNode) $n->parentNode->removeChild($n);

    $propre = fn($t) => trim((string)preg_replace('/\s+/u', ' ', (string)$t));
    $items = []; $vus = [];
    $prendre = function ($a, $bloc, bool $dansArticle) use (&$items, &$vus, $xp, $req, $cfg, $urlPage, $pageDeResultats, $propre) {
        $titre = $propre($a->textContent);
        if ($titre === '' && $bloc) { $h = $xp->query('.//h1|.//h2|.//h3|.//h4', $bloc)->item(0); $titre = $h ? $propre($h->textContent) : ''; }
        $it = cfo_vp_article_page($a->getAttribute('href'), $titre, $req, $cfg, $urlPage);
        if ($it === null || isset($vus[$it['url']])) return;
        $vus[$it['url']] = true;
        $ts = null; $extrait = '';
        if ($bloc) {
            $t = $xp->query('.//time', $bloc)->item(0);
            if ($t) $ts = strtotime($t->getAttribute('datetime') ?: $propre($t->textContent)) ?: null;
            foreach ($xp->query('.//p', $bloc) as $p) { $x = $propre($p->textContent); if (mb_strlen($x) >= 30 && $x !== $it['titre']) { $extrait = $x; break; } }
        }
        $items[] = array_merge($it, ['ts' => $ts, 'date' => $ts ? gmdate('Y-m-d', $ts) : null,
                                     'extrait' => mb_strlen($extrait) > 280 ? rtrim(mb_substr($extrait, 0, 277)) . '…' : $extrait,
                                     'specifique' => $dansArticle && $pageDeResultats]);
    };
    foreach ($xp->query('//article') as $art) {
        $a = $xp->query('.//h1//a[@href]|.//h2//a[@href]|.//h3//a[@href]|.//h4//a[@href]', $art)->item(0);
        if (!$a) foreach ($xp->query('.//a[@href]', $art) as $x) if (mb_strlen($propre($x->textContent)) >= 15) { $a = $x; break; }
        if ($a) $prendre($a, $art, true);
    }
    // une page d'accueil mêle <article> et blocs de une : les deux sont lus (le tri ne garde que ce qui nomme le lieu)
    if (!$items || $accueil) foreach ($xp->query('//h1//a[@href]|//h2//a[@href]|//h3//a[@href]|//h4//a[@href]') as $a) {
        $bloc = $a; for ($k = 0; $k < 3 && $bloc->parentNode instanceof DOMElement && $bloc->parentNode->nodeName !== 'body'; $k++) $bloc = $bloc->parentNode;
        $prendre($a, $bloc, false);
    }
    // v37.42 : ni <article>, ni titres h1-h4 (thèmes maison) — les liens qui ont l'allure d'un article
    if (!$items) foreach ($xp->query('//a[@href]') as $a) {
        if (mb_strlen($propre($a->textContent)) >= 25 && cfo_vp_lien_article($a->getAttribute('href')))
            $prendre($a, $a->parentNode instanceof DOMElement ? $a->parentNode : null, false);
    }
    return array_slice($items, 0, $accueil ? 40 : 20);
}

/** v37.42 : un lien lu sur une page du journal → l'article (titre, lien absolu, média), ou null. */
function cfo_vp_article_page(string $href, string $titre, array $req, array $cfg, string $urlPage): ?array {
    $url = cfo_vp_absolu($href, $urlPage);
    if ($url === null) return null;
    $dom = strtolower((string)($req['domaine'] ?? ''));
    $hote = (string)preg_replace('/^www\./', '', strtolower((string)parse_url($url, PHP_URL_HOST)));
    if ($dom === '' || ($hote !== $dom && substr($hote, -strlen($dom) - 1) !== '.' . $dom)) return null;    // lien externe, publicité
    $chemin = (string)parse_url($url, PHP_URL_PATH);
    if ($chemin === '' || $chemin === '/' || preg_match('#/(category|categorie|tag|tags|author|auteur|page|feed|wp-content|wp-admin|search)(/|$)#i', $chemin)
        || preg_match('/(^|&)(s|cat|tag|paged)=/', (string)parse_url($url, PHP_URL_QUERY))) return null;
    $titre = trim((string)preg_replace('/\s+/u', ' ', $titre));
    if (mb_strlen($titre) < 15 || mb_strlen($titre) > 300) return null;
    $media = cfo_vp_media($cfg, $dom) ?? [];
    return ['titre' => $titre, 'url' => $url, 'source' => $media['nom'] ?? ($req['nom'] ?? $dom), 'domaine' => $hote,
            'portee' => $media['portee'] ?? 'autre', 'ts' => null, 'date' => null, 'extrait' => '', 'specifique' => false, 'langue' => $req['langue'] ?? 'fr'];
}

/** v37.42 : un lien qui a l'allure d'un article — identifiant chiffré, date, .html, ou long titre-adresse. */
function cfo_vp_lien_article(string $href): bool {
    $p = parse_url(html_entity_decode(trim($href), ENT_QUOTES, 'UTF-8'));
    if (!is_array($p)) return false;
    $chemin = rawurldecode((string)($p['path'] ?? ''));
    $dernier = (string)preg_replace('#^.*/#', '', rtrim($chemin, '/'));
    return (bool)preg_match('#\d{4,}|/\d{4}/\d{1,2}/|\.html?$#', $chemin)
        || (mb_strlen($dernier) >= 20 && substr_count($dernier, '-') >= 2)
        || (bool)preg_match('/(^|&)(p|id)=\d+/', (string)($p['query'] ?? ''));
}

/**
 * v37.42 : la même lecture SANS DOMDocument (php-xml absent du serveur) — les
 * liens des titres h1-h4, scripts, menus, barres latérales et formulaires
 * retirés. Moins fine : rien n'y est « spécifique », le titre doit nommer le lieu.
 */
function cfo_vp_lire_html_brut(string $html, array $req, array $cfg, string $urlPage): ?array {
    if (!preg_match('/<(?:!doctype|html|body|div|article|h[1-4])[\s>]/i', substr($html, 0, 20000))) return null;
    $h = (string)preg_replace('#<(script|style|noscript|nav|form|iframe|aside)\b.*?</\1\s*>#is', ' ', $html);
    $items = []; $vus = [];
    preg_match_all('#<h([1-4])\b[^>]*>(.*?)</h\1\s*>#is', $h, $mm);
    foreach ($mm[2] as $dedans) {
        if (!preg_match('#<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|\'([^\']*)\')[^>]*>(.*?)</a\s*>#is', $dedans, $a)) continue;
        $href = $a[1] !== '' ? $a[1] : $a[2];
        $titre = html_entity_decode(strip_tags($a[3]), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $it = cfo_vp_article_page($href, $titre, $req, $cfg, $urlPage);
        if ($it === null || isset($vus[$it['url']])) continue;
        $vus[$it['url']] = true; $items[] = $it;
    }
    return array_slice($items, 0, ($req['canal'] ?? '') === 'accueil' ? 40 : 20);
}
"""

LIRE_REPONSE = r"""
/**
 * La réponse d'une source. v37.42 : une page de journal est lue en HTML, JAMAIS
 * comme un flux RSS — même si le site en renvoyait un ; un moteur (Google, Bing)
 * est lu comme sa liste de résultats.
 */
function cfo_vp_lire_reponse(string $corps, array $req, array $cfg): array {
    if (($req['type'] ?? '') === 'page') {
        if (cfo_vp_est_flux($corps)) return ['mode' => null, 'articles' => null, 'raison' => 'flux'];
        $h = cfo_vp_lire_html($corps, $req, $cfg, (string)($req['url'] ?? ''));
        return ['mode' => $h === null ? null : 'page', 'articles' => $h];
    }
    $rss = cfo_vp_lire_rss($corps, $req, $cfg);
    return ['mode' => $rss === null ? null : 'moteur', 'articles' => $rss];
}

/** Un flux RSS / Atom (et non une page HTML) ? */
function cfo_vp_est_flux(string $corps): bool {
    $d = substr(ltrim($corps), 0, 600);
    return (bool)preg_match('/<(?:rss|feed|rdf:rdf)[\s>]/i', $d) && stripos($d, '<html') === false;
}

/** Le nom d'une porte, pour l'écran : le moteur, ou la page du journal. */
function cfo_vp_nom_canal(array $r): string {
    return ['recherche' => 'page de recherche du site', 'accueil' => "page d'accueil"][$r['canal'] ?? ''] ?? (string)($r['nom'] ?? '');
}

/** Un code HTTP d'échec, en clair. */
function cfo_vp_http_texte(int $http): string {
    if ($http === 403) return 'accès refusé par le site (HTTP 403 — protection anti-robots ?)';
    if ($http === 404) return 'page introuvable (HTTP 404)';
    if ($http === 429) return 'trop de requêtes, le site temporise (HTTP 429)';
    if ($http >= 300 && $http < 400) return "trop de redirections (HTTP $http)";
    if ($http >= 500) return "le site est en panne (HTTP $http)";
    return 'HTTP ' . $http;
}

/**
 * v37.42 : une réponse reçue → son bilan (statut, n, mode, erreur) et ses
 * articles. statut : ok | vide | illisible | erreur | saute (non interrogée,
 * temps total épuisé). Jamais d'échec muet.
 */
function cfo_vp_bilan(array $r, array $x, array $cfg): array {
    if (!empty($x['saute'])) return ['statut' => 'saute', 'erreur' => (string)($x['erreur'] ?? '') ?: 'non interrogée', 'articles' => []];
    $http = (int)($x['http'] ?? 0);
    if ($http < 200 || $http >= 300) return ['statut' => 'erreur', 'erreur' => (string)($x['erreur'] ?? '') ?: cfo_vp_http_texte($http), 'articles' => []];
    $lu = cfo_vp_lire_reponse((string)($x['corps'] ?? ''), $r, $cfg);
    if ($lu['articles'] === null) {
        $e = ($r['type'] ?? '') !== 'page' ? 'réponse du moteur illisible (page de consentement ou de blocage ?)'
           : (($lu['raison'] ?? '') === 'flux' ? "le site a renvoyé un flux au lieu de sa page" : 'page illisible (pas du HTML)');
        return ['statut' => 'illisible', 'erreur' => $e, 'articles' => []];
    }
    return ['statut' => $lu['articles'] ? 'ok' : 'vide', 'n' => count($lu['articles']), 'mode' => $lu['mode'], 'articles' => $lu['articles']];
}
"""

REQUETES_TEST = r"""
/** Tester UN média, par toutes ses portes : le moteur principal et le secondaire sur son site, sa page de recherche, sa page d'accueil. */
function cfo_vp_requetes_test(array $cfg, array $s): array {
    $lg = ($s['langue'] ?? 'fr') === 'ar' ? 'ar' : 'fr';
    $mot = $lg === 'ar' ? 'مراكش' : 'Marrakech';
    $q = 'site:' . $s['domaine'] . ' ' . $mot;
    $media = ['domaine' => $s['domaine'], 'media' => $s['nom']];
    $principal = null; $secondaires = [];
    foreach ($cfg['moteurs'] ?? [] as $m) {
        if (empty($m['gabarit'])) continue;
        if (($m['role'] ?? '') === 'site') $secondaires[] = $m;
        elseif (($m['langue'] ?? 'fr') === $lg && $principal === null) $principal = $m;
    }
    $req = [];
    if ($principal) $req[] = ['type' => 'moteur', 'canal' => 'moteur', 'nom' => $principal['nom'], 'libelle' => 'test', 'q' => $q, 'langue' => $lg,
                              'specifique' => true, 'url' => cfo_vp_url($principal['gabarit'], $q)] + $media;
    foreach ($secondaires as $m) $req[] = ['type' => 'moteur', 'canal' => (string)($m['id'] ?? 'moteur2'), 'nom' => (string)($m['nom'] ?? 'moteur'), 'libelle' => 'test',
                                           'q' => $q, 'langue' => $lg, 'specifique' => true, 'url' => cfo_vp_url($m['gabarit'], $q)] + $media;
    if (!empty($s['flux'])) $req[] = ['type' => 'page', 'canal' => 'recherche', 'nom' => $s['nom'], 'libelle' => 'test', 'q' => $mot, 'langue' => $lg,
                                      'specifique' => true, 'url' => cfo_vp_url(cfo_vp_sans_flux($s['flux']), $mot)] + $media;
    $req[] = ['type' => 'page', 'canal' => 'accueil', 'nom' => $s['nom'], 'libelle' => 'test', 'q' => '', 'langue' => $lg,
              'specifique' => false, 'url' => cfo_vp_accueil($s)] + $media;
    return $req;
}
"""

patch('cfo_veille_lib.php', [
('en-tête', """ *  Ce fichier ne fait ni requête ni écriture : construire les requêtes, lire un
 *  flux RSS, trier les articles. test_veille_presse.php le verrouille ;
 *  cfo_veille_presse.php fait les appels réseau.""",
 """ *  Ce fichier ne fait ni requête ni écriture : construire les requêtes, lire les
 *  résultats des moteurs et les pages des journaux, trier les articles.
 *  test_veille_presse.php le verrouille ; cfo_veille_presse.php fait les appels
 *  réseau. v37.42 : aucun flux RSS de journal n'est requis — ni curl, ni même
 *  php-xml (lectures de secours par expressions régulières).""",),
('plafond des requêtes', "const CFO_VP_MAX_REQUETES = 22;   // v37.41 : une requête stricte par média local",
 "const CFO_VP_MAX_REQUETES = 30;   // v37.42 : quatre portes par média local (Google, page de recherche, Bing, accueil)"),
('adresse de recherche : messages', """        if (strlen($flux) > 300 || preg_match('/\\s/', $flux) || !preg_match('#^https?://#i', $flux)) return ['erreur' => 'Flux RSS : une adresse http(s), sans espace.'];
        if (substr_count($flux, '{q}') !== 1) return ['erreur' => 'Flux RSS : {q} doit marquer, une fois, la place des mots cherchés.'];""",
 """        if (strlen($flux) > 300 || preg_match('/\\s/', $flux) || !preg_match('#^https?://#i', $flux)) return ['erreur' => 'Adresse de recherche : une adresse http(s), sans espace.'];
        if (substr_count($flux, '{q}') !== 1) return ['erreur' => 'Adresse de recherche : {q} doit marquer, une fois, la place des mots cherchés.'];"""),
('adresse de recherche : hôte', """        if (!is_array($p) || isset($p['user']) || isset($p['pass']) || isset($p['port'])) return ['erreur' => 'Flux RSS : adresse non acceptée (ni identifiants, ni port).'];
        $h = (string)preg_replace('/^www\\./', '', strtolower((string)($p['host'] ?? '')));
        if ($h !== $dom && substr($h, -strlen($dom) - 1) !== '.' . $dom) return ['erreur' => "Flux RSS : il doit être sur le site du média ($dom), pas sur « $h »."];""",
 """        if (!is_array($p) || isset($p['user']) || isset($p['pass']) || isset($p['port'])) return ['erreur' => 'Adresse de recherche : non acceptée (ni identifiants, ni port).'];
        $h = (string)preg_replace('/^www\\./', '', strtolower((string)($p['host'] ?? '')));
        if ($h !== $dom && substr($h, -strlen($dom) - 1) !== '.' . $dom) return ['erreur' => "Adresse de recherche : elle doit être sur le site du média ($dom), pas sur « $h »."];"""),
])

remplacer_fonctions('cfo_veille_lib.php', [
    ('cfo_vp_requetes', REQUETES),
    ('cfo_vp_lire_rss', LIRE_RSS),
    ('cfo_vp_lire_html', LIRE_HTML),
    ('cfo_vp_lire_reponse', LIRE_REPONSE),
    ('cfo_vp_requetes_test', REQUETES_TEST),
])
patch('cfo_veille_lib.php', [
('titre de section', "/* ══ v37.41 — LA PAGE DE RÉSULTATS, QUAND LE SITE N'A PAS DE RSS ═════════════ */",
 "/* ══ v37.41-42 — LES PAGES DES JOURNAUX, LUES EN HTML (AUCUN N'A DE RSS OUVERT) ═ */"),
])

# ═══ 2. cfo_veille_serveur.php ═══════════════════════════════════════════════

TELECHARGER = r"""
/**
 * v37.42 : toutes les requêtes. Avec curl : en parallèle, le délai total est
 * celui de la plus lente. SANS curl (php-curl absent du VPS) : une à une par
 * les flux PHP, dans un budget de temps — la fin de la liste, la moins
 * importante, est alors « non interrogée », et c'est dit.
 * [i => ['corps', 'http', 'erreur', 'saute'?]]
 */
function cfo_vp_telecharger(array $requetes, int $delai, int $budget = 20): array {
    if (!function_exists('curl_multi_init') || !function_exists('curl_init')) return cfo_vp_telecharger_flux($requetes, $delai, $budget);
    $mh = curl_multi_init(); $poignees = []; $out = [];
    foreach ($requetes as $i => $r) {
        $ch = curl_init($r['url']);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 4,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS, CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_TIMEOUT => $delai, CURLOPT_CONNECTTIMEOUT => min(5, $delai), CURLOPT_ENCODING => '',
            CURLOPT_HTTPHEADER => cfo_vp_entetes($r)]);
        curl_multi_add_handle($mh, $ch); $poignees[$i] = $ch;
    }
    // En mode parallèle, curl_error() reste vide : la cause se lit dans curl_multi_info_read.
    $codes = [];
    do {
        $st = curl_multi_exec($mh, $actifs);
        while ($info = curl_multi_info_read($mh)) $codes[spl_object_id($info['handle'])] = (int)$info['result'];
        if ($actifs) curl_multi_select($mh, 1.0);
    } while ($actifs && $st === CURLM_OK);
    while ($info = curl_multi_info_read($mh)) $codes[spl_object_id($info['handle'])] = (int)$info['result'];
    foreach ($poignees as $i => $ch) {
        $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $code = $codes[spl_object_id($ch)] ?? 0;
        $err = $code ? cfo_vp_cause($code, $delai) : (curl_error($ch) ?: ($http === 0 ? 'site injoignable' : ''));
        $out[$i] = ['corps' => (string)curl_multi_getcontent($ch), 'http' => $http, 'erreur' => $err];
        curl_multi_remove_handle($mh, $ch); curl_close($ch);
    }
    curl_multi_close($mh);
    return $out;
}

/** v37.42 : les en-têtes d'une requête — une page de journal est demandée comme le ferait un navigateur. */
function cfo_vp_entetes(array $r): array {
    return ($r['type'] ?? '') === 'page'
        ? ['User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 FinanceMaster-Veille/1.0',
           'Accept: text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', 'Accept-Language: ar,fr;q=0.9,en;q=0.5']
        : ['User-Agent: Mozilla/5.0 (compatible; FinanceMaster-Veille/1.0)',
           'Accept: application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5', 'Accept-Language: fr,ar;q=0.9'];
}

/** v37.42 : sans curl — une requête après l'autre, chacune bornée par le temps qui reste. */
function cfo_vp_telecharger_flux(array $requetes, int $delai, int $budget): array {
    $out = []; $debut = microtime(true);
    foreach ($requetes as $i => $r) {
        $reste = $budget - (microtime(true) - $debut);
        if (!ini_get('allow_url_fopen')) { $out[$i] = ['corps' => '', 'http' => 0, 'erreur' => 'ni curl, ni allow_url_fopen : PHP ne peut pas joindre le web']; continue; }
        if ($reste < 1.0) { $out[$i] = ['corps' => '', 'http' => 0, 'saute' => true,
                                        'erreur' => "non interrogée : temps total épuisé ($budget s — sans curl, les sources passent une à une)"]; continue; }
        $out[$i] = cfo_vp_lire_url($r, max(1, min($delai, (int)floor($reste))));
    }
    return $out;
}

/** Une adresse lue par les flux PHP : code HTTP final (redirections suivies), corps, cause d'un échec en clair. */
function cfo_vp_lire_url(array $r, int $delai): array {
    $url = (string)$r['url'];
    $http = ['method' => 'GET', 'timeout' => $delai, 'follow_location' => 1, 'max_redirects' => 5, 'ignore_errors' => true,
             'protocol_version' => 1.1, 'header' => implode("\r\n", array_merge(cfo_vp_entetes($r), ['Connection: close']))] + (cfo_vp_proxy($url) ?? []);
    $ctx = stream_context_create(['http' => $http, 'ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
    $prec = ini_set('default_socket_timeout', (string)$delai);
    $msg = '';
    set_error_handler(function (int $no, string $m) use (&$msg): bool { $msg = $m; return true; });
    $t0 = microtime(true);
    try { $corps = file_get_contents($url, false, $ctx, 0, 4000000); }
    finally { restore_error_handler(); if ($prec !== false) ini_set('default_socket_timeout', $prec); }
    $duree = microtime(true) - $t0;
    $entetes = function_exists('http_get_last_response_headers') ? (http_get_last_response_headers() ?? []) : ($http_response_header ?? []);
    $code = 0;
    foreach ((array)$entetes as $l) if (preg_match('#^HTTP/\S+\s+(\d{3})#', (string)$l, $m)) $code = (int)$m[1];
    return ['corps' => is_string($corps) ? $corps : '', 'http' => $code, 'erreur' => $code ? '' : cfo_vp_cause_flux($msg, $duree, $delai)];
}

/** La cause d'un échec des flux PHP, en clair — les mêmes mots qu'avec curl. */
function cfo_vp_cause_flux(string $msg, float $duree, int $delai): string {
    $m = strtolower($msg);
    if (str_contains($m, 'timed out') || $duree >= $delai - 0.25) return "pas de réponse en $delai s";
    if (preg_match('/getaddrinfo|name or service not known|no address associated|name resolution/', $m)) return 'site introuvable (adresse inconnue)';
    if (str_contains($m, 'refused')) return 'connexion refusée';
    if (preg_match('/ssl|certificate|crypto/', $m)) return 'certificat HTTPS refusé';
    if (str_contains($m, 'redirection limit')) return 'trop de redirections';
    if (str_contains($m, 'reset') || str_contains($m, 'broken pipe')) return 'le site a coupé la connexion';
    $detail = trim((string)preg_replace('/^.*?\):\s*/', '', $msg));
    return 'site injoignable' . ($detail !== '' ? ' (' . mb_substr($detail, 0, 120) . ')' : '');
}

/**
 * Le mandataire (proxy) de sortie, comme curl le lit : http_proxy / https_proxy /
 * no_proxy de l'environnement du PROCESSUS seulement (jamais un en-tête « Proxy: »
 * d'une requête — httpoxy). Sans proxy configuré : null, connexion directe.
 */
function cfo_vp_proxy(string $url): ?array {
    $p = parse_url($url);
    $sch = strtolower((string)($p['scheme'] ?? '')); $h = strtolower((string)($p['host'] ?? ''));
    $px = getenv($sch === 'https' ? 'https_proxy' : 'http_proxy', true);
    if (!is_string($px) || $px === '' || $h === '') return null;
    foreach (explode(',', strtolower((string)getenv('no_proxy', true))) as $np) {
        $np = ltrim(trim($np), '.');
        if ($np !== '' && ($np === '*' || $h === $np || substr($h, -strlen($np) - 1) === '.' . $np)) return null;
    }
    $u = parse_url($px);
    if (!is_array($u) || empty($u['host'])) return null;
    return ['proxy' => 'tcp://' . $u['host'] . ':' . ($u['port'] ?? 80), 'request_fulluri' => $sch === 'http'];
}

/**
 * v37.42 : ce que le PHP du serveur sait faire, et ce qui lui manque — avec la
 * commande exacte pour l'installer. mode_reseau : parallele (curl) |
 * sequentiel (flux PHP, plus lent) | impossible (ni curl, ni allow_url_fopen).
 */
function cfo_vp_prerequis(): array {
    $v = PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION;
    $e = ['curl' => function_exists('curl_multi_init') && function_exists('curl_init'), 'dom' => class_exists('DOMDocument'),
          'simplexml' => function_exists('simplexml_load_string'), 'mbstring' => function_exists('mb_strtolower'),
          'openssl' => extension_loaded('openssl'), 'allow_url_fopen' => (bool)ini_get('allow_url_fopen'), 'pdo_pgsql' => extension_loaded('pdo_pgsql')];
    $paquets = ['curl' => "php$v-curl", 'dom' => "php$v-xml", 'simplexml' => "php$v-xml", 'mbstring' => "php$v-mbstring", 'pdo_pgsql' => "php$v-pgsql"];
    $manquants = [];
    foreach ($paquets as $ext => $paquet) if (!$e[$ext] && !in_array($paquet, $manquants, true)) $manquants[] = $paquet;
    return ['php' => $v, 'extensions' => $e, 'manquants' => $manquants,
            'mode_reseau' => $e['curl'] ? 'parallele' : ($e['allow_url_fopen'] ? 'sequentiel' : 'impossible'),
            'commande' => $manquants ? 'sudo apt-get install -y ' . implode(' ', $manquants) . " && sudo systemctl restart php$v-fpm" : ''];
}
"""

patch('cfo_veille_serveur.php', [
('en-tête', """ *  • cfo_vp_telecharger : toutes les requêtes en parallèle, délai borné.""",
 """ *  • cfo_vp_telecharger : toutes les requêtes en parallèle (curl), délai borné ;
 *    v37.42 : sans curl, une à une par les flux PHP, dans un budget de temps.
 *  • cfo_vp_prerequis : ce qui manque au PHP du serveur, et la commande exacte."""),
('cause : sans curl', """        default: return 'erreur réseau (' . curl_strerror($code) . ')';""",
 """        default: return 'erreur réseau (' . (function_exists('curl_strerror') ? curl_strerror($code) : 'code ' . $code) . ')';"""),
])
remplacer_fonctions('cfo_veille_serveur.php', [('cfo_vp_telecharger', TELECHARGER)])

# ═══ 3. cfo_veille_presse.php ════════════════════════════════════════════════

patch('cfo_veille_presse.php', [
('en-tête', """ *  Une source qui ne répond pas, ou qui ne parle pas RSS, est comptée et dite
 *  (« diagnostic ») — jamais remplacée par du contenu inventé.""",
 """ *  Une source qui ne répond pas, ou qui ne parle pas RSS, est comptée et dite
 *  (« diagnostic ») — jamais remplacée par du contenu inventé.
 *
 *  v37.42 : aucun flux RSS de journal n'est lu (ils n'en ont pas d'ouvert) :
 *  Google et Bing Actualités restreints au site, sa page de recherche et sa
 *  page d'accueil lues en HTML. curl n'est plus requis : sans lui, les
 *  sources passent une à une, dans un budget de temps (budget_s)."""),
('curl facultatif', """if (!function_exists('curl_multi_init')) vp_sortie(['status' => 'error', 'error' => 'CURL_ABSENT', 'message' => "L'extension curl de PHP est requise (apt install php-curl)."], 503);""",
 """// v37.42 : curl n'est plus requis — sans lui, les sources sont lues une à une (plus lent, même résultat)
$reseau = cfo_vp_prerequis();
if ($reseau['mode_reseau'] === 'impossible') vp_sortie(['status' => 'error', 'error' => 'RESEAU_IMPOSSIBLE', 'commande' => $reseau['commande'],
    'message' => 'Le PHP du serveur ne peut pas joindre le web (ni curl, ni allow_url_fopen). Sur le VPS : ' . ($reseau['commande'] ?: 'activer allow_url_fopen')], 503);"""),
('budget', """$delai = max(2, min(20, (int)($cfg['delai_s'] ?? 8)));""",
 """$delai = max(2, min(20, (int)($cfg['delai_s'] ?? 8)));
$budget = max(5, min(25, (int)($cfg['budget_s'] ?? 20)));"""),
('téléchargement', """/* ── Toutes les requêtes en parallèle : le délai total est celui de la plus lente ── */
$reponses = cfo_vp_telecharger($requetes, $delai);""",
 """/* ── Avec curl, toutes en parallèle (le délai total est celui de la plus lente) ; sans curl, une à une ── */
$reponses = cfo_vp_telecharger($requetes, $delai, $budget);"""),
('bilan par porte', """    $corpsR = $reponses[$i]['corps']; $code = $reponses[$i]['http']; $err = $reponses[$i]['erreur'];
    $d = ['source' => $r['nom'], 'libelle' => $r['libelle'], 'q' => $r['q'], 'http' => $code];
    if ($code < 200 || $code >= 300) { $d['statut'] = 'erreur'; $d['erreur'] = $err ?: ('HTTP ' . $code); }
    else {
        // v37.41 : RSS s'il y en a un ; sinon, pour la recherche d'un site, sa page HTML de résultats
        $lu = cfo_vp_lire_reponse($corpsR, $r, $cfg);
        if ($lu['articles'] === null) { $d['statut'] = 'illisible'; $d['erreur'] = $r['type'] === 'flux' ? 'ni RSS, ni page de résultats lisible' : 'pas un flux RSS'; }
        else { $d['statut'] = $lu['articles'] ? 'ok' : 'vide'; $d['n'] = count($lu['articles']); $d['mode'] = $lu['mode']; array_push($articles, ...$lu['articles']); }
    }
    $diag[] = $d;
    // v37.41 : le bilan de chaque média local — jamais d'échec silencieux
    if (!empty($r['domaine'])) {
        $couverture[$r['domaine']]['nom'] = $r['media'] ?? $r['nom'];
        $couverture[$r['domaine']]['domaine'] = $r['domaine'];
        $couverture[$r['domaine']][$r['type'] === 'flux' ? 'site' : 'google'] = array_intersect_key($d, array_flip(['statut', 'n', 'mode', 'erreur']));
    }""",
 """    // v37.42 : un moteur est lu comme sa liste de résultats, une page de journal en HTML — jamais un RSS de journal
    $b = cfo_vp_bilan($r, $reponses[$i], $cfg);
    array_push($articles, ...$b['articles']); unset($b['articles']);
    $d = ['source' => $r['nom'], 'canal' => $r['canal'], 'libelle' => $r['libelle'], 'q' => $r['q'], 'http' => $reponses[$i]['http']] + $b;
    $diag[] = $d;
    // v37.41-42 : le bilan de chaque média local, porte par porte — jamais d'échec silencieux
    if (!empty($r['domaine'])) {
        $couverture[$r['domaine']]['nom'] = $r['media'] ?? $r['nom'];
        $couverture[$r['domaine']]['domaine'] = $r['domaine'];
        $couverture[$r['domaine']]['canaux'][] = ['canal' => $r['canal'], 'nom' => cfo_vp_nom_canal($r)] + array_intersect_key($b, array_flip(['statut', 'n', 'mode', 'erreur']));
    }"""),
('compteurs', """    'sources_ko' => count(array_filter($diag, fn($d) => !in_array($d['statut'], ['ok', 'vide'], true))),""",
 """    'sources_ko' => count(array_filter($diag, fn($d) => in_array($d['statut'], ['erreur', 'illisible'], true))),
    'sources_sautees' => count(array_filter($diag, fn($d) => $d['statut'] === 'saute')),
    'reseau' => array_intersect_key($reseau, array_flip(['mode_reseau', 'manquants', 'commande'])),"""),
])

# ═══ 4. cfo_veille_sources.php ═══════════════════════════════════════════════

patch('cfo_veille_sources.php', [
('en-tête : tester', """ *  POST {action:"tester", source}        → interroge ce média maintenant (Google + flux)""",
 """ *  POST {action:"tester", source}        → interroge ce média maintenant, par toutes ses
 *                                          portes : Google, Bing, sa page de recherche, sa page d'accueil"""),
('en-tête : contrôle', """ *  localhost), un flux RSS éventuel situé SUR ce domaine et marquant {q}.""",
 """ *  localhost), une adresse de recherche éventuelle située SUR ce domaine et
 *  marquant {q}. v37.42 : curl facultatif — GET dit ce qui manque au PHP.""",),
('état : prérequis', """            'raison' => $c['raison'], 'maj' => $c['maj'], 'max' => CFO_VP_MAX_SOURCES];""",
 """            'raison' => $c['raison'], 'maj' => $c['maj'], 'max' => CFO_VP_MAX_SOURCES, 'prerequis' => cfo_vp_prerequis()];"""),
('tester : toutes les portes', """    if (!function_exists('curl_multi_init')) vs_sortie(['status' => 'error', 'error' => 'CURL_ABSENT', 'message' => "L'extension curl de PHP est requise."], 503);
    $s = $v['source'];
    $cfg = $def; $cfg['sources'] = [$s];
    $req = cfo_vp_requetes_test($cfg, $s);
    $rep = cfo_vp_telecharger($req, max(2, min(20, (int)($def['delai_s'] ?? 8))));
    $res = [];
    foreach ($req as $i => $r) {
        $x = $rep[$i];
        $d = ['canal' => $r['type'] === 'flux' ? 'flux' : 'google', 'q' => $r['q']];
        if ($x['http'] < 200 || $x['http'] >= 300) { $d += ['statut' => 'erreur', 'erreur' => $x['erreur'] ?: ('HTTP ' . $x['http'])]; }
        else {
            $lu = cfo_vp_lire_reponse($x['corps'], $r, $cfg);     // v37.41 : RSS, sinon la page de résultats
            $lus = $lu['articles'];
            if ($lus === null) $d += ['statut' => 'illisible', 'erreur' => $r['type'] === 'flux' ? 'ni RSS, ni page de résultats lisible' : 'pas un flux RSS'];
            else {
                usort($lus, fn($a, $b) => ($b['ts'] ?? 0) <=> ($a['ts'] ?? 0));
                $d += ['statut' => $lus ? 'ok' : 'vide', 'n' => count($lus), 'mode' => $lu['mode'],
                       'exemple' => $lus ? ['titre' => $lus[0]['titre'], 'date' => $lus[0]['date']] : null];
            }
        }
        $res[$d['canal']] = $d;
    }
    vs_sortie(['status' => 'ok', 'domaine' => $s['domaine'], 'google' => $res['google'] ?? null, 'flux' => $res['flux'] ?? null]);""",
 """    // v37.42 : curl facultatif ; chaque porte du média est essayée et son résultat dit en clair
    $pre = cfo_vp_prerequis();
    if ($pre['mode_reseau'] === 'impossible') vs_sortie(['status' => 'error', 'error' => 'RESEAU_IMPOSSIBLE', 'commande' => $pre['commande'],
        'message' => 'Le PHP du serveur ne peut pas joindre le web (ni curl, ni allow_url_fopen).'], 503);
    $s = $v['source'];
    $cfg = $def; $cfg['sources'] = [$s];
    $req = cfo_vp_requetes_test($cfg, $s);
    $rep = cfo_vp_telecharger($req, max(2, min(20, (int)($def['delai_s'] ?? 8))), max(5, min(25, (int)($def['budget_s'] ?? 20))));
    $canaux = [];
    foreach ($req as $i => $r) {
        $b = cfo_vp_bilan($r, $rep[$i], $cfg);
        $lus = $b['articles']; unset($b['articles']);
        usort($lus, fn($x, $y) => ($y['ts'] ?? 0) <=> ($x['ts'] ?? 0));
        $canaux[] = ['canal' => $r['canal'], 'nom' => cfo_vp_nom_canal($r), 'q' => $r['q']] + $b
                  + ['exemple' => $lus ? ['titre' => $lus[0]['titre'], 'date' => $lus[0]['date']] : null];
    }
    vs_sortie(['status' => 'ok', 'domaine' => $s['domaine'], 'canaux' => $canaux, 'mode_reseau' => $pre['mode_reseau']]);"""),
])

# ═══ 5. veille_sources.json ══════════════════════════════════════════════════

patch('veille_sources.json', [
('doc', """  "_doc": "v37.39 — Sources de la revue de presse de la Recherche Éclair (cfo_veille_presse.php). Modifiable sans toucher au code : ajouter un média = ajouter une ligne. 'portee' : locale (Marrakech) ou nationale. 'flux' (facultatif) : la recherche du site, {q} = termes recherchés — son RSS s'il est ouvert, sinon sa page de résultats, lue en HTML (v37.41 : la plupart des sites marrakchis n'ont pas de RSS ouvert). Chaque média local a en plus sa requête stricte Google Actualités (site:domaine). Les URL ne viennent JAMAIS du navigateur : seul ce fichier les définit.",""",
 """  "_doc": "v37.42 — Sources de la revue de presse de la Recherche Éclair (cfo_veille_presse.php). Modifiable sans toucher au code : ajouter un média = ajouter une ligne. 'portee' : locale (Marrakech) ou nationale. AUCUN flux RSS de journal n'est lu : les sites marrakchis n'en ont pas d'ouvert. Chaque média local est cherché par quatre portes : Google Actualités restreint à son site (site:domaine — le RSS lu là est la liste de RÉSULTATS de Google, pas celui du journal), Bing Actualités restreint à son site (moteur 'role': 'site'), sa page de recherche et sa page d'accueil, lues en HTML (titres et liens). 'flux' (nom historique, facultatif) : l'adresse de la page de recherche du site, {q} = termes recherchés. 'delai_s' : délai par requête ; 'budget_s' : temps total quand curl est absent (les requêtes passent alors une à une). Les URL ne viennent JAMAIS du navigateur : seul ce fichier les définit.","""),
('budget', """  "delai_s": 8,""", """  "delai_s": 8,
  "budget_s": 20,"""),
('Bing', """    { "id": "gnews_ar", "nom": "Google Actualités (AR)", "langue": "ar", "gabarit": "https://news.google.com/rss/search?q={q}&hl=ar&gl=MA&ceid=MA:ar" }""",
 """    { "id": "gnews_ar", "nom": "Google Actualités (AR)", "langue": "ar", "gabarit": "https://news.google.com/rss/search?q={q}&hl=ar&gl=MA&ceid=MA:ar" },
    { "id": "bing",     "nom": "Bing Actualités",        "langue": "*",  "role": "site", "gabarit": "https://www.bing.com/news/search?q={q}&format=rss&cc=MA" }"""),
])

# ═══ 6. index.html ═══════════════════════════════════════════════════════════

patch('index.html', [
('écran : prérequis du serveur', """                    <div v-if="veilleSources.erreur" data-vs-erreur class="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 font-bold">⛔ {{ veilleSources.erreur }}</div>""",
 """                    <!-- v37.42 : ce qui manque au PHP du serveur, et la commande exacte pour l'installer -->
                    <div v-if="veilleSources.prerequis && veilleSources.prerequis.manquants && veilleSources.prerequis.manquants.length && !veilleSources.chargement" data-vs-prerequis
                         class="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 font-bold space-y-1">
                        <p>⚙️ Il manque au PHP du serveur : {{ veilleSources.prerequis.manquants.join(', ') }}.
                           {{ veilleSources.prerequis.mode_reseau === 'sequentiel' ? "La revue de presse fonctionne quand même, en mode lent : les sources passent une à une au lieu d'être interrogées ensemble."
                              : (veilleSources.prerequis.mode_reseau === 'impossible' ? 'Le serveur ne peut pas joindre le web : la revue de presse est à l\\'arrêt.' : 'La revue de presse fonctionne.') }}</p>
                        <p class="font-normal">À lancer une fois sur le VPS (ou <code>sudo bash install.sh php</code>) :</p>
                        <code data-vs-commande class="block p-2 bg-white border border-amber-200 rounded-lg font-mono text-[11px] text-slate-800 select-all break-all">{{ veilleSources.prerequis.commande }}</code>
                    </div>
                    <div v-if="veilleSources.erreur" data-vs-erreur class="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 font-bold">⛔ {{ veilleSources.erreur }}</div>"""),
('écran : case WordPress', """                            <span>Le site a une recherche WordPress (<code>/?s=…</code>) — la lire directement : son RSS s'il est ouvert, sinon sa page de résultats</span>""",
 """                            <span>Le site a une recherche WordPress (<code>/?s=…</code>) — lire sa page de résultats (en HTML : aucun RSS n'est nécessaire)</span>"""),
('écran : champ de recherche', """Adresse de recherche du site (facultatif — RSS ou page de résultats ; {q} = les mots cherchés)
                            <input v-model="veilleSources.form.flux" data-vs-flux type="text" placeholder="ex. https://www.exemple.ma/recherche?q={q}&amp;format=rss\"""",
 """Adresse de la page de recherche du site (facultatif — lue en HTML ; {q} = les mots cherchés)
                            <input v-model="veilleSources.form.flux" data-vs-flux type="text" placeholder="ex. https://www.exemple.ma/recherche?q={q}\""""),
('écran : portes', """                        <p class="text-[10px] text-slate-500 font-bold">Avec ou sans flux, le média est interrogé via Google Actualités, restreint à son site.</p>""",
 """                        <p class="text-[10px] text-slate-500 font-bold">Sans rien de plus, le média est cherché par Google Actualités et Bing Actualités restreints à son site ; un média local voit aussi sa page d'accueil lue. Aucun flux RSS n'est nécessaire.</p>"""),
('écran : résultat du test, porte par porte', """                                                <p v-for="c in [veilleSources.tests[s.domaine].google, veilleSources.tests[s.domaine].flux].filter(Boolean)" :key="c.canal" :data-vs-canal="c.canal"
                                                   :class="c.statut === 'ok' ? 'text-emerald-700' : (c.statut === 'vide' ? 'text-slate-500' : 'text-red-600')">
                                                    {{ c.statut === 'ok' ? '✅' : (c.statut === 'vide' ? '⚪' : '❌') }} {{ c.canal === 'flux' ? 'Recherche du site' + (c.mode === 'page' ? ' (page web, sans RSS)' : (c.mode === 'rss' ? ' (RSS)' : '')) : 'Google Actualités' }} :
                                                    {{ c.statut === 'ok' ? c.n + ' article' + (c.n > 1 ? 's' : '') + (c.exemple ? ' — dernier : « ' + c.exemple.titre + ' »' + (c.exemple.date ? ' (' + c.exemple.date + ')' : '') : '')
                                                       : (c.statut === 'vide' ? 'aucun article trouvé sur ce site' : (c.statut === 'illisible' ? 'ni RSS, ni page de résultats lisible' : c.erreur)) }}
                                                </p>""",
 """                                                <p v-for="c in (veilleSources.tests[s.domaine].canaux || [])" :key="c.canal" :data-vs-canal="c.canal"
                                                   :class="c.statut === 'ok' ? 'text-emerald-700' : (c.statut === 'vide' ? 'text-slate-500' : 'text-red-600')">
                                                    {{ c.statut === 'ok' ? '✅' : (c.statut === 'vide' ? '⚪' : '❌') }} {{ String(c.nom || c.canal || '').charAt(0).toUpperCase() + String(c.nom || c.canal || '').slice(1) }}{{ c.mode === 'page' ? ' (lue en HTML)' : '' }} :
                                                    {{ c.statut === 'ok' ? c.n + (c.canal === 'accueil' ? ' titre' + (c.n > 1 ? 's' : '') + ' à la une' : ' article' + (c.n > 1 ? 's' : '')) + (c.exemple ? (c.canal === 'accueil' ? ' — en tête : « ' : ' — dernier : « ') + c.exemple.titre + ' »' + (c.exemple.date ? ' (' + c.exemple.date + ')' : '') : '')
                                                       : (c.statut === 'vide' ? (c.canal === 'accueil' ? 'aucun titre lisible' : 'aucun article trouvé sur ce site') : c.erreur) }}
                                                </p>"""),
('carte : mode lent', """source{{ mi.contexte.presse.ko > 1 ? 's' : '' }} injoignable{{ mi.contexte.presse.ko > 1 ? 's' : '' }}</span>
                                                        </span>""",
 """source{{ mi.contexte.presse.ko > 1 ? 's' : '' }} injoignable{{ mi.contexte.presse.ko > 1 ? 's' : '' }}</span><span v-if="mi.contexte.presse.lent" data-mi-presse-lent class="text-slate-400 font-normal" :title="mi.contexte.presse.commande"> · mode lent : curl absent du serveur{{ mi.contexte.presse.sautees ? ', ' + mi.contexte.presse.sautees + ' non interrogée' + (mi.contexte.presse.sautees > 1 ? 's' : '') + ' faute de temps' : '' }}</span>
                                                        </span>"""),
('revue : bilan initial', """                        const p = { ok: false, articles: [], lieux, requetes: 0, ko: 0, medias: [], couverture: [], erreur: '' };""",
 """                        const p = { ok: false, articles: [], lieux, requetes: 0, ko: 0, medias: [], couverture: [], lent: false, sautees: 0, commande: '', erreur: '' };"""),
('revue : bilan par porte', """                            // v37.41 : le bilan de chaque média local, en clair — jamais d'échec silencieux
                            p.couverture = (d.couverture || []).map(c => {
                                const g = c.google, s = c.site, n = (x) => x.n + ' article' + (x.n > 1 ? 's' : '');
                                const tg = !g ? '—' : (g.statut === 'ok' ? n(g) : (g.statut === 'vide' ? 'aucun article' : 'échec (' + (g.erreur || g.statut) + ')'));
                                const ts = !s ? 'pas de recherche configurée'
                                    : (s.statut === 'ok' ? (s.mode === 'page' ? 'page de résultats lue, sans RSS' : 'RSS lu') + ' — ' + n(s)
                                    : (s.statut === 'vide' ? (s.mode === 'page' ? 'page lue, rien sur ce lieu' : 'RSS lu, rien sur ce lieu')
                                    : 'fermée ou injoignable (' + (s.erreur || s.statut) + ')'));
                                return { nom: String(c.nom || c.domaine || ''), domaine: String(c.domaine || ''), retenus: Number(c.retenus) || 0,
                                         texte: 'Google « site:' + c.domaine + ' » : ' + tg + ' · recherche du site : ' + ts };
                            });""",
 """                            // v37.42 : sans curl sur le serveur, les sources passent une à une — c'est dit
                            p.lent = !!(d.reseau && d.reseau.mode_reseau === 'sequentiel'); p.sautees = d.sources_sautees || 0;
                            p.commande = String((d.reseau && d.reseau.commande) || '');
                            // v37.41-42 : le bilan de chaque média local, porte par porte (Google, Bing, page de recherche,
                            //   page d'accueil) — jamais d'échec silencieux
                            p.couverture = (d.couverture || []).map(c => {
                                const n = (x, mot) => x.n + ' ' + mot + (x.n > 1 ? 's' : '');
                                const t = (x) => x.statut === 'ok' ? (x.canal === 'accueil' ? n(x, 'titre') + ' lu' + (x.n > 1 ? 's' : '') + ' à la une'
                                                                      : n(x, x.canal === 'recherche' ? 'résultat' : 'article') + (x.canal === 'recherche' ? ' (page lue, sans RSS)' : ''))
                                    : x.statut === 'vide' ? (x.canal === 'accueil' ? 'page lue, aucun titre' : (x.canal === 'recherche' ? 'page lue, aucun résultat' : 'aucun article'))
                                    : x.statut === 'saute' ? 'non interrogée (temps épuisé)'
                                    : 'échec (' + (x.erreur || x.statut) + ')';
                                return { nom: String(c.nom || c.domaine || ''), domaine: String(c.domaine || ''), retenus: Number(c.retenus) || 0,
                                         texte: (c.canaux || []).map(x => String(x.nom || x.canal) + ' : ' + t(x)).join(' · ') };
                            });"""),
('sources : prérequis', """                                                     stockage: '', raison: '', maj: '', liste: [], supprimees: [], form: null, tests: {} });""",
 """                                                     stockage: '', raison: '', maj: '', liste: [], supprimees: [], form: null, tests: {}, prerequis: null });"""),
('sources : WordPress', """                    //  v37.41 : la page de recherche WordPress — lue en RSS si le site en sert un, en HTML sinon""",
 """                    //  v37.41-42 : la page de recherche WordPress — lue en HTML (aucun RSS n'est demandé)"""),
('sources : appliquer', """                                                                               stockage: d.stockage || '', raison: d.raison || '', maj: d.maj || '' });""",
 """                                                                               stockage: d.stockage || '', raison: d.raison || '', maj: d.maj || '',
                                                                               prerequis: d.prerequis || null });"""),
('sources : tester', """                    // Tester un média MAINTENANT : Google Actualités sur son domaine, et son flux RSS
                    const testerSourceVeille = async (s) => {
                        veilleSources.tests = Object.assign({}, veilleSources.tests, { [s.domaine]: { enCours: true } });
                        let r;
                        try { const d = await _vsAppel({ action: 'tester', source: _vsSansOrigine(s) }); r = { google: d.google, flux: d.flux }; }""",
 """                    // Tester un média MAINTENANT, par toutes ses portes : Google, Bing, sa page de recherche, sa page d'accueil
                    const testerSourceVeille = async (s) => {
                        veilleSources.tests = Object.assign({}, veilleSources.tests, { [s.domaine]: { enCours: true } });
                        let r;
                        try { const d = await _vsAppel({ action: 'tester', source: _vsSansOrigine(s) }); r = { canaux: Array.isArray(d.canaux) ? d.canaux : [] }; }"""),
])

# ═══ 7. install.sh ═══════════════════════════════════════════════════════════
#  Le mot de passe PostgreSQL n'y est plus écrit : lu dans l'environnement, ou
#  dans db_config.php (non versionné). L'ancienne ligne est retirée sans que sa
#  valeur figure dans ce script.

src = io.open('install.sh', encoding='utf-8').read()
lignes = [l for l in src.split('\n') if re.match(r'^PG_PASS="[^"$]*"$', l)]
if len(lignes) != 1:
    print(f'✖ install.sh — PG_PASS en dur : {len(lignes)} ligne(s), 1 attendue'); sys.exit(1)
src = src.replace(lignes[0] + '\n', """# v37.42 : le mot de passe n'est plus ecrit dans ce fichier suivi par git. Il est lu
# dans l'environnement (sudo PG_PASS='...' bash install.sh) ou, a defaut, dans
# db_config.php (non versionne) au moment de preparer la base.
PG_PASS="${PG_PASS:-}"
""", 1)
io.open('install.sh', 'w', encoding='utf-8').write(src)
print('✔ install.sh : mot de passe PostgreSQL retiré du fichier')

INSTALL_PHP = """# -----------------------------------------------------------------------------
# 0. Extensions PHP de l'application (v37.42)
#    curl     : la revue de presse interroge les journaux EN PARALLELE
#               (sans curl elle marche quand meme, une source apres l'autre)
#    xml      : DOM + SimpleXML - lecture des pages des journaux et des
#               resultats Google / Bing Actualites
#    mbstring : textes arabes et accents
#    pgsql    : vos reglages (medias de la veille, garde-memoire) en base
#  Seul :  sudo bash install.sh php   (ne touche ni a la base, ni a n8n)
# -----------------------------------------------------------------------------
install_php_extensions() {
  if ! command -v php >/dev/null 2>&1; then
    warn "php introuvable sur l'hote : extensions non verifiees."
    return 0
  fi
  local v modules
  v="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
  modules="$(php -m 2>/dev/null | tr '[:upper:]' '[:lower:]')"
  a_module() { grep -qx "$1" <<<"${modules}"; }
  local manquants=()
  a_module curl || manquants+=("php${v}-curl")
  { a_module dom && a_module simplexml; } || manquants+=("php${v}-xml")
  a_module mbstring || manquants+=("php${v}-mbstring")
  a_module pdo_pgsql || manquants+=("php${v}-pgsql")
  if (( ${#manquants[@]} == 0 )); then
    ok "Extensions PHP ${v} presentes (curl, xml, mbstring, pgsql)."
    return 0
  fi
  log "Installation des extensions PHP ${v} : ${manquants[*]}..."
  if ! command -v apt-get >/dev/null 2>&1; then
    warn "apt-get absent : installe ${manquants[*]} avec le gestionnaire de paquets du systeme."
    return 0
  fi
  DEBIAN_FRONTEND=noninteractive apt-get update -qq || warn "apt-get update a echoue : on tente l'installation quand meme."
  if ! DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${manquants[@]}"; then
    warn "Installation impossible. A la main : sudo apt-get install -y ${manquants[*]} && sudo systemctl restart php${v}-fpm"
    return 0
  fi
  if command -v systemctl >/dev/null 2>&1 && systemctl cat "php${v}-fpm" >/dev/null 2>&1; then
    systemctl restart "php${v}-fpm" && ok "php${v}-fpm redemarre."
  fi
  modules="$(php -m 2>/dev/null | tr '[:upper:]' '[:lower:]')"
  if a_module curl; then ok "curl actif : la revue de presse interroge les journaux en parallele."
  else warn "curl toujours absent : la revue de presse reste en mode lent."; fi
}

# -----------------------------------------------------------------------------
# 1. Permissions /var/www/finance"""

patch('install.sh', [
('en-tête : étapes', """#  Ce script met en place tout ce qui est necessaire cote VPS :
#    1. Permissions correctes sur /var/www/finance""",
 """#  Ce script met en place tout ce qui est necessaire cote VPS :
#    0. Extensions PHP (curl, xml, mbstring, pgsql) - v37.42
#    1. Permissions correctes sur /var/www/finance"""),
('en-tête : valeurs', """#  necessaire. Aucune valeur n'est demandee interactivement, tout est en dur
#  (credentials pre-existants sur votre n8n), strict respect du brief.
#
#  Usage :  sudo bash install.sh""",
 """#  necessaire. Aucune valeur n'est demandee interactivement. Le mot de passe
#  PostgreSQL vient de l'environnement ou de db_config.php (v37.42).
#
#  Usage :  sudo bash install.sh        (tout)
#           sudo bash install.sh php    (extensions PHP seulement)"""),
('étape PHP', """# -----------------------------------------------------------------------------
# 1. Permissions /var/www/finance""", INSTALL_PHP),
('mot de passe : db_config.php', """  export PGPASSWORD="${PG_PASS}\"""",
 """  if [[ -z "${PG_PASS}" && -f "${FINANCE_DIR}/db_config.php" ]] && command -v php >/dev/null 2>&1; then
    PG_PASS="$(php -r '$c = @include $argv[1]; echo is_array($c) ? (string)($c["password"] ?? "") : "";' "${FINANCE_DIR}/db_config.php" 2>/dev/null || true)"
  fi
  if [[ -z "${PG_PASS}" ]]; then
    warn "Mot de passe PostgreSQL introuvable (ni PG_PASS, ni db_config.php) : etape PostgreSQL sautee."
    return 0
  fi
  export PGPASSWORD="${PG_PASS}\""""),
('main', """main() {
  require_root
  fix_permissions""",
 """main() {
  require_root
  if [[ "${1:-}" == "php" ]]; then
    install_php_extensions
    return 0
  fi
  install_php_extensions
  fix_permissions"""),
])
