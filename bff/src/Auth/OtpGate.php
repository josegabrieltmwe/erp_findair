<?php

declare(strict_types=1);

namespace Findair\Bff\Auth;

use Findair\Bff\Proxy\UpstreamUrl;
use Findair\Bff\Throttle\OtpAttemptLimiter;
use GuzzleHttp\ClientInterface;
use Psr\Log\LoggerInterface;

/**
 * El punto de autorización por OTP.
 *
 * Quien presenta el OTP no tiene usuario: no se autentica, se AUTORIZA a entrar a un recurso. Frente al API quien se
 * autentica es la aplicación: aquí se negocia su Bearer (`client_credentials`) y con él se pregunta al API si ese OTP
 * autoriza ese recurso (`api_otp_authorize`). Solo si lo autoriza hay concesión; el que llama (AuthController) abre
 * entonces la sesión.
 *
 * Orden: bloqueo por intentos → forma de los datos → Bearer → API. Una forma inválida ni toca el API y cuenta como fallo.
 */
final class OtpGate
{
    /** Tipos de recurso admitidos y la forma de su OTP. Un tipo nuevo se da de alta aquí y en el API (Otp_Resource_Authorizer). */
    public const TYPES = [
        'cargo_offer' => ['otp' => '/^[0-9A-Za-z]{1,12}$/'],
    ];

    public const AUTHORIZED = 'authorized';
    public const DENIED = 'denied';
    public const LOCKED = 'locked';
    public const UNAVAILABLE = 'unavailable';

    public function __construct(
        private readonly OAuthClient $oauth,
        private readonly UpstreamUrl $urls,
        private readonly ClientInterface $http,
        private readonly OtpAttemptLimiter $limiter,
        private readonly LoggerInterface $logger,
    ) {
    }

    /**
     * @return array{outcome: string, tokens?: TokenSet, resource?: array<string, mixed>, scopes?: list<string>, expires_at?: ?int, retry_after?: int}
     */
    public function authorize(string $type, mixed $id, mixed $otp, string $ip, int $now, string $requestId): array
    {
        $idInt = is_scalar($id) && preg_match('/^[0-9]{1,15}$/', (string) $id) === 1 ? (int) $id : 0;
        $knownType = isset(self::TYPES[$type]);

        // El bloqueo se mira ANTES que nada y por (tipo, id) aunque el recurso no exista: no es un oráculo de existencia.
        $retry = $this->limiter->lockedFor($knownType ? $type : 'unknown', $idInt, $ip);
        if ($retry !== null) {
            return ['outcome' => self::LOCKED, 'retry_after' => $retry];
        }

        if (!$knownType || $idInt <= 0 || !is_string($otp) || preg_match(self::TYPES[$type]['otp'], $otp) !== 1) {
            $this->limiter->recordFailure($knownType ? $type : 'unknown', $idInt, $ip);

            return ['outcome' => self::DENIED];
        }

        try {
            $tokens = $this->oauth->clientCredentials($now);
            $response = $this->http->request('POST', $this->urls->internal('api_otp_authorize'), [
                'headers' => ['Authorization' => 'Bearer ' . $tokens->accessToken, 'Accept' => 'application/json', 'X-Request-Id' => $requestId],
                'json' => ['type' => $type, 'id' => $idInt, 'otp' => $otp],
                'http_errors' => false,
                'allow_redirects' => false,
            ]);
        } catch (\Throwable $e) {
            $this->logger->error('otp_gate_unavailable', ['error' => $e::class, 'request_id' => $requestId]);

            return ['outcome' => self::UNAVAILABLE];
        }

        $payload = json_decode((string) $response->getBody(), true);
        if ($response->getStatusCode() !== 200 || !is_array($payload) || ($payload['success'] ?? null) !== true) {
            // El API no contestó lo esperado (Bearer rechazado, error interno…): no es culpa de quien presenta el OTP.
            $this->logger->error('otp_gate_upstream_error', ['status' => $response->getStatusCode(), 'request_id' => $requestId]);
            $this->oauth->revoke($tokens->accessToken, 'access_token');

            return ['outcome' => self::UNAVAILABLE];
        }

        if (($payload['authorized'] ?? false) !== true || !is_array($payload['resource'] ?? null)) {
            $this->limiter->recordFailure($type, $idInt, $ip);
            $this->oauth->revoke($tokens->accessToken, 'access_token');
            $this->logger->info('otp_denied', ['type' => $type, 'resource_id' => $idInt, 'request_id' => $requestId]);

            return ['outcome' => self::DENIED];
        }

        $this->limiter->recordSuccess($type, $idInt);
        $this->logger->info('otp_authorized', ['type' => $type, 'resource_id' => $idInt, 'request_id' => $requestId]);

        return [
            'outcome' => self::AUTHORIZED,
            'tokens' => $tokens,
            'resource' => $payload['resource'],
            'scopes' => array_values(array_filter((array) ($payload['scopes'] ?? []), 'is_string')),
            'expires_at' => is_int($payload['expires_at'] ?? null) ? $payload['expires_at'] : null,
        ];
    }
}
