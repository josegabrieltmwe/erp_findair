<?php

declare(strict_types=1);

namespace Findair\Bff\Support;

use Monolog\LogRecord;
use Monolog\Processor\ProcessorInterface;

/**
 * Censura campos sensibles antes de que un registro llegue al log.
 */
final class Redactor implements ProcessorInterface
{
    private const SENSITIVE = [
        'authorization', 'cookie', 'set-cookie', 'password', 'client_secret', 'access_token',
        'refresh_token', 'code', 'code_verifier', 'token', 'user_token', 'x-csrf-token', 'app_key',
    ];

    public function __invoke(LogRecord $record): LogRecord
    {
        return $record->with(context: $this->scrub($record->context));
    }

    /**
     * @param array<mixed> $data
     * @return array<mixed>
     */
    private function scrub(array $data): array
    {
        foreach ($data as $key => $value) {
            if (is_string($key) && in_array(strtolower($key), self::SENSITIVE, true)) {
                $data[$key] = '[redacted]';
            } elseif (is_array($value)) {
                $data[$key] = $this->scrub($value);
            }
        }

        return $data;
    }
}
