<?php

declare(strict_types=1);

namespace Findair\Bff\Throttle;

/** Solo para pruebas y desarrollo de un solo proceso. Reloj inyectable para probar la caducidad. */
final class ArrayCounterStore implements CounterStore
{
    /** @var array<string, array{int, int}> clave => [valor, caduca] */
    private array $counters = [];

    /** @var array<string, array<string, int>> clave => [token => caduca] */
    private array $slots = [];

    private int $seq = 0;

    /** @var \Closure():int */
    private \Closure $clock;

    /** @param (\Closure():int)|null $clock */
    public function __construct(?\Closure $clock = null)
    {
        $this->clock = $clock ?? static fn (): int => time();
    }

    public function increment(string $key, int $ttlSeconds): int
    {
        $this->expire($key);
        if (!isset($this->counters[$key])) {
            $this->counters[$key] = [0, ($this->clock)() + $ttlSeconds];
        }
        $this->counters[$key][0]++;

        return $this->counters[$key][0];
    }

    public function ttl(string $key): int
    {
        $this->expire($key);

        return isset($this->counters[$key]) ? max(0, $this->counters[$key][1] - ($this->clock)()) : 0;
    }

    public function acquire(string $key, int $max, int $ttlSeconds): ?string
    {
        $now = ($this->clock)();
        $this->slots[$key] = array_filter($this->slots[$key] ?? [], static fn (int $exp): bool => $exp > $now);
        if (count($this->slots[$key]) >= $max) {
            return null;
        }
        $token = 't' . ++$this->seq;
        $this->slots[$key][$token] = $now + $ttlSeconds;

        return $token;
    }

    public function release(string $key, string $token): void
    {
        unset($this->slots[$key][$token]);
    }

    public function value(string $key): int
    {
        $now = ($this->clock)();

        return count(array_filter($this->slots[$key] ?? [], static fn (int $exp): bool => $exp > $now));
    }

    private function expire(string $key): void
    {
        if (isset($this->counters[$key]) && $this->counters[$key][1] <= ($this->clock)()) {
            unset($this->counters[$key]);
        }
    }
}
