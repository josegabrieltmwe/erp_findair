<?php

declare(strict_types=1);

namespace Findair\Bff\Tests;

use Findair\Bff\Proxy\ResponseAdapter;
use Findair\Bff\Proxy\Route;
use GuzzleHttp\Psr7\Response as UpstreamResponse;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

/**
 * tmwe_json pone un Cache-Control de infraestructura (nivel de servidor, no por ruta: llega igual en /auth que en
 * el detalle de una expedicion). Reenviarlo tal cual a rutas JSON dejaba cacheado en el navegador hasta 24h el
 * estado de una expedicion que cambia en background (AWB/pickup asignados por el consumer de RabbitMQ) sin que
 * la SPA lo notara — visto en produccion con el shipment 1001088879 (AWB y pickup confirmados en el backend,
 * invisibles en la UI por la respuesta cacheada).
 */
final class ResponseAdapterTest extends TestCase
{
    private function route(string $response): Route
    {
        return new Route(
            id: 'shipment.detail',
            method: 'GET',
            path: '/shipment/:id',
            action: 'unified_shipment',
            upstreamMethod: 'GET',
            forwardQuery: [],
            forwardAllQuery: false,
            staticQuery: [],
            pathParams: [],
            response: $response,
            legacyEnvelope: false,
            maxBody: 0,
            timeout: 10.0,
            csrf: false,
            pattern: '#^/shipment/(?P<id>[^/]+)$#',
        );
    }

    public function testJsonRouteNeverForwardsUpstreamCacheHeaders(): void
    {
        $adapter = new ResponseAdapter(new NullLogger());
        $upstream = new UpstreamResponse(200, [
            'Content-Type' => 'application/json',
            'Cache-Control' => 'max-age=86400',
            'Etag' => '"some-etag"',
        ], '{"success":true,"data":{"AWB_forn":"5320636974"}}');

        $response = $adapter->adapt($upstream, $this->route('json'), 'req-1');

        self::assertSame('no-store', $response->getHeaderLine('Cache-Control'));
        self::assertSame('', $response->getHeaderLine('Etag'));
    }

    public function testBinaryRouteStillForwardsUpstreamCacheHeaders(): void
    {
        $adapter = new ResponseAdapter(new NullLogger());
        $upstream = new UpstreamResponse(200, [
            'Content-Type' => 'application/pdf',
            'Cache-Control' => 'private, max-age=3600',
            'Etag' => '"label-etag"',
        ], '%PDF-1.4 fake');

        $response = $adapter->adapt($upstream, $this->route('binary'), 'req-2');

        self::assertSame('private, max-age=3600', $response->getHeaderLine('Cache-Control'));
        self::assertSame('"label-etag"', $response->getHeaderLine('Etag'));
    }
}
