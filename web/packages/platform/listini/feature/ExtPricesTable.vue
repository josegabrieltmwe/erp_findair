<template>
  <div>
    <div class="cm-cell-hint mb-2">{{ t('price_lists.ext_hint') }}</div>
    <v-table v-if="rows.length > 0 || editable" density="compact">
      <thead>
        <tr>
          <th>{{ t('price_lists.col_zone') }}</th>
          <th class="text-right">{{ t('price_lists.col_weight') }}</th>
          <th class="text-right">{{ t('price_lists.ext_price') }}</th>
          <th v-if="editable" style="width: 48px" />
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in rows" :key="i">
          <template v-if="editable">
            <td><v-text-field v-model="r.zona" density="compact" variant="underlined" hide-details @update:model-value="touch" /></td>
            <td><v-text-field v-model.number="r.peso_max" type="number" min="0" step="any" density="compact" variant="underlined" hide-details @update:model-value="touch" /></td>
            <td><v-text-field v-model.number="r.prezzo" type="number" min="0" step="any" density="compact" variant="underlined" hide-details @update:model-value="touch" /></td>
            <td><v-btn :icon="mdiClose" size="x-small" variant="text" :aria-label="t('common.delete')" @click="remove(i)" /></td>
          </template>
          <template v-else>
            <td>Z{{ r.zona }}</td>
            <td class="text-right">{{ r.peso_max }}</td>
            <td class="text-right">{{ r.prezzo }}</td>
          </template>
        </tr>
        <tr v-if="rows.length === 0">
          <td :colspan="editable ? 4 : 3" class="text-center cm-cell-hint">{{ t('price_lists.ext_empty') }}</td>
        </tr>
      </tbody>
    </v-table>
    <div v-else class="cm-cell-hint">{{ t('price_lists.ext_empty') }}</div>
    <v-btn v-if="editable" size="small" variant="outlined" class="mt-2" @click="add">
      {{ t('price_lists.ext_add') }}
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { mdiClose } from '@mdi/js';

export interface ExtRow {
  zona: number | string;
  peso_max: number | string;
  prezzo: number | string;
  [k: string]: unknown;
}

const props = defineProps<{ rows: ExtRow[]; editable?: boolean }>();
const emit = defineEmits<{ (e: 'dirty'): void }>();

const { t } = useI18n();

function touch(): void {
  emit('dirty');
}
function add(): void {
  props.rows.push({ zona: '', peso_max: '', prezzo: '' });
  emit('dirty');
}
function remove(i: number): void {
  props.rows.splice(i, 1);
  emit('dirty');
}
</script>
