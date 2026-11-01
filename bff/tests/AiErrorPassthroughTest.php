<?php

declare(strict_types=1);

namespace Findair\Bff\Tests;

use GuzzleHttp\Psr7\Response as UpstreamResponse;
use PHPUnit\Framework\Attributes\DataProvider;

/** Los fallos de IA del copilot conservan su código AI_* (503/504/429/502) sin filtrar mensajes del backend. */
final class AiErrorPassthroughTest extends AppTestCase
{
    /**
     * @param array<string, string> $headers
     * @return array{\Psr\Http\Message\ResponseInterface, array<string, mixed>}
     */
    private function post(string $path, int $status, string $body, array $headers = []): array
    {
        $this->boot([new UpstreamResponse($status, ['Content-Type' => 'application/json'] + $headers, $body)]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('POST', '/bff/v1' . $path, $sid, $this->unsafeHeaders(), '{}'));

        return [$response, $this->json($response)];
    }

    /** @return array<string, array{int, string, int}> */
    public static function aiErrors(): array
    {
        return [
            'credenciales invalidas 503' => [503, 'AI_CREDENTIALS_INVALID', 503],
            'credenciales ausentes 503' => [503, 'AI_CREDENTIALS_MISSING', 503],
            'no disponible 503' => [503, 'AI_UNAVAILABLE', 503],
            'timeout 504' => [504, 'AI_TIMEOUT', 504],
            'presupuesto 429' => [429, 'AI_BUDGET_EXCEEDED', 429],
            'proveedor 502' => [502, 'AI_PROVIDER_ERROR', 502],
            'protocolo 500 -> 502' => [500, 'AI_PROTOCOL_UNSUPPORTED', 502],
        ];
    }

    #[DataProvider('aiErrors')]
    public function testCopilotAiErrorKeepsCodeAndCoherentStatus(int $upstream, string $code, int $expected): void
    {
        [$response, $json] = $this->post('/copilot_chat', $upstream, json_encode(['error' => true, 'error_code' => $code, 'message' => 'x'], JSON_THROW_ON_ERROR));

        self::assertSame($expected, $response->getStatusCode());
        self::assertSame($code, $json['code']);
        self::assertSame($code, $json['error_code']);
        self::assertSame($expected, $json['status']);
        self::assertStringStartsWith('application/problem+json', $response->getHeaderLine('Content-Type'));
        self::assertArrayHasKey('request_id', $json);
        self::assertNotSame('upstream_error', $json['code']);
        self::assertNotSame('rate_limited', $json['code']);
    }

    public function testBackendMessageAndInternalsAreNeverForwarded(): void
    {
        $leak = 'sk-ant-SECRET-123 host=db.internal stack at /var/www/x.php:12';
        [, $json] = $this->post('/copilot_chat', 503, json_encode([
            'error' => true, 'error_code' => 'AI_CREDENTIALS_INVALID', 'message' => $leak,
            'details' => ['key' => $leak], 'trace' => $leak,
        ], JSON_THROW_ON_ERROR));

        $raw = json_encode($json, JSON_THROW_ON_ERROR);
        self::assertStringNotContainsString('SECRET', $raw);
        self::assertStringNotContainsString('db.internal', $raw);
        self::assertArrayNotHasKey('details', $json);
        self::assertArrayNotHasKey('trace', $json);
        self::assertSame('La IA no está configurada correctamente para esta cuenta.', $json['detail']);
    }

    public function testBudget429ForwardsRetryAfter(): void
    {
        [$response, $json] = $this->post('/copilot_chat', 429, '{"error":true,"error_code":"AI_BUDGET_EXCEEDED"}', ['Retry-After' => '3600']);

        self::assertSame('3600', $response->getHeaderLine('Retry-After'));
        self::assertSame('AI_BUDGET_EXCEEDED', $json['code']);
    }

    public function testUnknownAiCodeOrAbsentCodeKeepsGenericBehaviour(): void
    {
        [$r1, $j1] = $this->post('/copilot_chat', 503, '{"error":true,"error_code":"AI_SOMETHING_NEW"}');
        self::assertSame(502, $r1->getStatusCode());
        self::assertSame('upstream_error', $j1['code']);

        [$r2, $j2] = $this->post('/copilot_chat', 503, '{"error":true,"message":"The AI service is not configured correctly"}');
        self::assertSame(502, $r2->getStatusCode());
        self::assertSame('upstream_error', $j2['code']);

        [$r3, $j3] = $this->post('/copilot_chat', 429, '{"error":true,"error_code":"other"}');
        self::assertSame(429, $r3->getStatusCode());
        self::assertSame('rate_limited', $j3['code']);
    }

    public function testNonCopilotRoutesKeepGenericBehaviour(): void
    {
        [$response, $json] = $this->post('/things', 503, '{"error":true,"error_code":"AI_CREDENTIALS_INVALID"}');

        self::assertSame(502, $response->getStatusCode());
        self::assertSame('upstream_error', $json['code']);
    }
}
