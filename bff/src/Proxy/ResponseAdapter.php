<?php

declare(strict_types=1);

namespace Findair\Bff\Proxy;

use Findair\Bff\Http\StreamingEmitter;
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

    /**
     * Códigos de error de la IA que tmwe_json publica en las rutas copilot (Ai_Request_Exception) y el texto
     * FIJO con el que se muestran. Lista cerrada: el cuerpo del backend nunca se reenvía en estos errores.
     */
    private const AI_ERRORS = [
        'AI_UNAVAILABLE' => 'El servicio de IA no está disponible temporalmente.',
        'AI_TIMEOUT' => 'El servicio de IA tardó demasiado en responder.',
        'AI_CREDENTIALS_MISSING' => 'La IA no está configurada para esta cuenta.',
        'AI_CREDENTIALS_INVALID' => 'La IA no está configurada correctamente para esta cuenta.',
        'AI_PROVIDER_ERROR' => 'El servicio de IA ha fallado.',
        'AI_BUDGET_EXCEEDED' => 'Se ha agotado el presupuesto de IA.',
        'AI_BAD_REQUEST' => 'El servicio de IA rechazó la petición.',
        'AI_PROTOCOL_UNSUPPORTED' => 'El servicio de IA no es compatible.',
    ];

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
        if ($route->response === 'stream') {
            // Sin búfer ni transformaciones intermedias; StreamingEmitter retira el marcador.
            $response = $response
                ->withoutHeader('Content-Length')
                ->withHeader('Cache-Control', 'no-cache, no-transform')
                ->withHeader('X-Accel-Buffering', 'no')
                ->withHeader(StreamingEmitter::MARKER, '1');
        }

        return $response;
    }

    private function fromUpstreamError(ResponseInterface $upstream, int $status, Route $route, string $requestId): ResponseInterface
    {
        $payload = $this->decode($upstream);
        $code = $this->pick($payload, ['error_code', 'code', 'error']);
        $detail = $this->pick($payload, ['message', 'detail', 'error_description', 'error']);

        $this->logger->warning('upstream_error', ['route' => $route->id, 'status' => $status, 'upstream_code' => $code, 'request_id' => $requestId]);

        // Rutas copilot: un fallo de IA conserva su código (429/5xx), con texto fijo y el estado coherente.
        $ai = $this->aiProblem($payload, $upstream, $status, $route, $requestId);
        if ($ai !== null) {
            return $ai;
        }

        if ($status >= 500) {
            // Nunca se filtra el detalle interno del backend.
            return ProblemDetails::response(502, 'upstream_error', 'Error del servicio', 'El servicio no pudo completar la operación.', $requestId);
        }

        $headers = [];
        if ($upstream->hasHeader('Retry-After')) {
            $headers['Retry-After'] = $upstream->getHeaderLine('Retry-After');
        }

        // Los campos del backend (details, errors, error_code…) viajan como miembros de extensión
        // (RFC 9457): la SPA los usa para pintar errores de validación por campo.
        $extra = self::extensions($payload);

        return match ($status) {
            401 => ProblemDetails::response(401, 'session_expired', 'Sesión no válida', 'Vuelva a iniciar sesión.', $requestId),
            403 => ProblemDetails::response(403, $code ?? 'forbidden', 'Acceso denegado', $detail, $requestId, $extra),
            404 => ProblemDetails::response(404, $code ?? 'not_found', 'No encontrado', $detail, $requestId, $extra),
            429 => ProblemDetails::response(429, 'rate_limited', 'Demasiadas solicitudes', $detail, $requestId, [], $headers),
            default => ProblemDetails::response($status, $code ?? 'request_rejected', 'Solicitud rechazada', $detail, $requestId, $extra),
        };
    }

    /**
     * 429 y 5xx de una ruta copilot con un `error_code` AI_* conocido. 4xx restantes siguen el camino normal
     * (ya conservan el código). Estado: 429 y 503/504 se mantienen; cualquier otro 5xx se publica como 502.
     *
     * @param array<string, mixed> $payload
     */
    private function aiProblem(array $payload, ResponseInterface $upstream, int $status, Route $route, string $requestId): ?ResponseInterface
    {
        if (!str_starts_with($route->id, 'copilot.') || ($status !== 429 && $status < 500)) {
            return null;
        }
        $aiCode = $payload['error_code'] ?? null;
        if (!is_string($aiCode) || !isset(self::AI_ERRORS[$aiCode])) {
            return null;
        }

        $headers = [];
        if ($upstream->hasHeader('Retry-After')) {
            $headers['Retry-After'] = mb_substr($upstream->getHeaderLine('Retry-After'), 0, 40);
        }
        $out = in_array($status, [429, 503, 504], true) ? $status : 502;
        $title = $status === 429 ? 'Límite de IA' : 'Servicio de IA';

        return ProblemDetails::response($out, $aiCode, $title, self::AI_ERRORS[$aiCode], $requestId, ['error_code' => $aiCode], $headers);
    }

    /**
     * Miembros del cuerpo del backend que se conservan; los reservados del problema no se pisan.
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private static function extensions(array $payload): array
    {
        $reserved = ['type', 'title', 'status', 'detail', 'instance', 'code', 'request_id'];
        $extra = [];
        foreach ($payload as $key => $value) {
            if (is_string($key) && !in_array($key, $reserved, true) && (is_scalar($value) || is_array($value) || $value === null)) {
                $extra[$key] = $value;
            }
        }

        return $extra;
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
