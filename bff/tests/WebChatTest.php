<?php

declare(strict_types=1);

namespace Findair\Bff\Tests;

use Findair\Bff\Proxy\RouteManifest;
use GuzzleHttp\Psr7\Response as UpstreamResponse;

/**
 * Manifiesto real (config/routes.bff.yaml) de los chats humano-humano (web_chat_*,
 * web_presence_heartbeat, api_communication_poll). El mecanismo de throttle en sí
 * (429, Retry-After, concurrencia) ya lo ejercita CopilotRoutesTest contra /copilot_chat
 * con el mismo Throttler; aquí solo se fija que estas rutas declaran la política
 * correcta y que los métodos sin cliente real no quedan expuestos.
 *
 * La segunda mitad de este fichero sí monta peticiones HTTP reales, pero solo para lo
 * que hace a estas rutas distintas del resto del manifiesto (no para re-probar
 * mecanismos ya genéricos): `fixture.presence_heartbeat`/`fixture.web_chat_message`
 * (tests/fixtures/routes.yaml) replican el throttle/csrf/limits real de
 * `web_presence_heartbeat`/`web_chat_messages`.
 */
final class WebChatTest extends AppTestCase
{
    private function manifest(): RouteManifest
    {
        return RouteManifest::fromFile(__DIR__ . '/../config/routes.bff.yaml');
    }

    public function testWebChatMessagesDeclareThrottleOnAllThreeMethods(): void
    {
        foreach (['GET', 'POST', 'PUT'] as $method) {
            $route = $this->manifest()->match($method, '/web_chat_messages')['route'] ?? null;
            self::assertNotNull($route, "{$method} /web_chat_messages debería existir");
            self::assertSame('web_chat', $route->throttle, "{$method} /web_chat_messages sin throttle");
        }
    }

    public function testWebChatUnreadCounterOnlyGetIsExposedAndThrottled(): void
    {
        $route = $this->manifest()->match('GET', '/web_chat_unread_counter')['route'] ?? null;
        self::assertNotNull($route);
        self::assertSame('web_chat', $route->throttle);

        foreach (['POST', 'PUT'] as $method) {
            self::assertNull(
                $this->manifest()->match($method, '/web_chat_unread_counter'),
                "{$method} no lo llama ningún cliente (solo chat.service.ts hace GET)",
            );
        }
    }

    public function testPresenceHeartbeatKeepsNoCsrfLimitsAndGainsThrottle(): void
    {
        $route = $this->manifest()->match('POST', '/web_presence_heartbeat')['route'] ?? null;

        self::assertNotNull($route);
        self::assertFalse($route->csrf, 'el beforeunload no puede mandar X-CSRF-Token');
        self::assertSame(4 * 1024, $route->maxBody);
        self::assertSame(5.0, $route->timeout);
        self::assertSame('presence_heartbeat', $route->throttle, 'sin CSRF, el throttle era la única defensa que faltaba');

        self::assertNull(
            $this->manifest()->match('GET', '/web_presence_heartbeat'),
            'el cliente solo usa POST (presence.ts); GET era ruido del generador',
        );
    }

    public function testCommunicationPollDeclaresThrottle(): void
    {
        $route = $this->manifest()->match('GET', '/api_communication_poll')['route'] ?? null;

        self::assertNotNull($route);
        self::assertSame('communication_poll', $route->throttle);
    }

    public function testRealtimeStreamRouteStaysFullyRetired(): void
    {
        self::assertNull($this->manifest()->match('GET', '/web_chat_realtime_stream'));
        self::assertFalse($this->manifest()->pathExists('/web_chat_realtime_stream'));
    }

    // ---- HTTP: lo que hace a estas rutas distintas del resto del manifiesto ----

    /**
     * web_presence_heartbeat es la única ruta sin CSRF de todo el sistema (el
     * beforeunload no puede mandar X-CSRF-Token). Regresión contra que alguien la
     * "arregle" por error exigiendo el token y rompa silenciosamente el latido.
     */
    public function testPresenceFixtureWorksWithoutCsrfToken(): void
    {
        $this->boot([$this->upstreamOk()]);
        $sid = $this->loginSession();
        $headers = ['Origin' => self::ORIGIN, 'Content-Type' => 'application/json'];

        $response = $this->send($this->request('POST', '/bff/v1/presence', $sid, $headers, '{}'));

        self::assertSame(200, $response->getStatusCode(), 'csrf:false no debe exigir X-CSRF-Token');
        self::assertCount(1, $this->history, 'debe llegar al backend, no bloquearse por CSRF');
    }

    /**
     * Sin CSRF, el límite de cuerpo (4k, el más ajustado del manifiesto) es la única
     * defensa que le queda a esta ruta además del throttle. Se respeta aunque el
     * tamaño del cuerpo no se conozca de antemano (como entrega php://input).
     */
    public function testPresenceFixtureBodyOverFourKIsRejectedEvenWithUnknownContentLength(): void
    {
        $this->boot();
        $sid = $this->loginSession();
        $body = str_repeat('x', 5000);

        $response = $this->send($this->shortReadRequest('/bff/v1/presence', $sid, $body));

        self::assertSame(413, $response->getStatusCode());
        self::assertSame('payload_too_large', $this->json($response)['code']);
        self::assertCount(0, $this->history);
    }

    /**
     * Un 401 de la ruta de mensajes con un token todavía válido no debe cerrar la
     * sesión (invariante 5): aquí duele más que en una ruta cualquiera porque corta
     * una conversación activa. Mismo patrón que ProxyTest::testRouteThatReturns401ForValidTokenDoesNotEndTheSession.
     */
    public function testChatMessageFixture401WithValidTokenDoesNotEndSession(): void
    {
        $this->boot([
            new UpstreamResponse(401, [], ''),
            $this->upstreamOk('{"username":"jose"}'), // sondeo: el token sigue siendo válido
        ]);
        $sid = $this->loginSession();

        $response = $this->send($this->request('POST', '/bff/v1/chatmsg', $sid, $this->unsafeHeaders(), '{"text":"hola"}'));

        self::assertSame(403, $response->getStatusCode());
        self::assertSame('upstream_unauthorized', $this->json($response)['code']);
        self::assertNotNull($this->store->load($sid), 'un 401 de ruta con token válido no cierra la sesión');
        self::assertCount(2, $this->history, 'sin intento de refresco');
    }
}
