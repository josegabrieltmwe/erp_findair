<?php

declare(strict_types=1);

namespace Findair\Bff\Http;

use Psr\Http\Message\ResponseInterface;
use Slim\ResponseEmitter;

/**
 * Emite la respuesta al navegador. Las normales van por el emisor de Slim; las de tipo stream
 * (SSE) se envían trozo a trozo con flush(), porque Apache/PHP acumulan la salida
 * (output_buffering = 4096) y retendrían los eventos pequeños hasta llenar el búfer.
 */
final class StreamingEmitter
{
    /** Cabecera interna: la pone ResponseAdapter y se elimina antes de emitir. */
    public const MARKER = 'X-BFF-Stream';

    private const CHUNK = 1024;

    public function emit(ResponseInterface $response): void
    {
        if (!$response->hasHeader(self::MARKER)) {
            (new ResponseEmitter())->emit($response);

            return;
        }

        $response = $response->withoutHeader(self::MARKER);
        // Un stream puede durar horas: el límite de ejecución no aplica y el cierre del cliente lo corta.
        set_time_limit(0);
        ignore_user_abort(false);
        while (ob_get_level() > 0) {
            ob_end_clean();
        }

        if (!headers_sent()) {
            header(sprintf('HTTP/%s %d %s', $response->getProtocolVersion(), $response->getStatusCode(), $response->getReasonPhrase()), true, $response->getStatusCode());
            foreach ($response->getHeaders() as $name => $values) {
                foreach ($values as $i => $value) {
                    header("{$name}: {$value}", $i === 0);
                }
            }
        }
        flush();

        $body = $response->getBody();
        while (!$body->eof()) {
            $chunk = $body->read(self::CHUNK);
            if ($chunk === '') {
                continue;
            }
            echo $chunk;
            flush();
            if (connection_aborted()) {
                break;
            }
        }
        $body->close();
    }
}
