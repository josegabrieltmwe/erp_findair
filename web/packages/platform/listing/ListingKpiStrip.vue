<template>
  <!--
    KPI strip — `direction='row'` (default) renders tiles horizontally
    using the `.stats` flex container from mockup2.scss; `direction='column'`
    stacks them vertically for sidebar/rail usage. In `rail` mode (used
    when the sidebar is collapsed) the captions and sub-text are hidden
    and only the icon + value remain.
  -->
  <div
    class="stats listing-kpi-strip"
    :class="{
      'listing-kpi-strip--col': direction === 'column',
      'listing-kpi-strip--rail': rail,
    }"
  >
    <ListingKpiTile
      v-for="tile in tiles"
      :key="tile.key"
      :icon="tile.icon"
      :caption="tile.caption"
      :value="tile.value"
      :unit="tile.unit"
      :sub="tile.sub"
      :variant="tile.variant"
      :active="tile.key === active"
      :rail="rail"
      @click="$emit('select', tile.key)"
    />
    <slot />
  </div>
</template>

<script setup lang="ts">
import ListingKpiTile from './ListingKpiTile.vue';

/**
 * KPI tile description. `key` is a stable id used to identify the active
 * tile and emit on select; typically a backend `type` filter value
 * (`all`, `in_transit`, `cod_pending`, etc.).
 */
export interface KpiTileDescriptor {
  key: string;
  icon?: string;
  caption: string;
  value: number | string;
  unit?: string;
  sub?: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

defineProps<{
  tiles: KpiTileDescriptor[];
  /** Currently-active tile key (matches the value passed to @select). */
  active?: string;
  /** Visual orientation; `row` = horizontal strip, `column` = vertical (sidebar). */
  direction?: 'row' | 'column';
  /** Compact rail mode — hide captions/sub, show icon + value only. */
  rail?: boolean;
}>();

defineEmits<{
  (e: 'select', key: string): void;
}>();
</script>

<style scoped lang="scss">
.listing-kpi-strip {
  flex-wrap: wrap;
}

.listing-kpi-strip > :deep(.stat-tile) {
  min-width: 140px;
}

/* ----- column / sidebar layout ----- */
.listing-kpi-strip--col {
  flex-direction: column;
  flex-wrap: nowrap;
  gap: 6px;
}

.listing-kpi-strip--col > :deep(.stat-tile) {
  flex: 0 0 auto;
  width: 100%;
  min-width: 0;
}

/* ----- rail (collapsed sidebar) ----- */
.listing-kpi-strip--rail > :deep(.stat-tile) {
  padding: 8px 6px;
  align-items: center;
  text-align: center;
}
</style>
