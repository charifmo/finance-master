# -*- coding: utf-8 -*-
"""
v37.35 Virements-Visibles — les virements internes bougent enfin les soldes ; un
mois fermé du Calendrier dit ce qu'il contient.

  1. LES VIREMENTS INTERNES ÉTAIENT DES FANTÔMES. Le Calendrier pluriannuel les
     saisit (« 60 000 de l'Épargne Long Terme vers les Dépenses annuelles, en
     novembre »), mais le moteur du Relevé (_buildJournalReleve) ne les lisait
     jamais : ni le Relevé, ni l'atterrissage du cycle, ni le radar, ni la Météo,
     ni le KPI « Dépenses annuelles » ne bougeaient. Désormais chaque virement du
     cycle génère DEUX jambes : une sortie sur le compte source, une entrée sur le
     compte destination, le même jour.
       • Cycle : la règle des flux exceptionnels — sans jour, un virement du mois M
         appartient au cycle M (getVirementsCycle).
       • Jour : le sien s'il en a un, sinon le 20 comme un flux exceptionnel sans
         jour — et AVANT les chocs du même jour : un virement finance ce qu'on paie
         avec, le radar ne doit pas voir un découvert qui n'existera pas.
       • Pointé : déjà dans les deux soldes, il n'est plus projeté (règle v37.34).
         Pour pouvoir le pointer, chaque virement du cycle rejoint la checklist,
         tiroir « 💎 Épargne & virements ».

  2. UN MOIS FERMÉ DIT CE QU'IL CONTIENT. L'en-tête d'un mois du Calendrier
     n'affichait que la somme NETTE des flux exceptionnels, et seulement si elle
     était positive : un mois avec un seul virement (octobre) ou une seule entrée
     restait muet. Il affiche désormais les sorties (rouge), les entrées
     (« + », vert) et le nombre de virements (« 1 Virement ») — chacun seulement
     s'il existe.
"""
import io, sys
F = 'index.html'
src = io.open(F, encoding='utf-8').read()
edits = []
def sub(label, anchor, replacement, expected=1):
    n = src.count(anchor)
    if n != expected:
        print(f'✖ {label} : {n} ancre(s), {expected} attendue(s)'); sys.exit(1)
    edits.append((anchor, replacement, expected))

# ══ 1. Les virements d'un CYCLE, et le résumé d'un mois du Calendrier ══════════
sub('getVirementsCycle + résumé des mois', r"""                    const getVirementsMois = (m, a) => (donneesAnnuelles.value[a]?.virementsInternes || []).filter(v => v.mois === m);
""", r"""                    const getVirementsMois = (m, a) => (donneesAnnuelles.value[a]?.virementsInternes || []).filter(v => v.mois === m);
                    //  v37.35 : les virements d'un CYCLE, avec la règle des flux exceptionnels —
                    //  sans jour, un virement du mois M appartient au cycle M ; avec un jour au
                    //  moins égal au jour de paie, au cycle suivant (il tombe après la paie).
                    const getVirementsCycle = (cycleM, cycleA) => {
                        const jdp = jourDePaie.value;
                        const mPrev = cycleM === 1 ? 12 : cycleM - 1, aPrev = cycleM === 1 ? cycleA - 1 : cycleA;
                        const de = (a) => (donneesAnnuelles.value[a]?.virementsInternes || []);
                        return de(cycleA).filter(v => Number(v.mois) === cycleM && (!v.jourPrevu || Number(v.jourPrevu) < jdp))
                            .concat(de(aPrev).filter(v => Number(v.mois) === mPrev && v.jourPrevu && Number(v.jourPrevu) >= jdp));
                    };
                    //  v37.35 : ce que contient un mois du Calendrier, lisible mois FERMÉ —
                    //  les sorties, les entrées, et les virements (qui ne sont ni l'un ni l'autre).
                    const resumesMois = computed(() => {
                        calculationTick.value;
                        const an = anneeAffichage.value, out = {};
                        for (let m = 1; m <= 12; m++) {
                            const deps = getDepensesMois(m, an), virs = getVirementsMois(m, an);
                            out[m] = {
                                sorties: Math.round(deps.reduce((s, d) => s + Math.max(0, Number(d.montant) || 0), 0)),
                                entrees: Math.round(deps.reduce((s, d) => s + Math.max(0, -(Number(d.montant) || 0)), 0)),
                                virements: virs.length,
                                montantVirements: Math.round(virs.reduce((s, v) => s + Math.abs(Number(v.montant) || 0), 0)),
                            };
                        }
                        return out;
                    });
""")

# ══ 2. Le moteur du Relevé : deux jambes par virement ══════════════════════════
sub('relevé : virements internes', r"""                            // ===== CHOCS EXCEPTIONNELS : DÉTAILLÉS ligne par ligne (créances via assurances_tracker) =====
                            getDepensesCycle(m, a).forEach(dep => {""", r"""                            // ===== v37.35 VIREMENTS INTERNES : DEUX jambes, le même jour — une sortie sur la
                            //   source, une entrée sur la destination. Jusqu'ici le Relevé les ignorait : un
                            //   virement de 60 000 de l'Épargne LT vers les Dépenses annuelles ne bougeait
                            //   aucun solde. Pointé (fait), il est déjà dans les deux soldes : plus projeté.
                            //   Sans jour : le 20, comme un flux exceptionnel sans jour — et AVANT les chocs
                            //   du même jour, puisqu'il finance ce qu'on paie avec.
                            getVirementsCycle(m, a).forEach(vir => {
                                const due = Math.abs(Number(vir.montant) || 0); if (!due) return;
                                const _vs = _normKey(vir.sourceCompte || 'courant'), _vd = _normKey(vir.destinationCompte || 'courant');
                                if (_vs === _vd) return;
                                let amt;
                                if (isItemPaid(vir, due, _cyc)) amt = 0; else { const r = due - (getPaidAmount(vir, due, _cyc) || 0); amt = r > 0 ? r : 0; }
                                amt = Math.round(amt * 100) / 100;
                                if (amt <= 0) return;
                                const _vj = Number(vir.jourPrevu || 20);
                                out.push({ account: _vs, libelle: '🔄 Virement → ' + getNomCompte(vir.destinationCompte || 'courant'), montant: amt, type: 'debit', jourPrevu: _vj, internal: true });
                                out.push({ account: _vd, libelle: '🔄 Virement reçu ← ' + getNomCompte(vir.sourceCompte || 'courant'), montant: amt, type: 'credit', jourPrevu: _vj, internal: true });
                            });

                            // ===== CHOCS EXCEPTIONNELS : DÉTAILLÉS ligne par ligne (créances via assurances_tracker) =====
                            getDepensesCycle(m, a).forEach(dep => {""")

# ══ 3. La checklist : un virement du cycle se pointe, avec l'épargne ═══════════
sub('checklist : virements', r"""                        epargneBudgetairePilotage.value.forEach(ep =>
                            pousser(ep, ep.nom || ep.label || 'Épargne', getDueFixe(ep, an, moisBud), 'Épargne', '💎', 'purple', ep.jourPrevu, 'epargne'));
""", r"""                        epargneBudgetairePilotage.value.forEach(ep =>
                            pousser(ep, ep.nom || ep.label || 'Épargne', getDueFixe(ep, an, moisBud), 'Épargne', '💎', 'purple', ep.jourPrevu, 'epargne'));
                        //  v37.35 : les virements internes du cycle se pointent avec l'épargne — faits,
                        //  ils sont dans les deux soldes et le Relevé ne les projette plus.
                        getVirementsCycle(pilotageViewedMois.value, pilotageViewedAn.value).forEach(vir => {
                            const s = cleDeCompte(vir.sourceCompte || 'courant'), d = cleDeCompte(vir.destinationCompte || 'courant');
                            if (s === d) return;
                            const n = out.length;
                            pousser(vir, 'Virement ' + infoCompte(s).tag + ' → ' + infoCompte(d).tag, Math.abs(Number(vir.montant) || 0),
                                    'Virement', '🔄', 'purple', vir.jourPrevu, 'epargne');
                            if (out.length > n) out[n].badge = '🔄 Virement';
                        });
""")

# ══ 4. L'en-tête d'un mois du Calendrier ═══════════════════════════════════════
sub('en-tête de mois', r"""                            <div @click="toggleMois(moisNum)" class="bg-gray-50 px-6 py-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors border-b border-gray-100">
                                <h3 class="font-black text-gray-700 uppercase tracking-widest text-sm">Mois {{ moisNum }} - {{ nomDuMois(moisNum) }} {{ anneeAffichage }}</h3>
                                <span v-if="totalMoisAffichage(moisNum) > 0" class="text-sm font-black text-red-600 bg-red-100 px-4 py-1.5 rounded-full shadow-inner">{{ formatMAD(totalMoisAffichage(moisNum)) }}</span>
                            </div>""", r"""                            <div @click="toggleMois(moisNum)" class="bg-gray-50 px-6 py-4 flex justify-between items-center gap-3 cursor-pointer hover:bg-gray-100 transition-colors border-b border-gray-100">
                                <h3 class="font-black text-gray-700 uppercase tracking-widest text-sm">Mois {{ moisNum }} - {{ nomDuMois(moisNum) }} {{ anneeAffichage }}</h3>
                                <!-- v37.35 : ce que contient le mois, même fermé — sorties, entrées, virements -->
                                <span class="flex flex-wrap items-center justify-end gap-1.5" data-mois-resume :data-mois="moisNum">
                                    <span v-if="resumesMois[moisNum].sorties > 0" data-mois-sorties class="text-sm font-black text-red-600 bg-red-100 px-4 py-1.5 rounded-full shadow-inner whitespace-nowrap">{{ formatMAD(resumesMois[moisNum].sorties) }}</span>
                                    <span v-if="resumesMois[moisNum].entrees > 0" data-mois-entrees class="text-sm font-black text-green-700 bg-green-100 px-3 py-1.5 rounded-full shadow-inner whitespace-nowrap">+ {{ formatMAD(resumesMois[moisNum].entrees) }}</span>
                                    <span v-if="resumesMois[moisNum].virements > 0" data-mois-virements :title="formatMAD(resumesMois[moisNum].montantVirements) + ' transférés entre vos comptes'"
                                          class="text-sm font-black text-indigo-700 bg-indigo-100 px-3 py-1.5 rounded-full shadow-inner whitespace-nowrap">🔄 {{ resumesMois[moisNum].virements }} Virement{{ resumesMois[moisNum].virements > 1 ? 's' : '' }}</span>
                                </span>
                            </div>""")

# ══ 5. Exports ═════════════════════════════════════════════════════════════════
sub('exports', r"""                        getVirementsMois, ajouterVirementInterne, supprimerVirementInterne,""",
    r"""                        getVirementsMois, getVirementsCycle, resumesMois, ajouterVirementInterne, supprimerVirementInterne,""")

for a, r, n in edits: src = src.replace(a, r, n)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ {len(edits)} modifications appliquées à {F}')
