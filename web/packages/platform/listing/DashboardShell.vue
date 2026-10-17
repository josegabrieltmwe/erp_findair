<template>
  <!--
    Dashboard shell — fixed top bar + collapsible left sidebar + main.
    Layout primitives live in the parent `.shipment-v2` namespace so this
    shell inherits Inter font, tokens, light/dark themes automatically.

    Slots:
      #platform-topbar Replaces the platform chrome row entirely (default:
                     `PlatformTopBar`). Use only when the caller needs a
                     trimmed topbar without operations-oriented widgets
                     (new shipment, partner switch, chat, notifications) —
                     e.g. admin_config's `AdminTopBar`. Most callers should
                     leave this slot untouched and use `#platform-extras`
                     instead to add per-SPA actions to the default bar.
      #platform-extras Caller-specific actions inside the DEFAULT
                     `PlatformTopBar` (chat, refresh, prints, …). Ignored
                     when `#platform-topbar` is overridden — the caller's
                     own topbar owns that row instead.
      #topbar-title  Brand title block (icon + name) — kept by caller so
                     each list can put its own icon + label.
      #topbar-meta   Small subtitle line under the title.
      #topbar-actions Right-side action buttons (refresh, export, etc).
      #sidebar       Sidebar content: KPI rail, saved views, navigation.
      default        Main content (filters strip + data table).
  -->
  <div
    class="dsh"
    :class="{
      'dsh--sidebar-collapsed': !isMobile,
      'dsh--single-topbar-row': !showPageTopbar,
    }"
  >
    <!-- ============ TOP BAR (fixed) =================== -->
    <!-- Two-row topbar: platform chrome above, page-specific controls below. -->
    <header class="dsh-topbar">
      <div class="dsh-topbar-row dsh-topbar-row--platform">
        <slot name="platform-topbar">
          <PlatformTopBar
            :show-search="showPlatformSearch"
            show-sidebar-toggle
            @toggle-sidebar="onToggleSidebar"
          >
            <template v-if="$slots['platform-extras']" #extras>
              <slot name="platform-extras" />
            </template>
          </PlatformTopBar>
        </slot>
      </div>
      <div v-if="showPageTopbar" class="dsh-topbar-row dsh-topbar-row--page">
        <div class="dsh-topbar-title">
          <slot name="topbar-title" />
        </div>

        <div v-if="$slots['topbar-actions']" class="dsh-topbar-actions">
          <slot name="topbar-actions" />
        </div>
      </div>
    </header>

    <!-- Velo del overlay: oscurece el contenido mientras el sidebar está
         desplegado sobre el contenido (abierto por click en el botón de
         menú), para que se lea como una capa temporal y no como un cambio
         de layout permanente. -->
    <div
      v-if="sidebarOpen"
      class="dsh-veil"
      :class="{ 'dsh-veil--on': sidebarOpen }"
      @click="closeSidebarOverlay"
    />

    <!-- ============ SIDEBAR (left) ==================== -->
    <!-- En reposo (desktop, sidebarOpen=false) el sidebar está COMPLETAMENTE
         oculto -- ni siquiera el rail de solo-iconos se muestra (ancho 0 vía
         `dsh--sidebar-collapsed`, ver estilos). Solo aparece, desplegado en
         overlay con iconos+texto, al pulsar el botón de menú de
         PlatformTopBar. `v-if` evita que la nav (y sus llamadas de datos,
         p.ej. KPIs) exista en el DOM mientras está cerrada. -->
    <aside
      v-if="sidebarOpen || isMobile"
      class="dsh-sidebar"
      :class="{
        'dsh-sidebar--peek': !isMobile && sidebarOpen,
        'dsh-sidebar--mobile-open': isMobile && sidebarOpen,
      }"
      @click="onSidebarClick"
    >
      <!-- Platform nav is normally first (so the operator can jump between
           modules from any list/detail/home). Caller's sidebar content
           renders below it. `hidePlatformNav` lo suprime cuando el llamador
           ya aporta una navegación completa por el slot #sidebar (p.ej. la SPA
           `operations`, que trae su propio menú unificado de todos los
           dominios) — así se evita apilar dos navegaciones duplicadas. -->
      <!-- Mientras el sidebar está montado siempre está desplegado (con
           etiquetas) -- ya no existe un estado "rail" de solo-iconos en
           reposo, así que `collapsed` es siempre false aquí. -->
      <PlatformSidebar v-if="!hidePlatformNav" :collapsed="false" />
      <slot name="sidebar" :collapsed="false" />
    </aside>

    <!-- ============ MAIN (right of sidebar) =========== -->
    <main class="dsh-main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import PlatformTopBar from '../platform/PlatformTopBar.vue';
import PlatformSidebar from '../platform/PlatformSidebar.vue';

const props = withDefaults(defineProps<{
  /** @deprecated Conservada para compatibilidad con los llamadores existentes. */
  storageKey?: string;
  /**
   * Suprime el PlatformSidebar interno cuando el llamador ya provee una
   * navegación completa por el slot #sidebar. Default false (las apps que usan
   * DashboardShell tal cual siguen viendo la nav de plataforma).
   */
  hidePlatformNav?: boolean;
  /** Oculta la búsqueda global cuando la página ofrece una búsqueda contextual. */
  showPlatformSearch?: boolean;
  /** Muestra la segunda fila con el título y las acciones de la página. */
  showPageTopbar?: boolean;
}>(), {
  showPlatformSearch: true,
  showPageTopbar: true,
});

const isMobile = useMediaQuery('(max-width: 720px)');

/**
 * SIDEBAR TOGGLE — el sidebar arranca COMPLETAMENTE OCULTO (ni rail de
 * iconos) y solo se abre al pulsar el botón de menú en PlatformTopBar
 * (antes del logo). Se queda abierto hasta que se vuelva a pulsar el botón
 * o se haga click fuera (velo) — ya no se abre/cierra por hover ni existe
 * un estado intermedio de rail-siempre-visible.
 */
const sidebarOpen = ref(false);

function onToggleSidebar(): void {
  sidebarOpen.value = !sidebarOpen.value;
}

function closeSidebarOverlay(): void {
  sidebarOpen.value = false;
}

/**
 * Cierra el sidebar al seleccionar un elemento de navegación. Se apoya en
 * delegación de eventos (un solo listener en el `<aside>`) en vez de
 * requerir que cada nav (PlatformSidebar, OperationsNav, o el slot
 * #sidebar del caller) emita un evento propio -- toda navegación real
 * termina siendo un `<a>` (RouterLink lo renderiza como tal), así que basta
 * con mirar si el click original vino de dentro de uno. Los `<a>` que abren
 * un submenú/acordeón sin navegar (si algún día los hay) deberían usar
 * `@click.prevent` para no disparar esto -- hoy ningún nav lo hace.
 */
function onSidebarClick(ev: MouseEvent): void {
  const target = ev.target as HTMLElement | null;
  if (target?.closest('a')) {
    sidebarOpen.value = false;
  }
}
</script>

<style scoped lang="scss">
/* ============================================================
   Layout — CSS grid: top row is the fixed topbar (52px), then
   a 2-column row with the sidebar on the left and the main on
   the right. Topbar uses position:sticky so the table can
   scroll under it.
============================================================ */
.dsh {
  display: grid;
  grid-template-columns: var(--dsh-sidebar-w, 220px) 1fr;
  grid-template-rows: var(--dsh-topbar-h, 96px) 1fr;
  /* El rail ocupa las DOS filas: llega hasta el borde superior en lugar de
     empezar bajo la topbar, como en el mockup de referencia (`.nav` con
     top:0;bottom:0). Así el menú es una banda vertical continua y la topbar
     pertenece visualmente al contenido, no al menú. */
  grid-template-areas:
    'sidebar topbar'
    'sidebar main';
  min-height: 100vh;
  background: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-background));
}

/* When the main column hosts a self-scrolling listing card (`.sdv-card`),
   pin the grid to exactly the viewport height so the `1fr` main row gets a
   bounded height. Without this the grid (min-height:100vh) grows with the
   table and the body never scrolls internally — the sticky <thead> then
   pins to the page viewport instead of the table. Scoped via :has() so the
   home (which shares .dsh-main and wants page scroll) is untouched. */
.dsh:has(.sdv-card) {
  height: 100vh;
  min-height: 0;
  overflow: hidden;
}

/* En reposo (desktop) el sidebar no reserva columna alguna: está
   completamente oculto hasta que se abre por click (overlay, ver
   .dsh-sidebar--peek), que no toca esta variable. */
.dsh--sidebar-collapsed {
  --dsh-sidebar-w: 0px;
}

.dsh--single-topbar-row {
  --dsh-topbar-h: 48px;
}

/* ============================================================
   Top bar — sticky, full width, mirrors `.topbar` palette but
   with its own grid column so it spans both sidebar and main.
============================================================ */
.dsh-topbar {
  grid-area: topbar;
  position: sticky;
  top: 0;
  /* Por encima de .dsh-sidebar--peek (z-index 40, ver más abajo): la topbar
     crea su PROPIO stacking context (position:sticky + z-index), así que un
     z-index alto dentro del botón de menú (.ptb-sidebar-toggle) no basta
     para ganarle al sidebar -- solo compite dentro de este contexto. Debe
     ganar la topbar entera, para que el botón que abre el sidebar siga
     siendo clickeable y pueda cerrarlo. */
  z-index: 41;
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

.dsh-topbar-title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.dsh-topbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  /* Se acerca al título en vez de empujarse al extremo derecho -- un
     spacer flex:1 aquí dejaba un vacío llamativo entre ambos bloques
     cuando el título es corto (p.ej. "Express shipments" + acciones,
     con la mitad de la fila en blanco en medio). Sin spacer, quedan
     juntos con el mismo gap que separa cualquier otro par de controles;
     el ancho sobrante de la fila es simplemente fondo, no un hueco
     "atrapado" entre dos anclas. */
}

/* ============================================================
   Sidebar — sticky just under the topbar; scrolls independently
   from the main column when content overflows.
============================================================ */
.dsh-sidebar {
  grid-area: sidebar;
  position: sticky;
  /* Banda vertical completa: arranca en el borde superior (no bajo la
     topbar) y ocupa todo el alto de la ventana. */
  top: 0;
  height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 10px;
  background: rgb(var(--v-theme-surface));
  border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  transition: width .2s ease;
}

/* ── Abierto por click: el rail se despliega EN OVERLAY ────────────────
 *
 * `position: fixed` saca la nav del flujo del grid: la columna sigue
 * midiendo 56px y el contenido NO se recoloca, así consultar el menú no
 * reflowea la tabla que se está mirando. Se cierra al pulsar de nuevo el
 * botón de menú, o con click en el velo.
 */
.dsh-sidebar--peek {
  position: fixed;
  left: 0;
  /* Empieza DEBAJO de la topbar (no en top:0): la topbar vive en un
     stacking context más alto (z-index 41, ver más abajo) para que su botón
     de menú siga siendo clickeable, así que un sidebar que arrancara en
     top:0 quedaría con su primera fila tapada por la topbar en vez de
     apilarse visualmente debajo de ella. */
  top: var(--dsh-topbar-h, 96px);
  width: var(--cm-nav-open-w, 240px);
  height: calc(100vh - var(--dsh-topbar-h, 96px));
  padding: 12px 10px;
  /* Por debajo de la topbar (41) para no volver a taparla; por encima del
     velo (35): al desplegarse, el menú es la capa activa sobre el contenido. */
  z-index: 40;
  box-shadow: var(--cm-nav-shadow, 8px 0 44px rgba(8, 18, 35, 0.45));
  /* Superficie propia: al flotar sobre el contenido necesita fondo opaco. */
  background: rgb(var(--v-theme-surface));
}

/* Velo sobre el contenido mientras el sidebar está abierto por click.
 * Siempre montado (para poder animar la opacidad) pero inerte hasta que se
 * abre. */
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

/* Respeta a quien pide menos movimiento: sin transición de ancho ni fundido. */
@media (prefers-reduced-motion: reduce) {
  .dsh-sidebar,
  .dsh-veil {
    transition: none;
  }
}

/* ============================================================
   Main — gets the lion's share of the viewport. Inner padding
   is kept minimal so the data table can claim every pixel of
   horizontal space.
============================================================ */
.dsh-main {
  grid-area: main;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 8px 24px;
  min-width: 0; /* allow children with overflow to shrink */
  /* La fila `main` del grid es `1fr` (alto = viewport − topbar). `min-height:0`
     permite que un hijo con `flex:1` (la `.sdv-card` del listado) ocupe TODO el
     alto restante y haga scroll interno. NO ponemos `overflow:hidden` por
     defecto: el home (que comparte .dsh-main) necesita poder hacer scroll de
     página con muchas tiles. Las vistas sin flex:1 fluyen de arriba abajo. */
  min-height: 0;
}

/* Listing views only: clip the main column so the `.sdv-card` inside is
   forced to bound its own height and scroll its <tbody> internally (sticky
   <thead> then pins to the table, not the page). Home is unaffected. */
.dsh-main:has(.sdv-card) {
  overflow: hidden;
}

@media (max-width: 720px) {
  .dsh {
    grid-template-columns: 0 1fr;
  }
  .dsh-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    width: 220px;
    height: 100vh;
    z-index: 40;
    box-shadow: 0 8px 24px -8px rgba(0,0,0,.25);
    transform: translateX(-100%);
    transition: transform .2s ease;
  }
  .dsh-sidebar--mobile-open {
    transform: translateX(0);
  }
}
</style>
