<template>
  <v-dialog :model-value="modelValue" max-width="520" persistent @update:model-value="onClose">
    <v-card v-if="user">
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">{{ mdiPencil }}</v-icon>
        {{ t('users.edit_title') }}
      </v-card-title>

      <v-card-text>
        <p class="cm-readonly mb-3">
          <strong>{{ t('users.field_login') }}:</strong> <code>{{ user.loginn }}</code>
          &nbsp;·&nbsp;
          <strong>{{ t('users.col_partner') }}:</strong> #{{ user.id_anagrafica }}
          <span v-if="user.rag_soc"> — {{ user.rag_soc }}</span>
        </p>

        <v-text-field
          v-model="form.nome"
          :label="t('users.field_name') + ' *'"
          variant="outlined"
          density="comfortable"
          class="mb-3"
        />
        <v-text-field
          v-model="form.mail"
          :label="t('users.field_email')"
          type="email"
          variant="outlined"
          density="comfortable"
          class="mb-3"
        />
        <v-text-field
          v-model="form.ruolo"
          :label="t('users.field_legacy_role')"
          :hint="t('users.field_legacy_role_hint')"
          persistent-hint
          variant="outlined"
          density="comfortable"
        />
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="onClose(false)">{{ t('common.cancel') }}</v-btn>
        <v-btn
          color="primary"
          :loading="saving"
          :disabled="!isFormValid"
          :prepend-icon="mdiContentSave"
          @click="submit"
        >
          {{ t('common.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiPencil, mdiContentSave } from '@mdi/js';
import { usersService, type UserLite } from '../services/users.service';
import { useToastStore } from '../../anagrafiche/stores/toast.store';

interface Props {
  modelValue: boolean;
  user: UserLite | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  saved: [];
}>();

const { t } = useI18n();
const toast = useToastStore();

interface FormShape {
  nome: string;
  mail: string;
  ruolo: string;
}

const form = ref<FormShape>({ nome: '', mail: '', ruolo: '' });
const saving = ref(false);

const isFormValid = computed(() => form.value.nome.trim() !== '');

watch(
  () => [props.modelValue, props.user] as const,
  ([open, user]) => {
    if (open && user) {
      form.value = {
        nome: user.nome ?? '',
        mail: user.mail ?? '',
        ruolo: (user.ruolo as string) ?? '',
      };
    }
  },
);

async function submit(): Promise<void> {
  if (!props.user || !isFormValid.value) return;
  saving.value = true;
  try {
    await usersService.update(props.user.id, {
      nome: form.value.nome.trim(),
      mail: form.value.mail.trim() || undefined,
      ruolo: form.value.ruolo.trim() || undefined,
    });
    emit('saved');
    onClose(false);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Save failed');
  } finally {
    saving.value = false;
  }
}

function onClose(_v: boolean): void {
  emit('update:modelValue', false);
}
</script>

<style scoped>
.cm-readonly {
  font-size: 0.85em;
  color: var(--cm-text-secondary);
  padding: var(--cm-space-sm) var(--cm-space-md);
  background: var(--cm-surface-subtle, rgba(0, 0, 0, 0.03));
  border-radius: 4px;
}
</style>
