<template>
  <v-autocomplete
    v-model:search="searchInput"
    :model-value="selectedIdRaw"
    :items="displayItems"
    :loading="loading"
    :label="label"
    :placeholder="placeholder ?? t('selectors.search_placeholder')"
    :hint="effectiveHint"
    :persistent-hint="!!effectiveHint"
    :disabled="disabled"
    :clearable="clearable"
    :rules="rules"
    item-title="__display"
    item-value="__id"
    :no-filter="true"
    :menu-props="{ maxHeight: 360 }"
    variant="outlined"
    density="comfortable"
    hide-no-data
    :return-object="false"
    @update:model-value="onSelectChange"
  >
    <template #item="{ props: itemProps, item }">
      <slot name="item" :item="item.raw as unknown as T" :props="itemProps">
        <v-list-item
          v-bind="itemProps"
          :title="undefined"
          :subtitle="undefined"
        >
          <div class="cm-ea-row">
            <span class="cm-ea-id">#{{ item.raw.__id }}</span>
            <span class="cm-ea-name">{{
              formatPrimary(item.raw as unknown as T)
            }}</span>
          </div>
          <div
            v-if="formatSecondary(item.raw as unknown as T)"
            class="cm-ea-meta"
          >
            {{ formatSecondary(item.raw as unknown as T) }}
          </div>
        </v-list-item>
      </slot>
    </template>

    <template #append-inner>
      <v-progress-circular v-if="loading" indeterminate size="16" width="2" />
    </template>
  </v-autocomplete>
</template>

<script setup lang="ts" generic="T extends Record<string, unknown>">
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useDebouncedCallback } from "@shared/anagrafiche/composables/useDebouncedRef";

/**
 * CmEntityAutocomplete — Generic autocomplete primitive.
 *
 * Wraps Vuetify's v-autocomplete with debounced server-side search and
 * a "preserve current selection on edit" guarantee. Designed to be
 * specialized via thin wrappers (CmAnagraficaAutocomplete, CmUserAutocomplete,
 * etc.) that supply the entity-specific service + display formatters.
 *
 * Use this component directly only if you need full control; otherwise
 * prefer the specialized wrappers in components/shared.
 */

type IdValue = number | string;

interface Props<E> {
  /** Currently selected entity id (or null). */
  modelValue: IdValue | null;
  /** Function that returns up to N entities matching the query. */
  fetcher: (query: string, perPage?: number) => Promise<E[]>;
  /** Function that resolves a single entity by id (used to preserve modelValue when editing). */
  itemGetter?: (id: IdValue) => Promise<E | null>;
  /** Returns the entity id (defaults to row.id). */
  idKey?: (row: E) => IdValue;
  /** Primary label shown next to the #id. */
  formatPrimary: (row: E) => string;
  /** Optional secondary line below (default: empty). */
  formatSecondary?: (row: E) => string | undefined;
  /** Items per page (default: 25). */
  perPage?: number;
  /** Pre-fetched option for edit mode — skips one round-trip. */
  initialOption?: E | null;
  /** Field props. */
  label?: string;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
  clearable?: boolean;
  rules?: Array<(v: unknown) => boolean | string>;
  /**
   * Optional reactive parent id for cascade selectors. When it changes,
   * modelValue is reset to null and the list is reloaded with parentId
   * forwarded to the fetcher's second arg via context (see fetcher signature).
   * If you need cascade, prefer a fetcher that already closes over parent state.
   */
  parentId?: IdValue | null;
}

const props = withDefaults(defineProps<Props<T>>(), {
  itemGetter: undefined,
  idKey: undefined,
  formatSecondary: undefined,
  perPage: 25,
  initialOption: null,
  label: "",
  placeholder: undefined,
  hint: undefined,
  disabled: false,
  clearable: true,
  rules: () => [],
  parentId: undefined,
});

const emit = defineEmits<{
  "update:modelValue": [value: IdValue | null];
  /** Emitted whenever the selected entity changes (or is cleared). */
  select: [option: T | null];
}>();

const { t } = useI18n();

// ---------------------------------------------------------------------------
// Reactive state
// ---------------------------------------------------------------------------
// Items array is typed loosely (Record<string, unknown>) because Vuetify's
// v-autocomplete rejects union types in its item generics. The public API
// (props.fetcher, emit('select')) stays strictly typed via T.
type DecoratedItem = Record<string, unknown> & {
  __id: IdValue;
  __display: string;
};
const items = ref<DecoratedItem[]>([]);
const searchInput = ref("");
const loading = ref(false);

// El último ítem seleccionado se "pinna" para que su __display (nombre) siga
// resolviéndose en el campo aunque una búsqueda posterior lo saque de `items`.
// Sin esto, v-autocomplete no encuentra el ítem y muestra el __id crudo.
const pinnedItem = ref<DecoratedItem | null>(null);

// Lista efectiva que ve v-autocomplete: los resultados de la búsqueda más el
// ítem seleccionado (si ya no está en `items`), para que el campo muestre su
// nombre en vez del id.
const displayItems = computed<DecoratedItem[]>(() => {
  const pin = pinnedItem.value;
  if (pin && !items.value.some((it) => it.__id === pin.__id)) {
    return [pin, ...items.value];
  }
  return items.value;
});

// Hint bajo el campo: cuando hay una anagrafica seleccionada, comunica su #id
// (el nombre queda en el campo). Si no hay selección, cae al hint del padre.
const selectedHint = computed<string | undefined>(() => {
  if (selectedIdRaw.value == null) return undefined;
  return `#${selectedIdRaw.value}`;
});

const effectiveHint = computed<string | undefined>(
  () => selectedHint.value ?? props.hint,
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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

function decorate(rows: T[]): DecoratedItem[] {
  return rows.map((r) => {
    const id = getId(r);
    return {
      ...(r as unknown as Record<string, unknown>),
      __id: id,
      // Texto que v-autocomplete muestra en el CAMPO una vez seleccionado:
      // solo el nombre. El #id se muestra en las filas del dropdown (plantilla
      // #item) y como hint bajo el campo (selectedHint).
      __display: formatPrimary(r),
    };
  });
}

// ---------------------------------------------------------------------------
// v-model bridge — explicit, no computed (avoids generic constraint issues)
// ---------------------------------------------------------------------------
const selectedIdRaw = ref<IdValue | null>(props.modelValue);

watch(
  () => props.modelValue,
  async (v) => {
    selectedIdRaw.value = v;
    if (v == null) {
      pinnedItem.value = null;
      return;
    }
    // Si el valor ya está pinnado o presente, no hay nada que resolver.
    if (pinnedItem.value?.__id === v) return;
    const inItems = items.value.find((it) => it.__id === v);
    if (inItems) {
      pinnedItem.value = inItems;
      return;
    }
    // Valor puesto por el padre (p.ej. click-en-celda de la tabla): resolver
    // el nombre para que el campo no muestre solo el id.
    const resolved =
      props.initialOption ??
      (props.itemGetter ? await props.itemGetter(v) : null);
    if (resolved) pinnedItem.value = decorate([resolved])[0];
  },
);

function onSelectChange(v: IdValue | null): void {
  selectedIdRaw.value = v;
  emit("update:modelValue", v);
  if (v == null) {
    pinnedItem.value = null;
    emit("select", null);
    return;
  }
  const found = items.value.find((it) => it.__id === v) ?? null;
  if (found) {
    pinnedItem.value = found;
    const { __id: _i, __display: _d, ...raw } = found;
    emit("select", raw as unknown as T);
  } else {
    emit("select", null);
  }
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
const runSearch = useDebouncedCallback(async (query: string) => {
  loading.value = true;
  try {
    const rows = await props.fetcher(query, props.perPage);
    let out = rows;

    // If the query parses as a numeric ID and isn't in results, fetch it explicitly
    const asId = parseInt(query, 10);
    if (
      !Number.isNaN(asId) &&
      asId > 0 &&
      !rows.some((r) => Number(getId(r)) === asId) &&
      props.itemGetter
    ) {
      const single = await props.itemGetter(asId);
      if (single) out = [single, ...rows];
    }

    items.value = decorate(out);

    // Preserve current modelValue if it falls outside the latest results
    if (
      props.modelValue != null &&
      !items.value.some((it) => it.__id === props.modelValue)
    ) {
      const existing =
        props.initialOption ??
        (props.itemGetter ? await props.itemGetter(props.modelValue) : null);
      if (existing) {
        items.value = [...decorate([existing]), ...items.value];
      }
    }
  } finally {
    loading.value = false;
  }
}, 250);

watch(searchInput, (q) => runSearch(q ?? ""));

// Cascade: when parentId changes, reset selection and reload
watch(
  () => props.parentId,
  (newVal, oldVal) => {
    if (newVal !== oldVal) {
      emit("update:modelValue", null);
      emit("select", null);
      items.value = [];
      runSearch("");
    }
  },
);

// ---------------------------------------------------------------------------
// Initial load
// ---------------------------------------------------------------------------
onMounted(async () => {
  if (props.modelValue != null) {
    if (props.initialOption) {
      items.value = decorate([props.initialOption]);
    } else if (props.itemGetter) {
      const row = await props.itemGetter(props.modelValue);
      if (row) items.value = decorate([row]);
    }
    pinnedItem.value =
      items.value.find((it) => it.__id === props.modelValue) ?? null;
  } else {
    runSearch("");
  }
});
</script>

<style scoped>
.cm-ea-row {
  display: flex;
  align-items: baseline;
  gap: var(--cm-space-sm);
}
.cm-ea-id {
  font-family: var(--cm-font-mono, monospace);
  font-size: 0.85em;
  color: var(--cm-text-muted);
  min-width: 60px;
}
.cm-ea-name {
  font-weight: 500;
}
.cm-ea-meta {
  font-size: 0.8em;
  color: var(--cm-text-muted);
  margin-top: 2px;
}
</style>
