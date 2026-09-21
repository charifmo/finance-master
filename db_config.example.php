<?php
// ============================================================================
// Finance Master v16.3 — Configuration Postgres
// ----------------------------------------------------------------------------
// 1. Copier ce fichier en `db_config.php` (gitignored, jamais commité)
// 2. Renseigner les credentials de la base `charif_finance_db`
//    (mêmes credentials que ceux utilisés par le credential n8n
//     "charif_finance_db", id 7cQfM9fXdo0Pso5h)
// 3. Vérifier sur le VPS : `php -m | grep pgsql` doit afficher pdo_pgsql
//    Si absent : `apt install php-pgsql && systemctl reload php-fpm`
// 4. La table `finance_state` se crée automatiquement au premier appel
// ============================================================================

return [
    'host'     => 'localhost',          // Hôte Postgres (souvent 127.0.0.1 ou domaine interne)
    'port'     => '5432',               // Port standard
    'dbname'   => 'charif_finance_db',  // Nom de la base
    'user'     => 'CHANGE_ME',          // Utilisateur Postgres
    'password' => 'CHANGE_ME',          // Mot de passe — NE JAMAIS COMMITER

    // v37.0 — Jeton FACULTATIF pour get_ai_memory.php (Supervision IA).
    //   Cet endpoint expose les règles mémorisées ET l'historique des
    //   conversations. Sans jeton il répond quand même, mais signale son
    //   ouverture. Décommentez pour exiger ?token=... (ou X-Auth-Token) :
    // 'ai_memory_token' => 'remplacez-par-une-chaine-longue-et-aleatoire',
];
