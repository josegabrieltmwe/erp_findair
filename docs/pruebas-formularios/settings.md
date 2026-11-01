# Formularios de Settings: casos de prueba

> **Estado:** borrador · **Última modificación:** 2026-11-01 · Generado por lectura de código (no se ejecutó nada). Parte de [plan-pruebas-formularios.md](../plan-pruebas-formularios.md). Las reglas de cada ficha salen del código citado; lo marcado «no determinado» no se pudo confirmar.

## Settings (prefijo SET)

Alcance: paquetes `web/packages/platform/*` que no son anagrafiche/listini/googlemaps_address_fields/detail, `apps/operations/src/modules/settings` (hub `SettingsPage.vue`, `settingsAccess.ts`) y rutas `/settings/*` de `apps/operations/src/router/index.ts`. Se documentan 40 fichas (varias agrupan CRUD parecidos con una tabla de campos por pantalla). Casi todo cuelga de `meta.requiresAdmin` (TMWE, `is_admin`); excepciones: `/settings/ai-credentials` (`aiScope: "ai:admin"`), `/settings/smtp`, `/settings/elevenlabs-my-agent` y `/settings/ai-center` (sin meta, autoriza el servidor), y 11 rutas que además abre quien tenga el scope de `settingsAccess.ts` (`config:read` o `suppliers:read`). El guard del router es solo UX; la API autoriza cada petición.

Mayor riesgo (P0, identidad y seguridad): usuarios (alta, reset de contraseña, flags `auth_*`, roles base y aditivos), OAuth clients (secreto mostrado una vez, rotar, rol), roles OAuth, credenciales de IA/ElevenLabs/transportistas (solo escritura), MFA, SMTP de partner, scheduler ("ejecutar ahora"), y datos fiscales (causales de factura, formas de pago, cuentas bancarias, plan contable). Hallazgos principales al final de cada ficha y resumidos en el mensaje final.

Convenciones de este fichero: "patrón CRUD maestro" = tabla `ListingDataView` con búsqueda local + diálogo `v-form` (alta/edición) + `confirm.askDanger` al borrar + toast de éxito/error con `e.message`; salvo que se diga lo contrario, la regla `requiredRule` es `!!v && trim() !== ''` y se valida con `formRef.validate()`. Los endpoints de maestros pasan por el proxy del BFF con la lista blanca; no hay validación de negocio adicional en el cliente salvo lo indicado.

---

### SET-01 · Usuarios: listado y filtros
- **Ruta/pantalla:** `/settings/users` (`settings-users`)  **Componente:** `web/packages/platform/users/feature/UsersPage.vue`  **Envía:** `GET /api_admin_users?page&per_page&status&search&anagrafica_id&auth_10` (filtro, sin escritura); acciones de fila abren SET-02..06
- **Permisos:** `requiresAdmin`; backend `User_Admin_Controller::check_authorization` exige `is_tmwe_partner()` (403 si no) (`tmwe_api/controller/api/admin/User_Admin_Controller.php:45-55`).
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Búsqueda | v-text-field | No | `?search=` sobre nome, mail, loginn, rag_soc (service L~70) |
| Estado | v-select active/all | No | por defecto `active` (`users.service.ts` list) |
| Partner (chip desde celda) | filtro por clic | No | `anagrafica_id` solo si >0 |
| Tipo (auth_10) S/N | filtro por clic en celda | No | S = web/ERP, N = solo API |
| Selección múltiple | checkbox de tabla | No | habilita acciones masivas SET-06 |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-01-01 | Filtro "todos" incluye borrados lógicos | status=all | aparecen usuarios con `stato='O'`; con `active` no | P2 | Auto |
| SET-01-02 | Filtro por clic en celda partner | clic en "Partner" de una fila | aparece chip de filtro con ese `id_anagrafica`; quitar el chip recarga sin filtro | P2 | Auto |
| SET-01-03 | Filtro tipo API-only | clic en celda auth_10 = N | solo usuarios `auth_10='N'` | P2 | Auto |
| SET-01-04 | Página fuera de rango | página mayor que total tras borrar | el backend ajusta a la última página (`User_Admin_Controller` L~120) | P2 | Auto |
| SET-01-05 | Usuario no admin (cliente) entra por URL | navegar a `/settings/users` con perfil no TMWE | redirige a `/home`; si fuerza la API: 403 | P0 | Auto |

- **Riesgos / dudas:** el selector de selección usa `selected` de `ListingDataView`; no se determinó si la selección persiste entre páginas.

---

### SET-02 · Usuarios: alta
- **Ruta/pantalla:** `/settings/users`, botón "Nuevo"  **Componente:** `users/feature/UserCreateDialog.vue`  **Envía:** `POST /api_admin_users` body `{action:'create', nome, mail, id_anagrafica, ruolo:'', role_ids[], auth_10:'S'|'N'}`
- **Permisos:** solo TMWE (`admin_only`). Roles pedidos pasan por `Role_Assignment_Policy::denial` (solo root concede root).
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Nombre (`nome`) | v-text-field | Sí | `trim() !== ''` (UserCreateDialog L~103); backend: `!$nome` => 400 |
| Email (`mail`) | v-text-field type=email | No | sin regla propia; sin `filter_var` en `create_user` (backend) |
| Partner (`id_anagrafica`) | CmAnagraficaAutocomplete | Sí | `>0`; regla `ruleRequiredId`; el backend no verifica que el partner exista (create_user L~160) |
| Roles iniciales | CmOAuthRoleSelect múltiple | No | lista de roles activos; no excluye `root` |
| Solo API | v-checkbox | No | `api_only` => `auth_10='N'`; si no, `'S'` |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-02-01 | Alta correcta con acceso web | nome, partner, sin roles | 201; diálogo pasa a modo credenciales con `loginn` y `password` en `CredentialsRevealCard`; toast "creado"; la lista recarga | P0 | Auto |
| SET-02-02 | Secreto mostrado una sola vez | cerrar y reabrir el diálogo / recargar la página | la contraseña no se vuelve a mostrar en ninguna pantalla; abrir "Nuevo" parte de formulario vacío (`watch` L~110) | P0 | Auto |
| SET-02-03 | Contraseña no queda en lista/DOM tras cerrar | cerrar diálogo y buscar el texto de la contraseña en DOM y en respuesta de `GET /api_admin_users` | no aparece (la API de listado no devuelve `lpw`) | P0 | Auto |
| SET-02-04 | Usuario API-only | marcar "Solo API" | `auth_10='N'`; backend no concede `erp_operator` (`Erp_Operator_Provisioner::grant_if_eligible`) | P0 | Auto |
| SET-02-05 | Usuario web de partner no-TMWE | partner distinto de 1, `api_only=false` | se concede rol `erp_operator` automáticamente (respuesta `erp_operator_granted:true`) | P0 | Manual |
| SET-02-06 | Rol `root` pedido por admin no-root | seleccionar `root` en roles iniciales | el servidor lo omite en silencio (`continue`); el usuario se crea sin root y la UI no avisa (no lee `roles_assigned`) | P0 | Auto |
| SET-02-07 | Rol base y aditivo a la vez | un rol base + un aditivo | base fija el rol; aditivo se suma; ambos presentes en el detalle (SET-05) | P0 | Auto |
| SET-02-08 | Partner inexistente | `id_anagrafica` forzado a 999999999 por DevTools | no determinado: ver riesgos | P1 | Manual |
| SET-02-09 | Email inválido | `mail='no-es-email'` | no determinado: la UI y `create_user` no validan formato; comprobar si el modelo lo rechaza | P1 | Auto |
| SET-02-10 | Fallo de servidor tras crear | 500 en alta | toast con `e.message`; el diálogo queda en el formulario con los datos | P1 | Manual |

- **Riesgos / dudas:** (1) la UI no informa de roles omitidos (`roles_assigned` ignorado, `UserCreateDialog.vue` submit). (2) Sin validación de email en cliente ni, al parecer, en `create_user` (`User_Admin_Controller.php` ~L160-215). (3) El diálogo es `persistent` pero cerrar en modo credenciales sin copiar pierde la contraseña; solo existe "restablecer" (SET-04).

---

### SET-03 · Usuarios: editar datos básicos
- **Ruta/pantalla:** `/settings/users` (acción de fila "Editar")  **Componente:** `users/feature/UserEditDialog.vue`  **Envía:** `PUT /api_admin_users?id=N` body `{nome, mail?, ruolo?}`
- **Permisos:** solo TMWE.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Login | texto de solo lectura | - | no editable |
| Nombre | v-text-field | Sí | `trim() !== ''` |
| Email | v-text-field type=email | No | `trim() || undefined`: no puede vaciarse (si queda vacío no se envía y se conserva el valor anterior) |
| Rol legado (`ruolo`) | v-text-field | No | mismo comportamiento: vacío = no se envía |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-03-01 | Edición correcta | cambiar nombre | 200, toast, lista recarga con el nuevo nombre | P1 | Auto |
| SET-03-02 | Vaciar el email | borrar `mail` y guardar | el cliente no envía `mail`; el email anterior persiste (comportamiento a confirmar con producto) | P1 | Auto |
| SET-03-03 | Vaciar `ruolo` | borrar rol legado | idem: no se puede limpiar | P2 | Auto |
| SET-03-04 | Editar usuario con rol `root` por admin no-root | abrir edición del usuario root | el backend no comprueba root en `update_user`: guarda sin error (ver riesgos) | P0 | Manual |
| SET-03-05 | Usuario borrado entre apertura y guardado | borrar en otra pestaña y guardar | 404 "User not found"; toast; diálogo permanece | P2 | Manual |

- **Riesgos / dudas:** no hay protección de root en `update_user` (`User_Admin_Controller.php` ~L296-390): cualquier TMWE puede cambiar nombre/email de root; el email permite recuperación de cuenta si existe flujo de reset por correo (no determinado).

---

### SET-04 · Usuarios: restablecer contraseña
- **Ruta/pantalla:** `/settings/users` y `/settings/users/:id`  **Componente:** `users/feature/ResetPasswordDialog.vue`  **Envía:** `POST /api_admin_users` body `{action:'reset_password', user_id}`
- **Permisos:** solo TMWE; el backend acepta cualquier `user_id` sin comprobar tenant ni rol (comentario en `User_Admin_Controller.php:46-48`).
- **Campos:** sin campos; paso 1 confirmación con aviso (`users.reset_password_warn`), paso 2 muestra la contraseña nueva en `CredentialsRevealCard` (solo password).
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-04-01 | Reset correcto | confirmar | 200 con `password`; se muestra una vez con botón copiar; la contraseña anterior deja de valer (login con la antigua falla) | P0 | Manual |
| SET-04-02 | Secreto no persiste | cerrar y reabrir el diálogo | vuelve al paso de confirmación; la contraseña no se recupera | P0 | Auto |
| SET-04-03 | Cancelar no ejecuta | Cancelar en paso 1 | sin petición `POST` | P0 | Auto |
| SET-04-04 | Doble clic en "Restablecer" | doble clic rápido | una sola petición (botón `loading`); no se generan dos contraseñas | P0 | Auto |
| SET-04-05 | Reset del usuario root por admin no-root | `user_id` de un usuario con rol `root` | no hay comprobación en el controller: la petición tiene éxito (escalada de privilegios, ver riesgos) | P0 | Manual |
| SET-04-06 | Usuario inactivo/borrado | `user_id` con `stato='O'` | 404 "User not found or inactive"; toast de error y el diálogo se cierra | P1 | Auto |
| SET-04-07 | Copiar sin permisos de portapapeles | `navigator.clipboard` rechazado | toast `common.copy_failed`, la contraseña sigue visible | P2 | Manual |

- **Riesgos / dudas:** **posible escalada**: `reset_password` no aplica `Role_Assignment_Policy` ni excluye root, por lo que un administrador TMWE sin rol root podría tomar la cuenta de un root (`User_Admin_Controller.php:270-291`). No se envía aviso al usuario afectado en el código leído (no determinado).

---

### SET-05 · Usuario: ficha de detalle y panel de seguridad
- **Ruta/pantalla:** `/settings/users/:id(\d+)`  **Componentes:** `users/feature/UserDetailPage.vue`, `UserSecurityPanel.vue`, `anagrafiche/components/AuthFlagsEditor.vue`, `ContactApiRolesEditor.vue`  **Envía:** `PUT /api_admin_users?id=N` (datos + flags `auth_*`), `GET/POST/PUT/DELETE` de `/api_admin_user_roles` (rol base y aditivos), `DELETE /api_admin_users?id=N` (borrado lógico)
- **Permisos:** `requiresAdmin`; el selector de rol base oculta roles `internal_only` si el usuario no es de anagrafica 1 (`UserSecurityPanel.vue` `apiRoleInternalOnlyMode`).
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Nombre / email / rol legado (edición en línea) | text-fields con Editar/Guardar/Cancelar | nome sí | como SET-03 |
| Flags `auth_10..auth_22` | `AuthFlagsEditor` (checkboxes S/N) | No | solo se envían los que difieren del baseline; whitelist backend `auth_10..auth_24`, `nome`, `mail`, `ruolo`, `id_sede_interna` (`User_Admin_Controller.php:~358`) |
| Rol base API | CmOAuthRoleSelect + Guardar / Revocar | No | `exclude-names=ADDON_ROLE_NAMES`; revocar pide `askDanger` |
| Roles aditivos | `ContactApiRolesEditor` (chips cerrables + selector) | No | solo los que el servidor lista como `grantable_roles`; chips no `removable` para los base |
| Clients OAuth del usuario | lista + botón "Gestionar rol" | No | abre `OAuthClientRoleDialog` (SET-08) |
| Restablecer contraseña / Eliminar | botones | - | SET-04; borrado con `confirm.ask` variante danger |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-05-01 | Cambiar un flag `auth_*` | activar `auth_18` y guardar | `PUT` solo con `{auth_18:'S'}`; toast; recarga del perfil; se refresca la vista previa de permisos efectivos; queda registro en auditoría (SET-11) | P0 | Auto |
| SET-05-02 | Botón guardar flags sin cambios | no tocar nada | botón deshabilitado y texto "sin cambios" | P1 | Auto |
| SET-05-03 | Flags con `auth_10` | pasar `auth_10` S -> N | backend `sync_erp_operator` retira `erp_operator`; la respuesta trae `erp_operator`; permisos efectivos cambian | P0 | Manual |
| SET-05-04 | Asignar rol base | elegir `findair_full` y Guardar | `POST /api_admin_user_roles?user_id=` ; chip del rol base actualizado; permisos efectivos recalculados | P0 | Auto |
| SET-05-05 | Rol solo interno a usuario externo | usuario de partner != 1, rol `internal_only` | el selector no lo ofrece; si se fuerza: 409 `ROLE_NOT_ASSIGNABLE`, toast con el mensaje de `roleConflictMessage` | P0 | Auto |
| SET-05-06 | Conceder `root` sin ser root | rol `root` por API | 403 `ROLE_ROOT_ONLY` ("Solo un usuario root puede conceder o retirar el rol root") | P0 | Auto |
| SET-05-07 | Retirar rol base | Revocar + confirmar | `DELETE`; chip "sin rol"; cancelar en el diálogo no envía nada | P0 | Auto |
| SET-05-08 | Retirar rol base del propio usuario/root | revocar el rol de root | no determinado si el servidor lo impide; comprobar | P0 | Manual |
| SET-05-09 | Quitar un rol aditivo con `removable=false` | chip de rol heredado | el chip no es cerrable; por API: 409 (`User_Role_Admin_Controller` L~139) | P0 | Auto |
| SET-05-10 | Eliminar usuario | Eliminar + confirmar | `DELETE ?id=`; borrado lógico `stato='O'`; navega al listado; no hay comprobación de auto-borrado ni de root | P0 | Manual |
| SET-05-11 | Error al guardar rol tras recargar perfil | respuesta 500 | toast; selector conserva la selección sin guardar; `apiRoleDirty` sigue activo | P1 | Manual |

- **Riesgos / dudas:** `UserSecurityPanel.vue` nota que la ruta documentada `api_admin_user_roles_web` da 404 y se usa `api_admin_user_roles` (L~125-130). `delete_user` (`User_Admin_Controller.php:412-432`) no impide borrar al propio usuario ni a un root. `AuthFlagsEditor`: `auth_23/24` no se editan desde la UI aunque la whitelist los acepta.

---

### SET-06 · Usuarios: conceder/retirar un rol en bloque
- **Ruta/pantalla:** `/settings/users` con filas seleccionadas  **Componente:** `users/feature/UserBulkRolesDialog.vue`  **Envía:** por cada usuario `POST /api_admin_user_roles?user_id=` body `{role_id}` (conceder) o `DELETE /api_admin_user_roles?user_id=&role_id=` (retirar), secuencial
- **Permisos:** TMWE; cada petición pasa por `Role_Assignment_Policy`.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Rol | CmOAuthRoleSelect | Sí | botón deshabilitado sin rol; si es array toma el primero |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-06-01 | Conceder rol aditivo a 3 usuarios | 3 seleccionados, rol aditivo | `processed=3`; alerta de resultado; diálogo se cierra a los 1,2 s; lista recarga | P0 | Auto |
| SET-06-02 | Resultado parcial | 3 usuarios, uno ya tiene el rol / rechazado | `processed=2, skipped=1`; alerta amarilla/verde según `processed>0`; no se informa del motivo por usuario | P0 | Auto |
| SET-06-03 | Conceder `root` sin ser root | rol root a N usuarios | las N peticiones fallan con 403 y se cuentan como "skipped"; toast de éxito con `n=0` (confuso) | P0 | Auto |
| SET-06-04 | Retirar rol base | rol base, `revoke` | API rechaza (409) y se cuenta como skipped | P0 | Auto |
| SET-06-05 | Selección vacía | sin filas | acciones masivas no visibles/deshabilitadas | P2 | Auto |
| SET-06-06 | Cancelar a mitad de lote | cerrar diálogo durante el proceso | el lote continúa (no hay cancelación); no determinado el estado final mostrado | P1 | Manual |

- **Riesgos / dudas:** `toast.success` se emite siempre, incluso con `processed=0` (`UserBulkRolesDialog.vue` execute). Errores por usuario descartados (`bulkAssignRole` solo cuenta).

---

### SET-07 · OAuth clients: listado, filtros y detalle/edición
- **Ruta/pantalla:** `/settings/oauth-clients`  **Componente:** `oauth_clients/feature/OAuthClientsPage.vue` (filtros + diálogo de detalle)  **Envía:** `GET /api_admin_external_clients?status&tier`; detalle: `PUT /api_admin_external_clients?id=N` body `{client_name, company_name, contact_email?, tier}`
- **Permisos:** `requiresAdmin`; backend admin-only (`External_Client_Admin_Controller`).
- **Campos (filtros):** búsqueda (local), estado (active/disabled, recarga), tier (recarga), tipo (internal/external, local), interruptor "solo sin actividad" (`STALE_AFTER_DAYS`, local).
- **Campos (detalle):**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| client_id | texto solo lectura + copiar | - | |
| Nombre cliente | v-text-field | Sí | `trim()` no vacío (`detailFormValid`) |
| Empresa | v-text-field | Sí | `trim()` no vacío |
| Email de contacto | v-text-field type=email | No | `trim() || undefined` (no se puede vaciar) |
| Tier | v-select standard/premium/enterprise | Sí | el backend documenta `standard|premium`; `enterprise` solo aparece en el mapa de rate limits |
| Orígenes/IP/scopes | solo lectura | - | `listText` acepta JSON o texto |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-07-01 | Editar nombre y tier | cambiar tier a premium | 200; lista recarga; rate limit sube (60 -> 300 rpm, `External_Client_Admin_Controller` L~469) | P0 | Auto |
| SET-07-02 | Tier enterprise | elegir enterprise | no determinado si el servidor lo valida; rate limit 0 (ilimitado) en el mapa: confirmar intención | P0 | Manual |
| SET-07-03 | Filtro "sin actividad" | activar interruptor | solo clientes con `last_activity` anterior al umbral o nulo; chip "stale" visible | P2 | Auto |
| SET-07-04 | Secreto nunca visible | abrir detalle | el campo secreto muestra solo la nota `detail_secret_hint`; la respuesta del listado no contiene `client_secret` | P0 | Auto |
| SET-07-05 | Guardar sin empresa | vaciar empresa | botón Guardar deshabilitado | P1 | Auto |
| SET-07-06 | Cliente inexistente | id borrado en paralelo | 404 "Client not found"; toast | P2 | Manual |

- **Riesgos / dudas:** tier `enterprise` ofrecido por la UI sin respaldo explícito en el docblock del controller (`External_Client_Admin_Controller.php` ~L20-35: standard|premium).

---

### SET-08 · OAuth clients: alta (provisión), credenciales de un solo uso, rotar, desactivar/reactivar, rol
- **Ruta/pantalla:** `/settings/oauth-clients` y ficha de usuario  **Componentes:** `OAuthClientsPage.vue` (diálogos provisión/credenciales/rotar/estado), `oauth_clients/components/OAuthClientRoleDialog.vue`  **Envía:** `POST /api_admin_external_client` (alta), `POST /api_admin_external_clients?id=N` body `{action:'rotate_credentials'|'reactivate'}`, `DELETE /api_admin_external_clients?id=N` (desactivar), `PUT ...?id=N` con `role_id` (rol)
- **Permisos:** `requiresAdmin`; roles `internal_only` deshabilitados para clients `external`.
- **Campos (alta):**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Usuario propietario | CmUserAutocomplete | Sí | `provFormValid` requiere `user_id`; backend 400 si falta (`External_Client_Provisioning_Controller` L~70) |
| Nombre cliente | v-text-field | Sí | trim no vacío |
| Empresa | v-text-field | Sí | trim no vacío (el backend no la exige) |
| Email contacto | v-text-field type=email | No | sin validación |
| Tier | v-select | Sí (def. standard) | |
| Rol OAuth | CmOAuthRoleSelect | No | si se omite el cliente queda sin rol |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-08-01 | Alta correcta | usuario, nombre, empresa, rol | 201; diálogo de credenciales con `client_id` y `client_secret` (solo lectura, copiar); aviso "no se recuperan"; lista recarga | P0 | Auto |
| SET-08-02 | Secreto mostrado una sola vez | cerrar credenciales, reabrir detalle del cliente | el secreto no aparece en ninguna pantalla ni en `GET /api_admin_external_clients` | P0 | Auto |
| SET-08-03 | Secreto en campo de texto plano | mirar el campo `client_secret` | el campo es `v-text-field` sin `type=password`: visible en pantalla/captura (decisión de diseño a confirmar) | P1 | Manual |
| SET-08-04 | Rotar credenciales | Rotar + confirmar | nuevo `client_id/secret` mostrados; el secreto anterior deja de funcionar (token con el antiguo falla); cancelar no rota | P0 | Manual |
| SET-08-05 | Rotar no refresca la lista | tras rotar | la lista no recarga (`openRotate` no llama `load`); revisar si `last_activity` queda desfasado | P2 | Auto |
| SET-08-06 | Desactivar cliente | Desactivar + confirmar | estado pasa a no activo; botón cambia a "Reactivar"; tokens existentes dejan de valer (comprobar) | P0 | Manual |
| SET-08-07 | Reactivar | Reactivar | `action` va en el body (no en query, por QSA); estado activo | P0 | Auto |
| SET-08-08 | Rol interno a cliente externo | cliente `external`, rol `internal_only` | opción deshabilitada; por API 409 `ROLE_NOT_ASSIGNABLE`, mensaje en `error` del diálogo | P0 | Auto |
| SET-08-09 | Quitar rol del cliente | seleccionar "sin rol" y guardar | el backend ignora `role_id` vacío (`integer_fields`), no se puede limpiar: el rol permanece | P0 | Auto |
| SET-08-10 | `allowed_endpoints` | enviar campo retirado | 410 `ALLOWED_ENDPOINTS_RETIRED` (la UI no lo envía) | P1 | Auto |
| SET-08-11 | Cierre accidental | Esc / clic fuera en credenciales | el diálogo es `persistent`: solo cierra con "Cerrar" | P1 | Auto |
| SET-08-12 | Usuario sin rol suficiente | usuario propietario con rol `findair_basic` + rol de cliente con muchos scopes | scopes efectivos = rol del client intersección rol del usuario (vista en "Scopes efectivos") | P0 | Manual |

- **Riesgos / dudas:** limpiar el rol de un client no es posible desde esta UI (`External_Client_Admin_Controller.php:~288-312`); el diálogo de rol no avisa. El secreto se pinta en un campo no enmascarado.

---

### SET-09 · OAuth clients: asistente "Alta guiada de cliente" (5 pasos)
- **Ruta/pantalla:** `/settings/client-onboarding`  **Componente:** `oauth_clients/feature/ClientOnboardingPage.vue` (+ `CapabilitySelector.vue`)  **Envía:** `GET` contactos del partner; `POST /api_admin_external_client` (paso 4); `POST {basePath}/token` y `GET {basePath}/ext_my_shipments?per_page=1` con las credenciales nuevas (paso 5)
- **Permisos:** `requiresAdmin`.
- **Campos:**

| Paso | Campo | Control | Obligatorio | Reglas |
|---|---|---|---|---|
| 1 | Empresa | CmAnagraficaAutocomplete | Sí | botón Continuar deshabilitado sin valor |
| 2 | Usuario | tabla con radio | Sí | requiere selección; si no hay usuarios: estado vacío |
| 3 | Nombre, empresa | v-text-field | Sí | `step3Valid`: ambos no vacíos y `role_id !== null` |
| 3 | Email, tier (standard/premium) | v-text-field / v-select | No | email de partida = mail del contacto; tier def. standard |
| 3 | Capacidad (rol) | CapabilitySelector | Sí | regla `capability_required` |
| 4 | Resumen + scopes del rol | solo lectura | - | muestra nota de intersección |
| 5 | Probar credenciales | botón | - | token + llamada de ejemplo |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-09-01 | Flujo completo feliz | empresa, usuario, capacidad | pasos 1 a 5; credenciales creadas y prueba de token OK | P0 | Auto |
| SET-09-02 | Cambiar de empresa en paso 1 | volver y elegir otra | `goToUsers` reinicia usuarios y `selectedUserId`; el formulario del paso 3 se rehace con `goToProvision` | P1 | Auto |
| SET-09-03 | Empresa sin contactos | empresa sin usuarios | estado vacío; no se puede continuar | P1 | Auto |
| SET-09-04 | Atrás desde paso 4 conserva datos | volver al 3 | los campos conservan lo escrito | P1 | Auto |
| SET-09-05 | Doble clic en "Crear cliente" | doble clic | una sola creación (botón `provisioning`); no se duplican clients | P0 | Auto |
| SET-09-06 | Paso 5 prueba token | pulsar "Probar" | primer resultado "token" OK; segundo "ext_my_shipments"; fallos muestran `HTTP <status>` | P1 | Manual |
| SET-09-07 | Credenciales visibles tras crear | llegada al paso 5 | se abre el diálogo de credenciales de un solo uso; cerrar no las recupera | P0 | Auto |
| SET-09-08 | Recarga durante el paso 5 | F5 | se pierde el estado y las credenciales (esperado); no hay forma de recuperarlas, solo rotar | P1 | Manual |

- **Riesgos / dudas:** la prueba usa `fetch` directo al `/token` con el secreto en el navegador (`ClientOnboardingPage.vue:~440-470`); no determinado cómo lo atiende el BFF. El campo `provForm.scopes` se envía vacío siempre.

---

### SET-10 · Roles OAuth (plantillas)
- **Ruta/pantalla:** `/settings/oauth-roles`  **Componente:** `oauth_roles/feature/OAuthRolesPage.vue`  **Envía:** `POST /api_admin_oauth_roles`, `PUT /api_admin_oauth_roles`, `DELETE /api_admin_oauth_roles`; catálogo de scopes `GET /api_admin_client_scopes`
- **Permisos:** `requiresAdmin`. Roles de sistema (`is_system=1`) solo se listan con chip SYSTEM, sin editar ni borrar.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Nombre técnico (`role_name`) | v-text-field (deshabilitado en edición) | Sí | `/^[a-z0-9_]+$/` (cliente); backend 409 si ya existe |
| Nombre visible | v-text-field | Sí | `trim()` no vacío |
| Descripción | v-textarea | No | |
| Scopes | rejilla de v-checkbox | Sí (al menos 1) | `form.scopes.length > 0`; backend rechaza scopes desconocidos (400 "Unknown scopes") |
| Restringir endpoints | v-switch + textarea | No | **el backend responde 410** si recibe `allowed_endpoints` no nulo |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-10-01 | Crear rol válido | `soporte_ro`, nombre, 2 scopes | 201; aparece en "Roles personalizados"; contador sube | P0 | Auto |
| SET-10-02 | Nombre inválido | `Soporte RO` / `soporte-ro` | regla de slug marca error; Guardar deshabilitado | P1 | Auto |
| SET-10-03 | Nombre duplicado | `findair_basic` ya existente | 409 "Role name already exists"; toast | P0 | Auto |
| SET-10-04 | Sin scopes | ninguno marcado | Guardar deshabilitado | P1 | Auto |
| SET-10-05 | Activar "Restringir endpoints" | switch + texto | 410 `ALLOWED_ENDPOINTS_RETIRED`; toast de error: la opción de la UI está obsoleta (defecto) | P1 | Auto |
| SET-10-06 | Rol con scopes reservados usado por cliente externo | añadir `admin`/`config:*` a un rol asignado a client externo | 409 `ROLE_IN_USE_BY_EXTERNAL` con lista de clients; toast con `roleConflictMessage` | P0 | Auto |
| SET-10-07 | Borrado de rol en uso | rol con clients/usuarios > 0 | botón Borrar deshabilitado con tooltip de uso; por API 409 `ROLE_IN_USE` y recarga | P0 | Auto |
| SET-10-08 | Borrado de rol libre | confirmar | `DELETE`; desaparece; cancelar no borra | P1 | Auto |
| SET-10-09 | Rol `root` inmutable | listar roles | `root` está en "Sistema" sin editar/borrar; por API PUT con `scopes` => 409 `ROOT_ROLE_MANAGED_BY_CATALOG`; DELETE de sistema => 403 | P0 | Auto |
| SET-10-10 | Editar rol de sistema por API | `PUT` de `display_name` en un rol de sistema | no determinado si se permite; el 409 solo cubre `scopes` de root | P1 | Manual |
| SET-10-11 | Cambios de scopes de un rol en uso | quitar un scope a un rol con usuarios | se aplica de inmediato; los permisos efectivos de esos usuarios cambian (comprobar en SET-12) | P0 | Manual |

- **Riesgos / dudas:** la opción "Restringir endpoints" sigue en la UI aunque el servidor la rechaza con 410 (`OAuthRolesPage.vue` save; `Oauth_Role_Admin_Controller.php:166-170, 211-215`). `allowed_endpoints: null` se envía siempre en la carga útil y pasa por ser `null`.

---

### SET-11 · Auditoría de permisos (consulta)
- **Ruta/pantalla:** `/settings/permission-audit`  **Componente:** `permission_audit/feature/PermissionAuditPage.vue`  **Envía:** solo consulta `GET` (modo por objetivo o por autor)
- **Permisos:** `requiresAdmin`.
- **Campos:** modo de consulta (v-select), tipo de objetivo, usuario / client OAuth / id de rol (`v-model.number`), "cambiado por" (CmUserAutocomplete), límite (number min 1 max 500).
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-11-01 | Deep link desde ficha de usuario | clic en "ver histórico" | abre con `target_type=user&target_id=N` ya aplicado | P1 | Auto |
| SET-11-02 | Cambio de flag deja rastro | cambiar un `auth_*` (SET-05) y consultar | aparece entrada con valor antiguo y nuevo, autor y fecha | P0 | Auto |
| SET-11-03 | Límite fuera de rango | 0, 501 | el campo marca fuera de rango/el servidor acota (no determinado cuál) | P2 | Auto |
| SET-11-04 | Cambiar de tipo de objetivo | user -> client | el selector previo se oculta y se limpia el id | P2 | Auto |

- **Riesgos / dudas:** no se leyó cómo se valida `limit` cuando se escribe a mano un valor mayor de 500.

---

### SET-12 · "Explicar permiso" (simulador authz)
- **Ruta/pantalla:** `/settings/authz-explain`  **Componente:** `authz_explain/feature/AuthzExplainPage.vue` (+ `EffectivePermissionsPreview.vue`)  **Envía:** consulta de solo lectura (explicación de decisión)
- **Permisos:** `requiresAdmin`.
- **Campos:** tipo de objetivo (user/client), cliente o usuario, método HTTP, endpoint (texto; se habilita solo si `trim().length>0`).
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-12-01 | Explicar un endpoint permitido | user con scope, `GET /api_x` | resultado "permitido" con el scope que lo concede | P1 | Auto |
| SET-12-02 | Endpoint denegado | user sin scope | "denegado" con motivo (scope ausente / techo cliente) | P1 | Auto |
| SET-12-03 | Techo cliente intersección usuario | client con rol amplio, usuario con rol básico | scopes efectivos = intersección | P0 | Manual |
| SET-12-04 | Endpoint vacío | solo espacios | botón deshabilitado | P2 | Auto |
| SET-12-05 | No ejecuta la acción | cualquier combinación | la consulta no cambia datos (comprobar que no hay POST de negocio) | P1 | Auto |

- **Riesgos / dudas:** no se detalló el endpoint exacto (leer `authz_explain/services` si se automatiza).

---

### SET-13 · Credenciales de IA (Anthropic/OpenAI), modo TMWE y modo propio
- **Ruta/pantalla:** `/settings/ai-credentials` (pestaña "Partners/Global" y modo propio), también incrustado en ficha de anagrafica  **Componente:** `ai_credentials/feature/AiCredentialsPage.vue` (+ `AiCredentialsCenterPage.vue`, `credentialForm.ts`)  **Envía:** TMWE: `POST/PUT/DELETE /api_admin_ai_credentials`, `POST ... {op:'set_default'|'test'}`; propio: `GET/POST/PUT/DELETE /api_admin_ai_my_credentials`
- **Permisos:** `aiScope: "ai:admin"`; TMWE gestiona cualquiera; un administrador de IA de partner solo su clave (modo propio: sin selector de partner, sin "probar"). La clave es solo escritura: el backend la cifra (AES-256-GCM) y nunca la devuelve; solo `has_key`.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Proveedor | v-select (anthropic/openai) | Sí | en modo propio no editable al editar |
| Partner | CmAnagraficaAutocomplete (clearable) | No | vacío = credencial global; oculto en modo propio/incrustado |
| API key | v-text-field `type=password` con ojo | Sí al crear | 20..512 caracteres, sin espacios (`apiKeyValid`, igual que `validate_api_key`); `autocomplete=new-password`; vacío en edición = conservar |
| Modelo | v-combobox | No | maxlength 100; sugerencias por proveedor |
| Nombre | v-text-field | No | maxlength 100 |
| Predeterminada | v-switch | No | se envía solo si cambió (o en alta) |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-13-01 | Alta de clave global | proveedor, key de 40 car. | 201; fila con chip "clave configurada" (`has_key`); la clave no vuelve en ninguna respuesta | P0 | Auto |
| SET-13-02 | La clave no se precarga | editar la fila | el campo de clave aparece vacío con placeholder "sin cambios"; al guardar sin tocar, el payload no incluye `api_key` | P0 | Auto |
| SET-13-03 | Longitud de key | 19 caracteres / 513 / con espacio interior | Guardar deshabilitado | P0 | Auto |
| SET-13-04 | Mostrar/ocultar clave | clic en el ojo | alterna `password`/`text` solo mientras se edita; al cerrar el diálogo `api_key` se limpia en memoria (`closeForm`) | P0 | Auto |
| SET-13-05 | Duplicado (partner, proveedor) | segunda credencial activa igual | 409 con mensaje de duplicado | P0 | Auto |
| SET-13-06 | Marcar predeterminada | switch en edición | se envía `is_default:'S'`; el resto de ese ámbito pierde el flag (una sola por ámbito) | P1 | Auto |
| SET-13-07 | Mover credencial de ámbito/proveedor | cambiar partner/proveedor de una predeterminada | el servidor pone `is_default='N'` salvo que se reafirme | P1 | Manual |
| SET-13-08 | Probar conexión (solo modo TMWE) | botón Probar con key guardada | llamada real al proveedor (coste mínimo); mensaje ok/fallo; botón deshabilitado sin `has_key`. Solo sandbox / clave de pruebas | P1 | Manual |
| SET-13-09 | Modo propio: ámbito del partner | usuario partner con `ai:admin` | solo ve sus filas; no puede enviar `id_anagrafica` (el payload no lo incluye); alerta de si usa la clave de TMWE o la suya | P0 | Auto |
| SET-13-10 | Modo propio con rol de TMWE/insuficiente | llamar `my_credentials` sin el rol | error `AI_FORBIDDEN` traducido a `own_forbidden` | P0 | Auto |
| SET-13-11 | Eliminar credencial | confirmar | `DELETE`; vuelve a resolverse la de TMWE (alerta efectiva cambia a "tmwe") | P0 | Auto |
| SET-13-12 | Secreto en DOM/red | inspeccionar red tras guardar | ninguna respuesta contiene la clave ni versión parcial | P0 | Auto |

- **Riesgos / dudas:** el filtro por proveedor se aplica en cliente (el backend no filtra). El campo clave se queda en memoria del navegador mientras el diálogo está abierto.

---

### SET-14 · Credenciales ElevenLabs (pestaña Voz) y diagnóstico
- **Ruta/pantalla:** `/settings/elevenlabs-credentials` (redirige a `/settings/ai-credentials?tab=voice`)  **Componentes:** `elevenlabs_credentials/feature/ElevenlabsCredentialsPage.vue`, `ElevenlabsCredentialsPartnerTab.vue`  **Envía:** `POST/PUT/DELETE /api_admin_elevenlabs_credentials` (+ diagnóstico)
- **Permisos:** TMWE; en pestaña de partner, el propio partner (no determinado el scope exacto).
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Perfil | v-select | Sí | no editable al editar |
| Partner | CmAnagraficaAutocomplete | No | |
| API key | `type=password`, maxlength 255 | Sí al crear | en edición solo se envía si hay texto |
| Agent ID | v-text-field maxlength 100 | Sí | `agent_id.trim().length > 0` (formValid) |
| Voz TTS (`tts_voice_id`) | v-text-field maxlength 100 | No | |
| Descripción | v-text-field maxlength 255 | No | |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-14-01 | Alta con key | perfil, agent_id, key | 201; `has_key=true`; la key no vuelve | P0 | Auto |
| SET-14-02 | Edición sin tocar la key | cambiar descripción | payload sin `api_key`; la guardada se conserva | P0 | Auto |
| SET-14-03 | Agent ID vacío | espacios | Guardar deshabilitado | P1 | Auto |
| SET-14-04 | Redirección de la ruta antigua | abrir `/settings/elevenlabs-credentials` | redirige a ai-credentials con `tab=voice` | P2 | Auto |
| SET-14-05 | Diagnóstico de perfil/partner | elegir perfil y partner y diagnosticar | muestra resolución; no cambia datos (llamada a ElevenLabs: solo sandbox) | P1 | Manual |
| SET-14-06 | Duplicado perfil+partner | segunda fila | error del servidor mostrado en toast | P1 | Auto |

- **Riesgos / dudas:** no se leyó el detalle del diagnóstico ni los códigos de error del backend de ElevenLabs.

---

### SET-15 · Agente de voz propio de partner (ElevenLabs)
- **Ruta/pantalla:** `/settings/elevenlabs-my-agent`  **Componente:** `elevenlabs_agents/feature/ElevenlabsPartnerAgentPage.vue`  **Envía:** `/api_partner_elevenlabs_agents` (alta, edición, validar, enviar a revisión)
- **Permisos:** sin meta en el router; lo controla el permiso `elevenlabs_partner_agent` (rol partner_admin) y el servidor limita al propio partner.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Perfil | select | Sí | |
| Agent ID | v-text-field maxlength 70 | Sí | `trim() !== ''` |
| API key | `type=password` maxlength 512 | Sí al crear | solo se envía si hay texto |
| Webhook secret | `type=password` maxlength 200 | No | solo se envía si hay texto |
| Voz TTS / Descripción | v-text-field | No | maxlength 100 / 255 |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-15-01 | Alta del agente propio | perfil, agent_id, api_key | 201; estado inicial borrador; secretos no vuelven | P0 | Auto |
| SET-15-02 | Validar agente | botón Validar | informe con `can_be_approved` y nº de bloqueos; sin cambios de datos | P1 | Manual |
| SET-15-03 | Aislamiento por partner | partner A abre el id de B por URL/API | 403/404; solo filas propias | P0 | Auto |
| SET-15-04 | Edición sin secretos | cambiar descripción | payload sin `api_key`/`webhook_secret` | P0 | Auto |
| SET-15-05 | Usuario sin permiso | rol sin `elevenlabs_partner_agent` | la página carga sin menú pero la API devuelve 403 y se muestra el error | P0 | Auto |

- **Riesgos / dudas:** la ruta no lleva guard de cliente; no determinado cómo se oculta el acceso a quien no tiene el permiso.

---

### SET-16 · Agentes de voz: revisión (admin) y sincronización
- **Ruta/pantalla:** `/settings/elevenlabs-agents` (pestañas Revisión y Sincronizar)  **Componentes:** `elevenlabs_agents/feature/ElevenlabsAgentReviewPage.vue`, `elevenlabs_agent_sync/feature/ElevenlabsAgentSyncPage.vue`  **Envía:** `/api_admin_elevenlabs_review` (approve/reject/suspend/reactivate con notas), `POST /api_elevenlabs_sync`
- **Permisos:** `requiresAdmin`.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Notas de revisión | v-textarea maxlength 2000 | Rechazar, suspender y reactivar | `notesFilled` (trim no vacío) habilita esos botones; Aprobar no lo exige |
| Pestañas de estado | tabs | - | pending_review, approved, suspended, rejected, draft |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-16-01 | Aprobar agente válido | informe `can_be_approved` | pasa a approved; lista cambia de pestaña | P0 | Manual |
| SET-16-02 | Aprobar con bloqueos | informe con `blocking>0` | el botón sigue activo; el servidor debe rechazar (comprobar código/mensaje) | P0 | Manual |
| SET-16-03 | Rechazar sin notas | notas vacías | botón deshabilitado | P1 | Auto |
| SET-16-04 | Suspender/reactivar | con notas | transición registrada con las notas | P0 | Manual |
| SET-16-05 | Sincronizar | confirmar el diálogo | `POST` de sincronización con ElevenLabs (efecto externo): solo sandbox/mock | P1 | Manual |
| SET-16-06 | Cancelar sincronización | Cancelar en el diálogo | sin petición | P2 | Auto |

- **Riesgos / dudas:** Aprobar no pide confirmación ni notas (`ElevenlabsAgentReviewPage.vue:128`).

---

### SET-17 · MFA TOTP (autoservicio)
- **Ruta/pantalla:** `/settings/mfa-setup`  **Componente:** `mfa_setup/feature/MfaSetupPage.vue`  **Envía:** `GET /api_admin_mfa_setup` (estado), `POST` (generar secreto), `POST ?action=verify` (código), `DELETE` (deshabilitar, requiere código)
- **Permisos:** `requiresAdmin` en el router; el backend solo opera sobre el usuario autenticado (no hay endpoint para terceros) (`Mfa_Admin_Controller.php:17-18`).
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Secreto base32 | v-text-field solo lectura + copiar | - | se devuelve solo en `POST` setup |
| URI de aprovisionamiento | texto | - | |
| Código de verificación | v-text-field maxlength 6, `inputmode=numeric`, autofocus | Sí | Verificar solo con `length === 6`; **no restringe a dígitos** |
| Código para deshabilitar | v-text-field maxlength 6 | Sí | idem |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-17-01 | Alta completa | generar secreto, añadir a app, código válido | `verify` OK; `status.enrolled=true`; toast; se crea mfa_session de 5 min | P0 | Manual |
| SET-17-02 | Código incorrecto en verificación | `000000` | el backend responde 401 "Invalid TOTP code"; **el interceptor global trata todo 401 como sesión caducada y redirige al login** (ver riesgos) | P0 | Manual |
| SET-17-03 | Código incorrecto al deshabilitar | código errado | 401 "refusing to disable MFA"; mismo riesgo; MFA sigue activo | P0 | Manual |
| SET-17-04 | Deshabilitar con código correcto | código válido | MFA deshabilitado; vuelve al asistente | P0 | Manual |
| SET-17-05 | Secreto tras verificar | tras verificación correcta | `setupResult` no se limpia: el secreto y el URI permanecen en pantalla y la tarjeta "deshabilitar" no aparece hasta recargar | P0 | Auto |
| SET-17-06 | Regenerar secreto sin verificar | pulsar generar y recargar | `POST` sobrescribe el secreto existente de inmediato (docblock "Overwrites"); el estado ya puede figurar como inscrito sin haber verificado | P0 | Manual |
| SET-17-07 | Caracteres no numéricos | `abcdef` | el botón se habilita (longitud 6); el servidor rechaza | P1 | Auto |
| SET-17-08 | Usuario no admin | perfil no TMWE entra por URL | redirige a `/home` | P1 | Auto |
| SET-17-09 | Secreto no persiste | recargar tras `POST` setup sin verificar | `secret_base32` no vuelve a mostrarse | P0 | Auto |

- **Riesgos / dudas:** (1) `shared-frontend/src/http/bff.ts:143` y `anagrafiche/services/http.ts:73-89` convierten cualquier 401 en redirección a login; los códigos TOTP erróneos devuelven 401 desde el API (`Mfa_Admin_Controller.php:153,190`), salvo que el BFF los traduzca (no determinado). (2) `setupResult` permanece tras verificar (`MfaSetupPage.vue` runVerify). (3) Sin límite de intentos visible en el cliente.

---

### SET-18 · Cuentas SMTP de partner
- **Ruta/pantalla:** `/settings/smtp` (scope `self`, sin `requiresAdmin`) y `/settings/smtp-admin` (`requiresAdmin`, selector de partner)  **Componentes:** `partner_smtp/feature/PartnerSmtpPage.vue`, `PartnerSmtpAccountsPanel.vue`, `PartnerSmtpFormDialog.vue`  **Envía:** `POST/PUT/DELETE` del endpoint de cuentas, `POST {action:'test'}` (prueba con envío de un correo)
- **Permisos:** autoriza el servidor (scopes `smtp:*` y administrador del partner); admin con partner explícito. Contraseña de solo escritura, cifrada; cada cambio queda en `permission_audit_log` y avisa al staff del partner (`service/email/Partner_Smtp_Service.php`).
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Propósito | v-select (default, billing, tracking, crm, alert, reset_password, transactional, other, pec) | Sí | deshabilitado en edición |
| Entorno | production/sandbox | Sí | deshabilitado en edición; una cuenta activa por (propósito, entorno) |
| Servidor | v-text-field | Sí | `required`; backend: host público (`Outbound_Url_Guard`), regex `^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$`, máx. 253 |
| Puerto | v-select 25, 465, 587, 2525 | Sí (def. 587) | `ALLOWED_PORTS` |
| Seguridad | TLS/SSL/NONE | Sí (def. TLS) | |
| Usuario | v-text-field | Sí | máx. 255 (backend) |
| Contraseña | `CmSecretField` | Sí al crear | en edición vacío = conservar; **obligatoria si cambia servidor o usuario** (backend 422) |
| Email remitente | v-text-field type=email | Sí | `FILTER_VALIDATE_EMAIL`, máx. 255; dominios de TMWE reservados solo para partner 1 |
| Nombre remitente / descripción | v-text-field | No | máx. 255 |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-18-01 | Alta correcta | datos válidos | 201; fila con "prueba: nunca"; contraseña no vuelve; aviso al staff | P0 | Auto |
| SET-18-02 | Duplicado propósito+entorno | segunda cuenta igual | 409 `SMTP_DUPLICATE` (con `existing_id`); error mostrado en `formError` | P0 | Auto |
| SET-18-03 | Límite de 20 cuentas activas | alta nº 21 | 422 `SMTP_LIMIT_REACHED` | P1 | Auto |
| SET-18-04 | Servidor interno/privado (SSRF) | `localhost`, `10.0.0.1`, `169.254.169.254` | 422 `VALIDATION_ERROR` en el campo `smtp_server` (`smtpFieldErrors` lo pinta bajo el campo) | P0 | Auto |
| SET-18-05 | Puerto no permitido | 21 por DevTools | 422 "Puertos permitidos: 25, 465, 587, 2525" | P1 | Auto |
| SET-18-06 | Cambiar servidor sin reenviar contraseña | editar servidor, dejar contraseña vacía | el cliente lo permite (regla solo en alta); servidor 422 "Obligatoria al cambiar el servidor o el usuario" bajo el campo contraseña | P0 | Auto |
| SET-18-07 | Dominio reservado como remitente | `x@dominio-tmwe` en partner != 1 | 422 "Ese dominio pertenece a TMWE" | P0 | Auto |
| SET-18-08 | Contraseña de solo escritura | editar cuenta | el campo muestra "contraseña guardada" (placeholder); respuesta no la incluye | P0 | Auto |
| SET-18-09 | Probar cuenta | destinatario = propio correo o contacto del partner | envía UN correo; límite por hora (429 `SMTP_TEST_RATE_LIMITED`, `retry_after` 3600); `last_test_ok` actualizado. Solo con SMTP de pruebas | P0 | Manual |
| SET-18-10 | Destinatario de prueba ajeno | correo externo | 422 "Destinatario no permitido" | P0 | Auto |
| SET-18-11 | Admin sin partner elegido | `/settings/smtp-admin` sin partner | "Nueva cuenta" deshabilitado y mensaje `pick_partner_hint` | P1 | Auto |
| SET-18-12 | Aislamiento entre partners | partner A edita id de B | 404 `SMTP_NOT_FOUND` (`get_owned`) | P0 | Auto |
| SET-18-13 | Borrado de cuenta | eliminar con confirmación | `DELETE`; auditoría registrada; cuenta efectiva vuelve a la de TMWE | P0 | Auto |

- **Riesgos / dudas:** la lista de propósitos del cliente (`partnerSmtp.service.ts:13-22`) debe coincidir con el servidor; el cliente no valida longitudes (máx. 255). La prueba depende de `UPSTREAM_DENY_ACTIONS` si existe en el entorno (no determinado).

---

### SET-19 · Claves WebCargo por país/agente
- **Ruta/pantalla:** `/settings/webcargo-key`  **Componente:** `webcargo_key/feature/WebcargoKeyPage.vue`  **Envía:** `POST/PUT/DELETE api_admin_webcargo_key` (nótese: la constante no lleva `/` inicial)
- **Permisos:** `requiresAdmin`.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| País (`iso_paese`) | v-text-field maxlength 2 | Sí (backend) | `toUpperCase().trim()`; el validador está en el backend (400 con motivo) |
| Agente | CmAnagraficaAutocomplete | Sí (backend) | |
| Key 1 / Key 2 | **v-text-field sin `type=password`** | Sí al crear (backend) | vacío en edición = conservar; el backend nunca devuelve (`has_key1/2`) |
| Terminales | v-text-field "A,B,C" | No | máx. 10, el resto se descarta en silencio (`slice(0,10)`) |
| Principal | v-switch | No | un solo `principale='S'` activo por país: el servidor degrada la anterior |
| B2B | v-switch | No | |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-19-01 | Alta con claves | país IT, agente, key1/key2 | 201; fila con iconos de clave presentes; claves no vuelven | P0 | Auto |
| SET-19-02 | Claves visibles al teclear | escribir key1 | el texto se ve en claro (campo no enmascarado) | P1 | Manual |
| SET-19-03 | Segunda cuenta principal del mismo país | marcar principal | la anterior pasa a no principal (`demote_current_principal`) | P0 | Auto |
| SET-19-04 | Borrar la cuenta principal | borrar | `window.confirm` nativo con texto específico; respuesta con `warning` (origen cotizará con la de Italia) mostrada como toast info | P0 | Manual |
| SET-19-05 | Más de 10 terminales | 12 códigos | se guardan 10; los 2 últimos desaparecen sin aviso | P1 | Auto |
| SET-19-06 | Limpiar un terminal al editar | quitar uno de la lista | `trmN` restante se envía como `''` y no queda valor viejo | P1 | Auto |
| SET-19-07 | ISO inválido | `X1`, `ITA` | 400 del servidor con motivo, mostrado en toast | P1 | Auto |

- **Riesgos / dudas:** `window.confirm` nativo en lugar de `confirm.askDanger` (inconsistente, no automatizable igual); claves no enmascaradas al teclear.

---

### SET-20 · Credenciales e-AWB (agregadores)
- **Ruta/pantalla:** hub, tarjeta e-AWB (módulo de credenciales por país/partner)  **Componente:** `ewb_credentials/feature/EwbCredentialsPage.vue`  **Envía:** `POST/PUT/DELETE /api_admin_ewb_credentials`
- **Permisos:** TMWE (no localizada la ruta propia en `router/index.ts`: ver riesgos).
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| País ISO | v-text-field maxlength 2 | Sí | `length === 2` |
| Partner | CmAnagraficaAutocomplete | No | |
| API key | `type=password` | Sí al crear | `edit || !!api_key.trim()` |
| API secret | `type=password` | No | solo se envía si hay texto |
| Cabecera de autorización | v-text-field maxlength 40 | No | |
| Prefijo | v-text-field maxlength 20 | No | |
| Descripción | v-text-field maxlength 255 | No | |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-20-01 | Alta con clave | IT + key | 201; `has_key=true`; ni key ni secret vuelven | P0 | Auto |
| SET-20-02 | País de 1 o 3 letras | `I`, `ITA` | Guardar deshabilitado | P1 | Auto |
| SET-20-03 | Edición sin tocar secretos | cambiar descripción | payload sin `api_key`/`api_secret` | P0 | Auto |
| SET-20-04 | Duplicado país+partner | segunda fila | error del servidor (código no determinado) | P1 | Auto |
| SET-20-05 | Filtro por país | `IT` | solo filas de IT | P2 | Auto |

- **Riesgos / dudas:** no hay ruta `/settings/ewb-...` en el router leído; la página existe en el paquete (`EwbCredentialsPage.vue`) pero no se verificó desde qué pantalla se monta.

---

### SET-21 · Credenciales de aerolíneas (air carrier)
- **Ruta/pantalla:** `/settings/air-carrier-credentials`  **Componentes:** `air_carrier_credentials/feature/AirCarrierCredentialsPage.vue`, `AirCarrierCredentialsPartnerTab.vue`  **Envía:** `POST/PUT/DELETE /api_admin_air_carrier_credentials`
- **Permisos:** `requiresAdmin`.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Aerolínea | v-select | Sí | `trim().length > 0`; se guarda en minúsculas |
| País | CmCountrySelect | Sí | `length === 2` |
| Entorno | production/sandbox | Sí | |
| Producto API | select | No | |
| Partner | CmAnagraficaAutocomplete | No | |
| URL base | v-text-field maxlength 255 | No | sin validación de formato en cliente |
| OAuth key | v-text-field (visible) | No | |
| OAuth secret | `type=password` | No | solo si hay texto; nunca precargado |
| Customer URN | v-text-field | No | |
| Principal | v-switch | No | |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-21-01 | Alta sandbox | aerolínea, país, sandbox, key/secret | 201; chip secreto configurado; secreto no vuelve | P0 | Auto |
| SET-21-02 | Mismo (aerolínea, país, entorno, partner) | duplicado | error del servidor (código no determinado) | P0 | Auto |
| SET-21-03 | Producción vs sandbox | crear ambos para la misma aerolínea | coexisten; el filtro por entorno los separa | P1 | Auto |
| SET-21-04 | URL base sin esquema | `api.example.com` | no determinado (sin regla en cliente); verificar el servidor | P1 | Manual |
| SET-21-05 | Marcar principal | segunda principal | la anterior deja de serlo (comportamiento a confirmar) | P0 | Manual |
| SET-21-06 | Edición no borra el secreto | guardar sin secreto | el secreto almacenado persiste (`has_secret` sigue true) | P0 | Auto |

- **Riesgos / dudas:** reglas de unicidad y de URL base no determinadas (leer `Air_Carrier_Credentials_Admin_Controller`).

---

### SET-22 · Cuentas Forward Air y autorización
- **Ruta/pantalla:** `/settings/forward-air-accounts`  **Componente:** `forward_air_accounts/feature/ForwardAirAccountsPage.vue`  **Envía:** `POST/PUT/DELETE /api_admin_forward_air_accounts` + diálogo de autorización
- **Permisos:** `requiresAdmin`.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Partner | CmAnagraficaAutocomplete | Sí | no editable en edición |
| Entorno | select | Sí | no editable en edición |
| Alias | v-text-field maxlength 64 | Sí | no vacío |
| Usuario API / Contraseña API | text / password | Sí al crear | en edición vacío = conservar |
| Customer ID | maxlength 32 | Uno de customer_id o bill_to | `customer_id` o `bill_to` no vacíos |
| Bill-to | maxlength 7 | idem | `/^\d{7}$/` si no vacío |
| Principal | checkbox | No | |
| Estado de autorización | select | Sí (solo producción) | no se requiere si `environment != production` |
| Referencia de autorización | maxlength 128 | Sí si el estado exige | `authorization_ref` y `received_at` no vacíos |
| Recibido / vence | date | | |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-22-01 | Alta sandbox | alias, usuario/clave, bill-to 7 dígitos | 201; sin autorización requerida | P0 | Auto |
| SET-22-02 | Bill-to de 6 u 8 dígitos | `123456` | Guardar deshabilitado | P1 | Auto |
| SET-22-03 | Sin customer ni bill-to | ambos vacíos | Guardar deshabilitado | P1 | Auto |
| SET-22-04 | Autorización en producción | marcar autorizada sin referencia | botón deshabilitado hasta tener ref + fecha | P0 | Auto |
| SET-22-05 | Fecha de vencimiento anterior a la de recepción | vence < recibido | no determinado: sin regla visible en cliente | P1 | Manual |
| SET-22-06 | Edición no modifica partner/entorno | abrir edición | campos deshabilitados | P1 | Auto |
| SET-22-07 | Secreto no vuelve | ver respuestas | `api_password` ausente | P0 | Auto |

- **Riesgos / dudas:** no se verificó el enmascarado en el backend (`Forward_Air_Accounts_Admin_Controller`).

---

### SET-23 · Credenciales de servicios de transportistas (pestaña de partner)
- **Ruta/pantalla:** pestaña dentro de ficha de anagrafica (también `air_provider_accounts/feature/AnagraficaCredenzialiSection.vue`)  **Componente:** `service_credentials/feature/ServiceCredentialsPartnerTab.vue`  **Envía:** `POST/PUT/DELETE /api_admin_service_credentials`
- **Permisos:** TMWE (`admin_only`); el backend enmascara secretos (`mask_secrets`, nunca llegan al cliente).
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Transportista | v-select | Sí | no editable al editar |
| Entorno | v-select | Sí | |
| Nº de cuenta, usuario, código cliente | v-text-field | No | |
| Contraseña, OAuth client secret, API key | `type=password` | No | vacíos en edición = no se envían (`delete payload.x`) |
| OAuth client id | v-text-field | No | |
| País (maxlength 2), CP, moneda (maxlength 3) | v-text-field | No | sin normalización a mayúsculas visible |
| Descripción | v-textarea | No | |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-23-01 | Alta con tres secretos | cuenta, password, client secret, api key | 201; ningún secreto en la respuesta | P0 | Auto |
| SET-23-02 | Edición sin secretos | cambiar CP | no se envían campos de secreto; los guardados persisten | P0 | Auto |
| SET-23-03 | Duplicado transportista+entorno | segunda fila | error del servidor (4xx) mostrado | P1 | Auto |
| SET-23-04 | Moneda en minúsculas | `eur` | no determinado si se normaliza | P2 | Auto |
| SET-23-05 | Producción vs sandbox | dos filas | usadas por separado al cotizar/etiquetar (no ejecutar etiquetas reales) | P1 | Manual |

- **Riesgos / dudas:** `formValid` solo exige transportista y entorno: se puede crear una fila sin ninguna credencial.

---

### SET-24 · Cuentas de transportista por proveedor (`fornitori_accnt`)
- **Ruta/pantalla:** pestaña de ficha de anagrafica  **Componente:** `fornitori_accnt/feature/FornitoriAccntPartnerTab.vue`  **Envía:** `POST/PUT/DELETE /api_admin_fornitori_accnt`
- **Permisos:** TMWE; el docblock del servicio avisa de que `pw`/`chiave` viajan en claro (paridad legacy).
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Transportista | v-select | Sí | no editable en edición; los campos visibles dependen del transportista (`showField`) |
| Nº de cuenta | v-text-field maxlength 100 | Según transportista | `showField('id_account')` => no vacío |
| Customer, usuario | maxlength 100 | No | |
| **Contraseña (`pw`)** | v-text-field **sin `type=password`**, precargada | No | maxlength 100 |
| **Clave (`chiave`)** | v-text-field sin enmascarar, precargada | No | maxlength 200 |
| País, sistema métrico, notas | select / text | No | |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-24-01 | Visibilidad de campos por transportista | elegir DHL (3), UPS (7), FedEx IT (8) | DHL: cuenta/usuario/pw; UPS: cuenta/customer/usuario/pw/chiave; los demás ocultos | P1 | Auto |
| SET-24-02 | Secreto en claro en edición | abrir una fila con `pw` | la contraseña aparece precargada y visible en el campo (defecto: contradice "solo escritura") | P0 | Manual |
| SET-24-03 | Respuesta del API incluye `pw`/`chiave` | ver `GET` | los secretos viajan en claro en la respuesta (confirmado en el docblock) | P0 | Auto |
| SET-24-04 | Cuenta obligatoria | UPS sin cuenta | Guardar deshabilitado | P1 | Auto |
| SET-24-05 | Duplicado | mismo transportista/país | error del servidor | P1 | Auto |

- **Riesgos / dudas:** **secretos legados no enmascarados**: `FornitoriAccntPartnerTab.vue:96-106, 299-300` precarga `pw` y `chiave` y los pinta como texto; `Fornitori_Accnt_Admin_Controller.php:221` lo reconoce. Distinto de las demás credenciales (solo escritura).

---

### SET-25 · Delegaciones de credenciales (aerolíneas y WebCargo)
- **Ruta/pantalla:** `/settings/air-carrier-delegation` (no hay entrada en el router leído; ver nota) y pestaña de partner  **Componentes:** `air_carrier_delegation/feature/AirCarrierDelegationPage.vue`, `webcargo_delegation/feature/WebcargoDelegationPartnerTab.vue`  **Envía:** `/api_admin_air_carrier_delegation`, `/api_admin_webcargo_delegation`
- **Permisos:** TMWE.
- **Campos (aerolíneas):**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Aerolínea | v-select | Sí | `trim().length > 0`, minúsculas |
| Entorno | select | Sí | |
| Partner delegado | CmAnagraficaAutocomplete | Sí (previsible) | |
| Partner de credencial | CmAnagraficaAutocomplete | Sí (previsible) | |
| País de origen | CmCountrySelect | Sí | `length === 2` |
| Descripción | maxlength 255 | No | |

(WebCargo: país `length===2`, AV y DQ maxlength 50 obligatorios, país AV opcional.)

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-25-01 | Alta de delegación | delegado, credencial, país | 201; el delegado resuelve con credenciales del otro partner | P0 | Manual |
| SET-25-02 | Delegado = partner de credencial | mismo partner en ambos | no determinado si el servidor lo rechaza | P1 | Manual |
| SET-25-03 | Duplicado | misma aerolínea/país/entorno/delegado | error del servidor | P1 | Auto |
| SET-25-04 | WebCargo AV/DQ vacíos | espacios | Guardar deshabilitado | P1 | Auto |
| SET-25-05 | País de 3 letras | `ITA` | Guardar deshabilitado | P2 | Auto |

- **Riesgos / dudas:** ruta de `AirCarrierDelegationPage` no localizada en el router leído; no se verificó la regla de no autodelegación.

---

### SET-26 · Claves de Google (Maps/Geocoding)
- **Ruta/pantalla:** `/settings/google-keys`  **Componente:** `google_keys/feature/GoogleKeysPage.vue`  **Envía:** `GET /api_admin_google_keys?environment`, `PUT` (guardar), `DELETE` (limpiar)
- **Permisos:** `requiresAdmin`.
- **Campos:** entorno (v-select, recarga), valor de la clave (`type=password`), lista cerrada de claves permitidas (`allowed_keys` del servidor).
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-26-01 | Guardar clave | valor nuevo | `PUT`; la tabla muestra estado "configurada" y fecha; el valor no vuelve (columna valor enmascarada) | P0 | Auto |
| SET-26-02 | Limpiar clave | Limpiar + confirmar | `DELETE`; vuelve a la variable de entorno (nota `env_fallback_hint`) | P0 | Auto |
| SET-26-03 | Cambio de entorno | production -> sandbox | recarga; el diálogo guarda sobre el entorno seleccionado | P1 | Auto |
| SET-26-04 | Valor vacío | guardar vacío | no determinado (sin regla visible en cliente; verificar el servidor) | P1 | Auto |
| SET-26-05 | Clave no permitida | `key_name` fuera de `allowed_keys` por API | 400 | P1 | Auto |

- **Riesgos / dudas:** no se comprobó que el listado devuelva el valor enmascarado (columna "valor"); revisar `GoogleKeysPage.vue` filas.

---

### SET-27 · Centro de IA: presupuestos
- **Ruta/pantalla:** `/settings/ai-center?tab=budgets` (rutas antiguas redirigen)  **Componente:** `ai_admin/feature/AiBudgetsPage.vue`  **Envía:** `PUT/POST` de presupuesto y `DELETE` vía `aiAdminService` (contrato ai-admin/1)
- **Permisos:** `aiScope` por pestaña (`AI_TAB_SCOPES`); la ruta `/settings/ai-center` no lleva meta: la API autoriza.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Partner | text number min 1 | No | vacío = límite global (`partner_id: null`) |
| Funcionalidad | select | Sí (def. copilot) | |
| Periodo | select | Sí (def. month) | |
| Máx. tokens, minutos de voz, coste en céntimos | text number min 0 | No | `parseLimit` valida; error `invalid_limit` si no es entero válido; vacío = sin límite |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-27-01 | Presupuesto por partner | partner 5, copilot, month, 100000 tokens | guardado; aparece en la lista | P0 | Auto |
| SET-27-02 | Límite no numérico / negativo / decimal | `abc`, `-1`, `1.5` | `invalid_limit`; no se envía | P0 | Auto |
| SET-27-03 | Límites vacíos | todos vacíos | se guarda como "sin límite" (confirmar semántica) | P1 | Manual |
| SET-27-04 | Presupuesto global | partner vacío | `partner_id:null` | P0 | Auto |
| SET-27-05 | Duplicado partner+funcionalidad+periodo | repetir | actualiza o 409 (no determinado) | P1 | Auto |
| SET-27-06 | Borrar | confirmar | `DELETE`; cancelar no borra | P1 | Auto |
| SET-27-07 | Efecto en consumo | superar el límite | el copiloto se bloquea (comprobar en otra pantalla; sin llamadas reales al proveedor) | P0 | Manual |

- **Riesgos / dudas:** el campo partner es un id numérico libre (sin autocompletado): partner inexistente no se valida en el cliente.

---

### SET-28 · Centro de IA: filtros (uso, auditoría, interruptores, memoria de voz, salud)
- **Ruta/pantalla:** `/settings/ai-center` (pestañas)  **Componentes:** `ai_admin/components/AiUsagePanel.vue`, `feature/AiAuditPage.vue`, `AiFlagsPage.vue`, `VoiceMemoryPage.vue`, `ElevenlabsHealthPanel.vue`, `MyAiUsagePage.vue`  **Envía:** consultas `GET`; `AiFlagsPage` y `VoiceMemoryPage` pueden escribir (interruptores / olvidar memoria; no leído en detalle)
- **Permisos:** scope por pestaña; la pestaña "Mi uso" es para cualquier usuario.
- **Campos:** fechas desde/hasta (date), funcionalidad, evento, estado, `partner_id` (number min 1), agrupar por, usuario (memoria).
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-28-01 | Rango de fechas invertido | desde > hasta | no determinado: sin validación visible; el servidor devuelve vacío o error | P2 | Auto |
| SET-28-02 | Pestañas por scope | usuario con solo `ai:usage` | solo ve las pestañas permitidas; las demás ocultas | P0 | Auto |
| SET-28-03 | Interruptor de IA de un partner | cambiar un flag | cambio inmediato y auditado (comprobar `AiAuditPage`) | P0 | Manual |
| SET-28-04 | Filtro por partner | id válido | solo datos de ese partner | P2 | Auto |

- **Riesgos / dudas:** no se leyeron en detalle las acciones de escritura de `AiFlagsPage` y `VoiceMemoryPage`.

---

### SET-29 · Tareas programadas (scheduler)
- **Ruta/pantalla:** `/settings/scheduler`  **Componentes:** `scheduler/feature/SchedulerPage.vue`, `components/PayloadDialog.vue`, `JobDetailDialog.vue`, `QueuePanel.vue`  **Envía:** activar/pausar, `runNow` (con `force`), `updateSchedule`, `setCatchUp`, `updatePayload`, `preview`
- **Permisos:** `requiresAdmin`; ejecutar ahora encola trabajo de negocio real (comentario del router); el guard anti-avalancha vive en el backend.
- **Campos (horario):**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Modo | select (interval, daily, weekly, monthly, según `modeItems`) | Sí | limpia campos que no aplican: `active_hours` solo en interval; `active_weekdays` no en monthly |
| Cada N minutos | number min 1 | En interval | |
| Hora de ejecución | time | En no-interval | |
| Día del mes | number min 1 max 28 | En monthly | |
| Franja horaria activa, días de la semana | text / select múltiple | No | |
| Zona horaria | select | Sí | |
| Recuperar ejecuciones perdidas (catch-up) | switch | No | segunda petición si cambia |
| Parámetros (payload) | campos declarados por el backend (`payload_fields`) + editor JSON avanzado | Según tarea | campos `danger` piden confirmación al cambiar; JSON inválido deshabilita Guardar |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-29-01 | Vista previa del horario | cambiar N minutos | tras ~400 ms muestra las 5 próximas ejecuciones calculadas por el servidor | P1 | Auto |
| SET-29-02 | Modo diario con días de semana | seleccionar L-V | se envía `active_weekdays="1,2,3,4,5"` | P1 | Auto |
| SET-29-03 | Cambio de modo a mensual | pasar de interval a monthly | `active_hours` y `active_weekdays` se envían `null` | P1 | Auto |
| SET-29-04 | Día 29-31 | `run_at_day=31` | `max=28` del input; por API el servidor valida (400) | P1 | Auto |
| SET-29-05 | Ejecutar ahora | botón Ejecutar | encola un job; toast "encolado"; solo con la tarea dummy/dry-run o `UPSTREAM_DENY_ACTIONS` | P0 | Manual |
| SET-29-06 | Ejecutar con ejecución previa activa | repetir | respuesta `skipped`; diálogo "forzar"; Cancelar no ejecuta; Confirmar reenvía con `force` | P0 | Manual |
| SET-29-07 | Pausar/activar | interruptor | `is_active` actualizado; al activar se recalcula `next_run_at` | P0 | Auto |
| SET-29-08 | Cambio de campo `danger` | pasar a "live" o quitar dry-run | diálogo de confirmación con los campos cambiados; Cancelar no guarda | P0 | Manual |
| SET-29-09 | JSON avanzado con claves no declaradas | añadir clave inexistente | solo se confirman los campos declarados como `danger`; las claves ajenas pasan sin aviso (ver riesgos) | P0 | Manual |
| SET-29-10 | JSON inválido | texto roto | `jsonError` deshabilita Guardar | P2 | Auto |
| SET-29-11 | Doble clic en Ejecutar | doble clic | una sola petición (`runningId`) | P0 | Auto |

- **Riesgos / dudas:** el modo JSON (`PayloadDialog.vue:188-206`) solo confirma los campos `danger` declarados; claves nuevas no pasan confirmación. `refreshQuiet` traga los errores de fondo.

---

### SET-30 · Importadores masivos (DHL aeropuertos/prioritarios, zonas remotas Freschi)
- **Ruta/pantalla:** `/settings/dhl-import`, `/settings/freschi-import`  **Componentes:** `dhl_import/feature/DhlImportPage.vue`, `ImportResultCard.vue`, `freschi_import/feature/FreschiImportPage.vue`  **Envía:** `POST /api_admin_dhl_airport_import` (multipart, archivo ~1,6 M filas), `POST /api_admin_dhl_priority_import` (JSON `{content}`), `POST /api_admin_freschi_remote_area_import` (JSON `{content, iso}`, todo-o-nada)
- **Permisos:** `requiresAdmin` (backend partner 1).
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Archivo de aeropuertos | v-file-input `.txt` | Sí | se sube sin leer en el navegador |
| Archivo de prioritarios / Freschi | v-file-input | Sí | se lee en cliente: vista previa de las 10 primeras líneas y recuento de líneas no vacías |
| País (`iso`) Freschi | no localizado como campo en la UI leída | - | el servicio lo envía; ver riesgos |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-30-01 | Vista previa de prioritarios | archivo de 100 líneas | muestra 10 líneas y "100 líneas" | P2 | Auto |
| SET-30-02 | Importación correcta | archivo válido (fixture pequeño) | `ImportResultCard` con importadas/fallidas; toast de éxito si `failed === 0` | P0 | Manual |
| SET-30-03 | Freschi con una línea inválida | 1 línea corrupta | todo-o-nada: no se importa nada; informe con la línea errónea; datos previos intactos | P0 | Manual |
| SET-30-04 | Freschi reemplaza datos | importar sobre zonas existentes | aviso `replace_warning` visible antes; las filas anteriores se reemplazan (confirmar alcance) | P0 | Manual |
| SET-30-05 | Archivo vacío / solo líneas en blanco | `\n\n` | botón Importar deshabilitado (`!content`) o informe vacío | P1 | Auto |
| SET-30-06 | Doble clic en Importar | doble clic | una sola importación (`loading`) | P0 | Auto |
| SET-30-07 | Archivo no `.txt` | `.csv`/binario | el `accept` es solo sugerencia; el servidor decide (no determinado) | P1 | Manual |
| SET-30-08 | Importación parcial con fallos | `failed > 0` | toast de error (no de éxito); informe detallado | P1 | Manual |

- **Riesgos / dudas:** no hay confirmación previa a la importación (solo aviso estático para Freschi); no determinado dónde se elige el ISO de Freschi en la UI.

---

### SET-31 · Causales de factura (IVA/exenciones)
- **Ruta/pantalla:** `/settings/invoice-causals`  **Componentes:** `invoice_causals/feature/InvoiceCausalsPage.vue`, `CountryTogglePicker.vue`  **Envía:** `/api_invoice_causals` (`GET ?meta=1`, `POST`, `PUT`, `DELETE`)
- **Permisos:** `requiresAdmin`; las causales son por partner (`id_partner`); TMWE (1) puede editar las de otros (comentario anti-IDOR en `Invoice_Causals_Controller.php:98`).
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Tipo | v-select | Sí | deshabilitado en filas de sistema (`ordine < 20`) |
| Orden | number | No | deshabilitado en filas de sistema; `Number(...) || 0` |
| Clase de cliente base (`tipo_cli_base`) | v-text-field maxlength 10 | No | deshabilitado en sistema |
| Artículo (`art`) | v-text-field maxlength 10 | No | bloquea aliquota/natura/rif si el `art` ya lo usa otra fila |
| Descripción / EN | text | Descripción sí | |
| Aliquota | number | No | sin rango en cliente |
| Natura SDI (`xml_natura`) | v-select (catálogo del servidor) | No | |
| Riferimento normativo | text | No | |
| Países origen/destino | `CountryTogglePicker` (tokens `+XX`, `-XX`, `+ALL`, `+CEE`) | No | habilitado solo si `tipo='IE'` y sin clase de cliente (`isRouteRuleEditable`); regex `^[+-][A-Z]{2}$` |
| Nota de uso | maxlength 250 | No | |
| Sin IVA, Bloqueada | switches | No | |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-31-01 | Fila de sistema | editar causal con `ordine < 20` | tipo, orden y clase deshabilitados con alerta informativa | P0 | Auto |
| SET-31-02 | Regla de ruta IE | tipo IE sin clase | selectores de países habilitados; tokens guardados en `iso_from/iso_to` | P0 | Auto |
| SET-31-03 | Cambiar a tipo no IE | tipo != IE | países deshabilitados y se envían como `''` | P0 | Auto |
| SET-31-04 | Artículo en uso | `art` repetido en otra fila | alerta y bloqueo de aliquota/natura/rif | P0 | Auto |
| SET-31-05 | Aliquota 0 con natura | aliquota 0 y natura N3.x | se guarda; coherencia fiscal no validada en cliente (verificar con facturación) | P0 | Manual |
| SET-31-06 | Aliquota negativa o >100 | `-5`, `150` | no determinado: ni cliente ni controller validan el rango (hallazgo) | P0 | Auto |
| SET-31-07 | Token de país inválido | `+ESP`, `IT` | se descartan por la regex del picker | P1 | Auto |
| SET-31-08 | Bloquear causal en uso | switch bloquea | no aparece al emitir nuevas facturas (comprobar en facturación) | P0 | Manual |
| SET-31-09 | Borrado | confirmar | `DELETE`; no determinado si se impide borrar una causal ya usada en facturas | P0 | Manual |
| SET-31-10 | Edición de causal de otro partner | partner != 1 con id ajeno | 403/404 (anti-IDOR) | P0 | Auto |

- **Riesgos / dudas:** sin validación de rango de aliquota ni de coherencia aliquota/natura; no se verificó el comportamiento al borrar causales usadas.

---

### SET-32 · Formas y plazos de pago
- **Ruta/pantalla:** `/settings/payment-config` (pestañas Métodos y Plazos)  **Componente:** `payment_config/feature/PaymentConfigPage.vue`  **Envía:** `/api_payment_methods`, `/api_payment_schedules` (`POST/PUT/DELETE`)
- **Permisos:** `requiresAdmin`.
- **Campos (método):** descripción (obligatoria: `!methodForm.descr` deshabilita Guardar), descripción EN, tipo (P pago, A cobro, E ambos), código XML (`xml_code`), orden (number).
  **Campos (plazo):** chips de tramos de días (`gg*`), día del mes (`ggmese`, number 0..28), "también clientes" (checkbox S/N), orden.
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-32-01 | Alta de método | descr, tipo, `xml_code` MP05 | 201; aparece con tipo | P0 | Auto |
| SET-32-02 | Descripción vacía | espacios | `!methodForm.descr` no detecta solo espacios: se habilita Guardar (hallazgo menor) | P1 | Auto |
| SET-32-03 | Código XML libre | `XYZ` | sin validación contra los códigos SDI de modalidad de pago (cliente); verificar servidor | P0 | Manual |
| SET-32-04 | Plazo sin ningún tramo | todos `N` | vista previa "sin cuotas"; Guardar está habilitado sin validación | P0 | Auto |
| SET-32-05 | Vista previa | tramos 30/60/90 y ggmese 5 | `30/60/90 g.5`; con 0 muestra `FM` | P1 | Auto |
| SET-32-06 | Día del mes fuera de rango | 31 o -1 | `min/max` solo del control HTML; no hay validación al guardar (`NaN` si vacío) | P0 | Auto |
| SET-32-07 | Borrar método en uso | método asignado a clientes/facturas | no determinado el bloqueo; toast de error si el servidor lo impide | P0 | Manual |
| SET-32-08 | Cancelar el borrado | Cancelar en confirm | sin petición | P1 | Auto |

- **Riesgos / dudas:** `saveSchedule` no valida nada (`PaymentConfigPage.vue:488-512`); `ggmese` puede enviarse vacío/NaN.

---

### SET-33 · Cuentas bancarias del emisor
- **Ruta/pantalla:** `/settings/issuer-bank-accounts` (también scope `config:read`)  **Componente:** `issuer_bank_accounts/feature/IssuerBankAccountsPage.vue`  **Envía:** `POST/PUT/DELETE /api_issuer_bank_accounts`
- **Permisos:** `requiresAdmin` o `config:read`; el controller resuelve el partner de sesión (403 "Partner no resuelto").
- **Campos:** nombre, agencia, IBAN, SWIFT/BIC, ABI, CAB, CIN, cuenta, notas; **todos opcionales en cliente** (sin reglas ni `maxlength`).
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-33-01 | IBAN válido | `IT60X0542811101000000123456` | 201 | P0 | Auto |
| SET-33-02 | IBAN con dígitos de control erróneos | cambiar un dígito | 422 con el mensaje de `Banca_Model::assert_valid_iban` (longitud por país y mod-97); toast con ese texto | P0 | Auto |
| SET-33-03 | IBAN con espacios/minúsculas | `it60 x054 ...` | no determinado si el servidor normaliza | P0 | Manual |
| SET-33-04 | Sin IBAN ni nombre | ambos vacíos | el servidor responde error de "nome o iban requerido" **sin código 4xx** (ver riesgos) | P0 | Auto |
| SET-33-05 | Edición y borrado | confirmar borrado | aparece/desaparece; no determinado si se impide borrar una cuenta usada en facturas | P0 | Manual |
| SET-33-06 | Aislamiento por partner | editar id de otro partner | 404 "Cuenta no encontrada" | P0 | Auto |

- **Riesgos / dudas:** `Issuer_Bank_Accounts_Controller.php:91-92` devuelve el error de "nome o iban requerido" sin `http_response_code(400)` (posible HTTP 200 con cuerpo de error; el cliente podría mostrarlo como éxito: comprobar). La UI no marca ningún campo como obligatorio.

---

### SET-34 · Maestros fiscales y de clasificación (patrón CRUD simple)
Pantallas: Divisas, Causales de IVA, Plan contable, Estudios de sector (fiscal), Sectores de cliente. Patrón CRUD maestro.

- **Ruta/pantalla / Componente / Envía:**

| Pantalla | Ruta | Componente | Endpoint |
|---|---|---|---|
| Divisas | `/settings/currencies` | `currencies/feature/CurrenciesPage.vue` | `PUT /api_master_currencies` (edición en línea, sin alta ni baja) |
| Causales IVA | `/settings/vat-causals` | `vat_causals/feature/VatCausalsPage.vue` | CRUD (endpoint no localizado por patrón; ver código) |
| Plan contable | `/settings/chart-of-accounts` | `chart_of_accounts/feature/ChartOfAccountsPage.vue` | `/api_master_chart_of_accounts` |
| Ajustes fiscales / estudios de sector | `/settings/fiscal-settings` | `fiscal_settings/feature/FiscalSettingsPage.vue` | `/api_master_studi_settore` |
| Sectores de cliente | `/settings/client-sectors` | `client_sectors/feature/ClientSectorsPage.vue` | `/api_master_client_sectors` |

- **Permisos:** `requiresAdmin`.
- **Campos:**

| Pantalla | Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|---|
| Divisas | sigla | text maxlength 4 | Sí | `trim().toUpperCase()`; vacío => toast `common.required` |
| Divisas | nombre | text maxlength 30 | Sí | |
| Divisas | aduana (`dogana`) | select S/N | No | |
| Divisas | cambio | solo lectura (`toFixed(6)`) | - | no editable aquí |
| Causales IVA | tipo | text maxlength 5 | Sí | `requiredRule` |
| Causales IVA | orden | number | No | |
| Causales IVA | descripción | text | Sí | |
| Causales IVA | descripción EN / nota de uso | text (nota maxlength 250) | No | |
| Plan contable | código | text maxlength 30 | Sí | |
| Plan contable | descripción | text maxlength 50 | Sí | |
| Plan contable | detraibilidad, detraibilidad IVA | number min 0 max 100 | No | límites solo HTML; no se valida al enviar |
| Ajustes fiscales | código | text maxlength 30 | Sí | `trim().toUpperCase()` |
| Ajustes fiscales | descripción | text maxlength 50 | Sí | |
| Sectores de cliente | descripción | text maxlength 50 | Sí | |
| Sectores de cliente | estudio de sector | v-select | Sí | `id_studi_settore` requerido |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-34-01 | Divisas: edición en línea | cambiar nombre y aduana | `PUT`; fila vuelve a lectura; el tipo de cambio no se modifica | P0 | Auto |
| SET-34-02 | Divisas: sigla en minúsculas | `eur` | se guarda `EUR` | P0 | Auto |
| SET-34-03 | Divisas: sin alta ni baja | buscar botón Nueva/Borrar | no existen (solo edición) | P2 | Auto |
| SET-34-04 | Divisas: Esc durante edición | cancelar edición | restaura valores sin petición | P2 | Auto |
| SET-34-05 | Plan contable: detraibilidad > 100 | `150` | solo el control HTML avisa; se envía sin validar (hallazgo) | P0 | Auto |
| SET-34-06 | Plan contable: detraibilidad vacía | borrar valor | `v-model.number` entrega `''`; no determinado cómo lo trata el servidor | P0 | Manual |
| SET-34-07 | Plan contable: código duplicado | repetir código | error del servidor mostrado en toast (código no determinado) | P0 | Auto |
| SET-34-08 | Ajustes fiscales: código en minúsculas | `rf01` | guardado `RF01` | P0 | Auto |
| SET-34-09 | Sectores de cliente: sin estudio de sector | sin elegir | regla `requiredRule` bloquea | P1 | Auto |
| SET-34-10 | Borrado de registro en uso | borrar sector/causal usado | no determinado el bloqueo por integridad; toast de error esperado | P0 | Manual |
| SET-34-11 | Búsqueda local | texto | filtra por `trim().toLowerCase()` sin recargar | P2 | Auto |

- **Riesgos / dudas:** sin límites de detraibilidad al enviar; `CurrenciesPage` valida con toast en vez de reglas de campo; las causales de IVA no muestran reglas de fecha/aplicabilidad.

---

### SET-35 · Maestros operativos de carga, tarifas y CRM (patrón CRUD simple)
Pantallas con el mismo esquema (tabla, diálogo, confirmación de borrado). Patrón CRUD maestro; todas `requiresAdmin` (algunas también abren con `config:read`/`suppliers:read`, ver `settingsAccess.ts`).

| Pantalla (ruta) | Componente | Endpoint | Campos y reglas del formulario |
|---|---|---|---|
| Transportistas cargo (`/settings/cargo-carriers`) | `cargo_carriers/feature/CargoCarriersPage.vue` | `/api_cargo_carriers` | sigla* (max 15, mayúsculas), nombre original* (50), nombre (50), tipo, switches logo, vista, rated_agreed, ignora, ignora_b2b |
| Handlers cargo (`/settings/cargo-handlers`) | `cargo_handlers/feature/CargoHandlersPage.vue` | `/api_cargo_handlers` | nombre*, descripción, filtro por partner |
| Cargos de carga (`/settings/cargo-charges`) | `cargo_charges/feature/CargoChargesPage.vue` | `/api_cargo_charges` | sigla* (10, mayúsculas), tipo, elección, etiquetas IT/EN/orig (100), vista, nota |
| Otros cargos AWB (`/settings/awb-other-charges`) | `awb_other_charges/feature/AwbOtherChargesPage.vue` | `/api_master_awb_other_charges` | descripción* (250) |
| Tipos de mercancía (`/settings/good-types`) | `good_types/feature/GoodTypesPage.vue` | `/api_cargo_tipomerce` | sigla* (10, mayúsculas, no editable en edición), sigla2, etiquetas ITA/ENG/SPA (50; al menos una), lista_base, danggoods, dryice (S/N) |
| Tipos de palé (`/settings/pallet-types`) | `pallet_types/feature/PalletTypesPage.vue` | `/api_bancali_tipi` | nombre* (25), code_type (10), nivel, internaz, medidas b1, b2, h, p (texto, max 4) |
| MPL de palé (`/settings/pallet-mpl`) | `pallet_mpl/feature/PalletMplPage.vue` | `/api_bancali_mpl` | code_type* (10), nombre (25), internaz, mpl, qta, p (number min 0) |
| Bloqueos de transportista (`/settings/carrier-blocks`) | `carrier_blocks/feature/CarrierBlocksPage.vue` | `/api_blocco_corrieri` | transportista* (no editable al editar), `tmwe_all`, países solo, fecha desde, fecha hasta |
| Códigos de seguimiento de proveedor (`/settings/supplier-tracking-codes`) | `supplier_tracking_codes/feature/SupplierTrackingCodesPage.vue` | `/api_supplier_tracking_descr`, `/api_supplier_tracking_err` | proveedor (filtro), código*, estado público* (>0), nota; dos formularios (mapeados / sin mapear) |
| Tipos CRM (`/settings/crm-types`) | `crm_types/feature/CrmTypesPage.vue` | `/api_crm_types` | descripción* (200), descripción EN (200), tipo de entrada* |
| Suplementos/recargos extra (`/settings/extracharges`) | `extracharges/feature/ExtrachargesPage.vue` | `/api_master_supplements` | nombre* (50), nombre EN, grupo, orden (numbers), ISO país (2), ayuda IT/EN, 7 switches (sped_ckbox, courier, cargo, autosize, fisso, import, export, blocca) |
| Márgenes por defecto (`/settings/profit-presets`) | `profit_presets/feature/ProfitPresetsPage.vue` | `/api_profit_presets` | tipo, nombre* (50), asegurado mín., % asegurado (>=0), nota, moneda (3), tramos kg/fx/pr (>=0) |
| Estados de seguimiento (`/settings/tracking-statuses`) | `tracking_statuses/feature/TrackingStatusesPage.vue` | `/api_master_tracking_statuses` | descr_ita*, descr_eng, descr_spa, descr_fra, nota |
| Agencias de aduanas (`/settings/customs-agencies`) | `customs_agencies/feature/CustomsAgenciesPage.vue` | `/api_master_agencies` | nombre* (150), partner*, bloquear, okpartners, ISO import/export, 5 emails (maxlength 50, sin validar formato), notas |

(* obligatorio en cliente.)

- **Casos comunes del patrón:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-35-01 | Alta feliz en cada pantalla | datos mínimos obligatorios | 201; aparece en la tabla; toast "creado" | P1 | Auto |
| SET-35-02 | Normalización a mayúsculas | sigla `abc` | se guarda `ABC` (cargo carriers, cargo charges, good types, extracharges ISO) | P1 | Auto |
| SET-35-03 | Campo clave inmutable en edición | abrir edición de good type / carrier block | sigla y transportista deshabilitados | P1 | Auto |
| SET-35-04 | Borrado con confirmación | Borrar + Cancelar / Confirmar | Cancelar no envía `DELETE`; Confirmar elimina y recarga | P1 | Auto |
| SET-35-05 | Borrado de registro referenciado | elemento usado en tarifas/envíos | error del servidor visible en toast; no desaparece (código no determinado) | P1 | Manual |
| SET-35-06 | Acceso por scope sin ser TMWE | usuario con `config:read` (o `suppliers:read`) | solo abre las rutas del mapa de `settingsAccess.ts`; el resto redirige a `/home` | P0 | Auto |

- **Casos específicos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-35-07 | Good types sin etiquetas | las tres vacías | toast `label_required`; no envía | P1 | Auto |
| SET-35-08 | Good types: flags peligrosos | danggoods=S, dryice=S | se guardan; afectan a la validación de envíos de mercancía peligrosa/hielo seco (comprobar en cotización) | P0 | Manual |
| SET-35-09 | Bloqueo de transportista con rango de fechas | `solo_dal` > `solo_al` | sin validación en cliente: no determinado el resultado | P0 | Manual |
| SET-35-10 | Bloqueo `tmwe_all` | activar | el transportista deja de cotizarse para todos; verificar en cotizador (sin reservar) | P0 | Manual |
| SET-35-11 | Agencia de aduanas sin partner | vacío | toast `partner_required` | P1 | Auto |
| SET-35-12 | Emails de agencia | `no-es-email` | sin validación de formato en cliente; maxlength 50 | P1 | Auto |
| SET-35-13 | Códigos de seguimiento: estado público 0 | no elegir | `requiredNumRule` bloquea | P1 | Auto |
| SET-35-14 | Márgenes: tramos negativos | `-5` | `min=0` solo HTML; no determinado el resultado servidor | P0 | Auto |
| SET-35-15 | Márgenes: moneda en minúsculas / 4 letras | `eur` | no se normaliza en cliente (maxlength 3) | P1 | Auto |
| SET-35-16 | Palés: medidas no numéricas | `b1='abc'` | campos de texto (max 4) sin validación numérica | P1 | Auto |
| SET-35-17 | Extracharges: dependencias | `courier` y `cargo` a la vez / `blocca` | efecto en cotizador; verificar en la pantalla de cotización | P0 | Manual |

- **Riesgos / dudas:** muchos campos numéricos y de fecha dependen solo de atributos HTML; no se localizó validación de rango de fechas en `CarrierBlocksPage.vue` ni de número en palés (medidas como texto).

---

### SET-36 · Textos y avisos (ERP, diccionario, B2B, plantillas de documento, avisos del sitio)
- **Ruta/pantalla:** `/settings/erp-texts`, `/settings/erp-dictionary`, `/settings/b2b-texts`, `/settings/document-models`, `/settings/site-notices`  **Componentes:** `erp_texts/feature/ErpTextsPage.vue`, `erp_dictionary/feature/ErpDictionaryPage.vue`, `b2b_texts/feature/B2bTextsPage.vue`, `document_models/feature/DocumentModelsPage.vue`, `site_notices/feature/SiteNoticesPage.vue`  **Envía:** `/api_master_texts`, `/api_master_erp_texts`, `/api_master_templates`, `/api_avviso_sitio` (`api_avviso_sito`)
- **Permisos:** `requiresAdmin` (document-models y site-notices también con `config:read`).
- **Campos:**

| Pantalla | Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|---|
| Textos ERP | clave | text maxlength 80 | Sí | |
| Textos ERP | tipo, idioma | select | Sí | |
| Textos ERP | grupo | text maxlength 80 | No | |
| Textos ERP | label, ayuda, comentario | textarea | No | |
| Diccionario ERP | clave | text maxlength 20 | Sí | |
| Diccionario ERP | tipo, grupo, idioma | select | Sí | |
| Diccionario ERP | label/ayuda/comentario | textarea | No | |
| Textos B2B | idioma base/destino, grupo, "solo sin traducir" | filtros | - | traducción por fila (guarda el texto destino) |
| Plantillas de documento | tipo | text maxlength 10 | Sí | |
| Plantillas de documento | descripción | text maxlength 200 | Sí | |
| Plantillas de documento | idioma, asunto (200), remitente (100) | select / text | No | |
| Plantillas de documento | HTML | textarea | No | switch "purificar HTML" |
| Plantillas de documento | canales mail, fax, sms, carta | checkboxes | No | |
| Avisos del sitio | inicio/fin | `datetime-local` | No | fin posterior al inicio (`stop_before_start`) |
| Avisos del sitio | texto | `HtmlRichEditor` | Sí | `plainText(testo)` no vacío |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-36-01 | Texto ERP nuevo en un idioma | clave, tipo, idioma, label | 201; aparece en el idioma/grupo filtrado | P1 | Auto |
| SET-36-02 | Misma clave en otro idioma | repetir clave, idioma distinto | permitido; misma clave e idioma => error de duplicado (código no determinado) | P1 | Auto |
| SET-36-03 | Texto con HTML/placeholders | `<b>x</b>` o `%s` | se guarda tal cual; revisar escape en la SPA (i18n) | P1 | Manual |
| SET-36-04 | Traducción B2B | traducir una fila | `PUT`; la fila deja de aparecer con "solo sin traducir" | P1 | Auto |
| SET-36-05 | Paginación con filtros | cambiar idioma con página 3 | vuelve a la página 1 (comprobar) | P2 | Auto |
| SET-36-06 | Plantilla: HTML con script | `<script>alert(1)</script>` con "purificar" activado | el servidor purifica al guardar/enviar; verificar | P0 | Manual |
| SET-36-07 | Plantilla: sin purificar | switch desactivado | se guarda sin sanear (riesgo XSS en visor/correo); verificar el visor | P0 | Manual |
| SET-36-08 | Plantilla sin canales | ninguno marcado | permitido sin validación; el documento no se enviaría por ningún canal | P1 | Auto |
| SET-36-09 | Aviso: fin anterior al inicio | stop <= start | error `stop_before_start` bajo el formulario; no envía | P1 | Auto |
| SET-36-10 | Aviso sin texto | solo etiquetas vacías `<p></p>` | error `text_required` | P1 | Auto |
| SET-36-11 | Aviso con etiquetas no permitidas | `<iframe>`, `<img onerror>` | `sanitizeNoticeHtml` conserva solo b, strong, i, em, u, br, p, a, ul, ol, li, span y `href` http(s)/mailto; igual en el backend | P0 | Auto |
| SET-36-12 | Aviso activo visible a clientes | crear con fecha actual | aparece en el sitio público/B2B (verificar fuera de la pantalla) | P1 | Manual |

- **Riesgos / dudas:** en document-models el HTML sin purificar es entrada directa de plantillas de correo; no se verificó dónde se renderiza.

---

### SET-37 · Terminales (aeropuertos/terminales de carga)
- **Ruta/pantalla:** `/settings/terminals`  **Componente:** `terminals/feature/TerminalsPage.vue`  **Envía:** `/api_terminals_admin`, `/api_terminals_address`, `/api_terminal_geocode`
- **Permisos:** `requiresAdmin`.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Filtros: sigla, país, ciudad, tipo, estado | text/autocomplete/select | No | |
| Alta: sigla | text | Sí | `trim().toUpperCase()`; toast `sigla_required` |
| Alta: tipo, país, ciudad, nombre, nombre MAWB, grupo | select / autocomplete / text | No | |
| Dirección: nombre, dirección, CP, ciudad, provincia, país, teléfono | text/autocomplete | No | sin validación de formato |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-37-01 | Alta de terminal | sigla `mad` | se guarda `MAD`; aparece | P1 | Auto |
| SET-37-02 | Sigla duplicada | existente | error del servidor | P1 | Auto |
| SET-37-03 | Geocodificar dirección | botón de geocoding | llama a `/api_terminal_geocode` (consume cuota de Google; solo sandbox/clave de pruebas) | P2 | Manual |
| SET-37-04 | Borrado | confirmar | `DELETE`; no determinado si se impide borrar terminales usados en AWB | P0 | Manual |
| SET-37-05 | Filtros combinados | país + tipo + estado | resultados acotados | P2 | Auto |

- **Riesgos / dudas:** componente grande (713 líneas); no se leyeron todas las acciones (activar/desactivar, dirección).

---

### SET-38 · Configuración geográfica (países, zonas, subzonas, grupos, áreas remotas)
- **Ruta/pantalla:** `/settings/geographic-config`  **Componente:** `geographic_config/feature/GeographicConfigPage.vue`  **Envía:** CRUD de países, zonas por país, subzonas (CP), grupos y áreas remotas (varios endpoints `api_master_*`)
- **Permisos:** `requiresAdmin`.
- **Campos (resumen):** País (nombre IT/EN, CEE, mostrar, días extra y días extra partner); Zona (número, tiempos, nota); Subzona (zona, tiempos, grupo, nota, provincia, lista de CAP como chips, lista de CAP excluidos como chips, bidireccional, inv-presa); Grupo (nombre IT/EN, ayuda IT/EN, orden); Área remota (tipo KO/RM, ciudad, CAP). Filtros por origen (maxlength 2), servicio, proveedor, tipo.
- **Reglas de CAP:** exacto `^[A-Za-z0-9][A-Za-z0-9 ]{0,9}$` o prefijo `^[0-9]{1,4}\?$` (chips en mayúsculas, sin duplicados); **los chips inválidos se descartan en silencio** (`sanitizeCapChips`).
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-38-01 | CAP exacto y comodín | `20121`, `201?`, `SW1A 1AA` | todos aceptados y normalizados a mayúsculas | P0 | Auto |
| SET-38-02 | CAP inválido | `AB-12`, `12345?` | el chip se descarta al guardar sin avisar; la subzona se guarda sin ese CAP (hallazgo) | P0 | Auto |
| SET-38-03 | CAP duplicado | `10100` dos veces | se deduplica | P1 | Auto |
| SET-38-04 | Lista de CAP y CAP excluidos solapados | mismo CP en ambas | no determinado | P0 | Manual |
| SET-38-05 | Días extra negativos o decimales | `-3`, `1.5` | sin validación en cliente | P1 | Auto |
| SET-38-06 | País CEE | cambiar a "no CEE" | afecta a las reglas de IVA/exportación (comprobar en causales y facturación) | P0 | Manual |
| SET-38-07 | Borrado de zona/subzona | confirmar | `askDanger`; cancelar no borra | P1 | Auto |
| SET-38-08 | Filtros por origen en minúsculas | `it` | no determinado si se normaliza | P2 | Auto |

- **Riesgos / dudas:** pantalla de 1507 líneas con 4 diálogos; este inventario cubre las reglas visibles. Pendiente ampliar con los códigos de error del servidor.

---

### SET-39 · Servicios de transportista (tarifas, zonas, suplementos, clonado)
- **Ruta/pantalla:** `/settings/carrier-services` (también con `suppliers:read`)  **Componente:** `carrier_services/feature/CarrierServicesPage.vue`  **Envía:** `/api_supplier_services`, `/api_supplier_service_supplements`, `/api_supplier_zones_web`, `/api_master_country_subzones`, `/api_master_country_zones`, `/api_master_supplements`; clonado de zonas y de suplementos
- **Permisos:** `requiresAdmin` o `suppliers:read`.
- **Campos (resumen):** Alta: descripción, transportista (CmAnagraficaAutocomplete, obligatorio), tipo, sentido (`way`), geozona. Edición: descripción, tipo, sentido, geozona, prioritario, tiempos, hora de corte, recargo de combustible, coeficiente, tramos por km (`zone_km_fasce`, `zone_km_daqui`, multiplicar, duplicar). Subzona: zona, tiempos, nota (maxlength 5), provincias, CAP mostrados, CAP excluidos. Suplemento: peso mín/máx, peso aplicable, bultos/palés, lados (a, b, h, superior), nº de bultos mínimo, perímetro mín/máx, and/or, solo-uno, orden, nota. Clonar zonas desde otro servicio; clonar suplementos desde otro servicio.
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-39-01 | Crear servicio | transportista, tipo, sentido, geozona | 201; la lista se filtra por ese transportista | P0 | Auto |
| SET-39-02 | Crear sin transportista | vacío | la función retorna sin hacer nada (`if (!form.id_fornitore) return`) y sin mensaje | P1 | Auto |
| SET-39-03 | Clonar servicio | confirmar | copia el servicio completo; confirmación previa; cancelar no clona | P0 | Auto |
| SET-39-04 | Clonar zonas desde otro servicio | elegir origen | sobrescribe/añade zonas (mensaje `clone_zones_done` con n); botón deshabilitado sin origen | P0 | Manual |
| SET-39-05 | Suplemento con peso máx < mín | min 20, max 10 | sin validación en cliente: no determinado el resultado servidor | P0 | Manual |
| SET-39-06 | Suplemento: solapamientos | dos rangos de peso solapados | no determinado | P0 | Manual |
| SET-39-07 | Combustible y coeficiente | `fuel_surc=-5`, `coefficiente=0` | sin validación en cliente: efecto en tarifa a verificar en cotizador | P0 | Manual |
| SET-39-08 | Tramos por km | texto mal formado en `zone_km_fasce` | no determinado el formato aceptado | P0 | Manual |
| SET-39-09 | Borrar servicio | `askDanger`; cancelar no borra | tras borrar desde detalle vuelve al listado | P0 | Auto |
| SET-39-10 | Nota de subzona >5 caracteres | `ABCDEF` | `maxlength=5` impide teclearlo | P2 | Auto |

- **Riesgos / dudas:** fichero de 1378 líneas; solo se leyeron los controles. Ninguna regla numérica (pesos, perímetros, coeficiente) se valida en cliente; la ejecución real de tarifas con estos datos es P0 fiscal/económica.

---

### SET-40 · Hub de Configuraciones y acceso por scopes
- **Ruta/pantalla:** `/settings`  **Componentes:** `apps/operations/src/modules/settings/pages/SettingsPage.vue`, `settingsAccess.ts`, `settingsCatalog.ts`, `components/SettingsCard.vue`  **Envía:** solo filtro local de tarjetas
- **Permisos:** `meta.requiresAdmin`; el guard usa `canEnterSettingsHub` y `canOpenAdminRoute(routeName, {isAdmin, access})`: TMWE entra a todo; otros solo si tienen TODOS los scopes de `SETTINGS_ROUTE_SCOPES` (11 rutas: `suppliers:read` para carrier-services, pallet-types, pallet-mpl, carrier-blocks, supplier-tracking-codes; `config:read` para issuer-bank-accounts, cargo-carriers, cargo-handlers, cargo-charges, document-models, site-notices). Tarjetas con `aiScope` usan `canSeeAiScope`.
- **Campos:** búsqueda (v-text-field, filtra por `searchIndex` normalizado), pestañas por grupo, limpiar búsqueda.
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SET-40-01 | Admin TMWE ve todas las tarjetas | perfil `is_admin` | todas las tarjetas | P0 | Auto |
| SET-40-02 | Usuario con `config:read` no TMWE | scope `config:read` | solo ve las tarjetas de `config:read`; otras rutas redirigen a `/home` | P0 | Auto |
| SET-40-03 | Cliente sin scopes | perfil findair_basic | `/settings` redirige a `/home`; ninguna tarjeta | P0 | Auto |
| SET-40-04 | Perfil desconocido | `access.known=false` | falla cerrado (solo `isAdmin===true` entra) | P0 | Auto |
| SET-40-05 | Búsqueda sin resultados | `zzz` | mensaje vacío y botón de limpiar | P2 | Auto |
| SET-40-06 | Búsqueda insensible a acentos | `facturación`/`facturacion` | mismos resultados | P2 | Auto |
| SET-40-07 | Rutas antiguas redirigen | `/settings/elevenlabs-agent-review`, `/settings/ai-usage` etc. | redirige a la pestaña del centro correspondiente | P2 | Auto |
| SET-40-08 | Ruta sin guard de cliente | `/settings/smtp`, `/settings/elevenlabs-my-agent`, `/settings/ai-center` con usuario sin permiso | la SPA monta la pantalla y la API devuelve 403 mostrado como error de sección | P0 | Auto |
| SET-40-09 | Scope que también tienen clientes | ruta añadida con `shipment:read` | el spec debe rechazarlo (STAFF_ONLY_SCOPES solo `config:read` y `suppliers:read`) | P0 | Auto |

- **Riesgos / dudas:** `UpsTokenStatusPage` (`/settings/ups-token-status`), `AirProviderAccountsPage` y `ElevenlabsAgentSync` son pantallas de consulta/acción sin formulario propio (solo botón de refresco/sincronizar); no se detallan.

---

## Inventario

| Prefijo-nn | Formulario | Fichero | Nº casos |
|---|---|---|---|
| SET-01 | Usuarios: listado y filtros | `web/packages/platform/users/feature/UsersPage.vue` | 5 |
| SET-02 | Usuarios: alta | `web/packages/platform/users/feature/UserCreateDialog.vue` | 10 |
| SET-03 | Usuarios: editar datos básicos | `web/packages/platform/users/feature/UserEditDialog.vue` | 5 |
| SET-04 | Usuarios: restablecer contraseña | `web/packages/platform/users/feature/ResetPasswordDialog.vue` | 7 |
| SET-05 | Usuario: detalle y panel de seguridad | `web/packages/platform/users/feature/UserDetailPage.vue`, `UserSecurityPanel.vue` | 11 |
| SET-06 | Usuarios: roles en bloque | `web/packages/platform/users/feature/UserBulkRolesDialog.vue` | 6 |
| SET-07 | OAuth clients: listado y detalle | `web/packages/platform/oauth_clients/feature/OAuthClientsPage.vue` | 6 |
| SET-08 | OAuth clients: alta, credenciales, rotar, rol | `web/packages/platform/oauth_clients/feature/OAuthClientsPage.vue`, `components/OAuthClientRoleDialog.vue` | 12 |
| SET-09 | Asistente de alta de cliente | `web/packages/platform/oauth_clients/feature/ClientOnboardingPage.vue` | 8 |
| SET-10 | Roles OAuth | `web/packages/platform/oauth_roles/feature/OAuthRolesPage.vue` | 11 |
| SET-11 | Auditoría de permisos | `web/packages/platform/permission_audit/feature/PermissionAuditPage.vue` | 4 |
| SET-12 | Explicar permiso | `web/packages/platform/authz_explain/feature/AuthzExplainPage.vue` | 5 |
| SET-13 | Credenciales de IA | `web/packages/platform/ai_credentials/feature/AiCredentialsPage.vue` | 12 |
| SET-14 | Credenciales ElevenLabs | `web/packages/platform/elevenlabs_credentials/feature/ElevenlabsCredentialsPage.vue` | 6 |
| SET-15 | Agente de voz propio de partner | `web/packages/platform/elevenlabs_agents/feature/ElevenlabsPartnerAgentPage.vue` | 5 |
| SET-16 | Revisión y sincronización de agentes | `web/packages/platform/elevenlabs_agents/feature/ElevenlabsAgentReviewPage.vue` | 6 |
| SET-17 | MFA TOTP | `web/packages/platform/mfa_setup/feature/MfaSetupPage.vue` | 9 |
| SET-18 | Cuentas SMTP de partner | `web/packages/platform/partner_smtp/feature/PartnerSmtpFormDialog.vue` | 13 |
| SET-19 | Claves WebCargo | `web/packages/platform/webcargo_key/feature/WebcargoKeyPage.vue` | 7 |
| SET-20 | Credenciales e-AWB | `web/packages/platform/ewb_credentials/feature/EwbCredentialsPage.vue` | 5 |
| SET-21 | Credenciales de aerolíneas | `web/packages/platform/air_carrier_credentials/feature/AirCarrierCredentialsPage.vue` | 6 |
| SET-22 | Cuentas Forward Air | `web/packages/platform/forward_air_accounts/feature/ForwardAirAccountsPage.vue` | 7 |
| SET-23 | Credenciales de servicios de transportistas | `web/packages/platform/service_credentials/feature/ServiceCredentialsPartnerTab.vue` | 5 |
| SET-24 | Cuentas de transportista (fornitori_accnt) | `web/packages/platform/fornitori_accnt/feature/FornitoriAccntPartnerTab.vue` | 5 |
| SET-25 | Delegaciones de credenciales | `web/packages/platform/air_carrier_delegation/feature/AirCarrierDelegationPage.vue`, `webcargo_delegation/feature/WebcargoDelegationPartnerTab.vue` | 5 |
| SET-26 | Claves de Google | `web/packages/platform/google_keys/feature/GoogleKeysPage.vue` | 5 |
| SET-27 | Centro de IA: presupuestos | `web/packages/platform/ai_admin/feature/AiBudgetsPage.vue` | 7 |
| SET-28 | Centro de IA: filtros | `web/packages/platform/ai_admin/components/AiUsagePanel.vue`, `feature/AiAuditPage.vue`, `AiFlagsPage.vue`, `VoiceMemoryPage.vue` | 4 |
| SET-29 | Tareas programadas | `web/packages/platform/scheduler/feature/SchedulerPage.vue`, `components/PayloadDialog.vue` | 11 |
| SET-30 | Importadores DHL / Freschi | `web/packages/platform/dhl_import/feature/DhlImportPage.vue`, `freschi_import/feature/FreschiImportPage.vue` | 8 |
| SET-31 | Causales de factura | `web/packages/platform/invoice_causals/feature/InvoiceCausalsPage.vue` | 10 |
| SET-32 | Formas y plazos de pago | `web/packages/platform/payment_config/feature/PaymentConfigPage.vue` | 8 |
| SET-33 | Cuentas bancarias del emisor | `web/packages/platform/issuer_bank_accounts/feature/IssuerBankAccountsPage.vue` | 6 |
| SET-34 | Maestros fiscales y de clasificación | `currencies`, `vat_causals`, `chart_of_accounts`, `fiscal_settings`, `client_sectors` (`feature/*Page.vue`) | 11 |
| SET-35 | Maestros operativos de carga y CRM | 14 páginas en `web/packages/platform/{cargo_carriers,cargo_handlers,cargo_charges,awb_other_charges,good_types,pallet_types,pallet_mpl,carrier_blocks,supplier_tracking_codes,crm_types,extracharges,profit_presets,tracking_statuses,customs_agencies}/feature` | 17 |
| SET-36 | Textos y avisos | `erp_texts`, `erp_dictionary`, `b2b_texts`, `document_models`, `site_notices` (`feature/*Page.vue`) | 12 |
| SET-37 | Terminales | `web/packages/platform/terminals/feature/TerminalsPage.vue` | 5 |
| SET-38 | Configuración geográfica | `web/packages/platform/geographic_config/feature/GeographicConfigPage.vue` | 8 |
| SET-39 | Servicios de transportista | `web/packages/platform/carrier_services/feature/CarrierServicesPage.vue` | 10 |
| SET-40 | Hub de Configuraciones | `web/apps/operations/src/modules/settings/pages/SettingsPage.vue`, `settingsAccess.ts` | 9 |

Total: 40 fichas (cubren unas 60 pantallas) y 312 casos.
