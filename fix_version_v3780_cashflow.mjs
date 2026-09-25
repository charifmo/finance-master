import fs from 'node:fs';
const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n'); if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => { const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) : ${from.slice(0,110)}`); s = s.split(from).join(to); };

sub(`                    const CURRENT_VERSION = "37.7 Retour-Ecriture";`,
    `                    const CURRENT_VERSION = "37.8 Simulateur-CashFlow";`);

const E = [
`        { version: "37.8 Simulateur-CashFlow", date: "2026-09-25", changes: [`,
`            "LE BUG, NOMMÉ PRÉCISÉMENT — le moteur de projection faisait chaque année « liquidité += surplus budgétaire » PUIS « liquidité += cash-flow net de l'actif ». Or le surplus budgétaire retranche déjà les mensualités de crédit (elles vivent dans chargesFixes sous les clés « credit* » — le code le disait lui-même en commentaire), et le cash-flow net vaut REX − SERVICE DE DETTE − impôt. Le service de la dette sortait donc DEUX FOIS de la trésorerie, chaque année, de façon cumulative. Le garde-fou « dejaCompte » ne protégeait que la troisième soustraction, jamais celle-là. C'est cela qui faisait plonger les liquidités dans le rouge sans qu'aucune dépense réelle n'existe.",`,
`            "LA RÈGLE, DÉSORMAIS UNIQUE — Liquidité(N) = Liquidité(N−1) + surplus budgétaire + exploitation nette des actifs + chocs positifs − chocs négatifs. L'amortissement du capital NE TOUCHE PLUS la trésorerie : c'est une écriture de bilan, la mensualité en est déjà sortie une seule fois, par un canal choisi explicitement (le budget, ou le cash-flow de l'actif, jamais les deux). Un achat ne déduit que l'apport et les frais — jamais le prix du bien, jamais la dette.",`,
`            "MOTEUR EXTRAIT ET TESTABLE — projeterPatrimoine() est une fonction PURE : ni ref Vue, ni fermeture sur l'état de l'application ; même les trois fonctions financières (économie d'un actif, amortissement, mensualité) entrent par paramètre. L'adaptateur Vue ne fait plus que rassembler les entrées. C'est ce qui permet de la rejouer hors navigateur — 40 contrôles dans test_projection.mjs. Sabotage vérifié : rétablir le double comptage en fait tomber 4, faire sortir l'amortissement de la caisse en fait tomber 10.",`,
`            "CONTRÔLE DE COHÉRENCE EMBARQUÉ — chaque ligne recompose sa propre variation de trésorerie à partir des flux qu'elle déclare. Tout écart signifie qu'un flux est passé sans être nommé (exactement ce qui se produisait avant) : la ligne le dit, dans le bandeau « Points de vigilance ». Y figurent aussi les plans de financement qui ne bouclent pas, les ventes dont le net ne couvre pas le capital restant dû, et les remboursements plafonnés.",`,
`            "ÉVÉNEMENTS POLYMORPHES — le champ « montant » unique est remplacé par trois formulaires. ACHAT IMMOBILIER LOCATIF : nom, prix d'achat, apport, frais d'acquisition, montant du crédit, taux, durée, loyer mensuel net — avec mensualité et cash-flow calculés en direct sous le formulaire, et l'écart de financement signalé avant l'ajout (apport + crédit = prix ; les frais sortent du cash en plus). CAPEX / CHOC DE TRÉSORERIE : n'impacte que les liquidités de l'année, ni actif ni dette, en sortie ou en entrée. VENTE : prix net vendeur, capital restant dû soldé, actif retiré du patrimoine.",`,
`            "LE LOYER D'UNE ACQUISITION ALIMENTE LES ANNÉES SUIVANTES — un bien acheté en année N porte, dès N+1, son loyer net moins sa mensualité, avec un crédit dont l'âge se compte depuis SON année d'achat et non depuis le début de la projection. Le loyer saisi étant net, les abattements de charges du moteur sont neutralisés sur ces actifs pour ne pas le rogner deux fois.",`,
`            "TABLEAU DÉSENCOMBRÉ — six colonnes par défaut : Année, Liquidités, Dette Totale, Valeur Actifs, Patrimoine Net, Événements. Les quatre colonnes techniques (+ Surplus, + Actifs, − Capital, ▲ Revalo) et les chocs passent derrière un bouton « [+] Afficher le détail des flux ». La ligne de départ est marquée comme telle : ce n'est pas une fin d'année projetée, c'est aujourd'hui.",`,
`            "GRAPHIQUE — liquidités en barres (rouges quand elles passent sous zéro) et patrimoine net en courbe, sur deux axes : le patrimoine se compte en millions, la trésorerie en milliers, et sur une échelle commune les barres disparaîtraient.",`,
`            "AU PASSAGE — les brouillons de simulation créés avant cette refonte sont relus, pas jetés : un ancien « achat » devient un achat payé comptant, avec son montant en apport."`,
`        ] },`].join('\n');

sub(`                    const CHANGELOG = [\n`, `                    const CHANGELOG = [\n${E}\n`);
if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ version 37.8 + changelog');
