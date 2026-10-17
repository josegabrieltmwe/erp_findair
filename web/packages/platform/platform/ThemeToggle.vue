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

const { t } = useI18n();
const theme = useTheme();
const isDark = computed(() => Boolean(theme.global.current.value.dark));

function toggle(): void {
  const current = theme.global.name.value;
  const candidates = isDark.value
    ? [current.replace(/Dark$/, 'Light'), current.replace(/Dark$/, '')]
    : [current.replace(/Light$/, '') + 'Dark', current + 'Dark'];
  const next = candidates.find((name) => Boolean(theme.themes.value[name]));

  if (next) {
    theme.global.name.value = next;
  }
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
