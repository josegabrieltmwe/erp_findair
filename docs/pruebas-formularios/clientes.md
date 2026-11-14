# Formularios de Clientes y precios: casos de prueba

> **Estado:** borrador · **Última modificación:** 2026-11-02 · Generado por lectura de código (no se ejecutó nada). Parte de [plan-pruebas-formularios.md](../plan-pruebas-formularios.md). Las reglas de cada ficha salen del código citado; lo marcado «no determinado» no se pudo confirmar.

## Clientes y precios (prefijo CLI)

Alcance leído: `packages/platform/anagrafiche`, `packages/platform/listini`, `packages/platform/googlemaps_address_fields`, `packages/platform/detail` y las rutas `/clients*`, `/anagrafica*`, `/price-lists`, `/my-org*` de `apps/operations/src/router/index.ts` (`/clients/new|:id|:id/:tab` solo redirigen; `/my-org*` redirigen a `anagrafica-detail[-tab]` con `window.__TMWE_OPERATIONS__.partnerId`, o a `/clients` si no hay partnerId; `apps/operations/src/modules/partner_clients` solo contiene `locales`, sin formularios). Se documentan 24 fichas (alta/ficha de anagrafica y sus 9 pestañas, listado, clonado, listas de precios y sus diálogos). Rutas de pantalla: `/clients` (listado con `lockTipo: "C"`), `/anagrafica/new`, `/anagrafica/:id[/:tab]`, `/price-lists`.

Mayor riesgo: (1) alta de anagrafica, que el servidor completa con 2 contactos base con `auth_17..20` y credenciales que la SPA nunca muestra (P38); (2) edición de márgenes por escalón, que lanza un PATCH por cada pulsación de tecla; (3) datos fiscales (VAT/CF, PEC, codice destinatario, IBAN) sin ninguna validación de formato ni en SPA ni en `tmwe_api`; (4) publicación de matriz de precios, importación con modo "replace" y modificación múltiple en % (efectos económicos, algunos irreversibles); (5) `isTmwe` de `useAnagraficaContext` no se alimenta en la app operations (ver CLI-01 Riesgos).

Convenciones: "Server" = `/var/www/dev/api/controller/api/...`. Los errores del servidor llegan al usuario como toast con el mensaje del servidor (`toast.error(e.message)`), salvo donde se indique. Ningún caso de esta sección dispara booking, etiquetas ni emails a transportistas; los que envían emails de sistema (contactos: reset password / send_profile) o crean credenciales se marcan "solo sandbox".

### CLI-01 · Alta de anagrafica (cliente / partner)
- **Ruta/pantalla:** `/anagrafica/new` (nombre `anagrafica-create`; legado `/clients/new` redirige)  **Componente:** `packages/platform/anagrafiche/feature/AnagraficaCreateSection.vue` (montado por `AnagraficaDetailPage.vue:63`, submit en `onCreate` l.~410)  **Envía:** `POST /api_anagrafica_crud` (`anagraficaService.create`, `services/anagrafica.service.ts:340`)
- **Permisos:** acceso al módulo anagrafiche (`check_module_access`, Server `Anagrafica_Crud_Controller.php`). El select `tipo` está `disabled` si `!isTmwe` (`useAnagraficaContext`). Si el llamante no es la anagrafica 1, el servidor fuerza `id_anagr_titolare = partner del llamante` (Server `handle_create`).
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| rag_soc | v-text-field | Sí | `ruleRequired` (trim no vacío) en SPA; servidor `empty(rag_soc)` -> 422 "Razon social es obligatoria". Sin maxlength en SPA (la columna es varchar(100) según `Anagrafica_Clone_Controller.php:71`) |
| nome_breve | v-text-field | No | sin reglas |
| tipo | v-select (CV,C,P,F,T,I) | No (def. `C`) | deshabilitado si no es TMWE; en edición hay además TP y A (`AnagraficaDatiBaseSection.vue`), en alta no |
| pi_cf | v-text-field | No | sin formato/longitud/unicidad en SPA ni en servidor (`handle_create` no valida) |
| cf | v-text-field | No | ídem |
| metric_imperial | v-select M/I | No (def. `M`) | - |
| valuta_sigla | v-autocomplete (catálogo `currenciesService`) | No | si el catálogo falla queda vacío y el alta sigue operativa (catch silencioso) |
| legale | v-select N/S/P, clearable | No | null no se envía |
| note | v-textarea | No | - |

  Payload: solo campos distintos de `''`/`null` (`onSubmit`). Los defaults comerciales (id_agente, id_pagam_met/scad, diritto_fisso, suppl_carburante, tipo_pagamento, fattura, fatt_lingua) los pone `Anagrafica_Service::apply_commercial_defaults` (comentario en el componente; Server `service/anagrafica/Anagrafica_Service.php:608`).
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CLI-01-01 | Alta mínima como partner | solo rag_soc="Cliente QA 001" | 201; toast "creado" con el nombre (6 s); navega a `/anagrafica/{id}` pestaña dati_base; `tipo=C`, `id_anagr_titolare` = partner de sesión | P0 | Auto |
| CLI-01-02 | Alta como TMWE eligiendo tipo | rag_soc + tipo=P (si el select está habilitado) | se crea con `tipo=P`; sin `id_anagr_titolare` forzado (partner_id=1). Comprobar a quién queda asignado | P0 | Manual |
| CLI-01-03 | Partner intenta enviar tipo distinto por API | POST con `tipo=P` desde sesión partner (petición directa) | no determinado: el servidor no valida el enum ni restringe `tipo` en `handle_create`; verificar si un partner puede crear tipo P/I | P0 | Manual |
| CLI-01-04 | Contactos base creados al alta (P38) | alta mínima; luego abrir pestaña Contactos | existen "Accesso admin" (tipo 6, `auth_17..20`=S) y "Accesso user" (tipo 3, `auth_17/18`=N, `auth_19/20`=S), sin sede asignada (`id_sede_interna` null porque el alta no envía sede); cada uno con login/pwd generados y rol por defecto | P0 | Auto |
| CLI-01-05 | Credenciales de los contactos base no se muestran | alta mínima | decidido (P38): la contraseña nunca se muestra; el administrador recibe un enlace de acceso por correo. La SPA redirige a la ficha | P0 | Manual |
| CLI-01-13 | Alta de partner (TMWE): sección «Administrador de la cuenta» | TMWE; tipo=P con «Partner del sistema» marcado | aparece la sección con nombre y correo obligatorios; correo sin formato bloquea el envío; el POST lleva `erp_partner=S` y `admin_contact {nome, mail}` | P0 | Manual |
| CLI-01-14 | Alta de cliente no envía admin_contact | tipo=C | la sección no aparece; el POST no lleva `admin_contact` ni `erp_partner`; siguen los dos contactos genéricos | P0 | Auto |
| CLI-01-15 | Usuario no TMWE no ve el tipo Partner | sesión partner | el selector de tipo no ofrece «Partner» y sigue deshabilitado; un POST directo con `erp_partner=S` recibe 403 | P0 | Manual |
| CLI-01-16 | Resultado del alta de partner | alta con `access_link_sent` true / false | true: aviso de éxito con el correo; false: aviso con botón «Reenviar enlace de acceso» (POST `api_contact_access_link`) | P0 | Manual |
| CLI-01-17 | 422 `ADMIN_CONTACT_REQUIRED` | forzar `details.fields` (`admin_contact.nome`/`.mail`) | los errores se pintan junto a los campos del administrador | P1 | Manual |
| CLI-01-06 | Nombre con 101+ caracteres | rag_soc de 120 caracteres | no determinado: SPA sin maxlength; esperar 4xx/truncado del servidor. Registrar comportamiento real | P1 | Auto |
| CLI-01-07 | Divisa inexistente / catálogo caído | simular fallo de `api_master_currencies` | autocomplete vacío, el alta funciona sin `valuta_sigla` | P2 | Auto |
| CLI-01-08 | pi_cf duplicado | crear dos clientes con el mismo pi_cf | no determinado: nada impide el duplicado (el diálogo de clonado dice que dos anagrafiche con mismo pi_cf son la misma entidad fiscal) | P0 | Manual |
| CLI-01-09 | pi_cf / cf con formato inválido | pi_cf="12", cf="XXXX" | se acepta (sin validación); verificar que luego VIES lo marca KO y la facturación no rompe | P0 | Manual |
| CLI-01-10 | Rollback del alta en cascada | forzar fallo al crear contactos base (entorno de prueba) | `rollback_create` borra anagrafica y sub-entidades; la SPA muestra el mensaje "Error en cascade insert..." | P1 | Manual |
| CLI-01-11 | Cancelar | pulsar Cancelar con datos | vuelve a `/clients` (`anagrafiche`) sin crear nada | P2 | Auto |
| CLI-01-12 | Doble envío en "Crear" | doble clic rápido | un solo POST (`creating` bloquea, `onCreate` hace return) y un solo registro | P1 | Auto |

- **Riesgos / dudas:**
  - `useAnagraficaContext.readIsTmwe()` (`composables/useAnagraficaContext.ts`) lee solo `window.__TMWE_ANAGRAFICA_CTX__` y `window.__TMWE_PARTNER_CLIENTS__`; en `apps/` nadie los define (grep sin resultados). La app operations expone `window.__TMWE_OPERATIONS__.isTmwe` (`apps/operations/src/env.d.ts:16`, y lo usa `listini/composables/useListiniAdmin.ts:21`). Consecuencia probable: `isTmwe` siempre `false` en operations, el select `tipo` queda deshabilitado también para TMWE y `scopeTitolare` no filtra por titolare (afecta CLI-02, CLI-03, CLI-05, CLI-06). Verificar en navegador con un usuario TMWE.
  - P38: decidido en el API (rama `p38-alta-partner-admin`, ver `docs/06-api/contactos-comportamientos.md` allí): el alta de partner crea solo el administrador indicado; cliente y resto no cambian. Enlace por contacto: `POST api_contact_access_link` (TMWE o administrador de la cuenta; 429 espera 60 s y 5 por hora). Los casos CLI-01-13 a 17 no se han ejecutado.
  - Server no valida longitud ni formato de `pi_cf`/`cf`; tampoco `tipo`.

### CLI-02 · Ficha: Datos base (edición) y comprobación VIES
- **Ruta/pantalla:** `/anagrafica/:id` pestaña `dati_base`  **Componente:** `packages/platform/anagrafiche/feature/AnagraficaDatiBaseSection.vue`  **Envía:** `PATCH /api_anagrafica_crud?id=` (`anagraficaService.update`, con `include=sedi,banche,contatti,lettint,more`); VIES: `POST /api_anagrafica_vies`
- **Permisos:** acceso al módulo y a la anagrafica (`validate_anagrafica_access`); `tipo` deshabilitado si `!isTmwe`. `readonly_fields` en servidor: `id_anagr_titolare`, `erp_partner`, `fatturazione_erp` (-> `check_readonly_fields_violation`).
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| rag_soc | text | Sí | `ruleRequired` solo en visual: **el submit no valida** (`onSave` emite sin `validate()`), solo `:disabled="!dirty"` |
| nome_breve, note | text / textarea | No | - |
| tipo | select (CV,C,P,F,T,TP,I,A) | No | disabled si no TMWE; servidor no valida el enum |
| pi_cf | text + icono VIES | No | clic en icono -> VIES |
| cf | text | No | - |
| metric_imperial | select M/I | No | - |
| valuta_sigla | autocomplete | No | conserva valor actual aunque no esté en el catálogo |
| bloccato | CmLockSwitch | No | - |
| legale | select N/S/P | No | - |
| scad_listino | `type=date` | No | sin min/max |
| url_real | text | No | sin validación de URL |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CLI-02-01 | Guardar vaciando rag_soc | borrar rag_soc y pulsar Guardar | el campo muestra error, pero el PATCH se envía igualmente con `rag_soc=""`: comprobar respuesta del servidor (no hay validación en `handle_update`) y que la ficha no queda sin nombre | P0 | Auto |
| CLI-02-02 | Botón Guardar deshabilitado sin cambios | abrir ficha | `Guardar` deshabilitado hasta que cambia un campo; `Restablecer` vuelve al snapshot | P2 | Auto |
| CLI-02-03 | Cambiar pi_cf y pulsar VIES sin guardar | editar pi_cf a otro valor, clic en icono VIES | la petición lleva solo `id_anagrafica`: valida el valor persistido, no el tecleado (Server `Anagrafica_Vies_Controller.php:51-75`). Confirmar y valorar si es defecto | P0 | Manual |
| CLI-02-04 | VIES válido / inválido / país sin VIES | pi_cf IT válido; pi_cf inválido; sede con país fuera de VIES | toast ok con nombre devuelto / warning `vies.ko` / error "Pais no encontrado" o "iso_paese requerido"; el listado refleja `vies_check` tras recargar. Solo con red a VIES (no usa transportistas) | P1 | Manual |
| CLI-02-05 | VIES sin sede ni país | cliente sin sede | 422 "Pais ISO requerido" mostrado como toast de error | P1 | Auto |
| CLI-02-06 | Bloquear cliente (`bloccato`) | activar candado y guardar | PATCH con `bloccato`; el listado muestra el estado y el filtro "bloqueado" lo incluye | P0 | Auto |
| CLI-02-07 | Campo de solo lectura del servidor | enviar `id_anagr_titolare` por API en el PATCH | rechazo por `check_readonly_fields_violation` (la SPA no lo envía) | P0 | Manual |
| CLI-02-08 | Cambiar divisa del cliente | valuta_sigla EUR -> GBP | se guarda; no recalcula nada en la propia pestaña. Comprobar efecto en facturación futura (no determinado) | P0 | Manual |
| CLI-02-09 | url_real y scad_listino con valores raros | url="no es url"; fecha pasada | se aceptan sin validar; verificar que otras pantallas (listado/listini) no rompen con `scad_listino` pasada | P2 | Auto |

- **Riesgos / dudas:** `onSave` hace `original = form` justo tras emitir, antes de saber si el PATCH tuvo éxito (`AnagraficaDatiBaseSection.vue`, `onSave`); si el servidor rechaza, el botón queda "limpio" aunque no se guardó (el error solo sale por toast del padre). `saving` se pone a false inmediatamente (el spinner nunca llega a verse). El snapshot envía **todas** las claves (incluidas las no modificadas) en cada PATCH.

### CLI-03 · Ficha: Facturación y condiciones comerciales
- **Ruta/pantalla:** `/anagrafica/:id/fatturazione`  **Componente:** `packages/platform/anagrafiche/feature/AnagraficaFatturazioneSection.vue`  **Envía:** `PATCH /api_anagrafica_crud` (mismo `onSaveBase` del padre)
- **Permisos:** como CLI-02. Las opciones de los selects se cargan con `scopeTitolare(...)` (para TMWE, el titolare del cliente).
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| tipo_pagamento, fattura, fatt_lingua | select | No | listas fijas en el componente |
| esente_IVA | select dinámico (21,S1,S2,S,SN) | No | catálogo `clientCausalsService` (descr/descrEN por idioma); un valor no listado se corrompía en versiones previas (comentario) |
| diritto_fisso, scelta_corr_perc, ass_minimo | `type=number step=0.01` | No | sin min/max |
| id_pagam_met, id_pagam_scad, id_agente, id_settore_cliente | select dinámico clearable | No | dependen del titolare; agentes = contatti del titolare |
| scelta_forn | select BSI/ESI/BES | No | - |
| descriz_settore | text | No | - |
| 11 flags S/N (`fatt_sped_posta`, `solleciti_invia`, `pec_fatture`, `pec_solleciti`, `alert_mail`, ..., `ldv_corriere_sepresa`) | v-switch S/N | No | nunca null |
| tipo_record | select R/C | No | def. `R` si vacío |
| b2b_codcli_reg / b2b_codcli_obbl | text / switch | No | - |
| blocca_corriere + blocca_CORR_2/3/7/8/5/3338 | CmLockSwitch | No | BRT, DHL, UPS, TNT, FedEx, Palletways. El comentario avisa de ids trocados en datos (P37 abierto) |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CLI-03-01 | Cambiar régimen IVA | esente_IVA 21 -> S1 -> guardar y recargar | persiste `S1`; el select recarga la opción correcta (no vuelve a 21) | P0 | Auto |
| CLI-03-02 | Importes negativos / muchos decimales | diritto_fisso=-5; ass_minimo=1.005; scelta_corr_perc=150 | sin validación cliente; documentar si el servidor acepta (probable sí). Candidatos a defecto fiscal | P0 | Manual |
| CLI-03-03 | Vaciar forma de pago | id_pagam_met con clear | se envía null y el servidor lo acepta o aplica default; verificar que no rompe facturación | P0 | Manual |
| CLI-03-04 | Selects dependientes del titolare | abrir ficha de un cliente de partner X como TMWE | métodos de pago/vencimientos/agentes son los de X, no los de TMWE (si `isTmwe` falla, ver CLI-01 Riesgos) | P0 | Manual |
| CLI-03-05 | Falla la carga de opciones | simular 500 en pagos/sectores | selects vacíos, la pantalla no se rompe (`.catch(() => [])`) | P2 | Auto |
| CLI-03-06 | Bloqueos por transportista | activar blocca_CORR_7 (UPS) y guardar | se guarda `blocca_CORR_7=S`; comprobar con P37 que el id corresponde realmente a UPS. No lanza llamadas a transportistas | P0 | Manual |
| CLI-03-07 | Flag PEC fatture sin PEC en la sede | `pec_fatture=S` con sede sin PEC | se guarda sin aviso (no hay dependencia validada); verificar impacto en emisión SDI (P40) | P0 | Manual |
| CLI-03-08 | Restablecer | modificar varios y pulsar Restablecer | vuelve al estado guardado sin PATCH | P2 | Auto |
| CLI-03-09 | fattura=No / fatt_lingua | cambiar a otro idioma y guardar | persiste; no recalcula facturas existentes (no determinado) | P1 | Auto |

- **Riesgos / dudas:** al guardar se envían todas las claves de `COMMERCIAL_KEYS`, no solo las modificadas, incluidos los 6 bloqueos de transportista y flags que pudieron cambiar a la vez desde otra sesión (sobrescritura ciega). `id_agente` usa ids de contatti.

### CLI-04 · Sede (alta / edición): dirección, PEC y codice destinatario
- **Ruta/pantalla:** `/anagrafica/:id/sedi` -> diálogo  **Componente:** `packages/platform/anagrafiche/feature/SedeFormDialog.vue` (listado `AnagraficaSediSection.vue`)  **Envía:** `POST|PUT|DELETE /api_anagrafica_addresses`; `PUT` (setDefault) si es la primera sede
- **Permisos:** Server `Anagrafica_Address_Controller.php`: acceso al módulo + `validate_anagrafica_access`.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| label (rag. soc. de la sede) | text | No (SPA); servidor "required" inferido no verificado | sin reglas |
| id_paese_iso | CmCountrySelect | No | condiciona provincia, CAP y `cod_destin` |
| indirizzo | text | No | - |
| cap | CmCapField | No | al blur con >=3 caracteres consulta `cap_city_prov` y rellena prov/ciudad **solo si están vacíos** |
| citta | CmCittaField | No | sugerencias |
| prov | CmProvinciaSelect | No | etiqueta/lista según país |
| PEC | text | No | **sin formato de email** |
| cod_destin | text | No | `disabled` si país != IT; **sin longitud (7 caracteres) ni formato**; el valor no se limpia al cambiar de país |
| nome_from, tel, fax | text | No | - |
| mail | text `type=email` | No | solo validación HTML nativa |
| dhl_airport, cargo_airport | CmTerminalSelect (aeropuertos por país) | No | - |
| id_autista, id_autista_cons | select (autistas del cliente) | No | - |
| presa_ora, presa_limite, cons_ora | `type=time` | No | - |
| presa_fissa, unisciprescons, logistica, ldv_corriere_sepresa | switch S/N | No | def. `N` |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CLI-04-01 | Primera sede se marca como predeterminada | cliente sin sedes; crear una | tras crear, la SPA lista las sedes y, si hay 1, llama a `PUT setDefault`; la sede aparece como facturación/por defecto | P0 | Auto |
| CLI-04-02 | Segunda sede no cambia el default | crear otra sede | la primera sigue siendo predeterminada | P1 | Auto |
| CLI-04-03 | Autocompletado por CAP | país IT, CAP "20121", prov/ciudad vacías | rellena prov "MI" y ciudad si solo hay una; con prov ya escrita no la pisa | P1 | Auto |
| CLI-04-04 | Cambio de país con CAP/prov previos | IT -> ES con datos IT | no determinado: ¿se limpian prov/CAP? (`useAddressGeo`); cod_destin se deshabilita pero conserva valor | P1 | Manual |
| CLI-04-05 | codice destinatario IT | cod_destin="ABC" (3 caracteres) y "ABCDEFG" | se acepta sin validar (SDI exige 7 caracteres alfanuméricos o 0000000); verificar rechazo del servidor y efecto en emisión (P40) | P0 | Manual |
| CLI-04-06 | PEC no válida | PEC="noesuncorreo" | se acepta; verificar rechazo del servidor | P0 | Auto |
| CLI-04-07 | Cambiar país IT -> FR con cod_destin informado | editar | campo deshabilitado; el valor antiguo se envía igualmente | P0 | Auto |
| CLI-04-08 | Borrar sede predeterminada o con contactos | eliminar | confirmación previa (`useConfirm`); resultado del servidor no determinado (Server `handle_delete` no revisado a fondo) | P0 | Manual |
| CLI-04-09 | Sede de otra anagrafica | PUT con id de sede ajena | 403 "Sin acceso" | P0 | Manual |

- **Riesgos / dudas:** ningún dato fiscal de la sede (PEC, SDI, mail, CAP) se valida; `Anagrafica_Address_Controller.php` solo comprueba permisos e `id_anagrafica`. Si falla `listByPartner` tras el POST, la sede queda creada sin ser predeterminada y se muestra error (catch único).

### CLI-05 · Contacto (alta / edición) y entrega de credenciales
- **Ruta/pantalla:** `/anagrafica/:id/contatti` (y `/my-org/users`) -> diálogo  **Componente:** `packages/platform/anagrafiche/feature/ContattoFormDialog.vue` (lista `AnagraficaContattiSection.vue`)  **Envía:** `POST /api_anagrafica_contacts` (alta), `PUT` (edición), `DELETE`; acciones POST `reset_password`, `send_profile`, `reset_app_token`, `b2b_direct`
- **Permisos:** Server `Anagrafica_Contact_Controller.php`: acceso al módulo; **un cliente final (actor CUSTOMER) sin `profile:write` solo puede leer** (403 `ACCOUNT_ADMIN_REQUIRED`); límite de 30 altas/hora y tope total 500 (no TMWE); un partner no puede asignar `auth_10..16` ni `erp_login_app` (se eliminan del payload); no se puede dar de baja el propio usuario.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| nome | text | **Sí en servidor** ("Nombre es obligatorio"); **no en SPA** | sin regla en el formulario |
| mail | text | No | sin formato |
| ruolo, tel, tel2, cell, fax | text | No | - |
| id_sede_interna | select (sedi del cliente) clearable | No | servidor: la sede debe pertenecer a la misma anagrafica ("Sede no pertenece a esta anagrafica") |
| id_contatto_tipo | select clearable | No | - |
| sigl | text maxlength=10 | No | - |
| lingua_web / lingua_trad / lingua_tel | select idiomas | No | - |
| note | textarea | No | - |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CLI-05-01 | Alta sin nombre | todos vacíos, Guardar | la SPA envía; el servidor responde 422 "Nombre es obligatorio" y se ve como toast (no hay marca en el campo) | P1 | Auto |
| CLI-05-02 | Alta correcta muestra credenciales una vez | nome="QA Uno" | paso "credenciales" con loginn y password (`CredentialsRevealCard`); la lista de detrás ya está refrescada; al cerrar y reabrir no se pueden volver a ver | P0 | Auto (solo sandbox) |
| CLI-05-03 | Sede de otra anagrafica | id_sede_interna de otro cliente (API directa) | 422 "Sede no pertenece a esta anagrafica" | P0 | Manual |
| CLI-05-04 | Partner intenta conceder permisos internos | crear contacto con `auth_12=S` / `erp_login_app=S` vía API desde sesión partner | los campos se descartan en silencio (no hay error) | P0 | Manual |
| CLI-05-05 | Límite de altas | 31 altas en una hora como partner no TMWE | 429/error "Límite alcanzado: máx 30 creaciones por hora" | P1 | Manual |
| CLI-05-06 | Cliente final sin `profile:write` | login de cliente final; intentar crear/editar contacto | 403 `ACCOUNT_ADMIN_REQUIRED`; el botón no se oculta en la SPA (no determinado) | P0 | Manual |
| CLI-05-07 | Edición no devuelve credenciales | editar un contacto existente | toast "actualizado", cierra el diálogo, sin credenciales | P1 | Auto |
| CLI-05-08 | Eliminar el propio usuario | borrar el contacto con el que se ha iniciado sesión | 403 "No puede dar de baja su propio usuario"; confirmación previa antes de llamar | P0 | Manual |

- **Riesgos / dudas:** `nome` obligatorio solo en servidor. En edición el formulario hace `{...props.contatto}` y envía la fila completa (incluidos `auth_*`, `loginn`, flags), lo que puede reescribir permisos con datos obsoletos. `optionsLoaded` se cachea por instancia: si se cambia de cliente sin remontar el diálogo, las sedes mostradas podrían ser del cliente anterior (no determinado, `ContattoFormDialog.vue` `loadOptions`).

### CLI-06 · Contacto: permisos (auth_*), alertas, rol API y acceso Findair
- **Ruta/pantalla:** `/anagrafica/:id/contatti` -> acciones de fila / diálogo de permisos  **Componentes:** `packages/platform/anagrafiche/feature/ContattoPermissionsDialog.vue`, `components/AuthFlagsEditor.vue`, `components/ContactApiRolesEditor.vue`, conmutadores en `AnagraficaContattiSection.vue`  **Envía:** `PUT /api_anagrafica_contacts` (permisos), `POST /api_anagrafica_findair_access` (acceso/nivel), rol API vía `contattiService.setApiRole`
- **Permisos:** edición de roles OAuth solo TMWE (`ensureApiRoles` sale si `!isTmwe`; endpoint `api_admin_oauth_roles` admin-only); enlace a ficha de usuario solo TMWE con ruta `user-detail`; `ACCOUNT_ADMIN_REQUIRED` para cliente final.
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| auth_10..auth_24 (15 flags) | AuthFlagsEditor (switches con tooltip) | No | avisos: `auth_18` cubre `auth_20`; `auth_18` bypassa filtros `auth_21/22` |
| erp_login_app, b2b_login_app | switch S/N | No | `erp_login_app` lo filtra el servidor para no TMWE |
| 11 alertas (`alert_mail`, `commerc_mail`, `contab_mail`, `offerte_mail`, `nel_calendario`, ...) | switches | No | - |
| Findair habilitado / nivel (basic/full) | switch + selector | No | optimista con override; en error recarga con `getApiRole` |
| Rol API | selector de roles | No | error `ROLE_NOT_ASSIGNABLE` traducido por `roleConflictMessage` |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CLI-06-01 | Conceder `auth_17` (administrador de cuenta) a un contacto de cliente | activar y guardar | se guarda; ese contacto puede gestionar usuarios de **su** cuenta, no de otras; no obtiene `is_admin` global (P38) | P0 | Manual |
| CLI-06-02 | Conceder `auth_18` a contacto de cliente final | activar `auth_18` | el servidor topa el alcance de costes (`Data_Scope::capped_for_actor`): verificar que el contacto no ve costes | P0 | Manual |
| CLI-06-03 | Partner activa `auth_10..16` | desde sesión partner | cajas rojas ocultas/ignoradas: el servidor las elimina; la SPA no avisa. Comprobar que no cambian | P0 | Manual |
| CLI-06-04 | Aviso `auth_18` + `auth_20` y bypass de filtros | activar combinaciones | se muestran los avisos `warning_auth18_covers_auth20` / `warning_filters_bypassed`; indicador "sin guardar" | P2 | Auto |
| CLI-06-05 | Habilitar y deshabilitar acceso Findair | alternar el switch | toast; fila refleja estado; tras error se recarga el estado real | P0 | Auto (solo sandbox) |
| CLI-06-06 | Cambiar nivel basic <-> full | selector | un solo POST; sin cambio si es el mismo nivel | P0 | Auto |
| CLI-06-07 | Asignar un rol no asignable / solo interno | rol `isInternalOnlyRole` a un contacto de cliente | mensaje de conflicto traducido; el rol no cambia | P0 | Manual |
| CLI-06-08 | Rol por defecto del alta (P38) | cliente nuevo; abrir ambos contactos base | cliente -> `findair_basic`; partner -> `partner_staff` + `partner_billing`; TMWE -> `tmwe_staff_portal` | P0 | Manual |

- **Riesgos / dudas:** el diálogo de permisos no está condicionado por `isTmwe` en la SPA (la protección es solo servidor). El contrato `P38` sigue con decisión de producto pendiente.

### CLI-07 · Banca (alta / edición)
- **Ruta/pantalla:** `/anagrafica/:id/banche`  **Componente:** `packages/platform/anagrafiche/feature/BancaFormDialog.vue` (+ `AnagraficaBancheSection.vue`)  **Envía:** `POST|PUT|DELETE /api_anagrafica_banks`; `PUT` predeterminada
- **Permisos:** módulo anagrafiche + acceso a la anagrafica (Server `Anagrafica_Bank_Controller.php`).
- **Campos:** nome, swift (maxlength 11), iban, abi, cab, cc, cin (maxlength 4), agenzia (text), note (textarea). Ninguno obligatorio; **sin validación de IBAN/SWIFT/ABI/CAB** ni en SPA ni en servidor (solo `id_anagrafica`/`id`).
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CLI-07-01 | IBAN inválido | iban="123" | se acepta (sin validación); documentar y proponer checksum mod-97 | P0 | Auto |
| CLI-07-02 | SWIFT de 12+ caracteres | pegar 14 caracteres | `maxlength=11` trunca al teclear; pegado también | P2 | Auto |
| CLI-07-03 | Marcar banca predeterminada | segunda banca -> predeterminada | `PUT`; la anterior deja de serlo; `id_banca_def` actualizado | P0 | Auto |
| CLI-07-04 | Banca vacía | guardar con todo en blanco | se crea una fila vacía (sin regla); revisar | P1 | Auto |
| CLI-07-05 | Eliminar la banca predeterminada | eliminar | no determinado (el servidor no se ha revisado); verificar que `id_banca_def` no queda apuntando a un id borrado | P0 | Manual |

- **Riesgos / dudas:** sin validación de IBAN en ningún nivel; datos de cobro sin control.

### CLI-08 · Carta de intención (dichiarazione d'intento)
- **Ruta/pantalla:** `/anagrafica/:id/lettint`  **Componente:** `packages/platform/anagrafiche/feature/LettIntFormDialog.vue` (+ `AnagraficaLettIntSection.vue`)  **Envía:** `POST|PUT|DELETE /api_anagrafica_vat_declarations` (`vatDeclarationsService`)
- **Permisos:** módulo anagrafiche + acceso a la anagrafica.
- **Campos:** dichiaraz_intenti_numero (text; **obligatorio solo en servidor**, "Numero declaracion obligatorio" en alta), aliquota_IVA (number step 0.01), dichiaraz_intenti_data / _data_scad (date), id_causale_IVA (select de causales). Sin validación de rango ni de coherencia de fechas en SPA.
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CLI-08-01 | Alta sin número | número vacío | 422 "Numero declaracion obligatorio" como toast | P0 | Auto |
| CLI-08-02 | Fecha fin anterior a fecha inicio | data=2026-12-01, scad=2026-01-01 | se acepta en SPA; comprobar servidor (no validado en el controlador) | P0 | Auto |
| CLI-08-03 | Aliquota fuera de rango | aliquota_IVA=-5 / 250 | sin validación SPA; comprobar servidor | P0 | Manual |
| CLI-08-04 | Efecto en facturación | carta vigente con causal S | solo observable en facturación (fuera de alcance); verificar que `esente_IVA` y causal son coherentes | P0 | Manual |
| CLI-08-05 | Eliminar carta | confirmar | DELETE y desaparece de la lista | P1 | Auto |

- **Riesgos / dudas:** el contrato P40 indica que el código IVA en SDI no se valida; esta pestaña es fiscal pero no valida coherencia entre fechas, número y causal.

### CLI-09 · Clonar anagrafica (simular / clonar)
- **Ruta/pantalla:** `/clients` o listado de Anagráfica -> acción "Clonar" de fila  **Componente:** `packages/platform/anagrafiche/feature/AnagraficaCloneDialog.vue`  **Envía:** `POST /api_anagrafica_clone` (`dry_run` true/false)
- **Permisos:** servidor `Anagrafica_Clone_Controller.php:56`: "Solo un administrador puede clonar una anagrafica" (403) y acceso a la anagrafica origen. La SPA no oculta la acción por rol (no determinado).
- **Campos:**

| Campo | Control | Obligatorio | Reglas detectadas (fuente) |
|---|---|---|---|
| rag_soc nuevo | v-text-field maxlength=100 counter | Sí | SPA: trim no vacío; servidor: trim, <=100 (`:71`) |
| mask_emails | checkbox, def. true | No | enmascara los emails de los contactos clonados |
| (dry_run) | botones Simular / Clonar | - | Simular no escribe |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CLI-09-01 | Simulación | Simular con nombre por defecto "X (TEST)" | informe con filas por tabla, total, avisos y logins previstos; ninguna fila nueva; `cloned` no se emite | P0 | Auto |
| CLI-09-02 | Clonado real | Clonar | informe final con logins nuevos (`loginn_new`); el modal sigue abierto; toast con el id nuevo; el listado recarga | P0 | Auto (solo sandbox) |
| CLI-09-03 | Datos fiscales regenerados | clonar cliente con pi_cf | el clon NO tiene el mismo pi_cf (siempre se regeneran; sin opción en UI) | P0 | Manual |
| CLI-09-04 | Emails sin enmascarar | desmarcar `mask_emails` y clonar | los contactos del clon conservan el email real: riesgo de envíos reales; **solo sandbox** | P0 | Manual |
| CLI-09-05 | Nombre de 101 caracteres | pegar texto largo | `maxlength` lo corta a 100; con API directa 422 "Máximo 100 caracteres" | P1 | Auto |
| CLI-09-06 | Usuario no administrador | sesión partner no admin | 403; el error se pinta como mensaje bajo el campo nombre (`nameError`) | P0 | Manual |
| CLI-09-07 | Cerrar durante ejecución | clic fuera / Cancelar mientras corre | bloqueado (`running`) | P2 | Auto |
| CLI-09-08 | Listini compartidos | clonar y abrir pestaña Listini del clon | enlaza a los mismos listini (no duplica tarifas) y cotiza igual | P0 | Manual |

- **Riesgos / dudas:** el clon genera credenciales reales de contactos y puede enviar sus emails si `mask_emails` se desmarca. Los errores de cualquier tipo (incluido 403) se muestran como error de validación del campo nombre.

### CLI-10 · Listado de clientes / anagrafiche: búsqueda y filtros
- **Ruta/pantalla:** `/clients` (tipo bloqueado a C) y "Anagráfica" en Settings (todos)  **Componente:** `packages/platform/anagrafiche/feature/AnagraficaListPage.vue`  **Envía:** `GET /api_anagrafica_clients` (lockTipo C), `api_anagrafica_partners` (P) o `api_anagrafica_crud` (sin bloqueo); filtros enviados al servidor
- **Permisos:** aislamiento por partner en servidor (cada partner solo ve sus clientes; TMWE todos).
- **Campos:** búsqueda libre (rag_soc, pi_cf, nome_breve), id numérico, tipo (oculto si hay `lockTipo`), titolare (autocomplete), bloqueado, VIES, vista rápida, panel avanzado (campos del buscador legacy: país, ciudad, etc.), orden por id/rag_soc/tipo, paginación/scroll.
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CLI-10-01 | Tipo bloqueado en `/clients` | intentar forzar `tipo=P` en la URL/filtro | el listado sigue limitado a clientes (el backend ignora `tipo`) | P1 | Auto |
| CLI-10-02 | Búsqueda por pi_cf parcial | "IT0123" | filtra por `search` sobre rag_soc/pi_cf/nome_breve con debounce | P2 | Auto |
| CLI-10-03 | Aislamiento por partner | usuario partner A con titolare de partner B | solo ve su ámbito; ningún cliente de B | P0 | Manual |
| CLI-10-04 | Chips de filtros activos | aplicar 3 filtros avanzados y quitar uno | chip desaparece y se recarga; "Restablecer" limpia todo menos el tipo bloqueado | P2 | Auto |

- **Riesgos / dudas:** sin riesgos adicionales detectados.

### CLI-11 · Ficha: Más datos (AWB/agente) y subida de ficheros del partner
- **Ruta/pantalla:** `/anagrafica/:id/info`  **Componente:** `packages/platform/anagrafiche/feature/AnagraficaMoreSection.vue`  **Envía:** `PATCH /api_anagrafica_crud` con `more{}`; subida `POST /api_partner_files` (`partnerFilesService.upload`)
- **Permisos:** como la ficha; el subtítulo de ficheros (`logo`, `privacy`, `conditions`, `fuel`) sin gate de rol en la SPA.
- **Campos:** issuing_carrier, agent_iata_code, at_place, signature_ragsoc, signature_agent, b2b_footer, text_quot_vettori (textos libres; sin reglas en SPA), 4 inputs de fichero sin `accept` ni límite de tamaño en la SPA.
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CLI-11-01 | Guardar agent_iata_code | código con minúsculas / longitud rara | se guarda tal cual (sin máscara); verificar efecto en documentos AWB (no determinado) | P1 | Manual |
| CLI-11-02 | Subir logo no imagen | .exe/.pdf como `logo` | la SPA no filtra; el servidor decide (no revisado); registrar | P1 | Manual |
| CLI-11-03 | Subida de fichero grande | >20 MB | no determinado el límite; verificar mensaje de error | P2 | Manual |
| CLI-11-04 | Texto de `text_quot_vettori` con saltos de línea y HTML | multilínea | persiste y se muestra como texto | P2 | Auto |

- **Riesgos / dudas:** `onSave` actualiza `original` sin esperar el PATCH (mismo patrón que CLI-02). La subida no refresca ninguna vista previa (solo toast).

### CLI-12 · Ficha: márgenes por escalón (Assicurazione / "scaglioni") y por transportista aéreo
- **Ruta/pantalla:** `/anagrafica/:id/margini_cargo`  **Componentes:** `packages/platform/anagrafiche/feature/AnagraficaAssicurazioneSection.vue`, `AnagraficaVettoreMarginDialog.vue`  **Envía:** `PATCH /api_anagrafica_scaglioni` (por campo), `POST` presets/crear/convertir unidad; `POST|DELETE /api_anagrafica_scaglioni_vettore`
- **Permisos:** módulo anagrafiche; no hay gate de rol en la SPA (no determinado en servidor).
- **Campos:** conmutador metric/imperial, tipos (A/S/E), por escalón: kg (number step 0.01), modo % o importe fijo (`F`) con selector %/€ y valor, seguro mínimo y %, presets, botones de crear/convertir. En el diálogo por transportista: aerolínea (obligatoria), 10 tramos kg/modo/fijo/%, divisa de margen, origen de copia.
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CLI-12-01 | Edición de un margen por escalón | teclear "12.5" en profit % | **cada pulsación dispara un PATCH** (`update:model-value` -> `updateField`, sin debounce ni blur): se envía 1, 12, 12., 12.5 y un toast "actualizado" por cada uno. Confirmar y valorar como defecto | P0 | Auto |
| CLI-12-02 | Vaciar un campo numérico | borrar el valor | `Number('')`=0 se envía como 0 (borra un margen sin confirmar) | P0 | Auto |
| CLI-12-03 | Cambio de modo % -> fijo | pulsar € | `mtNN=F`; aparece campo de importe con la divisa del margen, pero el botón siempre muestra "€" aunque la divisa sea otra | P1 | Manual |
| CLI-12-04 | Conversión de unidades | metric -> imperial | convierte registros (`converted_records`); revisar que los kg guardados cambian y no se duplican | P0 | Manual |
| CLI-12-05 | Presets | aplicar preset a tipo A | sobrescribe todos los tramos sin confirmación (no hay `confirm`) | P0 | Manual |
| CLI-12-06 | Márgenes por transportista: kg no crecientes | kg1=100, kg2=50 | error `err_not_increasing`; Guardar deshabilitado/bloqueado | P0 | Auto |
| CLI-12-07 | Márgenes por transportista: negativos y sin tramos | pr=-1; todos los tramos vacíos | `err_negative` / `err_no_tiers`; el servidor repite las reglas (`Scaglioni_Vettore_Service::validate_brackets`) | P0 | Auto |

- **Riesgos / dudas:** el PATCH por pulsación (CLI-12-01) puede dejar un valor intermedio persistido si el usuario cierra la pestaña, y dispara carreras entre respuestas. `updateField` con `Number(v)` convierte vacíos en 0.

### CLI-13 · Ficha: Listini del cliente (configuración por servicio)
- **Ruta/pantalla:** `/anagrafica/:id/listini`  **Componentes:** `packages/platform/anagrafiche/feature/AnagraficaListiniSection.vue`, `AnagraficaListinoEditDialog.vue`, `ListinoPriceDialog.vue` (vista previa de precios)  **Envía:** `/api_anagrafica_service_config` (toggle bloqueo, tipo, asignación masiva, edición campo a campo)
- **Permisos:** no determinado en la SPA; reglas en `Anagrafica_Service_Config_Controller.php` (no revisado).
- **Campos:** filtros (búsqueda, país, tipo servicio, importación, L/P, nivel, prioridad); diálogo de edición: tipo L (listino) o P (precio fijo), `id_listino_nome`, `coefficiente`, `fuel_surc`, `prf_mod`, `prf_fix`, `forza_API`; tarifa de casa (house fee) number step 0.01 min 0; acciones masivas: bloquear/desbloquear, cambiar tipo, "dejar solo seleccionados", asignación masiva con `forza_API`.
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CLI-13-01 | Cambiar tipo de L a P | edición de un servicio | solo se envían los campos cambiados (`changes[]`); `prf_*` vs `coefficiente` según tipo | P0 | Auto |
| CLI-13-02 | Coeficiente y fuel negativos | coefficiente=-1, fuel_surc=-5 | no hay min en SPA; comprobar servidor (precio al cliente) | P0 | Manual |
| CLI-13-03 | House fee negativo | -3 | el campo tiene min 0 pero el submit lanza `Error(common.error)` si `next<0` | P0 | Auto |
| CLI-13-04 | Bloqueo masivo de los filtrados | "Bloquear todos los filtrados" | `toggleBlockBatch` con todos los ids; informe ok/failed; reconfirmar el alcance antes de ejecutar (no determinado si hay confirmación) | P0 | Manual |
| CLI-13-05 | "Dejar solo seleccionados" | seleccionar 3 de 40 | bloquea los demás (`bulkBlock(true, keep)`); revertir con "desbloquear todos" | P0 | Manual |
| CLI-13-06 | Asignación masiva con `forza_API` | tipo L, forza_API=S | `bulkAssign`; el cliente pasa a cotizar por API de transportista: **solo con UPSTREAM_DENY_ACTIONS activo** para no generar cotizaciones reales | P0 | Manual |
| CLI-13-07 | Fallo parcial en lote | simular un id inválido | resumen con `failed>0` sin abortar el resto | P1 | Manual |

- **Riesgos / dudas:** no se leyó el cuerpo completo de `AnagraficaListiniSection.vue`; confirmaciones y permisos por rol quedan "no determinados".

### CLI-14 · Crear lista de precios
- **Ruta/pantalla:** `/price-lists` -> "Nueva lista"  **Componente:** `packages/platform/listini/feature/CreateListDialog.vue`  **Envía:** `POST /api_listini`
- **Permisos:** Server `Listini_Crud_Controller.php`: "Admin permission required" (`is_listini_admin`). `useListiniAdmin.ts` lee `window.__TMWE_OPERATIONS__.isTmwe` para el cliente.
- **Campos:**

| Campo | Control | Obligatorio | Reglas |
|---|---|---|---|
| nome | text | Sí (botón deshabilitado si vacío; `!form.nome`, no hace trim) | servidor sin validación de nombre en el alta |
| tipo | select C/F/R | Sí (def. C) | `tipo`, `id_servizi`, `id_fornitore` son readonly en edición |
| id_servizi | autocomplete servicios de proveedor (`/api_supplier_services`) | No | - |
| id_fornitore | autocomplete anagrafica | No | - |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CLI-14-01 | Alta de lista de cliente | nombre="LP QA", tipo C | 201; toast; lista de aterrizaje recarga en página 1 | P0 | Auto |
| CLI-14-02 | Nombre solo con espacios | "   " | el botón se habilita (no hay trim) y se envía; comprobar respuesta | P1 | Auto |
| CLI-14-03 | Tipo F con proveedor y servicio | tipo F, id_fornitore, id_servizi | se guardan; no cambian después (readonly) | P0 | Manual |
| CLI-14-04 | Usuario sin permiso de administrador de listini | sesión partner no admin | 403 "Admin permission required" como toast; el botón sigue visible (no determinado) | P0 | Manual |
| CLI-14-05 | Servicio del proveedor incoherente con id_fornitore | elegir un servicio de otro proveedor | no hay validación cruzada en SPA (solo informa el id en el texto secundario); comprobar servidor | P1 | Manual |

- **Riesgos / dudas:** `id_anagr_titolare` se envía siempre como 0.

### CLI-15 · Clonar lista de precios
- **Componente:** `packages/platform/listini/feature/CloneListDialog.vue`  **Envía:** `POST /api_listini` (acción clone; `source_listino_nome_id`, `nome`)
- **Permisos:** un partner solo puede clonar listas globales para personalizarlas (comentario `router/index.ts`); servidor `Admin permission required`.
- **Campos:** nombre (trim; obligatorio; sugerencia "<nombre> (copia)"), sin límite de longitud.
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CLI-15-01 | Clonar global como partner | lista global, nombre por defecto | nueva lista propia del partner con packs y precios copiados | P0 | Manual |
| CLI-15-02 | Nombre vacío | borrar nombre | botón deshabilitado; servidor 422 `nome Required` si se salta | P1 | Auto |
| CLI-15-03 | Enter en el campo | Enter con nombre válido | dispara el clon una vez | P2 | Auto |

- **Riesgos / dudas:** no se pasó `id_anagr_titolare`; propiedad de la copia la decide el servidor (no revisado).

### CLI-16 · Pack de una lista de precios (alta / edición)
- **Ruta/pantalla:** `/price-lists` -> detalle de lista -> packs  **Componente:** `packages/platform/listini/feature/PackFormDialog.vue`  **Envía:** `POST|PATCH /api_listini_pack`; `DELETE`
- **Permisos:** servidor `Admin permission required` (Listini_Pack_Controller.php:92,131,176).
- **Campos:**

| Campo | Control | Obligatorio | Reglas |
|---|---|---|---|
| pack | select D/U/P/Ps/Pm | Sí; bloqueado en edición | - |
| cod_cliente_fornitore, cod_fornitore, cod_fornitore2, cod_dhl_xml | text | No | - |
| valuta_sigla | CmValutaSelect | No (def. EUR) | - |
| metric_imperial | select | No | - |
| paese_part / paese_dest | text maxlength 2 | No | se fuerzan a mayúsculas; sin validar que sean ISO válidos |
| peso_bancale | select P/M/B | No | `B` hace la matriz de solo lectura (`bancale_readonly`) |
| moltipl_step (S/N) + moltipl_ogni_x_kg | switch + number min 0 | No | el number solo se habilita con `moltipl_step=S`; en edición `||1` convierte 0 en 1 |
| usa_num_coll_bank, collo_sing_peso, costo_a_collo2, usa_costo_base, usa_costo_min | switches | No | determinan qué columnas de precio existen en la matriz |
| maggiorazione + id_listino_nome_magg | number + autocomplete | No | la lista base solo se habilita si maggiorazione > 0; con maggiorazione<=0 se envía 0 |
| note, attivo (solo edición) | text, switch | No | alta siempre `attivo=S` |

- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CLI-16-01 | Alta de pack U en EUR | defaults | 201 y el pack aparece; matriz vacía | P0 | Auto |
| CLI-16-02 | Países en minúscula | paese_part="it" | se guarda "IT"; "XX" se acepta sin validar | P1 | Auto |
| CLI-16-03 | Recargo con base | maggiorazione=10 y lista base elegida; luego maggiorazione=0 | la base se deshabilita y se envía `id_listino_nome_magg=0` | P0 | Auto |
| CLI-16-04 | moltipl_ogni_x_kg=0 en edición | pack con 0 | al abrir se muestra 1 (`Number(...)||1`) y al guardar se persiste 1: cambia el cálculo sin avisar | P0 | Auto |
| CLI-16-05 | Cambiar flags de columnas con precios ya cargados | desactivar `usa_costo_min` | `availableFields` oculta la columna; los precios existentes no se borran (no determinado) | P0 | Manual |
| CLI-16-06 | Desactivar pack (`attivo=N`) | edición | deja de usarse en cotización; verificar cotización (sin llamar a transportistas) | P0 | Manual |
| CLI-16-07 | Eliminar pack en uso | borrar | confirmación; si está en uso el servidor devuelve `DELETE_BLOCKED` 400 con mensaje | P0 | Manual |
| CLI-16-08 | Tipo de pack en edición | intentar cambiar | el select está deshabilitado | P2 | Auto |

- **Riesgos / dudas:** `moltipl_ogni_x_kg` y `maggiorazione` sin min/max; maggiorazione negativa (descuento) se envía como `id_listino_nome_magg=0` ignorando la base.

### CLI-17 · Matriz de precios: edición y publicación de versión
- **Ruta/pantalla:** `/price-lists` -> pack -> pestaña Precios  **Componentes:** `packages/platform/listini/feature/PriceListsPage.vue` (`saveMatrix` l.534), `PriceMatrixTable.vue`, `ExtPricesTable.vue`  **Envía:** `POST /api_listini_prices_web` con `op=new_version`; borrado de versión futura `DELETE`; zona KO `POST`
- **Permisos:** `Admin permission required` en Server `Listini_Prices_Controller.php:143,309,349,365`; máx. 5000 filas por petición.
- **Campos:** celdas de precio por zona y escalón (`prezzo`, y `prezzo2`/`prezzo_base`/`prezzo_min` según flags del pack), peso extra (zona, peso_max, prezzo), selector de campo, fecha de entrada en vigor (date, `min` = mañana, clearable), botón Guardar / Publicar versión.
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CLI-17-01 | Guardar sin fecha (actualiza vigente) | editar 1 precio, sin fecha | cierra la versión vigente y crea la nueva con las mismas fechas; mensaje "operazione · N filas" | P0 | Manual |
| CLI-17-02 | Publicar con fecha futura | fecha = mañana | crea versión `futuro`; la vigente queda intacta; visible en chips de versiones | P0 | Manual |
| CLI-17-03 | Fecha de hoy o pasada | forzar valor vía teclado | el `min` solo avisa; servidor responde 409 `NO_VERSION_CASE` con motivo, mostrado en toast "matrix_save_failed: ..." | P0 | Manual |
| CLI-17-04 | Celdas vaciadas | borrar el precio de una zona y guardar | esa fila **se descarta en silencio** (`priceRowsToSend` filtra `prezzo` vacío): equivale a eliminar la zona de la nueva versión sin aviso | P0 | Manual |
| CLI-17-05 | Matriz completamente vacía | borrar todo | error `matrix_empty_error`; no se envía | P0 | Auto |
| CLI-17-06 | Precios negativos / texto | -5 / "abc" | sin validación cliente; servidor devuelve 422 con `errors` (validación en `Listini_Prices_Controller.php:239`); comprobar mensaje | P0 | Manual |
| CLI-17-07 | Pack de bancale (`peso_bancale=B`) | abrir matriz | solo lectura (`bancale_readonly`) | P1 | Auto |
| CLI-17-08 | Borrar versión futura | borrar | confirmación; la vigente no cambia; no se puede borrar la vigente desde la UI | P0 | Manual |

- **Riesgos / dudas:** si hay edición y se cambia de pack/versión con cambios sin guardar, no se pudo determinar si hay aviso (no se leyó `selectPack`/`selectVersion` en detalle). `new Date().toISOString()` usa UTC: cerca de medianoche "mañana" y la fecha de inicio por defecto pueden desfasarse un día respecto a la hora local (`PriceListsPage.vue`, `minEffectiveDate`).

### CLI-18 · Importar precios (CSV / Excel): asistente de 3 pasos
- **Componente:** `packages/platform/listini/feature/ImportWizardDialog.vue`  **Envía:** `POST /api_listini_import_web` (previsualizar con fichero; confirmar con `valid_rows_data`, `mode`, `format`, `suppl_mode`)
- **Permisos:** servidor `Listini_Import_Controller.php` (admin del listino; no verificado en detalle).
- **Campos:** formato (express / supplements), fichero (.csv, .xlsx, .xls, .tsv), modo merge/replace, modo suplementos NEW/ACT (solo formato supplements). Confirmar deshabilitado si `valid_rows===0`.
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CLI-18-01 | Previsualizar fichero válido | CSV express con 10 filas | chips de filas válidas/erróneas y zonas nuevas; nada se escribe aún | P0 | Auto |
| CLI-18-02 | Fichero con errores parciales | 8 válidas + 2 erróneas | se muestran hasta 50 errores como JSON; se pueden importar solo las válidas | P0 | Manual |
| CLI-18-03 | Fichero sin filas válidas | todo erróneo | alerta `import_no_valid`; "Confirmar" deshabilitado | P1 | Auto |
| CLI-18-04 | Modo replace | elegir replace y confirmar | **elimina** filas no presentes en el fichero (`result.deleted`); no hay confirmación adicional, solo una descripción; riesgo económico alto | P0 | Manual |
| CLI-18-05 | Formato distinto al contenido | formato supplements con un CSV de precios | el servidor devuelve errores o 0 válidas; no se escribe | P1 | Manual |
| CLI-18-06 | Cerrar durante la importación | cerrar con `busy` | bloqueado | P2 | Auto |

- **Riesgos / dudas:** el paso de confirmación reenvía `valid_rows_data` generados por la previsualización (datos del cliente reenviados); un cambio del pack entre pasos no se detecta. Existe nota `import_version_note` pero no se leyó su contenido.

### CLI-19 · Hoja de gestión de listino (pegar/validar/aplicar)
- **Componente:** `packages/platform/listini/feature/SheetImportDialog.vue`  **Envía:** `POST /api_listini_import_web` (`sheetValidate`, `sheetApply`)
- **Permisos:** `Admin permission required` (Server `Listini_Import_Controller.php:233`); hoja <= 2 000 000 caracteres.
- **Campos:** textarea de hoja (o fichero leído con FileReader UTF-8), destino de versión (vigente / futura existente / nueva con fecha `min` mañana). Paso 1 requiere hoja no vacía y, si destino "nuevo", fecha. Paso 2 solo permite aplicar si `result.ok`.
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CLI-19-01 | Validar hoja correcta | hoja exportada sin cambios | `ok`, sin celdas rojas | P0 | Manual |
| CLI-19-02 | Hoja con errores | celda con valor inválido (códigos CT/ZN/BN/DP) | celdas en rojo; "Aplicar" deshabilitado | P0 | Manual |
| CLI-19-03 | Destino "nueva versión" sin fecha | elegir y dejar vacío | "Validar" deshabilitado | P1 | Auto |
| CLI-19-04 | Hoja >2 MB | fichero grande | 422 `sheet Too large` | P2 | Auto |
| CLI-19-05 | Aplicar sobre versión futura | seleccionar `f:` | usa start/stop de esa versión; resultado `operazione` + filas | P0 | Manual |
| CLI-19-06 | Fichero no UTF-8 | CSV en Latin-1 | `readAsText('utf-8')` corrompe acentos; verificar que el servidor lo detecta | P1 | Manual |

- **Riesgos / dudas:** la validación se repite en servidor al aplicar (comentario del componente); no hay recordatorio al usuario de que la hoja puede haber cambiado entre validar y aplicar.

### CLI-20 · Modificación múltiple de listini en %
- **Componente:** `packages/platform/listini/feature/BulkUpdateDialog.vue` (+ `BulkHistoryDialog.vue`)  **Envía:** `GET/POST /api_listini_bulk_web` (`new_batch`, `apply` por tandas de 20, `undo`, `history`)
- **Permisos:** solo administrador (Server `Listini_Bulk_Controller.php:49,62`: "Admin permission required"); máx. 50 listini por llamada (cliente envía 20).
- **Campos:** % zona, % base, % mínimo (text, regex `^[0-9.-]{1,10}$`), modo de suplementos ALL/NEW, operación FIX/PRC por columna (fix,min,max,akg,bnc,agg,prc) y valores por suplemento (deshabilitados sin operación). Continuar requiere algún valor y todos válidos.
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CLI-20-01 | Subida del 5% | imp_zon=5 sobre 3 listini | paso confirmación con resumen -> ejecución con progreso -> estado por listino; mismo `batch` en todas las tandas | P0 | Manual |
| CLI-20-02 | Valor inválido | imp_zon="5%" o "1e3" | "Continuar" deshabilitado (regex) | P1 | Auto |
| CLI-20-03 | Valor sospechoso válido | "--5" o "1.2.3" | el regex lo admite (permite varios guiones/puntos); el servidor responde 422 "Invalid value" por campo | P0 | Auto |
| CLI-20-04 | Descuento del 100% o mayor | imp_zon=-100 / -150 | sin límite en SPA; comprobar servidor (precio cero/negativo) | P0 | Manual |
| CLI-20-05 | Deshacer lote | pulsar Deshacer tras aplicar | confirmación peligrosa; `bulkUndo(batch)`; toast con packs revertidos y omitidos (`skipped`) | P0 | Manual |
| CLI-20-06 | Fallo a mitad de lote | 45 listini, error en la tanda 2 | se detiene (catch único), se muestra el error y las filas ya procesadas se mantienen; sigue habiendo botón Deshacer | P0 | Manual |
| CLI-20-07 | Cerrar durante ejecución | cerrar con `running` | bloqueado | P2 | Auto |

- **Riesgos / dudas:** si falla `bulkNewBatch` o una tanda, el estado queda parcialmente aplicado y la responsabilidad del deshacer recae en el usuario. Sin límite superior al número de listini seleccionados en la SPA (el servidor admite 50 por llamada, el cliente fragmenta).

### CLI-21 · Asignaciones de listino a cliente/servicio
- **Componente:** `packages/platform/listini/feature/AssignmentsPanel.vue`  **Envía:** `POST|PATCH|DELETE` vía `/api_listini_assignments_web`
- **Permisos:** admin de listini (Server `Listini_Assignment_Controller.php:90,122,166,200`); además el cliente debe ser accesible ("Cannot create assignments for this client").
- **Campos:** cliente (autocomplete), servicio (solo alta), listino (autocomplete), tipo (select), coeficiente y fuel_surc (number sin min/max). `canSave`: alta requiere servicio y listino; edición solo listino.
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CLI-21-01 | Alta de asignación | cliente + servicio + listino | aparece en la tabla; recarga | P0 | Auto |
| CLI-21-02 | Servicio ya asignado | repetir cliente+servicio | no determinado: unicidad en servidor (`validate` en `Listini_Assignment_Controller.php:132`) | P0 | Manual |
| CLI-21-03 | Coeficiente/fuel negativos o enormes | -50 / 9999 | sin validación en SPA; comprobar servidor | P0 | Manual |
| CLI-21-04 | Editar solo coeficiente | cambiar coeficiente | PATCH con listino, tipo, coeficiente y fuel (siempre los 4) | P1 | Auto |
| CLI-21-05 | Borrar asignación | confirmar | la tabla se actualiza; confirmación peligrosa previa | P0 | Auto |
| CLI-21-06 | Cliente fuera de ámbito | partner no propietario | 403 "Cannot create assignments for this client" | P0 | Manual |

- **Riesgos / dudas:** no se leyó la lista de `tipoItems` ni su semántica (L/P u otras).

### CLI-22 · Listado de listas de precios: búsqueda y filtros
- **Componente:** `packages/platform/listini/feature/PriceListsPage.vue` (cabecera)  **Envía:** `GET /api_listini` con filtros (solo lectura)
- **Campos:** búsqueda, tipo, estado, base, panel avanzado (id, pack, países origen/destino maxlength 2, divisa maxlength 3, código proveedor, recargo S/N, perfil base, "con problemas").
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CLI-22-01 | Filtros combinados | tipo C + país origen "IT" + divisa "EUR" | resultados coherentes; paginación a página 1 | P2 | Auto |
| CLI-22-02 | País en minúscula | "it" | no determinado si se normaliza en SPA (en el pack sí, en el filtro no se vio) | P2 | Auto |
| CLI-22-03 | Aislamiento partner | partner no TMWE | solo sus listini más globales en lectura | P0 | Manual |

- **Riesgos / dudas:** "base" / "perfil base" implican un conmutador `toggleBase` que cambia el listino base de un perfil con confirmación (`baseCheck`/`setBase`): efecto económico no cubierto por estos filtros (mencionado en CLI-17).

### CLI-23 · Mapeo de selectores de dirección Google Maps por país
- **Ruta/pantalla:** pantalla de administración `googlemaps_address_fields` (ruta no localizada en `apps/operations`; revisar donde se monte)  **Componente:** `packages/platform/googlemaps_address_fields/feature/GooglemapsAddressFieldsPage.vue`  **Envía:** `PUT /api_admin_googlemaps_address_fields` por fila
- **Permisos:** endpoint `api_admin_*` (administración); la SPA no gatea.
- **Campos:** búsqueda por país/ISO; por país, dos select `province_selector` y `city_selector` con la lista `validSelectors` del servidor; botón guardar por fila habilitado solo si hay cambios.
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CLI-23-01 | Cambiar selector de provincia | país IT: otro selector, guardar | PUT con `id_country`; botón vuelve a deshabilitado | P1 | Auto |
| CLI-23-02 | Dejar sin configurar | borrar selector (null) | se guarda null; efecto en formularios de dirección no determinado | P1 | Manual |
| CLI-23-03 | Búsqueda por ISO | "ES" | solo filas coincidentes; contador total | P2 | Auto |
| CLI-23-04 | Usuario no administrador | sesión partner | 403 en la carga y mensaje de error | P1 | Manual |

- **Riesgos / dudas:** no se localizó la ruta de esta pantalla en el router de operations.

### CLI-24 · Nueva entidad desde la plataforma (EntityNewPage) y caja de ficheros (FilesBox)
- **Componentes:** `packages/platform/detail/EntityNewPage.vue` (selector de cliente + `createFn`/`extraPayload` inyectados por la app), `packages/platform/detail/FilesBox.vue` (subida, arrastrar, borrar, visibilidad por destinatario cliente/partner/agdogan/vettore)  **Envía:** definido por la app anfitriona (`createFn`, callbacks de subida/borrado): no determinado aquí
- **Permisos:** los de la entidad anfitriona.
- **Campos:** cliente (autocomplete con búsqueda remota; el botón se bloquea sin cliente y mientras `extraValid` sea false), fichero(s) por selección o arrastre sin filtro de tipo/tamaño; borrado con `window.confirm`.
- **Casos:**

| ID | Escenario | Datos de entrada | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|
| CLI-24-01 | Crear entidad sin cliente | no elegir cliente | botón deshabilitado | P1 | Auto |
| CLI-24-02 | Subir varios ficheros por arrastre | 3 ficheros | `uploadList` envía todos; estado `uploading` | P1 | Auto |
| CLI-24-03 | Cambiar visibilidad por destinatario | alternar `cliente`/`vettore` | publica el fichero a terceros: comprobar que no hay aviso ni envío de email al transportista; **solo sandbox** | P0 | Manual |

- **Riesgos / dudas:** usa `confirm()` nativo (distinto de `useConfirm` del resto); sin validación de extensión/tamaño en cliente.

## Inventario

| Prefijo-nn | Formulario | Fichero | Nº casos |
|---|---|---|---|
| CLI-01 | Alta de anagrafica | `packages/platform/anagrafiche/feature/AnagraficaCreateSection.vue` | 12 |
| CLI-02 | Ficha: datos base y VIES | `packages/platform/anagrafiche/feature/AnagraficaDatiBaseSection.vue` | 9 |
| CLI-03 | Ficha: facturación y condiciones | `packages/platform/anagrafiche/feature/AnagraficaFatturazioneSection.vue` | 9 |
| CLI-04 | Sede | `packages/platform/anagrafiche/feature/SedeFormDialog.vue` | 9 |
| CLI-05 | Contacto | `packages/platform/anagrafiche/feature/ContattoFormDialog.vue` | 8 |
| CLI-06 | Permisos de contacto, rol API, Findair | `packages/platform/anagrafiche/feature/ContattoPermissionsDialog.vue` | 8 |
| CLI-07 | Banca | `packages/platform/anagrafiche/feature/BancaFormDialog.vue` | 5 |
| CLI-08 | Carta de intención | `packages/platform/anagrafiche/feature/LettIntFormDialog.vue` | 5 |
| CLI-09 | Clonar anagrafica | `packages/platform/anagrafiche/feature/AnagraficaCloneDialog.vue` | 8 |
| CLI-10 | Listado de clientes: filtros | `packages/platform/anagrafiche/feature/AnagraficaListPage.vue` | 4 |
| CLI-11 | Más datos y ficheros del partner | `packages/platform/anagrafiche/feature/AnagraficaMoreSection.vue` | 4 |
| CLI-12 | Márgenes por escalón y por transportista | `packages/platform/anagrafiche/feature/AnagraficaAssicurazioneSection.vue` | 7 |
| CLI-13 | Listini del cliente | `packages/platform/anagrafiche/feature/AnagraficaListiniSection.vue` | 7 |
| CLI-14 | Crear lista de precios | `packages/platform/listini/feature/CreateListDialog.vue` | 5 |
| CLI-15 | Clonar lista de precios | `packages/platform/listini/feature/CloneListDialog.vue` | 3 |
| CLI-16 | Pack de lista | `packages/platform/listini/feature/PackFormDialog.vue` | 8 |
| CLI-17 | Matriz de precios y versiones | `packages/platform/listini/feature/PriceListsPage.vue` | 8 |
| CLI-18 | Importar precios | `packages/platform/listini/feature/ImportWizardDialog.vue` | 6 |
| CLI-19 | Hoja de gestión | `packages/platform/listini/feature/SheetImportDialog.vue` | 6 |
| CLI-20 | Modificación múltiple en % | `packages/platform/listini/feature/BulkUpdateDialog.vue` | 7 |
| CLI-21 | Asignaciones de listino | `packages/platform/listini/feature/AssignmentsPanel.vue` | 6 |
| CLI-22 | Filtros de listas de precios | `packages/platform/listini/feature/PriceListsPage.vue` | 3 |
| CLI-23 | Selectores de dirección Google Maps | `packages/platform/googlemaps_address_fields/feature/GooglemapsAddressFieldsPage.vue` | 4 |
| CLI-24 | Nueva entidad y caja de ficheros | `packages/platform/detail/EntityNewPage.vue`, `FilesBox.vue` | 3 |

Total: 24 formularios, 154 casos.
