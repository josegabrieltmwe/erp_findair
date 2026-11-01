# Contrato con el API (`tmwe_api`)

> **Estado:** vigente · **Generado:** 2026-10-31 · **Clasificación:** automática, pendiente de revisión humana

Lista única de lo que el BFF y la SPA piden a `tmwe_api`, fusión de `peticiones-backend.md` (detalle técnico y evidencia) y `prompt-agente-tmwe-json.md` (lista priorizada, ya obsoleta como prompt). Numeración unificada P01–P41; el detalle de cada una sigue en el `§` indicado de `peticiones-backend.md`.

**Cómo se verificó:** lectura y `grep` sobre `tmwe_api`, rama `sandbox`, commit `9dc89a676` (2026-10-30). No se ejecutó nada ni se consultó ninguna base de datos. "NO-VERIFICADA" significa que no se buscó o el `grep` no fue concluyente; "NO-VERIFICABLE" que depende de datos, entorno o workers fuera del repo. Antes de actuar sobre una petición marcada como abierta o resuelta, comprobarla de nuevo.

Nota de nombres: los documentos antiguos llaman `tmwe_json` al backend, que hoy es `tmwe_api`.

## Peticiones

Numeracion unificada propuesta P01..P40. Fuente vigente = peticiones-backend.md salvo indicacion (el prompt lo resume con otra numeracion: "T0..T7"). Verificacion contra tmwe_api rama `sandbox` por grep (solo lectura). Estados "segun el texto" tal como lo declara el propio documento; "verificacion" es mi comprobacion.

Leyenda verificacion: RESUELTA-EN-CODIGO / ABIERTA-EN-CODIGO / PARCIAL / NO-VERIFICABLE (dato, entorno o worker fuera del repo).

### A. Autenticacion, sesion y permisos

| ID | Titulo | Ref. en docs | Estado segun el texto | Fuente vigente | Verificacion en tmwe_api sandbox |
|---|---|---|---|---|---|
| P01 | Bug: grant `refresh_token` busca con id numerico (sesiones > 24 h) | pet §0; prompt T0; plan §3.1 | ABIERTA, "bloqueante a las 24 h" (cabecera de pet dice "siguen abiertos §0") | pet §0 | RESUELTA-EN-CODIGO. controller/api/oauth2/Refresh_Token_Controller.php:63 usa `$this->client['client_id']` (hex) con comentario en :64; la deteccion de reutilizacion compara el hex como string en :76. Falta confirmar la prueba de integracion del flujo completo (no buscada). Los tres docs siguen diciendo "roto": actualizar. |
| P02 | Endpoint de contexto de usuario `get_ops_bootstrap` (capabilities, invoicing_capabilities, language) | pet §2; prompt T4; plan §3.5 | ABIERTA ("Siguen abiertos §2") | pet §9.1 lo sustituye por `me/access`/ampliar `get_my_profile` | RESUELTA-EN-CODIGO para el endpoint original: config/routes/api_misc.yml:234 (`response_on: get_ops_bootstrap`), Scope_Inference_Service.php:55, tests/Unit/Controller/Api/GetOpsBootstrapControllerTest.php:21, BffApiRoutesDocsParityTest.php:37. No verifiado si el BFF ya fija `UPSTREAM_CONTEXT_ACTION`. P03 es la ampliacion pendiente. |
| P03 | Contexto de acceso con roles y permisos efectivos (`me/access` o ampliar `get_my_profile`) | pet §9.1 | abierta (sustituye a §2) | pet §9.1 | NO-VERIFICADA (no se busco `me/access`; `get_ops_bootstrap` existe pero no se comprobo si devuelve roles/permissions). |
| P04 | Permisos Bearer vs sesion: revisar scopes por rol de personal y registrarlo como migracion | pet §3 | abierta ("Pendiente") | pet §3; prompt T1e | NO-VERIFICABLE por grep (es tabla de decision/migracion). Existen roles en config/rbac_seed.yml (`tmwe_staff_impersonator` l.282, `app_internal_erp_staff` l.535). |
| P05 | `redirect_uris` + PKCE (exigir PKCE a externos, rechazar `plain`) | pet §4; plan fase A | RESUELTA ("Ya resuelto: redirect_uris + PKCE") | pet §4 | Segun texto resuelta (commit 6ef5a87be); no reverificado. |
| P06 | `X-Forwarded-For`: confirmar si el backend lo respeta y desde que proxies | pet §4; prompt T6; plan §3.8; bff/README | abierta | pet §4 | NO-VERIFICADA (no grepeado). |
| P07 | Rol propio de produccion para el cliente (solo scopes que usa la SPA); sustituir `erp_findair_dev` | pet §4; prompt T1a; plan §2/D | abierta (parcial: hecho en dev) | prompt T1a + plan §2 | PARCIAL. El rol `app_internal_erp_staff` esta en rbac_seed.yml:535 y mapeado a ERP Findair en bin/compare_docs_catalog_old_vs_new.php:37; `app_internal_erp` no re-grepeado. El cliente de produccion es un dato de BD: NO-VERIFICABLE. |
| P08 | Modelo de roles de aplicacion (`app_internal_erp`, solo internal, tabla de scopes, plantilla `app_external_readonly`, tabla de roles de usuario) | prompt T1a-e; plan §2 | abierta, "para revision" | prompt T1 | PARCIAL: `INTERNAL_ONLY_ROLES = ['app_internal_erp','app_internal_erp_staff']` en service/auth/Scope_Service.php:212; falta verificar 1c (scopes de driver/docpack/etc.) y 1d (`app_external_readonly`). |
| P09 | Scopes/RBAC para modulos sin scope mapeable (driver, fornitori_servizi, docpack, pagamenti_config, proforma, docsstory, shipment_ops, anagrafiche_banks, b2b_config, invoices:write para recalcular) | prompt T1c; plan §3.2 | abierta | prompt T1c | NO-VERIFICADA (requiere cruzar SCOPE_MODULE_MAP). |
| P10 | Controllers que responden 401 a token valido (deben dar 403 con error_code): bancali_mpl/tipi, supplier_services, supplement, tracking_descr, tracking_err, zones_web | prompt T2; plan §3.3 | abierta | prompt T2 | NO-VERIFICADA. Indicio: controller/api/fornitori/Bancali_Mpl_Controller.php:33 comenta usar `is_authenticated()` "which rejects with 401"; hay que revisar si sigue devolviendo 401 en falta de permiso. El BFF ya no cierra sesion con ese 401 (plan fase C). |
| P11 | Suplantacion de partner (6.1): rol de cliente `app_internal_erp_staff` con `partner:impersonate`, en INTERNAL_ONLY_ROLES y AppRolesParityTest | pet §6.1 | abierta (peticion con migracion) | pet §6 | RESUELTA-EN-CODIGO: config/rbac_seed.yml:535-537 (rol, con `partner:impersonate` en 596) y Scope_Service.php:212. Falta confirmar migracion/asignacion del cliente 527 (dato). |
| P12 | Suplantacion (6.2): rol de usuario con `partner:impersonate` para todo el personal TMWE | pet §6.2 | abierta | pet §6 | PARCIAL: existe rol `tmwe_staff_impersonator` (rbac_seed.yml:282, "Igual que tmwe_staff_portal MAS partner:impersonate") y `partner:impersonate` en :46 y :327. Asignacion a usuarios con anagrafica 1 = dato, NO-VERIFICABLE. |
| P13 | Suplantacion (6.4): devolver 403 `IMPERSONATION_DENIED` en vez de 401 generico | pet §6.4 | abierta | pet §6 | RESUELTA-EN-CODIGO: service/Security_Service.php:515 `set_auth_failure('IMPERSONATION_DENIED', ...)` y docblock :512/:559 ("Responde 403 IMPERSONATION_DENIED"). |
| P14 | `X-Effective-Partner-Id` en todas las respuestas Bearer (el BFF lo exige al suplantar) | pet §8.5 | abierta (confirmar) | pet §8.5; plan §6 B1/C11 | PARCIAL: solo se emite en controller/api/Abstract_Api_Controller.php:439 y :534 (`emit_effective_partner_header`). No hay otro emisor en controllers que no heredan de Abstract_Api_Controller; ABIERTA para esos. |
| P15 | Formato unico de `allowed_origins`/`allowed_ips` (JSON vs comas) y validar al escribir | pet §9.2 | abierta | pet §9.2 | NO-VERIFICADA a fondo. Hay manejo de comas documentado en External_Client_Provisioning_Controller.php:23 ("https://acme.com,https://api.acme.com"), consistente con la inconsistencia descrita; sin evidencia de normalizacion. |
| P16 | Exponer en `api_admin_external_clients` `redirect_uris`, `require_pkce`, `grant_types`, `role_ids` | pet §9.3 | abierta | pet §9.3 | ABIERTA-EN-CODIGO (probable): grep de `redirect_uris|require_pkce` en controller/api/admin/External_Client_Admin_Controller.php = 0 coincidencias (solo expone `allowed_origins`, l.184/256). |
| P17 | `Role_Assignment_Policy` y `root` (`grantable_roles`, rechazar editar scopes de root) | pet §9.4 | RESUELTA (2026-10-25) | pet §9.4 | Segun texto resuelta; no reverificado. |
| P18 | Confirmar que capas del RBAC interno siguen decidiendo (`user_permission_overrides`, `user_endpoint_restrictions`, `module_permissions`) en Authz_Service/Permission_Resolver | pet §9.5 | abierta (pregunta de decision) | pet §9.5; informe §5 | NO-VERIFICADA. |
| P19 | Hash de secretos de aplicacion (`client_secret_hash`) | pet §9.6 | abierta (SPA no cambia) | pet §9.6 | NO-VERIFICADA (dato: 77 filas en claro segun informe). |
| P20 | Depuracion de aplicaciones latentes (76/77 sin uso, 17 sin rol) | pet §9.7 | abierta | pet §9.7 | NO-VERIFICABLE (datos). |

### B. Rutas y contratos de API

| ID | Titulo | Ref. | Estado segun texto | Fuente | Verificacion |
|---|---|---|---|---|---|
| P21 | Rutas `ajax` solo-sesion sin equivalente Bearer (23 en pet §1; 24 en prompt T3; "quedan 6 + 2 html + 6 sin ruta" en plan §3.4) | pet §1; prompt T3; plan §3.4 | abierta | pet §1 en su lista; plan §3.4 en el recuento mas reciente (6 restantes) | PARCIAL/mayormente RESUELTA. config/routes/api_courier.yml:24-60 define rutas `*_compat` y `api_*` que sustituyen contratos ajax: `api_label_combined_pdf` (ajax_get_combined_label_pdf), `api_shipment_cancel` (ajax_cancel_shipment, POST), `api_send_ldv_to_mittente_compat`, `api_shipment_list_compat` (ajax_shipment_list), `api_service_list_compat` (spedy_ajax_lista_servizi), `api_provider_box_compat` (spedy_ajax_lista_fornitori_box), `api_shipment_archive` (set_archiviata), set_controllata... Sin confirmar: `ajax_cargo_packages`, `ajax_get_label_courier_shipment`, `ajax_tmwe_label`, `spedy_chat` (los 6 restantes del plan). Ojo: las rutas nuevas tienen otro nombre (`*_compat`), no "conservan el nombre de ruta" como pedia el prompt T3: el BFF/SPA debe usar los nombres nuevos. Regenerar manifiesto (`bff/bin/regen-spa-manifest.sh`) para confirmar la lista exacta. |
| P22 | `methods:` en cada entrada de `config/routes/*.yml` | pet §5; prompt T6; plan §3.6 | abierta | pet §5 + §10.1 | ABIERTA-EN-CODIGO en general: p. ej. config/routes/api_courier.yml:202-205 (`unified_shipment`) sin `methods:`; otras entradas si lo llevan (l.30, 35, 56, 103, 217). |
| P23 | Declarar `POST` de `/unified_shipment` (SPA flujo "Nuova spedizione"; hoy 405 por manifiesto sin POST) | pet §10.1 | ABIERTA (2026-10-30) | pet §10.1 | **RESUELTA en el BFF (2026-10-31), no en tmwe_api.** El diagnóstico anterior era erróneo: el 405 no lo daba el backend (`api_courier.yml:202-205` sin `methods:` admite todos los verbos y `Shipment_Crud_Controller.php:71` acepta POST) sino el manifiesto del BFF: la SPA crea con `useEntityCreate`, que recibe el endpoint como parámetro (`shipment.store.ts:160`), y `gen-spa-manifest.php` solo deducía el GET. Añadir `methods:` en el backend no habría añadido el POST, porque el generador solo usa `methods:` para descartar verbos. Arreglo: entrada manual `post.unified_shipment` en `bff/config/routes.bff.yaml` (límite 1m / 30 s, como `post.unified_cargo_shipment`). Pruebas del BFF: 145 OK. Falta probarlo contra el backend real. |
| P24 | Enlaces a paginas heredadas (`crm_pratica`, `admin_config`, `api_doc`, `get-tracking-list`) | pet §5 | abierta (informativa) | pet §5; plan §3.4 | NO-VERIFICADA. |
| P25 | Errores/tiempos: `api_cargo_margin_explain` 502; `api_home_box_indicators` ~9 s; `rubrica_set_preferred` y `shipment_timing` 404 con GET; `POST api_communication_stream_token` 5xx | prompt T5; plan §3.7 | abierta | prompt T5 (solo ahi) | NO-VERIFICADA (requiere ejecutar). |

### C. Operaciones puntuales

| ID | Titulo | Ref. | Estado segun texto | Fuente | Verificacion |
|---|---|---|---|---|---|
| P26 | Consolidacion: candidatos para adjuntar por cliente del cargo, no por el llamante | pet §7 | abierta | pet §7 | ABIERTA-EN-CODIGO: service/cargo/consolidation/Consolidation_Service.php:236-241: `list_attachable(...,$uid,...)` llama `find_attachable([$uid], $q, $limit)` (solo el uid del llamante); el control de acceso (l.237) si usa `Shipment_Access_Service`. Llamada desde controller/api/cargo/consolidation/Consolidation_Controller.php:100. |

### D. Copilot de IA (texto)

| ID | Titulo | Ref. | Estado segun texto | Fuente | Verificacion |
|---|---|---|---|---|---|
| P27 | Definir `ELEVENLABS_COPILOT_WRITE_PROPOSAL_SECRET` en local, sandbox y produccion | pet §8.1; prompt T7 | abierta (sin ella 503 `proposal_secret_not_configured`) | pet §8.1 | NO-VERIFICABLE (variable de entorno). Soporte en codigo: app/config/config.yaml.example:122; service/ai/elevenlabs/Copilot_Write_Proposal_Service.php:37; 503 en Copilot_Write_Proposal_Controller.php:165-168. |
| P28 | Scope propio `copilot:write` + migracion de partners | pet §8.2 | RESUELTA en backend (rama feat/copilot-scope-write); migracion `20261023_copilot_partner_write_scope.sql` pendiente de ejecutar | pet §8.2 | Segun texto resuelta en codigo; ejecucion de la migracion NO-VERIFICABLE. |
| P29 | `op=proponer` por HTTP sin kill-switch (`copilot_write_enabled`) | pet §8.3 | abierta (BFF lo bloquea con `body_enum`) | pet §8.3 | **RESUELTA en código (2026-10-31, `tmwe_api` sandbox `f3e36c95f`).** `Copilot_Write_Proposal_Controller::handle_proponer()` responde 403 `copilot_write_disabled` si `copilot_write_enabled` vale `0` para la anagrafica del usuario autenticado, con la misma regla que el chat (solo un `0` explícito apaga; sin fila = activo). `op=confirmar` no se toca. Tests: `CopilotWriteProposalControllerTest` (2 nuevos, pasan). Pendiente: probar en sandbox con un partner que tenga el ajuste apagado; el `body_enum` del BFF puede mantenerse como segunda barrera. |
| P30 | `cache_control` por RPC (`options.system_cache_prefix`) | pet §8.4 | abierta | pet §8.4 | NO-VERIFICABLE: el worker RabbitMQ no esta en estos repos (lo dice el propio doc). |
| P31 | `navigateTo`: enviar `date_from/date_to` resueltos y confirmar que es `status` | pet §8.6 | abierta | pet §8.6 | NO-VERIFICADA. |
| P32 | Codigos de error `AI_*` distinguibles | pet §8.7 | RESUELTA (BFF `aiProblem()`; backend 503 con `AI_CREDENTIALS_MISSING`) | pet §8.7 | Segun texto resuelta; no reverificado. |
| P33 | Uso del chat con solo `shipment:read`: decidir si `copilot_chat` exige operacion write | pet §8.8 | abierta (decision) | pet §8.8 | ABIERTA (indicio): Copilot_Chat_Controller.php:40-46 usa `get_authz_policy() = ['module'=>'spedizioni']`; la operacion se deduce del verbo (POST => write) segun el texto del doc; no se confirmo el mapeo. Es una decision de producto. |
| P34 | Rechazo auditado (`op=rechazar`) | pet §8.9 | abierta (opcional) | pet §8.9 | ABIERTA-EN-CODIGO: el controlador solo acepta `proponer|confirmar` (Copilot_Write_Proposal_Controller.php:145-151; 400 `invalid_op` en otro caso). |
| P35 | Partners y `contacts:read` (tool `searchAddressBook`) | pet §8.10 | abierta (decision) | pet §8.10 | NO-VERIFICADA (decision de producto). |

### E. Ronda E2E de Luca (2026-10-30)

| ID | Titulo | Ref. | Estado segun texto | Fuente | Verificacion |
|---|---|---|---|---|---|
| P36 | Reglas fiscales de TMWE vacias + rol con `fatturazione:admin` en sandbox | pet §10.2 | ABIERTA, bloqueante (factura automatica no arranca) | pet §10.2 | NO-VERIFICABLE (dato/config de sandbox). |
| P37 | Bloqueos de courier con ids trocados (`blocca_CORR_2/3/5/7`, auditar y corregir con bak_) | pet §10.3 | abierta (dato) | pet §10.3 | NO-VERIFICABLE (datos). |
| P38 | Alta de cliente: el primer contacto nace con permisos de administrador (hallazgo de seguridad) | pet §10.4 | abierta; seguridad | pet §10.4 | **VERIFICADA en código (2026-10-31, `tmwe_api` sandbox): no es una escalada global; es el comportamiento heredado del legacy, acotado a la propia cuenta.** Al dar de alta una anagrafica, `Anagrafica_Service::default_contacts()` crea dos contactos base: «Accesso admin» (`auth_17`, `auth_18`, `auth_19`, `auth_20` = `S`) y «Accesso user» (`auth_17`/`auth_18` = `N`). Cada contacto recibe además el rol por defecto de su tipo (`Default_Api_Role_Service`: cliente → `findair_basic`; partner → `partner_staff` + `partner_billing`; TMWE → `tmwe_staff_portal`). `auth_17` solo habilita gestionar los usuarios de **su misma** cuenta (`Anagrafica_Contact_Controller`, `ACCOUNT_ADMIN_REQUIRED`); `is_admin` del perfil es solo la anagrafica 1 (`Get_My_Profile_Controller.php:79`), así que no se hereda. Para un cliente final `auth_18` no da costes: `Data_Scope::capped_for_actor` lo topa (`DataScopeActorCapTest`). Para un partner, ver costes es intencionado (decisión D7). **Sin cambio de código.** Pendiente de decisión de producto: si el contacto «Accesso admin» debe seguir naciendo con `auth_17`–`auth_20` o si el alta debe pedir explícitamente quién es el administrador de la cuenta; y comprobar cómo se entregan al cliente las credenciales generadas de los dos contactos base (no revisado). `partner_basic` no existe como rol y no hace falta para cerrar este punto. |
| P39 | Fuel duplicado y coste de proveedor contando fuel dos veces (`Anagrafiche_Listvol.php:382`) | pet §10.5 | abierta (solo backend) | pet §10.5 | NO-VERIFICADA: model/Anagrafiche_Listvol.php:382 hoy contiene `COALESCE(NULLIF(al.fuel_surc,0), sf.fuel_surc)`; la linea citada puede haber cambiado de contenido; requiere revisar el calculo. |
| P40 | SDI: orden ContattiTrasmittente/PECDestinatario, codigo IVA sin validar, bollo en lettera d'intento, nota de credito sin reducir rate | pet §10.6 | abierta (solo backend) | pet §10.6 | NO-VERIFICADA (archivos existentes: service/fatturazione/Sdi_Natura_Resolver_Service.php; no se reviso Sdi_Xml_Builder_Service). |
| P41 | Accion para generar cuotas/rate de factura segun condiciones de pago | pet §10.7 | abierta (funcionalidad inexistente) | pet §10.7 | ABIERTA-EN-CODIGO: grep de `api_invoice_installments|installments_generate` en config = 0 coincidencias. |

Total: 41 peticiones unificadas (P01-P41).

### F. Hallazgos de la revisión de formularios (2026-11-01)

Verificados leyendo código de `tmwe_api` y la SPA (sin ejecutar). Detalle y prioridad en `plan-mitigacion-hallazgos-formularios.md`. Verificación en `tmwe_api`: ABIERTA-EN-CODIGO salvo indicación.

| ID | Titulo | Detalle | Prioridad |
|---|---|---|---|
| P42 | `root` sin proteger en la ficha de usuario | `User_Admin_Controller` (`reset_password`, `update_user`, `delete_user`) solo exige anagrafica 1: un administrador TMWE sin `root` puede restablecer la contraseña de un `root` y recibirla en la respuesta. Añadir guard de destino `root` (403 `ROLE_ROOT_ONLY`); en el alta, devolver 403 o `roles_denied` en vez de omitir el rol `root` en silencio. Revisar `User_Plain_Password_Controller` | Alta |
| P43 | Cancelar cargo sin comprobaciones | `Cancel_Controller` no consulta factura, AWB ni reserva viva. Responder 409 en esos casos, con `force` o rol para AWB emitido | Media-alta |
| P44 | HAWB manual sin expedición | `Awb_Service::validate_create_data` exige `id_spediz` para HAWB; la SPA ya da el alta manual eligiendo la expedición; solo se pide al API si se quiere HAWB sin expedición | Baja (opcional) |
| P45 | Guardado transaccional de bultos | La SPA borra, modifica y añade bulto a bulto; un fallo deja datos a medias. Endpoint de reemplazo con rollback | Media |
| P46 | Conciliación COD: fecha futura y estado inválido | `Cod_Reconciliation_Service` acepta fecha futura y convierte un estado inválido en «cobrado». Rechazar ambos | Media |
| P47 | Factura manual con fecha futura | No se encontró comprobación de fecha futura en `Invoice_Service` (solo la cronológica de la serie) | Media |
| P48 | Márgenes por escalón sin rango | `Scaglioni_Service` acepta cualquier valor (negativo o 9999) | Media |
| P49 | Causales de factura: alícuota sin validar | `Invoice_Causal_Model` no valida el rango de `aliquota` | Media |
| P50 | Plazos de pago sin tramos | `Payment_Schedule_Model` guarda un plazo sin ningún `gg*` en `S` | Media |
| P51 | Datos fiscales sin validar | PEC, mail, `cod_destin` (SDI), `pi_cf`, `cf`, CAP, SWIFT y ABI no se validan al guardar (el IBAN sí, mod-97) | Media |
| P52 | `fornitori_accnt` devuelve `pw` y `chiave` en claro | «Paridad legacy». Devolver `has_pw`/`has_chiave` y tratar el vacío como «conservar»; revisar consumidores legacy | Media |
| P53 | Modificación múltiple de precios: regex permisiva | `Listini_Bulk_Update_Service` acepta `--5` y `1.2.3` y los interpreta como 0 y 1,2. Usar `^-?\d+(\.\d+)?$` | Baja-media |
| P54 | Cuentas bancarias del emisor: error sin 4xx | `Issuer_Bank_Accounts_Controller` (~L91) responde `nome o iban requerido` con 200; devolver 422 con `error_code` | Media |
| P55 | `offerta_txt` sin sanear y saneador por regex débil | `set_offer_text` guarda HTML sin sanear; `Email_Html_Sanitizer` no cubre `onX=` sin comillas, `javascript:` con entidades ni `data:`. Sanear al guardar y pasar a un saneador basado en DOM | Baja-media |
| P56 | Alta de anagrafica: contactos base | `Anagrafica_Service::generate_password` usa `str_shuffle` (no criptográfico) y los contactos base nacen sin sede ni dueño. Usar `random_int` y asignar sede (relacionada con P38) | Baja-media |
| P57 | Exponer la lista de campos de solo lectura de una expedición facturada | La SPA mantiene su propia lista y difiere de `READONLY_FIELDS_INVOICED`; exponer `readonly_fields` en la carga de la expedición | Baja |
| P58 | Scope `master_data:read` para el partner (monedas y países) | Al abrir el detalle de una expedición courier, el usuario partner recibe `403 oauth_insufficient_scope` (`required: master_data/read`) en `GET /api_master_currencies` y la SPA muestra «No tienes permiso para esta acción». Lo mismo ocurre con `GET /api_master_countries` al abrir la dirección de entrega: el desplegable «País» queda vacío y la dirección se guarda sin país, sin aviso. Conceder el scope de lectura de los maestros (monedas, países) al partner, o que la SPA no los pida / el API los sirva por otra ruta pública | Media |
| P59 | Candidatos a consolidar de los clientes del partner | `Consolidation_Service::list_attachable` pasa solo `[$uid]` a `Spedizioni::find_attachable` (filtra `id_cliente IN (uid)`), aunque su comentario promete incluir los clientes cuyo titolare es el llamante. Un partner no ve las expediciones de sus clientes (p. ej. cliente 9586 de 123Logistix) ni en el panel de consolidación ni en «Nuevo HAWB». La SPA ofrece el número tecleado como salida; el API debería devolver también `id_cliente` con `id_anagr_titolare = uid`, respetando la sede/propietario | Alta |
| P60 | Validar el número de AWB al guardar el MAWB | `PATCH /api_cargo_mawb` acepta «abc» o un dígito de control erróneo con 200 y sin aviso. Validar formato `NNN-NNNNNNNN` y dígito (serie mod 7) al guardar, o al menos al confirmar | Media |
| P61 | Estado HTTP de los errores de `unified_cargo_consolidation` y `api_cargo_shipment_charges` | `PATCH api_cargo_shipment_charges` con datos inválidos (`update_failed`, `invalid_item_id`) también responde HTTP 200 con un `problem+json` de status 400. Un duplicado («House AWB already exists for this cargo/spedizione») sale con HTTP 200 y cuerpo `problem+json` con `status: 500`. Debe ser un 409 real | Baja |
| P62 | Tiempo de generación de PDF de AWB | `GET /api_awb_documents?type=mawb|hawb&format=pdf` tarda 10-14 s en local y devolvió un `504` una vez (BFF `timeout`); revisar el límite del BFF para esa ruta y la lentitud del generador | Baja |
| P63 | Permisos del partner en la carga del cargo y de la expedición | Al abrir el cargo y sus costes el partner recibe `403 ACCESS_DENIED` en `GET /api_partner_currency_compat?id_client=…` (además del `403` de P58). Aclarar qué debe poder leer un partner de sus propios clientes | Media |

### Recuento de estado (verificacion contra sandbox)
- RESUELTA-EN-CODIGO: 4 (P01 refresh, P02 get_ops_bootstrap, P11 rol app_internal_erp_staff, P13 IMPERSONATION_DENIED); + 3 resueltas segun texto sin reverificar (P05, P17, P32) + P28 (resuelta en codigo, migracion pendiente).
- MAYORMENTE RESUELTA / PARCIAL: P21 (ajax), P07, P08, P12, P14.
- ABIERTA-EN-CODIGO confirmada: P16, P22, P26, P34, P41 (5; P23 se resolvió en el BFF y P29 en `tmwe_api` el 2026-10-31); probable: P33.
- NO-VERIFICABLE (datos/entorno/worker): P04, P19, P20, P27, P30, P36, P37.
- NO-VERIFICADA (sin tiempo/grep inconcluso): P03, P06, P09, P10, P15, P18, P24, P25, P31, P35, P39, P40.

### Discrepancias entre los dos documentos (relevantes para fusionar)
1. Cabeceras desfasadas: peticiones-backend.md l.3-6 dice que siguen abiertos §0, §1, §2, pero en sandbox P01 y P02 ya estan resueltas y P21 casi. Plan-migracion §3 (lista de 8) tambien.
2. Estructura: el prompt (7 tareas) cubre P01, P02, P04, P07-P10, P21, P25 y P22/P06, P27-P31; NO cubre §6 (impersonacion, P11-P13), §7 (P26), §9 (P03, P15-P20), §10 (P23, P36-P41), ni §8.5-8.10 detallados. Esas solo estan en peticiones-backend.md.
3. T2 (401 -> 403) y T5 (errores/tiempos) solo existen en el prompt; no tienen detalle en peticiones-backend.md.
4. §2 (get_ops_bootstrap) esta superado por §9.1 dentro del propio peticiones-backend.md, pero el endpoint de §2 ya existe en backend.
5. Nombre de backend: `tmwe_json` vs `tmwe_api`; ruta de comprobacion en prompt: /var/www/host/tmwe/erp/tmwe_json.
6. T3 pedia conservar el nombre de ruta; la implementacion usa nombres nuevos (`api_*`/`*_compat`): hay que reflejarlo en el contrato.
7. Recuento de rutas ajax: 23 (pet) vs 24 (prompt, con 23 nombres) vs 6 restantes (plan).
