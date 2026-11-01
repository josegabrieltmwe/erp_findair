<?php

declare(strict_types=1);

namespace Findair\Bff\Tests;

use Findair\Bff\Support\ClientIp;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Factory\ServerRequestFactory;

final class ClientIpTest extends TestCase
{
    /**
     * @param list<string> $trusted
     * @param list<string> $xff
     */
    private function resolve(array $trusted, string $remote, array $xff = []): string
    {
        $request = (new ServerRequestFactory())->createServerRequest('GET', 'https://x.test/', ['REMOTE_ADDR' => $remote]);
        foreach ($xff as $v) {
            $request = $request->withAddedHeader('X-Forwarded-For', $v);
        }

        return (new ClientIp($trusted))->resolve($request);
    }

    public function testWithoutTrustedProxiesForwardedForIsIgnored(): void
    {
        self::assertSame('10.0.0.5', $this->resolve([], '10.0.0.5', ['203.0.113.7']));
    }

    public function testUntrustedPeerCannotSpoofForwardedFor(): void
    {
        self::assertSame('198.51.100.9', $this->resolve(['10.0.0.0/8'], '198.51.100.9', ['203.0.113.7']));
    }

    public function testTrustedProxyUsesRightmostUntrustedHop(): void
    {
        self::assertSame('203.0.113.7', $this->resolve(['10.0.0.0/8'], '10.0.0.5', ['203.0.113.7, 10.1.1.1']));
        self::assertSame('203.0.113.7', $this->resolve(['10.0.0.0/8'], '10.0.0.5', ['1.2.3.4', '203.0.113.7, 10.1.1.1']), 'lo antepuesto por el cliente no cuenta');
    }

    public function testMalformedOrMissingHeaderFallsBackToRemoteAddr(): void
    {
        self::assertSame('10.0.0.5', $this->resolve(['10.0.0.5'], '10.0.0.5', ['no-es-ip']));
        self::assertSame('10.0.0.5', $this->resolve(['10.0.0.5'], '10.0.0.5'));
        self::assertSame('10.0.0.5', $this->resolve(['10.0.0.0/8'], '10.0.0.5', ['10.2.2.2']), 'todos de confianza');
    }

    public function testIpv6CidrAndExactMatch(): void
    {
        self::assertSame('2001:db8:1::5', $this->resolve(['fd00::/8', '::1'], '::1', ['2001:db8:1::5']));
        self::assertSame('203.0.113.7', $this->resolve(['fd00::/8'], 'fd12::1', ['203.0.113.7']));
    }

    public function testInvalidEntryFailsLoudly(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        new ClientIp(['10.0.0.0/99']);
    }
}
