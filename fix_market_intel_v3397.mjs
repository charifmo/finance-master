/**
 * v33.97 — Intelligence marché intégrée (AI Insights)
 * ---------------------------------------------------------------------------
 * Un bouton 🧠 par actif déplie un accordéon qui interroge l'agent n8n
 * (finance-cfo-web) en recherche web, et affiche les actualités urbanistiques
 * et de marché de la zone.
 *
 * SÉCURITÉ — le contenu renvoyé provient d'une recherche web : ce sont des
 * pages tierces, résumées par un LLM, qu'on s'apprête à injecter en v-html
 * dans l'application. Sans filtre, une page piégée pourrait faire exécuter du
 * script, charger des ressources distantes ou afficher un faux formulaire.
 * Le HTML passe donc par _sanitizeHtml : liste blanche de balises, aucun
 * attribut d'événement, liens externes forcés en target=_blank rel=noopener.
 * Aucune dépendance ajoutée : DOMParser suffit.
 */
import fs from 'node:fs';

const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => {
    const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) :\n${from.slice(0, 160)}`);
    s = s.split(from).join(to);
};

/* ══════════════════════════════════════════════════════════════════════════
   1. STORE — sanitizer + appel webhook
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                    // ── v33.96 : DETTE AU SENS DE LA BANQUE ────────────────────────────`,
String.raw`                    // ═══════════════════════════════════════════════════════════════════
                    // v33.97 — INTELLIGENCE MARCHÉ (recherche web via l'agent n8n)
                    // ═══════════════════════════════════════════════════════════════════
                    const MARKET_WEBHOOK = 'https://n8n.beau.ink/webhook/finance-cfo-web';
                    const marketIntel = ref({});   // { [id]: { open, loading, html, error, at } }

                    // Liste blanche : tout le reste est déballé (contenu conservé, balise jetée)
                    const _BALISES_SURES = new Set(['P','BR','B','STRONG','I','EM','U','UL','OL','LI',
                        'H1','H2','H3','H4','H5','H6','TABLE','THEAD','TBODY','TFOOT','TR','TD','TH',
                        'SPAN','DIV','A','CODE','PRE','BLOCKQUOTE','HR','SMALL','SECTION','ARTICLE']);
                    const _ATTRS_SURS = new Set(['class','colspan','rowspan','title']);

                    // Le résumé vient du web : on ne lui fait aucune confiance.
                    const _sanitizeHtml = (brut) => {
                        let doc;
                        try { doc = new DOMParser().parseFromString('<div id="racine">' + String(brut || '') + '</div>', 'text/html'); }
                        catch (_) { return String(brut || '').replace(/[<>]/g, ''); }
                        const racine = doc.getElementById('racine');
                        if (!racine) return '';
                        // 1. suppression pure des éléments actifs ou porteurs de requêtes
                        racine.querySelectorAll('script,style,iframe,object,embed,form,input,textarea,select,button,link,meta,base,svg,math,audio,video,img,source').forEach(e => e.remove());
                        // 2. parcours en profondeur : balises hors liste déballées, attributs filtrés
                        const nettoyer = (noeud) => {
                            [...noeud.children].forEach(el => {
                                nettoyer(el);
                                [...el.attributes].forEach(at => {
                                    const n = at.name.toLowerCase();
                                    if (n === 'href' && el.tagName === 'A') {
                                        if (!/^https?:\/\//i.test(at.value)) el.removeAttribute('href');
                                        return;
                                    }
                                    if (!_ATTRS_SURS.has(n)) el.removeAttribute(at.name);
                                });
                                if (el.tagName === 'A' && el.getAttribute('href')) {
                                    el.setAttribute('target', '_blank');
                                    el.setAttribute('rel', 'noopener noreferrer nofollow');
                                }
                                if (!_BALISES_SURES.has(el.tagName)) el.replaceWith(...el.childNodes);
                            });
                        };
                        nettoyer(racine);
                        return racine.innerHTML;
                    };

                    const _majIntel = (id, patch) => {
                        marketIntel.value = Object.assign({}, marketIntel.value,
                            { [id]: Object.assign({}, marketIntel.value[id] || {}, patch) });
                    };

                    const chargerMarketIntel = async (asset) => {
                        const a = asset || {}; const id = a.id;
                        _majIntel(id, { loading: true, error: '', html: '' });
                        try {
                            const res = await fetch(MARKET_WEBHOOK, {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    session_id: 'market_intel_' + id,
                                    question: "Fais une recherche web approfondie (web_search) sur les dernières actualités immobilières, "
                                        + "les prix du marché, et les projets urbanistiques (SDAU, infrastructures) pour la zone suivante au Maroc : "
                                        + (a.name || '') + " (Type: " + (a.type || '') + "). Résume les informations clés en 3 bullet points.",
                                })
                            });
                            if (!res.ok) throw new Error('HTTP ' + res.status);
                            const raw = await res.text();
                            let html = '';
                            try { const j = JSON.parse(raw); html = j.html || j.output || j.response || j.message || raw; }
                            catch (_) { html = raw; }
                            const propre = _sanitizeHtml(html);
                            _majIntel(id, { html: propre || '<p>Aucune information trouvée pour cette zone.</p>',
                                            at: new Date().toLocaleString('fr-FR') });
                        } catch (e) {
                            _majIntel(id, { error: "Impossible de joindre l'agent IA — " + (e.message || e) });
                        } finally {
                            _majIntel(id, { loading: false });
                        }
                    };

                    const toggleMarketIntel = (asset) => {
                        const id = (asset || {}).id;
                        const cur = marketIntel.value[id] || {};
                        const open = !cur.open;
                        _majIntel(id, { open });
                        // une seule recherche par session : on ne rappelle pas l'agent à chaque ouverture
                        if (open && !cur.html && !cur.loading) chargerMarketIntel(asset);
                    };
                    const rafraichirMarketIntel = (asset) => chargerMarketIntel(asset);

                    // ── v33.96 : DETTE AU SENS DE LA BANQUE ────────────────────────────`);

sub(
`                        detteBancaire, globalDetteBancaire,`,
`                        detteBancaire, globalDetteBancaire,
                        marketIntel, toggleMarketIntel, chargerMarketIntel, rafraichirMarketIntel,`);

/* ══════════════════════════════════════════════════════════════════════════
   2. TABLE — bouton 🧠 + accordéon
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                                                    <button @click="toggleExit(asset.id, asset)" :class="['p-1.5 rounded-lg transition-colors', exitOpen[asset.id] ? 'bg-fuchsia-100 text-fuchsia-700' : 'hover:bg-fuchsia-100 text-fuchsia-600']" title="Simuler une revente">🔮</button>`,
`                                                    <button @click="toggleMarketIntel(asset)" :class="['p-1.5 rounded-lg transition-colors', (marketIntel[asset.id] || {}).open ? 'bg-sky-100 text-sky-700' : 'hover:bg-sky-100 text-sky-600']" title="Intelligence marché — actualités de la zone">🧠</button>
                                                    <button @click="toggleExit(asset.id, asset)" :class="['p-1.5 rounded-lg transition-colors', exitOpen[asset.id] ? 'bg-fuchsia-100 text-fuchsia-700' : 'hover:bg-fuchsia-100 text-fuchsia-600']" title="Simuler une revente">🔮</button>`);

sub(
`                                        <!-- v33.90 : Exit Simulator en accordéon sous la ligne -->`,
`                                        <!-- v33.97 : Intelligence marché en accordéon sous la ligne -->
                                        <tr v-if="(marketIntel[asset.id] || {}).open" class="bg-slate-50">
                                            <td colspan="8" class="px-4 pb-4 pt-0">
                                                <template v-for="mi in [marketIntel[asset.id] || {}]" :key="'mi'+asset.id">
                                                <div class="rounded-2xl border-2 border-slate-700 overflow-hidden">
                                                    <div class="px-4 py-2.5 bg-gradient-to-r from-slate-900 to-sky-900 text-white flex items-center justify-between flex-wrap gap-2">
                                                        <p class="font-black uppercase tracking-widest text-[11px]">🧠 Intelligence marché — {{ asset.name }}</p>
                                                        <div class="flex items-center gap-2">
                                                            <span v-if="mi.at" class="text-[9px] opacity-60">recherche du {{ mi.at }}</span>
                                                            <button @click="rafraichirMarketIntel(asset)" :disabled="mi.loading"
                                                                    class="text-[9px] font-black uppercase tracking-widest bg-white/15 hover:bg-white/25 disabled:opacity-40 px-2 py-1 rounded-lg transition-colors">↻ Actualiser</button>
                                                        </div>
                                                    </div>
                                                    <div class="p-5 bg-slate-100">
                                                        <!-- Chargement -->
                                                        <div v-if="mi.loading" class="flex items-center gap-3 text-slate-600 py-4">
                                                            <span class="inline-block w-5 h-5 border-2 border-slate-300 border-t-sky-600 rounded-full animate-spin"></span>
                                                            <div>
                                                                <p class="text-sm font-black">Recherche des dernières actualités marchés par l'IA…</p>
                                                                <p class="text-[10px] text-slate-400 font-bold">Prix, projets urbanistiques, SDAU et infrastructures de la zone</p>
                                                            </div>
                                                        </div>
                                                        <!-- Erreur -->
                                                        <div v-else-if="mi.error" class="flex items-start gap-3 py-2">
                                                            <span class="text-lg leading-none">⚠️</span>
                                                            <div>
                                                                <p class="text-sm font-black text-red-700">{{ mi.error }}</p>
                                                                <button @click="rafraichirMarketIntel(asset)" class="mt-2 text-[10px] font-black uppercase tracking-widest bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg transition-colors">Réessayer</button>
                                                            </div>
                                                        </div>
                                                        <!-- Réponse (HTML assaini) -->
                                                        <div v-else class="cfo-html text-sm text-slate-800 leading-relaxed" v-html="mi.html"></div>
                                                        <p v-if="mi.html && !mi.loading" class="text-[9px] text-slate-400 font-bold mt-3 pt-2 border-t border-slate-200">
                                                            Synthèse produite par recherche web — à recouper avant toute décision d'achat ou de vente.
                                                        </p>
                                                    </div>
                                                </div>
                                                </template>
                                            </td>
                                        </tr>
                                        <!-- v33.90 : Exit Simulator en accordéon sous la ligne -->`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v33.97 appliquée');
