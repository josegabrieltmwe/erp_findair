<?php

declare(strict_types=1);

namespace Findair\Bff\Auth;

use Findair\Bff\Proxy\UpstreamUrl;
use GuzzleHttp\ClientInterface;

/**
 * Suplantación de partner (solo personal TMWE). tmwe_json guarda el partner activo en $_SESSION, que
 * no existe con Bearer: el BFF lo recuerda en su sesión y envía X-Impersonate-Partner-Id en cada petición.
 * El backend sigue siendo quien autoriza (anagrafica real 1 + scope partner:impersonate) y audita.
 */
final class PartnerSwitcher
{
    public function __construct(
        private readonly ClientInterface $http,
        private readonly UpstreamUrl $urls,
        private readonly UserContextProvider $context,
    ) {
    }

    /**
     * Partners suplantables (GET partner_switch, solo responde al super-admin TMWE).
     *
     * @return list<array{id: int, rag_soc: string, id_paese_iso: string}>
     */
    public function partners(string $accessToken, string $requestId): array
    {
        $response = $this->http->request('GET', $this->urls->internal('partner_switch'), [
            'headers' => ['Authorization' => 'Bearer ' . $accessToken, 'Accept' => 'application/json', 'X-Request-Id' => $requestId],
            'http_errors' => false,
            'allow_redirects' => false,
            'timeout' => 10,
        ]);
        if ($response->getStatusCode() !== 200) {
            throw new \RuntimeException('partner_switch: HTTP ' . $response->getStatusCode());
        }
        $decoded = json_decode((string) $response->getBody(), true);
        $rows = is_array($decoded) && is_array($decoded['data'] ?? null) && is_array($decoded['data']['partners'] ?? null)
            ? $decoded['data']['partners'] : [];

        $partners = [];
        foreach ($rows as $row) {
            if (is_array($row) && is_numeric($row['id'] ?? null)) {
                $partners[] = [
                    'id' => (int) $row['id'],
                    'rag_soc' => is_string($row['rag_soc'] ?? null) ? mb_substr($row['rag_soc'], 0, 200) : '',
                    'id_paese_iso' => is_string($row['id_paese_iso'] ?? null) ? mb_substr($row['id_paese_iso'], 0, 3) : '',
                ];
            }
        }

        return $partners;
    }

    /**
     * Contexto (capacidades) del partner suplantado. null = el backend rechaza la suplantación
     * (falta el scope `partner:impersonate`, partner inválido o usuario no TMWE).
     *
     * @return array{user: array<string, mixed>, capabilities: list<string>}|null
     */
    public function contextFor(string $accessToken, int $partnerId, string $requestId): ?array
    {
        return $this->context->tryLoad($accessToken, $requestId, $partnerId);
    }
}
