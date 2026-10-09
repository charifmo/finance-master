# -*- coding: utf-8 -*-
"""
v37.36 Epargne-Du-Mois — la modale « Surplus Détaillé » montre l'épargne DU MOIS,
y compris celle qui est déjà versée.

  Le constat : deux objectifs d'épargne (2 000 + 5 000 par mois, exception de
  novembre à décembre à 3 000 + 2 000). Novembre et décembre affichent 5 000 ;
  octobre — sans exception — affiche 0 au lieu de 7 000.

  Le diagnostic (reproduit au dirham sur le banc) : le repli sur le montant de
  base fonctionne — rien coché, octobre affiche bien 7 000. Le 0 apparaît quand
  les deux virements d'octobre sont POINTÉS (faits) dans le Pilotage : pour le
  mois en cours, la colonne ne montrait que l'épargne RESTANT à verser. Or le
  brut du mois en cours part du solde RÉEL du Courant, d'où l'épargne versée
  est déjà sortie : la ligne ne se lisait plus « Brut − Épargne = Net », et une
  épargne faite ressemblait à une épargne oubliée. Le KPI « Épargne générée »
  (17 000 = 7 000 + 5 000 + 5 000) comptait, lui, octobre.

  La correction (surplusParMois) :
    • l'épargne d'un mois = la valeur de chaque objectif CE mois-là — son
      exception si une règle couvre le mois, sinon son montant de base — par
      l'évaluateur unique de l'application (valeurEffective), y compris pour le
      mois en cours ;
    • elle se décompose en « déjà versée » (pointée dans le Pilotage, avance
      partielle comprise) et « restant à verser » ;
    • le brut du mois en cours remet l'épargne déjà versée dans le solde réel
      (c'est un brut AVANT épargne) : Brut − Épargne = Net sur chaque ligne ;
    • le net ne change pas — sauf une avance partielle, jusque-là retirée deux
      fois (déjà sortie du solde réel, et soustraite encore en entier).
  La modale marque l'épargne versée d'un ✓ et le dit en une ligne.

  UN TRANSFERT N'EST PAS DE L'ÉPARGNE (signalé en cours de route) :
    • le KPI « Épargne générée » ajoutait à l'épargne toute charge fixe dont le
      libellé contenait « virement » (heuristique v17.13) — et à sa valeur brute,
      exceptions ignorées. « virement » sort des mots-clés ; la valeur du mois
      passe par l'évaluateur unique ;
    • dans la checklist, les virements internes (v37.35) étaient rangés sous la
      nature « épargne » et gonflaient la ligne « 💎 Épargne » de la Progression :
      ils ont désormais leur nature, leur tiroir (« 🔄 Virements internes ») et
      leur badge.
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

# ══ 1. Le moteur : l'épargne du mois, versée + à verser ════════════════════════
sub('surplusParMois : épargne du mois', r"""                            if (isPast) return { mNum, brut: null, epargne: null, surplusMensuel: null, net: null, isPast: true, isCurrent: false };
                            const mode = isCurrent ? 'remaining' : 'full';
                            const { entrants, sortants } = _getMonthFlux(mNum, anneeAffichage.value, mode);
                            // Épargne du mois
                            let ep = 0;
                            epArr.forEach(obj => {
                                let v = Number(obj.valeur || 0);
                                (obj.exceptions || []).forEach(e => { const md = Number(e.moisDebut||0), mf = Number(e.moisFin||0); if (md && mf && mNum >= md && mNum <= mf) v = Number(e.nouvelleValeur||0); });
                                if (mode === 'full' || !isItemPaid(obj, v)) ep += v;
                            });
                            // Surplus avant épargne = (entrées - sorties), + solde réel UNIQUEMENT pour le mois courant
                            const soldeDepart = isCurrent ? (tresoActuelleCourante.value || 0) : 0;
                            const brut = soldeDepart + entrants - sortants;  // Juin = atterrissage réel ; futurs = potentiel pur
                            const net  = brut - ep;                          // surplus final après épargne
                            const surplusMensuel = net;                      // pas de cumul entre les mois
                            return { mNum, brut, epargne: ep, surplusMensuel, net, isPast: false, isCurrent };""",
    r"""                            if (isPast) return { mNum, brut: null, epargne: null, epargneVersee: null, epargneRestante: null, surplusMensuel: null, net: null, isPast: true, isCurrent: false };
                            const mode = isCurrent ? 'remaining' : 'full';
                            const { entrants, sortants } = _getMonthFlux(mNum, anneeAffichage.value, mode);
                            /*  v37.36 — L'ÉPARGNE DU MOIS. Chaque objectif vaut, CE mois-là, son
                                exception si une règle le couvre, sinon son montant de base — par
                                l'évaluateur unique (valeurEffective). Au mois en cours, ce qui est
                                déjà POINTÉ (versé, avance comprise) est séparé du reste : la colonne
                                ne montre plus 0 pour une épargne faite. */
                            let ep = 0, epVersee = 0;
                            epArr.forEach(obj => {
                                const v = valeurEffective(obj, obj.valeur, mNum);
                                if (!(v > 0)) return;
                                ep += v;
                                if (isCurrent) epVersee += isItemPaid(obj, v) ? v : Math.min(v, Math.max(0, Number(getPaidAmount(obj, v)) || 0));
                            });
                            const epRestante = ep - epVersee;
                            //  Brut AVANT épargne. Au mois en cours il part du solde réel du Courant,
                            //  d'où l'épargne déjà versée est sortie : on l'y remet, pour que
                            //  Brut − Épargne = Net se lise sur chaque ligne.
                            const soldeDepart = isCurrent ? (tresoActuelleCourante.value || 0) + epVersee : 0;
                            const brut = soldeDepart + entrants - sortants;  // mois en cours = atterrissage réel ; futurs = potentiel intrinsèque pur
                            const net  = brut - ep;                          // surplus final après épargne (la versée ne sort qu'une fois)
                            const surplusMensuel = net;                      // pas de cumul entre les mois
                            return { mNum, brut, epargne: ep, epargneVersee: epVersee, epargneRestante: epRestante, surplusMensuel, net, isPast: false, isCurrent };""")

# ══ 2. La modale (bureau et téléphone) : ✓ sur l'épargne versée, une ligne pour le dire ══
for taille, label in (('9', 'bureau'), ('8', 'téléphone')):
    sub(f'modale ({label}) : cellule épargne',
        r"""<span class="text-[""" + taille + r"""px] font-black tabular-nums text-right text-purple-400 whitespace-nowrap">{{ row.epargne > 0 ? '-' : '' }}{{ formatMAD(row.epargne) }}</span>""",
        r"""<span class="text-[""" + taille + r"""px] font-black tabular-nums text-right text-purple-400 whitespace-nowrap" data-surplus-epargne :data-mois="row.mNum"
                                              :title="row.epargneVersee > 0 ? formatMAD(row.epargneVersee) + ' déjà versés (pointés dans le Pilotage)' + (row.epargneRestante > 0 ? ' · ' + formatMAD(row.epargneRestante) + ' à verser' : '') : null">{{ row.epargne > 0 ? '-' : '' }}{{ formatMAD(row.epargne) }}<span v-if="row.epargneVersee > 0" class="ml-0.5 text-emerald-400" data-surplus-epargne-versee>✓</span></span>""")
sub('modale (bureau) : note épargne versée', r"""                                    </div>
                                    </template>
                                </div>
                                <div class="grid grid-cols-[52px_1fr_1fr_1fr] px-3 py-2 border-t-2 border-gray-700 bg-gray-900/70 items-center">""",
    r"""                                    </div>
                                    </template>
                                </div>
                                <!-- v37.36 : l'épargne du mois en cours déjà versée, dite en clair -->
                                <p v-for="row in surplusParMois.filter(r => r.isCurrent && r.epargneVersee > 0)" :key="'ev_' + row.mNum" data-surplus-note-versee
                                   class="px-3 py-1.5 border-t border-gray-800 text-[9px] font-bold text-emerald-300/90 leading-snug">
                                    ✓ {{ nomDuMois(row.mNum) }} : {{ formatMAD(row.epargneVersee) }} d'épargne déjà versés. Sortis du solde réel, le brut les y remet ; le net ne les retire qu'une fois.
                                </p>
                                <div class="grid grid-cols-[52px_1fr_1fr_1fr] px-3 py-2 border-t-2 border-gray-700 bg-gray-900/70 items-center">""")
sub('modale (téléphone) : note épargne versée', r"""                                </div>
                                </template>
                            </div>
                            <div class="grid grid-cols-[44px_1fr_1fr_1fr] px-2 py-1.5 border-t-2 border-gray-700 bg-gray-900/70 items-center">""",
    r"""                                </div>
                                </template>
                            </div>
                            <p v-for="row in surplusParMois.filter(r => r.isCurrent && r.epargneVersee > 0)" :key="'evm_' + row.mNum" data-surplus-note-versee
                               class="px-2 py-1 border-t border-gray-800 text-[8px] font-bold text-emerald-300/90 leading-snug">
                                ✓ {{ nomDuMois(row.mNum) }} : {{ formatMAD(row.epargneVersee) }} d'épargne déjà versés (le brut les remet, le net les retire une fois).
                            </p>
                            <div class="grid grid-cols-[44px_1fr_1fr_1fr] px-2 py-1.5 border-t-2 border-gray-700 bg-gray-900/70 items-center">""")

# ══ 3. « Virement » ne veut pas dire « épargne » (KPI Épargne générée) ══════════
sub('bilan : mots-clés d\'épargne', r"""                            const _EPKW = /epargne|épargne|urgence|long.?terme|investissement|virement/i;
                            const _epFixes = Object.values(dataAnnee.chargesFixes || {}).reduce((sum, f) => _EPKW.test(f?.label || '') ? sum + Number((f || {}).valeur || 0) : sum, 0);""",
    r"""                            //  v37.36 : « virement » ne veut pas dire « épargne ». Une charge fixe « Virement
                            //  Assafa » déplace de l'argent d'un compte à l'autre, elle ne le met pas de côté :
                            //  le mot sort de la liste. Et la charge vaut, CE mois-là, son exception si elle en
                            //  a une (évaluateur unique) — plus sa valeur brute toute l'année.
                            const _EPKW = /epargne|épargne|urgence|long.?terme|investissement/i;
                            const _epFixes = Object.values(dataAnnee.chargesFixes || {}).reduce((sum, f) => _EPKW.test(f?.label || '') ? sum + valeurEffective(f, (f || {}).valeur, mNum) : sum, 0);""")

# ══ 4. Un virement interne a sa nature, son tiroir, son badge (checklist) ══════
sub('natures : virement', r"""                        epargne:      { badge: '💎 Épargne',      teinte: 'purple' },
                        exceptionnel: { badge: '⚠️ Exceptionnel', teinte: 'rose' },""",
    r"""                        epargne:      { badge: '💎 Épargne',      teinte: 'purple' },
                        virement:     { badge: '🔄 Virement',     teinte: 'indigo' },   // v37.36 : un transfert n'est pas de l'épargne
                        exceptionnel: { badge: '⚠️ Exceptionnel', teinte: 'rose' },""")
sub('routage : virement', r"""                        if (nature === 'exceptionnel') return cleDeCompte(it.sourceCompte);""",
    r"""                        if (nature === 'exceptionnel') return cleDeCompte(it.sourceCompte);
                        if (nature === 'virement') return cleDeCompte(it.sourceCompte || 'courant');""")
sub('règle dite : virement', r"""                        if (nature === 'revenu' || nature === 'injection') return 'Arrive sur ce compte (destination choisie sur la ligne).';""",
    r"""                        if (nature === 'virement') return 'Virement interne : sort de ce compte vers « ' + getNomCompte(it.destinationCompte || 'courant') + ' » (Calendrier pluriannuel).';
                        if (nature === 'revenu' || nature === 'injection') return 'Arrive sur ce compte (destination choisie sur la ligne).';""")
sub('checklist : nature virement', r"""                        //  v37.35 : les virements internes du cycle se pointent avec l'épargne — faits,
                        //  ils sont dans les deux soldes et le Relevé ne les projette plus.
                        getVirementsCycle(pilotageViewedMois.value, pilotageViewedAn.value).forEach(vir => {
                            const s = cleDeCompte(vir.sourceCompte || 'courant'), d = cleDeCompte(vir.destinationCompte || 'courant');
                            if (s === d) return;
                            const n = out.length;
                            pousser(vir, 'Virement ' + infoCompte(s).tag + ' → ' + infoCompte(d).tag, Math.abs(Number(vir.montant) || 0),
                                    'Virement', '🔄', 'purple', vir.jourPrevu, 'epargne');
                            if (out.length > n) out[n].badge = '🔄 Virement';
                        });""", r"""                        //  v37.35 : les virements internes du cycle se pointent — faits, ils sont dans les
                        //  deux soldes et le Relevé ne les projette plus. v37.36 : sous leur PROPRE nature
                        //  (« 🔄 Virement ») — un transfert de compte à compte n'est pas de l'épargne.
                        getVirementsCycle(pilotageViewedMois.value, pilotageViewedAn.value).forEach(vir => {
                            const s = cleDeCompte(vir.sourceCompte || 'courant'), d = cleDeCompte(vir.destinationCompte || 'courant');
                            if (s === d) return;
                            pousser(vir, 'Virement ' + infoCompte(s).tag + ' → ' + infoCompte(d).tag, Math.abs(Number(vir.montant) || 0),
                                    'Virement', '🔄', 'indigo', vir.jourPrevu, 'virement');
                        });""")
sub('tiroirs : virements internes', r"""                        { cle: 'epargne',      titre: '💎 Épargne & virements', barre: 'bg-violet-400' },""",
    r"""                        { cle: 'epargne',      titre: '💎 Épargne',             barre: 'bg-violet-400' },
                        { cle: 'virement',     titre: '🔄 Virements internes',  barre: 'bg-indigo-400' },""")
sub('ligne : teinte virement', r"""                                                      : 'from-rose-500/10 via-slate-900 to-slate-900 border-rose-500/20 hover:border-rose-400/60')))""",
    r"""                                                      : (t.nature === 'virement' ? 'from-indigo-500/10 via-slate-900 to-slate-900 border-indigo-500/20 hover:border-indigo-400/60'
                                                      : 'from-rose-500/10 via-slate-900 to-slate-900 border-rose-500/20 hover:border-rose-400/60'))))""")
sub('ligne : barre virement', r"""(t.nature === 'epargne' ? 'bg-violet-400' : 'bg-rose-400')))""",
    r"""(t.nature === 'epargne' ? 'bg-violet-400' : (t.nature === 'virement' ? 'bg-indigo-400' : 'bg-rose-400'))))""")
sub('progression : teinte virement', r"""                                               : (n.teinte === 'purple' ? 'bg-violet-500/15 text-violet-300 border-violet-500/50'
                                               : 'bg-rose-500/15 text-rose-300 border-rose-500/50'))]">{{ n.badge }} {{ n.pct }} %</span>""",
    r"""                                               : (n.teinte === 'purple' ? 'bg-violet-500/15 text-violet-300 border-violet-500/50'
                                               : (n.teinte === 'indigo' ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/50'
                                               : 'bg-rose-500/15 text-rose-300 border-rose-500/50')))]">{{ n.badge }} {{ n.pct }} %</span>""")

for a, r, n in edits: src = src.replace(a, r, n)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ {len(edits)} modifications appliquées à {F}')
