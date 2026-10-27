# -*- coding: utf-8 -*-
"""
v37.64 — POURQUOI CE DÉCOUVERT ? ET UN REVENU ARRIVÉ SUR UN AUTRE COMPTE.

« Pourquoi le calcul n'est pas bien fait ? Normalement j'attends des entrées appartement et magasin sur le
courant, pourquoi c'est pas OK ? » (le jour de paie, la Météo annonçait le Courant à découvert en fin de cycle).
Les loyers ÉTAIENT comptés. Le trou venait d'ailleurs : le salaire était arrivé sur un AUTRE compte que celui
du plan, et le plan gardait le virement Courant → cet autre compte qui devait l'y envoyer. Le Courant payait
un trajet que l'argent avait déjà fait. Rien à l'écran ne permettait de le voir.
  • « Pourquoi ? » sous le bloc rouge : le calcul du compte, ligne à ligne, celui du moteur du Relevé —
    « 7 600 aujourd'hui + 11 600 d'entrées − 30 500 de sorties = − 11 300 », les entrées attendues (les loyers,
    avec leur date) et les sorties (les semaines de charges variables en une ligne).
  • « 💡 Salaire et Bonification sont arrivés sur ASSAFA, pas sur le Courant » : le relevé importé le sait.
    Une entrée venue de l'extérieur (pas la moitié d'un virement entre vos comptes) dont le montant colle à un
    revenu du cycle (± 5 %, à 7 jours de sa date — ou pointée sur lui), sur un autre compte que sa destination.
  • Le virement prévu qui devait faire ce trajet est nommé, avec « Retirer ce virement de novembre » (après
    confirmation) : le découvert disparaît s'il n'avait que cette cause.
Le bloc rouge et son calcul ne bougent pas d'un octet (empreintes v37.32).
"""
import io, sys
F = 'index.html'
src = io.open(F, encoding='utf-8').read()
def sub(label, a, b, n=1):
    global src
    if src.count(a) != n: print('✖', label, ':', src.count(a), 'ancre(s),', n, 'attendue(s)'); sys.exit(1)
    src = src.replace(a, b)

# ── 1. Le détecteur : un revenu du cycle arrivé sur un autre compte que sa destination ──────────────────
sub('détecteur',
"""                    const meteoFinanciere = computed(() => {
                        const A = kpiAtterrissageGlobal.value;""",
"""                    /*  v37.64 — UN REVENU ARRIVÉ SUR UN AUTRE COMPTE QUE PRÉVU.
                        « J'attends les loyers sur le courant, pourquoi c'est pas OK ? » — les loyers y étaient ;
                        le salaire, lui, était arrivé sur un autre compte que celui du plan, et le plan gardait le
                        virement Courant → ce compte qui devait l'y envoyer : le Courant payait un trajet déjà fait.
                        Le relevé importé le sait : une entrée venue de l'extérieur — pas la moitié d'un virement
                        entre vos comptes (même montant, sens opposé, autre compte, à un jour près) — dont le
                        montant colle à un revenu du cycle (± 5 %, à 7 jours de sa date, ou pointée sur lui) sur
                        un AUTRE compte que sa destination. Chaque entrée sert un revenu, chaque revenu une
                        entrée, les plus proches d'abord : une entrée sur le bon compte « prend » son revenu.
                        → [{ prevu, recu, revenus, montant, quand, virements: [virement prévu prevu → recu] }] */
                    const revenusAilleurs = computed(() => {
                        calculationTick.value;
                        const mb = moisBudgetaire.value, cyc = _cleCycle(mb.mois, mb.an);
                        const { debut, fin } = consoT0Fenetre.value, d0 = _ymd(debut), d1 = _ymd(fin);
                        const midi = (iso) => new Date(String(iso).slice(0, 10) + 'T12:00:00').getTime();
                        const leJour = (j) => new Date(Number(j) >= debut.getDate() ? debut.getFullYear() : fin.getFullYear(),
                                                       Number(j) >= debut.getDate() ? debut.getMonth() : fin.getMonth(), Number(j), 12);
                        const reg = _registreBanque().filter(e => e.d && e.d >= d0 && e.d <= d1 && Number(e.m));
                        const interne = (e) => reg.some(o => String(o.c) !== String(e.c) && Math.abs(Number(o.m) + Number(e.m)) < 0.01 && Math.abs(midi(o.d) - midi(e.d)) <= 864e5);
                        const entrees = reg.filter(e => Number(e.m) > 0 && !interne(e));
                        if (!entrees.length) return [];
                        const revenus = revenusBudgetairesTries.value.map((rev, i) => ({
                            cle: 'Revenu:' + i + ':' + (rev.label || ''), libelle: String(rev.label || 'Revenu').trim(),
                            due: Math.abs(Number(getDueRevenu(rev, mb.an, mb.mois)) || 0), compte: compteDeFlux('revenu', rev),
                            date: rev.jourPrevu ? leJour(rev.jourPrevu).getTime() : null,
                        })).filter(r => r.due > 0);
                        const paires = [];
                        entrees.forEach(e => revenus.forEach(r => {
                            const m = Number(e.m), ecart = Math.abs(m - r.due) / r.due;
                            if (e.s === 'pilotage' && e.k === r.cle) paires.push({ e, r, ecart: -1 });
                            else if (ecart <= 0.05 && (Math.abs(m - r.due) <= 1 || r.date === null || Math.abs(midi(e.d) - r.date) <= 7 * 864e5)) paires.push({ e, r, ecart });
                        }));
                        paires.sort((x, y) => x.ecart - y.ecart);
                        const vuE = new Set(), vuR = new Set(), groupes = {};
                        paires.forEach(({ e, r }) => {
                            if (vuE.has(e.h) || vuR.has(r.cle)) return;
                            vuE.add(e.h); vuR.add(r.cle);
                            const recu = cleDeCompte(e.c);
                            if (!recu || recu === r.compte) return;
                            const g = groupes[r.compte + '>' + recu] || (groupes[r.compte + '>' + recu] = { prevu: r.compte, recu, revenus: [] });
                            g.revenus.push({ libelle: r.libelle, due: Math.round(r.due), montant: Math.round(Number(e.m) * 100) / 100, date: e.d });
                        });
                        const quandIso = (iso) => { const [, m, j] = String(iso).split('-').map(Number); return j + ' ' + _MOIS_COURTS[m - 1]; };
                        const virs = getVirementsCycle(mb.mois, mb.an);
                        const seaux = donneesAnnuelles.value || {};
                        return Object.values(groupes).map(g => {
                            const P = infoCompte(g.prevu), R = infoCompte(g.recu);
                            g.revenus.sort((x, y) => y.montant - x.montant);
                            const noms = g.revenus.map(r => r.libelle);
                            const virements = virs.filter(v => cleDeCompte(v.sourceCompte || 'courant') === g.prevu && cleDeCompte(v.destinationCompte || 'courant') === g.recu)
                                .map(v => {
                                    const due = Math.abs(Number(v.montant) || 0);
                                    const reste = isItemPaid(v, due, cyc) ? 0 : Math.max(0, due - (getPaidAmount(v, due, cyc) || 0));
                                    const an = Object.keys(seaux).find(a => ((seaux[a] || {}).virementsInternes || []).some(x => x && x.id === v.id));
                                    const jour = leJour(Number(v.jourPrevu || 20));
                                    return { id: v.id, an: Number(an), montant: Math.round(reste), quand: jour.getDate() + ' ' + _MOIS_COURTS[jour.getMonth()], mois: _MOIS_LONGS[mb.mois - 1] };
                                }).filter(v => v.montant > 0 && v.an);
                            const dates = [...new Set(g.revenus.map(r => r.date))].sort();
                            return {
                                prevu: g.prevu, recu: g.recu, prevuTag: P.tag, recuTag: R.tag, prevuLabel: P.label, recuLabel: R.label,
                                revenus: g.revenus, plusieurs: g.revenus.length > 1,
                                libelles: noms.length > 1 ? noms.slice(0, -1).join(', ') + ' et ' + noms[noms.length - 1] : noms[0],
                                montant: Math.round(g.revenus.reduce((s, r) => s + r.montant, 0)),
                                quand: dates.map(quandIso).join(', '), virements,
                            };
                        });
                    });
                    //  v37.64 : retirer du plan un virement que l'argent a déjà fait (confirmé)
                    const retirerVirementPrevu = (v) => {
                        if (!v || v.id == null || !v.an) return;
                        if (typeof window !== 'undefined' && window.confirm && !window.confirm('Retirer du plan ce virement de ' + formatMAD(v.montant) + ' (' + (v.mois || '') + ') ? L\\u2019argent qu\\u2019il devait déplacer est déjà arrivé sur le compte de destination.')) return;
                        supprimerVirementInterne(v.id, v.an);
                        calculationTick.value++;
                    };

                    const meteoFinanciere = computed(() => {
                        const A = kpiAtterrissageGlobal.value;""")

# ── 2. Le « Pourquoi ? » de chaque compte à découvert, et les revenus arrivés ailleurs, dans la Météo ────
sub('pourquoi',
"""                                .sort((x, y) => (y.courant - x.courant) || (rang(x.key) - rang(y.key)));
                        })();
                        return {
                            etat, icone, titre, raison, conseil, decouverts, atterrissages,""",
"""                                .sort((x, y) => (y.courant - x.courant) || (rang(x.key) - rang(y.key)));
                        })();
                        /*  v37.64 — POURQUOI CE DÉCOUVERT : le calcul du compte, celui du moteur du Relevé —
                            « 7 600 aujourd'hui + 11 600 d'entrées − 30 500 de sorties ». Les entrées attendues
                            (avec leur date) et les sorties, de la plus grosse à la plus petite ; les semaines
                            de charges variables forment une seule ligne. */
                        const pourquoi = (() => {
                            const a = atterrissageCycle.value, { debut, fin } = consoT0Fenetre.value;
                            const quand = (j) => !j ? '' : j + ' ' + _MOIS_COURTS[Number(j) >= debut.getDate() ? debut.getMonth() : fin.getMonth()];
                            return (a.comptes || []).filter(c => c.atterrissage < 0 && (c.courant || c.reel)).map(c => {
                                const groupe = (type) => {
                                    const m = new Map();
                                    (c.lignes || []).filter(l => l.type === type).forEach(l => {
                                        const sem = /^🛒 Charges variables/.test(l.libelle);
                                        const lib = sem ? '🛒 Charges variables' : l.libelle;
                                        const g = m.get(lib) || { libelle: lib, montant: 0, nb: 0, quand: sem ? 'd’ici le ' + A.dateFin : quand(l.jourPrevu) };
                                        g.montant += Number(l.montant) || 0; g.nb++;
                                        m.set(lib, g);
                                    });
                                    return [...m.values()].map(g => ({ ...g, montant: Math.round(g.montant) })).filter(g => g.montant > 0)
                                        .sort((x, y) => y.montant - x.montant);
                                };
                                return { key: c.key, compte: infoCompte(c.key), t0: c.t0, entrees: c.entrees, sorties: c.sorties, atterrissage: c.atterrissage,
                                         credits: groupe('credit'), debits: groupe('debit') };
                            });
                        })();
                        //  v37.64 : un revenu arrivé sur un autre compte — dit quand il explique un découvert
                        //  ou qu'un virement prévu devait faire ce trajet
                        const ailleurs = isCyclePasse.value ? [] : revenusAilleurs.value.filter(g => g.virements.length || pourquoi.some(q => q.key === g.prevu));
                        return {
                            pourquoi, ailleurs,
                            etat, icone, titre, raison, conseil, decouverts, atterrissages,""")

# ── 3. Le gabarit : sous la phrase du découvert, le « Pourquoi ? » ; puis les revenus arrivés ailleurs ───
sub('gabarit pourquoi',
"""                    <p v-else class="mt-1 md:mt-1.5 text-xs md:text-sm font-semibold text-white/90 leading-snug" data-meteo-raison>{{ meteo.decouverts.length > 1 ? meteo.decouverts.length + ' comptes finissent le cycle dans le rouge' : 'Un compte finit le cycle dans le rouge' }} : le virement ci-dessus l’évite.</p>
""",
"""                    <p v-else class="mt-1 md:mt-1.5 text-xs md:text-sm font-semibold text-white/90 leading-snug" data-meteo-raison>{{ meteo.decouverts.length > 1 ? meteo.decouverts.length + ' comptes finissent le cycle dans le rouge' : 'Un compte finit le cycle dans le rouge' }} : le virement ci-dessus l’évite.</p>
                    <!-- v37.64 : POURQUOI ce découvert — le calcul du compte, ligne à ligne (le moteur du Relevé) -->
                    <template v-if="meteo.decouverts && meteo.decouverts.length && !meteo.retro">
                    <details v-for="q in (meteo.pourquoi || [])" :key="'pq_' + q.key" data-meteo-pourquoi :data-compte="q.key" :open="uiOuvert('meteo.pourquoi', false)" @toggle="uiFixer('meteo.pourquoi', $event.target.open)"
                             class="mt-2 rounded-xl bg-black/25 ring-1 ring-white/15 px-2.5 py-1.5 text-[11px] md:text-xs text-white">
                        <summary class="cursor-pointer font-black leading-snug" data-meteo-pourquoi-calcul>Pourquoi ? {{ q.compte.tag }} : {{ chiffre(q.t0) }} aujourd’hui + {{ chiffre(q.entrees) }} d’entrées − {{ chiffre(q.sorties) }} de sorties = {{ q.atterrissage < 0 ? '−' : '' }} {{ chiffre(Math.abs(q.atterrissage)) }} DH</summary>
                        <div class="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                            <ul data-meteo-pourquoi-entrees class="space-y-0.5 min-w-0">
                                <li class="font-black text-emerald-200">Entrées attendues d’ici le {{ meteo.dateFin }}</li>
                                <li v-for="l in q.credits" :key="'c_' + l.libelle" class="flex justify-between gap-2 min-w-0"><span class="truncate">{{ l.libelle }} <span class="text-white/60">{{ l.quand }}</span></span><span class="tabular-nums whitespace-nowrap font-bold">+ {{ chiffre(l.montant) }}</span></li>
                                <li v-if="!q.credits.length" class="text-white/60">aucune</li>
                            </ul>
                            <ul data-meteo-pourquoi-sorties class="space-y-0.5 min-w-0">
                                <li class="font-black text-rose-200">Sorties prévues</li>
                                <li v-for="l in q.debits" :key="'d_' + l.libelle" class="flex justify-between gap-2 min-w-0"><span class="truncate">{{ l.libelle }} <span class="text-white/60">{{ l.quand }}</span></span><span class="tabular-nums whitespace-nowrap font-bold">− {{ chiffre(l.montant) }}</span></li>
                                <li v-if="!q.debits.length" class="text-white/60">aucune</li>
                            </ul>
                        </div>
                    </details>
                    </template>
                    <!-- v37.64 : un revenu arrivé sur un AUTRE compte que prévu (relevé importé), et le virement qui devait faire ce trajet -->
                    <div v-for="r in (meteo.ailleurs || [])" :key="'ai_' + r.prevu + '_' + r.recu" data-meteo-ailleurs :data-prevu="r.prevu" :data-recu="r.recu"
                         class="mt-2 rounded-xl bg-amber-200 text-slate-900 px-3 py-2 text-[11px] md:text-xs font-bold leading-snug shadow-sm">
                        <p>💡 {{ r.libelles }} — {{ formatMad(r.montant) }} reçus le {{ r.quand }} — {{ r.plusieurs ? 'sont arrivés' : 'est arrivé' }} sur <b>{{ r.recuTag }}</b>, pas sur <b>{{ r.prevuTag }}</b> (relevé importé) : {{ r.prevuTag }} ne {{ r.plusieurs ? 'les a pas reçus' : 'l’a pas reçu' }}.</p>
                        <p v-if="r.virements.length" class="mt-1">Le plan garde le virement qui devait y envoyer cet argent — il y est déjà :</p>
                        <p v-for="v in r.virements" :key="'av_' + v.id" class="mt-1.5 flex items-center justify-between gap-2 flex-wrap" data-meteo-ailleurs-virement>
                            <span class="tabular-nums">🔄 {{ r.prevuTag }} → {{ r.recuTag }} : {{ formatMad(v.montant) }} le {{ v.quand }}</span>
                            <button type="button" data-meteo-retirer-virement @click="$emit('retirer-virement', v)"
                                    class="rounded-lg bg-slate-900 text-white px-2.5 py-1 text-[11px] font-black hover:bg-slate-700">Retirer ce virement de {{ v.mois }}</button>
                        </p>
                    </div>
""")

# ── 3 bis. Le tiroir « Pourquoi ? » se souvient (comme tous les tiroirs) ───────────────────────────────
sub('mémoire du tiroir',
"""                chiffre(v) { return this.formatMad(v).replace(/\\s*DH\\s*$/, ''); },""",
"""                chiffre(v) { return this.formatMad(v).replace(/\\s*DH\\s*$/, ''); },
                //  v37.64 : les tiroirs de la Météo se souviennent, comme ceux de l'application
                uiOuvert(cle, defaut) { return uiOuvert(cle, defaut); },
                uiFixer(cle, v) { uiFixer(cle, v); },""")

# ── 4. L'événement, branché sur les trois Météo ─────────────────────────────────────────────────────────
sub('emits',
"""            emits: ['aller', 'revenir', 'effacer', 'semaine', 'saisie', 'retirer', 'cloturer'],""",
"""            emits: ['aller', 'revenir', 'effacer', 'semaine', 'saisie', 'retirer', 'cloturer', 'retirer-virement'],""")
sub('branchement',
"""                                      @revenir="pilotageViewedCycle = null"></meteo-financiere>""",
"""                                      @revenir="pilotageViewedCycle = null" @retirer-virement="retirerVirementPrevu"></meteo-financiere>""", n=3)
sub('exposition',
"""                        meteoFinanciere, respirationBudgetaire,""",
"""                        meteoFinanciere, revenusAilleurs, retirerVirementPrevu, respirationBudgetaire,""")

io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.64 Pourquoi : le calcul du découvert, et le revenu arrivé sur un autre compte')
