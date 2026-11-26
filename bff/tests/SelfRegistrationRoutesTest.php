<?php

declare(strict_types=1);

namespace Findair\Bff\Tests;

use Findair\Bff\Proxy\RouteManifest;

/**
 * Auto-registro de FindAir, revisión por el titular (P147): la cola/ficha (GET), la decisión (POST) y la configuración
 * (GET/PUT). Lo autoriza la API; aquí solo se fija la lista blanca, los parámetros que pasan y que la escritura exige CSRF.
 */
final class SelfRegistrationRoutesTest extends AppTestCase
{
    public function testColaYDecisionDelTitular(): void
    {
        $manifest = RouteManifest::fromFile(__DIR__ . '/../config/routes.bff.yaml');

        $get = $manifest->match('GET', '/api_self_registration_admin');
        self::assertNotNull($get);
        self::assertSame('api_self_registration_admin', $get['route']->action);
        self::assertFalse($get['route']->forwardAllQuery);
        foreach (['id', 'status', 'date_from', 'date_to', 'q', 'page', 'per_page', 'id_anagr_titolare'] as $param) {
            self::assertContains($param, $get['route']->forwardQuery);
        }

        $post = $manifest->match('POST', '/api_self_registration_admin');
        self::assertNotNull($post);
        self::assertTrue($post['route']->csrf);
        self::assertSame([], $post['route']->forwardQuery);

        foreach (['PUT', 'PATCH', 'DELETE'] as $method) {
            self::assertNull($manifest->match($method, '/api_self_registration_admin'), "{$method} no debe estar");
        }
    }

    public function testConfiguracionDelTitular(): void
    {
        $manifest = RouteManifest::fromFile(__DIR__ . '/../config/routes.bff.yaml');

        $get = $manifest->match('GET', '/api_self_registration_config');
        self::assertNotNull($get);
        self::assertSame(['id_anagr_titolare'], $get['route']->forwardQuery);

        $put = $manifest->match('PUT', '/api_self_registration_config');
        self::assertNotNull($put);
        self::assertTrue($put['route']->csrf);
        self::assertSame(['id_anagr_titolare'], $put['route']->forwardQuery);

        foreach (['POST', 'PATCH', 'DELETE'] as $method) {
            self::assertNull($manifest->match($method, '/api_self_registration_config'), "{$method} no debe estar");
        }
    }
}
