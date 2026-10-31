# Plan de migración ERP Findair (BFF + SPA)

> **Estado:** vigente, parcialmente desfasado (cifras de 2026-10-18/19; el §3 «Pendiente en backend» está en parte resuelto, ver `contrato-con-api.md`) · **Última modificación:** 2026-10-23 · **Clasificación:** automática 2026-10-31, pendiente de revisión humana

Estado a 2026-10-18. Cifras de la última pasada de solo lectura (`bff/bin/probe-routes.php`,
225 rutas GET, usuario `jose`).

## 1. Dónde estamos

| Pieza | Estado |
|---|---|
| BFF Slim 4 (login PKCE, sesión en Valkey, proxy con lista blanca, CSRF, SSE, descargas, subidas) | Hecho. 119 pruebas, PHPStan nivel 8 |
| SPA `web/` sobre `/bff/v1` (111 pantallas navegan; typecheck y 243 pruebas OK) | Hecho |
| Manifiesto generado desde el código de la SPA | 741 rutas (2026-10-19; las 806 anteriores incluían rutas ya movidas); se regenera con `bin/regen-spa-manifest.sh` |
| Cliente OAuth 527: `internal`, `redirect_uris`, PKCE obligatorio, scopes de personal | Hecho en el backend (`6ef5a87be`, `8a15fe416`) |
| Autorización Bearer por política en los controllers `web` | Hecho en el backend (`a27ed1cf0`) |

Resultado de la pasada del 2026-10-19 (206 rutas GET sondeadas, usuario `jose`, tras los cambios del
backend del 2026-10-18): 72 responden 200, 93 piden parámetros (400/422), 38 dan 403, 2 dan 404
(`api_proforma_file`, `shipment_timing`). Ya no hay 405 ni 502.
Los 38 403 son todos de permiso de módulo: `master_data` (22), `anagrafiche*` (8), `cargo_config` (5),
`admin` (`api_b2b_config`), `shipment_ops` (`api_shipment_subcontracting`) y `api_partner_elevenlabs_agents`
(`not_a_partner`, esperado para personal TMWE). Se resuelven con el rol `app_internal_erp` y el rol de
usuario; no son fallos de código.

## 2. Modelo de permisos acordado (roles por aplicación)

El permiso efectivo de un token es **techo del rol del cliente ∩ rol del usuario**
(`scope_source=roles`). Por eso:

- **Rol de aplicación interna** (`app_internal_erp`): techo de la SPA propia, con todos los scopes de
  negocio. Solo asignable a clientes `internal`. Lo que cada persona puede hacer lo decide su **rol de
  usuario** (`tmwe_staff_portal`, `partner_staff`…): ahí se gestionan los permisos.
- **Roles de aplicación externa: un rol por perfil**, no uno solo (ya existen `findair_basic/full`,
  `integrator_*`, `b2b_partner_portal*`). Falta una plantilla base de solo lectura para clientes nuevos.
- Los **puentes estrechos** (p. ej. el del Copilot de ElevenLabs) mantienen su rol propio, no el interno.
- El **bypass de administrador** lo da `client_type=internal` (no el rol): sin él, los `admin_only` dan 403.
- Un rol no crea scopes: los módulos sin scope mapeado necesitan scopes nuevos o RBAC de módulo.
- Hoy el cliente 527 usa el rol `erp_findair_dev`, creado a mano en la BD local (no está en
  migraciones): hay que sustituirlo por `app_internal_erp` definido por migración.

## 3. Pendiente en el backend (ver `prompt-agente-tmwe-json.md`)

1. Grant `refresh_token` roto (busca con el id numérico del cliente): las sesiones no pasan de 24 h.
2. Scopes o RBAC para los módulos que hoy dan 403 a todo el que no sea admin TMWE: `driver` (5 rutas),
   `fornitori_servizi` (≈8), `docpack` (3), `pagamenti_config` (2), `proforma` (2), `docsstory`,
   `shipment_ops`, `anagrafiche_banks`, `b2b_config` y `invoices:write` (`api_invoice_recalculate`).
3. Controllers que responden **401** a un token válido cuando falta permiso (`api_bancali_*`,
   `api_supplier_*`): deben responder 403.
4. Rutas `ajax` solo-sesión sin hermano con Bearer: quedan 6 (`ajax_cargo_packages`, `ajax_get_label_courier_shipment`,
   `ajax_send_ldv_to_mittente`, `ajax_shipment_list`, `ajax_tmwe_label`, `spedy_chat`), más 2 `html` y 6 sin ruta
   (`admin_config`, `api_doc`, `cargo`, `crm_pratica`, `invoicing`, `shipment`: enlaces a páginas heredadas).
   El backend movió a `api/` más de 100 controllers el 2026-10-18.
5. Endpoint `get_ops_bootstrap` (usuario y capacidades).
6. `methods:` en `config/routes/*.yml`.
7. `api_cargo_margin_explain` (502) y las rutas con 404 (`rubrica_set_preferred`, `shipment_timing`).
8. `X-Forwarded-For`: decidir si se respeta y desde qué proxies.

## 4. Fases

### A. Decisiones y datos (esta semana)
- [x] Cliente 527 `internal`, redirect registrado, PKCE obligatorio.
- [ ] Aprobar el modelo de roles de la sección 2 (aprobación del responsable de seguridad del backend).
- [ ] Decidir el login: página del backend o página propia en Vuetify.
- [ ] Confirmar despliegue en el mismo origen (SPA y BFF).

### B. Backend (agente de tmwe_json)
Orden: 1 (refresh) → 2 (roles y scopes) → 3 (401→403) → 4 (ajax) → 5 (contexto) → 6, 7, 8.
Cada entrega con migración, copia `bak_*`, rollback y pruebas.

### C. BFF y SPA (en paralelo, sin depender del backend)
- [x] SSE en tiempo real, descargas y subidas verificadas.
- [x] Una ruta que responde 401 con token válido ya no cierra la sesión (403 `upstream_unauthorized`).
- [x] `exclude` en el manifiesto y herramientas `probe-routes.php` / `explain-403.php`.
- [ ] Declarar `api_home_kpis_stream` como SSE (la SPA aún no lo referencia).
- [ ] Recorrido de pantallas con parámetros (detalle de factura, cliente, cargo…), solo navegación.
- [~] Límite de peticiones por sesión e IP: hecho solo para el copilot (`throttle:` en el manifiesto, contadores atómicos en
      Valkey). Falta el límite general. Proxies de confianza: `TRUSTED_PROXIES` (IP/CIDR); solo si la conexión viene de uno se lee `X-Forwarded-For` (vacío = `REMOTE_ADDR`). Los huecos de concurrencia llevan token y caducan individualmente.
- [ ] Dockerfile, nginx (con SSE sin búfer) y CI: PHPUnit, PHPStan, CS, build y typecheck de `web/`,
      regeneración del manifiesto (falla si cambia sin commit) y recorrido con Playwright.

### D. Antes de producción
- Cliente con rol `app_internal_erp` y sin el rol de desarrollo; PKCE y redirect ya obligatorios.
- Secretos fuera de `.env` (gestor de secretos); rotación del `client_secret` y de `APP_KEY`.
- Capacidad de SSE: cada conexión abierta ocupa un worker de Apache (o servir `/bff/v1` de streams aparte).
- Revisar `UPSTREAM_DENY_ACTIONS` (en local bloquea bookings y cancelaciones; en producción, vacío).
- Cambiar la contraseña de `jose`, usada en las pruebas.

## 5. Cómo verificar el avance

```bash
cd bff
bin/regen-spa-manifest.sh                      # «NO expuestas» debe quedar sin tier ajax
php bin/probe-routes.php <cookie __Host-sid>   # distribución de códigos (solo lectura)
php bin/explain-403.php <raíz tmwe_json>       # módulo/permiso que exige cada 403
composer check                                 # PHPUnit + PHPStan + CS
```

Seguridad de las pruebas: nada de bookings, cancelaciones, etiquetas ni emails contra transportistas
reales; el BFF local lo bloquea con `UPSTREAM_DENY_ACTIONS`.

## 6. Copilot de IA (texto), entrega BFF + SPA (2026-10-23)

Backend: rama `feat/copilot-agente-ia` de tmwe_json (ver `peticiones-backend.md` §8). Este repo:

- **Rutas.** `copilot.write_proposal` = `POST /bff/v1/api_copilot_write_proposal` (a mano en `routes.bff.yaml`): CSRF, sin
  `legacy_envelope`, `limits {body: 64k, timeout: 30}`, y `body_enum: {op: [confirmar]}` (el BFF rechaza con 400
  `invalid_body` cualquier otro `op`, incluido `proponer`). `copilot.chat` pasa a llevar `throttle: copilot_chat`.
  `api_copilot_memory_context` no se expone (voz). `routes.spa.yaml` no se toca.
- **Límites (`src/Throttle`).** `Throttler` + `RedisCounterStore` (Lua: INCR + EXPIRE, acquire/release sin pasar de cero).
  `copilot_chat`: 20/min por usuario, 60/min por IP, 1 simultáneo por usuario, 30 simultáneos globales; `copilot_confirm`:
  30/min por usuario, 60/min por IP, 1 simultáneo. Variables: `COPILOT_CHAT_RATE_PER_MIN`, `COPILOT_CHAT_RATE_PER_IP_MIN`,
  `COPILOT_CHAT_MAX_PER_USER`, `COPILOT_CHAT_MAX_GLOBAL`, `COPILOT_CONFIRM_RATE_PER_MIN`, `COPILOT_CONFIRM_RATE_PER_IP_MIN`,
  `COPILOT_CONFIRM_MAX_PER_USER` (0 = sin límite). Respuestas: 429 `rate_limited` / `concurrency_limited` (con `Retry-After`),
  503 `capacity_exceeded`; si Valkey falla, 503 `throttle_unavailable` (fail-closed). El hueco de concurrencia caduca
  (timeout de la ruta + 30 s) por si muere un worker. Cada turno de chat ocupa un worker de Apache hasta 120 s: con el
  tope global de 30, `MaxRequestWorkers` debe dejar margen sobre 30 + SSE + tráfico normal.
- **B1/C11.** Con `X-Impersonate-Partner-Id`, `ProxyController` y `UserContextProvider` exigen `X-Effective-Partner-Id`
  idéntico en las respuestas < 400; si falta o difiere: 502 `effective_partner_mismatch` (Problem Details), log `error`, la
  respuesta del backend se descarta. Fail-closed: depende de la petición 5 de `peticiones-backend.md` §8.
- **Bug corregido de paso.** `readBody()` hacía una sola lectura de `php://input` (~8 KiB): los cuerpos mayores se
  truncaban en silencio y el límite 413 nunca saltaba (detectado probando el endpoint real: 20 KB válidos llegaban cortados).
  Ahora lee hasta EOF o hasta superar el máximo. Prueba de regresión con un stream de lecturas cortas.
- **Redactor.** Añadidos `api_key`, `apikey`, `api-key`, `x-api-key`, `x-auth-token`, `api_secret`, `secret`, `private_key`
  y `payload_override`.
- **SPA** (`web/apps/operations/src/modules/copilot`): `ProposalCard` + `useProposalCard` (cuenta atrás de 300 s relativa a la
  recepción, segundo gesto en cancelaciones, payload legible completo, costes si vienen); `services/proposal.ts` (validación
  estricta del descriptor, `payload_override` = el payload recibido, congelado y sin reformatear; solo `executed:true` +
  `readback.status=verified` es «hecho»; mapa de errores 409/403/429/5xx); `services/actions.ts` (lista cerrada de 7 nombres de
  ruta del router, `router.push` por nombre, `path` obsoleto ignorado, sin `window.location`); `context.locale` y
  `context.current_route`; la respuesta se pinta con `v-text` (texto plano).
- **Verificación.** `composer test` (119), `composer stan`, `composer cs`; `vitest run` (392), `vue-tsc --noEmit`, `check:i18n`,
  `check:raw-text`; pruebas HTTP reales contra el vhost local con sesión de pruebas (tokens falsos): 401, 403, 405, 400, 413 y 429. No se ejecutó ninguna escritura real.
- **Pendiente.** Variable `ELEVENLABS_COPILOT_WRITE_PROPOSAL_SECRET` y migración de partners (backend); sesión de usuario real
  para probar `copilot_chat` y el 409 `payload_mismatch` contra el backend; `X-Forwarded-For` con proxies de confianza;
  propagar `error_code` en 429; Playwright de la pantalla `/copilot`.
- **Merge anterior (`feat/ai-credentials-modo-propio`).** `/settings/ai-credentials` en modo propio: rutas
  `ai_admin.my_credentials.{get,post,put,delete}` (`/api_admin_ai_my_credentials`; la API nunca devuelve la clave) y acceso por
  scope `ai:admin` (el servidor fija el partner).

