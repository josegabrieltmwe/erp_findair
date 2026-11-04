<?php

declare(strict_types=1);

namespace Findair\Bff\Tests;

use GuzzleHttp\Psr7\Response as UpstreamResponse;

/**
 * 501 del API (función sin configurar en ese servidor, p. ej. COMM_NOT_IMPLEMENTED del tiempo real de comunicación):
 * llega como 501 con su código para que la SPA use la alternativa, no como 502 «error del servicio». El texto del
 * backend no sale. La lógica es del adaptador, no de la ruta: se usa una ruta POST cualquiera de las fixtures.
 */
final class NotImplementedPassthroughTest extends AppTestCase
{
    /** @return array{\Psr\Http\Message\ResponseInterface, array<string, mixed>} */
    private function post(int $status, array $body): array
    {
        $this->boot([new UpstreamResponse($status, ['Content-Type' => 'application/json'], json_encode($body, JSON_THROW_ON_ERROR))]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('POST', '/bff/v1/full_shipment_label_generator', $sid, $this->unsafeHeaders(), '{}'));

        return [$response, $this->json($response)];
    }

    public function testNotImplementedKeeps501AndTheCode(): void
    {
        [$response, $json] = $this->post(501, [
            'success' => false,
            'error' => ['code' => 'COMM_NOT_IMPLEMENTED', 'message' => 'The realtime stream is not configured on this server'],
            'error_code' => 'COMM_NOT_IMPLEMENTED',
            'message' => 'The realtime stream is not configured on this server',
        ]);

        self::assertSame(501, $response->getStatusCode());
        self::assertSame('COMM_NOT_IMPLEMENTED', $json['code']);
        self::assertSame('COMM_NOT_IMPLEMENTED', $json['error_code']);
        self::assertStringNotContainsString('realtime stream', json_encode($json, JSON_THROW_ON_ERROR));
        self::assertArrayHasKey('request_id', $json);
    }

    public function testAnUnsafeCodeFallsBackToAGenericOne(): void
    {
        [$response, $json] = $this->post(501, ['error_code' => 'bad code <script>']);

        self::assertSame(501, $response->getStatusCode());
        self::assertSame('not_implemented', $json['code']);
    }
}
