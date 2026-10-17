<?php

declare(strict_types=1);

namespace Findair\Bff\Session;

interface SessionStore
{
    /** @return array<string, mixed>|null */
    public function load(string $id): ?array;

    /** @param array<string, mixed> $data */
    public function save(string $id, array $data, int $ttl): void;

    /** Renueva la caducidad sin reescribir los datos. */
    public function touch(string $id, int $ttl): void;

    public function delete(string $id): void;

    /** Devuelve un identificador de propietario si se obtuvo el bloqueo. */
    public function acquireLock(string $name, int $ttlMs): ?string;

    public function releaseLock(string $name, string $owner): void;

    public function ping(): bool;
}
