<?php
declare(strict_types=1);
/**
 * ============================================================================
 *  cfo_veille_lib.php — REVUE DE PRESSE LOCALE (v37.39), la partie sans réseau
 * ----------------------------------------------------------------------------
 *  LE CONSTAT : la Recherche Éclair passait par l'outil web_search du CFO — une
 *  recherche Tavily « basic », généraliste, qui ne rend qu'un résumé tout fait.
 *  Ni Al Marrakchia, ni Marrakech Alaan, ni Le Desk : des prix de villas pour
 *  un terrain de 7 ha en SHL2.
 *
 *  LA RÈGLE : la presse locale est lue AVANT l'agent, par le serveur, et les
 *  articles (datés, sourcés) lui sont donnés comme matière première. Les lieux
 *  du bien sont cherchés en français ET en arabe — la presse marrakchie écrit
 *  surtout en arabe.
 *
 *  Ce fichier ne fait ni requête ni écriture : construire les requêtes, lire les
 *  résultats des moteurs et les pages des journaux, trier les articles.
 *  test_veille_presse.php le verrouille ; cfo_veille_presse.php fait les appels
 *  réseau. v37.42 : aucun flux RSS de journal n'est requis — ni curl, ni même
 *  php-xml (lectures de secours par expressions régulières).
 * ============================================================================
 */

const CFO_VP_MAX_LIEUX = 6;
const CFO_VP_MAX_SUJETS = 12;
const CFO_VP_MAX_REQUETES = 30;   // v37.42 : quatre portes par média local (Google, page de recherche, Bing, accueil)

function cfo_vp_arabe(string $t): bool { return (bool)preg_match('/\p{Arabic}/u', $t); }

/** Pour comparer : minuscules, sans accents ; en arabe sans voyelles, alifs unifiés, ة→ه, ى→ي. */
function cfo_vp_norm(string $t): string {
    $t = mb_strtolower($t, 'UTF-8');
    $t = strtr($t, ['à'=>'a','â'=>'a','ä'=>'a','é'=>'e','è'=>'e','ê'=>'e','ë'=>'e','î'=>'i','ï'=>'i','ô'=>'o','ö'=>'o',
                    'ù'=>'u','û'=>'u','ü'=>'u','ç'=>'c','œ'=>'oe','’'=>"'",
                    'أ'=>'ا','إ'=>'ا','آ'=>'ا','ٱ'=>'ا','ة'=>'ه','ى'=>'ي','ـ'=>'']);
    $t = (string)preg_replace('/[\x{064B}-\x{065F}\x{0670}]/u', '', $t);
    return trim((string)preg_replace('/\s+/u', ' ', $t));
}

/** Un terme venu du navigateur : lettres, chiffres, espaces, apostrophes, tirets. Rien d'autre. */
function cfo_vp_terme($v): ?string {
    if (!is_string($v)) return null;
    $t = trim((string)preg_replace('/\s+/u', ' ', (string)preg_replace('/[^\p{L}\p{M}\p{N}\s\'’\-+.]/u', ' ', $v)));
    $n = mb_strlen($t);
    return ($n >= 2 && $n <= 60) ? $t : null;
}

/** {lieux:[…], sujets:[…]} → termes nettoyés, dédoublonnés, plafonnés. */
function cfo_vp_valider(array $corps): array {
    $prendre = function ($liste, int $max): array {
        $out = []; $vus = [];
        foreach (is_array($liste) ? $liste : [] as $v) {
            $t = cfo_vp_terme($v);
            if ($t === null || isset($vus[cfo_vp_norm($t)])) continue;
            $vus[cfo_vp_norm($t)] = true; $out[] = $t;
            if (count($out) >= $max) break;
        }
        return $out;
    };
    return ['lieux' => $prendre($corps['lieux'] ?? [], CFO_VP_MAX_LIEUX), 'sujets' => $prendre($corps['sujets'] ?? [], CFO_VP_MAX_SUJETS)];
}

function cfo_vp_guillemets(string $t): string { return preg_match('/\s/u', $t) ? '"' . $t . '"' : $t; }
function cfo_vp_ou(array $termes): string {
    $termes = array_values($termes);
    if (!$termes) return '';
    return count($termes) === 1 ? cfo_vp_guillemets($termes[0]) : '(' . implode(' OR ', array_map('cfo_vp_guillemets', $termes)) . ')';
}
function cfo_vp_sites(array $sources, string $portee): string {
    $d = array_map(fn($s) => 'site:' . $s['domaine'], array_filter($sources, fn($s) => ($s['portee'] ?? '') === $portee && !empty($s['domaine'])));
    return $d ? '(' . implode(' OR ', $d) . ')' : '';
}
function cfo_vp_url(string $gabarit, string $q): string { return str_replace('{q}', rawurlencode($q), $gabarit); }

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

/** Le média d'un domaine, d'après le fichier de sources (www. et sous-domaines compris). */
function cfo_vp_media(array $cfg, string $hote): ?array {
    $hote = strtolower(preg_replace('/^www\./', '', $hote));
    foreach ($cfg['sources'] ?? [] as $s) {
        $d = strtolower($s['domaine'] ?? '');
        if ($d !== '' && ($hote === $d || substr($hote, -strlen($d) - 1) === '.' . $d)) return $s;
    }
    return null;
}

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

/**
 * Le tri. Un article reste s'il vient d'une requête qui exigeait le lieu exact,
 * s'il nomme un lieu du bien, ou s'il parle de Marrakech ET d'un sujet foncier.
 * Score : lieu nommé ×5 (CE bien d'abord), sujet ×1, presse locale +2, récent (90 j) +2 / (1 an) +1.
 * Trop vieux (au-delà de la fenêtre) : écarté. Doublons (même titre, même lien) : fusionnés.
 */
function cfo_vp_selection(array $articles, array $lieux, array $sujets, array $cfg, ?int $maintenant = null): array {
    $maintenant = $maintenant ?? time();
    $fenetre = (int)($cfg['fenetre_jours'] ?? 730) * 86400;
    $L = array_values(array_filter(array_map('cfo_vp_norm', $lieux)));
    $S = array_values(array_filter(array_map('cfo_vp_norm', $sujets)));
    $vus = []; $garde = [];
    foreach ($articles as $a) {
        if ($a['ts'] !== null && $maintenant - $a['ts'] > $fenetre) continue;
        $txt = cfo_vp_norm($a['titre'] . ' ' . $a['extrait']);
        $nl = count(array_filter($L, fn($l) => mb_strpos($txt, $l) !== false));
        $ns = count(array_filter($S, fn($s) => mb_strpos($txt, $s) !== false));
        $zone = mb_strpos($txt, 'marrakech') !== false || mb_strpos($txt, cfo_vp_norm('مراكش')) !== false;
        if (!$a['specifique'] && !$nl && !($ns && $zone)) continue;
        $cle = mb_substr(cfo_vp_norm($a['titre']), 0, 70);
        if (isset($vus[$cle]) || isset($vus[$a['url']])) continue;
        $vus[$cle] = $vus[$a['url']] = true;
        $age = $a['ts'] !== null ? ($maintenant - $a['ts']) / 86400 : 9999;
        $a['score'] = 5 * $nl + $ns + ($a['portee'] === 'locale' ? 2 : 0) + ($age <= 90 ? 2 : ($age <= 365 ? 1 : 0));
        $garde[] = $a;
    }
    usort($garde, fn($x, $y) => [$y['score'], $y['ts'] ?? 0] <=> [$x['score'], $x['ts'] ?? 0]);
    return array_map(function ($a) { unset($a['ts'], $a['specifique']); return $a; },
                     array_slice($garde, 0, (int)($cfg['max_articles'] ?? 15)));
}


/* ══ v37.41-42 — LES PAGES DES JOURNAUX, LUES EN HTML (AUCUN N'A DE RSS OUVERT) ═ */

/** Un lien de la page → adresse absolue http(s), ou null (javascript:, mailto:, ancre…). */
function cfo_vp_absolu(string $href, string $base): ?string {
    $href = trim(html_entity_decode($href, ENT_QUOTES, 'UTF-8'));
    if ($href === '' || $href[0] === '#') return null;
    if (preg_match('#^https?://#i', $href)) return $href;
    if (preg_match('#^[a-z][a-z0-9+.\-]*:#i', $href)) return null;
    $b = parse_url($base);
    if (!is_array($b) || empty($b['host'])) return null;
    $schema = strtolower($b['scheme'] ?? 'https');
    if (substr($href, 0, 2) === '//') return $schema . ':' . $href;
    $racine = $schema . '://' . $b['host'] . (isset($b['port']) ? ':' . $b['port'] : '');
    if ($href[0] === '/') return $racine . $href;
    return $racine . preg_replace('#/[^/]*$#', '/', $b['path'] ?? '/') . $href;
}

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

/* ══ v37.40 — LES MÉDIAS, RÉGLABLES DEPUIS L'ÉCRAN ══════════════════════════ */

const CFO_VP_MAX_SOURCES = 60;

/** « https://www.Le360.ma/fr/economie » → « le360.ma ». null si ce n'est pas un nom de domaine public. */
function cfo_vp_domaine($v): ?string {
    if (!is_string($v)) return null;
    $d = strtolower(trim($v));
    $d = (string)preg_replace('#^[a-z][a-z0-9+.\-]*://#', '', $d);
    $d = (string)preg_replace('#[/?\#].*$#s', '', $d);
    $d = (string)preg_replace('/:\d+$/', '', $d);
    $d = (string)preg_replace('/^www\./', '', $d);
    if (strlen($d) > 253) return null;
    // des étiquettes, un point, une extension en lettres : ni IP, ni localhost, ni « user@hôte »
    return preg_match('/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,24}|xn--[a-z0-9-]{2,59})$/', $d) ? $d : null;
}

/** Une source saisie → ['source' => propre] ou ['erreur' => message lisible]. */
function cfo_vp_valider_source($s): array {
    if (!is_array($s)) return ['erreur' => 'Source illisible.'];
    $nom = trim((string)preg_replace('/\s+/u', ' ', (string)preg_replace('/[\x00-\x1F\x7F<>]/u', '', strip_tags((string)($s['nom'] ?? '')))));
    if (mb_strlen($nom) < 2 || mb_strlen($nom) > 60) return ['erreur' => 'Nom du média : 2 à 60 caractères.'];
    $dom = cfo_vp_domaine($s['domaine'] ?? '');
    if ($dom === null) return ['erreur' => "« " . mb_substr(trim((string)($s['domaine'] ?? '')), 0, 60) . " » n'est pas l'adresse d'un site (attendu : almarrakchia.net)."];
    $portee = $s['portee'] ?? '';
    if (!in_array($portee, ['locale', 'nationale'], true)) return ['erreur' => 'Portée : presse locale ou nationale.'];
    $langue = $s['langue'] ?? '';
    if (!in_array($langue, ['fr', 'ar'], true)) return ['erreur' => 'Langue : français ou arabe.'];
    $out = ['nom' => $nom, 'domaine' => $dom, 'portee' => $portee, 'langue' => $langue];
    $flux = trim((string)($s['flux'] ?? ''));
    if ($flux !== '') {
        if (strlen($flux) > 300 || preg_match('/\s/', $flux) || !preg_match('#^https?://#i', $flux)) return ['erreur' => 'Adresse de recherche : une adresse http(s), sans espace.'];
        if (substr_count($flux, '{q}') !== 1) return ['erreur' => 'Adresse de recherche : {q} doit marquer, une fois, la place des mots cherchés.'];
        $p = parse_url(str_replace('{q}', 'x', $flux));
        if (!is_array($p) || isset($p['user']) || isset($p['pass']) || isset($p['port'])) return ['erreur' => 'Adresse de recherche : non acceptée (ni identifiants, ni port).'];
        $h = (string)preg_replace('/^www\./', '', strtolower((string)($p['host'] ?? '')));
        if ($h !== $dom && substr($h, -strlen($dom) - 1) !== '.' . $dom) return ['erreur' => "Adresse de recherche : elle doit être sur le site du média ($dom), pas sur « $h »."];
        $out['flux'] = $flux;
    }
    if (($s['actif'] ?? true) === false) $out['actif'] = false;
    return ['source' => $out];
}

/** La liste complète envoyée par l'écran. Erreurs par position, lisibles. */
function cfo_vp_valider_liste($liste): array {
    if (!is_array($liste)) return ['sources' => [], 'erreurs' => ['liste' => 'Liste de sources attendue.']];
    if (count($liste) > CFO_VP_MAX_SOURCES) return ['sources' => [], 'erreurs' => ['liste' => 'Au plus ' . CFO_VP_MAX_SOURCES . ' sources.']];
    $out = []; $err = []; $vus = [];
    foreach (array_values($liste) as $i => $s) {
        $v = cfo_vp_valider_source($s);
        if (isset($v['erreur'])) { $err['s' . $i] = 'Source ' . ($i + 1) . ' : ' . $v['erreur']; continue; }
        if (isset($vus[$v['source']['domaine']])) { $err['s' . $i] = $v['source']['domaine'] . ' figure déjà dans la liste.'; continue; }
        $vus[$v['source']['domaine']] = true; $out[] = $v['source'];
    }
    return ['sources' => $out, 'erreurs' => $err];
}

function cfo_vp_meme_source(array $a, array $b): bool {
    $k = fn($s) => [$s['nom'] ?? '', $s['portee'] ?? '', $s['langue'] ?? '', $s['flux'] ?? '', ($s['actif'] ?? true) !== false];
    return $k($a) === $k($b);
}

/**
 * Vos réglages superposés à la liste d'origine. Chaque média porte son
 * « origine » : origine | modifiee | ajoutee | nouvelle (livré depuis vos
 * réglages). Un média d'origine que vous avez retiré reste retiré.
 */
function cfo_vp_fusion(array $defauts, ?array $perso): array {
    $parDef = [];
    foreach ($defauts as $d) if (!empty($d['domaine'])) $parDef[$d['domaine']] = $d;
    if (!$perso || !is_array($perso['sources'] ?? null)) {
        return ['sources' => array_map(fn($d) => $d + ['origine' => 'origine'], array_values($parDef)), 'supprimees' => []];
    }
    $connus = array_flip(array_filter((array)($perso['defauts_connus'] ?? []), 'is_string'));
    $out = []; $vus = [];
    foreach ($perso['sources'] as $s) {
        $v = cfo_vp_valider_source($s);
        if (isset($v['erreur'])) continue;                    // une ligne abîmée en base ne casse pas la veille
        $s = $v['source'];
        if (isset($vus[$s['domaine']])) continue;
        $vus[$s['domaine']] = true;
        $d = $parDef[$s['domaine']] ?? null;
        $s['origine'] = $d === null ? 'ajoutee' : (cfo_vp_meme_source($s, $d) ? 'origine' : 'modifiee');
        $out[] = $s;
    }
    $supprimees = [];
    foreach ($parDef as $dom => $d) {
        if (isset($vus[$dom])) continue;
        if (isset($connus[$dom])) $supprimees[] = $d + ['origine' => 'origine'];
        else $out[] = $d + ['origine' => 'nouvelle'];
    }
    return ['sources' => $out, 'supprimees' => $supprimees];
}

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
