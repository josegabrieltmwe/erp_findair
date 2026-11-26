<template>
  <div>
    <CmSectionHeader :title="t('self_registration.config.title')" :subtitle="t('self_registration.config.subtitle')" />

    <v-card v-if="isTmwe" class="pa-4 mb-4" variant="outlined">
      <CmAnagraficaAutocomplete
        v-model="titolareId"
        :label="t('self_registration.config.titolare')"
        :hint="t('self_registration.config.titolare_hint')"
      />
    </v-card>

    <v-alert v-if="loadError" type="error" variant="tonal" class="mb-4" data-testid="sr-config-error">{{ loadError }}</v-alert>

    <v-card v-if="loaded" class="pa-4 mb-4" variant="outlined" data-testid="sr-config-form">
      <v-switch
        v-model="form.enabled"
        :label="t('self_registration.config.enabled')"
        :hint="t('self_registration.config.enabled_hint')"
        persistent-hint
        color="primary"
        density="compact"
        class="mb-4"
        data-testid="sr-config-enabled"
      />

      <div class="text-subtitle-2 mb-2">{{ t('self_registration.config.section_links') }}</div>
      <v-row dense>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="form.activation_base_url"
            :label="t('self_registration.config.activation_base_url')"
            :hint="t('self_registration.config.activation_base_url_hint')"
            :error-messages="errors.activation_base_url"
            placeholder="https://"
            persistent-hint
            density="compact"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="form.login_client_id"
            :label="t('self_registration.config.login_client_id')"
            :hint="t('self_registration.config.login_client_id_hint')"
            :error-messages="errors.login_client_id"
            persistent-hint
            density="compact"
          />
        </v-col>
      </v-row>

      <div class="text-subtitle-2 mb-2 mt-4">{{ t('self_registration.config.section_legal') }}</div>
      <v-row dense>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="form.privacy_url"
            :label="t('self_registration.config.privacy_url')"
            :error-messages="errors.privacy_url || errors.url"
            placeholder="https://"
            density="compact"
          />
        </v-col>
        <v-col cols="6" md="3">
          <v-text-field
            v-model="form.privacy_version"
            :label="t('self_registration.config.privacy_version')"
            :error-messages="errors.privacy_version"
            density="compact"
          />
        </v-col>
        <v-col cols="6" md="3">
          <v-text-field
            v-model="form.terms_version"
            :label="t('self_registration.config.terms_version')"
            :error-messages="errors.terms_version"
            density="compact"
          />
        </v-col>
        <v-col cols="12">
          <div class="text-caption sr-muted">{{ t('self_registration.config.versions_hint') }}</div>
        </v-col>
      </v-row>

      <div class="text-subtitle-2 mb-2 mt-4">{{ t('self_registration.config.section_review') }}</div>
      <v-row dense>
        <v-col cols="12" md="6">
          <v-combobox
            v-model="form.notify_emails"
            :label="t('self_registration.config.notify_emails')"
            :hint="t('self_registration.config.notify_emails_hint')"
            :error-messages="errors.notify_emails"
            persistent-hint
            multiple
            chips
            closable-chips
            density="compact"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-select
            v-model="form.id_pagam_met_card"
            :items="paymentItems"
            :loading="paymentsLoading"
            :label="t('self_registration.config.id_pagam_met_card')"
            :hint="t('self_registration.config.id_pagam_met_card_hint')"
            :error-messages="errors.id_pagam_met_card"
            persistent-hint
            clearable
            density="compact"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-select
            v-model="form.id_pagam_scad_card"
            :items="scheduleItems"
            :loading="paymentsLoading"
            :label="t('self_registration.config.id_pagam_scad_card')"
            :hint="t('self_registration.config.id_pagam_scad_card_hint')"
            :error-messages="errors.id_pagam_scad_card"
            persistent-hint
            clearable
            density="compact"
            data-testid="sr-config-scad"
          />
        </v-col>
      </v-row>

      <div class="text-subtitle-2 mb-2 mt-4">{{ t('self_registration.config.section_abuse') }}</div>
      <v-row dense>
        <v-col cols="12" md="6">
          <v-switch
            v-model="form.turnstile_required"
            :label="t('self_registration.config.turnstile_required')"
            :hint="t('self_registration.config.turnstile_required_hint')"
            :error-messages="errors.turnstile_required"
            persistent-hint
            color="primary"
            density="compact"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field
            v-model.number="form.daily_limit"
            type="number"
            min="0"
            max="10000"
            :label="t('self_registration.config.daily_limit')"
            :hint="t('self_registration.config.daily_limit_hint')"
            :error-messages="errors.daily_limit"
            persistent-hint
            density="compact"
          />
        </v-col>
      </v-row>

      <div class="d-flex mt-4">
        <v-spacer />
        <v-btn color="primary" :loading="saving" :disabled="loading" data-testid="sr-config-save" @click="save">
          {{ t('self_registration.config.save') }}
        </v-btn>
      </div>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmAnagraficaAutocomplete from '../../listini/components/CmAnagraficaAutocomplete.vue';
import { useAnagraficaContext } from '../../anagrafiche/composables/useAnagraficaContext';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { paymentsService, type PaymentMethodOption, type PaymentScheduleOption } from '../../anagrafiche/services/payments.service';
import { selfRegistrationErrorText, selfRegistrationFieldErrors } from '../utils/errors';
import {
  selfRegistrationService,
  type SelfRegistrationConfigInput,
} from '../services/selfRegistration.service';

/**
 * Configuración del auto-registro del titular (api_self_registration_config). Solo TMWE o el administrador del
 * partner (`partner:manage`): la tarjeta se oculta a los demás y el api responde 403 `PARTNER_ADMIN_REQUIRED`.
 * TMWE edita la suya o, eligiéndolo, la de otro titular.
 */
const { t, te } = useI18n();
const toast = useToastStore();
const { isTmwe } = useAnagraficaContext();
const i18n = { t: (k: string, n?: Record<string, unknown>) => t(k, n ?? {}), te };

const titolareId = ref<number | null>(null);
const loading = ref(false);
const loaded = ref(false);
const saving = ref(false);
const loadError = ref('');
const errors = reactive<Record<string, string>>({});

const form = reactive<SelfRegistrationConfigInput>({
  enabled: false,
  activation_base_url: '',
  login_client_id: '',
  privacy_url: '',
  privacy_version: '',
  terms_version: '',
  notify_emails: [],
  id_pagam_met_card: null,
  id_pagam_scad_card: null,
  turnstile_required: false,
  daily_limit: 200,
});

const payments = ref<PaymentMethodOption[]>([]);
const paymentsLoading = ref(false);
const schedules = ref<PaymentScheduleOption[]>([]);
const scheduleItems = computed(() =>
  schedules.value.map((s) => ({ title: String(s.label ?? s.descr ?? `#${s.id}`), value: Number(s.id) })),
);
const paymentItems = computed(() =>
  payments.value.map((p) => ({ title: String(p.descr || p.descrEN || `#${p.id}`), value: Number(p.id) })),
);

function target(): number | null {
  return isTmwe.value ? titolareId.value : null;
}

function clearErrors(): void {
  for (const k of Object.keys(errors)) delete errors[k];
}

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = '';
  clearErrors();
  try {
    const cfg = await selfRegistrationService.getConfig(target());
    const { id_anagr_titolare: _ignored, ...rest } = cfg;
    Object.assign(form, rest);
    loaded.value = true;
  } catch (e) {
    loaded.value = false;
    loadError.value = selfRegistrationErrorText(e, i18n);
  } finally {
    loading.value = false;
  }
  void loadPayments();
}

async function loadPayments(): Promise<void> {
  paymentsLoading.value = true;
  try {
    const tid = target() ?? undefined;
    const [methods, terms] = await Promise.all([
      paymentsService.paymentMethods(undefined, tid).catch(() => []),
      paymentsService.paymentSchedules(tid).catch(() => []),
    ]);
    payments.value = methods;
    schedules.value = terms;
  } finally {
    paymentsLoading.value = false;
  }
}

async function save(): Promise<void> {
  clearErrors();
  saving.value = true;
  try {
    const saved = await selfRegistrationService.saveConfig(
      {
        ...form,
        notify_emails: form.notify_emails.map((m) => String(m).trim()).filter(Boolean),
        daily_limit: Number(form.daily_limit) || 0,
      },
      target(),
    );
    const { id_anagr_titolare: _ignored, ...rest } = saved;
    Object.assign(form, rest);
    toast.success(t('self_registration.config.saved'));
  } catch (e) {
    Object.assign(errors, selfRegistrationFieldErrors(e, i18n));
    toast.error(selfRegistrationErrorText(e, i18n));
  } finally {
    saving.value = false;
  }
}

watch(titolareId, () => void load());
void load();
</script>

<style scoped>
.sr-muted {
  color: var(--cm-text-muted);
}
</style>
