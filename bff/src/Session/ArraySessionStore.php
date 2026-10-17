<?php

declare(strict_types=1);

namespace Findair\Bff\Session;

/**
 * Almacén en memoria para pruebas y desarrollo de un solo proceso.
 */
final class ArraySessionStore implements SessionStore
{
    /** @var array<string, array<string, mixed>> */
    private array $sessions = [];

    /** @var array<string, string> */
    private array $locks = [];

    public function load(string $id): ?array
    {
        return $this->sessions[$id] ?? null;
    }

    public function save(string $id, array $data, int $ttl): void
    {
        $this->sessions[$id] = $data;
    }

    public function touch(string $id, int $ttl): void
    {
    }

    public function delete(string $id): void
    {
        unset($this->sessions[$id]);
    }

    public function acquireLock(string $name, int $ttlMs): ?string
    {
        if (isset($this->locks[$name])) {
            return null;
        }
        $this->locks[$name] = bin2hex(random_bytes(8));

        return $this->locks[$name];
    }

    public function releaseLock(string $name, string $owner): void
    {
        if (($this->locks[$name] ?? null) === $owner) {
            unset($this->locks[$name]);
        }
    }

    public function ping(): bool
    {
        return true;
    }
}
