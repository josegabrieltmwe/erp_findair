<?php

declare(strict_types=1);

namespace Findair\Bff\Http\Middleware;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as Handler;

/**
 * Identificador por petición y traceparent (W3C Trace Context) hacia el backend.
 */
final class RequestIdMiddleware implements MiddlewareInterface
{
    public function process(Request $request, Handler $handler): ResponseInterface
    {
        $requestId = bin2hex(random_bytes(8));
        $incoming = $request->getHeaderLine('traceparent');
        $traceId = preg_match('/^00-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/', $incoming, $m) === 1 && $m[1] !== str_repeat('0', 32)
            ? $m[1]
            : bin2hex(random_bytes(16));
        $traceparent = sprintf('00-%s-%s-01', $traceId, bin2hex(random_bytes(8)));

        $response = $handler->handle($request->withAttribute('request_id', $requestId)->withAttribute('traceparent', $traceparent));

        return $response->withHeader('X-Request-Id', $requestId);
    }
}
