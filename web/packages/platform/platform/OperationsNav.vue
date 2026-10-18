<template>
  <!--
    Navegación ÚNICA y UNIVERSAL de la SPA `operations`: es el MISMO menú en
    home, listados y detalle (cargo/shipment/invoicing). Sustituye por completo
    a PlatformSidebar dentro de operations — los shells lo suprimen vía
    `hide-platform-nav` (DashboardShell y DetailShell) y montan esta nav en el
    slot `#nav`, de modo que nunca se apilan dos menús.

    Vive en `packages/platform` (no en la app) porque lo consumen tanto el shell
    de operations como los layouts de detalle de los módulos cargo/shipment: si
    viviera en `apps/operations/src/shell` esos módulos importarían del shell de
    la app, invirtiendo la dependencia.

    Agrupa TODOS los dominios migrados en secciones + las herramientas legacy no
    migradas (enlaces externos) + Admin. Roles: adminOnly/partnerOnly se
    resuelven contra get_my_profile. Incluye los atajos `g h/c/s/l/a`.

    NOTA: usa `useRoute`/`useRouter`, así que todos sus consumidores deben vivir
    bajo el router de `operations` (hoy es el caso de todos).

    - Dominios migrados → <RouterLink> (SPA, sin recarga).
    - Herramientas/Admin no migrados → <a href> (recarga a la página legacy).
    Estilos propios y auto-contenidos (NO depende del CSS scoped de otro
    componente — por eso antes se veía "apilonado": las clases ps-nav-* de
    PlatformSidebar son scoped y no aplicaban aquí).
  -->
  <nav class="ops-nav" :class="{ 'ops-nav--rail': collapsed }" aria-label="Navegación principal">
    <div
      v-for="(section, si) in visibleSections"
      :key="section.label"
      class="ops-nav__section"
      :class="{
        'ops-nav__section--first': si === 0,
      }"
    >
      <!-- El grupo informa, no es un control: todos los destinos autorizados
           permanecen visibles y en un orden estable. -->
      <div
        v-if="!collapsed"
        class="ops-nav__header"
      >
        <span class="ops-nav__label">{{ section.label }}</span>
      </div>
      <div v-else class="ops-nav__rail-divider" role="separator" />

      <div class="ops-nav__body">
        <template v-for="it in section.items" :key="it.key">
          <!-- Dominio migrado: navegación interna por router. -->
          <RouterLink
            v-if="it.routeName"
            :to="{ name: it.routeName }"
            class="ops-nav__item"
            :class="{ 'ops-nav__item--active': isActive(it.routeName) }"
            :title="collapsed ? it.title : undefined"
          >
            <v-icon :icon="it.icon" size="20" class="ops-nav__icon" />
            <span v-if="!collapsed" class="ops-nav__text">{{ it.title }}</span>
          </RouterLink>

          <!-- Herramienta/Admin legacy: enlace externo (recarga). -->
          <a
            v-else
            :href="it.href"
            class="ops-nav__item ops-nav__item--external"
            :title="collapsed ? it.title : undefined"
          >
            <v-icon :icon="it.icon" size="20" class="ops-nav__icon" />
            <span v-if="!collapsed" class="ops-nav__text">{{ it.title }}</span>
            <v-icon
              v-if="!collapsed"
              icon="mdi-open-in-new"
              size="13"
              class="ops-nav__ext-hint"
            />
          </a>
        </template>
      </div>
    </div>

    <!-- Solo en la vista de partner: el menú diario por defecto y «Ver más» para el resto. -->
    <button
      v-if="canToggleAll"
      type="button"
      class="ops-nav__more"
      :aria-expanded="showAll"
      :title="collapsed ? moreLabel : undefined"
      data-testid="nav-toggle-all"
      @click="toggleAll"
    >
      <v-icon :icon="showAll ? 'mdi-chevron-up' : 'mdi-dots-horizontal'" size="20" class="ops-nav__icon" />
      <span v-if="!collapsed" class="ops-nav__text">{{ moreLabel }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { NAV_SECTION_DEFS, hasHiddenNavEntries, isNavEntryVisible, reduceNavSections } from "./navCatalog";
import { useNavRole } from "./useNavRole";

const props = withDefaults(
  defineProps<{
    collapsed?: boolean;
    /**
     * Registra los atajos `g h/c/s/l/a`. Default true. Ponlo a false si se
     * montan dos navs simultáneas para que solo una escuche el teclado.
     */
    enableShortcuts?: boolean;
  }>(),
  { collapsed: false, enableShortcuts: true },
);

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

interface NavEntry {
  key: string;
  title: string; // resuelto vía i18n (platform.opsnav.<key>)
  icon: string;
  /** Ruta interna del router (dominio migrado) — mutuamente excluyente con href. */
  routeName?: string;
  /** URL externa (herramienta/admin legacy) — mutuamente excluyente con routeName. */
  href?: string;
  adminOnly?: boolean;
  partnerOnly?: boolean;
}

interface NavSection {
  label: string; // resuelto vía i18n (platform.opsnav.sections.<key>)
  items: NavEntry[];
}


// Secciones con labels/titles TRADUCIDOS (reactivo al idioma activo).
const sections = computed<NavSection[]>(() =>
  NAV_SECTION_DEFS.map((s) => ({
    label: t(`platform.opsnav.sections.${s.sectionKey}`),
    items: s.items.map((it) => ({
      ...it,
      title: t(`platform.opsnav.${it.key}`),
    })),
  })),
);

// Rol compartido con la home (una sola petición a get_my_profile).
const { isAdmin, load: loadProfile } = useNavRole();

function roleVisible(it: { adminOnly?: boolean; partnerOnly?: boolean }): boolean {
  return isNavEntryVisible(it, isAdmin.value);
}

// Secciones con sus items filtrados por rol; se ocultan las secciones vacías.
const roleSections = computed<NavSection[]>(() =>
  sections.value
    .map((s) => ({ label: s.label, items: s.items.filter(roleVisible) }))
    .filter((s) => s.items.length > 0),
);

// Vista de partner: solo el trabajo diario (más la pantalla actual) hasta pulsar «Ver más».
// El personal TMWE ve siempre el menú completo. La preferencia se recuerda en el navegador.
const SHOW_ALL_KEY = "tmwe:nav-show-all";
function readShowAll(): boolean {
  try {
    return window.localStorage.getItem(SHOW_ALL_KEY) === "1";
  } catch {
    return false;
  }
}
const showAll = ref<boolean>(readShowAll());

function toggleAll(): void {
  showAll.value = !showAll.value;
  try {
    window.localStorage.setItem(SHOW_ALL_KEY, showAll.value ? "1" : "0");
  } catch {
    // Sin almacenamiento (ventana privada): el cambio vale solo para esta carga.
  }
}

/** Claves de los accesos que corresponden a la pantalla actual. */
const activeKeys = computed<Set<string>>(
  () =>
    new Set(
      roleSections.value.flatMap((s) => s.items).filter((it) => it.routeName && isActive(it.routeName)).map((it) => it.key),
    ),
);

const reducedView = computed<boolean>(() => !isAdmin.value);

const visibleSections = computed<NavSection[]>(() =>
  reducedView.value ? reduceNavSections(roleSections.value, showAll.value, activeKeys.value) : roleSections.value,
);

const canToggleAll = computed<boolean>(
  () => reducedView.value && (showAll.value || hasHiddenNavEntries(roleSections.value, activeKeys.value)),
);

const moreLabel = computed<string>(() => t(showAll.value ? "platform.opsnav.show_less" : "platform.opsnav.show_more"));

function isActive(name: string): boolean {
  // Los accesos principales de cargo/shipment apuntan directamente al
  // listado para evitar el redirect de la ruta padre, pero deben permanecer
  // resaltados en todas las subrutas del mismo dominio (detalle, alta, etc.).
  if (name === "cargo-list") {
    return route.name === "cargo" || String(route.name ?? "").startsWith("cargo-");
  }
  if (name === "shipment-list") {
    return route.name === "shipment" || String(route.name ?? "").startsWith("shipment-");
  }
  return route.name === name || String(route.name ?? "").startsWith(name + "-");
}

// ── Atajos de teclado (estilo vim: "g <letra>") ──────────────────────────
// PORTADOS desde PlatformSidebar, que ya no se monta dentro de la SPA
// `operations` (esta nav lo sustituye). Diferencia clave: allí saltaban con
// `window.location.href` (recarga completa); aquí navegan por el ROUTER, así
// que son SPA puros — sin recarga y preservando el estado de la app.
//
// `enableShortcuts` existe para que solo UNA instancia registre el listener
// global: si en el futuro se montaran dos navs a la vez, la segunda debe
// pasar `:enable-shortcuts="false"` y así evitar dobles saltos.
const CHORD_TARGETS: Record<string, string> = {
  h: "home",
  c: "cargo",
  s: "shipment",
  l: "clients",
  a: "admin",
};

let chord: "idle" | "g" = "idle";
let chordTimer: number | null = null;

function clearChord(): void {
  chord = "idle";
  if (chordTimer !== null) window.clearTimeout(chordTimer);
  chordTimer = null;
}

/** Localiza la entrada por key en todas las secciones (respetando el rol). */
function findEntry(key: string): NavEntry | null {
  for (const s of visibleSections.value) {
    const hit = s.items.find((it) => it.key === key);
    if (hit) return hit;
  }
  return null;
}

function onKeydown(ev: KeyboardEvent): void {
  // Ignorar pulsaciones dentro de campos de texto / contenteditable.
  const el = ev.target as HTMLElement | null;
  if (el) {
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (el.isContentEditable) return;
  }
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return;

  if (chord === "idle" && ev.key === "g") {
    chord = "g";
    if (chordTimer !== null) window.clearTimeout(chordTimer);
    chordTimer = window.setTimeout(clearChord, 800);
    return;
  }
  if (chord === "g") {
    const entryKey = CHORD_TARGETS[ev.key];
    const entry = entryKey ? findEntry(entryKey) : null;
    if (entry) {
      // Dominio migrado → router (SPA). Herramienta legacy (admin) → recarga.
      if (entry.routeName) void router.push({ name: entry.routeName });
      else if (entry.href) window.location.href = entry.href;
    }
    clearChord();
  }
}

onMounted(() => {
  void loadProfile();
  if (props.enableShortcuts && typeof window !== "undefined") {
    window.addEventListener("keydown", onKeydown);
  }
});

onBeforeUnmount(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("keydown", onKeydown);
  }
  clearChord();
});
</script>

<style scoped>
/* ─────────────────────────────────────────────────────────────────────
   Navegación operativa — estilos propios y auto-contenidos. No reutiliza
   el CSS scoped de PlatformSidebar (que no se filtra a este componente).
   ───────────────────────────────────────────────────────────────────── */
.ops-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  /* Sin padding horizontal: el contenedor .dsh-sidebar ya aporta 10px.
     Solo un pequeño respiro superior/inferior. */
  padding: 2px 0 8px;
  min-height: 0;
}

/* ── Secciones siempre visibles ─────────────────────────────────────── */
.ops-nav__section {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.ops-nav__section:not(.ops-nav__section--first) {
  margin-top: 4px;
}

/* Rótulo de grupo no interactivo. */
.ops-nav__header {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 6px 12px 4px;
  color: rgb(var(--v-theme-on-surface-variant));
  user-select: none;
}

.ops-nav__label {
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.68;
}

.ops-nav__body {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-top: 1px;
}

/* ── Ítems ──────────────────────────────────────────────────────────── */
.ops-nav__item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 7px 12px;
  border-radius: 10px;
  text-decoration: none;
  color: rgb(var(--v-theme-on-surface));
  font-size: 13.5px;
  font-weight: 500;
  line-height: 1.2;
  transition: background-color 0.14s ease, color 0.14s ease;
}
.ops-nav__icon {
  flex-shrink: 0;
  opacity: 0.72;
  transition: opacity 0.14s ease, color 0.14s ease;
}
.ops-nav__text {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ops-nav__item:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.ops-nav__item:hover .ops-nav__icon {
  opacity: 1;
}
.ops-nav__item:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

/* Estado activo: fondo teñido + barra izquierda de acento. */
.ops-nav__item--active {
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
}
.ops-nav__item--active .ops-nav__icon {
  opacity: 1;
  color: rgb(var(--v-theme-primary));
}
.ops-nav__item--active::before {
  content: "";
  position: absolute;
  left: 3px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 18px;
  border-radius: 3px;
  background: rgb(var(--v-theme-primary));
}

/* Enlaces externos (herramientas legacy): pista discreta de "abre fuera". */
.ops-nav__item--external .ops-nav__ext-hint {
  opacity: 0;
  color: rgb(var(--v-theme-on-surface-variant));
  transition: opacity 0.14s ease;
}
.ops-nav__item--external:hover .ops-nav__ext-hint {
  opacity: 0.55;
}

/* «Ver más / Ver menos» del menú de partner. */
.ops-nav__more {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
  padding: 7px 12px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  text-align: start;
}
.ops-nav__more:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.ops-nav__more:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}
.ops-nav--rail .ops-nav__more {
  justify-content: center;
  gap: 0;
  padding: 8px 0;
}

/* ── Modo rail (colapsado) ──────────────────────────────────────────── */
.ops-nav--rail {
  align-items: stretch;
  padding-inline: 0;
}
.ops-nav--rail .ops-nav__item {
  justify-content: center;
  gap: 0;
  padding: 8px 0;
}
.ops-nav--rail .ops-nav__item--active::before {
  left: 2px;
  height: 20px;
}
.ops-nav--rail .ops-nav__section:not(.ops-nav__section--first) {
  margin-top: 8px;
  padding-top: 8px;
  border-top: none;
}
/* Divisor fino centrado entre grupos en modo rail (sustituye al label). */
.ops-nav__rail-divider {
  height: 1px;
  margin: 2px 8px 4px;
  background: rgba(var(--v-border-color), calc(var(--v-border-opacity) * 0.7));
}
.ops-nav__section--first .ops-nav__rail-divider {
  display: none;
}
</style>
