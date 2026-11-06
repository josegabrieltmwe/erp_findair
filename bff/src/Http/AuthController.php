<?php

declare(strict_types=1);

namespace Findair\Bff\Http;

use Findair\Bff\Auth\OAuthClient;
use Findair\Bff\Auth\OAuthException;
use Findair\Bff\Auth\OtpGate;
use Findair\Bff\Auth\TokenRefresher;
use Findair\Bff\Auth\TokenVault;
use Findair\Bff\Auth\UserContextProvider;
use Findair\Bff\Session\Session;
use Findair\Bff\Settings;
use Findair\Bff\Support\ClientIp;
use Findair\Bff\Support\ProblemDetails;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Log\LoggerInterface;

final class AuthController
{
    private const PENDING_TTL = 600;

    public function __construct(
        private readonly OAuthClient $oauth,
        private readonly TokenVault $vault,
        private readonly TokenRefresher $refresher,
        private readonly UserContextProvider $context,
        private readonly CsrfGuard $csrf,
        private readonly Settings $settings,
        private readonly LoggerInterface $logger,
        private readonly OtpGate $otpGate,
    ) {
    }

    /** Inicia Authorization Code + PKCE contra el login de tmwe_json. */
    public function login(Request $request, ResponseInterface $response): ResponseInterface
    {
        $session = $this->session($request);
        $state = bin2hex(random_bytes(16));
        $pkce = OAuthClient::newPkce();
        $returnTo = $request->getQueryParams()['return_to'] ?? '/';

        $session->set('oauth_pending', [
            'state' => $state,
            'verifier' => $pkce['verifier'],
            'return_to' => is_string($returnTo) && self::isSafePath($returnTo) ? $returnTo : '/',
            'at' => time(),
        ]);

        return $this->redirect($response, $this->oauth->authorizationUrl($state, $pkce['challenge']));
    }

    public function callback(Request $request, ResponseInterface $response): ResponseInterface
    {
        $session = $this->session($request);
        $query = $request->getQueryParams();
        $pending = $session->get('oauth_pending');
        $session->forget('oauth_pending');

        if (!is_array($pending) || time() - (int) ($pending['at'] ?? 0) > self::PENDING_TTL) {
            return $this->failed($response, 'login_expired');
        }
        if (isset($query['error'])) {
            return $this->failed($response, 'access_denied');
        }
        $state = $query['state'] ?? null;
        $code = $query['code'] ?? null;
        if (!is_string($state) || !is_string($code) || $code === '' || !hash_equals((string) $pending['state'], $state)) {
            return $this->failed($response, 'invalid_state');
        }

        try {
            $tokens = $this->oauth->exchangeCode($code, (string) $pending['verifier'], time());
        } catch (OAuthException $e) {
            $this->logger->warning('token_exchange_failed', ['error' => $e->oauthError, 'request_id' => $request->getAttribute('request_id')]);

            return $this->failed($response, 'token_exchange_failed');
        }

        $session->regenerate();
        $session->set('created_at', time());
        $session->set('csrf', bin2hex(random_bytes(32)));
        $session->set('tokens', $this->vault->seal($tokens));
        $session->set('context', $this->context->load($tokens->accessToken, (string) $request->getAttribute('request_id', '')));

        return $this->redirect($response, $this->settings->appUrl . (string) $pending['return_to']);
    }

    /**
     * Punto de autorización por OTP: abre una sesión SIN usuario para quien presenta el OTP de un correo (una aerolínea que
     * responde a una cotización). No se autentica a nadie: el OTP autoriza el acceso a UN recurso, y ante el API quien se
     * autentica es la aplicación, con su Bearer (`client_credentials`), que queda en la sesión y nunca llega al navegador.
     *
     * Solo si el API autoriza se crea la sesión. Un intento fallido no deja sesión ni cookie (no hay fijación ni sesiones
     * basura) y suma al bloqueo por recurso e IP. La respuesta es la misma para «no existe», «OTP erróneo» y «caducado».
     */
    public function otp(Request $request, ResponseInterface $response): ResponseInterface
    {
        $requestId = (string) $request->getAttribute('request_id', '');
        $session = $this->session($request);

        // Una sesión de usuario ya abierta (el operador probando el enlace en su navegador) no se pisa.
        if ($session->isAuthenticated() && !$session->isOtp()) {
            return ProblemDetails::response(409, 'session_in_use', 'Sesión de usuario abierta', 'Cierre sesión o abra el enlace en una ventana privada.', $requestId);
        }

        $raw = (string) $request->getBody();
        $body = strlen($raw) <= 2048 ? json_decode($raw, true) : null;
        if (!is_array($body)) {
            return ProblemDetails::response(400, 'invalid_body', 'Petición no válida', null, $requestId);
        }
        $type = is_string($body['type'] ?? null) ? $body['type'] : 'cargo_offer';
        $otp = $body['otp'] ?? null;
        $ip = (new ClientIp($this->settings->trustedProxies))->resolve($request);

        $result = $this->otpGate->authorize($type, $body['id'] ?? null, $otp, $ip, time(), $requestId);

        switch ($result['outcome']) {
            case OtpGate::LOCKED:
                return ProblemDetails::response(429, 'otp_locked', 'Demasiados intentos', 'Espere unos minutos y vuelva a intentarlo.', $requestId, [], ['Retry-After' => (string) ($result['retry_after'] ?? 60)]);
            case OtpGate::UNAVAILABLE:
                return ProblemDetails::response(503, 'otp_unavailable', 'Servicio no disponible', 'No se pudo comprobar el enlace. Inténtelo de nuevo en un momento.', $requestId);
            case OtpGate::AUTHORIZED:
                break;
            default:
                return ProblemDetails::response(403, 'otp_not_authorized', 'Enlace no válido', 'El enlace no es válido o ha caducado.', $requestId);
        }

        $tokens = $result['tokens'] ?? null;
        if (!$tokens instanceof \Findair\Bff\Auth\TokenSet) {
            return ProblemDetails::response(503, 'otp_unavailable', 'Servicio no disponible', null, $requestId);
        }
        $resource = $result['resource'] ?? [];
        $session->regenerate();
        $session->set('created_at', time());
        $session->set('csrf', bin2hex(random_bytes(32)));
        $session->set('tokens', $this->vault->seal($tokens));
        $session->set('grant', [
            'type' => $type,
            'id' => (int) ($resource['id'] ?? 0),
            // El OTP se queda en el servidor, cifrado: el proxy lo añade a cada llamada, el navegador no lo vuelve a ver.
            'otp' => $this->vault->sealString((string) $otp),
            'scopes' => $result['scopes'] ?? [],
            'at' => time(),
        ]);

        return $this->json($response, [
            'authenticated' => true,
            'kind' => 'otp',
            'csrf_token' => $session->csrfToken(),
            'resource' => ['type' => $type, 'id' => (int) ($resource['id'] ?? 0), 'state' => (string) ($resource['state'] ?? '')],
            'scopes' => $result['scopes'] ?? [],
            'expires_at' => $result['expires_at'] ?? null,
        ]);
    }

    /** Estado de la sesión y token CSRF para la SPA. */
    public function sessionInfo(Request $request, ResponseInterface $response): ResponseInterface
    {
        $session = $this->session($request);
        $authenticated = $session->isAuthenticated() && !$session->isNew();
        $payload = ['authenticated' => $authenticated];
        if ($authenticated && $session->isOtp()) {
            // Sesión de OTP: sin usuario, capacidades ni suplantación. Solo el recurso al que da acceso.
            $grant = $session->grant() ?? [];
            $payload['kind'] = 'otp';
            $payload['csrf_token'] = $session->csrfToken();
            $payload['resource'] = ['type' => (string) ($grant['type'] ?? ''), 'id' => (int) ($grant['id'] ?? 0)];
            $payload['scopes'] = array_values(array_filter((array) ($grant['scopes'] ?? []), 'is_string'));
            $payload['access_expires_at'] = $this->refresher->current($session)?->expiresAt;
            $response->getBody()->write(json_encode($payload, JSON_THROW_ON_ERROR));

            return $response->withHeader('Content-Type', 'application/json; charset=utf-8');
        }
        if ($authenticated) {
            $payload['csrf_token'] = $session->csrfToken();
            $context = $session->get('context');
            $payload['user'] = is_array($context) && is_array($context['user'] ?? null) ? $context['user'] : new \stdClass();
            $payload['capabilities'] = is_array($context) && is_array($context['capabilities'] ?? null) ? $context['capabilities'] : [];
            $active = ImpersonationController::active($session);
            $payload['impersonation'] = $active['active_partner'];
            $impersonation = $session->get('impersonation');
            if ($active['active_partner'] !== null && is_array($impersonation) && is_array($impersonation['capabilities'] ?? null)) {
                // La SPA ve las capacidades del partner suplantado, igual que el backend.
                $payload['capabilities'] = array_values(array_filter($impersonation['capabilities'], 'is_string'));
            }
            $tokens = $this->refresher->current($session);
            $payload['access_expires_at'] = $tokens?->expiresAt;
        }

        $response->getBody()->write(json_encode($payload, JSON_THROW_ON_ERROR));

        return $response->withHeader('Content-Type', 'application/json; charset=utf-8');
    }

    public function logout(Request $request, ResponseInterface $response): ResponseInterface
    {
        $session = $this->session($request);
        if ($session->isNew()) {
            return $response->withStatus(204);
        }
        if (!$this->csrf->tokenIsValid($request, $session)) {
            return ProblemDetails::response(403, 'csrf_invalid', 'Token CSRF no válido', null, (string) $request->getAttribute('request_id'));
        }

        $tokens = $this->refresher->current($session);
        if ($tokens !== null) {
            $this->oauth->revoke($tokens->accessToken, 'access_token');
            if ($tokens->refreshToken !== '') {
                $this->oauth->revoke($tokens->refreshToken, 'refresh_token');
            }
        }
        $session->destroy();

        return $response->withStatus(204);
    }

    /** @param array<string, mixed> $payload */
    private function json(ResponseInterface $response, array $payload): ResponseInterface
    {
        $response->getBody()->write(json_encode($payload, JSON_THROW_ON_ERROR));

        return $response->withHeader('Content-Type', 'application/json; charset=utf-8')->withHeader('Cache-Control', 'no-store');
    }

    private function session(Request $request): Session
    {
        $session = $request->getAttribute('session');
        if (!$session instanceof Session) {
            throw new \LogicException('SessionMiddleware no está activo.');
        }

        return $session;
    }

    private function failed(ResponseInterface $response, string $code): ResponseInterface
    {
        return $this->redirect($response, $this->settings->appUrl . '/?auth_error=' . rawurlencode($code));
    }

    private function redirect(ResponseInterface $response, string $url): ResponseInterface
    {
        return $response->withStatus(302)->withHeader('Location', $url)->withHeader('Cache-Control', 'no-store');
    }

    /** Solo rutas internas de la SPA: evita redirecciones abiertas. */
    private static function isSafePath(string $path): bool
    {
        return preg_match('#^/(?![/\\\\])[^\r\n]*$#', $path) === 1 && strlen($path) <= 512;
    }
}
