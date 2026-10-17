<?php

declare(strict_types=1);

namespace Findair\Bff\Auth;

/**
 * Cifra los tokens antes de guardarlos en el almacén de sesión (XSalsa20-Poly1305).
 * Un volcado de Redis no expone tokens utilizables sin APP_KEY.
 */
final class TokenVault
{
    private readonly string $key;

    public function __construct(string $appKey)
    {
        $raw = str_starts_with($appKey, 'base64:') ? base64_decode(substr($appKey, 7), true) : $appKey;
        if (!is_string($raw) || strlen($raw) !== SODIUM_CRYPTO_SECRETBOX_KEYBYTES) {
            throw new \InvalidArgumentException('APP_KEY debe contener 32 bytes (formato "base64:...").');
        }
        $this->key = $raw;
    }

    public function seal(TokenSet $tokens): string
    {
        $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $cipher = sodium_crypto_secretbox(json_encode($tokens->toArray(), JSON_THROW_ON_ERROR), $nonce, $this->key);

        return rtrim(strtr(base64_encode($nonce . $cipher), '+/', '-_'), '=');
    }

    public function open(string $sealed): ?TokenSet
    {
        $raw = base64_decode(strtr($sealed, '-_', '+/'), true);
        if ($raw === false || strlen($raw) <= SODIUM_CRYPTO_SECRETBOX_NONCEBYTES) {
            return null;
        }
        $nonce = substr($raw, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $plain = sodium_crypto_secretbox_open(substr($raw, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES), $nonce, $this->key);
        if ($plain === false) {
            return null;
        }
        $data = json_decode($plain, true);

        return is_array($data) ? TokenSet::fromArray($data) : null;
    }
}
