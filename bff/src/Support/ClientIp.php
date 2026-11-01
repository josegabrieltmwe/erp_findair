<?php

declare(strict_types=1);

namespace Findair\Bff\Support;

use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * IP real del cliente. X-Forwarded-For solo se lee si la conexión llega de un proxy de confianza
 * (lista de IP/CIDR de TRUSTED_PROXIES); si no, es REMOTE_ADDR, porque la cabecera la controla el cliente.
 */
final class ClientIp
{
    /** @param list<string> $trustedProxies IP o CIDR (IPv4/IPv6) */
    public function __construct(private readonly array $trustedProxies = [])
    {
        foreach ($trustedProxies as $entry) {
            if (!self::validEntry($entry)) {
                throw new \InvalidArgumentException("TRUSTED_PROXIES: entrada no válida '{$entry}'.");
            }
        }
    }

    public function resolve(Request $request): string
    {
        $remote = $request->getServerParams()['REMOTE_ADDR'] ?? '';
        $remote = is_string($remote) ? $remote : '';
        if ($remote === '' || !$this->isTrusted($remote)) {
            return $remote;
        }

        // De derecha a izquierda: cada salto de confianza se salta; el primero que no lo es es el cliente.
        $hops = array_reverse(array_map('trim', explode(',', implode(',', $request->getHeader('X-Forwarded-For')))));
        foreach ($hops as $hop) {
            if (filter_var($hop, FILTER_VALIDATE_IP) === false) {
                return $remote; // cabecera malformada: no se fía de nada de ella
            }
            if (!$this->isTrusted($hop)) {
                return $hop;
            }
        }

        return $remote;
    }

    private function isTrusted(string $ip): bool
    {
        foreach ($this->trustedProxies as $entry) {
            if (self::inCidr($ip, $entry)) {
                return true;
            }
        }

        return false;
    }

    private static function validEntry(string $entry): bool
    {
        [$addr, $bits] = array_pad(explode('/', $entry, 2), 2, null);
        $packed = filter_var($addr, FILTER_VALIDATE_IP) !== false ? inet_pton($addr) : false;
        if ($packed === false) {
            return false;
        }

        return $bits === null || (preg_match('/^[0-9]{1,3}$/', $bits) === 1 && (int) $bits <= strlen($packed) * 8);
    }

    private static function inCidr(string $ip, string $entry): bool
    {
        [$addr, $bits] = array_pad(explode('/', $entry, 2), 2, null);
        $a = inet_pton($ip);
        $b = inet_pton((string) $addr);
        if ($a === false || $b === false || strlen($a) !== strlen($b)) {
            return false;
        }
        $bits = $bits === null ? strlen($b) * 8 : (int) $bits;
        $bytes = intdiv($bits, 8);
        if ($bytes > 0 && substr($a, 0, $bytes) !== substr($b, 0, $bytes)) {
            return false;
        }
        $rest = $bits % 8;
        if ($rest === 0) {
            return true;
        }
        $mask = (0xFF << (8 - $rest)) & 0xFF;

        return (ord($a[$bytes]) & $mask) === (ord($b[$bytes]) & $mask);
    }
}
