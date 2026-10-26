<template>
  <v-dialog :model-value="modelValue" max-width="640" persistent @update:model-value="emit('update:modelValue', $event)">
    <v-card>
      <v-card-title>{{ editing ? t('partner_smtp.dialog_edit') : t('partner_smtp.dialog_create') }}</v-card-title>
      <v-card-text>
        <v-alert v-if="formError" type="error" variant="tonal" density="compact" class="mb-3">{{ formError }}</v-alert>
        <v-form ref="formRef" @submit.prevent="submit">
          <div class="ps-grid">
            <v-select
              v-model="form.purpose"
              :items="purposeItems"
              :label="t('partner_smtp.field_purpose')"
              :error-messages="errors.purpose"
              :disabled="editing"
              density="compact"
            />
            <v-select
              v-model="form.environment"
              :items="environmentItems"
              :label="t('partner_smtp.field_environment')"
              :error-messages="errors.environment"
              :disabled="editing"
              density="compact"
            />
            <v-text-field
              v-model="form.smtp_server"
              :label="t('partner_smtp.field_server')"
              :hint="t('partner_smtp.hint_server')"
              :rules="[required]"
              :error-messages="errors.smtp_server"
              density="compact"
              class="ps-span"
            />
            <v-select
              v-model="form.smtp_port"
              :items="SMTP_PORTS as unknown as number[]"
              :label="t('partner_smtp.field_port')"
              :error-messages="errors.smtp_port"
              density="compact"
            />
            <v-select
              v-model="form.smtp_security"
              :items="['TLS', 'SSL', 'NONE']"
              :label="t('partner_smtp.field_security')"
              :error-messages="errors.smtp_security"
              density="compact"
            />
            <v-text-field
              v-model="form.smtp_user"
              :label="t('partner_smtp.field_user')"
              :rules="[required]"
              :error-messages="errors.smtp_user"
              autocomplete="off"
              density="compact"
            />
            <v-text-field
              v-model="form.smtp_password"
              type="password"
              :label="t('partner_smtp.field_password')"
              :hint="editing ? t('partner_smtp.hint_password_keep') : t('partner_smtp.hint_password_write_only')"
              persistent-hint
              :rules="editing ? [] : [required]"
              :error-messages="errors.smtp_password"
              autocomplete="new-password"
              density="compact"
            />
            <v-text-field
              v-model="form.from_email"
              type="email"
              :label="t('partner_smtp.field_from_email')"
              :rules="[required]"
              :error-messages="errors.from_email"
              density="compact"
            />
            <v-text-field
              v-model="form.from_name"
              :label="t('partner_smtp.field_from_name')"
              :error-messages="errors.from_name"
              density="compact"
            />
            <v-text-field
              v-model="form.description"
              :label="t('partner_smtp.field_description')"
              :error-messages="errors.description"
              density="compact"
              class="ps-span"
            />
          </div>
          <v-alert v-if="editing" type="info" variant="tonal" density="compact" class="mt-2">
            {{ t('partner_smtp.warn_credentials_change') }}
          </v-alert>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="saving" @click="emit('update:modelValue', false)">{{ t('common.cancel') }}</v-btn>
        <v-btn color="primary" variant="flat" :loading="saving" @click="submit">{{ t('common.save') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
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
  /** Partner de la cuenta nueva (solo administracion). */
  partnerId?: number;
}
const props = withDefaults(defineProps<Props>(), { account: null, partnerId: undefined });
const emit = defineEmits<{ 'update:modelValue': [boolean]; saved: [SmtpAccount] }>();

const { t } = useI18n();
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const saving = ref(false);
const formError = ref('');
const errors = ref<Record<string, string>>({});
const editing = computed(() => props.account != null);

const blank = (): SmtpAccountPayload => ({
  purpose: 'default',
  environment: 'production',
  smtp_server: '',
  smtp_port: 587,
  smtp_security: 'TLS',
  smtp_user: '',
  smtp_password: '',
  from_email: '',
  from_name: '',
  description: '',
});
const form = reactive<SmtpAccountPayload>(blank());

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    formError.value = '';
    errors.value = {};
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
            smtp_password: '',
            from_email: a.from_email,
            from_name: a.from_name,
            description: a.description,
          }
        : blank(),
    );
  },
);

const purposeItems = computed(() =>
  SMTP_PURPOSES.map((p) => ({ title: t(`partner_smtp.purpose_${p}`), value: p })),
);
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
    if (!payload.smtp_password) delete payload.smtp_password;
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

<style scoped>
.ps-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 var(--cm-space-md, 12px);
}
.ps-span {
  grid-column: 1 / -1;
}
@media (max-width: 600px) {
  .ps-grid {
    grid-template-columns: 1fr;
  }
}
</style>
