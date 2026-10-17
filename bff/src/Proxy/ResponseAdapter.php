<?php

declare(strict_types=1);

namespace Findair\Bff\Proxy;

use Findair\Bff\Support\ProblemDetails;
use Psr\Http\Message\ResponseInterface;
use Psr\Log\LoggerInterface;
use Slim\Psr7\Response;

/**
 * Convierte la respuesta de tmwe_json en la respuesta del BFF: formato de error
 * único (RFC 9457) y solo las cabeceras que el navegador necesita.
 */
final class ResponseAdapter
{
    private const FORWARDED_HEADERS = ['content-type', 'content-disposition', 'content-length', 'cache-control', 'etag', 'last-modified', 'retry-after'];

    public function __construct(private readonly LoggerInterface $logger)
    {
    }

    public function adapt(ResponseInterface $upstream, Route $route, string $requestId): ResponseInterface
    {
        $status = $upstream->getStatusCode();

        if ($status >= 400) {
            return $this->fromUpstreamError($upstream, $status, $route, $requestId);
        }

        if ($route->legacyEnvelope && !$route->isBinaryOrStream()) {
            $rejected = $this->legacyRejection($upstream, $requestId);
            if ($rejected !== null) {
                return $rejected;
            }
        }

        $response = new Response($status, null, $upstream->getBody());
        foreach (self::FORWARDED_HEADERS as $name) {
            if ($upstream->hasHeader($name)) {
                $response = $response->withHeader($name, $upstream->getHeader($name));
            }
        }

        return $response;
    }

    private function fromUpstreamError(ResponseInterface $upstream, int $status, Route $route, string $requestId): ResponseInterface
    {
        $payload = $this->decode($upstream);
        $code = $this->pick($payload, ['error_code', 'code', 'error']);
        $detail = $this->pick($payload, ['message', 'detail', 'error_description', 'error']);

        $this->logger->warning('upstream_error', ['route' => $route->id, 'status' => $status, 'upstream_code' => $code, 'request_id' => $requestId]);

        if ($status >= 500) {
            // Nunca se filtra el detalle interno del backend.
            return ProblemDetails::response(502, 'upstream_error', 'Error del servicio', 'El servicio no pudo completar la operación.', $requestId);
        }

        $headers = [];
        if ($upstream->hasHeader('Retry-After')) {
            $headers['Retry-After'] = $upstream->getHeaderLine('Retry-After');
        }

        return match ($status) {
            401 => ProblemDetails::response(401, 'session_expired', 'Sesión no válida', 'Vuelva a iniciar sesión.', $requestId),
            403 => ProblemDetails::response(403, $code ?? 'forbidden', 'Acceso denegado', $detail, $requestId),
            404 => ProblemDetails::response(404, $code ?? 'not_found', 'No encontrado', $detail, $requestId),
            429 => ProblemDetails::response(429, 'rate_limited', 'Demasiadas solicitudes', $detail, $requestId, [], $headers),
            default => ProblemDetails::response($status, $code ?? 'request_rejected', 'Solicitud rechazada', $detail, $requestId),
        };
    }

    /** Algunos controladores heredados responden 200 con {"success": false}. */
    private function legacyRejection(ResponseInterface $upstream, string $requestId): ?ResponseInterface
    {
        $payload = $this->decode($upstream);
        if (($payload['success'] ?? null) !== false) {
            return null;
        }

        return ProblemDetails::response(
            422,
            $this->pick($payload, ['error_code', 'code']) ?? 'request_rejected',
            'Solicitud rechazada',
            $this->pick($payload, ['message', 'error']),
            $requestId,
        );
    }

    /** @return array<string, mixed> */
    private function decode(ResponseInterface $response): array
    {
        $body = $response->getBody();
        $size = $body->getSize();
        if ($size !== null && $size > 1_048_576) {
            return [];
        }
        $decoded = json_decode((string) $body, true);
        $body->rewind();

        return is_array($decoded) ? $decoded : [];
    }

    /**
     * @param array<string, mixed> $payload
     * @param list<string> $keys
     */
    private function pick(array $payload, array $keys): ?string
    {
        foreach ($keys as $key) {
            if (isset($payload[$key]) && is_string($payload[$key]) && $payload[$key] !== '') {
                return mb_substr($payload[$key], 0, 300);
            }
        }

        return null;
    }
}
