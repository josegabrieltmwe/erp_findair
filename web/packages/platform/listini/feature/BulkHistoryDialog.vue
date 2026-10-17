<template>
  <v-dialog :model-value="modelValue" max-width="640" scrollable @update:model-value="emit('update:modelValue', $event)">
    <v-card>
      <v-card-title>{{ t('price_lists.bulk_history') }}</v-card-title>
      <v-card-text>
        <CmAsyncSection :loading="loading" :error="error" :empty="!loading && !error && batches.length === 0" :data="batches" @clear-error="error = null">
          <template #empty>
            <div class="cm-cell-hint text-center pa-6">{{ t('price_lists.bulk_history_empty') }}</div>
          </template>
          <template #default>
            <v-table density="compact">
              <thead>
                <tr>
                  <th>{{ t('price_lists.bulk_batch') }}</th>
                  <th class="text-right">{{ t('price_lists.bulk_lists') }}</th>
                  <th class="text-right">{{ t('price_lists.bulk_packs') }}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr v-for="b in batches" :key="b.batch">
                  <td>
                    {{ b.batch }}
                    <v-chip v-if="b.undone" size="x-small" class="ml-2" color="grey">{{ t('price_lists.bulk_undone_chip') }}</v-chip>
                  </td>
                  <td class="text-right">{{ b.listini }}</td>
                  <td class="text-right">{{ b.packs }}</td>
                  <td class="text-right">
                    <v-btn v-if="!b.undone" size="x-small" variant="outlined" color="error" :loading="busy === b.batch" @click="undo(b)">
                      {{ t('price_lists.bulk_undo') }}
                    </v-btn>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </template>
        </CmAsyncSection>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" @click="emit('update:modelValue', false)">{{ t('common.close') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import CmAsyncSection from '@shared/anagrafiche/components/CmAsyncSection.vue';
import { useToastStore } from '@shared/anagrafiche/stores/toast.store';
import { useConfirm } from '@shared/anagrafiche/composables/useConfirm';
import { listiniService, type BulkBatch } from '../services/listini.service';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; undone: [] }>();

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const batches = ref<BulkBatch[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const busy = ref('');

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    batches.value = await listiniService.bulkHistory();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function undo(b: BulkBatch): Promise<void> {
  const ok = await confirm.askDanger(t('price_lists.bulk_undo_confirm', { batch: b.batch }), t('price_lists.bulk_undo'));
  if (!ok) return;
  busy.value = b.batch;
  try {
    const r = await listiniService.bulkUndo(b.batch);
    toast.success(t('price_lists.bulk_undone', { n: r.packs, skipped: r.skipped }));
    emit('undone');
    await load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    busy.value = '';
  }
}

watch(() => props.modelValue, (open) => open && load());
</script>
