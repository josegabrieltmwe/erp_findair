<?php

declare(strict_types=1);

namespace Findair\Bff\Throttle;

use Findair\Bff\Settings;
use Findair\Bff\Support\ProblemDetails;
use Psr\Log\LoggerInterface;

/**
 * Rate limit y límite de concurrencia por ruta (`throttle:` del manifiesto). Todo el estado vive en
 * Valkey con operaciones atómicas; si el almacén falla se rechaza (503), porque las rutas protegidas
 * son las que cuestan dinero (IA) o ejecutan escrituras.
 */
final class Throttler
{
    public function __construct(
        private readonly CounterStore $store,
        private readonly Settings $settings,
        private readonly LoggerInterface $logger,
    ) {
    }

    /**
     * @param string $userKey identidad estable del usuario (nunca el token)
     * @param int $holdSeconds tiempo máximo de la petición; caduca el hueco si el worker muere
     */
    public function enter(string $policyName, string $userKey, string $ip, string $requestId, int $holdSeconds): Lease
    {
        $policy = $this->settings->throttlePolicies[$policyName] ?? null;
        if ($policy === null) {
            throw new \LogicException("Política de límites desconocida: {$policyName}");
        }
        $user = substr(hash('sha256', $userKey), 0, 20);
        $slots = [];

        try {
            $window = max(1, $policy->windowSeconds);
            $bucket = intdiv(time(), $window);

            if ($policy->ratePerUser > 0) {
                $key = "rl:{$policyName}:u:{$user}:{$bucket}";
                if ($this->store->increment($key, $window + 5) > $policy->ratePerUser) {
                    return $this->limited('rate_limited', 'Demasiadas solicitudes', $policyName, 'user', $requestId, $this->store->ttl($key), 429);
                }
            }
            if ($policy->ratePerIp > 0 && $ip !== '') {
                $key = "rl:{$policyName}:i:" . substr(hash('sha256', $ip), 0, 20) . ":{$bucket}";
                if ($this->store->increment($key, $window + 5) > $policy->ratePerIp) {
                    return $this->limited('rate_limited', 'Demasiadas solicitudes', $policyName, 'ip', $requestId, $this->store->ttl($key), 429);
                }
            }

            $ttl = max(5, $holdSeconds) + 30;
            if ($policy->concurrencyPerUser > 0) {
                $key = "cc:{$policyName}:u:{$user}";
                $token = $this->store->acquire($key, $policy->concurrencyPerUser, $ttl);
                if ($token === null) {
                    return $this->limited('concurrency_limited', 'Ya hay una petición en curso', $policyName, 'user', $requestId, 3, 429);
                }
                $slots[] = [$key, $token];
            }
            if ($policy->concurrencyGlobal > 0) {
                $key = "cc:{$policyName}:global";
                $token = $this->store->acquire($key, $policy->concurrencyGlobal, $ttl);
                if ($token === null) {
                    $this->release($slots);

                    return $this->limited('capacity_exceeded', 'Servicio ocupado', $policyName, 'global', $requestId, 5, 503);
                }
                $slots[] = [$key, $token];
            }
        } catch (\Throwable $e) {
            $this->release($slots);
            $this->logger->error('throttle_store_failed', ['policy' => $policyName, 'error' => $e::class, 'request_id' => $requestId]);

            return Lease::rejected(ProblemDetails::response(503, 'throttle_unavailable', 'Servicio no disponible', 'No se pudo comprobar el límite de uso.', $requestId, [], ['Retry-After' => '5']));
        }

        return Lease::granted($slots, $this->store);
    }

    /** @param list<array{string, string}> $slots */
    private function release(array $slots): void
    {
        foreach ($slots as [$key, $token]) {
            try {
                $this->store->release($key, $token);
            } catch (\Throwable) {
                // El hueco caduca solo (ttl); no se enmascara el error original.
            }
        }
    }

    private function limited(string $code, string $title, string $policy, string $scope, string $requestId, int $retryAfter, int $status): Lease
    {
        $retryAfter = max(1, $retryAfter);
        $this->logger->warning('throttled', ['policy' => $policy, 'scope' => $scope, 'code' => $code, 'request_id' => $requestId]);

        return Lease::rejected(ProblemDetails::response(
            $status,
            $code,
            $title,
            'Espere unos segundos y vuelva a intentarlo.',
            $requestId,
            ['scope' => $scope],
            ['Retry-After' => (string) $retryAfter],
        ));
    }
}
