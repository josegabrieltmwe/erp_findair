# ERP Findair · BFF

Backend For Frontend en Slim 4 (PHP 8.3+). Custodia los tokens OAuth2 y hace de proxy entre la SPA Vue y la API de `tmwe_json`. El navegador solo recibe una cookie de sesión opaca.

## Qué hace

| Ruta | Función |
|---|---|
| `GET /bff/auth/login` | Inicia Authorization Code + PKCE hacia el login de tmwe_json (`action=auth`) |
| `GET /bff/auth/callback` | Canjea el código, rota el id de sesión y guarda los tokens cifrados |
| `GET /bff/auth/session` | Estado de la sesión, token CSRF, `user` y `capabilities` (se calculan en el login) para la SPA |
| `POST /bff/auth/logout` | Revoca tokens y destruye la sesión (exige `X-CSRF-Token`) |
| `POST /bff/auth/otp` | Punto de autorización por OTP, **sin usuario**: abre una sesión para quien presenta el OTP de un correo (ver «Sesiones de OTP») |
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

## Sesiones de OTP (sin usuario)

Una aerolínea que responde a una cotización no tiene fila en `contatti`: no se autentica, se **autoriza** a entrar a UN recurso con el
OTP del correo. Ante el API quien se autentica es la aplicación.

1. La SPA llama a `POST /bff/auth/otp {id, otp, type?}` (mismo origen; `type` por defecto `cargo_offer`).
2. `OtpGate` mira el bloqueo, valida la forma, negocia el Bearer de la aplicación (`client_credentials`, `OAuthClient::clientCredentials`)
   y pregunta al API, `api_otp_authorize`. Si no autoriza, revoca ese Bearer y responde `403 otp_not_authorized` (igual para «no existe»,
   «erróneo» y «caducado») **sin crear sesión ni cookie**.
3. Si autoriza, se abre la sesión: Bearer sellado (`TokenVault`) + una concesión `{type, id, otp sellado, scopes}` + CSRF. El navegador solo
   recibe la cookie opaca.
4. En `/bff/v1/*` una sesión de OTP solo llega a las rutas del manifiesto marcadas `otp: <tipo>`; el proxy **toma `id` y `otp` de la
   concesión** e ignora los que mande el navegador. Una sesión de usuario no llega a esas rutas, y una de OTP no llega a ninguna otra
   ni a `/bff/impersonation`.
5. El Bearer no tiene refresh token: `TokenRefresher` negocia otro al caducar.

El envío de la respuesta (`POST /bff/v1/api_carrier_offer`, ruta `otp.cargo_offer.submit`) exige el CSRF de la sesión y el origen de la app, solo admite un
objeto JSON de hasta 32 kB y se le quitan `id`, `otp` y `type`; el API además los lee solo de la query. Límite propio: política `otp_submit`.

Límite de intentos: en el BFF, no en el API (`Rate_Limiter_Service` no actúa sin APCu). `OtpAttemptLimiter` cuenta solo los fallos, por
recurso (`tipo:id`, exista o no) y por IP, en Redis; una autorización correcta limpia el contador del recurso.

| Variable | Defecto | Qué es |
|---|---|---|
| `OTP_SESSION_IDLE_TTL` | `7200` | Inactividad tras la que caduca una sesión de OTP (s) |
| `OTP_MAX_FAILURES_PER_RESOURCE` | `8` | Fallos tolerados por recurso en la ventana |
| `OTP_MAX_FAILURES_PER_IP` | `20` | Fallos tolerados por IP en la ventana |
| `OTP_FAILURE_WINDOW` | `900` | Ventana de los contadores de fallos (s) |
| `OTP_SUBMIT_RATE_PER_MIN` | `10` | Envíos de respuesta por minuto y sesión OTP |
| `OTP_SUBMIT_RATE_PER_IP_MIN` | `30` | Envíos de respuesta por minuto e IP |

Añadir un tipo de recurso: darlo de alta en `OtpGate::TYPES` (y en el API, `Otp_Resource_Authorizer`) y marcar sus rutas con `otp: <tipo>`.

## Pendiente (no incluido en este esqueleto)

- Límite de peticiones por sesión e IP (`symfony/rate-limiter`).
- Generar `routes.bff.yaml` y el cliente TypeScript desde `docs/api/open_api` de tmwe_json, y validar peticiones con `league/openapi-psr7-validator`.
- Confirmar con el backend cómo toma los cuerpos JSON (`get_parameter`) y si confía en `X-Forwarded-For` (hoy todos los usuarios llegan con la IP del BFF).
- Dockerfile, configuración de nginx y pipeline de CI.

Decisiones de diseño: ver el artifact «Arquitectura ERP Findair».

## Rutas de la SPA (`routes.spa.yaml`)

`config/routes.spa.yaml` está **generado**: no se edita a mano. Contiene las rutas de tmwe_json que
usa el código de `../web` para los módulos migrados, con el mismo nombre que ve la SPA
(`/bff/v1/<ruta>` ⇒ `?action=<ruta>`), de modo que los servicios del frontend no cambian.

```bash
bin/regen-spa-manifest.sh        # añade aquí cada módulo o paquete nuevo que se migre
```

- Solo se exponen rutas de los tiers `api` y `web` (aceptan Bearer). Las de tier `ajax`/`html`
  (solo sesión) se listan al regenerar como «NO expuestas»: necesitan un hermano `web`/`api` en el backend.
- Una ruta escrita a mano en `routes.bff.yaml` con el mismo método y ruta **sustituye** a la generada.
- El método se deduce del código (`method: "POST"`). Para constantes de ruta se toman los métodos que usa
  ese fichero; revisar el diff tras regenerar.
- `forward_query: '*'` reenvía toda la query salvo `action`, que nunca puede venir del cliente.

## Streams (SSE), descargas y subidas

- **SSE** (`response: stream`): se abren con cURL (`CurlUpstreamStreamer`) y se emiten con
  `StreamingEmitter` (flush trozo a trozo). El flujo `http://` de PHP/Guzzle retiene los fragmentos
  pequeños, y Apache/PHP acumulan hasta `output_buffering` (4096): ambos romperían los latidos.
  El `timeout` del manifiesto es el silencio tolerado, no la duración. El generador marca como stream
  las rutas cuya descripción en tmwe_json dice «SSE» (salvo las `*token*`).
- Cada SSE abierto ocupa un worker de Apache mientras dure; dimensionar `MaxRequestWorkers` o servir
  `/bff/v1` de streams con otro proceso si hay muchos usuarios.
- **Descargas** (`response: binary`) y respuestas JSON grandes: probadas con 20 MB; cabeceras de descarga
  conservadas y memoria acotada.
- **Subidas** multipart: el cuerpo llega intacto (comprobado con 5 MB); el límite por ruta
  (`limits.body`) devuelve 413.
