<?php
/**
 * ============================================================================
 *  CFO INTENT ENGINE v1.0 — moteur de compilation d'intentions budgétaires
 * ----------------------------------------------------------------------------
 *  Port PHP fidèle de la logique qui vivait dans le nœud n8n « Intent Compiler »
 *  (67 529 caractères de JavaScript embarqués dans un workflow).
 *
 *  Chaîne complète, dans l'ordre :
 *     calls[]  →  catalogue  →  changes[]  →  resolveEntity (Levenshtein)
 *              →  buildOps   →  applyOp    →  snapshot / delta
 *
 *  POURQUOI DES stdClass ET PAS DES TABLEAUX ASSOCIATIFS
 *  ----------------------------------------------------------------------------
 *  json_decode($s, true) écrase la distinction objet/tableau. Un `revenus: {}`
 *  vide reviendrait alors en `[]` au ré-encodage, et l'application Vue, qui fait
 *  Object.entries(y.revenus), casserait. On décode donc en objets (le défaut) et
 *  on manipule des stdClass : le JSON ressort exactement dans la forme où il est
 *  entré. Les helpers oget/oset/okeys ci-dessous existent uniquement pour ça.
 *
 *  Les objets PHP se passent par handle, comme en JavaScript : les mutations de
 *  $fd se propagent sans référence explicite. La sémantique du port est donc
 *  identique à celle de l'original.
 * ============================================================================
 */
declare(strict_types=1);

/* ══════════════════════════════════════════════════════════════════════════
   0. HELPERS OBJET
   ══════════════════════════════════════════════════════════════════════════ */

function oget($o, $k, $d = null) {
    if (is_object($o)) return property_exists($o, (string)$k) ? $o->{(string)$k} : $d;
    if (is_array($o))  return array_key_exists($k, $o) ? $o[$k] : $d;
    return $d;
}
function oset($o, $k, $v) { if (is_object($o)) $o->{(string)$k} = $v; }
function ohas($o, $k)     { return is_object($o) && property_exists($o, (string)$k); }
function odel($o, $k)     { if (is_object($o) && property_exists($o, (string)$k)) unset($o->{(string)$k}); }
function okeys($o) {
    if (is_object($o)) return array_map('strval', array_keys(get_object_vars($o)));
    if (is_array($o))  return array_map('strval', array_keys($o));
    return [];
}
function ovals($o) {
    if (is_object($o)) return array_values(get_object_vars($o));
    if (is_array($o))  return array_values($o);
    return [];
}
function onew() { return new stdClass(); }

/* ══════════════════════════════════════════════════════════════════════════
   1. NORMALISATION & DISTANCE
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * v35.2 — Translittération des accents, MAJUSCULES COMPRISES.
 *
 * Le piège : sans mbstring, strtolower() travaille octet par octet et ne
 * touche qu'aux A-Z ASCII. « É » (0xC3 0x89) lui survit intact, puis se fait
 * effacer par le filtre [^a-z0-9] — « ÉCOLE » deviendrait « cole » et ne
 * matcherait plus « ecole ». La table couvre donc les deux casses, et elle
 * s'applique AVANT la mise en minuscules.
 */
const CFO_TRANSLIT = [
    'À'=>'a','Á'=>'a','Â'=>'a','Ä'=>'a','Ã'=>'a','Å'=>'a','Ç'=>'c',
    'È'=>'e','É'=>'e','Ê'=>'e','Ë'=>'e','Ì'=>'i','Í'=>'i','Î'=>'i','Ï'=>'i',
    'Ñ'=>'n','Ò'=>'o','Ó'=>'o','Ô'=>'o','Ö'=>'o','Õ'=>'o','Ù'=>'u','Ú'=>'u',
    'Û'=>'u','Ü'=>'u','Ý'=>'y','Œ'=>'oe','Æ'=>'ae',
    'à'=>'a','á'=>'a','â'=>'a','ä'=>'a','ã'=>'a','å'=>'a','ç'=>'c',
    'è'=>'e','é'=>'e','ê'=>'e','ë'=>'e','ì'=>'i','í'=>'i','î'=>'i','ï'=>'i',
    'ñ'=>'n','ò'=>'o','ó'=>'o','ô'=>'o','ö'=>'o','õ'=>'o','ù'=>'u','ú'=>'u',
    'û'=>'u','ü'=>'u','ý'=>'y','ÿ'=>'y','œ'=>'oe','æ'=>'ae','ß'=>'ss',
];

/**
 * Minuscules sans dépendre de mbstring.
 *
 * mbstring est une extension OPTIONNELLE, absente de beaucoup d'installations
 * PHP par défaut — et son absence tuait tout le moteur par un
 * « Call to undefined function mb_strtolower() » (v35.2). On l'utilise quand
 * elle est là (comportement Unicode complet), sinon on retombe sur la table
 * de translittération + strtolower, ce qui couvre le latin dont on a besoin.
 */
function cfo_lower($s): string {
    $s = (string)$s;
    if (function_exists('mb_strtolower')) return mb_strtolower($s, 'UTF-8');
    return strtolower(strtr($s, CFO_TRANSLIT));
}

/** Équivalent de normStr() : minuscules, accents retirés, non-alphanum → espace. */
function cfo_norm_str($s): string {
    $s = cfo_lower($s);
    if (class_exists('Normalizer')) {
        $d = Normalizer::normalize($s, Normalizer::FORM_D);
        if ($d !== false && $d !== null) $s = preg_replace('/\p{Mn}+/u', '', $d);
    }
    // Table explicite : indispensable sans intl, inoffensive avec (les accents
    // ont déjà été décomposés). Jamais iconv//TRANSLIT, dont le résultat dépend
    // de la locale du serveur.
    $s = strtr($s, CFO_TRANSLIT);
    $s = preg_replace('/[^a-z0-9]+/', ' ', $s);
    return trim($s);
}

/**
 * Distance de Levenshtein. Après cfo_norm_str() la chaîne est ASCII pur :
 * la fonction native (qui travaille sur les octets) donne donc exactement le
 * même résultat que l'implémentation JS, en bien plus rapide. Le garde-fou à
 * 255 caractères est la limite documentée de levenshtein().
 */
function cfo_levenshtein(string $a, string $b): int {
    if ($a === $b) return 0;
    if (strlen($a) > 255) $a = substr($a, 0, 255);
    if (strlen($b) > 255) $b = substr($b, 0, 255);
    return levenshtein($a, $b);
}

function cfo_str_contains_either(string $a, string $b): bool {
    if ($a === '' || $b === '') return false;
    return (strpos($a, $b) !== false) || (strpos($b, $a) !== false);
}

/* ══════════════════════════════════════════════════════════════════════════
   2. PICK / PURGE  (portés de pickNum, pickStr, purgeKeys)
   ══════════════════════════════════════════════════════════════════════════ */

const CFO_SYN_NUM_CHARGE  = ['montant', 'value', 'amount'];
const CFO_SYN_NUM_REVENU  = ['valeur', 'montant', 'value', 'amount', 'salaire'];
const CFO_SYN_NUM_DEPENSE = ['valeur', 'value', 'amount'];
const CFO_SYN_LBL         = ['nom'];

function cfo_pick_num($op, array $keys) {
    foreach ($keys as $k) {
        $v = oget($op, $k, null);
        if ($v !== null && $v !== '') {
            if (is_numeric($v)) return $v + 0;
        }
    }
    return null;
}
function cfo_pick_str($op, array $keys) {
    foreach ($keys as $k) {
        if (ohas($op, $k)) {
            $v = oget($op, $k);
            if ($v !== null) return (string)$v;
        }
    }
    return null;
}
function cfo_purge_keys($obj, array $syns): int {
    $p = 0;
    if (!is_object($obj)) return 0;
    foreach ($syns as $s) { if (property_exists($obj, $s)) { unset($obj->{$s}); $p++; } }
    return $p;
}

function cfo_write_charge($t, $v, $l): void {
    if ($v !== null) oset($t, 'valeur', $v);
    if ($l !== null) oset($t, 'label', $l);
    cfo_purge_keys($t, CFO_SYN_NUM_CHARGE); cfo_purge_keys($t, CFO_SYN_LBL);
}
function cfo_write_revenu($t, $b, $l): void {
    if ($b !== null) oset($t, 'base', $b);
    if ($l !== null) oset($t, 'label', $l);
    cfo_purge_keys($t, CFO_SYN_NUM_REVENU); cfo_purge_keys($t, CFO_SYN_LBL);
}

function cfo_uid(): int { return (int)(microtime(true) * 1000) + random_int(0, 999); }

/* ══════════════════════════════════════════════════════════════════════════
   3. SANITIZE & SNAPSHOT
   ══════════════════════════════════════════════════════════════════════════ */

function cfo_sanitize_finance_data($fd): array {
    $r = ['revenus'=>0,'fixes'=>0,'variables'=>0,'epargne'=>0,'depenses'=>0];
    $da = oget($fd, 'donneesAnnuelles');
    if (!is_object($da)) return $r;

    foreach (okeys($da) as $yr) {
        $y = oget($da, $yr); if (!is_object($y)) continue;

        foreach (ovals(oget($y, 'revenus', onew())) as $o) {
            if (!is_object($o)) continue;
            if (oget($o, 'base', null) === null) {
                $rv = cfo_pick_num($o, ['valeur','montant','value','amount','salaire']);
                if ($rv !== null) oset($o, 'base', $rv);
            }
            if (oget($o, 'label', null) === null && oget($o, 'nom', null)) oset($o, 'label', (string)oget($o, 'nom'));
            $r['revenus'] += cfo_purge_keys($o, CFO_SYN_NUM_REVENU) + cfo_purge_keys($o, CFO_SYN_LBL);
        }
        foreach (ovals(oget($y, 'chargesFixes', onew())) as $o) {
            if (!is_object($o)) continue;
            if (oget($o, 'valeur', null) === null) {
                $rv = cfo_pick_num($o, ['montant','value','amount']);
                if ($rv !== null) oset($o, 'valeur', $rv);
            }
            if (oget($o, 'label', null) === null && oget($o, 'nom', null)) oset($o, 'label', (string)oget($o, 'nom'));
            $r['fixes'] += cfo_purge_keys($o, CFO_SYN_NUM_CHARGE) + cfo_purge_keys($o, CFO_SYN_LBL);
        }
        foreach (ovals(oget($y, 'chargesVariables', onew())) as $o) {
            if (!is_object($o)) continue;
            if (oget($o, 'valeur', null) === null) {
                $rv = cfo_pick_num($o, ['montant','value','amount']);
                if ($rv !== null) oset($o, 'valeur', $rv);
            }
            if (oget($o, 'label', null) === null && oget($o, 'nom', null)) oset($o, 'label', (string)oget($o, 'nom'));
            $r['variables'] += cfo_purge_keys($o, CFO_SYN_NUM_CHARGE) + cfo_purge_keys($o, CFO_SYN_LBL);
        }
        // epargne : array (schéma Vue v17.99) OU objet legacy — les deux itérés
        $ep = oget($y, 'epargne');
        $pool = is_array($ep) ? array_filter($ep) : array_filter(ovals($ep ?? onew()));
        foreach ($pool as $o) {
            if (!is_object($o)) continue;
            if (oget($o, 'valeur', null) === null) {
                $rv = cfo_pick_num($o, ['montant','value','amount']);
                if ($rv !== null) oset($o, 'valeur', $rv);
            }
            if (oget($o, 'label', null) === null && oget($o, 'nom', null)) oset($o, 'label', (string)oget($o, 'nom'));
            if (oget($o, 'nom', null)   === null && oget($o, 'label', null)) oset($o, 'nom', (string)oget($o, 'label'));
            $r['epargne'] += cfo_purge_keys($o, CFO_SYN_NUM_CHARGE) + cfo_purge_keys($o, CFO_SYN_LBL);
        }
        foreach ((oget($y, 'depensesIrregulieres') ?: []) as $d) {
            if (!is_object($d)) continue;
            if (oget($d, 'montant', null) === null) {
                $rv = cfo_pick_num($d, ['valeur','value','amount']);
                if ($rv !== null) oset($d, 'montant', $rv);
            }
            $r['depenses'] += cfo_purge_keys($d, CFO_SYN_NUM_DEPENSE);
        }
    }
    return $r;
}

function cfo_snapshot($fd, $yr) {
    $da = oget($fd, 'donneesAnnuelles');
    $y  = is_object($da) ? oget($da, (string)$yr) : null;
    if (!is_object($y)) return null;
    $sum = function ($obj) {
        $s = 0.0;
        foreach (ovals($obj ?? onew()) as $v) {
            if (!is_object($v)) continue;
            $n = oget($v, 'valeur', null);
            if ($n === null || !is_numeric($n)) $n = oget($v, 'base', null);
            $s += (is_numeric($n) ? $n + 0 : 0);
        }
        return $s;
    };
    $epRaw = oget($y, 'epargne');
    $epObj = $epRaw;
    if (is_array($epRaw)) { $epObj = onew(); foreach ($epRaw as $i => $e) oset($epObj, (string)$i, $e); }
    return [
        'revenus'       => $sum(oget($y, 'revenus')),
        'fixes'         => $sum(oget($y, 'chargesFixes')),
        'variables'     => $sum(oget($y, 'chargesVariables')),
        'epargne'       => $sum($epObj),
        'depensesIrreg' => count(oget($y, 'depensesIrregulieres') ?: []),
    ];
}

/* ══════════════════════════════════════════════════════════════════════════
   4. CALCULS MÉTIER (reliquat, net mensuel isolé du compte courant)
   ══════════════════════════════════════════════════════════════════════════ */

function cfo_compute_reliquat($fd, $yr) {
    $da = oget($fd, 'donneesAnnuelles');
    $y  = is_object($da) ? oget($da, (string)$yr) : null;
    if (!is_object($y)) return 0;
    $sumRev = 0.0; $sumFix = 0.0; $sumVar = 0.0;
    foreach (ovals(oget($y, 'revenus', onew())) as $o)      $sumRev += (float)(oget($o, 'base', 0) ?: 0);
    foreach (ovals(oget($y, 'chargesFixes', onew())) as $o) $sumFix += (float)(oget($o, 'valeur', 0) ?: 0);
    foreach (ovals(oget($y, 'chargesVariables', onew())) as $o) {
        $v = (float)(oget($o, 'valeur', 0) ?: 0);
        $sumVar += (oget($o, 'periode') === 'semaine') ? $v * 4.3 : $v;
    }
    return round($sumRev - $sumFix - $sumVar, 2);
}

function cfo_norm_key_c($k, string $courantKey): string {
    if (!$k || $k === 'courant') return $courantKey;
    if (preg_match('/^\d+$/', (string)$k)) return 'cpt_' . $k;
    return (string)$k;
}

function cfo_compute_monthly_net_courant($fd, $year): array {
    $da = oget($fd, 'donneesAnnuelles');
    $y  = is_object($da) ? oget($da, (string)$year) : null;
    if (!is_object($y)) return [];
    $si = oget($fd, 'soldesInitiaux', onew());

    $courantCpt = null;
    foreach ((oget($fd, 'comptes') ?: []) as $c) {
        if (is_object($c) && (oget($c, 'type') === 'courant' || oget($c, 'type') === 'liquide')) { $courantCpt = $c; break; }
    }
    $courantKey = $courantCpt ? 'cpt_' . oget($courantCpt, 'id') : 'courant';
    $isC = function ($k) use ($courantKey) { return cfo_norm_key_c($k, $courantKey) === $courantKey; };

    $fxSrc  = cfo_norm_key_c(oget($si, 'compteChargesFixes', 'courant'), $courantKey);
    $varSrc = cfo_norm_key_c(oget($si, 'compteChargesVariables', 'courant'), $courantKey);
    $curA   = (int)(oget($si, 'anneeActuelle') ?: (int)date('Y'));
    $curM   = (int)(oget($si, 'moisActuel') ?: (((int)$year === $curA) ? (int)date('n') : 1));

    $eff = function ($item, $base, int $m) {
        $v = (float)($base ?: 0);
        foreach ((oget($item, 'exceptions') ?: []) as $e) {
            $md = (int)(oget($e, 'moisDebut', 0) ?: 0);
            $mf = (int)(oget($e, 'moisFin', 0) ?: 0);
            if ($md && $mf && $m >= $md && $m <= $mf) $v = (float)(oget($e, 'nouvelleValeur', 0) ?: 0);
        }
        return $v;
    };

    $epRaw = oget($y, 'epargne');
    $epPool = is_array($epRaw) ? array_filter($epRaw) : array_filter(ovals($epRaw ?? onew()));
    $epArr = [];
    foreach ($epPool as $o) { if (is_object($o) && $isC(oget($o, 'sourceCompte'))) $epArr[] = $o; }

    $out = [];
    for ($m = 1; $m <= 12; $m++) {
        $isPast    = ((int)$year < $curA) || ((int)$year === $curA && $m < $curM);
        $isCurrent = ((int)$year === $curA && $m === $curM);
        if ($isPast) { $out[] = ['mois'=>$m,'net'=>null,'isPast'=>true,'isCurrent'=>false]; continue; }

        $entrants = 0.0; $sortants = 0.0;
        foreach (ovals(oget($y, 'revenus', onew())) as $r) {
            if (!$isC(oget($r, 'destinationCompte'))) continue;
            $v = $eff($r, oget($r, 'base'), $m); if ($v > 0) $entrants += $v;
        }
        if ($fxSrc === $courantKey) {
            foreach (ovals(oget($y, 'chargesFixes', onew())) as $f) {
                $v = $eff($f, oget($f, 'valeur'), $m); if ($v > 0) $sortants += $v;
            }
        }
        if ($varSrc === $courantKey) {
            foreach (ovals(oget($y, 'chargesVariables', onew())) as $cv) {
                $v = $eff($cv, oget($cv, 'valeur'), $m);
                if (oget($cv, 'periode') === 'semaine') $v *= 4.3;
                if ($v > 0) $sortants += $v;
            }
        }
        foreach ((oget($y, 'depensesIrregulieres') ?: []) as $d) {
            if (!is_object($d) || oget($d, 'sourceAssurance')) continue;
            if ((int)oget($d, 'mois') !== $m) continue;
            if (!$isC(oget($d, 'sourceCompte'))) continue;
            $raw = (float)(oget($d, 'montant', 0) ?: 0);
            if ($raw === 0.0) continue;
            if ($raw < 0) $entrants += abs($raw); else $sortants += $raw;
        }
        $ep = 0.0;
        foreach ($epArr as $o) $ep += $eff($o, oget($o, 'valeur'), $m);

        $solde = 0.0;
        if ($isCurrent) $solde = $courantCpt ? (float)(oget($courantCpt, 'solde', 0) ?: 0) : (float)(oget($si, 'courant', 0) ?: 0);

        $out[] = ['mois'=>$m, 'net'=>(int)round($solde + $entrants - $sortants - $ep), 'isPast'=>false, 'isCurrent'=>$isCurrent];
    }
    return $out;
}

/* ══════════════════════════════════════════════════════════════════════════
   5. CATALOGUE STRICT — l'unique surface exposée au modèle
      Toute fonction hors catalogue est refusée (ERROR_OUT_OF_CATALOG).
   ══════════════════════════════════════════════════════════════════════════ */

function cfo_obj(array $a) { $o = onew(); foreach ($a as $k => $v) { if ($v !== null) $o->{$k} = $v; } return $o; }

function cfo_years($args): array {
    $ys = oget($args, 'years');
    if (is_array($ys) && count($ys)) return array_map('intval', $ys);
    $one = oget($args, 'year', oget($args, 'annee', null));
    return [(int)($one ?: date('Y'))];
}

function cfo_catalog_names(): array {
    return [
        'create_smart_goal','add_funds_to_goal','set_recurring_savings','update_recurring_savings',
        'remove_recurring_savings','update_asset_valuation','add_fixed_expense','update_fixed_expense',
        'remove_fixed_expense','add_variable_expense','update_variable_expense','add_income','update_income',
        'add_one_off_expense','create_account','adjust_account_balance','set_initial_balance','clone_year',
    ];
}

/** Traduit un appel du catalogue en « changes » canoniques. */
function cfo_translate_call(string $fn, $a, array $ctx): array {
    $yrs = cfo_years($a);
    $num = function ($k, $d = 0) use ($a) { $v = oget($a, $k); return is_numeric($v) ? $v + 0 : $d; };

    switch ($fn) {
        case 'create_smart_goal':
            return [cfo_obj(['action'=>'add','category'=>'objectif','target'=>oget($a,'name'),'label'=>oget($a,'name'),
                'amount'=>$num('initial_funding'),'target_amount'=>$num('target_amount'),'years'=>$yrs,'notes'=>oget($a,'notes')])];

        case 'add_funds_to_goal':
            return [cfo_obj(['action'=>'modify','category'=>'objectif','target'=>oget($a,'name'),
                'amount'=>$num('amount'),'years'=>$yrs,'notes'=>oget($a,'notes')])];

        case 'set_recurring_savings': {
            $out = [];
            foreach ($yrs as $yr) {
                $pct = oget($a, 'percentage_of_reliquat', null);
                if ($pct !== null && $pct !== '') {
                    // Mode 1 — pourcentage du NET mensuel ISOLÉ du compte courant.
                    // SSOT prioritaire : le net exporté par l'application ; sinon recalcul backend.
                    $p = ((float)$pct) / 100.0;
                    $monthly = (is_array($ctx['monthlyNetFromPayload'] ?? null) && count($ctx['monthlyNetFromPayload']))
                        ? $ctx['monthlyNetFromPayload']
                        : cfo_compute_monthly_net_courant($ctx['financeData'], $yr);
                    $exceptions = [];
                    foreach ($monthly as $mo) {
                        $isPast = (bool)(oget($mo, 'isPast', is_array($mo) ? ($mo['isPast'] ?? false) : false));
                        $net    = oget($mo, 'net', is_array($mo) ? ($mo['net'] ?? null) : null);
                        $mois   = oget($mo, 'mois', is_array($mo) ? ($mo['mois'] ?? null) : null);
                        $amt    = (!$isPast && is_numeric($net) && $net > 0) ? (int)round($p * (float)$net) : 0;
                        $exceptions[] = cfo_obj(['moisDebut'=>(int)$mois,'moisFin'=>(int)$mois,'nouvelleValeur'=>$amt]);
                    }
                    $out[] = cfo_obj(['action'=>'add','category'=>'epargne','target'=>oget($a,'name'),'label'=>oget($a,'name'),
                        'amount'=>0,'sourceCompte'=>oget($a,'source_account','courant'),'years'=>[$yr],
                        'exceptions'=>$exceptions,'notes'=>oget($a,'notes')]);
                    continue;
                }
                // Mode 2 — montant fixe mensuel
                $fixed = oget($a, 'fixed_amount', null);
                $amount = is_numeric($fixed) ? $fixed + 0 : $num('amount');
                $ch = cfo_obj(['action'=>'add','category'=>'epargne','target'=>oget($a,'name'),'label'=>oget($a,'name'),
                    'amount'=>$amount,'sourceCompte'=>oget($a,'source_account','courant'),'years'=>[$yr],'notes'=>oget($a,'notes')]);
                if (is_array(oget($a, 'exceptions'))) oset($ch, 'exceptions', oget($a, 'exceptions'));
                $out[] = $ch;
            }
            return $out;
        }

        case 'update_recurring_savings':
            return [cfo_obj(['action'=>'modify','category'=>'epargne','target'=>oget($a,'name'),
                'amount'=>$num('amount'),'label'=>oget($a,'new_name'),'years'=>$yrs])];

        case 'remove_recurring_savings':
            return [cfo_obj(['action'=>'remove','category'=>'epargne','target'=>oget($a,'name'),'years'=>$yrs])];

        case 'update_asset_valuation': {
            $ch = cfo_obj(['action'=>'modify','category'=>'actif','target'=>oget($a,'asset_name'),'amount'=>$num('new_value')]);
            if (oget($a, 'scenario')) oset($ch, 'sub_target', oget($a, 'scenario'));
            if (oget($a, 'valeur_actuelle', null) !== null) oset($ch, 'valeur_actuelle', oget($a, 'valeur_actuelle'));
            return [$ch];
        }

        case 'add_fixed_expense':
            return [cfo_obj(['action'=>'add','category'=>'charge_fixe','target'=>oget($a,'name'),'label'=>oget($a,'name'),'amount'=>$num('amount'),'years'=>$yrs])];
        case 'update_fixed_expense':
            return [cfo_obj(['action'=>'modify','category'=>'charge_fixe','target'=>oget($a,'name'),'amount'=>$num('amount'),'years'=>$yrs])];
        case 'remove_fixed_expense':
            return [cfo_obj(['action'=>'remove','category'=>'charge_fixe','target'=>oget($a,'name'),'years'=>$yrs])];

        case 'add_variable_expense':
            return [cfo_obj(['action'=>'add','category'=>'charge_variable','target'=>oget($a,'name'),'label'=>oget($a,'name'),
                'amount'=>$num('amount'),'period'=>oget($a,'period','mois'),'years'=>$yrs])];
        case 'update_variable_expense': {
            $ch = cfo_obj(['action'=>'modify','category'=>'charge_variable','target'=>oget($a,'name'),'amount'=>$num('amount'),'years'=>$yrs]);
            if (oget($a, 'sub_target')) oset($ch, 'sub_target', oget($a, 'sub_target'));
            return [$ch];
        }

        case 'add_income':
            return [cfo_obj(['action'=>'add','category'=>'revenu','target'=>oget($a,'name'),'label'=>oget($a,'name'),'amount'=>$num('amount'),'years'=>$yrs])];
        case 'update_income':
            return [cfo_obj(['action'=>'modify','category'=>'revenu','target'=>oget($a,'name'),'amount'=>$num('amount'),'years'=>$yrs])];

        case 'add_one_off_expense':
            return [cfo_obj(['action'=>'add','category'=>'depense_ponctuelle','target'=>oget($a,'name'),'label'=>oget($a,'name'),
                'amount'=>$num('amount'),'month'=>(int)($num('month', 1) ?: 1),'years'=>$yrs])];

        case 'create_account':
            return [cfo_obj(['action'=>'add','category'=>'compte','target'=>oget($a,'label'),'label'=>oget($a,'label'),'amount'=>$num('balance')])];
        case 'adjust_account_balance':
            return [cfo_obj(['action'=>'modify','category'=>'compte','target'=>oget($a,'account'),'amount'=>$num('amount')])];
        case 'set_initial_balance':
            return [cfo_obj(['action'=>'set_balance','category'=>'solde','balance_key'=>oget($a,'account','courant'),'amount'=>$num('amount')])];
        case 'clone_year':
            return [cfo_obj(['action'=>'clone_year','category'=>'annee','clone_from_year'=>(int)$num('from_year'),'years'=>[(int)$num('to_year')]])];
    }
    return [];
}

/* ══════════════════════════════════════════════════════════════════════════
   6. ENTITY RESOLVER — libellé approximatif → clé technique
   ══════════════════════════════════════════════════════════════════════════ */

const CFO_POOL_MAP = [
    'revenu' => 'revenus', 'charge_fixe' => 'chargesFixes',
    'charge_variable' => 'chargesVariables', 'epargne' => 'epargne',
];

function cfo_resolve_entity($target, $category, $fd): array {
    $normT = cfo_norm_str($target);
    $candidates = []; $seen = [];
    $catKeys = ($category && isset(CFO_POOL_MAP[$category])) ? [$category] : array_keys(CFO_POOL_MAP);

    $da = oget($fd, 'donneesAnnuelles', onew());
    foreach (okeys($da) as $yr) {
        $y = oget($da, $yr); if (!is_object($y)) continue;
        foreach ($catKeys as $cat) {
            $rawPool = oget($y, CFO_POOL_MAP[$cat], onew());
            // epargne v17.99 = tableau d'objets {id, nom, ...} → clé technique 'ep_'+id
            $pool = onew();
            if (is_array($rawPool)) {
                foreach ($rawPool as $item) { if (is_object($item)) oset($pool, 'ep_' . (oget($item, 'id') ?? ''), $item); }
            } elseif (is_object($rawPool)) { $pool = $rawPool; }

            foreach (okeys($pool) as $key) {
                $dk = $cat . ':' . $key;
                if (isset($seen[$dk])) continue; $seen[$dk] = true;
                $item = oget($pool, $key);
                $lbl  = oget($item, 'label') ?: (oget($item, 'nom') ?: $key);
                $normL = cfo_norm_str($lbl); $normK = cfo_norm_str($key);
                $dist = min(cfo_levenshtein($normT, $normL), cfo_levenshtein($normT, $normK));
                $contains = cfo_str_contains_either($normL, $normT) || cfo_str_contains_either($normK, $normT);
                $candidates[] = ['key'=>$key,'label'=>$lbl,'category'=>$cat,'dist'=>$dist,'contains'=>$contains];
            }
        }
    }

    if (!$category || $category === 'solde') {
        foreach (okeys(oget($fd, 'soldesInitiaux', onew())) as $key) {
            $dk = 'solde:' . $key;
            if (isset($seen[$dk])) continue; $seen[$dk] = true;
            $normK = cfo_norm_str($key);
            $candidates[] = ['key'=>$key,'label'=>$key,'category'=>'solde',
                'dist'=>cfo_levenshtein($normT, $normK), 'contains'=>cfo_str_contains_either($normK, $normT)];
        }
    }

    if (!count($candidates)) {
        return ['resolved'=>false, 'error'=>'"'.$target.'" introuvable'.($category ? ' dans '.$category : '').'. Finance data vide ou catégorie incorrecte.'];
    }

    // Tri stable : "contains" d'abord, puis distance croissante.
    // usort n'est pas stable avant PHP 8.0 : on indexe pour garantir l'ordre
    // d'origine à égalité, et rester identique au sort() JS.
    foreach ($candidates as $i => &$c) { $c['_i'] = $i; } unset($c);
    usort($candidates, function ($a, $b) {
        if ($a['contains'] !== $b['contains']) return $a['contains'] ? -1 : 1;
        if ($a['dist'] !== $b['dist']) return $a['dist'] <=> $b['dist'];
        return $a['_i'] <=> $b['_i'];
    });

    $best = $candidates[0];
    $second = $candidates[1] ?? null;
    $thresh = max(4, (int)floor(strlen($normT) * 0.55));

    if ($second && $second['contains'] && $best['contains'] && $best['key'] !== $second['key']
        && $best['dist'] === $second['dist'] && $best['category'] === $second['category']) {
        return ['resolved'=>false, 'ambiguous'=>true, 'choices'=>[$best, $second],
            'error'=>'"'.$target.'" est ambigu. Précise : "'.$best['label'].'" ('.$best['key'].') ou "'.$second['label'].'" ('.$second['key'].') ?'];
    }
    if (!$best['contains'] && $best['dist'] > $thresh) {
        $sugg = implode(', ', array_map(function ($c) { return '"'.$c['label'].'"'; }, array_slice($candidates, 0, 4)));
        return ['resolved'=>false, 'error'=>'"'.$target.'" ne correspond à aucune ligne connue. Lignes proches : '.$sugg];
    }
    return ['resolved'=>true, 'key'=>$best['key'], 'label'=>$best['label'], 'category'=>$best['category']];
}

/* ══════════════════════════════════════════════════════════════════════════
   7. OP BUILDER — (action, category, clé résolue) → ops canoniques
      Le modèle ne voit jamais ces types techniques : ils naissent ici.
   ══════════════════════════════════════════════════════════════════════════ */

function cfo_build_ops($change, $resolvedKey, $resolvedCat, $annee): ?array {
    $action   = oget($change, 'action');
    $amount   = oget($change, 'amount', null);
    $newLabel = oget($change, 'label', null);
    $period   = oget($change, 'period', null);
    $target   = oget($change, 'target', null);
    $subTarget= oget($change, 'sub_target', null);
    $amt = (is_numeric($amount)) ? $amount + 0 : null;

    // v15.14 — collision de clés sur les 'add' : suffixe aléatoire base36,
    // pour que trois ajouts du même libellé produisent trois clés distinctes.
    $safeTarget = cfo_norm_str((string)($target ?: ($newLabel ?: 'nouvelle_ligne')));
    $safeTarget = str_replace(' ', '_', $safeTarget);
    if ($safeTarget === '') $safeTarget = 'nouvelle_ligne';
    $baseKey = $resolvedKey ?: (($action === 'add') ? $safeTarget . '_' . substr(base_convert((string)random_int(100000, 999999999), 10, 36), 0, 4) : $safeTarget);

    $o = 'cfo_obj';

    switch ($action) {
        case 'modify':
            switch ($resolvedCat) {
                case 'revenu':      return [$o(['type'=>'update_revenu','key'=>$resolvedKey,'base'=>$amt,'label'=>$newLabel ?: null])];
                case 'charge_fixe': return [$o(['type'=>'update_charge_fixe','key'=>$resolvedKey,'valeur'=>$amt,'label'=>$newLabel ?: null])];
                case 'charge_variable':
                    if ($subTarget) return [$o(['type'=>'update_charge_variable_detail','key'=>$resolvedKey,'sub_key'=>$subTarget,'montant'=>$amt])];
                    return [$o(['type'=>'update_charge_variable','key'=>$resolvedKey,'valeur'=>$amt,'periode'=>$period ?: null,'label'=>$newLabel ?: null])];
                case 'epargne':     return [$o(['type'=>'update_epargne','key'=>$resolvedKey,'valeur'=>$amt,'label'=>$newLabel ?: null])];
                case 'studio':      return [$o(['type'=>'set_projet_studio','annee'=>$annee,'key'=>oget($change,'studio_key') ?: ($resolvedKey ?: 'travaux'),'valeur'=>$amt])];
                case 'solde':       return [$o(['type'=>'set_solde_initial','key'=>oget($change,'balance_key') ?: ($resolvedKey ?: 'courant'),'valeur'=>$amt])];
                case 'compte':      return [$o(['type'=>'update_compte','key'=>oget($change,'target_key') ?: $target,'montant'=>$amt])];
                case 'objectif':    return [$o(['type'=>'update_objectif','key'=>oget($change,'target_key') ?: $target,'montant'=>$amt])];
                case 'actif':
                case 'foncier': {
                    $op = $o(['type'=>'update_master_asset','key'=>oget($change,'target_key') ?: $target,'montant'=>$amt]);
                    $scen = $subTarget ?: oget($change, 'sous_categorie', null);
                    if ($scen) oset($op, 'scenario', $scen);
                    foreach (['taux_credit','annees_total','annees_restantes','apport_personnel','montant_credit','valeur_actuelle'] as $f) {
                        if (oget($change, $f, null) !== null) oset($op, $f, oget($change, $f));
                    }
                    return [$op];
                }
            }
            return null;

        case 'add':
            switch ($resolvedCat) {
                case 'revenu':          return [$o(['type'=>'add_revenu','key'=>$baseKey,'label'=>$newLabel ?: $target,'base'=>$amt ?? 0])];
                case 'charge_fixe':     return [$o(['type'=>'add_charge_fixe','key'=>$baseKey,'label'=>$newLabel ?: $target,'valeur'=>$amt ?? 0])];
                case 'charge_variable': return [$o(['type'=>'add_charge_variable','key'=>$baseKey,'label'=>$newLabel ?: $target,'valeur'=>$amt ?? 0,'periode'=>$period ?: 'mois'])];
                case 'epargne': {
                    $op = $o(['type'=>'add_epargne','key'=>$baseKey,'label'=>$newLabel ?: $target,'valeur'=>$amt ?? 0]);
                    if (oget($change,'sourceCompte')) oset($op, 'sourceCompte', oget($change,'sourceCompte'));
                    if (oget($change,'linkedAccountId', null) !== null) oset($op, 'linkedAccountId', oget($change,'linkedAccountId'));
                    if (is_array(oget($change,'exceptions'))) oset($op, 'exceptions', oget($change,'exceptions'));
                    return [$op];
                }
                case 'depense_ponctuelle': return [$o(['type'=>'add_depense_ponctuelle','annee'=>$annee,'mois'=>(int)(oget($change,'month') ?: 1),'nom'=>$newLabel ?: $target,'montant'=>$amt ?? 0])];
                case 'compte':   return [$o(['type'=>'create_compte','label'=>$newLabel ?: $target,'montant'=>$amt ?? 0])];
                case 'objectif': return [$o(['type'=>'create_objectif','name'=>$newLabel ?: $target,'current'=>$amt ?? 0,'target_amount'=>oget($change,'target_amount', 0)])];
            }
            return null;

        case 'remove':
            switch ($resolvedCat) {
                case 'revenu':          return [$o(['type'=>'remove_revenu','key'=>$resolvedKey])];
                case 'charge_fixe':     return [$o(['type'=>'remove_charge_fixe','key'=>$resolvedKey])];
                case 'charge_variable': return [$o(['type'=>'remove_charge_variable','key'=>$resolvedKey])];
                case 'epargne':         return [$o(['type'=>'remove_epargne','key'=>$resolvedKey])];
                case 'depense_ponctuelle':
                    return oget($change,'one_off_id')
                        ? [$o(['type'=>'remove_depense_ponctuelle','annee'=>$annee,'id'=>oget($change,'one_off_id')])]
                        : [$o(['type'=>'remove_depense_ponctuelle','annee'=>$annee,'nom'=>$target])];
                case 'annee':           return [$o(['type'=>'delete_annee','annee'=>$annee])];
            }
            return null;

        case 'rename':
            if (!$newLabel) return null;
            if ($resolvedCat === 'revenu')      return [$o(['type'=>'rename_revenu','key'=>$resolvedKey,'label'=>$newLabel])];
            if ($resolvedCat === 'charge_fixe') return [$o(['type'=>'rename_charge_fixe','key'=>$resolvedKey,'label'=>$newLabel])];
            return null;

        case 'add_exception': {
            $ex = ['moisDebut'=>oget($change,'exception_start'),'moisFin'=>oget($change,'exception_end'),'nouvelleValeur'=>oget($change,'exception_value')];
            if ($resolvedCat === 'revenu')      return [$o(array_merge(['type'=>'add_revenu_exception','key'=>$resolvedKey], $ex))];
            if ($resolvedCat === 'charge_fixe') return [$o(array_merge(['type'=>'add_charge_fixe_exception','key'=>$resolvedKey], $ex))];
            if ($resolvedCat === 'epargne')     return [$o(array_merge(['type'=>'add_epargne_exception','key'=>$resolvedKey ?: $target], $ex))];
            return null;
        }
        case 'remove_exception': {
            $id = oget($change,'exception_id');
            if ($resolvedCat === 'revenu')      return [$o(['type'=>'remove_revenu_exception','key'=>$resolvedKey,'id'=>$id])];
            if ($resolvedCat === 'charge_fixe') return [$o(['type'=>'remove_charge_fixe_exception','key'=>$resolvedKey,'id'=>$id])];
            if ($resolvedCat === 'epargne')     return [$o(['type'=>'remove_epargne_exception','key'=>$resolvedKey ?: $target,'id'=>$id])];
            return null;
        }
        case 'update_one_off':
            if (!oget($change,'one_off_id')) return null;
            return [$o(['type'=>'update_depense_ponctuelle','id'=>oget($change,'one_off_id'),'montant'=>$amt,
                'mois'=>oget($change,'month') ?: null,'nom'=>$newLabel ?: null])];
        case 'clone_year':
            return [$o(['type'=>'clone_annee','depuis'=>oget($change,'clone_from_year') ?: ($annee - 1),'vers'=>$annee])];
        case 'set_balance':
            return [$o(['type'=>'set_solde_initial','key'=>oget($change,'balance_key') ?: $baseKey,'valeur'=>$amt])];
        case 'set_studio':
            return [$o(['type'=>'set_projet_studio','annee'=>$annee,'key'=>oget($change,'studio_key') ?: $baseKey,'valeur'=>$amt])];
    }
    return null;
}

/* ══════════════════════════════════════════════════════════════════════════
   8. APPLY OP — la seule fonction qui mute réellement l'état
   ══════════════════════════════════════════════════════════════════════════ */

/** epargne legacy (objet) → tableau, idempotent. */
function cfo_ep_migrate($y): void {
    $ep = oget($y, 'epargne');
    if (is_object($ep)) {
        $arr = [];
        foreach (okeys($ep) as $k) { $v = oget($ep, $k); if (is_object($v)) { if (oget($v,'id',null) === null) oset($v,'id',$k); $arr[] = $v; } }
        oset($y, 'epargne', $arr);
    }
}
/** Retrouve une épargne par id, 'ep_<id>' ou nom approximatif. */
function cfo_ep_find(array $pool, $key) {
    $normKey = cfo_norm_str($key);
    foreach ($pool as $i => $e) {
        if (!is_object($e)) continue;
        if ((string)oget($e,'id') === (string)$key) return [$i, $e];
        if ('ep_' . oget($e,'id') === (string)$key) return [$i, $e];
        $nm = cfo_norm_str(oget($e,'nom') ?: oget($e,'label', ''));
        if ($normKey !== '' && strpos($nm, $normKey) !== false) return [$i, $e];
    }
    return [-1, null];
}

function cfo_apply_op($fd, $op, $anneeTarget): array {
    $a  = (int)(oget($op, 'annee') ?: $anneeTarget);
    $da = oget($fd, 'donneesAnnuelles');
    $y  = is_object($da) ? oget($da, (string)$a) : null;
    $log = ['op' => oget($op, 'type')];
    $K = oget($op, 'key');

    try {
        switch (oget($op, 'type')) {

        /* ── REVENUS ───────────────────────────────────────────────── */
        case 'set_revenu': {
            $R = $y ? oget($y,'revenus') : null;
            if (!$R || !ohas($R,$K)) { $log['status']='skip'; $log['reason']='clé absente'; break; }
            $v = cfo_pick_num($op, ['base','valeur','montant','value','amount','salaire']);
            if ($v === null) { $log['status']='error'; $log['reason']='valeur manquante'; break; }
            $t = oget($R,$K); $old = oget($t,'base'); cfo_write_revenu($t, $v, null);
            $log['key']=$K; $log['avant']=$old; $log['apres']=$v; break;
        }
        case 'add_revenu': {
            if (!$y) { $log['status']='skip'; $log['reason']='année absente'; break; }
            if (!is_object(oget($y,'revenus'))) oset($y,'revenus',onew());
            $R = oget($y,'revenus');
            if (ohas($R,$K)) { $log['status']='skip'; $log['reason']='clé existe déjà'; break; }
            $v = cfo_pick_num($op, ['base','valeur','montant','value','amount','salaire']); if ($v === null) $v = 0;
            $lbl = cfo_pick_str($op, ['label','nom']) ?: $K;
            oset($R, $K, cfo_obj(['label'=>$lbl,'base'=>$v,'showExceptions'=>false,'exceptions'=>[]]));
            $log['key']=$K; $log['created']=true; $log['base']=$v; break;
        }
        case 'remove_revenu': {
            $R = $y ? oget($y,'revenus') : null;
            if (!$R || !ohas($R,$K)) { $log['status']='skip'; $log['reason']='clé absente'; break; }
            odel($R,$K); $log['key']=$K; $log['removed']=true; break;
        }
        case 'rename_revenu': {
            $R = $y ? oget($y,'revenus') : null;
            if (!$R || !ohas($R,$K)) { $log['status']='skip'; $log['reason']='clé absente'; break; }
            $lbl = cfo_pick_str($op, ['label','nom']);
            if (!$lbl) { $log['status']='error'; $log['reason']='label manquant'; break; }
            $t = oget($R,$K); $old = oget($t,'label'); cfo_write_revenu($t, null, $lbl);
            $log['key']=$K; $log['avant']=$old; $log['apres']=$lbl; break;
        }
        case 'update_revenu': {
            $R = $y ? oget($y,'revenus') : null;
            if (!$R || !ohas($R,$K)) { $log['status']='skip'; $log['reason']='clé absente'; break; }
            $v = cfo_pick_num($op, ['base','valeur','montant','value','amount','salaire']);
            $lbl = cfo_pick_str($op, ['label','nom']);
            $t = oget($R,$K); $ch = [];
            if ($v   !== null) $ch['base']  = ['avant'=>oget($t,'base'), 'apres'=>$v];
            if ($lbl !== null) $ch['label'] = ['avant'=>oget($t,'label'),'apres'=>$lbl];
            if (!count($ch)) { $log['status']='error'; $log['reason']='aucun champ fourni'; break; }
            cfo_write_revenu($t, $v, $lbl); $log['key']=$K; $log['changes']=$ch; break;
        }
        case 'add_revenu_exception': {
            $R = $y ? oget($y,'revenus') : null;
            if (!$R || !ohas($R,$K)) { $log['status']='skip'; $log['reason']='clé absente'; break; }
            $t = oget($R,$K);
            if (!is_array(oget($t,'exceptions'))) oset($t,'exceptions',[]);
            $id = cfo_uid(); $ex = oget($t,'exceptions');
            $ex[] = cfo_obj(['id'=>$id,'moisDebut'=>(int)oget($op,'moisDebut'),'moisFin'=>(int)oget($op,'moisFin'),'nouvelleValeur'=>(float)oget($op,'nouvelleValeur')]);
            oset($t,'exceptions',$ex); oset($t,'showExceptions',true);
            $log['key']=$K; $log['id']=$id; break;
        }
        case 'remove_revenu_exception': {
            $R = $y ? oget($y,'revenus') : null;
            if (!$R || !ohas($R,$K)) { $log['status']='skip'; $log['reason']='clé absente'; break; }
            $t = oget($R,$K); $ex = oget($t,'exceptions') ?: []; $before = count($ex);
            $ex = array_values(array_filter($ex, function ($e) use ($op) { return (float)oget($e,'id') !== (float)oget($op,'id'); }));
            oset($t,'exceptions',$ex);
            $log['key']=$K; $log['supprimees']=$before - count($ex); break;
        }

        /* ── CHARGES FIXES ─────────────────────────────────────────── */
        case 'set_charge_fixe': {
            $C = $y ? oget($y,'chargesFixes') : null;
            if (!$C || !ohas($C,$K)) { $log['status']='skip'; $log['reason']='clé absente'; break; }
            $v = cfo_pick_num($op, ['valeur','montant','value','amount']);
            if ($v === null) { $log['status']='error'; $log['reason']='valeur manquante'; break; }
            $t = oget($C,$K); $old = oget($t,'valeur'); cfo_write_charge($t,$v,null);
            $log['key']=$K; $log['avant']=$old; $log['apres']=$v; break;
        }
        case 'add_charge_fixe': {
            if (!$y) { $log['status']='skip'; $log['reason']='année absente'; break; }
            if (!is_object(oget($y,'chargesFixes'))) oset($y,'chargesFixes',onew());
            $C = oget($y,'chargesFixes');
            if (ohas($C,$K)) { $log['status']='skip'; $log['reason']='clé existe déjà'; break; }
            $v = cfo_pick_num($op, ['valeur','montant','value','amount']); if ($v === null) $v = 0;
            $lbl = cfo_pick_str($op, ['label','nom']) ?: $K;
            oset($C,$K, cfo_obj(['label'=>$lbl,'valeur'=>$v,'showExceptions'=>false,'exceptions'=>[],'montantPaye'=>0,'paye'=>false]));
            $log['key']=$K; $log['created']=true; $log['valeur']=$v; break;
        }
        case 'remove_charge_fixe': {
            $C = $y ? oget($y,'chargesFixes') : null;
            if (!$C || !ohas($C,$K)) { $log['status']='skip'; $log['reason']='clé absente'; break; }
            odel($C,$K); $log['key']=$K; $log['removed']=true; break;
        }
        case 'rename_charge_fixe': {
            $C = $y ? oget($y,'chargesFixes') : null;
            if (!$C || !ohas($C,$K)) { $log['status']='skip'; $log['reason']='clé absente'; break; }
            $lbl = cfo_pick_str($op, ['label','nom']);
            if (!$lbl) { $log['status']='error'; $log['reason']='label manquant'; break; }
            $t = oget($C,$K); $old = oget($t,'label'); cfo_write_charge($t,null,$lbl);
            $log['key']=$K; $log['avant']=$old; $log['apres']=$lbl; break;
        }
        case 'update_charge_fixe': {
            $C = $y ? oget($y,'chargesFixes') : null;
            if (!$C || !ohas($C,$K)) { $log['status']='skip'; $log['reason']='clé absente'; break; }
            $v = cfo_pick_num($op, ['valeur','montant','value','amount']);
            $lbl = cfo_pick_str($op, ['label','nom']);
            $t = oget($C,$K); $ch = [];
            if ($v   !== null) $ch['valeur'] = ['avant'=>oget($t,'valeur'),'apres'=>$v];
            if ($lbl !== null) $ch['label']  = ['avant'=>oget($t,'label'), 'apres'=>$lbl];
            if (!count($ch)) { $log['status']='error'; $log['reason']='aucun champ fourni'; break; }
            cfo_write_charge($t,$v,$lbl); $log['key']=$K; $log['changes']=$ch; break;
        }
        case 'add_charge_fixe_exception': {
            $C = $y ? oget($y,'chargesFixes') : null;
            if (!$C || !ohas($C,$K)) { $log['status']='skip'; $log['reason']='clé absente'; break; }
            $t = oget($C,$K);
            if (!is_array(oget($t,'exceptions'))) oset($t,'exceptions',[]);
            $id = cfo_uid(); $ex = oget($t,'exceptions');
            $ex[] = cfo_obj(['id'=>$id,'moisDebut'=>(int)oget($op,'moisDebut'),'moisFin'=>(int)oget($op,'moisFin'),'nouvelleValeur'=>(float)oget($op,'nouvelleValeur')]);
            oset($t,'exceptions',$ex); oset($t,'showExceptions',true);
            $log['key']=$K; $log['id']=$id; break;
        }
        case 'remove_charge_fixe_exception': {
            $C = $y ? oget($y,'chargesFixes') : null;
            if (!$C || !ohas($C,$K)) { $log['status']='skip'; $log['reason']='clé absente'; break; }
            $t = oget($C,$K); $ex = oget($t,'exceptions') ?: []; $before = count($ex);
            $ex = array_values(array_filter($ex, function ($e) use ($op) { return (float)oget($e,'id') !== (float)oget($op,'id'); }));
            oset($t,'exceptions',$ex);
            $log['key']=$K; $log['supprimees']=$before - count($ex); break;
        }

        /* ── CHARGES VARIABLES ─────────────────────────────────────── */
        case 'set_charge_variable': {
            $C = $y ? oget($y,'chargesVariables') : null;
            if (!$C || !ohas($C,$K)) { $log['status']='skip'; $log['reason']='clé absente'; break; }
            $v = cfo_pick_num($op, ['valeur','montant','value','amount']);
            if ($v === null) { $log['status']='error'; $log['reason']='valeur manquante'; break; }
            $item = oget($C,$K); $old = oget($item,'valeur'); $det = oget($item,'details');
            if (is_array($det) && count($det) > 0) {
                $cs = 0.0; foreach ($det as $d) $cs += (float)(oget($d,'montant',0) ?: 0);
                if ($cs == 0.0) {
                    $log['status']='error'; $log['requires_redistribution']=true;
                    $log['reason']='Sous-lignes toutes à 0 — précise comment ventiler'; $log['nouveau_total']=$v;
                    $log['lignes']=array_map(function($d){return ['id'=>oget($d,'id'),'nom'=>oget($d,'nom'),'montant_actuel'=>oget($d,'montant')];}, $det);
                    break;
                }
                $ratio = $v / $cs; $dist = 0;
                for ($i = 0; $i < count($det) - 1; $i++) { $nm = (int)round((float)oget($det[$i],'montant') * $ratio); oset($det[$i],'montant',$nm); $dist += $nm; }
                oset($det[count($det)-1],'montant', $v - $dist);
                $log['redistribution']='proportionnelle'; $log['ratio']=round($ratio,3);
                $log['details_apres']=array_map(function($d){return ['nom'=>oget($d,'nom'),'montant'=>oget($d,'montant')];}, $det);
            }
            cfo_write_charge($item,$v,null); $log['key']=$K; $log['avant']=$old; $log['apres']=$v; break;
        }
        case 'add_charge_variable': {
            if (!$y) { $log['status']='skip'; $log['reason']='année absente'; break; }
            if (!is_object(oget($y,'chargesVariables'))) oset($y,'chargesVariables',onew());
            $C = oget($y,'chargesVariables');
            if (ohas($C,$K)) { $log['status']='skip'; $log['reason']='clé existe déjà'; break; }
            $v = cfo_pick_num($op, ['valeur','montant','value','amount']); if ($v === null) $v = 0;
            $per = in_array(oget($op,'periode'), ['semaine','mois'], true) ? oget($op,'periode') : 'mois';
            $lbl = cfo_pick_str($op, ['label','nom']) ?: $K;
            oset($C,$K, cfo_obj(['label'=>$lbl,'valeur'=>$v,'periode'=>$per,'showDetails'=>false,'details'=>[]]));
            $log['key']=$K; $log['created']=true; $log['valeur']=$v; $log['periode']=$per; break;
        }
        case 'remove_charge_variable': {
            $C = $y ? oget($y,'chargesVariables') : null;
            if (!$C || !ohas($C,$K)) { $log['status']='skip'; $log['reason']='clé absente'; break; }
            odel($C,$K); $log['key']=$K; $log['removed']=true; break;
        }
        case 'set_charge_variable_periode': {
            $C = $y ? oget($y,'chargesVariables') : null;
            if (!$C || !ohas($C,$K)) { $log['status']='skip'; $log['reason']='clé absente'; break; }
            if (!in_array(oget($op,'periode'), ['mois','semaine'], true)) { $log['status']='error'; $log['reason']='periode invalide (mois|semaine)'; break; }
            $t = oget($C,$K); $old = oget($t,'periode'); oset($t,'periode',oget($op,'periode'));
            $log['key']=$K; $log['avant']=$old; $log['apres']=oget($op,'periode'); break;
        }
        case 'update_charge_variable_detail': {
            $C = $y ? oget($y,'chargesVariables') : null;
            if (!$C || !ohas($C,$K)) { $log['status']='skip'; $log['reason']='clé mère absente'; break; }
            $t = oget($C,$K); $det = oget($t,'details');
            if (!is_array($det) || !count($det)) { $log['status']='error'; $log['reason']='aucune sous-ligne existante'; break; }
            $normSub = cfo_norm_str(oget($op,'sub_key')); $detail = null;
            foreach ($det as $d) { if (cfo_str_contains_either(cfo_norm_str(oget($d,'nom')), $normSub)) { $detail = $d; break; } }
            if (!$detail) { $log['status']='error'; $log['reason']='sous-ligne introuvable: '.oget($op,'sub_key'); break; }
            $v = cfo_pick_num($op, ['montant','valeur','value','amount']);
            if ($v === null) { $log['status']='error'; $log['reason']='montant manquant'; break; }
            $old = oget($detail,'montant'); oset($detail,'montant',$v);
            $tot = 0.0; foreach ($det as $d) $tot += (float)(oget($d,'montant',0) ?: 0);
            oset($t,'valeur',$tot);
            $log['key']=$K; $log['sub_key']=oget($detail,'nom'); $log['avant']=$old; $log['apres']=$v; $log['nouveau_total']=$tot; break;
        }
        case 'update_charge_variable': {
            $C = $y ? oget($y,'chargesVariables') : null;
            if (!$C || !ohas($C,$K)) { $log['status']='skip'; $log['reason']='clé absente'; break; }
            $v   = cfo_pick_num($op, ['valeur','montant','value','amount']);
            $lbl = cfo_pick_str($op, ['label','nom']);
            $per = in_array(oget($op,'periode'), ['mois','semaine'], true) ? oget($op,'periode') : null;
            $t = oget($C,$K); $ch = []; $det = oget($t,'details');
            if ($v !== null) {
                if (is_array($det) && count($det) > 0) {
                    $cs = 0.0; foreach ($det as $d) $cs += (float)(oget($d,'montant',0) ?: 0);
                    if ($cs == 0.0) {
                        $log['status']='error'; $log['requires_redistribution']=true; $log['reason']='Sous-lignes toutes à 0'; $log['nouveau_total']=$v;
                        $log['lignes']=array_map(function($d){return ['id'=>oget($d,'id'),'nom'=>oget($d,'nom'),'montant_actuel'=>oget($d,'montant')];}, $det);
                        break;
                    }
                    $ratio = $v / $cs; $dist = 0;
                    for ($i = 0; $i < count($det) - 1; $i++) { $nm = (int)round((float)oget($det[$i],'montant') * $ratio); oset($det[$i],'montant',$nm); $dist += $nm; }
                    oset($det[count($det)-1],'montant', $v - $dist);
                    $ch['redistribution'] = ['mode'=>'proportionnelle','ratio'=>round($ratio,3),
                        'details_apres'=>array_map(function($d){return ['nom'=>oget($d,'nom'),'montant'=>oget($d,'montant')];}, $det)];
                }
                $ch['valeur'] = ['avant'=>oget($t,'valeur'),'apres'=>$v];
            }
            if ($per !== null) { $ch['periode'] = ['avant'=>oget($t,'periode'),'apres'=>$per]; oset($t,'periode',$per); }
            if ($lbl !== null) { $ch['label']   = ['avant'=>oget($t,'label'),  'apres'=>$lbl]; }
            if (!count($ch)) { $log['status']='error'; $log['reason']='aucun champ fourni'; break; }
            cfo_write_charge($t,$v,$lbl); $log['key']=$K; $log['changes']=$ch; break;
        }

        /* ── ÉPARGNE (schéma ARRAY v20.90, aligné Vue v17.99) ──────── */
        case 'set_epargne': {
            if (!$y) { $log['status']='skip'; $log['reason']='année absente'; break; }
            cfo_ep_migrate($y); $pool = oget($y,'epargne');
            if (!is_array($pool) || !count($pool)) { $log['status']='skip'; $log['reason']='aucune epargne'; break; }
            list($idx, $ep) = cfo_ep_find($pool, $K);
            if (!$ep) { $log['status']='skip'; $log['reason']='epargne introuvable: '.$K; break; }
            $v = cfo_pick_num($op, ['valeur','montant','value','amount']);
            if ($v === null) { $log['status']='error'; $log['reason']='valeur manquante'; break; }
            $old = oget($ep,'valeur'); oset($ep,'valeur',$v);
            $log['cible']=oget($ep,'nom') ?: oget($ep,'label'); $log['avant']=$old; $log['apres']=$v; break;
        }
        case 'add_epargne': {
            if (!$y) { $log['status']='skip'; $log['reason']='année absente'; break; }
            cfo_ep_migrate($y);
            if (!is_array(oget($y,'epargne'))) oset($y,'epargne',[]);
            $pool = oget($y,'epargne');
            $v = cfo_pick_num($op, ['valeur','montant','value','amount']); if ($v === null) $v = 0;
            $lbl = cfo_pick_str($op, ['label','nom']) ?: ($K ?: 'Nouvel objectif');
            $normLbl = cfo_norm_str($lbl);
            foreach ($pool as $e) {
                if (is_object($e) && cfo_norm_str(oget($e,'nom') ?: oget($e,'label','')) === $normLbl) {
                    $log['status']='skip'; $log['reason']='Objectif epargne deja existant: '.$lbl; break 2;
                }
            }
            $newId = cfo_uid();
            $newEp = cfo_obj(['id'=>$newId,'nom'=>$lbl,'label'=>$lbl,'valeur'=>$v,
                'sourceCompte'=>cfo_pick_str($op,['sourceCompte']) ?: 'courant',
                'exceptions'=>[], 'showExceptions'=>false]);
            oset($newEp, 'linkedAccountId', (oget($op,'linkedAccountId', null) !== null) ? oget($op,'linkedAccountId') : null);
            // Exceptions inline { moisDebut, moisFin, nouvelleValeur } (+ alias anglais)
            if (is_array(oget($op,'exceptions'))) {
                $exs = oget($newEp,'exceptions');
                foreach (oget($op,'exceptions') as $e) {
                    if (!$e) continue;
                    $mD = oget($e,'moisDebut', oget($e,'month_start', oget($e,'exception_start')));
                    $mF = oget($e,'moisFin',   oget($e,'month_end',   oget($e,'exception_end')));
                    $nv = oget($e,'nouvelleValeur', oget($e,'value', oget($e,'exception_value')));
                    $mD = (int)$mD; $mF = (int)$mF;
                    if ($mD >= 1 && $mD <= 12 && $mF >= $mD && $mF <= 12 && is_numeric($nv)) {
                        $exs[] = cfo_obj(['id'=>cfo_uid(),'moisDebut'=>$mD,'moisFin'=>$mF,'nouvelleValeur'=>$nv + 0]);
                        oset($newEp,'showExceptions',true);
                    }
                }
                oset($newEp,'exceptions',$exs);
            }
            $pool[] = $newEp; oset($y,'epargne',$pool);
            if (!is_object(oget($fd,'soldesInitiaux'))) oset($fd,'soldesInitiaux',onew());
            $si = oget($fd,'soldesInitiaux');
            if (!ohas($si,'ep_'.$newId)) oset($si,'ep_'.$newId, 0);
            $log['id']=$newId; $log['key']='ep_'.$newId; $log['cible']=$lbl; $log['created']=true; $log['valeur']=$v;
            if (count(oget($newEp,'exceptions'))) $log['exceptions_count']=count(oget($newEp,'exceptions'));
            break;
        }
        case 'remove_epargne': {
            if (!$y) { $log['status']='skip'; $log['reason']='année absente'; break; }
            cfo_ep_migrate($y); $pool = oget($y,'epargne');
            if (!is_array($pool)) { $log['status']='skip'; $log['reason']='aucune epargne'; break; }
            list($idx, $ep) = cfo_ep_find($pool, $K);
            if ($idx === -1) { $log['status']='skip'; $log['reason']='epargne introuvable: '.$K; break; }
            array_splice($pool, $idx, 1); oset($y,'epargne',$pool);
            $log['cible']=oget($ep,'nom') ?: oget($ep,'label'); $log['removed']=true; break;
        }
        case 'update_epargne': {
            if (!$y) { $log['status']='skip'; $log['reason']='année absente'; break; }
            cfo_ep_migrate($y); $pool = oget($y,'epargne');
            if (!is_array($pool) || !count($pool)) { $log['status']='skip'; $log['reason']='aucune epargne'; break; }
            list($idx, $ep) = cfo_ep_find($pool, $K);
            if (!$ep) { $log['status']='skip'; $log['reason']='epargne introuvable: '.$K; break; }
            $v = cfo_pick_num($op, ['valeur','montant','value','amount']);
            $lbl = cfo_pick_str($op, ['label','nom']);
            $ch = [];
            if ($v !== null)   { $ch['valeur'] = ['avant'=>oget($ep,'valeur'),'apres'=>$v]; oset($ep,'valeur',$v); }
            if ($lbl !== null) { $ch['label']  = ['avant'=>oget($ep,'nom') ?: oget($ep,'label'),'apres'=>$lbl]; oset($ep,'nom',$lbl); oset($ep,'label',$lbl); }
            if (!count($ch)) { $log['status']='error'; $log['reason']='aucun champ fourni'; break; }
            $log['cible']=oget($ep,'nom') ?: oget($ep,'label'); $log['changes']=$ch; break;
        }
        case 'add_epargne_exception': {
            if (!$y) { $log['status']='error'; $log['reason']='année absente'; break; }
            cfo_ep_migrate($y); $pool = oget($y,'epargne');
            if (!is_array($pool) || !count($pool)) { $log['status']='error'; $log['reason']='Aucune epargne dans cette annee — cree-la d abord avec action=add category=epargne'; break; }
            list($idx, $ep) = cfo_ep_find($pool, $K);
            if (!$ep) { $log['status']='error'; $log['reason']='Epargne introuvable: '.$K; break; }
            $mD = (int)oget($op,'moisDebut'); $mF = (int)oget($op,'moisFin'); $nv = oget($op,'nouvelleValeur');
            if (!($mD >= 1 && $mD <= 12))   { $log['status']='error'; $log['reason']='moisDebut invalide (1-12 requis)'; break; }
            if (!($mF >= $mD && $mF <= 12)) { $log['status']='error'; $log['reason']='moisFin invalide (>=moisDebut, <=12)'; break; }
            if (!is_numeric($nv))           { $log['status']='error'; $log['reason']='nouvelleValeur manquante ou invalide'; break; }
            if (!is_array(oget($ep,'exceptions'))) oset($ep,'exceptions',[]);
            $xid = cfo_uid(); $exs = oget($ep,'exceptions');
            $exs[] = cfo_obj(['id'=>$xid,'moisDebut'=>$mD,'moisFin'=>$mF,'nouvelleValeur'=>$nv + 0]);
            oset($ep,'exceptions',$exs); oset($ep,'showExceptions',true);
            $log['cible']=oget($ep,'nom') ?: oget($ep,'label'); $log['id']=$xid;
            $log['exception']=['moisDebut'=>$mD,'moisFin'=>$mF,'nouvelleValeur'=>$nv + 0]; break;
        }
        case 'remove_epargne_exception': {
            if (!$y) { $log['status']='error'; $log['reason']='année absente'; break; }
            cfo_ep_migrate($y); $pool = oget($y,'epargne');
            if (!is_array($pool)) { $log['status']='error'; $log['reason']='aucune epargne'; break; }
            list($idx, $ep) = cfo_ep_find($pool, $K);
            if (!$ep || !is_array(oget($ep,'exceptions'))) { $log['status']='error'; $log['reason']='epargne ou exceptions introuvable'; break; }
            $exs = oget($ep,'exceptions'); $found = -1;
            foreach ($exs as $i => $x) { if ((string)oget($x,'id') === (string)oget($op,'id')) { $found = $i; break; } }
            if ($found === -1) { $log['status']='error'; $log['reason']='exception id introuvable: '.oget($op,'id'); break; }
            array_splice($exs, $found, 1); oset($ep,'exceptions',$exs);
            if (!count($exs)) oset($ep,'showExceptions',false);
            $log['cible']=oget($ep,'nom') ?: oget($ep,'label'); $log['removed_id']=oget($op,'id'); break;
        }

        /* ── DÉPENSES PONCTUELLES ──────────────────────────────────── */
        case 'add_depense_ponctuelle': {
            if (!$y) { $log['status']='skip'; $log['reason']='année absente'; break; }
            if (!is_array(oget($y,'depensesIrregulieres'))) oset($y,'depensesIrregulieres',[]);
            $v = cfo_pick_num($op, ['montant','valeur','value','amount']);
            if ($v === null) { $log['status']='error'; $log['reason']='montant requis'; break; }
            $id = cfo_uid(); $arr = oget($y,'depensesIrregulieres');
            $arr[] = cfo_obj(['id'=>$id,'mois'=>(int)oget($op,'mois'),'annee'=>$a,
                'nom'=>cfo_pick_str($op,['nom','label']) ?: 'Dépense','montant'=>$v,'paye'=>false,'montantPaye'=>0]);
            oset($y,'depensesIrregulieres',$arr);
            $log['id']=$id; $log['nom']=oget($op,'nom'); $log['montant']=$v; break;
        }
        case 'remove_depense_ponctuelle': {
            if (!$y || !is_array(oget($y,'depensesIrregulieres'))) { $log['status']='skip'; $log['reason']='année absente'; break; }
            $arr = oget($y,'depensesIrregulieres'); $before = count($arr);
            $opId = oget($op,'id', null); $opNom = oget($op,'nom', null);
            $arr = array_values(array_filter($arr, function ($d) use ($opId, $opNom) {
                if ($opId !== null && (float)oget($d,'id') === (float)$opId) return false;
                if ($opNom !== null && cfo_lower(trim((string)oget($d,'nom'))) === cfo_lower(trim((string)$opNom))) return false;
                return true;
            }));
            oset($y,'depensesIrregulieres',$arr);
            $log['supprimees'] = $before - count($arr); break;
        }
        case 'update_depense_ponctuelle': {
            if (!$y || !is_array(oget($y,'depensesIrregulieres'))) { $log['status']='skip'; $log['reason']='année absente'; break; }
            $t = null;
            foreach (oget($y,'depensesIrregulieres') as $d) { if ((float)oget($d,'id') === (float)oget($op,'id')) { $t = $d; break; } }
            if (!$t) { $log['status']='skip'; $log['reason']='id introuvable'; break; }
            $v = cfo_pick_num($op, ['montant','valeur','value','amount']); $ch = [];
            if ($v !== null)                 { $ch['montant'] = ['avant'=>oget($t,'montant'),'apres'=>$v]; oset($t,'montant',$v); }
            if (oget($op,'mois', null) !== null) { $ch['mois'] = ['avant'=>oget($t,'mois'),'apres'=>(int)oget($op,'mois')]; oset($t,'mois',(int)oget($op,'mois')); }
            if (oget($op,'nom', null)  !== null) { $ch['nom']  = ['avant'=>oget($t,'nom'), 'apres'=>(string)oget($op,'nom')]; oset($t,'nom',(string)oget($op,'nom')); }
            cfo_purge_keys($t, CFO_SYN_NUM_DEPENSE);
            if (!count($ch)) { $log['status']='error'; $log['reason']='aucun champ fourni'; break; }
            $log['id']=oget($op,'id'); $log['changes']=$ch; break;
        }

        /* ── SOLDES INITIAUX ───────────────────────────────────────── */
        case 'set_solde_initial': {
            if (!is_object(oget($fd,'soldesInitiaux'))) oset($fd,'soldesInitiaux',onew());
            $allowed = ['courant','urgence','lt','bourse','moisActuel','anneeActuelle','semainesRestantes'];
            if (!in_array($K, $allowed, true)) { $log['status']='error'; $log['reason']='clé non autorisée. Autorisées: '.implode(', ',$allowed); break; }
            $v = cfo_pick_num($op, ['valeur','montant','value','amount']);
            if ($v === null) { $log['status']='error'; $log['reason']='valeur manquante'; break; }
            $si = oget($fd,'soldesInitiaux'); $old = oget($si,$K); oset($si,$K,$v);
            $log['key']=$K; $log['avant']=$old; $log['apres']=$v; break;
        }

        /* ── ANNÉES ────────────────────────────────────────────────── */
        case 'clone_annee': {
            $src = is_object($da) ? oget($da, (string)oget($op,'depuis')) : null;
            if (!$src) { $log['status']='skip'; $log['reason']='année source absente'; break; }
            if (ohas($da, (string)oget($op,'vers'))) { $log['status']='skip'; $log['reason']='année cible existe déjà'; break; }
            $cloned = cfo_deep_clone($src);
            cfo_reset_paye($cloned, (int)oget($op,'vers'));
            oset($da, (string)oget($op,'vers'), $cloned);
            $log['depuis']=oget($op,'depuis'); $log['vers']=oget($op,'vers'); $log['created']=true; break;
        }
        case 'delete_annee': {
            if (!ohas($da, (string)oget($op,'annee'))) { $log['status']='skip'; $log['reason']='année absente'; break; }
            odel($da, (string)oget($op,'annee'));
            $log['annee']=oget($op,'annee'); $log['removed']=true; break;
        }

        /* ── PROJET STUDIO ─────────────────────────────────────────── */
        case 'set_projet_studio': {
            if (!$y) { $log['status']='skip'; $log['reason']='année absente'; break; }
            if (!is_object(oget($y,'projetStudio'))) oset($y,'projetStudio',onew());
            $allowed = ['prixM2','surface','avance','taux','duree','taxSyndic','taxCouvertCredit','surplusCredit','assuranceMensuelle','travaux','epargneDispo'];
            if (!in_array($K, $allowed, true)) { $log['status']='error'; $log['reason']='champ non autorisé. Autorisés: '.implode(', ',$allowed); break; }
            $v = cfo_pick_num($op, ['valeur','montant','value','amount']);
            if ($v === null) { $log['status']='error'; $log['reason']='valeur manquante'; break; }
            $ps = oget($y,'projetStudio'); $old = oget($ps,$K); oset($ps,$K,$v);
            $log['key']=$K; $log['avant']=$old; $log['apres']=$v; break;
        }

        /* ── COMPTES BANCAIRES ─────────────────────────────────────── */
        case 'create_compte': {
            if (!is_array(oget($fd,'comptes'))) oset($fd,'comptes',[]);
            $comptes = oget($fd,'comptes');
            $newId = preg_replace('/[^a-z0-9]/', '_', cfo_norm_str(oget($op,'label') ?: 'compte'));
            foreach ($comptes as $c) { if (oget($c,'id') === $newId) { $log['status']='error'; $log['reason']='Compte avec cet id existe déjà: '.$newId; break 2; } }
            $comptes[] = cfo_obj(['id'=>$newId,'label'=>(string)oget($op,'label'),'solde'=>(float)(oget($op,'montant',0) ?: 0)]);
            oset($fd,'comptes',$comptes);
            $log['status']='success'; $log['action']='Creation compte'; $log['compte']=oget($op,'label'); $log['solde']=oget($op,'montant'); break;
        }
        case 'update_compte': {
            $comptes = oget($fd,'comptes');
            if (!is_array($comptes) || !count($comptes)) { $log['status']='error'; $log['reason']='Aucun compte existant'; break; }
            $normKey = cfo_norm_str($K); $c = null;
            foreach ($comptes as $x) {
                if (oget($x,'id') === $normKey) { $c = $x; break; }
                if ($normKey !== '' && strpos(cfo_norm_str(oget($x,'label')), $normKey) !== false) { $c = $x; break; }
            }
            if (!$c) { $log['status']='error'; $log['reason']='Compte introuvable: '.$K; break; }
            $oldVal = (float)(oget($c,'solde',0) ?: 0);
            oset($c,'solde', $oldVal + (float)(oget($op,'montant',0) ?: 0));
            $log['status']='success'; $log['action']='Mise a jour compte'; $log['compte']=oget($c,'label');
            $log['avant']=$oldVal; $log['apres']=oget($c,'solde'); break;
        }

        /* ── WEALTH : OBJECTIFS & ACTIFS (top-level fd.*) ──────────── */
        case 'update_objectif': {
            if (!is_array(oget($fd,'wealthGoals'))) oset($fd,'wealthGoals',[]);
            $goals = oget($fd,'wealthGoals'); $normKey = cfo_norm_str($K); $goal = null;
            foreach ($goals as $x) { if ($normKey !== '' && strpos(cfo_norm_str(oget($x,'name')), $normKey) !== false) { $goal = $x; break; } }
            if (!$goal) {
                // Upsert : objectif introuvable → création automatique
                $newGoal = cfo_obj(['name'=>(string)($K ?: 'Nouvel objectif'),'target'=>10000,'current'=>(float)(oget($op,'montant',0) ?: 0)]);
                $goals[] = $newGoal; oset($fd,'wealthGoals',$goals);
                $log['status']='success'; $log['action']='Upsert objectif (creation auto)';
                $log['cible']=oget($newGoal,'name'); $log['target']=oget($newGoal,'target'); $log['current']=oget($newGoal,'current'); break;
            }
            $oldVal = (float)(oget($goal,'current',0) ?: 0);
            oset($goal,'current', $oldVal + (float)(oget($op,'montant',0) ?: 0));
            $log['status']='success'; $log['action']='Mise a jour objectif (incremental)';
            $log['cible']=oget($goal,'name'); $log['avant']=$oldVal; $log['apres']=oget($goal,'current'); break;
        }
        case 'create_objectif': {
            if (!is_array(oget($fd,'wealthGoals'))) oset($fd,'wealthGoals',[]);
            $goals = oget($fd,'wealthGoals');
            $goalName = trim((string)(oget($op,'name') ?: 'Nouvel objectif'));
            $normNew = cfo_norm_str($goalName);
            foreach ($goals as $x) {
                if (cfo_norm_str(oget($x,'name')) === $normNew) {
                    $oldVal = (float)(oget($x,'current',0) ?: 0);
                    oset($x,'current', $oldVal + (float)(oget($op,'current',0) ?: 0));
                    $log['status']='success'; $log['action']='Objectif existant — current incremente';
                    $log['cible']=oget($x,'name'); $log['avant']=$oldVal; $log['apres']=oget($x,'current'); break 2;
                }
            }
            $tgt = (float)(oget($op,'target_amount',0) ?: 0);
            $newGoal = cfo_obj(['name'=>$goalName,'target'=>($tgt > 0 ? $tgt : 10000),'current'=>(float)(oget($op,'current',0) ?: 0)]);
            $goals[] = $newGoal; oset($fd,'wealthGoals',$goals);
            $log['status']='success'; $log['action']='Creation objectif';
            $log['cible']=oget($newGoal,'name'); $log['target']=oget($newGoal,'target'); $log['current']=oget($newGoal,'current'); break;
        }

        /* ── MASTER ASSET ENGINE v17.0 (productif + foncier unifiés) ─ */
        case 'update_master_asset':
        case 'update_actif':
        case 'update_foncier': {
            $assets = oget($fd,'masterAssets');
            if (!is_array($assets) || !count($assets)) { $log['status']='error'; $log['reason']='Aucun actif dans masterAssets'; break; }
            $normKey = cfo_norm_str($K); $asset = null;
            foreach ($assets as $x) {
                $nm = cfo_norm_str(oget($x,'name') ?: oget($x,'nom',''));
                if ($normKey !== '' && strpos($nm, $normKey) !== false) { $asset = $x; break; }
            }
            if (!$asset) { $log['status']='error'; $log['reason']='Actif introuvable dans masterAssets: '.$K; break; }
            $changes = [];
            $scenarioMap = ['conservateur'=>'value','pessimiste'=>'val_pessimiste','optimiste'=>'val_optimiste'];
            if (oget($op,'scenario')) {
                $normScen = cfo_norm_str(oget($op,'scenario'));
                if (!isset($scenarioMap[$normScen])) { $log['status']='error'; $log['reason']='Scenario invalide (conservateur|pessimiste|optimiste): '.oget($op,'scenario'); break; }
                $f = $scenarioMap[$normScen];
                $oldVal = (float)(oget($asset,$f,0) ?: 0);
                oset($asset,$f,(float)(oget($op,'montant',0) ?: 0));
                $changes[$f] = ['avant'=>$oldVal,'apres'=>oget($asset,$f)];
            } elseif (oget($op,'montant', null) !== null) {
                $oldVal = (float)(oget($asset,'value',0) ?: 0);
                oset($asset,'value',(float)(oget($op,'montant',0) ?: 0));
                $changes['value'] = ['avant'=>$oldVal,'apres'=>oget($asset,'value')];
            }
            foreach (['taux_credit','annees_total','annees_restantes','apport_personnel','montant_credit','valeur_actuelle'] as $f) {
                if (oget($op,$f, null) !== null) {
                    $old = oget($asset,$f,0);
                    oset($asset,$f,(float)(oget($op,$f,0) ?: 0));
                    $changes[$f] = ['avant'=>$old,'apres'=>oget($asset,$f)];
                }
            }
            if (!count($changes)) { $log['status']='error'; $log['reason']='Aucun champ fourni'; break; }
            $log['status']='success'; $log['action']='Update master asset'; $log['cible']=oget($asset,'name'); $log['changes']=$changes; break;
        }

        default:
            $log['status']='error'; $log['reason']='type inconnu: '.oget($op,'type');
        }
    } catch (Throwable $e) {
        $log['status']='error'; $log['reason']=$e->getMessage();
    }
    return $log;
}

function cfo_deep_clone($o) { return json_decode(json_encode($o)); }

/** Remet à zéro les marqueurs de paiement d'une année clonée. */
function cfo_reset_paye($cloned, int $anneeCible): void {
    foreach (ovals(oget($cloned,'chargesFixes', onew())) as $f) { oset($f,'paye',false); oset($f,'montantPaye',0); }
    foreach (ovals(oget($cloned,'chargesVariables', onew())) as $c) {
        if (is_array(oget($c,'details'))) foreach (oget($c,'details') as $d) { oset($d,'paye',false); oset($d,'montantPaye',0); }
    }
    foreach ((oget($cloned,'depensesIrregulieres') ?: []) as $d) {
        oset($d,'paye',false); oset($d,'montantPaye',0); oset($d,'annee',$anneeCible); oset($d,'id',cfo_uid());
    }
}

/* ══════════════════════════════════════════════════════════════════════════
   9. ORCHESTRATION — calls[] → réponse complète
      Reproduit à l'identique les 5 phases de l'ancien nœud n8n :
        1. résolution de TOUTES les entités avant la moindre mutation
        2a. auto-création des années manquantes  2b. snapshot « avant »
        3. construction + application des ops
        4. snapshot « après » + delta
        5. décision d'enregistrement du pending (pilotée par l'appelant)
   ══════════════════════════════════════════════════════════════════════════ */

function cfo_compile(array $calls, $fd, array $ctx = []): array {

    // ── Traduction catalogue → changes (guardrail bloquant hors catalogue) ──
    $catalog = cfo_catalog_names();
    $changes = [];
    $ctx = array_merge(['financeData' => $fd, 'monthlyNetFromPayload' => null], $ctx);
    $ctx['financeData'] = $fd;

    foreach ($calls as $call) {
        $fn   = oget($call, 'function', oget($call, 'name', oget($call, 'endpoint')));
        $args = oget($call, 'args', oget($call, 'arguments', oget($call, 'parameters', onew())));
        if (!$fn || !in_array($fn, $catalog, true)) {
            return [
                'status' => 'error',
                'error'  => 'ERROR_OUT_OF_CATALOG',
                'message' => "L'action demandée n'existe pas dans le catalogue. Demande à l'utilisateur de faire développer cette fonction.",
                'function_demandee' => $fn,
                'catalogue' => $catalog,
                'pending_saved' => false,
            ];
        }
        foreach (cfo_translate_call($fn, $args, $ctx) as $ch) $changes[] = $ch;
    }
    if (!count($changes)) {
        return ['status'=>'error','error'=>'Aucun change produit par le catalogue.','pending_saved'=>false];
    }

    $sanitize_pre = cfo_sanitize_finance_data($fd);

    // ── Phase 1 : résolution, AVANT toute mutation ──
    $resolved = []; $clarifications = [];
    $NEEDS_RESOLVE = ['modify','remove','rename','add_exception','remove_exception'];
    $NO_FUZZY = ['depense_ponctuelle','annee','solde','studio','compte','objectif','actif','foncier'];

    foreach ($changes as $i => $change) {
        $action = oget($change,'action'); $category = oget($change,'category');
        $target = oget($change,'target'); $rawYears = oget($change,'years');
        $years = is_array($rawYears) ? array_map('intval', $rawYears) : [(int)($rawYears ?: date('Y'))];

        $resolvedKey = null; $resolvedCat = $category;
        if (in_array($action, $NEEDS_RESOLVE, true) && $target && $category && !in_array($category, $NO_FUZZY, true)) {
            $res = cfo_resolve_entity($target, $category, $fd);
            if (empty($res['resolved'])) {
                $clarifications[] = ['change_index'=>$i,'target'=>$target,'category'=>$category,'action'=>$action,
                    'error'=>$res['error'] ?? 'non résolu', 'ambiguous'=>$res['ambiguous'] ?? false, 'choices'=>$res['choices'] ?? null];
                continue;
            }
            $resolvedKey = $res['key']; $resolvedCat = $res['category'];
        }
        $resolved[] = ['change'=>$change,'key'=>$resolvedKey,'cat'=>$resolvedCat,'years'=>$years];
    }

    // Clarification nécessaire → on rend la main SANS avoir muté quoi que ce soit
    if (count($clarifications)) {
        return ['status'=>'needs_clarification','clarifications_needed'=>$clarifications,'pending_saved'=>false,
                'hint'=>"Pose ces questions à l'utilisateur avant de relancer propose_changes."];
    }

    // ── Phase 2a : auto-création des années manquantes ──
    $allYears = [];
    foreach ($resolved as $rc) foreach ($rc['years'] as $yv) $allYears[$yv] = true;
    $allYears = array_keys($allYears); sort($allYears);

    $da = oget($fd,'donneesAnnuelles');
    if (!is_object($da)) { oset($fd,'donneesAnnuelles', onew()); $da = oget($fd,'donneesAnnuelles'); }
    $autoCloned = [];
    foreach ($allYears as $yr) {
        if (ohas($da, (string)$yr)) continue;
        $existing = array_map('intval', okeys($da)); sort($existing);
        if (!count($existing)) continue;
        $src = $existing[0];
        foreach ($existing as $e) { if (abs($e - $yr) < abs($src - $yr)) $src = $e; }
        $cloned = cfo_deep_clone(oget($da, (string)$src));
        cfo_reset_paye($cloned, (int)$yr);
        oset($da, (string)$yr, $cloned);
        $autoCloned[] = ['annee'=>$yr,'cloned_from'=>$src];
    }

    // ── Phase 2b : snapshot « avant » ──
    $snapshotBefore = [];
    foreach ($allYears as $yr) $snapshotBefore[$yr] = cfo_snapshot($fd, $yr);

    // ── Phase 3 : build + apply ──
    $allOpsLog = [];
    foreach ($resolved as $rc) {
        foreach ($rc['years'] as $annee) {
            $ops = cfo_build_ops($rc['change'], $rc['key'], $rc['cat'], $annee);
            if (!$ops || !count($ops)) {
                $allOpsLog[] = ['annee'=>$annee,
                    'op'=>cfo_obj(['type'=>'n/a','action'=>oget($rc['change'],'action'),'category'=>$rc['cat']]),
                    'log'=>['status'=>'error','reason'=>'Action "'.oget($rc['change'],'action').'" non supportée pour "'.$rc['cat'].'"']];
                continue;
            }
            foreach ($ops as $op) {
                $allOpsLog[] = ['annee'=>$annee, 'op'=>$op, 'log'=>cfo_apply_op($fd, $op, $annee)];
            }
        }
    }

    // ── Phase 4 : snapshot « après » + delta ──
    $resultsByYear = [];
    foreach ($allYears as $yr) {
        $before = $snapshotBefore[$yr]; $after = cfo_snapshot($fd, $yr);
        $resultsByYear[(string)$yr] = ['avant'=>$before,'apres'=>$after,
            'delta'=>($before && $after) ? [
                'revenus'   => $after['revenus']   - $before['revenus'],
                'fixes'     => $after['fixes']     - $before['fixes'],
                'variables' => $after['variables'] - $before['variables'],
                'epargne'   => $after['epargne']   - $before['epargne'],
            ] : null];
    }

    $sanitize_post = cfo_sanitize_finance_data($fd);

    $successOps = []; $errorOps = []; $skipOps = []; $redistribution = [];
    foreach ($allOpsLog as $o) {
        $st = $o['log']['status'] ?? null;
        if ($st === 'error') $errorOps[] = $o;
        elseif ($st === 'skip') $skipOps[] = $o;
        else $successOps[] = $o;
        if (!empty($o['log']['requires_redistribution'])) $redistribution[] = $o['log'];
    }

    $totalDirt = array_sum($sanitize_pre) + array_sum($sanitize_post);
    $hasErrors = count($errorOps) > 0;
    $hasEffective = (count($successOps) > 0 && !$hasErrors) || ($totalDirt > 0 && !$hasErrors);
    $valid = is_object(oget($fd,'donneesAnnuelles')) && is_object(oget($fd,'soldesInitiaux'));

    return [
        'status' => $hasErrors ? 'partial_error' : 'ok',
        'ops_summary' => ['total'=>count($allOpsLog),'success'=>count($successOps),'errors'=>count($errorOps),'skipped'=>count($skipOps)],
        'resultats_par_annee' => $resultsByYear,
        'error_ops' => $hasErrors ? array_map(function ($o) {
            return ['op'=>oget($o['op'],'type'),'key'=>oget($o['op'],'key'),'annee'=>$o['annee'],'reason'=>$o['log']['reason'] ?? null];
        }, $errorOps) : null,
        'redistribution_required' => count($redistribution) ? $redistribution : null,
        'auto_cloned_years' => count($autoCloned) ? $autoCloned : null,
        'sanitize_report' => ['pre'=>$sanitize_pre,'post'=>$sanitize_post,'total_purged'=>$totalDirt],
        'warning' => $hasErrors ? 'Des opérations ont échoué — pending NON sauvegardé. Vérifiez error_ops.' : null,
        // Réservé à l'appelant (pending_commit.php) — jamais renvoyé au modèle tel quel
        '_internal' => [
            'valid' => $valid,
            'has_effective' => $hasEffective,
            'annee_payload' => (count($allYears) === 1) ? $allYears[0] : $allYears,
            'operations' => array_map(function ($o) { return $o['op']; }, $allOpsLog),
            'finance_data' => $fd,
        ],
    ];
}
