<?php

declare(strict_types=1);

namespace Findair\Bff\Tests;

use Findair\Bff\Auth\TokenSet;
use Findair\Bff\Proxy\RouteManifest;
use Findair\Bff\Session\Session;
use GuzzleHttp\Psr7\Response as UpstreamResponse;

/**
 * El punto de autorización por OTP: quien presenta el OTP no tiene usuario; el OTP autoriza el acceso a UN recurso y ante el
 * API se autentica la aplicación con su Bearer. Solo si el API autoriza hay sesión.
 */
final class OtpFlowTest extends AppTestCase
{
    private const AUTHORIZED = '{"success":true,"authorized":true,"resource":{"type":"cargo_offer","id":12,"state":"open"},"scopes":["view","answer"],"expires_at":1900000000}';
    private const DENIED = '{"success":true,"authorized":false}';
    private const TOKEN = '{"access_token":"APPTOKEN","expires_in":3600}';

    private function lastUpstreamRequest(): \Psr\Http\Message\RequestInterface
    {
        return $this->history[array_key_last($this->history)]['request'];
    }

    /** @return array<string, string> */
    private function otpHeaders(): array
    {
        return ['Origin' => self::ORIGIN, 'Content-Type' => 'application/json'];
    }

    /** @param array<string, mixed> $body */
    private function authorize(array $body = ['id' => 12, 'otp' => 'AbC123'], ?string $sessionId = null): \Psr\Http\Message\ResponseInterface
    {
        return $this->send($this->request('POST', '/bff/auth/otp', $sessionId, $this->otpHeaders(), json_encode($body, JSON_THROW_ON_ERROR)));
    }

    /** Abre una sesión OTP de verdad y devuelve su id. */
    private function otpSession(): string
    {
        $this->boot([$this->upstreamOk(self::TOKEN), $this->upstreamOk(self::AUTHORIZED)]);

        return $this->cookieId($this->authorize());
    }

    public function testAuthorizedOtpOpensASessionWithTheAppBearerAndAGrant(): void
    {
        $this->boot([$this->upstreamOk(self::TOKEN), $this->upstreamOk(self::AUTHORIZED)]);

        $response = $this->authorize();

        self::assertSame(200, $response->getStatusCode());
        $payload = $this->json($response);
        self::assertTrue($payload['authenticated']);
        self::assertSame('otp', $payload['kind']);
        self::assertSame(['type' => 'cargo_offer', 'id' => 12, 'state' => 'open'], $payload['resource']);
        self::assertSame(['view', 'answer'], $payload['scopes']);
        self::assertNotSame('', $payload['csrf_token']);
        self::assertArrayNotHasKey('access_token', $payload, 'el navegador nunca ve el Bearer');

        // 1) negocia el Bearer de la aplicación; 2) pregunta al API con él.
        parse_str((string) $this->history[0]['request']->getBody(), $form);
        self::assertSame('client_credentials', $form['grant_type']);
        self::assertSame('csecret', $form['client_secret']);
        $ask = $this->history[1]['request'];
        self::assertSame('Bearer APPTOKEN', $ask->getHeaderLine('Authorization'));
        self::assertStringContainsString('action=api_otp_authorize', (string) $ask->getUri());
        self::assertSame(['type' => 'cargo_offer', 'id' => 12, 'otp' => 'AbC123'], json_decode((string) $ask->getBody(), true));

        // La sesión guarda el Bearer sellado y la concesión; el OTP no queda en claro.
        $stored = $this->store->load($this->cookieId($response));
        self::assertIsArray($stored);
        self::assertSame('APPTOKEN', $this->vault->open((string) $stored['tokens'])?->accessToken);
        self::assertSame('cargo_offer', $stored['grant']['type']);
        self::assertSame(12, $stored['grant']['id']);
        self::assertSame('AbC123', $this->vault->openString((string) $stored['grant']['otp']));
        self::assertStringNotContainsString('AbC123', json_encode($stored, JSON_THROW_ON_ERROR));
        self::assertArrayNotHasKey('context', $stored, 'sin usuario: no hay contexto de usuario');
    }

    public function testDeniedOtpCreatesNoSessionAndRevokesTheBearer(): void
    {
        $this->boot([$this->upstreamOk(self::TOKEN), $this->upstreamOk(self::DENIED), $this->upstreamOk('{}')]);

        $response = $this->authorize();

        self::assertSame(403, $response->getStatusCode());
        self::assertSame('otp_not_authorized', $this->json($response)['code']);
        self::assertSame('', $response->getHeaderLine('Set-Cookie'), 'un intento fallido no deja sesión ni cookie');
        self::assertStringContainsString('revoke', (string) $this->history[2]['request']->getUri(), 'el Bearer negociado se revoca');
    }

    /**
     * @dataProvider malformedBodies
     * @param array<string, mixed> $body
     */
    public function testMalformedRequestsAreDeniedWithoutTouchingTheApi(array $body): void
    {
        $this->boot();

        $response = $this->authorize($body);

        self::assertSame(403, $response->getStatusCode());
        self::assertSame('otp_not_authorized', $this->json($response)['code']);
        self::assertCount(0, $this->history);
    }

    /** @return array<string, array{0: array<string, mixed>}> */
    public static function malformedBodies(): array
    {
        return [
            'otp con comillas' => [['id' => 12, 'otp' => "x' OR '1'='1"]],
            'otp vacío' => [['id' => 12, 'otp' => '']],
            'otp demasiado largo' => [['id' => 12, 'otp' => str_repeat('a', 13)]],
            'otp no es texto' => [['id' => 12, 'otp' => ['a']]],
            'id no numérico' => [['id' => '12; DROP', 'otp' => 'AbC123']],
            'sin id' => [['otp' => 'AbC123']],
            'tipo desconocido' => [['type' => 'otra_cosa', 'id' => 12, 'otp' => 'AbC123']],
        ];
    }

    public function testAnApiFailureIsUnavailableNotDeniedAndDoesNotCountAsAFailedAttempt(): void
    {
        $this->boot([$this->upstreamOk(self::TOKEN), new UpstreamResponse(500, [], 'boom'), $this->upstreamOk('{}')]);

        $response = $this->authorize();

        self::assertSame(503, $response->getStatusCode());
        self::assertSame('otp_unavailable', $this->json($response)['code']);
        self::assertSame(0, $this->counters->get('otp:f:r:cargo_offer:12'), 'un fallo del API no es culpa de quien presenta el OTP');
    }

    public function testTokenNegotiationFailureIsUnavailable(): void
    {
        $this->boot([new UpstreamResponse(401, [], '{"error":"invalid_client"}')]);

        self::assertSame(503, $this->authorize()->getStatusCode());
    }

    public function testRepeatedFailuresLockTheResourceWithoutTouchingTheApi(): void
    {
        $queue = [];
        for ($i = 0; $i < 8; $i++) {
            array_push($queue, $this->upstreamOk(self::TOKEN), $this->upstreamOk(self::DENIED), $this->upstreamOk('{}'));
        }
        $this->boot($queue);
        for ($i = 0; $i < 8; $i++) {
            self::assertSame(403, $this->authorize()->getStatusCode());
        }
        $calls = count($this->history);

        $locked = $this->authorize(['id' => 12, 'otp' => 'AbC123']);

        self::assertSame(429, $locked->getStatusCode());
        self::assertSame('otp_locked', $this->json($locked)['code']);
        self::assertNotSame('', $locked->getHeaderLine('Retry-After'));
        self::assertCount($calls, $this->history, 'bloqueado: ni siquiera se pregunta al API, aunque el OTP fuera el bueno');
    }

    public function testTheLockCountsEvenForResourcesThatDoNotExist(): void
    {
        // Un contador que solo existiera para ofertas reales sería un oráculo de existencia.
        $this->boot();
        for ($i = 0; $i < 8; $i++) {
            self::assertSame(403, $this->authorize(['id' => 999999, 'otp' => "bad'"])->getStatusCode());
        }

        self::assertSame(429, $this->authorize(['id' => 999999, 'otp' => 'AbC123'])->getStatusCode());
        self::assertSame(403, $this->authorize(['id' => 5, 'otp' => "bad'"])->getStatusCode(), 'otro recurso, otro contador');
    }

    public function testSuccessClearsTheResourceCounter(): void
    {
        $this->boot([
            $this->upstreamOk(self::TOKEN), $this->upstreamOk(self::DENIED), $this->upstreamOk('{}'),
            $this->upstreamOk(self::TOKEN), $this->upstreamOk(self::AUTHORIZED),
        ]);
        $this->authorize();
        self::assertSame(1, $this->counters->get('otp:f:r:cargo_offer:12'));

        self::assertSame(200, $this->authorize()->getStatusCode());
        self::assertSame(0, $this->counters->get('otp:f:r:cargo_offer:12'));
    }

    public function testAnOperatorSessionIsNotOverwrittenByAnOtpLink(): void
    {
        $this->boot();
        $sid = $this->loginSession();

        $response = $this->authorize(['id' => 12, 'otp' => 'AbC123'], $sid);

        self::assertSame(409, $response->getStatusCode());
        self::assertSame('session_in_use', $this->json($response)['code']);
        self::assertNotNull($this->store->load($sid), 'la sesión del operador sigue ahí');
        self::assertCount(0, $this->history);
    }

    public function testOriginIsRequired(): void
    {
        $this->boot();

        $response = $this->send($this->request('POST', '/bff/auth/otp', null, ['Content-Type' => 'application/json'], '{"id":12,"otp":"AbC123"}'));

        self::assertSame(403, $response->getStatusCode());
        self::assertSame('origin_not_allowed', $this->json($response)['code']);
    }

    public function testSessionInfoDescribesAnOtpSession(): void
    {
        $sid = $this->otpSession();

        $info = $this->json($this->send($this->request('GET', '/bff/auth/session', $sid)));

        self::assertTrue($info['authenticated']);
        self::assertSame('otp', $info['kind']);
        self::assertSame(['type' => 'cargo_offer', 'id' => 12], $info['resource']);
        self::assertArrayNotHasKey('user', $info);
        self::assertArrayNotHasKey('capabilities', $info);
    }

    public function testTheProxyInjectsTheGrantAndIgnoresWhatTheBrowserSends(): void
    {
        $sid = $this->otpSession();
        $this->upstream->append($this->upstreamOk('{"success":true,"found":true}'));

        $response = $this->send($this->request('GET', '/bff/v1/otp_offer?id=999&otp=HACK&extra=1', $sid));

        self::assertSame(200, $response->getStatusCode());
        $sent = $this->lastUpstreamRequest();
        parse_str($sent->getUri()->getQuery(), $query);
        self::assertSame('api_carrier_offer', $query['action']);
        self::assertSame('12', $query['id'], 'el id sale de la concesión');
        self::assertSame('AbC123', $query['otp'], 'el OTP sale de la concesión, sellado en la sesión');
        self::assertArrayNotHasKey('extra', $query);
        self::assertSame('Bearer APPTOKEN', $sent->getHeaderLine('Authorization'));
    }

    public function testAnOtpSessionCannotReachAnyOtherRoute(): void
    {
        $sid = $this->otpSession();
        $calls = count($this->history);

        foreach (['/bff/v1/things/1', '/bff/v1/nocheck', '/bff/v1/legacy'] as $path) {
            $response = $this->send($this->request('GET', $path, $sid));
            self::assertSame(403, $response->getStatusCode(), $path);
            self::assertSame('otp_scope', $this->json($response)['code'], $path);
        }
        self::assertCount($calls, $this->history, 'nada llegó al API');
    }

    private const COURIER_TOKEN = 't0123456789abcdef0123456789abcdef';
    private const COURIER_AUTHORIZED = '{"success":true,"authorized":true,"resource":{"type":"courier_offer","id":12,"state":"open"},"scopes":["view","answer"],"expires_at":1900000000}';

    public function testACourierOfferOtpOpensASessionOfThatType(): void
    {
        $this->boot([$this->upstreamOk(self::TOKEN), $this->upstreamOk(self::COURIER_AUTHORIZED)]);

        $response = $this->authorize(['type' => 'courier_offer', 'id' => 12, 'otp' => self::COURIER_TOKEN]);

        self::assertSame(200, $response->getStatusCode());
        self::assertSame(['type' => 'courier_offer', 'id' => 12, 'state' => 'open'], $this->json($response)['resource']);
        self::assertSame(
            ['type' => 'courier_offer', 'id' => 12, 'otp' => self::COURIER_TOKEN],
            json_decode((string) $this->history[1]['request']->getBody(), true)
        );
        $stored = $this->store->load($this->cookieId($response));
        self::assertIsArray($stored);
        self::assertSame('courier_offer', $stored['grant']['type']);
        self::assertStringNotContainsString(self::COURIER_TOKEN, json_encode($stored, JSON_THROW_ON_ERROR), 'el OTP no queda en claro');
    }

    public function testTheOtpShapeIsPerType(): void
    {
        // Un token de 33 caracteres no es un OTP de cargo (12) y no llega al API; con el tipo courier sí se pregunta.
        $this->boot();
        $response = $this->authorize(['id' => 12, 'otp' => self::COURIER_TOKEN]);
        self::assertSame(403, $response->getStatusCode());
        self::assertCount(0, $this->history);

        // Y uno de courier no pasa de 33.
        $response = $this->authorize(['type' => 'courier_offer', 'id' => 12, 'otp' => str_repeat('a', 34)]);
        self::assertSame(403, $response->getStatusCode());
        self::assertCount(0, $this->history);
    }

    public function testACargoSessionCannotUseACourierRoute(): void
    {
        [$sid, $csrf] = $this->otpSessionWithCsrf();
        $calls = count($this->history);

        $response = $this->send($this->request('POST', '/bff/v1/otp_courier', $sid, ['Origin' => self::ORIGIN, 'Content-Type' => 'application/json', 'X-CSRF-Token' => $csrf], '{}'));

        self::assertSame(403, $response->getStatusCode());
        self::assertSame('otp_scope', $this->json($response)['code']);
        self::assertCount($calls, $this->history, 'nada llegó al API');
    }

    public function testTheRealManifestHasTheCourierOfferRoutes(): void
    {
        $manifest = RouteManifest::fromFile(__DIR__ . '/../config/routes.bff.yaml');
        foreach (['GET' => null, 'POST' => 'otp_submit'] as $method => $throttle) {
            $hit = $manifest->match($method, '/api_courier_offer');
            self::assertNotNull($hit, $method);
            self::assertSame('courier_offer', $hit['route']->otp, $method);
            self::assertSame('api_courier_offer', $hit['route']->action, $method);
            self::assertFalse($hit['route']->forwardAllQuery, $method);
            self::assertSame($throttle, $hit['route']->throttle, $method);
        }
    }

    public function testAnOtpSessionCannotUseImpersonationOrWriteRoutes(): void
    {
        $sid = $this->otpSession();

        self::assertSame(403, $this->send($this->request('GET', '/bff/impersonation', $sid))->getStatusCode());
        $write = $this->send($this->request('POST', '/bff/v1/things', $sid, ['Origin' => self::ORIGIN, 'X-CSRF-Token' => 'x', 'Content-Type' => 'application/json'], '{}'));
        self::assertSame(403, $write->getStatusCode());
    }

    public function testAUserSessionCannotUseAnOtpRoute(): void
    {
        $this->boot();
        $sid = $this->loginSession();

        $response = $this->send($this->request('GET', '/bff/v1/otp_offer?id=12&otp=AbC123', $sid));

        self::assertSame(403, $response->getStatusCode());
        self::assertSame('otp_scope', $this->json($response)['code']);
        self::assertCount(0, $this->history);
    }

    public function testAnOtpRouteNeedsASession(): void
    {
        $this->boot();

        self::assertSame(401, $this->send($this->request('GET', '/bff/v1/otp_offer'))->getStatusCode());
    }

    public function testAnOtpSessionRenegotiatesTheBearerWhenItExpires(): void
    {
        $this->boot();
        $sid = Session::generateId();
        $this->store->save($sid, [
            'created_at' => time(),
            'csrf' => 'csrf-token',
            'tokens' => $this->vault->seal(new TokenSet('OLD', '', time() + 10)), // caduca en 10 s: dentro del margen
            'grant' => ['type' => 'cargo_offer', 'id' => 12, 'otp' => $this->vault->sealString('AbC123'), 'scopes' => ['view'], 'at' => time()],
        ], 7200);
        $this->upstream->append($this->upstreamOk('{"access_token":"NEW","expires_in":3600}'), $this->upstreamOk('{"success":true,"found":true}'));

        $response = $this->send($this->request('GET', '/bff/v1/otp_offer', $sid));

        self::assertSame(200, $response->getStatusCode());
        parse_str((string) $this->history[0]['request']->getBody(), $form);
        self::assertSame('client_credentials', $form['grant_type'], 'sin refresh token: se negocia otro Bearer');
        self::assertSame('Bearer NEW', $this->lastUpstreamRequest()->getHeaderLine('Authorization'));
    }

    public function testTheOtpSessionHasItsOwnIdleTtl(): void
    {
        $this->boot();
        self::assertSame(1800, $this->settings->sessionIdleTtlFor(false));
        self::assertSame(7200, $this->settings->sessionIdleTtlFor(true));

        // Y se guarda con él: una sesión OTP no caduca a los 30 min de un usuario.
        $this->extraEnv = ['OTP_SESSION_IDLE_TTL' => '5400'];
        $this->boot([$this->upstreamOk(self::TOKEN), $this->upstreamOk(self::AUTHORIZED)]);
        self::assertSame(5400, $this->settings->otpSessionIdleTtl);
    }

    public function testTheManifestAcceptsTheOtpAttributeAndRejectsABadOne(): void
    {
        $manifest = RouteManifest::fromFile(__DIR__ . '/../config/routes.bff.yaml');
        $hit = $manifest->match('GET', '/api_carrier_offer');
        self::assertNotNull($hit);
        self::assertSame('cargo_offer', $hit['route']->otp);
        self::assertSame('api_carrier_offer', $hit['route']->action);
        self::assertFalse($hit['route']->forwardAllQuery, 'id y otp no se reenvían desde el navegador');

        $this->expectException(\InvalidArgumentException::class);
        RouteManifest::fromArray([['id' => 'x', 'method' => 'GET', 'path' => '/x', 'upstream' => ['action' => 'a'], 'otp' => 'Bad Type!']]);
    }

    /** @return array{0: string, 1: string} id de sesión y token CSRF de una sesión OTP recién abierta */
    private function otpSessionWithCsrf(): array
    {
        $this->boot([$this->upstreamOk(self::TOKEN), $this->upstreamOk(self::AUTHORIZED)]);
        $response = $this->authorize();

        return [$this->cookieId($response), (string) $this->json($response)['csrf_token']];
    }

    /** @param array<string, string> $extra */
    private function submitRequest(string $sid, string $csrf, string $body, array $extra = []): \Psr\Http\Message\ServerRequestInterface
    {
        return $this->request('POST', '/bff/v1/otp_offer', $sid, $extra + ['Origin' => self::ORIGIN, 'X-CSRF-Token' => $csrf, 'Content-Type' => 'application/json'], $body);
    }

    public function testSubmitForwardsTheReplyWithTheGrantAndWithoutTheKeysThatIdentifyTheResource(): void
    {
        [$sid, $csrf] = $this->otpSessionWithCsrf();
        $this->upstream->append($this->upstreamOk('{"success":true,"state":"submitted","total":625}'));
        $body = json_encode(['id' => 999, 'otp' => 'HACK', 'type' => 'otra', 'chargeable_weight' => 100, 'confirm' => ['price' => true, 'terms' => true], 'lines' => [['id' => 1, 'costo_unitV' => 6]]], JSON_THROW_ON_ERROR);

        $response = $this->send($this->submitRequest($sid, $csrf, $body, ['Content-Length' => (string) strlen($body)]));

        self::assertSame(200, $response->getStatusCode());
        $sent = $this->lastUpstreamRequest();
        self::assertSame('POST', $sent->getMethod());
        parse_str($sent->getUri()->getQuery(), $query);
        self::assertSame('12', $query['id'], 'el id sale de la concesión');
        self::assertSame('AbC123', $query['otp']);
        self::assertSame('Bearer APPTOKEN', $sent->getHeaderLine('Authorization'));
        $forwarded = json_decode((string) $sent->getBody(), true);
        self::assertEqualsCanonicalizing(['chargeable_weight', 'confirm', 'lines'], array_keys($forwarded));
        self::assertArrayNotHasKey('id', $forwarded);
        self::assertArrayNotHasKey('otp', $forwarded);
        self::assertArrayNotHasKey('type', $forwarded);
        self::assertSame(625, $this->json($response)['total']);
    }

    public function testSubmitNeedsTheSessionCsrfToken(): void
    {
        [$sid] = $this->otpSessionWithCsrf();
        $calls = count($this->history);

        $response = $this->send($this->submitRequest($sid, 'otro-token', '{}'));

        self::assertSame(403, $response->getStatusCode());
        self::assertSame('csrf_invalid', $this->json($response)['code']);
        self::assertCount($calls, $this->history);
    }

    public function testSubmitNeedsTheAppOriginToo(): void
    {
        [$sid, $csrf] = $this->otpSessionWithCsrf();

        $response = $this->send($this->request('POST', '/bff/v1/otp_offer', $sid, ['Origin' => 'https://evil.example', 'X-CSRF-Token' => $csrf, 'Content-Type' => 'application/json'], '{}'));

        self::assertSame(403, $response->getStatusCode());
        self::assertSame('origin_not_allowed', $this->json($response)['code']);
    }

    /** @dataProvider unsupportedBodies */
    public function testSubmitOnlyAcceptsAJsonObject(string $body, string $contentType): void
    {
        [$sid, $csrf] = $this->otpSessionWithCsrf();
        $calls = count($this->history);

        $response = $this->send($this->submitRequest($sid, $csrf, $body, ['Content-Type' => $contentType]));

        self::assertSame(415, $response->getStatusCode());
        self::assertCount($calls, $this->history, 'no llega al API');
    }

    /** @return array<string, array{0: string, 1: string}> */
    public static function unsupportedBodies(): array
    {
        return [
            'formulario' => ['id=1&otp=x', 'application/x-www-form-urlencoded'],
            'multipart' => ['--b', 'multipart/form-data; boundary=b'],
            'json pero lista' => ['[1,2]', 'application/json'],
            'json escalar' => ['"hola"', 'application/json'],
            'no es json' => ['{nope', 'application/json'],
        ];
    }

    public function testAUserSessionCannotSubmitThroughAnOtpRoute(): void
    {
        $this->boot();
        $sid = $this->loginSession();

        $response = $this->send($this->request('POST', '/bff/v1/otp_offer', $sid, $this->unsafeHeaders(), '{}'));

        self::assertSame(403, $response->getStatusCode());
        self::assertSame('otp_scope', $this->json($response)['code']);
        self::assertCount(0, $this->history);
    }

    public function testSubmitIsRateLimitedPerSession(): void
    {
        [$sid, $csrf] = $this->otpSessionWithCsrf();
        for ($i = 0; $i < 10; $i++) {
            $this->upstream->append($this->upstreamOk('{"success":true}'));
        }

        $codes = [];
        for ($i = 0; $i < 11; $i++) {
            $codes[] = $this->send($this->submitRequest($sid, $csrf, '{}'))->getStatusCode();
        }

        self::assertSame(array_merge(array_fill(0, 10, 200), [429]), $codes, '10 envíos por minuto y sesión');
    }

    public function testTheSubmitRouteIsInTheRealManifest(): void
    {
        $manifest = RouteManifest::fromFile(__DIR__ . '/../config/routes.bff.yaml');
        $hit = $manifest->match('POST', '/api_carrier_offer');
        self::assertNotNull($hit);
        self::assertSame('cargo_offer', $hit['route']->otp);
        self::assertTrue($hit['route']->csrf);
        self::assertSame('otp_submit', $hit['route']->throttle);
        self::assertFalse($hit['route']->forwardAllQuery);
    }

    public function testADownloadIsForwardedWithOnlyTheDeclaredQueryAndKeepsTheAttachmentHeaders(): void
    {
        $sid = $this->otpSession();
        $this->upstream->append(new UpstreamResponse(200, ['Content-Type' => 'application/pdf', 'Content-Disposition' => 'attachment; filename="pl.pdf"', 'Cache-Control' => 'private, no-store'], '%PDF-1.4 fake'));

        $response = $this->send($this->request('GET', '/bff/v1/otp_file?idf=40&n=2&id=999&otp=HACK&x=1', $sid));

        self::assertSame(200, $response->getStatusCode());
        self::assertSame('application/pdf', $response->getHeaderLine('Content-Type'));
        self::assertSame('attachment; filename="pl.pdf"', $response->getHeaderLine('Content-Disposition'));
        self::assertSame('%PDF-1.4 fake', (string) $response->getBody());
        parse_str($this->lastUpstreamRequest()->getUri()->getQuery(), $query);
        self::assertSame('40', $query['idf']);
        self::assertSame('2', $query['n']);
        self::assertSame('12', $query['id'], 'el id sale de la concesión');
        self::assertSame('AbC123', $query['otp']);
        self::assertArrayNotHasKey('x', $query);
    }

    public function testADownloadNeedsNoCsrfButAnUnknownFileIsA404FromTheApi(): void
    {
        $sid = $this->otpSession();
        $this->upstream->append(new UpstreamResponse(404, ['Content-Type' => 'application/json'], '{"success":true,"found":false}'));

        self::assertSame(404, $this->send($this->request('GET', '/bff/v1/otp_file?idf=999', $sid))->getStatusCode());
    }

    public function testAnUploadIsForwardedUntouchedWithTheBoundaryAndTheGrantInTheQuery(): void
    {
        [$sid, $csrf] = $this->otpSessionWithCsrf();
        $this->upstream->append($this->upstreamOk('{"success":true,"slot":1,"name":"rates.pdf"}'));
        $body = "--b\r\nContent-Disposition: form-data; name=\"file\"; filename=\"rates.pdf\"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.4\r\n--b\r\nContent-Disposition: form-data; name=\"id\"\r\n\r\n999\r\n--b--\r\n";

        $response = $this->send($this->request('POST', '/bff/v1/otp_upload', $sid, ['Origin' => self::ORIGIN, 'X-CSRF-Token' => $csrf, 'Content-Type' => 'multipart/form-data; boundary=b'], $body));

        self::assertSame(200, $response->getStatusCode());
        $sent = $this->lastUpstreamRequest();
        self::assertSame($body, (string) $sent->getBody(), 'un fichero no se reescribe');
        self::assertSame('multipart/form-data; boundary=b', $sent->getHeaderLine('Content-Type'));
        parse_str($sent->getUri()->getQuery(), $query);
        self::assertSame('12', $query['id'], 'el recurso va en la query, desde la concesión');
        self::assertSame('AbC123', $query['otp']);
    }

    public function testAnUploadRouteRejectsAJsonBodyAndAJsonRouteRejectsAnUpload(): void
    {
        [$sid, $csrf] = $this->otpSessionWithCsrf();
        $calls = count($this->history);
        $headers = ['Origin' => self::ORIGIN, 'X-CSRF-Token' => $csrf];

        $json = $this->send($this->request('POST', '/bff/v1/otp_upload', $sid, $headers + ['Content-Type' => 'application/json'], '{"a":1}'));
        $multipart = $this->send($this->request('POST', '/bff/v1/otp_offer', $sid, $headers + ['Content-Type' => 'multipart/form-data; boundary=b'], "--b\r\n--b--\r\n"));

        self::assertSame(415, $json->getStatusCode());
        self::assertSame(415, $multipart->getStatusCode());
        self::assertCount($calls, $this->history);
    }

    public function testAnUploadNeedsCsrfAndIsLimitedPerSession(): void
    {
        [$sid, $csrf] = $this->otpSessionWithCsrf();
        $mp = ['Content-Type' => 'multipart/form-data; boundary=b'];

        $noCsrf = $this->send($this->request('POST', '/bff/v1/otp_upload', $sid, ['Origin' => self::ORIGIN, 'X-CSRF-Token' => 'otro'] + $mp, "--b\r\n--b--\r\n"));
        self::assertSame(403, $noCsrf->getStatusCode());

        for ($i = 0; $i < 8; $i++) {
            $this->upstream->append($this->upstreamOk('{"success":true}'));
        }
        $codes = [];
        for ($i = 0; $i < 9; $i++) {
            $codes[] = $this->send($this->request('POST', '/bff/v1/otp_upload', $sid, ['Origin' => self::ORIGIN, 'X-CSRF-Token' => $csrf] + $mp, "--b\r\n--b--\r\n"))->getStatusCode();
        }
        self::assertSame(array_merge(array_fill(0, 8, 200), [429]), $codes, '8 subidas por minuto y sesión');
    }

    public function testTheFileCsvAndPdfRoutesAreInTheRealManifest(): void
    {
        $manifest = RouteManifest::fromFile(__DIR__ . '/../config/routes.bff.yaml');
        foreach ([['GET', '/api_carrier_offer_file', 'binary', false], ['POST', '/api_carrier_offer_file', 'json', true], ['GET', '/api_carrier_offer_packages', 'binary', false],
                  ['GET', '/api_carrier_offer_pdf', 'binary', false], ['POST', '/api_carrier_offer_pdf', 'json', false]] as [$method, $path, $response, $multipart]) {
            $hit = $manifest->match($method, $path);
            self::assertNotNull($hit, "{$method} {$path}");
            self::assertSame('cargo_offer', $hit['route']->otp, "{$method} {$path}");
            self::assertSame($response, $hit['route']->response, "{$method} {$path}");
            self::assertSame($multipart, $hit['route']->multipart, "{$method} {$path}");
            self::assertFalse($hit['route']->forwardAllQuery, "{$method} {$path}");
        }
        $upload = $manifest->match('POST', '/api_carrier_offer_file');
        $mail = $manifest->match('POST', '/api_carrier_offer_pdf');
        self::assertNotNull($upload);
        self::assertNotNull($mail);
        self::assertSame('otp_upload', $upload['route']->throttle);
        self::assertSame('otp_mail', $mail['route']->throttle);
    }

    public function testMultipartOnlyMakesSenseWithOtp(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        RouteManifest::fromArray([['id' => 'x', 'method' => 'POST', 'path' => '/x', 'upstream' => ['action' => 'a'], 'multipart' => true]]);
    }

    /** @return array{0: string, 1: string} */
    private function tmpFile(string $bytes): array
    {
        $path = tempnam(sys_get_temp_dir(), 'bffup');
        file_put_contents($path, $bytes);

        return [$path, (string) strlen($bytes)];
    }

    public function testAParsedUploadIsRebuiltWithOnlyTheFileField(): void
    {
        // En FPM php://input está vacío para multipart/form-data: el fichero llega ya parseado.
        [$sid, $csrf] = $this->otpSessionWithCsrf();
        $this->upstream->append($this->upstreamOk('{"success":true,"slot":1}'));
        [$path, $size] = $this->tmpFile('%PDF-1.4 rates');
        $request = $this->request('POST', '/bff/v1/otp_upload', $sid, ['Origin' => self::ORIGIN, 'X-CSRF-Token' => $csrf, 'Content-Type' => 'multipart/form-data; boundary=orig'])
            ->withUploadedFiles(['file' => new \Slim\Psr7\UploadedFile($path, 'rates.pdf', 'application/pdf', (int) $size, UPLOAD_ERR_OK)])
            ->withParsedBody(['id' => '999', 'otp' => 'HACK']);

        $response = $this->send($request);

        self::assertSame(200, $response->getStatusCode());
        $sent = $this->lastUpstreamRequest();
        $body = (string) $sent->getBody();
        self::assertStringContainsString('name="file"; filename="rates.pdf"', $body);
        self::assertStringContainsString('Content-Type: application/pdf', $body);
        self::assertStringContainsString('%PDF-1.4 rates', $body);
        self::assertStringNotContainsString('HACK', $body, 'los demás campos del formulario se descartan');
        self::assertMatchesRegularExpression('#^multipart/form-data; boundary=[A-Za-z0-9]+$#', $sent->getHeaderLine('Content-Type'));
        self::assertStringNotContainsString('orig', $sent->getHeaderLine('Content-Type'), 'boundary nuevo');
        parse_str($sent->getUri()->getQuery(), $query);
        self::assertSame('12', $query['id']);
        unlink($path);
    }

    public function testAnUploadWithoutTheFileFieldOrTooBigOrFailedIsRejectedBeforeTheApi(): void
    {
        [$sid, $csrf] = $this->otpSessionWithCsrf();
        $calls = count($this->history);
        [$path, $size] = $this->tmpFile(str_repeat('a', 5000));
        $headers = ['Origin' => self::ORIGIN, 'X-CSRF-Token' => $csrf, 'Content-Type' => 'multipart/form-data; boundary=b'];

        $wrongField = $this->request('POST', '/bff/v1/otp_upload', $sid, $headers)->withUploadedFiles(['other' => new \Slim\Psr7\UploadedFile($path, 'a.pdf', 'application/pdf', 5000, UPLOAD_ERR_OK)]);
        $tooBig = $this->request('POST', '/bff/v1/otp_upload', $sid, $headers)->withUploadedFiles(['file' => new \Slim\Psr7\UploadedFile($path, 'a.pdf', 'application/pdf', 5000, UPLOAD_ERR_OK)]); // el máximo de la ruta de pruebas es 4k
        $iniLimit = $this->request('POST', '/bff/v1/otp_upload', $sid, $headers)->withUploadedFiles(['file' => new \Slim\Psr7\UploadedFile($path, 'a.pdf', 'application/pdf', 5000, UPLOAD_ERR_INI_SIZE)]);
        $partial = $this->request('POST', '/bff/v1/otp_upload', $sid, $headers)->withUploadedFiles(['file' => new \Slim\Psr7\UploadedFile($path, 'a.pdf', 'application/pdf', 10, UPLOAD_ERR_PARTIAL)]);

        self::assertSame(400, $this->send($wrongField)->getStatusCode());
        self::assertSame(413, $this->send($tooBig)->getStatusCode());
        self::assertSame(413, $this->send($iniLimit)->getStatusCode());
        self::assertSame(400, $this->send($partial)->getStatusCode());
        self::assertCount($calls, $this->history);
        @unlink($path);
    }
}
