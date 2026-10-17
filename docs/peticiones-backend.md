# Peticiones al backend (tmwe_json)

Lo que el BFF y la SPA nuevos necesitan de `tmwe_json` y hoy no existe o no es accesible con
Bearer. Cada punto indica qué se observó, el impacto y la propuesta mínima.

## 0. Bug: el grant `refresh_token` nunca encuentra el token (bloqueante a las 24 h)

`Refresh_Token_Controller::get_refresh_token()` busca el token con
`get_valid_refresh_by_token_and_client_id($param, $this->client['id'])`, es decir, con el **id numérico**
de `oauth_client` (p. ej. 527). Pero `oauth_token.client_id` guarda el **`client_id` hexadecimal**
(`create_access_granted_token($client['client_id'], …)` en `Authorization_Controller`). Resultado:
`POST ?action=token` con `grant_type=refresh_token` responde siempre `401` con cuerpo vacío.

Comprobado en `tmwe_db_dev` con el cliente 527: la condición del controlador (`client_id = 527`)
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
`contacts:read` (selectores de divisas y de clientes); se añadieron en `tmwe_db_dev`
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
- **`X-Forwarded-For`**: el BFF lo envía con la IP del usuario. Confirmar si el backend lo respeta
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
