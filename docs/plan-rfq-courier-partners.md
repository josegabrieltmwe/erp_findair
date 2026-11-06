# Plan: RFQ courier a anagrafiche de tipo partner (app erp_findair)

> **Estado:** borrador (selector y respuesta por OTP hechos) · **Última modificación:** 2026-11-06

Parte de la aplicación (BFF Slim + SPA Vue) del plan que lleva a las expediciones courier el flujo que ya tiene cargo. La parte del API está en `tmwe_api/docs/03-diseno/rfq_courier_partners.md`; el patrón de autorización por OTP y la pantalla de cargo, en `tmwe_api/docs/03-diseno/otp_autorizacion_recursos.md` y en [plan-pantalla-offer-aerolinea.md](plan-pantalla-offer-aerolinea.md).

## 1. Alcance (decidido)

- Destinatarios: **todas las anagrafiche `tipo='P'` activas, sean o no `erp_partner`**. Los `erp_partner` siguen siendo destinatarios válidos.
- El destinatario responde desde el enlace del correo, sin usuario ni login, con la misma sesión OTP del BFF que usa la aerolínea. No hay aplicación nueva, ni grupo anónimo, ni cliente OAuth nuevo.

## 2. Estado actual de la app

| Pieza | Estado |
|---|---|
| `PartnerOfferModal.vue` (envío a partners) con `selectable_partners.service.ts` → `api_selectable_partners` (búsqueda remota) | Existe; la lista llega **solo con `erp_partner`** porque así la filtra el API |
| Modal y store de ofertas a partner (`partner_offers.service.ts`/`.store.ts`), `ServizioCard.vue`, `ShipmentDetailLayoutV2.vue` | Existen: envío, listado de envíos y aceptar |
| Pantalla donde responde el destinatario | **No existe**: el enlace actual apunta al ERP legado (`/erp/tmwe_json/express_offer?t=…`). Solo hay `/offer`, que es de cargo |
| Sesión OTP del BFF (`POST /bff/auth/otp`, `OtpGate`, `Session::grant`) | Existe para el tipo `cargo_offer` |

## 3. Cambios en el BFF — **hecho 2026-11-06**

1. `OtpGate`: tipo `courier_offer` (OTP de hasta 33 caracteres: el token de la oferta). El tipo por defecto de `AuthController::otp` sigue siendo `cargo_offer`; el enlace lleva `type=` y la SPA lo envía en el canje.
2. `config/routes.bff.yaml`: `otp.courier_offer.view` y `otp.courier_offer.submit` (`api_courier_offer`, política `otp_submit`, cuerpo JSON de 16 kB). Una sesión de un tipo no atiende rutas del otro (403 `otp_scope`). El proxy inyecta `id`/`otp` desde la sesión y quita `id`/`otp`/`type` del cuerpo.
3. Si más adelante se añaden ficheros o PDF (§6), reutilizan `multipart: true` y las políticas `otp_upload`/`otp_mail`.
4. Pruebas en `tests/OtpFlowTest.php` (canje de un `courier_offer`, forma del OTP por tipo, cruce de tipos y rutas reales del manifiesto): 237 en verde.

## 4. Cambios en la SPA

1. **Selector de partners** (`PartnerOfferModal.vue`, `selectable_partners.service.ts`) — **hecho 2026-11-06** (salvo el aviso de partner sin contacto y el filtro «solo ERP», ver abajo):
   - Pide `scope=all` (todos los tipo P) y muestra la etiqueta «ERP» en las que lo son. **No se hizo el filtro «solo ERP»**: con los ERP primero en la lista y la etiqueta no aportaba; el servicio ya admite `scope=erp` si se pide.
   - Búsqueda remota: el `EmailComposer` admite ahora `searchRecipients(term)` en el adapter (genérico, lo puede usar cualquier escenario) y `RecipientPicker` consulta al teclear (2 caracteres, 250 ms, descarta respuestas viejas). Sin texto se muestran los 30 primeros, ERP primero.
   - **Pendiente:** si el partner elegido no tiene contacto elegible, el modal debería avisarlo antes de enviar. Hoy el API devuelve `<id>: no eligible contacts (offerte_mail)` al enviar, y los correos manuales (`extra_emails`) ya permiten salvar el caso; el aviso previo necesita que el API diga si hay contactos elegibles.
2. **Pantalla del destinatario — hecho 2026-11-06.** Ruta `/offer` única (`src/pages/OtpOfferEntry.vue`) que decide por el tipo de recurso que autorizó el OTP: `courier_offer` → `CourierOfferPage`; cualquier otro (y los enlaces antiguos sin `type`) → `CarrierOfferPage`. `bootstrapOtp` envía el `type` del enlace si tiene forma de tipo. `CourierOfferPage.vue` (módulo `shipment`) muestra: datos de la expedición (sin cliente final, sin coste ni margen), bultos, suplementos, DGR y COD, el mensaje del operador, y el formulario de precio, divisa, plazo y notas con doble confirmación; una sola respuesta. La lógica del formulario es pura (`courierOfferForm.ts`, con spec); los errores de acceso reutilizan los textos de la pantalla de cargo.
3. **Enlace del correo — hecho 2026-11-06.** `distribute` de courier y de partner, y las vistas previas, mandan `callback_url` con `mailCallbackUrl("shipmentQuoteOffer")` (clave nueva en `appPageUrl`).
4. **Operador (fase posterior).** En el listado courier, badge «N por revisar» con filtro; en la ficha, estado «respuesta por revisar» y acción «Reenviar».
5. i18n en los cinco idiomas (es, en, it, de, nl) para todo texto nuevo; el gate `check:i18n` no puede subir.

## 5. Pruebas y comprobación

- BFF: `phpunit` completo y `phpstan` sin errores nuevos respecto a la línea base.
- SPA: `vitest`, `vue-tsc` y `check:i18n`; pruebas del selector (etiqueta ERP, búsqueda, partner sin contacto) y de la pantalla (envío, validación, oferta bloqueada).
- Recorrido en el navegador en local: enviar a una anagrafica P `erp_partner` y a otra que no lo es; abrir el enlace; responder; ver la respuesta en la ficha. El correo sale redirigido en local (`MAIL_DEV_REDIRECT`).
- Pendiente de comprobar en el sandbox: el cliente `client_credentials` del BFF, el fallback de Apache para `/offer`, un RFQ courier real con correo real.

## 6. Orden y despliegue

1. Selector abierto a todos los tipo P (API §3.1 y §3.2 + SPA §4.1): **hecho 2026-11-06**, sin migración.
2. Respuesta por OTP (API §3.3 + BFF §3 + SPA §4.2 y §4.3): **hecho 2026-11-06**. Se despliega API → BFF → SPA.
3. Indicador «por revisar» y «Reenviar» (API §3.4 + SPA §4.4).
4. Ficheros y PDF del destinatario, solo si el negocio lo pide (no están hoy en el flujo courier).
5. Retirar `public_express_offer` tras el plazo de gracia de los enlaces antiguos.
