# Plan de migración ERP Findair (BFF + SPA)

Estado a 2026-10-18. Cifras de la última pasada de solo lectura (`bff/bin/probe-routes.php`,
225 rutas GET, usuario `jose`).

## 1. Dónde estamos

| Pieza | Estado |
|---|---|
| BFF Slim 4 (login PKCE, sesión en Valkey, proxy con lista blanca, CSRF, SSE, descargas, subidas) | Hecho. 45 pruebas, PHPStan nivel 8 |
| SPA `web/` sobre `/bff/v1` (111 pantallas navegan; typecheck y 243 pruebas OK) | Hecho |
| Manifiesto generado desde el código de la SPA | 806 rutas; se regenera con `bin/regen-spa-manifest.sh` |
| Cliente OAuth 527: `internal`, `redirect_uris`, PKCE obligatorio, scopes de personal | Hecho en el backend (`6ef5a87be`, `8a15fe416`) |
| Autorización Bearer por política en los controllers `web` | Hecho en el backend (`a27ed1cf0`) |

Resultado de la pasada: 97 rutas responden 200, 76 piden parámetros (400), 26 dan 403, 21 daban 405
(ya excluidas del manifiesto), 2 dan 404, 1 da 502.

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
- Hoy el cliente 527 usa el rol `erp_findair_dev`, creado a mano en `tmwe_db_dev` (no está en
  migraciones): hay que sustituirlo por `app_internal_erp` definido por migración.

## 3. Pendiente en el backend (ver `prompt-agente-tmwe-json.md`)

1. Grant `refresh_token` roto (busca con el id numérico del cliente): las sesiones no pasan de 24 h.
2. Scopes o RBAC para los módulos que hoy dan 403 a todo el que no sea admin TMWE: `driver` (5 rutas),
   `fornitori_servizi` (≈8), `docpack` (3), `pagamenti_config` (2), `proforma` (2), `docsstory`,
   `shipment_ops`, `anagrafiche_banks`, `b2b_config` y `invoices:write` (`api_invoice_recalculate`).
3. Controllers que responden **401** a un token válido cuando falta permiso (`api_bancali_*`,
   `api_supplier_*`): deben responder 403.
4. 24 rutas `ajax` solo-sesión sin hermano con Bearer.
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
- [ ] Límite de peticiones por sesión e IP.
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
