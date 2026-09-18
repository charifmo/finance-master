import fs from 'node:fs';
const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n'); if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => { const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) : ${from.slice(0,110)}`); s = s.split(from).join(to); };

sub(`                    const CURRENT_VERSION = "35.6 Resolveur-Disciplinaire";`,
    `                    const CURRENT_VERSION = "36.0 Contrat-Moteur";`);

const E = [
`        { version: "36.0 Contrat-Moteur", date: "2026-09-18", changes: [`,
`            "REFONTE — fin des correctifs au compte-gouttes sur les arguments. Chaque fonction du catalogue lisait ses paramètres à la main, avec son propre vocabulaire et zéro tolérance : un nom non prévu était jeté en silence et l'opération partait avec un champ vide. C'était la cause structurelle du « il faut dicter à l'agent les paramètres exacts » — versement_mensuel (v35.6) n'en était qu'un symptôme parmi d'autres, un par fonction. Un CONTRAT DÉCLARATIF unique (cfo_arg_spec) décrit désormais les 19 fonctions : paramètres, alias, types, bornes, requis.",`,
`            "NORMALISEUR — alias → clé canonique (goal_name, libelle, nom, titre → name), coercition tolérante des montants (« 5 445 DH », « 1.092.000,50 », « 2027 » → [2027]), contrôle du requis, et inventaire de ce qui a été IGNORÉ. Le rapport remonte dans la réponse (arguments_normalises) : un paramètre redressé ou rejeté devient une information, plus un comportement invisible.",`,
`            "DONNÉES INVENTÉES SUPPRIMÉES — une cible d'objectif à 0 ou négative était silencieusement remplacée par 10 000 DH sortis de nulle part ; un mois à 99 était stocké tel quel ; une épargne sans montant ni pourcentage créait une ligne à 0 DH. Trouvés par revue adversariale du propre diff de cette refonte. Bornes déclaratives (min/max) et contrainte « au moins un parmi » : le moteur refuse et nomme le problème au lieu de deviner.",`,
`            "ÉTANCHÉITÉ DES EXERCICES — trois trous fermés. (1) Le résolveur balayait TOUTES les années : un libellé homonyme en 2026 bloquait une écriture explicitement datée 2027, avec un message absurde (« Précise : Long Terme ou Long Terme ? »). Il est désormais borné aux exercices de l'opération, avec repli qui DIT où la ligne se trouve. (2) Quatre fonctions (actifs, comptes, soldes) produisaient un change sans exercice déclaré, et le repli de la phase 1 tapait encore date('Y') en direct — court-circuitant toute la résolution d'année de la v35.5. (3) Un SCELLÉ prend l'empreinte de chaque exercice non ciblé avant application et la revérifie après : si l'un bouge, le lot entier est refusé et rien n'est persisté. Prouvé actif par injection d'une violation.",`,
`            "RÉSOLUTION — les actifs (masterAssets) étaient la dernière poche à dépendre d'un « premier nom qui contient la sous-chaîne », sans distance ni ambiguïté : deux biens voisins pouvaient se substituer l'un à l'autre, sur des montants à six chiffres. Comptes, objectifs et actifs passent maintenant tous par le même classement Levenshtein + détection d'ambiguïté.",`,
`            "MONTANTS INTERVERTIS — deux appels individuellement valides et cohérents ne permettent PAS au moteur de deviner une inversion d'intention ; je ne prétends pas l'avoir résolu. Ce qui est corrigé, c'est que la phrase de confirmation lue avant le OUI ne vient plus de la mémoire du modèle : operations_appliquees est le relevé du serveur (exercice, cible réellement touchée, avant, après), et le prompt de l'agent impose de construire le récapitulatif à partir de lui. Une interversion se voit donc AVANT la validation.",`,
`            "ANTI-DÉRIVE — le schéma des outils n8n est désormais GÉNÉRÉ depuis le contrat PHP (tools_schema.php --inject). Les deux décrivaient la même chose à deux endroits maintenus à la main, et avaient dérivé : le schéma ne documentait pas versement_mensuel, que le modèle n'a donc jamais envoyé. « --check » échoue si le workflow s'écarte du contrat.",`,
`            "VÉRIFICATION — 4 suites, une commande (./run_tests.sh) : parité JS/PHP 27/27 état muté inclus, matrice 19 fonctions × 4 axes + 8 valeurs aberrantes (92 contrôles), discipline de résolution sur les 4 poches, cohérence des deux schémas d'objectif. La couverture de la matrice est dérivée du catalogue : ajouter une fonction sans test fait échouer la suite."`,
`        ] },`].join('\n');

sub(`                    const CHANGELOG = [\n`, `                    const CHANGELOG = [\n${E}\n`);
if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ version 36.0 + changelog');
