<?php

declare(strict_types=1);

namespace Findair\Bff\Tests;

use GuzzleHttp\Psr7\Response as UpstreamResponse;

/**
 * Errores del courier al generar la AWB (tmwe_api Courier_Error_Catalog):
 *  - 422 (rechazo que corrige el operador): llega con `error.details` para pintarlo en el dialogo.
 *  - 503 COURIER_UNAVAILABLE: conserva el 503 y el codigo (reintentar), con texto fijo y solo campos seguros.
 *  - Cualquier otro 5xx sigue siendo 502 upstream_error sin detalle del backend.
 */
final class CourierErrorPassthroughTest extends AppTestCase
{
    /** @return array{\Psr\Http\Message\ResponseInterface, array<string, mixed>} */
    private function post(int $status, array $body): array
    {
        $this->boot([new UpstreamResponse($status, ['Content-Type' => 'application/json'], json_encode($body, JSON_THROW_ON_ERROR))]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('POST', '/bff/v1/full_shipment_label_generator', $sid, $this->unsafeHeaders(), '{"shipment_id":1}'));

        return [$response, $this->json($response)];
    }

    public function testCourierRejectionKeepsTheStructuredDetails(): void
    {
        [$response, $json] = $this->post(422, [
            'success' => false,
            'error' => [
                'code' => 'COURIER_PACKAGE_OVERWEIGHT',
                'message' => 'FedEx: package 1 exceeds the 68 KG limit for its packaging.',
                'details' => ['category' => 'courier_rejected', 'courier' => 'fedex', 'package' => 1, 'limit' => 68, 'unit' => 'KG'],
            ],
            'error_code' => 'COURIER_PACKAGE_OVERWEIGHT',
            'message' => 'FedEx: package 1 exceeds the 68 KG limit for its packaging.',
        ]);

        self::assertSame(422, $response->getStatusCode());
        self::assertSame('COURIER_PACKAGE_OVERWEIGHT', $json['code']);
        self::assertSame(68, $json['error']['details']['limit']);
        self::assertSame('courier_rejected', $json['error']['details']['category']);
    }

    public function testCourierUnavailableKeeps503AndOnlySafeFields(): void
    {
        [$response, $json] = $this->post(503, [
            'success' => false,
            'error' => [
                'code' => 'COURIER_UNAVAILABLE',
                'message' => 'host=rabbit.internal timeout',
                'details' => ['category' => 'courier_unavailable', 'retryable' => true, 'courier' => 'fedex', 'courier_message' => 'amqp://user:pw@rabbit.internal'],
            ],
            'error_code' => 'COURIER_UNAVAILABLE',
        ]);

        self::assertSame(503, $response->getStatusCode());
        self::assertSame('COURIER_UNAVAILABLE', $json['code']);
        self::assertSame('COURIER_UNAVAILABLE', $json['error']['code']);
        self::assertTrue($json['error']['details']['retryable']);
        self::assertArrayNotHasKey('courier_message', $json['error']['details']);
        $raw = json_encode($json, JSON_THROW_ON_ERROR);
        self::assertStringNotContainsString('rabbit.internal', $raw);
        self::assertArrayHasKey('request_id', $json);
    }

    public function testOtherServerErrorsStayGeneric(): void
    {
        [$response, $json] = $this->post(500, [
            'success' => false,
            'error' => ['code' => 'INTERNAL_ERROR', 'message' => 'Internal server error: /var/www/x.php:12'],
        ]);

        self::assertSame(502, $response->getStatusCode());
        self::assertSame('upstream_error', $json['code']);
        self::assertStringNotContainsString('/var/www', json_encode($json, JSON_THROW_ON_ERROR));
    }
}
