/**
 * v35.5 — L'ECRITURE DE L'AGENT ETAIT ECRASEE PAR L'ONGLET OUVERT
 * ═══════════════════════════════════════════════════════════════════════════
 * Le Smart Goal n'a pas echoue. Verifie ligne a ligne :
 *   - cfo_intent_engine.php cree bien l'objectif (create_objectif -> wealthGoals)
 *   - _internal.finance_data le contient, tous exercices conserves
 *   - Tool: Committer poste ce finance_data entier a save_data.php
 *   - save_data.php ecrit le corps BRUT, sans filtrage de cles
 * L'ecriture aboutit. Elle est ensuite effacee.
 *
 * LE MECANISME
 *   onMounted installe un setInterval qui appelle saveToServer() toutes les 15
 *   minutes (parametres.backupIntervalMinutes). saveToServer() poste
 *   getExportData() -- l'etat EN MEMOIRE de l'onglet -- sans lire l'etat du
 *   serveur ni comparer quoi que ce soit. Dernier ecrivain gagne.
 *
 *   15:47  l'agent commit l'objectif        -> serveur : 1 objectif
 *   15:5x  l'auto-backup de l'onglet ouvert -> serveur : 0 objectif
 *          (l'onglet n'a jamais relu le serveur depuis son chargement)
 *
 *   L'utilisateur recharge : "0 objectif". Rien n'a echoue, tout a ete ecrase,
 *   et aucune erreur n'est apparue nulle part -- d'ou "echec silencieux".
 *
 * LE CORRECTIF
 *   L'auto-backup est le chemin NON SURVEILLE : c'est lui qui doit ceder. Il
 *   relit la signature du serveur avant d'ecrire ; si elle a change depuis
 *   notre dernier echange, il n'ecrit PAS et le dit franchement. On transforme
 *   une perte de donnees silencieuse en conflit visible.
 *
 *   La sauvegarde MANUELLE reste inconditionnelle : elle est intentionnelle,
 *   l'utilisateur est devant son ecran, et c'est son geste qui fait foi.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import fs from 'node:fs';

const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => {
    const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) :\n${from.slice(0, 200)}`);
    s = s.split(from).join(to);
};

/* ── 1. Signature de l'etat serveur ───────────────────────────────────────── */
sub(
`                    const DATA_PATH = '/finance/finance_data.json';`,
[`                    const DATA_PATH = '/finance/finance_data.json';`,
 ``,
 `                    // v35.5 — GARDE-FOU ANTI-ECRASEMENT`,
 `                    //   Signature bon marche de l'etat serveur tel qu'on l'a vu pour la`,
 `                    //   derniere fois. Sert uniquement a repondre a une question : le`,
 `                    //   serveur a-t-il change sous nos pieds depuis ? (agent CFO, autre`,
 `                    //   onglet, autre appareil). Pas de crypto ici : on veut detecter une`,
 `                    //   difference, pas se premunir d'une collision hostile.`,
 `                    let _serverSignature = null;`,
 `                    const _sig = (txt) => {`,
 `                        const t = String(txt || '');`,
 `                        let h = 5381;`,
 `                        for (let i = 0; i < t.length; i++) h = (((h << 5) + h) ^ t.charCodeAt(i)) >>> 0;`,
 `                        return t.length + ':' + h.toString(36);`,
 `                    };`,
 `                    const _lireSignatureServeur = async () => {`,
 `                        const res = await fetch(DATA_PATH + '?t=' + Date.now(), { cache: 'no-store' });`,
 `                        if (!res.ok) throw new Error('HTTP ' + res.status);`,
 `                        return _sig(await res.text());`,
 `                    };`,
].join('\n'));

/* ── 2. Mémoriser la signature au chargement ──────────────────────────────── */
sub(
`                                const text = await res.text();
                                if(!text || text.trim()==="") {`,
`                                const text = await res.text();
                                _serverSignature = _sig(text); // v35.5 : reference anti-ecrasement
                                if(!text || text.trim()==="") {`);

/* ── 3. Rafraîchir après une sauvegarde réussie ───────────────────────────── */
sub(
`                            if (data.status === 'ok') { serverSyncStatus.value = 'synced'; serverLastSync.value = new Date().toLocaleTimeString(); addLog("Sauvegarde VPS OK.", 'success'); } `,
`                            if (data.status === 'ok') {
                                serverSyncStatus.value = 'synced'; serverLastSync.value = new Date().toLocaleTimeString(); addLog("Sauvegarde VPS OK.", 'success');
                                // v35.5 : notre ecriture devient la nouvelle reference, sinon
                                //   l'auto-backup suivant prendrait notre propre trace pour
                                //   une modification tierce et refuserait de sauvegarder.
                                try { _serverSignature = await _lireSignatureServeur(); } catch (_) { _serverSignature = null; }
                            } `);

/* ── 4. L'auto-backup cède le passage ─────────────────────────────────────── */
sub(
`                            _backupTimer = setInterval(async () => {
                                try {
                                    await saveToServer();`,
`                            _backupTimer = setInterval(async () => {
                                try {
                                    // v35.5 : l'auto-backup n'ecrase JAMAIS une ecriture qu'il n'a
                                    //   pas vue. C'est par ce chemin que le commit de l'agent CFO
                                    //   disparaissait, sans la moindre erreur affichee.
                                    if (_serverSignature !== null) {
                                        let sigDistante = null;
                                        try { sigDistante = await _lireSignatureServeur(); } catch (_) { sigDistante = null; }
                                        if (sigDistante !== null && sigDistante !== _serverSignature) {
                                            serverSyncStatus.value = 'error';
                                            addLog('⛔ Auto-backup ANNULÉ : le serveur a été modifié depuis votre chargement (agent CFO, autre onglet ou autre appareil). Sauvegarder maintenant écraserait cette modification. Rechargez la page pour la récupérer, ou cliquez « Sauver sur VPS » pour imposer votre version.', 'error');
                                            return;
                                        }
                                    }
                                    await saveToServer();`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v35.5 — auto-backup non destructif');
