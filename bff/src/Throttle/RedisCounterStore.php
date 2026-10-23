<?php

declare(strict_types=1);

namespace Findair\Bff\Throttle;

use Predis\ClientInterface;

final class RedisCounterStore implements CounterStore
{
    private const INCREMENT_LUA = <<<'LUA'
local v = redis.call('INCR', KEYS[1])
if v == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return v
LUA;

    // Conjunto ordenado: miembro = token del hueco, puntuación = instante de caducidad. Cada hueco caduca solo.
    private const ACQUIRE_LUA = <<<'LUA'
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[2]) then return 0 end
redis.call('ZADD', KEYS[1], tonumber(ARGV[1]) + tonumber(ARGV[3]), ARGV[4])
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]) + 5)
return 1
LUA;

    private const RELEASE_LUA = <<<'LUA'
return redis.call('ZREM', KEYS[1], ARGV[1])
LUA;

    public function __construct(private readonly ClientInterface $redis, private readonly string $prefix = 'bff:thr:')
    {
    }

    public function increment(string $key, int $ttlSeconds): int
    {
        return (int) $this->redis->eval(self::INCREMENT_LUA, 1, $this->prefix . $key, (string) $ttlSeconds);
    }

    public function ttl(string $key): int
    {
        return max(0, (int) $this->redis->ttl($this->prefix . $key));
    }

    public function acquire(string $key, int $max, int $ttlSeconds): ?string
    {
        $token = bin2hex(random_bytes(8));
        $ok = (int) $this->redis->eval(self::ACQUIRE_LUA, 1, $this->prefix . $key, (string) time(), (string) $max, (string) $ttlSeconds, $token) === 1;

        return $ok ? $token : null;
    }

    public function release(string $key, string $token): void
    {
        $this->redis->eval(self::RELEASE_LUA, 1, $this->prefix . $key, $token);
    }
}
