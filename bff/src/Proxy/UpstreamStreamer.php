<?php

declare(strict_types=1);

namespace Findair\Bff\Proxy;

use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;

/**
 * Abre una respuesta de larga duración (SSE) y la entrega a medida que llega.
 */
interface UpstreamStreamer
{
    /**
     * @param float $idleTimeout segundos de silencio tolerados antes de cortar (no hay límite total)
     * @throws \Throwable si no se puede conectar
     */
    public function open(RequestInterface $request, float $idleTimeout, float $connectTimeout): ResponseInterface;
}
