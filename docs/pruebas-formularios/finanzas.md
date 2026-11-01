# Formularios de Facturación, cobros, proforma y COD: casos de prueba

> **Estado:** borrador · **Última modificación:** 2026-11-01 · Generado por lectura de código (no se ejecutó nada). Parte de [plan-pruebas-formularios.md](../plan-pruebas-formularios.md). Las reglas de cada ficha salen del código citado; lo marcado «no determinado» no se pudo confirmar.

## Grupo DINERO (prefijo FIN): invoicing, payments, proforma, cod_assegni

Rutas base: `web/apps/operations/src/modules/{invoicing,payments,proforma,cod_assegni}` (en adelante `M/`). Backend citado: `/var/www/dev/tmwe_api` (en adelante `API/`).

Resumen: 32 formularios (diálogos, asistente, filtros, subidas y ediciones masivas). Los de mayor riesgo son los que crean o cierran dinero o documentos fiscales: cobro y cierre masivo (FIN-01, FIN-02), conciliación bancaria (FIN-06), alta manual de factura (FIN-07), nota de crédito (FIN-10), factura pasiva manual y XML (FIN-11, FIN-12), facturación mensual por lotes (FIN-15), conciliación de transportistas (FIN-16..18), numeración (FIN-19, FIN-20), envíos al Estado (FIN-21), reglas fiscales con vigencias (FIN-22..25) y aprobación de lote COD (FIN-29). Los envíos reales (SDI, recordatorios por email, cobros contra banco) solo se prueban con `UPSTREAM_DENY_ACTIONS` activo o en sandbox.

Convenciones de permisos (resumen, verificado en el código):
- Facturación: `can.read/write/send/export/adminNumbering` de `M/invoicing/services/http.ts` (leen `window.__TMWE_INVOICING__.capabilities`; por defecto `canWrite=false`, `canSend=false`). El partner (`audience==="partner"`) se trata como solo lectura en payments y COD (`M/payments/env.ts`, `M/cod_assegni/env.ts`), pero NO en `can` de invoicing (solo `canTransmit` lo comprueba).
- Cobros: `canCollect` y `canReconcile` derivan de `canWrite` de facturación salvo bloque `__TMWE_PAYMENTS__`. Rutas: `/payments*` exige `can.read`; `/payments/reconciliation` exige `can.reconcile` (redirige a `payments`).
- COD: `canWrite` deriva de facturación; `/cod/reconciliation` exige `read`. `/cod` y `/proforma` NO tienen `beforeEnter` (router/index.ts:1030-1040).
- Configuración fiscal: `meta.puede_escribir` del servidor (`stores/fiscConfig.store.ts:25`) condiciona los botones de edición.
- Fecha "hoy": hay dos implementaciones. Local (`payments.service.ts today()`, `QrGeneratorCard today()`) y UTC (`new Date().toISOString().slice(0,10)` en ManualInvoiceDialog, GenerateInvoiceDialog, SupplierInvoiceDialog, CodReconciliationPage, InvoicePaymentsCard.statusOf). Cerca de medianoche difieren. Las pruebas de fecha deben fijar reloj y zona horaria (Europe/Rome y America/Los_Angeles).
- Moneda: casi todos los formatos de importe están fijados a `it-IT` y a "EUR" (ver riesgos de cada ficha).

---

### FIN-01 · Cobrar una cuota (total o parcial) y reabrir cobro
- **Ruta/pantalla:** `/payments` (fila, botón Cobrar) y ficha de factura `/invoicing/:id` (tarjeta de cobros)  **Componente:** `M/payments/components/CollectDialog.vue` (+ `InvoicePaymentsCard.vue`, `collectModel.ts`)  **Envía:** `POST api_payments?op=register` `{id,date,amount?,id_pagam_metodi?}`; reabrir: `POST api_payments?op=reopen` `{id}`
- **Permisos:** botón visible si `capabilities().canCollect` (PaymentListPage.vue:271, InvoicePaymentsCard prop `canCollect`). Servidor: `validate_invoice_access` (API/controller/api/pagamenti/Payment_Controller.php:118).
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| Modo | v-radio-group full/partial | Sí (por defecto full) | Se reinicia a full al abrir (CollectDialog.vue:~100) |
| Fecha | input type=date | Sí | `!!v`; por defecto hoy local. Sin `max`. Servidor: no futura, formato Y-m-d, `checkdate` (API/service/pagamenti/Payment_Service.php:188-203) |
| Importe | input number step 0.01 min 0, solo en partial | Sí en partial | `validatePartialAmount`: vacío = required; <=0 = not_positive; >= total-0.005 = exceeds (collectModel.ts). Servidor admite hasta el total y redondea a 2 decimales |
| Método | v-select clearable | No | Valor inicial = método de la cuota; `null` no se envía. Servidor: si no se envía conserva el de la cuota |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-01-01 | Cobro total feliz | Cuota 100,00 abierta, fecha hoy, sin importe | POST sin `amount`; cuota con `data_close`=fecha; toast `done`; tabla refresca; cuota sale de "A cobrar" | P0 | Auto |
| FIN-01-02 | Cobro parcial feliz | Cuota 100,00, parcial 40,00 | Se cierra la cuota con importe 40,00 y se crea cuota remanente de 60,00 con misma scadenza y método (Payment_Service.php:225-240); el aviso "remanente" muestra 60,00 | P0 | Auto |
| FIN-01-03 | Parcial igual al total | Parcial 100,00 sobre 100,00 | Botón deshabilitado y error `exceeds` (el total se cobra con el modo "Total") | P0 | Auto |
| FIN-01-04 | Parcial dentro de la tolerancia | 99,996 sobre 100,00 | Cliente: `exceeds` (>= total-0,005). Verificar que no se llega a enviar | P1 | Auto |
| FIN-01-05 | Importes límite parcial | 0; -5; 0,001; 99,99; 0,004 | 0 y -5: not_positive. 0,001 y 0,004 pasan el cliente y el servidor los redondea a 0,00: comprobar que devuelve 422 `El importe debe ser mayor que cero` y se muestra en toast | P0 | Auto |
| FIN-01-06 | Fecha futura | Fecha = mañana | El cliente la acepta (sin `max`); el servidor responde 422 PAYMENT_REGISTER_INVALID "no puede ser futura" y el toast muestra el mensaje; el diálogo sigue abierto | P0 | Auto |
| FIN-01-07 | Fecha cerca de medianoche UTC | Reloj 23:30 hora local America/Los_Angeles | `today()` local (FIN-01) vs `statusOf` UTC en la tarjeta: la cuota puede mostrarse "vencida/pendiente" distinto del listado | P1 | Manual |
| FIN-01-08 | Cuota ya cobrada en otra pestaña | Cobrar cuota cerrada entre tanto | 422 "La cuota ya esta cobrada"; toast de error; no se duplica el cobro | P0 | Auto |
| FIN-01-09 | Moneda distinta de EUR | Cuota USD desde listado (`valuta_sigla`) y desde ficha (`data.currency`) | El importe del diálogo usa la sigla (sufijo) pero el formato es `it-IT`; comprobar que el aviso de remanente y el total llevan la moneda correcta | P1 | Manual |
| FIN-01-10 | Cambiar método al cobrar | Método distinto al de la cuota | Se envía `id_pagam_metodi`; la cuota cerrada queda con el nuevo método, el remanente conserva el original (Payment_Service.php:237) | P1 | Auto |
| FIN-01-11 | Reabrir cobro | Fila cobrada, botón Reabrir, confirmar `window.confirm` | POST `op=reopen`; `data_close`=0000-00-00; vuelve a "pendiente". Cancelar el confirm no envía nada | P0 | Auto |
| FIN-01-12 | Reabrir cobro parcial | Cuota cerrada que tiene remanente | Se reabre solo la cuota cerrada; el remanente persiste como cuota aparte (suma de pendientes aumenta: no hay fusión) | P0 | Manual |
| FIN-01-13 | Perfil partner / sin `canCollect` | Capabilities partner | No se ve Cobrar ni Reabrir; POST directo devuelve 403 | P0 | Auto |

- **Riesgos / dudas:** (1) `date` sin `max` permite elegir fecha futura que el servidor rechaza (CollectDialog.vue, input type=date). (2) `v-model.number` en el importe: un campo vaciado queda `""` y `validatePartialAmount` lo trata como `not_positive` en vez de `required` (Number("")=0 no es NaN); mensaje inconsistente con la rama `required`. (3) Formato de importe fijo `it-IT` (CollectDialog.vue money()). (4) Reabrir usa `window.confirm` nativo. (5) Tolerancia cliente 0,005 frente a servidor `paid > total` estricto tras redondeo: el rango (total-0,005, total) queda bloqueado en cliente pero el servidor lo aceptaría como cobro total.

---

### FIN-02 · Cierre masivo de cuotas (todo o nada)
- **Ruta/pantalla:** `/payments` (selección en tabla, botón "Cobrar seleccionadas")  **Componente:** `M/payments/components/BulkCollectDialog.vue`  **Envía:** `POST api_bulk_payment` `{payment_ids[],date}`
- **Permisos:** `caps.canCollect` (PaymentListPage.vue:186, `show-select` línea 229, `isSelectable` solo cuotas abiertas).
- **Campos:**

| Campo | Control | Obligatorio | Reglas |
|---|---|---|---|
| Fecha | input date | Sí | `!!v`; botón deshabilitado si vacío o sin filas. Servidor: regex Y-m-d + `checkdate`; máximo 500 ids, ids únicos (API/controller/api/pagamenti/Bulk_Payment_Controller.php:16,38-48) |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-02-01 | Cierre feliz de 3 cuotas | 3 cuotas abiertas, fecha hoy | Todas cerradas; toast con recuento; selección se limpia y tabla refresca | P0 | Auto |
| FIN-02-02 | Una cuota inválida (ya cobrada/sin acceso) | Selección con 1 cuota ya cerrada en otra sesión | 422 con `validation_errors`: lista por fila `numero · rag_soc: motivo`; NINGUNA cuota se cierra | P0 | Auto |
| FIN-02-03 | Fallo a mitad (409 BULK_PAYMENT_FAILED) | Simular fallo de escritura | Mensaje `failure` en el diálogo, nada cerrado (rollback) | P0 | Manual |
| FIN-02-04 | Total mostrado con monedas mezcladas | Seleccionar cuotas EUR y USD | `totalAmount` suma importes sin distinguir moneda; comprobar que el resumen no induce a error (defecto probable) | P0 | Manual |
| FIN-02-05 | Fecha futura | Fecha mañana | Cliente la acepta; servidor decide (la rama bulk no comprueba "no futura" en el controlador: verificar en `register_bulk`) | P0 | Auto |
| FIN-02-06 | Selección entre páginas | Seleccionar en página 1 y cambiar a 2 | `selected` se filtra a ids de la página cargada (payments.store.ts:88): la selección no persiste; el contador del botón coincide | P1 | Auto |
| FIN-02-07 | Reabrir diálogo | Cerrar con errores y reabrir | `errors` y `failure` se limpian al abrir | P2 | Auto |
| FIN-02-08 | Más de 500 ids | Forzar 501 por API | 400/422 "Maximo 500 pagos por peticion" (el UI limita a 100 por página, así que solo por API) | P2 | Manual |

- **Riesgos / dudas:** `money()` y resumen fijos en `it-IT` sin moneda (BulkCollectDialog.vue). No se verificó si `register_bulk` rechaza fechas futuras (solo el servicio individual lo hace, Payment_Service.php:200).

---

### FIN-03 · Listado de cobros y pagos (filtros y vistas)
- **Ruta/pantalla:** `/payments`  **Componente:** `M/payments/pages/PaymentListPage.vue` (+ `stores/payments.store.ts`, `CustomerPicker.vue`)  **Envía:** `GET api_payments` (filtro); exporta CSV en cliente
- **Permisos:** ruta exige `paymentsCan.read()`; botón conciliación solo con `canReconcile`; exportar con `canRead`.
- **Campos:**

| Campo | Control | Obligatorio | Reglas |
|---|---|---|---|
| Vista | v-tabs credit / debit / overdue | Sí | credit: `tipo=A` y `statop=O` por defecto; debit: `tipo=P`; overdue: `tipo=A` y `statop=SC` (o 10/30) (`effectiveFilters`, payments.store.ts:17) |
| Cliente | CustomerPicker | No | `id_anagrafica` |
| Estado | v-select O/C/SC (otras vistas) o 10/30 (vencidas) | No | Se limpia al cambiar de vista (PaymentListPage.vue:392) |
| Método | v-select | No | `id_pagam_metodi` |
| Vencimiento desde/hasta, Cierre desde/hasta | 4 inputs date | No | Sin validación de orden; `buildListQuery` solo envía los que tienen valor |
| Importe | input number step 0.01 | No | `onAmountFilter` convierte a número o null (igualdad exacta en servidor: no determinado) |
| Tamaño de página | selector 10/25/50/100 | - | `per_page` limitado a 100 (`MAX_PER_PAGE`) |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-03-01 | Cambio de vista limpia filtro de estado | Estado=C en "A cobrar", pasar a "Vencidas" | `statop` se resetea; vencidas muestra `SC` | P1 | Auto |
| FIN-03-02 | Vencidas con 10/30 días | Elegir 30 | Solo cuotas con `days_overdue` >= umbral del servidor; contador y total coherentes | P1 | Auto |
| FIN-03-03 | Rango de fechas invertido | Desde 2026-03-01, hasta 2026-02-01 | No hay validación de cliente; resultado vacío sin error (o 400 del servidor: no determinado) | P2 | Auto |
| FIN-03-04 | Total de la cabecera vs filas | Filtro por cliente | `summary.total_amount` coincide con la suma de todas las páginas (no solo la visible) | P0 | Auto |
| FIN-03-05 | Exportar CSV | Filtro con >100 filas | `listAll` pagina de 100 en 100 y el CSV tiene `total` filas; separador `;`, BOM | P1 | Auto |
| FIN-03-06 | Inyección de fórmulas en CSV | Cliente con `rag_soc` que empieza por `=`, `+`, `-` o `@` | `csvCell` solo escapa `"`, `;` y saltos de línea: la celda se exporta tal cual (riesgo de CSV injection) | P0 | Manual |
| FIN-03-07 | Orden y paginación conservan filtros | Ordenar por importe y pasar a página 2 | Filtros y vista persisten; `page=1` al cambiar filtros | P2 | Auto |

- **Riesgos / dudas:** `csvCell` no neutraliza fórmulas (payments.service.ts, `csvCell`). `money()` fijo `it-IT`. Importe filtra por igualdad: no determinado si el servidor admite tolerancia.

---

### FIN-04 · Antigüedad de saldos
- **Ruta/pantalla:** `/payments/aging`  **Componente:** `M/payments/pages/AgingPage.vue`, `components/agingBands.ts`  **Envía:** `GET api_payment_aging?customer_id=`; clic en tramo navega al listado con rango
- **Permisos:** `paymentsCan.read()`.
- **Campos:** Cliente (CustomerPicker, opcional). El umbral `days_threshold` existe en el servicio pero no tiene control en la pantalla.
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-04-01 | Tramos y límites de día | Cuotas con vencimiento hace 30, 31, 60, 61, 90, 91 días | Se reparten en 0-30, 31-60, 61-90, 90+ de acuerdo con el servidor; los totales de tramos suman `total_outstanding` | P0 | Auto |
| FIN-04-02 | Clic en tramo navega con rango correcto | Clic en "31-60" | Listado con `scad_dal = hoy-60` y `scad_al = hoy-31` (agingBands.ts); tramo 0-30 sin límite superior (incluye no vencido) | P1 | Auto |
| FIN-04-03 | Coherencia vencido vs listado | Comparar `total_overdue` con vista "Vencidas" | Mismos importes | P0 | Auto |
| FIN-04-04 | Filtro por cliente | Elegir cliente, limpiar | Recarga con/sin `customer_id`; llamada anterior abortada si hay carrera (aging.store.ts) | P2 | Auto |
| FIN-04-05 | Cliente sin deuda | Cliente sin cuotas | Estado vacío sin error, importes 0,00 | P2 | Auto |

- **Riesgos / dudas:** "hoy" en `agingBands` usa fecha local; el servidor calcula tramos con su fecha: desfase de un día posible según zona. Importes fijos `it-IT` sin moneda.

---

### FIN-05 · Recordatorios de cobro (avance y envío)
- **Ruta/pantalla:** `/payments/reminders`  **Componente:** `M/payments/pages/ReminderPage.vue`, `services/reminders.service.ts`  **Envía:** `GET api_dunning?phase=` (vista previa), `GET ?op=settings`, `POST api_dunning?op=run` `{confirm:true,phase,client_ids[]}`
- **Permisos:** botón Enviar visible con `caps.canCollect`; envío habilitado solo si `settings.mode==="ACTIVO"` y hay selección (`canSendReminders`). En DRY_RUN no se envía.
- **Campos:**

| Campo | Control | Obligatorio | Reglas |
|---|---|---|---|
| Fase | v-btn-toggle all/notice/overdue (mandatory) | Sí | Recarga la vista previa y reselecciona todos los enviables |
| Cliente (checkbox por fila) | v-checkbox-btn | Al menos 1 | Deshabilitado si `!g.sendable` (acción distinta de `would_send`) |
| Seleccionar todos / ninguno | botones | - | `sendableIds(groups)` |
| Confirmación | v-dialog persistent | Sí | Aviso "irreversible" |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-05-01 | Modo DRY_RUN | `settings.mode=DRY_RUN` | Aviso amarillo; botón Enviar deshabilitado; nunca se llama a `op=run` | P0 | Auto |
| FIN-05-02 | Envío real, solo sandbox | Modo ACTIVO, 2 clientes seleccionados | Un solo POST con `client_ids` exactos y `confirm:true`; resultado con enviados/errores/bloqueados; recarga vista previa | P0 | Manual (solo sandbox, emails reales) |
| FIN-05-03 | Cliente sin destinatario o plantilla | Grupo con `no_recipient`/`no_template` | Casilla deshabilitada y etiqueta de acción; no entra en `client_ids` | P0 | Auto |
| FIN-05-04 | Compensado | Entrada con `compensated` | Muestra etiqueta; no enviable | P1 | Auto |
| FIN-05-05 | Error 5xx / sin respuesta en run | Cortar red durante POST | `runUncertain`: aviso de resultado incierto; no reintenta automáticamente | P0 | Manual |
| FIN-05-06 | Cambio de fase con selección previa | Seleccionar 1, cambiar fase | Se reemplaza la selección por todos los enviables de la nueva fase (puede ampliar el envío sin que el usuario lo note) | P0 | Auto |
| FIN-05-07 | Importes y bloqueo | Cliente con `BLOCCO` | Icono de candado, tipo "BLOCCO" con color error; total redondeado a 2 decimales por cliente | P1 | Auto |
| FIN-05-08 | Perfil sin `canCollect` | Capabilities partner | No hay botón Enviar; sí vista previa | P0 | Auto |

- **Riesgos / dudas:** `money()` añade siempre "EUR" (ReminderPage.vue:~190) aunque el total agrupe monedas. Tras un envío correcto la selección se vacía pero la vista previa se recarga y puede volver a marcar todo (`loadPreview` reselecciona): riesgo de segundo envío accidental. El diálogo de confirmación no repite los nombres de los clientes, solo el número.

---

### FIN-06 · Conciliación bancaria (subida de extracto y confirmación)
- **Ruta/pantalla:** `/payments/reconciliation`  **Componente:** `M/payments/pages/BankReconciliationPage.vue`, `stores/reconciliation.store.ts`  **Envía:** `POST api_bank_reconciliation` (multipart `statement`, `format?`, `delimiter?`) y `PUT api_bank_reconciliation` `{matches:[{pagamento_id,transaction_ref,data_close,amount?}]}`
- **Permisos:** ruta con `paymentsCan.reconcile()`; casillas, importes y botón Confirmar con `caps.canReconcile`.
- **Campos:**

| Campo | Control | Obligatorio | Reglas |
|---|---|---|---|
| Fichero | v-file-input `.sta,.mt940,.xml,.csv,.txt` | Sí | Máximo 2 MB (cliente `MAX_BYTES`; servidor `Bank_Statement_Parser::MAX_BYTES`, Bank_Reconciliation_Controller.php:67) |
| Formato | v-select auto/mt940/camt053/csv | No | Auto por defecto |
| Delimitador | texto maxlength 1, solo si formato csv | No | Por defecto `;` |
| Aceptar línea | checkbox | - | Por defecto todas aceptadas |
| Importe a aplicar | number step 0.01 min 0 | Sí por línea aceptada | `isLineValid`: >0 y <= cuota+0,005; por defecto min(|movimiento|, cuota) |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-06-01 | Extracto MT940 feliz | Fichero con 3 movimientos que casan con 3 cuotas | Tabla de coincidencias, resumen matched/unmatched; Confirmar cierra 3 cuotas con `data_close` = fecha del movimiento | P0 | Auto |
| FIN-06-02 | Pago parcial detectado | Movimiento 60 sobre cuota 100 | Importe por defecto 60, chip "parcial"; PUT con `amount=60`; se genera remanente 40 | P0 | Auto |
| FIN-06-03 | Movimiento mayor que la cuota | Movimiento 130, cuota 100 | Importe por defecto 100 (tope); exceso no se refleja en ningún sitio (revisar con negocio) | P0 | Manual |
| FIN-06-04 | Importe editado fuera de rango | 0; -1; 100,01 sobre 100 | Campo en error y Confirmar deshabilitado (`canConfirm`) | P0 | Auto |
| FIN-06-05 | Movimiento negativo (cargo) casado con cuota | `transaction.amount=-100` | `defaultAmount` usa `Math.abs`: un cargo bancario puede cerrarse como cobro (defecto probable); comprobar si el servidor lo empareja | P0 | Manual |
| FIN-06-06 | Misma cuota emparejada dos veces | Dos movimientos casan con la misma cuota | El UI no detecta duplicados por `pagamento.id`; el segundo PUT debería fallar con "cuota ya cobrada" y quedar en `result.errors` | P0 | Manual |
| FIN-06-07 | Confirmación parcial con errores | Una cuota ya cobrada | `result.errors` lista `#id: error`; las confirmadas salen de la tabla y las fallidas permanecen; alerta amarilla | P0 | Auto |
| FIN-06-08 | Fichero > 2 MB / extensión no permitida | 2,1 MB; `.pdf` | Mensaje `too_big`, Analizar deshabilitado; `.pdf` queda fuera de `accept` (aun así se puede arrastrar: servidor decide) | P1 | Auto |
| FIN-06-09 | Formato forzado erróneo | Fichero CSV con formato mt940 | 422 BANK_STATEMENT_INVALID; mensaje en `store.error` | P1 | Auto |
| FIN-06-10 | CSV con delimitador distinto | `,` frente a `;` | Con delimitador correcto parsea; con incorrecto, 422 o 0 movimientos | P1 | Auto |
| FIN-06-11 | Redondeo del importe | 33,335 escrito a mano | `Math.round(amount*100)/100` en `buildConfirmMatches`; 33,34 frente a 33,33 por coma flotante (1.005*100) | P1 | Auto |
| FIN-06-12 | Salir sin confirmar | Navegar fuera con análisis cargado | `onBeforeUnmount` resetea sin avisar (se pierde el trabajo de revisión) | P2 | Manual |

- **Riesgos / dudas:** `defaultAmount` con `Math.abs` (reconciliation.store.ts). No hay detección de duplicados de cuota ni de movimiento ya conciliado antes de confirmar. Si `l.amount` queda en (cuota-0,005, cuota) se trata como parcial (`< importo`) y tras redondear iguala la cuota: el servidor lo recibe como `amount==total` (comportamiento no determinado). Sin aviso de pérdida de cambios.

---

### FIN-07 · Alta manual de factura activa
- **Ruta/pantalla:** `/invoicing` → Nueva → Manual  **Componente:** `M/invoicing/components/invoice/ManualInvoiceDialog.vue`  **Envía:** `POST api_invoices_crud?op=create` `{id_anagrafica,data_fattura,tipo_fattura:"A",valuta_sigla:"EUR",id_numbering_engine?,lines[]}`
- **Permisos:** menú "Nueva" visible con `caps.canWrite` (InvoiceListPage.vue:~55). Servidor: `Invoice_Crud_Controller` (cliente accesible para el emisor, 403 si no, línea 120).
- **Campos:**

| Campo | Control | Obligatorio | Reglas |
|---|---|---|---|
| Cliente | v-autocomplete remoto (>=2 caracteres) | Sí | `canSave` exige `clientId`; servidor: 400 "Cliente requerido", 403 si no accesible |
| Fecha de factura | input date (etiqueta reutiliza "filters.date_from") | Servidor sí | Por defecto hoy en UTC; `canSave` no la exige; servidor "Fecha requerida" (línea 111) y orden cronológico por serie (código INVOICE_DATE_NOT_CHRONOLOGICAL) |
| Serie de numeración | v-select, solo si hay >1 serie | No | Por defecto la `is_default==="S"`; refresca vista previa del número y aviso de mezcla de series |
| Líneas: descripción, neto, % IVA, IVA, código IVA | tabla de inputs | >=1 línea con descripción y neto != 0 | `recalcLine`: IVA = round(neto*%/100, 2) al editar neto o %; el IVA se puede sobrescribir; valores por defecto % = 22 y `cod_iva` = "21" |
| Totales | alerta | - | Suma de netos e IVA; total = neto + IVA |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-07-01 | Alta feliz una línea | Cliente, 1 línea 100,00 al 22 % | IVA 22,00; total 122,00; POST con `lines[0]` `tipo_record:"M"`; navega al detalle; número asignado | P0 | Auto |
| FIN-07-02 | Código IVA por defecto incoherente | Dejar `cod_iva="21"` con % 22 | Se envía `aliquota_iva=22` y `cod_iva="21"`: comprobar con negocio/servidor que no se rechaza ni se guarda un código que no corresponde al porcentaje (defecto probable) | P0 | Manual |
| FIN-07-03 | Sobrescribir IVA y luego tocar el neto | IVA manual 10,00; luego cambiar neto | `recalcLine` pisa el IVA manual sin avisar | P0 | Auto |
| FIN-07-04 | Redondeo del IVA | Neto 0,05 al 22 %; neto 10,005 al 22 % | 0,01 y 2,20 (Math.round con coma flotante); comparar con el recálculo del servidor (`api_invoice_recalculate`) | P0 | Auto |
| FIN-07-05 | Neto negativo | Línea -50,00 | `canSave` solo exige != 0: se acepta como línea negativa dentro de una factura (puede hacerse pasar por abono); el servidor decide | P0 | Manual |
| FIN-07-06 | % IVA fuera de rango | -5; 150; vacío | Sin validación de cliente; `Number(...)||0` convierte vacío en 0. Comprobar respuesta del servidor | P0 | Auto |
| FIN-07-07 | Línea sin descripción con importe | Descripción vacía, neto 10 | `canSave` pasa si otra línea es válida; la línea se envía igualmente (filtro `descriz!=="" || neto!=0`) | P1 | Auto |
| FIN-07-08 | Varias series y aviso de mezcla | 2 series activas, elegir la no principal | Vista previa del número cambia; aparece aviso `mixing` si el periodo ya usa otra serie; guardar es posible | P1 | Auto |
| FIN-07-09 | Fecha anterior a la última factura de la serie | Fecha 30 días atrás | 422 INVOICE_DATE_NOT_CHRONOLOGICAL; toast de error con texto; el diálogo sigue abierto | P0 | Auto |
| FIN-07-10 | Fecha de hoy con zona horaria extrema | Reloj 00:30 en Europe/Rome | `today()` UTC da el día anterior: fecha de factura = ayer (defecto probable) | P0 | Manual |
| FIN-07-11 | Moneda | Cliente con moneda USD | El payload fija `valuta_sigla:"EUR"` siempre; sin selector de moneda | P0 | Manual |
| FIN-07-12 | Vista previa del número vs número final | Dos usuarios crean a la vez | El número mostrado es orientativo; el definitivo se fija al guardar | P1 | Manual |
| FIN-07-13 | Perfil solo lectura | `canWrite=false` | Menú "Nueva" oculto; POST directo → 403 "No tiene permisos para facturacion" | P0 | Auto |

- **Riesgos / dudas:** (1) `aliquota_iva` 22 con `cod_iva` "21" por defecto (ManualInvoiceDialog.vue, `emptyLine`). (2) `today()` en UTC para una fecha fiscal. (3) Moneda fija EUR y formato `it-IT`. (4) Sin límites de % ni de importes, sin comprobar que `importo_iva` sea coherente con el % (se deja libre). (5) Cuerpo de error en toast como `String(e)` (puede mostrar "Error: ...").

---

### FIN-08 · Generar factura(s) para un cliente (por rango de fechas)
- **Ruta/pantalla:** `/invoicing` → Nueva → Generar; también desde ficha de expedición con `?new=1&client=&shipment=`  **Componente:** `M/invoicing/components/invoice/GenerateInvoiceDialog.vue`  **Envía:** `GET` facturables (`invoiceService.billableShipments`) y `POST` generación por lotes (`invoiceService.generateBatch`) `{id_anagrafica:[id],data_fattura:hoy(UTC),dal,al,shipment_refs?|id_spediz?}`
- **Permisos:** `caps.canWrite`.
- **Campos:**

| Campo | Control | Obligatorio | Reglas |
|---|---|---|---|
| Cliente | autocomplete remoto | Sí | Botón exige `clientId` y `billableCount>0` |
| Atajos de rango | botones mes anterior / mes actual | - | `monthRange` en hora local |
| Desde / Hasta | date | Sí en la práctica | Valor por defecto = mes anterior calculado al montar el componente (no al abrir) |
| Preview | alerta | - | Cuenta y total de facturables; diagnósticos por código |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-08-01 | Generación feliz mes anterior | Cliente con envíos cerrados | Preview con N y total; Generar crea factura y navega a la primera | P0 | Auto |
| FIN-08-02 | Nada facturable | Cliente sin envíos | Alerta amarilla; botón deshabilitado | P1 | Auto |
| FIN-08-03 | Preview con error de red | Cortar red | Alerta roja con Reintentar (no es "nada facturable") | P1 | Auto |
| FIN-08-04 | Desde > Hasta | Dal=2026-03-31, al=2026-03-01 | Sin validación de cliente; la respuesta del servidor decide | P1 | Auto |
| FIN-08-05 | Prefill desde expedición | `prefillShipment` + tipo cargo | Solo se factura esa expedición; `shipment_refs` con tipo+id (ids de cargo y express no son comparables) | P0 | Auto |
| FIN-08-06 | Resultado parcial | 2 facturas generadas, 1 error | Toast warning con nº de errores y toast success con recuento | P0 | Manual |
| FIN-08-07 | Rango por defecto obsoleto | Página abierta durante un cambio de mes | `defaultDal/Al` se fijan al montar; no se recalculan | P2 | Manual |
| FIN-08-08 | Fecha de factura = hoy UTC | Medianoche local | `data_fattura` puede ser el día anterior | P0 | Manual |
| FIN-08-09 | Cambiar de cliente tras preview | Elegir A, luego B | Preview se reinicia y recarga; no se factura A | P1 | Auto |

- **Riesgos / dudas:** total de preview tomado de `items[0].total` (primer cliente devuelto) y recuento `shipment_count ?? items.length`: si el endpoint devolviera varios clientes se infraestimaría. Total mostrado con "EUR" fijo.

---

### FIN-09 · Seleccionar expediciones facturables y facturar
- **Ruta/pantalla:** `/invoicing` → Nueva → Seleccionar envíos  **Componente:** `M/invoicing/components/invoice/BillableShipmentsDialog.vue`  **Envía:** `GET billableShipments` y `POST generateBatch` `{id_anagrafica,shipment_ids[],dal,al,...}`
- **Permisos:** `caps.canWrite`.
- **Campos:** Cliente (autocomplete), Desde/Hasta (date, por defecto mes anterior), tabla con casillas (todas marcadas al cargar), total seleccionado.
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-09-01 | Facturar solo algunos envíos | Desmarcar 2 de 5 | `shipment_ids` solo con los 3 marcados; total = suma de seleccionados | P0 | Auto |
| FIN-09-02 | Ninguno seleccionado | Desmarcar todos | Botón deshabilitado | P1 | Auto |
| FIN-09-03 | Mezcla express y cargo | Selección con ids de ambas tablas | Se envían ids sin tipo (a diferencia de FIN-08 que usa `shipment_refs`): comprobar que el servidor no confunde ids homónimos (defecto probable) | P0 | Manual |
| FIN-09-04 | Cambio de rango recarga y reselecciona | Cambiar fechas | Lista nueva; todas marcadas; se reinicia la selección anterior | P1 | Auto |
| FIN-09-05 | Suma de decimales | Importes 0,10 + 0,20 | Total 0,30 sin ruido de coma flotante en pantalla | P1 | Auto |

- **Riesgos / dudas:** ids sin tipo (BillableShipmentsDialog.vue:278) frente al soporte de `shipment_refs` en el otro diálogo.

---

### FIN-10 · Nota de crédito (total o parcial) y remediación de factura rechazada
- **Ruta/pantalla:** `/invoicing/:id` (botones "Nota de crédito" y "Remediar")  **Componente:** `M/invoicing/components/invoice/CreditNoteDialog.vue`, `services/creditNote.logic.ts`  **Envía:** `POST api_credit_notes?op=create` `{original_invoice_id,items[],motivo,note?}`; remediar: mismo endpoint `{original_invoice_id,remediate:1,motivo:"errore"}`; consulta `api_credit_notes?remaining_for=`
- **Permisos:** `caps.canWrite` (detalle líneas 80 y 92); "Remediar" solo si `stato_sdi==='K'`.
- **Campos:**

| Campo | Control | Obligatorio | Reglas |
|---|---|---|---|
| Modo | v-btn-toggle full/partial | Sí | Parcial deshabilitado si no hay líneas acreditables (tipo C/M con neto > 0) |
| Líneas (parcial) | casilla + neto a acreditar | >=1 | `capNet` acota a [0, neto original]; IVA = round2(neto*%/100) por línea; `creditErrors`: none_selected, net_zero, net_over |
| Motivo | v-select (restituzione, bonifica, errore, sconto, altro) | Sí | `canSubmit` lo exige |
| Nota | textarea | No | Se recorta; se omite si vacía |
| Pendiente de acreditar | texto + avisos | - | `remainingIssues`: fully_credited; en parcial net_over / vat_over con tolerancia 0,01 |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-10-01 | Abono total feliz | Factura sin abonos, motivo errore | `items:[]` (el servidor copia líneas); crea TD04; toast; evento `created` | P0 | Auto (sandbox, no transmitir) |
| FIN-10-02 | Abono parcial feliz | 1 línea de 100 al 22 %, acreditar 40 | Totales neto 40,00, IVA 8,80, bruto 48,80; items con `importo_iva` y `cod_iva` | P0 | Auto |
| FIN-10-03 | Neto superior al de la línea | Escribir 150 sobre 100 | `capNet` lo reduce a 100 | P0 | Auto |
| FIN-10-04 | Redondeo por línea | 3 líneas de 0,05 al 22 % | Suma de IVA por línea (3 x 0,01 = 0,03) frente al IVA global del servidor (0,03 o 0,04); comprobar vat_over con tolerancia 0,01 | P0 | Auto |
| FIN-10-05 | Ya totalmente acreditada | `remaining_netto <= 0,005` | Aviso `fully_credited`; Guardar deshabilitado | P0 | Auto |
| FIN-10-06 | Segundo abono parcial por encima de lo pendiente | Pendiente 60, acreditar 70 | Aviso `net_over`; botón deshabilitado; si se fuerza por API, 422 | P0 | Auto |
| FIN-10-07 | Línea sin tipo de IVA | `aliquota` null | IVA de la línea 0 en pantalla y se envía sin `importo_iva`; el servidor lo calcula: el total mostrado puede diferir | P0 | Manual |
| FIN-10-08 | Falta el motivo | Dejar vacío | Botón deshabilitado, error `required` | P0 | Auto |
| FIN-10-09 | Línea que ya fue acreditada parcialmente | Línea de 100 con 70 abonados | `maxNet` es el neto ORIGINAL (no el restante de esa línea): el límite por línea no se ajusta, solo el global | P0 | Manual |
| FIN-10-10 | Remediar factura rechazada por SDI | `stato_sdi='K'`, confirmar `window.confirm` | Se emite TD04 que anula y reasigna envíos; cancelar el confirm no envía | P0 | Manual (solo sandbox) |
| FIN-10-11 | Doble clic en Guardar | Dos clics rápidos | Solo un abono creado (`saving` deshabilita) | P0 | Auto |

- **Riesgos / dudas:** El guardado de una nota de crédito (acto fiscal) no pide confirmación explícita (solo color rojo del botón; CreditNoteDialog.vue). El límite por línea no descuenta abonos previos de esa línea. Importes mostrados con `toFixed(2)` sin separador de miles ni moneda.

---

### FIN-11 · Factura pasiva manual (proveedor)
- **Ruta/pantalla:** `/invoicing` → Nueva → Factura de proveedor → pestaña Manual  **Componente:** `M/invoicing/components/invoice/SupplierInvoiceDialog.vue`  **Envía:** `POST api_supplier_invoices` (`invoiceService.createSupplier`) `{id_anagrafica,data_fattura,numero_alfanum,importo_netto,importo_iva,valuta_sigla:"EUR",quotes[]}`
- **Permisos:** `caps.canWrite`.
- **Campos:**

| Campo | Control | Obligatorio | Reglas |
|---|---|---|---|
| Proveedor | autocomplete remoto | Sí | `canSave` |
| N.º externo | texto | No en cliente | Servidor: si se informa, duplicado por proveedor+año devuelve 409 SUPPLIER_INVOICE_DUPLICATE (Supplier_Invoice_Service.php:130-147) |
| Fecha | date (hoy UTC) | Servidor sí | Servidor "Fecha de factura requerida" |
| Neto | number | Sí (>0) | `canSave`: `Number(neto) > 0` |
| IVA | number | No | Sin validación de signo |
| Cuotas de coste: año, neto, cuenta contable | tabla | No | Aviso (no bloqueo) si suma != neto (tolerancia 0,01); servidor `assert_quotes_match` bloquea con 422 QUOTES_MISMATCH |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-11-01 | Alta con cuotas que cuadran | Neto 100, cuotas 60+40 | Crea factura P; cuotas guardadas | P0 | Auto |
| FIN-11-02 | Alta sin tocar las cuotas | Neto 100 y la fila de cuota por defecto intacta | La fila por defecto tiene `anno`=año actual, neto 0, cuenta 0: `Number(q.anno)!==0` la mantiene en el payload y el servidor (que solo ignora cuotas con anno=0, neto=0 y cuenta=0) calcula suma 0 != 100 y devuelve 422 QUOTES_MISMATCH. Es el flujo más simple y falla (defecto probable) | P0 | Auto |
| FIN-11-03 | Cuotas que no cuadran | Neto 100, cuotas 60 | Alerta amarilla "no cuadra" pero Guardar activo; el servidor rechaza con 422 y el toast muestra el mensaje | P0 | Auto |
| FIN-11-04 | Duplicado | Mismo proveedor, mismo n.º externo y año | 409 SUPPLIER_INVOICE_DUPLICATE con `existing_id` en el toast | P0 | Auto |
| FIN-11-05 | Neto 0 o negativo (abono del proveedor) | -50 | Botón deshabilitado; un abono de proveedor no se puede registrar manualmente | P1 | Auto |
| FIN-11-06 | IVA negativo o mayor que el neto | -10; 500 | Sin validación en cliente; servidor decide | P1 | Manual |
| FIN-11-07 | Cuota con año 0 | `anno=0`, neto y cuenta informados | Se envía; servidor decide la validez | P2 | Manual |
| FIN-11-08 | Moneda extranjera | Proveedor en USD | `valuta_sigla` fija EUR; importes mostrados en EUR | P0 | Manual |
| FIN-11-09 | Fecha UTC | Reloj 00:30 Europe/Rome | Fecha de factura = día anterior | P1 | Manual |

- **Riesgos / dudas:** FIN-11-02 es el hallazgo principal (SupplierInvoiceDialog.vue `emptyQuote()` y filtro de `save()`; contraste con `assert_quotes_match`). Moneda fija EUR. El alta de pasiva tras éxito emite `created` pero, a diferencia del XML, no navega al detalle.

---

### FIN-12 · Importar factura de proveedor desde XML FatturaPA
- **Ruta/pantalla:** `/invoicing` → Factura de proveedor → pestaña XML  **Componente:** `M/invoicing/components/invoice/SupplierXmlImport.vue`, `services/supplierInvoice.service.ts`  **Envía:** vista previa `POST api_supplier_invoices` (op import preview, multipart `xml`) y confirmar importación (`supplierInvoiceApi.importXml`) con `id_anagrafica`
- **Permisos:** `caps.canWrite`.
- **Campos:**

| Campo | Control | Obligatorio | Reglas |
|---|---|---|---|
| Fichero | v-file-input `.xml,.p7m` | Sí | `validateXmlFile`: missing, bad_type, too_big (servidor: máx. 5 MB, Supplier_Invoice_Controller.php:116) |
| Proveedor | v-select si hay >1 candidato | Sí | `canConfirmImport(preview, supplierId)` |
| Revisión | avisos bloqueantes / duplicado / avisos | - | `preview.blocking` y `duplicate_id` impiden confirmar (según `canConfirmImport`) |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-12-01 | Importación feliz | XML válido de un proveedor conocido | Vista previa con neto, IVA, total y plan de vencimientos; Confirmar crea factura, N cuotas de pago (`payments_created`); navega al detalle | P0 | Auto |
| FIN-12-02 | Duplicado | XML ya importado | Alerta roja con enlace "abrir existente"; Confirmar deshabilitado; si se fuerza, 409 mapeado a mensaje `duplicate` | P0 | Auto |
| FIN-12-03 | Nota de crédito del proveedor (TD04) | XML con `is_credit_note` | Chip "nota de crédito"; confirmar crea documento con signo correcto (comprobar en BD/detalle) | P0 | Manual |
| FIN-12-04 | Varios proveedores candidatos | Dos fichas con mismo CF | Selector obligatorio; `defaultSupplier` preselecciona según reglas | P1 | Auto |
| FIN-12-05 | Sin proveedor en la ficha | 0 candidatos | Aviso con enlace a anagráficas; Confirmar deshabilitado | P0 | Auto |
| FIN-12-06 | XML corrupto / no FatturaPA | Fichero aleatorio | 422 SUPPLIER_XML_INVALID, mensaje visible; no se queda estado a medias | P1 | Auto |
| FIN-12-07 | Divisa distinta de EUR | XML con divisa USD | Importes con sufijo de `preview.divisa`; el plan de pagos refleja la divisa | P1 | Manual |
| FIN-12-08 | Plan de pagos del XML vs por defecto | XML con y sin `DatiPagamento` | Etiqueta "plan_xml" o "plan_default"; suma de cuotas = total | P0 | Auto |
| FIN-12-09 | Fichero .p7m firmado | Fichero firmado | Se acepta la extensión; el servidor decide si lo descodifica | P1 | Manual |
| FIN-12-10 | Doble clic en Confirmar | 2 clics | Una sola factura (`busy` y comprobación `busy.value`) | P0 | Auto |

- **Riesgos / dudas:** el tamaño máximo cliente (`validateXmlFile`) no se contrastó con los 5 MB del servidor. Formato de importes con `divisa` pero locale `it-IT`.

---

### FIN-13 · Exportaciones (recapitulativa intra-UE y listado anual)
- **Ruta/pantalla:** `/invoicing` → menú Exportaciones  **Componente:** `M/invoicing/components/invoice/ExportDialog.vue`, `services/invoiceExport.service.ts`  **Envía:** `GET api_intra_eu_recap_export?desde&hasta&pais` / `POST api_balance_sheet_export` `{type,year,format}`
- **Permisos:** no se detectó comprobación de `can.export` en el menú (InvoiceListPage.vue:36-50); `canExport` es true por defecto.
- **Campos:** Año (number), Trimestre (Q1-Q4, clearable), Desde/Hasta (date), País (maxlength 2); Tipo (activa/pasiva), Año, Formato (xlsx/csv).
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-13-01 | Trimestre rellena fechas | Año 2026, Q2 | Desde 2026-04-01, Hasta 2026-06-30; cambiar fechas a mano limpia el trimestre | P1 | Auto |
| FIN-13-02 | Año bisiesto en Q1 | 2028 Q1 | Hasta 2028-03-31 (cálculo UTC correcto) | P2 | Auto |
| FIN-13-03 | Rango invertido | Desde > Hasta | `valid` solo exige ambos rellenos; el servidor decide | P1 | Auto |
| FIN-13-04 | País en minúsculas | "de" | Se envía en mayúsculas `DE`; con más de 2 letras no se puede escribir | P2 | Auto |
| FIN-13-05 | Exportación vacía | Rango sin datos | Mensaje `exports.empty` (EMPTY_EXPORT), no descarga | P1 | Auto |
| FIN-13-06 | Año fuera de rango en listado anual | 1999 y 2100 | Botón deshabilitado (válido 2000-2099) | P2 | Auto |
| FIN-13-07 | Cifras del listado frente a la lista | Año completo activa | El total del fichero coincide con la suma de facturas del año (control contable) | P0 | Manual |

- **Riesgos / dudas:** sin control de `canExport` en la UI; con año cambiado manualmente y trimestre elegido, `applyQuarter` se dispara en `@update:model-value` aunque `year` esté vacío (retorna sin hacer nada).

---

### FIN-14 · Filtros del listado de facturas, búsqueda de pasivas y cambio de estado de control
- **Ruta/pantalla:** `/invoicing` (panel lateral de filtros, pestañas Emitidas/Recibidas)  **Componente:** `M/invoicing/components/invoice/InvoiceFilterPanel.vue` y `pages/InvoiceListPage.vue`  **Envía:** `GET api_invoices_crud` / `api_supplier_invoices`; cambio de control: `PUT api_supplier_invoices` `{id,controllo_stato}`
- **Permisos:** el chip de control es un menú si hay escritura; si no, solo lectura (InvoiceListPage.vue:~270).
- **Campos:** Fecha desde/hasta, N.º, Estado SDI, Estado de pago (paid/pending/overdue; `sanitizePaymentFilter` evita el 400), Búsqueda de proveedor (Enter o limpiar), Estado de control N/S/R.
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-14-01 | Filtro de pago válido | Estado=overdue | Solo facturas con cuotas vencidas | P1 | Auto |
| FIN-14-02 | Valor de pago inválido por URL | `?stato_pagamento=foo` | `sanitizePaymentFilter` lo descarta; no hay 400 | P2 | Auto |
| FIN-14-03 | Clic en celda aplica filtro | Clic en número/estado SDI/cliente | Se aplica el filtro y aparece en chips | P2 | Auto |
| FIN-14-04 | Cambio de estado de control | Chip N -> S -> R | PUT con el nuevo estado; fila se actualiza; error muestra toast sin cambiar la fila | P1 | Auto |
| FIN-14-05 | Búsqueda de proveedor con espacios | "  acme  " | Se recorta; vacío = sin filtro | P2 | Auto |

- **Riesgos / dudas:** el cambio de control no pide confirmación ni deja motivo; el cálculo de "pagada/vencida" de la lista y de la tarjeta (FIN-01) usa fechas con criterios distintos.

---

### FIN-15 · Facturación mensual (vista previa por cliente y emisión por lotes)
- **Ruta/pantalla:** `/invoicing/monthly`  **Componente:** `M/invoicing/pages/MonthlyBillingPage.vue`, `services/monthlyBilling.service.ts`, `services/monthlyBatching.logic.ts`  **Envía:** `GET` vista previa (dal, al, minimo, id_cliente, flags) y `POST` emisión por lotes de 25 clientes `{client_ids,dal,al,data_fattura,solo_chiusi,no_giaccrm,no_cargo,no_express,minimo?}`
- **Permisos:** ruta con `invoicingCan.write()` (si no, redirige a `invoicing-list`); `canEmit` exige `caps.canWrite`.
- **Campos:**

| Campo | Control | Obligatorio | Reglas |
|---|---|---|---|
| Desde / Hasta | date | Sí | `rangeOk`: dal <= al; por defecto mes natural anterior |
| Cliente | autocomplete | No | `id_cliente` |
| Mínimo | number | No | Solo se envía si > 0 |
| Solo cerrados / sin giacenza CRM / sin cargo / sin express | 4 switches | No | Se envían como `1` en preview y como booleanos en emisión |
| Fecha de factura | date | Sí | Por defecto = Hasta (hasta que el usuario la toca); `validateInvoiceDate`: required, invalid_range, before_dal |
| Clientes a facturar | casillas | >=1 | Solo `isBillable` (validación sin errores y total > 0) |
| Confirmación | diálogo persistent | Sí | Detiene/Continúa; botón Parar entre lotes |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-15-01 | Emisión feliz de 30 clientes | Selección de 30 | Se parte en 2 lotes (25+5); barra de progreso; filas de resultado generadas; avisos fusionados sin duplicados | P0 | Auto (sandbox) |
| FIN-15-02 | Fecha anterior al inicio del periodo | Fecha factura < Desde | Mensaje `date_before_dal`; emitir deshabilitado | P0 | Auto |
| FIN-15-03 | Fecha no cronológica (422) | Fecha anterior a la última emitida de la serie | Se rechaza el lote; `INVOICE_DATE_NOT_CHRONOLOGICAL` se muestra junto al campo; si falla en el lote 2, el lote 1 ya está emitido y la UI lo refleja (`rejected`, `anySent`) | P0 | Auto |
| FIN-15-04 | Fallo 5xx a mitad | Cortar red en el lote 2 | `uncertain`: aviso de que puede haberse emitido algo; los lotes restantes quedan "no enviados" | P0 | Manual |
| FIN-15-05 | Parar entre lotes | Pulsar Parar durante la emisión | Termina el lote en curso, `stop:"user"`, resto sin enviar | P0 | Auto |
| FIN-15-06 | Cliente con validación errónea | `validation.valid=false` | Casilla deshabilitada con motivos; no entra en la selección | P0 | Auto |
| FIN-15-07 | Mínimo | 50 | Solo clientes con total >= mínimo (servidor); total seleccionado redondea a 2 decimales | P1 | Auto |
| FIN-15-08 | Fecha futura | Fecha de factura > hoy | Sin límite superior en cliente; servidor decide | P0 | Manual |
| FIN-15-09 | Perfil sin escritura | `canWrite=false` | Navegar directo a la ruta redirige al listado | P0 | Auto |
| FIN-15-10 | Doble emisión | Doble clic en Emitir/Confirmar | Una sola ejecución (`emitting`, diálogo persistent) | P0 | Auto |
| FIN-15-11 | Cambiar parámetros tras la vista previa | Cambiar Hasta | La selección/preview previa no debe emitirse con parámetros distintos (`locked`): verificar | P0 | Manual |

- **Riesgos / dudas:** sin tope superior para la fecha de factura. La fecha por defecto = fin del periodo puede quedar en el futuro si se factura un periodo en curso. Importes con "EUR" fijo.

---

### FIN-16 · Conciliación de costes de transportistas: importar fichero de factura
- **Ruta/pantalla:** `/invoicing/carrier-reconciliation`  **Componente:** `M/invoicing/pages/CarrierReconciliationPage.vue`, `services/carrierRecon.service.ts`  **Envía:** `POST api_carrier_reconciliation?op=import` multipart `{op,invoice_id,file,carrier?,dry_run?}`
- **Permisos:** ruta con `invoicingCan.read()`; "Importar" real solo con `caps.canWrite`; "Simular" (`dry_run=1`) disponible siempre.
- **Campos:**

| Campo | Control | Obligatorio | Reglas |
|---|---|---|---|
| Factura del transportista | autocomplete remoto (pasivas) | Sí | `canRun` |
| Transportista | v-select BRT/DHL/TNT/UPS/PPW | No | Vacío = autodetección (servidor) |
| Fichero | v-file-input `.csv/.txt/.tsv` | Sí | `validateCarrierFile`: bad_type, too_big (> 20 MB) |
| Simular / Importar | dos botones | - | `dry_run` no persiste (Carrier_Reconciliation_Controller.php:235-259) |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-16-01 | Simulación | CSV con 10 envíos | `dry_run=true`; tabla por fila (associated, not_found, other_invoice, duplicate, format_error); nada persiste (re-simular da el mismo resultado) | P0 | Auto |
| FIN-16-02 | Importación real | Mismo CSV, factura pasiva de prueba | Se asocian envíos, se guarda `costo_reale`; el contador `associated` coincide con la simulación | P0 | Auto (sandbox) |
| FIN-16-03 | Sobrecoste | Coste real > previsto + tolerancia | Fila con `overrun` marcada para atención; listado de discrepancias la recoge | P0 | Auto |
| FIN-16-04 | Fila de otra factura | AWB ya vinculado a otra factura | `other_invoice`: no se reasigna; contado en "otros" | P0 | Auto |
| FIN-16-05 | Fichero duplicado | Importar dos veces | Segunda vez: `already_linked`/`duplicate`; sin doble coste | P0 | Auto |
| FIN-16-06 | Extensión o tamaño inválidos | `.xlsx`; 21 MB | Error de validación sin llamada al servidor | P1 | Auto |
| FIN-16-07 | Autodetección del transportista | Sin elegir transportista | El servidor detecta; si falla, 422 con mensaje | P1 | Manual |
| FIN-16-08 | Cambiar de factura con resultados cargados | Elegir otra | `onPick` limpia resultado, envíos, comprobaciones | P1 | Auto |
| FIN-16-09 | Importes con coma decimal | CSV con "12,50" y con "12.50" | Ambos se interpretan igual o se marcan `format_error` (comprobar por transportista) | P0 | Manual |

- **Riesgos / dudas:** Importar real sin diálogo de confirmación (solo se diferencia de Simular por botón). `money()` fija EUR aunque la factura sea en otra divisa.

---

### FIN-17 · Alta rápida de factura de transportista (desde conciliación)
- **Ruta/pantalla:** `/invoicing/carrier-reconciliation` → "Nueva factura" (diálogo)  **Componente:** `CarrierReconciliationPage.vue` (diálogo `newOpen`), `validateNewSupplierInvoice` en `supplierInvoice.service.ts`  **Envía:** `POST api_supplier_invoices` (`createSupplier`)
- **Permisos:** `caps.canWrite`.
- **Campos:**

| Campo | Control | Obligatorio | Reglas (`validateNewSupplierInvoice`) |
|---|---|---|---|
| Proveedor | autocomplete | Sí | `id_anagrafica > 0` |
| N.º | texto | Sí | no vacío tras trim |
| Fecha | date | Sí | regex `YYYY-MM-DD` |
| Neto | number | Sí | finito y > 0 |
| IVA | number | No | finito y >= 0 |
| Moneda | texto maxlength 3 | Sí | `^[A-Z]{3}$` (por defecto EUR) |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-17-01 | Alta feliz y selección automática | Datos válidos | Se crea la factura pasiva y queda seleccionada en el selector | P0 | Auto |
| FIN-17-02 | Moneda en minúsculas | "eur" | Falla la validación `currency` salvo que el campo fuerce mayúsculas (comprobar) | P1 | Auto |
| FIN-17-03 | Neto 0 / negativo / IVA negativo | 0; -1; -5 | Error `amount` | P0 | Auto |
| FIN-17-04 | Duplicado | Mismo proveedor y número en el año | 409 SUPPLIER_INVOICE_DUPLICATE | P0 | Auto |
| FIN-17-05 | Sin cuotas de coste | Alta sin `quotes` | A diferencia de FIN-11, el payload no incluye `quotes`; comprobar que el alta pasa | P1 | Auto |

- **Riesgos / dudas:** no determinado si el campo moneda convierte a mayúsculas.

---

### FIN-18 · Aceptar o repercutir diferencias de coste, y vincular expediciones a la factura
- **Ruta/pantalla:** `/invoicing/carrier-reconciliation` (tabla de envíos de la factura)  **Componente:** `CarrierReconciliationPage.vue` (diálogos `acceptOpen`, `flagOpen`, `linkOpen`)  **Envía:** `POST api_carrier_reconciliation` `{op:"accept",invoice_id,shipment_id,reason}` / `{op:"flag",invoice_id,shipment_id}` / vincular (`link`) con ids
- **Permisos:** botones con `caps.canWrite` y solo en filas `reconciliation_status==='discrepancy'` (línea 350).
- **Campos:** Motivo (texto, obligatorio para aceptar), confirmación para repercutir, tipo express/cargo + lista de ids de expediciones (texto separado por espacios, comas, punto y coma o saltos de línea; `parseShipmentIds` descarta no numéricos y repetidos).
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-18-01 | Aceptar con motivo | Diferencia 3,50, motivo "acuerdo" | `op=accept`; la fila pasa a conciliada; `delta` desaparece de discrepancias | P0 | Auto |
| FIN-18-02 | Aceptar sin motivo | Motivo en blanco/espacios | Botón deshabilitado (`!reason.trim()`) | P0 | Auto |
| FIN-18-03 | Repercutir al cliente | Clic en repercutir y confirmar | `op=flag`; queda "pendiente de recargo" (`pending_recharge_count` sube) | P0 | Auto |
| FIN-18-04 | Parser de ids | "101, 102;103\n104 abc 101 0" | [101,102,103,104]; sin 0 ni repetidos | P1 | Auto |
| FIN-18-05 | Vincular expediciones ya vinculadas a otra factura | Ids ocupados | Resultado por expedición con motivo; nada se sobrescribe | P0 | Manual |
| FIN-18-06 | Perfil sin escritura | `canWrite=false` | Sin botones de acción | P0 | Auto |
| FIN-18-07 | Tolerancia | Delta 0,00 / 0,01 frente a `tolerance` | Filas dentro de tolerancia no aparecen como discrepancia | P1 | Auto |

- **Riesgos / dudas:** `deltaOf` redondea la diferencia en cliente; la conciliación definitiva la calcula el servidor con su tolerancia (`summary.tolerance`). Repercutir no pide el importe: se repercute la diferencia calculada por el servidor.

---

### FIN-19 · Motor de numeración (alta y edición de series)
- **Ruta/pantalla:** `/invoicing/numbering`  **Componente:** `M/invoicing/components/numbering/NumberingEngineDialog.vue`, `pages/NumberingSettingsPage.vue`, `stores/numbering.store.ts`  **Envía:** `POST/PUT api_invoice_numbering_engines` (alta, edición); borrado con confirmación
- **Permisos:** `can.adminNumbering()` (cae a `canWrite` si el wrapper no inyecta la capability, http.ts); sin permiso: columna de acciones oculta y aviso.
- **Campos:**

| Campo | Control | Obligatorio | Reglas |
|---|---|---|---|
| Código | texto maxlength 30 | Sí al crear | Inmutable al editar |
| Etiqueta | texto maxlength 100 | Sí | no vacía |
| Tipo de factura | v-select | Sí | por defecto en `DEFAULTS` |
| Reinicio | v-select anual/mensual/nunca | Sí | |
| Formato | texto maxlength 100 | Sí | debe contener `{n}` (`formatoIsValid`); aviso si cambia en edición |
| Relleno (padding) | number 0-20 | Sí | `canSave` 0..20 |
| Valor inicial | number min 0 | No | `Number(x)||1`: el 0 se convierte en 1 |
| Por defecto | switch | No | Envía `is_default` S/N |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-19-01 | Alta feliz | Código FATT, formato `{n}/{yyyy}`, padding 5 | Muestra ejemplo; serie creada; aparece en el listado | P0 | Auto |
| FIN-19-02 | Formato sin `{n}` | `ABC` | Error `missing_token`; Guardar deshabilitado | P0 | Auto |
| FIN-19-03 | Cambiar el formato de una serie con facturas | Editar formato | Aviso fiscal `format_changed` (no bloquea) | P0 | Manual |
| FIN-19-04 | Valor inicial 0 | 0 | Se envía 1 (`||1`) pese a `min=0` | P1 | Auto |
| FIN-19-05 | Padding límites | -1; 20; 21 | -1 y 21 deshabilitan; 20 válido | P1 | Auto |
| FIN-19-06 | Marcar como por defecto | Segunda serie por defecto | El servidor desmarca la anterior (comprobar un único default por tipo) | P0 | Auto |
| FIN-19-07 | Borrar serie | Serie con facturas | Diálogo de confirmación con nota; el servidor puede rechazar si hay uso | P0 | Manual |
| FIN-19-08 | Código duplicado | Mismo código | Error del servidor visible; el diálogo no se cierra | P1 | Auto |

- **Riesgos / dudas:** `valore_inicial` con `||1` ignora 0. El diálogo emite `saved` y cierra la lógica en el padre: si el servidor falla, comprobar que el diálogo no se cierra (la responsabilidad del error está en el store).

---

### FIN-20 · Rangos de numeración (alta, cierre y vista del siguiente número)
- **Ruta/pantalla:** `/invoicing/numbering` (sección Rangos de validez)  **Componente:** `M/invoicing/components/numbering/NumberingRangesPanel.vue`, `services/numberingRanges.service.ts`  **Envía:** `POST api_invoice_numbering_ranges?op=create` `{id_engine,formato,data_inizio,data_fine?,reinicio?,valore_iniziale?,motivo,confirmar}`; `op=close` `{id_engine,id,data_fine,motivo}`; consulta del siguiente número
- **Permisos:** `canAdmin` del padre.
- **Campos:**

| Campo | Control | Obligatorio | Reglas |
|---|---|---|---|
| Serie | v-select | Sí | `id_engine > 0` |
| Formato | texto | Sí | contiene `{n` (el diálogo de series exige `{n}`) |
| Válido desde | date | Sí | |
| Válido hasta | date | No | Vacío = rango abierto; sin comprobación de que sea >= desde |
| Reinicio | v-select | No | |
| Desde el número | number min 1 | No | solo se envía si > 0 |
| Motivo | texto | Sí | `trim` |
| Cierre: fecha fin + motivo | date + texto | Sí ambos | |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-20-01 | Alta en dos pasos (borrador y confirmar) | Rango nuevo | Primer envío `confirmar:false` devuelve vista previa (`guardado:false`); segundo `confirmar:true` guarda | P0 | Auto |
| FIN-20-02 | Solapamiento con rango existente | Fechas que pisan otro rango | Error del servidor en `formError`; no se guarda | P0 | Auto |
| FIN-20-03 | Fin anterior al inicio | Desde 2026-06-01, hasta 2026-05-01 | Sin validación de cliente; servidor decide | P0 | Auto |
| FIN-20-04 | Cerrar rango abierto | Fecha fin + motivo | `op=close`; el rango ya no es abierto; botón cierre desaparece | P0 | Auto |
| FIN-20-05 | Cierre sin motivo | Motivo en blanco | Botón deshabilitado | P1 | Auto |
| FIN-20-06 | Formato con `{n:5}` | Variante de token | Acepta (`includes("{n")`); contrastar con la validación `{n}` estricta del motor | P1 | Manual |
| FIN-20-07 | Ver siguiente número | Botón "ver siguiente" | Muestra los próximos N sin consumir ninguno | P1 | Auto |

- **Riesgos / dudas:** criterio de formato inconsistente entre motor (`{n}`) y rango (`{n`). Sin validación de orden de fechas en cliente.

---

### FIN-21 · Envíos al Estado (cola, envío y carga de acuses)
- **Ruta/pantalla:** `/invoicing/envios`  **Componente:** `M/invoicing/pages/EnviosEstadoPage.vue`, `components/envios/UploadReceiptDialog.vue`, `EnvioDetailDialog.vue`, `stores/envios.store.ts`  **Envía:** `POST` envío (`enviosService.send(ids)`), reintento (`retry`), carga de acuse (`uploadReceipt`: `{id,filename,contentBase64,resultado?}`); filtros por `GET`
- **Permisos:** acciones de envío solo si `store.puedeEnviar` (permiso del servidor) y la fila está en pestaña "listas"; reintento según estado.
- **Campos (filtros):** búsqueda `q`, partner (number), país, canal, "vence". **Carga de acuse:** fichero `.xml,.p7m,.eml,.txt,.msg` (obligatorio), resultado declarado ACEPTADA/RECHAZADA (opcional).
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-21-01 | Envío individual | Fila en "listas" | POST con `[id]`; resultado `ok`/error en toast; con intermediario manual se descarga el fichero | P0 | Manual (solo sandbox, contacta con el Estado) |
| FIN-21-02 | Envío por lotes | 5 seleccionadas | Un POST con los 5 ids; resultados por envío; selección limpia; recarga | P0 | Manual (solo sandbox) |
| FIN-21-03 | Reintento de rechazada/error | Estado RECHAZADA | Botón reintentar visible; no para PENDIENTE retenida | P0 | Manual |
| FIN-21-04 | Sin permiso de envío | `puedeEnviar=false` | Sin botones de envío; POST directo 403 | P0 | Auto |
| FIN-21-05 | Subir acuse | Fichero .xml con resultado ACEPTADA | Base64 del fichero + resultado; estado de la fila se actualiza | P0 | Auto (sandbox) |
| FIN-21-06 | Acuse sin resultado declarado | Dejar vacío | Se omite `resultado`; el servidor lo deduce del contenido | P1 | Manual |
| FIN-21-07 | Acuse de gran tamaño | Fichero 30 MB | No hay límite de tamaño en el cliente (la lectura a base64 puede bloquear el navegador); servidor decide | P1 | Manual |
| FIN-21-08 | Filtro partner con valor no numérico | texto/decimales | `v-model.number` | P2 | Auto |
| FIN-21-09 | Doble clic en Enviar | 2 clics | `working` evita duplicados; verificar que no se envía dos veces el mismo documento | P0 | Auto (con envíos bloqueados) |

- **Riesgos / dudas:** el envío al Estado no pide confirmación (EnviosEstadoPage.vue `sendOne`/`sendSelected`). Sin límite de tamaño del acuse en cliente.

---

### FIN-22 · Configuración fiscal: alta de valor/requisito, cambio desde una fecha y cierre de vigencia
- **Ruta/pantalla:** `/invoicing/configuracion-fiscal`  **Componente:** `M/invoicing/components/fiscal/RuleFormDialog.vue`, `ChangeFromDateDialog.vue`, `EndRowDialog.vue`, `fiscFields.ts`, `FiscFieldInput.vue`  **Envía:** `fiscConfigService.create(tabla,data,motivo)`; `preview` + `closeAndCreate(tabla,id,data,desde,motivo)`; cierre de vigencia (`EndRowDialog`)
- **Permisos:** botones visibles si `store.canWrite` (`meta.puede_escribir`); sin él: aviso en la cabecera.
- **Campos:** por tabla (voci, valori, requisiti, canali, plazos, parametri...; 66 campos en `TABLE_FIELDS`): códigos en mayúsculas, ISO país, enteros, decimales (`valore_perc`), fechas de vigencia (`data_inizio` obligatoria, `data_fine`), enums del servidor, condición (texto "SIEMPRE" o constructor visual con `condicion_json`), motivo obligatorio. Cambio desde: fecha "desde" obligatoria, "hasta" opcional, motivo obligatorio.
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-22-01 | Alta de valor con vigencia | Voce IVA, país IT, 22 %, inicio hoy, motivo | Crea fila; aparece en la línea de tiempo; `saved` | P0 | Auto (sandbox) |
| FIN-22-02 | Campo obligatorio vacío no bloquea el botón | Dejar `id_voce` vacío con motivo | El botón solo exige motivo y condición válida; el error llega del servidor por campo (`fieldErrors`) y se pinta bajo el campo | P0 | Auto |
| FIN-22-03 | Solapamiento de vigencias | Mismo ámbito con fechas que pisan otra fila | Error con lista de ids solapados (`err.solapes`) | P0 | Auto |
| FIN-22-04 | Cambio desde fecha: vista previa obligatoria | Editar valor y pulsar Confirmar sin previsualizar | Confirmar deshabilitado hasta `preview.ok`; si cambia cualquier campo después, vuelve a deshabilitarse (`currentKey` vs `previewKey`) | P0 | Auto |
| FIN-22-05 | Vista previa con errores | Valor inválido | `preview.errores` por campo; no se confirma | P0 | Auto |
| FIN-22-06 | Cerrar vigencia | Fecha fin + motivo | Cierra la fila; si la regla es "aplicada" (detail.aplicada) no se permite modificar | P0 | Auto |
| FIN-22-07 | Fecha fin anterior al inicio | `data_fine` < `data_inizio` | Sin validación de cliente; error del servidor | P1 | Auto |
| FIN-22-08 | Porcentaje fuera de rango | -1; 101; "abc" | `decimal` sin tope en cliente; servidor decide | P0 | Manual |
| FIN-22-09 | Constructor de condición inválido | Hoja sin valor | `condValid=false` deshabilita Crear | P1 | Auto |
| FIN-22-10 | Sin permiso de escritura | `puede_escribir=false` | Sin botones de alta/edición; POST directo 403 | P0 | Auto |

- **Riesgos / dudas:** el alta no valida obligatorios en cliente; en `changedData` un campo `null` se envía como `""`.

---

### FIN-23 · Asistente de reglas fiscales (8 pasos)
- **Ruta/pantalla:** `/invoicing/configuracion-fiscal` → pestaña Reglas por etapa → Nueva regla / editar  **Componente:** `M/invoicing/components/fiscal/reglas/RuleWizardDialog.vue` (+ `ScopePicker`, `ConditionBuilder`, `ActionParamsForm`, `PreviewTable`, `ConflictsPanel`, `RuleActionDialog`)  **Envía:** `fiscReglasService.create/update` (borrador, con motivo), `preview(id,{partner,cliente,desde,hasta,fecha})`, `activate(id,token,motivo)`, `approve`, `reject`, `conflictos`
- **Permisos:** `config.canWrite` para crear; la activación puede requerir doble aprobación (`requiere_aprobacion`): quien activa y quien aprueba son distintos (textos `activar_doble`/`activar_simple`).
- **Pasos:** 1 objetivo/etapa, 2 ámbito (país, partner, servicio, cliente), 3 condición, 4 acción y parámetros, 5 vigencia, 6 resumen y guardar borrador (motivo obligatorio), 7 simulación sobre facturas reales, 8 activar/aprobar.
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-23-01 | Regla completa hasta borrador | Objetivo "FIJAR_TIPO", ámbito IT, vigencia hoy, motivo | Se guarda en BORRADOR; el paso 6 exige guardar antes de avanzar (`!dirty`) | P0 | Auto (sandbox) |
| FIN-23-02 | Cambiar de etapa borra la acción | Elegir otra etapa en el paso 1 | `regla.accion` y `params` se reinician | P1 | Auto |
| FIN-23-03 | Simulación obligatoria antes de activar | Intentar activar sin vista previa | Botón Activar deshabilitado (`!preview || dirty || !motivoActivar`); la huella (`token`) se envía a `activate` | P0 | Auto |
| FIN-23-04 | Editar tras simular | Cambiar parámetro después de la simulación | `dirty`: hay que guardar y volver a simular; el token antiguo no sirve | P0 | Auto |
| FIN-23-05 | Conflictos con otras reglas | Regla que pisa otra del mismo ámbito | `ConflictsPanel` lista conflictos; error de servidor devuelve a los pasos 1-5 según el campo (`k.includes("condicion")` etc.) | P0 | Auto |
| FIN-23-06 | Doble aprobación | Regla con `requiere_aprobacion` | Tras activar queda PENDIENTE; otro usuario aprueba o rechaza con motivo; el mismo usuario no puede aprobar su propia regla (servidor) | P0 | Manual |
| FIN-23-07 | Reabrir regla existente | Abrir regla ACTIVA/PENDIENTE | Salta al paso 8 (pendiente) o 6; campos bloqueados (`locked`) | P1 | Auto |
| FIN-23-08 | Acción BLOQUEAR / RETENER_ENVIO | Regla de control | La simulación indica facturas afectadas; activar surte efecto en emisiones posteriores (comprobar que una factura nueva queda retenida) | P0 | Manual |
| FIN-23-09 | Vigencia con fecha en el pasado | `data_inizio` anterior a la última factura emitida | Aviso/error del servidor; afecta a facturas ya emitidas (no determinado) | P0 | Manual |
| FIN-23-10 | Cerrar el asistente con cambios | Cerrar con borrador sin guardar | No se detectó confirmación de pérdida de cambios | P2 | Manual |

- **Riesgos / dudas:** no se leyó el contenido íntegro de los 1.218 líneas; los parámetros por acción (`ActionParamsForm`) y sus límites no se inventariaron (no determinado). No se verificó que la regla de "no aprobar la propia" esté en el servidor.

---

### FIN-24 · Datos fiscales de una entidad (cliente, partner o usuario)
- **Ruta/pantalla:** `/invoicing/datos-fiscales/:tipo/:id` y pestaña en la ficha de anagrafica  **Componente:** `M/invoicing/components/fiscal/DatosFiscalesPanel.vue`  **Envía:** `fiscConfigService.settingSet({tipo,id,clave,valor,desde,hasta,motivo})`
- **Permisos:** botones con `data.puede_escribir`.
- **Campos:**

| Campo | Control | Obligatorio | Reglas |
|---|---|---|---|
| Fecha de consulta | date | No | Fecha para ver los valores vigentes |
| Clave | v-select (catálogo `claves`) | Sí | |
| Valor | texto | Sí | Validado en cliente contra el regex `formato` de la clave (`new RegExp(formato,"u")`); si el regex es inválido se deja pasar |
| Desde | date | Sí | por defecto hoy |
| Hasta | date | No | |
| Motivo | texto | Sí | |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-24-01 | Alta de dato con formato válido | Clave con regex de P.IVA y valor correcto | Guarda; toast `saved`; recarga vigentes | P0 | Auto |
| FIN-24-02 | Formato inválido | Valor que no cumple el regex | Error `bad_format`; Guardar deshabilitado | P0 | Auto |
| FIN-24-03 | Sustituir un dato vigente | Misma clave con nuevo valor desde mañana | El anterior se cierra el día previo; histórico conserva ambos | P0 | Auto |
| FIN-24-04 | Vigencia solapada o hasta < desde | Fechas incoherentes | Error del servidor en el campo (`formErrors`) | P1 | Auto |
| FIN-24-05 | Entidad inexistente por URL | `/datos-fiscales/cliente/999999` | Estado de error controlado | P2 | Auto |
| FIN-24-06 | Consulta a fecha pasada | Fecha de consulta anterior | Muestra los valores vigentes en esa fecha; no permite editar el histórico | P1 | Manual |

- **Riesgos / dudas:** un regex de servidor incompatible con JS se ignora en cliente.

---

### FIN-25 · Ajustes fiscales menores: modo del intermediario, cierre de alerta, revisión
- **Ruta/pantalla:** `/invoicing/configuracion-fiscal` (pestañas Canales/Intermediarios, Alertas, Revisión)  **Componente:** `M/invoicing/components/fiscal/IntermediariTable.vue`, `AlertasPanel.vue`, `RevisionPanel.vue`  **Envía:** `fiscConfigService.setIntermediarioModo(...,motivo)`; `closeAlert(id,motivo)`; `revision(fecha)` (consulta) y `runRevision(fecha)` (ejecuta)
- **Permisos:** `store.canWrite`.
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-25-01 | Cambiar modo del intermediario | MANUAL a otro modo, motivo | Botón activo solo si el modo cambia y hay motivo; afecta a cómo se entregan los documentos al Estado (a validar en FIN-21) | P0 | Manual (solo sandbox) |
| FIN-25-02 | Cerrar alerta sin motivo | Motivo vacío | Botón deshabilitado | P1 | Auto |
| FIN-25-03 | Ejecutar revisión | Fecha elegida | `runRevision` (efectos de escritura) frente a `revision` (solo lectura); comprobar que el botón de ejecutar exige permiso | P0 | Manual |
| FIN-25-04 | Filtros de alertas | Tipo, severidad, partner | Lista filtrada; limpiar restablece | P2 | Auto |

- **Riesgos / dudas:** no se leyeron las opciones de `modo` ni el efecto exacto de `runRevision` (no determinado).

---

### FIN-26 · Alta y edición de proforma (cabecera + líneas)
- **Ruta/pantalla:** `/proforma` (Nueva / Editar)  **Componente:** `M/proforma/components/ProformaEditDialog.vue`, `stores/proforma.store.ts`, `services/proforma.service.ts`  **Envía:** `POST api_proforma_crud` (alta con items en cascada) / `PUT api_proforma_crud` `{id,...}` (reemplaza items)
- **Permisos:** la ruta no tiene `beforeEnter` ni comprobación de capabilities (router/index.ts:1030); el servidor valida acceso a la expedición (`validate_shipment_access`, Proforma_Crud_Controller.php:146).
- **Campos:**

| Campo | Control | Obligatorio | Reglas |
|---|---|---|---|
| ID expedición | number (`v-model.number`) | Sí | `> 0`; deshabilitado al editar; servidor 400 si <= 0 y 403 sin acceso |
| Fecha | date | No | sin validación; sin valor por defecto |
| Motivo | v-select (lookup `motivi`) clearable | No | |
| País de origen | CmCountrySelect | No | |
| Moneda | v-autocomplete (id numérico de `valute`) clearable | No | |
| Líneas: descripción, código aduanero, cantidad, unidad, peso neto, peso bruto, unidad de peso (maxlength 3), valor | tabla | >= 1 línea con descripción | Solo se envían líneas con descripción no vacía; `qta`, pesos y valor son `type=number` sin `.number` (llegan como texto); sin mínimos |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-26-01 | Alta feliz | Expedición válida, 1 línea (valor 120,50, pesos 2/2,2, 'K') | Se crea; el listado refresca; toast `created`; se cierra | P0 | Auto |
| FIN-26-02 | Sin líneas con descripción | Todas las descripciones vacías | Error `noLines` bajo la tabla; no se llama al servidor | P0 | Auto |
| FIN-26-03 | Expedición inexistente o ajena | Id de otro partner | 403 "No access to shipment"; el diálogo debe mostrar el error y no cerrarse | P0 | Auto |
| FIN-26-04 | Valores negativos o absurdos | cantidad -3, valor -10, peso bruto < neto | Sin validación en cliente; servidor decide. Para aduanas puede producir documento erróneo | P0 | Manual |
| FIN-26-05 | Líneas sin moneda | Valores informados y moneda vacía | Se permite; la proforma queda sin moneda | P0 | Manual |
| FIN-26-06 | Editar y quitar una línea | Abrir, borrar línea, guardar | PUT con items reemplazados; la línea desaparece | P0 | Auto |
| FIN-26-07 | Moneda guardada fuera del catálogo | Proforma antigua con id no listado | Se conserva insertándola en la lista como número | P2 | Auto |
| FIN-26-08 | Error del servidor deja el diálogo abierto | Forzar 500 | `store.create` lanza; el cierre (`close()`) no se ejecuta; no hay manejo local: depende del interceptor global de errores | P1 | Auto |
| FIN-26-09 | Cambiar de expediente en edición | Intentar editar el id | Campo deshabilitado | P2 | Auto |
| FIN-26-10 | Doble clic en Guardar | 2 clics | Una sola proforma (`:loading="store.saving"` no deshabilita, solo muestra carga; verificar) | P0 | Auto |

- **Riesgos / dudas:** sin validación de numéricos ni de la relación peso bruto/neto; `qta`, pesos y valor sin `.number` se envían como cadenas. Sin control de permisos de escritura en la UI. El diálogo es `persistent` pero no avisa de cambios sin guardar.

---

### FIN-27 · Proforma: filtros, duplicar y eliminar
- **Ruta/pantalla:** `/proforma`  **Componente:** `M/proforma/pages/ProformaListPage.vue`  **Envía:** `GET api_proforma_crud` (filtro); `POST api_proforma_duplicate` `{id,target_shipment_id}`; `DELETE api_proforma_crud?id=`
- **Campos:** ID expedición (number), fecha desde/hasta (date) con Enter solo en el primero; `iso_paese_origine` solo por clic en celda; diálogo duplicar: expedición destino (obligatoria); eliminar: confirmación (`useConfirmStore`, variante danger).
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-27-01 | Filtrar por expedición y fechas | id 123, rango de un mes | Solo coincidentes; chips de filtros activos | P2 | Auto |
| FIN-27-02 | Rango invertido | Desde > Hasta | Sin validación de cliente; resultado vacío | P2 | Auto |
| FIN-27-03 | Duplicar a otra expedición | Destino válido | Nueva proforma con las mismas líneas; toast `duplicated`; listado refresca | P0 | Auto |
| FIN-27-04 | Duplicar sin destino o a una expedición ajena | vacío; id ajeno | Error `targetRequired` en cliente; 403 "No access to target shipment" del servidor (API/controller/api/proforma/Proforma_Duplicate_Controller.php:71) | P0 | Auto |
| FIN-27-05 | Eliminar con confirmación | Confirmar / cancelar | Cancelar no envía; confirmar borra proforma e items en cascada | P0 | Auto |
| FIN-27-06 | Duplicar a la misma expedición | Destino = origen | No hay regla de cliente ni verificada en el servidor (no determinado) | P1 | Manual |

- **Riesgos / dudas:** `runDuplicate` no captura excepciones (si la petición falla el diálogo queda abierto sin mensaje local).

---

### FIN-28 · Generar QR de lote de cheques (COD)
- **Ruta/pantalla:** `/cod` pestaña "Nuevo lote"  **Componente:** `M/cod_assegni/components/QrGeneratorCard.vue`  **Envía:** `POST api_cod_capture_session` `{id_fornitore,bill_no?,bill_date?,descriz?}`
- **Permisos:** la ruta `/cod` no tiene guard y el componente no comprueba `can.write`; el servidor decide (el borrado exige administrador, Capture_Session_Controller.php:139-153).
- **Campos:**

| Campo | Control | Obligatorio | Reglas |
|---|---|---|---|
| Transportista | v-select | Sí | `canGenerate`: `carrierId !== null` |
| N.º de remesa | texto | No | recortado |
| Fecha de remesa | date | No | por defecto hoy local; sin límites |
| Descripción | texto | No | recortado |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-28-01 | Crear lote y QR | Transportista, nº, fecha | Muestra QR (PNG base64), URL, caducidad; lista del transportista se filtra y recarga | P0 | Auto |
| FIN-28-02 | Worker de QR caído | Respuesta con `warning` y QR nulo | Aviso `worker_down`; se muestra el enlace igualmente; el lote existe | P1 | Manual |
| FIN-28-03 | Copiar enlace sin permiso de portapapeles | Denegar permiso | No hay error visible; la URL sigue seleccionable | P2 | Auto |
| FIN-28-04 | Fecha en blanco | Borrar la fecha | Se omite `bill_date` del payload | P2 | Auto |
| FIN-28-05 | Doble clic en Generar | 2 clics | Un solo lote (el QR es una credencial en papel; un lote huérfano no se puede revocar sin cerrarlo) | P0 | Auto |
| FIN-28-06 | Nuevo lote tras crear | Botón de reinicio | Formulario limpio con fecha de hoy | P2 | Auto |

- **Riesgos / dudas:** sin comprobación de `canWrite`; cada clic crea una credencial persistente.

---

### FIN-29 · Revisión de lote COD: filtros, confirmación, asignación, re-emparejado y aprobación
- **Ruta/pantalla:** `/cod` → abrir un lote  **Componente:** `M/cod_assegni/components/BatchReviewPanel.vue` (+ `InlineSuggestions.vue`, `SuggestionPicker.vue`)  **Envía:** `GET api_cod_capture_review?id=`; `POST api_cod_capture_review` con `op`: `confirm`, `confirm_bulk` `{check_ids}`, `assign` `{check_id,id_spedizione,note}`, `rematch` `{id_fornitore?}`, `approve`
- **Permisos:** el panel no comprueba capabilities en la UI; el servidor decide. `approve` es "la puerta de un solo sentido": el cheque pasa a ser el registro de la expedición.
- **Campos:**

| Campo | Control | Reglas |
|---|---|---|
| Búsqueda | texto | Por n.º de cheque, documento, banco y expedición; ignora espacios |
| Estado / Banco | v-select múltiple | Solo valores presentes en el lote |
| Importe mínimo | number (`minAmountRaw`) | Vacío = sin filtro; filtra `importo_cents < minAmount*100` |
| Solo sin asignar | switch | |
| Casillas de confirmación | por cheque | Solo `return_match` con expedición (`canConfirm`) |
| Nuevo transportista para re-emparejar | v-select | Solo se envía si cambia |
| Aprobar | ConfirmDialog | |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-29-01 | Aprobar lote con todo resuelto | Cheques confirmados/asignados | `op=approve`; informe con divergencias (importe cheques vs COD facturado); no se sobrescribe nada | P0 | Auto (sandbox) |
| FIN-29-02 | Aprobar con pendientes | 2 sin decidir | Se permite; el servidor solo aplica lo decidido por una persona; los demás siguen en cola | P0 | Auto |
| FIN-29-03 | Divergencia de importes | Suma de cheques != COD de la expedición | El informe `ApplyReport` lista la divergencia; el importe no se modifica | P0 | Auto |
| FIN-29-04 | Filtro de importe mínimo con decimales | Cheques de 1,10 / 3,10 / 4,35 con mínimo 1,1 / 3,1 | Compara `cents < min*100`; 1,1*100 = 110.00000000000001 hace que un cheque de exactamente 1,10 se excluya (defecto probable de coma flotante) | P1 | Auto |
| FIN-29-05 | Confirmar derivados en bloque | Marcar 9 `return_match` y confirmar | `confirm_bulk`; el servidor omite los que no tienen expedición y devuelve `skipped` | P0 | Auto |
| FIN-29-06 | "Devolución en efectivo" sin AWB | `cash_return` | No se puede confirmar; exige elegir expedición (FIN-30) | P0 | Auto |
| FIN-29-07 | Re-emparejar con otro transportista | Cambiar transportista y confirmar | Se reasigna el lote y se re-emparejan; los cheques con decisión manual no se tocan | P0 | Manual |
| FIN-29-08 | Lote grande | 1.000+ cheques | Pinta 50 y "ver más"; filtros reinician la ventana; rendimiento aceptable | P1 | Auto |
| FIN-29-09 | Perfil sin escritura | Capabilities partner | La UI no oculta Aprobar/Confirmar; el servidor debe responder 403 (verificar) | P0 | Auto |
| FIN-29-10 | Cambio de estado concurrente | Otro operador asigna el mismo cheque | La recarga tras la acción refleja el estado; el segundo `assign` no pisa una decisión `manual` ("permanente") | P0 | Manual |

- **Riesgos / dudas:** (1) sin control de permisos en la UI para acciones de dinero (BatchReviewPanel.vue; `grep` de `can.`/`capabilities` en los componentes de COD no devuelve nada). (2) filtro de importe mínimo con `* 100` en coma flotante (BatchReviewPanel.vue, `decisions`). (3) el aprobar abre un ConfirmDialog; no se leyó su texto.

---

### FIN-30 · Asignar manualmente un cheque a una expedición
- **Ruta/pantalla:** `/cod` → lote → "Asignar"  **Componente:** `M/cod_assegni/components/SuggestionPicker.vue`, `InlineSuggestions.vue`  **Envía:** `GET` sugerencias (`fetchSuggestions`), `GET` búsqueda (`searchShipments`), `POST api_cod_capture_review` `op=assign` `{check_id,id_spedizione,note}`
- **Campos:** candidatos (radio, nunca preseleccionado), búsqueda de expedición (autocomplete remoto, mínimo 3 caracteres, debounce 300 ms), nota automática según origen (candidatos o escrito).
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-30-01 | Asignar candidato sugerido | Elegir un candidato | `assign` con id; el cheque queda `manual` y se refresca el lote | P0 | Auto (sandbox) |
| FIN-30-02 | Guardar sin elegir | Sin selección | Error `pick_one`; no hay llamada | P0 | Auto |
| FIN-30-03 | Buscar por menos de 3 caracteres | "ab" | Sin resultados ni llamada | P2 | Auto |
| FIN-30-04 | Importe de la expedición muy distinto del cheque | Candidato con COD distinto | Se muestra el importe en la etiqueta (`importo €`); la asignación es posible (divergencia aparecerá al aprobar) | P0 | Manual |
| FIN-30-05 | Expedición de otro transportista | Id fuera del alcance | Error del servidor visible en el diálogo | P0 | Auto |
| FIN-30-06 | Elegir candidato y luego buscar | Cambia de modo | El candidato se deselecciona (`onPick`), solo cuenta la última elección | P1 | Auto |

- **Riesgos / dudas:** importes de etiqueta fijos con símbolo "€". `toLocaleString(undefined)` usa el idioma del navegador (inconsistente con `it-IT` del resto).

---

### FIN-31 · Conciliación COD: marcar cobrado, asignar a remesa, filtros y exportar
- **Ruta/pantalla:** `/cod/reconciliation`  **Componente:** `M/cod_assegni/pages/CodReconciliationPage.vue`, `reconciliation.logic.ts`, `services/reconciliation.service.ts`  **Envía:** `GET api_cod_reconciliation?list=&summary=` ; `POST api_cod_reconciliation` `{action:"reconcile",shipment_id,collection_date,state}` y `{action:"assign_report",shipment_ids[],report_id}`; `POST api_cod_export` `{date_from,date_to,format}`
- **Permisos:** ruta con `codCan.read()`; acciones con `caps.canWrite` (marcar cobrado en pestaña "pendientes", asignar remesa en "por remesar"). Exportar visible siempre.
- **Campos:**

| Campo | Control | Obligatorio | Reglas |
|---|---|---|---|
| Pestaña | pending / to_report / ... | Sí | Cambiar reinicia página y selección |
| Desde / Hasta / Transportista | date, date, select | No | Recargan lista y resumen; sin validación de orden |
| Marcar cobrado: fecha | date | Sí | por defecto hoy en UTC; sin `max`; confirmar con diálogo |
| Estado | select C/B/AB1/AB2 | Sí | por defecto C; servidor: estado inválido se convierte en "cobrado" silenciosamente (`in_array(...)? $state : STATE_COLLECTED`, API/service/cod/Cod_Reconciliation_Service.php:126) |
| Remesa | number min 1 | Sí | `isValidReportId` (entero positivo); confirmar con diálogo |
| Selección | casillas | >=1 | `toggleSelection`, `setPageSelection`, suma `selectedTotal` a 2 decimales |
| Exportar | desde/hasta (obligatorios), formato xlsx/csv | Sí | `!exportFrom \|\| !exportTo` deshabilita; sin comprobar orden |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-31-01 | Marcar cobrado feliz | Envío con COD, fecha hoy, estado C, confirmar | `action=reconcile`; sale de pendientes; entra en "por remesar"; resumen se actualiza | P0 | Auto |
| FIN-31-02 | Envío sin importe COD | Envío con `contras_imp=0` | Servidor: "Shipment has no COD amount" (400); toast de error | P0 | Auto |
| FIN-31-03 | Fecha de cobro en el futuro | Mañana | Cliente y servidor la aceptan (solo exige fecha válida); defecto de negocio probable | P0 | Manual |
| FIN-31-04 | Fecha UTC | Reloj 18:00 America/Los_Angeles | `today()` UTC ya es "mañana": fecha futura por defecto | P0 | Manual |
| FIN-31-05 | Asignar remesa a selección | 3 envíos y remesa 77 | `assign_report`; toast con recuento y remesa; el total devuelto coincide con la suma de importes seleccionados | P0 | Auto |
| FIN-31-06 | Remesa inválida | 0; -2; 1,5; vacío | Botón deshabilitado (`isValidReportId`) | P0 | Auto |
| FIN-31-07 | Algunos envíos no elegibles | Selección con 1 no cobrado | Servidor cuenta solo elegibles; si ninguno, 400 "No eligible shipments to report" | P0 | Auto |
| FIN-31-08 | Selección entre páginas | Seleccionar en página 1 y paginar | La selección se mantiene en `selected` (no se filtra por página): comprobar que `selTotal` solo suma filas de la página actual (`selectedTotal(rows,...)`) y por tanto infraestima el total real (defecto probable) | P0 | Auto |
| FIN-31-09 | Estado inválido por API | `state` no soportado | Cae silenciosamente a "cobrado" en servidor | P1 | Manual |
| FIN-31-10 | Exportar con rango invertido o sin fechas | Desde > Hasta | A diferencia de la distinta del lote, no hay control `bad_range`; servidor decide | P1 | Auto |
| FIN-31-11 | Perfil de solo lectura | `canWrite=false` | Sin botones de cobrar ni de asignar | P0 | Auto |
| FIN-31-12 | Cambiar pestaña con selección | Seleccionar y cambiar de pestaña | Se vacía la selección | P2 | Auto |

- **Riesgos / dudas:** `selectedTotal(rows, selected)` suma solo filas de la página cargada, aunque `selected` conserve ids de otras páginas (CodReconciliationPage.vue, `selTotal`). Fecha de cobro por defecto en UTC. Servidor convierte estados inválidos a "cobrado".

---

### FIN-32 · Exportar distinta COD (cliente y periodo)
- **Ruta/pantalla:** `/cod` pestaña "Exportar"  **Componente:** `M/cod_assegni/components/DistintaExport.vue`  **Envía:** `GET api_cod_distinta_export?id_cliente&from&to&bill_no&format` (descarga CSV/XLSX); lista de clientes `?op=clients`
- **Campos:** Cliente (select, obligatorio), Desde/Hasta (date), N.º de remesa (texto), Formato csv/xlsx.
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| FIN-32-01 | Exportar con periodo | Cliente + rango | Descarga con nombre del `Content-Disposition`; una fila por cheque | P1 | Auto |
| FIN-32-02 | Sin periodo ni remesa | Cliente solo | Error `range_required` (evita barrer todo el histórico) | P0 | Auto |
| FIN-32-03 | Solo remesa, sin fechas | `bill_no` informado | Permitido | P1 | Auto |
| FIN-32-04 | Rango invertido | Desde > Hasta | Error `bad_range` | P1 | Auto |
| FIN-32-05 | Respuesta de error JSON | Servidor devuelve JSON con `error` | Se muestra el mensaje del servidor | P2 | Auto |

- **Riesgos / dudas:** es el único exportador COD con validación de orden de fechas.

---

## Hallazgos transversales (para el resumen)
1. FIN-11-02: la fila de cuota de coste por defecto (`anno`=año actual, neto 0, cuenta 0) se envía y el servidor la cuenta (solo ignora anno=0,neto=0,cuenta=0): el alta manual de factura pasiva sin distribución falla con 422 QUOTES_MISMATCH.
2. Fechas fiscales y de cobro generadas con `toISOString()` (UTC) en alta manual, generación, pasiva manual, conciliación COD y estado de cuota; las otras partes usan hora local. Cerca de medianoche producen la fecha de ayer o de mañana. Fecha de cobro/factura futura aceptada en cliente (sin `max`) y, en COD, también en servidor.
3. Importes: moneda fijada a EUR en alta manual, pasiva manual, recordatorios y formateadores `it-IT` en toda la capa; alta manual con `aliquota_iva=22` y `cod_iva="21"` por defecto; conciliación bancaria usa `Math.abs` en el importe por defecto (un cargo puede cerrarse como cobro).
4. COD: `selTotal` de conciliación suma solo la página actual aunque la selección persista entre páginas; filtro de importe mínimo con `*100` en coma flotante; sin control de permisos de escritura en `BatchReviewPanel` ni `QrGeneratorCard`; `/cod` y `/proforma` sin `beforeEnter`.
5. CSV de cobros sin neutralización de fórmulas (`=`, `+`, `-`, `@`).

## Inventario

| Prefijo-nn | Formulario | Fichero | Nº casos |
|---|---|---|---|
| FIN-01 | Cobrar cuota (total/parcial) y reabrir | `M/payments/components/CollectDialog.vue` | 13 |
| FIN-02 | Cierre masivo de cuotas | `M/payments/components/BulkCollectDialog.vue` | 8 |
| FIN-03 | Listado de cobros y pagos (filtros) | `M/payments/pages/PaymentListPage.vue` | 7 |
| FIN-04 | Antigüedad de saldos | `M/payments/pages/AgingPage.vue` | 5 |
| FIN-05 | Recordatorios de cobro | `M/payments/pages/ReminderPage.vue` | 8 |
| FIN-06 | Conciliación bancaria | `M/payments/pages/BankReconciliationPage.vue` | 12 |
| FIN-07 | Alta manual de factura activa | `M/invoicing/components/invoice/ManualInvoiceDialog.vue` | 13 |
| FIN-08 | Generar factura para un cliente | `M/invoicing/components/invoice/GenerateInvoiceDialog.vue` | 9 |
| FIN-09 | Seleccionar envíos facturables | `M/invoicing/components/invoice/BillableShipmentsDialog.vue` | 5 |
| FIN-10 | Nota de crédito y remediación | `M/invoicing/components/invoice/CreditNoteDialog.vue` | 11 |
| FIN-11 | Factura pasiva manual | `M/invoicing/components/invoice/SupplierInvoiceDialog.vue` | 9 |
| FIN-12 | Importar XML FatturaPA | `M/invoicing/components/invoice/SupplierXmlImport.vue` | 10 |
| FIN-13 | Exportaciones intra-UE y anual | `M/invoicing/components/invoice/ExportDialog.vue` | 7 |
| FIN-14 | Filtros de facturas y estado de control | `M/invoicing/components/invoice/InvoiceFilterPanel.vue` | 5 |
| FIN-15 | Facturación mensual por lotes | `M/invoicing/pages/MonthlyBillingPage.vue` | 11 |
| FIN-16 | Importar fichero de transportista | `M/invoicing/pages/CarrierReconciliationPage.vue` | 9 |
| FIN-17 | Alta rápida factura de transportista | `M/invoicing/pages/CarrierReconciliationPage.vue` | 5 |
| FIN-18 | Aceptar/repercutir diferencias y vincular | `M/invoicing/pages/CarrierReconciliationPage.vue` | 7 |
| FIN-19 | Motor de numeración | `M/invoicing/components/numbering/NumberingEngineDialog.vue` | 8 |
| FIN-20 | Rangos de numeración | `M/invoicing/components/numbering/NumberingRangesPanel.vue` | 7 |
| FIN-21 | Envíos al Estado y acuses | `M/invoicing/pages/EnviosEstadoPage.vue` | 9 |
| FIN-22 | Configuración fiscal (alta/cambio/cierre) | `M/invoicing/components/fiscal/RuleFormDialog.vue` | 10 |
| FIN-23 | Asistente de reglas fiscales | `M/invoicing/components/fiscal/reglas/RuleWizardDialog.vue` | 10 |
| FIN-24 | Datos fiscales de entidad | `M/invoicing/components/fiscal/DatosFiscalesPanel.vue` | 6 |
| FIN-25 | Intermediario, alertas y revisión | `M/invoicing/components/fiscal/IntermediariTable.vue` | 4 |
| FIN-26 | Alta/edición de proforma | `M/proforma/components/ProformaEditDialog.vue` | 10 |
| FIN-27 | Proforma: filtros, duplicar, eliminar | `M/proforma/pages/ProformaListPage.vue` | 6 |
| FIN-28 | Generar QR de lote COD | `M/cod_assegni/components/QrGeneratorCard.vue` | 6 |
| FIN-29 | Revisión de lote COD | `M/cod_assegni/components/BatchReviewPanel.vue` | 10 |
| FIN-30 | Asignar cheque a expedición | `M/cod_assegni/components/SuggestionPicker.vue` | 6 |
| FIN-31 | Conciliación COD | `M/cod_assegni/pages/CodReconciliationPage.vue` | 12 |
| FIN-32 | Exportar distinta COD | `M/cod_assegni/components/DistintaExport.vue` | 5 |

Total: 32 formularios (fichas FIN-01 a FIN-32) y 263 casos. `M/` = `/var/www/dev/erp_findair/web/apps/operations/src/modules/`.
