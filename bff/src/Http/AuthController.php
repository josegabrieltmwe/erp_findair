<?php

declare(strict_types=1);

namespace Findair\Bff\Http;

use Findair\Bff\Auth\OAuthClient;
use Findair\Bff\Auth\OAuthException;
use Findair\Bff\Auth\TokenRefresher;
use Findair\Bff\Auth\TokenVault;
use Findair\Bff\Auth\UserContextProvider;
use Findair\Bff\Session\Session;
use Findair\Bff\Settings;
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

    /** Estado de la sesión y token CSRF para la SPA. */
    public function sessionInfo(Request $request, ResponseInterface $response): ResponseInterface
    {
        $session = $this->session($request);
        $authenticated = $session->isAuthenticated() && !$session->isNew();
        $payload = ['authenticated' => $authenticated];
        if ($authenticated) {
            $payload['csrf_token'] = $session->csrfToken();
            $context = $session->get('context');
            $payload['user'] = is_array($context) && is_array($context['user'] ?? null) ? $context['user'] : new \stdClass();
            $payload['capabilities'] = is_array($context) && is_array($context['capabilities'] ?? null) ? $context['capabilities'] : [];
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
