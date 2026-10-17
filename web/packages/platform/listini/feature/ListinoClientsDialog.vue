<template>
  <v-dialog :model-value="modelValue" max-width="720" scrollable @update:model-value="emit('update:modelValue', $event)">
    <v-card>
      <v-card-title>{{ t('price_lists.clients_title', { name: listino?.nome ?? '' }) }}</v-card-title>
      <v-card-text>
        <CmAsyncSection :loading="loading" :error="error" :empty="!loading && !error && data.items.length === 0" :data="data.items" @clear-error="error = null">
          <template #empty>
            <div class="cm-cell-hint text-center pa-6">{{ t('price_lists.clients_empty') }}</div>
          </template>
          <template #default>
            <div class="cm-cell-hint mb-2">{{ t('price_lists.clients_total', { n: data.total }) }}</div>
            <v-table density="compact">
              <thead>
                <tr>
                  <th>{{ t('price_lists.clients_client') }}</th>
                  <th>{{ t('price_lists.col_service') }}</th>
                  <th>{{ t('price_lists.col_type') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in data.items" :key="c.id">
                  <td>{{ c.rag_soc || c.nome_breve || '#' + c.id_anagrafica }} <span class="cm-cell-hint">#{{ c.id_anagrafica }}</span></td>
                  <td>{{ c.servizio_nome || c.id_servizio }}</td>
                  <td>{{ c.tipo }}</td>
                </tr>
              </tbody>
            </v-table>
            <div v-if="data.total > data.items.length" class="cm-cell-hint mt-2">
              {{ t('price_lists.clients_truncated', { n: data.items.length }) }}
            </div>
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
import { listiniService, type ListinoClients, type ListinoLite } from '../services/listini.service';

const props = defineProps<{ modelValue: boolean; listino: ListinoLite | null }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const { t } = useI18n();
const loading = ref(false);
const error = ref<string | null>(null);
const data = ref<ListinoClients>({ total: 0, items: [] });

watch(
  () => [props.modelValue, props.listino?.id] as const,
  async ([open, id]) => {
    if (!open || !id) return;
    loading.value = true;
    error.value = null;
    try {
      data.value = await listiniService.listinoClients(id);
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  },
);
</script>
