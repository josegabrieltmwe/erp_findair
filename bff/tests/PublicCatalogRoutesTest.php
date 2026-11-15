<?php

declare(strict_types=1);

namespace Findair\Bff\Tests;

use Findair\Bff\Proxy\RouteManifest;

/** Catálogos públicos de países y monedas: los pueden pedir todos los perfiles (partner incluido), solo lectura. */
final class PublicCatalogRoutesTest extends AppTestCase
{
    public function testCountriesAndCurrenciesAreGetOnlyWithFixedAction(): void
    {
        $manifest = RouteManifest::fromFile(__DIR__ . '/../config/routes.bff.yaml');
        foreach (['get-api-countries', 'get-api-currencies'] as $name) {
            $hit = $manifest->match('GET', '/' . $name);
            self::assertNotNull($hit, "{$name} debe estar en la lista blanca");
            self::assertSame($name, $hit['route']->action);
            foreach (['POST', 'PUT', 'PATCH', 'DELETE'] as $method) {
                self::assertNull($manifest->match($method, '/' . $name), "{$method} {$name} no debe estar");
            }
        }
    }

    public function testSoloElCatalogoPublicoDePaisesNoExigeElPartnerEfectivo(): void
    {
        // Country_Controller no autentica (no emite X-Effective-Partner-Id): suplantando daba 502 en /clients.
        // Monedas sí autentica y lo emite, así que conserva la comprobación.
        $manifest = RouteManifest::fromFile(__DIR__ . '/../config/routes.bff.yaml');
        self::assertFalse($manifest->match('GET', '/get-api-countries')['route']->checkEffectivePartner);
        self::assertTrue($manifest->match('GET', '/get-api-currencies')['route']->checkEffectivePartner);
    }

    /**
     * P1 (2026-11-15): Terminal_Controller, Airport_Search_Controller, Currency_Day_Controller y
     * Cap_City_Prov_Controller son is_secured() = false en tmwe_api (bin/check_public_oauth_authz.php,
     * grupo "catálogos sin datos de cliente" de $NOAUTH_ALLOWLIST): no autentican y por tanto nunca emiten
     * X-Effective-Partner-Id. Suplantando a un partner, ProxyController descartaba su respuesta con 502
     * effective_partner_mismatch aunque el catálogo (terminales, aeropuertos, tasa de cambio, CAP/ciudad) es
     * el mismo para todos los partners. El comportamiento de ProxyController ante check_effective_partner:
     * false ya está probado en ImpersonationTest (testRouteThatOptsOutOfTheCheckIsDeliveredWithoutHeader /
     * testJsonRoutesStillRequireTheHeaderByDefault); esto es la prueba de regresión de que el MANIFIESTO REAL
     * marca las rutas correctas.
     */
    public function testReferenceCatalogRoutesDoNotRequireTheEffectivePartnerHeader(): void
    {
        $manifest = RouteManifest::fromFile(__DIR__ . '/../config/routes.bff.yaml');
        foreach ([
            ['GET', '/cap_city_prov'],
            ['GET', '/api_cargo_terminals'],
            ['GET', '/api_airport_search'],
            ['GET', '/currencies/day'],
        ] as [$method, $path]) {
            $hit = $manifest->match($method, $path);
            self::assertNotNull($hit, "{$method} {$path} debe estar en la lista blanca");
            self::assertFalse($hit['route']->checkEffectivePartner, "{$path} no debe exigir el partner efectivo");
        }

        // No regresión: una ruta protegida normal (el backend autentica y sella la respuesta) sigue exigiéndolo.
        self::assertTrue($manifest->match('GET', '/me')['route']->checkEffectivePartner);
    }

    public function testActionAllowsHyphensButNothingElse(): void
    {
        $base = ['id' => 'x', 'method' => 'GET', 'path' => '/x'];
        self::assertNotNull(RouteManifest::fromArray([$base + ['upstream' => ['action' => 'get-api-x']]])->match('GET', '/x'));
        foreach (['Get-Api', '-api', 'a b', 'a/b', 'a..b', 'a;b', ''] as $malo) {
            try {
                RouteManifest::fromArray([$base + ['upstream' => ['action' => $malo]]]);
                self::fail("la acción «{$malo}» no debería aceptarse");
            } catch (\InvalidArgumentException) {
                self::assertTrue(true);
            }
        }
    }

    public function testAwbDocumentsTieneTimeoutDe60sParaElPdf(): void
    {
        $m = RouteManifest::fromFile(__DIR__ . '/../config/routes.bff.yaml');
        $hit = $m->match('GET', '/api_awb_documents');
        $this->assertNotNull($hit);
        $this->assertSame(60.0, $hit['route']->timeout);
    }

    public function testLosContadoresDeLaHomeAguantanLaCacheFria(): void
    {
        $m = RouteManifest::fromFile(__DIR__ . '/../config/routes.bff.yaml');
        foreach (['/api_courier_kpis', '/api_cargo_kpis', '/api_home_box_indicators'] as $path) {
            $hit = $m->match('GET', $path);
            $this->assertNotNull($hit, $path);
            $this->assertGreaterThanOrEqual(45.0, $hit['route']->timeout, $path);
        }
    }
}
