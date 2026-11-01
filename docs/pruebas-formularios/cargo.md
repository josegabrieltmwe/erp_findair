# Formularios de Cargo: casos de prueba

> **Estado:** borrador · **Última modificación:** 2026-11-01 · Generado por lectura de código (no se ejecutó nada). Parte de [plan-pruebas-formularios.md](../plan-pruebas-formularios.md). Las reglas de cada ficha salen del código citado; lo marcado «no determinado» no se pudo confirmar.

## Cargo (aéreo) · prefijo CGO

Resumen: 28 formularios inventariados en `web/apps/operations/src/modules/cargo` (rutas `/cargo/list`, `/cargo/new`, `/cargo/:id(\d+)`, `/cargo/home` y `/cargo/from-express`). `/cargo/from-express` (`pages/CargoFromExpressPage.vue`) es solo un aviso "no implementado" con enlace al legacy: no tiene formulario. El detalle del cargo es una sola pantalla (`pages/CargoDetailPage.vue` + `layouts/CargoDetailLayoutV2.vue`) que abre modales (`components/cargo/modals/*`) alojados en `CargoModals.vue`. Mayor riesgo: reserva/cancelación de reserva con el transportista (CGO-12, CGO-11), emisión e-AWB (CGO-27), envíos de correo a transportistas, agencias y cliente (CGO-09, CGO-16, CGO-18, CGO-19, CGO-20), cancelación del cargo (CGO-21), importes y cargos (CGO-08, CGO-17) y MAWB/HAWB (CGO-14, CGO-15).

Convenciones del módulo (comunes a varias fichas):
- Permisos en el front: el módulo NO usa `can()`, `is_admin` ni `requiresAdmin` (búsqueda sin resultados en `modules/cargo`). Los candados son (a) de estado del cargo, `composables/useCargoState.ts` (`giafatt` = factura emitida + AWB + fecha de entrega; `postFatturated`; `supplierInvoiced`) y (b) del servidor (`authz_rw('cargo')`, IDOR guard `Shipment_Access_Service`). Un perfil sin escritura en `cargo` recibe 403 del servidor, sin deshabilitar controles.
- Edición de campos: dos mecanismos. (1) Dentro de un `ModalWrapper` (→ `@shared/ui/FormModal`) se abre un "draft": `store.update()` acumula en `draftPatch` y `commitDraft()` valida (`validation/cargoRules.ts`) y hace un único `PATCH /unified_cargo_shipment?id=`. (2) Fuera de modal, `useFieldBinding` hace un `PATCH` por campo en `blur` (solo si cambia). Los importes con `useMoneyFieldBinding` van por `persistUpdate` (sin `validateDraft`).
- Respuesta del `PATCH`: `success:true` puede traer `ignored_fields` o `blocked_by_lock`; el front lo muestra como toast de aviso (`stores/cargo.store.ts` ~l. 104-128), no como error.
- `validation/cargoRules.ts` solo valida: importes y pesos >= 0, monedas de 3 letras, ids enteros >= 0. Sus mensajes están escritos en italiano fijo (no pasan por i18n).
- Servidor: `PATCH /unified_cargo_shipment` → `tmwe_api/controller/api/cargo/shipment_management/Cargo_Crud_Controller.php` → `Cargo_Booking_Service` (lista blanca de campos editables; `id_cliente`, `gestione`, `offerta`, `stato`, `otp`, `data_sped0` no editables).
- Seguridad de pruebas: cualquier caso que dispare reserva, cancelación de reserva, e-AWB, correo a transportista/agencia/cliente o solicitud de AWB va marcado "solo con UPSTREAM_DENY_ACTIONS activo" o "solo sandbox".

---

### CGO-01 · Alta de cargo (nuevo borrador)
- **Ruta/pantalla:** `/cargo/new` (`cargo-new`)  **Componente:** `pages/CargoNewPage.vue` (usa `@shared/detail/EntityNewPage.vue`, `packages/platform/detail/EntityNewPage.vue`)  **Envía:** `POST /unified_cargo_shipment` `{customer_id}` (`stores/cargo.store.ts` l. 150-155; id devuelto en `shipment_id`) y navega a `/cargo/{id}`.
- **Permisos:** servidor `authz_rw('cargo')`; `customer_id` obligatorio (`Cargo_Crud_Controller::handle_post`: 400/VALIDATION_ERROR si <= 0). Además fija `owner_user` con el usuario del token.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Cliente | autocompletado remoto (`anagraficaService.search`) | Sí (botón deshabilitado sin cliente: `canSubmit`) | Búsqueda solo con >= 2 caracteres (`EntityNewPage.vue` l. 170) |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CGO-01-01 | Alta feliz | Buscar "ab", elegir cliente existente, Crear | POST con `customer_id`, redirección a `/cargo/{shipment_id}`; el cargo nace en borrador (`gestione` N, sin AWB) | P1 | Auto |
| CGO-01-02 | Búsqueda con 1 carácter | Escribir "a" | No lanza búsqueda; lista vacía | P2 | Auto |
| CGO-01-03 | Crear sin seleccionar cliente | Texto escrito sin elegir opción | Botón Crear deshabilitado | P1 | Auto |
| CGO-01-04 | Cambiar de cliente tras elegir uno | Elegir A, luego borrar y elegir B | Se envía el id de B, no el de A (`selectedItem`, l. 154-169) | P1 | Auto |
| CGO-01-05 | Usuario externo/partner crea para otro cliente | Sesión partner, cliente ajeno | Servidor fuerza `customer_id` resuelto del token (log "anti-suplantacion") o 403; nunca crea para el cliente ajeno | P0 | Manual |
| CGO-01-06 | Cliente sin sede/partner | Cliente con `id_sedi_interna_fatt` vacío | El cargo se crea; sede/partner se rellenan por fallback del servidor (`Cargo_Crud_Controller` l. ~245) | P1 | Manual |
| CGO-01-07 | Doble clic en Crear | Dos clics rápidos | Un único cargo creado (flag `creating`) | P1 | Auto |

- **Riesgos / dudas:** no se pudo confirmar en `EntityNewPage.vue` que el botón se deshabilite durante `creating` (solo `canSubmit`); verificar creación duplicada.

---

### CGO-02 · Filtros avanzados del listado
- **Ruta/pantalla:** `/cargo/list`  **Componente:** `components/cargo/CargoFilterPanel.vue`  **Envía:** `GET /api_cargo_shipments` (`cargoListService.fetch`, `services/cargo.service.ts` l. 532) con los filtros en query; además un conteo previo (`per_page=1`) con debounce de 400 ms y cancelación.
- **Permisos:** lectura de `cargo`; alcance por partner en servidor.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| ID cargo | number, clearable | No | Sin min/max en el control |
| MAWB (`AWB_forn`) | text | No | — |
| Ref. cliente (`RIF_cliente`) | text | No | — |
| Cliente (`id_cliente`) | autocomplete remoto | No | Resuelve nombre al reabrir (`syncClienteSelection`) |
| Notas | text | No | — |
| Campo de fecha (`quale_data`) + Desde/Hasta | select + 2 date | No | `data_sped1` o `data_volo_partenza`; sin validación Desde <= Hasta |
| País + ámbito origen/destino (`paesex`, `cerca_pd`) | autocomplete + select | País requiere ámbito | Se envían solo juntos (`cargo_list.store.ts` l. 317-320); `cerca_pd` se vacía si no hay país (`localAsState`) |
| Terminal origen/destino | text/autocomplete | No | — |
| Aerolínea (`airline_code`) | text maxlength 3 | No | Mayúsculas al aplicar |
| Nº vuelo | text | No | — |
| Gestión (N/F/O), Oferta (A/R), Controlada (S/N), Entregada (S/N), Archivada (S/N) | select clearable | No | Valores cerrados (l. 560-575) |
| Tipo de mercancía, Tipo de vettore, Dazi | select/text | No | Enumerados fijos en el front ("conservative list" según comentario l. ~565) |
| Peso desde/hasta, Peso tasable | number | No | Sin validación desde <= hasta |
| Accesorios: seguro, hielo seco, mercancía peligrosa, palet | checkbox | No | Envía "S" solo si marcado |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CGO-02-01 | País sin ámbito | País "IT", ámbito vacío | `paesex` no se envía (requiere `cerca_pd`); el resultado no se filtra por país | P2 | Auto |
| CGO-02-02 | País con ámbito origen vs destino | IT + P, luego IT + D | Resultados distintos según origen/destino; chip de filtro activo refleja el ámbito | P2 | Auto |
| CGO-02-03 | Rango de fechas invertido | Desde 2026-05-10, Hasta 2026-05-01 | Listado vacío sin error 4xx (el front no valida); anotar si el servidor responde 400 | P2 | Auto |
| CGO-02-04 | Contador previo coincide con el aplicado | Componer 3 filtros, leer el número del botón, Aplicar | Total de la tabla == número del botón | P2 | Auto |
| CGO-02-05 | Tecleo rápido y cancelación | Escribir en MAWB 5 caracteres seguidos | Solo la última petición actualiza el contador; las anteriores se abortan | P2 | Auto |
| CGO-02-06 | Aerolínea en minúsculas | "lh" | Se envía "LH"; resultados de LH | P2 | Auto |
| CGO-02-07 | Limpiar | Con filtros activos, Limpiar | `cargoResetFilters`, página 1, panel cerrado, chips eliminados | P2 | Auto |
| CGO-02-08 | Peso desde > hasta o negativo | desde 100, hasta 10; desde -5 | Sin validación en cliente; comprobar respuesta del servidor | P2 | Auto |

- **Riesgos / dudas:** `tipo_merce` y `vettore_tipo` usan valores del front (DOC/NDC/SPL; intl/dom/express) que no se contrastaron con el servidor; `offerta` del filtro solo ofrece A/R mientras el estado del cargo tiene N/V/A/R (`CargoOfferteBox.vue`).

---

### CGO-03 · Barra del listado: fechas rápidas, vista, selección y acciones masivas
- **Ruta/pantalla:** `/cargo/list`  **Componente:** `pages/CargoListPage.vue` (+ `listing/cargo-work-views.ts`)  **Envía:** `GET /api_cargo_shipments`; acciones masivas `POST /api_cargo_archive` `{id:[...]}` y `POST /api_cargo_review` `{id:[...]}` (`cargoListService.bulkArchive/bulkControl`).
- **Permisos:** escritura en `cargo` (política `Cargo_Archive_Controller`); las acciones masivas aparecen solo si la vista de trabajo las declara (`hasBulkAction`): las tres vistas (standard, tracking, control) declaran `control` y `archive`.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Presets Hoy / 7 / 30 días | botones | No | `setDatePreset(n)` |
| Fecha desde / hasta | 2 `v-text-field type=date` clearable | No | Sin validación cruzada |
| Vista de trabajo | selector | No | Standard / Tracking / Control; por defecto según tipo de listado (`cargoDefaultWorkView`) |
| Tipo de listado, búsqueda libre | pestañas / input | No | `search` hace LIKE sobre `rag_soc` |
| Selección de filas | checkbox | — | Habilita acciones masivas |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CGO-03-01 | Archivar selección | Marcar 3 cargos, Archivar | `POST /api_cargo_archive` con 3 ids; toast de éxito (plural), selección vaciada, listado refrescado; los cargos pasan a archivada=S | P1 | Auto |
| CGO-03-02 | Archivar sin confirmación | Pulsar Archivar con 1 fila | El front ejecuta sin diálogo de confirmación (`onBulkArchive`, l. 1022); verificar si es el comportamiento deseado | P1 | Auto |
| CGO-03-03 | Marcar como controlados | Seleccionar 2, "Marcar controlados" | `POST /api_cargo_review`; ambos con `controllata=S` | P1 | Auto |
| CGO-03-04 | Error del servidor en masivo | Forzar 403 (perfil solo lectura) | Toast de error con `r.error`/mensaje; selección conservada | P1 | Auto |
| CGO-03-05 | Preset de fechas | Hoy / 7 días | `date_from`/`date_to` coherentes con la fecha del servidor; URL actualizada | P2 | Auto |
| CGO-03-06 | Cambio de vista de trabajo | Standard a Control | Columnas y acciones masivas según vista; la selección se conserva o se limpia de forma consistente | P2 | Auto |
| CGO-03-07 | Búsqueda por cliente desde la fila | Clic en nombre de cliente | Filtra por `id_cliente` (no por LIKE de `search`); `search` vaciado (l. 803-817) | P2 | Auto |

- **Riesgos / dudas:** el desmarcado/archivado masivo no pide confirmación ni deja deshacer en la UI (el filtro "Archivada" sí permite recuperarlos). No se verificó qué hace `set_archiviata` con cargos ya facturados.

---

### CGO-04 · Cliente, sede y referencia del cargo
- **Ruta/pantalla:** `/cargo/:id`, modal "Cliente" (`ui.openModal('cliente')`)  **Componente:** `components/cargo/modals/ClienteModal.vue` → `components/cargo/CargoClientHeader.vue`  **Envía:** `PATCH /unified_cargo_shipment?id=` `{id_cliente}` y `{RIF_cliente}` (draft del modal).
- **Permisos:** `readonly('id_cliente')` y `RIF_cliente` bloqueados con `giafatt` (`useCargoState.ts` l. 49-55).
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Cliente | autocomplete remoto (`@update:search`) | No (editable) | No cambia si el id es igual (l. 135) |
| Sede | solo lectura (`#id_sede`) | — | Se muestra, no se edita |
| Ref. cliente | text | No | `cargoRules` no la valida |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CGO-04-01 | Cambiar de cliente | Elegir otro cliente, Guardar | Se envía `id_cliente`; confirmar si realmente cambia o el servidor lo ignora | P0 | Auto |
| CGO-04-02 | Cargo facturado | Cargo con factura + AWB + entrega | Cliente y referencia en solo lectura | P0 | Auto |
| CGO-04-03 | Cancelar el modal con cambios | Cambiar referencia y cerrar | Aviso de cambios sin guardar; `discardDraft` restaura el valor | P1 | Auto |
| CGO-04-04 | Referencia con 255+ caracteres | Texto largo | Sin límite en cliente; respuesta del servidor (no determinado) | P2 | Auto |
| CGO-04-05 | Perfil partner | Cargo de otro partner | 403/404 del servidor; la ficha no abre | P0 | Manual |

- **Riesgos / dudas:** posible defecto: el servidor documenta que `id_cliente` NO es editable por `PATCH` (`tmwe_api/service/booking/Cargo_Booking_Service.php` ~l. 3929-3933 y 4033-4035, `Cargo_Crud_Controller.php` l. 34), pero el front lo envía (`CargoClientHeader.vue` l. 136). Resultado probable: toast "campos ignorados" y el cliente no cambia. A confirmar con la prueba CGO-04-01.

---

### CGO-05 · Direcciones del cargo (recogida, entrega, agencia, handler)
- **Ruta/pantalla:** `/cargo/:id`, modales `pickup`, `dest`, `agency`, `handler`  **Componentes:** `modals/PickupAddressModal.vue`, `DestAddressModal.vue`, `AgencyAddressModal.vue`, `HandlerAddressModal.vue` sobre `components/cargo/CargoAddressBlock.vue` (tipos P, D, A, H)  **Envía:** `POST /api_cargo_addresses_compat` (`cargoAddressesService.upsert`, "usar sede" = archivar fila P).
- **Permisos:** `isAddressLocked` (= `giafatt`) deshabilita los botones de cambio de origen; `isReadonly` bloquea campos.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Libreta (rúbrica) | autocomplete con debounce | No | Rellena el buffer; no guarda hasta "Guardar" |
| País ISO | autocomplete | No en el front | Al cambiarlo vacía CAP, ciudad, provincia y aeropuerto (`onCountryChange`) |
| Nombre/empresa, Dirección | text | No en el front | Solo el servidor/validación LDV los exige |
| CAP | text | No | Al salir del campo: busca ciudades y provincia (`lookupCap`, mínimo 3 caracteres) y chequea zona remota |
| Ciudad | combobox | No | Si el CAP da una sola ciudad se autocompleta |
| Provincia | select por país | No | El CAP la sobrescribe (paridad legacy) |
| Aeropuerto/terminal | select por país | No | Terminal de `cargo_terminals` |
| Atención, Teléfono, Móvil, Email | text | No | Sin formato validado |
| Origen: sede / dirección propia (solo recogida) | botones | — | "Usar sede" archiva la fila P inmediatamente (sin Guardar) |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CGO-05-01 | CAP de una única ciudad | País IT, CAP 20090 | Ciudad y provincia autocompletadas; sin diálogo | P1 | Auto |
| CGO-05-02 | CAP con varias ciudades | CAP ambiguo | Ciudad pasa a lista de sugerencias; provincia derivada | P1 | Auto |
| CGO-05-03 | Cambio de país con datos | Cambiar IT a ES con CAP y ciudad rellenos | CAP, ciudad, provincia y aeropuerto vacíos | P1 | Auto |
| CGO-05-04 | Origen: pasar de sede a dirección propia | "Usar otra dirección", rellenar, Guardar | Crea fila P; deja de heredar de sede; si no se guarda, no persiste nada | P1 | Auto |
| CGO-05-05 | Volver a sede | "Usar dirección de la sede" | Archiva la fila P de inmediato (sin pulsar Guardar) y recarga direcciones | P1 | Auto |
| CGO-05-06 | Zona remota | CAP marcado remoto | Aviso de zona remota (`useRemoteAreaCheck`) | P2 | Manual |
| CGO-05-07 | Cargo facturado | `giafatt` | Campos y botones de origen deshabilitados | P0 | Auto |
| CGO-05-08 | Guardar con dirección vacía | Todos los campos vacíos | Sin validación de obligatorios en cliente; observar respuesta del servidor y efecto en Validar LDV (faltan nombre, calle, ciudad, país) | P1 | Auto |

- **Riesgos / dudas:** el formulario no valida nada en cliente (nombre, calle, ciudad, país, email) y deja que `CGO-27` lo reporte después. "Usar sede" actúa sin pasar por Guardar, rompiendo el patrón de edición en buffer (`CargoAddressBlock.vue` l. 565-568).

---

### CGO-06 · Colli (desglose de bultos)
- **Ruta/pantalla:** `/cargo/:id`, modal `colli`  **Componente:** `components/cargo/CargoPackagesBox.vue` (`modals/ColliModal.vue`)  **Envía:** secuencia de `DELETE`/`PATCH`/`POST /api_cargo_packages` (una llamada por bulto, `store.savePackages`) y después `PATCH /unified_cargo_shipment {colli}`.
- **Permisos:** `isPackagesLocked` (= `giafatt`) deshabilita edición.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Nº de colli | number min=0 step=1 | No | Genera/recorta filas correlativas (`colliCount` setter); `Math.floor`, nunca negativo |
| Sistema métrico/imperial | conmutador local | — | Solo visual; el cliente define el valor inicial (`metric_imperial`) |
| Peso, Alto, Largo, Ancho por bulto | number min=0 step=0.1 | No en el front | Se guardan en métrico con 4 decimales |
| Apilable, Girable | checkbox | No | S/N |

Calculados: volumen por bulto (m3), peso total, peso tasable `max(peso real, volumen x coeficiente)` (coef. del cliente o 166,67 de respaldo).

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CGO-06-01 | Subir el contador | Colli de 0 a 3 | Aparecen 3 filas con `n_collo` 1..3 | P1 | Auto |
| CGO-06-02 | Bajar el contador | De 3 a 1 | Se recortan las filas de mayor número; al guardar se borran en servidor | P1 | Auto |
| CGO-06-03 | Guardar bulto con peso 0 | Fila nueva con peso 0 | El servidor rechaza el alta (`peso (weight) must be greater than 0`) porque el front no envía `allow_placeholder`; toast de error y recarga | P0 | Auto |
| CGO-06-04 | Cálculo volumétrico | 1 bulto 100x100x100 cm, 10 kg | Volumen 1 m3; tasable = 166,67 kg (coef. por defecto) | P0 | Auto |
| CGO-06-05 | Imperial a métrico | Cambiar a imperial, introducir 100 lb | Se persiste en kg (cerca de 45,36) | P1 | Auto |
| CGO-06-06 | Aviso de discrepancia de peso | Suma de bultos distinta del peso del envío en más de 0,01 | Alerta de aviso visible; no bloquea guardar | P1 | Auto |
| CGO-06-07 | Guardado parcial | Provocar fallo (red caída) en la 2.a llamada de 3 | Error, recarga de bultos desde servidor; estado intermedio posible (borrados ya hechos) | P0 | Manual |
| CGO-06-08 | Contador de cabecera | Tras guardar con 4 filas | `colli` del cargo se actualiza a "4" solo si difiere | P1 | Auto |
| CGO-06-09 | Cargo facturado | `giafatt` | Inputs, añadir, borrar y guardar deshabilitados | P0 | Auto |
| CGO-06-10 | Valores negativos o decimales en dimensiones | -5; 12,345678 | Mínimo HTML 0; redondeo a 4 decimales; el servidor rechaza negativos (`cannot be negative`) | P1 | Auto |

- **Riesgos / dudas:** (1) la persistencia no es atómica: primero borra, luego modifica/añade bulto a bulto (`stores/cargo.store.ts` l. 375-415); un fallo deja datos a medias. (2) Las filas nuevas con peso 0 (que el propio contador genera) fallarán en el alta: `Shipment_Packages_Service::validate_add_params` (l. 1056-1063) exige peso > 0 salvo `allow_placeholder`, y no hay `allow_placeholder` en ninguna parte del módulo cargo. (3) `v-model.number` con campo vacío produce "" y se guarda como 0.

---

### CGO-07 · Fechas, entrega, pesos extra y banderas del cargo
- **Ruta/pantalla:** `/cargo/:id` (cajas de detalle y modales `stato`, `delivery`)  **Componentes:** `CargoDatesBox.vue`, `CargoDeliveryBox.vue`, `CargoExtraWeightsBox.vue`, `CargoFlagsBox.vue`  **Envía:** `PATCH /unified_cargo_shipment?id=` (un PATCH por campo en `blur`, o por draft si están dentro de modal).
- **Permisos:** `readonly()` por estado: `data_sped0`, `data_sped1`, `pesor` con `giafatt`; `peso_fornit_reale` con proveedor facturado (`id_fattura_p`); `noiva_art9`/`controllata` con `giafatt`.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Creado (`data_sped0`) | text | — | Protegido en servidor (`PROTECTED_FIELDS`) |
| Fecha de salida (`data_sped1`), fecha corriere | date | No | Sin validación |
| Salida/llegada vuelo, entrega prevista | datetime-local | No | Sin validación de orden |
| Estado, fecha y firma de entrega | text libres | No | `consegna_data` es texto libre, no date |
| Peso real (`pesor`) | number | No | Solo lectura si hay pesaje desde bultos (`pesorLocked`) y si `giafatt`; >= 0 en `cargoRules` |
| Peso medido (`peso_reale`) | number readonly | — | Calculado |
| Peso proveedor, Coeficiente volumétrico, Días almacén | number | No | `peso_fornit_reale` >= 0 |
| Sin IVA art.9, Archivada, Recalcular con vuelo | switch | No | Envían S/N al instante |
| Verificada (`controllata`) | select | No | S/N |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CGO-07-01 | Peso real negativo en modal | -3 en `pesor`, Guardar | Toast "Peso reale: non puo essere negativo" (texto en italiano) y el modal sigue abierto | P1 | Auto |
| CGO-07-02 | Peso real negativo fuera de modal | -3 en la caja inline | No pasa por `validateDraft`; se envía al servidor (respuesta no determinada) | P0 | Auto |
| CGO-07-03 | Coeficiente volumétrico 0 o vacío | `coeff` = 0 | Observar recálculo del tasable (servidor protege `coeff <= 0`, `Cargo_Shipment_Update_Service` l. 705) | P1 | Manual |
| CGO-07-04 | Llegada anterior a salida | Salida 10/06 10:00, llegada 10/06 08:00 | Sin validación; comprobar si se guarda | P1 | Auto |
| CGO-07-05 | Cargo facturado | `giafatt` | `pesor` y `peso_fornit_reale` según candado; `controllata` deshabilitado | P0 | Auto |
| CGO-07-06 | Bandera "Recalcular con vuelo" | Activar | PATCH `ricalcola_volo`=S; el siguiente cambio de vuelo recalcula cargos | P1 | Manual |
| CGO-07-07 | `blur` sin cambios | Entrar y salir del campo | No se lanza PATCH (`same` en `useFieldBinding`, con normalización de ceros "250.0000") | P2 | Auto |
| CGO-07-08 | Fecha de entrega con texto no válido | "ayer" en `consegna_data` | Sin validación; observar error del servidor o guardado de valor inválido | P1 | Auto |

- **Riesgos / dudas:** `consegna_data` y `consegna_stato` son campos de texto libres para datos de fecha (`CargoDeliveryBox.vue` l. 14-31). El `cargoRules` valida solo si el cambio pasa por draft.

---

### CGO-08 · Importes: flujos de dinero, post-factura y seguro
- **Ruta/pantalla:** `/cargo/:id`, modales `costi`, `post_invoice`, `insurance`  **Componentes:** `CargoMoneyFlowsBox.vue`, `CargoPostInvoiceBox.vue`, `CargoInsuranceBox.vue` (+ `modals/CostiModal.vue`, `PostInvoiceModal.vue`, `InsuranceModal.vue`, `CurrencyDayModal.vue`)  **Envía:** `PATCH /unified_cargo_shipment?id=` (importes por `persistUpdate` en `blur`).
- **Permisos:** `readonly()`: `carico_export/import/volo` con `giafatt`; `costo_volo_reale` con proveedor facturado; `carico_extra`/`postfatt_txt` con post-factura (`id_fattura_a2 > 0`); `assicuraz_imp` y `id_valuta_assic` con `giafatt`. Servidor: `carico_lk=S` bloquea `carico_volo`, `costo_volo_previsto`, `carico_pickup`, `carico_delivery` (`PRICE_LOCKED`).
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Carga export/import/volo, coste previsto/real | number min=0 step=0.01 | No | Importes mostrados en la moneda destino del cliente y guardados en EUR (`useTargetCurrency`); historial por campo |
| Carga extra, texto post-factura | number / text | No | Bloqueados tras segunda factura |
| ID post-factura | text readonly | — | — |
| Valor asegurado, moneda del seguro | number + autocomplete ISO | No | `assicuraz_imp` >= 0, moneda de 3 letras si pasa por draft |
| Totales cobrados y margen | calculados | — | Margen en % |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CGO-08-01 | Cliente con moneda destino distinta de EUR | Cliente en USD, escribir 100 en carga volo | Se guarda el equivalente en EUR; al recargar se vuelve a mostrar 100 USD (sin doble conversión) | P0 | Manual |
| CGO-08-02 | Importe negativo | -50 en carga extra | HTML `min=0` solo orienta; comprobar si el servidor lo rechaza (no determinado: la ruta `persistUpdate` omite `cargoRules`) | P0 | Auto |
| CGO-08-03 | Cargo con bloqueo de precio | `carico_lk=S`, editar `carico_volo` | Respuesta `PRICE_LOCKED` / `blocked_by_lock`; toast de aviso con el nombre del campo; valor no cambia | P0 | Auto |
| CGO-08-04 | Margen | Carga total 1000, coste real 800 | Margen 200 (20,0 %) visible; verde si >= 0, rojo si < 0 | P1 | Auto |
| CGO-08-05 | Seguro con moneda inválida | "EURO" o "E1" | `cargoRules` rechaza en modal ("codice valuta ISO non valido") | P1 | Auto |
| CGO-08-06 | Cargo con factura de proveedor | `id_fattura_p > 0` | `costo_volo_reale` solo lectura | P0 | Auto |
| CGO-08-07 | Post-factura | Cargo con `id_fattura_a2 > 0` | `carico_extra` y texto post-factura solo lectura | P0 | Auto |
| CGO-08-08 | Historial por campo | Abrir historial de `carico_volo` | Lista de cambios (usuario y fecha) de `cargoAuditService.fieldHistory` | P2 | Auto |
| CGO-08-09 | Modal de divisas del día | Abrir "divisas", cambiar fecha | Ver CGO-28 | P2 | Auto |

- **Riesgos / dudas:** los importes que van por `persistUpdate` (en `blur`) se saltan la validación central: la regla "no negativos" de `cargoRules` solo actúa cuando el cambio pasa por `commitDraft`.

---

### CGO-09 · Aduanas y notificación a agencias
- **Ruta/pantalla:** `/cargo/:id`, modal `customs` (pestañas Aduanas / Notificar agencias)  **Componentes:** `CargoCustomsBox.vue`, `customs/CargoAgencyNotifyPanel.vue`, `customs/CustomsIstruzioniCard.vue`, `modals/CustomsModal.vue`  **Envía:** `PATCH /unified_cargo_shipment?id=` (campos de aduana); `POST /api_notification_trigger` `{type:'agency', entity_id, agency_type, recipients}` para notificar.
- **Permisos:** `customsStore.customsReadonly` (viene de `api_cargo_customs_box`) y `readonly()` de `giafatt`.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Valor en aduana (`dogana_imp`) | number | No | >= 0 (`cargoRules`) |
| Moneda (`id_valuta_dogana`) | autocomplete ISO | No | Lista de `api_currency_day`; 3 letras |
| Dazi (`cargo_dazi`) | select | No | DDP, DDU, DAP, EXW, FCA |
| Descripción aduana, Instrucciones | text/textarea | No | — |
| Export/Import requerido (`acc_export`, `acc_import`), Despacho OK (`sdoganam_E/I`) | switches | No | Envían S/N |
| Agencia export/import | autocomplete (lista por país del terminal) | No | "0" = ninguna; se guarda al elegir |
| Email broker export / adicional import | email | No | Sin validación de formato |
| Notificar: tipo (Ambas/Export/Import) | botones | Sí | Habilitado solo si hay email de la agencia seleccionada |
| CC | selector de destinatarios | No | Filtra los que contienen "@" |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CGO-09-01 | Cambio de terminal recarga agencias | Cambiar `terminal_dest` a otro país | Las listas de agencias se recargan por país (`fetchBox`) | P1 | Auto |
| CGO-09-02 | Quitar agencia | Vaciar el autocompletado | Se persiste "0" (columna int) | P1 | Auto |
| CGO-09-03 | Valor de aduana negativo | -10 | Rechazo en draft ("non puo essere negativo") | P1 | Auto |
| CGO-09-04 | Aduana bloqueada | `customsReadonly=true` o cargo facturado | Switches, agencias y emails deshabilitados; alerta "readonly_invoiced" | P0 | Auto |
| CGO-09-05 | Notificar solo export sin email | Agencia export sin email | Botón Enviar deshabilitado | P1 | Auto |
| CGO-09-06 | Notificar a agencias | Tipo Ambas con emails | `POST /api_notification_trigger`, toast, recarga de `data_mail_ag_export/import`. Solo sandbox (envía correo real) | P0 | Manual |
| CGO-09-07 | CC con direcciones no válidas | "abc", "a@b" | Se descarta lo que no lleve "@"; "a@b" pasa | P2 | Auto |
| CGO-09-08 | Email broker con formato inválido | "no-es-email" | Sin validación en cliente (type=email solo orienta); comprobar servidor | P1 | Auto |

- **Riesgos / dudas:** no hay validación de formato de email; el aviso de "ya notificada" solo se refleja por `data_mail_ag_*` (sin bloqueo de reenvío).

---

### CGO-10 · Servicio: vettore, terminales y handler
- **Ruta/pantalla:** `/cargo/:id`, modal `servizio` (y tarjeta de vuelos)  **Componentes:** `CargoVettoriBox.vue`, `CargoHandlerSection.vue`, `modals/ServizioModal.vue`  **Envía:** `PATCH /unified_cargo_shipment?id=`; `POST /api_cargo_handler_assign` ("copiar handler del vettore").
- **Permisos:** `readonly()`: `terminal_part/dest`, `vettore_sigla/nome/id`, `AWB_forn` con `giafatt`. El campo "Tipo vettore" no tiene candado en `useCargoState`.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Tipo vettore, Prefijo IATA, Nombre | text / diálogo selector de aerolínea | No | Selector `pickCarrier` |
| Terminal origen / destino | autocomplete por país (consulta remota `terminalsService.list`) | No | Servidor: código de 3 caracteres IATA y existente (`validate_terminal`, 400 `VALIDATION_ERROR`) |
| Tipo de mercancía, Incoterm | select | No | — |
| Handler / sede del handler | selects dependientes | No | La sede se carga al elegir handler |
| Límite cargo, entrega al handler, salida del handler | datetime-local | No | Sin validación de orden |
| Nota del handler | text | No | — |
| Copiar handler del vettore | botón | — | Pisa handler y sede actuales |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CGO-10-01 | Terminal inexistente | Escribir "ZZZ" | Servidor 400 "Terminal 'ZZZ' not found"; toast y valor no persistido | P1 | Auto |
| CGO-10-02 | Terminal con 2 o 4 letras | "MX" | Servidor: "Terminal code must be 3 characters" | P1 | Auto |
| CGO-10-03 | Elegir aerolínea del selector | Elegir LH | `vettore_sigla`, nombre y id se rellenan juntos | P1 | Auto |
| CGO-10-04 | Copiar handler del vettore | Pulsar | Handler y sede pasan a los del vettore; toast con resultado/nota; si no hay handler, error `copy_failed` | P1 | Manual |
| CGO-10-05 | Cambio de handler vacía la sede | Cambiar handler | La lista de sedes se recarga; sede previa no válida se descarta | P1 | Auto |
| CGO-10-06 | Cargo facturado | `giafatt` | Terminales y vettore en solo lectura | P0 | Auto |
| CGO-10-07 | Cambiar terminal con vuelo/tarifa asignados | Cambiar `terminal_dest` con tarifa elegida | Se guarda; la tarifa asignada puede quedar incoherente (comprobar aviso) | P0 | Manual |

- **Riesgos / dudas:** cambiar terminales o vettore no invalida ni avisa de la tarifa/reserva ya asignada (no hay lógica en `CargoVettoriBox.vue`). Fechas del handler sin validación de orden.

---

### CGO-11 · Búsqueda de vuelos y asignación de tarifa (asistente)
- **Ruta/pantalla:** `/cargo/:id`, modal `flight_search`  **Componentes:** `flight-search/CargoFlightSearch.vue`, `FlightSearchParams.vue`, `FlightFilters.vue`, `FlightSearchResultsTable.vue`, `FlightSelectionWizard.vue`, `useCargoFlightSearch.ts`, guarda previa `composables/useQuoteGuard.ts`  **Envía:** búsqueda por SSE (`flight_search.service.ts`, `include_courier=false`); asignación `store.selectRate` (endpoint en `cargo_flight_manager.store.ts`, no desglosado aquí).
- **Permisos:** cada fuente depende de las credenciales disponibles (`isSourceAvailable`); delegación de credenciales de otro partner solo si se marca.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Origen / Destino IATA | autocomplete (código o nombre) | Sí | Mayúsculas; se precargan de `terminal_part/dest` |
| Peso | number (precargado de `peso`/`pesor`) | Sí | Solo "truthy" |
| Fecha | date, `min` = hoy del servidor | Sí | Fecha pasada bloquea la búsqueda (`isDatePast`) |
| Fuentes (publicada, realtime, realtime directa, KLM, KLM quotes) | checkboxes | No (ninguna marcada por defecto) | Se envía exactamente lo marcado |
| Credenciales aplicables | checkboxes (si realtime y > 1 credencial) | No | `via_partner` solo si se acepta delegación |
| Filtros de resultados (escalas, horas de tránsito, etc.) | varios | No | Filtran en cliente |
| Asistente nivel 1 a 2 | botón Continuar + checkbox final | Checkbox obligatorio | Botón "Confirmar asignación" deshabilitado sin marcar |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CGO-11-01 | Fecha pasada | Fecha de ayer | Error de fecha, sin lanzar búsqueda | P1 | Auto |
| CGO-11-02 | Envío no cotizable | Cargo sin peso/bultos o sin dimensiones | `useQuoteGuard` abre `QuoteBlockedDialog` con los problemas traducidos por código; no abre la búsqueda | P1 | Auto |
| CGO-11-03 | Búsqueda sin ninguna fuente marcada | Todas desmarcadas | `canSearch` no exige fuente; probar si lanza una búsqueda vacía o error (ver Riesgos) | P1 | Auto |
| CGO-11-04 | Origen/destino iguales | MXP y MXP | Sin validación en cliente; respuesta del servidor/terminal | P1 | Auto |
| CGO-11-05 | Peso 0 o texto | "0", "abc" | "0" es cadena truthy y `Number("abc") || undefined` deja el peso sin enviar; comprobar 422 del servidor | P1 | Auto |
| CGO-11-06 | Fuente sin credencial | Fuente no disponible | Checkbox deshabilitado con motivo en rojo | P2 | Auto |
| CGO-11-07 | Asistente: dos niveles | Seleccionar tarifa, Continuar | Nivel 2 muestra asociación y checkbox; Confirmar deshabilitado hasta marcarlo; cambiar de tarifa reinicia al nivel 1 | P0 | Auto |
| CGO-11-08 | Asignar tarifa con reserva activa | Cargo con reserva viva, confirmar | Se envía `cancelBookingIfActive=true`: cancela la reserva actual contra el transportista; solo con UPSTREAM_DENY_ACTIONS activo | P0 | Manual |
| CGO-11-09 | Tarifa sobre petición / no asignable | Tarifa `bookable=false` o "on request" | Mensaje `rate_not_assignable` / `quote_on_request`; no asigna | P1 | Manual |
| CGO-11-10 | Tarifa sin `short_id` ni `pricing_snapshot_id` | Tarifa publicada sin `rate_id` | Mensaje de tarifa sin identificador válido; no asigna | P1 | Auto |
| CGO-11-11 | Detener búsqueda en curso | Cancelar durante el stream | Aborta SSE, fuentes pendientes pasan a estado final, sin toasts de error | P2 | Auto |

- **Riesgos / dudas:** (1) mensajes en italiano y español fijos en el código (`useCargoFlightSearch.ts` l. 536-566: "Selezione fallita", "Tariffa ... assegnata al cargo", "Annullamento prenotazione corrente…"). (2) La asignación con reserva activa la cancela de forma implícita; el asistente solo avisa con un texto (`FlightSelectionWizard.vue` l. 135-147), sin la casilla de reconocimiento explícita que sí tiene `ResetFlightsDialog`. (3) Búsqueda sin fuentes: no se encontró validación.

---

### CGO-12 · Reserva con el transportista: confirmar, detalle y cancelar
- **Ruta/pantalla:** `/cargo/:id`, tarjeta de vuelo y modales `booking_detail`, `booking_cancel`  **Componentes:** `flight-manager/BookingConfirmDialog.vue`, `CargoFlightManagerCard.vue`, `modals/BookingDetailModal.vue`, `modals/BookingCancelModal.vue`, `flight-manager/ResetFlightsDialog.vue`  **Envía:** `POST /api_cargo_booking` con `stage` = `book` | `cancel` | `simulate` (`unified_booking.service.ts`); estado/detalle por `GET`.
- **Permisos:** servidor: `deny_if_shipment_creation_vetoed()` en `book` (`Unified_Booking_Controller.php` l. 163); 409 si el carrier no soporta la etapa.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Origen del AWB | radio: transportista (por defecto) / stock propio / manual | Sí | "Pool" deshabilitado sin stock; pool preselecciona el que vence antes (FEFO) |
| AWB del stock | select | Si modo pool | Muestra caducidad |
| AWB manual | text | Si modo manual | Sin formato validado en cliente; `trim()` |
| Confirmar (botón) | — | — | Deshabilitado solo si `busy` o `rate.bookable===false` |
| Motivo de cancelación de la reserva | textarea | No | Texto libre; `trim()` |
| Aviso de cancelación tardía | alerta | — | Aviso, no bloqueo: < 24 h a la aceptación máxima (LAT) o ya pasada |
| Reset de vuelos: "borrar tramos manuales" y "reconozco la cancelación" | checkboxes | Reconocimiento obligatorio con reserva viva | `canConfirm` |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CGO-12-01 | Reserva con AWB del transportista | Modo "transportista", Confirmar | `POST stage=book` sin `awb_manual`; reserva creada y AWB asignado. Solo sandbox | P0 | Manual |
| CGO-12-02 | Modo manual con AWB vacío | Modo manual, campo vacío, Confirmar | El front no lo impide (solo `busy`/`bookable`); el servidor decide (400/422); evitar reserva real | P0 | Auto (con UPSTREAM_DENY_ACTIONS) |
| CGO-12-03 | Modo pool con stock vacío | Sin AWB en stock | Opción pool deshabilitada y alerta "no stock" | P1 | Auto |
| CGO-12-04 | AWB del pool ya tomado | AWB reservado por otro operador entre medias | Servidor responde ocupado; mensaje y recarga del stock | P0 | Manual |
| CGO-12-05 | Tarifa no reservable | `bookable=false` | Confirmar deshabilitado y alerta con el motivo | P1 | Auto |
| CGO-12-06 | Cancelación tardía | LAT en 5 h | Alerta amarilla "late_warning"; confirma igualmente. Solo sandbox | P0 | Manual |
| CGO-12-07 | Cancelación con LAT pasada | LAT hace 2 h | Alerta roja `past_deadline` | P0 | Manual |
| CGO-12-08 | Timeout del transportista al cancelar | `indeterminate=true` | Aviso "indeterminado", la reserva se mantiene en pantalla, sin reintento automático | P0 | Manual |
| CGO-12-09 | Reset de vuelos con reserva | Resetear vuelos con reserva viva | Pide casilla de reconocimiento; cancela reserva y libera AWB; recarga cargo. Solo sandbox | P0 | Manual |
| CGO-12-10 | Doble clic en Confirmar reserva | Dos clics seguidos | Una sola reserva (`busy`/`loading`) | P0 | Auto |
| CGO-12-11 | Resultado desconocido al reservar | `indeterminate` en `book` | No reintentar sin verificar; estado visible | P0 | Manual |
| CGO-12-12 | Texto de error de cancelación | Fallo del servidor | Toast con `store.error`; si falta, usa texto fijo italiano "Annullamento fallito" | P2 | Auto |

- **Riesgos / dudas:** `BookingConfirmDialog` permite confirmar en modo manual/pool sin valor (l. 98-108 del componente; `confirm()` envía `awbMode` sin `awbManual`). Cancelación de reserva tiene texto fijo en italiano (`BookingCancelModal.vue` l. ~153).

---

### CGO-13 · Tramos de vuelo manuales
- **Ruta/pantalla:** `/cargo/:id`, modal `flight_legs_manual`  **Componente:** `components/cargo/flight-manager/FlightLegsManualModal.vue`  **Envía:** `PATCH /unified_cargo_shipment?id=` con 25 campos (`flight_num{1..5}`, `flight_data{n}`, `flight_datad{n}`, `flight_airp{n}`, `flight_aird{n}`).
- **Permisos:** sin candado propio en el front; botón "Reset" abre `ResetFlightsDialog` (ver CGO-12).
- **Campos (5 tramos):**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Nº de vuelo | text | Tramo 1 en la práctica | Incluye código de aerolínea (p. ej. LH440); sin formato |
| Salida / Llegada | text libre (no date) | — | Sin formato ni orden validados |
| Origen / Destino IATA | text maxlength=3 | — | Pasa a mayúsculas al guardar |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CGO-13-01 | Dos tramos válidos | Tramo 1 completo y tramo 2 completo | Se guardan los 25 campos; modal cierra con toast; la tarjeta de vuelos los refleja | P1 | Auto |
| CGO-13-02 | Tramo 2 relleno con tramo 1 incompleto | Tramo 2 con nº de vuelo, tramo 1 sin destino | Toast "Leg 1 must be complete before leg 2" (texto fijo en inglés); no guarda | P1 | Auto |
| CGO-13-03 | Tramo con solo destino | Tramo 2 solo con destino IATA | No se considera "relleno" (solo comprueba nº, salida y origen): se guarda un tramo parcial | P1 | Auto |
| CGO-13-04 | Fechas en texto inválido | "mañana" | Sin validación; observar guardado/error del servidor | P1 | Auto |
| CGO-13-05 | Llegada anterior a la salida | Salida 12:00, llegada 08:00 | Sin validación | P1 | Auto |
| CGO-13-06 | Tramos vacíos | Dejar todo vacío y guardar | Envía cadenas vacías para los 25 campos; verificar que no escribe fechas `0000-00-00` incoherentes | P1 | Auto |
| CGO-13-07 | Cancelar con cambios | Editar y cerrar | Aviso de cambios sin guardar (draft del modal) | P2 | Auto |

- **Riesgos / dudas:** fechas como texto libre (`FlightLegsManualModal.vue` l. 27-45) y mensajes fijos en inglés; `validateOrder` no comprueba coherencia temporal.

---

### CGO-14 · MAWB (formulario por pestañas, confirmación y TACT)
- **Ruta/pantalla:** `/cargo/:id` (pestaña MAWB) y modal `mawb`  **Componentes:** `mawb/CargoMawbFormV2.vue` con `tabs/MawbIdentityTab.vue`, `MawbAddressesTab.vue`, `MawbGoodsTab.vue`, `MawbChargesTab.vue`, `MawbSignatureTab.vue`, `MawbAddressBlock.vue`, `MawbTactField.vue`, `MawbTagInserter.vue`, `modals/MawbModal.vue`  **Envía:** `PATCH /api_cargo_mawb?cargo_id=` (un PATCH por campo en `blur`, serializados en cola, `stores/cargo_mawb.store.ts`); `POST /api_cargo_mawb_confirmation`; `POST /api_cargo_tact_update`; `POST /api_cargo_mawb_agent`.
- **Permisos:** bloqueo pre-impresión: todo el formulario se deshabilita desde 24 h antes de la salida del primer tramo (`isPrePrintLocked`, `flight_data1`); el número AWB es solo lectura con reserva viva (`awb_locked`); servidor devuelve 409 `awb_locked_by_booking`.
- **Campos (principales):**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Nº AWB | text + selector de stock | No | Servidor: formato canónico "074-45686292" solo con 11 dígitos; "ya asignado a otro envío" → `awb_taken`; sin comprobación de dígito de control detectada |
| Código IATA del agente, lugar de emisión, transportista emisor | text | No | — |
| Expedidor / Consignatario / Notify (9 campos cada uno) | `MawbAddressBlock` (rúbrica, copiar de) | No | PATCH por campo o por bloque (lote de copia) |
| Descripción mercancía, descripción manifiesto, SSR, OSI, Handling SCI | textarea/text + insertador de frases | No | Los inserts añaden con separador, sin dejar coma inicial |
| Tarifa TACT, cargo mínimo TACT | number + botón de consulta | No | La consulta TACT puede devolver `TACT_NO_RATE` |
| As agreed (`rated_as_agreed`), WVC, other charges | switch / text | No | S/N |
| Valor declarado transporte / aduana, contabilidad, notas internas | text | No | — |
| Otros cargos 1-8 (etiqueta, A/C, importe) | combobox + select + number | No | Importe numérico |
| Firma: emisor, agente, fecha | text / date | No | — |
| Fijar partner del terminal | botón + confirmación | — | Sobrescribe 5 campos de agente en master y en cada house |
| Confirmar MAWB | botón | — | Solo visible si la pasarela permite (`confirmation_allowed`) |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CGO-14-01 | Asignar AWB manual válido | "074-45686292" | PATCH con `awb_number`; servidor guarda en el cargo, libera el anterior e historiza | P0 | Auto |
| CGO-14-02 | AWB ya usado por otro envío | AWB de otro cargo | 4xx con `awb_taken`; toast y valor del draft se mantiene | P0 | Auto |
| CGO-14-03 | AWB con reserva viva | Cargo con reserva en transportista | Campo en solo lectura con candado; un PATCH directo devuelve 409 `awb_locked_by_booking` | P0 | Auto |
| CGO-14-04 | AWB con formato incorrecto | "123", "ABC-1" | Sin validación visible en cliente; observar respuesta | P0 | Auto |
| CGO-14-05 | Bloqueo pre-impresión | Salida del tramo 1 en < 24 h | Todos los campos deshabilitados | P0 | Auto |
| CGO-14-06 | Guardado por `blur` solo si cambia | Entrar/salir sin cambiar | Sin petición; marca de "sin guardar" desaparece | P2 | Auto |
| CGO-14-07 | Ráfaga de ediciones | Editar 3 campos rápido | Peticiones en orden; sin que una respuesta pise otro campo | P1 | Auto |
| CGO-14-08 | Rellenar bloque desde rúbrica | Elegir contacto en Expedidor | Un solo PATCH por bloque (lote); campos cargados | P1 | Auto |
| CGO-14-09 | TACT sin tarifa | Consultar ruta sin tarifa | Error `TACT_NO_RATE` con aerolíneas disponibles; no cambia la tarifa | P1 | Manual |
| CGO-14-10 | Fijar partner del terminal | Confirmar el diálogo | Se pisan los 5 campos del agente en master y houses; cargo recargado | P0 | Manual |
| CGO-14-11 | Confirmar MAWB | Pulsar Confirmar | `POST /api_cargo_mawb_confirmation`; botón pasa a "Confirmado" deshabilitado; segunda confirmación → 409 | P0 | Manual |
| CGO-14-12 | Otros cargos | Etiqueta + opción A/C + importe | Se guarda `oth_crg_*_n`; importe no numérico se ignora/vacía | P1 | Auto |
| CGO-14-13 | Error de guardado conserva el texto | Forzar error | Toast de error y el borrador permanece en pantalla | P1 | Auto |

- **Riesgos / dudas:** (1) la cadena de validación del AWB (dígito de control módulo 7) no aparece en el servidor al fijar el número (`Awb_Service::set_cargo_awb_number`, solo `to_storage_format`). (2) Importes de otros cargos sin límites ni validación. (3) La confirmación MAWB no pide confirmación adicional en el front.

---

### CGO-15 · HAWB (lista y formulario de house AWB)
- **Ruta/pantalla:** `/cargo/:id`, modales `hawb_list` y `hawb_form`  **Componentes:** `modals/HawbListModal.vue`, `modals/HawbFormModal.vue`, `CargoHawbList.vue`, `CargoHawbListV2.vue`  **Envía:** `POST /api_cargo_hawb?cargo_id=` (crear), `PATCH /api_cargo_hawb` (por campo), `DELETE` (servicio existe), `GET /api_awb_documents?type=hawb` (imprimir).
- **Permisos:** servidor: `Awb_Service::create_awb` exige cargo modificable ("flight has departed").
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Nuevo HAWB | botón | — | Crea con `{awb_number: ""}` |
| Express vinculado (`id_spediz`) | number | Sí en servidor | `toNum`: vacío o no numérico → null |
| Peso house | number step 0.01 | No | idem |
| Expedidor / Consignatario / Notify | `MawbAddressBlock` | No | PATCH por campo |
| Descripción, manifiesto, SSR, OSI, WVC, notas internas | textarea/text | No | PATCH en `change` |
| As agreed | switch | No | S/N |
| Otros cargos 1-8 | combobox + select + number | No | importe vía `toNum` |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CGO-15-01 | Crear HAWB desde "Nuevo" | Pulsar Nuevo HAWB | El front envía solo `awb_number:""`; el servidor exige `id_spediz` para house (422 `validation_error`); comprobar si el alta funciona o falla (ver Riesgos) | P0 | Auto |
| CGO-15-02 | Vincular express | Asignar `id_spediz` válido | PATCH ok, fila actualizada | P1 | Auto |
| CGO-15-03 | `id_spediz` inexistente o de otro cliente | id arbitrario | Observar respuesta del servidor (acceso/validez no determinado) | P0 | Manual |
| CGO-15-04 | Peso house con coma/negativo | "1,5" ; "-2" | "1,5" no numérico → null; "-2" se envía (sin validación en cliente) | P1 | Auto |
| CGO-15-05 | Cargo con vuelo ya despegado | Cargo no modificable | Servidor rechaza con "Cargo is not modifiable"; toast de error | P0 | Auto |
| CGO-15-06 | Editar con estado de guardado | Escribir en un campo y salir | `saving` deshabilita todo el formulario durante cada PATCH (campos con `:disabled=store.saving`) | P2 | Auto |
| CGO-15-07 | Imprimir HAWB | Botón impresora de la fila | Abre PDF del house concreto (`awb_id`) | P1 | Manual |
| CGO-15-08 | Abrir edición sin tener cargadas las filas | Primera apertura | Carga filas del store antes de abrir; no se queda en "skeleton" | P2 | Auto |
| CGO-15-09 | Otros cargos A/C | Elegir "Agente" y 20,00 | Se guarda `oth_crg_opz_n` y valor | P1 | Auto |

- **Riesgos / dudas:** posible defecto de alta: `HawbListModal.vue` l. ~101 crea el house con `{awb_number: ""}` sin `id_spediz`, y `Awb_Service::validate_create_data` (l. 374-376) rechaza house sin `id_spediz` con 422. Podría explicar "Nuevo HAWB no hace nada"; verificar en integración. Además, no hay botón de borrar HAWB en la UI aunque el servicio y el store lo implementan (`cargo_hawb.service.ts` l. 56, `cargo_hawb.store.ts`).

---

### CGO-16 · Solicitar números AWB a la aerolínea y reservar del stock
- **Ruta/pantalla:** `/cargo/:id` pestaña MAWB (selector de stock desde el campo AWB)  **Componentes:** `awb/CargoAwbRequestDialog.vue`, `awb/CargoAwbStockPicker.vue`  **Envía:** `POST /api_cargo_awb_request` `{id_vettore, partner_id, qty, note, extra_to, force}`; `POST /api_cargo_awb_vettori_set` `{cargo_id, id_vettore, awb}`.
- **Permisos:** `authz` de cargo; el destinatario viene de la ficha del vettore.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Cantidad | number min=0 max=1000 (valor por defecto 50) | No | Servidor: 0-1000, si no 400 `VALIDATION_ERROR` ("qty out of range"); `qty || 0` |
| Destinatarios adicionales | combobox multiple chips | Sí si la ficha no tiene email | El botón se habilita con ficha o al menos un extra; el servidor filtra con `FILTER_VALIDATE_EMAIL` |
| Nota | textarea | No | Va en el texto del correo |
| Enviar / "enviar igualmente" | botón | — | `force` solo tras un 429 |
| AWB del stock | lista (picker) | Sí al elegir | Reserva descuenta del pool |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CGO-16-01 | Petición válida | Cantidad 50, vettore con email | Correo encolado; diálogo se cierra y emite `sent` (`used_fallback` si no hay plantilla). Solo sandbox | P1 | Manual |
| CGO-16-02 | Sin email de ficha ni extras | Vettore sin mail | Alerta de "sin destinatario" y botón deshabilitado | P1 | Auto |
| CGO-16-03 | Enfriamiento de 7 días | Segunda petición al mismo vettore | 429 `COOLDOWN_ACTIVE`: el diálogo no se cierra, muestra fecha y días y el botón pasa a "enviar igualmente" (ámbar) | P1 | Manual |
| CGO-16-04 | Forzar tras cooldown | Pulsar "enviar igualmente" | Reenvía con `force:true`; correo enviado. Solo sandbox | P1 | Manual |
| CGO-16-05 | Cantidad fuera de rango | -1 ; 1001 | Servidor 400; el control permite escribirlo (min/max solo HTML); mensaje visible | P1 | Auto |
| CGO-16-06 | Extra con email inválido | "no-mail" | El combobox lo acepta; el servidor lo descarta; si es el único destinatario, comprobar el error | P1 | Auto |
| CGO-16-07 | Reapertura | Cerrar y reabrir | Formulario limpio (qty=50, nota vacía, `cooldownInfo=null`) | P2 | Auto |
| CGO-16-08 | Reservar AWB del stock | Elegir un número | `awb_vettori_set`: descuenta stock, libera el AWB previo, historiza; el campo AWB del MAWB se actualiza | P0 | Auto |
| CGO-16-09 | AWB ya reservado por otro | Dos operadores eligen el mismo | El segundo recibe error; stock se relee | P0 | Manual |

- **Riesgos / dudas:** el combobox de destinatarios no valida email en el front.

---

### CGO-17 · Cargos del cargo (voces de coste) y cálculo
- **Ruta/pantalla:** `/cargo/:id` modal `costi` / pestaña cargos  **Componentes:** `charges/CargoChargesTableV2.vue` (tabla editable + diálogo de alta), `CargoChargeDetailsTable.vue` (detalle con recálculo), `CargoMoneyFlowsBox.vue` (ver CGO-08)  **Envía:** `POST/PATCH/DELETE /api_cargo_shipment_charges` (voces) y `GET/POST/PATCH/DELETE /api_cargo_charge_details` con `recalculate` / `api_cargo_profit`.
- **Permisos:** la tabla V2 no usa `readonly()` ni `giafatt` (no hay candado por factura en el front); en `CargoChargeDetailsTable` las filas `tipo='V'` tienen el toggle deshabilitado.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Tipo (`tipo`), unidad (`kg`/`box`/`fix`) | selects | Sí por defecto ("S"/"fix") | — |
| Código, descripción | text | No en el front | — |
| Coste unitario / mínimo / máximo | number step 0.01 | No | Valor por defecto 0; sin min en el control |
| Incluir en total (`somma`) | switch | No | S/N; el servidor hace toggle y recalcula |
| Eliminar | botón con `window.confirm` | — | Confirmación nativa |
| Recalcular / recomputar precio por kg | botones | — | Encadenado tras cada edición |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CGO-17-01 | Añadir cargo válido | tipo S, fix, coste 25,50, incluir | Fila creada; total del cargo recalculado | P0 | Auto |
| CGO-17-02 | Añadir con importes negativos | coste_unit -10 | Sin validación en cliente; comprobar el servidor | P0 | Auto |
| CGO-17-03 | Añadir sin código ni descripción | Dejar vacíos | Se permite en el front; observar | P1 | Auto |
| CGO-17-04 | Mínimo mayor que máximo | min 100, max 10 | Sin validación | P1 | Auto |
| CGO-17-05 | Editar importe y recalcular | Cambiar coste y salir del campo | PATCH + recálculo + recarga de cargo (`carico_volo`/`costo_volo_previsto` en cabecera) | P0 | Auto |
| CGO-17-06 | Cargo con bloqueo de precio (`carico_lk=S`) | Editar voces | Comprobar si el recálculo respeta el bloqueo (`PRICE_LOCKED`) | P0 | Manual |
| CGO-17-07 | Cargo facturado | `giafatt` | La tabla V2 sigue editable en el front; el servidor decide (ver Riesgos) | P0 | Auto |
| CGO-17-08 | Quitar cargo | Eliminar y cancelar el confirm | No se borra; con aceptar, borrado y recálculo | P1 | Auto |
| CGO-17-09 | Toggle "incluir" en fila V | Fila `tipo=V` | Control deshabilitado | P1 | Auto |
| CGO-17-10 | Recomputar precio por kg | Pulsar | Toast con precio anterior y nuevo y peso tasable; o aviso "sin cambios" | P1 | Manual |

- **Riesgos / dudas:** sin `readonly()`: ni la alta ni la edición de cargos se bloquean para cargos facturados en el front (`CargoChargesTableV2.vue`); no se verificó el bloqueo equivalente en `Cargo_Charges_Crud_Controller` (solo se ve 400/404/403).

---

### CGO-18 · Ofertas de transportistas: RFQ, respuesta y adjudicación
- **Ruta/pantalla:** `/cargo/:id` modal `cotizacion` (pestaña "carriers")  **Componentes:** `offers/CargoOffersTable.vue`, `modals/CotizacionModal.vue`, `CargoQuoteMenu.vue`  **Envía:** `POST /api_cargo_offers` (distribuir RFQ), `PUT` (editar/aceptar), `DELETE`.
- **Permisos:** `authz` de cargo.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| RFQ: transportistas | autocomplete múltiple | Sí (botón deshabilitado sin ninguno) | Lista del cargo (`vettoriService.listCarriers`) |
| RFQ: nota, ficheros adjuntos | textarea, selector múltiple (ficheros "ext") | No | — |
| Fila: coste, moneda, valoración | number / select | No | PATCH inline |
| Responder: coste, moneda, fecha de respuesta, texto, horario, marcar controlada | number, select, datetime-local, text, switch | No | `data_risp` convierte "T" a " " y añade ":00" |
| Adjudicar (ganadora) | diálogo de confirmación | — | Estado "ganadora" (`accettata=S`) |
| Eliminar oferta | `window.confirm` | — | — |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CGO-18-01 | Enviar RFQ a 2 transportistas | Elegir 2, nota, adjuntar 1 fichero, Enviar | Se crean 2 ofertas y se envían correos. Solo sandbox | P0 | Manual |
| CGO-18-02 | RFQ sin transportistas | Ninguno | Botón de enviar deshabilitado | P1 | Auto |
| CGO-18-03 | Registrar respuesta | Coste 1250,5, EUR, fecha | Estado "respondida"; fecha almacenada con segundos ":00" | P1 | Auto |
| CGO-18-04 | Respuesta con coste vacío o NaN | Coste vacío | No se envía `costo`; se registra solo el resto | P1 | Auto |
| CGO-18-05 | Adjudicar ganadora | Confirmar en diálogo | Una sola oferta con estado ganadora; las demás pasan a bloqueadas (`controllata=X`); efectos en precio/vettore del cargo no determinados | P0 | Manual |
| CGO-18-06 | Doble clic en Adjudicar | Dos clics | Una sola adjudicación (`accepting`) | P0 | Auto |
| CGO-18-07 | Editar oferta bloqueada | Fila "bloqueada" | Comprobar si los inputs quedan deshabilitados (no aparece candado por estado en el grep) | P1 | Auto |
| CGO-18-08 | Eliminar oferta | Cancelar/aceptar el confirm | Sin borrar / borra con refresco | P1 | Auto |
| CGO-18-09 | Coste negativo en una oferta | -100 | Sin validación en cliente | P1 | Auto |

- **Riesgos / dudas:** efectos de "aceptar ganadora" sobre el cargo no verificados (`Cargo_Offer_Controller.php`). Envío real de RFQ a transportistas.

---

### CGO-19 · Oferta al cliente (estado, notas y envío)
- **Ruta/pantalla:** `/cargo/:id` modal `cotizacion` (pestaña "client")  **Componente:** `components/cargo/CargoOfferteBox.vue` (usa `EmailComposer` de `@shared/email`)  **Envía:** `POST /api_cargo_client_offer` con `action: status | text | send` (`client_offer.service.ts`).
- **Permisos:** `authz` de cargo; el campo "gestión" es solo lectura en la UI.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Gestión | select readonly | — | N/F/O; pasa a O tras enviar |
| Estado de la oferta | select (N, V, A, R) | No | Se guarda al cambiar; si falla, restaura el valor |
| Notas de la oferta | textarea | No | Texto plano → HTML con `<br>` al guardar (`plainToHtml`) |
| Destinatarios del cliente | catálogo + manuales | Sí (al menos uno) | Idioma ITA/ENG/SPA/FRA, vista previa, CC (filtra por "@") |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CGO-19-01 | Marcar oferta aceptada | Estado A | `action=status`; toast; `offerta` = A | P0 | Auto |
| CGO-19-02 | Fallo al cambiar estado | Forzar 403 | Toast de error y el select vuelve al valor anterior | P1 | Auto |
| CGO-19-03 | Notas con saltos de línea | Dos líneas | Se guardan con `<br>`; al recargar se muestran con salto | P1 | Auto |
| CGO-19-04 | Notas con `<b>` o `&` | Escribir `a<b>b` | `plainToHtml` no escapa; el HTML llega al correo del cliente tal cual, y al releer `htmlToPlain` lo borra de la vista (comprobar inyección en correo y pérdida de texto) | P0 | Auto |
| CGO-19-05 | Enviar sin destinatarios | Ninguno | Error "no_eligible_contacts"; no envía | P1 | Auto |
| CGO-19-06 | Enviar a contacto de catálogo + email manual | 1 + 1 | Se envían `contact_ids` y `extra_emails`; gestión pasa a O; el cargo se recarga. Solo sandbox | P0 | Manual |
| CGO-19-07 | Vista previa por idioma | Cambiar ITA a ENG | La vista previa cambia de idioma | P2 | Manual |
| CGO-19-08 | Cliente sin contactos elegibles | Cliente sin contactos | Lista vacía; solo manuales | P1 | Auto |

- **Riesgos / dudas:** `plainToHtml` (`CargoOfferteBox.vue` l. ~131-140) solo reemplaza saltos de línea; no escapa `<`, `>` ni `&`. El texto del operador se interpreta como HTML en el correo.

---

### CGO-20 · Envío de documentos AWB por correo
- **Ruta/pantalla:** `/cargo/:id` (menú de documentos, modal `email_document`)  **Componente:** `modals/EmailDocumentModal.vue` (usa `EmailComposer`); documentos: MAWB, HAWB, Manifest, Pouch, listas de colli  **Envía:** `POST /api_awb_email` `{cargo_id, type, awb_id, recipients, cc, subject, body_html, mode}`.
- **Permisos:** servidor: `AUTH_REQUIRED` 401, `VALIDATION_ERROR` 400, `ACCESS_DENIED` 403.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| HAWB a enviar | select | Sí si tipo = hawb o hawb_colli | Preselecciona si solo hay uno; error "select_hawb_first" |
| Modo de envío | radio: enlaces (por defecto) / adjunto | Sí | — |
| Destinatarios | catálogo (`api_cargo_mawb_share_recipients`) + manuales | Sí | El front filtra los que contienen "@" |
| CC | manuales | No | idem |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CGO-20-01 | MAWB por enlaces | 1 destinatario, modo enlaces | Correo en cola con enlaces firmados; toast "enviado". Solo sandbox | P0 | Manual |
| CGO-20-02 | HAWB sin elegir house | Tipo hawb, ninguno elegido | Error "select_hawb_first" sin enviar | P1 | Auto |
| CGO-20-03 | Cargo sin HAWB y tipo hawb | Sin houses | Pista "no_hawb_hint"; no se puede enviar | P1 | Auto |
| CGO-20-04 | Sin destinatarios válidos | Solo "texto" sin "@" | Error "no_contacts"; no envía | P1 | Auto |
| CGO-20-05 | Modo adjunto | Cambiar a adjunto | Se envía `mode=attachment`; documento adjunto. Solo sandbox | P1 | Manual |
| CGO-20-06 | Se reinicia al reabrir | Reabrir | Modo = enlaces, HAWB sin seleccionar | P2 | Auto |
| CGO-20-07 | CC con direcciones | 2 CC | Se envían en `cc` | P2 | Manual |

- **Riesgos / dudas:** `supportsNote=false`, `supportsPreview=false`: el asunto y el cuerpo no se editan (se envían vacíos). Validación de email mínima (`includes("@")`).

---

### CGO-21 · Cancelar cargo
- **Ruta/pantalla:** `/cargo/:id`, menú overflow de la cabecera, modal `cancel_cargo`  **Componente:** `modals/CancelCargoModal.vue`  **Envía:** `POST /api_cargo_cancel` `{cargo_id, reason}` y navega a `/cargo/list`.
- **Permisos:** servidor `authz_rw('cargo')` + acceso al cargo (403 `ACCESS_DENIED`).
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Motivo | textarea rows=3 | No | Servidor trunca a 500 caracteres sin avisar; añade "[CANCEL fecha] motivo" a `note_interne` |
| Cancelar cargo (botón) | — | — | Solo se deshabilita si no hay id |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CGO-21-01 | Cancelación con motivo | Motivo "duplicado" | `stato='O'`; `note_interne` con marca y motivo; cascada a giacenze/crm; navega al listado | P0 | Auto |
| CGO-21-02 | Sin motivo | Vacío | Se cancela sin tocar `note_interne` | P0 | Auto |
| CGO-21-03 | Motivo de más de 500 caracteres | 600 caracteres | Se trunca a 500 sin aviso | P2 | Auto |
| CGO-21-04 | Ya cancelado | Cargo con `stato=O` | Éxito idempotente "already cancelled" | P1 | Auto |
| CGO-21-05 | Cargo con reserva activa o AWB emitido | Reserva viva | El endpoint no consulta ni cancela la reserva en el transportista; comprobar cómo se comporta (ver Riesgos). Solo con UPSTREAM_DENY_ACTIONS | P0 | Manual |
| CGO-21-06 | Cargo facturado | Con factura | El endpoint no comprueba facturación; confirmar | P0 | Manual |
| CGO-21-07 | Sin permiso | Perfil de solo lectura / partner ajeno | 403 `ACCESS_DENIED`; modal sigue abierto con error | P0 | Auto |
| CGO-21-08 | Doble clic en confirmar | Dos clics | Una sola cancelación (`loading`) | P0 | Auto |
| CGO-21-09 | Fallo de red | Forzar error | Toast de error; sin navegar | P1 | Auto |

- **Riesgos / dudas:** `Cancel_Controller` (`tmwe_api/controller/api/cargo/action/Cancel_Controller.php`) solo hace `stato='O'` + cascada; no comprueba factura, AWB emitido ni reserva viva con el transportista (que seguiría activa). No hay segundo nivel de confirmación en la UI más allá del botón rojo.

---

### CGO-22 · Declaración de mercancías peligrosas (DGR)
- **Ruta/pantalla:** `/cargo/:id`, diálogo `dgr`  **Componente:** `components/cargo/dgr/DgrDeclarationDialog.vue` (+ `UnSubstanceAutocomplete.vue`)  **Envía:** `POST /api_shipment_dgr` `{shipment_id, is_cargo:'S', declarations[]}` (reemplaza el conjunto); catálogo `GET /api_dgr_substances?op=search`.
- **Permisos:** no determinado en el front.
- **Campos (por sustancia, repetibles):**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Sustancia UN | autocomplete de catálogo | Sí (todas las filas) | Hereda UN, nombre, clase, grupo de embalaje (solo lectura) |
| Modo de transporte | select FR / LQ / EQ | Sí (por defecto FR) | — |
| Cantidad | number min=0 | No en el front | LQ: aviso si supera el máximo por bulto |
| Unidad | select KG / L, clearable | No | — |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CGO-22-01 | Guardar una sustancia FR | UN3480, FR, 5 KG | `POST` con 1 declaración; toast; cierra | P0 | Auto |
| CGO-22-02 | Cantidad LQ superior al máximo | Sustancia con máximo por bulto, LQ, cantidad mayor | Aviso en la fila y Guardar deshabilitado | P0 | Auto |
| CGO-22-03 | LQ en declaración ya existente | Reabrir una declaración guardada con exceso | El aviso no se calcula (el límite solo se carga al elegir en esta sesión); el servidor rechaza con error por fila | P0 | Auto |
| CGO-22-04 | Fila sin sustancia | Añadir fila vacía | Guardar deshabilitado (`canSave`) | P1 | Auto |
| CGO-22-05 | Quitar todas las filas | Eliminar la última fila y guardar | Se envía conjunto vacío (reemplaza): borra todas las declaraciones | P0 | Auto |
| CGO-22-06 | Cantidad negativa o sin unidad | -1 ; 5 sin unidad | `min=0` solo HTML; el servidor no exige unidad (no determinado) | P1 | Auto |
| CGO-22-07 | Error por fila del servidor | Modo inválido forzado | Toast con `error`; sin cerrar | P1 | Auto |
| CGO-22-08 | Cargo sin DGR | Abrir sin declaraciones | Muestra una fila en blanco | P2 | Auto |

- **Riesgos / dudas:** (1) `lqMaxById` se vacía al reabrir: el límite LQ de filas cargadas del servidor no se aplica en cliente. (2) Las cadenas usan el prefijo `shipment.dgr.*` (compartidas con express). (3) No se localizó una exigencia de que el cargo se marque "mercancía peligrosa" al declarar.

---

### CGO-23 · Visibilidad de partners y reasignación de propietario
- **Ruta/pantalla:** `/cargo/:id`, modal `partners` y chip de propietario en cabecera  **Componentes:** `CargoPartnersBox.vue` (+ `modals/PartnersModal.vue`), `owner/CargoOwnerChip.vue`  **Envía:** `POST /api_cargo_partners` `{cargo_id, action: add|remove, partner_id}`; propietario `PATCH /unified_cargo_shipment {owner_user}`.
- **Permisos:** `can_add` lo calcula el servidor (máximo 4 ocupados: titular, partner principal, 2 huecos de visibilidad); titular y partner principal no se pueden quitar.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Partner a añadir | autocomplete (`anagraficaPickerService`) | Sí | Botón "Añadir" deshabilitado sin selección |
| Quitar partner | botón en la fila | — | Sin confirmación |
| Propietario | lista (`/api_cargo_owner_options`) + botón reasignar | Sí | Deshabilitado si es el actual |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CGO-23-01 | Añadir partner en hueco libre | Elegir partner | `action=add`; aparece en la lista; el partner ve el cargo | P0 | Auto |
| CGO-23-02 | Añadir duplicado | Titular o principal ya presentes | Servidor rechaza (ya existe) con mensaje | P0 | Auto |
| CGO-23-03 | Sin huecos | 2 huecos ocupados | `can_add=false`: botón añadir deshabilitado | P0 | Auto |
| CGO-23-04 | Quitar titular o principal | Intentar quitar | Servidor: "Cannot remove the titolare or primary partner"; la UI muestra error | P0 | Auto |
| CGO-23-05 | Quitar partner sin confirmación | Pulsar quitar | Se elimina al instante (sin diálogo) | P0 | Auto |
| CGO-23-06 | Reasignar propietario | Elegir otro operador | PATCH `owner_user`; el chip cambia; el anterior pierde/gana filtro "mis cargos" | P1 | Auto |
| CGO-23-07 | Reasignar al mismo | Mismo propietario | Botón deshabilitado | P2 | Auto |
| CGO-23-08 | Partner externo ve cargo quitado | Tras quitar, entrar como ese partner | 403/404 en el cargo | P0 | Manual |

- **Riesgos / dudas:** quitar visibilidad no pide confirmación (`CargoPartnersBox.vue` `onRemove`). `owner_user` no está en la lista de excluidos de la lista blanca documentada, pero tampoco se ha confirmado que esté incluido: verificar el PATCH real.

---

### CGO-24 · Expediciones express vinculadas y consolidación
- **Ruta/pantalla:** `/cargo/:id`  **Componentes:** `CargoLinkedExpressBox.vue`, `consolidation/CargoConsolidationPanel.vue`, `modals/ConsolidationModal.vue`  **Envía:** `POST /ajax_shipment_from_cargo` `{cargo_id, tpc: P|D|H}`; consolidación `POST|DELETE /unified_cargo_consolidation` `{cargo_id, spedizione_id}`.
- **Permisos:** `authz` de cargo/express.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Crear leg express (recogida / entrega / handler) | botón por rol que falta | — | Solo visible si el cargo no tiene `id_spediz_part/dest/handl` |
| Adjuntar envío a consolidar | autocomplete remoto (`attachable`) | Sí | Al elegir, adjunta; tabla de houses con botón de separar |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CGO-24-01 | Crear leg de recogida | "Crear recogida" | Crea express rellenada con datos del cargo; abre `shipment-detail` de la nueva | P0 | Auto |
| CGO-24-02 | Doble clic | Dos clics rápidos | Una sola express (bloquea el resto con `creating`) | P0 | Auto |
| CGO-24-03 | Rol ya existente | Cargo con `id_spediz_part` | El botón de ese rol no se ofrece | P1 | Auto |
| CGO-24-04 | Error del servidor | Cargo sin dirección de recogida | Toast con `error`/`message`; sin navegar | P1 | Auto |
| CGO-24-05 | Adjuntar envío | Elegir envío del buscador | Aparece como house en la tabla; el cargo recalcula totales | P0 | Auto |
| CGO-24-06 | Separar | Quitar un house | `DELETE`; desaparece; (sin confirmación visible en el grep) | P0 | Auto |
| CGO-24-07 | Adjuntar envío no elegible | Envío de otro cliente/ya consolidado | Fuera de la lista `attachable`; si se fuerza, error del servidor | P1 | Manual |

- **Riesgos / dudas:** comprobar si separar un house pide confirmación (no se localizó `confirm`).

---

### CGO-25 · Archivos del cargo
- **Ruta/pantalla:** `/cargo/:id`, caja de archivos y cajón de documentos  **Componentes:** `CargoFilesBox.vue` (sobre `packages/platform/detail/FilesBox.vue`), `drawers/CargoDocumentsDrawer.vue`  **Envía:** `POST /ajax_cargo_files` (multipart `shipment_id, scope, descrizione, file`; `action=delete`; `action=visibility`); descarga `GET /ajax_cargo_files?op=download`.
- **Permisos:** acceso al cargo; ámbito externo / interno; visibilidad por destinatario.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Ámbito (externo/interno) | toggle | Sí | — |
| Fichero(s) | arrastrar/soltar o selector | Sí | Servidor: extensiones pdf, doc, docx, xls, xlsx, gif, png, jpg, jpeg, tif, tiff; máximo 5 MB |
| Visibilidad por destinatario | casillas | No | Solo ámbito externo |
| Eliminar | botón | — | — |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CGO-25-01 | Subir PDF de 1 MB | PDF | Alta, aparece en la lista del ámbito | P1 | Auto |
| CGO-25-02 | Extensión no permitida | `.exe`, `.zip` | Error "Unaccepted file type (zip)" | P1 | Auto |
| CGO-25-03 | Fichero de 5 MB exacto y de 5,1 MB | Dos ficheros | 5,1 MB: "File exceeds 5 MB"; borde 5 MB a verificar | P1 | Auto |
| CGO-25-04 | Varios ficheros a la vez | 3 ficheros | Se suben secuencialmente (un POST cada uno); un fallo no impide los demás | P1 | Auto |
| CGO-25-05 | Ámbito interno vs externo | Subir a interno | No aparece en vista externa del cliente | P0 | Manual |
| CGO-25-06 | Visibilidad por destinatario | Activar/desactivar para un destinatario | `action=visibility`; el destinatario ve/deja de ver el fichero | P0 | Manual |
| CGO-25-07 | Borrar fichero | Eliminar | `action=delete`; desaparece | P1 | Auto |
| CGO-25-08 | Extensión en mayúsculas o doble extensión | `a.PDF`, `a.pdf.exe` | Servidor valida extensión final; `.PDF` aceptado si normaliza (no determinado) | P1 | Auto |

- **Riesgos / dudas:** el límite de 5 MB y las extensiones solo existen en el servidor; la ayuda `platform.files.formats_hint` debe coincidir.

---

### CGO-26 · Chat del cargo
- **Ruta/pantalla:** `/cargo/:id`, cajón de chat (`CargoChatDrawer.vue`) y diálogo (`CargoChatDialog.vue`)  **Envía:** `chatService.send/list/markRead/typing` (servicio compartido; endpoint no desglosado en este módulo, `services/chat.service.ts`).
- **Permisos:** acceso al cargo.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Mensaje | input texto (drawer, maxlength=4000) / textarea rows=2 (diálogo, sin maxlength visible) | Sí | Botón enviar deshabilitado sin texto (`trim`) o `sending` |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CGO-26-01 | Enviar mensaje | "Hola" | Aparece al final; contador de no leídos del listado baja al leerlo | P1 | Auto |
| CGO-26-02 | Mensaje solo con espacios | "   " | Botón deshabilitado | P2 | Auto |
| CGO-26-03 | Mensaje de 4001 caracteres en el cajón | Pegar texto largo | `maxlength` trunca a 4000; el diálogo no tiene límite visible | P2 | Auto |
| CGO-26-04 | Mensajes en tiempo real | Segundo usuario escribe | Aparece sin recargar; indicador "escribiendo" | P2 | Manual |
| CGO-26-05 | Filtro "chats sin leer" del listado | Activar | Solo cargos con mensajes sin leer | P2 | Auto |

- **Riesgos / dudas:** diferencia de límites entre cajón (4000) y diálogo (sin límite aparente).

---

### CGO-27 · Acciones de cierre: validar LDV, e-AWB, documentos y confirmación MAWB
- **Ruta/pantalla:** `/cargo/:id` (tarjeta Acciones y menú de impresión)  **Componentes:** `overview/CargoAzioniCard.vue`, `modals/ValidateLdvModal.vue`, `CargoPrintMenu.vue`, `mawb/AwbDocsBar.vue`  **Envía:** `GET /api_cargo_validate_ldv`; `POST /unified_cargo_ewb_send` `{type:'FWB'|'FHL', cargo_id|house_awb_id, use_testing}`; documentos `GET /api_awb_documents`.
- **Permisos:** `authz` de cargo.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Validar antes de LDV | abre modal con auto-ejecución | — | Lista de incidencias con severidad error/warning; `ready` = sin errores |
| Enviar e-AWB (FWB) | acción con `window.confirm` nativo | — | `use_testing` = true por defecto (sandbox) |
| Imprimir/PDF/imagen LDV y documentos | menú | — | — |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CGO-27-01 | Cargo incompleto | Sin AWB, vettore, terminales, cliente, colli, peso | Lista con errores: MAWB, carrier, terminales, cliente, "Package count is zero", "Chargeable weight missing"; `ready=false` | P1 | Auto |
| CGO-27-02 | Cargo listo | Datos completos | Mensaje "ready" verde | P1 | Auto |
| CGO-27-03 | Direcciones incompletas | Sin nombre/calle/ciudad/país en expedidor | Errores `shipper.nome`, `.adress`, `.citta`, `.id_paese_iso` | P1 | Auto |
| CGO-27-04 | Reejecutar validación | Corregir y pulsar "ejecutar de nuevo" | Resultado actualizado | P2 | Auto |
| CGO-27-05 | e-AWB: cancelar confirmación | Rechazar el `confirm` | No se envía nada | P0 | Auto |
| CGO-27-06 | e-AWB en sandbox | Aceptar confirm | `use_testing:true`; estado ack/sent/rejected visible (código FMA si rechazado). Solo sandbox | P0 | Manual |
| CGO-27-07 | e-AWB en producción | `use_testing=false` | No expuesto en la UI; el módulo no permite producción desde el formulario | P0 | Manual |
| CGO-27-08 | Doble envío e-AWB | Dos clics | Una transmisión (`ewbSending`) | P0 | Auto |
| CGO-27-09 | Fallo de validación del servidor | Error de red | Muestra `lastError` en alerta | P2 | Auto |

- **Riesgos / dudas:** los mensajes de incidencia vienen en inglés desde el servidor (`Validate_Ldv_Controller.php`), no pasan por i18n. El envío e-AWB usa `window.confirm` nativo; la transmisión síncrona puede tardar ~35 s sin barra de progreso específica.

---

### CGO-28 · Consulta de divisas del día
- **Ruta/pantalla:** `/cargo/:id`, modal `currency_day`  **Componente:** `modals/CurrencyDayModal.vue`  **Envía:** `GET api_currency_day?date=` (solo lectura).
- **Permisos:** lectura.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas |
|---|---|---|---|
| Fecha | `v-text-field type=date` | No | Por defecto la fecha de creación del cargo (`data_sped0`); vacía = hoy |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CGO-28-01 | Fecha por defecto | Abrir el modal | Tasas de la fecha del cargo | P2 | Auto |
| CGO-28-02 | Fecha sin tasas | Domingo/festivo | Chip "fallback" con la fecha efectiva usada | P2 | Auto |
| CGO-28-03 | Borrar fecha | Vaciar el campo | Carga las de hoy | P2 | Auto |
| CGO-28-04 | Fecha futura | Fecha > hoy | Comportamiento del servidor (fallback o error) | P2 | Auto |

- **Riesgos / dudas:** ninguno relevante.

---

## Inventario

| Prefijo-nn | Formulario | Fichero | Nº casos |
|---|---|---|---|
| CGO-01 | Alta de cargo | `web/apps/operations/src/modules/cargo/pages/CargoNewPage.vue` | 7 |
| CGO-02 | Filtros avanzados del listado | `.../cargo/components/cargo/CargoFilterPanel.vue` | 8 |
| CGO-03 | Barra del listado y acciones masivas | `.../cargo/pages/CargoListPage.vue` | 7 |
| CGO-04 | Cliente, sede y referencia | `.../cargo/components/cargo/CargoClientHeader.vue` | 5 |
| CGO-05 | Direcciones del cargo | `.../cargo/components/cargo/CargoAddressBlock.vue` | 8 |
| CGO-06 | Colli | `.../cargo/components/cargo/CargoPackagesBox.vue` | 10 |
| CGO-07 | Fechas, entrega, pesos extra y banderas | `.../cargo/components/cargo/CargoDatesBox.vue` (+ DeliveryBox, ExtraWeightsBox, FlagsBox) | 8 |
| CGO-08 | Importes: flujos de dinero, post-factura, seguro | `.../cargo/components/cargo/CargoMoneyFlowsBox.vue` (+ PostInvoiceBox, InsuranceBox) | 9 |
| CGO-09 | Aduanas y notificación a agencias | `.../cargo/components/cargo/CargoCustomsBox.vue` | 8 |
| CGO-10 | Servicio: vettore, terminales y handler | `.../cargo/components/cargo/CargoVettoriBox.vue` | 7 |
| CGO-11 | Búsqueda de vuelos y asistente de asignación | `.../cargo/components/cargo/flight-search/FlightSearchParams.vue` | 11 |
| CGO-12 | Reserva: confirmar, cancelar, reset | `.../cargo/components/cargo/flight-manager/BookingConfirmDialog.vue` | 12 |
| CGO-13 | Tramos de vuelo manuales | `.../cargo/components/cargo/flight-manager/FlightLegsManualModal.vue` | 7 |
| CGO-14 | MAWB | `.../cargo/components/cargo/mawb/CargoMawbFormV2.vue` | 13 |
| CGO-15 | HAWB | `.../cargo/components/cargo/modals/HawbFormModal.vue` | 9 |
| CGO-16 | Solicitud y reserva de AWB | `.../cargo/components/cargo/awb/CargoAwbRequestDialog.vue` | 9 |
| CGO-17 | Cargos (voces de coste) | `.../cargo/components/cargo/charges/CargoChargesTableV2.vue` | 10 |
| CGO-18 | Ofertas de transportistas (RFQ) | `.../cargo/components/cargo/offers/CargoOffersTable.vue` | 9 |
| CGO-19 | Oferta al cliente | `.../cargo/components/cargo/CargoOfferteBox.vue` | 8 |
| CGO-20 | Envío de documentos AWB por correo | `.../cargo/components/cargo/modals/EmailDocumentModal.vue` | 7 |
| CGO-21 | Cancelar cargo | `.../cargo/components/cargo/modals/CancelCargoModal.vue` | 9 |
| CGO-22 | Declaración DGR | `.../cargo/components/cargo/dgr/DgrDeclarationDialog.vue` | 8 |
| CGO-23 | Partners y propietario | `.../cargo/components/cargo/CargoPartnersBox.vue` | 8 |
| CGO-24 | Express vinculadas y consolidación | `.../cargo/components/cargo/CargoLinkedExpressBox.vue` | 7 |
| CGO-25 | Archivos | `.../cargo/components/cargo/CargoFilesBox.vue` | 8 |
| CGO-26 | Chat | `.../cargo/components/cargo/drawers/CargoChatDrawer.vue` | 5 |
| CGO-27 | Acciones de cierre: LDV y e-AWB | `.../cargo/components/cargo/overview/CargoAzioniCard.vue` | 9 |
| CGO-28 | Divisas del día | `.../cargo/components/cargo/modals/CurrencyDayModal.vue` | 4 |

Total: 28 formularios y 230 casos (CGO-01 a CGO-28). `.../cargo` equivale a `web/apps/operations/src/modules/cargo`.
