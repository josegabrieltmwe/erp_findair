<?php

declare(strict_types=1);

namespace Findair\Bff\Tests;

use GuzzleHttp\Psr7\Response as UpstreamResponse;

final class ImpersonationTest extends AppTestCase
{
    private const PARTNERS = '{"success":true,"data":{"partners":[{"id":"1","rag_soc":"TMWE","id_paese_iso":"IT"},{"id":"9069","rag_soc":"123Logistix","id_paese_iso":"NL"}],"active_partner_id":null}}';
    private const PARTNER_CONTEXT = '{"user":{"username":"jose","idanagfrc":9069},"capabilities":["clients","my_org"]}';

    protected array $extraEnv = ['UPSTREAM_CONTEXT_ACTION' => 'get_ops_bootstrap'];

    /** @return array<string, mixed> */
    private static function tmweContext(): array
    {
        return ['user' => ['username' => 'jose', 'partner_id' => 1, 'is_tmwe' => true], 'capabilities' => ['tmwe', 'clients']];
    }

    private function tmweSession(): string
    {
        return $this->loginSession(null, self::tmweContext());
    }

    /** @param array<string, string> $extra */
    private function post(string $sid, string $body, array $extra = []): \Psr\Http\Message\ResponseInterface
    {
        return $this->send($this->request('POST', '/bff/impersonation', $sid, $extra + $this->unsafeHeaders(), $body));
    }

    public function testListIsForbiddenForNonTmweUsers(): void
    {
        $this->boot();
        $sid = $this->loginSession(null, ['user' => ['partner_id' => 9069, 'is_tmwe' => false], 'capabilities' => []]);
        $response = $this->send($this->request('GET', '/bff/impersonation', $sid));

        self::assertSame(403, $response->getStatusCode());
        self::assertSame('not_tmwe', $this->json($response)['code']);
        self::assertCount(0, $this->history, 'no debe consultar al backend');
    }

    public function testListReturnsPartnersAndNoActiveOne(): void
    {
        $this->boot([$this->upstreamOk(self::PARTNERS)]);
        $response = $this->send($this->request('GET', '/bff/impersonation', $this->tmweSession()));

        $body = $this->json($response);
        self::assertSame(200, $response->getStatusCode());
        self::assertSame(9069, $body['partners'][1]['id']);
        self::assertNull($body['active_partner_id']);
        self::assertStringContainsString('action=partner_switch', (string) $this->history[0]['request']->getUri());
    }

    public function testSwitchRequiresCsrf(): void
    {
        $this->boot();
        $sid = $this->tmweSession();
        $response = $this->send($this->request('POST', '/bff/impersonation', $sid, ['Origin' => self::ORIGIN, 'Content-Type' => 'application/json'], '{"partner_id":9069}'));

        self::assertSame(403, $response->getStatusCode());
        self::assertSame('csrf_invalid', $this->json($response)['code']);
    }

    public function testSwitchRejectsNonTmwe(): void
    {
        $this->boot();
        $sid = $this->loginSession(null, ['user' => ['is_tmwe' => false], 'capabilities' => []]);

        self::assertSame('not_tmwe', $this->json($this->post($sid, '{"partner_id":9069}'))['code']);
    }

    public function testSwitchRejectsNonNumericPartner(): void
    {
        $this->boot();
        $response = $this->post($this->tmweSession(), '{"partner_id":"9069; DROP"}');

        self::assertSame(422, $response->getStatusCode());
    }

    public function testSwitchUnknownPartnerIsNotFound(): void
    {
        $this->boot([$this->upstreamOk(self::PARTNERS)]);
        $response = $this->post($this->tmweSession(), '{"partner_id":555}');

        self::assertSame(404, $response->getStatusCode());
    }

    public function testBackendRejectionIsReportedAndNothingIsStored(): void
    {
        $this->boot([$this->upstreamOk(self::PARTNERS), new UpstreamResponse(401, [], '{"error":"invalid_token"}')]);
        $sid = $this->tmweSession();
        $response = $this->post($sid, '{"partner_id":9069}');

        self::assertSame(403, $response->getStatusCode());
        self::assertSame('impersonation_not_allowed', $this->json($response)['code']);
        self::assertSame('9069', $this->history[1]['request']->getHeaderLine('X-Impersonate-Partner-Id'));
        self::assertNull($this->store->load($sid)['impersonation'] ?? null);
    }

    public function testActiveImpersonationAddsHeaderToProxiedRequestsAndChangesCapabilities(): void
    {
        $this->boot([
            $this->upstreamOk(self::PARTNERS),
            $this->asPartner(self::PARTNER_CONTEXT),
            $this->asPartner('{"ok":true}'),
        ]);
        $sid = $this->tmweSession();

        $switch = $this->post($sid, '{"partner_id":9069}');
        self::assertSame(200, $switch->getStatusCode());
        self::assertSame(9069, $this->json($switch)['active_partner_id']);

        $this->send($this->request('GET', '/bff/v1/things/7', $sid));
        self::assertSame('9069', $this->history[2]['request']->getHeaderLine('X-Impersonate-Partner-Id'));

        $info = $this->json($this->send($this->request('GET', '/bff/auth/session', $sid)));
        self::assertSame(['clients', 'my_org'], $info['capabilities']);
        self::assertSame(['id' => 9069, 'rag_soc' => '123Logistix'], $info['impersonation']);
        self::assertTrue($info['user']['is_tmwe'], 'el usuario real sigue siendo TMWE');
    }

    public function testClearingStopsSendingTheHeader(): void
    {
        $this->boot([$this->upstreamOk(self::PARTNERS), $this->asPartner(self::PARTNER_CONTEXT), $this->upstreamOk()]);
        $sid = $this->tmweSession();
        $this->post($sid, '{"partner_id":9069}');
        $cleared = $this->post($sid, '{"partner_id":1}');

        self::assertNull($this->json($cleared)['active_partner_id']);
        $this->send($this->request('GET', '/bff/v1/things/7', $sid));
        self::assertSame('', $this->history[2]['request']->getHeaderLine('X-Impersonate-Partner-Id'));
    }

    public function testNonTmweSessionNeverSendsTheHeaderEvenIfStateIsPlanted(): void
    {
        $this->boot([$this->upstreamOk()]);
        $sid = $this->loginSession(null, ['user' => ['is_tmwe' => false], 'capabilities' => []]);
        $data = $this->store->load($sid) ?? [];
        $data['impersonation'] = ['partner_id' => 9069, 'name' => 'x', 'capabilities' => []];
        $this->store->save($sid, $data, 1800);

        $this->send($this->request('GET', '/bff/v1/things/7', $sid));
        self::assertSame('', $this->history[0]['request']->getHeaderLine('X-Impersonate-Partner-Id'));
    }

    public function testBackendRevokingImpersonationMidSessionClearsItAndKeepsTheSession(): void
    {
        $this->boot([
            $this->upstreamOk(self::PARTNERS),
            $this->asPartner(self::PARTNER_CONTEXT),
            new UpstreamResponse(401, [], ''),  // la petición con la cabecera
            $this->upstreamOk(),                // sondeo: el token vale sin cabecera
        ]);
        $sid = $this->tmweSession();
        $this->post($sid, '{"partner_id":9069}');

        $response = $this->send($this->request('GET', '/bff/v1/things/7', $sid));
        self::assertSame(403, $response->getStatusCode());
        self::assertSame('impersonation_revoked', $this->json($response)['code']);
        self::assertNull($this->json($this->send($this->request('GET', '/bff/auth/session', $sid)))['impersonation']);
        self::assertTrue($this->json($this->send($this->request('GET', '/bff/auth/session', $sid)))['authenticated']);
    }

    private function asPartner(string $body, int $partnerId = 9069): UpstreamResponse
    {
        return new UpstreamResponse(200, ['Content-Type' => 'application/json', 'X-Effective-Partner-Id' => (string) $partnerId], $body);
    }

    public function testContextWithoutEffectivePartnerHeaderIsRejectedAndNothingIsStored(): void
    {
        $this->boot([$this->upstreamOk(self::PARTNERS), $this->upstreamOk(self::PARTNER_CONTEXT)]);
        $sid = $this->tmweSession();
        $response = $this->post($sid, '{"partner_id":9069}');

        self::assertSame(403, $response->getStatusCode());
        self::assertSame('impersonation_not_allowed', $this->json($response)['code']);
        self::assertNull($this->store->load($sid)['impersonation'] ?? null);
    }

    public function testContextWithOtherEffectivePartnerIsRejected(): void
    {
        $this->boot([$this->upstreamOk(self::PARTNERS), $this->asPartner(self::PARTNER_CONTEXT, 1)]);
        $sid = $this->tmweSession();

        self::assertSame('impersonation_not_allowed', $this->json($this->post($sid, '{"partner_id":9069}'))['code']);
        self::assertNull($this->store->load($sid)['impersonation'] ?? null);
    }

    public function testProxiedResponseWithoutEffectivePartnerIsDiscardedAsProblemDetails(): void
    {
        $this->boot([$this->upstreamOk(self::PARTNERS), $this->asPartner(self::PARTNER_CONTEXT), $this->upstreamOk('{"secret_rows":[1,2,3]}')]);
        $sid = $this->tmweSession();
        $this->post($sid, '{"partner_id":9069}');

        $response = $this->send($this->request('GET', '/bff/v1/things/7', $sid));

        self::assertSame(502, $response->getStatusCode());
        self::assertStringStartsWith('application/problem+json', $response->getHeaderLine('Content-Type'));
        self::assertSame('effective_partner_mismatch', $this->json($response)['code']);
        self::assertStringNotContainsString('secret_rows', (string) $response->getBody());
    }

    public function testProxiedResponseWithDifferentEffectivePartnerIsDiscarded(): void
    {
        $this->boot([$this->upstreamOk(self::PARTNERS), $this->asPartner(self::PARTNER_CONTEXT), $this->asPartner('{"rows":[1]}', 1)]);
        $sid = $this->tmweSession();
        $this->post($sid, '{"partner_id":9069}');

        $response = $this->send($this->request('GET', '/bff/v1/things/7', $sid));

        self::assertSame('effective_partner_mismatch', $this->json($response)['code']);
        self::assertStringNotContainsString('rows', (string) $response->getBody());
    }

    public function testNonNumericOrDuplicatedEffectivePartnerHeaderIsRejected(): void
    {
        $this->boot([
            $this->upstreamOk(self::PARTNERS),
            $this->asPartner(self::PARTNER_CONTEXT),
            new UpstreamResponse(200, ['X-Effective-Partner-Id' => '9069abc'], '{}'),
            new UpstreamResponse(200, ['X-Effective-Partner-Id' => ['9069', '1']], '{}'),
        ]);
        $sid = $this->tmweSession();
        $this->post($sid, '{"partner_id":9069}');

        self::assertSame('effective_partner_mismatch', $this->json($this->send($this->request('GET', '/bff/v1/things/7', $sid)))['code']);
        self::assertSame('effective_partner_mismatch', $this->json($this->send($this->request('GET', '/bff/v1/things/7', $sid)))['code']);
    }

    /** @param list<mixed> $queue */
    private function impersonatedSession(array $queue): string
    {
        $this->boot(array_merge([$this->upstreamOk(self::PARTNERS), $this->asPartner(self::PARTNER_CONTEXT)], $queue));
        $sid = $this->tmweSession();
        $this->post($sid, '{"partner_id":9069}');

        return $sid;
    }

    public function testBinaryResponseWithoutHeaderIsDeliveredWhileImpersonating(): void
    {
        $sid = $this->impersonatedSession([new UpstreamResponse(200, ['Content-Type' => 'application/pdf'], '%PDF-1.4')]);

        $response = $this->send($this->request('GET', '/bff/v1/file', $sid));

        self::assertSame(200, $response->getStatusCode());
        self::assertStringContainsString('%PDF', (string) $response->getBody());
    }

    public function testNoContentResponseWithoutHeaderIsDeliveredWhileImpersonating(): void
    {
        $sid = $this->impersonatedSession([new UpstreamResponse(204)]);

        self::assertNotSame(502, $this->send($this->request('GET', '/bff/v1/things/7', $sid))->getStatusCode());
    }

    public function testRouteThatOptsOutOfTheCheckIsDeliveredWithoutHeader(): void
    {
        $sid = $this->impersonatedSession([$this->upstreamOk('{"ok":true}')]);

        $response = $this->send($this->request('GET', '/bff/v1/nocheck', $sid));

        self::assertSame(200, $response->getStatusCode());
        self::assertStringContainsString('ok', (string) $response->getBody());
    }

    public function testJsonRoutesStillRequireTheHeaderByDefault(): void
    {
        $sid = $this->impersonatedSession([$this->upstreamOk('{"x":1}')]);

        self::assertSame(502, $this->send($this->request('GET', '/bff/v1/things/7', $sid))->getStatusCode());
    }

    public function testWithoutImpersonationTheHeaderIsNotRequired(): void
    {
        $this->boot([$this->upstreamOk('{"id":1}')]);
        $sid = $this->tmweSession();

        self::assertSame(200, $this->send($this->request('GET', '/bff/v1/things/7', $sid))->getStatusCode());
    }

    public function testBackendErrorsDuringImpersonationKeepTheirOwnStatus(): void
    {
        $this->boot([$this->upstreamOk(self::PARTNERS), $this->asPartner(self::PARTNER_CONTEXT), new UpstreamResponse(404, [], '{"error":"not_found"}')]);
        $sid = $this->tmweSession();
        $this->post($sid, '{"partner_id":9069}');

        self::assertSame(404, $this->send($this->request('GET', '/bff/v1/things/7', $sid))->getStatusCode());
    }
}
