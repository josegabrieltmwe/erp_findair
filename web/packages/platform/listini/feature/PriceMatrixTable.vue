<template>
  <div>
    <div v-if="editable" class="d-flex align-center flex-wrap ga-2 mb-2">
      <v-text-field
        v-model="newWeight"
        type="number"
        min="0"
        step="any"
        :label="t('price_lists.matrix_new_weight')"
        density="compact"
        variant="outlined"
        hide-details
        class="cm-add-field"
        @keydown.enter.prevent="addWeight"
      />
      <v-btn size="small" variant="outlined" :disabled="!canAddWeight" @click="addWeight">
        {{ t('price_lists.matrix_add_weight') }}
      </v-btn>
      <v-text-field
        v-model="newZone"
        :label="t('price_lists.matrix_new_zone')"
        density="compact"
        variant="outlined"
        hide-details
        class="cm-add-field"
        @keydown.enter.prevent="addZone"
      />
      <v-btn size="small" variant="outlined" :disabled="!canAddZone" @click="addZone">
        {{ t('price_lists.matrix_add_zone') }}
      </v-btn>
    </div>

    <div v-if="weights.length > 0 && zones.length > 0" class="cm-matrix-wrap">
      <table class="cm-matrix">
        <thead>
          <tr>
            <th class="cm-matrix-corner">{{ t('price_lists.col_weight') }}</th>
            <th v-for="z in zones" :key="z" class="cm-matrix-zone" :title="zoneNames?.[String(z)] || ''">
              {{ `Z${z}` }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in weights" :key="w">
            <td class="cm-matrix-weight">{{ w }}</td>
            <td
              v-for="z in zones"
              :key="z"
              class="cm-matrix-cell"
              :class="{ 'cm-matrix-cell--dirty': editable && isDirty(w, z) }"
            >
              <template v-if="editable">
                <input
                  class="cm-matrix-input cm-mono"
                  type="number"
                  inputmode="decimal"
                  step="0.01"
                  min="0"
                  :value="editValue(w, z)"
                  :aria-label="`Z${z} @ ${w}`"
                  @input="onInput(w, z, ($event.target as HTMLInputElement).value)"
                />
              </template>
              <template v-else>
                <span v-if="cellValue(w, z) !== ''" class="cm-mono">{{ cellValue(w, z) }}</span>
                <span v-else class="cm-matrix-empty">—</span>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ListinoPrice } from '../services/listini.service';

export type PriceField = 'prezzo' | 'prezzo2' | 'prezzo_base' | 'prezzo_min';
const FIELDS: PriceField[] = ['prezzo', 'prezzo2', 'prezzo_base', 'prezzo_min'];

const props = withDefaults(
  defineProps<{
    prices: ListinoPrice[];
    editable?: boolean;
    /** Columna de la fila que se muestra y edita (la matriz es la misma para las cuatro). */
    field?: PriceField;
    zoneNames?: Record<string, string>;
  }>(),
  { editable: false, field: 'prezzo', zoneNames: undefined },
);

const emit = defineEmits<{
  /** Emits the full updated price array on every edit (bulk-replace friendly). */
  (e: 'update:prices', prices: ListinoPrice[]): void;
  /** True while any cell differs from the loaded matrix. */
  (e: 'dirty-change', dirty: boolean): void;
}>();

const { t } = useI18n();

const key = (w: number | string, z: number | string): string => `${Number(w)}|${z}`;

// Working copy of price rows, keyed by peso_max|zona. Preserves all extra
// columns (id, id_bnc_tp, …) via the ListinoPrice index signature.
const draft = ref<Map<string, ListinoPrice>>(new Map());
// Snapshot of the original values (the four price columns) per cell, for the
// dirty state. Cells added in the grid have no snapshot.
const original = ref<Map<string, string>>(new Map());
const addedWeights = ref<Set<number>>(new Set());
const addedZones = ref<Set<string>>(new Set());

function normalize(v: unknown): string {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : n.toFixed(2);
}

function signature(r: ListinoPrice | undefined): string {
  return r ? FIELDS.map((f) => normalize(r[f])).join('|') : '';
}

function rebuild(rows: ListinoPrice[]): void {
  const d = new Map<string, ListinoPrice>();
  const o = new Map<string, string>();
  for (const r of rows) {
    const k = key(r.peso_max, r.zona);
    d.set(k, { ...r });
    o.set(k, signature(r));
  }
  draft.value = d;
  original.value = o;
  addedWeights.value = new Set();
  addedZones.value = new Set();
}

watch(() => props.prices, (rows) => rebuild(rows ?? []), { immediate: true, deep: false });

const zones = computed<Array<number | string>>(() => {
  const set = new Set<number | string>();
  for (const p of props.prices) set.add(p.zona);
  for (const z of addedZones.value) set.add(z);
  return [...set].sort((a, b) => Number(a) - Number(b));
});

const weights = computed<Array<number | string>>(() => {
  const set = new Set<number | string>();
  for (const p of props.prices) set.add(p.peso_max);
  for (const w of addedWeights.value) set.add(w);
  return [...set].sort((a, b) => Number(a) - Number(b));
});

function cellValue(weight: number | string, zone: number | string): string {
  const p = draft.value.get(key(weight, zone));
  return p ? normalize(p[props.field]) : '';
}

/** Raw value for the <input>, without forced 2-decimal formatting while typing. */
function editValue(weight: number | string, zone: number | string): string | number {
  const p = draft.value.get(key(weight, zone));
  const v = p?.[props.field];
  if (v === '' || v === null || v === undefined) return '';
  return v as string | number;
}

function isDirty(weight: number | string, zone: number | string): boolean {
  const k = key(weight, zone);
  return signature(draft.value.get(k)) !== (original.value.get(k) ?? '');
}

const anyDirty = computed<boolean>(() => {
  for (const [k, row] of draft.value) {
    if (signature(row) !== (original.value.get(k) ?? '')) return true;
  }
  return false;
});

watch(anyDirty, (d) => emit('dirty-change', d));

function emitRows(): void {
  emit('update:prices', [...draft.value.values()]);
}

function onInput(weight: number | string, zone: number | string, raw: string): void {
  const k = key(weight, zone);
  const existing = draft.value.get(k) ?? { peso_max: Number(weight), zona: zone, prezzo: '' };
  // Clamp negatives to 0; keep empty as empty (cell cleared).
  let value: number | string = raw;
  if (raw !== '') {
    const n = Number(raw);
    value = Number.isNaN(n) ? ((existing[props.field] as number | string) ?? '') : Math.max(0, n);
  }
  draft.value.set(k, { ...existing, [props.field]: value });
  emitRows();
}

// ── Estructura: nuevos escalones de peso y zonas ──
const newWeight = ref<string>('');
const newZone = ref<string>('');

const canAddWeight = computed(() => {
  const n = Number(newWeight.value);
  return newWeight.value !== '' && n > 0 && !weights.value.some((w) => Number(w) === n) && zones.value.length > 0;
});
const canAddZone = computed(() => {
  const z = newZone.value.trim();
  return z !== '' && !zones.value.some((x) => String(x) === z) && weights.value.length > 0;
});

function addWeight(): void {
  if (!canAddWeight.value) return;
  addedWeights.value = new Set(addedWeights.value).add(Number(newWeight.value));
  newWeight.value = '';
}

function addZone(): void {
  if (!canAddZone.value) return;
  addedZones.value = new Set(addedZones.value).add(newZone.value.trim());
  newZone.value = '';
}
</script>

<style scoped>
.cm-matrix-wrap {
  overflow: auto;
  max-height: 500px;
  border: 1px solid var(--cm-border, #e0e0e0);
  border-radius: 8px;
}
.cm-matrix {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.cm-matrix thead tr {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--cm-surface-alt, #fafafa);
}
.cm-matrix th,
.cm-matrix td {
  padding: 6px 8px;
  border-bottom: 1px solid var(--cm-border-light, #f0f0f0);
}
.cm-matrix-corner {
  text-align: left;
  font-weight: 500;
  color: var(--cm-text-muted);
  min-width: 80px;
}
.cm-matrix-zone {
  text-align: right;
  font-weight: 500;
  color: var(--cm-text-info, #1565c0);
  min-width: 70px;
}
.cm-matrix-weight {
  font-weight: 500;
}
.cm-matrix-cell {
  text-align: right;
}
.cm-matrix-cell--dirty {
  background: var(--cm-warning-bg, #fff8e1);
}
.cm-matrix-empty {
  color: var(--cm-border, #ddd);
}
.cm-mono {
  font-family: var(--cm-font-mono, monospace);
}
.cm-matrix-input {
  width: 64px;
  text-align: right;
  border: 1px solid var(--cm-border, #e0e0e0);
  border-radius: 4px;
  padding: 2px 4px;
  font-size: 12px;
  background: var(--cm-surface, #fff);
  color: inherit;
}
.cm-matrix-input:focus {
  outline: none;
  border-color: var(--cm-text-info, #1565c0);
}
.cm-add-field {
  max-width: 170px;
}
</style>
