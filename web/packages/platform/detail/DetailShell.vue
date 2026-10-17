<template>
  <!--
    Detail shell — fixed top bar + collapsible left sidebar (records
    navigator) + main content area with optional tabs band. Designed as
    the convergence layout for cargo-detail and shipment-detail; mirrors
    DashboardShell's three-state sidebar (rail/expanded/hidden) so the
    operator's experience is consistent between listing and detail.

    Off-canvas drawers (Documents, Chat, modals) live OUTSIDE this shell:
    they remain `Teleport to="body"` `temporary` overlays in the page
    component, because the detail intentionally lets those panels float
    over the main content rather than steal width from the 2-col overview.

    Slots:
      #topbar-title    Brand area: id + dates + client chip + status badge.
      #topbar-actions  Right-side action buttons (chat, docs, theme, prints).
      #tabs            Optional sub-header row (CargoTabsV2 / ShipmentTabsV2).
      #nav             Navegación de módulos (OperationsNav) — se renderiza
                       ARRIBA del #sidebar y sustituye a PlatformSidebar
                       cuando se pasa `hidePlatformNav`.
      #sidebar         Sidebar content — receives `:collapsed` so KPIs/lists
                       can collapse to icons-only in rail mode.
      default          Main content area (Overview, Flights, etc.).
  -->
  <div
    class="dsh"
    :class="{ 'dsh--sidebar-collapsed': collapsed, 'dsh--sidebar-hidden': hidden }"
  >
    <header class="dsh-topbar">
      <div class="dsh-topbar-row dsh-topbar-row--platform">
        <PlatformTopBar>
          <template v-if="$slots['platform-extras']" #extras>
            <slot name="platform-extras" />
          </template>
        </PlatformTopBar>
      </div>

      <div class="dsh-topbar-row dsh-topbar-row--page">
        <button
          type="button"
          class="topbar-iconbtn dsh-burger"
          :title="hidden ? t('platform.shell.show_sidebar') : (collapsed ? t('platform.shell.expand_sidebar') : t('platform.shell.hide_sidebar'))"
          @click="toggleSidebar"
        >
          <v-icon :icon="hidden ? 'mdi-menu' : (collapsed ? 'mdi-menu-open' : 'mdi-menu')" size="18" />
        </button>

        <div class="dsh-topbar-title">
          <slot name="topbar-title" />
        </div>

        <div class="dsh-topbar-spacer" />

        <div class="dsh-topbar-actions">
          <slot name="topbar-actions" />
        </div>
      </div>
    </header>

    <!-- Optional tabs / status row — appears as a sub-header band under
         the topbar. Sticky so it stays visible when scrolling the body. -->
    <div v-if="$slots.tabs" class="dsh-subheader">
      <slot name="tabs" />
    </div>

    <!-- Velo del overlay mientras el rail está desplegado por hover. -->
    <div
      v-if="collapsed && !hidden"
      class="dsh-veil"
      :class="{ 'dsh-veil--on': peeking }"
      @click="peeking = false"
    />

    <aside
      v-show="!hidden"
      class="dsh-sidebar"
      :class="{ 'dsh-sidebar--rail': collapsed, 'dsh-sidebar--peek': collapsed && peeking }"
      @mouseenter="onRailEnter"
      @mouseleave="onRailLeave"
    >
      <!-- Navegación. `hidePlatformNav` suprime la nav de plataforma cuando el
           llamador aporta una navegación completa por el slot #nav (p.ej. la
           SPA `operations`, que monta OperationsNav) — evita apilar dos menús.
           Simétrico a DashboardShell.

           `railCollapsed` en #nav: durante el peek la navegación se ve
           expandida. El slot #sidebar sigue recibiendo `collapsed` a secas —
           trae contenido de la página (timeline, navegador de registros) que
           no debe desplegarse por un roce del ratón sobre el menú. -->
      <PlatformSidebar v-if="!hidePlatformNav" :collapsed="railCollapsed" />
      <slot name="nav" :collapsed="railCollapsed" />
      <slot name="sidebar" :collapsed="collapsed" />
    </aside>

    <main class="dsh-main dsh-main--detail">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import type { RemovableRef } from '@vueuse/core';
import { useI18n } from 'vue-i18n';
import PlatformTopBar from '../platform/PlatformTopBar.vue';
import PlatformSidebar from '../platform/PlatformSidebar.vue';

const { t } = useI18n();

const props = defineProps<{
  /**
   * Storage key for the collapsed/hidden state. Detail layouts share a
   * default key so navigating between cargo and shipment details keeps
   * the same sidebar preference. Callers can override per-context.
   */
  storageKey?: string;
  /**
   * Suprime el PlatformSidebar interno cuando el llamador ya provee una
   * navegación completa por el slot #nav. Default false (los consumidores
   * que usan DetailShell tal cual siguen viendo la nav de plataforma).
   * Simétrico a la prop homónima de DashboardShell.
   */
  hidePlatformNav?: boolean;
}>();

interface SidebarState {
  collapsed: boolean;
  hidden: boolean;
}

const key = props.storageKey ?? 'tmwe:detail-sidebar';

/**
 * Default: rail (collapsed=true). Mirrors DashboardShell so the user
 * has a consistent starting point across listing and detail.
 */
const state: RemovableRef<SidebarState> = useLocalStorage<SidebarState>(key, {
  collapsed: true,
  hidden: false,
});

const collapsed = computed<boolean>({
  get: () => state.value.collapsed,
  set: (v) => { state.value = { ...state.value, collapsed: v }; },
});
const hidden = computed<boolean>({
  get: () => state.value.hidden,
  set: (v) => { state.value = { ...state.value, hidden: v }; },
});

/**
 * Same three-state cycle as DashboardShell:
 *   rail → expanded → hidden → rail
 */
/**
 * PEEK — despliegue temporal del rail al pasar el ratón (idéntico a
 * DashboardShell: el menú debe comportarse igual en listado y detalle).
 *
 * El rail se expande EN OVERLAY sobre el contenido; la columna del grid
 * sigue midiendo 56px, así consultar el menú no recoloca el detalle. El peek
 * es efímero y NO se persiste: solo el clic en el botón fija el estado.
 */
const peeking = ref(false);

/** El rail se ve expandido si está fijado así, o mientras dura el peek. */
const railCollapsed = computed(() => collapsed.value && !peeking.value);

let peekTimer: ReturnType<typeof setTimeout> | null = null;

function clearPeekTimer(): void {
  if (peekTimer !== null) {
    clearTimeout(peekTimer);
    peekTimer = null;
  }
}

/** Retardo antes de abrir: evita que el rail se despliegue al cruzarlo. */
function onRailEnter(): void {
  if (!collapsed.value || hidden.value) return;
  clearPeekTimer();
  peekTimer = setTimeout(() => { peeking.value = true; }, 180);
}

function onRailLeave(): void {
  clearPeekTimer();
  peeking.value = false;
}

onBeforeUnmount(clearPeekTimer);

function toggleSidebar(): void {
  // Al fijar con el botón, el peek deja de tener sentido.
  onRailLeave();
  if (hidden.value) {
    hidden.value = false;
    collapsed.value = true;
    return;
  }
  if (collapsed.value) {
    collapsed.value = false;
    return;
  }
  hidden.value = true;
}
</script>

<style scoped lang="scss">
/* ============================================================
   Layout — CSS grid: topbar row (52px) + optional subheader row
   (auto height) + 2-column body. The subheader row collapses to
   0 when the slot is empty thanks to grid-template-rows auto.
============================================================ */
.dsh {
  display: grid;
  grid-template-columns: var(--dsh-sidebar-w, 220px) 1fr;
  grid-template-rows: var(--dsh-topbar-h, 96px) auto 1fr;
  /* El rail ocupa las TRES filas: banda vertical continua de borde a borde,
     como en el mockup de referencia. Simétrico a DashboardShell. */
  grid-template-areas:
    'sidebar topbar'
    'sidebar subheader'
    'sidebar main';
  min-height: 100vh;
  background: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-background));
}

.dsh--sidebar-collapsed {
  --dsh-sidebar-w: 56px;
}

.dsh--sidebar-hidden {
  grid-template-columns: 0 1fr;
}

/* Top bar — sticky, two-row layout shared with DashboardShell. */
.dsh-topbar {
  grid-area: topbar;
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  height: var(--dsh-topbar-h, 96px);
}
.dsh-topbar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  min-height: 48px;
}
.dsh-topbar-row--platform {
  border-bottom: 1px solid rgba(var(--v-border-color, 0, 0, 0), 0.06);
}
.dsh-topbar-row--page {
  flex: 1;
}

.dsh-burger { flex-shrink: 0; }

.dsh-topbar-title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  /* Detail topbar gets a flexible client-chip + status — needs flex to
     keep ellipses on long names. */
  flex: 1 1 auto;
}

.dsh-topbar-spacer { flex: 0 0 auto; }

.dsh-topbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* Sub-header — tabs row (CargoTabsV2 / ShipmentTabsV2). Sticky under
   the topbar so the tabs remain reachable while scrolling. */
.dsh-subheader {
  grid-area: subheader;
  position: sticky;
  top: var(--dsh-topbar-h, 96px);
  z-index: 25;
  background: rgb(var(--v-theme-background));
  border-bottom: 1px solid rgba(var(--v-border-color), calc(var(--v-border-opacity) * 0.6));
}

/* Sidebar */
.dsh-sidebar {
  grid-area: sidebar;
  position: sticky;
  /* Banda vertical completa: arranca en el borde superior (no bajo topbar +
     subheader) y ocupa todo el alto de la ventana. */
  top: 0;
  height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 10px;
  background: rgb(var(--v-theme-surface));
  border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  transition: width .2s ease;
}

/* ── Peek: el rail se despliega EN OVERLAY al pasar el ratón ──────────
 * `position: fixed` saca la nav del flujo del grid: la columna sigue
 * midiendo 56px y el detalle NO se recoloca. Idéntico a DashboardShell. */
.dsh-sidebar--peek {
  position: fixed;
  left: 0;
  top: 0;
  width: var(--cm-nav-open-w, 240px);
  height: 100vh;
  padding: 12px 10px;
  /* Por encima de topbar y subheader: al desplegarse el menú es la capa
     activa y tapa también las barras superiores. */
  z-index: 40;
  box-shadow: var(--cm-nav-shadow, 8px 0 44px rgba(8, 18, 35, 0.45));
  background: rgb(var(--v-theme-surface));
}

.dsh-veil {
  position: fixed;
  inset: 0;
  background: var(--cm-nav-veil, rgba(8, 18, 35, 0.42));
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
  z-index: 35;
}
.dsh-veil--on {
  opacity: 1;
  pointer-events: auto;
}

@media (prefers-reduced-motion: reduce) {
  .dsh-sidebar,
  .dsh-veil {
    transition: none;
  }
}

.dsh-sidebar--rail {
  padding: 12px 6px;
}

/* Main — detail content. Less aggressive padding than the listing
   variant because the detail has its own card grid that benefits from
   a small gutter (8-10px). */
.dsh-main--detail {
  grid-area: main;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  min-width: 0;
}

@media (max-width: 720px) {
  .dsh {
    grid-template-columns: 0 1fr;
  }
  .dsh-sidebar {
    position: fixed;
    top: var(--dsh-topbar-h, 96px);
    left: 0;
    width: 220px;
    z-index: 25;
    box-shadow: 0 8px 24px -8px rgba(0,0,0,.25);
    height: calc(100vh - var(--dsh-topbar-h, 96px));
  }
  .dsh--sidebar-hidden .dsh-sidebar {
    transform: translateX(-100%);
  }
}
</style>
