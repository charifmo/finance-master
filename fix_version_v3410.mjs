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

sub(`                    const CURRENT_VERSION = "34.08 Sidebar-Footer";`,
    `                    const CURRENT_VERSION = "34.10 Elegance-Fintech";`);

const ENTREE = [
    `        { version: "34.10 Elegance-Fintech", date: "2026-09-16", changes: [`,
    `            "TYPOGRAPHIE — formatMAD() joint désormais le montant et « DH » par une espace INSÉCABLE au lieu d'une espace normale. Intl.NumberFormat('fr-FR') séparait déjà les milliers par une espace insécable ; seul le dernier espace avant « DH » pouvait casser la ligne (« 135 969 ⏎ DH »). Un seul point de correction, effectif sur les 411 sites d'appel — templates ET chaînes de texte pur (prompts CFO, exports) — sans risque puisque c'est une simple substitution de caractère, jamais du HTML.",`,
    `            "ANNÉE UNIFIÉE — anneeCibleProjection (ref indépendante, persistée en localStorage, horizon par défaut 2029) est supprimée. Elle alimentait un second sélecteur d'année sur la carte « Patrimoine Global » — topbar, grille KPI desktop et grille KPI mobile — perçu comme redondant avec le sélecteur global d'édition. Les trois cartes lisent désormais anneeAffichage, avec un simple rappel « (Fin {{année}}) ». Conséquence à connaître : la projection à un horizon différent de l'année en cours d'édition (ex. voir 2029 en éditant 2026) n'existe plus — elle était de toute façon décorrélée par construction, les deux sélecteurs ne coïncidant que si l'utilisateur les alignait à la main.",`,
    `            "POIDS — le badge affiche désormais l'impact mensuel ET le total annuel des chocs exceptionnels : « ⚠️ 942 DH/m · Total 39 500 DH (95%) ». Aucun nouveau calcul : statsFluxAnnee.netAnnuel (déjà calculé) était simplement absent de l'affichage.",`,
    `            "SOBRIÉTÉ — le bandeau de badges du topbar (Surplus, Mensualités, Dép. Annuelles, Entrées, Sorties, Poids) mélangeait 6 fonds pastel différents (emerald-50/slate-50/amber-50/green-50/red-50/orange-50). Unifié en chips sombres semi-transparentes (bg-slate-900/90, bordure white/10) à texte pastel maîtrisé — la logique positif/négatif/alerte reste intacte, seule la palette change. Sur la grille KPI (Reste à vivre, Patrimoine Global, Patrimoine Net), les teintes -600 saturées deviennent -700, plus sourdes, même famille de couleur.",`,
    `            "PÉRIMÈTRE ASSUMÉ — une refonte sombre complète de l'onglet Paramètres et de toutes les cartes de l'app n'a pas été tentée : cet environnement de build n'a pas accès au CDN (Vue/Tailwind bloqués), donc aucun rendu visuel possible pour vérifier une réteinte à grande échelle. Le topbar et la grille KPI du tableau de bord — le cœur du dashboard principal — sont couverts ; le reste attend un passage avec rendu sous les yeux."`,
    `        ] },`,
].join('\n');

sub(`                    const CHANGELOG = [\n`, `                    const CHANGELOG = [\n${ENTREE}\n`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ version 34.10 + changelog');
