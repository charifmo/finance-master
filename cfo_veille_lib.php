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
 *  Ce fichier ne fait ni requête ni écriture : construire les requêtes, lire un
 *  flux RSS, trier les articles. test_veille_presse.php le verrouille ;
 *  cfo_veille_presse.php fait les appels réseau.
 * ============================================================================
 */

const CFO_VP_MAX_LIEUX = 6;
const CFO_VP_MAX_SUJETS = 12;
const CFO_VP_MAX_REQUETES = 22;   // v37.41 : une requête stricte par média local

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
 * venue du navigateur. Par lieu : la presse locale (site:…), puis le lieu avec
 * les sujets fonciers (SDAU, plan d'aménagement, RN9…) partout. Pour le premier
 * lieu de chaque langue : la presse nationale. Les flux de recherche des sites
 * locaux reçoivent le lieu dans leur langue. Puis la zone (Marrakech + sujets).
 * 'specifique' : la requête exige le lieu exact — tout article rendu le concerne.
 */
function cfo_vp_requetes(array $cfg, array $lieux, array $sujets): array {
    $moteurs = []; foreach ($cfg['moteurs'] ?? [] as $m) $moteurs[$m['langue'] ?? 'fr'] = $m;
    // v37.40 : un média mis en pause depuis l'écran n'est pas interrogé
    $sources = array_values(array_filter($cfg['sources'] ?? [], fn($s) => ($s['actif'] ?? true) !== false));
    $locales = cfo_vp_sites($sources, 'locale'); $nationales = cfo_vp_sites($sources, 'nationale');
    $suj = ['fr' => array_slice(array_values(array_filter($sujets, fn($s) => !cfo_vp_arabe($s))), 0, 5),
            'ar' => array_slice(array_values(array_filter($sujets, fn($s) => cfo_vp_arabe($s))), 0, 5)];
    $parLangue = ['fr' => [], 'ar' => []];
    foreach ($lieux as $l) $parLangue[cfo_vp_arabe($l) ? 'ar' : 'fr'][] = $l;
    $req = [];
    $ajouter = function (string $langue, string $q, bool $specifique, string $libelle) use (&$req, $moteurs) {
        if (!isset($moteurs[$langue]) || trim($q) === '') return;
        $req[] = ['type' => 'moteur', 'nom' => $moteurs[$langue]['nom'], 'libelle' => $libelle, 'q' => $q, 'langue' => $langue,
                  'specifique' => $specifique, 'url' => cfo_vp_url($moteurs[$langue]['gabarit'], $q)];
    };
    // v37.41 : CHAQUE média local a sa requête stricte — site:kech24.com ("واحة سيدي ابراهيم" OR "Ouahat
    //   Sidi Brahim"). Un OR de quatre site: noyait les petits médias, et la plupart n'ont pas de RSS
    //   ouvert : Google Actualités est souvent leur seule porte. Les lieux des DEUX langues.
    $tousLieux = array_merge(array_slice($parLangue['ar'], 0, 2), array_slice($parLangue['fr'], 0, 2));
    foreach ($sources as $s) {
        if (($s['portee'] ?? '') !== 'locale' || empty($s['domaine']) || !$tousLieux) continue;
        $lg = ($s['langue'] ?? 'fr') === 'ar' ? 'ar' : 'fr';
        if (!isset($moteurs[$lg])) $lg = $lg === 'ar' ? 'fr' : 'ar';
        if (!isset($moteurs[$lg])) continue;
        $q = 'site:' . $s['domaine'] . ' ' . cfo_vp_ou($tousLieux);
        $req[] = ['type' => 'moteur', 'nom' => $moteurs[$lg]['nom'], 'libelle' => 'site:' . $s['domaine'], 'q' => $q, 'langue' => $lg,
                  'specifique' => true, 'url' => cfo_vp_url($moteurs[$lg]['gabarit'], $q), 'domaine' => $s['domaine'], 'media' => $s['nom']];
    }
    // La recherche du site lui-même : son RSS s'il est ouvert, sinon sa page de résultats (lue en HTML).
    foreach ($sources as $s) {
        if (empty($s['flux'])) continue;
        $lg = ($s['langue'] ?? 'fr') === 'ar' ? 'ar' : 'fr';
        $l = ($parLangue[$lg] ?: $parLangue[$lg === 'ar' ? 'fr' : 'ar'])[0] ?? null;
        if ($l === null) continue;
        $req[] = ['type' => 'flux', 'nom' => $s['nom'], 'libelle' => 'recherche du site', 'q' => $l, 'langue' => $lg,
                  'specifique' => true, 'url' => cfo_vp_url($s['flux'], $l), 'domaine' => $s['domaine'], 'media' => $s['nom']];
    }
    foreach (['fr', 'ar'] as $lg) foreach (array_slice($parLangue[$lg], 0, 2) as $i => $l) {
        $g = cfo_vp_guillemets($l);
        $ajouter($lg, trim($g . ' ' . cfo_vp_ou($suj[$lg])), true, $suj[$lg] ? 'lieu + urbanisme' : 'lieu');
        if ($i === 0 && $nationales) $ajouter($lg, $g . ' ' . $nationales, true, 'presse nationale');
    }
    if ($suj['fr']) $ajouter('fr', 'Marrakech ' . cfo_vp_ou($suj['fr']) . ($locales ? ' ' . $locales : ''), false, 'zone (Marrakech)');
    if ($suj['ar']) $ajouter('ar', 'مراكش ' . cfo_vp_ou($suj['ar']), false, 'zone (مراكش)');
    return array_slice($req, 0, CFO_VP_MAX_REQUETES);
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
 * Un flux RSS → articles. null si le contenu n'est pas un flux (page HTML d'un
 * site qui n'a pas de recherche RSS) : on le dit, on ne l'invente pas.
 */
function cfo_vp_lire_rss(string $xml, array $req, array $cfg): ?array {
    if (stripos(substr(ltrim($xml), 0, 400), '<rss') === false && stripos(substr(ltrim($xml), 0, 400), '<?xml') === false) return null;
    $prec = libxml_use_internal_errors(true);
    $doc = simplexml_load_string($xml, 'SimpleXMLElement', LIBXML_NOCDATA | LIBXML_NONET);
    libxml_clear_errors(); libxml_use_internal_errors($prec);
    if ($doc === false || !isset($doc->channel)) return null;
    $out = [];
    foreach ($doc->channel->item as $it) {
        $url = trim((string)$it->link);
        if (!preg_match('#^https?://#i', $url)) continue;            // ni javascript:, ni data:
        $titre = trim(html_entity_decode(strip_tags((string)$it->title), ENT_QUOTES, 'UTF-8'));
        $srcNom = trim((string)$it->source); $srcUrl = (string)($it->source['url'] ?? '');
        $hote = parse_url($srcUrl ?: ($req['type'] === 'flux' ? 'https://' . ($req['domaine'] ?? '') : $url), PHP_URL_HOST) ?: '';
        $media = cfo_vp_media($cfg, $hote);
        // Google Actualités suffixe le titre par « - Nom du média »
        if ($srcNom !== '' && mb_substr($titre, -mb_strlen(' - ' . $srcNom)) === ' - ' . $srcNom) $titre = trim(mb_substr($titre, 0, -mb_strlen(' - ' . $srcNom)));
        $extrait = trim((string)preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags((string)$it->description), ENT_QUOTES, 'UTF-8')));
        if ($srcNom !== '' && $extrait !== '' && cfo_vp_norm($extrait) === cfo_vp_norm($titre . ' ' . $srcNom)) $extrait = '';
        $ts = strtotime((string)$it->pubDate) ?: null;
        if ($titre === '') continue;
        $out[] = ['titre' => $titre, 'url' => $url, 'source' => $media['nom'] ?? ($srcNom ?: ($req['nom'] ?? $hote)),
                  'domaine' => preg_replace('/^www\./', '', strtolower($hote)), 'portee' => $media['portee'] ?? 'autre',
                  'ts' => $ts, 'date' => $ts ? gmdate('Y-m-d', $ts) : null,
                  'extrait' => mb_strlen($extrait) > 280 ? rtrim(mb_substr($extrait, 0, 277)) . '…' : $extrait,
                  'specifique' => !empty($req['specifique']), 'langue' => $req['langue'] ?? 'fr'];
    }
    return $out;
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


/* ══ v37.41 — LA PAGE DE RÉSULTATS, QUAND LE SITE N'A PAS DE RSS ═════════════ */

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
 * La page HTML de résultats d'un site → articles. null si ce n'est pas du HTML.
 * Les résultats sont les <article> (WordPress et la plupart des thèmes), à
 * défaut les liens des titres (h1-h4). Menus, en-têtes, pieds, barres
 * latérales et widgets sont retirés AVANT la lecture ; ne restent que les
 * liens vers le site du média lui-même, hors pages de catégorie, d'étiquette,
 * d'auteur ou de pagination. « specifique » : seulement pour un <article> d'une
 * page de résultats (le terme est dans son titre, son h1 ou sa boîte de
 * recherche) — sinon le titre devra nommer le lieu pour être gardé.
 */
function cfo_vp_lire_html(string $html, array $req, array $cfg, string $urlPage): ?array {
    if (!class_exists('DOMDocument') || !preg_match('/<(?:!doctype|html|body|div|article|h[1-4])[\s>]/i', substr($html, 0, 20000))) return null;
    $doc = new DOMDocument();
    $prec = libxml_use_internal_errors(true);
    $ok = $doc->loadHTML('<?xml encoding="UTF-8">' . $html, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
    libxml_clear_errors(); libxml_use_internal_errors($prec);
    if (!$ok) return null;
    $xp = new DOMXPath($doc);
    // Une PAGE DE RÉSULTATS répète le terme cherché dans son titre, son h1 ou sa boîte de recherche.
    // Le corps ne prouve rien : une page d'accueil peut citer le lieu dans un article récent.
    $terme = cfo_vp_norm((string)($req['q'] ?? ''));
    $signal = '';
    foreach ($xp->query('//title|//h1|//input[@name="s" or @type="search" or @name="q"]/@value') as $n) $signal .= ' ' . $n->textContent;
    $pageDeResultats = $terme !== '' && mb_strpos(cfo_vp_norm($signal), $terme) !== false;
    $bruit = '//script|//style|//noscript|//nav|//header|//footer|//aside|//form|//iframe'
           . '|//*[contains(@class,"sidebar") or contains(@id,"sidebar") or contains(@class,"widget") or contains(@class,"menu")'
           . ' or contains(@class,"related") or contains(@class,"popular") or contains(@class,"breadcrumb") or contains(@class,"footer")'
           . ' or contains(@class,"ticker") or contains(@class,"trending") or contains(@id,"footer") or contains(@id,"menu")]';
    foreach ($xp->query($bruit) as $n) if ($n->parentNode) $n->parentNode->removeChild($n);

    $dom = strtolower((string)($req['domaine'] ?? ''));
    $media = cfo_vp_media($cfg, $dom) ?? [];
    $propre = fn($t) => trim((string)preg_replace('/\s+/u', ' ', (string)$t));
    $items = []; $vus = [];
    $prendre = function ($a, $bloc, bool $dansArticle) use (&$items, &$vus, $xp, $dom, $media, $urlPage, $req, $pageDeResultats, $propre) {
        $url = cfo_vp_absolu($a->getAttribute('href'), $urlPage);
        if ($url === null) return;
        $hote = (string)preg_replace('/^www\./', '', strtolower((string)parse_url($url, PHP_URL_HOST)));
        if ($dom === '' || ($hote !== $dom && substr($hote, -strlen($dom) - 1) !== '.' . $dom)) return;    // lien externe, publicité
        $chemin = (string)parse_url($url, PHP_URL_PATH);
        if ($chemin === '' || $chemin === '/' || preg_match('#/(category|categorie|tag|tags|author|auteur|page|feed|wp-content|wp-admin|search)(/|$)#i', $chemin)
            || preg_match('/(^|&)(s|cat|tag|paged)=/', (string)parse_url($url, PHP_URL_QUERY))) return;
        $titre = $propre($a->textContent);
        if ($titre === '' && $bloc) { $h = $xp->query('.//h1|.//h2|.//h3|.//h4', $bloc)->item(0); $titre = $h ? $propre($h->textContent) : ''; }
        if (mb_strlen($titre) < 15 || mb_strlen($titre) > 300 || isset($vus[$url])) return;
        $vus[$url] = true;
        $ts = null; $extrait = '';
        if ($bloc) {
            $t = $xp->query('.//time', $bloc)->item(0);
            if ($t) $ts = strtotime($t->getAttribute('datetime') ?: $propre($t->textContent)) ?: null;
            foreach ($xp->query('.//p', $bloc) as $p) { $x = $propre($p->textContent); if (mb_strlen($x) >= 30 && $x !== $titre) { $extrait = $x; break; } }
        }
        $items[] = ['titre' => $titre, 'url' => $url, 'source' => $media['nom'] ?? ($req['nom'] ?? $dom), 'domaine' => $hote,
                    'portee' => $media['portee'] ?? 'autre', 'ts' => $ts, 'date' => $ts ? gmdate('Y-m-d', $ts) : null,
                    'extrait' => mb_strlen($extrait) > 280 ? rtrim(mb_substr($extrait, 0, 277)) . '…' : $extrait,
                    'specifique' => $dansArticle && $pageDeResultats, 'langue' => $req['langue'] ?? 'fr'];
    };
    foreach ($xp->query('//article') as $art) {
        $a = $xp->query('.//h1//a[@href]|.//h2//a[@href]|.//h3//a[@href]|.//h4//a[@href]', $art)->item(0);
        if (!$a) foreach ($xp->query('.//a[@href]', $art) as $x) if (mb_strlen($propre($x->textContent)) >= 15) { $a = $x; break; }
        if ($a) $prendre($a, $art, true);
    }
    if (!$items) foreach ($xp->query('//h1//a[@href]|//h2//a[@href]|//h3//a[@href]|//h4//a[@href]') as $a) {
        $bloc = $a; for ($k = 0; $k < 3 && $bloc->parentNode instanceof DOMElement && $bloc->parentNode->nodeName !== 'body'; $k++) $bloc = $bloc->parentNode;
        $prendre($a, $bloc, false);
    }
    return array_slice($items, 0, 20);
}

/** La réponse d'une source : RSS si c'en est un, sinon — pour la recherche d'un site — sa page HTML. */
function cfo_vp_lire_reponse(string $corps, array $req, array $cfg): array {
    $rss = cfo_vp_lire_rss($corps, $req, $cfg);
    if ($rss !== null) return ['mode' => 'rss', 'articles' => $rss];
    if (($req['type'] ?? '') === 'flux') {
        $html = cfo_vp_lire_html($corps, $req, $cfg, (string)($req['url'] ?? ''));
        if ($html !== null) return ['mode' => 'page', 'articles' => $html];
    }
    return ['mode' => null, 'articles' => null];
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
        if (strlen($flux) > 300 || preg_match('/\s/', $flux) || !preg_match('#^https?://#i', $flux)) return ['erreur' => 'Flux RSS : une adresse http(s), sans espace.'];
        if (substr_count($flux, '{q}') !== 1) return ['erreur' => 'Flux RSS : {q} doit marquer, une fois, la place des mots cherchés.'];
        $p = parse_url(str_replace('{q}', 'x', $flux));
        if (!is_array($p) || isset($p['user']) || isset($p['pass']) || isset($p['port'])) return ['erreur' => 'Flux RSS : adresse non acceptée (ni identifiants, ni port).'];
        $h = (string)preg_replace('/^www\./', '', strtolower((string)($p['host'] ?? '')));
        if ($h !== $dom && substr($h, -strlen($dom) - 1) !== '.' . $dom) return ['erreur' => "Flux RSS : il doit être sur le site du média ($dom), pas sur « $h »."];
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

/** Tester UN média : Google Actualités sur son domaine, et son flux s'il en a un. */
function cfo_vp_requetes_test(array $cfg, array $s): array {
    $lg = ($s['langue'] ?? 'fr') === 'ar' ? 'ar' : 'fr';
    $mot = $lg === 'ar' ? 'مراكش' : 'Marrakech';
    $req = [];
    foreach ($cfg['moteurs'] ?? [] as $m) if (($m['langue'] ?? 'fr') === $lg) {
        $q = 'site:' . $s['domaine'] . ' ' . $mot;
        $req[] = ['type' => 'moteur', 'nom' => $m['nom'], 'libelle' => 'test', 'q' => $q, 'langue' => $lg, 'specifique' => true, 'url' => cfo_vp_url($m['gabarit'], $q)];
        break;
    }
    if (!empty($s['flux'])) $req[] = ['type' => 'flux', 'nom' => $s['nom'], 'libelle' => 'test', 'q' => $mot, 'langue' => $lg,
                                      'specifique' => true, 'url' => cfo_vp_url($s['flux'], $mot), 'domaine' => $s['domaine']];
    return $req;
}
