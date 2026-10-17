<template>
  <!--
    Mirrors `.stat-tile` (shared/styles/mockup2.scss:296+) so the listing
    KPI strip reuses the same visual rhythm as the detail-page stat tiles
    (CargoCostiCard, CargoMisureCard). The `is-active` modifier paints the
    tile with a primary-tint when the corresponding filter is applied.
  -->
  <button
    type="button"
    class="stat-tile listing-kpi"
    :class="{ 'is-active': active, 'listing-kpi--rail': rail }"
    :title="rail ? `${caption}${typeof value === 'number' ? ` — ${formattedValue}` : ''}` : undefined"
    @click="$emit('click')"
  >
    <div class="stat-row">
      <v-icon v-if="icon" :icon="icon" size="16" />
      <span v-if="!rail" class="stat-cap">{{ caption }}</span>
    </div>
    <div v-if="!rail" class="stat-val" :class="variant">
      {{ formattedValue }}<small v-if="unit"> {{ unit }}</small>
    </div>
    <div v-if="sub && !rail" class="stat-sub">{{ sub }}</div>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  icon?: string;
  caption: string;
  /** Number renders with locale grouping; string renders verbatim. */
  value: number | string;
  unit?: string;
  sub?: string;
  /** Semantic tint of the main value. */
  variant?: 'default' | 'success' | 'warning' | 'error';
  /** Highlight the tile (e.g. when its filter is currently applied). */
  active?: boolean;
  /** Rail mode — icon-only, captions/value hidden. Used in collapsed sidebar. */
  rail?: boolean;
}>();
defineEmits<{ (e: 'click'): void }>();

const formattedValue = computed<string>(() => {
  if (typeof props.value === 'number') return props.value.toLocaleString('en-US');
  return props.value;
});
</script>

<style scoped lang="scss">
/* The base `.stat-tile` rules live in mockup2.scss; here we only add
   the `is-active` highlight (subtle primary border + tinted bg) which
   is specific to clickable filter tiles in a listing context. */
.listing-kpi {
  position: relative;
  outline: 1px solid transparent;
  outline-offset: -1px;
  transition: background .12s, outline-color .12s;
}

.listing-kpi.is-active {
  background: rgba(var(--v-theme-primary), .12);
  outline-color: rgb(var(--v-theme-primary));
}

.listing-kpi.is-active :deep(.stat-cap) {
  color: rgb(var(--v-theme-primary));
  opacity: 1;
}

.listing-kpi.is-active :deep(.stat-row .v-icon) {
  color: rgb(var(--v-theme-primary));
}
</style>
