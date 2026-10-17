<?php

declare(strict_types=1);

namespace Findair\Bff\Http;

use Findair\Bff\Session\Session;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * Patrón de token sincronizado: la SPA lee el token de GET /bff/auth/session y
 * lo envía en X-CSRF-Token en cada petición que cambia estado.
 */
final class CsrfGuard
{
    public function tokenIsValid(Request $request, Session $session): bool
    {
        $expected = $session->get('csrf');
        $given = $request->getHeaderLine('X-CSRF-Token');

        return is_string($expected) && $expected !== '' && $given !== '' && hash_equals($expected, $given);
    }
}
