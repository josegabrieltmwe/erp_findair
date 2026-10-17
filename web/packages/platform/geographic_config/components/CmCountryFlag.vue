<template>
  <span class="cm-flag" :title="code || undefined">
    <span v-if="emoji" class="cm-flag-emoji" :style="{ fontSize: size + 'px' }">{{ emoji }}</span>
    <span v-else class="cm-flag-fallback">{{ code || '—' }}</span>
  </span>
</template>

<script setup lang="ts">
/**
 * CmCountryFlag — bandera de país a partir del código ISO-3166-1 alpha-2
 * (IT, US, FR…), sin dependencias: convierte el código a emoji usando los
 * símbolos indicadores regionales Unicode. Cae al código en texto si la
 * entrada no es un alpha-2 válido.
 *
 * No reutiliza `@shared/listing/CountryFlag.vue` porque ese componente carga
 * SVGs vía `country-flag-icons`, que no es dependencia ni de admin_config ni
 * de operations.
 */
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    iso?: string | null;
    size?: number;
  }>(),
  { size: 16 },
);

const code = computed(() => (props.iso ?? '').toUpperCase().trim());

const emoji = computed(() => {
  const c = code.value;
  if (c.length !== 2 || !/^[A-Z]{2}$/.test(c)) return '';
  // 0x1F1E6 = regional indicator 'A'; 'A'.charCodeAt(0) = 65.
  const base = 0x1f1e6 - 65;
  return String.fromCodePoint(base + c.charCodeAt(0), base + c.charCodeAt(1));
});
</script>

<style scoped>
.cm-flag {
  display: inline-flex;
  align-items: center;
  line-height: 1;
}
.cm-flag-emoji {
  line-height: 1;
}
.cm-flag-fallback {
  display: inline-block;
  padding: 1px 5px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 3px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
