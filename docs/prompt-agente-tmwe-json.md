# Tarea: preparar tmwe_json para el BFF de ERP Findair (segunda entrega)

## Contexto
La SPA de operaciones (Vue + Vuetify) vive ahora en este repositorio (`erp_findair`) y habla con tmwe_json
**solo con Bearer**, a través de un BFF (Slim 4, `erp_findair/bff`): login Authorization Code + PKCE
contra `action=auth`, y cada petición como `app.php?action=<ruta>`. Todo lo que use la SPA debe funcionar
con token, no con sesión PHP. Plan completo: `erp_findair/docs/plan-migracion.md`; detalle técnico:
`erp_findair/docs/peticiones-backend.md`.

Ya está hecho (gracias): `redirect_uris` + PKCE (`6ef5a87be`), política de autorización Bearer en los
controllers `web` (`a27ed1cf0`) y el cliente 527 como `internal` con scopes de personal (`8a15fe416`).

Reglas de autorización vigentes (`AUTHZ_SCOPE_SOURCE=roles`): permiso efectivo = techo del rol del
**cliente** ∩ rol del **usuario**; los clientes `external` no heredan el bypass de administrador TMWE.

Entorno: https://erp-findair.php8 · BD `tmwe_development` · cliente `oauth_client.id=527` · usuario de pruebas
`jose` (contatti.id 12763, rol `tmwe_staff_portal`, anagrafica 1).

## Reglas
- **No hagas bookings, cancelaciones ni envíos de email/etiquetas contra WebCargo, KLM ni ningún
  transportista, ni siquiera en pruebas.** Usa dobles o rutas de solo lectura.
- No rompas la SPA clásica (sesión): lo que cambie debe seguir funcionando con cookie.
- Cambios de datos solo por migración versionada, con copia `bak_YYYYMMDD_*` y rollback. Nada a mano.
- Cada cambio con pruebas PHPUnit. Mínimo privilegio: no añadas permisos «por si acaso».
- Entrega primero las **tablas y diseños marcados «para revisión»** y espera aprobación antes de migrar.

## Tareas, por prioridad

### 0. Bug: el grant `refresh_token` nunca encuentra el token (bloquea sesiones > 24 h)
`Refresh_Token_Controller::get_refresh_token()` busca con `$this->client['id']` (id numérico), pero
`oauth_token.client_id` guarda el `client_id` hexadecimal. Con el cliente 527: 0 tokens válidos con el id
numérico, 22 con el hexadecimal. Resultado: `POST ?action=token grant_type=refresh_token` → 401 siempre.
Arregla la búsqueda (y la detección de reutilización, que compara `(int) client_id`) y añade una prueba de
integración: authorization_code → refresh → uso del nuevo token → reutilización del refresh anterior rechazada.

### 1. Modelo de roles de aplicación (diseño para revisión → migración)
Objetivo: asignar permisos a las apps por roles, con el techo de la app y el permiso real en el rol del usuario.
a. **`app_internal_erp`**: rol techo para la SPA propia, con todos los scopes de negocio de
   `SCOPE_MODULE_MAP` (y los nuevos de 1c), definido en `rbac_seed.yml` + migración. Sustituye al rol
   `erp_findair_dev` (creado a mano en dev, id 17, no versionado): reasigna el cliente 527 y retira el rol.
   Una prueba debe comprobar que el rol cubre exactamente los scopes del mapa (evita desincronización).
b. **Solo clientes `internal`** pueden llevar `app_internal_erp` (valida en el admin de clientes y en prueba).
   El bypass de administrador sigue dependiendo de `client_type`, no del rol.
c. **Scopes (o RBAC de módulo) para los módulos sin scope mapeable**. Hoy dan 403 a todo el que no sea admin TMWE:
   `driver` (api_driver_delivery/manifest/pod/routes/zones), `fornitori_servizi` (api_supplier_*, api_bancali_*,
   api_blocco_corrieri), `docpack` (api_docpack_*), `pagamenti_config` (api_payment_methods/schedules),
   `proforma` (api_proforma_duplicate/lookup), `docsstory`, `shipment_ops` (api_shipment_subcontracting),
   `anagrafiche_banks`, `b2b_config`, y `invoices:write` para `api_invoice_recalculate`. Nota: `listini` figura
   como «no expuesto por scopes» en el código, pero `api_listini*` lo usa la SPA: decide y documenta.
d. **Plantilla externa** `app_external_readonly` (solo lectura) para clientes nuevos. **No** fusiones los
   perfiles externos existentes (`findair_*`, `integrator_*`, `b2b_partner_portal*`): un rol por perfil.
   Los puentes estrechos (Copilot ElevenLabs) conservan su rol propio.
e. **Roles de usuario**: tabla (módulo → scope → roles de usuario que deben tenerlo: `tmwe_staff_portal`,
   `partner_staff`, …) **para revisión**, y después migración. Sin esto, quien no sea admin TMWE seguirá con 403.

### 2. Controllers que responden 401 a un token válido
`api_bancali_mpl`, `api_bancali_tipi`, `api_supplier_services`, `api_supplier_service_supplements`,
`api_supplier_tracking_descr`, `api_supplier_tracking_err`, `api_supplier_zones_web` devuelven 401 con cuerpo
vacío cuando falta permiso, aunque el token es válido (`get_my_profile` con ese token da 200). Debe ser 403
con `error_code`. Un 401 significa «token inválido o caducado».

### 3. Rutas de tier `ajax` accesibles con Bearer (24)
Solo aceptan sesión, así que el BFF no las expone. Hazlas híbridas (Bearer + sesión, como
`Web_Valute_Controller::is_authenticated()` + `get_authz_policy()`), **conservando el nombre de ruta y el
contrato de respuesta**. Las de descarga deben devolver el binario con `Content-Type` y `Content-Disposition`.
`ajax_cancel_shipment` `ajax_cargo_addresses` `ajax_cargo_charge_details` `ajax_cargo_packages`
`ajax_generate_proforma_file` `ajax_get_combined_label_pdf` `ajax_get_label_courier_shipment`
`ajax_partner_currency` `ajax_remote_zone_check` `ajax_route_stats` `ajax_send_ldv_to_mittente`
`ajax_shipment_list` `ajax_tmwe_label` `ajax_tmwe_label_bundle` `api_form_field_help` `set_archiviata`
`set_archiviata_cargo` `set_controllata` `set_controllata_cargo` `set_fornitori_service` `set_private`
`spedy_ajax_lista_fornitori_box` `spedy_ajax_lista_servizi` (la lista exacta: `bff/bin/regen-spa-manifest.sh`).

### 4. Endpoint de contexto del usuario
`GET ?action=get_ops_bootstrap` (cualquier usuario autenticado, funciona con Bearer), reutilizando
`resolve_capabilities()`, `resolve_invoicing_capabilities()` e idioma de `Operations_Page_Controller`
(extraer a un servicio compartido):
`{"user":{"username","name","email","idanagfrc","is_admin"},"language","capabilities":["tmwe","clients"],
"invoicing_capabilities":{…}}`. El BFF lo usará con `UPSTREAM_CONTEXT_ACTION=get_ops_bootstrap`.

### 5. Errores y tiempos
- `api_cargo_margin_explain` → 502 (error del BFF por 5xx del backend): investiga.
- `api_home_box_indicators` tarda ~9 s (hasta 40 s bajo carga): optimiza o paginar.
- `rubrica_set_preferred` y `shipment_timing` → 404 con GET: confirma método y ruta.
- `POST api_communication_stream_token` dio 5xx en local: causa y arreglo o error controlado.

### 6. Varios
- `methods:` en cada entrada de `config/routes/*.yml` (el BFF genera el manifiesto con heurísticas).
- `X-Forwarded-For`: el BFF lo envía con la IP del usuario; decide si se respeta (límites, `allowed_ips`,
  auditoría) y solo desde qué proxies; documéntalo.

### 7. Copilot de IA (texto)
Detalle en `peticiones-backend.md` §8: `ELEVENLABS_COPILOT_WRITE_PROPOSAL_SECRET` en cada entorno, scope propio
`copilot:write` y migración de partners, `copilot_write_enabled` también en `op=proponer`, `cache_control` en el camino
RPC, `X-Effective-Partner-Id` en todos los controladores Bearer (el BFF ya lo exige al suplantar) y fechas resueltas en
`navigateTo`.

## Cómo comprobar tu trabajo
Desde `bff/` (con una sesión: login en `https://erp-findair.php8/bff/auth/login`
como `jose`, y la cookie `__Host-sid` del navegador):
- `bin/regen-spa-manifest.sh` → «NO expuestas, tier ajax» debe quedar vacío.
- `php bin/probe-routes.php <cookie>` → sondeo de solo lectura; los 403 y 401 de las tareas 1 y 2 deben
  desaparecer (los que queden deben ser por diseño: `admin_only` para no administradores, `not_a_partner`).
- `php bin/explain-403.php /var/www/host/tmwe/erp/tmwe_json` → módulo o política que exige cada 403 restante.
- `/bff/auth/session` devuelve `capabilities` (tarea 4).
- Tras la tarea 0: tras caducar el access token, la SPA sigue funcionando sin volver al login.
- La SPA clásica (sesión) sigue funcionando; PHPUnit en verde.

Entrega al final: resumen por tarea, migraciones y rollbacks, pruebas añadidas y las decisiones que
requieran aprobación (en especial las tablas de las tareas 1c y 1e).
