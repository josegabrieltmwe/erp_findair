# Peticiones al backend (tmwe_json)

> **Estado:** vigente como detalle técnico; la cabecera de abajo está desfasada (P01, P02 y casi P21 ya están resueltas en `tmwe_api`). Lista única y verificada: `contrato-con-api.md` · **Última modificación:** 2026-10-30 · **Clasificación:** automática 2026-10-31, pendiente de revisión humana

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
2. **Scope propio `copilot:write`.** ✅ Resuelto en backend (rama `feat/copilot-scope-write`). Las tools `propose*` exigen
   `shipment:write` + `copilot:write`; la voz sigue con `elevenlabs:copilot_operator` y no se ve afectada. Los partners
   necesitan la migración pendiente `docs/sql/migrations/20261023_copilot_partner_write_scope.sql` (techos
   `app_partner_erp`, `app_internal_erp`, `app_internal_erp_staff` + rol `partner_staff_copilot`; con copia `bak_*` y
   rollback; no la ejecuta el BFF). El rol se asigna a mano y el usuario debe volver a iniciar sesión.
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


## 9. Gestión de aplicaciones y de roles tras el cambio de autenticación (2026-10-25)

Análisis completo en `docs/informe-autenticacion-autorizacion.md`. Lo que la SPA necesita del API:

1. **Contexto de acceso** (`me/access` o ampliar `get_my_profile`): `roles` de la persona, `permissions` efectivos
   (`módulo:operación`, ya con el techo persona ∩ aplicación) y los flags de datos relevantes. Hoy `get_my_profile` solo trae
   `is_admin = (idanagfrc === 1)` y 4 scopes de IA; el BFF deduce `capabilities` de ahí. Sustituye a §2 de este documento.
2. **Formato único de `allowed_origins` y `allowed_ips`.** En `auth_client` el origen del BFF está como JSON
   (`["https://erp-findair.php8"]`), pero `Authorization_Login_Controller::allowed_origins()` lo parte por comas, así que no coincide;
   `allowed_ips` se lee como JSON en `Authz_Service` y como comas en `Oauth_Client::is_ip_allowed`. Elegir uno, normalizar los datos
   y validar al escribir. Hasta entonces la SPA los muestra y no los edita.
3. **Exponer en `api_admin_external_clients`** `redirect_uris`, `require_pkce`, `grant_types` (cuando exista) y `role_ids` si se
   implanta `client_roles` N:M. Hoy no se pueden ver ni gestionar por API.
4. **`Role_Assignment_Policy` y `root`.** Resuelto (2026-10-25): `api_anagrafica_findair_access` informa `grantable_roles`/`addon_role_details` y
   `api_admin_oauth_roles` rechaza editar los scopes de `root`. `api_admin_user_roles` y el bulk operan sobre el RBAC interno, no sobre `auth_role`.
5. **Confirmar qué capas del RBAC interno siguen decidiendo** (`user_permission_overrides`: 120 filas `deny`;
   `user_endpoint_restrictions`, `module_permissions`: 0 filas) en `Authz_Service`/`Permission_Resolver`. Determina si la SPA retira
   o congela esas pantallas (R5/R6 del plan `oauth_puro`).
6. **Secretos de aplicación con hash** (`client_secret_hash`): hoy en claro en `auth_client` (77 filas). La SPA ya los muestra una
   sola vez, así que no cambia.
7. **Depuración de aplicaciones**: 76 de 77 activas sin uso en 90 días y 17 sin rol (paso R0 del plan). La SPA ya marca las latentes.

## 10. Ronda E2E de Luca (pedido → spedizione → fattura, 2026-10-30)

Tres ciclos completos solo con ripiegos manuales. Lo que depende de `tmwe_json` (código, datos o config) y no
se puede resolver desde el BFF/SPA:

1. **`POST /unified_shipment` no está declarado.** El manifiesto `routes.spa.yaml` se genera leyendo
   `methods:` de `config/routes/*.yml` del backend (`bin/gen-spa-manifest.php:44-45,113-119`); hoy solo hay
   `GET` para `unified_shipment`, así que el generador descarta el `POST` que la SPA ya usa
   (`web/apps/operations/src/modules/shipment/stores/shipment.store.ts:150-163`, flujo "Nuova spedizione") y
   Slim responde **405** (la ruta existe en GET, el verbo no). El hermano `unified_cargo_shipment` sí tiene
   GET/POST/PATCH/DELETE declarados y ya funciona para altas de cargo con el mismo patrón
   (`routes.spa.yaml:6353-6386`). Petición: declarar `methods: GET,POST` (o el verbo que use el controlador)
   para `unified_shipment`, igual que para `unified_cargo_shipment`. En cuanto se declare, basta con
   `bff/bin/regen-spa-manifest.sh` — no hace falta tocar código del BFF ni de la SPA. No proponemos editar a
   mano `routes.spa.yaml` (es generado) ni añadir un alias manual en `routes.bff.yaml`: si el backend aún no
   acepta el verbo, el proxy solo trasladaría el mismo error un salto más allá.
2. **Config de sandbox: reglas fiscales de TMWE + rol con `fatturazione:admin`.** Sin esto la factura
   automática no arranca (bloqueo "regole fiscali vuote, admin senza permesso di caricarle"). Es dato/config
   del entorno de `tmwe_json` (tabla de reglas fiscales + asignación de rol), no código de `erp_findair`;
   no se puede resolver desde este repo. Quien tenga acceso a la sandbox de `tmwe_json` debe cargar las
   reglas y conceder el scope al admin de pruebas.
3. **Bloqueos de courier con los ids trocados.** `blocca_CORR_5` bloquea de hecho a FedEx y `blocca_CORR_2` a
   BRT, no al revés (ids confirmados por Luca contra el backend real: 2=BRT, 3=DHL, 5=FedEx, 7=UPS). Ya
   corregimos la etiqueta en la SPA (`AnagraficaFatturazioneSection.vue`, ver abajo), pero en producción puede
   haber clientes con el carrier equivocado bloqueado desde que se migró esta pantalla. Pedimos auditar
   `anagrafiche.blocca_CORR_2/3/5/7` en `tmwe_development`/producción: para cada fila con alguno de esos
   flags en `S`, confirmar con el cliente/comercial si el carrier bloqueado hoy es realmente el que querían, y
   corregir con copia `bak_*` y rollback antes de ejecutar nada. Esto es dato, no código, y no lo tocamos
   desde aquí.
4. **Alta de cliente: el primer contacto nace con permisos de administrador.** Confirmado que ni la SPA ni el
   BFF fijan `is_admin` ni ningún flag de rol al crear un contacto: `contattiService.create()`
   (`web/packages/platform/anagrafiche/services/contatti.service.ts:143-153`) solo reenvía los campos del
   formulario (que no incluye ningún campo de admin/rol — `ContattoFormDialog.vue` solo tiene `ruolo` como
   texto libre de puesto, no un control de permisos) y `UserContextProvider.php:78` del BFF solo **lee**
   `profile['is_admin']`, nunca lo escribe. El valor por defecto lo pone `tmwe_json` al crear el contacto (o
   al asignarle rol). Esto es un hallazgo de seguridad, no solo funcional: cada cliente nuevo arranca con un
   usuario de máximo privilegio sin que nadie lo pidiera. Petición: que el alta de contacto/cliente asigne
   por defecto un rol base sin privilegios de administración (p. ej. `partner_basic`), y que elevar a admin
   sea un paso explícito y auditado. Indicarnos dónde vive esa asignación (tabla/columna, o el servicio que
   crea el contacto) para poder documentar el contrato y, si aplica, añadir un control explícito en el
   formulario de alta de la SPA en lugar de depender de un valor por defecto del backend.
5. **Fuel duplicado y coste de proveedor contando el fuel dos veces** (`Anagrafiche_Listvol.php:382` y el
   cálculo de coste de proveedor): puramente backend, fuera de este repo. No hay ningún contrato de la SPA
   que necesite cambiar para que se corrija — la SPA ya muestra y guarda lo que el backend le devuelve, así
   que si el backend deja de duplicar el fuel, la pantalla queda correcta sin tocar código aquí. Si al corregirlo
   el backend decide separar "ajuste del cliente" y "fuel del servicio" en dos campos distintos en la
   respuesta, sí habría que ajustar el diálogo del listado de precios para no mezclar ambos — lo evaluamos
   cuando esté el contrato nuevo.
6. **SDI: orden `ContattiTrasmittente`/`PECDestinatario`, código IVA sin validar, bollo en lettera d'intento,
   nota de credito sin reducir rate** (`Sdi_Xml_Builder_Service.php:379-390`, `Sdi_Natura_Resolver_Service.php:280`
   y el servicio de notas de crédito): puramente backend, fuera de este repo. Ninguno de estos cuatro cambia
   ningún contrato que consuma la SPA hoy (la SPA no construye XML, no valida IVA ni calcula rate); una vez
   corregidos en `tmwe_json` no requieren ningún cambio en `erp_findair`.
7. **Generar las cuotas/rate de una factura a partir de las condiciones de pago del cliente.** Hoy no existe
   ninguna acción para esto ni en el backend (no hay endpoint que la SPA pueda llamar) ni, por tanto, en el
   manifiesto del BFF — no es un olvido de manifiesto, es una funcionalidad que aún no existe. Cuando
   `tmwe_json` tenga la acción (p. ej. `api_invoice_installments_generate` o similar, con su tier y verbo),
   añadirla al BFF es una línea de manifiesto (`routes.bff.yaml` si hace falta algo manual, o automática si la
   detecta `bin/gen-spa-manifest.php` cuando la SPA la use) — no hace falta código nuevo de proxy. Lo que sí
   toca este repo es la pantalla de la SPA que dispare esa acción (pendiente de diseñar una vez exista el
   endpoint).
