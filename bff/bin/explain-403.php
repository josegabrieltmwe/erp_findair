<?php
/**
 * Explica los 403 de probe-routes.php: módulo, permiso authx o política que exige cada controller.
 *
 * Uso: php bin/explain-403.php <raiz tmwe_json> [probe.json]
 */
require __DIR__ . '/../vendor/autoload.php';
use Symfony\Component\Yaml\Yaml;
$root = rtrim($argv[1] ?? '', '/');
$probe = json_decode((string) @file_get_contents($argv[2] ?? 'probe.json'), true);
if ($root === '' || !is_array($probe)) {
    fwrite(STDERR, "Uso: php bin/explain-403.php <raiz tmwe_json> [probe.json]\n");
    exit(2);
}
$forb = array_unique(array_map(fn($a) => preg_replace('/\(.*/', '', $a), $probe[403] ?? []));
$ctl = [];
foreach (glob("$root/config/routes/*.yml") as $f) foreach ((array) Yaml::parseFile($f) as $items) foreach ((array) $items as $it)
  if (is_array($it) && isset($it['response_on'], $it['controller'])) $ctl[$it['response_on']] = $it['controller'];
$path = fn(string $c) => "$root/" . str_replace('\\', '/', preg_replace('/^tmwe_json\\\\/', '', $c)) . '.php';
function chain(string $class, callable $path, int $d = 0): string {
  $f = $path($class); if (!is_file($f) || $d > 5) return '';
  $s = file_get_contents($f); $out = $s;
  if (preg_match('/extends\s+\\\\?([A-Za-z_\\\\]+)/', $s, $m)) { $p = $m[1]; if ($p[0] !== '\\' && !str_contains($p, 'tmwe_json')) { preg_match('/^namespace\s+([^;]+);/m', $s, $ns); $p = ($ns[1] ?? '') . '\\' . $p; } $out .= "\n" . chain(ltrim($p, '\\'), $path, $d + 1); }
  return $out;
}
$groups = [];
foreach ($forb as $a) {
  $src = isset($ctl[$a]) ? chain($ctl[$a], $path) : '';
  $key = '?';
  if (preg_match("/function get_module_name\(\)[^{]*\{\s*return\s*'([a-z_]+)'/s", $src, $m)) $key = 'módulo:' . $m[1];
  elseif (preg_match_all('/authx_\d+/', $src, $x) && $x[0]) $key = 'authx:' . implode(',', array_unique($x[0]));
  elseif (preg_match("/get_authz_policy[^{]*\{.*?'(admin_only|[a-z_]+)'/s", $src, $m)) $key = 'policy:' . $m[1];
  elseif (preg_match('/is_admin|admin_only|requires_admin/i', $src)) $key = 'admin';
  $groups[$key][] = $a;
}
ksort($groups);
foreach ($groups as $k => $acts) { printf("%-34s %2d  %s\n", $k, count($acts), implode(' ', array_slice($acts, 0, 9)) . (count($acts) > 9 ? ' …' : '')); }
