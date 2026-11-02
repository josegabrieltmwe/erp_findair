<template>
  <AppDialog
    :open="modelValue"
    :title="t('pay_gateways.rotate_title')"
    icon="mdi-key-change"
    size="confirm"
    persistent
    :close-disabled="saving"
    @close="emit('update:modelValue', false)"
  >
    <p class="text-body-2 mb-3">{{ t('pay_gateways.rotate_hint') }}</p>
    <v-alert v-if="formError" type="error" density="compact" class="mb-3">{{ formError }}</v-alert>
    <CmSecretField v-model="secret" :label="t('pay_gateways.field_secret')" :hint="t('pay_gateways.hint_secret_write_only')" />
    <CmSecretField v-model="webhookSecret" class="mt-2" :label="t('pay_gateways.field_webhook_secret')" :hint="t('pay_gateways.hint_webhook_rotation')" />
    <template #actions>
      <v-spacer />
      <v-btn variant="text" :disabled="saving" @click="emit('update:modelValue', false)">{{ t('common.cancel') }}</v-btn>
      <v-btn color="primary" variant="flat" :loading="saving" :disabled="!secret && !webhookSecret" data-testid="pay-rotate-save" @click="submit">
        {{ t('pay_gateways.rotate_action') }}
      </v-btn>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import AppDialog from '../../ui/AppDialog.vue';
import CmSecretField from '../../anagrafiche/components/CmSecretField.vue';
import { payGatewayAccounts, type PayGatewayAccount } from '../services/paymentGateways.service';

/** Rotación del secreto y/o del secreto de webhook. Vacío = no cambia; los valores nunca se muestran de vuelta. */
const props = defineProps<{ modelValue: boolean; account: PayGatewayAccount | null }>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; saved: [PayGatewayAccount] }>();

const { t } = useI18n();
const secret = ref('');
const webhookSecret = ref('');
const saving = ref(false);
const formError = ref('');

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    secret.value = '';
    webhookSecret.value = '';
    formError.value = '';
  },
);

async function submit(): Promise<void> {
  if (!props.account) return;
  saving.value = true;
  formError.value = '';
  try {
    const saved = await payGatewayAccounts.rotateSecret(props.account.public_id, {
      secret: secret.value,
      webhook_secret: webhookSecret.value,
    });
    secret.value = '';
    webhookSecret.value = '';
    emit('saved', saved);
    emit('update:modelValue', false);
  } catch (e) {
    formError.value = e instanceof Error ? e.message : t('pay_gateways.error_generic');
  } finally {
    saving.value = false;
  }
}
</script>
