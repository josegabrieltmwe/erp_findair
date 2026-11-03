# Formularios de Expediciones, seguimiento y retenciones: casos de prueba

> **Estado:** borrador · **Última modificación:** 2026-11-03 · Generado por lectura de código (no se ejecutó nada). Parte de [plan-pruebas-formularios.md](../plan-pruebas-formularios.md). Las reglas de cada ficha salen del código citado; lo marcado «no determinado» no se pudo confirmar.

## SHIPMENT: expediciones (shipment), tracking y giacenze (prefijo SHP)

Se inventarian 36 formularios (alta, desde cargo, listado y filtros, postfacturacion, las modales/cards del detalle V2, tracking y giacenze). Base de la V2: `ShipmentDetailPageV2.vue` > `ShipmentOverviewV2.vue` > cards, que abren modales (`modals/*`) montadas en `ShipmentModals.vue`; las modales estan envueltas en `ModalWrapper.vue` > `@shared/ui/FormModal` con `always-draft` (los cambios se acumulan en `shipment.store` y se persisten al pulsar Guardar con `commitDraft`, `PATCH`-like `POST /ajax_shipment_crud {item:{id,...}}`). Excepciones que persisten al instante sin pasar por el borrador: campos de dinero (`useMoneyFieldBinding` > `persistUpdate`), suplementos, direcciones, colli, edicion en linea de `NoteCard`, y todas las acciones (AWB, recogida, recargo, emails).

Mayor riesgo (P0): acciones con efecto en transportistas o terceros (generar AWB / reservar y cancelar recogida / tracking masivo / emails a couriers, partners, clientes y destinatarios), riaddebito individual y masivo (importes facturables), importes y locks de precio, COD/seguro/aduana, suplementos, proforma/DGR y cierre automatico de giacenze. El estado "facturado" (`id_fattura_a>0 && AWB_forn!=''`) bloquea campos en la UI con una lista distinta de la del servidor (`Shipment_Constants::READONLY_FIELDS_INVOICED`), lo que genera varios huecos.

Convenciones de este documento:
- "Detalle V2" = ruta `/shipment/:id` (`shipment-detail`). La V1 (`/shipment/legacy/:id`, `pages/ShipmentDetailPage.vue`) reutiliza varios `*Box.vue` fuera de modal; sus casos son los mismos de la ficha del Box correspondiente, pero con persistencia por campo (sin borrador).
- Los toasts de exito de `shipment.store` ("Saved", "Address saved", "Packages saved", "Update failed") estan en ingles fijo (`stores/shipment.store.ts`), ver SHP-09 riesgos. El BFF (`bff/config/routes.spa.yaml`) solo define el proxy; los permisos reales los aplica `tmwe_api`.
- No hay ningun `can(...)`/`requiresAdmin` en `modules/shipment`, `modules/tracking`; solo `isTmwe` en giacenze. Los 403 llegan del servidor (ver `Tracking_Management_Controller`: `admin_only`, anagrafica_id = 1).
- Casos que pueden tocar transportistas/terceros se marcan "solo con UPSTREAM_DENY_ACTIONS activo" o "solo sandbox".

---

### SHP-01 · Nueva expedicion (alta express)
- **Ruta/pantalla:** `/shipment/new` (`shipment-new`)  **Componente:** `web/apps/operations/src/modules/shipment/pages/ShipmentNewPage.vue` + `web/packages/platform/detail/EntityNewPage.vue`  **Envia:** `POST /unified_shipment` con `{ id_cliente, id_sede? }` (`stores/shipment.store.ts:156-170` via `useEntityCreate`); luego navega con `window.location.assign(detailHref('shipment', id))`.
- **Permisos:** ninguno en cliente. El BFF permite `POST /unified_shipment` (commit 63e8269). Visibilidad de clientes/sedes la decide el API.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Cliente | `v-autocomplete` remoto (`no-filter`, `hide-no-data`, `clearable`, `autofocus`) | Si (boton "Crear" deshabilitado sin cliente, `EntityNewPage.vue:179 canSubmit`) | Busqueda solo con 2+ caracteres (`onSearch`, q.length<2 vaciaresultados); descarta respuestas obsoletas por token; etiqueta `nombre . #id` (`useEntityCreate.toClientOptions`); descarta ids <=0 |
| Sede del cliente | `v-autocomplete` (solo si hay cliente) | No | Se carga con `anagraficaService.sedes(cliente)` + `getById` (sede principal = `id_sedi_interna_fatt`); orden: principal primero y luego alfabetico; preseleccion: la principal, o la unica si solo hay una; se reinicia al cambiar de cliente (`loadSedes`) |
| Crear / Cancelar | botones | - | "Cancelar" es un `href` a `moduleHref('home')`; "Crear" muestra `loading` mientras guarda |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-01-01 | Boton Crear deshabilitado sin cliente y texto de motivo | Pagina recien abierta | "Crear" disabled; aparece `platform.entity_new.select_client` | P1 | Auto |
| SHP-01-02 | Busqueda con menos de 2 caracteres | Escribir "a" | No se llama al servicio de busqueda; lista vacia | P2 | Auto |
| SHP-01-03 | Cliente con sede principal definida | Elegir cliente con `id_sedi_interna_fatt` valido y varias sedes | Se carga la lista, la principal sale primera con chip "principal" y queda preseleccionada | P1 | Auto |
| SHP-01-04 | Cliente con una sola sede no principal | Cliente con 1 sede y `id_sedi_interna_fatt=0` | La unica sede queda preseleccionada | P2 | Auto |
| SHP-01-05 | Cambiar de cliente reinicia la sede | Elegir A (sede X), luego B | `sedeId` se pone a null/preseleccion de B; no se arrastra la sede X | P1 | Auto |
| SHP-01-06 | Crear con cliente y sede | Cliente + sede | `POST /unified_shipment {id_cliente, id_sede}`; navegacion a `/shipment/<id>` (recarga completa con `location.assign`) | P0 | Auto |
| SHP-01-07 | Crear sin sede (limpiada con la x) | Cliente, sede borrada | Payload sin `id_sede` (`createFn` solo lo anade si no es null); detalle sin sede | P0 | Auto |
| SHP-01-08 | Respuesta sin id o error del servidor | Forzar 4xx/5xx o `{}` | Toast de error (`toasts.push("error", msg)`); no hay navegacion; el boton recupera el estado | P1 | Auto |
| SHP-01-09 | Doble clic en Crear | Dos clics rapidos | Solo un `POST` (guarda `saving`); no se crean dos borradores | P0 | Auto |
| SHP-01-10 | Cliente con permisos restringidos del usuario | Usuario de partner distinto al titular | El API responde 403/422; se muestra el mensaje y no se navega | P0 | Manual |

- **Riesgos / dudas:** La navegacion es `window.location.assign` (recarga la SPA) y `buildDetailPath` usa `detailHref`; `EntityNewPage.vue:236`. Si `createFn` falla en `loadSedes` (`Promise.all` sin catch, `ShipmentNewPage.vue:140-147`) el `finally` limpia el loading pero la promesa rechazada queda sin tratar: no determinado si se muestra algun mensaje. Lo que envia el servidor ante `id_sede` que no pertenece al cliente: no determinado.

---

### SHP-02 · Crear expedicion desde cargo (por tramo P/D/H)
- **Ruta/pantalla:** `/shipment/from-cargo` (`shipment-from-cargo`); el mismo endpoint lo usa el cargo (`modules/cargo/services/linked_express.service.ts`, `CargoLinkedExpressBox.vue`, `CargoLegExpress.vue`)  **Componente:** `web/apps/operations/src/modules/shipment/pages/ShipmentFromCargoPage.vue`  **Envia:** `POST /ajax_shipment_from_cargo { cargo_id, tpc }` (`ShipmentFromCargoPage.vue:35`, `shipment.service.ts:119`).
- **Permisos:** el servidor valida acceso al cargo (`Shipment_From_Cargo_Controller::can_access_cargo`, "You do not have access to this cargo").
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| cargo_id | no es un input: viene de `window.__TMWE_SHIPMENT__.fromCargo` | Si | Falta/0 > "Missing from_cargo/tpc params" (`ShipmentFromCargoPage.vue:32-37`) |
| tpc | idem `__TMWE_SHIPMENT__.tpc` | Si | API acepta P, D, Q, H (`Shipment_From_Cargo_Controller` handle_create); `TmweShipmentBootstrap` documenta P/D/H/Q |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-02-01 | Entrar a `/shipment/from-cargo` sin parametros (SPA) | Navegar directamente por hash | Error "Missing from_cargo/tpc params"; no hay `POST` | P1 | Auto |
| SHP-02-02 | Entrar con `?from_cargo=ID&tpc=P` en la query | URL con query | Documentar resultado: en el codigo solo se lee `window.__TMWE_SHIPMENT__` (que ningun bootstrap rellena), por lo que la query se ignora y sale el error del 02-01 | P1 | Auto |
| SHP-02-03 | Crear tramo desde el cargo (Recogida/Entrega/Handler) | Cargo existente sin express enlazado, tpc P, D y H | `POST /ajax_shipment_from_cargo`; devuelve `shipment_id`; el cargo muestra el express enlazado; coherencia de colli, peso y direcciones copiadas | P0 | Manual (datos de cargo) |
| SHP-02-04 | Cargo que ya tiene express para ese tramo | Repetir 02-03 | Error del servidor "Cargo not found or already has a linked shipment"; mensaje visible, sin segundo envio | P0 | Auto |
| SHP-02-05 | tpc invalido | `tpc=X` por API | 400 "type must be P, D, Q or H"; se muestra `error` | P1 | Auto |
| SHP-02-06 | Cargo ajeno al partner | cargo_id de otro partner | 403 `access_denied` | P0 | Manual |
| SHP-02-07 | Servicio elegido no aplicable al re-tarifar | Cargo con servicio ya elegido pero no disponible | `success` con `service_applied=false` y `service_error_code` (p. ej. SERVICE_UNAVAILABLE); la UI no muestra el codigo (solo usa `shipment_id`) | P1 | Manual |

- **Riesgos / dudas:** (1) `ShipmentFromCargoPage` parece huerfana en la SPA: la ruta existe pero ningun codigo escribe `__TMWE_SHIPMENT__.fromCargo/tpc` (`bff.ts` no lo hace) ni lee `route.query`; el cargo ya llama al servicio directamente. Posible ruta muerta (`router/index.ts:157-161`). (2) El front envia `tpc`; el API acepta `type` o `tpc`. (3) El resultado `service_applied`/`service_error_code` se descarta en front. (4) Texto de error fijo en ingles.

---

### SHP-03 · Listado de expediciones: topbar (rango de fechas, KPI, vistas de trabajo, click-to-filter)
- **Ruta/pantalla:** `/shipment/list` (y `/shipment`)  **Componente:** `pages/ShipmentListPage.vue` + `stores/shipment_list.store.ts` + `listing/shipment-work-views.ts`  **Envia:** `GET /api_courier_shipments` (solo lectura; recuentos KPI con `per_page=1`).
- **Permisos:** no hay en cliente. Alcance de datos por partner en el API.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Fecha desde / hasta (popover del topbar) | 2 x `v-text-field type=date` `clearable`, `@update:model-value=onFilterChange` | No | Cada cambio vuelve a pagina 1 y recarga; sin validacion `desde<=hasta`; atajos Hoy/7/30 dias (`setDatePreset`) calculados con fecha local |
| Tiles KPI (all / in_transit / cod_pending / pickup_status) | tiles clicables | No | `normalisedType` solo admite tipos base o claves del catalogo de la home (`HOME_COURIER_KEYS`); desconocido > `all`; cuentas de los otros KPI en paralelo con `per_page=1` |
| Vista de trabajo (standard / tracking / control) | `ListingWorkViewSelector` | No | Por defecto `tracking` si `type=in_transit`; define columnas y acciones masivas (`bulkActions`) |
| Modo (paginado / scroll) | `ViewModeToggle` | No | Clave localStorage `tmwe:list-view-mode` compartida con cargo |
| Click-to-filter en celdas | cliente (`id_cliente`), servicio (`search`), pais origen/destino, dia de creacion | No | `id_cliente` si la fila lo trae, si no `search` por nombre; pais origen/destino usa `country_iso`+`location_type` (P/D); dia = `date_from=date_to` |
| Orden | cabeceras | No | Lista blanca `ALLOWED_SORTS` en `parseShipmentListQuery`; valor desconocido > `sp.data_sped1` DESC |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-03-01 | Limpiar fecha con la "x" del popover | Fijar fecha desde, pulsar x | Documentar: Vuetify deja el modelo en `null`; `serializeShipmentListQuery` no filtra `null` (solo `""`/`0`) y podria escribir `date_from=null` en la URL y enviarlo al API. Esperado correcto: filtro eliminado y URL limpia | P1 | Auto |
| SHP-03-02 | Rango invertido | desde=2026-05-10, hasta=2026-05-01 | Sin validacion cliente: debe devolver 0 filas o error legible, nunca romper | P2 | Auto |
| SHP-03-03 | Preset "Hoy" / "7 dias" / "30 dias" | Pulsar cada uno | `date_from`/`date_to` locales correctos (7 dias = hoy-6); chip de rango activo; pagina 1 | P2 | Auto |
| SHP-03-04 | Clic en tile KPI y volver a "Todas" | Pulsar `in_transit` y `all` | `type` en URL y listado; la vista de trabajo cambia a `tracking` con in_transit; contadores de los demas KPI no se pisan | P1 | Auto |
| SHP-03-05 | `?type=` desconocido en la URL | `/shipment/list?type=foo` | Se normaliza a `all`; sin error | P2 | Auto |
| SHP-03-06 | Click-to-filter por cliente y retirar chip | Clic en el nombre del cliente de una fila | Chip con nombre (no id); listado filtrado por `id_cliente`; quitar chip restaura | P1 | Auto |
| SHP-03-07 | Click-to-filter pais origen reemplaza al de destino | Clic pais destino ES y luego pais origen FR | Solo un chip de pais (el ultimo); `location_type=P` | P2 | Auto |
| SHP-03-08 | Orden por cabecera no permitida por URL | `?sort=sp.hack` | Vuelve al orden por defecto | P2 | Auto |
| SHP-03-09 | Deep-link con `?view=ID` | `/shipment/list?view=123` | Se abre el drawer del registro; recargar mantiene el drawer; cerrar quita `view` de la URL (cierre espurio de <400 ms ignorado) | P2 | Auto |
| SHP-03-10 | Navegar a detalle y volver (restore) | Abrir una fila, "Torna alla lista" | `restore=1` recupera scroll/fila y se elimina de la URL; filtros intactos | P2 | Manual |

- **Riesgos / dudas:** (1) `null` en `state.date_from/date_to` al limpiar el campo: `ShipmentListPage.vue:49-69` escribe directamente en el store y `shipment_list.store.ts:serializeShipmentListQuery` solo omite `""`, `0` y el valor por defecto. Probable defecto, a confirmar con Playwright. (2) `onFilterChange` por cada pulsacion del campo de fecha (sin debounce). (3) La URL admite `per_page` arbitrario (`asNumber`): maximo permitido por el servidor no determinado. (4) `chat_unread=1` entra por el badge de chat de la plataforma.

---

### SHP-04 · Panel de filtros avanzados de expediciones
- **Ruta/pantalla:** `/shipment/list` (drawer derecho)  **Componente:** `components/shipment/ShipmentFilterPanel.vue` (usa `@shared/listing/FilterDrawer.vue`)  **Envia:** solo filtro (re-consulta `GET /api_courier_shipments`).
- **Permisos:** ninguno.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| ID expedicion | `v-text-field type=number` | No | `Number(id)` en la query (`buildShipmentListQuery`) |
| AWB (`AWB_forn`), Ref. cliente (`RIF_cliente`), Notas | texto | No | sin validacion |
| Cliente (`id_cliente`) | `v-autocomplete` remoto | No | busqueda tras 250 ms, 2+ caracteres, limite 20 |
| Corriere (`id_fornitore`) | `v-autocomplete`, ~40 items cargados al montar | No | solo couriers presentes en expediciones |
| Con contrassegno / Con seguro | switch / checkbox | No | se envian solo como `"S"` (el API exige `=== 'S'`) |
| Campo de fecha | `v-select` data_sped0/data_sped1/data_corriere/consegna_data | Si (siempre con valor) | no cuenta como filtro activo |
| Desde / Hasta | `type=date` | No | |
| Ambito (origen P / destino D), Pais, Ciudad | select + `CmCountrySelect` + texto | No | `country_iso` en mayusculas; ver riesgo de lado vacio |
| Controllata (S/N/O), Consegnata (S/N), Estado recogida (N/W/F/C/T), Archiviata (S/N), Giacenza (S/A/X/N) | `v-select` | No | |
| Peso desde/hasta, Peso tassato exacto, ID servicio | `type=number` | No | `id_servizio` con `v-model.number`; sin validar `desde<=hasta` |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-04-01 | Pais sin lado (ambito vacio) | Ambito vacio, pais=ES | Segun `buildShipmentListQuery` el pais solo se envia si hay `location_type`; el comentario del panel dice que sin lado se busca en origen y destino. Verificar si el filtro se aplica o se descarta en silencio | P1 | Auto |
| SHP-04-02 | Pais + ambito Origen | Ambito P, pais FR | Solo expediciones con origen FR; chip "Pais origen" | P1 | Auto |
| SHP-04-03 | Combinar AWB + cliente + rango de fechas | AWB parcial, cliente, fechas | Intersección; contador de filtros activos correcto (date_field no cuenta) | P1 | Auto |
| SHP-04-04 | Switch contrassegno y seguro | Activar ambos | Query con `has_contrassegno=S`, `has_assicurazione=S`; desactivar los elimina (no `"N"`) | P1 | Auto |
| SHP-04-05 | Estado de recogida "E" | Abrir panel | Las opciones solo ofrecen N/W/F/C/T, mientras el detalle (`ShipmentPickupScheduleBox`) permite tambien "E": no se puede filtrar por E | P2 | Auto |
| SHP-04-06 | Peso desde > peso hasta | desde=50, hasta=10 | Sin validacion cliente; 0 resultados o 422 legible | P2 | Auto |
| SHP-04-07 | Limpiar | Con filtros y KPI distinto de all | Resetea tambien `type`/KPI (usa `shipmentResetFilters`), conserva orden y per_page; cierra el drawer | P2 | Auto |
| SHP-04-08 | Persistencia en URL y recarga | Aplicar varios filtros y F5 | Todos los filtros vuelven a poblar el panel; cliente muestra `#id` hasta cargar el nombre | P2 | Auto |
| SHP-04-09 | Aplicar vuelve a la pagina 1 | Estar en pagina 3 y aplicar | `page=1` | P2 | Auto |

- **Riesgos / dudas:** `ShipmentFilterPanel.vue:snapshotLocal` pone `location_type` a `"D"` por defecto al abrir, de modo que un filtro de pais aplicado desde el panel siempre llevara lado aunque el usuario no lo elija; mientras que el borrado manual del ambito produce el caso SHP-04-01. El cliente seleccionado se rehidrata como `#id` (`seedSelectedClient`), sin nombre.

---

### SHP-05 · Acciones sobre filas del listado (tracking, controllata, archivar)
- **Ruta/pantalla:** `/shipment/list`  **Componente:** `pages/ShipmentListPage.vue` (`onLaunchTracking`, `onBulkTracking`, `onBulkControl`, `onBulkArchive`)  **Envia:** `POST /admin_tracking_api {action:'single', shipment_id}`; `POST /admin_tracking_api {action:'batch_ids', shipment_ids}`; `POST /api_shipment_review {id:[...]}`; `POST /api_shipment_archive {id:[...]}`.
- **Permisos:** tracking: `admin_only` en el API (`Tracking_Management_Controller`: solo anagrafica_id = 1). Las acciones masivas visibles dependen de la vista de trabajo (`bulkActions`): standard y tracking (tracking, control, archive), control (control, archive). Sin confirmacion previa en ninguna.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Seleccion de filas | casillas de la tabla | Si (>=1) | `selectedIds`; limite maximo: no determinado |
| Lanzar tracking (fila) | boton | - | Sincrono; exito solo si `success && processed>0`, si no toast de error |
| Tracking masivo | boton | - | Encola job de fondo; exito si `success && queued` |
| Marcar controllata / Archivar | botones | - | El front manda solo la lista de ids; el valor `S/N/O` no se envia (el servidor solo marca `S`) |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-05-01 | Tracking de una fila con usuario no admin | Usuario normal pulsa el icono | 403 del API; toast con el mensaje; la fila no cambia | P0 | Auto (solo con UPSTREAM_DENY_ACTIONS activo) |
| SHP-05-02 | Tracking de una fila con admin y courier sin cambios | `processed=0` | Toast `tracking_failed` (se interpreta como error aunque sea "sin novedades") | P1 | Manual (solo sandbox) |
| SHP-05-03 | Tracking masivo de N seleccionados | N=3 | Toast `tracking_queued` con plural; la seleccion se vacia; el estado se actualiza en el siguiente refresco, no inmediatamente | P0 | Manual (solo sandbox; el job consulta couriers y puede enviar emails de entrega y abrir giacenze) |
| SHP-05-04 | Archivar masivo | 2 filas | `POST /api_shipment_archive {id:[a,b]}`; toast `archived` con plural; refresco; las filas desaparecen si el filtro es archiviata=N | P0 | Auto |
| SHP-05-05 | Marcar como controllata masivo | 2 filas | `POST /api_shipment_review`; toast; refresco | P0 | Auto |
| SHP-05-06 | Acciones sin seleccion | Sin filas | Botones no visibles/`return` si lista vacia | P2 | Auto |
| SHP-05-07 | Acciones segun vista de trabajo | Cambiar a vista "control" | Desaparece "lanzar tracking"; quedan control y archivar | P2 | Auto |
| SHP-05-08 | Archivar expedicion facturada o ajena | Id facturado/otro partner | Respuesta `success=false` o error: toast con `r.error`; sin cambio | P0 | Manual |
| SHP-05-09 | Doble clic en archivar masivo | Dos clics | `bulkBusy` evita doble llamada | P1 | Auto |

- **Riesgos / dudas:** (1) El boton de tracking es visible para todos aunque el API sea solo admin; no hay gating de UI (403 solo tras el clic). (2) No hay confirmacion para archivar/controllar en masa (acciones de estado). (3) `setArchiviata`/`setControllata`/`setPrivate` de `shipment.service.ts` envian el valor S/N pero el comentario admite que el servidor solo marca: no hay desarchivar desde estas rutas. (4) Mezcla `shipment_id` (single) e `id[]` (masivo) segun endpoint, documentado en el servicio.

---

### SHP-06 · Exportar listado (menu de exportacion)
- **Ruta/pantalla:** `/shipment/list`  **Componente:** `components/shipment/ShipmentExportMenu.vue`  **Envia:** `POST /api_shipment_export_web` (encola) + `GET /api_shipment_export_web?job_id=` (sondeo cada 2 s) + descarga.
- **Permisos:** no determinado en cliente.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Formato | `v-btn-toggle` XLSX / CSV | Si (por defecto xlsx) | |
| Agrupacion | `v-select`: plana(0) / oficina(S) / cliente(C) / referencia(R) / usuario(U) | Si (por defecto "0") | |
| Alcance | informativo | - | Si hay seleccion se exportan los `shipment_ids`; si no, los filtros del listado (`buildShipmentListQuery`) |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-06-01 | Exportar con filtros activos y sin seleccion | Filtro cliente + CSV | El fichero coincide con lo visible; scope "filtros" | P1 | Auto |
| SHP-06-02 | Seleccion gana a los filtros | 3 filas marcadas | Body con `shipment_ids`; solo 3 filas | P1 | Auto |
| SHP-06-03 | Resultado truncado | Listado > `max_rows` (5000 segun el codigo) | Toast `truncated` con el maximo; fichero valido | P2 | Manual |
| SHP-06-04 | Cada agrupacion | 0,S,C,R,U | Estructura del fichero acorde (cabeceras/secciones) | P2 | Manual |
| SHP-06-05 | Job lento o fallido | Simular fallo del job | Mensaje `failed`; el sondeo termina (hay tope de sondeo) | P2 | Auto |

- **Riesgos / dudas:** el tope de intentos de sondeo se menciona en el codigo pero su valor exacto no se determino (`ShipmentExportMenu.vue` cabecera). Permisos de exportacion no visibles en cliente.

---

### SHP-07 · Postfacturacion (riaddebito): listado, filtros y aplicacion masiva
- **Ruta/pantalla:** `/shipment/recharge` (`recharge-list`)  **Componente:** `pages/RechargeListPage.vue`, `components/recharge/RechargeFilterPanel.vue`, `stores/recharge_list.store.ts`  **Envia:** `GET /api_recharge?op=pending&view=...`; `POST /api_recharge {op:'apply', shipment_id}` por cada seleccionada (`onBulkApply`).
- **Permisos:** reglas del servidor (`Recharge_Service`): elegible si `id_fattura_a2 = 0` y `controllo_fatt` permitido; con `carico_lk='S'` y factura no se modifica salvo override.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Vista | botones "A aplicar" (`to_apply`, controllo_fatt=CA) / `faddebit2` (controllo_fatt=NO) | Si | El API solo acepta esos dos valores, otro > `to_apply` |
| Fecha desde / hasta | `type=date` clearable | No | sin validacion de orden |
| ID fornitore | `type=number` | No | `Number(id_fornitore)` |
| Filtro por cliente (click en fila) | chip | No | `id_cliente` (no esta en el panel) |
| Seleccion + "Aplicar riaddebito (N)" | casillas + boton | Si (>=1) | Aplica en bucle secuencial `rechargeService.apply(id)` sin override |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-07-01 | Cambio de vista a faddebit2 | Pulsar vista | Recarga pagina 1; mensaje vacio especifico de la vista si no hay filas | P2 | Auto |
| SHP-07-02 | Filtro de fechas + fornitore | Fechas y fornitore | Query con `date_from/date_to/id_fornitore`; contador de filtros activos | P2 | Auto |
| SHP-07-03 | Aplicacion masiva de N envios | 3 envios elegibles | Se llama a `apply` 3 veces en serie; toast `toast_applied_n` y, si hay fallos, `toast_failed_n`; recarga | P0 | Manual (efecto economico real; solo sandbox/BD de pruebas) |
| SHP-07-04 | Aplicacion masiva con algun no elegible | 1 elegible + 1 con `id_fattura_a2>0` | El segundo falla con el error del servidor ("no se puede readebitar"); aviso de fallos parciales | P0 | Manual |
| SHP-07-05 | Aplicacion masiva sin confirmacion | Seleccionar y pulsar | Hoy se ejecuta directamente, sin dialogo de confirmacion ni vista previa del importe; el caso debe quedar marcado como hueco funcional | P0 | Manual |
| SHP-07-06 | Boton por fila "Addebita" | Pulsar en una fila | Navega a `/shipment/:id?modal=riaddebito`; se abre el dialogo (SHP-08) | P1 | Auto |
| SHP-07-07 | Filtro por cliente y quitar chip | Clic en cliente | `id_cliente` aplicado y chip; quitar lo elimina y recarga | P2 | Auto |
| SHP-07-08 | Sincronizacion con la URL | Aplicar filtros y F5 | Estado restaurado desde `parseRechargeListQuery` | P2 | Auto |

- **Riesgos / dudas:** `onBulkApply` (`RechargeListPage.vue:460`) no pide confirmacion ni muestra el delta antes de aplicar un cargo al cliente, y no comprueba `eligible`. Las respuestas `no_delta`/`carico_locked` se cuentan como `ok` (`r.success`). El orden secuencial sin limite puede ser lento con muchas filas.

---

### SHP-08 · Dialogo de Riaddebito (recargo posfactura de una expedicion)
- **Ruta/pantalla:** modal `riaddebito` en el detalle (boton de `ShipmentPostInvoiceBox` o `?modal=riaddebito`)  **Componente:** `components/shipment/recharge/RiaddebitoDialog.vue`  **Envia:** `GET /api_recharge?op=calculate&shipment_id=` (vista previa) y `POST /api_recharge {op:'apply', shipment_id, override_amount?, postfatt_txt?}`.
- **Permisos:** el boton solo se muestra si `preview.eligible`; el servidor repite la validacion.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Importar manual (override) | checkbox + `v-text-field type=number step=0.01` (`v-model.number`) | No | Si esta marcado se envia `Number(overrideAmount)`; vacio se convierte en 0 |
| Descripcion en factura (`postfatt_txt`) | `v-textarea` | No | Solo se envia si difiere del texto sugerido (`postfatt_txt_preview`) |
| Pestanas Confronto / Proposta / Anteprima | tabs | - | informativas |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-08-01 | Envio no elegible | `id_fattura_a2>0` o controllo_fatt fuera de CA/NO/0 | Aviso `not_eligible`; no hay boton de aplicar | P0 | Auto |
| SHP-08-02 | Aplicar sin override | Envio elegible con delta | Importe del boton = delta; toast segun accion (`recharge_applied`, `carico_updated`) y se recarga el envio | P0 | Manual (sandbox) |
| SHP-08-03 | Override positivo | 12.50 | `override_amount=12.5` en el POST; `delta_applied` coincide | P0 | Manual (sandbox) |
| SHP-08-04 | Override vacio o 0 | Marcar override y dejar vacio | Se envia `0`: el servidor interpreta `0` como importe manual (no `null`). Verificar que no se aplica un cargo de 0 ni se sobreescribe el calculado sin aviso | P0 | Auto |
| SHP-08-05 | Override negativo (abono) | -5 | No hay validacion cliente; el servidor acepta `float`. Documentar comportamiento | P0 | Manual |
| SHP-08-06 | Texto de factura editado | Cambiar la descripcion | Se envia `postfatt_txt`; si no se toca, no se envia | P1 | Auto |
| SHP-08-07 | `no_delta` y `carico_locked` | Envio con delta 0 / precio bloqueado | Toast informativo; el dialogo se cierra | P1 | Manual |
| SHP-08-08 | Error del servidor / tarifa no disponible | `rate_available=false` sin override | Toast con `error`; no se cierra | P1 | Manual |
| SHP-08-09 | Doble clic en Aplicar | Dos clics | Solo una aplicacion (`applying`) | P0 | Auto |

- **Riesgos / dudas:** `RiaddebitoDialog.vue:submitApply`: con `useOverride` y campo vaciado, `v-model.number` deja `""` y se envia `Number("")=0` (el controlador toma cualquier valor presente como override). El importe del boton usa `useOverride ? overrideAmount : delta` sin comprobar NaN. No hay confirmacion adicional.

---

### SHP-09 · Colli y pesos (modal "Colli")
- **Ruta/pantalla:** detalle V2, modal `colli` (desde `MetricsCard`)  **Componente:** `modals/ColliModal.vue` con `ShipmentPackagesBox.vue`, `ShipmentColliList.vue`, `ShipmentExtraWeightsBox.vue`  **Envia:** `POST /ajax_shipment_packages {shipment_id, packages[]}` (lista) y `POST /ajax_shipment_crud {item:{id,...}}` (campos de cabecera, via borrador).
- **Permisos:** campos `readonly()` cuando `giafatt` (factura emitida + AWB); el servidor devuelve `READONLY_SHIPMENT` "Cannot modify colli on invoiced shipment".
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Piezas (`colli`) | `type=number min=0` | No | al salir del campo reajusta las filas de colli (`onColliBlur` / `resizeColliRows`) |
| Peso declarado (`peso`) | `type=number min=0 step=0.1`, en kg o lb | No | convierte a metrico (`round4`), `readonly('peso')` |
| Peso tassato | solo lectura (calculado por motor) | - | |
| Tipo de documento aduanero (`opz_par_doc`) | `v-select` | No | visible solo si `useCustomsDocVisibility` (rutas no intra-UE / pais distinto) |
| Km forzados (`km_forza`) | `type=number min=0` | No | |
| Courier fijo (`acc_fissa_corriere`) | `v-select` clearable | No | es un id de courier (0 = ninguno), no booleano |
| Fermo deposito | checkbox | No | |
| Filas de colli: peso, alto (`dim_a`), ancho (`dim_l`), prof. (`dim_p`) | `type=number min=0` en cada fila | No | volumen calculado por fila; el servidor calcula `volume` si hay las 3 dimensiones |
| Pesos extra: `peso_fornit`, `peso_fornit_reale`, `peso_reale`, `volume_cliente` | `type=number min=0` | No | persisten al blur |
| Interruptor kg/lb | `v-btn-toggle` | Si | solo visual; nunca se persiste |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-09-01 | Cambiar Piezas de 1 a 3 | colli=3 | Aparecen 3 filas; al bajar a 2 se recortan filas; el total no se guarda hasta Guardar | P1 | Auto |
| SHP-09-02 | Guardar filas y cabecera juntas | Editar una fila y el peso declarado | Un solo boton: primero `ajax_shipment_packages`, luego `commitDraft`; modal se cierra | P0 | Auto |
| SHP-09-03 | Fallo al guardar filas | Forzar error en `ajax_shipment_packages` | Toast de error, el modal sigue abierto y no se hace `commitDraft` | P0 | Auto |
| SHP-09-04 | Peso declarado distinto de la suma de filas | peso=10, filas suman 8 | Aviso no bloqueante `weight_mismatch` en el modal y toast tras guardar; se guarda igualmente | P1 | Auto |
| SHP-09-05 | Conversion lb a kg | Cambiar a lb, escribir 22.046 | Se guarda ~10 kg (metrico); al reabrir en kg muestra 10 | P1 | Auto |
| SHP-09-06 | Valores negativos o cero en peso/dimensiones | -1, 0 | El atributo `min=0` no impide teclear; el cliente solo valida con `shipmentRules` `peso` no negativo al guardar (`validateShipmentPatch`: "non può essere negativo"); filas de colli no se validan en cliente ni en servidor (`validate_package` devuelve vacio) | P0 | Auto |
| SHP-09-07 | Peso con coma decimal | "10,5" en `peso` | Regla `nonNegativeNumber` acepta coma; `type=number` del navegador puede rechazarlo: comprobar por locale | P2 | Manual |
| SHP-09-08 | Expedicion facturada | `id_fattura_a>0` y AWB | Piezas, peso, opz_par_doc, tipo bloqueados en UI; probar tambien que los campos NO bloqueados en UI pero si en servidor (`km_forza`, `peso_fornit`, `peso_fornit_reale`, `volume_cliente`, `acc_fissa_corriere`) responden con rechazo claro | P0 | Auto |
| SHP-09-09 | Mas de 100 bultos | 101 filas | El servidor responde "Maximum 100 packages per request" | P2 | Auto |
| SHP-09-10 | Cancelar con cambios | Editar y pulsar Cancelar | `discardDraft`; confirmacion de cambios sin guardar (`FormModal`) | P1 | Auto |
| SHP-09-11 | Courier fijo y fermo deposito | Elegir courier y marcar fermo | Se recalcula precio (`usePricingRecalc`); `acc_fissa_corriere` es id numerico, no S/N | P1 | Manual |

- **Riesgos / dudas:** (1) Servidor no valida peso/dimensiones de colli (`Shipment_Packages_Controller.php:323-327`) ni limites de longitud; solo `max_weight 99999`/`max_pieces 9999` en la documentacion OpenAPI. (2) Desalineacion de bloqueos UI/servidor (`useShipmentState.ts` vs `Shipment_Constants::READONLY_FIELDS_INVOICED`): ver SHP-09-08. (3) `persistUpdate` muestra el toast "Saved" aunque el servidor devuelva `ignored_fields`/`blocked_by_lock` (solo evita fusionarlos en local, `shipment.store.ts:212-228`). (4) Toasts "Saved"/"Packages saved" fijos en ingles. (5) Reajuste de filas al cambiar Piezas puede descartar datos de filas ya rellenadas: no determinado.

---

### SHP-10 · Direcciones de recogida y entrega
- **Ruta/pantalla:** detalle V2, modales `pickup` (P) y `dest` (D)  **Componente:** `modals/PickupAddressModal.vue`, `modals/DestAddressModal.vue`, `ShipmentAddressBlock.vue`  **Envia:** `POST /ajax_shipment_addresses {shipment_id, tipo:'P'|'D', address}`; "usar sede" `POST ... {shipment_id, action:'use_sede'}`.
- **Permisos:** `isReadonly = isAddressLocked (giafatt) || readonly('id_cliente') || isSedePickup`; el servidor rechaza con `READONLY_SHIPMENT` "Spedizione non modificabile (fatturata)".
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Libreta de direcciones (rubrica) | `v-autocomplete` con busqueda | No | rellena los campos |
| Pais | `CmCountrySelect` | no marcado en UI | al cambiar recalcula aeropuertos y consulta de CAP |
| Nombre, Direccion, Atencion, Telefono, Movil, Email | texto | no marcados | el servidor no valida ninguno (solo `tipo` P/D y `shipment_id`) |
| CAP | texto | no | al salir con `pais` y 3+ caracteres llama `geoService.lookupCap`; el CAP manda sobre la provincia (la sobrescribe) y si hay una sola ciudad la rellena |
| Ciudad | combo con sugerencias | no | |
| Provincia | select | no | |
| Aeropuerto | `v-autocomplete` por pais | no | |
| Modo origen "sede" vs "otra direccion" (solo P) | botones | - | `switchToCustom` vacia los campos; `switchToSede` llama a `use_sede` y recarga |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-10-01 | Direccion destino completa valida | IT, 20100 Milano, MI | `POST` OK, recarga, toast; el card de Indirizzi muestra nombre, direccion, CAP-ciudad (prov) y bandera | P0 | Auto |
| SHP-10-02 | CAP sobrescribe provincia | Pais IT, CAP de Roma con provincia MI | La provincia pasa a la del CAP | P1 | Auto |
| SHP-10-03 | CAP con varias ciudades | CAP con 2 ciudades | Lista de sugerencias; no autocompleta ciudad | P2 | Auto |
| SHP-10-04 | Cambiar pais recalcula aeropuertos | IT a DE | Lista de aeropuertos del pais; se limpia el anterior | P2 | Manual |
| SHP-10-05 | Origen desde sede: campos solo lectura | Envio con `presa_tipo='S'` | Campos readonly; boton "usar otra direccion" | P1 | Auto |
| SHP-10-06 | Pasar a direccion propia y guardar | Cliqueo "otra direccion", rellenar, Guardar | El backend pone `presa_tipo='T'` (triangulacion); sale del modo local; `presa_tipo` visible en estado | P0 | Auto |
| SHP-10-07 | Volver a la sede | Pulsar "usar direccion de sede" | `use_sede`; recarga y vuelve el origen heredado | P0 | Auto |
| SHP-10-08 | Guardar con todos los campos vacios | Direccion vacia | No hay validacion cliente ni servidor: documentar si se persiste una direccion vacia | P1 | Auto |
| SHP-10-09 | Expedicion facturada | Con factura | Campos deshabilitados; "ver direccion registrada" sigue funcionando | P0 | Auto |
| SHP-10-10 | Email de direccion con formato invalido | "abc" | No hay regla cliente (campo de texto); definir comportamiento esperado | P2 | Auto |
| SHP-10-11 | Cerrar modal con cambios sin guardar | Editar y Cancelar | El buffer local se descarta (el modal no usa el borrador del store); no hay aviso de cambios sin guardar | P1 | Auto |

- **Riesgos / dudas:** El bloque guarda en un buffer local (`dirty`) y no en el borrador del store, de modo que la proteccion de cambios sin guardar de `FormModal` puede no activarse (`DestAddressModal.vue:onCancel` cierra sin preguntar). Telefono/email sin formato. `lookupCap` solo se dispara con pais y CAP de 3+ caracteres.

---

### SHP-11 · Cliente y referencia de la expedicion
- **Ruta/pantalla:** detalle V2, modal `cliente` (cabecera del layout y `IndirizziPanel`) y `ShipmentClientHeader` (V1)  **Componente:** `modals/ClienteModal.vue`, `ShipmentClientHeader.vue`  **Envia:** `POST /ajax_shipment_crud {item:{id,...}}`.
- **Permisos:** `readonly('id_cliente')`, `readonly('RIF_cliente')`, `readonly('id_sede')` con factura o si el llamante no es titular (`clientIsCaller`).
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Cliente (modal V2) | `v-text-field` ligado a `cliente` | No | es el nombre mostrado, no una columna editable (ver riesgos) |
| Ref. cliente | `v-text-field` ligado a `rif_cliente` | No | el servidor lo mapea al alias `RIF_cliente` (`FIELD_ALIASES`); bloqueado si facturada |
| Oficina/sede | `v-text-field` ligado a `sed_label` | No | |
| Cliente (V1) | `v-autocomplete` remoto | No | cambia `id_cliente` al elegir (sin confirmar) |
| Sede (V1) | campo deshabilitado | - | |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-11-01 | Editar la referencia del cliente | "REF-123" | Persiste como `RIF_cliente`; se refleja en el listado | P1 | Auto |
| SHP-11-02 | Editar el nombre del cliente en el modal | Cambiar texto | `cliente` y `sed_label` no estan en la lista blanca `ALLOWED_SHIPMENT_FIELDS` (aparecen en `ignored_fields`) pero la UI muestra "Saved"; comprobar si realmente se persiste el nombre | P1 | Auto |
| SHP-11-03 | Cambiar el cliente (V1) | Elegir otro cliente | `id_cliente` cambia; la sede anterior ya no corresponde; comprobar si el servidor limpia/revalida `id_sede` y recalcula precio | P0 | Manual |
| SHP-11-04 | Referencia en expedicion facturada | Con factura | Campo readonly (UI) y rechazo del servidor | P0 | Auto |
| SHP-11-05 | Llamante que no es titular | Usuario de otro partner | `id_cliente` e `id_sede` readonly | P1 | Manual |

- **Riesgos / dudas:** `ClienteModal.vue` liga a `cliente` y `sed_label` (campos derivados del JOIN, ver `Shipment_Constants` sin esas claves). Probable edicion sin efecto con toast de exito. `ShipmentClientHeader.onClientChange` cambia `id_cliente` sin tocar `id_sede`.

---

### SHP-12 · Importes y locks de precio (modal "Costi")
- **Ruta/pantalla:** detalle V2, modal `costi` (card `CostiCard` con candados)  **Componente:** `modals/CostiModal.vue` + `ShipmentAmountsBox.vue`, `overview/CostiCard.vue`, `modals/CurrencyDayModal.vue`  **Envia:** dinero: `POST /ajax_shipment_crud {item:{id, carico|fuel_surc|costo|fuel_surc_cst, amount_currency}}` inmediato; resto via borrador.
- **Permisos:** `readonly('carico'|'fuel_surc'|'costo'|'costo_reale'|'fuel_surc_cst'|'controllo_fatt'|'giac_ricons')` por factura; servidor: `PRICE_LOCKED_FIELDS` con `carico_lk='S'`.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Carico (precio cliente) | `type=number min=0` | No | se muestra/edita en la divisa destino del cliente y se envia con `amount_currency`; el servidor convierte a EUR |
| Fuel surcharge cliente | idem | No | idem |
| Costo previsto (alias `costo`) | idem | No | alias de `costo_previsto` |
| Coef. fuel coste (`fuel_surc_cst`) | idem | No | |
| Costo real | `type=number min=0` | No | ligado a `costor` (alias `costo_reale`), sin conversion |
| Candados `carico_lk` / `costo_previsto_lk` | iconos | - | alternan S/N; `CostiCard` tambien los alterna con toast |
| Control factura (`controllo_fatt`) | `v-select` '0','NO','CA','OK' | No | enum real; '0' = no definido |
| Giac. riconsegna (`giac_ricons`) | numero | No | |
| Fermo deposito | checkbox | No | |
| Margen | calculado | - | `(carico+fuel)-(costo+fuel_cst)`; % solo si carichi>0 |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-12-01 | Editar carico en EUR | 120.50 | Persiste al salir del campo (no espera a Guardar); el margen se recalcula | P0 | Auto |
| SHP-12-02 | Editar carico con divisa objetivo distinta | Cliente en GBP | Se envia `amount_currency='GBP'`; en EUR el servidor guarda la conversion con la tasa de la fecha de envio; reabrir muestra el mismo valor | P0 | Manual |
| SHP-12-03 | Cancelar el modal tras editar el carico | Editar carico y pulsar Cancelar | El importe ya se guardo (no pasa por el borrador): comportamiento a documentar frente a lo que el usuario espera de "Cancelar" | P0 | Auto |
| SHP-12-04 | Candado carico_lk activo | Activar candado y editar | El servidor ignora carico/fuel/costo/servicio/fornitore (`PRICE_LOCKED_FIELDS`); UI no debe mostrar "Saved" como si se hubiera aplicado | P0 | Auto |
| SHP-12-05 | Alternar candado mediante icono de CostiCard | Clic | `carico_lk` pasa S/N (con toast) y se persiste al instante, mientras que dentro de la modal el mismo candado queda en el borrador | P1 | Auto |
| SHP-12-06 | Valores negativos | carico=-10 | `min=0` no impide teclear; `shipmentRules` no cubre carico/costo; el servidor: no determinado | P0 | Auto |
| SHP-12-07 | Margen negativo y sin carico | costo>carico; carico=0 | Clase de error en el margen; % oculto | P2 | Auto |
| SHP-12-08 | Cambiar `controllo_fatt` | CA, NO, OK, '0' | Se guarda con Guardar; solo valores del enum (no 'KO') | P0 | Auto |
| SHP-12-09 | Expedicion facturada | Con factura | Importes, costo real y control de factura de solo lectura; el candado deshabilitado | P0 | Auto |
| SHP-12-10 | Historial por campo y tabla de cambios del dia | Abrir "currency_day" y cambiar fecha | Tasas por EUR para la fecha; chip de fallback si la fecha no tiene tasas | P2 | Auto |

- **Riesgos / dudas:** (1) Mezcla de persistencia inmediata (dinero) y diferida (candados, control factura, giac) en la misma modal: "Cancelar" no revierte los importes (`useMoneyFieldBinding` persiste con `persistUpdate`). (2) `costor` se lee con `useFieldBinding("costor")` pero la columna es `costo_reale` (alias `costor` en `FIELD_ALIASES`): el valor mostrado depende de que el API devuelva `costor`; no determinado. (3) Sin validacion cliente de importes negativos.

---

### SHP-13 · Contrassegno (COD)
- **Ruta/pantalla:** detalle V2, modal `cod` (card `AddebitiCard`)  **Componente:** `modals/CodModal.vue` + `ShipmentContrassegnoBox.vue`  **Envia:** `POST /ajax_shipment_crud` (via borrador).
- **Permisos:** `readonly()` de `contras_imp`, `id_valuta_contras`, `contras_incasso`, `contras_data_inc` con factura.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Importe COD | `type=number min=0` | No | los demas campos solo se muestran si el importe > 0 |
| Divisa | `v-autocomplete` con siglas del cambio del dia (`api_currency_day`), por defecto EUR | Si cuando hay importe | envia la sigla; el servidor traduce a `valute.id` |
| Estado de cobro (`contras_incasso`) | `v-select` 0/N/C/AB1/B/AB2/AC/CLC | No | dominio real del enum (no S/N) |
| Fecha de cobro | `type=date` | No | |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-13-01 | Activar COD | importe 250, EUR | Aparecen divisa/estado/fecha; al Guardar `contras_imp=250` y `id_valuta_contras` correcto; el listado muestra badge COD | P0 | Auto |
| SHP-13-02 | Divisa distinta de EUR | GBP | Se guarda el id correcto (no la sigla en columna entera); reabrir muestra GBP | P0 | Auto |
| SHP-13-03 | Poner el importe a 0 | 0 | Se ocultan los campos dependientes; comprobar que no queda estado de cobro huerfano | P1 | Auto |
| SHP-13-04 | Importe negativo o con muchos decimales | -5; 10.999 | `min=0` solo orientativo; `shipmentRules` rechaza negativo en `contras_imp` al guardar ("non può essere negativo") | P0 | Auto |
| SHP-13-05 | Estado de cobro CLC | Elegir CLC | Valor del enum aceptado; listado muestra badge verde (`cod.collected==='CLC'`) | P1 | Auto |
| SHP-13-06 | Fecha de cobro sin estado cobrado | Fecha rellena con estado N | Sin regla cruzada en cliente; definir comportamiento | P2 | Auto |
| SHP-13-07 | Divisa no valida por API directa | `id_valuta_contras="XYZ1"` | Regla `currencyIso` exige 3 letras: error de validacion antes del envio | P1 | Auto |
| SHP-13-08 | Expedicion facturada | Con factura | Todos readonly | P0 | Auto |

- **Riesgos / dudas:** el bloque `active` oculta divisa/estado cuando el importe es 0 pero el borrador puede conservar valores previos. Las reglas de `shipmentRules.ts` validan al guardar el borrador, no al escribir (no hay mensajes por campo).

---

### SHP-14 · Seguro y aduana
- **Ruta/pantalla:** detalle V2, modales `insurance` y `customs` (card `AccessoriCard`)  **Componente:** `modals/InsuranceModal.vue` + `ShipmentInsuranceBox.vue`, `modals/CustomsModal.vue` + `ShipmentCustomsBox.vue`  **Envia:** `POST /ajax_shipment_crud` (via borrador).
- **Permisos:** `readonly('assicuraz_imp'|'id_valuta_assic'|'dogana_imp'|'id_valuta_dogana'|'dogana_descri')` con factura.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Valor asegurado (`assicuraz_imp`) | `type=number min=0` | No | divisa visible solo si > 0 |
| Divisa del seguro (`id_valuta_assic`) | `v-autocomplete` siglas | Si cuando hay importe | sigla cruda (sin conversion), regla `currencyIso` |
| Valor en aduana (`dogana_imp`) | `type=number min=0` | No | |
| Divisa aduana (`id_valuta_dogana`) | `v-autocomplete` | Si con importe | el servidor traduce a id |
| Contenido (`contenuto`), Descripcion (`dogana_descri`) | texto / textarea | No | sin longitud en cliente |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-14-01 | Declarar seguro en EUR | 1000 | Guarda `assicuraz_imp=1000`; el card Accesorios muestra el valor formateado | P0 | Auto |
| SHP-14-02 | Seguro con divisa no EUR | USD | Se guarda la sigla; formateo con la sigla (nunca el id numerico) | P0 | Auto |
| SHP-14-03 | Aduana con descripcion y contenido | 500 EUR + textos | Persisten `dogana_imp`, `dogana_descri`, `contenuto` | P0 | Auto |
| SHP-14-04 | Valor negativo | -1 | Rechazado por `nonNegativeNumber` al guardar; mensaje en italiano fijo ("non può essere negativo") | P0 | Auto |
| SHP-14-05 | Divisa invalida | sigla de 2 letras | `currencyIso`: "codice valuta non valido (3 lettere, es. EUR)" | P1 | Auto |
| SHP-14-06 | Listado de divisas no disponible | Falla `api_currency_day` | La lista se queda solo con EUR (fallback) | P2 | Auto |
| SHP-14-07 | Importe a 0 oculta divisa | Poner 0 | Campos dependientes ocultos; el valor previo de divisa permanece | P2 | Auto |
| SHP-14-08 | Expedicion facturada | Con factura | Readonly | P0 | Auto |

- **Riesgos / dudas:** los mensajes de `shipmentRules.ts` estan en italiano fijo, sin i18n (afecta al caso de i18n en 5 idiomas). El tratamiento de la divisa del seguro (sigla en columna `id_valuta_assic`) difiere del de COD/aduana (traducida a id): ver comentarios en `ShipmentInsuranceBox.vue`.

---

### SHP-15 · Suplementos de la expedicion (cliente y proveedor)
- **Ruta/pantalla:** detalle V2, modal `supplements`  **Componente:** `modals/SupplementsModal.vue`, `ShipmentSupplementsBox.vue`, `ShipmentSupplierSupplementsBox.vue`, `ShipmentAddSupplementDialog.vue`  **Envia:** `PUT/POST /ajax_shipment_supplements` (guardado de la lista), `GET ...?op=prices`, calculo `supplcalcola` via `supplementsService.calculate`.
- **Permisos:** no determinado en cliente.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Activo | `v-switch` por fila | - | persiste al instante (`toggleAt`); revierte si falla |
| Precio proveedor (`fix_priceF`) y precio cliente (`fix_priceC`) | `type=number min=0 step=0.01` prefijo "EUR" | No | vacio = quita override (null, el motor recalcula); se normaliza a 2 decimales; guardado con debounce de 600 ms |
| Boton recalcular ("P") | boton | - | pone `prezzo` con el resultado y `prezzo_lk='N'` |
| Dialogo "Anadir suplemento" | busqueda + checkboxes por grupo | Si (>=1 para anadir) | oculta ya asignados por lado (`delta` 'N' cliente / 'S' proveedor); nombre IT o EN segun idioma |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-15-01 | Anadir varios suplementos a la vez | Marcar 3 y Anadir | Se crean con `delta` correcto segun lado; ya no salen en el catalogo | P0 | Auto |
| SHP-15-02 | Activar/desactivar | Conmutar | Persiste al instante; si el servidor falla, el switch vuelve a su estado | P0 | Auto |
| SHP-15-03 | Precio cliente vacio | Borrar el campo | Se envia null (el motor reprecia); no se guarda 0 | P0 | Auto |
| SHP-15-04 | Precio cero explicito | 0 | Se guarda "0.00" (cobrar nada), distinto de vacio | P0 | Auto |
| SHP-15-05 | Precio negativo | -5 | Sin validacion en la rama de blur (solo `min=0` del navegador); revisar respuesta del servidor | P0 | Auto |
| SHP-15-06 | Precio con muchos decimales | 12.3456 | Se normaliza a 12.35 antes de enviar | P1 | Auto |
| SHP-15-07 | Edicion rapida de dos precios | Editar F y C seguidos | Un unico guardado debounced con ambos valores (sin carrera) | P1 | Auto |
| SHP-15-08 | Recalcular con "P" | Pulsar | Toast con importe formateado; `prezzo_lk='N'`; error visible si falla | P1 | Manual |
| SHP-15-09 | Salir de la pantalla durante el debounce | Editar y cerrar en <600 ms | El timer se cancela en `onBeforeUnmount`: el cambio se pierde; documentar | P1 | Auto |
| SHP-15-10 | Expedicion facturada | Con factura | Servidor decide (suplementos en READONLY segun comentarios); UI: no determinado | P0 | Manual |

- **Riesgos / dudas:** (1) El prefijo "EUR" es fijo mientras el resto de importes usa la divisa objetivo del cliente (`useTargetCurrency`); no determinado en que moneda se guardan los fix_price. (2) Guardar la lista completa en cada cambio puede pisar cambios concurrentes de otro usuario. (3) `Number(trimmed)||0` convierte texto no numerico en 0.

---

### SHP-16 · Proforma (factura proforma de aduana)
- **Ruta/pantalla:** detalle V2, modal `proforma`  **Componente:** `modals/ProformaModal.vue` (V1: `ShipmentProformaDialog.vue`)  **Envia:** `GET /api_proforma_crud?id_spedizione=` (listado `{data, pagination}`) y despues `GET /api_proforma_crud?id=` (ficha con `items`); guardar = `PUT /api_proforma_crud {id, ...cabecera, items}` si ya existe o `POST {id_spedizione, ...}` si no (la API admite una sola proforma por expedicion: 409 `PROFORMA_DUPLICATE`); `POST /api_proforma_file {shipment_id}` devuelve el PDF binario, que se abre como blob; `POST /api_proforma_duplicate`. Corregido el 2026-11-03: antes se leia `{success, proforma}`, que la API no devuelve, y el modal salia siempre vacio.
- **Permisos:** no determinado en cliente.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Pais de origen (`iso_paese_origine`) | `v-text-field` libre | No | sin formato ISO en cliente |
| Motivo de exportacion | `v-autocomplete`: muestra `descriz`, guarda el codigo `sigla_dhl` | No | catalogo de `api_proforma_lookup?type=motivi` |
| Divisa (`id_valuta`) | `v-autocomplete` por id numerico | No | FK `valute.id` |
| Fecha | `type=date`, hoy por defecto | No | |
| Lineas: descripcion, voce doganale, cantidad, unidad, peso neto, peso bruto, unidad de peso (K/L), valor | texto/numeros `min=0` | No | total mostrado = suma(valor x cantidad) |
| Anadir / eliminar linea; Guardar; Generar PDF | botones | - | PDF deshabilitado sin lineas; guarda antes |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-16-01 | Crear proforma con 2 lineas | Cabecera + 2 lineas | `POST` OK; toast; reabrir recupera cabecera y lineas | P0 | Auto |
| SHP-16-02 | Total calculado | 2 x 10.00 + 1 x 5.50 | Total 25.50 formateado | P1 | Auto |
| SHP-16-03 | Guardar sin lineas | Sin items | El servidor decide (el controlador no impone items); comprobar | P1 | Auto |
| SHP-16-04 | Cantidad/peso/valor negativos | -1 | Sin validacion cliente (`min=0` orientativo) | P0 | Auto |
| SHP-16-05 | Generar PDF con guardado fallido | Forzar error en `save` | `generatePdf` continua tras `save()` aunque haya fallado (no comprueba el resultado) y genera el PDF con datos antiguos | P0 | Auto |
| SHP-16-06 | Motivo fuera del catalogo | Texto libre | El autocomplete admite solo items; comprobar si acepta valor libre | P2 | Auto |
| SHP-16-07 | Pais origen con formato incorrecto | "Spain" | Se envia tal cual; el servidor decide | P1 | Auto |
| SHP-16-08 | Expedicion sin id aun | - | Botones deshabilitados (`!shipmentId`) | P2 | Auto |
| SHP-16-09 | El PDF se abre en pestana nueva | Pulsar PDF | `window.open(url)`; si el navegador bloquea el popup se pierde el resultado | P2 | Manual |

- **Riesgos / dudas:** `ProformaModal.vue:generatePdf` ignora el resultado de `save()`. La modal esta dentro de `ModalWrapper always-draft` pero guarda con su propio `save`, por lo que el aviso de "cambios sin guardar" no refleja las lineas editadas. Codigos ISO y voces doganales sin validar.

---

### SHP-17 · Declaracion de mercancias peligrosas (DGR)
- **Ruta/pantalla:** detalle V2, modal `dgr` (card `AddebitiCard`)  **Componente:** `components/shipment/dgr/DgrDeclarationDialog.vue`, `UnSubstanceAutocomplete.vue`  **Envia:** `dgrService.saveDeclarations` (POST que reemplaza el conjunto, `services/dgr.service.ts`), carga `getDeclarations`.
- **Permisos:** no determinado.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Sustancia UN | autocomplete de catalogo | Si por fila (Guardar deshabilitado si falta) | al elegir hereda UN, nombre, clase, PG |
| Modo de transporte | `v-select` FR / LQ / EQ | Si | |
| Cantidad | `type=number min=0` | No | aviso si LQ supera `lq_max_per_package` y bloquea Guardar |
| Unidad | KG / L | No | |
| Anadir / quitar fila | botones | - | |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-17-01 | Declarar UN3480 modo FR | 1 fila | Guarda y cierra; reabrir recupera la fila | P0 | Auto |
| SHP-17-02 | LQ por encima del maximo por bulto | LQ, cantidad > max | Aviso `lq_exceeded` y Guardar deshabilitado | P0 | Auto |
| SHP-17-03 | Fila sin sustancia | Fila vacia + otra valida | Guardar deshabilitado (`canSave`) | P1 | Auto |
| SHP-17-04 | Quitar la ultima fila y guardar | 0 filas | El POST reemplaza el conjunto: queda sin declaraciones; confirmar que borra las existentes | P0 | Manual |
| SHP-17-05 | Cambiar de LQ a FR con cantidad alta | Pasar modo | El aviso desaparece (solo aplica a LQ) | P1 | Auto |
| SHP-17-06 | Cantidad vacia/0 en modo EQ | - | Definir regla del servidor | P1 | Manual |
| SHP-17-07 | Error del servidor al guardar | Forzar error | Toast `save_error` y el dialogo permanece abierto | P1 | Auto |

- **Riesgos / dudas:** el POST "reemplaza el conjunto" (comentario en `save`), por lo que dos operadores concurrentes pueden pisarse. Reglas de cantidad solo orientativas (el backend las "re-valida", no verificado).

---

### SHP-18 · Seleccion de servicio (cliente y proveedor) y servicio economico
- **Ruta/pantalla:** detalle V2, `ServizioCard` > modales de servicio  **Componente:** `overview/ServizioCard.vue`, `service/ShipmentServiceClienteModal.vue`, `service/ShipmentServiceFornitoreModal.vue`, `stores/service_selection.store.ts`  **Envia:** `POST /unified_express_service_list_by_shipment` (lista), `POST /unified_rate_fornitore`, `POST /api_express_service_select {shipment_id, service_id, fornitore_id?}`, `DELETE /api_express_service_select?shipment_id=`.
- **Permisos:** `fornitore_lk` bloquea reasignar; `carico_lk` bloquea servicio/fornitore (servidor).
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Buscador de servicios | `v-text-field` | No | filtro local |
| Lista de servicios (cliente) | filas clicables | Si para asignar | con `use_live_rates:true` y `force_recalculate` opcional |
| Lista de servicios del courier | filas clicables, ordenable | Si | asigna `id_servizio_fornitore` sin tocar `id_servizio`; exige `id_servizio_fornitore>0` ("must_select_client_first") |
| Servicio no disponible | confirmacion | - | `confirmPickUnavailable` permite asignar uno no disponible (paridad legacy) |
| Servicio economico (`id_servforn_eco`) | `type=number min=0` | No | persiste al blur |
| Candado de fornitore (`fornitore_lk`) | boton | - | |
| Vista de depuracion (rate/timing) | paneles | - | |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-18-01 | Listar servicios del cliente | Abrir modal | Lista con precios; sin tocar datos (solo tarifa) | P1 | Auto (solo con UPSTREAM_DENY_ACTIONS activo: usa tarifas en vivo) |
| SHP-18-02 | Asignar servicio al cliente | Elegir uno | `api_express_service_select`; `carico`, `fuel_surc`, `costo_previsto`, fornitore y suplementos por defecto se recalculan y la card se refresca | P0 | Manual (tarifas; sandbox) |
| SHP-18-03 | Asignar courier manualmente | Elegir courier y servicio | Solo `id_servizio_fornitore`; `id_servizio` comercial intacto; cierra el modal | P0 | Manual |
| SHP-18-04 | Servicio de courier sin cliente previo | `id_servizio_fornitore=0` | Error `must_select_client_first`; sin llamada | P1 | Auto |
| SHP-18-05 | Asignar servicio no disponible | Fila no disponible > confirmar | Se asigna; aviso previo con texto de confirmacion | P1 | Manual |
| SHP-18-06 | Quitar asignacion | DELETE | Limpia servicio/fornitore; recalculo | P0 | Manual |
| SHP-18-07 | Precio bloqueado (`carico_lk=S`) | Intentar asignar | Respuesta con `price_locked`; la UI no sobreescribe el precio | P0 | Auto |
| SHP-18-08 | Servicio economico no numerico/negativo | -3 | `min=0` solo atributo; el servidor decide | P2 | Auto |
| SHP-18-09 | Doble clic en una fila | 2 clics | `selectedKey` evita doble asignacion | P1 | Auto |

- **Riesgos / dudas:** `listClient` usa por defecto `use_live_rates: true` (consulta tarifas reales de transportistas solo para ver la lista). El detalle del flujo de `assignFornitoreService` y de `acceptRfqOffer` no se leyo completo (1062 y 1242 lineas); marcado "no determinado" salvo lo citado.

---

### SHP-19 · Generar AWB, anular AWB, etiquetas y envio de LDV
- **Ruta/pantalla:** detalle V2, `ServizioCard`  **Componente:** `overview/dialogs/GenerateAwbDialog.vue`, `AwbResetDialog.vue`, `AwbSuccessDialog.vue`, `CourierLabelsDialog.vue`, `TmweLabelDialog.vue`, `ShareLabelModal.vue`, `composables/useAwbGeneration.ts`  **Envia:** `GET /ajax_validate_before_ldv?shipment_id=`; `POST` de generacion (`labelsService.generateCourierLabel` con `force_courier:true, convert_to_jpg:true`); `POST /reset_shipment_awb {shipment_id}`; `GET /api_send_ldv_to_mittente_compat?shipment_id=`; correo de etiqueta (`label_share.service`).
- **Permisos:** servidor decide produccion/sandbox segun la cuenta del courier (`testing`); sin gating en cliente.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Confirmar generacion | dialogo con validacion previa | Si | requiere courier asignado (`confirm(hasCourier)`); el boton se bloquea si hay errores bloqueantes o validando; muestra avisos y fecha de envio ajustada |
| Anular AWB | dialogo de confirmacion | Si | llama a `reset_shipment_awb`; limpia localmente `AWB_forn` |
| Compartir etiqueta | `v-select` (etiqueta del courier / LDV) + compositor de email (destinatarios del catalogo o manuales, CC) | Si destinatario | falla si no hay destinatarios validos (`no_valid_recipients`) |
| Enviar LDV al remitente | boton | - | |
| Reservar recogida junto con el AWB | informativo (`willBookPickup`) | - | |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-19-01 | Generar sin courier asignado | Sin `fornitore` | Toast de aviso `assign_fornitore_first`; no se abre el dialogo | P0 | Auto |
| SHP-19-02 | Validacion previa con errores | Datos incompletos | Lista de errores y boton Generar deshabilitado con tooltip | P0 | Auto |
| SHP-19-03 | Validacion previa con solo avisos | Avisos | Se puede generar; avisos visibles | P0 | Auto |
| SHP-19-04 | Fecha de envio pasada | `data_sped0` anterior a hoy | Se anuncia que se ajusta (`shipDateAdjusted`) | P1 | Auto |
| SHP-19-05 | Generar AWB real | Courier con cuenta sandbox | Devuelve `master_tracking_number`, dialogo de exito, card actualizada sin recarga completa | P0 | Manual (solo sandbox; nunca contra produccion) |
| SHP-19-06 | Booking con respuesta vacia | Tracking vacio con `success` | Toast de aviso `courier_timeout`, no se cierra el flujo | P0 | Manual (solo sandbox) |
| SHP-19-07 | Error del courier | `error` como string u objeto | Toast `awb_not_generated` con mensaje | P0 | Manual (solo sandbox) |
| SHP-19-08 | Doble clic en Generar | Dos clics | Un solo POST (`generating`) | P0 | Auto (solo con UPSTREAM_DENY_ACTIONS activo) |
| SHP-19-09 | Anular AWB | Confirmar | AWB archivado, `awb_cleared`, campo vacio en la card; tracking no deja de existir en el courier | P0 | Manual (solo sandbox) |
| SHP-19-10 | Compartir etiqueta sin destinatarios | Lista vacia | Error en el compositor; no se envia | P1 | Auto (solo con UPSTREAM_DENY_ACTIONS activo) |
| SHP-19-11 | Enviar LDV al remitente | Pulsar | Email real al remitente; toast de resultado | P0 | Manual (solo sandbox) |
| SHP-19-12 | Descarga/impresion de etiquetas (todas, PDF, imagen) | Con AWB | Formatos correctos, nombre de fichero; `Descargar todo` cuando hay mas de una | P1 | Manual |

- **Riesgos / dudas:** el dialogo de generacion no distingue visualmente cuenta de prueba y produccion para el operador. La anulacion del AWB (`reset_shipment_awb`) no cancela el envio en el courier (a confirmar con `awb_cleared`). El texto de error del courier se muestra tal cual.

---

### SHP-20 · Recogida (pickup): ventana, estado, reserva y cancelacion
- **Ruta/pantalla:** detalle V2, modal `pickup_schedule`  **Componente:** `modals/PickupScheduleModal.vue` + `ShipmentPickupScheduleBox.vue` (V1 `ShipmentPickupSchedule.vue`)  **Envia:** campos via borrador `POST /ajax_shipment_crud`; reserva `POST /reserve_pickup {shipment_id, confirm:true}`; cancelacion `GET /cancel_pickup?shipment_id=`.
- **Permisos:** `readonly('presa_*')`; reserva visible si `presa_fornitore==='S'` y no readonly.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Numero de recogida (`presa_numero`) | texto | No | un valor distinto de ""/"0" implica recogida reservada |
| Estado (`presa_stato`) | `v-select` N/W/F/C/E/T | No | 6 codigos reales del legacy |
| Hora desde/hasta; alternativas | texto (formato libre) | No | sin mascara ni validacion de rango; placeholder "00:00:00" tratado como vacio en la card |
| Fecha de envio al remitente (`presa_invio_mitt`) | `type=date` | Si para reservar | no puede ser anterior a hoy (`isBeforeToday`) |
| Recogida fija / Recogida por courier | switches (S/N) | No | |
| Notas | `v-textarea` | No | |
| Reservar recogida / Cancelar recogida | botones | - | reserva exige `origin_address` y fecha valida; alerta de pasos si ya hay AWB |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-20-01 | Reservar sin direccion de origen | Sin `origin_address` | Toast `toast_reserve_missing_address`; sin llamada | P0 | Auto |
| SHP-20-02 | Reservar con fecha pasada o vacia | fecha de ayer | Toast `toast_reserve_invalid_date`; sin llamada | P0 | Auto |
| SHP-20-03 | Reservar con AWB existente | Fecha futura | Alerta con pasos y confirmacion explicita; luego `reserve_pickup` | P0 | Manual (solo sandbox) |
| SHP-20-04 | Reservar con exito | - | Toast con `pickup_code`; recarga del envio; `presa_numero` informado | P0 | Manual (solo sandbox) |
| SHP-20-05 | Cancelar recogida | Con recogida reservada | `cancel_pickup`; toast; recarga | P0 | Manual (solo sandbox) |
| SHP-20-06 | Ventana horaria incoherente | desde 18:00, hasta 09:00 | Sin validacion cliente; el servidor/courier decide | P1 | Manual |
| SHP-20-07 | Formato de hora libre | "9", "25:99", "abc" | Sin mascara; definir resultado | P1 | Auto |
| SHP-20-08 | Alternar Recogida por courier | Cambiar switch | `presa_fornitore` S/N en el borrador; aparece/desaparece el boton de reserva | P1 | Auto |
| SHP-20-09 | Estado E en el filtro del listado | Estado E | No filtrable en SHP-04 (hueco) | P2 | Auto |
| SHP-20-10 | Cancelar recogida mediante GET | Revisar peticion | La cancelacion usa query (`GET`), accion con efecto: confirmar que el BFF/servidor la admite solo con sesion y CSRF adecuados | P1 | Manual |

- **Riesgos / dudas:** (1) `pickupService.cancel` es `GET /cancel_pickup` con efecto secundario (`pickup.service.ts:21-24`). (2) Cancelar no pide confirmacion en `onCancelPickup`. (3) La comparacion `isBeforeToday` usa `toISOString` (UTC), puede desfasar un dia respecto a la hora local. (4) Los campos horarios no estan tipados.

---

### SHP-21 · Fechas y estado de entrega
- **Ruta/pantalla:** detalle V2, modales `dates` y `stato`  **Componente:** `modals/DatesModal.vue` + `ShipmentDatesBoxV2.vue`; `modals/StatoModal.vue` + `ShipmentDeliveryBox.vue`, `LifecycleFlow`, `ShipmentTimelineCard`  **Envia:** `POST /ajax_shipment_crud` (via borrador); `POST /api_notification_trigger {type:'delivery', entity_id}`.
- **Permisos:** `readonly('data_sped0'|'data_sped1'|'consegna_stato')` con factura.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Fecha de alta `data_sped0` | `datetime-local` | No | |
| Fecha de envio `data_sped1` | `date` | No | |
| Entrega prevista `data_consegna_prevista` | `datetime-local` | No | |
| Fecha del courier `data_corriere` | `date` | No | |
| Estado de entrega `consegna_stato` | `v-autocomplete` del catalogo `tracking_pubblico` | No | "7" = consegnata |
| Fecha de entrega `consegna_data` | texto | No | con estado 7 + fecha dispara el ofrecimiento de email |
| Firma de entrega `consegna_firma` | texto | No | imagen de firma opcional (se oculta si falta) |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-21-01 | Cambiar `data_sped1` | Nueva fecha | Se guarda al pulsar Guardar; recalcula plazos | P1 | Auto |
| SHP-21-02 | Valor `0000-00-00 00:00:00` en campos datetime-local | Envio con fecha cero | El input no puede mostrar el valor; no debe romper ni enviar basura al guardar | P1 | Auto |
| SHP-21-03 | Marcar entregado con fecha | estado=7 + fecha | `confirm()` nativo "notificar"; si acepta se envia el email de entrega al remitente | P0 | Manual (solo sandbox) |
| SHP-21-04 | Declinar la notificacion | Cancelar el `confirm` | No se envia email; el estado queda en el borrador | P0 | Auto |
| SHP-21-05 | Cancelar la modal tras marcar entregado | Estado 7 + aceptar mail + Cancelar modal | El email ya salio aunque el estado no se guarda (el envio ocurre antes de `commitDraft`) | P0 | Manual (solo sandbox) |
| SHP-21-06 | Entrega antes del envio | consegna_data < data_sped1 | Sin regla cruzada; definir comportamiento | P1 | Auto |
| SHP-21-07 | Estado de entrega sin catalogo | Falla la carga | Autocomplete vacio; no bloquea el resto | P2 | Auto |

- **Riesgos / dudas:** `ShipmentDeliveryBox.vue:onConsegnaCommit` envia el correo de entrega dentro del modo borrador: el cambio de estado aun no esta guardado y el usuario puede cancelar. La notificacion usa `window.confirm` (no el sistema de dialogos). Tipos de fecha mezclados (`date`/`datetime-local`) y formato de entrada del servidor 'YYYY-MM-DD HH:MM:SS' (los `datetime-local` exigen 'T'): no determinado si el formato se convierte.

---

### SHP-22 · Banderas de gestion, controllata y control de factura del proveedor
- **Ruta/pantalla:** detalle V2, modales `flags` y `checkforn` (card `VerificheCard`)  **Componente:** `modals/FlagsModal.vue` + `ShipmentFlagsBox.vue`; `modals/CheckfornModal.vue` + `ShipmentCheckfornBox.vue` + `ShipmentSubcontractingDialog.vue`  **Envia:** `POST /ajax_shipment_crud` (via borrador); subcontratacion `POST /api_shipment_subcontracting {shipment_id,id_partner,action:'assign'|'remove'}`.
- **Permisos:** `readonly('noiva_art9'|'controllata')` con factura; otros flags sin gating cliente.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Esente IVA art.9 `noiva_art9`, Archiviata, Costo por verificar `costo_daverif`, Areas remotas `acc_aree_remote`, Fuera de medida `acc_auto_fuori_misura`, Candado precio `carico_lk`, Candado coste `costo_previsto_lk`, Entrega por nosotros `consegna_danoi`, Fermo deposito, Fissa corriere, Direccion erronea `badaddress` | checkboxes S/N | No | `commit()` envia 'S'/'N' |
| Verificada (`controllata`) | `v-select` S/N/O | No | |
| Email de entrega enviado, Dry ice, Dangerous goods, Pallet | checkboxes deshabilitados | - | solo informativos (son suplementos) |
| `checkforn` | `v-select` O/V/K/X/R/A | No | dominio completo del legacy |
| Factura proveedor (`id_fattura_p`) | numero solo lectura | - | |
| Subcontratacion | dialogo con partner | Si partner | asignar/quitar |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-22-01 | Marcar/desmarcar `noiva_art9` | Conmutar | 'S'/'N' en el borrador; se guarda; efecto fiscal en la factura | P0 | Auto |
| SHP-22-02 | Cambiar `controllata` a S, N, O | Cada valor | Persisten; la card de verificaciones lo refleja | P1 | Auto |
| SHP-22-03 | Archivar desde la modal | `archiviata` S | `archiviata` en el PATCH (via `update`, no `api_shipment_archive`); desaparece del listado archiviata=N | P1 | Auto |
| SHP-22-04 | Candado de precio desde banderas | `carico_lk` S | Ver SHP-12-04 | P0 | Auto |
| SHP-22-05 | Check proveedor con cada valor | O,V,K,X,R,A | Persiste; "OK" no existe en este dominio, mientras la card compara `checkforn==='OK'` | P1 | Auto |
| SHP-22-06 | Asignar y quitar subcontratista | Elegir partner > asignar > quitar | Llamadas `assign`/`remove`; lista actualizada | P0 | Manual |
| SHP-22-07 | Expedicion facturada | Con factura | `noiva_art9` y `controllata` disabled; el servidor tambien rechaza `checkforn`/`controllata` en facturadas | P0 | Auto |
| SHP-22-08 | Cancelar con cambios | Conmutar varios y Cancelar | Se descartan todos | P1 | Auto |

- **Riesgos / dudas:** (1) `VerificheCard.vue` considera "verificado" solo `checkforn === 'OK'`, valor que no existe en las opciones (O/V/K/X/R/A): el indicador puede no activarse nunca. (2) `FlagsBox` inicializa `controllata` a "S" si falta el dato (`|| "S"`) y marcaria como controlada una expedicion sin dato al guardar. (3) Flags enviados con `commit` aunque su valor no cambie, solo al conmutar (no determinado si hay filtrado). (4) `delivered_mail` se commitea desde un checkbox deshabilitado (inalcanzable).

---

### SHP-23 · Postfactura (importes reales y control de factura)
- **Ruta/pantalla:** detalle V2, modal `post_invoice` (card `CostiCard`)  **Componente:** `modals/PostInvoiceModal.vue` + `ShipmentPostInvoiceBox.vue`  **Envia:** `POST /ajax_shipment_crud` (via borrador).
- **Permisos:** `readonly('postfatt'|'post_fuel_surc'|'postfatt_txt')` con `id_fattura_a2>0`; `readonly('controllo_fatt')` con factura.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| `postfatt` (cargo post), `post_fuel_surc` | `type=number min=0` | No | |
| `postfatt_txt` | `v-textarea` | No | |
| `costo_reale`, `fuel_surc_cst`, `peso_fornit_reale` | `type=number min=0` | No | |
| `controllo_fatt` | `v-select` '0'/NO/CA/OK | No | |
| IDs de facturas (cliente, post, proveedor) | solo lectura | - | |
| Boton "Riaddebito" | abre SHP-08 | - | |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-23-01 | Registrar coste real y peso real del courier | 85.20 / 14.5 kg | Persiste; el margen y el riaddebito usan `peso_fornit_reale` | P0 | Auto |
| SHP-23-02 | Postfatt bloqueado tras segunda factura | `id_fattura_a2>0` | Campos readonly | P0 | Auto |
| SHP-23-03 | Valores negativos | -1 | `nonNegativeNumber` para `peso_fornit_reale` en guardar; `postfatt`, `costo_reale`, `post_fuel_surc` no tienen regla | P0 | Auto |
| SHP-23-04 | Pasar `controllo_fatt` a CA y abrir riaddebito | CA | El envio aparece en la vista "A aplicar" de SHP-07 | P0 | Auto |
| SHP-23-05 | `peso_fornit_reale` en facturada | Con factura | La UI lo deja editable (readonly solo para `fatturaPassivaClosed=false`), mientras el servidor lo bloquea | P0 | Auto |

- **Riesgos / dudas:** campos `postfatt`, `post_fuel_surc`, `postfatt_txt` se enlazan con `as never` por no estar tipados en `Shipment`. `peso_fornit_reale` y `costo_reale` aparecen tambien en SHP-09 y SHP-12 (dos editores del mismo dato).

---

### SHP-24 · Notas de la expedicion
- **Ruta/pantalla:** detalle V2, card `NoteCard` (edicion en linea) y modal `note`  **Componente:** `overview/NoteCard.vue`, `modals/NotesModal.vue` + `ShipmentNotesBox.vue`  **Envia:** card: `POST /ajax_shipment_crud` inmediato al perder el foco (sin borrador); modal: via borrador.
- **Permisos:** `readonly('note')`.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Nota interna (`note`), operativa (`note_operative`), para el destinatario (`note_x_destin`) | `v-textarea` (auto-grow en la card) | No | Esc cierra la edicion sin cancelar el valor; sin longitud maxima en cliente |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-24-01 | Editar nota en linea y salir del campo | Texto nuevo + blur | Guarda al instante con toast; vuelve al modo vista | P1 | Auto |
| SHP-24-02 | Pulsar Esc durante la edicion | Texto + Esc | Cierra el editor; el blur posterior igualmente guarda (el valor tecleado no se revierte): documentar | P1 | Auto |
| SHP-24-03 | Nota para destinatario | Texto | Se incluira en documentos/etiquetas segun backend (no determinado) | P1 | Manual |
| SHP-24-04 | Editar la misma nota en modal y card | Dos vias | Mismo campo; ultima escritura gana | P2 | Auto |
| SHP-24-05 | Expedicion facturada | Con factura | La nota sigue editable (`readonly('note')` no esta en la lista de bloqueo) | P2 | Auto |

- **Riesgos / dudas:** cada blur dispara un guardado y un toast "Saved". Esc no revierte el cambio (comentado como cierre simple).

---

### SHP-25 · Visibilidad para partners (partners 1 y 2)
- **Ruta/pantalla:** detalle V2, modal `partners`  **Componente:** `modals/PartnersModal.vue` + `ShipmentPartnersBox.vue`  **Envia:** `GET /api_shipment_partners?shipment_id`, `POST ... {shipment_id, action:'add'|'remove', partner_id}` (`partners.service.ts`).
- **Permisos:** `payload.can_add` habilita el alta; `canRemove(p)` por fila.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Partner a anadir | `v-autocomplete` remoto (2+ caracteres) | Si | boton Anadir deshabilitado sin partner/envio |
| Quitar partner | boton por fila | - | |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-25-01 | Anadir partner | Buscar y elegir | `action:'add'`; aparece con rol show1/show2; `can_add` se actualiza | P0 | Auto |
| SHP-25-02 | `can_add` falso (plazas ocupadas) | 2 partners ya | Chips de anadir deshabilitados | P1 | Auto |
| SHP-25-03 | Quitar partner permitido y no permitido | titolare vs show1 | Solo se puede quitar el que tiene `canRemove`; titular sin boton | P0 | Auto |
| SHP-25-04 | Anadir el mismo partner dos veces | repetir | Error del servidor o ya excluido | P1 | Auto |
| SHP-25-05 | Busqueda < 2 caracteres | 1 letra | Sin llamada, lista vacia | P2 | Auto |

- **Riesgos / dudas:** el endpoint exacto esta en `services/partners.service.ts` (no copiado aqui); la jerarquia de roles (`titolare/primary/show1/show2`) afecta a la visibilidad de datos de terceros.

---

### SHP-26 · Reasignar propietario (owner)
- **Ruta/pantalla:** detalle V2, chip de propietario  **Componente:** `owner/ShipmentOwnerChip.vue`  **Envia:** `GET /api_shipment_owner_options?shipment_id=`; escritura `POST /ajax_shipment_crud {item:{id, owner_user}}` (via `store.update`).
- **Permisos:** servidor: auditado y sujeto a `READONLY_FIELDS_INVOICED`; opciones limitadas a usuarios del partner propietario.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Nuevo propietario | `v-autocomplete` (carga perezosa al abrir) | Si | boton deshabilitado si no hay seleccion o es el actual |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-26-01 | Reasignar a otro usuario | Elegir usuario | `owner_user` cambia; el chip muestra el nombre; auditoria | P0 | Auto |
| SHP-26-02 | Mismo propietario | Elegir el actual | Boton deshabilitado | P2 | Auto |
| SHP-26-03 | Usuario fuera del partner por API | id ajeno | Rechazo del servidor | P0 | Manual |
| SHP-26-04 | Reasignar con borrador activo | Abrir una modal con cambios y reasignar | `store.update` se acumula en el borrador si hay uno activo (no persiste) | P1 | Manual |

- **Riesgos / dudas:** `reassign` usa `store.update`, que se bufferiza si hay un borrador abierto; el menu del chip no esta dentro de una modal, pero el borrador es global del store. `store.update` devuelve true sin llamar al servidor en ese caso, y el menu se cierra.

---

### SHP-27 · Metadatos (clave/valor) y cheques COD
- **Ruta/pantalla:** detalle V2, card `MetadatiCard`  **Componente:** `overview/MetadatiCard.vue`, `services/metadata.service.ts`  **Envia:** `ajax_shipment_metadata` (alta/edicion/borrado de pares), `cod_captures.service` (lectura de fotos).
- **Permisos:** `canEdit = Boolean(store.id)`.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Clave | `v-text-field` | Si (Guardar deshabilitado sin clave) | deshabilitada al editar |
| Valor | `v-text-field` | No | solo escalares; claves de integracion (`ups_pickup`, `fedex_*`, `awb_reso_tnt`, `assegni`) ocultas |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-27-01 | Anadir par nuevo | clave "k1", valor "v1" | Aparece en la lista editable ordenada alfabeticamente | P1 | Auto |
| SHP-27-02 | Editar valor y borrar par | Editar > borrar | Confirmacion de borrado; el par desaparece | P1 | Auto |
| SHP-27-03 | Clave duplicada o reservada | "assegni" o "ups_pickup" | Comportamiento al anadir una clave oculta: no determinado | P1 | Auto |
| SHP-27-04 | Ver foto de cheque COD | Fila con `assegni` | Dialogo con la imagen; sin captura, sin enlace | P2 | Manual |
| SHP-27-05 | Valor vacio / clave con espacios | " " | Definir regla (solo `!formKey`) | P2 | Auto |

- **Riesgos / dudas:** `disabled` solo mira `!formKey` (no `trim()`). El detalle de la API de metadatos no se leyo.

---

### SHP-28 · Chat de la expedicion y archivos adjuntos
- **Ruta/pantalla:** detalle V2, drawers de chat y documentos  **Componente:** `drawers/ChatDrawer.vue`, `ShipmentChatDialog.vue`, `drawers/DocumentsDrawer.vue`, `ShipmentFilesBox.vue`, `stores/files.store.ts`  **Envia:** `chatService.send` (mensaje), `POST /ajax_shipment_files` (subida multipart, borrado, visibilidad), SSE de mensajes en vivo (`useChatRealtime`).
- **Permisos:** visibilidad de ficheros por destinatario; ambito `ext`/`int`.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Mensaje | textarea `maxlength=4000` | Si (`draft.trim()`) | envio deshabilitado vacio/enviando |
| Subida de ficheros | zona de arrastre / selector | Si (>=1) | sube uno a uno (`for ... await upload`); tipos/tamano: no determinado en cliente |
| Visibilidad por destinatario, borrar | conmutadores / boton | - | |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-28-01 | Enviar mensaje | Texto | Aparece alineado como "me"; contador leido/no leido | P1 | Auto |
| SHP-28-02 | Mensaje de 4000 caracteres y 4001 | Limite | `maxlength` impide el 4001 | P2 | Auto |
| SHP-28-03 | Mensaje solo espacios | "   " | Boton deshabilitado | P2 | Auto |
| SHP-28-04 | Mensaje en vivo de otro usuario | Segundo cliente | Aparece sin recargar (SSE) y marca leido si el drawer esta abierto | P1 | Manual |
| SHP-28-05 | Subir varios ficheros | 3 ficheros | Suben en serie; progreso `uploading`; aparecen en la lista | P1 | Auto |
| SHP-28-06 | Cambiar visibilidad de un fichero | Alternar por destinatario | `action:'visibility'`; persiste | P1 | Auto |
| SHP-28-07 | Borrar fichero | Confirmar | `action:'delete'`; desaparece | P1 | Auto |
| SHP-28-08 | Fichero grande o extension no permitida | Fichero pesado/ejecutable | Limites del servidor: no determinados en el front | P1 | Manual |

- **Riesgos / dudas:** no se leyeron los limites de tamano/tipo de subida (cliente ni servidor). El chat y los ficheros pueden notificar a terceros (efectos de correo): no determinado.

---

### SHP-29 · Solicitud de oferta (RFQ), adjudicacion y oferta a partners (compositor de email)
- **Ruta/pantalla:** detalle V2, `ServizioCard`  **Componente:** `ExpressRfqModal.vue`, `ExpressAwardModal.vue`, `PartnerOfferModal.vue`, `OfferRepliesModal.vue` (sobre `@shared/email` EmailComposer)  **Envia:** `express_offers` (`distribute`, `notifyWinner`), `partner_offers.service` (`preview`, `distribute`), `email_preview`.
- **Permisos:** no determinado en cliente.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Destinatarios | catalogo (couriers o partners por id) + manuales | Si (>=1 con id) | RFQ y oferta a partners: `need_courier` / `need_partner` si no hay id |
| CC | emails manuales | No | solo se envian los que contienen "@" |
| Idioma | select ENG/ITA/SPA/FRA (oferta a partners por defecto ITA) | Si | |
| Cuerpo HTML | editor WYSIWYG | Si | la nota separada no existe |
| Modo Q / I (oferta a partners) | botones | Si | cambia plantilla EXPQUOT/PARTINFO |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-29-01 | RFQ sin destinatarios del catalogo | Solo emails manuales | Error `need_courier`; no se envia | P0 | Auto (solo con UPSTREAM_DENY_ACTIONS activo) |
| SHP-29-02 | RFQ a 2 couriers con CC | 2 couriers + 1 CC valido y 1 invalido | Envia solo a los CC con "@"; resultado `sent=2` | P0 | Manual (solo sandbox) |
| SHP-29-03 | Vista previa por idioma | Cambiar ENG a ITA | Previsualizacion recargada | P1 | Auto |
| SHP-29-04 | Notificar al ganador | Oferta elegida | Un unico destinatario (el courier); email con idioma elegido; `sent:1` | P0 | Manual (solo sandbox) |
| SHP-29-05 | Cambio Q/I | Alternar modo | Nueva plantilla y preview | P1 | Auto |
| SHP-29-06 | Oferta a partners sin ninguno seleccionado | - | Error `need_partner` | P0 | Auto (solo con UPSTREAM_DENY_ACTIONS activo) |
| SHP-29-07 | Aceptar/reiniciar una oferta de respuesta | `acceptRfqOffer`/`resetRfqOffer` | Actualiza el servicio/fornitore asignado; no determinado el detalle | P0 | Manual (solo sandbox) |

- **Riesgos / dudas:** estas modales envian correos reales a transportistas/partners; las pruebas Auto deben ejecutarse con el bloqueo de acciones. No se valido el formato de los emails manuales (solo "@" en CC).

---

### SHP-30 · Bascula WiFi (pesaje por segnacollo)
- **Ruta/pantalla:** detalle V2, modal `wifi_scale` (icono en `MetricsCard`)  **Componente:** `weights/WifiScaleDialog.vue`, `services/wifi_scale.service.ts`  **Envia:** `GET ...?op=find&needle=`, `POST ...?op=apply {shipment_id, collo_id, peso, dim_a, dim_l, dim_p}`, `GET ...?op=recent`.
- **Permisos:** no determinado.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Segnacollo | `v-text-field` (buscar al pulsar) | Si | boton deshabilitado vacio |
| Peso (kg), alto, ancho, profundo (cm) | `type=number`, `v-model.number` | Si | precarga lo existente; envia `Number()` sin validar |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-30-01 | Segnacollo inexistente | "ZZZ" | Mensaje `not_found`; formulario inactivo | P1 | Auto |
| SHP-30-02 | Aplicar lectura valida | peso 12.3 + dimensiones | `apply`; toast `toast_weighed`; formulario limpio manteniendo contexto | P0 | Auto |
| SHP-30-03 | Peso cero o negativo | 0, -2 | No se valida en cliente; el servidor decide | P0 | Auto |
| SHP-30-04 | Segnacollo de otra expedicion | colli de otro envio | Aplica al `shipment_id` devuelto por `find`, no al abierto: comprobar aviso | P0 | Manual |
| SHP-30-05 | Error al aplicar | Forzar `success=false` | `applyError` visible; datos conservados | P1 | Auto |

- **Riesgos / dudas:** el dialogo opera sobre el `shipment_id` devuelto por la busqueda, no sobre la expedicion abierta. Campos vacios se convierten en 0.

---

### SHP-31 · Consola de tracking
- **Ruta/pantalla:** `/tracking` (`tracking`)  **Componente:** `modules/tracking/components/TrackingConsole.vue` (+ `pages/TrackingManagerPage.vue`, `services/trackingManagement.service.ts`)  **Envia:** `GET /admin_tracking_api?limit&offset&courier&search`; `POST /admin_tracking_api {action:'single', shipment_id}`; `POST {action:'batch_all', couriers}`; sondeo `GET ?job_id=` cada 2 s.
- **Permisos:** `Tracking_Management_Controller` es `admin_only` (anagrafica_id = 1). La ruta no declara `requiresAdmin` ni hay gating en cliente.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Filtro courier | `v-select` clearable | No | reinicia offset |
| Busqueda | `v-text-field` clearable | No | debounce 400 ms |
| Paginacion | `v-pagination` (limit 50) | - | |
| Boton "Track" por fila | boton | - | sincrono; exito si `processed>0`, si no mensaje `single_no_update` |
| Dialogo "Lanzar tracking" | `v-select multiple chips` | No | vacio = TODOS los couriers; barra de progreso, errores acumulados; el dialogo es persistente mientras corre |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-31-01 | Usuario no admin abre la pantalla | Perfil normal | Listado/POST devuelven 403 y se muestra el error; el boton de lanzar sigue visible | P0 | Auto |
| SHP-31-02 | Filtro por courier + busqueda | DHL + "123" | Pagina 1; recuento y estadisticas de email coherentes | P1 | Auto |
| SHP-31-03 | Lanzar sin seleccionar couriers | Lista vacia | El boton cambia a `launch_all` y el texto avisa de que se lanzan todos; confirma el envio sin pedir doble confirmacion | P0 | Manual (solo con UPSTREAM_DENY_ACTIONS activo; consulta couriers y puede enviar emails y abrir giacenze) |
| SHP-31-04 | Lanzar para couriers concretos | MyTNT + DHL | `couriers:[...]`; progreso hasta `done`; recarga del listado | P0 | Manual (solo sandbox) |
| SHP-31-05 | Job fallido | `status='failed'` | Error con `error_msg`; el dialogo pasa a "terminado" | P1 | Auto |
| SHP-31-06 | Error de red durante el sondeo | Cortar red | El sondeo continua indefinidamente (el `catch` lo ignora); sin tope de reintentos ni aviso | P1 | Auto |
| SHP-31-07 | Track de una fila sin novedades | `processed=0` | Mensaje de aviso con el id (no es un fallo real) | P2 | Manual (solo sandbox) |
| SHP-31-08 | Fecha de entrega cero | consegna_data "0000-00-00..." | Se muestra "—" | P2 | Auto |
| SHP-31-09 | Salir de la pagina durante el job | Navegar fuera | Se cancela el timer; el job sigue en servidor | P2 | Auto |

- **Riesgos / dudas:** (1) Sin gating de UI: el menu y los botones aparecen aunque el perfil no sea admin. (2) El sondeo no tiene limite (`TrackingConsole.vue:pollJob`) ni distingue error transitorio de job inexistente. (3) "Lanzar todo" no pide confirmacion. (4) El dialogo `batch` cerrado con la tecla Esc mientras `batchDone` deja el estado anterior hasta reabrir (`openBatch` lo reinicia).

---

### SHP-32 · Filtros de giacenze
- **Ruta/pantalla:** `/giacenze`  **Componente:** `modules/giacenze/pages/GiacenzeListPage.vue` (panel superior + chips)  **Envia:** `GET /api_inventory_crud` (+ `GET` de aging).
- **Permisos:** ninguno en cliente.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| ID expedicion | `type=number`, `v-model.number` | No | chip si `!= null` |
| Texto (`q`) | texto | No | |
| ID cliente | `type=number` | No | |
| Operacion | `v-select` A/C/N/R/E | No | |
| Apertura desde / hasta | `type=date` | No | |
| Solo abiertas | checkbox | No | |
| Indicadores desde la home (`?indicator=`) | URL | - | open_giacenze, giacenze_overdue_15, awaiting_client_response |
| Click-to-filter (expedicion, operacion) | celdas | - | |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-32-01 | Filtrar por expedicion y operacion | id 123 + "R" | Lista acotada; chips activos y quitables | P2 | Auto |
| SHP-32-02 | Vaciar el campo numerico tras usarlo | Escribir y borrar | `v-model.number` deja `""`: comprobar que no se envia ni genera chip "vacio" (chip usa `!= null`) | P2 | Auto |
| SHP-32-03 | Entrar con `?indicator=giacenze_overdue_15` | URL | Filtro por indicador aplicado desde el inicio | P2 | Auto |
| SHP-32-04 | Limpiar filtros | Pulsar | Estado y listado vuelven al inicio; pagina 1 | P2 | Auto |

- **Riesgos / dudas:** el indicador de la URL se guarda en `local.indicator` pero el panel no lo muestra como chip. Rango de fechas sin validacion de orden.

---

### SHP-33 · Alta y edicion de giacenza (formulario con dos modos)
- **Ruta/pantalla:** `/giacenze` (dialogo "Nueva" / editar fila / deep-link `?id=N`)  **Componente:** `modules/giacenze/components/GiacenzaEditDialog.vue`, `GiacenzaAddresses.vue`  **Envia:** alta `POST /api_inventory_crud`; edicion `PUT /api_inventory_crud {id,...}`; `POST /api_inventory_crud?action=carico_price` (copiar precio); cierre `POST {action:'close', id}`; borrado `DELETE ?id=`.
- **Permisos:** borrar y cerrar piden confirmacion (`useConfirmStore`); no hay gating de rol en cliente.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| ID expedicion | `type=number` | Si (>0) (`validate`, servidor "Shipment ID is required") | deshabilitado al editar |
| Operacion | `v-select` A/C/N/R/E | Si, por defecto A (servidor lo exige) | |
| Descripcion, Notas | texto | No | |
| Fecha apertura / cierre | `type=date` | No | |
| Dias (`giacenza_gg`) | `type=number` | No | |
| Cargo de reentrega (`addebito_riconsegna`) | `type=number`; etiqueta con la divisa; boton "copiar precio" | No | se envia con `addebito_riconsegna_currency`; bloqueado (candado) si la expedicion esta posfacturada |
| Fechas de contacto: proveedor, cliente, destinatario, respuesta del cliente | `type=date` | No | la ultima llega como datetime y se muestra como date |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-33-01 | Alta con expedicion y operacion | id existente, A | `POST` OK; toast "created"; la lista y el aging se refrescan | P1 | Auto |
| SHP-33-02 | Alta sin expedicion o con id <=0 | vacio / -5 | Error de campo `shipmentRequired`; sin llamada | P1 | Auto |
| SHP-33-03 | Alta con expedicion inexistente o ajena | id 99999999 | El servidor rechaza; el dialogo debe mostrar el error: `submit()` no tiene try/catch y cierra solo si no hay excepcion; ver riesgos | P1 | Auto |
| SHP-33-04 | Edicion: cambiar operacion y fechas de contacto | R + fechas | `PUT` OK; toast "updated" | P1 | Auto |
| SHP-33-05 | Cargo de reentrega en divisa no EUR | Cliente GBP, 50 | Etiqueta con GBP, se envia la divisa; reabrir muestra el mismo importe (no el EUR crudo) | P0 | Manual |
| SHP-33-06 | Copiar precio | Pulsar | Rellena con `carico_display` del envio, en la divisa del cliente | P0 | Auto |
| SHP-33-07 | Expedicion posfacturada | `addebito_riconsegna_locked` | Campo solo lectura con candado | P0 | Manual |
| SHP-33-08 | Fecha de cierre anterior a la de apertura | cierre < apertura | Sin regla cruzada | P1 | Auto |
| SHP-33-09 | Respuesta del cliente con datetime | Registro con `risp_cliente_data` datetime | El input date no puede representarlo; al guardar se reenvia el valor original sin cambios | P1 | Auto |
| SHP-33-10 | Cerrar giacenza (accion de fila) | Confirmar | `close`; toast `closed`; sale de abiertas | P1 | Auto |
| SHP-33-11 | Borrar giacenza | Confirmar | `DELETE`; toast; lista actualizada | P1 | Auto |
| SHP-33-12 | Deep-link `?id=N` inexistente | `/giacenze?id=0`/999 | Toast `notFound` y no se abre el dialogo | P2 | Auto |
| SHP-33-13 | Crear giacenza desde la card de relaciones del envio | Boton en `ShipmentRelationsCard` | `createFromShipment`, navega a `/giacenze?id=` abriendo la ficha | P1 | Auto |

- **Riesgos / dudas:** (1) `submit()` y los handlers de la lista no capturan excepciones del servicio: ante un 4xx/5xx no hay mensaje propio y el flujo depende de un manejador global (no verificado); tampoco muestran `toast.success` en ese caso. (2) La edicion envia siempre todos los campos incluida la divisa; los campos vacios van como `null` (posible borrado de datos). (3) `giacenza_gg` es editable aunque probablemente sea calculado. (4) Sin limites de longitud en cliente.

---

### SHP-34 · Mensajes de giacenza al cliente / proveedor
- **Ruta/pantalla:** `/giacenze`, pestana/seccion de mensajes dentro de la ficha  **Componente:** `modules/giacenze/components/GiacenzaMessages.vue`  **Envia:** `POST /api_giacenza_message {id, tipo:'GIAc'|'GIAf', dest_msg, text}`; historial `GET ?id=`.
- **Permisos:** no determinado en cliente.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Tipo | boton elegido (GIAc cliente / GIAf proveedor) | Si | el servidor solo admite esos dos |
| Destinatario | `type=email` | Si (`trim()` no vacio; aviso `destError`) | el servidor solo exige no vacio; no valida formato |
| Texto adicional | textarea 3 filas | No | |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-34-01 | Enviar sin destinatario | vacio | Error `destError`; sin llamada | P1 | Auto |
| SHP-34-02 | Enviar al cliente (GIAc) | email valido | Se envia el correo; la tabla de historial muestra la fila con estado OK/KO/WRK | P0 | Manual (solo sandbox) |
| SHP-34-03 | Enviar al proveedor (GIAf) | email valido | idem | P0 | Manual (solo sandbox) |
| SHP-34-04 | Email con formato invalido | "abc" | `type=email` no bloquea por si solo al no haber formulario `<form>`; el servidor acepta cualquier texto no vacio: definir comportamiento | P1 | Auto (solo con UPSTREAM_DENY_ACTIONS activo) |
| SHP-34-05 | Fallo del envio | Servidor 400 `GIACENZA_MSG_SEND_ERROR` | `submitMessage` no captura la excepcion: el dialogo queda abierto sin mensaje claro | P1 | Auto |
| SHP-34-06 | Historial vacio / error | Falla la carga | `history=[]`, mensaje vacio | P2 | Auto |

- **Riesgos / dudas:** sin captura de errores en `submitMessage` (`GiacenzaMessages.vue:160-178`). Envia correos reales a clientes y proveedores.

---

### SHP-35 · Cierre automatico de giacenze (masivo)
- **Ruta/pantalla:** `/giacenze` (boton visible solo si `isTmwe`)  **Componente:** `modules/giacenze/pages/GiacenzeListPage.vue` (dialogo `autoCloseOpen`)  **Envia:** `POST /api_inventory_crud {action:'auto_close', max_days}`.
- **Permisos:** UI: `window.__TMWE_OPERATIONS__.isTmwe` (de `session.user.is_tmwe`). Servidor: `check_module_operation('admin')` ("Solo administradores pueden ejecutar auto_close") y `max_days` entre 1 y 365.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Dias maximos | `type=number min=1 max=365`, `v-model.number`, por defecto 30 | Si | servidor: 1..365 (422 `max_days must be between 1 and 365`) |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-35-01 | Visibilidad del boton | Usuario no TMWE | El boton no aparece | P0 | Auto |
| SHP-35-02 | Valor limite 1 y 365 | 1; 365 | Aceptados; toast con el numero de giacenze cerradas | P0 | Manual (solo en BD de pruebas; cierra registros reales) |
| SHP-35-03 | 0, 366, vacio, decimales | 0; 366; ""; 30.5 | `min/max` del navegador no se aplican con `v-model.number`: el servidor devuelve 422; vacio se convierte en `""`; comprobar el mensaje al usuario | P0 | Auto |
| SHP-35-04 | Usuario TMWE sin permiso admin | Perfil tmwe no admin | El boton se ve (isTmwe) pero el servidor responde 403; comprobar que se informa | P0 | Manual |
| SHP-35-05 | Sin confirmacion previa | Pulsar "Lanzar" | Se ejecuta el cierre masivo al primer clic, sin dialogo de confirmacion ni recuento previo | P0 | Manual (solo BD de pruebas) |
| SHP-35-06 | Plural en el toast | 0, 1 y N cerradas | Texto pluralizado correcto en los 5 idiomas | P2 | Auto |

- **Riesgos / dudas:** (1) Sin confirmacion y sin simulacion previa de una accion masiva irreversible (`runAutoClose`). (2) El gating de UI (`isTmwe`) y el del servidor (`admin`) no coinciden. (3) `runAutoClose` cierra el dialogo antes de conocer el error y no captura excepciones.

---

### SHP-36 · Crear giacenza o pratica CRM desde la card de relaciones del envio
- **Ruta/pantalla:** detalle V2, `ShipmentRelationsCard`  **Componente:** `relations/ShipmentRelationsCard.vue`  **Envia:** `POST /api_crm_crud` (`crmService.createFromShipment`, dedup por `id_spedizione`), `giacenzeService.createFromShipment` (`POST /api_inventory_crud {action:'create_from_shipment', shipment_id}` segun el controlador).
- **Permisos:** `data.crm_allowed === false` impide crear CRM.
- **Campos:** solo botones "Crear pratica CRM" y "Crear giacenza" (sin campos de entrada).
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| SHP-36-01 | Crear pratica CRM nueva | Envio sin pratica | Se crea y abre; toast `created`; relaciones refrescadas | P1 | Auto |
| SHP-36-02 | Pratica ya existente | Repetir | Se abre la existente (toast `existing_opened`); no se duplica | P1 | Auto |
| SHP-36-03 | CRM no permitido | `crm_allowed=false` | El boton no actua / no se muestra | P1 | Auto |
| SHP-36-04 | Crear giacenza | Envio sin giacenza | Toast y navegacion a `/giacenze?id=` con la ficha abierta | P1 | Auto |
| SHP-36-05 | Fallo del servidor | Forzar error | Toast de error; los botones recuperan estado (`crmBusy`/`giacBusy`) | P2 | Auto |
| SHP-36-06 | Doble clic | Dos clics | Una sola creacion (`crmBusy`/`giacBusy`) | P1 | Auto |

- **Riesgos / dudas:** el detalle del servicio CRM esta fuera de este modulo; el endpoint exacto de `giacenzeService.createFromShipment` no se verifico.

---

## Inventario

| Prefijo-nn | Formulario | Fichero | Nº casos |
|---|---|---|---|
| SHP-01 | Nueva expedicion | `web/apps/operations/src/modules/shipment/pages/ShipmentNewPage.vue` | 10 |
| SHP-02 | Crear expedicion desde cargo | `.../shipment/pages/ShipmentFromCargoPage.vue` | 7 |
| SHP-03 | Listado: topbar, KPI, vistas, click-to-filter | `.../shipment/pages/ShipmentListPage.vue` | 10 |
| SHP-04 | Panel de filtros avanzados | `.../shipment/components/shipment/ShipmentFilterPanel.vue` | 9 |
| SHP-05 | Acciones de fila y masivas del listado | `.../shipment/pages/ShipmentListPage.vue` | 9 |
| SHP-06 | Exportar listado | `.../shipment/components/shipment/ShipmentExportMenu.vue` | 5 |
| SHP-07 | Postfacturacion (listado, filtros, masivo) | `.../shipment/pages/RechargeListPage.vue` | 8 |
| SHP-08 | Dialogo de Riaddebito | `.../shipment/components/shipment/recharge/RiaddebitoDialog.vue` | 9 |
| SHP-09 | Colli y pesos | `.../shipment/components/shipment/modals/ColliModal.vue` | 11 |
| SHP-10 | Direcciones de recogida y entrega | `.../shipment/components/shipment/ShipmentAddressBlock.vue` | 11 |
| SHP-11 | Cliente y referencia | `.../shipment/components/shipment/modals/ClienteModal.vue` | 5 |
| SHP-12 | Importes y locks de precio | `.../shipment/components/shipment/ShipmentAmountsBox.vue` | 10 |
| SHP-13 | Contrassegno (COD) | `.../shipment/components/shipment/ShipmentContrassegnoBox.vue` | 8 |
| SHP-14 | Seguro y aduana | `.../shipment/components/shipment/ShipmentInsuranceBox.vue`, `ShipmentCustomsBox.vue` | 8 |
| SHP-15 | Suplementos | `.../shipment/components/shipment/ShipmentSupplementsBox.vue` | 10 |
| SHP-16 | Proforma | `.../shipment/components/shipment/modals/ProformaModal.vue` | 9 |
| SHP-17 | DGR | `.../shipment/components/shipment/dgr/DgrDeclarationDialog.vue` | 7 |
| SHP-18 | Seleccion de servicio | `.../shipment/components/shipment/service/ShipmentServiceFornitoreModal.vue` | 9 |
| SHP-19 | AWB, etiquetas y LDV | `.../shipment/components/shipment/overview/dialogs/GenerateAwbDialog.vue` | 12 |
| SHP-20 | Recogida (pickup) | `.../shipment/components/shipment/ShipmentPickupScheduleBox.vue` | 10 |
| SHP-21 | Fechas y estado de entrega | `.../shipment/components/shipment/ShipmentDeliveryBox.vue` | 7 |
| SHP-22 | Banderas, controllata y checkforn | `.../shipment/components/shipment/ShipmentFlagsBox.vue` | 8 |
| SHP-23 | Postfactura | `.../shipment/components/shipment/ShipmentPostInvoiceBox.vue` | 5 |
| SHP-24 | Notas | `.../shipment/components/shipment/overview/NoteCard.vue` | 5 |
| SHP-25 | Visibilidad de partners | `.../shipment/components/shipment/ShipmentPartnersBox.vue` | 5 |
| SHP-26 | Reasignar propietario | `.../shipment/components/shipment/owner/ShipmentOwnerChip.vue` | 4 |
| SHP-27 | Metadatos clave/valor | `.../shipment/components/shipment/overview/MetadatiCard.vue` | 5 |
| SHP-28 | Chat y archivos | `.../shipment/components/shipment/drawers/ChatDrawer.vue`, `ShipmentFilesBox.vue` | 8 |
| SHP-29 | RFQ, adjudicacion y oferta a partners | `.../shipment/components/shipment/ExpressRfqModal.vue` | 7 |
| SHP-30 | Bascula WiFi | `.../shipment/components/shipment/weights/WifiScaleDialog.vue` | 5 |
| SHP-31 | Consola de tracking | `web/apps/operations/src/modules/tracking/components/TrackingConsole.vue` | 9 |
| SHP-32 | Filtros de giacenze | `web/apps/operations/src/modules/giacenze/pages/GiacenzeListPage.vue` | 4 |
| SHP-33 | Alta y edicion de giacenza | `web/apps/operations/src/modules/giacenze/components/GiacenzaEditDialog.vue` | 13 |
| SHP-34 | Mensajes de giacenza | `web/apps/operations/src/modules/giacenze/components/GiacenzaMessages.vue` | 6 |
| SHP-35 | Cierre automatico de giacenze | `web/apps/operations/src/modules/giacenze/pages/GiacenzeListPage.vue` | 6 |
| SHP-36 | Relaciones: crear CRM / giacenza desde el envio | `.../shipment/components/shipment/relations/ShipmentRelationsCard.vue` | 6 |

Total: 36 formularios y 280 casos. Fichas con detalle parcial por no haberse leido el componente completo: SHP-18 (ServizioCard/ServiceFornitoreModal), SHP-25 y SHP-27 (servicios), SHP-28 (limites de subida), SHP-29 (OfferRepliesModal), SHP-36.
