# Plan: auto-registro de clientes en FindAir (parte del ERP)

> **Estado:** vigente · **Última modificación:** 2026-11-26

El plan completo, con decisiones, modelo de datos, seguridad y fases, está en el api: `tmwe_api/docs/03-diseno/autoregistro/PLAN_AUTOREGISTRO.md` (rama `feat/autoregistro`). Este documento solo recoge lo que toca al ERP; si los dos se contradicen, manda el del api.

## Resumen

- Cualquiera puede crear una cuenta desde FindAir. La cuenta nace como **prospecto**: puede cotizar, pero no reservar.
- La aprueba el **titular del cliente** desde este ERP. Una vez aprobada, la cuenta reserva pagando **con tarjeta**.
- Las cuentas nuevas son **solo FindAir**: no entran al B2B legacy.

## Qué se hace aquí

- **Cola y ficha de solicitudes de registro** (Ajustes › Anagrafica, `/settings/anagrafica/registrations/<id>`): filtros por estado y fecha; cada partner ve solo las suyas. La ficha muestra datos, VIES, IP, cotizaciones desde el alta y posibles duplicados. **Aprobar** confirma o corrige los datos fiscales y la sede (el api asigna `findair_basic` y la política `CARD_REQUIRED`); **rechazar** pide un motivo interno y un texto opcional para el cliente.
- **Configuración del autoregistro por titular** (`self_registration_config`): activado (por defecto no), URL de activación, URL y versiones de privacidad y condiciones, emails de aviso, método de pago con tarjeta, Turnstile obligatorio.
- **Ficha del contacto:** indicador "Credencial segura (solo FindAir)" cuando el contacto tiene fila en `contatti_credential`.
- **Campana:** la notificación de solicitud nueva enlaza a la ficha.
- **i18n:** 5 idiomas, formato local de fechas, `check:i18n`.
- **BFF:** rutas manuales en `bff/config/routes.bff.yaml`.
- **Contrato:** los endpoints `api_self_registration*` están en **P147** de [contrato-con-api.md](contrato-con-api.md).
- **Postfacturación con tarjeta:** «Cobrar postfacturación» en la caja de postfacturación del envío express y cargo (`api_booking_postcharge`, **P148**; pendiente del api: **P149**).

## Fases que tocan este repo

| Fase | Contenido | Depende de |
|---|---|---|
| 3. Aprobación | Cola, aprobar y rechazar, configuración, recordatorios, ficha de credencial, P147 | Fase 1 del api |

## Estado (2026-11-25, rama `feat/autoregistro`)

Fase 3 hecha en el ERP, sin probar todavía contra un api desplegado:

- [x] **BFF:** `api_self_registration_admin` (GET/POST) y `api_self_registration_config` (GET/PUT) en `bff/config/routes.bff.yaml`, con prueba (`bff/tests/SelfRegistrationRoutesTest.php`).
- [x] **Cola** `/settings/anagrafica/registrations`: filtros por estado (por defecto, pendientes de decisión), fechas y búsqueda; TMWE puede acotar por titular; aviso "+48 h".
- [x] **Ficha** `/settings/anagrafica/registrations/<id>` (destino de la campana): datos, trazabilidad (IP, navegador, consentimiento y versiones), cuenta creada, VIES ("Comprobar VIES" con `api_anagrafica_vies`), posibles duplicados, aprobar con correcciones y rechazar con motivo interno y mensaje opcional.
- [x] **Configuración** del titular `/settings/anagrafica/registrations/config`, solo TMWE o `partner:manage`.
- [x] **Menú de Ajustes:** tarjetas en Anagrafica; la cola con `erp:view` y la configuración con `partner:manage`.
- [x] **Ficha del contacto:** distintivo "Credencial segura (solo FindAir)", sin enviar perfil, regenerar contraseña ni acceso B2B; mensaje claro ante 409 `HASHED_CREDENTIAL`.
- [x] **i18n:** 5 idiomas, fechas y horas en formato local (el api manda UTC); `check:i18n` igual que antes de empezar (381 frente a 377 del baseline, deuda previa).
- [ ] **Pendiente del api** (ver P147): país de la IP y cotizaciones desde el alta en la ficha; `vies_result` de la solicitud nunca se rellena.
- [x] **Postfacturación con tarjeta (P148):** panel en la caja de postfacturación del envío (express y cargo), ruta del BFF y textos en 5 idiomas.
- [ ] **Pendiente del api** (ver P149): saber si el cliente de un envío paga con tarjeta, para no ofrecer el botón a los clientes normales.
- [ ] **Pendiente:** probar el flujo completo contra un api con la rama `feat/autoregistro` desplegada.
