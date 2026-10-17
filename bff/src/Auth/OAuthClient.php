<?php

declare(strict_types=1);

namespace Findair\Bff\Auth;

use Findair\Bff\Proxy\UpstreamUrl;
use Findair\Bff\Settings;
use GuzzleHttp\ClientInterface;

/**
 * Cliente OAuth2 confidencial frente a tmwe_json (Authorization Code + PKCE).
 */
final class OAuthClient
{
    public function __construct(
        private readonly Settings $settings,
        private readonly UpstreamUrl $urls,
        private readonly ClientInterface $http,
    ) {
    }

    /** @return array{verifier: string, challenge: string} */
    public static function newPkce(): array
    {
        $verifier = rtrim(strtr(base64_encode(random_bytes(48)), '+/', '-_'), '=');
        $challenge = rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');

        return ['verifier' => $verifier, 'challenge' => $challenge];
    }

    public function authorizationUrl(string $state, string $challenge): string
    {
        $query = [
            'client_id' => $this->settings->oauthClientId,
            'redirect_uri' => $this->settings->oauthRedirectUri,
            'response_type' => 'code',
            'state' => $state,
            'code_challenge' => $challenge,
            'code_challenge_method' => 'S256',
        ];
        if ($this->settings->oauthScope !== '') {
            $query['scope'] = $this->settings->oauthScope;
        }

        return $this->urls->public('auth', $query);
    }

    public function exchangeCode(string $code, string $verifier, int $now): TokenSet
    {
        return $this->tokenRequest([
            'grant_type' => 'authorization_code',
            'code' => $code,
            'redirect_uri' => $this->settings->oauthRedirectUri,
            'code_verifier' => $verifier,
        ], $now);
    }

    public function refresh(string $refreshToken, int $now): TokenSet
    {
        $tokens = $this->tokenRequest(['grant_type' => 'refresh_token', 'refresh_token' => $refreshToken], $now);

        // Si el servidor no rota el refresh token se conserva el actual.
        return $tokens->refreshToken === ''
            ? new TokenSet($tokens->accessToken, $refreshToken, $tokens->expiresAt, $tokens->refreshExpiresAt)
            : $tokens;
    }

    /** Revocación al cerrar sesión. Un fallo aquí no debe impedir el logout. */
    public function revoke(string $token, string $hint): void
    {
        try {
            $this->http->request('POST', $this->urls->internal('revoke'), [
                'form_params' => [
                    'client_id' => $this->settings->oauthClientId,
                    'client_secret' => $this->settings->oauthClientSecret,
                    'token' => $token,
                    'token_type_hint' => $hint,
                ],
                'http_errors' => false,
            ]);
        } catch (\Throwable) {
            // Se ignora: el token caduca por sí mismo.
        }
    }

    /** @param array<string, string> $params */
    private function tokenRequest(array $params, int $now): TokenSet
    {
        try {
            $response = $this->http->request('POST', $this->urls->internal('token'), [
                'form_params' => $params + [
                    'client_id' => $this->settings->oauthClientId,
                    'client_secret' => $this->settings->oauthClientSecret,
                ],
                'headers' => ['Accept' => 'application/json'],
                'http_errors' => false,
                'allow_redirects' => false,
            ]);
        } catch (\Throwable $e) {
            throw new OAuthException('server_unreachable', 'No se pudo contactar con el servidor de tokens.');
        }

        $payload = json_decode((string) $response->getBody(), true);
        if ($response->getStatusCode() !== 200 || !is_array($payload)) {
            $error = is_array($payload) && is_string($payload['error'] ?? null) ? $payload['error'] : 'invalid_grant';

            throw new OAuthException($error, 'El servidor de tokens rechazó la solicitud.');
        }

        return TokenSet::fromTokenResponse($payload, $now);
    }
}
