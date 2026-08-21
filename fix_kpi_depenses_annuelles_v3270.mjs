/**
 * v32.70 — Dépenses-Annuelles : KPI Topbar + tooltip journal du compte dédié
 * ---------------------------------------------------------------------------
 *  1. Extraction du moteur du Relevé en fonction paramétrable _buildJournalReleve(filtres, cycles)
 *     → journalHybridePourReleve devient une simple projection de ce moteur (zéro régression).
 *  2. Nouveaux getters Store : compteDepensesAnnuelles / compteDepensesAnnuellesKey / kpiDepensesAnnuelles.
 *  3. Widget KPI "Dépenses Annuelles" dans la Topbar desktop + Topbar mobile, tooltip au survol.
 *  4. Bump version 32.70 + entrée CHANGELOG.
 */
import fs from 'node:fs';

const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const before = s.length;
// Le fichier VPS est en CRLF : on normalise pour le matching, on restaure à l'écriture.
const CRLF = s.includes('\r\n');
if (CRLF) s = s.split('\r\n').join('\n');

const must = (needle, n = 1) => {
    const c = s.split(needle).length - 1;
    if (c !== n) throw new Error(`Ancre introuvable ou ambiguë (${c}/${n}) :\n${needle.slice(0, 160)}`);
};
const sub = (from, to) => { must(from); s = s.replace(from, to); };

/* ══════════════════════════════════════════════════════════════════════════
   1. MOTEUR DU JOURNAL → FONCTION PARAMÉTRABLE
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                    const journalHybridePourReleve = computed(() => {
                        calculationTick.value;
`,
`                    // ═══════════════════════════════════════════════════════════════════
                    // v32.70 : MOTEUR DU JOURNAL EXTRAIT EN FONCTION PARAMÉTRABLE
                    //   _buildJournalReleve(filtres, cycles) → { entries, soldeAtterrissage }
                    //   • filtres = [] → vue Globale ; ['cpt_<id>'] → un compte ; multi-select OK
                    //   • cycles  = ['8-2026','9-2026', …] ; [] → cycle courant uniquement
                    //   Le popup RELEVÉ DE COMPTES **et** le KPI Topbar « Dépenses Annuelles »
                    //   consomment STRICTEMENT ce moteur → chiffres identiques au centime.
                    //   La logique de calcul est inchangée : seules les deux sources réactives
                    //   (_rFiltres / _rawCycles) deviennent des paramètres.
                    // ═══════════════════════════════════════════════════════════════════
                    const _buildJournalReleve = (_filtresArg, _cyclesArg) => {
                        calculationTick.value;
`);

sub(
`                        const _rFiltres = releveComptesFiltres.value;
`,
`                        const _rFiltres = Array.isArray(_filtresArg) ? _filtresArg : [];
`);

sub(
`                        const _rawCycles = cyclesReleveActifs.value;
`,
`                        const _rawCycles = Array.isArray(_cyclesArg) ? _cyclesArg : [];
`);

sub(
`                        const _soldeAtterr = _rFiltres.length === 0 ? _sumSoldes() : _rFiltres.reduce((s, k) => s + (Number(soldes[k]) || 0), 0);
                        return { entries, soldeAtterrissage: _soldeAtterr };
                    });
`,
String.raw`                        const _soldeAtterr = _rFiltres.length === 0 ? _sumSoldes() : _rFiltres.reduce((s, k) => s + (Number(soldes[k]) || 0), 0);
                        return { entries, soldeAtterrissage: _soldeAtterr, soldesFinaux: soldes };
                    };

                    // v32.70 : le popup Relevé n'est plus qu'une projection du moteur sur son état réactif
                    const journalHybridePourReleve = computed(() => _buildJournalReleve(releveComptesFiltres.value, cyclesReleveActifs.value));

                    // ═══════════════════════════════════════════════════════════════════
                    // v32.70 DÉPENSES ANNUELLES — GETTERS DÉDIÉS (KPI Topbar + tooltip)
                    // Zéro calcul local dans la Topbar : tout sort d'ici, et ces getters
                    // appellent le MÊME moteur (_buildJournalReleve) que le Relevé de Comptes.
                    // ═══════════════════════════════════════════════════════════════════
                    const _normLibelle = (v) => String(v || '')
                        .normalize('NFD').replace(/[^\x20-\x7E]/g, '')
                        .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

                    // Getter 1 — identification du compte « depenses annuels »
                    // (tolérant accents / casse / pluriels : "Dépenses Annuelles", "depenses annuels"…)
                    const compteDepensesAnnuelles = computed(() => {
                        return (comptes.value || []).find(c => {
                            const n = _normLibelle(c.label || c.nom);
                            return n.includes('depense') && n.includes('annu');
                        }) || null;
                    });
                    const compteDepensesAnnuellesKey = computed(() => {
                        const c = compteDepensesAnnuelles.value;
                        return c ? 'cpt_' + c.id : null;
                    });

                    // Getter 2 — résumé condensé du journal pour CE compte uniquement,
                    // du cycle courant jusqu'à Décembre → atterrissage de fin d'exercice.
                    const kpiDepensesAnnuelles = computed(() => {
                        calculationTick.value;
                        const _mNL = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
                        const _mAB = ['','Janv','Févr','Mars','Avr','Mai','Juin','Juil','Août','Sept','Oct','Nov','Déc'];
                        const key = compteDepensesAnnuellesKey.value;
                        if (!key) return { exists: false, key: null, label: 'Dépenses Annuelles', icone: '📅',
                                           soldeActuel: 0, sorties: [], entrees: [], nbSorties: 0,
                                           totalSorties: 0, totalEntrees: 0, soldeFinal: 0, moisFin: '' };

                        const cpt = compteDepensesAnnuelles.value;
                        const curM = moisBudgetaire.value.mois, curA = moisBudgetaire.value.an;
                        // Cycles projetés : cycle courant → Décembre de l'exercice en cours
                        const cycles = [];
                        for (let m = curM; m <= 12; m++) cycles.push(m + '-' + curA);

                        const j = _buildJournalReleve([key], cycles);

                        let soldeActuel = Number(cpt.solde) || 0;
                        const sorties = [], entrees = [];
                        let _ci = 0;
                        (j.entries || []).forEach(e => {
                            if (e.type === 'cycle_sep') { _ci++; return; }
                            if (e.type === 'initial') { soldeActuel = Number(e.montant) || 0; return; }
                            const mCyc = Number(String(cycles[_ci] || (curM + '-' + curA)).split('-')[0]) || curM;
                            const row = {
                                libelle: e.libelle,
                                montant: Number(e.montant) || 0,
                                jour: e.jourPrevu || null,
                                mois: mCyc,
                                moisLabel: _mAB[mCyc] || '',
                                dateLabel: (e.jourPrevu ? e.jourPrevu + ' ' : '') + (_mAB[mCyc] || ''),
                                soldeApres: Number(e.soldeCompteApres) || 0
                            };
                            (e.type === 'credit' ? entrees : sorties).push(row);
                        });

                        const _r2 = (v) => Math.round(v * 100) / 100;
                        return {
                            exists: true,
                            key,
                            label: cpt.label || cpt.nom || 'Dépenses Annuelles',
                            icone: cpt.icone || '📅',
                            soldeActuel,                                        // solde instantané (T0)
                            sorties,                                            // obligations non soldées de ce compte
                            entrees,                                            // alimentations / versements prévus
                            nbSorties: sorties.length,
                            totalSorties: _r2(sorties.reduce((a, r) => a + r.montant, 0)),  // = reste à payer
                            totalEntrees: _r2(entrees.reduce((a, r) => a + r.montant, 0)),
                            soldeFinal: _r2(Number(j.soldeAtterrissage || 0)),  // atterrissage projeté
                            moisFin: 'Décembre ' + curA
                        };
                    });

                    const showDepAnnuellesTooltip = ref(false);
                    // Ouvre le popup RELEVÉ DE COMPTES pré-filtré et pré-cyclé à l'identique du KPI
                    const ouvrirReleveDepensesAnnuelles = () => {
                        const key = compteDepensesAnnuellesKey.value;
                        if (!key) return;
                        const curM = moisBudgetaire.value.mois, curA = moisBudgetaire.value.an;
                        ouvrirReleve(key);
                        anneesSelectionnees.value = [curA];
                        moisSelectionnes.value = Array.from({ length: 12 - curM + 1 }, (_, i) => curM + i);
                        showDepAnnuellesTooltip.value = false;
                    };
`);

/* ══════════════════════════════════════════════════════════════════════════
   2. EXPOSITION DANS LE RETURN DU setup()
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                        showPoidsTooltip, showInlineReleve,
`,
`                        showPoidsTooltip, showInlineReleve,
                        // v32.70 Dépenses-Annuelles : KPI Topbar + tooltip
                        compteDepensesAnnuelles, compteDepensesAnnuellesKey, kpiDepensesAnnuelles,
                        showDepAnnuellesTooltip, ouvrirReleveDepensesAnnuelles,
`);

/* ══════════════════════════════════════════════════════════════════════════
   3. WIDGET TOPBAR DESKTOP (ruban KPI, avant "↑ Entrées")
   ══════════════════════════════════════════════════════════════════════════ */
const TOOLTIP_BODY = (px, w) => `
                            <div v-if="showDepAnnuellesTooltip" class="absolute right-0 top-full mt-2 z-[300] ${w} bg-gray-950 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden" @click.stop>
                                <div class="${px} py-2 border-b border-gray-800 flex items-center justify-between">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-gray-400">{{ kpiDepensesAnnuelles.icone }} {{ kpiDepensesAnnuelles.label }}</p>
                                    <button @click.stop="showDepAnnuellesTooltip = false" class="text-gray-500 hover:text-gray-300 text-xs font-black px-1">✕</button>
                                </div>
                                <!-- Solde instantané (T0) — miroir du pivot ⏰ AUJOURD'HUI du Relevé -->
                                <div class="${px} py-2 flex items-center justify-between bg-gray-900/60 border-b border-gray-800">
                                    <span class="text-[9px] font-black uppercase tracking-widest text-gray-400">⏰ Solde actuel</span>
                                    <span :class="['text-sm font-black tabular-nums', kpiDepensesAnnuelles.soldeActuel < 0 ? 'text-red-400' : 'text-blue-300']">{{ formatMAD(kpiDepensesAnnuelles.soldeActuel) }}</span>
                                </div>
                                <!-- Prochaines sorties non soldées imputées à ce compte -->
                                <div class="${px} pt-2 pb-1 flex items-center justify-between">
                                    <span class="text-[8px] font-black uppercase tracking-widest text-gray-500">📌 Obligations à venir</span>
                                    <span class="text-[8px] font-black uppercase tracking-widest text-gray-600">{{ kpiDepensesAnnuelles.nbSorties }} ligne{{ kpiDepensesAnnuelles.nbSorties > 1 ? 's' : '' }}</span>
                                </div>
                                <div v-if="kpiDepensesAnnuelles.nbSorties" class="max-h-56 overflow-y-auto custom-scroll pb-1">
                                    <div v-for="(d, i) in kpiDepensesAnnuelles.sorties" :key="'da_'+i" class="grid grid-cols-[54px_1fr_auto] gap-1 items-center ${px} py-1 hover:bg-gray-800 transition-colors">
                                        <span class="text-[8px] font-bold uppercase text-gray-500 whitespace-nowrap">{{ d.dateLabel }}</span>
                                        <span class="text-[10px] font-bold text-gray-300 truncate">{{ d.libelle }}</span>
                                        <span class="text-[10px] font-black tabular-nums text-red-400 whitespace-nowrap">-{{ formatMAD(d.montant) }}</span>
                                    </div>
                                </div>
                                <p v-else class="${px} py-3 text-[10px] font-bold text-emerald-400 text-center">✅ Aucune obligation restante sur ce compte</p>
                                <!-- Alimentations prévues (versements entrants sur le compte) -->
                                <div v-if="kpiDepensesAnnuelles.totalEntrees > 0" class="${px} py-1.5 flex items-center justify-between border-t border-gray-800">
                                    <span class="text-[9px] font-black uppercase tracking-widest text-gray-500">💎 Alimentations prévues</span>
                                    <span class="text-[10px] font-black tabular-nums text-emerald-400">+{{ formatMAD(kpiDepensesAnnuelles.totalEntrees) }}</span>
                                </div>
                                <!-- Totaux -->
                                <div class="${px} py-1.5 flex items-center justify-between border-t border-gray-800 bg-gray-900/50">
                                    <span class="text-[9px] font-black uppercase tracking-widest text-gray-400">Σ Reste à payer</span>
                                    <span class="text-sm font-black tabular-nums text-red-400">-{{ formatMAD(kpiDepensesAnnuelles.totalSorties) }}</span>
                                </div>
                                <div class="${px} py-2 flex items-center justify-between border-t-2 border-gray-700 bg-gray-900/80">
                                    <span class="text-[9px] font-black uppercase tracking-widest text-indigo-300">🏁 Atterrissage {{ kpiDepensesAnnuelles.moisFin }}</span>
                                    <span :class="['text-base font-black tabular-nums', kpiDepensesAnnuelles.soldeFinal < 0 ? 'text-red-500' : 'text-indigo-300']">{{ formatMAD(kpiDepensesAnnuelles.soldeFinal) }}</span>
                                </div>
                                <button @click.stop="ouvrirReleveDepensesAnnuelles()" class="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase tracking-widest transition-colors">📑 Ouvrir le relevé complet</button>
                            </div>`;

sub(
`                        <div class="bg-green-50 border border-green-200 rounded-xl px-2 py-1.5 lg:px-3 lg:py-2">
                            <p class="text-[8px] lg:text-[9px] font-black text-green-600 uppercase tracking-widest">↑ Entrées {{anneeAffichage}}</p>`,
`                        <!-- ═══ v32.70 Dépenses-Annuelles : atterrissage projeté du compte dédié ═══ -->
                        <div v-if="kpiDepensesAnnuelles.exists" class="relative" @mouseenter="showDepAnnuellesTooltip = true" @mouseleave="showDepAnnuellesTooltip = false" @click.stop="showDepAnnuellesTooltip = !showDepAnnuellesTooltip">
                            <div :class="['border rounded-xl px-2 py-1.5 lg:px-3 lg:py-2 cursor-pointer select-none', kpiDepensesAnnuelles.soldeFinal < 0 ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-200']">
                                <p class="text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-gray-500">{{ kpiDepensesAnnuelles.icone }} Dépenses Annuelles ⓘ</p>
                                <p :class="['text-xs lg:text-sm font-black', kpiDepensesAnnuelles.soldeFinal < 0 ? 'text-red-600' : 'text-amber-700']">{{ formatMAD(kpiDepensesAnnuelles.soldeFinal) }}</p>
                                <p class="text-[8px] font-bold uppercase text-gray-400">Reste -{{ formatMAD(kpiDepensesAnnuelles.totalSorties) }}</p>
                            </div>${TOOLTIP_BODY('px-3', 'w-[340px]')}
                        </div>
                        <div class="bg-green-50 border border-green-200 rounded-xl px-2 py-1.5 lg:px-3 lg:py-2">
                            <p class="text-[8px] lg:text-[9px] font-black text-green-600 uppercase tracking-widest">↑ Entrées {{anneeAffichage}}</p>`);

/* ══════════════════════════════════════════════════════════════════════════
   4. WIDGET TOPBAR MOBILE (bandeau pleine largeur sous la grille KPI)
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                        <button @click="redo" :disabled="!canRedo" :class="['flex-1 flex items-center justify-center rounded-lg text-[10px] font-black border transition-all', canRedo ? 'bg-slate-700 text-white border-slate-600 active:bg-blue-600' : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed']" title="Refaire">↪</button>
                    </div>
                </div>`,
`                        <button @click="redo" :disabled="!canRedo" :class="['flex-1 flex items-center justify-center rounded-lg text-[10px] font-black border transition-all', canRedo ? 'bg-slate-700 text-white border-slate-600 active:bg-blue-600' : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed']" title="Refaire">↪</button>
                    </div>
                    <!-- ═══ v32.70 Dépenses-Annuelles (mobile : tap = détail) ═══ -->
                    <div v-if="kpiDepensesAnnuelles.exists" class="col-span-3 relative" @click.stop="showDepAnnuellesTooltip = !showDepAnnuellesTooltip">
                        <div :class="['rounded-lg px-2 py-1.5 border flex items-center justify-between gap-2 cursor-pointer select-none', kpiDepensesAnnuelles.soldeFinal < 0 ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-200']">
                            <p class="text-[7px] font-black uppercase tracking-widest text-gray-500">{{ kpiDepensesAnnuelles.icone }} Dépenses Annuelles ⓘ</p>
                            <div class="flex items-baseline gap-2">
                                <span class="text-[7px] font-black uppercase text-gray-400">Reste -{{ formatMAD(kpiDepensesAnnuelles.totalSorties) }}</span>
                                <span :class="['text-[11px] font-black tabular-nums', kpiDepensesAnnuelles.soldeFinal < 0 ? 'text-red-600' : 'text-amber-700']">{{ formatMAD(kpiDepensesAnnuelles.soldeFinal) }}</span>
                            </div>
                        </div>${TOOLTIP_BODY('px-3', 'w-full')}
                    </div>
                </div>`);

/* ══════════════════════════════════════════════════════════════════════════
   5. VERSION + CHANGELOG
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                    const CURRENT_VERSION = "32.60 Auto-Categorisation";`,
`                    const CURRENT_VERSION = "32.70 Depenses-Annuelles";`);

sub(
`                    const CHANGELOG = [
`,
`                    const CHANGELOG = [
        { version: "32.70 Depenses-Annuelles", date: "2026-08-21", changes: [
            "NOUVEAU KPI TOPBAR « Dépenses Annuelles » : carte dédiée dans le ruban d'en-tête (desktop + mobile), à côté de Surplus / Mensualités / Entrées / Sorties. Valeur principale = ATTERRISSAGE PROJETÉ (solde final) du seul compte « depenses annuels », rouge si négatif. Sous-titre = reste à payer sur ce compte.",
            "TOOLTIP AU SURVOL (tap sur mobile) : résumé condensé du journal de ce compte — solde instantané (T0), mini-liste des obligations non soldées imputées au compte (mois + jour + libellé + montant), alimentations prévues, Σ reste à payer, et atterrissage Décembre. Bouton « Ouvrir le relevé complet » qui pré-filtre le popup RELEVÉ DE COMPTES sur ce compte et sur les cycles courant→Décembre.",
            "ARCHITECTURE — ZÉRO CALCUL LOCAL DANS LA TOPBAR : le moteur du Relevé est extrait en fonction paramétrable _buildJournalReleve(filtres, cycles). journalHybridePourReleve n'est plus qu'une projection de ce moteur sur son état réactif (releveComptesFiltres / cyclesReleveActifs) — logique de calcul strictement inchangée, aucune régression sur le journal.",
            "NOUVEAUX GETTERS : compteDepensesAnnuelles (détection par label, insensible aux accents/casse/pluriels : « Dépenses Annuelles », « depenses annuels »…), compteDepensesAnnuellesKey (cpt_<id>) et kpiDepensesAnnuelles (soldeActuel, sorties[], entrees[], totalSorties, totalEntrees, soldeFinal, moisFin).",
            "GARANTIE SSOT : kpiDepensesAnnuelles appelle _buildJournalReleve([cpt_<id>], [cycle courant … Décembre]) — donc le tooltip et le popup RELEVÉ DE COMPTES lisent la MÊME source mathématique. L'atterrissage affiché dans la Topbar est au centime celui de la ligne 🏁 Atterrissage Projeté du journal de Décembre."
        ] },
`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log(`✅ v32.70 appliquée — ${before} → ${s.length} octets (+${s.length - before})`);
