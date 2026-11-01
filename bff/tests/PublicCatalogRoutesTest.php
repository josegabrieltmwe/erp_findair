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
}
