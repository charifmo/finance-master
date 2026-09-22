/**
 * v37.2 — SUPPRESSION D'UNE RÈGLE MÉMORISÉE DEPUIS L'INTERFACE
 * ═══════════════════════════════════════════════════════════════════════════
 * Le bouton n'est pas qu'un appel réseau : détruire une règle que l'agent
 * utilise pour raisonner mérite (1) qu'on montre CE QU'ON SUPPRIME dans la
 * confirmation, (2) qu'on dise que c'est archivé côté serveur, et (3) que
 * l'échec le plus probable — Caddy pas encore configuré — soit expliqué en
 * clair plutôt que rendu comme une erreur technique.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import fs from 'node:fs';
const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n'); if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => {
    const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) :\n${from.slice(0, 160)}`);
    s = s.split(from).join(to);
};

/* ── 1. L'icône 🗑️ dans l'en-tête de chaque carte ─────────────────────────── */
sub(`                            <div class="flex items-start justify-between gap-4 mb-2">
                                <span class="text-[10px] font-black uppercase tracking-widest text-indigo-500">Règle #{{ r.id }}</span>
                                <span class="text-[10px] text-gray-400 font-bold shrink-0">{{ r.longueur }} car.</span>
                            </div>`,
`                            <div class="flex items-start justify-between gap-4 mb-2">
                                <span class="text-[10px] font-black uppercase tracking-widest text-indigo-500">Règle #{{ r.id }}</span>
                                <div class="flex items-center gap-3 shrink-0">
                                    <span class="text-[10px] text-gray-400 font-bold">{{ r.longueur }} car.</span>
                                    <button @click="oublierRegle(r)" :disabled="aiSuppressionEnCours === r.id"
                                            class="text-red-400 hover:text-red-600 disabled:text-gray-300 disabled:cursor-wait text-lg leading-none transition-colors"
                                            title="Oublier cette règle définitivement">
                                        {{ aiSuppressionEnCours === r.id ? '⏳' : '🗑️' }}
                                    </button>
                                </div>
                            </div>`);

/* ── 2. État + logique ────────────────────────────────────────────────────── */
sub(`                    const aiMemoryEcartes = ref(0);`,
[`                    const aiMemoryEcartes = ref(0);`,
 `                    const aiSuppressionEnCours = ref(null);`,
 ``,
 `                    // v37.2 — Oublier une règle mémorisée.`,
 `                    //   La confirmation RAPPELLE le texte visé : « voulez-vous`,
 `                    //   supprimer ? » sans dire quoi invite à cliquer oui par réflexe.`,
 `                    const oublierRegle = async (regle) => {`,
 `                        if (!regle || !regle.id) return;`,
 `                        const extrait = String(regle.texte || '').slice(0, 140) + (String(regle.texte || '').length > 140 ? '…' : '');`,
 `                        const ok = confirm('Voulez-vous vraiment oublier cette règle définitivement ?\\n\\n« ' + extrait + ' »\\n\\n'`,
 `                                         + "L'agent cessera de s'en servir. Une copie est conservée côté serveur "`,
 `                                         + '(vectors_supprimes.jsonl) si vous deviez la retrouver.');`,
 `                        if (!ok) return;`,
 `                        aiSuppressionEnCours.value = regle.id;`,
 `                        try {`,
 `                            const res = await fetch(AI_MEMORY_PATH, {`,
 `                                method: 'POST',`,
 `                                headers: {`,
 `                                    'Content-Type': 'application/json',`,
 `                                    // Exigé par le serveur : un en-tête personnalisé force le`,
 `                                    // contrôle CORS, ce qu'un formulaire tiers ne peut pas faire.`,
 `                                    'X-Requested-With': 'XMLHttpRequest',`,
 `                                },`,
 `                                body: JSON.stringify({ action: 'delete_vector', id: regle.id }),`,
 `                            });`,
 `                            const txt = await res.text();`,
 `                            let d; try { d = JSON.parse(txt); } catch (e) { d = null; }`,
 `                            if (!d || d.status !== 'ok') {`,
 `                                // L'échec le plus probable a une cause précise et une solution :`,
 `                                // on la donne, plutôt que d'afficher un code d'erreur.`,
 `                                const cause = (d && d.error === 'PROTECTION_ABSENTE')`,
 `                                    ? "La suppression est bloquée tant que /finance/ n'est pas protégé par Caddy (basic_auth). "`,
 `                                      + 'La lecture continue de fonctionner. Voir CADDY_SECURITE.md.'`,
 `                                    : ((d && d.message) || txt.slice(0, 200));`,
 `                                throw new Error(cause);`,
 `                            }`,
 `                            // Retrait immédiat de la liste, sans attendre le rechargement :`,
 `                            // l'écran doit refléter l'action au moment où elle est faite.`,
 `                            aiMemoryRag.value = aiMemoryRag.value.filter(x => x.id !== regle.id);`,
 `                            addLog('🗑️ Règle #' + regle.id + ' oubliée (archivée dans ' + (d.archive || 'l\\'archive') + ').', 'success');`,
 `                            await chargerAiMemory();`,
 `                        } catch (e) {`,
 `                            aiMemoryErreur.value = { code: 'SUPPRESSION_REFUSEE', message: (e && e.message) || String(e) };`,
 `                            addLog('🗑️ Suppression refusée : ' + aiMemoryErreur.value.message, 'error');`,
 `                        } finally {`,
 `                            aiSuppressionEnCours.value = null;`,
 `                        }`,
 `                    };`,
].join('\n'));

/* ── 3. Exposition ────────────────────────────────────────────────────────── */
sub(`                        aiMemoryToutVoir, aiMemorySeuil, aiMemoryEcartes,`,
    `                        aiMemoryToutVoir, aiMemorySeuil, aiMemoryEcartes, aiSuppressionEnCours, oublierRegle,`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v37.2 — bouton de suppression ajouté');
