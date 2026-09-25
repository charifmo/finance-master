import fs from 'node:fs';
const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n'); if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => { const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) : ${from.slice(0,110)}`); s = s.split(from).join(to); };

sub(`                    const CURRENT_VERSION = "37.7 Retour-Ecriture";`,
    `                    const CURRENT_VERSION = "37.8 Une-Seule-Verite";`);

const E = [
`        { version: "37.8 Une-Seule-Verite", date: "2026-09-25", changes: [`,
`            "BUG SIGNALÉ — fin 2027, quatre chiffres pour une seule réalité : bandeau 157 020 DH, Relevé de Comptes 241 020, tableau pluriannuel 257 074, et une matrice IA encore différente (Compte Courant fin 2026 annoncé à −16 226 DH alors que le Relevé donnait +5 816). Sur cette base fausse, le CFO avait recommandé puis exécuté un transfert de 18 000 DH pour combler un déficit qui n'existait pas.",`,
`            "CAUSE 1 — COMPTE FANTÔME : un virement d'épargne pointait vers « acc_1778171037229_a1ye » (id texte, sans préfixe cpt_). Le normaliseur ne préfixait que les id numériques : le Relevé ouvrait un second registre (84 000 DH fin 2027) que le bandeau filtrait en silence. Un normaliseur unique (_cleCompte) remplace les quatre copies de l'app ; le moteur PHP reçoit la même correction.",`,
`            "CAUSE 2 — L'IA LISAIT L'ANCIEN MOTEUR : la matrice envoyée au CFO venait encore de bilanLignes[].detailsComptes, le moteur abandonné en v34 par tout le reste de l'app. Sa branche « compte courant » testait un type 'courant' qui n'existe pas (le compte est 'liquide') et annonçait « surplus isolé » sur des soldes cumulés. La matrice lit désormais le moteur du Relevé, mois par mois, du mois en cours à décembre de l'année suivante, avec la variation de chaque mois et le total final — identique au dirham à l'Atterrissage Projeté.",`,
`            "CAUSE 3 — OBJECTIFS PRIS POUR DE L'ARGENT : « Fonds d'urgence 17 749 DH » était un chiffre saisi à la main, sans compte lié, que l'IA additionnait aux soldes. Le payload distingue maintenant « solde des comptes liés » de « montant DÉCLARÉ, pas un solde bancaire ». Chaque objectif peut être adossé à un compte (nouveau sélecteur « Compte lié ») : son montant suit alors le solde réel, et le moteur refuse de le « créditer » à la main en indiquant le bon geste (un transfert).",`,
`            "CAUSE 4 — TABLEAU PLURIANNUEL : il partait des soldes d'aujourd'hui, ajoutait un an de surplus du budget de l'année en cours (mois écoulés compris) et les loyers une seconde fois (case « loyers déjà dans mes revenus » décochée par défaut). Les années budgétées sont désormais ancrées sur l'Atterrissage du Relevé ; la case se coche seule quand le budget porte des lignes de loyer ; la colonne s'appelle « Liquidités fin d'année ».",`,
`            "VERROUS — test_une_seule_verite.mjs charge l'app dans un navigateur avec un compte à id texte et exige bandeau = Relevé = total IA = projection ; il échoue sur 21 contrôles avec la v37.7. test_objectif_lie.php couvre le moteur PHP."`,
`        ] },`].join('\n');

sub(`                    const CHANGELOG = [\n`, `                    const CHANGELOG = [\n${E}\n`);
if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ version 37.8 + changelog');
