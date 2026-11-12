# Expediente de erp_findair

> **Estado:** vigente · **Generado:** 2026-10-31 · Índice provisional de la fase 1.

Empezar por `contrato-con-api.md`. Los READMEs de código están junto al código: `../bff/README.md`, `../web/packages/scripts/I18N.md`.

| Documento | Título | Estado |
|---|---|---|
| [comparativa-jose-master.md](comparativa-jose-master.md) | Comparativa: Jose_master vs. BFF + Vue/Vuetify (erp_findair) | vigente en lo de producto; su sección «bugs del backend» está obsoleta |
| [contrato-con-api.md](contrato-con-api.md) | Contrato con el API (`tmwe_api`) | vigente |
| [informe-autenticacion-autorizacion.md](informe-autenticacion-autorizacion.md) | Informe: autenticación, autorización y roles en el ERP (SPA + BFF) tras el cambio del API | vigente (su implementación en la SPA es parcial) |
| [peticiones-backend.md](peticiones-backend.md) | Peticiones al backend (tmwe_json) | vigente como detalle técnico; la cabecera de abajo está desfasada (P01, P02 y casi P21 ya están resueltas en ` |
| [plan-consolidata-erp.md](plan-consolidata-erp.md) | Plan: gestión completa de los proyectos de consolidata desde el ERP | vigente (C0-C6 hechas sin commit; ver §10) |
| [plan-consolidata-cliente-final.md](plan-consolidata-cliente-final.md) | Plan marco de consolidata: cliente en tmwe-wueform, staff y partners en el ERP (plan B) | borrador |
| [plan-extraccion-ia-erp.md](plan-extraccion-ia-erp.md) | Plan: extracción por IA de datos de expedición desde el ERP (courier, cargo y consolidata) | borrador |
| [plan-migracion.md](plan-migracion.md) | Plan de migración ERP Findair (BFF + SPA) | vigente, parcialmente desfasado (cifras de 2026-10-18/19; el §3 «Pendiente en backend» está en parte resuelto, |
| [plan-pantalla-offer-aerolinea.md](plan-pantalla-offer-aerolinea.md) | Plan: pantalla de respuesta de la aerolínea a la cotización cargo (`/offer`) | borrador |
| [plan-rfq-courier-partners.md](plan-rfq-courier-partners.md) | Plan: RFQ courier a anagrafiche de tipo partner (ERP o no), parte BFF y SPA | borrador |
| [propuesta-home-minimalista.md](propuesta-home-minimalista.md) | Propuesta de home minimalista del ERP (menos botones, carga rápida) | vigente (implementada; incluye «Da fare oggi») |
| [plan-giacenze-ux.md](plan-giacenze-ux.md) | Plan: acceso y ficha de giacenza más simples (colas, ciclo guiado, mensajes) a partir del legado y Jose_master | borrador |
| [plan-listados-de-trabajo.md](plan-listados-de-trabajo.md) | Plan para migrar las colas de trabajo con filtros por defecto y acciones por lote de Jose_master al SPA | borrador |
| [cargo-paneles-tramos.md](cargo-paneles-tramos.md) | Ficha de cargo: tramos de recogida (panel izquierdo) y entrega (panel derecho) con el detalle de expedición | vigente |
| [plan-pruebas-ui.md](plan-pruebas-ui.md) | Plan de pruebas de la UI | borrador |
| [plan-pruebas-formularios.md](plan-pruebas-formularios.md) | Plan de pruebas de formularios de la UI (índice; fichas en `pruebas-formularios/`) | borrador |
| [plan-mitigacion-hallazgos-formularios.md](plan-mitigacion-hallazgos-formularios.md) | Plan de mitigación de los hallazgos de la revisión de formularios | borrador |
| [prompt-agente-guard-acceso-no-autorizado.md](prompt-agente-guard-acceso-no-autorizado.md) | Tarea: no montar el dashboard ERP para usuarios sin acceso (pantalla de "no autorizado") | pendiente de ejecutar (prompt de tarea; a 2026-10-31 no existe ningún componente `Unauthorized`/`Forbidden` y `web/apps/operations/src/main. |
| [prompt-agente-tmwe-json.md](prompt-agente-tmwe-json.md) | Tarea: preparar tmwe_json para el BFF de ERP Findair (segunda entrega) | obsoleto como prompt (refleja el estado de 2026-10-18; sus tareas 0, 3 y 4 ya están hechas en `sandbox`). Su l |
