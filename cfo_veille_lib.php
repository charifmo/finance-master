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
const CFO_VP_MAX_SUJETS = 16;   // v37.121 : 8 en français + 8 en arabe (catalyseurs et leurs synonymes)
/**
 * v37.121 — LES MOTS DE LA PRESSE. « Pourquoi il ne trouve pas Le360 : Mondial 2030, 7,5 milliards pour les accès aux stades
 * de Benslimane et de Marrakech ? » L'article dit « Mondial 2030 » et « stades » ; l'appli cherchait « Grand Stade ». Chaque
 * sujet porte ses synonymes : cherchés dans les requêtes de la zone, reconnus au tri.
 */
const CFO_VP_SYNONYMES = [
    'grand stade' => ['Mondial 2030', 'stades', 'Coupe du monde 2030', 'stade de Marrakech'],
    'mondial 2030' => ['stades', 'Coupe du monde 2030', 'Grand Stade'],
    'الملعب الكبير' => ['مونديال 2030', 'كأس العالم 2030', 'ملعب مراكش'],
    'مونديال 2030' => ['كأس العالم 2030', 'الملعب الكبير'],
    'lgv' => ['grande vitesse', 'TGV', 'Al Boraq'],
    'القطار فائق السرعة' => ['البراق', 'القطار السريع'],
    'contournement' => ['rocade', 'périphérique', 'voie de contournement'],
    'الطريق المداري' => ['الطريق الدائري', 'المدار'],
    'autoroute' => ['voie express', 'échangeur'],
    'الطريق السيار' => ['الطريق السريع'],
    'sdau' => ['schéma directeur'],
    "plan d'aménagement" => ['agence urbaine'],
    'zone industrielle' => ['zone logistique', 'parc logistique'],
    'expropriation' => ['utilité publique'],
];
//  Les sujets d'urbanisme du lieu (SDAU, plan d'aménagement, RN…) ne font pas un « catalyseur » de zone : ils n'ont de sens que
//  pour CE lieu, déjà cherché avec eux
const CFO_VP_URBANISME = ['sdau', "plan d'amenagement", 'المخطط المديري', 'تصميم التهيئه'];
/**
 * v37.125 — LA MÉMOIRE DE LA VEILLE, par bien (ses lieux). Un article retenu une fois (parmi les candidats) est gardé 180 jours
 * (200 au plus) et revient aux passages suivants, même si le moteur ne le renvoie plus : la veille s'enrichit au lieu de
 * repartir de zéro. $anciens / $nouveaux : articles bruts (titre, url, ts…) ; rend la mémoire à jour.
 */
function cfo_vp_memoire_maj(array $anciens, array $nouveaux, ?int $maintenant = null): array {
    $maintenant = $maintenant ?? time();
    $par = [];
    foreach ($anciens as $a) if (is_array($a) && !empty($a['url']) && !empty($a['titre']) && (int)($a['vu_le'] ?? 0) > $maintenant - 180 * 86400) $par[(string)$a['url']] = $a;
    foreach ($nouveaux as $a) {
        if (!is_array($a) || empty($a['url']) || empty($a['titre'])) continue;
        $u = (string)$a['url'];
        $garde = array_intersect_key($a, array_flip(['titre', 'extrait', 'url', 'source', 'domaine', 'portee', 'ts', 'date', 'specifique', 'langue']));
        $par[$u] = $garde + ['vu_le' => $maintenant, 'trouve_le' => (int)($par[$u]['trouve_le'] ?? $maintenant)];
        $par[$u]['vu_le'] = $maintenant;
    }
    uasort($par, fn($x, $y) => ($y['ts'] ?? $y['trouve_le'] ?? 0) <=> ($x['ts'] ?? $x['trouve_le'] ?? 0));
    return array_values(array_slice($par, 0, 200));
}
/** Les articles de la mémoire, prêts pour le tri : marqués « memoire » (déjà trouvés le …). */
function cfo_vp_memoire_articles(array $memoire): array {
    $out = [];
    foreach ($memoire as $a) {
        if (!is_array($a) || empty($a['url']) || empty($a['titre'])) continue;
        $out[] = ['titre' => (string)$a['titre'], 'extrait' => (string)($a['extrait'] ?? ''), 'url' => (string)$a['url'], 'source' => (string)($a['source'] ?? ''), 'domaine' => (string)($a['domaine'] ?? ''),
                  'portee' => (string)($a['portee'] ?? 'autre'), 'ts' => isset($a['ts']) ? (int)$a['ts'] : null, 'date' => $a['date'] ?? null, 'specifique' => !empty($a['specifique']),
                  'langue' => (string)($a['langue'] ?? 'fr'), 'memoire' => gmdate('Y-m-d', (int)($a['trouve_le'] ?? time()))];
    }
    return $out;
}
/** v37.121 — les grands projets de la zone (veille_sources.json › grands_projets.fr / .ar), nettoyés, 10 au plus par langue. */
function cfo_vp_grands_projets(array $cfg, string $lg): array {
    $l = $cfg['grands_projets'][$lg] ?? [];
    return array_slice(array_values(array_filter(array_map('cfo_vp_terme', is_array($l) ? $l : []))), 0, 10);
}
/** Un sujet et ses synonymes (le sujet d'abord). */
function cfo_vp_variantes(string $sujet): array {
    $n = cfo_vp_norm($sujet); $v = [$sujet];
    foreach (CFO_VP_SYNONYMES as $k => $l) if (cfo_vp_norm($k) === $n) $v = array_merge($v, $l);
    return array_values(array_unique($v));
}
const CFO_VP_MAX_REQUETES = 60;   // v37.125 : + une requête par grand projet (récente)   // v37.42 : quatre portes par média local ; v37.111 : + réseaux sociaux, forums, annonces
//  v37.111 — au-delà de la presse : pages et groupes publics (Facebook, Instagram, YouTube…), forums, portails d'annonces.
//  Ils n'ont ni Google Actualités ni page d'accueil lisible : ils sont cherchés par les moteurs du WEB (rôle « web »),
//  restreints à leur site — ou à une page / un groupe précis (« chemin » : facebook.com/groups/123).
const CFO_VP_PORTEES = ['locale', 'nationale', 'reseau', 'forum', 'annonces'];
const CFO_VP_PORTEES_WEB = ['reseau', 'forum', 'annonces'];
const CFO_VP_NOMS_PORTEES = ['reseau' => 'réseaux sociaux', 'forum' => 'forums', 'annonces' => 'annonces immobilières'];
/** v37.111 — l'identité d'une source : son domaine, plus sa page ou son groupe s'il y en a un (facebook.com/groups/123). */
function cfo_vp_cle(array $s): string { return (string)($s['domaine'] ?? '') . (!empty($s['chemin']) ? '/' . $s['chemin'] : ''); }

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
    $moteurs = []; $secondaires = []; $webs = [];
    foreach ($cfg['moteurs'] ?? [] as $m) {
        if (empty($m['gabarit'])) continue;
        if (($m['role'] ?? '') === 'site') $secondaires[] = $m; elseif (($m['role'] ?? '') === 'web') $webs[] = $m; else $moteurs[$m['langue'] ?? 'fr'] = $m;
    }
    // v37.40 : un média mis en pause depuis l'écran n'est pas interrogé
    $sources = array_values(array_filter($cfg['sources'] ?? [], fn($s) => ($s['actif'] ?? true) !== false && !empty($s['domaine'])));
    $locales = array_values(array_filter($sources, fn($s) => ($s['portee'] ?? '') === 'locale'));
    $sitesLocaux = cfo_vp_sites($sources, 'locale');
    //  v37.111 — la presse nationale par paquets de 10 sites (une requête trop longue est tronquée par les moteurs), chacun
    //  avec le lieu dans SA langue : les journaux arabophones avec le lieu en arabe
    $paquetsNat = function (string $lg) use ($sources): array {
        $n = array_values(array_filter($sources, fn($s) => ($s['portee'] ?? '') === 'nationale'));
        $l = array_values(array_filter($n, fn($s) => (($s['langue'] ?? 'fr') === 'ar' ? 'ar' : 'fr') === $lg)) ?: $n;
        return array_map(fn($p) => '(' . implode(' OR ', array_map(fn($s) => 'site:' . $s['domaine'], $p)) . ')', array_chunk($l, 10));
    };
    $suj = ['fr' => array_slice(array_values(array_filter($sujets, fn($s) => !cfo_vp_arabe($s))), 0, 8),     // v37.121 : 8 (catalyseurs)
            'ar' => array_slice(array_values(array_filter($sujets, fn($s) => cfo_vp_arabe($s))), 0, 8)];
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
        if ($i === 0) foreach ($paquetsNat($lg) as $paquet) $theme[] = $moteur($lg, $g . ' ' . $paquet, true, 'presse nationale');
    }
    //  v37.111 — réseaux sociaux, forums, annonces : les moteurs du web, restreints au site (les sites d'une même famille
    //  ensemble) ou à la page / au groupe précis ; les lieux des deux langues, exigés
    $webGroupes = []; $webPages = [];
    if ($tousLieux && $webs) {
        $ou = cfo_vp_ou($tousLieux);
        $web = function (array $m, string $q, string $libelle, array $plus): array {
            return ['type' => 'moteur', 'canal' => (string)($m['id'] ?? 'web'), 'nom' => (string)($m['nom'] ?? 'web'), 'libelle' => $libelle, 'q' => $q,
                    'langue' => '*', 'specifique' => true, 'url' => cfo_vp_url($m['gabarit'], $q)] + (!empty($m['format']) ? ['format' => (string)$m['format']] : []) + $plus;
        };
        foreach (CFO_VP_PORTEES_WEB as $pt) {
            $fam = array_values(array_filter($sources, fn($s) => ($s['portee'] ?? '') === $pt));
            $doms = array_values(array_unique(array_map(fn($s) => $s['domaine'], array_filter($fam, fn($s) => empty($s['chemin'])))));
            foreach (array_chunk($doms, 8) as $paquet) {
                $q = '(' . implode(' OR ', array_map(fn($d) => 'site:' . $d, $paquet)) . ') ' . $ou;
                foreach ($webs as $m) $webGroupes[] = $web($m, $q, CFO_VP_NOMS_PORTEES[$pt], ['groupe' => $pt, 'media' => ucfirst(CFO_VP_NOMS_PORTEES[$pt]) . ' (' . implode(', ', $paquet) . ')', 'domaine' => 'groupe:' . $pt . ':' . $paquet[0]]);
            }
            foreach ($fam as $s) if (!empty($s['chemin'])) {
                $q = 'site:' . cfo_vp_cle($s) . ' ' . $ou;
                foreach ($webs as $m) $webPages[] = $web($m, $q, 'site:' . cfo_vp_cle($s), ['domaine' => cfo_vp_cle($s), 'media' => $s['nom']]);
            }
        }
    }
    if ($suj['fr']) $zone[] = $moteur('fr', 'Marrakech ' . cfo_vp_ou($suj['fr']) . ($sitesLocaux ? ' ' . $sitesLocaux : ''), false, 'zone (Marrakech)');
    //  v37.121 — LES CATALYSEURS DE LA ZONE, DANS TOUTE LA PRESSE : la zone n'était cherchée que dans la presse marrakchie ;
    //  Le360, Médias24, Hespress… n'étaient interrogés qu'avec le nom exact du lieu. « Marrakech (LGV OR "Grand Stade" OR
    //  "Mondial 2030" OR stades…) », sans restriction de site, sur Google (FR, AR) et Bing.
    $catalyseurs = function (string $lg) use ($suj): array {
        $out = [];
        foreach ($suj[$lg] as $x) {
            if (in_array(cfo_vp_norm($x), array_map('cfo_vp_norm', CFO_VP_URBANISME), true) || preg_match('/^rn\s?\d/i', cfo_vp_norm($x)) || str_contains($x, 'الوطنية رقم')) continue;
            foreach (array_slice(cfo_vp_variantes($x), 0, 3) as $v) $out[] = $v;   // le sujet et ses 2 synonymes les plus parlants
        }
        return array_slice(array_values(array_unique($out)), 0, 14);
    };
    $catal = [];
    if ($c = $catalyseurs('fr')) {
        $q = 'Marrakech ' . cfo_vp_ou($c);
        $catal[] = $moteur('fr', $q, false, 'zone · catalyseurs (toute la presse)');
        foreach ($secondaires as $m) $catal[] = ['type' => 'moteur', 'canal' => (string)($m['id'] ?? 'moteur2') . '_zone', 'nom' => (string)($m['nom'] ?? 'moteur'),
            'libelle' => 'zone · catalyseurs (Bing)', 'q' => $q, 'langue' => 'fr', 'specifique' => false, 'url' => cfo_vp_url($m['gabarit'], $q)];
    }
    if ($c = $catalyseurs('ar')) $catal[] = $moteur('ar', 'مراكش ' . cfo_vp_ou($c), false, 'zone · catalyseurs (الصحافة)');
    //  v37.125 — « IL FAUT CHAMBOULER : IL N'A PAS TROUVÉ L'ARTICLE DU 360 ! » Une requête « Marrakech (A OR B OR C…) » ne remonte
    //  que les premiers résultats du mélange, différents d'une fois à l'autre. Chaque grand projet a maintenant SA requête, limitée
    //  aux 6 derniers mois (when:180d, Google Actualités) : « "Grand Stade" Marrakech », « "Mondial 2030" Marrakech »…
    $projets = [];
    foreach (['fr', 'ar'] as $lg) {
        $termes = [];
        foreach ($suj[$lg] as $x) if (!in_array(cfo_vp_norm($x), array_map('cfo_vp_norm', CFO_VP_URBANISME), true) && !preg_match('/^rn\s?\d/i', cfo_vp_norm($x)) && !str_contains($x, 'الوطنية رقم'))
            foreach (array_slice(cfo_vp_variantes($x), 0, 2) as $v) $termes[] = $v;
        foreach (array_slice(cfo_vp_grands_projets($cfg, $lg), 0, 4) as $v) $termes[] = $v;
        $vus = [];
        foreach ($termes as $v) {
            $k = cfo_vp_norm($v);
            if (isset($vus[$k]) || count($vus) >= ($lg === 'fr' ? 8 : 4)) continue;
            $vus[$k] = true;
            $projets[] = $moteur($lg, cfo_vp_guillemets($v) . ' ' . ($lg === 'ar' ? 'مراكش' : 'Marrakech') . ' when:180d', false, 'zone · ' . $v . ' (6 mois)');
        }
    }
    //  v37.121 — LES GRANDS PROJETS DE LA ZONE, toujours cherchés (veille_sources.json › grands_projets) : « Egis lance les enquêtes
    //  du plan de mobilité du Grand Marrakech » (Le Desk) ne nomme ni le lieu ni un sujet de la fiche du bien
    foreach (['fr' => 'Marrakech', 'ar' => 'مراكش'] as $lg => $ville) {
        $gp = cfo_vp_grands_projets($cfg, $lg);
        if (!$gp) continue;
        $q = $ville . ' ' . cfo_vp_ou($gp);
        $catal[] = $moteur($lg, $q, false, 'zone · grands projets' . ($lg === 'ar' ? ' (الصحافة)' : ' (toute la presse)'));
        if ($lg === 'fr') foreach ($secondaires as $m) $catal[] = ['type' => 'moteur', 'canal' => (string)($m['id'] ?? 'moteur2') . '_zone', 'nom' => (string)($m['nom'] ?? 'moteur'),
            'libelle' => 'zone · grands projets (Bing)', 'q' => $q, 'langue' => 'fr', 'specifique' => false, 'url' => cfo_vp_url($m['gabarit'], $q)];
    }
    if ($suj['ar']) $zone[] = $moteur('ar', 'مراكش ' . cfo_vp_ou($suj['ar']), false, 'zone (مراكش)');
    return array_slice(array_values(array_filter(array_merge($strict, $theme, $projets, $catal, $webGroupes, $pages, $second, $webPages, $accueil, $zone))), 0, CFO_VP_MAX_REQUETES);
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
function cfo_vp_media(array $cfg, string $hote, string $chemin = ''): ?array {
    $hote = strtolower(preg_replace('/^(www|m|web|mobile|fr|ar)\./', '', $hote));
    $chemin = strtolower(trim($chemin, '/'));
    $trouve = null;
    foreach ($cfg['sources'] ?? [] as $s) {
        $d = strtolower($s['domaine'] ?? '');
        if ($d === '' || ($hote !== $d && substr($hote, -strlen($d) - 1) !== '.' . $d)) continue;
        //  v37.111 — plusieurs pages Facebook : celle dont le chemin ouvre l'adresse ; sinon la source « tout le site »
        $c = strtolower((string)($s['chemin'] ?? ''));
        if ($c !== '') { if ($chemin === $c || str_starts_with($chemin, $c . '/')) return $s; continue; }
        $trouve = $trouve ?? $s;
    }
    return $trouve;
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
        $media = cfo_vp_media($cfg, $hote, $srcUrl ? '' : (string)parse_url($url, PHP_URL_PATH));
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
    //  v37.121 : un sujet est reconnu par lui-même OU l'un de ses synonymes (« Grand Stade » ← « Mondial 2030 », « stades »)
    $S = array_values(array_filter(array_map(fn($s) => array_values(array_filter(array_map('cfo_vp_norm', cfo_vp_variantes($s)))),
        array_merge($sujets, cfo_vp_grands_projets($cfg, 'fr'), cfo_vp_grands_projets($cfg, 'ar')))));
    $vus = []; $garde = [];
    foreach ($articles as $a) {
        if ($a['ts'] !== null && $maintenant - $a['ts'] > $fenetre) continue;
        $txt = cfo_vp_norm($a['titre'] . ' ' . $a['extrait']);
        $nl = count(array_filter($L, fn($l) => mb_strpos($txt, $l) !== false));
        $ns = count(array_filter($S, fn($vs) => (bool)array_filter($vs, fn($s) => mb_strpos($txt, $s) !== false)));
        $zone = mb_strpos($txt, 'marrakech') !== false || mb_strpos($txt, cfo_vp_norm('مراكش')) !== false;
        //  v37.123 : « large » (les candidats que l'IA vérifie ensuite) — un article de Marrakech sans sujet reconnu passe aussi
        if (!$a['specifique'] && !$nl && !($ns && $zone) && !(!empty($cfg['large']) && $zone)) continue;
        $cle = mb_substr(cfo_vp_norm($a['titre']), 0, 70);
        if (isset($vus[$cle]) || isset($vus[$a['url']])) continue;
        $vus[$cle] = $vus[$a['url']] = true;
        $age = $a['ts'] !== null ? ($maintenant - $a['ts']) / 86400 : null;
        //  v37.136 — « LE RÉSULTAT EST NUL » : un terrain de proximité de 2023, SANS DATE LUE, passait devant le Mondial 2030. Récent +2 (90 j)
        //  / +1 (1 an), sans date −1 (les dates écrites dans les pages sont maintenant lues : au-delà de la fenêtre, écarté) ; le bonus
        //  « presse locale » ne vaut que pour un article qui nomme le lieu (sinon Le360 perdait face aux échos locaux du même sujet)
        $a['score'] = 5 * $nl + $ns + ($a['portee'] === 'locale' && ($nl || $a['specifique']) ? 2 : 0)
                    + ($age === null ? -1 : ($age <= 90 ? 2 : ($age <= 365 ? 1 : 0)));
        //  v37.121 : un article qui ne nomme pas le lieu mais parle d'un catalyseur de la zone (Grand Stade, LGV…) — dit « zone »
        $a['zone'] = !$nl && !$a['specifique'];
        $garde[] = $a;
    }
    $ordre = fn($x, $y) => [$y['score'], $y['ts'] ?? 0] <=> [$x['score'], $x['ts'] ?? 0];
    usort($garde, $ordre);
    //  v37.136 — UNE MÊME HISTOIRE, UNE PLACE (deux de plus au plus, en fin de liste) : dix articles « Grand Stade · Mondial 2030 » prenaient
    //  dix places sur vingt. Même histoire = titres qui partagent plus de la moitié de leurs mots significatifs.
    $mots = function (string $t): array { $o = []; foreach (preg_split('/\s+/u', cfo_vp_norm($t)) as $w) if (mb_strlen($w) >= 4) $o[$w] = true; return $o; };
    $uniques = []; $echos = []; $vusM = [];
    foreach ($garde as $a) {
        $m = $mots($a['titre']); $echo = false;
        foreach ($vusM as $v) { $inter = count(array_intersect_key($m, $v)); $union = count($m + $v);
            if ($union > 0 && $inter / $union >= 0.5) { $echo = true; break; } }
        if ($echo) $echos[] = $a; else { $uniques[] = $a; $vusM[] = $m; }
    }
    $garde = array_merge($uniques, $echos);
    //  v37.121 — des places GARDÉES pour la zone : les articles qui nomment le lieu prenaient les 15 places, un chantier à 7,5
    //  milliards autour du Grand Stade n'avait aucune chance. Jusqu'à quota_zone places pour eux (les meilleurs), le reste au lieu ;
    //  une catégorie qui manque laisse ses places à l'autre.
    $max = (int)($cfg['max_articles'] ?? 15);
    $lieu = array_values(array_filter($garde, fn($a) => !$a['zone'])); $zoneA = array_values(array_filter($garde, fn($a) => $a['zone']));
    $k = min(count($zoneA), max(0, (int)($cfg['quota_zone'] ?? 5)));
    $pris = array_slice($lieu, 0, $max - $k);
    $pris = array_merge($pris, array_slice($zoneA, 0, $max - count($pris)));
    //  v37.136 : les échos d'une même histoire viennent APRÈS les histoires différentes (l'ordre de $garde), pas mêlés par le score
    $rang = []; foreach ($garde as $i => $a) $rang[$a['url']] = $i;
    $echoU = []; foreach ($echos as $a) $echoU[$a['url']] = true;
    usort($pris, fn($x, $y) => [isset($echoU[$x['url']]) ? 1 : 0, $y['score'], $y['ts'] ?? 0] <=> [isset($echoU[$y['url']]) ? 1 : 0, $x['score'], $x['ts'] ?? 0]);
    return array_map(function ($a) { unset($a['ts'], $a['specifique']); return $a; }, $pris);
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
        //  v37.136 — un lien qui englobe toute la carte (« 4 ديسمبر 2024بالفيديو.. titre…résumé… ») : le titre est SON intertitre,
        //  sinon son premier bloc qui n'est pas une date ; le résumé, son paragraphe ; la date, celle écrite dedans
        $carte = $titre;
        $hA = $xp->query('.//h1|.//h2|.//h3|.//h4', $a)->item(0);
        if ($hA && mb_strlen($propre($hA->textContent)) >= 15) $titre = $propre($hA->textContent);
        elseif (mb_strlen($titre) > 120) {
            foreach ($xp->query('./*', $a) as $ch) { $x = $propre($ch->textContent); $dx = cfo_vp_date_texte($x);
                if (mb_strlen($x) >= 15 && !($dx && strlen($x) - $dx[2] < 8)) { $titre = $x; break; } }
        }
        $dt = cfo_vp_date_texte($titre);
        if ($dt && $dt[1] === 0) $titre = $propre(ltrim(substr($titre, $dt[2]), " \t-–—|·:"));   // la date collée devant le titre
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
        foreach ($xp->query('.//p', $a) as $p) { if ($extrait !== '') break; $x = $propre($p->textContent); if (mb_strlen($x) >= 30 && $x !== $it['titre']) $extrait = $x; }
        //  v37.136 : pas de <time> — la date écrite dans la carte (sinon dans un petit bloc voisin) ; une page d'accueil mêle d'autres dates : pas le grand bloc
        if ($ts === null) { $d = cfo_vp_date_texte($carte) ?? ($bloc && mb_strlen($bloc->textContent) < 600 ? cfo_vp_date_texte($propre($bloc->textContent)) : null); if ($d) $ts = $d[0]; }
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

/**
 * v37.136 — UNE DATE ÉCRITE DANS LE TEXTE, quand la page n'a pas de <time> : « 4 ديسمبر 2024 », « 4 décembre 2024 »,
 * « 2024-12-04 », « 04/12/2024 ». → [ts (midi UTC), position, longueur] ou null. Mois marocains et orientaux.
 */
function cfo_vp_date_texte(string $t, ?int $maintenant = null): ?array {
    static $mois = null;
    if ($mois === null) {
        $mois = [];
        foreach ([1 => ['يناير', 'janvier'], 2 => ['فبراير', 'février', 'fevrier'], 3 => ['مارس', 'mars'], 4 => ['أبريل', 'ابريل', 'إبريل', 'avril'],
                  5 => ['ماي', 'مايو', 'mai'], 6 => ['يونيو', 'يونيه', 'juin'], 7 => ['يوليوز', 'يوليو', 'juillet'], 8 => ['غشت', 'أغسطس', 'اغسطس', 'août', 'aout'],
                  9 => ['شتنبر', 'سبتمبر', 'septembre'], 10 => ['أكتوبر', 'اكتوبر', 'octobre'], 11 => ['نونبر', 'نوفمبر', 'novembre'], 12 => ['دجنبر', 'ديسمبر', 'décembre', 'decembre']] as $m => $noms)
            foreach ($noms as $n) $mois[mb_strtolower($n)] = $m;
    }
    $an = (int)gmdate('Y', $maintenant ?? time());
    $ok = fn(int $y, int $m, int $d) => $y >= 2000 && $y <= $an + 1 && checkdate($m, $d, $y);
    $alt = implode('|', array_map(fn($n) => preg_quote($n, '/'), array_keys($mois)));
    if (preg_match('/(?<!\d)(\d{1,2})(?:er)?\s*(' . $alt . ')\s*,?\s*(\d{4})(?!\d)/iu', $t, $m, PREG_OFFSET_CAPTURE)) {
        $d = (int)$m[1][0]; $mo = $mois[mb_strtolower($m[2][0])] ?? 0; $y = (int)$m[3][0];
        if ($mo && $ok($y, $mo, $d)) return [gmmktime(12, 0, 0, $mo, $d, $y), $m[0][1], strlen($m[0][0])];
    }
    if (preg_match('/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/', $t, $m, PREG_OFFSET_CAPTURE) && $ok((int)$m[1][0], (int)$m[2][0], (int)$m[3][0]))
        return [gmmktime(12, 0, 0, (int)$m[2][0], (int)$m[3][0], (int)$m[1][0]), $m[0][1], strlen($m[0][0])];
    if (preg_match('/(?<!\d)(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})(?!\d)/', $t, $m, PREG_OFFSET_CAPTURE) && $ok((int)$m[3][0], (int)$m[2][0], (int)$m[1][0]))
        return [gmmktime(12, 0, 0, (int)$m[2][0], (int)$m[1][0], (int)$m[3][0]), $m[0][1], strlen($m[0][0])];
    return null;
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
    if (($req['format'] ?? '') === 'html_ddg') { $d = cfo_vp_lire_ddg($corps, $req, $cfg); return ['mode' => $d === null ? null : 'moteur', 'articles' => $d]; }
    if (($req['type'] ?? '') === 'page') {
        if (cfo_vp_est_flux($corps)) return ['mode' => null, 'articles' => null, 'raison' => 'flux'];
        $h = cfo_vp_lire_html($corps, $req, $cfg, (string)($req['url'] ?? ''));
        return ['mode' => $h === null ? null : 'page', 'articles' => $h];
    }
    $rss = cfo_vp_lire_rss($corps, $req, $cfg);
    return ['mode' => $rss === null ? null : 'moteur', 'articles' => $rss];
}

/**
 * v37.111 — la page de résultats de DuckDuckGo (version HTML, sans JavaScript) → articles. Les liens passent par
 * « //duckduckgo.com/l/?uddg=<adresse> » : on rend l'adresse d'origine. null si ce n'est pas une page de résultats
 * (vérification anti-robots…) : on le dit, on ne l'invente pas. Pas de date : le tri les classe après les articles datés.
 */
function cfo_vp_lire_ddg(string $html, array $req, array $cfg): ?array {
    if (!preg_match('/class="[^"]*\bresults?\b|class="[^"]*no-results/i', $html)) return null;
    $out = []; $vus = [];
    preg_match_all('#<a\b[^>]*class="[^"]*\bresult__a\b[^"]*"[^>]*>.*?</a>#is', $html, $liens, PREG_OFFSET_CAPTURE);
    foreach ($liens[0] as $k => [$a, $pos]) {
        if (!preg_match('#\bhref\s*=\s*"([^"]*)"#i', $a, $h)) continue;
        $href = html_entity_decode($h[1], ENT_QUOTES, 'UTF-8');
        $q = (string)parse_url(str_starts_with($href, '//') ? 'https:' . $href : $href, PHP_URL_QUERY);
        parse_str($q, $pq);
        $url = isset($pq['uddg']) && is_string($pq['uddg']) ? $pq['uddg'] : $href;
        if (!preg_match('#^https?://#i', $url) || isset($vus[$url])) continue;
        if (preg_match('#^https?://([a-z0-9-]+\.)*duckduckgo\.com/#i', $url)) continue;              // publicité, lien interne
        $vus[$url] = true;
        $titre = trim((string)preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags($a), ENT_QUOTES | ENT_HTML5, 'UTF-8')));
        $suite = substr($html, $pos, isset($liens[0][$k + 1]) ? $liens[0][$k + 1][1] - $pos : 4000);
        $extrait = preg_match('#class="[^"]*\bresult__snippet\b[^"]*"[^>]*>(.*?)</(?:a|div|td)>#is', $suite, $m)
            ? trim((string)preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8'))) : '';
        if ($titre === '') continue;
        $hote = (string)parse_url($url, PHP_URL_HOST);
        $media = cfo_vp_media($cfg, $hote, (string)parse_url($url, PHP_URL_PATH));
        $out[] = ['titre' => mb_substr($titre, 0, 300), 'url' => $url, 'source' => $media['nom'] ?? $hote, 'domaine' => preg_replace('/^www\./', '', strtolower($hote)),
                  'portee' => $media['portee'] ?? 'autre', 'ts' => null, 'date' => null,
                  'extrait' => mb_strlen($extrait) > 280 ? rtrim(mb_substr($extrait, 0, 277)) . '…' : $extrait,
                  'specifique' => !empty($req['specifique']), 'langue' => $req['langue'] ?? 'fr'];
        if (count($out) >= 20) break;
    }
    return $out;
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

/** v37.111 — les articles retenus qui viennent d'une source (une page précise, un site, ou une famille : réseaux sociaux…). */
function cfo_vp_retenus_de(array $retenus, array $r): int {
    if (!empty($r['groupe'])) return count(array_filter($retenus, fn($a) => ($a['portee'] ?? '') === $r['groupe']));
    $cle = strtolower((string)($r['domaine'] ?? ''));
    [$dom, $chemin] = array_pad(explode('/', $cle, 2), 2, '');
    return count(array_filter($retenus, function ($a) use ($dom, $chemin) {
        $d = strtolower((string)($a['domaine'] ?? ''));
        if ($d !== $dom && substr($d, -strlen($dom) - 1) !== '.' . $dom) return false;
        if ($chemin === '') return true;
        $p = strtolower(trim((string)parse_url((string)($a['url'] ?? ''), PHP_URL_PATH), '/'));
        return $p === $chemin || str_starts_with($p, $chemin . '/');
    }));
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

const CFO_VP_MAX_SOURCES = 100;

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
    if (!in_array($portee, CFO_VP_PORTEES, true)) return ['erreur' => 'Portée : presse locale, nationale, réseau social, forum ou annonces.'];
    $langue = $s['langue'] ?? '';
    if (!in_array($langue, ['fr', 'ar'], true)) return ['erreur' => 'Langue : français ou arabe.'];
    $out = ['nom' => $nom, 'domaine' => $dom, 'portee' => $portee, 'langue' => $langue];
    //  v37.111 — une page ou un groupe précis (réseaux sociaux, forums, annonces) : le chemin de l'adresse collée
    if (in_array($portee, CFO_VP_PORTEES_WEB, true)) {
        $ch = isset($s['chemin']) && $s['chemin'] !== '' ? (string)$s['chemin']
            : (string)(parse_url(preg_match('#^[a-z][a-z0-9+.\-]*://#i', trim((string)$s['domaine'])) ? trim((string)$s['domaine']) : 'https://' . trim((string)$s['domaine']), PHP_URL_PATH) ?? '');
        $ch = trim(rawurldecode($ch), '/');
        if ($ch !== '') {
            if (strlen($ch) > 120 || str_contains($ch, '..') || !preg_match('#^[\p{L}\p{N}._~\-@]+(?:/[\p{L}\p{N}._~\-@]+){0,4}$#u', $ch))
                return ['erreur' => "Page ou groupe : « " . mb_substr($ch, 0, 60) . " » n'est pas un chemin d'adresse (attendu : groups/123456 ou kech24)."];
            $out['chemin'] = $ch;
        }
    }
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
        $c = cfo_vp_cle($v['source']);
        if (isset($vus[$c])) { $err['s' . $i] = $c . ' figure déjà dans la liste.'; continue; }
        $vus[$c] = true; $out[] = $v['source'];
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
    foreach ($defauts as $d) if (!empty($d['domaine'])) $parDef[cfo_vp_cle($d)] = $d;
    if (!$perso || !is_array($perso['sources'] ?? null)) {
        return ['sources' => array_map(fn($d) => $d + ['origine' => 'origine'], array_values($parDef)), 'supprimees' => []];
    }
    $connus = array_flip(array_filter((array)($perso['defauts_connus'] ?? []), 'is_string'));
    $out = []; $vus = [];
    foreach ($perso['sources'] as $s) {
        $v = cfo_vp_valider_source($s);
        if (isset($v['erreur'])) continue;                    // une ligne abîmée en base ne casse pas la veille
        $s = $v['source'];
        if (isset($vus[cfo_vp_cle($s)])) continue;
        $vus[cfo_vp_cle($s)] = true;
        $d = $parDef[cfo_vp_cle($s)] ?? null;
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
    //  v37.111 — réseau social, forum, annonces : les moteurs du web, sur le site ou sur la page / le groupe précis
    if (in_array($s['portee'] ?? '', CFO_VP_PORTEES_WEB, true)) {
        $q = 'site:' . cfo_vp_cle($s) . ' (Marrakech OR مراكش)';
        $req = [];
        foreach ($cfg['moteurs'] ?? [] as $m) if (($m['role'] ?? '') === 'web' && !empty($m['gabarit']))
            $req[] = ['type' => 'moteur', 'canal' => (string)($m['id'] ?? 'web'), 'nom' => (string)($m['nom'] ?? 'web'), 'libelle' => 'test', 'q' => $q, 'langue' => '*',
                      'specifique' => true, 'url' => cfo_vp_url($m['gabarit'], $q), 'domaine' => cfo_vp_cle($s), 'media' => $s['nom']] + (!empty($m['format']) ? ['format' => (string)$m['format']] : []);
        if (!empty($s['flux'])) $req[] = ['type' => 'page', 'canal' => 'recherche', 'nom' => $s['nom'], 'libelle' => 'test', 'q' => 'Marrakech', 'langue' => $lg,
                                          'specifique' => true, 'url' => cfo_vp_url(cfo_vp_sans_flux($s['flux']), 'Marrakech'), 'domaine' => $s['domaine'], 'media' => $s['nom']];
        return $req;
    }
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
