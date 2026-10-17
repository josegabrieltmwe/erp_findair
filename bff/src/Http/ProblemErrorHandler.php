<?php

declare(strict_types=1);

namespace Findair\Bff\Http;

use Findair\Bff\Support\ProblemDetails;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Log\LoggerInterface;
use Slim\Exception\HttpException;
use Slim\Exception\HttpMethodNotAllowedException;
use Slim\Exception\HttpNotFoundException;

/**
 * Toda excepción sale como application/problem+json, sin trazas ni rutas internas.
 */
final class ProblemErrorHandler
{
    public function __construct(private readonly LoggerInterface $logger)
    {
    }

    public function __invoke(Request $request, \Throwable $e): ResponseInterface
    {
        $requestId = (string) $request->getAttribute('request_id', '');

        if ($e instanceof HttpNotFoundException) {
            return ProblemDetails::response(404, 'route_not_found', 'Ruta no encontrada', null, $requestId);
        }
        if ($e instanceof HttpMethodNotAllowedException) {
            return ProblemDetails::response(405, 'method_not_allowed', 'Método no permitido', null, $requestId, [], ['Allow' => implode(', ', $e->getAllowedMethods())]);
        }
        if ($e instanceof HttpException) {
            return ProblemDetails::response($e->getCode() ?: 500, 'http_error', $e->getTitle(), null, $requestId);
        }

        $this->logger->error('unhandled_exception', ['class' => $e::class, 'message' => $e->getMessage(), 'file' => $e->getFile(), 'line' => $e->getLine(), 'request_id' => $requestId]);

        return ProblemDetails::response(500, 'internal_error', 'Error interno', null, $requestId);
    }
}
