<?php
declare(strict_types=1);
/**
 * ============================================================================
 *  cfo_veille_domaines.php — NORMALISER L'ADRESSE D'UNE SOURCE (v37.142)
 * ----------------------------------------------------------------------------
 *  Fonctions PURES (aucun réseau, aucune base) : d'une adresse trouvée par la
 *  veille, tirer la source qu'elle représente, de façon sûre et expliquée.
 *
 *  • Domaine enregistrable par la PUBLIC SUFFIX LIST (veille_psl.dat, format
 *    officiel ; « press.ma », « gov.ma », « co.uk », jokers et exceptions) —
 *    pas une liste de préfixes fragile.
 *  • Variantes regroupées : www., m., mobile., amp., fr., ar., en., web.
 *    (mobile.telquel.ma → telquel.ma, fr.le360.ma → le360.ma).
 *  • Un vrai sous-domaine reste identifiable : sport.le360.ma (clé propre,
 *    domaine enregistrable le360.ma).
 *  • Frontière de point : notle360.ma n'est JAMAIS le360.ma.
 *  • Réseaux sociaux : la page compte (facebook.com/communeouahatsidibrahim ≠
 *    facebook.com/autre) ; une publication sans page identifiable n'est pas une source.
 *  • L'adresse d'origine est gardée telle quelle ; la clé ignore les paramètres
 *    de suivi (utm_*, fbclid…) ; une adresse porteuse de paramètres sensibles
 *    (token, session, mot de passe…) est signalée et jamais proposée.
 * ============================================================================
 */

const VD_VARIANTES = ['www', 'www2', 'm', 'mobile', 'amp', 'fr', 'ar', 'en', 'web'];
const VD_SUIVI = '/^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|igshid|mc_cid|mc_eid|ref|ref_src|ref_url|referrer|source|s_src|cmpid|xtor|at_medium|at_campaign|__twitter_impression|amp|outputType|_ga|_gl|share|via)$/i';
const VD_SENSIBLES = '/^(token|access_token|id_token|auth|authorization|session|sessionid|sess|sid|phpsessid|jsessionid|password|passwd|pwd|pass|secret|api_?key|apikey|key|code|otp|email|e-mail|mail|signature|sig)$/i';
const VD_MOTEURS = ['google', 'bing', 'duckduckgo', 'yahoo', 'yandex', 'baidu', 'qwant', 'ecosia', 'startpage', 'msn', 'brave', 'search', 'ask', 'aol'];
const VD_RACCOURCIS = ['bit.ly', 't.co', 'tinyurl.com', 'ow.ly', 'goo.gl', 'buff.ly', 'lnkd.in', 'fb.me', 'is.gd', 'rebrand.ly', 'cutt.ly', 'shorturl.at'];
const VD_RESEAUX = ['facebook.com' => 'facebook', 'fb.com' => 'facebook', 'instagram.com' => 'instagram', 'tiktok.com' => 'tiktok', 'x.com' => 'x', 'twitter.com' => 'x',
                    'linkedin.com' => 'linkedin', 'threads.net' => 'threads', 't.me' => 'telegram', 'snapchat.com' => 'snapchat'];
const VD_VIDEO = ['youtube.com' => 'youtube', 'youtu.be' => 'youtube', 'dailymotion.com' => 'dailymotion', 'vimeo.com' => 'vimeo'];
const VD_ANNONCES = ['avito.ma', 'mubawab.ma', 'sarouty.ma', 'yakeey.com', 'agenz.ma', 'marocannonces.com', 'logic-immo.ma', 'jumia.ma', 'tayara.ma',
                     'immobilier.ma', 'bayut.ma', 'selektimmo.com', 'kifal.ma', 'opensooq.com'];
const VD_OFFICIELS = ['maroc.ma', 'sgg.gov.ma', 'ancfcc.gov.ma', 'mhpv.gov.ma', 'equipement.gov.ma', 'interieur.gov.ma', 'finances.gov.ma', 'hcp.ma',
                      'bkam.ma', 'cdg.ma', 'onee.ma', 'oncf.ma', 'adm.co.ma', 'marrakechsafi.ma', 'region-marrakech-safi.ma', 'cri-invest.ma', 'auram.ma', 'aum.ma'];
const VD_TYPES = ['presse', 'officielle', 'annonces', 'reseau', 'forum', 'video', 'inconnu'];

/** Les règles de la Public Suffix List : [« règle » => true], les jokers sous « *.base », les exceptions sous « !règle ». */
function vd_psl(): array {
    static $r = null;
    if ($r !== null) return $r;
    $r = [];
    $f = __DIR__ . '/veille_psl.dat';
    foreach (is_file($f) ? file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) : [] as $l) {
        $l = mb_strtolower(trim((string)(preg_split('/\s/', trim($l))[0] ?? '')));
        if ($l === '' || str_starts_with($l, '//')) continue;
        $r[$l] = true;
    }
    return $r;
}

/** Un nom d'hôte public et bien formé (ni IP, ni localhost, ni port, ni identifiants), en minuscules. → l'hôte ou null */
function vd_hote(string $h): ?string {
    $h = rtrim(mb_strtolower(trim($h)), '.');
    if ($h === '' || strlen($h) > 253) return null;
    if (preg_match('/[^\x00-\x7F]/', $h)) {
        if (!function_exists('idn_to_ascii')) return null;
        $a = idn_to_ascii($h, IDNA_DEFAULT, INTL_IDNA_VARIANT_UTS46);
        if (!$a) return null;
        $h = strtolower($a);
    }
    if (filter_var($h, FILTER_VALIDATE_IP)) return null;
    if (!preg_match('/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,24}|xn--[a-z0-9-]{2,59})$/', $h)) return null;
    if (preg_match('/(^|\.)(localhost|local|internal|lan|home|corp|test|invalid|example)$/', $h)) return null;
    return $h;
}

/** Le suffixe public d'un hôte (Public Suffix List) : « press.ma » pour « x.press.ma », « ma » pour « le360.ma ». */
function vd_suffixe(string $hote): string {
    $psl = vd_psl();
    $l = explode('.', $hote);
    $n = count($l);
    $forme = function (string $s): array { $u = function_exists('idn_to_utf8') && str_contains($s, 'xn--') ? (idn_to_utf8($s, IDNA_DEFAULT, INTL_IDNA_VARIANT_UTS46) ?: $s) : $s; return array_unique([$s, mb_strtolower($u)]); };
    for ($i = 0; $i < $n; $i++) {
        $cand = implode('.', array_slice($l, $i));
        foreach ($forme($cand) as $c) if (isset($psl['!' . $c])) return implode('.', array_slice($l, $i + 1));   // exception : un cran plus haut
        foreach ($forme($cand) as $c) if (isset($psl[$c])) return $cand;
        if ($i + 1 < $n) foreach ($forme(implode('.', array_slice($l, $i + 1))) as $c) if (isset($psl['*.' . $c])) return $cand;   // joker « *.base »
    }
    return $l[$n - 1];   // règle implicite « * » : le dernier label
}

/** Le domaine enregistrable (eTLD+1) : « le360.ma » pour « sport.le360.ma », « x.press.ma » pour « www.x.press.ma ». null si l'hôte est un suffixe public. */
function vd_enregistrable(string $hote): ?string {
    $suf = vd_suffixe($hote);
    if ($hote === $suf) return null;
    $reste = substr($hote, 0, -strlen($suf) - 1);
    $lab = explode('.', $reste);
    return end($lab) . '.' . $suf;
}

/** La page d'un réseau social ou d'une plateforme vidéo, tirée du chemin. → 'page' (chemin) ou null si l'adresse ne désigne pas une page. */
function vd_page_sociale(string $plateforme, string $chemin, array $query): ?string {
    $seg = array_values(array_filter(explode('/', strtolower(trim(rawurldecode($chemin), '/'))), fn($s) => $s !== ''));
    if (!$seg) return null;
    $ok = fn(string $s) => (bool)preg_match('/^[\p{L}\p{N}._~\-@]{1,80}$/u', $s);
    switch ($plateforme) {
        case 'facebook':
            if (in_array($seg[0], ['groups', 'events'], true)) return isset($seg[1]) && $ok($seg[1]) ? $seg[0] . '/' . $seg[1] : null;
            if ($seg[0] === 'pages' || $seg[0] === 'pg') return isset($seg[1]) && $ok($seg[1]) ? $seg[1] : null;
            if ($seg[0] === 'people') return isset($seg[1], $seg[2]) && $ok($seg[1]) && $ok($seg[2]) ? 'people/' . $seg[1] . '/' . $seg[2] : null;
            if (in_array($seg[0], ['watch', 'photo', 'photo.php', 'story.php', 'permalink.php', 'sharer', 'sharer.php', 'share', 'reel', 'reels', 'video.php', 'login', 'login.php',
                                   'profile.php', 'search', 'hashtag', 'marketplace', 'gaming', 'help', 'policies', 'privacy', 'l.php', 'dialog', 'plugins', 'media', 'notes'], true)) return null;
            return $ok($seg[0]) ? $seg[0] : null;
        case 'instagram':
            if (in_array($seg[0], ['p', 'reel', 'reels', 'tv', 'explore', 'stories', 'accounts', 'direct', 'about', 'legal'], true)) return null;
            return $ok($seg[0]) ? $seg[0] : null;
        case 'tiktok':
            return str_starts_with($seg[0], '@') && $ok($seg[0]) ? $seg[0] : null;
        case 'x':
            if (in_array($seg[0], ['i', 'search', 'hashtag', 'intent', 'share', 'home', 'explore', 'settings', 'login'], true)) return null;
            return $ok($seg[0]) ? $seg[0] : null;
        case 'linkedin':
            return in_array($seg[0], ['company', 'in', 'school', 'showcase'], true) && isset($seg[1]) && $ok($seg[1]) ? $seg[0] . '/' . $seg[1] : null;
        case 'threads':
            return str_starts_with($seg[0], '@') && $ok($seg[0]) ? $seg[0] : null;
        case 'telegram':
            return $seg[0] !== 's' && $ok($seg[0]) ? $seg[0] : (isset($seg[1]) && $ok($seg[1]) ? $seg[1] : null);
        case 'youtube':
            if (str_starts_with($seg[0], '@')) return $ok($seg[0]) ? $seg[0] : null;
            if (in_array($seg[0], ['channel', 'c', 'user'], true)) return isset($seg[1]) && $ok($seg[1]) ? $seg[0] . '/' . $seg[1] : null;
            return null;   // une vidéo (watch, shorts, youtu.be/…) ne dit pas la chaîne
        case 'dailymotion': case 'vimeo':
            return !in_array($seg[0], ['video', 'embed', 'search', 'playlist'], true) && !ctype_digit($seg[0]) && $ok($seg[0]) ? $seg[0] : null;
    }
    return null;
}

/**
 * Normaliser une adresse trouvée par la veille. $o : domaine_source (le domaine du média quand l'adresse est un lien
 * Google Actualités), connus (domaines enregistrables des sources suivies, pour repérer les imitations).
 * → ['ok' => bool, 'exclusion' => null|raison, 'original_url', 'url_google', 'url_propre', 'host', 'normalized_domain', 'registrable_domain',
 *    'subdomain', 'chemin', 'plateforme', 'normalized_key', 'normalization_reason', 'parametres_sensibles']
 */
function vd_normaliser(string $url, array $o = []): array {
    $out = ['ok' => false, 'exclusion' => null, 'original_url' => $url, 'url_google' => null, 'url_propre' => null, 'host' => null,
            'normalized_domain' => null, 'registrable_domain' => null, 'subdomain' => '', 'chemin' => '', 'plateforme' => null,
            'normalized_key' => null, 'normalization_reason' => '', 'parametres_sensibles' => false];
    $u = trim($url);
    if ($u === '' || strlen($u) > 2000 || preg_match('/[\s<>"]/', $u)) { $out['exclusion'] = 'adresse invalide'; return $out; }
    if (!preg_match('#^https?://#i', $u)) { $out['exclusion'] = 'adresse invalide (ni http ni https)'; return $out; }
    $p = parse_url($u);
    if (!is_array($p) || empty($p['host'])) { $out['exclusion'] = 'adresse invalide'; return $out; }
    if (isset($p['user']) || isset($p['pass'])) { $out['exclusion'] = 'adresse avec identifiants'; return $out; }
    if (isset($p['port']) && !in_array((int)$p['port'], [80, 443], true)) { $out['exclusion'] = 'port non standard'; return $out; }
    $hote = vd_hote((string)$p['host']);
    if ($hote === null) { $out['exclusion'] = 'hôte invalide ou privé (IP, localhost…)'; return $out; }
    $raisons = [];
    //  un lien Google Actualités : l'adresse du journal n'est pas dans l'URL ; le domaine du média (balise <source>) la remplace
    if (preg_match('/(^|\.)news\.google\.[a-z.]+$/', $hote) || $hote === 'news.google.com') {
        $ds = vd_hote((string)($o['domaine_source'] ?? ''));
        if ($ds === null || str_contains($ds, 'google.')) { $out['exclusion'] = 'lien Google Actualités sans domaine de média'; return $out; }
        $out['url_google'] = $u;
        $raisons[] = 'lien Google Actualités : domaine du média tiré de la source (' . $ds . ')';
        $hote = $ds; $p = ['scheme' => 'https', 'host' => $ds, 'path' => '/'];
    }
    $out['host'] = $hote;
    $reg = vd_enregistrable($hote);
    if ($reg === null) { $out['exclusion'] = 'l\'hôte est un suffixe public (' . $hote . ')'; return $out; }
    $out['registrable_domain'] = $reg;
    $label = explode('.', $reg)[0];
    if (in_array($label, VD_MOTEURS, true) || $hote === 'search.brave.com') { $out['exclusion'] = 'moteur de recherche (' . $reg . ')'; return $out; }
    if (in_array($reg, VD_RACCOURCIS, true)) { $out['exclusion'] = 'raccourcisseur d\'adresse (' . $reg . ')'; return $out; }
    //  les paramètres : ceux de suivi sont retirés de l'adresse propre ; un paramètre sensible exclut l'adresse
    $q = [];
    if (isset($p['query'])) parse_str((string)$p['query'], $q);
    $propres = [];
    foreach ($q as $k => $v) {
        if (preg_match(VD_SENSIBLES, (string)$k)) { $out['parametres_sensibles'] = true; continue; }
        if (preg_match(VD_SUIVI, (string)$k)) continue;
        $propres[$k] = $v;
    }
    //  le sous-domaine : les variantes (www, m, mobile, amp, fr, ar…) sont regroupées ; les autres restent identifiables
    $sous = $hote === $reg ? '' : substr($hote, 0, -strlen($reg) - 1);
    $labs = $sous === '' ? [] : explode('.', $sous);
    $retires = [];
    while ($labs && in_array($labs[0], VD_VARIANTES, true)) $retires[] = array_shift($labs);
    $out['subdomain'] = $sous;
    $nd = ($labs ? implode('.', $labs) . '.' : '') . $reg;
    $out['normalized_domain'] = $nd;
    if ($retires) $raisons[] = 'variante « ' . implode('.', $retires) . '. » regroupée avec ' . $nd;
    if ($labs) $raisons[] = 'sous-domaine « ' . implode('.', $labs) . ' » de ' . $reg . ' (gardé distinct)';
    $chemin = (string)($p['path'] ?? '/');
    $plat = VD_RESEAUX[$reg] ?? VD_VIDEO[$reg] ?? null;
    $cle = $nd;
    if ($plat !== null) {
        $out['plateforme'] = $plat;
        if ($reg === 'fb.com') { $reg = 'facebook.com'; $nd = 'facebook.com'; $out['registrable_domain'] = $reg; $out['normalized_domain'] = $nd; }
        if ($reg === 'twitter.com') { $reg = 'x.com'; $nd = 'x.com'; $out['registrable_domain'] = $reg; $out['normalized_domain'] = $nd; $raisons[] = 'twitter.com regroupé avec x.com'; }
        if ($reg === 'youtu.be') { $out['exclusion'] = 'vidéo YouTube isolée : la chaîne n\'est pas identifiable'; return $out; }
        $page = vd_page_sociale($plat, $chemin, $q);
        if ($page === null) { $out['exclusion'] = 'publication ' . $plat . ' sans page identifiable (une page, un groupe ou une chaîne est attendu)'; return $out; }
        $out['chemin'] = $page;
        $cle = $nd . '/' . $page;
        $raisons[] = 'page ' . $plat . ' « ' . $page . ' » (une source par page)';
    }
    $out['url_propre'] = 'https://' . $hote . ($chemin === '' ? '/' : $chemin) . ($propres ? '?' . http_build_query($propres) : '');
    $out['normalized_key'] = $cle;
    //  une imitation d'une source suivie (le360-ma.com, hesspress.com, notle360.ma…) : jamais fusionnée, jamais proposée
    //  (un site d'administration, sous gov.ma, n'imite personne : le suffixe est réservé à l'État)
    foreach (vd_suffixe($hote) === 'gov.ma' ? [] : ($o['connus'] ?? []) as $k) {
        $k = strtolower((string)$k);
        if ($k === '' || $k === $reg) continue;
        $lk = explode('.', $k)[0];
        if (vd_imite($label, $lk)) { $out['exclusion'] = 'ressemble à ' . $k . ' (source suivie) sans l\'être : jamais fusionné, non proposé'; $out['normalization_reason'] = implode(' ; ', $raisons); return $out; }
    }
    if ($out['parametres_sensibles']) $out['exclusion'] = 'paramètre sensible dans l\'adresse (jeton, session, mot de passe…)';
    $out['ok'] = $out['exclusion'] === null;
    $out['normalization_reason'] = $raisons ? implode(' ; ', $raisons) : 'domaine enregistrable ' . $reg . ' (Public Suffix List)';
    return $out;
}

/** Un label qui imite un autre sans l'être : une lettre de différence, des tirets en plus, ou le nom connu enrobé (notle360, le360-ma). */
function vd_imite(string $a, string $connu): bool {
    if ($a === $connu || strlen($connu) < 4) return false;
    //  un nom de ville ou de mot commun suivi de chiffres (marrakech / marrakech7) n'est pas une imitation
    if ((str_starts_with($connu, $a) && ctype_digit(substr($connu, strlen($a)))) || (str_starts_with($a, $connu) && ctype_digit(substr($a, strlen($connu))))) return false;
    $s = fn($x) => str_replace(['-', '_'], '', $x);
    if ($s($a) === $s($connu)) return true;
    if (strlen($connu) >= 5 && abs(strlen($a) - strlen($connu)) <= 1 && levenshtein($a, $connu) <= 1) return true;
    if (str_contains($s($a), $s($connu)) && strlen($s($a)) - strlen($s($connu)) <= 4) return true;
    return false;
}

/**
 * Le type d'une source : presse, officielle, annonces, reseau, forum, video, inconnu. Une source sociale n'est JAMAIS officielle.
 * $n : résultat de vd_normaliser ; $indices : portees vues (locale/nationale/annonces/reseau/forum), titres.
 */
function vd_type(array $n, array $indices = []): string {
    $reg = (string)($n['registrable_domain'] ?? ''); $hote = (string)($n['host'] ?? ''); $plat = $n['plateforme'] ?? null;
    if ($plat !== null) return isset(VD_VIDEO[$reg]) || in_array($plat, ['youtube', 'dailymotion', 'vimeo'], true) ? 'video' : 'reseau';
    $suf = vd_suffixe($hote);
    if ($suf === 'gov.ma' || str_ends_with($suf, '.gov') || $suf === 'gov' || in_array($reg, VD_OFFICIELS, true)) return 'officielle';
    if (in_array($reg, VD_ANNONCES, true)) return 'annonces';
    $portees = array_count_values(array_map('strval', $indices['portees'] ?? []));
    if (preg_match('/(^|[.\-])forums?([.\-]|$)/', $hote) || in_array($reg, ['reddit.com', 'quora.com'], true) || ($portees['forum'] ?? 0) > 0) return 'forum';
    if (($portees['annonces'] ?? 0) > 0) return 'annonces';
    if (($portees['locale'] ?? 0) + ($portees['nationale'] ?? 0) > 0 || $suf === 'press.ma') return 'presse';
    $titres = cfo_vd_norm_simple(implode(' ', $indices['titres'] ?? []));
    if (preg_match('/\b(a vendre|annonce|terrain de \d|lot de \d|m2 a|dh le m2)\b|للبيع|بيع بقعة|اعلان/u', $titres)) return 'annonces';
    $chemins = implode(' ', $indices['chemins'] ?? []);
    if (preg_match('#/(20\d\d)/\d{1,2}/|/(article|actualite|actualites|news|politique|economie|societe|regions?)/|[a-z]+-[a-z]+-[a-z]+-[a-z]+#i', $chemins)
        || preg_match('/(news|info|press|presse|akhbar|journal|hebdo|actu|media|24|kech|marrakech|alaan|times|post|tribune|matin)/', explode('.', $reg)[0])) return 'presse';
    return 'inconnu';
}
function cfo_vd_norm_simple(string $s): string {
    $s = mb_strtolower($s);
    $s = strtr($s, ['à' => 'a', 'â' => 'a', 'ä' => 'a', 'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e', 'î' => 'i', 'ï' => 'i', 'ô' => 'o', 'ö' => 'o', 'ù' => 'u', 'û' => 'u', 'ü' => 'u', 'ç' => 'c', '²' => '2']);
    return (string)preg_replace('/\s+/u', ' ', $s);
}

/** La langue d'une source : l'arabe si la majorité de ses titres sont en écriture arabe, sinon les langues vues (fr par défaut). */
function vd_langue(array $titres, array $langues = []): string {
    $ar = 0; $n = 0;
    foreach ($titres as $t) { if (trim((string)$t) === '') continue; $n++; if (preg_match('/\p{Arabic}/u', (string)$t)) $ar++; }
    if ($n > 0) return $ar * 2 >= $n ? 'ar' : 'fr';
    $c = array_count_values(array_map('strval', $langues));
    arsort($c);
    $l = (string)(array_key_first($c) ?? 'fr');
    return in_array($l, ['fr', 'ar'], true) ? $l : 'fr';
}
