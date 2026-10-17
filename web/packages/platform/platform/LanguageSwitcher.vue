<template>
  <!--
    Standalone language switcher for the platform top bar — sits to the
    LEFT of the user menu. Shows the active language's flag + ISO label;
    clicking opens a small popover with all available languages, each with
    its flag. Persists the choice the same way the old UserMenu entry did
    (localStorage `tmwe.locale` shared across SPAs + best-effort PATCH +
    reload). Flags are Unicode regional-indicator emoji so the component
    needs no SVG asset dependency (works in home too).
  -->
  <div class="lsw" :class="{ 'lsw--open': open }">
    <button
      type="button"
      class="lsw-trigger ptb-iconbtn"
      :title="t('platform.lang.switch')"
      :aria-label="t('platform.lang.switch')"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="toggle"
      @blur="onBlur"
    >
      <span class="lsw-flag">{{ activeLang.flag }}</span>
      <span class="lsw-code">{{ activeLang.iso2.toUpperCase() }}</span>
      <v-icon icon="mdi-chevron-down" size="13" class="lsw-caret" />
    </button>

    <ul v-if="open" class="lsw-menu" role="listbox" @mousedown.prevent>
      <li
        v-for="l in languages"
        :key="l.iso3"
        role="option"
        :aria-selected="l.iso3 === currentIso3"
        class="lsw-item"
        :class="{ 'lsw-item--active': l.iso3 === currentIso3 }"
        @click="select(l.iso3)"
      >
        <span class="lsw-flag">{{ l.flag }}</span>
        <span class="lsw-name">{{ l.label }}</span>
        <v-icon
          v-if="l.iso3 === currentIso3"
          icon="mdi-check"
          size="15"
          class="lsw-check"
        />
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t, locale, availableLocales } = useI18n({ useScope: 'global' });

interface Lang {
  iso3: string; // backend Locale_Registry code (ITA/ENG/SPA/OLA)
  iso2: string; // vue-i18n locale (it/en/es/nl)
  /** ISO-3166 country whose flag represents the language. */
  country: string;
  label: string;
  flag: string;
}

/** Unicode regional-indicator flag for an ISO-3166 alpha-2 country code. */
function flagOf(cc: string): string {
  const base = 0x1f1e6;
  const A = 'A'.charCodeAt(0);
  const c = cc.toUpperCase();
  return String.fromCodePoint(base + (c.charCodeAt(0) - A), base + (c.charCodeAt(1) - A));
}

/**
 * Catálogo de idiomas que la plataforma sabe representar (etiqueta + bandera).
 * NO es la lista que se ofrece: es solo el diccionario de presentación. La
 * lista real sale de `availableLocales` del i18n de cada app — ver abajo.
 */
const CATALOG: Lang[] = [
  { iso3: 'ITA', iso2: 'it', country: 'IT', label: 'Italiano',   flag: flagOf('IT') },
  { iso3: 'ENG', iso2: 'en', country: 'GB', label: 'English',    flag: flagOf('GB') },
  { iso3: 'SPA', iso2: 'es', country: 'ES', label: 'Español',    flag: flagOf('ES') },
  { iso3: 'OLA', iso2: 'nl', country: 'NL', label: 'Nederlands', flag: flagOf('NL') },
  { iso3: 'TED', iso2: 'de', country: 'DE', label: 'Deutsch',    flag: flagOf('DE') },
];

const ISO2_TO_ISO3: Record<string, string> = {
  it: 'ITA', en: 'ENG', es: 'SPA', nl: 'OLA', de: 'TED',
};

/**
 * Idiomas realmente ofrecidos = intersección del catálogo con los locales que
 * la app cargó en `createI18n`.
 *
 * Este componente vive en `packages/platform` y lo monta PlatformTopBar en
 * todas las SPAs, pero cada app decide por su cuenta qué bundles importa. Con
 * la lista hardcodeada, las apps que solo cargan en/it/es (operations,
 * giacenze, crm_pratica, copilot) ofrecían igualmente 🇳🇱 y 🇩🇪: al elegirlos,
 * `resolveInitialLocale()` no reconocía el valor guardado, caía al idioma de
 * la sesión PHP (normalmente ITA) y la UI se pintaba ENTERA en italiano, sin
 * error en consola y con la bandera equivocada en el botón. Derivarlo de
 * `availableLocales` hace imposible ofrecer un idioma que la app no sabe
 * cargar: añadir el bundle es ahora lo único que publica el idioma.
 */
const languages = computed<Lang[]>(() => {
  const loaded = new Set(availableLocales.map((l) => String(l).toLowerCase()));
  const offered = CATALOG.filter((l) => loaded.has(l.iso2));
  // Si la app no declara locales reconocibles, no dejamos el menú vacío:
  // mostrar solo el idioma activo es preferible a un desplegable muerto.
  return offered.length > 0 ? offered : [activeLang.value];
});

/** Current language resolved from the live i18n locale. */
const currentIso3 = computed<string>(() => ISO2_TO_ISO3[String(locale.value)] ?? 'ENG');
const activeLang = computed<Lang>(
  () => CATALOG.find((l) => l.iso3 === currentIso3.value) ?? CATALOG[1],
);

const open = ref(false);
function toggle(): void {
  open.value = !open.value;
}
function onBlur(): void {
  // Delay so a click inside the menu still registers before it closes.
  window.setTimeout(() => { open.value = false; }, 140);
}

async function select(iso3: string): Promise<void> {
  open.value = false;
  if (iso3 === currentIso3.value) return;
  const iso2 = languages.value.find((l) => l.iso3 === iso3)?.iso2;
  if (!iso2) return; // idioma no cargado por esta app: no persistimos basura
  // Persist to the shared key every SPA's i18n.ts reads on boot (wins over
  // the PHP session language, which the PATCH below does not refresh).
  if (iso2 && typeof localStorage !== 'undefined') {
    localStorage.setItem('tmwe.locale', iso2);
  }
  // Best-effort backend sync so server-rendered pages agree on next load.
  try {
    await fetch('/bff/v1/api_i18n_me', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: iso3 }),
    });
  } catch {
    /* swallow — localStorage already holds the choice */
  }
  window.location.reload();
}

function onKey(ev: KeyboardEvent): void {
  if (ev.key === 'Escape' && open.value) open.value = false;
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<style scoped lang="scss">
.lsw {
  position: relative;
}
.lsw-trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  /* `ptb-iconbtn` (global) gives the base button look; we widen it for the
     flag + code so it reads as a pill rather than a square icon button. */
  width: auto;
  padding: 0 8px;
}
.lsw-flag {
  font-size: 15px;
  line-height: 1;
}
.lsw-code {
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.03em;
}
.lsw-caret {
  opacity: 0.6;
}

.lsw-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  margin: 0;
  padding: 4px;
  list-style: none;
  min-width: 168px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color, 0, 0, 0), 0.1);
  border-radius: 10px;
  box-shadow: 0 10px 28px -6px rgba(0, 0, 0, 0.18);
  z-index: 220;
}
.lsw-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
  border-radius: 7px;
  cursor: pointer;
  font-size: 13px;
  color: rgb(var(--v-theme-on-surface));
  transition: background 0.12s;
}
.lsw-item:hover {
  background: rgb(var(--v-theme-surface-variant));
}
.lsw-item--active {
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
}
.lsw-item .lsw-flag {
  font-size: 17px;
}
.lsw-name {
  flex: 1;
}
.lsw-check {
  color: rgb(var(--v-theme-primary));
}
</style>
