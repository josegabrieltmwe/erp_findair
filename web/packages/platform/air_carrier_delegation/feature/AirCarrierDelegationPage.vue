<template>
  <div>
    <CmSectionHeader
      :title="t('air_carrier_delegation.title')"
      :subtitle="t('air_carrier_delegation.subtitle')"
    >
      <template #actions>
        <v-btn color="primary" :prepend-icon="mdiPlus" @click="openCreate">
          {{ t('air_carrier_delegation.new_delegation') }}
        </v-btn>
      </template>
    </CmSectionHeader>

    <v-card class="pa-4 mb-4" variant="outlined">
      <div class="cm-filters">
        <v-select
          v-model="filters.carrier_code"
          :items="carrierItems"
          :label="t('air_carrier_delegation.filter_carrier')"
          density="compact"
          hide-details
          clearable
          @update:model-value="load"
        />
        <CmCountrySelect
          v-model="filters.origin_country_iso"
          :label="t('air_carrier_delegation.filter_origin')"
          @update:model-value="load"
        />
      </div>
    </v-card>

    <CmEmptyState
      v-if="!loading && !error && items.length === 0"
      :icon="mdiAirplane"
      :title="t('air_carrier_delegation.empty_title')"
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
      <template #cell.carrier_code="{ item }">
        <v-chip size="small" class="cm-tone-neutral">{{ (item as AirCarrierDelegation).carrier_code }}</v-chip>
      </template>
      <template #cell.origin_country_iso="{ item }">
        <v-chip size="small" class="cm-tone-neutral">{{ (item as AirCarrierDelegation).origin_country_iso }}</v-chip>
      </template>
      <template #cell.delegated_partner="{ item }">
        <div>{{ (item as AirCarrierDelegation).delegated_partner_name || `#${(item as AirCarrierDelegation).delegated_partner}` }}</div>
        <div class="cm-cell-hint">{{ t('air_carrier_delegation.borrows') }}</div>
      </template>
      <template #cell.credential_partner="{ item }">
        <div>{{ (item as AirCarrierDelegation).credential_partner_name || `#${(item as AirCarrierDelegation).credential_partner}` }}</div>
        <div class="cm-cell-hint">{{ t('air_carrier_delegation.lends') }}</div>
      </template>
      <template #cell.environment="{ item }">
        <v-chip
          size="x-small"
          :color="(item as AirCarrierDelegation).environment === 'production' ? 'warning' : 'info'"
          variant="flat"
        >
          {{ (item as AirCarrierDelegation).environment }}
        </v-chip>
      </template>
      <template #cell.actions="{ item }">
        <div class="cm-actions-right">
          <v-btn size="small" variant="text" :prepend-icon="mdiPencil" @click="openEdit(item as AirCarrierDelegation)">
            {{ t('common.edit') }}
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            color="error"
            :prepend-icon="mdiDelete"
            @click="openDelete(item as AirCarrierDelegation)"
          >
            {{ t('common.delete') }}
          </v-btn>
        </div>
      </template>
    </ListingDataView>
    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-2" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <v-dialog v-model="formDialog" max-width="640" persistent>
      <v-card>
        <v-card-title>
          {{ formMode === 'create' ? t('air_carrier_delegation.dialog_create') : t('air_carrier_delegation.dialog_edit') }}
        </v-card-title>
        <v-card-text>
          <div class="cm-grid">
            <v-select
              v-model="form.carrier_code"
              :items="carrierItems"
              :label="t('air_carrier_delegation.form_carrier')"
            />
            <v-select
              v-model="form.environment"
              :items="envItems"
              :label="t('air_carrier_delegation.form_environment')"
            />
          </div>
          <CmAnagraficaAutocomplete
            v-model="form.delegated_partner"
            :label="t('air_carrier_delegation.form_delegated')"
            :hint="t('air_carrier_delegation.form_delegated_hint')"
            persistent-hint
            class="mt-3"
          />
          <CmAnagraficaAutocomplete
            v-model="form.credential_partner"
            :label="t('air_carrier_delegation.form_credential')"
            :hint="t('air_carrier_delegation.form_credential_hint')"
            persistent-hint
            class="mt-3"
          />
          <CmCountrySelect
            v-model="form.origin_country_iso"
            :label="t('air_carrier_delegation.form_origin')"
            class="mt-3"
          />
          <div class="cm-cell-hint mb-2">{{ t('air_carrier_delegation.form_origin_hint') }}</div>
          <v-text-field
            v-model="form.description"
            :label="t('air_carrier_delegation.form_description')"
            maxlength="255"
            class="mt-3"
          />
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
 * Delegación de carrier aéreo genérica — Fase A-bis del plan de
 * deprecación de `admin_config` (docs/plan-deprecacion-admin-config.md).
 * Portado desde
 * `admin_config/src/features/air_carrier_delegation/AirCarrierDelegationPage.vue`.
 */
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiPlus, mdiPencil, mdiDelete, mdiAirplane } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import ListingDataView from '../../listing/ListingDataView.vue';
import { useClientSideListSource } from '../../listing/useClientSideListSource';
import type { DataTableHeader } from '../../listing/types';
import CmAnagraficaAutocomplete from '../../listini/components/CmAnagraficaAutocomplete.vue';
import CmCountrySelect from '../../anagrafiche/components/CmCountrySelect.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import {
  airCarrierDelegationService,
  type AirCarrierDelegation,
  type AirCarrierDelegationPayload,
  type AirCarrierDelegationFilters,
} from '../services/airCarrierDelegation.service';

/** Códigos de integración de carrier aéreo conocidos. */
const carrierItems = ['klm', 'lufthansa', 'ba', 'af'];

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const items = ref<AirCarrierDelegation[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const selected = ref<{ id: number }[]>([]);

const listSource = useClientSideListSource(items, { loading });
const tableHeaders: DataTableHeader[] = [
  { title: t('air_carrier_delegation.col_carrier') as string, key: 'carrier_code' },
  { title: t('air_carrier_delegation.col_origin') as string, key: 'origin_country_iso' },
  { title: t('air_carrier_delegation.col_delegated') as string, key: 'delegated_partner', sortable: false },
  { title: t('air_carrier_delegation.col_credential') as string, key: 'credential_partner', sortable: false },
  { title: t('air_carrier_delegation.col_environment') as string, key: 'environment' },
  { title: t('air_carrier_delegation.col_actions') as string, key: 'actions', sortable: false, align: 'end' },
];
const sortKeyMap: Record<string, string> = {
  carrier_code: 'carrier_code', origin_country_iso: 'origin_country_iso', environment: 'environment',
};

const filters = reactive<AirCarrierDelegationFilters>({
  carrier_code: '',
  origin_country_iso: '',
});

const envItems = ['sandbox', 'production'];

const formDialog = ref(false);
const formMode = ref<'create' | 'edit'>('create');
interface FormState {
  id?: number;
  carrier_code: string;
  delegated_partner: number | null;
  credential_partner: number | null;
  origin_country_iso: string;
  environment: string;
  description: string;
}

const form = reactive<FormState>({
  carrier_code: '',
  delegated_partner: null,
  credential_partner: null,
  origin_country_iso: '',
  environment: 'sandbox',
  description: '',
});

const formValid = computed(
  () =>
    form.carrier_code.trim().length > 0 &&
    !!form.delegated_partner &&
    !!form.credential_partner &&
    form.delegated_partner !== form.credential_partner &&
    form.origin_country_iso.trim().length === 2 &&
    envItems.includes(form.environment),
);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    items.value = await airCarrierDelegationService.list({
      carrier_code: filters.carrier_code ? filters.carrier_code.toLowerCase() : undefined,
      origin_country_iso: filters.origin_country_iso ? filters.origin_country_iso.toUpperCase() : undefined,
    });
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function resetForm(): void {
  form.id = undefined;
  form.carrier_code = '';
  form.delegated_partner = null;
  form.credential_partner = null;
  form.origin_country_iso = '';
  form.environment = 'sandbox';
  form.description = '';
}

function openCreate(): void {
  formMode.value = 'create';
  resetForm();
  formDialog.value = true;
}

function openEdit(item: AirCarrierDelegation): void {
  formMode.value = 'edit';
  form.id = item.id;
  form.carrier_code = item.carrier_code;
  form.delegated_partner = item.delegated_partner;
  form.credential_partner = item.credential_partner;
  form.origin_country_iso = item.origin_country_iso;
  form.environment = item.environment;
  form.description = (item.description as string) || '';
  formDialog.value = true;
}

async function save(): Promise<void> {
  saving.value = true;
  try {
    const payload: AirCarrierDelegationPayload = {
      id: form.id,
      carrier_code: form.carrier_code.trim().toLowerCase(),
      delegated_partner: form.delegated_partner as number,
      credential_partner: form.credential_partner as number,
      origin_country_iso: form.origin_country_iso.toUpperCase(),
      environment: form.environment,
      description: form.description.trim(),
    };
    if (formMode.value === 'create') {
      await airCarrierDelegationService.create(payload);
      toast.success(t('air_carrier_delegation.created'));
    } else {
      await airCarrierDelegationService.update(payload);
      toast.success(t('air_carrier_delegation.updated'));
    }
    formDialog.value = false;
    await load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

async function openDelete(item: AirCarrierDelegation): Promise<void> {
  const ok = await confirm.askDanger(
    t('air_carrier_delegation.confirm_delete_message', {
      name: item.delegated_partner_name || '#' + item.delegated_partner,
    }),
    t('air_carrier_delegation.confirm_delete_title'),
  );
  if (!ok) return;
  try {
    await airCarrierDelegationService.remove(item.id);
    toast.success(t('air_carrier_delegation.deleted'));
    await load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(() => {
  void load();
});
</script>
