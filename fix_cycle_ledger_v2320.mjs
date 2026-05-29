import { readFileSync, writeFileSync } from 'fs';

const filePath = 'C:/Users/HP/finance/index.html';
let html = readFileSync(filePath, 'utf8');
html = html.replace(/\r\n/g, '\n');

let ops = 0;
const check = (label, ok) => {
    if (!ok) { console.error('❌ ' + label); process.exit(1); }
    ops++;
    console.log('✅ ' + label);
};

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 1 : Ajouter releveActiveCycle ref après releveModeEvolution
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_MODE_EVOL = `const releveModeEvolution = ref(false); // true = n'afficher que l'évolution des soldes`;
const NEW_MODE_EVOL = `const releveModeEvolution = ref(false); // true = n'afficher que l'évolution des soldes
                    const releveActiveCycle = ref(null); // v23.20 : "6-2026" = Cycle Juin 2026, null = tout`;
check('Op1 releveActiveCycle ref', html.includes(OLD_MODE_EVOL));
html = html.replace(OLD_MODE_EVOL, NEW_MODE_EVOL);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 2 : Ajouter cyclesDisponibles computed entre releveMoisDisponibles et releveCompte
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_MOIS_DISPO_END = `                    const releveMoisDisponibles = computed(() => {
                        const moisNoms = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
                        return moisNoms.slice(1).map((nom, i) => ({ num: i + 1, nom }));
                    });
                    const releveCompte = computed(() => {`;
const NEW_MOIS_DISPO_END = `                    const releveMoisDisponibles = computed(() => {
                        const moisNoms = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
                        return moisNoms.slice(1).map((nom, i) => ({ num: i + 1, nom }));
                    });
                    // v23.20 Cycle-Ledger : cycles de paie disponibles dans le journal
                    const cyclesDisponibles = computed(() => {
                        const _mN = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
                        const _mC = ['', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jui', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
                        const jdp = Number((soldesInitiaux.value || {}).jourDePaie) || 27;
                        const j = bilanJournal.value;
                        const seen = new Set();
                        Object.values(j).forEach(entries => entries.forEach(e => {
                            if (e.mois && e.mois !== '—') {
                                const parts = e.mois.split(' ');
                                if (parts.length === 2) {
                                    const idx = _mN.indexOf(parts[0]);
                                    const an = Number(parts[1]);
                                    if (idx > 0 && an > 0) seen.add(idx + '-' + an);
                                }
                            }
                        }));
                        const cycles = [];
                        [...seen].forEach(key => {
                            const [mStr, aStr] = key.split('-');
                            const m = Number(mStr), a = Number(aStr);
                            const mPrev = m === 1 ? 12 : m - 1;
                            const aPrev = m === 1 ? a - 1 : a;
                            cycles.push({
                                key, mois: m, an: a, moisPrev: mPrev, anPrev: aPrev,
                                nom: _mN[m] + ' ' + a,
                                label: 'Cycle ' + _mN[m] + ' (' + jdp + ' ' + _mC[mPrev] + ' → ' + (jdp - 1) + ' ' + _mC[m] + ')'
                            });
                        });
                        cycles.sort((x, y) => x.an !== y.an ? x.an - y.an : x.mois - y.mois);
                        return cycles;
                    });
                    const releveCompte = computed(() => {`;
check('Op2 cyclesDisponibles computed', html.includes(OLD_MOIS_DISPO_END));
html = html.replace(OLD_MOIS_DISPO_END, NEW_MOIS_DISPO_END);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 3 : releveCompte — override aFs/mFs selon le cycle actif
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_RELEVE_AFS = `                        const aFs = releveAnneesFiltres.value;
                        const mFs = releveMoisFiltres.value;
                        const isGlobal = isGlobalView.value; // true quand 0 comptes sélectionnés`;
const NEW_RELEVE_AFS = `                        let aFs = releveAnneesFiltres.value;
                        let mFs = releveMoisFiltres.value;
                        // v23.20 : si un cycle est sélectionné, dériver aFs/mFs depuis le cycle
                        const _acRel = releveActiveCycle.value;
                        if (_acRel) {
                            const _cd = cyclesDisponibles.value.find(c => c.key === _acRel);
                            if (_cd) {
                                aFs = [...new Set([_cd.an, _cd.anPrev])];
                                mFs = [...new Set([_cd.mois, _cd.moisPrev])];
                            }
                        }
                        const isGlobal = isGlobalView.value; // true quand 0 comptes sélectionnés`;
check('Op3 releveCompte aFs cycle override', html.includes(OLD_RELEVE_AFS));
html = html.replace(OLD_RELEVE_AFS, NEW_RELEVE_AFS);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 4 : releveEvolution — override aFs/mFs selon le cycle actif
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_EVOL_AFS = `                        const aFs = releveAnneesFiltres.value;
                        const mFs = releveMoisFiltres.value;
                        const onglets = releveOnglets.value;`;
const NEW_EVOL_AFS = `                        let aFs = releveAnneesFiltres.value;
                        let mFs = releveMoisFiltres.value;
                        // v23.20 : cycle override pour mode évolution
                        const _acEv = releveActiveCycle.value;
                        if (_acEv) {
                            const _cdEv = cyclesDisponibles.value.find(c => c.key === _acEv);
                            if (_cdEv) {
                                aFs = [...new Set([_cdEv.an, _cdEv.anPrev])];
                                mFs = [...new Set([_cdEv.mois, _cdEv.moisPrev])];
                            }
                        }
                        const onglets = releveOnglets.value;`;
check('Op4 releveEvolution aFs cycle override', html.includes(OLD_EVOL_AFS));
html = html.replace(OLD_EVOL_AFS, NEW_EVOL_AFS);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 5 : ouvrirReleve — reset releveActiveCycle
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_OUVRIR_RELEVE = `                        releveMoisFiltres.value = [];
                        releveAnneesFiltres.value = [];
                        showReleveModal.value = true;`;
const NEW_OUVRIR_RELEVE = `                        releveMoisFiltres.value = [];
                        releveAnneesFiltres.value = [];
                        releveActiveCycle.value = null;
                        showReleveModal.value = true;`;
check('Op5 ouvrirReleve reset cycle', html.includes(OLD_OUVRIR_RELEVE));
html = html.replace(OLD_OUVRIR_RELEVE, NEW_OUVRIR_RELEVE);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 6 : Ajouter historiqueCycles + cloturerCycle après fermerReleve
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_FERMER_RELEVE = `                    const fermerReleve = () => {
                        showReleveModal.value = false;
                        compteReleve.value = null;
                        releveComptesFiltres.value = [];
                    };
                    // v17.41 : Années et mois disponibles dans le journal (pour les selects de filtre)`;
const NEW_FERMER_RELEVE = `                    const fermerReleve = () => {
                        showReleveModal.value = false;
                        compteReleve.value = null;
                        releveComptesFiltres.value = [];
                        releveActiveCycle.value = null;
                    };
                    // v23.20 Cycle-Ledger : archivage des cycles financiers
                    const historiqueCycles = ref((() => { try { return JSON.parse(localStorage.getItem('historiqueCycles') || '{}'); } catch(_) { return {}; } })());
                    const viewedCycleKey = ref(null);
                    const cloturerCycle = () => {
                        const jdp = Number((soldesInitiaux.value || {}).jourDePaie) || 27;
                        const now = new Date();
                        const m = now.getMonth() + 1;
                        const a = now.getFullYear();
                        const _mNoms = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
                        const key = m + '-' + a;
                        historiqueCycles.value[key] = {
                            clotureDate: now.toISOString(),
                            nom: 'Cycle ' + _mNoms[m] + ' ' + a,
                            jdp,
                            donneesAnnuelles: JSON.parse(JSON.stringify(donneesAnnuelles.value)),
                            comptes: JSON.parse(JSON.stringify(comptes.value)),
                            soldesInitiaux: JSON.parse(JSON.stringify(soldesInitiaux.value))
                        };
                        try { localStorage.setItem('historiqueCycles', JSON.stringify(historiqueCycles.value)); } catch(_) {}
                        addLog('Cycle ' + _mNoms[m] + ' ' + a + ' archivé avec succes.', 'success');
                    };
                    // v17.41 : Années et mois disponibles dans le journal (pour les selects de filtre)`;
check('Op6 fermerReleve + historiqueCycles', html.includes(OLD_FERMER_RELEVE));
html = html.replace(OLD_FERMER_RELEVE, NEW_FERMER_RELEVE);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 7 : Remplacer filtres Années+Mois dans INLINE relevé par timeline cycles
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_INLINE_FILTERS = `                                    <div class="flex items-center gap-1">
                                        <label class="text-[9px] font-black uppercase tracking-widest text-gray-400 mr-1">Années</label>
                                        <select multiple v-model="releveAnneesFiltres" size="2" class="text-xs font-bold border border-gray-300 rounded-lg px-2 py-1 bg-white outline-none focus:border-blue-500 cursor-pointer min-w-[68px]">
                                            <option v-for="a in releveAnneesDisponibles" :key="a" :value="a">{{ a }}</option>
                                        </select>
                                        <button @click.stop="releveAnneesFiltres = []" :class="releveAnneesFiltres.length === 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'" class="text-[9px] font-black px-1.5 py-1 rounded-lg transition-all whitespace-nowrap">Tout</button>
                                    </div>
                                    <div class="flex items-center gap-1">
                                        <label class="text-[9px] font-black uppercase tracking-widest text-gray-400 mr-1">Mois</label>
                                        <select multiple v-model="releveMoisFiltres" size="2" class="text-xs font-bold border border-gray-300 rounded-lg px-2 py-1 bg-white outline-none focus:border-blue-500 cursor-pointer min-w-[80px]">
                                            <option v-for="m in releveMoisDisponibles" :key="m.num" :value="m.num">{{ m.nom }}</option>
                                        </select>
                                        <button @click.stop="releveMoisFiltres = []" :class="releveMoisFiltres.length === 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'" class="text-[9px] font-black px-1.5 py-1 rounded-lg transition-all whitespace-nowrap">Tout</button>
                                    </div>`;
const NEW_INLINE_FILTERS = `                                    <!-- v23.20 : Timeline Cycles (remplace filtres Années+Mois) -->
                                    <div class="flex items-center gap-1.5 w-full">
                                        <button @click.stop="releveActiveCycle = null; releveAnneesFiltres = []; releveMoisFiltres = []"
                                            :class="releveActiveCycle === null ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
                                            class="text-[9px] font-black px-2 py-1.5 rounded-lg transition-all whitespace-nowrap shrink-0">Tout</button>
                                        <div class="flex gap-1 overflow-x-auto pb-0.5 flex-1" style="scrollbar-width:thin">
                                            <button v-for="cy in cyclesDisponibles" :key="cy.key" @click.stop="releveActiveCycle = cy.key"
                                                :class="releveActiveCycle === cy.key ? 'bg-indigo-600 text-white ring-2 ring-indigo-300' : 'bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'"
                                                class="text-[9px] font-black px-2 py-1.5 rounded-lg transition-all whitespace-nowrap shrink-0">
                                                {{ cy.label }}
                                            </button>
                                        </div>
                                    </div>`;
check('Op7 inline filter → cycle timeline', html.includes(OLD_INLINE_FILTERS));
html = html.replace(OLD_INLINE_FILTERS, NEW_INLINE_FILTERS);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 8 : Remplacer filtres Années+Mois dans MODAL relevé par timeline cycles
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_MODAL_FILTERS = `                            <div class="flex items-center gap-1">
                                <select multiple v-model="releveAnneesFiltres" size="2" class="text-xs font-bold border border-gray-300 rounded-lg px-2 py-1 bg-white outline-none focus:border-blue-500 cursor-pointer min-w-[68px]">
                                    <option v-for="a in releveAnneesDisponibles" :key="a" :value="a">{{ a }}</option>
                                </select>
                                <button @click="releveAnneesFiltres = []" :class="releveAnneesFiltres.length === 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'" class="text-[9px] font-black px-1.5 py-1 rounded-lg transition-all whitespace-nowrap" title="Toutes les années">Tout</button>
                            </div>
                            <div class="flex items-center gap-1">
                                <select multiple v-model="releveMoisFiltres" size="2" class="text-xs font-bold border border-gray-300 rounded-lg px-2 py-1 bg-white outline-none focus:border-blue-500 cursor-pointer min-w-[80px]">
                                    <option v-for="m in releveMoisDisponibles" :key="m.num" :value="m.num">{{ m.nom }}</option>
                                </select>
                                <button @click="releveMoisFiltres = []" :class="releveMoisFiltres.length === 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'" class="text-[9px] font-black px-1.5 py-1 rounded-lg transition-all whitespace-nowrap" title="Tous les mois">Tout</button>
                            </div>
                            <!-- Toggle Transactions / Évolution -->`;
const NEW_MODAL_FILTERS = `                            <!-- v23.20 : Timeline Cycles dans la modale -->
                            <div class="flex items-center gap-1.5 max-w-xs">
                                <button @click="releveActiveCycle = null; releveAnneesFiltres = []; releveMoisFiltres = []"
                                    :class="releveActiveCycle === null ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
                                    class="text-[9px] font-black px-2 py-1.5 rounded-lg transition-all whitespace-nowrap shrink-0">Tout</button>
                                <div class="flex gap-1 overflow-x-auto" style="scrollbar-width:thin;max-width:220px">
                                    <button v-for="cy in cyclesDisponibles" :key="cy.key" @click="releveActiveCycle = cy.key"
                                        :class="releveActiveCycle === cy.key ? 'bg-indigo-600 text-white ring-2 ring-indigo-300' : 'bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'"
                                        class="text-[9px] font-black px-2 py-1.5 rounded-lg transition-all whitespace-nowrap shrink-0">
                                        {{ cy.label }}
                                    </button>
                                </div>
                            </div>
                            <!-- Toggle Transactions / Évolution -->`;
check('Op8 modal filter → cycle timeline', html.includes(OLD_MODAL_FILTERS));
html = html.replace(OLD_MODAL_FILTERS, NEW_MODAL_FILTERS);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 9 : Ajouter bouton "💾 Clôturer le cycle" dans le header Pilotage
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_PILOTAGE_HEADER_END = `                                </div>
                            </div>
                        </div>

                        <!-- ⏳ v22.50 Jauge Cycle de Paie -->`;
const NEW_PILOTAGE_HEADER_END = `                                </div>
                                <!-- v23.20 : Clôture et archivage du cycle -->
                                <button @click="cloturerCycle()"
                                    class="text-[9px] font-black px-2 py-1.5 rounded-lg border border-slate-600 text-slate-400 hover:border-purple-500 hover:text-purple-300 transition-all whitespace-nowrap"
                                    title="Sauvegarder l etat du cycle dans l historique">
                                    💾 Clôturer
                                </button>
                            </div>
                        </div>

                        <!-- ⏳ v22.50 Jauge Cycle de Paie -->`;
check('Op9 cloture button in pilotage header', html.includes(OLD_PILOTAGE_HEADER_END));
html = html.replace(OLD_PILOTAGE_HEADER_END, NEW_PILOTAGE_HEADER_END);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 10 : return statement — exposer les nouveaux éléments
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_RETURN_RELEVE = `releveAnneesDisponibles, releveMoisDisponibles, releveModeEvolution, releveEvolution,`;
const NEW_RETURN_RELEVE = `releveAnneesDisponibles, releveMoisDisponibles, releveModeEvolution, releveEvolution, releveActiveCycle, cyclesDisponibles, historiqueCycles, viewedCycleKey, cloturerCycle,`;
check('Op10 return statement', html.includes(OLD_RETURN_RELEVE));
html = html.replace(OLD_RETURN_RELEVE, NEW_RETURN_RELEVE);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 11 : Changelog entry
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_CHANGELOG_ENTRY = `const CHANGELOG = [\n                        { version: "23.15 Relevé-Intégral",`;
const NEW_CHANGELOG_ENTRY = `const CHANGELOG = [\n                        { version: "23.20 Cycle-Ledger", date: "2026-05-29 — Journal par Cycle Financier", changes: [\n                            "CHANTIER 1 : releveCompte et releveEvolution filtrent maintenant par cycle de paie (M-1 + M) via releveActiveCycle.",\n                            "CHANTIER 2 : Sélecteur de timeline horizontal scrollable remplace les menus Années/Mois dans inline et modal.",\n                            "CHANTIER 3 : Bouton Cloturer le cycle dans le header Pilotage — snapshot complet sauvé dans historiqueCycles (localStorage)."\n                        ] },\n                        { version: "23.15 Relevé-Intégral",`;
check('Op11 changelog entry', html.includes(OLD_CHANGELOG_ENTRY));
html = html.replace(OLD_CHANGELOG_ENTRY, NEW_CHANGELOG_ENTRY);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 12 : Version bump → 23.20 Cycle-Ledger
// ═══════════════════════════════════════════════════════════════════════════════
check('Op12 version string', html.includes('"23.15 Relevé-Intégral"'));
html = html.replace('"23.15 Relevé-Intégral"', '"23.20 Cycle-Ledger"');

writeFileSync(filePath, html, 'utf8');
console.log(`\n🎉 Done — ${ops}/12 ops. Fichier écrit.`);
