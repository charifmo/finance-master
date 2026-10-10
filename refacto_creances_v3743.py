# -*- coding: utf-8 -*-
"""
v37.43 Creances-Encaissees — « Il ne faut pas mettre ceux déjà validés comme en
attente sur le journal, mais comme déjà encaissés ! C'est ceux qui sont
justement en attente qu'il faut attendre. »

Le tracker des créances (remboursements Wafa Assurance, Inwi…) avait la règle à
l'envers : une créance COCHÉE ✓ (« Déclaré ») était projetée comme une rentrée À
VENIR dans le journal — alors qu'une fois cochée, l'argent est déjà sur le compte,
donc déjà dans le solde d'aujourd'hui : elle était comptée deux fois. Et les
créances EN ATTENTE (○), les seules qu'on attend vraiment, n'apparaissaient nulle
part.

  ✓ ENCAISSÉE (remboursement:true) : déjà dans le solde réel → plus jamais
    projetée, ni dans le journal, ni dans le bilan (patrimoine projeté).
  ○ EN ATTENTE (remboursement:false) : rentrée attendue, créditée au compte de
    dépôt à sa date de remboursement prévue, dans le cycle budgétaire de cette
    date (v37.15). Date passée sans encaissement : elle reste attendue —
    « en retard », portée au jour d'aujourd'hui dans le cycle en cours. Sans
    date : attendue dans le cycle en cours, au jour de paie.

Un seul évaluateur (etatCreance) pour le journal, le bilan et l'écran.
"""
import io, sys

def patch(F, pairs):
    src = io.open(F, encoding='utf-8').read()
    for label, a, b in pairs:
        n = src.count(a)
        if n != 1:
            print(f'✖ {F} — {label} : {n} ancre(s), 1 attendue'); sys.exit(1)
    for label, a, b in pairs: src = src.replace(a, b, 1)
    io.open(F, 'w', encoding='utf-8').write(src)
    print(f'✔ {len(pairs)} modification(s) appliquée(s) à {F}')

patch('index.html', [
# ── 1. L'évaluateur unique ────────────────────────────────────────────────────
('évaluateur etatCreance', """                    const _aujourdhuiISO = () => {
                        const d = new Date();
                        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
                             + '-' + String(d.getDate()).padStart(2, '0');
                    };
""", """                    const _aujourdhuiISO = () => {
                        const d = new Date();
                        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
                             + '-' + String(d.getDate()).padStart(2, '0');
                    };

                    /*  v37.43 — L'ÉTAT D'UNE CRÉANCE (assurances_tracker), lu par le journal,
                        le bilan et l'écran. La case cochée ✓ veut dire ENCAISSÉE : l'argent
                        est déjà sur le compte, donc dans le solde d'aujourd'hui — elle n'est
                        plus jamais projetée. Ce sont les créances EN ATTENTE (○) qu'on
                        attend : elles sont inscrites au journal à leur date de remboursement
                        prévue ; passée cette date sans encaissement, elles restent attendues,
                        « en retard ». La date est lue telle qu'écrite (AAAA-MM-JJ), sans
                        passer par un fuseau horaire. */
                    const etatCreance = (c) => {
                        const encaissee = !!(c && c.remboursement);
                        const montant = Math.round(Number((c && (c.montantRembourse || c.montant)) || 0) * 100) / 100;
                        const d = /^(\\d{4})-(\\d{2})-(\\d{2})/.exec(String((c && c.dateRemboursement) || ''));
                        const date = d ? { j: Number(d[3]), m: Number(d[2]), a: Number(d[1]), iso: d[0] } : null;
                        const retard = !encaissee && !!date && date.iso < _aujourdhuiISO();
                        return { encaissee, montant, date, retard, enAttente: !encaissee,
                                 dateFr: date ? d[3] + '/' + d[2] + '/' + d[1] : '' };
                    };
"""),
# ── 2. Le journal : seules les créances EN ATTENTE sont projetées ─────────────
('journal : créances en attente', """                            // ===== CRÉANCES DÉCLARÉES : assurances_tracker (remboursement:true) — INJECTION UNIVERSELLE =====
                            // v26.70 : zéro filtrage catégorie — toutes créances Déclarées incluses.
                            // Si dateRemboursement absente → injection de secours dans le cycle courant.
                            (_si.assurances_tracker || []).forEach(c => {
                                if (!c.remboursement) return; // seules les créances "Déclaré" cochées
                                // Routage cycle : dateRemboursement si définie, sinon cycle courant (secours)
                                //  v37.15 : la date de remboursement est CALENDAIRE, le
                                //  cycle est BUDGÉTAIRE. Une créance du 28 septembre avec
                                //  une paie le 27 appartient au cycle « 27 sep → 26 oct »,
                                //  soit le mois budgétaire d'octobre — pas à septembre.
                                let _cycleM = curM, _cycleA = curA, _jourPrevu = jdp;
                                if (c.dateRemboursement) {
                                    const _dr = new Date(c.dateRemboursement);
                                    _jourPrevu = _dr.getDate();
                                    const _cyb = cycleBudgetaireDe(_jourPrevu, _dr.getMonth() + 1, _dr.getFullYear());
                                    _cycleM = _cyb.mois; _cycleA = _cyb.an;
                                }
                                if (_cycleM !== m || _cycleA !== a) return; // filtre cycle exact
                                const amt = Math.round(Number(c.montantRembourse || c.montant || 0) * 100) / 100;
                                if (amt <= 0) return;
                                const _compteTarget = _normKey(c.compteDepot || 'courant'); // routage dynamique : compteDepot → courant par défaut
                                const _lbl = '💰 Créance : ' + (c.libelle || [c.assureur, c.type].filter(Boolean).join(' ') || 'Remboursement');
                                out.push({ account: _compteTarget, libelle: _lbl, montant: amt, type: 'credit', jourPrevu: _jourPrevu, internal: false });
                            });""",
 """                            // ===== v37.43 CRÉANCES EN ATTENTE : assurances_tracker — les SEULES qu'on attend =====
                            //   ✓ encaissée (remboursement:true) : déjà dans le solde d'aujourd'hui → jamais
                            //     projetée (même règle que tout flux pointé, v37.34). Jusqu'ici c'était
                            //     l'inverse : les créances cochées revenaient en rentrée à venir, comptées
                            //     deux fois, et celles en attente n'apparaissaient nulle part.
                            //   ○ en attente : créditée au compte de dépôt à sa date de remboursement prévue,
                            //     dans le cycle BUDGÉTAIRE de cette date (v37.15 : une créance du 28 sept.
                            //     avec une paie le 27 appartient au cycle d'octobre). Date passée : toujours
                            //     attendue, « en retard », au jour d'aujourd'hui du cycle en cours. Sans date :
                            //     dans le cycle en cours, au jour de paie.
                            (_si.assurances_tracker || []).forEach(c => {
                                const ec = etatCreance(c);
                                if (ec.encaissee || ec.montant <= 0) return;
                                let _cycleM = curM, _cycleA = curA, _jourPrevu = jdp;
                                if (ec.retard) _jourPrevu = new Date().getDate();
                                else if (ec.date) {
                                    const _cyb = cycleBudgetaireDe(ec.date.j, ec.date.m, ec.date.a);
                                    _cycleM = _cyb.mois; _cycleA = _cyb.an; _jourPrevu = ec.date.j;
                                }
                                if (_cycleM !== m || _cycleA !== a) return; // filtre cycle exact
                                const _compteTarget = _normKey(c.compteDepot || 'courant'); // routage dynamique : compteDepot → courant par défaut
                                const _lbl = '💰 Créance ' + (ec.retard ? 'en retard (attendue le ' + ec.dateFr + ')' : 'attendue') + ' : '
                                           + (c.libelle || [c.assureur, c.type].filter(Boolean).join(' ') || 'Remboursement');
                                out.push({ account: _compteTarget, libelle: _lbl, montant: ec.montant, type: 'credit', jourPrevu: _jourPrevu, internal: false });
                            });"""),
# ── 3. Le bilan : même règle (il part des soldes RÉELS d'aujourd'hui) ─────────
('bilan : créances en attente', """                        // ── v28.30 : INJECTION DES CRÉANCES (assurances_tracker) — alignement bilan ↔ journal ──
                        // Le journal crédite chaque créance Déclarée (remboursement:true) à son compteDepot.
                        // Le bilan les ignorait → divergence (patrimoine projeté faux de la somme des créances).
                        // On crédite ici, en CUMULATIF, à partir du mois de remboursement (même logique forward,
                        // même résolution _normKey que journalHybridePourReleve).
                        (function _injectCreancesBilan() {
                            const _creances = (soldesInitiaux.value.assurances_tracker || [])
                                .filter(c => c && c.remboursement)
                                .map(c => {
                                    let cm = moisActuel, ca = anneeActuelle; // secours : cycle courant si pas de date
                                    if (c.dateRemboursement) { const dr = new Date(c.dateRemboursement); if (!isNaN(dr.getTime())) { cm = dr.getMonth() + 1; ca = dr.getFullYear(); } }
                                    const amt = Math.round(Number(c.montantRembourse || c.montant || 0) * 100) / 100;
                                    const tgt = _normKey(c.compteDepot || 'courant');
                                    return { idx: ca * 12 + cm, amt, tgt };
                                })
                                .filter(c => c.amt > 0);""",
 """                        // ── v28.30 / v37.43 : INJECTION DES CRÉANCES EN ATTENTE (assurances_tracker) — alignement bilan ↔ journal ──
                        // Le bilan part des soldes RÉELS d'aujourd'hui : une créance encaissée (✓) y est déjà —
                        // la créditer encore la comptait deux fois (v37.43). Seules les créances EN ATTENTE (○)
                        // sont créditées à leur compteDepot, en CUMULATIF, à partir du mois de remboursement
                        // prévu ; en retard ou sans date, dès le mois en cours (même règle que journalHybridePourReleve).
                        (function _injectCreancesBilan() {
                            const _creances = (soldesInitiaux.value.assurances_tracker || [])
                                .filter(c => c && etatCreance(c).enAttente)
                                .map(c => {
                                    const ec = etatCreance(c);
                                    let cm = moisActuel, ca = anneeActuelle; // en retard ou sans date : dès le mois en cours
                                    if (ec.date && !ec.retard) { cm = ec.date.m; ca = ec.date.a; }
                                    const tgt = _normKey(c.compteDepot || 'courant');
                                    return { idx: ca * 12 + cm, amt: ec.montant, tgt };
                                })
                                .filter(c => c.amt > 0);"""),
# ── 4. L'écran : ✓ = encaissée, ○ = en attente ────────────────────────────────
('écran : KPI encaissé', """                                        <p class="text-[8px] font-black uppercase tracking-widest text-blue-600">💰 À recouvrer</p>
                                        <p class="text-base font-black text-blue-700 mt-1">{{ formatMAD(assurancesStats.totalAttendu) }}</p>
                                        <p class="text-[8px] text-blue-400 font-bold">remb. attendus</p>
                                    </div>
                                    <div class="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                                        <p class="text-[8px] font-black uppercase tracking-widest text-green-600">✅ Déclaré</p>
                                        <p class="text-base font-black text-green-700 mt-1">{{ formatMAD(assurancesStats.totalRembourse) }}</p>
                                        <p class="text-[8px] text-green-400 font-bold">flux injectés</p>
                                    </div>
                                    <div class="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
                                        <p class="text-[8px] font-black uppercase tracking-widest text-orange-600">⏳ Non déclaré</p>
                                        <p class="text-base font-black text-orange-700 mt-1">{{ formatMAD(assurancesStats.enAttente) }}</p>
                                        <p class="text-[8px] text-orange-400 font-bold">coût net restant</p>""",
 """                                        <p class="text-[8px] font-black uppercase tracking-widest text-blue-600">💰 À recouvrer</p>
                                        <p class="text-base font-black text-blue-700 mt-1" data-assur-attendu>{{ formatMAD(assurancesStats.totalAttendu) }}</p>
                                        <p class="text-[8px] text-blue-400 font-bold">en attente — inscrits au journal</p>
                                    </div>
                                    <div class="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                                        <p class="text-[8px] font-black uppercase tracking-widest text-green-600">✅ Encaissé</p>
                                        <p class="text-base font-black text-green-700 mt-1" data-assur-encaisse>{{ formatMAD(assurancesStats.totalRembourse) }}</p>
                                        <p class="text-[8px] text-green-400 font-bold">déjà dans le solde</p>
                                    </div>
                                    <div class="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
                                        <p class="text-[8px] font-black uppercase tracking-widest text-orange-600">⏳ Avancé</p>
                                        <p class="text-base font-black text-orange-700 mt-1">{{ formatMAD(assurancesStats.enAttente) }}</p>
                                        <p class="text-[8px] text-orange-400 font-bold">dépenses pas encore remboursées</p>"""),
('écran : ligne de créance', """                                    <div v-for="item in assurancesTracker" :key="item.id"
                                        :class="['flex items-start gap-3 p-3 rounded-xl border transition-all', item.remboursement ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:border-blue-200']">
                                        <!-- Toggle déclaré -->
                                        <button @click="toggleAssuranceRembourse(item)"
                                            :class="['flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-black text-sm transition-all shadow-sm', item.remboursement ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-blue-100 hover:text-blue-600']"
                                            :title="item.remboursement ? 'Annuler la déclaration (retire du cash-flow)' : 'Déclarer le remboursement (injecte dans cash-flow)'">""",
 """                                    <div v-for="item in assurancesTracker" :key="item.id" data-assur-ligne :data-assur-etat="item.remboursement ? 'encaissee' : 'attente'"
                                        :class="['flex items-start gap-3 p-3 rounded-xl border transition-all', item.remboursement ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:border-blue-200']">
                                        <!-- v37.43 : ✓ = remboursement ENCAISSÉ (déjà dans le solde) ; ○ = EN ATTENTE (attendu au journal) -->
                                        <button @click="toggleAssuranceRembourse(item)" data-assur-toggle
                                            :class="['flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-black text-sm transition-all shadow-sm', item.remboursement ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-blue-100 hover:text-blue-600']"
                                            :title="item.remboursement ? 'Remettre en attente (le remboursement n\\'est pas encore arrivé : il redevient attendu dans le journal)' : 'Marquer comme encaissé (le remboursement est arrivé sur le compte : il sort du journal à venir)'">"""),
('écran : badge', """                                                <span v-if="item.remboursement" class="text-[9px] font-black px-2 py-0.5 bg-green-200 text-green-800 rounded-full uppercase tracking-widest">📋 Déclaré</span>
                                                <span v-else class="text-[9px] font-bold px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">⏳ En attente</span>""",
 """                                                <span v-if="item.remboursement" data-assur-badge class="text-[9px] font-black px-2 py-0.5 bg-green-200 text-green-800 rounded-full uppercase tracking-widest">💰 Encaissé</span>
                                                <span v-else-if="etatCreance(item).retard" data-assur-badge class="text-[9px] font-black px-2 py-0.5 bg-red-100 text-red-700 rounded-full">⏰ En retard</span>
                                                <span v-else data-assur-badge class="text-[9px] font-bold px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">⏳ En attente</span>"""),
('écran : mention', """                                            <p v-if="item.remboursement" class="text-[9px] text-green-600 font-bold mt-0.5">✔ Créance déclarée — visible directement dans le journal prévisionnel (aucune action supplémentaire requise)</p>""",
 """                                            <p v-if="item.remboursement" data-assur-mention class="text-[9px] text-green-600 font-bold mt-0.5">✔ Remboursement encaissé — déjà compté dans le solde du compte : il ne figure plus dans le journal à venir</p>
                                            <p v-else data-assur-mention :class="['text-[9px] font-bold mt-0.5', etatCreance(item).retard ? 'text-red-600' : 'text-blue-600']">{{ etatCreance(item).retard
                                                ? '⏰ Attendu le ' + etatCreance(item).dateFr + ', toujours pas encaissé — reste attendu dans le journal, à aujourd\\'hui. Cochez ✓ dès qu\\'il arrive sur le compte.'
                                                : (etatCreance(item).date ? '⏳ Attendu le ' + etatCreance(item).dateFr + ' — inscrit dans le journal prévisionnel. Cochez ✓ quand il arrive sur le compte.'
                                                                          : '⏳ Sans date prévue — attendu dans le cycle en cours. Cochez ✓ quand il arrive sur le compte.') }}</p>"""),
('toggle : commentaire', """                    const toggleAssuranceRembourse = (item) => {
                        item.remboursement = !item.remboursement;""",
 """                    //  v37.43 : cocher = le remboursement est ENCAISSÉ (il sort du journal à venir :
                    //  il est dans le solde) ; décocher = il redevient attendu.
                    const toggleAssuranceRembourse = (item) => {
                        item.remboursement = !item.remboursement;"""),
('exposition au gabarit', """                        assurancesTracker, assurancesStats, newAssurance, showAssuranceForm, editingAssuranceId, editAssurance, annulerEditionAssurance, ajouterAssurance, toggleAssuranceRembourse, supprimerAssurance, onAssuranceMontantInput, onAssuranceDateDepotChange,""",
 """                        assurancesTracker, assurancesStats, newAssurance, showAssuranceForm, editingAssuranceId, editAssurance, annulerEditionAssurance, ajouterAssurance, toggleAssuranceRembourse, supprimerAssurance, onAssuranceMontantInput, onAssuranceDateDepotChange, etatCreance,"""),
])
