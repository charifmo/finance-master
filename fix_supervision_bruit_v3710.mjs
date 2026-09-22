/**
 * v37.1 — MOINS DE BRUIT DANS LA SUPERVISION IA
 * ═══════════════════════════════════════════════════════════════════════════
 * Le tri se fait côté serveur (get_ai_memory.php) : charge utile réduite et
 * règle unique. L'interface se contente d'être HONNÊTE sur ce qui est masqué —
 * un compteur qui baisse sans explication inquiète plus qu'il ne rassure.
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

/* ── 1. Bandeau de transparence en tête de l'onglet RAG ───────────────────── */
sub(`                    <div v-show="aiMemoryOnglet === 'rag'" class="space-y-3">
                        <p v-if="!aiMemoryRag.length && !aiMemoryChargement" class="text-center text-gray-400 text-sm py-8 italic">Aucune règle mémorisée.</p>`,
`                    <div v-show="aiMemoryOnglet === 'rag'" class="space-y-3">
                        <!-- v37.1 : dire ce qui est masqué, et laisser le voir -->
                        <div v-if="aiMemoryEcartes > 0 || aiMemoryToutVoir" class="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex-wrap">
                            <span class="text-[11px] text-slate-600 font-bold">
                                <template v-if="!aiMemoryToutVoir">{{ aiMemoryEcartes }} vecteur(s) de moins de {{ aiMemorySeuil }} caractères masqué(s) — résidus d'indexation (dates, tags isolés).</template>
                                <template v-else>Affichage complet : tous les vecteurs et toutes les métadonnées techniques.</template>
                            </span>
                            <button @click="aiMemoryToutVoir = !aiMemoryToutVoir; chargerAiMemory()" class="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 underline shrink-0">
                                {{ aiMemoryToutVoir ? 'Revenir au tri' : 'Tout afficher' }}
                            </button>
                        </div>
                        <p v-if="!aiMemoryRag.length && !aiMemoryChargement" class="text-center text-gray-400 text-sm py-8 italic">Aucune règle mémorisée.</p>`);

/* ── 2. État ──────────────────────────────────────────────────────────────── */
sub(`                    const aiMemoryFiltre = ref('');`,
`                    const aiMemoryFiltre = ref('');
                    // v37.1 : le serveur écarte les vecteurs trop courts et les
                    //   métadonnées de découpage (loc.lines, blobType, pdf.*).
                    //   Ces trois refs ne servent qu'à le DIRE et à le désactiver.
                    const aiMemoryToutVoir = ref(false);
                    const aiMemorySeuil = ref(30);
                    const aiMemoryEcartes = ref(0);`);

/* ── 3. Requête : transmettre le mode « tout voir » ───────────────────────── */
sub(`                            const url = AI_MEMORY_PATH + '?limit=200' + (q ? '&q=' + encodeURIComponent(q) : '') + '&t=' + Date.now();`,
`                            const url = AI_MEMORY_PATH + '?limit=200'
                                      + (q ? '&q=' + encodeURIComponent(q) : '')
                                      + (aiMemoryToutVoir.value ? '&min_len=0&meta=all' : '')
                                      + '&t=' + Date.now();`);

sub(`                            aiMemoryRag.value = (d.rag && d.rag.regles) || [];`,
`                            aiMemoryRag.value = (d.rag && d.rag.regles) || [];
                            aiMemorySeuil.value = (d.rag && d.rag.seuil_caracteres) || 0;
                            aiMemoryEcartes.value = (d.rag && d.rag.ecartes_trop_courts) || 0;`);

/* ── 4. Exposition ────────────────────────────────────────────────────────── */
sub(`                        aiMemoryChatParSession, aiMetaPlate, aiDateCourte,`,
`                        aiMemoryChatParSession, aiMetaPlate, aiDateCourte,
                        aiMemoryToutVoir, aiMemorySeuil, aiMemoryEcartes,`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v37.1 — transparence sur le tri');
