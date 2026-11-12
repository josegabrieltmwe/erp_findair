# Plan: listados de trabajo («colas») de Jose_master → SPA erp_findair

> **Estado:** vigente (fases 0-2 ejecutadas; 3-6 bloqueadas por backend, ver §10) · **Última modificación:** 2026-11-12

Origen: análisis de `Jose_master/tmwe2` (`spedizioni.html`, `cargo.html`, `giacenze.html`, `prese.html`, `crm.html`, `pagamenti.html`, `messaggi.html`; motor común en `assets/tmwe.js`: `LISTA` y `BULK`) y de `Jose_master/56_ciclo_operativo_cestini.md`. Se compara con el SPA (`web/apps/operations`, `web/packages/platform/listing`). Complementa [propuesta-home-minimalista.md](propuesta-home-minimalista.md): las tarjetas de «Da fare oggi» abren estas colas.

## 1. Cómo funcionan en Jose_master

**Idea de producto:** una lista no sirve para «ver envíos», sino para **vaciar una cola**. Cada cola dice de qué contenedor se viene, qué acción saca el registro de ella y adónde va después (regla 49 del estándar de pantallas).

### 1.1 Entrada con filtro por defecto (`LISTA.coda`)
- Sin parámetros, la página abre en su **cola de trabajo por defecto** (`dacontr` en expediciones, `toqt` en cargo, `hold_new` en giacenze, `daaff` en recogidas, `aperte` en pratiche, `scaduti` en cobros, `ko` en mensajes).
- `?tiz=<cola>` abre otra; `?tiz=tutte` abre todo; **cualquier otro parámetro** (`?open=`, `?cli=`, `?presa=`) significa «llego por un registro o contexto»: **sin cola**.
- Cada cola es un **preset del servidor** (`type=dacontr`, `type=preseint`…): replica las condiciones completas del cajón del legado. Regla de Jose: combinar filtros a mano para imitar una cola es incorrecto.
- Hay dos tipos: colas **de servidor** (el preset filtra en la API) y colas **locales** (regla sobre registros ya cargados: giacenze, pratiche, recogidas, mensajes, cobros; el servidor solo da «abiertas»).

### 1.2 Acciones por lote (`BULK`)
- Franja sobre la lista: «Seleccionar toda la lista N» (**toda la lista filtrada, no solo la página**), nº de seleccionados, menú de acción, **Aplicar**, ✕ y «Solo fallidas».
- La **acción por defecto depende de la cola** (`bulk:` en el mapa `TIZ`): `dacontr`→«Marcar controladas», `contrnopart`→«Marcar salidas», `preseint`→acciones de recogida, `codget`→«COD cobrado»… El menú ofrece además las de la vista de columnas (`VIEWS[...].bulk`) y unas pocas fijas («Abrir giacenza…»).
- **Reglas de seguridad:** solo flags y estados (nunca borrar ni pagar); tope `max = 200` por pasada; **confirmación** con el número y los 12 primeros nombres; ejecución **un registro por llamada**, con la misma llamada que el registro individual (progreso y resultado reales por fila).
- **Resultado:** `Hechas N · M no realizadas`; las fallidas **quedan seleccionadas y en rojo**, con el **motivo** de la primera (y hasta 6 en el aviso); botón «Solo fallidas» para reintentar.
- **Precondiciones antes de empezar:** p. ej. las ofertas no se «controlan» (se avisa y se excluyen de la pasada, quedan seleccionadas); `prepara(filas)` verifica antes del diálogo.
- Acciones que existen (expedición): controlada, confirmar ofertas, salida/tránsito/entregada (por la máquina de estados, no escribiendo el número), archivar, imprimir LDV, enviar AWB al remitente, abrir giacenza, 5 estados de recogida (`presa_stato` N/W/C/E/F), 3 de COD (cobrado/transferencia/anulado). Cargo: controlada, volver a «por controlar», oferta al cliente/aceptada/rechazada. Giacenze: cerrar (entregadas), esito A/C/R/E. Recogidas: asignar/revocar conductor, meter la sede en el giro fijo. Cobros: recordatorio por lote.

### 1.3 Recarga tras actuar (`LISTA.dopoSalva` / `rileggi` / `passo`)
1. **Optimista y local:** los registros que ya no cumplen la cola (`esce(r)`, o `via` si el servidor lo garantiza) **desaparecen al instante**; el contador de la cola **baja** (`conta(-n)`).
2. **Aviso:** «N salidos de la cola “X” · quedan M» (o «cola vacía»), y con un solo registro **«Abrir la siguiente ▸»** en la misma posición.
3. **Relectura del servidor** a los 2,5 s (la verdad está allí); si otra relectura iba en curso se reintenta a los 3 s sin perder lo guardado.
4. **No relee con una ficha o un diálogo abierto** (la lista no cambia bajo las manos) y espera a que se cierre.
5. **Polling:** cada 60 s con la pestaña visible y al volver a ella (si pasaron >15 s). Solo si hay `q` (cola reconocible) y ≤ 500 filas cargadas.
6. **Colas locales:** `passo()` compara quién estaba en la cola antes y quién está ahora; cualquier guardado (ficha, botón rápido, lote) hace salir y se avisa igual.
7. Colas **«para mirar»** (`consegnate`, `inviaggio`, `transit`, `intransit`, `outdelivery`, `deipartn`, `logistic`) están marcadas `daFare:false`: se ven, pero no se «vacían» (sin aviso de salida ni «cola vacía»).
8. Si el servidor no da la lista de una cola (chat sin leer, en viaje de partners…), la tarjeta muestra el número **sin enlace**: «nunca abrir una lista que no corresponde al número».

## 2. Qué hay ya en el SPA

| Pieza | Estado |
|---|---|
| Presets `type=` en expediciones (`dacontr`, `preseint`, …) | Aceptados por URL (`normalisedType`: catálogo base + claves del catálogo KPI de la home); el resto cae a `all`. |
| Cola por defecto al abrir | **No**: sin parámetros abre `type=all`. |
| Selector de vistas de trabajo (`work-views.ts`) | Sí (columnas + `bulkActions` + `suggestedBulkAction`). 3 vistas en expediciones y cargo; no hay `bulk` por cola. |
| Selección | `ListingDataView` con `show-select` (**solo la página visible**); no hay «seleccionar toda la lista filtrada». |
| Acciones por lote | Expediciones: tracking (cola de fondo), controlar, archivar (llamada **única** `id: [..]` con `applied`/`skipped`). Cargo: controlar, archivar. Recogidas: asignar conductor. Cobros: cobro por lote. **No hay** salida/tránsito/entregada, estados de recogida, COD, LDV, enviar AWB, abrir giacenza, giacenze, pratiche, mensajes. |
| Confirmación y resultado por fila | Solo toast con totales; fallidas no se conservan ni se explican por fila. |
| Recarga tras actuar | `selected = []` + `store.fetchPage()` (recarga la **página completa**) y refresco de contadores KPI aparte; **sin** salida optimista, **sin** aviso «cola X: quedan M», **sin** «abrir la siguiente», **sin** polling, **sin** guardia de «ficha abierta». |
| Colas de asistencia (giacenze) | Filtro `?indicator=` (el API aplica la regla); lista sin lote. |
| Navegación entre registros | `RecordNavigator.vue` existe en shipment (a revisar su relación con la cola). |

## 3. Brechas, de más a menos importantes

1. **Sin cola por defecto** → la home enlaza a colas, pero entrar al listado «a pelo» muestra todo (en el legado, `dacontr`).
2. **El lote es por página**, no por lista filtrada, y no hay tope ni confirmación con nombres.
3. **El resultado del lote no es accionable**: sin fallidas persistentes, sin motivo por fila, sin «reintentar solo fallidas», sin precondiciones (ofertas, anuladas).
4. **La acción de lote no depende de la cola** (hay `suggestedBulkAction` por vista, no por cola).
5. **La salida de la cola no se ve**: tras actuar, `fetchPage()` repinta la página (puede cambiar de posición, perder el scroll, mezclar filas de la página siguiente) y el contador de la tarjeta de la home puede quedar desfasado hasta el siguiente refresco.
6. **Faltan las acciones de las colas OUT/recogidas/COD/asistencia**, y las listas locales (giacenze, pratiche, mensajes) no son colas.
7. **Sin recarga automática** al volver a la pestaña ni guardia de ficha abierta.

## 4. Decisiones de diseño (propuestas)

1. **Un único modelo `WorkQueue`** en `web/packages/platform/listing/` (no una copia por página):
   `{ id, titleKey, scopes, source: {kind:'server', query} | {kind:'local', predicate}, leaves(row)?, workOnly: boolean, defaultBulk, bulkActions[], links }`. Las tarjetas de «Da fare oggi» (`today_catalog.ts`) y el selector de colas **leen el mismo catálogo** (hoy el vínculo es solo `type=`/`indicator=` en la URL).
2. **Cola por defecto por listado** con la regla del legado: sin parámetros → cola de trabajo; `?queue=all` → todo; otro parámetro de contexto (`search`, `id_cliente`, `view`) → sin cola. Se mantiene `type=` por compatibilidad.
3. **Composable `useBulkRun`** (equivalente a `BULK._applica`): recibe filas + acción, aplica tope (200), confirma (diálogo con N y primeros nombres), ejecuta, devuelve `{ok[], failed[{id, reason}], skipped[]}` y deja las fallidas seleccionadas con su motivo. Donde el API ya admite array (`api_shipment_review/archive`) usa **una llamada** y respeta `applied/skipped`; donde no, **una llamada por registro** con concurrencia baja (3) y progreso.
4. **Selección de toda la lista filtrada:** al ser paginado en servidor, el modo «toda la lista» envía el **filtro** (no los ids) si el API lo admite, o recorre las páginas hasta el tope. Hay que preguntar a backend (§6).
5. **Recarga en 4 pasos** (`useQueueRefresh`): (a) quitar de la vista local los que `leaves(row)` o los `applied` del API; (b) bajar el contador de la cola y de la tarjeta (`kpiCounter`); (c) aviso con «quedan M» y «Abrir la siguiente»; (d) relectura a los ~2,5 s y al volver a la pestaña, **omitida con diálogo o drawer abierto**. Sin polling de 60 s al principio (coste de servidor; ver §6).
6. **Colas «de mirar»** (`workOnly:false`) sin aviso ni «cola vacía».
7. **Honestidad del contador:** un contador que falla muestra `n/d`, nunca 0 (ya vigente en «Da fare oggi»); una cola sin lista en el API **no se enlaza**.
8. **Regla de seguridad del lote:** solo flags/estados; nunca borrar ni pagar. Los estados de entrega pasan por `api_shipment_status` (máquina de estados), nunca escribiendo el campo.

## 5. Plan por fases

| Fase | Entrega | Detalle | Riesgo |
|---|---|---|---|
| **0** | Catálogo `WorkQueue` y cola por defecto | Extraer de `today_catalog.ts` y `shipment-work-views.ts` el catálogo único; expedición abre `dacontr`, cargo `toqt`; selector de colas por grupos (IN/Recogidas/OUT/Admin) como en `renderVPick`. Tests de contrato: toda cola tiene preset conocido por `normalisedType`. | Bajo |
| **1** | `useBulkRun` + resultado accionable en expediciones y cargo | Tope, confirmación con nombres, fallidas persistentes con motivo, «solo fallidas», precondiciones (ofertas/anuladas). Reutiliza `bulkArchive/bulkControl`. | Bajo |
| **2** | Salida de la cola + recarga | `leaves(row)` por cola (`dacontr`: controlada; `presenew/presewait/presefail`: `presa_stato`; `presefornS`: AWB enviado), contador, aviso, «Abrir la siguiente» (aprovechar `RecordNavigator`), relectura diferida con guardia de ficha. | Medio (UX) |
| **3** | Acciones OUT y recogidas | `part/transit/cons` vía `api_shipment_status` (con validación de transición y `force` solo para rol autorizado), `presa_stato` (5 estados), enviar AWB, LDV (una a una, ver §6). Acción por defecto por cola. | Medio-alto (escrituras en el estado) |
| **4** | Recogidas y COD | Asignar/revocar conductor (ya hay asignar), giro fijo por sede (`api_pickup_recurring`, una llamada por sede), COD cobrado/transferencia/anulado con reconciliación. | Alto (dinero): P-clave de revisión |
| **5** | Colas locales: giacenze, pratiche, mensajes, cobros | Predicado local + `passo()` equivalente; ciclo de giacenza en 3 pasos desde la lista; abrir giacenza por lote; «cerrar entregadas». | Medio |
| **6** | Cargo | Acciones de oferta (al cliente / aceptada / rechazada) y volver a «por controlar»; colas de viaje (`vgloc`, `vgvol`, `vgrem`). **Sin reservas WebCargo/KLM** (regla del proyecto). | Medio |

Cada fase deja: tests (`useBulkRun`, predicados de cola, contrato de presets), actualización de la home (la tarjeta enlaza a la cola y su contador baja al actuar) y actualización de este documento y de `comparativa-jose-master.md`.

## 6. Preguntas a backend (tmwe_api) antes de las fases 3-4

Si se confirman como peticiones, se registran en [contrato-con-api.md](contrato-con-api.md) (no en este documento).

1. ¿`api_shipment_review/archive` aceptan filtro además de `id[]` (lote sobre la lista filtrada)? Si no: ¿tope por petición y política de transacción parcial (`applied/skipped` ya existe)?
2. Estados de entrega por lote: ¿endpoint array o una llamada por id (`api_shipment_status` es `PUT {id,target_state}`)? ¿Cómo informa la fecha de salida/entrega que el legado fija con `_cambiaStato`?
3. `presa_stato`, `api_cod_reconciliation`, `api_pickup_recurring`: ¿ya expuestos en la BFF y con qué scopes (`pickups:read/write`, `payments:*`)?
4. Presets que el legado marca como sin lista: chat sin leer, en viaje de partners, voces de tracking, `faddebit` (cobro/post-facturación). ¿Alguno ya existe en tmwe_api?
5. LDV masiva: el legado genera una por llamada y abre un listado de PDFs (la impresión acepta una sola). ¿Hay endpoint multi-LDV (zip/merged)?
6. Polling/relectura: ¿la carga de `type=` frío (hasta 18 s en KPI) permite relecturas cada minuto, o hay que usar solo relectura tras acción + al volver a la pestaña?

## 7. Fuera de alcance / no portar
- Estética propia del legado (tres colores, tiras fijas): se usa el sistema de diseño Vuetify del SPA.
- Contadores históricos enormes (`cargo_attesa` 6753, `cargo_rifiutate` 3281): se leen **por fecha**, no como cola a vaciar.
- Cualquier acción que borre o cobre sin pasar por el flujo del registro individual.

## 8. Seguridad: que un usuario no pueda actuar sobre registros ajenos

**Verificado en `tmwe_api`** (`Abstract_Shipment_Flag_Controller` + `Abstract_Spedizioni::is_access_allowed`, igual en cargo): los lotes `api_shipment_review/archive` y `api_cargo_review/archive` consultan los ids pedidos filtrando por la anagrafica del token y **comparan cuántos devuelve la consulta con cuántos se pidieron**. Si falta uno solo (ajeno, inexistente o anulado), el lote entero se rechaza con **403 `ACCESS_DENIED`** y no se toca nada; el API no dice cuál falló. Es la defensa real; el SPA no la sustituye.

**Reglas del SPA** (`web/packages/platform/listing/bulkRun.ts` y `useBulkRun.ts`, con tests):
1. Los ids de un lote salen **solo de las filas que el listado tiene cargadas** (las que el API ya filtró para este usuario); lo seleccionado que no esté entre ellas se descarta y se avisa. Nada de la URL (`?view=`, `?type=`), del almacenamiento local ni de campos libres entra en un lote.
2. Solo enteros positivos, sin repetir, con tope de 200 por pasada.
3. Confirmación previa con el número y los primeros nombres.
4. Un 403 se trata como «alguno no es tuyo»: **no se reintenta con subconjuntos** (sería sondear qué ids existen), no se detalla cuál y se recarga el listado.
5. Solo se da por aplicado lo que el API confirma (`applied`/`skipped`); lo omitido queda seleccionado.
6. El tipo de cola de la URL pasa por la lista blanca de `normalisedType`; un valor inventado cae a `all` (test).
7. **Regla para las fases 3-6:** cada endpoint nuevo de lote debe tener la misma comprobación «todos los ids son del token» en el API **antes** de exponerse en el SPA. Si el endpoint admite un filtro en lugar de ids («toda la lista filtrada»), el servidor lo ejecuta siempre con el filtro de propiedad del token; nunca se confía en un id de cliente.

## 9. Avance (2026-11-12)

| Fase | Estado | Qué se hizo |
|---|---|---|
| 0 | Hecha para expediciones | Cola por defecto `dacontr` (solo personal TMWE, primera entrada, URL sin parámetros) y **selector de colas** agrupado IN/OUT en el listado de expediciones (`ListingQueueSelector` + `queueCatalog.ts`), derivado de `HOME_KPI_CATALOG` (mismo origen que «Da fare oggi»; solo colas `serverFiltered`; test de que el listado acepta todas). Cargo queda sin cola por defecto: `toqt` no tiene acción de lote que la vacíe (se decide con la fase 6). |
| 1 | Hecha (expediciones y cargo) | `useBulkRun`: ids saneados, tope, confirmación con nombres, resultado aplicadas/omitidas, 403 tratado. El tracking también sanea ids. Lo omitido queda seleccionado. |
| 2 | Hecha | Salida optimista + relectura + contadores + aviso «salen N; quedan M» / «cola vacía» en controlar y archivar. **Relectura al volver a la pestaña** (`useVisibilityRefresh`, ≥15 s fuera; sin polling) con guardia: no relee con ficha abierta, diálogo, filas seleccionadas o carga en curso. «Abrir la siguiente» ya lo cubre `RecordNavigator` (anterior/siguiente sobre el listado filtrado desde el detalle). |
| 3-6 | Pendientes | Dependen de las respuestas de backend del §6 y de la regla 7 del §8. |

## 10. Hallazgos de backend que bloquean las fases 3-6 (verificados en `tmwe_api`, 2026-11-12)

1. **El cambio de estado de entrega no equivale al legado.** `api_shipment_status` (`PUT {id, target_state}`) usa una máquina de estados (`N`, `V`, `AC`, `TR`, `DE`, `ER`, `GI`, `RT`, `FA`, `AN`) con transiciones estrictas (p. ej. no se llega a `DE` sin pasar por `TR`) y **no** escribe `consegna_stato` (códigos 2/3/7 del legado) ni fija la fecha de salida al corriere o de entrega que fijaba `_cambiaStato`. Las acciones del legado «Marcar salida / en tránsito / entregada» no se pueden replicar con ella sin una decisión de producto o un endpoint nuevo. **Pregunta bloqueante a backend/Luca:** ¿qué debe hacer «Marcar salida» en el nuevo sistema (¿`AC`→`TR` con fecha?) y quién fija las fechas?
2. **Sí es seguro el bucle uno a uno:** `transition()` pasa por `get_shipment_with_partner_guard(id, partner)`, o sea, cada llamada comprueba la propiedad del registro. No hay endpoint de lote para estados (una llamada por id, con tope y concurrencia baja). `force=true` está limitado a TMWE (anagrafica 1) y exige motivo: **no se expone en lotes**.
3. **Estados de recogida (`presa_stato`):** el legado usa N/W/C/E/F; el API de alta/edición de expediciones valida `presa_stato ∈ {A, P, E}` y el listado solo lo filtra. No hay un endpoint de lote ni un mapeo N/W/C/E/F ↔ A/P/E. **Pregunta:** mapeo oficial y endpoint (¿`api_pickups_crud` por `id_presa_p`?).
4. **COD (`contras_incasso`, reconciliación):** no existe un controlador de reconciliación COD en `tmwe_api` (búsqueda de `cod_reconciliation` sin resultados en `controller/`). Sin él no se puede portar «COD cobrado / transferencia / anulado». Es dinero: no se escribe `contras_incasso` a mano desde el SPA.
5. **Conductor y giro fijo (recogidas):** `Pickup_Crud_Controller` y `Recurring_Pickup_Controller` existen; hay comprobación de sedes propias en el CRUD, pero no he verificado que `Recurring_Pickup_Controller` haga la comprobación de propiedad de la sede por id. Pendiente de revisar antes de usarlo desde un lote.
6. **LDV masiva y listas sin preset** (chat sin leer, en viaje de partners, voces de tracking, `faddebit`): sin cambios; siguen pendientes de backend.

**Qué sí puede hacerse ya, sin backend nuevo:** nada de lote con escritura de estado. Lo siguiente razonable es (a) cerrar con Luca el punto 1, (b) revisar el punto 5, y (c) las colas locales de solo lectura (giacenze, pratiche, mensajes) como selector de colas, sin lote.
