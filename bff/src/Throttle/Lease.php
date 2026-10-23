<?php

declare(strict_types=1);

namespace Findair\Bff\Throttle;

use Psr\Http\Message\ResponseInterface;

/** Resultado de Throttler::enter(): o se rechaza (Problem Details) o se conservan los huecos hasta release(). */
final class Lease
{
    /** @param list<array{string, string}> $slots */
    private function __construct(
        public readonly ?ResponseInterface $rejection,
        private readonly array $slots,
        private readonly ?CounterStore $store,
    ) {
    }

    public static function rejected(ResponseInterface $response): self
    {
        return new self($response, [], null);
    }

    /** @param list<array{string, string}> $slots */
    public static function granted(array $slots, CounterStore $store): self
    {
        return new self(null, $slots, $store);
    }

    public function release(): void
    {
        foreach ($this->slots as [$key, $token]) {
            $this->store?->release($key, $token);
        }
    }
}
