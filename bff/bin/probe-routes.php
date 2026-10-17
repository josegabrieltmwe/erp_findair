<?php
/**
 * Sondeo de solo lectura de las rutas GET del manifiesto, con una sesión del BFF ya iniciada.
 *
 * Uso: php bin/probe-routes.php <valor de la cookie __Host-sid> [https://erp-findair.php8] [salida.json]
 * Omite rutas con efectos (reservas, cancelaciones, etiquetas, emails, exportaciones, streams...).
 * Resume los códigos HTTP; los 4xx/5xx se listan con su código de error.
 */
require __DIR__ . '/../vendor/autoload.php';
$m = Findair\Bff\Proxy\RouteManifest::fromFile(__DIR__ . '/../config/routes.bff.yaml');
$skip = '/book|cancel|label|email|send|export|download|generate|print|reset|delete|remove|sync|import|recharge|reserve|trigger|stream|token|logout|webhook|heartbeat|^set_|^ajax_|execute|^run_|reconcil|assign|dunning|ewb|klm|webcargo|proforma_crud|notification|scheduler|ups_|mfa|credential|key/i';
$cookie = $argv[1] ?? '';
$base = rtrim($argv[2] ?? 'https://erp-findair.php8', '/');
$outFile = $argv[3] ?? 'probe.json';
if ($cookie === '') {
    fwrite(STDERR, "Falta la cookie de sesión.\n");
    exit(2);
}
$out = []; $n = 0;
foreach ($m->all() as $r) {
    if ($r->method !== 'GET' || str_contains($r->path, '{') || $r->response !== 'json' || preg_match($skip, $r->action)) continue;
    $ch = curl_init($base . '/bff/v1' . $r->path . '?per_page=1&page=1');
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_COOKIE => "__Host-sid=$cookie", CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0]);
    $body = curl_exec($ch); $st = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch); $n++;
    $j = json_decode((string) $body, true); $code = is_array($j) ? ($j['error_code'] ?? $j['code'] ?? '') : '';
    $out[$st][] = $r->action . ($st >= 400 && $code ? "($code)" : '');
}
ksort($out); echo "sondeadas: $n\n";
foreach ($out as $st => $l) { printf("%d: %d\n", $st, count($l)); if ($st >= 400) echo '   ', implode(' ', array_slice($l, 0, 60)), "\n"; }
file_put_contents($outFile, json_encode($out));
