/**
 * v34.02 — Audit du journal : deux fautes corrigées
 * ---------------------------------------------------------------------------
 * FAUTE 1 — ADDITIVITÉ ROMPUE (10 500 DH sur les données réelles)
 *   Le dictionnaire de soldes créait un pseudo-compte « ep_<id> » par objectif
 *   d'épargne et l'initialisait à la MENSUALITÉ du virement, comme s'il
 *   s'agissait d'un solde de départ. Or :
 *     • une épargne liée à un compte physique (linkedAccountId) envoie ses
 *       crédits vers ce compte ; son pseudo-compte ne reçoit jamais rien et
 *       conserve un solde fantôme ;
 *     • une épargne non liée accumule ses versements à partir de zéro, la
 *       mensualité n'est pas un encours.
 *   Résultat : la vue Globale affichait 70 267 DH quand la somme des cinq
 *   comptes valait 59 767 DH.
 *   Correctif : pas de pseudo-compte pour une épargne liée, et départ à zéro
 *   pour les autres.
 *
 * FAUTE 2 — UNE ANNÉE SÉLECTIONNÉE N'AFFICHAIT QU'UN MOIS
 *   cyclesReleveActifs retombait sur [mois courant] dès qu'aucun mois n'était
 *   coché. Cliquer « 2027 » seul montrait donc août 2027 (10 003 DH) au lieu
 *   de l'année entière (13 951 DH) — d'où l'impression de valeurs qui sautent
 *   en activant/désactivant les filtres.
 *   Correctif : une année cochée sans mois déroule les douze mois ; le filtre
 *   du passé élague ce qui est déjà écoulé.
 */
import fs from 'node:fs';

const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => {
    const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) :\n${from.slice(0, 200)}`);
    s = s.split(from).join(to);
};

/* ── FAUTE 1 : seed des pseudo-comptes d'épargne ─────────────────────────── */
sub(
`                        { const _epR = (donneesAnnuelles.value[curA] || {}).epargne;
                          (Array.isArray(_epR) ? _epR : Object.values(_epR || {})).forEach(e => { const s = Number(e.valeur); soldes['ep_' + e.id] = Number.isFinite(s) ? s : 0; }); }`,
`                        // v34.02 : un objectif d'épargne n'a pas d'encours de départ.
                        //   • lié à un compte physique → aucun pseudo-compte, le compte réel
                        //     porte le solde et reçoit les crédits ;
                        //   • non lié → compte d'accumulation démarrant à zéro.
                        //   L'ancien code y injectait la MENSUALITÉ, ce qui gonflait la vue
                        //   Globale d'un solde fantôme jamais mouvementé.
                        { const _epR = (donneesAnnuelles.value[curA] || {}).epargne;
                          (Array.isArray(_epR) ? _epR : Object.values(_epR || {})).forEach(e => {
                              if (e && e.linkedAccountId) return;
                              soldes['ep_' + e.id] = 0;
                          }); }`);

/* ── FAUTE 2 : une année cochée sans mois = l'année entière ──────────────── */
sub(
`                        if (!moisSelectionnes.value.length && !anneesSelectionnees.value.length) return [];
                        const ms = moisSelectionnes.value.length > 0 ? moisSelectionnes.value.slice() : [curM];`,
`                        if (!moisSelectionnes.value.length && !anneesSelectionnees.value.length) return [];
                        // v34.02 : cocher une année sans préciser de mois déroule les DOUZE
                        //   mois. Auparavant on retombait sur le seul mois courant, si bien
                        //   que « 2027 » affichait août 2027 au lieu de l'année complète.
                        const ms = moisSelectionnes.value.length > 0
                            ? moisSelectionnes.value.slice()
                            : (anneesSelectionnees.value.length > 0 ? [1,2,3,4,5,6,7,8,9,10,11,12] : [curM]);`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v34.02 appliquée');
