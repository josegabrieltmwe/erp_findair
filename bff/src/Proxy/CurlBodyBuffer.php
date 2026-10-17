<?php

declare(strict_types=1);

namespace Findair\Bff\Proxy;

/** Datos recibidos de cURL pendientes de entregar. */
final class CurlBodyBuffer
{
    private string $data = '';

    public function push(string $chunk): void
    {
        $this->data .= $chunk;
    }

    /** @phpstan-impure cURL lo rellena mientras se espera */
    public function isEmpty(): bool
    {
        return $this->data === '';
    }

    public function take(int $max): string
    {
        $out = substr($this->data, 0, $max);
        $this->data = (string) substr($this->data, strlen($out));

        return $out;
    }
}
