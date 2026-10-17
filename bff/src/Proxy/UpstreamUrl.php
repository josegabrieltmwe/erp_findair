<?php

declare(strict_types=1);

namespace Findair\Bff\Proxy;

/**
 * tmwe_json se despacha con ?action=<nombre>. Este objeto es el único sitio
 * que conoce ese detalle: el navegador nunca ve el dispatcher.
 */
final class UpstreamUrl
{
    public function __construct(private readonly string $baseUrl, private readonly string $publicUrl)
    {
    }

    /** @param array<string, scalar|array<mixed>> $query */
    public function internal(string $action, array $query = []): string
    {
        return self::build($this->baseUrl, $action, $query);
    }

    /** @param array<string, scalar|array<mixed>> $query */
    public function public(string $action, array $query = []): string
    {
        return self::build($this->publicUrl, $action, $query);
    }

    /** @param array<string, scalar|array<mixed>> $query */
    private static function build(string $base, string $action, array $query): string
    {
        // 'action' va siempre al final y no puede ser sobrescrita por el cliente.
        unset($query['action']);
        $query['action'] = $action;

        return $base . (str_contains($base, '?') ? '&' : '?') . http_build_query($query, '', '&', PHP_QUERY_RFC3986);
    }
}
