# Plan de pruebas de formularios de la UI

> **Estado:** borrador · **Última modificación:** 2026-11-02

Casos de prueba para cada formulario de la SPA (`web/apps/operations` y `web/packages`). Complementa [plan-pruebas-ui.md](plan-pruebas-ui.md) (perfiles, fases, reglas de seguridad y criterios de salida), que sigue siendo el marco; aquí solo se detalla el nivel de formulario.

**Cómo se hizo.** Seis agentes leyeron el código de la SPA y, en lo que valida el servidor, `tmwe_api` (solo lectura). No se arrancó la aplicación ni se ejecutó ninguna prueba. Las reglas y los defectos citados salen de esa lectura: son **hipótesis a confirmar**, no hechos probados. Lo que no se pudo determinar está marcado «no determinado» en cada ficha. Los proyectos `tmwe-wueform`, `tmwe_doc` y `Jose_master` no hizo falta usarlos de forma sistemática.

## 1. Cifras

| Documento | Ámbito | Prefijo | Formularios | Casos |
|---|---|---|---|---|
| [generico.md](pruebas-formularios/generico.md) | Catálogo de 30 casos genéricos (G-01 a G-30) aplicable a todo formulario | G | todos | 30 |
| [cargo.md](pruebas-formularios/cargo.md) | Cargo aéreo | CGO | 28 | 230 |
| [expediciones.md](pruebas-formularios/expediciones.md) | Expediciones, seguimiento y retenciones | SHP | 36 | 280 |
| [finanzas.md](pruebas-formularios/finanzas.md) | Facturación, cobros, proforma y COD | FIN | 32 | 263 |
| [clientes.md](pruebas-formularios/clientes.md) | Clientes, anagrafica, listas de precios | CLI | 24 | 154 |
| [settings.md](pruebas-formularios/settings.md) | Settings (unas 60 pantallas en 40 fichas) | SET | 40 | 312 |
| [resto.md](pruebas-formularios/resto.md) | Consolidata, recogidas, CRM, almacén, plantillas, tickets, Copilot, bulk, filtros, sesión | OTR | 45 | 262 |
| **Total** | | | **205** | **1.501 + 30 genéricos** |

Los formularios de filtros y buscadores están incluidos. `/cargo/from-express` no tiene formulario.

## 2. Cómo se usa

1. Antes de ejecutar una ficha, recorrer los casos genéricos con los campos que correspondan (obligatorios, longitudes, tipos, doble envío, 4xx/5xx, i18n, teclado).
2. Ejecutar los casos específicos de la ficha. Cada caso lleva prioridad (P0 económico, fiscal, permisos o envíos; P1 datos maestros; P2 filtros y ajustes) y tipo (Auto con Playwright; Manual).
3. Los casos que pueden disparar acciones reales (reservas, cancelaciones, etiquetas, emails, manifiestos, mensajes) van marcados «solo con UPSTREAM_DENY_ACTIONS activo» o «solo sandbox». No se ejecutan fuera de esas condiciones.
4. Los IDs `<PREFIJO>-<nn>-<mm>` son estables dentro de este documento. Si una ficha cambia, no reutilizar IDs de casos eliminados.

## 3. Hallazgos que conviene confirmar antes de probar

> **Actualización 2026-11-01:** estos hallazgos se verificaron con una segunda lectura del código. El resultado (confirmados, parciales y refutados) y el plan de corrección están en [plan-mitigacion-hallazgos-formularios.md](plan-mitigacion-hallazgos-formularios.md). Cuatro resultaron no ser defectos (`Math.abs` en conciliación, `cod_iva` «21», IBAN sin validar, cierre masivo de giacenze/tracking sin confirmar) y el texto de abajo no se ha reescrito.

Posibles defectos que los agentes encontraron al leer el código. Ordenados por riesgo. «Contrastado» significa que lo revisé con un `grep` rápido; el resto viene solo del informe del agente.

**Permisos y seguridad**
1. **`root` desprotegido en la ficha de usuarios.** `User_Admin_Controller` no parece comprobar `root` al restablecer contraseña, editar o borrar; un administrador TMWE sin `root` podría tomar una cuenta `root` (SET-04-05, SET-03-04). El alta con rol `root` pedida por un no-root se omite en silencio y el bulk lo cuenta como éxito (SET-02-06, SET-06-03). *Contrastado:* en ese fichero solo aparece `root` en un comentario sobre la política de asignación.
2. **MFA.** Un código TOTP erróneo devuelve 401 y el interceptor global lo trata como sesión caducada (`shared-frontend/http/bff.ts:143`). No se comprobó si el BFF lo traduce. El secreto sigue en pantalla tras verificar.
3. **Secretos en claro.** `fornitori_accnt` precarga contraseñas y claves en campos de texto; las claves WebCargo y el `client_secret` OAuth se muestran sin enmascarar.
4. **Alta de anagrafica (P38).** Crea dos contactos base con credenciales que la SPA no muestra y sin sede asignada (CLI). *Actualizado 2026-11-02:* el alta de partner ya pide el administrador y envía un enlace de acceso (H4 en [plan-mitigacion-hallazgos-formularios.md](plan-mitigacion-hallazgos-formularios.md)); clientes y resto siguen igual.
5. **Sesión y login.** El callback del BFF redirige a `/?auth_error=<código>` y ninguna parte de la SPA lee `auth_error`; podría haber un bucle de login (OTR-39, a confirmar en navegador). *Contrastado:* no hay lecturas de `auth_error` en la SPA.
6. **`isTmwe` casi seguro `false` en anagrafiche.** `useAnagraficaContext.ts` lee globales que ninguna app define. Efecto probable: selects deshabilitados incluso para TMWE y roles API sin acotar (CLI-01).
7. **Almacén en solo lectura para todos.** `modules/warehouse/env.ts:41-48` obtiene `canWrite` de globales (`__TMWE_INVOICING__`, `__TMWE_WAREHOUSE__`) que `bootstrapBff` no fija (OTR-23 a OTR-27). *Contrastado en parte:* en `web/` solo se encuentran lecturas de esos globales.

**Dinero y datos fiscales**
8. **Pasiva manual rota (FIN-11-02).** `SupplierInvoiceDialog` envía una cuota de coste por defecto que el servidor rechaza con 422 `QUOTES_MISMATCH`, incluso sin distribución de coste.
9. **Fechas en UTC** (`toISOString()`) en alta manual, generación, pasiva y conciliación COD: desfase de un día cerca de medianoche. Cobro y factura admiten fecha futura en cliente.
10. **Alta manual de factura:** `aliquota_iva`=22 con `cod_iva`="21" por defecto (FIN).
11. **Conciliación bancaria** usa `Math.abs` en el importe por defecto: un cargo podría cerrarse como cobro. En COD, el total seleccionado suma solo la página cargada, y el filtro de importe mínimo usa `*100` en coma flotante (1,10 excluido con mínimo 1,1).
12. **Acciones de dinero sin confirmación:** riaddebito masivo en recargas (SHP), `override_amount=0` al vaciar el campo, márgenes por escalón con un PATCH por pulsación (vaciar envía 0), importación de precios en modo «replace» que borra filas, modificación múltiple en % que admite `--5` o `1.2.3`.
13. **Candados de factura distintos entre UI y servidor** (`useShipmentState.ts` frente a `READONLY_FIELDS_INVOICED`); se muestra «Saved» aunque el servidor devuelva `ignored_fields` o `blocked_by_lock`.
14. **Datos fiscales sin validar** ni en la SPA ni en `tmwe_api`: PEC, `cod_destin`, IBAN/SWIFT, `pi_cf`/`cf`, CAP. El icono VIES comprueba el `pi_cf` guardado, no el tecleado. El CSV de cobros no neutraliza fórmulas (`=`, `+`, `-`, `@`).
15. **`/cod` y `/proforma` sin guard de router** y componentes sin comprobación de escritura (`BatchReviewPanel`, `QrGeneratorCard`).

**Efectos antes de guardar o sin protección**
16. **Cargo:** "Nuevo HAWB" crea el house sin `id_spediz` y el servidor lo rechaza (CGO-15, `HawbListModal.vue` ~l.101 y `Awb_Service::validate_create_data` l.374-376). Colli con peso 0 fallan y el guardado no es atómico (CGO-06). Asignar tarifa con reserva activa cancela la reserva solo con un aviso (CGO-11). Cancelar cargo no comprueba factura, AWB ni reserva (CGO-21). `BookingConfirmDialog` confirma con AWB vacío en modo manual o pool (CGO-12).
17. **Expediciones:** el email de entrega sale antes de `commitDraft` (SHP, `ShipmentDeliveryBox`). `ProformaModal.generatePdf` ignora si `save()` falló. El cierre automático de giacenze y «lanzar tracking» se ejecutan al primer clic.
18. **Texto a HTML:** `plainToHtml` de las notas de la oferta no escapa HTML y va al correo del cliente (CGO-19). El enlace del editor HTML acepta `javascript:` (OTR).
19. **Otros:** el cambio de partner no avisa si el POST falla (`PlatformPartnerSwitch.vue:94`); borrar un evento de CRM no pide confirmación; el hilo de tickets no limita a 4.000 caracteres y el servidor sí; el cotizador de Consolidata divide el peso entre bultos sin exigir > 0.

**Calidad de la UI**
20. Mensajes de validación en italiano fijo (`cargoRules.ts`, `shipmentRules.ts`) y otros textos fuera de i18n. Cualquier caso G-27 (idiomas) los detectará.
21. Código aparentemente muerto: `ShipmentFromCargoPage` (nadie rellena `__TMWE_SHIPMENT__.fromCargo`), `StoricoMessaggiPanel`. Confirmar antes de gastar casos en ellos.

## 4. Huecos de cobertura declarados por los agentes

- Detalle parcial: `AnagraficaListiniSection.vue`, `Anagrafica_Service_Config_Controller`, parámetros del asistente de reglas fiscales (FIN-23, 1.218 líneas), `modo` del intermediario y `runRevision` (FIN-25), SHP-18, SHP-25, SHP-27, SHP-28, SHP-29, SET-28 (escritura) y SET-37 a SET-39.
- Muchos códigos de error del servidor figuran como «no determinado». Se resuelven ejecutando el caso en sandbox y anotando la respuesta real.
- La numeración de IDs es nueva y no coincide con la de `plan-pruebas-ui.md` (CM-, FN-, CL-, ST-). Los casos de formulario son un nivel por debajo de esos.

## 5. Siguiente paso recomendado

Ejecutar primero los casos marcados P0 de las fichas con hallazgo (puntos 1, 8, 9, 11, 12 y 16 de la lista) contra sandbox. Si se confirman, abrir la corrección antes de automatizar; si no, ajustar la ficha. Después, automatizar con Playwright los casos Auto P0 y P1 por módulo.
