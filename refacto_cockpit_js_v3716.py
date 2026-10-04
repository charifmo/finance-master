# -*- coding: utf-8 -*-
"""
v37.16 Cockpit-Pilotage — PARTIE LOGIQUE.

Ce script ne calcule rien de nouveau : chaque KPI du cockpit est branché sur
une source qui existe déjà, pour qu'aucun écran ne dise autre chose.

  🔥 Urgence      = somme des paquets « En retard » + « Cette semaine » de la
                    liste À traiter. Le seuil (7 jours) devient une constante
                    partagée par le badge, le paquet et la carte.
  📈 Progression  = réglé + reste = total, sur les mêmes tâches que la liste.
  🚨 Atterrissage = le moteur du Relevé (_buildJournalReleve), compte par
                    compte — le même qui alimente le popup Relevé.

Ancres vérifiées AVANT écriture : un compte faux et rien n'est écrit.
"""
import io, sys

F = 'index.html'
src = io.open(F, encoding='utf-8').read()
edits = []

def sub(label, anchor, replacement, expected=1):
    n = src.count(anchor)
    if n != expected:
        print(f'✖ {label} : {n} ancre(s), {expected} attendue(s)')
        sys.exit(1)
    edits.append((anchor, replacement))

# ── 1. Le moteur du Relevé dit quelle clé est le compte courant ──────────────
sub('retour _buildJournalReleve',
"""                        return { entries, soldeAtterrissage: _soldeAtterr, soldesFinaux: soldes };""",
"""                        return { entries, soldeAtterrissage: _soldeAtterr, soldesFinaux: soldes, courantKey };""")

# ── 2. Une seule constante pour « cette semaine » ────────────────────────────
sub('seuil proche dans tachesPilotage',
"""                                proche: _rangDansCycle(jourPrevu) >= _rangAujourdhui.value
                                        && _rangDansCycle(jourPrevu) <= _rangAujourdhui.value + 7,""",
"""                                proche: _rangDansCycle(jourPrevu) >= _rangAujourdhui.value
                                        && _rangDansCycle(jourPrevu) <= _rangAujourdhui.value + HORIZON_URGENCE,""")

# ── 3. Chaque tâche porte sa nature (badge du cockpit) ────────────────────────
sub('signature pousser',
"""                        const pousser = (ref, libelle, due, groupe, icone, teinte, jourPrevu) => {
                            const d = Number(due) || 0;
                            if (d <= 0) return;              // suspendu ce mois → hors checklist
                            out.push({
                                cle: groupe + ':' + (ref.id != null ? ref.id : libelle),
                                ref, libelle: libelle || '(sans nom)', due: d, groupe, icone, teinte,""",
"""                        const pousser = (ref, libelle, due, groupe, icone, teinte, jourPrevu, nature) => {
                            const d = Number(due) || 0;
                            if (d <= 0) return;              // suspendu ce mois → hors checklist
                            out.push({
                                cle: groupe + ':' + (ref.id != null ? ref.id : libelle),
                                ref, libelle: libelle || '(sans nom)', due: d, groupe, icone, teinte,
                                //  v37.16 : la nature décide du badge [🏢 Fixe] [🛒 Variable]…
                                nature, badge: (NATURES_TACHE[nature] || NATURES_TACHE.exceptionnel).badge,""")

sub('pousser charges fixes',
"""                            pousser(f, f.label, getDueFixe(f, an, moisBud), 'Charge fixe', '🏢', 'orange', f.jourPrevu));""",
"""                            pousser(f, f.label, getDueFixe(f, an, moisBud), 'Charge fixe', '🏢', 'orange', f.jourPrevu, 'fixe'));""")
sub('pousser charges variables',
"""                                pousser(d, d.nom, Number(d.montant || 0), cat.label, '🧾', 'blue', d.jourPrevu || cat.jourPrevu));""",
"""                                pousser(d, d.nom, Number(d.montant || 0), cat.label, '🛒', 'blue', d.jourPrevu || cat.jourPrevu, 'variable'));""")
sub('pousser épargne',
"""                            pousser(ep, ep.nom || ep.label || 'Épargne', getDueFixe(ep, an, moisBud), 'Épargne', '🎯', 'purple', ep.jourPrevu));""",
"""                            pousser(ep, ep.nom || ep.label || 'Épargne', getDueFixe(ep, an, moisBud), 'Épargne', '💎', 'purple', ep.jourPrevu, 'epargne'));""")
sub('pousser exceptionnels',
"""                            pousser(dep, dep.nom, Number(dep.montant || 0), 'Flux exceptionnel', '⚠️', 'rose', dep.jourPrevu));""",
"""                            pousser(dep, dep.nom, Number(dep.montant || 0), 'Flux exceptionnel', '⚠️', 'rose', dep.jourPrevu, 'exceptionnel'));""")

# ── 4. Les paquets : libellé « Reste du mois », seuil partagé, total chiffré ─
sub('tachesGroupees',
"""                    //  Trois paquets, dans l'ordre où on les traite.
                    const tachesGroupees = computed(() => {
                        const r = _rangAujourdhui.value;
                        const paquets = [
                            { cle: 'retard',  titre: '⚠️ En retard',     teinte: 'rose',  taches: [] },
                            { cle: 'semaine', titre: '⏳ Cette semaine',  teinte: 'amber', taches: [] },
                            { cle: 'apres',   titre: '📅 Plus tard',      teinte: 'slate', taches: [] },
                        ];
                        tachesATraiter.value.forEach(t => {
                            if (t.rang < r) paquets[0].taches.push(t);
                            else if (t.rang <= r + 7) paquets[1].taches.push(t);
                            else paquets[2].taches.push(t);
                        });
                        return paquets.filter(p => p.taches.length);
                    });""",
"""                    //  Trois paquets, dans l'ordre où on les traite.
                    //  v37.16 : chaque paquet porte son total — la carte « Urgence »
                    //  n'est rien d'autre que la somme des deux premiers.
                    const tachesGroupees = computed(() => {
                        const r = _rangAujourdhui.value;
                        const paquets = [
                            { cle: 'retard',  titre: '⚠️ En retard',     teinte: 'rose',  taches: [], total: 0 },
                            { cle: 'semaine', titre: '⏳ Cette semaine',  teinte: 'amber', taches: [], total: 0 },
                            { cle: 'apres',   titre: '📅 Reste du mois',  teinte: 'slate', taches: [], total: 0 },
                        ];
                        tachesATraiter.value.forEach(t => {
                            const p = t.rang < r ? paquets[0] : (t.rang <= r + HORIZON_URGENCE ? paquets[1] : paquets[2]);
                            p.taches.push(t);
                            p.total += Math.max(0, t.due - t.regle);
                        });
                        paquets.forEach(p => { p.total = Math.round(p.total); });
                        return paquets.filter(p => p.taches.length);
                    });""")

# ── 5. Le cockpit lui-même ───────────────────────────────────────────────────
sub('bloc cockpit après tachesSansDate',
"""                    const tachesSansDate = computed(() => tachesATraiter.value.filter(t => !t.jourPrevu).length);
""",
"""                    const tachesSansDate = computed(() => tachesATraiter.value.filter(t => !t.jourPrevu).length);

                    /* ═══════════════════════════════════════════════════════════════
                       v37.16 — LE COCKPIT : TROIS CHIFFRES QUI DISENT QUOI FAIRE

                       Aucun des trois n'a de formule à lui. Chacun lit une source que
                       l'écran affiche déjà ailleurs, pour qu'on puisse le vérifier
                       d'un coup d'œil :
                         🔥 Urgence      = paquets « En retard » + « Cette semaine »
                         📈 Progression  = réglé + reste = total, mêmes tâches
                         🚨 Atterrissage = le moteur du Relevé, compte par compte
                       ═══════════════════════════════════════════════════════════════ */
                    const _MOIS_LONGS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
                    //  Un montant SANS « DH ». Le gabarit faisait .replace(' DH', '') avec
                    //  une espace ordinaire, alors que formatMAD pose une espace
                    //  insécable : le « DH » n'était jamais retiré.
                    const formatNombre = (v) => new Intl.NumberFormat('fr-FR').format(Math.round(Number(v) || 0));
                    const _dateLongue = (d) => d.getDate() + ' ' + _MOIS_LONGS[d.getMonth()];

                    //  Dernier jour du cycle en cours : la veille de la prochaine paie.
                    //  Même construction que le libellé « 27 Sep → 26 Oct ».
                    const finCycleDate = computed(() => {
                        const info = _cyclePaieInfo.value;
                        return new Date(info.prochainAn, info.prochainMois - 1, jourDePaie.value - 1);
                    });

                    const kpiUrgence = computed(() => {
                        const pq = (cle) => tachesGroupees.value.find(p => p.cle === cle) || { total: 0, taches: [] };
                        const retard = pq('retard'), semaine = pq('semaine');
                        const jusquau = new Date();
                        jusquau.setDate(jusquau.getDate() + HORIZON_URGENCE);
                        return {
                            montant: retard.total + semaine.total,
                            retard: retard.total,
                            nb: retard.taches.length + semaine.taches.length,
                            nbRetard: retard.taches.length,
                            jusquau: _dateLongue(jusquau),
                            //  Les lignes sans date ne peuvent pas être classées : on
                            //  le dit sur la carte au lieu de les compter en silence.
                            sansDate: tachesSansDate.value,
                        };
                    });

                    const kpiProgression = computed(() => {
                        let regle = 0, reste = 0;
                        const parNature = {};
                        tachesPilotage.value.forEach(t => {
                            //  Une ligne pointée vaut ce qui a été réglé (ou son dû) ;
                            //  une ligne ouverte vaut son avance déjà versée.
                            const r = t.paye ? (t.regle || t.due) : Math.min(t.regle || 0, t.due);
                            const x = t.paye ? 0 : Math.max(0, t.due - (t.regle || 0));
                            regle += r; reste += x;
                            const n = parNature[t.nature] || (parNature[t.nature] = { regle: 0, reste: 0 });
                            n.regle += r; n.reste += x;
                        });
                        regle = Math.round(regle); reste = Math.round(reste);
                        const total = regle + reste;   // affiché « réglé / total » : la somme tombe juste
                        const natures = Object.keys(NATURES_TACHE)
                            .filter(k => parNature[k])
                            .map(k => {
                                const r = Math.round(parNature[k].regle), x = Math.round(parNature[k].reste);
                                return { cle: k, badge: NATURES_TACHE[k].badge, teinte: NATURES_TACHE[k].teinte,
                                         regle: r, total: r + x, pct: (r + x) > 0 ? Math.round(r / (r + x) * 100) : 100 };
                            });
                        return {
                            regle, reste, total,
                            pct: total > 0 ? Math.round(regle / total * 100) : 100,
                            pctTemps: progressCyclePaie.value,
                            natures,
                        };
                    });

                    //  L'atterrissage de CHAQUE compte, tiré du moteur du Relevé sur le
                    //  cycle en cours. C'est le chiffre que le Relevé affiche, ligne à
                    //  ligne : le cockpit n'en calcule pas un second.
                    const atterrissageCycle = computed(() => {
                        calculationTick.value;
                        let j;
                        try { j = _buildJournalReleve([], []); } catch (e) { j = null; }
                        if (!j) return { courantKey: 'courant', courant: 0, comptes: [], alertes: [] };
                        const fin = j.soldesFinaux || {};
                        const ck = j.courantKey || 'courant';
                        const parCompte = {};
                        (j.entries || []).forEach(e => {
                            const k = e.compteKey;
                            if (!k) return;
                            const c = parCompte[k] || (parCompte[k] = { t0: null, lignes: [] });
                            if (e.type === 'initial') c.t0 = Number(e.montant) || 0;
                            else if (e.type === 'credit' || e.type === 'debit')
                                c.lignes.push({ libelle: e.libelle, montant: Number(e.montant) || 0, type: e.type, jourPrevu: e.jourPrevu });
                        });
                        const comptes = Object.keys(fin).map(k => {
                            const info = _infoCompteKey(k);
                            const pc = parCompte[k] || { t0: null, lignes: [] };
                            const entrees = pc.lignes.filter(l => l.type === 'credit').reduce((s, l) => s + l.montant, 0);
                            const sorties = pc.lignes.filter(l => l.type === 'debit').reduce((s, l) => s + l.montant, 0);
                            const atterrissage = Math.round(Number(fin[k]) || 0);
                            //  Le solde d'aujourd'hui se déduit de l'atterrissage : la
                            //  ligne T0 n'est émise que pour un compte actif.
                            const t0 = pc.t0 !== null ? Math.round(pc.t0) : Math.round(atterrissage - entrees + sorties);
                            return {
                                key: k, icon: info.icon, label: info.label,
                                courant: k === ck,
                                reel: k === ck || k.startsWith('cpt_'),   // une poche d'épargne virtuelle n'est jamais à découvert
                                t0, entrees: Math.round(entrees), sorties: Math.round(sorties), atterrissage,
                                lignes: pc.lignes,
                            };
                        }).filter(c => c.courant || c.lignes.length || c.t0 !== 0);
                        comptes.sort((a, b) => (b.courant - a.courant)
                            || ((a.reel && a.atterrissage < 0) === (b.reel && b.atterrissage < 0) ? 0 : (a.reel && a.atterrissage < 0 ? -1 : 1))
                            || (b.lignes.length - a.lignes.length));
                        return {
                            courantKey: ck,
                            courant: Math.round(Number(fin[ck]) || 0),
                            comptes,
                            alertes: comptes.filter(c => !c.courant && c.reel && c.atterrissage < 0),
                        };
                    });

                    const kpiAtterrissage = computed(() => {
                        const a = atterrissageCycle.value;
                        const pire = a.alertes.slice().sort((x, y) => x.atterrissage - y.atterrissage)[0] || null;
                        return {
                            montant: a.courant,
                            courant: a.comptes.find(c => c.courant) || null,
                            alertes: a.alertes,
                            //  Le chiffre en vedette : le courant s'il plonge, sinon le
                            //  pire des autres comptes — un découvert ailleurs reste un
                            //  découvert.
                            vedette: a.courant < 0 ? (a.comptes.find(c => c.courant) || null) : pire,
                            negatif: a.courant < 0 || a.alertes.length > 0,
                            dateFin: _dateLongue(finCycleDate.value),
                        };
                    });

                    //  ✅ UN CLIC : les charges FIXES dont la date est arrivée.
                    //  Pas celles de vendredi : cocher une charge pas encore prélevée
                    //  gonflerait l'atterrissage de son montant.
                    const chargesFixesEchues = computed(() => {
                        const r = _rangAujourdhui.value;
                        return tachesATraiter.value.filter(t => t.nature === 'fixe' && t.jourPrevu && t.rang <= r);
                    });
                    const montantChargesFixesEchues = computed(() =>
                        Math.round(chargesFixesEchues.value.reduce((s, t) => s + Math.max(0, t.due - (t.regle || 0)), 0)));
                    const derniereValidation = ref(null);
                    const validerChargesEchues = () => {
                        const liste = chargesFixesEchues.value.slice();
                        if (!liste.length) return 0;
                        const cyc = cyclePilotage.value;
                        const jour = _aujourdhuiISO();
                        const avant = liste.map(t => {
                            const e = _etatCycle(t.ref, cyc);
                            return { ref: t.ref, due: t.due, etat: e ? Object.assign({}, e) : null };
                        });
                        liste.forEach(t => _poserEtatCycle(t.ref, cyc, { paye: true, montantPaye: t.due, dateReelle: jour }));
                        derniereValidation.value = {
                            cyc, jour, avant, n: liste.length,
                            montant: Math.round(liste.reduce((s, t) => s + Math.max(0, t.due - (t.regle || 0)), 0)),
                            libelles: liste.map(t => t.libelle),
                        };
                        handleDataChange();
                        return liste.length;
                    };
                    //  Annuler rend EXACTEMENT l'état d'avant — avance partielle
                    //  comprise — et seulement sur les lignes que personne n'a
                    //  retouchées depuis.
                    const annulerValidation = () => {
                        const v = derniereValidation.value;
                        if (!v) return 0;
                        let n = 0;
                        v.avant.forEach(({ ref, due, etat }) => {
                            const now = _etatCycle(ref, v.cyc);
                            const intact = now && now.paye === true && Number(now.montantPaye) === Number(due) && now.dateReelle === v.jour;
                            if (!intact) return;
                            if (etat) _poserEtatCycle(ref, v.cyc, etat);
                            else if (ref && ref.trackerRealise) delete ref.trackerRealise[_cycleDe(ref, v.cyc)];
                            n++;
                        });
                        derniereValidation.value = null;
                        handleDataChange();
                        return n;
                    };

                    //  ── LES BULLES : une seule ouverte, et elle capte le pointeur ──
                    //  Mesuré sur la vidéo du 04/10 : la bulle de « Budget conso »
                    //  laissait passer la souris (pointer-events-none) jusqu'à la
                    //  carte du dessous, qui ouvrait la sienne ; avec le fondu, les
                    //  deux restaient affichées l'une sur l'autre. Un z-index plus
                    //  haut n'y change rien : les deux bulles l'auraient. Il faut
                    //  qu'il n'y en ait qu'une.
                    const bulleOuverte = ref(null);
                    const bulleEpinglee = ref(false);
                    const _souris = (e) => !e || !e.pointerType || e.pointerType === 'mouse';
                    const survolBulle = (cle, e) => {
                        if (!_souris(e)) return;                                   // au doigt : le tap décide
                        if (bulleEpinglee.value && bulleOuverte.value !== cle) return;
                        bulleOuverte.value = cle;
                    };
                    const quitterBulle = (cle, e) => {
                        if (!_souris(e)) return;
                        if (!bulleEpinglee.value && bulleOuverte.value === cle) bulleOuverte.value = null;
                    };
                    const basculerBulle = (cle) => {
                        if (bulleOuverte.value === cle && bulleEpinglee.value) { bulleOuverte.value = null; bulleEpinglee.value = false; }
                        else { bulleOuverte.value = cle; bulleEpinglee.value = true; }
                    };
                    const fermerBulle = () => { bulleOuverte.value = null; bulleEpinglee.value = false; };
                    document.addEventListener('click', (e) => {
                        if (!bulleOuverte.value) return;
                        const t = e.target;
                        if (t && t.closest && t.closest('[data-bulle-cle]')) return;   // la carte gère son propre clic
                        fermerBulle();
                    });
                    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && bulleOuverte.value) fermerBulle(); });

                    const allerAInbox = () => {
                        const el = document.getElementById('pilotage-inbox');
                        if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    };
""")

# ── 6. Les constantes, posées avant tout usage ───────────────────────────────
sub('constantes près de _rangDansCycle',
"""                    const _rangDansCycle = rangDansCycle;   // v37.15 : la formule vit désormais près de jourDePaie""",
"""                    const _rangDansCycle = rangDansCycle;   // v37.15 : la formule vit désormais près de jourDePaie
                    //  v37.16 : « cette semaine » = aujourd'hui + 7 jours de rang. Une
                    //  constante, pour que le badge, le paquet et la carte Urgence
                    //  ne puissent pas diverger.
                    const HORIZON_URGENCE = 7;
                    //  Une table, partagée par la liste, la progression par nature et
                    //  le bouton de validation.
                    const NATURES_TACHE = {
                        fixe:         { badge: '🏢 Fixe',         teinte: 'orange' },
                        variable:     { badge: '🛒 Variable',     teinte: 'blue' },
                        epargne:      { badge: '💎 Épargne',      teinte: 'purple' },
                        exceptionnel: { badge: '⚠️ Exceptionnel', teinte: 'rose' },
                    };""")

# ── 7. Exposition au template ────────────────────────────────────────────────
sub('exposition setup',
"""                        _rangAujourdhuiTest: _rangAujourdhui,""",
"""                        _rangAujourdhuiTest: _rangAujourdhui,
                        // v37.16 : cockpit du Pilotage
                        HORIZON_URGENCE, NATURES_TACHE, finCycleDate, kpiUrgence, kpiProgression, formatNombre,
                        atterrissageCycle, kpiAtterrissage, chargesFixesEchues, montantChargesFixesEchues,
                        derniereValidation, validerChargesEchues, annulerValidation,
                        bulleOuverte, bulleEpinglee, survolBulle, quitterBulle, basculerBulle, fermerBulle, allerAInbox,""")

for a, r in edits:
    src = src.replace(a, r, 1)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ {len(edits)} modifications appliquées à {F}')
