<template>
  <AppDialog
    :open="modelValue"
    :title="editing ? t('partner_smtp.dialog_edit') : t('partner_smtp.dialog_create')"
    icon="mdi-email-fast-outline"
    size="sm"
    persistent
    :close-disabled="saving"
    @close="emit('update:modelValue', false)"
  >
    <v-alert v-if="formError" type="error" density="compact" class="mb-3">{{ formError }}</v-alert>
    <v-form ref="formRef" @submit.prevent="submit">
      <FormSection :title="t('partner_smtp.section_use')" icon="mdi-tune-variant">
        <v-row dense>
          <v-col cols="12" sm="6">
            <v-select
              v-model="form.purpose"
              :items="purposeItems"
              :label="t('partner_smtp.field_purpose')"
              :error-messages="errors.purpose"
              :disabled="editing"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <v-select
              v-model="form.environment"
              :items="environmentItems"
              :label="t('partner_smtp.field_environment')"
              :error-messages="errors.environment"
              :disabled="editing"
            />
          </v-col>
        </v-row>
      </FormSection>

      <FormSection :title="t('partner_smtp.section_connection')" icon="mdi-server-network">
        <v-row dense>
          <v-col cols="12">
            <v-text-field
              v-model="form.smtp_server"
              :label="t('partner_smtp.field_server')"
              :hint="t('partner_smtp.hint_server')"
              persistent-hint
              :rules="[required]"
              :error-messages="errors.smtp_server"
            />
          </v-col>
          <v-col cols="6">
            <v-select
              v-model="form.smtp_port"
              :items="portItems"
              :label="t('partner_smtp.field_port')"
              :error-messages="errors.smtp_port"
            />
          </v-col>
          <v-col cols="6">
            <v-select
              v-model="form.smtp_security"
              :items="['TLS', 'SSL', 'NONE']"
              :label="t('partner_smtp.field_security')"
              :error-messages="errors.smtp_security"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="form.smtp_user"
              :label="t('partner_smtp.field_user')"
              :rules="[required]"
              :error-messages="errors.smtp_user"
              autocomplete="off"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <CmSecretField
              v-model="password"
              :label="t('partner_smtp.field_password')"
              :hint="editing ? t('partner_smtp.hint_password_keep') : t('partner_smtp.hint_password_write_only')"
              :stored="editing"
              :placeholder="t('partner_smtp.password_stored')"
              :rules="editing ? [] : [required]"
              :error-messages="errors.smtp_password"
            />
          </v-col>
        </v-row>
        <v-alert v-if="editing" type="info" density="compact" class="mt-2">
          {{ t('partner_smtp.warn_credentials_change') }}
        </v-alert>
      </FormSection>

      <FormSection :title="t('partner_smtp.section_sender')" icon="mdi-account-outline" last>
        <v-row dense>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="form.from_email"
              type="email"
              :label="t('partner_smtp.field_from_email')"
              :rules="[required]"
              :error-messages="errors.from_email"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field v-model="form.from_name" :label="t('partner_smtp.field_from_name')" :error-messages="errors.from_name" />
          </v-col>
          <v-col cols="12">
            <v-text-field v-model="form.description" :label="t('partner_smtp.field_description')" :error-messages="errors.description" />
          </v-col>
        </v-row>
      </FormSection>
    </v-form>

    <template #actions>
      <v-spacer />
      <v-btn variant="text" :disabled="saving" @click="emit('update:modelValue', false)">{{ t('common.cancel') }}</v-btn>
      <v-btn color="primary" variant="flat" prepend-icon="mdi-content-save-outline" :loading="saving" @click="submit">{{ t('common.save') }}</v-btn>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import AppDialog from '../../ui/AppDialog.vue';
import FormSection from '../../ui/FormSection.vue';
import CmSecretField from '../../anagrafiche/components/CmSecretField.vue';
import {
  SMTP_PORTS,
  SMTP_PURPOSES,
  smtpFieldErrors,
  type PartnerSmtpService,
  type SmtpAccount,
  type SmtpAccountPayload,
} from '../services/partnerSmtp.service';

interface Props {
  modelValue: boolean;
  service: PartnerSmtpService;
  account?: SmtpAccount | null;
  /** Partner de la cuenta nueva (solo administración). */
  partnerId?: number;
}
const props = withDefaults(defineProps<Props>(), { account: null, partnerId: undefined });
const emit = defineEmits<{ 'update:modelValue': [boolean]; saved: [SmtpAccount] }>();

const { t } = useI18n();
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const saving = ref(false);
const formError = ref('');
const errors = ref<Record<string, string>>({});
const password = ref('');
const portItems: number[] = [...SMTP_PORTS];
const editing = computed(() => props.account != null);

type FormState = Omit<SmtpAccountPayload, 'smtp_password'>;
const blank = (): FormState => ({
  purpose: 'default',
  environment: 'production',
  smtp_server: '',
  smtp_port: 587,
  smtp_security: 'TLS',
  smtp_user: '',
  from_email: '',
  from_name: '',
  description: '',
});
const form = reactive<FormState>(blank());

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    formError.value = '';
    errors.value = {};
    password.value = '';
    const a = props.account;
    Object.assign(
      form,
      a
        ? {
            purpose: a.purpose,
            environment: a.environment,
            smtp_server: a.smtp_server,
            smtp_port: a.smtp_port,
            smtp_security: a.smtp_security,
            smtp_user: a.smtp_user,
            from_email: a.from_email,
            from_name: a.from_name,
            description: a.description,
          }
        : blank(),
    );
  },
);

const purposeItems = computed(() => SMTP_PURPOSES.map((p) => ({ title: t(`partner_smtp.purpose_${p}`), value: p })));
const environmentItems = computed(() => [
  { title: t('partner_smtp.env_production'), value: 'production' },
  { title: t('partner_smtp.env_sandbox'), value: 'sandbox' },
]);
const required = (v: unknown): boolean | string => (v !== '' && v != null) || t('partner_smtp.required');

async function submit(): Promise<void> {
  const res = await formRef.value?.validate();
  if (res && !res.valid) return;
  saving.value = true;
  formError.value = '';
  errors.value = {};
  try {
    const payload: SmtpAccountPayload = { ...form };
    if (password.value) payload.smtp_password = password.value;
    const saved = props.account
      ? await props.service.update({ ...payload, id: props.account.id })
      : await props.service.create(payload, props.partnerId);
    emit('saved', saved);
    emit('update:modelValue', false);
  } catch (e) {
    errors.value = smtpFieldErrors(e);
    formError.value = e instanceof Error ? e.message : t('partner_smtp.error_generic');
  } finally {
    saving.value = false;
  }
}
</script>
