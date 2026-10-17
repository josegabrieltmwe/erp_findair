<?php

declare(strict_types=1);

use Findair\Bff\AppFactory;
use Findair\Bff\Settings;

require __DIR__ . '/../vendor/autoload.php';

$root = dirname(__DIR__);
if (is_file($root . '/.env')) {
    // En producción las variables vienen del entorno del proceso; .env es solo para desarrollo.
    Dotenv\Dotenv::createImmutable($root)->safeLoad();
}

$settings = Settings::fromEnv($_ENV, $root . '/config/routes.bff.yaml');
if ($settings->appKey === '' || $settings->oauthClientId === '' || $settings->upstreamBaseUrl === '') {
    http_response_code(500);
    header('Content-Type: application/problem+json');
    echo '{"type":"urn:findair:bff:error:misconfigured","title":"Servicio mal configurado","status":500,"code":"misconfigured"}';
    exit;
}

AppFactory::create($settings)->run();
