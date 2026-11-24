# Plan: traducción a demanda de mensajes del chat de expedición

> **Estado:** borrador · **Última modificación:** 2026-11-24

Es la petición **P146** de [contrato-con-api.md](contrato-con-api.md) (sección X). Decisión con el usuario (2026-11-24):
la traducción **no es automática** — la pide el propio usuario mensaje a mensaje — y el **idioma de destino es variable**,
elegido por el usuario, no fijado al idioma de interfaz de la sesión. Afecta a `ChatDrawer.vue` (shipment) y
`CargoChatDrawer.vue` (cargo), que comparten store/servicio (`packages/platform/stores/chat.store.ts`,
`packages/platform/services/chat.service.ts`).

## 0. Por qué no es automática (y qué se descartó)

La primera versión de este plan asumía traducción automática al idioma de interfaz, en línea con `translated_body` viajando
ya en `web_chat_messages`. Se descartó porque:

- **Coste**: con poll de 15 s (`useChatRealtime`) + poll de delta del drawer abierto, traducir todo lo que entra en cada
  lectura multiplica las llamadas al LLM sin que el usuario lo haya pedido.
- **Idioma fijo**: el idioma de interfaz de la sesión no es necesariamente el idioma en el que el usuario quiere leer
  *ese* chat — un operador de TMWE puede querer leer un mensaje de un courier alemán en inglés, no en el idioma de su
  propia UI.

El modelo a demanda resuelve ambos: solo se traduce lo que se pide, y el usuario decide el idioma cada vez.

## 1. Backend (`tmwe_api`) — fuera de este repo, va como petición

No se toca desde aquí. Detalle completo en `contrato-con-api.md` §X / P146. Resumen:

- Acción nueva `web_chat_translate_message` (POST), separada de `web_chat_messages`.
- Entrada: `{message_id, shipment_id, shipment_type, target_lang}`. `target_lang` es un código de idioma libre que
  manda el cliente — el backend no lo valida contra una lista cerrada, se lo pasa tal cual al LLM en el prompt.
- Camino síncrono directo (`Anthropic_Chat_Provider`/`Chat_Provider::chat()`), **no** `Rpc_Chat_Provider` (ese es el que
  usa `copilot_chat` por defecto, pensado para turnos de conversación, no para una acción de un clic).
- Credenciales con `AI_Credentials::get_credentials_for_customer()` (partner → default global, ya existente).
- Cachea el resultado por `message_id`+`target_lang` (no vuelve a llamar al LLM si se repite la misma combinación).
- Si falla (sin credenciales, timeout, error del proveedor): error tipado (`TRANSLATION_UNAVAILABLE` o similar), no un
  200 silencioso — aquí el usuario sí espera ver el resultado de la acción que pidió.

**Bloqueante:** la SPA no puede implementarse de verdad hasta que esto exista. Las secciones 2 y 3 son el plan para
cuando esté disponible; mientras tanto se puede maquetar la UI con un mock.

## 2. BFF (`erp_findair/bff`)

- Nueva ruta en `config/routes.bff.yaml`, mismo bloque que las de `web_chat_*` (tier `web`, `throttle: web_chat`):

  ```yaml
  - id: post.web_chat_translate_message
    method: POST
    path: /web_chat_translate_message
    upstream:
      action: web_chat_translate_message
    limits: { body: 8k, timeout: 30 } # llamada síncrona al LLM; mismo orden de magnitud que el POST de web_chat_messages
    throttle: web_chat
  ```

- Regenerar `config/routes.spa.yaml` con `bin/regen-spa-manifest.sh` (nunca a mano).
- Sin lógica de negocio nueva en el proxy — la traducción es responsabilidad del backend, el BFF solo la deja pasar.
- Probar con `bff/bin/probe-routes.php` (solo lectura) antes de dar la ruta por buena.

## 3. SPA (`web/`)

### 3.1 Servicio

En `packages/platform/services/chat.service.ts`, nuevo método junto a `send`/`typing`:

```ts
translate(
  message_id: number,
  shipment_id: number,
  shipment_type: ShipmentType,
  target_lang: string,
): Promise<ChatTranslateResponse> {
  return http('/web_chat_translate_message', {
    method: 'POST',
    headers: { 'X-Busy': 'off' }, // acción de un mensaje — spinner local, no el modal global (mismo criterio que send())
    body: { message_id, shipment_id, shipment_type, target_lang },
  });
},
```

`ChatMessage` no cambia (no lleva `translated_body` precalculado): la traducción vive en estado local del componente,
no en el modelo que devuelve `list()`.

### 3.2 UI — selector de idioma

Un control de idioma en la cabecera del drawer (junto al título, antes del botón de cerrar), independiente del idioma
de interfaz de la sesión. Arranca con una lista corta y editable más adelante — los 5 locales que ya tiene la SPA
(`en/it/es/de/nl`, `src/locales/`) como punto de partida práctico, **no como límite técnico**: el backend acepta
cualquier código, así que ampliar la lista es un cambio de UI, no de contrato.

- Se guarda en el store del chat (`useChatStore`/`chat.store.ts`) para que el drawer lo recuerde mientras está abierto;
  no hace falta persistirlo entre sesiones salvo que se pida.
- Cambiar el idioma no retraduce automáticamente lo ya traducido (ver 3.3): cada traducción queda fijada al idioma con
  el que se pidió, hasta que el usuario la vuelva a pedir.

### 3.3 UI — acción por mensaje

Cada burbuja de mensaje (`.cmsg`) gana una acción pequeña "Traducir" (icono `mdi-translate`, discreto, no un botón
prominente — es una acción secundaria por mensaje, igual de tono que la hora `.ctime`).

Estado local por mensaje (no en `ChatMessage`, que es el tipo que devuelve el servicio):

```ts
const translations = ref<Record<number, { lang: string; text: string; loading: boolean } | undefined>>({});
```

- Clic en "Traducir" → `translations[m.id] = { lang: selectedLang.value, loading: true, text: '' }`, llama a
  `chatService.translate(...)`, rellena `text` y `loading = false`. Si fallá, toast de error (`toasts.push('error', ...)`),
  igual que ya hace `onSubmit` para el envío — y se borra la entrada de `translations` para poder reintentar.
- Mientras `loading`, el icono de traducir se sustituye por un `v-progress-circular` pequeño (mismo patrón ya aplicado
  al botón de enviar en el fix anterior) — nunca el modal global.
- Resultado: el texto traducido aparece bajo el original, con un "ver original" para plegarlo; no se reemplaza el
  original (el usuario puede querer comparar, y el original es la fuente legal del mensaje).
- Si el usuario cambia el idioma del selector (3.2) y vuelve a pedir traducción de un mensaje ya traducido, se
  sobrescribe esa entrada con el nuevo idioma — no se acumulan varias traducciones por mensaje a la vez.

### 3.4 i18n

Claves nuevas en los 5 locales (`src/locales/*.json`), sección `shipment.chat`: `translate` ("Traducir"),
`translate_loading` (opcional, si se quiere texto además del spinner), `translate_failed`, `show_original` /
`show_translation`. Revisar con `pnpm check:i18n` / `check:raw-text` antes de cerrar, como en cualquier otro cambio
de UI de este proyecto.

## 4. Orden de trabajo

1. Validar P146 con quien mantiene `tmwe_api` (no se puede avanzar 3 sin esto; 2 tampoco tiene sentido sin la acción real).
2. BFF: ruta + regenerar manifiesto + `probe-routes.php` contra el backend ya disponible (sandbox).
3. SPA: servicio → selector de idioma → acción por mensaje → i18n, en ese orden (cada paso es verificable con
   `pnpm typecheck` / `pnpm test` antes de pasar al siguiente).
4. Probar en los dos drawers (shipment y cargo) — comparten servicio y store, pero la plantilla está duplicada
   (`ChatDrawer.vue` / `CargoChatDrawer.vue`): el cambio de UI hay que aplicarlo dos veces, igual que el spinner de
   envío de la sesión anterior.

## 5. Lo que NO entra en este plan

- No se toca `web_chat_messages` ni `useChatRealtime` (poll de 15 s) — la traducción no afecta al flujo de lectura
  normal del chat.
- No hay traducción automática de mensajes salientes (el emisor sigue escribiendo y enviando en su idioma; la
  traducción es solo de lectura, a demanda, para quien recibe).
- No se decide aquí si el idioma elegido se persiste entre sesiones o aperturas del drawer — asumido "no" (vuelve al
  valor por defecto) salvo que se diga lo contrario.
