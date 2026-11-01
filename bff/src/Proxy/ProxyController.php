<?php

declare(strict_types=1);

namespace Findair\Bff\Proxy;

use Findair\Bff\Auth\TokenProbe;
use Findair\Bff\Auth\TokenRefresher;
use Findair\Bff\Auth\TokenSet;
use Findair\Bff\Http\CsrfGuard;
use Findair\Bff\Http\ImpersonationController;
use Findair\Bff\Impersonation\EffectivePartner;
use Findair\Bff\Session\Session;
use Findair\Bff\Settings;
use Findair\Bff\Support\ClientIp;
use Findair\Bff\Support\ProblemDetails;
use Findair\Bff\Throttle\Throttler;
use GuzzleHttp\ClientInterface;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Exception\TransferException;
use GuzzleHttp\Psr7\Request as UpstreamRequest;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Log\LoggerInterface;

/**
 * Reenvía a tmwe_json solo lo que figura en el manifiesto, con el Bearer del usuario.
 */
final class ProxyController
{
    private readonly ClientIp $clientIp;

    public function __construct(
        private readonly RouteManifest $manifest,
        private readonly UpstreamUrl $urls,
        private readonly ClientInterface $http,
        private readonly TokenRefresher $refresher,
        private readonly ResponseAdapter $adapter,
        private readonly CsrfGuard $csrf,
        private readonly LoggerInterface $logger,
        private readonly Settings $settings,
        private readonly UpstreamStreamer $streamer,
        private readonly TokenProbe $probe,
        private readonly Throttler $throttler,
    ) {
        $this->clientIp = new ClientIp($settings->trustedProxies);
    }

    /** @param array<string, string> $args */
    public function __invoke(Request $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $started = microtime(true);
        $requestId = (string) $request->getAttribute('request_id', '');
        $path = '/' . ltrim($args['path'] ?? '', '/');

        $match = $this->manifest->match($request->getMethod(), '/' . ltrim($path, '/'));
        if ($match === null) {
            return $this->manifest->pathExists($path)
                ? ProblemDetails::response(405, 'method_not_allowed', 'Método no permitido', null, $requestId)
                : ProblemDetails::response(404, 'route_not_found', 'Ruta no encontrada', null, $requestId);
        }
        $route = $match['route'];

        if ($this->isDenied($request->getMethod(), $route->action)) {
            $this->logger->warning('action_denied', ['route' => $route->id, 'action' => $route->action, 'request_id' => $requestId]);

            return ProblemDetails::response(403, 'action_blocked', 'Acción bloqueada en este entorno', 'Bloqueada por UPSTREAM_DENY_ACTIONS.', $requestId);
        }

        /** @var Session $session */
        $session = $request->getAttribute('session');
        /** @var TokenSet $tokens */
        $tokens = $request->getAttribute('tokens');

        if ($route->csrf && !$this->csrf->tokenIsValid($request, $session)) {
            return ProblemDetails::response(403, 'csrf_invalid', 'Token CSRF no válido', null, $requestId);
        }

        $body = $this->readBody($request, $route->maxBody);
        if ($body === null) {
            return ProblemDetails::response(413, 'payload_too_large', 'Cuerpo demasiado grande', null, $requestId);
        }

        $bodyError = $this->checkBodyEnum($route, $body, $requestId);
        if ($bodyError !== null) {
            return $bodyError;
        }

        $lease = null;
        if ($route->throttle !== null) {
            $lease = $this->throttler->enter($route->throttle, $this->userKey($session), $this->clientIp->resolve($request), $requestId, (int) ceil($route->timeout) * 2); // x2: un 401 puede reenviar tras refrescar el token
            if ($lease->rejection !== null) {
                return $lease->rejection;
            }
        }

        try {
            return $this->forward($request, $route, $match['params'], $session, $tokens, $body, $requestId, $started);
        } finally {
            $lease?->release();
        }
    }

    /** @param array<string, string> $params */
    private function forward(Request $request, Route $route, array $params, Session $session, TokenSet $tokens, string $body, string $requestId, float $started): ResponseInterface
    {
        $impersonate = ImpersonationController::impersonatedPartner($session);
        $url = $this->urls->internal($route->action, $this->buildQuery($request, $route, $params));

        try {
            $upstream = $this->send($request, $route, $url, $tokens, $body, $requestId, $impersonate);
            if ($upstream->getStatusCode() === 401) {
                // ¿Token muerto o ruta que rechaza al usuario? Solo en el primer caso se renueva o se cierra la sesión.
                if (!$tokens->expiresWithin(60, time()) && $this->probe->accepts($tokens->accessToken, $requestId)) {
                    if ($impersonate !== null) {
                        // El token vale sin la cabecera: el backend rechaza la suplantación (scope revocado, partner dado de baja).
                        $session->forget('impersonation');
                        $this->logger->warning('impersonation_revoked', ['partner_id' => $impersonate, 'route' => $route->id, 'request_id' => $requestId]);

                        return ProblemDetails::response(403, 'impersonation_revoked', 'Suplantación terminada', 'El backend ya no permite actuar como ese partner; se ha vuelto a su perfil.', $requestId);
                    }

                    return $this->routeDenied($route, $requestId);
                }
                $renewed = $this->refresher->ensureFresh($session, time(), true, $tokens->accessToken);
                if ($renewed === null) {
                    $session->destroy();

                    return ProblemDetails::response(401, 'session_expired', 'Sesión no válida', 'Vuelva a iniciar sesión.', $requestId);
                }
                $upstream = $this->send($request, $route, $url, $renewed, $body, $requestId, $impersonate);
                if ($upstream->getStatusCode() === 401) {
                    return $this->routeDenied($route, $requestId);
                }
            }
        } catch (ConnectException) {
            return ProblemDetails::response(504, 'upstream_unreachable', 'Servicio no disponible', null, $requestId);
        } catch (TransferException $e) {
            $this->logger->error('upstream_transfer_failed', ['route' => $route->id, 'request_id' => $requestId, 'error' => $e::class]);

            return ProblemDetails::response(502, 'upstream_error', 'Error del servicio', null, $requestId);
        }

        if ($impersonate !== null && $route->checkEffectivePartner && EffectivePartner::isCheckable($upstream, !$route->isBinaryOrStream()) && !EffectivePartner::matches($upstream, $impersonate)) {
            // B1/C11: el backend no confirma que atendió como el partner pedido. No se entrega la respuesta.
            EffectivePartner::logMismatch($this->logger, $route->id, $impersonate, $upstream, $requestId);
            $upstream->getBody()->close();

            return ProblemDetails::response(502, 'effective_partner_mismatch', 'Partner efectivo no confirmado', 'El servicio no confirmó que la respuesta corresponda al partner seleccionado; se descarta.', $requestId);
        }

        $adapted = $this->adapter->adapt($upstream, $route, $requestId);
        $this->logger->info('proxy', [
            'route' => $route->id,
            'status' => $adapted->getStatusCode(),
            'ms' => (int) ((microtime(true) - $started) * 1000),
            'request_id' => $requestId,
        ]);

        return $adapted;
    }

    /** Valida campos JSON del cuerpo contra la lista cerrada del manifiesto (`body_enum`). */
    private function checkBodyEnum(Route $route, string $body, string $requestId): ?ResponseInterface
    {
        if ($route->bodyEnum === []) {
            return null;
        }
        $decoded = json_decode($body, true);
        if (!is_array($decoded) || array_is_list($decoded)) {
            return ProblemDetails::response(400, 'invalid_body', 'Cuerpo no válido', 'Se esperaba un objeto JSON.', $requestId);
        }
        foreach ($route->bodyEnum as $field => $allowed) {
            $value = $decoded[$field] ?? null;
            if (!is_string($value) || !in_array($value, $allowed, true)) {
                return ProblemDetails::response(400, 'invalid_body', 'Cuerpo no válido', "Valor no permitido en '{$field}'.", $requestId);
            }
        }

        return null;
    }

    /** Identidad estable para los límites: el usuario real (no el partner suplantado); si falta, la sesión. */
    private function userKey(Session $session): string
    {
        $context = $session->get('context');
        $user = is_array($context) && is_array($context['user'] ?? null) ? $context['user'] : [];
        $name = is_string($user['username'] ?? null) ? $user['username'] : '';

        return $name !== '' ? 'user:' . $name : 'session:' . $session->id();
    }

    /** El backend rechaza esta operación con 401 aunque la sesión es válida: se informa como 403 y no se cierra la sesión. */
    private function routeDenied(Route $route, string $requestId): ResponseInterface
    {
        $this->logger->warning('upstream_401_with_valid_token', ['route' => $route->id, 'request_id' => $requestId]);

        return ProblemDetails::response(403, 'upstream_unauthorized', 'Acceso denegado', 'El servicio no autoriza esta operación.', $requestId);
    }

    /** Lista de bloqueo por entorno: solo afecta a métodos que cambian estado. */
    private function isDenied(string $method, string $action): bool
    {
        if (in_array(strtoupper($method), ['GET', 'HEAD', 'OPTIONS'], true)) {
            return false;
        }
        foreach ($this->settings->denyActions as $pattern) {
            if (fnmatch($pattern, $action)) {
                return true;
            }
        }

        return false;
    }

    private function send(Request $request, Route $route, string $url, TokenSet $tokens, string $body, string $requestId, ?int $impersonate = null): ResponseInterface
    {
        $headers = [
            'Authorization' => 'Bearer ' . $tokens->accessToken,
            'Accept' => $request->getHeaderLine('Accept') !== '' ? $request->getHeaderLine('Accept') : 'application/json',
            'X-Request-Id' => $requestId,
            'traceparent' => (string) $request->getAttribute('traceparent', ''),
        ];
        if ($impersonate !== null) {
            $headers['X-Impersonate-Partner-Id'] = (string) $impersonate;
        }
        $lang = $request->getHeaderLine('X-Tmwe-Lang');
        if (preg_match('/^[a-z]{2}(-[A-Za-z]{2})?$/', $lang) === 1) {
            $headers['X-Tmwe-Lang'] = $lang;
        }
        $ip = $this->clientIp->resolve($request);
        if ($ip !== '') {
            $headers['X-Forwarded-For'] = $ip;
        }
        if ($body !== '' && $request->getHeaderLine('Content-Type') !== '') {
            $headers['Content-Type'] = $request->getHeaderLine('Content-Type');
        }

        $upstreamRequest = new UpstreamRequest($route->upstreamMethod, $url, array_filter($headers, static fn (string $v): bool => $v !== ''), $body !== '' ? $body : null);

        if ($route->response === 'stream') {
            // Streams (SSE): sin límite total; el timeout del manifiesto es el silencio tolerado.
            return $this->streamer->open($upstreamRequest, $route->timeout, $this->settings->upstreamConnectTimeout);
        }

        return $this->http->send($upstreamRequest, [
            'stream' => $route->isBinaryOrStream(),
            'timeout' => $route->timeout,
            'http_errors' => false,
            'allow_redirects' => false,
        ]);
    }

    /**
     * @param array<string, string> $pathValues
     * @return array<string, scalar|array<mixed>>
     */
    private function buildQuery(Request $request, Route $route, array $pathValues): array
    {
        $query = $route->staticQuery;
        $incoming = $request->getQueryParams();
        if ($route->forwardAllQuery) {
            foreach ($incoming as $key => $value) {
                if ($key !== 'action' && (is_string($value) || is_array($value))) {
                    $query[(string) $key] = $value;
                }
            }
        }
        foreach ($route->forwardQuery as $key) {
            if (isset($incoming[$key]) && (is_string($incoming[$key]) || is_array($incoming[$key]))) {
                $query[$key] = $incoming[$key];
            }
        }
        foreach ($route->pathParams as $segment => $upstreamName) {
            $query[$upstreamName] = $pathValues[$segment];
        }

        return $query;
    }

    private function readBody(Request $request, int $max): ?string
    {
        if (in_array($request->getMethod(), ['GET', 'HEAD', 'OPTIONS'], true)) {
            return '';
        }
        $size = $request->getBody()->getSize();
        if ($size !== null && $size > $max) {
            return null;
        }
        $body = $request->getBody();
        $body->rewind();
        // php://input entrega como mucho ~8 KiB por lectura: un único read() truncaba en silencio los
        // cuerpos mayores (y el límite nunca saltaba). Se lee hasta EOF o hasta pasar el máximo.
        $data = '';
        while (!$body->eof() && strlen($data) <= $max) {
            $chunk = $body->read(min(65536, $max + 1 - strlen($data)));
            if ($chunk === '') {
                break;
            }
            $data .= $chunk;
        }

        return strlen($data) > $max ? null : $data;
    }
}
