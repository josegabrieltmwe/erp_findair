<template>
  <!--
    Platform topbar — shared chrome across all SPAs (home, cargo,
    shipment, admin). Each SPA mounts its DashboardShell/DetailShell
    which embed THIS bar as the topbar content, so the layout stays
    identical everywhere.

    Slots:
      #extras    — caller-specific actions placed BEFORE the platform
                   actions (chat, prints, refresh, etc.). The platform
                   itself owns the right edge (search, theme, user menu).

    Props:
      title      — the page title that appears next to the logo.
      subtitle   — small meta line under the title.
      module     — explicit module override; when omitted it's detected
                   from the URL via usePlatformContext.
      showSidebarToggle — shows a menu button before the logo and emits
                   `toggle-sidebar` on click. Opt-in: only DashboardShell
                   sets it, since DetailShell already owns its own
                   sidebar toggle (three-state rail/expanded/hidden) in
                   its page-topbar row — a second, disconnected button
                   here would confuse that flow.

    Events:
      toggle-sidebar — emitted when the sidebar toggle button is
                   clicked (only rendered when showSidebarToggle is true).
  -->
  <header class="ptb">
    <button
      v-if="showSidebarToggle"
      type="button"
      class="ptb-iconbtn ptb-sidebar-toggle"
      :title="t('platform.sidebar.toggle')"
      @click="emit('toggle-sidebar')"
    >
      <v-icon icon="mdi-menu" size="20" />
    </button>

    <!-- Logo + breadcrumb -->
    <RouterLink class="ptb-logo" :to="{ name: 'home' }" :title="t('platform.topbar.home_title')">
      <!-- Partner branding: show the logged-in partner's logo when the
           backend resolved one; otherwise fall back to the TMWE mark. -->
      <img
        v-if="partnerLogoUrl"
        :src="partnerLogoUrl"
        class="ptb-logo-img"
        alt="Logo"
        @error="partnerLogoUrl = ''"
      />
      <template v-else>
        <v-icon icon="mdi-cube-outline" size="22" color="primary" />
        <span class="ptb-logo-text">TMWE</span>
      </template>
    </RouterLink>

    <nav class="ptb-breadcrumb" :aria-label="t('platform.topbar.breadcrumb')">
      <template v-for="(c, idx) in breadcrumb" :key="c.href">
        <span v-if="idx > 0" class="ptb-breadcrumb-sep">
          <v-icon icon="mdi-chevron-right" size="14" />
        </span>
        <RouterLink
          v-if="idx < breadcrumb.length - 1 && crumbRouteName(c)"
          class="ptb-breadcrumb-item"
          :to="{ name: crumbRouteName(c)! }"
        >
          {{ crumbLabel(c) }}
        </RouterLink>
        <a
          v-else-if="idx < breadcrumb.length - 1"
          class="ptb-breadcrumb-item"
          :href="c.href"
        >
          {{ crumbLabel(c) }}
        </a>
        <span v-else class="ptb-breadcrumb-item ptb-breadcrumb-item--current">
          {{ crumbLabel(c) }}
        </span>
      </template>
    </nav>

    <!-- Page title block (optional) -->
    <div v-if="title || subtitle || $slots.title" class="ptb-title">
      <slot name="title">
        <div v-if="title" class="ptb-title-main">{{ title }}</div>
        <div v-if="subtitle" class="ptb-title-sub">{{ subtitle }}</div>
      </slot>
    </div>

    <!-- Per-SPA extras (chat, refresh, prints, …) -->
    <div v-if="$slots.extras" class="ptb-extras">
      <slot name="extras" />
    </div>

    <!-- Platform-owned actions -->
    <PlatformNewShipment />
    <PlatformPartnerSwitch />
    <PlatformSearch v-if="showSearch" />
    <PlatformChatBadge />
    <PlatformNotificationBell />
    <ThemeToggle class="ptb-iconbtn" />

    <!-- Only account preferences stay anchored to the right edge. -->
    <div class="ptb-spacer" />
    <LanguageSwitcher />
    <UserMenu />
  </header>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePlatformContext, type BreadcrumbCrumb } from './usePlatformContext';
import { useProfile } from '../composables/useProfile';
import PlatformSearch from './PlatformSearch.vue';
import PlatformNewShipment from './PlatformNewShipment.vue';
import PlatformPartnerSwitch from './PlatformPartnerSwitch.vue';
import PlatformChatBadge from './PlatformChatBadge.vue';
import PlatformNotificationBell from './PlatformNotificationBell.vue';
import LanguageSwitcher from './LanguageSwitcher.vue';
import UserMenu from './UserMenu.vue';
import ThemeToggle from './ThemeToggle.vue';

withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string;
    showSearch?: boolean;
    showSidebarToggle?: boolean;
  }>(),
  { showSearch: true, showSidebarToggle: false },
);

const emit = defineEmits<{ 'toggle-sidebar': [] }>();

const { t } = useI18n();
const { breadcrumb } = usePlatformContext();

/** Resolve a breadcrumb crumb: translate its i18n key, or show the raw
 *  label verbatim (non-translatable crumbs like `#123`). */
function crumbLabel(c: BreadcrumbCrumb): string {
  return c.labelKey ? (t(c.labelKey) as string) : (c.label ?? '');
}

/**
 * ME3: PlatformTopBar solo se monta dentro de la SPA `operations` (vía
 * DashboardShell/DetailShell), que siempre tiene su propio router — a
 * diferencia de `usePlatformContext` (shared/, deliberadamente sin asumir
 * router, ver su comentario de cabecera), aquí sí podemos resolver a un
 * nombre de ruta interno. Antes el logo y el breadcrumb eran `<a href>`
 * planos: SIEMPRE recargaban la página completa al volver a Home/Cargo/
 * Shipment/Clientes, anulando el KeepAlive de listados (ME1) y el store de
 * Home (ME2) cada vez que el usuario usaba ese atajo habitual de
 * navegación. Mapea solo los módulos que YA viven en el router de
 * operations; `admin` (admin_config) no está migrado todavía y sigue
 * cayendo al `<a href>` legacy (recarga, como antes).
 */
const HREF_TO_ROUTE_NAME: Record<string, string> = {
  '/home': 'home',
  '/cargo/list': 'cargo-list',
  '/shipment/list': 'shipment-list',
  '/clients': 'anagrafiche',
  '/settings': 'settings',
};

function crumbRouteName(c: BreadcrumbCrumb): string | null {
  return HREF_TO_ROUTE_NAME[c.href] ?? null;
}

// Partner branding logo for the top-left mark. Resolved by the backend
// (`Partner_Logo_Service`); empty for TMWE/admin or a partner with no
// uploaded logo, in which case the template shows the TMWE fallback.
const partnerLogoUrl = ref('');
const { profile, ensureProfile } = useProfile();
onMounted(async () => {
  // QW5: compartir el único fetch de `get_my_profile` con UserMenu/OperationsNav
  // en vez de repetirlo — las 3 llamadas competían por conexión HTTP/1.1 justo
  // en el boot, junto con los KPIs críticos de Home.
  await ensureProfile();
  const url = profile.value?.partner_logo_url ?? profile.value?.data?.partner_logo_url;
  if (typeof url === 'string' && url !== '') partnerLogoUrl.value = url;
  // Cualquier error queda cubierto por `profile` en null → se conserva el
  // fallback TMWE, igual que el catch original.
});

</script>

<style scoped lang="scss">
.ptb {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 10px;
  padding: 0 12px;
  height: 100%;
  width: 100%;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  font-family: inherit;
}

.ptb-sidebar-toggle {
  margin-right: 2px;
}

.ptb-logo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  font-weight: 700;
  letter-spacing: 0.04em;
  flex-shrink: 0;
  transition: background .12s;
}
.ptb-logo:hover {
  background: rgb(var(--v-theme-surface-variant));
}
.ptb-logo-text {
  font-size: 13px;
}
.ptb-logo-img {
  display: block;
  height: 30px;
  max-width: 160px;
  width: auto;
  object-fit: contain;
}

.ptb-breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
}
.ptb-breadcrumb-sep {
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.55;
  display: inline-flex;
  align-items: center;
}
.ptb-breadcrumb-item {
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface-variant));
  text-decoration: none;
  padding: 4px 6px;
  border-radius: 6px;
  transition: background .12s, color .12s;
  white-space: nowrap;
}
.ptb-breadcrumb-item:not(.ptb-breadcrumb-item--current):hover {
  background: rgb(var(--v-theme-surface-variant));
  color: rgb(var(--v-theme-on-surface));
}
.ptb-breadcrumb-item--current {
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
  cursor: default;
}

.ptb-title {
  display: flex;
  flex-direction: column;
  margin-left: 12px;
  padding-left: 12px;
  border-left: 1px solid rgba(var(--v-border-color, 0, 0, 0), 0.08);
  min-width: 0;
}
.ptb-title-main {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ptb-title-sub {
  font-size: 11.5px;
  color: rgb(var(--v-theme-on-surface-variant));
  font-weight: 500;
  line-height: 1.2;
}

.ptb-spacer {
  flex: 1 1 auto;
  min-width: 8px;
}

.ptb-extras {
  display: flex;
  gap: 4px;
  align-items: center;
}

.ptb-iconbtn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: transparent;
  border: 0;
  cursor: pointer;
  color: rgb(var(--v-theme-on-surface-variant));
  transition: background .12s, color .12s;
}
.ptb-iconbtn:hover {
  background: rgb(var(--v-theme-surface-variant));
  color: rgb(var(--v-theme-on-surface));
}

@media (max-width: 720px) {
  .ptb-breadcrumb { display: none; }
  .ptb-title { display: none; }
}
</style>
