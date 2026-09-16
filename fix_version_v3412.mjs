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

sub(`                    const CURRENT_VERSION = "34.11 Poids-Brut";`,
    `                    const CURRENT_VERSION = "34.12 CFO-Cockpit";`);

const ENTREE = [
    `        { version: "34.12 CFO-Cockpit", date: "2026-09-16", changes: [`,
    `            "La modale CFO & Audit était un widget flottant (position:fixed, bas-gauche, min(620px,90vw) × min(600px,85vh)) sans fond assombri — pas une vraie modale. Format par défaut désormais cockpit d'analyse : 90vw/1200px × 85vh/900px, centrée, avec fond noir semi-transparent + flou (bg-black/60 backdrop-blur-sm) qui estompe le dashboard pendant l'échange et se ferme au clic.",`,
    `            "L'icône ⛶ dans l'en-tête bascule désormais vers un plein écran STRICT (100vw/100vh, sans marge ni arrondi) au lieu de l'ancien quasi-plein-écran à 0,5rem de marge.",`,
    `            "Chaque ouverture repart du format cockpit : un watch() sur showCfoModal remet cfoMaximized à false à l'ouverture, pour ne jamais hériter d'un plein écran laissé actif par la session précédente.",`,
    `            "ÉCHAP ferme désormais la modale CFO — elle ne fermait qu'au bouton ✕ jusqu'ici. Ajouté au même écouteur global que Merlin.",`,
    `            "Bulles de réponse élargies côté CFO (max-w-[92%], pour les tableaux/ratios/listes chiffrées) tout en gardant les messages utilisateur mesurés (max-w-[80%]).",`,
    `            "Centrage par top/left/right/bottom:0 + margin:auto plutôt que transform:translate(-50%,-50%) : startDragCfoWidget ancre le glisser-déposer sur getBoundingClientRect() puis fixe top/left en pixels sans toucher à transform — un centrage par transform serait resté actif par-dessus et aurait décalé le widget de la moitié de sa taille au premier glisser. Le code de drag n'a pas eu à être modifié."`,
    `        ] },`,
].join('\n');

sub(`                    const CHANGELOG = [\n`, `                    const CHANGELOG = [\n${ENTREE}\n`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ version 34.12 + changelog');
