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
const CFO_VP_MAX_REQUETES = 16;

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
    $sources = $cfg['sources'] ?? [];
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
    foreach (['fr', 'ar'] as $lg) foreach (array_slice($parLangue[$lg], 0, 3) as $i => $l) {
        $g = cfo_vp_guillemets($l);
        if ($locales) $ajouter($lg, $g . ' ' . $locales, true, 'presse locale');
        $ajouter($lg, trim($g . ' ' . cfo_vp_ou($suj[$lg])), true, $suj[$lg] ? 'lieu + urbanisme' : 'lieu');
        if ($i === 0 && $nationales) $ajouter($lg, $g . ' ' . $nationales, true, 'presse nationale');
    }
    foreach ($sources as $s) {
        if (empty($s['flux'])) continue;
        $lg = ($s['langue'] ?? 'fr') === 'ar' ? 'ar' : 'fr';
        $termes = array_slice($parLangue[$lg] ?: $parLangue[$lg === 'ar' ? 'fr' : 'ar'], 0, 2);
        foreach ($termes as $l) $req[] = ['type' => 'flux', 'nom' => $s['nom'], 'libelle' => 'recherche du site', 'q' => $l, 'langue' => $lg,
                                         'specifique' => true, 'url' => cfo_vp_url($s['flux'], $l), 'domaine' => $s['domaine']];
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
