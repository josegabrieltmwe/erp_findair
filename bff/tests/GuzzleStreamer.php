<?php

declare(strict_types=1);

namespace Findair\Bff\Tests;

use Findair\Bff\Proxy\UpstreamStreamer;
use GuzzleHttp\ClientInterface;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;

/** Sustituto de CurlUpstreamStreamer en las pruebas: usa el cliente simulado, sin red. */
final class GuzzleStreamer implements UpstreamStreamer
{
    public function __construct(private readonly ClientInterface $http)
    {
    }

    public function open(RequestInterface $request, float $idleTimeout, float $connectTimeout): ResponseInterface
    {
        return $this->http->send($request, ['stream' => true, 'timeout' => 0, 'read_timeout' => $idleTimeout, 'http_errors' => false]);
    }
}
