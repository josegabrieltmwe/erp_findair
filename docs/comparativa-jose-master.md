# Comparativa: Jose_master vs. BFF + Vue/Vuetify (erp_findair)

> **Estado:** vigente en lo de producto; su sección «bugs del backend» está obsoleta · **Última modificación:** 2026-10-19 · **Clasificación:** automática 2026-10-31, pendiente de revisión humana

Análisis estático de `github.com/tmwe-dev/Jose_master` (no se ejecutó su código). Fecha: 2026-10-18.

## Qué es Jose_master
Reconstrucción paralela del mismo ERP sobre la misma API de `tmwe_json`:
- ~50 páginas HTML con JS en línea, sin compilación (algunas de más de 300 KB).
- Gateway serverless en Vercel (`api/gw.js`) con ~272 rutas en lista blanca y reglas por rol.
- Extras: agentes de IA (Hermes/Ermes) con voz, videollamada con intérprete, puente WebCargo.
- Mucha documentación (561 `.md`), 52 ficheros de pruebas (~450 casos), CI con revisión de sintaxis, secretos y código muerto.

## Comparación

| Aspecto | Jose_master | erp_findair |
|---|---|---|
| Frontend | HTML/JS sin build ni tipos | Vue 3 + Vuetify + TS, `vue-tsc`, 243 pruebas |
| Sesión en navegador | Token HMAC sin estado (7 d) en `localStorage` | Cookie `__Host-sid` HttpOnly opaca + sesión en Valkey |
| Revocación | No | Sí (se destruye la sesión) |
| Identidad hacia el backend | `client_credentials` compartido | Token por usuario (Authorization Code + PKCE) |
| CSRF | Bearer en `localStorage` (expuesto a XSS) | Origin, Sec-Fetch-Site, `X-CSRF-Token` |
| Lista blanca | 272 rutas a mano | ~800 rutas generadas del código + `exclude` |
| SSE / descargas / subidas | Límite 120–300 s de Vercel | Verificado (curl_multi + flush) |

## Ideas que merece la pena adoptar
1. **Guía de UX** (`36_guida_ux.md`, `55_standard_maschere.md`): listado → panel lateral con cabecera fija → pestañas con contadores → cajones; modo consulta/edición; fila «Por arreglar»; menú ⋯; estado cambiable desde la cabecera. Se traduce a `v-navigation-drawer`, `v-tabs`, `v-expansion-panels`.
2. **Prueba de contrato en sandbox antes de activar un botón** (crear/leer/actualizar/borrar con el payload real). Formaliza `bin/probe-routes.php`. Regla: nunca sobre rutas de booking/cancelación/etiquetas/email.
3. **Registro de paridad campo a campo** (`42_matrice_parita`, `45_registro_parita`) como checklist de aceptación.
4. **Tokens de diseño y 4 temas**; lista local de CAP/ciudades (GeoNames, CC BY 4.0: requiere atribución).
5. **CI**: `controla_segreti.js` (escáner de secretos) y análisis de código muerto. A nuestro CI le falta el escáner de secretos.
6. Regla compartida: ambos excluyen el booking de WebCargo.

## Riesgos de su enfoque
- Token de máquina compartido: el backend no aplica techo del cliente ∩ rol del usuario y se pierde el autor en la auditoría.
- Token firmado en `localStorage` sin revocación; clave derivada del `client_secret`.
- Páginas monolíticas, README desactualizado (cita un `server.js` inexistente), documentación duplicada.
- Duplica capacidades que el backend ya tiene (Copilot, agentes ElevenLabs).
- Supabase: en `config/supabase/*.sql` no aparece `ENABLE ROW LEVEL SECURITY` (sí en `navigator-auth/sql`); revisar.
- No se encontraron secretos en el repositorio.

## Su inventario de bugs del backend: ya obsoleto
`51_confronto_php_api.md` lista 3 bugs SQL. Comprobado contra el código actual de `tmwe_json`: ya están corregidos
(`Shipment_Query_Model` usa `consegna_stato AS stato_sped`; `get_tracking_events` consulta `spedizioni_tracking`;
`Manifest_Story_Model` filtra por `insert_datetime`). No hay nada que añadir a `prompt-agente-tmwe-json.md`.

## Recomendación
Mantener el BFF + Vue/Vuetify como plataforma y tomar de Jose_master el conocimiento de producto, no su ejecución:
1. Guía de UX como segunda oleada de diseño, tras la paridad.
2. Su registro de paridad y pruebas de contrato como criterio de aceptación.
3. Escáner de secretos y CAP locales.
4. Decisión de producto pendiente (del responsable): qué línea de frontend es la oficial.

## Vistas y menú del partner (copia local en /var/www/host/Jose_master, 2026-10-19)

**Menú del partner en Jose_master** (`tmwe2/assets/tmwe.js`, `PARTNER_MENU`): ya existe, con etiquetas en lenguaje llano,
y la guardia `vistaGuardia` devuelve al inicio cualquier página fuera de la lista.

| Grupo | Accesos |
|---|---|
| (fijo) | Cockpit |
| Cada día | Inicio, Spedizioni, Merci in aereo (cargo) |
| Recogidas y paquetes | Ritiri, Pacchi fermi (retenciones) |
| Clientes y dinero | I miei clienti, Fatture |
| Agentes y COBRA | I miei agenti, Inviti, COBRA |

El menú completo del personal (`NAV`) tiene además Quotazione aerea, Giro autista, Magazzino, Pagamenti, Commerciale,
Servizi, Zone, Listini, Tabelle, Sistema, Telemetria… Los grupos son acordeón (máximo dos abiertos). No hay «Ver más».

**Vista partner del personal:** `X-Act-As-Partner` + confirmación `X-Effective-Partner` (el gateway no muestra nada si falta);
equivale a nuestro `X-Impersonate-Partner-Id` y exige los mismos requisitos (anagrafica real 1, partner ERP válido, auditoría).

**Privacidad del partner, en el gateway** (`api/_lib/privacy_partner.js`, `ambito.js`): quita costes y márgenes de TMWE a
cualquier profundidad y los precios de envíos que no son de clientes del partner; restringe los agentes al partner.
En erp_findair esto no existe en el BFF: lo decide el backend con el token del usuario. **Decisión de producto (2026-10-19):**
los partners pueden ver los costes de los proveedores, así que no hay que filtrar `costo*`/`supplier_cost*` ni ocultarlos en la SPA.
Los márgenes y precios de clientes ajenos siguen siendo cosa del backend (ámbito por anagrafica). Todo texto nuevo de la SPA
debe existir en los cinco idiomas seleccionables (es, it, en, de, nl).

### Vistas: equivalencias
| Jose_master | erp_findair |
|---|---|
| index (Dashboard «Da fare oggi» + cestini) | `/home` (cockpit y accesos) |
| spedizioni, cargo, prese, giacenze, crm, messaggi | `/shipment`, `/cargo`, `/pickup`, `/giacenze`, `/crm`, `/tickets` |
| fatturazione, pagamenti | `/invoicing`, `/payments` |
| clienti, listini, clienti_listini | `/clients`, `/price-lists` |
| magazzino, giro | `/warehouse/*` (pesaje, docpack, reparto, entregas) |
| settings, tabelle, servizi, zone, sistema | `/settings/*` (~60 pantallas) |
| agente, agenti, robin, cobra, wca, rete, incontro | `/copilot` (resto sin equivalente) |
| quotazione (cotización aérea) | **sin equivalente** como pantalla |
| commerciale, modelli, telemetria, stato | **sin equivalente** (`/email-templates` cubre parte de modelli) |
| — | `/consolidata`, `/proforma`, `/cod`, `/bulk`, `/tracking` (solo aquí) |
