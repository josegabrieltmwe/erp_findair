<template>
  <AppDialog
    :open="modelValue"
    :title="editing ? t('pay_gateways.dialog_edit') : t('pay_gateways.dialog_create')"
    icon="mdi-credit-card-outline"
    size="sm"
    persistent
    :close-disabled="saving"
    @close="emit('update:modelValue', false)"
  >
    <v-alert v-if="formError" type="error" density="compact" class="mb-3" data-testid="pay-form-error">{{ formError }}</v-alert>
    <v-form ref="formRef" @submit.prevent="submit">
      <FormSection :title="t('pay_gateways.section_account')" icon="mdi-tune-variant">
        <v-row dense>
          <v-col cols="12" sm="6">
            <v-select
              v-model="form.provider"
              :items="providerItems"
              :label="t('pay_gateways.field_provider')"
              :error-messages="errors.provider"
              :disabled="editing"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <v-select
              v-model="form.environment"
              :items="environmentItems"
              :label="t('pay_gateways.field_environment')"
              :hint="t('pay_gateways.hint_environment')"
              persistent-hint
              :error-messages="errors.environment"
              :disabled="editing"
            />
          </v-col>
          <v-col cols="12">
            <v-text-field
              v-model="form.account_alias"
              :label="t('pay_gateways.field_alias')"
              :rules="[required]"
              :error-messages="errors.account_alias"
            />
          </v-col>
          <v-col cols="12">
            <v-select
              v-model="form.enabled_methods"
              :items="methodItems"
              :label="t('pay_gateways.field_methods')"
              multiple
              chips
              :error-messages="errors.enabled_methods"
            />
          </v-col>
        </v-row>
      </FormSection>

      <FormSection v-if="!editing" :title="t('pay_gateways.section_credentials')" icon="mdi-key-outline" last>
        <v-alert type="info" density="compact" class="mb-3">{{ t('pay_gateways.hint_no_cards') }}</v-alert>
        <v-row dense>
          <v-col cols="12">
            <CmSecretField
              v-model="secret"
              :label="t('pay_gateways.field_secret')"
              :hint="t('pay_gateways.hint_secret_write_only')"
              :rules="[required]"
              :error-messages="errors.secret"
            />
          </v-col>
          <v-col cols="12">
            <CmSecretField
              v-model="webhookSecret"
              :label="t('pay_gateways.field_webhook_secret')"
              :hint="t('pay_gateways.hint_webhook_secret')"
              :error-messages="errors.webhook_secret"
            />
          </v-col>
          <v-col cols="12">
            <v-text-field
              v-model="form.public_key"
              :label="t('pay_gateways.field_public_key')"
              :error-messages="errors.public_key"
            />
          </v-col>
        </v-row>
      </FormSection>
      <FormSection v-else :title="t('pay_gateways.section_status')" icon="mdi-power" last>
        <v-select
          v-model="form.status"
          :items="statusItems"
          :label="t('pay_gateways.field_status')"
          :error-messages="errors.status"
        />
        <v-alert type="info" density="compact" class="mt-2">{{ t('pay_gateways.hint_use_rotate') }}</v-alert>
      </FormSection>
    </v-form>

    <template #actions>
      <v-spacer />
      <v-btn variant="text" :disabled="saving" @click="emit('update:modelValue', false)">{{ t('common.cancel') }}</v-btn>
      <v-btn color="primary" variant="flat" prepend-icon="mdi-content-save-outline" :loading="saving" data-testid="pay-form-save" @click="submit">
        {{ t('common.save') }}
      </v-btn>
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
  PAY_METHODS,
  PAY_PROVIDERS,
  enabledMethods,
  payFieldErrors,
  payGatewayAccounts,
  type PayAccountStatus,
  type PayEnvironment,
  type PayGatewayAccount,
  type PayMethod,
  type PayProvider,
} from '../services/paymentGateways.service';

/** Alta de una cuenta (con secreto de solo escritura) o edición de alias, métodos y estado. */
const props = withDefaults(defineProps<{ modelValue: boolean; account?: PayGatewayAccount | null }>(), { account: null });
const emit = defineEmits<{ 'update:modelValue': [boolean]; saved: [PayGatewayAccount] }>();

const { t } = useI18n();
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const saving = ref(false);
const formError = ref('');
const errors = ref<Record<string, string>>({});
const secret = ref('');
const webhookSecret = ref('');
const editing = computed(() => props.account != null);

interface FormState {
  provider: PayProvider;
  environment: PayEnvironment;
  account_alias: string;
  enabled_methods: PayMethod[];
  public_key: string;
  status: PayAccountStatus;
}
const blank = (): FormState => ({
  provider: 'stripe',
  environment: 'sandbox',
  account_alias: '',
  enabled_methods: ['card'],
  public_key: '',
  status: 'active',
});
const form = reactive<FormState>(blank());

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    formError.value = '';
    errors.value = {};
    secret.value = '';
    webhookSecret.value = '';
    const a = props.account;
    Object.assign(
      form,
      a
        ? {
            provider: a.provider,
            environment: a.environment,
            account_alias: a.account_alias,
            enabled_methods: enabledMethods(a) as PayMethod[],
            public_key: a.public_key ?? '',
            status: a.status,
          }
        : blank(),
    );
  },
);

const providerItems = computed(() => PAY_PROVIDERS.map((p) => ({ title: t(`pay_gateways.provider_${p}`), value: p })));
const methodItems = computed(() => PAY_METHODS.map((m) => ({ title: t(`pay_gateways.method_${m}`), value: m })));
const environmentItems = computed(() => [
  { title: t('pay_gateways.env_production'), value: 'production' },
  { title: t('pay_gateways.env_sandbox'), value: 'sandbox' },
]);
const statusItems = computed(() =>
  (['active', 'disabled'] as const).map((s) => ({ title: t(`pay_gateways.status_${s}`), value: s })),
);
const required = (v: unknown): boolean | string => (v !== '' && v != null) || t('pay_gateways.required');

async function submit(): Promise<void> {
  const res = await formRef.value?.validate();
  if (res && !res.valid) return;
  saving.value = true;
  formError.value = '';
  errors.value = {};
  try {
    let saved: PayGatewayAccount;
    if (props.account) {
      saved = await payGatewayAccounts.update({
        id: props.account.public_id,
        account_alias: form.account_alias,
        enabled_methods: form.enabled_methods,
        public_key: form.public_key,
        status: form.status,
      });
    } else {
      saved = await payGatewayAccounts.create({
        provider: form.provider,
        environment: form.environment,
        account_alias: form.account_alias,
        enabled_methods: form.enabled_methods,
        secret: secret.value,
        ...(webhookSecret.value ? { webhook_secret: webhookSecret.value } : {}),
        ...(form.public_key ? { public_key: form.public_key } : {}),
      });
    }
    // El secreto no se queda en memoria más de lo necesario.
    secret.value = '';
    webhookSecret.value = '';
    emit('saved', saved);
    emit('update:modelValue', false);
  } catch (e) {
    errors.value = payFieldErrors(e);
    formError.value = e instanceof Error ? e.message : t('pay_gateways.error_generic');
  } finally {
    saving.value = false;
  }
}
</script>
