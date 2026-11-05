<template>
  <div>
    <v-alert type="info" variant="tonal" density="compact" class="mb-4">
      {{ t('service_credentials.partner_tab_hint') }}
    </v-alert>

    <v-btn-toggle
      v-if="isAdmin"
      v-model="scope"
      mandatory
      density="compact"
      color="primary"
      variant="outlined"
      divided
      class="mb-3"
    >
      <v-btn value="partner">{{ t('service_credentials.scope_partner') }}</v-btn>
      <v-btn value="house">{{ t('service_credentials.scope_house') }}</v-btn>
    </v-btn-toggle>
    <v-alert v-if="scope === 'house'" type="warning" variant="tonal" density="compact" class="mb-4">
      {{ t('service_credentials.house_hint') }}
    </v-alert>

    <v-card v-if="scope === 'partner'" variant="outlined" class="mb-4">
      <v-card-text class="d-flex align-center flex-wrap ga-3">
        <div class="flex-grow-1">
          <div class="text-subtitle-2">{{ t('service_credentials.agora_env_title') }}</div>
          <div class="text-caption">{{ t('service_credentials.agora_env_hint') }}</div>
        </div>
        <v-chip :color="agoraEnv === 'production' ? 'warning' : 'info'" variant="flat" size="small">
          {{ agoraEnv === 'production' ? t('service_credentials.agora_env_production') : t('service_credentials.agora_env_sandbox') }}
        </v-chip>
        <v-btn
          v-if="agoraEnv !== 'production'"
          size="small"
          color="warning"
          variant="tonal"
          :loading="agoraEnvSaving"
          @click="setAgoraEnv('production')"
        >
          {{ t('service_credentials.agora_env_to_production') }}
        </v-btn>
        <v-btn v-else size="small" variant="tonal" :loading="agoraEnvSaving" @click="setAgoraEnv('sandbox')">
          {{ t('service_credentials.agora_env_to_sandbox') }}
        </v-btn>
      </v-card-text>
    </v-card>

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
            <template v-if="isAsl">
              <v-text-field
                v-model="form.customer_code"
                :label="t('service_credentials.form_asl_company')"
                :rules="[(v) => !!v || t('common.required')]"
              />
              <v-text-field
                v-model="form.oauth_client_id"
                :label="t('service_credentials.form_asl_username')"
                :rules="[(v) => !!v || t('common.required')]"
                autocomplete="off"
              />
              <v-text-field
                v-model="form.oauth_client_secret"
                :label="t('service_credentials.form_asl_password')"
                type="password"
                :placeholder="formMode === 'edit' ? t('service_credentials.placeholder_unchanged') : ''"
                :rules="formMode === 'edit' ? [] : [(v) => !!v || t('common.required')]"
                autocomplete="new-password"
              />
              <v-alert type="info" variant="tonal" density="compact" class="cm-asl-hint" style="grid-column: 1 / -1">
                {{ t('service_credentials.asl_hint') }}
              </v-alert>
            </template>
            <template v-else>
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
            </template>
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
 * TACT, ASL) dentro de la ficha de anagrafica. Variante embebida y fijada al
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
import { useListiniAdmin } from '../../listini/composables/useListiniAdmin';
import {
  partnerCarrierEnvironmentService,
  type PartnerCarrierEnvironment,
} from '../../air_carrier_credentials/services/partnerCarrierEnvironment.service';
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
const { isAdmin } = useListiniAdmin();

// 'house' = credenciales compartidas sin titular (id_partner 0), solo TMWE. El resto de la pestaña
// trabaja siempre sobre la anagrafica abierta.
const scope = ref<'partner' | 'house'>('partner');
const ownerId = computed(() => (scope.value === 'house' ? 0 : props.idAnagrafica));

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
const courierOptions = ['dhl', 'dpd', 'tnt', 'ups', 'fedex', 'agora', 'tact', 'asl'];
const allEnvOptions = [
  { title: 'production', value: 'production' },
  { title: 'sandbox', value: 'sandbox' },
];

// ASL (publicación de tarifas marítimas) no tiene entorno de pruebas y guarda empresa, usuario y
// contraseña en customer_code, oauth_client_id y oauth_client_secret (el backend lo exige: Asl_Credential_Rules).
const isAsl = computed(() => form.courier_code === 'asl');
const envOptions = computed(() => (isAsl.value ? allEnvOptions.filter((o) => o.value === 'production') : allEnvOptions));

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

const formValid = computed(() => {
  if (!form.courier_code || !form.environment) return false;
  if (!isAsl.value) return true;
  const hasSecret = formMode.value === 'edit' || !!form.oauth_client_secret;
  return form.environment === 'production' && !!form.customer_code?.trim() && !!form.oauth_client_id?.trim() && hasSecret;
});

// Al elegir ASL el entorno pasa a production (no existe otro).
watch(isAsl, (asl) => {
  if (asl) form.environment = 'production';
});

// Entorno de Agora de este partner (partner_carrier_environment, carrier 'agora'); sin fila = sandbox.
// El backend solo deja pasar a production si existe una credencial de producción utilizable
// (propia, de la casa o global) y devuelve el motivo si no.
const AGORA_CARRIER = 'agora';
const agoraEnvRow = ref<PartnerCarrierEnvironment | null>(null);
const agoraEnvSaving = ref(false);
const agoraEnv = computed(() => agoraEnvRow.value?.environment ?? 'sandbox');

async function loadAgoraEnv(): Promise<void> {
  try {
    const rows = await partnerCarrierEnvironmentService.list({ partner_id: props.idAnagrafica, carrier_code: AGORA_CARRIER });
    agoraEnvRow.value = rows[0] ?? null;
  } catch (e) {
    // No bloquea la pestaña: se muestra el valor por defecto y el error sale al intentar guardar.
    agoraEnvRow.value = null;
  }
}

async function setAgoraEnv(next: 'production' | 'sandbox'): Promise<void> {
  agoraEnvSaving.value = true;
  try {
    const payload = { partner_id: props.idAnagrafica, carrier_code: AGORA_CARRIER, environment: next };
    if (agoraEnvRow.value) {
      await partnerCarrierEnvironmentService.update({ id: agoraEnvRow.value.id, ...payload });
    } else {
      await partnerCarrierEnvironmentService.create(payload);
    }
    toast.success(next === 'production' ? t('service_credentials.agora_env_switched_production') : t('service_credentials.agora_env_switched_sandbox'));
    await loadAgoraEnv();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    agoraEnvSaving.value = false;
  }
}

watch(scope, () => {
  void load();
});

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    items.value = await serviceCredentialsService.list(scope.value === 'house' ? { house: true } : { id_partner: props.idAnagrafica });
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
    const payload: ServiceCredentialPayload = { ...form, id_partner: ownerId.value };
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

watch(() => props.idAnagrafica, () => {
  void load();
  void loadAgoraEnv();
});
onMounted(() => {
  void load();
  void loadAgoraEnv();
});
</script>
