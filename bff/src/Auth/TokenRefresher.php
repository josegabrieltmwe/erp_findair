<?php

declare(strict_types=1);

namespace Findair\Bff\Auth;

use Findair\Bff\Session\Session;
use Findair\Bff\Session\SessionStore;
use Findair\Bff\Settings;

/**
 * Refresca el access token una sola vez aunque lleguen varias peticiones a la
 * vez. El backend rota el refresh token: usarlo dos veces cerraría la sesión.
 */
final class TokenRefresher
{
    private const LEEWAY = 60;

    public function __construct(
        private readonly SessionStore $store,
        private readonly TokenVault $vault,
        private readonly OAuthClient $oauth,
        private readonly Settings $settings,
    ) {
    }

    /** @return TokenSet|null null si la sesión no tiene tokens válidos */
    public function current(Session $session): ?TokenSet
    {
        $sealed = $session->get('tokens');

        return is_string($sealed) ? $this->vault->open($sealed) : null;
    }

    /**
     * @param bool $force ignora el margen de caducidad (tras un 401 del backend)
     * @return TokenSet|null null si no se pudo refrescar; la sesión debe cerrarse
     */
    public function ensureFresh(Session $session, int $now, bool $force = false, ?string $rejectedAccessToken = null): ?TokenSet
    {
        $tokens = $this->current($session);
        if ($tokens === null) {
            return null;
        }
        if (!$force && !$tokens->expiresWithin(self::LEEWAY, $now)) {
            return $tokens;
        }

        $lockName = 'refresh:' . $session->id();
        $owner = $this->waitForLock($lockName);
        if ($owner === null) {
            // Otro proceso está refrescando: se relee el resultado.
            return $this->reload($session) ?? $tokens;
        }

        try {
            // Otra petición pudo refrescar mientras esperábamos el bloqueo.
            $fresh = $this->reload($session);
            if ($fresh !== null && $fresh->accessToken !== $tokens->accessToken
                && $fresh->accessToken !== $rejectedAccessToken
                && !$fresh->expiresWithin(self::LEEWAY, $now)) {
                return $fresh;
            }
            $tokens = $fresh ?? $tokens;
            if (!$tokens->canRefresh($now)) {
                return null;
            }

            try {
                $renewed = $this->oauth->refresh($tokens->refreshToken, $now);
            } catch (OAuthException $e) {
                if ($e->oauthError === 'server_unreachable') {
                    // Fallo transitorio: no se destruye la sesión.
                    return $tokens->expiresAt > $now ? $tokens : null;
                }

                return null;
            }

            $this->persist($session, $renewed);

            return $renewed;
        } finally {
            $this->store->releaseLock($lockName, $owner);
        }
    }

    public function persist(Session $session, TokenSet $tokens): void
    {
        $sealed = $this->vault->seal($tokens);
        $data = $this->store->load($session->id()) ?? $session->all();
        $data['tokens'] = $sealed;
        $this->store->save($session->id(), $data, $this->settings->sessionIdleTtl);
        $session->hydrate('tokens', $sealed);
    }

    private function reload(Session $session): ?TokenSet
    {
        $data = $this->store->load($session->id());
        $sealed = is_array($data) ? ($data['tokens'] ?? null) : null;

        return is_string($sealed) ? $this->vault->open($sealed) : null;
    }

    private function waitForLock(string $name): ?string
    {
        for ($i = 0; $i < 60; $i++) {
            $owner = $this->store->acquireLock($name, 10_000);
            if ($owner !== null) {
                return $owner;
            }
            usleep(50_000);
        }

        return null;
    }
}
