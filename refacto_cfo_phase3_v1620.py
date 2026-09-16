# -*- coding: utf-8 -*-
"""
REFACTO CFO — PHASE 3 : Intent Compiler devient un routeur HTTP
===============================================================================
  1. SUPPRESSION du noeud « Tool: Budget Engine » — 44 Ko, zero connexion.
  2. « Tool: Intent Compiler » : 67 529 caracteres de metier -> un POST.
     Schema d'entree declare cote n8n, le modele recoit enfin une signature.
  3. Prompt : les sections 8/9/10 decrivaient le format LEGACY `changes`
     alors que l'outil expose un catalogue `calls` depuis la v30.00. Elles
     enseignaient donc une interface que le backend n'attend plus. Reecrites
     en termes de catalogue, elles fondent de ~3 800 a ~1 400 caracteres.

CE QUI PART SUR LE VPS (cfo_intent_engine.php)
  parser, catalogue, Levenshtein, resolveEntity, buildOps, applyOp,
  sanitize, snapshot, delta, auto-clone des annees.

CE QUI RESTE DANS n8n
  lire session_id dans le contexte, transmettre les calls, relayer la reponse.

EQUIVALENCE PROUVEE
  27 cas de bout en bout, moteur JS d'origine contre moteur PHP, memes entrees :
  resultat ET etat mute strictement identiques. Voir test_cfo_engine_parity/.
"""
import json, io, os

PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'super_agent_cfo_audio.json')
with io.open(PATH, encoding='utf-8') as f:
    ORIGINAL = f.read()
wf = json.loads(ORIGINAL)

def node(name):
    for n in wf['nodes']:
        if n['name'] == name: return n
    raise SystemExit('Noeud introuvable : ' + name)

rapport = []

# ═══════════════════════════════════════════════════════════════════════════
# 1. PURGE — Tool: Budget Engine
#    Aucune connexion entrante ni sortante : il n'est pas enregistre comme
#    outil aupres de l'agent, il ne coute donc rien au runtime. Mais il pese
#    23 % du fichier et fait croire a un second moteur de simulation alors
#    que le seul en service est Intent Compiler (expose sous propose_changes).
# ═══════════════════════════════════════════════════════════════════════════
be = node('Tool: Budget Engine')
poids_be = len(json.dumps(be, ensure_ascii=False))
assert 'Tool: Budget Engine' not in wf['connections'], 'Budget Engine a des connexions sortantes : ne pas supprimer'
for src, types in wf['connections'].items():
    for t, branches in types.items():
        for br in branches:
            for c in (br or []):
                assert c['node'] != 'Tool: Budget Engine', 'Budget Engine est la cible d une connexion'
wf['nodes'] = [n for n in wf['nodes'] if n['name'] != 'Tool: Budget Engine']
rapport.append(('SUPPRIME  Tool: Budget Engine', poids_be, 0))

# ═══════════════════════════════════════════════════════════════════════════
# 2. Tool: Intent Compiler — schema + routeur HTTP
# ═══════════════════════════════════════════════════════════════════════════
ic = node('Tool: Intent Compiler')
avant_ic = len(json.dumps(ic, ensure_ascii=False))

ic['parameters']['description'] = (
    "Simulateur budgetaire. Tu APPELLES des fonctions nommees du catalogue ; tu n'envoies jamais de "
    "champs libres et tu n'effectues AUCUN calcul (surplus, reliquat, totaux, repartition mensuelle) : "
    "le backend s'en charge et te renvoie les montants.\n"
    "\n"
    "Toute modification du budget, du patrimoine ou des comptes passe par cet outil. Il SIMULE "
    "seulement : la simulation est mise en attente et n'est appliquee qu'apres un OUI de l'utilisateur, "
    "via l'outil committer.\n"
    "\n"
    "LECTURE DE LA REPONSE :\n"
    "  pending_saved=true          -> presente le delta puis demande OUI.\n"
    "  clarifications_needed       -> pose la question, ne demande PAS OUI.\n"
    "  error_ops / redistribution_required -> explique le blocage, ne demande PAS OUI.\n"
    "  auto_cloned_years           -> signale les annees creees automatiquement.\n"
    "  ERROR_OUT_OF_CATALOG        -> la fonction n'existe pas : previens l'utilisateur qu'elle "
    "doit etre developpee, n'essaie pas de contourner."
)

CATALOGUE = {
    "create_smart_goal":        "Cree un objectif d'epargne (Smart Goal). args: name, target_amount, initial_funding?",
    "add_funds_to_goal":        "Ajoute des fonds a un objectif existant — INCREMENTAL. args: name, amount",
    "set_recurring_savings":    "Virement d'epargne mensuel recurrent. args: name, puis percentage_of_reliquat (%) OU fixed_amount, source_account?, years?. Avec percentage_of_reliquat le backend calcule lui-meme le net mois par mois : ne fournis AUCUN montant.",
    "update_recurring_savings": "Modifie une epargne recurrente. args: name, amount, new_name?",
    "remove_recurring_savings": "Supprime une epargne recurrente. args: name",
    "update_asset_valuation":   "Reevalue un actif — REMPLACE la valeur. args: asset_name, new_value, scenario? (conservateur|pessimiste|optimiste, foncier uniquement)",
    "add_fixed_expense":        "Nouvelle charge fixe mensuelle. args: name, amount",
    "update_fixed_expense":     "Modifie une charge fixe. args: name, amount",
    "remove_fixed_expense":     "Supprime une charge fixe. args: name",
    "add_variable_expense":     "Nouvelle charge variable. args: name, amount, period? (mois|semaine)",
    "update_variable_expense":  "Modifie une charge variable, ou une de ses sous-lignes via sub_target. args: name, amount, sub_target?",
    "add_income":               "Nouveau revenu mensuel. args: name, amount",
    "update_income":            "Modifie un revenu. args: name, amount",
    "add_one_off_expense":      "Depense exceptionnelle datee. args: name, amount, month (1-12)",
    "create_account":           "Cree un compte bancaire. args: label, balance",
    "adjust_account_balance":   "Credite (+) ou debite (-) un compte. args: account, amount",
    "set_initial_balance":      "Fixe un solde initial. args: account, amount",
    "clone_year":               "Duplique une annee budgetaire. args: from_year, to_year",
}

ic['parameters']['specifyInputSchema'] = True
ic['parameters']['schemaType'] = 'manual'
ic['parameters']['inputSchema'] = json.dumps({
    "type": "object",
    "required": ["calls"],
    "properties": {
        "calls": {
            "type": "array",
            "minItems": 1,
            "description": "Les operations a simuler, dans l'ordre. Un transfert entre deux comptes = DEUX appels adjust_account_balance dans ce meme tableau.",
            "items": {
                "type": "object",
                "required": ["function", "args"],
                "properties": {
                    "function": {
                        "type": "string",
                        "enum": sorted(CATALOGUE.keys()),
                        "description": " | ".join(k + " : " + v for k, v in sorted(CATALOGUE.items())),
                    },
                    "args": {
                        "type": "object",
                        "description": "Les arguments de la fonction appelee. Ajoute years (tableau d'annees, ex [2026]) pour cibler d'autres exercices que l'annee courante.",
                        "properties": {
                            "name":   {"type": "string",  "description": "Libelle de la ligne visee. Un libelle approximatif suffit : le backend fait la correspondance."},
                            "amount": {"type": "number",  "description": "Montant en DH. Negatif pour un debit sur adjust_account_balance."},
                            "years":  {"type": "array",   "items": {"type": "integer"}, "description": "Exercices cibles. Absent = annee courante."},
                        },
                        "additionalProperties": True,
                    },
                },
            },
        },
    },
}, ensure_ascii=False, indent=2)

ic['parameters']['jsCode'] = r'''// ════════════════════════════════════════════════════════
// INTENT COMPILER v2 — routeur HTTP
// Tout le metier (catalogue, Levenshtein, applyOp, snapshots, deltas) vit
// desormais sur le VPS, dans cfo_intent_engine.php appele par
// pending_commit.php. Ce noeud ne fait plus que trois choses :
//   1. recuperer les calls produits par le modele (schema declare ci-dessus)
//   2. y joindre le session_id et le SSOT du net mensuel
//   3. relayer la reponse du serveur telle quelle
// ════════════════════════════════════════════════════════
const ENDPOINT = 'https://n8n.beau.ink/finance/pending_commit.php';

// Normalisation : `query` arrive en objet (schema lu) ou en chaine JSON.
let input = {};
try { input = (typeof query === 'string') ? JSON.parse(query) : (query || {}); } catch (e) { input = {}; }

const calls = Array.isArray(input.calls) ? input.calls : (Array.isArray(input) ? input : null);
if (!calls || !calls.length) {
  return JSON.stringify({
    error: 'Parametre "calls" manquant ou vide.',
    format_attendu: { calls: [{ function: '<nom du catalogue>', args: {} }] }
  });
}

let normalized;
try { normalized = $('Build Agent Input').first().json; }
catch (e) {
  try { normalized = $('Normalize Input').first().json; }
  catch (e2) { return JSON.stringify({ error: 'Contexte introuvable (Build Agent Input / Normalize Input)' }); }
}
const session_id = normalized.session_id;
if (!session_id) return JSON.stringify({ error: 'session_id introuvable dans le contexte' });

// SSOT du net mensuel isole du Compte Courant, exporte par l'application web.
// Le backend sait le recalculer, mais quand l'appli l'a deja fourni c'est LUI
// qui fait foi : il reflete ce que l'utilisateur voit a l'ecran.
const ssot = (normalized.finance_data && normalized.finance_data.surplus_mensuel_net_courant) || null;

let resp;
try {
  resp = await this.helpers.httpRequest({
    method: 'POST',
    url: ENDPOINT,
    body: { session_id, calls, surplus_mensuel_net_courant: ssot },
    json: true,
    timeout: 25000
  });
} catch (e) {
  const body = (e && e.response && e.response.body) || null;
  // Hors catalogue : on conserve l'arret franc de la v1 plutot qu'un retour
  // silencieux — le modele ne doit pas enchainer comme si de rien n'etait.
  if (body && body.error === 'ERROR_OUT_OF_CATALOG') {
    throw new Error('ERROR_OUT_OF_CATALOG: ' + (body.message || "L'action demandee n'existe pas dans le catalogue."));
  }
  return JSON.stringify({
    error: 'BACKEND_INJOIGNABLE',
    detail: (e && e.message) || null,
    statusCode: (e && (e.statusCode || e.code)) || null,
    endpoint: ENDPOINT,
    cause_probable: 'pending_commit.php absent, cfo_intent_engine.php non deploye, ou VPS injoignable.'
  });
}

if (resp && resp.error === 'ERROR_OUT_OF_CATALOG') {
  throw new Error('ERROR_OUT_OF_CATALOG: ' + (resp.message || "L'action demandee n'existe pas dans le catalogue."));
}
return JSON.stringify(resp);'''

rapport.append(('Tool: Intent Compiler', avant_ic, len(json.dumps(ic, ensure_ascii=False))))

# ═══════════════════════════════════════════════════════════════════════════
# 3. PROMPT — sections 8/9/10 reecrites en termes de catalogue
#    Elles decrivaient { action, category, target, amount }, le format LEGACY.
#    Le backend expose un catalogue de fonctions depuis la v30.00 : le prompt
#    enseignait donc une interface que plus personne n'attend. Ne restent que
#    les trois regles de SENS que le schema ne peut pas porter.
# ═══════════════════════════════════════════════════════════════════════════
ag = node('AI Agent')
prompt = ag['parameters']['options']['systemMessage']
avant_p = len(prompt)

i0 = prompt.index('═══ 8. GESTION DES COMPTES BANCAIRES (BILAN) ═══')
i1 = prompt.index('═══ 11. MODE SAISIE VOCALE (NLP) ═══')
remplace = prompt[i0:i1]

NOUVEAU = """═══ 8. COMPTES, PATRIMOINE ET FONCIER ═══
Ces opérations passent toutes par propose_changes, avec les fonctions du catalogue décrites dans l'outil. Trois règles de sens que le schéma ne peut pas porter :

• TRANSFERT ENTRE COMPTES = DEUX appels adjust_account_balance dans le MÊME propose_changes — montant négatif sur la source, positif sur la cible. Jamais un seul appel : les deux opérations sont atomiques et se présentent ensemble dans la simulation.

• INCRÉMENTAL vs REMPLACEMENT — la distinction est critique :
  « j'ai mis 5 000 DH de plus sur le voyage » → add_funds_to_goal (s'ajoute à la cagnotte).
  « le local vaut maintenant 1,3 M » / « réévalué à X » → update_asset_valuation (remplace la valeur).
  En cas de doute, demande une clarification plutôt que de choisir.

• FONCIER — update_asset_valuation avec scenario = conservateur | pessimiste | optimiste.

RÈGLE MARKET INTELLIGENCE — OBLIGATOIRE : si la réévaluation s'appuie sur l'actualité, le marché ou un critère externe (SDAU, LGV, nouvelle zone urbanisable, prix du marché actuel), tu DOIS appeler web_search avec une requête précise AVANT toute autre action, puis citer « <b>Source : Recherche Internet.</b> ». Jamais de réévaluation contextuelle fondée sur l'intuition, un savoir interne périmé ou une extrapolation linéaire. Si web_search ne ramène rien d'exploitable, dis-le et propose des fourchettes raisonnées plutôt qu'un chiffre fictif.

"""
prompt = prompt[:i0] + NOUVEAU + prompt[i1:]
ag['parameters']['options']['systemMessage'] = prompt
rapport.append(('AI Agent — systemMessage', avant_p, len(prompt)))

# ═══════════════════════════════════════════════════════════════════════════
out = json.dumps(wf, ensure_ascii=False, indent=2)
with io.open(PATH, 'w', encoding='utf-8') as f:
    f.write(out)

print('=' * 74)
print('REFACTO CFO — PHASE 3'.center(74))
print('=' * 74)
print('%-34s %10s %10s %9s' % ('CIBLE', 'AVANT', 'APRES', 'GAIN'))
print('-' * 74)
ta = tb = 0
for label, a, b in rapport:
    ta += a; tb += b
    print('%-34s %10d %10d %8.0f%%' % (label, a, b, (1 - b / float(a)) * 100))
print('-' * 74)
print('%-34s %10d %10d %8.0f%%' % ('TOTAL', ta, tb, (1 - tb / float(ta)) * 100))
print()
print('Fichier : %d -> %d octets  (-%.0f%%)' % (len(ORIGINAL), len(out), (1 - len(out)/float(len(ORIGINAL)))*100))
print('Noeuds  : %d' % len(wf['nodes']))
