<template>
  <!--
    Platform sidebar nav — top section of every SPA sidebar shows the
    same module links so the operator can jump between Home / Cargo /
    Spedizioni / Clients from anywhere. Each SPA's own sidebar content
    (KPI rail, records navigator, advanced filters…) renders BELOW this
    section via the default slot.

    Rail mode (`collapsed=true`) collapses each link to an icon-only
    button; the active item still shows its highlight color.

    Keyboard shortcuts (bound on the platform when this component
    mounts, opt-in via `enableShortcuts`):
       g h  → Home
       g c  → Cargo list
       g s  → Spedizioni list
  -->
  <div class="ps-nav" :class="{ 'ps-nav--rail': collapsed }">
    <a
      v-for="item in visibleItems"
      :key="item.module"
      class="ps-nav-item"
      :class="{
        'ps-nav-item--active': active === item.module,
        'ps-nav-item--rail': collapsed,
      }"
      :href="item.href"
      :title="navTooltip(item)"
    >
      <v-icon :icon="item.icon" size="18" />
      <span v-if="!collapsed" class="ps-nav-label">{{ t(item.labelKey) }}</span>
      <!-- The shortcut pill used to live here. It now travels in the
           browser tooltip (see `navTooltip(item)`) so the sidebar stays
           visually quiet. The `g h / g c / g s / g a` chord handler
           below keeps working — the model still carries `shortcut`. -->
    </a>

    <!-- Herramientas — utilidades promovidas desde "More actions". -->
    <template v-if="visibleTools.length">
      <div v-if="!collapsed" class="ps-nav-section-label">{{ t('platform.tools.title') }}</div>
      <a
        v-for="tool in visibleTools"
        :key="tool.key"
        class="ps-nav-item"
        :class="{ 'ps-nav-item--rail': collapsed }"
        :href="tool.href"
        :title="t(tool.labelKey)"
      >
        <v-icon :icon="tool.icon" size="18" />
        <span v-if="!collapsed" class="ps-nav-label">{{ t(tool.labelKey) }}</span>
      </a>
    </template>

    <!-- Section anchors — only when we are on the home page. The home
         renders three large blocks (express in / express out / cargo);
         these jump-links let the operator skip straight to the block
         they care about without scrolling past ~30 KPI tiles. -->
    <template v-if="active === 'home' && !collapsed">
      <div class="ps-nav-section-label">{{ t('platform.nav.home_sections') }}</div>
      <a
        v-for="s in homeSectionAnchors"
        :key="s.id"
        class="ps-nav-item ps-nav-item--anchor"
        :href="`#home-section-${s.id}`"
        :title="s.title"
        @click="onAnchorClick(s.id, $event)"
      >
        <v-icon :icon="s.icon" size="16" />
        <span class="ps-nav-label">{{ s.label }}</span>
      </a>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePlatformContext, type PlatformModule } from './usePlatformContext';
import { moduleHref } from './navTargets';
import { useNavRole } from './useNavRole';

const { t } = useI18n();

const props = withDefaults(defineProps<{
  collapsed?: boolean;
  enableShortcuts?: boolean;
}>(), {
  collapsed: false,
  enableShortcuts: true,
});

const { module: active } = usePlatformContext();

interface NavItem {
  module: PlatformModule;
  /** i18n key for the label (resolved at render via t()). */
  labelKey: string;
  icon: string;
  href: string;
  shortcut?: string;
  adminOnly?: boolean;
  partnerOnly?: boolean;
}

// Los href de módulos MIGRADOS pasan por moduleHref(): bajo el cutover
// (isConsolidated) devuelven la ruta interna de la SPA `operations`
// (`/operations#/shipment/list`), de modo que el enlace ES la ruta SPA —
// el navegador cambia el hash y el router responde SIN recarga ni 302 del
// servidor. Sin cutover devuelven la URL de la app vieja (igual que antes).
const items = computed<NavItem[]>(() => [
  { module: 'home',     labelKey: 'platform.nav.home',     icon: 'mdi-home-outline',       href: moduleHref('home'),        shortcut: 'g h' },
  { module: 'cargo',    labelKey: 'platform.nav.cargo',    icon: 'mdi-airplane',           href: moduleHref('cargo'),       shortcut: 'g c' },
  { module: 'shipment', labelKey: 'platform.nav.shipment', icon: 'mdi-truck-fast-outline', href: moduleHref('shipment'),    shortcut: 'g s' },
  { module: 'clients',  labelKey: 'platform.nav.clients',  icon: 'mdi-account-multiple',   href: moduleHref('clients'),     shortcut: 'g l' },
]);

// Rol compartido con OperationsNav: falla CERRADO (false hasta resolver el perfil).
const { isAdmin, load: loadProfile } = useNavRole();

/**
 * "Herramientas" — utilidades secundarias que antes vivían en el menú
 * "More actions" de la home. Se promueven al sidebar (compartido por todas las
 * apps) para no esconderlas tras un dropdown y aprovechar el panel vertical.
 * Visibilidad por rol: adminOnly (solo TMWE), partnerOnly (solo partners).
 */
interface ToolItem {
  key: string;
  labelKey: string;
  icon: string;
  href: string;
  adminOnly?: boolean;
  partnerOnly?: boolean;
}
// invoicing / cod_assegni SÍ están migrados → moduleHref (SPA bajo cutover).
// Las herramientas winbody (import, price_lists, send_message) y api_doc NO
// están migradas → URL fija (recarga a la página legacy correspondiente).
const tools = computed<ToolItem[]>(() => [
  { key: 'invoicing',    labelKey: 'platform.tools.invoicing',    icon: 'mdi-receipt-text',      href: moduleHref('invoicing') },
  { key: 'cod_assegni',  labelKey: 'platform.tools.cod_assegni',  icon: 'mdi-cash-check',        href: moduleHref('cod_assegni') },
  { key: 'import',       labelKey: 'platform.tools.import',       icon: 'mdi-upload',            href: '/erp/winbody.php?pp=spedy_import&ti=new' },
  { key: 'import_v2',    labelKey: 'platform.tools.import_v2',    icon: 'mdi-upload-multiple',   href: '/erp/winbody.php?pp=spedy_import2&ti=new' },
  { key: 'price_lists',  labelKey: 'platform.tools.price_lists',  icon: 'mdi-cash-register',     href: '/erp/winbody.php?pp=listy&ti=cerca&tp=C', partnerOnly: true },
  { key: 'send_message', labelKey: 'platform.tools.send_message', icon: 'mdi-message-plus',      href: '/erp/winbody.php?pp=docsstory&ti=new' },
  { key: 'api_portal',   labelKey: 'platform.tools.api_portal',   icon: 'mdi-api',               href: '/erp/tmwe_json/api_doc', adminOnly: true },
]);

function roleVisible(it: { adminOnly?: boolean; partnerOnly?: boolean }): boolean {
  if (it.adminOnly && !isAdmin.value) return false;
  if (it.partnerOnly && isAdmin.value) return false;
  return true;
}
const visibleTools = computed(() => tools.value.filter(roleVisible));

/**
 * Tooltip shown by the browser when the operator hovers a nav item.
 * Composes the label with the keyboard shortcut (when present) so the
 * shortcut stays discoverable in both expanded mode (where it shows
 * inline as a pill on the right) AND collapsed/rail mode (where the
 * pill is hidden). Format: `Cargo — g c`.
 *
 * Using the native `title` attribute (not Vuetify `v-tooltip`) keeps
 * the hint instant, native-styled per OS, accessible to screen
 * readers, and free of extra DOM nodes.
 */
function navTooltip(item: NavItem): string {
  const label = t(item.labelKey);
  return item.shortcut ? `${label} — ${item.shortcut}` : label;
}

/**
 * Anchor jump-links for the three home sections. Mirrors the ids
 * `HomePage.vue` emits via `id="home-section-…"`. Kept hardcoded
 * (instead of importing HOME_SECTIONS from the dashboard package) to
 * avoid pulling the catalog into every SPA bundle that doesn't render
 * the home.
 */
interface HomeAnchor {
  id: 'courier_in' | 'courier_out' | 'cargo';
  label: string;
  title: string;
  icon: string;
}
const homeSectionAnchors = computed<HomeAnchor[]>(() => [
  { id: 'courier_in',  label: t('platform.nav.anchor.courier_in'),       title: t('platform.nav.anchor.courier_in_title'),  icon: 'mdi-truck-fast-outline' },
  { id: 'courier_out', label: t('platform.nav.anchor.courier_out'),      title: t('platform.nav.anchor.courier_out_title'), icon: 'mdi-radar' },
  { id: 'cargo',       label: t('platform.nav.anchor.cargo'),            title: t('platform.nav.anchor.cargo_title'),       icon: 'mdi-airplane' },
]);

/**
 * Click handler for the section anchors. Uses smooth scrolling when
 * the target exists (we are on the home page), falls through to the
 * default `<a href="#…">` behaviour otherwise.
 */
function onAnchorClick(id: HomeAnchor['id'], ev: MouseEvent): void {
  const el = typeof document !== 'undefined'
    ? document.getElementById(`home-section-${id}`)
    : null;
  if (!el) return; // not on the home — let the browser handle the hash.
  ev.preventDefault();
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
const visibleItems = computed(() => items.value.filter(roleVisible));

// ── keyboard shortcuts (vim-style "g <letter>") ──────────────────────
let chord: 'idle' | 'g' = 'idle';
let chordTimer: number | null = null;

function clearChord(): void {
  chord = 'idle';
  if (chordTimer !== null) window.clearTimeout(chordTimer);
  chordTimer = null;
}

function onKeydown(ev: KeyboardEvent): void {
  // Ignore keystrokes inside inputs/textareas/contenteditable.
  const t = ev.target as HTMLElement | null;
  if (t) {
    const tag = t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (t.isContentEditable) return;
  }
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return;

  if (chord === 'idle' && ev.key === 'g') {
    chord = 'g';
    if (chordTimer !== null) window.clearTimeout(chordTimer);
    chordTimer = window.setTimeout(clearChord, 800);
    return;
  }
  if (chord === 'g') {
    const m = ({ h: 'home', c: 'cargo', s: 'shipment', l: 'clients' } as const)[ev.key];
    if (m) {
      const item = items.value.find((it) => it.module === m);
      if (item && roleVisible(item)) {
        window.location.href = item.href;
      }
    }
    clearChord();
  }
}

onMounted(() => {
  void loadProfile();
  if (props.enableShortcuts && typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeydown);
  }
});

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onKeydown);
  }
  clearChord();
});
</script>

<style scoped lang="scss">
.ps-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-bottom: 8px;
  margin-bottom: 8px;
  border-bottom: 1px solid rgba(var(--v-border-color, 0, 0, 0), 0.06);
}
.ps-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  text-decoration: none;
  color: rgb(var(--v-theme-on-surface));
  font-size: 13px;
  font-weight: 500;
  transition: background .12s, color .12s;
}
.ps-nav-item:hover {
  background: rgb(var(--v-theme-surface-variant));
}
.ps-nav-item--active {
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
}
.ps-nav-item--rail {
  justify-content: center;
  padding: 8px;
}
.ps-nav-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* The `.ps-nav-shortcut` pill was removed: the keyboard chord
   (`g h / g c / g s`) is now communicated only through the
   browser tooltip composed by `navTooltip()`. The chord handler
   itself lives below and still reads `item.shortcut`. */

/* ── Home section anchors ──────────────────────────────────────── */
.ps-nav-section-label {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.7;
  padding: 8px 10px 4px;
  margin-top: 6px;
}
.ps-nav-item--anchor {
  padding: 6px 10px 6px 14px;
  font-size: 12.5px;
  font-weight: 500;
  opacity: 0.85;
  border-left: 2px solid transparent;
  border-radius: 0 8px 8px 0;
  margin-left: 4px;
}
.ps-nav-item--anchor:hover {
  border-left-color: rgb(var(--v-theme-primary));
  opacity: 1;
}
</style>
