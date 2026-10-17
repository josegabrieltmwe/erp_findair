<?php

declare(strict_types=1);

namespace Findair\Bff\Tests;

use Findair\Bff\Auth\TokenSet;
use GuzzleHttp\Psr7\Response as UpstreamResponse;

final class ProxyTest extends AppTestCase
{
    public function testHealthAndSecurityHeaders(): void
    {
        $this->boot();
        $response = $this->send($this->request('GET', '/bff/healthz'));

        self::assertSame(200, $response->getStatusCode());
        self::assertSame('nosniff', $response->getHeaderLine('X-Content-Type-Options'));
        self::assertNotSame('', $response->getHeaderLine('X-Request-Id'));
    }

    public function testUnknownRouteIsProblemJson(): void
    {
        $this->boot();
        $response = $this->send($this->request('GET', '/bff/nope'));

        self::assertSame(404, $response->getStatusCode());
        self::assertStringStartsWith('application/problem+json', $response->getHeaderLine('Content-Type'));
        self::assertSame('route_not_found', $this->json($response)['code']);
    }

    public function testRequiresSession(): void
    {
        $this->boot();
        $response = $this->send($this->request('GET', '/bff/v1/things/1'));

        self::assertSame(401, $response->getStatusCode());
        self::assertSame('unauthenticated', $this->json($response)['code']);
        self::assertCount(0, $this->history);
    }

    public function testRouteNotInManifestIsNotForwarded(): void
    {
        $this->boot();
        $sid = $this->loginSession();
        $response = $this->send($this->request('GET', '/bff/v1/admin/secret', $sid));

        self::assertSame(404, $response->getStatusCode());
        self::assertCount(0, $this->history);
    }

    public function testForwardsWithBearerAndFixedAction(): void
    {
        $this->boot([$this->upstreamOk('{"id":42}')]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('GET', '/bff/v1/things/42?lang=es&action=evil&other=x', $sid));

        self::assertSame(200, $response->getStatusCode());
        self::assertSame('{"id":42}', (string) $response->getBody());

        $sent = $this->history[0]['request'];
        self::assertSame('Bearer access-1', $sent->getHeaderLine('Authorization'));
        parse_str($sent->getUri()->getQuery(), $query);
        self::assertSame('api_thing', $query['action']);
        self::assertSame('42', $query['thing_id']);
        self::assertSame('es', $query['lang']);
        self::assertArrayNotHasKey('other', $query);
        self::assertMatchesRegularExpression('/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/', $sent->getHeaderLine('traceparent'));
    }

    public function testUnsafeMethodNeedsOrigin(): void
    {
        $this->boot();
        $sid = $this->loginSession();
        $response = $this->send($this->request('POST', '/bff/v1/things', $sid, ['X-CSRF-Token' => 'csrf-token'], '{}'));

        self::assertSame(403, $response->getStatusCode());
        self::assertSame('origin_not_allowed', $this->json($response)['code']);
    }

    public function testUnsafeMethodNeedsCsrfToken(): void
    {
        $this->boot();
        $sid = $this->loginSession();
        $headers = ['Origin' => self::ORIGIN, 'Content-Type' => 'application/json'];
        $response = $this->send($this->request('POST', '/bff/v1/things', $sid, $headers, '{}'));

        self::assertSame(403, $response->getStatusCode());
        self::assertSame('csrf_invalid', $this->json($response)['code']);
        self::assertCount(0, $this->history);
    }

    public function testPostForwardsBody(): void
    {
        $this->boot([$this->upstreamOk('{"created":true}', 201)]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('POST', '/bff/v1/things', $sid, $this->unsafeHeaders(), '{"a":1}'));

        self::assertSame(201, $response->getStatusCode());
        self::assertSame('{"a":1}', (string) $this->history[0]['request']->getBody());
    }

    public function testBodyOverLimitIsRejected(): void
    {
        $this->boot();
        $sid = $this->loginSession();
        $response = $this->send($this->request('POST', '/bff/v1/things', $sid, $this->unsafeHeaders(), str_repeat('x', 2000)));

        self::assertSame(413, $response->getStatusCode());
        self::assertCount(0, $this->history);
    }

    public function testUpstreamServerErrorDoesNotLeakDetails(): void
    {
        $this->boot([new UpstreamResponse(500, [], '{"error":"SQLSTATE[42S02] table x missing in /var/www/..."}')]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('GET', '/bff/v1/things/1', $sid));

        self::assertSame(502, $response->getStatusCode());
        self::assertStringNotContainsString('SQLSTATE', (string) $response->getBody());
        self::assertSame('upstream_error', $this->json($response)['code']);
    }

    public function testUpstreamClientErrorIsNormalized(): void
    {
        $this->boot([new UpstreamResponse(403, [], '{"success":false,"error_code":"PERM_DENIED","message":"Sin permiso"}')]);
        $sid = $this->loginSession();
        $body = $this->json($this->send($this->request('GET', '/bff/v1/things/1', $sid)));

        self::assertSame(403, $body['status']);
        self::assertSame('PERM_DENIED', $body['code']);
        self::assertSame('Sin permiso', $body['detail']);
    }

    public function testLegacyEnvelopeFailureBecomes422(): void
    {
        $this->boot([$this->upstreamOk('{"success":false,"message":"Cliente inexistente"}')]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('GET', '/bff/v1/legacy', $sid));

        self::assertSame(422, $response->getStatusCode());
        self::assertSame('Cliente inexistente', $this->json($response)['detail']);
    }

    public function testBinaryResponseKeepsDownloadHeaders(): void
    {
        $this->boot([new UpstreamResponse(200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="x.pdf"',
            'Set-Cookie' => 'PHPSESSID=leak',
            'Server' => 'Apache',
        ], '%PDF-1.4')]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('GET', '/bff/v1/file', $sid));

        self::assertSame('application/pdf', $response->getHeaderLine('Content-Type'));
        self::assertSame('attachment; filename="x.pdf"', $response->getHeaderLine('Content-Disposition'));
        self::assertFalse($response->hasHeader('Set-Cookie'));
        self::assertFalse($response->hasHeader('Server'));
        self::assertSame('%PDF-1.4', (string) $response->getBody());
    }

    public function testExpiredAccessTokenIsRefreshedBeforeCall(): void
    {
        $this->boot([
            $this->upstreamOk('{"access_token":"access-2","refresh_token":"refresh-2","expires_in":3600}'),
            $this->upstreamOk(),
        ]);
        $sid = $this->loginSession(new TokenSet('access-1', 'refresh-1', time() + 10, time() + 7200));
        $response = $this->send($this->request('GET', '/bff/v1/things/1', $sid));

        self::assertSame(200, $response->getStatusCode());
        parse_str((string) $this->history[0]['request']->getBody(), $form);
        self::assertSame('refresh_token', $form['grant_type']);
        self::assertSame('refresh-1', $form['refresh_token']);
        self::assertSame('Bearer access-2', $this->history[1]['request']->getHeaderLine('Authorization'));

        $stored = $this->store->load($sid);
        self::assertIsArray($stored);
        self::assertSame('refresh-2', $this->vault->open((string) $stored['tokens'])?->refreshToken);
    }

    public function testUpstream401TriggersOneRefreshAndRetry(): void
    {
        $this->boot([
            new UpstreamResponse(401, [], '{"error":"invalid_token"}'),
            new UpstreamResponse(401, [], '{}'), // sondeo: el token ya no vale
            $this->upstreamOk('{"access_token":"access-2","refresh_token":"refresh-2","expires_in":3600}'),
            $this->upstreamOk('{"ok":1}'),
        ]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('GET', '/bff/v1/things/1', $sid));

        self::assertSame(200, $response->getStatusCode());
        self::assertCount(4, $this->history);
        self::assertSame('Bearer access-2', $this->history[3]['request']->getHeaderLine('Authorization'));
    }

    public function testFailedRefreshDestroysSession(): void
    {
        $this->boot([
            new UpstreamResponse(401, [], '{}'),
            new UpstreamResponse(401, [], '{}'), // sondeo: el token ya no vale
            new UpstreamResponse(400, [], '{"error":"invalid_grant"}'),
        ]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('GET', '/bff/v1/things/1', $sid));

        self::assertSame(401, $response->getStatusCode());
        self::assertSame('session_expired', $this->json($response)['code']);
        self::assertNull($this->store->load($sid));
        self::assertStringContainsString('Max-Age=0', $response->getHeaderLine('Set-Cookie'));
    }

    public function testRefreshTokenSurvivesWhenBackendDoesNotRotate(): void
    {
        $this->boot([
            $this->upstreamOk('{"access_token":"access-2","expires_in":3600}'),
            $this->upstreamOk(),
        ]);
        $sid = $this->loginSession(new TokenSet('access-1', 'refresh-1', time() + 5, time() + 7200));
        $this->send($this->request('GET', '/bff/v1/things/1', $sid));

        $stored = $this->store->load($sid);
        self::assertIsArray($stored);
        self::assertSame('refresh-1', $this->vault->open((string) $stored['tokens'])?->refreshToken);
    }

    public function testWildcardQueryForwardsEverythingExceptAction(): void
    {
        $this->boot([$this->upstreamOk()]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('GET', '/bff/v1/api_spa_list?page=2&filtro[]=a&action=drop_database', $sid));

        self::assertSame(200, $response->getStatusCode());
        parse_str((string) $this->history[0]['request']->getUri()->getQuery(), $q);
        self::assertSame('api_spa_list', $q['action']);
        self::assertSame('2', $q['page']);
        self::assertSame(['a'], $q['filtro']);
    }

    public function testManualRouteOverridesIncludedOne(): void
    {
        $this->boot([$this->upstreamOk()]);
        $sid = $this->loginSession();
        $this->send($this->request('POST', '/bff/v1/things', $sid, $this->unsafeHeaders(), '{}'));

        parse_str((string) $this->history[0]['request']->getUri()->getQuery(), $q);
        self::assertSame('api_thing_create', $q['action']);
    }

    public function testClientErrorKeepsBackendFieldsAsExtensions(): void
    {
        $this->boot([new UpstreamResponse(422, ['Content-Type' => 'application/json'], '{"success":false,"error":"package_id required","error_code":"VALIDATION_ERROR","details":{"fields":["package_id required"]},"code":"x","status":1}')]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('GET', '/bff/v1/api_spa_list', $sid));
        $body = $this->json($response);

        self::assertSame(422, $response->getStatusCode());
        self::assertSame('VALIDATION_ERROR', $body['code']);
        self::assertSame('package_id required', $body['error']);
        self::assertSame(['fields' => ['package_id required']], $body['details']);
        self::assertSame(422, $body['status'], 'los miembros reservados no los pisa el backend');
    }

    public function testDeniedActionBlocksWritesButNotReads(): void
    {
        $this->boot([$this->upstreamOk()]);
        $sid = $this->loginSession();

        $blocked = $this->send($this->request('POST', '/bff/v1/api_spa_book', $sid, $this->unsafeHeaders(), '{}'));
        self::assertSame(403, $blocked->getStatusCode());
        self::assertSame('action_blocked', $this->json($blocked)['code']);
        $byPattern = $this->send($this->request('DELETE', '/bff/v1/api_thing_cancel', $sid, $this->unsafeHeaders()));
        self::assertSame('action_blocked', $this->json($byPattern)['code']);
        self::assertCount(0, $this->history, 'una acción bloqueada no llega al backend');

        $read = $this->send($this->request('GET', '/bff/v1/api_spa_book', $sid));
        self::assertSame(200, $read->getStatusCode());
        self::assertCount(1, $this->history);
    }

    public function testStreamRouteIsMarkedForUnbufferedEmission(): void
    {
        $this->boot([new UpstreamResponse(200, ['Content-Type' => 'text/event-stream', 'Content-Length' => '99'], "data: 1\n\n")]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('GET', '/bff/v1/api_spa_stream', $sid));

        self::assertSame('1', $response->getHeaderLine(\Findair\Bff\Http\StreamingEmitter::MARKER));
        self::assertSame('no', $response->getHeaderLine('X-Accel-Buffering'));
        self::assertSame('no-cache, no-transform', $response->getHeaderLine('Cache-Control'));
        self::assertFalse($response->hasHeader('Content-Length'), 'un stream no declara longitud');
        self::assertSame('text/event-stream', $response->getHeaderLine('Content-Type'));
        self::assertEquals(0, $this->history[0]['options']['timeout'] ?? null);
        self::assertSame(120.0, (float) ($this->history[0]['options']['read_timeout'] ?? 0));
    }

    public function testNonStreamResponseHasNoMarker(): void
    {
        $this->boot([$this->upstreamOk()]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('GET', '/bff/v1/api_spa_list', $sid));

        self::assertFalse($response->hasHeader(\Findair\Bff\Http\StreamingEmitter::MARKER));
    }

    public function testRouteThatReturns401ForValidTokenDoesNotEndTheSession(): void
    {
        $this->boot([
            new UpstreamResponse(401, [], ''),
            $this->upstreamOk('{"username":"jose"}'), // sondeo: el token sigue siendo válido
        ]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('GET', '/bff/v1/things/1', $sid));

        self::assertSame(403, $response->getStatusCode());
        self::assertSame('upstream_unauthorized', $this->json($response)['code']);
        self::assertNotNull($this->store->load($sid), 'la sesión sigue viva');
        self::assertCount(2, $this->history, 'sin intento de refresco');
    }

    public function testStillUnauthorizedAfterRefreshIsReportedAsForbidden(): void
    {
        $this->boot([
            new UpstreamResponse(401, [], ''),
            new UpstreamResponse(401, [], ''), // sondeo: token muerto
            $this->upstreamOk('{"access_token":"access-2","refresh_token":"refresh-2","expires_in":3600}'),
            new UpstreamResponse(401, [], ''), // la ruta sigue rechazando con el token nuevo
        ]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('GET', '/bff/v1/things/1', $sid));

        self::assertSame(403, $response->getStatusCode());
        self::assertSame('upstream_unauthorized', $this->json($response)['code']);
        self::assertNotNull($this->store->load($sid));
    }

    public function testExcludedIncludedRouteIsNotExposed(): void
    {
        $this->boot([$this->upstreamOk()]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('GET', '/bff/v1/api_spa_excluded', $sid));

        self::assertSame(404, $response->getStatusCode());
        self::assertCount(0, $this->history);
    }
}
