import fs from 'node:fs';
const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n'); if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => { const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) : ${from.slice(0,120)}`); s = s.split(from).join(to); };

/* ═══════════════════════════════════════════════════════════════════════════
   v37.10 — « J'AI SUPPRIMÉ LA RÈGLE, L'INFO EST TOUJOURS LÀ »

   Deux causes, indépendantes, et il fallait traiter les deux.

   1. LA SUPPRESSION ÉTAIT REFUSÉE (corrigée dans get_ai_memory.php). Le
      verrou n'acceptait qu'un identifiant ENTIER, alors que le nœud PGVector
      de LangChain crée finance_vectors avec « id uuid PRIMARY KEY DEFAULT
      gen_random_uuid() ». Chaque règle porte donc un UUID, et le serveur
      répondait invariablement ID_INVALIDE. Reproduit sur un PostgreSQL 16 à
      clés UUID, puis corrigé et re-vérifié.

   2. UNE MÊME INFORMATION PEUT VIVRE EN PLUSIEURS EXEMPLAIRES. L'ingestion
      redécoupe et réindexe : le même texte peut occuper plusieurs lignes.
      Effacer l'une laissait les autres, sans que rien ne le dise. L'interface
      compte désormais les copies, les signale AVANT la suppression, et
      propose de toutes les oublier d'un coup.

   Et une troisième, qui n'est pas un bug : l'agent relit les 8 derniers
   échanges de la conversation en cours (table chat_history). Une règle
   effacée du RAG peut donc encore être citée dans CETTE conversation.
   C'est dit après chaque suppression, pour ne pas laisser croire à un échec.
   ═══════════════════════════════════════════════════════════════════════════ */

// ── 1. Compter les copies — sur le texte normalisé, pas sur l'identifiant.
sub(`                    const oublierRegle = async (regle) => {`,
`                    // v37.10 : deux règles portant le même texte sont la MÊME
                    //   information. On les regroupe pour pouvoir le dire, et pour
                    //   pouvoir les effacer ensemble.
                    const _cleTexte = (t) => String(t == null ? '' : t)
                        .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
                        .toLowerCase().replace(/\\s+/g, ' ').trim();

                    const aiMemoryCopies = computed(() => {
                        const parTexte = new Map();
                        (aiMemoryRag.value || []).forEach(r => {
                            const k = _cleTexte(r.texte);
                            if (!k) return;
                            if (!parTexte.has(k)) parTexte.set(k, []);
                            parTexte.get(k).push(r.id);
                        });
                        const out = {};
                        (aiMemoryRag.value || []).forEach(r => {
                            const ids = parTexte.get(_cleTexte(r.texte)) || [];
                            if (ids.length > 1) out[r.id] = ids;
                        });
                        return out;
                    });

                    //   Un seul chemin de suppression, appelé une fois ou n fois.
                    //   Renvoie le nombre de lignes réellement effacées.
                    const _supprimerVecteur = async (id) => {
                        const res = await fetch(AI_MEMORY_PATH, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                // Exigé par le serveur : un en-tête personnalisé force le
                                // contrôle CORS, ce qu'un formulaire tiers ne peut pas faire.
                                'X-Requested-With': 'XMLHttpRequest',
                            },
                            body: JSON.stringify({ action: 'delete_vector', id }),
                        });
                        const txt = await res.text();
                        let d; try { d = JSON.parse(txt); } catch (e) { d = null; }
                        if (!d || d.status !== 'ok') {
                            const cause = (d && d.error === 'PROTECTION_ABSENTE')
                                ? "La suppression est bloquée tant que /finance/ n'est pas protégé par Caddy (basic_auth). "
                                  + 'La lecture continue de fonctionner. Voir CADDY_SECURITE.md.'
                                : ((d && d.message) || txt.slice(0, 200));
                            throw new Error(cause);
                        }
                        return d;
                    };

                    //   Ce que l'agent peut encore savoir APRÈS une suppression
                    //   réussie. Le taire ferait passer une réponse normale pour
                    //   un échec de la suppression.
                    const _NOTE_HISTORIQUE = "La règle est retirée de la base de connaissance. "
                        + "Si l'agent la cite encore dans la conversation en cours, c'est qu'elle figure aussi "
                        + "dans l'historique des 8 derniers échanges de cette session : ouvrez une nouvelle "
                        + "conversation pour repartir sans elle.";

                    const oublierRegle = async (regle) => {`);

// ── 2. Le chemin de suppression passe par la fonction commune, et dit ce qui reste.
sub(`                        aiSuppressionEnCours.value = regle.id;
                        try {
                            const res = await fetch(AI_MEMORY_PATH, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    // Exigé par le serveur : un en-tête personnalisé force le
                                    // contrôle CORS, ce qu'un formulaire tiers ne peut pas faire.
                                    'X-Requested-With': 'XMLHttpRequest',
                                },
                                body: JSON.stringify({ action: 'delete_vector', id: regle.id }),
                            });
                            const txt = await res.text();
                            let d; try { d = JSON.parse(txt); } catch (e) { d = null; }
                            if (!d || d.status !== 'ok') {
                                // L'échec le plus probable a une cause précise et une solution :
                                // on la donne, plutôt que d'afficher un code d'erreur.
                                const cause = (d && d.error === 'PROTECTION_ABSENTE')
                                    ? "La suppression est bloquée tant que /finance/ n'est pas protégé par Caddy (basic_auth). "
                                      + 'La lecture continue de fonctionner. Voir CADDY_SECURITE.md.'
                                    : ((d && d.message) || txt.slice(0, 200));
                                throw new Error(cause);
                            }
                            // Retrait immédiat de la liste, sans attendre le rechargement :
                            // l'écran doit refléter l'action au moment où elle est faite.
                            aiMemoryRag.value = aiMemoryRag.value.filter(x => x.id !== regle.id);
                            addLog('🗑️ Règle #' + regle.id + ' oubliée (archivée dans ' + (d.archive || 'l\\'archive') + ').', 'success');
                            await chargerAiMemory();
                        } catch (e) {`,
`                        aiSuppressionEnCours.value = regle.id;
                        try {
                            const d = await _supprimerVecteur(regle.id);
                            // Retrait immédiat de la liste, sans attendre le rechargement :
                            // l'écran doit refléter l'action au moment où elle est faite.
                            aiMemoryRag.value = aiMemoryRag.value.filter(x => x.id !== regle.id);
                            addLog('🗑️ Règle #' + regle.id + ' oubliée (archivée dans ' + (d.archive || 'l\\'archive') + ').', 'success');
                            await chargerAiMemory();
                            // v37.10 : une copie oubliée n'est pas l'information oubliée.
                            //   On relit la liste et on compte ce qui porte encore ce texte.
                            const cle = _cleTexte(regle.texte);
                            const restantes = (aiMemoryRag.value || []).filter(x => _cleTexte(x.texte) === cle);
                            if (restantes.length) {
                                aiMemoryErreur.value = { code: 'COPIES_RESTANTES',
                                    message: restantes.length + ' autre(s) entrée(s) portent exactement le même texte : '
                                           + "l'information est toujours dans la base. Utilisez « Oublier les "
                                           + (restantes.length + 1) + ' copies » pour toutes les retirer.' };
                            } else {
                                addLog('ℹ️ ' + _NOTE_HISTORIQUE, 'info');
                            }
                        } catch (e) {`);

// ── 3. Oublier toutes les copies d'un même texte.
sub(`                        } finally {
                            aiSuppressionEnCours.value = null;
                        }`,
`                        } finally {
                            aiSuppressionEnCours.value = null;
                        }
                    };

                    //   Toutes les lignes qui portent le même texte, d'un coup.
                    //   On les supprime une par une : le serveur garde ainsi une
                    //   entrée d'archive par ligne, et un échec en cours de route
                    //   n'annule pas ce qui a déjà été retiré — il est rapporté.
                    const oublierToutesLesCopies = async (regle) => {
                        const ids = (aiMemoryCopies.value || {})[regle.id] || [regle.id];
                        const extrait = String(regle.texte || '').slice(0, 140);
                        if (!confirm('Oublier les ' + ids.length + ' copies de cette règle ?\\n\\n« ' + extrait + ' »\\n\\n'
                                   + "Chacune est archivée côté serveur avant d'être retirée.")) return;
                        aiSuppressionEnCours.value = regle.id;
                        let ok = 0; const echecs = [];
                        try {
                            for (const id of ids) {
                                try { await _supprimerVecteur(id); ok++; }
                                catch (e) { echecs.push(id + ' : ' + ((e && e.message) || e)); }
                            }
                            await chargerAiMemory();
                            if (echecs.length) {
                                aiMemoryErreur.value = { code: 'SUPPRESSION_PARTIELLE',
                                    message: ok + ' copie(s) retirée(s), ' + echecs.length + ' en échec — ' + echecs[0] };
                                addLog('🗑️ Suppression partielle : ' + ok + '/' + ids.length, 'warn');
                            } else {
                                addLog('🗑️ ' + ok + ' copie(s) de la règle oubliée(s). ' + _NOTE_HISTORIQUE, 'success');
                            }
                        } finally {
                            aiSuppressionEnCours.value = null;
                        }`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v37.10 — copies détectées et supprimables');
