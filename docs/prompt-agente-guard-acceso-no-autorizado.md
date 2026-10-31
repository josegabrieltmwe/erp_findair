# Tarea: no montar el dashboard ERP para usuarios sin acceso (pantalla de "no autorizado")

> **Estado:** pendiente de ejecutar (prompt de tarea; a 2026-10-31 no existe ningún componente `Unauthorized`/`Forbidden` y `web/apps/operations/src/main.ts` sigue montando la app con solo comprobar la sesión) · **Última modificación:** 2026-10-30 · **Clasificación:** automática 2026-10-31, pendiente de revisión humana

## Contexto

Un usuario tipo Cliente (sin rol de partner/staff válido, ej. `accessoadmin_64ef0f`) puede iniciar sesión
correctamente pero no tiene ningún derecho sobre el ERP. Hoy, en cuanto hay sesión válida, la SPA se monta
igual y dispara en paralelo los widgets del home (`api_courier_kpis`, `api_cargo_kpis`,
`api_home_box_indicators`), que responden 403 uno por uno. Mala UX (aluvión de errores en consola, dashboard
a medio render) y además revela la forma/estructura de esos endpoints a quien no debería ni verlos.

Causa exacta, con archivo:línea:

- `web/apps/operations/src/main.ts:7` monta la app sin más chequeo que "hay sesión":
  ```ts
  if (await bootstrapBff()) {
    await import("./app");
  }
  ```
- `bootstrapBff()` (`web/packages/shared-frontend/src/http/bff.ts:117`) solo valida la cookie de sesión.
- El router cae en la ruta `home` por defecto (`router/index.ts:61-71`); `HomePage.vue` +
  `home_kpi.service.ts` disparan los 3 widgets sin ningún guard previo.
- El único guard existente (`router.beforeEach`, `router/index.ts:1195`) cubre `meta.requiresAdmin` /
  `meta.aiScope`, y su fallback de "no autorizado" es `{ name: "home" }` — es decir, hoy todo camino de "no
  autorizado" termina en el propio dashboard. **No existe ningún componente `Unauthorized.vue`/`Forbidden.vue`.**

La señal para decidir esto **ya existe y ya llega al frontend, pero nadie la lee**:

- `/bff/auth/session` devuelve `capabilities: string[]`, calculado en
  `bff/src/Auth/UserContextProvider.php` (`fromProfile()` ~línea 81: `$isTmwe ? ['tmwe','clients'] : []`).
  - Staff TMWE → `['tmwe', 'clients']`
  - Partner real → `['clients', 'my_org']`
  - Cliente sin rol válido → `[]` (array vacío)
- `bootstrapBff()` guarda ese array en `window.__TMWE_OPERATIONS__.capabilities`
  (`bff.ts:144`), pero ningún código del frontend lo consulta hoy.

## Reglas

- No tocar el `router.beforeEach` existente (`requiresAdmin`, `aiScope`): siguen siendo correctos para gates
  internos de rutas concretas. Este es un gate **anterior y más grueso**, decide si se monta la SPA entera.
- Mínimo privilegio: no inventes capacidades nuevas en el backend. El campo `capabilities` ya existe y ya
  distingue correctamente los 3 casos (staff / partner / sin acceso) — solo falta consumirlo.
- Sigue el patrón visual ya existente: `web/packages/platform/shell/NotFoundView.vue` (card + botón de acción
  única). Cambia solo la acción: "cerrar sesión" (reutiliza `bffLogout()` de `bff.ts`) en vez de "volver" —
  "volver" reentraría al mismo estado sin acceso.
- La vista de "no autorizado" debe montarse **standalone**, sin depender de router/Vuetify/Pinia completos:
  en el punto de `main.ts` donde se decide esto, esos módulos aún no se cargaron.
- No rompas a los usuarios que sí tienen acceso (staff y partners con `capabilities` no vacío) — verifícalo
  explícitamente en pruebas, no solo de forma manual.
- Cambios con test. Si el repo no tiene aún un patrón de test de frontend para esto, al menos deja un test
  manual documentado en el PR (pasos exactos de cómo forzar `capabilities: []` en local).

## Tareas, por prioridad

### 1. Exponer la señal (bajo riesgo, base de todo lo demás)
En `web/packages/shared-frontend/src/http/bff.ts`, junto a donde ya se guarda `capabilities` en
`window.__TMWE_OPERATIONS__` (línea ~144), añade un getter exportado:
```ts
export function hasErpAccess(): boolean {
  return (window.__TMWE_OPERATIONS__?.capabilities ?? []).length > 0;
}
```

### 2. Bifurcar el bootstrap antes de montar la SPA
En `web/apps/operations/src/main.ts`, reemplaza el bloque de la línea 7:
```ts
if (await bootstrapBff()) {
  if (hasErpAccess()) {
    await import("./app");
  } else {
    await import("./unauthorized").then((m) => m.mountUnauthorized());
  }
}
```

### 3. Vista de "no autorizado"
Archivos nuevos:
- `web/apps/operations/src/unauthorized.ts`: monta `UnauthorizedView.vue` de forma standalone (sin router ni
  store) en el mismo elemento raíz que usaría `./app`.
- `web/apps/operations/src/UnauthorizedView.vue` (o junto a `shell/` si el repo prefiere centralizar vistas
  ahí, sigue la convención que uses para `NotFoundView.vue`): mensaje claro ("No tienes acceso a este
  sistema"), sin exponer detalles técnicos (nada de nombres de scopes ni de endpoints), con un único botón:
  cerrar sesión (reutiliza `bffLogout()`).

### 4. (Opcional, defensa en profundidad — menor prioridad)
`installBffFetch` (en `bff.ts`) hoy solo intercepta `401`, nunca `403`. Esto es un caso distinto (falta de
scope de un solo widget puntual, no falta de acceso general al ERP) pero vale la pena anotarlo: si se decide
abordarlo, que sea en una tarea separada, no mezclado con esta.

## Cómo comprobar tu trabajo

- Con un usuario cuyo backend devuelve `capabilities: []` (reproduce el caso de `accessoadmin_64ef0f`, o
  fuerza el valor en local): al cargar la SPA debe aparecer la vista de "no autorizado" **inmediatamente**,
  sin que se vea ni un parpadeo del dashboard, y sin que la consola muestre ningún 403 de
  `api_courier_kpis`/`api_cargo_kpis`/`api_home_box_indicators` (no deben llegar a dispararse).
- Con un usuario staff (`capabilities: ['tmwe','clients']`) y uno partner real (`capabilities: ['clients','my_org']`):
  el dashboard debe montarse exactamente igual que hoy, sin cambios de comportamiento ni de timing perceptible.
- Los guards existentes (`requiresAdmin`, `aiScope`) deben seguir funcionando sin cambios para usuarios que sí
  entran al dashboard.
- El botón "cerrar sesión" de la nueva vista debe terminar la sesión y devolver al login, no a `home`.

Entrega al final: resumen de los archivos tocados/creados, capturas o descripción de la vista de "no
autorizado", y confirmación de que los tres perfiles de prueba (sin acceso / partner / staff) se comportan
como se describe arriba.
