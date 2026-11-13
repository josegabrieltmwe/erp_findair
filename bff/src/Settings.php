<?php

declare(strict_types=1);

namespace Findair\Bff;

use Findair\Bff\Throttle\ThrottlePolicy;

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
        /** Acción de tmwe_json que devuelve {user, capabilities}; vacía = se deducen del perfil. */
        public readonly string $contextAction = '',
        /** @var list<string> acciones (admite `*`) cuyas peticiones que cambian estado se bloquean con 403 */
        public readonly array $denyActions = [],
        /** @var array<string, ThrottlePolicy> políticas de `throttle:` del manifiesto */
        public readonly array $throttlePolicies = [],
        /** @var list<string> IP/CIDR de proxies inversos de confianza; solo ellos pueden fijar X-Forwarded-For */
        public readonly array $trustedProxies = [],
        /** Inactividad tras la que caduca una sesión OTP (la aerolínea rellena un formulario largo). */
        public readonly int $otpSessionIdleTtl = 7200,
        /** Fallos de OTP tolerados por recurso (tipo+id) en la ventana: el OTP es corto, esto es lo que lo protege. */
        public readonly int $otpMaxFailuresPerResource = 8,
        /** Fallos de OTP tolerados por IP en la ventana. */
        public readonly int $otpMaxFailuresPerIp = 20,
        public readonly int $otpFailureWindow = 900,
    ) {
    }

    /** TTL de inactividad de una sesión: las de OTP (sin usuario) tienen el suyo. */
    public function sessionIdleTtlFor(bool $isOtpSession): int
    {
        return $isOtpSession ? $this->otpSessionIdleTtl : $this->sessionIdleTtl;
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
            contextAction: $get('UPSTREAM_CONTEXT_ACTION'),
            denyActions: array_values(array_filter(array_map('trim', explode(',', $get('UPSTREAM_DENY_ACTIONS'))), static fn (string $a): bool => $a !== '')),
            manifestPath: $manifestPath,
            otpSessionIdleTtl: (int) $get('OTP_SESSION_IDLE_TTL', '7200'),
            otpMaxFailuresPerResource: (int) $get('OTP_MAX_FAILURES_PER_RESOURCE', '8'),
            otpMaxFailuresPerIp: (int) $get('OTP_MAX_FAILURES_PER_IP', '20'),
            otpFailureWindow: (int) $get('OTP_FAILURE_WINDOW', '900'),
            trustedProxies: array_values(array_filter(array_map('trim', explode(',', $get('TRUSTED_PROXIES'))), static fn (string $a): bool => $a !== '')),
            throttlePolicies: [
                // Copilot de IA: cada turno cuesta tokens y ocupa un worker hasta 120 s.
                'copilot_chat' => new ThrottlePolicy(
                    ratePerUser: (int) $get('COPILOT_CHAT_RATE_PER_MIN', '20'),
                    ratePerIp: (int) $get('COPILOT_CHAT_RATE_PER_IP_MIN', '60'),
                    concurrencyPerUser: (int) $get('COPILOT_CHAT_MAX_PER_USER', '1'),
                    concurrencyGlobal: (int) $get('COPILOT_CHAT_MAX_GLOBAL', '30'),
                ),
                // Respuesta de una aerolínea (sesión de OTP, sin usuario): la clave del «usuario» es la sesión. Un envío legítimo es
                // uno o dos; el tope frena reintentos en bucle sin molestar a quien corrige un error de validación.
                'otp_submit' => new ThrottlePolicy(
                    ratePerUser: (int) $get('OTP_SUBMIT_RATE_PER_MIN', '10'),
                    ratePerIp: (int) $get('OTP_SUBMIT_RATE_PER_IP_MIN', '30'),
                ),
                // Subidas de ficheros y correos de constancia de una aerolínea (sesión OTP): cada uno escribe en disco o manda un correo.
                'otp_upload' => new ThrottlePolicy(
                    ratePerUser: (int) $get('OTP_UPLOAD_RATE_PER_MIN', '8'),
                    ratePerIp: (int) $get('OTP_UPLOAD_RATE_PER_IP_MIN', '20'),
                    concurrencyPerUser: 1,
                ),
                'otp_mail' => new ThrottlePolicy(
                    ratePerUser: (int) $get('OTP_MAIL_RATE_PER_MIN', '3'),
                    ratePerIp: (int) $get('OTP_MAIL_RATE_PER_IP_MIN', '10'),
                ),
                // Consulta de eventos de la búsqueda de vuelos asíncrona: ~1 por segundo y búsqueda, hasta 3 búsquedas a la vez.
                'copilot_chat_poll' => new ThrottlePolicy(
                    ratePerUser: (int) $get('COPILOT_CHAT_POLL_RATE_PER_MIN', '120'),
                    ratePerIp: (int) $get('COPILOT_CHAT_POLL_RATE_PER_IP_MIN', '360'),
                ),
                // Estado de la sugerencia de IA para plantillas asíncrona: ~1 por segundo mientras se espera.
                'modelli_assist_poll' => new ThrottlePolicy(
                    ratePerUser: (int) $get('MODELLI_ASSIST_POLL_RATE_PER_MIN', '120'),
                    ratePerIp: (int) $get('MODELLI_ASSIST_POLL_RATE_PER_IP_MIN', '360'),
                ),
                // Estado de la tarifa TACT asíncrona: ~1 por segundo mientras se espera.
                'tact_poll' => new ThrottlePolicy(
                    ratePerUser: (int) $get('TACT_POLL_RATE_PER_MIN', '120'),
                    ratePerIp: (int) $get('TACT_POLL_RATE_PER_IP_MIN', '360'),
                ),
                // Estado de las exportaciones a Excel asíncronas: ~1 por segundo mientras se espera.
                'export_poll' => new ThrottlePolicy(
                    ratePerUser: (int) $get('EXPORT_POLL_RATE_PER_MIN', '120'),
                    ratePerIp: (int) $get('EXPORT_POLL_RATE_PER_IP_MIN', '360'),
                ),
                // Estado común de las peticiones asíncronas (R3): ~1 por segundo mientras se espera, pero a
                // diferencia de las políticas anteriores este cupo lo comparten varias funciones sin relación
                // entre sí (reconciliación COD, exportación de facturas, listini): 120/min no deja margen ni
                // para 2 operaciones a la vez (2026-11-13, 429 en el ERP con el fix de api/ ya aplicado). Doble
                // margen para cubrir 2-3 operaciones simultáneas (varias pestañas) sin perder la protección.
                'async_request_poll' => new ThrottlePolicy(
                    ratePerUser: (int) $get('ASYNC_REQUEST_POLL_RATE_PER_MIN', '240'),
                    ratePerIp: (int) $get('ASYNC_REQUEST_POLL_RATE_PER_IP_MIN', '720'),
                ),
                'rate_search_poll' => new ThrottlePolicy(
                    ratePerUser: (int) $get('RATE_SEARCH_POLL_RATE_PER_MIN', '300'),
                    ratePerIp: (int) $get('RATE_SEARCH_POLL_RATE_PER_IP_MIN', '900'),
                ),
                'copilot_confirm' => new ThrottlePolicy(
                    ratePerUser: (int) $get('COPILOT_CONFIRM_RATE_PER_MIN', '30'),
                    ratePerIp: (int) $get('COPILOT_CONFIRM_RATE_PER_IP_MIN', '60'),
                    concurrencyPerUser: (int) $get('COPILOT_CONFIRM_MAX_PER_USER', '1'),
                ),
            ],
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
