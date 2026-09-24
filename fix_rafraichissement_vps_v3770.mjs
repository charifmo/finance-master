import fs from 'node:fs';
const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n'); if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => { const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) : ${from.slice(0,120)}`); s = s.split(from).join(to); };

/* ═══════════════════════════════════════════════════════════════════════════
   v37.7 — RETOUR D'ÉCRITURE : L'ÉCRAN SUIT LE SERVEUR

   L'agent CFO n'écrit pas dans l'onglet ouvert. Il écrit sur le VPS :
   pending_commit.php compile, le nœud « Tool: Committer » relit le pending et
   le POSTe à save_data.php. L'état serveur est donc à jour dès que le CFO
   annonce « ✓ appliqué ».

   L'onglet, lui, n'en savait rien. executerImportFusion() n'était appelé qu'au
   montage (onMounted) et à l'import d'un fichier — JAMAIS après un tour de
   conversation. L'écran continuait donc d'afficher l'état chargé au démarrage.
   D'où le symptôme répété de la v35.5 à la v37.6 : « le CFO dit que c'est
   appliqué, mais rien ne bouge dans l'UI ». L'écriture avait bien eu lieu ;
   l'écran était resté en arrière.

   Et le garde-fou anti-écrasement de la v35.5 aggravait la chose en silence :
   détectant la divergence, l'auto-backup refusait de sauvegarder et n'écrivait
   qu'une ligne dans un journal que personne n'ouvre. L'onglet devenait
   incapable de sauvegarder sans que rien ne le dise à l'écran.
   ═══════════════════════════════════════════════════════════════════════════ */

// ── 1. Le moteur de rafraîchissement, posé avec le reste de la logique
//       anti-écrasement (v35.5) dont il est le pendant : celui-ci DÉTECTAIT la
//       divergence, celui-là la RÉSOUT.
sub(`                    const _lireSignatureServeur = async () => {
                        const res = await fetch(DATA_PATH + '?t=' + Date.now(), { cache: 'no-store' });
                        if (!res.ok) throw new Error('HTTP ' + res.status);
                        return _sig(await res.text());
                    };
`,
`                    const _lireSignatureServeur = async () => {
                        const res = await fetch(DATA_PATH + '?t=' + Date.now(), { cache: 'no-store' });
                        if (!res.ok) throw new Error('HTTP ' + res.status);
                        return _sig(await res.text());
                    };

                    // ═══ v37.7 — RETOUR D'ÉCRITURE ════════════════════════════════
                    //   L'agent CFO écrit sur le VPS, pas dans cet onglet. Sans
                    //   relecture, l'écran reste sur l'état chargé au démarrage et
                    //   l'utilisateur conclut, à raison de ce qu'il voit, que rien
                    //   n'a été appliqué. On relit donc le serveur après chaque tour
                    //   de conversation — mais on n'écrase JAMAIS des modifications
                    //   locales non sauvegardées sans le demander.
                    const serveurDivergent = ref(false);
                    const rafraichissementEnCours = ref(false);

                    const _appliquerEtatServeur = (texte) => {
                        try {
                            const d = JSON.parse(texte);
                            rafraichissementEnCours.value = true;
                            executerImportFusion(d);
                            _serverSignature = _sig(texte);
                            serveurDivergent.value = false;
                            // executerImportFusion réveille les watchers profonds
                            // (wealthGoals, masterAssets, donneesAnnuelles) : sans ce
                            // rétablissement différé, l'état repasserait « Modifié »
                            //  alors qu'on vient au contraire de se caler sur le
                            // serveur. 250 ms > les 200 ms du reset _importInProgress.
                            setTimeout(() => {
                                serverSyncStatus.value = 'synced';
                                serverLastSync.value = new Date().toLocaleTimeString();
                                rafraichissementEnCours.value = false;
                            }, 250);
                            addLog('🔄 État rechargé depuis le VPS — l\\'écran reflète maintenant ce que contient le serveur.', 'success');
                            return { change: true, applique: true };
                        } catch (e) {
                            rafraichissementEnCours.value = false;
                            addLog('❌ Rechargement impossible : ' + (e.message || e), 'error');
                            return { change: true, applique: false, raison: e.message || String(e) };
                        }
                    };

                    //   Renvoie { change, applique } : « change » dit que le serveur
                    //   a bougé, « applique » dit que l'écran a suivi. Les deux sont
                    //   distincts — c'est précisément l'écart que l'utilisateur
                    //   voyait sans pouvoir le nommer.
                    const rafraichirDepuisServeur = async () => {
                        if (_serverSignature === null) return { change: false, applique: false, raison: 'aucune référence serveur' };
                        let texte = null;
                        try {
                            const res = await fetch(DATA_PATH + '?t=' + Date.now(), { cache: 'no-store' });
                            if (!res.ok) throw new Error('HTTP ' + res.status);
                            texte = await res.text();
                        } catch (e) {
                            return { change: false, applique: false, raison: 'lecture impossible : ' + (e.message || e) };
                        }
                        if (!texte || !texte.trim()) return { change: false, applique: false, raison: 'réponse vide' };
                        if (_sig(texte) === _serverSignature) return { change: false, applique: false };

                        // Le serveur a bougé. Un seul cas autorise l'écrasement
                        // silencieux : celui où l'onglet n'a rien à perdre.
                        if (serverSyncStatus.value === 'modified') {
                            serveurDivergent.value = true;
                            addLog('⚠️ Le serveur a changé (agent CFO ou autre appareil) ALORS que vous avez des modifications non sauvegardées. Rien n\\'a été rechargé : choisissez dans le bandeau.', 'warn');
                            return { change: true, applique: false, raison: 'modifications locales non sauvegardées' };
                        }
                        return _appliquerEtatServeur(texte);
                    };

                    //   Choix explicite de l'utilisateur depuis le bandeau : le
                    //   serveur gagne, les saisies locales non sauvegardées sont
                    //   perdues. On le dit avant de le faire.
                    const forcerRechargementServeur = async () => {
                        if (serverSyncStatus.value === 'modified'
                            && !confirm('Recharger l\\'état du serveur ?\\n\\nVos modifications locales non sauvegardées seront perdues.')) return;
                        try {
                            const res = await fetch(DATA_PATH + '?t=' + Date.now(), { cache: 'no-store' });
                            if (!res.ok) throw new Error('HTTP ' + res.status);
                            const texte = await res.text();
                            if (!texte || !texte.trim()) { addLog('❌ Rechargement annulé : le serveur a renvoyé un contenu vide.', 'error'); return; }
                            _appliquerEtatServeur(texte);
                        } catch (e) { addLog('❌ Rechargement impossible : ' + (e.message || e), 'error'); }
                    };
`);

// ── 2. Après chaque tour de CFO : relire le serveur, et le DIRE dans le fil.
//       La confirmation « ✓ appliqué » vient du modèle ; celle-ci vient de
//       l'état réellement relu.
sub(`                        } finally {
                            cfoLoading.value = false;
                            scrollCFOToBottom();
                        }
                    };

                    const envoyerCFO = () => {`,
`                        } finally {
                            cfoLoading.value = false;
                            scrollCFOToBottom();
                            // v37.7 : l'agent a pu écrire sur le VPS pendant ce tour.
                            //   On relit, et on ne l'affirme que si c'est vrai.
                            const maj = await rafraichirDepuisServeur();
                            if (maj.applique) {
                                cfoMessages.value.push({ role: 'agent', time: '',
                                    content: '<div style="border-left:3px solid #059669;background:#ecfdf5;padding:8px 12px;border-radius:8px;font-size:12px">'
                                           + '<b style="color:#047857">🔄 Écran resynchronisé</b><br>'
                                           + 'Le serveur a été modifié pendant cet échange : les données affichées viennent d\\'être rechargées depuis le VPS.</div>' });
                                scrollCFOToBottom();
                            } else if (maj.change) {
                                cfoMessages.value.push({ role: 'agent', time: '',
                                    content: '<div style="border-left:3px solid #f59e0b;background:#fffbeb;padding:8px 12px;border-radius:8px;font-size:12px">'
                                           + '<b style="color:#b45309">⚠️ Le serveur a changé, l\\'écran non</b><br>'
                                           + 'Vous avez des modifications non sauvegardées : rien n\\'a été rechargé pour ne pas les perdre. Le bandeau en haut de l\\'écran vous laisse choisir.</div>' });
                                scrollCFOToBottom();
                            }
                        }
                    };

                    const envoyerCFO = () => {`);

// ── 3. Merlin passe par le même webhook, donc par le même agent, donc par le
//       même Committer : il peut écrire lui aussi.
sub(`                        } catch (e) {
                            merlinBubble.value.error = 'Erreur de connexion au CFO : ' + (e.message || e);
                        } finally {
                            merlinBubble.value.loading = false;
                        }`,
`                        } catch (e) {
                            merlinBubble.value.error = 'Erreur de connexion au CFO : ' + (e.message || e);
                        } finally {
                            merlinBubble.value.loading = false;
                            await rafraichirDepuisServeur(); // v37.7 : même webhook, même Committer
                        }`);

sub(`                        } catch (e) {
                            merlinBubble.value.error = 'Erreur : ' + (e.message || e);
                        } finally {
                            merlinBubble.value.loading = false;
                        }`,
`                        } catch (e) {
                            merlinBubble.value.error = 'Erreur : ' + (e.message || e);
                        } finally {
                            merlinBubble.value.loading = false;
                            await rafraichirDepuisServeur(); // v37.7 : même webhook, même Committer
                        }`);

// ── 4. L'auto-backup détectait déjà la divergence. Il la rendait visible dans
//       un journal ; il la rend maintenant visible à l'écran.
sub(`                                            serverSyncStatus.value = 'error';
                                            addLog('⛔ Auto-backup ANNULÉ`,
`                                            serverSyncStatus.value = 'error';
                                            serveurDivergent.value = true; // v37.7 : le journal ne suffisait pas
                                            addLog('⛔ Auto-backup ANNULÉ`);

// ── 5. Le bandeau. Un arbitrage, pas une notification : les deux issues sont
//       destructrices d'un côté ou de l'autre, donc elles sont nommées.
sub(`        <!-- v34.08 : les 3 actions IA quittent le flottant desktop pour le pied de sidebar`,
`        <!-- v37.7 : le serveur a bougé sous nos pieds et l'écran ne peut pas suivre tout seul -->
        <transition name="fade">
            <div v-if="serveurDivergent" class="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[92vw] max-w-2xl bg-amber-50 border-2 border-amber-400 text-amber-900 px-5 py-3 rounded-2xl shadow-2xl">
                <p class="text-sm font-black">⚠️ Le serveur a été modifié depuis votre chargement</p>
                <p class="text-[11px] font-bold leading-snug mt-1 opacity-90">L'agent CFO (ou un autre appareil) a écrit sur le VPS, et vous avez ici des modifications non sauvegardées. Recharger les perdra ; les garder écrasera l'écriture du serveur au prochain « Sauver sur VPS ».</p>
                <div class="flex flex-wrap gap-2 mt-3">
                    <button @click="forcerRechargementServeur()" class="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-black text-[11px] uppercase tracking-widest transition-colors">🔄 Recharger depuis le VPS</button>
                    <button @click="serveurDivergent = false" class="px-3 py-1.5 rounded-lg bg-white hover:bg-amber-100 border border-amber-300 text-amber-800 font-black text-[11px] uppercase tracking-widest transition-colors">Garder ma version</button>
                </div>
            </div>
        </transition>

        <!-- v34.08 : les 3 actions IA quittent le flottant desktop pour le pied de sidebar`);

// ── 6. Exposition au template.
sub(`                        canUndo, canRedo, undoCount, redoCount, undo, redo, autoBackupToast,`,
`                        canUndo, canRedo, undoCount, redoCount, undo, redo, autoBackupToast,
                        // v37.7 — retour d'écriture
                        serveurDivergent, rafraichissementEnCours, rafraichirDepuisServeur, forcerRechargementServeur,`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v37.7 — retour d\'écriture appliqué');
