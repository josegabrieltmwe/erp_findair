<?php

declare(strict_types=1);

namespace Findair\Bff\Tests;

use Findair\Bff\AppFactory;
use Findair\Bff\Auth\TokenSet;
use Findair\Bff\Auth\TokenVault;
use Findair\Bff\Session\ArraySessionStore;
use Findair\Bff\Session\Session;
use Findair\Bff\Session\SessionStore;
use Findair\Bff\Settings;
use GuzzleHttp\Client;
use GuzzleHttp\ClientInterface;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Response as UpstreamResponse;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;
use Slim\App;
use Slim\Psr7\Factory\ServerRequestFactory;

abstract class AppTestCase extends TestCase
{
    protected const ORIGIN = 'http://localhost:8080';

    protected ArraySessionStore $store;
    protected Settings $settings;
    protected TokenVault $vault;
    protected MockHandler $upstream;

    /** @var list<array{request: \Psr\Http\Message\RequestInterface, response: ?ResponseInterface}> */
    protected array $history = [];

    /** @var App<\Psr\Container\ContainerInterface|null> */
    protected App $app;

    /** @param list<UpstreamResponse|\Throwable> $queue */
    protected function boot(array $queue = []): void
    {
        $key = 'base64:' . base64_encode(str_repeat('k', 32));
        $this->settings = Settings::fromEnv([
            'APP_ENV' => 'testing',
            'APP_URL' => self::ORIGIN,
            'APP_KEY' => $key,
            'SESSION_COOKIE' => 'sid',
            'UPSTREAM_BASE_URL' => 'http://upstream.test/app.php',
            'UPSTREAM_PUBLIC_URL' => 'http://public.test/app.php',
            'OAUTH_CLIENT_ID' => 'cid',
            'OAUTH_CLIENT_SECRET' => 'csecret',
        ], __DIR__ . '/fixtures/routes.yaml');

        $this->store = new ArraySessionStore();
        $this->vault = new TokenVault($key);
        $this->upstream = new MockHandler($queue);
        $this->history = [];
        $stack = HandlerStack::create($this->upstream);
        $stack->push(Middleware::history($this->history));

        $this->app = AppFactory::create($this->settings, [
            SessionStore::class => $this->store,
            ClientInterface::class => new Client(['handler' => $stack]),
            LoggerInterface::class => new NullLogger(),
        ]);
    }

    /** Crea una sesión autenticada en el almacén y devuelve su id. */
    protected function loginSession(?TokenSet $tokens = null): string
    {
        $id = Session::generateId();
        $tokens ??= new TokenSet('access-1', 'refresh-1', time() + 3600, time() + 7200);
        $this->store->save($id, [
            'created_at' => time(),
            'csrf' => 'csrf-token',
            'tokens' => $this->vault->seal($tokens),
        ], 1800);

        return $id;
    }

    /** @param array<string, string> $headers */
    protected function request(string $method, string $path, ?string $sessionId = null, array $headers = [], string $body = ''): ServerRequestInterface
    {
        $request = (new ServerRequestFactory())->createServerRequest($method, self::ORIGIN . $path);
        foreach ($headers as $name => $value) {
            $request = $request->withHeader($name, $value);
        }
        if ($sessionId !== null) {
            $request = $request->withCookieParams(['sid' => $sessionId]);
        }
        if ($body !== '') {
            $request->getBody()->write($body);
            $request->getBody()->rewind();
        }

        return $request;
    }

    /**
     * Cabeceras de una petición del navegador legítima que cambia estado.
     *
     * @return array<string, string>
     */
    protected function unsafeHeaders(): array
    {
        return ['Origin' => self::ORIGIN, 'X-CSRF-Token' => 'csrf-token', 'Content-Type' => 'application/json'];
    }

    protected function cookieId(ResponseInterface $response): string
    {
        $matches = [];
        self::assertSame(1, preg_match('/^sid=([^;]+);/', $response->getHeaderLine('Set-Cookie'), $matches), 'falta Set-Cookie sid');

        return (string) ($matches[1] ?? '');
    }

    protected function send(ServerRequestInterface $request): ResponseInterface
    {
        return $this->app->handle($request);
    }

    /** @return array<string, mixed> */
    protected function json(ResponseInterface $response): array
    {
        $decoded = json_decode((string) $response->getBody(), true);
        self::assertIsArray($decoded);

        return $decoded;
    }

    protected function upstreamOk(string $body = '{"ok":true}', int $status = 200): UpstreamResponse
    {
        return new UpstreamResponse($status, ['Content-Type' => 'application/json'], $body);
    }
}
