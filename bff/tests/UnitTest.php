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
}
