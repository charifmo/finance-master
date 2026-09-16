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

sub(`                    const CURRENT_VERSION = "34.10 Elegance-Fintech";`,
    `                    const CURRENT_VERSION = "34.11 Poids-Brut";`);

const ENTREE = [
    `        { version: "34.11 Poids-Brut", date: "2026-09-16", changes: [`,
    `            "BUG CORRIGÉ — le « Total » ajouté au badge Poids en v34.10 affichait statsFluxAnnee.netAnnuel = chocsSorties − chocsEntrees : un impact NET sur l'année, pas la somme des chocs. Toute ligne de depensesIrregulieres à montant négatif (« Injection Banque » dans l'UI — remboursement, avance reçue) venait DÉDUIRE le total au lieu d'y être étrangère. Cas signalé : Top 3 seul = 46 500 DH, badge affichait 11 300 DH — une injection de 35 200 DH nettait la différence.",`,
    `            "CORRECTIF — nouveau champ statsFluxAnnee.totalChocsAnnuel : somme des valeurs ABSOLUES de toutes les lignes de depensesIrregulieres de l'année affichée, dépenses et injections confondues. Non filtré par le toggle « inclure long terme » — le panneau Flux Exceptionnels auquel ce total doit correspondre au dirham près ne filtre pas non plus. Badge : « ⚠️ 942 DH/m · Total Chocs 81 700 DH (95%) ».",`,
    `            "CE QUI N'A PAS CHANGÉ — montantImpact (942 DH/m) et le pourcentage restent calculés sur netAnnuel, volontairement : ce sont des mesures d'impact réel sur le surplus mensuel, pas des sommes de lignes, et rien dans la demande n'en réclamait la révision.",`,
    `            "VÉRIFIÉ — scénario reconstruit à partir du cas signalé (3 dépenses 30 000/10 000/6 500 + 1 injection −35 200) : reproduit exactement 11 300 DH en AVANT et 942 DH/m, confirmant le diagnostic ; le total brut recalculé (81 700 DH) est bien ≥ la somme du Top 3 seul et égal à Σ|montant| de toutes les lignes."`,
    `        ] },`,
].join('\n');

sub(`                    const CHANGELOG = [\n`, `                    const CHANGELOG = [\n${ENTREE}\n`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ version 34.11 + changelog');
