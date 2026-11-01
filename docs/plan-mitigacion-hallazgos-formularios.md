# Plan de mitigación de los hallazgos de la revisión de formularios

> **Estado:** borrador · **Última modificación:** 2026-11-01

Resultado de verificar, con una segunda lectura independiente del código, los 24 hallazgos de [plan-pruebas-formularios.md](plan-pruebas-formularios.md) §3 y plan para corregir los que se confirmaron. **La verificación fue solo lectura: no se ejecutó ninguna prueba contra datos ni en el navegador**, salvo `vue-tsc`, `vitest` de un módulo, `phpunit` del BFF, `check:i18n` y `check:raw-text`. Un «confirmado» significa que el código lo implica; los casos de la columna «Prueba» lo comprueban de verdad en sandbox.

Lo que toca a `tmwe_api` lo decide otro equipo: está recogido como peticiones P42 a P57 en [contrato-con-api.md](contrato-con-api.md) §F, no aquí.

## 1. Veredictos

Esfuerzo: S < 0,5 d; M 0,5 a 2 d; L > 2 d. Repo: SPA = `web/`, BFF = `bff/`, API = `tmwe_api`.

| ID | Hallazgo | Veredicto | Gravedad | Esf. | Repo |
|---|---|---|---|---|---|
| H1 | `root` sin proteger en reset, edición y baja de usuario; alta con `root` omitida en silencio | **Confirmado** | Alta (escalada) | S + S | API + SPA |
| H2 | TOTP erróneo cierra la sesión | Refutado (el BFF lo traduce a 403). Confirmados: mensaje engañoso y secreto TOTP sin limpiar | Baja-media | S | SPA |
| H3 | Secretos en claro | Parcial: `pw`/`chiave` de fornitori_accnt es defecto; WebCargo menor; `client_secret` es diseño aceptable | Media | M / S | API + SPA |
| H4 | Contactos base del alta (P38) | Parcial: heredado y acotado a la cuenta; riesgo de higiene | Baja-media | S-M | API + SPA |
| H5 | Bucle por `auth_error` | Parcial: nadie lee `auth_error`; no hay bucle automático | Baja | S | SPA |
| H6 | `isTmwe` siempre `false` en anagrafiche | **Confirmado** (falla hacia menos privilegios) | Media | S | SPA |
| H7 | `canWrite` de almacén (y facturación, pagos, COD) siempre `false` | **Confirmado en código**; falta verlo en navegador | Alta (funcional) | S-M | BFF + SPA |
| H8 | Pasiva manual: 422 `QUOTES_MISMATCH` | **Confirmado** | Alta | S | SPA |
| H9 | Fechas en UTC y sin tope | Parcial: UTC confirmado en 6 sitios; fecha futura de factura sin tope; cobro lo corta el servidor | Media | S | SPA + API |
| H10 | IVA 22 con `cod_iva` 21; EUR fijo | Parcial: `cod_iva` 21 es el código legacy de IVA ordinaria (refutado); EUR fijo es limitación | Baja | M | SPA |
| H11 | Conciliación | Parcial: `Math.abs` refutado; total COD de solo la página y filtro `*100`, confirmados | Media | S | SPA |
| H12 | Acciones de dinero sin confirmación | Parcial (6 subpuntos, ver §3.2) | Media | S-M | SPA + API |
| H13 | Candados de factura UI ≠ servidor; toast «Saved» | Parcial: confirmado en `km_forza`, `acc_fissa_corriere`, `peso_fornit_reale` y toast | Media | S | SPA |
| H14 | Datos fiscales sin validar | Parcial: IBAN refutado (el servidor valida mod-97); resto confirmado | Media | M | API + SPA |
| H15 | `/cod` y `/proforma` sin guard | Confirmado solo como UX (el servidor da 403) | Baja | S | SPA |
| H16a | Nuevo HAWB sin `id_spediz` | **Confirmado** | Alta | S | SPA |
| H16b | Colli con peso 0 y guardado no atómico | **Confirmado** | Alta / media | S / M | SPA + API |
| H16c | Tarifa cancela reserva viva solo con aviso | **Confirmado** | Media-alta | S | SPA |
| H16c | Cancelar cargo sin comprobar factura, AWB ni reserva | **Confirmado** | Media-alta | M | API + SPA |
| H16c | Confirmar reserva con AWB vacío | Refutado (el servidor lo rechaza) | Baja | S opcional | SPA |
| H16d | `id_cliente` por PATCH; importes por blur sin `cargoRules` | Confirmado | Baja / media-baja | S | SPA |
| H17a | Email de entrega antes de guardar (modal Estado) | **Confirmado** | Media | S | SPA |
| H17b | Proforma genera PDF aunque `save()` falle | Confirmado | Media-baja | S | SPA |
| H17c | Cierre de giacenze y tracking masivo sin confirmar | Refutado (ambos piden confirmación). Sondeo sin límite: confirmado | Baja-media | S | SPA |
| H17d | `date_from=null` en la URL | Confirmado | Baja-media | S | SPA |
| H17e | `checkforn === 'OK'`; modales de importes guardan al instante | Confirmado | Media-baja | S / M | SPA |
| H18 | Código muerto (`ShipmentFromCargoPage`, `StoricoMessaggiPanel`) | Confirmado | Baja | S | SPA |
| H19 | `plainToHtml` sin escape; enlace `javascript:` | Parcial: `offerta_txt` no va al correo; sí a la oferta pública | Baja-media | S | SPA + API |
| H20 | Partner switch, CRM, tickets | Confirmados; Consolidata parcial (el servidor rechaza con 422) | Baja a media | S | SPA |
| H21 | Roles OAuth 410, cuentas bancarias, causales, plazos de pago | Confirmados. Nuevo: el toast de cuentas bancarias probablemente muestra `[object Object]` | Media | S | SPA + API |
| H22 | CAP descartados; terminales WebCargo a 10 | CAP confirmado; WebCargo parcial (la ayuda ya dice «máximo 10») | Media / baja | S | SPA |
| H23 | Textos fijos fuera de i18n | Confirmado: 38 literales italianos; el gate no los ve | Baja | M | SPA |
| H24 | Puertas de calidad | `vue-tsc` 0 errores; BFF 145 tests OK; **`check:i18n` falla** (401 frente a 368) | — | — | — |

Cuatro hallazgos del listado original **no son defectos**: `Math.abs` en conciliación, `cod_iva` «21», IBAN sin validar, y el cierre masivo de giacenze/tracking sin confirmación. No se gasta esfuerzo en ellos.

## 2. Orden de ejecución

### Ola 0. Antes de tocar nada (medio día)
1. **Ver H7 en el navegador.** Si las pantallas de almacén, facturación, pagos y COD aparecen deshabilitadas para todos, es urgente; si no, hay otra vía que el análisis no vio. La ronda E2E del 2026-10-30 sí operó con facturación, lo que hace pensar que `invoicing/services/http.ts` obtiene las capacidades por otro camino. Decide el alcance real de H7.
2. **Pedir H1 al equipo de `tmwe_api`** (P42) y, mientras no se corrija, reducir el riesgo operativo: listar quién tiene anagrafica 1 sin `root` y revisar en los registros las llamadas a `api_admin_users` con `action:reset_password` sobre cuentas `root`.
3. Decidir con producto los puntos marcados «decisión» en §3.

### Ola 1. Funciones rotas y riesgos de dinero o permisos (1 a 2 semanas)
| Orden | Hallazgo | Cambio | Esf. |
|---|---|---|---|
| 1 | H1 (API) | Guard de destino `root` en `reset_password`, `PUT`, `DELETE`; 403 `ROLE_ROOT_ONLY` | S |
| 2 | H1 (SPA) | Avisar de los roles no concedidos en el alta; `toast.warning` y `error` en el bulk | S |
| 3 | H7 | BFF conserva `invoicing_capabilities` en `/bff/auth/session`; SPA las expone una vez y los `env.ts` de warehouse, payments, cod e invoicing las consumen | S-M |
| 4 | H8 | `SupplierInvoiceDialog.vue`: no enviar cuotas vacías (neto 0 y cuenta 0, sea cual sea el año) | S |
| 5 | H16a | `HawbListModal.vue`: retirar «Nuevo» o pedir la expedición y enviar `id_spediz` | S |
| 6 | H16b | `allow_placeholder` o validar peso > 0 en cliente; orden añadir, actualizar, borrar | S |
| 7 | H16c | `FlightSelectionWizard.vue`: casilla propia que mencione la cancelación de la reserva (patrón de `ResetFlightsDialog`) | S |
| 8 | H17a | `ShipmentDeliveryBox`: no enviar el aviso en modo borrador; enviarlo tras guardar | S |
| 9 | H17b | `ProformaModal`: `save()` devuelve booleano y `generatePdf` aborta si falla | S |
| 10 | H11c, H11b | `Math.round(min * 100)`; total COD acumulado por id o limpiar la selección al paginar | S |
| 11 | H12.1 | Confirmación con recuento y suma antes del riaddebito masivo | S |
| 12 | H12.3 | Márgenes por escalón: guardar con `@change`, validar rango, no enviar vacío | S-M |
| 13 | H16c (cancelar cargo) | API 409 si hay factura o reserva viva (P43) y aviso en `CancelCargoModal` | M |

### Ola 2. Datos fiscales y coherencia (2 a 3 semanas)
| Hallazgo | Cambio | Esf. |
|---|---|---|
| H9a | Helper `todayLocal()` en `@shared` y sustituir los 6 usos de `toISOString()` | S |
| H9b | `max` en la fecha de factura manual; API rechaza fecha futura (P47) | S + S |
| H13 | Alinear `useShipmentState.readonly()` con `READONLY_FIELDS_INVOICED`; toast de aviso con `ignored_fields` | S |
| H21b | Cuentas bancarias: obligatoriedad y leer `raw.error.message` en el servicio | S |
| H21c, H21d | Rango de alícuota y bloqueo de plazos sin tramos, en SPA y API (P49, P50) | S + S |
| H14 | `cod_destin` se limpia al salir de IT; VIES envía lo tecleado; `csvCell` neutraliza `=+-@`; validación de PEC, SDI y `pi_cf` en API (P51) | M |
| H3a | `pw`/`chiave` sin precargar y con `type="password"`; API no los devuelve (P52) | M |
| H12.5 | Regex `^-?\d+(\.\d+)?$` en SPA y API (P53) | S |
| H12.6, H12.4 | Avisar de celdas vaciadas al publicar la matriz; confirmar el modo «replace» | S |
| H19 | Escapar `plainToHtml`; `insertLink` solo con `http`, `https`, `mailto`; saneo de `offerta_txt` en API (P55) | S + S |
| H22a | Avisar de los CAP descartados | S |

### Ola 3. Higiene y UX (según capacidad)
H6 (`useAnagraficaContext` lee `__TMWE_OPERATIONS__.isTmwe`), H5 (leer `auth_error` en `bootstrapBff`), H2 (mensaje y limpiar `setupResult`), H20 (aviso en cambio de partner, confirmación al borrar eventos CRM, `catch` en `persistField`, `maxlength` en tickets, validar bultos en Consolidata), H21a (quitar «restringir endpoints»), H22b, H17c (límite del sondeo), H17d (`date_from=null`), H17e (comparar `checkforn` con los valores reales; avisar en modales de importes que Cancelar no revierte), H15 (guard basado en el permiso real de cada módulo, no en el de facturación), H18 (eliminar el código muerto), H10b (selector de moneda), H4 (`random_int`, sede; P56), H23 (validadores con claves i18n y regla de lint para `.ts`), H16d.

## 3. Detalle por tema

### 3.1 Permisos y sesión
- **H1.** `User_Admin_Controller.php` solo exige anagrafica 1; `Role_Assignment_Policy` solo regula conceder o retirar el rol. Un administrador sin `root` recibe la contraseña nueva de un `root` en la respuesta de `reset_password`. Corrección en P42. Prueba: PHPUnit con llamante TMWE sin `root` contra destino `root` en las tres acciones (403, `lpw` intacto) y casos SET-02-06, SET-03-04, SET-04-05, SET-06-03.
- **H7.** `UserContextProvider::fromBackendContext` descarta `invoicing_capabilities` aunque `get_ops_bootstrap` las devuelve. Prueba: PHPUnit de `UserContextProvider`, vitest de `warehouse/env.ts` con la sesión simulada y casos OTR-23 a OTR-27 con un operador de sandbox. **Decisión:** qué `audience` corresponde a un partner.
- **H6.** Con suplantación activa `is_tmwe` sigue siendo el del usuario real; decidir qué se quiere en ese estado antes de cambiarlo. Prueba: vitest de `useAnagraficaContext` y casos CLI-01-02, CLI-02, CLI-03, CLI-05, CLI-06 con un usuario TMWE.
- **H2/H5.** Cambios solo de SPA con prueba vitest de componente y de `bootstrapBff` (`?auth_error=invalid_state` no llama a `location.assign`). La alternativa para H2 de propagar el cuerpo del 401 en el BFF es mejor pero toca el proxy.
- **H3.** Solo `pw`/`chiave` es defecto. Hay que revisar los consumidores legacy de esa tabla antes de dejar de devolverlos.

### 3.2 Dinero
- **H12.2** (`override_amount=0`) es inocuo: el servidor lo trata como `no_delta`. Solo mejorar el mensaje.
- **H12.4** (modo «replace») y **H12.6** (matriz) crean una versión nueva y la anterior es recuperable: son avisos de UX, no pérdida de datos.
- **H12.5.** La ficha CLI-20-03 estaba mal: el servidor usa la misma regex y no responde 422; PHP lee `--5` como 0 y `1.2.3` como 1,2.
- **H9d** (estado COD inválido pasa a «cobrado») no es alcanzable desde la UI: solo afecta a clientes directos de la API.
- **H15.** No usar `canWrite` de facturación para proteger `/cod`: el servidor autoriza COD por el módulo `spedizioni`.

### 3.3 Cargo y expediciones
- **H16a.** Decisión de producto pendiente: o no hay HAWB manual (se crea al consolidar expediciones) o la API lo admite (P44).
- **H16b.** Un guardado transaccional de bultos exige un endpoint nuevo (P45); hasta entonces, el orden añadir, actualizar, borrar reduce la pérdida.
- **H17e.** Los importes se guardan al instante por diseño (paridad con el legacy, por la conversión de divisa). Si no se quiere cambiar, bastan un aviso y quitar «Cancelar» en esos modales.
- **H13, caja post-factura:** `ShipmentPostInvoiceBox` edita `postfatt`, `post_fuel_surc` y `peso_fornit_reale`, que el servidor también bloquea en expediciones facturadas. **No concluyente**: probar en sandbox con una expedición con `id_fattura_a` y `AWB_forn`.

## 4. Pruebas que validan las correcciones
- Cada corrección lleva un test vitest o PHPUnit nuevo y se ejecuta con el caso de ficha indicado, en sandbox y con `UPSTREAM_DENY_ACTIONS` activo.
- Fichas a corregir por las refutaciones: CLI-20-03 (el servidor no devuelve 422 a `--5`), CLI-07-01 (el servidor valida IBAN con mod-97), FIN-06-05 (el emparejamiento por signo ya distingue cargo de abono), FIN-07-02 (`cod_iva` 21 es el código legacy), CGO-12 (el servidor rechaza AWB vacío en modo manual) y las de giacenze y tracking masivo (hay confirmación).
- Puertas: `vue-tsc`, vitest, PHPUnit y PHPStan en verde. `check:i18n` ya falla en `HEAD` (401 sin traducir frente a 368): resolver o recongelar el baseline **antes** de la Ola 3, para que las correcciones nuevas no queden tapadas. `check:raw-text` da 2 frente a un baseline de 15: recongelar.

## 5. Riesgos y lo no verificado
- Todo el diagnóstico es lectura de código. H7, H21b (`[object Object]`), H20e (422) y la caja post-factura de H13 dependen de ejecución.
- Las correcciones de API que cambian reglas (P43 cancelación, P47 fecha futura, P49 y P50 validaciones, P52 secretos) pueden romper flujos que hoy funcionan; acordar con operaciones y contabilidad antes.
- No se revisó `User_Plain_Password_Controller`, que podría necesitar el mismo guard que H1.
- Estimaciones en días son orientativas y no incluyen revisión ni despliegue.
