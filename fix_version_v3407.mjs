import fs from 'node:fs';
const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => {
    const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) : ${from.slice(0, 120)}`);
    s = s.split(from).join(to);
};

sub(`                    const CURRENT_VERSION = "34.06 Voyage-Calendrier";`,
    `                    const CURRENT_VERSION = "34.07 Bulle-Exercice";`);

const ENTREE = [
    `        { version: "34.07 Bulle-Exercice", date: "2026-09-16", changes: [`,
    `            "RUPTURE DE COHÉRENCE TEMPORELLE CORRIGÉE — la bulle « Dépenses Annuelles » chaînait les cycles du cycle courant jusqu'à Décembre de l'exercice affiché, puis montrait TOUT le chaînage. En vue 2027 elle affichait le solde T0 de septembre 2026 en tête, les obligations de fin 2026 dans la liste (11 Sept, 20 Oct, 20 Nov, 20 Déc…) et des totaux à cheval sur deux exercices.",`,
    `            "LE CHAÎNAGE N'ÉTAIT PAS LE FAUTIF — c'est lui qui donne le solde d'ouverture de 2027, c'est-à-dire l'atterrissage au 31 décembre 2026. Ce qui manquait, c'est la FENÊTRE : ce qui précède l'exercice affiché est déjà contenu dans ce solde d'ouverture, le réafficher ligne à ligne le comptait deux fois à l'œil. Le moteur calcule, la fenêtre montre — deux temps désormais distincts.",`,
    `            "SOLDE D'OUVERTURE CONTEXTUALISÉ : sur l'exercice courant, le solde instantané T0 sous le libellé « ⏰ Solde actuel » (45 300 DH, inchangé). Sur un exercice futur, le solde APRÈS la dernière ligne de l'exercice précédent sous le libellé « 🔮 Solde initial 2027 » — soit 26 800 DH, strictement l'atterrissage de fin 2026 affiché par le bandeau.",`,
    `            "LIGNES BORNÉES : la liste ne retient que les obligations dont l'année vaut l'exercice affiché. En vue 2027 elle démarre au 20 janv '27 « Voyage France Nouha Abdeljalil » ; plus aucune ligne de 2026 n'y figure.",`,
    `            "TOTAUX BORNÉS : Σ Reste à payer et Alimentations prévues ne somment que les lignes de l'exercice affiché, et les trois en-têtes sont millésimés. Sur 2027 : 79 000 DH d'alimentations et 71 300 DH d'obligations, contre 90 500 / 101 300 auparavant — la différence étant exactement les 11 500 / 30 000 DH de 2026, désormais absorbés par le solde d'ouverture.",`,
    `            "INVARIANT GARANTI PAR CONSTRUCTION : le journal est chronologique et contigu, donc aucune ligne ne s'intercale entre la dernière de l'exercice précédent et la première de l'exercice affiché. Atterrissage = Ouverture + Alimentations − Obligations est donc exact, et l'atterrissage reste celui du moteur (soldeAtterrissage), inchangé — la bulle et le KPI du bandeau ne peuvent pas diverger.",`,
    `            "VÉRIFIÉ — 2026 : 45 300 + 11 500 − 30 000 = 26 800 DH. 2027 : 26 800 + 79 000 − 71 300 = 34 500 DH, soit exactement le « DÉP. ANN. 34 500 DH fin 2027 » du bandeau, sans résidu de 2026. Zéro ligne hors exercice dans les deux vues. Exercice passé sélectionné (2025) : retour à l'exercice courant, ouverture T0, aucune projection arrière."`,
    `        ] },`,
].join('\n');

sub(`                    const CHANGELOG = [\n`, `                    const CHANGELOG = [\n${ENTREE}\n`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ version 34.07 + changelog');
