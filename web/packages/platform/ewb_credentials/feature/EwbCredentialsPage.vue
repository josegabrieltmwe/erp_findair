<template>
  <div>
    <CmSectionHeader
      :title="t('ewb_credentials.title')"
      :subtitle="t('ewb_credentials.subtitle')"
    >
      <template #actions>
        <v-btn color="primary" :prepend-icon="mdiPlus" @click="openCreate">
          {{ t('ewb_credentials.new_credential') }}
        </v-btn>
      </template>
    </CmSectionHeader>

    <v-card class="pa-4 mb-4" variant="outlined">
      <div class="cm-filters">
        <v-text-field
          v-model="filterCountry"
          :label="t('ewb_credentials.filter_country')"
          maxlength="2"
          density="compact"
          hide-details
          clearable
          @update:model-value="load"
        />
      </div>
    </v-card>

    <CmEmptyState
      v-if="!loading && !error && items.length === 0"
      :icon="mdiAirplane"
      :title="t('ewb_credentials.empty_title')"
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
        <v-chip size="small" class="cm-tone-neutral">{{ (item as EwbCredential).country_iso }}</v-chip>
      </template>
      <template #cell.partner_name="{ item }">
        <div>
          {{ (item as EwbCredential).partner_name
            || ((item as EwbCredential).partner_id ? `#${(item as EwbCredential).partner_id}` : t('ewb_credentials.shared')) }}
        </div>
        <div v-if="(item as EwbCredential).partner_id" class="cm-cell-hint">#{{ (item as EwbCredential).partner_id }}</div>
      </template>
      <template #cell.has_key="{ item }">
        <v-chip size="x-small" :color="(item as EwbCredential).has_key ? 'success' : undefined" variant="flat">
          {{ (item as EwbCredential).has_key ? t('ewb_credentials.key_set') : t('ewb_credentials.key_none') }}
        </v-chip>
      </template>
      <template #cell.auth="{ item }">
        <span class="cm-mono">
          {{ ((item as EwbCredential).auth_prefix || '') + ((item as EwbCredential).auth_header || 'Authorization') }}
        </span>
      </template>
      <template #cell.actions="{ item }">
        <div class="cm-actions-right">
          <v-btn size="small" variant="text" :prepend-icon="mdiPencil" @click="openEdit(item as EwbCredential)">
            {{ t('common.edit') }}
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            color="error"
            :prepend-icon="mdiDelete"
            @click="openDelete(item as EwbCredential)"
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
          {{ formMode === 'create' ? t('ewb_credentials.dialog_create') : t('ewb_credentials.dialog_edit') }}
        </v-card-title>
        <v-card-text>
          <div class="cm-grid">
            <v-text-field
              v-model="form.country_iso"
              :label="t('ewb_credentials.form_country_iso')"
              maxlength="2"
            />
            <CmAnagraficaAutocomplete
              v-model="form.partner_id"
              :label="t('ewb_credentials.form_partner')"
              clearable
            />
          </div>
          <v-text-field
            v-model="form.api_key"
            :label="t('ewb_credentials.form_api_key')"
            :placeholder="formMode === 'edit' ? t('ewb_credentials.secret_unchanged_hint') : ''"
            type="password"
            autocomplete="new-password"
            maxlength="255"
            class="mt-3"
          />
          <v-text-field
            v-model="form.api_secret"
            :label="t('ewb_credentials.form_api_secret')"
            :placeholder="formMode === 'edit' ? t('ewb_credentials.secret_unchanged_hint') : ''"
            type="password"
            autocomplete="new-password"
            maxlength="255"
            class="mt-3"
          />
          <div class="cm-grid mt-3">
            <v-text-field
              v-model="form.auth_header"
              :label="t('ewb_credentials.form_auth_header')"
              :placeholder="'Authorization'"
              maxlength="40"
            />
            <v-text-field
              v-model="form.auth_prefix"
              :label="t('ewb_credentials.form_auth_prefix')"
              :placeholder="'Bearer '"
              maxlength="20"
            />
          </div>
          <v-text-field
            v-model="form.description"
            :label="t('ewb_credentials.form_description')"
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
 * Credenciales e-AWB/CargoStart — Fase A-bis del plan de deprecación de
 * `admin_config` (docs/plan-deprecacion-admin-config.md). Portado desde
 * `admin_config/src/features/ewb_credentials/EwbCredentialsPage.vue`.
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
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import {
  ewbCredentialsService,
  type EwbCredential,
  type EwbCredentialPayload,
} from '../services/ewbCredentials.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const items = ref<EwbCredential[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const filterCountry = ref<string>('');
const selected = ref<{ id: number }[]>([]);

const listSource = useClientSideListSource(items, { loading });
const tableHeaders: DataTableHeader[] = [
  { title: t('ewb_credentials.col_country') as string, key: 'country_iso' },
  { title: t('ewb_credentials.col_partner') as string, key: 'partner_name' },
  { title: t('ewb_credentials.col_key') as string, key: 'has_key', sortable: false },
  { title: t('ewb_credentials.col_auth') as string, key: 'auth', sortable: false },
  { title: t('ewb_credentials.col_actions') as string, key: 'actions', sortable: false, align: 'end' },
];
const sortKeyMap: Record<string, string> = { country_iso: 'country_iso', partner_name: 'partner_name' };

const formDialog = ref(false);
const formMode = ref<'create' | 'edit'>('create');
interface FormState {
  id?: number;
  country_iso: string;
  partner_id: number | null;
  api_key: string;
  api_secret: string;
  auth_header: string;
  auth_prefix: string;
  description: string;
}

const form = reactive<FormState>({
  country_iso: '',
  partner_id: null,
  api_key: '',
  api_secret: '',
  auth_header: '',
  auth_prefix: '',
  description: '',
});

const formValid = computed(
  () =>
    form.country_iso.trim().length === 2 &&
    // En create la api_key es obligatoria; en edit vacío significa "mantener la guardada".
    (formMode.value === 'edit' || !!form.api_key.trim()),
);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    items.value = await ewbCredentialsService.list(
      filterCountry.value ? filterCountry.value.toUpperCase() : undefined,
    );
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function resetForm(): void {
  form.id = undefined;
  form.country_iso = '';
  form.partner_id = null;
  form.api_key = '';
  form.api_secret = '';
  form.auth_header = '';
  form.auth_prefix = '';
  form.description = '';
}

function openCreate(): void {
  formMode.value = 'create';
  resetForm();
  formDialog.value = true;
}

function openEdit(item: EwbCredential): void {
  formMode.value = 'edit';
  form.id = item.id;
  form.country_iso = item.country_iso;
  form.partner_id = item.partner_id;
  form.api_key = ''; // nunca se precarga — vacío = mantener key guardada
  form.api_secret = '';
  form.auth_header = (item.auth_header as string) || '';
  form.auth_prefix = (item.auth_prefix as string) || '';
  form.description = (item.description as string) || '';
  formDialog.value = true;
}

async function save(): Promise<void> {
  saving.value = true;
  try {
    const payload: EwbCredentialPayload = {
      id: form.id,
      country_iso: form.country_iso.toUpperCase(),
      partner_id: form.partner_id,
      auth_header: form.auth_header.trim(),
      auth_prefix: form.auth_prefix,
      description: form.description.trim(),
    };
    // Solo envía secretos cuando el usuario los escribió (vacío = sin cambios en edit).
    if (form.api_key.trim()) payload.api_key = form.api_key.trim();
    if (form.api_secret.trim()) payload.api_secret = form.api_secret.trim();

    if (formMode.value === 'create') {
      await ewbCredentialsService.create(payload);
      toast.success(t('ewb_credentials.created'));
    } else {
      await ewbCredentialsService.update(payload);
      toast.success(t('ewb_credentials.updated'));
    }
    formDialog.value = false;
    await load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

async function openDelete(item: EwbCredential): Promise<void> {
  const ok = await confirm.askDanger(
    t('ewb_credentials.confirm_delete_message', {
      name: item.partner_name || (item.partner_id ? '#' + item.partner_id : item.country_iso),
    }),
    t('ewb_credentials.confirm_delete_title'),
  );
  if (!ok) return;
  try {
    await ewbCredentialsService.remove(item.id);
    toast.success(t('ewb_credentials.deleted'));
    await load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(() => {
  void load();
});
</script>
