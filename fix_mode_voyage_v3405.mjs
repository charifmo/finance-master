/**
 * v34.05 — Mode Voyage : suspension des charges variables pendant une absence
 * ---------------------------------------------------------------------------
 * Le moteur supposait une présence sur tout le cycle. Dix jours d'absence, et
 * l'alimentation ou le carburant restent budgétés alors qu'ils ne seront pas
 * consommés localement.
 *
 * Point d'injection choisi : budgetVariableProrataBase, la racine de la chaîne
 *   budgetVariableProrataBase → budgetConsoCycle → enveloppeConsoRestante
 *   → enveloppeVariableProrata → _mkLegs (cycle courant) → journal, relevé,
 *     bulle et KPI.
 * Réduire le budget à la racine propage l'économie partout d'un seul coup,
 * sans toucher au journal ni dupliquer la règle.
 *
 * Le prorata se fait sur le CYCLE DE PAIE (joursCycleTotal), pas sur le mois
 * civil : c'est l'unité de temps de tout le reste du moteur.
 */
import fs from 'node:fs';

const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => {
    const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) :\n${from.slice(0, 160)}`);
    s = s.split(from).join(to);
};

/* ══════════════════════════════════════════════════════════════════════════
   1. MOTEUR — facteur de présence et budget révisé
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                    const budgetVariableProrataBase = computed(() => {
                        calculationTick.value;
                        const mb = moisBudgetaire.value;
                        const d = donneesAnnuelles.value[mb.an];
                        if (!d) return 0;
                        return Object.values(d.chargesVariables || {})
                            .filter(c => c && c.categorieId !== 'cat_cv_factures')
                            .reduce((s, c) => s + getMonthlyVariableValue(c || {}), 0);
                    });`,
String.raw`                    // ── v34.05 : MODE VOYAGE ───────────────────────────────────────────
                    //   Une absence suspend les postes consommés sur place. Le budget de ces
                    //   postes est proratisé sur les jours de présence du CYCLE DE PAIE —
                    //   l'unité de temps du reste du moteur, pas le mois civil.
                    const CAT_SUSPENDABLES = /aliment|nourrit|course|voiture|carburant|essence|transport|sortie|resto|loisir/i;
                    //   Choix explicite de l'utilisateur s'il existe, sinon détection par
                    //   libellé : alimentation et voiture suspendues par défaut.
                    const estSuspendableAbsence = (cv) => {
                        if (!cv) return false;
                        if (cv.suspendreAbsence !== undefined && cv.suspendreAbsence !== null) return !!cv.suspendreAbsence;
                        return CAT_SUSPENDABLES.test(String(cv.label || '') + ' ' + String(cv.categorieId || ''));
                    };
                    const joursAbsence = computed(() => {
                        const t = Math.max(1, Number(joursCycleTotal.value) || 30);
                        return Math.max(0, Math.min(t, Math.round(Number((soldesInitiaux.value || {}).joursAbsence) || 0)));
                    });
                    const modeVoyageActif = computed(() => joursAbsence.value > 0);
                    const facteurPresence = computed(() => {
                        const t = Math.max(1, Number(joursCycleTotal.value) || 30);
                        return Math.max(0, (t - joursAbsence.value) / t);
                    });
                    // Budget d'une catégorie après application éventuelle de l'absence
                    const budgetCategorieRevise = (cv) => {
                        const brut = getMonthlyVariableValue(cv || {});
                        return estSuspendableAbsence(cv) ? brut * facteurPresence.value : brut;
                    };
                    const setJoursAbsence = (v) => {
                        soldesInitiaux.value.joursAbsence = Math.max(0, Math.round(Number(v) || 0));
                        handleDataChange();
                    };
                    const toggleSuspendreAbsence = (cle) => {
                        const d = donneesAnnuelles.value[moisBudgetaire.value.an];
                        const cv = d && d.chargesVariables ? d.chargesVariables[cle] : null;
                        if (!cv) return;
                        cv.suspendreAbsence = !estSuspendableAbsence(cv);
                        handleDataChange();
                    };

                    const budgetVariableProrataBase = computed(() => {
                        calculationTick.value;
                        const mb = moisBudgetaire.value;
                        const d = donneesAnnuelles.value[mb.an];
                        if (!d) return 0;
                        return Object.values(d.chargesVariables || {})
                            .filter(c => c && c.categorieId !== 'cat_cv_factures')
                            .reduce((s, c) => s + budgetCategorieRevise(c || {}), 0);
                    });
                    // Budget théorique SANS absence, pour afficher le delta
                    const budgetVariableSansAbsence = computed(() => {
                        calculationTick.value;
                        const d = donneesAnnuelles.value[moisBudgetaire.value.an];
                        if (!d) return 0;
                        return Object.values(d.chargesVariables || {})
                            .filter(c => c && c.categorieId !== 'cat_cv_factures')
                            .reduce((s, c) => s + getMonthlyVariableValue(c || {}), 0);
                    });
                    // Économie dégagée par l'absence : elle remonte telle quelle dans
                    // l'atterrissage du Compte Courant via enveloppeVariableProrata.
                    const economieVoyage = computed(() =>
                        Math.round(budgetVariableSansAbsence.value - budgetVariableProrataBase.value));`);

/* ── Détail par catégorie : budget révisé + delta ─────────────────────────── */
sub(
`                                const budget = Math.round(getMonthlyVariableValue(cv));
                                const engage = Math.max(0, Number(saisies[key] || 0));
                                return {
                                    key,
                                    label: cv.label || key,
                                    periode: cv.periode || 'mois',
                                    budget,`,
`                                const budgetInitial = Math.round(getMonthlyVariableValue(cv));
                                const budget = Math.round(budgetCategorieRevise(cv));
                                const engage = Math.max(0, Number(saisies[key] || 0));
                                return {
                                    key,
                                    label: cv.label || key,
                                    periode: cv.periode || 'mois',
                                    budgetInitial,
                                    suspendue: estSuspendableAbsence(cv),
                                    economie: budgetInitial - budget,
                                    budget,`);

sub(
`                        consoCategoriesT0, consoEngageeT0, consoTheoriqueAJour, deriveConsoT0,`,
`                        consoCategoriesT0, consoEngageeT0, consoTheoriqueAJour, deriveConsoT0,
                        joursAbsence, modeVoyageActif, facteurPresence, economieVoyage,
                        budgetVariableSansAbsence, setJoursAbsence, toggleSuspendreAbsence, estSuspendableAbsence,`);

/* ══════════════════════════════════════════════════════════════════════════
   2. UI — bloc Mode Voyage en tête de la carte T0
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                            <div class="p-4 space-y-2">
                                <div v-for="c in consoCategoriesT0" :key="'ct0_' + c.key"`,
`                            <!-- v34.05 : Mode Voyage -->
                            <div :class="['px-5 py-3 border-b border-slate-700 flex items-center justify-between gap-3 flex-wrap', modeVoyageActif ? 'bg-sky-900/30' : 'bg-slate-900/40']">
                                <div class="flex items-center gap-3">
                                    <span class="text-lg">✈️</span>
                                    <div>
                                        <label class="text-[11px] font-black uppercase tracking-widest text-sky-200">Jours d'absence ce mois</label>
                                        <p class="text-[9px] font-bold text-slate-400">Suspend les postes consommés sur place</p>
                                    </div>
                                    <input type="number" min="0" :max="joursCycleTotal" :value="joursAbsence"
                                           @input="setJoursAbsence($event.target.value)"
                                           class="w-20 bg-slate-950 text-sky-300 border border-slate-600 rounded p-1.5 text-right text-sm font-black outline-none focus:border-sky-400"/>
                                    <span class="text-[10px] font-bold text-slate-400">/ {{ joursCycleTotal }} j</span>
                                </div>
                                <div v-if="modeVoyageActif" class="text-right">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-sky-400">Économie du cycle</p>
                                    <p class="text-base font-black text-emerald-300 tabular-nums">+{{ formatMAD(economieVoyage) }}</p>
                                    <p class="text-[9px] font-bold text-slate-400">présence {{ Math.round(facteurPresence * 100) }} % · reversée à l'atterrissage</p>
                                </div>
                            </div>
                            <div class="p-4 space-y-2">
                                <div v-for="c in consoCategoriesT0" :key="'ct0_' + c.key"`);

/* ── Ligne de catégorie : toggle + delta ─────────────────────────────────── */
sub(
`                                    <div class="min-w-0 flex-1">
                                        <p class="text-sm font-bold text-slate-200 truncate">{{ c.label }}</p>
                                        <div class="flex items-center gap-2 mt-1">`,
`                                    <div class="min-w-0 flex-1">
                                        <p class="text-sm font-bold text-slate-200 truncate flex items-center gap-2">
                                            <span class="truncate">{{ c.label }}</span>
                                            <button @click="toggleSuspendreAbsence(c.key)"
                                                    :title="c.suspendue ? 'Suspendu pendant l\'absence — cliquer pour le laisser courir' : 'Continue de courir pendant l\'absence — cliquer pour le suspendre'"
                                                    :class="['text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border shrink-0 transition-colors', c.suspendue ? 'bg-sky-900/60 text-sky-300 border-sky-600' : 'bg-slate-800 text-slate-500 border-slate-600 hover:text-slate-300']">
                                                ✈️ {{ c.suspendue ? 'suspendu' : 'maintenu' }}
                                            </button>
                                        </p>
                                        <p v-if="modeVoyageActif && c.economie > 0" class="text-[10px] font-bold text-sky-300 mt-0.5">
                                            {{ formatMAD(c.budgetInitial) }} ➔ {{ formatMAD(c.budget) }}
                                            <span class="text-emerald-300">(−{{ formatMAD(c.economie) }} mode voyage)</span>
                                        </p>
                                        <div class="flex items-center gap-2 mt-1">`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v34.05 appliquée');
