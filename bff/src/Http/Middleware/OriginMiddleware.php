<?php

declare(strict_types=1);

namespace Findair\Bff\Http\Middleware;

use Findair\Bff\Settings;
use Findair\Bff\Support\ProblemDetails;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as Handler;

/**
 * Defensa en profundidad contra CSRF: los métodos que cambian estado solo se
 * aceptan desde el origen de la SPA (Origin y Sec-Fetch-Site).
 */
final class OriginMiddleware implements MiddlewareInterface
{
    public function __construct(private readonly Settings $settings)
    {
    }

    public function process(Request $request, Handler $handler): ResponseInterface
    {
        if (in_array($request->getMethod(), ['GET', 'HEAD', 'OPTIONS'], true)) {
            return $handler->handle($request);
        }

        $requestId = (string) $request->getAttribute('request_id', '');
        $fetchSite = $request->getHeaderLine('Sec-Fetch-Site');
        if ($fetchSite !== '' && !in_array($fetchSite, ['same-origin', 'none'], true)) {
            return ProblemDetails::response(403, 'origin_not_allowed', 'Origen no permitido', null, $requestId);
        }

        $origin = $request->getHeaderLine('Origin');
        if ($origin === '' || !in_array($origin, $this->settings->allowedOrigins(), true)) {
            return ProblemDetails::response(403, 'origin_not_allowed', 'Origen no permitido', null, $requestId);
        }

        return $handler->handle($request);
    }
}
