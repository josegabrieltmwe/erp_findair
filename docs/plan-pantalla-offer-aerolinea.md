# Plan: pantalla de respuesta de la aerolínea a la cotización cargo (`/offer`)

> **Estado:** borrador · **Última modificación:** 2026-11-06

Plan para construir en `erp_findair` la pantalla donde una aerolínea responde a una solicitud de cotización cargo (RFQ), y las
piezas del BFF y del API que necesita. Sustituye en el ERP moderno a `vttoff.php` del legado. Es la petición **P94** de
[contrato-con-api.md](contrato-con-api.md); el análisis del flujo completo está en
`tmwe_api/docs/03-diseno/cargo_rfq_aerolineas.md` y el mecanismo del enlace del correo en
`tmwe_api/docs/03-diseno/callback_url_correos.md`.

Lo marcado **[verificar]** no se pudo comprobar desde el equipo de desarrollo (datos o configuración del sandbox).

## 1. Punto de partida

- El correo del RFQ ya lleva el enlace `<origen de la SPA>/offer?id=<oferta>&otp=<otp>` (`callback_url` + `id` y `otp`).
  **Ese enlace hoy no lleva a ninguna pantalla.**
- La SPA no puede servirla: `web/apps/operations/src/main.ts` llama a `bootstrapBff()` antes de montar nada y, sin sesión,
  redirige a `/bff/auth/login`. El BFF tampoco tiene ninguna ruta sin sesión (`AuthMiddleware` envuelve `/bff/v1/*`).
- El API tiene la vista (`GET public_offer`, `Public_Offer_Controller`), pero **no** la escritura, los ficheros de la aerolínea
  ni el PDF. Desde el 2026-10-29 los controladores públicos exigen un Bearer de aplicación (`Public_Route_Policy`): la
  aerolínea no puede llamarlos directamente.

## 2. Cómo se construye en el legado

Pantalla de una sola página, ancho fijo de 950 px, en inglés, con el logo del partner (`loghi_partner/logo_<id_partner>.*`).
Acceso por `id` + `otp` (alfanumérico de hasta 12) contra `spedizioni_cargo_off`; cualquier otra cosa responde «Offerta non trovata».

| Zona de `vttoff.php` | Contenido | Origen de datos |
|---|---|---|
| Título | «Quotation request *id* of *fecha* - (*aerolínea*)» | `spedizioni_cargo_off.data_rich`, `cargo_vettori.nome` |
| Nota de la solicitud | `txt_richiesta` (HTML) | `spedizioni_cargo_off` |
| FREIGHT DETAILS · Parcels | por bulto: n.º, lado 1 × lado 2, alto, peso; iconos «no girable» / «no apilable» y leyenda | `spedizioni_colli` |
| FREIGHT DETAILS · Freight | peso total, volumen total, n.º de bultos, aeropuerto de salida y de llegada, «on pallets», tipo de mercancía; enlace a la lista de bultos en CSV | `spedizioni_cargo`, `spedizioni_colli` |
| Attached files | ficheros de la expedición marcados `show_vettore='S'`, descargables | `spedizioni_files` |
| Your attached files | hasta 4 ficheros subidos por la aerolínea (pdf, doc, xls, gif, png, jpg, tif, tiff; 3 MB) | `spedizioni_cargo_off.file_name1..4`, `cargo_docs/off_vtt<id>-<n>` |
| CHARGED VOICES | tabla por línea: código, nombre, coste/tipo/mín/máx originales (solo lectura) y coste/mín/máx **editables** por la aerolínea; solo las líneas `somma='S'` | `spedizioni_cargo_off_dett` (`costo_unit/min/max`, `costo_unitV/minV/maxV`, `type` ∈ `kg`/`fix`/`box`) |
| Chargeable weight | peso tasable editable (`pesor`; si la aerolínea no lo cambia, el de la expedición) | `spedizioni_cargo_off.pesor` |
| Tot ALL IN | total en la moneda de la oferta, recalculado en el navegador al teclear | JS `ReCalc()` |
| Notas / Schedule / Your reference | `vtt_txt` (`txt_risposta`), `vtt_sch` (`txt_schedule`), `rif_vettore` | `spedizioni_cargo_off` |
| SEND THE QUOTATION | envía el formulario a `vttoff_exe.php` | — |

**Fórmula del total** (`ReCalc`): para cada línea sumable, `coste = costoV || costo`, `mín = minV || mín`, `máx = maxV || máx`;
cantidad = 1 (`fix`), peso tasable (`kg`) o n.º de bultos (`box`); `importe = coste × cantidad`, acotado a `[mín, máx]` cuando
son > 0; cada línea se redondea a 2 decimales y se suman.

**Al enviar** (`vttoff_exe.php`): guarda `costo` y `pesor` si cambiaron, `txt_risposta`, `txt_schedule`, `rif_vettore`, los
`costo_*V` de las líneas que cambiaron y `data_risp = ahora`, con IP. Muestra el agradecimiento y ofrece **descargar el PDF**
(`vttoff_pdf.php`, que captura la propia página con un navegador) o **recibirlo por correo** (`vttoff_mail_pdf.php`, plantilla
`CRGO2` del titular de la expedición, al contacto del vettore). Se puede volver a enviar mientras el operador no marque la
oferta como revisada (`controllata='S'`); entonces todo queda en solo lectura.

**Lo que no se debe reproducir** (fallos del legado):
1. **El total lo manda el navegador** y el servidor lo guarda tal cual: se puede enviar cualquier importe. El moderno lo
   recalcula en el servidor.
2. `vttoff_colli_excel.php` (CSV de bultos) **no comprueba el OTP**: basta el id de oferta y el de la expedición.
3. Sin límite de intentos sobre el OTP, sin caducidad, y el PDF se genera pidiendo a un navegador la URL pública (con el OTP).
4. La subida se valida por extensión y tamaño, no por contenido.

## 3. Estado de lo que ya existe y lo que falta

| Pieza | Existe | Falta |
|---|---|---|
| Datos de la oferta y líneas | `Spedizioni_Cargo_Off::get_public_by_id_otp` (oferta + líneas) | — |
| Vista pública | `GET public_offer` devuelve la oferta saneada y las líneas | bultos, totales, aeropuertos, mercancía, ficheros de la expedición y de la aerolínea, nombre de la aerolínea, moneda, estado (solo lectura / ya respondida) |
| Envío de la respuesta | patrón en `Public_Express_Offer_Controller` + `Express_Offer_Service::submit_quote` (OTP, límite por IP, idempotencia, doble confirmación, IP/fecha, aviso por correo al operador) | **todo el equivalente cargo** (`vttoff_exe`) |
| Ficheros de la aerolínea | `Document_Store` ya registra `cargo_docs/off_vtt<id>-<n>`; `Cargo_Files_Service::resolve_binary` sirve los de la expedición | subida y descarga públicas (por OTP) |
| CSV de bultos, PDF/correo `CRGO2` | — | ambos |
| Aviso al operador | marca y filtro `has_pending_offers`; aviso por correo ya hecho para couriers | aviso por correo para cargo |
| Acceso sin sesión desde la SPA | — | app/entrada pública en la SPA, rutas anónimas acotadas en el BFF, token de aplicación propio |

## 4. Diseño

### 4.1 Dónde vive la pantalla (decisión D1)

Entrada **independiente** de la SPA de operaciones: no puede pasar por `bootstrapBff()` ni cargar código de operador.

- **Recomendada:** nueva app `web/apps/offer` (workspace pnpm), con su `index.html`, `tsconfig`, pruebas y bundle propio
  (Vue + el mínimo de Vuetify), construida con `base: '/offer/'` hacia `web/dist/offer/`. Se construye **después** de
  `operations` y con `emptyOutDir: false` para no borrarse entre sí. Apache: `/offer` (sin barra) redirige a `/offer/` conservando
  la query, y se desactiva el `FallbackResource` de `/offer/assets` igual que ya se hace con `/assets`.
- Alternativa: segunda entrada HTML en `operations` (multi-page de Vite). Una sola build, pero mezcla en el mismo paquete
  el código del operador y el de una página abierta a Internet.

La ruta que la SPA ya manda en el correo es `<origen>/offer` (`MAIL_LANDING_PATHS.cargoCarrierOffer`): no cambia.

### 4.2 Acceso sin sesión por el BFF (decisión D2 — requiere visto bueno del dueño)

Es la primera superficie anónima del BFF, y choca con la regla del 2026-10-29 «nada expuesto sin aplicación identificada».
Se resuelve igual que la pantalla de restablecer contraseña: **la aplicación es el BFF**, que se identifica ante el API con su
propio Bearer; la aerolínea nunca habla con el API.

- Grupo nuevo `/bff/public/offer/*`, **fuera** de `AuthMiddleware`, con un manifiesto propio (`routes.public.yaml`) que es una
  lista cerrada de 5 acciones, sin `forward_query: '*'` y sin `checkEffectivePartner`:
  `GET /bff/public/offer` (ver), `POST /bff/public/offer` (responder), `GET /bff/public/offer/file` (descargar),
  `POST /bff/public/offer/file` (subir), `GET /bff/public/offer/packages.csv` (bultos).
- **Bearer propio:** un client OAuth dedicado (`findair_public`, `client_credentials`), con el mínimo de permisos, distinto del
  del BFF de usuarios. El BFF pide el token y lo cachea (Redis, hasta su caducidad) en una pieza nueva
  (`ClientCredentialsTokenProvider`); hoy `OAuthClient` solo sabe `authorization_code` y `refresh_token`. Como
  `Public_Route_Policy` acepta cualquier Bearer válido, el token debe vivir solo en el servidor.
- **Límites:** `Throttler` ya limita por usuario e IP; las aerolíneas no tienen usuario, así que se añade una política
  `public_offer` por **IP** y por **oferta** (contra fuerza bruta del OTP: tras N fallos sobre una misma oferta, bloqueo
  temporal con 429 y mismo mensaje que «no encontrada»).
- **Cabeceras:** `Cache-Control: no-store`, `Referrer-Policy: no-referrer` (el OTP va en la URL), `X-Robots-Tag: noindex`,
  `X-Content-Type-Options: nosniff`; CSP propia de la página. `OriginMiddleware` ya exige mismo origen en las escrituras.
- **Respuestas indistinguibles:** oferta inexistente, OTP erróneo y oferta retirada devuelven lo mismo (`found:false`).

### 4.3 API (`tmwe_api`)

Todo detrás de `Public_Route_Policy`, con el OTP como segundo factor, sobre la base de `Public_Offer_Controller`.

1. **Ampliar la vista** (`Cargo_Offer_Service::get_public_offer`), con lista blanca de campos: nombre de la aerolínea,
   moneda, resumen de la carga (bultos, peso, volumen, aeropuertos, palés, mercancía), lista de bultos (con girable/apilable),
   ficheros de la expedición con `show_vettore='S'`, ficheros subidos por la aerolínea, y `state`: `open` / `answered`
   (editable) / `locked` (`controllata='S'` o `accettata='S'`). **Nunca** cliente final, notas internas, `debug_valori`,
   márgenes ni costes propios (regla: el cliente final no ve coste ni margen; la aerolínea solo ve su cotización).
2. **`POST` de respuesta** — `Cargo_Offer_Service::submit_carrier_quote($id, $otp, $payload, $ip)`:
   valida el OTP; rechaza si `locked`; solo acepta líneas que **pertenezcan a la oferta** y sean `somma='S'`; límites de
   longitud y de rango; `pesor` > 0; **recalcula `costo` en el servidor** con la fórmula de §2 (la moneda sale de la línea
   `tipo='V'` y no se puede cambiar); doble confirmación (precio y términos) como en `submit_quote`; guarda IP y fecha;
   `data_risp`. Reenvío permitido mientras no esté `locked` (paridad con el legado) **[D5]**.
3. **Aviso al operador:** correo por `Outbound_Mail_Service` al `insert_user` de la oferta (como `notify_operator_of_reply` en
   courier) con el importe y el enlace a la expedición; best-effort. La oferta queda con `data_risp` y `controllata='N'`, que ya
   enciende la marca roja y el filtro `has_pending_offers`.
4. **Ficheros:** `public_offer_file`. Subida: máx. 4 por oferta y 3 MB, lista blanca de extensiones **y comprobación del tipo
   real** (`finfo`), nombre en disco por `Document_Store` (`off_vtt<id>-<n>`), nunca el nombre original; descarga con
   `Content-Disposition: attachment` y `nosniff`. Descarga de los ficheros de la expedición con `Cargo_Files_Service::resolve_binary`.
5. **CSV de bultos** con OTP (el legado no lo exigía).
6. **PDF y correo `CRGO2`** (fase 3): PDF generado en el servidor (Dompdf ya está en `composer.json`) a partir de los datos, no
   capturando la URL; envío con `Outbound_Mail_Service` al contacto del vettore.
7. **Rutas y permisos:** alta en `config/routes/public.yml`, `Route_Inventory_Service`, OpenAPI y matriz de acceso; entrada en el
   ratchet de rutas sin seguro (`unsecured_routes.txt`) si procede.
8. **Pruebas:** unitarias del cálculo con **casos dorados compartidos** (un JSON de vectores que leen PHPUnit y Vitest, para que
   servidor y pantalla no puedan divergir), del OTP/estados, de la subida y del aviso; manifiestos de endpoints.

### 4.4 Pantalla (`web/apps/offer`)

Una página, en inglés (la aerolínea no tiene idioma asociado, como el RFQ), con estructura de i18n lista para añadir más **[D6]**.

- **Componentes:** `OfferShell` (logo del partner, título, estado), `RequestNote`, `FreightDetails` (bultos + resumen + leyenda
  girable/apilable + enlace CSV), `SharedFiles`, `CarrierFiles` (subida/descarga con progreso y errores por fichero),
  `ChargeTable` (solo lectura a la izquierda, campos editables a la derecha, total en vivo), `ReplyFields` (notas, schedule,
  referencia), `ConfirmAndSend` (casilla de precio y de términos), `ThankYou` (descargar PDF / recibir por correo, fase 3).
- **Cálculo:** función pura `computeOfferTotal(lines, chargeableWeight, parcels)` con la fórmula de §2 y los mismos vectores
  dorados que el servidor; el servidor manda siempre.
- **Estados:** cargando; no encontrada/inválida (mensaje genérico); respondida (editable, con aviso «puede modificarla hasta que
  se revise»); bloqueada (solo lectura); límite de intentos; error de red con reintento; subida rechazada por fichero.
- **Calidad:** responsive (el legado es de 950 px fijos), accesible (etiquetas, foco, teclado, `aria-live` en el total), sin
  guardar nada en el navegador, el OTP se quita de la barra con `history.replaceState` tras leerlo.
- **Logo:** servido por el BFF desde el API (no se publica `storage/loghi_partner`).

## 5. Fases

| Fase | Entrega | Cierra |
|---|---|---|
| 0 | Decisiones D1-D7 (abajo) y visto bueno a la superficie anónima | — |
| 1 | **Ver la solicitud:** vista ampliada en el API, grupo anónimo `GET` en el BFF con el Bearer propio y los límites, app `offer` con la pantalla en solo lectura, despliegue y Apache | el enlace del correo ya lleva a algo útil |
| 2 | **Responder:** `POST` con cálculo en servidor, estados, aviso al operador, pantalla editable con total en vivo y vectores dorados | P94 (núcleo) |
| 3 | **Ficheros y constancia:** subida/descarga, CSV, PDF y correo `CRGO2` | paridad completa con el legado |
| 4 | Reutilizar la misma estructura para la respuesta pública de los **couriers** (`public_express_offer`) y de los partners | — |

No enviar RFQs reales desde un entorno hasta que la fase 1 esté desplegada en él, y hasta la fase 2 la aerolínea solo podrá mirar.

## 6. Decisiones abiertas

| # | Decisión | Propuesta |
|---|---|---|
| D1 | App separada o entrada dentro de `operations` | App separada `web/apps/offer` |
| D2 | Superficie anónima del BFF con un client OAuth dedicado (`findair_public`) | Aceptarla; es la única forma de dar pantalla sin romper «nada sin aplicación identificada» |
| D3 | Enlace `?id&otp` o token opaco `t` (el de los couriers: `t` + 32 hex, no enumerable) | Empezar con `id`+`otp` (el correo ya lo manda) y migrar a `t` en la fase 4 |
| D4 | Caducidad de la solicitud | 30 días desde `data_rich` o hasta que se marque revisada (el legado no caducaba) |
| D5 | ¿Reenvío permitido hasta la revisión (legado) o una sola respuesta (couriers)? | Reenvío permitido hasta la revisión |
| D6 | Idiomas de la pantalla | Inglés; estructura lista para más |
| D7 | PDF y `CRGO2` en el alcance inicial | Fase 3, tras tener lo esencial |

**[verificar]** antes de empezar: que `spedizioni_cargo_off` tenga columnas de confirmación como `spedizioni_off`
(`confirmed`, `confirm_datetime`, `confirm_IP`; si no, migración o usar `insert_IP`); que exista un client OAuth con
`client_credentials` para el BFF público; la lista de extensiones permitidas (`b2bfileext`) y el tamaño (`b2bfilemaxmb`) del
sandbox; y qué plantilla `CRGO` hay en la BD del entorno (debe usar `!#OFFERURL#!`).

## 7. Riesgos

- **OTP en la URL:** se filtra por `Referer`, historial y registros del servidor. Mitigado con `Referrer-Policy: no-referrer`,
  `replaceState` y el paso a token opaco; el límite de intentos por oferta frena la fuerza bruta.
- **Subida de ficheros desde Internet:** tipo real, tamaño, cantidad, nombre en disco propio y descarga como adjunto. Valorar
  antivirus si el entorno lo tiene.
- **Superficie anónima en el BFF:** lista cerrada de 5 acciones, sin pasar la query completa, límites propios y sin sesión ni
  cookies.
- **Divergencia cálculo cliente/servidor:** vectores dorados compartidos en CI.

## 8. Criterios de aceptación

1. El enlace de un RFQ real abre la pantalla, con los datos de la solicitud, sin iniciar sesión.
2. La aerolínea responde; el total guardado es el que calcula el servidor, aunque la petición traiga otro.
3. El operador recibe el aviso, ve la marca de respuesta sin revisar en el listado y el detalle en la ficha de la cotización.
4. Una oferta revisada o retirada no admite cambios; un OTP erróneo no revela si la oferta existe, y se bloquea tras N intentos.
5. Los ficheros subidos solo son del tipo y tamaño permitidos y no se pueden descargar sin el OTP de su oferta.
6. Sin sesión, ninguna otra ruta del BFF responde; la lista de rutas anónimas es exactamente la de §4.2.
