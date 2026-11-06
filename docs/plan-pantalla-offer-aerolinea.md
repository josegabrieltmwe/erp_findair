# Plan: pantalla de respuesta de la aerolínea a la cotización cargo (`/offer`)

> **Estado:** borrador · **Última modificación:** 2026-11-06 · **Revisión 4:** punto de autorización por OTP como primer paso; el token es el Bearer OAuth de la aplicación (sustituye a las revisiones 1 a 3)

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

## 4. Diseño (revisión 2)

Premisas: el API no recibe interfaz; **no se crea ninguna aplicación nueva**; el flujo va entre el API y `erp_findair` (SPA + BFF);
el OTP del correo hace de login para esa vista; **el token es el Bearer OAuth de la aplicación** (`client_credentials`): lo
emite el API, solo lo guarda el BFF y va en cada llamada al API; nunca llega al navegador de la aerolínea, que solo tiene una
cookie de sesión opaca. Explicado con diagramas en el artifact «Respuesta de
aerolínea al RFQ».

### 4.1 Punto de autorización por OTP (primer paso de todo el flujo)

La aerolínea **no tiene un registro en `contatti`**: no hay autenticación de usuario. Lo que sí hay es un OTP que garantiza que quien
lo presenta está **autorizado a entrar a ese recurso** (esa oferta). Por eso lo primero que se construye y lo primero que ocurre es
un punto de autorización, y nada más se atiende antes de pasarlo. Cada actor hace una cosa distinta:

| Quién | Qué garantiza |
|---|---|
| La aerolínea | Autorización al recurso: el OTP del correo (`id` + `otp`). |
| El BFF (app client) | **Autenticación ante el API:** negocia un Bearer `client_credentials` y lo guarda en la sesión (sellado con `TokenVault`). |
| El API | Verifica el OTP contra el recurso y vuelve a verificarlo en cada llamada; no confía en la sesión del BFF. |

Orden:
1. El correo lleva `<origen de la SPA>/offer?id=<oferta>&otp=<otp>` (ya construido con `callback_url`).
2. La SPA abre la ruta `/offer` (`meta.otp`, `fullscreen`, dentro del módulo cargo). `main.ts` tiene una rama: si la ruta es OTP, no llama
   a `bootstrapBff()` (que redirige al login) sino al punto de autorización, `POST /bff/auth/otp {id, otp}`.
3. **Autorización.** El BFF negocia su Bearer (`client_credentials`, método nuevo de `OAuthClient`) y llama al API, `POST api_otp_authorize
   {type:'cargo_offer', id, otp}`. El API responde `{authorized, resource:{type,id}, scopes, expires_at}` o, si no, siempre lo mismo.
4. **Solo si está autorizado** se crea la sesión (`Session::regenerate`): Bearer sellado + una **concesión** `{type, id, otp (sellado), scopes,
   granted_at}` + CSRF. Un intento fallido **no crea sesión** (no hay fijación ni sesiones basura) y suma al contador.
5. Cada petición posterior va por `/bff/v1/*`: `AuthMiddleware` deja pasar una sesión con concesión **solo a rutas del manifiesto
   marcadas `otp: <tipo>`**; el proxy **toma `id` y `otp` de la concesión** (ignora los del navegador) y añade el Bearer de la sesión.
   El API vuelve a comprobar el OTP en cada endpoint.
6. El Bearer de `client_credentials` no tiene refresh token: `TokenRefresher` lo renegocia al caducar. La sesión se destruye por
   inactividad, al enviar la respuesta o al bloquearse la oferta, y se **revoca** el Bearer (`OAuthClient::revoke`).
7. En modo OTP un 401 muestra «enlace caducado» (hoy `bff.ts` y `anagrafiche/services/http.ts` redirigen al login).

**Límite de intentos: en el BFF, no en el API.** `Rate_Limiter_Service` del API es un no-op sin APCu y APCu no está instalado (lo dice
`Public_Cod_Guard_Trait`). El BFF sí tiene `RedisCounterStore`/`Throttler`: política `otp_authorize` por IP y por recurso (`tipo:id`),
con bloqueo temporal tras N fallos y la misma respuesta que «no existe». El OTP de las ofertas cargo es corto (10 caracteres), así
que el bloqueo por recurso es lo que realmente lo protege.

No hace falta cliente OAuth nuevo: `Client_Credentials_Controller` no restringe el grant por cliente **[verificar en el sandbox]**. La
única ruta nueva del BFF sin sesión previa es `POST /bff/auth/otp`, como `login` y `callback`.

### 4.2 API (`tmwe_api`, sin interfaz)

Todo con el Bearer de la aplicación (`Public_Route_Policy`). La autorización por OTP se construye **genérica y reutilizable**, siguiendo la
puerta que ya existe para COD (`Public_Cod_Guard_Trait`): una sola implementación para que todos los endpoints con OTP respondan idéntico.

0. **Punto de autorización** (fase 1, lo primero): `Otp_Resource_Authorizer` (singleton, `Abstract_Service`) con un registro de resolutores
   por tipo de recurso (`Abstract_Otp_Resolver`; el primero, `Cargo_Offer_Otp_Resolver`, sobre `Spedizioni_Cargo_Off::get_public_by_id_otp`:
   `stato='A'` y no caducada) y el controlador `api_otp_authorize`. Un trait de controlador, `Otp_Guard_Trait`, lo aplica en cada
   endpoint protegido y devuelve siempre `200 {found:false}` ante un OTP erróneo, un recurso retirado o caducado. Registra los eventos
   en `Security_Events_Logger`. Mañana pueden enchufarse la oferta courier, la oferta al cliente, COD o el tracking sin tocar el BFF.
1. **Ampliar la vista** (`Cargo_Offer_Service::get_public_offer`, lista blanca): aerolínea, moneda, resumen de carga, bultos, ficheros
   de la expedición con `show_vettore='S'`, ficheros de la aerolínea y `state` ∈ `open` / `answered` / `locked`. Nunca cliente final,
   notas internas, márgenes ni costes propios.
2. **`submit_carrier_quote($id, $otp, $payload, $ip)`**: líneas solo de la oferta y `somma='S'`; rangos y longitudes; `pesor` > 0;
   **total recalculado en el servidor** con la fórmula de §2; doble confirmación; IP y fecha; `data_risp`. Reenvío permitido mientras no
   esté `locked`.
3. **Aviso al operador** por `Outbound_Mail_Service` (patrón de `notify_operator_of_reply` en `Express_Offer_Service`); la oferta queda con
   `controllata='N'`, que ya enciende `has_pending_offers`.
4. **Ficheros** sobre `Document_Store` (`off_vtt<id>-<n>`): máx. 4 y 3 MB, extensiones permitidas y tipo real (`finfo`), descarga como
   adjunto con `nosniff`. Ficheros de la expedición con `Cargo_Files_Service::resolve_binary`. **CSV de bultos con OTP.**
5. **PDF y correo `CRGO2`** (fase 3): Dompdf en el servidor + `Outbound_Mail_Service` + `Modelli_Template_Service`.
6. **Reenviar** (fase 4): extraer de `send_rfq_to_carrier` el envío de una sola oferta; deja `controllata='N'` y el asunto «… - UPDATE».
7. Altas en `public.yml`, `Route_Inventory_Service`, OpenAPI y matriz de acceso; pruebas con **casos dorados compartidos** del cálculo.

### 4.3 BFF y SPA: lo que se añade

- **BFF:** `AuthController::otp()`; grant `client_credentials` en `OAuthClient` con caché; sesión de tipo `otp`; atributo `otp` en el
  manifiesto; `AuthMiddleware` y proxy con el alcance de la sesión; política de límites por oferta e IP. Se reutilizan `Session`,
  `SessionMiddleware`, `TokenVault`, `CsrfGuard`, `OriginMiddleware`, `ProxyController` (binario, stream, límites) y las cabeceras de
  `SecurityHeaders` (`Referrer-Policy: no-referrer`, `no-store`).
- **SPA:** ruta `/offer`; rama OTP en `main.ts`; manejo del 401 en modo OTP; vista y componentes en `modules/cargo` (cabecera con logo,
  nota, bultos y leyenda, ficheros, tabla de líneas con total en vivo, notas, horario, referencia, confirmación, agradecimiento);
  función pura del total con los mismos casos que el servidor; claves en los cinco idiomas del módulo (inglés por defecto).

## 5. Fases

| Fase | Entrega | Pasos del legado que cierra |
|---|---|---|
| 1 · Autorizar y ver | **Primero el punto de autorización** (API + BFF + concesión en sesión + límite de intentos), después `/offer` en solo lectura y la vista pública ampliada | acceso por OTP, mostrar la solicitud, solo lectura tras revisión |
| 2 · Responder | `submit_carrier_quote`, estados, aviso al operador, total en vivo | recalcular, enviar, aviso |
| 3 · Ficheros y constancia | Subida/descarga, CSV, PDF y correo `CRGO2` | ficheros, CSV, PDF |
| 4 · Operador | Indicador de respuestas sin revisar en lista y ficha, acción «Reenviar» | marca `ofstat`, reenvío |

No enviar RFQs reales desde un entorno hasta que la fase 1 esté desplegada en él.

## 6. Decisiones abiertas

| # | Decisión | Propuesta |
|---|---|---|
| D1 | Qué es «el token» | **Cerrada:** el Bearer OAuth de la aplicación (`client_credentials`), solo en el BFF |
| D2 | Caducidad de la sesión OTP y de la solicitud | inactividad corta; solicitud 30 días o hasta la revisión (el legado no caducaba) |
| D3 | Reenvío de la respuesta | permitido hasta la revisión (como el legado) |
| D4 | Idioma | inglés, claves en los cinco idiomas |
| D5 | Enlace `?id&otp` o token opaco `t` (el de los couriers) | `id`+`otp` ahora; `t` en una fase posterior |
| D6 | PDF y `CRGO2` en el alcance inicial | fase 3 |
| D7 | Dónde se guarda el Bearer negociado | **En la sesión OTP**, sellado con `TokenVault`: reutiliza `AuthMiddleware` y `TokenRefresher` y permite revocarlo al cerrar. La alternativa (un token de app cacheado y compartido) evita un token por visita pero rompe esa reutilización y la revocación por sesión |

**Comprobado el 2026-11-06 (BD de desarrollo):** `spedizioni_cargo_off` **no tiene** `confirmed`, `confirm_datetime` ni `confirm_IP`
(solo `owner_user`, `insert_datetime`, `insert_user`, `insert_IP`, `data_risp`, `file_name1..4`, `otp`…). Para no añadir una migración, la
respuesta se audita como en el legado (`data_risp` + `insert_IP`) y la doble confirmación (precio y términos) se exige en el servidor sin
persistirla; IP, oferta e importe van además al log. (`oauth_client` no existe en esa BD: ver abajo.)

**[verificar en el sandbox]** (no se puede desde desarrollo): que el cliente del BFF tiene secreto y admite `client_credentials`; las
extensiones y el tamaño de subida (`b2bfileext`, `b2bfilemaxmb`); que la plantilla `CRGO` de la BD use `!#OFFERURL#!`; que el proxy reenvíe
bien un cuerpo `multipart` con el límite de la ruta (se prueba en local al construir).

## 7. Riesgos

- **OTP corto y límite de intentos:** el OTP es de 10 caracteres y el limitador del API no funciona sin APCu; la protección real es el bloqueo por recurso en el BFF (Redis). Valorar alargar el OTP en los RFQ nuevos.
- **OTP en la URL:** `Referer`, historial y registros. Mitigado con `no-referrer`, `replaceState`, sesión propia y límite de intentos.
- **Subida de ficheros desde Internet:** tipo real, tamaño, cantidad y nombre propio en disco.
- **Una ruta del BFF sin sesión previa** (`/bff/auth/otp`): como `login` y `callback`; el API sigue sin exponer nada. Dejarlo por escrito.
- **Divergencia cálculo cliente/servidor:** casos dorados compartidos en CI.

## 8. Criterios de aceptación

1. El enlace de un RFQ real abre la vista en la propia SPA, sin iniciar sesión.
2. La aerolínea responde y el total guardado es el que calcula el servidor, aunque la petición traiga otro.
3. El operador recibe el aviso y ve la respuesta sin revisar en la lista y en la ficha.
4. Una oferta revisada no admite cambios; un OTP erróneo no revela si la oferta existe y se bloquea tras N intentos.
5. Sin pasar el punto de autorización no existe sesión; un intento fallido no crea sesión y, tras N fallos sobre una oferta, se bloquea con la misma respuesta que «no existe».
6. Con la sesión OTP no se puede llegar a ninguna ruta del BFF que no sea de esa oferta, ni pedir otra oferta.
7. Los ficheros subidos son del tipo y tamaño permitidos y no se descargan sin la sesión de su oferta.
