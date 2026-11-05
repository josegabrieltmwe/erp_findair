<?php

declare(strict_types=1);

namespace Findair\Bff\Tests;

use GuzzleHttp\Psr7\Response as UpstreamResponse;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * api_pay_authorizations y api_pay_surcharges (autorizaciones de cobro y recargos, Ola 3 / F-C): el BFF es un pass-through.
 *
 * Cubre cuatro cosas: (1) los errores funcionales del API (404 ajeno, 409 de estado/plazo, 422 de tope, 403 sin permiso de
 * administrador) llegan al SPA con estado y code intactos, para que cada pantalla explique el motivo; (2) el 503
 * PAYMENT_NOT_ACTIVE (interruptor apagado) y PAYMENT_RETURN_URL_NOT_CONFIGURED NO se disfrazan de averia 502, pero un 503
 * cualquiera si; (3) la lista blanca de query reenvia id/view/status/customer_id/page/per_page y descarta partner_id (el
 * partner sale del token; no hay vista cruzada); (4) el cuerpo POST viaja sin tocar y el 200/201 pasa tal cual.
 * Patron: PaymentErrorPassthroughTest / PendingInvoicesPassthroughTest.
 */
final class SurchargesPassthroughTest extends AppTestCase
{
    /** @return array<string, array{string, int, string}> ruta, estado y code del upstream */
    public static function errors(): array
    {
        return [
            'recargo ajeno 404' => ['api_pay_surcharges', 404, 'PAYMENT_NOT_FOUND'],
            'impugnacion fuera de plazo 409' => ['api_pay_surcharges', 409, 'SURCHARGE_DISPUTE_WINDOW_CLOSED'],
            'aviso sin vencer 409' => ['api_pay_surcharges', 409, 'SURCHARGE_NOTICE_NOT_ELAPSED'],
            'tope superado 422' => ['api_pay_surcharges', 422, 'SURCHARGE_CAP_EXCEEDED'],
            'sin administrador 403' => ['api_pay_surcharges', 403, 'PAYMENT_FORBIDDEN'],
            'autorizacion ya activa 409' => ['api_pay_authorizations', 409, 'AUTHORIZATION_ALREADY_ACTIVE'],
            'texto de consentimiento caducado 409' => ['api_pay_authorizations', 409, 'CONSENT_TEXT_NOT_CURRENT'],
        ];
    }

    // Escenario: el upstream responde error en POST; el BFF conserva estado y code.
    #[DataProvider('errors')]
    public function testErrorsKeepStatusAndCode(string $action, int $status, string $code): void
    {
        $body = ['success' => false, 'error' => ['code' => $code, 'message' => 'x'], 'error_code' => $code];
        $this->boot([new UpstreamResponse($status, ['Content-Type' => 'application/json'], json_encode($body, JSON_THROW_ON_ERROR))]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('POST', '/bff/v1/' . $action, $sid, $this->unsafeHeaders(), '{"action":"notify","id":"psu_x"}'));

        self::assertSame($status, $response->getStatusCode());
        self::assertSame($code, $this->json($response)['code']);
    }

    /** @return array<string, array{string, string}> ruta y code funcional que debe sobrevivir al 503 */
    public static function notActive(): array
    {
        return [
            'recargos apagados' => ['api_pay_surcharges', 'PAYMENT_NOT_ACTIVE'],
            'autorizaciones apagadas' => ['api_pay_authorizations', 'PAYMENT_NOT_ACTIVE'],
            'retorno sin configurar' => ['api_pay_authorizations', 'PAYMENT_RETURN_URL_NOT_CONFIGURED'],
        ];
    }

    // Escenario: 503 funcional (interruptor apagado): se conserva el 503 y el code, no se convierte en 502 upstream_error.
    #[DataProvider('notActive')]
    public function testNotActiveKeeps503(string $action, string $code): void
    {
        $body = ['success' => false, 'error' => ['code' => $code, 'message' => 'detalle interno'], 'error_code' => $code];
        $this->boot([new UpstreamResponse(503, ['Content-Type' => 'application/json'], json_encode($body, JSON_THROW_ON_ERROR))]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('POST', '/bff/v1/' . $action, $sid, $this->unsafeHeaders(), '{"id":"x"}'));

        self::assertSame(503, $response->getStatusCode());
        self::assertSame($code, $this->json($response)['code']);
    }

    // Escenario: un 503 con otro code (averia real) o un code de autorizaciones en la ruta de recargos NO se promociona:
    // sigue siendo 502 upstream_error y no se filtra el detalle interno.
    public function testOtherOrCrossedCodesStayAsUpstreamError(): void
    {
        foreach ([['api_pay_surcharges', 'PAYMENT_RETURN_URL_NOT_CONFIGURED'], ['api_pay_surcharges', 'DB_DOWN']] as [$action, $code]) {
            $body = ['success' => false, 'error' => ['code' => $code, 'message' => 'secreto interno'], 'error_code' => $code];
            $this->boot([new UpstreamResponse(503, ['Content-Type' => 'application/json'], json_encode($body, JSON_THROW_ON_ERROR))]);
            $sid = $this->loginSession();
            $response = $this->send($this->request('POST', '/bff/v1/' . $action, $sid, $this->unsafeHeaders(), '{"id":"x"}'));

            self::assertSame(502, $response->getStatusCode(), $code);
            self::assertStringNotContainsString('secreto interno', (string) $response->getBody());
        }
    }

    // Escenario: GET de recargos con filtros validos y parametros ajenos (partner_id, action): solo viajan los de la lista
    // blanca, la accion upstream es la del manifiesto y el 200 pasa sin alterar (importes enteros en centimos).
    public function testSurchargesGetForwardsOnlyWhitelistedQuery(): void
    {
        $payload = '{"success":true,"data":[{"public_id":"psu_0123456789abcdef01234567","amount_minor":4200,"status":"notified"}],"total":1,"page":1,"per_page":25}';
        $this->boot([new UpstreamResponse(200, ['Content-Type' => 'application/json'], $payload)]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('GET', '/bff/v1/api_pay_surcharges?status=notified&customer_id=7&page=1&per_page=25&view=pending_transfer&partner_id=9&action=evil', $sid));

        self::assertSame(200, $response->getStatusCode());
        self::assertSame(4200, $this->json($response)['data'][0]['amount_minor']);

        parse_str($this->history[0]['request']->getUri()->getQuery(), $query);
        self::assertSame('api_pay_surcharges', $query['action']);
        self::assertSame('notified', $query['status']);
        self::assertSame('7', $query['customer_id']);
        self::assertSame('pending_transfer', $query['view']);
        self::assertArrayNotHasKey('partner_id', $query, 'el partner sale del token: no hay vista cruzada');
    }

    // Escenario: GET de autorizaciones (texto de consentimiento) reenvia view y locale.
    public function testAuthorizationsGetForwardsConsentTextQuery(): void
    {
        $this->boot([new UpstreamResponse(200, ['Content-Type' => 'application/json'], '{"success":true,"data":{"version":"v1"}}')]);
        $sid = $this->loginSession();
        $this->send($this->request('GET', '/bff/v1/api_pay_authorizations?view=consent_text&locale=es-ES&partner_id=9', $sid));

        parse_str($this->history[0]['request']->getUri()->getQuery(), $query);
        self::assertSame('api_pay_authorizations', $query['action']);
        self::assertSame('consent_text', $query['view']);
        self::assertSame('es-ES', $query['locale']);
        self::assertArrayNotHasKey('partner_id', $query);
    }

    // Escenario: el cuerpo de una propuesta de recargo (con importe entero y evidencia) viaja intacto al upstream, y el 201 pasa.
    public function testProposeBodyIsForwardedUntouched(): void
    {
        $this->boot([new UpstreamResponse(201, ['Content-Type' => 'application/json'], '{"success":true,"replayed":false,"data":{"status":"pending_notice"}}')]);
        $sid = $this->loginSession();
        $body = '{"customer_id":4521,"surcharge_type":"overweight","amount":{"amount_minor":4200,"currency":"EUR"},"declared_value":"10","measured_value":"14","evidence":"acta del transportista"}';
        $response = $this->send($this->request('POST', '/bff/v1/api_pay_surcharges', $sid, $this->unsafeHeaders(), $body));

        self::assertSame(201, $response->getStatusCode());
        $sent = (string) $this->history[0]['request']->getBody();
        $decoded = json_decode($sent, true, 512, JSON_THROW_ON_ERROR);
        self::assertSame(4200, $decoded['amount']['amount_minor'], 'el importe sigue siendo un entero');
        self::assertSame(4521, $decoded['customer_id']);
    }
}
