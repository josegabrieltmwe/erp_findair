<template>
  <div>
    <v-alert type="info" variant="tonal" density="compact" class="mb-2">
      {{ t('webcargo_delegation.partner_tab_hint') }}
    </v-alert>
    <v-alert type="warning" variant="tonal" density="compact" class="mb-4">
      {{ t('webcargo_delegation.partner_tab_default_hint') }}
    </v-alert>

    <div class="d-flex justify-end mb-3">
      <v-btn color="primary" :prepend-icon="mdiPlus" @click="openCreate">
        {{ t('webcargo_delegation.new_delegation') }}
      </v-btn>
    </div>

    <CmEmptyState
      v-if="!loading && !error && items.length === 0"
      :icon="mdiSwapHorizontal"
      :title="t('webcargo_delegation.empty_title')"
    />
    <ListingDataView
      v-else
      :source="listSource"
      :headers="tableHeaders"
      :selected="selected"
      :sort-key-map="sortKeyMap"
      mode="infinite"
      :selectable="false"
      @update:selected="selected = $event"
    >
      <template #cell.country_iso="{ item }">
        <v-chip size="small" class="cm-tone-neutral">{{ (item as WebcargoDelegation).country_iso }}</v-chip>
      </template>
      <template #cell.av="{ item }">
        <span class="cm-mono">{{ (item as WebcargoDelegation).av }}</span>
        <span class="text-caption text-medium-emphasis ml-1">({{ (item as WebcargoDelegation).av_country || 'IT' }})</span>
      </template>
      <template #cell.dq="{ item }">
        <span class="cm-mono">{{ (item as WebcargoDelegation).dq }}</span>
      </template>
      <template #cell.actions="{ item }">
        <div class="cm-actions-right">
          <v-btn size="small" variant="text" :prepend-icon="mdiPencil" @click="openEdit(item as WebcargoDelegation)">
            {{ t('common.edit') }}
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            color="error"
            :prepend-icon="mdiDelete"
            @click="openDelete(item as WebcargoDelegation)"
          >
            {{ t('common.delete') }}
          </v-btn>
        </div>
      </template>
    </ListingDataView>
    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-2" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <v-dialog v-model="formDialog" max-width="560" persistent>
      <v-card>
        <v-card-title>
          {{ formMode === 'create' ? t('webcargo_delegation.dialog_create') : t('webcargo_delegation.dialog_edit') }}
        </v-card-title>
        <v-card-text>
          <CmCountrySelect
            v-model="form.country_iso"
            :label="t('webcargo_delegation.form_country_iso')"
            class="mb-3"
          />
          <v-text-field
            v-model="form.av"
            :label="t('webcargo_delegation.form_av')"
            :hint="t('webcargo_delegation.form_av_hint')"
            persistent-hint
            maxlength="50"
            class="mb-3"
          />
          <v-text-field
            v-model="form.dq"
            :label="t('webcargo_delegation.form_dq')"
            :hint="t('webcargo_delegation.form_dq_hint')"
            persistent-hint
            maxlength="50"
            class="mb-3"
          />
          <CmCountrySelect
            v-model="form.av_country"
            :label="t('webcargo_delegation.form_av_country')"
            clearable
          />
          <div class="text-caption text-medium-emphasis mt-1">
            {{ t('webcargo_delegation.form_av_country_hint') }}
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving" @click="formDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" :loading="saving" :disabled="!formValid" @click="save">
            {{ t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * Tab de delegación WebCargo **Realtime** (par AV/DQ, `tmwe_webcargo_delegation`)
 * dentro de la ficha de anagrafica. Sistema DISTINTO de WebCargo Published
 * (ver WebcargoKeyPartnerTab.vue, paquete `webcargo_key`) — comparten
 * proveedor pero no tabla, ni flujo, ni tipo de credencial.
 *
 * Cuando este partner NO tiene ninguna fila aquí para un país, WebCargo
 * Realtime lo cotiza en modo DIRECTO con la cuenta principal de la casa
 * (Italia) — comportamiento por defecto, no un error ni un estado a
 * corregir (Webcargo_Realtime_Account_Strategy::probe_fallback()).
 *
 * Variante embebida y fijada al partner de la vista admin global (V1,
 * `admin_config/webcargo_delegation.js`, nunca construida): mismo backend
 * (api_admin_webcargo_delegation), lista solo lo propio de este partner
 * (`id_anagrafica`) y crea/edita siempre con ese id fijo.
 */
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiPlus, mdiPencil, mdiDelete, mdiSwapHorizontal } from '@mdi/js';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import CmCountrySelect from '../../anagrafiche/components/CmCountrySelect.vue';
import ListingDataView from '../../listing/ListingDataView.vue';
import { useClientSideListSource } from '../../listing/useClientSideListSource';
import type { DataTableHeader } from '../../listing/types';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import {
  webcargoDelegationService,
  type WebcargoDelegation,
  type WebcargoDelegationPayload,
} from '../services/webcargoDelegation.service';

const props = defineProps<{
  idAnagrafica: number;
}>();
const emit = defineEmits<{ refresh: [] }>();

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const items = ref<WebcargoDelegation[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const selected = ref<{ id: number }[]>([]);

const listSource = useClientSideListSource(items, { loading });
const tableHeaders: DataTableHeader[] = [
  { title: t('webcargo_delegation.col_country') as string, key: 'country_iso' },
  { title: t('webcargo_delegation.col_av') as string, key: 'av' },
  { title: t('webcargo_delegation.col_dq') as string, key: 'dq' },
  { title: t('webcargo_delegation.col_actions') as string, key: 'actions', sortable: false, align: 'end' },
];
const sortKeyMap: Record<string, string> = { country_iso: 'country_iso' };

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    items.value = await webcargoDelegationService.list(undefined, props.idAnagrafica);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

const formDialog = ref(false);
const formMode = ref<'create' | 'edit'>('create');
interface FormState {
  id?: number;
  country_iso: string;
  av: string;
  dq: string;
  av_country: string;
}

const form = reactive<FormState>({
  country_iso: '',
  av: '',
  dq: '',
  av_country: '',
});

const formValid = computed(
  () => form.country_iso.trim().length === 2 && form.av.trim().length > 0 && form.dq.trim().length > 0,
);

function resetForm(): void {
  form.id = undefined;
  form.country_iso = '';
  form.av = '';
  form.dq = '';
  form.av_country = '';
}

function openCreate(): void {
  formMode.value = 'create';
  resetForm();
  formDialog.value = true;
}

function openEdit(item: WebcargoDelegation): void {
  formMode.value = 'edit';
  form.id = item.id;
  form.country_iso = item.country_iso;
  form.av = item.av;
  form.dq = item.dq;
  form.av_country = item.av_country || '';
  formDialog.value = true;
}

async function save(): Promise<void> {
  saving.value = true;
  try {
    const payload: WebcargoDelegationPayload = {
      id: form.id,
      id_anagrafica: props.idAnagrafica,
      country_iso: form.country_iso.toUpperCase().trim(),
      av: form.av.trim(),
      dq: form.dq.trim(),
      av_country: form.av_country ? form.av_country.toUpperCase().trim() : undefined,
    };
    if (formMode.value === 'create') {
      await webcargoDelegationService.create(payload);
      toast.success(t('webcargo_delegation.created'));
    } else {
      await webcargoDelegationService.update(payload);
      toast.success(t('webcargo_delegation.updated'));
    }
    formDialog.value = false;
    await load();
    emit('refresh');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

async function openDelete(item: WebcargoDelegation): Promise<void> {
  const ok = await confirm.askDanger(
    t('webcargo_delegation.confirm_delete_message', { country: item.country_iso }),
    t('webcargo_delegation.confirm_delete_title'),
  );
  if (!ok) return;
  try {
    await webcargoDelegationService.remove(item.id);
    toast.success(t('webcargo_delegation.deleted'));
    await load();
    emit('refresh');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

watch(() => props.idAnagrafica, load);
onMounted(() => {
  void load();
});
</script>
