<?php

declare(strict_types=1);

namespace Findair\Bff\Auth;

use Findair\Bff\Proxy\UpstreamUrl;
use Findair\Bff\Settings;
use GuzzleHttp\ClientInterface;
use Psr\Log\LoggerInterface;

/**
 * Quién es el usuario y qué puede ver la SPA. Se calcula una vez, al autenticar, y viaja en
 * `/bff/auth/session`: el frontend no tiene que adivinar nada ni pedir el perfil aparte.
 *
 * Fuente, por orden:
 *   1. UPSTREAM_CONTEXT_ACTION (acción de tmwe_json que devuelve {user, capabilities}).
 *   2. Deducción a partir de `get_my_profile`. Es provisional: tmwe_json decide `clients` y
 *      `my_org` con permisos de sesión (authx_18) que hoy no se exponen por API.
 *
 * Un fallo aquí nunca impide el login: la SPA arranca con capacidades vacías.
 */
final class UserContextProvider
{
    private const TMWE_PARTNER_ID = 1;

    public function __construct(
        private readonly ClientInterface $http,
        private readonly UpstreamUrl $urls,
        private readonly Settings $settings,
        private readonly LoggerInterface $logger,
    ) {
    }

    /** @return array{user: array<string, mixed>, capabilities: list<string>} */
    public function load(string $accessToken, string $requestId = ''): array
    {
        try {
            if ($this->settings->contextAction !== '') {
                return self::fromBackendContext($this->fetch($this->settings->contextAction, $accessToken, $requestId));
            }

            return self::fromProfile($this->fetch('get_my_profile', $accessToken, $requestId));
        } catch (\Throwable $e) {
            $this->logger->warning('user_context_failed', ['error' => $e::class, 'request_id' => $requestId]);

            return ['user' => [], 'capabilities' => []];
        }
    }

    /**
     * @param array<string, mixed> $profile respuesta de get_my_profile
     * @return array{user: array<string, mixed>, capabilities: list<string>}
     */
    public static function fromProfile(array $profile): array
    {
        $partnerId = (int) ($profile['idanagfrc'] ?? 0);
        $isTmwe = $partnerId === self::TMWE_PARTNER_ID;

        return [
            'user' => [
                'username' => self::text($profile['username'] ?? null),
                'name' => self::text($profile['name'] ?? null),
                'email' => self::text($profile['email'] ?? null),
                'partner_id' => $partnerId,
                'is_admin' => ($profile['is_admin'] ?? false) === true,
                'is_tmwe' => $isTmwe,
            ],
            // Conservador: mostrar de menos es seguro, cada pantalla sigue autorizando en el backend.
            'capabilities' => $isTmwe ? ['tmwe', 'clients'] : [],
        ];
    }

    /**
     * @param array<string, mixed> $context
     * @return array{user: array<string, mixed>, capabilities: list<string>}
     */
    public static function fromBackendContext(array $context): array
    {
        $caps = [];
        foreach (is_array($context['capabilities'] ?? null) ? $context['capabilities'] : [] as $cap) {
            if (is_string($cap) && preg_match('/^[a-z0-9_.:-]{1,64}$/', $cap) === 1) {
                $caps[] = $cap;
            }
        }
        $user = is_array($context['user'] ?? null) ? $context['user'] : [];

        return ['user' => self::fromProfile($user)['user'] + ['capabilities_source' => 'backend'], 'capabilities' => array_values(array_unique($caps))];
    }

    /** @return array<string, mixed> */
    private function fetch(string $action, string $accessToken, string $requestId): array
    {
        $response = $this->http->request('GET', $this->urls->internal($action), [
            'headers' => ['Authorization' => 'Bearer ' . $accessToken, 'Accept' => 'application/json', 'X-Request-Id' => $requestId],
            'http_errors' => false,
            'allow_redirects' => false,
            'timeout' => 5,
        ]);
        if ($response->getStatusCode() !== 200) {
            throw new \RuntimeException('contexto: HTTP ' . $response->getStatusCode());
        }
        $decoded = json_decode((string) $response->getBody(), true);

        return is_array($decoded) ? $decoded : [];
    }

    private static function text(mixed $value): string
    {
        return is_string($value) ? mb_substr($value, 0, 200) : '';
    }
}
