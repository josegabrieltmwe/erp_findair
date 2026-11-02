<template>
  <v-dialog :model-value="modelValue" max-width="560" persistent @update:model-value="onClose">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">{{ mdiAccountPlus }}</v-icon>
        {{ t('users.create_title') }}
      </v-card-title>

      <v-card-text>
        <!-- Formulario (antes de crear) -->
        <template v-if="!createdCredentials">
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
          <CmAnagraficaAutocomplete
            v-model="form.id_anagrafica"
            :label="t('selectors.partner') + ' *'"
            :rules="[ruleRequiredId]"
            class="mb-3"
          />
          <CmOAuthRoleSelect
            v-model="form.role_ids"
            multiple
            :label="t('users.field_initial_roles')"
            class="mb-3"
          />
          <v-card variant="tonal" class="pa-3 mb-2">
            <v-checkbox
              v-model="form.api_only"
              density="compact"
              hide-details
              color="primary"
              :label="t('users.api_only_label')"
            />
            <p class="cm-hint mt-1">{{ t('users.api_only_hint') }}</p>
          </v-card>
        </template>

        <!-- Credenciales (después de crear, se muestran una sola vez) -->
        <template v-else>
          <v-alert type="success" variant="tonal" density="compact" class="mb-3">
            {{ t('users.created_alert') }}
          </v-alert>
          <CredentialsRevealCard
            :loginn="createdCredentials.loginn"
            :password="createdCredentials.password"
          />
        </template>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn v-if="!createdCredentials" variant="text" @click="onClose(false)">
          {{ t('common.cancel') }}
        </v-btn>
        <v-btn
          v-if="!createdCredentials"
          color="primary"
          :loading="saving"
          :disabled="!isFormValid"
          @click="submit"
        >
          {{ t('users.create_action') }}
        </v-btn>
        <v-btn v-else color="primary" @click="onClose(false)">
          {{ t('common.close') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiAccountPlus } from '@mdi/js';
import CmAnagraficaAutocomplete from '../../listini/components/CmAnagraficaAutocomplete.vue';
import CmOAuthRoleSelect from '../../oauth_roles/components/CmOAuthRoleSelect.vue';
import CredentialsRevealCard from '../../anagrafiche/components/CredentialsRevealCard.vue';
import { oauthRolesService } from '../../oauth_roles/services/oauthRoles.service';
import { rolesNotGranted } from '../services/userRoleResults';
import { formatRolesDenied } from '../services/userRootPolicy';
import { usersService, type UserCredentials } from '../services/users.service';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useSelectorRules } from '../../anagrafiche/composables/useSelectorRules';
import { localizedErrorText } from '../../utils/apiError';

interface Props {
  modelValue: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  created: [credentials: UserCredentials];
}>();

const { t, te } = useI18n();
const toast = useToastStore();
const { ruleRequiredId } = useSelectorRules();

interface FormShape {
  nome: string;
  mail: string;
  id_anagrafica: number | null;
  role_ids: number[];
  api_only: boolean;
}

function emptyForm(): FormShape {
  return { nome: '', mail: '', id_anagrafica: null, role_ids: [], api_only: false };
}

const form = ref<FormShape>(emptyForm());
const saving = ref(false);
const createdCredentials = ref<UserCredentials | null>(null);

const isFormValid = computed(
  () => form.value.nome.trim() !== '' && !!form.value.id_anagrafica && form.value.id_anagrafica > 0,
);

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      form.value = emptyForm();
      createdCredentials.value = null;
    }
  },
);

async function submit(): Promise<void> {
  if (!isFormValid.value || !form.value.id_anagrafica) return;
  saving.value = true;
  try {
    const creds = await usersService.create({
      nome: form.value.nome.trim(),
      mail: form.value.mail.trim() || undefined,
      id_anagrafica: form.value.id_anagrafica,
      role_ids: form.value.role_ids,
      api_only: form.value.api_only,
    });
    createdCredentials.value = creds;
    await warnRolesNotGranted(creds, form.value.role_ids);
    emit('created', creds);
  } catch (e) {
    toast.error(localizedErrorText(e, { t, te }, 'Create failed'));
  } finally {
    saving.value = false;
  }
}

// El servidor omite en silencio los roles que su política deniega (p. ej. root
// para un no-root): se contrastan con roles_assigned y se avisa de los que faltan.
async function warnRolesNotGranted(
  creds: UserCredentials,
  requestedIds: number[],
): Promise<void> {
  if (!requestedIds.length) return;
  // P42: el servidor informa de los roles denegados con su código (p. ej. ROLE_ROOT_ONLY al pedir root sin serlo).
  if (creds.roles_denied?.length) {
    toast.warning(
      t('users.roles_denied', { roles: formatRolesDenied(creds.roles_denied, { t, te }) }),
      10000,
    );
    return;
  }
  try {
    const roles = await oauthRolesService.list();
    const requested = requestedIds.map(
      (id) => roles.find((r) => r.id === id)?.role_name ?? String(id),
    );
    const missing = rolesNotGranted(requested, creds.roles_assigned);
    if (missing.length) {
      toast.warning(t('users.roles_not_granted', { roles: missing.join(', ') }), 10000);
    }
  } catch {
    // Sin catálogo no se puede contrastar por nombre: no bloquea el alta.
  }
}

function onClose(_v: boolean): void {
  emit('update:modelValue', false);
}
</script>

<style scoped>
.cm-hint {
  font-size: 0.8em;
  color: var(--cm-text-muted);
  margin-left: 32px;
}
</style>
