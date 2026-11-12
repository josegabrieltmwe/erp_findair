# Plan marco de consolidata: cliente en `tmwe-wueform`, staff y partners en el ERP

> **Estado:** borrador (plan B ejecutado salvo B6 y B8; plan A implementado detrás del flag, pendiente de A0 y A5) · **Última modificación:** 2026-11-12

Sustituye al borrador anterior de este mismo fichero (que ponía la página del cliente en esta SPA; K0 demostró que no es viable, ver §2). Son dos planes que comparten el mismo API y no crean nada nuevo en él:

| Plan | Aplicación | Para quién | Documento |
|---|---|---|---|
| **A** | `tmwe-wueform` (frontal de cliente) | Clientes finales | `tmwe-wueform/docs/plans/PLAN_MIS_PROYECTOS_CONSOLIDATA_2026-11-12.md` |
| **B** | `erp_findair` (esta SPA + BFF) | Personal de TMWE y de partners | §5 de este documento |

Relacionado: [plan-consolidata-erp.md](plan-consolidata-erp.md) (gestión del staff, implementado), [contrato-con-api.md](contrato-con-api.md) sección K.

**Cómo se hizo (2026-11-12):** lectura de `erp_findair`, `tmwe-wueform` y `tmwe_api` (rama `sandbox`), y consultas **solo `SELECT`** a `tmwe_sandbox_db`. No se escribió nada en la BD. Los valores de BD son de sandbox; **no se han comprobado en producción**.

Principio: **no duplicar**. Ni roles, ni scopes, ni migraciones, ni tablas, ni endpoints nuevos. Lo que ya existe se reutiliza.

---

## 1. Aplicaciones revisadas

| Aplicación | Qué es | Papel en este plan |
|---|---|---|
| `tmwe_api` | Backend. Decide el acceso. | Sin cambios de código ni de BD |
| `erp_findair` | SPA Vue + BFF Slim 4 del ERP | Plan B: staff y partners |
| `tmwe-wueform` | Frontal de cliente (wizard de envíos, PHP Slim + Vue). Contiene `modules/consolidation` (antes el plugin de WordPress) | Plan A: clientes |
| `tmwe_doc` | Portal de documentación de la API | No participa |
| `Jose_master` | Documentación del ERP legado | Solo consulta |

## 2. Cómo controla el acceso cada aplicación

Regla común: **el acceso lo decide el API** por scopes efectivos = scopes del rol de la persona ∩ techo del cliente OAuth de la aplicación. Ninguna de las dos aplicaciones decide permisos por su cuenta (la SPA solo oculta pantallas; `wueform` declara que «no conoce los scopes del usuario»).

| | ERP (`erp_findair`) | Cliente (`tmwe-wueform`) |
|---|---|---|
| Cliente OAuth (sandbox) | 17 «ERP Findair (BFF)» | 19 «FindAir Slim» |
| Techo | `app_internal_erp_staff` (también existen `app_internal_erp` y `app_partner_erp`) | `b2b_partner_portal_voice` |
| Tipo de techo | **Interno**: `Security_Service::erp_access_denied` exige además `erp:view` | **No interno**: no exige `erp:view` |
| Quién entra | Quien tenga el rol `erp_operator` (`erp:view`): personal de TMWE y de partners ERP. Un cliente final **nunca** recibe `erp_operator` | Cualquier cliente con su rol `findair_basic` |
| Scopes de consolidata en el techo | `consolidation:manage` (en los tres techos `app_*`) | Ninguno de consolidata. Lleva `shipment:read/write`, `rate:read`, `ai:extract`, `ai:generate`, `address_book:write` |
| Actor que ve el API | Staff TMWE (anagrafica 1) o staff de partner (`consolidation:manage` + partner activo); lo acota `Consolidation_Access_Policy` | **Cliente**: solo sus proyectos (`id_cliente` = su anagrafica) |
| Acciones permitidas | Todas las del catálogo | Solo las de audiencia `both` |

Consecuencias:

- **Un partner que entre por `wueform` actúa como cliente**, porque ese techo no lleva `consolidation:manage`. Para gestionar como staff tiene que usar el ERP. Es coherente y no hay que cambiarlo.
- **Un cliente no puede usar el ERP** (K0, ver `plan-consolidata-erp.md` §11 y la regla de `Erp_Operator_Provisioner`). Abrir las rutas de la SPA a `shipment:write` no sirve de nada.
- El rol `consolidation_manager` (269 asignaciones) y el scope `consolidation:manage` **ya existen** y cubren el lado del staff. No hay que crear nada para clientes: el API trata como cliente a todo el que no es staff.

## 3. Reparto del ciclo de vida

Recorrido ya definido por el API: `create`/`create_from_option` → `request_quote` (A→P) → el staff responde (`answer_quote`) → el cliente acepta (`close`, →C) → el staff convierte (`operate`).

| Paso | Quién | Dónde | Estado |
|---|---|---|---|
| Alta y cotización (varios remitentes, bultos, análisis, opciones) | Cliente | `wueform`, modo «Project» del wizard | Hecho; **apagado por flag** (`project_mode_enabled`) y sin probar contra sandbox con un cliente real |
| Ver «Mis proyectos», estado, respuesta del staff | Cliente | `wueform` | **Falta**: la página `/projects/` (y su entrada de menú) se retiró a propósito al migrar el plugin (`docs/slim/MIGRACION_SLIM.md`, «decisión del responsable»); con ella se perdieron lista, abrir proyecto, cerrar, reabrir y cancelar. Hay que confirmar que esa decisión se revierte (DC-7) |
| Aceptar / reabrir / cancelar | Cliente | `wueform` | **Falta** (el proxy ya permite `close`, `reopen`, `cancel`, `list`, `get`) |
| Pedir precio al staff | Cliente | `wueform` | Hecho (`request_quote`) |
| Recibir la solicitud, responder precio, ajustar tramos | Staff y partners | ERP | Hecho (listado con fase «pendiente de respuesta», detalle, `answer_quote`) |
| Convertir a operativo (`operate`/`convert`) | Staff y partners | ERP | Hecho; con defectos por corregir (§5) |
| Crear o cotizar en nombre de un cliente | Staff y partners | ERP | Hecho (`create` con `id_cliente`, simulador) |

El cliente **no edita houses** una vez creado el proyecto: el proxy de `wueform` no admite `add_shipment`/`update_shipment` por decisión de diseño (el borrador vive en el navegador hasta «Aplicar»). Se mantiene.

## 4. Plan A (cliente, `tmwe-wueform`)

**Estado (2026-11-12): A1-A4 implementadas** detrás del flag `project_mode_enabled` (apagado por defecto), sin tocar el API ni la BD: página `/consolidata/` («Mis proyectos»: lista, detalle, aceptar, reabrir, cancelar y pedir precio), entrada de menú, 58 textos en 9 idiomas y pruebas. **Pendientes:** A0 (recorrido manual en sandbox con un cliente real) y A5 (activación). Detalle, desviaciones y pasos de activación en el documento de `wueform`.

Resumen; el detalle está en el documento de `wueform`:

1. Verificar el modo «Project» contra sandbox con un cliente real (pendiente de su F0.6).
2. Página «Mis proyectos» (lista, detalle, aceptar, reabrir, cancelar) con el proxy y la lista blanca que ya existen; reutiliza los componentes de dirección y el estilo del wizard.
3. Volver a ofrecer la entrada de menú (retirada a propósito en la migración a Slim).
4. Activar el flag de forma controlada.

## 5. Plan B (staff y partners, `erp_findair`)

No hay página nueva: el ERP ya tiene listado, detalle, simulador y conversión. Solo hay que cerrar lo que quedó pendiente y ajustar al flujo con clientes reales.

| # | Trabajo | Origen | Tamaño |
|---|---|---|---|
| B1 | **HECHO.** **Conversión:** desactivar `operate` con conversión completa; ocultar `convert` si hay pasos de `operate`; no confundir cualquier error de `view=conversion` con «el API no lo expone» (`loadSteps` y `loadLog`) | Revisión 2026-11-12, puntos 2-4 | S |
| B2 | **RESUELTO SIN CAMBIOS.** El catálogo del API solo permite `cancel` desde A y P, así que la SPA no lo ofrece en un proyecto en C; `reopen` ya está bloqueado con conversión. El único riesgo restante (reabrir por API y luego cancelar) es del API (P70), no de la SPA | Revisión, punto 1; P70 | — |
| B3 | **HECHO** (respuestas tardías de otro proyecto descartadas; `meta` sigue cacheado por sesión, sin cambio). **Detalle:** control de carrera al cambiar de proyecto (`AbortController`), sin `project.value!` sin guardia, `meta` que se refresca | Revisión, puntos 5-7 | S |
| B4 | **YA ESTABA HECHO** (`ConsolidataReadinessTab` oculta «ignorar» si `severita === 'error'`). **Cumplimiento:** no ofrecer «ignorar» en avisos de nivel error (comprobar P70 en el front) | Revisión, punto 8 | S |
| B5 | **HECHO** (diálogo «Completar perfil» en la pestaña Conversión, solo envía los campos cambiados). **`update_profile`** en la pestaña Conversión (completar el perfil de una house sin spedizione; hoy solo por API) | `plan-consolidata-erp.md` §12 | M |
| B6 | **REDUCIDO.** El listado ya tiene los mosaicos «Pendientes de respuesta» y «Sin asignar» con recuento (`queue_counts`). Un tile en la portada exige una fuente de recuento nueva en el cockpit compartido (`packages/platform/dashboard`, usado por varias SPAs): se deja como tarea aparte si negocio lo pide. **Aviso de solicitudes de clientes:** el cliente de `wueform` solo puede `request_quote`; el staff debe verlo. Mosaico «Pendientes de respuesta» ya existe; añadirlo a la portada (`HomePage` ya referencia consolidata) y filtrar por «sin asignar» | `wueform` F5 pendiente | S |
| B7 | **HECHO** (el detalle muestra «por <nombre>»; el API ya devuelve `insert_user_nome` al staff, sin peticiones nuevas). **Origen del proyecto:** que el detalle muestre si lo creó el cliente (desde `wueform`) o el staff, si el API lo expone; si no, no se pide nada nuevo | — | S |
| B8 | **DIFERIDO.** El repo no tiene `@vue/test-utils` ni entorno DOM; añadirlos es una dependencia nueva. Cubierto con pruebas de lógica, servicio y store (80 en consolidata). **Pruebas de componentes** de Conversión y Detalle, y prueba manual en sandbox con datos `[TEST fecha]` (sin reservar) | Revisión, punto 9 | M |
| B9 | **HECHO.** **Documentación:** actualizar `plan-consolidata-erp.md` (§10 desactualizado: ya hay commits) y `contrato-con-api.md` | `CLAUDE.md` | S |

Fuera de alcance, por decisión: nada del lado del cliente en esta SPA; no se tocan roles, scopes ni BD.

## 6. Dependencias entre planes y orden

- Plan A y B son independientes en código. Se cruzan en el **API** y en la **prueba de extremo a extremo**: un cliente crea y pide precio en `wueform`; el staff lo ve y responde en el ERP; el cliente lo ve y acepta en `wueform`; el staff convierte en el ERP.
- Orden recomendado: B1-B4 (arreglos pequeños) en paralelo con A1 (verificación en sandbox) → A2-A3 y B5-B6 → prueba cruzada → A4 (activar el flag) y B9.

## 7. Decisiones pendientes del negocio

| # | Decisión | Propuesta |
|---|---|---|
| DC-1 | ~~Dónde vive la página del cliente~~ | **Resuelta por el usuario (2026-11-12):** clientes en `tmwe-wueform`; staff y partners en el ERP |
| DC-2 | ¿El cliente puede aceptar (`close`) sin respuesta vigente del staff? (P70/D-C) | No; solo con respuesta vigente |
| DC-3 | ¿Se activa `project_mode_enabled` en producción y para qué clientes? | Primero sandbox, luego un grupo piloto |
| DC-4 | ¿La reserva real (`CONSOLIDATION_ALLOW_BOOKING`) sigue apagada? | Sí; la consolidada solo cotiza |
| DC-5 | ¿Un partner que entra por `wueform` ve solo sus propios proyectos como cliente? | Sí (es lo que hace el API hoy); gestionar como staff solo en el ERP |
| DC-7 | La migración a Slim retiró `/projects/` por «decisión del responsable». ¿Se revierte para el cliente con una página nueva y más ligera? | Sí, es lo que pide el proveedor de requisitos; confirmar con el responsable de `wueform` |
| DC-6 | Costes fijos de la opción (`costi_fissi`): no se guardan ni se facturan | Decidir con negocio; no bloquea |

## 8. Riesgos

- **Valores de sandbox.** Techos, roles y asignaciones se leyeron en `tmwe_sandbox_db`. Hay que repetir la lectura en producción antes de activar el flag (migraciones P78 sin aplicar allí).
- **Integridad de precios.** `create_from_option` recibe costes del navegador; el API ya vuelve a cotizar en servidor para clientes (P71, hecho), pero hay que probarlo con un cliente real.
- **Dos puertas a lo mismo.** Si el staff crea proyectos de un cliente en el ERP y el cliente los ve en `wueform`, ambos deben mostrar los mismos estados y textos de fase.
- **Tarifas en vivo.** Cada cotización llama a proveedores (hasta ~40 s). `wueform` ya limita a 20 peticiones por minuto.
- **Rama de `wueform`.** El plan de proyectos señala que la rama partía de `v2b` con 539 commits por delante de `origin/main`; comprobar en qué rama está hoy el código antes de tocarlo.
