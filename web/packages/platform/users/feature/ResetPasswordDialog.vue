<template>
  <v-dialog :model-value="modelValue" max-width="480" persistent @update:model-value="onClose">
    <v-card v-if="user">
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">{{ mdiKeyVariant }}</v-icon>
        {{ t('users.reset_password_title') }}
      </v-card-title>

      <v-card-text>
        <!-- Paso de confirmación -->
        <template v-if="!newPassword">
          <p class="mb-3">
            {{ t('users.reset_password_confirm', { name: user.nome || user.loginn }) }}
          </p>
          <v-alert type="warning" variant="tonal" density="compact">
            {{ t('users.reset_password_warn') }}
          </v-alert>
        </template>

        <!-- Paso de resultado -->
        <template v-else>
          <v-alert type="success" variant="tonal" density="compact" class="mb-3">
            {{ t('users.reset_password_done') }}
          </v-alert>
          <CredentialsRevealCard :password="newPassword" />
        </template>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn v-if="!newPassword" variant="text" @click="onClose(false)">
          {{ t('common.cancel') }}
        </v-btn>
        <v-btn
          v-if="!newPassword"
          color="warning"
          :loading="resetting"
          :prepend-icon="mdiKeyVariant"
          @click="reset"
        >
          {{ t('users.reset_password_action') }}
        </v-btn>
        <v-btn v-else color="primary" @click="onClose(false)">
          {{ t('common.close') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiKeyVariant } from '@mdi/js';
import { usersService, type UserLite } from '../services/users.service';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import CredentialsRevealCard from '../../anagrafiche/components/CredentialsRevealCard.vue';

interface Props {
  modelValue: boolean;
  user: UserLite | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const { t } = useI18n();
const toast = useToastStore();

const resetting = ref(false);
const newPassword = ref<string | null>(null);

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      newPassword.value = null;
    }
  },
);

async function reset(): Promise<void> {
  if (!props.user) return;
  resetting.value = true;
  try {
    newPassword.value = await usersService.resetPassword(props.user.id);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Reset failed');
    onClose(false);
  } finally {
    resetting.value = false;
  }
}

function onClose(_v: boolean): void {
  emit('update:modelValue', false);
}
</script>
