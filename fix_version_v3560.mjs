import fs from 'node:fs';
const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n'); if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => { const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) : ${from.slice(0,120)}`); s = s.split(from).join(to); };

sub(`                    const CURRENT_VERSION = "35.5 Annee-Verrouillee";`,
    `                    const CURRENT_VERSION = "35.6 Resolveur-Disciplinaire";`);

const E = [
`        { version: "35.6 Resolveur-Disciplinaire", date: "2026-09-18", changes: [`,
`            "BUG 1 — versement_mensuel n'était lu par AUCUNE des deux fonctions du cycle de vie d'un Smart Goal (create_smart_goal, add_funds_to_goal). Le champ existe côté appli (migrateGoalV19 : Number(o.versement_mensuel) || 0) mais rien côté moteur ne l'écrivait : tout objectif créé par l'agent retombait à 0, avec l'alerte « Aucun versement mensuel défini ». Corrigé aux DEUX écritures possibles : à la création et lors d'une mise à jour ultérieure (SET, jamais cumulatif — un versement mensuel ne s'additionne pas à lui-même).",`,
`            "BUG 2, cause réelle trouvée par audit — les comptes bancaires (adjust_account_balance) ET les Smart Goals (add_funds_to_goal) ne passaient PAS par le résolveur Levenshtein qui protège déjà revenus/charges/épargne. Ils utilisaient un « premier libellé qui contient la sous-chaîne demandée », sans distance ni détection d'ambiguïté — et pour update_compte, la branche « id exact » comparait un entier à une chaîne via === : une comparaison qui ne peut JAMAIS être vraie, du code mort. « CTO », « Fonds d'urgence », « Dépenses annuelles » sont exactement les libellés de comptes concernés par ce point faible.",`,
`            "CORRECTIF — cfo_resolve_compte() et cfo_resolve_goal(), nouveaux, appliquent aux comptes et aux Smart Goals le même classement (distance + priorité aux correspondances contenant la cible) ET la même détection d'ambiguïté que le reste du catalogue, au lieu d'un raccourci sans garde-fou. La marge d'ambiguïté elle-même est élargie : un quasi-ex-æquo (distances 3 et 4, pas seulement une égalité stricte) est désormais bloqué et remonté comme ambigu au lieu d'être tranché en silence.",`,
`            "EFFET DE BORD ASSUMÉ — add_funds_to_goal documente « objectif EXISTANT » ; le moteur créait pourtant un objectif fantôme à 10 000 DH dès qu'aucun nom ne matchait (upsert silencieux). Un objectif introuvable renvoie désormais une erreur nommant les objectifs réellement disponibles, comme le fait déjà update_asset_valuation pour les actifs (v35.3) — plus de duplicata muet.",`,
`            "source_account (set_recurring_savings) était stocké tel quel, sans jamais être vérifié contre les comptes réels — un nom approximatif atterrissait tel quel dans sourceCompte, un champ que le frontend attend au format 'courant' / 'cpt_<id>'. Résolu désormais contre fd.comptes[], avec repli explicite sur 'courant' et avertissement si le nom ne correspond à rien.",`,
`            "TRANSPARENCE — chaque opération résolue (compte, objectif, revenu, charge, épargne) porte désormais resolutions[] dans la réponse : ce qui a été demandé face à ce qui a été réellement résolu, succès compris. Jusqu'ici seuls les échecs étaient documentés (*_disponibles, v35.3) : une résolution RÉUSSIE mais vers la mauvaise cible restait invisible tant que l'utilisateur n'avait pas rouvert l'appli.",`,
`            "HONNÊTETÉ — je n'ai pas pu reproduire mécaniquement l'inversion exacte 7000↔2000 rapportée (les libellés cités sont lexicalement trop distincts pour qu'une confusion Levenshitein/sous-chaîne les échange) : elle vient très probablement de la construction des appels côté modèle, pas du résolveur. Les correctifs ci-dessus ferment une classe de bugs réelle et vérifiée (comptes et objectifs sans aucune protection d'ambiguïté), pas une reproduction du symptôme exact."`,
`        ] },`].join('\n');

sub(`                    const CHANGELOG = [\n`, `                    const CHANGELOG = [\n${E}\n`);
if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ version 35.6 + changelog');
