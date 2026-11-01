<?php

declare(strict_types=1);

namespace Findair\Bff\Impersonation;

use Psr\Http\Message\ResponseInterface;
use Psr\Log\LoggerInterface;

/** B1/C11: con suplantación, el backend debe confirmar con X-Effective-Partner-Id que atendió como el partner pedido. */
final class EffectivePartner
{
    public const HEADER = 'X-Effective-Partner-Id';

    /** La cabecera debe existir, ser única y valer exactamente el partner suplantado. */
    public static function matches(ResponseInterface $upstream, int $expected): bool
    {
        $values = $upstream->getHeader(self::HEADER);

        return count($values) === 1 && preg_match('/^[0-9]{1,18}$/', trim($values[0])) === 1 && (int) trim($values[0]) === $expected;
    }

    /** ¿Es una respuesta que lleva datos de negocio y por tanto debe confirmarse? (no 204/3xx/errores ni binario/stream). */
    public static function isCheckable(ResponseInterface $upstream, bool $jsonRoute): bool
    {
        $status = $upstream->getStatusCode();

        return $jsonRoute && $status >= 200 && $status < 300 && $status !== 204;
    }

    public static function logMismatch(LoggerInterface $logger, string $route, int $expected, ResponseInterface $upstream, string $requestId): void
    {
        $logger->error('effective_partner_mismatch', [
            'route' => $route,
            'expected_partner_id' => $expected,
            'received' => $upstream->hasHeader(self::HEADER) ? mb_substr($upstream->getHeaderLine(self::HEADER), 0, 20) : null,
            'request_id' => $requestId,
        ]);
    }
}
