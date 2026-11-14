# Formularios de otros módulos: casos de prueba

> **Estado:** borrador · **Última modificación:** 2026-11-01 · Generado por lectura de código (no se ejecutó nada). Parte de [plan-pruebas-formularios.md](../plan-pruebas-formularios.md). Las reglas de cada ficha salen del código citado; lo marcado «no determinado» no se pudo confirmar.

## RESTO (prefijo OTR): consolidata, pickup, crm, warehouse, email_templates, tickets, copilot, bulk, home, listing/ui/email/dashboard/shell/hub/presence, shared-frontend y entrada/sesión

Rutas base de código: `web/apps/operations/src/modules/<modulo>` (abreviado `M/`) y `web/packages/platform/<paquete>` (abreviado `P/`). Backend citado como `tmwe_api:` (= `/var/www/dev/api`).

Resumen: 45 fichas (OTR-01 a OTR-45). Los de mayor riesgo son: OTR-21 (CRM, envío real de email/SMS/fax al cliente), OTR-27 (manifiestos BRT, genera y envía un manifiesto al transportista), OTR-24 (Doctor Pack: imprimir LDV usa `ajax_tmwe_label`), OTR-34 (Copilot: confirma creación/edición/cancelación de expediciones y cargos), OTR-35 (importación masiva, hasta 250 filas), OTR-03/04/07 (Consolidata: precio, respuesta al cliente y conversión a cargo) y OTR-38 (suplantación de partner). Home (`M/home`), `P/dashboard`, `P/presence`, `P/shell` y `P/hub` salvo el buscador no tienen formularios propios: son navegación, tarjetas KPI y latidos. En el SPA no existen pantallas de login ni de "no autorizado": la entrada la resuelve el BFF por redirección (ver OTR-39).

Convenciones: "Auto" = Playwright con datos sembrados; "Manual" = necesita criterio humano o sistemas externos. Los casos que pueden provocar acciones reales llevan la marca "solo con UPSTREAM_DENY_ACTIONS activo" o "solo sandbox".

Hallazgos transversales (detalle en cada ficha):
1. Warehouse queda en solo lectura para todos: `M/warehouse/env.ts:41-48` deriva `canWrite` de `window.__TMWE_INVOICING__`/`__TMWE_WAREHOUSE__`, y ningún código del repo (web ni bff) fija esos globales (`bootstrapBff` solo fija `__TMWE_OPERATIONS__`, `packages/shared-frontend/src/http/bff.ts:214`). Por defecto `canWrite=false`, así que pesar, cargar autista, firmar entregas y generar manifiestos aparecen deshabilitados.
2. Un rechazo del usuario en el login (`/?auth_error=access_denied`) no tiene pantalla: ningún código del SPA lee `auth_error`, y `bootstrapBff` vuelve a redirigir a `/bff/auth/login` (posible bucle). A confirmar en navegador.
3. Varios borrados sin confirmación o con `window.confirm` nativo (eventos CRM, `CrmEventiSection.vue:201-209`; confirmaciones de Consolidata y tickets) y mensajes de error sin tratamiento de campo (CRM cabecera `persistField` sin `catch`, `CrmPraticaPage.vue:39-52`).

---

## Consolidata (M/consolidata)

Endpoints: `GET/POST /unified_consolidation_project` (`PATH` en `services/consolidata.service.ts:26`; POST lleva `action` en el cuerpo) y `POST /unified_consolidation_quote`. Backend: `tmwe_api:controller/api/consolidation/Consolidation_Project_Controller.php`, `tmwe_api:service/consolidation/Consolidation_Action_Catalog.php` (acciones, estados de origen y audiencia), `Consolidation_Staff_Service.php`, `Consolidation_Shipment_Service.php`, `Consolidation_Conversion_Service.php`. Estados del proyecto: A (abierto), P (presupuesto), C (cerrado), X (cancelado). Errores normalizados en `M/consolidata/logic.ts:19-62` (`normalizeApiError`: `fields`, `avisos`, `ammessi`) y mostrados por `components/ConsolidataApiError.vue`. Las acciones disponibles las dicta `meta.actions` del API (`actionAvailable`, `logic.ts:97-106`), no el front. Las acciones de staff (`take`, `assign`, `note_internal`, `answer_quote`, `override_price`, `convert`, `waive_warning`) devuelven `ACCESS_DENIED 403` a un cliente (`Consolidation_Access_Policy.php:35`).

### OTR-01 · Consolidata: cola de proyectos (filtros)
- **Ruta/pantalla:** `/consolidata`  **Componente:** `M/consolidata/pages/ConsolidataQueuePage.vue`  **Envía:** `GET /unified_consolidation_project?view=queue&page&stato&assegnato_a&id_cliente` (filtro remoto)
- **Permisos:** vista de staff (`queue` es audiencia staff, `Consolidation_Action_Catalog.php`); a un cliente el API responde 403.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Estado | v-select (`local.stato`) | No | Valores A/P/C/X; el servidor rechaza otro con `VALIDATION_ERROR 400` "valori ammessi: A, P, C, X" (`Consolidation_Staff_Service.php:66`) |
| Asignado a | v-select (`assegnato_a`) | No | Opciones construidas en `assigneeItems`; sin regla de formato local |
| Cliente | v-text-field number, `clearable` | No | `v-model.number`; Enter aplica (`@keyup.enter="apply"`); sin mínimo |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-01-01 | Aplicar combinación estado + cliente | stato=P, id_cliente de un cliente sembrado | La petición lleva ambos parámetros y la tabla solo muestra proyectos P de ese cliente; contador "total" coincide | P2 | Auto |
| OTR-01-02 | Limpiar filtros | Tras aplicar OTR-01-01 pulsar Limpiar | Vuelven los valores por defecto y se recarga la página 1 | P2 | Auto |
| OTR-01-03 | Cliente inexistente / negativo | id_cliente=-5 y 999999999 | Lista vacía con texto "queue.empty"; sin error de servidor ni cuelgue | P2 | Auto |
| OTR-01-04 | Botón "Tomar" por fila sin asignar | Fila con `assegnato_a` vacío | Navega al detalle tras `take`; en conflicto `already_assigned 409` se muestra el mensaje `consolidata.errors.already_assigned` y no se navega | P1 | Auto |

- **Riesgos / dudas:** el selector de asignado usa ids de operador sin nombre (`#id`, `ConsolidataQueuePage.vue`); la acción `assign` existe en el store (`stores/consolidata.store.ts:166`) pero ninguna pantalla la usa: solo "Tomar".

### OTR-02 · Consolidata: cotizador de consolidación
- **Ruta/pantalla:** `/consolidata/quote`  **Componente:** `M/consolidata/pages/ConsolidataQuotePage.vue`  **Envía:** `POST /unified_consolidation_quote` (cotiza tarifas; no reserva)
- **Permisos:** `authz module pricing / read` (`Consolidation_Quote_Controller.php:46`). Un cliente no puede pedir opciones con servicios bloqueados (`permitir_bloqueados` solo para staff, :71).
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| País destino | v-text-field, `maxlength=2` | Sí (servidor) | Se envía `trim().toUpperCase()`; sin validación local; vacío lo rechaza el servidor (422 `INVALID_REQUEST`) |
| CP destino / Ciudad destino | v-text-field | Servidor | Sin reglas locales |
| Preferencia | v-select | Sí | price / speed / balanced; por defecto balanced |
| Envíos (lista dinámica) | Filas: país origen (`maxlength=2`), CP, ciudad, peso `min=0.1 step=0.1`, bultos `min=1 step=1`, mercancía | País/peso/bultos | Mínimo 1 fila (`removeShipment` no borra la última); por defecto peso 100, bultos 1; el máximo 50 envíos lo impone el servidor (`MAX_SHIPMENTS=50`, `Consolidation_Quote_Controller.php:37`) y devuelve 422 |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-02-01 | Cotización feliz con 2 orígenes | 2 filas (IT y DE), destino ES, preferencia balanced | Tabla de opciones con tramos, total y chips "dominada"; botón de enviar vuelve a habilitarse | P1 | Manual (depende de motor de tarifas) |
| OTR-02-02 | Bultos = 0 | packages=0 en una fila (el `min` HTML no bloquea el envío por código) | El front calcula `weight / packages` (`ConsolidataQuotePage.vue:270`): hay división por cero (Infinity en el JSON, se serializa como null). Verificar que la UI no se rompe y el servidor responde 422 | P1 | Auto |
| OTR-02-03 | Peso decimal con coma / negativo | weight=-3 | Rechazo 422 del servidor mostrado en el banner `error`; no queda resultado anterior (se hace `result=null` al enviar) | P1 | Auto |
| OTR-02-04 | País en minúscula | origen "it", destino "es" | Se envían en mayúsculas; el resultado es idéntico al caso con mayúsculas | P2 | Auto |
| OTR-02-05 | Límite de 50 envíos | 51 filas | 422 "Too many shipments (max 50)" visible; con 50 pasa | P2 | Auto |
| OTR-02-06 | Cotización lenta / motor no disponible | Servidor responde 503 `SERVICE_UNAVAILABLE` | Mensaje de error genérico; formulario conserva los datos | P2 | Manual |
| OTR-02-07 | Eliminar fila con una sola fila | Pulsar borrar con 1 envío | Botón deshabilitado (`shipments.length <= 1`) | P2 | Auto |

- **Riesgos / dudas:** falta validación local (país ISO2, peso > 0, bultos >= 1). Las dimensiones se fijan fijas a 60x40x40 cm (`ConsolidataQuotePage.vue:271`), no editables: el peso volumétrico queda sesgado. La cotización puede llamar al motor de tarifas real; ejecutar solo en sandbox o con datos de tarifa sembrados.

### OTR-03 · Consolidata: responder cotización (AnswerDialog)
- **Ruta/pantalla:** `/consolidata/:id` (botón "Responder")  **Componente:** `M/consolidata/components/ConsolidataAnswerDialog.vue`  **Envía:** `POST /unified_consolidation_project {action:'answer_quote', id, prezzo, valida_fino?, nota?}`
- **Permisos:** staff; solo en estado P (`from: ['P']`, catálogo); la visibilidad del botón depende de `can('answer_quote')`.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Precio | v-text-field number `min=0 step=0.01` | Sí | Botón deshabilitado con `!form.prezzo`; servidor: `> 0` (`Consolidation_Staff_Service.php:195`) y solo EUR (`valuta`) |
| Válida hasta | v-text-field `type=date` | No | Servidor: fecha futura (`ts <= now` -> "data non valida o passata", :206); por defecto `ANSWER_VALIDITY_DAYS` |
| Nota | v-textarea | No | Servidor: máximo `ANSWER_NOTE_MAX` (:213); se envía `trim()` |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-03-01 | Respuesta válida | precio 250.50, fecha dentro de 10 días | Diálogo se cierra, toast "answered", chip "respondida" en la cola y el cliente ve el precio | P0 | Auto |
| OTR-03-02 | Fecha de validez pasada | valida_fino = ayer | Error de campo bajo "Válida hasta" (`fields.valida_fino`) y el diálogo permanece abierto | P0 | Auto |
| OTR-03-03 | Precio 0 y negativo | 0 / -10 | 0 deja el botón deshabilitado; -10 pasa el control local y lo rechaza el servidor con `fields.prezzo` ("deve essere > 0") | P0 | Auto |
| OTR-03-04 | Proyecto fuera de estado P | Abrir en A y forzar `answer_quote` | `invalid_state 409` con `ammessi=[P]`; mensaje `consolidata.errors.invalid_state` | P0 | Auto |
| OTR-03-05 | Precio inicial | Abrir con `initialPrice` de total calculado | Precio precargado = total del proyecto; al reabrir se resetean fecha y nota | P1 | Auto |
| OTR-03-06 | Re-respuesta tras override de precio | Responder, luego `override_price` en un tramo | La respuesta previa se anula y el chip "respondida" desaparece (`Consolidation_Staff_Service.php`, docblock override) | P0 | Manual |
| OTR-03-07 | Nota de 1000+ caracteres | nota = 5000 caracteres | `fields.nota` "massimo N caratteri" | P2 | Auto |

- **Riesgos / dudas:** no hay selector de moneda (el servidor solo admite EUR). El front no limita la nota con `maxlength` ni contador.

### OTR-04 · Consolidata: precio manual de un tramo (PriceDialog)
- **Ruta/pantalla:** `/consolidata/:id`, pestaña Tramos  **Componente:** `M/consolidata/components/ConsolidataPriceDialog.vue`  **Envía:** `POST /unified_consolidation_project {action:'override_price', id, id_tratta, prezzo, fuel, supplementi, motivo}`
- **Permisos:** staff; estados A y P (`from: ['A','P']`).
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Precio | number `step=0.01` | Sí (servidor) | Precarga el precio del tramo; sin `min` local |
| Fuel | number | No | Por defecto 0 |
| Suplementos | number | No | Por defecto 0 |
| Motivo | text | Sí | Servidor: mínimo 3 caracteres (`Consolidation_Staff_Service.php:255-256`); el diálogo siempre abre con motivo vacío |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-04-01 | Override válido | prezzo 400, fuel 20, suppl 10, motivo "acuerdo comercial" | Tramo con `price_source=manuale`, total del proyecto recalculado, toast "priceSaved" | P0 | Auto |
| OTR-04-02 | Motivo de 2 caracteres | motivo="ab" | `fields.motivo` bajo el campo; no se guarda | P0 | Auto |
| OTR-04-03 | Campo numérico vaciado | Borrar precio (`v-model.number` da cadena vacía) | Se envía '' / null: el servidor devuelve error de campo `prezzo`; no se aplica 0 en silencio | P0 | Auto |
| OTR-04-04 | Precio negativo o fuel negativo | -50 | Rechazo del servidor con campo; si el servidor lo acepta, queda como defecto (no determinado: el cuerpo de `update_leg` no se revisó completo) | P0 | Manual |
| OTR-04-05 | Proyecto en C/X | Intentar sobre cerrado | `project_not_editable 409` (`Consolidation_State_Guard.php:29`) y mensaje propio | P0 | Auto |
| OTR-04-06 | Efecto sobre respuesta ya enviada | Proyecto en P con respuesta dada | La respuesta se anula; el chip de respondida desaparece y se pide responder otra vez | P0 | Manual |

- **Riesgos / dudas:** sin regla de rango local para ningún importe.

### OTR-05 · Consolidata: editar tramo (LegEditDialog)
- **Ruta/pantalla:** `/consolidata/:id`, pestaña Tramos  **Componente:** `M/consolidata/components/ConsolidataLegEditDialog.vue`  **Envía:** `POST … {action:'update_leg', id, id_tratta, leg:{weight, goods, value, note}}` (el servidor recotiza: `quotes=true`)
- **Permisos:** estados A y P; participa el rate limit/presupuesto de cotización.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Peso | number `step=0.01` | Servidor | Errores en `fields['leg.weight']` |
| Mercancía | text | No | `fields['leg.goods']` |
| Valor | number `step=0.01` | No | `fields['leg.value']` |
| Nota | textarea 2 filas | No | Sin error de campo mapeado (no hay `:error-messages`) |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-05-01 | Cambiar el peso | weight 100 -> 250 | El tramo se recotiza y cambian precio y total; toast "saved" | P0 | Manual (motor de tarifas) |
| OTR-05-02 | Peso 0 o vacío | weight=0 | Error en `leg.weight`; el diálogo no se cierra | P1 | Auto |
| OTR-05-03 | Error de nota no mapeado | Forzar `fields['leg.note']` desde el servidor | El mensaje solo aparece en el banner general (`ConsolidataApiError`), no en el campo | P2 | Auto |
| OTR-05-04 | Cotización agotada | Servidor responde por límite de cotización | Se muestra el error normalizado y los datos se conservan | P1 | Manual |

- **Riesgos / dudas:** el formulario permite cambiar el peso de un tramo sin avisar de que el precio manual previo (`override_price`) se pierde (no determinado).

### OTR-06 · Consolidata: alta y edición de expedición dentro del proyecto (ShipmentDialog)
- **Ruta/pantalla:** `/consolidata/:id`, pestaña Expediciones  **Componente:** `M/consolidata/components/ConsolidataShipmentDialog.vue`  **Envía:** `POST … {action:'add_shipment'|'update_shipment', id, id_sped?, spedizione:{…}}` (`shipmentPayload`, `services/consolidata.service.ts:90-108`)
- **Permisos:** estados A y P (`editable = can('add_shipment')`); `id_spedizione` (enlace con expedición real) solo lo acepta el servidor para staff (`Consolidation_Shipment_Service.php`, `$id_sped`).
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Ref | text (deshabilitado al editar) | Sí | Servidor: máx. 40, regex `^[A-Za-z0-9._\-/ ]+$` (`:290`); duplicado en el proyecto -> 409 `fields['spedizione.ref']='duplicato'` |
| ID expedición | number | No | Solo staff; si no es staff el servidor lo ignora |
| País origen | text `maxlength=2` | Sí | Servidor ISO2 `^[A-Z]{2}$`; el front lo pasa a mayúsculas |
| Ciudad origen | text | Sí (front) | Servidor máx. 100 |
| CP origen | text | Sí (front) | Servidor máx. 20 |
| Terminal | text | No | Servidor `^[A-Z0-9]{3,5}$` tras mayúsculas |
| Peso | number `step=0.01` | Sí | Servidor `> 0` |
| Bultos | number | No | Por defecto 1; servidor `>= 1` |
| Volumen cm3 | number | No | Servidor `>= 0` |
| Valor | number | No | Servidor `>= 0`, redondeo a 2 decimales |
| Mercancía | text | No | Servidor máx. 255 |
| Fecha lista | `type=date` | No | Servidor `Y-m-d` exacto |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-06-01 | Alta completa | ref "H-001", IT, 20100, Milano, peso 120, bultos 3 | Fila nueva en la pestaña; `peso_tassabile` calculado por el servidor; readiness se recalcula | P0 | Auto |
| OTR-06-02 | Ref duplicada | Segundo alta con ref "H-001" | 409 con error de campo `spedizione.ref` mostrado bajo "Ref" | P0 | Auto |
| OTR-06-03 | Ref con caracteres no permitidos | "H#01" | `fields['spedizione.ref']` con la regla; el front no la valida | P1 | Auto |
| OTR-06-04 | País ISO2 inválido | "ZZ1" truncado por maxlength a "ZZ"; "1A" | "1A" -> `spedizione.orig_paese` "paese ISO2 non valido"; "ZZ" es sintácticamente válido (no se verifica que exista) | P1 | Auto |
| OTR-06-05 | Edición cambia peso | Editar peso de 120 a 80 | `update_shipment`; ref bloqueada; total ponderado del proyecto cambia | P0 | Auto |
| OTR-06-06 | Terminal minúscula y corta | "ab" | El front la convierte a "AB"; servidor rechaza por longitud (`orig_terminal`) | P2 | Auto |
| OTR-06-07 | Fecha lista inválida | 2026-02-30 (el control date no lo permite; forzar por API) | `spedizione.data_pronta` "formato YYYY-MM-DD" | P2 | Auto |
| OTR-06-08 | Proyecto cerrado | Abrir el alta en estado C | Botones ocultos por `can()`; si se fuerza, `project_not_editable 409` | P0 | Auto |
| OTR-06-09 | Enlace con expedición ajena (staff) | `id_spedizione` de otro cliente | No determinado: `load_express` solo verifica estado 'A' (`:282`) y el id_cliente se compara más abajo; comprobar el mensaje | P0 | Manual |

- **Riesgos / dudas:** el front no valida nada y no marca obligatorios con `*`; `colli` se envía solo si es truthy (`if (form.colli)`), así que 0 se omite en silencio y el servidor aplica 1. `peso` se omite si es `null` (cae al error del servidor).

### OTR-07 · Consolidata: convertir proyecto en cargo (ConvertDialog)
- **Ruta/pantalla:** `/consolidata/:id`, botón "Convertir"  **Componente:** `M/consolidata/components/ConsolidataConvertDialog.vue`  **Envía:** `POST … {action:'convert', id, id_cargo}`; la búsqueda usa `cargoListService.fetch` (listado de cargos)
- **Permisos:** staff; el proyecto debe estar en C (`from: ['C']`).
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Cargo | v-autocomplete remoto (`no-filter`), debounce 250 ms, `per_page=15`, `type=all` | Sí | Botón "Ejecutar" deshabilitado sin `idCargo`; el cargo ya enlazado se precarga |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-07-01 | Conversión completa | Cargo sembrado, proyecto C sin avisos bloqueantes | Tabla de resultado por house con chips "vinculada"; `completo=true`; alerta success | P0 | Auto |
| OTR-07-02 | Conversión parcial | Alguna house sin expedición (`pendiente`) | Alerta warning con nº pendientes; el botón cambia a "Reintentar" | P0 | Auto |
| OTR-07-03 | Reintento idempotente | Reejecutar con el mismo cargo | Chips "ya enlazada" (`idempotent=true`), sin duplicar | P0 | Auto |
| OTR-07-04 | Avisos bloqueantes | Proyecto con aviso severidad error o `QUOTE_EXPIRED` sin dispensar | `conversion_blocked 409` con la lista de avisos (`Consolidation_Conversion_Service.php:93`) | P0 | Auto |
| OTR-07-05 | Proyecto ya convertido a otro cargo | Elegir cargo distinto | `already_converted 409` con `id_cargo` enlazado | P0 | Auto |
| OTR-07-06 | Proyecto no cerrado | Forzar desde estado A | `invalid_state 409` | P0 | Auto |
| OTR-07-07 | Búsqueda de cargo sin resultados | Texto "zzzz" | `consolidata.convert.cargoNoData`; `idCargo` conservado | P2 | Auto |

- **Riesgos / dudas:** el diálogo es `persistent` pero no avisa de salir con elección sin ejecutar. Conversión crea/enlaza datos de cargo, no llama a transportista (no determinado: `Consolidation_Conversion_Service` no se revisó entero); ejecutar solo en sandbox.

### OTR-08 · Consolidata: notas internas
- **Ruta/pantalla:** `/consolidata/:id`, pestaña Notas  **Componente:** `M/consolidata/components/ConsolidataNotesTab.vue`  **Envía:** `POST … {action:'note_internal', id, nota}`
- **Permisos:** staff.
- **Campos:** Nota (v-textarea; botón deshabilitado con `!text.trim()`; se envía `trim()`); servidor: obligatoria y máximo `NOTE_MAX` (`Consolidation_Staff_Service.php:157-163`); devuelve las últimas 50.

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-08-01 | Añadir nota | "Cliente pide entrega lunes" | La nota aparece la primera de la lista; el textarea se vacía | P1 | Auto |
| OTR-08-02 | Nota larga | Texto > `NOTE_MAX` | Error `fields.nota` del servidor; el texto no se pierde | P2 | Auto |
| OTR-08-03 | Más de 50 notas | Crear 51 | La lista muestra solo 50, la más reciente primero | P2 | Auto |

- **Riesgos / dudas:** como cualquier campo de texto, el contenido se renderiza como texto (`{{ n.nota }}`): verificar que `<script>` no se ejecuta.

### OTR-09 · Consolidata: dispensar aviso de preparación (diálogo de Readiness)
- **Ruta/pantalla:** `/consolidata/:id`, pestaña Preparación  **Componente:** `M/consolidata/components/ConsolidataReadinessTab.vue` (diálogo líneas 54-80)  **Envía:** `POST … {action:'waive_warning', id, codice, id_prog_sped, motivo}`
- **Permisos:** staff.
- **Campos:** Motivo (v-text-field; botón deshabilitado con `trim().length < 3`; servidor mínimo 3, `Consolidation_Staff_Service.php:289-291`).

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-09-01 | Dispensar aviso bloqueante | motivo "documentación recibida por email" | El aviso pasa a `ignorato=true`; deja de bloquear la conversión (`blockingWarnings`, `logic.ts`) | P0 | Auto |
| OTR-09-02 | Motivo de 2 caracteres | "ab" | Botón deshabilitado; servidor también rechazaría | P1 | Auto |
| OTR-09-03 | Dispensar `QUOTE_EXPIRED` | Aviso de tarifa vencida | Se registra la dispensa; la conversión deja de estar bloqueada por ese motivo | P0 | Manual |

- **Riesgos / dudas:** `id_prog_sped` se envía `?? 0` cuando falta; el servidor puede registrar el aviso sobre el id 0 (no determinado).

### OTR-10 · Consolidata: acciones de estado (tomar, cerrar, reabrir, cancelar, recalcular)
- **Ruta/pantalla:** `/consolidata/:id`  **Componente:** `M/consolidata/pages/ConsolidataDetailPage.vue:224-229` y `components/ConsolidataLegsTab.vue:145`, `ConsolidataShipmentsTab.vue:114`  **Envía:** `POST … {action: take|close|reopen|cancel|recalc|remove_shipment|remove_leg}`
- **Permisos:** `can(action)` por estado: close desde A/P, reopen desde P/C, cancel desde A/P, recalc desde A/P (catálogo).
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-10-01 | Cancelar con confirmación | Pulsar Cancelar y rechazar el `window.confirm` | No se envía nada; aceptar -> estado X y botones desaparecen | P0 | Auto |
| OTR-10-02 | Cerrar y reabrir | A -> C -> reabrir (solo P/C) | Transiciones permitidas; reabrir desde C vuelve a A | P0 | Auto |
| OTR-10-03 | Dos operadores toman el mismo proyecto | Segunda toma | `already_assigned 409`, mensaje y estado sin cambios | P1 | Auto |
| OTR-10-04 | Recalcular con motor de tarifas | Pulsar Recalcular | Toast "recalculated"; límite de cotización posible | P1 | Manual |
| OTR-10-05 | Quitar expedición con confirmación | Aceptar `confirmRemove` | Fila desaparece, totales y readiness se recalculan | P0 | Auto |

- **Riesgos / dudas:** confirmaciones con `window.confirm` nativo (no accesible ni traducible por el diseño del sistema).

---

## Pickup (M/pickup)

Rutas: `/pickup` (panel), `/pickup/list`, `/pickup/calendar`, `/pickup/routes` (`requiresAdmin`), `/pickup/pod` y `/settings/driver-zones` (`requiresAdmin`). Las tres primeras de "paginas de prese" no tienen `title`, no entran en el menú (`router/index.ts:222-246`). El servicio `services/pickups.service.ts` usa `/api_pickups_crud`, `/api_pickup_calendar`, `/api_pickup_driver_assignment`, `/api_pickup_recurring`; `services/driver.service.ts` usa `/api_driver_routes`, `/api_driver_manifest`, `/api_driver_zones`, `/api_driver_delivery`, `/api_driver_pod`. Backend: `tmwe_api:controller/api/pickups/*`, `controller/api/driver/*`. Errores: la mayoría de pantallas muestran `e.message` en un `v-alert`; no hay mapeo por campo.

### OTR-11 · Pickup: alta y edición (PickupEditDialog)
- **Ruta/pantalla:** `/pickup/list`  **Componente:** `M/pickup/components/PickupEditDialog.vue`  **Envía:** `POST /api_pickups_crud` (alta) / `PUT /api_pickups_crud` con `id` en el cuerpo (edición)
- **Permisos:** módulo pickups; un partner solo puede crear en sus propias sedes (403 `access_denied` si no, `Pickup_Crud_Controller.php:96-103`); autista restringido tiene alcance reducido (`driver_restricted_contact_id`).
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Sede | v-text-field number (`id_sede`) | Sí para partner | Es un id numérico libre, no un selector; el servidor verifica pertenencia al tenant |
| Autista (`id_contatti`) | number | No | Por defecto 0 (= sin asignar) |
| Fecha y hora | v-text-field texto libre | Sí | Por defecto `new Date().toISOString().slice(0,16)` con espacio; el servidor exige `data` no vacío (`Pickup_Crud_Controller.php:94-96`); el formato no se valida en el front |
| Dirección | v-select N/S | No | N = en la sede, S = triangulación |
| Nº bultos / Peso | number | No | Sin rangos |
| Recogida fija | v-switch S/N | No | Por defecto N |
| Notas | v-textarea | No | Sin límite |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-11-01 | Alta con perfil partner en sede propia | sede propia, fecha mañana 10:00 | Pickup creado; listado se recarga y el diálogo se cierra | P1 | Auto |
| OTR-11-02 | Alta en sede ajena | id_sede de otro partner | 403 "outside your tenant"; mensaje en el v-alert | P0 | Auto |
| OTR-11-03 | Alta sin sede (partner) | id_sede vacío | 403/validación del servidor; el campo no está marcado como obligatorio | P1 | Auto |
| OTR-11-04 | Fecha con formato inválido | "mañana" | No validado en front; comportamiento del servidor no determinado (el servicio puede lanzar excepción genérica -> `PICKUP_CREATE_ERROR`) | P1 | Manual |
| OTR-11-05 | Fecha vacía | borrar el campo | `validation_error` `data` "Pickup datetime is required" | P1 | Auto |
| OTR-11-06 | Edición con campo fuera de la lista blanca | Enviar `stato` en el PUT | El servidor responde con `ignored_fields` (`Pickup_Crud_Controller.php:130-135`); el front lo ignora (no se muestra) | P2 | Auto |
| OTR-11-07 | Edición de pickup ajeno por URL/id | Cambiar `id` | 404 por IDOR guard (`validate_pickup_access`) | P0 | Auto |
| OTR-11-08 | Cancelar sin guardar | Cerrar con X tras editar | Se cierra sin aviso (el diálogo no es persistent ni detecta "sucio") | P2 | Auto |

- **Riesgos / dudas:** no hay selector de sede ni de autista; la fecha es texto libre. Los campos no se validan (`peso`, `n_colli` pueden ser negativos). Este CRUD es interno y no reserva en transportistas (la reserva real es otro controlador, `Reserve_Pickup_Controller`, que el SPA no usa en este módulo).

### OTR-12 · Pickup: listado (filtros y borrado)
- **Ruta/pantalla:** `/pickup/list`  **Componente:** `M/pickup/pages/PickupListPage.vue`  **Envía:** `GET /api_pickups_crud?page&per_page&data_da&data_a&affidata…`; borrar: `DELETE /api_pickups_crud?id=`
- **Permisos:** el mismo alcance por tenant.
- **Campos:** Desde (date, por defecto hoy), Hasta (date), Asignada (select cualquiera/S/N). `presa_fissa` existe en el modelo de filtros pero no tiene control.

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-12-01 | Rango invertido | Desde 2026-12-01, Hasta 2026-11-01 | Lista vacía, sin error (no hay validación cruzada) | P2 | Auto |
| OTR-12-02 | Filtro asignada=N | affidata='N' | Solo pickups sin autista | P2 | Auto |
| OTR-12-03 | Borrar con confirmación | Confirmar en `confirm.ask` | Fila desaparece y recarga; cancelar no borra | P1 | Auto |
| OTR-12-04 | Borrar un pickup ajeno | id de otro tenant | 404; mensaje de error | P0 | Auto |

- **Riesgos / dudas:** el filtro no se aplica hasta pulsar "Filtrar" (no hay auto-aplicado ni Enter).

### OTR-13 · Pickup: calendario y asignación de autista (DriverAssignDialog)
- **Ruta/pantalla:** `/pickup/calendar`  **Componentes:** `M/pickup/pages/PickupCalendarPage.vue`, `components/DriverAssignDialog.vue`  **Envía:** `GET /api_pickup_calendar`, `GET /api_pickup_driver_assignment?date`, `POST` (`pickup_id`, `driver_id`), `DELETE ?pickup_id`
- **Permisos:** módulo pickups/driver; el autista restringido recibe `driver_scope_denied`.
- **Campos:** Fecha (date + botones día anterior/siguiente), Autista (v-select de autistas disponibles para la fecha; "Asignar" deshabilitado sin selección; "Desasignar" solo si ya hay autista).

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-13-01 | Asignar autista disponible | pickup sin autista, fecha de hoy | Se refresca la rejilla con el autista; diálogo se cierra | P1 | Auto |
| OTR-13-02 | Desasignar | pickup con autista | `DELETE`; el pickup vuelve a "sin asignar" | P1 | Auto |
| OTR-13-03 | Cambio de fecha | Botón día siguiente | Se recarga calendario y la lista de autistas usa la nueva fecha | P2 | Auto |
| OTR-13-04 | Sin autistas disponibles | Fecha sin giros | Select vacío y botón Asignar deshabilitado | P2 | Auto |

- **Riesgos / dudas:** no se pudo determinar si hay comprobación de solapamientos de ruta/capacidad en el servidor.

### OTR-14 · Pickup: panel de operaciones (filtro de fecha)
- **Ruta/pantalla:** `/pickup`  **Componente:** `M/pickup/pages/OperationsPanelPage.vue`  **Envía:** `GET /api_operations_panel?…date`
- Solo filtro: un campo fecha (`v-model="date"`) que recarga el resumen.

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-14-01 | Cambio de fecha | Fecha con datos sembrados | KPIs y listas cambian y coinciden con la API | P2 | Auto |
| OTR-14-02 | Fecha vacía | Borrar el campo | No determinado (no hay guarda en el código revisado): comprobar que no se lanza una petición inválida | P2 | Manual |

### OTR-15 · Pickup: rutas del autista (administración)
- **Ruta/pantalla:** `/pickup/routes`  **Componente:** `M/pickup/pages/DriverRoutesPage.vue`  **Envía:** `GET /api_driver_routes?summary|driver_id&date` y `GET /api_driver_manifest` (lectura; el `POST` de `assignPickup` existe en el servicio pero esta pantalla no lo usa)
- **Permisos:** `meta.requiresAdmin`; el servidor exige `require_internal_admin()` (`Route_Controller.php:49`).
- **Campos:** Fecha (date), Autista (v-select).

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-15-01 | Usuario no admin entra por URL | Perfil partner | Redirección a `/home` por el guard `requiresAdmin` | P1 | Auto |
| OTR-15-02 | Autista sin giro en la fecha | Autista sin pickups | Mensaje de vacío sin error | P2 | Auto |
| OTR-15-03 | Manifiesto inexistente | Pedir manifiesto de fecha sin datos | 404 tratado (no determinado en esta pantalla; el de warehouse sí lo trata) | P2 | Manual |

### OTR-16 · Pickup: zonas de autista (administración)
- **Ruta/pantalla:** `/settings/driver-zones`  **Componente:** `M/pickup/pages/DriverZonesPage.vue`  **Envía:** `GET /api_driver_zones?provinces=1|id_provincia`, `POST /api_driver_zones {cap, id_contatto}`, `DELETE /api_driver_zones?cap=`
- **Permisos:** `requiresAdmin` y `require_internal_admin()` (`Driver_Zone_Controller.php:50`).
- **Campos:** Provincia (v-select; carga las zonas), CAP (texto, obligatorio para añadir), Autista (number `id_contatto`, obligatorio); botón "Asignar" deshabilitado si falta CAP o autista. Borrado con `confirm.ask`.

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-16-01 | Asignar CAP a autista | CAP "20100", autista válido | La zona aparece en la tabla; el campo CAP se vacía | P1 | Auto |
| OTR-16-02 | CAP duplicado | Misma asignación otra vez | No determinado: reasigna o error según el servidor (`Driver_Zone_Controller.php`); probar y documentar | P1 | Manual |
| OTR-16-03 | Quitar zona inexistente | `clearZone` de CAP ya borrado | 404 "No active assignment found for CAP" mostrado en el alert | P2 | Auto |
| OTR-16-04 | CAP con formato inválido | "ABC" | Sin validación local; resultado del servidor no determinado | P2 | Manual |
| OTR-16-05 | Autista = id inexistente | 999999 | No determinado (el controlador revisado solo exige que `id_contatto`/`cap` existan) | P1 | Manual |

### OTR-17 · Pickup: prueba de entrega (POD) del autista
- **Ruta/pantalla:** `/pickup/pod`  **Componente:** `M/pickup/pages/DriverPodPage.vue`  **Envía:** `GET /api_driver_delivery?ldv` (verificar) y `POST /api_driver_pod {ldv, esito, note?, firma?, lat?, lng?}`
- **Permisos:** módulo driver. Registra la entrega y puede cerrar la expedición/lanzar tracking (efectos del servicio `Delivery_Confirmation_Service`; no determinado el detalle completo).
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| LDV | v-text-field, Enter busca | Sí | Botón deshabilitado con vacío; `trim()`; servidor 404 si no existe |
| Resultado | v-btn-toggle `mandatory` C/M | Sí | Por defecto C (entregado); M = mancata |
| Firma | v-text-field | No | Texto libre |
| Notas | v-textarea | No | |
| Geolocalización | botón (navigator.geolocation, timeout 8000, alta precisión) | No | Errores a `error` con textos `no_geo` y `geo_failed` |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-17-01 | Entrega correcta | LDV sembrada, esito C, firma "Mario" | `done=true`, alerta success, formulario reiniciado, la expedición pasa a entregada | P0 | Auto |
| OTR-17-02 | LDV inexistente | "ZZZ999" | Mensaje de 404 en el alert; no aparece la tarjeta de entrega | P1 | Auto |
| OTR-17-03 | Mancata (esito M) con nota | M + nota "cliente ausente" | Registra el intento y la nota; tracking refleja la excepción | P0 | Manual |
| OTR-17-04 | Doble registro de la misma LDV | Repetir tras éxito | Sin duplicar entrega: `delivery_claimed=false` (ver OTR-26); la pantalla no lo muestra | P0 | Auto |
| OTR-17-05 | Geolocalización denegada | Denegar el permiso | Alerta `geo_failed`; el registro sigue siendo posible con lat/lng nulos | P2 | Auto (con permiso simulado) |
| OTR-17-06 | Cancelar | Pulsar Cancelar con datos | Reinicia todo sin confirmación | P2 | Auto |

- **Riesgos / dudas:** esta pantalla y OTR-26 duplican el registro de POD con campos distintos (aquí sin fecha/hora de entrega ni selector de estados de tracking).

---

## CRM (M/crm)

Rutas: `/crm` (listado), `/crm/pratiche/:id` (ficha), y el drawer de contexto (`CrmContextDrawer.vue`) que se abre desde expediciones y cargos. Servicio `services/crm.service.ts`: `/api_crm_crud` (GET/POST/PUT/DELETE, incluye `createFromShipment`), `/api_crm_events`, `/api_crm_types`, `/api_crm_message` (GET lista, POST envía). Backend: `tmwe_api:controller/api/crm/Crm_Crud_Controller.php`, `Crm_Event_Controller.php`, `Crm_Message_Controller.php`. Estados de pratica: A (abierta), L (en curso), C (cerrada).

### OTR-18 · CRM: listado (búsqueda y filtros)
- **Ruta/pantalla:** `/crm`  **Componente:** `M/crm/pages/CrmListPage.vue`  **Envía:** `GET /api_crm_crud` (filtros remotos); borrar: `DELETE /api_crm_crud`
- **Permisos:** módulo crm (`access_denied` si falta, `Crm_Crud_Controller.php:38`).
- **Campos:** Búsqueda `oggetto` (text, se aplica con Enter, lupa o al limpiar), Estado (select Todos/A/L/C; aplica al cambiar), Tipo (select clearable), Abierta desde / hasta (date; aplican al cambiar). También `?ti=` (atajo) e `?indicator=open_cases|overdue_followups` por URL (`applyRouteFilter`).

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-18-01 | Deep-link de indicador | `/crm?indicator=overdue_followups` | Filtros se reemplazan por `{stato A, indicator}`, aparece el chip de indicador y se puede quitar (`clearIndicator`) | P2 | Auto |
| OTR-18-02 | Persistencia de filtros con KeepAlive | Escribir una búsqueda, abrir una ficha y volver | Los filtros se conservan y solo se refrescan los datos | P2 | Auto |
| OTR-18-03 | Rango de fechas invertido | desde > hasta | Lista vacía sin error | P2 | Auto |
| OTR-18-04 | Borrado lógico desde la lista | Confirmar `window.confirm` | La pratica desaparece; cancelar no hace nada | P1 | Auto |

- **Riesgos / dudas:** la celda de cliente y de asunto cae a `#id` cuando faltan (`oggettoCell`), ok. Confirmación con `window.confirm`.

### OTR-19 · CRM: cabecera de la pratica (edición en línea)
- **Ruta/pantalla:** `/crm/pratiche/:id`  **Componente:** `M/crm/pages/CrmPraticaPage.vue` + `components/CrmHeaderLookups.vue`  **Envía:** `PUT /api_crm_crud` con un solo campo por cambio (`persistField` en blur / `update:model-value`)
- **Permisos:** módulo crm; cada acción comprueba tenant (404 "CRM record not found or access denied").
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Cliente | solo lectura (`cliente-readonly`) | - | No editable en esta ficha |
| Contacto | v-autocomplete dependiente del cliente (deshabilitado sin `idAnagrafica`) | No | Al elegir, rellena nombre/email/tel solo si están vacíos (`onPickContatto`) |
| Nombre / Email / Tel | text | No | Persisten en blur; sin validación de formato de email |
| Asunto (`oggetto`) | text | No | Blur |
| Tipo | v-select | No | Persiste al cambiar |
| Expedición vinculada | v-text-field readonly con botón de abrir | - | `id_spedizione < 7.999.999` = cargo, si no express (`CrmPraticaPage.vue:88-100`) |
| Ref. cliente | text | No | Blur |
| Próximo contacto (`data_next`) | `datetime-local` | No | Blur |
| Descripción / Notas internas | textarea | No | Blur |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-19-01 | Edición en línea guarda solo el campo cambiado | Cambiar `oggetto` y salir del campo | Un solo PUT con `{oggetto}`; el spinner de guardado aparece; sin cambios, no hay PUT (`value === store.current[field]`) | P1 | Auto |
| OTR-19-02 | Elegir contacto rellena vacíos sin pisar | Pratica con nombre ya escrito, elegir contacto con otro nombre | Se guarda `id_contatto` y email/tel vacíos; el nombre existente no cambia | P1 | Auto |
| OTR-19-03 | Respuesta tardía del servidor | Editar dos campos rápido con latencias cruzadas | Se aplica solo la respuesta de la última secuencia por campo (`headerMutationSequences`, `crm.store.ts:357-385`); no se pisa un valor nuevo | P1 | Manual (latencia simulada) |
| OTR-19-04 | Cambio de pratica durante el guardado | Navegar a otra ficha antes de la respuesta | La respuesta se descarta (`isCurrentMutationContext`) | P2 | Manual |
| OTR-19-05 | Abrir expedición vinculada | id 8000001 vs 12345 | 8000001 -> `shipment-detail`; 12345 -> `cargo-detail` | P2 | Auto |
| OTR-19-06 | Fallo del servidor al guardar | 403/404 al PUT | No determinado: `persistField` no tiene `catch` (solo `finally`), el valor erróneo queda en el formulario y solo se ve el aviso del cliente HTTP si lo hay | P1 | Manual |
| OTR-19-07 | `data_next` vacío | Borrar fecha | Se envía '' o null; verificar que el servidor lo guarda como sin fecha | P2 | Auto |

- **Riesgos / dudas:** `CrmPraticaPage.vue:39-52` sin tratamiento de error y sin revertir el campo. No hay validación de email/teléfono.

### OTR-20 · CRM: eventos de la pratica (alta, detalle, borrado)
- **Ruta/pantalla:** `/crm/pratiche/:id` y drawer  **Componente:** `M/crm/components/CrmEventiSection.vue`  **Envía:** `POST /api_crm_events {id_crm, descriz, stato_pratica}`; `PUT /api_crm_events {id, descriz, stato_pratica, data}`; `DELETE /api_crm_events?id=`
- **Campos:** Alta: Estado (select A/L/C, por defecto A) + Descripción (text, Enter o botón; deshabilitado vacío). Detalle (diálogo): Estado, Fecha (datetime-local, obligatoria para guardar), Descripción (textarea, obligatoria).

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-20-01 | Evento con estado C cierra la pratica | Alta con estado C | Se recarga la lista y `stato_pratica` de la cabecera pasa a C (`crm.store.ts:401-408`) | P1 | Auto |
| OTR-20-02 | Editar fecha del evento | Cambiar `data` | Servidor exige `YYYY-MM-DD HH:MM:SS`; el front convierte `T` -> espacio; error "Invalid date" si no | P1 | Auto |
| OTR-20-03 | Borrar evento sin confirmar | Pulsar el icono de papelera | Se borra de inmediato, sin confirmación (`CrmEventiSection.vue:201-209`) | P1 | Auto |
| OTR-20-04 | Descripción solo con espacios | "   " | El botón de alta está deshabilitado; en el detalle también (`!editDescriz.trim()`) | P2 | Auto |
| OTR-20-05 | Estado inválido forzado | stato_pratica="Z" | 422 "Invalid CRM event status" | P2 | Auto |
| OTR-20-06 | Notificación al cliente | `notify_client` (el SPA no lo envía) | Ningún email sale al crear evento desde este formulario | P0 | Auto (verifica ausencia) |

- **Riesgos / dudas:** borrado sin confirmar; el backend admite `notify_client` pero el SPA no lo expone.

### OTR-21 · CRM: enviar mensaje al cliente (CrmSendMessageDialog)
- **Ruta/pantalla:** `/crm/pratiche/:id` y drawer  **Componente:** `M/crm/components/CrmSendMessageDialog.vue`  **Envía:** `POST /api_crm_message` (JSON o `multipart` con `file1..file3` si hay adjuntos)
- **Permisos:** módulo crm. El envío genera registro en historial de mensajes (docsstory) y envía email/SMS/fax/carta real.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Canal | v-select eMail/SMS/FAX/Posta (M/S/F/C) | Sí | Por defecto M |
| Destinatario | v-text-field | No | Se precarga `defaultEmail`; si vacío el servidor intenta resolverlo; si no puede: `dest_msg` "No recipient could be resolved" (`Crm_Message_Controller.php:155`) |
| Asunto | v-text-field | Condicional | Obligatorio si canal != SMS y `usabase` apagado (`subjectRequired`) |
| Texto | v-textarea 5 filas | No | `trim()` |
| Adjuntos | zona drag&drop + input file múltiple | No | Máximo 3 (`MAX_FILES`), sin duplicados por nombre+tamaño; sin límite de tamaño ni tipo en el front |
| Usar plantilla base | v-switch | No | Por defecto activo; envía `usabase` S/N |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-21-01 | Envío con plantilla base a buzón de pruebas | canal M, destino buzón de test, usabase S | Mensaje con `esito` OK, aviso verde y cierre a los 900 ms; registro en el historial | P0 | Manual (solo con UPSTREAM_DENY_ACTIONS activo o buzón sandbox) |
| OTR-21-02 | Sin plantilla base y sin asunto | usabase N, asunto vacío | Botón Enviar deshabilitado; con SMS no se exige asunto | P1 | Auto |
| OTR-21-03 | Destinatario vacío sin email en la ficha | dest vacío, pratica sin email | `validation_error` en `dest_msg`; el mensaje aparece en el banner | P1 | Auto |
| OTR-21-04 | Resultado KO del envío | Servidor responde esito KO | Banner de error con `crm.send.result`, el diálogo NO se cierra | P1 | Manual |
| OTR-21-05 | Adjuntos: máximo 3 y duplicados | Arrastrar 4 ficheros y uno repetido | Solo 3, el duplicado se ignora; la zona queda "llena" | P1 | Auto |
| OTR-21-06 | Adjunto grande | Fichero de 30 MB | No determinado (límite del servidor/PHP); comprobar mensaje de error | P2 | Manual |
| OTR-21-07 | Doble clic en Enviar | Clic doble rápido | Un solo envío (el botón se bloquea con `loading`) | P0 | Auto |
| OTR-21-08 | Canal Fax/Posta | Elegir F o C | No determinado qué hace el servicio con canales no email; probar y documentar | P1 | Manual |

- **Riesgos / dudas:** envío de mensajes reales a clientes; las ramas SMS/FAX/Posta no están verificadas. `setTimeout(close, 900)` no se cancela si el usuario cierra antes.

### OTR-22 · CRM: selector de pratica del drawer de contexto
- **Ruta/pantalla:** drawer desde expedición/cargo  **Componente:** `M/crm/components/CrmContextDrawer.vue`  **Envía:** solo carga (`GET`) al cambiar de pratica
- **Campos:** v-select `selectedId` (lista de pratiche vinculadas), pestañas Eventos/Mensajes, botón "Enviar mensaje" (abre OTR-21), reintentos.

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-22-01 | Cambio de pratica con una carga fallida | Seleccionar pratica B mientras A tarda | Estado `loading`/`error` coherente; no se mezclan eventos de A y B | P2 | Manual |
| OTR-22-02 | Crear pratica desde expedición | `createFromShipment` | Se vincula a la expedición y el drawer lo selecciona | P1 | Auto |

---

## Warehouse (M/warehouse)

Rutas: `/warehouse/weighing`, `/warehouse/docpack`, `/warehouse/driver-load`, `/warehouse/deliveries`, `/warehouse/manifests`; el guard es `warehouseCan.read()` (siempre true por defecto). Servicios en `services/warehouse.service.ts`: `/api_docpack_validation`, `/api_docpack_parcels`, `/api_docpack_completeness`, `/api_driver_routes`, `/api_driver_manifest`, `/api_driver_delivery`, `/api_driver_pod`, `/api_manifest_history`, `/api_brt_manifest`. Backend `tmwe_api:controller/api/docpack/*`. Lógica pura en `logic.ts` (con tests unitarios en `logic.spec.ts`).

Incidencia que afecta a todas las fichas: `canWrite` sale de `env.ts` y vale `false` mientras nadie inyecte `__TMWE_INVOICING__`/`__TMWE_WAREHOUSE__` (ver hallazgo 1). Cada ficha incluye un caso de verificación de permisos. Las pantallas muestran el aviso `read_only` cuando `!canWrite`.

### OTR-23 · Warehouse: pesaje manual
- **Ruta/pantalla:** `/warehouse/weighing`  **Componente:** `M/warehouse/pages/WeighingPage.vue`  **Envía:** lookup `GET /api_docpack_validation?sticker`; guardar: bulto existente `PUT /api_docpack_parcels` (`weighParcel`), documento `POST /api_docpack_parcels {action:'batch_weigh'}` (`weighDocument`), huérfano nuevo `POST /api_docpack_validation {action:'register', sticker, …}`
- **Permisos:** `can.write()`; sin permiso los campos y Guardar quedan deshabilitados.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Marcador (sticker) | v-text-field con foco automático, Enter busca | Sí | `createScanGuard`: ignora el mismo código repetido en 500 ms, quita saltos/tabulaciones y `trim` (`logic.ts:20-40`) |
| Modo | v-btn-toggle Bulto/Documento `mandatory` | Sí | Por defecto Bulto |
| Kg | text `inputmode=decimal` | Sí | `parsePositive`: acepta coma decimal, > 0 y finito (`logic.ts:43-48`) |
| Ancho / Largo / Alto | text decimal | Sí en modo Bulto | Los tres > 0; en Documento no se piden |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-23-01 | Pesaje de bulto conocido | sticker sembrado, 12,5 kg, 40x30x20 | PUT con `peso 12.5`, `dim_a/l/p`; toast "saved", formulario se reinicia y se anota en "hechos" | P0 | Auto |
| OTR-23-02 | Coma decimal | "12,5" | Se interpreta 12.5 | P1 | Auto |
| OTR-23-03 | Cero y negativo | kg "0" / "-3" | Marca el campo (`errors`), no se envía | P0 | Auto |
| OTR-23-04 | Modo Documento | kg 0,3 sin medidas | `batch_weigh` con `tipo:'D'`; las medidas no son obligatorias | P1 | Auto |
| OTR-23-05 | Marcador desconocido | sticker inexistente | Alerta "not_found" y se ofrece registrar como huérfano; al guardar `register` | P0 | Auto |
| OTR-23-06 | Huérfano duplicado | Registrar el mismo sticker dos veces | `409` mostrado como aviso "duplicate" (`ApiError.status===409`) | P0 | Auto |
| OTR-23-07 | Escaneo doble por lector | Mismo código dos veces en < 500 ms | Una sola consulta | P1 | Auto |
| OTR-23-08 | Sticker huérfano ya registrado | `source` = 'orphan' | Aviso "orphan_already" y no se envía | P1 | Auto |
| OTR-23-09 | Sin permiso de escritura | Sesión sin `canWrite` | Campos deshabilitados y aviso de solo lectura (estado actual por defecto) | P0 | Auto |

- **Riesgos / dudas:** no hay máximo de peso/dimensiones (un 9999999 pasa la validación); `kg` sin límite superior. Se vuelcan peso/medidas de la consulta previa en los campos, lo que puede mover un valor ya pesado sin aviso.

### OTR-24 · Warehouse: Doctor Pack (control de bultos, huérfanos, pendientes, imprimir LDV)
- **Ruta/pantalla:** `/warehouse/docpack`  **Componente:** `M/warehouse/pages/DocpackPage.vue` (740 líneas)  **Envía:** `GET` validación, completitud y bultos; `POST /api_docpack_validation {action:'associate', orphan_id, shipment_id}`; `POST /api_docpack_parcels {action:'auto_match'|'mark_printed'}`; imprimir LDV vía `labelsService.tmweLabel` (`M/warehouse/print.ts`, endpoint `ajax_tmwe_label`)
- **Permisos:** `can.write()` para imprimir/asociar; botón Imprimir exige `printEnabled` (permiso, expedición cargada, no ocupado, y todos pesados o "emergencia").
- **Campos:** Vista (toggle pendiente/pesados/sin pesar/huérfanos…), Marcador (escáner), Fecha (date), Días pendientes (select `PENDING_DAYS_OPTIONS`), filtros de huérfanos y pendientes, Expedición a asociar (text -> entero > 0), Emergencia (switch).

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-24-01 | Imprimir con bultos sin pesar | expedición con 2 de 3 pesados, emergencia apagada | Botón Imprimir deshabilitado; con emergencia activa se habilita (`canPrintWaybill`) | P0 | Auto |
| OTR-24-02 | Imprimir LDV completa | expedición totalmente pesada | Genera etiqueta PDF, abre pestaña y marca los bultos impresos (`markPrinted`); toast "printed" | P0 | Manual (solo con UPSTREAM_DENY_ACTIONS activo: `ajax_tmwe_label` puede generar etiqueta real) |
| OTR-24-03 | Asociar huérfano a expedición válida | orphan + id existente | Se comprueba `completeness` (no `not_found`), luego `associate`; toast y se vuelve a escanear | P0 | Auto |
| OTR-24-04 | Asociar con id no numérico / cero | "abc", "0", "1.5" | Aviso "shipment_invalid" sin llamada | P1 | Auto |
| OTR-24-05 | Asociar a expedición inexistente | id 999999999 | Aviso "shipment_not_found" | P1 | Auto |
| OTR-24-06 | Auto-match | Pulsar con expedición cargada | `auto_match`; se actualiza la lista de bultos | P1 | Auto |
| OTR-24-07 | Cambio de "días pendientes" | Cambiar el select | Se recarga la lista de clientes pendientes (`watch(pendingDays)`) | P2 | Auto |
| OTR-24-08 | Filtro multibulto pesado/sin pesar | Vista "weighed" con datos | Solo multibulto (>1 esperado) y todos pesados (`filterMultiparcel`) | P2 | Auto |
| OTR-24-09 | Doble clic en Imprimir | Doble clic | Un solo documento (`busy`) | P0 | Auto |

- **Riesgos / dudas:** la emergencia permite imprimir sin pesar; no hay registro de quién la activó (no determinado). La asociación se valida con una consulta previa (no atómica con el `associate`).

### OTR-25 · Warehouse: giro del autista (carga de bultos)
- **Ruta/pantalla:** `/warehouse/driver-load`  **Componente:** `M/warehouse/pages/DriverLoadPage.vue`  **Envía:** `POST /api_docpack_parcels {action:'assign_driver', parcel_ids, driver_id}`, `POST {action:'clear_driver_loading', driver_id, date, confirm}`, `GET /api_driver_manifest`
- **Permisos:** `can.write()`; ver nota de OTR-23.
- **Campos:** Fecha (date; al cambiar recarga autistas y descarta la selección), Autista (v-select), Escáner de bulto (Enter), botón Reset (diálogo de confirmación `confirmReset`), botón Manifiesto.

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-25-01 | Cargar bulto en el giro | autista + sticker de bulto | `assign_driver`; contadores (bultos, expediciones, kg) se actualizan | P0 | Auto |
| OTR-25-02 | Bulto ya cargado | Mismo sticker otra vez | Aviso "already" sin llamada | P1 | Auto |
| OTR-25-03 | Sticker huérfano o desconocido | sticker no encontrado | Aviso "not_found" (solo se aceptan bultos de `spedizioni_colli`) | P1 | Auto |
| OTR-25-04 | Reset de la carga | Confirmar | Servidor exige `confirm` verdadero y devuelve error de validación si falta; tras reset contadores a 0 | P0 | Auto |
| OTR-25-05 | Manifiesto inexistente / sin permiso | Autista sin manifiesto | 404 -> aviso "manifest_none"; 403 -> "manifest_forbidden" | P2 | Auto |
| OTR-25-06 | Cambio de fecha con autista elegido | Cambiar fecha | Se limpia el autista y la carga cargada | P2 | Auto |

- **Riesgos / dudas:** el reset borra las lecturas de carga de la fecha: sin posibilidad de deshacer; el diálogo es el único freno.

### OTR-26 · Warehouse: firmas de entrega (POD)
- **Ruta/pantalla:** `/warehouse/deliveries`  **Componente:** `M/warehouse/pages/DeliveriesPage.vue`  **Envía:** `GET /api_driver_delivery?ldv` y `POST /api_driver_pod {ldv, esito, firma?, note?, data_consegna}`
- **Permisos:** `can.write()`.
- **Campos:** LDV (Enter), Resultado (v-select agrupado: entregado id 7 primero, excepciones P/R; las que abren retención de stock llevan nota `may_hold`), Fecha (date, por defecto hoy), Hora (HH:MM, por defecto ahora), Firma, Notas.

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-26-01 | Entrega con fecha y hora | LDV, esito 7, hoy 10:30 | `data_consegna = "AAAA-MM-DD 10:30:00"` (`formatDeliveryDate`), toast "saved" | P0 | Auto |
| OTR-26-02 | Excepción que abre retención | Elegir resultado con `apri_giac='S'` | La opción lleva la etiqueta "may_hold"; al guardar se abre retención de stock (efecto en giacenze) | P0 | Manual |
| OTR-26-03 | Entrega ya registrada | Repetir LDV entregada | `delivery_claimed=false` -> alerta "already_delivered" | P0 | Auto |
| OTR-26-04 | LDV inexistente | "NOPE" | 404 -> aviso "ldv_not_found" | P1 | Auto |
| OTR-26-05 | Fecha futura / muy antigua | Fecha de mañana o de hace 5 años | No determinado: el front no valida y no se ha revisado el límite del servidor | P0 | Manual |
| OTR-26-06 | Fallo al cargar estados de tracking | `trackingStatuses` falla | Se ofrece solo "Entregado" (id 7) y se avisa; no se pueden registrar excepciones | P1 | Auto |
| OTR-26-07 | Hora vacía | Borrar la hora | `formatDeliveryDate` usa "00:00:00" | P2 | Auto |

- **Riesgos / dudas:** `data_consegna` sin tope temporal.

### OTR-27 · Warehouse: manifiestos (BRT) e historial
- **Ruta/pantalla:** `/warehouse/manifests`  **Componente:** `M/warehouse/pages/ManifestsPage.vue`  **Envía:** `POST /api_brt_manifest {shipment_ids}` y `GET /api_manifest_history?date&carrier&page`
- **Permisos:** `can.write()`; el backend exige `POST` y existe `CONFIG_ERROR 500` si BRT no está configurado (`Brt_Manifest_Controller.php:55`).
- **Campos:** IDs de expediciones (v-textarea; `parseIdList` acepta coma, espacio, `;`, salto de línea; enteros únicos > 0; **descarta en silencio** cualquier token no numérico), pestañas DHL/TNT/UPS deshabilitadas, confirmación en diálogo; filtros Fecha (date) y Transportista (text, Enter), paginación 20.

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-27-01 | Lista de ids mixta | "10, 11; 11\n12a 13" | Contador "selected" = 3 (10, 11, 13) y "12a" se ignora sin avisar | P0 | Auto |
| OTR-27-02 | Generar manifiesto BRT | ids de expediciones BRT sembradas | Confirmación; `queued` con `id_manifest` y `shipments`; aparece en el historial | P0 | Manual (solo sandbox o con UPSTREAM_DENY_ACTIONS activo: genera y encola el envío FTP al transportista) |
| OTR-27-03 | Sin expediciones BRT resueltas | ids de otro transportista | `EMPTY_MANIFEST 422`; toast de error `manifests.failed` | P0 | Auto |
| OTR-27-04 | Ids sin válidos | solo "abc" | Botón "Generar BRT" deshabilitado (`!ids.length`) | P1 | Auto |
| OTR-27-05 | Cancelar la confirmación | Rechazar el diálogo | No se envía nada, la lista se conserva | P1 | Auto |
| OTR-27-06 | Filtro de historial | Fecha + transportista "BRT" | Cambia la tabla; se reinicia a página 1 | P2 | Auto |
| OTR-27-07 | Estado enviado/no enviado | Fila con `invio_ftp` = 0000-00-00 | Se muestra como no enviado (`isManifestSent`) | P2 | Auto |
| OTR-27-08 | Re-generación de las mismas expediciones | Repetir con los mismos ids | No determinado: no hay idempotencia visible en el front; riesgo de manifiestos duplicados | P0 | Manual |

- **Riesgos / dudas:** no hay límite local de ids; riesgo de duplicidad (OTR-27-08). El texto de ayuda `others_unavailable` indica transportistas aún no soportados.

---

## Plantillas de email (M/email_templates)

Ruta `/email-templates`. Servicio `services/emailTemplates.service.ts`: `/api_master_templates_web` (GET/POST/PUT/DELETE), `/api_modelli_preview_web` (POST), `/api_modelli_assist_web` (POST, asistencia IA). Backend `tmwe_api:controller/api/master_data/Modelli_Controller.php`: propiedad estricta para escritura (`owns`), lectura de las plantillas base permitida a partners; el dueño lo asigna el servidor en alta para partners (`prepare_for_insert`) y en actualización `id_anagrafica` nunca cambia. `isTmwe` viene de `window.__TMWE_OPERATIONS__.isTmwe` (`useIsTmwe.ts`, sí inyectado por `bootstrapBff`).

### OTR-28 · Plantillas de email: listado (filtros)
- **Ruta/pantalla:** `/email-templates`  **Componente:** `M/email_templates/pages/EmailTemplatesPage.vue`  **Envía:** filtro local sobre `GET` completo; borrado: `DELETE /api_master_templates_web?id=`
- **Campos:** Búsqueda (text), Tipo (select clearable, valores únicos), Idioma (select), Propietario (select, solo TMWE); acciones editar/duplicar/borrar (borrado con `confirm.askDanger`; las plantillas base solo editables/borrables por TMWE, `:303`).

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-28-01 | Partner ve base como solo consulta | Perfil partner, plantilla base | Puede duplicar; editar/borrar no disponibles; el editor abre en modo `base_readonly` | P1 | Auto |
| OTR-28-02 | Filtro propietario solo TMWE | Perfil TMWE vs partner | El select de propietario solo aparece para TMWE | P1 | Auto |
| OTR-28-03 | Borrar plantilla | Confirmar | Desaparece (borrado lógico `stato='O'`); cancelar no borra | P1 | Auto |
| OTR-28-04 | Etiqueta de motor | Plantilla con `{{ var }}` o `{% if %}` | Chip "modern" (regex `RE_MODERN`); sin ellos, "legacy" | P2 | Auto |

### OTR-29 · Plantillas de email: editor (alta, edición, duplicado, vista previa, IA)
- **Ruta/pantalla:** diálogo desde `/email-templates`  **Componente:** `M/email_templates/components/EmailTemplateEditor.vue`  **Envía:** `POST /api_master_templates_web` (alta/duplicado) / `PUT` con `id` (edición); `POST /api_modelli_preview_web`; `POST /api_modelli_assist_web`
- **Permisos:** TMWE puede elegir dueño al crear y editar cualquiera; partner solo crea para sí y edita las propias; base en solo lectura para partner.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Tipo | v-text-field (solo en alta) | Sí | `canSave` exige no vacío; sin formato definido en front |
| Idioma | v-select ITA/ENG/SPA/FRA (solo alta) | Sí | `LINGUE` coincide con el ENUM de `modelli.lingua`; no incluye NL ni DE aunque la app tenga 5 idiomas de UI |
| Dueño | autocomplete de anagrafica (solo TMWE y alta) | No | Vacío = base (id 1); al editar es solo lectura |
| Descripción / Asunto / Remitente | text | No | Sin límites locales |
| Cuerpo HTML | editor visual (contenteditable) y pestaña Código (textarea) sobre el mismo `form.html` | No (pero no hay guarda de vacío) | `pristine` evita reescribir HTML no tocado |
| Marcadores | tabla con buscador; botón Insertar añade al final del HTML | - | `insertToken` concatena al final y salta a la pestaña Código |
| Vista previa | iframe `sandbox=""` + `srcdoc` | - | Errores/avisos devueltos en `issues` (error/warning/info) |
| Ayuda IA | acciones draft/translate/explain/fix + idioma destino + instrucción | - | Nunca escribe en el formulario sin pulsar Aplicar; traducir/explicar/corregir requieren HTML |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-29-01 | Alta de plantilla propia (partner) | tipo "OFERTA", ITA, HTML sencillo | Se crea con `id_anagrafica` del partner aunque el cuerpo diga otro; toast "saved" y cierre | P1 | Auto |
| OTR-29-02 | TMWE crea una base | Sin dueño | `id_anagrafica = 1` | P1 | Auto |
| OTR-29-03 | TMWE crea para un partner | Elegir partner | `id_anagrafica = id del partner` | P1 | Auto |
| OTR-29-04 | Duplicar una base | Acción duplicar | Se abre relleno sin `templateId`, descripción con "(copia)", tipo/idioma/dueño editables; guardar CREA y no modifica el original | P1 | Auto |
| OTR-29-05 | Abrir y cerrar sin tocar | Abrir una plantilla y cerrar | HTML intacto; no se envía PUT | P1 | Auto |
| OTR-29-06 | Duplicado tipo+idioma+dueño | Misma combinación existente | No determinado: no hay regla de unicidad visible en `Modelli_Controller`; revisar la tabla/modelo y el mensaje | P1 | Manual |
| OTR-29-07 | Marcador inexistente | `{{ foo_inexistente }}` | La vista previa devuelve `issues` con severidad error; el guardado se permite igualmente (se ejecuta `runPreview` antes) | P1 | Auto |
| OTR-29-08 | Vista previa con script | `<script>alert(1)</script>` en el HTML | El iframe con `sandbox=""` no ejecuta el script; la SPA no se ve afectada | P0 | Auto |
| OTR-29-09 | IA: aplicar una sugerencia inválida | Respuesta con `valid=false` | Se muestra aviso `ai_invalid`; Aplicar sigue disponible (revisar) | P1 | Manual (depende del proveedor de IA; coste) |
| OTR-29-10 | IA sin proveedor / límite | Error del servidor | Aviso `assist.error` en la propia pestaña; el formulario no cambia | P2 | Manual |
| OTR-29-11 | Partner edita plantilla ajena por id | PUT a id de otro dueño | Rechazo del servidor (`can_update`); toast con el mensaje | P0 | Auto |
| OTR-29-12 | Insertar marcador estando en visual | Pulsar Insertar | Se añade al final del HTML (no en el cursor) y cambia a Código | P2 | Auto |

- **Riesgos / dudas:** `LINGUE` no incluye `NL`/`DE`; no hay validación de formato de `tipo`; `window.prompt` del editor para enlaces (ver OTR-43).

---

## Tickets (M/communication)

Rutas: `/tickets` (listado) y `/tickets/:id` (hilo). Servicio `services/communication.service.ts`: `/api_communication_conversations` (GET/POST/PUT), `/api_communication_messages` (GET/POST/PUT), `/api_communication_stream_token`. Backend `tmwe_api:controller/api/communication/*`: asunto máx. 80 y cuerpo 1-4000 (COMM_VALIDATION, nunca recorta, `Communication_Conversations_Controller.php:141-146`); mensaje 1-4000 (`Communication_Messages_Controller.php:142`).

### OTR-30 · Tickets: listado (búsqueda y estado)
- **Ruta/pantalla:** `/tickets`  **Componente:** `M/communication/pages/TicketsListPage.vue`  **Envía:** `GET /api_communication_conversations?status&search&page`
- **Campos:** Búsqueda (Enter o lupa), Estado (select Abiertos/Cerrados/Todos; por defecto open).

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-30-01 | Cambiar estado a cerrados | status=closed | Solo tickets cerrados; "all" omite el parámetro | P2 | Auto |
| OTR-30-02 | Búsqueda con texto largo | > 100 caracteres | El servidor limita a 100 (`max_length` 100); mensaje de validación o recorte, no determinado | P2 | Manual |
| OTR-30-03 | KeepAlive | Abrir hilo y volver | La lista se refresca (`onActivated`) sin perder el filtro | P2 | Auto |

### OTR-31 · Tickets: nuevo ticket (NewTicketDialog)
- **Ruta/pantalla:** `/tickets`  **Componente:** `M/communication/components/NewTicketDialog.vue`  **Envía:** `POST /api_communication_conversations {subject, body}`
- **Campos:** Asunto (`maxlength=80`, contador, obligatorio), Mensaje (textarea `maxlength=4000`, obligatorio); Enviar deshabilitado con cualquiera vacío tras `trim`; diálogo `persistent` mientras guarda.

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-31-01 | Crear ticket | Asunto 80 caracteres exactos, cuerpo 4000 | Se crea, navega al hilo (`created`); límites coinciden con el servidor | P1 | Auto |
| OTR-31-02 | Pegado que excede el límite | 5000 caracteres | `maxlength` recorta a 4000 en el navegador; el servidor nunca recibe más | P2 | Auto |
| OTR-31-03 | Error del servidor | Forzar `COMM_VALIDATION` | Mensaje bajo los campos (`error`), diálogo abierto con datos | P1 | Auto |
| OTR-31-04 | Reabrir el diálogo | Cerrar y abrir | Campos reseteados | P2 | Auto |

### OTR-32 · Tickets: hilo (responder y cerrar)
- **Ruta/pantalla:** `/tickets/:id`  **Componente:** `M/communication/pages/TicketThreadPage.vue`  **Envía:** `POST /api_communication_messages`; cerrar: `PUT /api_communication_conversations {conversation_id, status:'closed'}`; leído: `PUT /api_communication_messages`; tiempo real vía token de stream
- **Campos:** Mensaje (textarea auto-grow; Enter envía, Mayús+Enter no está previsto: `@keydown.enter.exact.prevent` solo bloquea Enter sin modificadores); deshabilitado si `is_open===false`; botón Cerrar con `window.confirm`.

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-32-01 | Responder con Enter | Texto + Enter | Se envía y se vacía; baja el scroll | P1 | Auto |
| OTR-32-02 | Salto de línea con Mayús+Enter | Mayús+Enter | Inserta salto sin enviar | P2 | Auto |
| OTR-32-03 | Fallo de envío | Servidor 500 | El texto se restaura en el campo (`draft.value = text`) y aparece el error | P1 | Auto |
| OTR-32-04 | Mensaje de más de 4000 caracteres | Pegar 4500 | No hay `maxlength` ni contador en este campo: el servidor responde `COMM_VALIDATION` y se muestra `sendError` | P1 | Auto |
| OTR-32-05 | Cerrar ticket | Aceptar confirmación | El ticket pasa a cerrado y el campo/botón se deshabilitan; cancelar no cierra | P1 | Auto |
| OTR-32-06 | Mensaje en tiempo real de otro usuario | Segundo navegador responde | Aparece sin recargar (SSE); no se duplica | P1 | Manual |

- **Riesgos / dudas:** el campo del hilo carece de límite de 4000 (el diálogo de alta sí lo tiene).

---

## Copilot (M/copilot)

Ruta `/copilot`. Chat `POST /copilot_chat` (`stores/chat.store.ts:110`), confirmación de propuestas `POST /api_copilot_write_proposal` (`services/proposal.ts:20`). Las acciones de navegación que sugiere el LLM se restringen a una lista cerrada (`services/actions.ts`, 7 nombres de ruta, ids enteros positivos, query filtrada).

### OTR-33 · Copilot: composer del chat
- **Ruta/pantalla:** `/copilot`  **Componente:** `M/copilot/components/ChatComposer.vue` (+ `pages/CopilotPage.vue`)  **Envía:** `POST /copilot_chat {message, history, context}`
- **Campos:** Mensaje (textarea auto-grow, hasta 6 filas; Enter envía), micrófono (Web Speech si hay soporte; idioma del reconocimiento: es-ES, it-IT, en-US, resto cae a en-US), botón Enviar (deshabilitado vacío o `disabled`), conmutador de agente de voz (ElevenLabs) y botón de limpiar.

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-33-01 | Enviar un mensaje | "expediciones de hoy" | Burbuja del usuario y respuesta; si hay `actions[]` navega tras 600 ms a la primera acción válida | P1 | Manual (depende del proveedor de IA) |
| OTR-33-02 | Errores del proveedor | 429, `ai_not_configured`, `ai_budget` | Se muestra la clave `copilot.errors.*` correspondiente, la burbuja marca error | P1 | Auto (con servidor simulado) |
| OTR-33-03 | Acción de navegación maliciosa | Respuesta con ruta no listada o `id=-1` | No navega (`resolveAction` devuelve null) | P0 | Auto |
| OTR-33-04 | Reconocimiento de voz en NL/DE | Locale nl o de | Usa `en-US` por falta de mapeo (`useVoice.ts:44-48`) | P2 | Manual |
| OTR-33-05 | Doble Enter | Dos Enter seguidos | Un solo envío (el composer se deshabilita mientras espera) | P1 | Auto |

### OTR-34 · Copilot: tarjeta de propuesta (confirmar acciones de escritura)
- **Ruta/pantalla:** `/copilot`  **Componente:** `M/copilot/components/ProposalCard.vue` + `composables/useProposalCard.ts`  **Envía:** `POST /api_copilot_write_proposal` con el token de la propuesta (`buildConfirmRequest`)
- **Permisos:** el token de propuesta lo emite el servidor; acciones `create_shipment`, `edit_cargo`, `cancel_cargo`, `cancel_express`. Las cancelaciones fuerzan confirmación reforzada aunque el flag falte (`proposal.ts:91-93`). Caducidad máxima 300 s (`MAX_EXPIRES_IN`).
- **Campos:** Casilla de reconocimiento (solo reforzada; el botón Confirmar exige marcarla), Confirmar/Reintentar, Descartar, cuenta atrás.

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-34-01 | Confirmar creación de expedición | Propuesta `create_shipment` válida | Estado "confirming" -> "confirmed", `createdId` y enlace a la expedición | P0 | Manual (solo con UPSTREAM_DENY_ACTIONS activo: la creación puede reservar con transportista) |
| OTR-34-02 | Cancelación exige reconocimiento | Propuesta `cancel_cargo` | El botón está deshabilitado hasta marcar la casilla; el botón es rojo | P0 | Auto |
| OTR-34-03 | Propuesta caducada | Esperar `expires_in` | Cuenta atrás en rojo "expired", Confirmar deshabilitado; confirmar manualmente da `errorKind='expired'` | P0 | Auto (con reloj simulado) |
| OTR-34-04 | `expires_in` desmedido | `expires_in=99999` | Se limita a 300 s | P1 | Auto |
| OTR-34-05 | Reintento tras error recuperable | Error `retryable` | Aparece "Reintentar"; un reintento reusa la misma propuesta sin duplicar | P0 | Auto |
| OTR-34-06 | Descartar | Pulsar Descartar | La tarjeta pasa a `dismissed`, desaparecen los botones y no se envía nada | P1 | Auto |
| OTR-34-07 | Propuesta mal formada | `target.kind` desconocido o `expires_in<=0` | La propuesta se rechaza (parser devuelve null) y no se pinta tarjeta | P1 | Auto |
| OTR-34-08 | Doble clic en Confirmar | Doble clic | Una sola petición (`confirming`) | P0 | Auto |

- **Riesgos / dudas:** las acciones reales (crear/cancelar) afectan a transportistas; el parser de propuestas tiene tests (`proposal.spec.ts`) pero no E2E.

---

## Importación masiva (M/bulk)

### OTR-35 · Importación masiva express/cargo (asistente de 3 pasos)
- **Ruta/pantalla:** `/bulk`  **Componente:** `M/bulk/pages/BulkImportPage.vue` + `stores/bulk.store.ts`  **Envía:** `GET` mapping, `POST {csv_data, delimiter}` (vista previa, no inserta) y `PUT {rows}` (importa) sobre `/api_bulk_import` (express) o `/api_bulk_cargo_import` (cargo)
- **Permisos:** autorización de los controladores `Bulk_Import_Controller` / `Bulk_Cargo_Import_Controller` (`tmwe_api:controller/api/shipment/`, `controller/api/cargo/`); máximo 250 filas (`MAX_ROWS`, `Bulk_Import_Service.php:20`, `Cargo_Bulk_Import_Service.php:21`).
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Modo | v-btn-toggle Express/Cargo | Sí | Cambiar de modo reinicia mapeo, vista previa, resultado y vuelve al paso 1, pero NO borra el CSV pegado (`setMode`) |
| CSV | v-textarea 8 filas, auto-grow | Sí | "Validar" deshabilitado con `!csvData.trim()`; sin subida de fichero aunque el backend acepta `.xlsx` en base64 |
| Delimitador | v-text-field `maxlength=1` | No | Por defecto ","; si queda vacío se envía '' (el servidor usa `?? ','`, que no cubre cadena vacía; no determinado) |
| Importar N | botón del paso 2 | - | Deshabilitado con `valid==0`; importa solo `valid_rows` (hasta 250) |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-35-01 | Flujo feliz express | CSV de 3 filas válidas | Paso 2 con resumen 3 válidas / 0 inválidas, tabla de vista previa (máx. 20 filas); paso 3 con "3 importadas" | P0 | Auto |
| OTR-35-02 | Filas mixtas | 2 válidas y 1 con error | Tabla de errores con nº de fila y mensajes; Importar solo 2 | P0 | Auto |
| OTR-35-03 | Más de 250 filas | CSV de 300 | `Exceeded maximum of 250 rows` (preview/import); mensaje legible | P0 | Auto |
| OTR-35-04 | Delimitador `;` y `\t` | CSV con ; y delimitador ";" | Parsea; con delimitador incorrecto da "No data rows found" o columnas mal mapeadas | P1 | Auto |
| OTR-35-05 | Delimitador vacío | Borrar el campo | Comportamiento no determinado; riesgo de error 500 o de parseo mal hecho | P1 | Manual |
| OTR-35-06 | Cambio de modo con CSV pegado | Pegar CSV express, pasar a Cargo | El texto se mantiene y se revalida con el mapeo de cargo | P2 | Auto |
| OTR-35-07 | "Volver" y reintento | Paso 2 -> Volver | `reset()` BORRA el CSV (`csvData=''`) y obliga a pegar de nuevo | P2 | Auto |
| OTR-35-08 | Doble clic en Importar | Doble clic | Un solo PUT (`importing`); sin duplicados de expediciones | P0 | Auto |
| OTR-35-09 | Importación con errores parciales | `result.errors.length > 0` | Se informa de cuántas fallaron pero no cuáles (solo el recuento) | P1 | Auto |
| OTR-35-10 | Importación cargo | CSV de cargo | Crea registros de cargo; si el importador llama a tarifas o transportistas, no determinado | P0 | Manual (solo sandbox) |
| OTR-35-11 | Texto con HTML/Unicode en celdas | `<b>x</b>`, ñ, emoji | Se muestra como texto en la vista previa (interpolación, no `v-html`) | P2 | Auto |

- **Riesgos / dudas:** el paso 3 no lista los errores de importación (solo el recuento, `BulkImportPage.vue`); no hay confirmación previa de Importar; el `valid_rows` viaja del cliente al servidor, así que el servidor debe revalidar (no verificado: depende de `Bulk_Import_Service`).

---

## Home (M/home)

`HomeLandingPage.vue` y `RecentList.vue` no contienen controles de entrada ni formularios: son una landing de accesos y una lista de recientes (los únicos `v-bind` son enlaces `to/href`). `P/dashboard` (`HomePage.vue`, `HomeKpiTile.vue`) tampoco: solo pestañas, grupos y navegación a listados con filtros por query. Se cubren por pruebas de navegación, no de formularios. `P/presence/presence.ts` envía el latido `web_presence_heartbeat` cada 60 s con cabecera `X-Client-Instance` (UUID por pestaña en `sessionStorage`); no es un formulario.

---

## Plataforma, entrada/sesión y componentes compartidos

### OTR-36 · Buscador global
- **Ruta/pantalla:** barra superior de todas las pantallas  **Componente:** `P/platform/PlatformSearch.vue`  **Envía:** `GET /bff/v1/api_platform_search?q=` (con `fetch` directo)
- **Campos:** Entrada de texto (placeholder), atajo global "/" (no se activa si el foco ya está en INPUT/TEXTAREA/SELECT), flechas y Enter para navegar, Esc para cerrar, botón limpiar; debounce 200 ms; mínimo 2 caracteres tras `trim`; los resultados son cargo/shipment/anagrafica y al elegir hace `window.location.href = r.href` (recarga completa con la URL que devuelve el servidor).

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-36-01 | Mínimo de caracteres | "a" y "ab" | Con 1: mensaje `min_chars`, sin petición; con 2: petición tras 200 ms | P2 | Auto |
| OTR-36-02 | Navegación con teclado | "/" -> texto -> flecha abajo -> Enter | Abre el resultado resaltado | P2 | Auto |
| OTR-36-03 | Sin resultados | Texto sin coincidencias | Mensaje `no_results` con la consulta | P2 | Auto |
| OTR-36-04 | Consulta con caracteres especiales | `a&b=c#?`, `<script>` | Se codifica con `encodeURIComponent`; los resultados se muestran como texto | P1 | Auto |
| OTR-36-05 | Alcance por perfil | Partner busca un cargo/anagrafica de otro | No aparece (el aislamiento lo impone el servidor) | P0 | Auto |

- **Riesgos / dudas:** el href viene del servidor y se asigna sin validar; si fuese `javascript:` se ejecutaría (riesgo bajo, origen de confianza). Al reutilizar solo `fetch` directo no hay manejo de 401 más allá del interceptor global. Solo existen tres tipos de resultado.

### OTR-37 · Selector de idioma
- **Ruta/pantalla:** barra superior  **Componente:** `P/platform/LanguageSwitcher.vue`  **Envía:** `PATCH /bff/v1/api_i18n_me {language: ITA|ENG|SPA|OLA|TED}` (mejor esfuerzo) tras guardar `localStorage['tmwe.locale']`, y luego `window.location.reload()`
- **Campos:** menú de banderas con los idiomas que existan en `availableLocales` del i18n de la app (operations: it, en, es, nl, de); ítem activo marcado; Esc cierra; si se elige el mismo idioma no hace nada.

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-37-01 | Cambio entre los 5 idiomas | it, en, es, nl, de | Recarga y toda la UI en el idioma elegido; el valor persiste en nuevas pestañas | P1 | Auto |
| OTR-37-02 | Fallo del PATCH | PATCH devuelve 500 o red caída | Se ignora el error; la UI cambia igualmente (por localStorage) y el idioma de servidor queda desfasado | P2 | Auto |
| OTR-37-03 | Idioma servidor vs. local | Cambiar idioma, recargar | Gana `localStorage` sobre el idioma de la sesión (`plugins/i18n.ts:168-181`) | P2 | Auto |
| OTR-37-04 | Claves sin traducir | Recorrer pantallas del grupo en `de` y `nl` | No quedan claves crudas; los textos fijos en italiano de `StoricoMessaggiPanel` y los `title` de `HtmlRichEditor` (español) quedan fuera del i18n | P2 | Manual |

- **Riesgos / dudas:** `OTR-33-04` (voz) y `FormModal` por defecto en italiano (OTR-43) son los puntos con más probabilidad de textos sin traducir.

### OTR-38 · Cambio de partner (suplantación)
- **Ruta/pantalla:** barra superior (oculta por debajo de 720 px)  **Componente:** `P/platform/PlatformPartnerSwitch.vue`  **Envía:** `GET /bff/impersonation` (lista y partner activo) y `POST /bff/impersonation {partner_id}`; luego `window.location.reload()`
- **Permisos:** solo personal TMWE: el BFF responde 403 `not_tmwe` a los demás y el componente no se pinta (`ImpersonationController.php`, `show` y `switch`); el backend exige el scope `partner:impersonate` (`impersonation_not_allowed 403`). El token CSRF lo añade el interceptor global (`bff.ts:installBffFetch`).
- **Campos:** v-autocomplete de partners (one-way `model-value` + handler), partner activo (1 = TMWE / sin suplantación), estado `switching`.
- **Reglas del BFF:** `partner_id` debe ser entero o cadena de dígitos (si no, 422 `invalid_partner`); `null`, 0 o 1 limpian la suplantación; un id fuera de la lista da 404 `partner_not_found`; el estado se guarda en sesión con `at`.

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-38-01 | Usuario TMWE suplanta a un partner | Elegir un partner sembrado | POST correcto, recarga y todos los listados quedan acotados al partner; el selector muestra ese partner | P0 | Auto |
| OTR-38-02 | Volver a TMWE | Elegir la opción TMWE (id 1) | La suplantación se limpia y la UI vuelve al alcance TMWE | P0 | Auto |
| OTR-38-03 | Partner normal | Sesión de partner | El selector no aparece (403 en el GET) | P0 | Auto |
| OTR-38-04 | POST rechazado | Forzar 403/404/502 | No hay mensaje al usuario; `switching` vuelve a false y el valor mostrado no cambia (error silencioso) | P1 | Auto |
| OTR-38-05 | Techo de permisos | Suplantar un partner con menos permisos | Los menús y botones reflejan el techo cliente ∩ usuario del partner; las rutas `requiresAdmin` siguen según el perfil real | P0 | Manual |
| OTR-38-06 | Sesión caducada durante la suplantación | 401 en el POST | El interceptor redirige al login del BFF | P1 | Auto |
| OTR-38-07 | Doble selección rápida | Dos cambios seguidos | El segundo se ignora (`switching`) | P1 | Auto |

- **Riesgos / dudas:** error silencioso en el POST (`PlatformPartnerSwitch.vue:94-96`); no hay indicador visible (banner) de que se está suplantando más allá del valor del selector (no determinado si hay otro aviso global). La suplantación debería registrarse en auditoría: no se ha comprobado.

### OTR-39 · Entrada y salida de sesión (BFF) y menú de usuario
- **Ruta/pantalla:** no hay pantallas de login ni de "no autorizado" en el SPA. La entrada es `GET /bff/auth/login?return_to=` (redirección OAuth2/PKCE), `GET /bff/auth/callback`, `GET /bff/auth/session` y `POST /bff/auth/logout` (`bff/src/Http/AuthController.php`). Menú: `P/platform/UserMenu.vue` (cierre de sesión con `bffLogout`, enlace "perfil" a `/erp/profilo.php` del ERP clásico).
- **Permisos:** `return_to` solo admite rutas internas: regex `^/(?![/\\])[^\r\n]*$` y máx. 512 (`AuthController.php:158-162`); si no, `/`. Callback: `login_expired` (pending caducado), `access_denied` (error de OAuth), `invalid_state`; todos redirigen a `/?auth_error=<código>` (`failed`, :147).
- **Campos:** ninguno (flujo de redirección); `UserMenu` muestra nombre/email/cliente de `get_my_profile`.

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-39-01 | Acceso sin sesión a una ruta profunda | Abrir `/ops/cargo/12` sin sesión | Redirige al login y, tras autenticarse, vuelve a esa misma ruta | P0 | Manual (IdP real) |
| OTR-39-02 | `return_to` malicioso | `//evil.com`, `/\evil`, `https://evil.com`, ruta con salto de línea | Se sustituye por `/`; nunca redirige fuera del origen | P0 | Auto |
| OTR-39-03 | Rechazo en el login | Denegar en el IdP | Vuelve a `/?auth_error=access_denied`; el SPA no tiene pantalla ni lee ese parámetro, y `bootstrapBff` redirige otra vez al login (posible bucle); comprobar | P0 | Manual |
| OTR-39-04 | Estado inválido o caducado | Callback con `state` distinto o pasados `PENDING_TTL` s | `invalid_state`/`login_expired` sin crear sesión | P0 | Auto |
| OTR-39-05 | Cerrar sesión | Menú -> Cerrar sesión | Modal de "cerrando sesión", `POST /bff/auth/logout` con CSRF, y navega a `/`; un segundo clic no repite | P1 | Auto |
| OTR-39-06 | Logout sin CSRF | POST sin cabecera `X-CSRF-Token` | 403 `csrf_invalid` | P0 | Auto |
| OTR-39-07 | Caducidad de sesión a mitad de trabajo | Invalidar sesión en servidor y pulsar cualquier acción | 401 -> redirección al login (excepto rutas `/bff/auth/`) | P0 | Auto |
| OTR-39-08 | Usuario sin permiso de la pantalla | Partner a `/settings/...` | Guard `requiresAdmin` redirige a `/home`; las llamadas directas devuelven 403 del backend | P0 | Auto |

- **Riesgos / dudas:** ver hallazgo 2 (`auth_error` sin tratamiento); `bootstrapBff` redirige tanto si `authenticated=false` como si falta `csrf_token` (`bff.ts:196-199`).

### OTR-40 · Campana de notificaciones
- **Ruta/pantalla:** barra superior  **Componente:** `P/platform/PlatformNotificationBell.vue` y `M/shell/NotificationActionHost.vue`  **Envía:** `GET /bff/v1/api_notifications` (cada 60 s y al abrir) y `POST /bff/v1/api_notifications_action {action:'read'|'dismiss', ids?}`
- **Campos:** panel con acciones por notificación (kind `navigate`, `open_modal`, `dismiss`), "marcar todas leídas", descartar (optimista: la fila desaparece al instante y luego se refresca).

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-40-01 | Marcar todas como leídas | Pulsar | `read` sin ids; contador a 0 tras refetch | P2 | Auto |
| OTR-40-02 | Descartar una | Pulsar descartar | Desaparece al instante; si el POST falla, reaparece tras el refetch | P2 | Auto |
| OTR-40-03 | Acción `open_modal` "awb_request" | Aviso de stock AWB | Marca leída, cierra el panel y abre `CargoAwbRequestDialog` desde cualquier pantalla (el diálogo envía una solicitud al transportista: ver ficha de cargo) | P0 | Manual (solo con UPSTREAM_DENY_ACTIONS activo) |
| OTR-40-04 | Acción `navigate` con destino externo | `target` = URL arbitraria | Se hace `window.location.href = target` sin validar el origen | P1 | Auto |

- **Riesgos / dudas:** `target` de notificación sin validación (`PlatformNotificationBell.vue`, `runAction`); los errores de red se tragan (`catch {}` vacío).

### OTR-41 · Listados: panel de filtros, chips y selector de vista de trabajo (componentes genéricos)
- **Ruta/pantalla:** cualquier listado que use `ListingDataView`  **Componentes:** `P/listing/FilterDrawer.vue`, `ActiveFilterChips.vue`, `ListingWorkViewSelector.vue`, `ListingDataView.vue`, `useClientSideListSource.ts`, `useListContext.ts`, `work-views.ts`  **Envía:** solo filtro local; los listados que lo usan hacen la petición
- **Campos:** Drawer lateral (60 % del viewport) con buscador de campos (salta a la primera pestaña que coincide), pestañas por grupo con contador, botones Limpiar (N), Cancelar y Aplicar (con `previewCount`); chips cerrables y botón "limpiar todos" (solo con más de 1 filtro) y "avanzado"; selector de vista de trabajo (`resolveWorkView`: si la vista pedida no es compatible cae a `standard` o a la primera compatible; si no hay vistas lanza error); tabla con selección, orden y filas por página [10, 25, 50, 100] (`must-sort`).

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-41-01 | Buscador de campos | "peso" en el drawer | Se oculta cualquier pestaña sin coincidencia y se salta a la primera que casa; sin coincidencias: mensaje `search_no_match` | P2 | Auto |
| OTR-41-02 | Contadores por pestaña | Aplicar 3 filtros en 2 grupos | Cada pestaña muestra su recuento; el botón Limpiar muestra el total | P2 | Auto |
| OTR-41-03 | Reabrir el drawer | Cerrar y abrir | La búsqueda de campos se vacía y se abre en la primera pestaña con filtros | P2 | Auto |
| OTR-41-04 | Quitar un chip | Cerrar un chip | Se elimina solo ese filtro y se recarga | P2 | Auto |
| OTR-41-05 | Vista de trabajo incompatible | `?view=x` no compatible con el tipo de listado | Cae a la vista por defecto sin error | P2 | Auto |
| OTR-41-06 | Orden en cliente | Ordenar por columna numérica y de texto con valores nulos | Numérico por valor, texto por `localeCompare`; nulos agrupados según la dirección (`useClientSideListSource.ts`) | P2 | Auto |
| OTR-41-07 | Contexto de lista | Abrir detalle y volver | Restaura el scroll al registro (sessionStorage `tmwe:list:context`, caduca a 1 h) | P2 | Auto |

- **Riesgos / dudas:** `useClientSideListSource` no ordena de forma estable los nulos (decisión de diseño) y `must-sort` impide quitar el orden.

### OTR-42 · Compositor de email compartido (EmailComposer y RecipientPicker)
- **Ruta/pantalla:** diálogos de cargo/express (p. ej. `EmailDocumentModal`, `PartnerOfferModal`, `ExpressAwardModal`, `OfferRepliesModal`, `CargoAgencyNotifyPanel`)  **Componentes:** `P/email/EmailComposer.vue`, `RecipientPicker.vue`, `types.ts`  **Envía:** lo que defina cada adaptador (`adapter.send(model)`); la previsualización usa `emailPreviewService`
- **Permisos:** los de la pantalla que lo hospeda.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Destinatarios | autocomplete del catálogo + email manual (Enter o botón) | Sí | "Enviar" deshabilitado sin destinatarios; email manual: regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`, normalizado a minúsculas, sin duplicados por clave `id:`/`em:`; un email inválido se ignora SIN mensaje (`RecipientPicker.vue:131-133`) |
| CC | idem (si `supportsCc`) | No | |
| Idioma | v-select (si `supportsLangSelect`) | - | Cambiarlo recarga la plantilla (se pierden ediciones del cuerpo) |
| Nota | textarea | No | Cambia el cuerpo con debounce de 400 ms mientras no se haya editado a mano |
| Adjuntos | v-autocomplete múltiple | No | Solo si el adaptador tiene adjuntos |
| Cuerpo | editor enriquecido (si `supportsPreview`) | - | Solo se envía `bodyHtml` si el operador lo editó; si no, `bodyHtml=''` y el servidor usa la plantilla |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-42-01 | Envío con cuerpo sin editar | Destinatario de test | `bodyHtml` vacío en el modelo; el servidor renderiza la plantilla | P0 | Manual (solo con UPSTREAM_DENY_ACTIONS activo o buzón sandbox) |
| OTR-42-02 | Cuerpo editado a mano | Modificar el HTML y enviar | Se envía `bodyHtml` editado | P0 | Manual (idem) |
| OTR-42-03 | Email manual inválido | "foo@bar" y "foo bar@x.com" | Se ignora sin mensaje y el campo se mantiene; debería avisarse | P1 | Auto |
| OTR-42-04 | Duplicados | Mismo email por catálogo y manual | No se duplica en la lista | P2 | Auto |
| OTR-42-05 | Cambio de idioma tras editar | Editar el cuerpo y cambiar idioma | Se pierden las ediciones (recarga forzada); no se avisa | P1 | Auto |
| OTR-42-06 | Envío con fallo | `adapter.send` devuelve `sent=0` con errores | Banner de error con el primer motivo; el diálogo no se cierra | P1 | Auto |
| OTR-42-07 | Excepción en `adapter.send` | El adaptador lanza | `submit` solo tiene `try/finally`, no hay `catch`: el error no llega al banner (depende del adaptador) | P1 | Manual |
| OTR-42-08 | Éxito y cierre automático | `sent>0` | Banner de éxito, emite `sent` y cierra a 1200 ms | P1 | Auto |
| OTR-42-09 | Doble envío | Doble clic en Enviar | Un solo envío (loading) | P0 | Auto |

- **Riesgos / dudas:** `EmailComposer.vue:~300-330`: sin `catch`; el temporizador de cierre no se cancela si se cierra el diálogo antes. Ver fichas de cargo/shipment para los adaptadores concretos (fuera de este grupo).

### OTR-43 · Marcos de formulario de UI: FormModal, AppDialog, ConfirmDialog, HtmlRichEditor
- **Ruta/pantalla:** componentes usados por muchos diálogos  **Componentes:** `P/ui/FormModal.vue`, `AppDialog.vue`, `ConfirmDialog.vue`, `HtmlRichEditor.vue`, `FieldHelpTooltip.vue`, `form-modal-host.ts`
- **Comportamiento:** FormModal es `persistent`; al abrir inicia un borrador (`beginDraft`), "Guardar" confirma el borrador (`commitDraft`, errores a `draftErrors`), Cancelar/X/Esc descarta con confirmación si hay cambios (`ConfirmDialog` con textos "unsaved"). Etiquetas por defecto en italiano ("Annulla", "Salva", "Modifiche non salvate", `FormModal.vue` props); `HtmlRichEditor` usa `document.execCommand`, `window.prompt('URL:')` para el enlace (sin validar esquema) y títulos de botones fijos en español.

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-43-01 | Cancelar con cambios | Editar un campo y pulsar Esc | Aparece el diálogo de descartar; "Continuar" conserva los cambios; "Descartar" cierra y revierte | P1 | Auto |
| OTR-43-02 | Cancelar sin cambios | Abrir y cerrar | Cierra sin confirmar | P2 | Auto |
| OTR-43-03 | Validación al guardar | Guardar con errores | Lista de errores en el alert del diálogo; no se cierra | P1 | Auto |
| OTR-43-04 | Etiquetas por defecto | Un host que no pase etiquetas | Se muestran en italiano en cualquier idioma | P2 | Manual |
| OTR-43-05 | Enlace con esquema peligroso | Insertar `javascript:alert(1)` con el botón de enlace | No se valida en el cliente; el enlace queda en el HTML guardado (el saneado depende del envío real) | P0 | Auto |
| OTR-43-06 | Pegado de HTML externo | Pegar HTML con estilos y scripts | `contenteditable` lo acepta tal cual; revisar que el cuerpo guardado no ejecuta scripts en el correo | P0 | Manual |
| OTR-43-07 | Sin cambios no reescribe | Abrir y salir sin tocar | No se emite `update:modelValue` salvo `input`/`blur`; `blur` sí emite aunque no haya cambio | P2 | Auto |

- **Riesgos / dudas:** `HtmlRichEditor.vue:154-171` (`prompt`, `execCommand` obsoleto) y `onInput` en `@blur` que emite siempre, lo que puede marcar "sucio" un formulario sin cambios reales.

### OTR-44 · Buscador del Hub de funcionalidades
- **Ruta/pantalla:** páginas hub (`FeatureHubPage`)  **Componente:** `P/hub/FeatureHubSearch.vue` + `hubGroups.ts` (`searchGroups`, `filterAllowedGroups`)  **Envía:** solo filtro local
- **Campos:** v-text-field clearable; filtra grupos por texto; los grupos se limitan a los permitidos por perfil (`allowed`).

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-44-01 | Búsqueda sin resultados | Texto inexistente | No se muestra ninguna tarjeta; mensaje de vacío | P2 | Auto |
| OTR-44-02 | Respeto de permisos | Perfil sin acceso a un grupo | Ese grupo/tarjeta nunca aparece, ni buscándolo por nombre | P1 | Auto |
| OTR-44-03 | Limpiar | Pulsar la X | Se restauran todos los grupos permitidos (`$event ?? ''`) | P2 | Auto |

### OTR-45 · Historial de mensajes enviados (StoricoMessaggiPanel, huérfano)
- **Ruta/pantalla:** ninguna (sin referencias en el repo)  **Componente:** `P/platform/StoricoMessaggiPanel.vue`  **Envía:** `docsstoryService.list` (filtros canal/esito/tipo, 50 por página) y `docsstoryService.resend(id)` (reenvía un mensaje)
- **Campos:** selects Canal (M/S/F/C) y Resultado (WRK/OK/KO), input Tipo (Enter busca), botón "Cerca". Todos los textos están en italiano fijo (no usan i18n).
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| OTR-45-01 | Reenviar un mensaje fallido | Fila KO -> Reenviar | Se clona el registro y se reenvía (efecto real); solo si la pantalla se monta algún día | P0 | Manual (solo sandbox; hoy no accesible) |
| OTR-45-02 | Cambio de filtro reinicia página | Estar en página 3 y filtrar | Vuelve a página 1 | P2 | Auto |

- **Riesgos / dudas:** componente sin uso: o se elimina o se publica con i18n. Si se activa, "reenviar" lanza un envío real sin confirmación.

### Composables transversales de `packages/shared-frontend/src` (sin ficha propia)
- `useMoneyFieldBinding.ts`: un campo monetario = un commit en blur; muestra el importe en la moneda objetivo y envía `{campo: valor, amount_currency: sigla}`; si no cambia en espacio de visualización no persiste. `useTargetCurrency.ts` y `useMetricImperial.ts` (LB=0.453592, IN=2.54) convierten unidades. `useEntityCreate.ts` hace `POST` de alta y extrae el id (`data.id` o `id`); si no hay id notifica "Creation failed: no id returned". `useTextSanitize.ts` `stripHtml` quita etiquetas con regex y decodifica entidades vía un `textarea`. Casos a cubrir desde los formularios que los usan (cargo, shipment): cambio de moneda objetivo antes de editar un importe, comparación sin cambios que no genera PUT, y respuesta de alta sin id. Cualquier fallo se verá en esos módulos, no aquí.

---

## Inventario

| Prefijo-nn | Formulario | Fichero | Nº casos |
|---|---|---|---|
| OTR-01 | Consolidata: cola (filtros) | `M/consolidata/pages/ConsolidataQueuePage.vue` | 4 |
| OTR-02 | Consolidata: cotizador | `M/consolidata/pages/ConsolidataQuotePage.vue` | 7 |
| OTR-03 | Consolidata: responder cotización | `M/consolidata/components/ConsolidataAnswerDialog.vue` | 7 |
| OTR-04 | Consolidata: precio manual de tramo | `M/consolidata/components/ConsolidataPriceDialog.vue` | 6 |
| OTR-05 | Consolidata: editar tramo | `M/consolidata/components/ConsolidataLegEditDialog.vue` | 4 |
| OTR-06 | Consolidata: expedición del proyecto | `M/consolidata/components/ConsolidataShipmentDialog.vue` | 9 |
| OTR-07 | Consolidata: convertir a cargo | `M/consolidata/components/ConsolidataConvertDialog.vue` | 7 |
| OTR-08 | Consolidata: notas internas | `M/consolidata/components/ConsolidataNotesTab.vue` | 3 |
| OTR-09 | Consolidata: dispensar aviso | `M/consolidata/components/ConsolidataReadinessTab.vue` | 3 |
| OTR-10 | Consolidata: acciones de estado | `M/consolidata/pages/ConsolidataDetailPage.vue` | 5 |
| OTR-11 | Pickup: alta/edición | `M/pickup/components/PickupEditDialog.vue` | 8 |
| OTR-12 | Pickup: listado | `M/pickup/pages/PickupListPage.vue` | 4 |
| OTR-13 | Pickup: calendario y asignación | `M/pickup/pages/PickupCalendarPage.vue`, `components/DriverAssignDialog.vue` | 4 |
| OTR-14 | Pickup: panel de operaciones | `M/pickup/pages/OperationsPanelPage.vue` | 2 |
| OTR-15 | Pickup: rutas del autista | `M/pickup/pages/DriverRoutesPage.vue` | 3 |
| OTR-16 | Pickup: zonas de autista | `M/pickup/pages/DriverZonesPage.vue` | 5 |
| OTR-17 | Pickup: POD del autista | `M/pickup/pages/DriverPodPage.vue` | 6 |
| OTR-18 | CRM: listado | `M/crm/pages/CrmListPage.vue` | 4 |
| OTR-19 | CRM: cabecera de pratica | `M/crm/pages/CrmPraticaPage.vue`, `components/CrmHeaderLookups.vue` | 7 |
| OTR-20 | CRM: eventos | `M/crm/components/CrmEventiSection.vue` | 6 |
| OTR-21 | CRM: enviar mensaje | `M/crm/components/CrmSendMessageDialog.vue` | 8 |
| OTR-22 | CRM: selector del drawer | `M/crm/components/CrmContextDrawer.vue` | 2 |
| OTR-23 | Warehouse: pesaje | `M/warehouse/pages/WeighingPage.vue` | 9 |
| OTR-24 | Warehouse: Doctor Pack | `M/warehouse/pages/DocpackPage.vue` | 9 |
| OTR-25 | Warehouse: giro del autista | `M/warehouse/pages/DriverLoadPage.vue` | 6 |
| OTR-26 | Warehouse: firmas de entrega | `M/warehouse/pages/DeliveriesPage.vue` | 7 |
| OTR-27 | Warehouse: manifiestos | `M/warehouse/pages/ManifestsPage.vue` | 8 |
| OTR-28 | Plantillas email: listado | `M/email_templates/pages/EmailTemplatesPage.vue` | 4 |
| OTR-29 | Plantillas email: editor | `M/email_templates/components/EmailTemplateEditor.vue` | 12 |
| OTR-30 | Tickets: listado | `M/communication/pages/TicketsListPage.vue` | 3 |
| OTR-31 | Tickets: nuevo | `M/communication/components/NewTicketDialog.vue` | 4 |
| OTR-32 | Tickets: hilo | `M/communication/pages/TicketThreadPage.vue` | 6 |
| OTR-33 | Copilot: composer | `M/copilot/components/ChatComposer.vue` | 5 |
| OTR-34 | Copilot: propuesta | `M/copilot/components/ProposalCard.vue` | 8 |
| OTR-35 | Importación masiva | `M/bulk/pages/BulkImportPage.vue` | 11 |
| OTR-36 | Buscador global | `P/platform/PlatformSearch.vue` | 5 |
| OTR-37 | Selector de idioma | `P/platform/LanguageSwitcher.vue` | 4 |
| OTR-38 | Cambio de partner | `P/platform/PlatformPartnerSwitch.vue` | 7 |
| OTR-39 | Entrada/salida de sesión y menú de usuario | `bff/src/Http/AuthController.php`, `P/platform/UserMenu.vue` | 8 |
| OTR-40 | Campana de notificaciones | `P/platform/PlatformNotificationBell.vue` | 4 |
| OTR-41 | Panel de filtros y vistas de listado | `P/listing/FilterDrawer.vue`, `ActiveFilterChips.vue`, `ListingWorkViewSelector.vue` | 7 |
| OTR-42 | Compositor de email compartido | `P/email/EmailComposer.vue`, `RecipientPicker.vue` | 9 |
| OTR-43 | Marcos de formulario y editor enriquecido | `P/ui/FormModal.vue`, `HtmlRichEditor.vue` | 7 |
| OTR-44 | Buscador del Hub | `P/hub/FeatureHubSearch.vue` | 3 |
| OTR-45 | Historial de mensajes (huérfano) | `P/platform/StoricoMessaggiPanel.vue` | 2 |

Total: 45 formularios y 262 casos.
