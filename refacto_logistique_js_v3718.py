# -*- coding: utf-8 -*-
"""
v37.18 Logistique-Bancaire — PARTIE LOGIQUE.

  compteDeFlux(nature, item)  — le compte débité (ou crédité) par chaque ligne.
                                C'est la règle EXACTE du moteur du Relevé :
                                fixes → « compte des charges fixes », variables →
                                « compte des charges variables », épargne et
                                exceptionnel → leur compte source, revenu → sa
                                destination. Une ligne affiche donc le compte que
                                le Relevé débitera, jamais un autre.
  radarComptes                — le Relevé projeté jusqu'au cycle de décembre, compte
                                par compte : solde du jour, POINT BAS, fin d'année.
                                « À virer » = ce qui garde le point bas à zéro : un
                                compte qui plonge en novembre et remonte en
                                décembre a besoin d'argent AVANT novembre, même si
                                sa fin d'année est positive.
  focusCompte                 — un filtre d'un clic. Il filtre les tâches à la
                                source (tachesPilotage), donc la file, l'Urgence, la
                                Progression et le bouton ⚡ le suivent d'eux-mêmes.
                                La Météo, elle, reste globale.
"""
import io, sys
F = 'index.html'
src = io.open(F, encoding='utf-8').read()
edits = []
def sub(label, anchor, replacement, expected=1):
    n = src.count(anchor)
    if n != expected:
        print(f'✖ {label} : {n} ancre(s), {expected} attendue(s)'); sys.exit(1)
    edits.append((anchor, replacement))

# 1. Le Relevé dit à quel cycle appartient chaque ligne (pour dater le point bas)
sub('cycle sur chaque ligne du Relevé',
"""                                entries.push({ libelle: l.libelle, montant: l.montant, type: l.type, jourPrevu: l.jourPrevu, etat: 'prevu', soldeApres: soldeCompteApres, compteKey: l.account, soldeCompteApres });""",
"""                                entries.push({ libelle: l.libelle, montant: l.montant, type: l.type, jourPrevu: l.jourPrevu, etat: 'prevu', soldeApres: soldeCompteApres, compteKey: l.account, soldeCompteApres, cycle: cyc.m + '-' + cyc.a });""")

# 2. Les tâches portent leur compte ; le focus filtre à la source
sub('tachesPilotage devient la liste complète',
"""                    const tachesPilotage = computed(() => {""",
"""                    const tachesPilotageToutes = computed(() => {""")
sub('compte de chaque tâche',
"""                                cle: groupe + ':' + (ref.id != null ? ref.id : libelle),""",
"""                                cle: groupe + ':' + (ref.id != null ? ref.id : libelle),
                                //  v37.18 : le compte que le Relevé débitera pour cette ligne
                                compte: compteDeFlux(nature, ref),""")
sub('focus appliqué aux tâches',
"""                    const tachesATraiter = computed(() => tachesPilotage.value.filter(t => !t.paye));""",
"""                    //  v37.18 : FOCUS BANCAIRE — filtré ici, à la source : la file,
                    //  l'Urgence, la Progression et le bouton ⚡ suivent sans exception.
                    const tachesPilotage = computed(() => focusCompte.value
                        ? tachesPilotageToutes.value.filter(t => t.compte === focusCompte.value)
                        : tachesPilotageToutes.value);
                    const tachesATraiter = computed(() => tachesPilotage.value.filter(t => !t.paye));""")

# 3. L'atterrissage : global pour la Météo, focalisé pour la carte
sub('kpiAtterrissage global',
"""                    const kpiAtterrissage = computed(() => {
                        const a = atterrissageCycle.value;""",
"""                    const kpiAtterrissage = computed(() => {
                        const g = kpiAtterrissageGlobal.value;
                        const f = focusCompte.value;
                        if (!f) return g;
                        //  En focus, la carte parle du compte choisi — et de lui seul.
                        const info = infoCompte(f);
                        const c = atterrissageCycle.value.comptes.find(x => x.key === f)
                               || { key: f, icon: info.icone, label: info.label, reel: info.reel, atterrissage: 0, t0: 0, entrees: 0, sorties: 0, lignes: [] };
                        const neg = c.reel && c.atterrissage < 0;
                        return { ...g, montant: c.atterrissage, courant: c, alertes: [], vedette: neg ? c : null, negatif: neg, focus: f };
                    });
                    const kpiAtterrissageGlobal = computed(() => {
                        const a = atterrissageCycle.value;""")
sub('la Météo lit le global', """                        const A = kpiAtterrissage.value;
                        const R = respirationBudgetaire.value;""",
"""                        const A = kpiAtterrissageGlobal.value;
                        const R = respirationGlobale.value;""")

# 4. La respiration : par compte quand on le demande
sub('signature respirationDuMois', """                    const respirationDuMois = (an, m) => {""",
"""                    const respirationDuMois = (an, m, compte = null) => {""")
for a, b in (
    ("""if (v > 0) lignes.revenus.push({ nom: r.label || r.nom || '?', montant: v, jourPrevu: r.jourPrevu || null });""",
     """if (v > 0) lignes.revenus.push({ nom: r.label || r.nom || '?', montant: v, jourPrevu: r.jourPrevu || null, compte: compteDeFlux('revenu', r), nature: 'revenu' });"""),
    ("""if (v > 0) lignes.fixes.push({ nom: f.label || '?', montant: v, jourPrevu: f.jourPrevu || null });""",
     """if (v > 0) lignes.fixes.push({ nom: f.label || '?', montant: v, jourPrevu: f.jourPrevu || null, compte: compteDeFlux('fixe', f), nature: 'fixe' });"""),
    ("""lignes.conso.push({ nom: c.label || '?', montant: Math.round(v * 4.3 * 100) / 100, parSemaine: v });""",
     """lignes.conso.push({ nom: c.label || '?', montant: Math.round(v * 4.3 * 100) / 100, parSemaine: v, compte: compteDeFlux('variable', c), nature: 'variable' });"""),
    ("""lignes.mensuelles.push({ nom: c.label || '?', montant: v, jourPrevu: c.jourPrevu || null, detail: det.join(' · ') });""",
     """lignes.mensuelles.push({ nom: c.label || '?', montant: v, jourPrevu: c.jourPrevu || null, detail: det.join(' · '), compte: compteDeFlux('variable', c), nature: 'variable' });"""),
    ("""if (v > 0) lignes.epargne.push({ nom: ep.nom || ep.label || '?', montant: v, jourPrevu: ep.jourPrevu || null });""",
     """if (v > 0) lignes.epargne.push({ nom: ep.nom || ep.label || '?', montant: v, jourPrevu: ep.jourPrevu || null, compte: compteDeFlux('epargne', ep), nature: 'epargne', ref: ep });"""),
    ("""if (v > 0) lignes.exceptionnel.push({ nom: x.nom || x.label || '?', montant: v });
                            else if (v < 0) lignes.injections.push({ nom: x.nom || x.label || '?', montant: -v });""",
     """if (v > 0) lignes.exceptionnel.push({ nom: x.nom || x.label || '?', montant: v, compte: compteDeFlux('exceptionnel', x), nature: 'exceptionnel', ref: x });
                            else if (v < 0) lignes.injections.push({ nom: x.nom || x.label || '?', montant: -v, compte: compteDeFlux('exceptionnel', x), nature: 'injection', ref: x });"""),
):
    sub('ligne de respiration ' + a[:40], a, b)
sub('filtre par compte de la respiration', """                        const somme = (a) => Math.round(a.reduce((s, x) => s + x.montant, 0));
                        const revenus = somme(lignes.revenus), injections = somme(lignes.injections);""",
"""                        if (compte) Object.keys(lignes).forEach(k => { lignes[k] = lignes[k].filter(x => x.compte === compte); });
                        const somme = (a) => Math.round(a.reduce((s, x) => s + x.montant, 0));
                        const revenus = somme(lignes.revenus), injections = somme(lignes.injections);""")
sub('respiration globale + focalisée', """                    const respirationBudgetaire = computed(() => {
                        calculationTick.value;
                        return respirationDuMois(moisBudgetaire.value.an, moisBudgetaire.value.mois);
                    });""",
"""                    //  La Météo lit TOUJOURS le budget entier ; l'écran du Prévisionnel
                    //  suit le focus bancaire.
                    const respirationGlobale = computed(() => {
                        calculationTick.value;
                        return respirationDuMois(moisBudgetaire.value.an, moisBudgetaire.value.mois);
                    });
                    const respirationBudgetaire = computed(() => {
                        calculationTick.value;
                        return focusCompte.value
                            ? respirationDuMois(moisBudgetaire.value.an, moisBudgetaire.value.mois, focusCompte.value)
                            : respirationGlobale.value;
                    });""")

# 5. Le cœur : routage, radar, focus — posé avec les constantes du cockpit
sub('bloc logistique', """                    const HORIZON_URGENCE = 7;""",
"""                    const HORIZON_URGENCE = 7;

                    /* ═══════════════════════════════════════════════════════════════
                       v37.18 — LOGISTIQUE BANCAIRE
                       « Où l'argent doit-il se trouver, et quand ? »
                       ═══════════════════════════════════════════════════════════════ */
                    const _cleCourant = computed(() => {
                        const c = (comptes.value || []).find(x => x.type === 'courant' || x.type === 'liquide');
                        return c ? 'cpt_' + c.id : 'courant';
                    });
                    const cleDeCompte = (k) => _cleCompte(k, _cleCourant.value);
                    //  La règle de routage du moteur du Relevé (_mkLegs), mot pour mot.
                    const compteDeFlux = (nature, item) => {
                        const si = soldesInitiaux.value || {};
                        const it = item || {};
                        if (nature === 'fixe') return cleDeCompte(si.compteChargesFixes || 'courant');
                        if (nature === 'variable') return cleDeCompte(si.compteChargesVariables || 'courant');
                        if (nature === 'epargne') return cleDeCompte(it.sourceCompte || 'courant');
                        if (nature === 'exceptionnel') return cleDeCompte(it.sourceCompte);
                        if (nature === 'revenu') return cleDeCompte(it.destinationCompte);
                        return cleDeCompte('courant');
                    };
                    //  …et la même règle, dite en clair, pour la bulle.
                    const regleDeRoutage = (nature, item) => {
                        const it = item || {};
                        if (nature === 'fixe') return 'Toutes les charges fixes sortent de ce compte (réglage « compte des charges fixes »).';
                        if (nature === 'variable') return 'Toutes les charges variables sortent de ce compte (réglage « compte des charges variables »).';
                        if (nature === 'epargne') return 'Transfert vers « ' + (it.nom || it.label || 'épargne') + ' » ; compte source choisi sur cette épargne' + (it.sourceCompte ? '' : ' (par défaut : le courant)') + '.';
                        if (nature === 'exceptionnel') return it.sourceCompte ? 'Compte source choisi sur cette dépense.' : 'Aucun compte choisi sur cette dépense : par défaut, le compte courant.';
                        if (nature === 'revenu' || nature === 'injection') return 'Arrive sur ce compte (destination choisie sur la ligne).';
                        return '';
                    };
                    //  Une couleur stable par compte, dans l'ordre de la liste des comptes.
                    const PALETTE_COMPTES = ['bg-indigo-500', 'bg-amber-500', 'bg-teal-500', 'bg-pink-500', 'bg-lime-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-yellow-400'];
                    const infoCompte = (key) => {
                        const k = key || _cleCourant.value;
                        const liste = comptes.value || [];
                        const i = liste.findIndex(c => 'cpt_' + c.id === k);
                        const base = _infoCompteKey(k);
                        const label = i >= 0 ? (liste[i].label || base.label) : (k === 'courant' ? 'Compte Courant' : base.label);
                        return {
                            key: k, label, icone: i >= 0 ? (liste[i].icone || base.icon) : base.icon,
                            court: (String(label).replace(/^compte\\s+/i, '') || label),
                            couleur: k.startsWith('ep_') ? 'bg-violet-400' : PALETTE_COMPTES[Math.max(0, i) % PALETTE_COMPTES.length],
                            reel: k === _cleCourant.value || k.startsWith('cpt_'),
                        };
                    };

                    //  Le filtre d'un clic. Pas mémorisé : on ne doit jamais oublier
                    //  qu'on regarde un seul compte.
                    const focusCompte = ref(null);
                    const comptesFocus = computed(() => (comptes.value || []).map(c => infoCompte('cpt_' + c.id)));

                    //  LE RADAR : le Relevé, du cycle en cours au cycle de décembre.
                    const _MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
                    const radarComptes = computed(() => {
                        calculationTick.value;
                        const mb = moisBudgetaire.value;
                        const jdp = jourDePaie.value;
                        const cycles = [];
                        for (let m = mb.mois; m <= 12; m++) cycles.push(m + '-' + mb.an);
                        const finAnnee = new Date(mb.an, 11, jdp > 1 ? jdp - 1 : 31);
                        const vide = { comptes: [], besoins: [], totalAVirer: 0, horizon: finAnnee.getDate() + ' ' + _MOIS_COURTS[11] };
                        let j;
                        try { j = _buildJournalReleve([], cycles); } catch (e) { return vide; }
                        if (!j) return vide;
                        //  Date réelle d'une ligne : le jour de paie ou après → mois PRÉCÉDENT
                        //  du cycle (le cycle de novembre court du 27 oct. au 26 nov.).
                        const dateDe = (jour, cycle) => {
                            const [cm, ca] = String(cycle || (mb.mois + '-' + mb.an)).split('-').map(Number);
                            let m = cm, a = ca;
                            if (jdp > 1 && Number(jour) >= jdp) { m--; if (m < 1) { m = 12; a--; } }
                            const der = new Date(a, m, 0).getDate();
                            return new Date(a, m - 1, Math.min(Math.max(1, Number(jour) || 1), der));
                        };
                        const lib = (d) => d ? d.getDate() + ' ' + _MOIS_COURTS[d.getMonth()] : null;
                        const series = {};
                        (j.entries || []).forEach(e => {
                            const k = e.compteKey;
                            if (!k) return;
                            const s = series[k] || (series[k] = []);
                            if (e.type === 'initial') s.push({ solde: Number(e.montant) || 0, date: null, aujourdhui: true });
                            else if (e.type === 'credit' || e.type === 'debit')
                                s.push({ solde: Number(e.soldeCompteApres) || 0, date: dateDe(e.jourPrevu, e.cycle), libelle: e.libelle, montant: Number(e.montant) || 0, type: e.type });
                        });
                        const fin = j.soldesFinaux || {};
                        const out = Object.keys(fin).map(k => {
                            const info = infoCompte(k);
                            if (!info.reel) return null;                       // une poche virtuelle ne se met pas à découvert
                            const s = series[k] || [];
                            const lignes = s.filter(p => !p.aujourdhui);
                            const t0 = s.length && s[0].aujourdhui ? s[0].solde
                                     : Math.round((Number(fin[k]) || 0) - lignes.reduce((x, p) => x + (p.type === 'credit' ? p.montant : -p.montant), 0));
                            const points = [t0].concat(lignes.map(p => p.solde));
                            let iBas = 0;
                            points.forEach((v, i) => { if (v < points[iBas]) iBas = i; });
                            const iNeg = points.findIndex(v => v < -0.5);
                            const pointBas = Math.round(points[iBas]);
                            const aVirer = pointBas < 0 ? Math.ceil(-pointBas) : 0;
                            const dateNeg = iNeg <= 0 ? null : lignes[iNeg - 1].date;
                            return {
                                ...info, t0: Math.round(t0), fin: Math.round(Number(fin[k]) || 0), pointBas,
                                datePointBas: iBas === 0 ? 'aujourd’hui' : lib(lignes[iBas - 1].date),
                                avantLe: iNeg === 0 ? 'aujourd’hui' : lib(dateNeg),
                                aVirer,
                                entrees: Math.round(lignes.filter(p => p.type === 'credit').reduce((x, p) => x + p.montant, 0)),
                                sorties: Math.round(lignes.filter(p => p.type === 'debit').reduce((x, p) => x + p.montant, 0)),
                                points: points.map(v => Math.round(v)), nbLignes: lignes.length, donneur: null,
                            };
                        }).filter(Boolean);
                        //  D'où virer ? Le compte qui garde le plus de marge AU PLUS BAS —
                        //  le retirer aujourd'hui baisse tout son chemin du même montant.
                        const capacite = {};
                        out.forEach(c => { capacite[c.key] = Math.max(0, c.pointBas); });
                        out.filter(c => c.aVirer > 0).sort((a, b) => b.aVirer - a.aVirer).forEach(c => {
                            const d = out.filter(x => x.key !== c.key && capacite[x.key] >= c.aVirer).sort((a, b) => capacite[b.key] - capacite[a.key])[0];
                            if (d) { c.donneur = { key: d.key, label: d.label, court: d.court, resteAuPlusBas: capacite[d.key] - c.aVirer }; capacite[d.key] -= c.aVirer; }
                        });
                        out.sort((a, b) => (b.aVirer > 0) - (a.aVirer > 0) || b.aVirer - a.aVirer || (b.key === _cleCourant.value) - (a.key === _cleCourant.value));
                        const besoins = out.filter(c => c.aVirer > 0);
                        return { comptes: out, besoins, totalAVirer: besoins.reduce((x, c) => x + c.aVirer, 0),
                                 horizon: lib(finAnnee), annee: mb.an };
                    });
                    const radarParCle = computed(() => Object.fromEntries(radarComptes.value.comptes.map(c => [c.key, c])));
                    //  Tout ce que la bulle d'une ligne doit savoir sur son compte.
                    const mecaniqueCompte = (key) => {
                        const info = infoCompte(key);
                        const r = radarParCle.value[key] || null;
                        const cy = (atterrissageCycle.value.comptes || []).find(c => c.key === key) || null;
                        return { ...info, radar: r, finCycle: cy ? cy.atterrissage : null, t0: r ? r.t0 : (cy ? cy.t0 : null), horizon: radarComptes.value.horizon };
                    };""")

# 5 bis. La Météo dit, en une ligne, le virement le plus pressant
sub('logistique dans la météo', """                            retro: isCyclePasse.value, cycleConsulte: pilotageCycleLabel.value,
                        };""", """                            retro: isCyclePasse.value, cycleConsulte: pilotageCycleLabel.value,
                            logistique: (() => {
                                const r = radarComptes.value;
                                const b = r.besoins[0];
                                if (!b) return null;
                                return '🏦 Virer ' + formatMAD(b.aVirer) + ' sur ' + b.label + ' avant le ' + b.avantLe
                                     + (b.donneur ? ', depuis ' + b.donneur.label : '')
                                     + ', pour tenir jusqu’au ' + r.horizon.replace(/\.$/, '') + '.'
                                     + (r.besoins.length > 1 ? ' (+ ' + (r.besoins.length - 1) + ' autre' + (r.besoins.length > 2 ? 's' : '') + ' compte' + (r.besoins.length > 2 ? 's' : '') + ')' : '');
                            })(),
                        };""")

# 5 ter. La Météo garde une Urgence GLOBALE, même en focus
sub('urgence globale', """                    const kpiUrgence = computed(() => {""", """                    //  v37.18 : la Météo ne suit pas le focus — son « 7 prochains jours »
                    //  se calcule sur TOUTES les tâches, avec la même règle que les paquets.
                    const urgenceGlobale = computed(() => {
                        const r = _rangAujourdhui.value;
                        return Math.round(tachesPilotageToutes.value
                            .filter(t => !t.paye && t.rang <= r + HORIZON_URGENCE)
                            .reduce((s, t) => s + Math.max(0, t.due - (t.regle || 0)), 0));
                    });
                    const kpiUrgence = computed(() => {""")
sub('météo sur urgence globale', """atterrissage: courant, dateFin: A.dateFin, urgence: kpiUrgence.value.montant,""",
    """atterrissage: courant, dateFin: A.dateFin, urgence: urgenceGlobale.value,""")

# 6. Exposition
sub('exposition', """                        surbrillanceEchues, estEchue,""",
"""                        surbrillanceEchues, estEchue,
                        // v37.18 : logistique bancaire
                        compteDeFlux, regleDeRoutage, infoCompte, focusCompte, comptesFocus, radarComptes,
                        mecaniqueCompte, tachesPilotageToutes, kpiAtterrissageGlobal, respirationGlobale,""")

for a, r in edits: src = src.replace(a, r, 1)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ {len(edits)} modifications appliquées à {F}')
