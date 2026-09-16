<?php
require __DIR__ . '/../cfo_intent_engine.php';
$fixture = file_get_contents(__DIR__.'/fixture.json');
$cases = json_decode(file_get_contents(__DIR__.'/cases.json'), true);
$out = [];
foreach ($cases as $c) {
    $fd = json_decode($fixture);
    $calls = json_decode(json_encode($c['calls']));
    try { $r = cfo_compile($calls, $fd, []); }
    catch (Throwable $e) { $r = ['status'=>'throw','error'=>$e->getMessage()]; }
    $internal = $r['_internal'] ?? null; unset($r['_internal']);
    $out[$c['nom']] = ['resultat'=>$r, 'etat'=>$internal ? $internal['finance_data'] : null];
}
file_put_contents(__DIR__.'/out_php.json', json_encode($out, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
echo "PHP -> out_php.json (".count($out)." cas)\n";
