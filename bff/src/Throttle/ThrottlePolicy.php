<?php

declare(strict_types=1);

namespace Findair\Bff\Throttle;

/** Límites de una ruta. 0 = sin límite en esa dimensión. */
final class ThrottlePolicy
{
    public function __construct(
        public readonly int $ratePerUser = 0,
        public readonly int $ratePerIp = 0,
        public readonly int $windowSeconds = 60,
        public readonly int $concurrencyPerUser = 0,
        public readonly int $concurrencyGlobal = 0,
    ) {
    }
}
