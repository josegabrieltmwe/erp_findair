<?php

declare(strict_types=1);

namespace Findair\Bff\Proxy;

use Findair\Bff\Auth\TokenRefresher;
use Findair\Bff\Auth\TokenSet;
use Findair\Bff\Http\CsrfGuard;
use Findair\Bff\Session\Session;
use Findair\Bff\Settings;
use Findair\Bff\Support\ProblemDetails;
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
    public function __construct(
        private readonly RouteManifest $manifest,
        private readonly UpstreamUrl $urls,
        private readonly ClientInterface $http,
        private readonly TokenRefresher $refresher,
        private readonly ResponseAdapter $adapter,
        private readonly CsrfGuard $csrf,
        private readonly LoggerInterface $logger,
        private readonly Settings $settings,
    ) {
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

        $url = $this->urls->internal($route->action, $this->buildQuery($request, $route, $match['params']));

        try {
            $upstream = $this->send($request, $route, $url, $tokens, $body, $requestId);
            if ($upstream->getStatusCode() === 401) {
                $renewed = $this->refresher->ensureFresh($session, time(), true, $tokens->accessToken);
                if ($renewed === null) {
                    $session->destroy();

                    return ProblemDetails::response(401, 'session_expired', 'Sesión no válida', 'Vuelva a iniciar sesión.', $requestId);
                }
                $upstream = $this->send($request, $route, $url, $renewed, $body, $requestId);
            }
        } catch (ConnectException) {
            return ProblemDetails::response(504, 'upstream_unreachable', 'Servicio no disponible', null, $requestId);
        } catch (TransferException $e) {
            $this->logger->error('upstream_transfer_failed', ['route' => $route->id, 'request_id' => $requestId, 'error' => $e::class]);

            return ProblemDetails::response(502, 'upstream_error', 'Error del servicio', null, $requestId);
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

    private function send(Request $request, Route $route, string $url, TokenSet $tokens, string $body, string $requestId): ResponseInterface
    {
        $headers = [
            'Authorization' => 'Bearer ' . $tokens->accessToken,
            'Accept' => $request->getHeaderLine('Accept') !== '' ? $request->getHeaderLine('Accept') : 'application/json',
            'X-Request-Id' => $requestId,
            'traceparent' => (string) $request->getAttribute('traceparent', ''),
        ];
        $lang = $request->getHeaderLine('X-Tmwe-Lang');
        if (preg_match('/^[a-z]{2}(-[A-Za-z]{2})?$/', $lang) === 1) {
            $headers['X-Tmwe-Lang'] = $lang;
        }
        $ip = $request->getServerParams()['REMOTE_ADDR'] ?? '';
        if (is_string($ip) && $ip !== '') {
            $headers['X-Forwarded-For'] = $ip;
        }
        if ($body !== '' && $request->getHeaderLine('Content-Type') !== '') {
            $headers['Content-Type'] = $request->getHeaderLine('Content-Type');
        }

        return $this->http->send(
            new UpstreamRequest($route->upstreamMethod, $url, array_filter($headers, static fn (string $v): bool => $v !== ''), $body !== '' ? $body : null),
            [
                'stream' => $route->isBinaryOrStream(),
                'timeout' => $route->timeout,
                'http_errors' => false,
                'allow_redirects' => false,
            ],
        );
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
        $data = $body->read($max + 1);

        return strlen($data) > $max ? null : $data;
    }
}
