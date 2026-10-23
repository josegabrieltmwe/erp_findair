<?php

declare(strict_types=1);

namespace Findair\Bff\Tests;

use Findair\Bff\Proxy\RouteManifest;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Psr7\Request as UpstreamRequest;
use GuzzleHttp\Psr7\Response as UpstreamResponse;
use Psr\Http\Message\ResponseInterface;

/** Manifiesto real del copilot (config/routes.bff.yaml) y comportamiento del proxy con las políticas de límites. */
final class CopilotRoutesTest extends AppTestCase
{
    private function manifest(): RouteManifest
    {
        return RouteManifest::fromFile(__DIR__ . '/../config/routes.bff.yaml');
    }

    public function testWriteProposalRouteIsPostOnlyCsrfWithFixedActionAndLimits(): void
    {
        $manifest = $this->manifest();
        $hit = $manifest->match('POST', '/api_copilot_write_proposal');

        self::assertNotNull($hit);
        $route = $hit['route'];
        self::assertSame('copilot.write_proposal', $route->id);
        self::assertSame('api_copilot_write_proposal', $route->action);
        self::assertSame('POST', $route->upstreamMethod);
        self::assertTrue($route->csrf, 'CSRF obligatorio');
        self::assertFalse($route->legacyEnvelope, 'los errores son HTTP 4xx/5xx, no 200 con success:false');
        self::assertSame('json', $route->response);
        self::assertSame(64 * 1024, $route->maxBody);
        self::assertSame(30.0, $route->timeout);
        self::assertSame([], $route->forwardQuery);
        self::assertFalse($route->forwardAllQuery, 'action y query no vienen del cliente');
        self::assertSame(['op' => ['confirmar']], $route->bodyEnum);
        self::assertSame('copilot_confirm', $route->throttle);
        foreach (['GET', 'PUT', 'PATCH', 'DELETE'] as $method) {
            self::assertNull($manifest->match($method, '/api_copilot_write_proposal'), "{$method} no debe estar");
        }
        self::assertTrue($manifest->pathExists('/api_copilot_write_proposal'), 'otro método da 405, no 404');
    }

    public function testCopilotChatHasThrottleAndKeepsItsLimits(): void
    {
        $route = $this->manifest()->match('POST', '/copilot_chat')['route'] ?? null;

        self::assertNotNull($route);
        self::assertSame('copilot_chat', $route->throttle);
        self::assertSame(1024 * 1024, $route->maxBody);
        self::assertSame(120.0, $route->timeout);
        self::assertTrue($route->csrf);
    }

    public function testMemoryContextIsNotExposed(): void
    {
        // La memoria de voz se pide desde el flujo de voz del backend; el chat de texto no la necesita.
        self::assertNull($this->manifest()->match('POST', '/api_copilot_memory_context'));
        self::assertNull($this->manifest()->match('GET', '/api_copilot_memory_context'));
    }

    public function testProductionRoutesDeclareKnownThrottlePolicies(): void
    {
        $this->boot();
        foreach ($this->manifest()->all() as $route) {
            if ($route->throttle !== null) {
                self::assertArrayHasKey($route->throttle, $this->settings->throttlePolicies, "política desconocida en {$route->id}");
            }
        }
    }

    public function testManifestRejectsUndefinedThrottlePolicy(): void
    {
        $manifest = RouteManifest::fromArray([['id' => 'x', 'method' => 'POST', 'path' => '/x', 'upstream' => ['action' => 'x'], 'throttle' => 'copilot_confrim']]);
        $manifest->assertThrottlePolicies(['copilot_confrim']);
        $this->expectException(\InvalidArgumentException::class);
        $manifest->assertThrottlePolicies(['copilot_chat', 'copilot_confirm']);
    }

    public function testManifestRejectsBadThrottleAndBodyEnum(): void
    {
        $base = ['id' => 'x', 'method' => 'POST', 'path' => '/x', 'upstream' => ['action' => 'x']];
        foreach ([['throttle' => 'Bad Name'], ['body_enum' => ['op' => []]], ['body_enum' => ['op' => 'confirmar']]] as $extra) {
            try {
                RouteManifest::fromArray([$base + $extra]);
                self::fail('debió rechazar ' . json_encode($extra));
            } catch (\InvalidArgumentException) {
                self::assertTrue(true);
            }
        }
    }

    // ---- Proxy: sin sesión, CSRF, cuerpo ----

    public function testConfirmWithoutSessionIs401AndNeverReachesUpstream(): void
    {
        $this->boot();
        $response = $this->send($this->request('POST', '/bff/v1/confirm', null, $this->unsafeHeaders(), '{"op":"confirmar"}'));

        self::assertSame(401, $response->getStatusCode());
        self::assertCount(0, $this->history);
    }

    public function testConfirmWithoutCsrfIs403AndDoesNotConsumeRateBudget(): void
    {
        $this->boot();
        $sid = $this->loginSession();
        $headers = ['Origin' => self::ORIGIN, 'Content-Type' => 'application/json'];
        $response = $this->send($this->request('POST', '/bff/v1/confirm', $sid, $headers, '{"op":"confirmar"}'));

        self::assertSame(403, $response->getStatusCode());
        self::assertSame('csrf_invalid', $this->json($response)['code']);
        self::assertCount(0, $this->history);
        self::assertSame(0, $this->counters->value('rl:copilot_confirm:u:' . substr(hash('sha256', 'session:' . $sid), 0, 20) . ':' . intdiv(time(), 60)));
    }

    public function testConfirmWrongMethodIs405(): void
    {
        $this->boot();
        $sid = $this->loginSession();
        $response = $this->send($this->request('GET', '/bff/v1/confirm', $sid));

        self::assertSame(405, $response->getStatusCode());
        self::assertSame('method_not_allowed', $this->json($response)['code']);
    }

    public function testConfirmBodyOverLimitIs413(): void
    {
        $this->boot();
        $sid = $this->loginSession();
        $body = '{"op":"confirmar","pad":"' . str_repeat('x', 2000) . '"}';
        $response = $this->send($this->request('POST', '/bff/v1/confirm', $sid, $this->unsafeHeaders(), $body));

        self::assertSame(413, $response->getStatusCode());
        self::assertSame('payload_too_large', $this->json($response)['code']);
        self::assertCount(0, $this->history);
    }

    /** @return array<string, array{string}> */
    public static function badBodies(): array
    {
        return [
            'op proponer' => ['{"op":"proponer","ruta":"ext_shipment","payload":{}}'],
            'op ausente' => ['{"token":"t"}'],
            'op no string' => ['{"op":["confirmar"]}'],
            'op mayúsculas' => ['{"op":"CONFIRMAR"}'],
            'JSON malformado' => ['{"op":"confirmar"'],
            'lista JSON' => ['["confirmar"]'],
            'texto' => ['confirmar'],
        ];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('badBodies')]
    public function testConfirmRejectsAnythingButOpConfirmarWithoutCallingUpstream(string $body): void
    {
        $this->boot();
        $sid = $this->loginSession();
        $response = $this->send($this->request('POST', '/bff/v1/confirm', $sid, $this->unsafeHeaders(), $body));

        self::assertSame(400, $response->getStatusCode());
        self::assertStringStartsWith('application/problem+json', $response->getHeaderLine('Content-Type'));
        self::assertSame('invalid_body', $this->json($response)['code']);
        self::assertCount(0, $this->history, 'nada llega al backend');
    }

    public function testConfirmForwardsExactBodyBearerAndFixedActionAndPassesBackendErrorsAsProblem(): void
    {
        $body = '{"op":"confirmar","token":"tk","payload_override":{"id":900,"fields":{"peso":"55"}}}';
        $this->boot([new UpstreamResponse(409, ['Content-Type' => 'application/json'], '{"success":false,"error":"payload_mismatch"}')]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('POST', '/bff/v1/confirm?action=evil', $sid, $this->unsafeHeaders(), $body));

        self::assertSame(409, $response->getStatusCode());
        self::assertSame('payload_mismatch', $this->json($response)['code']);
        $sent = $this->history[0]['request'];
        self::assertSame($body, (string) $sent->getBody(), 'el cuerpo se reenvía byte a byte (hash del payload)');
        self::assertSame('Bearer access-1', $sent->getHeaderLine('Authorization'));
        parse_str($sent->getUri()->getQuery(), $query);
        self::assertSame('api_confirm', $query['action']);
    }

    public function testConfirm200WithExecutedFalseIsForwardedUntouched(): void
    {
        $payload = '{"success":true,"executed":false,"result":{"success":false,"http_status":422,"error":"ya controlada"}}';
        $this->boot([$this->upstreamOk($payload)]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('POST', '/bff/v1/confirm', $sid, $this->unsafeHeaders(), '{"op":"confirmar"}'));

        self::assertSame(200, $response->getStatusCode());
        self::assertSame($payload, (string) $response->getBody());
    }

    // ---- Lectura del cuerpo (php://input entrega ~8 KiB por lectura y sin tamaño conocido) ----

    private function shortReadRequest(string $path, string $sid, string $body): \Psr\Http\Message\ServerRequestInterface
    {
        $request = $this->request('POST', $path, $sid, $this->unsafeHeaders());
        $inner = (new \Slim\Psr7\Factory\StreamFactory())->createStream($body);
        $stream = new class ($inner) implements \Psr\Http\Message\StreamInterface {
            use \GuzzleHttp\Psr7\StreamDecoratorTrait;

            public function __construct(private \Psr\Http\Message\StreamInterface $stream)
            {
            }

            public function read(int $length): string
            {
                return $this->stream->read(min($length, 8192));
            }

            public function getSize(): ?int
            {
                return null;
            }
        };

        return $request->withBody($stream);
    }

    public function testBodiesLargerThanOneReadChunkAreForwardedIntact(): void
    {
        $body = json_encode(['message' => str_repeat('é', 20000)], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
        $this->boot([$this->upstreamOk()]);
        $sid = $this->loginSession();

        $response = $this->send($this->shortReadRequest('/bff/v1/bigchat', $sid, $body));

        self::assertSame(200, $response->getStatusCode());
        self::assertSame(strlen($body), strlen((string) $this->history[0]['request']->getBody()), 'sin truncar');
        self::assertSame($body, (string) $this->history[0]['request']->getBody());
    }

    public function testBodyOverLimitIs413EvenWhenSizeIsUnknown(): void
    {
        $this->boot();
        $sid = $this->loginSession();
        $body = json_encode(['message' => str_repeat('x', 70000)], JSON_THROW_ON_ERROR);

        $response = $this->send($this->shortReadRequest('/bff/v1/bigchat', $sid, $body));

        self::assertSame(413, $response->getStatusCode());
        self::assertSame('payload_too_large', $this->json($response)['code']);
        self::assertCount(0, $this->history);
    }

    public function testBodyExactlyAtLimitIsAccepted(): void
    {
        $this->boot([$this->upstreamOk()]);
        $sid = $this->loginSession();
        $body = str_repeat('a', 64 * 1024);

        self::assertSame(200, $this->send($this->shortReadRequest('/bff/v1/bigchat', $sid, $body))->getStatusCode());
    }

    // ---- Rate limit y concurrencia ----

    public function testRateLimitPerUserReturns429WithRetryAfter(): void
    {
        $this->extraEnv = ['COPILOT_CHAT_RATE_PER_MIN' => '2', 'COPILOT_CHAT_RATE_PER_IP_MIN' => '0'];
        $this->boot([$this->upstreamOk(), $this->upstreamOk(), $this->upstreamOk()]);
        $sid = $this->loginSession();
        $statuses = [];
        $last = null;
        for ($i = 0; $i < 3; $i++) {
            $last = $this->send($this->request('POST', '/bff/v1/chat', $sid, $this->unsafeHeaders(), '{"message":"hola"}'));
            $statuses[] = $last->getStatusCode();
        }

        self::assertSame([200, 200, 429], $statuses);
        self::assertSame('rate_limited', $this->json($last)['code']);
        self::assertGreaterThanOrEqual(1, (int) $last->getHeaderLine('Retry-After'));
        self::assertCount(2, $this->history, 'la tercera no llega al backend');
    }

    public function testRateLimitIsPerUserNotGlobal(): void
    {
        $this->extraEnv = ['COPILOT_CHAT_RATE_PER_MIN' => '1', 'COPILOT_CHAT_RATE_PER_IP_MIN' => '0'];
        $this->boot([$this->upstreamOk(), $this->upstreamOk()]);
        $a = $this->loginSession(null, ['user' => ['username' => 'ana'], 'capabilities' => []]);
        $b = $this->loginSession(null, ['user' => ['username' => 'beto'], 'capabilities' => []]);

        self::assertSame(200, $this->send($this->request('POST', '/bff/v1/chat', $a, $this->unsafeHeaders(), '{}'))->getStatusCode());
        self::assertSame(429, $this->send($this->request('POST', '/bff/v1/chat', $a, $this->unsafeHeaders(), '{}'))->getStatusCode());
        self::assertSame(200, $this->send($this->request('POST', '/bff/v1/chat', $b, $this->unsafeHeaders(), '{}'))->getStatusCode());
    }

    public function testSameUserWithTwoSessionsSharesTheBudget(): void
    {
        $this->extraEnv = ['COPILOT_CHAT_RATE_PER_MIN' => '1', 'COPILOT_CHAT_RATE_PER_IP_MIN' => '0'];
        $this->boot([$this->upstreamOk(), $this->upstreamOk()]);
        $ctx = ['user' => ['username' => 'ana'], 'capabilities' => []];
        $s1 = $this->loginSession(null, $ctx);
        $s2 = $this->loginSession(null, $ctx);

        self::assertSame(200, $this->send($this->request('POST', '/bff/v1/chat', $s1, $this->unsafeHeaders(), '{}'))->getStatusCode());
        self::assertSame(429, $this->send($this->request('POST', '/bff/v1/chat', $s2, $this->unsafeHeaders(), '{}'))->getStatusCode());
    }

    public function testRateLimitPerIp(): void
    {
        $this->extraEnv = ['COPILOT_CHAT_RATE_PER_MIN' => '0', 'COPILOT_CHAT_RATE_PER_IP_MIN' => '1'];
        $this->boot([$this->upstreamOk(), $this->upstreamOk()]);
        $a = $this->loginSession(null, ['user' => ['username' => 'ana'], 'capabilities' => []]);
        $b = $this->loginSession(null, ['user' => ['username' => 'beto'], 'capabilities' => []]);
        $send = fn (string $sid, string $ip): int => $this->send($this->request('POST', '/bff/v1/chat', $sid, $this->unsafeHeaders(), '{}', ['REMOTE_ADDR' => $ip]))->getStatusCode();

        self::assertSame(200, $send($a, '203.0.113.9'));
        self::assertSame(429, $send($b, '203.0.113.9'), 'otro usuario, misma IP');
        self::assertSame(200, $send($b, '203.0.113.10'));
    }

    public function testRateLimitPerIpUsesForwardedForOnlyBehindTrustedProxy(): void
    {
        $this->extraEnv = ['COPILOT_CHAT_RATE_PER_MIN' => '0', 'COPILOT_CHAT_RATE_PER_IP_MIN' => '1', 'TRUSTED_PROXIES' => '10.0.0.0/8'];
        $this->boot([$this->upstreamOk(), $this->upstreamOk(), $this->upstreamOk()]);
        $a = $this->loginSession(null, ['user' => ['username' => 'ana'], 'capabilities' => []]);
        $b = $this->loginSession(null, ['user' => ['username' => 'beto'], 'capabilities' => []]);
        $c = $this->loginSession(null, ['user' => ['username' => 'carla'], 'capabilities' => []]);
        $send = fn (string $sid, string $client): int => $this->send($this->request('POST', '/bff/v1/chat', $sid, $this->unsafeHeaders() + ['X-Forwarded-For' => $client], '{}', ['REMOTE_ADDR' => '10.0.0.5']))->getStatusCode();

        self::assertSame(200, $send($a, '203.0.113.9'));
        self::assertSame(429, $send($b, '203.0.113.9'), 'misma IP de cliente real');
        self::assertSame(200, $send($c, '203.0.113.10'), 'otro cliente tras el mismo proxy no comparte cubo');
        self::assertSame('203.0.113.9', $this->history[0]['request']->getHeaderLine('X-Forwarded-For'));
    }

    public function testConcurrencyPerUserRejectsTheSecondInFlightAndReleasesAfter(): void
    {
        $this->extraEnv = ['COPILOT_CHAT_RATE_PER_MIN' => '0', 'COPILOT_CHAT_RATE_PER_IP_MIN' => '0'];
        $nested = null;
        $this->boot([
            function () use (&$nested): ResponseInterface {
                // El segundo turno llega mientras el primero espera al backend.
                $nested = $this->send($this->request('POST', '/bff/v1/chat', $this->sid, $this->unsafeHeaders(), '{}'));

                return $this->upstreamOk('{"answer":"uno"}');
            },
            $this->upstreamOk('{"answer":"tres"}'),
        ]);
        $this->sid = $this->loginSession(null, ['user' => ['username' => 'ana'], 'capabilities' => []]);

        $first = $this->send($this->request('POST', '/bff/v1/chat', $this->sid, $this->unsafeHeaders(), '{}'));

        self::assertSame(200, $first->getStatusCode());
        self::assertInstanceOf(ResponseInterface::class, $nested);
        self::assertSame(429, $nested->getStatusCode());
        self::assertSame('concurrency_limited', $this->json($nested)['code']);
        self::assertNotSame('', $nested->getHeaderLine('Retry-After'));
        // Liberado: un tercer turno ya pasa.
        self::assertSame(200, $this->send($this->request('POST', '/bff/v1/chat', $this->sid, $this->unsafeHeaders(), '{}'))->getStatusCode());
    }

    public function testGlobalConcurrencyCapReturns503AndFreesTheUserSlot(): void
    {
        $this->extraEnv = ['COPILOT_CHAT_RATE_PER_MIN' => '0', 'COPILOT_CHAT_RATE_PER_IP_MIN' => '0', 'COPILOT_CHAT_MAX_GLOBAL' => '1'];
        $nested = null;
        $this->boot([
            function () use (&$nested): ResponseInterface {
                $nested = $this->send($this->request('POST', '/bff/v1/chat', $this->sidB, $this->unsafeHeaders(), '{}'));

                return $this->upstreamOk();
            },
            $this->upstreamOk(),
        ]);
        $this->sid = $this->loginSession(null, ['user' => ['username' => 'ana'], 'capabilities' => []]);
        $this->sidB = $this->loginSession(null, ['user' => ['username' => 'beto'], 'capabilities' => []]);

        self::assertSame(200, $this->send($this->request('POST', '/bff/v1/chat', $this->sid, $this->unsafeHeaders(), '{}'))->getStatusCode());
        self::assertInstanceOf(ResponseInterface::class, $nested);
        self::assertSame(503, $nested->getStatusCode());
        self::assertSame('capacity_exceeded', $this->json($nested)['code']);
        // Beto no se quedó con su hueco de usuario tomado.
        self::assertSame(200, $this->send($this->request('POST', '/bff/v1/chat', $this->sidB, $this->unsafeHeaders(), '{}'))->getStatusCode());
    }

    public function testSlotIsReleasedWhenUpstreamFails(): void
    {
        $this->extraEnv = ['COPILOT_CHAT_RATE_PER_MIN' => '0', 'COPILOT_CHAT_RATE_PER_IP_MIN' => '0'];
        $this->boot([new ConnectException('boom', new UpstreamRequest('POST', 'http://x')), $this->upstreamOk()]);
        $sid = $this->loginSession();

        self::assertSame(504, $this->send($this->request('POST', '/bff/v1/chat', $sid, $this->unsafeHeaders(), '{}'))->getStatusCode());
        self::assertSame(200, $this->send($this->request('POST', '/bff/v1/chat', $sid, $this->unsafeHeaders(), '{}'))->getStatusCode());
    }

    public function testSlotIsReleasedWhenBackendReturns500(): void
    {
        $this->extraEnv = ['COPILOT_CHAT_RATE_PER_MIN' => '0', 'COPILOT_CHAT_RATE_PER_IP_MIN' => '0'];
        $this->boot([new UpstreamResponse(500, [], 'x'), $this->upstreamOk()]);
        $sid = $this->loginSession();

        self::assertSame(502, $this->send($this->request('POST', '/bff/v1/chat', $sid, $this->unsafeHeaders(), '{}'))->getStatusCode());
        self::assertSame(200, $this->send($this->request('POST', '/bff/v1/chat', $sid, $this->unsafeHeaders(), '{}'))->getStatusCode());
    }

    public function testUnthrottledRoutesAreNotLimited(): void
    {
        $this->extraEnv = ['COPILOT_CHAT_RATE_PER_MIN' => '1'];
        $this->boot([$this->upstreamOk(), $this->upstreamOk(), $this->upstreamOk()]);
        $sid = $this->loginSession();
        for ($i = 0; $i < 3; $i++) {
            self::assertSame(200, $this->send($this->request('GET', '/bff/v1/things/1', $sid))->getStatusCode());
        }
    }

    private string $sid = '';
    private string $sidB = '';
}
