<?php

declare(strict_types=1);

namespace Findair\Bff;

/**
 * Configuración tipada. Se construye una sola vez a partir del entorno.
 */
final class Settings
{
    public function __construct(
        public readonly string $env,
        public readonly string $appUrl,
        public readonly string $appKey,
        public readonly string $redisDsn,
        public readonly string $cookieName,
        public readonly int $sessionIdleTtl,
        public readonly int $sessionAbsoluteTtl,
        public readonly string $upstreamBaseUrl,
        public readonly string $upstreamPublicUrl,
        public readonly float $upstreamTimeout,
        public readonly float $upstreamConnectTimeout,
        public readonly string $oauthClientId,
        public readonly string $oauthClientSecret,
        public readonly string $oauthRedirectUri,
        public readonly string $oauthScope,
        public readonly string $manifestPath,
    ) {
    }

    /** @param array<string, mixed> $env */
    public static function fromEnv(array $env, string $manifestPath): self
    {
        $get = static function (string $key, string $default = '') use ($env): string {
            $value = $env[$key] ?? getenv($key);

            return is_string($value) && $value !== '' ? $value : $default;
        };

        $appUrl = rtrim($get('APP_URL', 'http://localhost:8080'), '/');
        $cookie = $get('SESSION_COOKIE', '__Host-sid');
        if (!str_starts_with($appUrl, 'https://') && str_starts_with($cookie, '__Host-')) {
            // El prefijo __Host- exige Secure; sin HTTPS (desarrollo) el navegador la descartaría.
            $cookie = 'sid';
        }

        return new self(
            env: $get('APP_ENV', 'production'),
            appUrl: $appUrl,
            appKey: $get('APP_KEY'),
            redisDsn: $get('REDIS_DSN', 'tcp://127.0.0.1:6379'),
            cookieName: $cookie,
            sessionIdleTtl: (int) $get('SESSION_IDLE_TTL', '1800'),
            sessionAbsoluteTtl: (int) $get('SESSION_ABSOLUTE_TTL', '43200'),
            upstreamBaseUrl: $get('UPSTREAM_BASE_URL'),
            upstreamPublicUrl: $get('UPSTREAM_PUBLIC_URL', $get('UPSTREAM_BASE_URL')),
            upstreamTimeout: (float) $get('UPSTREAM_TIMEOUT', '15'),
            upstreamConnectTimeout: (float) $get('UPSTREAM_CONNECT_TIMEOUT', '3'),
            oauthClientId: $get('OAUTH_CLIENT_ID'),
            oauthClientSecret: $get('OAUTH_CLIENT_SECRET'),
            oauthRedirectUri: $get('OAUTH_REDIRECT_URI', $appUrl . '/bff/auth/callback'),
            oauthScope: $get('OAUTH_SCOPE'),
            manifestPath: $manifestPath,
        );
    }

    public function isSecureCookie(): bool
    {
        return str_starts_with($this->appUrl, 'https://');
    }

    /** @return list<string> */
    public function allowedOrigins(): array
    {
        return [$this->appUrl];
    }
}
