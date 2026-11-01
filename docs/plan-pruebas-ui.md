# Plan de pruebas de la UI

> **Estado:** borrador · **Última modificación:** 2026-11-01

Cómo comprobar, perfil por perfil y pantalla por pantalla, que la SPA (`web/apps/operations`) funciona sobre el BFF y respeta los permisos del API. Sale de la lectura de `docs/`, del router y de los tests existentes. **No se arrancó la aplicación ni se ejecutó ninguna prueba al redactarlo.**
## 1. Punto de partida

**Lo que ya existe**
- 45 ficheros `*.spec.ts` en la SPA (Vitest). `plan-migracion.md` §6 cita 392 pruebas a 2026-10-23.
- Puertas de calidad: `vue-tsc --noEmit`, `check:i18n`, `check:raw-text`.
- BFF: 145 pruebas PHPUnit, PHPStan nivel 8 y CS (según `contrato-con-api.md`).
- `bff/bin/probe-routes.php`: sondeo de solo lectura de las rutas GET.

**Lo que falta**
- Recorrido con Playwright: pendiente en `plan-migracion.md` §4C. Hoy solo hay capturas manuales sueltas en `.playwright-mcp/`.
- Guard de acceso no autorizado: sin implementar (`prompt-agente-guard-acceso-no-autorizado.md`).
- Prueba en navegador de `/copilot` y recorrido de pantallas con parámetros (detalle de factura, cliente, cargo).

**Superficie a cubrir** (recuento por `grep` sobre `web/apps/operations/src/router/index.ts`; las rutas con `children` tienen más pantallas de las contadas)
- Unas 37 rutas de primer nivel fuera de Settings, en 19 módulos.
- 61 rutas bajo `/settings`, casi todas con `requiresAdmin`.
- 5 idiomas: es, it, en, de, nl. Tres canales especiales: SSE, descargas y subidas.

## 2. Perfiles de prueba

El permiso efectivo es el techo de la aplicación ∩ el rol de la persona. Las credenciales las facilita el responsable del entorno; este documento no las incluye.

| Clave | Perfil | Señal en `/bff/auth/session` | Qué debe poder hacer |
|---|---|---|---|
| STAFF | Personal TMWE (anagrafica 1). En las pruebas del repo, el usuario `jose` | `capabilities: ["tmwe","clients"]` | Todo el ERP y las rutas `requiresAdmin` que su rol permita |
| PARTNER | Partner real | `capabilities: ["clients","my_org"]` | Operar y ver sus clientes y su organización. Sin Settings de administración |
| ACCT | Administrador de cuenta (`account_admin`) de un cliente o partner | `access.roles` con rol aditivo | Gestionar su cuenta y conceder solo roles de cliente. Hoy la SPA no lo distingue (P03) |
| ROOT | Persona con rol `root` | `access.is_root: true` | Ver y conceder roles de sistema. `root` no se edita desde la SPA |
| SINACC | Cliente sin rol válido (caso `accessoadmin_64ef0f`) | `capabilities: []` | Iniciar sesión y ver solo «No tienes acceso». Ninguna llamada de negocio |
| IMP | STAFF suplantando a un partner (`X-Impersonate-Partner-Id`) | Respuestas con `X-Effective-Partner-Id` idéntico | Ver lo que ve el partner. Si la cabecera falta o difiere: 502 `effective_partner_mismatch` |

## 3. Reglas de seguridad de las pruebas

De `plan-migracion.md` §5 y `comparativa-jose-master.md`.

- Prohibido en entornos compartidos: booking, cancelaciones, etiquetas y emails contra transportistas reales (incluido el booking de WebCargo); probar sobre producción; versionar resultados de producción (`*.local.md`).
- `UPSTREAM_DENY_ACTIONS` activo en local (bloquea bookings y cancelaciones). Vacío solo en producción.
- Antes de activar una escritura nueva: prueba de contrato en sandbox con el payload real (crear, leer, actualizar, borrar).
- Los casos que escriben usan registros marcados como prueba y fáciles de identificar.
- Cambiar la contraseña de `jose` antes de producción.

## 4. Fases

1. **Preparación.** Montar Playwright en `web/` con sesión guardada por perfil (login PKCE una vez, estado reutilizado). Dejar listos los seis perfiles y datos de prueba en sandbox. Implementar el guard de acceso no autorizado, porque cambia el resultado esperado de AC-08 y AC-09. Confirmar `UPSTREAM_DENY_ACTIONS`.
2. **Humo por perfil (automático).** Para cada perfil, abrir todas las rutas del router y comprobar redirección correcta, ausencia de 5xx y de excepciones de consola. Las rutas con parámetros usan ids de prueba. Se alimenta del router, así que una ruta nueva entra sola.
3. **Flujos críticos.** Los casos P0: acceso, expedición, cargo, facturación, clientes, Copilot e identidad en Settings. Las escrituras corren solo en sandbox.
4. **Permisos y seguridad de la UI.** Matriz ruta × perfil (URL directa, menú, botones), CSRF, sesión caducada, suplantación y límites. Se contrasta con `explain-403.php`.
5. **Transversales.** Idiomas, errores, subidas, descargas, SSE, responsive, teclado y carga de streams.
6. **Regresión en CI.** El humo y los P0 entran en CI junto a PHPUnit, PHPStan, CS, build y typecheck. Falla si el manifiesto cambia sin commit (`bin/regen-spa-manifest.sh`).

## 5. Casos de prueba

Tipo: *Auto* se automatiza con Playwright; *Manual* necesita criterio humano o un dato que no se puede sembrar; *Carga* necesita herramienta de carga.

### Acceso y sesión

| ID | Caso | Resultado esperado | Perfiles | Prio. | Tipo | Depende de |
|---|---|---|---|---|---|---|
| AC-01 | Login completo con PKCE: /bff/auth/login → pantalla del API → /bff/auth/callback | Cookie __Host-sid HttpOnly, SameSite=Lax y Secure en HTTPS. Ningún token en localStorage, sessionStorage ni JS. | STAFF, PARTNER, SINACC | P0 | Auto |  |
| AC-02 | Consultar /bff/auth/session con cada perfil | Devuelve usuario, capabilities y access (roles, scopes, is_root) coherentes con el perfil. Sin tokens en la respuesta. | Todos | P0 | Auto |  |
| AC-03 | Cerrar sesión (POST /bff/auth/logout con CSRF) | La sesión se destruye. Atrás en el navegador no muestra datos. Vuelve al login, no a home. | Todos | P0 | Auto |  |
| AC-04 | Sesión caducada: 401 en una llamada del proxy | Se redirige al login una sola vez, sin bucle y sin perder la pantalla de origen si es posible. | STAFF, PARTNER | P0 | Auto |  |
| AC-05 | Ruta con 401 del backend a un token válido (api_bancali_*, api_supplier_*) | El BFF responde 403 upstream_unauthorized, la sesión sigue viva y la UI muestra un aviso de permiso. | STAFF, PARTNER | P1 | Auto | P10 |
| AC-06 | POST sin X-CSRF-Token, con Origin ajeno o Sec-Fetch-Site cross-site | Rechazado por el BFF. La UI no ofrece ninguna escritura sin token. | STAFF | P0 | Auto |  |
| AC-07 | Sesión que supera las 24 h: el token se renueva | La sesión continúa sin pedir login. Se fuerza caducando el access token en el entorno de pruebas. | STAFF, PARTNER | P1 | Manual | P01 |
| AC-08 | Entrar con capabilities vacías | Aparece «No tienes acceso» al instante, sin parpadeo del dashboard. No se dispara api_courier_kpis, api_cargo_kpis ni api_home_box_indicators. El botón cierra sesión y lleva al login. | SINACC | P0 | Auto | Guard (hoy falla) |
| AC-09 | Entrar con STAFF y con PARTNER tras el guard | El dashboard se monta igual que antes, sin cambio perceptible de tiempo. | STAFF, PARTNER | P0 | Auto | Guard |

### Shell y navegación

| ID | Caso | Resultado esperado | Perfiles | Prio. | Tipo | Depende de |
|---|---|---|---|---|---|---|
| NV-01 | Menú lateral según perfil | STAFF ve todos los dominios. PARTNER no ve Settings de administración. El menú se puebla desde meta.title. | STAFF, PARTNER, ACCT | P0 | Auto |  |
| NV-02 | URL directa a una ruta requiresAdmin (p. ej. /settings/users) | Sin permiso: redirige a home sin montar el componente, ni un instante. | PARTNER, SINACC, ACCT | P0 | Auto |  |
| NV-03 | Perfil sin resolver o red caída al entrar a una ruta protegida | El guard falla cerrado: redirige, no asume admin. | PARTNER | P1 | Auto |  |
| NV-04 | Ruta con aiScope (/settings/ai-credentials, /settings/ai-center) con y sin scope ai:* | Con scope entra; sin scope vuelve a home. La autorización real sigue siendo del API (AI_FORBIDDEN). | STAFF, PARTNER, ACCT | P1 | Auto |  |
| NV-05 | Redirecciones: / → home, /home/activities → home, /cargo → cargo-list | Aterriza en la pantalla correcta. Una ruta inexistente muestra la vista 404. | STAFF | P2 | Auto |  |
| NV-06 | Carga perezosa por módulo | Entrar a un dominio descarga solo su chunk. Un fallo de red al cargar un chunk muestra un error recuperable. | STAFF | P2 | Auto |  |
| NV-07 | Anfitriones del shell: toasts, confirmación, indicador de ocupado y acciones de notificación | Cada uno aparece, se cierra y no deja capas huérfanas al navegar. | STAFF | P2 | Manual |  |

### Inicio (cockpit)

| ID | Caso | Resultado esperado | Perfiles | Prio. | Tipo | Depende de |
|---|---|---|---|---|---|---|
| HM-01 | Navegar a otra pantalla mientras los KPIs del cockpit cargan | La navegación no espera a los KPIs. Se ejecutan como máximo 3 a la vez. | STAFF, PARTNER | P1 | Auto |  |
| HM-02 | api_home_box_indicators tarda ~9 s | Estado de carga visible y sin bloqueo. Si agota el tiempo, mensaje comprensible. | STAFF | P2 | Auto | P25 |
| HM-03 | KPI que responde 403 para el perfil | Ese widget se degrada. El resto de home sigue operativo. | PARTNER, ACCT | P1 | Auto |  |
| HM-04 | Accesos rápidos de home según perfil | Solo aparecen destinos a los que el perfil puede entrar. | STAFF, PARTNER | P2 | Auto |  |

### Expediciones

| ID | Caso | Resultado esperado | Perfiles | Prio. | Tipo | Depende de |
|---|---|---|---|---|---|---|
| SH-01 | Listado de expediciones: filtros, orden, paginación | Datos coherentes con el ámbito: un PARTNER solo ve los suyos. | STAFF, PARTNER, IMP | P0 | Auto |  |
| SH-02 | Nueva expedición (POST /unified_shipment) | Se crea en sandbox. Validaciones de campos visibles. Un cliente con auth_19=N recibe el veto con mensaje claro. Sin booking real. | STAFF, PARTNER | P0 | Manual | P23 |
| SH-03 | Detalle de expedición: pestañas, contadores, cambio de estado | Cada pestaña carga. El cambio de estado se refleja en cabecera y listado. | STAFF, PARTNER | P0 | Auto |  |
| SH-04 | Crear desde cargo (from-cargo) y recarga (recharge) | Los datos del origen se precargan. El resultado enlaza con el origen. | STAFF | P1 | Manual |  |
| SH-05 | Enlace heredado legacy/:id | Abre el detalle o redirige sin romper la navegación. | STAFF | P2 | Auto |  |
| SH-06 | Descargas (PDF, documentos) por streaming | Descarga completa y con nombre correcto. No se generan etiquetas de transportista reales. | STAFF, PARTNER | P1 | Manual |  |

### Cargo

| ID | Caso | Resultado esperado | Perfiles | Prio. | Tipo | Depende de |
|---|---|---|---|---|---|---|
| CG-01 | Cargo: inicio, listado, nuevo, desde express y detalle | Todas las subrutas cargan y navegan entre sí sin recargar la página. | STAFF, PARTNER | P0 | Auto |  |
| CG-02 | api_cargo_margin_explain responde 502 | Aviso de error comprensible, sin pantalla en blanco ni detalle técnico. | STAFF | P2 | Auto | P25 |
| CG-03 | Costes de proveedor y márgenes | Un PARTNER ve costes de proveedor (decisión de producto 2026-10-19). No ve márgenes ni precios de clientes ajenos. | PARTNER, IMP | P1 | Manual |  |

### Seguimiento y operaciones

| ID | Caso | Resultado esperado | Perfiles | Prio. | Tipo | Depende de |
|---|---|---|---|---|---|---|
| OP-01 | Seguimiento: búsqueda por código y eventos | Muestra eventos ordenados. Código inexistente da mensaje claro. shipment_timing 404 no rompe la vista. | STAFF, PARTNER | P1 | Auto | P25 |
| OP-02 | Giacenze (retenciones): listado y acciones | Acciones disponibles según perfil. Confirmación antes de las destructivas. | STAFF, PARTNER | P1 | Manual |  |
| OP-03 | Consolidata: listado, cotización y detalle | Los candidatos a adjuntar corresponden al cliente del cargo. Hoy el API filtra por el llamante. | STAFF | P1 | Manual | P26 |
| OP-04 | Recogidas: lista, calendario, POD y rutas | Rutas solo para quien tiene requiresAdmin. El calendario respeta la zona horaria. | STAFF, PARTNER | P1 | Auto |  |
| OP-05 | Carga masiva (bulk): subida, validación y progreso | Errores por fila visibles. Un fichero inválido no deja la pantalla en estado de carga. | STAFF, PARTNER | P1 | Manual |  |

### Comunicación e IA

| ID | Caso | Resultado esperado | Perfiles | Prio. | Tipo | Depende de |
|---|---|---|---|---|---|---|
| CM-01 | Copilot: respuesta del chat por SSE | El texto se pinta como texto plano. Un HTML o script en la respuesta no se interpreta. | STAFF, PARTNER | P0 | Auto |  |
| CM-02 | Tarjeta de propuesta: cuenta atrás de 300 s, payload completo, segundo gesto en cancelaciones | La cuenta atrás cuenta desde la recepción. El payload se muestra sin reformatear y se confirma tal cual. | STAFF, PARTNER | P0 | Manual | P27 |
| CM-03 | Confirmar propuesta: éxito y errores | Solo executed:true con readback.status=verified se muestra como hecho. 409 payload_mismatch, 403, 429 y 5xx tienen mensaje propio. | STAFF, PARTNER | P0 | Manual | P27 |
| CM-04 | Intentar op=proponer por HTTP, y copilot_write_enabled=0 | El BFF devuelve 400 invalid_body al primero. El API responde 403 copilot_write_disabled al segundo. | STAFF, PARTNER | P0 | Auto | P29 |
| CM-05 | Límites del Copilot: 20/min por usuario, 60/min por IP, 1 simultáneo | 429 rate_limited o concurrency_limited con Retry-After; 503 capacity_exceeded; si Valkey cae, 503 throttle_unavailable. La UI explica cuándo reintentar. | STAFF | P1 | Auto |  |
| CM-06 | Acciones de navegación del Copilot | Solo las 7 rutas permitidas. Un path obsoleto se ignora. Navega con router, sin recargar. | STAFF, PARTNER | P1 | Auto |  |
| CM-07 | Variable de firma sin configurar | 503 proposal_secret_not_configured con mensaje de «servicio no disponible», sin detalle interno. | STAFF | P2 | Auto | P27 |
| CM-08 | CRM: listado y ficha de pratica | Navegación listado ↔ ficha. El ámbito respeta el perfil. | STAFF, PARTNER | P1 | Auto |  |
| CM-09 | Tickets: listado, detalle y flujo en directo | El stream se abre una vez, se cierra al salir y se reconecta si se corta. api_communication_stream_token con 5xx muestra aviso. | STAFF, PARTNER | P1 | Manual | P25 |
| CM-10 | Plantillas de email | Disponible según useIsTmwe. Previsualiza sin enviar nada. | STAFF, PARTNER | P2 | Auto |  |

### Facturación y cobros

| ID | Caso | Resultado esperado | Perfiles | Prio. | Tipo | Depende de |
|---|---|---|---|---|---|---|
| FN-01 | Facturación: listado, detalle y recálculo | El recálculo exige invoices:write. Sin permiso, el botón no aparece y la llamada daría 403. | STAFF, ACCT | P0 | Manual | P09 |
| FN-02 | Generación de factura automática | Con reglas fiscales cargadas, se genera. Hasta entonces, fallo esperado documentado. | STAFF | P1 | Manual | P36 |
| FN-03 | Descarga del XML SDI y del PDF de factura | Se descarga el fichero correcto. La corrección del contenido es cosa del backend. | STAFF | P2 | Manual | P40 |
| FN-04 | Cobros: antigüedad, recordatorios y conciliación | Las tres pantallas cargan. Los recordatorios piden confirmación y no envían correo real en pruebas. | STAFF, PARTNER | P1 | Manual |  |
| FN-05 | Proforma: listado y fichero | api_proforma_file con 404 muestra aviso, no pantalla rota. | STAFF, PARTNER | P1 | Auto | P25 |
| FN-06 | Contrareembolsos (COD) y su conciliación | La lógica de conciliación coincide con reconciliation.logic.spec.ts. Importes con dos decimales y moneda. | STAFF, PARTNER | P1 | Manual |  |

### Almacén

| ID | Caso | Resultado esperado | Perfiles | Prio. | Tipo | Depende de |
|---|---|---|---|---|---|---|
| WH-01 | Pesaje | Alta de peso y dimensiones con validación. Sin duplicar al pulsar dos veces. | STAFF | P1 | Manual |  |
| WH-02 | Docpack | Genera y descarga el paquete documental. Permiso docpack pendiente (P09). | STAFF | P1 | Manual | P09 |
| WH-03 | Carga de reparto, entregas y manifiestos | Flujo completo con un reparto de prueba. Estados coherentes entre pantallas. | STAFF | P1 | Manual |  |

### Clientes y organización

| ID | Caso | Resultado esperado | Perfiles | Prio. | Tipo | Depende de |
|---|---|---|---|---|---|---|
| CL-01 | Clientes: listado, alta, ficha y pestañas | Alta con validación. La ficha abre por /clients/:id y por /anagrafica/:id con las mismas pestañas. | STAFF, PARTNER | P0 | Auto |  |
| CL-02 | Alta de cliente: contactos base creados | Se crean «Accesso admin» y el contacto base, con permisos acotados a la propia cuenta. La UI no presenta esto como escalada global. | STAFF | P1 | Manual | P38 |
| CL-03 | Listas de precios | Un PARTNER solo ve las que le corresponden. Importes con formato local. | STAFF, PARTNER | P1 | Auto |  |
| CL-04 | Mi organización: ficha, usuarios y sedes | Abre la ficha del partner de la sesión. Sin partnerId resoluble cae al listado, sin error. | PARTNER, ACCT | P1 | Auto |  |
| CL-05 | Un partner abre su propia ficha por partner_id | Accede sin buscarse en el listado de clientes. | PARTNER | P1 | Auto |  |

### Settings

| ID | Caso | Resultado esperado | Perfiles | Prio. | Tipo | Depende de |
|---|---|---|---|---|---|---|
| ST-01 | Humo de las 61 rutas /settings | Sin 5xx ni excepciones de consola. Las que dan 403 coinciden con explain-403.php. | STAFF | P1 | Auto |  |
| ST-02 | Hub de Settings | STAFF entra. PARTNER solo ve las tarjetas permitidas. SINACC no llega. | STAFF, PARTNER, ACCT | P0 | Auto |  |
| ST-03 | Usuarios: ficha, rol base y roles aditivos | La UI edita un solo rol (limitación conocida). Un ACCT no puede conceder root ni roles de personal. | STAFF, ACCT, ROOT | P0 | Manual | P03 |
| ST-04 | Aplicaciones y claves | Búsqueda, filtro de latentes y detalles. El secreto se muestra una sola vez al crear o rotar. No hay edición de orígenes ni redirect URIs. | STAFF, ROOT | P1 | Manual | P16 |
| ST-05 | Roles OAuth | El rol root aparece pero no se edita. | STAFF, ROOT | P1 | Manual |  |
| ST-06 | Explicar acceso y Auditoría de permisos | Para un usuario y ruta concretos, muestra la decisión y el motivo. | STAFF | P2 | Manual |  |
| ST-07 | Credenciales de IA en modo propio | La API nunca devuelve la clave. Con clave inválida, mensaje claro. Exige ai:admin. | STAFF, PARTNER | P0 | Manual |  |
| ST-08 | Cuentas SMTP: la del partner y la de administración | La del partner la autoriza el servidor por scope. La de administración exige requiresAdmin. | STAFF, PARTNER | P1 | Auto |  |
| ST-09 | Pantallas de RBAC interno heredado | Siguen cargando. Su estado de «heredado» está claro hasta que el backend decida su retirada. | STAFF | P2 | Manual |  |

### Transversales

| ID | Caso | Resultado esperado | Perfiles | Prio. | Tipo | Depende de |
|---|---|---|---|---|---|---|
| XT-01 | Cambio de idioma entre es, it, en, de y nl | Se aplica sin recargar. Ningún texto queda sin traducir en las pantallas recorridas. | Todos | P1 | Auto |  |
| XT-02 | Textos fijos en el código | check:raw-text no falla. check:i18n no empeora la cifra de pendientes (399 frente a una base de 368 en el último informe). | STAFF | P2 | Auto |  |
| XT-03 | Suplantación de partner | Con X-Impersonate-Partner-Id, la UI muestra el contexto del partner. Cabecera efectiva ausente o distinta: 502 effective_partner_mismatch. Sin permiso: 403 IMPERSONATION_DENIED. | IMP, PARTNER | P0 | Auto | P14 |
| XT-04 | Errores en formato Problem Details | Toast legible y localizado. Sin trazas, rutas internas ni nombres de scope. | Todos | P1 | Auto |  |
| XT-05 | Subidas y cuerpos grandes | Un cuerpo de 20 KB llega entero (regresión de readBody). Por encima del límite, 413 con mensaje claro. | STAFF, PARTNER | P1 | Auto |  |
| XT-06 | Corte de red durante una subida, una descarga o un stream | Estado de error visible, sin duplicar la operación al reintentar. | STAFF | P1 | Manual |  |
| XT-07 | Carga de streams simultáneos | Con N usuarios con SSE abierto, el servidor mantiene capacidad para el tráfico normal. N se fija con MaxRequestWorkers (Copilot: tope global 30). | STAFF | P1 | Carga |  |
| XT-08 | Datos libres con HTML o scripts (notas, nombres, mensajes) | Se muestran como texto en todas las pantallas. Nada se ejecuta. | STAFF, PARTNER | P1 | Auto |  |
| XT-09 | Responsive, teclado y foco | Las pantallas P0 son operables en 1280 px y en 400 px. Diálogos con foco atrapado y cierre con Escape. | STAFF, PARTNER | P2 | Manual |  |

## 6. Bloqueos y dependencias

Peticiones de `contrato-con-api.md` que cambian lo que se puede probar hoy (estado según la verificación del 2026-10-30/31 sobre `tmwe_api` sandbox).

| Petición | Efecto en las pruebas | Qué hacer |
|---|---|---|
| Guard | No existe el componente «No autorizado». AC-08 falla hoy por diseño | Implementarlo antes de la fase 2 o registrar AC-08 como fallo conocido |
| P03 | Sin `me/access` completo la SPA no distingue ACCT ni ROOT. El informe de autenticación (§8) da la fase 1 por hecha en código, sin desplegar | Pruebas de ACCT y ROOT manuales hasta que el API sirva roles y permisos efectivos |
| P23, P29 | Resueltas (P23 en el BFF, P29 en `tmwe_api`), sin probar en sandbox | SH-02 y CM-04 son su prueba de aceptación. Mantener `body_enum` del BFF como segunda barrera |
| P10 | Controladores que devuelven 401 a un token válido (`api_bancali_*`, `api_supplier_*`) | AC-05 comprueba que la sesión no se cierra mientras se corrige |
| P25 | `api_cargo_margin_explain` 502, `api_home_box_indicators` ~9 s, 404 en `rubrica_set_preferred` y `shipment_timing`, 5xx en `api_communication_stream_token` | HM-02, CG-02, OP-01 y CM-09 fijan el mensaje de error esperado |
| P27 | Sin `ELEVENLABS_COPILOT_WRITE_PROPOSAL_SECRET` el Copilot de escritura da 503 | Definirla en el entorno de pruebas antes de CM-02 y CM-03 |
| P36 | Reglas fiscales de TMWE vacías: la factura automática no arranca | FN-02 se ejecuta cuando haya datos; hasta entonces es fallo esperado |
| P40, P41 | SDI con defectos solo de backend (P40). No existe la acción de generar cuotas (P41) | Sin caso de UI para P41. FN-03 solo comprueba la descarga |
| Datos | Hacen falta usuarios SINACC, ACCT, ROOT y un partner con clientes en el entorno de pruebas | Pedir el alta al responsable del backend antes de la fase 2 |

## 7. Criterios de salida

**Para dar la UI por probada**
- 100 % de los casos P0 en verde, o con fallo conocido enlazado a su petición.
- Humo por perfil sin 5xx ni excepciones de consola.
- Ninguna pantalla accesible por URL a quien el menú se la oculta.
- Ningún 403 de negocio disparado por SINACC tras el guard.
- Cinco idiomas sin claves sin traducir en las pantallas tocadas.

**Para pasar a producción**
- Todo lo anterior, en sandbox con el cliente definitivo (rol `app_internal_erp`, no el de desarrollo).
- Prueba de carga de SSE con `MaxRequestWorkers` definido (XT-07).
- Casos P1 abiertos con decisión explícita del responsable.
- Humo y P0 en CI.

## 8. Lo que no se verificó

- No se arrancó la aplicación ni se ejecutó ninguna prueba.
- El recuento de rutas es un `grep` sobre el router, no una enumeración.
- Las cifras de pruebas existentes (392, 145) son las de los documentos, no de una ejecución.
- Los resultados esperados de permisos asumen el modelo de `informe-autenticacion-autorizacion.md`; si el backend lo cambia, revisarlos.
- El contrato con el API pide revisión humana de su clasificación: comprobar cada petición antes de actuar sobre ella.

## 9. Entorno local y ejecución

Las pruebas de navegador viven en `web/e2e/` (Playwright, fuera del workspace pnpm; se instala con `npm install`). La URL se cambia con `E2E_BASE_URL`.

| Pieza | URL / ruta local | Notas |
|---|---|---|
| SPA + BFF | `https://erp-findair.php8` | Vhost `deploy/apache/erp-findair.php8.conf` (activo y idéntico a la plantilla). Sirve `web/dist` y publica `bff/public` bajo `/bff` |
| Backend | `https://tmwe-api.php7` | Vhost `tmwe-api.php7.conf`, raíz `/var/www/dev/tmwe_api`, solo `app.php`. Aloja también la pantalla de login (`#oauth-login-username`, `#oauth-login-password`) |
| Callback OAuth | `https://erp-findair.php8/bff/auth/callback` | Es `OAUTH_REDIRECT_URI` de `bff/.env` y el cliente 527 debe tenerlo registrado |
| Sesión del BFF | Valkey/Redis en `127.0.0.1:6379` | `REDIS_DSN` de `bff/.env` |
| Sandbox (referencia) | `https://sandbox.erp.findair.it` | `deploy/apache/sandbox.erp.findair.it.conf`; no es el entorno de estas pruebas |

`/etc/hosts` ya resuelve `erp-findair.php8` y `tmwe-api.php7` a `127.0.0.1`. `tmwe-json.php7` es el backend antiguo y no interviene.

**Importante: el vhost sirve `web/dist` ya compilado.** Un cambio en la SPA no se ve hasta reconstruirla:

```bash
cd web/apps/operations
NODE_OPTIONS=--max-old-space-size=6144 ./node_modules/.bin/vite build
```

Con menos memoria el build se cae por falta de heap **después de vaciar `web/dist`**, y el sitio local queda sin SPA hasta repetirlo con éxito.

**Ejecución** (desde `web/e2e/`):

```bash
npm install                      # primera vez; usa los Chromium ya presentes en ~/.cache/ms-playwright
cp .env.e2e.example .env.e2e     # y rellenar las credenciales de cada perfil
npm run test:anon                # sin credenciales: sesión anónima, PKCE, cookie, CSRF, redirección al login
npm run test:smoke               # humo de todas las rutas sin parámetros, por perfil (staff, partner, sinacc)
```

Un perfil sin `E2E_<PERFIL>_USER` y `E2E_<PERFIL>_PASS` se omite. El humo lee las rutas de `apps/operations/src/router/index.ts`, así que una ruta nueva entra sola. El caso AC-08 está marcado `fixme` hasta que exista el guard.

Estado a 2026-11-01: `test:anon` pasa (6 de 6) contra la instalación local. El humo por perfil no se ha ejecutado porque no hay credenciales de prueba cargadas.

### Altas reales del partner (CGO-01 y SHP-01)

`npm run test:alta` (proyecto `partner-alta`, `tests/partner/alta.spec.ts`) crea un cargo y una expedición courier con el usuario partner. **Escribe datos**: no corre sin `E2E_ALLOW_WRITE=1` y sin `E2E_PARTNER_CLIENT` (texto de búsqueda de un cliente propio del partner). Comprueba el botón deshabilitado sin cliente, que una sola letra no busca, la redirección al detalle y que el doble clic envía un único `POST`. No reserva, no genera AWB, no factura ni envía correos. Los IDs creados quedan en `web/e2e/.auth/ids-creados.txt` para anularlos. Antes de lanzarlo hay que confirmar que la base del API es de pruebas. `web/e2e/scripts/rellenar-env.sh` rellena `.env.e2e` del partner leyendo la BD del API local (solo lectura; `--list` muestra usuarios y clientes; `--allow-write` fija `E2E_ALLOW_WRITE=1`). Estado: escrito y listado, sin ejecutar con credenciales.

**Resultados de la primera ejecución con partner (2026-11-01, usuario `JRN9069B` de 123Logistix, BD `tmwe_development`)**

- Altas de cargo (CGO-01) y de expedición courier (SHP-01): pasan. El cargo queda con partner 9069 y propietario del usuario; no hay doble alta con doble clic.
- `detalle-courier.spec.ts`: guardar un bulto con peso y medidas persiste y suma al total; en un borrador nuevo, bultos y peso del encabezado coinciden con las filas guardadas.
- **Hallazgo confirmado:** el detalle courier del partner dispara `403` en `/bff/v1/api_master_currencies` y muestra un aviso de «sin permiso» (petición P58 en `contrato-con-api.md`). El test está marcado `test.fail` y pasará a rojo cuando se corrija.
- **Observación sin reproducir de forma estable:** en un borrador con filas, teclear «Weight (kg)» se perdió una vez (total a 0 kg) y otra se guardó (61 kg) con 4 bultos de cabecera frente a 5 filas. Los datos del borrador `1001086644` quedaron inconsistentes tras pruebas exploratorias. Hay que investigar si el encabezado y las filas tienen dos fuentes de verdad.
- Observación de UI: con la sesión sin preferencia guardada, el menú lateral arranca abierto y su velo tapa el formulario; las pruebas lo cierran (`tests/support/ui.ts`).
- Cada ejecución de `test:alta` crea 3 borradores (cargo, courier y uno de colli). Los IDs quedan en `web/e2e/.auth/ids-creados.txt`.

**Cargo del partner (2026-11-01): MAWB y HAWB** (`tests/partner/cargo-awb.spec.ts`)

- Pasan: número de MAWB (guarda, sobrevive a recargar, PDF real de ~47 KB); alta manual de HAWB tecleando la expedición, edición de peso, descripción y remitente leídos de vuelta del API, listado con expedición/remitente/peso y PDF del HAWB (~15 KB); un segundo HAWB para la misma expedición se rechaza.
- **Fallo real corregido en la SPA:** en `HawbFormModal.vue` y `MawbAddressBlock.vue` los campos usaban `@change="(v: string) => …"` sobre `v-text-field`/`v-textarea`, que reciben el `Event` nativo. Se enviaba `{"isTrusted":true,…}`: el API guardaba «Array» en `goods_descr` y el peso del HAWB quedaba en `null`. Nada de lo tecleado en el formulario del HAWB ni en las direcciones del MAWB se guardaba. Corregido con `utils/fieldValue.ts`.
- **Fallo real corregido:** el listado de HAWB dejaba vacías las columnas Envío, Remitente y Consignatario (`ListingDataView` solo pinta columnas con plantilla `cell.<clave>` y el API devuelve `shipper_nome`/`consignee_nome`).
- **Mismo defecto, confirmado y corregido en `CargoChargesTableV2.vue`:** la edición en línea de una voz de coste enviaba `costo_unit: null`, `nome: {isTrusted…}` y `somma: "S"` siempre (el API respondía HTTP 200 con un error 400 dentro); los precios del cargo no se podían editar. Corregidos también, sin prueba de navegador propia, `CargoOffersTable.vue`, `CargoHawbListV2.vue`, `MawbTactField.vue` y el interruptor de `CargoAccessoriCard.vue` (esta última sí probada en `cargo-importes.spec.ts`). `TerminalsPage.vue` ya leía `e.target.value` y no se tocó. Faltan por probar con datos: ofertas de transportista (CGO-18) y la tarifa TACT del MAWB.
- Hallazgos del API: P59 (los candidatos a consolidar no incluyen las expediciones de los clientes del partner), P60 (el MAWB acepta «abc»; test `test.fail`), P61 y P62.
- No se confirmó el MAWB (acción de cierre) ni se envió correo.
