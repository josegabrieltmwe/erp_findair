<?php

declare(strict_types=1);

namespace Findair\Bff\Tests;

use GuzzleHttp\Psr7\Response as UpstreamResponse;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * Errores de api_pay_payments (cobro con Checkout alojado): 402 (rechazo), 409 (clave repetida / nada pendiente /
 * factura ocupada), 422 (validacion) y 503 PAYMENT_GATEWAYS_NOT_ACTIVE llegan al SPA con su estado y su code intactos,
 * para que la pantalla de cobro decida el mensaje.
 */
final class PaymentErrorPassthroughTest extends AppTestCase
{
    /** @return array<string, array{int, string}> */
    public static function errors(): array
    {
        return [
            '402 rechazo' => [402, 'PAYMENT_DECLINED'],
            '409 conflicto' => [409, 'PAYMENT_IDEMPOTENCY_CONFLICT'],
            '422 validacion' => [422, 'VALIDATION_ERROR'],
            '503 pasarela inactiva' => [503, 'PAYMENT_GATEWAYS_NOT_ACTIVE'],
        ];
    }

    // Escenario: el upstream responde error en POST /api_pay_payments; el BFF conserva estado y code.
    #[DataProvider('errors')]
    public function testPaymentErrorsKeepStatusAndCode(int $status, string $code): void
    {
        $body = ['success' => false, 'error' => ['code' => $code, 'message' => 'x'], 'error_code' => $code];
        $this->boot([new UpstreamResponse($status, ['Content-Type' => 'application/json'], json_encode($body, JSON_THROW_ON_ERROR))]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('POST', '/bff/v1/api_pay_payments', $sid, $this->unsafeHeaders(), '{"invoice_id":1,"method":"card"}'));
        $json = $this->json($response);

        self::assertSame($status, $response->getStatusCode());
        self::assertSame($code, $json['code']);
    }
}
