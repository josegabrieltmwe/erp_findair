<template>
  <!--
    Active-filter rail: one removable chip per active filter, shown above
    the data table. Filters are applied by clicking a value inside a row
    (click-to-filter); this rail is how the operator sees what's active
    and drops individual filters or clears them all.

    The rail keeps a stable height even with no active filters, preventing
    the table from jumping when an operator clicks a value.
  -->
  <div class="afc-row" :class="{ 'afc-row--empty': filters.length === 0 }">
    <span class="afc-lead">
      <v-icon icon="mdi-filter-variant" size="15" />
      {{ t('platform.filters.label') }}
    </span>

    <span v-if="filters.length === 0" class="afc-hint">
      {{ t('platform.filters.click_hint') }}
    </span>

    <v-chip
      v-for="f in filters"
      :key="f.field"
      :color="f.color || 'primary'"
      variant="tonal"
      size="small"
      closable
      class="afc-chip"
      @click:close="$emit('remove', f.field)"
    >
      <CountryFlag v-if="f.iso" :iso="f.iso" :size="14" class="afc-chip-flag" />
      <span class="afc-chip-group">{{ f.group }}:</span>
      <span class="afc-chip-value">{{ f.value }}</span>
    </v-chip>

    <button
      v-if="filters.length > 1"
      type="button"
      class="afc-clear"
      @click="$emit('clear')"
    >
      <v-icon icon="mdi-close" size="13" />
      {{ t('platform.filters.clear_all') }}
    </button>

    <button
      v-if="advancedLabel"
      type="button"
      class="afc-advanced"
      :title="advancedTitle || advancedLabel"
      @click="$emit('advanced')"
    >
      <v-icon icon="mdi-tune-variant" size="15" />
      <span>{{ advancedLabel }}</span>
      <span v-if="advancedCount > 0" class="afc-advanced-badge">
        {{ advancedCount }}
      </span>
    </button>

  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import CountryFlag from './CountryFlag.vue';
import type { ActiveFilter } from './types';

const { t } = useI18n();

withDefaults(defineProps<{
  filters: ActiveFilter[];
  advancedLabel?: string;
  advancedTitle?: string;
  advancedCount?: number;
}>(), {
  advancedLabel: '',
  advancedTitle: '',
  advancedCount: 0,
});

defineEmits<{
  (e: 'remove', field: string): void;
  (e: 'clear'): void;
  (e: 'advanced'): void;
}>();
</script>

<style scoped lang="scss">
.afc-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  margin: 4px 0 10px;
  min-height: 32px;
}

.afc-row--empty .afc-lead,
.afc-row--empty .afc-hint {
  opacity: 0.68;
}

.afc-hint {
  font-size: 11.5px;
  color: rgb(var(--v-theme-on-surface-variant));
}

.afc-lead {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgb(var(--v-theme-on-surface-variant));
  margin-right: 2px;
}

.afc-chip {
  font-weight: 600;
  letter-spacing: 0.01em;
  /* Subtle depth so the active filters read as raised pills. */
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);
}
.afc-chip-flag {
  margin-right: 5px;
}
.afc-chip-group {
  opacity: 0.7;
  margin-right: 4px;
  font-weight: 500;
}
.afc-chip-value {
  font-weight: 700;
}

.afc-clear {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11.5px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface-variant));
  padding: 4px 9px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  transition: color 0.12s, border-color 0.12s, background 0.12s;
}
.afc-clear:hover {
  color: rgb(var(--v-theme-error));
  border-color: rgba(var(--v-theme-error), 0.4);
  background: rgba(var(--v-theme-error), 0.06);
}

.afc-advanced {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  min-height: 30px;
  padding: 5px 10px;
  border: 1px solid rgba(var(--v-theme-primary), 0.3);
  border-radius: 8px;
  background: rgba(var(--v-theme-primary), 0.08);
  color: rgb(var(--v-theme-primary));
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}
.afc-advanced:hover {
  background: rgba(var(--v-theme-primary), 0.14);
  border-color: rgba(var(--v-theme-primary), 0.5);
}
.afc-advanced-badge {
  display: inline-grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-size: 10px;
  line-height: 1;
}

</style>
