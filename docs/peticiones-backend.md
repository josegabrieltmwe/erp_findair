# Peticiones al backend (tmwe_json)

> **Estado 2026-10-18.** Este documento es el detalle técnico y su historia. La lista vigente y ordenada
> está en `prompt-agente-tmwe-json.md`; el plan, en `plan-migracion.md`. Ya resuelto en el backend:
> `redirect_uris` + PKCE (§4), cliente 527 `internal` y scopes de personal ampliados (§3). Siguen abiertos:
> §0 (refresh), §1 (rutas `ajax`), §2 (contexto) y los módulos sin scope.

Lo que el BFF y la SPA nuevos necesitan de `tmwe_json` y hoy no existe o no es accesible con
Bearer. Cada punto indica qué se observó, el impacto y la propuesta mínima.

## 0. Bug: el grant `refresh_token` nunca encuentra el token (bloqueante a las 24 h)

`Refresh_Token_Controller::get_refresh_token()` busca el token con
`get_valid_refresh_by_token_and_client_id($param, $this->client['id'])`, es decir, con el **id numérico**
de `oauth_client` (p. ej. 527). Pero `oauth_token.client_id` guarda el **`client_id` hexadecimal**
(`create_access_granted_token($client['client_id'], …)` en `Authorization_Controller`). Resultado:
`POST ?action=token` con `grant_type=refresh_token` responde siempre `401` con cuerpo vacío.

Comprobado en `tmwe_development` con el cliente 527: la condición del controlador (`client_id = 527`)
devuelve 0 refresh tokens válidos; con el hexadecimal, 22.

Arreglo propuesto: buscar con `$this->client['client_id']` (y revisar que `create_access_granted_token`
reciba el mismo valor), más una prueba de integración del flujo completo
authorization_code → refresh → uso del nuevo access token → reutilización del refresh anterior
rechazada (la detección de reutilización también compara `(int) client_id` con el id numérico y hoy
nunca se dispara).

Efecto actual en el BFF: al caducar el access token (24 h) el refresco falla, el BFF cierra la sesión
y la SPA vuelve al login. No hay pérdida de datos, pero la sesión no puede durar más de 24 h.

## 1. Rutas de tier `ajax` sin equivalente con Bearer (23)

Los controladores de `controller/ajax/` solo aceptan sesión. El BFF no puede llamarlos (su cliente
no tiene cookie de sesión de tmwe_json), así que no se exponen y las pantallas que las usan se
quedan sin esos datos.

Propuesta: un hermano de tier `web` (híbrido, como `Web_*_Controller`) por ruta, con el mismo
`response_on` o un alias, y los mismos scopes que su equivalente.

`ajax_cancel_shipment` `ajax_cargo_addresses` `ajax_cargo_charge_details` `ajax_cargo_packages`
`ajax_generate_proforma_file` `ajax_get_combined_label_pdf` `ajax_get_label_courier_shipment`
`ajax_partner_currency` `ajax_remote_zone_check` `ajax_route_stats` `ajax_send_ldv_to_mittente`
`ajax_shipment_list` `ajax_tmwe_label` `ajax_tmwe_label_bundle` `api_form_field_help`
`set_archiviata` `set_archiviata_cargo` `set_controllata` `set_controllata_cargo`
`set_fornitori_service` `set_private` `spedy_ajax_lista_fornitori_box` `spedy_ajax_lista_servizi`

Impacto visible: en el detalle de cargo, bultos y direcciones; en listados, archivar y marcar
como controlada; etiquetas LDV y combinadas.

## 2. Contexto del usuario (capacidades) por API

`Operations_Page_Controller` inyecta en la página `isTmwe`, `partnerId`, `capabilities`
(`tmwe`, `clients`, `my_org`) e `invoicing_capabilities`, calculados con permisos de sesión
(`authx_18`, `Security_Service::has_permissions`). Por API no existe nada equivalente:
`api_admin_my_permissions` responde 403 con Bearer y solo devuelve secciones de administración.

Hoy el BFF las **deduce** de `get_my_profile` (`idanagfrc == 1` ⇒ `tmwe`, `clients`); para el
resto de usuarios devuelve una lista vacía.

Propuesta: `GET ?action=get_ops_bootstrap` (tier `api`/`web`, cualquier usuario autenticado):

```json
{
  "user": {"username": "jose", "name": "Jose", "email": "…", "idanagfrc": 1, "is_admin": true},
  "language": "es",
  "capabilities": ["tmwe", "clients"],
  "invoicing_capabilities": {"audience": "operator", "capabilities": ["…"]}
}
```

Al publicarlo basta `UPSTREAM_CONTEXT_ACTION=get_ops_bootstrap` en `bff/.env`: el BFF lo llama
una vez en el login y lo devuelve en `/bff/auth/session`.

## 3. Permisos con Bearer vs. sesión

Con token OAuth el acceso lo deciden los scopes (rol del cliente ∩ rol del usuario), no los
permisos `authx_*` de sesión. Usuarios que en la app clásica ven un módulo reciben 403 en el BFF
si su rol no tiene el scope. Caso real: `tmwe_staff_portal` no traía `config:read` ni
`contacts:read` (selectores de divisas y de clientes); se añadieron en `tmwe_development`
(copia previa en `bak_20261017_oauth_roles_erp_findair`).

Pendiente: revisar qué scopes necesita cada rol de personal para igualar la app clásica y
registrarlo como migración, no como cambio manual.

## 4. Seguridad del flujo OAuth

- **`redirect_uri`**: `handle_login_success()` redirige a la `redirect_uri` recibida sin
  contrastarla con una lista registrada por cliente (la tabla `oauth_client` no tiene ese campo).
  Un tercero con un `client_id` válido podría recibir el `code` de un usuario. Propuesta: columna
  `redirect_uris` y comparación exacta en `action=auth` y en el canje.
- **PKCE**: el canje lo acepta (`code_verifier`); conviene exigirlo para clientes `external` y
  rechazar `plain`.
- **`X-Forwarded-For`**: el BFF lo envía con la IP del usuario (la de `REMOTE_ADDR`, o la real si la conexión llega de un proxy de `TRUSTED_PROXIES`; definirlo en cada entorno detrás de balanceador). Confirmar si el backend lo respeta
  (límites, `allowed_ips`, auditoría) y desde qué proxies; si no, todas las peticiones llegan con
  la IP del BFF.
- **Rol del cliente**: el cliente de desarrollo usa un rol con todos los scopes mapeados
  (`erp_findair_dev`). Producción necesita un rol propio con solo los que usa la SPA.

## 5. Varios

- Rutas con constantes de método no deducibles del código (p. ej. `web_presence_heartbeat`):
  documentar el método en `config/routes/*.yml` (`methods:`) permitiría generar el manifiesto del
  BFF sin heurísticas.
- Enlaces a páginas heredadas que la SPA aún abre en el backend viejo: `crm_pratica`,
  `admin_config`, `api_doc`, `get-tracking-list`.

## 6. Suplantación de partner (personal TMWE) con `app_internal_erp`

El BFF expone `/bff/impersonation` y envía `X-Impersonate-Partner-Id` (backend: `Security_Service::apply_oauth_impersonation`).
Con `scope_source=roles` y `authorization_code`, el scope efectivo es rol del cliente ∩ rol del usuario:
`partner:impersonate` debe estar en **ambos**. `app_internal_erp` no lo lleva (a propósito:
`AppRolesParityTest`). Con la cabecera presente y sin el scope, el backend rechaza la petición entera.
Verificado en local (2026-10-19): `jose` obtiene 403 `impersonation_not_allowed` al elegir partner.

Peticiones (migración con copia `bak_*` y rollback):

1. **Rol de cliente** `app_internal_erp_staff` en `config/rbac_seed.yml`: los scopes de `app_internal_erp` +
   `partner:impersonate`. Añadirlo a `Scope_Service::INTERNAL_ONLY_ROLES` y ampliar `AppRolesParityTest`
   (mismos scopes que `app_internal_erp` salvo `partner:impersonate`; solo internal). El cliente 527 de la
   SPA pasa a este rol (un cliente tiene un único rol).
2. **Rol de usuario** para todo el personal TMWE (anagrafica 1): añadir `partner:impersonate` a
   `tmwe_staff_portal` (id 14) o, si ese rol no agrupa a todos, crear `tmwe_staff` y asignarlo en
   `contatti_oauth_role` a los usuarios con `id_anagrafica = 1`. Comprobar antes qué usuarios TMWE
   tienen hoy `tmwe_staff_portal`.
3. El gate real no cambia: anagrafica real == 1 + scope + partner ERP válido + auditoría. Un usuario
   que no es de TMWE no suplanta aunque tenga el scope.
4. Cuando falla la suplantación, devolver 403 `IMPERSONATION_DENIED` en vez de un 401 genérico; hoy el
   BFF lo deduce sondeando el token sin la cabecera.

## 7. Consolidación operativa: candidatos para adjuntar

`Consolidation_Service::list_attachable` filtra por `id_cliente = uid` (anagrafica de quien llama). Para el
personal TMWE (anagrafica 1) solo ofrece expediciones del propio TMWE, aunque `attach_existing` sí le deja
adjuntar las de cualquier cliente (acceso por `Shipment_Access_Service`). Petición: que los candidatos se
resuelvan por el **cliente del cargo** (o por el conjunto accesible para el personal), no por el llamante.
Hoy la SPA lo avisa en el panel y la alternativa es suplantar al partner.

## 8. Copilot de IA (texto): confirmación de escrituras y lo que queda en el backend

Contrato vigente: rama `feat/copilot-agente-ia` de tmwe_json (`copilot_chat`, `api_copilot_write_proposal`).
El BFF expone `POST /bff/v1/copilot_chat` y `POST /bff/v1/api_copilot_write_proposal` (esta última **solo con
`op=confirmar`**: `body_enum` en `routes.bff.yaml`). No se expone `api_copilot_memory_context` (es del flujo de voz).

Peticiones (ruta, síntoma, cambio esperado):

1. **Entorno: `ELEVENLABS_COPILOT_WRITE_PROPOSAL_SECRET`** (`elevenlabs.copilot_write_proposal_secret`).
   Sin él `api_copilot_write_proposal` responde 503 `proposal_secret_not_configured` (fail-closed) y el chat no puede
   firmar propuestas. El BFF convierte todo 5xx del backend en 502 `upstream_error`, así que la SPA solo ve
   «servicio no disponible». Hay que definirlo en cada entorno (local, sandbox, producción) antes de abrir las escrituras.
2. **Scope propio `copilot:write`.** Hoy las tools `propose*` exigen `shipment:write` +
   `elevenlabs:copilot_operator` (scope del puente de voz). Los partners necesitan la migración pendiente
   `docs/sql/migrations/20261023_copilot_partner_write_scope.sql`. Propuesta: un scope `copilot:write` distinto del de
   voz, para poder retirar las escrituras del chat sin tocar la voz y para que el rol del cliente OAuth (techo) lo
   conceda explícitamente. Migración con copia `bak_*` y rollback; no la ejecuta el BFF.
3. **`op=proponer` por HTTP sin kill-switch.** El controlador acepta `op=proponer {ruta,payload}` con el Bearer del usuario:
   quien llame directo puede firmar una propuesta propia saltándose el modelo, `copilot_write_enabled='0'` y la auditoría
   `COPILOT_PROPOSAL` del chat. El BFF lo bloquea (`body_enum`), pero conviene que el backend aplique
   `copilot_write_enabled` también en `proponer` o lo restrinja a clientes de voz.
4. **`cache_control` por RPC.** `Anthropic_Chat_Provider` (camino directo) ya cachea el bloque fijo, pero el chat va por defecto
   por RabbitMQ (`Rpc_Chat_Provider`, `system` como cadena) y el worker no está en estos repos: no hay evidencia de que
   cachee. Cambio esperado: ampliar el mensaje RPC con `options.system_cache_prefix` y que el worker emita
   `cache_control: {type: "ephemeral"}`. Verificación: `tmwe_ai_usage.cache_read` antes/después.
5. **`X-Effective-Partner-Id` en todas las respuestas Bearer.** `Abstract_Api_Controller::emit_effective_partner_header()` lo
   emite, pero el BFF ahora **exige** la cabecera (y que coincida) cuando envía `X-Impersonate-Partner-Id`; si falta, descarta la
   respuesta con 502 `effective_partner_mismatch`. Solo se comprueba en respuestas JSON 2xx (no 204, 3xx, errores, binarias ni stream); una ruta cuyo controlador no lo emita se marca con `check_effective_partner: false` en `routes.bff.yaml`. Confirmar que lo emiten todos los controladores que se alcanzan con Bearer
   (también los que no heredan de `Abstract_Api_Controller`); si alguno no lo emite, la suplantación fallará en esa ruta.
6. **`navigateTo`: filtros.** La SPA traduce `period` (`today|yesterday|this_week|this_month`) a `date_from/date_to` locales
   con semana de lunes a hoy y mes natural hasta hoy. Los listados de la SPA no leen `status` de la URL, así que no se reenvía.
   Petición: que el backend envíe ya `date_from/date_to` resueltos (misma definición que usan `listShipments/countShipments`)
   para que lo que ve el usuario coincida con lo que contó el modelo, y confirmar qué es `status` en cada listado.
7. **Errores del backend que la SPA necesita distinguir.** Resuelto en el BFF: en rutas `copilot.*`, `ResponseAdapter::aiProblem()`
   conserva 8 códigos `AI_*` conocidos (`AI_BUDGET_EXCEEDED`, `AI_CREDENTIALS_MISSING`, `AI_CREDENTIALS_INVALID`, `AI_UNAVAILABLE`...)
   sin reenviar mensajes internos; el resto sigue como 502/`rate_limited` genérico. Fuera de `copilot.*` (p. ej. `ai-credentials`) no aplica.
   Backend: el 503 sin credenciales ahora lleva `error_code:'AI_CREDENTIALS_MISSING'`.
8. **Uso del chat con solo `shipment:read`.** `copilot_chat` exige `spedizioni` con operación `write` (POST): un usuario de
   solo lectura no puede usar el chat. Decidir si la operación debe ser `read`; las `propose*` ya exigen `shipment:write`.
9. **Rechazo auditado.** Cancelar la tarjeta no llama a nada (queda sin auditar). Opcional: `op=rechazar` que registre
   `COPILOT_PROPOSAL status=rejected` y queme el jti.
10. **Partners y `contacts:read`.** `searchAddressBook` pide `contacts:read`, que los partners no tienen: pierden esa tool.
    Decidir si se les concede (la SPA no lo oculta: los partners ven costes y datos de su propia agenda).

