<?php

declare(strict_types=1);

namespace Findair\Bff\Throttle;

/**
 * Contadores compartidos entre procesos (Valkey/Redis). Nunca en memoria del proceso en producción:
 * mod_php tiene un proceso por worker y un contador local no limitaría nada.
 */
interface CounterStore
{
    /** INCR atómico; la caducidad se fija al crear la clave (ventana fija). Devuelve el valor tras incrementar. */
    public function increment(string $key, int $ttlSeconds): int;

    /** Segundos que le quedan a la clave (para Retry-After); 0 si no existe. */
    public function ttl(string $key): int;

    /**
     * Toma un hueco de concurrencia si hay menos de $max vivos. Atómico. Cada hueco caduca por sí solo a los
     * $ttlSeconds (aunque la clave reciba tráfico continuo), así un worker muerto no lo bloquea para siempre.
     * Devuelve el token del hueco, o null si no hay sitio.
     */
    public function acquire(string $key, int $max, int $ttlSeconds): ?string;

    /** Devuelve el hueco de ese token; si ya caducó o no existe no toca los de otras peticiones. */
    public function release(string $key, string $token): void;
}
