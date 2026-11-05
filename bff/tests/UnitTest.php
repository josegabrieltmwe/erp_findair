<?php

declare(strict_types=1);

namespace Findair\Bff\Tests;

use Findair\Bff\Auth\TokenSet;
use Findair\Bff\Auth\TokenVault;
use Findair\Bff\Proxy\RouteManifest;
use Findair\Bff\Proxy\UpstreamUrl;
use PHPUnit\Framework\TestCase;

final class UnitTest extends TestCase
{
    private function key(): string
    {
        return 'base64:' . base64_encode(random_bytes(32));
    }

    public function testVaultRoundTripAndTamper(): void
    {
        $vault = new TokenVault($this->key());
        $sealed = $vault->seal(new TokenSet('a', 'r', 123, 456));

        self::assertStringNotContainsString('"a"', $sealed);
        self::assertSame('a', $vault->open($sealed)?->accessToken);
        self::assertNull($vault->open(substr($sealed, 0, -2) . 'AA'));
        self::assertNull((new TokenVault($this->key()))->open($sealed), 'otra clave no descifra');
    }

    public function testVaultRejectsShortKey(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        new TokenVault('base64:' . base64_encode('short'));
    }

    public function testManifestMatchesParamsAndMethods(): void
    {
        $manifest = RouteManifest::fromFile(__DIR__ . '/fixtures/routes.yaml');

        $hit = $manifest->match('GET', '/things/42');
        self::assertNotNull($hit);
        self::assertSame('thing.show', $hit['route']->id);
        self::assertSame(['id' => '42'], $hit['params']);

        self::assertNull($manifest->match('DELETE', '/things/42'));
        self::assertTrue($manifest->pathExists('/things/42'));
        self::assertNull($manifest->match('GET', '/things/../etc'));
        self::assertNull($manifest->match('GET', '/things/4/2'));
    }

    public function testProductionManifestExposesCopilotAsPost(): void
    {
        $manifest = RouteManifest::fromFile(__DIR__ . '/../config/routes.bff.yaml');

        foreach (['/copilot_chat', '/api_copilot_elevenlabs_credential', '/copilot_tts'] as $path) {
            self::assertNotNull($manifest->match('POST', $path), "POST {$path} debe estar en el manifiesto");
            self::assertNull($manifest->match('GET', $path), "GET {$path} no debe estar: el backend es POST");
        }
    }

    public function testCopilotTtsIsPinnedByHandAsBinaryPost(): void
    {
        $manifest = RouteManifest::fromFile(__DIR__ . '/../config/routes.bff.yaml');

        $match = $manifest->match('POST', '/copilot_tts');
        self::assertNotNull($match);
        self::assertSame('copilot.tts', $match['route']->id);
        self::assertSame('binary', $match['route']->response);
    }

    public function testElevenlabsReviewOnlyExposesGetAndPost(): void
    {
        $manifest = RouteManifest::fromFile(__DIR__ . '/../config/routes.bff.yaml');

        self::assertNotNull($manifest->match('GET', '/api_admin_elevenlabs_review'));
        self::assertNotNull($manifest->match('POST', '/api_admin_elevenlabs_review'));
        self::assertNull($manifest->match('PUT', '/api_admin_elevenlabs_review'));
        self::assertNull($manifest->match('DELETE', '/api_admin_elevenlabs_review'));
    }

    public function testProductionManifestExposesAiAdminRoutesWithExactMethods(): void
    {
        $manifest = RouteManifest::fromFile(__DIR__ . '/../config/routes.bff.yaml');

        $expected = [
            '/api_admin_ai_settings' => ['GET', 'PUT'],
            '/api_admin_ai_budgets' => ['GET', 'PUT', 'DELETE'],
            '/api_admin_ai_my_credentials' => ['GET', 'POST', 'PUT', 'DELETE'],
            '/api_admin_ai_usage' => ['GET'],
            '/api_admin_ai_audit' => ['GET'],
            '/api_admin_copilot_memory' => ['GET', 'DELETE'],
            '/api_admin_elevenlabs_health' => ['GET'],
        ];

        foreach ($expected as $path => $methods) {
            foreach (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as $method) {
                $route = $manifest->match($method, $path);
                if (in_array($method, $methods, true)) {
                    self::assertNotNull($route, "{$method} {$path} debe estar en el manifiesto");
                    self::assertSame($method !== 'GET', $route['route']->csrf, "{$method} {$path}: CSRF solo en métodos que cambian estado");
                } else {
                    self::assertNull($route, "{$method} {$path} no debe estar en el manifiesto");
                }
            }
        }
    }

    // Escenario: api_pay_payments expone exactamente GET (detalle/listado) y POST (iniciar cobro); POST exige CSRF.
    public function testPayPaymentsExposesExactlyGetAndPost(): void
    {
        $manifest = RouteManifest::fromFile(__DIR__ . '/../config/routes.bff.yaml');

        foreach (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as $method) {
            $route = $manifest->match($method, '/api_pay_payments');
            if ($method === 'GET' || $method === 'POST') {
                self::assertNotNull($route, "{$method} /api_pay_payments debe estar en el manifiesto");
                self::assertSame($method === 'POST', $route['route']->csrf);
            } else {
                self::assertNull($route, "{$method} /api_pay_payments no debe estar en el manifiesto");
            }
        }
    }

    // Escenario: api_pay_pending_invoices es solo lectura; el manifiesto expone exactamente GET y, al no cambiar estado,
    // sin CSRF. POST/PUT/PATCH/DELETE no deben existir (la API responde 405 y el BFF ni siquiera lo enruta).
    public function testPayPendingInvoicesExposesExactlyGet(): void
    {
        $manifest = RouteManifest::fromFile(__DIR__ . '/../config/routes.bff.yaml');

        foreach (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as $method) {
            $route = $manifest->match($method, '/api_pay_pending_invoices');
            if ($method === 'GET') {
                self::assertNotNull($route, 'GET /api_pay_pending_invoices debe estar en el manifiesto');
                self::assertFalse($route['route']->csrf, 'un GET no exige CSRF');
            } else {
                self::assertNull($route, "{$method} /api_pay_pending_invoices no debe estar en el manifiesto");
            }
        }
    }

    // Escenario: api_pay_authorizations y api_pay_surcharges exponen exactamente GET (lectura, sin CSRF) y POST (alta/proponer
    // y acciones, con CSRF). PUT/PATCH/DELETE no existen: revocar y las acciones de recargo viajan como POST {action}.
    public function testPayAuthorizationsAndSurchargesExposeExactlyGetAndPost(): void
    {
        $manifest = RouteManifest::fromFile(__DIR__ . '/../config/routes.bff.yaml');

        foreach (['/api_pay_authorizations', '/api_pay_surcharges'] as $path) {
            foreach (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as $method) {
                $route = $manifest->match($method, $path);
                if ($method === 'GET' || $method === 'POST') {
                    self::assertNotNull($route, "{$method} {$path} debe estar en el manifiesto");
                    self::assertSame($method === 'POST', $route['route']->csrf, "{$method} {$path}: CSRF solo en POST");
                } else {
                    self::assertNull($route, "{$method} {$path} no debe estar en el manifiesto");
                }
            }
        }
    }

    public function testManifestRejectsBadAction(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        RouteManifest::fromArray([['id' => 'x', 'method' => 'GET', 'path' => '/x', 'upstream' => ['action' => '../evil']]]);
    }

    public function testManifestRejectsDuplicates(): void
    {
        $route = ['id' => 'x', 'method' => 'GET', 'path' => '/x', 'upstream' => ['action' => 'a']];
        $this->expectException(\InvalidArgumentException::class);
        RouteManifest::fromArray([$route, $route]);
    }

    public function testUpstreamUrlKeepsActionLast(): void
    {
        $urls = new UpstreamUrl('http://h/app.php', 'http://p/app.php');

        self::assertSame('http://h/app.php?a=1&action=token', $urls->internal('token', ['a' => 1, 'action' => 'evil']));
        self::assertSame('http://p/app.php?action=auth', $urls->public('auth'));
    }

    public function testProfileContextForNonTmweUserHasNoCapabilities(): void
    {
        $ctx = \Findair\Bff\Auth\UserContextProvider::fromProfile(['username' => 'ana', 'idanagfrc' => 77, 'is_admin' => 'yes']);

        self::assertSame([], $ctx['capabilities']);
        self::assertSame(77, $ctx['user']['partner_id']);
        self::assertFalse($ctx['user']['is_admin'], 'is_admin solo es verdadero si es booleano true');
    }

    public function testProfileAccessIsSanitizedAndOptional(): void
    {
        $none = \Findair\Bff\Auth\UserContextProvider::fromProfile(['idanagfrc' => 1]);
        self::assertSame(['roles' => [], 'scopes' => [], 'is_root' => false], $none['user']['access']);

        $ctx = \Findair\Bff\Auth\UserContextProvider::fromProfile(['idanagfrc' => 77, 'access' => [
            'roles' => [['name' => 'findair_basic'], ['name' => '<x>'], ['name' => 'findair_basic'], 'plano', ['id' => 3]],
            'scopes' => ['shipment:read', 'shipment:read', 'Bad Scope', 7, str_repeat('s', 70)],
            'is_root' => 'true',
        ]]);

        self::assertSame(['findair_basic'], $ctx['user']['access']['roles']);
        self::assertSame(['shipment:read'], $ctx['user']['access']['scopes']);
        self::assertFalse($ctx['user']['access']['is_root'], 'is_root solo es verdadero si es booleano true');
    }

    public function testBackendContextCapabilitiesAreSanitized(): void
    {
        $ctx = \Findair\Bff\Auth\UserContextProvider::fromBackendContext([
            'user' => ['idanagfrc' => 5],
            'capabilities' => ['clients', 'my_org', 'clients', '<script>', 42, str_repeat('x', 80)],
        ]);

        self::assertSame(['clients', 'my_org'], $ctx['capabilities']);
    }

    public function testBackendContextExposesOnlyKnownInvoicingBooleans(): void
    {
        $ctx = \Findair\Bff\Auth\UserContextProvider::fromBackendContext([
            'user' => ['idanagfrc' => 5],
            'invoicing_capabilities' => ['can_read' => true, 'can_write' => true, 'can_send' => 'yes', 'is_root' => true],
        ]);

        self::assertSame(
            ['can_read' => true, 'can_write' => true, 'can_send' => false, 'can_export' => false, 'can_admin_numbering' => false],
            $ctx['user']['invoicing'],
        );
    }

    public function testBackendContextWithoutInvoicingDeniesEverything(): void
    {
        $ctx = \Findair\Bff\Auth\UserContextProvider::fromBackendContext(['user' => ['idanagfrc' => 5]]);

        self::assertSame(['can_read' => false, 'can_write' => false, 'can_send' => false, 'can_export' => false, 'can_admin_numbering' => false], $ctx['user']['invoicing']);
    }
}
