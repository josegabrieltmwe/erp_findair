<?php

declare(strict_types=1);

namespace Findair\Bff\Http;

use Findair\Bff\Auth\PartnerSwitcher;
use Findair\Bff\Auth\TokenSet;
use Findair\Bff\Session\Session;
use Findair\Bff\Support\ProblemDetails;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Log\LoggerInterface;

/** Cambio de partner forzado por el personal TMWE (equivalente stateless del partner_switch de la SPA clásica). */
final class ImpersonationController
{
    public function __construct(
        private readonly PartnerSwitcher $switcher,
        private readonly CsrfGuard $csrf,
        private readonly LoggerInterface $logger,
    ) {
    }

    /** Lista de partners y partner activo. 403 si el usuario no es TMWE (la SPA oculta el selector). */
    public function show(Request $request, ResponseInterface $response): ResponseInterface
    {
        $requestId = (string) $request->getAttribute('request_id', '');
        $session = $this->session($request);
        if (!self::isTmwe($session)) {
            return ProblemDetails::response(403, 'not_tmwe', 'Acceso denegado', 'Solo el personal de TMWE puede cambiar de partner.', $requestId);
        }

        try {
            $partners = $this->switcher->partners($this->tokens($request)->accessToken, $requestId);
        } catch (\Throwable $e) {
            $this->logger->warning('partner_list_failed', ['error' => $e::class, 'request_id' => $requestId]);

            return ProblemDetails::response(502, 'upstream_error', 'Error del servicio', null, $requestId);
        }

        return $this->json($response, ['partners' => $partners] + self::active($session));
    }

    /** Activa (partner_id > 1) o limpia (null, 0 o 1) la suplantación. */
    public function switch(Request $request, ResponseInterface $response): ResponseInterface
    {
        $requestId = (string) $request->getAttribute('request_id', '');
        $session = $this->session($request);
        if (!$this->csrf->tokenIsValid($request, $session)) {
            return ProblemDetails::response(403, 'csrf_invalid', 'Token CSRF no válido', null, $requestId);
        }
        if (!self::isTmwe($session)) {
            return ProblemDetails::response(403, 'not_tmwe', 'Acceso denegado', 'Solo el personal de TMWE puede cambiar de partner.', $requestId);
        }

        $body = json_decode((string) $request->getBody(), true);
        $raw = is_array($body) ? ($body['partner_id'] ?? null) : null;
        if ($raw !== null && !(is_int($raw) || (is_string($raw) && ctype_digit($raw)))) {
            return ProblemDetails::response(422, 'invalid_partner', 'Partner no válido', 'partner_id debe ser un entero.', $requestId);
        }
        $partnerId = $raw === null ? 0 : (int) $raw;

        if ($partnerId <= 1) {
            $session->forget('impersonation');
            $this->logger->info('impersonation_cleared', ['request_id' => $requestId]);

            return $this->json($response, self::active($session));
        }

        $accessToken = $this->tokens($request)->accessToken;
        try {
            $partners = $this->switcher->partners($accessToken, $requestId);
        } catch (\Throwable) {
            return ProblemDetails::response(502, 'upstream_error', 'Error del servicio', null, $requestId);
        }
        $partner = null;
        foreach ($partners as $candidate) {
            if ($candidate['id'] === $partnerId) {
                $partner = $candidate;
            }
        }
        if ($partner === null) {
            return ProblemDetails::response(404, 'partner_not_found', 'Partner no encontrado', null, $requestId);
        }

        $context = $this->switcher->contextFor($accessToken, $partnerId, $requestId);
        if ($context === null) {
            $this->logger->warning('impersonation_rejected', ['partner_id' => $partnerId, 'request_id' => $requestId]);

            return ProblemDetails::response(403, 'impersonation_not_allowed', 'Suplantación no permitida', 'El backend rechaza la suplantación: falta el scope partner:impersonate o el partner no es válido.', $requestId);
        }

        $session->set('impersonation', ['partner_id' => $partnerId, 'name' => $partner['rag_soc'], 'capabilities' => $context['capabilities'], 'at' => time()]);
        $this->logger->info('impersonation_started', ['partner_id' => $partnerId, 'request_id' => $requestId]);

        return $this->json($response, self::active($session));
    }

    /** @return array{active_partner_id: int|null, active_partner: array{id: int, rag_soc: string}|null} */
    public static function active(Session $session): array
    {
        $state = $session->get('impersonation');
        if (!is_array($state) || !is_int($state['partner_id'] ?? null)) {
            return ['active_partner_id' => null, 'active_partner' => null];
        }

        return [
            'active_partner_id' => $state['partner_id'],
            'active_partner' => ['id' => $state['partner_id'], 'rag_soc' => is_string($state['name'] ?? null) ? $state['name'] : ''],
        ];
    }

    /** Partner suplantado en esta sesión, solo si el usuario real es TMWE. */
    public static function impersonatedPartner(Session $session): ?int
    {
        return self::isTmwe($session) ? self::active($session)['active_partner_id'] : null;
    }

    private static function isTmwe(Session $session): bool
    {
        $context = $session->get('context');

        return is_array($context) && is_array($context['user'] ?? null) && ($context['user']['is_tmwe'] ?? false) === true;
    }

    private function session(Request $request): Session
    {
        $session = $request->getAttribute('session');
        if (!$session instanceof Session) {
            throw new \LogicException('SessionMiddleware no está activo.');
        }

        return $session;
    }

    private function tokens(Request $request): TokenSet
    {
        $tokens = $request->getAttribute('tokens');
        if (!$tokens instanceof TokenSet) {
            throw new \LogicException('AuthMiddleware no está activo.');
        }

        return $tokens;
    }

    /** @param array<string, mixed> $payload */
    private function json(ResponseInterface $response, array $payload): ResponseInterface
    {
        $response->getBody()->write(json_encode($payload, JSON_THROW_ON_ERROR));

        return $response->withHeader('Content-Type', 'application/json; charset=utf-8')->withHeader('Cache-Control', 'no-store');
    }
}
