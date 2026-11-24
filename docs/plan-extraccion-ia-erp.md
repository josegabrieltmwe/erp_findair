# Plan: extracción por IA de datos de expedición desde el ERP (courier, cargo y consolidata)

> **Estado:** borrador · **Última modificación:** 2026-11-24

Objetivo: que el staff pueda pegar texto, una foto, un PDF o (más adelante) un audio describiendo un envío, y que el
ERP le prepare la expedición (courier, cargo) o el proyecto de consolidata ya rellenado — sin crear nada
automáticamente: siempre hay una revisión y una confirmación explícita antes de escribir en el backend.

Documentos relacionados: la parte de formatos de fichero en el backend vive en
`tmwe_api/docs/03-diseno/extraccion_ia_formatos/PLAN.md` (amplía `api_ai_extract`/`unified_consolidation_extract` a
xlsx/ods/odt; no bloquea este plan, que arranca con lo que el backend ya acepta hoy: texto, imagen, PDF, docx).

**Historial:** versión de 2026-11-11 diseñaba un panel propio (`AiExtractPanel.vue`) embebido en el diálogo de alta de
cada módulo (courier, cargo, consolidata). Decisión con el usuario (2026-11-24): para **courier y cargo** el canal es
el **chat del Copilot**, no un panel aparte — ver §0. **Consolidata** se queda con el diseño de panel original (§2.3),
porque su extracción devuelve varias expediciones de un solo documento y no encaja en el modelo de propuesta única del
Copilot.

---

## 0. Por qué courier/cargo van por el chat del Copilot (y no por un panel en el formulario)

El Copilot ya tiene, construido y auditado, exactamente el mecanismo que esta función necesita para su mitad más
delicada — convertir "lo que dijo la IA" en una escritura real:

- Un contrato de **propuesta firmada** (`CopilotProposal`, `web/apps/operations/src/modules/copilot/types.ts:39-58`):
  el backend firma el payload (sha256), la SPA lo muestra tal cual (`ProposalCard.vue`, renderizado genérico de
  cualquier `payload` plano) y solo puede confirmarlo o descartarlo — nunca editarlo a mano.
- Una acción `create_shipment` ya dada de alta en la lista cerrada de propuestas
  (`web/apps/operations/src/modules/copilot/services/proposal.ts:20-25`), con su confirmación
  (`POST /api_copilot_write_proposal`, op=confirmar) y su verificación de lectura (`readback.status`).
- Corrección por conversación, no por formulario: si la IA se equivoca, el staff simplemente responde en el chat
  ("no, son 5 bultos de 20 kg") y el Copilot vuelve a proponer — el mismo patrón que ya usa para `edit_cargo`.

Construir un panel aparte (como el de Findair, con revisión campo a campo antes de aplicar) duplicaría esa UI de
revisión con una lógica de confirmación distinta a la que ya existe, y añadiría un segundo camino de escritura que
auditar. Meterlo en el chat es, en los términos de este proyecto, "dejar de duplicar" el mismo patrón que ya se aplicó
al decidir que el BFF emite la credencial de voz de ElevenLabs en vez de que cada cliente hable directo con el
proveedor: una sola vía de escritura, un solo sitio donde se audita.

La limitación que esto acepta a cambio: no hay una vista "por secciones" con nivel de confianza por campo como en
Findair. Se corrige hablando. Si en el uso real resulta insuficiente, es una decisión de negocio a reabrir (D-C2), no
un límite técnico.

## 1. Estado actual (no cambia respecto al análisis de 2026-11-11, repetido aquí por contexto)

El backend ya tiene dos vías de extracción, ninguna expuesta todavía por el BFF del ERP y ninguna consumida por el
SPA:

| Vía | Endpoint | Para | Límite backend |
|---|---|---|---|
| Admin/B2B | `api_ai_extract` + `api_ai_extract_status` | courier (`extraction_mode=express`) y cargo (`extraction_mode=cargo`) — **una** expedición | `MAX_FILE_SIZE_MB=10` por fichero (`AI_File_Extract_RPC_Producer.php:36-57`, `tmwe_api`) |
| Consolidata | `unified_consolidation_extract` | varias expediciones (houses) de un mismo documento | igual, por fichero |

Formatos que el backend ya acepta: texto pegado, imagen (PNG/JPEG/GIF/WEBP), PDF, `.docx`, audio (transcripción
Whisper en el worker). `.xlsx`/`.ods`/`.odt` están en el plan de backend citado arriba, aún sin ejecutar — fuera de
alcance de este documento.

**Hallazgo del backend que cambia el perfil de riesgo de la Fase 1 (`tmwe_api/docs/03-diseno/extraccion_ia_formatos/PLAN.md:24`):**
cuando la entrada es solo texto (sin ficheros), `Specialist_Extraction_Service` **no pasa por la cola RabbitMQ ni por
el worker de IA externo** — llama al modelo directamente desde PHP. Es decir, **extracción de texto pegado ya no
depende de ningún worker externo ni de su capacidad**; solo foto/PDF/docx/audio pasan por la cola. Esto es la base de
la Fase 1 de este plan (§3).

El scope `ai:extract` que exige el backend ya está en los tres techos de permisos de la SPA ERP (`app_internal_erp`,
`app_internal_erp_staff`, `app_partner_erp`) — no hace falta ninguna migración de roles, ni para TMWE ni para partner
con `consolidation_manager`.

El Copilot hoy (`ChatComposer.vue`) solo tiene texto y micrófono (dictado/voz); no hay ningún concepto de "adjunto" en
`chat.store.ts` ni en `ChatBubble.vue`.

## 2. Diseño

### 2.1 Contrato con el backend

**Fase 1 (sin pedir nada a backend):** el texto pegado por el staff en el chat se manda tal cual al Copilot
(`copilot_chat`, sin cambios de contrato). El propio prompt del sistema del Copilot (`tmwe_api`,
`Elevenlabs_System_Prompt`/equivalente de texto) ya puede interpretar una descripción de envío en lenguaje natural y
proponer `create_shipment` — esto no es una función nueva del backend, es usar lo que el Copilot ya hace con un tipo
de mensaje más largo y más estructurado de lo habitual. **No depende de `api_ai_extract` en absoluto.**

**Fase 2 (fichero/foto/PDF/docx):** aquí sí se necesita `api_ai_extract`, porque extraer campos de una imagen/PDF no
es algo que el modelo de `copilot_chat` haga hoy con un adjunto (no acepta ficheros). Flujo propuesto:

1. La SPA llama a `POST /api_ai_extract` (BFF) con `{content: base64, mime_type, filename, extraction_mode}` —
   `extraction_mode` según el contexto en que esté el staff al adjuntar (ver D-C1 si hace falta inferirlo).
2. Si el backend responde `202 {request_id}` (asíncrono), la SPA hace *polling* a `GET /api_ai_extract_status` —
   mismo patrón que ya usa `copilot_chat_state` (`bff/config/routes.bff.yaml:474-481`).
3. Con el resultado (`extracted_data`, `confidence`, `warnings`, `missing_fields`), la SPA construye **un mensaje de
   chat** que resume esos campos en texto (no JSON crudo ilegible, una frase: *"He leído un documento: origen Milano,
   destino Roma, 3 bultos de 10 kg cada uno..."*) y lo manda como el siguiente turno de `copilot_chat`. El Copilot
   responde con su interpretación y, si procede, una propuesta `create_shipment` — **mismo camino que si el staff
   hubiera escrito esa frase a mano**. Cero cambios de contrato en `copilot_chat`.
4. Si en el uso real el modelo interpreta mal el resumen en texto (confunde campos, pierde precisión numérica), la
   alternativa es pedir a backend un campo `extracted_data` estructurado opcional en `copilot_chat` para que no
   dependa de que el LLM relea su propio resumen en texto — se deja como petición condicionada (D-C4), no se pide
   de entrada.

**Fuera de alcance de este documento:** `unified_consolidation_extract` sigue con el diseño de panel de la versión
anterior (§2.3 de la versión de 2026-11-11, no repetido aquí; se mantiene vigente para ese módulo).

### 2.2 Rutas BFF nuevas (solo Fase 2)

Mismo patrón JSON ya usado en el resto del manifiesto (no `multipart`: los endpoints de extracción reciben el fichero
en base64 dentro del JSON, igual que `otp.cargo_offer.file.upload` usa `multipart` solo porque es la excepción ligada
a `otp`):

```yaml
- id: post.api_ai_extract
  method: POST
  path: /api_ai_extract
  upstream:
    action: api_ai_extract
    forward_query: '*'
  limits:
    body: 20m
    timeout: 300

- id: get.api_ai_extract_status
  method: GET
  path: /api_ai_extract_status
  upstream:
    action: api_ai_extract_status
    forward_query: '*'
  limits:
    timeout: 30
```

`body: 20m` es la misma primera propuesta de la versión anterior (10 MB del backend, +33% por base64, con margen) —
**a confirmar con backend si el límite es por fichero o por petición** antes de fijarlo en firme (pendiente desde
2026-11-11, sigue sin verificar). El campo exacto para declarar el scope `ai:extract` en una ruta del BFF tampoco se
verificó nunca: copiar el patrón de una ruta existente que ya lleve scope, no improvisarlo. Tras añadir las rutas,
regenerar el manifiesto con `bff/bin/gen-spa-manifest.php` (cuidado conocido: no regenerar a la ligera contra
`sandbox`/`api`, puede quitar rutas en uso).

No se necesita ninguna ruta nueva de `unified_consolidation_extract` en este documento (es de la parte de consolidata,
fuera de alcance aquí).

### 2.3 Cambios en el Copilot (SPA)

**Fase 1 — sin ficheros (`web/apps/operations/src/modules/copilot/`):**
- Nada nuevo en `ChatComposer.vue`/`chat.store.ts`: un párrafo largo pegado en el textarea ya es un mensaje de chat
  válido. El único trabajo es de **prompt/producto**: confirmar con una prueba real que el Copilot, al recibir una
  descripción de envío en un solo mensaje, propone `create_shipment` con los campos bien repartidos — si no lo hace
  bien hoy, es un ajuste de prompt en `tmwe_api`, no de la SPA.
- Opcional de UX: si el texto pegado supera un umbral (p. ej. 500 caracteres), `ChatComposer.vue` puede mostrar un
  aviso suave ("¿esto es la descripción de un envío? El Copilot puede intentar prepararlo") en vez de forzar al staff
  a saber que puede hacerlo.

**Fase 2 — adjuntar fichero/foto:**
- `ChatComposer.vue`: botón de adjuntar (icono clip) + `input[type=file]` oculto, y manejo de `paste` para una imagen
  del portapapeles (mismo patrón que Findair, sin su complejidad de multi-fichero: aquí es un adjunto por turno).
  Validación de tamaño en cliente antes de codificar a base64 (D-C5).
- `chat.store.ts`: estado de adjunto pendiente (`pendingAttachment`), acciones `attachFile()`/`clearAttachment()`.
  Al enviar con un adjunto: llama al nuevo servicio de extracción (no a `copilot_chat` directamente), muestra una
  burbuja `pending` tipo "extrayendo documento…" (reusa el campo `pending?: boolean` ya existente en `ChatBubble`,
  `types.ts:104`), y al terminar construye el mensaje-resumen (§2.1 punto 3) y continúa el flujo normal de
  `copilot_chat` ya existente (`awaitCopilotChat`, async+polling, igual que hoy).
- `ChatBubble.vue`: mostrar un chip con el nombre/icono del fichero en la burbuja del usuario cuando el turno llevó
  adjunto.
- **Servicio compartido, no solo del Copilot**: `web/packages/platform/ai-extract/aiExtract.service.ts` +
  `useAiExtract.ts` (ubicación ya propuesta en la versión de 2026-11-11, se mantiene) — el Copilot es **un**
  consumidor; deja la puerta abierta a que el futuro panel de consolidata use el mismo servicio sin duplicar la
  llamada HTTP, el *polling* ni el mapeo de errores 429/503/504.
- **Reutilizar, no duplicar**, el helper de fichero→base64 que ya existe en
  `web/apps/operations/src/modules/invoicing/services/envios.service.ts:313-325`: moverlo a
  `web/packages/shared-frontend/src/files/fileToBase64.ts` y que ambos lo importen.
- Mapeo de errores: mismo patrón ya usado en `chat.store.ts` para errores del Copilot (`chatErrorKey`) — añadir
  claves para `ai_budget_exhausted` (429), `ai_extract_unavailable` (503/504, worker sin consumidor o tiempo agotado).

### 2.4 Qué NO se construye en este plan

- Vista de revisión "por secciones" con nivel de confianza por campo (eso es lo que hace la propuesta del Copilot ya
  existente, de forma más simple: una tarjeta, confirmar o descartar).
- Soporte de audio en el chat para este flujo: `useVoice.ts`/`useCopilotVoiceAgent.ts` ya cubren voz en el Copilot por
  otra vía (dictado y agente conversacional); mezclar un tercer modo "adjuntar un audio para que se transcriba y
  extraiga" en la misma pantalla es, con casi total seguridad, una complejidad de UX que no compensa — no se incluye
  salvo que el staff lo pida explícitamente tras usar Fase 1/2.
- Nada de `unified_consolidation_extract`/consolidata — sigue el diseño de panel ya existente, no se toca aquí.

## 3. Fases

| Fase | Contenido | Depende de | Tamaño | Estado (2026-11-24) |
|---|---|---|---|---|
| **C0** | Prueba de prompt: confirmar en sandbox que `copilot_chat` ya propone bien `create_shipment` a partir de un párrafo largo pegado (sin ningún cambio de código); si falla, ajuste de prompt en `tmwe_api` (petición, fuera de este repo) | — | S | **Pendiente** — requiere una sesión real contra sandbox (login OAuth2/PKCE), no se pudo hacer desde esta sesión de agente |
| **C1** | Aviso suave de "¿preparo el envío?" en `ChatComposer.vue` para texto largo (opcional, D-C3) | C0 | S | Hecho (`showLongTextHint`, umbral 500 caracteres) |
| **C2** | Rutas BFF (`api_ai_extract`/`api_ai_extract_status`, §2.2) | — (en paralelo a C0/C1) | S | Hecho (`bff/config/routes.bff.yaml`) + test (`CopilotRoutesTest.php`); **manifiesto `routes.spa.yaml` NO regenerado** (riesgo de tocar rutas en uso contra sandbox/api sin supervisión directa) |
| **C3** | `aiExtract.service.ts` + `useAiExtract.ts` compartidos, con mapeo de 429/503/504 y *polling*; vitest | C2 | M | Hecho (`web/packages/platform/ai-extract/`); **contrato de salida no verificado contra `tmwe_api` real** (ver cabecera de `aiExtract.service.ts`) |
| **C4** | Adjunto en el Copilot: `ChatComposer.vue` (botón + paste), `chat.store.ts` (estado + flujo extracción→resumen→`copilot_chat`), `ChatBubble.vue` (chip de adjunto); vitest | C3 | M | Hecho, con `extraction_mode` fijo a `express` por defecto (D-C1) |
| **C5** | Pulido: i18n (5 idiomas), mensajes de presupuesto agotado / worker ocupado, límites de tamaño coherentes con backend, confirmación con backend de si `has_consumer()` ya se comprueba antes de encolar (riesgo real medido en Findair, §5) | C4 | S | i18n hecho (5 idiomas); **`has_consumer()` sin confirmar con backend** — sigue siendo la condición para activar en producción |

Fase 1 de valor = C0+C1 (cero riesgo de capacidad, cero cambio de backend). Fase 2 de valor = C2-C5 (fichero/foto,
depende del worker compartido).

**Pendiente antes de dar la fase 2 por lista para producción** (ninguno de estos tres se pudo verificar desde esta
sesión de agente, sin acceso a un entorno en ejecución):
1. Regenerar `routes.spa.yaml` con `bff/bin/gen-spa-manifest.php` contra sandbox y confirmar que el manifiesto
   combinado sigue siendo correcto.
2. Confirmar contra `tmwe_api` real el contrato de respuesta de `api_ai_extract`/`api_ai_extract_status` (nombres de
   campo exactos: `parseResult()` en `aiExtract.service.ts` es tolerante pero no está probado contra el backend real).
3. C0 (prueba de prompt) y una prueba manual end-to-end en sandbox (texto largo, luego un PDF/imagen real) antes de
   cualquier despliegue a producción.

## 4. Pruebas

- **SPA (vitest):** `useAiExtract`/`aiExtract.service.ts` (mapeo de formatos, 429/503/504, *polling*);
  `chat.store.ts` (adjuntar → extraer → resumen → turno de chat → propuesta, igual que los tests ya existentes de
  `chat.store.spec.ts`/`copilot.http.spec.ts`); `ChatComposer.vue` (adjuntar, paste de imagen, validación de tamaño).
- **BFF:** que `routes.spa.yaml`/el manifiesto incluyan las dos rutas nuevas; `composer test`/`composer stan`.
- **Manual (sandbox):** C0 primero y aparte (es la prueba que decide si Fase 1 ya vale sin tocar código); luego un
  documento real por formato (texto largo, imagen, PDF, docx) en courier y en cargo; un fichero demasiado grande
  (debe fallar en cliente); una cuenta con presupuesto de IA agotado (mensaje claro, no error genérico).
- **Guardarraíl recomendado (patrón tomado de Findair, `no-payment-tools.test.ts`):** un test que falle si algún
  camino de este flujo pudiera llamar a una acción de creación/cancelación real sin pasar por
  `api_copilot_write_proposal` — es decir, que la extracción nunca tenga una vía propia de escritura, solo alimente
  texto hacia el Copilot.

## 5. Riesgos

- **Capacidad del worker compartido (Fase 2):** foto/PDF/docx pasan por la misma cola RabbitMQ/agente de IA externo
  que ya usa Findair para su propio "AI Extract". El postmortem de Findair
  (`findair/docs/archivo/plans/PLAN_AI_EXTRACT_FIABILIDAD_2026-09-30.md`) documenta un incidente real: el agente de
  IA caído + controlador sin comprobar `has_consumer()` antes de encolar + timeouts descoordinados entre capas tumbó
  el sandbox con solo 5 extracciones colgadas. **Antes de activar C2-C5 en producción, confirmar con backend que esa
  comprobación ya está aplicada** — si no, activar el Copilot del ERP sobre el mismo endpoint añade carga al mismo
  punto de fallo que ya falló una vez.
- **Coste:** cada extracción de fichero consume presupuesto de IA (`feature=extract`, ya limitado por
  `Ai_Budget_Service`); vigilar consumo tras C4, antes de anunciarlo ampliamente.
- **Prompt que no generaliza (C0):** un párrafo pegado puede no producir una propuesta bien formada si el prompt del
  Copilot no está afinado para ese caso de uso — es la razón de hacer C0 como prueba aislada antes de construir nada.
- **Tamaño de respuesta en el resumen de texto (§2.1 punto 3):** si `extracted_data` tiene muchos campos, el resumen
  en una frase puede perder precisión (sobre todo numérica: pesos, cantidades). Si se detecta en C4, es la señal para
  activar la alternativa de campo estructurado (D-C4), no para seguir ajustando el resumen a mano.

## 6. Decisiones pendientes del negocio

| # | Decisión | Propuesta por defecto |
|---|---|---|
| D-C1 | ¿Cómo se decide `extraction_mode` (courier/cargo) al adjuntar desde el chat, si el staff no está dentro de un módulo concreto? | Preguntarlo en el propio chat ("¿es courier o cargo?") en vez de inferirlo de la pantalla activa |
| D-C2 | Si la corrección por conversación (en vez de edición por secciones) resulta insuficiente en el uso real, ¿se reconsidera una vista de revisión editable? | No por ahora; reabrir solo con evidencia de uso real |
| D-C3 | ¿Se incluye el aviso suave de C1, o se deja que el staff descubra la función sin pista en la UI? | Incluir el aviso (mejor descubribilidad, bajo coste) |
| D-C4 | ¿Se pide a backend un campo `extracted_data` estructurado en `copilot_chat` desde el principio, o se arranca con el resumen en texto y se pide solo si falla? | Arrancar con resumen en texto; pedir el campo estructurado solo si C4 muestra pérdida de precisión |
| D-C5 | Tamaño máximo de fichero validado en el cliente para el adjunto del chat | 10 MB, igual que el límite del backend, antes de codificar a base64 |
| D-C6 | ¿Se agrupa la activación de C2-C5 con la de consolidata (del plan de panel), o van sueltas? | Sueltas: courier/cargo por chat puede salir primero, sin esperar al panel de consolidata |
