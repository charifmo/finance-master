<?php
/**
 * Santé Master — LES CALCULS DÉTERMINISTES (miroir exact de sante_calculs.js).
 *
 *   Le modèle (Médecin-Chef IA) ne calcule rien de tête : ratios lipidiques, HOMA-IR, TyG, SCORE2,
 *   métabolisme de base, bilan énergétique, projection de poids, score de séquençage d'un repas et
 *   règle « syndrome de Gilbert » sont calculés ici, et les mêmes formules tournent dans l'appli.
 *   La parité PHP ↔ JS est vérifiée par test_sante_parite.mjs.
 *
 *   Unités de stockage : celles des comptes rendus marocains — lipides et glycémie en g/L,
 *   bilirubine en mg/L. Les conversions vers mmol/L ou mg/dL sont faites ici, jamais par le modèle.
 *
 *   Ces calculs sont des aides au suivi, pas un diagnostic.
 */

const SANTE_KCAL_PAR_KG = 7700;   // énergie d'un kilo de masse grasse (approximation usuelle)

function sante_catalogue(): array {
    static $c = null;
    if ($c === null) $c = json_decode((string)file_get_contents(__DIR__ . '/biomarqueurs.json'), true) ?: ['marqueurs' => []];
    return $c;
}
function sante_aliments(): array {
    static $a = null;
    if ($a === null) $a = (json_decode((string)file_get_contents(__DIR__ . '/aliments.json'), true) ?: ['aliments' => []])['aliments'];
    return $a;
}
function sante_num($v): ?float {
    if ($v === null || $v === '' || is_bool($v)) return null;
    if (is_string($v)) $v = str_replace([',', ' ', "\u{202f}", "\u{a0}"], ['.', '', '', ''], $v);
    return is_numeric($v) ? (float)$v : null;
}
function sante_arrondi(?float $v, int $d = 2): ?float { return $v === null ? null : round($v, $d); }

/** Âge révolu à une date (AAAA-MM-JJ). */
function sante_age(?string $naissance, ?string $date = null): ?int {
    if (!$naissance || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $naissance, $n)) return null;
    $date = $date ?: date('Y-m-d');
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $date, $d)) return null;
    $age = (int)$d[1] - (int)$n[1];
    if ((int)$d[2] < (int)$n[2] || ((int)$d[2] === (int)$n[2] && (int)$d[3] < (int)$n[3])) $age--;
    return $age;
}

/** Valeur d'un biomarqueur dans un bilan : { v, u, min, max } ou nombre nu. */
function sante_val(array $bilan, string $cle): ?float {
    $x = $bilan['valeurs'][$cle] ?? null;
    if (is_array($x)) return sante_num($x['v'] ?? null);
    return sante_num($x);
}
/** Bornes : celles du compte rendu si présentes, sinon celles du catalogue. */
function sante_bornes(array $bilan, string $cle): array {
    $x = $bilan['valeurs'][$cle] ?? null; $m = sante_catalogue()['marqueurs'][$cle] ?? [];
    $min = is_array($x) && array_key_exists('min', $x) && $x['min'] !== null ? sante_num($x['min']) : sante_num($m['min'] ?? null);
    $max = is_array($x) && array_key_exists('max', $x) && $x['max'] !== null ? sante_num($x['max']) : sante_num($m['max'] ?? null);
    return [$min, $max];
}
/** bas | haut | normal | inconnu */
function sante_statut(array $bilan, string $cle): string {
    $v = sante_val($bilan, $cle); if ($v === null) return 'inconnu';
    [$min, $max] = sante_bornes($bilan, $cle);
    if ($min !== null && $v < $min) return 'bas';
    if ($max !== null && $v > $max) return 'haut';
    return 'normal';
}

/* ── Ratios et index ─────────────────────────────────────────────────────── */
function sante_ratio_tg_hdl(?float $tg, ?float $hdl): ?float { return ($tg === null || !$hdl) ? null : sante_arrondi($tg / $hdl, 2); }        // g/L ÷ g/L
function sante_non_hdl(?float $ct, ?float $hdl): ?float { return ($ct === null || $hdl === null) ? null : sante_arrondi($ct - $hdl, 2); }     // g/L
/** HOMA-IR = glycémie (mmol/L) × insuline (µUI/mL) / 22,5 ; glycémie stockée en g/L (× 5,551). */
function sante_homa_ir(?float $glyGL, ?float $insuline): ?float { return ($glyGL === null || $insuline === null) ? null : sante_arrondi($glyGL * 5.551 * $insuline / 22.5, 2); }
/** TyG = ln( TG (mg/dL) × glycémie (mg/dL) / 2 ) ; g/L × 100 = mg/dL. */
function sante_tyg(?float $tgGL, ?float $glyGL): ?float { return ($tgGL === null || $glyGL === null || $tgGL <= 0 || $glyGL <= 0) ? null : sante_arrondi(log($tgGL * 100 * $glyGL * 100 / 2), 2); }

/**
 * SCORE2 (ESC 2021) — risque à 10 ans d'événement cardiovasculaire, HOMME 40-69 ans.
 *   Coefficients et survie de base (0,9605) de la publication ; recalibrage par région.
 *   Vérifié sur l'exemple publié (50 ans, fumeur, PAS 140, CT 5,5, HDL 1,3) : 5,9 % (faible) → 14 % (très haut).
 *   Cholestérol total et HDL stockés en g/L (× 2,586 → mmol/L).
 */
function sante_score2(?int $age, string $sexe, bool $fumeur, ?float $pas, ?float $ctGL, ?float $hdlGL, string $region = 'moderate'): array {
    $manque = [];
    if ($age === null) $manque[] = 'âge';
    if ($pas === null) $manque[] = 'pression artérielle systolique';
    if ($ctGL === null) $manque[] = 'cholestérol total';
    if ($hdlGL === null) $manque[] = 'HDL';
    if ($manque) return ['risque' => null, 'raison' => 'à compléter : ' . implode(', ', $manque)];
    if ($sexe !== 'H') return ['risque' => null, 'raison' => 'formule femme non intégrée'];
    if ($age < 40 || $age > 69) return ['risque' => null, 'raison' => 'SCORE2 couvre 40 à 69 ans'];
    $echelles = ['low' => [-0.5699, 0.7476], 'moderate' => [-0.1565, 0.8009], 'high' => [0.3207, 0.9360], 'very_high' => [0.5836, 0.8294]];
    [$s1, $s2] = $echelles[$region] ?? $echelles['moderate'];
    $ca = ($age - 60) / 5; $cs = ($pas - 120) / 20; $ct = $ctGL * 2.586 - 6; $ch = ($hdlGL * 2.586 - 1.3) / 0.5; $f = $fumeur ? 1 : 0;
    $x = 0.3742 * $ca + 0.6012 * $f + 0.2777 * $cs + 0.1458 * $ct - 0.2698 * $ch
       - 0.0755 * $ca * $f - 0.0255 * $ca * $cs - 0.0281 * $ca * $ct + 0.0426 * $ca * $ch;
    $r = 1 - pow(0.9605, exp($x));
    $cal = 1 - exp(-exp($s1 + $s2 * log(-log(1 - $r))));
    $pct = round($cal * 100, 1);
    // Seuils ESC 2021 selon l'âge (< 50 ans : 2,5 / 7,5 ; 50-69 ans : 5 / 10)
    [$a, $b] = $age < 50 ? [2.5, 7.5] : [5, 10];
    $niveau = $pct < $a ? 'faible à modéré' : ($pct < $b ? 'élevé' : 'très élevé');
    return ['risque' => $pct, 'niveau' => $niveau, 'region' => $region];
}

/* ── Règle « syndrome de Gilbert » ─────────────────────────────────────── */
/**
 * Bilirubine (totale ou libre) au-dessus de la norme, MAIS ASAT, ALAT, GGT normales et bilirubine conjuguée
 * non élevée → profil compatible Gilbert (bénin) : badge informatif, pas d'alerte rouge.
 *   gilbert | alerte | normal | incomplet
 */
function sante_gilbert(array $bilan): array {
    $bt = sante_statut($bilan, 'bili_t'); $bl = sante_val($bilan, 'bili_l');
    $hausse = $bt === 'haut' || ($bt === 'inconnu' && $bl !== null && $bl > 10);
    if (!$hausse) return ['statut' => $bt === 'inconnu' ? 'incomplet' : 'normal'];
    $hep = ['asat' => sante_statut($bilan, 'asat'), 'alat' => sante_statut($bilan, 'alat'), 'ggt' => sante_statut($bilan, 'ggt')];
    $bc = sante_statut($bilan, 'bili_c');
    $hautes = array_keys(array_filter($hep, fn($s) => $s === 'haut'));
    if ($hautes || $bc === 'haut')
        return ['statut' => 'alerte', 'message' => 'Bilirubine élevée avec ' . implode(', ', array_merge(array_map('strtoupper', $hautes), $bc === 'haut' ? ['bilirubine conjuguée'] : [])) . ' au-dessus de la norme : à discuter avec le médecin.'];
    if (in_array('inconnu', $hep, true)) return ['statut' => 'incomplet', 'message' => 'Bilirubine élevée : ASAT, ALAT et GGT nécessaires pour conclure.'];
    return ['statut' => 'gilbert', 'message' => '🧬 Profil Gilbert (antioxydant bénin) : bilirubine libre élevée, transaminases et GGT normales.'];
}

/* ── Énergie ─────────────────────────────────────────────────────────── */
/** Métabolisme de base, Mifflin-St Jeor (kcal/j). */
function sante_bmr(?float $kg, ?float $cm, ?int $age, string $sexe = 'H'): ?int {
    if ($kg === null || $cm === null || $age === null) return null;
    return (int)round(10 * $kg + 6.25 * $cm - 5 * $age + ($sexe === 'F' ? -161 : 5));
}
/** Bilan du jour : ingéré − (BMR + actives). Négatif = déficit. */
function sante_bilan_energie(?float $ingere, ?int $bmr, ?float $actives): array {
    if ($ingere === null || $bmr === null) return ['depense' => null, 'net' => null];
    $dep = (int)round($bmr + ($actives ?? 0));
    return ['depense' => $dep, 'net' => (int)round($ingere - $dep)];
}
/**
 * Projection vers le poids cible : pente des pesées des `$jours` derniers jours (moindres carrés) ; à défaut,
 * déficit moyen (kcal/j) ÷ 7 700 kcal/kg. Renvoie la date estimée et la vitesse (kg/semaine).
 */
function sante_projection_poids(array $pesees, ?float $cible, ?float $deficitMoyen = null, ?string $aujourdhui = null, int $jours = 28): array {
    $aujourdhui = $aujourdhui ?: date('Y-m-d');
    $p = array_values(array_filter($pesees, fn($x) => isset($x['date'], $x['kg']) && sante_num($x['kg']) !== null));
    usort($p, fn($a, $b) => strcmp($a['date'], $b['date']));
    if (!$p || $cible === null) return ['date' => null, 'kg_semaine' => null, 'raison' => 'pesée ou objectif manquant'];
    $dernier = $p[count($p) - 1]; $actuel = (float)$dernier['kg'];
    if ($actuel <= $cible) return ['date' => $dernier['date'], 'kg_semaine' => null, 'atteint' => true];
    $t0 = strtotime($aujourdhui . ' 00:00:00 UTC') - $jours * 86400;
    $rec = array_values(array_filter($p, fn($x) => strtotime($x['date'] . ' 00:00:00 UTC') >= $t0));
    $pente = null;   // kg par jour
    if (count($rec) >= 2) {
        $xs = array_map(fn($x) => strtotime($x['date'] . ' 00:00:00 UTC') / 86400, $rec); $ys = array_map(fn($x) => (float)$x['kg'], $rec);
        $n = count($xs); $mx = array_sum($xs) / $n; $my = array_sum($ys) / $n; $num = 0; $den = 0;
        for ($i = 0; $i < $n; $i++) { $num += ($xs[$i] - $mx) * ($ys[$i] - $my); $den += ($xs[$i] - $mx) ** 2; }
        if ($den > 0) $pente = $num / $den;
    }
    $source = 'pesées';
    if (($pente === null || $pente >= 0) && $deficitMoyen !== null && $deficitMoyen < 0) { $pente = $deficitMoyen / SANTE_KCAL_PAR_KG; $source = 'déficit moyen'; }
    if ($pente === null || $pente >= 0) return ['date' => null, 'kg_semaine' => $pente === null ? null : round($pente * 7, 2), 'raison' => 'pas de baisse mesurée'];
    $jrs = (int)ceil(($actuel - $cible) / -$pente);
    return ['date' => gmdate('Y-m-d', strtotime($dernier['date'] . ' 00:00:00 UTC') + $jrs * 86400), 'kg_semaine' => round($pente * 7, 2), 'source' => $source, 'jours' => $jrs];
}

/* ── Repas : valeurs et score de séquençage ─────────────────────────────── */
function sante_aliment(string $nom): ?array {
    $n = sante_norm($nom); $A = sante_aliments();
    foreach ($A as $k => $a) if (sante_norm($k) === $n) return ['nom' => $k] + $a;
    foreach ($A as $k => $a) foreach ($a['alias'] ?? [] as $al) if (sante_norm($al) === $n) return ['nom' => $k] + $a;
    return null;
}
function sante_norm(string $s): string {
    $s = mb_strtolower(trim($s), 'UTF-8');
    $s = strtr($s, ['é'=>'e','è'=>'e','ê'=>'e','ë'=>'e','à'=>'a','â'=>'a','î'=>'i','ï'=>'i','ô'=>'o','û'=>'u','ù'=>'u','ç'=>'c','œ'=>'oe','’'=>"'"]);
    return trim(preg_replace('/[^a-z0-9%]+/', ' ', $s));
}
/** Un élément de repas { nom, g } (+ valeurs fournies si l'aliment est inconnu) → valeurs calculées. */
function sante_item(array $it): array {
    $g = sante_num($it['g'] ?? null) ?? 100; $a = sante_aliment((string)($it['nom'] ?? ''));
    if ($a) {
        $f = $g / 100;
        return ['nom' => $a['nom'], 'g' => $g, 'categorie' => $a['categorie'], 'raffine' => (bool)$a['raffine'], 'connu' => true,
                'kcal' => round($a['kcal'] * $f), 'prot' => round($a['prot'] * $f, 1), 'glu' => round($a['glu'] * $f, 1), 'lip' => round($a['lip'] * $f, 1), 'fib' => round($a['fib'] * $f, 1)];
    }
    return ['nom' => (string)($it['nom'] ?? '?'), 'g' => $g, 'categorie' => (string)($it['categorie'] ?? 'mixte'), 'raffine' => !empty($it['raffine']), 'connu' => false,
            'kcal' => round(sante_num($it['kcal'] ?? null) ?? 0), 'prot' => round(sante_num($it['prot'] ?? null) ?? 0, 1), 'glu' => round(sante_num($it['glu'] ?? null) ?? 0, 1),
            'lip' => round(sante_num($it['lip'] ?? null) ?? 0, 1), 'fib' => round(sante_num($it['fib'] ?? null) ?? 0, 1)];
}
/**
 * Score de séquençage glycémique (0-100) d'un repas, dans l'ORDRE de consommation des éléments :
 *   base 50 ; fibres en premier +20 ; toutes les protéines avant le premier glucide +15 ;
 *   glucide en premier −20 ; marche après le repas +15 ; chaque élément raffiné −10 (au plus −30).
 */
function sante_score_sequencage(array $items, bool $marche): array {
    $cats = array_map(fn($i) => $i['categorie'], $items); $det = [];
    $s = 50;
    $premier = $cats[0] ?? null;
    if ($premier === 'fibres') { $s += 20; $det[] = '+20 fibres en entrée'; }
    if ($premier === 'glucides') { $s -= 20; $det[] = '−20 glucides en premier'; }
    $iG = array_search('glucides', $cats, true); $iPs = array_keys($cats, 'proteines', true);
    if ($iPs && ($iG === false || max($iPs) < $iG)) { $s += 15; $det[] = '+15 protéines avant les glucides'; }
    if ($marche) { $s += 15; $det[] = '+15 marche après le repas'; }
    $raf = count(array_filter($items, fn($i) => !empty($i['raffine'])));
    if ($raf) { $m = min(30, 10 * $raf); $s -= $m; $det[] = '−' . $m . ' raffiné (' . $raf . ')'; }
    return ['score' => max(0, min(100, $s)), 'detail' => $det];
}
function sante_totaux_repas(array $items): array {
    $t = ['kcal' => 0, 'prot' => 0, 'glu' => 0, 'lip' => 0, 'fib' => 0];
    foreach ($items as $i) foreach ($t as $k => $_) $t[$k] += (float)($i[$k] ?? 0);
    return ['kcal' => (int)round($t['kcal']), 'prot' => round($t['prot'], 1), 'glu' => round($t['glu'], 1), 'lip' => round($t['lip'], 1), 'fib' => round($t['fib'], 1)];
}

/* ── Indicateurs d'un bilan (ce que l'appli affiche, ce que le CMO lit) ─────── */
function sante_indicateurs(array $bilan, array $profil = []): array {
    $v = fn($k) => sante_val($bilan, $k);
    $age = sante_age($profil['naissance'] ?? null, $bilan['date'] ?? null);
    return [
        'ratio_tg_hdl' => sante_ratio_tg_hdl($v('tg'), $v('hdl')),
        'non_hdl'      => sante_non_hdl($v('ct'), $v('hdl')),
        'homa_ir'      => sante_homa_ir($v('glycemie'), $v('insuline')),
        'tyg'          => sante_tyg($v('tg'), $v('glycemie')),
        'score2'       => sante_score2($age, (string)($profil['sexe'] ?? 'H'), !empty($profil['fumeur']), sante_num($bilan['pas_systolique'] ?? ($profil['pas_systolique'] ?? null)), $v('ct'), $v('hdl'), (string)($profil['region_score2'] ?? 'moderate')),
        'gilbert'      => sante_gilbert($bilan),
    ];
}
