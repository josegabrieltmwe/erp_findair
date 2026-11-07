# Propuesta: home minimalista del ERP

> **Estado:** borrador (propuesta, sin implementar) · **Última modificación:** 2026-11-07

Motivo: el cliente dice que la home actual tiene demasiados botones y el usuario no sabe por dónde empezar. Se analizó `web/apps/operations/src/modules/home/pages/HomeLandingPage.vue` (versión local, tras `git pull` de `sandbox`) y el cockpit de KPIs (`web/packages/platform/dashboard/`). No se midió la página desplegada en sandbox porque exige login; los tiempos son por lectura de código.

## 1. Qué hay hoy (de arriba abajo)

| Bloque | Contenido | Elementos pulsables |
|---|---|---|
| Actividades del día | Pestañas por dominio + carril de subgrupos + hasta 30 KPI (8 categorías) | ~8 pestañas, ~30 fichas, «Actualizar» |
| Crear | 2 tarjetas grandes (nuevo cargo, nueva expedición) | 2 |
| Resto del menú | Una tarjeta por cada entrada del menú lateral, en 5 secciones (operativa, gestión, facturación, herramientas, admin) | ~24 para el personal TMWE |

Total: **unos 65 elementos pulsables** en una pantalla, con la misma jerarquía visual. Los dos accesos de crear compiten con 24 tarjetas que duplican exactamente el menú lateral (el propio código lo dice: «salen del MISMO catálogo»).

### Por qué confunde

1. **Duplica el menú lateral.** Las ~24 tarjetas no añaden nada; solo añaden ruido.
2. **No hay una acción principal.** Crear, ver KPI y navegar pesan igual.
3. **Los KPI no dicen qué hacer.** 30 números sin orden de prioridad; solo algunos exigen acción hoy.
4. **Mezcla tareas con herramientas** (importaciones, portal API, plantillas) que se usan una vez al mes.

### Por qué carga lento

- Al entrar se lanzan en segundo plano `api_courier_kpis`, `api_cargo_kpis` y `api_home_box_indicators` (por grupos), con cola de 3 en paralelo. El código documenta consultas de hasta 18 s en frío y caducidad de caché de 3 min.
- Se montan las 8 categorías aunque solo se ve una pestaña (`v-show`, no `v-if`): todo el árbol de fichas se renderiza.
- El resto de la pantalla (tarjetas) es estático y ya es rápido; el coste está en los KPI.

## 2. Propuesta

Una pantalla con **una sola pregunta: «¿qué quieres hacer?»**, en tres bandas.

```
┌──────────────────────────────────────────────────────────┐
│  Buenos días, <nombre>                                   │
│  ┌────────────────────────────────────────────┐          │
│  │ 🔍 Buscar expedición, cliente, AWB…        │  ← foco  │
│  └────────────────────────────────────────────┘          │
│  [ + Nuevo cargo ]   [ + Nueva expedición ]              │
│                                                          │
│  Requiere tu atención                                    │
│   ● 7 respuestas de aerolínea por revisar      →         │
│   ● 3 expediciones en incidencia               →         │
│   ● 2 recogidas de hoy sin confirmar           →         │
│   (solo se muestran las que valen > 0)                   │
│                                                          │
│  Continúa donde lo dejaste                               │
│   CAR-2041 · Madrid → Roma            hace 20 min        │
│   EXP-88213 · DHL · Entregada         hace 1 h           │
│                                       [ Ver todo el menú ]│
└──────────────────────────────────────────────────────────┘
```

1. **Buscador** como elemento dominante. **Hoy no existe un buscador global en la SPA** (no hay componente ni ruta): hay que construirlo. Versión mínima: un campo que lleva al listado de expediciones/cargo con el texto ya aplicado; después, un endpoint de búsqueda unificada (expedición, AWB, cliente, referencia). Un único campo, sin pestañas.
2. **Dos acciones primarias**: Nuevo cargo y Nueva expedición. Se conservan; son lo único en botón relleno.
3. **«Requiere tu atención»**: máximo 5 filas, cada una con número y enlace a la lista ya filtrada. Solo cuentan los indicadores accionables; los de valor 0 no se pintan (hoy `hide-zero` ya existe). Si no hay nada: «Todo al día» y el bloque colapsa.
4. **«Continúa donde lo dejaste»**: últimos 5 elementos abiertos por el usuario (`RecentList.vue`, 218 líneas, existe en el módulo home pero **no está usado en ninguna pantalla**: hay que revisarlo y conectarlo; la fuente de «recientes» también está por definir).
5. **Se eliminan las tarjetas del menú** y los KPI por pestañas de la home. El menú lateral sigue siendo la navegación; un enlace discreto «Ver todo el menú» abre/expande el lateral.
6. **Los KPI completos pasan a una pantalla propia** («Indicadores», una entrada más del menú) que se carga solo si se visita.

### Selección de los 5 avisos (a confirmar con el cliente)

Propuesta de partida, a partir de lo que ya existe: respuestas de aerolíneas y de couriers por revisar, expediciones con incidencia/retraso de tracking, recogidas pendientes, cobros/facturas vencidos. El catálogo tiene 30 KPI; hay que elegir con el cliente cuáles son «de acción» y cuáles «informativos».

### Vista por rol

- **Personal TMWE:** buscador + crear + atención + recientes.
- **Partner:** igual, pero sin avisos de administración y con el vocabulario llano (`partnerKey`) que ya usa el menú reducido.

## 3. Rendimiento

| Medida | Efecto |
|---|---|
| Pasar de 6 peticiones de KPI a **1 petición** de «atención» (solo los 3-5 contadores del bloque) | Menos carga en el servidor y primer pintado inmediato |
| Pintar buscador, botones y recientes **sin esperar a ningún dato** | Pantalla útil desde el primer render |
| El bloque de atención carga después, con esqueleto de 3 filas | Sin saltos de diseño |
| Retirar las 8 categorías y las ~65 fichas del árbol inicial | Menos DOM y menos JS en la ruta `/home` |
| Mover Indicadores a ruta propia con carga diferida | El coste de los KPI deja de pagarlo quien no los mira |
| Reutilizar el store con caducidad de 3 min (ya existe) | Volver a la home no repite peticiones |

Una condición: el bloque de atención necesita un endpoint barato (contadores con índice, o los indicadores que ya tienen caché de backend). Hoy `api_home_box_indicators` admite pedir solo ciertos indicadores por clave, así que se puede empezar con ese sin tocar el API. Un endpoint dedicado `api_home_attention` sería la mejora posterior.

## 4. Plan por pasos (cada uno desplegable por separado)

1. **Home nueva** (`HomeLandingPage.vue`): buscador mínimo, dos botones, recientes y bloque de atención con 3-5 indicadores existentes; sin tarjetas de menú. Mantener `data-testid` actuales donde sigan existiendo y actualizar `homeLanding.spec.ts`.
2. **Ruta «Indicadores»** con el `HomePage` actual (pestañas y KPI) cargada de forma diferida; entrada en el menú lateral y en `navCatalog`.
3. **Ajuste de i18n** (5 idiomas) y pasada por la guardia `check:i18n`.
4. **Medición**: tiempo hasta primer pintado y número de peticiones antes y después, con el navegador, en local y en sandbox.
5. *(opcional)* Endpoint `api_home_attention` en `tmwe_api`.

Riesgo bajo: no cambia rutas ni permisos; los accesos retirados de la home siguen en el menú lateral.

## 5. Decisiones que necesito del cliente

1. ¿Cuáles son los 3-5 avisos que de verdad piden acción cada día?
2. ¿El buscador global cubre lo que buscan (expedición, AWB, cliente, referencia)? ¿Algo más?
3. ¿Se aceptan los KPI completos en una pantalla aparte, o alguno debe quedar en la home?
4. ¿Los usuarios de partner necesitan una home distinta en contenido, o basta con el vocabulario simplificado?
