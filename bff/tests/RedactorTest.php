<?php

declare(strict_types=1);

namespace Findair\Bff\Tests;

use Findair\Bff\Support\Redactor;
use Monolog\Level;
use Monolog\LogRecord;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class RedactorTest extends TestCase
{
    /** @return array<string, array{string}> */
    public static function sensitiveKeys(): array
    {
        $keys = ['authorization', 'cookie', 'token', 'refresh_token', 'api_key', 'apikey', 'api-key', 'x-api-key', 'X-API-KEY', 'API_KEY', 'ApiKey', 'x-auth-token', 'secret', 'api_secret', 'payload_override'];

        return array_combine($keys, array_map(static fn (string $k): array => [$k], $keys));
    }

    #[DataProvider('sensitiveKeys')]
    public function testRedactsKeyAtAnyDepth(string $key): void
    {
        $record = new LogRecord(new \DateTimeImmutable(), 'bff', Level::Info, 'm', [$key => 'valor-secreto', 'nested' => ['deep' => [$key => 'valor-secreto']], 'ok' => 'visible']);
        $out = (new Redactor())($record)->context;

        self::assertSame('[redacted]', $out[$key]);
        self::assertIsArray($out['nested']);
        self::assertSame('[redacted]', $out['nested']['deep'][$key]);
        self::assertSame('visible', $out['ok']);
        self::assertStringNotContainsString('valor-secreto', json_encode($out, JSON_THROW_ON_ERROR));
    }
}
