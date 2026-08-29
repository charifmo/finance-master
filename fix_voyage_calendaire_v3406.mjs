/**
 * v34.06 — Mode Voyage : saisie par dates, bornage par période, pondération week-end
 * ---------------------------------------------------------------------------
 *  1. Saisie par DATES (du … au …) au lieu d'un nombre de jours.
 *
 *  2. BORNAGE. Règle demandée : « du 30 août au 8 septembre » ne doit alléger
 *     chaque période que de SES propres jours, sans perte ni double compte.
 *     Le découpage se fait sur le CYCLE DE PAIE affiché, pas sur le mois civil.
 *     Motif : le budget de 14 835 DH que l'écran allège est celui du cycle
 *     27 août → 26 septembre. Découper sur le mois civil attribuerait les 2
 *     jours d'août au budget « août » — dont le cycle (27 juil → 26 août) était
 *     déjà clos le 30 août. Ces 2 jours d'économie disparaîtraient purement et
 *     simplement. Le bornage par cycle donne la même garantie (chaque période
 *     ne prend que ses jours) sans perdre un dirham. La ventilation par mois
 *     civil reste affichée : « 10 j sur ce cycle · 2 en août, 8 en septembre ».
 *
 *  3. PONDÉRATION SEMAINE / WEEK-END. Un budget sorties ne se consomme pas au
 *     même rythme un mardi et un samedi : 70 % est réputé tomber le week-end,
 *     30 % en semaine. L'économie dépend donc du TYPE de jours manqués. Les
 *     postes du quotidien (alimentation, voiture) restent linéaires.
 *
 *  4. RYTHME ATTENDU. Les jours d'absence déjà écoulés ne comptaient pas comme
 *     des jours sans consommation : la jauge affichait un retard fictif. Ils
 *     sont désormais retirés des deux termes du rapport.
 *
 *  5. TOTAL ENGAGÉ. La référence globale devient la somme des références par
 *     ligne : la jauge et le détail qui la compose ne peuvent plus diverger.
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
   1. MOTEUR — remplacement du bloc v34.05
   ══════════════════════════════════════════════════════════════════════════ */
const DEBUT = `                    // ── v34.05 : MODE VOYAGE ───────────────────────────────────────────`;
const FIN = `                    const budgetVariableProrataBase = computed(() => {`;
const i0 = s.indexOf(DEBUT), i1 = s.indexOf(FIN, i0);
if (i0 < 0 || i1 < 0) throw new Error('bloc mode voyage v34.05 introuvable');

const MOTEUR = String.raw`                    // ── v34.06 : MODE VOYAGE — DATES, BORNAGE ET PONDÉRATION ───────────
                    //   L'absence se saisit par DATES et n'allège que le CYCLE qu'elle
                    //   traverse réellement. Un aller-retour du 30 août au 8 septembre tombe
                    //   entièrement dans le cycle 27 août → 26 septembre : ses 10 jours vont
                    //   à ce cycle, aucun n'est perdu ni compté deux fois. Un voyage à cheval
                    //   sur deux cycles se répartit tout seul sur les deux écrans.
                    const CAT_SUSPENDABLES = /aliment|nourrit|course|voiture|carburant|essence|transport|sortie|resto|loisir/i;
                    //   Postes dont la consommation se concentre le week-end.
                    const CAT_LOISIRS = /sortie|loisir|resto|restaurant|divertis|cinema|ciné|weekend/i;
                    const PART_WEEKEND_LOISIRS = 0.70;   // 70 % du budget loisirs tombe le week-end

                    const estSuspendableAbsence = (cv) => {
                        if (!cv) return false;
                        if (cv.suspendreAbsence !== undefined && cv.suspendreAbsence !== null) return !!cv.suspendreAbsence;
                        return CAT_SUSPENDABLES.test(String(cv.label || '') + ' ' + String(cv.categorieId || ''));
                    };
                    const estLoisirAbsence = (cv) =>
                        CAT_LOISIRS.test(String((cv || {}).label || '') + ' ' + String((cv || {}).categorieId || ''));

                    // "YYYY-MM-DD" → Date locale à midi (immunise contre les bascules de fuseau)
                    const _dateVoyage = (v) => {
                        const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
                        if (!m) return null;
                        const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
                        return isNaN(d.getTime()) ? null : d;
                    };
                    const _estWeekend = (d) => { const j = d.getDay(); return j === 0 || j === 6; };
                    const _MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet',
                                      'août','septembre','octobre','novembre','décembre'];

                    // Bornes du cycle de paie affiché (dernière paie → veille de la suivante)
                    const cycleBornes = computed(() => {
                        const i = _cyclePaieInfo.value;
                        const j = Math.max(1, Number(jourDePaie.value) || 27);
                        const debut = new Date(i.dernierAn, i.dernierMois - 1, j, 12, 0, 0);
                        const fin = new Date(i.prochainAn, i.prochainMois - 1, j, 12, 0, 0);
                        fin.setDate(fin.getDate() - 1);
                        return { debut, fin };
                    });

                    // Répartition semaine / week-end du CYCLE — dénominateur de la pondération
                    const cycleRepartitionJours = computed(() => {
                        const b = cycleBornes.value;
                        let weekend = 0, semaine = 0;
                        for (let d = new Date(b.debut); d.getTime() <= b.fin.getTime(); d.setDate(d.getDate() + 1)) {
                            if (_estWeekend(d)) weekend++; else semaine++;
                            if (weekend + semaine > 62) break;   // garde-fou
                        }
                        const total = weekend + semaine;
                        return total > 0 ? { total, weekend, semaine } : { total: 30, weekend: 8, semaine: 22 };
                    });

                    // Fenêtre d'absence RECOUPÉE avec le cycle affiché.
                    //   Dates absentes, incohérentes ou hors cycle ⇒ zéro partout : aucune
                    //   division en aval ne peut produire NaN ou Infinity.
                    const voyageJoursDuMois = computed(() => {
                        const si = soldesInitiaux.value || {};
                        const b = cycleBornes.value;
                        const vide = { total: 0, semaine: 0, weekend: 0, ecoules: 0, saisi: false, parMois: [] };
                        const d1 = _dateVoyage(si.voyageDebut), d2 = _dateVoyage(si.voyageFin);
                        if (!d1 || !d2 || d2.getTime() < d1.getTime()) return vide;
                        if (isCyclePasse.value) return { ...vide, saisi: true };
                        const debut = d1.getTime() > b.debut.getTime() ? d1 : b.debut;
                        const fin = d2.getTime() < b.fin.getTime() ? d2 : b.fin;
                        if (fin.getTime() < debut.getTime()) return { ...vide, saisi: true };
                        const auj = new Date(); auj.setHours(12, 0, 0, 0);
                        let semaine = 0, weekend = 0, ecoules = 0;
                        const parMois = [];
                        for (let d = new Date(debut); d.getTime() <= fin.getTime(); d.setDate(d.getDate() + 1)) {
                            if (_estWeekend(d)) weekend++; else semaine++;
                            if (d.getTime() <= auj.getTime()) ecoules++;
                            const cle = d.getFullYear() + '-' + d.getMonth();
                            const der = parMois[parMois.length - 1];
                            if (der && der.cle === cle) der.jours++;
                            else parMois.push({ cle, nom: _MOIS_FR[d.getMonth()], jours: 1 });
                            if (semaine + weekend > 62) break;   // garde-fou
                        }
                        return { total: semaine + weekend, semaine, weekend, ecoules, saisi: true, parMois };
                    });

                    const joursAbsence = computed(() => voyageJoursDuMois.value.total);
                    const modeVoyageActif = computed(() => joursAbsence.value > 0);
                    const facteurPresence = computed(() => {
                        const t = Math.max(1, cycleRepartitionJours.value.total);
                        return Math.max(0, Math.min(1, (t - joursAbsence.value) / t));
                    });
                    // Ventilation lisible : "2 j en août · 8 j en septembre"
                    const voyageDetailMois = computed(() =>
                        voyageJoursDuMois.value.parMois.map(m => m.jours + ' j en ' + m.nom).join(' · '));

                    // Économie d'une catégorie : linéaire, ou pondérée pour les loisirs.
                    //   Un week-end manqué coûte plus au budget sorties que deux mardis.
                    const economieCategorieAbsence = (cv) => {
                        if (!estSuspendableAbsence(cv)) return 0;
                        const abs = voyageJoursDuMois.value;
                        if (!(abs.total > 0)) return 0;
                        const budget = getMonthlyVariableValue(cv || {});
                        if (!(budget > 0)) return 0;
                        const rep = cycleRepartitionJours.value;
                        let eco;
                        if (estLoisirAbsence(cv)) {
                            const parWe  = rep.weekend > 0 ? (budget * PART_WEEKEND_LOISIRS) / rep.weekend : 0;
                            const parSem = rep.semaine > 0 ? (budget * (1 - PART_WEEKEND_LOISIRS)) / rep.semaine : 0;
                            eco = abs.weekend * parWe + abs.semaine * parSem;
                        } else {
                            eco = rep.total > 0 ? budget * (abs.total / rep.total) : 0;
                        }
                        return Number.isFinite(eco) ? Math.min(budget, Math.max(0, eco)) : 0;
                    };
                    const budgetCategorieRevise = (cv) =>
                        Math.max(0, getMonthlyVariableValue(cv || {}) - economieCategorieAbsence(cv));

                    const setVoyage = (champ, valeur) => {
                        soldesInitiaux.value[champ] = String(valeur || '');
                        handleDataChange();
                    };
                    const effacerVoyage = () => {
                        soldesInitiaux.value.voyageDebut = '';
                        soldesInitiaux.value.voyageFin = '';
                        handleDataChange();
                    };
                    const toggleSuspendreAbsence = (cle) => {
                        const d = donneesAnnuelles.value[moisBudgetaire.value.an];
                        const cv = d && d.chargesVariables ? d.chargesVariables[cle] : null;
                        if (!cv) return;
                        cv.suspendreAbsence = !estSuspendableAbsence(cv);
                        handleDataChange();
                    };

`;
s = s.slice(0, i0) + MOTEUR + s.slice(i1);

/* ── Exports du moteur ────────────────────────────────────────────────────── */
sub(
`                        budgetVariableSansAbsence, economieVoyageBudget, setJoursAbsence, toggleSuspendreAbsence, estSuspendableAbsence,`,
`                        budgetVariableSansAbsence, economieVoyageBudget, toggleSuspendreAbsence, estSuspendableAbsence,
                        voyageJoursDuMois, cycleRepartitionJours, voyageDetailMois, setVoyage, effacerVoyage,`);

/* ══════════════════════════════════════════════════════════════════════════
   2. RYTHME ATTENDU — neutraliser les jours d'absence déjà écoulés
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                        const ratioEcoule = joursCycleEcoules.value / joursCycleTotal.value;`,
String.raw`                        // v34.06 : un jour d'absence déjà passé n'est pas un jour de
                        //   consommation. Le retirer des DEUX termes du rapport, sinon la
                        //   jauge annonce un retard que le voyageur n'a jamais eu à rattraper.
                        const _totalCycle = Math.max(1, joursCycleTotal.value || 1);
                        const ratioEcouleBrut = Math.max(0, Math.min(1, (joursCycleEcoules.value || 0) / _totalCycle));
                        const _abs = voyageJoursDuMois.value;
                        const _ecoulesNets = Math.max(0, (joursCycleEcoules.value || 0) - _abs.ecoules);
                        const _totalNet = Math.max(1, _totalCycle - _abs.total);
                        const _ratioPresence = Math.max(0, Math.min(1, _ecoulesNets / _totalNet));
                        const ratioEcoule = Number.isFinite(_ratioPresence) ? _ratioPresence : ratioEcouleBrut;`);

sub(
`                                    theorique: Math.round(budget * ratioEcoule),`,
`                                    pondere: estSuspendableAbsence(cv) && estLoisirAbsence(cv),
                                    theorique: Math.round(budget * (estSuspendableAbsence(cv) ? ratioEcoule : ratioEcouleBrut)),`);

/* ── Référence globale = somme des références par ligne (cohérence de jauge) ─ */
sub(
`                    const consoTheoriqueAJour = computed(() =>
                        Math.round(budgetConsoCycle.value * (joursCycleEcoules.value / joursCycleTotal.value))
                    );`,
`                    //   v34.06 : somme des références par catégorie plutôt qu'un prorata
                    //   global — sans quoi la jauge « rythme attendu » et les lignes qui la
                    //   composent divergent dès qu'un poste est suspendu pour absence.
                    const consoTheoriqueAJour = computed(() =>
                        consoCategoriesT0.value.reduce((s, c) => s + (Number(c.theorique) || 0), 0)
                    );`);

/* ══════════════════════════════════════════════════════════════════════════
   3. UI — sélecteur de dates à la place du compteur de jours
   ══════════════════════════════════════════════════════════════════════════ */
sub(
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
                                    <p class="text-[9px] font-bold text-slate-400">présence {{ Math.round(facteurPresence * 100) }} % · gain réel sur l’atterrissage</p>
                                    <p v-if="economieVoyageBudget !== economieVoyage" class="text-[9px] font-bold text-slate-500">budget du cycle allégé de {{ formatMAD(economieVoyageBudget) }}</p>
                                </div>
                            </div>`,
`                            <!-- v34.06 : Mode Voyage — sélecteur de dates -->
                            <div :class="['px-5 py-3 border-b border-slate-700 flex items-center justify-between gap-3 flex-wrap', modeVoyageActif ? 'bg-sky-900/30' : 'bg-slate-900/40']">
                                <div class="flex items-center gap-3 flex-wrap">
                                    <span class="text-lg">✈️</span>
                                    <div>
                                        <label class="text-[11px] font-black uppercase tracking-widest text-sky-200">Voyage · absence</label>
                                        <p class="text-[9px] font-bold text-slate-400">Chaque cycle ne déduit que les jours qui tombent chez lui</p>
                                    </div>
                                    <div class="flex items-center gap-1.5">
                                        <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">Du</span>
                                        <input type="date" :value="soldesInitiaux.voyageDebut || ''"
                                               @change="setVoyage('voyageDebut', $event.target.value)"
                                               class="bg-slate-950 text-sky-300 border border-slate-600 rounded p-1.5 text-xs font-bold outline-none focus:border-sky-400"/>
                                        <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">au</span>
                                        <input type="date" :value="soldesInitiaux.voyageFin || ''"
                                               :min="soldesInitiaux.voyageDebut || null"
                                               @change="setVoyage('voyageFin', $event.target.value)"
                                               class="bg-slate-950 text-sky-300 border border-slate-600 rounded p-1.5 text-xs font-bold outline-none focus:border-sky-400"/>
                                        <button v-if="soldesInitiaux.voyageDebut || soldesInitiaux.voyageFin"
                                                @click="effacerVoyage()" title="Effacer les dates de voyage"
                                                class="text-[9px] font-black px-2 py-1.5 rounded-lg border border-slate-600 text-slate-400 hover:border-red-500 hover:text-red-300 transition-all">↩</button>
                                    </div>
                                </div>
                                <div v-if="modeVoyageActif" class="text-right">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-sky-400">Économie du cycle</p>
                                    <p class="text-base font-black text-emerald-300 tabular-nums">+{{ formatMAD(economieVoyage) }}</p>
                                    <p class="text-[9px] font-bold text-slate-400">
                                        {{ voyageJoursDuMois.total }} j sur ce cycle ({{ cycleLabel }}) · {{ voyageDetailMois }}
                                    </p>
                                    <p class="text-[9px] font-bold text-slate-500">
                                        {{ voyageJoursDuMois.weekend }} we · {{ voyageJoursDuMois.semaine }} sem · présence {{ Math.round(facteurPresence * 100) }} %<span v-if="economieVoyageBudget !== economieVoyage"> · budget allégé de {{ formatMAD(economieVoyageBudget) }}</span>
                                    </p>
                                </div>
                                <p v-else-if="voyageJoursDuMois.saisi" class="text-[9px] font-bold text-slate-500 text-right">
                                    Aucun jour de ce voyage ne tombe sur le cycle affiché ({{ cycleLabel }}).
                                </p>
                            </div>`);

/* ── Ligne de catégorie : mention de la pondération week-end ──────────────── */
sub(
`                                            <span class="text-emerald-300">(−{{ formatMAD(c.economie) }} mode voyage)</span>`,
`                                            <span class="text-emerald-300">(−{{ formatMAD(c.economie) }} mode voyage)</span>
                                            <span v-if="c.pondere" class="text-slate-500">· pondéré week-end</span>`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v34.06 appliquée');
