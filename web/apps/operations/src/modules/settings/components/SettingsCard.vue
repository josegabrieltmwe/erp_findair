<template>
  <!-- Sección embebida (ya movida a packages/platform): navega por el
       router de operations, sin recarga. -->
  <RouterLink
    v-if="routeName"
    :to="{ name: routeName, params: routeParams }"
    class="stc-card"
  >
    <v-icon :icon="icon" size="22" class="stc-icon" />
    <div class="stc-body">
      <div class="stc-title">{{ title }}</div>
      <div v-if="description" class="stc-desc">{{ description }}</div>
    </div>
  </RouterLink>

  <!-- Sección todavía solo en admin_config (u otra app fuera del router de
       operations): enlace externo, con recarga completa de página. El
       indicador es texto SIEMPRE visible, no un icono que solo aparece en
       :hover — un usuario de teclado o lector de pantalla nunca pasa por el
       estado hover, así que "solo en hover" equivale a "nunca". -->
  <a v-else :href="href" class="stc-card stc-card--external" :aria-label="externalAriaLabel">
    <v-icon :icon="icon" size="22" class="stc-icon" />
    <div class="stc-body">
      <div class="stc-title">{{ title }}</div>
      <div v-if="description" class="stc-desc">{{ description }}</div>
      <div class="stc-ext-label">
        <v-icon icon="mdi-open-in-new" size="12" />
        {{ t('settings.settings.opens_admin_classic') }}
      </div>
    </div>
  </a>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps<{
  href?: string;
  routeName?: string;
  routeParams?: Record<string, string>;
  title: string;
  description?: string;
  icon: string;
}>();

const externalAriaLabel = computed(
  () => `${props.title} — ${t('settings.settings.opens_admin_classic')}`,
);
</script>

<style scoped>
.stc-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  border-radius: 10px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgb(var(--v-theme-surface));
  text-decoration: none;
  color: rgb(var(--v-theme-on-surface));
  transition: background-color 0.14s ease, border-color 0.14s ease;
  position: relative;
}
.stc-card:hover {
  background: rgba(var(--v-theme-on-surface), 0.04);
  border-color: rgba(var(--v-theme-primary), 0.4);
}
.stc-card:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
  background: rgba(var(--v-theme-on-surface), 0.04);
}
.stc-icon {
  flex-shrink: 0;
  opacity: 0.75;
  margin-top: 2px;
}
.stc-body {
  flex: 1;
  min-width: 0;
}
.stc-title {
  font-size: 13.5px;
  font-weight: 600;
}
.stc-desc {
  font-size: 12px;
  color: rgb(var(--v-theme-on-surface-variant));
  margin-top: 2px;
}
.stc-ext-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.75;
  margin-top: 4px;
}
</style>
