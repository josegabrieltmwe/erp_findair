<?php

declare(strict_types=1);

namespace Findair\Bff\Support;

use Psr\Http\Message\ResponseInterface;
use Slim\Psr7\Response;

/**
 * Respuestas de error en application/problem+json (RFC 9457).
 */
final class ProblemDetails
{
    /**
     * @param array<string, mixed> $extra
     * @param array<string, string> $headers
     */
    public static function response(
        int $status,
        string $code,
        string $title,
        ?string $detail = null,
        ?string $requestId = null,
        array $extra = [],
        array $headers = [],
    ): ResponseInterface {
        $body = [
            'type' => 'urn:findair:bff:error:' . $code,
            'title' => $title,
            'status' => $status,
            'code' => $code,
        ];
        if ($detail !== null) {
            $body['detail'] = $detail;
        }
        if ($requestId !== null) {
            $body['request_id'] = $requestId;
        }

        $response = new Response($status);
        $response->getBody()->write(json_encode($body + $extra, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
        $response = $response->withHeader('Content-Type', 'application/problem+json; charset=utf-8');
        foreach ($headers as $name => $value) {
            $response = $response->withHeader($name, $value);
        }

        return $response;
    }
}
