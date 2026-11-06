<template>
  <div>
    <CmSectionHeader
      :title="isAdmin ? t('partner_dgr.title_admin') : t('partner_dgr.title')"
      :subtitle="t('partner_dgr.subtitle')"
    />

    <v-card v-if="isAdmin" class="pa-4 mb-4" variant="outlined">
      <CmAnagraficaAutocomplete v-model="partnerId" :label="t('partner_dgr.filter_partner')" />
    </v-card>

    <v-alert v-if="loadError" type="error" variant="tonal" class="mb-4">{{ loadError }}</v-alert>

    <v-card v-if="!isAdmin || partnerId" class="pa-4 mb-4" variant="outlined" data-testid="partner-dgr-form">
      <v-alert
        v-if="!loading && !configured"
        type="warning"
        variant="tonal"
        density="compact"
        class="mb-4"
      >
        {{ t('partner_dgr.not_configured') }}
      </v-alert>

      <div class="text-subtitle-2 mb-2">{{ t('partner_dgr.emergency_title') }}</div>
      <v-row dense>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="form.emergency_phone"
            :label="t('partner_dgr.emergency_phone') + ' *'"
            :error-messages="errors.emergency_phone"
            placeholder="+39 02 1234 5678"
            density="compact"
            data-testid="dgr-emergency-phone"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field v-model="form.emergency_contact" :label="t('partner_dgr.emergency_contact')" density="compact" />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field v-model="form.emergency_reference" :label="t('partner_dgr.emergency_reference')" density="compact" />
        </v-col>
      </v-row>

      <div class="text-subtitle-2 mb-2 mt-2">{{ t('partner_dgr.signatory_title') }}</div>
      <v-row dense>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="form.signatory_name"
            :label="t('partner_dgr.signatory_name')"
            :error-messages="errors.signatory_name"
            density="compact"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field v-model="form.signatory_title" :label="t('partner_dgr.signatory_role')" density="compact" />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field v-model="form.signatory_place" :label="t('partner_dgr.signatory_place')" density="compact" />
        </v-col>
      </v-row>

      <div class="text-body-2 cm-cell-hint mb-3">{{ t('partner_dgr.hint') }}</div>

      <div class="d-flex">
        <v-spacer />
        <v-btn color="primary" :loading="saving" :disabled="loading" data-testid="dgr-save" @click="save">
          {{ t('common.save') }}
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
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { getPartnerDgrConfig, savePartnerDgrConfig } from '../../services/dgr.service';

/**
 * Contacto de emergencia 24 h y firmante de mercancía peligrosa del partner (api_partner_dgr_config). El partner es el
 * especialista que acompaña el transporte: su contacto viaja en la declaración a UPS, FedEx y DHL, y sin él no se crean
 * etiquetas de régimen completo. `self`: el propio partner; `admin`: TMWE con selector de partner.
 */
const props = defineProps<{ scope: 'self' | 'admin' }>();
const { t } = useI18n();
const toast = useToastStore();
const isAdmin = computed(() => props.scope === 'admin');
const partnerId = ref<number | null>(null);

const empty = {
  emergency_phone: '',
  emergency_contact: '',
  emergency_reference: '',
  signatory_name: '',
  signatory_title: '',
  signatory_place: '',
};
const form = reactive<Record<keyof typeof empty, string>>({ ...empty });
const errors = reactive<Record<string, string>>({});
const configured = ref(false);
const loading = ref(false);
const saving = ref(false);
const loadError = ref('');

function targetId(): number | undefined {
  return isAdmin.value ? partnerId.value ?? undefined : undefined;
}

async function load(): Promise<void> {
  if (isAdmin.value && !partnerId.value) return;
  loading.value = true;
  loadError.value = '';
  try {
    const cfg = await getPartnerDgrConfig(targetId());
    Object.assign(form, empty);
    if (cfg) {
      for (const k of Object.keys(empty) as Array<keyof typeof empty>) {
        form[k] = (cfg[k] as string | null) ?? '';
      }
      configured.value = cfg.configured;
    }
  } catch (e) {
    loadError.value = e instanceof Error && e.message ? e.message : t('partner_dgr.error_generic');
  } finally {
    loading.value = false;
  }
}

async function save(): Promise<void> {
  for (const k of Object.keys(errors)) delete errors[k];
  if (!form.emergency_phone.trim()) {
    errors.emergency_phone = t('partner_dgr.phone_required');
    return;
  }
  saving.value = true;
  try {
    const res = await savePartnerDgrConfig({ ...form }, targetId());
    if (res?.success) {
      configured.value = true;
      toast.success(t('partner_dgr.saved'));
    } else {
      const fields = (res as { errors?: Record<string, string> })?.errors ?? {};
      Object.assign(errors, fields);
      toast.error(t('partner_dgr.error_generic'));
    }
  } catch (e) {
    toast.error(e instanceof Error && e.message ? e.message : t('partner_dgr.error_generic'));
  } finally {
    saving.value = false;
  }
}

watch(partnerId, () => void load());
void load();
</script>
