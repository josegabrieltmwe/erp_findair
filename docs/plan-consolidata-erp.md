# Plan: gestión completa de los proyectos de consolidata desde el ERP

> **Estado:** vigente (C0-C6 implementadas y commiteadas; pendiente C7 y la prueba en navegador, ver §10) · **Última modificación:** 2026-11-12

Objetivo: que el staff gestione en el ERP (SPA `operations` + BFF) todo el ciclo de un proyecto de consolidata (alta, cotización, respuesta, aceptación, conversión a operativo y seguimiento), con un listado de proyectos con los mismos filtros, columnas, vistas y acciones que los listados de cargo y courier.

**Cómo se hizo el análisis (2026-11-03):** lectura del código de `erp_findair` (SPA y BFF) y de `tmwe_api` en `/var/www/sandbox`, y consultas de solo lectura (`SELECT`) a la BD `tmwe_sandbox`. No se cambió código. Las referencias `fichero:línea` son de ese día; comprobarlas antes de actuar.

Documentos relacionados:
- Diseño del backend: `tmwe_api/docs/03-diseno/consolidata_octubre/PLAN.md` (§6B describe la UI del staff), `PLAN_PORTA_A_PORTA.md` (§27-34, `operate` y consolidada por carretera) y `tmwe_api/docs/07-gestion/consolidata_octubre/EXECUTION_LOG.md`.
- Peticiones al API que salen de este plan: [contrato-con-api.md](contrato-con-api.md), sección K (P65-P78).

---

## 1. Conceptos

| Término | Qué es | Dónde vive |
|---|---|---|
| **Proyecto de consolidata** | Plan comercial: varias expediciones (houses) que comparten tramos (recogida, AIR o ROAD, entrega). Se cotiza, el staff responde, el cliente acepta y se convierte en operación. | `tmwe_api`: `progetti_consolidati`, `progetti_tratte`, `progetti_spedizioni`, `progetti_tratte_spedizioni` (reparto), `progetti_conversione_passi`, `progetti_log`, `progetti_note_interne` |
| **Groupage operativo** | Un cargo (MAWB) con varias expediciones express enlazadas, cada una con su HAWB. | `spedizioni.id_cargo`, `awb_cargo` (`tipo` M/H), `spedizioni_cargo` |
| **Conversión** | Paso del proyecto (estado C) al groupage: `convert` enlaza a un cargo existente; `operate` crea cargo, expediciones, enlaces y HAWB, y opcionalmente reserva. | `Consolidation_Conversion_Service`, `Consolidation_Operations_Service` |

Estados del proyecto: **A** abierto, **P** presupuesto pedido, **C** cerrado (aceptado), **X** cancelado. No existe un estado «convertido»: hoy solo se nota por `id_cargo` (aéreo) o por `progetti_tratte.id_spedizione` (carretera).

Quién crea proyectos: hasta ahora el cliente, desde el plugin de WordPress `tmwe-findair-consolidata`, **deprecado desde el 2026-11-03**. Con este plan los crea el staff desde el ERP.

## 2. Estado actual

### 2.1 Lo que ya hace el ERP (módulo `web/apps/operations/src/modules/consolidata`)

- **Bandeja** `/consolidata` (`ConsolidataQueuePage.vue`):
  - filtros de estado (por defecto P), asignado (todos / yo / sin asignar) e `id_cliente` tecleado a mano;
  - paginación del servidor con 20 filas fijas;
  - botón «Tomar».
- **Detalle** `/consolidata/:id` con pestañas de expediciones, tramos, reparto, cumplimiento, historial (últimos 20 eventos) y notas internas. Acciones disponibles:
  - tomar el proyecto, responder la cotización, precio manual con motivo, recalcular;
  - editar tramos;
  - añadir, editar y quitar expediciones;
  - ignorar avisos;
  - cerrar, reabrir y cancelar;
  - `convert` a un cargo elegido a mano.
- **Simulador** `/consolidata/quote`: compara opciones (separadas / hub / mixta / carretera). No guarda nada.
- **Panel de consolidación en la ficha del cargo** (`CargoConsolidationPanel.vue`): añade y quita expediciones express como houses del MAWB. No muestra ningún proyecto de origen.
- **Pruebas:** vitest de `logic.ts`, del servicio y del store. No hay pruebas de pantallas.

### 2.2 Acciones del API que el ERP no usa

| Acción | Para qué | Situación en el ERP |
|---|---|---|
| `create` | Alta de proyecto (el staff puede crear en nombre de un cliente con `id_cliente`) | No existe |
| `create_from_option` | Alta desde una opción del simulador | No existe; el simulador pierde el resultado |
| `add_leg` / `remove_leg` | Añadir y quitar tramos | `remove_leg` está en el servicio, sin pantalla; `add_leg` no existe |
| `set_eori` | EORI del declarante | No existe |
| `request_quote` | A → P | No existe |
| `assign` | Asignar a otro usuario | En el servicio y el store, sin pantalla |
| `operate` | Conversión completa (cargo, expediciones, HAWB, reserva) | No existe; solo `convert` |
| `list` | Listado del cliente | El ERP usa `view=queue` (correcto para el staff) |

### 2.3 Defectos del ERP a corregir

| # | Defecto | Dónde |
|---|---|---|
| E1 | Las rutas `/consolidata*` no tienen `meta.requiresAdmin`; solo se oculta el menú (`navCatalog.ts:48` `adminOnly`). Quien teclee la URL entra y solo le para el 403 del API. | `router/index.ts:191-211` |
| E2 | «Tomar» no consulta `can('take')`: aparece en proyectos C y X. En la bandeja llama al servicio sin pasar por el store (`saving` no se activa). | `ConsolidataDetailPage.vue:68`, `ConsolidataQueuePage.vue:100,187-199` |
| E3 | Permisos de botones con la acción equivocada: editar tramo y precio manual usan `can('add_shipment')`, no `update_leg` ni `override_price`; quitar expedición también usa `add_shipment`; las notas no tienen control. | `ConsolidataDetailPage.vue:212`, pestañas |
| E4 | `waive_warning` envía `id_prog_sped: 0` cuando el aviso es del proyecto (`null`). | `ConsolidataReadinessTab.vue:113` |
| E5 | El mismo error se muestra dos veces (página y diálogo). | página de detalle y diálogos |
| E6 | Se muestran ids donde debería haber nombres (`#usuario`, `#cliente`). No hay enlaces al cliente, al cargo ni a las expediciones. Las filas no son enlaces, así que no se pueden abrir en otra pestaña. | bandeja, cabecera, historial |
| E7 | Cerrar, reabrir y cancelar usan `window.confirm`. Los importes salen con `toFixed(2)`, sin formato local. El icono de moneda es fijo. | varios |
| E8 | Si falla `meta`, desaparecen todos los botones sin explicación. | `consolidata.store.ts:109-130` |
| E9 | Código sin usar: `blockingWarnings` y `meta.limits`. No se avisa de los bloqueos antes de convertir ni se muestran los límites. | `logic.ts:120` |
| E10 | Simulador: medidas fijas 60×40×40, referencias fijas `Q<n>`, sin terminal, valor ni fecha; el error del tramo no se enseña; los textos de preferencia no cambian con el idioma. | `ConsolidataQuotePage.vue:237,264-284` |

`update_leg` con claves inglesas (`weight`, `goods`, `value`, `note`) **no** es un defecto: es lo que espera el API (`Consolidation_Project_Service.php:705-796`).

### 2.4 Lo que falta en el API (detalle en contrato-con-api.md §K)

Se agrupa en tres bloques.

**Seguridad y corrección (bloquean dar más poder al ERP):**
- **G1.** Un **cliente puede fijar el precio de un tramo**. Basta enviar `price_source='manuale'` + `manual_price` en `create`, `add_leg`, `update_leg` o `create_from_option`, porque `validate_leg` no comprueba que sea staff (`Consolidation_Project_Service.php:744-761`, `Consolidation_Option_Service.php:130-133`). Ese precio acaba bloqueado (`carico_lk='S'`) en las expediciones que se facturan. **Verificado.**
- **G2.** `reopen` (C → A) y después `cancel` están permitidos al cliente **aunque el proyecto ya esté convertido** (`Consolidation_Project_Service.php:345-349`, no mira `id_cargo` ni los pasos de conversión). **Verificado.**
- **G3.** El permiso de staff es demasiado amplio y hay incoherencias:
  - «staff» es cualquier usuario de la anagrafica 1, sin un permiso propio para `operate` ni para reservar;
  - `waive_warning` permite ignorar avisos de nivel error (p. ej. `RESTRICTED_COUNTRY`);
  - `assign` no valida al usuario;
  - si `operate` recibe un `id_cargo` distinto al guardado, lo sobrescribe, mientras que `convert` responde 409;
  - `operate` no bloquea con `QUOTE_EXPIRED` y `convert` sí;
  - no hay exclusión mutua: un doble clic en `operate` puede crear cargos o expediciones duplicados.

**Listado:**
- `queue` solo filtra por `stato`, `assegnato_a` e `id_cliente`, con 20 filas fijas y orden fijo (`modif_datetime ASC`).
- No hay recuentos por estado.
- Las filas no traen `id_cargo`, ni marca de convertido, ni nombres de usuario, ni peso.

**Lectura:**
- No hay vista de los pasos de conversión.
- No hay historial paginado.
- No se puede buscar un proyecto por cargo.

**Despliegue:** las migraciones de membresía, perfil y pasos de conversión (20261014, 20261016) están aplicadas en dev y sandbox, pero según `PLAN_PORTA_A_PORTA.md` §28 **no en producción**.

### 2.5 Datos en sandbox (2026-11-03, solo `SELECT`)

- **Proyectos:** hay 1 proyecto, en estado A, sin expediciones ni pasos de conversión.
- **Groupage real:** de 1.496 cargos con houses, solo 5 tienen más de una (la última house es del 14/10/2026).
- **Expediciones express enlazadas a un cargo:** 16.192 cargos. Casi todos son la recogida o la entrega del propio cargo (mecanismo del legado `tpc='Q'`, `cargo_pickup='S'`); no son consolidadas.

Para probar habrá que **crear datos de prueba**: proyectos en los cuatro estados, uno convertido por aire y otro por carretera. Hay que seguir la regla de pruebas sobre expediciones: recogida desactivada y nota interna `[TEST fecha]`.

## 3. Patrón que se reutiliza: los listados de cargo y courier

Los listados de cargo (`CargoListPage.vue`) y courier (`ShipmentListPage.vue`) comparten las piezas de `web/packages/platform/listing/`. El de proyectos se construye con las mismas piezas, sin componentes propios de tabla o filtros.

| Pieza | Componente / fichero | Uso en consolidata |
|---|---|---|
| Marco de página | `DashboardShell.vue` + `OperationsNav` | Igual |
| Tabla | `ListingDataView.vue` (`v-data-table-server`, modo paginado o infinito, selección, `#cell.*`, `#bulk-actions`) | Igual, con un adaptador `ListSource` |
| Filtros avanzados | `FilterDrawer.vue` (cajón con pestañas, buscador de campo, recuento previo) | Nuevo `ConsolidataFilterPanel.vue`, copia de `CargoFilterPanel.vue` |
| Filtros activos | `ActiveFilterChips.vue` | Igual |
| Rango de fechas | `v-menu` de la barra superior con atajos (hoy, 7, 30 días) | Igual, más el selector de qué fecha (`quale_data`) |
| Filtro con clic en celda | `<button class="filterable">` en celdas | Cliente, hub, destino, asignado, tipo |
| KPI por estado | `ListingKpiStrip.vue` en la barra lateral | Mosaicos por fase (§4.2) |
| Vistas de columnas | `ListingWorkView` + `ListingWorkViewSelector.vue` + `work-views.ts` | `consolidata-work-views.ts` (§4.3) |
| Modo de vista | `ViewModeToggle.vue` + `useListViewMode` | Igual |
| Estado y URL | store Pinia con `parse*Query`, `serialize*Query` y `build*ListQuery`, `AbortController` por petición | `consolidata_list.store.ts`, copia de `cargo_list.store.ts` |
| Volver al listado | `useListContext` + `?restore=1` | Igual |
| Vista previa | `?view=<id>` abre un cajón de detalle | `ConsolidataDetailOverlay.vue` (resumen y acciones rápidas) |
| KeepAlive | `KEEP_ALIVE_INCLUDE` en `OperationsShell.vue:115-121` y recarga en `onActivated` | Añadir `ConsolidataListPage` |
| Exportar | `ShipmentExportMenu.vue` + `shipment_export.service.ts` (trabajo en segundo plano, XLSX/CSV, 5.000 filas) | Requiere tipo `consolidata` en el API (P75) |
| Textos | `listing.*`, `filters.*` por módulo, 5 idiomas | `listing.consolidata.*`, `filters.consolidata.*` |

Contrato de respuesta de los listados de cargo y courier: `{data, pagination:{page, per_page, total, total_pages}, filters, meta}`. La bandeja de consolidata devuelve `{success, result:{items, count, current_page, max_page}}`.

**Decisión recomendada:** ampliar `view=queue` del endpoint `unified_consolidation_project` (D18 del plan del API ya lo recomienda: un solo catálogo y una sola ruta) y adaptar la respuesta en el servicio de la SPA a `ListSource`. Un endpoint de listado aparte al estilo `api_cargo_shipments` daría un contrato idéntico, pero duplicaría el control de acceso de `Consolidation_Access_Policy`.

## 4. Diseño del listado de proyectos

Ruta `/consolidata/list` (nombre `consolidata-list`), dentro de un `ConsolidataHost.vue` con `meta.fullscreen` y `meta.requiresAdmin`, igual que `/cargo` y `/shipment`. `/consolidata` redirige al listado y el simulador sigue en `/consolidata/quote`.

### 4.1 Filtros

| Filtro | Control | Parámetro (propuesto) | Necesita API |
|---|---|---|---|
| Búsqueda libre: id, título, referencia de expedición, nombre del cliente | Campo de la barra superior | `q` | P65 |
| Estado | Mosaicos KPI + campo en el cajón (multiselección) | `stato` (lista) | P65 (lista) |
| Fase | Mosaicos KPI (§4.2) | `fase` | P65, P67 |
| Cliente | Autocompletar remoto (`anagraficaService.search`, como en cargo) + clic en celda | `id_cliente` | Existe |
| Partner (titular del cliente) | Autocompletar | `id_partner` | P65 (+ D19) |
| Asignado a | Yo / sin asignar / usuario concreto (autocompletar de staff) | `assegnato_a` | Existe (`me`, `none`, id); el selector necesita P74 |
| Tipo | CONS / XTRADE / MULTI | `tipo` | P65 |
| Hub | Autocompletar de aeropuertos (el mismo de cargo) | `hub_terminal` | P65 |
| País de destino | Selector de país con bandera | `dest_country` | P65 |
| País de origen | Selector de país (origen de cualquier house) | `orig_paese` | P65 |
| Rango de fechas | Barra superior | `date_from`, `date_to` | P65 |
| Qué fecha | Creación / última modificación / cierre / respuesta | `quale_data` = `insert`, `modif`, `chiuso`, `risposta` | P65 |
| Respuesta | Sin responder / respondida vigente / respondida vencida | `risposta` = `no`, `vigente`, `vencida` | P65 |
| Conversión | No convertido / parcial / completo | `conversione` = `no`, `parcial`, `completo` | P65, P67 |
| Cargo | Número de cargo (MAWB) | `id_cargo` | P65 |
| Con avisos bloqueantes | Sí / no | `con_bloqueos` | P65 (se recomienda guardar el resultado de readiness; si no, se descarta) |
| Importe total | Mínimo / máximo | `totale_min`, `totale_max` | P65 |
| Nº de expediciones | Mínimo / máximo | `n_sped_min`, `n_sped_max` | P65 |
| Incluir cancelados | Casilla (por defecto no, como los archivados en cargo) | `incl_cancelados` | P65 |

Pestañas del cajón (`FilterDrawer`):
- **basics**: búsqueda, estado, cliente, partner, asignado, tipo;
- **ruta**: hub, origen, destino;
- **ciclo**: fechas, respuesta, conversión, cargo, avisos;
- **cifras**: importe, nº de expediciones.

El recuento previo usa `per_page=1`, igual que en cargo.

### 4.2 Mosaicos KPI (barra lateral)

| Mosaico | Definición | Para qué |
|---|---|---|
| Todos | Sin filtro de fase (sin cancelados) | — |
| Nuevos sin asignar | A o P, `assegnato_a` vacío | Reparto del trabajo |
| Pendientes de respuesta | P sin `risposta_at` | Bandeja principal del staff |
| Respondidos | P con respuesta vigente | Esperando al cliente |
| Respuesta vencida | P con `risposta_valida_fino` < hoy | Volver a cotizar |
| Aceptados por convertir | C sin conversión completa | Trabajo de operaciones |
| Convertidos | C con conversión completa | Seguimiento |
| Cancelados | X | Consulta |

Cada mosaico es un valor de `fase`. Los recuentos llegan en una sola llamada (`view=queue_counts`, P66), en lugar de una llamada `per_page=1` por mosaico como en cargo.

### 4.3 Columnas y vistas de trabajo

Columnas disponibles:
- identificación: id, título, cliente (con enlace), partner, tipo;
- ruta: hub, destino (con bandera), orígenes;
- contenido: nº de expediciones, nº de tramos, peso tasable total;
- importes: total y respuesta (precio y validez);
- gestión: estado, fase, asignado (nombre), antigüedad en P (días);
- operación: cargo (enlace a `/cargo/:id`), avisos bloqueantes;
- fechas: creado y modificado;
- acciones.

| Vista (`work_view`) | Columnas | Acciones masivas |
|---|---|---|
| `standard` | id, título, cliente, tipo, hub → destino, nº exp., total, estado, asignado, modificado | asignar |
| `gestion` (staff) | id, cliente, estado/fase, asignado, antigüedad en P, respuesta (precio, validez), avisos | asignar, tomar |
| `operativa` | id, cliente, hub → destino, peso tasable, cargo, conversión, creado | — (exportar) |

Orden (lista blanca en el API, P65): `id`, `modif_datetime`, `insert_datetime`, `totale`, `cliente`, `stato`, `risposta_valida_fino`. Por defecto, `modif_datetime` DESC. Para la vista `gestion` se ofrece «más antiguo primero» (FIFO).

Filas como enlace real a `/consolidata/:id`, para poder abrirlas en otra pestaña. El icono del ojo abre el cajón de vista previa (`?view=`).

### 4.4 Acciones desde el listado

- **Masivas:**
  - asignar a un usuario (con `assign` uno a uno o con P76 en lote);
  - exportar los seleccionados.
  - Cancelar en lote **no** se ofrece: es irreversible para el cliente.
- **Por fila:** tomar (solo si `can('take')`), abrir, vista previa.
- **Barra superior:** «Nuevo proyecto» (§5.1), «Simulador», exportar todo el filtro.

## 5. Gestión del proyecto (detalle)

### 5.1 Alta

| Camino | Pantalla | API |
|---|---|---|
| Alta en blanco | Diálogo «Nuevo proyecto»: cliente (obligatorio, autocompletar), título, tipo, hub, destino, EORI, nota. Abre el detalle en A. | `create` con `id_cliente` (el staff ya puede) |
| Desde el simulador | Botón «Crear proyecto con esta opción» en cada tarjeta no incompleta. Pide cliente y título. El simulador gana campos de terminal, valor, fecha lista y medidas reales de los bultos. | `create_from_option` con `customer_id`. **Requiere P71** (que el servidor vuelva a cotizar y no se fíe de los importes enviados) |
| Duplicar | «Duplicar proyecto» en el detalle (tramos y expediciones sin enlaces) | Combinación de `create` + `add_leg` + `add_shipment`; opcional P77 |

### 5.2 Pantalla de detalle (ajustes sobre lo existente)

**Cabecera:**
- nombre del cliente con enlace, tipo, hub → destino, EORI (editable con `set_eori`);
- asignado por nombre, con «Asignar a…» (`assign`);
- fechas de creación, modificación y cierre;
- enlace al cargo;
- un chip de **fase** (§4.2) además del de estado.

**Barra de acciones** gobernada solo por `meta.actions[x].from` (sin reglas propias):
- tomar, asignar;
- pedir cotización (`request_quote`, cuando el staff prepara el proyecto por el cliente);
- responder, cerrar, reabrir, cancelar;
- convertir y operar.

Las confirmaciones usan el diálogo de la aplicación, no `window.confirm`.

**Pestañas:**
- **Tramos:** añadir tramo (`add_leg`) y quitar tramo (`remove_leg`); mostrar fuente del precio, vigencia y el error real de cotización.
- **Expediciones:** columna de enlace a la expedición express (`/shipment/:id`) y estado del enlace; aviso al acercarse a `meta.limits.max_shipments`.
- **Cumplimiento:** sin cambios de fondo; corregir E4; no ofrecer «ignorar» en avisos de nivel error (y P70 en el API).
- **Historial:** paginado y con nombres (P69); muestra `prima` → `dopo` y traduce los códigos de acción.
- **Conversión** (nueva), ver §5.3.
- **Notas:** con control por `can('note_internal')`.

### 5.3 Conversión a operativo

Pestaña «Conversión» con dos caminos, según el estado de la reserva:

1. **Operar (recomendado):**
   - Botón que llama a `operate`. Opciones:
     - cargo existente (opcional, buscador actual de cargos);
     - `reservar` (deshabilitado con una explicación si el API dice que la reserva está apagada, P73).
   - Muestra los pasos por house en un `v-stepper` de solo lectura: cargo, expedición, precio, enlace, HAWB, reserva y camión (carretera). Los datos salen de `view=conversion` (P68), no solo de la última respuesta.
   - «Reintentar» repite `operate` (es idempotente) y solo rehace lo que falló.
   - Botón desactivado mientras corre, para evitar el doble clic (y P72 en el API).
2. **Enlazar a un cargo existente:** el `convert` actual, para quien ya tiene el MAWB y las expediciones.

**Antes de convertir:**
- lista de avisos bloqueantes (usar `blockingWarnings`);
- aviso de cotización vencida con acceso directo a «Recalcular».

### 5.4 Integración con cargo y courier

- **Ficha del cargo:** tarjeta «Proyecto de origen» junto al panel de consolidación, con enlace al proyecto y su estado. Requiere P67 (búsqueda por `id_cargo`).
- **Ficha de la expedición express:** chip «En proyecto #N» cuando pertenece a uno (P67).
- **Panel de consolidación del cargo:** sin cambios de alcance; depende de P59 (candidatos de los clientes del partner) y P61 (códigos HTTP), ya pedidas.
- **`navTargets.ts`:** añadir `consolidata` para que `detailHref('consolidata', id)` funcione desde otros módulos.

## 6. Fases

Cada fase se entrega por separado, con sus pruebas, y deja el sistema estable.

| Fase | Contenido | Depende de | Tamaño |
|---|---|---|---|
| **C0 — Seguridad del API** | G1 (precio manual solo staff), G2 (bloquear `reopen` y `cancel` tras convertir), G3 (`waive` de errores, `assign` válido, coherencia de `operate`, exclusión mutua). Peticiones P70-P72. | — | M (API) |
| **C1 — Correcciones del ERP** | E1-E9. Guardia de ruta, permisos de botones por la acción correcta, nombres en lugar de ids donde ya llegan, diálogos de confirmación, formato de importes. | — | S |
| **C2 — API de listado** | P65 (filtros, `per_page`, orden, campos nuevos), P66 (recuentos), P74 (usuarios de staff), índices. | C0 recomendable | M (API) |
| **C3 — Listado en el ERP** | `ConsolidataHost`, `ConsolidataListPage`, `consolidata_list.store.ts`, `ConsolidataFilterPanel`, vistas de trabajo, KPI, chips, URL, KeepAlive, cajón de vista previa. Sustituye a la bandeja. | C2 | L |
| **C4 — Alta y edición completas** | Nuevo proyecto, crear desde el simulador (con P71), `add_leg`/`remove_leg`, `set_eori`, `request_quote`, asignar a usuario, mejoras del simulador (E10). | C0, P71 | M |
| **C5 — Conversión completa** | Pestaña Conversión con `operate`, pasos (P68), reintento; historial paginado (P69); estado de la reserva (P73). | C0, P68, P69, P73, D-B | M |
| **C6 — Integración y salida** | Proyecto de origen en cargo y courier (P67), `navTargets`, exportar (P75), asignación masiva (P76). | C3, P67, P75 | M |
| **C7 — Producción** | Migraciones de consolidata en producción (P78), regenerar el manifiesto del BFF (`bff/bin/regen-spa-manifest.sh`), datos de prueba, pruebas manuales por pantalla. | C0-C6 | S |

Orden recomendado: **C0 y C1 en paralelo → C2 → C3 → C4 → C5 → C6 → C7**. C1 no depende del API y elimina los fallos visibles hoy.

## 7. Pruebas

- **API (PHPUnit Unit, sin BD):**
  - cada petición P65-P78 con su prueba en `tests/Unit/Service/Consolidation/`;
  - filtros y orden de `queue` con un doble del modelo, más una prueba del SQL generado;
  - G1, G2 y G3 con casos de cliente y de staff.
  - Actualizar los dorados de `Consolidation_Contract_Golden_Test`.
- **SPA (vitest):**
  - `consolidata_list.store.spec.ts`: `parse`/`serialize`/`build` ida y vuelta, valores por defecto omitidos, orden fuera de lista blanca.
  - Adaptador `ListSource`.
  - Mapeo de mosaicos a `fase`.
  - Puertas de botones por `meta`.
  - Servicio para `operate` y `create_from_option`.
- **BFF:** que `routes.spa.yaml` incluya las vistas nuevas (el manifiesto se genera con `bff/bin/gen-spa-manifest.php`).
- **Manual** (se ejecuta con el navegador del sandbox):
  - proyecto aéreo de principio a fin: alta → cotización → respuesta → cierre → operar sin reserva → cargo con houses;
  - proyecto por carretera;
  - cliente que intenta fijar precio (debe dar 403);
  - reabrir un proyecto convertido (debe dar 409).
- Las suites con escritura (Journey, E2E) **no** se automatizan mientras la BD y la cola de sandbox sean compartidas.

## 8. Decisiones pendientes del negocio

| # | Decisión | Afecta a | Propuesta por defecto |
|---|---|---|---|
| D-A | ¿Ve el partner los proyectos de sus clientes en el ERP? (D19 del plan del API) | Filtro de partner, permisos, menú | **Decidida (2026-11-03): sí.** Todo el personal de TMWE y de los partners tiene el permiso; ver §11 |
| D-B | ¿Se activa la reserva real en el vendor desde `operate` (`CONSOLIDATION_ALLOW_BOOKING`)? | C5 | Apagada; el botón explica por qué |
| D-C | ¿Qué significa `close`: lo hace el cliente al aceptar o también el staff? ¿Puede cerrar el cliente sin respuesta del staff? (D20) | Botones de cierre, mosaicos | Solo con respuesta vigente (P70) |
| D-D | ¿Quién puede operar? ¿Hace falta un permiso propio para `operate` y reservar? | C0, C5 | Permiso nuevo `consolidation:operate` |
| D-E | ¿Hace falta exportar proyectos? ¿Con qué columnas? | C6 | Sí, con las columnas de la vista activa |
| D-F | Criterio de reparto y facturación por house (D1, D4 del plan del API) | Pestaña de reparto, conversión | Sin cambios en esta entrega |

## 9. Riesgos

- **Plugin de WordPress:** deprecado (2026-11-03). No hay que mantener su compatibilidad; el catálogo de cliente (`catalog_client.json`) sigue existiendo para quien llame al API como cliente.
- **Datos de prueba:** sandbox no tiene proyectos utilizables y la BD es compartida. Las pruebas que crean cargos o expediciones deben seguir la regla de recogida desactivada y nota `[TEST]`, y no pueden reservar.
- **Migraciones:** sin las migraciones 20261014 y 20261016 en producción, la bandeja, el reparto, el cumplimiento, `operate` y `answer_quote` fallan allí.
- **Rendimiento:** `create_from_option` hace unas 15 consultas por house (hasta 200 houses). Desde el 2026-11-05 es atómico (una transacción). Aceptable con los volúmenes actuales; vigilarlo si se usa desde el simulador con muchas expediciones.

## 10. Ejecución (2026-11-03)

Cambios en la rama `sandbox` de `tmwe_api` y `erp_findair` (en `erp_findair` ya commiteados; el 2026-11-12 se añadieron los ajustes del plan B de [plan-consolidata-cliente-final.md](plan-consolidata-cliente-final.md)). El bundle de la SPA **no se ha compilado**. La migración de índices está escrita y **no aplicada**. Nada se ha escrito en BD ni en la cola.

| Fase | Estado | Notas |
|---|---|---|
| C0 | Hecha | P70, P71 y P72 (a-d). Sin el permiso propio `consolidation:operate`: la autorización es por controller y pediría una migración de roles. Un cliente que crea desde una opción provoca una nueva comparación en el servidor (llamadas de tarifa en vivo). |
| C1 | Hecha | E1-E10. |
| C2 | Hecha | P65, P66, P67, P68, P69, P73, P74 y P76. No se hicieron `con_bloqueos` ni `incl_cancelados`. Índices en `20261103_consolidation_list_indexes.sql`. |
| C3 | Hecha | `/consolidata/list` con el kit de listados. «Antigüedad» se cuenta desde la creación (no hay fecha de paso a P). Exportación CSV en la SPA (hasta 2.000 filas) en lugar de P75. |
| C4 | Hecha | Falta duplicar proyecto (P77, opcional). |
| C5 | Hecha | Pestaña Conversión con `operate`, pasos e historial paginado. |
| C6 | Hecha | Tarjeta «Proyecto de origen» en el modal de consolidación del cargo y chip «En proyecto #N» en la ficha courier. Exportación XLSX en servidor (P75) no hecha. |
| C7 | Pendiente | Ver la lista de abajo. |

Actualización 2026-11-12: la pestaña Conversión ya no ofrece `operate`/`convert` con la conversión completa, distingue un fallo real de `view=conversion`/`view=log` de una vista ausente, el detalle descarta respuestas tardías de otro proyecto, y el detalle muestra quién creó el proyecto.

Comprobaciones:
- **API:**
  - Unit de consolidación: 321 pruebas OK.
  - Unit completa: 9.860 OK.
  - `check_docs` OK.
- **SPA:**
  - vitest de consolidata: 59 OK.
  - vitest completo: 719 OK.
  - `typecheck`, `check:i18n` y `check:ts-literals` OK.
  - `check:raw-text` falla con los 16 casos que ya existían, ninguno en consolidata.

Pendiente:
1. Revisar y hacer commit.
2. Compilar el bundle cuando el árbol no tenga cambios ajenos.
3. Crear datos de prueba y recorrer en navegador la lista del §7.
4. Aplicar las migraciones en producción (P78).
5. ~~Plugin de WordPress~~: deprecado (2026-11-03); no requiere cambios.
6. ~~El POST de `unified_consolidation_project` en el BFF tiene `timeout: 30`~~: resuelto el 2026-11-05. Los POST de `unified_consolidation_project` y `unified_consolidation_quote` tienen 300 s en `bff/config/routes.bff.yaml`; con 30 s el simulador daba 504 (la comparación tardó 40 s en la prueba).

## 11. Permiso de consolidata para TMWE y partners (2026-11-03)

Decisión del negocio: todos los usuarios de las anagraficas de TMWE y de los partners trabajan con la consolidata.

- **Permiso:** scope `consolidation:manage`, que da el rol aditivo nuevo `consolidation_manager`. El scope se añade a los techos de la SPA ERP (`app_internal_erp`, `app_internal_erp_staff`, `app_partner_erp`).
- **Migración:** `tmwe_api/docs/sql/migrations/20261103_rol_consolidacion.sql` (rollback `_rollback.sql`), reflejada en `config/rbac_seed.yml`.
  - **Aplicada en `tmwe_sandbox` el 2026-11-03:** 268 asignaciones (99 contactos de TMWE y 169 de 46 partners activos). Es idempotente. Copia previa en `bak_20261103_auth_role_consolidacion`.
  - **Producción:** pendiente, junto con P78.
- **Contactos nuevos:** reciben el rol por `Default_Api_Role_Service::default_addon_role_names`.
- **Alcance:**
  - TMWE ve y gestiona todos los proyectos.
  - Un partner ve los suyos y los de sus clientes (`anagrafiche.id_anagr_titolare`): listado, recuentos, búsqueda por cargo o expedición, alta en nombre de un cliente, usuarios a los que asignar.
  - Un cliente sigue como antes (sus proyectos, sin acciones de staff).
- **SPA:**
  - El menú y las rutas `/consolidata*` dejan de ser solo de TMWE: los abre el scope (`navCatalog.ts`, `router/moduleAccess.ts`).
  - La tarjeta del cargo y el chip de la expedición también se rigen por el scope.
  - Los usuarios con sesión abierta deben volver a entrar para que su token lleve el permiso nuevo.

## 12. Facturación de la consolidata (2026-11-05)

Resultado de la prueba de facturación en el sandbox (detalle en `tmwe_api/docs/07-gestion/consolidata_octubre/EXECUTION_LOG.md`):

- El API ya traslada a lo facturable el precio del proyecto al operar: el MAWB lleva el aéreo y la entrega, y las houses y el camión su tramo, con el combustible incluido cuando el tramo no tiene servicio.
- **`update_profile` en la SPA (hecho 2026-11-12):** diálogo «Completar perfil» en la pestaña «Conversión» para las houses sin spedizione de un proyecto aceptado o con la operación a medias; solo envía los campos que cambian. Permite reintentar `operate` sin pasar por el API a mano.
- Los costes fijos de la opción del simulador no se guardan en el proyecto y no se facturan: decisión pendiente del negocio.
