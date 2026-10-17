<?php

declare(strict_types=1);

namespace Findair\Bff\Proxy;

use Psr\Http\Message\StreamInterface;

/**
 * Cuerpo PSR-7 de solo lectura alimentado por curl_multi. `read()` bloquea solo hasta que llega
 * algún dato (no hasta llenar el tamaño pedido), que es lo que necesita un SSE.
 */
final class CurlBodyStream implements StreamInterface
{
    private bool $running = true;
    private bool $closed = false;

    public function __construct(private \CurlMultiHandle $multi, private \CurlHandle $handle, private CurlBodyBuffer $buffer)
    {
    }

    public function __destruct()
    {
        $this->close();
    }

    public function __toString(): string
    {
        $out = '';
        while (!$this->eof()) {
            $out .= $this->read(8192);
        }

        return $out;
    }

    public function close(): void
    {
        if ($this->closed) {
            return;
        }
        $this->closed = true;
        curl_multi_remove_handle($this->multi, $this->handle);
        curl_multi_close($this->multi);
        curl_close($this->handle);
    }

    public function detach()
    {
        $this->close();

        return null;
    }

    public function getSize(): ?int
    {
        return null;
    }

    public function tell(): int
    {
        throw new \RuntimeException('Stream sin posición.');
    }

    public function eof(): bool
    {
        return $this->closed || (!$this->running && $this->buffer->isEmpty());
    }

    public function isSeekable(): bool
    {
        return false;
    }

    public function seek(int $offset, int $whence = SEEK_SET): void
    {
        throw new \RuntimeException('Stream no rebobinable.');
    }

    public function rewind(): void
    {
        throw new \RuntimeException('Stream no rebobinable.');
    }

    public function isWritable(): bool
    {
        return false;
    }

    public function write(string $string): int
    {
        throw new \RuntimeException('Stream de solo lectura.');
    }

    public function isReadable(): bool
    {
        return true;
    }

    public function read(int $length): string
    {
        while ($this->buffer->isEmpty() && $this->running && !$this->closed) {
            $active = 0;
            curl_multi_exec($this->multi, $active);
            $this->running = $active > 0;
            if ($this->running && $this->buffer->isEmpty()) {
                curl_multi_select($this->multi, 1.0);
            }
        }

        return $this->buffer->take($length);
    }

    public function getContents(): string
    {
        return (string) $this;
    }

    public function getMetadata(?string $key = null)
    {
        return $key === null ? [] : null;
    }
}
