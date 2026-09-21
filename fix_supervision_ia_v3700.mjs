/**
 * v37.0 — ESPACE « SUPERVISION IA »
 * ═══════════════════════════════════════════════════════════════════════════
 * Deux tables PostgreSQL rendues lisibles, servies par get_ai_memory.php :
 *   • finance_vectors → les règles que l'agent a mémorisées (RAG). La colonne
 *     embedding n'est jamais lue : des milliers de flottants illisibles.
 *   • chat_history    → les conversations. Le message y est stocké en JSON
 *     LangChain ({"type":"human","data":{"content":"…"}}) ; le backend en
 *     extrait l'auteur et le texte, le frontend n'affiche que du clair.
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

/* ── 1. Bouton de navigation, avant Paramètres ────────────────────────────── */
const NAV_SETTINGS = `                    <button @click="activeTab = 'settings'" :class="['w-full flex items-center rounded-lg transition-colors text-sm font-bold', isSidebarCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-4 py-3 text-left', activeTab === 'settings' ? 'bg-slate-700 shadow-lg' : 'hover:bg-slate-800 text-slate-300']" :title="isSidebarCollapsed ? 'Paramètres' : null"><span class="text-base leading-none shrink-0">🛠️</span><span v-if="!isSidebarCollapsed" class="truncate">Paramètres</span></button>`;
sub(NAV_SETTINGS,
`                    <button @click="activeTab = 'supervision'; if (!aiMemoryChargee) chargerAiMemory()" :class="['w-full flex items-center rounded-lg transition-colors text-sm font-bold', isSidebarCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-4 py-3 text-left', activeTab === 'supervision' ? 'bg-gradient-to-r from-indigo-600 to-violet-700 shadow-lg shadow-indigo-900/50' : 'hover:bg-slate-800 text-slate-300']" :title="isSidebarCollapsed ? 'Supervision IA' : null"><span class="text-base leading-none shrink-0">🧠</span><span v-if="!isSidebarCollapsed" class="truncate">Supervision IA</span></button>
${NAV_SETTINGS}`);

/* ── 2. Le panneau ────────────────────────────────────────────────────────── */
const PANNEAU = [
`                <!-- ═══════════════════════════════════════════════════════════ -->`,
`                <!-- ━━ v37.0 : SUPERVISION IA — mémoire RAG + conversations ━━ -->`,
`                <div v-if="activeTab === 'supervision'" class="max-w-6xl mx-auto space-y-6">`,
`                    <div class="flex items-center justify-between border-b pb-4 flex-wrap gap-3">`,
`                        <h2 class="text-2xl font-bold text-gray-800">🧠 Supervision IA</h2>`,
`                        <div class="flex items-center gap-2">`,
`                            <input v-model="aiMemoryFiltre" @keyup.enter="chargerAiMemory" type="search" placeholder="Filtrer…" class="w-44 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400"/>`,
`                            <button @click="chargerAiMemory" :disabled="aiMemoryChargement" class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-400 text-white font-black text-xs uppercase tracking-widest transition-colors">`,
`                                {{ aiMemoryChargement ? '⏳ Lecture…' : '🔄 Rafraîchir' }}`,
`                            </button>`,
`                        </div>`,
`                    </div>`,
``,
`                    <!-- Erreur de connexion : on dit CE QUI a échoué, pas « erreur » -->`,
`                    <div v-if="aiMemoryErreur" class="bg-red-50 border-2 border-red-200 rounded-2xl p-5">`,
`                        <p class="font-black text-red-800 text-sm uppercase tracking-widest mb-2">⛔ {{ aiMemoryErreur.code || 'Erreur' }}</p>`,
`                        <p class="text-sm text-red-700">{{ aiMemoryErreur.message }}</p>`,
`                        <div v-if="aiMemoryErreur.hotes" class="mt-3 text-[11px] text-red-600 font-mono bg-white/60 rounded-lg p-3 space-y-1">`,
`                            <div v-for="(msg, h) in aiMemoryErreur.hotes" :key="h"><b>{{ h }}</b> : {{ msg }}</div>`,
`                        </div>`,
`                        <p v-if="aiMemoryErreur.indice" class="text-[11px] text-red-600 italic mt-3">{{ aiMemoryErreur.indice }}</p>`,
`                    </div>`,
``,
`                    <div v-if="aiMemoryAvertissement" class="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-[11px] text-amber-800 font-bold">`,
`                        ⚠️ {{ aiMemoryAvertissement }}`,
`                    </div>`,
``,
`                    <!-- Onglets -->`,
`                    <div class="inline-flex rounded-xl bg-white border border-gray-200 p-1 shadow-sm">`,
`                        <button v-for="t in [['rag','📚 Règles mémorisées', aiMemoryRag.length],['chat','💬 Conversations', aiMemoryChat.length]]" :key="t[0]"`,
`                                @click="aiMemoryOnglet = t[0]"`,
`                                :class="['px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-colors', aiMemoryOnglet === t[0] ? 'bg-indigo-600 text-white shadow' : 'text-indigo-600 hover:bg-indigo-50']">`,
`                            {{ t[1] }} <span class="opacity-70">({{ t[2] }})</span>`,
`                        </button>`,
`                    </div>`,
``,
`                    <!-- ══ Règles mémorisées (RAG) ══ -->`,
`                    <div v-show="aiMemoryOnglet === 'rag'" class="space-y-3">`,
`                        <p v-if="!aiMemoryRag.length && !aiMemoryChargement" class="text-center text-gray-400 text-sm py-8 italic">Aucune règle mémorisée.</p>`,
`                        <div v-for="r in aiMemoryRag" :key="'rag_'+r.id" class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:border-indigo-200 transition-colors">`,
`                            <div class="flex items-start justify-between gap-4 mb-2">`,
`                                <span class="text-[10px] font-black uppercase tracking-widest text-indigo-500">Règle #{{ r.id }}</span>`,
`                                <span class="text-[10px] text-gray-400 font-bold shrink-0">{{ r.longueur }} car.</span>`,
`                            </div>`,
`                            <p class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{{ r.texte }}</p>`,
`                            <div v-if="r.metadata" class="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-1.5">`,
`                                <span v-for="(v, k) in aiMetaPlate(r.metadata)" :key="k" class="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">{{ k }} : {{ v }}</span>`,
`                            </div>`,
`                        </div>`,
`                    </div>`,
``,
`                    <!-- ══ Conversations ══ -->`,
`                    <div v-show="aiMemoryOnglet === 'chat'" class="space-y-4">`,
`                        <p v-if="!aiMemoryChat.length && !aiMemoryChargement" class="text-center text-gray-400 text-sm py-8 italic">Aucune conversation enregistrée.</p>`,
`                        <div v-for="(grp, sess) in aiMemoryChatParSession" :key="sess" class="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">`,
`                            <div class="px-5 py-3 bg-gradient-to-r from-slate-50 to-indigo-50 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">`,
`                                <span class="text-[10px] font-black uppercase tracking-widest text-slate-600 font-mono truncate">🔗 {{ sess }}</span>`,
`                                <span class="text-[10px] text-gray-400 font-bold shrink-0">{{ grp.length }} message(s)</span>`,
`                            </div>`,
`                            <div class="p-4 space-y-3">`,
`                                <div v-for="m in grp" :key="'msg_'+m.id" :class="['flex gap-3', m.auteur === 'Vous' ? 'justify-end' : 'justify-start']">`,
`                                    <div :class="['max-w-[80%] rounded-2xl px-4 py-2.5 border', m.auteur === 'Vous' ? 'bg-indigo-50 border-indigo-100' : 'bg-gray-50 border-gray-100']">`,
`                                        <div class="flex items-baseline gap-2 mb-1">`,
`                                            <span :class="['text-[10px] font-black uppercase tracking-widest', m.auteur === 'Vous' ? 'text-indigo-600' : 'text-emerald-600']">{{ m.auteur }}</span>`,
`                                            <span class="text-[9px] text-gray-400 font-bold">{{ aiDateCourte(m.date) }}</span>`,
`                                        </div>`,
`                                        <p class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">{{ m.contenu }}</p>`,
`                                    </div>`,
`                                </div>`,
`                            </div>`,
`                        </div>`,
`                    </div>`,
`                </div>`,
``,
].join('\n');
sub(`                <div v-if="activeTab === 'settings'" class="max-w-5xl mx-auto space-y-8">`,
    PANNEAU + `                <div v-if="activeTab === 'settings'" class="max-w-5xl mx-auto space-y-8">`);

/* ── 3. État et logique ───────────────────────────────────────────────────── */
sub(`                    const DATA_PATH = '/finance/finance_data.json';`,
[`                    const DATA_PATH = '/finance/finance_data.json';`,
 `                    const AI_MEMORY_PATH = '/finance/get_ai_memory.php';`,
 ``,
 `                    // ═══ v37.0 — SUPERVISION IA ═══════════════════════════════════`,
 `                    //   Lecture seule des deux tables Postgres de l'agent. Le`,
 `                    //   chargement est PARESSEUX : rien n'est demandé tant que`,
 `                    //   l'onglet n'est pas ouvert, pour ne pas peser sur le démarrage.`,
 `                    const aiMemoryOnglet = ref('rag');`,
 `                    const aiMemoryRag = ref([]);`,
 `                    const aiMemoryChat = ref([]);`,
 `                    const aiMemoryChargement = ref(false);`,
 `                    const aiMemoryChargee = ref(false);`,
 `                    const aiMemoryErreur = ref(null);`,
 `                    const aiMemoryAvertissement = ref(null);`,
 `                    const aiMemoryFiltre = ref('');`,
 ``,
 `                    const chargerAiMemory = async () => {`,
 `                        aiMemoryChargement.value = true;`,
 `                        aiMemoryErreur.value = null;`,
 `                        try {`,
 `                            const q = aiMemoryFiltre.value.trim();`,
 `                            const url = AI_MEMORY_PATH + '?limit=200' + (q ? '&q=' + encodeURIComponent(q) : '') + '&t=' + Date.now();`,
 `                            const res = await fetch(url, { cache: 'no-store' });`,
 `                            const txt = await res.text();`,
 `                            let d;`,
 `                            try { d = JSON.parse(txt); }`,
 `                            catch (e) {`,
 `                                // Réponse non-JSON = presque toujours une page d'erreur du`,
 `                                // serveur web. On montre le début brut : « JSON invalide »`,
 `                                // tout seul n'aide personne à diagnostiquer.`,
 `                                throw { code: 'REPONSE_ILLISIBLE', message: 'Le serveur n\\'a pas renvoyé de JSON : ' + txt.slice(0, 200) };`,
 `                            }`,
 `                            if (d.status === 'error') throw { code: d.error, message: d.message, hotes: d.hotes_tentes, indice: d.indice };`,
 `                            aiMemoryRag.value = (d.rag && d.rag.regles) || [];`,
 `                            aiMemoryChat.value = (d.chat && d.chat.messages) || [];`,
 `                            aiMemoryAvertissement.value = d.avertissement || null;`,
 `                            // Une table absente n'empêche pas l'autre de s'afficher.`,
 `                            const partiels = [d.rag && d.rag.erreur, d.chat && d.chat.erreur].filter(Boolean);`,
 `                            if (partiels.length) aiMemoryErreur.value = { code: 'TABLE_INDISPONIBLE', message: partiels.join(' · ') };`,
 `                            aiMemoryChargee.value = true;`,
 `                            addLog('🧠 Supervision IA : ' + aiMemoryRag.value.length + ' règle(s), ' + aiMemoryChat.value.length + ' message(s) — hôte ' + (d.hote || '?'), 'success');`,
 `                        } catch (e) {`,
 `                            aiMemoryErreur.value = (e && e.code) ? e : { code: 'INJOIGNABLE', message: (e && e.message) || String(e) };`,
 `                            addLog('🧠 Supervision IA indisponible : ' + aiMemoryErreur.value.message, 'error');`,
 `                        } finally {`,
 `                            aiMemoryChargement.value = false;`,
 `                        }`,
 `                    };`,
 ``,
 `                    // Les messages arrivent du plus récent au plus ancien ; dans une`,
 `                    // session on les relit dans l'ordre de la conversation.`,
 `                    const aiMemoryChatParSession = computed(() => {`,
 `                        const g = {};`,
 `                        for (const m of aiMemoryChat.value) {`,
 `                            const k = m.session_id || '(sans session)';`,
 `                            (g[k] = g[k] || []).push(m);`,
 `                        }`,
 `                        for (const k of Object.keys(g)) g[k].reverse();`,
 `                        return g;`,
 `                    });`,
 ``,
 `                    // Métadonnées aplaties : un objet imbriqué rendrait « [object Object] ».`,
 `                    const aiMetaPlate = (meta) => {`,
 `                        const out = {};`,
 `                        const plat = (o, prefixe) => {`,
 `                            if (o === null || typeof o !== 'object') { out[prefixe || 'valeur'] = String(o); return; }`,
 `                            if (Array.isArray(o)) { out[prefixe || 'valeur'] = o.join(', '); return; }`,
 `                            for (const [k, v] of Object.entries(o)) plat(v, prefixe ? prefixe + '.' + k : k);`,
 `                        };`,
 `                        try { plat(meta, ''); } catch (e) { return {}; }`,
 `                        return out;`,
 `                    };`,
 ``,
 `                    const aiDateCourte = (d) => {`,
 `                        if (!d) return '';`,
 `                        const t = new Date(String(d).replace(' ', 'T'));`,
 `                        if (isNaN(t.getTime())) return String(d);`,
 `                        return t.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });`,
 `                    };`,
].join('\n'));

/* ── 4. Exposition au template ────────────────────────────────────────────── */
sub(`                        activeTab, appMode, modeEdition, fileInput, soldesInitiaux, donneesAnnuelles, projetStudio,`,
`                        activeTab, appMode, modeEdition, fileInput, soldesInitiaux, donneesAnnuelles, projetStudio,
                        // v37.0 — Supervision IA
                        aiMemoryOnglet, aiMemoryRag, aiMemoryChat, aiMemoryChargement, aiMemoryChargee,
                        aiMemoryErreur, aiMemoryAvertissement, aiMemoryFiltre, chargerAiMemory,
                        aiMemoryChatParSession, aiMetaPlate, aiDateCourte,`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v37.0 — espace Supervision IA ajouté');
