# -*- coding: utf-8 -*-
"""
v37.40 Sources-Presse-Reglables — les médias de la revue de presse se gèrent
depuis l'écran : ajouter, modifier, mettre en pause, retirer, tester.

  OÙ C'EST STOCKÉ, ET POURQUOI : vos réglages vont dans PostgreSQL (table
  cfo_veille_sources), PAS dans veille_sources.json. Ce fichier est suivi par
  git : modifié sur le VPS, il ferait échouer le prochain `git pull`. Il reste
  la liste d'ORIGINE ; vos réglages s'y superposent :
    • un média ajouté ou modifié par vous l'emporte ;
    • un média d'origine que vous avez retiré le reste (il est proposé au
      rétablissement) ;
    • un média livré plus tard par une mise à jour apparaît, marqué « nouvelle ».

  CONTRÔLES : un vrai nom de domaine public (on peut coller une adresse
  complète : https://www.exemple.ma/... devient exemple.ma) ; ni IP, ni
  localhost ; un flux RSS éventuel doit être SUR le site du média et marquer
  {q}. Le serveur ne va donc chercher que chez les médias déclarés.
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

LIB_AJOUT = r"""
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
"""

patch('cfo_veille_lib.php', [
('sources en pause ignorées', r"""    $moteurs = []; foreach ($cfg['moteurs'] ?? [] as $m) $moteurs[$m['langue'] ?? 'fr'] = $m;
    $sources = $cfg['sources'] ?? [];""", r"""    $moteurs = []; foreach ($cfg['moteurs'] ?? [] as $m) $moteurs[$m['langue'] ?? 'fr'] = $m;
    // v37.40 : un média mis en pause depuis l'écran n'est pas interrogé
    $sources = array_values(array_filter($cfg['sources'] ?? [], fn($s) => ($s['actif'] ?? true) !== false));"""),
('fin de fichier : réglages', r"""    return array_map(function ($a) { unset($a['ts'], $a['specifique']); return $a; },
                     array_slice($garde, 0, (int)($cfg['max_articles'] ?? 15)));
}
""", r"""    return array_map(function ($a) { unset($a['ts'], $a['specifique']); return $a; },
                     array_slice($garde, 0, (int)($cfg['max_articles'] ?? 15)));
}
""" + LIB_AJOUT),
])

patch('cfo_veille_presse.php', [
('serveur : stockage et réseau', r"""require_once __DIR__ . '/cfo_veille_lib.php';""", r"""require_once __DIR__ . '/cfo_veille_serveur.php';   // v37.40 : vos réglages (PostgreSQL) + réseau"""),
('liste effective', r"""$cfg = json_decode((string)@file_get_contents(__DIR__ . '/veille_sources.json'), true);
if (!is_array($cfg)) vp_sortie(""", r"""// v37.40 : la liste d'origine, à laquelle s'appliquent vos réglages faits depuis l'écran
$conf = cfo_vp_config();
$cfg = $conf['cfg'] ?? null;
if (!is_array($cfg)) vp_sortie("""),
('téléchargement partagé', r"""/* ── Toutes les requêtes en parallèle : le délai total est celui de la plus lente ── */
$mh = curl_multi_init(); $poignees = [];
foreach ($requetes as $i => $r) {
    $ch = curl_init($r['url']);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 3,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS, CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        CURLOPT_TIMEOUT => $delai, CURLOPT_CONNECTTIMEOUT => min(5, $delai), CURLOPT_ENCODING => '',
        CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; FinanceMaster-Veille/1.0)',
        CURLOPT_HTTPHEADER => ['Accept: application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5']]);
    curl_multi_add_handle($mh, $ch); $poignees[$i] = $ch;
}
do { $st = curl_multi_exec($mh, $actifs); if ($actifs) curl_multi_select($mh, 1.0); } while ($actifs && $st === CURLM_OK);

$articles = []; $diag = [];
foreach ($poignees as $i => $ch) {
    $r = $requetes[$i];
    $corpsR = (string)curl_multi_getcontent($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_multi_remove_handle($mh, $ch); curl_close($ch);
    $d = ['source' => $r['nom'], 'libelle' => $r['libelle'], 'q' => $r['q'], 'http' => $code];""",
 r"""/* ── Toutes les requêtes en parallèle : le délai total est celui de la plus lente ── */
$reponses = cfo_vp_telecharger($requetes, $delai);

$articles = []; $diag = [];
foreach ($requetes as $i => $r) {
    $corpsR = $reponses[$i]['corps']; $code = $reponses[$i]['http']; $err = $reponses[$i]['erreur'];
    $d = ['source' => $r['nom'], 'libelle' => $r['libelle'], 'q' => $r['q'], 'http' => $code];"""),
('fin de boucle', r"""    array_push($articles, ...$lus);
}
curl_multi_close($mh);
""", r"""    array_push($articles, ...$lus);
}
"""),
])

JS = r"""                    const rafraichirMarketIntel = (asset) => chargerMarketIntel(asset);

                    // ── v37.40 : LES MÉDIAS DE LA REVUE DE PRESSE, DEPUIS L'ÉCRAN ────────
                    //   Vos réglages vont en base (cfo_veille_sources.php), jamais dans
                    //   veille_sources.json : modifié sur le VPS, ce fichier suivi par git
                    //   ferait échouer le prochain `git pull`. Chaque action enregistre la
                    //   liste complète aussitôt : rien à oublier de sauver.
                    const VEILLE_SOURCES_PATH = '/finance/cfo_veille_sources.php';
                    const veilleSources = reactive({ ouvert: false, chargement: false, enregistrement: false, erreur: '', message: '',
                                                     stockage: '', raison: '', maj: '', liste: [], supprimees: [], form: null, tests: {} });
                    const _vsDomaine = (v) => String(v || '').trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
                        .replace(/[\/?#].*$/, '').replace(/:\d+$/, '').replace(/^www\./, '');
                    const _vsFluxWordpress = (dom) => 'https://' + dom + '/?s={q}&feed=rss2';
                    const _vsAppel = async (corps) => {
                        const res = await fetch(VEILLE_SOURCES_PATH + (corps ? '' : '?t=' + Date.now()), corps
                            ? { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify(corps) }
                            : { cache: 'no-store' });
                        let d = null; try { d = JSON.parse(await res.text()); } catch (_) { d = null; }
                        if (!d || d.status !== 'ok') throw new Error((d && (d.message || d.error)) || ('HTTP ' + res.status));
                        return d;
                    };
                    const _vsAppliquer = (d) => Object.assign(veilleSources, { liste: d.sources || [], supprimees: d.supprimees || [],
                                                                               stockage: d.stockage || '', raison: d.raison || '', maj: d.maj || '' });
                    const _vsSansOrigine = (s) => { const { origine, ...x } = s; return x; };
                    const ouvrirSourcesVeille = async () => {
                        Object.assign(veilleSources, { ouvert: true, chargement: true, erreur: '', message: '', form: null });
                        try { _vsAppliquer(await _vsAppel(null)); } catch (e) { veilleSources.erreur = 'Lecture impossible — ' + e.message; }
                        finally { veilleSources.chargement = false; }
                    };
                    const fermerSourcesVeille = () => { veilleSources.ouvert = false; veilleSources.form = null; };
                    const _vsEnregistrer = async (liste, message) => {
                        Object.assign(veilleSources, { enregistrement: true, erreur: '', message: '' });
                        try {
                            _vsAppliquer(await _vsAppel({ action: 'enregistrer', sources: liste.map(_vsSansOrigine) }));
                            veilleSources.message = message;
                            return true;
                        } catch (e) { veilleSources.erreur = e.message; return false; }
                        finally { veilleSources.enregistrement = false; }
                    };
                    const nouvelleSourceVeille = () => {
                        veilleSources.form = { index: -1, nom: '', domaine: '', portee: 'locale', langue: 'ar', wordpress: false, flux: '' };
                        Object.assign(veilleSources, { erreur: '', message: '' });
                    };
                    const modifierSourceVeille = (i) => {
                        const s = veilleSources.liste[i]; if (!s) return;
                        veilleSources.form = { index: i, nom: s.nom, domaine: s.domaine, portee: s.portee, langue: s.langue,
                                               wordpress: !!s.flux && s.flux === _vsFluxWordpress(s.domaine), flux: s.flux || '' };
                        Object.assign(veilleSources, { erreur: '', message: '' });
                    };
                    const annulerSourceVeille = () => { veilleSources.form = null; veilleSources.erreur = ''; };
                    const validerSourceVeille = async () => {
                        const f = veilleSources.form; if (!f) return;
                        const dom = _vsDomaine(f.domaine);
                        const s = { nom: String(f.nom || '').trim(), domaine: dom, portee: f.portee, langue: f.langue };
                        const flux = f.wordpress ? _vsFluxWordpress(dom) : String(f.flux || '').trim();
                        if (flux) s.flux = flux;
                        if (f.index >= 0 && veilleSources.liste[f.index].actif === false) s.actif = false;
                        const liste = veilleSources.liste.slice();
                        if (f.index >= 0) liste.splice(f.index, 1, s); else liste.push(s);
                        const ok = await _vsEnregistrer(liste, f.index >= 0 ? '✅ ' + s.nom + ' modifié.'
                                                                           : '✅ ' + s.nom + ' ajouté : il sera interrogé au prochain « Actualiser ».');
                        if (ok) veilleSources.form = null;
                    };
                    const basculerSourceVeille = (i) => {
                        const liste = veilleSources.liste.slice(), s = { ...liste[i] };
                        if (s.actif === false) delete s.actif; else s.actif = false;
                        liste[i] = s;
                        _vsEnregistrer(liste, s.actif === false ? '⏸️ ' + s.nom + ' mis en pause : il ne sera plus interrogé.' : '▶️ ' + s.nom + ' réactivé.');
                    };
                    const supprimerSourceVeille = (i) => {
                        const s = veilleSources.liste[i];
                        if (!s || !confirm('Retirer « ' + s.nom + ' » de la revue de presse ?')) return;
                        const liste = veilleSources.liste.slice(); liste.splice(i, 1);
                        _vsEnregistrer(liste, '🗑️ ' + s.nom + ' retiré.');
                    };
                    const restaurerSourceVeille = (s) => _vsEnregistrer([...veilleSources.liste, s], '↩️ ' + s.nom + ' rétabli.');
                    const reinitialiserSourcesVeille = async () => {
                        if (!confirm("Revenir à la liste d'origine des médias ? Vos ajouts, modifications et retraits seront effacés.")) return;
                        Object.assign(veilleSources, { enregistrement: true, erreur: '', message: '', form: null });
                        try { _vsAppliquer(await _vsAppel({ action: 'reinitialiser' })); veilleSources.message = "↩️ Liste d'origine rétablie."; }
                        catch (e) { veilleSources.erreur = e.message; }
                        finally { veilleSources.enregistrement = false; }
                    };
                    // Tester un média MAINTENANT : Google Actualités sur son domaine, et son flux RSS
                    const testerSourceVeille = async (s) => {
                        veilleSources.tests = Object.assign({}, veilleSources.tests, { [s.domaine]: { enCours: true } });
                        let r;
                        try { const d = await _vsAppel({ action: 'tester', source: _vsSansOrigine(s) }); r = { google: d.google, flux: d.flux }; }
                        catch (e) { r = { erreur: e.message }; }
                        veilleSources.tests = Object.assign({}, veilleSources.tests, { [s.domaine]: r });
                    };"""

MODALE = r"""        <!-- v37.40 : les médias de la revue de presse, réglables depuis l'écran -->
        <div v-if="veilleSources.ouvert" @click.self="fermerSourcesVeille" data-vs-modale
             class="fixed inset-0 z-[70] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl overflow-hidden">
                <div class="px-5 py-4 flex items-center justify-between bg-gradient-to-r from-slate-900 to-sky-900 text-white">
                    <div>
                        <h3 class="font-black uppercase tracking-widest text-sm">📰 Sources de la revue de presse</h3>
                        <p class="text-[10px] text-slate-300 font-bold mt-0.5">Interrogées avant chaque « Actualiser » d'une carte Intelligence marché</p>
                    </div>
                    <button @click="fermerSourcesVeille" class="text-slate-300 hover:text-white text-xl font-black">✕</button>
                </div>
                <div class="p-5 space-y-4 max-h-[72vh] overflow-y-auto">
                    <p v-if="veilleSources.chargement" class="text-sm text-slate-500 font-bold">⏳ Lecture des sources…</p>
                    <div v-if="veilleSources.stockage === 'indisponible' && !veilleSources.chargement" data-vs-lecture-seule
                         class="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 font-bold">
                        ⚠️ Base de données injoignable ({{ veilleSources.raison }}) : la liste d'origine s'applique, vos modifications ne peuvent pas être enregistrées pour l'instant.
                    </div>
                    <div v-if="veilleSources.erreur" data-vs-erreur class="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 font-bold">⛔ {{ veilleSources.erreur }}</div>
                    <div v-if="veilleSources.message" data-vs-message class="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 font-bold">{{ veilleSources.message }}</div>

                    <div v-if="veilleSources.form" data-vs-form class="border-2 border-sky-200 bg-sky-50 rounded-xl p-4 space-y-3">
                        <p class="text-[11px] font-black uppercase tracking-widest text-sky-800">{{ veilleSources.form.index >= 0 ? '✏️ Modifier la source' : '➕ Nouvelle source' }}</p>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500">Nom du média
                                <input v-model="veilleSources.form.nom" data-vs-nom type="text" placeholder="ex. Marrakech Today"
                                       class="mt-1 w-full p-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 normal-case tracking-normal bg-white outline-none focus:ring-2 focus:ring-sky-400"/>
                            </label>
                            <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500">Site (domaine ou adresse copiée)
                                <input v-model="veilleSources.form.domaine" data-vs-domaine type="text" placeholder="ex. almarrakchia.net"
                                       class="mt-1 w-full p-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 normal-case tracking-normal bg-white outline-none focus:ring-2 focus:ring-sky-400"/>
                            </label>
                            <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500">Portée
                                <select v-model="veilleSources.form.portee" data-vs-portee class="mt-1 w-full p-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 normal-case tracking-normal bg-white">
                                    <option value="locale">Presse locale (Marrakech)</option>
                                    <option value="nationale">Presse nationale</option>
                                </select>
                            </label>
                            <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500">Langue des articles
                                <select v-model="veilleSources.form.langue" data-vs-langue class="mt-1 w-full p-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 normal-case tracking-normal bg-white">
                                    <option value="ar">Arabe</option>
                                    <option value="fr">Français</option>
                                </select>
                            </label>
                        </div>
                        <label class="flex items-start gap-2 text-xs text-slate-700 font-bold">
                            <input type="checkbox" v-model="veilleSources.form.wordpress" data-vs-wordpress class="mt-0.5"/>
                            <span>Le site a une recherche RSS de type WordPress (<code>/?s=…&amp;feed=rss2</code>) — l'interroger aussi directement</span>
                        </label>
                        <label v-if="!veilleSources.form.wordpress" class="block text-[10px] font-black uppercase tracking-widest text-slate-500">Flux RSS de recherche (facultatif — {q} = les mots cherchés)
                            <input v-model="veilleSources.form.flux" data-vs-flux type="text" placeholder="ex. https://www.exemple.ma/recherche?q={q}&amp;format=rss"
                                   class="mt-1 w-full p-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 normal-case tracking-normal bg-white outline-none focus:ring-2 focus:ring-sky-400"/>
                        </label>
                        <p class="text-[10px] text-slate-500 font-bold">Avec ou sans flux, le média est interrogé via Google Actualités, restreint à son site.</p>
                        <div class="flex gap-2 justify-end">
                            <button @click="annulerSourceVeille" class="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest">Annuler</button>
                            <button @click="validerSourceVeille" data-vs-valider :disabled="veilleSources.enregistrement"
                                    class="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-slate-300 text-white font-black text-xs uppercase tracking-widest">{{ veilleSources.enregistrement ? '⏳ Enregistrement…' : 'Enregistrer' }}</button>
                        </div>
                    </div>

                    <template v-for="groupe in [{ cle: 'locale', titre: '📍 Presse locale (Marrakech)' }, { cle: 'nationale', titre: '🇲🇦 Presse nationale' }]" :key="groupe.cle">
                        <div v-if="!veilleSources.chargement" :data-vs-groupe="groupe.cle">
                            <p class="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{{ groupe.titre }} · {{ veilleSources.liste.filter(x => x.portee === groupe.cle).length }}</p>
                            <div class="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                                <template v-for="(s, i) in veilleSources.liste" :key="s.domaine">
                                    <div v-if="s.portee === groupe.cle" data-vs-source :data-domaine="s.domaine"
                                         :class="['px-3 py-2.5 flex flex-wrap items-center gap-2', s.actif === false ? 'bg-slate-50' : 'bg-white']">
                                        <input type="checkbox" :checked="s.actif !== false" @change="basculerSourceVeille(i)" data-vs-actif
                                               :disabled="veilleSources.enregistrement || veilleSources.stockage !== 'postgres'"
                                               :title="s.actif === false ? 'En pause — cocher pour réactiver' : 'Interrogé — décocher pour mettre en pause'"/>
                                        <div :class="['min-w-0 flex-1', s.actif === false ? 'opacity-50' : '']">
                                            <p class="text-sm font-black text-slate-800">{{ s.nom }} <span class="text-[10px] font-bold text-slate-400">{{ s.domaine }}</span></p>
                                            <p class="text-[10px] font-bold text-slate-500 flex flex-wrap gap-1.5 mt-0.5">
                                                <span class="px-1.5 rounded bg-slate-100">{{ s.langue === 'ar' ? 'arabe' : 'français' }}</span>
                                                <span v-if="s.flux" class="px-1.5 rounded bg-emerald-100 text-emerald-700">RSS du site</span>
                                                <span v-if="s.origine === 'ajoutee'" data-vs-badge="ajoutee" class="px-1.5 rounded bg-sky-100 text-sky-700">ajoutée par vous</span>
                                                <span v-else-if="s.origine === 'modifiee'" data-vs-badge="modifiee" class="px-1.5 rounded bg-amber-100 text-amber-700">modifiée</span>
                                                <span v-else-if="s.origine === 'nouvelle'" data-vs-badge="nouvelle" class="px-1.5 rounded bg-violet-100 text-violet-700">nouvelle</span>
                                                <span v-if="s.actif === false" data-vs-badge="pause" class="px-1.5 rounded bg-slate-200 text-slate-600">en pause</span>
                                            </p>
                                        </div>
                                        <div class="flex items-center gap-1">
                                            <button @click="testerSourceVeille(s)" data-vs-tester title="Tester maintenant" class="p-1.5 rounded-lg hover:bg-sky-100 text-xs">🧪</button>
                                            <button @click="modifierSourceVeille(i)" data-vs-modifier :disabled="veilleSources.stockage !== 'postgres' || !!veilleSources.form" title="Modifier" class="p-1.5 rounded-lg hover:bg-blue-100 disabled:opacity-30">✏️</button>
                                            <button @click="supprimerSourceVeille(i)" data-vs-supprimer :disabled="veilleSources.stockage !== 'postgres' || veilleSources.enregistrement" title="Retirer" class="p-1.5 rounded-lg hover:bg-red-100 disabled:opacity-30">🗑️</button>
                                        </div>
                                        <div v-if="veilleSources.tests[s.domaine]" data-vs-test class="w-full pl-6 text-[10px] font-bold space-y-0.5">
                                            <p v-if="veilleSources.tests[s.domaine].enCours" class="text-slate-500">⏳ Test en cours…</p>
                                            <p v-else-if="veilleSources.tests[s.domaine].erreur" class="text-red-600">⛔ {{ veilleSources.tests[s.domaine].erreur }}</p>
                                            <template v-else>
                                                <p v-for="c in [veilleSources.tests[s.domaine].google, veilleSources.tests[s.domaine].flux].filter(Boolean)" :key="c.canal" :data-vs-canal="c.canal"
                                                   :class="c.statut === 'ok' ? 'text-emerald-700' : (c.statut === 'vide' ? 'text-slate-500' : 'text-red-600')">
                                                    {{ c.statut === 'ok' ? '✅' : (c.statut === 'vide' ? '⚪' : '❌') }} {{ c.canal === 'flux' ? 'RSS du site' : 'Google Actualités' }} :
                                                    {{ c.statut === 'ok' ? c.n + ' article' + (c.n > 1 ? 's' : '') + (c.exemple ? ' — dernier : « ' + c.exemple.titre + ' »' + (c.exemple.date ? ' (' + c.exemple.date + ')' : '') : '')
                                                       : (c.statut === 'vide' ? 'aucun article trouvé sur ce site' : (c.statut === 'illisible' ? 'le site ne répond pas en RSS' : c.erreur)) }}
                                                </p>
                                            </template>
                                        </div>
                                    </div>
                                </template>
                            </div>
                        </div>
                    </template>

                    <div v-if="veilleSources.supprimees.length && !veilleSources.chargement" data-vs-supprimees class="text-[11px] text-slate-500 font-bold">
                        Médias d'origine retirés :
                        <button v-for="s in veilleSources.supprimees" :key="s.domaine" @click="restaurerSourceVeille(s)" data-vs-restaurer
                                :disabled="veilleSources.stockage !== 'postgres' || veilleSources.enregistrement"
                                class="ml-1 px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700">↩️ {{ s.nom }}</button>
                    </div>
                </div>
                <div class="px-5 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50">
                    <button @click="reinitialiserSourcesVeille" data-vs-reinitialiser :disabled="veilleSources.stockage !== 'postgres' || veilleSources.enregistrement"
                            class="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-800 disabled:opacity-30">↩️ Revenir à la liste d'origine</button>
                    <button @click="nouvelleSourceVeille" data-vs-ajouter :disabled="veilleSources.stockage !== 'postgres' || !!veilleSources.form"
                            class="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-slate-300 text-white font-black text-xs uppercase tracking-widest">＋ Ajouter une source</button>
                </div>
            </div>
        </div>

        <div v-if="showMasterAssetModal" @click.self="closeMasterAssetModal"""

patch('index.html', [
('médias : gestion', r"""                    const rafraichirMarketIntel = (asset) => chargerMarketIntel(asset);""", JS),
('médias : fenêtre', r"""        <div v-if="showMasterAssetModal" @click.self="closeMasterAssetModal""", MODALE),
('médias : bouton de la carte', r"""                                                            <button @click="rafraichirMarketIntel(asset)" :disabled="mi.loading"
                                                                    class="text-[9px] font-black uppercase tracking-widest bg-white/15 hover:bg-white/25 disabled:opacity-40 px-2 py-1 rounded-lg transition-colors">↻ Actualiser</button>""",
 r"""                                                            <button @click="ouvrirSourcesVeille()" data-mi-sources title="Choisir les journaux interrogés"
                                                                    class="text-[9px] font-black uppercase tracking-widest bg-white/10 hover:bg-white/25 px-2 py-1 rounded-lg transition-colors">📰 Sources</button>
                                                            <button @click="rafraichirMarketIntel(asset)" :disabled="mi.loading"
                                                                    class="text-[9px] font-black uppercase tracking-widest bg-white/15 hover:bg-white/25 disabled:opacity-40 px-2 py-1 rounded-lg transition-colors">↻ Actualiser</button>"""),
('médias : bouton de la Supervision IA', r"""                            <input v-model="aiMemoryFiltre" @keyup.enter="chargerAiMemory" type="search" placeholder="Filtrer…" class="w-44 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400"/>""",
 r"""                            <button @click="ouvrirSourcesVeille()" data-sup-sources class="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-black text-xs uppercase tracking-widest transition-colors">📰 Sources presse</button>
                            <input v-model="aiMemoryFiltre" @keyup.enter="chargerAiMemory" type="search" placeholder="Filtrer…" class="w-44 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400"/>"""),
('médias : exports', r"""                        marketIntel, toggleMarketIntel, chargerMarketIntel, rafraichirMarketIntel,""",
 r"""                        marketIntel, toggleMarketIntel, chargerMarketIntel, rafraichirMarketIntel,
                        veilleSources, ouvrirSourcesVeille, fermerSourcesVeille, nouvelleSourceVeille, modifierSourceVeille, annulerSourceVeille,
                        validerSourceVeille, basculerSourceVeille, supprimerSourceVeille, restaurerSourceVeille, reinitialiserSourcesVeille, testerSourceVeille,"""),
])
