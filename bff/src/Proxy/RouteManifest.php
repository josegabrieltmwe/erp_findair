<?php

declare(strict_types=1);

namespace Findair\Bff\Proxy;

use Symfony\Component\Yaml\Yaml;

/**
 * Lista blanca de rutas. Lo que no está aquí devuelve 404.
 */
final class RouteManifest
{
    private const RESPONSES = ['json', 'binary', 'stream'];

    /** @param list<Route> $routes */
    public function __construct(private readonly array $routes)
    {
    }

    public static function fromFile(string $path): self
    {
        $parsed = Yaml::parseFile($path);
        $items = is_array($parsed) && is_array($parsed['routes'] ?? null) ? $parsed['routes'] : [];

        return self::fromArray($items);
    }

    /** @param array<int, mixed> $items */
    public static function fromArray(array $items): self
    {
        $routes = [];
        $seen = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                throw new \InvalidArgumentException('Entrada de manifiesto inválida.');
            }
            $route = self::compile($item);
            $key = $route->method . ' ' . $route->path;
            if (isset($seen[$key])) {
                throw new \InvalidArgumentException("Ruta duplicada en el manifiesto: {$key}");
            }
            $seen[$key] = true;
            $routes[] = $route;
        }

        return new self($routes);
    }

    /** @return array{route: Route, params: array<string, string>}|null */
    public function match(string $method, string $path): ?array
    {
        foreach ($this->routes as $route) {
            if ($route->method === strtoupper($method) && preg_match($route->pattern, $path, $m) === 1) {
                $params = [];
                foreach ($route->pathParams as $segment => $_) {
                    $params[$segment] = $m[$segment];
                }

                return ['route' => $route, 'params' => $params];
            }
        }

        return null;
    }

    /** ¿Existe la ruta con otro método? Permite responder 405 en lugar de 404. */
    public function pathExists(string $path): bool
    {
        foreach ($this->routes as $route) {
            if (preg_match($route->pattern, $path) === 1) {
                return true;
            }
        }

        return false;
    }

    /** @return list<Route> */
    public function all(): array
    {
        return $this->routes;
    }

    /** @param array<mixed> $i */
    private static function compile(array $i): Route
    {
        foreach (['id', 'method', 'path', 'upstream'] as $required) {
            if (!isset($i[$required])) {
                throw new \InvalidArgumentException("Falta '{$required}' en una ruta del manifiesto.");
            }
        }
        $upstream = $i['upstream'];
        if (!is_array($upstream) || !is_string($upstream['action'] ?? null) || preg_match('/^[a-z0-9_]+$/', $upstream['action']) !== 1) {
            throw new \InvalidArgumentException("La ruta '{$i['id']}' necesita upstream.action (a-z, 0-9, _).");
        }
        $response = (string) ($i['response'] ?? 'json');
        if (!in_array($response, self::RESPONSES, true)) {
            throw new \InvalidArgumentException("response inválido en '{$i['id']}'.");
        }

        $method = strtoupper((string) $i['method']);
        $path = (string) $i['path'];
        $pathParams = [];
        $pattern = '';
        foreach (preg_split('/(\{[a-z_]+\})/', $path, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY) ?: [] as $part) {
            if (preg_match('/^\{([a-z_]+)\}$/', $part, $m) === 1) {
                $pathParams[$m[1]] = $m[1];
                $pattern .= '(?P<' . $m[1] . '>[A-Za-z0-9_.-]{1,64})';
            } else {
                $pattern .= preg_quote($part, '#');
            }
        }

        $mapping = is_array($upstream['params'] ?? null) ? $upstream['params'] : [];
        $resolved = [];
        foreach ($pathParams as $segment => $_) {
            $resolved[$segment] = (string) ($mapping[$segment] ?? $segment);
        }

        return new Route(
            id: (string) $i['id'],
            method: $method,
            path: $path,
            action: $upstream['action'],
            upstreamMethod: strtoupper((string) ($upstream['method'] ?? $method)),
            forwardQuery: array_values(array_map('strval', (array) ($upstream['forward_query'] ?? []))),
            staticQuery: is_array($upstream['query'] ?? null) ? $upstream['query'] : [],
            pathParams: $resolved,
            response: $response,
            legacyEnvelope: (bool) ($i['legacy_envelope'] ?? false),
            maxBody: self::bytes((string) ($i['limits']['body'] ?? '256k')),
            timeout: (float) ($i['limits']['timeout'] ?? 15),
            csrf: (bool) ($i['csrf'] ?? !in_array($method, ['GET', 'HEAD'], true)),
            pattern: '#^' . $pattern . '$#',
        );
    }

    private static function bytes(string $value): int
    {
        if (preg_match('/^(\d+)\s*([kKmM]?)$/', $value, $m) !== 1) {
            throw new \InvalidArgumentException("Tamaño inválido: {$value}");
        }

        return (int) $m[1] * match (strtolower($m[2])) {
            'k' => 1024,
            'm' => 1024 * 1024,
            default => 1,
        };
    }
}
