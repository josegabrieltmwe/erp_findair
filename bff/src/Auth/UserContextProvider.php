<?php

declare(strict_types=1);

namespace Findair\Bff\Auth;

use Findair\Bff\Impersonation\EffectivePartner;
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
        return $this->tryLoad($accessToken, $requestId) ?? ['user' => [], 'capabilities' => []];
    }

    /**
     * Como load(), pero distingue el fallo (null). Con `$impersonate` el backend calcula el contexto
     * del partner suplantado (cabecera X-Impersonate-Partner-Id); si lo rechaza, devuelve null.
     *
     * @return array{user: array<string, mixed>, capabilities: list<string>}|null
     */
    public function tryLoad(string $accessToken, string $requestId = '', ?int $impersonate = null): ?array
    {
        try {
            if ($this->settings->contextAction !== '') {
                return self::fromBackendContext($this->fetch($this->settings->contextAction, $accessToken, $requestId, $impersonate));
            }

            return self::fromProfile($this->fetch('get_my_profile', $accessToken, $requestId, $impersonate));
        } catch (\Throwable $e) {
            $this->logger->warning('user_context_failed', ['error' => $e::class, 'request_id' => $requestId]);

            return null;
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
                'access' => self::access($profile['access'] ?? null),
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
    private function fetch(string $action, string $accessToken, string $requestId, ?int $impersonate = null): array
    {
        $headers = ['Authorization' => 'Bearer ' . $accessToken, 'Accept' => 'application/json', 'X-Request-Id' => $requestId];
        if ($impersonate !== null) {
            $headers['X-Impersonate-Partner-Id'] = (string) $impersonate;
        }
        $response = $this->http->request('GET', $this->urls->internal($action), [
            'headers' => $headers,
            'http_errors' => false,
            'allow_redirects' => false,
            'timeout' => 5,
        ]);
        if ($response->getStatusCode() !== 200) {
            throw new \RuntimeException('contexto: HTTP ' . $response->getStatusCode());
        }
        if ($impersonate !== null && !EffectivePartner::matches($response, $impersonate)) {
            // B1/C11: sin confirmación del partner efectivo no se acepta el contexto suplantado.
            EffectivePartner::logMismatch($this->logger, $action, $impersonate, $response, $requestId);
            throw new \RuntimeException('contexto: X-Effective-Partner-Id ausente o distinto');
        }
        $decoded = json_decode((string) $response->getBody(), true);

        return is_array($decoded) ? $decoded : [];
    }

    /**
     * Roles y scopes efectivos del token que informa `get_my_profile.access`. Es informativo para la SPA (menús y
     * pantallas); el backend sigue autorizando cada petición. Se sanea porque viene del upstream.
     *
     * @return array{roles: list<string>, scopes: list<string>, is_root: bool}
     */
    private static function access(mixed $access): array
    {
        $access = is_array($access) ? $access : [];
        $roles = [];
        foreach (is_array($access['roles'] ?? null) ? $access['roles'] : [] as $role) {
            $name = is_array($role) ? ($role['name'] ?? null) : null;
            if (is_string($name) && preg_match('/^[a-z0-9_]{1,50}$/', $name) === 1) {
                $roles[] = $name;
            }
        }
        $scopes = [];
        foreach (is_array($access['scopes'] ?? null) ? $access['scopes'] : [] as $scope) {
            if (is_string($scope) && preg_match('/^[a-z0-9_.:-]{1,64}$/', $scope) === 1) {
                $scopes[] = $scope;
            }
        }

        return [
            'roles' => array_slice(array_values(array_unique($roles)), 0, 50),
            'scopes' => array_slice(array_values(array_unique($scopes)), 0, 300),
            'is_root' => ($access['is_root'] ?? false) === true,
        ];
    }

    private static function text(mixed $value): string
    {
        return is_string($value) ? mb_substr($value, 0, 200) : '';
    }
}
