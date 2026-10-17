<?php

declare(strict_types=1);

namespace Findair\Bff\Http;

use Findair\Bff\Session\SessionStore;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface as Request;

final class HealthController
{
    public function __construct(private readonly SessionStore $store)
    {
    }

    public function live(Request $request, ResponseInterface $response): ResponseInterface
    {
        return $this->json($response, 200, ['status' => 'ok']);
    }

    public function ready(Request $request, ResponseInterface $response): ResponseInterface
    {
        $ok = $this->store->ping();

        return $this->json($response, $ok ? 200 : 503, ['status' => $ok ? 'ok' : 'degraded', 'checks' => ['session_store' => $ok]]);
    }

    /** @param array<string, mixed> $payload */
    private function json(ResponseInterface $response, int $status, array $payload): ResponseInterface
    {
        $response->getBody()->write(json_encode($payload, JSON_THROW_ON_ERROR));

        return $response->withStatus($status)->withHeader('Content-Type', 'application/json');
    }
}
