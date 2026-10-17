<template>
  <v-dialog
    :model-value="modelValue"
    max-width="520"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title>{{ t('price_lists.dialog_create') }}</v-card-title>
      <v-card-text>
        <v-text-field
          v-model="form.nome"
          :label="t('price_lists.col_name') + ' *'"
          density="compact"
          class="mb-3"
        />
        <v-select
          v-model="form.tipo"
          :items="tipoItems"
          item-title="title"
          item-value="value"
          :label="t('price_lists.type') + ' *'"
          density="compact"
          class="mb-3"
        />
        <div class="mb-3">
          <CmEntityAutocomplete
            :model-value="form.id_servizi"
            :fetcher="fetchServices"
            :item-getter="getService"
            :format-primary="formatService"
            :format-secondary="formatServiceMeta"
            :label="t('price_lists.service')"
            @update:model-value="onServiceSelect"
          />
        </div>
        <CmAnagraficaAutocomplete
          :model-value="form.id_fornitore"
          :label="t('price_lists.carrier')"
          @update:model-value="(v) => (form.id_fornitore = v)"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="creating" @click="emit('update:modelValue', false)">{{
          t('common.cancel')
        }}</v-btn>
        <v-btn color="primary" :loading="creating" :disabled="!form.nome" @click="createList">
          {{ t('common.create') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
/**
 * Create a new price list. Extracted from PriceListsPage; owns the whole create
 * form and the supplier-service autocomplete it needs. The parent refreshes the
 * landing list on `created`. The form resets each time the dialog opens.
 */
import { ref, reactive, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToastStore } from '@shared/anagrafiche/stores/toast.store';
import { http } from '@shared/anagrafiche/services/http';
import { paginated } from '@shared/anagrafiche/services/normalizers';
import CmAnagraficaAutocomplete from '../components/CmAnagraficaAutocomplete.vue';
import CmEntityAutocomplete from '../components/CmEntityAutocomplete.vue';
import { listiniService, type ListinoTipo } from '../services/listini.service';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  created: [];
}>();

const { t } = useI18n();
const toast = useToastStore();

const tipoItems = computed(() => [
  { title: t('price_lists.tipo_client'), value: 'C' },
  { title: t('price_lists.tipo_supplier'), value: 'F' },
  { title: t('price_lists.tipo_reference'), value: 'R' },
]);

interface CreateForm {
  nome: string;
  tipo: ListinoTipo;
  id_servizi: number | null;
  id_fornitore: number | null;
  id_anagr_titolare: number;
}
const form = reactive<CreateForm>({
  nome: '',
  tipo: 'C',
  id_servizi: null,
  id_fornitore: null,
  id_anagr_titolare: 0,
});
const creating = ref(false);

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      form.nome = '';
      form.tipo = 'C';
      form.id_servizi = null;
      form.id_fornitore = null;
      form.id_anagr_titolare = 0;
    }
  },
);

function onServiceSelect(v: number | string | null): void {
  form.id_servizi = v == null ? null : typeof v === 'string' ? parseInt(v, 10) : v;
}

async function createList(): Promise<void> {
  creating.value = true;
  try {
    await listiniService.create({
      nome: form.nome,
      tipo: form.tipo,
      id_servizi: form.id_servizi ?? undefined,
      id_fornitore: form.id_fornitore ?? undefined,
      id_anagr_titolare: form.id_anagr_titolare,
    });
    toast.success(t('price_lists.list_created'));
    emit('update:modelValue', false);
    emit('created');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    creating.value = false;
  }
}

// ── Supplier-service autocomplete (used only by this dialog) ──
interface ServiceLite {
  id: number;
  descr?: string;
  id_fornitore?: number | string;
  [k: string]: unknown;
}

async function fetchServices(query: string, perPage?: number): Promise<ServiceLite[]> {
  const q = query.trim();
  const params: Record<string, string | number> = { per_page: perPage ?? 25 };
  if (q) params.search = q;
  const raw = await http<unknown>('/api_supplier_services', { query: params });
  if (Array.isArray(raw)) return raw as ServiceLite[];
  return paginated<ServiceLite>(raw).items;
}

async function getService(id: number | string): Promise<ServiceLite | null> {
  const nid = typeof id === 'number' ? id : parseInt(String(id), 10);
  if (!nid) return null;
  try {
    const raw = await http<unknown>('/api_supplier_services', { query: { id: nid } });
    if (Array.isArray(raw)) return (raw[0] as ServiceLite) ?? null;
    if (raw && typeof raw === 'object') {
      const data = (raw as { data?: unknown }).data ?? raw;
      if (Array.isArray(data)) return (data[0] as ServiceLite) ?? null;
      return data as ServiceLite;
    }
    return null;
  } catch {
    return null;
  }
}

function formatService(r: ServiceLite): string {
  return r.descr || `#${r.id}`;
}
function formatServiceMeta(r: ServiceLite): string | undefined {
  return r.id_fornitore ? `${t('price_lists.carrier')}: ${r.id_fornitore}` : undefined;
}
</script>
