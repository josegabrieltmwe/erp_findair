<?php

declare(strict_types=1);

namespace Findair\Bff\Proxy;

/** Línea de estado y cabeceras de la respuesta, rellenadas por el callback de cURL. */
final class CurlResponseHead
{
    public int $status = 0;
    public string $reason = '';
    /** @var array<string, list<string>> */
    public array $headers = [];
    public bool $done = false;

    public function consume(string $line): void
    {
        $line = rtrim($line, "\r\n");
        if (preg_match('#^HTTP/\S+\s+(\d{3})\s*(.*)$#', $line, $m) === 1) {
            $this->status = (int) $m[1];
            $this->reason = $m[2];
            $this->headers = [];
            $this->done = false;
        } elseif ($line === '') {
            $this->done = true;
        } elseif (str_contains($line, ':')) {
            [$name, $value] = explode(':', $line, 2);
            $this->headers[trim($name)][] = trim($value);
        }
    }
}
