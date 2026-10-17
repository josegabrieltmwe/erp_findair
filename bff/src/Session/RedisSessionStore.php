<?php

declare(strict_types=1);

namespace Findair\Bff\Session;

use Predis\ClientInterface;

final class RedisSessionStore implements SessionStore
{
    private const RELEASE_LUA = <<<'LUA'
if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end
LUA;

    public function __construct(private readonly ClientInterface $redis, private readonly string $prefix = 'bff:')
    {
    }

    public function load(string $id): ?array
    {
        $raw = $this->redis->get($this->prefix . 'sess:' . $id);
        if (!is_string($raw)) {
            return null;
        }
        $data = json_decode($raw, true);

        return is_array($data) ? $data : null;
    }

    public function save(string $id, array $data, int $ttl): void
    {
        $this->redis->setex($this->prefix . 'sess:' . $id, $ttl, json_encode($data, JSON_THROW_ON_ERROR));
    }

    public function touch(string $id, int $ttl): void
    {
        $this->redis->expire($this->prefix . 'sess:' . $id, $ttl);
    }

    public function delete(string $id): void
    {
        $this->redis->del([$this->prefix . 'sess:' . $id]);
    }

    public function acquireLock(string $name, int $ttlMs): ?string
    {
        $owner = bin2hex(random_bytes(8));
        $ok = $this->redis->set($this->prefix . 'lock:' . $name, $owner, 'PX', $ttlMs, 'NX');

        return $ok !== null && (string) $ok === 'OK' ? $owner : null;
    }

    public function releaseLock(string $name, string $owner): void
    {
        $this->redis->eval(self::RELEASE_LUA, 1, $this->prefix . 'lock:' . $name, $owner);
    }

    public function ping(): bool
    {
        try {
            $this->redis->ping();

            return true;
        } catch (\Throwable) {
            return false;
        }
    }
}
