#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Genera config/routes.spa.yaml a partir de las llamadas http("/<ruta>") de los módulos de la SPA.
 *
 * Uso: php bin/gen-spa-manifest.php <raiz tmwe_json> <origen>[,<origen>...] [<raiz frontend>]
 *
 * <raiz frontend> es el workspace que se escanea (por defecto <raiz tmwe_json>/frontend; en este
 * repo, ../web, que ya usa rutas /bff/v1/<ruta>).
 *
 * Cada origen es un módulo de operations (`cargo`) o una carpeta relativa a `frontend/`
 * (`packages/platform/presence`). Solo se exponen las rutas que usan los orígenes indicados.
 *
 * Solo entran las rutas cuyo controlador está en los tiers `api` o `web` (aceptan Bearer).
 * Las de tier `ajax`/`html` (solo sesión) o sin ruta se listan en el informe y no se exponen.
 */

require __DIR__ . '/../vendor/autoload.php';

use Symfony\Component\Yaml\Yaml;

$root = rtrim($argv[1] ?? '', '/');
$frontend = rtrim($argv[3] ?? ($root . '/frontend'), '/');
$modules = array_values(array_filter(explode(',', $argv[2] ?? '')));
if ($root === '' || $modules === [] || !is_dir($root . '/config/routes')) {
    fwrite(STDERR, "Uso: php bin/gen-spa-manifest.php <raiz tmwe_json> <modulo,modulo>\n");
    exit(2);
}

// response_on => [tier, controlador]
$backend = [];
foreach (glob($root . '/config/routes/*.yml') ?: [] as $file) {
    $yaml = Yaml::parseFile($file);
    foreach (is_array($yaml) ? $yaml : [] as $items) {
        foreach (is_array($items) ? $items : [] as $item) {
            if (is_array($item) && isset($item['response_on'], $item['controller'])) {
                $parts = explode('\\', (string) $item['controller']);
                $backend[(string) $item['response_on']] = $parts[2] ?? '?';
            }
        }
    }
}

// ruta => [metodos], ruta => [modulos]
$methods = [];
$usedBy = [];
foreach ($modules as $module) {
    $dir = $frontend . '/' . (str_contains($module, '/') ? $module : 'apps/operations/src/modules/' . $module);
    if (!is_dir($dir)) {
        fwrite(STDERR, "Origen inexistente: {$module}\n");
        exit(2);
    }
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));
    foreach ($files as $file) {
        if (preg_match('/\.(ts|vue)$/', (string) $file) !== 1
            || preg_match('#/node_modules/|\.(spec|test)\.#', (string) $file) === 1) {
            continue;
        }
        $code = (string) file_get_contents((string) $file);
        // http("/ruta"), http<T>(`/ruta`), `${base}/ruta`, basePath() + '/ruta'
        $hits = preg_match_all('#(?:(?:/bff/v1|/erp/tmwe_json)(?=/[a-z])|\bhttp(?:<[^>]*>)?\(\s*[`"\']|\$\{[A-Za-z_.()?]*[bB]ase[A-Za-z_.()?]*\}|[bB]ase[A-Za-z]*(?:\(\))?\s*\+\s*[`"\'])/([a-z][a-z0-9_]{3,})#', $code, $m, PREG_OFFSET_CAPTURE);
        for ($n = 0; $n < $hits; $n++) {
            $name = $m[1][$n][0];
            $start = (int) $m[0][$n][1];
            $end = $m[0][$n + 1][1] ?? $start + 700;
            $window = substr($code, $start, min($end - $start, 700));
            $verb = preg_match('/method:\s*["\']([A-Za-z]+)["\']/', $window, $v) === 1 ? strtoupper($v[1]) : 'GET';
            $methods[$name][$verb] = true;
            $usedBy[$name][$module] = true;
        }

        // Constantes de ruta (`const BASE = "/api_x"`): solo cuentan si coinciden con una ruta real
        // del backend. El método no se ve en la constante: se toman los que usa ese fichero.
        $literals = preg_match_all('#[`"\']/?([a-z][a-z0-9]*(?:_[a-z0-9]+)+)(?=[?`"\'/\s])#', $code, $lit);
        if ($literals > 0) {
            $fileVerbs = preg_match_all('/method:\s*["\']([A-Za-z]+)["\']/', $code, $mv) > 0
                ? array_map('strtoupper', $mv[1]) : [];
            foreach (array_unique($lit[1]) as $name) {
                if (isset($backend[$name])) {
                    foreach (array_unique(array_merge(['GET'], $fileVerbs)) as $verb) {
                        $methods[$name][$verb] = true;
                    }
                    $usedBy[$name][$module] = true;
                }
            }
        }
    }
}
ksort($methods);

$routes = [];
$excluded = [];
foreach ($methods as $name => $verbs) {
    $tier = $backend[$name] ?? 'sin-ruta';
    if (!in_array($tier, ['api', 'web'], true)) {
        $excluded[$tier][] = $name;
        continue;
    }
    $writesFiles = preg_match('/files|upload|import/', $name) === 1;
    foreach (array_keys($verbs) as $verb) {
        $route = [
            'id' => strtolower($verb) . '.' . $name,
            'method' => $verb,
            'path' => '/' . $name,
            'upstream' => ['action' => $name, 'forward_query' => '*'],
        ];
        if ($verb !== 'GET') {
            $route['limits'] = ['body' => $writesFiles ? '20m' : '1m', 'timeout' => $writesFiles ? 120 : 30];
        }
        $routes[] = $route;
    }
}

$header = "# GENERADO por bin/gen-spa-manifest.php — no editar a mano; añadir a routes.bff.yaml lo manual.\n"
    . '# Módulos: ' . implode(', ', $modules) . "\n";
file_put_contents(__DIR__ . '/../config/routes.spa.yaml', $header . Yaml::dump(['routes' => $routes], 6, 2));

echo count($routes) . ' rutas generadas (' . count($methods) . " endpoints analizados)\n";
foreach ($excluded as $tier => $names) {
    echo "NO expuestas, tier {$tier}: " . count($names) . ' → ' . implode(' ', $names) . "\n";
}
