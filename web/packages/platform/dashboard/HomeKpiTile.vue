<template>
  <!--
    Home KPI tile — reuses the global `.stat-tile` primitives defined in
    `mockup2.scss` so the visual rhythm matches the detail page and the
    sidebar rail. Adds a `homekpi-*` modifier surface for the icon
    accent and hover affordance specific to dashboard tiles.
  -->
  <button
    type="button"
    class="stat-tile homekpi"
    :class="[`homekpi--${variant ?? 'default'}`, { 'homekpi--loading': loading, 'homekpi--zero': value == null || value === 0 }]"
    :title="description ?? label"
    @click="$emit('click')"
  >
    <div class="homekpi__corner">
      <span
        v-if="serverFiltered"
        class="tmwe-cockpit__filtered-dot"
        aria-hidden="true"
      />
      <v-icon v-if="icon" :icon="icon" size="18" />
      <v-icon icon="mdi-arrow-top-right" size="14" />
    </div>
    <div class="stat-val" :class="variant">
      <span v-if="loading" class="homekpi-skel">—</span>
      <template v-else>{{ formatted }}</template>
    </div>
    <div class="stat-cap">{{ label }}</div>
    <div v-if="description" class="stat-sub">{{ description }}</div>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  icon?: string;
  label: string;
  description?: string;
  /** Count number (or `null` while loading). */
  value: number | null;
  variant?: 'default' | 'success' | 'warning' | 'error';
  /** Hides the value, shows a skeleton placeholder instead. */
  loading?: boolean;
  /** The destination listing applies this KPI filter on the server. */
  serverFiltered?: boolean;
}>();

defineEmits<{ (e: 'click'): void }>();

const formatted = computed<string>(() => {
  if (props.value == null) return '—';
  return props.value.toLocaleString('en-US');
});
</script>

<style scoped lang="scss">
/*
  Self-contained tile primitives.

  Historical note: `HomeKpiTile` used to assume the global `.stat-tile`
  rules from `mockup2.scss` (loaded by the cargo / shipment SPAs). The
  home SPA does NOT import that stylesheet, so the tiles rendered as
  raw transparent buttons with no padding, no rhythm, no hover. We now
  bring the primitives inside the component so the tile looks the same
  regardless of where it's mounted.
*/

/* ─── base button ───────────────────────────────────────────────── */
.stat-tile {
  /* Reset the browser/Vuetify button defaults so we own the box. */
  appearance: none;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgb(var(--v-theme-surface));
  border-radius: 12px;
  padding: 12px 14px 12px 14px;
  /* Vertical rhythm — three lines: row (icon + label), value, sub. */
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: inherit;
  position: relative;
  /* Uniform height across a row of tiles (e.g. "Da controllare 19" and
     "Spedizioni di oggi 0") regardless of whether `description` is
     present — without this the tiles in a single grid row jump. */
  min-height: 92px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: border-color .14s ease, box-shadow .14s ease,
              background .14s ease, transform .14s ease;
}
.stat-tile:hover {
  border-color: rgba(var(--v-theme-primary), 0.45);
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.07), 0 1px 2px rgba(15, 23, 42, 0.04);
  transform: translateY(-1px);
}
.stat-tile:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

/* Top row — icon + label. Label is allowed to wrap to two lines but
   capped so a very long KPI name doesn't blow the tile up. */
.homekpi__corner {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 22px;
}
.homekpi__corner :deep(.v-icon) {
  flex: 0 0 auto;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.85;
}
.stat-tile :deep(.stat-cap) {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.005em;
  color: rgb(var(--v-theme-on-surface-variant));
  /* Truncate at two lines so layout stays predictable; `title` attr on
     the button gives the full text on hover. */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.25;
}

/* Big number. Fixed line-height + min-height so every tile in a grid
   row baseline-aligns to the same vertical position even when the
   value is short ("0") or long ("197,488"). */
.stat-tile :deep(.stat-val) {
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -.02em;
  line-height: 1;
  color: rgb(var(--v-theme-on-surface));
  font-feature-settings: 'tnum';
  min-height: 28px;
  display: flex;
  align-items: center;
}

/* Description line — small caption below the number. Hidden if empty
   so tiles without a `description` keep the same height (the min-height
   on `.stat-tile` already takes care of the row equalising). */
.stat-tile :deep(.stat-sub) {
  font-size: 11px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.75;
  line-height: 1.25;
  /* Single line, ellipsis if too long. */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ─── home-specific affordance ──────────────────────────────────── */
.homekpi {
  /* Inherited; nothing to override anymore. */
}
.homekpi--loading {
  cursor: progress;
}
.homekpi--zero {
  opacity: .55;
}
.homekpi-skel {
  display: inline-block;
  min-width: 56px;
  height: 22px;
  background: rgba(var(--v-theme-on-surface), .12);
  border-radius: 6px;
}

/* Variant accents on the icon. */
.homekpi--success .homekpi__corner :deep(.v-icon:first-of-type) { color: rgb(var(--v-theme-success)); opacity: 1; }
.homekpi--warning .homekpi__corner :deep(.v-icon:first-of-type) { color: rgb(var(--v-theme-warning)); opacity: 1; }
.homekpi--error   .homekpi__corner :deep(.v-icon:first-of-type) { color: rgb(var(--v-theme-error));   opacity: 1; }
</style>
