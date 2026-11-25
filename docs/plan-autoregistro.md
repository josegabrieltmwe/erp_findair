# Plan: auto-registro de clientes en FindAir (parte del ERP)

> **Estado:** borrador · **Última modificación:** 2026-11-25

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
- **Contrato:** los endpoints `api_self_registration*` se piden como **P147** en `contrato-con-api.md` cuando se aborden.

## Fases que tocan este repo

| Fase | Contenido | Depende de |
|---|---|---|
| 3. Aprobación | Cola, aprobar y rechazar, configuración, recordatorios, ficha de credencial, P147 | Fase 1 del api |
