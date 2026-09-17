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

sub(`                    const CURRENT_VERSION = "34.13 Chocs-Sans-Injection";`,
    `                    const CURRENT_VERSION = "35.4 Studio-Contractuel";`);

const ENTREE = [
    `        { version: "35.4 Studio-Contractuel", date: "2026-09-17", changes: [`,
    `            "ONGLET PROJET STUDIO — le formulaire affichait encore les paramètres prévisionnels (767 000 DH empruntés, 5 416 DH/mois) alors que le contrat Bank Assafa est signé. Les 4 montants validés sont désormais reproduits au dirham près : prix 1 092 000 DH (42 m2 x 26 000), capital 765 560 DH, traite globale 5 445 DH/mois, apport personnel net 346 680 DH.",`,
    `            "MÉCANIQUE — le capital et la traite ne sont pas des champs libres, ils sont DÉDUITS (capital = restePromoteur + taxes incluses + reliquat ; traite = annuité + assurance). Les cibles ont donc été atteintes par les entrées : surface 40 -> 42, taxes incluses dans le crédit 45 000 -> 43 560, assurance 480 -> 300, taux 4,7 -> 5,218 %.",`,
    `            "TAUX IMPLICITE — en Mourabaha la banque fixe la traite, pas un taux d'intérêt. Les 4,7 % affichés jusqu'ici produisaient 5 226 DH/mois, soit 219 DH de moins que le contrat réel : le prévisionnel sous-estimait la charge de 52 478 DH sur 20 ans. Le champ porte désormais le taux implicite du contrat (5,218 %), seul capable de reproduire les 5 445 DH.",`,
    `            "AVANCE PAYÉE INCHANGÉE À 500 000 DH — les 346 680 DH validés sont un EFFORT NET, pas le versement au promoteur : 500 000 versés − 130 000 de reliquat crédit = 370 000 décaissés, − 23 320 de chèque de restitution = 346 680. Les saisir dans le champ « Avance payée » aurait porté le capital à 920 320 DH. Le montant apparaît donc en ligne dérivée « Apport Personnel Net », avec le détail du calcul sous les yeux, et un nouveau champ restitutionPromoteur (23 320 DH). Le bloc affiche aussi le Prix Total Bien, qui manquait.",`,
    `            "MIGRATION — modifier les valeurs par défaut ne suffisait pas : projetStudio est stocké par année et executerImportFusion fait safeMerge(defauts, sauvegarde), où la valeur enregistrée gagne toujours. migrateStudioContratV354() réaligne les exercices existants, une seule fois (drapeau _studioContratV354 persisté dans soldesInitiaux) pour que les champs restent librement éditables ensuite."`,
    `        ] },`,
].join('\n');

sub(`                    const CHANGELOG = [\n`, `                    const CHANGELOG = [\n${ENTREE}\n`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ version 35.4 + changelog');
