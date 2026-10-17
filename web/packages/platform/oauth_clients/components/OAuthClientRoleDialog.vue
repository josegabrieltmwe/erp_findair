<template>
  <v-dialog :model-value="modelValue" max-width="640" persistent @update:model-value="onDialogModel">
    <v-card v-if="client">
      <v-card-title>
        {{ t('oauth_clients.role_dialog_title', { name: client.client_name || client.client_id || `#${client.id}` }) }}
      </v-card-title>
      <v-card-text>
        <p class="text-body-2 mb-3">
          {{ t('oauth_clients.role_dialog_subtitle') }}
        </p>
        <v-alert
          v-if="isExternal"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          {{ t('oauth_clients.role_external_hint') }}
        </v-alert>
        <v-alert
          v-if="error"
          type="error"
          density="compact"
          closable
          class="mb-3"
          @click:close="error = null"
        >
          {{ error }}
        </v-alert>
        <CmOAuthRoleSelect
          v-model="selectedRoleId"
          :disabled="saving"
          :label="t('oauth_clients.form_oauth_role')"
          :hint="t('oauth_clients.form_oauth_role_hint')"
          :internal-only="isExternal ? 'disable' : 'show'"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="saving" @click="close">
          {{ t('common.cancel') }}
        </v-btn>
        <v-btn color="primary" :loading="saving" @click="save">
          {{ t('common.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
/**
 * Diálogo de asignación de rol OAuth a un client. Extraído de
 * OAuthClientsPage (rbacDialog) para reutilizarlo desde la ficha de usuario
 * (UserDetailPage → lista de clients del usuario).
 *
 * Reglas: el permiso del client viene SOLO de su rol (`oauth_client.role_id`).
 * Si el client es `external`, los roles `internal_only` (scopes admin/config:*)
 * se muestran deshabilitados; el backend además responde 409
 * ROLE_NOT_ASSIGNABLE si se intenta igualmente.
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import CmOAuthRoleSelect from '../../oauth_roles/components/CmOAuthRoleSelect.vue';
import { roleConflictMessage } from '../../oauth_roles/services/oauthRoles.service';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { oauthClientsService } from '../services/oauthClients.service';

/** Mínimo que necesita el diálogo: sirve tanto OAuthClient como OAuthClientSummary. */
export interface OAuthClientRoleTarget {
  id: number;
  client_id?: string | null;
  client_name?: string | null;
  client_type?: string | null;
  role_id?: number | null;
  role_name?: string | null;
}

const props = defineProps<{
  modelValue: boolean;
  client: OAuthClientRoleTarget | null;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  saved: [roleId: number | null];
}>();

const { t } = useI18n();
const toast = useToastStore();

const selectedRoleId = ref<number | null>(null);
const saving = ref(false);
const error = ref<string | null>(null);

const isExternal = computed(() => props.client?.client_type === 'external');

watch(
  () => [props.modelValue, props.client?.id] as const,
  ([open]) => {
    if (!open) return;
    selectedRoleId.value = props.client?.role_id ?? null;
    error.value = null;
  },
  { immediate: true },
);

function onDialogModel(v: boolean): void {
  if (!v) close();
}

function close(): void {
  emit('update:modelValue', false);
}

async function save(): Promise<void> {
  if (!props.client) return;
  saving.value = true;
  error.value = null;
  try {
    await oauthClientsService.update(props.client.id, { role_id: selectedRoleId.value });
    toast.success(t('oauth_clients.role_saved'));
    emit('saved', selectedRoleId.value);
    close();
  } catch (e) {
    error.value =
      roleConflictMessage(e, 'ROLE_NOT_ASSIGNABLE') ??
      (e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}
</script>
