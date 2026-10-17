<?php

declare(strict_types=1);

namespace Findair\Bff\Auth;

final class TokenSet
{
    public function __construct(
        public readonly string $accessToken,
        public readonly string $refreshToken,
        public readonly int $expiresAt,
        public readonly ?int $refreshExpiresAt = null,
    ) {
    }

    /** @param array<string, mixed> $payload respuesta del endpoint token */
    public static function fromTokenResponse(array $payload, int $now): self
    {
        $access = $payload['access_token'] ?? null;
        $refresh = $payload['refresh_token'] ?? '';
        if (!is_string($access) || $access === '') {
            throw new OAuthException('invalid_response', 'La respuesta del servidor de tokens no incluye access_token.');
        }

        $refreshTtl = $payload['refresh_token_expires_in'] ?? null;

        return new self(
            $access,
            is_string($refresh) ? $refresh : '',
            $now + max(0, (int) ($payload['expires_in'] ?? 0)),
            is_numeric($refreshTtl) ? $now + (int) $refreshTtl : null,
        );
    }

    public function expiresWithin(int $seconds, int $now): bool
    {
        return $this->expiresAt - $now <= $seconds;
    }

    public function canRefresh(int $now): bool
    {
        return $this->refreshToken !== ''
            && ($this->refreshExpiresAt === null || $this->refreshExpiresAt > $now);
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'a' => $this->accessToken,
            'r' => $this->refreshToken,
            'e' => $this->expiresAt,
            're' => $this->refreshExpiresAt,
        ];
    }

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): ?self
    {
        if (!is_string($data['a'] ?? null) || !is_string($data['r'] ?? null) || !is_int($data['e'] ?? null)) {
            return null;
        }

        return new self($data['a'], $data['r'], $data['e'], is_int($data['re'] ?? null) ? $data['re'] : null);
    }
}
