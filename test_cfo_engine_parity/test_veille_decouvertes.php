<?php
declare(strict_types=1);
/**
 * v37.142 — LES SOURCES PROPOSÉES : enrichissement contrôlé des sources de la veille.
 *
 *   Hors ligne : aucune requête réseau réelle (fixtures en base ; le point d'entrée est lancé sous `php -S` local).
 *   A. normalisation (Public Suffix List, variantes, sous-domaines, imitations, pages sociales, paramètres)
 *   B. classement (presse, officielle, annonces, réseau, forum, vidéo, inconnu) — jamais un réseau social officiel
 *   C. extraction → occurrences → agrégation : compteurs, seuil, fusion, déduplication, conservation de l'adresse, score expliqué
 *   D. plafonds (10 nouvelles par jour et par bien, 50 visibles)
 *   E. statuts et historique (accepter, ignorer, une fois → expirée, pause, transitions refusées, sources exclues)
 *   F. activation au cycle suivant (configuration, fréquence, biens), jamais d'office
 *   G. ajout manuel amélioré (normalisé, doublon signalé, jamais écrasé, imitation à confirmer)
 *   H. le point d'entrée : permissions (en-tête, origine), actions, codes d'erreur
 *   SQLite en mémoire ; C à G rejoués sur PostgreSQL si FM_TEST_PG_DSN est donné.
 */
require_once __DIR__ . '/../cfo_veille_collecte_lib.php';

$ko = 0; $n = 0;
function v(string $titre, bool $ok, string $detail = ''): void {
    global $ko, $n; $n++; if (!$ok) $ko++;
    printf("  %s %-100s %s\n", $ok ? '✅' : '❌', $titre, $ok ? '' : mb_substr($detail, 0, 700));
}
$j = fn($x) => json_encode($x, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
echo "\n  SOURCES PROPOSÉES — normaliser, agréger, proposer ; vous décidez\n  " . str_repeat('─', 100) . "\n";
$cfg = json_decode(file_get_contents(__DIR__ . '/../veille_sources.json'), true);
$suiv = vd_suivies($cfg);

/* ── A. Normalisation ─────────────────────────────────────────────────── */
echo "\n  ▸ A. normalisation\n";
$N = fn(string $u, array $o = []) => vd_normaliser($u, $o + ['connus' => $suiv['registrables']]);
$a = $N('https://mobile.telquel.ma/2026/11/12/x.html');
v('A1. mobile.telquel.ma → variante regroupée avec telquel.ma (clé telquel.ma, sous-domaine « mobile » gardé)',
  $a['normalized_key'] === 'telquel.ma' && $a['registrable_domain'] === 'telquel.ma' && $a['subdomain'] === 'mobile' && str_contains($a['normalization_reason'], 'variante'), $j($a));
$a = vd_normaliser('https://sport.le360.ma/foot/x');
v('A2. sport.le360.ma : sous-domaine identifiable (clé sport.le360.ma, domaine enregistrable le360.ma)',
  $a['normalized_key'] === 'sport.le360.ma' && $a['registrable_domain'] === 'le360.ma' && $a['subdomain'] === 'sport' && str_contains($a['normalization_reason'], 'sous-domaine'), $j($a));
$a = vd_normaliser('https://fr.le360.ma/societe/x');
v('A3. fr.le360.ma regroupé avec le360.ma', $a['normalized_key'] === 'le360.ma' && $a['registrable_domain'] === 'le360.ma', $j($a));
$a = vd_normaliser('https://notle360.ma/x'); $b = $N('https://notle360.ma/x');
v('A4. notle360.ma n\'est JAMAIS le360.ma (clé notle360.ma) ; face à le360.ma suivi : imitation, exclue', $a['normalized_key'] === 'notle360.ma' && $a['registrable_domain'] === 'notle360.ma'
  && $a['ok'] && !$b['ok'] && str_contains((string)$b['exclusion'], 'ressemble à le360.ma'), $j([$a, $b]));
v('A5. imitations : le360-ma.com, hesspress.com repérés ; hespress.com lui-même et lematin.ma non', !$N('https://le360-ma.com/a')['ok'] && !$N('https://hesspress.com/a')['ok']
  && vd_imite('hesspress', 'hespress') && !vd_imite('hespress', 'hespress') && !vd_imite('lematin', 'le360') && !vd_imite('telquel', 'tel'));
$a = vd_normaliser('https://www.actu.press.ma/a'); $b = vd_normaliser('https://www.bbc.co.uk/news/x');
v('A6. Public Suffix List : x.press.ma et bbc.co.uk enregistrables (pas « press.ma », pas « co.uk »)',
  $a['registrable_domain'] === 'actu.press.ma' && $a['normalized_key'] === 'actu.press.ma' && $b['registrable_domain'] === 'bbc.co.uk', $j([$a['registrable_domain'], $b['registrable_domain']]));
v('A7. jokers et exceptions de la liste : a.b.kawasaki.jp (« *.kawasaki.jp »), city.kawasaki.jp (« !city.kawasaki.jp »)',
  vd_enregistrable('x.a.b.kawasaki.jp') === 'a.b.kawasaki.jp' && vd_enregistrable('www.city.kawasaki.jp') === 'city.kawasaki.jp' && vd_enregistrable('press.ma') === null && count(vd_psl()) > 9000);
$a = vd_normaliser('https://www.facebook.com/communeouahatsidibrahim/posts/123?fbclid=XYZ'); $b = vd_normaliser('https://m.facebook.com/autre.page/');
v('A8. réseaux sociaux : une source par page (facebook.com/communeouahatsidibrahim ≠ facebook.com/autre.page), m. regroupé',
  $a['normalized_key'] === 'facebook.com/communeouahatsidibrahim' && $b['normalized_key'] === 'facebook.com/autre.page' && $a['plateforme'] === 'facebook', $j([$a['normalized_key'], $b['normalized_key']]));
$g = vd_normaliser('https://facebook.com/groups/123456/permalink/9/');
v('A9. un groupe Facebook = facebook.com/groups/123456 ; une publication sans page (watch, photo.php, youtu.be, /p/…) : pas une source',
  $g['normalized_key'] === 'facebook.com/groups/123456' && !vd_normaliser('https://www.facebook.com/watch/?v=1')['normalized_key'] && !vd_normaliser('https://youtu.be/abc')['normalized_key']
  && !vd_normaliser('https://www.instagram.com/p/Cxyz/')['normalized_key'] && vd_normaliser('https://www.youtube.com/@kech24/videos')['normalized_key'] === 'youtube.com/@kech24'
  && vd_normaliser('https://twitter.com/Kech24/status/1')['normalized_key'] === 'x.com/kech24');
$u = 'https://www.kech24.com/article-1.html?utm_source=fb&utm_medium=x&id=7&fbclid=Z';
$a = vd_normaliser($u);
v('A10. paramètres de suivi retirés de l\'adresse propre ; l\'adresse d\'origine gardée telle quelle', $a['original_url'] === $u && $a['url_propre'] === 'https://www.kech24.com/article-1.html?id=7', $j($a));
$a = vd_normaliser('https://kech24.com/x?token=abc&session=1');
v('A11. paramètre sensible (token, session…) : adresse signalée et exclue', $a['parametres_sensibles'] && !$a['ok'] && str_contains((string)$a['exclusion'], 'sensible'), $j($a));
$exclues = array_map(fn($x) => vd_normaliser($x)['exclusion'], ['https://www.google.com/search?q=a', 'https://news.google.fr/x', 'https://duckduckgo.com/?q=a', 'https://search.brave.com/search?q=a',
    'https://127.0.0.1/x', 'http://localhost/a', 'https://user:pw@site.ma/', 'https://site.ma:8080/a', 'ftp://site.ma/a', 'https://bit.ly/abc', 'javascript:alert(1)', 'https://intranet.local/']);
v('A12. exclus : moteurs, lien Google Actualités sans média, IP, localhost, identifiants, port, ftp, raccourcisseur, javascript:, .local',
  count(array_filter($exclues)) === 12 && str_contains($exclues[0], 'moteur') && str_contains($exclues[1], 'Google Actualités'), $j($exclues));
$a = vd_normaliser('https://news.google.com/rss/articles/CBMiXYZ?oc=5', ['domaine_source' => 'www.nouveau-media.ma']);
v('A13. lien Google Actualités : le domaine du média (balise <source>) fait la clé, le lien Google gardé à part',
  $a['ok'] && $a['normalized_key'] === 'nouveau-media.ma' && $a['url_google'] === 'https://news.google.com/rss/articles/CBMiXYZ?oc=5' && str_contains($a['normalization_reason'], 'Google'), $j($a));
v('A14. un hôte qui EST un suffixe public (gov.ma) n\'est pas une source', vd_normaliser('https://gov.ma/')['normalized_key'] === null);

/* ── B. Classement ────────────────────────────────────────────────────── */
echo "\n  ▸ B. classement\n";
$T = fn(string $u, array $i = []) => vd_type(vd_normaliser($u), $i);
v('B1. types : gov.ma → officielle, avito.ma → annonces, facebook → réseau, youtube → vidéo, forum.x → forum, portée locale → presse, inconnu sinon',
  $T('https://www.marrakech.gov.ma/x') === 'officielle' && $T('https://www.avito.ma/fr/a/terrain_54433277.htm') === 'annonces' && $T('https://facebook.com/page1') === 'reseau'
  && $T('https://www.youtube.com/@chaine') === 'video' && $T('https://forum.immo-maroc.com/t/1') === 'forum' && $T('https://site-z.ma/a', ['portees' => ['locale']]) === 'presse'
  && $T('https://zzqx.ma/') === 'inconnu', $j([$T('https://www.marrakech.gov.ma/x'), $T('https://zzqx.ma/')]));
v('B2. une page sociale n\'est JAMAIS officielle, même une commune (facebook.com/communeouahatsidibrahim → réseau)', $T('https://facebook.com/communeouahatsidibrahim') === 'reseau'
  && isset(vd_valider_config(['type' => 'officielle'], ['type' => 'reseau', 'langue' => 'ar', 'plateforme' => 'facebook', 'chemin' => 'x', 'registrable_domain' => 'facebook.com', 'normalized_domain' => 'facebook.com'])['erreur']));
v('B3. langue : majorité de titres en arabe → ar ; sinon fr', vd_langue(['تجزئة سكنية بواحة سيدي ابراهيم', 'مشروع', 'Projet']) === 'ar' && vd_langue(['Projet', 'Lotissement', 'تجزئة']) === 'fr');
v('B4. lieu nommé : hamza et accents ignorés, frontière de mot (« Ouahat » seul ne suffit pas pour « Ouahat Sidi Brahim »)',
  vd_nomme_lieu('لجماعة واحة سيدي إبراهيم', ['واحة سيدي ابراهيم']) && vd_nomme_lieu('à OUAHAT SIDI BRAHIM, un lotissement', ['Ouahat Sidi Brahim']) && !vd_nomme_lieu('Ouahat seulement', ['Ouahat Sidi Brahim']));

/* ── C à G : en base ──────────────────────────────────────────────────── */
$T0 = 1794470400;   // 2026-11-12 00:00 UTC
$J = 86400;
function scenario(PDO $pdo, string $nom, array $cfg, int $T0, int $J, callable $j): void {
    echo "\n  ▸ $nom\n";
    vc_schema($pdo); vc_schema($pdo); vd_schema($pdo);   // migration rejouée : idempotente
    $lieux = ['Ouahat Sidi Brahim', 'واحة سيدي ابراهيم'];
    $bien = vc_cle_bien($lieux);
    $R = [
        ['type' => 'moteur', 'canal' => 'moteur', 'nom' => 'G', 'libelle' => 'l', 'q' => '"Ouahat Sidi Brahim" terrain', 'langue' => 'fr', 'url' => 'https://news.google.com/rss/search?q=t1'],
        ['type' => 'moteur', 'canal' => 'moteur', 'nom' => 'G', 'libelle' => 'l', 'q' => '"واحة سيدي ابراهيم"', 'langue' => 'ar', 'url' => 'https://news.google.com/rss/search?q=t2'],
        ['type' => 'moteur', 'canal' => 'moteur', 'nom' => 'G', 'libelle' => 'l', 'q' => 'Marrakech immobilier', 'langue' => 'fr', 'url' => 'https://news.google.com/rss/search?q=t3'],
    ];
    $ids = vc_memoriser($pdo, $bien, $lieux, ['SDAU'], $R, $T0);
    $art = fn(string $url, string $titre, ?int $ts = null, array $plus = []) => ['url' => $url, 'titre' => $titre, 'ts' => $ts, 'langue' => 'fr', 'portee' => 'autre'] + $plus;
    $U_A1 = 'https://www.actu-ouahat.ma/2026/11/lotissement.html?utm_source=x';
    //  jour 1, requête 1 (locale)
    vc_stocker($pdo, $ids[0], [
        $art($U_A1, 'Un lotissement à Ouahat Sidi Brahim', $T0 - 3600),
        $art('https://zzblog-perso.com/a', 'Un terrain à Ouahat Sidi Brahim', $T0),
        $art('https://www.marrakech.gov.ma/actualites/conseil', 'Session du conseil : Ouahat Sidi Brahim', $T0),
        $art('https://www.facebook.com/ouahatinfos/posts/1', 'جماعة واحة سيدي ابراهيم : دورة استثنائية'),
        $art('https://notle360.ma/x1', 'Ouahat Sidi Brahim : imitation'), $art('https://notle360.ma/x2', 'Ouahat Sidi Brahim : imitation 2'),
        $art('https://sport.le360.ma/x', 'Ouahat Sidi Brahim : match'), $art('https://fr.le360.ma/y', 'Ouahat Sidi Brahim : actu'),
        $art('https://www.google.com/url?q=x', 'moteur'),
        $art('https://news.google.com/rss/articles/CBM1', 'Ouahat Sidi Brahim : nouveau média', $T0, ['domaine' => 'nouveau-media.ma']),
        $art('https://pieges.ma/a?token=abc', 'Ouahat Sidi Brahim piégé'), $art('https://pieges.ma/b?token=def', 'Ouahat Sidi Brahim piégé 2'),
    ], $cfg, $T0);
    //  jour 2, requête 2 (locale, arabe) et requête 3 (pas locale)
    vc_stocker($pdo, $ids[1], [
        $art('https://mobile.actu-ouahat.ma/2026/11/route.html', 'Route de Ouahat Sidi Brahim : les travaux', $T0 + $J),
        $art('https://www.facebook.com/ouahatinfos/posts/2', 'واحة سيدي إبراهيم : مشروع'),
        $art('https://news.google.com/rss/articles/CBM2', 'واحة سيدي ابراهيم', $T0 + $J, ['domaine' => 'nouveau-media.ma']),
    ], $cfg, $T0 + $J);
    vc_stocker($pdo, $ids[2], [
        $art('https://horszone.ma/a', 'Marrakech : les prix de l\'immobilier', $T0 + $J), $art('https://horszone.ma/b', 'Marrakech : un hôtel', $T0 + $J), $art('https://horszone.ma/c', 'Agadir', $T0 + $J),
    ], $cfg, $T0 + $J);
    $m = vd_mettre_a_jour($pdo, $cfg, $T0 + $J + 60);
    $l = vd_lister($pdo, $bien);
    $P = []; foreach ($l['propositions'] as $p) $P[$p['cle']] = $p;
    $row = fn(string $k) => vd_relire($pdo, $k);
    $A = $P['actu-ouahat.ma'] ?? null;
    v('C1. extraction : chaque article devient une occurrence de SA source (mobile.actu-ouahat.ma fusionné avec actu-ouahat.ma)',
      $A && $A['occurrences'] === 2 && (int)$pdo->query("SELECT COUNT(*) FROM veille_sources_occurrences WHERE normalized_key = 'actu-ouahat.ma'")->fetchColumn() === 2, $j($A));
    v('C2. compteurs : 2 apparitions, 2 pertinentes, 2 requêtes distinctes, 2 jours, le bien, 1re et dernière vue, pertinence moyenne',
      $A && $A['pertinentes'] === 2 && $A['requetes'] === 2 && $A['jours'] === 2 && $A['biens'] === [$bien] && $A['bien'] === $bien
      && $A['premier'] === '2026-11-12' && $A['dernier'] === '2026-11-13' && abs($A['pertinence'] - 1.0) < 0.001, $j($A));
    v('C3. score expliqué : +30 lieu, +20 requête locale, +20 plusieurs requêtes, +15 plusieurs jours, +10 plusieurs articles pertinents = 95',
      $A && $A['score'] === 95 && array_column($A['raisons'], 0) === [30, 20, 20, 15, 10], $j($A['raisons'] ?? null));
    v('C4. conservation de l\'adresse : l\'exemple garde l\'URL d\'origine EXACTE (utm compris), pertinente, datée',
      $A && in_array($U_A1, array_column($A['exemples'], 'url'), true) && $A['exemples'][0]['pertinent'] && $A['exemples'][0]['date'] !== null, $j($A['exemples'] ?? null));
    $B = $row('zzblog-perso.com');
    v('C5. seuil : une source vue UNE fois reste « candidate » (2 résultats distincts exigés)', ($B['statut'] ?? '') === 'candidate' && !isset($P['zzblog-perso.com']), $j($B));
    $O = $P['marrakech.gov.ma'] ?? null;
    v('C6. une source officielle est proposée dès 1 résultat (+15 « source officielle »)', $O && $O['type'] === 'officielle' && in_array([15, 'source officielle'], $O['raisons'], true), $j($O));
    $F = $P['facebook.com/ouahatinfos'] ?? null;
    v('C7. une page Facebook locale : proposée comme RÉSEAU SOCIAL, « signal public indexé, non vérifié », −20, confiance faible, jamais officielle',
      $F && $F['type'] === 'reseau' && $F['mention'] === 'signal public indexé, non vérifié' && in_array(-20, array_column($F['raisons'], 0), true) && $F['confiance'] === 'faible', $j($F));
    v('C8. une source sans date connue : −20 « aucune date connue »', $F && in_array([-20, 'aucune date connue'], $F['raisons'], true));
    $H = $row('horszone.ma');
    v('C9. hors sujet seulement (3 articles, ni lieu nommé ni requête locale) : jamais proposée, −30 « hors zone »',
      $H && $H['statut'] === 'candidate' && str_contains($H['raisons'], 'hors zone') && !isset($P['horszone.ma']), $j($H));
    v('C10. imitation (notle360.ma, 2 résultats) : exclue, jamais proposée, jamais fusionnée avec le360.ma', ($row('notle360.ma')['statut'] ?? '') === 'candidate'
      && str_contains((string)$row('notle360.ma')['exclusion'], 'le360.ma') && !isset($P['notle360.ma']) && !$row('le360.ma'));
    v('C11. sources suivies et leurs variantes (fr.le360.ma, sport.le360.ma) : pas d\'occurrence, pas de proposition ; moteurs ignorés',
      !$row('sport.le360.ma') && !$row('le360.ma') && !$row('google.com') && (int)$pdo->query("SELECT COUNT(*) FROM veille_sources_occurrences WHERE normalized_key IN ('le360.ma', 'sport.le360.ma') OR normalized_key LIKE '%google%'")->fetchColumn() === 0);
    vc_stocker($pdo, $ids[0], [$art('https://www.facebook.com/communeouahatsidibrahim/posts/7', 'جماعة واحة سيدي ابراهيم'), $art('https://facebook.com/communeouahatsidibrahim/posts/8', 'واحة سيدي ابراهيم')], $cfg, $T0 + $J);
    vd_mettre_a_jour($pdo, $cfg, $T0 + $J + 90);
    v('C11b. la page Facebook de la commune, déjà suivie (liste des médias) : jamais proposée en double', !vd_relire($pdo, 'facebook.com/communeouahatsidibrahim'));
    v('C12. paramètres sensibles (2 résultats) : exclue, jamais proposée', str_contains((string)($row('pieges.ma')['exclusion'] ?? ''), 'sensible') && !isset($P['pieges.ma']));
    $G = $P['nouveau-media.ma'] ?? null;
    v('C13. liens Google Actualités : la source est le média (nouveau-media.ma), le lien Google gardé', $G && $G['occurrences'] === 2 && str_starts_with((string)$G['url_google'], 'https://news.google.com/'), $j($G));
    $avant = [(int)$pdo->query('SELECT COUNT(*) FROM veille_sources_occurrences')->fetchColumn(), (int)$pdo->query('SELECT COUNT(*) FROM veille_sources_historique')->fetchColumn(), $A['score'] ?? null];
    vd_mettre_a_jour($pdo, $cfg, $T0 + $J + 120); vd_mettre_a_jour($pdo, $cfg, $T0 + $J + 180);
    $apres = [(int)$pdo->query('SELECT COUNT(*) FROM veille_sources_occurrences')->fetchColumn(), (int)$pdo->query('SELECT COUNT(*) FROM veille_sources_historique')->fetchColumn(), vd_lister($pdo, $bien)['propositions'][0]['score'] ?? null];
    v('C14. déduplication : rejouer l\'agrégation ne double ni les occurrences, ni l\'historique, ni le score', $avant === $apres, $j([$avant, $apres]));
    vc_stocker($pdo, $ids[0], [$art($U_A1, 'Un lotissement à Ouahat Sidi Brahim', $T0 - 3600)], $cfg, $T0 + 2 * $J);
    vd_mettre_a_jour($pdo, $cfg, $T0 + 2 * $J + 60);
    v('C15. le même article revu le lendemain : aucune occurrence de plus (dédupliqué par article × requête × bien)', (int)$pdo->query("SELECT COUNT(*) FROM veille_sources_occurrences WHERE normalized_key = 'actu-ouahat.ma'")->fetchColumn() === 2);
    $h = vd_historique($pdo, 'actu-ouahat.ma');
    v('C16. la proposition est historisée : candidate → proposed, origine « systeme », raison (critère, score)',
      count($h) === 1 && $h[0]['ancien'] === 'candidate' && $h[0]['nouveau'] === 'proposed' && $h[0]['origine'] === 'systeme' && str_contains($h[0]['raison'], '2 résultats distincts'), $j($h));
    v('F1. JAMAIS d\'activation automatique : aucune source proposée n\'entre dans la collecte', vd_sources_actives($pdo, null, $T0 + 3 * $J) === []);

    /* ── E. Statuts ── */
    $r = vd_decider($pdo, 'actu-ouahat.ma', 'accepter', ['raison' => 'journal local fiable'], $T0 + 3 * $J);
    $h = vd_historique($pdo, 'actu-ouahat.ma');
    v('E1. Accepter : accepted, décision historisée (ancien proposed, nouveau accepted, date, origine « utilisateur », raison)',
      ($r['source']['statut'] ?? '') === 'accepted' && $h[0]['ancien'] === 'proposed' && $h[0]['nouveau'] === 'accepted' && $h[0]['origine'] === 'utilisateur'
      && $h[0]['raison'] === 'journal local fiable' && $h[0]['date'] === gmdate('Y-m-d\TH:i:s\Z', $T0 + 3 * $J), $j([$r, $h]));
    v('E2. transition refusée : « reprendre » une source acceptée (TRANSITION), action inconnue refusée',
      (vd_decider($pdo, 'actu-ouahat.ma', 'reprendre', [], $T0 + 3 * $J)['code'] ?? '') === 'TRANSITION' && (vd_decider($pdo, 'actu-ouahat.ma', 'detruire')['code'] ?? '') === 'ACTION_INCONNUE');
    v('E3. pause puis reprendre : paused → accepted', (vd_decider($pdo, 'actu-ouahat.ma', 'pause', [], $T0 + 3 * $J)['source']['statut'] ?? '') === 'paused'
      && vd_sources_actives($pdo, null, $T0 + 3 * $J) === [] && (vd_decider($pdo, 'actu-ouahat.ma', 'reprendre', [], $T0 + 3 * $J)['source']['statut'] ?? '') === 'accepted');
    v('E4. une source exclue (imitation) ne peut pas être acceptée depuis les propositions (EXCLUE)', (vd_decider($pdo, 'notle360.ma', 'accepter')['code'] ?? '') === 'EXCLUE');
    v('E5. Ignorer : rejected ; à l\'agrégation suivante, −50 « déjà ignorée » et JAMAIS reproposée',
      (vd_decider($pdo, 'nouveau-media.ma', 'ignorer', ['raison' => 'hors sujet'], $T0 + 3 * $J)['source']['statut'] ?? '') === 'rejected'
      && vd_mettre_a_jour($pdo, $cfg, $T0 + 3 * $J + 10) !== [] && vd_relire($pdo, 'nouveau-media.ma')['statut'] === 'rejected'
      && str_contains(vd_relire($pdo, 'nouveau-media.ma')['raisons'], 'déjà ignorée') && !in_array('nouveau-media.ma', array_column(vd_lister($pdo, $bien)['propositions'], 'cle'), true));
    $u1 = vd_decider($pdo, 'marrakech.gov.ma', 'une_fois', [], $T0 + 3 * $J);
    $act = array_column(vd_sources_actives($pdo, null, $T0 + 3 * $J + 100), 'domaine'); sort($act);
    v('E6. Surveiller une fois : one_time, active 48 h (avec actu-ouahat.ma acceptée)', ($u1['source']['statut'] ?? '') === 'one_time' && $act === ['actu-ouahat.ma', 'marrakech.gov.ma'], $j([$u1, $act]));
    $mx = vd_mettre_a_jour($pdo, $cfg, $T0 + 5 * $J + 200);
    v('E7. 48 h plus tard : expired (historisé « surveillance unique terminée »), plus active', vd_relire($pdo, 'marrakech.gov.ma')['statut'] === 'expired' && $mx['expirees'] >= 1
      && vd_historique($pdo, 'marrakech.gov.ma')[0]['raison'] === 'surveillance unique terminée' && array_column(vd_sources_actives($pdo, null, $T0 + 5 * $J + 300), 'domaine') === ['actu-ouahat.ma']);
    v('E8. Modifier avant acceptation : une page sociale « officielle » refusée ; en confiance « forte » refusée',
      (vd_decider($pdo, 'facebook.com/ouahatinfos', 'modifier', ['type' => 'officielle'])['code'] ?? '') === 'CONFIG_INVALIDE'
      && (vd_decider($pdo, 'facebook.com/ouahatinfos', 'modifier', ['type' => 'reseau', 'confiance' => 'forte'])['code'] ?? '') === 'CONFIG_INVALIDE');
    $mf = vd_decider($pdo, 'facebook.com/ouahatinfos', 'modifier', ['nom' => 'Ouahat infos (Facebook)', 'type' => 'reseau', 'langue' => 'ar', 'frequence' => '3h',
        'mode' => 'signal', 'confiance' => 'moyenne', 'requetes' => ['دورة استثنائية'], 'biens' => [$bien, 'pas-une-cle'], 'note' => 'page officielle de la commune <b>?</b>', 'accepter' => true], $T0 + 5 * $J + 400);
    v('E9. Modifier puis accepter : configuration contrôlée (biens valides seuls, note nettoyée, mention sociale), statut accepted',
      ($mf['source']['statut'] ?? '') === 'accepted' && $mf['source']['config']['biens'] === [$bien] && $mf['source']['config']['note'] === 'page officielle de la commune ?'
      && $mf['source']['config']['mention'] === 'signal public indexé, non vérifié' && $mf['source']['config']['frequence'] === '3h', $j($mf));

    /* ── F. Activation au cycle suivant ── */
    $act = vd_sources_actives($pdo, $bien, $T0 + 6 * $J);
    $fb = array_values(array_filter($act, fn($s) => ($s['chemin'] ?? '') === 'ouahatinfos'))[0] ?? null;
    v('F2. activée au cycle suivant : la page Facebook devient une source « réseau » (domaine + page), fréquence 3 h, mention, origine « proposee »',
      $fb && $fb['domaine'] === 'facebook.com' && $fb['portee'] === 'reseau' && $fb['frequence'] === '3h' && $fb['origine'] === 'proposee' && $fb['mention'] === 'signal public indexé, non vérifié'
      && !isset(cfo_vp_valider_source($fb)['erreur']), $j($act));
    v('F3. une source réservée à un bien n\'est pas collectée pour un autre', !array_filter(vd_sources_actives($pdo, str_repeat('0', 20), $T0 + 6 * $J), fn($s) => ($s['chemin'] ?? '') === 'ouahatinfos'));
    $fus = vd_fusionner_actives([['nom' => 'Actu', 'domaine' => 'actu-ouahat.ma', 'portee' => 'locale', 'langue' => 'fr']], $act);
    v('F4. fusion avec la liste des médias : une source déjà présente n\'est pas doublée (la liste des médias l\'emporte)',
      count(array_filter($fus, fn($s) => $s['domaine'] === 'actu-ouahat.ma')) === 1 && count($fus) === count($act), $j($fus));
    $cfgA = $cfg; $cfgA['sources'] = vd_fusionner_actives($cfg['sources'], $act);
    $Rq = cfo_vp_requetes($cfgA, $lieux, ['SDAU']);
    $rFb = array_values(array_filter($Rq, fn($r) => str_contains((string)($r['q'] ?? ''), 'facebook.com/ouahatinfos')));
    v('F5. la collecte suivante interroge la page (moteurs du web, site:facebook.com/ouahatinfos) avec sa fréquence',
      $rFb && ($rFb[0]['frequence'] ?? '') === '3h', $j(array_slice($rFb, 0, 1)));
    //  la fréquence honorée par le planificateur : « 3h » → une tâche par tranche de 3 h, « demande » → jamais rejouée par le cron
    $idsF = vc_memoriser($pdo, $bien, $lieux, ['SDAU'], [
        ['type' => 'moteur', 'q' => 'f3h', 'langue' => 'fr', 'url' => 'https://www.bing.com/search?q=f3h', 'frequence' => '3h'],
        ['type' => 'moteur', 'q' => 'fdem', 'langue' => 'fr', 'url' => 'https://www.bing.com/search?q=fdem', 'frequence' => 'demande'],
        ['type' => 'page', 'q' => 'fq', 'langue' => 'fr', 'url' => 'https://exemple-f.ma/?s=fq', 'frequence' => 'quotidienne'],
    ], $T0 + 6 * $J);
    $pdo->exec('DELETE FROM veille_jobs');
    vc_planifier($pdo, false, $T0 + 6 * $J + 3600);
    vc_planifier($pdo, false, $T0 + 6 * $J + 5 * 3600);
    $jobs = fn(int $id) => $pdo->query('SELECT jour FROM veille_jobs WHERE requete_id = ' . $id . ' ORDER BY jour')->fetchAll(PDO::FETCH_COLUMN);
    v('F6. fréquence : « 3h » → 2 tâches sur deux tranches, « demande » → aucune, « quotidienne » (page) → 1 par jour',
      count($jobs($idsF[0])) === 2 && $jobs($idsF[1]) === [] && count($jobs($idsF[2])) === 1, $j([$jobs($idsF[0]), $jobs($idsF[1]), $jobs($idsF[2])]));

    /* ── G. Ajout manuel amélioré ── */
    $g1 = vd_ajouter($pdo, $cfg, ['url' => 'https://www.chaabpress.com/rubrique/x?utm_source=a', 'nom' => 'Chaab Press', 'type' => 'presse', 'langue' => 'ar', 'frequence' => 'quotidienne',
        'note' => 'cité par la commune', 'confiance' => 'moyenne', 'biens' => [$bien]], $T0 + 6 * $J);
    v('G1. ajout manuel : normalisé (chaabpress.com), accepté d\'emblée (origine « manuel »), historisé, actif au cycle suivant',
      ($g1['source']['cle'] ?? '') === 'chaabpress.com' && $g1['source']['statut'] === 'accepted' && $g1['source']['origine'] === 'manuel'
      && vd_historique($pdo, 'chaabpress.com')[0]['origine'] === 'manuel' && in_array('chaabpress.com', array_column(vd_sources_actives($pdo, $bien, $T0 + 6 * $J), 'domaine'), true)
      && in_array('chaabpress.com', array_column(vd_lister($pdo, $bien)['suivies'], 'cle'), true) && !in_array('chaabpress.com', array_column(vd_lister($pdo, str_repeat('0', 20))['suivies'], 'cle'), true), $j($g1));
    $g2 = vd_ajouter($pdo, $cfg, ['url' => 'https://m.chaabpress.com/autre', 'nom' => 'Autre nom', 'type' => 'forum', 'langue' => 'fr']);
    v('G2. doublon (m.chaabpress.com = chaabpress.com) : SIGNALÉ, rien n\'est écrasé (nom, type, langue inchangés)',
      ($g2['code'] ?? '') === 'DOUBLON' && $g2['doublon']['cle'] === 'chaabpress.com' && vd_relire($pdo, 'chaabpress.com')['type'] === 'presse' && vd_relire($pdo, 'chaabpress.com')['langue'] === 'ar', $j($g2));
    $g3 = vd_ajouter($pdo, $cfg, ['url' => 'fr.le360.ma/economie', 'nom' => 'Le360 bis']);
    v('G3. doublon d\'un média déjà suivi (fr.le360.ma → le360.ma) : signalé, renvoie à la liste des médias', ($g3['code'] ?? '') === 'DOUBLON' && $g3['doublon']['ou'] === 'medias', $j($g3));
    $g4 = vd_ajouter($pdo, $cfg, ['url' => 'https://hesspress.com', 'nom' => 'Hesspress']);
    $g5 = vd_ajouter($pdo, $cfg, ['url' => 'https://hesspress.com', 'nom' => 'Hesspress', 'confirmer' => true]);
    v('G4. une imitation d\'une source suivie demande confirmation ; confirmée, elle est ajoutée (et l\'exclusion reste écrite)',
      ($g4['code'] ?? '') === 'A_CONFIRMER' && ($g5['source']['statut'] ?? '') === 'accepted' && (string)$g5['source']['exclusion'] !== '', $j([$g4, $g5]));
    v('G5. refusés : paramètre sensible, localhost, page sociale « officielle », adresse vide',
      (vd_ajouter($pdo, $cfg, ['url' => 'https://site-s.ma/?token=1'])['code'] ?? '') === 'ADRESSE_INVALIDE' && (vd_ajouter($pdo, $cfg, ['url' => 'http://localhost/x'])['code'] ?? '') === 'ADRESSE_INVALIDE'
      && (vd_ajouter($pdo, $cfg, ['url' => 'https://facebook.com/pagex', 'type' => 'officielle'])['code'] ?? '') === 'CONFIG_INVALIDE' && (vd_ajouter($pdo, $cfg, ['url' => ''])['code'] ?? '') === 'ADRESSE_INVALIDE');

    /* ── D. Plafonds ── */
    $lieux2 = ['Tamansourt']; $bien2 = vc_cle_bien($lieux2);
    $ids2 = vc_memoriser($pdo, $bien2, $lieux2, [], [['type' => 'moteur', 'q' => 'Tamansourt', 'langue' => 'fr', 'url' => 'https://news.google.com/rss/search?q=tam']], $T0 + 10 * $J);
    $arts = [];
    for ($i = 1; $i <= 12; $i++) foreach (['a', 'b'] as $k) $arts[] = ['url' => "https://media$i-tam.ma/$k", 'titre' => "Tamansourt : article $k du média $i", 'ts' => $T0 + 10 * $J, 'langue' => 'fr'];
    vc_stocker($pdo, $ids2[0], $arts, $cfg, $T0 + 10 * $J);
    $m1 = vd_mettre_a_jour($pdo, $cfg, $T0 + 10 * $J + 60);
    $m2 = vd_mettre_a_jour($pdo, $cfg, $T0 + 10 * $J + 120);
    $n2 = count(vd_lister($pdo, $bien2)['propositions']);
    $m3 = vd_mettre_a_jour($pdo, $cfg, $T0 + 11 * $J + 60);
    v('D1. plafond : 12 sources qualifiées → 10 proposées aujourd\'hui (pas une de plus en rejouant), les 2 autres le lendemain',
      $m1['proposees'] === 10 && $m2['proposees'] === 0 && $n2 === 10 && $m3['proposees'] === 2 && count(vd_lister($pdo, $bien2)['propositions']) === 12, $j([$m1, $m2, $n2, $m3]));
    $ins = $pdo->prepare("INSERT INTO veille_sources_decouvertes (normalized_key, original_url, normalized_domain, registrable_domain, statut, score, bien_principal, biens, premier, dernier, maj)
                          VALUES (?, ?, ?, ?, 'proposed', ?, ?, ?, ?, ?, ?)");
    for ($i = 0; $i < 55; $i++) $ins->execute(["vis$i.ma", "https://vis$i.ma/", "vis$i.ma", "vis$i.ma", $i, 'b' . str_repeat('9', 19), $j(['b' . str_repeat('9', 19)]), $T0, $T0, $T0]);
    $lv = vd_lister($pdo, 'b' . str_repeat('9', 19));
    v('D2. 50 propositions visibles par bien au plus, les meilleurs scores d\'abord', count($lv['propositions']) === 50 && $lv['propositions'][0]['score'] === 54 && $lv['plafond_visible'] === 50, (string)count($lv['propositions']));
    v('D3. unicité : la clé normalisée est UNIQUE en base (un doublon direct est refusé par la contrainte)',
      (function () use ($ins, $T0, $j) { try { $ins->execute(['vis1.ma', 'https://vis1.ma/', 'vis1.ma', 'vis1.ma', 1, 'x', '[]', $T0, $T0, $T0]); return false; } catch (Throwable $e) { return true; } })());
    v('D4. contrainte : un statut inconnu est refusé par la base',
      (function () use ($pdo, $T0) { try { $pdo->exec("INSERT INTO veille_sources_decouvertes (normalized_key, original_url, normalized_domain, registrable_domain, statut, premier, dernier, maj) VALUES ('st.ma', 'https://st.ma/', 'st.ma', 'st.ma', 'active', $T0, $T0, $T0)"); return false; } catch (Throwable $e) { return true; } })());
    $e = vc_etat($pdo, $T0 + 11 * $J);
    v('D5. « etat » compte les sources proposées et acceptées', is_int($e['sources_proposees']) && $e['sources_proposees'] > 0 && $e['sources_acceptees'] >= 3, $j([$e['sources_proposees'], $e['sources_acceptees']]));
}

$lite = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
try { scenario($lite, 'C–G. SQLite (en mémoire)', $cfg, $T0, $J, $j); }
catch (Throwable $e) { v('SQLite : exécution sans exception', false, $e->getMessage() . ' @' . $e->getLine() . ' ' . $e->getTraceAsString()); }
$dsn = getenv('FM_TEST_PG_DSN');
if ($dsn) {
    try {
        $pg = new PDO($dsn, getenv('FM_TEST_PG_USER') ?: null, getenv('FM_TEST_PG_PASS') ?: null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        foreach (['veille_biens', 'veille_requetes', 'veille_requete_biens', 'veille_jobs', 'veille_articles', 'veille_hits', 'veille_domaines', 'veille_budget',
                  'veille_sources_decouvertes', 'veille_sources_occurrences', 'veille_sources_historique', 'veille_decouvertes_etat'] as $t) $pg->exec("DROP TABLE IF EXISTS $t");
        scenario($pg, 'C–G. PostgreSQL (' . $pg->query('SHOW server_version')->fetchColumn() . ')', $cfg, $T0, $J, $j);
    } catch (Throwable $e) { v('PostgreSQL : exécution sans exception', false, $e->getMessage() . ' @' . $e->getLine()); }
}

/* ── H. Le point d'entrée, sous php -S (local) ────────────────────────── */
echo "\n  ▸ H. le point d'entrée (php -S local, base SQLite)\n";
$dir = sys_get_temp_dir() . '/vdx_' . getmypid();
@mkdir($dir); @mkdir($dir . '/finance');
foreach (['cfo_veille_decouvertes.php', 'cfo_veille_decouvertes_lib.php', 'cfo_veille_domaines.php', 'cfo_veille_collecte_lib.php', 'cfo_veille_lib.php', 'cfo_veille_serveur.php', 'veille_sources.json', 'veille_psl.dat'] as $f)
    copy(__DIR__ . '/../' . $f, $dir . '/finance/' . $f);
$base = $dir . '/veille.sqlite';
$pdoH = new PDO('sqlite:' . $base, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
vc_schema($pdoH);
$lieuxH = ['Ouahat Sidi Brahim']; $bienH = vc_cle_bien($lieuxH);
$idsH = vc_memoriser($pdoH, $bienH, $lieuxH, [], [['type' => 'moteur', 'q' => 'Ouahat Sidi Brahim', 'langue' => 'fr', 'url' => 'https://news.google.com/rss/search?q=h']], $T0);
vc_stocker($pdoH, $idsH[0], [['url' => 'https://journal-h.ma/1', 'titre' => 'Ouahat Sidi Brahim : 1', 'ts' => $T0], ['url' => 'https://journal-h.ma/2', 'titre' => 'Ouahat Sidi Brahim : 2', 'ts' => $T0]], $cfg, $T0);
vd_mettre_a_jour($pdoH, $cfg, $T0 + 60);
$pdoH = null;
$sock = stream_socket_server('tcp://127.0.0.1:0'); $port = (int)explode(':', stream_socket_get_name($sock, false))[1]; fclose($sock);
$proc = proc_open([PHP_BINARY, '-S', '127.0.0.1:' . $port, '-t', $dir], [['pipe', 'r'], ['file', '/dev/null', 'w'], ['file', '/dev/null', 'w']], $pipes, null,
                  array_merge(getenv(), ['FM_VEILLE_DSN' => 'sqlite:' . $base]));
$appel = function (?array $corps, array $entetes = ['X-Requested-With: XMLHttpRequest']) use ($port): array {
    $ctx = stream_context_create(['http' => ['method' => $corps === null ? 'GET' : 'POST', 'ignore_errors' => true, 'timeout' => 10,
        'header' => array_merge(['Content-Type: application/json', 'Host: 127.0.0.1:' . $port], $entetes), 'content' => $corps === null ? '' : json_encode($corps)]]);
    $t = @file_get_contents('http://127.0.0.1:' . $port . '/finance/cfo_veille_decouvertes.php', false, $ctx);
    $code = isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m) ? (int)$m[1] : 0;
    return ['code' => $code, 'd' => json_decode((string)$t, true), 't' => (string)$t];
};
for ($i = 0; $i < 50 && $appel(null)['code'] === 0; $i++) usleep(100000);
try {
    $g = $appel(null);
    v('H1. GET : 200, la proposition journal-h.ma, compteurs', $g['code'] === 200 && ($g['d']['propositions'][0]['cle'] ?? '') === 'journal-h.ma' && ($g['d']['compteurs']['proposed'] ?? 0) === 1, $g['t']);
    v('H2. POST sans X-Requested-With → 400 ; d\'une autre origine → 403', $appel(['action' => 'accepter', 'cle' => 'journal-h.ma'], [])['code'] === 400
      && $appel(['action' => 'accepter', 'cle' => 'journal-h.ma'], ['X-Requested-With: x', 'Origin: https://evil.example'])['code'] === 403 && vd_relire(new PDO('sqlite:' . $base), 'journal-h.ma')['statut'] === 'proposed');
    $li = $appel(['action' => 'lister', 'lieux' => $lieuxH]);
    v('H3. lister pour UN bien (ses lieux → sa clé)', $li['code'] === 200 && $li['d']['bien'] === $bienH && count($li['d']['propositions']) === 1, $li['t']);
    $ex = $appel(['action' => 'exemples', 'cle' => 'journal-h.ma']);
    v('H4. exemples et historique', $ex['code'] === 200 && count($ex['d']['exemples']) === 2 && $ex['d']['historique'][0]['nouveau'] === 'proposed', $ex['t']);
    $ac = $appel(['action' => 'accepter', 'cle' => 'journal-h.ma', 'raison' => 'ok']);
    v('H5. accepter → 200 accepted ; refaire → 409 (transition)', $ac['code'] === 200 && $ac['d']['source']['statut'] === 'accepted' && $appel(['action' => 'accepter', 'cle' => 'journal-h.ma'])['code'] === 409, $ac['t']);
    v('H6. source inconnue → 404 ; action inconnue → 400 ; clé manquante → 400', $appel(['action' => 'ignorer', 'cle' => 'inconnue.ma'])['code'] === 404
      && $appel(['action' => 'detruire', 'cle' => 'x'])['code'] === 400 && $appel(['action' => 'accepter'])['code'] === 400);
    $aj = $appel(['action' => 'ajouter', 'url' => 'https://www.nouvelle-h.ma/a', 'nom' => 'Nouvelle H', 'type' => 'presse', 'langue' => 'fr', 'lieux' => $lieuxH]);
    $aj2 = $appel(['action' => 'ajouter', 'url' => 'https://nouvelle-h.ma/b', 'nom' => 'Autre']);
    v('H7. ajouter → 200 (rattachée au bien) ; le même site → 409 DOUBLON, rien d\'écrasé', $aj['code'] === 200 && $aj['d']['source']['config']['biens'] === [$bienH]
      && $aj2['code'] === 409 && $aj2['d']['error'] === 'DOUBLON' && $aj2['d']['doublon']['cle'] === 'nouvelle-h.ma', $aj['t'] . ' | ' . $aj2['t']);
} finally {
    proc_terminate($proc); proc_close($proc);
    @array_map('unlink', glob($dir . '/finance/*') ?: []); @rmdir($dir . '/finance'); @unlink($base); @rmdir($dir);
}

echo "  " . str_repeat('─', 100) . "\n";
echo $ko === 0 ? "  ✅ TOUT PASSE — $n contrôles\n" : "  ❌ $ko contrôle(s) en échec sur $n\n";
exit($ko === 0 ? 0 : 1);
