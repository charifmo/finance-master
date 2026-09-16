# -*- coding: utf-8 -*-
"""
REFACTO CFO — PHASE 1 : les trois noeuds a faible risque
===============================================================================
Cible : super_agent_cfo_audio.json  (workflow n8n "Super-Agent CFO v15.1")

CONSTAT DE DEPART (etabli en lisant le workflow, pas suppose)
-------------------------------------------------------------------------------
L'en-tete du noeud Memory Writer porte la trace du vrai probleme :

    "v1.3 a prouve : query={} (Gemini envoie 0 arg car n8n ne lit pas le schema)"

Les parsers multi-strategies ne sont donc PAS de la paranoia d'une epoque ou les
LLM parsaient mal. Ils compensent le fait qu'un noeud `toolCode` SANS schema
d'entree est enregistre cote LangChain comme un outil a UNE SEULE entree texte :
le modele n'a aucune signature de fonction a remplir. Supprimer les parsers sans
rien mettre a la place reproduirait exactement l'echec de la v1.3.

Le deverrouillage n'est pas cote modele, il est cote n8n : `specifyInputSchema`.
Une fois le schema declare, l'outil devient un DynamicStructuredTool et le
modele recoit une vraie signature.

PRUDENCE ASSUMEE : la documentation n8n n'etait pas joignable depuis
l'environnement de build (egress bloque). Je n'ai donc pas pu confirmer par la
source officielle si, schema active, `query` arrive en objet deja parse ou en
chaine JSON. Chaque outil garde par consequent UNE normalisation de trois
lignes, correcte dans les deux cas. On passe de ~90 lignes de parsing a 3 :
le degraissage est fait, sans parier sur un detail non verifie.

CE QUE FAIT CE SCRIPT
-------------------------------------------------------------------------------
  1. Tool: Memory Writer  — schema {texte, categorie} + suppression des regex.
  2. Tool: Committer      — suppression du parser ET du parametre `confirmation`
                            (voir la justification dans le bloc du noeud).
  3. AI Agent             — degraissage du system prompt, sans toucher a ce qui
                            tient lieu de schema tant que les outils n'en ont pas.

NON TRAITE ICI (par choix de sequencement, explique dans le rapport) :
  - Tool: Intent Compiler        -> phase 3
  - Tool: Transactions Reelles   -> meme patch mecanique que le Committer
  - Build Agent Input            -> phase 2
  - Sections 8/9/10 du prompt    -> liberees par la phase 3, pas avant
"""
import json, sys, io, os

PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'super_agent_cfo_audio.json')

with io.open(PATH, encoding='utf-8') as f:
    ORIGINAL = f.read()
wf = json.loads(ORIGINAL)

def node(name):
    for n in wf['nodes']:
        if n['name'] == name:
            return n
    raise SystemExit('Noeud introuvable : ' + name)

rapport = []
def mesure(label, avant, apres):
    rapport.append((label, len(avant), len(apres)))

# ═══════════════════════════════════════════════════════════════════════════
# 1. TOOL: MEMORY WRITER
#    Avant : aucun schema -> le modele n'envoie rien -> l'outil relit la question
#            de l'utilisateur et la decoupe a la regex (4 patterns), puis devine
#            la categorie a la regex (3 patterns de plus).
#    Apres : un schema declare les deux parametres. Le modele REFORMULE le texte
#            (ce qu'une regex ne saura jamais faire : "retiens que je prefere les
#            Airbnb" -> "Je prefere louer des Airbnb plutot que des hotels") et
#            choisit la categorie dans une enumeration.
# ═══════════════════════════════════════════════════════════════════════════
mw = node('Tool: Memory Writer')
_avant_mw = json.dumps(mw, ensure_ascii=False)

mw['parameters']['description'] = (
    "Memorise durablement une information personnelle — preference, regle de gestion, "
    "element de contexte — pour qu'elle soit retrouvee dans toutes les sessions futures "
    "via finance_rag.\n"
    "A n'appeler que sur demande explicite de l'utilisateur : « retiens que… », "
    "« memorise… », « souviens-toi que… », « garde en memoire… »."
)
mw['parameters']['specifyInputSchema'] = True
mw['parameters']['schemaType'] = 'manual'
mw['parameters']['inputSchema'] = json.dumps({
    "type": "object",
    "required": ["texte"],
    "properties": {
        "texte": {
            "type": "string",
            "description": (
                "L'information a memoriser, reformulee en une phrase autonome et complete, "
                "a la premiere personne, comprehensible hors de tout contexte. "
                "N'inclus PAS le verbe declencheur : « retiens que je prefere les Airbnb » "
                "se memorise « Je prefere louer des Airbnb plutot que des hotels »."
            )
        },
        "categorie": {
            "type": "string",
            "enum": ["preference", "regle", "contexte", "general"],
            "description": (
                "preference = gout ou habitude durable ; "
                "regle = contrainte ou plafond a respecter ; "
                "contexte = fait date sur la situation actuelle ; "
                "general = tout le reste."
            )
        }
    }
}, ensure_ascii=False, indent=2)

mw['parameters']['jsCode'] = r'''// ════════════════════════════════════════════════════════
// MEMORY WRITER v2 — schema d'entree declare cote n8n
// Le modele remplit {texte, categorie}. Plus de regex : il REFORMULE,
// ce qu'un pattern ne saura jamais faire.
// ════════════════════════════════════════════════════════
const VALID_CATS = ['preference', 'regle', 'contexte', 'general'];

// Normalisation : `query` arrive en objet (schema lu) ou en chaine JSON.
let input = {};
try {
  input = (typeof query === 'string') ? JSON.parse(query) : (query || {});
} catch (e) { input = {}; }

const texte = String(input.texte || '').trim();
let categorie = String(input.categorie || 'general').trim().toLowerCase();
if (!VALID_CATS.includes(categorie)) categorie = 'general';

if (texte.length < 5) {
  return JSON.stringify({
    error: 'TEXTE_MANQUANT',
    raison: 'Le parametre "texte" est vide ou trop court.',
    attendu: { texte: 'phrase autonome a memoriser', categorie: VALID_CATS.join('|') }
  });
}

let session_id = null;
try { session_id = $('Build Agent Input').first().json.session_id; } catch (e) {}
if (!session_id) { try { session_id = $('Normalize Input').first().json.session_id; } catch (e) {} }

const requestBody = { texte, categorie, session_id: session_id || 'unknown' };

try {
  const resp = await this.helpers.httpRequest({
    method: 'POST',
    url: 'https://n8n.beau.ink/webhook/finance-memory-ingest',
    body: requestBody,
    json: true,
    timeout: 20000
  });
  if (resp && resp.status === 'ok') {
    return JSON.stringify({ status: 'ok', memorise: true, texte, categorie });
  }
  return JSON.stringify({ error: 'INGESTION_REPONSE_KO', response_recue: resp, request_envoyee: requestBody });
} catch (e) {
  // Le diagnostic est conserve : il a une vraie valeur d'exploitation.
  const code = (e && (e.statusCode || e.code)) || null;
  let cause = null;
  if (code === 404) cause = 'Sous-workflow CFO Memory Ingest non ACTIVE';
  else if (code === 500) cause = 'Sous-workflow leve une exception';
  else if (/ECONNREFUSED|ENOTFOUND|timeout/i.test((e && e.message) || '')) cause = 'Reseau / DNS / timeout';
  return JSON.stringify({
    error: 'WEBHOOK_ECHEC',
    e_message: (e && e.message) || null,
    e_statusCode: code,
    request_envoyee: requestBody,
    cause_probable: cause
  });
}'''
mesure('Tool: Memory Writer', _avant_mw, json.dumps(mw, ensure_ascii=False))

# ═══════════════════════════════════════════════════════════════════════════
# 2. TOOL: COMMITTER
#    Le parser occupait ~90 lignes pour lire UN champ : confirmation.
#
#    Or ce champ ne protegeait rien. Relire le code d'origine :
#      GARDE 1 verifie que le MODELE a envoye confirmation === "OUI".
#      GARDE 2 relit le DERNIER MESSAGE DE L'UTILISATEUR dans Normalize Input
#              et exige qu'il contienne OUI / OK / VALIDE / GO.
#    GARDE 2 est strictement plus forte : le modele ne peut pas la falsifier,
#    elle lit la source. GARDE 1, elle, demande au modele de se controler
#    lui-meme — un garde-fou qui ne garde rien.
#
#    D'ou la simplification la plus rentable du lot : l'outil ne prend AUCUN
#    parametre. Plus de parametre, plus de parsing, et aucune securite perdue —
#    les deux verrous reels restent en place : le message utilisateur reel, et
#    l'existence d'une simulation en cache cote serveur.
# ═══════════════════════════════════════════════════════════════════════════
cm = node('Tool: Committer')
_avant_cm = json.dumps(cm, ensure_ascii=False)

cm['parameters']['description'] = (
    "Applique definitivement sur le VPS la simulation budgetaire presentee au tour precedent.\n"
    "N'appeler QUE si l'utilisateur vient de repondre « OUI » / « ok » / « valide » / « go ».\n"
    "Cet outil ne prend AUCUN parametre : il recupere seul la simulation en attente, "
    "et il refuse de s'executer si le dernier message de l'utilisateur ne vaut pas confirmation.\n"
    "Si aucune simulation n'est en attente, il renvoie une erreur explicite : demande alors "
    "a l'utilisateur de reformuler sa modification pour relancer une simulation."
)
cm['parameters']['jsCode'] = r'''// ════════════════════════════════════════════════════════
// COMMITTER v5 — sans parametre
// Les deux seuls verrous qui protegent reellement l'ecriture sont lus a la
// source, pas declares par le modele :
//   VERROU 1 : le dernier message utilisateur vaut confirmation.
//   VERROU 2 : une simulation est effectivement en attente cote serveur.
// Le parametre `confirmation` de la v4 demandait au modele de se controler
// lui-meme ; il est supprime avec son parser.
// ════════════════════════════════════════════════════════
const PENDING_URL = 'https://n8n.beau.ink/finance/pending_commit.php';
const SAVE_URL    = 'https://n8n.beau.ink/finance/save_data.php';

let session_id = null;
try { session_id = $('Build Agent Input').first().json.session_id; } catch (e) {}
if (!session_id) { try { session_id = $('Normalize Input').first().json.session_id; } catch (e) {} }
if (!session_id) return JSON.stringify({ error: 'session_id introuvable dans le contexte' });

// ── VERROU 1 : la confirmation vient de l'utilisateur, pas du modele ──
let lastUserMsg = '';
try { lastUserMsg = String($('Normalize Input').first().json.question || '').toUpperCase(); } catch (e) {}
if (!/\bOUI\b|\bOK\b|\bVALIDE\b|\bGO\b/.test(lastUserMsg)) {
  return JSON.stringify({ error: 'REFUS : le dernier message utilisateur ne contient pas OUI/OK/VALIDE. Demande confirmation explicite.' });
}

// ── VERROU 2 : une simulation attend bien d'etre appliquee ──
let pending;
try {
  pending = await this.helpers.httpRequest({
    method: 'GET',
    url: PENDING_URL + '?session_id=' + encodeURIComponent(session_id),
    json: true,
    timeout: 10000
  });
} catch (e) {
  return JSON.stringify({
    error: 'Aucune simulation en attente. Demande a l\'utilisateur de reformuler sa modification (ex : "baisse le loyer a 4500"), je referai la simulation puis tu pourras valider par OUI.',
    detail: e.message,
    session_id
  });
}
if (!pending || !pending.finance_data || !pending.finance_data.donneesAnnuelles) {
  return JSON.stringify({
    error: 'Pending recupere mais finance_data invalide. Demande a l\'utilisateur de relancer la simulation.',
    session_id,
    pending_keys: pending ? Object.keys(pending) : null
  });
}

const operations = pending.operations || [];

// ── Commit ──
let saveResp;
try {
  saveResp = await this.helpers.httpRequest({
    method: 'POST',
    url: SAVE_URL,
    body: pending.finance_data,
    json: true,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000
  });
} catch (e) {
  return JSON.stringify({ error: 'Echec ecriture save_data.php', detail: e.message, session_id, pending_preserved: true });
}

// ── Cleanup best effort : le pending expire seul apres 30 min ──
let pendingDeleted = false;
try {
  const delResp = await this.helpers.httpRequest({
    method: 'DELETE',
    url: PENDING_URL + '?session_id=' + encodeURIComponent(session_id),
    json: true,
    timeout: 5000
  });
  pendingDeleted = !!(delResp && delResp.status === 'ok');
} catch (e) {}

return JSON.stringify({
  status: 'ok',
  committed: true,
  session_id,
  annee: pending.annee,
  operations_count: operations.length,
  operations,
  pending_deleted: pendingDeleted,
  server_response: saveResp
});'''
mesure('Tool: Committer', _avant_cm, json.dumps(cm, ensure_ascii=False))

# ═══════════════════════════════════════════════════════════════════════════
# 3. AI AGENT — degraissage du system prompt
#
#    CE QUI SORT
#      - §4 : les formules Airbnb (0,825 / 65 % / 85 %). Elles appartiennent au
#             metier, donc au RAG. La REGLE DE ROUTAGE reste : sur tout sujet
#             studio/locatif, finance_rag d'abord.
#             /!\ A ne deployer qu'une fois la directive effectivement presente
#                 dans finance_vectors — sinon la regle disparait des deux cotes.
#      - La consigne « ecris une reponse apres un tool call », presente TROIS
#        fois dont une en capitales : gardee une fois.
#      - §7.5 : l'exemple JSON complet de set_recurring_savings. Il appartient au
#        schema de l'outil, pas au prompt. La regle de comportement qui compte
#        (ne calcule pas, delegue) est conservee, resserree.
#      - Le bloc HISTORIQUE : de la plomberie que le modele n'a pas a connaitre.
#      - Le bloc MEMORY WRITER : son contenu est desormais dans le schema du
#        noeud (ci-dessus). Seul le declencheur reste, dans le routage.
#      - Le doublon entre « SYSTEME D'INSPECTION » (§1) et le routage (§3) :
#        fusionne sur une seule ligne.
#
#    CE QUI RESTE, ET POURQUOI
#      Les sections 8, 9 et 10 decrivent les formats d'appel de propose_changes
#      ({action, category, target, amount}). Tant que Intent Compiler n'a pas de
#      schema d'entree, ces blocs SONT le schema. Les retirer maintenant, avant
#      la phase 3, casserait les mutations. Ils partiront avec la phase 3 — c'est
#      la que se trouve le gros du gain restant (~4 000 caracteres).
# ═══════════════════════════════════════════════════════════════════════════
ag = node('AI Agent')
_avant_pr = ag['parameters']['options']['systemMessage']

NOUVEAU_PROMPT = """Tu es le CFO personnel IA de Mohamed, responsable du pilotage budgétaire et stratégique du foyer (Maroc, devise DH).

═══ 1. LA HIÉRARCHIE DE LA VÉRITÉ (RÈGLE ABSOLUE) ═══
En cas de conflit d'information, respecte cet ordre :
  • NIVEAU 1 (La Loi)            : les instructions explicites de l'utilisateur dans le message actuel.
  • NIVEAU 2 (Le Contexte Métier): les règles issues de la base vectorielle (outil finance_rag).
  • NIVEAU 3 (La Donnée Brute)   : le fichier JSON (CONTEXTE FINANCIER).
  • NIVEAU 4 (Dernier Recours)   : ton savoir général d'IA. À utiliser pour conseiller, JAMAIS pour contredire les niveaux 1, 2 et 3.

═══ 2. POLITIQUE ANTI-DÉRIVE SÉMANTIQUE ═══
Ne déduis JAMAIS la fréquence d'un flux financier à partir de son nom (ex: "Bonification", "Prime", "Allocation"). Si le JSON a la même structure qu'un salaire (champ base, periode='mois' ou absente), c'est mensuel. Si ce n'est pas écrit explicitement "annuel", c'est mensuel. Aucune interprétation libre du label.

═══ 3. ROUTAGE DES OUTILS ═══
  • finance_rag     → Inspection CIBLÉE, dans trois cas seulement :
                        1. toute question sur le studio / loyer / revenu locatif (OBLIGATOIRE, cf. §4) ;
                        2. référence explicite à une règle mémorisée ("selon ma règle", "ma directive sur X") ;
                        3. ambiguïté métier non résolue par le CONTEXTE FINANCIER.
                      NE PAS appeler pour lire le JSON (soldes, surplus, calcul depuis la matrice)
                      ni avant propose_changes. 1 itération économisée = 1 tâche de plus.
  • propose_changes → UNIQUE outil de simulation budgétaire. Toute modification passe par lui.
  • committer       → Validation finale uniquement, SANS AUCUN ARGUMENT, si l'utilisateur vient
                      de répondre "OUI" / "ok" / "valide" / "go" à une simulation présentée.
  • memory_writer   → Sur déclencheur explicite : "retiens que…", "mémorise…", "souviens-toi que…".
  • web_search      → Fallback pour données externes uniquement (cf. §7).

Pour tout le reste (analyse, diagnostic, projection, calcul) : lis directement le CONTEXTE FINANCIER JSON. Aucun outil.

RÈGLE ABSOLUE DE COMMUNICATION : après CHAQUE appel d'outil, tu DOIS rédiger une réponse textuelle détaillée en HTML brut — ce que tu as trouvé, modifié, ou pourquoi l'outil a échoué et quelle alternative tu proposes. JAMAIS de réponse vide, JAMAIS un simple tool call sans explication.

═══ 4. PROJET STUDIO & REVENU LOCATIF ═══
AVANT de commenter le studio / loyer / revenu locatif : appelle finance_rag avec "stratégie studio exploitation" ET "directive revenu locatif".
Applique la directive telle qu'elle est retournée par finance_rag — formule, taux d'occupation, hypothèses de saisonnalité. Ne substitue JAMAIS tes propres hypothèses à celles de la directive, et n'invente pas de taux si la directive n'en donne pas : dis alors que la directive est incomplète.
Présente systématiquement les scénarios prévus par la directive, mentionne "calcul basé sur la directive mémorisée", et compare avec le scénario bail classique.

═══ 5. WORKFLOW DE MODIFICATION (OBLIGATOIRE) ═══
Tour 1 — Simulation :
  1. Appelle propose_changes.
  2. Si clarifications_needed, error_ops ou redistribution_required non vide → gère l'erreur / pose la question. NE propose PAS OUI.
  3. Si pending_saved=true → présente le delta en HTML et termine EXACTEMENT par :
     « <b>Confirmez-vous ? Tapez <span style="color:#059669">OUI</span> pour exécuter.</b> »
  4. Si auto_cloned_years non vide → mentionne que les années ont été auto-créées (ex: « Années 2027-2029 créées automatiquement à partir de 2026 »).
  5. INTERDICTION ABSOLUE : demander OUI sans avoir reçu pending_saved=true au tour courant.

Tour 2 — Commit :
  1. Si message utilisateur = "OUI" / "ok" / "valide" / "go" → appelle committer, sans argument.
  2. L'outil récupère seul la simulation en cache et vérifie lui-même le message utilisateur.
  3. Si status=ok et committed=true → confirme en HTML avec la liste des opérations.
  4. Si erreur "simulation en attente" → cache expirée (>30 min). Demande de reformuler la modification.

═══ 6. FORMAT & QUALITÉ ═══
FORMAT HTML BRUT OBLIGATOIRE. Markdown strictement INTERDIT (pas de **gras**, *italique*, ###titres, - listes, ```code```, [lien](url)).
AUTORISÉ : <b>, <br>, <ul><li>…</li></ul>, <span style="color:#059669"> (vert), <span style="color:#dc2626"> (rouge), <hr>.
Montants : espaces insécables (ex: « 12 500 DH »), jamais de virgule milliers.
QUALITÉ : 3 paragraphes minimum par diagnostic, 3+ recommandations chiffrées par tour. Priorise les chiffres sur les opinions. Cite la source. N'invente jamais un chiffre. Ne tronque jamais.

═══ 7. RECHERCHE WEB ═══
web_search est un FALLBACK : uniquement quand les niveaux 1-3 de la Hiérarchie de la Vérité ne suffisent pas. Si tu l'utilises, déclare-le : « <b>Source : Recherche Internet.</b> » avant de citer le résultat.

═══ 7.5. ÉPARGNE RÉCURRENTE EN % DU SURPLUS — DÉLÉGATION TOTALE AU BACKEND ═══
Quand l'épargne est définie comme un POURCENTAGE du surplus / reliquat / net mensuel : tu ne lis PAS la matrice pour en déduire des montants, tu ne calcules AUCUN montant mensuel, tu ne fabriques AUCUNE liste d'exceptions. Appelle propose_changes avec la fonction set_recurring_savings en ne fournissant que le nom, le pourcentage et le compte source ; le backend calcule mois par mois et te renvoie le détail. Tu présentes UNIQUEMENT les montants renvoyés par l'outil.
SIGNAL D'ERREUR ABSOLU : une suite de virements qui CROÎT en cumul (5 792 → 11 129 → 16 466…) est mathématiquement FAUSSE. Chaque mois est strictement indépendant, jamais de report. Si tu vois une suite croissante, c'est que tu as calculé au lieu de déléguer — recommence en déléguant.
Montant FIXE mensuel : même fonction, avec "fixed_amount". Distinction : epargne = virement mensuel récurrent ; objectif = Smart Goal (cagnotte cumulative) du tab Wealth.

═══ 8. GESTION DES COMPTES BANCAIRES (BILAN) ═══
Tu peux créer et modifier les comptes bancaires de l utilisateur via propose_changes avec category="compte".
• Créer un compte : action="add", category="compte", label="Nom du compte", amount=solde_initial.
• Modifier le solde d un compte : action="modify", category="compte", target="Nom ou label du compte", amount=valeur_à_ajouter (négatif pour retrait).
• TRANSFERT ENTRE COMPTES : génère DEUX changements distincts dans le même appel propose_changes :
  1. { action:"modify", category:"compte", target:"Compte Source", amount:-X } — débit du compte source.
  2. { action:"modify", category:"compte", target:"Compte Cible", amount:+X } — crédit du compte cible.
  Ne génère JAMAIS un seul changement pour un transfert. Les deux opérations sont atomiques et présentées ensemble dans la simulation.

═══ 9. GESTION DU PATRIMOINE (WEALTH GOALS & ASSETS) ═══
• OBJECTIF (category="objectif") — opération INCRÉMENTALE (ajoute des fonds à la cagnotte) :
  { action:"modify", category:"objectif", target:"Nom du projet", amount:+X }
  Le moteur exécute : goal.current += amount (pas de remplacement).
• ACTIF (category="actif") — opération de RÉÉVALUATION (remplace la valeur totale) :
  { action:"modify", category:"actif", target:"Nom de l actif", amount:NOUVELLE_VALEUR_TOTALE }
  Le moteur exécute : asset.value = amount (remplacement complet, pas d ajout).
DISTINCTION CRITIQUE : "ajoute X" / "j ai épargné X de plus" → OBJECTIF (incrémental). "vaut maintenant X" / "réévalué à X" / "estimation actuelle X" → ACTIF (remplacement). En cas de doute, demande une clarification.

═══ 10. STRESS TEST FONCIER & MARKET INTELLIGENCE ═══
L utilisateur possède une matrice de risques immobiliers (foncierPortfolio) avec 3 scénarios par actif : conservateur, pessimiste, optimiste.
Format : { action:"modify", category:"foncier", target:"<nom de l actif>", sub_target:"<conservateur|pessimiste|optimiste>", amount:<NOUVELLE VALORISATION TOTALE en MAD> }
RÈGLE OBLIGATOIRE : si la réévaluation s appuie sur l actualité, le marché ou un critère externe (SDAU, LGV, nouvelle zone urbanisable, prix du marché), tu DOIS appeler web_search AVEC une requête précise AVANT toute autre action, puis citer « <b>Source : Recherche Internet.</b> ».
INTERDICTION : jamais de réévaluation contextuelle fondée sur l intuition, un savoir interne périmé ou une extrapolation linéaire. Si web_search ne ramène rien d exploitable, dis-le et propose des fourchettes raisonnées plutôt qu un chiffre fictif.

═══ 11. MODE SAISIE VOCALE (NLP) ═══
L'utilisateur dicte souvent ses dépenses. Le texte transcrit est brut, parfois familier ou sans ponctuation (ex: "j'ai lâché 150 balles au mcdo et 400 de tqdya").
1. Identifie CHAQUE dépense distincte. Convertis "balles", "dirhams", "dhs" en nombres.
2. Associe la meilleure catégorie du référentiel existant ("tqdya" → Alimentation, "mcdo" → Restauration).
3. Déclenche transactions_reelles_engine (action "add", operations[] pour un batch). Commit DIRECT, pas de OUI requis.
4. Ne pose JAMAIS de question si tu as deviné le montant et la catégorie. Agis d'abord.
5. Réponse ULTRA COURTE — elle sera lue à voix haute. Ex : "C'est noté, j'ai ajouté 150 DH en Restauration et 400 DH en Alimentation."
"""

ag['parameters']['options']['systemMessage'] = NOUVEAU_PROMPT
mesure('AI Agent — systemMessage', _avant_pr, NOUVEAU_PROMPT)

# ═══════════════════════════════════════════════════════════════════════════
# ECRITURE + RAPPORT
# ═══════════════════════════════════════════════════════════════════════════
out = json.dumps(wf, ensure_ascii=False, indent=2)
with io.open(PATH, 'w', encoding='utf-8') as f:
    f.write(out)

print('=' * 78)
print('REFACTO CFO — PHASE 1'.center(78))
print('=' * 78)
print('%-34s %10s %10s %10s' % ('CIBLE', 'AVANT', 'APRES', 'GAIN'))
print('-' * 78)
tot_a = tot_b = 0
for label, a, b in rapport:
    tot_a += a; tot_b += b
    print('%-34s %10d %10d %9.0f%%' % (label, a, b, (1 - b / float(a)) * 100))
print('-' * 78)
print('%-34s %10d %10d %9.0f%%' % ('TOTAL', tot_a, tot_b, (1 - tot_b / float(tot_a)) * 100))
print()
print('Fichier : %d -> %d octets' % (len(ORIGINAL), len(out)))
print('Noeuds  : %d (inchange)' % len(wf['nodes']))
