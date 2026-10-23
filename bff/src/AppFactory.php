<?php

declare(strict_types=1);

namespace Findair\Bff;

use DI\ContainerBuilder;
use Findair\Bff\Auth\TokenVault;
use Findair\Bff\Http\AuthController;
use Findair\Bff\Http\HealthController;
use Findair\Bff\Http\ImpersonationController;
use Findair\Bff\Http\Middleware\AuthMiddleware;
use Findair\Bff\Http\Middleware\OriginMiddleware;
use Findair\Bff\Http\Middleware\RequestIdMiddleware;
use Findair\Bff\Http\Middleware\SecurityHeadersMiddleware;
use Findair\Bff\Http\Middleware\SessionMiddleware;
use Findair\Bff\Http\ProblemErrorHandler;
use Findair\Bff\Proxy\CurlUpstreamStreamer;
use Findair\Bff\Proxy\ProxyController;
use Findair\Bff\Proxy\RouteManifest;
use Findair\Bff\Proxy\UpstreamStreamer;
use Findair\Bff\Proxy\UpstreamUrl;
use Findair\Bff\Session\RedisSessionStore;
use Findair\Bff\Session\SessionStore;
use Findair\Bff\Support\Redactor;
use Findair\Bff\Throttle\CounterStore;
use Findair\Bff\Throttle\RedisCounterStore;
use GuzzleHttp\Client;
use GuzzleHttp\ClientInterface;
use Monolog\Formatter\JsonFormatter;
use Monolog\Handler\StreamHandler;
use Monolog\Level;
use Monolog\Logger;
use Predis\Client as Redis;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use Slim\App;
use Slim\Factory\AppFactory as SlimFactory;
use Slim\Routing\RouteCollectorProxy;

final class AppFactory
{
    /**
     * @param array<string, mixed> $overrides definiciones PHP-DI (las pruebas sustituyen almacén y HTTP)
     * @return App<ContainerInterface|null>
     */
    public static function create(Settings $settings, array $overrides = []): App
    {
        $builder = new ContainerBuilder();
        $builder->addDefinitions([
            Settings::class => $settings,
            SessionStore::class => static fn (): SessionStore => new RedisSessionStore(new Redis($settings->redisDsn)),
            CounterStore::class => static fn (): CounterStore => new RedisCounterStore(new Redis($settings->redisDsn)),
            ClientInterface::class => static fn (): ClientInterface => new Client([
                'timeout' => $settings->upstreamTimeout,
                'connect_timeout' => $settings->upstreamConnectTimeout,
            ]),
            LoggerInterface::class => static function (): LoggerInterface {
                $handler = new StreamHandler('php://stderr', Level::Info);
                $handler->setFormatter(new JsonFormatter());

                return new Logger('bff', [$handler], [new Redactor()]);
            },
            UpstreamStreamer::class => static fn (): UpstreamStreamer => new CurlUpstreamStreamer(),
            TokenVault::class => static fn (): TokenVault => new TokenVault($settings->appKey),
            UpstreamUrl::class => static fn (): UpstreamUrl => new UpstreamUrl($settings->upstreamBaseUrl, $settings->upstreamPublicUrl),
            RouteManifest::class => static function () use ($settings): RouteManifest {
                $manifest = RouteManifest::fromFile($settings->manifestPath);
                $manifest->assertThrottlePolicies(array_keys($settings->throttlePolicies));

                return $manifest;
            },
        ]);
        $builder->addDefinitions($overrides);
        $container = $builder->build();

        SlimFactory::setContainer($container);
        $app = SlimFactory::create();

        // Slim enlaza este closure al contenedor: no puede ser static.
        $app->group('/bff', function (RouteCollectorProxy $bff): void {
            $bff->get('/healthz', [HealthController::class, 'live']);
            $bff->get('/readyz', [HealthController::class, 'ready']);

            $bff->get('/auth/login', [AuthController::class, 'login']);
            $bff->get('/auth/callback', [AuthController::class, 'callback']);
            $bff->get('/auth/session', [AuthController::class, 'sessionInfo']);
            $bff->post('/auth/logout', [AuthController::class, 'logout']);

            $bff->get('/impersonation', [ImpersonationController::class, 'show'])->add(AuthMiddleware::class);
            $bff->post('/impersonation', [ImpersonationController::class, 'switch'])->add(AuthMiddleware::class);

            $bff->any('/v1/{path:.*}', ProxyController::class)->add(AuthMiddleware::class);
        });

        // Slim ejecuta primero el último middleware añadido. Orden real, de fuera a dentro:
        // RequestId → SecurityHeaders → Errores → Routing → Sesión → Origen.
        $app->add(OriginMiddleware::class);
        $app->add(SessionMiddleware::class);
        $app->addRoutingMiddleware();
        $errors = $app->addErrorMiddleware($settings->env === 'local', true, true, $container->get(LoggerInterface::class));
        $errors->setDefaultErrorHandler($container->get(ProblemErrorHandler::class));
        $app->add(SecurityHeadersMiddleware::class);
        $app->add(RequestIdMiddleware::class);

        return $app;
    }
}
