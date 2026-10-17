<?php

declare(strict_types=1);

namespace Findair\Bff\Session;

/**
 * Sesión del servidor. El navegador solo conoce el identificador opaco.
 */
final class Session
{
    private bool $dirty = false;
    private bool $destroyed = false;
    private ?string $previousId = null;

    /** @param array<string, mixed> $data */
    public function __construct(
        private string $id,
        private array $data = [],
        private readonly bool $isNew = true,
    ) {
    }

    public static function generateId(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    }

    public static function isValidId(string $id): bool
    {
        return preg_match('/^[A-Za-z0-9_-]{43}$/', $id) === 1;
    }

    public function id(): string
    {
        return $this->id;
    }

    public function isNew(): bool
    {
        return $this->isNew;
    }

    public function get(string $key, mixed $default = null): mixed
    {
        return $this->data[$key] ?? $default;
    }

    public function set(string $key, mixed $value): void
    {
        $this->data[$key] = $value;
        $this->dirty = true;
    }

    /** Actualiza la copia en memoria cuando el almacén ya se escribió por otra vía. */
    public function hydrate(string $key, mixed $value): void
    {
        $this->data[$key] = $value;
    }

    public function forget(string $key): void
    {
        unset($this->data[$key]);
        $this->dirty = true;
    }

    /** @return array<string, mixed> */
    public function all(): array
    {
        return $this->data;
    }

    /** Cambia el identificador y conserva los datos (evita fijación de sesión). */
    public function regenerate(): void
    {
        $this->previousId ??= $this->id;
        $this->id = self::generateId();
        $this->dirty = true;
    }

    public function destroy(): void
    {
        $this->destroyed = true;
    }

    public function isDirty(): bool
    {
        return $this->dirty;
    }

    public function isDestroyed(): bool
    {
        return $this->destroyed;
    }

    public function previousId(): ?string
    {
        return $this->previousId;
    }

    public function isAuthenticated(): bool
    {
        return is_string($this->data['tokens'] ?? null);
    }

    /** Token sincronizado contra CSRF. Se crea al iniciar sesión. */
    public function csrfToken(): string
    {
        $token = $this->data['csrf'] ?? null;
        if (!is_string($token) || $token === '') {
            $token = bin2hex(random_bytes(32));
            $this->set('csrf', $token);
        }

        return $token;
    }
}
