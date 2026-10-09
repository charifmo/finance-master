# -*- coding: utf-8 -*-
"""
v37.38 Memoire-Garantie — ce que vous demandez de mémoriser est écrit, entité
par entité, et la Recherche Éclair connaît le bien qu'elle cherche.

  1. LE CFO AFFIRMAIT DES ÉCRITURES QU'IL N'AVAIT PAS FAITES. « Mémorise ces
     deux actifs » : un seul appel à memory_writer (Actif Nord), puis une
     réponse « j'ai mémorisé les deux ». Rien ne confrontait l'affirmation à la
     base. Désormais :
       • l'application ajoute à toute demande de mémorisation une consigne
         explicite : un appel memory_writer PAR ENTITÉ (la boucle est exigée,
         pas espérée) ;
       • après chaque réponse, le GARDE-MÉMOIRE (cfo_memoire_garde.php) relit
         l'échange dans chat_history, découpe la demande en entités, cherche
         chacune dans finance_vectors, écrit celles qui manquent et les RELIT
         en base. La garantie ne dépend plus du modèle qui a oublié ;
       • un « 🔒 Reçu de mémorisation » suit la réponse : ce que la base
         contient, entité par entité — pas ce que le CFO a dit ;
       • les échanges Telegram sont rattrapés à l'ouverture de l'application
         et au retour sur l'onglet (toutes les 5 minutes au plus).

  2. LA RECHERCHE ÉCLAIR ÉTAIT AVEUGLE. Elle n'envoyait que le nom et le type
     de l'actif : « Ouahat Sidi Brahim » ramenait des prix de villas. Avant
     d'interroger l'agent, l'application lit désormais la mémoire (la même que
     la Supervision IA), retrouve la fiche de CET actif (superficie, zonage,
     contraintes) et la cite telle quelle, avec la fiche de l'application et
     une méthode : 2 à 3 requêtes expertes qui combinent ces variables, les
     requêtes génériques interdites, la liste des requêtes utilisées en fin de
     réponse. Le bandeau de la carte montre la fiche injectée.
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

GARDE_JS = r"""                    // ═══ v37.38 — GARDE-MÉMOIRE ════════════════════════════════════════
                    //   « Mémorise ces deux actifs » : le CFO appelait memory_writer UNE fois
                    //   (Actif Nord) puis affirmait avoir tout mémorisé. Deux remparts :
                    //   1. la demande part avec une consigne explicite — un appel PAR ENTITÉ ;
                    //   2. après la réponse, le serveur relit l'échange, cherche chaque entité
                    //      en base, écrit celles qui manquent et les relit (cfo_memoire_garde.php).
                    //   Le reçu affiché dit ce que la BASE contient, pas ce que le CFO a dit.
                    const GARDE_MEMOIRE_PATH = '/finance/cfo_memoire_garde.php';
                    const _GM_DECLENCHEUR = /(?:^|[^\p{L}])(?:m[ée]moris(?:e|es|ez|er|ons)(?![\p{L}])|retiens(?![\p{L}])|retenir(?![\p{L}])|souviens[\s-]+toi|rappelle[\s-]+toi|garde[sz]?\s+(?:\S+\s+)?en\s+(?:m[ée]moire|t[êe]te)|n['’]oublie\s+pas\s+que|prends?\s+(?:bonne\s+)?note|note\s+(?:que|bien|pour\s+(?:le\s+)?futur)|(?:enregistr|sauvegard|ajout|stock|consign|mets|met|place)\S*\s+.{0,40}?(?:dans|en|[àa]u?)\s+(?:ta\s+|la\s+|ma\s+|le\s+|votre\s+)?(?:m[ée]moire|base\s+de\s+connaissances?|rag|r[ée]f[ée]rentiel)(?![\p{L}]))/iu;
                    const _GM_CONSIGNE = "\n\n⟦GARDE-MÉMOIRE⟧ Consigne de l'application, à appliquer sans la citer : ce message demande une mémorisation. "
                        + "Identifie CHAQUE information ou entité distincte (chaque actif, terrain, règle, préférence) et appelle memory_writer "
                        + "UNE FOIS PAR ENTITÉ — deux actifs = deux appels — avec pour chacune une phrase autonome qui reprend son nom, ses chiffres "
                        + "(superficie, zonage, prix, dates) et ses contraintes. N'écris « mémorisé » que pour les appels qui ont renvoyé "
                        + "status ok, et liste-les. ⟦/GARDE-MÉMOIRE⟧";
                    const _avecConsigneMemoire = (q) => _GM_DECLENCHEUR.test(q) ? q + _GM_CONSIGNE : q;

                    const _GM_STATUTS = {
                        en_memoire: { icone: '✅', texte: 'en mémoire' },
                        ecrite:     { icone: '🛟', texte: "<b>rattrapée</b> — le CFO l'avait omise : le garde-fou l'a écrite, puis relue en base" },
                        echec:      { icone: '❌', texte: 'écriture en échec — nouvel essai automatique au prochain passage' },
                        en_attente: { icone: '⏳', texte: 'en file — écrite au prochain passage' },
                        supprimee:  { icone: '🗑️', texte: "vous l'aviez effacée de la Supervision IA : non réécrite" },
                    };
                    const _gmLigne = (e) => {
                        const s = _GM_STATUTS[e.statut] || { icone: '•', texte: _echapper(e.statut) };
                        return '<li data-gm-statut="' + _echapper(e.statut) + '" style="margin:3px 0">' + s.icone + ' <b>' + _echapper(e.titre) + '</b> — ' + s.texte
                            + (e.erreur ? ' <span style="color:#b91c1c">(' + _echapper(e.erreur) + ')</span>' : '') + '</li>';
                    };
                    const _recuMemoireHtml = (recus, rattrapage) => {
                        const liste = [].concat(recus);
                        const ent = liste.flatMap(r => r.entites || []);
                        const ok = ent.filter(e => e.statut === 'en_memoire' || e.statut === 'ecrite').length;
                        const omises = ent.filter(e => e.statut === 'ecrite').length;
                        const rouge = ent.some(e => e.statut === 'echec');
                        let h = '<div data-recu-memoire' + (rattrapage ? ' data-gm-rattrapage' : '') + ' style="border-left:3px solid ' + (rouge ? '#dc2626' : '#0f766e')
                              + ';background:' + (rouge ? '#fef2f2' : '#f0fdfa') + ';padding:8px 12px;border-radius:8px;font-size:12px">';
                        if (rattrapage) {
                            h += '<b style="color:#0f766e">🔒 Garde-mémoire — rattrapage</b><br>Des demandes de mémorisation précédentes n\'avaient pas été entièrement écrites :';
                            liste.forEach(r => {
                                const canal = String(r.session_id || '').indexOf('tg_') === 0 ? 'Telegram' : 'chat web';
                                h += '<div style="margin-top:6px"><span style="color:#64748b">' + canal + (r.date ? ' · ' + _echapper(String(r.date).slice(0, 16)) : '')
                                   + ' — « ' + _echapper(r.extrait || '') + (String(r.extrait || '').length >= 140 ? '…' : '') + ' »</span><ul style="margin:4px 0 0 0;padding-left:16px">'
                                   + (r.entites || []).filter(e => e.statut !== 'en_memoire').map(_gmLigne).join('') + '</ul></div>';
                            });
                        } else {
                            h += '<b style="color:' + (rouge ? '#b91c1c' : '#0f766e') + '">🔒 Reçu de mémorisation — ' + ok + '/' + ent.length + ' entité' + (ent.length > 1 ? 's' : '')
                               + ' en mémoire, vérifiée' + (ent.length > 1 ? 's' : '') + ' en base</b><ul style="margin:6px 0 0 0;padding-left:16px">' + ent.map(_gmLigne).join('') + '</ul>';
                            if (omises) h += '<div style="margin-top:4px;color:#b45309">⚠️ Le CFO en avait omis ' + omises + ' : c\'est ce reçu, relu en base, qui fait foi.</div>';
                        }
                        return `${h}</div>`;
                    };

                    let _gmEnCours = null, _gmDernier = 0;
                    const garantirMemoire = async ({ session = null, silencieux = false } = {}) => {
                        // un passage à la fois ; celui qui attend repasse ensuite (le serveur
                        // n'écrit qu'une fois par échange, deux passages ne doublonnent rien)
                        while (_gmEnCours) { try { await _gmEnCours; } catch (_) {} }
                        _gmEnCours = (async () => {
                            try {
                                const res = await fetch(GARDE_MEMOIRE_PATH, {
                                    method: 'POST', cache: 'no-store',
                                    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                                    body: JSON.stringify({ action: 'garantir' }),
                                });
                                const txt = await res.text();
                                let d = null; try { d = JSON.parse(txt); } catch (_) { d = null; }
                                if (!d || d.status !== 'ok') {
                                    if (!silencieux) addLog('🔒 Garde-mémoire indisponible : ' + ((d && (d.message || d.error)) || ('HTTP ' + res.status)), 'warn');
                                    return null;
                                }
                                _gmDernier = Date.now();
                                const recus = d.recus || [];
                                const miens = session ? recus.filter(r => r.session_id === session) : [];
                                const autres = recus.filter(r => !miens.includes(r) && (r.entites || []).some(e => e.statut !== 'en_memoire'));
                                const t = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                                miens.forEach(r => cfoMessages.value.push({ role: 'agent', time: t, content: _recuMemoireHtml(r, false) }));
                                if (autres.length) cfoMessages.value.push({ role: 'agent', time: t, content: _recuMemoireHtml(autres, true) });
                                if (miens.length || autres.length) scrollCFOToBottom();
                                if (d.ecrites) addLog('🔒 Garde-mémoire : ' + d.ecrites + ' entrée(s) écrite(s) que le CFO avait omise(s).', 'success');
                                if (d.echecs) addLog('🔒 Garde-mémoire : ' + d.echecs + ' écriture(s) en échec — nouvel essai au prochain passage.', 'error');
                                return d;
                            } catch (e) {
                                if (!silencieux) addLog('🔒 Garde-mémoire injoignable : ' + (e.message || e), 'warn');
                                return null;
                            }
                        })();
                        const p = _gmEnCours;
                        try { return await p; } finally { if (_gmEnCours === p) _gmEnCours = null; }
                    };

                    const forceUpdateCalculations = () => { calculationTick.value++; };"""

patch('index.html', [
('garde-mémoire : moteur', r"""                    const forceUpdateCalculations = () => { calculationTick.value++; };""", GARDE_JS),
('garde-mémoire : consigne', r"""                                    session_id: cfoSessionId.value,
                                    question: question,
                                    source: 'web',""", r"""                                    session_id: cfoSessionId.value,
                                    question: _avecConsigneMemoire(question),   // v37.38 : un appel memory_writer par entité
                                    source: 'web',"""),
('garde-mémoire : après la réponse', r"""                                           + 'Vous avez des modifications non sauvegardées : rien n\'a été rechargé pour ne pas les perdre. Le bandeau en haut de l\'écran vous laisse choisir.</div>' });
                                scrollCFOToBottom();
                            }
                        }
                    };""", r"""                                           + 'Vous avez des modifications non sauvegardées : rien n\'a été rechargé pour ne pas les perdre. Le bandeau en haut de l\'écran vous laisse choisir.</div>' });
                                scrollCFOToBottom();
                            }
                            // v37.38 : la base, pas la parole du CFO — le garde-mémoire relit
                            //   l'échange, écrit ce qui manque et affiche le reçu.
                            await garantirMemoire({ session: cfoSessionId.value });
                        }
                    };"""),
('garde-mémoire : retour sur l\'onglet', r"""                        if (Date.now() - _dernierRetour < 5000) return;
                        _dernierRetour = Date.now();""", r"""                        if (Date.now() - _dernierRetour < 5000) return;
                        _dernierRetour = Date.now();
                        // v37.38 : les mémorisations demandées par Telegram sont rattrapées ici
                        if (Date.now() - _gmDernier > 300000) garantirMemoire({ silencieux: true });"""),
('garde-mémoire : ouverture', r"""                        } catch (e) { addLog("Mode hors-ligne local activé.", 'warn'); migrateCategoriesV22(); /* v22.00 P1 */ }
""", r"""                        } catch (e) { addLog("Mode hors-ligne local activé.", 'warn'); migrateCategoriesV22(); /* v22.00 P1 */ }
                        // v37.38 : à l'ouverture, rattraper toute mémorisation demandée mais non écrite
                        garantirMemoire({ silencieux: true });
"""),
('garde-mémoire : exports', r"""brieferCFO, consulterCFO, envoyerCFO, saveCFOWebhook, resetCFOSession,""",
 r"""brieferCFO, consulterCFO, envoyerCFO, garantirMemoire, saveCFOWebhook, resetCFOSession,"""),

# ══ 2. La Recherche Éclair hydratée par la fiche mémorisée ══════════════════
('éclair : fiche mémorisée', r"""                    const chargerMarketIntel = async (asset) => {
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
                            });""", r"""                    // ── v37.38 : LA FICHE MÉMORISÉE DE L'ACTIF ─────────────────────────
                    //   La Recherche Éclair n'envoyait que le nom et le type : « Ouahat Sidi
                    //   Brahim » ramenait des prix de villas pour un terrain de 7 ha en SHL2
                    //   sur la RN9. Avant d'interroger l'agent, on lit la mémoire (la même
                    //   que la Supervision IA) et on retrouve la fiche de CET actif par les
                    //   mots qui le distinguent : « Nord » derrière Actif / Terrain (avec sa
                    //   majuscule : « le terrain est » n'est pas l'Actif Est), « Ouahat »,
                    //   « Brahim »… Le mot générique (Terrain, Villa) ne compte pas.
                    const _MI_MOTS_LIEU = ['actif', 'terrain', 'foncier', 'lot', 'parcelle', 'bien', 'local', 'villa', 'appartement', 'appart',
                                           'studio', 'maison', 'immeuble', 'ferme', 'lotissement', 'zone', 'site', 'secteur'];
                    const _MI_CARDINAUX = ['nord', 'sud', 'est', 'ouest', 'centre'];
                    const _MI_VIDES = new Set([..._MI_MOTS_LIEU, 'de', 'du', 'des', 'la', 'le', 'les', 'al', 'el', 'et', 'rte', 'route',
                                               'commercial', 'residentiel', 'investissement', 'terrains', 'actifs']);
                    const _miNorm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
                    const _miEchap = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const _MI_LIEU_RE = '(?:' + _MI_MOTS_LIEU.map(m => '[' + m[0].toUpperCase() + m[0] + ']' + m.slice(1)).join('|') + ')s?\\s+';
                    const _identiteActif = (nom) => String(nom || '').split(/[\s()\/,·–-]+/)
                        .map(m => m.replace(/^[«"']+|[»"']+$/g, ''))
                        .map(m => ({ brut: m, norm: _miNorm(m) }))
                        .filter(m => m.norm.length >= 3 && !_MI_VIDES.has(m.norm))
                        .map(m => ({ ...m, cardinal: _MI_CARDINAUX.includes(m.norm) }));
                    const _scoreFiche = (ids, texte) => {
                        const n = _miNorm(texte); let s = 0;
                        for (const id of ids) {
                            if (id.cardinal) {
                                const nom = id.norm[0].toUpperCase() + id.norm.slice(1);
                                if (new RegExp(_MI_LIEU_RE + nom + '(?![\\p{L}])', 'u').test(texte)) s += 2;
                            } else if (new RegExp('(?<![\\p{L}\\p{N}])' + _miEchap(id.norm) + '(?![\\p{L}\\p{N}])', 'u').test(n)) {
                                s += id.norm.length >= 5 ? 2 : 1;
                            }
                        }
                        return s;
                    };
                    const _fichesRagActif = (asset, regles) => {
                        const ids = _identiteActif((asset || {}).name);
                        if (!ids.length) return [];
                        return (regles || []).map(r => ({ id: r.id, texte: String(r.texte || '').trim() }))
                            .filter(r => r.texte.length >= 20)
                            .map(r => ({ ...r, score: _scoreFiche(ids, r.texte) }))
                            .filter(r => r.score >= 2)
                            .sort((x, y) => y.score - x.score || y.texte.length - x.texte.length)
                            .slice(0, 3);
                    };
                    // Les variables qui font le prix d'un terrain, repérées dans la fiche :
                    // montrées sur la carte, rappelées à l'agent.
                    const _variablesFiche = (texte) => {
                        const t = String(texte || ''), out = [];
                        const add = (v) => { v = v.replace(/\s+/g, ' ').trim(); if (v && !out.some(o => o.toLowerCase() === v.toLowerCase())) out.push(v); };
                        (t.match(/\d+(?:[.,]\d+)?(?:\s\d{3})*\s*(?:ha|hectares?|m²|m2)(?![\p{L}\p{N}])/giu) || []).forEach(add);
                        (t.match(/(?<![\p{L}\p{N}])(?:SHL\s?\d|SA\s?\d|R\+\d|COS\s*[\d.,]+|CUS\s*[\d.,]+)(?![\p{L}\p{N}])/gu) || []).forEach(add);
                        (t.match(/(?<![\p{L}\p{N}])zone\s+(?:agricole|villas?|immeubles?|industrielle|touristique|rurale)(?![\p{L}])/giu) || []).forEach(add);
                        (t.match(/(?<![\p{L}\p{N}])(?:RN|RR|RP)\s?\d{1,3}(?![\p{L}\p{N}])/gu) || []).forEach(add);
                        (t.match(/(?<![\p{L}])(?:titre\s+foncier|non\s+titr[ée]|melkia|indivision|VNA|SDAU|plan\s+d['’]am[ée]nagement|servitudes?|non\s+constructible)(?![\p{L}])/giu) || []).forEach(add);
                        return out.slice(0, 10);
                    };
                    const _questionMarketIntel = (asset, fiches, memoireOk) => {
                        const a = asset || {}, L = [];
                        const nf = (n) => Math.round(Number(n) || 0).toLocaleString('fr-FR');
                        L.push("MISSION — Recherche Éclair (lecture seule) : veille de marché CIBLÉE pour UN actif de mon patrimoine au Maroc. "
                             + "Cherche le marché de CE bien précis, pas celui de l'immobilier en général.");
                        L.push('', "ACTIF — fiche de l'application :", '• Nom : ' + (a.name || '—'));
                        const typ = [a.type, a.quotePart && a.quotePart !== '100%' ? 'quote-part ' + a.quotePart : ''].filter(Boolean).join(' · ');
                        if (typ) L.push('• Type : ' + typ);
                        if (Number(a.surface_totale) > 0) L.push('• Surface : ' + nf(a.surface_totale) + ' m²'
                            + (Number(a.surface_totale) >= 10000 ? ' (' + (Number(a.surface_totale) / 10000).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' ha)' : ''));
                        if (a.zonage_actuel || a.zonage_cible) L.push('• Zonage : ' + (a.zonage_actuel || '?') + (a.zonage_cible ? ' → cible ' + a.zonage_cible : ''));
                        if (Number(a.prix_m2) > 0 || Number(a.prix_m2_cible) > 0) L.push('• Prix au m² retenu : ' + (Number(a.prix_m2) > 0 ? nf(a.prix_m2) + ' DH' : '—')
                            + (Number(a.prix_m2_cible) > 0 ? ' · cible ' + nf(a.prix_m2_cible) + ' DH' : ''));
                        if (Number(a.value) > 0) L.push('• Valeur retenue : ' + nf(a.value) + ' DH');
                        if (Number(a.annee_acquisition) > 0) L.push('• Acquis en ' + a.annee_acquisition);
                        L.push('');
                        if (fiches.length) {
                            L.push("FICHE MÉMORISÉE — ta mémoire (RAG), citée telle quelle. Elle FAIT FOI sur la nature du bien (superficie, zonage, localisation, contraintes) :");
                            fiches.forEach((f, i) => L.push((fiches.length > 1 ? '[' + (i + 1) + '] ' : '') + '« ' + f.texte + ' »'));
                            const vars = _variablesFiche(fiches.map(f => f.texte).join('\n'));
                            if (vars.length) L.push('Variables repérées : ' + vars.join(' · '));
                            if (fiches.length > 1) L.push("Si une fiche parle aussi d'autres biens, n'en retiens que ce qui concerne « " + (a.name || '') + " ».");
                        } else {
                            L.push((memoireOk ? "FICHE MÉMORISÉE : aucune trouvée par l'application pour ce nom." : "FICHE MÉMORISÉE : la mémoire n'a pas pu être lue par l'application.")
                                 + " AVANT toute recherche web, appelle finance_rag avec « " + (a.name || '') + " » pour retrouver superficie, zonage et contraintes. "
                                 + "S'il n'y a rien, travaille avec la fiche de l'application et dis-le en une ligne.");
                        }
                        L.push('', 'MÉTHODE OBLIGATOIRE :',
                            "1. Extrais les variables qui font le prix de CE bien : superficie (m² / ha), zonage et constructibilité (SHL2, R+n, COS, agricole…), "
                            + "axe ou route (RN…), commune / province, contraintes (titre foncier, indivision, servitudes, SDAU).",
                            "2. Forge 2 à 3 requêtes web_search EXPERTES qui combinent ces variables — par exemple « prix m² terrain [zonage] [commune] [année] », "
                            + "« plan d'aménagement / SDAU [commune] [zonage] », « transaction grand terrain [superficie] [axe] ». INTERDIT : une requête générique "
                            + "(« prix villa », « prix immobilier Maroc ») qui ignore la superficie, le zonage ou la localisation.",
                            "3. Appelle web_search pour chacune, puis synthétise en 3 points : (a) fourchette de prix au m² pour CE type de bien — même zonage, même "
                            + "ordre de surface ; (b) projets urbanistiques et infrastructures qui touchent cette zone ; (c) risques et contraintes. Un chiffre qui "
                            + "concerne un autre type de bien (villa bâtie, appartement) est écarté ou signalé comme tel, jamais présenté comme le prix de cet actif.",
                            "4. Termine par une ligne « Requêtes utilisées : » qui liste les requêtes exactes envoyées à web_search.",
                            "LECTURE SEULE : aucun propose_changes, aucun committer, aucun memory_writer. Cite « Source : Recherche Internet ».");
                        return L.join('\n');
                    };

                    const chargerMarketIntel = async (asset) => {
                        const a = asset || {}; const id = a.id;
                        _majIntel(id, { loading: true, error: '', html: '', etape: 'memoire', contexte: null });
                        // 1. La fiche mémorisée — AVANT la recherche. Une mémoire illisible
                        //    n'empêche pas la recherche : l'agent est alors prié de la lire lui-même.
                        let fiches = [], memoireOk = false;
                        try {
                            const r = await fetch(AI_MEMORY_PATH + '?table=rag&limit=500&min_len=20&t=' + Date.now(), { cache: 'no-store' });
                            const d = JSON.parse(await r.text());
                            if (r.ok && d && d.status !== 'error' && d.rag && !d.rag.erreur) { memoireOk = true; fiches = _fichesRagActif(a, d.rag.regles); }
                        } catch (_) { memoireOk = false; }
                        _majIntel(id, { etape: 'web', contexte: {
                            memoireOk,
                            fiches: fiches.map(f => ({ id: f.id, extrait: f.texte.length > 220 ? f.texte.slice(0, 217) + '…' : f.texte })),
                            variables: _variablesFiche(fiches.map(f => f.texte).join('\n')),
                        } });
                        try {
                            const res = await fetch(MARKET_WEBHOOK, {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    session_id: 'market_intel_' + id,
                                    question: _questionMarketIntel(a, fiches, memoireOk),
                                })
                            });"""),
('éclair : chargement en deux temps', r"""                                                        <div v-if="mi.loading" class="flex items-center gap-3 text-slate-600 py-4">
                                                            <span class="inline-block w-5 h-5 border-2 border-slate-300 border-t-sky-600 rounded-full animate-spin"></span>
                                                            <div>
                                                                <p class="text-sm font-black">Recherche des dernières actualités marchés par l'IA…</p>
                                                                <p class="text-[10px] text-slate-400 font-bold">Prix, projets urbanistiques, SDAU et infrastructures de la zone</p>
                                                            </div>
                                                        </div>""", r"""                                                        <div v-if="mi.loading" class="flex items-center gap-3 text-slate-600 py-4">
                                                            <span class="inline-block w-5 h-5 border-2 border-slate-300 border-t-sky-600 rounded-full animate-spin"></span>
                                                            <div>
                                                                <p class="text-sm font-black">{{ mi.etape === 'memoire' ? 'Lecture de la fiche mémorisée de l’actif…' : 'Recherche ciblée par l’IA…' }}</p>
                                                                <p class="text-[10px] text-slate-400 font-bold">{{ mi.etape === 'memoire' ? 'Superficie, zonage et contraintes, avant toute requête web' : 'Requêtes expertes : prix au m² du même type de bien, SDAU, infrastructures de la zone' }}</p>
                                                            </div>
                                                        </div>"""),
('éclair : bandeau de contexte', r"""                                                            <button @click="rafraichirMarketIntel(asset)" :disabled="mi.loading"
                                                                    class="text-[9px] font-black uppercase tracking-widest bg-white/15 hover:bg-white/25 disabled:opacity-40 px-2 py-1 rounded-lg transition-colors">↻ Actualiser</button>
                                                        </div>
                                                    </div>""", r"""                                                            <button @click="rafraichirMarketIntel(asset)" :disabled="mi.loading"
                                                                    class="text-[9px] font-black uppercase tracking-widest bg-white/15 hover:bg-white/25 disabled:opacity-40 px-2 py-1 rounded-lg transition-colors">↻ Actualiser</button>
                                                        </div>
                                                    </div>
                                                    <!-- v37.38 : ce que la recherche sait du bien — la fiche mémorisée injectée -->
                                                    <div v-if="mi.contexte" data-mi-contexte class="px-4 py-2 bg-slate-800 text-[10px] text-slate-200 flex flex-wrap items-center gap-1.5">
                                                        <template v-if="mi.contexte.fiches.length">
                                                            <span data-mi-fiche class="font-black uppercase tracking-widest text-emerald-300 mr-1">📎 Fiche mémorisée injectée{{ mi.contexte.fiches.length > 1 ? ' (' + mi.contexte.fiches.length + ')' : '' }}</span>
                                                            <span v-for="v in mi.contexte.variables" :key="v" data-mi-variable class="px-1.5 py-0.5 rounded bg-white/10 font-bold whitespace-nowrap">{{ v }}</span>
                                                            <span data-mi-extrait class="w-full italic text-slate-400 truncate" :title="mi.contexte.fiches[0].extrait">« {{ mi.contexte.fiches[0].extrait }} »</span>
                                                        </template>
                                                        <span v-else-if="mi.contexte.memoireOk" data-mi-sans-fiche class="font-bold text-amber-300">⚠️ Aucune fiche mémorisée pour cet actif — l'agent consulte sa mémoire (finance_rag) avant de chercher.</span>
                                                        <span v-else data-mi-memoire-ko class="font-bold text-amber-300">⚠️ Mémoire illisible depuis l'application — l'agent consulte finance_rag avant de chercher.</span>
                                                    </div>"""),
])

patch('get_ai_memory.php', [
('consigne retirée de l\'affichage', r"""require_once __DIR__ . '/cfo_rag_ids.php';   // v37.10 : reconnaissance des identifiants""",
 r"""require_once __DIR__ . '/cfo_rag_ids.php';   // v37.10 : reconnaissance des identifiants
require_once __DIR__ . '/cfo_memoire_lib.php';  // v37.38 : la consigne du garde-mémoire n'est pas à afficher"""),
('consigne retirée de l\'affichage (2)', r"""            return ['auteur' => $auteur, 'contenu' => (string)$contenu];
        };""", r"""            return ['auteur' => $auteur, 'contenu' => cfo_gm_sans_consigne((string)$contenu)];
        };"""),
])
