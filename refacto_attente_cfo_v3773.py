#!/usr/bin/env python3
"""v37.73 — L'ATTENTE DU CFO : UN CHRONOMÈTRE ET SES VRAIES ÉTAPES, SANS UN TOKEN.

« Un timer est mieux, et une animation dynamique mieux que « Le CFO analyse… ».
  Aussi tracker les étapes si ce n'est pas consommateur de tokens. »

  1. Pendant l'attente : un chronomètre (dixièmes de seconde), une barre animée, une phrase
     qui suit ce que fait le CFO, et la liste des étapes déjà franchies avec leur instant.
  2. Les étapes sont RÉELLES : le VPS les note quand le CFO y passe (contexte préparé,
     simulation, OUI relu pour écriture — cfo_etapes.php) et l'appli les relit toutes les
     1,5 s. Le modèle n'en voit rien : zéro token. Build Agent Input transmet le session_id
     au VPS (dans la requête HTTP, pas dans le prompt).
  3. Le virement programmé par le CFO vers le Compte Courant s'affichait sans destination :
     le moteur l'écrivait « cpt_<id du Courant> », l'écran ne connaît le Courant que sous
     « courant ». Le moteur écrit « courant » ; les virements déjà enregistrés sont
     remis d'aplomb au chargement.
"""
import io, sys

def patcher(F, edits):
    src = io.open(F, encoding='utf-8').read()
    for label, old, new in edits:
        c = src.count(old)
        if c != 1:
            print(f'✖ {F} — {label} : {c} ancre(s), 1 attendue'); sys.exit(1)
        src = src.replace(old, new)
    return src

# ─────────────────────────────── VPS ───────────────────────────────
contexte = patcher('cfo_contexte.php', [
('inclusion',
"""const CFO_CONTEXTE_VERSION = '37.69';
""",
"""const CFO_CONTEXTE_VERSION = '37.73';
//  v37.73 : suivi des étapes, lu par l'appli pendant l'attente — facultatif, son absence ne casse rien
if (is_readable(__DIR__ . '/cfo_etapes.php')) require_once __DIR__ . '/cfo_etapes.php';
if (!function_exists('cfo_etape_noter')) { function cfo_etape_noter(string $sid, string $code, string $libelle = ''): void {} }
"""),
('étape contexte',
"""        $out['exercice_expose'] = $p['exercice'];
    }
    return $out;""",
"""        $out['exercice_expose'] = $p['exercice'];
    }
    if (!empty($entree['session_id']))
        cfo_etape_noter((string)$entree['session_id'], 'contexte', 'Vos chiffres transmis au CFO' . ($out['exercice_expose'] ? ' (exercice ' . $out['exercice_expose'] . ')' : ''));
    return $out;"""),
])

pending = patcher('pending_commit.php', [
('inclusion',
"""require_once __DIR__ . '/cfo_intent_engine.php';
""",
"""require_once __DIR__ . '/cfo_intent_engine.php';
//  v37.73 : suivi des étapes du CFO (zéro token) — facultatif, son absence ne casse jamais une simulation
if (is_readable(__DIR__ . '/cfo_etapes.php')) require_once __DIR__ . '/cfo_etapes.php';
if (!function_exists('cfo_etape_noter')) { function cfo_etape_noter(string $sid, string $code, string $libelle = ''): void {} }
"""),
('étape OUI relu',
"""    $raw = file_get_contents($f);
    if ($raw === false) { http_response_code(500); echo json_encode(['error' => 'Read failed']); exit; }
    echo $raw;""",
"""    $raw = file_get_contents($f);
    if ($raw === false) { http_response_code(500); echo json_encode(['error' => 'Read failed']); exit; }
    cfo_etape_noter($sid, 'validation', 'Votre OUI : simulation relue pour écriture');
    echo $raw;"""),
('étape annulation',
"""        if ($existed) { @unlink($f); }
        echo json_encode(['status'=>'cancelled',""",
"""        if ($existed) { @unlink($f); }
        cfo_etape_noter($sid, 'annulation', 'Simulation annulée');
        echo json_encode(['status'=>'cancelled',"""),
('étape simulation sans écriture',
"""        if (!$internal) {
            $res['state_source'] = $stateSource;""",
"""        if (!$internal) {
            cfo_etape_noter($sid, 'simulation', 'Simulation : ' . (($res['status'] ?? '') === 'error' ? 'refusée par le moteur (' . ($res['error'] ?? '?') . ')' : 'précision demandée'));
            $res['state_source'] = $stateSource;"""),
('étape simulation',
"""        $res['session_id']  = $sid;
        $res['state_source'] = $stateSource;
        $res['ttl_sec']     = $ttlSeconds;""",
"""        $_ok = (int)($res['ops_summary']['success'] ?? 0); $_ko = (int)($res['ops_summary']['errors'] ?? 0);
        cfo_etape_noter($sid, 'simulation', $res['pending_saved']
            ? 'Simulation prête : ' . $_ok . ' opération(s)' . ($_ko ? ', ' . $_ko . ' refusée(s)' : '')
            : 'Simulation refusée' . ($_ko ? ' : ' . $_ko . ' opération(s) en erreur' : ''));
        $res['session_id']  = $sid;
        $res['state_source'] = $stateSource;
        $res['ttl_sec']     = $ttlSeconds;"""),
])

moteur = patcher('cfo_intent_engine.php', [
('virement vers le Courant : clé de l écran',
"""            $vir = cfo_obj(['id'=>cfo_uid(),'mois'=>$m,'sourceCompte'=>$src,'destinationCompte'=>$dst,'montant'=>$mt + 0]);""",
"""            //  v37.73 : le Compte Courant s'écrit « courant » — c'est la seule clé que l'écran des virements connaît
            $_cc = null;
            foreach ((oget($fd, 'comptes') ?: []) as $c) if (is_object($c) && in_array(oget($c, 'type'), ['courant', 'liquide'], true)) { $_cc = 'cpt_' . oget($c, 'id'); break; }
            if ($_cc !== null) { if ($src === $_cc) $src = 'courant'; if ($dst === $_cc) $dst = 'courant'; }
            $vir = cfo_obj(['id'=>cfo_uid(),'mois'=>$m,'sourceCompte'=>$src,'destinationCompte'=>$dst,'montant'=>$mt + 0]);"""),
])

agent = patcher('n8n/build_agent_input.js', [
('session_id vers le VPS',
"""    body: { question: normalized.question, historique: history_text, finance_data: _sourceContexte || null }""",
"""    //  v37.73 : session_id → le VPS note l'étape « contexte » (suivi de l'attente dans l'appli, zéro token)
    body: { question: normalized.question, historique: history_text, finance_data: _sourceContexte || null, session_id: normalized.session_id || null }"""),
])

# ─────────────────────────────── APPLI ───────────────────────────────
ATTENTE = """                                <div v-if="cfoLoading" class="flex gap-3 md:gap-4" data-cfo-attente>
                                    <div class="cfo-cerveau shrink-0 w-8 h-8 md:w-9 md:h-9 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-700 text-white flex items-center justify-center text-sm shadow-sm select-none">🧠</div>
                                    <div class="flex-1 min-w-0 max-w-md rounded-2xl border border-fuchsia-100 bg-white px-4 py-3 shadow-sm">
                                        <div class="flex items-center justify-between gap-3">
                                            <span :key="cfoAttente.actif" class="cfo-attente-phrase text-sm font-bold text-slate-700">{{ cfoAttente.actif }}</span>
                                            <span data-cfo-chrono class="shrink-0 font-mono text-sm font-black text-fuchsia-600 tabular-nums">{{ cfoAttente.chrono }}</span>
                                        </div>
                                        <div class="cfo-barre mt-2"><span></span></div>
                                        <ol class="mt-2 space-y-1">
                                            <li v-for="(e, i) in cfoAttente.etapes" :key="e.code + i" data-cfo-etape class="cfo-etape flex items-center gap-2 text-xs text-slate-500">
                                                <span class="text-emerald-500 font-black">✓</span><span class="flex-1 min-w-0 truncate">{{ e.libelle }}</span><span class="font-mono text-slate-400 tabular-nums">{{ e.a }}</span>
                                            </li>
                                        </ol>
                                    </div>
                                </div>"""

index = patcher('index.html', [
('CSS de l attente',
"""    <!-- v37.44 — LISIBILITÉ DE L'INTERFACE DE BUREAU (audit : tailles, contrastes) -->""",
"""    <!-- v37.73 — L'ATTENTE DU CFO : chronomètre, barre qui court, étapes qui apparaissent -->
    <style id="v3773-attente-cfo">
        .cfo-barre { position: relative; height: 4px; border-radius: 9999px; background: #f5d0fe; overflow: hidden; }
        .cfo-barre > span { position: absolute; top: 0; bottom: 0; width: 40%; border-radius: 9999px;
            background: linear-gradient(90deg, #d946ef, #7c3aed); animation: cfoBarre 1.4s ease-in-out infinite; }
        @keyframes cfoBarre { 0% { left: -40%; } 100% { left: 100%; } }
        .cfo-cerveau { animation: cfoRespire 1.8s ease-in-out infinite; }
        @keyframes cfoRespire { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(217, 70, 239, .35); }
                                50% { transform: scale(1.06); box-shadow: 0 0 0 6px rgba(217, 70, 239, 0); } }
        .cfo-attente-phrase, .cfo-etape { animation: cfoApparait .35s ease-out; }
        @keyframes cfoApparait { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .cfo-barre > span, .cfo-cerveau, .cfo-attente-phrase, .cfo-etape { animation: none; } .cfo-barre > span { left: 0; width: 100%; opacity: .5; } }
    </style>
    <!-- v37.44 — LISIBILITÉ DE L'INTERFACE DE BUREAU (audit : tailles, contrastes) -->"""),
('attente bureau',
"""                                <div v-if="cfoLoading" class="flex gap-3 md:gap-4">
                                    <div class="shrink-0 w-8 h-8 md:w-9 md:h-9 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-700 text-white flex items-center justify-center text-sm shadow-sm select-none">🧠</div>
                                    <div class="flex items-center gap-2 pt-2">
                                        <span class="inline-block w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse"></span>
                                        <span class="inline-block w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse" style="animation-delay: 0.2s"></span>
                                        <span class="inline-block w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse" style="animation-delay: 0.4s"></span>
                                        <span class="text-sm text-slate-500 font-bold ml-1">Le CFO analyse…</span>
                                    </div>
                                </div>""",
ATTENTE),
('attente mobile',
"""                            <div v-if="cfoLoading" class="flex gap-2.5 items-center">
                                <div class="shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-700 text-white flex items-center justify-center text-xs">🧠</div>
                                <span class="inline-block w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse"></span>
                                <span class="inline-block w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse" style="animation-delay: 0.2s"></span>
                                <span class="inline-block w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse" style="animation-delay: 0.4s"></span>
                            </div>""",
"\n".join(l[4:] for l in ATTENTE.split("\n"))),
('état de l attente',
"""                    const cfoLoading = ref(false);
""",
"""                    const cfoLoading = ref(false);
                    //  v37.73 : l'attente du CFO — chronomètre + étapes notées par le VPS (cfo_etapes.php).
                    //  Aucune question au modèle : on relit un fichier que le VPS écrit quand le CFO y passe.
                    const cfoAttente = reactive({ chrono: '0,0 s', actif: 'Envoi de la question au CFO…', etapes: [] });
                    const CFO_ETAPES_URL = '/finance/cfo_etapes.php';
                    const CFO_PHRASES = {
                        envoi: ['Envoi de la question au CFO…', 'Le CFO reçoit votre question…'],
                        contexte: ['Le CFO lit vos chiffres…', 'Il croise comptes, charges et calendrier…', 'Il pèse les options…', 'Il prépare sa réponse…'],
                        simulation: ['Simulation faite — le CFO rédige sa réponse…', 'Il vérifie le résultat de la simulation…'],
                        validation: ['Écriture en cours sur le serveur…', 'Le CFO rédige le compte rendu…'],
                        annulation: ['Simulation annulée — le CFO vous répond…'],
                    };
                    const _cfoDuree = (ms) => {
                        const s = Math.max(0, ms) / 1000;
                        if (s < 60) return s.toFixed(1).replace('.', ',') + ' s';
                        return Math.floor(s / 60) + ' min ' + String(Math.floor(s % 60)).padStart(2, '0') + ' s';
                    };
                    let _cfoAttenteT0 = 0, _cfoChronoId = null, _cfoSondageId = null, _cfoDernierCode = 'envoi';
                    const _cfoPhrase = () => {
                        const liste = CFO_PHRASES[_cfoDernierCode] || CFO_PHRASES.contexte;
                        return liste[Math.floor((Date.now() - _cfoAttenteT0) / 4000) % liste.length];
                    };
                    const _cfoSonder = async () => {
                        try {
                            const r = await fetch(CFO_ETAPES_URL + '?session_id=' + encodeURIComponent(cfoSessionId.value) + '&t=' + Date.now(), { cache: 'no-store' });
                            if (!r.ok || !cfoLoading.value) return;
                            const j = await r.json(), ecoule = Date.now() - _cfoAttenteT0;
                            //  seules les étapes nées depuis l'envoi (marge 1,5 s) : âge relatif, l'horloge du VPS n'a pas à être à l'heure
                            const vues = (Array.isArray(j.etapes) ? j.etapes : []).filter(e => e && e.code && e.libelle && e.il_y_a_ms <= ecoule + 1500);
                            cfoAttente.etapes = [{ code: 'envoi', libelle: 'Question envoyée', a: '0,0 s' }]
                                .concat(vues.map(e => ({ code: e.code, libelle: e.libelle, a: _cfoDuree(ecoule - e.il_y_a_ms) })));
                            if (vues.length) _cfoDernierCode = vues[vues.length - 1].code;
                        } catch (_) { /* VPS muet : le chronomètre continue seul */ }
                    };
                    const _cfoAttenteDemarrer = () => {
                        _cfoAttenteT0 = Date.now(); _cfoDernierCode = 'envoi';
                        cfoAttente.etapes = [{ code: 'envoi', libelle: 'Question envoyée', a: '0,0 s' }];
                        cfoAttente.chrono = '0,0 s'; cfoAttente.actif = _cfoPhrase();
                        clearInterval(_cfoChronoId); clearInterval(_cfoSondageId);
                        _cfoChronoId = setInterval(() => { cfoAttente.chrono = _cfoDuree(Date.now() - _cfoAttenteT0); cfoAttente.actif = _cfoPhrase(); }, 100);
                        _cfoSondageId = setInterval(_cfoSonder, 1500);
                    };
                    const _cfoAttenteArreter = () => { clearInterval(_cfoChronoId); clearInterval(_cfoSondageId); _cfoChronoId = _cfoSondageId = null; };
"""),
('démarrer à l envoi',
"""                        cfoLoading.value = true;
                        scrollCFOToBottom();
                        try {
                            const res = await fetch(cfoWebhookUrl.value, {""",
"""                        cfoLoading.value = true;
                        _cfoAttenteDemarrer();   // v37.73
                        scrollCFOToBottom();
                        try {
                            const res = await fetch(cfoWebhookUrl.value, {"""),
('arrêter à la réponse',
"""                        } finally {
                            cfoLoading.value = false;
                            scrollCFOToBottom();
                            // v37.7 : l'agent a pu écrire sur le VPS pendant ce tour.""",
"""                        } finally {
                            _cfoAttenteArreter();   // v37.73
                            cfoLoading.value = false;
                            scrollCFOToBottom();
                            // v37.7 : l'agent a pu écrire sur le VPS pendant ce tour."""),
('virements vers le Courant : migration',
"""                    const rattacherEpargnes = (data) => {""",
"""                    //  v37.73 : un virement vers (ou depuis) le Compte Courant enregistré « cpt_<id du Courant> »
                    //  (moteur du CFO ≤ v37.72) s'affichait sans compte : l'écran ne connaît le Courant que sous « courant ».
                    const virementsVersCourant = (data) => {
                        let n = 0;
                        const cc = (Array.isArray(data && data.comptes) ? data.comptes : []).find(c => c && (c.type === 'courant' || c.type === 'liquide'));
                        if (!cc) return n;
                        const cle = 'cpt_' + cc.id;
                        Object.values(data.donneesAnnuelles || {}).forEach(an => (Array.isArray(an && an.virementsInternes) ? an.virementsInternes : []).forEach(v => {
                            if (!v) return;
                            if (v.sourceCompte === cle) { v.sourceCompte = 'courant'; n++; }
                            if (v.destinationCompte === cle) { v.destinationCompte = 'courant'; n++; }
                        }));
                        return n;
                    };
                    const rattacherEpargnes = (data) => {"""),
('migration au chargement',
"""                            const _rat = rattacherEpargnes(data);               // v37.70 : à chaque chargement
""",
"""                            const _rat = rattacherEpargnes(data);               // v37.70 : à chaque chargement
                            const _vcc = virementsVersCourant(data);            // v37.73 : à chaque chargement
                            if (_vcc) addLog('🔄 ' + _vcc + ' virement(s) programmé(s) vers le Compte Courant : destination rétablie à l\\'écran.', 'success');
"""),
('exposition migration',
"""corrigerDonneesApprouvees, rattacherEpargnes, undoInfo,""",
"""corrigerDonneesApprouvees, rattacherEpargnes, virementsVersCourant, undoInfo,"""),
('exposition',
"""cfoMessages, cfoInput, cfoLoading, cfoSessionId,""",
"""cfoMessages, cfoInput, cfoLoading, cfoAttente, cfoSessionId,"""),
])

for f, s in [('cfo_contexte.php', contexte), ('pending_commit.php', pending), ('cfo_intent_engine.php', moteur),
             ('n8n/build_agent_input.js', agent), ('index.html', index)]:
    io.open(f, 'w', encoding='utf-8').write(s)
print('✔ v37.73 : attente du CFO chronométrée, étapes suivies par le VPS, virements vers le Courant')
