<?php

declare(strict_types=1);

namespace Findair\Bff\Proxy;

/**
 * Una entrada del manifiesto: lo único que el navegador puede pedir.
 */
final class Route
{
    /**
     * @param list<string> $forwardQuery parámetros de query que se reenvían tal cual
     * @param bool $forwardAllQuery reenvía toda la query salvo `action` (rutas compatibles con la SPA)
     * @param array<string, scalar> $staticQuery parámetros fijos hacia el backend
     * @param array<string, string> $pathParams segmento de la ruta => nombre del parámetro upstream
     */
    public function __construct(
        public readonly string $id,
        public readonly string $method,
        public readonly string $path,
        public readonly string $action,
        public readonly string $upstreamMethod,
        public readonly array $forwardQuery,
        public readonly bool $forwardAllQuery,
        public readonly array $staticQuery,
        public readonly array $pathParams,
        public readonly string $response,
        public readonly bool $legacyEnvelope,
        public readonly int $maxBody,
        public readonly float $timeout,
        public readonly bool $csrf,
        public readonly string $pattern,
        /** Política de límites (RateLimiter) a aplicar; null = ninguna. */
        public readonly ?string $throttle = null,
        /** @var array<string, list<string>> campos JSON del cuerpo => valores permitidos (lista cerrada) */
        public readonly array $bodyEnum = [],
        /** Con suplantación, exige X-Effective-Partner-Id en respuestas JSON 2xx; `false` solo para rutas cuyo controlador no lo sella. */
        public readonly bool $checkEffectivePartner = true,
    ) {
    }

    public function isBinaryOrStream(): bool
    {
        return $this->response !== 'json';
    }
}
