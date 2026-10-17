<?php

declare(strict_types=1);

namespace Findair\Bff\Http\Middleware;

use Findair\Bff\Session\Session;
use Findair\Bff\Session\SessionStore;
use Findair\Bff\Settings;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as Handler;

/**
 * Carga la sesión por la cookie opaca y la persiste solo si cambió.
 */
final class SessionMiddleware implements MiddlewareInterface
{
    public function __construct(private readonly SessionStore $store, private readonly Settings $settings)
    {
    }

    public function process(Request $request, Handler $handler): ResponseInterface
    {
        $session = $this->load($request);
        if (!$session->isNew()) {
            $this->store->touch($session->id(), $this->settings->sessionIdleTtl);
        }

        $response = $handler->handle($request->withAttribute('session', $session));

        if ($session->isDestroyed()) {
            $this->store->delete($session->id());
            if ($session->previousId() !== null) {
                $this->store->delete($session->previousId());
            }

            return $response->withAddedHeader('Set-Cookie', $this->cookie('', true));
        }

        if ($session->isDirty()) {
            if ($session->previousId() !== null) {
                $this->store->delete($session->previousId());
            }
            $this->store->save($session->id(), $session->all(), $this->settings->sessionIdleTtl);
            $response = $response->withAddedHeader('Set-Cookie', $this->cookie($session->id(), false));
        }

        return $response;
    }

    private function load(Request $request): Session
    {
        $id = $request->getCookieParams()[$this->settings->cookieName] ?? null;
        if (is_string($id) && Session::isValidId($id)) {
            $data = $this->store->load($id);
            if ($data !== null) {
                $createdAt = is_int($data['created_at'] ?? null) ? $data['created_at'] : 0;
                if (time() - $createdAt <= $this->settings->sessionAbsoluteTtl) {
                    return new Session($id, $data, false);
                }
                $this->store->delete($id);
            }
        }

        return new Session(Session::generateId(), ['created_at' => time()], true);
    }

    private function cookie(string $value, bool $expire): string
    {
        $parts = [$this->settings->cookieName . '=' . $value, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
        if ($this->settings->isSecureCookie()) {
            $parts[] = 'Secure';
        }
        if ($expire) {
            $parts[] = 'Max-Age=0';
            $parts[] = 'Expires=Thu, 01 Jan 1970 00:00:00 GMT';
        }

        return implode('; ', $parts);
    }
}
