<?php

declare(strict_types=1);

namespace Findair\Bff\Throttle;

use Findair\Bff\Settings;

/**
 * Límite de intentos fallidos de OTP, por recurso y por IP.
 *
 * El API no puede hacerlo: su Rate_Limiter_Service no actúa sin APCu y APCu no está instalado. Y el OTP de las ofertas cargo
 * mide 10 caracteres, así que lo que de verdad lo protege es este bloqueo. Es por RECURSO (`tipo:id`) y se cuenta aunque el
 * recurso no exista: un contador que solo existiera para ofertas reales sería un oráculo de existencia.
 *
 * Solo cuentan los FALLOS. Una autorización correcta borra el contador del recurso, para que quien ya entró no se quede
 * fuera; el de la IP sigue. El coste: alguien que acierte el OTP de un recurso tras 7 fallos no queda bloqueado, lo que es
 * justo lo contrario de un ataque útil.
 */
final class OtpAttemptLimiter
{
    public function __construct(
        private readonly CounterStore $store,
        private readonly Settings $settings,
    ) {
    }

    /** @return int|null segundos hasta poder reintentar, o null si no está bloqueado */
    public function lockedFor(string $type, int $id, string $ip): ?int
    {
        $resourceKey = $this->resourceKey($type, $id);
        if ($this->store->get($resourceKey) >= $this->settings->otpMaxFailuresPerResource) {
            return max(1, $this->store->ttl($resourceKey));
        }
        $ipKey = $this->ipKey($ip);
        if ($ip !== '' && $this->store->get($ipKey) >= $this->settings->otpMaxFailuresPerIp) {
            return max(1, $this->store->ttl($ipKey));
        }

        return null;
    }

    public function recordFailure(string $type, int $id, string $ip): void
    {
        $window = max(1, $this->settings->otpFailureWindow);
        $this->store->increment($this->resourceKey($type, $id), $window);
        if ($ip !== '') {
            $this->store->increment($this->ipKey($ip), $window);
        }
    }

    public function recordSuccess(string $type, int $id): void
    {
        $this->store->delete($this->resourceKey($type, $id));
    }

    private function resourceKey(string $type, int $id): string
    {
        return "otp:f:r:{$type}:{$id}";
    }

    private function ipKey(string $ip): string
    {
        return 'otp:f:i:' . substr(hash('sha256', $ip), 0, 20);
    }
}
