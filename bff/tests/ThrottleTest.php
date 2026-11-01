<?php

declare(strict_types=1);

namespace Findair\Bff\Tests;

use Findair\Bff\Settings;
use Findair\Bff\Throttle\ArrayCounterStore;
use Findair\Bff\Throttle\CounterStore;
use Findair\Bff\Throttle\ThrottlePolicy;
use Findair\Bff\Throttle\Throttler;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

final class ThrottleTest extends TestCase
{
    private int $now = 1_000_000;

    private function store(): ArrayCounterStore
    {
        return new ArrayCounterStore(fn (): int => $this->now);
    }

    private function throttler(CounterStore $store, ThrottlePolicy $policy): Throttler
    {
        $settings = Settings::fromEnv([], '/dev/null');
        $withPolicy = new Settings(
            $settings->env,
            $settings->appUrl,
            $settings->appKey,
            $settings->redisDsn,
            $settings->cookieName,
            $settings->sessionIdleTtl,
            $settings->sessionAbsoluteTtl,
            $settings->upstreamBaseUrl,
            $settings->upstreamPublicUrl,
            $settings->upstreamTimeout,
            $settings->upstreamConnectTimeout,
            $settings->oauthClientId,
            $settings->oauthClientSecret,
            $settings->oauthRedirectUri,
            $settings->oauthScope,
            $settings->manifestPath,
            throttlePolicies: ['p' => $policy],
        );

        return new Throttler($store, $withPolicy, new NullLogger());
    }

    public function testIncrementIsMonotonicAndExpires(): void
    {
        $store = $this->store();

        self::assertSame(1, $store->increment('k', 60));
        self::assertSame(2, $store->increment('k', 60));
        self::assertSame(60, $store->ttl('k'));
        $this->now += 61;
        self::assertSame(1, $store->increment('k', 60), 'ventana nueva tras la caducidad');
    }

    public function testAcquireNeverExceedsMaxAndReleaseIsOwnerAware(): void
    {
        $store = $this->store();

        $t1 = $store->acquire('c', 2, 30);
        $t2 = $store->acquire('c', 2, 30);
        self::assertNotNull($t1);
        self::assertNotNull($t2);
        self::assertNull($store->acquire('c', 2, 30));
        self::assertSame(2, $store->value('c'), 'el intento fallido no deja huella');
        $store->release('c', $t1);
        $store->release('c', $t1);
        self::assertSame(1, $store->value('c'), 'soltar dos veces el mismo token no libera el de otro');
        self::assertNotNull($store->acquire('c', 2, 30));
        $store->release('c', 'inexistente');
        self::assertSame(2, $store->value('c'));
    }

    public function testLeakedSlotSelfHealsByTtl(): void
    {
        $store = $this->store();
        $store->acquire('c', 1, 30);
        self::assertNull($store->acquire('c', 1, 30));
        $this->now += 31;
        self::assertNotNull($store->acquire('c', 1, 30), 'un worker muerto no bloquea para siempre');
    }

    public function testLeakedSlotExpiresEvenWithContinuousTrafficOnTheKey(): void
    {
        $store = $this->store();
        $leaked = $store->acquire('g', 2, 30);
        self::assertNotNull($leaked);
        for ($i = 0; $i < 10; $i++) {
            $this->now += 10;
            $t = $store->acquire('g', 2, 30);
            self::assertNotNull($t, "iteración {$i}: el hueco huérfano debe caducar aunque haya tráfico");
            $store->release('g', $t);
        }
        self::assertSame(0, $store->value('g'));
    }

    public function testExpiredSlotReleaseDoesNotFreeAnotherRequestsSlot(): void
    {
        $store = $this->store();
        $old = $store->acquire('c', 1, 30);
        $this->now += 31;
        self::assertNotNull($store->acquire('c', 1, 30));
        $store->release('c', (string) $old);
        self::assertNull($store->acquire('c', 1, 30), 'el release tardío del primero no libera el hueco del segundo');
    }

    public function testThrottlerEnforcesUserRateAndRetryAfterIsPositive(): void
    {
        $throttler = $this->throttler($this->store(), new ThrottlePolicy(ratePerUser: 2));

        self::assertNull($throttler->enter('p', 'u1', '1.1.1.1', 'r', 10)->rejection);
        self::assertNull($throttler->enter('p', 'u1', '1.1.1.1', 'r', 10)->rejection);
        $denied = $throttler->enter('p', 'u1', '1.1.1.1', 'r', 10)->rejection;

        self::assertNotNull($denied);
        self::assertSame(429, $denied->getStatusCode());
        self::assertGreaterThanOrEqual(1, (int) $denied->getHeaderLine('Retry-After'));
        self::assertNull($throttler->enter('p', 'u2', '1.1.1.1', 'r', 10)->rejection, 'otro usuario no afectado');
    }

    public function testThrottlerConcurrencyAndLeaseRelease(): void
    {
        $throttler = $this->throttler($this->store(), new ThrottlePolicy(concurrencyPerUser: 1, concurrencyGlobal: 2));

        $a = $throttler->enter('p', 'u1', '', 'r', 10);
        self::assertNull($a->rejection);
        self::assertSame(429, $throttler->enter('p', 'u1', '', 'r', 10)->rejection?->getStatusCode());
        $b = $throttler->enter('p', 'u2', '', 'r', 10);
        self::assertNull($b->rejection);
        $c = $throttler->enter('p', 'u3', '', 'r', 10)->rejection;
        self::assertSame(503, $c?->getStatusCode(), 'tope global');

        $a->release();
        self::assertNull($throttler->enter('p', 'u3', '', 'r', 10)->rejection);
    }

    public function testUnknownPolicyFailsLoudly(): void
    {
        $this->expectException(\LogicException::class);
        $this->throttler($this->store(), new ThrottlePolicy())->enter('nope', 'u', '', 'r', 10);
    }

    public function testStoreFailureRejectsWith503AndReleasesAcquiredSlots(): void
    {
        $inner = $this->store();
        $failing = new class ($inner) implements CounterStore {
            private int $acquires = 0;

            public function __construct(private readonly ArrayCounterStore $inner)
            {
            }

            public function increment(string $key, int $ttlSeconds): int
            {
                return $this->inner->increment($key, $ttlSeconds);
            }

            public function ttl(string $key): int
            {
                return $this->inner->ttl($key);
            }

            public function acquire(string $key, int $max, int $ttlSeconds): ?string
            {
                if (++$this->acquires === 2) {
                    throw new \RuntimeException('valkey caído');
                }

                return $this->inner->acquire($key, $max, $ttlSeconds);
            }

            public function release(string $key, string $token): void
            {
                $this->inner->release($key, $token);
            }
        };
        $throttler = $this->throttler($failing, new ThrottlePolicy(concurrencyPerUser: 1, concurrencyGlobal: 5));

        $response = $throttler->enter('p', 'u1', '', 'r', 10)->rejection;

        self::assertNotNull($response);
        self::assertSame(503, $response->getStatusCode());
        self::assertStringContainsString('throttle_unavailable', (string) $response->getBody());
        self::assertNotSame('', $response->getHeaderLine('Retry-After'));
        $userKey = 'cc:p:u:' . substr(hash('sha256', 'u1'), 0, 20);
        self::assertSame(0, $inner->value($userKey), 'el hueco de usuario se devolvió');
    }
}
