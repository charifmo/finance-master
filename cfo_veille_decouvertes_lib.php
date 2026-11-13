<?php
declare(strict_types=1);
/**
 * ============================================================================
 *  cfo_veille_decouvertes_lib.php — LES SOURCES PROPOSÉES (v37.142)
 * ----------------------------------------------------------------------------
 *  L'enrichissement CONTRÔLÉ des sources de la veille :
 *     collecte → enregistrement → normalisation → agrégation → propositions
 *     → décision (vous) → activation au prochain cycle.
 *
 *  • Chaque article collecté (veille_articles × ses requêtes × leurs biens)
 *    devient une OCCURRENCE de la source qu'il représente (clé normalisée par
 *    cfo_veille_domaines.php, adresse d'origine gardée telle quelle).
 *  • Les occurrences sont AGRÉGÉES par source : apparitions, apparitions
 *    pertinentes (le titre nomme un lieu du bien), requêtes distinctes, jours
 *    distincts, biens, première / dernière vue, pertinence moyenne, exemples.
 *  • Un SCORE déterministe, avec ses raisons (barème ci-dessous). Aucune IA.
 *  • Une source devient « proposée » : 2 résultats distincts au moins, ou
 *    1 seul venant d'une source officielle, ou un ajout manuel — et jamais si
 *    elle est exclue (moteur, adresse invalide, imitation, paramètre sensible,
 *    hors sujet seulement). 10 nouvelles propositions par jour et par bien au
 *    plus ; 50 visibles par bien.
 *  • JAMAIS d'activation automatique : seule votre décision (Accepter,
 *    Surveiller une fois) fait entrer une source dans la collecte, au cycle
 *    suivant. Chaque décision est historisée (ancien, nouveau, date, origine, raison).
 *  • Une source sociale reste « signal public indexé, non vérifié » : jamais
 *    officielle, jamais lue directement (seuls les moteurs la voient).
 *
 *  SQL portable PostgreSQL (production) / SQLite (tests) : comme la collecte.
 * ============================================================================
 */
require_once __DIR__ . '/cfo_veille_lib.php';
require_once __DIR__ . '/cfo_veille_domaines.php';

const VD_STATUTS = ['candidate', 'proposed', 'accepted', 'rejected', 'one_time', 'paused', 'expired'];
const VD_MAX_NOUVELLES_JOUR = 10;   // nouvelles propositions par jour et par bien
const VD_MAX_VISIBLES = 50;         // propositions visibles par bien
const VD_DUREE_UNE_FOIS = 172800;   // « Surveiller une fois » : 48 h, le temps d'un cycle de collecte et d'une revue
const VD_JOURS_EXPIRATION = 90;     // une proposition plus revue depuis 90 jours expire
const VD_FREQUENCES = ['quotidienne', '3h', 'demande'];
const VD_MODES = ['moteur', 'recherche', 'accueil', 'rss', 'sitemap', 'signal'];
const VD_CONFIANCES = ['faible', 'moyenne', 'forte'];
const VD_MENTION_SOCIALE = 'signal public indexé, non vérifié';
//  les transitions qu'une DÉCISION peut faire (les automatiques sont dans vd_mettre_a_jour)
const VD_TRANSITIONS = [
    'accepter'  => ['candidate', 'proposed', 'rejected', 'one_time', 'paused', 'expired'],
    'ignorer'   => ['candidate', 'proposed', 'accepted', 'one_time', 'paused', 'expired'],
    'une_fois'  => ['candidate', 'proposed', 'rejected', 'paused', 'expired'],
    'pause'     => ['accepted', 'one_time'],
    'reprendre' => ['paused'],
];
const VD_CIBLES = ['accepter' => 'accepted', 'ignorer' => 'rejected', 'une_fois' => 'one_time', 'pause' => 'paused', 'reprendre' => 'accepted'];

/** La migration : trois tables et leurs index, idempotente (CREATE … IF NOT EXISTS). Voir migrations/v37142_sources_proposees.sql. */
function vd_schema(PDO $pdo): void {
    $id = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite' ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'BIGSERIAL PRIMARY KEY';
    foreach ([
        "CREATE TABLE IF NOT EXISTS veille_sources_decouvertes (id $id, normalized_key TEXT NOT NULL UNIQUE, original_url TEXT NOT NULL,
            url_google TEXT, normalized_domain TEXT NOT NULL, registrable_domain TEXT NOT NULL, subdomain TEXT NOT NULL DEFAULT '', chemin TEXT NOT NULL DEFAULT '',
            plateforme TEXT, normalization_reason TEXT NOT NULL DEFAULT '', type TEXT NOT NULL DEFAULT 'inconnu', langue TEXT NOT NULL DEFAULT 'fr',
            statut TEXT NOT NULL DEFAULT 'candidate', origine TEXT NOT NULL DEFAULT 'decouverte', exclusion TEXT,
            score INTEGER NOT NULL DEFAULT 0, raisons TEXT NOT NULL DEFAULT '[]',
            occurrences INTEGER NOT NULL DEFAULT 0, occurrences_pertinentes INTEGER NOT NULL DEFAULT 0, requetes_distinctes INTEGER NOT NULL DEFAULT 0,
            jours_distincts INTEGER NOT NULL DEFAULT 0, biens TEXT NOT NULL DEFAULT '[]', bien_principal TEXT, premier BIGINT NOT NULL, dernier BIGINT NOT NULL,
            pertinence_moyenne REAL NOT NULL DEFAULT 0, exemples TEXT NOT NULL DEFAULT '[]', config TEXT NOT NULL DEFAULT '{}',
            propose_le BIGINT, decide_le BIGINT, expire_le BIGINT, maj BIGINT NOT NULL,
            CHECK (statut IN ('candidate','proposed','accepted','rejected','one_time','paused','expired')),
            CHECK (type IN ('presse','officielle','annonces','reseau','forum','video','inconnu')))",
        "CREATE INDEX IF NOT EXISTS veille_sd_statut ON veille_sources_decouvertes (statut, score)",
        "CREATE INDEX IF NOT EXISTS veille_sd_bien ON veille_sources_decouvertes (bien_principal, statut)",
        "CREATE INDEX IF NOT EXISTS veille_sd_registrable ON veille_sources_decouvertes (registrable_domain)",
        "CREATE TABLE IF NOT EXISTS veille_sources_occurrences (id $id, normalized_key TEXT NOT NULL, article_url TEXT NOT NULL, original_url TEXT NOT NULL,
            url_google TEXT, bien TEXT NOT NULL, requete_id BIGINT NOT NULL, requete_q TEXT, requete_locale INTEGER NOT NULL DEFAULT 0,
            jour TEXT NOT NULL, titre TEXT NOT NULL, extrait TEXT, ts BIGINT, langue TEXT, portee TEXT, pertinent INTEGER NOT NULL DEFAULT 0, vu_le BIGINT NOT NULL,
            UNIQUE (normalized_key, article_url, bien, requete_id))",
        "CREATE INDEX IF NOT EXISTS veille_so_cle ON veille_sources_occurrences (normalized_key)",
        "CREATE INDEX IF NOT EXISTS veille_so_bien ON veille_sources_occurrences (bien, normalized_key)",
        "CREATE TABLE IF NOT EXISTS veille_sources_historique (id $id, normalized_key TEXT NOT NULL, ancien TEXT, nouveau TEXT NOT NULL, ts BIGINT NOT NULL,
            origine TEXT NOT NULL, raison TEXT NOT NULL DEFAULT '', bien TEXT)",
        "CREATE INDEX IF NOT EXISTS veille_sh_cle ON veille_sources_historique (normalized_key, ts)",
        "CREATE INDEX IF NOT EXISTS veille_sh_jour ON veille_sources_historique (nouveau, origine, ts)",
        "CREATE TABLE IF NOT EXISTS veille_decouvertes_etat (cle TEXT PRIMARY KEY, valeur BIGINT NOT NULL)",
    ] as $sql) $pdo->exec($sql);
}

/** Les domaines enregistrables et clés des sources suivies (la configuration) : jamais proposées, et référence des imitations. */
function vd_suivies(array $cfg): array {
    $reg = []; $cles = []; $hotes = [];
    foreach ($cfg['sources'] ?? [] as $s) {
        if (empty($s['domaine']) || ($s['origine'] ?? '') === 'proposee') continue;
        $h = vd_hote((string)$s['domaine']); if ($h === null) continue;
        $r = vd_enregistrable($h); if ($r === null) continue;
        $plat = VD_RESEAUX[$r] ?? VD_VIDEO[$r] ?? null;
        if ($plat !== null) { if (!empty($s['chemin'])) $cles[$r . '/' . strtolower(trim((string)$s['chemin'], '/'))] = true; continue; }   // facebook.com n'est pas « suivi » en entier
        $reg[$r] = true; $hotes[$h] = true;
        $cles[$h] = true;
    }
    return ['registrables' => array_keys($reg), 'cles' => $cles, 'hotes' => array_keys($hotes)];
}

/** Le texte nomme-t-il un lieu du bien ? (casse, accents, hamza arabe ignorés ; frontière de mot) */
function vd_nomme_lieu(string $texte, array $lieux): bool {
    $t = cfo_vp_norm($texte);
    if ($t === '') return false;
    foreach ($lieux as $l) {
        $formes = array_merge([(string)$l], function_exists('cfo_vp_orthographes_ar') ? cfo_vp_orthographes_ar((string)$l) : []);
        foreach ($formes as $f) {
            $f = cfo_vp_norm($f);
            if (mb_strlen($f) < 3) continue;
            if (preg_match('/(?<![\p{L}\p{N}])' . preg_quote($f, '/') . '(?![\p{L}\p{N}])/u', $t)) return true;
        }
    }
    return false;
}

function vd_etat_lire(PDO $pdo, string $cle): int { $s = $pdo->prepare('SELECT valeur FROM veille_decouvertes_etat WHERE cle = ?'); $s->execute([$cle]); return (int)($s->fetchColumn() ?: 0); }
function vd_etat_ecrire(PDO $pdo, string $cle, int $v): void {
    $pdo->prepare('INSERT INTO veille_decouvertes_etat (cle, valeur) VALUES (?, ?) ON CONFLICT (cle) DO UPDATE SET valeur = excluded.valeur')->execute([$cle, $v]);
}

/**
 * ENREGISTREMENT + NORMALISATION : les apparitions vues depuis le dernier passage (veille_hits.dernier) deviennent des occurrences.
 * → nombre d'occurrences nouvelles
 */
function vd_enregistrer_occurrences(PDO $pdo, array $cfg, ?int $maintenant = null): int {
    $now = $maintenant ?? time();
    $depuis = vd_etat_lire($pdo, 'occurrences_depuis');
    $suivies = vd_suivies($cfg);
    $s = $pdo->prepare('SELECT a.url, a.domaine, a.titre, a.extrait, a.ts, a.langue, a.portee, a.premier, h.requete_id, h.dernier, r.req, rb.bien, b.lieux
                        FROM veille_hits h JOIN veille_articles a ON a.id = h.article_id JOIN veille_requetes r ON r.id = h.requete_id
                        JOIN veille_requete_biens rb ON rb.requete_id = h.requete_id JOIN veille_biens b ON b.bien = rb.bien
                        WHERE h.dernier >= ? ORDER BY h.dernier');
    $s->execute([$depuis]);
    $ins = $pdo->prepare('INSERT INTO veille_sources_occurrences (normalized_key, article_url, original_url, url_google, bien, requete_id, requete_q, requete_locale,
                              jour, titre, extrait, ts, langue, portee, pertinent, vu_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                          ON CONFLICT (normalized_key, article_url, bien, requete_id) DO NOTHING');
    $decl = $pdo->prepare("INSERT INTO veille_sources_decouvertes (normalized_key, original_url, url_google, normalized_domain, registrable_domain, subdomain, chemin,
                              plateforme, normalization_reason, exclusion, premier, dernier, maj) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                           ON CONFLICT (normalized_key) DO UPDATE SET exclusion = excluded.exclusion, maj = excluded.maj");
    $n = 0; $max = $depuis; $lieuxCache = [];
    foreach ($s->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $max = max($max, (int)$r['dernier']);
        $req = json_decode((string)$r['req'], true) ?: [];
        $url = (string)$r['url'];
        $norm = vd_normaliser($url, ['domaine_source' => (string)$r['domaine'], 'connus' => $suivies['registrables']]);
        $cle = $norm['normalized_key'];
        if ($cle === null) continue;                                             // ni clé ni source : moteur, adresse invalide, publication sans page
        if (isset($suivies['cles'][$cle]) || in_array($norm['registrable_domain'], $suivies['registrables'], true) && $norm['plateforme'] === null) continue;   // déjà suivie (ou l'une de ses variantes)
        $lieux = $lieuxCache[$r['bien']] ??= (json_decode((string)$r['lieux'], true) ?: []);
        $q = (string)($req['q'] ?? '');
        $locale = vd_nomme_lieu($q, $lieux) ? 1 : 0;
        $pert = vd_nomme_lieu($r['titre'] . ' ' . ($r['extrait'] ?? ''), $lieux) ? 1 : 0;
        $decl->execute([$cle, $url, $norm['url_google'], $norm['normalized_domain'], $norm['registrable_domain'], $norm['subdomain'], $norm['chemin'],
                        $norm['plateforme'], $norm['normalization_reason'], $norm['exclusion'], (int)$r['premier'], (int)$r['dernier'], $now]);
        $ins->execute([$cle, $url, $url, $norm['url_google'], (string)$r['bien'], (int)$r['requete_id'], mb_substr($q, 0, 300), $locale,
                       gmdate('Y-m-d', (int)$r['premier']), mb_substr((string)$r['titre'], 0, 500), $r['extrait'] !== null ? mb_substr((string)$r['extrait'], 0, 400) : null,
                       $r['ts'] !== null ? (int)$r['ts'] : null, (string)($r['langue'] ?? ''), (string)($r['portee'] ?? ''), $pert, (int)$r['dernier']]);
        $n += $ins->rowCount();
    }
    vd_etat_ecrire($pdo, 'occurrences_depuis', $max);
    return $n;
}

/**
 * LE SCORE, déterministe et expliqué. $st : les compteurs agrégés d'une source. → ['score' => 0..100, 'raisons' => [[points, texte]…]]
 *   +30 nomme un lieu du bien · +20 trouvée par une requête locale · +20 plusieurs requêtes · +15 plusieurs jours · +15 officielle
 *   +10 plusieurs articles pertinents · −20 réseau social seulement · −20 aucune date · −30 hors zone · −50 déjà ignorée
 */
function vd_score(array $st): array {
    $r = [];
    if ($st['pertinentes'] > 0) $r[] = [30, 'nomme un lieu du bien (' . $st['pertinentes'] . ' article' . ($st['pertinentes'] > 1 ? 's' : '') . ')'];
    if ($st['locales'] > 0) $r[] = [20, 'trouvée par une requête locale'];
    if ($st['requetes'] >= 2) $r[] = [20, $st['requetes'] . ' requêtes distinctes'];
    if ($st['jours'] >= 2) $r[] = [15, 'vue sur ' . $st['jours'] . ' jours'];
    if ($st['type'] === 'officielle') $r[] = [15, 'source officielle'];
    if ($st['articles_pertinents'] >= 2) $r[] = [10, $st['articles_pertinents'] . ' articles pertinents'];
    if (in_array($st['type'], ['reseau', 'video'], true)) $r[] = [-20, 'réseau social seulement (' . VD_MENTION_SOCIALE . ')'];
    if ($st['dates'] === 0) $r[] = [-20, 'aucune date connue'];
    if ($st['pertinentes'] === 0 && $st['locales'] === 0) $r[] = [-30, 'hors zone : ni lieu nommé, ni requête locale'];
    if (!empty($st['deja_ignoree'])) $r[] = [-50, 'déjà ignorée par vous'];
    $s = 0; foreach ($r as [$p]) $s += $p;
    return ['score' => max(0, min(100, $s)), 'raisons' => $r];
}

/** Les compteurs d'une source, tirés de ses occurrences. */
function vd_compter(PDO $pdo, string $cle, array $decl): array {
    $s = $pdo->prepare('SELECT * FROM veille_sources_occurrences WHERE normalized_key = ? ORDER BY vu_le DESC');
    $s->execute([$cle]);
    $occ = $s->fetchAll(PDO::FETCH_ASSOC);
    $articles = []; $pertArt = []; $req = []; $jours = []; $biens = []; $titres = []; $langues = []; $portees = []; $chemins = [];
    $pert = 0; $loc = 0; $dates = 0; $somme = 0.0; $prem = PHP_INT_MAX; $der = 0;
    foreach ($occ as $o) {
        $articles[$o['article_url']] = true;
        if ((int)$o['pertinent']) { $pert++; $pertArt[$o['article_url']] = true; }
        if ((int)$o['requete_locale']) $loc++;
        $req[(string)$o['requete_id']] = true; $jours[$o['jour']] = true;
        $biens[$o['bien']] = ($biens[$o['bien']] ?? 0) + 1;
        if ($o['ts'] !== null) $dates++;
        $somme += 0.6 * (int)$o['pertinent'] + 0.4 * (int)$o['requete_locale'];
        $titres[] = (string)$o['titre']; $langues[] = (string)$o['langue']; $portees[] = (string)$o['portee'];
        $chemins[] = (string)parse_url((string)$o['article_url'], PHP_URL_PATH);
        $prem = min($prem, (int)$o['vu_le']); $der = max($der, (int)$o['vu_le']);
    }
    arsort($biens);
    //  les meilleurs exemples : pertinents d'abord, puis datés, puis récents (3 au plus, un par article)
    $ex = []; $vus = [];
    usort($occ, fn($a, $b) => [(int)$b['pertinent'], (int)$b['requete_locale'], $b['ts'] !== null, (int)$b['ts']] <=> [(int)$a['pertinent'], (int)$a['requete_locale'], $a['ts'] !== null, (int)$a['ts']]);
    foreach ($occ as $o) {
        if (isset($vus[$o['article_url']])) continue;
        $vus[$o['article_url']] = true;
        $ex[] = ['titre' => (string)$o['titre'], 'url' => (string)$o['original_url'], 'date' => $o['ts'] !== null ? gmdate('Y-m-d', (int)$o['ts']) : null,
                 'pertinent' => (bool)(int)$o['pertinent'], 'bien' => (string)$o['bien']];
        if (count($ex) >= 3) break;
    }
    $n = ['registrable_domain' => $decl['registrable_domain'], 'host' => $decl['normalized_domain'], 'plateforme' => $decl['plateforme']];
    $type = vd_type($n, ['portees' => $portees, 'titres' => $titres, 'chemins' => $chemins]);
    return ['occurrences' => count($occ), 'articles' => count($articles), 'pertinentes' => $pert, 'articles_pertinents' => count($pertArt), 'locales' => $loc,
            'requetes' => count($req), 'jours' => count($jours), 'dates' => $dates, 'biens' => array_keys($biens), 'bien_principal' => (string)(array_key_first($biens) ?? ''),
            'premier' => $prem === PHP_INT_MAX ? (int)$decl['premier'] : $prem, 'dernier' => $der ?: (int)$decl['dernier'],
            'pertinence' => count($occ) ? round($somme / count($occ), 3) : 0.0, 'exemples' => $ex, 'type' => $type, 'langue' => vd_langue($titres, $langues)];
}

/** Un changement de statut, historisé. */
function vd_changer_statut(PDO $pdo, string $cle, ?string $ancien, string $nouveau, string $origine, string $raison, int $now, ?string $bien = null): void {
    $pdo->prepare('UPDATE veille_sources_decouvertes SET statut = ?, maj = ?' . ($origine !== 'systeme' ? ', decide_le = ' . (int)$now : '')
                  . ($nouveau === 'proposed' ? ', propose_le = ' . (int)$now : '') . ($nouveau === 'one_time' ? ', expire_le = ' . (int)($now + VD_DUREE_UNE_FOIS) : '')
                  . ' WHERE normalized_key = ?')->execute([$nouveau, $now, $cle]);
    $pdo->prepare('INSERT INTO veille_sources_historique (normalized_key, ancien, nouveau, ts, origine, raison, bien) VALUES (?, ?, ?, ?, ?, ?, ?)')
        ->execute([$cle, $ancien, $nouveau, $now, $origine, mb_substr($raison, 0, 300), $bien]);
}

/** Combien de propositions nouvelles CE bien a reçu aujourd'hui (UTC). */
function vd_proposees_du_jour(PDO $pdo, string $bien, int $now): int {
    $debut = intdiv($now, 86400) * 86400;
    $s = $pdo->prepare("SELECT COUNT(*) FROM veille_sources_historique WHERE nouveau = 'proposed' AND origine = 'systeme' AND bien = ? AND ts >= ?");
    $s->execute([$bien, $debut]);
    return (int)$s->fetchColumn();
}

/**
 * AGRÉGATION + PROPOSITIONS (+ expirations). Rejouable à volonté (idempotent). → ['occurrences' => n, 'sources' => n, 'proposees' => n, 'expirees' => n]
 */
function vd_mettre_a_jour(PDO $pdo, array $cfg, ?int $maintenant = null): array {
    $now = $maintenant ?? time();
    vd_schema($pdo);
    $occ = vd_enregistrer_occurrences($pdo, $cfg, $now);
    $bilan = ['occurrences' => $occ, 'sources' => 0, 'proposees' => 0, 'expirees' => 0];
    $suivies = vd_suivies($cfg);
    $maj = $pdo->prepare('UPDATE veille_sources_decouvertes SET type = ?, langue = ?, score = ?, raisons = ?, occurrences = ?, occurrences_pertinentes = ?,
                              requetes_distinctes = ?, jours_distincts = ?, biens = ?, bien_principal = ?, premier = ?, dernier = ?, pertinence_moyenne = ?, exemples = ?, maj = ?
                          WHERE normalized_key = ?');
    $lignes = $pdo->query('SELECT * FROM veille_sources_decouvertes ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);
    $candidats = [];
    foreach ($lignes as $d) {
        $cle = (string)$d['normalized_key'];
        //  une source devenue suivie (ajoutée à la main dans la liste des médias) ou une imitation détectée depuis : exclue des propositions
        if ($d['origine'] !== 'manuel' && (isset($suivies['cles'][$cle]) || ($d['plateforme'] === null && in_array($d['registrable_domain'], $suivies['registrables'], true)))) {
            if ($d['exclusion'] === null) $pdo->prepare('UPDATE veille_sources_decouvertes SET exclusion = ? WHERE normalized_key = ?')->execute(['déjà suivie dans la liste des médias', $cle]);
            continue;
        }
        $st = vd_compter($pdo, $cle, $d);
        if ($st['occurrences'] === 0) continue;
        $cfgS = json_decode((string)$d['config'], true) ?: [];
        $type = ($d['origine'] === 'manuel' || !empty($cfgS['type_choisi'])) ? (string)$d['type'] : $st['type'];   // un type choisi par vous n'est pas recalculé
        if ($d['plateforme'] !== null) $type = $st['type'];   // une page sociale reste réseau social ou vidéo, quoi qu'on choisisse
        $st['type'] = $type;
        $st['deja_ignoree'] = $d['statut'] === 'rejected';
        $sc = vd_score($st);
        $maj->execute([$type, $d['origine'] === 'manuel' ? (string)$d['langue'] : $st['langue'], $sc['score'], json_encode($sc['raisons'], JSON_UNESCAPED_UNICODE),
                       $st['occurrences'], $st['pertinentes'], $st['requetes'], $st['jours'], json_encode($st['biens']), $st['bien_principal'] ?: null,
                       $st['premier'], $st['dernier'], $st['pertinence'], json_encode($st['exemples'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $now, $cle]);
        $bilan['sources']++;
        if ($d['statut'] === 'candidate' && $d['exclusion'] === null) $candidats[] = ['cle' => $cle, 'st' => $st, 'score' => $sc['score']];
    }
    //  LES PROPOSITIONS : critères remplis, meilleur score d'abord, 10 nouvelles par jour et par bien au plus
    usort($candidats, fn($a, $b) => $b['score'] <=> $a['score'] ?: strcmp($a['cle'], $b['cle']));
    $parBien = [];
    foreach ($candidats as $c) {
        $st = $c['st'];
        $hors = $st['pertinentes'] === 0 && $st['locales'] === 0;
        $critere = $st['articles'] >= 2 ? $st['articles'] . ' résultats distincts' : ($st['type'] === 'officielle' ? 'source officielle (1 résultat suffit)' : null);
        if ($critere === null || $hors) continue;
        $b = $st['bien_principal'];
        $parBien[$b] ??= vd_proposees_du_jour($pdo, $b, $now);
        if ($parBien[$b] >= VD_MAX_NOUVELLES_JOUR) continue;
        vd_changer_statut($pdo, $c['cle'], 'candidate', 'proposed', 'systeme', $critere . ', score ' . $c['score'], $now, $b);
        $parBien[$b]++; $bilan['proposees']++;
    }
    //  LES EXPIRATIONS : « une fois » passé son délai ; une proposition plus revue depuis 90 jours
    foreach ($pdo->query("SELECT normalized_key, statut, expire_le, dernier, bien_principal FROM veille_sources_decouvertes WHERE statut IN ('one_time', 'proposed')")->fetchAll(PDO::FETCH_ASSOC) as $d) {
        $fin = $d['statut'] === 'one_time' ? ((int)$d['expire_le'] && (int)$d['expire_le'] <= $now) : ((int)$d['dernier'] < $now - VD_JOURS_EXPIRATION * 86400);
        if (!$fin) continue;
        vd_changer_statut($pdo, (string)$d['normalized_key'], (string)$d['statut'], 'expired', 'systeme',
                          $d['statut'] === 'one_time' ? 'surveillance unique terminée' : 'plus revue depuis ' . VD_JOURS_EXPIRATION . ' jours', $now, $d['bien_principal']);
        $bilan['expirees']++;
    }
    return $bilan;
}

/** Une ligne de la table → la proposition telle que l'écran la montre. */
function vd_ligne(array $d): array {
    $cfg = json_decode((string)$d['config'], true) ?: [];
    $social = in_array($d['type'], ['reseau', 'video'], true);
    return [
        'cle' => (string)$d['normalized_key'], 'domaine' => (string)$d['normalized_domain'], 'registrable' => (string)$d['registrable_domain'],
        'sous_domaine' => (string)$d['subdomain'], 'page' => (string)$d['chemin'], 'plateforme' => $d['plateforme'],
        'url' => (string)$d['original_url'], 'url_google' => $d['url_google'], 'normalisation' => (string)$d['normalization_reason'],
        'type' => (string)$d['type'], 'langue' => (string)$d['langue'], 'statut' => (string)$d['statut'], 'origine' => (string)$d['origine'],
        'exclusion' => $d['exclusion'], 'score' => (int)$d['score'], 'raisons' => json_decode((string)$d['raisons'], true) ?: [],
        'occurrences' => (int)$d['occurrences'], 'pertinentes' => (int)$d['occurrences_pertinentes'], 'requetes' => (int)$d['requetes_distinctes'],
        'jours' => (int)$d['jours_distincts'], 'biens' => json_decode((string)$d['biens'], true) ?: [], 'bien' => $d['bien_principal'],
        'premier' => gmdate('Y-m-d', (int)$d['premier']), 'dernier' => gmdate('Y-m-d', (int)$d['dernier']),
        'pertinence' => (float)$d['pertinence_moyenne'], 'exemples' => json_decode((string)$d['exemples'], true) ?: [],
        'confiance' => (string)($cfg['confiance'] ?? ($social ? 'faible' : ((int)$d['score'] >= 60 ? 'moyenne' : 'faible'))),
        'config' => $cfg, 'mention' => $social ? VD_MENTION_SOCIALE : null,
        'expire_le' => $d['expire_le'] ? gmdate('Y-m-d\TH:i:s\Z', (int)$d['expire_le']) : null,
    ];
}

/**
 * La liste pour l'écran. $bien : la clé d'un bien (vc_cle_bien) ou null (tous). Les propositions : 50 au plus par bien, meilleur score d'abord ;
 * les sources suivies (acceptées, une fois, en pause) ; les compteurs.
 */
function vd_lister(PDO $pdo, ?string $bien = null): array {
    vd_schema($pdo);
    $f = $bien !== null ? ' AND (bien_principal = ' . $pdo->quote($bien) . ' OR biens LIKE ' . $pdo->quote('%"' . $bien . '"%') . ')' : '';
    $prop = $pdo->query("SELECT * FROM veille_sources_decouvertes WHERE statut = 'proposed' AND exclusion IS NULL$f ORDER BY score DESC, dernier DESC, normalized_key")->fetchAll(PDO::FETCH_ASSOC);
    $parBien = []; $out = [];
    foreach ($prop as $d) { $b = (string)$d['bien_principal']; if (($parBien[$b] = ($parBien[$b] ?? 0) + 1) > VD_MAX_VISIBLES) continue; $out[] = vd_ligne($d); }
    //  les sources suivies : celles du bien, et celles valables pour tous les biens (aucun bien choisi dans leur configuration)
    $fs = $bien !== null ? ' AND (bien_principal = ' . $pdo->quote($bien) . ' OR biens LIKE ' . $pdo->quote('%"' . $bien . '"%') . ' OR config LIKE ' . $pdo->quote('%"' . $bien . '"%')
                           . " OR config NOT LIKE '%\"biens\":[\"%')" : '';
    $suivies = array_map('vd_ligne', $pdo->query("SELECT * FROM veille_sources_decouvertes WHERE statut IN ('accepted', 'one_time', 'paused')$fs ORDER BY statut, normalized_key")->fetchAll(PDO::FETCH_ASSOC));
    $cpt = [];
    foreach ($pdo->query("SELECT statut, COUNT(*) AS n FROM veille_sources_decouvertes WHERE 1 = 1$f GROUP BY statut")->fetchAll(PDO::FETCH_ASSOC) as $r) $cpt[$r['statut']] = (int)$r['n'];
    $ignorees = array_map('vd_ligne', $pdo->query("SELECT * FROM veille_sources_decouvertes WHERE statut = 'rejected'$f ORDER BY decide_le DESC LIMIT 30")->fetchAll(PDO::FETCH_ASSOC));
    return ['propositions' => $out, 'suivies' => $suivies, 'ignorees' => $ignorees, 'compteurs' => $cpt, 'plafond_visible' => VD_MAX_VISIBLES, 'plafond_jour' => VD_MAX_NOUVELLES_JOUR];
}

/** Les exemples d'une source (10 au plus), pour « Voir les exemples ». */
function vd_exemples(PDO $pdo, string $cle, int $max = 10): array {
    $s = $pdo->prepare('SELECT original_url, url_google, titre, extrait, ts, bien, requete_q, pertinent, jour FROM veille_sources_occurrences WHERE normalized_key = ?
                        ORDER BY pertinent DESC, vu_le DESC LIMIT ' . max(1, min(50, $max)));
    $s->execute([$cle]);
    return array_map(fn($o) => ['titre' => (string)$o['titre'], 'url' => (string)$o['original_url'], 'url_google' => $o['url_google'], 'extrait' => (string)($o['extrait'] ?? ''),
                                'date' => $o['ts'] !== null ? gmdate('Y-m-d', (int)$o['ts']) : null, 'vu' => (string)$o['jour'], 'bien' => (string)$o['bien'],
                                'requete' => (string)($o['requete_q'] ?? ''), 'pertinent' => (bool)(int)$o['pertinent']], $s->fetchAll(PDO::FETCH_ASSOC));
}

/** Contrôle d'une configuration saisie (Modifier avant acceptation, ajout manuel). → ['config' => propre, 'type' => …, 'langue' => …] ou ['erreur' => …] */
function vd_valider_config(array $in, array $d): array {
    $social = $d['plateforme'] !== null;
    $type = (string)($in['type'] ?? $d['type'] ?? 'inconnu');
    if (!in_array($type, VD_TYPES, true)) return ['erreur' => 'Type : presse, officielle, annonces, réseau social, forum, vidéo ou inconnu.'];
    if ($social && !in_array($type, ['reseau', 'video'], true)) return ['erreur' => 'Une page de réseau social reste un réseau social : jamais une source officielle ni de la presse.'];
    if (!$social && in_array($type, ['reseau', 'video'], true)) return ['erreur' => 'Réseau social : une page précise est attendue (facebook.com/nom-de-la-page).'];
    $langue = (string)($in['langue'] ?? $d['langue'] ?? 'fr');
    if (!in_array($langue, ['fr', 'ar'], true)) return ['erreur' => 'Langue : français ou arabe.'];
    $freq = (string)($in['frequence'] ?? 'quotidienne');
    if (!in_array($freq, VD_FREQUENCES, true)) return ['erreur' => 'Fréquence : quotidienne, toutes les 3 heures ou à la demande.'];
    $mode = (string)($in['mode'] ?? ($social ? 'signal' : 'moteur'));
    if (!in_array($mode, VD_MODES, true)) return ['erreur' => 'Mode : moteur, page de recherche, page d\'accueil, RSS, sitemap ou signal seulement.'];
    if ($social && $mode !== 'signal') return ['erreur' => 'Un réseau social n\'est vu qu\'à travers les moteurs : mode « signal seulement ».'];
    $conf = (string)($in['confiance'] ?? ($social ? 'faible' : 'moyenne'));
    if (!in_array($conf, VD_CONFIANCES, true)) return ['erreur' => 'Confiance : faible, moyenne ou forte.'];
    if ($social && $conf === 'forte') return ['erreur' => 'Un signal social non vérifié ne peut pas avoir une confiance forte.'];
    $nom = trim((string)preg_replace('/\s+/u', ' ', strip_tags((string)($in['nom'] ?? ''))));
    if ($nom === '') $nom = $d['chemin'] !== '' ? $d['chemin'] . ' (' . $d['registrable_domain'] . ')' : (string)$d['normalized_domain'];
    if (mb_strlen($nom) < 2) return ['erreur' => 'Nom : 2 caractères au moins.'];
    $nom = mb_substr($nom, 0, 60);
    $flux = trim((string)($in['flux'] ?? ''));
    if ($mode === 'recherche') {
        if ($flux === '') return ['erreur' => 'Page de recherche : son adresse est attendue, avec {q} à la place des mots cherchés.'];
        if (strlen($flux) > 300 || substr_count($flux, '{q}') !== 1 || !preg_match('#^https?://#i', $flux) || preg_match('/\s/', $flux)) return ['erreur' => 'Page de recherche : une adresse http(s) marquant {q} une fois.'];
        $h = vd_hote((string)parse_url(str_replace('{q}', 'x', $flux), PHP_URL_HOST));
        if ($h === null || vd_enregistrable($h) !== $d['registrable_domain']) return ['erreur' => 'Page de recherche : elle doit être sur le site de la source (' . $d['registrable_domain'] . ').'];
    } else $flux = '';
    $liste = function ($v, int $max, int $long) { $o = []; foreach ((array)$v as $x) { $x = trim(strip_tags((string)$x)); if ($x !== '' && mb_strlen($x) <= $long && !in_array($x, $o, true)) $o[] = $x; } return array_slice($o, 0, $max); };
    $biens = array_values(array_filter($liste($in['biens'] ?? [], 20, 40), fn($b) => (bool)preg_match('/^[0-9a-f]{20}$/', $b)));
    $note = mb_substr(trim(strip_tags((string)($in['note'] ?? ''))), 0, 300);
    $locale = !empty($in['locale']);
    return ['type' => $type, 'langue' => $langue, 'config' => ['nom' => $nom, 'type_choisi' => true, 'frequence' => $freq, 'mode' => $mode, 'confiance' => $conf,
            'requetes' => $liste($in['requetes'] ?? [], 10, 80), 'biens' => $biens, 'note' => $note, 'locale' => $locale] + ($flux !== '' ? ['flux' => $flux] : [])
            + ($social ? ['mention' => VD_MENTION_SOCIALE] : [])];
}

/**
 * UNE DÉCISION (vous) : accepter, ignorer, une_fois, pause, reprendre, modifier (avec « accepter » éventuel). Jamais pour une source exclue.
 * → ['ok' => true, 'source' => ligne] ou ['erreur' => message, 'code' => …]
 */
function vd_decider(PDO $pdo, string $cle, string $action, array $in = [], ?int $maintenant = null): array {
    $now = $maintenant ?? time();
    vd_schema($pdo);
    $s = $pdo->prepare('SELECT * FROM veille_sources_decouvertes WHERE normalized_key = ?'); $s->execute([$cle]);
    $d = $s->fetch(PDO::FETCH_ASSOC);
    if (!$d) return ['erreur' => 'Source inconnue : ' . mb_substr($cle, 0, 80), 'code' => 'INCONNUE'];
    $raison = mb_substr(trim(strip_tags((string)($in['raison'] ?? ''))), 0, 300);
    if ($action === 'modifier') {
        $v = vd_valider_config($in, $d);
        if (isset($v['erreur'])) return ['erreur' => $v['erreur'], 'code' => 'CONFIG_INVALIDE'];
        $pdo->prepare('UPDATE veille_sources_decouvertes SET type = ?, langue = ?, config = ?, maj = ? WHERE normalized_key = ?')
            ->execute([$v['type'], $v['langue'], json_encode($v['config'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $now, $cle]);
        if (empty($in['accepter'])) return ['ok' => true, 'source' => vd_ligne(vd_relire($pdo, $cle))];
        $action = 'accepter';
        $raison = $raison ?: 'modifiée puis acceptée';
        $s->execute([$cle]); $d = $s->fetch(PDO::FETCH_ASSOC);
    }
    if (!isset(VD_TRANSITIONS[$action])) return ['erreur' => 'Action inconnue : ' . $action, 'code' => 'ACTION_INCONNUE'];
    if ($d['exclusion'] !== null && in_array($action, ['accepter', 'une_fois', 'reprendre'], true) && $d['origine'] !== 'manuel')
        return ['erreur' => 'Source exclue (' . $d['exclusion'] . ') : elle ne peut pas être activée depuis les propositions.', 'code' => 'EXCLUE'];
    if (!in_array($d['statut'], VD_TRANSITIONS[$action], true))
        return ['erreur' => 'Passage impossible : « ' . $d['statut'] . ' » → « ' . VD_CIBLES[$action] . ' ».', 'code' => 'TRANSITION'];
    if (in_array($action, ['accepter', 'une_fois'], true) && $d['config'] === '{}') {
        $v = vd_valider_config([], $d);   // la configuration par défaut, contrôlée comme une saisie
        if (isset($v['config'])) $pdo->prepare('UPDATE veille_sources_decouvertes SET config = ? WHERE normalized_key = ?')
                                     ->execute([json_encode(['type_choisi' => false] + $v['config'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $cle]);
    }
    vd_changer_statut($pdo, $cle, (string)$d['statut'], VD_CIBLES[$action], 'utilisateur', $raison ?: $action, $now, $d['bien_principal']);
    return ['ok' => true, 'source' => vd_ligne(vd_relire($pdo, $cle))];
}
function vd_relire(PDO $pdo, string $cle): array { $s = $pdo->prepare('SELECT * FROM veille_sources_decouvertes WHERE normalized_key = ?'); $s->execute([$cle]); return $s->fetch(PDO::FETCH_ASSOC) ?: []; }

/** L'historique des décisions d'une source (le plus récent d'abord). */
function vd_historique(PDO $pdo, string $cle): array {
    $s = $pdo->prepare('SELECT ancien, nouveau, ts, origine, raison FROM veille_sources_historique WHERE normalized_key = ? ORDER BY ts DESC, id DESC'); $s->execute([$cle]);
    return array_map(fn($h) => ['ancien' => $h['ancien'], 'nouveau' => $h['nouveau'], 'date' => gmdate('Y-m-d\TH:i:s\Z', (int)$h['ts']), 'origine' => $h['origine'], 'raison' => $h['raison']],
                     $s->fetchAll(PDO::FETCH_ASSOC));
}

/**
 * L'AJOUT MANUEL amélioré : adresse, nom, type, langue, bien, fréquence, note, confiance. Normalisée ; un doublon est SIGNALÉ, jamais écrasé ;
 * une imitation d'une source suivie demande confirmation. → ['ok' => true, 'source' => …] | ['erreur', 'code', 'doublon'?]
 */
function vd_ajouter(PDO $pdo, array $cfg, array $in, ?int $maintenant = null): array {
    $now = $maintenant ?? time();
    vd_schema($pdo);
    $url = trim((string)($in['url'] ?? ''));
    if ($url !== '' && !preg_match('#^[a-z][a-z0-9+.\-]*://#i', $url)) $url = 'https://' . $url;
    $suivies = vd_suivies($cfg);
    $n = vd_normaliser($url, ['connus' => $suivies['registrables']]);
    if ($n['normalized_key'] === null) return ['erreur' => 'Adresse refusée : ' . ($n['exclusion'] ?? 'illisible') . '.', 'code' => 'ADRESSE_INVALIDE'];
    if ($n['parametres_sensibles']) return ['erreur' => 'Adresse refusée : elle porte un paramètre sensible (jeton, session…). Collez l\'adresse de la page, sans ce paramètre.', 'code' => 'ADRESSE_INVALIDE'];
    $cle = $n['normalized_key'];
    if (isset($suivies['cles'][$cle]) || ($n['plateforme'] === null && in_array($n['registrable_domain'], $suivies['registrables'], true)))
        return ['erreur' => 'Déjà suivie dans la liste des médias (' . $n['registrable_domain'] . ') : rien n\'est modifié.', 'code' => 'DOUBLON', 'doublon' => ['ou' => 'medias', 'cle' => $cle]];
    $ex = vd_relire($pdo, $cle);
    if ($ex) return ['erreur' => 'Cette source existe déjà (statut « ' . $ex['statut'] . ' ») : rien n\'est écrasé. Utilisez ses actions pour la modifier.',
                     'code' => 'DOUBLON', 'doublon' => ['ou' => 'propositions', 'cle' => $cle, 'statut' => $ex['statut']]];
    if ($n['exclusion'] !== null && empty($in['confirmer']))
        return ['erreur' => 'Attention : ' . $n['exclusion'] . '. Confirmez pour l\'ajouter quand même.', 'code' => 'A_CONFIRMER'];
    $d = ['type' => 'inconnu', 'langue' => 'fr', 'plateforme' => $n['plateforme'], 'chemin' => $n['chemin'], 'registrable_domain' => $n['registrable_domain'], 'normalized_domain' => $n['normalized_domain']];
    $typeDefaut = vd_type($n);
    $v = vd_valider_config($in + ['type' => $typeDefaut], $d);
    if (isset($v['erreur'])) return ['erreur' => $v['erreur'], 'code' => 'CONFIG_INVALIDE'];
    $pdo->prepare("INSERT INTO veille_sources_decouvertes (normalized_key, original_url, url_google, normalized_domain, registrable_domain, subdomain, chemin, plateforme,
                       normalization_reason, type, langue, statut, origine, exclusion, config, premier, dernier, maj) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'candidate', 'manuel', ?, ?, ?, ?, ?)")
        ->execute([$cle, $url, $n['normalized_domain'], $n['registrable_domain'], $n['subdomain'], $n['chemin'], $n['plateforme'], $n['normalization_reason'],
                   $v['type'], $v['langue'], $n['exclusion'], json_encode($v['config'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $now, $now, $now]);
    $pdo->prepare('INSERT INTO veille_sources_historique (normalized_key, ancien, nouveau, ts, origine, raison, bien) VALUES (?, NULL, ?, ?, ?, ?, ?)')
        ->execute([$cle, 'candidate', $now, 'manuel', 'ajoutée à la main', $v['config']['biens'][0] ?? null]);
    vd_changer_statut($pdo, $cle, 'candidate', 'accepted', 'manuel', mb_substr(trim(strip_tags((string)($in['raison'] ?? ''))), 0, 300) ?: 'ajout manuel accepté', $now, $v['config']['biens'][0] ?? null);
    return ['ok' => true, 'source' => vd_ligne(vd_relire($pdo, $cle))];
}

/**
 * LES SOURCES ACTIVES pour la collecte (acceptées, « une fois » non échue), au format de veille_sources.json — chacune
 * contrôlée par cfo_vp_valider_source. $bien : la clé du bien revu (une source réservée à d'autres biens est écartée).
 */
function vd_sources_actives(PDO $pdo, ?string $bien = null, ?int $maintenant = null): array {
    $now = $maintenant ?? time();
    vd_schema($pdo);
    $out = [];
    foreach ($pdo->query("SELECT * FROM veille_sources_decouvertes WHERE statut = 'accepted' OR (statut = 'one_time' AND expire_le > " . (int)$now . ') ORDER BY id')->fetchAll(PDO::FETCH_ASSOC) as $d) {
        $c = json_decode((string)$d['config'], true) ?: [];
        if ($bien !== null && !empty($c['biens']) && !in_array($bien, $c['biens'], true)) continue;
        $type = (string)$d['type'];
        $portee = ['reseau' => 'reseau', 'video' => 'reseau', 'forum' => 'forum', 'annonces' => 'annonces', 'officielle' => 'locale'][$type] ?? (!empty($c['locale']) ? 'locale' : 'nationale');
        $s = ['nom' => (string)($c['nom'] ?? $d['normalized_domain']), 'domaine' => (string)$d['normalized_domain'], 'portee' => $portee, 'langue' => (string)$d['langue']];
        if ($d['chemin'] !== '') $s['chemin'] = (string)$d['chemin'];
        if (!empty($c['flux']) && ($c['mode'] ?? '') === 'recherche' && !in_array($portee, CFO_VP_PORTEES_WEB, true)) $s['flux'] = (string)$c['flux'];
        if (!empty($c['frequence'])) $s['frequence'] = (string)$c['frequence'];
        $v = cfo_vp_valider_source($s);
        if (isset($v['erreur'])) continue;
        $out[] = $v['source'] + ['origine' => 'proposee', 'statut_proposition' => (string)$d['statut'], 'categorie' => $type, 'confiance' => (string)($c['confiance'] ?? 'moyenne')]
               + (in_array($type, ['reseau', 'video'], true) ? ['mention' => VD_MENTION_SOCIALE] : []);
    }
    return $out;
}

/** Les sources de la configuration + les sources proposées actives (une source déjà présente n'est pas doublée : la liste des médias l'emporte). */
function vd_fusionner_actives(array $sources, array $actives): array {
    $vus = [];
    foreach ($sources as $s) $vus[strtolower(cfo_vp_cle($s))] = true;
    foreach ($actives as $a) { $k = strtolower(cfo_vp_cle($a)); if (isset($vus[$k])) continue; $vus[$k] = true; $sources[] = $a; }
    return $sources;
}
