# -*- coding: utf-8 -*-
"""
v37.50 — UN COMPTE PAR LIGNE (moteurs).

« Je pourrai affecter chaque charge à un compte, pas un compte global pour chaque catégorie. »

Chaque charge fixe et chaque charge variable peut porter son compte (item.compte). Sans choix,
elle suit le compte par défaut de sa famille (« Prélever toutes les charges fixes sur… ») : rien
ne bouge tant que rien n'est choisi. Le vieux champ sourceCompte de ces lignes reste ignoré
(v24.80) — il vaut « courant » sur toutes vos charges fixes alors qu'elles partent d'Assafa.

Une seule règle, compteDeLaCharge(nature, item), lue par TOUS les moteurs : Relevé (cycle en
cours et cycles futurs), reste à payer par compte, Pilotage, surplus et périmètre, Météo, Bilan,
projection, tickets de la Météo, et le CFO côté serveur (cfo_intent_engine.php).
"""
import io, sys

def patcher(F, subs):
    src = io.open(F, encoding='utf-8').read()
    for label, a, b in subs:
        c = src.count(a)
        if c != 1:
            print(f'✖ {F} — {label} : {c} ancre(s), 1 attendue'); sys.exit(1)
        src = src.replace(a, b)
    io.open(F, 'w', encoding='utf-8').write(src)

H = []
# ── La règle, et le routage dit en clair ─────────────────────────────────
H.append(('compteDeFlux', """                    const compteDeFlux = (nature, item) => {
                        const si = soldesInitiaux.value || {};
                        const it = item || {};
                        if (nature === 'fixe') return cleDeCompte(si.compteChargesFixes || 'courant');
                        if (nature === 'variable') return cleDeCompte(si.compteChargesVariables || 'courant');""",
"""                    //  v37.50 — LE COMPTE D'UNE CHARGE : le sien s'il est choisi (item.compte), sinon le
                    //  compte par défaut de sa famille (« Prélever toutes les charges … sur »). Le vieux
                    //  champ sourceCompte des lignes fixes / variables reste ignoré (v24.80) : il vaut
                    //  « courant » partout, il ne doit rien déplacer. Clé BRUTE (courant, cpt_…, ep_…).
                    const compteDeLaCharge = (nature, item) => {
                        const it = item || {}, si = soldesInitiaux.value || {};
                        if (it.compte) return it.compte;
                        return nature === 'fixe' ? (si.compteChargesFixes || 'courant') : (si.compteChargesVariables || 'courant');
                    };
                    const compteDeFlux = (nature, item) => {
                        const si = soldesInitiaux.value || {};
                        const it = item || {};
                        if (nature === 'fixe') return cleDeCompte(compteDeLaCharge('fixe', it));
                        if (nature === 'variable') return cleDeCompte(compteDeLaCharge('variable', it));"""))
H.append(('regleDeRoutage', """                        if (nature === 'fixe') return 'Toutes les charges fixes sortent de ce compte (réglage « compte des charges fixes »).';
                        if (nature === 'variable') return 'Toutes les charges variables sortent de ce compte (réglage « compte des charges variables »).';""",
"""                        if (nature === 'fixe') return it.compte ? 'Compte choisi sur cette charge fixe (Budget Structurel).' : 'Compte par défaut des charges fixes (Budget Structurel), aucun compte choisi sur cette ligne.';
                        if (nature === 'variable') return it.compte ? 'Compte choisi sur cette charge variable (Budget Structurel).' : 'Compte par défaut des charges variables (Budget Structurel), aucun compte choisi sur cette ligne.';"""))
H.append(('Météo : la ligne garde sa charge (bulle de routage)', """                            const l = { cle, nom: f.label || '?', montant: v, jourPrevu: f.jourPrevu || null, compte: compteDeFlux('fixe', f), nature: 'fixe' };""",
"""                            const l = { cle, nom: f.label || '?', montant: v, jourPrevu: f.jourPrevu || null, compte: compteDeFlux('fixe', f), nature: 'fixe', ref: f };"""))

# ── Le reste à payer et l'enveloppe, compte par compte ──────────────────
H.append(('reste à payer par compte', """                    // v28.40 RÈGLE 2 : Reste variable = enveloppe prorata temporis (plus de saisie manuelle)
                    const resteAPayerVariables = computed(() => enveloppeVariableProrata.value);""",
"""                    // v28.40 RÈGLE 2 : Reste variable = enveloppe prorata temporis (plus de saisie manuelle)
                    const resteAPayerVariables = computed(() => enveloppeVariableProrata.value);
                    //  v37.50 : les mêmes restes, COMPTE PAR COMPTE (clé brute du compte de chaque ligne).
                    //  Σ = resteAPayerFixes / resteAPayerFactures, au centime.
                    const resteAPayerFixesParCompte = computed(() => {
                        calculationTick.value;
                        const an = soldesInitiaux.value.anneeActuelle;
                        const d = donneesAnnuelles.value[an], out = {};
                        if (!d) return out;
                        Object.values(d.chargesFixes || {}).forEach(f => {
                            const due = getDueFixe(f, an);
                            if (!(due > 0)) return;
                            const r = Math.max(0, due - getPaidAmount(f, due));
                            if (r > 0) { const k = compteDeLaCharge('fixe', f); out[k] = (out[k] || 0) + r; }
                        });
                        return out;
                    });
                    const resteAPayerFacturesParCompte = computed(() => {
                        calculationTick.value;
                        const mb = moisBudgetaire.value;
                        const d = donneesAnnuelles.value[mb.an], out = {};
                        if (!d) return out;
                        Object.values(d.chargesVariables || {}).filter(cv => cv && cv.categorieId === 'cat_cv_factures').forEach(cv => {
                            const k = compteDeLaCharge('variable', cv);
                            ((cv.details || []).length ? cv.details : [cv]).forEach(det => {
                                const due = Number(det.montant ?? det.valeur ?? 0);
                                if (due > 0) { const r = Math.max(0, due - getPaidAmount(det, due)); if (r > 0) out[k] = (out[k] || 0) + r; }
                            });
                        });
                        return out;
                    });"""))
H.append(('enveloppe par compte', """                    // Nom historique conservé : tout le moteur (journal, reste à payer, relevé)
                    // consomme ce getter — il pointe maintenant sur l'enveloppe réelle.
                    const enveloppeVariableProrata = computed(() => enveloppeConsoRestante.value);""",
"""                    // Nom historique conservé : tout le moteur (journal, reste à payer, relevé)
                    // consomme ce getter — il pointe maintenant sur l'enveloppe réelle.
                    const enveloppeVariableProrata = computed(() => enveloppeConsoRestante.value);
                    //  v37.50 : l'enveloppe conso, COMPTE PAR COMPTE. Toutes les catégories sur le même
                    //  compte (le cas d'avant) : l'enveloppe entière, au dirham. Sinon chaque compte porte
                    //  le reste de SES catégories — un dépassement sur un compte ne se rembourse pas
                    //  sur un autre.
                    const enveloppeConsoParCompte = computed(() => {
                        calculationTick.value;
                        if (isCyclePasse.value) return {};
                        const d = donneesAnnuelles.value[consoT0Annee.value] || {};
                        const cvs = d.chargesVariables || {};
                        const uns = [...new Set(Object.values(cvs).filter(cv => cv && cv.categorieId !== 'cat_cv_factures').map(cv => compteDeLaCharge('variable', cv)))];
                        const total = Number(enveloppeConsoRestante.value || 0);
                        if (uns.length <= 1) return total > 0 ? { [uns[0] || compteDeLaCharge('variable', null)]: total } : {};
                        const reel = consoT0Renseigne.value, ratio = joursCycleRestants.value / joursCycleTotal.value;
                        const out = {};
                        consoCategoriesT0.value.forEach(c => {
                            const k = compteDeLaCharge('variable', cvs[c.key]);
                            out[k] = (out[k] || 0) + (reel ? (c.budget - c.engage) : c.budget * ratio);
                        });
                        Object.keys(out).forEach(k => { out[k] = Math.max(0, Math.round(out[k])); if (!out[k]) delete out[k]; });
                        return out;
                    });"""))
H.append(('le détail conso garde sa catégorie', """                        const lignes = cats.map(c => ({
                            nom: c.label,
                            montant: Math.round(reel ? (c.budget - c.engage) : (c.budget * ratio)),
                            estim: !reel,
                        }));""", """                        const lignes = cats.map(c => ({
                            nom: c.label, key: c.key,   // v37.50 : pour la ranger sous le compte de SA catégorie
                            montant: Math.round(reel ? (c.budget - c.engage) : (c.budget * ratio)),
                            estim: !reel,
                        }));"""))

# ── Le Relevé ────────────────────────────────────────────────────────────
H.append(('Relevé : cycle en cours', """                                // 💳 Charges fixes — Règle 1 (due − avance)
                                const _resteFix = Math.round(Number(resteAPayerFixes.value || 0) * 100) / 100;
                                if (_resteFix > 0) out.push({ account: _fxSrc, libelle: '💳 Total Charges Fixes', montant: _resteFix, type: 'debit', jourPrevu: 10, internal: false });
                                // 🧾 Factures — Règle 1 (due − avance), même traitement que les fixes (v28.90)
                                const _resteFact = Math.round(Number(resteAPayerFactures.value || 0) * 100) / 100;
                                if (_resteFact > 0) out.push({ account: _varSrc, libelle: '🧾 Total Factures', montant: _resteFact, type: 'debit', jourPrevu: 6, internal: false });
                                // 🛒 Variables consommables — Règle 2 (prorata temporis, HORS factures)
                                const _envVar = Math.round(Number(enveloppeVariableProrata.value || 0) * 100) / 100;
                                //  v37.46 : une ligne par semaine restante, plus un bloc au 15
                                semainesVariablesDuCycle(m, a, _envVar, new Date()).forEach(s =>
                                    out.push({ account: _varSrc, libelle: s.libelle, montant: s.montant, type: 'debit', jourPrevu: s.jour, internal: false, variableSemaine: true }));""",
"""                                //  v37.50 : chaque reste sur le compte de SES lignes (un seul compte : une ligne, comme avant)
                                const _parCompte = (src) => { const o = {}; Object.entries(src || {}).forEach(([k, v]) => { const n = _normKey(k); o[n] = (o[n] || 0) + Number(v || 0); }); return o; };
                                // 💳 Charges fixes — Règle 1 (due − avance)
                                Object.entries(_parCompte(resteAPayerFixesParCompte.value)).forEach(([k, v]) => {
                                    const _resteFix = Math.round(v * 100) / 100;
                                    if (_resteFix > 0) out.push({ account: k, libelle: '💳 Total Charges Fixes', montant: _resteFix, type: 'debit', jourPrevu: 10, internal: false });
                                });
                                // 🧾 Factures — Règle 1 (due − avance), même traitement que les fixes (v28.90)
                                Object.entries(_parCompte(resteAPayerFacturesParCompte.value)).forEach(([k, v]) => {
                                    const _resteFact = Math.round(v * 100) / 100;
                                    if (_resteFact > 0) out.push({ account: k, libelle: '🧾 Total Factures', montant: _resteFact, type: 'debit', jourPrevu: 6, internal: false });
                                });
                                // 🛒 Variables consommables — Règle 2 (prorata temporis, HORS factures)
                                //  v37.46 : une ligne par semaine restante, plus un bloc au 15
                                Object.entries(_parCompte(enveloppeConsoParCompte.value)).forEach(([k, v]) => {
                                    const _envVar = Math.round(v * 100) / 100;
                                    semainesVariablesDuCycle(m, a, _envVar, new Date()).forEach(s =>
                                        out.push({ account: k, libelle: s.libelle, montant: s.montant, type: 'debit', jourPrevu: s.jour, internal: false, variableSemaine: true }));
                                });"""))
H.append(('Relevé : fixes des cycles futurs', """                                    const amt = _amt(f, f.valeur);
                                    if (amt > 0) acc[_fxSrc] = Math.round(((acc[_fxSrc] || 0) + amt) * 100) / 100;""",
"""                                    const amt = _amt(f, f.valeur);
                                    const k = _normKey(compteDeLaCharge('fixe', f));   // v37.50
                                    if (amt > 0) acc[k] = Math.round(((acc[k] || 0) + amt) * 100) / 100;"""))
H.append(('Relevé : variables des cycles futurs', """                                    const amt = _varAmt(cv);
                                    if (amt > 0) acc[_varSrc] = Math.round(((acc[_varSrc] || 0) + amt) * 100) / 100;""",
"""                                    const amt = _varAmt(cv);
                                    const k = _normKey(compteDeLaCharge('variable', cv));   // v37.50
                                    if (amt > 0) acc[k] = Math.round(((acc[k] || 0) + amt) * 100) / 100;"""))

# ── Le journal du Pilotage (mois par mois) ───────────────────────────────
H.append(('Pilotage : mois en cours', """                            const resteFixe = Number(resteAPayerFixes.value || 0);
                            if (resteFixe > 0) {
                                unpaidItems.push({
                                    libelle: '💳 Total Charges Fixes',
                                    montant: resteFixe, type: 'debit',
                                    jourPrevu: 10,
                                    etat: 'prevu',
                                    sourceCompte: soldesInitiaux.value.compteChargesFixes || 'courant'
                                });
                            }
                            // v28.90 Factures-Fix : ligne Factures (Règle 1, due − avance), routée variables
                            const resteFact = Number(resteAPayerFactures.value || 0);
                            if (resteFact > 0) {
                                unpaidItems.push({
                                    libelle: '🧾 Total Factures',
                                    montant: resteFact, type: 'debit',
                                    jourPrevu: 6,
                                    etat: 'prevu',
                                    sourceCompte: soldesInitiaux.value.compteChargesVariables || 'courant'
                                });
                            }""", """                            //  v37.50 : une ligne par compte (un seul compte : une ligne, comme avant)
                            Object.entries(resteAPayerFixesParCompte.value).forEach(([src, resteFixe]) => {
                                if (resteFixe > 0) unpaidItems.push({ libelle: '💳 Total Charges Fixes', montant: resteFixe, type: 'debit', jourPrevu: 10, etat: 'prevu', sourceCompte: src });
                            });
                            // v28.90 Factures-Fix : ligne Factures (Règle 1, due − avance), routée variables
                            Object.entries(resteAPayerFacturesParCompte.value).forEach(([src, resteFact]) => {
                                if (resteFact > 0) unpaidItems.push({ libelle: '🧾 Total Factures', montant: resteFact, type: 'debit', jourPrevu: 6, etat: 'prevu', sourceCompte: src });
                            });"""))
H.append(('Pilotage : fixes des mois futurs', """                                    jourPrevu: Number(f.jourPrevu || 10),
                                    etat: paid ? 'realise' : 'prevu',
                                    sourceCompte: soldesInitiaux.value.compteChargesFixes || 'courant'""",
"""                                    jourPrevu: Number(f.jourPrevu || 10),
                                    etat: paid ? 'realise' : 'prevu',
                                    sourceCompte: compteDeLaCharge('fixe', f)   // v37.50"""))
H.append(('Pilotage : enveloppe du mois en cours', """                            const envVar = Number(enveloppeVariableProrata.value || 0);
                            if (envVar > 0) {
                                unpaidItems.push({
                                    libelle: '🛒 Total Charges Variables',
                                    montant: envVar, type: 'debit',
                                    jourPrevu: 15,
                                    etat: 'prevu',
                                    sourceCompte: soldesInitiaux.value.compteChargesVariables || 'courant'
                                });
                            }""", """                            //  v37.50 : l'enveloppe de chaque compte
                            Object.entries(enveloppeConsoParCompte.value).forEach(([src, envVar]) => {
                                if (envVar > 0) unpaidItems.push({ libelle: '🛒 Total Charges Variables', montant: envVar, type: 'debit', jourPrevu: 15, etat: 'prevu', sourceCompte: src });
                            });"""))
H.append(('Pilotage : variables des mois futurs', """                                const _cvSrc = soldesInitiaux.value.compteChargesVariables || 'courant';""",
"""                                const _cvSrc = compteDeLaCharge('variable', cv);   // v37.50"""))

# ── Surplus / périmètre (_getMonthFlux) ──────────────────────────────────
H.append(('surplus : charges fixes ligne par ligne', """                        if (!_perim || _dans(_fxSrc)) {
                            Object.values(dA.chargesFixes || {}).forEach(f => { const a = _amt(f, f.valeur); if (a > 0) sortants += a; });
                        }""", """                        //  v37.50 : ligne par ligne — chacune sur SON compte
                        Object.values(dA.chargesFixes || {}).forEach(f => {
                            if (_perim && !_dans(compteDeLaCharge('fixe', f))) return;
                            const a = _amt(f, f.valeur); if (a > 0) sortants += a;
                        });"""))
H.append(('surplus : charges variables ligne par ligne', """                        if (!_perim || _dans(_varSrc)) {
                            Object.values(dA.chargesVariables || {}).forEach(cv => {
                                const effV = _effVal(cv, cv.valeur);""", """                        {
                            Object.values(dA.chargesVariables || {}).forEach(cv => {
                                if (_perim && !_dans(compteDeLaCharge('variable', cv))) return;   // v37.50
                                const effV = _effVal(cv, cv.valeur);"""))

# ── Reste à payer par compte (cartes du Pilotage) ────────────────────────
H.append(('groupes : fixes', """                                const grp = getOrCreate(soldesInitiaux.value.compteChargesFixes || 'courant');""",
"""                                const grp = getOrCreate(compteDeLaCharge('fixe', f));   // v37.50"""))
H.append(('groupes : factures', """                                const srcFac = soldesInitiaux.value.compteChargesVariables || 'courant';""",
"""                                const srcFac = compteDeLaCharge('variable', cv);   // v37.50"""))
H.append(('groupes : enveloppe', """                        if (enveloppeVariableProrata.value > 0) {
                            const srcVar = soldesInitiaux.value.compteChargesVariables || 'courant';
                            const envVar = enveloppeVariableProrata.value;
                            const grp = getOrCreate(srcVar);
                            grp.montant += envVar; grp.parNature.var += envVar;""", """                        //  v37.50 : un seul compte → exactement comme avant ; plusieurs → l'enveloppe de chacun,
                        //  et chaque catégorie sous le compte qui la paie.
                        const _envParCpt = enveloppeConsoParCompte.value;
                        const _cvsActu = dActuelle.chargesVariables || {};
                        if (Object.keys(_envParCpt).length > 1) {
                            Object.entries(_envParCpt).forEach(([src, env]) => {
                                const grp = getOrCreate(src);
                                grp.montant += env; grp.parNature.var += env;
                                consoResteParCategorie.value.filter(dc => compteDeLaCharge('variable', _cvsActu[dc.key]) === src)
                                    .forEach(dc => grp.lignes.push({ nom: dc.nom, montant: dc.montant, type: 'var', estim: dc.estim }));
                            });
                        } else if (enveloppeVariableProrata.value > 0) {
                            const srcVar = Object.keys(_envParCpt)[0] || compteDeLaCharge('variable', null);
                            const envVar = enveloppeVariableProrata.value;
                            const grp = getOrCreate(srcVar);
                            grp.montant += envVar; grp.parNature.var += envVar;"""))
H.append(('obligations hors conso', """                        // L'enveloppe conso n'est imputée au courant que si c'est le compte des variables
                        const srcVar = soldesInitiaux.value.compteChargesVariables || 'courant';
                        const envVar = (srcVar === 'courant') ? enveloppeVariableProrata.value : 0;""",
"""                        // L'enveloppe conso n'est imputée au courant que si c'est le compte des variables
                        //  v37.50 : la part de l'enveloppe portée par le courant
                        const envVar = Number(enveloppeConsoParCompte.value['courant'] || 0);"""))
H.append(('atterrissage : la conso sort-elle du courant ?', """                        const conso_sur_courant = (soldesInitiaux.value.compteChargesVariables || 'courant') === 'courant';""",
"""                        const _envCpts = Object.keys(enveloppeConsoParCompte.value);   // v37.50
                        const conso_sur_courant = _envCpts.length ? _envCpts.every(k => k === 'courant') : compteDeLaCharge('variable', null) === 'courant';"""))

# ── La projection (calcul principal) ─────────────────────────────────────
H.append(('projection : fixes', """                                // v24.80 : routing macro-compte (ignore sourceCompte par ligne)
                                const _sfx = _normKey(soldesInitiaux.value.compteChargesFixes || 'courant');""",
"""                                // v24.80 : routing macro-compte (ignore sourceCompte par ligne) — v37.50 : ou le compte de la ligne
                                const _sfx = _normKey(compteDeLaCharge('fixe', f));"""))
H.append(('projection : variables', """                                // v24.80 : routing macro-compte (ignore sourceCompte par ligne)
                                const _svar = _normKey(soldesInitiaux.value.compteChargesVariables || 'courant');""",
"""                                // v24.80 : routing macro-compte (ignore sourceCompte par ligne) — v37.50 : ou le compte de la ligne
                                const _svar = _normKey(compteDeLaCharge('variable', curr));"""))
H.append(('projection du mois : fixes', """                                    // v24.80 : routing macro-compte
                                    const src = soldesInitiaux.value.compteChargesFixes || 'courant';""",
"""                                    // v24.80 : routing macro-compte — v37.50 : ou le compte de la ligne
                                    const src = compteDeLaCharge('fixe', f);"""))
H.append(('projection du mois : variables', """                                    // v24.80 : routing macro-compte
                                    const src = soldesInitiaux.value.compteChargesVariables || 'courant';""",
"""                                    // v24.80 : routing macro-compte — v37.50 : ou le compte de la ligne
                                    const src = compteDeLaCharge('variable', curr);"""))

# ── Les tickets : « hors compte » par rapport au compte de LEUR catégorie ─
H.append(('tickets', """                                const tx = _txRayonX(t, dt, cleVar);""",
"""                                const tx = _txRayonX(t, dt, carte[t.categorieId] ? compteDeFlux('variable', d.chargesVariables[carte[t.categorieId]]) : cleVar);   // v37.50"""))

H.append(('exposition', """                        semainesDuCycle, semainesDeLAnnee, cyclesSemaines,""",
"""                        semainesDuCycle, semainesDeLAnnee, cyclesSemaines,
                        // v37.50 : un compte par ligne
                        compteDeLaCharge, resteAPayerFixesParCompte, resteAPayerFacturesParCompte, enveloppeConsoParCompte,"""))

patcher('index.html', H)

# ═══════════════════════════════════════════════════════════════════════════
# LE CFO (serveur) : le même net, ligne par ligne
# ═══════════════════════════════════════════════════════════════════════════
patcher('cfo_intent_engine.php', [
    ('fixes', """        if ($isC($fxSrc)) {
            foreach (ovals(oget($y, 'chargesFixes', onew())) as $f) {
                $v = $eff($f, oget($f, 'valeur'), $m); if ($v > 0) $sortants += $v;
            }
        }""", """        //  v37.50 : chaque charge sur SON compte (oget compte), sinon le compte par défaut de sa famille
        foreach (ovals(oget($y, 'chargesFixes', onew())) as $f) {
            if (!$isC(oget($f, 'compte') ?: oget($si, 'compteChargesFixes', 'courant'))) continue;
            $v = $eff($f, oget($f, 'valeur'), $m); if ($v > 0) $sortants += $v;
        }"""),
    ('variables', """        if ($isC($varSrc)) {
            foreach (ovals(oget($y, 'chargesVariables', onew())) as $cv) {
                $v = cfo_cout_variable_cycle($cv, $m, (int)$year, $jdp, true);   // v37.29-30 : semaines réelles, ligne par ligne
                if ($v > 0) $sortants += $v;
            }
        }""", """        foreach (ovals(oget($y, 'chargesVariables', onew())) as $cv) {
            if (!$isC(oget($cv, 'compte') ?: oget($si, 'compteChargesVariables', 'courant'))) continue;   // v37.50
            $v = cfo_cout_variable_cycle($cv, $m, (int)$year, $jdp, true);   // v37.29-30 : semaines réelles, ligne par ligne
            if ($v > 0) $sortants += $v;
        }"""),
])
print('✔ index.html + cfo_intent_engine.php : un compte par ligne (fixes, variables)')
