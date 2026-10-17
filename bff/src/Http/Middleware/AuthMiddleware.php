<?php

declare(strict_types=1);

namespace Findair\Bff\Http\Middleware;

use Findair\Bff\Auth\TokenRefresher;
use Findair\Bff\Session\Session;
use Findair\Bff\Support\ProblemDetails;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as Handler;

/**
 * Exige sesión con tokens y los refresca antes de que caduquen.
 */
final class AuthMiddleware implements MiddlewareInterface
{
    public function __construct(private readonly TokenRefresher $refresher)
    {
    }

    public function process(Request $request, Handler $handler): ResponseInterface
    {
        $requestId = (string) $request->getAttribute('request_id', '');
        $session = $request->getAttribute('session');

        if (!$session instanceof Session || !$session->isAuthenticated()) {
            return ProblemDetails::response(401, 'unauthenticated', 'Sesión no iniciada', 'Inicie sesión para continuar.', $requestId);
        }

        $tokens = $this->refresher->ensureFresh($session, time());
        if ($tokens === null) {
            $session->destroy();

            return ProblemDetails::response(401, 'session_expired', 'Sesión no válida', 'Vuelva a iniciar sesión.', $requestId);
        }

        return $handler->handle($request->withAttribute('tokens', $tokens));
    }
}
