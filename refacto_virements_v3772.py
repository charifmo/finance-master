#!/usr/bin/env python3
"""v37.72 — UN VIREMENT À FAIRE SE PROGRAMME, IL NE CHANGE PAS LES SOLDES D'AUJOURD'HUI.

« C'est le CFO qui faisait ce problème en changeant le compte courant au lieu d'initier dans le futur un
transfert vers le compte concerné — corrige ça. » — deux fois aujourd'hui, le CFO a « réglé » un besoin
de trésorerie en modifiant les soldes ACTUELS (deux appels adjust_account_balance) : 7 898 DH d'ASSAFA
vers le Courant, puis 7 631 DH de « depenses annuels » vers ASSAFA — et cette fois depuis le mauvais
compte (l'option choisie était « depuis le Courant »). Aucun de ces virements n'a eu lieu à la banque :
le Courant gonflé, « depenses annuels » à −3 565, ASSAFA faussé.

  MOTEUR DU CFO (cfo_intent_engine.php)
  1. adjust_account_balance est VERROUILLÉ : refusé sans deja_fait_en_banque = vrai (« le virement est-il
     déjà fait à la banque ? »). Le refus dit quoi faire à la place.
  2. Nouvelle fonction plan_transfer : programme un virement FUTUR entre deux comptes (mois, jour, un ou
     plusieurs mois) dans le calendrier (virementsInternes) — le Relevé, la Météo et l'atterrissage le
     comptent à sa date ; aucun solde n'est touché.
  APPLI (index.html) — correction approuvée, une fois (schéma 24)
  3. Les deux transferts enregistrés par le CFO sont annulés compte par compte, seulement si le solde du
     compte est exactement celui qu'ils ont laissé (repéré par une empreinte : aucun solde n'est écrit ici).
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

# ═══════════════════════════ MOTEUR ═══════════════════════════
patch('cfo_intent_engine.php', [
('catalogue : verrou adjust + plan_transfer',
"""    'adjust_account_balance' => ['desc'=>"Crédite (+) ou débite (−) un compte. INCRÉMENTAL.",
        'params'=>[
        'account' => ['type'=>'string','required'=>true,'aliases'=>array_merge($A_NOM,['compte','account_name','nom_compte']),'desc'=>"Compte visé (nom approximatif accepté)."],
        'amount'  => ['type'=>'number','required'=>true,'aliases'=>$A_MONTANT,'desc'=>"Variation (DH). Négatif pour débiter."],
    ]],""",
"""    'adjust_account_balance' => ['desc'=>"Corrige le solde ACTUEL d'un compte (+ crédite, − débite). UNIQUEMENT pour une opération DÉJÀ FAITE à la banque (deja_fait_en_banque = true). Un virement à faire, conseillé ou à programmer se crée avec plan_transfer — jamais ici.",
        'doit_valoir_vrai' => ['deja_fait_en_banque' => "adjust_account_balance modifie les soldes d'AUJOURD'HUI : il n'est accepté que pour une opération déjà faite à la banque (deja_fait_en_banque = true, après l'avoir demandé à l'utilisateur). Pour un virement à faire ou conseillé, utilise plan_transfer (il le programme à sa date, sans toucher aux soldes)."],
        'params'=>[
        'account' => ['type'=>'string','required'=>true,'aliases'=>array_merge($A_NOM,['compte','account_name','nom_compte']),'desc'=>"Compte visé (nom approximatif accepté)."],
        'amount'  => ['type'=>'number','required'=>true,'aliases'=>$A_MONTANT,'desc'=>"Variation (DH). Négatif pour débiter."],
        'deja_fait_en_banque' => ['type'=>'string','aliases'=>['deja_fait','realise','effectue','fait_en_banque','already_done'],'desc'=>"true seulement si l'utilisateur confirme que l'opération est DÉJÀ faite à la banque."],
    ]],
    'plan_transfer' => ['desc'=>"Programme un virement FUTUR entre deux comptes, à sa date, dans le calendrier : le Relevé, la Météo et l'atterrissage le comptent ; AUCUN solde n'est modifié. C'est la réponse à « il faudra virer X de A vers B » ou à une alerte de découvert à venir.",
        'params'=>[
        'from_account' => ['type'=>'string','required'=>true,'aliases'=>['source','source_account','depuis','compte_source','de'],'desc'=>"Compte débité (nom approximatif accepté)."],
        'to_account'   => ['type'=>'string','required'=>true,'aliases'=>['destination','destination_account','vers','compte_destination','a'],'desc'=>"Compte crédité (nom approximatif accepté)."],
        'amount'       => ['type'=>'number','required'=>true,'min'=>1,'aliases'=>$A_MONTANT,'desc'=>"Montant (DH), positif."],
        'month'        => ['type'=>'number','min'=>1,'max'=>12,'aliases'=>['mois'],'desc'=>"Mois calendaire du virement (1-12). Défaut : le mois en cours."],
        'months'       => ['type'=>'raw','aliases'=>['mois_liste','chaque_mois'],'desc'=>"Plusieurs mois (virement répété), ex. [11,12]."],
        'day'          => ['type'=>'number','min'=>1,'max'=>31,'aliases'=>['jour','jour_prevu'],'desc'=>"Jour du mois (ex. 28 = le lendemain de la paie)."],
    ]],"""),
('catalogue : nom',
"""        'add_one_off_expense','create_account','adjust_account_balance','set_initial_balance','clone_year',""",
"""        'add_one_off_expense','create_account','adjust_account_balance','plan_transfer','set_initial_balance','clone_year',"""),
('normalisation : doit_valoir_vrai',
"""    // v36.0 : contrainte « au moins un parmi », pour les fonctions dont deux""",
"""    // v37.72 : paramètres qui DOIVENT valoir vrai (verrou d'adjust_account_balance)
    foreach (($spec['doit_valoir_vrai'] ?? []) as $k => $msg) {
        $v = strtolower(trim((string)(oget($out, $k, '') ?? '')));
        if (!in_array($v, ['1', 'true', 'vrai', 'oui', 'yes'], true)) $rapport['hors_bornes'][] = $k . ' : ' . $msg;
    }
    // v36.0 : contrainte « au moins un parmi », pour les fonctions dont deux"""),
('traduction : plan_transfer',
"""        case 'set_initial_balance':
            return [cfo_obj(['action'=>'set_balance','category'=>'solde','balance_key'=>oget($a,'account','courant'),'amount'=>$num('amount'),'years'=>$yrs])];""",
"""        case 'set_initial_balance':
            return [cfo_obj(['action'=>'set_balance','category'=>'solde','balance_key'=>oget($a,'account','courant'),'amount'=>$num('amount'),'years'=>$yrs])];
        case 'plan_transfer': {
            //  v37.72 : un virement à faire se PROGRAMME (virementsInternes), il ne touche pas aux soldes
            $fd = $ctx['financeData'];
            $src = cfo_resolve_compte(oget($a, 'from_account'), $fd); $dst = cfo_resolve_compte(oget($a, 'to_account'), $fd);
            //  months : mois CALENDAIRES 1-12 (le type int_list du catalogue est réservé aux années)
            $brut = oget($a, 'months', null); $liste = is_array($brut) ? $brut : (is_string($brut) ? preg_split('/[,;\s]+/', trim($brut)) : ($brut === null ? [] : [$brut]));
            $mois = array_values(array_unique(array_filter(array_map('intval', $liste), fn($m) => $m >= 1 && $m <= 12)));
            if (!count($mois)) $mois = [(int)(oget($a, 'month', null) ?: (int)(oget(oget($fd, 'soldesInitiaux') ?: onew(), 'moisActuel', 0) ?: date('n')))];
            return [cfo_obj(['action'=>'plan_virement','category'=>'virement','target'=>oget($a, 'from_account') . ' → ' . oget($a, 'to_account'),
                'source'=>!empty($src['resolved']) ? $src['key'] : null, 'destination'=>!empty($dst['resolved']) ? $dst['key'] : null,
                'source_erreur'=>empty($src['resolved']) ? ($src['error'] ?? 'compte source introuvable') : null,
                'destination_erreur'=>empty($dst['resolved']) ? ($dst['error'] ?? 'compte de destination introuvable') : null,
                'amount'=>$num('amount'), 'mois'=>$mois, 'jour'=>oget($a, 'day', null) !== null ? (int)oget($a, 'day') : null, 'years'=>$yrs])];
        }"""),
('ops : plan_virement',
"""    switch ($action) {
        case 'modify':
            switch ($resolvedCat) {
                case 'revenu':      return [$o(['type'=>'update_revenu','key'=>$resolvedKey,'base'=>$amt,'label'=>$newLabel ?: null])];""",
"""    switch ($action) {
        case 'plan_virement': {   // v37.72 : un virement programmé par mois demandé
            $ops = [];
            foreach ((array)oget($change, 'mois', []) as $m) $ops[] = $o(['type'=>'add_virement_programme','annee'=>$annee,'mois'=>(int)$m,
                'jourPrevu'=>oget($change, 'jour', null),'sourceCompte'=>oget($change, 'source'),'destinationCompte'=>oget($change, 'destination'),'montant'=>$amt,
                'source_erreur'=>oget($change, 'source_erreur'),'destination_erreur'=>oget($change, 'destination_erreur')]);
            return $ops;
        }
        case 'modify':
            switch ($resolvedCat) {
                case 'revenu':      return [$o(['type'=>'update_revenu','key'=>$resolvedKey,'base'=>$amt,'label'=>$newLabel ?: null])];"""),
('apply : add_virement_programme',
"""        /* ── ÉPARGNE (schéma ARRAY v20.90, aligné Vue v17.99) ──────── */""",
"""        /* ── v37.72 : VIREMENT PROGRAMMÉ (virementsInternes) — aucun solde touché ── */
        case 'add_virement_programme': {
            if (!$y) { $log['status']='error'; $log['reason']='année absente'; break; }
            if (oget($op,'source_erreur'))      { $log['status']='error'; $log['reason']='compte source : '.oget($op,'source_erreur'); break; }
            if (oget($op,'destination_erreur')) { $log['status']='error'; $log['reason']='compte de destination : '.oget($op,'destination_erreur'); break; }
            $src = (string)oget($op,'sourceCompte'); $dst = (string)oget($op,'destinationCompte');
            $mt = cfo_pick_num($op, ['montant']); $m = (int)oget($op,'mois'); $j = oget($op,'jourPrevu', null);
            if (!($mt > 0)) { $log['status']='error'; $log['reason']='montant manquant ou nul'; break; }
            if ($m < 1 || $m > 12) { $log['status']='error'; $log['reason']='mois invalide (1-12)'; break; }
            if (cfo_cle_compte_epargne($src, $fd) === cfo_cle_compte_epargne($dst, $fd)) { $log['status']='error'; $log['reason']='même compte au départ et à l arrivée'; break; }
            if (!is_array(oget($y,'virementsInternes'))) oset($y,'virementsInternes',[]);
            $pool = oget($y,'virementsInternes');
            $vir = cfo_obj(['id'=>cfo_uid(),'mois'=>$m,'sourceCompte'=>$src,'destinationCompte'=>$dst,'montant'=>$mt + 0]);
            if ($j !== null && (int)$j >= 1 && (int)$j <= 31) oset($vir,'jourPrevu',(int)$j);
            $pool[] = $vir; oset($y,'virementsInternes',$pool);
            $log['cible'] = cfo_nom_compte_epargne($src, $fd) . ' → ' . cfo_nom_compte_epargne($dst, $fd);
            $log['virement_programme'] = ['annee'=>$a,'mois'=>$m,'jour'=>oget($vir,'jourPrevu', null),'montant'=>$mt + 0,
                'de'=>cfo_nom_compte_epargne($src, $fd),'vers'=>cfo_nom_compte_epargne($dst, $fd),'soldes_touches'=>false];
            break;
        }

        /* ── ÉPARGNE (schéma ARRAY v20.90, aligné Vue v17.99) ──────── */"""),
])

# ═══════════════════════════ APPLI ═══════════════════════════
patch('index.html', [
('correction 24 : définition',
"""                    const OPERATIONS_RETIREES = new Set(['04ed9c20']);""",
"""                    const OPERATIONS_RETIREES = new Set(['04ed9c20']);
                    //  v37.72 (schéma 24) : les deux transferts que le CFO a enregistrés sur les soldes du jour au lieu de les
                    //  programmer (aucun n'a eu lieu à la banque) — annulés compte par compte, SEULEMENT si le solde du compte
                    //  est exactement celui qu'ils ont laissé : empreinte de « id | solde » → correction à appliquer.
                    const SOLDES_A_CORRIGER = { '0491cf7e': -7898, '40cc44ec': 267, 'a5666a32': 7631 };"""),
('correction 24 : application',
"""                        const A = data.donneesAnnuelles || {};
                        Object.values(A).forEach(a => {
                            if (!a || !Array.isArray(a.transactionsReelles)) return;""",
"""                        (Array.isArray(data.comptes) ? data.comptes : []).forEach(c => {
                            const d = c && SOLDES_A_CORRIGER[_empreinte(String(c.id) + '|' + Math.round(Number(c.solde) || 0))];
                            if (d) { c.solde = Math.round(Number(c.solde) || 0) + d; n.soldes = (n.soldes || 0) + 1; }
                        });
                        if ((data._schemaVersion || 0) >= 23) return n;   // les corrections v37.68 (schéma 23) ne se rejouent pas
                        const A = data.donneesAnnuelles || {};
                        Object.values(A).forEach(a => {
                            if (!a || !Array.isArray(a.transactionsReelles)) return;"""),
('correction 24 : seuil',
"""                        if (!data || (data._schemaVersion || 0) >= 23) return n;""",
"""                        if (!data || (data._schemaVersion || 0) >= 24) return n;"""),
('correction 24 : journal',
"""                            if (_corr.operations) addLog(""",
"""                            if (_corr.soldes) addLog('↩️ ' + _corr.soldes + ' solde(s) remis comme avant les transferts enregistrés par le CFO sans avoir eu lieu à la banque.', 'success');
                            if (_corr.operations) addLog("""),
('exposés : soldes à corriger',
"""OPERATIONS_RETIREES, _empreinte,""",
"""OPERATIONS_RETIREES, SOLDES_A_CORRIGER, _empreinte,"""),
('export : schéma 24',
"""_schemaVersion: 23, soldesInitiaux""",
"""_schemaVersion: 24, soldesInitiaux"""),
])
patch('cfo_intent_engine.php', [
('relevé : virement programmé',
"""                'apres'   => $apres === null ? ($l['valeur'] ?? null) : $apres,
                'statut'  => $st ?: 'success',
            ], function ($v) { return $v !== null; });""",
"""                'apres'   => $apres === null ? ($l['valeur'] ?? null) : $apres,
                'virement_programme' => $l['virement_programme'] ?? null,   // v37.72 : de, vers, mois, jour, soldes_touches=false
                'statut'  => $st ?: 'success',
            ], function ($v) { return $v !== null; });"""),
])
print('✔ v37.72 : virement à faire = programmé (plan_transfer), adjust_account_balance verrouillé, transferts du CFO annulés')
