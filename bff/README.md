# ERP Findair · BFF

Backend For Frontend en Slim 4 (PHP 8.3+). Custodia los tokens OAuth2 y hace de proxy entre la SPA Vue y la API de `tmwe_json`. El navegador solo recibe una cookie de sesión opaca.

## Qué hace

| Ruta | Función |
|---|---|
| `GET /bff/auth/login` | Inicia Authorization Code + PKCE hacia el login de tmwe_json (`action=auth`) |
| `GET /bff/auth/callback` | Canjea el código, rota el id de sesión y guarda los tokens cifrados |
| `GET /bff/auth/session` | Estado de la sesión y token CSRF para la SPA |
| `POST /bff/auth/logout` | Revoca tokens y destruye la sesión (exige `X-CSRF-Token`) |
| `ANY /bff/v1/*` | Proxy con lista blanca (`config/routes.bff.yaml`) y Bearer del usuario |
| `GET /bff/healthz`, `/bff/readyz` | Liveness y readiness (comprueba Redis) |

## Arranque

```bash
cd bff
composer install
cp .env.example .env     # rellenar APP_KEY, OAUTH_*, UPSTREAM_*
php -r 'echo "base64:".base64_encode(random_bytes(32)),"\n";'   # valor para APP_KEY
php -S localhost:8080 -t public
```

Requiere Redis o Valkey (`REDIS_DSN`). El cliente OAuth debe estar registrado en tmwe_json como confidencial, con `OAUTH_REDIRECT_URI` en su lista de redirecciones.

## Calidad

```bash
composer test     # PHPUnit (32 pruebas, sin red ni Redis)
composer stan     # PHPStan nivel 8
composer cs       # PHP-CS-Fixer (PSR-12)
```

## Añadir una ruta

1. Localizar la acción en `tmwe_json/config/routes/*.yml` (`response_on`) y comprobar que acepta Bearer.
2. Declararla en `config/routes.bff.yaml`. Sin entrada, el BFF responde 404.
3. Si el controlador responde 200 con `{"success": false}`, marcar `legacy_envelope: true`.
4. Las descargas y los streams llevan `response: binary` o `stream`.

## Pendiente (no incluido en este esqueleto)

- Límite de peticiones por sesión e IP (`symfony/rate-limiter`).
- Generar `routes.bff.yaml` y el cliente TypeScript desde `docs/api/open_api` de tmwe_json, y validar peticiones con `league/openapi-psr7-validator`.
- Streams SSE: el manifiesto ya admite `response: stream`, falta el location del servidor web sin buffering y su prueba.
- Confirmar con el backend cómo toma los cuerpos JSON (`get_parameter`) y si confía en `X-Forwarded-For` (hoy todos los usuarios llegan con la IP del BFF).
- Dockerfile, configuración de nginx y pipeline de CI.

Decisiones de diseño: ver el artifact «Arquitectura ERP Findair».
