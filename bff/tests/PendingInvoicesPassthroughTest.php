<?php

declare(strict_types=1);

namespace Findair\Bff\Tests;

use GuzzleHttp\Psr7\Response as UpstreamResponse;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * api_pay_pending_invoices (facturas pendientes de cobro, solo lectura): el BFF es un pass-through puro.
 *
 * Cubre tres cosas: (1) el 403 (sin invoices:read + payment_gateways:read) y el 503 PAYMENT_PENDING_UNAVAILABLE llegan al
 * SPA con estado y code intactos, para que la pantalla distinga "sin permiso" de "no se pudo leer" y NUNCA pinte una lista
 * vacia ante un error; (2) la lista blanca de query reenvia page y per_page y descarta cualquier otro parametro (el
 * cliente/partner sale del token en el API, no de la query); (3) el 200 pasa tal cual, con importes como texto decimal.
 * Patron: PaymentErrorPassthroughTest.
 */
final class PendingInvoicesPassthroughTest extends AppTestCase
{
    /** @return array<string, array{int, string}> */
    public static function errors(): array
    {
        return [
            '403 sin permiso' => [403, 'FORBIDDEN'],
            '503 lectura no disponible' => [503, 'PAYMENT_PENDING_UNAVAILABLE'],
        ];
    }

    // Escenario: el upstream responde 403/503 al GET; el BFF conserva estado y code (sin convertirlos en lista vacia).
    #[DataProvider('errors')]
    public function testErrorsKeepStatusAndCode(int $status, string $code): void
    {
        $body = ['success' => false, 'error' => ['code' => $code, 'message' => 'x'], 'error_code' => $code];
        $this->boot([new UpstreamResponse($status, ['Content-Type' => 'application/json'], json_encode($body, JSON_THROW_ON_ERROR))]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('GET', '/bff/v1/api_pay_pending_invoices?page=1&per_page=25', $sid));
        $json = $this->json($response);

        self::assertSame($status, $response->getStatusCode());
        self::assertSame($code, $json['code']);
    }

    // Escenario: GET con page/per_page y parametros ajenos (partner_id, customer_id, action): solo viajan page y per_page,
    // la accion upstream es la fija del manifiesto y el cuerpo 200 (paginacion y textos decimales) pasa sin alterar.
    public function testForwardsOnlyPaginationAndKeepsBody(): void
    {
        $payload = '{"success":true,"data":[{"invoice_id":12345,"pending":"122.00","payable":true}],"total":1,"page":2,"per_page":10}';
        $this->boot([new UpstreamResponse(200, ['Content-Type' => 'application/json'], $payload)]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('GET', '/bff/v1/api_pay_pending_invoices?page=2&per_page=10&partner_id=9&customer_id=7&action=evil', $sid));

        self::assertSame(200, $response->getStatusCode());
        $json = $this->json($response);
        self::assertSame('122.00', $json['data'][0]['pending'], 'el importe sigue siendo texto decimal');
        self::assertSame(2, $json['page']);

        $sent = $this->history[0]['request'];
        self::assertSame('GET', $sent->getMethod());
        parse_str($sent->getUri()->getQuery(), $query);
        self::assertSame('api_pay_pending_invoices', $query['action']);
        self::assertSame('2', $query['page']);
        self::assertSame('10', $query['per_page']);
        self::assertArrayNotHasKey('partner_id', $query);
        self::assertArrayNotHasKey('customer_id', $query);
    }
}
