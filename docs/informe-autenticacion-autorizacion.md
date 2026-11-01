# Informe: autenticación, autorización y roles en el ERP (SPA + BFF) tras el cambio del API

> **Estado:** vigente (su implementación en la SPA es parcial) · **Última modificación:** 2026-10-25 · **Clasificación:** automática 2026-10-31, pendiente de revisión humana

Fecha: 2026-10-25 · Backend analizado: `/var/www/dev/tmwe_api` (rama `tmwe_api`, `https://tmwe-api.php7`), BD `tmwe_development` (solo lectura) · Frontend: `web/` y `bff/` de este repo.

Alcance y límites: lectura de código y de datos de desarrollo. No se probó nada contra producción ni sandbox. La pantalla nueva se verificó con `vue-tsc`, tests unitarios y el gate de i18n; **no se abrió en el navegador** (requiere una sesión de login real).

## 1. Resumen

1. El API ya no tiene dos motores de permisos: los scopes salen **solo de roles** (`auth_role`), con roles **aditivos** por persona y techo `persona ∩ aplicación`. Los flags `auth_*` quedan solo para **datos** (filas, precios) y para el veto de crear envíos (`auth_19=N`).
2. El ERP sigue razonando con **un único booleano**, `is_admin = (idanagfrc === 1)`: lo calcula el API en `get_my_profile`, lo copia el BFF como `is_tmwe` y la SPA lo usa en todas las rutas de Settings (`requiresAdmin`). Es el antiguo bypass por anagrafica 1, disfrazado de rol. No sabe nada de `root`, `account_admin`, `dispatcher` ni del resto de roles aditivos.
3. La ficha de usuario edita **un solo rol** por persona, pero en desarrollo hay 13 roles distintos y la mayoría de personas tiene varios (p. ej. 10.360 `accounting_viewer` y 9.694 `account_admin` además del rol base). La SPA no los muestra ni los puede gestionar.
4. Varias pantallas de Settings operan sobre el modelo anterior (RBAC interno, permisos por módulo, overrides y restricciones por endpoint). Ese modelo está en retirada en el API pero **todavía está en el código de decisión**, así que hoy no se pueden dar por muertas ni por vivas: hay que decidirlo (§5).
5. Se mejoró la sección **Aplicaciones y claves** (antes «OAuth clients»), que ya existía. Detalle en §6.

## 2. El modelo vigente en el API (verificado)

**Autenticación.** OAuth 2.1: `authorization_code` + PKCE para personas (el BFF es cliente confidencial), `client_credentials` para máquinas, token opaco `Bearer`. Login en la pantalla del propio API (`/auth`), restaurada y con QR (`redirect` informado al generar).

**Autorización** (`docs/02-arquitectura/oauth_puro/09_flags_auth_y_roles.md`, revisiones 3-8):

| Pieza | Estado real |
|---|---|
| Tablas | Núcleo renombrado a `auth_client`, `auth_token`, `auth_role`, `auth_user_role`, `auth_qr_login_token` (con vistas de compatibilidad con el nombre antiguo) |
| Roles de persona | Un **rol base** (`findair_basic`, `partner_staff`, `tmwe_staff_portal`, `tmwe_staff_impersonator`) + **roles aditivos** (`erp_operator`, `accounting_viewer`, `account_admin`, `history_viewer`, `archive_manager`, `contacts_search_all`, `courier_driver`, `dispatcher`, `root`). Los scopes son la unión |
| Roles de aplicación | **Un** `role_id` por client (`auth_client.role_id`). El plan final prevé N:M (`client_roles`); **no está implantado** |
| Techo | Persona a través de una app = scopes(app) ∩ scopes(persona) |
| `root` | Generado desde el catálogo; solo root lo concede o retira. Asignado a los contactos 3 y 12763 |
| Política de asignación | `Role_Assignment_Policy`: TMWE concede cualquier rol salvo `root`; un administrador de cuenta (`profile:write`) solo concede roles de cliente (`findair_basic/full`, `accounting_viewer`, `account_admin`, `courier_driver`). **Solo se aplica en `api_anagrafica_findair_access`** |
| Flags | `auth_18/20/21/22/23/24` siguen siendo datos (`Data_Scope`); `auth_19=N` vetó 81 altas de envío; `auth_10` sigue sin resolverse para 43 clientes |
| Secretos de apps | `client_secret` **en claro** en `auth_client` (77 filas; 7 de 64 caracteres y 70 de 128). El plan prevé hash SHA-256; no está hecho |

Datos de desarrollo de las aplicaciones (`auth_client`): 77 en total (21 internas, 55 externas activas, 1 deshabilitada); **76 de 77 activas sin actividad en 90 días**; 17 sin rol (todas latentes según el propio plan, paso R0); 36 con `integrator_full`; solo 4 con `redirect_uris` y 2 con PKCE obligatorio.

## 3. Cómo lo gestiona hoy el ERP

| Capa | Mecanismo | Problema |
|---|---|---|
| API `get_my_profile` | `is_admin = idanagfrc === 1`; `scopes` solo con 4 scopes de IA; sin roles | No expone roles ni permisos efectivos |
| BFF `UserContextProvider` | `capabilities = ['tmwe','clients']` si el partner es 1, vacío si no | El propio código lo marca «conservador»; deducido, no autorizado |
| SPA router | `requiresAdmin` en 55 rutas del router + `aiScope` en las de IA | Un `account_admin` de cliente o partner no puede ni entrar a gestionar su cuenta; un `root` no se distingue de cualquier TMWE |
| API `api_admin_my_permissions` | Secciones con `tmwe_only`; devuelve 403 con Bearer en dev (ver `peticiones-backend.md` §2) | No sirve como contexto |
| `api_admin_*` | Casi todos `admin_only` (= anagrafica 1) | Ningún permiso `módulo:operación` propio |

## 4. Pantallas de Settings → Administración frente al modelo nuevo

| Pantalla | Endpoint | Situación |
|---|---|---|
| Usuarios (ficha) – **rol API** | `api_anagrafica_findair_access` | Es la vía correcta (aplica `Role_Assignment_Policy`), pero la UI muestra y edita **un** rol; el API ya devuelve `addon_roles` y la SPA los ignora |
| Usuarios – roles internos + overrides | `api_admin_user_roles` | Tablas del RBAC interno (`user_role_assignments`: 0 filas) y `user_permission_overrides` (120 filas `deny`, 20 usuarios). Sin política de asignación |
| Usuarios – restricciones por endpoint | `api_admin_user_endpoint_restrictions` | Tabla vacía (0 filas) |
| Roles internos | `api_admin_internal_roles` | `internal_roles` (271 filas) + `internal_role_permissions`; modelo anterior |
| Permisos por módulo | `api_admin_module_permissions` | Tabla vacía (0 filas); servicios marcados para borrar (R5) |
| Roles OAuth | `api_admin_oauth_roles` | **Vigente**: es el catálogo `auth_role` real. Edita scopes a mano; `root` se genera, no debería editarse |
| Aplicaciones y claves | `api_admin_external_clients` | **Vigente** (mejorada, §6) |
| Alta de cliente (wizard) | contatti + clients + roles | Asigna un único rol; no ofrece los aditivos |
| Explicar acceso / Auditoría | `api_admin_authz_explain`, `api_admin_permission_audit` | Útiles; deben leer el motor nuevo (verificar en R6) |

Matiz honesto: `Authz_Service` y `Permission_Resolver` **siguen referenciando** overrides, restricciones por endpoint y `module_permissions` (líneas 33-34, 510, 701 y 794 de `Authz_Service.php` en este checkout), aunque el documento de plan dice que el RBAC interno ya salió. Hasta que el backend confirme qué capas siguen decidiendo, las pantallas del RBAC interno **no deben retirarse ni ampliarse**: pueden estar teniendo efecto con las 120 filas `deny`.

## 5. Brechas y propuesta de rediseño

### Brechas, por impacto

1. **El «admin» no es un rol.** Una sola condición (`anagrafica 1`) decide qué ve y qué administra cada persona. Con el modelo nuevo debe decidirlo el permiso.
2. **El navegador no conoce los permisos.** Sin un contexto de acceso, la SPA no puede ocultar ni habilitar nada con precisión; el BFF lo deduce.
3. **Roles de persona incompletos en la UI** (un rol frente a N).
4. **Política de asignación en un solo endpoint.** `Role_Assignment_Policy` solo la aplica `api_anagrafica_findair_access`, que es la vía de los roles de `auth_role`. (Corrección posterior: `api_admin_user_roles` y el bulk operan sobre el RBAC interno, no sobre `auth_role`, así que la política no les aplica; lo que faltaba era proteger `root` en `api_admin_oauth_roles`, ya hecho.)
5. **Aplicaciones**: secreto en claro; `allowed_origins` guardado como JSON en una fila (la del BFF) pero leído por el login del API como lista separada por comas (`Authorization_Login_Controller::allowed_origins`), con lo que ese origen no coincide; `allowed_ips` se lee de dos formas distintas (`Authz_Service` JSON, `Oauth_Client::is_ip_allowed` comas); `redirect_uris`, `require_pkce` y `grant_types` no se pueden ver ni gestionar por API; rol único por aplicación.
6. **Higiene**: 76/77 aplicaciones latentes, 17 sin rol, 43 clientes con `auth_10` sin decidir.

### Modelo objetivo en la aplicación

1. **Una fuente de acceso**: un endpoint `me/access` (cualquier usuario autenticado) con `roles`, `permissions` efectivos (`módulo:operación`, ya con el techo persona ∩ app) y los flags de datos relevantes (`auth_19`, precios, alcance de filas). El BFF lo pasa tal cual en `capabilities`/`user`.
2. **En la SPA**: `useAccess().can('module:operation')` sustituye a `isAdmin` en router, menús y tarjetas de Settings. `requiresAdmin` pasa a `meta.permission`. Es solo UX; la API sigue autorizando.
3. **Pantallas por tarea, no por tabla**:
   - *Personas*: rol base + roles aditivos, con la política aplicada (qué roles puede conceder quien mira) y cuenta de personas por rol. Un `account_admin` ve solo su cuenta.
   - *Roles*: catálogo de solo lectura para roles de sistema (incluido `root`); edición solo para roles propios.
   - *Aplicaciones y claves*: ya hecha; añadir `redirect_uris`/PKCE/`grant_types` cuando el API los exponga.
   - *Explicar acceso* y *Auditoría*: se mantienen.
   - *RBAC interno, permisos por módulo, overrides y restricciones*: marcar «heredado», solo lectura, y retirar cuando el backend cierre R5/R6.
4. **Orden**: (a) contexto de acceso en el API; (b) `useAccess` y sustitución de `requiresAdmin` ruta a ruta, empezando por Settings; (c) multi-rol en la ficha de usuario y en el wizard; (d) retirada de pantallas heredadas.

### Decisiones del dueño que condicionan esto

1. ¿Se mantiene `anagrafica 1` como atajo en el API (`tmwe_only`) o todo pasa a permisos? Hoy coexisten.
2. ¿Qué capas del RBAC interno siguen decidiendo en producción? Determina si se retiran o se congelan las pantallas.
3. Formato canónico de `allowed_origins`/`allowed_ips` (JSON o lista) para poder editarlos desde la SPA.
4. Los 43 clientes con `auth_10` (R7) y las 17 aplicaciones sin rol (R0).

## 6. Lo hecho en esta sesión (sección «Aplicaciones y claves»)

La sección ya existía como «OAuth clients» (`settings-oauth-clients`, dentro de Administración → Identidad). Se **evolucionó** en vez de duplicarla:

- Búsqueda por id, nombre, empresa, email y rol; filtro por tipo; interruptor «sin actividad en más de 90 días»; resumen «mostrando N de M · K latentes».
- Columna **Último uso** con marca «Latente» (ayuda a depurar las 76 aplicaciones sin uso).
- Diálogo **Detalles**: copiar `client_id`, editar nombre, empresa, email y tier (se añadió `enterprise`, que existe en BD y faltaba); ver origen/IPs/permisos efectivos y fecha de alta en solo lectura. La clave secreta indica que no se puede consultar.
- Provisión y rotación: ya mostraban `client_id`/`client_secret` una sola vez; sin cambios.
- Título y descripción renombrados en los 5 idiomas (es, en, it, de, nl) y 17 claves nuevas por idioma.
- Se decidió **no** editar orígenes, IPs ni redirect URIs desde la SPA mientras el formato sea ambiguo (§5, brecha 5).
- Código: `packages/platform/oauth_clients/` (`OAuthClientsPage.vue`, `services/clientActivity.ts`), tests en `apps/operations/src/modules/settings/oauthClientsActivity.spec.ts` (8 pruebas).

Verificación: `vue-tsc --noEmit` sin errores; `vitest` de Settings, 73 de 73; `check:i18n` sin claves faltantes por mis cambios (el gate de «sin traducir» ya estaba por encima de su baseline antes: 399 frente a 368; con mis cambios queda en 398). Sin comprobar en navegador.

## 7. Peticiones nuevas al backend

Recogidas en `docs/peticiones-backend.md` §9.

## 8. Avance del plan

**Fase 1 · Contexto de acceso — hecha en código, sin desplegar ni commit (2026-10-25).** Host del API confirmado: `https://tmwe-api.php7`.

- **API** (`/var/www/dev/tmwe_api`): `get_my_profile` devuelve ahora `access` con `roles` (el base primero, luego los aditivos, con marca `addon`), `scopes` efectivos del token, `is_root` y `grant`. Servicio nuevo `service/security/Access_Context_Service.php`; calcula con `Scope_Service::get_effective_scopes` y los scopes concedidos al token, los mismos que usa `Authz_Service`. Aditivo: el resto de la respuesta no cambia. Test: `tests/Unit/Service/Security/AccessContextServiceTest.php` (5).
- **BFF**: `UserContextProvider` copia `user.access` (`roles`, `scopes`, `is_root`) saneado, por lo que `/bff/auth/session` ya lo entrega a la SPA. Test nuevo en `tests/UnitTest.php`; suite completa 145/145.
- **SPA**: `packages/platform/composables/useAccess.ts` (`can`, `hasRole`, `isRoot`; falla cerrado). `RawProfile` tipado con `access`. Tests: `apps/operations/src/modules/settings/useAccess.spec.ts` (7); `vue-tsc` sin errores.
- **Comprobado contra la BD de desarrollo** (cliente del BFF 527): un `root` recibe 9 roles y 57 scopes; una persona solo con `findair_basic`, 1 rol y 14 scopes; con `client_credentials`, 57; sin token, 0 scopes.
- **Sin comprobar**: la llamada HTTP real a través del BFF con sesión (requiere login) y producción.

Siguiente: Fase 2 (sustituir `requiresAdmin` por permisos). Antes hay que decidir qué scope protege cada pantalla de Settings: los scopes vigentes son `config:read`, `profile:write`, `ai:admin`, etc., no `módulo:operación`.

**Fase 2 · Settings por permiso — hecha en código, sin commit (2026-10-25).**

Mapeo calculado con el propio API (política de cada controller + `Module_Permission_Service` + scopes de los roles de `tmwe_development`), sobre los 54 destinos con `requiresAdmin`:

| Política en el API | Rutas | Puerta en la SPA |
|---|---|---|
| `admin_only` (= anagrafica 1 **y** app interna; ningún scope la sustituye) | 30 endpoints: usuarios, roles, aplicaciones, auditoría, MFA, claves de Google, credenciales de carriers, terminales, B2B… | **TMWE**, sin cambio |
| `public_oauth` (cualquier autenticado) | maestros: países, divisas, textos, sectores, estados de tracking… | **TMWE** (el API no distingue; la restricción es de producto) |
| Módulo `config` / `master_data` / `cargo_config` (scope `config:read`) | emisor-banco, cargo carriers/handlers/charges, modelos de documento, avisos del sitio | **`config:read`** |
| Módulo `fornitori_servizi` (scope `suppliers:read`) | servicios de carrier, tipos de palet, MPL, bloqueos, códigos de tracking | **`suppliers:read`** |
| Módulo con scope que también tienen clientes (`shipment:read`, `contacts:read`, `crm:read`, `invoices:read`, `payments:read`) | tipos de mercancía, márgenes de beneficio, tipos CRM, causales de factura, configuración de pagos | **TMWE** (abrirlas por scope las dejaría a clientes con `findair_basic` o `accounting_viewer`) |
| Módulo `driver` / `pickups` | zonas de conductor, rutas de recogida | **TMWE**: el conductor ve solo lo suyo y las zonas son de despacho (`driver:read_all`) |
| Sin endpoint detectado | planificador, causales de IVA, clave de WebCargo | **TMWE** (sin evidencia, se deja cerrado) |

Resultado: **11 pantallas** se abren por scope (5 con `suppliers:read`, 6 con `config:read`); el resto sigue exigiendo TMWE.

- Una sola tabla fuente: `apps/operations/src/modules/settings/settingsAccess.ts`. La consultan el guard del router (`router.beforeEach`) y las tarjetas del hub (`SettingsPage.vue`). TMWE conserva el acceso total; quien no es TMWE solo entra a las 11 rutas mapeadas y solo con todos sus scopes; el hub se abre si hay al menos una tarjeta abrible. Falla cerrado si el perfil no se conoce o el backend no trae `access`.
- Tests: `settingsAccess.spec.ts` (9). Incluye una guarda que impide mapear un scope que no sea solo de personal (`STAFF_ONLY_SCOPES`). SPA completa: 456/456; `vue-tsc` limpio.

**Qué cambia en la práctica, y qué no.** Hoy el efecto visible es pequeño: `config:read` y `suppliers:read` solo los tienen `tmwe_staff_portal`, `tmwe_staff_impersonator`, `root` y las apps internas, y esas personas ya son TMWE. La Fase 2 deja la puerta decidida por scope y comprobable por test, lista para abrirse a un rol nuevo (p. ej. un «gestor de maestros» de partner) con solo concederle el scope. No resuelve el caso que motivó el plan, el `account_admin` de un cliente: sus herramientas de cuenta (`api_anagrafica_findair_access`, `api_anagrafica_contacts`) viven en Anagrafica y no en Settings, y `api_admin_users` es `admin_only` en el API. Eso requiere una pantalla «Mi cuenta» en Anagrafica (Fase 3), no abrir Settings.

**Pendiente de esta fase:** el enlace de Settings del menú lateral sigue ligado a `is_admin` (`navCatalog.adminOnly`); no se cambió porque hoy nadie nuevo lo necesitaría. Sin comprobar en navegador.

**Fase 3 · Varios roles por persona y «Mi cuenta» — hecha en código, sin commit (2026-10-25).**

- **API:** `api_anagrafica_findair_access` (GET y POST) devuelve además `addon_role_details` (id, nombre, nombre visible de los aditivos que tiene) y `grantable_roles`: los roles que **quien llama** puede conceder a ese contacto, calculados con la misma `Role_Assignment_Policy` que valida el POST (nueva `grantable()`; un rol base con scopes reservados a TMWE se excluye para contactos de otra cuenta). `addon_roles` se conserva. `api_admin_oauth_roles` rechaza con 409 `ROOT_ROLE_MANAGED_BY_CATALOG` editar los scopes de `root`, que se generan del catálogo.
- **SPA:** componente compartido `ContactApiRolesEditor` (rol base, aditivos con chips, añadir/retirar, confirmación al retirar; cada cambio se aplica al momento). Ofrece solo lo que el API marca como concedible, así que la política vive en el servidor. Se usa en el diálogo de permisos del contacto de Anagrafica (antes solo lectura con un enlace a Settings) y en la ficha de usuario de Settings (aditivos, bajo el rol base).
- **«Mi cuenta» no es una pantalla nueva:** el administrador de cuenta (`profile:write`) ya llega a Anagrafica → Contactos → Permisos de su propia cuenta. Ahora ahí puede gestionar roles de cliente (`findair_basic/full`, `accounting_viewer`, `account_admin`, `courier_driver`); TMWE ve casi todos; nadie ve `root` salvo un root. Un contacto con un rol que quien mira no puede conceder lo ve, sin poder retirarlo.
- **Pruebas:** API: `RoleAssignmentPolicyTest` unitario (9) y de acceso a datos por HTTP real (3, incluido el contrato nuevo). SPA: `apiRoleOptions.spec.ts` (4); suite completa 460/460; `vue-tsc` limpio; sin claves de i18n faltantes (5 idiomas).
- **Sin comprobar:** el flujo en el navegador y el caso de un `account_admin` real de cliente por HTTP (se cubre con la política unitaria; el actor de pruebas del API es personal TMWE). Fallos previos del API ajenos a esto: `AuthzServiceTest`, `OAuthClientRbacTest`, `SessionRolesAdditiveTest`, `ScopeConsistencyTest`, `AppRolesParityTest` (restos del motor anterior).
- **No hecho:** el wizard de alta de cliente sigue asignando un único rol; los flags `auth_*` del mismo diálogo siguen editándose a mano (el plan prevé que el rol sea la fuente de la capacidad y el flag solo de datos).
