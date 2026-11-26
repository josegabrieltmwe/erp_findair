<?php

declare(strict_types=1);

namespace Findair\Bff\Tests;

use GuzzleHttp\Psr7\Response as UpstreamResponse;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * api_booking_postcharge («Cobrar postfacturación» de los clientes que pagan con tarjeta, P148): el BFF es un pass-through.
 *
 * Cubre: (1) los 409/422/404/403 del API llegan con estado y code intactos; (2) el 502 POSTCHARGE_INVOICE_FAILED conserva
 * estado y code con texto fijo (sin el detalle interno), pero otro 5xx sigue siendo 502 upstream_error; (3) el GET solo
 * reenvia kind y shipment_id; (4) el cuerpo del POST viaja sin tocar. Patron: SurchargesPassthroughTest.
 */
final class BookingPostchargePassthroughTest extends AppTestCase
{
    /** @return array<string, array{int, string}> estado y code del upstream */
    public static function errors(): array
    {
        return [
            'cliente normal 409' => [409, 'NOT_CARD_CUSTOMER'],
            'sin facturar 409' => [409, 'NOT_INVOICED'],
            'ya postfacturado 409' => [409, 'ALREADY_POSTBILLED'],
            'sin importe 422' => [422, 'NO_POST_AMOUNT'],
            'vista previa fallida 422' => [422, 'POSTCHARGE_PREVIEW_FAILED'],
            'envio ajeno 404' => [404, 'PAYMENT_NOT_FOUND'],
            'cliente final 403' => [403, 'FORBIDDEN'],
        ];
    }

    // Escenario: el upstream rechaza el POST; el BFF conserva estado y code.
    #[DataProvider('errors')]
    public function testErrorsKeepStatusAndCode(int $status, string $code): void
    {
        $body = ['success' => false, 'error' => ['code' => $code, 'message' => 'x']];
        $this->boot([new UpstreamResponse($status, ['Content-Type' => 'application/json'], json_encode($body, JSON_THROW_ON_ERROR))]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('POST', '/bff/v1/api_booking_postcharge', $sid, $this->unsafeHeaders(), '{"kind":"express","shipment_id":1}'));

        self::assertSame($status, $response->getStatusCode());
        self::assertSame($code, $this->json($response)['code']);
    }

    // Escenario: la postfactura no se pudo emitir (502): estado y code se conservan, el detalle interno no sale.
    public function testInvoiceFailedKeeps502AndCode(): void
    {
        $body = ['success' => false, 'error' => ['code' => 'POSTCHARGE_INVOICE_FAILED', 'message' => 'secreto interno']];
        $this->boot([new UpstreamResponse(502, ['Content-Type' => 'application/json'], json_encode($body, JSON_THROW_ON_ERROR))]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('POST', '/bff/v1/api_booking_postcharge', $sid, $this->unsafeHeaders(), '{"kind":"cargo","shipment_id":7}'));

        self::assertSame(502, $response->getStatusCode());
        self::assertSame('POSTCHARGE_INVOICE_FAILED', $this->json($response)['code']);
        self::assertStringNotContainsString('secreto interno', (string) $response->getBody());
    }

    // Escenario: otro 5xx de la ruta, o el mismo code en otra ruta, no se promociona: 502 upstream_error.
    public function testOtherFailuresStayAsUpstreamError(): void
    {
        foreach ([['api_booking_postcharge', 'DB_DOWN', 500], ['api_pay_surcharges', 'POSTCHARGE_INVOICE_FAILED', 502]] as [$action, $code, $status]) {
            $body = ['success' => false, 'error' => ['code' => $code, 'message' => 'secreto interno']];
            $this->boot([new UpstreamResponse($status, ['Content-Type' => 'application/json'], json_encode($body, JSON_THROW_ON_ERROR))]);
            $sid = $this->loginSession();
            $response = $this->send($this->request('POST', '/bff/v1/' . $action, $sid, $this->unsafeHeaders(), '{"id":"x"}'));

            self::assertSame(502, $response->getStatusCode(), $code);
            self::assertSame('upstream_error', $this->json($response)['code'], $action);
            self::assertStringNotContainsString('secreto interno', (string) $response->getBody());
        }
    }

    // Escenario: GET con parametros ajenos: solo viajan kind y shipment_id; un `data: null` pasa tal cual.
    public function testGetForwardsOnlyWhitelistedQuery(): void
    {
        $this->boot([new UpstreamResponse(200, ['Content-Type' => 'application/json'], '{"success":true,"data":null}')]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('GET', '/bff/v1/api_booking_postcharge?kind=express&shipment_id=1001&partner_id=9&action=evil', $sid));

        self::assertSame(200, $response->getStatusCode());
        self::assertNull($this->json($response)['data']);
        parse_str($this->history[0]['request']->getUri()->getQuery(), $query);
        self::assertSame('api_booking_postcharge', $query['action']);
        self::assertSame('express', $query['kind']);
        self::assertSame('1001', $query['shipment_id']);
        self::assertArrayNotHasKey('partner_id', $query);
    }

    // Escenario: el cuerpo del POST viaja intacto.
    public function testPostBodyIsForwardedUntouched(): void
    {
        $this->boot([new UpstreamResponse(200, ['Content-Type' => 'application/json'], '{"success":true,"data":{"status":"notified","replayed":false}}')]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('POST', '/bff/v1/api_booking_postcharge', $sid, $this->unsafeHeaders(), '{"kind":"express","shipment_id":1001}'));

        self::assertSame(200, $response->getStatusCode());
        $sent = json_decode((string) $this->history[0]['request']->getBody(), true, 512, JSON_THROW_ON_ERROR);
        self::assertSame(['kind' => 'express', 'shipment_id' => 1001], $sent);
    }
}
