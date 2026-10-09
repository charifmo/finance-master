# -*- coding: utf-8 -*-
"""
v37.41 Presse-Sans-RSS — la plupart des sites marrakchis n'ont pas de flux RSS
ouvert (constat sur Kech24, Marrakech Alaan…). La revue de presse ne doit ni
échouer en silence, ni dépendre d'eux.

  1. GOOGLE ACTUALITÉS, UNE REQUÊTE STRICTE PAR MÉDIA LOCAL :
       site:kech24.com ("واحة سيدي ابراهيم" OR "Ouahat Sidi Brahim")
     Jusqu'ici, un seul OR regroupait les quatre sites locaux : les petits
     médias y étaient noyés. Désormais chacun a sa porte, avec les lieux du
     bien dans les DEUX langues (un site arabophone titre parfois en français).
  2. LA PAGE DE RÉSULTATS DU SITE, LUE QUAND IL N'Y A PAS DE RSS : la recherche
     du site (« /?s=… » pour WordPress) est demandée ; si la réponse n'est pas
     un flux RSS, la page HTML de résultats est lue — les titres des articles,
     leur lien, leur date (<time>), leur chapô. Menus, barres latérales (« les
     plus lus »), catégories, liens externes : écartés. Un titre lu sur une
     page qui ne contient pas le lieu cherché (page d'accueil par
     redirection) doit nommer le lieu pour être gardé.
  3. RIEN DE SILENCIEUX : pour chaque média local, un bilan — ce que Google a
     trouvé sur son site, ce que sa propre recherche a donné (RSS, page web,
     ou fermé / injoignable, avec la cause), et le nombre d'articles retenus.
     Il s'affiche sur la carte ; les médias sans article retenu sont signalés
     à l'agent, qui doit les cibler un par un s'il cherche lui-même.
"""
import io, sys

def patch(F, pairs):
    src = io.open(F, encoding='utf-8').read()
    for label, a, b in pairs:
        n = src.count(a)
        if n != 1:
            print(f'✖ {F} — {label} : {n} ancre(s), 1 attendue'); sys.exit(1)
    for label, a, b in pairs: src = src.replace(a, b, 1)
    io.open(F, 'w', encoding='utf-8').write(src)
    print(f'✔ {len(pairs)} modification(s) appliquée(s) à {F}')

LIRE_HTML = r"""
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
"""

REQ_ANCIEN = r"""    foreach (['fr', 'ar'] as $lg) foreach (array_slice($parLangue[$lg], 0, 3) as $i => $l) {
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
    }"""

REQ_NOUVEAU = r"""    // v37.41 : CHAQUE média local a sa requête stricte — site:kech24.com ("واحة سيدي ابراهيم" OR "Ouahat
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
    }"""

patch('cfo_veille_lib.php', [
('plafond des requêtes', "const CFO_VP_MAX_REQUETES = 16;", "const CFO_VP_MAX_REQUETES = 22;   // v37.41 : une requête stricte par média local"),
('requêtes : une par média local', REQ_ANCIEN, REQ_NOUVEAU),
('lecture HTML', r"""/* ══ v37.40 — LES MÉDIAS, RÉGLABLES DEPUIS L'ÉCRAN ══════════════════════════ */""",
 LIRE_HTML + r"""
/* ══ v37.40 — LES MÉDIAS, RÉGLABLES DEPUIS L'ÉCRAN ══════════════════════════ */"""),
])

patch('cfo_veille_presse.php', [
('lecture : RSS, sinon page', r"""$articles = []; $diag = [];
foreach ($requetes as $i => $r) {
    $corpsR = $reponses[$i]['corps']; $code = $reponses[$i]['http']; $err = $reponses[$i]['erreur'];
    $d = ['source' => $r['nom'], 'libelle' => $r['libelle'], 'q' => $r['q'], 'http' => $code];
    if ($code < 200 || $code >= 300) { $d['statut'] = 'erreur'; $d['erreur'] = $err ?: ('HTTP ' . $code); $diag[] = $d; continue; }
    $lus = cfo_vp_lire_rss($corpsR, $r, $cfg);
    if ($lus === null) { $d['statut'] = 'illisible'; $d['erreur'] = "pas un flux RSS"; $diag[] = $d; continue; }
    $d['statut'] = $lus ? 'ok' : 'vide'; $d['n'] = count($lus);
    $diag[] = $d;
    array_push($articles, ...$lus);
}

$retenus = cfo_vp_selection($articles, $t['lieux'], $t['sujets'], $cfg);""", r"""$articles = []; $diag = []; $couverture = [];
foreach ($requetes as $i => $r) {
    $corpsR = $reponses[$i]['corps']; $code = $reponses[$i]['http']; $err = $reponses[$i]['erreur'];
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
    }
}

$retenus = cfo_vp_selection($articles, $t['lieux'], $t['sujets'], $cfg);
foreach ($couverture as $dom => &$c) {
    $c['retenus'] = count(array_filter($retenus, fn($a) => $a['domaine'] === $dom || substr($a['domaine'], -strlen($dom) - 1) === '.' . $dom));
}
unset($c);"""),
('bilan rendu', r"""    'requetes' => $diag,""", r"""    'requetes' => $diag,
    'couverture' => array_values($couverture),"""),
])

patch('cfo_veille_sources.php', [
('test : RSS, sinon page', r"""            $lus = cfo_vp_lire_rss($x['corps'], $r, $cfg);
            if ($lus === null) $d += ['statut' => 'illisible', 'erreur' => 'pas un flux RSS'];
            else {
                usort($lus, fn($a, $b) => ($b['ts'] ?? 0) <=> ($a['ts'] ?? 0));
                $d += ['statut' => $lus ? 'ok' : 'vide', 'n' => count($lus),""", r"""            $lu = cfo_vp_lire_reponse($x['corps'], $r, $cfg);     // v37.41 : RSS, sinon la page de résultats
            $lus = $lu['articles'];
            if ($lus === null) $d += ['statut' => 'illisible', 'erreur' => $r['type'] === 'flux' ? 'ni RSS, ni page de résultats lisible' : 'pas un flux RSS'];
            else {
                usort($lus, fn($a, $b) => ($b['ts'] ?? 0) <=> ($a['ts'] ?? 0));
                $d += ['statut' => $lus ? 'ok' : 'vide', 'n' => count($lus), 'mode' => $lu['mode'],"""),
])

patch('veille_sources.json', [
('doc', """'flux' (facultatif) : flux RSS de la recherche du site, {q} = termes recherchés.""",
 """'flux' (facultatif) : la recherche du site, {q} = termes recherchés — son RSS s'il est ouvert, sinon sa page de résultats, lue en HTML (v37.41 : la plupart des sites marrakchis n'ont pas de RSS ouvert). Chaque média local a en plus sa requête stricte Google Actualités (site:domaine)."""),
('Al Marrakchia', """"flux": "https://www.almarrakchia.net/?s={q}&feed=rss2" }""", """"flux": "https://www.almarrakchia.net/?s={q}" }"""),
('Marrakech Alaan', """"flux": "https://marrakechalaan.com/?s={q}&feed=rss2" }""", """"flux": "https://marrakechalaan.com/?s={q}" }"""),
('Kech24', """"flux": "https://www.kech24.com/?s={q}&feed=rss2" }""", """"flux": "https://www.kech24.com/?s={q}" }"""),
('Marrakech 7', """{ "nom": "Marrakech 7",     "domaine": "marrakech7.com",     "portee": "locale",    "langue": "ar" },""",
 """{ "nom": "Marrakech 7",     "domaine": "marrakech7.com",     "portee": "locale",    "langue": "ar", "flux": "https://marrakech7.com/?s={q}" },"""),
])

patch('index.html', [
('écran : recherche WordPress sans RSS', r"""                    const _vsFluxWordpress = (dom) => 'https://' + dom + '/?s={q}&feed=rss2';""",
 r"""                    //  v37.41 : la page de recherche WordPress — lue en RSS si le site en sert un, en HTML sinon
                    const _vsFluxWordpress = (dom) => 'https://' + dom + '/?s={q}';"""),
('écran : case WordPress', r"""                            <span>Le site a une recherche RSS de type WordPress (<code>/?s=…&amp;feed=rss2</code>) — l'interroger aussi directement</span>""",
 r"""                            <span>Le site a une recherche WordPress (<code>/?s=…</code>) — la lire directement : son RSS s'il est ouvert, sinon sa page de résultats</span>"""),
('écran : champ de recherche', r"""Flux RSS de recherche (facultatif — {q} = les mots cherchés)""",
 r"""Adresse de recherche du site (facultatif — RSS ou page de résultats ; {q} = les mots cherchés)"""),
('écran : badge', r"""<span v-if="s.flux" class="px-1.5 rounded bg-emerald-100 text-emerald-700">RSS du site</span>""",
 r"""<span v-if="s.flux" class="px-1.5 rounded bg-emerald-100 text-emerald-700">recherche du site</span>"""),
('écran : résultat du test', r"""{{ c.statut === 'ok' ? '✅' : (c.statut === 'vide' ? '⚪' : '❌') }} {{ c.canal === 'flux' ? 'RSS du site' : 'Google Actualités' }} :
                                                    {{ c.statut === 'ok' ? c.n + ' article' + (c.n > 1 ? 's' : '') + (c.exemple ? ' — dernier : « ' + c.exemple.titre + ' »' + (c.exemple.date ? ' (' + c.exemple.date + ')' : '') : '')
                                                       : (c.statut === 'vide' ? 'aucun article trouvé sur ce site' : (c.statut === 'illisible' ? 'le site ne répond pas en RSS' : c.erreur)) }}""",
 r"""{{ c.statut === 'ok' ? '✅' : (c.statut === 'vide' ? '⚪' : '❌') }} {{ c.canal === 'flux' ? 'Recherche du site' + (c.mode === 'page' ? ' (page web, sans RSS)' : (c.mode === 'rss' ? ' (RSS)' : '')) : 'Google Actualités' }} :
                                                    {{ c.statut === 'ok' ? c.n + ' article' + (c.n > 1 ? 's' : '') + (c.exemple ? ' — dernier : « ' + c.exemple.titre + ' »' + (c.exemple.date ? ' (' + c.exemple.date + ')' : '') : '')
                                                       : (c.statut === 'vide' ? 'aucun article trouvé sur ce site' : (c.statut === 'illisible' ? 'ni RSS, ni page de résultats lisible' : c.erreur)) }}"""),
('revue : bilan par média', r"""                            p.requetes = (d.requetes || []).length; p.ko = d.sources_ko || 0;""",
 r"""                            p.requetes = (d.requetes || []).length; p.ko = d.sources_ko || 0;
                            // v37.41 : le bilan de chaque média local, en clair — jamais d'échec silencieux
                            p.couverture = (d.couverture || []).map(c => {
                                const g = c.google, s = c.site, n = (x) => x.n + ' article' + (x.n > 1 ? 's' : '');
                                const tg = !g ? '—' : (g.statut === 'ok' ? n(g) : (g.statut === 'vide' ? 'aucun article' : 'échec (' + (g.erreur || g.statut) + ')'));
                                const ts = !s ? 'pas de recherche configurée'
                                    : (s.statut === 'ok' ? (s.mode === 'page' ? 'page de résultats lue, sans RSS' : 'RSS lu') + ' — ' + n(s)
                                    : (s.statut === 'vide' ? (s.mode === 'page' ? 'page lue, rien sur ce lieu' : 'RSS lu, rien sur ce lieu')
                                    : 'fermée ou injoignable (' + (s.erreur || s.statut) + ')'));
                                return { nom: String(c.nom || c.domaine || ''), domaine: String(c.domaine || ''), retenus: Number(c.retenus) || 0,
                                         texte: 'Google « site:' + c.domaine + ' » : ' + tg + ' · recherche du site : ' + ts };
                            });"""),
('revue : bilan initial', r"""                        const p = { ok: false, articles: [], lieux, requetes: 0, ko: 0, medias: [], erreur: '' };""",
 r"""                        const p = { ok: false, articles: [], lieux, requetes: 0, ko: 0, medias: [], couverture: [], erreur: '' };"""),
('question : médias muets', r"""                        L.push('', 'MÉTHODE OBLIGATOIRE :',
                            "1. Lis d'abord la revue de presse""", r"""                        // v37.41 : les médias locaux qui n'ont rien donné sont nommés — l'agent doit les cibler un par un
                        const muets = (p.couverture || []).filter(c => !c.retenus);
                        if (p.ok && muets.length) L.push("Médias locaux sans article retenu ici : " + muets.map(c => c.nom + ' (' + c.domaine + ')').join(', ')
                            + ". Si tu cherches toi-même, cible-les un par un, par exemple « site:" + muets[0].domaine + ' ' + (p.lieux[0] || '[lieu]') + " ».");
                        L.push('', 'MÉTHODE OBLIGATOIRE :',
                            "1. Lis d'abord la revue de presse"""),
('carte : détail par média', r"""source{{ mi.contexte.presse.ko > 1 ? 's' : '' }} injoignable{{ mi.contexte.presse.ko > 1 ? 's' : '' }}</span>
                                                        </span>
                                                    </div>""",
 r"""source{{ mi.contexte.presse.ko > 1 ? 's' : '' }} injoignable{{ mi.contexte.presse.ko > 1 ? 's' : '' }}</span>
                                                        </span>
                                                        <!-- v37.41 : le bilan de chaque média local — un RSS fermé n'est jamais un échec muet -->
                                                        <details v-if="mi.contexte.presse && mi.contexte.presse.couverture && mi.contexte.presse.couverture.length" data-mi-couverture
                                                                 :open="uiOuvert('intel.couverture', false)" @toggle="uiFixer('intel.couverture', $event.target.open)" class="w-full">
                                                            <summary class="cursor-pointer select-none text-slate-400 font-bold">Détail par média local ({{ mi.contexte.presse.couverture.filter(c => c.retenus).length }}/{{ mi.contexte.presse.couverture.length }} avec des articles retenus)</summary>
                                                            <ul class="mt-1 space-y-0.5">
                                                                <li v-for="c in mi.contexte.presse.couverture" :key="c.domaine" data-mi-media :class="c.retenus ? 'text-slate-200' : 'text-amber-300'">
                                                                    <b>{{ c.nom }}</b> — {{ c.retenus }} retenu{{ c.retenus > 1 ? 's' : '' }} · {{ c.texte }}
                                                                </li>
                                                            </ul>
                                                        </details>
                                                    </div>"""),
])
