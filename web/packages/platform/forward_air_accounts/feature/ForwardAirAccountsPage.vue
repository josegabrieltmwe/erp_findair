<template>
  <div>
    <CmSectionHeader
      :title="t('forward_air_accounts.title')"
      :subtitle="t('forward_air_accounts.subtitle')"
    >
      <template #actions>
        <v-btn color="primary" :prepend-icon="mdiPlus" @click="openCreate">
          {{ t('forward_air_accounts.new_account') }}
        </v-btn>
      </template>
    </CmSectionHeader>

    <v-card class="pa-4 mb-4" variant="outlined">
      <div class="cm-filters">
        <CmAnagraficaAutocomplete
          v-model="filterPartner"
          :label="t('forward_air_accounts.filter_partner')"
          clearable
          @update:model-value="load"
        />
        <v-select
          v-model="filterEnvironment"
          :items="environmentItems"
          :label="t('forward_air_accounts.filter_environment')"
          density="compact"
          hide-details
          clearable
          @update:model-value="load"
        />
      </div>
    </v-card>

    <CmEmptyState
      v-if="!loading && !error && items.length === 0"
      :icon="mdiTruckFast"
      :title="t('forward_air_accounts.empty_title')"
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
      <template #cell.partner_name="{ item }">
        <div>{{ (item as ForwardAirAccount).partner_name || `#${(item as ForwardAirAccount).partner_id}` }}</div>
        <div class="cm-cell-hint">#{{ (item as ForwardAirAccount).partner_id }}</div>
      </template>
      <template #cell.account_alias="{ item }">
        <span class="font-weight-medium">{{ (item as ForwardAirAccount).account_alias }}</span>
        <v-chip
          v-if="(item as ForwardAirAccount).principale === 'S'"
          size="x-small"
          color="primary"
          variant="flat"
          class="ml-2"
        >
          {{ t('forward_air_accounts.principal') }}
        </v-chip>
      </template>
      <template #cell.environment="{ item }">
        <v-chip
          size="small"
          :color="(item as ForwardAirAccount).environment === 'production' ? 'warning' : undefined"
          variant="flat"
        >
          {{ t(`forward_air_accounts.env_${(item as ForwardAirAccount).environment}`) }}
        </v-chip>
      </template>
      <template #cell.ids="{ item }">
        <div v-if="(item as ForwardAirAccount).customer_id" class="cm-mono">
          {{ t('forward_air_accounts.customer_id_short') }} {{ (item as ForwardAirAccount).customer_id }}
        </div>
        <div v-if="(item as ForwardAirAccount).bill_to_account" class="cm-mono">
          {{ t('forward_air_accounts.bill_to_short') }} {{ (item as ForwardAirAccount).bill_to_account }}
        </div>
      </template>
      <template #cell.authorization="{ item }">
        <v-chip size="small" :color="authColor(item as ForwardAirAccount)" variant="flat">
          {{ authLabel(item as ForwardAirAccount) }}
        </v-chip>
        <div v-if="(item as ForwardAirAccount).authorization_expires_at" class="cm-cell-hint">
          {{ t('forward_air_accounts.expires_on', { date: (item as ForwardAirAccount).authorization_expires_at }) }}
        </div>
      </template>
      <template #cell.last_verified_at="{ item }">
        <span class="cm-cell-hint">{{ (item as ForwardAirAccount).last_verified_at || t('forward_air_accounts.never') }}</span>
      </template>
      <template #cell.actions="{ item }">
        <div class="cm-actions-right">
          <v-btn size="small" variant="text" :prepend-icon="mdiCheckNetwork" :loading="verifyingId === (item as ForwardAirAccount).id" @click="runVerify(item as ForwardAirAccount)">
            {{ t('forward_air_accounts.verify') }}
          </v-btn>
          <v-btn size="small" variant="text" :prepend-icon="mdiFileCertificate" @click="openAuthorization(item as ForwardAirAccount)">
            {{ t('forward_air_accounts.authorization') }}
          </v-btn>
          <v-btn
            v-if="(item as ForwardAirAccount).principale !== 'S'"
            size="small"
            variant="text"
            :prepend-icon="mdiStar"
            @click="makePrincipal(item as ForwardAirAccount)"
          >
            {{ t('forward_air_accounts.make_principal') }}
          </v-btn>
          <v-btn size="small" variant="text" :prepend-icon="mdiPencil" @click="openEdit(item as ForwardAirAccount)">
            {{ t('common.edit') }}
          </v-btn>
          <v-btn size="small" variant="text" color="error" :prepend-icon="mdiDelete" @click="openDelete(item as ForwardAirAccount)">
            {{ t('common.delete') }}
          </v-btn>
        </div>
      </template>
    </ListingDataView>
    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-2" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <!-- Alta / edición -->
    <v-dialog v-model="formDialog" max-width="680" persistent>
      <v-card>
        <v-card-title>
          {{ formMode === 'create' ? t('forward_air_accounts.dialog_create') : t('forward_air_accounts.dialog_edit') }}
        </v-card-title>
        <v-card-text>
          <div class="cm-grid">
            <CmAnagraficaAutocomplete
              v-model="form.partner_id"
              :label="t('forward_air_accounts.form_partner')"
              :disabled="formMode === 'edit'"
            />
            <v-select
              v-model="form.environment"
              :items="environmentItems"
              :label="t('forward_air_accounts.form_environment')"
              :disabled="formMode === 'edit'"
            />
          </div>
          <v-text-field
            v-model="form.account_alias"
            :label="t('forward_air_accounts.form_alias')"
            :hint="t('forward_air_accounts.form_alias_hint')"
            persistent-hint
            maxlength="64"
            class="mt-3"
          />
          <div class="cm-grid mt-3">
            <v-text-field
              v-model="form.api_user"
              :label="t('forward_air_accounts.form_api_user')"
              :placeholder="formMode === 'edit' ? t('forward_air_accounts.secret_unchanged_hint') : ''"
              autocomplete="off"
              maxlength="255"
            />
            <v-text-field
              v-model="form.api_password"
              :label="t('forward_air_accounts.form_api_password')"
              :placeholder="formMode === 'edit' ? t('forward_air_accounts.secret_unchanged_hint') : ''"
              type="password"
              autocomplete="new-password"
              maxlength="255"
            />
          </div>
          <div class="cm-grid mt-3">
            <v-text-field
              v-model="form.customer_id"
              :label="t('forward_air_accounts.form_customer_id')"
              maxlength="32"
            />
            <v-text-field
              v-model="form.bill_to_account"
              :label="t('forward_air_accounts.form_bill_to')"
              :hint="t('forward_air_accounts.form_bill_to_hint')"
              persistent-hint
              maxlength="7"
            />
          </div>
          <v-text-field
            v-model="form.description"
            :label="t('forward_air_accounts.form_description')"
            maxlength="255"
            class="mt-3"
          />
          <v-checkbox
            v-if="formMode === 'create'"
            v-model="form.principal"
            :label="t('forward_air_accounts.form_principal')"
            density="compact"
            hide-details
          />
          <v-alert v-if="formMode === 'create' && form.environment === 'production'" type="info" variant="tonal" density="compact" class="mt-2">
            {{ t('forward_air_accounts.production_pending_hint') }}
          </v-alert>
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

    <!-- Carta de autorización -->
    <v-dialog v-model="authDialog" max-width="520" persistent>
      <v-card>
        <v-card-title>{{ t('forward_air_accounts.dialog_authorization') }}</v-card-title>
        <v-card-text>
          <p class="mb-3">{{ t('forward_air_accounts.authorization_hint') }}</p>
          <v-select
            v-model="authForm.authorization_status"
            :items="authStatusItems"
            :label="t('forward_air_accounts.auth_status')"
          />
          <v-text-field
            v-model="authForm.authorization_ref"
            :label="t('forward_air_accounts.auth_ref')"
            maxlength="128"
            class="mt-3"
          />
          <div class="cm-grid mt-3">
            <v-text-field
              v-model="authForm.authorization_received_at"
              :label="t('forward_air_accounts.auth_received_at')"
              type="date"
            />
            <v-text-field
              v-model="authForm.authorization_expires_at"
              :label="t('forward_air_accounts.auth_expires_at')"
              type="date"
            />
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving" @click="authDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" :loading="saving" :disabled="!authValid" @click="saveAuthorization">
            {{ t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Resultado de la verificación -->
    <v-dialog v-model="verifyDialog" max-width="560">
      <v-card>
        <v-card-title>{{ t('forward_air_accounts.verify_title', { alias: verifyAlias }) }}</v-card-title>
        <v-card-text>
          <v-list v-if="verifyResult" density="compact">
            <v-list-item v-for="row in verifyRows" :key="row.key">
              <template #prepend>
                <v-icon :icon="row.icon" :color="row.color" />
              </template>
              <v-list-item-title>{{ t(`forward_air_accounts.check_${row.key}`) }}</v-list-item-title>
              <v-list-item-subtitle>{{ row.text }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="verifyDialog = false">{{ t('common.close') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * Cuentas de Forward Air (LTL) por partner y entorno: alta, edición, cuenta
 * principal, carta de autorización del cliente, verificación y baja. Solo TMWE.
 * Backend: /api_admin_forward_air_accounts. Los secretos son de solo escritura:
 * vacíos al editar significan «sin cambios».
 */
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  mdiPlus, mdiPencil, mdiDelete, mdiTruckFast, mdiStar, mdiCheckNetwork, mdiFileCertificate,
  mdiCheckCircle, mdiAlertCircle, mdiMinusCircleOutline,
} from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import ListingDataView from '../../listing/ListingDataView.vue';
import { useClientSideListSource } from '../../listing/useClientSideListSource';
import type { DataTableHeader } from '../../listing/types';
import CmAnagraficaAutocomplete from '../../listini/components/CmAnagraficaAutocomplete.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import {
  forwardAirAccountsService,
  forwardAirErrorCode,
  isAuthorizationCurrent,
  type ForwardAirAccount,
  type ForwardAirAccountPayload,
  type ForwardAirAuthStatus,
  type ForwardAirCheck,
  type ForwardAirEnvironment,
  type ForwardAirVerifyResult,
} from '../services/forwardAirAccounts.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const items = ref<ForwardAirAccount[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const filterPartner = ref<number | null>(null);
const filterEnvironment = ref<ForwardAirEnvironment | null>(null);
const selected = ref<{ id: number }[]>([]);
const verifyingId = ref<number | null>(null);

const listSource = useClientSideListSource(items, { loading });
const tableHeaders: DataTableHeader[] = [
  { title: t('forward_air_accounts.col_partner') as string, key: 'partner_name' },
  { title: t('forward_air_accounts.col_alias') as string, key: 'account_alias' },
  { title: t('forward_air_accounts.col_environment') as string, key: 'environment' },
  { title: t('forward_air_accounts.col_ids') as string, key: 'ids', sortable: false },
  { title: t('forward_air_accounts.col_authorization') as string, key: 'authorization', sortable: false },
  { title: t('forward_air_accounts.col_verified') as string, key: 'last_verified_at' },
  { title: t('forward_air_accounts.col_actions') as string, key: 'actions', sortable: false, align: 'end' },
];
const sortKeyMap: Record<string, string> = {
  partner_name: 'partner_name', account_alias: 'account_alias', environment: 'environment', last_verified_at: 'last_verified_at',
};

const environmentItems = computed(() => [
  { title: t('forward_air_accounts.env_sandbox') as string, value: 'sandbox' },
  { title: t('forward_air_accounts.env_production') as string, value: 'production' },
]);
const authStatusItems = computed(() => [
  { title: t('forward_air_accounts.auth_pending') as string, value: 'pending' },
  { title: t('forward_air_accounts.auth_received') as string, value: 'received' },
  { title: t('forward_air_accounts.auth_expired') as string, value: 'expired' },
]);

const today = (): string => new Date().toISOString().slice(0, 10);

function authLabel(a: ForwardAirAccount): string {
  if (a.environment !== 'production') return t('forward_air_accounts.auth_not_required') as string;
  if (a.authorization_status === 'received' && !isAuthorizationCurrent(a, today())) {
    return t('forward_air_accounts.auth_expired') as string;
  }
  return t(`forward_air_accounts.auth_${a.authorization_status}`) as string;
}
function authColor(a: ForwardAirAccount): string | undefined {
  if (a.environment !== 'production') return undefined;
  return isAuthorizationCurrent(a, today()) ? 'success' : 'warning';
}

/** Mensaje de un error: el texto traducido del código FORWARD_AIR_ACCOUNT_* o el del servidor. */
function messageOf(e: unknown): string {
  const code = forwardAirErrorCode(e);
  if (code) return t(`forward_air_accounts.errors.${code}`) as string;
  return e instanceof Error ? e.message : String(e);
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    items.value = await forwardAirAccountsService.list({
      partner_id: filterPartner.value,
      environment: filterEnvironment.value ?? '',
    });
  } catch (e) {
    error.value = messageOf(e);
  } finally {
    loading.value = false;
  }
}

// ---------------------------------------------------------------- alta / edición

const formDialog = ref(false);
const formMode = ref<'create' | 'edit'>('create');
interface FormState {
  id?: number;
  partner_id: number | null;
  environment: ForwardAirEnvironment;
  account_alias: string;
  api_user: string;
  api_password: string;
  customer_id: string;
  bill_to_account: string;
  description: string;
  principal: boolean;
}
const form = reactive<FormState>({
  partner_id: null, environment: 'sandbox', account_alias: '', api_user: '', api_password: '',
  customer_id: '', bill_to_account: '', description: '', principal: false,
});

const formValid = computed(() => {
  const ids = form.customer_id.trim() !== '' || form.bill_to_account.trim() !== '';
  const billTo = form.bill_to_account.trim() === '' || /^\d{7}$/.test(form.bill_to_account.trim());
  const secrets = formMode.value === 'edit' || (form.api_user.trim() !== '' && form.api_password.trim() !== '');
  return !!form.partner_id && form.account_alias.trim() !== '' && ids && billTo && secrets;
});

function resetForm(): void {
  Object.assign(form, {
    id: undefined, partner_id: filterPartner.value, environment: 'sandbox', account_alias: '', api_user: '',
    api_password: '', customer_id: '', bill_to_account: '', description: '', principal: false,
  });
}

function openCreate(): void {
  formMode.value = 'create';
  resetForm();
  formDialog.value = true;
}

function openEdit(a: ForwardAirAccount): void {
  formMode.value = 'edit';
  Object.assign(form, {
    id: a.id, partner_id: a.partner_id, environment: a.environment, account_alias: a.account_alias,
    api_user: '', api_password: '', // nunca se precargan: vacío = mantener
    customer_id: a.customer_id || '', bill_to_account: a.bill_to_account || '', description: a.description || '',
    principal: false,
  });
  formDialog.value = true;
}

async function save(): Promise<void> {
  saving.value = true;
  try {
    const payload: ForwardAirAccountPayload = {
      account_alias: form.account_alias.trim(),
      customer_id: form.customer_id.trim(),
      bill_to_account: form.bill_to_account.trim(),
      description: form.description.trim(),
    };
    // Solo viajan los secretos que se escribieron.
    if (form.api_user.trim()) payload.api_user = form.api_user.trim();
    if (form.api_password.trim()) payload.api_password = form.api_password.trim();

    if (formMode.value === 'create') {
      payload.partner_id = form.partner_id ?? undefined;
      payload.environment = form.environment;
      if (form.principal) payload.principale = 'S';
      await forwardAirAccountsService.create(payload);
      toast.success(t('forward_air_accounts.created'));
    } else {
      payload.id = form.id;
      await forwardAirAccountsService.update(payload);
      toast.success(t('forward_air_accounts.updated'));
    }
    formDialog.value = false;
    await load();
  } catch (e) {
    toast.error(messageOf(e));
  } finally {
    saving.value = false;
  }
}

// ------------------------------------------------------------------- principal

async function makePrincipal(a: ForwardAirAccount): Promise<void> {
  try {
    await forwardAirAccountsService.setPrincipal(a.id);
    toast.success(t('forward_air_accounts.principal_set'));
    await load();
  } catch (e) {
    toast.error(messageOf(e));
  }
}

// --------------------------------------------------------------- autorización

const authDialog = ref(false);
const authForm = reactive<{
  id: number;
  authorization_status: ForwardAirAuthStatus;
  authorization_ref: string;
  authorization_received_at: string;
  authorization_expires_at: string;
}>({
  id: 0, authorization_status: 'pending', authorization_ref: '', authorization_received_at: '', authorization_expires_at: '',
});

const authValid = computed(
  () =>
    authForm.authorization_status !== 'received' ||
    (authForm.authorization_ref.trim() !== '' && authForm.authorization_received_at !== ''),
);

function openAuthorization(a: ForwardAirAccount): void {
  Object.assign(authForm, {
    id: a.id,
    authorization_status: a.authorization_status,
    authorization_ref: a.authorization_ref || '',
    authorization_received_at: a.authorization_received_at || '',
    authorization_expires_at: a.authorization_expires_at || '',
  });
  authDialog.value = true;
}

async function saveAuthorization(): Promise<void> {
  saving.value = true;
  try {
    await forwardAirAccountsService.setAuthorization({
      id: authForm.id,
      authorization_status: authForm.authorization_status,
      authorization_ref: authForm.authorization_ref.trim(),
      authorization_received_at: authForm.authorization_received_at,
      authorization_expires_at: authForm.authorization_expires_at,
    });
    toast.success(t('forward_air_accounts.authorization_saved'));
    authDialog.value = false;
    await load();
  } catch (e) {
    toast.error(messageOf(e));
  } finally {
    saving.value = false;
  }
}

// --------------------------------------------------------------- verificación

const verifyDialog = ref(false);
const verifyAlias = ref('');
const verifyResult = ref<ForwardAirVerifyResult | null>(null);

function checkRow(key: 'user_password' | 'customer_id' | 'bill_to_account', c: ForwardAirCheck) {
  if (!c.checked) {
    return { key, icon: mdiMinusCircleOutline, color: undefined, text: t('forward_air_accounts.check_not_checked') as string };
  }
  if (c.ok) {
    return { key, icon: mdiCheckCircle, color: 'success', text: t('forward_air_accounts.check_ok') as string };
  }
  const detail = c.upstream_error?.message ? ` — ${c.upstream_error.message}` : '';
  return { key, icon: mdiAlertCircle, color: 'error', text: `${c.error_code || 'ERROR'}${detail}` };
}

const verifyRows = computed(() => {
  const r = verifyResult.value;
  if (!r) return [];
  return [checkRow('user_password', r.user_password), checkRow('customer_id', r.customer_id), checkRow('bill_to_account', r.bill_to_account)];
});

async function runVerify(a: ForwardAirAccount): Promise<void> {
  verifyingId.value = a.id;
  try {
    verifyResult.value = await forwardAirAccountsService.verify(a.id);
    verifyAlias.value = a.account_alias;
    verifyDialog.value = true;
    await load();
  } catch (e) {
    toast.error(messageOf(e));
  } finally {
    verifyingId.value = null;
  }
}

// ------------------------------------------------------------------------ baja

async function openDelete(a: ForwardAirAccount): Promise<void> {
  const ok = await confirm.askDanger(
    t('forward_air_accounts.confirm_delete_message', { name: a.account_alias }),
    t('forward_air_accounts.confirm_delete_title'),
  );
  if (!ok) return;
  try {
    await forwardAirAccountsService.remove(a.id);
    toast.success(t('forward_air_accounts.deleted'));
    await load();
  } catch (e) {
    toast.error(messageOf(e));
  }
}

onMounted(() => {
  void load();
});
</script>
