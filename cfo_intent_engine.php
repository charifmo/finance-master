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
            // v37.0 — NE PAS PURGER 'nom' ICI. C'ÉTAIT LA CAUSE RACINE.
            //   Pour les revenus et les charges, l'interface affiche `label` et
            //   `nom` n'est qu'un synonyme légitime à purger. Pour l'ÉPARGNE, le
            //   template lie `obj.nom` (index.html:2408 en desktop, 3569 en
            //   mobile) : purger cette clé effaçait, à CHAQUE commit du CFO, le
            //   libellé de toutes les lignes de virement de tous les exercices.
            //   D'où les champs « Nom de l'objectif » vides à l'écran, qu'on a
            //   longtemps pris pour une saisie utilisateur ou un défaut d'agent.
            //   Les deux clés sont synchronisées juste au-dessus : aucune n'est
            //   orpheline, et l'affichage survit désormais à l'écriture.
            $r['epargne'] += cfo_purge_keys($o, CFO_SYN_NUM_CHARGE);
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

/**
 * v35.5 — RÉSOLUTION DE L'EXERCICE CIBLE.
 *
 * Le repli historique etait `date('Y')`, c'est-a-dire l'HORLOGE DU SERVEUR.
 * Des que le modele omettait `year` — ce qu'il fait des que l'annee n'est pas
 * reecrite dans le dernier message — toute operation atterrissait sur l'annee
 * civile, quel que soit l'exercice reellement discute. C'est la fuite
 * inter-annees signalee : lecture et ecriture sur 2026 pendant que la
 * conversation portait sur 2027.
 *
 * Nouvel ordre, du plus explicite au plus faible :
 *   1. years[] / year / annee passes dans l'appel        (intention explicite)
 *   2. annee_contexte : l'exercice REELLEMENT expose au modele, transmis par
 *      le noeud n8n. C'est le seul repli qui garantit « ce que l'agent a lu
 *      est ce qu'il ecrit ».
 *   3. soldesInitiaux.anneeActuelle : l'exercice courant de l'application.
 *   4. date('Y') : dernier recours, conserve pour ne jamais echouer.
 */
function cfo_resolve_annee_defaut(array $ctx, $fd): array {
    $a = $ctx['anneeContexte'] ?? null;
    if ($a !== null && $a !== '' && (int)$a > 0) return [(int)$a, 'annee_contexte'];
    if (is_object($fd)) {
        $si = oget($fd, 'soldesInitiaux');
        if (is_object($si)) {
            $aa = oget($si, 'anneeActuelle');
            if ($aa !== null && $aa !== '' && (int)$aa > 0) return [(int)$aa, 'soldesInitiaux.anneeActuelle'];
        }
    }
    return [(int)date('Y'), 'horloge_serveur'];
}

function cfo_years($args, array $ctx = []): array {
    $ys = oget($args, 'years');
    if (is_array($ys) && count($ys)) return array_map('intval', $ys);
    $one = oget($args, 'year', oget($args, 'annee', null));
    if ($one !== null && $one !== '' && (int)$one > 0) return [(int)$one];
    if (isset($ctx['anneeDefaut']) && (int)$ctx['anneeDefaut'] > 0) return [(int)$ctx['anneeDefaut']];
    return [(int)date('Y')];
}

require_once __DIR__ . '/cfo_integrity.php';   // v37.0 : intégrité partagée moteur ↔ réparation

/* ══════════════════════════════════════════════════════════════════════════
   4bis. CONTRAT D'ARGUMENTS — SOURCE UNIQUE DE VÉRITÉ (v36.0)
   ──────────────────────────────────────────────────────────────────────────
   AVANT : chaque fonction du catalogue lisait ses arguments à la main, avec
   son propre vocabulaire et zéro tolérance. oget($a,'name') ne répondait qu'à
   « name » : un modèle qui envoyait goal_name, libelle, nom ou titre voyait sa
   valeur silencieusement ignorée, et l'opération partait avec un champ vide.
   C'est la cause structurelle du « il faut dicter à l'agent les paramètres
   exacts » — dont versement_mensuel (v35.6) n'était qu'un symptôme parmi
   d'autres : il en existait un par fonction, et rien ne les signalait.

   MAINTENANT : cette table décrit le contrat. Elle sert à TROIS choses, ce qui
   rend toute dérive impossible par construction :
     1. cfo_normalize_args()  — alias → canonique, coercition de type,
                                contrôle du requis, rapport de ce qui a bougé
     2. la génération du schéma JSON des outils n8n (tools_schema.php)
     3. les messages d'erreur, qui nomment les paramètres réellement attendus

   Les alias ne sont pas décoratifs : ils encodent ce qu'un modèle produit
   spontanément (français/anglais, singulier/pluriel, synonymes métier).
   ══════════════════════════════════════════════════════════════════════════ */

/** Paramètres acceptés par TOUTES les fonctions (ciblage temporel). */
function cfo_arg_spec_commun(): array {
    return [
        'years' => ['type'=>'int_list', 'aliases'=>['year','annee','annees','exercice','exercices','target_year','fiscal_year'],
                    'desc'=>"Exercice(s) cible(s), ex [2027]. Absent = exercice affiché par l'application."],
        'notes' => ['type'=>'string', 'aliases'=>['note','commentaire','comment','remarque'],
                    'desc'=>"Commentaire libre, jamais interprété par le moteur."],
    ];
}

function cfo_arg_spec(): array {
    // Alias récurrents, factorisés pour rester cohérents d'une fonction à l'autre.
    $A_NOM = ['nom','libelle','label','titre','name','intitule','designation'];
    $A_MONTANT = ['montant','amount','valeur','value','somme','montant_dh'];

    return [
    'create_smart_goal' => ['desc'=>"Crée un objectif d'épargne (Smart Goal). Idempotent : si le libellé existe déjà, l'objectif est mis à jour au lieu d'être dupliqué.",
        'params'=>[
        'name'              => ['type'=>'string','required'=>true,'aliases'=>array_merge($A_NOM,['goal_name','objectif','goal']),'desc'=>"Libellé de l'objectif."],
        'target_amount'     => ['type'=>'number','required'=>true,'min'=>1,'aliases'=>['target','cible','montant_cible','objectif_montant','goal_amount','montant_objectif'],'desc'=>"Montant à atteindre (DH). Strictement positif."],
        'initial_funding'   => ['type'=>'number','aliases'=>['current','initial','depart','montant_actuel','montant_initial','deja_epargne','starting_amount'],'desc'=>"Somme déjà épargnée au départ (DH). Défaut 0."],
        'versement_mensuel' => ['type'=>'number','min'=>0,'aliases'=>['monthly_contribution','monthly','versement','versement_mois','mensualite','contribution_mensuelle','epargne_mensuelle'],'desc'=>"Versement mensuel prévu (DH). Sans lui, l'application affiche « Aucun versement mensuel défini »."],
        'date_cible'        => ['type'=>'month','aliases'=>['target_date','deadline','echeance','date_objectif','date','mois_cible'],'desc'=>"Échéance visée. « AAAA-MM » de préférence ; AAAA-MM-JJ, MM/AAAA et « décembre 2027 » sont convertis."],
    ]],

    'update_smart_goal' => ['desc'=>"Modifie un objectif EXISTANT (cible, versement mensuel, libellé). N'ajoute pas de fonds : voir add_funds_to_goal.",
        'params'=>[
        'name'              => ['type'=>'string','required'=>true,'aliases'=>array_merge($A_NOM,['goal_name','objectif','goal']),'desc'=>"Objectif visé (libellé approximatif accepté)."],
        'target_amount'     => ['type'=>'number','min'=>1,'aliases'=>['target','cible','montant_cible','nouveau_cible'],'desc'=>"Nouveau montant cible (REMPLACE). Strictement positif."],
        'versement_mensuel' => ['type'=>'number','aliases'=>['monthly_contribution','monthly','versement','versement_mois','mensualite','contribution_mensuelle','epargne_mensuelle'],'desc'=>"Nouveau versement mensuel (REMPLACE, jamais cumulé)."],
        'new_name'          => ['type'=>'string','aliases'=>['nouveau_nom','rename','nouveau_libelle'],'desc'=>"Renomme l'objectif."],
        'date_cible'        => ['type'=>'month','aliases'=>['target_date','deadline','echeance','date_objectif','date','mois_cible'],'desc'=>"Échéance visée. « AAAA-MM » de préférence ; AAAA-MM-JJ, MM/AAAA et « décembre 2027 » sont convertis."],
    ]],

    'add_funds_to_goal' => ['desc'=>"Ajoute (ou retire, si négatif) des fonds à un objectif EXISTANT. INCRÉMENTAL.",
        'params'=>[
        'name'   => ['type'=>'string','required'=>true,'aliases'=>array_merge($A_NOM,['goal_name','objectif','goal']),'desc'=>"Objectif visé."],
        'amount' => ['type'=>'number','required'=>true,'aliases'=>array_merge($A_MONTANT,['funds','versement_ponctuel','ajout']),'desc'=>"Somme à ajouter (DH). Négatif pour retirer."],
        'versement_mensuel' => ['type'=>'number','aliases'=>['monthly_contribution','monthly','versement','mensualite'],'desc'=>"Fixe aussi le versement mensuel (REMPLACE)."],
    ]],

    'set_recurring_savings' => ['desc'=>"Crée ou remplace un virement d'épargne mensuel récurrent.",
        // v36.0 : sans montant NI pourcentage, l'ancien code créait une ligne
        //   d'épargne à 0 DH — une donnée incomplète que personne n'a demandée.
        'au_moins_un' => ['fixed_amount', 'percentage_of_reliquat'],
        'params'=>[
        'name'           => ['type'=>'string','required'=>true,'aliases'=>array_merge($A_NOM,['poche','objectif_epargne','savings_name']),'desc'=>"Libellé de la ligne d'épargne."],
        'fixed_amount'   => ['type'=>'number','aliases'=>array_merge($A_MONTANT,['montant_fixe','monthly_amount','mensuel']),'desc'=>"Montant mensuel fixe (DH). Exclusif avec percentage_of_reliquat."],
        'percentage_of_reliquat' => ['type'=>'number','aliases'=>['percentage','pourcentage','pct','percent','part_du_reliquat'],'desc'=>"Pourcentage du net mensuel du compte courant. Le backend calcule mois par mois : ne fournis alors AUCUN montant."],
        'source_account' => ['type'=>'string','aliases'=>['source','compte_source','account','depuis','from_account','compte'],'desc'=>"Compte débité (nom approximatif accepté, résolu côté serveur). Défaut : courant."],
        'exceptions'     => ['type'=>'raw','aliases'=>['exceptions_mensuelles','overrides'],'desc'=>"Exceptions mensuelles [{moisDebut,moisFin,nouvelleValeur}]."],
    ]],

    'update_recurring_savings' => ['desc'=>"Modifie le montant (et/ou le nom) d'un virement d'épargne EXISTANT.",
        'params'=>[
        'name'     => ['type'=>'string','required'=>true,'aliases'=>array_merge($A_NOM,['poche','savings_name']),'desc'=>"Ligne d'épargne visée."],
        'amount'   => ['type'=>'number','required'=>true,'aliases'=>array_merge($A_MONTANT,['fixed_amount','montant_fixe','nouveau_montant']),'desc'=>"Nouveau montant mensuel (REMPLACE)."],
        'new_name' => ['type'=>'string','aliases'=>['nouveau_nom','rename','nouveau_libelle'],'desc'=>"Renomme la ligne."],
    ]],

    'remove_recurring_savings' => ['desc'=>"Supprime un virement d'épargne récurrent.",
        'params'=>['name'=>['type'=>'string','required'=>true,'aliases'=>array_merge($A_NOM,['poche','savings_name']),'desc'=>"Ligne d'épargne à supprimer."]]],

    'update_asset_valuation' => ['desc'=>"Réévalue un actif du patrimoine. REMPLACE la valeur.",
        'params'=>[
        'asset_name'      => ['type'=>'string','required'=>true,'aliases'=>array_merge($A_NOM,['actif','asset','bien','propriete']),'desc'=>"Actif visé (nom approximatif accepté)."],
        'new_value'       => ['type'=>'number','required'=>true,'min'=>0,'aliases'=>array_merge($A_MONTANT,['new_valuation','nouvelle_valeur','valorisation']),'desc'=>"Nouvelle valeur (DH). Jamais négative."],
        'scenario'        => ['type'=>'string','aliases'=>['scenario_foncier','variante','hypothese'],'desc'=>"conservateur | pessimiste | optimiste (foncier uniquement)."],
        'valeur_actuelle' => ['type'=>'number','aliases'=>['current_value','valeur_marche'],'desc'=>"Valeur de marché courante, distincte du prix d'acquisition."],
    ]],

    'add_fixed_expense' => ['desc'=>"Crée une charge fixe mensuelle.",
        'params'=>[
        'name'   => ['type'=>'string','required'=>true,'aliases'=>array_merge($A_NOM,['charge','depense','expense_name']),'desc'=>"Libellé de la charge."],
        'amount' => ['type'=>'number','required'=>true,'aliases'=>$A_MONTANT,'desc'=>"Montant mensuel (DH)."],
    ]],
    'update_fixed_expense' => ['desc'=>"Modifie une charge fixe EXISTANTE. REMPLACE le montant.",
        'params'=>[
        'name'   => ['type'=>'string','required'=>true,'aliases'=>array_merge($A_NOM,['charge','depense','expense_name']),'desc'=>"Charge visée."],
        'amount' => ['type'=>'number','required'=>true,'aliases'=>$A_MONTANT,'desc'=>"Nouveau montant mensuel (DH)."],
    ]],
    'remove_fixed_expense' => ['desc'=>"Supprime une charge fixe.",
        'params'=>['name'=>['type'=>'string','required'=>true,'aliases'=>array_merge($A_NOM,['charge','depense']),'desc'=>"Charge à supprimer."]]],

    'add_variable_expense' => ['desc'=>"Crée une charge variable.",
        'params'=>[
        'name'   => ['type'=>'string','required'=>true,'aliases'=>array_merge($A_NOM,['charge','depense']),'desc'=>"Libellé."],
        'amount' => ['type'=>'number','required'=>true,'aliases'=>$A_MONTANT,'desc'=>"Montant (DH)."],
        'period' => ['type'=>'string','aliases'=>['periode','frequence','frequency','rythme'],'desc'=>"mois | semaine. Défaut : mois."],
    ]],
    'update_variable_expense' => ['desc'=>"Modifie une charge variable, ou une de ses sous-lignes via sub_target.",
        'params'=>[
        'name'       => ['type'=>'string','required'=>true,'aliases'=>array_merge($A_NOM,['charge','depense']),'desc'=>"Charge visée."],
        'amount'     => ['type'=>'number','required'=>true,'aliases'=>$A_MONTANT,'desc'=>"Nouveau montant (DH)."],
        'sub_target' => ['type'=>'string','aliases'=>['sous_ligne','detail','sous_categorie','subcategory'],'desc'=>"Sous-ligne précise à modifier."],
        'period'     => ['type'=>'string','aliases'=>['periode','frequence'],'desc'=>"mois | semaine."],
    ]],

    'add_income' => ['desc'=>"Crée un revenu mensuel.",
        'params'=>[
        'name'   => ['type'=>'string','required'=>true,'aliases'=>array_merge($A_NOM,['revenu','income_name','source']),'desc'=>"Libellé du revenu."],
        'amount' => ['type'=>'number','required'=>true,'aliases'=>array_merge($A_MONTANT,['base','salaire']),'desc'=>"Montant mensuel (DH)."],
    ]],
    'update_income' => ['desc'=>"Modifie un revenu EXISTANT. REMPLACE le montant.",
        'params'=>[
        'name'   => ['type'=>'string','required'=>true,'aliases'=>array_merge($A_NOM,['revenu','income_name']),'desc'=>"Revenu visé."],
        'amount' => ['type'=>'number','required'=>true,'aliases'=>array_merge($A_MONTANT,['base','salaire']),'desc'=>"Nouveau montant mensuel (DH)."],
    ]],

    'add_one_off_expense' => ['desc'=>"Dépense exceptionnelle datée (« choc »). Montant positif = sortie.",
        'params'=>[
        'name'   => ['type'=>'string','required'=>true,'aliases'=>array_merge($A_NOM,['depense','choc','evenement']),'desc'=>"Libellé."],
        'amount' => ['type'=>'number','required'=>true,'aliases'=>$A_MONTANT,'desc'=>"Montant (DH). Négatif = entrée d'argent."],
        'month'  => ['type'=>'number','min'=>1,'max'=>12,'aliases'=>['mois','month_number','numero_mois'],'desc'=>"Mois 1-12. Défaut : 1."],
    ]],

    'create_account' => ['desc'=>"Crée un compte bancaire.",
        'params'=>[
        'label'   => ['type'=>'string','required'=>true,'aliases'=>array_merge($A_NOM,['account_name','compte','nom_compte']),'desc'=>"Libellé du compte."],
        'balance' => ['type'=>'number','aliases'=>array_merge($A_MONTANT,['solde','solde_initial','initial_balance']),'desc'=>"Solde d'ouverture (DH). Défaut 0."],
    ]],
    'adjust_account_balance' => ['desc'=>"Crédite (+) ou débite (−) un compte. INCRÉMENTAL.",
        'params'=>[
        'account' => ['type'=>'string','required'=>true,'aliases'=>array_merge($A_NOM,['compte','account_name','nom_compte']),'desc'=>"Compte visé (nom approximatif accepté)."],
        'amount'  => ['type'=>'number','required'=>true,'aliases'=>$A_MONTANT,'desc'=>"Variation (DH). Négatif pour débiter."],
    ]],
    'set_initial_balance' => ['desc'=>"Fixe un solde initial. REMPLACE.",
        'params'=>[
        'account' => ['type'=>'string','required'=>true,'aliases'=>array_merge($A_NOM,['compte','account_name','poche']),'desc'=>"Clé de solde initial (courant, urgence, lt...)."],
        'amount'  => ['type'=>'number','required'=>true,'aliases'=>array_merge($A_MONTANT,['solde','balance']),'desc'=>"Nouveau solde (DH)."],
    ]],

    'clone_year' => ['desc'=>"Duplique un exercice budgétaire complet.",
        'params'=>[
        'from_year' => ['type'=>'number','required'=>true,'aliases'=>['source_year','depuis','annee_source','from'],'desc'=>"Exercice source."],
        'to_year'   => ['type'=>'number','required'=>true,'aliases'=>['target_year','vers','annee_cible','to'],'desc'=>"Exercice créé."],
    ]],
    ];
}
/**
 * v36.0 — COERCITION NUMÉRIQUE TOLÉRANTE.
 *   Un modèle écrit « 5 445 DH », « 5.445,50 », « 1 092 000 », « 15 % » ou
 *   " 7000 ". is_numeric() rejette tout cela, et l'ancien code retombait
 *   silencieusement sur 0 ou sur la valeur par défaut : une charge passait à
 *   zéro sans que personne ne le voie. On normalise avant de juger.
 *   Retourne null si ce n'est décidément pas un nombre — jamais 0 par défaut,
 *   pour que l'appelant distingue « absent » de « vaut zéro ».
 */
function cfo_coerce_number($v) {
    if (is_int($v) || is_float($v)) return $v + 0;
    if (is_bool($v) || $v === null) return null;
    if (is_array($v) || is_object($v)) return null;
    $s = trim((string)$v);
    if ($s === '') return null;
    $s = str_replace(["\xC2\xA0", ' ', "\t", 'DH', 'dh', 'MAD', 'mad', '%'], '', $s);
    // « 1.092.000,50 » (fr) vs « 1,092,000.50 » (en) : le DERNIER séparateur
    // rencontré est le décimal, les précédents sont des séparateurs de milliers.
    $lastComma = strrpos($s, ','); $lastDot = strrpos($s, '.');
    if ($lastComma !== false && $lastDot !== false) {
        if ($lastComma > $lastDot) { $s = str_replace('.', '', $s); $s = str_replace(',', '.', $s); }
        else                       { $s = str_replace(',', '', $s); }
    } elseif ($lastComma !== false) {
        // Une seule virgule : décimale si 1-2 chiffres derrière, sinon milliers.
        $s = (strlen($s) - $lastComma - 1) <= 2 ? str_replace(',', '.', $s) : str_replace(',', '', $s);
    }
    if (!preg_match('/^-?\d+(\.\d+)?$/', $s)) return null;
    return $s + 0;
}

/**
 * v37.5 — MOIS CIBLE TOLÉRANT → « AAAA-MM ».
 *   L'application stocke date_cible au format AAAA-MM (input type="month",
 *   index.html:2268). La v36.0 se contentait de REJETER tout ce qui n'était
 *   pas déjà à ce format — y compris « 2027-12-31 », la forme la plus
 *   naturelle pour un modèle. Le champ était alors silencieusement ignoré,
 *   l'opération échouait faute de champ modifiable, et le message d'erreur
 *   réclamait... date_cible. Le modèle reessayait, en boucle, jusqu'à épuiser
 *   ses itérations : l'agent mourait sans produire la moindre réponse.
 *   On CONVERTIT désormais, au lieu d'exiger une forme précise.
 */
function cfo_coerce_mois($v): ?string {
    if ($v === null) return null;
    if (is_array($v) || is_object($v)) return null;
    $s = trim((string)$v);
    if ($s === '') return null;

    $borne = function ($a, $m) {
        $a = (int)$a; $m = (int)$m;
        if ($a < 1900 || $a > 2200 || $m < 1 || $m > 12) return null;
        return sprintf('%04d-%02d', $a, $m);
    };
    // AAAA-MM / AAAA-MM-JJ / AAAA-MM-JJTHH:MM (ISO, avec ou sans jour)
    if (preg_match('/^(\d{4})[-\/](\d{1,2})(?:[-\/]\d{1,2})?(?:[T ].*)?$/', $s, $m)) return $borne($m[1], $m[2]);
    // JJ/MM/AAAA ou MM/AAAA
    if (preg_match('/^(?:\d{1,2}[-\/])?(\d{1,2})[-\/](\d{4})$/', $s, $m)) return $borne($m[2], $m[1]);
    // « décembre 2027 », « dec 2027 », « December 2027 »
    $mois = ['janv'=>1,'jan'=>1,'fevr'=>2,'fev'=>2,'feb'=>2,'mars'=>3,'mar'=>3,'avri'=>4,'avr'=>4,'apr'=>4,
             'mai'=>5,'may'=>5,'juin'=>6,'jun'=>6,'juil'=>7,'jul'=>7,'aout'=>8,'aug'=>8,
             'sept'=>9,'sep'=>9,'octo'=>10,'oct'=>10,'nove'=>11,'nov'=>11,'dece'=>12,'dec'=>12];
    $n = cfo_norm_str($s);
    if (preg_match('/(\d{4})/', $n, $ma)) {
        foreach ($mois as $cle => $num) {
            if (strpos($n, $cle) !== false) return $borne($ma[1], $num);
        }
        // Une année seule : « fin 2027 » se comprend comme décembre.
        if (preg_match('/^(?:fin\s+|d[eu]\s+)?\d{4}$/', $n)) return $borne($ma[1], 12);
    }
    return null;
}

/** Liste d'entiers tolérante : 2027, "2027", [2027], ["2026","2027"], "2026,2027". */
function cfo_coerce_int_list($v): ?array {
    if ($v === null || $v === '') return null;
    $items = is_array($v) ? $v : (is_string($v) ? preg_split('/[,;\s]+/', trim($v)) : [$v]);
    $out = [];
    foreach ($items as $it) {
        $n = cfo_coerce_number($it);
        if ($n !== null && (int)$n > 1900 && (int)$n < 2200) $out[] = (int)$n;
    }
    return count($out) ? array_values(array_unique($out)) : null;
}

/**
 * v36.0 — NORMALISATION DES ARGUMENTS SELON LE CONTRAT.
 *
 *   Traduit ce que le modèle a VOULU dire vers ce que le moteur attend :
 *     • alias → clé canonique      (goal_name, libelle, nom → name)
 *     • coercition de type         ("5 445 DH" → 5445 ; "2027" → [2027])
 *     • contrôle du requis         (manquant = refus explicite, pas 0 muet)
 *     • inventaire des inconnus    (jamais jetés en silence)
 *
 *   Renvoie [$argsNormalises, $rapport]. Le rapport remonte jusque dans la
 *   réponse : un paramètre redressé ou ignoré devient une information, pas un
 *   comportement invisible.
 */
function cfo_normalize_args(string $fn, $a): array {
    $spec = cfo_arg_spec()[$fn] ?? null;
    $params = array_merge($spec['params'] ?? [], cfo_arg_spec_commun());

    $out = onew();
    $rapport = ['renommes'=>[], 'convertis'=>[], 'inconnus'=>[], 'manquants'=>[], 'hors_bornes'=>[]];
    if (!is_object($a) && !is_array($a)) $a = onew();
    if (is_array($a)) { $tmp = onew(); foreach ($a as $k=>$v) oset($tmp,(string)$k,$v); $a = $tmp; }

    // Index alias → canonique (normalisé, pour tolérer casse/accents/tirets).
    $index = [];
    foreach ($params as $canon => $def) {
        $index[cfo_norm_str($canon)] = $canon;
        foreach (($def['aliases'] ?? []) as $al) {
            $k = cfo_norm_str($al);
            if (!isset($index[$k])) $index[$k] = $canon;   // le canonique gagne toujours
        }
    }

    foreach (okeys($a) as $rawKey) {
        $val = oget($a, $rawKey);
        $canon = $index[cfo_norm_str($rawKey)] ?? null;
        if ($canon === null) {
            if ($val !== null && $val !== '') $rapport['inconnus'][] = (string)$rawKey;
            continue;
        }
        if ($canon !== (string)$rawKey) $rapport['renommes'][] = $rawKey.' → '.$canon;
        // Le canonique déjà posé n'est jamais écrasé par un alias.
        if (ohas($out, $canon) && oget($out, $canon) !== null) continue;

        switch ($params[$canon]['type'] ?? 'string') {
            case 'number': {
                $n = cfo_coerce_number($val);
                if ($n === null) { if ($val !== null && $val !== '') $rapport['inconnus'][] = $rawKey.' (non numérique : '.json_encode($val).')'; break; }
                // v36.0 : une valeur hors bornes n'est PAS silencieusement corrigée.
                //   create_objectif remplaçait une cible ≤ 0 par 10 000 DH inventés,
                //   et un mois à 99 était stocké tel quel. On refuse, on ne devine pas.
                $min = $params[$canon]['min'] ?? null; $max = $params[$canon]['max'] ?? null;
                if (($min !== null && $n < $min) || ($max !== null && $n > $max)) {
                    $rapport['hors_bornes'][] = $canon.' = '.$n.' (attendu : '
                        .($min !== null ? '≥ '.$min : '').(($min !== null && $max !== null) ? ' et ' : '')
                        .($max !== null ? '≤ '.$max : '').')';
                    break;
                }
                if (!is_int($val) && !is_float($val)) $rapport['convertis'][] = $canon.' : '.json_encode($val).' → '.$n;
                oset($out, $canon, $n); break;
            }
            case 'int_list': {
                $l = cfo_coerce_int_list($val);
                if ($l === null) break;
                if (!is_array($val) || $l !== array_map('intval', (array)$val)) $rapport['convertis'][] = $canon.' : '.json_encode($val).' → '.json_encode($l);
                oset($out, $canon, $l); break;
            }
            case 'month': {
                // v37.5 : on convertit ; et si c'est vraiment illisible, on le DIT.
                //   Un champ fourni puis ignoré en silence est ce qui a fait
                //   boucler le modèle jusqu'à la mort de l'agent.
                $m = cfo_coerce_mois($val);
                if ($m === null) {
                    $rapport['hors_bornes'][] = $canon . ' = ' . json_encode($val)
                        . " (format de date non reconnu — attendu « AAAA-MM », ex. 2027-12 ;"
                        . " « 2027-12-31 », « 12/2027 » et « décembre 2027 » sont aussi acceptés)";
                    break;
                }
                if ((string)$val !== $m) $rapport['convertis'][] = $canon . ' : ' . json_encode($val) . ' → ' . $m;
                oset($out, $canon, $m); break;
            }
            case 'raw': oset($out, $canon, $val); break;
            default: {
                if (is_array($val) || is_object($val)) { $rapport['inconnus'][] = $rawKey.' (objet attendu texte)'; break; }
                $s = trim((string)$val);
                if ($s !== '') oset($out, $canon, $s);
            }
        }
    }

    foreach ($params as $canon => $def) {
        if (!empty($def['required']) && (!ohas($out, $canon) || oget($out, $canon) === null || oget($out, $canon) === '')) {
            $rapport['manquants'][] = $canon;
        }
    }
    // v36.0 : contrainte « au moins un parmi », pour les fonctions dont deux
    //   paramètres s'excluent mais dont l'absence des deux n'a aucun sens.
    $auMoinsUn = $spec['au_moins_un'] ?? null;
    if (is_array($auMoinsUn) && count($auMoinsUn)) {
        $trouve = false;
        foreach ($auMoinsUn as $k) { if (ohas($out, $k) && oget($out, $k) !== null) { $trouve = true; break; } }
        if (!$trouve) $rapport['manquants'][] = 'au moins un parmi : ' . implode(' | ', $auMoinsUn);
    }
    return [$out, $rapport];
}

function cfo_catalog_names(): array {
    return [
        'create_smart_goal','update_smart_goal','add_funds_to_goal','set_recurring_savings','update_recurring_savings',
        'remove_recurring_savings','update_asset_valuation','add_fixed_expense','update_fixed_expense',
        'remove_fixed_expense','add_variable_expense','update_variable_expense','add_income','update_income',
        'add_one_off_expense','create_account','adjust_account_balance','set_initial_balance','clone_year',
    ];
}

/** Traduit un appel du catalogue en « changes » canoniques. */
function cfo_translate_call(string $fn, $a, array $ctx): array {
    $yrs = cfo_years($a, $ctx);   // v35.5 : le contexte porte l'exercice expose au modele
    $num = function ($k, $d = 0) use ($a) { $v = oget($a, $k); return is_numeric($v) ? $v + 0 : $d; };

    // v35.6 : bug 1 — versement_mensuel n'était lu par AUCUNE des deux fonctions
    //   du cycle de vie d'un Smart Goal. Le champ existe côté appli
    //   (migrateGoalV19 : Number(o.versement_mensuel) || 0) mais rien côté moteur
    //   ne l'écrivait jamais : un objectif nouvellement créé retombait donc
    //   systématiquement à 0, avec l'alerte "Aucun versement mensuel défini".
    $versementMensuel = oget($a, 'versement_mensuel', null);
    $versementMensuel = (is_numeric($versementMensuel)) ? $versementMensuel + 0 : null;

    switch ($fn) {
        case 'create_smart_goal':
            return [cfo_obj(['action'=>'add','category'=>'objectif','target'=>oget($a,'name'),'label'=>oget($a,'name'),
                'amount'=>$num('initial_funding'),'target_amount'=>$num('target_amount'),'years'=>$yrs,'notes'=>oget($a,'notes'),
                'versement_mensuel'=>$versementMensuel,'date_cible'=>oget($a,'date_cible')])];

        // v36.0 : modifier un objectif sans y verser de fonds n'existait pas.
        //   add_funds_to_goal imposait un `amount` : pour changer une cible ou un
        //   versement mensuel, le modèle devait feindre un versement de 0.
        case 'update_smart_goal':
            return [cfo_obj(['action'=>'modify','category'=>'objectif','target'=>oget($a,'name'),
                'amount'=>null,'years'=>$yrs,'notes'=>oget($a,'notes'),
                'versement_mensuel'=>$versementMensuel,'target_amount'=>$num('target_amount', null),
                'label'=>oget($a,'new_name'),'date_cible'=>oget($a,'date_cible')])];

        case 'add_funds_to_goal':
            // v35.6 : args.amount reste incrémental (documenté "objectif EXISTANT") ;
            //   versement_mensuel, lui, est un SET, pas un ajout — un versement mensuel
            //   ne s'additionne pas à lui-même à chaque appel. amount peut être omis
            //   (défaut 0) pour un appel qui ne fait QUE changer le versement mensuel.
            return [cfo_obj(['action'=>'modify','category'=>'objectif','target'=>oget($a,'name'),
                'amount'=>$num('amount'),'years'=>$yrs,'notes'=>oget($a,'notes'),
                'versement_mensuel'=>$versementMensuel])];

        case 'set_recurring_savings': {
            $out = [];
            // v35.6 : source_account était stocké TEL QUEL, sans jamais être vérifié
            //   contre les comptes réels (fd.comptes[]) — un nom approximatif ou mal
            //   orthographié atterrissait tel quel dans sourceCompte, un champ que le
            //   frontend attend au format 'courant' / 'cpt_<id>' (voir le <select> du
            //   Studio). Résolu une seule fois, hors de la boucle années : la cible ne
            //   change pas d'une année à l'autre dans un même appel.
            $srcResolution = cfo_resolve_source_compte(oget($a, 'source_account', null), $ctx['financeData']);
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
                        'amount'=>0,'sourceCompte'=>$srcResolution['key'],'sourceCompteAvertissement'=>$srcResolution['warning'],
                        'years'=>[$yr], 'exceptions'=>$exceptions,'notes'=>oget($a,'notes')]);
                    continue;
                }
                // Mode 2 — montant fixe mensuel
                $fixed = oget($a, 'fixed_amount', null);
                $amount = is_numeric($fixed) ? $fixed + 0 : $num('amount');
                $ch = cfo_obj(['action'=>'add','category'=>'epargne','target'=>oget($a,'name'),'label'=>oget($a,'name'),
                    'amount'=>$amount,'sourceCompte'=>$srcResolution['key'],'sourceCompteAvertissement'=>$srcResolution['warning'],
                    'years'=>[$yr],'notes'=>oget($a,'notes')]);
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
            // v36.0 : masterAssets est global, mais l'exercice doit être DÉCLARÉ —
            //   il conditionne le scellé d'étanchéité et ce qui est rapporté au
            //   modèle. Sans lui, l'opération était attribuée à l'année civile.
            $ch = cfo_obj(['action'=>'modify','category'=>'actif','target'=>oget($a,'asset_name'),'amount'=>$num('new_value'),'years'=>$yrs]);
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

        // v36.0 : comptes et soldes sont globaux eux aussi — même raison qu'au-dessus.
        case 'create_account':
            return [cfo_obj(['action'=>'add','category'=>'compte','target'=>oget($a,'label'),'label'=>oget($a,'label'),'amount'=>$num('balance'),'years'=>$yrs])];
        case 'adjust_account_balance':
            return [cfo_obj(['action'=>'modify','category'=>'compte','target'=>oget($a,'account'),'amount'=>$num('amount'),'years'=>$yrs])];
        case 'set_initial_balance':
            return [cfo_obj(['action'=>'set_balance','category'=>'solde','balance_key'=>oget($a,'account','courant'),'amount'=>$num('amount'),'years'=>$yrs])];
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

/**
 * @param array|null $annees Exercices auxquels la résolution est BORNÉE (v36.0).
 *
 * v36.0 — ÉTANCHÉITÉ. Le résolveur balayait TOUTES les années de
 *   donneesAnnuelles, sans jamais savoir laquelle l'opération visait. Deux
 *   conséquences, toutes deux observées :
 *     • une ligne homonyme dans un autre exercice rendait la cible « ambiguë »
 *       et bloquait une écriture pourtant explicitement datée — avec un message
 *       absurde (« Précise : "Long Terme" ou "Long Terme" ? ») ;
 *     • la clé retenue pouvait appartenir à l'exercice voisin, puis être
 *       appliquée à l'exercice visé.
 *   La résolution est désormais bornée aux exercices de l'opération. Repli
 *   explicite (et signalé) sur les autres années uniquement si la cible n'existe
 *   nulle part dans l'exercice visé — ce qui garde le diagnostic utile
 *   (« cette ligne existe en 2026, pas en 2027 ») sans jamais écrire à l'aveugle.
 */
function cfo_resolve_entity($target, $category, $fd, ?array $annees = null): array {
    $normT = cfo_norm_str($target);
    $catKeys = ($category && isset(CFO_POOL_MAP[$category])) ? [$category] : array_keys(CFO_POOL_MAP);
    $da = oget($fd, 'donneesAnnuelles', onew());

    $toutesAnnees = array_map('strval', okeys($da));
    $cibles = ($annees !== null && count($annees))
        ? array_values(array_intersect($toutesAnnees, array_map('strval', $annees)))
        : $toutesAnnees;
    if (!count($cibles)) $cibles = $toutesAnnees;

    $res = cfo_collecter_candidats($normT, $target, $category, $catKeys, $da, $cibles, $fd);
    if (!empty($res['resolved']) || $annees === null) return $res;

    // Rien dans l'exercice visé : on regarde ailleurs, pour DIRE où ça se trouve.
    $hors = array_values(array_diff($toutesAnnees, $cibles));
    if (!count($hors)) return $res;
    $ailleurs = cfo_collecter_candidats($normT, $target, $category, $catKeys, $da, $hors, $fd);
    if (!empty($ailleurs['resolved'])) {
        return ['resolved'=>false,
            'error'=>'"'.$target.'" n\'existe pas dans l\'exercice '.implode('/', $cibles)
                     .' (trouvé dans '.implode('/', $hors).' : "'.$ailleurs['label'].'"). '
                     .'Crée la ligne dans cet exercice, ou clone l\'année, avant de la modifier.',
            'hors_exercice'=>true];
    }
    return $res;
}

/** Collecte + classement, bornés à une liste d'exercices (v36.0). */
function cfo_collecter_candidats(string $normT, $target, $category, array $catKeys, $da, array $annees, $fd): array {
    $candidates = []; $seen = [];
    foreach ($annees as $yr) {
        $y = oget($da, (string)$yr); if (!is_object($y)) continue;
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

                // v36.1 — UNE LIGNE D'ÉPARGNE SE DÉSIGNE AUSSI PAR SA DESTINATION.
                //   Le champ « Nom de l'objectif » est facultatif dans l'interface et
                //   reste vide en pratique : l'utilisateur identifie ses virements par
                //   le compte visé (« VERS : Épargne Long Terme »), pas par un libellé
                //   qu'il n'a jamais saisi. Le moteur ne résolvait QUE par nom : sur des
                //   lignes sans nom, « Épargne Long Terme » ne correspondait à rien et
                //   le résolveur répondait en clés techniques (ep_101, ep_102…),
                //   inexploitables pour le modèle comme pour l'utilisateur. On ajoute
                //   donc le libellé du compte lié — et celui du compte source — comme
                //   désignations légitimes de la ligne.
                //   Chaque désignation porte une PRIORITÉ : 0 pour un libellé
                //   réellement saisi, 1 pour une désignation déduite du compte lié.
                //   Un nom que l'utilisateur a tapé prime toujours sur un alias que
                //   le moteur infère — sans quoi deux lignes « Bourse / CTO » (l'une
                //   nommée, l'autre liée au compte du même nom) se retrouvaient
                //   ex æquo, avec un message de levée d'ambiguïté impossible à
                //   trancher : « Précise : "Bourse / CTO" ou "Bourse / CTO" ? ».
                $designations = [[$lbl, 0, null]];
                if ($cat === 'epargne') {
                    foreach (cfo_libelles_comptes_lies($item, $fd) as $alias) $designations[] = [$alias, 1, 'compte lié'];
                }

                $normK = cfo_norm_str($key);
                $dist = cfo_levenshtein($normT, $normK);
                $contains = cfo_str_contains_either($normK, $normT);
                $labelAffiche = $lbl !== '' ? $lbl : $key; $prio = 2; $via = null;
                foreach ($designations as $d) {
                    list($texte, $p, $source) = $d;
                    if ($texte === null || $texte === '') continue;
                    $nd = cfo_norm_str($texte);
                    if ($nd === '') continue;
                    $dd = cfo_levenshtein($normT, $nd);
                    $cc = cfo_str_contains_either($nd, $normT);
                    // La meilleure désignation gagne, et c'est ELLE qu'on affiche :
                    // dire « résolu → Épargne Long Terme » est utile, « → ep_103 » ne l'est pas.
                    if (($cc && !$contains) || ($cc === $contains && $dd < $dist)
                        || ($cc === $contains && $dd === $dist && $p < $prio)) {
                        $dist = $dd; $contains = $cc; $labelAffiche = $texte; $prio = $p; $via = $source;
                    }
                }
                $candidates[] = ['key'=>$key,'label'=>$labelAffiche,'category'=>$cat,
                                 'dist'=>$dist,'contains'=>$contains,'priorite'=>$prio,'via'=>$via];
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

    return cfo_rank_candidates($target, $normT, $candidates);
}

/**
 * v35.6 — CLASSEMENT PARTAGÉ, EXTRAIT DE cfo_resolve_entity.
 *   Sert désormais aussi cfo_resolve_compte() et cfo_resolve_goal() : les
 *   comptes bancaires et les Smart Goals passaient jusqu'ici par un simple
 *   "premier match qui contient la sous-chaîne demandée" (update_compte,
 *   update_objectif), SANS AUCUNE détection d'ambiguïté — contrairement aux
 *   revenus/charges/épargne qui bénéficient déjà de ce classement. Deux
 *   comptes ou deux objectifs aux noms proches ("Fonds d'urgence" /
 *   "Fonds d'urgence Voyage") pouvaient donc se faire écraser silencieusement
 *   par un match approximatif, sans jamais remonter d'alerte.
 *
 * v35.6 — AMBIGUÏTÉ ÉLARGIE : l'ancien test n'arrêtait le moteur que sur une
 *   ÉGALITÉ STRICTE de distance entre les deux meilleurs candidats. Un
 *   quasi-ex-æquo (distance 3 vs 4, par exemple deux comptes d'épargne aux
 *   libellés voisins) passait au travers et prenait silencieusement le
 *   premier de la paire. Le seuil devient une marge (±1), pas une égalité.
 */
function cfo_rank_candidates(string $target, string $normT, array $candidates): array {
    if (!count($candidates)) {
        return ['resolved'=>false, 'error'=>'"'.$target.'" introuvable. Finance data vide ou catégorie incorrecte.'];
    }

    // Tri stable : "contains" d'abord, puis distance croissante.
    // usort n'est pas stable avant PHP 8.0 : on indexe pour garantir l'ordre
    // d'origine à égalité, et rester identique au sort() JS.
    foreach ($candidates as $i => &$c) { $c['_i'] = $i; } unset($c);
    usort($candidates, function ($a, $b) {
        if ($a['contains'] !== $b['contains']) return $a['contains'] ? -1 : 1;
        if ($a['dist'] !== $b['dist']) return $a['dist'] <=> $b['dist'];
        // v36.1 : à égalité, un libellé saisi l'emporte sur une désignation déduite.
        $pa = $a['priorite'] ?? 0; $pb = $b['priorite'] ?? 0;
        if ($pa !== $pb) return $pa <=> $pb;
        return $a['_i'] <=> $b['_i'];
    });

    $best = $candidates[0];
    $second = $candidates[1] ?? null;
    $thresh = max(4, (int)floor(strlen($normT) * 0.55));

    if ($second && $second['contains'] && $best['contains'] && $best['key'] !== $second['key']
        && abs($best['dist'] - $second['dist']) <= 1 && $best['category'] === $second['category']
        // v36.1 : un libellé saisi n'est pas ambigu face à une désignation déduite.
        && ($best['priorite'] ?? 0) === ($second['priorite'] ?? 0)) {
        // v36.1 : deux choix affichés à l'identique sont indécidables pour
        //   l'utilisateur (« Précise : "X" ou "X" ? »). On dit d'où vient chacun.
        $decrire = function ($c) {
            $txt = '"' . $c['label'] . '"';
            if (!empty($c['via'])) $txt .= ' (' . $c['via'] . ')';
            return $txt . ' [' . $c['key'] . ']';
        };
        return ['resolved'=>false, 'ambiguous'=>true, 'choices'=>[$best, $second],
            'error'=>'"'.$target.'" est ambigu : '.$decrire($best).' ou '.$decrire($second).' ? Précise laquelle.'];
    }
    if (!$best['contains'] && $best['dist'] > $thresh) {
        $sugg = implode(', ', array_map(function ($c) { return '"'.$c['label'].'"'; }, array_slice($candidates, 0, 4)));
        return ['resolved'=>false, 'error'=>'"'.$target.'" ne correspond à aucune ligne connue. Lignes proches : '.$sugg];
    }
    return ['resolved'=>true, 'key'=>$best['key'], 'label'=>$best['label'], 'category'=>$best['category']];
}

/**
 * v35.6 — RÉSOLUTION DES COMPTES BANCAIRES (fd.comptes[]).
 *   update_compte/adjust_account_balance comparaient jusqu'ici la clé
 *   normalisée à oget($x,'id') via ===, une comparaison string/int qui ne
 *   peut jamais être vraie : la branche "id exact" était du code mort. Seul
 *   le "premier libellé qui contient la sous-chaîne" fonctionnait, sans
 *   garde-fou. "CTO", "Dépenses annuelles", "Fonds d'urgence" sont des
 *   libellés de comptes réels (fd.comptes[].label) : ils passent désormais
 *   par le même classement Levenshtein + ambiguïté que revenus/charges/épargne.
 *   L'alias "courant" (sans article, sans "compte") pointe vers le compte de
 *   type 'courant' quand il existe, en plus de son propre libellé réel.
 */
function cfo_resolve_compte($target, $fd): array {
    $normT = cfo_norm_str($target);
    $candidates = [];
    $comptesArr = oget($fd, 'comptes');
    if (is_array($comptesArr)) {
        foreach ($comptesArr as $c) {
            if (!is_object($c)) continue;
            $id = oget($c, 'id'); if ($id === null || $id === '') continue;
            $lbl = oget($c, 'label') ?: (oget($c, 'nom') ?: ('Compte ' . $id));
            $normL = cfo_norm_str($lbl);
            $dist = cfo_levenshtein($normT, $normL);
            $contains = cfo_str_contains_either($normL, $normT);
            if (oget($c, 'type') === 'courant') {
                $dAlias = cfo_levenshtein($normT, 'courant');
                $cAlias = cfo_str_contains_either('courant', $normT);
                if ($dAlias < $dist) { $dist = $dAlias; $contains = $contains || $cAlias; }
                elseif ($cAlias) { $contains = true; }
            }
            $candidates[] = ['key'=>'cpt_' . $id, 'label'=>$lbl, 'category'=>'compte', 'dist'=>$dist, 'contains'=>$contains];
        }
    }
    if (!count($candidates)) {
        return ['resolved'=>false, 'error'=>'"'.$target.'" introuvable parmi les comptes. Aucun compte enregistré (fd.comptes vide).'];
    }
    return cfo_rank_candidates($target, $normT, $candidates);
}

/**
 * v35.6 — RÉSOLUTION DES SMART GOALS (fd.wealthGoals[]).
 *   update_objectif prenait jusqu'ici le PREMIER objectif dont le nom
 *   contenait la sous-chaîne demandée, sans distance ni ambiguïté — et
 *   quand rien ne matchait, il créait SILENCIEUSEMENT un nouvel objectif à
 *   10 000 DH de cible (« upsert »). Deux défauts à la fois : un objectif
 *   existant proche pouvait absorber la mise à jour d'un autre, et un nom
 *   mal orthographié créait un objectif fantôme au lieu de signaler l'échec
 *   — alors qu'add_funds_to_goal documente explicitement « objectif EXISTANT ».
 *   Les Smart Goals n'ont pas d'identifiant stable côté moteur (cfo_obj ne
 *   pose pas d'id) : la clé résolue est le libellé canonique lui-même,
 *   recherché ensuite par égalité normalisée exacte — jamais par sous-chaîne.
 */
/**
 * v35.6 — RÉSOLUTION DE sourceCompte POUR UNE ÉPARGNE RÉCURRENTE.
 *   set_recurring_savings stockait oget($a,'source_account','courant') tel
 *   quel, sans jamais le vérifier contre fd.comptes[] — alors que le champ
 *   est conventionnellement 'courant' ou 'cpt_<id>' (voir le <select> "Source
 *   du Cash Requis" du Studio, index.html). Un nom de compte approximatif
 *   ("CTO" pour "Bourse / CTO") atterrissait tel quel dans les données,
 *   invisible pour tout sélecteur qui compare des clés structurées.
 *   Ne bloque JAMAIS l'opération : source_account est un champ secondaire
 *   d'un appel dont la cible principale est la ligne d'épargne elle-même.
 *   Un échec de résolution retombe sur 'courant' avec un avertissement
 *   explicite plutôt que de stocker une chaîne muette que rien ne relira.
 */
function cfo_resolve_source_compte($raw, $fd): array {
    if ($raw === null || $raw === '') return ['key' => 'courant', 'warning' => null];
    $norm = cfo_norm_str($raw);
    if ($norm === '' || $norm === 'courant' || $norm === 'compte courant') {
        return ['key' => 'courant', 'warning' => null];
    }
    $res = cfo_resolve_compte($raw, $fd);
    if (!empty($res['resolved'])) {
        return ['key' => $res['key'], 'warning' => null];
    }
    return ['key' => 'courant',
        'warning' => 'source_account "'.$raw.'" non reconnu parmi les comptes — repli sur "courant". '.($res['error'] ?? '')];
}

/**
 * v36.0 — COHÉRENCE DES DEUX SCHÉMAS D'OBJECTIF.
 *   L'application lit un Smart Goal en v19 (libelle, montant_cible,
 *   montant_actuel, versement_mensuel) avec repli sur le schéma historique
 *   (name, target, current) — voir migrateGoalV19 dans index.html. Le moteur
 *   n'écrivait QUE l'historique. Tant que l'app relit tout de suite, sa
 *   migration rattrape ; mais dès qu'un objectif déjà migré (donc porteur des
 *   clés v19) était modifié par le moteur, seules les clés legacy bougeaient
 *   et l'app continuait d'afficher les anciennes valeurs v19, prioritaires.
 *   On tient donc les deux jeux alignés à chaque écriture.
 */
/**
 * v36.0 — SCELLÉ DES EXERCICES NON CIBLÉS.
 *   L'étanchéité inter-exercices ne doit pas reposer sur la bonne conduite de
 *   chaque branche d'écriture : il y en a trop, et une seule suffit à trahir.
 *   On prend donc l'empreinte de chaque exercice que l'opération NE vise PAS,
 *   avant application, et on la revérifie après. Si l'une bouge, le lot entier
 *   est refusé et rien n'est persisté — la garantie devient vérifiable au lieu
 *   d'être seulement promise.
 */
function cfo_empreinte_annees($fd, array $annesExclues): array {
    $da = oget($fd, 'donneesAnnuelles'); $out = [];
    if (!is_object($da)) return $out;
    $exclues = array_map('strval', $annesExclues);
    foreach (okeys($da) as $yr) {
        if (in_array((string)$yr, $exclues, true)) continue;
        $out[(string)$yr] = md5((string)json_encode(oget($da, (string)$yr)));
    }
    return $out;
}

/**
 * v36.0 — RÉSOLUTION DES ACTIFS (fd.masterAssets[]).
 *   Dernière poche à dépendre encore d'un « premier nom qui contient la
 *   sous-chaîne », sans distance ni ambiguïté : deux biens aux noms voisins
 *   ("Local Bouskoura" / "Local Bouskoura 2") pouvaient se substituer l'un à
 *   l'autre en silence, et une réévaluation atterrir sur le mauvais bien —
 *   un actif se chiffrant en centaines de milliers de DH.
 *   La clé retenue est le nom canonique : masterAssets n'a pas d'identifiant
 *   fiable côté moteur (id absent sur les actifs créés hors application).
 */
function cfo_resolve_actif($target, $fd): array {
    $normT = cfo_norm_str($target);
    $candidates = [];
    $assets = oget($fd, 'masterAssets');
    if (is_array($assets)) {
        foreach ($assets as $x) {
            if (!is_object($x)) continue;
            $lbl = oget($x,'name') ?: (oget($x,'nom') ?: '');
            if ($lbl === '') continue;
            $normL = cfo_norm_str($lbl);
            $candidates[] = ['key'=>$lbl, 'label'=>$lbl, 'category'=>'actif',
                'dist'=>cfo_levenshtein($normT, $normL), 'contains'=>cfo_str_contains_either($normL, $normT)];
        }
    }
    if (!count($candidates)) {
        return ['resolved'=>false, 'error'=>'"'.$target.'" introuvable : aucun actif enregistré dans masterAssets.'];
    }
    return cfo_rank_candidates($target, $normT, $candidates);
}

/**
 * v36.1 — Désignations alternatives d'une ligne d'épargne : le libellé du
 *   compte de DESTINATION (linkedAccountId) et celui du compte SOURCE
 *   (sourceCompte, format 'cpt_<id>'). Ce sont les seuls repères dont dispose
 *   l'utilisateur quand la ligne n'a pas de nom — et c'est le cas par défaut.
 */
/**
 * v36.1 — Nom lisible d'une ligne d'épargne pour les journaux et le relevé
 *   d'opérations. Sans nom saisi, on désigne la ligne par sa destination :
 *   « → Épargne Long Terme » vaut infiniment mieux que la chaîne vide ou ep_103.
 */
function cfo_nommer_epargne($ep, $fd): string {
    $nom = trim((string)(oget($ep, 'nom') ?: oget($ep, 'label', '')));
    if ($nom !== '') return $nom;
    $alias = cfo_libelles_comptes_lies($ep, $fd);
    if (count($alias)) return '→ ' . $alias[0];
    return 'ep_' . (string)oget($ep, 'id', '?');
}

function cfo_libelles_comptes_lies($item, $fd): array {
    $comptes = oget($fd, 'comptes');
    if (!is_array($comptes)) return [];
    $index = [];
    foreach ($comptes as $c) {
        if (!is_object($c)) continue;
        $id = oget($c, 'id'); if ($id === null || $id === '') continue;
        $lb = oget($c, 'label') ?: oget($c, 'nom');
        if ($lb) $index[(string)$id] = $lb;
    }
    $out = [];
    $lien = oget($item, 'linkedAccountId', null);
    if ($lien !== null && $lien !== '' && isset($index[(string)$lien])) $out[] = $index[(string)$lien];
    $src = (string)(oget($item, 'sourceCompte', '') ?: '');
    if (strpos($src, 'cpt_') === 0) {
        $sid = substr($src, 4);
        if (isset($index[$sid])) $out[] = $index[$sid];
    }
    return $out;
}

function cfo_goal_sync_schema($g): void {
    if (!is_object($g)) return;
    $lbl = oget($g,'libelle') ?: oget($g,'name');
    if ($lbl !== null && $lbl !== '') { oset($g,'name',$lbl); oset($g,'libelle',$lbl); }
    $tgt = oget($g,'target'); if ($tgt === null) $tgt = oget($g,'montant_cible');
    if ($tgt !== null) { oset($g,'target',$tgt + 0); oset($g,'montant_cible',$tgt + 0); }
    $cur = oget($g,'current'); if ($cur === null) $cur = oget($g,'montant_actuel');
    if ($cur !== null) { oset($g,'current',$cur + 0); oset($g,'montant_actuel',$cur + 0); }
    $vm = oget($g,'versement_mensuel');
    oset($g,'versement_mensuel', ($vm === null) ? 0 : $vm + 0);
    if (oget($g,'type') === null) oset($g,'type','libre');
    if (oget($g,'date_cible') === null) oset($g,'date_cible','');
    if (!is_array(oget($g,'comptesLies'))) oset($g,'comptesLies',[]);
}

function cfo_resolve_goal($target, $fd): array {
    $normT = cfo_norm_str($target);
    $candidates = [];
    $goals = oget($fd, 'wealthGoals');
    if (is_array($goals)) {
        foreach ($goals as $g) {
            if (!is_object($g)) continue;
            $lbl = oget($g, 'libelle') ?: (oget($g, 'name') ?: 'Objectif');
            $normL = cfo_norm_str($lbl);
            $candidates[] = ['key'=>$lbl, 'label'=>$lbl, 'category'=>'objectif',
                'dist'=>cfo_levenshtein($normT, $normL), 'contains'=>cfo_str_contains_either($normL, $normT)];
        }
    }
    if (!count($candidates)) {
        return ['resolved'=>false, 'error'=>'"'.$target.'" introuvable parmi les objectifs. Aucun Smart Goal enregistré — crée-le d\'abord avec create_smart_goal.'];
    }
    return cfo_rank_candidates($target, $normT, $candidates);
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
                // v35.6 : $resolvedKey vient désormais de cfo_resolve_compte()/cfo_resolve_goal()
                //   (Levenshtein + ambiguïté) — oget($change,'target_key') n'a jamais été posé
                //   nulle part dans ce fichier, c'était un repli mort qui retombait toujours
                //   sur le $target brut, non résolu.
                case 'compte':      return [$o(['type'=>'update_compte','key'=>$resolvedKey,'montant'=>$amt])];
                case 'objectif':    return [$o(['type'=>'update_objectif','key'=>$resolvedKey,'montant'=>$amt,
                    'versement_mensuel'=>oget($change,'versement_mensuel', null),
                    'target_amount'=>oget($change,'target_amount', null),
                    'date_cible'=>oget($change,'date_cible', null),
                    'nouveau_label'=>$newLabel ?: null])];
                case 'actif':
                case 'foncier': {
                    // v36.0 : clé résolue par cfo_resolve_actif (target_key n'a jamais été posé).
                    $op = $o(['type'=>'update_master_asset','key'=>$resolvedKey ?: $target,'montant'=>$amt]);
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
                    if (oget($change,'sourceCompteAvertissement')) oset($op, 'sourceCompteAvertissement', oget($change,'sourceCompteAvertissement'));
                    if (oget($change,'linkedAccountId', null) !== null) oset($op, 'linkedAccountId', oget($change,'linkedAccountId'));
                    if (is_array(oget($change,'exceptions'))) oset($op, 'exceptions', oget($change,'exceptions'));
                    return [$op];
                }
                case 'depense_ponctuelle': return [$o(['type'=>'add_depense_ponctuelle','annee'=>$annee,'mois'=>(int)(oget($change,'month') ?: 1),'nom'=>$newLabel ?: $target,'montant'=>$amt ?? 0])];
                case 'compte':   return [$o(['type'=>'create_compte','label'=>$newLabel ?: $target,'montant'=>$amt ?? 0])];
                case 'objectif': return [$o(['type'=>'create_objectif','name'=>$newLabel ?: $target,'current'=>$amt ?? 0,
                    'target_amount'=>oget($change,'target_amount', 0),'versement_mensuel'=>oget($change,'versement_mensuel', null),
                    'date_cible'=>oget($change,'date_cible', null)])];
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
            $log['cible']=cfo_nommer_epargne($ep, $fd); $log['avant']=$old; $log['apres']=$v; break;
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
            $log['source_compte']=oget($newEp,'sourceCompte');
            if (oget($op,'sourceCompteAvertissement')) $log['source_compte_avertissement']=oget($op,'sourceCompteAvertissement');
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
            // v36.1 : une ligne sans nom doit quand même être nommable dans le
            //   relevé — sinon la phrase de confirmation dit « cible : "" ».
            $log['cible'] = cfo_nommer_epargne($ep, $fd);
            $log['changes']=$ch; break;
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
            // v35.6 : $K est désormais 'cpt_<id>', posé par cfo_resolve_compte()
            //   (Levenshtein + ambiguïté). L'ancienne comparaison oget($x,'id') === $normKey
            //   comparait un int à une chaîne normalisée via === : elle ne pouvait
            //   JAMAIS être vraie, c'était du code mort — seul le "premier libellé qui
            //   contient la sous-chaîne" fonctionnait réellement, sans détection
            //   d'ambiguïté. "CTO" / "Fonds d'urgence" / "Dépenses annuelles" sont
            //   exactement le genre de libellés de comptes visés par ce ticket.
            $comptes = oget($fd,'comptes');
            if (!is_array($comptes) || !count($comptes)) { $log['status']='error'; $log['reason']='Aucun compte existant'; break; }
            $wantId = (strpos((string)$K, 'cpt_') === 0) ? substr((string)$K, 4) : (string)$K;
            $normKey = cfo_norm_str($K); $c = null;
            foreach ($comptes as $x) {
                if ((string)oget($x,'id') === $wantId) { $c = $x; break; }
            }
            if (!$c) {
                // Repli défensif : $K brut, non résolu (appel direct hors phase 1).
                foreach ($comptes as $x) {
                    if ($normKey !== '' && strpos(cfo_norm_str(oget($x,'label')), $normKey) !== false) { $c = $x; break; }
                }
            }
            if (!$c) {
                // v35.3 : même raison qu'au-dessus — nommer les comptes existants.
                $dispo = [];
                foreach ($comptes as $x) { $n = oget($x,'label') ?: oget($x,'id'); if ($n) $dispo[] = $n; }
                $log['status']='error';
                $log['reason']='Compte introuvable: '.$K;
                $log['comptes_disponibles']=$dispo;
                break;
            }
            $oldVal = (float)(oget($c,'solde',0) ?: 0);
            oset($c,'solde', $oldVal + (float)(oget($op,'montant',0) ?: 0));
            $log['status']='success'; $log['action']='Mise a jour compte'; $log['compte']=oget($c,'label');
            $log['avant']=$oldVal; $log['apres']=oget($c,'solde'); break;
        }

        /* ── WEALTH : OBJECTIFS & ACTIFS (top-level fd.*) ──────────── */
        case 'update_objectif': {
            // v35.6 : $K est désormais le libellé EXACT résolu par cfo_resolve_goal()
            //   (Levenshtein + ambiguïté), plus une sous-chaîne brute — recherche par
            //   égalité normalisée, pas par contains. Et surtout : PLUS D'UPSERT
            //   SILENCIEUX. add_funds_to_goal documente "objectif EXISTANT" ; créer un
            //   objectif fantôme à 10 000 DH quand le nom ne matchait rien était
            //   exactement le genre de mutation invisible que ce ticket signale.
            if (!is_array(oget($fd,'wealthGoals'))) oset($fd,'wealthGoals',[]);
            $goals = oget($fd,'wealthGoals'); $normKey = cfo_norm_str($K); $goal = null;
            foreach ($goals as $x) {
                if (cfo_norm_str(oget($x,'libelle') ?: oget($x,'name')) === $normKey) { $goal = $x; break; }
            }
            if (!$goal) {
                $dispo = [];
                foreach ($goals as $x) { $n = oget($x,'libelle') ?: oget($x,'name'); if ($n) $dispo[] = $n; }
                $log['status']='error'; $log['reason']='Objectif introuvable: '.$K;
                $log['objectifs_disponibles']=$dispo; break;
            }
            $ch = [];
            $vAmount = cfo_pick_num($op, ['montant']);
            if ($vAmount !== null && $vAmount != 0) {
                $oldVal = (float)(oget($goal,'current',0) ?: 0);
                oset($goal,'current', $oldVal + $vAmount);
                $ch['current'] = ['avant'=>$oldVal,'apres'=>oget($goal,'current')];
            }
            $vVers = cfo_pick_num($op, ['versement_mensuel']);
            if ($vVers !== null) {
                $oldV = oget($goal,'versement_mensuel',0);
                oset($goal,'versement_mensuel', $vVers);
                $ch['versement_mensuel'] = ['avant'=>$oldV,'apres'=>$vVers];
            }
            // v36.0 : cible, échéance et renommage étaient injoignables en update —
            //   il fallait supprimer puis recréer l'objectif, en perdant son historique.
            $vTgt = cfo_pick_num($op, ['target_amount']);
            if ($vTgt !== null && $vTgt > 0) {
                $oldT = oget($goal,'target',0);
                oset($goal,'target', $vTgt); oset($goal,'montant_cible', $vTgt);
                $ch['target'] = ['avant'=>$oldT,'apres'=>$vTgt];
            }
            $vDate = cfo_pick_str($op, ['date_cible']);
            if ($vDate !== null && preg_match('/^\d{4}-\d{2}$/', $vDate)) {
                $ch['date_cible'] = ['avant'=>oget($goal,'date_cible',''),'apres'=>$vDate];
                oset($goal,'date_cible', $vDate);
            }
            $vLbl = cfo_pick_str($op, ['nouveau_label']);
            if ($vLbl !== null && $vLbl !== '') {
                $ch['libelle'] = ['avant'=>oget($goal,'libelle') ?: oget($goal,'name'),'apres'=>$vLbl];
                oset($goal,'name', $vLbl); oset($goal,'libelle', $vLbl);
            }
            if (!count($ch)) {
                $log['status']='error';
                $log['reason']='Aucun champ modifiable fourni. Attendus : amount (versement ponctuel), versement_mensuel, target_amount, date_cible, new_name.';
                break;
            }
            // v36.0 : cohérence des deux schémas. L'app lit montant_cible/montant_actuel
            //   (v19) avec repli sur target/current (legacy) ; le moteur n'écrivait que
            //   le legacy. On tient les deux à jour pour qu'aucune lecture ne diverge.
            cfo_goal_sync_schema($goal);
            $log['status']='success'; $log['action']='Mise a jour objectif';
            $log['cible']=oget($goal,'libelle') ?: oget($goal,'name'); $log['changes']=$ch; break;
        }
        case 'create_objectif': {
            if (!is_array(oget($fd,'wealthGoals'))) oset($fd,'wealthGoals',[]);
            $goals = oget($fd,'wealthGoals');
            $goalName = trim((string)(oget($op,'name') ?: 'Nouvel objectif'));
            $normNew = cfo_norm_str($goalName);
            $vVers = cfo_pick_num($op, ['versement_mensuel']);
            foreach ($goals as $x) {
                if (cfo_norm_str(oget($x,'libelle') ?: oget($x,'name')) === $normNew) {
                    $oldVal = (float)(oget($x,'current',0) ?: 0);
                    oset($x,'current', $oldVal + (float)(oget($op,'current',0) ?: 0));
                    if ($vVers !== null) oset($x,'versement_mensuel', $vVers);
                    $vTgtDedup = cfo_pick_num($op, ['target_amount']);
                    if ($vTgtDedup !== null && $vTgtDedup > 0) oset($x,'target', $vTgtDedup);
                    cfo_goal_sync_schema($x);
                    $log['status']='success'; $log['action']='Objectif existant — current incremente';
                    $log['cible']=oget($x,'libelle') ?: oget($x,'name'); $log['avant']=$oldVal; $log['apres']=oget($x,'current'); break 2;
                }
            }
            $tgt = (float)(oget($op,'target_amount',0) ?: 0);
            $newGoal = cfo_obj(['name'=>$goalName,'target'=>($tgt > 0 ? $tgt : 10000),'current'=>(float)(oget($op,'current',0) ?: 0)]);
            $vDate = cfo_pick_str($op, ['date_cible']);
            if ($vDate !== null && preg_match('/^\d{4}-\d{2}$/', $vDate)) oset($newGoal, 'date_cible', $vDate);
            // v35.6 : bug 1 — versement_mensuel manquait ici, seule voie d'écriture au
            //   moment de la création. L'app le lit ensuite via migrateGoalV19
            //   (Number(o.versement_mensuel) || 0) : sans cette ligne, tout objectif
            //   créé par l'agent retombait à 0, quoi que le modèle ait demandé.
            if ($vVers !== null) oset($newGoal, 'versement_mensuel', $vVers);
            cfo_goal_sync_schema($newGoal);
            $goals[] = $newGoal; oset($fd,'wealthGoals',$goals);
            $log['status']='success'; $log['action']='Creation objectif';
            $log['cible']=oget($newGoal,'name'); $log['target']=oget($newGoal,'target'); $log['current']=oget($newGoal,'current');
            if ($vVers !== null) $log['versement_mensuel']=$vVers;
            break;
        }

        /* ── MASTER ASSET ENGINE v17.0 (productif + foncier unifiés) ─ */
        case 'update_master_asset':
        case 'update_actif':
        case 'update_foncier': {
            $assets = oget($fd,'masterAssets');
            if (!is_array($assets) || !count($assets)) { $log['status']='error'; $log['reason']='Aucun actif dans masterAssets'; break; }
            // v36.0 : $K est le nom canonique retenu par cfo_resolve_actif.
            //   Égalité exacte d'abord ; le « contains » ne sert plus que de repli
            //   défensif pour un appel direct qui n'aurait pas traversé la phase 1.
            $normKey = cfo_norm_str($K); $asset = null;
            foreach ($assets as $x) {
                if (cfo_norm_str(oget($x,'name') ?: oget($x,'nom','')) === $normKey) { $asset = $x; break; }
            }
            if (!$asset) {
                foreach ($assets as $x) {
                    $nm = cfo_norm_str(oget($x,'name') ?: oget($x,'nom',''));
                    if ($normKey !== '' && strpos($nm, $normKey) !== false) { $asset = $x; break; }
                }
            }
            if (!$asset) {
                // v35.3 : une erreur qui ne nomme pas les cibles possibles est une
                //   impasse — le modèle ne peut que réessayer au hasard. On liste
                //   les actifs réels pour qu'il se corrige au tour suivant.
                $dispo = [];
                foreach ($assets as $x) { $n = oget($x,'name') ?: oget($x,'nom'); if ($n) $dispo[] = $n; }
                $log['status']='error';
                $log['reason']='Actif introuvable dans masterAssets: '.$K;
                $log['actifs_disponibles']=$dispo;
                break;
            }
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
    // v35.5 : l'exercice par defaut est resolu UNE fois, et sa provenance est
    //   renvoyee au modele. Une annee choisie par defaut n'est plus invisible.
    list($anneeDefaut, $anneeSource) = cfo_resolve_annee_defaut($ctx, $fd);
    $ctx['anneeDefaut'] = $anneeDefaut;

    // v36.0 : rapport de normalisation, agrégé sur tous les appels du lot.
    $normReport = []; $argErrors = [];
    foreach ($calls as $idx => $call) {
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
        // v36.0 : alias → canonique, coercition de type, contrôle du requis.
        //   AVANT, chaque fonction lisait ses arguments à la main : un nom de
        //   paramètre non prévu était jeté en silence et l'opération partait
        //   avec un champ vide. Désormais le contrat (cfo_arg_spec) tranche,
        //   et ce qu'il redresse ou refuse est rapporté.
        list($args, $rap) = cfo_normalize_args($fn, $args);
        if (count($rap['renommes']) || count($rap['convertis']) || count($rap['inconnus'])) {
            $normReport[] = array_filter([
                'appel' => $idx, 'fonction' => $fn,
                'renommes'  => $rap['renommes']  ?: null,
                'convertis' => $rap['convertis'] ?: null,
                'inconnus'  => $rap['inconnus']  ?: null,
            ]);
        }
        if (count($rap['manquants']) || count($rap['hors_bornes'])) {
            $attendus = [];
            foreach ((cfo_arg_spec()[$fn]['params'] ?? []) as $k => $d) {
                $attendus[] = $k . (!empty($d['required']) ? ' (requis)' : '') . ' — ' . ($d['desc'] ?? '');
            }
            $argErrors[] = array_filter([
                'appel'=>$idx, 'fonction'=>$fn,
                'parametres_manquants'=>$rap['manquants'] ?: null,
                'valeurs_hors_bornes'=>$rap['hors_bornes'] ?: null,
                'parametres_attendus'=>$attendus, 'recu'=>array_values(okeys($args))]);
            continue;
        }
        foreach (cfo_translate_call($fn, $args, $ctx) as $ch) $changes[] = $ch;
    }

    // v36.0 : un argument requis absent n'écrit RIEN. Mieux vaut un refus qui
    //   nomme le paramètre manquant qu'une ligne créée à 0 DH ou sans libellé.
    if (count($argErrors)) {
        return ['status'=>'error', 'error'=>'ERROR_ARGUMENTS_INCOMPLETS',
                'message'=>"Des paramètres requis manquent. Rien n'a été écrit. Complète-les et relance.",
                'arguments_invalides'=>$argErrors,
                'arguments_normalises'=>$normReport ?: null,
                'pending_saved'=>false];
    }
    if (!count($changes)) {
        return ['status'=>'error','error'=>'Aucun change produit par le catalogue.','pending_saved'=>false];
    }

    $sanitize_pre = cfo_sanitize_finance_data($fd);

    // ── Phase 1 : résolution, AVANT toute mutation ──
    $resolved = []; $clarifications = [];
    $NEEDS_RESOLVE = ['modify','remove','rename','add_exception','remove_exception'];
    // v35.6 : 'compte' et 'objectif' sortent de NO_FUZZY — ils passent désormais
    //   par cfo_resolve_compte()/cfo_resolve_goal(), avec le même classement et
    //   la même détection d'ambiguïté que revenus/charges/épargne, au lieu du
    //   "premier libellé qui contient la sous-chaîne" sans aucun garde-fou.
    // v36.0 : 'actif' et 'foncier' rejoignent les poches résolues. Il ne reste
    //   dans NO_FUZZY que ce qui n'est PAS une entité nommée : une date, une clé
    //   de solde, un champ du simulateur studio, une dépense ponctuelle datée.
    $NO_FUZZY = ['depense_ponctuelle','annee','solde','studio'];
    // Catégories qui ont leur propre résolveur dédié (pas de pool par année).
    $RESOLVER_DEDIE = ['compte' => 'cfo_resolve_compte', 'objectif' => 'cfo_resolve_goal',
                       'actif' => 'cfo_resolve_actif', 'foncier' => 'cfo_resolve_actif'];

    foreach ($changes as $i => $change) {
        $action = oget($change,'action'); $category = oget($change,'category');
        $target = oget($change,'target'); $rawYears = oget($change,'years');
        // v36.0 : dernier repli d'exercice. Il tapait encore date('Y') en direct,
        //   court-circuitant toute la résolution de la v35.5 : un change sans
        //   `years` atterrissait sur l'année civile même quand le contexte disait
        //   2027. On passe par l'exercice résolu — une seule décision, un seul
        //   endroit.
        $years = is_array($rawYears) ? array_map('intval', $rawYears) : [(int)($rawYears ?: $anneeDefaut)];

        $resolvedKey = null; $resolvedCat = $category; $resolvedLabel = null;
        if (in_array($action, $NEEDS_RESOLVE, true) && $target && $category && !in_array($category, $NO_FUZZY, true)) {
            // v36.0 : la résolution est bornée aux exercices de l'opération.
            $res = isset($RESOLVER_DEDIE[$category])
                ? call_user_func($RESOLVER_DEDIE[$category], $target, $fd)
                : cfo_resolve_entity($target, $category, $fd, $years);
            if (empty($res['resolved'])) {
                $clarifications[] = ['change_index'=>$i,'target'=>$target,'category'=>$category,'action'=>$action,
                    'error'=>$res['error'] ?? 'non résolu', 'ambiguous'=>$res['ambiguous'] ?? false, 'choices'=>$res['choices'] ?? null];
                continue;
            }
            $resolvedKey = $res['key']; $resolvedCat = $res['category']; $resolvedLabel = $res['label'] ?? null;
        }
        $resolved[] = ['change'=>$change,'key'=>$resolvedKey,'cat'=>$resolvedCat,'years'=>$years,
            // v35.6 : ce que le modèle a demandé vs. ce qui a été résolu — porté
            //   jusque dans le log de chaque op (succès compris), pour qu'une
            //   éventuelle mauvaise résolution soit visible IMMÉDIATEMENT dans
            //   la réponse au lieu de n'être découverte qu'en rouvrant l'appli.
            'target_demande'=>$target, 'resolved_label'=>$resolvedLabel];
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

    // v36.0 : empreinte AVANT mutation des exercices hors périmètre.
    //   Posée après sanitize_pre et l'auto-clonage, qui ont le droit de toucher
    //   l'état ; seules les écritures métier sont surveillées ici.
    $scelleAvant = cfo_empreinte_annees($fd, $allYears);

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
                $log = cfo_apply_op($fd, $op, $annee);
                // v35.6 : la cible demandée et son libellé résolu voyagent jusqu'au
                //   log — y compris en cas de succès — pour rendre une mauvaise
                //   résolution visible dès cette réponse.
                if ($rc['target_demande'] !== null) $log['cible_demandee'] = $rc['target_demande'];
                if ($rc['resolved_label'] !== null) $log['resolved_label'] = $rc['resolved_label'];
                $allOpsLog[] = ['annee'=>$annee, 'op'=>$op, 'log'=>$log];
            }
        }
    }

    // v37.0 : INTÉGRITÉ À L'ÉCRITURE. Bornée aux exercices ciblés — les autres
    //   sont sous scellé et ne doivent pas bouger, même pour être « réparés ».
    //   Les collections globales (comptes, objectifs, actifs) ne sont pas
    //   scellées : elles sont incluses. Un libellé vide n'atteint donc plus le
    //   disque, il est auto-nommé selon son contexte et la correction est dite.
    $integrite = cfo_integrite_passe($fd, array_map('strval', $allYears), true);

    // v36.0 : vérification du scellé. Un exercice hors périmètre qui a bougé
    //   est une corruption silencieuse : on refuse le lot entier plutôt que de
    //   persister un état dont une partie n'a été demandée par personne.
    $scelleApres = cfo_empreinte_annees($fd, $allYears);
    $violations = [];
    foreach ($scelleAvant as $yr => $h) {
        if (!isset($scelleApres[$yr])) { $violations[] = ['exercice'=>(int)$yr,'anomalie'=>'exercice supprimé']; continue; }
        if ($scelleApres[$yr] !== $h) $violations[] = ['exercice'=>(int)$yr,'anomalie'=>'contenu modifié'];
    }
    foreach ($scelleApres as $yr => $h) {
        if (!isset($scelleAvant[$yr])) $violations[] = ['exercice'=>(int)$yr,'anomalie'=>'exercice créé hors périmètre'];
    }
    if (count($violations)) {
        return ['status'=>'error', 'error'=>'ERROR_ETANCHEITE_EXERCICE',
                'message'=>"Des exercices NON ciblés ont été modifiés. Le lot est refusé, rien n'a été enregistré.",
                'exercices_cibles'=>array_map('intval', $allYears),
                'violations'=>$violations,
                'pending_saved'=>false];
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
    // v35.6 : trace de résolution demandé→résolu, succès compris (voir cfo_rank_candidates).
    $resolutions = []; $operations = [];
    foreach ($allOpsLog as $o) {
        $st = $o['log']['status'] ?? null;
        if ($st === 'error') $errorOps[] = $o;
        elseif ($st === 'skip') $skipOps[] = $o;
        else $successOps[] = $o;
        if (!empty($o['log']['requires_redistribution'])) $redistribution[] = $o['log'];
        if (isset($o['log']['cible_demandee'])) {
            $resolutions[] = ['annee'=>$o['annee'], 'demande'=>$o['log']['cible_demandee'],
                'resolu'=>$o['log']['resolved_label'] ?? null, 'status'=>$st];
        }
        // v36.0 : relevé littéral de ce qui a été écrit, produit par le SERVEUR.
        //   Un lot de deux appels individuellement valides mais dont le modèle a
        //   interverti les montants est indétectable côté moteur : les deux sont
        //   cohérents pris isolément. Ce qui EST corrigeable, c'est que la phrase
        //   de confirmation lue à l'utilisateur vienne de la mémoire du modèle.
        //   Elle vient désormais d'ici — cible réellement touchée, avant, après —
        //   donc une interversion se voit AVANT le OUI, pas après.
        if ($st !== 'error') {
            $l = $o['log'];
            $avant = $l['avant'] ?? null; $apres = $l['apres'] ?? null;
            if ($avant === null && isset($l['changes']) && is_array($l['changes'])) {
                foreach ($l['changes'] as $champ => $d) {
                    if (is_array($d) && array_key_exists('avant', $d)) { $avant = $d['avant']; $apres = $d['apres']; break; }
                }
            }
            $operations[] = array_filter([
                'annee'   => $o['annee'],
                'action'  => $l['action'] ?? oget($o['op'], 'type'),
                'cible'   => $l['cible'] ?? $l['compte'] ?? $l['key'] ?? oget($o['op'], 'key'),
                'avant'   => $avant,
                'apres'   => $apres === null ? ($l['valeur'] ?? null) : $apres,
                'statut'  => $st ?: 'success',
            ], function ($v) { return $v !== null; });
        }
    }

    $totalDirt = array_sum($sanitize_pre) + array_sum($sanitize_post);
    $hasErrors = count($errorOps) > 0;
    $hasEffective = (count($successOps) > 0 && !$hasErrors) || ($totalDirt > 0 && !$hasErrors);
    $valid = is_object(oget($fd,'donneesAnnuelles')) && is_object(oget($fd,'soldesInitiaux'));

    return [
        'status' => $hasErrors ? 'partial_error' : 'ok',
        // v35.5 : rendre l'annee visible. Le modele doit pouvoir dire a
        //   l'utilisateur SUR QUEL EXERCICE il vient d'ecrire, et se corriger
        //   si le defaut ne correspond pas a la conversation.
        'arguments_normalises' => $normReport ?: null,
        // v37.0 : corrections d'intégrité appliquées à l'écriture (libellé vide
        //   auto-nommé, montant retypé, compte lié fantôme délié...). Rien ne se
        //   répare en silence.
        'integrite_corrections' => count($integrite) ? $integrite : null,
        'annee_defaut_utilisee' => $anneeDefaut,
        'annee_defaut_source'   => $anneeSource,
        'exercices_touches'     => array_map('intval', array_keys($resultsByYear)),
        'ops_summary' => ['total'=>count($allOpsLog),'success'=>count($successOps),'errors'=>count($errorOps),'skipped'=>count($skipOps)],
        'resultats_par_annee' => $resultsByYear,
        // v35.3 : la projection ne se limite plus à 4 clés fixes. Les branches qui
        //   échouent sur un nom introuvable joignent la liste des noms réellement
        //   présents (*_disponibles) ; sans ce report, l'agent reçoit « introuvable »
        //   sans savoir quoi proposer, et redemande le même nom en boucle.
        'error_ops' => $hasErrors ? array_map(function ($o) {
            $e = ['op'=>oget($o['op'],'type'),'key'=>oget($o['op'],'key'),'annee'=>$o['annee'],'reason'=>$o['log']['reason'] ?? null];
            foreach ($o['log'] as $k => $v) {
                if (substr($k, -12) === '_disponibles') $e[$k] = $v;
            }
            return $e;
        }, $errorOps) : null,
        // v35.6 : ce que chaque cible approximative a résolu, succès compris — permet au
        //   modèle de vérifier IMMÉDIATEMENT "j'ai visé X, le serveur a bien touché X"
        //   avant d'annoncer un résultat à l'utilisateur, au lieu de le découvrir après coup.
        'resolutions' => count($resolutions) ? $resolutions : null,
        // v36.0 : à lire à l'utilisateur AVANT de demander confirmation. C'est le
        //   relevé du serveur, pas le souvenir du modèle.
        'operations_appliquees' => count($operations) ? $operations : null,
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
