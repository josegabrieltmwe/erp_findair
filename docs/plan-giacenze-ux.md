# Plan: mejorar el acceso y la ficha de giacenza en la SPA

> **Estado:** borrador · **Última modificación:** 2026-11-12

Origen: comparación del legado (`legacy/tmwe_erp/erp/giacenze_*.php`), la SPA
(`web/apps/operations/src/modules/giacenze`) y Jose_master (`tmwe2/giacenze.html`).

## 1. Cómo funciona hoy en cada sistema

| Aspecto | Legado | Jose_master | SPA moderna |
|---|---|---|---|
| Entrada desde la home | 4 contadores por «quién debe actuar» (cliente / proveedor / entregadas) → lista filtrada | 2 tarjetas + bloque Asistenza; la página abre por defecto en la cola «Da comunicare al cliente» | 3 tarjetas → lista con `?indicator=` **invisible** (sin chip) |
| Entrada desde el envío | Botón «Giacenza» de color (rojo abierta / verde cerrada / gris no hay): 1 clic | Enlace «N giacenze collegate» (`?sped=`), banner «mostra tutte», vuelta con `?open=` | Enlace en pestaña nueva (`_blank`, pierde contexto) o botón «Crear giacenza» que **envía email al cliente sin avisar** |
| Colas de trabajo | `ti=open/openc/openf` | 8 colas con contador (nueva, abiertas, esperando instrucciones, dar al proveedor, entregadas por cerrar, cerradas, >15 d, todas) | Ninguna dentro de la página |
| Lista | Ordenable, filtros Sí/No de cada hito, anterior/siguiente en la ficha | Columnas de hitos (avisado / respuesta), filas en rojo por antigüedad, acciones en bloque (cerrar, esito) | Filtro por ID numérico de cliente, sin ordenar, sin columna de estado/próximo paso |
| Ficha | Campos que se guardan solos al salir; botones separados «Avisar cliente» / «Avisar proveedor»; dirección original conservada | Una pantalla: franja **«Da sistemare»** (qué falta + botón cerrar), 5 botones de esito con icono, ciclo en 3 pasos fechados, mensajes con plantilla ya redactada | Diálogo de 640 px con **12 campos planos**, 4 fechas editables a mano, mensajes y direcciones al final del scroll |
| Cierre | Escribir `data_close` | Botón único con confirmación («addebita e chiudi» / «senza addebito») | 3 vías (operación C, fecha, botón de fila) + auto-cierre masivo |
| Reabrir | Solo por tracking automático | — | Existe en el servicio (`reopen_giacenza`) pero no hay acción |

Reglas de negocio comunes (conservar): los hitos `cont_cliente_data` → `risp_cliente_data` → `cont_fornitore_data` marcan
quién debe actuar; `descriz` (instrucción del cliente) fija `risp_cliente_data`; enviar GIAf fija `cont_fornitore_data`;
el cargo se bloquea si la expedición está postfacturada; el precio sale del listino del cliente.

## 2. Problemas de la SPA (priorizados)

1. **P1 No se ve qué hacer.** Falta el estado y el siguiente paso («avisar al cliente», «esperando respuesta», «dar instrucciones al proveedor»), aunque la home ya clasifica así.
2. **P1 Formulario plano y manual.** Fechas de contacto, `data_open`, `data_close` y la operación se editan a mano; deberían derivarse de las acciones. Cerrar con operación ≠ C o con fecha anterior a la apertura es posible.
3. **P1 Acceso difícil.** Indicador de URL invisible; sin colas; el enlace desde el envío abre pestaña nueva; «Nueva» pide el ID de expedición a mano.
4. **P1 Efecto oculto.** «Crear giacenza» desde el envío manda un email al cliente sin confirmar.
5. **P2 Mensajes escondidos.** Segundo diálogo anidado, destinatario escrito a mano, sin plantilla ni vista previa; los fallos no se muestran.
6. **P2 Errores sin capturar** en alta, edición, mensajes, copiar precio y acciones de lista (SHP-33-03, SHP-34-05).
7. **P2 La API ya tiene lo necesario y no se usa:** `PUT api_giacenze_operations` (cambia operación y fechas con reglas), historial de operaciones, `reopen_giacenza`, filtros `cont_cliente`, `cont_fornitore`, `risp_cliente`, `addebito_riconsegna`, `giacenza_gg`, `data_close_flag`, fechas con formato (`enrich_with_date_display`).
8. **P3** Auto-cierre sin confirmación y con gating `isTmwe` en SPA frente a `admin` en servidor; aging no clicable.

## 3. Propuesta

Principio: **la ficha guía la secuencia del legado/Jose_master (avisar cliente → recibir instrucciones → instruir proveedor → cerrar) y el
usuario solo escribe lo que no se puede deducir.**

### Fase 1 — Acceso y colas (SPA, sin cambios de API salvo lo indicado)
- Barra de colas en `/giacenze` (chips con contador): *Da comunicare al cliente*, *In attesa del cliente*, *Da dare al fornitore*,
  *Consegnate da chiudere*, *Oltre 15 giorni*, *Aperte*, *Chiuse*, *Tutte*. Mapean a los indicadores ya existentes (`?indicator=`) y a los filtros
  del servidor aún sin exponer. Sin parámetros abre en *Da comunicare al cliente*; el `?indicator=` activo se ve como cola seleccionada.
- Columnas nuevas: **Cliente avisado / Respuesta / Proveedor avisado** (iconos o chips ámbar/gris, como Jose_master) y «Próximo paso». Fila resaltada por antigüedad (>10 d).
- Selector de cliente con búsqueda (en vez de ID numérico) y ordenación por columna (requiere ampliar `get_sortable_fields` en API).
- Desde el envío: enlace con el router (misma pestaña, botón «Volver al envío») y banner «Giacenze del envío N · ver todas»; el botón del envío pasa a un único
  estado con color (sin giacenza / abierta / cerrada) como en el legado. Navegación anterior/siguiente dentro de la cola al abrir una ficha.

### Fase 2 — Ficha nueva (reemplaza el diálogo plano)
Panel lateral ancho o página `/giacenze/:id` (deep-link `?id=` se mantiene), con:
1. **Cabecera:** estado (Abierta/Cerrada), cliente, envío (enlace misma pestaña), AWB/tracking, días abierta.
2. **Franja «Da sistemare»:** lista lo que falta y lleva a cada paso; muestra «Pronta da chiudere» y el botón **Cerrar** (confirmación con y sin cargo); si está cerrada, botón **Reabrir** (usa `reopen_giacenza`, requiere exponer la acción en el controller).
3. **Ciclo de 3 pasos fechados** (cliente avisado → instrucciones recibidas → proveedor instruido), de solo lectura; cada paso tiene su acción («Avisar cliente», «Registrar instrucciones», «Avisar proveedor»). Las fechas se rellenan al ejecutar la acción, no a mano (edición manual solo para admin).
4. **Resultado (esito)** como 5 botones con icono (en espera, devolver, nueva dirección, remitente, abandono) usando `PUT api_giacenze_operations`; «Nueva dirección» exige dirección/CAP/ciudad y, al guardar, abre el mensaje al proveedor con texto prellenado.
5. **Instrucciones y notas internas** (dos cajas, con lápiz por grupo y guardado por grupo).
6. **Depósito y cargo:** días y cargo de reentrega editables; total calculado por el servidor (solo lectura, con detalle de `Giacenza_Pricing_Service`), «Copiar precio»; cargo bloqueado si hay postfacturación.
7. **Direcciones** (entrega actual y original) en columna lateral, no al final.
8. **Pestañas Mensajes / Operaciones** con contador y el historial de operaciones del API.
- `data_open` y `data_close` pasan a solo lectura (los fija el alta y la acción Cerrar); `giacenza_gg` (días de giacenza) sigue editable porque alimenta el cargo.

### Fase 3 — Mensajes y alta
- Ventana de mensaje única: destinatario prellenado (cliente / proveedor) y editable, plantilla GIAc/GIAf cargada, vista previa, estado del envío; errores visibles y el paso del ciclo se marca solo.
- Alta: selector de envío con búsqueda (no ID), evita duplicar una abierta, y **el aviso GIAc al cliente se envía siempre** (decisión 1): la pantalla lo indica con un texto previo («se avisará a …») y muestra después el estado del envío; no hay opción de crear sin avisar. El envío ya sale por `Docsstory_Service::create_and_dispatch` → cola RabbitMQ con el SMTP y remitente del partner titular del cliente.
- Acciones en bloque desde la lista: cerrar (consegnate) y cambiar esito, con resumen de errores por fila.

### Fase 4 — Calidad
- Capturar y mostrar errores en todas las acciones; confirmación en auto-cierre y alinear gating con el servidor.
- i18n en los 5 idiomas, tests (stores, colas, ciclo, cierre/reapertura), actualizar `pruebas-formularios/expediciones.md` (SHP-32..36).

## 4. Cambios de API necesarios
- Exponer `reopen` en `api_giacenze_operations` (el servicio existe).
- Ordenación en el listado; filtros de hitos ya existentes en el servidor (`cont_cliente`, `cont_fornitore`, `risp_cliente`...) para las colas.
- Validar el destinatario como email en `api_giacenze_message`.
- Una cola «consegnate da chiudere» (tracking entregado + abierta): hoy Jose_master la deduce en cliente; conviene un indicador del API.

## 5. Decisiones (cerradas) y hallazgos

1. **Aviso al cliente: siempre.** Alta manual y alta por tracking envían GIAc; el correo sale por el servicio de envío vía RabbitMQ con el partner correspondiente y sus credenciales (ya implementado en `Giacenza_Operations_Service::queue_giacenza_notification` y `Giacenza_Message_Service`). La SPA no ofrece «crear sin avisar».
2. **Fechas de hito: como en el legado.** No se editan a mano: `cont_cliente_data` al crear/avisar, `risp_cliente_data` al guardar la instrucción del cliente (`descriz`), `cont_fornitore_data` al enviar GIAf, `risp_cliente_data` a cero si la operación vuelve a A. Edición manual no expuesta en la ficha.
3. **Dirección nueva: como en el legado.** Se edita en la propia giacenza/envío conservando la original: al cambiar por primera vez se clona la dirección de entrega original (registro tipo V) y se muestra en una pestaña «Original» de solo lectura.
4. **Apertura automática por tracking: arreglada en el API.** `Tracknow_Giac` ya crea/reabre (commit `12f4e8605`, el análisis `ANALISIS_Y_PLAN.md` está desactualizado en este punto). Ahora además: avisa siempre al crear (se retiró el interruptor `auto_open_notify`) y solo actúa si el envío salió hace ≤ `giacenze.auto_open_max_age_days` (45 por defecto) para no mandar avisos por envíos viejos reprocesados. Sigue tras `giacenze.auto_open_from_tracking` (apagado): **activarlo en sandbox primero**. Tests: 47 OK.
5. **`giacenza_gg`** es un entero: los días de giacenza (máx. 7 en sandbox). Editable por el operador (como en el legado, que recalcula el importe al guardarlo) y alimenta el cargo vía `Giacenza_Pricing_Service`; no es un campo derivado de fechas, así que la Fase 2 lo deja **editable** y quita la etiqueta de «calculado».
6. **`giacy_op*` (legado): código muerto.** Es el motor genérico de formularios (`forms_nomi`/`forms_campi`) apuntando a «operaciones de giacenza» con un único estado Normal/Cancelado. En la BD no hay formulario `giacy_op` registrado (`forms_nomi` solo tiene `giacenze` = tabla `giacenze`), ni tabla de operaciones: las 5 operaciones (A, C, N, R, E) son el `enum` de `giacenze.operazione` (sandbox: 26 240 A, 6 939 C, 1 987 N, 1 100 R, 19 E; 54 abiertas). El «historial de operaciones» del API es una línea de tiempo calculada con las fechas de la propia fila. **No se migra.** Tampoco existe la tabla `_old` del legado (`CreaOldGc`): si se quiere historial de cambios hay que decidir un registro propio (ver riesgos).

### Riesgos abiertos
1. `data_open` es `DATE` (sin hora) mientras los hitos son `DATETIME`: la línea de tiempo no puede ordenar apertura frente a primer aviso el mismo día.
2. Sin historial de cambios por campo (el legado tenía `_old` y bitácora); decidir si se añade una tabla de auditoría.
3. Cierre y reapertura afectan a facturación (cargo postfacturado): probar solo en sandbox.
4. Encender la apertura automática envía correos reales a clientes: primero sandbox con `UPSTREAM_DENY_ACTIONS` y revisar destinatarios.

## 6. Orden y esfuerzo
Fase 1 (M) → Fase 2 (L) → Fase 3 (M) → Fase 4 (S, en paralelo). Fase 1 aporta la mayor mejora de acceso con menos riesgo y no requiere API.
