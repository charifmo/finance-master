/* v37.65 Semaines — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.64 Pourquoi";`, `const CURRENT_VERSION = "37.65 Semaines";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.64 Pourquoi", date: "2026-10-27", changes: [`,
`                    const CHANGELOG = [
        { version: "37.65 Semaines", date: "2026-10-27", changes: [
            "✂️ LES SEMAINES COUPÉES PAR LA PAIE — « Ce n'est pas clair quoi rentrer et jusqu'à quand : l'appli me propose le réalisé sur une semaine même si elle est partagée entre 2 cycles, ce qui fausse les choses. » Depuis la v37.27, une semaine appartenait EN ENTIER au cycle de son jeudi : paie le mardi 27 oct., la semaine du 26 oct. au 1ᵉʳ nov. comptait en novembre lundi 26 compris (payé avec l'argent d'octobre), et celle du 23 au 29 nov. aussi, alors que la paie suivante tombe le 27. Désormais une semaine coupée par la paie se saisit en DEUX MORCEAUX, chacun dans son cycle : « Le 26 oct. ✂️ 1 j » (octobre), puis « Semaine du 27 oct. au 1 nov. ✂️ 6 j » (novembre). ‹ › passent d'un morceau à l'autre ; une note dit quoi taper et jusqu'à quand (au téléphone, une touche sur « ✂️ 6 j » la déplie : la Météo tient toujours dans un écran).",
            "UN CYCLE = SES JOURS — un poste « / sem » coûte valeur × jours du cycle ÷ 7 (31 jours = « 4 sem. 3 j », 30 jours = « 4 sem. 2 j ») ; une charge « / mois » se répartit sur les jours. Le prévu d'un morceau est au prorata de ses jours (6 jours = 6/7) ; une semaine entière garde pile son prévu (600) et les morceaux coupés se partagent l'arrondi par les plus forts restes : tenir son prévu à chaque morceau = tenir le budget du cycle, au dirham près (514 + 600 + 600 + 600 + 343 = 2 657). Sur l'année : 365 jours ÷ 7.",
            "PARTOUT — les tickets du cycle sont ceux de SES jours (un achat de la veille de la paie reste dans le cycle qui finit) ; le Relevé coupe ses lignes de charges variables à la veille de la paie (« semaine du 23 nov. au 26 nov. ») ; les semaines écoulées sans saisie comptent le prévu de leurs jours ; la section Charges variables, le Prévisionnel, les Rayons X (« cycle de 31 jours (4 sem. 3 j) ») et le recalcul de secours du serveur suivent la même règle.",
            "VOS SAISIES NE BOUGENT PAS DE CYCLE (schéma 20) — l'ancienne clé du lundi d'une semaine dont la paie tombe un mardi, un mercredi ou un jeudi désignait la partie d'APRÈS la paie : elle est re-rangée sous le jour de paie, une seule fois, au chargement (cases closes comprises). Paie un vendredi, un samedi ou un dimanche : rien ne bouge.",
            "PREUVE — nouvelle suite « Semaines coupées par la paie » : 29 contrôles (jour de paie mardi 27 oct., calculs faits à la main). Rejouée sur la v37.64 : 23 en échec. Sept défauts réintroduits exprès (semaine non coupée, saisies non re-rangées, prévu sans prorata, tickets de la veille comptés, arrondi sans plus forts restes, note jamais repliée, Relevé à parts égales) : tous attrapés. Treize suites qui encodaient la règle du jeudi (4 ou 5 semaines entières) recalculées à la main sur la nouvelle, sans en affaiblir aucune — deux seuls ajustements, justifiés : la Météo admet l'arrondi mensuel (≤ 6 DH sur 12 mois) entre la somme des mois et le surplus annuel, et le mouvement d'un mois au Relevé se lit sur la somme exacte de ses lignes (qui portent désormais des centimes), arrondie une fois.",
        ] },
        { version: "37.64 Pourquoi", date: "2026-10-27", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.65 Semaines');
