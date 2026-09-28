<?php
declare(strict_types=1);
/* ============================================================================
 *  cfo_rag_ids.php — v37.10
 *  Identifiants des vecteurs RAG : reconnaître, et refuser le reste.
 *
 *  POURQUOI CE FICHIER EXISTE. Le verrou de suppression n'acceptait qu'un
 *  ENTIER. Or le nœud PGVector de LangChain crée finance_vectors avec
 *  « id uuid PRIMARY KEY DEFAULT gen_random_uuid() » : chaque règle porte un
 *  UUID. Le bouton « Oublier » répondait donc invariablement ID_INVALIDE et la
 *  règle restait en base. Reproduit sur un PostgreSQL 16 à clés UUID.
 *
 *  La logique est ici, hors de l'endpoint, pour être rejouable sans base de
 *  données — un test qui exige un PostgreSQL ne tourne jamais.
 * ========================================================================== */

/**
 * Reconnaît la forme d'un identifiant. Liste blanche stricte : rien d'autre
 * qu'un entier strictement positif ou un UUID canonique ne passe.
 *
 * @return array{ok:bool, forme:string, valeur:int|string|null, message:string}
 */
function cfo_valider_id_vecteur($brut): array {
    $estEntier = is_int($brut) || (is_string($brut) && ctype_digit($brut));
    if ($estEntier) {
        $n = (int)$brut;
        if ($n <= 0) {
            return ['ok'=>false, 'forme'=>'entier', 'valeur'=>null,
                    'message'=>'Un identifiant entier doit être positif.'];
        }
        return ['ok'=>true, 'forme'=>'entier', 'valeur'=>$n, 'message'=>''];
    }
    if (is_string($brut)
        && preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $brut) === 1) {
        return ['ok'=>true, 'forme'=>'uuid', 'valeur'=>strtolower($brut), 'message'=>''];
    }
    return ['ok'=>false, 'forme'=>'inconnue', 'valeur'=>null,
            'message'=>'Identifiant attendu : un entier ou un UUID. Reçu : ' . json_encode($brut)];
}

/**
 * Confronte la forme reçue au type RÉEL de la colonne. PostgreSQL ne compare
 * pas un uuid à un texte tout seul : mieux vaut un refus lisible qu'une erreur
 * SQL brute. Renvoie null si tout concorde, sinon le message à afficher.
 */
function cfo_id_incompatible(string $typeColonne, string $forme): ?string {
    $colonneUuid = ($typeColonne === 'uuid');
    if ($colonneUuid && $forme !== 'uuid') {
        return "La colonne « id » de finance_vectors est de type uuid ; l'identifiant reçu est un entier.";
    }
    if (!$colonneUuid && $forme === 'uuid') {
        return "La colonne « id » de finance_vectors est de type {$typeColonne} ; l'identifiant reçu est un UUID.";
    }
    return null;
}

/** La comparaison SQL à employer — transtypage explicite pour une colonne uuid. */
function cfo_clause_id(string $typeColonne): string {
    return ($typeColonne === 'uuid') ? 'id = :id::uuid' : 'id = :id';
}
