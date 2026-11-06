# Plan: RFQ courier a anagrafiche de tipo partner (app erp_findair)

> **Estado:** borrador · **Última modificación:** 2026-11-06

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

## 3. Cambios en el BFF

1. `OtpGate`: registrar el tipo `courier_offer` (formato del OTP y del token `t…` de los enlaces ya enviados). El tipo por defecto de `AuthController::otp` sigue siendo `cargo_offer`; el enlace lleva el tipo y la SPA lo envía en el canje.
2. `config/routes.bff.yaml`: rutas OTP del nuevo recurso (`otp: courier_offer`) para ver y responder (`api_courier_offer`), con la política `otp_submit` y el cuerpo JSON acotado, igual que `otp.cargo_offer.submit`. El proxy inyecta `id`/`otp` desde la sesión y quita `id`/`otp`/`type` del cuerpo.
3. Si más adelante se añaden ficheros o PDF (§6), reutilizan `multipart: true` y las políticas `otp_upload`/`otp_mail`.
4. Pruebas en `tests/OtpFlowTest.php` y fixture de rutas: una ruta de usuario no atiende a una sesión OTP y al revés, el OTP de otro tipo no abre este recurso, sin sesión no hay `Set-Cookie`.

## 4. Cambios en la SPA

1. **Selector de partners** (`PartnerOfferModal.vue`, `selectable_partners.service.ts`):
   - Pedir `scope=all` (todos los tipo P) y mostrar en cada opción la etiqueta «ERP» cuando `erp_partner` sea verdadero, para que el operador distinga. Opción de filtrar solo ERP.
   - Búsqueda remota obligatoria (miles de anagrafiche): sin texto se muestran los ERP primero, con tope de 30.
   - Si el partner elegido no tiene contacto elegible, el modal avisa y deja escribir correos manuales (ya existe `extra_emails`) en lugar de fallar al enviar.
2. **Pantalla del destinatario.** Ruta `/offer` única que decide por el tipo de recurso (decisión abierta en el plan del API, §3.5), con `meta.otp`. Para courier muestra: datos de la expedición (sin cliente final, sin coste ni margen), formulario de precio, divisa, texto y horario, doble confirmación y agradecimiento; reutiliza `bootstrapOtp`, el shell a pantalla completa y los componentes comunes de `CarrierOfferPage` (cabecera, confirmación, tarjeta de agradecimiento). `CourierOfferPage.vue` nueva en el módulo `shipment`; sin duplicar la lógica de OTP.
3. **Enlace del correo.** El modal de envío y los envíos desde `ServizioCard` pasan `callback_url` con `mailCallbackUrl(...)` (clave nueva en `appPageUrl`), igual que `distribute` de cargo.
4. **Operador (fase posterior).** En el listado courier, badge «N por revisar» con filtro; en la ficha, estado «respuesta por revisar» y acción «Reenviar».
5. i18n en los cinco idiomas (es, en, it, de, nl) para todo texto nuevo; el gate `check:i18n` no puede subir.

## 5. Pruebas y comprobación

- BFF: `phpunit` completo y `phpstan` sin errores nuevos respecto a la línea base.
- SPA: `vitest`, `vue-tsc` y `check:i18n`; pruebas del selector (etiqueta ERP, búsqueda, partner sin contacto) y de la pantalla (envío, validación, oferta bloqueada).
- Recorrido en el navegador en local: enviar a una anagrafica P `erp_partner` y a otra que no lo es; abrir el enlace; responder; ver la respuesta en la ficha. El correo sale redirigido en local (`MAIL_DEV_REDIRECT`).
- Pendiente de comprobar en el sandbox: el cliente `client_credentials` del BFF, el fallback de Apache para `/offer`, un RFQ courier real con correo real.

## 6. Orden y despliegue

1. Selector abierto a todos los tipo P (API §3.1 y §3.2 + SPA §4.1): sin migración.
2. Respuesta por OTP (API §3.3 + BFF §3 + SPA §4.2 y §4.3). Se despliega API → BFF → SPA.
3. Indicador «por revisar» y «Reenviar» (API §3.4 + SPA §4.4).
4. Ficheros y PDF del destinatario, solo si el negocio lo pide (no están hoy en el flujo courier).
5. Retirar `public_express_offer` tras el plazo de gracia de los enlaces antiguos.
