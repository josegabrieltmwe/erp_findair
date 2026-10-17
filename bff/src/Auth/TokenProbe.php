<?php

declare(strict_types=1);

namespace Findair\Bff\Auth;

use Findair\Bff\Proxy\UpstreamUrl;
use GuzzleHttp\ClientInterface;

/**
 * ¿Sigue aceptando tmwe_json este access token? Se usa cuando una ruta responde 401: puede ser un
 * token revocado o caducado (hay que renovar o cerrar la sesión) o una ruta que rechaza al usuario
 * con 401 por falta de permiso (la sesión sigue siendo válida). `get_my_profile` la puede llamar
 * cualquier usuario autenticado.
 */
final class TokenProbe
{
    public function __construct(private readonly ClientInterface $http, private readonly UpstreamUrl $urls)
    {
    }

    public function accepts(string $accessToken, string $requestId = ''): bool
    {
        try {
            $response = $this->http->request('GET', $this->urls->internal('get_my_profile'), [
                'headers' => array_filter(['Authorization' => 'Bearer ' . $accessToken, 'Accept' => 'application/json', 'X-Request-Id' => $requestId]),
                'http_errors' => false,
                'allow_redirects' => false,
                'timeout' => 5,
            ]);

            return $response->getStatusCode() === 200;
        } catch (\Throwable) {
            return false;
        }
    }
}
