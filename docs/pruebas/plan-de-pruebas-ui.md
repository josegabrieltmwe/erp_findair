# Plan de pruebas automatizadas de la UI (ERP Findair)

Objetivo: verificar de forma repetible, desde el navegador, la SPA (Vue 3 + Vuetify) funcionando sobre el BFF real y, a través de él, sobre el API `tmwe_json`. El plan está escrito para personas; cada caso tiene un ID que coincide con el nombre del test automatizado.

## 1. Alcance y arquitectura bajo prueba

```
Navegador (Playwright) -> SPA Vue/Vuetify -> /bff/v1 (BFF Slim 4, sesión en Valkey) -> tmwe_json (API)
```

- SPA única `web/apps/operations`: 20 módulos lazy (`cargo`, `shipment`, `tracking`, `pickup`, `crm`, `settings/*`…), ~130 rutas.
- La UI nunca ve tokens OAuth: solo una cookie de sesión HttpOnly. Los permisos efectivos son techo del cliente OAuth ∩ rol del usuario.
- Autorización real = API. La UI solo oculta/bloquea (UX), por eso se prueba **también** lo que la API devuelve (403).

## 2. Niveles y herramientas

| Nivel | Qué prueba | Herramienta | Dónde | Estado |
|---|---|---|---|---|
| N1 Estático | tipos, i18n, drift del contrato | `pnpm typecheck:all`, `check:i18n`, `check:drift` | `web/` | existente |
| N2 Unitario/componente | stores, servicios, componentes | Vitest (33 specs) | `web/**/*.spec.ts` | existente |
| N3 BFF | proxy, CSRF, sesión | PHPUnit + PHPStan | `bff/tests` | existente |
| **N4 E2E UI** | flujos de usuario reales en navegador | **Playwright** | `web/e2e/` | **nuevo (esta rama)** |
| N5 Sondeo de rutas | 225 GET con usuario real | `bff/bin/probe-routes.php` | `bff/bin` | existente (solo lectura) |

Este plan desarrolla N4. Se eligió Playwright por: espera automática, trazas/vídeo en fallos, ejecución paralela, informe HTML + JUnit para CI, y soporte de varios navegadores.

## 3. Entornos y datos

- **URL**: `E2E_BASE_URL` (por defecto `https://erp-findair.php8`).
- **Usuarios de prueba** (nunca reales): `E2E_USER`/`E2E_PASS` (administrador de pruebas). Recomendados además: un usuario de partner sin rol admin (`E2E_USER_PARTNER`) para casos de permisos.
- **Datos**: las pruebas de lectura no necesitan datos propios. Las de escritura crean registros con prefijo `E2E-<timestamp>` y los borran al final; se ejecutan solo contra entorno dev/staging, jamás producción.
- Una única sesión se obtiene en `auth.setup.ts` (login OAuth2/PKCE real) y se reutiliza (`storageState`).

## 4. Catálogo de casos

Prioridad: P0 bloquea entrega, P1 importante, P2 deseable. Estado: ✅ automatizado, 🟡 definido, pendiente de implementar.

### 4.1 Autenticación y sesión
| ID | Caso | Resultado esperado | P | Estado |
|---|---|---|---|---|
| AUTH-01 | Sesión sin cookie | `/bff/auth/session` → `{"authenticated":false}` | P0 | ✅ |
| AUTH-02 | Acción del proxy sin sesión | respuesta 4xx, nunca 5xx | P0 | ✅ |
| AUTH-03 | Abrir la SPA sin sesión | redirige al login | P0 | ✅ |
| AUTH-04 | Login válido | llega a `/home`, sesión `authenticated:true` | P0 | ✅ (setup) |
| AUTH-05 | Credenciales erróneas | permanece en login con error | P1 | 🟡 |
| AUTH-06 | Logout | cookie invalidada, `/home` vuelve a login | P0 | 🟡 |
| AUTH-07 | Expiración por inactividad | tras `SESSION_IDLE_TTL` pide login | P2 | 🟡 |

### 4.2 Seguridad vista desde la UI
| ID | Caso | Esperado | P | Estado |
|---|---|---|---|---|
| SEC-01 | Storage del navegador | sin `access_token`/`refresh_token` | P0 | ✅ |
| SEC-02 | Cookie de sesión | HttpOnly + Secure | P0 | ✅ |
| SEC-03 | POST sin CSRF | rechazado (400/403/419) | P0 | ✅ |
| SEC-04 | Acción fuera de la lista blanca | 403/404 | P0 | 🟡 |
| SEC-05 | Usuario sin permiso abre ruta `requiresAdmin` por URL | bloqueado por el guard | P0 | 🟡 |

### 4.3 Humo de navegación (SMK)
Por cada ruta de `e2e/support/routes.ts`: la pantalla monta dentro del shell Vuetify, sin `pageerror` JS y sin respuestas 5xx del BFF. 16 rutas hoy (✅); ampliar hasta cubrir todas las rutas sin parámetros del router. P0.

### 4.4 Flujos funcionales (por módulo, 🟡)
| ID | Flujo | P |
|---|---|---|
| SHP-01 | Listado de expediciones: filtrar, paginar, ordenar | P0 |
| SHP-02 | Abrir detalle de una expedición existente | P0 |
| SHP-03 | Crear expedición (alta mínima) y verificarla en el listado | P0 |
| TRK-01 | Buscar un tracking conocido y ver estados | P0 |
| ANA-01 | Buscar anagrafica, abrir ficha, cambiar pestañas | P1 |
| USR-01 | Gestión de usuarios: listar, abrir ficha | P1 |
| USR-02 | Roles aditivos: solo se ofrecen los `grantable_roles`; conceder y revocar uno | P0 |
| USR-03 | Conceder un rol no concedible vía API → `ROLE_NOT_GRANTABLE` | P0 |
| SMTP-01 | Cuentas SMTP: alta, prueba (límite 20/h) y baja | P1 |
| OAU-01 | Clientes y roles OAuth: listar y ver detalle | P2 |
| DWN-01 | Descarga de un documento (PDF) devuelve el archivo | P1 |
| SSE-01 | Pantalla con SSE recibe eventos y reconecta | P2 |
| UP-01 | Subida de archivo en un formulario con adjuntos | P1 |

### 4.5 Transversales (🟡)
- **Permisos por rol** (P0): matriz admin / partner staff / solo lectura × pantallas. Verifica menú visible, ruta accesible y respuesta de la API coherentes.
- **Idioma/i18n** (P2): sin claves sin traducir visibles (`check:i18n` + comprobación en navegador).
- **Responsive** (P2): humo en viewport móvil (Pixel 7) y escritorio.
- **Accesibilidad** (P2): `@axe-core/playwright` en home, listados y formularios.
- **Rendimiento** (P2): home < 3 s hasta `networkidle` en dev.

## 5. Reglas inviolables
1. **Nunca se reservan ni se hace booking de vuelos**, tampoco se confirman o cancelan reservas con la aerolínea (KLM, WebCargo, solicitud de AWB, confirmación de MAWB). Se prueba solo hasta el paso anterior (búsqueda de vuelos, formularios, validaciones, cálculo de tarifas, listados y detalle de lo existente).
   - Garantía técnica: `web/e2e/support/test.ts` aborta cualquier petición no-GET a las acciones de `FLIGHT_BOOKING_ACTIONS` y hace fallar la prueba. Todo spec debe importar `test` de ese archivo, no de `@playwright/test`.
   - Si aparece una acción nueva de booking en `bff/config/routes.spa.yaml`, se añade a esa lista en el mismo cambio.
   - Los casos de reserva se verifican con revisión manual asistida o con un doble (mock) del API, nunca contra el proveedor real.

## 6. Convenciones para que sean automatizables
1. Selectores por `data-testid` (ya hay 17 en la SPA); al añadir un flujo, añadir el testid en el componente en vez de depender de texto o clases Vuetify.
2. Cada test es independiente y limpia lo que crea.
3. El ID del caso va al inicio del título del test (`AUTH-03 …`) para trazar plan ↔ informe.
4. Los tests de escritura llevan etiqueta `@write` y solo corren con `E2E_ALLOW_WRITE=1`.
5. Fallos de consola/5xx en cualquier pantalla se tratan como fallo.

## 7. Ejecución y reportes
```
cd web
pnpm e2e              # todo
pnpm e2e:smoke        # solo humo (≈1 min)
pnpm e2e:ui           # modo interactivo
pnpm e2e:report       # abre el informe HTML
```
Salidas: `web/e2e/report/index.html` (legible por personas, con capturas, vídeo y trazas de los fallos) y `web/e2e/report/junit.xml` (para CI).

Cadencia propuesta: humo + seguridad en cada merge a `main`; suite completa nocturna; permisos y escritura antes de cada despliegue.

## 8. Criterios de salida
- 0 fallos P0 y ≤ 2 fallos P1 con incidencia abierta.
- Cobertura de humo del 100 % de las rutas sin parámetros.
- Sin 5xx del BFF durante la suite.

## 9. Plan de implantación
1. (hecho) Andamiaje Playwright, login reutilizable, AUTH/SEC/SMK iniciales.
2. Dar de alta usuarios de prueba (admin y partner) y confirmar los selectores del formulario de login en `auth.setup.ts`.
3. Implementar P0 de 4.1, 4.2 y 4.4 (SHP, TRK, USR).
4. Añadir `data-testid` donde falten.
5. Pipeline CI con `pnpm e2e` y publicación del informe.
6. Resto de P1/P2.

## 10. Riesgos conocidos
- Dependencia del backend real: un fallo del API se verá como fallo de UI; el informe separa 4xx/5xx del BFF para diagnosticarlo.
- Los 38 endpoints que dan 403 por permisos de módulo (ver `plan-migracion.md`) son esperados para usuarios no admin; los casos de permisos deben fijar la expectativa por rol, no ignorarlos.
- Estado actual del vhost: apunta a `/var/www/dev/erp` (cambio sin commitear ajeno a esta rama).
