<template>
  <v-dialog :model-value="modelValue" max-width="520" persistent @update:model-value="onClose">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">{{ action === 'grant' ? mdiAccountPlus : mdiAccountRemove }}</v-icon>
        {{ action === 'grant'
          ? t('users.bulk.grant_title', { n: userCount })
          : t('users.bulk.revoke_title', { n: userCount }) }}
      </v-card-title>

      <v-card-text>
        <p class="cm-hint mb-3">
          {{ action === 'grant'
            ? t('users.bulk.grant_hint')
            : t('users.bulk.revoke_hint') }}
        </p>

        <CmInternalRoleSelect
          v-model="selectedRoleId"
          :label="t('users.bulk.role_label')"
          :rules="[ruleRequiredId]"
          class="mb-3"
        />

        <v-alert
          v-if="result"
          :type="result.processed > 0 ? 'success' : 'warning'"
          variant="tonal"
          density="compact"
          class="mt-3"
        >
          {{ t('users.bulk.result', { processed: result.processed, skipped: result.skipped ?? 0 }) }}
        </v-alert>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="onClose(false)">
          {{ t('common.close') }}
        </v-btn>
        <v-btn
          v-if="!result"
          :color="action === 'grant' ? 'primary' : 'error'"
          :loading="processing"
          :disabled="!selectedRoleId"
          @click="execute"
        >
          {{ action === 'grant' ? t('users.bulk.grant_action') : t('users.bulk.revoke_action') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiAccountPlus, mdiAccountRemove } from '@mdi/js';
import CmInternalRoleSelect from '../../internal_roles/components/CmInternalRoleSelect.vue';
import { usersService } from '../services/users.service';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useSelectorRules } from '../../anagrafiche/composables/useSelectorRules';

interface Props {
  modelValue: boolean;
  userIds: number[];
  action: 'grant' | 'revoke';
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  done: [];
}>();

const { t } = useI18n();
const toast = useToastStore();
const { ruleRequiredId } = useSelectorRules();

const selectedRoleId = ref<number | number[] | null>(null);
const processing = ref(false);
const result = ref<{ processed: number; skipped?: number } | null>(null);

const userCount = ref(0);

watch(
  () => [props.modelValue, props.userIds] as const,
  ([open, ids]) => {
    if (open) {
      selectedRoleId.value = null;
      result.value = null;
      userCount.value = ids.length;
    }
  },
);

async function execute(): Promise<void> {
  const roleId = Array.isArray(selectedRoleId.value)
    ? selectedRoleId.value[0]
    : selectedRoleId.value;
  if (!roleId || !props.userIds.length) return;

  processing.value = true;
  try {
    const res = await usersService.bulkAssignRole(props.userIds, roleId, props.action);
    result.value = res;
    toast.success(
      props.action === 'grant'
        ? t('users.bulk.granted', { n: res.processed })
        : t('users.bulk.revoked', { n: res.processed }),
    );
    emit('done');
    // Cerrar automáticamente tras una breve pausa para que se vea el resultado.
    setTimeout(() => onClose(false), 1200);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Bulk action failed');
  } finally {
    processing.value = false;
  }
}

function onClose(_v: boolean): void {
  emit('update:modelValue', false);
}
</script>

<style scoped>
.cm-hint {
  font-size: 0.85em;
  color: var(--cm-text-muted);
}
</style>
