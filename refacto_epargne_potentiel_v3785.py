#!/usr/bin/env python3
"""v37.85 — UNE ÉPARGNE QUI SUIT LE POTENTIEL DE CHAQUE MOIS.

« Pourquoi ça n'a pas marché ? Il faut créer une épargne non stable : de janvier à juin 2027 c'est négatif. »
  Ce que le CFO a fait : créer une SECONDE ligne « Epargne urgence » (0 DH + 12 exceptions mensuelles) à côté de la
  ligne « Urgence » de 5 000 DH/mois déjà là — vers le même Compte urgence. La ligne d'origine n'a pas bougé :
  janvier → juin gardaient 9 000 d'épargne (le Brut est de + 4 638) ; juillet → décembre passaient de 9 000 à
  14 757 (la seconde ligne s'AJOUTAIT). Son « potentiel » était faux : le Brut de janvier n'est pas nul.

  1. L'APPLI calcule, sans IA : un bouton « ⚖️ Adapter au potentiel » sur chaque ligne d'épargne (Patrimoine et
     Objectifs, bureau et téléphone). Pour chaque mois restant de l'année : le Brut du mois (celui du Surplus
     détaillé) moins les AUTRES épargnes du mois, jamais sous zéro, arrondi à 10 DH vers le bas, plafonné si on
     le demande. Écrit les exceptions de la ligne (regroupées par périodes) ; « ↩ retirer » les efface.
  2. Le CFO LIT ces chiffres (lecture_moteur › potentiel_epargne) au lieu de les inventer.
  3. Le moteur du CFO : update_recurring_savings accepte des exceptions (modifier la ligne EXISTANTE), et
     set_recurring_savings refuse de créer une ligne qui double une ligne existante vers le même compte.
"""
import io, sys
F = 'index.html'
src = io.open(F, encoding='utf-8').read()
def sub(label, old, new, n=1):
    global src
    c = src.count(old)
    if c != n:
        print(f'✖ {label} : {c} ancre(s), {n} attendue(s)'); sys.exit(1)
    src = src.replace(old, new)

# ── 1. Le calcul ────────────────────────────────────────────────────────────────
sub('calcul : potentiel et adaptation',
"""                    const sensEpargne = (src, dest) => {""",
"""                    //  v37.85 — UNE ÉPARGNE QUI SUIT LE POTENTIEL. Le potentiel d'un mois = son Brut (celui du Surplus détaillé :
                    //  entrées − sorties du périmètre, AVANT toute épargne), en mode « plein » : le potentiel intrinsèque du mois.
                    const potentielEpargneDuMois = (an, m) => { const f = _getMonthFlux(m, an, 'full', 'fonctionnement'); return Math.round((f.entrants || 0) - (f.sortants || 0)); };
                    //  L'épargne programmée du mois SANS la ligne `exclu` (± virements qui quittent / rejoignent le périmètre)
                    const epargneDuMoisHors = (an, m, exclu) => {
                        const d = (donneesAnnuelles.value || {})[an] || {};
                        let ep = 0;
                        (Array.isArray(d.epargne) ? d.epargne : Object.values(d.epargne || {})).filter(o => o && o !== exclu).forEach(o => {
                            const sens = sensEpargne(o.sourceCompte || 'courant', destEpargne(o));
                            if (sens) ep += sens * valeurEffective(o, o.valeur, m);
                        });
                        getVirementsCycle(m, an).forEach(vir => { const sens = sensEpargne(vir.sourceCompte || 'courant', vir.destinationCompte || 'courant'); const due = Math.abs(Number(vir.montant) || 0); if (sens && due) ep += sens * due; });
                        return Math.round(ep);
                    };
                    //  Les 12 mois d'un exercice : potentiel, épargne programmée, net — ce que le CFO lit (lecture_moteur)
                    const potentielEpargneAn = (an) => Array.from({ length: 12 }, (_, i) => {
                        const m = i + 1, pot = potentielEpargneDuMois(an, m), ep = epargneDuMoisHors(an, m, null);
                        return { mois: m, potentiel_avant_epargne: pot, epargne_programmee: ep, net_apres_epargne: pot - ep };
                    });
                    const plafondAdaptation = reactive({});
                    const adapterEpargneAuPotentiel = (obj, an, plafond) => {
                        const a = Number(an), mb = moisBudgetaire.value;
                        if (!obj || !donneesAnnuelles.value[a]) return null;
                        const sens = sensEpargne(obj.sourceCompte || 'courant', destEpargne(obj));
                        if (!(sens > 0)) { addLog('⚖️ « ' + (obj.nom || 'Épargne') + ' » ne sort pas du périmètre : rien à adapter au potentiel.', 'warn'); return null; }
                        const cle = _cleCycle(mb.mois, mb.an);
                        const mois = [];
                        for (let m = (a === mb.an ? mb.mois : (a > mb.an ? 1 : 13)); m <= 12; m++) {
                            if (a === mb.an && m === mb.mois && isItemPaid(obj, valeurEffective(obj, obj.valeur, m), cle)) continue;   // déjà versée ce mois-ci
                            mois.push(m);
                        }
                        if (!mois.length) { addLog('⚖️ Aucun mois restant à adapter en ' + a + '.', 'warn'); return null; }
                        const cap = Number(plafond) > 0 ? Number(plafond) : null;
                        const valeurs = {};
                        mois.forEach(m => {
                            const marge = potentielEpargneDuMois(a, m) - epargneDuMoisHors(a, m, obj);
                            let v = Math.max(0, Math.floor(marge / 10) * 10);
                            if (cap !== null) v = Math.min(v, cap);
                            valeurs[m] = v;
                        });
                        //  les exceptions existantes, mois par mois ; celles des mois adaptés sont remplacées, les autres gardées
                        const parMois = {};
                        (obj.exceptions || []).forEach(e => { const d0 = Number(e.moisDebut), f0 = Number(e.moisFin); for (let m = d0; m <= f0 && m <= 12; m++) if (d0 && f0) parMois[m] = Number(e.nouvelleValeur) || 0; });
                        Object.entries(valeurs).forEach(([m, v]) => { parMois[m] = v; });
                        const plages = [];
                        Object.keys(parMois).map(Number).sort((x, y) => x - y).forEach(m => {
                            const p = plages[plages.length - 1];
                            if (p && p.moisFin === m - 1 && p.nouvelleValeur === parMois[m]) p.moisFin = m;
                            else plages.push({ id: Date.now() + plages.length, moisDebut: m, moisFin: m, nouvelleValeur: parMois[m] });
                        });
                        obj.exceptions = plages;
                        obj.adapteePotentiel = { an: a, plafond: cap, le: _aujourdhuiISO(), mois: valeurs };
                        calculationTick.value++;
                        handleDataChange();
                        addLog('⚖️ « ' + (obj.nom || 'Épargne') + ' » adaptée au potentiel de ' + a + ' : ' + plages.filter(p => valeurs[p.moisDebut] !== undefined).map(p => (p.moisDebut === p.moisFin ? 'M' + p.moisDebut : 'M' + p.moisDebut + '–M' + p.moisFin) + ' ' + formatMAD(p.nouvelleValeur)).join(' · '), 'success');
                        return valeurs;
                    };
                    const retirerAdaptationEpargne = (obj) => {
                        if (!obj) return;
                        const moisAdaptes = Object.keys((obj.adapteePotentiel || {}).mois || {}).map(Number);
                        const parMois = {};
                        (obj.exceptions || []).forEach(e => { const d0 = Number(e.moisDebut), f0 = Number(e.moisFin); for (let m = d0; m <= f0 && m <= 12; m++) if (d0 && f0) parMois[m] = Number(e.nouvelleValeur) || 0; });
                        moisAdaptes.forEach(m => { delete parMois[m]; });
                        const plages = [];
                        Object.keys(parMois).map(Number).sort((x, y) => x - y).forEach(m => {
                            const p = plages[plages.length - 1];
                            if (p && p.moisFin === m - 1 && p.nouvelleValeur === parMois[m]) p.moisFin = m;
                            else plages.push({ id: Date.now() + plages.length, moisDebut: m, moisFin: m, nouvelleValeur: parMois[m] });
                        });
                        obj.exceptions = plages; delete obj.adapteePotentiel;
                        calculationTick.value++; handleDataChange();
                    };
                    const sensEpargne = (src, dest) => {""")

# ── l'interface : bureau et téléphone ───────────────────────────────────────────
BLOC = """<div data-epargne-adapter class="__CLS__">
                                    <button type="button" data-adapter-potentiel @click="adapterEpargneAuPotentiel(obj, anneeAffichage, plafondAdaptation[obj.id])" title="Pour chaque mois restant : le Brut du mois (Surplus détaillé) moins les autres épargnes — jamais sous zéro. Écrit les exceptions de cette ligne."
                                            class="text-[10px] font-black uppercase tracking-widest text-white bg-purple-600 hover:bg-purple-700 px-2.5 py-1 rounded-lg">⚖️ Adapter au potentiel</button>
                                    <label class="text-[10px] font-bold text-gray-500 flex items-center gap-1">plafond <input type="number" min="0" v-model.number="plafondAdaptation[obj.id]" placeholder="facultatif" class="w-24 p-1 text-xs font-black text-purple-800 border border-purple-200 rounded text-right bg-white outline-none"/> DH</label>
                                    <span v-if="obj.adapteePotentiel" data-adaptee class="text-[10px] font-bold text-emerald-700">✓ adaptée au potentiel de {{ obj.adapteePotentiel.an }}<template v-if="obj.adapteePotentiel.plafond"> (plafond {{ formatMAD(obj.adapteePotentiel.plafond) }})</template></span>
                                    <button v-if="obj.adapteePotentiel" type="button" data-retirer-adaptation @click="retirerAdaptationEpargne(obj)" class="text-[10px] font-bold text-red-600 hover:underline">↩ retirer</button>
                                </div>
"""
sub('bureau : bouton',
"""                                <!-- v17.99 : Exceptions épargne -->
""",
"""                                <!-- v37.85 : adapter l'épargne au potentiel de chaque mois -->
                                """ + BLOC.replace('__CLS__', 'flex items-center gap-2 pl-1 mt-1 flex-wrap') + """                                <!-- v17.99 : Exceptions épargne -->
""")
sub('téléphone : bouton',
"""                                <!-- v18.10 : Gérer Périodes épargne mobile -->
""",
"""                                <!-- v37.85 : adapter l'épargne au potentiel de chaque mois (mobile) -->
                                """ + BLOC.replace('__CLS__', 'flex items-center gap-2 flex-wrap rounded-xl bg-purple-50/60 border border-purple-100 p-2') + """                                <!-- v18.10 : Gérer Périodes épargne mobile -->
""")
sub('exposition',
"""friseOuverte, friseCycle, dateReleve, """,
"""friseOuverte, friseCycle, dateReleve, adapterEpargneAuPotentiel, retirerAdaptationEpargne, plafondAdaptation, potentielEpargneAn, potentielEpargneDuMois, epargneDuMoisHors, """)

# ── 2. Le CFO lit ces chiffres ──────────────────────────────────────────────────
sub('lecture CFO : potentiel',
"""                            cycle_en_cours: cycle(m, an), revenus_fixes, charges_fixes, charges_variables, epargne_recurrente,""",
"""                            cycle_en_cours: cycle(m, an), revenus_fixes, charges_fixes, charges_variables, epargne_recurrente,
                            //  v37.85 : le potentiel d'épargne de chaque mois (le Brut du Surplus détaillé), à lire — jamais à recalculer
                            potentiel_epargne: (() => { const o = { mode_emploi: 'potentiel_avant_epargne = ce qui reste de chaque mois APRÈS toutes les charges, AVANT l’épargne (le « Brut » du Surplus détaillé). epargne_programmee = toutes les lignes d’épargne du mois. net_apres_epargne = potentiel − épargne. Pour adapter UNE ligne : modifie la ligne EXISTANTE (update_recurring_savings avec exceptions), valeur du mois = potentiel − les AUTRES lignes, jamais sous zéro ; ne crée JAMAIS une seconde ligne vers le même compte. L’appli sait aussi le faire d’un clic : bouton « Adapter au potentiel » (Patrimoine et Objectifs).' };
                                Object.keys(donneesAnnuelles.value || {}).map(Number).filter(a => a >= an).sort().slice(0, 3).forEach(a => { try { o[a] = potentielEpargneAn(a); } catch (e) { /* exercice non budgété */ } });
                                return o; })(),""")
io.open(F, 'w', encoding='utf-8').write(src)

# ── 3. Le moteur du CFO (PHP) ───────────────────────────────────────────────────
P = 'cfo_intent_engine.php'
php = io.open(P, encoding='utf-8').read()
def subp(label, old, new):
    global php
    c = php.count(old)
    if c != 1:
        print(f'✖ {P} — {label} : {c} ancre(s), 1 attendue'); sys.exit(1)
    php = php.replace(old, new)
subp('catalogue : exceptions sur update',
"""        'au_moins_un' => ['amount', 'new_name', 'source_account', 'destination_account'],
        'params'=>[
        'name'     => ['type'=>'string','required'=>true,'aliases'=>array_merge($A_NOM,['poche','savings_name']),'desc'=>"Ligne d'épargne visée."],""",
"""        'au_moins_un' => ['amount', 'new_name', 'source_account', 'destination_account', 'exceptions'],
        'params'=>[
        'name'     => ['type'=>'string','required'=>true,'aliases'=>array_merge($A_NOM,['poche','savings_name']),'desc'=>"Ligne d'épargne visée."],
        'exceptions' => ['type'=>'raw','aliases'=>['exceptions_mensuelles','overrides'],'desc'=>"REMPLACE les exceptions mensuelles de la ligne EXISTANTE : [{moisDebut,moisFin,nouvelleValeur}] (mois 1-12). C'est ainsi qu'on adapte une épargne au potentiel de chaque mois (valeur du mois = potentiel_epargne − les AUTRES lignes, jamais sous zéro) : on ne crée JAMAIS une seconde ligne vers le même compte."],""")
subp('traduction : exceptions sur update',
"""            $ch = cfo_obj(['action'=>'modify','category'=>'epargne','target'=>oget($a,'name'),
                'amount'=>is_numeric($amt) ? $amt + 0 : null,'label'=>oget($a,'new_name'),'years'=>$yrs]);
            if (oget($a, 'source_account', null) !== null) {""",
"""            $ch = cfo_obj(['action'=>'modify','category'=>'epargne','target'=>oget($a,'name'),
                'amount'=>is_numeric($amt) ? $amt + 0 : null,'label'=>oget($a,'new_name'),'years'=>$yrs]);
            if (is_array(oget($a, 'exceptions', null))) oset($ch, 'exceptions', oget($a, 'exceptions'));   // v37.85
            if (oget($a, 'source_account', null) !== null) {""")
subp('modify : exceptions transmises',
"""foreach (['sourceCompte', 'linkedAccountId', 'sourceCompteAvertissement', 'destinationAvertissement'] as $f)   // v37.70""",
"""foreach (['sourceCompte', 'linkedAccountId', 'sourceCompteAvertissement', 'destinationAvertissement', 'exceptions'] as $f)   // v37.70 ; v37.85 : exceptions""")
subp('update_epargne : écrit les exceptions',
"""            if (!count($ch)) { $log['status']='error'; $log['reason']='aucun champ fourni'; break; }
            // v36.1 : une ligne sans nom doit quand même être nommable dans le""",
"""            //  v37.85 : les exceptions mensuelles se REMPLACENT sur la ligne existante (mois 1-12, valeur ≥ 0)
            $exNew = oget($op, 'exceptions', null);
            if (is_array($exNew)) {
                $propres = []; $mauvais = null;
                foreach ($exNew as $e) {
                    $d0 = (int)oget($e, 'moisDebut', 0); $f0 = (int)oget($e, 'moisFin', 0); $nv = oget($e, 'nouvelleValeur', null);
                    if ($d0 < 1 || $f0 > 12 || $d0 > $f0 || !is_numeric($nv) || $nv < 0) { $mauvais = json_encode($e, JSON_UNESCAPED_UNICODE); break; }
                    $propres[] = cfo_obj(['id'=>cfo_uid(),'moisDebut'=>$d0,'moisFin'=>$f0,'nouvelleValeur'=>$nv + 0]);
                }
                if ($mauvais !== null) { $log['status']='error'; $log['reason']='exception invalide (mois 1-12, du début à la fin, valeur ≥ 0) : '.$mauvais; break; }
                $ch['exceptions'] = ['avant'=>count(oget($ep,'exceptions') ?: []).' période(s)','apres'=>count($propres).' période(s)'];
                oset($ep, 'exceptions', $propres); oset($ep, 'showExceptions', count($propres) > 0);
            }
            if (!count($ch)) { $log['status']='error'; $log['reason']='aucun champ fourni'; break; }
            // v36.1 : une ligne sans nom doit quand même être nommable dans le""")
subp('add_epargne : pas de doublon vers le même compte',
"""            if (cfo_cle_compte_epargne($lie, $fd) === cfo_cle_compte_epargne($srcAdd, $fd)) {
                $log['status']='error'; $log['reason']='« '.$lbl.' » partirait et arriverait sur le même compte : choisis un autre compte de destination.'; break;
            }
            $newId = cfo_uid();""",
"""            if (cfo_cle_compte_epargne($lie, $fd) === cfo_cle_compte_epargne($srcAdd, $fd)) {
                $log['status']='error'; $log['reason']='« '.$lbl.' » partirait et arriverait sur le même compte : choisis un autre compte de destination.'; break;
            }
            //  v37.85 : UNE LIGNE QUI DOUBLE UNE LIGNE EXISTANTE vers le même compte — « Epargne urgence » à côté de « Urgence » —
            //  se SOMME au lieu de la remplacer. On modifie l'existante (update_recurring_savings, exceptions comprises).
            $motsNeufs = array_values(array_filter(preg_split('/[^a-z0-9]+/', cfo_norm_str($lbl)), fn($w) => strlen($w) >= 4 && !in_array($w, ['epargne', 'compte', 'mensuel', 'mensuelle', 'versement', 'virement'], true)));
            foreach ($pool as $e) {
                if (!is_object($e) || cfo_cle_compte_epargne(oget($e,'linkedAccountId', null), $fd) !== cfo_cle_compte_epargne($lie, $fd)) continue;
                $motsE = preg_split('/[^a-z0-9]+/', cfo_norm_str(oget($e,'nom') ?: oget($e,'label','')));
                if (count(array_intersect($motsNeufs, $motsE))) {
                    $log['status']='error';
                    $log['reason']='« '.$lbl.' » doublerait la ligne existante « '.(oget($e,'nom') ?: oget($e,'label','')).' » (même compte de destination) : les deux se SOMMERAIENT. Modifie la ligne existante avec update_recurring_savings (montant, ou exceptions mensuelles).';
                    break 2;
                }
            }
            $newId = cfo_uid();""")
io.open(P, 'w', encoding='utf-8').write(php)
print('✔ v37.85 : épargne adaptée au potentiel (appli), potentiel lisible par le CFO')
