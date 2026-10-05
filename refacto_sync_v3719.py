# -*- coding: utf-8 -*-
"""
v37.19 Sync-Coherente — côté application (index.html).

  1. On lit l'état par save_data.php (GET), c'est-à-dire LÀ OÙ l'on écrit —
     plus par le fichier statique, que le mode Postgres ne mettait plus à jour.
  2. On retient la version servie (X-Finance-Version) et on la renvoie à chaque
     sauvegarde (X-Finance-Base). Si le serveur a bougé entre-temps, il refuse
     (409) : rien n'est écrasé, le bandeau propose de recharger ou d'imposer.
  3. Revenir sur l'onglet (visibilité, focus) relit le serveur : sans
     modification locale en cours, l'écran se met à jour tout seul.
Ancres vérifiées avant écriture.
"""
import io, sys
F = 'index.html'
src = io.open(F, encoding='utf-8').read()
edits = []
def sub(label, anchor, replacement, expected=1):
    n = src.count(anchor)
    if n != expected:
        print(f'✖ {label} : {n} ancre(s), {expected} attendue(s)'); sys.exit(1)
    edits.append((anchor, replacement))

sub('lecteur unique', """                    const _lireSignatureServeur = async () => {
                        const res = await fetch(DATA_PATH + '?t=' + Date.now(), { cache: 'no-store' });
                        if (!res.ok) throw new Error('HTTP ' + res.status);
                        return _sig(await res.text());
                    };""",
"""                    //  v37.19 : la version du serveur (X-Finance-Version) sur laquelle
                    //  cet onglet travaille. Renvoyée à chaque sauvegarde : si le serveur
                    //  a bougé entre-temps, il refuse au lieu d'écraser.
                    let _serverVersion = null;
                    //  v37.19 : UNE seule porte de lecture — save_data.php, là où l'on
                    //  écrit. Le fichier statique n'est plus qu'un repli (ancien serveur).
                    const _lireServeur = async () => {
                        try {
                            const res = await fetch(SERVER_PATH + '?t=' + Date.now(), { cache: 'no-store', headers: { 'Accept': 'application/json' } });
                            if (res.ok) {
                                const texte = await res.text();
                                //  On n'accepte qu'un ÉTAT FINANCIER (ou un état vide) : une page
                                //  HTML, un « {status: ok} » ou toute autre réponse fait retomber
                                //  sur le fichier, au lieu d'être importée comme des données.
                                let o = null;
                                try { o = JSON.parse(texte); } catch (_) { o = null; }
                                const etat = o && typeof o === 'object' && !Array.isArray(o)
                                    && (Object.keys(o).length === 0 || 'donneesAnnuelles' in o || 'soldesInitiaux' in o || 'comptes' in o);
                                if (etat) {
                                    return { ok: true, texte, version: res.headers.get('X-Finance-Version'), mode: res.headers.get('X-Finance-Mode') };
                                }
                            }
                        } catch (_) { /* repli ci-dessous */ }
                        const res = await fetch(DATA_PATH + '?t=' + Date.now(), { cache: 'no-store' });
                        if (!res.ok) return { ok: false, statut: res.status, texte: '' };
                        return { ok: true, texte: await res.text(), version: null, mode: 'fichier statique' };
                    };
                    const _vide = (t) => !t || !t.trim() || t.trim() === '{}' || t.trim() === '[]';
                    const _lireSignatureServeur = async () => {
                        const r = await _lireServeur();
                        if (!r.ok) throw new Error('HTTP ' + r.statut);
                        return _sig(r.texte);
                    };""")

sub('appliquer : retenir la version', """                    const _appliquerEtatServeur = (texte) => {
                        try {
                            const d = JSON.parse(texte);
                            rafraichissementEnCours.value = true;
                            executerImportFusion(d);
                            _serverSignature = _sig(texte);""",
"""                    const _appliquerEtatServeur = (texte, version = null) => {
                        try {
                            const d = JSON.parse(texte);
                            rafraichissementEnCours.value = true;
                            executerImportFusion(d);
                            _serverSignature = _sig(texte);
                            _serverVersion = version;""")

sub('rafraîchir par la porte unique', """                        let texte = null;
                        try {
                            const res = await fetch(DATA_PATH + '?t=' + Date.now(), { cache: 'no-store' });
                            if (!res.ok) throw new Error('HTTP ' + res.status);
                            texte = await res.text();
                        } catch (e) {""",
"""                        let texte = null, version = null;
                        try {
                            const r = await _lireServeur();
                            if (!r.ok) throw new Error('HTTP ' + r.statut);
                            texte = r.texte; version = r.version;
                        } catch (e) {""")
sub('rafraîchir applique avec version', """                            return { change: true, applique: false, raison: 'modifications locales non sauvegardées' };
                        }
                        return _appliquerEtatServeur(texte);""",
"""                            return { change: true, applique: false, raison: 'modifications locales non sauvegardées' };
                        }
                        return _appliquerEtatServeur(texte, version);""")

sub('rechargement forcé', """                        try {
                            const res = await fetch(DATA_PATH + '?t=' + Date.now(), { cache: 'no-store' });
                            if (!res.ok) throw new Error('HTTP ' + res.status);
                            const texte = await res.text();
                            if (!texte || !texte.trim()) { addLog('❌ Rechargement annulé : le serveur a renvoyé un contenu vide.', 'error'); return; }
                            _appliquerEtatServeur(texte);
                        } catch (e) { addLog('❌ Rechargement impossible : ' + (e.message || e), 'error'); }
                    };""",
"""                        try {
                            const r = await _lireServeur();
                            if (!r.ok) throw new Error('HTTP ' + r.statut);
                            if (_vide(r.texte)) { addLog('❌ Rechargement annulé : le serveur a renvoyé un contenu vide.', 'error'); return; }
                            _appliquerEtatServeur(r.texte, r.version);
                        } catch (e) { addLog('❌ Rechargement impossible : ' + (e.message || e), 'error'); }
                    };

                    //  v37.19 : choix explicite, depuis le bandeau — « c'est MA version
                    //  qui doit gagner ». La seule écriture qui ignore la version.
                    const imposerMaVersion = async () => {
                        if (!confirm('Imposer la version de cet appareil ?\\n\\nCe que le serveur a reçu depuis votre chargement (autre appareil, agent CFO) sera remplacé.')) return;
                        await saveToServer(true);
                        if (serverSyncStatus.value === 'synced') serveurDivergent.value = false;
                    };

                    //  v37.19 : revenir sur l'onglet, c'est relire le serveur. Sans
                    //  modification locale en cours, l'écran se met à jour tout seul ;
                    //  sinon, le bandeau demande quoi faire. Jamais plus d'une fois
                    //  toutes les 5 secondes.
                    let _dernierRetour = 0;
                    const _auRetourSurOnglet = () => {
                        if (document.visibilityState && document.visibilityState !== 'visible') return;
                        if (Date.now() - _dernierRetour < 5000) return;
                        _dernierRetour = Date.now();
                        rafraichirDepuisServeur().then((r) => {
                            if (r && r.applique) addLog('🔄 Retour sur l\\'onglet : données mises à jour depuis le serveur (un autre appareil avait enregistré).', 'success');
                        }).catch(() => {});
                    };
                    document.addEventListener('visibilitychange', _auRetourSurOnglet);
                    window.addEventListener('focus', _auRetourSurOnglet);""")

sub('sauvegarde avec version', """                    const saveToServer = async () => {
                        serverSyncStatus.value = 'saving';
                        addLog("Écriture vers VPS...", 'info');
                        try {
                            const controller = new AbortController();
                            const timeoutId = setTimeout(() => controller.abort(), 10000);
                            const res = await fetch(SERVER_PATH, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(getExportData()), signal: controller.signal });
                            clearTimeout(timeoutId);
                            
                            const text = (await res.text()).trim();
                            if (text.startsWith('<!DOCTYPE html>')) { addLog("CONFLIT : Caddy envoie vers n8n.", 'error'); serverSyncStatus.value = 'error'; return; }

                            let data = JSON.parse(text);
                            if (data.status === 'ok') {
                                serverSyncStatus.value = 'synced'; serverLastSync.value = new Date().toLocaleTimeString(); addLog("Sauvegarde VPS OK.", 'success');""",
"""                    const saveToServer = async (forcer = false) => {
                        serverSyncStatus.value = 'saving';
                        addLog("Écriture vers VPS...", 'info');
                        try {
                            const controller = new AbortController();
                            const timeoutId = setTimeout(() => controller.abort(), 10000);
                            //  v37.19 : on dit au serveur sur quelle version on a travaillé.
                            const entetes = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
                            if (_serverVersion && forcer !== true) entetes['X-Finance-Base'] = _serverVersion;
                            const res = await fetch(SERVER_PATH, { method: 'POST', headers: entetes, body: JSON.stringify(getExportData()), signal: controller.signal });
                            clearTimeout(timeoutId);
                            
                            const text = (await res.text()).trim();
                            if (text.startsWith('<!DOCTYPE html>')) { addLog("CONFLIT : Caddy envoie vers n8n.", 'error'); serverSyncStatus.value = 'error'; return; }

                            let data = JSON.parse(text);
                            //  v37.19 : le serveur a bougé depuis notre chargement — il a
                            //  REFUSÉ d'écraser. Nos saisies restent à l'écran, non sauvegardées.
                            if (res.status === 409 || data.status === 'conflict') {
                                serverSyncStatus.value = 'modified';
                                serveurDivergent.value = true;
                                addLog('⛔ Sauvegarde refusée par le serveur : un autre appareil (ou l\\'agent CFO) a enregistré depuis votre chargement. Rien n\\'a été écrasé — choisissez dans le bandeau.', 'error');
                                return;
                            }
                            if (data.status === 'ok') {
                                if (data.version) _serverVersion = data.version;
                                serverSyncStatus.value = 'synced'; serverLastSync.value = new Date().toLocaleTimeString(); addLog('Sauvegarde VPS OK' + (data.mode ? ' (' + data.mode + ')' : '') + '.', 'success');""")

sub('chargement initial par la porte unique', """                        try {
                            const res = await fetch(DATA_PATH + '?t=' + Date.now(), {
                                headers: {
                                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                                    'Pragma': 'no-cache'
                                }
                            });
                            if (res.ok) {
                                const text = await res.text();
                                _serverSignature = _sig(text); // v35.5 : reference anti-ecrasement
                                if(!text || text.trim()==="") {""",
"""                        try {
                            //  v37.19 : lu par save_data.php — la même source que l'écriture.
                            const res = await _lireServeur();
                            if (res.ok) {
                                const text = res.texte;
                                _serverSignature = _sig(text); // v35.5 : reference anti-ecrasement
                                _serverVersion = res.version;
                                if (res.mode) addLog('Source des données : ' + res.mode + '.', 'info');
                                if(_vide(text)) {""")

# Le bandeau : un vrai troisième choix, et un texte qui dit ce qui se passe
sub('bandeau : texte', """                <p class="text-sm font-black">⚠️ Le serveur a été modifié depuis votre chargement</p>""",
"""                <p class="text-sm font-black">⚠️ Le serveur a été modifié depuis votre chargement — rien n'a été écrasé</p>""")
sub('bandeau : imposer', """                    <button @click="serveurDivergent = false" class="px-3 py-1.5 rounded-lg bg-white hover:bg-amber-100 border border-amber-300 text-amber-800 font-black text-[11px] uppercase tracking-widest transition-colors">Garder ma version</button>""",
"""                    <button @click="imposerMaVersion()" data-imposer class="px-3 py-1.5 rounded-lg bg-white hover:bg-amber-100 border border-amber-300 text-amber-800 font-black text-[11px] uppercase tracking-widest transition-colors">Imposer la version de cet appareil</button>
                    <button @click="serveurDivergent = false" class="px-3 py-1.5 rounded-lg text-amber-700 hover:underline font-black text-[11px] uppercase tracking-widest">Plus tard</button>""")

sub('bandeau : explication', """L'agent CFO (ou un autre appareil) a écrit sur le VPS, et vous avez ici des modifications non sauvegardées. Recharger les perdra ; les garder écrasera l'écriture du serveur au prochain « Sauver sur VPS ».""",
    """Un autre appareil (ou l'agent CFO) a enregistré sur le VPS pendant que cet onglet était ouvert, et vous avez ici des modifications non sauvegardées. Le serveur a refusé de les écrire par-dessus. Recharger récupère sa version (vos saisies d'ici seront perdues) ; imposer remplace sa version par la vôtre.""")

sub('exposition', """                        serveurDivergent, rafraichissementEnCours, rafraichirDepuisServeur, forcerRechargementServeur,""",
"""                        serveurDivergent, rafraichissementEnCours, rafraichirDepuisServeur, forcerRechargementServeur, imposerMaVersion,""")

for a, r in edits: src = src.replace(a, r, 1)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ {len(edits)} modifications appliquées à {F}')
