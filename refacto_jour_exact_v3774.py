#!/usr/bin/env python3
"""v37.74 — LE JOUR EXACT D'UN CHOC ET D'UN VIREMENT, DANS LE CALENDRIER PLURIANNUEL.

« Il faut ajouter une case jour exact du mois pour les pluriannuels. »
Le Relevé, la Météo et les cycles savaient déjà placer un flux exceptionnel ou un virement à son
jour (jourPrevu) — mais le Calendrier Pluriannuel ne permettait pas de le saisir : un nouveau choc
prenait en silence le jour de sa création, un virement tombait le 20.

  1. Une case « 📅 j. » sur chaque choc et chaque virement (bureau et téléphone) : vide = sans jour
     précis (comme avant) ; bornée au nombre de jours du mois (31 → 30 en novembre).
  2. Un jour au moins égal au jour de paie fait passer le flux au cycle SUIVANT (règle du 27, déjà
     appliquée par les calculs) : l'écran le dit maintenant — « après la paie → cycle de décembre ».
"""
import io, sys

F = 'index.html'
src = io.open(F, encoding='utf-8').read()
def sub(label, old, new):
    global src
    c = src.count(old)
    if c != 1:
        print(f'✖ {label} : {c} ancre(s), 1 attendue'); sys.exit(1)
    src = src.replace(old, new)

def case(item, mois, cls_input, cls_label='text-[10px] font-black text-gray-400'):
    return (f"""<label class="flex items-center gap-1 shrink-0" title="Jour exact du mois — vide : sans jour précis">"""
            f"""<span class="{cls_label}">📅 j.</span>"""
            f"""<input data-jour-exact type="number" min="1" :max="joursDuMoisCal({mois}, anneeAffichage)" :value="{item}.jourPrevu || ''" """
            f"""@change="fixerJourExact({item}, $event.target.value, {mois}, anneeAffichage); $event.target.value = {item}.jourPrevu || ''" placeholder="—" """
            f"""class="{cls_input}"/></label>""")

def badge(item, mois, cls='text-[8px]'):
    return (f"""<span v-if="jourApresPaie({item})" data-jour-cycle-suivant :title="'Le ' + {item}.jourPrevu + ' tombe après la paie (le ' + jourDePaieCal() + ') : compté dans le cycle suivant'" """
            f"""class="{cls} bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-black whitespace-nowrap">après paie → {{{{ cycleSuivantNom({mois}) }}}}</span>""")

IN_BUREAU = 'w-12 text-center font-black text-xs bg-white border border-gray-200 rounded-lg px-1 py-1.5 outline-none focus:ring-2 focus:ring-blue-300'
IN_MOBILE = 'w-20 p-3 text-center border rounded-lg font-black bg-white outline-none text-sm'

sub('choc — bureau',
"""                                        <!-- Source (masqué si parts) -->""",
"""                                        <!-- v37.74 : jour exact du mois -->
                                        """ + case('depense', 'depense.mois', IN_BUREAU) + """
                                        """ + badge('depense', 'depense.mois') + """
                                        <!-- Source (masqué si parts) -->""")
sub('virement — bureau',
"""                                        <input type="number" v-model.number="vir.montant" @input="handleDataChange" min="0" class="w-24""",
"""                                        """ + case('vir', 'vir.mois', IN_BUREAU) + """
                                        """ + badge('vir', 'vir.mois') + """
                                        <input type="number" v-model.number="vir.montant" @input="handleDataChange" min="0" class="w-24""")
sub('choc — téléphone',
"""                            <!-- v17.22 : Source Compte dynamique (mobile) -->""",
"""                            <!-- v37.74 : jour exact du mois (mobile) -->
                            <div class="mt-2 flex flex-wrap items-center gap-2">
                                """ + case('choc', 'choc.mois', IN_MOBILE, 'text-[9px] font-black uppercase tracking-widest text-gray-500') + """
                                """ + badge('choc', 'choc.mois', 'text-[10px]') + """
                            </div>
                            <!-- v17.22 : Source Compte dynamique (mobile) -->""")
sub('virement — téléphone',
"""                                <input type="number" v-model.number="vir.montant" @input="handleDataChange" min="0" placeholder="Montant (DH)\"""",
"""                                <div class="mb-2 flex flex-wrap items-center gap-2">
                                    """ + case('vir', 'vir.mois', IN_MOBILE, 'text-[9px] font-black uppercase tracking-widest text-gray-500') + """
                                    """ + badge('vir', 'vir.mois', 'text-[10px]') + """
                                </div>
                                <input type="number" v-model.number="vir.montant" @input="handleDataChange" min="0" placeholder="Montant (DH)\"""")
sub('aides',
"""                    const getVirementsMois = (m, a) =>""",
"""                    //  v37.74 : le jour exact d'un choc ou d'un virement, saisi dans le Calendrier Pluriannuel.
                    //  Vide = sans jour précis ; borné au mois (31 → 30 en novembre, 28/29 en février).
                    const joursDuMoisCal = (m, a) => new Date(Number(a) || 2026, Number(m) || 1, 0).getDate();
                    const fixerJourExact = (item, valeur, m, a) => {
                        if (!item) return;
                        const n = parseInt(valeur, 10);
                        if (!Number.isFinite(n) || n < 1) delete item.jourPrevu;
                        else item.jourPrevu = Math.min(n, joursDuMoisCal(m, a));
                        handleDataChange();
                    };
                    //  Règle du jour de paie (getDepensesCycle / getVirementsCycle) : un jour ≥ jour de paie
                    //  appartient au cycle suivant. L'écran le dit au lieu de le laisser deviner.
                    const jourApresPaie = (item) => !!(item && Number(item.jourPrevu) && Number(item.jourPrevu) >= Number(jourDePaie.value));
                    const jourDePaieCal = () => jourDePaie.value;
                    const cycleSuivantNom = (m) => nomDuMois(Number(m) === 12 ? 1 : Number(m) + 1);
                    const getVirementsMois = (m, a) =>""")
sub('exposition',
"""supprimerVirementInterne, """,
"""supprimerVirementInterne, joursDuMoisCal, fixerJourExact, jourApresPaie, jourDePaieCal, cycleSuivantNom, """)
io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.74 : jour exact des chocs et virements dans le Calendrier Pluriannuel')
