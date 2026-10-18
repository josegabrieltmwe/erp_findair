# Comparativa: Jose_master vs. BFF + Vue/Vuetify (erp_findair)

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
