<template>
  <button
    type="button"
    class="platform-theme-toggle"
    :title="isDark ? t('platform.topbar.light_theme') : t('platform.topbar.dark_theme')"
    @click="toggle"
  >
    <v-icon :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'" size="18" />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTheme } from 'vuetify';
import { applyThemeMode, themeMode, toggleThemeMode } from './themeMode';

const { t } = useI18n();
const theme = useTheme();
const isDark = computed(() => themeMode.value === 'dark');

// Única vía para cambiar el tema: guarda la preferencia (themeMode.ts) y la aplica a la paleta de la pantalla
// actual. Las demás pantallas la leen al montarse, así que cambiar de página no cambia el tema.
function toggle(): void {
  toggleThemeMode();
  applyThemeMode(theme);
}
</script>

<style scoped>
.platform-theme-toggle {
  display: inline-grid;
  width: 34px;
  height: 34px;
  padding: 0;
  place-items: center;
  color: rgb(var(--v-theme-on-surface));
  background: transparent;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  opacity: var(--v-medium-emphasis-opacity);
}

.platform-theme-toggle:hover,
.platform-theme-toggle:focus-visible {
  background: rgba(var(--v-theme-on-surface), 0.08);
  opacity: 1;
}
</style>
