/**
 * v37.4 — UNE RÉPONSE VIDE NE DOIT PLUS S'AFFICHER COMME UN JSON BRUT
 * ═══════════════════════════════════════════════════════════════════════════
 * Symptôme observé : le CFO répond « {"session_id":"c44fdff8-…"} » dans la
 * bulle de conversation.
 *
 * MÉCANIQUE EXACTE
 *   Le nœud « Respond Webhook » construit :
 *       { html: $('AI Agent').first().json.output, session_id: … }
 *   Le nœud « AI Agent » porte continueOnFail = true : quand il échoue, n8n
 *   émet un item SANS clé `output`. JSON.stringify supprime alors les valeurs
 *   undefined, et il ne reste que { session_id }.
 *
 *   Côté application, la lecture était :
 *       html = j.html || j.output || j.response || j.message || raw;
 *   Faute de contenu, le dernier repli `raw` déverse le JSON entier dans la
 *   bulle. L'utilisateur voit un identifiant de session au lieu d'une erreur,
 *   et rien n'indique que l'agent a échoué.
 *
 * CORRECTIF — un lecteur unique, utilisé aux trois endroits. S'il ne trouve
 * aucun contenu, il ne recopie JAMAIS le JSON : il dit ce qui s'est passé,
 * avec la cause quand le serveur l'a fournie.
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

/* ── 1. Le lecteur partagé ────────────────────────────────────────────────── */
sub(`                    const AI_MEMORY_PATH = '/finance/get_ai_memory.php';`,
[`                    const AI_MEMORY_PATH = '/finance/get_ai_memory.php';`,
 ``,
 `                    // ═══ v37.4 — LECTURE D'UNE RÉPONSE DU CFO ═══════════════════════`,
 `                    //   Renvoie toujours du HTML affichable. Quand le workflow n'a`,
 `                    //   produit aucun contenu, on explique au lieu de recopier le JSON`,
 `                    //   brut dans la bulle — un identifiant de session affiché comme`,
 `                    //   réponse ne renseigne personne et masque l'échec réel.`,
 `                    const _echapper = (t) => String(t == null ? '' : t)`,
 `                        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');`,
 ``,
 `                    const _lireReponseCFO = (raw) => {`,
 `                        const brut = String(raw == null ? '' : raw).trim();`,
 `                        let j = null;`,
 `                        try { j = JSON.parse(brut); } catch (_) { j = null; }`,
 ``,
 `                        // Réponse non-JSON : c'est presque toujours une page d'erreur du`,
 `                        // serveur web (401 de Caddy, 502, HTML d'erreur). On la montre`,
 `                        // telle quelle si elle ressemble à du texte, jamais muette.`,
 `                        if (j === null || typeof j !== 'object') {`,
 `                            if (!brut) return { html: _blocErreur('Réponse vide', "Le workflow n'a rien renvoyé."), vide: true };`,
 `                            return { html: brut, vide: false };`,
 `                        }`,
 ``,
 `                        const contenu = j.html || j.output || j.response || j.message || j.text || '';`,
 `                        if (contenu && String(contenu).trim()) return { html: String(contenu), vide: false };`,
 ``,
 `                        // Aucun contenu : on remonte la cause si le workflow l'a jointe.`,
 `                        const cause = (j.error && (j.error.message || j.error))`,
 `                                   || j.erreur || j.detail || null;`,
 `                        const cles = Object.keys(j).join(', ') || '(aucune)';`,
 `                        return {`,
 `                            html: _blocErreur(`,
 `                                "Le CFO n'a pas produit de réponse",`,
 `                                cause`,
 `                                    ? ('Cause remontée par le workflow : ' + _echapper(cause))`,
 `                                    : ("Le nœud « AI Agent » de n8n a échoué : il porte continueOnFail, "`,
 `                                      + "donc l'exécution continue sans le champ <code>output</code> et la "`,
 `                                      + "réponse arrive vide. Ouvrez l'exécution dans n8n pour voir l'erreur réelle."),`,
 `                                'Champs reçus : ' + _echapper(cles)`,
 `                            ),`,
 `                            vide: true,`,
 `                        };`,
 `                    };`,
 ``,
 `                    const _blocErreur = (titre, cause, detail) =>`,
 `                        '<div style="border-left:3px solid #f43f5e;background:#fff1f2;padding:10px 14px;border-radius:8px">'`,
 `                        + '<b style="color:#be123c">⚠️ ' + _echapper(titre) + '</b><br>'`,
 `                        + '<span style="font-size:12px;line-height:1.5">' + cause + '</span>'`,
 `                        + (detail ? '<br><span style="font-size:11px;opacity:.65">' + detail + '</span>' : '')`,
 `                        + '</div>';`,
].join('\n'));

/* ── 2. Les trois points de lecture ───────────────────────────────────────── */
sub(`                                const j = JSON.parse(raw);
                                html = j.html || j.output || j.response || j.message || raw;
                            } catch (_) { html = raw; }`,
`                                html = _lireReponseCFO(raw).html;   // v37.4 : jamais de JSON brut en bulle
                            } catch (_) { html = _lireReponseCFO(raw).html; }`);

sub(`                            try { const j = JSON.parse(raw); html = j.html || j.output || j.response || j.message || raw; } catch (_) { html = raw; }
                            merlinBubble.value.html = html;`,
`                            html = _lireReponseCFO(raw).html;   // v37.4
                            merlinBubble.value.html = html;`);

sub(`                            try { const j = JSON.parse(raw); html = j.html || j.output || j.response || j.message || raw; } catch (_) { html = raw; }
                            merlinBubble.value.html = merlinBubble.value.html + html;`,
`                            html = _lireReponseCFO(raw).html;   // v37.4
                            merlinBubble.value.html = merlinBubble.value.html + html;`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v37.4 — lecteur de réponse unique');
