<template>
  <div>
    <v-alert type="info" variant="tonal" density="compact" class="mb-4">
      {{ t('service_credentials.partner_tab_hint') }}
    </v-alert>

    <div class="d-flex justify-end mb-3">
      <v-btn color="primary" :prepend-icon="mdiPlus" @click="openCreate">
        {{ t('service_credentials.new_credential') }}
      </v-btn>
    </div>

    <CmEmptyState
      v-if="!loading && !error && items.length === 0"
      :icon="mdiCertificate"
      :title="t('service_credentials.empty_title')"
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
      <template #cell.courier_code="{ item }">
        <v-chip size="small" class="cm-tone-neutral">{{ (item as ServiceCredential).courier_code }}</v-chip>
      </template>
      <template #cell.environment="{ item }">
        <v-chip size="small" :class="(item as ServiceCredential).environment === 'production' ? 'cm-tone-danger' : 'cm-tone-info'">
          {{ (item as ServiceCredential).environment }}
        </v-chip>
      </template>
      <template #cell.account_number="{ item }">
        <span class="cm-mono">{{ (item as ServiceCredential).account_number || '—' }}</span>
      </template>
      <template #cell.auth_username="{ item }">
        {{ (item as ServiceCredential).auth_username || (item as ServiceCredential).oauth_client_id || '—' }}
      </template>
      <template #cell.description="{ item }">
        <span class="text-truncate d-inline-block" style="max-width: 220px">
          {{ (item as ServiceCredential).description || '—' }}
        </span>
      </template>
      <template #cell.actions="{ item }">
        <div class="cm-actions-right">
          <v-btn size="small" variant="text" :prepend-icon="mdiPencil" @click="openEdit(item as ServiceCredential)">
            {{ t('common.edit') }}
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            color="error"
            :prepend-icon="mdiDelete"
            @click="openDelete(item as ServiceCredential)"
          >
            {{ t('common.delete') }}
          </v-btn>
        </div>
      </template>
    </ListingDataView>
    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-2" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <v-dialog v-model="formDialog" max-width="780" persistent>
      <v-card>
        <v-card-title>
          {{ formMode === 'create' ? t('service_credentials.dialog_create') : t('service_credentials.dialog_edit') }}
        </v-card-title>
        <v-card-text>
          <div class="cm-grid">
            <v-select
              v-model="form.courier_code"
              :label="t('service_credentials.form_courier')"
              :items="courierOptions"
              :disabled="formMode === 'edit'"
              :rules="[(v) => !!v || t('common.required')]"
            />
            <v-select
              v-model="form.environment"
              :label="t('service_credentials.form_environment')"
              :items="envOptions"
              :rules="[(v) => !!v || t('common.required')]"
            />
            <v-text-field
              v-model="form.account_number"
              :label="t('service_credentials.form_account_number')"
            />
            <v-text-field
              v-model="form.auth_username"
              :label="t('service_credentials.form_auth_username')"
            />
            <v-text-field
              v-model="form.auth_password"
              :label="t('service_credentials.form_auth_password')"
              type="password"
              :placeholder="formMode === 'edit' ? t('service_credentials.placeholder_unchanged') : ''"
              autocomplete="new-password"
            />
            <v-text-field
              v-model="form.oauth_client_id"
              :label="t('service_credentials.form_oauth_client_id')"
            />
            <v-text-field
              v-model="form.oauth_client_secret"
              :label="t('service_credentials.form_oauth_client_secret')"
              type="password"
              :placeholder="formMode === 'edit' ? t('service_credentials.placeholder_unchanged') : ''"
              autocomplete="new-password"
            />
            <v-text-field
              v-model="form.api_key"
              :label="t('service_credentials.form_api_key')"
              type="password"
              :placeholder="formMode === 'edit' ? t('service_credentials.placeholder_unchanged') : ''"
              autocomplete="new-password"
            />
            <v-text-field
              v-model="form.customer_code"
              :label="t('service_credentials.form_customer_code')"
            />
            <v-text-field
              v-model="form.country_iso"
              :label="t('service_credentials.form_country_iso')"
              maxlength="2"
            />
            <v-text-field
              v-model="form.postal_code"
              :label="t('service_credentials.form_postal_code')"
            />
            <v-text-field
              v-model="form.currency"
              :label="t('service_credentials.form_currency')"
              maxlength="3"
            />
          </div>
          <v-textarea
            v-model="form.description"
            :label="t('service_credentials.form_description')"
            rows="2"
            class="mt-2"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving" @click="formDialog = false">
            {{ t('common.cancel') }}
          </v-btn>
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
 * Tab de credenciales de courier genérico (DHL, TNT, UPS, FedEx, Agora,
 * TACT) dentro de la ficha de anagrafica. Variante embebida y fijada al
 * partner del CRUD admin de admin_config (CredentialsPage.vue, V1): mismo
 * backend (api_admin_service_credentials), lista solo lo propio de este
 * partner (`id_partner`) y crea/edita siempre con ese id fijo — sin
 * selector.
 *
 * KLM y WebCargo NO se ofrecen aquí (mismo criterio que CredentialsPage.vue):
 * tienen sus propios sistemas (air_carrier_credentials, webcargo_key, con
 * sus propios tabs en esta misma ficha) — una fila KLM/WebCargo creada aquí
 * quedaría muerta, ningún flujo la lee.
 */
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiPlus, mdiPencil, mdiDelete, mdiCertificate } from '@mdi/js';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import ListingDataView from '../../listing/ListingDataView.vue';
import { useClientSideListSource } from '../../listing/useClientSideListSource';
import type { DataTableHeader } from '../../listing/types';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import {
  serviceCredentialsService,
  type ServiceCredential,
  type ServiceCredentialPayload,
} from '../services/serviceCredentials.service';

const props = defineProps<{
  idAnagrafica: number;
}>();
const emit = defineEmits<{ refresh: [] }>();

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const items = ref<ServiceCredential[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const selected = ref<{ id: number }[]>([]);

const listSource = useClientSideListSource(items, { loading });
const tableHeaders: DataTableHeader[] = [
  { title: t('service_credentials.col_courier') as string, key: 'courier_code' },
  { title: t('service_credentials.col_environment') as string, key: 'environment' },
  { title: t('service_credentials.col_account') as string, key: 'account_number' },
  { title: t('service_credentials.col_username') as string, key: 'auth_username', sortable: false },
  { title: t('service_credentials.col_description') as string, key: 'description', sortable: false },
  { title: t('service_credentials.col_actions') as string, key: 'actions', sortable: false, align: 'end' },
];
const sortKeyMap: Record<string, string> = {
  courier_code: 'courier_code', environment: 'environment', account_number: 'account_number',
};

// KLM/WebCargo excluidos a propósito — ver docblock arriba.
const courierOptions = ['dhl', 'dpd', 'tnt', 'ups', 'fedex', 'agora', 'tact'];
const envOptions = [
  { title: 'production', value: 'production' },
  { title: 'sandbox', value: 'sandbox' },
];

const formDialog = ref(false);
const formMode = ref<'create' | 'edit'>('create');
const form = reactive<ServiceCredentialPayload>({
  courier_code: '',
  environment: 'production',
  account_number: '',
  auth_username: '',
  auth_password: '',
  oauth_client_id: '',
  oauth_client_secret: '',
  api_key: '',
  customer_code: '',
  country_iso: '',
  postal_code: '',
  currency: '',
  description: '',
});

const formValid = computed(() => !!form.courier_code && !!form.environment);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    items.value = await serviceCredentialsService.list({ id_partner: props.idAnagrafica });
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function resetForm(): void {
  form.id = undefined;
  form.courier_code = '';
  form.environment = 'production';
  form.account_number = '';
  form.auth_username = '';
  form.auth_password = '';
  form.oauth_client_id = '';
  form.oauth_client_secret = '';
  form.api_key = '';
  form.customer_code = '';
  form.country_iso = '';
  form.postal_code = '';
  form.currency = '';
  form.description = '';
}

function openCreate(): void {
  formMode.value = 'create';
  resetForm();
  formDialog.value = true;
}

function openEdit(item: ServiceCredential): void {
  formMode.value = 'edit';
  form.id = item.id;
  form.courier_code = item.courier_code;
  form.environment = item.environment;
  form.account_number = item.account_number || '';
  form.auth_username = item.auth_username || '';
  form.auth_password = '';
  form.oauth_client_id = item.oauth_client_id || '';
  form.oauth_client_secret = '';
  form.api_key = '';
  form.customer_code = item.customer_code || '';
  form.country_iso = item.country_iso || '';
  form.postal_code = item.postal_code || '';
  form.currency = item.currency || '';
  form.description = item.description || '';
  formDialog.value = true;
}

async function save(): Promise<void> {
  saving.value = true;
  try {
    const payload: ServiceCredentialPayload = { ...form, id_partner: props.idAnagrafica };
    if (formMode.value === 'edit') {
      if (!payload.auth_password) delete payload.auth_password;
      if (!payload.oauth_client_secret) delete payload.oauth_client_secret;
      if (!payload.api_key) delete payload.api_key;
      await serviceCredentialsService.update(payload);
      toast.success(t('service_credentials.updated'));
    } else {
      await serviceCredentialsService.create(payload);
      toast.success(t('service_credentials.created'));
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

async function openDelete(item: ServiceCredential): Promise<void> {
  const ok = await confirm.askDanger(
    t('service_credentials.confirm_delete_message', { courier: item.courier_code }),
    t('service_credentials.confirm_delete_title'),
  );
  if (!ok) return;
  try {
    await serviceCredentialsService.remove(item.id);
    toast.success(t('service_credentials.deleted'));
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
