# Plan: extracción por IA de datos de expedición desde el ERP (courier, cargo y consolidata)

> **Estado:** borrador · **Última modificación:** 2026-11-11

Objetivo: que el staff pueda, desde el ERP (SPA `operations` + BFF), pegar o arrastrar un documento (PDF, imagen, Word, Excel, texto, ODT, ODS) o pegar texto copiado, y que el formulario de alta de una expedición courier, un cargo o un proyecto de consolidata se rellene solo con lo que la IA extraiga de ese documento — sin que esto cree nada automáticamente: el staff siempre revisa y confirma antes de guardar.

Documentos relacionados: la parte de backend (qué formatos acepta el API y cómo los convierte) vive en `tmwe_api/docs/03-diseno/extraccion_ia_formatos/PLAN.md`. Este documento depende de ese.

**Cómo se hizo el análisis (2026-11-11):** lectura de `erp_findair` (SPA y BFF) y de `tmwe_api`, sin cambios de código. Las referencias `fichero:línea` son de ese día.

---

## 1. Estado actual

El backend ya tiene dos endpoints de extracción (detalle en el plan del API):
- `api_ai_extract` / `api_ai_extract_status` — courier y cargo, un documento → una expedición.
- `unified_consolidation_extract` — consolidata, un documento → varias expediciones (houses) a la vez.

**Ninguna de las dos rutas está en `bff/config/routes.bff.yaml`** (sin resultados al buscarlas), y **no existe ninguna UI** en el SPA `operations` que las use, en ninguno de los tres módulos — ni siquiera en `ConsolidataNewProjectDialog.vue` o en el simulador de consolidata.

Formato de una entrada de ruta del BFF ya existente (`routes.bff.yaml`, patrón de `unified_consolidation_project`):

```yaml
- id: post.unified_consolidation_project
  method: POST
  path: /unified_consolidation_project
  upstream:
    action: unified_consolidation_project
    forward_query: '*'
  limits:
    body: 1m
    timeout: 300
```

Hay también un patrón `multipart: true` para subida de ficheros (p. ej. `otp.cargo_offer.file.upload`), pero **no aplica aquí**: los dos endpoints de extracción reciben JSON con el contenido del fichero en base64 (`{content, mime_type, filename}`), no `multipart/form-data`.

El componente compartido más parecido que ya existe es `web/packages/platform/detail/FilesBox.vue` (drag&drop + selector), pero es para **adjuntar** un fichero a un registro ya existente, sin paste de imagen/texto y sin llamar a ningún endpoint de IA — no sirve tal cual, pero su zona de arrastre se puede tomar como referencia visual.

El scope `ai:extract` que exige el API ya está en los tres techos de la SPA ERP (`app_internal_erp`, `app_internal_erp_staff`, `app_partner_erp`): **no hace falta ninguna migración de roles**, ni para TMWE ni para el personal de partner con `consolidation_manager`.

## 2. Diseño

### 2.1 Rutas BFF
Tres rutas nuevas en `routes.bff.yaml`, siguiendo el patrón JSON ya usado (no multipart):

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

- id: post.unified_consolidation_extract
  method: POST
  path: /unified_consolidation_extract
  upstream:
    action: unified_consolidation_extract
    forward_query: '*'
  limits:
    body: 20m
    timeout: 300
```

`body: 20m` es una primera propuesta (el límite del backend es 10 MB por fichero, pero en base64 pesa ~33% más, y `unified_consolidation_extract` admite varios ficheros en una sola petición) — **a confirmar en B1/E0** si el backend suma el límite entre todos los ficheros de una petición o lo aplica por fichero, para fijar el número correcto. El campo exacto para declarar el scope exigido (`ai:extract`) en una ruta del BFF **no se verificó** en este análisis: copiar el patrón de una ruta existente que ya lleve scope, no improvisarlo. Tras añadir las rutas, regenerar el manifiesto con `bff/bin/gen-spa-manifest.php` — recordar la restricción ya conocida de no regenerar a la ligera contra `sandbox`/`api` (puede quitar rutas en uso).

### 2.2 Componente y servicio compartidos (nuevos, no se reutiliza `FilesBox.vue`)
En `web/packages/platform/ai-extract/` (nombre propuesto):
- **`AiExtractPanel.vue`**: zona de arrastre + selector de fichero (`accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.docx,.xlsx,.odt,.ods"`), área de texto para pegar texto copiado, y manejo de `paste` para una imagen del portapapeles. Valida el tamaño en cliente antes de subir (mismo límite que el backend). Muestra progreso mientras espera, y si la petición vuelve `202 {request_id}` (camino asíncrono), hace *polling* a `api_ai_extract_status` por detrás sin que el componente que lo usa tenga que saberlo.
- **`useAiExtract.ts`** (composable) + **`aiExtract.service.ts`**: una función por destino (`extractForShipment`, `extractForCargo`, `extractForConsolidation`) que llama a la ruta BFF correcta y devuelve los campos extraídos ya tipados; traduce `429` (presupuesto de IA agotado) y `503`/`504` (worker sin consumidor / tiempo agotado) a mensajes claros, sin que cada módulo tenga que conocer esos códigos.
- El resultado **nunca se guarda solo**: el componente emite los campos extraídos hacia arriba, y es el formulario de cada módulo quien decide qué prellenar, dejando que el staff revise antes de confirmar — igual que ya hace `create_from_option` con el resultado del simulador de consolidata.

### 2.3 Integración por módulo
| Módulo | Dónde | Endpoint | Resultado esperado |
|---|---|---|---|
| Courier | diálogo de alta de expedición express (a localizar: el análogo de `ConsolidataNewProjectDialog.vue` en el módulo de courier) | `api_ai_extract` (`extraction_mode=express`) | prellena una expedición |
| Cargo | alta de cargo / de una house | `api_ai_extract` (`extraction_mode=cargo`) | prellena un cargo |
| Consolidata | `ConsolidataNewProjectDialog.vue` (una house) y, con más valor, un flujo nuevo "documento maestro → varias houses" en el alta o en el simulador | `unified_consolidation_extract` | prellena 1 o N houses de golpe |

Consolidata es donde el endpoint ya devuelve varias expediciones de un documento (`shipments[]`), así que es el candidato natural a entregarse primero: un documento maestro con varias houses puede alimentar algo parecido a `create_from_option`, pero disparado por extracción en vez de por el comparador de tarifas.

## 3. Fases

| Fase | Contenido | Depende de | Tamaño |
|---|---|---|---|
| **E0** | Rutas BFF (§2.1), manifiesto regenerado, prueba de que el BFF reenvía bien (incluye el mapeo de 429/503/504) | B1 del plan del API | S |
| **E1** | `AiExtractPanel.vue` + `useAiExtract.ts` + `aiExtract.service.ts`, vitest del componente/servicio | E0 | M |
| **E2** | Integración en consolidata (alta de una house y flujo de documento maestro multi-house) — se hace primero por ser el de más valor | E1 | M |
| **E3** | Integración en courier | E1 | S |
| **E4** | Integración en cargo | E1 | S |
| **E5** | Pulido: i18n en los 5 idiomas del proyecto, mensaje de presupuesto agotado, límites de tamaño coherentes con el backend, decisión D-I1 sobre activación progresiva | E2-E4 | S |

## 4. Pruebas

- **SPA (vitest):** `useAiExtract`/`aiExtract.service.ts` — mapeo de formatos aceptados, manejo de 429/503/504, *polling* del camino asíncrono. `AiExtractPanel.vue` — drag&drop, paste de imagen, paste de texto, validación de tamaño en cliente.
- **BFF:** que `routes.spa.yaml`/el manifiesto incluyan las tres rutas nuevas.
- **Manual (navegador del sandbox):** un documento real de cada formato (PDF, imagen, docx, xlsx, odt, ods, texto pegado, imagen pegada) en cada uno de los tres módulos; un fichero demasiado grande (debe fallar en cliente, sin llegar a subir); una cuenta con presupuesto de IA agotado (debe ver el mensaje, no un error genérico).

## 5. Riesgos

- **Coste**: activar la extracción sin fricción en los tres módulos a la vez puede disparar el gasto de IA rápido. Mitigado por activar primero solo consolidata (E2) y revisar consumo antes de E3/E4.
- **Percepción de "colgado"**: el timeout de 300 s en el BFF es coherente con el resto de consolidata, pero sin una barra de progreso clara el staff puede pensar que la pantalla se quedó pillada con un PDF grande — `AiExtractPanel.vue` debe dejarlo visible.
- **Localizar el diálogo de alta de courier** (E3): no se identificó en este análisis el fichero exacto; confirmar antes de estimar el tamaño real de esa fase.

## 6. Decisiones pendientes del negocio

| # | Decisión | Propuesta por defecto |
|---|---|---|
| D-I1 | ¿Se activa en los tres módulos a la vez o se empieza solo por consolidata? | Empezar por consolidata (E2), luego courier y cargo |
| D-I2 | Tamaño máximo de fichero validado en el cliente | 10 MB por fichero, igual que el backend, antes de codificar a base64 |
| D-I3 | ¿El scope `ai:extract` ya existente es control de acceso suficiente, o se quiere un interruptor propio (como `specialist_enabled`) para poder apagar la función sin desplegar? | Sin interruptor propio por ahora; reconsiderar si el coste de E2 lo justifica |
