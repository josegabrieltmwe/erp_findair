<?php

declare(strict_types=1);

namespace Findair\Bff\Tests;

use GuzzleHttp\Psr7\Response as UpstreamResponse;

final class AuthFlowTest extends AppTestCase
{
    /** @return array{sid: string, state: string, location: string} */
    private function startLogin(string $returnTo = '/shipments'): array
    {
        $response = $this->send($this->request('GET', '/bff/auth/login?return_to=' . rawurlencode($returnTo)));
        self::assertSame(302, $response->getStatusCode());
        $location = $response->getHeaderLine('Location');
        parse_str((string) parse_url($location, PHP_URL_QUERY), $query);
        self::assertIsString($query['state']);

        return ['sid' => $this->cookieId($response), 'state' => $query['state'], 'location' => $location];
    }

    public function testLoginRedirectsWithPkceAndState(): void
    {
        $this->boot();
        $login = $this->startLogin();

        self::assertStringStartsWith('http://public.test/app.php?', $login['location']);
        parse_str((string) parse_url($login['location'], PHP_URL_QUERY), $q);
        self::assertSame('auth', $q['action']);
        self::assertSame('cid', $q['client_id']);
        self::assertSame('code', $q['response_type']);
        self::assertSame('S256', $q['code_challenge_method']);
        self::assertSame(self::ORIGIN . '/bff/auth/callback', $q['redirect_uri']);
        self::assertArrayNotHasKey('client_secret', $q);
    }

    public function testCallbackExchangesCodeAndRotatesSession(): void
    {
        $this->boot([$this->upstreamOk('{"access_token":"AT","refresh_token":"RT","expires_in":86400,"refresh_token_expires_in":172800}')]);
        $login = $this->startLogin('/shipments');

        $response = $this->send($this->request('GET', '/bff/auth/callback?code=abc123&state=' . $login['state'], $login['sid']));

        self::assertSame(302, $response->getStatusCode());
        self::assertSame(self::ORIGIN . '/shipments', $response->getHeaderLine('Location'));

        $newId = $this->cookieId($response);
        self::assertNotSame($login['sid'], $newId, 'el id de sesión debe rotar al autenticar');
        self::assertNull($this->store->load($login['sid']));

        $stored = $this->store->load($newId);
        self::assertIsArray($stored);
        self::assertNull(json_decode((string) $stored['tokens']), 'los tokens deben estar cifrados, no en JSON plano');
        self::assertSame('AT', $this->vault->open((string) $stored['tokens'])?->accessToken);

        parse_str((string) $this->history[0]['request']->getBody(), $form);
        self::assertSame('authorization_code', $form['grant_type']);
        self::assertSame('csecret', $form['client_secret']);
        self::assertNotSame('', $form['code_verifier']);
    }

    public function testCallbackRejectsWrongState(): void
    {
        $this->boot();
        $login = $this->startLogin();
        $response = $this->send($this->request('GET', '/bff/auth/callback?code=abc&state=forged', $login['sid']));

        self::assertSame(self::ORIGIN . '/?auth_error=invalid_state', $response->getHeaderLine('Location'));
        self::assertCount(0, $this->history);
    }

    public function testCallbackWithoutSessionFails(): void
    {
        $this->boot();
        $response = $this->send($this->request('GET', '/bff/auth/callback?code=abc&state=x'));

        self::assertSame(self::ORIGIN . '/?auth_error=login_expired', $response->getHeaderLine('Location'));
    }

    public function testFailedExchangeDoesNotAuthenticate(): void
    {
        $this->boot([new UpstreamResponse(400, [], '{"error":"invalid_grant"}')]);
        $login = $this->startLogin();
        $response = $this->send($this->request('GET', '/bff/auth/callback?code=abc&state=' . $login['state'], $login['sid']));

        self::assertSame(self::ORIGIN . '/?auth_error=token_exchange_failed', $response->getHeaderLine('Location'));
        self::assertStringNotContainsString('tokens', json_encode($this->store->load($login['sid']) ?? [], JSON_THROW_ON_ERROR));
    }

    public function testReturnToCannotLeaveTheSite(): void
    {
        $this->boot([$this->upstreamOk('{"access_token":"AT","refresh_token":"RT","expires_in":60}')]);
        $login = $this->startLogin('//evil.example/phish');
        $response = $this->send($this->request('GET', '/bff/auth/callback?code=abc&state=' . $login['state'], $login['sid']));

        self::assertSame(self::ORIGIN . '/', $response->getHeaderLine('Location'));
    }

    public function testSessionInfoAnonymousAndAuthenticated(): void
    {
        $this->boot();
        $anon = $this->json($this->send($this->request('GET', '/bff/auth/session')));
        self::assertFalse($anon['authenticated']);
        self::assertArrayNotHasKey('csrf_token', $anon);

        $sid = $this->loginSession();
        $auth = $this->json($this->send($this->request('GET', '/bff/auth/session', $sid)));
        self::assertTrue($auth['authenticated']);
        self::assertSame('csrf-token', $auth['csrf_token']);
        self::assertArrayNotHasKey('access_token', $auth);
    }

    public function testLogoutRevokesAndDestroys(): void
    {
        $this->boot([$this->upstreamOk(), $this->upstreamOk()]);
        $sid = $this->loginSession();
        $response = $this->send($this->request('POST', '/bff/auth/logout', $sid, $this->unsafeHeaders()));

        self::assertSame(204, $response->getStatusCode());
        self::assertNull($this->store->load($sid));
        self::assertCount(2, $this->history);
        parse_str((string) $this->history[0]['request']->getBody(), $form);
        self::assertSame('access-1', $form['token']);
    }

    public function testLogoutRequiresCsrf(): void
    {
        $this->boot();
        $sid = $this->loginSession();
        $response = $this->send($this->request('POST', '/bff/auth/logout', $sid, ['Origin' => self::ORIGIN]));

        self::assertSame(403, $response->getStatusCode());
        self::assertNotNull($this->store->load($sid));
    }
}
