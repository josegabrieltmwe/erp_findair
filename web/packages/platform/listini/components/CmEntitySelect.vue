<template>
  <v-select
    :model-value="selectedIdRaw"
    :items="decoratedItems"
    :loading="loading"
    :label="label"
    :placeholder="placeholder"
    :hint="hint"
    :persistent-hint="!!hint"
    :disabled="disabled"
    :clearable="clearable"
    :rules="rules"
    :multiple="multiple"
    item-title="__display"
    item-value="__id"
    :item-props="itemPropsOf"
    variant="outlined"
    density="comfortable"
    :menu-props="{ maxHeight: 360 }"
    @update:model-value="onSelectChange"
  >
    <template #item="{ props: itemProps, item }">
      <slot name="item" :item="(item.raw as unknown as T)" :props="itemProps">
        <v-list-item v-bind="itemProps" :title="undefined" :subtitle="undefined">
          <div class="cm-es-row">
            <span v-if="showId" class="cm-es-id">#{{ item.raw.__id }}</span>
            <span class="cm-es-name">{{ formatPrimary(item.raw as unknown as T) }}</span>
          </div>
          <div v-if="formatSecondary(item.raw as unknown as T)" class="cm-es-meta">
            {{ formatSecondary(item.raw as unknown as T) }}
          </div>
        </v-list-item>
      </slot>
    </template>
  </v-select>
</template>

<script setup lang="ts" generic="T extends Record<string, unknown>">
import { computed, ref, watch } from 'vue';
import { useEntityCache } from '../composables/useEntityCache';

/**
 * CmEntitySelect — Generic static-list select primitive.
 *
 * Loads ALL items once on first mount via a shared cache (useEntityCache)
 * and renders a regular v-select. Use for catalogs <500 rows that don't
 * need server-side search (countries, currencies, internal roles, etc.).
 *
 * For >500 rows or text-search scenarios, use CmEntityAutocomplete instead.
 */

type IdValue = number | string;

interface Props<E> {
  modelValue: IdValue | IdValue[] | null;
  /** Stable cache key (e.g. "paesi", "valute"). Multiple instances share the same data. */
  cacheKey: string;
  /** One-time fetcher; called only on the first mount of any instance with this cacheKey. */
  fetcher: () => Promise<E[]>;
  /** Returns the entity id (defaults to row.id). */
  idKey?: (row: E) => IdValue;
  /** Primary label shown next to (optional) #id. */
  formatPrimary: (row: E) => string;
  /** Optional secondary line below. */
  formatSecondary?: (row: E) => string | undefined;
  /** Show #ID prefix in display (default: false — selects usually don't show ids). */
  showId?: boolean;
  /** Optional predicate: rows that return false are hidden (cache stays intact). */
  filter?: (row: E) => boolean;
  /** Optional predicate: rows that return true are listed but not selectable. */
  itemDisabled?: (row: E) => boolean;
  /** Field props. */
  label?: string;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
  clearable?: boolean;
  multiple?: boolean;
  rules?: Array<(v: unknown) => boolean | string>;
}

const props = withDefaults(defineProps<Props<T>>(), {
  idKey: undefined,
  formatSecondary: undefined,
  showId: false,
  filter: undefined,
  itemDisabled: undefined,
  label: '',
  placeholder: undefined,
  hint: undefined,
  disabled: false,
  clearable: true,
  multiple: false,
  rules: () => [],
});

const emit = defineEmits<{
  'update:modelValue': [value: IdValue | IdValue[] | null];
  select: [option: T | T[] | null];
}>();

// ---------------------------------------------------------------------------
// Cache-backed loading
// ---------------------------------------------------------------------------
const { items, loading } = useEntityCache<T>(props.cacheKey, props.fetcher);

function getId(row: T): IdValue {
  if (props.idKey) return props.idKey(row);
  return (row as unknown as { id: IdValue }).id;
}

function formatPrimary(row: T): string {
  return props.formatPrimary(row);
}

function formatSecondary(row: T): string | undefined {
  return props.formatSecondary ? props.formatSecondary(row) : undefined;
}

type DecoratedItem = Record<string, unknown> & { __id: IdValue; __display: string; __disabled: boolean };

const decoratedItems = computed<DecoratedItem[]>(() =>
  items.value
    .filter((r) => (props.filter ? props.filter(r) : true))
    .map((r) => ({
      ...(r as unknown as Record<string, unknown>),
      __id: getId(r),
      __display: props.showId
        ? `#${getId(r)} — ${formatPrimary(r)}`
        : formatPrimary(r),
      __disabled: props.itemDisabled ? props.itemDisabled(r) : false,
    })),
);

function itemPropsOf(item: unknown): Record<string, unknown> {
  const d = item as DecoratedItem | null;
  return d?.__disabled ? { disabled: true } : {};
}

// ---------------------------------------------------------------------------
// v-model bridge (single + multiple) — explicit, avoids generic constraints
// ---------------------------------------------------------------------------
const selectedIdRaw = ref<IdValue | IdValue[] | null>(props.modelValue);

watch(
  () => props.modelValue,
  (v) => {
    selectedIdRaw.value = v;
  },
);

function onSelectChange(v: IdValue | IdValue[] | null): void {
  selectedIdRaw.value = v;
  emit('update:modelValue', v);
  if (v == null) {
    emit('select', null);
    return;
  }
  if (Array.isArray(v)) {
    const arr = v
      .map((id) => items.value.find((it) => getId(it) === id))
      .filter((x): x is T => !!x);
    emit('select', arr);
  } else {
    const found = items.value.find((it) => getId(it) === v) ?? null;
    emit('select', found);
  }
}
</script>
