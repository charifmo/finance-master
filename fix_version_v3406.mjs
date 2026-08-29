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

sub(`                    const CURRENT_VERSION = "34.05 Mode-Voyage";`,
    `                    const CURRENT_VERSION = "34.06 Voyage-Calendrier";`);

const ENTREE = [
    `        { version: "34.06 Voyage-Calendrier", date: "2026-08-29", changes: [`,
    `            "SAISIE PAR DATES : le compteur « jours d'absence » cède la place à « ✈️ Voyage · Du … au … ». Deux champs date, un bouton d'effacement, plus rien à calculer de tête.",`,
    `            "BORNAGE PAR PÉRIODE : un voyage à cheval sur deux périodes n'allège chaque écran que des jours qui tombent chez lui — ni perte, ni double compte. Le découpage se fait sur le CYCLE DE PAIE affiché, pas sur le mois civil : le budget que l'écran allège est celui du cycle 27 → 26. Découper sur le mois civil aurait attribué les 2 jours du 30-31 août au budget « août », dont le cycle (27 juil → 26 août) était clos depuis quatre jours — ces deux jours d'économie se seraient évaporés. La ventilation par mois civil reste affichée en clair : « 10 j sur ce cycle (27 Aoû → 26 Sep) · 2 j en août · 8 j en septembre ».",`,
    `            "PONDÉRATION SEMAINE / WEEK-END : un budget Sorties ne se consomme pas au même rythme un mardi et un samedi. 70 % en est réputé tomber le week-end, 30 % en semaine ; l'économie dépend donc du TYPE de jours manqués. Sur le 30 août → 8 septembre (3 week-ends sur les 9 du cycle), Sorties recule de 877 DH au lieu des 860 DH d'un prorata plat. Alimentation, voiture et transport restent linéaires.",`,
    `            "RYTHME ATTENDU CORRIGÉ : les jours d'absence déjà écoulés comptaient comme des jours de consommation, et la jauge annonçait un retard que le voyageur n'avait jamais eu à rattraper. Ils sont désormais retirés des DEUX termes du rapport. Absent depuis le premier jour du cycle : rythme attendu 0 DH sur les postes suspendus, et 153 DH sur la Santé maintenue — chacun sur sa propre horloge.",`,
    `            "TOTAL ENGAGÉ : la référence globale devient la somme des références par ligne. La jauge et le détail qui la compose ne peuvent plus diverger d'un dirham.",`,
    `            "GARDE-FOUS : dates vides, incohérentes, inversées ou hors du cycle affiché ⇒ retour au budget plein, sans NaN ni Infinity. Toutes les divisions sont bornées.",`,
    `            "VÉRIFIÉ SUR DONNÉES RÉELLES — cas 30 août → 8 septembre, cycle 27 aoû → 26 sep (31 j, 9 week-ends) : Alimentation 6 837 ➔ 4 632, Voiture 2 967 ➔ 2 010, Sorties 2 666 ➔ 1 789 (pondéré), Santé 2 365 ➔ 1 602. Budget du cycle 14 835 ➔ 10 033 DH. Économie annoncée +4 492 DH ; atterrissage du Compte Courant −18 735 ➔ −14 243 DH, soit +4 492 DH. Le chiffre annoncé est le chiffre obtenu, au dirham près."`,
    `        ] },`,
].join('\n');

sub(`                    const CHANGELOG = [\n`, `                    const CHANGELOG = [\n${ENTREE}\n`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ version 34.06 + changelog');
