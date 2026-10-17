<?php

declare(strict_types=1);

namespace Findair\Bff\Proxy;

use GuzzleHttp\Psr7\Response;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;

/**
 * Streaming con cURL (curl_multi). El flujo http:// de PHP que usa Guzzle con `stream => true`
 * retiene los fragmentos pequeños de una respuesta troceada hasta acumular más datos, lo que
 * rompe los latidos de un SSE: cURL entrega cada fragmento en cuanto llega.
 */
final class CurlUpstreamStreamer implements UpstreamStreamer
{
    public function open(RequestInterface $request, float $idleTimeout, float $connectTimeout): ResponseInterface
    {
        $handle = curl_init();
        if ($handle === false) {
            throw new \RuntimeException('curl_init falló.');
        }

        $head = new CurlResponseHead();
        $buffer = new CurlBodyBuffer();

        $headers = [];
        foreach ($request->getHeaders() as $name => $values) {
            $headers[] = $name . ': ' . implode(', ', $values);
        }
        $body = (string) $request->getBody();

        curl_setopt_array($handle, [
            CURLOPT_URL => (string) $request->getUri(),
            CURLOPT_CUSTOMREQUEST => $request->getMethod(),
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT_MS => (int) ($connectTimeout * 1000),
            CURLOPT_LOW_SPEED_LIMIT => 1,
            CURLOPT_LOW_SPEED_TIME => max(1, (int) $idleTimeout),
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_HEADERFUNCTION => static function ($ch, string $line) use ($head): int {
                $head->consume($line);

                return strlen($line);
            },
            CURLOPT_WRITEFUNCTION => static function ($ch, string $data) use ($buffer): int {
                $buffer->push($data);

                return strlen($data);
            },
        ]);
        if ($body !== '') {
            curl_setopt($handle, CURLOPT_POSTFIELDS, $body);
        }

        $multi = curl_multi_init();
        curl_multi_add_handle($multi, $handle);
        $stream = new CurlBodyStream($multi, $handle, $buffer);

        // Esperar a las cabeceras: sin ellas no hay respuesta que construir.
        do {
            $running = 0;
            curl_multi_exec($multi, $running);
            if ($head->done || $running === 0) {
                break;
            }
            curl_multi_select($multi, 0.5);
        } while (true);
        if (!$head->done) {
            $error = curl_error($handle);
            $stream->close();
            throw new \RuntimeException('El upstream no respondió: ' . $error);
        }

        return new Response($head->status, $head->headers, $stream, '1.1', $head->reason !== '' ? $head->reason : null);
    }
}
