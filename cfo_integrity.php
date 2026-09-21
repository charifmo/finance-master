<?php
/**
 * ============================================================================
 *  cfo_integrity.php — intégrité des données financières (v37.0)
 * ----------------------------------------------------------------------------
 *  UNE SEULE DÉFINITION DE « DONNÉE SAINE », DEUX POINTS D'APPEL :
 *    • le moteur, à chaque écriture  (cfo_intent_engine.php)
 *    • le balayage global            (repair_finance_data.php)
 *  Tant que la règle vivait en deux endroits, elle divergeait. Ici elle est
 *  écrite une fois ; le moteur la joue sur les exercices qu'il touche, le
 *  script de réparation sur toute la base.
 *
 *  CE QUE CETTE COUCHE GARANTIT, COLLECTION PAR COLLECTION
 *    1. Aucun libellé vide      → auto-nommage CONTEXTUEL (jamais « Sans nom » :
 *                                 un virement prend le nom de son compte cible)
 *    2. Types numériques réels  → "4 000 DH" ou null deviennent 4000 ou 0
 *    3. Signes cohérents        → un virement d'épargne ou une charge ne peut
 *                                 pas être négatif ; une dépense ponctuelle SI
 *                                 (montant négatif = injection, cf. v34.13)
 *    4. Comptes liés existants  → un linkedAccountId fantôme est délié, un
 *                                 sourceCompte fantôme retombe sur « courant »
 *    5. Champs structurels      → id, exceptions[], comptesLies[], type…
 *
 *  Chaque correction est RAPPORTÉE. Rien ne se répare en silence : c'est ce qui
 *  a permis de découvrir que les libellés vides venaient de l'interface, pas
 *  de l'agent.
 * ============================================================================
 */

/** Index des comptes réels : id → libellé. Sert aux vérifications de liens. */
function cfo_index_comptes($fd): array {
    $idx = [];
    foreach ((oget($fd, 'comptes') ?: []) as $c) {
        if (!is_object($c)) continue;
        $id = oget($c, 'id');
        if ($id === null || $id === '') continue;
        $idx[(string)$id] = oget($c, 'label') ?: (oget($c, 'nom') ?: ('Compte ' . $id));
    }
    return $idx;
}

/**
 * Auto-nommage CONTEXTUEL. Le ticket demande « un libellé descriptif logique » :
 * un virement est donc nommé d'après le compte qu'il alimente, une dépense
 * d'après son mois, un objectif d'après sa cible. « Sans nom » ne renseigne
 * personne et réintroduirait le problème sous un autre nom.
 */
function cfo_auto_nom(string $poche, $item, $fd, $annee = null): string {
    $comptes = cfo_index_comptes($fd);
    $n = function ($v) { $x = cfo_coerce_number($v); return $x === null ? 0 : $x; };

    switch ($poche) {
        case 'epargne': {
            $lien = oget($item, 'linkedAccountId', null);
            if ($lien !== null && $lien !== '' && isset($comptes[(string)$lien])) return 'Virement vers ' . $comptes[(string)$lien];
            $src = (string)(oget($item, 'sourceCompte', '') ?: '');
            if (strpos($src, 'cpt_') === 0 && isset($comptes[substr($src, 4)])) return 'Virement depuis ' . $comptes[substr($src, 4)];
            $v = $n(oget($item, 'valeur'));
            return $v > 0 ? ('Épargne ' . rtrim(rtrim(number_format($v, 2, ',', ' '), '0'), ',') . ' DH/mois') : 'Épargne mensuelle';
        }
        case 'revenu':    return 'Revenu ' . ($n(oget($item, 'base')) ?: $n(oget($item, 'valeur'))) . ' DH';
        case 'charge_fixe':     return 'Charge fixe ' . $n(oget($item, 'valeur')) . ' DH';
        case 'charge_variable': return 'Charge variable ' . $n(oget($item, 'valeur')) . ' DH';
        case 'depense_ponctuelle': {
            $m = (int)$n(oget($item, 'mois'));
            $mn = ['', 'Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
            $lbl = ($m >= 1 && $m <= 12) ? $mn[$m] : '';
            $mt = $n(oget($item, 'montant'));
            $sens = $mt < 0 ? 'Entrée' : 'Dépense';
            // Le mois peut être invalide au moment du nommage (il est corrigé plus
            // bas) : on assemble les morceaux non vides plutôt que de concaténer
            // à l'aveugle, sinon le libellé sort avec des espaces doubles.
            $morceaux = array_filter([$sens, $lbl, $annee ? (string)$annee : '']);
            return implode(' ', $morceaux) ?: 'Flux exceptionnel';
        }
        case 'objectif': {
            $c = $n(oget($item, 'montant_cible', oget($item, 'target')));
            return $c > 0 ? ('Objectif ' . number_format($c, 0, ',', ' ') . ' DH') : 'Objectif d\'épargne';
        }
        case 'compte':  return 'Compte ' . (oget($item, 'id') ?: '');
        case 'actif':   {
            $v = $n(oget($item, 'valeur_actuelle', oget($item, 'value')));
            return $v > 0 ? ('Actif ' . number_format($v, 0, ',', ' ') . ' DH') : 'Actif patrimonial';
        }
    }
    return 'Élément sans nom';
}

/** Nombre sûr : null/""/texte → $defaut, avec plancher optionnel. */
function cfo_num_sain($v, float $defaut = 0.0, ?float $min = null): float {
    $x = cfo_coerce_number($v);
    if ($x === null) $x = $defaut;
    $x = (float)$x;
    if ($min !== null && $x < $min) $x = $min;
    return $x;
}

/**
 * Normalise UNE collection et renvoie la liste des corrections appliquées.
 * $appliquer=false → simulation : on rapporte sans muter.
 */
function cfo_integrite_collection(string $poche, $conteneur, $fd, $annee, bool $appliquer): array {
    $corr = [];
    $comptes = cfo_index_comptes($fd);
    $ajout = function ($ou, $quoi, $avant, $apres) use (&$corr) {
        $corr[] = ['ou' => $ou, 'quoi' => $quoi, 'avant' => $avant, 'apres' => $apres];
    };

    // Pool sous forme de liste d'items [clé d'affichage => objet]
    $items = [];
    if (is_array($conteneur))      { foreach ($conteneur as $i => $it) if (is_object($it)) $items[(string)$i] = $it; }
    elseif (is_object($conteneur)) { foreach (okeys($conteneur) as $k) { $it = oget($conteneur, $k); if (is_object($it)) $items[(string)$k] = $it; } }
    if (!count($items)) return $corr;

    foreach ($items as $cle => $it) {
        $ou = ($annee !== null ? $annee . '.' : '') . $poche . '[' . $cle . ']';

        /* ── 1. Libellé ─────────────────────────────────────────────── */
        $champsNom = ($poche === 'objectif') ? ['libelle', 'name'] : (($poche === 'compte') ? ['label'] : (($poche === 'actif') ? ['name'] : ['nom', 'label']));
        $nomActuel = '';
        foreach ($champsNom as $cn) { $v = trim((string)(oget($it, $cn, '') ?? '')); if ($v !== '') { $nomActuel = $v; break; } }
        if ($nomActuel === '') {
            $auto = cfo_auto_nom($poche, $it, $fd, $annee);
            $ajout($ou, 'libellé vide', '', $auto);
            if ($appliquer) foreach ($champsNom as $cn) oset($it, $cn, $auto);
        } else {
            // Alignement des doublons de libellé (nom ↔ label, libelle ↔ name)
            foreach ($champsNom as $cn) {
                if (ohas($it, $cn) && trim((string)(oget($it, $cn, '') ?? '')) !== $nomActuel) {
                    $ajout($ou, 'libellé désaligné (' . $cn . ')', oget($it, $cn), $nomActuel);
                    if ($appliquer) oset($it, $cn, $nomActuel);
                }
            }
        }

        /* ── 2. Montants : typage réel et signe cohérent ────────────── */
        //  Une dépense ponctuelle PEUT être négative : c'est une injection
        //  (remboursement, déblocage de crédit) — établi en v34.13.
        $regles = [
            'epargne'            => [['valeur', 0.0, 0.0]],
            'revenu'             => [['base', 0.0, 0.0]],
            'charge_fixe'        => [['valeur', 0.0, 0.0]],
            'charge_variable'    => [['valeur', 0.0, 0.0]],
            'depense_ponctuelle' => [['montant', 0.0, null], ['montantPaye', 0.0, null]],
            'objectif'           => [['montant_cible', 0.0, 0.0], ['montant_actuel', 0.0, 0.0], ['versement_mensuel', 0.0, 0.0]],
            'compte'             => [['solde', 0.0, null]],
            'actif'              => [['value', 0.0, 0.0], ['valeur_actuelle', 0.0, 0.0]],
        ];
        foreach (($regles[$poche] ?? []) as $r) {
            list($champ, $defaut, $min) = $r;
            if (!ohas($it, $champ)) continue;
            $brut = oget($it, $champ);
            $sain = cfo_num_sain($brut, $defaut, $min);
            if (!is_int($brut) && !is_float($brut)) {
                $ajout($ou, $champ . ' non numérique', $brut, $sain);
                if ($appliquer) oset($it, $champ, $sain);
            } elseif ((float)$brut !== $sain) {
                $ajout($ou, $champ . ' hors bornes', $brut, $sain);
                if ($appliquer) oset($it, $champ, $sain);
            }
        }

        /* ── 3. Comptes liés : ils doivent EXISTER ──────────────────── */
        if (ohas($it, 'linkedAccountId')) {
            $lien = oget($it, 'linkedAccountId');
            if ($lien !== null && $lien !== '' && !isset($comptes[(string)$lien])) {
                $ajout($ou, 'compte lié inexistant', $lien, null);
                if ($appliquer) oset($it, 'linkedAccountId', null);
            }
        }
        if (ohas($it, 'sourceCompte')) {
            $src = (string)(oget($it, 'sourceCompte', '') ?? '');
            $valide = ($src === 'courant') || ($src === '')
                   || (strpos($src, 'cpt_') === 0 && isset($comptes[substr($src, 4)]))
                   || (strpos($src, 'ep_') === 0);
            if (!$valide) {
                $ajout($ou, 'compte source inexistant', $src, 'courant');
                if ($appliquer) oset($it, 'sourceCompte', 'courant');
            } elseif ($src === '') {
                $ajout($ou, 'compte source vide', '', 'courant');
                if ($appliquer) oset($it, 'sourceCompte', 'courant');
            }
        }

        /* ── 4. Champs structurels ──────────────────────────────────── */
        if (in_array($poche, ['epargne', 'depense_ponctuelle'], true)) {
            if (oget($it, 'id', null) === null || oget($it, 'id') === '') {
                $nid = cfo_uid();
                $ajout($ou, 'identifiant manquant', null, $nid);
                if ($appliquer) oset($it, 'id', $nid);
            }
        }
        if ($poche === 'epargne' && !is_array(oget($it, 'exceptions'))) {
            $ajout($ou, 'exceptions non tableau', oget($it, 'exceptions'), []);
            if ($appliquer) oset($it, 'exceptions', []);
        }
        if ($poche === 'depense_ponctuelle') {
            $m = (int)cfo_num_sain(oget($it, 'mois'), 1.0);
            if ($m < 1 || $m > 12) {
                $ajout($ou, 'mois hors 1-12', oget($it, 'mois'), 1);
                if ($appliquer) oset($it, 'mois', 1);
            }
            if ($annee !== null && (string)oget($it, 'annee') !== (string)$annee) {
                $ajout($ou, 'exercice incohérent', oget($it, 'annee'), (int)$annee);
                if ($appliquer) oset($it, 'annee', (int)$annee);
            }
        }
        if ($poche === 'objectif' && $appliquer) cfo_goal_sync_schema($it);
    }
    return $corr;
}

/** Les collections d'un exercice, dans l'ordre où elles sont présentées. */
function cfo_poches_annuelles(): array {
    return ['revenus'=>'revenu', 'chargesFixes'=>'charge_fixe', 'chargesVariables'=>'charge_variable',
            'epargne'=>'epargne', 'depensesIrregulieres'=>'depense_ponctuelle'];
}

/**
 * Passe d'intégrité. $annees = null → TOUS les exercices (balayage global) ;
 * sinon, seuls ceux listés (le moteur, qui ne doit jamais toucher aux autres).
 */
function cfo_integrite_passe($fd, ?array $annees, bool $appliquer): array {
    $corr = [];
    // Collections globales
    foreach ([['comptes','compte'], ['wealthGoals','objectif'], ['masterAssets','actif']] as $g) {
        $corr = array_merge($corr, cfo_integrite_collection($g[1], oget($fd, $g[0]), $fd, null, $appliquer));
    }
    // Collections par exercice
    $da = oget($fd, 'donneesAnnuelles');
    if (is_object($da)) {
        foreach (okeys($da) as $yr) {
            if ($annees !== null && !in_array((string)$yr, array_map('strval', $annees), true)) continue;
            $y = oget($da, (string)$yr); if (!is_object($y)) continue;
            foreach (cfo_poches_annuelles() as $champ => $poche) {
                $corr = array_merge($corr, cfo_integrite_collection($poche, oget($y, $champ), $fd, (string)$yr, $appliquer));
            }
        }
    }
    return $corr;
}
