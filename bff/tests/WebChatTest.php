<?php

declare(strict_types=1);

namespace Findair\Bff\Tests;

use Findair\Bff\Proxy\RouteManifest;

/**
 * Manifiesto real (config/routes.bff.yaml) de los chats humano-humano (web_chat_*,
 * web_presence_heartbeat, api_communication_poll). El mecanismo de throttle en sí
 * (429, Retry-After, concurrencia) ya lo ejercita CopilotRoutesTest contra /copilot_chat
 * con el mismo Throttler; aquí solo se fija que estas rutas declaran la política
 * correcta y que los métodos sin cliente real no quedan expuestos.
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
}
