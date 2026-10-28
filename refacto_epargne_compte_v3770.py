#!/usr/bin/env python3
"""v37.70 — UNE ÉPARGNE VA TOUJOURS SUR UN VRAI COMPTE.

« Pourquoi cette duplication de comptes ? Pourquoi toujours ce genre de confusion entre objectif et
compte ? Je veux une résolution une fois pour toutes. » — les cinq virements d'épargne 2026-2027 ont été
recréés (source : ASSAFA) SANS compte de destination. Une épargne sans destination devient une
« poche » virtuelle ep_<id> : l'argent quitte ASSAFA et n'arrive sur aucun vrai compte, le Relevé
affiche une poche « Urgence » à côté du vrai « Compte urgence », le total est gonflé et l'Épargne Long
Terme passe sous zéro (elle paie le syndic sans plus rien recevoir).

  APPLI (index.html)
  1. À CHAQUE chargement, une épargne sans compte est rattachée à son compte quand il n'y a aucun doute :
     même ligne (même id ou même nom) reliée dans une autre année, sinon l'UNIQUE compte dont le nom
     est contenu dans le sien (« Epargne urgence » → « Compte urgence », « Long Terme » → « Épargne Long
     Terme », « Alimentation depenses annuels » → « depenses annuels ») — jamais le compte source.
  2. Le sélecteur « Vers : » ne propose plus « 🎯 Enveloppe virtuelle » comme si c'était un choix
     normal : « ⚠️ Aucun compte — à choisir », en rouge.
  3. Une poche restée sans compte est nommée « 🎯 <nom> (sans compte) », cherchée dans toutes les années.
  4. Annuler dit depuis quand la pile compte, et pourquoi elle est repartie de zéro.
  MOTEUR DU CFO (cfo_intent_engine.php)
  5. set_recurring_savings accepte destination_account ; sans lui, la destination est héritée ou
     déduite comme ci-dessus ; à défaut, l'ajout est REFUSÉ (le CFO doit demander le compte).
  6. update_recurring_savings change la source ou la destination d'une ligne EXISTANTE (au lieu de la
     supprimer et la recréer sans compte) ; le montant n'y est plus obligatoire.
"""
import io, sys

def patch(F, pairs):
    src = io.open(F, encoding='utf-8').read()
    for label, old, new in pairs:
        c = src.count(old)
        if c != 1:
            print(f'✖ {F} — {label} : {c} ancre(s), 1 attendue'); sys.exit(1)
        src = src.replace(old, new)
    io.open(F, 'w', encoding='utf-8').write(src)

# ═══════════════════════════ APPLI ═══════════════════════════
patch('index.html', [
('rattacher : définition',
"""                    // ── Patch v15.1 : corrige soldeInitial→solde + inclureLiquidite ──""",
"""                    // ── v37.70 : UNE ÉPARGNE VA TOUJOURS SUR UN VRAI COMPTE (à chaque chargement) ──
                    //  Sans compte de destination, une épargne devenait une poche virtuelle ep_<id> : l'argent
                    //  quittait la source sans arriver nulle part (doublons dans le patrimoine projeté, total
                    //  gonflé, compte d'épargne sous zéro). Rattachement quand il n'y a aucun doute : la même
                    //  ligne reliée dans une autre année (même id, sinon même nom), sinon l'UNIQUE compte dont
                    //  les mots significatifs sont tous dans le nom de l'épargne — jamais le compte source.
                    const _MOTS_VIDES_COMPTE = new Set(['compte', 'epargne', 'de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'et', 'pour', 'vers', 'poche', 'alimentation', 'virement', 'versement', 'objectif']);
                    const _motsCompte = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/\\p{M}/gu, '').replace(/[^a-z0-9]+/g, ' ')
                        .split(' ').filter(w => w.length > 1 && !_MOTS_VIDES_COMPTE.has(w));
                    const rattacherEpargnes = (data) => {
                        const faits = [];
                        if (!data || typeof data !== 'object') return faits;
                        const A = data.donneesAnnuelles || {}, cptes = Array.isArray(data.comptes) ? data.comptes : [];
                        const cc = cptes.find(c => c && (c.type === 'courant' || c.type === 'liquide'));
                        const cleC = (k) => { const s = String(k == null || k === '' ? 'courant' : k); return s === 'courant' ? (cc ? 'cpt_' + cc.id : 'courant') : (s.startsWith('cpt_') ? s : 'cpt_' + s); };
                        const lignes = [];
                        Object.keys(A).forEach(an => { const ep = A[an] && A[an].epargne; (Array.isArray(ep) ? ep : []).forEach(e => { if (e && typeof e === 'object') lignes.push({ an, e }); }); });
                        const relie = (e) => e.linkedAccountId !== undefined && e.linkedAccountId !== null && e.linkedAccountId !== '';
                        const existe = (id) => cptes.some(c => c && String(c.id) === String(id));
                        const nomN = (e) => _motsCompte(e.nom || e.label).join(' ');
                        lignes.filter(({ e }) => !relie(e)).forEach(({ an, e }) => {
                            const src = cleC(e.sourceCompte);
                            let dest = null, comment = '';
                            const meme = lignes.find(x => x.e !== e && relie(x.e) && existe(x.e.linkedAccountId) && String(x.e.id) === String(e.id))
                                      || (nomN(e) ? lignes.find(x => x.e !== e && relie(x.e) && existe(x.e.linkedAccountId) && nomN(x.e) === nomN(e)) : null);
                            if (meme && cleC(meme.e.linkedAccountId) !== src) { dest = meme.e.linkedAccountId; comment = 'même épargne en ' + meme.an; }
                            if (dest === null) {
                                const mots = new Set(_motsCompte(e.nom || e.label));
                                const cands = cptes.filter(c => { const m = _motsCompte(c.label || c.nom); return m.length && m.every(w => mots.has(w)) && cleC(c.id) !== src; });
                                if (cands.length === 1) { dest = cands[0].id; comment = 'nom du compte'; }
                            }
                            if (dest === null) return;
                            e.linkedAccountId = dest;
                            const c = cptes.find(x => String(x.id) === String(dest));
                            faits.push({ an: Number(an), epargne: e.nom || e.label || ('ep_' + e.id), compte: c ? (c.label || c.nom) : String(dest), comment });
                        });
                        return faits;
                    };

                    // ── Patch v15.1 : corrige soldeInitial→solde + inclureLiquidite ──"""),
('rattacher : appel',
"""                            const _corr = corrigerDonneesApprouvees(data);      // v37.68 : schéma 23""",
"""                            const _corr = corrigerDonneesApprouvees(data);      // v37.68 : schéma 23
                            const _rat = rattacherEpargnes(data);               // v37.70 : à chaque chargement
                            if (_rat.length) addLog('🔗 ' + _rat.length + ' épargne(s) sans compte de destination rattachée(s) : ' + _rat.map(r => r.epargne + ' ' + r.an + ' → ' + r.compte).join(' · ') + '.', 'success');"""),
('sélecteur 1',
"""                                        <select v-model="obj.linkedAccountId" @change="handleDataChange" class="text-[10px] font-bold bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 outline-none focus:border-purple-400 text-gray-600 cursor-pointer">
                                            <option :value="null">🎯 Enveloppe virtuelle</option>""",
"""                                        <select v-model="obj.linkedAccountId" @change="handleDataChange" :data-ep-sans-compte="!obj.linkedAccountId ? '1' : null" :class="['text-[10px] font-bold border rounded px-1.5 py-0.5 outline-none focus:border-purple-400 cursor-pointer', !obj.linkedAccountId ? 'bg-rose-50 border-rose-400 text-rose-700' : 'bg-gray-50 border-gray-200 text-gray-600']">
                                            <option :value="null">⚠️ Aucun compte — à choisir</option>"""),
('sélecteur 2',
"""                                    <select v-model="obj.linkedAccountId" @change="handleDataChange" class="text-xs font-bold bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-purple-400 text-gray-700 cursor-pointer">
                                        <option :value="null">🎯 Enveloppe virtuelle</option>""",
"""                                    <select v-model="obj.linkedAccountId" @change="handleDataChange" :data-ep-sans-compte="!obj.linkedAccountId ? '1' : null" :class="['text-xs font-bold border rounded-lg px-2 py-1 outline-none focus:border-purple-400 cursor-pointer', !obj.linkedAccountId ? 'bg-rose-50 border-rose-400 text-rose-700' : 'bg-gray-50 border-gray-200 text-gray-700']">
                                        <option :value="null">⚠️ Aucun compte — à choisir</option>"""),
('sélecteur 3',
"""                                    <select v-model="obj.linkedAccountId" @change="handleDataChange" class="flex-1 text-xs font-bold bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none text-gray-700 cursor-pointer">
                                        <option :value="null">🎯 Enveloppe virtuelle</option>""",
"""                                    <select v-model="obj.linkedAccountId" @change="handleDataChange" :data-ep-sans-compte="!obj.linkedAccountId ? '1' : null" :class="['flex-1 text-xs font-bold border rounded-lg px-2 py-1.5 outline-none cursor-pointer', !obj.linkedAccountId ? 'bg-rose-50 border-rose-400 text-rose-700' : 'bg-gray-50 border-gray-200 text-gray-700']">
                                        <option :value="null">⚠️ Aucun compte — à choisir</option>"""),
('nom des poches',
"""                        if (k.startsWith('ep_')) {
                            const id = Number(k.replace('ep_', ''));
                            const d = donneesAnnuelles.value[anneeAffichage.value];
                            const ep = (d && Array.isArray(d.epargne)) ? d.epargne.find(e => Number(e.id) === id) : null;
                            return ep ? (ep.nom || ep.label || k) : k;
                        }""",
"""                        if (k.startsWith('ep_')) {
                            //  v37.70 : cherchée dans TOUTES les années (l'exercice affiché d'abord), et dite
                            //  « sans compte » — une poche n'est pas un compte bancaire.
                            const id = Number(k.replace('ep_', ''));
                            const ans = [anneeAffichage.value, ...Object.keys(donneesAnnuelles.value || {})];
                            let ep = null;
                            for (const a of ans) { const d = donneesAnnuelles.value[a]; ep = (d && Array.isArray(d.epargne)) ? d.epargne.find(e => e && Number(e.id) === id) : null; if (ep) break; }
                            return '🎯 ' + (ep ? (ep.nom || ep.label || k) : k) + ' (sans compte)';
                        }"""),
('undo : info',
"""                    const UNDO_MAX = 50;   // v37.67 : 50 pas (« il faut un historique de 40 undo au moins »)""",
"""                    const UNDO_MAX = 50;   // v37.67 : 50 pas (« il faut un historique de 40 undo au moins »)
                    //  v37.70 : « toujours que 4 dispo — il oublie ? » — la pile dit depuis quand elle compte et pourquoi
                    const undoInfo = ref('');
                    const _heureCourte = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });"""),
('undo : restaurer — raisons',
"""                        const ici = _history.value[0], haut = v.snaps[v.idx];
                        if (haut !== ici && _canonEtat(haut) !== _canonEtat(ici)) { _idbPile('readwrite', s => s.delete('derniere')); return 0; }""",
"""                        const ici = _history.value[0], haut = v.snaps[v.idx];
                        if (haut !== ici && _canonEtat(haut) !== _canonEtat(ici)) {
                            undoInfo.value = 'pile repartie de zéro à ' + _heureCourte() + ' : les données ont été modifiées ailleurs depuis (autre appareil, CFO ou correction automatique au chargement)';
                            _idbPile('readwrite', s => s.delete('derniere')); return 0;
                        }
                        undoInfo.value = 'pile retrouvée après le rechargement de ' + _heureCourte();"""),
('undo : restaurer — vide',
"""                        if (!v || !Array.isArray(v.snaps) || !(v.idx > 0) || v.idx >= v.snaps.length) return 0;""",
"""                        if (!v || !Array.isArray(v.snaps) || !(v.idx > 0) || v.idx >= v.snaps.length) { undoInfo.value = 'depuis l’ouverture de l’appli à ' + _heureCourte(); return 0; }"""),
('undo : bouton',
""":title="'Annuler (' + undoCount + ' disponible' + (undoCount > 1 ? 's' : '') + ')'\"""",
""":title="'Annuler (' + undoCount + ' disponible' + (undoCount > 1 ? 's' : '') + ' sur 50' + (undoInfo ? ' — ' + undoInfo : '') + ')'\""""),
('exposés',
"""purgerSourceCompteCharges, corrigerDonneesApprouvees,""",
"""purgerSourceCompteCharges, corrigerDonneesApprouvees, rattacherEpargnes, undoInfo,"""),
])

# ═══════════════════════════ MOTEUR ═══════════════════════════
patch('cfo_intent_engine.php', [
('catalogue : set_recurring_savings',
"""        'source_account' => ['type'=>'string','aliases'=>['source','compte_source','account','depuis','from_account','compte'],'desc'=>"Compte débité (nom approximatif accepté, résolu côté serveur). Défaut : courant."],
        'exceptions'     => ['type'=>'raw','aliases'=>['exceptions_mensuelles','overrides'],'desc'=>"Exceptions mensuelles [{moisDebut,moisFin,nouvelleValeur}]."],
    ]],""",
"""        'source_account' => ['type'=>'string','aliases'=>['source','compte_source','account','depuis','from_account','compte'],'desc'=>"Compte débité (nom approximatif accepté, résolu côté serveur). Défaut : courant."],
        'destination_account' => ['type'=>'string','aliases'=>['destination','vers','compte_destination','to_account','linked_account','compte_cible','compte_epargne'],'desc'=>"Compte qui REÇOIT l'argent (nom approximatif accepté). Sans lui : hérité de la même épargne ou déduit de son nom ; à défaut l'ajout est refusé — demande alors à l'utilisateur sur quel compte arrive l'argent."],
        'exceptions'     => ['type'=>'raw','aliases'=>['exceptions_mensuelles','overrides'],'desc'=>"Exceptions mensuelles [{moisDebut,moisFin,nouvelleValeur}]."],
    ]],"""),
('catalogue : update_recurring_savings',
"""    'update_recurring_savings' => ['desc'=>"Modifie le montant (et/ou le nom) d'un virement d'épargne EXISTANT.",
        'params'=>[
        'name'     => ['type'=>'string','required'=>true,'aliases'=>array_merge($A_NOM,['poche','savings_name']),'desc'=>"Ligne d'épargne visée."],
        'amount'   => ['type'=>'number','required'=>true,'aliases'=>array_merge($A_MONTANT,['fixed_amount','montant_fixe','nouveau_montant']),'desc'=>"Nouveau montant mensuel (REMPLACE)."],
        'new_name' => ['type'=>'string','aliases'=>['nouveau_nom','rename','nouveau_libelle'],'desc'=>"Renomme la ligne."],
    ]],""",
"""    'update_recurring_savings' => ['desc'=>"Modifie un virement d'épargne EXISTANT, sur place : montant, nom, compte source et/ou compte de destination. Pour changer le compte d'où part (ou où arrive) une épargne, utilise CETTE fonction — ne supprime pas la ligne pour la recréer.",
        'au_moins_un' => ['amount', 'new_name', 'source_account', 'destination_account'],
        'params'=>[
        'name'     => ['type'=>'string','required'=>true,'aliases'=>array_merge($A_NOM,['poche','savings_name']),'desc'=>"Ligne d'épargne visée."],
        'amount'   => ['type'=>'number','aliases'=>array_merge($A_MONTANT,['fixed_amount','montant_fixe','nouveau_montant']),'desc'=>"Nouveau montant mensuel (REMPLACE)."],
        'new_name' => ['type'=>'string','aliases'=>['nouveau_nom','rename','nouveau_libelle'],'desc'=>"Renomme la ligne."],
        'source_account' => ['type'=>'string','aliases'=>['source','compte_source','depuis','from_account'],'desc'=>"Nouveau compte débité."],
        'destination_account' => ['type'=>'string','aliases'=>['destination','vers','compte_destination','to_account','linked_account','compte_cible'],'desc'=>"Nouveau compte qui reçoit l'argent."],
    ]],"""),
('traduction : set — destination',
"""            $srcResolution = cfo_resolve_source_compte(oget($a, 'source_account', null), $ctx['financeData']);
            foreach ($yrs as $yr) {""",
"""            $srcResolution = cfo_resolve_source_compte(oget($a, 'source_account', null), $ctx['financeData']);
            //  v37.70 : le compte qui REÇOIT — sans lui, la ligne devenait une poche fantôme
            $dstResolution = cfo_resolve_destination_epargne(oget($a, 'destination_account', null), $ctx['financeData']);
            foreach ($yrs as $yr) {"""),
('traduction : set — pourcentage',
"""                        'amount'=>0,'sourceCompte'=>$srcResolution['key'],'sourceCompteAvertissement'=>$srcResolution['warning'],
                        'years'=>[$yr], 'exceptions'=>$exceptions,'notes'=>oget($a,'notes')]);
                    continue;""",
"""                        'amount'=>0,'sourceCompte'=>$srcResolution['key'],'sourceCompteAvertissement'=>$srcResolution['warning'],
                        'linkedAccountId'=>$dstResolution['id'],'destinationAvertissement'=>$dstResolution['warning'],
                        'years'=>[$yr], 'exceptions'=>$exceptions,'notes'=>oget($a,'notes')]);
                    continue;"""),
('traduction : set — fixe',
"""                $ch = cfo_obj(['action'=>'add','category'=>'epargne','target'=>oget($a,'name'),'label'=>oget($a,'name'),
                    'amount'=>$amount,'sourceCompte'=>$srcResolution['key'],'sourceCompteAvertissement'=>$srcResolution['warning'],
                    'years'=>[$yr],'notes'=>oget($a,'notes')]);""",
"""                $ch = cfo_obj(['action'=>'add','category'=>'epargne','target'=>oget($a,'name'),'label'=>oget($a,'name'),
                    'amount'=>$amount,'sourceCompte'=>$srcResolution['key'],'sourceCompteAvertissement'=>$srcResolution['warning'],
                    'linkedAccountId'=>$dstResolution['id'],'destinationAvertissement'=>$dstResolution['warning'],
                    'years'=>[$yr],'notes'=>oget($a,'notes')]);"""),
('traduction : update',
"""        case 'update_recurring_savings':
            return [cfo_obj(['action'=>'modify','category'=>'epargne','target'=>oget($a,'name'),
                'amount'=>$num('amount'),'label'=>oget($a,'new_name'),'years'=>$yrs])];""",
"""        case 'update_recurring_savings': {
            //  v37.70 : sur place — montant facultatif, source et destination modifiables
            $amt = oget($a, 'amount', null);
            $ch = cfo_obj(['action'=>'modify','category'=>'epargne','target'=>oget($a,'name'),
                'amount'=>is_numeric($amt) ? $amt + 0 : null,'label'=>oget($a,'new_name'),'years'=>$yrs]);
            if (oget($a, 'source_account', null) !== null) {
                $s = cfo_resolve_source_compte(oget($a, 'source_account'), $ctx['financeData']);
                oset($ch, 'sourceCompte', $s['key']); if ($s['warning']) oset($ch, 'sourceCompteAvertissement', $s['warning']);
            }
            if (oget($a, 'destination_account', null) !== null) {
                $d = cfo_resolve_destination_epargne(oget($a, 'destination_account'), $ctx['financeData']);
                if ($d['id'] !== null) oset($ch, 'linkedAccountId', $d['id']);
                if ($d['warning']) oset($ch, 'destinationAvertissement', $d['warning']);
            }
            return [$ch];
        }"""),
('ops : modify épargne',
"""                case 'epargne':     return [$o(['type'=>'update_epargne','key'=>$resolvedKey,'valeur'=>$amt,'label'=>$newLabel ?: null])];
                case 'studio':""",
"""                case 'epargne': {
                    $op = $o(['type'=>'update_epargne','key'=>$resolvedKey,'valeur'=>$amt,'label'=>$newLabel ?: null]);
                    foreach (['sourceCompte', 'linkedAccountId', 'sourceCompteAvertissement', 'destinationAvertissement'] as $f)   // v37.70
                        if (oget($change, $f, null) !== null) oset($op, $f, oget($change, $f));
                    return [$op];
                }
                case 'studio':"""),
('ops : add épargne — avertissement',
"""                    if (oget($change,'linkedAccountId', null) !== null) oset($op, 'linkedAccountId', oget($change,'linkedAccountId'));
                    if (is_array(oget($change,'exceptions'))) oset($op, 'exceptions', oget($change,'exceptions'));""",
"""                    if (oget($change,'linkedAccountId', null) !== null) oset($op, 'linkedAccountId', oget($change,'linkedAccountId'));
                    if (oget($change,'destinationAvertissement')) oset($op, 'destinationAvertissement', oget($change,'destinationAvertissement'));
                    if (is_array(oget($change,'exceptions'))) oset($op, 'exceptions', oget($change,'exceptions'));"""),
('apply : add_epargne — destination obligatoire',
"""            $newId = cfo_uid();
            $newEp = cfo_obj(['id'=>$newId,'nom'=>$lbl,'label'=>$lbl,'valeur'=>$v,
                'sourceCompte'=>cfo_pick_str($op,['sourceCompte']) ?: 'courant',
                'exceptions'=>[], 'showExceptions'=>false]);
            oset($newEp, 'linkedAccountId', (oget($op,'linkedAccountId', null) !== null) ? oget($op,'linkedAccountId') : null);""",
"""            //  v37.70 : UNE ÉPARGNE VA TOUJOURS SUR UN VRAI COMPTE. Donnée → héritée / déduite → sinon refus.
            $srcAdd = cfo_pick_str($op,['sourceCompte']) ?: 'courant';
            $lie = oget($op,'linkedAccountId', null);
            $dedu = null;
            if ($lie === null || $lie === '') { $dedu = cfo_deduire_destination_epargne($fd, $lbl, null, $srcAdd); $lie = $dedu ? $dedu['id'] : null; }
            if ($lie === null || $lie === '') {
                $log['status']='error';
                $log['reason']='compte de destination manquant pour « '.$lbl.' » : indique destination_account (le compte qui reçoit l argent). Sans lui, l épargne deviendrait une poche fantôme qui n arrive sur aucun compte.'
                    . (oget($op,'destinationAvertissement') ? ' ('.oget($op,'destinationAvertissement').')' : '');
                break;
            }
            if (cfo_cle_compte_epargne($lie, $fd) === cfo_cle_compte_epargne($srcAdd, $fd)) {
                $log['status']='error'; $log['reason']='« '.$lbl.' » partirait et arriverait sur le même compte : choisis un autre compte de destination.'; break;
            }
            $newId = cfo_uid();
            $newEp = cfo_obj(['id'=>$newId,'nom'=>$lbl,'label'=>$lbl,'valeur'=>$v,
                'sourceCompte'=>$srcAdd,
                'exceptions'=>[], 'showExceptions'=>false]);
            oset($newEp, 'linkedAccountId', $lie);
            if ($dedu) $log['destination_deduite'] = $dedu['comment'];
            $log['destination'] = cfo_nom_compte_epargne($lie, $fd);"""),
('apply : update_epargne — source et destination',
"""            if ($lbl !== null) { $ch['label']  = ['avant'=>oget($ep,'nom') ?: oget($ep,'label'),'apres'=>$lbl]; oset($ep,'nom',$lbl); oset($ep,'label',$lbl); }
            if (!count($ch)) { $log['status']='error'; $log['reason']='aucun champ fourni'; break; }""",
"""            if ($lbl !== null) { $ch['label']  = ['avant'=>oget($ep,'nom') ?: oget($ep,'label'),'apres'=>$lbl]; oset($ep,'nom',$lbl); oset($ep,'label',$lbl); }
            //  v37.70 : la source et la destination se changent SUR PLACE (la ligne garde son id, ses exceptions)
            //  — vérifiées AVANT toute écriture : un refus ne laisse rien de modifié
            $nsrc = cfo_pick_str($op, ['sourceCompte']);
            $ndst = oget($op, 'linkedAccountId', null); if ($ndst === '') $ndst = null;
            $srcF = $nsrc !== null ? $nsrc : (oget($ep,'sourceCompte') ?: 'courant');
            $dstF = $ndst !== null ? $ndst : oget($ep,'linkedAccountId', null);
            if ($dstF !== null && $dstF !== '' && cfo_cle_compte_epargne($dstF, $fd) !== null && cfo_cle_compte_epargne($dstF, $fd) === cfo_cle_compte_epargne($srcF, $fd)) {
                $log['status']='error'; $log['reason']='la ligne partirait et arriverait sur le même compte : choisis un autre compte.'; break;
            }
            if ($nsrc !== null) { $ch['sourceCompte'] = ['avant'=>oget($ep,'sourceCompte'),'apres'=>$nsrc]; oset($ep,'sourceCompte',$nsrc); }
            if ($ndst !== null) { $ch['destination'] = ['avant'=>cfo_nom_compte_epargne(oget($ep,'linkedAccountId'), $fd),'apres'=>cfo_nom_compte_epargne($ndst, $fd)]; oset($ep,'linkedAccountId',$ndst); }
            //  …et une ligne restée sans destination est rattachée quand il n'y a aucun doute
            $lieU = oget($ep,'linkedAccountId', null);
            if ($lieU === null || $lieU === '') {
                $d = cfo_deduire_destination_epargne($fd, oget($ep,'nom') ?: oget($ep,'label',''), oget($ep,'id'), oget($ep,'sourceCompte') ?: 'courant');
                if ($d) { oset($ep,'linkedAccountId',$d['id']); $ch['destination'] = ['avant'=>null,'apres'=>cfo_nom_compte_epargne($d['id'], $fd),'deduite'=>$d['comment']]; }
            }
            if (!count($ch)) { $log['status']='error'; $log['reason']='aucun champ fourni'; break; }"""),
('helpers',
"""/**
 * v36.0 — COHÉRENCE DES DEUX SCHÉMAS D'OBJECTIF.""",
"""/**
 * v37.70 — UNE ÉPARGNE VA TOUJOURS SUR UN VRAI COMPTE.
 *   Sans linkedAccountId, l'application fait d'une épargne une poche virtuelle ep_<id> : l'argent quitte
 *   la source sans arriver sur aucun compte (doublons dans le patrimoine, total gonflé). Ces fonctions
 *   résolvent, héritent ou déduisent la destination — même règle que rattacherEpargnes (index.html).
 */
function cfo_mots_compte($s): array {
    static $vides = ['compte','epargne','de','du','des','la','le','les','l','d','et','pour','vers','poche','alimentation','virement','versement','objectif'];
    $n = preg_replace('/[^a-z0-9]+/', ' ', cfo_norm_str((string)$s));
    return array_values(array_filter(explode(' ', $n), fn($w) => strlen($w) > 1 && !in_array($w, $vides, true)));
}
function cfo_compte_par_cle($k, $fd) {
    $s = (string)$k; if ($s === '') return null;
    $comptes = oget($fd, 'comptes'); if (!is_array($comptes)) return null;
    if ($s === 'courant') { foreach ($comptes as $c) if (is_object($c) && in_array(oget($c,'type'), ['courant','liquide'], true)) return $c; return null; }
    $id = strpos($s, 'cpt_') === 0 ? substr($s, 4) : $s;
    foreach ($comptes as $c) if (is_object($c) && (string)oget($c,'id') === $id) return $c;
    return null;
}
function cfo_cle_compte_epargne($k, $fd): ?string { $c = cfo_compte_par_cle($k, $fd); return $c ? 'cpt_' . (string)oget($c,'id') : null; }
function cfo_nom_compte_epargne($k, $fd): ?string { $c = cfo_compte_par_cle($k, $fd); return $c ? (string)(oget($c,'label') ?: oget($c,'nom')) : null; }
function cfo_resolve_destination_epargne($raw, $fd): array {
    if ($raw === null || $raw === '') return ['id' => null, 'warning' => null];
    $res = cfo_resolve_compte($raw, $fd);
    if (!empty($res['resolved'])) { $c = cfo_compte_par_cle($res['key'], $fd); if ($c) return ['id' => oget($c,'id'), 'warning' => null]; }
    return ['id' => null, 'warning' => 'destination_account "'.$raw.'" non reconnu parmi les comptes. '.($res['error'] ?? '')];
}
function cfo_deduire_destination_epargne($fd, $label, $id, $source): ?array {
    $src = cfo_cle_compte_epargne($source ?: 'courant', $fd);
    $da = oget($fd, 'donneesAnnuelles'); $lignes = [];
    if (is_object($da)) foreach (okeys($da) as $an) {
        $y = oget($da, (string)$an); $pool = is_object($y) ? oget($y, 'epargne') : null;
        if (is_array($pool)) foreach ($pool as $e) if (is_object($e)) $lignes[] = [$an, $e];
    }
    $nomN = implode(' ', cfo_mots_compte($label));
    foreach ([fn($e) => $id !== null && (string)oget($e,'id') === (string)$id,
              fn($e) => $nomN !== '' && implode(' ', cfo_mots_compte(oget($e,'nom') ?: oget($e,'label',''))) === $nomN] as $pareil) {
        foreach ($lignes as [$an, $e]) {
            $l = oget($e, 'linkedAccountId', null);
            if ($l === null || $l === '' || !$pareil($e)) continue;
            $k = cfo_cle_compte_epargne($l, $fd);
            if ($k !== null && $k !== $src) return ['id' => oget(cfo_compte_par_cle($l, $fd), 'id'), 'comment' => 'même épargne en ' . $an];
        }
    }
    $mots = cfo_mots_compte($label); $cands = [];
    $comptes = oget($fd, 'comptes');
    if (is_array($comptes)) foreach ($comptes as $c) {
        if (!is_object($c)) continue;
        $m = cfo_mots_compte(oget($c,'label') ?: oget($c,'nom',''));
        if (!count($m) || count(array_diff($m, $mots))) continue;
        if ('cpt_' . (string)oget($c,'id') === $src) continue;
        $cands[] = $c;
    }
    return count($cands) === 1 ? ['id' => oget($cands[0],'id'), 'comment' => 'nom du compte'] : null;
}

/**
 * v36.0 — COHÉRENCE DES DEUX SCHÉMAS D'OBJECTIF."""),
])
print('✔ v37.70 : une épargne va toujours sur un vrai compte (appli + moteur du CFO), Annuler explique sa pile')
