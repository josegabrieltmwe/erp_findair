<template>
  <div>
    <v-alert type="info" variant="tonal" density="compact" class="mb-4">
      {{ t('air_carrier_credentials.partner_tab_hint') }}
    </v-alert>

    <v-card variant="outlined" class="mb-4">
      <v-card-text class="d-flex align-center flex-wrap ga-3">
        <div class="flex-grow-1">
          <div class="text-body-2 font-weight-medium">
            {{ t('air_carrier_credentials.env_selector_title', { carrier: 'KLM/AF' }) }}
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ t('air_carrier_credentials.env_selector_hint') }}
          </div>
        </div>
        <v-chip
          :color="activeEnv === 'production' ? 'warning' : 'info'"
          variant="flat"
          size="small"
        >
          {{ activeEnv === 'production'
            ? t('air_carrier_credentials.env_production')
            : t('air_carrier_credentials.env_sandbox_default') }}
        </v-chip>
        <v-btn
          v-if="activeEnv !== 'production'"
          size="small"
          color="warning"
          variant="tonal"
          :loading="envSaving"
          :disabled="!hasProductionCredential"
          @click="setPartnerEnv('production')"
        >
          {{ t('air_carrier_credentials.env_switch_to_production') }}
        </v-btn>
        <v-btn
          v-else
          size="small"
          variant="tonal"
          :loading="envSaving"
          @click="setPartnerEnv('sandbox')"
        >
          {{ t('air_carrier_credentials.env_switch_to_sandbox') }}
        </v-btn>
      </v-card-text>
      <v-alert
        v-if="activeEnv !== 'production' && !hasProductionCredential"
        type="info"
        variant="text"
        density="compact"
        class="mx-3 mb-3 mt-0"
      >
        {{ t('air_carrier_credentials.env_needs_production_credential') }}
      </v-alert>
    </v-card>

    <div class="d-flex justify-end mb-3">
      <v-btn color="primary" :prepend-icon="mdiPlus" @click="openCreate">
        {{ t('air_carrier_credentials.new_credential') }}
      </v-btn>
    </div>

    <CmEmptyState
      v-if="!loading && !error && items.length === 0"
      :icon="mdiAirplane"
      :title="t('air_carrier_credentials.empty_title')"
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
        <v-chip size="small" class="cm-tone-neutral">{{ (item as AirCarrierCredential).carrier_code }}</v-chip>
      </template>
      <template #cell.api_product="{ item }">
        <v-chip size="x-small" :color="productColor((item as AirCarrierCredential).api_product)" variant="flat">
          {{ (item as AirCarrierCredential).api_product || 'sales' }}
        </v-chip>
      </template>
      <template #cell.country_iso="{ item }">
        <v-chip size="small" class="cm-tone-neutral">{{ (item as AirCarrierCredential).country_iso }}</v-chip>
      </template>
      <template #cell.environment="{ item }">
        <v-chip
          size="x-small"
          :color="(item as AirCarrierCredential).environment === 'production' ? 'warning' : 'info'"
          variant="flat"
        >
          {{ (item as AirCarrierCredential).environment }}
        </v-chip>
      </template>
      <template #cell.principale="{ item }">
        <v-icon v-if="(item as AirCarrierCredential).principale === 'S'" :icon="mdiStar" size="small" color="amber" />
        <span v-else>—</span>
      </template>
      <template #cell.has_secret="{ item }">
        <v-chip size="x-small" :color="(item as AirCarrierCredential).has_secret ? 'success' : undefined" variant="flat">
          {{ (item as AirCarrierCredential).has_secret ? t('air_carrier_credentials.secret_set') : t('air_carrier_credentials.secret_none') }}
        </v-chip>
      </template>
      <template #cell.actions="{ item }">
        <div class="cm-actions-right">
          <v-btn size="small" variant="text" :prepend-icon="mdiPencil" @click="openEdit(item as AirCarrierCredential)">
            {{ t('common.edit') }}
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            color="error"
            :prepend-icon="mdiDelete"
            @click="openDelete(item as AirCarrierCredential)"
          >
            {{ t('common.delete') }}
          </v-btn>
        </div>
      </template>
    </ListingDataView>
    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-2" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <v-dialog v-model="formDialog" max-width="680" persistent>
      <v-card>
        <v-card-title>
          {{ formMode === 'create' ? t('air_carrier_credentials.dialog_create') : t('air_carrier_credentials.dialog_edit') }}
        </v-card-title>
        <v-card-text>
          <div class="cm-grid">
            <v-select
              v-model="form.carrier_code"
              :items="carrierItems"
              :label="t('air_carrier_credentials.form_carrier')"
            />
            <CmCountrySelect
              v-model="form.country_iso"
              :label="t('air_carrier_credentials.form_country_iso')"
            />
          </div>
          <div class="cm-grid mt-3">
            <v-select
              v-model="form.environment"
              :items="envItems"
              :label="t('air_carrier_credentials.form_environment')"
            />
            <v-select
              v-model="form.api_product"
              :items="productItems"
              :label="t('air_carrier_credentials.form_product')"
              :hint="t('air_carrier_credentials.form_product_hint')"
              persistent-hint
            />
          </div>
          <!-- Sin selector de partner: esta credencial nace fijada al dueño
               de la ficha (idAnagrafica), a diferencia del formulario admin
               global (AirCarrierCredentialsPage.vue), que sí lo pide. -->
          <v-text-field
            v-model="form.base_url"
            :label="t('air_carrier_credentials.form_base_url')"
            :placeholder="t('air_carrier_credentials.form_base_url_hint')"
            maxlength="255"
            class="mt-3"
          />
          <v-text-field
            v-model="form.oauth_key"
            :label="t('air_carrier_credentials.form_oauth_key')"
            maxlength="255"
            class="mt-3"
          />
          <v-text-field
            v-model="form.oauth_secret"
            :label="t('air_carrier_credentials.form_oauth_secret')"
            :placeholder="formMode === 'edit' ? t('air_carrier_credentials.secret_unchanged_hint') : ''"
            type="password"
            autocomplete="new-password"
            maxlength="255"
            class="mt-3"
          />
          <v-text-field
            v-model="form.customer_urn"
            :label="t('air_carrier_credentials.form_customer_urn')"
            maxlength="255"
            class="mt-3"
          />
          <v-switch
            v-model="form.principale"
            :label="t('air_carrier_credentials.form_principale')"
            color="primary"
            hide-details
            class="mt-2"
          />
          <v-text-field
            v-model="form.description"
            :label="t('air_carrier_credentials.form_description')"
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
 * Tab de credenciales de carrier aéreo (KLM/AF y otros) dentro de la ficha
 * de anagrafica. Variante embebida y fijada al partner de
 * `AirCarrierCredentialsPage.vue` (la vista admin global): mismo backend
 * (api_admin_air_carrier_credentials), lista solo lo propio de este
 * partner y crea/edita siempre con `partner_id` fijo — sin selector.
 *
 * ⚠️ Esta credencial es un CANDIDATO dentro de una cadena de precedencia
 * (titolare → país de salida → país de llegada → sesión), no
 * necesariamente "la que se usa" en un rate — ver
 * finding_carrier_credential_partner_precedence (memoria). El banner de
 * arriba lo deja explícito para no sugerir una garantía que no existe.
 */
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiPlus, mdiPencil, mdiDelete, mdiAirplane, mdiStar } from '@mdi/js';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import ListingDataView from '../../listing/ListingDataView.vue';
import { useClientSideListSource } from '../../listing/useClientSideListSource';
import type { DataTableHeader } from '../../listing/types';
import CmCountrySelect from '../../anagrafiche/components/CmCountrySelect.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import {
  airCarrierCredentialsService,
  type AirCarrierCredential,
  type AirCarrierCredentialPayload,
} from '../services/airCarrierCredentials.service';
import {
  partnerCarrierEnvironmentService,
  type PartnerCarrierEnvironment,
} from '../services/partnerCarrierEnvironment.service';

const props = defineProps<{
  idAnagrafica: number;
}>();
const emit = defineEmits<{ refresh: [] }>();

const carrierItems = ['klm', 'lufthansa', 'ba', 'af'];
const productItems = ['sales', 'tracking', 'opendata'];
const envItems = ['sandbox', 'production'];

function productColor(p?: string): string {
  switch (p) {
    case 'tracking': return 'teal';
    case 'opendata': return 'purple';
    default: return 'primary';
  }
}

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const items = ref<AirCarrierCredential[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const selected = ref<{ id: number }[]>([]);

// Selector de entorno activo (sandbox/production) para KLM, único carrier
// directo real hoy — el modelo (partner_carrier_environment) ya es genérico
// por carrier_code, pero la UI se fija a 'klm' hasta que haya un segundo
// carrier directo que la necesite.
const ENV_CARRIER = 'klm';
const envRow = ref<PartnerCarrierEnvironment | null>(null);
const envSaving = ref(false);
const activeEnv = computed(() => envRow.value?.environment ?? 'sandbox');
const hasProductionCredential = computed(() =>
  items.value.some(
    (c) => c.carrier_code === ENV_CARRIER && c.environment === 'production' && c.has_secret && !!c.oauth_key,
  ),
);

async function loadEnv(): Promise<void> {
  try {
    const rows = await partnerCarrierEnvironmentService.list({
      partner_id: props.idAnagrafica,
      carrier_code: ENV_CARRIER,
    });
    envRow.value = rows[0] ?? null;
  } catch (e) {
    // No bloquea la tab de credenciales por un fallo de este selector —
    // se limita a mostrar el default (sandbox) y dejar ver el error al guardar.
    envRow.value = null;
  }
}

async function setPartnerEnv(next: string): Promise<void> {
  envSaving.value = true;
  try {
    if (envRow.value) {
      await partnerCarrierEnvironmentService.update({ id: envRow.value.id, partner_id: props.idAnagrafica, carrier_code: ENV_CARRIER, environment: next });
    } else {
      await partnerCarrierEnvironmentService.create({ partner_id: props.idAnagrafica, carrier_code: ENV_CARRIER, environment: next });
    }
    toast.success(
      next === 'production'
        ? t('air_carrier_credentials.env_switched_to_production')
        : t('air_carrier_credentials.env_switched_to_sandbox'),
    );
    await loadEnv();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    envSaving.value = false;
  }
}

const listSource = useClientSideListSource(items, { loading });
const tableHeaders: DataTableHeader[] = [
  { title: t('air_carrier_credentials.col_carrier') as string, key: 'carrier_code' },
  { title: t('air_carrier_credentials.col_product') as string, key: 'api_product' },
  { title: t('air_carrier_credentials.col_country') as string, key: 'country_iso' },
  { title: t('air_carrier_credentials.col_environment') as string, key: 'environment' },
  { title: t('air_carrier_credentials.col_customer_urn') as string, key: 'customer_urn' },
  { title: t('air_carrier_credentials.col_principale') as string, key: 'principale', sortable: false },
  { title: t('air_carrier_credentials.col_secret') as string, key: 'has_secret', sortable: false },
  { title: t('air_carrier_credentials.col_actions') as string, key: 'actions', sortable: false, align: 'end' },
];
const sortKeyMap: Record<string, string> = {
  carrier_code: 'carrier_code', api_product: 'api_product', country_iso: 'country_iso',
  environment: 'environment', customer_urn: 'customer_urn',
};

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    items.value = await airCarrierCredentialsService.list({ partner_id: props.idAnagrafica });
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
  carrier_code: string;
  country_iso: string;
  environment: string;
  api_product: string;
  oauth_key: string;
  oauth_secret: string;
  customer_urn: string;
  base_url: string;
  principale: boolean;
  description: string;
}

const form = reactive<FormState>({
  carrier_code: '',
  country_iso: '',
  environment: 'sandbox',
  api_product: 'sales',
  oauth_key: '',
  oauth_secret: '',
  customer_urn: '',
  base_url: '',
  principale: false,
  description: '',
});

const formValid = computed(
  () =>
    form.carrier_code.trim().length > 0 &&
    form.country_iso.trim().length === 2 &&
    envItems.includes(form.environment) &&
    productItems.includes(form.api_product) &&
    !!form.oauth_key.trim(),
);

function resetForm(): void {
  form.id = undefined;
  form.carrier_code = '';
  form.country_iso = '';
  form.environment = 'sandbox';
  form.api_product = 'sales';
  form.oauth_key = '';
  form.oauth_secret = '';
  form.customer_urn = '';
  form.base_url = '';
  form.principale = false;
  form.description = '';
}

function openCreate(): void {
  formMode.value = 'create';
  resetForm();
  formDialog.value = true;
}

function openEdit(item: AirCarrierCredential): void {
  formMode.value = 'edit';
  form.id = item.id;
  form.carrier_code = item.carrier_code;
  form.country_iso = item.country_iso;
  form.environment = item.environment;
  form.api_product = item.api_product || 'sales';
  form.oauth_key = item.oauth_key || '';
  form.oauth_secret = '';
  form.customer_urn = item.customer_urn || '';
  form.base_url = (item.base_url as string) || '';
  form.principale = item.principale === 'S';
  form.description = (item.description as string) || '';
  formDialog.value = true;
}

async function save(): Promise<void> {
  saving.value = true;
  try {
    const payload: AirCarrierCredentialPayload = {
      id: form.id,
      carrier_code: form.carrier_code.trim().toLowerCase(),
      country_iso: form.country_iso.toUpperCase(),
      environment: form.environment,
      api_product: form.api_product,
      partner_id: props.idAnagrafica,
      oauth_key: form.oauth_key.trim(),
      customer_urn: form.customer_urn.trim(),
      base_url: form.base_url.trim(),
      principale: form.principale ? 'S' : 'N',
      description: form.description.trim(),
    };
    if (form.oauth_secret.trim()) {
      payload.oauth_secret = form.oauth_secret.trim();
    }
    if (formMode.value === 'create') {
      await airCarrierCredentialsService.create(payload);
      toast.success(t('air_carrier_credentials.created'));
    } else {
      await airCarrierCredentialsService.update(payload);
      toast.success(t('air_carrier_credentials.updated'));
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

async function openDelete(item: AirCarrierCredential): Promise<void> {
  const ok = await confirm.askDanger(
    t('air_carrier_credentials.confirm_delete_message', {
      name: `${item.carrier_code} / ${item.country_iso}`,
    }),
    t('air_carrier_credentials.confirm_delete_title'),
  );
  if (!ok) return;
  try {
    await airCarrierCredentialsService.remove(item.id);
    toast.success(t('air_carrier_credentials.deleted'));
    await load();
    emit('refresh');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

watch(() => props.idAnagrafica, load);
watch(() => props.idAnagrafica, loadEnv);
onMounted(() => {
  void load();
  void loadEnv();
});
</script>
